// Hata düzeltmeleri: ilk açılışta çöp kayıt, kayıt kuyruğu/kilidi, depolama kotası, kayıt doğrulama.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { newState, migrate, setS, S } from '../../src/state';
import { weekKey } from '../../src/format';
import { setRegion, SAVE_KEY } from '../../src/config';
import {
  writeSave, writeSaveSync, writeSaveForce, flushSaves, lockSaves, unlockSaves, loadRaw, anySave, validSave,
  saveKeyOf, wipeAllSaves, onSaveFail,
} from '../../src/storage';
import { persist, persistSync, persistNow } from '../../src/game/persist';

/** localStorage taklidi (node ortamında yok). failNext: sonraki setItem kota hatası verir. */
class MemStore {
  m = new Map<string, string>(); fail = false; sets: string[] = [];
  getItem(k: string) { return this.m.has(k) ? this.m.get(k)! : null; }
  setItem(k: string, v: string) { if (this.fail) throw new Error('QuotaExceededError'); this.sets.push(k); this.m.set(k, String(v)); }
  removeItem(k: string) { this.m.delete(k); }
  clear() { this.m.clear(); }
  key(i: number) { return [...this.m.keys()][i] ?? null; }
  get length() { return this.m.size; }
}
const T = Date.UTC(2026, 10, 1, 12), WK = weekKey(new Date(T));
let ls: MemStore;
const read = (k: string) => { const raw = ls.getItem(k); if (!raw) return null; const o = JSON.parse(raw); return o.j ? JSON.parse(o.j) : o; };

beforeEach(async () => {
  ls = new MemStore(); (globalThis as any).localStorage = ls;
  await flushSaves(); unlockSaves(); setRegion('tr');
});
afterEach(async () => { await flushSaves(); unlockSaves(); setRegion('tr'); });

describe('ilk açılış: şehir seçilmeden kayıt yazılmaz (bulgu 2)', () => {
  it('S.city null iken persist ve persistSync yazmaz, şehir seçilince yazar', async () => {
    setS(newState(T, WK)); expect(S.city).toBeNull();
    persist(); persistSync(); await persistNow();
    expect(ls.getItem(SAVE_KEY)).toBeNull();
    S.city = 'ist'; persist(); await flushSaves();
    expect(read(SAVE_KEY)?.city).toBe('ist');
  });
  it('anySave yalnızca şehri seçilmiş kayıtları sayar', async () => {
    ls.setItem(saveKeyOf('tr'), JSON.stringify(newState(T, WK)));            // city: null (yarım kalan kurulum)
    ls.setItem(saveKeyOf('us'), JSON.stringify({ ...newState(T, WK), city: null }));
    expect(await anySave()).toBe(false);
    ls.setItem(saveKeyOf('de'), JSON.stringify(newState(T, WK, 'ber' as any)));
    expect(await anySave()).toBe(true);
  });
  it('validSave: v1 ve city alanı olmayan eski kayıtlar geçerli, city: null geçersiz', () => {
    expect(validSave({ v: 1, d: [] })).toBe(true);
    const { city, ...noCity } = newState(T, WK, 'ist'); void city;
    expect(validSave(noCity)).toBe(true);
    expect(validSave({ ...noCity, city: null })).toBe(false);
    expect(validSave(null)).toBe(false);
  });
  it('sanitize: city null ise semtlerden şehir türetilmez; alan hiç yoksa türetilir (eski kayıt göçü)', () => {
    const s = newState(T, WK); // city null, own: ist-0
    expect(migrate(JSON.parse(JSON.stringify(s)), T, WK)!.city).toBeNull();
    const old: any = JSON.parse(JSON.stringify(newState(T, WK, 'ank'))); delete old.city;
    expect(migrate(old, T, WK)!.city).toBe('ank');
  });
});

describe('kayıt kuyruğu ve kilit (bulgu 5, 6)', () => {
  it('sırayla yazar; bekleyen isteklerden sonuncusu kalır; flushSaves hepsini bekler', async () => {
    const a = writeSave({ n: 1 }); void writeSave({ n: 2 }); const c = writeSave({ n: 3 });
    await Promise.all([a, c]); await flushSaves();
    expect(read(SAVE_KEY).n).toBe(3);
    expect(ls.sets.filter(k => k === SAVE_KEY).length).toBe(2); // 1 ve 3 (2 atlandı)
  });
  it('hedef anahtar çağrı anında yakalanır (yazma sürerken bölge değişse de)', async () => {
    void writeSave({ n: 'ilk' }); const p = writeSave({ n: 'tr' }); // ikinci istek kuyrukta
    setRegion('us');
    await p; await flushSaves();
    expect(read(saveKeyOf('tr')).n).toBe('tr');
    expect(ls.getItem(saveKeyOf('us'))).toBeNull();
  });
  it('kilitliyken writeSave/writeSaveSync yazmaz, bekleyen kuyruk atılır; writeSaveForce kilidi aşar', async () => {
    void writeSave({ n: 'eski' }); void writeSave({ n: 'bekleyen' }); lockSaves();
    await flushSaves();
    void writeSave({ n: 'kilitli' }); writeSaveSync({ n: 'kilitli-sync' });
    await writeSaveForce({ n: 'bulut' });
    expect(read(SAVE_KEY).n).toBe('bulut');
    await flushSaves();
    expect(read(SAVE_KEY).n).toBe('bulut');
  });
  it('persistNow kaydın diske inmesini bekler (sayfa yenilemeden önce)', async () => {
    setS(newState(T, WK, 'ist')); S.cash = 777;
    void writeSave({ n: 'süren' });
    await persistNow();
    expect(read(SAVE_KEY).cash).toBe(777);
  });
  it('bozuk ana kayıtta bir önceki sağlam kayıt yedekten açılır', async () => {
    await writeSave({ v: 'a' }); await writeSave({ v: 'b' });
    ls.setItem(SAVE_KEY, '{bozuk');
    expect((await loadRaw() as any).v).toBe('a');
  });
});

describe('depolama kotası (bulgu 9)', () => {
  it('yazma başarısızsa uyarı oturumda bir kez, yedeğe başarısız kayıt alınmaz', async () => {
    let n = 0; onSaveFail(() => { n++; });
    await writeSave({ v: 'iyi' });
    ls.fail = true; await writeSave({ v: 'dolu1' }); await writeSave({ v: 'dolu2' }); writeSaveSync({ v: 'dolu3' });
    expect(n).toBe(1);
    ls.fail = false; await writeSave({ v: 'yeni' });
    expect(read(SAVE_KEY + ':backup').v).toBe('iyi'); // son sağlam kayıt hâlâ 'iyi'
  });
});

describe('hesap silme: tüm bölgelerin kayıtları silinir (bulgu 7)', () => {
  it('her bölge, yedekleri ve eski anahtar silinir; tercihler kalır; kayıtlar kilitli kalır', async () => {
    for (const r of ['tr', 'us', 'gl'] as const) { ls.setItem(saveKeyOf(r), 'x'); ls.setItem(saveKeyOf(r) + ':backup', 'x'); }
    ls.setItem('tapu-save-v1', 'x'); ls.setItem('tapu-prefs', '{}');
    await wipeAllSaves();
    expect([...ls.m.keys()]).toEqual(['tapu-prefs']);
    await writeSave({ n: 1 }); expect(ls.getItem(SAVE_KEY)).toBeNull();
  });
});

describe('kayıt doğrulama: süreli fırsat (bulgu 8)', () => {
  const base = () => JSON.parse(JSON.stringify(newState(T, WK, 'ist')));
  const ok = { k: 'taxi', goal: 3, prog: 1, until: T + 6e4, title: 'Altın taksi', rw: 1500, done: false };
  it('geçerli fırsat korunur', () => { expect(migrate({ ...base(), offer: ok }, T, WK)!.offer).toEqual(ok); });
  it('geçersiz alanlı fırsat atılır', () => {
    for (const bad of [{ goal: 0 }, { goal: -1 }, { goal: 'x' }, { prog: 'x' }, { prog: NaN }, { title: 5 }, { rw: 'çok' }, { rw: null }, { until: null }]) {
      expect(migrate({ ...base(), offer: { ...ok, ...bad } }, T, WK)!.offer).toBeNull();
    }
  });
});
