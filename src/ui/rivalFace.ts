/* =========================================================
   RAKİP EMLAKÇI PORTRESİ — Rıfkı Abi'nin çizgi film dili (ui/rifkiFace.ts): 120×140 kart, büyük kafa, iri gözler,
   kalın mürekkep çizgi, sabit karakter renkleri; kart dolgusu/kenarı ve kartın üstüne çizilen ekler tema token'larıyla.
   15 şehir rakibi tek bir parametrik varyasyon sisteminden üretilir (Look): ten, saç (renk + biçim), bıyık/sakal,
   şapka, gözlük, ceket (renk + desen), boyun (kravat, fular, papyon, balıkçı yaka, inci, kimono yakası) ve şehre özgü
   küçük aksesuar (altın diş, monokl zinciri, tüy, küpe, zincir…). 3 ifade: smug (kendinden emin), bid (hamle: numaralı
   kürek), mad (kızgın / kaybetti). Karakter kimlikleri game/auccore.ts RIVALS ile aynı.
   ========================================================= */
export type RivalMood = 'smug' | 'bid' | 'mad';
export const RIVAL_MOODS: readonly RivalMood[] = ['smug', 'bid', 'mad'];

const INK = '#1e3a32', WHITE = '#fbfbf7', GOLD = '#e0a21b', RED = '#c23b2e', MOUTH = '#8e2f25', TONGUE = '#e8907f', STEAM = '#b9c2bb', SWEAT = '#8ec3e6', LIP = '#c4544a';
const T_INK = 'var(--ink)';
const n = (v: number) => String(Math.round(v * 100) / 100);
const P = (d: string, fill = 'none', stroke = INK, sw = 1.6, extra = '') =>
  `<path d="${d}" fill="${fill}" stroke="${stroke}" stroke-width="${n(sw)}" stroke-linecap="round" stroke-linejoin="round"${extra}/>`;
const C = (cx: number, cy: number, r: number, fill: string, stroke = 'none', sw = 1.4, extra = '') =>
  `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r)}" fill="${fill}" stroke="${stroke}" stroke-width="${n(sw)}"${extra}/>`;

type HairK = 'side' | 'slick' | 'bangs' | 'long' | 'bob' | 'bald' | 'curly';
type Facial = 'none' | 'pencil' | 'handlebar' | 'walrus' | 'beard' | 'goatee' | 'chops';
type Hat = 'none' | 'fedora' | 'bowler' | 'cap' | 'tyrol' | 'captain' | 'sunhat' | 'hard' | 'tam';
type Glasses = 'none' | 'round' | 'thin' | 'sun' | 'monocle';
type Pattern = 'plain' | 'check' | 'tweed' | 'stripe' | 'buttons' | 'haori';
type Neck = 'tie' | 'scarf' | 'bow' | 'turtle' | 'pearls' | 'open' | 'kimono';
type Acc = 'none' | 'tooth' | 'chain' | 'feather' | 'earring' | 'pin' | 'fan';
interface Look {
  skin: string; cheek: string; nose: string; hair: string; hk: HairK; facial: Facial; fc?: string;
  hat: Hat; hatC: string; band?: string; gl: Glasses; glC?: string;
  coat: string; coat2: string; pat: Pattern; neck: Neck; nc: string; acc: Acc; fem?: boolean; num: string;
}
/** Rakip kimliği → görünüm (parametrik). num: hamle küreğindeki numara. */
export const LOOKS: Record<string, Look> = {
  cemil: { skin: '#e6c39a', cheek: '#d98a6e', nose: '#d9a07a', hair: '#2b2420', hk: 'side', facial: 'pencil', hat: 'fedora', hatC: '#6b4a33', band: '#2b2420', gl: 'none', coat: '#b8892f', coat2: '#8f6a22', pat: 'check', neck: 'tie', nc: '#c23b2e', acc: 'tooth', num: '7' },
  nevzat: { skin: '#d9ad83', cheek: '#cf8466', nose: '#c99470', hair: '#c9cfc6', hk: 'side', facial: 'handlebar', hat: 'cap', hatC: '#2d4f86', gl: 'none', coat: '#f1ead8', coat2: '#d6ccb4', pat: 'plain', neck: 'scarf', nc: '#3d7fb0', acc: 'pin', num: '35' },
  sabri: { skin: '#ead0ac', cheek: '#e0957d', nose: '#dba783', hair: '#8a8f8a', hk: 'side', facial: 'walrus', hat: 'none', hatC: '#000', gl: 'thin', glC: '#3a3d42', coat: '#6d7378', coat2: '#565b60', pat: 'stripe', neck: 'tie', nc: '#2d4f86', acc: 'none', num: '6' },
  hank: { skin: '#f0cfae', cheek: '#e79a86', nose: '#e6a888', hair: '#1f1c1a', hk: 'slick', facial: 'none', hat: 'none', hatC: '#000', gl: 'sun', glC: '#1f2227', coat: '#5b3f7a', coat2: '#462f60', pat: 'plain', neck: 'open', nc: '#f4efe6', acc: 'chain', num: '1' },
  dolly: { skin: '#f3d2b8', cheek: '#ec8f84', nose: '#eab094', hair: '#f0c75a', hk: 'long', facial: 'none', hat: 'sunhat', hatC: '#f2a7b5', band: '#c23b2e', gl: 'sun', glC: '#7a2f45', coat: '#e7748f', coat2: '#c45a74', pat: 'plain', neck: 'pearls', nc: '#fbfbf7', acc: 'earring', fem: true, num: '90' },
  walt: { skin: '#e2b48c', cheek: '#d98a6e', nose: '#d29c76', hair: '#6b4a33', hk: 'side', facial: 'beard', hat: 'hard', hatC: '#ffc21a', gl: 'none', coat: '#b8443a', coat2: '#8c2f27', pat: 'check', neck: 'turtle', nc: '#3a3d42', acc: 'none', num: '12' },
  reginald: { skin: '#f3d6c4', cheek: '#e79a86', nose: '#eaa58c', hair: '#b8643a', hk: 'side', facial: 'chops', hat: 'bowler', hatC: '#26272b', band: '#4a4b50', gl: 'monocle', coat: '#5d6b4c', coat2: '#46523a', pat: 'tweed', neck: 'scarf', nc: '#6b3f7a', acc: 'chain', num: '3' },
  alf: { skin: '#f0cdb6', cheek: '#e38f7c', nose: '#e2a18a', hair: '#9a8f86', hk: 'side', facial: 'walrus', hat: 'cap', hatC: '#7c776f', gl: 'none', coat: '#7a5a3e', coat2: '#5c432e', pat: 'tweed', neck: 'scarf', nc: '#d6a21e', acc: 'none', num: '9' },
  hamish: { skin: '#f2d2bd', cheek: '#e88c78', nose: '#e8a189', hair: '#c4552a', hk: 'curly', facial: 'beard', hat: 'tam', hatC: '#2f6b4a', band: '#c23b2e', gl: 'none', coat: '#2f6b4a', coat2: '#a8352c', pat: 'check', neck: 'open', nc: '#f4efe6', acc: 'none', num: '4' },
  pfennig: { skin: '#f1d5bd', cheek: '#e39582', nose: '#e3a88e', hair: '#b9bdb6', hk: 'side', facial: 'pencil', hat: 'tyrol', hatC: '#3f5e3a', band: '#8a5a32', gl: 'round', glC: '#3a3d42', coat: '#3f5e3a', coat2: '#2f4a2c', pat: 'buttons', neck: 'bow', nc: '#8e2f25', acc: 'feather', num: '2' },
  brandt: { skin: '#f2d6c2', cheek: '#e8958a', nose: '#e5ab92', hair: '#1f1c1a', hk: 'bob', facial: 'none', hat: 'none', hatC: '#000', gl: 'thin', glC: '#c23b2e', coat: '#2a2b30', coat2: '#1a1b1f', pat: 'plain', neck: 'turtle', nc: '#c23b2e', acc: 'earring', fem: true, num: '10' },
  jansen: { skin: '#e8c3a2', cheek: '#de8d74', nose: '#d9a184', hair: '#eceee9', hk: 'side', facial: 'beard', hat: 'captain', hatC: '#1d3358', band: '#fbfbf7', gl: 'none', coat: '#1d3358', coat2: '#142644', pat: 'buttons', neck: 'turtle', nc: '#eceee9', acc: 'none', num: '8' },
  tanaka: { skin: '#f0d3b2', cheek: '#e8a08a', nose: '#e2b090', hair: '#15151a', hk: 'bangs', facial: 'none', hat: 'none', hatC: '#000', gl: 'thin', glC: '#3a3d42', coat: '#2b3346', coat2: '#1e2433', pat: 'plain', neck: 'tie', nc: '#3d7fb0', acc: 'pin', num: '5' },
  omori: { skin: '#eccaa5', cheek: '#e8907a', nose: '#dfa786', hair: '#2b2420', hk: 'bald', facial: 'none', hat: 'none', hatC: '#000', gl: 'none', coat: '#d9612f', coat2: '#b44a20', pat: 'haori', neck: 'kimono', nc: '#f4efe6', acc: 'fan', num: '88' },
  hasegawa: { skin: '#ecd1b0', cheek: '#e39c86', nose: '#ddb08f', hair: '#c9cfc6', hk: 'slick', facial: 'goatee', hat: 'none', hatC: '#000', gl: 'round', glC: '#8a5a32', coat: '#2d3e63', coat2: '#1f2c48', pat: 'haori', neck: 'kimono', nc: '#c9cfc6', acc: 'none', num: '11' },
};
export const RIVAL_IDS = Object.keys(LOOKS);

function body(L: Look) {
  let o = P('M30 139 C32 117 44 109 60 109 C76 109 88 117 90 139 Z', L.coat, INK, 1.6);
  const c2 = L.coat2;
  if (L.pat === 'check') o += P('M40 116 L40 139 M50 111 L50 139 M70 111 L70 139 M80 116 L80 139 M34 124 L86 124 M32 133 L88 133', 'none', c2, 1.1);
  else if (L.pat === 'tweed') o += P('M38 118 l4 4 M46 113 l4 4 M74 113 l-4 4 M82 118 l-4 4 M36 130 l4 4 M84 130 l-4 4', 'none', c2, 1.2);
  else if (L.pat === 'stripe') o += P('M38 118 L37 139 M46 112 L45 139 M74 112 L75 139 M82 118 L83 139', 'none', c2, 1);
  else if (L.pat === 'buttons') o += C(60, 128, 1.6, GOLD, INK, .8) + C(60, 135, 1.6, GOLD, INK, .8) + P('M42 122 l8 2 M78 122 l-8 2', 'none', c2, 1.4);
  if (L.neck === 'kimono') return o + P('M46 110 L60 132 L74 110', 'none', L.nc, 4) + P('M46 110 L60 132 L74 110', 'none', INK, 1.2) + (L.pat === 'haori' ? P('M52 125 L60 134 L68 125', 'none', WHITE, 1.4) : '');
  if (L.neck === 'turtle') return o + P('M46 108 Q60 116 74 108 L73 116 Q60 122 47 116 Z', L.nc, INK, 1.3);
  o += P('M50 110 L60 124 L70 110 Z', WHITE, INK, 1.3); // gömlek yakası
  if (L.neck === 'tie') o += P('M57.5 114 L62.5 114 L61.5 131 L60 134 L58.5 131 Z', L.nc, INK, 1.2);
  else if (L.neck === 'scarf') o += P('M53 113 Q60 120 67 113 Q66 124 60 127 Q54 124 53 113 Z', L.nc, INK, 1.2);
  else if (L.neck === 'bow') o += P('M52 113 L60 117 L52 121 Z M68 113 L60 117 L68 121 Z', L.nc, INK, 1.2) + C(60, 117, 2, L.nc, INK, 1);
  else if (L.neck === 'pearls') o += range(7, k => C(48 + k * 4, 114 + Math.sin(k / 6 * Math.PI) * 5, 1.8, L.nc, INK, .7));
  return o;
}
const range = (k: number, f: (j: number) => string) => Array.from({ length: k }, (_, j) => f(j)).join('');
/** Başın arkasında kalan saç (uzun, küt). */
function backHair(L: Look) {
  if (L.hk === 'long') return P('M22 58 C14 86 20 108 34 116 L86 116 C100 108 106 86 98 58 Z', L.hair, INK, 1.5);
  if (L.hk === 'bob') return P('M20 62 C18 84 22 94 32 96 L88 96 C98 94 102 84 100 62 Z', L.hair, INK, 1.5);
  return '';
}
function frontHair(L: Look) {
  const h = L.hair;
  switch (L.hk) {
    case 'side': return P('M22 54 C19 44 22 36 28 33 L31 46 C27 48 26 52 26 56 Z', h, INK, 1.3) + P('M98 54 C101 44 98 36 92 33 L89 46 C93 48 94 52 94 56 Z', h, INK, 1.3);
    case 'slick': return P('M22 52 C18 30 34 16 60 16 C86 16 102 30 98 52 C92 40 84 34 74 32 C62 30 46 30 36 36 C30 40 26 46 22 52 Z', h, INK, 1.4) + P('M40 24 Q58 20 80 26 M36 30 Q60 24 86 32', 'none', WHITE, 1.2, ' opacity=".35"');
    case 'bangs': return P('M20 58 C16 30 34 16 60 16 C86 16 104 30 100 58 L94 58 L92 42 L84 46 L80 38 L72 44 L66 36 L58 44 L52 36 L46 44 L38 38 L34 46 L28 42 L26 58 Z', h, INK, 1.4);
    case 'long': return P('M22 58 C18 30 36 16 60 16 C84 16 102 30 98 58 C94 44 86 36 74 34 C66 40 52 42 40 38 C32 42 26 48 22 58 Z', h, INK, 1.4);
    case 'bob': return P('M20 64 C16 32 34 16 60 16 C86 16 104 32 100 64 L92 60 L90 40 L30 40 L28 60 Z', h, INK, 1.4);
    case 'curly': return range(9, k => C(26 + k * 8.5, 26 + Math.abs(4 - k) * 3.2, 7, h, INK, 1.2)) + C(22, 50, 6, h, INK, 1.2) + C(98, 50, 6, h, INK, 1.2);
    default: return P('M24 54 C22 48 24 44 28 42 L30 50 C27 51 26 53 26 56 Z', h, INK, 1.2) + P('M96 54 C98 48 96 44 92 42 L90 50 C93 51 94 53 94 56 Z', h, INK, 1.2);
  }
}
function hat(L: Look) {
  const c = L.hatC, b = L.band || INK;
  switch (L.hat) {
    case 'fedora': return `<g transform="rotate(-7 60 28)">${P('M14 28 Q60 18 106 28 Q60 38 14 28 Z', c, INK, 1.6)}${P('M31 27 C30 8 44 3 60 5 C76 3 90 8 89 27 Q60 33 31 27 Z', c, INK, 1.6)}${P('M31.6 20 Q60 25 88.4 20 L89 27 Q60 33 31 27 Z', b, INK, 1.2)}${P('M48 8 Q60 14 72 8', 'none', INK, 1.4)}</g>`;
    case 'bowler': return P('M24 31 Q60 23 96 31 Q60 37 24 31 Z', c, INK, 1.6) + P('M34 30 C33 4 87 4 86 30 Q60 34 34 30 Z', c, INK, 1.6) + P('M34.4 25 Q60 29 85.6 25', 'none', b, 2.6) + P('M44 12 Q50 8 56 8', 'none', WHITE, 2, ' opacity=".35"');
    case 'cap': return P('M24 34 C22 14 44 10 62 12 C84 12 98 20 96 32 Q60 26 24 34 Z', c, INK, 1.6) + P('M24 34 Q12 38 16 42 Q40 40 56 32 Z', c, INK, 1.4) + P('M40 16 Q60 22 86 18', 'none', INK, 1, ' opacity=".5"');
    case 'tyrol': return P('M22 32 Q60 24 98 32 Q60 38 22 32 Z', c, INK, 1.6) + P('M34 31 C34 14 44 6 60 8 C76 6 86 14 86 31 Q60 35 34 31 Z', c, INK, 1.6) + P('M34.6 26 Q60 30 85.4 26 L86 31 Q60 35 34 31 Z', b, INK, 1.1);
    case 'captain': return P('M30 34 Q60 28 90 34 L92 26 Q60 18 28 26 Z', WHITE, INK, 1.5) + P('M26 26 C26 12 94 12 94 26 Q60 20 26 26 Z', c, INK, 1.5) + P('M30 34 Q60 44 86 34 Q60 36 30 34 Z', '#1f2227', INK, 1.3) + C(60, 29, 3, GOLD, INK, 1);
    case 'sunhat': return P('M4 36 Q60 14 116 36 Q60 48 4 36 Z', c, INK, 1.6) + P('M34 32 C34 10 86 10 86 32 Q60 36 34 32 Z', c, INK, 1.6) + P('M34.6 27 Q60 31 85.4 27 L86 32 Q60 36 34 32 Z', b, INK, 1.1) + C(84, 28, 4, WHITE, INK, 1);
    case 'hard': return P('M22 36 Q60 28 98 36 L98 40 Q60 34 22 40 Z', c, INK, 1.5) + P('M28 36 C26 10 94 10 92 36 Q60 30 28 36 Z', c, INK, 1.6) + P('M60 10 L60 33 M48 12 L50 32 M72 12 L70 32', 'none', INK, 1, ' opacity=".55"');
    case 'tam': return P('M24 30 C20 14 44 6 62 8 C86 8 100 18 96 30 Q60 36 24 30 Z', c, INK, 1.6) + P('M26 30 Q60 38 94 30 L94 34 Q60 42 26 34 Z', b, INK, 1.2) + C(62, 6, 5, RED, INK, 1.2);
    default: return '';
  }
}
type EyeK = 'lid' | 'side' | 'stern';
function eyes(L: Look, k: EyeK, lx: number, rx: number, y: number) {
  let o = '';
  for (const x of [lx, rx]) {
    const dx = k === 'side' ? 2.4 : 0, dy = k === 'lid' ? 2.4 : 1;
    o += `<ellipse cx="${x}" cy="${y}" rx="7" ry="${k === 'stern' ? 7.5 : 9}" fill="${WHITE}" stroke="${INK}" stroke-width="1.4"/>`;
    o += C(x + dx, y + dy, k === 'stern' ? 3.2 : 4, INK) + C(x + dx + 1.3, y + dy - 1.5, 1.1, WHITE);
    if (k === 'lid') o += P(`M${x - 7.4} ${y + .5} A7.4 9.2 0 0 1 ${x + 7.4} ${y + .5} Z`, L.skin, INK, 1.4);
    if (k === 'stern') o += P(`M${x - 7.4} ${y - 1} L${x + 7.4} ${y + 2}`, 'none', INK, 1.2);
    if (L.fem) o += P(`M${x - 6} ${y - 7} l-3 -3 M${x} ${y - 9} l0 -3.4 M${x + 6} ${y - 7} l3 -3`, 'none', INK, 1.3);
  }
  return o;
}
function glasses(L: Look, mood: RivalMood) {
  const c = L.glC || INK;
  switch (L.gl) {
    case 'round': return C(46, 57, 9.5, 'rgba(255,255,255,.12)', c, 2) + C(74, 57, 9.5, 'rgba(255,255,255,.12)', c, 2) + P('M55.5 56 Q60 53 64.5 56 M36.5 56 L28 53 M83.5 56 L92 53', 'none', c, 1.8);
    case 'thin': return `<rect x="36" y="51" width="20" height="12" rx="3" fill="rgba(255,255,255,.12)" stroke="${c}" stroke-width="1.8"/><rect x="64" y="51" width="20" height="12" rx="3" fill="rgba(255,255,255,.12)" stroke="${c}" stroke-width="1.8"/>` + P('M56 56 Q60 54 64 56 M36 55 L28 53 M84 55 L92 53', 'none', c, 1.6);
    case 'sun': return mood === 'mad' ? P('M34 36 Q46 30 56 36 L64 36 Q74 30 86 36', 'none', c, 3) // kızgın: gözlük alına kalkar
      : P('M35 50 L57 50 L55 62 Q46 67 37 62 Z M63 50 L85 50 L83 62 Q74 67 65 62 Z', c, INK, 1.5) + P('M57 52 Q60 50 63 52', 'none', INK, 1.6) + P('M40 53 l5 0', 'none', WHITE, 1.4, ' opacity=".6"');
    case 'monocle': return C(74, 56, 10.5, 'rgba(255,255,255,.18)', GOLD, 2.4) + P('M83 62 C92 76 90 96 84 112', 'none', GOLD, 1.2, ' stroke-dasharray="2 2"');
    default: return '';
  }
}
function brows(m: RivalMood, L: number, R: number, y: number, col: string, w = 3.4) {
  const b = (d: string) => P(d, 'none', col, w);
  if (m === 'smug') return b(`M${L - 6} ${y} Q${L} ${y - 2} ${L + 6} ${y + 1}`) + b(`M${R - 6} ${y - 4} Q${R} ${y - 10} ${R + 6} ${y - 5}`);
  if (m === 'bid') return b(`M${L - 6} ${y - 4} Q${L} ${y - 9} ${L + 6} ${y - 4}`) + b(`M${R - 6} ${y - 4} Q${R} ${y - 9} ${R + 6} ${y - 4}`);
  return b(`M${L - 7} ${y - 5} L${L + 6} ${y + 2}`) + b(`M${R + 7} ${y - 5} L${R - 6} ${y + 2}`);
}
function facial(L: Look) {
  const c = L.fc || L.hair;
  switch (L.facial) {
    case 'pencil': return P('M45 80 Q52 75.5 60 78.5 Q68 75.5 75 80', 'none', c, 2.8);
    case 'handlebar': return P('M60 79 C54 74 44 75 38 79 C34 81 30 78 31 73 C33 79 42 83 60 82 C78 83 87 79 89 73 C90 78 86 81 82 79 C76 75 66 74 60 79 Z', c, INK, 1.3);
    case 'walrus': return P('M60 76 C50 72 38 76 36 86 C42 84 48 84 52 86 C55 82 58 82 60 84 C62 82 65 82 68 86 C72 84 78 84 84 86 C82 76 70 72 60 76 Z', c, INK, 1.3);
    case 'beard': return P('M60 77 C52 73 42 76 40 82 Q50 80 60 82 Q70 80 80 82 C78 76 68 73 60 77 Z', c, INK, 1.2);
    case 'goatee': return P('M52 94 Q60 112 68 94 Q60 98 52 94 Z', c, INK, 1.3) + P('M48 80 Q54 77 60 79 Q66 77 72 80', 'none', c, 2.4);
    case 'chops': return P('M22 46 C17 64 24 84 41 91 C42 84 35 74 33 62 C31 54 30 48 28 44 Z', c, INK, 1.4) + P('M98 46 C103 64 96 84 79 91 C78 84 85 74 87 62 C89 54 90 48 92 44 Z', c, INK, 1.4)
      + P('M60 79 C54 74 44 75 38 79 C34 81 30 78 31 73 C33 79 42 83 60 82 C78 83 87 79 89 73 C90 78 86 81 82 79 C76 75 66 74 60 79 Z', c, INK, 1.3);
    default: return '';
  }
}
/** Sakal (yüzün alt yarısı): ağız ve bıyık üstüne çizilir. */
const beard = (L: Look) => L.facial !== 'beard' ? '' : P('M24 66 C24 96 40 112 60 112 C80 112 96 96 96 66 C90 80 80 84 72 84 Q60 80 48 84 C40 84 30 80 24 66 Z', L.fc || L.hair, INK, 1.4);
function mouth(m: RivalMood, L: Look, cx: number, y: number) {
  const tooth = L.acc === 'tooth', lip = L.fem ? LIP : INK;
  if (m === 'smug') return P(`M${cx - 9} ${y + 1} Q${cx + 2} ${y + 6} ${cx + 11} ${y - 3}`, 'none', lip, L.fem ? 2.6 : 2) + (tooth ? `<rect x="${cx + 3}" y="${y + 1.4}" width="3.4" height="3.2" rx=".6" fill="${GOLD}" stroke="${INK}" stroke-width="1"/>` : '');
  if (m === 'bid') return P(`M${cx - 9} ${y - 1} Q${cx} ${y + 12} ${cx + 9} ${y - 1} Z`, MOUTH, L.fem ? LIP : INK, 1.6) + P(`M${cx - 5} ${y + 6} Q${cx} ${y + 4} ${cx + 5} ${y + 6}`, 'none', TONGUE, 1.6)
    + `<rect x="${cx - 6}" y="${y - .4}" width="12" height="3" fill="${WHITE}" stroke="${INK}" stroke-width=".9"/>` + (tooth ? `<rect x="${cx + 1}" y="${y - .4}" width="3" height="3" fill="${GOLD}" stroke="${INK}" stroke-width=".9"/>` : '');
  return P(`M${cx - 9} ${y + 5} Q${cx} ${y - 1} ${cx + 9} ${y + 5} L${cx + 8} ${y + 8} Q${cx} ${y + 3} ${cx - 8} ${y + 8} Z`, WHITE, L.fem ? LIP : INK, 1.5) + P(`M${cx - 4} ${y + 3} v4 M${cx} ${y + 2} v4.4 M${cx + 4} ${y + 3} v4`, 'none', INK, 1);
}
function acc(L: Look) {
  switch (L.acc) {
    case 'chain': return L.gl === 'monocle' ? '' : P('M48 112 Q60 126 72 112', 'none', GOLD, 2.4) + C(60, 120, 2.4, GOLD, INK, .8);
    case 'feather': return P('M84 26 C92 12 100 6 104 2 C100 12 96 20 86 28 Z', '#6b8a3a', INK, 1.1);
    case 'earring': return C(20, 74, 2.6, GOLD, INK, 1) + C(100, 74, 2.6, GOLD, INK, 1);
    case 'pin': return C(42, 120, 3, RED, INK, 1) + C(42, 120, 1.1, GOLD);
    case 'fan': return P('M96 132 L84 112 Q96 104 108 112 Z', '#f4efe6', INK, 1.2) + P('M96 132 L90 110 M96 132 L96 108 M96 132 L102 110', 'none', RED, 1);
    default: return '';
  }
}
/** Kartın üstüne çizilen ek: kendinden emin ışıltı, hamle küreği, kızgınlık buharı. */
function extra(m: RivalMood, L: Look) {
  if (m === 'smug') return P('M103 18 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2 z', GOLD, INK, 1.1) + P('M92 34 l1 2.5 2.5 1 -2.5 1 -1 2.5 -1 -2.5 -2.5 -1 2.5 -1 z', GOLD, INK, .9);
  if (m === 'bid') return P('M102 112 L104 137', 'none', INK, 4.4) + P('M102 112 L104 137', 'none', '#c79a5b', 2.4)
    + `<ellipse cx="101" cy="98" rx="13" ry="14" fill="${WHITE}" stroke="${INK}" stroke-width="1.6" transform="rotate(6 101 98)"/>`
    + `<text x="101.5" y="104" text-anchor="middle" font-family="IBM Plex Mono,ui-monospace,monospace" font-weight="700" font-size="${L.num.length > 1 ? 12 : 15}" fill="${RED}">${L.num}</text>`;
  const puff = (x: number, y: number, s: number) => C(x, y, 4 * s, STEAM, INK, 1.1) + C(x + 5 * s, y - 3 * s, 5 * s, STEAM, INK, 1.1) + C(x + 10 * s, y + 1 * s, 3.6 * s, STEAM, INK, 1.1);
  return puff(6, 16, 1) + puff(98, 14, .9) + P('M97 50 C93 56 93 60 97 60 C101 60 101 56 97 50 Z', SWEAT, INK, 1.1) + P(`M14 8 l3 4 M22 4 l0 5`, 'none', T_INK, 1.6);
}

const PARTS: Record<RivalMood, EyeK> = { smug: 'lid', bid: 'side', mad: 'stern' };

/** Rakip emlakçının yüzü (viewBox 120×140). bg: tema kartı (--rv-card). */
export function rivalFace(id: string, mood: RivalMood = 'smug', bg = true): string {
  const L = LOOKS[id] || LOOKS.cemil;
  let o = `<svg class="rv-svg" viewBox="0 0 120 140" aria-hidden="true" data-mood="${mood}" data-rival="${id}">`;
  if (bg) o += `<rect x="1" y="1" width="118" height="138" rx="12" fill="var(--rv-card)" stroke="${T_INK}" stroke-width="1.4"/>`;
  o += '<g class="rk-br">' + backHair(L) + body(L);
  o += C(20, 64, 7, L.skin, INK, 1.5) + C(100, 64, 7, L.skin, INK, 1.5);
  o += C(60, 60, 40, L.skin, INK, 1.8) + P('M30 42 Q36 30 46 28', 'none', WHITE, 4, ' opacity=".6"');
  o += beard(L);
  o += frontHair(L) + hat(L);
  o += brows(mood, 46, 74, 43, L.hk === 'bald' || L.hair === '#c9cfc6' || L.hair === '#eceee9' ? INK : L.hair);
  o += `<g${mood === 'smug' ? '' : ' class="rk-eyes"'}>${eyes(L, PARTS[mood], 46, 74, 57)}</g>`;
  o += glasses(L, mood);
  o += `<ellipse cx="60" cy="70" rx="6" ry="6.4" fill="${L.nose}" stroke="${INK}" stroke-width="1.4"/>`;
  o += facial(L) + mouth(mood, L, 60, 88);
  o += C(35, 78, 5, L.cheek, 'none', 1.4, ` opacity="${mood === 'mad' ? '.75' : '.35'}"`) + C(85, 78, 5, L.cheek, 'none', 1.4, ` opacity="${mood === 'mad' ? '.75' : '.35'}"`);
  o += acc(L) + '</g>' + extra(mood, L);
  return o + '</svg>';
}
