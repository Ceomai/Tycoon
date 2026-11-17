/* =========================================================
   KİRACI PORTRELERİ · PARAMETRİK — Rıfkı Abi'nin çizgi film dili (rifkiFace.ts): büyük yuvarlak kafa (r37), iri gözler,
   mürekkep çizgi #1e3a32, yanak allığı, sabit karakter renkleri (yüz bir "çıkartma" gibi iki temada aynı), kart dolgusu
   temaya uyar (var(--rk-card)). 90 karakterin her biri kendi parametreleriyle (game/tenantChars.data.ts look):
   s ten (0–7) · h saç rengi · hs saç biçimi · c giysi · a aksesuarlar · g gözlük · b sakal/bıyık · e küpe · hat başlık · age.
   Aynı parametre → aynı SVG (rastgelelik yok). 3 hâl: bekliyor (düşünceli), yerleşti (kutlama), gidiyor (buruk).
   Kart viewBox 120×140 · rozet (arsa, defter, Rıfkı balonu) yalnız kafa: tenantBadge() viewBox 18 14 84 84.
   ========================================================= */
import type { FaceParams, TChar } from '../game/tenantChars';
import { charOfT, type Arch, type Tenant } from '../game/tenants';
export type TMood = 'wait' | 'happy' | 'bye';

export const SKINS = ['#f6dcc3', '#f1d3b0', '#e6c39a', '#d9ad85', '#c99a72', '#a8764f', '#8a5a3b', '#6b4329'];
const INK = '#1e3a32', WHITE = '#fbfbf7', CHEEK = '#e79a86', MOUTH = '#8e2f25', TONGUE = '#e8907f', GOLD = '#e0a21b', RED = '#c23b2e', GREEN = '#2f7a4f', BLUE = '#2d4f86';
const n = (v: number) => String(Math.round(v * 100) / 100);
const P = (d: string, fill = 'none', stroke = INK, sw = 1.6, extra = '') =>
  `<path d="${d}" fill="${fill}" stroke="${stroke}" stroke-width="${n(sw)}" stroke-linecap="round" stroke-linejoin="round"${extra}/>`;
const C = (cx: number, cy: number, r: number, fill: string, stroke = 'none', sw = 1.4, extra = '') =>
  `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r)}" fill="${fill}" stroke="${stroke}" stroke-width="${n(sw)}"${extra}/>`;
const R = (x: number, y: number, w: number, h: number, rx: number, fill: string, stroke = INK, sw = 1.3, extra = '') =>
  `<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" rx="${n(rx)}" fill="${fill}" stroke="${stroke}" stroke-width="${n(sw)}"${extra}/>`;
const G = (x: number, y: number, body: string, rot = 0, sc = 1) => `<g transform="translate(${n(x)} ${n(y)})${rot ? ` rotate(${rot})` : ''}${sc !== 1 ? ` scale(${sc})` : ''}">${body}</g>`;
/** Rengi koyulaştır / açar (gölge tonları için; k<1 koyu). */
function shade(hex: string, k: number): string {
  const v = parseInt(hex.slice(1), 16), f = (c: number) => Math.max(0, Math.min(255, Math.round(k < 1 ? c * k : c + (255 - c) * (k - 1))));
  return '#' + [f(v >> 16), f((v >> 8) & 255), f(v & 255)].map(c => c.toString(16).padStart(2, '0')).join('');
}
const light = (hex: string) => { const v = parseInt(hex.slice(1), 16); return (0.299 * (v >> 16) + 0.587 * ((v >> 8) & 255) + 0.114 * (v & 255)) > 150; };

/* ---------- yüz ifadeleri (tenantFace.ts ile aynı) ---------- */
function eyes(m: TMood, glasses: string | undefined, y = 58): string {
  let o = '';
  if (m === 'happy') { for (const x of [47, 73]) o += P(`M${x - 4} ${y + 1} Q${x} ${y - 4} ${x + 4} ${y + 1}`, 'none', INK, 2); }
  else for (const x of [47, 73]) {
    const dy = m === 'bye' ? 2 : 0, dx = m === 'wait' ? 1.5 : 0;
    o += `<ellipse cx="${x}" cy="${y}" rx="6.2" ry="${m === 'bye' ? 6.5 : 8}" fill="${WHITE}" stroke="${INK}" stroke-width="1.4"/>`;
    o += C(x + dx, y + dy, 3.6, INK) + C(x + dx + 1.2, y + dy - 1.4, 1.1, WHITE);
    if (m === 'bye') o += P(`M${x - 6.5} ${y - 3} Q${x} ${y - 7} ${x + 6.5} ${y - 3}`, 'none', INK, 1.4);
  }
  if (glasses === 'round') o += C(47, y, 10, 'none', INK, 1.8) + C(73, y, 10, 'none', INK, 1.8) + P(`M57 ${y} Q60 ${y - 3} 63 ${y}`, 'none', INK, 1.8);
  if (glasses === 'square') o += R(36, y - 8, 22, 16, 4, 'none', INK, 2) + R(62, y - 8, 22, 16, 4, 'none', INK, 2) + P(`M58 ${y - 1} L62 ${y - 1}`, 'none', INK, 2);
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
function extra(m: TMood): string {
  if (m === 'happy') return G(98, 22, P('M0 4 C-6 -4 -12 4 0 12 C12 4 6 -4 0 4 Z', RED, INK, 1.3));
  if (m === 'wait') return `<g transform="translate(96 16)"><rect x="-10" y="-8" width="22" height="14" rx="5" fill="var(--surface)" stroke="var(--ink)" stroke-width="1.3"/>${C(-4, -1, 1.5, 'var(--ink)')}${C(1, -1, 1.5, 'var(--ink)')}${C(6, -1, 1.5, 'var(--ink)')}</g>`;
  return P('M96 14 l0 8 M96 26 l0 .5', 'none', 'var(--muted)', 2.2);
}

/* ---------- saç: arka (kafadan önce) ve ön (kafadan sonra) ---------- */
function backHair(hs: string, h: string, covered: boolean): string {
  switch (hs) {
    case 'uzun': return P('M24 60 C20 30 44 16 62 18 C84 18 100 34 96 64 L98 96 C92 100 86 98 84 92 L86 60 Z M24 60 L22 96 C28 100 34 98 36 92 L34 60 Z', h, INK, 1.5);
    case 'topuz': return (covered ? '' : C(60, 18, 11, h, INK, 1.5)) + P('M22 66 C18 34 40 20 60 20 C82 20 102 34 98 66 Z', h, INK, 1.5);
    case 'atkuyrugu': return P('M88 34 C104 40 108 66 100 90 C98 96 92 96 92 90 C96 70 94 50 84 40 Z', h, INK, 1.5) + P('M22 66 C18 34 40 20 60 20 C82 20 102 34 98 66 Z', h, INK, 1.5);
    case 'bob': return P('M20 84 C14 36 38 18 60 18 C84 18 106 36 100 84 C96 90 88 90 86 84 L86 62 L34 62 L34 84 C32 90 24 90 20 84 Z', h, INK, 1.5);
    case 'kivircik': return [[30, 34, 13], [46, 22, 14], [64, 18, 15], [82, 24, 14], [94, 40, 12], [26, 52, 11], [98, 56, 10]].map(([x, y, r]) => C(x, y, r, h, INK, 1.5)).join('');
    case 'orgu': {
      let o = P('M22 66 C18 34 40 20 60 20 C82 20 102 34 98 66 Z', h, INK, 1.5);
      for (const x of [24, 96]) for (let j = 0; j < 4; j++) o += `<ellipse cx="${x}" cy="${76 + j * 9}" rx="5.5" ry="6" fill="${h}" stroke="${INK}" stroke-width="1.3"/>`;
      return o + C(24, 112, 2.6, RED, INK, 1) + C(96, 112, 2.6, RED, INK, 1);
    }
    default: return ''; // kisa, yan, kel
  }
}
function frontHair(hs: string, h: string): string {
  const hl = shade(h, light(h) ? 0.8 : 1.35);
  switch (hs) {
    case 'uzun': return P('M24 52 C26 30 46 20 62 22 C80 22 96 34 96 52 C88 42 76 36 66 40 C60 34 44 34 36 44 C32 46 28 50 24 52 Z', h, INK, 1.5);
    case 'topuz': case 'atkuyrugu': return P('M24 50 C28 30 48 24 62 26 C78 26 94 34 96 50 C86 38 72 34 60 36 C48 34 34 38 24 50 Z', h, INK, 1.5);
    case 'orgu': return P('M24 50 C28 28 46 22 60 24 C74 22 92 28 96 50 C88 38 72 32 61 36 L60 26 L59 36 C48 32 32 38 24 50 Z', h, INK, 1.5);
    case 'kisa': return P('M26 48 C26 30 44 22 60 22 C78 22 94 30 94 48 C88 42 82 40 76 42 L72 36 L66 42 L60 34 L54 42 L46 36 L42 44 C36 42 30 44 26 48 Z', h, INK, 1.5);
    case 'yan': return P('M24 54 C22 30 42 20 60 20 C80 20 98 30 96 54 C92 44 86 38 78 36 C66 34 50 40 40 34 C34 38 28 46 24 54 Z', h, INK, 1.5) + P('M40 34 C44 28 52 25 58 24', 'none', hl, 1.4);
    case 'bob': return P('M24 56 C24 30 42 22 60 22 C78 22 96 30 96 56 L90 46 L84 50 L78 44 L72 48 L66 43 L60 47 L54 43 L48 48 L42 44 L36 50 L30 46 Z', h, INK, 1.5);
    case 'kivircik': return [[36, 34, 8], [48, 28, 8.5], [61, 26, 8.5], [74, 28, 8.5], [86, 34, 8]].map(([x, y, r]) => C(x, y, r, h, INK, 1.4)).join('') + P('M40 30 q3 -3 6 0 M66 26 q3 -3 6 0', 'none', hl, 1.2);
    case 'kel': return P('M24 66 C22 56 24 48 28 44 C30 52 30 58 32 64 Z M96 66 C98 56 96 48 92 44 C90 52 90 58 88 64 Z', h, INK, 1.3) + P('M44 30 Q52 26 58 27', 'none', WHITE, 3, ' opacity=".55"');
    default: return '';
  }
}

/* ---------- başlıklar ---------- */
function hatBack(hat: string | undefined, c: string): string {
  if (hat === 'tulbent2') return P('M16 70 C10 26 40 12 60 12 C80 12 110 26 104 70 C102 92 96 104 94 116 L26 116 C24 104 18 92 16 70 Z', shade(c, 1.25), INK, 1.6);
  if (hat === 'tulbent') return P('M92 76 C100 86 104 96 98 104 C94 96 90 92 84 88 Z M92 76 C100 80 108 84 108 94 C102 92 96 88 90 86 Z', '#e9d9b8', INK, 1.4);
  return '';
}
function hatFront(hat: string | undefined, c: string): string {
  switch (hat) {
    case 'kaptan': return P('M24 42 C24 24 44 16 60 16 C76 16 96 24 96 42 Z', WHITE, INK, 1.6) + P('M24 42 L96 42 L96 48 L24 48 Z', INK, INK, 1.2)
      + P('M30 48 C44 56 76 56 90 48 Z', '#2a3440', INK, 1.4) + C(60, 32, 3.6, GOLD, INK, 1.1);
    case 'kasket': return P('M22 44 C22 22 46 14 62 14 C82 14 100 24 98 42 Z', '#6b6f75', INK, 1.6) + P('M62 42 C76 40 92 40 104 46 C96 50 80 50 64 48 Z', '#55595e', INK, 1.6)
      + P('M40 22 L44 40 M58 16 L58 40', 'none', '#55595e', 1.2);
    case 'sapka': return `<ellipse cx="60" cy="38" rx="52" ry="9" fill="#e8cf8f" stroke="${INK}" stroke-width="1.6"/>` + P('M32 38 C32 16 46 10 60 10 C74 10 88 16 88 38 Z', '#e8cf8f', INK, 1.6)
      + P('M33 32 C46 36 74 36 87 32 L87 37 C74 41 46 41 33 37 Z', RED, INK, 1.1);
    case 'sapka2': return `<ellipse cx="60" cy="36" rx="38" ry="6" fill="#3a3330" stroke="${INK}" stroke-width="1.6"/>` + P('M36 36 C36 18 46 14 60 14 C74 14 84 18 84 36 Z', '#3a3330', INK, 1.6)
      + P('M37 28 L83 28 L83 33 L37 33 Z', GOLD, INK, 1);
    case 'kep': return P('M24 46 C22 22 44 14 60 14 C78 14 98 22 96 46 Z', c, INK, 1.6) + P('M24 44 C14 44 6 48 4 52 C14 54 26 52 34 48 Z', shade(c, 0.75), INK, 1.5)
      + C(60, 15, 2.4, shade(c, 0.75), INK, 1) + P('M60 16 L60 44', 'none', shade(c, 0.75), 1.1);
    case 'yunbere': return P('M22 46 C20 22 42 12 60 12 C78 12 100 22 98 46 Z', c, INK, 1.6) + R(20, 40, 80, 10, 5, shade(c, 0.8), INK, 1.5)
      + [28, 36, 44, 52, 60, 68, 76, 84, 92].map(x => P(`M${x} 41 L${x} 49`, 'none', shade(c, 0.6), 1)).join('') + C(60, 10, 6, shade(c, 1.3), INK, 1.4);
    case 'bandana': return P('M24 44 C40 36 80 36 96 44 L96 52 C80 44 40 44 24 52 Z', '#2d4f86', INK, 1.4) + P('M96 46 L106 40 L104 50 Z M96 48 L106 56 L100 58 Z', '#2d4f86', INK, 1.2)
      + P('M34 46 L40 44 M52 42 L58 42 M70 42 L76 43', 'none', WHITE, 1.2);
    case 'tulbent': return P('M22 62 C18 30 42 16 60 16 C80 16 102 30 98 62 C96 52 92 44 84 40 C70 34 50 34 36 40 C28 44 24 52 22 62 Z', '#e9d9b8', INK, 1.5)
      + P('M34 26 l3 3 M48 20 l3 3 M66 20 l3 3 M80 26 l3 3 M40 34 l3 3 M74 33 l3 3', 'none', RED, 1.6);
    case 'tulbent2': return P('M60 20 C34 20 20 38 20 62 C20 90 36 108 60 108 C84 108 100 90 100 62 C100 38 86 20 60 20 Z M60 30 C42 30 30 44 30 62 C30 84 42 98 60 98 C78 98 90 84 90 62 C90 44 78 30 60 30 Z',
      shade(c, 1.25), INK, 1.6, ' fill-rule="evenodd"');
    case 'asci': return [[42, 18, 12], [60, 12, 14], [78, 18, 12]].map(([x, y, r]) => C(x, y, r, WHITE, INK, 1.5)).join('') + R(32, 22, 56, 20, 4, WHITE, INK, 1.5) + P('M44 26 L44 40 M60 26 L60 40 M76 26 L76 40', 'none', '#d0d4cc', 1.2);
    case 'kask': { const k = c === '#e0a21b' ? '#f2c230' : c; return P('M20 50 C18 22 42 12 60 12 C78 12 102 22 100 50 Z', k, INK, 1.7) + P('M14 50 L106 50 L104 55 L16 55 Z', shade(k, 0.8), INK, 1.4) + P('M60 13 L60 48 M44 16 L48 48 M76 16 L72 48', 'none', shade(k, 0.75), 1.4); }
    default: return '';
  }
}

/* ---------- yüz üstü: sakal, kırışıklık, küpe ---------- */
function facial(p: FaceParams): string {
  const h = p.h; let o = '';
  if (p.b === 'keci') o += P('M54 90 Q60 100 66 90 Q60 94 54 90 Z', h, INK, 1.2);
  if (p.b === 'kirli') o += P('M40 80 Q60 98 80 80', 'none', shade(h, 1.4), 1.4, ' stroke-dasharray="1.2 2.4"');
  if (p.b === 'kir') o += P('M30 74 C32 96 46 104 60 104 C74 104 88 96 90 74 C84 84 76 88 60 88 C44 88 36 84 30 74 Z', h, INK, 1.4);
  if (p.b === 'biyik') o += P('M48 77 C52 72 58 73 60 75 C62 73 68 72 72 77 C66 79 62 78 60 77 C58 78 54 79 48 77 Z', h, INK, 1.2);
  if (p.age === 'yasli') o += P('M33 70 q3 3 6 1 M81 71 q3 2 6 -1 M54 38 q6 -2 12 0', 'none', shade(SKINS[p.s] || SKINS[1], 0.8), 1.2);
  if (p.e) o += C(22, 72, 2.6, GOLD, INK, 1);
  return o;
}

/* ---------- giysi ve aksesuarlar (yuvalar: L sol alt · R sağ alt · C göğüs · N boyun · H baş) ---------- */
type Slot = 'L' | 'R' | 'C' | 'N' | 'H';
const ACC: Record<string, { s: Slot[]; d: (x: number, p: FaceParams) => string }> = {
  kulaklik: { s: ['N'], d: () => P('M40 112 C40 100 34 94 30 92 M80 112 C80 100 86 94 90 92', 'none', INK, 3) + R(24, 96, 10, 14, 4, RED, INK, 1.4) + R(86, 96, 10, 14, 4, RED, INK, 1.4) },
  inci: { s: ['N'], d: () => [44, 52, 60, 68, 76].map((x, j) => C(x, 112 + (j === 0 || j === 4 ? -2 : j === 2 ? 3 : 1), 2.4, WHITE, INK, .9)).join('') },
  atki: { s: ['N'], d: (_x, p) => { const k = p.c === RED ? GOLD : RED; return P('M36 108 C46 116 74 116 84 108 L86 114 C74 122 46 122 34 114 Z', k, INK, 1.4) + P('M70 116 L74 136 L82 134 L78 114 Z', k, INK, 1.3) + P('M73 128 L81 126 M72 122 L79 121', 'none', shade(k, 0.75), 1.4); } },
  kravat: { s: ['C'], d: () => P('M56 110 L64 110 L62 115 L58 115 Z', RED, INK, 1.2) + P('M58 115 L62 115 L65 132 L60 138 L55 132 Z', RED, INK, 1.2) },
  papyon: { s: ['C'], d: () => P('M60 113 L50 108 L50 118 Z M60 113 L70 108 L70 118 Z', RED, INK, 1.2) + C(60, 113, 2.2, shade(RED, 0.75), INK, 1) },
  yaka: { s: ['C'], d: () => P('M48 109 L58 126 M72 109 L62 126', 'none', BLUE, 1.6) + R(53, 124, 14, 12, 2, WHITE, INK, 1.2) + P('M56 129 L64 129 M56 132 L62 132', 'none', INK, 1) },
  onluk: { s: ['C'], d: () => P('M42 112 L42 139 L78 139 L78 112 Z', '#f4efe6', INK, 1.4) + P('M42 114 C46 108 74 108 78 114', 'none', INK, 1.4) + R(52, 122, 16, 10, 2, 'none', INK, 1.3) },
  kamera: { s: ['C'], d: () => P('M44 108 L54 122 M76 108 L66 122', 'none', INK, 1.6) + R(48, 120, 24, 15, 3, '#2a3440', INK, 1.4) + C(60, 127.5, 5, '#55595e', INK, 1.3) + C(60, 127.5, 2.2, '#9fc3d8') + R(66, 117, 5, 3, 1, '#2a3440', INK, 1) },
  durbun: { s: ['C'], d: () => P('M44 108 L52 122 M76 108 L68 122', 'none', INK, 1.6) + R(48, 120, 10, 16, 4, '#2a3440', INK, 1.3) + R(62, 120, 10, 16, 4, '#2a3440', INK, 1.3) + R(57, 124, 6, 6, 1, '#55595e', INK, 1) },
  laptop: { s: ['C'], d: () => P('M38 126 L82 126 L88 138 L32 138 Z', '#b7bcb5', INK, 1.4) + R(42, 112, 36, 16, 2, '#55595e', INK, 1.3) + C(60, 120, 2.4, WHITE, 'none', 1, ' opacity=".7"') },
  kitap: { s: ['L', 'R'], d: x => G(x, 124, R(-9, -10, 18, 22, 2, '#2f7a4f', INK, 1.3) + P('M-5 -10 L-5 12', 'none', INK, 1.2) + P('M-1 -4 L6 -4 M-1 0 L6 0', 'none', WHITE, 1.1), -10) },
  firca: { s: ['R', 'L'], d: x => G(x, 122, P('M0 14 L0 -6', 'none', '#8a5a3b', 3.4) + R(-2.6, -10, 5.2, 6, 1, '#b7bcb5', INK, 1) + P('M-2.6 -10 Q0 -20 2.6 -10 Z', RED, INK, 1.1), 18) },
  palet: { s: ['L'], d: x => G(x, 128, `<ellipse cx="0" cy="0" rx="10" ry="7" fill="${GOLD}" stroke="${INK}" stroke-width="1.2"/>` + C(-4, -2, 1.6, RED) + C(1, -3, 1.6, GREEN) + C(5, 0, 1.6, BLUE) + C(-1, 3, 1.8, 'var(--rk-card)', INK, .8)) },
  gitar: { s: ['R'], d: x => G(x, 124, P('M-2 -4 L14 -30', 'none', '#6b4329', 3.4) + C(0, 4, 9, '#c98a3b', INK, 1.4) + C(-3, -4, 7, '#c98a3b', INK, 1.4) + C(-1, 1, 2.6, INK), 0) },
  saksafon: { s: ['R'], d: x => G(x, 120, P('M-2 -18 C-2 -6 0 4 6 10 C10 14 14 12 14 6', 'none', GOLD, 5) + P('M-2 -18 C-2 -6 0 4 6 10 C10 14 14 12 14 6', 'none', INK, .9, ' opacity=".6"') + C(14, 4, 4.6, GOLD, INK, 1.2) + P('M-4 -20 L2 -22', 'none', INK, 2)) },
  keman: { s: ['L'], d: x => G(x, 122, `<ellipse cx="0" cy="4" rx="7" ry="10" fill="#a4482a" stroke="${INK}" stroke-width="1.3"/>` + P('M0 -6 L0 -18', 'none', INK, 2.4) + P('M-2.5 2 L-2.5 6 M2.5 2 L2.5 6', 'none', INK, 1) + P('M-12 -10 L14 16', 'none', '#8a5a3b', 1.4), -20) },
  kahve: { s: ['R', 'L'], d: x => G(x, 126, R(-6, -6, 12, 13, 2, WHITE, INK, 1.3) + P('M6 -3 C10 -3 10 4 6 4', 'none', INK, 1.3) + R(-6, -2, 12, 4, 0, '#8a5a3b', 'none') + P('M-2 -9 q-2 -3 0 -6 M3 -9 q-2 -3 0 -6', 'none', 'var(--muted)', 1.2)) },
  cay: { s: ['R', 'L'], d: x => G(x, 128, `<ellipse cx="0" cy="6" rx="10" ry="2.6" fill="${WHITE}" stroke="${INK}" stroke-width="1.2"/>` + P('M-6 -6 L6 -6 L4 5 L-4 5 Z', '#b0563c', INK, 1.2) + P('M-2 -9 q-2 -3 0 -6 M3 -9 q-2 -3 0 -6', 'none', 'var(--muted)', 1.2)) },
  cicek: { s: ['L', 'R'], d: x => G(x, 124, P('M0 14 L0 -2 M0 6 Q5 2 8 4', 'none', GREEN, 1.8) + [0, 72, 144, 216, 288].map(a => `<ellipse cx="0" cy="-7" rx="3" ry="4.4" fill="${RED}" stroke="${INK}" stroke-width=".9" transform="rotate(${a} 0 -3)"/>`).join('') + C(0, -3, 2.2, GOLD, INK, .8)) },
  sprey: { s: ['R'], d: x => G(x, 124, R(-5, -8, 10, 20, 2, '#d46a9a', INK, 1.3) + R(-2.5, -12, 5, 4, 1, WHITE, INK, 1) + P('M4 -14 l4 -2 M5 -11 l5 0 M4 -8 l4 2', 'none', '#d46a9a', 1.3), 12) },
  anahtar: { s: ['R', 'L'], d: x => G(x, 124, P('M0 14 L0 -4', 'none', '#8f8a84', 4) + P('M-5 -6 C-6 -14 6 -14 5 -6 L2 -8 L2 -4 L-2 -4 L-2 -8 Z', '#8f8a84', INK, 1.1), -24) },
  kukla: { s: ['L'], d: x => G(x, 124, P('M-7 14 L7 14 L5 4 L-5 4 Z', RED, INK, 1.1) + C(0, -2, 6.5, '#fbf3ea', INK, 1.2) + P('M-7 -2 C-8 -12 8 -12 7 -2 C4 -7 -4 -7 -7 -2 Z', INK, INK, 1) + C(-2.2, -1, .9, INK) + C(2.2, -1, .9, INK) + P('M-1 3 q1 1 2 0', 'none', RED, 1)) },
  yelpaze: { s: ['R'], d: x => G(x, 124, P('M0 8 L-12 -8 A15 15 0 0 1 12 -8 Z', '#f4efe6', INK, 1.2) + P('M0 8 L-6 -12 M0 8 L0 -13 M0 8 L6 -12', 'none', INK, .8) + P('M-9 -5 A11 11 0 0 1 9 -5', 'none', RED, 2)) },
  lup: { s: ['H'], d: () => C(73, 58, 9.5, 'none', GOLD, 2.4) + C(73, 58, 9.5, 'none', INK, .8) + P('M82 62 C88 72 86 88 80 100', 'none', GOLD, 1) },
  kalem: { s: ['H'], d: () => G(100, 54, R(-2, -14, 4, 22, 1, GOLD, INK, 1.1) + P('M-2 8 L0 13 L2 8 Z', '#f1d3b0', INK, .9), 18) },
  nota: { s: ['H'], d: () => G(14, 26, C(0, 8, 3, INK) + P('M3 8 L3 -6 L9 -8 L9 5', 'none', INK, 1.4) + C(6.5, 5, 2.6, INK)) },
};
function child(p: FaceParams, x: number): string {
  const sk = SKINS[p.s] || SKINS[1], hair = p.hs === 'kel' || /^#(d8dcd6|8f8a84)$/i.test(p.h) ? '#4a3426' : p.h;
  return C(x, 116, 13, sk, INK, 1.5) + P(`M${x - 12} 112 C${x - 10} 100 ${x + 8} 98 ${x + 12} 112 C${x + 6} 106 ${x - 4} 106 ${x - 12} 112 Z`, hair, INK, 1.3)
    + C(x - 4, 117, 1.6, INK) + C(x + 4, 117, 1.6, INK) + P(`M${x - 3} 122 Q${x} 125 ${x + 3} 122`, 'none', INK, 1.4) + C(x - 7, 121, 2.4, CHEEK, 'none', 1, ' opacity=".5"');
}
function body(p: FaceParams): { under: string; over: string } {
  const coat = p.c, lapel = light(coat) ? shade(coat, 0.82) : shade(coat, 1.25);
  let under = P('M30 139 C32 116 44 108 60 108 C76 108 88 116 90 139 Z', coat, INK, 1.6) + P('M52 109 L60 118 L68 109', 'none', lapel, 1.6);
  let over = '';
  const used = new Set<Slot>(); const acc = [...(p.a || [])];
  const kid = acc.includes('cocuk'); if (kid) { used.add('R'); over += child(p, 92); }
  for (const id of acc) {
    if (id === 'cocuk') continue; const a = ACC[id]; if (!a) continue;
    const s = a.s.find(x => !used.has(x) || x === 'H' || x === 'N') || a.s[0];
    if (s !== 'H' && s !== 'N') used.add(s);
    const d = a.d(s === 'L' ? 26 : 94, p);
    if (s === 'C' || s === 'N') under += d; else over += d;
  }
  return { under, over };
}

function head(p: FaceParams, m: TMood): string {
  const sk = SKINS[p.s] ?? SKINS[1], hijab = p.hat === 'tulbent2', covered = !!p.hat && p.hat !== 'bandana';
  const b = body(p);
  let o = hatBack(p.hat, p.c) + b.under + (hijab ? '' : backHair(p.hs, p.h, covered));
  if (!hijab) o += C(22, 64, 6.5, sk, INK, 1.5) + C(98, 64, 6.5, sk, INK, 1.5);
  o += C(60, 60, 37, sk, INK, 1.8) + P('M32 42 Q37 30 46 27', 'none', WHITE, 4, ' opacity=".55"');
  o += facial(p);
  if (!hijab && !(covered && p.hs === 'kel')) o += frontHair(p.hs, p.h);
  o += hatFront(p.hat, p.c);
  const grey = /^#(d8dcd6|8f8a84)$/i.test(p.h) ? '#8a928b' : INK;
  o += brows(m, grey) + eyes(m, p.g) + nose() + mouth(m);
  o += C(36, 76, 5, CHEEK, 'none', 1, ' opacity=".42"') + C(84, 76, 5, CHEEK, 'none', 1, ' opacity=".42"');
  return o + b.over + (p.a || []).filter(id => ACC[id] && ACC[id].s[0] === 'H').map(id => ACC[id].d(0, p)).join('');
}
/** Kart portresi (viewBox 120×140). id: karakter kimliği (data-c; kırpma yolu kimliği). */
export function tenantFace(p: FaceParams, m: TMood = 'wait', bg = true, id = ''): string {
  let o = `<svg class="tn-svg" viewBox="0 0 120 140" aria-hidden="true"${id ? ` data-c="${id}"` : ''} data-m="${m}">`;
  if (bg) o += `<rect x="1" y="1" width="118" height="138" rx="12" fill="var(--rk-card)" stroke="var(--ink)" stroke-width="1.4"/>`;
  o += `<defs><clipPath id="cl${id.replace('.', '')}"><rect x="1" y="1" width="118" height="138" rx="12"/></clipPath></defs><g clip-path="url(#cl${id.replace('.', '')})">` + head(p, m) + '</g>' + extra(m);
  return o + '</svg>';
}
/** Arsa / defter / Rıfkı balonu rozeti: yalnız kafa. */
export function tenantBadge(p: FaceParams, m: TMood = 'wait', id = ''): string {
  return `<svg viewBox="18 14 84 84" aria-hidden="true"${id ? ` data-c="${id}"` : ''}>${head(p, m)}</svg>`;
}

/* ---------- karakteri olmayan kiracı (yalnız simülasyon / deneme: charOpts.off): eski 6 tip portresinin parametrik eşdeğeri ---------- */
export const LEGACY_LOOK: Record<Arch, FaceParams> = {
  ogrenci: { s: 1, h: '#4a3426', hs: 'uzun', c: '#e0a21b', a: ['kulaklik'], age: 'genc' },
  aile: { s: 2, h: '#8a4b2a', hs: 'topuz', c: '#4f8a63', a: ['cocuk'], e: 1, age: 'orta' },
  sanatci: { s: 3, h: '#2b2622', hs: 'kisa', c: '#f4efe6', a: ['palet'], b: 'keci', age: 'genc' },
  yazilimci: { s: 4, h: '#1f1d1c', hs: 'kisa', c: '#3a4656', a: [], g: 'square', b: 'kirli', age: 'genc' },
  emekli: { s: 0, h: '#d8dcd6', hs: 'topuz', c: '#7d5a9a', a: ['inci'], g: 'round', age: 'yasli' },
  esnaf: { s: 3, h: '#8f8a84', hs: 'kel', c: '#7a5537', a: ['onluk'], b: 'kir', hat: 'kasket', age: 'orta' },
};
/** Karakterin portre parametreleri (karakter yoksa tipin eski görünümü). */
export const lookOf = (a: Arch, ch: TChar | null | undefined): FaceParams => (ch ? ch.look : LEGACY_LOOK[a]);
/** Kiracının portre parametreleri ve kimliği. */
export function tenantLook(x: Tenant): { p: FaceParams; id: string } { const ch = charOfT(x); return { p: lookOf(x.a, ch), id: ch ? ch.id : x.a }; }
