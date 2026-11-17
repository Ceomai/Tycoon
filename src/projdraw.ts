/* =========================================================
   BÜYÜK PROJE ÇİZİMLERİ — 2×2 blok kaplayan tek çizim (viewBox 200×200, taban Y=186).
   Geometri projenin türünden (site, çarşı, plaza, karma), malzeme ve süs şehrin ülkesinin üslubundan gelir:
   tr: taş + kiremit + kemer/kubbe · us: tuğla + korniş + su deposu + yangın merdiveni ·
   uk: Georgian/Viktoryen kırmızı tuğla sıra cephe, beyaz sıva zemin kat, giyotin pencere, baca sırası, cam çatılı arcade ·
   de: Gründerzeit (Altbau) sıva cephe, kat silmeleri, cumba (Erker), mansart çatı + Bauhaus şerit pencere, klinker Kontorhaus ·
   jp: beyaz/cam + dikey neon tabela + fener.
   Diğer binalarla aynı 3/4 bakış ve mürekkep çizgi; derinlik 24×17.
   ========================================================= */
const INK = 'stroke="var(--ink)" stroke-linejoin="round"';
const D = 24, DD = 17, Y = 186;
const r = (n: number) => +n.toFixed(1);
const poly = (pts: number[][], fill: string, w = 1) => `<polygon points="${pts.map(p => r(p[0]) + ',' + r(p[1])).join(' ')}" fill="${fill}" ${INK} stroke-width="${w}"/>`;
const rect = (x: number, y: number, w: number, h: number, fill: string, sw = .8) => `<rect x="${r(x)}" y="${r(y)}" width="${r(w)}" height="${r(h)}" fill="${fill}" ${INK} stroke-width="${sw}"/>`;
const arch = (x: number, y: number, w: number, h: number, fill: string) => `<path d="M${r(x)} ${r(y + h)}v${r(-(h - w / 2))}a${r(w / 2)} ${r(w / 2)} 0 0 1 ${r(w)} 0v${r(h - w / 2)}z" fill="${fill}" ${INK} stroke-width=".8"/>`;
/** Kutu: ön, yan ve (istenirse) üst yüz. x sol, yb taban, w genişlik, h yükseklik. */
function box(x: number, yb: number, w: number, h: number, f: string, s: string, top: string | null, d = D, dd = DD) {
  const yt = yb - h;
  return poly([[x, yb], [x + w, yb], [x + w, yt], [x, yt]], f, 1.1)
    + poly([[x + w, yb], [x + w + d, yb - dd], [x + w + d, yt - dd], [x + w, yt]], s, 1.1)
    + (top ? poly([[x, yt], [x + w, yt], [x + w + d, yt - dd], [x + d, yt - dd]], top, 1.1) : '');
}
const shadow = (x: number, w: number, yb = Y) => `<polygon class="sh" points="${r(x + 3)},${r(yb + 2)} ${r(x + w + 5)},${r(yb + 2)} ${r(x + w + D + 10)},${r(yb - DD + 2)} ${r(x + D + 8)},${r(yb - DD + 2)}"/>`;
const tree = (x: number, y: number, s = 1) => `<path d="M${x} ${y}v${-7 * s}" stroke="#6b4a3a" stroke-width="${1.6 * s}"/><circle cx="${x}" cy="${y - 11 * s}" r="${7 * s}" fill="var(--tree)" ${INK} stroke-width=".8"/>`;
/** Pencere sırası. */
function wins(x: number, y: number, n: number, w: number, h: number, gap: number, fill = 'var(--gl)') {
  let s = ''; for (let k = 0; k < n; k++) s += rect(x + k * (w + gap), y, w, h, fill, .6); return s;
}

interface Pal { f: string; s: string; t: string; rf: string; rf2: string; acc: string; acc2: string; gr: string; }
const PAL: Record<string, Pal> = {
  tr: { f: '#e8dcc2', s: '#cdbd9c', t: '#ddd0b2', rf: '#c4553a', rf2: '#9e3f2a', acc: '#2f7d5b', acc2: '#e0a21b', gr: '#d8cfba' },
  us: { f: '#b4583f', s: '#924532', t: '#9a8f80', rf: '#5b5f66', rf2: '#44484e', acc: '#2c3440', acc2: '#e0a21b', gr: '#c9c3b8' },
  jp: { f: '#eef0ec', s: '#cdd3d1', t: '#dfe3e1', rf: '#4f5b6b', rf2: '#3d4855', acc: '#c23b2e', acc2: '#ffc21a', gr: '#d4d8d2' },
  uk: { f: '#a9573f', s: '#874431', t: '#c9c2b4', rf: '#59626d', rf2: '#454d57', acc: '#1f3b5a', acc2: '#e0a21b', gr: '#c6c1b6' },
  de: { f: '#e7d6ae', s: '#c8b386', t: '#dccb9f', rf: '#5e6670', rf2: '#4a515a', acc: '#2f6b4f', acc2: '#e0a21b', gr: '#cfc8b8' },
};
const STUCCO = '#f1ece0', STUCCO2 = '#d9d2c2';
/** Giyotin (sash) pencere: beyaz kasa, ortada kayıt; üstte taş lento. */
function sash(x: number, y: number, w: number, h: number) {
  return rect(x, y, w, h, 'var(--gl)', .6) + `<path d="M${r(x)} ${r(y + h / 2)}h${r(w)}" stroke="${STUCCO}" stroke-width="1"/>` + rect(x - 1, y - 3, w + 2, 2.4, STUCCO, .5);
}
/** Gründerzeit penceresi: uzun, üstünde alınlık (üçgen) ya da düz silme. */
function altbauWin(x: number, y: number, w: number, h: number, ped: boolean) {
  return rect(x, y, w, h, 'var(--gl)', .6) + (ped ? poly([[x - 2, y - 1.5], [x + w + 2, y - 1.5], [x + w / 2, y - 6]], STUCCO, .6) : rect(x - 1.5, y - 3, w + 3, 2.2, STUCCO, .5));
}

/** Zemin: blok boyunca taş döşeli avlu (sokak çizgilerini örter). */
function ground(P: Pal) {
  return poly([[6, 194], [176, 194], [196, 178], [26, 178]], P.gr, 1) + `<path d="M40 194l14-16M80 194l14-16M120 194l14-16M160 194l14-16" stroke="var(--ink)" stroke-width=".4" opacity=".35"/>`;
}

/* ---------- türler ---------- */
function site(P: Pal, st: string, hm: number) {
  if (st === 'uk') return siteUk(P, hm);
  if (st === 'de') return siteDe(P, hm);
  // iki konut bloğu + avlu kapısı; tr: kırma çatı + balkon, us: brownstone korniş + merdiven, jp: danchi koridor şeritleri
  const h1 = 92 * hm, h2 = 72 * hm;
  let s = shadow(12, 74) + shadow(100, 70);
  s += box(100, Y - 8, 70, h2, P.f, P.s, st === 'tr' ? null : P.t);
  s += box(12, Y, 74, h1, P.f, P.s, st === 'tr' ? null : P.t);
  const fl1 = Math.floor(h1 / 18), fl2 = Math.floor(h2 / 18);
  for (let k = 0; k < fl1; k++) s += wins(18, Y - 16 - k * 18, 4, 11, 10, 6);
  for (let k = 0; k < fl2; k++) s += wins(106, Y - 24 - k * 18, 4, 10, 9, 6);
  if (st === 'tr') {
    s += poly([[8, Y - h1], [90, Y - h1], [112, Y - h1 - 16], [30, Y - h1 - 16]], P.rf) + poly([[90, Y - h1], [112, Y - h1 - 16], [112, Y - h1 - 2]], P.rf2);
    s += poly([[96, Y - 8 - h2], [174, Y - 8 - h2], [196, Y - 8 - h2 - 16], [118, Y - 8 - h2 - 16]], P.rf);
    for (let k = 0; k < fl1 - 1; k++) s += `<path d="M14 ${r(Y - 20 - k * 18)}h70" stroke="var(--ink)" stroke-width="1.6"/>`; // balkon
  } else if (st === 'us') {
    s += rect(8, Y - h1 - 5, 82, 5, '#7d4a3a', 1) + rect(96, Y - 8 - h2 - 5, 78, 5, '#7d4a3a', 1);
    for (let k = 0; k < 3; k++) s += poly([[20 + k * 22, Y], [32 + k * 22, Y], [32 + k * 22, Y - 10], [20 + k * 22, Y - 10]], '#9a8f80', .7);
  } else {
    for (let k = 0; k < fl1; k++) s += `<path d="M12 ${r(Y - 4 - k * 18)}h74" stroke="var(--ink)" stroke-width="2.2"/>`;
    for (let k = 0; k < fl2; k++) s += `<path d="M100 ${r(Y - 12 - k * 18)}h70" stroke="var(--ink)" stroke-width="2"/>`;
    s += rect(40, Y - h1 - 14, 18, 14, '#c9d6dd', .8); // çatı su tankı
  }
  s += arch(88, Y - 18, 12, 18, '#6b4a3a') + tree(94, Y + 4, .9) + tree(180, Y + 2, .8);
  return s;
}
/** uk: Georgian sıra evler (mews): beyaz sıva zemin kat, yelpaze pencereli lacivert kapılar, tuğla üst katlar, korkuluk ve baca sırası. */
function siteUk(P: Pal, hm: number) {
  const h1 = 90 * hm, h2 = 70 * hm, y2 = Y - 8;
  let s = shadow(12, 74) + shadow(100, 70);
  s += box(100, y2, 70, h2, P.f, P.s, P.t) + box(12, Y, 74, h1, P.f, P.s, P.t);
  s += rect(100, y2 - 20, 70, 20, STUCCO, .8) + rect(12, Y - 22, 74, 22, STUCCO, .8); // sıva zemin kat
  for (let j = 0; j < 3; j++) s += arch(17 + j * 24, Y - 19, 10, 19, P.acc) + `<path d="M${17 + j * 24} ${Y - 14}h10" stroke="${STUCCO}" stroke-width=".8"/>`; // kapılar + yelpaze pencere
  for (let j = 0; j < 3; j++) s += sash(105 + j * 22, y2 - 16, 10, 11);
  const fl1 = Math.floor((h1 - 26) / 17), fl2 = Math.floor((h2 - 24) / 17);
  for (let k = 0; k < fl1; k++) for (let j = 0; j < 4; j++) s += sash(17 + j * 18, Y - 40 - k * 17, 9, 12);
  for (let k = 0; k < fl2; k++) for (let j = 0; j < 4; j++) s += sash(105 + j * 16, y2 - 38 - k * 17, 8, 11);
  s += `<path d="M14 ${r(Y - 34)}h70" stroke="var(--ink)" stroke-width="1.4"/>`; // ferforje balkon
  s += rect(10, Y - h1 - 4, 78, 4, STUCCO, .8) + rect(98, y2 - h2 - 4, 74, 4, STUCCO, .8); // korniş / korkuluk
  for (let j = 0; j < 3; j++) { const cx = 20 + j * 26; s += rect(cx, Y - h1 - 16, 9, 12, P.f, .8) + rect(cx + 1, Y - h1 - 20, 3, 4, '#c4553a', .5) + rect(cx + 5, Y - h1 - 20, 3, 4, '#c4553a', .5); }
  for (let j = 0; j < 2; j++) { const cx = 112 + j * 30; s += rect(cx, y2 - h2 - 15, 9, 11, P.f, .8) + rect(cx + 3, y2 - h2 - 19, 3, 4, '#c4553a', .5); }
  s += `<path d="M10 ${Y}h80" stroke="var(--ink)" stroke-width="1.2" stroke-dasharray="1.5 2.5"/>`; // ön bahçe parmaklığı
  return s + tree(94, Y + 4, .9) + tree(180, Y + 2, .8);
}
/** de: Gründerzeit (Altbau) blok: sıva cephe, kat silmeleri, alınlıklı pencereler, iki cumba, mansart çatı + çatı pencereleri, avluya geçit. */
function siteDe(P: Pal, hm: number) {
  const h = 92 * hm, x = 12, w = 150, yt = Y - h;
  let s = shadow(x, w) + box(x, Y, w, h, P.f, P.s, null);
  s += rect(x, Y - 16, w, 16, STUCCO2, .8); // rustika zemin kat
  const fl = Math.floor((h - 18) / 17);
  for (let k = 0; k < fl; k++) {
    const y = Y - 32 - k * 17;
    s += `<path d="M${x} ${r(y + 15)}h${w}" stroke="var(--ink)" stroke-width=".7" opacity=".7"/>`; // kat silmesi
    for (let j = 0; j < 8; j++) if (j !== 3) s += altbauWin(x + 7 + j * 18, y, 8, 12, k === 0);
  }
  for (const ex of [x + 20, x + 110]) { // cumba (Erker): öne taşan dar kutu
    s += box(ex, Y - 18, 20, Math.max(30, h - 30), '#efe2c2', '#d4c39c', '#e2d3ae', 6, 4);
    for (let k = 0; k < fl - 1; k++) s += rect(ex + 5, Y - 34 - k * 17, 10, 11, 'var(--gl)', .5);
  }
  s += arch(x + 63, Y - 16, 16, 16, '#5c4436'); // avluya geçit (Durchfahrt)
  for (let j = 0; j < 7; j++) if (j !== 3) s += rect(x + 5 + j * 21, Y - 13, 9, 9, 'var(--gl)', .5);
  // mansart çatı + çatı pencereleri
  s += poly([[x - 3, yt], [x + w + 3, yt], [x + w + D, yt - DD - 6], [x + D + 6, yt - DD - 6]], P.rf) + poly([[x + w + 3, yt], [x + w + D, yt - DD - 6], [x + w + D, yt - DD + 2]], P.rf2);
  for (let j = 0; j < 6; j++) s += rect(x + 18 + j * 22, yt - 13, 7, 8, 'var(--gl)', .6) + poly([[x + 16 + j * 22, yt - 13], [x + 27 + j * 22, yt - 13], [x + 21.5 + j * 22, yt - 17]], P.rf2, .6);
  return s + tree(176, Y + 4, .8);
}
function carsi(P: Pal, st: string, hm: number) {
  if (st === 'uk') return carsiUk(P, hm);
  if (st === 'de') return carsiDe(P, hm);
  // uzun çarşı binası: zemin kat dükkân sırası + tenteler; tr: cam tonoz + kubbe (pasaj), us: cam giriş kutusu (mall), jp: shōtengai sundurması + fenerler
  const h = 70 * hm, x = 10, w = 150;
  let s = shadow(x, w) + box(x, Y, w, h, P.f, P.s, st === 'tr' ? null : P.t);
  for (let k = 0; k < 7; k++) {
    const sx = x + 6 + k * 20.5;
    s += rect(sx, Y - 26, 15, 22, k === 3 ? '#6b4a3a' : 'var(--gl)', .7) + rect(sx - 1, Y - 31, 17, 5, k % 2 ? P.acc2 : P.acc, .6);
  }
  const ups = Math.floor((h - 36) / 18);
  for (let k = 0; k < ups; k++) for (let j = 0; j < 7; j++) s += st === 'tr' ? arch(x + 9 + j * 20.5, Y - 52 - k * 18, 9, 13, 'var(--gl)') : rect(x + 8 + j * 20.5, Y - 50 - k * 18, 11, 11, 'var(--gl)', .6);
  if (st === 'tr') {
    s += `<path d="M${x} ${r(Y - h)} Q${x + w / 2} ${r(Y - h - 26)} ${x + w} ${r(Y - h)} L${x + w + D} ${r(Y - h - DD)} Q${x + w / 2 + D} ${r(Y - h - DD - 26)} ${x + D} ${r(Y - h - DD)} Z" fill="#cfe3ee" ${INK} stroke-width="1.1"/>`;
    for (let k = 1; k < 8; k++) { const xx = x + k * w / 8, yy = Y - h - Math.sin(k / 8 * Math.PI) * 13; s += `<path d="M${r(xx)} ${r(yy)}l${D} ${-DD}" stroke="var(--ink)" stroke-width=".6"/>`; }
    s += `<ellipse cx="${x + w / 2 + 12}" cy="${r(Y - h - 30)}" rx="16" ry="11" fill="#9fb3bf" ${INK} stroke-width="1"/><path d="M${x + w / 2 + 12} ${r(Y - h - 41)}v-9" stroke="var(--ink)" stroke-width="1.4"/>`;
  } else if (st === 'us') {
    s += box(62, Y, 46, h + 16, '#bcd6e8', '#9ec0d6', '#dfe9f2', 12, 8);
    s += `<path d="M66 ${r(Y - h - 4)}h38" stroke="var(--ink)" stroke-width=".6"/>` + rect(66, Y - h - 13, 38, 8, P.acc2, .8);
  } else {
    s += poly([[x - 4, Y - 34], [x + w + 4, Y - 34], [x + w + D, Y - 34 - DD], [x + D - 4, Y - 34 - DD]], 'rgba(207,227,238,.85)', 1);
    for (let k = 0; k < 6; k++) s += `<ellipse cx="${x + 16 + k * 24}" cy="${Y - 30}" rx="4" ry="5.5" fill="#c23b2e" ${INK} stroke-width=".6"/>`;
    s += rect(x + w - 14, Y - h - 30, 12, 46, P.acc, .9) + `<path d="M${x + w - 8} ${Y - h - 24}v34" stroke="#fbfbf7" stroke-width="2" stroke-dasharray="4 3"/>`;
  }
  return s + tree(176, Y + 4, .8);
}
/** uk: Viktoryen arcade: tuğla + taş silmeler, koyu yeşil / bordo dükkân alınlıkları, kemerli üst pencereler,
 *  ortada alınlıklı giriş kemeri ve arkada demir kaburgalı cam tonoz. */
function carsiUk(P: Pal, hm: number) {
  const h = 68 * hm, x = 10, w = 150, yt = Y - h;
  let s = shadow(x, w);
  // cam tonoz (cephenin arkasında)
  s += `<path d="M${x + 20} ${r(yt)} Q${x + w / 2} ${r(yt - 26)} ${x + w - 20} ${r(yt)} L${x + w - 20 + D} ${r(yt - DD)} Q${x + w / 2 + D} ${r(yt - DD - 26)} ${x + 20 + D} ${r(yt - DD)} Z" fill="#cfe3ee" ${INK} stroke-width="1.1"/>`;
  for (let k = 1; k < 8; k++) { const xx = x + 20 + k * (w - 40) / 8, yy = yt - Math.sin(k / 8 * Math.PI) * 13; s += `<path d="M${r(xx)} ${r(yy)}l${D} ${-DD}" stroke="#2c3440" stroke-width="1"/>`; }
  s += box(x, Y, w, h, P.f, P.s, P.t);
  for (let k = 0; k < 7; k++) {
    if (k === 3) continue;
    const sx = x + 6 + k * 20.5;
    s += rect(sx, Y - 24, 15, 20, 'var(--gl)', .7) + rect(sx - 1, Y - 30, 17, 6, k % 2 ? '#7a2e3a' : '#2f5d46', .6);
  }
  const ups = Math.max(1, Math.floor((h - 34) / 17));
  for (let u = 0; u < ups; u++) for (let j = 0; j < 7; j++) if (j !== 3) s += arch(x + 9 + j * 20.5, Y - 50 - u * 17, 9, 13, 'var(--gl)');
  for (let u = 0; u < ups; u++) s += `<path d="M${x} ${r(Y - 34 - u * 17)}h${w}" stroke="${STUCCO}" stroke-width="1.6"/>`; // taş silme
  // giriş: yüksek kemer + alınlık + saat
  const gx = x + 63, gw = 24;
  s += rect(gx - 4, yt - 10, gw + 8, h + 10 - 1, STUCCO, .9) + arch(gx, Y - 40, gw, 40, '#cfe3ee') + `<path d="M${gx + gw / 2} ${Y}v-28" stroke="var(--ink)" stroke-width=".6"/>`;
  s += poly([[gx - 7, yt - 10], [gx + gw + 7, yt - 10], [gx + gw / 2, yt - 26]], STUCCO, 1) + `<circle cx="${gx + gw / 2}" cy="${r(yt - 15)}" r="3.6" fill="#fbfbf7" ${INK} stroke-width=".7"/>`;
  return s + tree(176, Y + 4, .8);
}
/** de: Markthalle: klinker tuğla hal, ortada yuvarlak kemerli büyük pencereli kademeli alınlık, mahya boyu çatı feneri. */
function carsiDe(_P: Pal, hm: number) {
  const h = 56 * hm, x = 10, w = 150, B = '#a5543b', BS = '#83412e', yt = Y - h;
  let s = shadow(x, w) + box(x, Y, w, h, B, BS, null);
  s += poly([[x - 2, yt], [x + w + 2, yt], [x + w + D, yt - DD - 4], [x + D, yt - DD - 4]], '#5e6670') + poly([[x + 30, yt - 5], [x + w - 10, yt - 5], [x + w - 10 + 10, yt - 12], [x + 40, yt - 12]], '#cfe3ee', .8); // çatı + fener
  for (let k = 0; k < 7; k++) { if (k === 3) continue; s += arch(x + 7 + k * 20.5, Y - 26, 13, 22, 'var(--gl)') + `<path d="M${r(x + 7 + k * 20.5)} ${Y - 30}h13" stroke="${STUCCO2}" stroke-width="1.4"/>`; }
  for (let u = 0; u < Math.floor((h - 34) / 14); u++) for (let j = 0; j < 7; j++) if (j !== 3) s += rect(x + 9 + j * 20.5, Y - 46 - u * 14, 9, 9, 'var(--gl)', .5);
  // kademeli alınlık + termal pencere
  const gx = x + 52, gw = 46, gh = h + 30 * hm;
  s += box(gx, Y, gw, gh, B, BS, null, 10, 7);
  s += poly([[gx, Y - gh], [gx + 8, Y - gh], [gx + 8, Y - gh - 8], [gx + 16, Y - gh - 8], [gx + 16, Y - gh - 16], [gx + gw - 16, Y - gh - 16], [gx + gw - 16, Y - gh - 8], [gx + gw - 8, Y - gh - 8], [gx + gw - 8, Y - gh], [gx + gw, Y - gh]], B, 1);
  s += arch(gx + 7, Y - gh + 34, gw - 14, 30, 'var(--gl)') + `<path d="M${gx + gw / 2} ${r(Y - gh + 34)}v-22M${gx + 9} ${r(Y - gh + 22)}h${gw - 18}" stroke="var(--ink)" stroke-width=".8"/>`;
  s += arch(gx + 13, Y - 26, 20, 26, '#5c4436');
  return s + tree(176, Y + 4, .8);
}
function plaza(P: Pal, st: string, hm: number) {
  if (st === 'uk') return plazaUk(P, hm);
  if (st === 'de') return plazaDe(P, hm);
  // alçak podyum + cam kule; tr: plaza tabelası, us: kademeli Art Deco tepe + anten, jp: dikey neon tabela
  const ph = 30, th = 92 * hm, tx = 54, tw = 64;
  let s = shadow(14, 150) + box(14, Y, 150, ph, P.f, P.s, P.t);
  s += wins(20, Y - 22, 7, 14, 14, 6, 'var(--gl)');
  s += shadow(tx, tw, Y - ph) + box(tx, Y - ph, tw, th, '#7fa7c6', '#5f89ad', st === 'us' ? null : '#c5d3dd');
  const fl = Math.floor(th / 9);
  for (let k = 1; k < fl; k++) s += `<path d="M${tx} ${r(Y - ph - k * 9)}h${tw}" stroke="var(--ink)" stroke-width=".45" opacity=".7"/>`;
  for (let k = 1; k < 4; k++) s += `<path d="M${tx + k * 16} ${Y - ph}v${r(-th)}" stroke="var(--ink)" stroke-width=".45" opacity=".7"/>`;
  const yt = Y - ph - th;
  if (st === 'us') {
    s += box(tx + 10, yt, tw - 20, 16, '#6f9cc4', '#4e7ba3', null, 18, 13) + box(tx + 20, yt - 16, tw - 40, 12, '#6f9cc4', '#4e7ba3', '#b7bec7', 12, 9);
    s += `<path d="M${tx + tw / 2 + 4} ${r(yt - 28)}v-12" stroke="var(--ink)" stroke-width="1.6"/>`;
  } else if (st === 'jp') {
    s += rect(tx - 12, Y - ph - th + 18, 10, 70, P.acc, 1) + `<path d="M${tx - 7} ${Y - ph - th + 24}v58" stroke="#fbfbf7" stroke-width="2.4" stroke-dasharray="6 4"/>`;
    s += `<circle cx="${tx + tw / 2 + 10}" cy="${r(yt - 12)}" r="3" fill="#c23b2e" ${INK} stroke-width=".6"/>`;
  } else {
    s += rect(tx + 8, yt - 14, tw - 16, 12, '#1e3a32', .8) + `<text x="${tx + tw / 2}" y="${r(yt - 5)}" text-anchor="middle" font-family="IBM Plex Sans Condensed,Arial Narrow,sans-serif" font-weight="700" font-size="9" letter-spacing="2" fill="#ffc21a">PLAZA</text>`;
  }
  return s + tree(10, Y + 4, .8) + tree(180, Y + 2, .8);
}
/** uk: City kulesi: Viktoryen tuğla depo podyumu (kemerli pencereler) + çapraz örgülü, yuvarlak tepeli cam kule. */
function plazaUk(P: Pal, hm: number) {
  const ph = 32, th = 90 * hm, tx = 56, tw = 60;
  let s = shadow(14, 150) + box(14, Y, 150, ph, P.f, P.s, P.t);
  for (let j = 0; j < 7; j++) s += arch(20 + j * 20, Y - 24, 11, 18, 'var(--gl)');
  s += `<path d="M14 ${Y - 28}h150" stroke="${STUCCO}" stroke-width="1.6"/>`;
  const yb = Y - ph, yt = yb - th;
  s += shadow(tx, tw, yb) + box(tx, yb, tw, th, '#86afc9', '#628dad', null);
  // yuvarlak tepe: arka kubbe (yan yüz rengi, derinlik kadar kaymış) + ön kubbe
  s += `<path d="M${tx + D} ${r(yt - DD)} Q${tx + tw / 2 + D} ${r(yt - DD - 34)} ${tx + tw + D} ${r(yt - DD)} L${tx + tw} ${r(yt)} Z" fill="#6f98b8" ${INK} stroke-width="1"/>`;
  s += `<path d="M${tx} ${r(yt)} Q${tx + tw / 2} ${r(yt - 34)} ${tx + tw} ${r(yt)} Z" fill="#9cc0d6" ${INK} stroke-width="1.1"/>`;
  // çapraz örgü (diagrid)
  // çapraz örgü (diagrid): çizgiler cephenin içinde kırpılır (clipPath kimliği sayfada çakışmasın diye hesapla)
  let g = ''; const dx = th * .45;
  const seg = (x0: number, d: number) => {
    let a = 0, b = 1; const lo = (tx - x0) / d, hi = (tx + tw - x0) / d;
    a = Math.max(a, Math.min(lo, hi)); b = Math.min(b, Math.max(lo, hi)); if (b <= a) return;
    g += `M${r(x0 + a * d)} ${r(yb - a * th)}L${r(x0 + b * d)} ${r(yb - b * th)}`;
  };
  for (let k = -8; k < 12; k++) { seg(tx + k * 12, dx); seg(tx + k * 12, -dx); }
  s += `<path d="${g}" stroke="var(--ink)" stroke-width=".5" opacity=".55"/>`;
  return s + tree(10, Y + 4, .8) + tree(180, Y + 2, .8);
}
/** de: Bauhaus büro kulesi: beyaz prizma, yatay şerit pencereler, cam merdiven kulesi, düz çatı, üç ana renk işareti. */
function plazaDe(_P: Pal, hm: number) {
  const ph = 28, th = 94 * hm, tx = 50, tw = 70, W = '#f2f1ec', WS = '#d3d2cb';
  let s = shadow(14, 150) + box(14, Y, 150, ph, W, WS, '#e4e3dd');
  s += rect(18, Y - 20, 142, 10, '#3b4a57', .7) + rect(18, Y - 6, 142, 3, '#3b4a57', .5);
  const yb = Y - ph, yt = yb - th;
  s += shadow(tx, tw, yb) + box(tx, yb, tw, th, W, WS, '#e4e3dd');
  for (let y = yb - 10; y > yt + 6; y -= 13) s += rect(tx + 4, y - 6, tw - 8, 7, '#3b4a57', .6) + poly([[tx + tw, y + 1], [tx + tw + D, y + 1 - DD], [tx + tw + D, y - 6 - DD], [tx + tw, y - 6]], '#33414d', .5);
  s += rect(tx - 12, yt + 8, 12, th - 8, '#9ec0d6', .9); // cam merdiven kulesi
  for (let y = yb - 8; y > yt + 10; y -= 8) s += `<path d="M${tx - 12} ${y}h12" stroke="var(--ink)" stroke-width=".4"/>`;
  s += rect(tx + 10, yt - 8, 20, 8, W, .8) + rect(tx + tw - 22, yt - 14, 3, 14, '#3b4a57', .5); // çatı odası + baca
  s += rect(tx + tw - 30, yb - 30, 8, 8, '#c23b2e', .6) + rect(tx + tw - 30, yb - 22, 8, 8, '#e0a21b', .6) + rect(tx + tw - 30, yb - 14, 8, 8, '#1f4e8c', .6);
  return s + tree(10, Y + 4, .8) + tree(180, Y + 2, .8);
}
function karma(P: Pal, st: string, hm: number) {
  if (st === 'uk') return karmaUk(P, hm);
  if (st === 'de') return karmaDe(P, hm);
  // tr: iki katlı taş han, kemerli revak + kubbeler; us: tuğla loft bloğu + yangın merdiveni + su deposu; jp: yokochō, alçak sıra + fenerler
  const h = 64 * hm, x = 12, w = 146;
  let s = shadow(x, w) + box(x, Y, w, h, P.f, P.s, st === 'tr' ? null : P.t);
  if (st === 'tr') {
    for (let k = 0; k < 7; k++) s += arch(x + 6 + k * 20, Y - 22, 13, 22, '#6b4a3a');
    const ups = Math.max(1, Math.floor((h - 26) / 18));
    for (let u = 0; u < ups; u++) for (let k = 0; k < 7; k++) s += arch(x + 8 + k * 20, Y - 42 - u * 18, 9, 13, 'var(--gl)');
    s += poly([[x - 4, Y - h], [x + w + 4, Y - h], [x + w + D + 2, Y - h - DD], [x + D - 2, Y - h - DD]], P.rf);
    for (let k = 0; k < 3; k++) s += `<ellipse cx="${x + 34 + k * 44}" cy="${r(Y - h - 10)}" rx="11" ry="8" fill="#9fb3bf" ${INK} stroke-width=".9"/>`;
    s += `<path d="M${x + 122} ${r(Y - h - 6)}v-16h6v14" fill="#cdbd9c" ${INK}/>`;
  } else if (st === 'us') {
    const fl = Math.floor(h / 15);
    for (let k = 0; k < fl; k++) s += wins(x + 6, Y - 13 - k * 15, 8, 12, 10, 5.5);
    for (let k = 1; k < fl; k++) s += `<path d="M${x + 60} ${r(Y - k * 15)}h28M${x + 64} ${r(Y - k * 15)}l20 -11" stroke="var(--ink)" stroke-width="1.1"/>`;
    s += rect(x + 108, Y - h - 30, 18, 20, '#8a6a4a', 1) + poly([[x + 106, Y - h - 30], [x + 128, Y - h - 30], [x + 117, Y - h - 40]], '#5b5f66') + `<path d="M${x + 110} ${r(Y - h - 10)}v-0M${x + 112} ${r(Y - h - 10)}l-2 ${10}M${x + 124} ${r(Y - h - 10)}l2 ${10}" stroke="var(--ink)" stroke-width="1"/>`;
    s += rect(x + 10, Y - h - 6, 50, 6, '#2c3440', .8);
  } else {
    for (let k = 0; k < 6; k++) s += rect(x + 6 + k * 23.5, Y - 24, 18, 20, k % 2 ? 'var(--gl)' : '#6b4a3a', .7) + rect(x + 4 + k * 23.5, Y - 30, 22, 6, k % 2 ? P.acc : '#1e3a32', .6);
    const ups = Math.floor((h - 30) / 16);
    for (let u = 0; u < ups; u++) s += wins(x + 8, Y - 48 - u * 16, 6, 16, 9, 7.5);
    s += poly([[x - 4, Y - h], [x + w + 4, Y - h], [x + w + D, Y - h - DD], [x + D - 4, Y - h - DD]], P.rf);
    for (let k = 0; k < 7; k++) s += `<ellipse cx="${x + 8 + k * 22}" cy="${Y - 36}" rx="3.6" ry="5" fill="${k % 2 ? '#e0a21b' : '#c23b2e'}" ${INK} stroke-width=".6"/>`;
  }
  return s + tree(176, Y + 4, .8);
}
/** uk: rıhtım ambarı loftları: sarı "London stock" tuğla, basık kemerli pencere sıraları, yükleme kapıları + vinç kolu. */
function karmaUk(_P: Pal, hm: number) {
  const h = 70 * hm, x = 12, w = 146, B = '#c9a46a', BS = '#a5844f';
  let s = shadow(x, w) + box(x, Y, w, h, B, BS, '#b8b0a2');
  const fl = Math.floor((h - 6) / 15);
  for (let k = 0; k < fl; k++) for (let j = 0; j < 8; j++) if (j !== 4) s += arch(x + 6 + j * 17.5, Y - 14 - k * 15, 10, 11, 'var(--gl)');
  for (let k = 0; k < fl; k++) s += rect(x + 74, Y - 15 - k * 15, 12, 13, '#3b5b4a', .7); // yükleme kapıları
  s += `<path d="M${x + 80} ${r(Y - h)}v-6h18M${x + 96} ${r(Y - h - 6)}v12" stroke="var(--ink)" stroke-width="1.4" fill="none"/><path d="M${x + 96} ${r(Y - h + 6)}l-2 4h4z" fill="var(--ink)"/>`;
  s += rect(x + 8, Y - h - 6, 54, 6, '#2c3440', .8) + rect(x + 120, Y - h - 20, 9, 20, B, .9); // tabela bandı + baca
  return s + tree(176, Y + 4, .8);
}
/** de: Kontorhaus: koyu klinker, sık düşey ayaklar, kademeli üst katlar, kemerli zemin kat. */
function karmaDe(_P: Pal, hm: number) {
  const h = 66 * hm, x = 12, w = 146, B = '#6e3a2d', BS = '#552c22', L = '#8c4d3b';
  let s = shadow(x, w) + box(x, Y, w, h, B, BS, '#7b4a3c');
  for (let j = 0; j < 7; j++) s += arch(x + 6 + j * 20, Y - 20, 13, 20, 'var(--gl)');
  const piers = (x0: number, w0: number, yb: number, hh: number) => { let g = ''; for (let xx = x0 + 6; xx < x0 + w0 - 2; xx += 7) g += `M${r(xx)} ${r(yb)}v${r(-hh)}`; return `<path d="${g}" stroke="${L}" stroke-width="2.4"/>`; };
  s += piers(x, w, Y - 24, h - 26);
  for (let y = Y - 34; y > Y - h + 4; y -= 12) s += `<path d="M${x + 3} ${y}h${w - 6}" stroke="var(--gl)" stroke-width="3" opacity=".75"/>`;
  const s1 = 16 * hm, s2 = 12 * hm;
  s += box(x + 14, Y - h, w - 28, s1, B, BS, null, 18, 13) + piers(x + 14, w - 28, Y - h, s1);
  s += box(x + 30, Y - h - s1, w - 60, s2, B, BS, '#7b4a3c', 12, 9) + piers(x + 30, w - 60, Y - h - s1, s2);
  return s + tree(176, Y + 4, .8);
}
const KIND: Record<string, (P: Pal, st: string, hm: number) => string> = { site, carsi, plaza, karma };

/** Bitmiş proje (etap 1 ya da 2). */
export function projSvg(kind: string, style: string, stage: number): string {
  const P = PAL[style] || PAL.tr;
  return ground(P) + (KIND[kind] || site)(P, PAL[style] ? style : 'tr', stage >= 2 ? 1.35 : 1);
}
/** Tüm üsluplar (test ve görsel karşılaştırma için). */
export const PJ_STYLES = Object.keys(PAL);
/** Şantiye: hedef bina silik, ilerlemeye kadar dolu; iskele, file ve kule vinç. id: clipPath kimliği (sayfada tekil). */
export function projSite(kind: string, style: string, stage: number, prog: number, id: string): string {
  const full = projSvg(kind, style, stage), top = 16, cut = Y - 150 * Math.max(.06, Math.min(1, prog)) ** 1.4;
  let s = `<defs><clipPath id="${id}"><rect x="0" y="${r(cut)}" width="200" height="${r(200 - cut)}"/></clipPath></defs>`;
  s += `<g opacity=".1">${full}</g><g clip-path="url(#${id})">${full}</g>`;
  // iskele
  let sc = ''; for (let x = 14; x <= 166; x += 19) sc += `M${x} ${Y}V${r(Math.max(cut - 8, top + 20))}`;
  for (let y = Y - 14; y > Math.max(cut - 8, top + 20); y -= 14) sc += `M10 ${y}H170`;
  s += `<path d="${sc}" stroke="var(--sc)" stroke-width="1.1" opacity=".9"/>`;
  s += `<rect x="10" y="${r(Math.max(cut - 8, top + 20))}" width="160" height="${r(Y - Math.max(cut - 8, top + 20))}" fill="var(--net)" opacity=".35"/>`;
  // kule vinç
  s += `<path d="M184 ${Y}V14M180 ${Y}V14M180 14h-150M184 14l-16 -8M30 14v${r(Math.max(10, cut - 30))}" stroke="var(--cr)" stroke-width="2.2" fill="none"/><path d="M180 ${Y}V14" stroke="var(--ink)" stroke-width=".6" stroke-dasharray="3 3"/>`;
  s += rect(24, Math.max(24, cut - 26), 12, 8, 'var(--cr)', .8);
  // bariyer
  s += `<path d="M4 194h192" stroke="var(--haz)" stroke-width="4" stroke-dasharray="8 6"/>`;
  return s;
}
export const psvg = (inner: string, cls = '') => `<svg class="${cls}" viewBox="0 0 200 200"${cls === 'art' ? ' preserveAspectRatio="xMidYMax meet"' : ''} aria-hidden="true">${inner}</svg>`;
