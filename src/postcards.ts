/* =========================================================
   YENİ ŞEHİR KARTPOSTALLARI — mevcut İstanbul/İzmir/Ankara kartlarıyla aynı çizgi dili:
   320×170, düz renk alanlar, #1e3a32 mürekkep çizgi, gökyüzü + zemin + 2–3 simge yapı.
   ========================================================= */
const K = 'stroke="#1e3a32" stroke-width="1.2"';
const sky = (c: string) => `<rect width="320" height="170" fill="${c}"/>`;
const water = (y: number, c = '#7fa7c6', l = '#bcd6e8') => `<rect y="${y}" width="320" height="${170 - y}" fill="${c}"/><path d="M0 ${y + 12}h320M30 ${y + 24}h70M180 ${y + 30}h80" stroke="${l}" stroke-width="2"/>`;
const ground = (y: number, c = '#b9b3a3', l = '#d6d0c0') => `<rect y="${y}" width="320" height="${170 - y}" fill="${c}"/><path d="M0 ${y + 10}h320M40 ${y + 26}h90M190 ${y + 32}h80" stroke="${l}" stroke-width="2"/>`;
const win = (x: number, y: number, cols: number, rows: number, dx = 8, dy = 10, w = 4, h = 5) => {
  let s = ''; for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) s += `<rect x="${x + c * dx}" y="${y + r * dy}" width="${w}" height="${h}" fill="#bcd6e8"/>`; return s;
};

export const POST2: Record<string, string> = {
  // New York: Empire State + Brooklyn köprüsü
  nyc: sky('#dfe7ee') + water(124) + `
    <rect x="52" y="54" width="34" height="70" fill="#d8cdb6" ${K}/><rect x="58" y="36" width="22" height="18" fill="#d8cdb6" ${K}/><rect x="63" y="22" width="12" height="14" fill="#d8cdb6" ${K}/><path d="M69 22v-14" stroke="#1e3a32" stroke-width="2"/>${win(57, 60, 4, 6)}
    <rect x="100" y="80" width="26" height="44" fill="#bfc7cf" ${K}/>${win(104, 86, 3, 4)}
    <path d="M150 112h170" stroke="#1e3a32" stroke-width="3"/><rect x="176" y="62" width="16" height="62" fill="#c9785c" ${K}/><rect x="262" y="62" width="16" height="62" fill="#c9785c" ${K}/>
    <path d="M181 74h6M267 74h6" stroke="#1e3a32" stroke-width="3"/><path d="M150 112Q184 60 184 64M184 64Q227 112 270 64M270 64Q300 100 320 108" fill="none" stroke="#1e3a32" stroke-width="1.2"/>`,
  // Los Angeles: palmiyeler, tepeler, gün batımı
  la: sky('#f6dcc0') + `<circle cx="250" cy="70" r="26" fill="#f2b37a"/>` + `
    <path d="M0 110Q60 70 120 104T240 96T320 102V170H0z" fill="#c9b48a" ${K}/>` + ground(128, '#e8d6a8', '#f3e6c4') + `
    <path d="M70 128q2-40 6-62" fill="none" stroke="#1e3a32" stroke-width="3"/><path d="M76 66q-16-4-26 6M76 66q14-8 26 0M76 66q-6-14-18-16M76 66q10-12 22-10M76 66q2 12-8 20" fill="none" stroke="#3f6b4a" stroke-width="3"/>
    <path d="M118 128q1-30 4-48" fill="none" stroke="#1e3a32" stroke-width="2.5"/><path d="M122 80q-12-3-20 5M122 80q11-6 20 0M122 80q-4-11-14-12M122 80q8-9 17-7" fill="none" stroke="#3f6b4a" stroke-width="2.5"/>
    <rect x="170" y="96" width="70" height="32" fill="#f3ede0" ${K}/><path d="M166 96h78" stroke="#1e3a32" stroke-width="2"/><rect x="186" y="106" width="12" height="22" fill="#9fc3d8" ${K}/><rect x="210" y="106" width="20" height="10" fill="#9fc3d8" ${K}/>`,
  // Chicago: kuleler ve göl
  chi: sky('#dde6ee') + water(126, '#8fb2c9') + `
    <rect x="70" y="28" width="30" height="98" fill="#4d5560" ${K}/><rect x="74" y="18" width="10" height="10" fill="#4d5560" ${K}/><rect x="86" y="12" width="10" height="16" fill="#4d5560" ${K}/><path d="M79 18V6M91 12V2" stroke="#1e3a32" stroke-width="2"/>${win(74, 34, 3, 9, 9, 10, 5, 4)}
    <rect x="118" y="58" width="28" height="68" fill="#c9785c" ${K}/>${win(122, 64, 3, 6)}
    <rect x="160" y="74" width="22" height="52" fill="#d8cdb6" ${K}/><path d="M160 74l11-14 11 14" fill="#bfae8f" ${K}/>${win(164, 82, 2, 4, 9)}
    <ellipse cx="250" cy="112" rx="34" ry="14" fill="#cfd6dc" ${K}/><ellipse cx="242" cy="106" rx="12" ry="4" fill="#eef2f5"/>`,
  // London: Big Ben + Tower Bridge
  lon: sky('#dfe3e8') + water(126, '#8aa2b4') + `
    <rect x="56" y="44" width="22" height="82" fill="#d8c79f" ${K}/><rect x="52" y="40" width="30" height="8" fill="#c4b184" ${K}/><path d="M54 40l13-22 13 22" fill="#5b6a5f" ${K}/><path d="M67 18V8" stroke="#1e3a32" stroke-width="2"/>
    <circle cx="67" cy="58" r="8" fill="#fbfbf7" ${K}/><path d="M67 53v5h4" stroke="#1e3a32"/>${win(60, 74, 2, 4, 10, 12, 4, 6)}
    <rect x="170" y="56" width="22" height="70" fill="#d8c79f" ${K}/><rect x="254" y="56" width="22" height="70" fill="#d8c79f" ${K}/><path d="M170 56l11-14 11 14M254 56l11-14 11 14" fill="#5b6a5f" ${K}/>
    <path d="M192 74h62M192 80h62" stroke="#3d6f9a" stroke-width="3"/><path d="M130 112h50M192 112q31-18 62 0M254 112h66" fill="none" stroke="#1e3a32" stroke-width="2.5"/>`,
  // Manchester: tuğla fabrika ve tramvay
  man: sky('#e3e1dc') + ground(126, '#a9a49a', '#c7c2b8') + `
    <rect x="40" y="70" width="110" height="56" fill="#b0634a" ${K}/>${win(48, 80, 9, 3, 11, 13, 6, 7)}<rect x="120" y="26" width="12" height="44" fill="#9a523c" ${K}/><path d="M118 26h16" stroke="#1e3a32" stroke-width="2"/>
    <rect x="170" y="54" width="34" height="72" fill="#cfd6dc" ${K}/>${win(174, 60, 3, 6, 10)}
    <rect x="214" y="108" width="84" height="20" rx="6" fill="#e3c34a" ${K}/><path d="M222 114h68" stroke="#1e3a32"/><rect x="226" y="111" width="10" height="7" fill="#bcd6e8"/><rect x="244" y="111" width="10" height="7" fill="#bcd6e8"/><rect x="262" y="111" width="10" height="7" fill="#bcd6e8"/><path d="M256 108l-6-14h12" fill="none" stroke="#1e3a32"/>`,
  // Edinburgh: kayalık üstünde kale
  edi: sky('#dde3e6') + `<path d="M0 132Q40 96 90 92T180 100L220 132z" fill="#7d8a7a" ${K}/>` + ground(132, '#9fa596', '#bfc4b5') + `
    <rect x="60" y="66" width="80" height="30" fill="#b9b2a2" ${K}/><path d="M60 66v-6h8v6h8v-6h8v6h8v-6h8v6h8v-6h8v6h8v-6h8v6" fill="none" stroke="#1e3a32" stroke-width="1.2"/>
    <rect x="92" y="46" width="18" height="20" fill="#b9b2a2" ${K}/><path d="M92 46v-5h6v5h6v-5h6v5" fill="none" stroke="#1e3a32"/><path d="M101 41V28" stroke="#1e3a32" stroke-width="1.5"/><path d="M101 28h10l-4 4 4 4h-10" fill="#2f5e9a"/>
    <rect x="232" y="84" width="20" height="48" fill="#cbbf9e" ${K}/><path d="M228 84l14-24 14 24" fill="#7d8a7a" ${K}/><rect x="262" y="100" width="40" height="32" fill="#cbbf9e" ${K}/>${win(268, 106, 4, 2)}`,
  // Münih: Frauenkirche kubbeleri ve Alpler
  muc: sky('#e0e8ee') + `<path d="M0 106l40-30 30 22 40-36 50 40 40-26 50 30 70-24v40H0z" fill="#c6d0d8" ${K}/><path d="M110 62l10 8-10-2-8 4z M190 72l8 6-8-1-6 3z" fill="#fbfbf7"/>` + ground(126, '#b8b39f', '#d4cfba') + `
    <rect x="70" y="48" width="22" height="78" fill="#b56a4d" ${K}/><rect x="104" y="48" width="22" height="78" fill="#b56a4d" ${K}/><path d="M70 48q11-24 22 0M104 48q11-24 22 0" fill="#5e8f72" ${K}/>
    <path d="M81 24v-6M115 24v-6" stroke="#1e3a32" stroke-width="2"/><rect x="62" y="88" width="72" height="38" fill="#c9785c" ${K}/><path d="M62 88l36-22 36 22" fill="#a5543d" ${K}/>
    <rect x="200" y="94" width="56" height="32" fill="#f3ede0" ${K}/><path d="M196 94l32-18 32 18" fill="#b0634a" ${K}/>${win(208, 102, 4, 2, 11)}`,
  // Berlin: TV kulesi + Brandenburg Kapısı
  ber: sky('#dfe6ee') + ground(124, '#9fb3a2', '#c9d6c8') + `
    <rect x="58" y="40" width="5" height="84" fill="#cfd6dc" ${K}/><circle cx="60.5" cy="58" r="11" fill="#e6ebef" ${K}/><rect x="59.5" y="18" width="2" height="22" fill="#1e3a32"/><path d="M50 124h21" stroke="#1e3a32" stroke-width="2"/>
    <rect x="120" y="78" width="96" height="46" fill="#efe2c8" ${K}/><rect x="114" y="70" width="108" height="10" fill="#e3d2ae" ${K}/><path d="M132 80v44M148 80v44M164 80v44M180 80v44M196 80v44" stroke="#1e3a32" stroke-width="2"/><path d="M160 70l-10-14h20z" fill="#7d9a86" stroke="#1e3a32"/><path d="M152 56h16" stroke="#1e3a32"/>
    <rect x="246" y="86" width="44" height="38" fill="#c9785c" ${K}/><path d="M246 86l22-16 22 16" fill="#b0634a" ${K}/><path d="M256 96h8v8h-8zM272 96h8v8h-8zM256 110h8v8h-8zM272 110h8v8h-8z" fill="#bcd6e8" stroke="#1e3a32" stroke-width=".8"/>`,
  // Hamburg: Elbphilharmonie dalgası ve liman vinci
  ham: sky('#dde6ec') + water(124, '#6f93ad') + `
    <rect x="60" y="80" width="90" height="44" fill="#a5543d" ${K}/>${win(66, 88, 8, 3, 10, 11, 5, 6)}<path d="M56 80q12-30 24-12q12-28 24-6q12-30 24-8q12-26 26 2v24H56z" fill="#cfe0ea" ${K}/>
    <path d="M220 124V44M220 44h62M220 44l-16 14M240 44v14M282 44v24" fill="none" stroke="#c9785c" stroke-width="3"/><rect x="274" y="68" width="16" height="10" fill="#e3c34a" ${K}/><path d="M220 60l20-16" stroke="#c9785c" stroke-width="2"/>
    <path d="M160 128h58l-6 10h-46z" fill="#4d5560" ${K}/><rect x="172" y="120" width="30" height="8" fill="#e3c34a" ${K}/>`,
  // Tokyo: Tokyo Kulesi ve neon bloklar
  tyo: sky('#e6e3ee') + ground(126, '#a8a6b0', '#c9c7d0') + `
    <path d="M70 126l14-80 14 80z" fill="none" stroke="#d2553f" stroke-width="3"/><path d="M76 92h16M80 70h8M73 108h22" stroke="#d2553f" stroke-width="3"/><rect x="78" y="62" width="12" height="6" fill="#fbfbf7" ${K}/><path d="M84 46V24" stroke="#d2553f" stroke-width="2"/>
    <rect x="130" y="60" width="30" height="66" fill="#4d5560" ${K}/>${win(134, 66, 3, 6, 9)}<rect x="168" y="76" width="26" height="50" fill="#cfd6dc" ${K}/>${win(172, 82, 3, 4)}
    <rect x="206" y="88" width="24" height="38" fill="#f3ede0" ${K}/><rect x="210" y="94" width="16" height="8" fill="#e05a8a"/><rect x="240" y="96" width="50" height="30" fill="#c9785c" ${K}/><path d="M236 96h58" stroke="#1e3a32" stroke-width="2"/><rect x="246" y="102" width="12" height="8" fill="#e3c34a"/>`,
  // Osaka: Osaka Kalesi
  osa: sky('#e4ebe6') + water(128, '#8fb2a6', '#c6dcd4') + `
    <path d="M90 128l10-22h120l10 22z" fill="#b9b2a2" ${K}/><rect x="112" y="84" width="96" height="22" fill="#f3ede0" ${K}/><path d="M104 84l56-16 56 16z" fill="#4f7d6c" ${K}/>
    <rect x="126" y="54" width="68" height="18" fill="#f3ede0" ${K}/><path d="M118 56l42-14 42 14z" fill="#4f7d6c" ${K}/><rect x="140" y="30" width="40" height="14" fill="#f3ede0" ${K}/><path d="M134 32l26-12 26 12z" fill="#4f7d6c" ${K}/>
    <path d="M150 20h20" stroke="#d8b04a" stroke-width="3"/>${win(122, 90, 8, 1, 11, 10, 6, 6)}${win(134, 58, 5, 1, 11, 10, 6, 6)}`,
  // Kyoto: pagoda ve torii
  kyo: sky('#efe6dc') + `<path d="M0 116Q80 92 160 108T320 100V170H0z" fill="#9fb08a" ${K}/>` + ground(132, '#b8a98c', '#d6c9ad') + `
    <rect x="96" y="104" width="30" height="28" fill="#c9785c" ${K}/><path d="M80 104h62l-8-8H88z M84 88h54l-7-8H91z M88 72h46l-6-8H94z M92 56h38l-5-8H97z" fill="#5b4a3f" ${K}/><rect x="100" y="80" width="22" height="8" fill="#c9785c" ${K}/><rect x="103" y="64" width="16" height="8" fill="#c9785c" ${K}/><path d="M111 48V32" stroke="#1e3a32" stroke-width="2"/>
    <path d="M200 132V84M262 132V84" stroke="#d2553f" stroke-width="6"/><path d="M188 80q43-10 86 0" fill="none" stroke="#d2553f" stroke-width="7"/><path d="M194 94h74" stroke="#d2553f" stroke-width="5"/>`,
};
