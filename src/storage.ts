/* =========================================================
   KALICI KAYIT
   - Telefonda @capacitor/preferences (iOS/Android yerel depolama; WebView temizliğinden etkilenmez),
     web'de localStorage.
   - Her kayıtta sağlama (checksum) tutulur; bozuk ana kayıt yerine bir önceki sağlam yedek açılır.
   ========================================================= */
import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import { LEGACY_SAVE_KEY, SAVE_KEY } from './config';

const BACKUP_KEY = SAVE_KEY + ':backup';
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
  const main = unwrap(await getRaw(SAVE_KEY));
  if (main) return main;
  const backup = unwrap(await getRaw(BACKUP_KEY));
  if (backup) return backup;
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
    if (lastGood) await setRaw(BACKUP_KEY, lastGood);
    const w = wrap(json);
    await setRaw(SAVE_KEY, w);
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
  try { localStorage.setItem(SAVE_KEY, wrap(JSON.stringify(state))); } catch { /* yok */ }
}
export async function clearSave() { await removeRaw(SAVE_KEY); await removeRaw(BACKUP_KEY); await removeRaw(LEGACY_SAVE_KEY); lastGood = ''; }
