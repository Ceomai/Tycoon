// İnceleme bulguları 3–6 (banka): kayıt kilidi ve banka kuyruğu (bankIdle), gönderen kaydı yazılamazsa aktarımın geri
// alınması, yoldaki havale sınırı (birleştirme / ret, kırpma para kaybettirmez), bulut paketinde olmayan bölgelerle uzlaştırma.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
// @ts-ignore: düğüm türleri bu projede yüklü değil; yalnızca vitest (Node) altında çalışır
import fs from 'node:fs';
vi.mock('../../src/ui/modal', () => ({
  openModal: vi.fn(), closeModal: vi.fn(), bump: vi.fn(), toast: vi.fn(), flushQueue: vi.fn(), flyTo: vi.fn(async () => {}), flyCoin: vi.fn(async () => {}),
  countUp: vi.fn(), showGain: vi.fn(), bigStamp: vi.fn(), cashText: vi.fn(),
}));
vi.mock('../../src/sound', () => ({ Snd: new Proxy({}, { get: () => () => {} }), buzz: Object.assign(vi.fn(), { light: vi.fn(), medium: vi.fn(), success: vi.fn(), error: vi.fn(), select: vi.fn() }) }));

import { newState, setS, S, migrate, Plot } from '../../src/state';
import { CFG, setRegion, REGION_ORDER, BuildingType, RegionId } from '../../src/config';
import { weekKey } from '../../src/format';
import { setLang } from '../../src/i18n';
import { Time } from '../../src/time';
import { totalRate } from '../../src/economy';
import { flushSaves, unlockSaves, lockSaves, writeRegionSave, saveKeyOf, wipeAllSaves } from '../../src/storage';
import { transfer, deliverOut, claimIn, bankBoot, REG, BANK_OUT_MAX } from '../../src/game/bank';
import { adoptBundle } from '../../src/services/cloud';

const DEF = { ...CFG };
const T0 = Date.UTC(2026, 10, 16, 9, 30);
class MemStore {
  m = new Map<string, string>(); fail = new Set<string>();
  getItem(k: string) { return this.m.has(k) ? this.m.get(k)! : null; }
  setItem(k: string, v: string) { if (this.fail.has(k)) throw new Error('QuotaExceededError'); this.m.set(k, String(v)); }
  removeItem(k: string) { this.m.delete(k); }
  clear() { this.m.clear(); }
  key(i: number) { return [...this.m.keys()][i] ?? null; }
  get length() { return this.m.size; }
}
let ls: MemStore;
const WK = () => weekKey(new Date(Time.now()));
const read = (r: RegionId) => { const raw = ls.getItem(saveKeyOf(r)); if (!raw) return null; const o = JSON.parse(raw); return JSON.parse(o.j); };
const P = (t: BuildingType, lvl = 3): Plot => ({ t, lvl, buf: 0, until: 0, dur: 1, up: false });
function play(r: RegionId) {
  setRegion(r);
  const raw = read(r); setS((raw && migrate(raw, Time.now(), WK())) || newState(Time.now(), WK()));
  REG.at = 0; REG.saves = {};
  return S;
}
async function seed(r: RegionId, city: string, cash: number) {
  setRegion(r);
  const s = newState(Time.now(), WK(), city), k0 = `${city}-0`, k1 = `${city}-1`;
  s.d[k0] = Array.from({ length: 20 }, (_, i) => P((['ev', 'kafe', 'dukkan', 'ofis'] as BuildingType[])[i % 4], 3)); s.d[k1] = Array(20).fill(null);
  s.own = [k0, k1]; s.cash = cash; s.earned = 1e6; s.savedAt = Time.now();
  setS(s); s.bank.rate = totalRate(false);
  await writeRegionSave(r, s);
  return s;
}
/** Tüm bölgelerdeki para: kasalar + yoldaki (teslim edilmemiş) havaleler. */
const money = () => REGION_ORDER.reduce((a, r) => { const v = read(r); return a + (v && v.city ? +v.cash : 0) + (v && v.bank ? v.bank.out.filter((o: any) => !o.s).reduce((x: number, o: any) => x + o.a, 0) : 0); }, 0);
const tick = (ms = 1000) => { Time.offset += ms; };

beforeEach(async () => {
  ls = new MemStore(); (globalThis as any).localStorage = ls;
  Object.assign(CFG, DEF); Time.offset = T0 - Date.now(); setLang('tr');
  await flushSaves(); unlockSaves(); setRegion('tr');
});
afterEach(async () => { await flushSaves(); unlockSaves(); Object.assign(CFG, DEF); Time.offset = 0; setRegion('tr'); });

/* ---------- 3) kayıt kilidi ve banka kuyruğu ---------- */
describe('kayıt kilidi ve banka kuyruğu', () => {
  it('kilitliyken writeRegionSave yazmaz (false döner)', async () => {
    await seed('us', 'nyc', 1000);
    lockSaves();
    const v = read('us'); v.cash = 999999;
    expect(await writeRegionSave('us', v)).toBe(false);
    expect(read('us').cash).toBe(1000);
    unlockSaves();
    expect(await writeRegionSave('us', v)).toBe(true);
  });
  it('kilitliyken claimIn emaneti gönderende "teslim edildi" diye işaretlemez (para kaybolmaz)', async () => {
    await seed('tr', 'ist', 5e7); play('tr');
    const r = await transfer('jp', 2000); expect(r.ok && r.held).toBe(true); await flushSaves();
    await seed('jp', 'tyo', 150); play('jp');
    lockSaves();                                            // ör. bölge değişiyor / bulut kaydı yükleniyor
    await claimIn(); await flushSaves();
    expect(read('tr').bank.out[0].s).toBeUndefined();      // gönderen teslim edilmedi bilir
    expect(read('jp').cash).toBe(150);
    unlockSaves(); play('jp'); const got = await claimIn(); await flushSaves();
    expect(got).toBe(r.ok ? r.got : -1); expect(read('jp').cash).toBe(150 + got);
    expect(read('tr').bank.out[0].s).toBeGreaterThan(0);
  });
  it('banka işi sürerken wipeAllSaves: iş bitince kayıt yeniden oluşmaz', async () => {
    await seed('us', 'nyc', 1000); await seed('tr', 'ist', 5e7); play('tr');
    S.cash -= 20000; S.bank.out.push({ id: 'tr-x-1', to: 'us', a: 19000, at: Time.now() });
    await writeRegionSave('tr', S);
    // teslimin her ara adımında silme denenir (mikro görev sırası): hiçbirinde silinen kayıt geri gelmez
    for (let n = 0; n < 40; n++) {
      await seed('us', 'nyc', 1000); await seed('tr', 'ist', 5e7); play('tr');
      S.cash -= 20000; S.bank.out.push({ id: 'tr-x-' + n, to: 'us', a: 19000, at: Time.now() }); await writeRegionSave('tr', S);
      const boot = bankBoot();                              // açılış teslimi (await yok)
      for (let k = 0; k < n; k++) await Promise.resolve();
      await wipeAllSaves(); await boot; await flushSaves();
      expect(REGION_ORDER.map(r => ls.getItem(saveKeyOf(r))), 'adım ' + n).toEqual(REGION_ORDER.map(() => null));
      unlockSaves();
    }
  });
  it('banka işi sürerken bulut paketi yüklenir: teslim yüklenen kaydı ezmez', async () => {
    await seed('us', 'nyc', 1000); await seed('tr', 'ist', 5e7); play('tr');
    const bundle = { b: 1, saves: { tr: read('tr'), us: { ...read('us'), cash: 777 } } };
    S.cash -= 20000; S.bank.out.push({ id: 'tr-x-2', to: 'us', a: 19000, at: Time.now() });
    await writeRegionSave('tr', S);
    const boot = bankBoot();
    expect(await adoptBundle(JSON.stringify(bundle))).toBe(true); await boot; await flushSaves();
    expect(read('us').cash).toBe(777); expect(read('tr').bank.out).toEqual([]);
  });
  it('aynı anda iki teslim ve açılış teslimi sürerken aktarım: para çoğalmaz, kaybolmaz', async () => {
    await seed('us', 'nyc', 1000); await seed('uk', 'lon', 1000); await seed('tr', 'ist', 5e7); play('tr');
    S.cash -= 40000; S.bank.out.push({ id: 'tr-a-1', to: 'uk', a: 19000, at: Time.now() }, { id: 'tr-b-1', to: 'us', a: 19000, at: Time.now() });
    await writeRegionSave('tr', S);
    const m0 = money();
    const boot = bankBoot();
    const r = await transfer('us', 20000);
    await Promise.all([boot, deliverOut(), deliverOut()]); await flushSaves();
    await bankBoot(); await flushSaves();
    expect(money()).toBeCloseTo(m0 - 20000 + (r.ok ? r.got : 20000), 3);
    expect(S.bank.out).toEqual([]);
  });
});

/* ---------- 4) gönderen kaydı yazılamazsa ---------- */
describe('aktarım: gönderen kaydı yazılamazsa', () => {
  it('teslim yapılmaz, para geri, sonuç "save"', async () => {
    await seed('us', 'nyc', 1000); await seed('tr', 'ist', 5e7); play('tr');
    const m0 = money(), cash0 = S.cash, log0 = S.bank.log.length;
    ls.fail.add(saveKeyOf('tr'));                           // depolama dolu
    const r = await transfer('us', 20000);
    expect(r).toEqual({ ok: false, why: 'save' });
    expect(S.cash).toBe(cash0); expect(S.bank.out).toEqual([]); expect(S.bank.log.length).toBe(log0);
    expect(read('us').cash).toBe(1000);
    ls.fail.clear(); await flushSaves();
    expect(money()).toBe(m0);
  });
});

/* ---------- 5) yoldaki havale sınırı ---------- */
describe('yoldaki havaleler', () => {
  it('başlanmamış bölgeye giden emanetler tek kayıtta birleşir', async () => {
    await seed('tr', 'ist', 5e8); play('tr');
    let sum = 0;
    for (let k = 0; k < 3; k++) { tick(); const r = await transfer('jp', 800); expect(r.ok).toBe(true); if (r.ok) sum += r.got; }
    await flushSaves();
    expect(S.bank.out).toHaveLength(1); expect(S.bank.out[0].a).toBe(sum);
    await seed('jp', 'tyo', 150); play('jp'); expect(await claimIn()).toBe(sum);
  });
  it('birleşemeyen havaleler sınıra gelince aktarım reddedilir (para kesilmez)', async () => {
    await seed('us', 'nyc', 1000); await seed('tr', 'ist', 5e8); play('tr');
    for (let k = 0; k < BANK_OUT_MAX; k++) S.bank.out.push({ id: 'tr-q-' + k, to: 'us', a: 10, at: Time.now() });
    S.cash -= 10 * BANK_OUT_MAX; await writeRegionSave('tr', S);
    ls.fail.add(saveKeyOf('us'));                           // alan yazılamıyor: havaleler yolda kalır
    const cash0 = S.cash;
    const r = await transfer('us', 20000);
    expect(r).toEqual({ ok: false, why: 'busy' }); expect(S.cash).toBe(cash0); expect(S.bank.out).toHaveLength(BANK_OUT_MAX);
  });
  it('kayıt temizliği yoldaki (teslim edilmemiş) havaleyi hiç kırpmaz', () => {
    setRegion('tr'); const s: any = newState(T0, weekKey(new Date(T0)), 'ist');
    s.bank.out = [...Array.from({ length: 70 }, (_, i) => ({ id: 'tr-s-' + i, to: 'us', a: 5, at: 1, s: 2, ep: 'e' })), ...Array.from({ length: 5 }, (_, i) => ({ id: 'tr-u-' + i, to: 'jp', a: 7, at: 1 }))];
    const c = migrate(s, T0, weekKey(new Date(T0)))!;
    expect(c.bank.out.filter(o => !o.s)).toHaveLength(5);
    expect(c.bank.out.length).toBeLessThanOrEqual(BANK_OUT_MAX);
  });
});

/* ---------- 6) bulut paketinde olmayan bölgeler ---------- */
describe('bulut paketi: pakette olmayan bölgeler', () => {
  it('paketteki gönderen eski (havale öncesi): pakette olmayan alıcı aldığını geri verir (para çoğalmaz)', async () => {
    await seed('us', 'nyc', 1000); await seed('tr', 'ist', 5e7);
    const m0 = money();
    const snapTr = read('tr');                              // bulut paketi: yalnız Türkiye (ABD o an başlanmamış sayılır)
    tick(); play('tr'); const r = await transfer('us', 20000); expect(r.ok).toBe(true); await flushSaves();
    await deliverOut(); await flushSaves();                 // onay: gönderen havaleyi siler
    expect(await adoptBundle(JSON.stringify({ b: 1, saves: { tr: snapTr } }))).toBe(true);
    unlockSaves();
    for (const g of ['tr', 'us', 'tr'] as RegionId[]) { play(g); await bankBoot(); await flushSaves(); }
    expect(money()).toBeCloseTo(m0, 3);
  });
  it('paketteki alıcı eski (havale öncesi): pakette olmayan gönderenin havalesi yeniden teslim edilir (para kaybolmaz)', async () => {
    await seed('us', 'nyc', 5e7); await seed('tr', 'ist', 1000);
    const snapTr = read('tr');
    tick(); play('us'); const r = await transfer('tr', 20000); expect(r.ok).toBe(true); if (!r.ok) return; await flushSaves();
    await deliverOut(); await flushSaves(); expect(read('us').bank.out).toEqual([]);
    const m1 = money();                                     // havale tamamlandı
    expect(await adoptBundle(JSON.stringify({ b: 1, saves: { tr: snapTr } }))).toBe(true);
    unlockSaves();
    for (const g of ['tr', 'us', 'tr'] as RegionId[]) { play(g); await bankBoot(); await flushSaves(); }
    expect(read('tr').cash).toBe(1000 + r.got);
    expect(money()).toBeCloseTo(m1, 3);
  });
  it('pakette olmayan bölgeye giden emanet (paket) yerelde alınmışsa yeniden teslim edilmez', async () => {
    await seed('tr', 'ist', 5e7); play('tr');
    const r = await transfer('us', 2000); expect(r.ok && r.held).toBe(true); await flushSaves();
    const snapTr = read('tr');                              // paket: emanet yolda
    await seed('us', 'nyc', 150); play('us'); await claimIn(); await flushSaves(); // yerelde ABD başladı, emaneti aldı
    const m1 = money();
    expect(await adoptBundle(JSON.stringify({ b: 1, saves: { tr: snapTr } }))).toBe(true);
    unlockSaves();
    for (const g of ['tr', 'us', 'tr'] as RegionId[]) { play(g); await bankBoot(); await flushSaves(); }
    expect(money()).toBeCloseTo(m1, 3);
  });
});

/* ---------- uzun oyun (soak) bulguları: H3, H4, bilanço emaneti ---------- */
import { carryOut } from '../../src/game/bank';
import { banka } from '../../src/ui/sheets/bank';
import { loadAll } from '../../src/game/bank';
describe('soak bulguları (banka)', () => {
  it('H4: emanet beklerken başlanmış bölgeye aktarım "emanete alındı" sayılmaz', async () => {
    await seed('us', 'nyc', 1000); await seed('tr', 'ist', 5e7); play('tr');
    const a = await transfer('de', 2000); expect(a.ok && a.held).toBe(true);
    const r = await transfer('us', 20000); expect(r.ok).toBe(true); expect(r.ok && r.held).toBe(false);
  });
  it('H3: yeni oyunda (bölge sıfırlanınca) yoldaki emanet kaybolmaz: yeni kayda taşınır', async () => {
    await seed('tr', 'ist', 5e7); play('tr');
    const r = await transfer('uk', 2000); expect(r.ok && r.held).toBe(true); await flushSaves();
    S.bank.out.push({ id: 'tr-old-1', to: 'us', a: 5, at: 1, s: 2, ep: 'x' }); // teslim edilmiş (onay bekleyen): taşınmaz
    const carried = carryOut(read('tr'));
    expect(carried.map(o => o.to)).toEqual(['uk']);
    expect(carried[0].a).toBe(r.ok ? r.got : -1);
    expect(carryOut(null)).toEqual([]); expect(carryOut({ bank: { out: [{ id: 3 }, null, { id: 'tr-a', to: 'mars', a: 1 }] } })).toEqual([]);
    const src = fs.readFileSync('src/game/loop.ts', 'utf8');
    expect(src).toMatch(/carryOut\(/);                  // firstRun eski kaydın emanetini yeni duruma taşır
  });
  it('bilanço başlanmamış bölgeye bekleyen emaneti o bölgenin satırında ve toplamda gösterir', async () => {
    await seed('tr', 'ist', 5e7); play('tr');
    const r = await transfer('jp', 2000); expect(r.ok && r.held).toBe(true); await flushSaves();
    await loadAll(true);
    const html = banka.render({ k: 'banka', tab: 'bil' } as any, Time.now(), {} as any) as string;
    expect(html).toMatch(/emanette/);
    expect(html).toMatch(/Emanette \(başlanmamış bölgeler\)/);
  });
});
