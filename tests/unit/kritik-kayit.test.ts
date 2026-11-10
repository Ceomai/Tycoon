// Kritik mantık (Adım 5, karakterizasyon): bölge kayıtları (anahtar seçimi, bölge değişimi, yedek, eski anahtar),
// bulut paketi (tüm bölgeler tek belgede: oluşturma ve okuma) ve kayıt temizliği (sanitize) kenar durumları.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const h = vi.hoisted(() => ({
  handler: null as null | ((a: string) => void),
  pushed: [] as { json: string; savedAt: number; earned: number }[],
  remote: null as null | { json: string; savedAt: number; earned: number },
}));
vi.mock('../../src/ui/modal', () => ({
  openModal: (_h: string, f: (a: string) => void) => { h.handler = f; },
  closeModal: vi.fn(), toast: vi.fn(), bump: vi.fn(), flushQueue: vi.fn(),
}));
vi.mock('../../src/sound', () => ({ Snd: new Proxy({}, { get: () => () => {} }), buzz: Object.assign(vi.fn(), { light: vi.fn(), medium: vi.fn(), success: vi.fn(), error: vi.fn(), select: vi.fn() }) }));
vi.mock('../../src/services/artifactCloud', () => ({
  createArtifactBackend: () => ({
    uid: 'u1',
    init: async () => true,
    hello: async () => ({}),
    account: () => ({ enabled: true, linked: false, provider: '', apple: false }),
    link: async () => 'fail',
    deleteAccount: async () => true,
    pushSave: async (json: string, savedAt: number, earned: number) => { h.pushed.push({ json, savedAt, earned }); },
    pullSave: async () => h.remote,
    postScore: async () => {},
    league: async () => null,
    redeemInvite: async () => 'ok',
  }),
}));

import { newState, setS, S, migrate } from '../../src/state';
import { weekKey } from '../../src/format';
import { setRegion, SAVE_KEY, LEGACY_SAVE_KEY, CITY_ORDER } from '../../src/config';
import {
  saveKeyOf, writeSave, flushSaves, unlockSaves, loadRaw, readRegionSave, writeRegionSave, loadRegionInfo, REGION_INFO, checksum,
} from '../../src/storage';
import { Cloud } from '../../src/services/cloud';

class MemStore {
  m = new Map<string, string>(); gets: string[] = [];
  getItem(k: string) { this.gets.push(k); return this.m.has(k) ? this.m.get(k)! : null; }
  setItem(k: string, v: string) { this.m.set(k, String(v)); }
  removeItem(k: string) { this.m.delete(k); }
  clear() { this.m.clear(); }
  key(i: number) { return [...this.m.keys()][i] ?? null; }
  get length() { return this.m.size; }
}
const T = Date.UTC(2026, 10, 9, 12), WK = weekKey(new Date(T));
let ls: MemStore;
const read = (k: string) => { const raw = ls.getItem(k); if (!raw) return null; const o = JSON.parse(raw); return o.j ? JSON.parse(o.j) : o; };
const wrapped = (o: object) => { const j = JSON.stringify(o); return JSON.stringify({ c: checksum(j), j }); };

beforeEach(async () => {
  ls = new MemStore(); (globalThis as any).localStorage = ls;
  await flushSaves(); unlockSaves(); setRegion('tr');
});
afterEach(async () => { await flushSaves(); unlockSaves(); setRegion('tr'); });

describe('bölge kayıtları', () => {
  it('anahtar: Türkiye eski anahtar, diğerleri bölge son ekli', () => {
    expect(saveKeyOf('tr')).toBe(SAVE_KEY);
    expect(saveKeyOf('de')).toBe(SAVE_KEY + '-de'); expect(saveKeyOf('gl')).toBe(SAVE_KEY + '-gl');
  });
  it('etkin bölgenin anahtarına yazılır ve oradan okunur; bölge değişince diğer bölgenin kaydı açılır', async () => {
    await writeSave({ city: 'ist', n: 1 });
    setRegion('de'); expect(await loadRaw()).toBeNull();
    await writeSave({ city: 'ber', n: 2 });
    expect(read(SAVE_KEY + '-de')).toEqual({ city: 'ber', n: 2 }); expect(read(SAVE_KEY)).toEqual({ city: 'ist', n: 1 });
    setRegion('tr'); expect(await loadRaw()).toEqual({ city: 'ist', n: 1 });
  });
  it('yedek: her yazmada bir önceki sağlam kayıt :backup anahtarına; bozuk ana kayıtta yedek açılır', async () => {
    await writeSave({ city: 'ist', n: 1 }); await writeSave({ city: 'ist', n: 2 });
    expect(read(SAVE_KEY + ':backup')).toEqual({ city: 'ist', n: 1 });
    ls.setItem(SAVE_KEY, '{"c":"bozuk","j":"{}"}');
    expect(await loadRaw()).toEqual({ city: 'ist', n: 1 });
  });
  it('eski (v1) kayıt yalnızca Türkiye’de açılır', async () => {
    ls.setItem(LEGACY_SAVE_KEY, JSON.stringify({ v: 1, d: [] }));
    expect(await loadRaw()).toEqual({ v: 1, d: [] }); expect(await readRegionSave('tr')).toEqual({ v: 1, d: [] });
    setRegion('us'); expect(await loadRaw()).toBeNull(); expect(await readRegionSave('us')).toBeNull();
  });
  it('bölge özeti: şehri ve semtleri olan kayıtlar sayılır', async () => {
    ls.setItem(saveKeyOf('jp'), wrapped({ city: 'tok', own: ['tok-0', 'tok-1'] }));
    ls.setItem(saveKeyOf('uk'), wrapped({ city: null, own: [] }));
    await loadRegionInfo();
    expect(REGION_INFO.jp).toEqual({ own: 2 }); expect(REGION_INFO.uk).toBeUndefined();
  });
});

describe('bulut paketi', () => {
  beforeEach(() => {
    (globalThis as any).window = { claude: { use: true } };
    (globalThis as any).location = { reload: vi.fn() };
    h.pushed = []; h.remote = null; h.handler = null;
    setS(newState(T, WK, 'ist' as any)); S.earned = 2000; S.savedAt = T;
  });
  afterEach(() => { delete (globalThis as any).window; delete (globalThis as any).location; });

  it('oluşturma: etkin bölge canlı durumdan, diğerleri kayıttan; şehri olmayan kayıt girmez; kazanç toplanır', async () => {
    await writeRegionSave('de', { city: 'ber', earned: 500.7, own: ['ber-0'] });
    await writeRegionSave('us', { city: null, earned: 9e9, own: [] });
    await Cloud.init();
    await vi.waitFor(() => expect(h.pushed).toHaveLength(1));
    const p = h.pushed[0], b = JSON.parse(p.json);
    expect(b.b).toBe(1); expect(Object.keys(b.saves).sort()).toEqual(['de', 'tr']);
    expect(b.saves.tr.city).toBe('ist'); expect(b.saves.de).toEqual({ city: 'ber', earned: 500.7, own: ['ber-0'] });
    expect(p.earned).toBe(2500); expect(p.savedAt).toBe(T);
    await Cloud.pushSave(); expect(h.pushed).toHaveLength(1); // değişmemiş kayıt yeniden yazılmaz
    S.savedAt = T + 1; S.cash = 777; await Cloud.pushSave();
    expect(h.pushed).toHaveLength(2); expect(JSON.parse(h.pushed[1].json).saves.tr.cash).toBe(777);
  });
  it('önbellek: diğer bölgelerin kayıtları her gönderimde diskten yeniden okunmaz; bölge kaydı yazılınca yenisi girer', async () => {
    await writeRegionSave('de', { city: 'ber', earned: 1, own: ['ber-0'] });
    await Cloud.pushSave(); // ilk paket: önbellek dolar (gerekirse okur)
    const reads = () => ls.gets.filter(k => k === saveKeyOf('de')).length, n0 = reads();
    for (let j = 1; j <= 3; j++) { S.savedAt = T + 10 + j; await Cloud.pushSave(); }
    expect(reads()).toBe(n0);
    await writeRegionSave('de', { city: 'ber', earned: 7, own: ['ber-0'] });
    S.savedAt = T + 99; await Cloud.pushSave();
    expect(JSON.parse(h.pushed[h.pushed.length - 1].json).saves.de.earned).toBe(7);
  });
  it('okuma: ilerideki bulut kaydı onayla yüklenir; her bölge kendi anahtarına yazılır, sayfa yenilenir', async () => {
    const tr = { ...newState(T, WK, 'ist' as any), earned: 9e6 }, jp = { city: 'tok', own: ['tok-0'], earned: 1 };
    h.remote = { json: JSON.stringify({ b: 1, saves: { tr, jp } }), savedAt: T + 3600e3, earned: 9e6 + 1 };
    await Cloud.reconcile(true);
    expect(h.handler).not.toBeNull(); h.handler!('cloud');
    await vi.waitFor(() => expect((globalThis as any).location.reload).toHaveBeenCalled());
    expect(read(SAVE_KEY).earned).toBe(9e6); expect(read(saveKeyOf('jp'))).toEqual(jp);
  });
  it('okuma: eski tek kayıt biçimi Türkiye kaydıdır', async () => {
    const old = { ...newState(T, WK, 'ist' as any), earned: 5e6 };
    h.remote = { json: JSON.stringify(old), savedAt: T + 3600e3, earned: 5e6 };
    await Cloud.reconcile(true); h.handler!('cloud');
    await vi.waitFor(() => expect((globalThis as any).location.reload).toHaveBeenCalled());
    expect(read(SAVE_KEY).earned).toBe(5e6);
  });
  it('okuma: bulut geride ise sorulmaz, yereldeki gönderilir', async () => {
    h.remote = { json: '{"b":1,"saves":{}}', savedAt: T - 3600e3, earned: 10 };
    await Cloud.reconcile(true); expect(h.handler).toBeNull();
  });
});

describe('kayıt temizliği (sanitize) kenar durumları', () => {
  const base = () => ({ ...newState(T, WK, 'ist' as any) }) as any;
  it('aralık sınırları: indirim ≤ %90, jeton/hisse tam sayı ve negatif değil', () => {
    const s = migrate({ ...base(), disc: 5, tokens: -3.7, shares: 2.9 }, T, WK)!;
    expect(s.disc).toBe(0.9); expect(s.tokens).toBe(0); expect(s.shares).toBe(2);
  });
  it('bilinmeyen alanlar atılır; toplama kipi ve davet kodu varsayılana döner', () => {
    const s: any = migrate({ ...base(), foo: 1, collectMode: 'x', ref: { code: '', used: false, rewarded: 0 } }, T, WK)!;
    expect('foo' in s).toBe(false); expect(s.collectMode).toBe('tap'); expect(s.ref.code).toMatch(/^TP[A-Z0-9]{4}$/);
  });
  it('eski kayıttaki kullanılmayan bayram alanı (fest) yok sayılır', () => {
    const s: any = migrate({ ...base(), fest: '2026-04-10' }, T, WK)!; expect('fest' in s).toBe(false);
  });
  it('etkin bölge dışındaki semtler ve sahiplik dışı ekran semti ayıklanır', () => {
    setRegion('de');
    const s = migrate({ ...base(), city: CITY_ORDER[0], own: ['ist-0', CITY_ORDER[0] + '-0'], cur: 'ist-0' }, T, WK)!;
    expect(s.own).toEqual([CITY_ORDER[0] + '-0']); expect(s.cur).toBe(CITY_ORDER[0] + '-0');
  });
  it('borç: sıfır/negatif/sayı olmayan atılır; sezon listeleri yalnız sayı', () => {
    const s = migrate({ ...base(), lien: { 'ist-1': 0, 'ist-2': -5, 'ist-3': 'x', 'ist-4': 50 }, season: { id: 'a', xp: 3, got: [1, '2', null], ggot: 'x', gold: true } }, T, WK)!;
    expect(s.lien).toEqual({ 'ist-4': 50 }); expect(s.season.got).toEqual([1]); expect(s.season.ggot).toEqual([]); expect(s.season.gold).toBe(true);
  });
  it('görevler: liste yoksa null; fırsat hedefi 0 ise atılır', () => {
    const s = migrate({ ...base(), tasks: { day: 'd' }, offer: { k: 'build', goal: 0, prog: 0, until: T, title: 'x', rw: 1, done: false } }, T, WK)!;
    expect(s.tasks).toBeNull(); expect(s.offer).toBeNull();
  });
});
