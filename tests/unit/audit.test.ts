// Denetim testleri: kenar durumlar, bozuk/kötü niyetli kayıtlar, büyük sayılar, saat dilimi, ekonomi değişmezleri.
import { describe, it, expect } from 'vitest';
import { fmt, fmtTime, clock, weekKey, dayKey, dayDiff, esc, loc } from '../../src/format';
import { newState, migrate, setS, S } from '../../src/state';
import { totalRate, pending, unlockInfo, baseRate, buildCost, upCost, buildTime, isFull, filled } from '../../src/economy';
import { DLIST, ORDER, TYPES, MAXLV, CITY_ORDER } from '../../src/config';
import { marketOf, marketMult } from '../../src/game/modifiers';
import { seasonId } from '../../src/game/fun';

const T = Date.UTC(2026, 10, 1, 12);
const WK = weekKey(new Date(T));
const b = (t: any, lvl = 1) => ({ t, lvl, buf: 0, until: 0, dur: 1, up: false });

/** Kayıt yüklendikten sonra oyunun her karede çağırdığı saf hesaplar çökmemeli ve sonlu kalmalı. */
function exercise() {
  const r = totalRate(true), p = pending();
  for (const k of S.own) { unlockInfo(k); filled(k); isFull(k); for (let i = 0; i < 20; i++) baseRate(k, i); }
  for (const d of DLIST) unlockInfo(d.key);
  return { r, p };
}

describe('format: kenar durumlar', () => {
  it('NaN, negatif, sonsuz, undefined güvenli', () => {
    expect(fmt(NaN)).toBe('₺0'); expect(fmt(-5)).toBe('₺0'); expect(fmt(undefined as any)).toBe('₺0');
    expect(fmt(Infinity)).toBe('₺∞');
    expect(fmt(Number.MAX_VALUE)).not.toMatch(/NaN|undefined/);
  });
  it('birim sınırları yuvarlanırken 1000 göstermez', () => {
    expect(fmt(999)).toBe('₺999'); expect(fmt(999.99)).toBe('₺999');
    expect(fmt(999999)).toBe('₺999B'); expect(fmt(1e6)).toBe('₺1Mn');
    expect(fmt(99.99, true)).toBe('₺99,9');
  });
  it('süre biçimleri', () => {
    expect(fmtTime(0)).toBe('0 sn'); expect(fmtTime(-100)).toBe('0 sn'); expect(fmtTime(NaN)).not.toMatch(/NaN/);
    expect(fmtTime(3600e3)).toBe('1 sa'); expect(fmtTime(3661e3)).toBe('1 sa 1 dk'); expect(fmtTime(61e3)).toBe('1 dk 1 sn');
    expect(clock(3599e3)).toBe('59:59'); expect(clock(3600e3)).toBe('1:00:00');
  });
  it('HTML kaçışı (XSS)', () => {
    expect(esc('<img src=x onerror=alert(1)>')).toBe('&lt;img src=x onerror=alert(1)&gt;');
    expect(esc('"\'&')).toBe('&quot;&#39;&amp;');
    expect(esc(null)).toBe('null');
  });
  it('emoji ve uzun adlarda bulunma eki çökmez', () => {
    expect(loc('🏠')).toMatch(/’(de|te|da|ta)$/);
    expect(loc('A'.repeat(500)).length).toBeGreaterThan(500);
  });
});

describe('tarih: saat dilimi, yaz saati, yıl sınırı', () => {
  it('ISO hafta yıl sınırında doğru', () => {
    expect(weekKey(new Date(2026, 11, 31))).toBe('2026-H53');
    expect(weekKey(new Date(2027, 0, 1))).toBe('2026-H53');
    expect(weekKey(new Date(2027, 0, 4))).toBe('2027-H01');
    expect(weekKey(new Date(2024, 11, 30))).toBe('2025-H01');
  });
  it('gün farkı yaz saati geçişinden etkilenmez', () => {
    expect(dayDiff('2026-03-28', '2026-03-29')).toBe(1);
    expect(dayDiff('2026-10-24', '2026-10-26')).toBe(2);
    expect(dayDiff('2026-12-31', '2027-01-01')).toBe(1);
    expect(dayDiff('2028-02-28', '2028-03-01')).toBe(2); // artık yıl
  });
  it('geçersiz tarih metni NaN üretse de çökmez', () => {
    expect(() => dayDiff('', 'bozuk')).not.toThrow();
    expect(dayKey(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
  it('piyasa haftası: bozuk hafta anahtarı varsayılan döner', () => {
    expect(() => marketOf('')).not.toThrow(); expect(() => marketOf(undefined as any)).not.toThrow();
    for (let n = 1; n <= 53; n++) { const m = marketOf('2026-H' + n); expect(m.up).not.toBe(m.down); }
    expect(marketMult('ev', 'bozuk')).toBeGreaterThan(0);
  });
  it('sezon kimliği ay bazlı ve aralık→ocak geçişi', () => {
    expect(seasonId(+new Date(2026, 11, 31, 23))).not.toBe(seasonId(+new Date(2027, 0, 1, 1)));
  });
});

describe('kayıt: bozuk ve kötü niyetli veri', () => {
  const good = () => { const s: any = newState(T, WK, 'ist'); s.d['ist-0'][0] = b('ev', 2); return JSON.parse(JSON.stringify(s)); };
  it('alanlar null olduğunda varsayılana döner ve oyun hesapları çökmez', () => {
    const base = good();
    for (const k of Object.keys(base)) {
      if (['v', 'd', 'own'].includes(k)) continue;
      const s = migrate({ ...good(), [k]: null }, T, WK);
      expect(s, k).not.toBeNull(); setS(s!);
      expect(() => exercise(), 'alan ' + k + ' = null').not.toThrow();
    }
  });
  it('alanlar yanlış türde olduğunda (metin, sayı, dizi) çökmez', () => {
    const base = good();
    for (const k of Object.keys(base)) {
      if (['v', 'd', 'own'].includes(k)) continue;
      for (const bad of ['x', 7, [], {}]) {
        const s = migrate({ ...good(), [k]: bad }, T, WK);
        if (!s) continue; setS(s);
        expect(() => exercise(), `alan ${k} = ${JSON.stringify(bad)}`).not.toThrow();
        expect(Number.isFinite(S.cash), `kasa sonlu (${k})`).toBe(true);
      }
    }
  });
  it('bilinmeyen semt anahtarları ve bozuk arsalar ayıklanır', () => {
    const s = migrate({ ...good(), own: ['ist-0', 'xxx-9', '__proto__', 5], cur: 'xxx-9' }, T, WK)!;
    setS(s); expect(S.own).toEqual(['ist-0']); expect(S.cur).toBe('ist-0');
    expect(() => exercise()).not.toThrow();
  });
  it('arsada bilinmeyen bina türü, negatif/aşırı kat, NaN kira', () => {
    const g = good();
    g.d['ist-0'][1] = { t: 'kale', lvl: 3, buf: 0, until: 0, dur: 1, up: false };
    g.d['ist-0'][2] = { t: 'ev', lvl: 99, buf: NaN, until: 0, dur: 1, up: false };
    g.d['ist-0'][3] = { t: 'ev', lvl: -4, buf: -1e9, until: 0, dur: 1, up: false };
    g.d['ist-0'][4] = 'bozuk'; g.d['ist-0'][5] = 12;
    const s = migrate(g, T, WK)!; setS(s);
    const { r, p } = exercise();
    expect(Number.isFinite(r)).toBe(true); expect(Number.isFinite(p.amount)).toBe(true); expect(p.amount).toBeGreaterThanOrEqual(0);
    for (const q of S.d['ist-0']) if (q) { expect(ORDER).toContain(q.t); expect(q.lvl).toBeGreaterThanOrEqual(0); expect(q.lvl).toBeLessThanOrEqual(MAXLV); }
  });
  it('dizi uzunluğu 20 ile sınırlı (aşırı büyük kayıt)', () => {
    const g = good(); g.d['ist-0'] = Array(5000).fill(null).map(() => b('ev', 1));
    setS(migrate(g, T, WK)!); expect(S.d['ist-0'].length).toBe(20);
  });
  it('__proto__ ile prototip kirletme etkisiz', () => {
    const raw = JSON.parse('{"v":2,"city":"ist","own":["ist-0"],"cur":"ist-0","d":{"ist-0":[]},"__proto__":{"polluted":1}}');
    migrate(raw, T, WK); expect(({} as any).polluted).toBeUndefined();
  });
  it('aşırı kasa (1e308, Infinity) sınırlanır', () => {
    let s = migrate({ ...good(), cash: Infinity }, T, WK)!; expect(Number.isFinite(s.cash)).toBe(true);
    s = migrate({ ...good(), cash: 1e308, earned: -1 }, T, WK)!; setS(s); expect(() => exercise()).not.toThrow();
  });
  it('rastgele bozulma (fuzz, sabit tohum, 400 kayıt) çökme üretmez', () => {
    let seed = 42; const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
    const vals = [null, undefined, NaN, -1, 0, 1e300, 'x', true, [], {}, [null], { t: 'ev' }];
    let crashes = 0;
    for (let n = 0; n < 400; n++) {
      const g = good(); const keys = Object.keys(g);
      if (rnd() < 0.5) g.d['ist-0'][Math.floor(rnd() * 20)] = vals[Math.floor(rnd() * vals.length)];
      for (let m = 0; m < 4; m++) g[keys[Math.floor(rnd() * keys.length)]] = vals[Math.floor(rnd() * vals.length)];
      try { const s = migrate(g, T, WK); if (s) { setS(s); exercise(); } } catch { crashes++; }
    }
    expect(crashes).toBe(0);
  });
});

describe('ekonomi değişmezleri', () => {
  it('her semtte her tür için maliyet/süre pozitif ve sonlu, kademe arttıkça artar', () => {
    setS(newState(T, WK, 'ist'));
    for (const c of CITY_ORDER) for (const t of ORDER) {
      let prev = 0;
      for (let i = 0; i < 5; i++) {
        const k = `${c}-${i}`; const cost = buildCost(k, t);
        expect(cost).toBeGreaterThan(prev); expect(Number.isFinite(buildTime(k, t))).toBe(true); prev = cost;
        for (let lv = 1; lv < MAXLV; lv++) expect(upCost(k, b(t, lv) as any)).toBeGreaterThan(0);
      }
    }
  });
  it('tüm iller dolu, en üst seviye: toplam kira sonlu (taşma yok)', () => {
    setS(newState(T, WK, 'ist'));
    S.own = DLIST.map(d => d.key);
    for (const d of DLIST) S.d[d.key] = Array.from({ length: 20 }, (_, i) => b(ORDER[i % 4], MAXLV));
    S.shares = 1e6; S.premium = true; S.coll = Array(50).fill('x');
    const r = totalRate(false); expect(Number.isFinite(r)).toBe(true); expect(r).toBeGreaterThan(0);
    expect(fmt(r * 3600 * 24 * 365)).not.toMatch(/NaN|undefined/);
  });
  it('bina türü açılış sırası ucuzdan pahalıya', () => {
    const c = ORDER.map(t => TYPES[t].cost); expect([...c].sort((a, b) => a - b)).toEqual(c);
  });
});
