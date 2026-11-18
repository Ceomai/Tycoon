/* sayı, süre ve tarih biçimleri (Türkçe kısaltmalar) */
import { REGION, REGIONS, RegionId, dispScale } from './config';
import { units, LANG, t, loc as locI } from './i18n';
const one = (x: number, dec: string, up = false) => ((up ? ceil(x * 10) : Math.floor(x * 10)) / 10).toFixed(1).replace('.', dec).replace(new RegExp('\\' + dec + '0$'), '');
/** Yukarı yuvarlama (kayan nokta artığı bir üst basamağa taşımasın). */
const ceil = (x: number) => Math.ceil(x * (1 - 1e-12) - 1e-9);

/** Ekrandaki tutarı (bölgenin fiyat seviyesiyle ölçeklenmiş) simgeyle biçimler: dilin kısa birimleri
 *  (₺1,2Mn · $1.5M · €1,5Mio · ¥150万). Kuruş yok: kısaltmasız tutar (birim tabanının altı) tamsayıdır; kısaltılmış
 *  tutarda 100'ün altı tek ondalık (₺1,2Mn).
 *  fuzz: çarpımdan kalan kayan nokta payı (249.999,99… → 250B).
 *  up: bedel/fiyat gösterimi — yukarı yuvarlanır, ekrandaki fiyat gerçek tutarın altında görünmez (kasa/kazanç aşağı). */
export function money(v: number, c: string, fuzz = false, up = false): string {
  const U = units(), k = fuzz && !up ? 1 + 1e-9 : 1;
  const R = (x: number) => (up ? ceil(x) : Math.floor(x * k));
  v = Math.max(0, v || 0);
  if (!Number.isFinite(v)) return c + '∞';
  let i = -1;
  while (v >= U.base && i < U.u.length - 1) { v /= U.base; i++; }
  if (v >= U.base) return c + v.toExponential(1).replace('.', U.dec).replace('e+', 'e') + U.u[i];
  const small = i >= 0 && v < 100;
  if (up && R(v) >= U.base && i < U.u.length - 1) return c + '1' + U.u[i + 1]; // 999,6Mn → 1Mr (taşma)
  return c + (small ? one(v * k, U.dec, up) : R(v)) + (i < 0 ? '' : U.u[i]);
}
/** İşaretli tutar (bilanço neti): eksi değer "−" ile; yuvarlanınca sıfır görünen artık işaretsiz. */
export function moneySigned(v: number, c: string, fuzz = false): string {
  const a = money(Math.abs(v || 0), c, fuzz);
  return v < 0 && a !== money(0, c, fuzz) ? '−' + a : a;
}
/** Para (iç birim): bölgenin simgesi ve fiyat seviyesiyle. */
export function fmt(n: number): string { return fmtIn(n, REGION); }
/** Para (iç birim) başka bir bölgenin parasıyla (banka, bilanço). */
export function fmtIn(n: number, r: RegionId, up = false): string { return money(n * dispScale(r), REGIONS[r].cur, true, up); }
/** Bedel / fiyat (iç birim): yukarı yuvarlanır — ekrandaki fiyat ödenecek tutarın altında görünmez. */
export function fmtCost(n: number): string { return fmtIn(n, REGION, true); }
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
