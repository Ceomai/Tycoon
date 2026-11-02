// @ts-nocheck — tarihi yapı çizimleri (SVG metni)
/* KOLEKSİYON — etkinliklerden ve altın taksiden düşen tarihi yapılar. Her biri tüm kiralara +%5, tamamı ek +%10. */
import { tk } from './i18n';
export interface Landmark { id: string; n: string; city: 'ist' | 'izm' | 'ank'; }
export const LM: Landmark[] = [
  { id: 'galata', n: tk('Galata Kulesi'), city: 'ist' }, { id: 'kiz', n: tk('Kız Kulesi'), city: 'ist' }, { id: 'saat', n: tk('Dolmabahçe Saat Kulesi'), city: 'ist' },
  { id: 'rumeli', n: tk('Rumeli Hisarı'), city: 'ist' }, { id: 'tramvay', n: tk('Nostaljik Tramvay'), city: 'ist' }, { id: 'haydarpasa', n: tk('Haydarpaşa Garı'), city: 'ist' },
  { id: 'konak', n: tk('Konak Saat Kulesi'), city: 'izm' }, { id: 'asansor', n: tk('Tarihi Asansör'), city: 'izm' },
  { id: 'atakule', n: tk('Atakule'), city: 'ank' }, { id: 'kale', n: tk('Ankara Kalesi'), city: 'ank' },
];
export function lmSvg(id){
  const sh='<ellipse class="sh" cx="54" cy="92" rx="30" ry="4"/>';
  if(id==='galata') return sh+`<rect class="pl" x="38" y="34" width="24" height="57"/><rect class="pl2" x="55" y="34" width="7" height="57"/>
    ${[44,58,72].map(y=>`<rect class="gl" x="42" y="${y}" width="4" height="7" rx="2"/><rect class="gl" x="49" y="${y}" width="4" height="7" rx="2"/>`).join('')}
    <rect class="sl" x="34" y="29" width="32" height="5"/><path class="rl" d="M35 29v-4h30v4M39 25v4M44 25v4M50 25v4M56 25v4M61 25v4"/>
    <polygon class="sol" points="36,25 50,4 64,25"/><rect class="sl" x="49.2" y="1" width="1.6" height="5"/>`;
  if(id==='kiz') return `<ellipse class="gl2" cx="50" cy="86" rx="47" ry="10"/><ellipse class="pl2" cx="50" cy="81" rx="30" ry="7"/>
    <rect class="fr" x="26" y="60" width="32" height="19"/><rect class="tk2" x="26" y="58" width="32" height="3"/>
    ${[30,38,46].map(x=>`<rect class="gl" x="${x}" y="65" width="4" height="7" rx="2"/>`).join('')}
    <rect class="fr" x="56" y="34" width="13" height="45"/><rect class="tk2" x="66" y="34" width="3" height="45"/>
    <rect class="gl" x="60" y="42" width="5" height="8" rx="2.5"/><rect class="gl" x="60" y="56" width="5" height="8" rx="2.5"/>
    <polygon class="sol" points="54,34 62.5,14 71,34"/><rect class="sl" x="61.8" y="9" width="1.4" height="6"/>`;
  if(id==='saat') return sh+`<rect class="pl" x="34" y="80" width="34" height="11"/><rect class="sl" x="40" y="30" width="22" height="50"/><rect class="pl" x="56" y="30" width="6" height="50"/>
    <rect class="pl" x="38" y="26" width="26" height="5"/><circle class="fr" cx="50" cy="42" r="7"/><path class="rl" d="M50 42v-5M50 42l3.5 2"/>
    ${[56,66].map(y=>`<rect class="gl" x="45" y="${y}" width="4" height="8" rx="2"/><rect class="gl" x="52" y="${y}" width="4" height="8" rx="2"/>`).join('')}
    <path class="sol" d="M40 26a11 9 0 0 1 22 0z"/><rect class="sl" x="50.2" y="8" width="1.6" height="9"/>`;
  if(id==='rumeli') return `<ellipse class="tr" cx="20" cy="88" rx="16" ry="6"/>`+sh+`<rect class="pl" x="10" y="58" width="80" height="32"/>
    <path class="pl" d="${Array.from({length:13},(_,k)=>`M${10+k*6.4} 58h3.6v-4h-3.6z`).join('')}"/>
    <rect class="pl" x="12" y="38" width="18" height="52"/><rect class="pl2" x="25" y="38" width="5" height="52"/><polygon class="sol" points="10,38 21,22 32,38"/>
    <rect class="pl" x="62" y="28" width="24" height="62"/><rect class="pl2" x="79" y="28" width="7" height="62"/><polygon class="sol" points="60,28 74,8 88,28"/>
    <path class="dr" d="M44 90v-12a6 6 0 0 1 12 0v12z"/>`;
  if(id==='tramvay') return `<rect class="pst" x="4" y="86" width="92" height="2.4"/>${Array.from({length:12},(_,k)=>`<rect class="pl2" x="${6+k*8}" y="88" width="4" height="2"/>`).join('')}
    <path class="rl" d="M60 40L74 18M4 18h92"/><rect class="fr" x="16" y="38" width="68" height="7" rx="2"/>
    <rect class="sgn" x="12" y="44" width="76" height="34" rx="4"/><rect class="fr" x="12" y="68" width="76" height="3"/>
    ${[17,30,43,56,69].map(x=>`<rect class="gl" x="${x}" y="49" width="10" height="13" rx="1.5"/>`).join('')}
    <circle class="hk" cx="28" cy="81" r="5"/><circle class="hk" cx="72" cy="81" r="5"/>`;
  if(id==='konak') return sh+`<rect class="pl" x="30" y="82" width="40" height="9"/><polygon class="sl" points="38,82 62,82 58,40 42,40"/>
    <rect class="pl" x="40" y="34" width="20" height="8"/><circle class="fr" cx="50" cy="56" r="6"/><path class="rl" d="M50 56v-4M50 56l3 1.6"/>
    ${[44,52].map(x=>`<path class="gl" d="M${x} 76v-8a2 2 0 0 1 4 0v8z"/>`).join('')}
    <path class="sl" d="M40 34a10 10 0 0 1 20 0z"/><rect class="sgn" x="49.2" y="14" width="1.6" height="10"/><circle class="gd" cx="50" cy="13" r="2"/>`;
  if(id==='asansor') return sh+`<rect class="pl2" x="8" y="80" width="84" height="11"/><rect class="pl" x="56" y="22" width="22" height="60"/><rect class="pl2" x="72" y="22" width="6" height="60"/>
    ${[30,42,54,66].map(y=>`<rect class="gl" x="61" y="${y}" width="5" height="7" rx="1"/>`).join('')}
    <rect class="sl" x="20" y="22" width="40" height="5"/><rect class="pl" x="54" y="16" width="26" height="7"/>
    <rect class="ch" x="10" y="52" width="40" height="28"/><rect class="gl" x="16" y="58" width="8" height="8"/><rect class="gl" x="30" y="58" width="8" height="8"/>`;
  if(id==='atakule') return sh+`<rect class="pl" x="38" y="84" width="24" height="7"/><rect class="sl" x="46" y="34" width="8" height="52"/><rect class="pl2" x="51" y="34" width="3" height="52"/>
    <circle class="gl2" cx="50" cy="26" r="14"/><path class="mu" d="M36 26h28M38 19h24M38 33h24"/><circle fill="none" class="rl" cx="50" cy="26" r="14"/>
    <rect class="sl" x="49" y="4" width="2" height="9"/>`;
  if(id==='kale') return `<ellipse class="tr" cx="22" cy="90" rx="18" ry="5"/>`+sh+`<polygon class="pl" points="6,90 6,58 94,50 94,90"/>
    <path class="pl" d="${Array.from({length:12},(_,k)=>`M${6+k*7.4} ${58-k*.7}h4v-5h-4z`).join('')}"/>
    <polygon class="pl2" points="20,90 20,40 36,36 36,90"/><polygon class="pl2" points="62,90 62,32 80,28 80,90"/>
    <path class="pl2" d="M20 40h4v-5h-4zM28 38h4v-5h-4zM62 32h4v-5h-4zM70 30h4v-5h-4zM76 29h4v-5h-4z"/>
    <path class="dr" d="M44 90v-12a6 6 0 0 1 12 0v12z"/>`;
  return `<ellipse class="gl2" cx="50" cy="92" rx="48" ry="6"/><rect class="pl" x="14" y="46" width="72" height="42"/><rect class="pl2" x="14" y="80" width="72" height="8"/>
    <polygon class="rf2" points="28,46 50,32 72,46"/>
    <rect class="pl" x="12" y="36" width="16" height="52"/><rect class="pl" x="72" y="36" width="16" height="52"/>
    <polygon class="sol" points="10,36 20,16 30,36"/><polygon class="sol" points="70,36 80,16 90,36"/>
    ${[34,44,54,62].map(x=>`<path class="gl" d="M${x} 74v-12a2.5 2.5 0 0 1 5 0v12z"/>`).join('')}
    ${[16,23,76,83].map(x=>`<rect class="gl" x="${x}" y="48" width="3" height="8" rx="1.5"/>`).join('')}`;
}