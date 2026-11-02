/* sayı, süre ve tarih biçimleri (Türkçe kısaltmalar) */
import { currency } from './config';
import { units, LANG, t, loc as locI } from './i18n';
const one = (x: number, dec: string) => (Math.floor(x * 10) / 10).toFixed(1).replace('.', dec).replace(new RegExp('\\' + dec + '0$'), '');

/** Para: bölgenin simgesi + dilin kısa birimleri (₺1,5Mn · $1.5M · €1,5Mio · ¥150万). */
export function fmt(n: number, dec = false): string {
  const c = currency(), U = units();
  n = Math.max(0, n || 0);
  if (!Number.isFinite(n)) return c + '∞';
  if (n < U.base) return c + (dec && n < 100 ? one(n, U.dec) : Math.floor(n));
  let i = -1;
  while (n >= U.base && i < U.u.length - 1) { n /= U.base; i++; }
  if (n >= U.base) return c + n.toExponential(1).replace('.', U.dec).replace('e+', 'e') + U.u[i];
  return c + (n < 100 ? one(n, U.dec) : Math.floor(n)) + U.u[i];
}
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
