// Ülke fiyat seviyeleri (config.ts priceLevel, format.ts, game/bankcore.ts): gösterim = iç birim × seviye (yerel para), kuruş yok,
// TR'de en ucuz ev ≥ ₺1Mn, her bölgede ilk ev hedef aralıkta, getiri her ülkede aynı, girdi çevrimi ve ihale adımları yerel parada
// yuvarlak, banka dönüşümü (iç → yerel → kur → yerel → iç), arbitraj yok (tüm bölge çiftleri ve üçlü turlar, en iyi zamanlama),
// günlük hak iç birimde aynı, bilanço gerçek değerlerle.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { CFG, TYPES, REGIONS, REGION_ORDER, RegionId, CurId, CUR_OF, CURS, setRegion, priceLevel, dispScale, unitTry, tryPer, toDisp, fromDisp } from '../../src/config';
import { fmt, fmtIn, fmtCost, money, weekKey } from '../../src/format';
import { setLang, units, Lang } from '../../src/i18n';
import { sane, applyValues } from '../../src/services/remote';
import { newState, setS } from '../../src/state';
import { quote, midIn, levelRatio, rate, costMult, amps, dailyCap, worthIn, idx } from '../../src/game/bankcore';
import { makeAuction, IH } from '../../src/game/auccore';

const DEF = { ...CFG };
const T0 = Date.UTC(2026, 10, 16, 9, 30), HOUR = 3600e3;
const LANGS: Lang[] = ['tr', 'en', 'de', 'ja'];
const EV = TYPES.ev.cost; // en ucuz ev (iç birim 100)
/** İlk evin ekrandaki fiyat aralığı (yerel para) ve gerçek kurla $ karşılığının Türkiye'ye oranı. */
const TARGET: Record<RegionId, { lo: number; hi: number; x: [number, number] }> = {
  tr: { lo: 1e6, hi: 1.5e6, x: [1, 1] },
  us: { lo: 250e3, hi: 300e3, x: [8, 10] },
  uk: { lo: 220e3, hi: 280e3, x: [9, 11] },
  de: { lo: 180e3, hi: 230e3, x: [6, 8] },
  jp: { lo: 20e6, hi: 30e6, x: [4, 6] },
  gl: { lo: 250e3, hi: 300e3, x: [8, 10] },
};
beforeEach(() => { Object.assign(CFG, DEF); setRegion('tr'); setLang('tr'); });
afterEach(() => { Object.assign(CFG, DEF); setRegion('tr'); setLang('tr'); });

describe('fiyat seviyesi', () => {
  it('her bölgenin seviyesi CFG’de, Remote Config ile ayarlanır ve sınır kontrolünden geçer', () => {
    for (const k of ['PL_TR', 'PL_US', 'PL_UK', 'PL_DE', 'PL_JP', 'PL_GL']) expect(k in CFG).toBe(true);
    for (const r of REGION_ORDER) { expect(priceLevel(r)).toBeGreaterThan(100); expect(dispScale(r)).toBe(priceLevel(r)); }
    expect(sane('PL_TR', 15000)).toBe(true); expect(sane('PL_TR', 1.3e5)).toBe(false); expect(sane('PL_TR', 1000)).toBe(false);
    expect(sane('PL_US', 0)).toBe(false); expect(sane('PL_JP', -1)).toBe(false); expect(sane('PL_DE', NaN)).toBe(false);
    expect(applyValues({ PL_TR: 15000, PL_US: 1e9 })).toEqual(['PL_TR']);
    expect(priceLevel('tr')).toBe(15000); expect(priceLevel('us')).toBe(DEF.PL_US);
    (CFG as any).PL_UK = 0; expect(priceLevel('uk')).toBe(2200); (CFG as any).PL_JP = NaN; expect(priceLevel('jp')).toBe(240000); // bozuk ayar: varsayılan
  });
  it('Türkiye’de en ucuz ev ≥ ₺1.000.000', () => {
    expect(Math.min(...Object.values(TYPES).map(x => x.cost))).toBe(EV);
    expect(toDisp(EV, 'tr')).toBeGreaterThanOrEqual(1e6);
    expect(fmt(EV)).toBe('₺1,2Mn'); expect(fmtCost(EV)).toBe('₺1,2Mn');
  });
  it('her bölgede ilk ev hedef aralıkta; gerçek kurla $ karşılığı Türkiye’den belirgin pahalı', () => {
    const usd = (r: RegionId) => toDisp(EV, r) * tryPer(CUR_OF[r]) / tryPer('USD');
    for (const r of REGION_ORDER) {
      const v = toDisp(EV, r), g = TARGET[r], x = usd(r) / usd('tr');
      expect(v, r).toBeGreaterThanOrEqual(g.lo); expect(v, r).toBeLessThanOrEqual(g.hi);
      expect(x, r + ' / tr').toBeGreaterThanOrEqual(g.x[0]); expect(x, r + ' / tr').toBeLessThanOrEqual(g.x[1]);
      expect(unitTry(r) / unitTry('tr')).toBeCloseTo(x, 9);
    }
    const show: [RegionId, Lang, string, string, string][] = [['tr', 'tr', '₺1,2Mn', '₺12B', '₺1,8Mn'], ['us', 'en', '$250K', '$2.5K', '$375K'], ['uk', 'en', '£220K', '£2.2K', '£330K'],
      ['de', 'de', '€180Tsd', '€1,8Tsd', '€270Tsd'], ['jp', 'ja', '¥2400万', '¥24万', '¥3600万'], ['gl', 'en', '$250K', '$2.5K', '$375K']];
    for (const [r, l, ev, kira, kasa] of show) { setRegion(r); setLang(l); expect([fmt(EV), fmt(TYPES.ev.inc), fmt(150)]).toEqual([ev, kira, kasa]); }
  });
  it('kira aynı seviyeyle ölçeklenir: fiyat/kira oranı (getiri) her ülkede aynı', () => {
    for (const b of Object.values(TYPES)) {
      const y = REGION_ORDER.map(r => toDisp(b.inc, r) / toDisp(b.cost, r));
      for (const v of y) expect(v).toBeCloseTo(b.inc / b.cost, 12);
    }
  });
  it('Global: tek para ($) ve tek seviye (ABD ile aynı)', () => {
    expect(REGIONS.gl.cur).toBe('$'); expect(CUR_OF.gl).toBe('USD'); expect(priceLevel('gl')).toBe(priceLevel('us'));
    expect(levelRatio('us', 'gl')).toBe(1);
  });
});

describe('gösterim: kuruş yok, büyük sayılar okunaklı', () => {
  it('hiçbir bölgede ve dilde kuruş görünmez; kısaltmasız tutar tamsayı', () => {
    let seed = 11; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (const r of REGION_ORDER) for (const l of LANGS) {
      setRegion(r); setLang(l);
      const U = units(), sym = REGIONS[r].cur.replace('$', '\\$');
      const re = new RegExp('^' + sym + '(\\d{1,4}|\\d{1,2}[' + U.dec + ']\\d(?=.))(' + U.u.join('|') + ')?$', 'u');
      for (let k = 0; k < 400; k++) {
        const v = Math.pow(10, -4 + rnd() * 20), s = fmt(v), c = fmtCost(v);
        expect(s, `${r}/${l} ${v}`).toMatch(re); expect(c, `${r}/${l} ${v}`).toMatch(re);
        if (toDisp(v, r) < U.base) { expect(s).toMatch(/^\D\d+$/u); expect(c).toMatch(/^\D\d+$/u); }
      }
      expect(fmt(0)).toBe(REGIONS[r].cur + '0'); expect(fmt(1e-9)).toBe(REGIONS[r].cur + '0');
    }
    setRegion('us'); setLang('en');
    expect(fmt(0.0005)).toBe('$1'); expect(fmt(0.0349)).toBe('$87'); expect(fmt(0.4)).toBe('$1K'); expect(fmtIn(0.8, 'us')).toBe('$2K');
    expect(money(12.6, '$')).toBe('$12'); expect(money(99.99, '€')).toBe('€99'); expect(money(99.01, '€', false, true)).toBe('€100');
  });
  it('çok büyük değerler: katrilyon üstünde de kısaltmalar yeter (4 dil, en büyük seviye), üs gösterimi yok', () => {
    for (const r of REGION_ORDER) for (const l of LANGS) {
      setRegion(r); setLang(l);
      for (const v of [1e9, 1e12, 1e15, 1e18, 1e21, 1e24, 1e30]) { const s = fmt(v); expect(s, `${r}/${l} ${v}`).not.toMatch(/e\d|NaN|Infinity|undefined/); expect(s.length).toBeLessThanOrEqual(10); }
    }
    setRegion('tr'); setLang('tr'); expect(fmt(1e15)).toBe('₺12Kt'); expect(fmt(2.5e11)).toBe('₺3Kn');
    setRegion('us'); setLang('en'); expect(fmt(1e15)).toBe('$2.5Qi');
    setRegion('de'); setLang('de'); expect(fmt(1e15)).toBe('€1,8Tri');
    setRegion('jp'); setLang('ja'); expect(fmt(1e15)).toBe('¥2.4垓');
    setRegion('jp'); setLang('tr'); expect(fmt(1e15)).toBe('¥240Kt');
  });
  it('girdi çevrimi: toDisp ↔ fromDisp; ihale açılışı ve adımı yerel parada yuvarlak, kayıt iç birimde', () => {
    for (const r of REGION_ORDER) for (const x of [1, 150, 2580, 1e9]) { expect(fromDisp(toDisp(x, r), r)).toBeCloseTo(x, 6); expect(toDisp(x, r)).toBe(x * priceLevel(r)); }
    for (const [r, city] of [['tr', 'ist'], ['us', 'nyc'], ['uk', 'lon'], ['de', 'muc'], ['jp', 'tyo'], ['gl', 'nyc']] as [RegionId, string][]) {
      setRegion(r); setLang(r === 'de' ? 'de' : r === 'jp' ? 'ja' : r === 'tr' ? 'tr' : 'en');
      setS(newState(T0, weekKey(new Date(T0)), city)); IH();
      for (const unit of [900, 1234, 77777]) {
        const a = makeAuction('t-' + r + unit, 'lm', 'x', city, T0, unit);
        const shown = toDisp(a.start), stp = toDisp(a.step), two = (v: number) => { const p = Math.pow(10, Math.floor(Math.log10(v)) - 1); return Math.abs(v / p - Math.round(v / p)); };
        expect(two(shown), `${r} açılış ${shown}`).toBeLessThan(1e-6); expect(two(stp), `${r} adım ${stp}`).toBeLessThan(1e-6); // ilk iki hane
        expect(a.start).toBeGreaterThanOrEqual(unit * CFG.IH_LM_OPEN * (1 - 1e-12)); expect(a.start).toBeLessThan(unit * CFG.IH_LM_OPEN * 1.1);
        expect(fmt(a.start + 3 * a.step)).toBe(fmt(fromDisp(shown + 3 * stp))); // adım adım artan teklif ekranda tam
        expect(Math.abs(a.cap / a.step - Math.round(a.cap / a.step))).toBeLessThan(1e-9);
      }
    }
  });
});

describe('banka: seviye dönüşümü ve arbitraj', () => {
  const REGS = REGION_ORDER;
  it('aktarım = gönderen iç birim → yerel para → kur (makas + komisyon) → alan yerel para → alan iç birim', () => {
    for (const a of REGS) for (const b of REGS) {
      if (a === b) continue;
      const amt = 1e6, q = quote(a, b, T0), same = CUR_OF[a] === CUR_OF[b];
      const sent = toDisp(amt, a), arrives = sent * rate(CUR_OF[a], CUR_OF[b], T0) * costMult(same); // alanın parasıyla
      expect(toDisp(amt * q.net, b) / arrives, a + '→' + b).toBeCloseTo(1, 9);
      expect(q.show).toBe(rate(CUR_OF[a], CUR_OF[b], T0));
      expect(q.mid).toBe(midIn(a, b, T0)); expect(q.net).toBeCloseTo(q.mid * costMult(same), 12);
      expect(levelRatio(a, b) * levelRatio(b, a)).toBeCloseTo(1, 12);
    }
  });
  it('pahalı ülkeye giden para daha az iç birim eder, ucuz ülkeye giden daha çok', () => {
    expect(levelRatio('tr', 'us')).toBeCloseTo(12000 / (2500 * 43), 12);
    expect(quote('tr', 'us', T0).net).toBeLessThan(0.13); expect(quote('tr', 'us', T0).net).toBeGreaterThan(0.09);
    expect(quote('us', 'tr', T0).net).toBeGreaterThan(8); expect(quote('us', 'tr', T0).net).toBeLessThan(9.3);
    for (const r of ['us', 'uk', 'de', 'jp', 'gl'] as RegionId[]) { expect(quote('tr', r, T0).net, 'tr→' + r).toBeLessThan(0.3); expect(quote(r, 'tr', T0).net, r + '→tr').toBeGreaterThan(3.5); }
    expect(quote('us', 'gl', T0).net).toBeCloseTo(1 - CFG.BANK_FEE, 12); // aynı para, aynı seviye: yalnız komisyon
  });
  it('arbitraj yok: tüm bölge çiftlerinde ve üçlü turlarda, her bacak en iyi saatinde yapılsa bile gidiş-dönüş zarar', () => {
    const best: Record<string, number> = {};
    for (const a of REGS) for (const b of REGS) { if (a === b) continue; let hi = 0; for (let h = 0; h < 120 * 24; h++) hi = Math.max(hi, quote(a, b, T0 + h * HOUR).net); best[a + b] = hi; }
    let two = 0, three = 0;
    for (const a of REGS) for (const b of REGS) {
      if (a === b) continue;
      const v = best[a + b] * best[b + a]; expect(v, `${a}→${b}→${a}`).toBeLessThan(1); two = Math.max(two, v);
      for (const c of REGS) { if (c === a || c === b) continue; const w = best[a + b] * best[b + c] * best[c + a]; expect(w, `${a}→${b}→${c}→${a}`).toBeLessThan(1); three = Math.max(three, w); }
    }
    expect(two).toBeLessThan(0.985); expect(two).toBeGreaterThan(0.94); expect(three).toBeLessThan(0.985);
    // TR → ABD → TR: seviye farkı (≈9×) kâra dönmez
    expect(best.trus * best.ustr).toBeLessThan(0.99);
    const A = amps().a; expect((1 + A) / (1 - A) * costMult()).toBeLessThan(1);
  });
  it('seviyeler Remote Config ile değişse de (her biri 1/10 – 10 kat) gidiş-dönüş zarar', () => {
    Object.assign(CFG, { PL_TR: 120000, PL_US: 250, PL_UK: 22000, PL_DE: 180, PL_JP: 2400000, PL_GL: 25000 });
    for (const a of REGS) for (const b of REGS) {
      if (a === b) continue;
      let g = 0, d = 0; for (let h = 0; h < 30 * 24; h++) { g = Math.max(g, quote(a, b, T0 + h * HOUR).net); d = Math.max(d, quote(b, a, T0 + h * HOUR).net); }
      expect(g * d, a + '↔' + b).toBeLessThan(1);
    }
    expect(quote('us', 'gl', T0).net * quote('gl', 'us', T0).net).toBeLessThan(1); // aynı para, farklı seviye: yine yalnız komisyon kaybı
  });
  it('günlük hak iç birimde: alan bölgenin kirasına bağlı, seviyeden ve gönderenden bağımsız', () => {
    const cap0 = [dailyCap(null), dailyCap({ bank: { rate: 100 } })];
    for (const r of REGS) { setRegion(r); expect([dailyCap(null), dailyCap({ bank: { rate: 100 } })]).toEqual(cap0); }
    Object.assign(CFG, { PL_TR: 50000, PL_US: 900 }); expect([dailyCap(null), dailyCap({ bank: { rate: 100 } })]).toEqual(cap0);
    expect(cap0).toEqual([CFG.BANK_FLOOR, 30 * 60 * 100]);
  });
  it('bilanço: gerçek değerlerle (ülke fiyat seviyesi), seçilen parada doğru çevrim', () => {
    const near = (a: number, b: number) => { expect(a / b).toBeGreaterThan(0.97); expect(a / b).toBeLessThan(1.03); };
    expect(worthIn(EV, 'tr', 'TRY', T0)).toBeCloseTo(1.2e6, 6); expect(worthIn(EV, 'us', 'USD', T0)).toBeCloseTo(250e3, 6); expect(worthIn(EV, 'jp', 'JPY', T0)).toBeCloseTo(24e6, 4);
    near(worthIn(EV, 'us', 'TRY', T0), 250e3 * 43); near(worthIn(EV, 'tr', 'USD', T0), 1.2e6 / 43);
    near(worthIn(EV, 'uk', 'EUR', T0), 220e3 * 1.33 / 1.15); near(worthIn(EV, 'jp', 'USD', T0), 24e6 * 0.0066);
    for (const r of REGS) for (const c of CURS as CurId[]) {
      expect(worthIn(EV, r, c, T0)).toBeCloseTo(toDisp(EV, r) * rate(CUR_OF[r], c, T0), 4);            // yerel tutar × gösterilen kur
      expect(worthIn(EV, r, c, T0) * idx(c, T0) * tryPer(c)).toBeCloseTo(worthIn(EV, r, 'TRY', T0) * idx('TRY', T0), 3); // para seçimi toplamı değiştirmez
    }
    // aktarılan paranın bilanço değeri (seçilen parada) yalnız makas + komisyon kadar azalır
    for (const a of REGS) for (const b of REGS) if (a !== b) expect(worthIn(1e6 * quote(a, b, T0).net, b, 'USD', T0) / worthIn(1e6, a, 'USD', T0)).toBeCloseTo(costMult(CUR_OF[a] === CUR_OF[b]), 9);
  });
});
