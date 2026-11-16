/* =========================================================
   KİRACI PORTRELERİ — Rıfkı Abi'nin çizgi film dilinde (rifkiFace.ts): büyük yuvarlak kafa, iri gözler, mürekkep çizgi,
   yanak allığı, karakter renkleri sabit (yüz bir "çıkartma" gibi iki temada aynı), kart dolgusu temaya uyar.
   6 tip: öğrenci, aile, sanatçı, yazılımcı, emekli, esnaf. 3 hâl: bekliyor (düşünceli), yerleşti (kutlama), gidiyor (buruk).
   viewBox 120×140 (kart) · rozet için yalnız kafa: tenantBadge() viewBox 14 12 92 92.
   ========================================================= */
import type { Arch } from '../game/tenants';
export type { Arch };
export type TMood = 'wait' | 'happy' | 'bye';

const INK = '#1e3a32', WHITE = '#fbfbf7', CHEEK = '#e79a86', MOUTH = '#8e2f25', TONGUE = '#e8907f', GOLD = '#e0a21b', RED = '#c23b2e', GREEN = '#2f7a4f';
const n = (v: number) => String(Math.round(v * 100) / 100);
const P = (d: string, fill = 'none', stroke = INK, sw = 1.6, extra = '') =>
  `<path d="${d}" fill="${fill}" stroke="${stroke}" stroke-width="${n(sw)}" stroke-linecap="round" stroke-linejoin="round"${extra}/>`;
const C = (cx: number, cy: number, r: number, fill: string, stroke = 'none', sw = 1.4, extra = '') =>
  `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r)}" fill="${fill}" stroke="${stroke}" stroke-width="${n(sw)}"${extra}/>`;

interface Look { skin: string; hair: string; coat: string; age: 'genc' | 'orta' | 'yasli' }
export const LOOK: Record<Arch, Look> = {
  ogrenci: { skin: '#f1d3b0', hair: '#4a3426', coat: '#e0a21b', age: 'genc' },
  aile: { skin: '#e6c39a', hair: '#8a4b2a', coat: '#4f8a63', age: 'orta' },
  sanatci: { skin: '#d9ad85', hair: '#2b2622', coat: '#f4efe6', age: 'genc' },
  yazilimci: { skin: '#c99a72', hair: '#1f1d1c', coat: '#3a4656', age: 'genc' },
  emekli: { skin: '#f0d6bb', hair: '#d8dcd6', coat: '#7d5a9a', age: 'yasli' },
  esnaf: { skin: '#dcb48c', hair: '#8f8a84', coat: '#7a5537', age: 'orta' },
};

function eyes(m: TMood, glasses: '' | 'round' | 'square', y = 58): string {
  let o = '';
  if (m === 'happy') { for (const x of [47, 73]) o += P(`M${x - 4} ${y + 1} Q${x} ${y - 4} ${x + 4} ${y + 1}`, 'none', INK, 2); }
  else for (const x of [47, 73]) {
    const dy = m === 'bye' ? 2 : 0, dx = m === 'wait' ? 1.5 : 0;
    o += `<ellipse cx="${x}" cy="${y}" rx="6.2" ry="${m === 'bye' ? 6.5 : 8}" fill="${WHITE}" stroke="${INK}" stroke-width="1.4"/>`;
    o += C(x + dx, y + dy, 3.6, INK) + C(x + dx + 1.2, y + dy - 1.4, 1.1, WHITE);
    if (m === 'bye') o += P(`M${x - 6.5} ${y - 3} Q${x} ${y - 7} ${x + 6.5} ${y - 3}`, 'none', INK, 1.4); // yarı kapalı kapak
  }
  if (glasses === 'round') o += C(47, y, 10, 'none', INK, 1.8) + C(73, y, 10, 'none', INK, 1.8) + P(`M57 ${y} Q60 ${y - 3} 63 ${y}`, 'none', INK, 1.8);
  if (glasses === 'square') o += `<rect x="36" y="${y - 8}" width="22" height="16" rx="4" fill="none" stroke="${INK}" stroke-width="2"/><rect x="62" y="${y - 8}" width="22" height="16" rx="4" fill="none" stroke="${INK}" stroke-width="2"/>` + P(`M58 ${y - 1} L62 ${y - 1}`, 'none', INK, 2);
  return o;
}
function brows(m: TMood, col: string, y = 44): string {
  const lift = m === 'wait' ? [0, -3] : m === 'bye' ? [2, 2] : [-1, -1];
  const b = (x: number, dy: number, tilt: number) => P(`M${x - 5} ${y + dy + tilt} Q${x} ${y + dy - 3} ${x + 5} ${y + dy - tilt}`, 'none', col, 2.6);
  return b(47, lift[0], m === 'bye' ? 2 : 0) + b(73, lift[1], m === 'bye' ? -2 : 0);
}
function mouth(m: TMood, y = 82): string {
  if (m === 'happy') return P(`M51 ${y - 1} Q60 ${y + 11} 69 ${y - 1} Z`, MOUTH, INK, 1.5) + P(`M55 ${y + 4} Q60 ${y + 2} 65 ${y + 4}`, 'none', TONGUE, 1.6);
  if (m === 'bye') return P(`M54 ${y + 3} Q60 ${y} 66 ${y + 3}`, 'none', INK, 2);
  return P(`M53 ${y} Q60 ${y + 4} 67 ${y}`, 'none', INK, 2);
}
const nose = () => P('M60 64 Q56 72 61 73', 'none', INK, 1.5);

/* ---------- kişiye özgü parçalar: arka saç (kafadan önce), ön saç / şapka (kafadan sonra), giysi ---------- */
function backHair(a: Arch, L: Look): string {
  switch (a) {
    case 'ogrenci': return P('M24 60 C20 30 44 16 62 18 C84 18 100 34 96 64 L98 96 C92 100 86 98 84 92 L86 60 Z M24 60 L22 96 C28 100 34 98 36 92 L34 60 Z', L.hair, INK, 1.5);
    case 'aile': return C(60, 18, 11, L.hair, INK, 1.5) + P('M22 66 C18 34 40 20 60 20 C82 20 102 34 98 66 Z', L.hair, INK, 1.5);
    case 'emekli': return C(60, 17, 12, L.hair, INK, 1.5) + P('M22 66 C18 34 40 20 60 20 C82 20 102 34 98 66 Z', L.hair, INK, 1.5);
    default: return '';
  }
}
function frontHair(a: Arch, L: Look): string {
  switch (a) {
    case 'ogrenci': return P('M24 52 C26 30 46 20 62 22 C80 22 96 34 96 52 C88 42 76 36 66 40 C60 34 44 34 36 44 C32 46 28 50 24 52 Z', L.hair, INK, 1.5); // perçem
    case 'aile': return P('M24 50 C28 30 48 24 62 26 C78 26 94 34 96 50 C86 38 72 34 60 36 C48 34 34 38 24 50 Z', L.hair, INK, 1.5);
    case 'emekli': return P('M24 50 C28 30 48 24 62 26 C78 26 94 34 96 50 C90 40 80 36 70 38 C66 34 56 34 50 38 C40 36 30 42 24 50 Z', L.hair, INK, 1.5)
      + P('M34 44 q4 -4 8 0 M52 38 q4 -4 8 0 M74 40 q4 -4 8 0', 'none', '#b7bcb5', 1.2);
    case 'sanatci': // bere (kırmızı) + kısa saç
      return P('M22 42 C24 22 48 12 66 14 C88 16 102 28 98 42 C84 36 40 34 22 42 Z', RED, INK, 1.6) + C(74, 13, 3.4, RED, INK, 1.4)
        + P('M24 46 C30 42 38 40 44 42', 'none', L.hair, 4);
    case 'yazilimci': // kısa dağınık saç + kapüşon kenarı
      return P('M20 66 C14 30 40 10 62 12 C86 12 108 32 100 68', 'none', L.coat, 7) + P('M20 66 C14 30 40 10 62 12 C86 12 108 32 100 68', 'none', INK, 1.4, ' opacity=".9"')
        + P('M26 48 C26 30 44 22 60 22 C78 22 94 30 94 48 C88 42 82 40 76 42 L72 36 L66 42 L60 34 L54 42 L46 36 L42 44 C36 42 30 44 26 48 Z', L.hair, INK, 1.5);
    case 'esnaf': // kasket
      return P('M22 44 C22 22 46 14 62 14 C82 14 100 24 98 42 Z', '#6b6f75', INK, 1.6) + P('M62 42 C76 40 92 40 104 46 C96 50 80 50 64 48 Z', '#55595e', INK, 1.6)
        + P('M40 22 L44 40 M58 16 L58 40', 'none', '#55595e', 1.2);
    default: return '';
  }
}
function clothes(a: Arch, L: Look): string {
  const body = P('M30 139 C32 116 44 108 60 108 C76 108 88 116 90 139 Z', L.coat, INK, 1.6);
  switch (a) {
    case 'ogrenci': return body + P('M40 112 C40 100 34 94 30 92 M80 112 C80 100 86 94 90 92', 'none', INK, 3) // kulaklık bandı boyunda
      + `<rect x="24" y="96" width="10" height="14" rx="4" fill="${RED}" stroke="${INK}" stroke-width="1.4"/><rect x="86" y="96" width="10" height="14" rx="4" fill="${RED}" stroke="${INK}" stroke-width="1.4"/>`;
    case 'aile': return body + P('M52 110 L60 124 L68 110', 'none', INK, 1.4) + C(60, 120, 1.6, WHITE, INK, 1)
      + C(90, 116, 13, '#f1d3b0', INK, 1.5) + P('M78 112 C80 100 98 98 102 112 C96 106 86 106 78 112 Z', '#8a4b2a', INK, 1.3) // çocuk kafası
      + C(86, 117, 1.6, INK) + C(94, 117, 1.6, INK) + P('M87 122 Q90 125 93 122', 'none', INK, 1.4) + C(83, 121, 2.4, CHEEK, 'none', 1, ' opacity=".5"');
    case 'sanatci': return body + P('M34 122 L86 122 M32 132 L88 132', 'none', '#2d4f86', 3) + P('M54 108 L60 116 L66 108', 'none', INK, 1.3)
      + C(28, 128, 6, GOLD, INK, 1.2) + C(26, 126, 1.4, RED) + C(30, 129, 1.4, GREEN); // palet
    case 'yazilimci': return body + P('M54 110 L54 126 M66 110 L66 126', 'none', WHITE, 1.8) + C(54, 127, 1.6, WHITE) + C(66, 127, 1.6, WHITE)
      + P('M44 130 L76 130', 'none', '#2a3440', 4);
    case 'emekli': return body + [44, 52, 60, 68, 76].map((x, j) => C(x, 112 + (j === 0 || j === 4 ? -2 : j === 2 ? 3 : 1), 2.4, WHITE, INK, .9)).join(''); // inci kolye
    case 'esnaf': return body + P('M42 112 L42 139 L78 139 L78 112 Z', '#f4efe6', INK, 1.4) + P('M42 114 C46 108 74 108 78 114', 'none', INK, 1.4)
      + `<rect x="52" y="122" width="16" height="10" rx="2" fill="none" stroke="${INK}" stroke-width="1.3"/>`; // önlük cebi
    default: return body;
  }
}
function face(a: Arch, L: Look): string { // yüz üstü ekler (sakal, kırışıklık, küpe)
  switch (a) {
    case 'sanatci': return P('M54 90 Q60 100 66 90 Q60 94 54 90 Z', L.hair, INK, 1.2); // keçi sakalı
    case 'yazilimci': return P('M40 80 Q60 98 80 80', 'none', '#7d6450', 1.4, ' stroke-dasharray="1.2 2.4"'); // hafif sakal
    case 'esnaf': return P('M30 74 C32 96 46 104 60 104 C74 104 88 96 90 74 C84 84 76 88 60 88 C44 88 36 84 30 74 Z', L.hair, INK, 1.4); // kısa kır sakal
    case 'emekli': return P('M33 70 q3 3 6 1 M81 71 q3 2 6 -1', 'none', '#c49a7d', 1.2);
    case 'aile': return C(22, 72, 2.6, GOLD, INK, 1);
    default: return '';
  }
}
function extra(m: TMood): string { // kartın üstünde (temaya uyar)
  if (m === 'happy') return `<g transform="translate(98 22)">${P('M0 4 C-6 -4 -12 4 0 12 C12 4 6 -4 0 4 Z', RED, INK, 1.3)}</g>`; // kalp
  if (m === 'wait') return `<g transform="translate(96 16)"><rect x="-10" y="-8" width="22" height="14" rx="5" fill="var(--surface)" stroke="var(--ink)" stroke-width="1.3"/>${C(-4, -1, 1.5, 'var(--ink)')}${C(1, -1, 1.5, 'var(--ink)')}${C(6, -1, 1.5, 'var(--ink)')}</g>`;
  return P('M96 14 l0 8 M96 26 l0 .5', 'none', 'var(--muted)', 2.2); // gidiyor: küçük bir nokta-çizgi, suçlayıcı değil
}

/** Kiracı portresi (kart). bg: tema kartı. */
export function tenantFace(a: Arch, m: TMood = 'wait', bg = true): string {
  const L = LOOK[a];
  let o = `<svg class="tn-svg" viewBox="0 0 120 140" aria-hidden="true" data-arch="${a}" data-m="${m}">`;
  if (bg) o += `<rect x="1" y="1" width="118" height="138" rx="12" fill="var(--rk-card)" stroke="var(--ink)" stroke-width="1.4"/>`;
  o += head(a, L, m) + extra(m);
  return o + '</svg>';
}
function head(a: Arch, L: Look, m: TMood): string {
  let o = clothes(a, L) + backHair(a, L);
  o += C(22, 64, 6.5, L.skin, INK, 1.5) + C(98, 64, 6.5, L.skin, INK, 1.5);
  o += C(60, 60, 37, L.skin, INK, 1.8) + P('M32 42 Q37 30 46 27', 'none', WHITE, 4, ' opacity=".55"');
  o += face(a, L) + frontHair(a, L);
  o += brows(m, a === 'emekli' ? '#9aa39b' : INK);
  o += eyes(m, a === 'emekli' ? 'round' : a === 'yazilimci' ? 'square' : '');
  o += nose() + mouth(m);
  o += C(36, 76, 5, CHEEK, 'none', 1, ' opacity=".42"') + C(84, 76, 5, CHEEK, 'none', 1, ' opacity=".42"');
  return o;
}
/** Arsa rozeti: yalnız kafa, daire içinde (CSS .tn). */
export function tenantBadge(a: Arch, m: TMood = 'wait'): string {
  return `<svg viewBox="18 18 84 84" aria-hidden="true">${head(a, LOOK[a], m)}</svg>`;
}
