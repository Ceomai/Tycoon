// Saf SVG metni üreten çizim modülü (özel yapılar)
/* =========================================================
   ÖZEL YAPILAR — haftanın özel tapusu (Han, Pasaj, Yalı Köşkü, Bahçeli Köşk)
   Diğer binalarla aynı 3/4 bakış (taban Y=90, derinlik 14×10), mürekkep çizgi.
   ========================================================= */
import { tk } from './i18n';

export const SPECIALS = [
  { id: 'han', n: tk('Tarihi Han'), d: tk('Kemerli avlusu ve kubbesiyle taş han') },
  { id: 'pasaj', n: tk('Pasaj'), d: tk('Cam çatılı, dükkânlı tarihi çarşı') },
  { id: 'yali', n: tk('Yalı Köşkü'), d: tk('Cumbalı, ahşap saçaklı sahil köşkü') },
  { id: 'kosk', n: tk('Bahçeli Köşk'), d: tk('Piramit çatılı, bahçe içinde köşk') },
];
export const specialOf = (id) => SPECIALS.find(s => s.id === id) || SPECIALS[0];
/** Haftanın yapısı hafta numarasına göre sırayla döner. */
export function weekSpecial(weekKey) {
  const n = parseInt(String(weekKey || '').split('H')[1] || '0', 10) || 0;
  return SPECIALS[n % SPECIALS.length];
}

const INK = 'stroke="var(--ink)" stroke-linejoin="round"';
const poly = (pts, fill, w = 1) => `<polygon points="${pts}" fill="${fill}" ${INK} stroke-width="${w}"/>`;
const rect = (x, y, w, h, fill, sw = .8) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" ${INK} stroke-width="${sw}"/>`;
const shadow = (x, w) => `<polygon class="sh" points="${x + 2},91.5 ${x + w + 3},91.5 ${x + w + 21},81 ${x + 20},81"/>`;
/** Kutunun ön, yan ve üst yüzü (x: sol, w: genişlik, h: yükseklik). */
function box(x, w, h, front, sideC, top) {
  const yt = 90 - h;
  return poly(`${x},90 ${x + w},90 ${x + w},${yt} ${x},${yt}`, front)
    + poly(`${x + w},90 ${x + w + 14},80 ${x + w + 14},${yt - 10} ${x + w},${yt}`, sideC)
    + (top ? poly(`${x},${yt} ${x + w},${yt} ${x + w + 14},${yt - 10} ${x + 14},${yt - 10}`, top) : '');
}
const arch = (x, y, w, h, fill) => `<path d="M${x} ${y + h}v${-(h - w / 2)}a${w / 2} ${w / 2} 0 0 1 ${w} 0v${h - w / 2}z" fill="${fill}" ${INK} stroke-width=".7"/>`;

function han() {
  let s = shadow(14, 60) + box(14, 60, 34, '#e6d3ad', '#cdb489', null);
  s += poly('11,57 77,57 91,47 25,47', '#b85d3e');
  for (let k = 0; k < 4; k++) s += arch(19 + k * 14, 76, 8, 14, '#6b4a3a') + arch(19 + k * 14, 62, 8, 8, '#bcd6e8');
  s += `<ellipse cx="51" cy="44" rx="9" ry="7" fill="#9fb3bf" ${INK} stroke-width=".9"/><path d="M51 37v-6" stroke="var(--ink)" stroke-width="1.2"/>`;
  return s;
}
function pasaj() {
  let s = shadow(10, 66) + box(10, 66, 26, '#d9cbb5', '#bfae94', null);
  s += `<path d="M10 64 Q43 46 76 64 L90 54 Q57 36 24 54 Z" fill="#cfe3ee" ${INK} stroke-width="1"/>`;
  for (let k = 1; k < 6; k++) s += `<path d="M${10 + k * 11} ${64 - Math.sin(k / 6 * Math.PI) * 9} l14 -10" stroke="var(--ink)" stroke-width=".6"/>`;
  for (let k = 0; k < 5; k++) s += rect(14 + k * 12.4, 74, 9, 16, k === 2 ? '#6b4a3a' : '#bcd6e8', .7) + rect(13.5 + k * 12.4, 71, 10, 3, k % 2 ? '#e0a21b' : '#c23b2e', .5);
  return s;
}
function yali() {
  let s = shadow(16, 54) + box(16, 54, 30, '#f3ede0', '#d9cfba', null);
  s += rect(33, 50, 20, 18, '#f3ede0', .9);
  s += poly('10,62 76,62 92,50 26,50', '#a85638') + poly('29,51 57,51 63,46 35,46', '#a85638');
  for (let k = 0; k < 4; k++) s += rect(20 + k * 13, 76, 6, 10, '#bcd6e8', .7);
  for (let k = 0; k < 3; k++) s += rect(36 + k * 6, 54, 4, 8, '#bcd6e8', .6);
  s += `<path d="M6 92h86" stroke="#7fa7c6" stroke-width="2.4"/><path d="M8 95h20M40 95h18M70 95h16" stroke="#7fa7c6" stroke-width="1.2"/>`;
  return s;
}
function kosk() {
  let s = `<circle cx="16" cy="74" r="8" fill="#8fb874" ${INK} stroke-width=".9"/><circle cx="86" cy="80" r="7" fill="#8fb874" ${INK} stroke-width=".9"/>`;
  s += shadow(26, 40) + box(26, 40, 32, '#efe2c8', '#d6c3a0', null);
  s += poly('22,59 70,59 84,49 46,30 36,30', '#c4704f') + poly('70,59 84,49 46,30', '#a85638');
  for (let k = 0; k < 3; k++) s += rect(30 + k * 12, 64, 6, 9, '#bcd6e8', .7);
  s += rect(42, 78, 8, 12, '#6b4a3a', .7);
  return s;
}
const DRAW = { han, pasaj, yali, kosk };
export function specialSvg(id) { return (DRAW[id] || han)(); }
