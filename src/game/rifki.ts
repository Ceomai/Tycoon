/* =========================================================
   RIFKI ABİ — klasik, nazik bir emlakçı; ara sıra hafif esprili tek satırlık ipuçları.
   En fazla 3 dakikada bir konuşur, × ile kapanır, Ayarlar'dan tamamen kapatılabilir.
   ========================================================= */
import { CFG, TYPES, ORDER, DMAP, N } from '../config';
import { S, lotsOf } from '../state';
import { now, pending, producing, neighbors, PAIRS, buildCost, withDisc, rate, isFull, unlockInfo } from '../economy';
import { weekKey, loc } from '../format';

const GEN: Record<string, string> = { ev: 'Evin', kafe: 'Kafenin', dukkan: 'Dükkânın', ofis: 'Ofisin' };
const LOW: Record<string, string> = { ev: 'ev', kafe: 'kafe', dukkan: 'dükkân', ofis: 'ofis' };
import { $, ui, SheetState } from '../ui/ctx';
import { openSheet } from '../ui/sheets';
import { nearestGoal } from './goals';
import { nextDistrict, kaporaOf, clearCost } from './district';
import { festivalOn } from './festival';
import { weekSpecial } from '../specials';
import { specialPrice } from './actions';

interface Tip { id: string; text: string; go?: SheetState; }
const FACE = `<svg viewBox="0 0 74 86" aria-hidden="true"><rect x="1" y="1" width="72" height="84" rx="8" fill="var(--surface)" stroke="var(--ink)" stroke-width="1.5"/>
  <path d="M14 85c2-16 10-22 23-22s21 6 23 22" fill="#55685f" stroke="var(--ink)" stroke-width="1.2"/><path d="M30 63l7 9 7-9" fill="#fbfbf7" stroke="var(--ink)"/><path d="M37 66v14" stroke="#c23b2e" stroke-width="3"/>
  <circle cx="37" cy="40" r="17" fill="#efd8b3" stroke="var(--ink)" stroke-width="1.2"/><path d="M20 33c2-12 32-12 34 0" fill="#1e3a32"/><rect x="18" y="30" width="38" height="5" rx="2" fill="#1e3a32"/>
  <circle cx="31" cy="40" r="1.6" fill="#1e3a32"/><circle cx="43" cy="40" r="1.6" fill="#1e3a32"/><path d="M28 47c3-2 6-2 9 0 3-2 6-2 9 0-3 3-15 3-18 0z" fill="#1e3a32"/></svg>`;

let lastAt = -CFG.TIP_EVERY + 45e3; // ilk ipucu ~45 sn oyundan sonra
let lastId = '', hideT: any = 0, current: Tip | null = null;

function tips(): Tip[] {
  const out: Tip[] = [], t = now(), k = S.cur, d = DMAP[k], lots = lotsOf(S, k);
  const f = festivalOn(t);
  if (f) out.push({ id: 'fest', text: `${f.n} kutlu olsun! Bugün kiralar %20 fazla; tam tapu günü.` });
  if (S.collectMode === 'tap' && pending().fill >= .9) out.push({ id: 'full', text: 'Kumbaralar ağzına kadar dolmuş efendim. TOPLA’ya bir basın, kira boşa akmasın.' });
  const T = S.tasks;
  if (T && !T.bonus && T.list.filter(q => q.claimed).length === 2) out.push({ id: 'task', text: 'Bir görev kaldı efendim. Bitirin, bütün mülkler bir saat 2x kazansın.', go: { k: 'tasks' } });
  // akıllı ikili fırsatı: boş arsanın komşusunda eşi açılmış bir bina
  for (let i = 0; i < N && !out.some(o => o.id === 'pair'); i++) {
    if (lots[i]) continue;
    for (const j of neighbors(i)) {
      const q = lots[j]; if (!q || q.sp || q.lvl < 1) continue;
      const mate = PAIRS[q.t]; if (!S.seen[mate]) continue;
      out.push({ id: 'pair', text: `${GEN[q.t]} yanındaki arsa boş duruyor. Bir ${LOW[mate]} kondurun, ikisi de %10 fazla kazanır.`, go: { k: 'plot', key: k, i } });
      break;
    }
  }
  const nk = nextDistrict(k);
  if (nk && isFull(k) && !S.lien[k]) { const kap = kaporaOf(nk), fee = unlockInfo(nk).fee; if (S.cash >= kap && S.cash < fee) out.push({ id: 'kapora', text: `${DMAP[nk].n} için kapora hazır efendim. Tapuyu beklemeyin; %30 verip hemen başlayın.`, go: { k: 'map' } }); }
  const obi = lots.findIndex(p => p && p.ob);
  if (obi >= 0 && S.cash >= clearCost(k)) out.push({ id: 'ob', text: 'Arsadaki hurdayı bir temizletin; içinden ne çıkacağı belli olmaz.', go: { k: 'plot', key: k, i: obi } });
  const ng = nearestGoal();
  if (ng && ng.ratio >= .6) out.push({ id: 'goal', text: `${loc(DMAP[ng.k].n)} bir yıldıza az kaldı: ${ng.g.t.toLocaleLowerCase('tr-TR')}. Söylemedi demeyin.`, go: { k: 'map' } });
  const wk = weekKey(new Date(t)), sp = weekSpecial(wk);
  if (!(S.ozel.week === wk && S.ozel.bought) && S.cash >= specialPrice()) out.push({ id: 'ozel', text: `Bu hafta ${sp.n} satışta. Böyle tapu her gün çıkmaz efendim.`, go: { k: 'ozel' } });
  const empty = lots.findIndex(p => !p);
  if (empty >= 0 && ORDER.some(b => S.seen[b] && S.cash >= withDisc(buildCost(k, b)))) out.push({ id: 'empty', text: `${loc(d.n)} boş arsa var. Arsa boş durunca kira getirmez; küçük bir ev bile iş görür.`, go: { k: 'plot', key: k, i: empty } });
  let best = -1, br = 0;
  lots.forEach((p, i) => { if (producing(p) && !((p!.bu || 0) > t)) { const r = rate(k, i, t); if (r > br) { br = r; best = i; } } });
  if (best >= 0 && S.collects > 10) out.push({ id: 'boost', text: `En çok kazandıran mülkünüz bu ${lots[best]!.sp ? 'özel yapı' : LOW[lots[best]!.t]}. Ona bir 2x verin, para orada katlanır.`, go: { k: 'plot', key: k, i: best } });
  return out;
}

export function hideTip() { const el = $('#rifki'); if (el) el.hidden = true; current = null; clearTimeout(hideT); }
export function showTip(tip: Tip) {
  const el = $('#rifki'); if (!el) return;
  current = tip; lastId = tip.id;
  el.innerHTML = `<div class="rk-face">${FACE}</div><button class="rk-bub" data-rk="go"><b>RIFKI ABİ</b><span>${tip.text}</span></button><button class="rk-x" data-rk="x" aria-label="Kapat">×</button>`;
  el.hidden = false; clearTimeout(hideT); hideT = setTimeout(hideTip, 10e3);
}
/** Oyun döngüsünden çağrılır. */
export function maybeTip(pt: number) {
  if (!S.rifki || !S.city || ui.sheet || ui.modal || ui.ad || current) return;
  if (pt - lastAt < CFG.TIP_EVERY) return;
  const list = tips(); if (!list.length) return;
  const tip = list.find(x => x.id !== lastId) || list[0];
  lastAt = pt; showTip(tip);
}
export function onTipClick(e: Event) {
  const b = (e.target as HTMLElement).closest('[data-rk]') as HTMLElement | null; if (!b) return;
  const go = current && current.go; hideTip();
  if (b.dataset.rk === 'go' && go) openSheet(go);
}
