/* =========================================================
   RIFKI ABİ'NİN YÜZÜ — "B · Çizgi film" yönü (büyük kafa, iri gözler, pala bıyık, papyon), 5 ifade.
   Kodla çizilen SVG (görsel dosyası yok). Kart dolgusu/kenarı ve kartın üstüne çizilen ekler (?, !, ışıltı) tema
   token'larıyla (--rk-card, --ink) koyu temaya uyar; ten, ceket, papyon, bıyık gibi karakter renkleri sabittir.
   Hareket: balon açılırken küçük zıplama (WAAPI, faceIn), boşta göz kırpma ve nefes (CSS, styles.css "7 · Rıfkı Abi").
   ========================================================= */
import { play, DUR, EASE } from './motion';

export type Mood = 'happy' | 'think' | 'warn' | 'party' | 'wow';
export const MOODS: readonly Mood[] = ['happy', 'think', 'warn', 'party', 'wow'];

/** İpucu kimliği → ifade. Burada olmayan her ipucu 'happy' (Memnun). Metin, sıklık, sıra ve yer rifki.ts'te; burası yalnız yüz. */
export const TIP_MOOD: Readonly<Record<string, Mood>> = {
  full: 'warn',       // kasa dolu: kira boşa akıyor
  save2x: 'think',    // tapu için para biriktirme / 2x önerisi
  kapora: 'think',
  goal: 'think',
  boost: 'think',
  pair: 'think',
  empty: 'think',
  task: 'party',
  deed: 'party',      // tapu alındı
  done: 'party',      // semt bitti (bütün arsalar dolu)      // ödül yakın: bir görev kaldı
  ozel: 'wow',        // haftanın özel tapusu
  ob: 'wow',          // hurdanın içinden ne çıkar
  ten: 'wow',         // kiracı adayı geldi (tanıtır)
  tennote: 'think',   // kiracı hâlâ bekliyor (hatırlatır)
  tenready: 'happy',  // istek oldu: anahtarı verin
  tenok: 'party',     // kiracı yerleşti (kutlar) · gidişte Rıfkı konuşmaz, kısa bildirim çıkar
  pjintro: 'wow',     // büyük projeler açıldı (bir kez tanıtır)
  pjnear: 'think',    // 2×2 blok projeye 1–2 kat uzak
  project: 'party',   // proje (ya da 2. etap) teslim
  pjlien: 'warn',     // kaporalı semtte ruhsat aranırsa
};
export const moodOf = (id: string): Mood => TIP_MOOD[id] || 'happy';

// karakter renkleri (iki temada aynı: yüz bir "çıkartma" gibi kendi çizgisiyle durur)
const INK = '#1e3a32', SKIN = '#efd8b3', CHEEK = '#e79a86', WHITE = '#fbfbf7', GREY = '#9aa39b', RED = '#c23b2e', GOLD = '#e0a21b';
const HAIR = '#c9cfc6', COAT = '#3d6b8a', NOSE = '#e8a77f', STACHE = '#5b4a3d', MOUTH = '#8e2f25', TONGUE = '#e8907f', GREEN = '#2f7a4f';
// kartın üstüne (ten/ceket dışına) çizilenler temaya uyar
const T_INK = 'var(--ink)';

const n = (v: number) => String(Math.round(v * 100) / 100);
const P = (d: string, fill = 'none', stroke = INK, sw = 1.6, extra = '') =>
  `<path d="${d}" fill="${fill}" stroke="${stroke}" stroke-width="${n(sw)}" stroke-linecap="round" stroke-linejoin="round"${extra}/>`;
const C = (cx: number, cy: number, r: number, fill: string, stroke = 'none', sw = 1.4, extra = '') =>
  `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r)}" fill="${fill}" stroke="${stroke}" stroke-width="${n(sw)}"${extra}/>`;

type Eyes = 'normal' | 'up' | 'stern' | 'wide' | 'closed';
type Brows = 'relaxed' | 'raise' | 'stern' | 'high';
type Mouth = 'smile' | 'flat' | 'frown' | 'grin' | 'o';
const PARTS: Record<Mood, [Eyes, Brows, Mouth]> = {
  happy: ['normal', 'relaxed', 'smile'],   // Memnun
  think: ['up', 'raise', 'flat'],          // Düşünceli
  warn: ['stern', 'stern', 'frown'],       // Uyarı
  party: ['closed', 'high', 'grin'],       // Kutlama
  wow: ['wide', 'high', 'o'],              // Şaşkın
};

function eyes(kind: Eyes, lx: number, rx: number, y: number): string {
  if (kind === 'closed') { // kapalı, gülen
    const arc = (x: number) => P(`M${n(x - 4)} ${n(y + 1)} Q${n(x)} ${n(y - 4)} ${n(x + 4)} ${n(y + 1)}`, 'none', INK, 2);
    return arc(lx) + arc(rx);
  }
  const [ex, ey, dx, dy] = ({ wide: [8, 10, 0, 0], up: [7, 9, 2, -3], normal: [7, 9, 0, 1], stern: [7, 8, 0, 1] } as const)[kind];
  let o = '';
  for (const x of [lx, rx]) {
    o += `<ellipse cx="${n(x)}" cy="${n(y)}" rx="${ex}" ry="${ey}" fill="${WHITE}" stroke="${INK}" stroke-width="1.4"/>`;
    o += C(x + dx, y + dy, kind !== 'wide' ? 4.2 : 3.2, INK) + C(x + dx + 1.4, y + dy - 1.6, 1.2, WHITE);
  }
  return o;
}
function brows(kind: Brows, L: number, R: number, y: number, s = 1.2, w = 2.8): string {
  const b = (d: string) => P(d, 'none', INK, w * s);
  switch (kind) {
    case 'relaxed': return b(`M${n(L - 5 * s)} ${n(y)} Q${n(L)} ${n(y - 2.5 * s)} ${n(L + 5 * s)} ${n(y)}`) + b(`M${n(R - 5 * s)} ${n(y)} Q${n(R)} ${n(y - 2.5 * s)} ${n(R + 5 * s)} ${n(y)}`);
    case 'raise': return b(`M${n(L - 5 * s)} ${n(y)} Q${n(L)} ${n(y - 2.5 * s)} ${n(L + 5 * s)} ${n(y)}`) + b(`M${n(R - 5 * s)} ${n(y - 3 * s)} Q${n(R)} ${n(y - 7 * s)} ${n(R + 5 * s)} ${n(y - 4 * s)}`);
    case 'stern': return b(`M${n(L - 5 * s)} ${n(y - 3 * s)} L${n(L + 5 * s)} ${n(y + 1 * s)}`) + b(`M${n(R + 5 * s)} ${n(y - 3 * s)} L${n(R - 5 * s)} ${n(y + 1 * s)}`);
    default: return b(`M${n(L - 5 * s)} ${n(y - 4 * s)} Q${n(L)} ${n(y - 8 * s)} ${n(L + 5 * s)} ${n(y - 4 * s)}`) + b(`M${n(R - 5 * s)} ${n(y - 4 * s)} Q${n(R)} ${n(y - 8 * s)} ${n(R + 5 * s)} ${n(y - 4 * s)}`);
  }
}
function mouth(kind: Mouth, cx: number, y: number, s = 1.2): string {
  switch (kind) {
    case 'smile': return P(`M${n(cx - 6 * s)} ${n(y)} Q${n(cx)} ${n(y + 5 * s)} ${n(cx + 6 * s)} ${n(y)}`, 'none', INK, 1.8 * s);
    case 'flat': return P(`M${n(cx - 4 * s)} ${n(y + s)} L${n(cx + 4 * s)} ${n(y + s)}`, 'none', INK, 1.8 * s);
    case 'frown': return P(`M${n(cx - 5 * s)} ${n(y + 3 * s)} Q${n(cx)} ${n(y - s)} ${n(cx + 5 * s)} ${n(y + 3 * s)}`, 'none', INK, 1.8 * s);
    case 'grin': return P(`M${n(cx - 8 * s)} ${n(y - s)} Q${n(cx)} ${n(y + 11 * s)} ${n(cx + 8 * s)} ${n(y - s)} Z`, MOUTH, INK, 1.6 * s)
      + P(`M${n(cx - 4 * s)} ${n(y + 5 * s)} Q${n(cx)} ${n(y + 3 * s)} ${n(cx + 4 * s)} ${n(y + 5 * s)}`, 'none', TONGUE, 1.6 * s);
    default: return `<ellipse cx="${n(cx)}" cy="${n(y + 2 * s)}" rx="${n(3.2 * s)}" ry="${n(4.2 * s)}" fill="${MOUTH}" stroke="${INK}" stroke-width="${n(1.4 * s)}"/>`;
  }
}
/** Kafanın sağ üstündeki ek işaret (kartın üstünde: çizgisi temaya uyar). */
function extra(m: Mood, x: number, y: number): string {
  switch (m) {
    case 'think': return C(x, y + 14, 2, GREY) + C(x + 5, y + 7, 3, GREY)
      + `<text x="${x + 11}" y="${y + 2}" font-family="IBM Plex Mono,ui-monospace,monospace" font-weight="600" font-size="16" fill="${T_INK}">?</text>`;
    case 'warn': return `<g transform="translate(${x} ${y})">` + P('M0 -14 L9 2 L-9 2 Z', GOLD, INK, 1.4) + P('M0 -9 L0 -3', 'none', INK, 2) + C(0, 0, 1.1, INK) + '</g>';
    case 'party': {
      let o = '';
      for (const [dx, dy, c, r] of [[0, 0, GOLD, 0], [14, 10, RED, 30], [-6, 18, GREEN, -20], [20, -6, GOLD, 45]] as const)
        o += `<rect x="${x + dx}" y="${y + dy}" width="5" height="3" rx="1" fill="${c}" transform="rotate(${r} ${x + dx} ${y + dy})"/>`;
      return o + P(`M${x + 6} ${y - 10} l0 8 M${x + 2} ${y - 6} l8 0`, 'none', GOLD, 2);
    }
    case 'wow': return P(`M${x} ${y - 12} l2 -6 M${x + 7} ${y - 8} l5 -4 M${x + 10} ${y} l6 0`, 'none', T_INK, 1.8);
    default: return '';
  }
}

/** Rıfkı Abi'nin yüzü (viewBox 120×140; oyunda 44×51). bg: tema kartı. Gruplar: .rk-br (nefes), .rk-eyes (göz kırpma). */
export function rifkiFace(mood: Mood = 'happy', bg = true): string {
  const [ey, br, mo] = PARTS[mood] || PARTS.happy;
  let o = `<svg class="rk-svg" viewBox="0 0 120 140" aria-hidden="true" data-mood="${mood}">`;
  if (bg) o += `<rect x="1" y="1" width="118" height="138" rx="12" fill="var(--rk-card)" stroke="${T_INK}" stroke-width="1.4"/>`;
  o += '<g class="rk-br">';
  o += P('M32 139 C34 118 44 110 60 110 C76 110 86 118 88 139 Z', COAT, INK, 1.6);
  o += P('M50 112 L60 120 L50 126 Z M70 112 L60 120 L70 126 Z', RED, INK, 1.3) + C(60, 119, 2.6, RED, INK, 1.2);
  o += C(20, 64, 7, SKIN, INK, 1.5) + C(100, 64, 7, SKIN, INK, 1.5);
  o += C(60, 60, 40, SKIN, INK, 1.8);
  o += P('M30 40 Q36 26 46 24', 'none', WHITE, 4, ' opacity=".7"');
  // yan saçlar (kır)
  o += P('M22 52 C18 40 26 34 30 38 C26 42 28 48 26 54 Z', HAIR, INK, 1.3) + P('M98 52 C102 40 94 34 90 38 C94 42 92 48 94 54 Z', HAIR, INK, 1.3);
  o += brows(br, 46, 74, 42);
  o += `<g${ey === 'closed' ? '' : ' class="rk-eyes"'}>${eyes(ey, 46, 74, 56)}</g>`;
  o += `<ellipse cx="60" cy="70" rx="7" ry="6" fill="${NOSE}" stroke="${INK}" stroke-width="1.4"/>`;
  // pala bıyık
  o += P('M60 77 C52 72 40 74 34 80 C30 84 32 90 38 88 C42 82 52 82 60 82 C68 82 78 82 82 88 C88 90 90 84 86 80 C80 74 68 72 60 77 Z', STACHE, INK, 1.4);
  o += mouth(mo, 60, 89);
  o += C(36, 78, 5, CHEEK, 'none', 1.4, ' opacity=".4"') + C(84, 78, 5, CHEEK, 'none', 1.4, ' opacity=".4"');
  o += '</g>';
  o += extra(mood, 96, 18);
  return o + '</svg>';
}

/** Balon açılırken yüzde küçük bir zıplama (≈250 ms yay). Hareketi azalt açıkken hiçbir şey oynamaz. */
export function faceIn(el: Element | null | undefined, reduce: boolean): Animation | null {
  if (reduce || !el) return null;
  return play(el, 'rk-hop', [{ transform: 'translateY(0) scale(1)' }, { transform: 'translateY(-5px) scale(1.06)' }, { transform: 'translateY(0) scale(1)' }],
    { duration: DUR.base, delay: DUR.fast, easing: EASE.spring }); // kart kayarak girerken (rkin) değil, yerine otururken
}
