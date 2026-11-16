/* =========================================================
   DÜNYA TARİHİ YAPILARI — landmarks.ts ile aynı düz, çizgisiz "pafta" üslubu (viewBox 100×100, zemin ~y 91):
   tema token'lı dolgular (pl/pl2 taş, sl açık taş, fr beyaz, sol mavi çatı, rf/ch kiremit-tuğla, tk metal, gl pencere
   ışığı, gl2 su, sgn kırmızı, bb altın, vg/vg2 bakır pası yeşili). Koyu temada pencereler (gl) mevcut yapılar gibi yanar.
   - Koleksiyon (taksi / moloz / etkinlik): ABD, Birleşik Krallık, Almanya, Japonya için 10'ar yapı.
   - İhale salonu (rakip emlakçıyla ihale): her ülkeye 4 yapı (Türkiye dahil).
   ========================================================= */
const sh = (rx = 30, cx = 50) => `<ellipse class="sh" cx="${cx}" cy="92" rx="${rx}" ry="4"/>`;
/** Pencere ızgarası. */
const W = (x: number, y: number, cols: number, rows: number, dx: number, dy: number, w: number, h: number, c = 'gl') => {
  let s = ''; for (let r = 0; r < rows; r++) for (let k = 0; k < cols; k++) s += `<rect class="${c}" x="${x + k * dx}" y="${y + r * dy}" width="${w}" height="${h}"/>`; return s;
};
/** Kemerli pencere dizisi. */
const A = (xs: number[], y: number, w = 4, h = 8, c = 'gl') => xs.map(x => `<path class="${c}" d="M${x} ${y + h}v-${h - w / 2}a${w / 2} ${w / 2} 0 0 1 ${w} 0v${h - w / 2}z"/>`).join('');
const R = (c: string, x: number, y: number, w: number, h: number, extra = '') => `<rect class="${c}" x="${x}" y="${y}" width="${w}" height="${h}"${extra}/>`;
const PG = (c: string, pts: string) => `<polygon class="${c}" points="${pts}"/>`;
const PT = (c: string, d: string, extra = '') => `<path class="${c}" d="${d}"${extra}/>`;
const range = (n: number, f: (k: number) => string) => Array.from({ length: n }, (_, k) => f(k)).join('');

const D: Record<string, () => string> = {
  /* ---------------- ABD · koleksiyon ---------------- */
  brooklyn: () => `<ellipse class="gl2" cx="50" cy="90" rx="49" ry="7"/>${R('pst', 0, 70, 100, 3)}
    ${[22, 66].map(x => R('ch', x, 26, 12, 64) + R('ch2', x + 9, 26, 3, 64) + A([x + 2, x + 7], 34, 3, 16, 'dr') + R('ch2', x - 1, 24, 14, 3)).join('')}
    ${PT('rl', 'M0 66Q14 64 28 27M28 27Q50 62 72 27M72 27Q86 64 100 66')}${PT('rl', 'M8 63v7M14 58v12M20 48v22M36 50v20M44 60v10M56 60v10M64 50v20M80 48v22M86 58v12M92 63v7')}`,
  chrysler: () => sh(16) + `${R('pl', 36, 54, 28, 37)}${R('pl2', 58, 54, 6, 37)}${W(39, 58, 4, 6, 5, 5, 3, 3)}
    ${R('sl', 40, 36, 20, 18)}${W(43, 40, 3, 2, 5, 6, 3, 3)}
    ${PT('tk', 'M40 36Q40 18 50 10Q60 18 60 36z')}${PT('tk2', 'M55 36Q57 22 50 10Q60 18 60 36z')}
    ${[30, 24, 18].map((y, j) => PT('gl', `M${43 + j * 2} ${y + 4}l${7 - j * 2} -${5 - j} ${7 - j * 2} ${5 - j}z`)).join('')}${R('tk2', 49.4, 1, 1.2, 10)}`,
  flatiron: () => sh(28) + `${PG('pl', '20,91 80,91 80,40 50,22 20,40')}${PG('pl2', '50,22 80,40 80,91 50,91')}
    ${range(6, r => W(24, 46 + r * 7, 3, 1, 8, 0, 4, 4) + W(55, 46 + r * 7, 3, 1, 8, 0, 4, 4))}
    ${R('sl', 18, 38, 64, 3)}${R('dr', 46, 82, 8, 9)}`,
  grandcentral: () => sh(44) + `${R('sl', 8, 50, 84, 41)}${R('pl', 8, 84, 84, 7)}
    ${A([20, 42, 64], 56, 16, 26)}${PT('rl', 'M28 56v26M50 56v26M72 56v26')}
    ${R('pl', 8, 44, 84, 6)}${R('sl', 38, 30, 24, 14)}<circle class="fr" cx="50" cy="37" r="5.5"/>${PT('rl', 'M50 37v-3.5M50 37l2.5 1.5')}
    ${PG('vg', '44,30 50,22 56,30')}${R('pl2', 8, 50, 6, 34)}${R('pl2', 86, 50, 6, 34)}`,
  hollywood: () => `${PT('tr2', 'M0 91Q20 40 46 48T100 40V91z')}${PT('tr', 'M0 91Q30 80 60 84T100 82V91z')}
    <text x="50" y="76" text-anchor="middle" textLength="88" lengthAdjust="spacingAndGlyphs" font-family="Barlow Condensed,Arial Narrow,sans-serif" font-weight="700" font-size="19" style="fill:var(--fr)">HOLLYWOOD</text>
    ${PT('rl', 'M10 76v6M20 76v6M30 76v6M40 76v6M50 76v6M60 76v6M70 76v6M80 76v6M90 76v6')}`,
  smpier: () => `<ellipse class="gl2" cx="50" cy="90" rx="49" ry="7"/>${R('pl2', 0, 74, 100, 4)}${range(9, k => R('pl2', 4 + k * 11, 78, 2, 12))}
    <circle class="tk" cx="66" cy="44" r="24"/><circle class="gl2" cx="66" cy="44" r="19"/>${range(8, k => { const a = k * Math.PI / 4; return `<path class="rl" d="M66 44L${(66 + 24 * Math.cos(a)).toFixed(1)} ${(44 + 24 * Math.sin(a)).toFixed(1)}"/>` + `<rect class="sgn" x="${(64 + 24 * Math.cos(a)).toFixed(1)}" y="${(42 + 24 * Math.sin(a)).toFixed(1)}" width="4" height="4" rx="1"/>`; })}
    ${PG('pst', '60,74 66,44 72,74')}${R('fr', 8, 60, 30, 14)}${PG('sgn', '6,60 23,50 40,60')}${R('gl', 13, 64, 6, 6)}${R('gl', 26, 64, 6, 6)}`,
  capitolrec: () => sh(22) + `${range(12, k => `<ellipse class="${k % 2 ? 'tk' : 'fr'}" cx="50" cy="${86 - k * 5.4}" rx="${20 - k * .9}" ry="3"/>`)}
    ${range(12, k => `<rect class="gl" x="${36 + k * 0.8}" y="${84 - k * 5.4}" width="${28 - k * 1.7}" height="1.6"/>`)}
    ${R('pst', 49.3, 4, 1.4, 18)}<circle class="sgn" cx="50" cy="4" r="1.8"/>`,
  willis: () => sh(22) + `${R('hk', 30, 50, 12, 41)}${R('hk', 44, 26, 12, 65)}${R('pst', 58, 38, 12, 53)}${R('pst', 72, 62, 8, 29)}${R('hk', 20, 66, 9, 25)}
    ${W(32, 54, 2, 9, 5, 4, 3, 2)}${W(46, 30, 2, 15, 5, 4, 3, 2)}${W(60, 42, 2, 12, 5, 4, 3, 2)}
    ${R('tk2', 47, 12, 1.4, 14)}${R('tk2', 52, 14, 1.4, 12)}`,
  bean: () => `${R('sl', 0, 84, 100, 8)}${PT('rl', 'M0 88h100')}${R('pl2', 8, 30, 14, 54)}${R('pl', 80, 40, 14, 44)}${W(10, 34, 2, 10, 6, 5, 3, 2)}
    <ellipse class="tk" cx="50" cy="66" rx="30" ry="17"/><ellipse class="tk2" cx="50" cy="80" rx="20" ry="4"/>
    ${PT('fr', 'M30 60Q40 52 56 54Q42 56 34 64z', ' opacity=".8"')}<ellipse class="gl2" cx="62" cy="64" rx="9" ry="5" opacity=".6"/>`,
  wrigley: () => sh(40) + `${R('pl2', 10, 70, 80, 21)}${A([16, 30, 44, 58, 72], 76, 8, 12, 'dr')}
    ${R('sgn', 28, 30, 44, 24, ' rx="2"')}${R('fr', 31, 36, 38, 9)}${PT('sgw', 'M34 40.5h32')}${R('pst', 42, 54, 3, 16)}${R('pst', 55, 54, 3, 16)}
    ${R('sgn', 40, 46, 20, 5)}${range(7, k => `<circle class="bb" cx="${32 + k * 6}" cy="33" r="1.1"/>`)}`,
  /* ---------------- ABD · ihale ---------------- */
  empire: () => sh(18) + `${R('sl', 30, 64, 40, 27)}${R('pl', 64, 64, 6, 27)}${R('sl', 36, 40, 28, 24)}${R('pl', 59, 40, 5, 24)}
    ${R('sl', 41, 24, 18, 16)}${R('pl', 55, 24, 4, 16)}${R('sl', 45, 14, 10, 10)}${PG('tk', '46,14 50,6 54,14')}${R('tk2', 49.4, 0, 1.2, 7)}
    ${W(33, 67, 6, 4, 5.5, 6, 2.4, 3.5)}${W(39, 43, 4, 4, 5.5, 5.4, 2.4, 3)}${W(44, 27, 3, 2, 4.5, 6, 2.4, 3)}`,
  griffith: () => `${PT('tr2', 'M0 91Q30 72 54 76T100 70V91z')}${R('fr', 14, 62, 72, 24)}${R('tk2', 14, 80, 72, 6)}
    ${A([20, 28, 66, 74], 66, 5, 10)}${R('dr', 46, 70, 8, 10)}
    <path class="tk" d="M36 62a14 14 0 0 1 28 0z"/><path class="tk2" d="M50 48a14 14 0 0 1 14 14H50z"/>
    ${[14, 76].map(x => R('fr', x, 54, 10, 8) + `<path class="tk" d="M${x} 54a5 5 0 0 1 10 0z"/>`).join('')}`,
  watertower: () => sh(24) + `${R('fr', 32, 46, 36, 45)}${R('sl', 62, 46, 6, 45)}${R('fr', 24, 66, 10, 25)}${R('fr', 66, 66, 10, 25)}
    ${A([38, 46, 54], 54, 4, 10)}${R('dr', 45, 78, 10, 13)}${[24, 32, 62, 66, 72].map(x => PG('sl', `${x},${x === 32 || x === 62 ? 46 : 66} ${x + 2},${x === 32 || x === 62 ? 40 : 60} ${x + 4},${x === 32 || x === 62 ? 46 : 66}`)).join('')}
    ${R('fr', 42, 26, 16, 20)}${A([46], 30, 4, 10)}${R('fr', 45, 14, 10, 12)}${PG('sl', '44,14 50,0 56,14')}`,
  /* ---------------- Birleşik Krallık · koleksiyon ---------------- */
  londoneye: () => `<ellipse class="gl2" cx="50" cy="90" rx="49" ry="7"/><circle class="rl" cx="50" cy="44" r="34" style="stroke-width:1.6"/>
    ${range(16, k => { const a = k * Math.PI / 8, x = 50 + 34 * Math.cos(a), y = 44 + 34 * Math.sin(a); return `<path class="rl" d="M50 44L${x.toFixed(1)} ${y.toFixed(1)}" style="stroke-width:.4"/><ellipse class="fr" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="2.6" ry="2"/>`; })}
    <circle class="tk2" cx="50" cy="44" r="3"/>${PT('pst', 'M50 44L36 86h4L50 50 60 86h4z')}`,
  stpauls: () => sh(40) + `${R('sl', 10, 60, 80, 31)}${R('pl', 10, 84, 80, 7)}${A([16, 24, 70, 78], 66, 4, 10)}
    ${R('fr', 36, 62, 28, 22)}${range(6, k => R('sl', 37 + k * 5, 64, 1.6, 20))}${PG('fr', '34,62 50,54 66,62')}
    ${R('sl', 36, 38, 28, 12)}${W(38, 40, 6, 1, 4.4, 0, 2, 7)}<path class="tk2" d="M34 38a16 18 0 0 1 32 0z"/><path class="tk" d="M50 20a16 18 0 0 1 16 18H50z"/>
    ${R('fr', 47, 12, 6, 8)}<circle class="bb" cx="50" cy="10" r="2"/>${[12, 76].map(x => R('fr', x, 44, 12, 16) + PG('tk2', `${x},44 ${x + 6},34 ${x + 12},44`)).join('')}`,
  gherkin: () => sh(18) + `<path class="sol" d="M50 6C70 18 72 54 64 91H36C28 54 30 18 50 6z"/>
    ${range(7, k => `<path class="gl" d="M${36 + k * 4} 91C${32 + k * 3} 60 ${40 + k * 1.6} 30 50 6" fill="none" style="fill:none;stroke:var(--gl);stroke-width:1.1"/>`)}
    ${range(9, k => `<path class="rl" d="M${33 + Math.abs(4 - k) * .6} ${84 - k * 8}h${34 - Math.abs(4 - k) * 1.2}"/>`)}`,
  shard: () => sh(20) + `${PG('tk2', '30,91 70,91 52,6')}${PG('tk', '30,91 52,6 46,91')}${PG('gl2', '52,6 70,91 58,91')}
    ${range(10, k => `<path class="rl" d="M${33 + k * 1.8} ${84 - k * 8}h${34 - k * 3.6}"/>`)}${PT('rl', 'M49 6l-2 6M55 8l1 5')}`,
  routemaster: () => `${R('pst', 4, 87, 92, 2.4)}${R('sgn', 12, 34, 74, 50, ' rx="5"')}${R('fr', 12, 58, 74, 3)}
    ${W(16, 39, 6, 1, 11.4, 0, 9, 13)}${W(26, 64, 5, 1, 11, 0, 8, 11)}${R('hk', 14, 64, 9, 17)}${R('bb', 30, 54, 30, 3)}
    <circle class="hk" cx="28" cy="84" r="6"/><circle class="hk" cx="72" cy="84" r="6"/><circle class="tk2" cx="28" cy="84" r="2.4"/><circle class="tk2" cx="72" cy="84" r="2.4"/>`,
  phonebox: () => sh(16) + `${R('sgn', 36, 22, 28, 69, ' rx="2"')}<path class="sgn" d="M34 24a16 6 0 0 1 32 0z"/>${R('fr', 39, 26, 22, 4)}
    ${W(40, 34, 3, 6, 7, 8, 5, 6)}${R('bb', 47, 18, 6, 4, ' rx="1"')}${R('sgn', 34, 88, 32, 3)}`,
  beetham: () => sh(14) + `${R('gl2', 40, 8, 20, 83)}${R('tk2', 56, 8, 4, 83)}${R('tk', 40, 30, 26, 61)}${R('gl2', 40, 30, 22, 61)}
    ${range(20, k => `<path class="rl" d="M40 ${12 + k * 4}h${k > 5 ? 26 : 20}"/>`)}${R('tk2', 62, 30, 4, 61)}`,
  centrallib: () => sh(40) + `${R('sl', 12, 46, 76, 45)}${range(8, k => R('fr', 16 + k * 9.4, 50, 3, 34))}${R('pl', 12, 84, 76, 7)}
    ${R('sl', 10, 42, 80, 5)}<path class="tk2" d="M22 42a28 12 0 0 1 56 0z"/>${R('pl2', 12, 50, 76, 3)}${R('dr', 45, 70, 10, 14)}`,
  scottmon: () => `<ellipse class="tr" cx="16" cy="88" rx="14" ry="5"/><ellipse class="tr2" cx="86" cy="88" rx="13" ry="5"/>` + sh(22) + `
    ${R('pl2', 30, 74, 40, 17)}${PG('pl2', '36,74 64,74 58,40 42,40')}${PG('pst', '42,40 58,40 50,4')}
    ${[30, 64].map(x => PG('pst', `${x},74 ${x + 6},74 ${x + 3},48`)).join('')}${A([44, 52], 54, 4, 14, 'gl2')}${A([40, 56], 78, 4, 10, 'gl2')}
    ${PT('rl', 'M42 40L50 4L58 40M46 24h8')}`,
  forthbridge: () => `<ellipse class="gl2" cx="50" cy="90" rx="49" ry="7"/>${R('sgn', 0, 44, 100, 4)}
    ${[18, 50, 82].map(x => PG('sgn', `${x - 16},48 ${x - 3},20 ${x + 3},20 ${x + 16},48 ${x + 10},48 ${x},28 ${x - 10},48`) + R('ch2', x - 4, 48, 8, 38)).join('')}
    ${PT('rl', 'M2 46h96M10 48l8-24M26 48l-8-24M42 48l8-24M58 48l-8-24M74 48l8-24M90 48l-8-24')}`,
  /* ---------------- Birleşik Krallık · ihale ---------------- */
  edicastle: () => `${PT('pl2', 'M0 91L8 70Q20 60 40 62L60 58Q80 56 92 66L100 91z')}${PT('tr2', 'M0 91L6 80Q16 74 30 78L40 91z')}
    ${R('sl', 14, 40, 70, 22)}${R('pl', 70, 40, 14, 22)}${range(12, k => R('sl', 14 + k * 6, 36, 3.4, 4))}
    ${R('sl', 30, 24, 20, 16)}${range(4, k => R('sl', 30 + k * 5.5, 20, 3, 4))}${R('fr', 58, 30, 12, 10)}${PG('sol', '56,30 64,20 72,30')}
    ${W(18, 46, 8, 2, 8, 8, 3, 4)}${A([36, 43], 28, 3, 7)}`,
  mantownhall: () => sh(42) + `${R('sl', 8, 54, 84, 37)}${R('pl', 8, 84, 84, 7)}${A([12, 20, 28, 64, 72, 80], 60, 4, 12)}${A([12, 20, 28, 64, 72, 80], 74, 4, 8)}
    ${R('sl', 40, 20, 20, 64)}${R('pl', 54, 20, 6, 64)}<circle class="fr" cx="50" cy="32" r="5"/>${PT('rl', 'M50 32v-3.4M50 32l2.4 1.4')}
    ${A([43, 50], 44, 4, 14)}${R('dr', 45, 70, 10, 14)}${PG('pst', '38,20 50,2 62,20')}${range(6, k => PG('pst', `${8 + k * 3},54 ${9.5 + k * 3},50 ${11 + k * 3},54`) + PG('pst', `${74 + k * 3},54 ${75.5 + k * 3},50 ${77 + k * 3},54`))}`,
  /* ---------------- Almanya · koleksiyon ---------------- */
  fernsehturm: () => sh(14) + `${R('pl2', 40, 84, 20, 7)}${PG('sl', '46,86 54,86 52.2,30 47.8,30')}${PG('pl', '51,86 54,86 52.2,30 51,30')}
    <circle class="tk" cx="50" cy="32" r="9"/><path class="tk2" d="M50 23a9 9 0 0 1 0 18z"/>${R('gl', 41.4, 31, 17.2, 2.2)}
    ${R('sl', 49, 12, 2, 12)}${R('sgn', 49.3, 2, 1.4, 10)}${R('fr', 49.3, 6, 1.4, 1.6)}`,
  reichstag: () => sh(44) + `${R('sl', 8, 54, 84, 37)}${R('pl', 8, 84, 84, 7)}${[8, 78].map(x => R('pl', x, 44, 14, 47)).join('')}
    ${R('fr', 34, 54, 32, 30)}${range(6, k => R('sl', 36 + k * 5.4, 58, 2, 26))}${PG('fr', '32,54 50,44 68,54')}
    ${A([12, 16, 82, 86], 60, 2.6, 8)}${A([24, 28, 70, 74], 60, 2.6, 8)}
    <path class="gl2" d="M36 44a14 14 0 0 1 28 0z"/>${PT('rl', 'M36 44a14 14 0 0 1 28 0M40 44a10 13 0 0 1 20 0M44 44a6 12 0 0 1 12 0M50 30v14M38 38h24')}`,
  siegessaule: () => `<ellipse class="tr" cx="16" cy="88" rx="15" ry="6"/><ellipse class="tr2" cx="84" cy="88" rx="15" ry="6"/>` + sh(18) + `
    ${R('ch', 36, 76, 28, 15)}${R('sl', 38, 70, 24, 6)}${range(6, k => R('sl', 39 + k * 4, 72, 2, 4))}
    ${R('sl', 46, 26, 8, 44)}${R('pl', 51, 26, 3, 44)}${[34, 44, 54].map(y => R('bb', 45, y, 10, 2.4)).join('')}
    ${R('sl', 44, 22, 12, 4)}${PT('bb', 'M48 22l1-8 3-2 1 4-2 6zM46 14l-6-4 8 1zM54 12l8-5-5 8z')}`,
  oberbaum: () => `<ellipse class="gl2" cx="50" cy="90" rx="49" ry="7"/>${R('ch', 0, 54, 100, 14)}${A([4, 22, 40, 58, 76], 58, 14, 14, 'gl2')}
    ${R('ch2', 0, 52, 100, 3)}${R('tk2', 0, 48, 100, 4)}${R('sgn', 20, 44, 18, 4, ' rx="1"')}
    ${[34, 58].map(x => R('ch', x, 18, 8, 34) + R('ch2', x + 6, 18, 2, 34) + PG('sol', `${x - 1},18 ${x + 4},8 ${x + 9},18`) + A([x + 2], 24, 4, 8)).join('')}`,
  frauenkirche: () => sh(30) + `${R('ch', 18, 50, 64, 41)}${R('ch2', 76, 50, 6, 41)}${PG('rf2', '18,50 50,40 82,50')}${A([30, 40, 56, 66], 60, 4, 18)}
    ${[26, 60].map(x => R('ch', x, 14, 14, 36) + R('ch2', x + 11, 14, 3, 36) + `<path class="vg" d="M${x - 1} 16a8 10 0 0 1 16 0z"/>` + `<circle class="vg" cx="${x + 7}" cy="6" r="2.4"/>` + A([x + 5], 22, 4, 10)).join('')}
    ${R('dr', 45, 78, 10, 13)}`,
  siegestor: () => sh(40) + `${R('sl', 12, 40, 76, 51)}${R('pl', 12, 84, 76, 7)}${A([22, 42, 62], 56, 16, 35, 'dr')}
    ${range(4, k => R('fr', 17 + k * 20, 46, 3, 38))}${R('pl', 12, 34, 76, 6)}${R('sl', 30, 26, 40, 8)}
    ${PT('pst', 'M38 26l2-8h20l2 8zM44 18l-4-6 6 4M56 18l4-6-6 4M50 18v-8')}`,
  olympiaturm: () => `<ellipse class="tr" cx="20" cy="88" rx="18" ry="5"/>` + sh(14, 56) + `
    ${R('sl', 52, 30, 8, 61)}${R('pl', 57, 30, 3, 61)}${R('tk', 47, 30, 18, 3)}${R('gl', 47, 33, 18, 3)}${R('tk', 47, 36, 18, 3)}${R('tk2', 49, 39, 14, 3)}
    ${R('pst', 55.2, 6, 1.6, 24)}${R('sgn', 55.2, 10, 1.6, 2)}${R('sgn', 55.2, 16, 1.6, 2)}
    ${PT('gl2', 'M4 72Q20 56 36 64Q44 68 40 76z', ' opacity=".9"')}${PT('rl', 'M6 70l30-6M10 74l26-8')}`,
  michel: () => sh(26) + `${R('ch', 20, 56, 60, 35)}${R('ch2', 72, 56, 8, 35)}${A([26, 34, 62, 70], 64, 4, 14)}
    ${R('ch', 42, 30, 16, 61)}${R('ch2', 54, 30, 4, 61)}${A([47], 40, 6, 12)}<circle class="fr" cx="50" cy="58" r="4"/>
    ${R('vg', 43, 22, 14, 8)}<path class="vg" d="M44 22a6 5 0 0 1 12 0z"/>${R('vg', 46, 12, 8, 6)}${PG('vg', '46,12 50,1 54,12')}${R('bb', 49.4, 0, 1.2, 3)}`,
  hhrathaus: () => sh(44) + `${R('pl', 6, 50, 88, 41)}${R('pl2', 6, 84, 88, 7)}${W(10, 56, 8, 3, 6, 9, 3, 6)}${W(64, 56, 5, 3, 6, 9, 3, 6)}
    ${R('pl', 40, 24, 20, 67)}${R('pl2', 55, 24, 5, 67)}${A([44, 51], 36, 4, 12)}${R('dr', 44, 72, 12, 19)}
    ${PG('vg', '4,50 50,42 96,50')}${PG('vg', '38,24 50,4 62,24')}${R('bb', 49.4, 2, 1.2, 4)}`,
  landungs: () => `<ellipse class="gl2" cx="50" cy="90" rx="49" ry="7"/>${R('pl', 4, 50, 92, 26)}${R('pl2', 4, 72, 92, 4)}
    ${A([8, 16, 24, 32, 62, 70, 78, 86], 56, 4, 10)}${R('pl', 42, 32, 16, 44)}${R('pl2', 54, 32, 4, 44)}
    ${PG('vg', '6,50 14,44 22,50')}${PG('vg', '78,50 86,44 94,50')}<path class="vg" d="M42 32a8 8 0 0 1 16 0z"/>${R('bb', 49.4, 20, 1.2, 4)}
    <circle class="fr" cx="50" cy="40" r="3.6"/>${A([47], 52, 6, 14, 'dr')}`,
  /* ---------------- Almanya · ihale ---------------- */
  rathausmuc: () => sh(42) + `${R('pl2', 8, 46, 84, 45)}${R('pl', 8, 84, 84, 7)}${A([12, 20, 28, 64, 72, 80], 52, 4, 12)}${A([12, 20, 28, 64, 72, 80], 70, 4, 10)}
    ${range(14, k => PG('pl', `${8 + k * 6},46 ${11 + k * 6},38 ${14 + k * 6},46`))}
    ${R('pl2', 42, 14, 16, 70)}${R('pl', 54, 14, 4, 70)}<circle class="fr" cx="50" cy="26" r="4"/>${A([46], 34, 8, 16)}${R('dr', 45, 72, 10, 12)}
    ${PG('vg', '41,14 50,0 59,14')}`,
  elphi: () => `<ellipse class="gl2" cx="50" cy="90" rx="49" ry="7"/>${R('ch', 10, 56, 80, 32)}${R('ch2', 82, 56, 8, 32)}${W(14, 60, 11, 4, 6.4, 7, 3, 4, 'pst')}
    ${PT('gl2', 'M10 56V30Q24 24 32 30Q42 14 54 24Q66 10 78 22Q86 20 90 30V56z')}
    ${range(5, k => `<path class="rl" d="M10 ${50 - k * 5}h80"/>`)}${range(10, k => `<rect class="gl" x="${14 + k * 7.6}" y="${34 + (k % 3) * 6}" width="3" height="2.6" rx="1"/>`)}`,
  speicher: () => `<ellipse class="gl2" cx="50" cy="90" rx="49" ry="7"/>${R('ch', 6, 38, 88, 46)}${R('ch2', 6, 80, 88, 4)}
    ${range(4, k => PG('ch', `${6 + k * 22},38 ${17 + k * 22},22 ${28 + k * 22},38`) + R('vg', 15 + k * 22, 18, 4, 6) + A([10 + k * 22, 20 + k * 22], 44, 3, 8) + A([10 + k * 22, 20 + k * 22], 58, 3, 8) + R('dr', 15 + k * 22, 70, 5, 10))}`,
  /* ---------------- Japonya · koleksiyon ---------------- */
  skytree: () => sh(14) + `${PG('tk', '42,91 58,91 52,20 48,20')}${PG('tk2', '50,91 58,91 52,20 50,20')}
    ${range(9, k => `<path class="rl" d="M${42.6 + k * .8} ${86 - k * 7.4}L${57.4 - k * .8} ${79 - k * 7.4}"/>`)}
    ${R('pst', 44, 54, 12, 4)}${R('gl', 44.6, 55, 10.8, 2)}${R('pst', 46, 36, 8, 3)}${R('gl', 46.6, 36.6, 6.8, 1.6)}${R('sl', 49.2, 2, 1.6, 18)}`,
  rainbow: () => `<ellipse class="gl2" cx="50" cy="90" rx="49" ry="7"/>${R('fr', 0, 64, 100, 4)}
    ${[24, 76].map(x => R('fr', x - 4, 22, 8, 66) + R('tk2', x + 1.6, 22, 2.4, 66) + R('gl2', x - 2, 30, 4, 6) + R('gl2', x - 2, 42, 4, 6)).join('')}
    ${PT('rl', 'M0 60Q12 58 24 24Q50 58 76 24Q88 58 100 60', ' style="stroke-width:1.2"')}${PT('rl', 'M8 58v6M14 52v12M34 42v22M42 52v12M58 52v12M66 42v22M86 52v12M92 58v6')}`,
  meiji: () => `<ellipse class="tr" cx="12" cy="80" rx="12" ry="16"/><ellipse class="tr2" cx="88" cy="80" rx="12" ry="16"/>` + sh(36) + `
    ${R('dr', 26, 32, 7, 59)}${R('dr', 67, 32, 7, 59)}${PT('dr', 'M14 26Q50 20 86 26v6Q50 26 14 32z')}${R('dr', 20, 38, 60, 5)}${R('dr', 47, 32, 6, 6)}`,
  shinkansen: () => `${R('pst', 2, 84, 96, 2.4)}${range(12, k => R('pl2', 4 + k * 8, 86, 4, 2))}
    ${PT('fr', 'M96 80H30Q10 78 4 66Q14 52 40 52H96z')}${PT('sol', 'M96 74H22Q14 72 10 68h86z')}${PT('sol', 'M96 70H16v-1h80z')}
    ${PT('gl2', 'M14 62Q20 56 32 56v6z')}${W(42, 56, 7, 1, 7.6, 0, 5, 5)}<circle class="hk" cx="40" cy="81" r="3"/><circle class="hk" cx="80" cy="81" r="3"/>`,
  tsutenkaku: () => sh(24) + `${PG('sl', '30,91 42,58 58,58 70,91 62,91 50,66 38,91')}${PT('rl', 'M34 80h32M38 70h24')}
    ${R('sl', 42, 26, 16, 32)}${R('pl', 54, 26, 4, 32)}${R('fr', 38, 22, 24, 6)}<circle class="fr" cx="50" cy="40" r="4.4"/>${PT('rl', 'M50 40v-3M50 40l2 1.2')}
    ${R('sgn', 43, 48, 14, 6)}${PG('sl', '40,22 50,12 60,22')}${R('pst', 49.3, 2, 1.4, 10)}`,
  umedasky: () => sh(36) + `${[18, 58].map(x => R('tk', x, 22, 24, 69) + R('tk2', x + 18, 22, 6, 69) + W(x + 3, 26, 3, 15, 6, 4.2, 3.6, 2)).join('')}
    ${R('tk', 18, 14, 64, 10)}<circle class="gl2" cx="50" cy="19" r="6"/>${PT('rl', 'M42 22l16 0M42 40h16', ' style="stroke-width:1.2"')}${R('tk2', 42, 38, 16, 2)}`,
  kinkaku: () => `<ellipse class="gl2" cx="50" cy="90" rx="49" ry="7"/><ellipse class="tr" cx="10" cy="72" rx="10" ry="14"/><ellipse class="tr2" cx="90" cy="70" rx="10" ry="15"/>
    ${R('fr', 24, 66, 52, 16)}${W(28, 70, 6, 1, 8, 0, 5, 8, 'pst')}${PT('pst', 'M18 66h64l-6-6H24z')}
    ${R('bb', 30, 46, 40, 14)}${W(34, 49, 5, 1, 7, 0, 4, 7, 'dr')}${PT('pst', 'M24 46h52l-6-6H30z')}
    ${R('bb', 38, 30, 24, 10)}${PT('pst', 'M32 30h36L50 18z')}${R('bb', 49, 12, 2, 6)}`,
  yasaka: () => `<ellipse class="tr" cx="14" cy="84" rx="14" ry="8"/>` + sh(20) + `${range(5, k => R('dr', 42 + k * .6, 80 - k * 14, 16 - k * 1.2, 11) + PT('pst', `M${32 + k * 2} ${80 - k * 14}h${36 - k * 4}l-5-4h-${26 - k * 4}z`))}
    ${R('pst', 49.2, 4, 1.6, 18)}${range(4, k => R('bb', 47.6, 8 + k * 3, 4.8, 1.2))}`,
  fushimi: () => `<ellipse class="tr" cx="10" cy="60" rx="12" ry="40"/><ellipse class="tr2" cx="92" cy="60" rx="12" ry="40"/>
    ${range(5, j => { const k = 4 - j, s = 1 - k * .14, x = 50 - 34 * s, w = 68 * s, y = 90 - 66 * s; return R('sgn', x + w * .12, y, 5 * s, 66 * s) + R('sgn', x + w * .82, y, 5 * s, 66 * s) + R('sgn', x, y, w, 5 * s) + R('hk', x - 2 * s, y - 3 * s, w + 4 * s, 3 * s); })}`,
  kiyomizu: () => `${PT('tr2', 'M0 91V40Q30 30 60 46T100 40V91z')}${range(8, k => R('dr', 14 + k * 9, 56, 3, 35))}${PT('rl', 'M12 66h80M12 76h80M12 86h80')}
    ${R('fr', 10, 50, 84, 6)}${R('sgn', 26, 34, 52, 16)}${W(30, 38, 6, 1, 8, 0, 5, 8, 'dr')}${PT('pst', 'M18 34h68l-8-10H26z')}`,
  /* ---------------- Japonya · ihale ---------------- */
  osakajo: () => `${R('sl', 6, 74, 88, 17)}${PT('rl', 'M6 80h88M6 86h88M20 74v17M40 74v17M60 74v17M80 74v17')}
    ${[[18, 62, 64, 12], [24, 48, 52, 12], [30, 34, 40, 12], [36, 20, 28, 12]].map(([x, y, w, h]) => R('fr', x, y, w, h) + W(x + 4, y + 3, Math.floor(w / 8), 1, 8, 0, 3, 5, 'pst') + PT('vg', `M${x - 6} ${y}h${w + 12}l-6 -5h-${w}z`)).join('')}
    ${R('bb', 34, 16, 4, 3)}${R('bb', 62, 16, 4, 3)}${PT('vg', 'M38 20h24l-6-6H44z')}`,
  kaminarimon: () => sh(42) + `${R('sgn', 14, 40, 10, 51)}${R('sgn', 76, 40, 10, 51)}${R('sgn', 14, 40, 72, 8)}${R('fr', 26, 50, 48, 2)}
    <ellipse class="sgn" cx="50" cy="66" rx="12" ry="15"/>${PT('hk', 'M44 58h12M43 66h14M44 74h12', ' style="stroke:var(--hk);stroke-width:1.4"')}${R('hk', 46, 80, 8, 4)}
    ${PT('pst', 'M6 40h88l-10-14H16z')}${R('pst', 30, 22, 40, 4)}`,
  machiya: () => sh(44) + `${[6, 36, 66].map((x, j) => R('dr', x, 46, 28, 45) + range(10, k => R('pst', x + 2 + k * 2.6, 52, 1.2, 22)) + PT('pst', `M${x - 2} 46h32l-4-8h-24z`) + R('pst', x, 74, 28, 2) + R(j === 1 ? 'sgn' : 'fr', x + 10, 78, 8, 13)).join('')}
    <circle class="sgn" cx="46" cy="70" r="3.4"/>${R('fr', 6, 32, 88, 6)}${PT('pst', 'M2 32h96l-6-8H8z')}`,
  /* ---------------- Türkiye · ihale ---------------- */
  sirkeci: () => sh(42) + `${R('fr', 8, 52, 84, 39)}${R('tk2', 8, 84, 84, 7)}${A([12, 20, 28, 66, 74, 82], 60, 4, 14)}
    ${R('fr', 34, 36, 32, 48)}${R('tk2', 62, 36, 4, 48)}<circle class="gl" cx="50" cy="52" r="8"/>${PT('rl', 'M42 52h16M50 44v16')}${A([44], 64, 12, 20, 'dr')}
    ${[30, 62].map(x => R('sl', x, 24, 8, 12) + PG('sol', `${x - 1},24 ${x + 4},14 ${x + 9},24`)).join('')}${R('sgn', 8, 52, 84, 2)}`,
  kizlaragasi: () => sh(44) + `${R('sl', 8, 40, 84, 51)}${R('pl', 8, 84, 84, 7)}${range(9, k => `<path class="dr" d="M${12 + k * 9} 84v-12a3 3 0 0 1 6 0v12z"/>`)}
    ${range(9, k => `<path class="gl" d="M${12 + k * 9} 66v-8a3 3 0 0 1 6 0v8z"/>`)}${R('rf', 6, 34, 88, 6)}${range(9, k => R('rf2', 7 + k * 9.6, 34, 1.2, 6))}
    ${R('sl', 40, 22, 20, 12)}<path class="sol" d="M40 22a10 8 0 0 1 20 0z"/>`,
  ankaragar: () => sh(44) + `${R('fr', 6, 46, 88, 45)}${R('tk2', 6, 84, 88, 7)}${R('fr', 34, 30, 32, 61)}${R('tk2', 62, 30, 4, 61)}
    ${range(5, k => R('gl', 37 + k * 5.6, 34, 3, 40))}${R('dr', 42, 76, 16, 15)}${W(10, 52, 4, 3, 6, 10, 3, 6)}${W(70, 52, 4, 3, 6, 10, 3, 6)}
    ${R('tk', 32, 26, 36, 4)}${R('sgn', 6, 46, 28, 2)}${R('sgn', 66, 46, 28, 2)}`,
  /* ---------------- ihale: prototipte çizilenler ---------------- */
  bigben: () => sh()+`<rect class="pl2" x="35" y="84" width="30" height="7"/><rect class="sl" x="40" y="35" width="20" height="50"/><rect class="pl" x="55" y="35" width="5" height="50"/>
    ${[48,59,70].map(y=>`<rect class="gl" x="43.5" y="${y}" width="3" height="7" rx="1.5"/><rect class="gl" x="49.5" y="${y}" width="3" height="7" rx="1.5"/>`).join('')}
    <path class="rl" d="M40 45h20M40 56h20M40 67h20M40 78h20"/>
    <rect class="pl" x="37" y="21" width="26" height="14"/><rect class="pl2" x="58" y="21" width="5" height="14"/><circle class="fr" cx="49" cy="28" r="5.4"/><path class="rl" style="stroke-width:1" d="M49 28v-3.6M49 28l2.6 1.4"/>
    <polygon class="sol" points="35.5,21 37.5,15 39.5,21"/><polygon class="sol" points="60.5,21 62.5,15 64.5,21"/>
    <rect class="sl" x="40" y="13" width="20" height="8"/>${[42.5,48.5,54.5].map(x=>`<path class="gl" d="M${x} 20v-3.5a1.5 1.5 0 0 1 3 0v3.5z"/>`).join('')}
    <polygon class="sol" points="39,13 50,0.5 61,13"/><rect class="pl2" x="49.4" y="0" width="1.2" height="3"/>`,
  tbridge: () => `<ellipse class="gl2" cx="50" cy="89" rx="49" ry="7"/><rect class="pl2" x="19" y="80" width="22" height="7"/><rect class="pl2" x="59" y="80" width="22" height="7"/>
    <rect class="pl" x="2" y="64" width="96" height="5"/><path class="rl" d="M2 66.5h96"/>
    <path class="rl" style="stroke-width:1.6" d="M2 62Q13 58 22 41M78 41Q87 58 98 62"/><path class="rl" d="M8 61v3M13 58v6M17 53v11M83 53v11M87 58v6M92 61v3"/>
    <rect class="sl" x="38" y="35" width="24" height="5"/><path class="rl" d="M38 37.5h24"/>
    <rect class="pl" x="22" y="30" width="16" height="50"/><rect class="pl2" x="34" y="30" width="4" height="50"/><rect class="pl" x="62" y="30" width="16" height="50"/><rect class="pl2" x="74" y="30" width="4" height="50"/>
    ${[26,66].map(x=>`<path class="gl" d="M${x} 50v-8a2 2 0 0 1 4 0v8z"/><path class="gl" d="M${x} 62v-6a2 2 0 0 1 4 0v6z"/><path class="dr" d="M${x-1} 80v-8a3 3 0 0 1 6 0v8z"/>`).join('')}
    <polygon class="sol" points="21,30 30,13 39,30"/><polygon class="sol" points="61,30 70,13 79,30"/>
    <polygon class="sol" points="20,30 21.5,24 23,30"/><polygon class="sol" points="37,30 38.5,24 40,30"/><polygon class="sol" points="60,30 61.5,24 63,30"/><polygon class="sol" points="77,30 78.5,24 80,30"/>
    <rect class="pl2" x="29.4" y="9" width="1.2" height="5"/><rect class="pl2" x="69.4" y="9" width="1.2" height="5"/>`,
  liberty: () => sh()+`<rect class="pl2" x="30" y="86" width="40" height="5"/><polygon class="pl" points="35,86 65,86 62,64 38,64"/><polygon class="pl2" points="58,86 65,86 62,64 57,64"/>
    <rect class="sl" x="36" y="60" width="28" height="5"/><path class="gl" d="M46 80v-8a4 4 0 0 1 8 0v8z"/>
    <polygon class="vg" points="42,60 58,60 55,36 45,36"/><polygon class="vg2" points="53,36 55,36 58,60 54,60"/><path class="vg2" d="M45 46l5 3 4-2v2l-4 2-5-3z"/>
    <polygon class="vg" points="53,37 57,36 61,15 58,14.5"/><rect class="vg2" x="40" y="40" width="5" height="9" rx="1"/>
    <circle class="vg" cx="50" cy="31.5" r="4.6"/><polygon class="vg" points="45,29 42.5,23.5 47.5,27.5 50,21.5 52.5,27.5 57.5,23.5 55,29"/>
    <rect class="sl" x="57.6" y="9.5" width="3.4" height="5"/><path class="bb" d="M59.3 1.5C62.6 4.4 62 8 59.3 9.6 56.6 8 56 4.4 59.3 1.5z"/>`,
  brandenburg: () => `<ellipse class="sh" cx="50" cy="92" rx="46" ry="4"/><rect class="pl2" x="7" y="86" width="86" height="5"/>
    ${[11,24,37,57,70,83].map(x=>`<rect class="sl" x="${x}" y="50" width="6" height="36"/><rect class="pl" x="${x+4.4}" y="50" width="1.6" height="36"/><rect class="pl" x="${x-1}" y="84" width="8" height="2"/>`).join('')}
    <rect class="pl" x="7" y="42" width="86" height="8"/><path class="rl" d="M7 46h86"/>${Array.from({length:14},(_,k)=>`<rect class="pl2" x="${10+k*6}" y="43" width="2" height="2.4"/>`).join('')}
    <rect class="sl" x="24" y="34" width="52" height="8"/><rect class="pl" x="30" y="30" width="40" height="4"/>
    <polygon class="vg" points="38,30 62,30 60,25 40,25"/>${[38,44,52,58].map(x=>`<path class="vg" d="M${x} 25l1-6 3-2 1.6 1-1.2 2 .6 5z"/>`).join('')}
    <rect class="vg" x="48" y="13" width="4" height="12"/><circle class="vg" cx="50" cy="12" r="2.2"/><rect class="vg2" x="52.8" y="4" width="1.1" height="13"/><path class="vg2" d="M50.5 6.5a2.8 2.8 0 1 0 5.6 0a2.8 2.8 0 1 0 -5.6 0"/>`,
  tokyotower: () => sh()+`<rect class="sl" x="24" y="84" width="52" height="7"/>${[29,40,51,62].map(x=>`<rect class="gl" x="${x}" y="86" width="7" height="3"/>`).join('')}
    <polygon class="sgn" points="29,84 37,84 48.5,42 46.5,42"/><polygon class="sgn" points="63,84 71,84 53.5,42 51.5,42"/>
    <path class="rl" style="stroke-width:1" d="M33 74h34M36 64h28M39 56h22M33 74L64 64M67 74L36 64M36 64L61 56M64 64L39 56"/>
    <rect class="fr" x="37" y="48" width="26" height="7"/><rect class="gl" x="38.5" y="50" width="23" height="3"/>
    <polygon class="sgn" points="46.5,48 53.5,48 51.6,18 48.4,18"/><rect class="fr" x="47.2" y="36" width="5.6" height="3"/><rect class="fr" x="46" y="24" width="8" height="4"/><rect class="gl" x="46.8" y="25" width="6.4" height="2"/>
    <rect class="fr" x="48.6" y="12" width="2.8" height="6"/><rect class="sgn" x="49.3" y="2" width="1.4" height="10"/>`,
  beylerbeyi: () => `<ellipse class="gl2" cx="50" cy="90" rx="49" ry="6"/><ellipse class="tr" cx="8" cy="80" rx="8" ry="9"/><ellipse class="tr2" cx="93" cy="78" rx="7" ry="10"/>
    <rect class="sl" x="6" y="82" width="88" height="5"/><rect class="fr" x="11" y="47" width="78" height="35"/><rect class="tk2" x="82" y="47" width="7" height="35"/>
    <rect class="tk2" x="9" y="44" width="82" height="3"/><rect class="pl2" x="10" y="42" width="80" height="2"/>
    <rect class="fr" x="37" y="38" width="26" height="44"/><rect class="tk2" x="36" y="35" width="28" height="3"/><rect class="pl2" x="37" y="33" width="26" height="2"/>
    ${[15,22,29,66,73].map(x=>`<path class="gl" d="M${x} 61v-7a2 2 0 0 1 4 0v7z"/><path class="gl" d="M${x} 76v-7a2 2 0 0 1 4 0v7z"/>`).join('')}
    ${[41,48,55].map(x=>`<path class="gl" d="M${x} 52v-7a2 2 0 0 1 4 0v7z"/>`).join('')}<path class="dr" d="M45 82v-12a5 5 0 0 1 10 0v12z"/>
    <path class="rl" d="M11 64h26M63 64h19M37 60h26"/>`,
};
/** Dünya yapılarının çizimi ('' = bu modülde yok). */
export function worldSvg(id: string): string { const f = D[id]; return f ? f() : ''; }
export const WORLD_IDS = Object.keys(D);
