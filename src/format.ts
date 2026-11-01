/* sayı, süre ve tarih biçimleri (Türkçe kısaltmalar) */
const UNITS = ['B', 'Mn', 'Mr', 'Tn', 'Kn', 'Kt', 'Sk', 'Sp', 'Ok', 'Nn', 'Dc', 'Ud', 'Dd'];
const one = (x: number) => (Math.floor(x * 10) / 10).toFixed(1).replace('.', ',').replace(/,0$/, '');

export function fmt(n: number, dec = false): string {
  n = Math.max(0, n || 0);
  if (!Number.isFinite(n)) return '₺∞';
  if (n < 1000) return '₺' + (dec && n < 100 ? one(n) : Math.floor(n));
  let i = -1;
  while (n >= 1000 && i < UNITS.length - 1) { n /= 1000; i++; }
  if (n >= 1000) return '₺' + n.toExponential(1).replace('.', ',').replace('e+', 'e') + UNITS[i];
  return '₺' + (n < 100 ? one(n) : Math.floor(n)) + UNITS[i];
}
export function fmtTime(ms: number): string {
  let s = Math.max(0, Math.ceil(ms / 1000)); const h = Math.floor(s / 3600); s %= 3600; const m = Math.floor(s / 60); s %= 60;
  if (h) return `${h} sa${m ? ' ' + m + ' dk' : ''}`;
  if (m) return `${m} dk${s ? ' ' + s + ' sn' : ''}`;
  return `${s} sn`;
}
export function clock(ms: number): string {
  let s = Math.max(0, Math.ceil(ms / 1000)); const h = Math.floor(s / 3600); s %= 3600; const m = Math.floor(s / 60); s %= 60;
  const p = (x: number) => String(x).padStart(2, '0');
  return h ? `${h}:${p(m)}:${p(s)}` : `${m}:${p(s)}`;
}
export const fmtX = (m: number) => String(m.toFixed(1)).replace('.', ',') + 'x';
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
