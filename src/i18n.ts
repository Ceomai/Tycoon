/* =========================================================
   DİL (i18n) — arayüz dili bölgeden bağımsız seçilir.
   Anahtar = Türkçe kaynak metin; {ad} yer tutucuları params ile doldurulur. Çeviri yoksa Türkçe görünür.
   Sözlükler: src/locales/{en,de,ja}.ts (scripts/i18n-extract.mjs ile anahtarlar toplanır).
   Özel adlar (şehir, semt) nm() ile çevrilir; yoksa olduğu gibi kalır.
   ========================================================= */
import { EN } from './locales/en';
import { DE } from './locales/de';
import { JA } from './locales/ja';

export type Lang = 'tr' | 'en' | 'de' | 'ja';
export const LANGS: { id: Lang; n: string; sub: string }[] = [
  { id: 'tr', n: 'Türkçe', sub: 'Türkçe oyna' },
  { id: 'en', n: 'English', sub: 'Play in English' },
  { id: 'de', n: 'Deutsch', sub: 'Auf Deutsch spielen' },
  { id: 'ja', n: '日本語', sub: '日本語でプレイ' },
];
import type { Dict } from './locales/dict';
export type { Dict };
const DICTS: Record<Lang, Dict | null> = { tr: null, en: EN, de: DE, ja: JA };

export let LANG: Lang = 'tr';
export function setLang(l: string) {
  LANG = (['tr', 'en', 'de', 'ja'] as const).includes(l as Lang) ? (l as Lang) : 'tr';
  if (typeof document !== 'undefined') { document.documentElement.lang = LANG; applyCssText(); }
}
/** Cihaz dilinden varsayılan. */
export function deviceLang(): Lang {
  const n = (typeof navigator !== 'undefined' ? navigator.language || '' : '').toLowerCase();
  return n.startsWith('tr') ? 'tr' : n.startsWith('de') ? 'de' : n.startsWith('ja') ? 'ja' : n ? 'en' : 'tr';
}

const fill = (s: string, p?: Record<string, unknown>) => (p ? s.replace(/\{(\w+)\}/g, (m, k) => (k in p ? String(p[k]) : m)) : s);
/** Çeviri: Türkçe kaynak metin anahtardır. */
export function t(src: string, p?: Record<string, unknown>): string {
  const d = DICTS[LANG];
  return fill((d && d.s[src]) || src, p);
}
/** Bağlamlı çeviri: aynı Türkçe metin farklı anlamlarda kullanılınca (ör. tema "Açık" = Light, anahtar "Açık" = On).
 *  Sözlük anahtarı "bağlam|kaynak"; çeviri yoksa (ve Türkçede) kaynak metin görünür. Örn: tc('tema', 'Açık') */
export function tc(ctx: string, src: string, p?: Record<string, unknown>): string {
  const d = DICTS[LANG];
  return fill((d && d.s[ctx + '|' + src]) || src, p);
}
/** Özel ad (şehir, semt) çevirisi. */
const TR_NAMES: Record<string, string> = { Munich: 'Münih', London: 'Londra' };
export function nm(name: string): string {
  if (LANG === 'tr') return TR_NAMES[name] || name;
  const d = DICTS[LANG];
  return (d && d.names && d.names[name]) || name;
}
/** Büyük harf: dilin kuralıyla (Türkçede i → İ). */
export const upper = (s: string) => s.toLocaleUpperCase(LANG === 'tr' ? 'tr-TR' : LANG);

/** "…’de / in … / in … / …で": yer bildiren ek. */
export function loc(name: string): string {
  if (LANG === 'en') return `in ${name}`;
  if (LANG === 'de') return `in ${name}`;
  if (LANG === 'ja') return `${name}で`;
  const low = name.toLocaleLowerCase('tr-TR'), v = [...low].reverse().find(c => 'aeıioöuü'.includes(c)) || 'e';
  const last = low[low.length - 1], hard = 'fstkçşhp'.includes(last);
  return `${name}’${hard ? 't' : 'd'}${'aıou'.includes(v) ? 'a' : 'e'}`;
}

/** Sayı birimleri (her dilde kısa). Japoncada 万/億/兆 dörtlü gruplarla. */
export function units(): { base: number; u: string[]; dec: string } {
  switch (LANG) {
    case 'en': return { base: 1000, u: ['K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc', 'Ud', 'Dd'], dec: '.' };
    case 'de': return { base: 1000, u: ['Tsd', 'Mio', 'Mrd', 'Bio', 'Brd', 'Tri', 'Trd', 'Qua', 'Qrd', 'Qui', 'Qid', 'Sxt', 'Sxd'], dec: ',' };
    case 'ja': return { base: 10000, u: ['万', '億', '兆', '京', '垓', '𥝱', '穣', '溝', '澗', '正', '載', '極'], dec: '.' };
    default: return { base: 1000, u: ['B', 'Mn', 'Mr', 'Tn', 'Kn', 'Kt', 'Sk', 'Sp', 'Ok', 'Nn', 'Dc', 'Ud', 'Dd'], dec: ',' };
  }
}
/** Yüzde: Türkçede %20, diğerlerinde 20%. */
export const pctTxt = (n: number) => (LANG === 'tr' ? `%${n}` : `${n}%`);

/** CSS'teki sabit metinler (::before/::after içerikleri) dile göre değişkenlerle verilir. */
function applyCssText() {
  const r = document.documentElement.style;
  const q = (s: string) => JSON.stringify(t(s));
  r.setProperty('--t-notice', q('TEBLİGAT'));
  r.setProperty('--t-deed', JSON.stringify(t('Tapu Senedi') + ' · '));
}

/** Çeviri anahtarı işareti (veri tablolarında): metni değiştirmez, yalnızca derleme betiğinin anahtarı bulmasını sağlar.
 *  Görüntülerken t(x) ile çevrilir. Örn: TYPES = { ev: { n: tk('Ev') } } … t(TYPES.ev.n) */
export const tk = (s: string) => s;
