/* =========================================================
   TERCİHLER — dil, bölge ve satın alınan paketlerin önbelleği (tüm bölgelerde geçerli).
   Kayıtlar bölgeye göre ayrıdır (storage.ts); tercihler tek yerde tutulur.
   ========================================================= */
import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import type { RegionId } from './config';
import type { Lang } from './i18n';
import { isTheme, type Theme } from './theme';

const KEY = 'tapu-prefs';
export interface Prefs { lang: Lang | ''; region: RegionId | ''; ent: { premium: boolean; noAds: boolean; club: boolean }; news: boolean; /** görünüm: otomatik (sistem) / açık / koyu */ theme: Theme }
export const P: Prefs = { lang: '', region: '', ent: { premium: false, noAds: false, club: false }, news: false, theme: 'auto' };
const native = () => Capacitor.isNativePlatform();

export async function loadPrefs(): Promise<Prefs> {
  try {
    const raw = native() ? (await Preferences.get({ key: KEY })).value : localStorage.getItem(KEY);
    const o = raw ? JSON.parse(raw) : null;
    if (o && typeof o === 'object') {
      if (typeof o.lang === 'string') P.lang = o.lang;
      if (typeof o.region === 'string') P.region = o.region;
      if (o.news === true) P.news = true;
      if (isTheme(o.theme)) P.theme = o.theme;
      if (o.ent && typeof o.ent === 'object') P.ent = { premium: o.ent.premium === true, noAds: o.ent.noAds === true, club: o.ent.club === true };
    }
  } catch { /* varsayılanlar */ }
  return P;
}
/** Telefonda yazma eşzamansızdır: sayfa yenilemeden önce dönen söz beklenebilir. */
export function savePrefs(): Promise<void> {
  const v = JSON.stringify(P);
  try { if (native()) return Preferences.set({ key: KEY, value: v }).catch(() => { /* yok */ }); localStorage.setItem(KEY, v); } catch { /* yok */ }
  return Promise.resolve();
}
/** Paket bayrakları değişince tercihlere yazılır (diğer bölgelerde de geçerli olsun). */
export function syncEnt(s: { premium: boolean; noAds: boolean; club: boolean }) {
  const e = P.ent;
  if (e.premium !== !!s.premium || e.noAds !== !!s.noAds || e.club !== !!s.club) { P.ent = { premium: !!s.premium, noAds: !!s.noAds, club: !!s.club }; savePrefs(); }
}
