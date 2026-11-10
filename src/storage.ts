/* =========================================================
   KALICI KAYIT
   - Telefonda @capacitor/preferences (iOS/Android yerel depolama; WebView temizliğinden etkilenmez),
     web'de localStorage.
   - Her kayıtta sağlama (checksum) tutulur; bozuk ana kayıt yerine bir önceki sağlam yedek açılır.
   ========================================================= */
import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import { LEGACY_SAVE_KEY, SAVE_KEY, REGION, RegionId, REGION_ORDER } from './config';
import { Analytics } from './services/analytics';

/** Her bölgenin kaydı ayrı anahtarda; Türkiye eski anahtarı kullanır (mevcut oyuncular etkilenmez). */
export const saveKeyOf = (r: RegionId) => (r === 'tr' ? SAVE_KEY : `${SAVE_KEY}-${r}`);
const keyNow = () => saveKeyOf(REGION);
const backupNow = () => keyNow() + ':backup';
const native = () => Capacitor.isNativePlatform();

/** Bölge kayıtları önbelleği: bulut paketi (her gönderimde) ve ayarlar diğer bölgelerin kayıtlarını diskten yeniden okumaz.
 *  İlk okumada dolar; bu modülün her yazma ve silmesinde ilgili anahtar düşer (writeRegionSave yazdığını koyar). */
const regionCache = new Map<string, unknown>();
let cacheStore: unknown = null;
/** Web'de başka sekme kaydı değiştirirse (storage olayı) ya da depolama nesnesi değişirse önbellek düşer. */
function cacheValid() {
  const st = typeof localStorage !== 'undefined' ? localStorage : null;
  if (st !== cacheStore) { regionCache.clear(); cacheStore = st; }
}
try { if (typeof window !== 'undefined') window.addEventListener('storage', e => { if (e.key) dropCache(e.key); else regionCache.clear(); }); } catch { /* yok */ }
function dropCache(key: string) {
  if (key === LEGACY_SAVE_KEY) regionCache.delete(saveKeyOf('tr')); // Türkiye'nin eski anahtar yedeği
  else regionCache.delete(key);
}
async function getRaw(key: string): Promise<string | null> {
  try {
    if (native()) return (await Preferences.get({ key })).value;
    return localStorage.getItem(key);
  } catch (e) { Analytics.error(e, 'storage_get'); return null; }
}
/** Başarılıysa true; depolama dolu ya da kapalıysa false (oyun çalışmaya devam eder). */
async function setRaw(key: string, value: string): Promise<boolean> {
  dropCache(key);
  try {
    if (native()) await Preferences.set({ key, value });
    else localStorage.setItem(key, value);
    return true;
  } catch (e) { Analytics.error(e, 'storage_set'); return false; }
}
/** Yazma başarısız olunca oturumda bir kez çağrılır (arayüz uyarısı persist.ts'de bağlanır). */
let onFail: (() => void) | null = null, failWarned = false;
export function onSaveFail(f: () => void) { onFail = f; }
function failed() { if (failWarned) return; failWarned = true; try { onFail?.(); } catch (e) { Analytics.error(e, 'storage_fail_cb'); } }
async function removeRaw(key: string): Promise<void> {
  dropCache(key);
  try { if (native()) await Preferences.remove({ key }); else localStorage.removeItem(key); } catch (e) { Analytics.error(e, 'storage_remove'); }
}

/** FNV-1a: hızlı, kriptografik olmayan sağlama (bozulma tespiti için). */
export function checksum(str: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0).toString(36);
}
const wrap = (json: string) => JSON.stringify({ c: checksum(json), j: json });
function unwrap(raw: string | null): unknown | null {
  if (!raw) return null;
  try {
    const o = JSON.parse(raw);
    if (o && typeof o.j === 'string') return checksum(o.j) === o.c ? JSON.parse(o.j) : null;
    return o; // sağlamasız eski biçim
  } catch (e) { Analytics.error(e, 'save_parse'); return null; } // bozuk kayıt: yedeğe düşülür
}

/** Ana kaydı, bozuksa yedeği, o da yoksa eski (v1) kaydı döner. */
export async function loadRaw(): Promise<unknown | null> {
  const main = unwrap(await getRaw(keyNow()));
  if (main) return main;
  const backup = unwrap(await getRaw(backupNow()));
  if (backup) return backup;
  if (REGION !== 'tr') return null;
  return unwrap(await getRaw(LEGACY_SAVE_KEY)) ?? (typeof localStorage !== 'undefined' ? unwrap(localStorage.getItem(LEGACY_SAVE_KEY)) : null);
}

let lastGood = '', lastGoodKey = '';
let locked = false;
interface Job { json: string; key: string; bkey: string }
let running: Promise<void> | null = null, pending: Job | null = null;
/** Bulut kaydı yüklenip sayfa yenilenirken / bölge değişirken eski durumun üstüne yazılmasını engeller. */
export function lockSaves() { locked = true; pending = null; }
export function unlockSaves() { locked = false; }
/** Hedef anahtar çağrı anında yakalanır (yazma sürerken bölge değişse de kayıt doğru yere gider). */
const job = (state: object): Job => ({ json: JSON.stringify(state), key: keyNow(), bkey: backupNow() });
async function doWrite(j: Job) {
  if (lastGood && lastGoodKey === j.key) await setRaw(j.bkey, lastGood); // önce bir önceki sağlam kayıt yedeğe
  const w = wrap(j.json);
  if (await setRaw(j.key, w)) { lastGood = w; lastGoodKey = j.key; } else failed();
}
/** Kayıt sırayla yazılır; yazma sürerken gelen istekten yalnızca sonuncusu bekletilir.
 *  Dönen söz, bu çağrının durumu diske yazılınca (ya da kilit yüzünden atlanınca) tamamlanır. */
export function writeSave(state: object): Promise<void> {
  if (locked) return Promise.resolve();
  const j = job(state);
  if (running) { pending = j; return running; }
  running = (async () => {
    try { let n: Job | null = j; while (n) { await doWrite(n); n = locked ? null : pending; pending = null; } }
    finally { running = null; }
  })();
  return running;
}
/** Süren ve bekleyen yazmalar bitene kadar bekler. */
export async function flushSaves() { while (running) await running; }
/** Kilidi aşar: bekleyen kuyruğu atar, süren yazmanın bitmesini bekler ve bu durumu doğrudan yazar (bulut kaydı yükleme).
 *  Yalnızca lockSaves() sonrasında çağrılmalı: kuyruk zincirine bağlanmaz, kilitsiz bir çağrıda normal writeSave ile iç içe geçebilir. */
export async function writeSaveForce(state: object): Promise<void> {
  pending = null;
  const j = job(state);
  await flushSaves();
  await doWrite(j);
}
/** Senkron yedek yol: sayfa kapanırken (web) son durumu kaybetmemek için. */
export function writeSaveSync(state: object) {
  if (locked) return;
  if (native()) { void writeSave(state); return; }
  dropCache(keyNow());
  try { localStorage.setItem(keyNow(), wrap(JSON.stringify(state))); } catch (e) { Analytics.error(e, 'storage_set_sync'); failed(); }
}
export async function clearSave() { await removeRaw(keyNow()); await removeRaw(backupNow()); if (REGION === 'tr') await removeRaw(LEGACY_SAVE_KEY); lastGood = ''; lastGoodKey = ''; }
/** Hesap silme: bu cihazdaki tüm bölgelerin kayıtları, yedekleri ve eski (v1) kayıt silinir. Kayıtlar kilitli kalır
 *  (yeni oyun akışı bölge seçilince kilidi açar), böylece eski durum yeniden yazılmaz. */
export async function wipeAllSaves() {
  lockSaves(); await flushSaves();
  for (const r of REGION_ORDER) { await removeRaw(saveKeyOf(r)); await removeRaw(saveKeyOf(r) + ':backup'); }
  await removeRaw(LEGACY_SAVE_KEY);
  try { if (typeof localStorage !== 'undefined') localStorage.removeItem(LEGACY_SAVE_KEY); } catch (e) { Analytics.error(e, 'storage_remove'); }
  lastGood = ''; lastGoodKey = '';
}
/** Bulut paketi için: diğer bölgelerin kayıtlarını okur / yazar (sağlamalı biçimde). */
export async function readRegionSave(r: RegionId): Promise<any | null> {
  const key = saveKeyOf(r);
  let v = unwrap(await getRaw(key));
  if (!v) v = r === 'tr' ? unwrap(await getRaw(LEGACY_SAVE_KEY)) : null;
  cacheValid(); regionCache.set(key, v);
  return v;
}
/** Bulut paketi için: önbellekteki bölge kaydı (açılıştaki bölge özeti okuması ya da ilk paket doldurur), yoksa okur. */
export async function cachedRegionSave(r: RegionId): Promise<any | null> {
  cacheValid(); const key = saveKeyOf(r);
  return regionCache.has(key) ? regionCache.get(key) : readRegionSave(r);
}
export async function writeRegionSave(r: RegionId, state: object) {
  const key = saveKeyOf(r), json = JSON.stringify(state);
  if (await setRaw(key, wrap(json))) { cacheValid(); regionCache.set(key, JSON.parse(json)); }
}
/** Ayarlar ekranı için: her bölgede kaç semt var (kayıt yoksa bölge listede "başlanmadı"). */
export const REGION_INFO: Partial<Record<RegionId, { own: number }>> = {};
export async function loadRegionInfo() { for (const r of REGION_ORDER) { const v = await readRegionSave(r); if (v && Array.isArray(v.own) && v.city) REGION_INFO[r] = { own: v.own.length }; } }
/** Herhangi bir bölgede kayıt var mı (mevcut oyuncuyu ilk açılış seçimlerinden geçirmemek için). */
export async function anySave(): Promise<boolean> { for (const r of REGION_ORDER) if (validSave(await readRegionSave(r))) return true; return false; }
/** Şehri seçilmiş (gerçek) kayıt mı? İlk açılış seçimleri bitmeden yazılmış kayıtlar (city: null) sayılmaz.
 *  v1 kayıtlar ve city alanı hiç olmayan eski kayıtlar semtlerinden şehir türetir (state.ts sanitize). */
export function validSave(v: any): boolean {
  if (!v || typeof v !== 'object') return false;
  if (v.v === 1) return true;
  if (typeof v.city === 'string' && v.city) return true;
  return v.city === undefined && Array.isArray(v.own) && v.own.length > 0;
}
