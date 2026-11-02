/* =========================================================
   KALICI KAYIT
   - Telefonda @capacitor/preferences (iOS/Android yerel depolama; WebView temizliğinden etkilenmez),
     web'de localStorage.
   - Her kayıtta sağlama (checksum) tutulur; bozuk ana kayıt yerine bir önceki sağlam yedek açılır.
   ========================================================= */
import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import { LEGACY_SAVE_KEY, SAVE_KEY, REGION, RegionId, REGION_ORDER } from './config';

/** Her bölgenin kaydı ayrı anahtarda; Türkiye eski anahtarı kullanır (mevcut oyuncular etkilenmez). */
export const saveKeyOf = (r: RegionId) => (r === 'tr' ? SAVE_KEY : `${SAVE_KEY}-${r}`);
const keyNow = () => saveKeyOf(REGION);
const backupNow = () => keyNow() + ':backup';
const native = () => Capacitor.isNativePlatform();

async function getRaw(key: string): Promise<string | null> {
  try {
    if (native()) return (await Preferences.get({ key })).value;
    return localStorage.getItem(key);
  } catch { return null; }
}
async function setRaw(key: string, value: string): Promise<void> {
  try {
    if (native()) await Preferences.set({ key, value });
    else localStorage.setItem(key, value);
  } catch { /* depolama dolu ya da kapalı: oyun çalışmaya devam eder */ }
}
async function removeRaw(key: string): Promise<void> {
  try { if (native()) await Preferences.remove({ key }); else localStorage.removeItem(key); } catch { /* yok */ }
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
  } catch { return null; }
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

let lastGood = '';
let locked = false;
/** Bulut kaydı yüklenip sayfa yenilenirken eski durumun üstüne yazılmasını engeller. */
export function lockSaves() { locked = true; }
let writing = false, pending: string | null = null;
/** Kayıt sırayla yazılır; önce bir önceki sağlam kayıt yedeğe alınır. */
export async function writeSave(state: object): Promise<void> {
  if (locked) return;
  const json = JSON.stringify(state);
  if (writing) { pending = json; return; }
  writing = true;
  try {
    if (lastGood) await setRaw(backupNow(), lastGood);
    const w = wrap(json);
    await setRaw(keyNow(), w);
    lastGood = w;
  } finally {
    writing = false;
    if (pending) { const p = pending; pending = null; await writeSave(JSON.parse(p)); }
  }
}
/** Senkron yedek yol: sayfa kapanırken (web) son durumu kaybetmemek için. */
export function writeSaveSync(state: object) {
  if (locked) return;
  if (native()) { void writeSave(state); return; }
  try { localStorage.setItem(keyNow(), wrap(JSON.stringify(state))); } catch { /* yok */ }
}
export async function clearSave() { await removeRaw(keyNow()); await removeRaw(backupNow()); if (REGION === 'tr') await removeRaw(LEGACY_SAVE_KEY); lastGood = ''; }
/** Bulut paketi için: diğer bölgelerin kayıtlarını okur / yazar (sağlamalı biçimde). */
export async function readRegionSave(r: RegionId): Promise<any | null> {
  const v = unwrap(await getRaw(saveKeyOf(r))); if (v) return v;
  return r === 'tr' ? unwrap(await getRaw(LEGACY_SAVE_KEY)) : null;
}
export async function writeRegionSave(r: RegionId, state: object) { await setRaw(saveKeyOf(r), wrap(JSON.stringify(state))); }
export const ALL_REGIONS = REGION_ORDER;
/** Ayarlar ekranı için: her bölgede kaç semt var (kayıt yoksa bölge listede "başlanmadı"). */
export const REGION_INFO: Partial<Record<RegionId, { own: number }>> = {};
export async function loadRegionInfo() { for (const r of REGION_ORDER) { const v = await readRegionSave(r); if (v && Array.isArray(v.own) && v.city) REGION_INFO[r] = { own: v.own.length }; } }
/** Herhangi bir bölgede kayıt var mı (mevcut oyuncuyu ilk açılış seçimlerinden geçirmemek için). */
export async function anySave(): Promise<boolean> { for (const r of REGION_ORDER) if (await readRegionSave(r)) return true; return false; }
