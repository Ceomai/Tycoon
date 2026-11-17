/* sayı, süre ve tarih biçimleri (Türkçe kısaltmalar) */
import { REGION, REGIONS, RegionId, dispScale } from './config';
import { units, LANG, t, loc as locI } from './i18n';
const one = (x: number, dec: string) => (Math.floor(x * 10) / 10).toFixed(1).replace('.', dec).replace(new RegExp('\\' + dec + '0$'), '');

/** Ekrandaki tutarı (ölçeklenmiş) simgeyle biçimler: dilin kısa birimleri (₺1,5Mn · $1.5M · €1,5Mio · ¥150万).
 *  cents: küçük birimli paralar ($, €, £): 100'ün altı kuruşlu ($3.49), 1'in altı en az iki anlamlı haneyle ($0.012).
 *  Kuruşsuz paralarda (₺, ¥) eski davranış: tamsayı, dec ise 100'ün altı tek ondalık. */
export function money(v: number, c: string, cents = false, dec = false, fuzz = false): string {
  const U = units(), k = fuzz ? 1 + 1e-9 : 1; // fuzz: ölçekli tutarda kayan nokta payı ($59.999… → $60.00)
  v = Math.max(0, v || 0);
  if (!Number.isFinite(v)) return c + '∞';
  if (cents && v < 100) {
    if (!v) return c + '0';
    const d = v >= 1 ? 2 : Math.min(6, Math.max(2, 1 - Math.floor(Math.log10(v)))), p = Math.pow(10, d);
    return c + (Math.floor(v * p * k) / p).toFixed(d).replace('.', U.dec);
  }
  if (v < U.base) return c + (dec && v < 100 ? one(v * k, U.dec) : Math.floor(v * k));
  let i = -1;
  while (v >= U.base && i < U.u.length - 1) { v /= U.base; i++; }
  if (v >= U.base) return c + v.toExponential(1).replace('.', U.dec).replace('e+', 'e') + U.u[i];
  return c + (v < 100 ? one(v * k, U.dec) : Math.floor(v * k)) + U.u[i];
}
/** Kuruşlu gösterim: ölçeği küçük paralar (1 birim iç birimden en az iki kat değerli). */
export const centsOf = (r: RegionId) => dispScale(r) < 0.5;
/** Para (iç birim): bölgenin simgesi ve gösterim ölçeğiyle. dec: kira/sn gibi küçük değerlerde ondalık. */
export function fmt(n: number, dec = false): string { return fmtIn(n, REGION, dec); }
/** Para (iç birim) başka bir bölgenin parasıyla (banka, bilanço). */
export function fmtIn(n: number, r: RegionId, dec = false): string { const sc = dispScale(r); return money(n * sc, REGIONS[r].cur, sc < 0.5, dec, sc !== 1); }
/** Ondalık sayı (kur): dilin ayırıcısıyla, d hane. */
export const fmtNum = (x: number, d = 2) => (Number.isFinite(x) ? x : 0).toFixed(d).replace('.', units().dec);
export function fmtTime(ms: number): string {
  let s = Math.max(0, Math.ceil(ms / 1000) || 0); const h = Math.floor(s / 3600); s %= 3600; const m = Math.floor(s / 60); s %= 60;
  const H = t('sa'), M = t('dk'), Sn = t('sn');
  if (h) return `${h} ${H}${m ? ' ' + m + ' ' + M : ''}`;
  if (m) return `${m} ${M}${s ? ' ' + s + ' ' + Sn : ''}`;
  return `${s} ${Sn}`;
}
export function clock(ms: number): string {
  let s = Math.max(0, Math.ceil(ms / 1000) || 0); const h = Math.floor(s / 3600); s %= 3600; const m = Math.floor(s / 60); s %= 60;
  const p = (x: number) => String(x).padStart(2, '0');
  return h ? `${h}:${p(m)}:${p(s)}` : `${m}:${p(s)}`;
}
export const fmtX = (m: number) => String(m.toFixed(1)).replace('.', LANG === 'tr' || LANG === 'de' ? ',' : '.') + 'x';
export const esc = (t: unknown) => String(t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
export const rand = (a: number, b: number) => a + Math.random() * (b - a);

export function dayKey(d = new Date()): string {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
/** Ay anahtarı (YYYY-AA, yerel saat): tapu sezonu kimliği. */
export const monthKey = (d = new Date()): string => dayKey(d).slice(0, 7);
export function dayDiff(a: string, b: string): number {
  const A = a.split('-').map(Number), B = b.split('-').map(Number);
  return Math.round((Date.UTC(B[0], B[1] - 1, B[2]) - Date.UTC(A[0], A[1] - 1, A[2])) / 864e5);
}
export function weekKey(d = new Date()): string {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())); const wd = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - wd);
  const y = t.getUTCFullYear();
  return y + '-H' + String(Math.ceil(((t.getTime() - Date.UTC(y, 0, 1)) / 864e5 + 1) / 7)).padStart(2, '0');
}

/** Yer bildiren ek (dile göre): Kadıköy’de · in Kadıköy · Kadıköyで */
export const loc = locI;
