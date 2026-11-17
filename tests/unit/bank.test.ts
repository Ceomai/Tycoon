// Banka, kur ve bilanço (game/bankcore.ts, game/bank.ts): kur deterministik ve sınırlı (gün içi ±%1, toplam ±%3), en iyi/en kötü
// zamanlı gidiş-dönüş zararı (Remote Config kötüye kullanımında da), gösterim ölçeği (₺ taban, $ €  £ ¥) ve girdi çevrimi (ihale
// adımları), günlük hak, emanet → başlangıç sermayesi, çift kayıt defteri (onay, çok sekme, sıfırlanan bölge), bulut paketi
// anlık görüntüleriyle para çoğalmaması, lig / görev / holding dışı, kayıt temizliği, bilanço değerlemesi.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../src/ui/modal', () => ({
  openModal: vi.fn(), closeModal: vi.fn(), bump: vi.fn(), toast: vi.fn(), flushQueue: vi.fn(), flyTo: vi.fn(async () => {}), flyCoin: vi.fn(async () => {}),
  countUp: vi.fn(), showGain: vi.fn(), bigStamp: vi.fn(), cashText: vi.fn(),
}));
vi.mock('../../src/sound', () => ({ Snd: new Proxy({}, { get: () => () => {} }), buzz: Object.assign(vi.fn(), { light: vi.fn(), medium: vi.fn(), success: vi.fn(), error: vi.fn(), select: vi.fn() }) }));

import { newState, setS, S, migrate, Plot } from '../../src/state';
import { CFG, setRegion, REGION_ORDER, CURS, dispScale, toDisp, fromDisp, tryPer, BuildingType, RegionId, CurId } from '../../src/config';
import { weekKey, fmt, fmtIn } from '../../src/format';
import { setLang } from '../../src/i18n';
import { Time } from '../../src/time';
import { totalRate } from '../../src/economy';
import { sane } from '../../src/services/remote';
import { flushSaves, unlockSaves, writeRegionSave, saveKeyOf } from '../../src/storage';
import { idx, rate, quote, amps, costMult, hist, vsWeek, dailyCap, valueOf, trimIn, newBank, fxPair, BANK_KEEP_IN } from '../../src/game/bankcore';
import { transfer, deliverOut, claimIn, bankBoot, capLeft, maxSend, loadAll, mergeForeign, cheapCur, bankOpen, REG } from '../../src/game/bank';
import { makeAuction, IH, nice } from '../../src/game/auccore';
import { sharesPreview } from '../../src/game/collection';

const DEF = { ...CFG };
const T0 = Date.UTC(2026, 10, 16, 9, 30);
const HOUR = 3600e3;
const PAIRS: [CurId, CurId][] = CURS.flatMap(a => CURS.filter(b => b !== a).map(b => [a, b] as [CurId, CurId]));

class MemStore {
  m = new Map<string, string>(); snaps: Map<string, string>[] = [];
  getItem(k: string) { return this.m.has(k) ? this.m.get(k)! : null; }
  setItem(k: string, v: string) { this.m.set(k, String(v)); this.snaps.push(new Map(this.m)); }
  removeItem(k: string) { this.m.delete(k); }
  clear() { this.m.clear(); }
  key(i: number) { return [...this.m.keys()][i] ?? null; }
  get length() { return this.m.size; }
}
let ls: MemStore;
const read = (r: RegionId) => { const raw = ls.getItem(saveKeyOf(r)); if (!raw) return null; const o = JSON.parse(raw); return JSON.parse(o.j); };
const P = (t: BuildingType, lvl = 3): Plot => ({ t, lvl, buf: 0, until: 0, dur: 1, up: false });

/** Bölge oyunu: o bölgeye geçer, kayıttan (yoksa yeni) durumu kurar. */
function play(r: RegionId, city?: string) {
  setRegion(r);
  const raw = read(r); const s = raw ? migrate(raw, Time.now(), weekKey(new Date(Time.now()))) : null;
  setS(s || newState(Time.now(), weekKey(new Date(Time.now())), city || null));
  REG.at = 0; REG.saves = {};
  return S;
}
/** Başlamış bir bölge kaydı: dolu iki semt, kasa. */
async function seed(r: RegionId, city: string, cash: number) {
  setRegion(r);
  const s = newState(Time.now(), weekKey(new Date(Time.now())), city), k0 = `${city}-0`, k1 = `${city}-1`;
  s.d[k0] = Array.from({ length: 20 }, (_, i) => P((['ev', 'kafe', 'dukkan', 'ofis'] as BuildingType[])[i % 4], 3)); s.d[k1] = Array(20).fill(null);
  s.own = [k0, k1]; s.cash = cash; s.earned = 1e6; s.week.earned = 5e5;
  setS(s); s.bank.rate = totalRate(false);
  await writeRegionSave(r, s);
  return s;
}
const money = () => REGION_ORDER.reduce((a, r) => { const v = read(r); return a + (v && v.city ? +v.cash : 0) + (v && v.bank ? v.bank.out.filter((o: any) => !o.s).reduce((x: number, o: any) => x + o.a, 0) : 0); }, 0);

beforeEach(async () => {
  ls = new MemStore(); (globalThis as any).localStorage = ls;
  Object.assign(CFG, DEF); Time.offset = T0 - Date.now(); setLang('tr');
  await flushSaves(); unlockSaves(); setRegion('tr');
});
afterEach(async () => { await flushSaves(); Object.assign(CFG, DEF); Time.offset = 0; setRegion('tr'); });

describe('kur', () => {
  it('deterministik: herkes için aynı, saat içinde sabit, saat saat değişir', () => {
    for (const c of CURS) {
      expect(idx(c, T0)).toBe(idx(c, T0));
      expect(idx(c, Date.UTC(2026, 10, 16, 9, 0))).toBe(idx(c, Date.UTC(2026, 10, 16, 9, 59, 59)));
    }
    const hours = Array.from({ length: 24 }, (_, h) => idx('USD', Date.UTC(2026, 10, 16, h)));
    expect(new Set(hours).size).toBeGreaterThan(20);
  });
  it('taban kurlar gerçeğe yakın ve CFG / Remote Config ile güncellenebilir', () => {
    expect(tryPer('TRY')).toBe(1);
    expect(tryPer('USD')).toBe(CFG.FX_USD_TRY);
    expect(tryPer('EUR') / tryPer('USD')).toBeCloseTo(1.15, 5);
    expect(tryPer('GBP') / tryPer('USD')).toBeCloseTo(1.33, 5);
    expect(100 * tryPer('JPY') / tryPer('USD')).toBeCloseTo(0.66, 5);
    for (const k of ['FX_USD_TRY', 'FX_EUR_USD', 'FX_GBP_USD', 'FX_JPY100_USD', 'FX_DAY', 'FX_HOUR', 'BANK_SPREAD', 'BANK_FEE', 'BANK_FLOOR', 'BANK_RENT_MIN', 'BANK_SRC_SHARE', 'BANK_VALUE_X']) expect(k in CFG).toBe(true);
    expect(sane('FX_USD_TRY', 46)).toBe(true); CFG.FX_USD_TRY = 46;
    expect(rate('USD', 'TRY', T0) / 46).toBeGreaterThan(0.97); expect(rate('USD', 'TRY', T0) / 46).toBeLessThan(1.03);
  });
  it('sınırlı: 2 yıl boyunca her saat — çapraz kur tabandan ±%3, gün içi bileşen ±%1, saatlik adımlar yumuşak', () => {
    const A = amps(); let worst = 0, step = 0, intra = 0;
    for (let h = 0; h < 2 * 365 * 24; h++) {
      const tm = T0 + h * HOUR, prev = tm - HOUR;
      for (const [a, b] of PAIRS) {
        const base = tryPer(a) / tryPer(b), v = rate(a, b, tm) / base;
        worst = Math.max(worst, Math.abs(v - 1));
        step = Math.max(step, Math.abs(rate(a, b, tm) / rate(a, b, prev) - 1));
      }
    }
    // gün içi bileşen: sürüklenme sabit tutulup (FX_DAY = 0) yalnız saatlik oynama
    CFG.FX_DAY = 0;
    for (let h = 0; h < 60 * 24; h++) for (const [a, b] of PAIRS) intra = Math.max(intra, Math.abs(rate(a, b, T0 + h * HOUR) / (tryPer(a) / tryPer(b)) - 1));
    expect(A.a).toBeCloseTo(DEF.FX_DAY + DEF.FX_HOUR, 9);
    expect(worst).toBeLessThanOrEqual(0.03);
    expect(worst).toBeGreaterThan(0.015); // gerçekten dalgalanıyor
    expect(intra).toBeLessThanOrEqual(0.01);
    expect(intra).toBeGreaterThan(0.004);
    expect(step).toBeLessThan(0.01);      // saatten saate sert sıçrama yok
  });
  it('al-sat kârı imkânsız: en iyi/en kötü zamanlı gidiş-dönüş < 1 (ölçülen ve analitik), çok bacaklı tur da', () => {
    const c = costMult(), A = amps().a;
    expect((1 + A) / (1 - A) * c).toBeLessThan(1);          // her bacak, ne kadar iyi zamanlanırsa zamanlansın zarar
    let best = 0;
    const regs: RegionId[] = ['tr', 'us', 'uk', 'de', 'jp'];
    for (const x of regs) for (const y of regs) {
      if (x === y) continue;
      let hiG = 0, hiB = 0;                                  // gidiş ve dönüş için en iyi saat (bağımsız seçilir)
      for (let h = 0; h < 120 * 24; h++) { const tm = T0 + h * HOUR; hiG = Math.max(hiG, quote(x, y, tm).net); hiB = Math.max(hiB, quote(y, x, tm).net); }
      best = Math.max(best, hiG * hiB);
    }
    expect(best).toBeLessThan(1);
    expect(best).toBeGreaterThan(0.94);
    // aynı para (ABD ↔ Global): kur yok, yalnız komisyon
    expect(quote('us', 'gl', T0).net).toBeCloseTo(1 - CFG.BANK_FEE, 9);
    expect(quote('us', 'gl', T0).net * quote('gl', 'us', T0 + 5 * HOUR).net).toBeLessThan(1);
  });
  it('Remote Config sömürülebilir genlik verirse genlik güvenli sınıra iner', () => {
    CFG.FX_DAY = 0.098; CFG.FX_HOUR = 0.049; // sane() izin verir (10 kat)
    expect(sane('FX_DAY', 0.098)).toBe(true);
    const A = amps().a; expect((1 + A) / (1 - A) * costMult()).toBeLessThan(1);
    let hi = 0, lo = 9;
    for (let h = 0; h < 90 * 24; h++) { const v = quote('tr', 'us', T0 + h * HOUR).net / costMult(); hi = Math.max(hi, v); lo = Math.min(lo, v); }
    expect(hi / lo * costMult() ** 2).toBeLessThan(1);
    CFG.BANK_FEE = 0.0001; CFG.BANK_SPREAD = 0.0001; // makas/komisyon düşürülse de genlik onunla birlikte küçülür
    const B = amps().a; expect((1 + B) / (1 - B) * costMult()).toBeLessThan(1);
  });
  it('geçmiş ve haftalık ortalama: 24 saat (saatlik) ve 7 gün (4 saatlik), son nokta şimdiki kur', () => {
    const d = hist('USD', 'TRY', T0, 25, 1), w = hist('USD', 'TRY', T0, 43, 4);
    expect(d.length).toBe(25); expect(w.length).toBe(43);
    expect(d[24]).toBe(rate('USD', 'TRY', T0)); expect(w[42]).toBe(rate('USD', 'TRY', T0));
    expect(d[0]).toBe(rate('USD', 'TRY', T0 - 24 * HOUR));
    expect(Math.abs(vsWeek('USD', 'TRY', T0))).toBeLessThan(0.03);
    setLang('tr'); expect(fxPair('USD', 'TRY', 43.1234)).toBe('1 $ = ₺43,12');
    setLang('en'); expect(fxPair('TRY', 'USD', 1 / 43)).toBe('100 ₺ = $2.3256'); expect(fxPair('EUR', 'USD', 1.15)).toBe('1 € = $1.1500');
  });
});

describe('gösterim ölçeği', () => {
  it('₺ taban (ölçek 1): Türkiye’de görünen değerler değişmez', () => {
    setRegion('tr'); setLang('tr');
    expect(dispScale('tr')).toBe(1);
    expect(fmt(150)).toBe('₺150'); expect(fmt(1.5e6)).toBe('₺1,5Mn'); expect(fmt(0.52, true)).toBe('₺0,5'); expect(fmt(80e3)).toBe('₺80B');
  });
  it('$ € £ küçük ölçekli (kuruşlu), ¥ büyük ölçekli; tüm para gösterimleri fmt üzerinden', () => {
    setRegion('us'); setLang('en');
    expect(dispScale('us')).toBeCloseTo(1 / 43, 12); expect(dispScale('gl')).toBe(dispScale('us'));
    expect(fmt(4300)).toBe('$100'); expect(fmt(150)).toBe('$3.48'); expect(fmt(0.5, true)).toBe('$0.011'); expect(fmt(0)).toBe('$0');
    expect(fmt(6e6)).toBe('$139K'); expect(fmt(2e6)).toBe('$46.5K'); expect(fmt(1.5e8)).toBe('$3.4M');
    setRegion('de'); setLang('de'); expect(fmt(100)).toBe('€2,02'); expect(fmt(2e6)).toBe('€40,4Tsd');
    setRegion('uk'); setLang('en'); expect(fmt(5720)).toBe('£100');
    setRegion('jp'); setLang('ja'); expect(dispScale('jp')).toBeGreaterThan(3); expect(fmt(100)).toBe('¥352'); expect(fmt(1e6)).toBe('¥352万');
    expect(fmtIn(4300, 'us')).toBe('$100'); // başka bölgenin parasıyla (banka, bilanço)
  });
  it('girdi çevrimi: toDisp ↔ fromDisp; ihale açılışı ve adımı oyuncunun gördüğü birimde yuvarlak, kayıt iç birimde', () => {
    for (const r of REGION_ORDER) for (const x of [1, 150, 2580, 1e9]) expect(fromDisp(toDisp(x, r), r)).toBeCloseTo(x, 6);
    for (const [r, city, re] of [['us', 'nyc', /^\$\d+(\.00)?$/], ['de', 'muc', /^€\d+(,00)?$/], ['jp', 'tyo', /^¥\d+$/], ['tr', 'ist', /^₺\d+(,\d)?B?$/]] as [RegionId, string, RegExp][]) {
      setRegion(r); setLang(r === 'de' ? 'de' : r === 'jp' ? 'ja' : r === 'tr' ? 'tr' : 'en');
      setS(newState(T0, weekKey(new Date(T0)), city)); IH();
      const a = makeAuction('t-' + r, 'lm', 'x', city, T0, 900);
      const shown = toDisp(a.start), stp = toDisp(a.step);
      expect(Math.abs(shown - Math.round(shown))).toBeLessThan(1e-6);
      expect(Math.abs(stp - Math.round(stp))).toBeLessThan(1e-6);
      expect(fmt(a.step)).toMatch(re); expect(fmt(a.start + 3 * a.step)).toBe(fmt(fromDisp(shown + 3 * stp))); // adım adım artan teklif ekranda tam
      expect(Math.abs(a.cap / a.step - Math.round(a.cap / a.step))).toBeLessThan(1e-9);
    }
    // Türkiye'de ihale tutarları önceki gibi (nice ile aynı)
    setRegion('tr'); setS(newState(T0, weekKey(new Date(T0)), 'ist')); IH();
    expect(makeAuction('x', 'lm', 'x', 'ist', T0, 900).start).toBe(nice(900 * CFG.IH_LM_OPEN));
  });
});

describe('günlük hak ve aktarım', () => {
  it('hak: alan bölgenin 30 dk taban kirası, en az taban; başlanmamış bölge = taban (başlangıç sermayesi)', () => {
    expect(dailyCap(null)).toBe(CFG.BANK_FLOOR);
    expect(dailyCap({ bank: { rate: 1 } })).toBe(CFG.BANK_FLOOR);
    expect(dailyCap({ bank: { rate: 100 } })).toBe(30 * 60 * 100);
  });
  it('aktarım: kasadan düşer, alan kayda yazılır, hak ve kasanın yarısı aşılmaz; kazanç sayılmaz (lig, görev, holding)', async () => {
    const us = await seed('us', 'nyc', 1000);
    await seed('tr', 'ist', 1e12); play('tr');
    expect(bankOpen()).toBe(true);
    const e0 = S.earned, w0 = S.week.earned, sh0 = sharesPreview(), tasks0 = JSON.stringify(S.tasks);
    await loadAll(true);
    const cap = capLeft('us'); expect(cap.cap).toBeCloseTo(Math.max(CFG.BANK_FLOOR, 1800 * us.bank.rate), 6);
    const m = maxSend('us'); expect(m).toBeLessThanOrEqual(S.cash * 0.5);
    const c0 = S.cash, r = await transfer('us', m);
    expect(r.ok).toBe(true); if (!r.ok) return;
    expect(r.held).toBe(false);
    expect(S.cash).toBeCloseTo(c0 - Math.floor(m), 6);
    const u = read('us'); expect(u.cash).toBeCloseTo(1000 + r.got, 6); expect(u.earned).toBe(1e6); expect(u.week.earned).toBe(5e5);
    expect(r.got).toBeLessThanOrEqual(cap.left + 1e-6);
    expect(S.earned).toBe(e0); expect(S.week.earned).toBe(w0); expect(sharesPreview()).toBe(sh0); expect(JSON.stringify(S.tasks)).toBe(tasks0);
    expect(read('tr').earned).toBe(e0);
    // hak doldu
    expect(capLeft('us').left).toBeLessThan(2);
    expect((await transfer('us', 1000)).ok).toBe(false);
    // kasanın yarısından fazlası gönderilemez
    expect((await transfer('uk', S.cash * 0.6))).toEqual({ ok: false, why: 'cash' });
    // banka kapalı (ilk semt, az kazanç)
    S.own = [S.own[0]]; S.earned = 10; expect((await transfer('uk', 10)).ok).toBe(false);
  });
  it('emanet: başlanmamış bölgeye taban kadar; bölge açılınca başlangıç sermayesi (kazanç değil), bir kez', async () => {
    await seed('tr', 'ist', 5e6); play('tr');
    await loadAll(true);
    expect(capLeft('jp')).toEqual({ cap: CFG.BANK_FLOOR, used: 0, left: CFG.BANK_FLOOR });
    const r = await transfer('jp', maxSend('jp'));
    expect(r.ok && r.held).toBe(true); if (!r.ok) return;
    expect(r.got).toBeLessThanOrEqual(CFG.BANK_FLOOR); expect(r.got).toBeGreaterThan(CFG.BANK_FLOOR - 2);
    expect(S.bank.out.length).toBe(1); expect(S.bank.out[0].s).toBeUndefined();
    expect(capLeft('jp').left).toBeLessThan(2);                 // emanet hakkı kullanır
    expect((await transfer('jp', 1000)).ok).toBe(false);
    await flushSaves();
    // Japonya'ya geç, şehir seç: emanet kasaya
    play('jp', 'tyo'); S.city = 'tyo';
    const got = await claimIn();
    expect(got).toBe(r.got); expect(S.cash).toBe(150 + r.got); expect(S.earned).toBe(0); expect(S.week.earned).toBe(0);
    expect(await claimIn()).toBe(0);                              // ikinci kez gelmez
    const trs = read('tr'); expect(trs.bank.out[0].s).toBeGreaterThan(0); expect(trs.bank.out[0].ep).toBe(S.bank.ep);
    await flushSaves();
    // Türkiye'ye dön: onay görülür, havale silinir
    play('tr'); await bankBoot(); await flushSaves();
    expect(S.bank.out.length).toBe(0); expect(read('jp').cash).toBe(150 + r.got);
  });
  it('sıfırlanan bölgeye teslim edilmiş havale yeniden eklenmez (ep farklı)', async () => {
    await seed('us', 'nyc', 1000); await seed('tr', 'ist', 5e6); play('tr');
    const r = await transfer('us', 20000); expect(r.ok).toBe(true); await flushSaves();
    const fresh = newState(T0, weekKey(new Date(T0)), 'nyc'); setRegion('us'); await writeRegionSave('us', fresh); setRegion('tr'); // ABD'de yeni oyun
    await deliverOut(); await flushSaves();
    expect(read('us').cash).toBe(150); expect(S.bank.out.length).toBe(0);
  });
});

describe('kayıt güvenliği', () => {
  it('çok sekme: alan bölge eski durumla üstüne yazarsa havale bir kez yeniden eklenir; storage olayı canlı sekmeye bir kez ekler', async () => {
    await seed('us', 'nyc', 1000); await seed('tr', 'ist', 5e6);
    const stale = read('us');
    play('tr'); const r = await transfer('us', 20000); expect(r.ok).toBe(true); if (!r.ok) return;
    await flushSaves();
    const fresh = read('us'); expect(fresh.cash).toBe(1000 + r.got);
    setRegion('us'); await writeRegionSave('us', stale); setRegion('tr'); // başka sekmedeki eski ABD durumu üstüne yazdı
    await deliverOut(); await flushSaves(); expect(read('us').cash).toBe(1000 + r.got);
    await deliverOut(); await flushSaves(); expect(read('us').cash).toBe(1000 + r.got); expect(S.bank.out.length).toBe(0);
    // ABD sekmesi açıkken (eski durum) havale yazıldı: storage olayındaki yeni değer canlı duruma bir kez eklenir
    setRegion('us'); setS(migrate(stale, Time.now(), weekKey(new Date(Time.now())))!);
    expect(mergeForeign(fresh)).toBe(r.got); expect(S.cash).toBe(1000 + r.got);
    expect(mergeForeign(fresh)).toBe(0); expect(S.cash).toBe(1000 + r.got);
    const other = { ...fresh, bank: { ...fresh.bank, ep: 'baska' } }; S.bank.in = [];
    expect(mergeForeign(other)).toBe(0); // başka oyunun (sıfırlanmış) kaydı
  });
  it('bulut paketi: aktarımın her yazma adımındaki anlık görüntü yüklenip açılınca para çoğalmaz, kaybolmaz', async () => {
    await seed('us', 'nyc', 1000); await seed('tr', 'ist', 5e6);
    const m0 = money();
    play('tr'); ls.snaps = [];
    const r = await transfer('us', 50000); expect(r.ok).toBe(true); if (!r.ok) return;
    await flushSaves();
    const snaps = ls.snaps.slice(), after = m0 - 50000 + r.got;
    expect(snaps.length).toBeGreaterThan(1);
    for (const snap of [new Map(snaps[0]), ...snaps]) {
      ls.m = new Map(snap);                                    // paket: tüm bölgelerin o anki kayıtları
      for (let k = 0; k < 2; k++) for (const g of ['us', 'tr'] as RegionId[]) { play(g); await bankBoot(); await flushSaves(); }
      const m = money();
      expect(m).toBeLessThanOrEqual(m0 + 1e-6);              // çoğalmaz
      expect([m0, after].some(x => Math.abs(m - x) < 1e-6)).toBe(true); // ya hiç olmamış ya tamamlanmış
      expect(read('us').earned).toBe(1e6); expect(read('tr').earned).toBe(1e6); // bulut karşılaştırması (earned) değişmez
    }
  });
  it('kayıt temizliği: eski kayıt (bank yok) ve bozuk alanlar', () => {
    const base: any = newState(T0, weekKey(new Date(T0)), 'ist'); delete base.bank;
    const s = migrate(base, T0, weekKey(new Date(T0)))!;
    expect(s.bank.out).toEqual([]); expect(typeof s.bank.ep).toBe('string'); expect(s.bank.ep.length).toBeGreaterThan(4);
    const bad: any = newState(T0, weekKey(new Date(T0)), 'ist');
    bad.bank = { rate: -5, ep: 7, in: ['tr-a', 3, 'us-b'], out: [{ id: 'tr-x', to: 'us', a: 100, at: 1 }, { id: 'y', to: 'mars', a: 5 }, { id: 'z', to: 'us', a: -1 }, { id: 'w', to: 'jp', a: Infinity }, null],
      day: { k: 5 }, log: [{ dir: 'in', r: 'us', a: 'x' }, { dir: 'x', r: 'us' }], tip: 3 };
    const c = migrate(bad, T0, weekKey(new Date(T0)))!;
    expect(c.bank.rate).toBe(0); expect(c.bank.in).toEqual(['tr-a', 'us-b']); expect(c.bank.out).toEqual([{ id: 'tr-x', to: 'us', a: 100, at: 1 }]);
    expect(c.bank.day).toEqual({ k: '', got: 0 }); expect(c.bank.log.length).toBe(1); expect(c.bank.tip).toBe('');
    expect(trimIn([...Array.from({ length: 30 }, (_, i) => 'us-' + i), 'tr-1'])).toHaveLength(BANK_KEEP_IN + 1);
    expect(newBank().ep).not.toBe(newBank().ep);
  });
  it('bilanço: başlanmamış bölge yok; mülk = tapu + yapım maliyetinin %80’i, proje ve ihale yapıları değerli; borç düşülür', () => {
    expect(valueOf(null)).toBe(null); expect(valueOf({ city: null, own: [] })).toBe(null);
    setRegion('tr'); const s: any = newState(T0, weekKey(new Date(T0)), 'ist');
    s.d['ist-0'] = Array.from({ length: 20 }, () => P('ev', 5)); s.own = ['ist-0']; s.cash = 1000; s.bank.rate = 100;
    const v0 = valueOf(s)!;
    expect(v0.cash).toBe(1000); expect(v0.prop).toBeGreaterThan(0);
    let raw = 0; for (let j = 0; j < 20; j++) raw += 100 * Math.pow(1.12, j) + 100 * (2 + 5 + 12 + 30); // yapım (aynı türün her yenisi %12 pahalı) + katlar
    expect(v0.prop).toBeCloseTo(raw * 0.8, 6);
    s.pj = { 'ist-0': [{ a: 0, kd: 'site', st: 1, until: 0, dur: 1 }] }; const v1 = valueOf(s)!;
    expect(v1.prop - v0.prop).toBeCloseTo(4 * 100 * 30 * 0.8, 6);
    s.ihale = { got: ['a'], kose: ['ist-0:3'], cur: { held: 500 } }; const v2 = valueOf(s)!;
    expect(v2.prop).toBeGreaterThan(v1.prop); expect(v2.cash).toBe(1500);
    s.lien = { 'ist-0': 300 }; expect(valueOf(s)!.net).toBeCloseTo(v2.net - 300, 6);
  });
  it('Rıfkı kur notu: yalnız başlanmış başka bölge için, ucuzsa', async () => {
    await seed('tr', 'ist', 5e6); play('tr');
    expect(cheapCur(true)).toBe(null); // başka bölge başlanmadı
    let found = 0;
    for (let h = 0; h < 14 * 24; h++) { const c = cheapCur(false, T0 + h * HOUR); if (c) { found++; expect(c.v).toBeLessThanOrEqual(-CFG.BANK_TIP_PCT); } }
    expect(found).toBeGreaterThan(0);
  });
});
