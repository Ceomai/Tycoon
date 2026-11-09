/* =========================================================
   RIFKI ABİ — klasik, nazik bir emlakçı; ara sıra hafif esprili tek satırlık ipuçları.
   En fazla 3 dakikada bir konuşur, × ile kapanır, Ayarlar'dan tamamen kapatılabilir.
   ========================================================= */
import { CFG, TYPES, ORDER, DMAP, N } from '../config';
import { S, lotsOf } from '../state';
import { now, pending, producing, neighbors, PAIRS, buildCost, withDisc, rate, isFull, unlockInfo } from '../economy';
import { weekKey, loc } from '../format';
import { t, nm, LANG } from '../i18n';
import { $, ui, SheetState } from '../ui/ctx';
import { openSheet } from '../ui/sheets';
import { nearestGoal } from './goals';
import { nextDistrict, kaporaOf, clearCost } from './district';
import { weekSpecial } from '../specials';
import { specialPrice } from './actions';
import { saveTarget, boostSaving } from './monetize';

let last2x = -1e9; // 2x hatırlatması (CFG.HINT2X_EVERY) en fazla bu sıklıkla

interface Tip { id: string; text: string; go?: SheetState; }
const FACE = `<svg viewBox="0 0 74 86" aria-hidden="true"><rect x="1" y="1" width="72" height="84" rx="8" fill="var(--surface)" stroke="var(--ink)" stroke-width="1.5"/>
  <path d="M14 85c2-16 10-22 23-22s21 6 23 22" fill="#55685f" stroke="var(--ink)" stroke-width="1.2"/><path d="M30 63l7 9 7-9" fill="#fbfbf7" stroke="var(--ink)"/><path d="M37 66v14" stroke="#c23b2e" stroke-width="3"/>
  <circle cx="37" cy="40" r="17" fill="#efd8b3" stroke="var(--ink)" stroke-width="1.2"/><path d="M20 33c2-12 32-12 34 0" fill="#1e3a32"/><rect x="18" y="30" width="38" height="5" rx="2" fill="#1e3a32"/>
  <circle cx="31" cy="40" r="1.6" fill="#1e3a32"/><circle cx="43" cy="40" r="1.6" fill="#1e3a32"/><path d="M28 47c3-2 6-2 9 0 3-2 6-2 9 0-3 3-15 3-18 0z" fill="#1e3a32"/></svg>`;

/* Türkçede bina adı cümlede çekimlendiği için (Evin / Evinize / ev) her bina için ayrı tam cümle anahtarı. */
function pairText(bt: string): string {
  switch (bt) {
    case 'ev': return t('Evin yanındaki arsa boş duruyor. Bir dükkân kondurun, ikisi de %10 fazla kazanır.');
    case 'kafe': return t('Kafenin yanındaki arsa boş duruyor. Bir ofis kondurun, ikisi de %10 fazla kazanır.');
    case 'dukkan': return t('Dükkânın yanındaki arsa boş duruyor. Bir ev kondurun, ikisi de %10 fazla kazanır.');
    default: return t('Ofisin yanındaki arsa boş duruyor. Bir kafe kondurun, ikisi de %10 fazla kazanır.');
  }
}
function save2xText(bt: string, p: { d: string; n: number; m: number }): string {
  switch (bt) {
    case 'sp': return t('{d} tapusuna {n} dakika var efendim. Özel yapınıza bir reklamlık 2x verirseniz {m} dakikaya iner, benden söylemesi.', p);
    case 'ev': return t('{d} tapusuna {n} dakika var efendim. Evinize bir reklamlık 2x verirseniz {m} dakikaya iner, benden söylemesi.', p);
    case 'kafe': return t('{d} tapusuna {n} dakika var efendim. Kafenize bir reklamlık 2x verirseniz {m} dakikaya iner, benden söylemesi.', p);
    case 'dukkan': return t('{d} tapusuna {n} dakika var efendim. Dükkânınıza bir reklamlık 2x verirseniz {m} dakikaya iner, benden söylemesi.', p);
    default: return t('{d} tapusuna {n} dakika var efendim. Ofisinize bir reklamlık 2x verirseniz {m} dakikaya iner, benden söylemesi.', p);
  }
}
function boostText(bt: string): string {
  switch (bt) {
    case 'sp': return t('En çok kazandıran mülkünüz bu özel yapı. Ona bir 2x verin, para orada katlanır.');
    case 'ev': return t('En çok kazandıran mülkünüz bu ev. Ona bir 2x verin, para orada katlanır.');
    case 'kafe': return t('En çok kazandıran mülkünüz bu kafe. Ona bir 2x verin, para orada katlanır.');
    case 'dukkan': return t('En çok kazandıran mülkünüz bu dükkân. Ona bir 2x verin, para orada katlanır.');
    default: return t('En çok kazandıran mülkünüz bu ofis. Ona bir 2x verin, para orada katlanır.');
  }
}
/** Cümle içi küçük harf (Almancada adlar büyük harfle kalır). */
const lowTxt = (s: string) => (LANG === 'de' ? s : s.toLocaleLowerCase(LANG === 'tr' ? 'tr-TR' : LANG));

let lastAt = -CFG.TIP_EVERY + 45e3; // ilk ipucu ~45 sn oyundan sonra
let lastId = '', hideT: any = 0, current: Tip | null = null;

function tips(): Tip[] {
  const out: Tip[] = [], tn = now(), k = S.cur, d = DMAP[k], lots = lotsOf(S, k);
  if (S.collectMode === 'tap' && pending().fill >= .9) out.push({ id: 'full', text: t('Kumbaralar ağzına kadar dolmuş efendim. TOPLA’ya bir basın, kira boşa akmasın.') });
  const T = S.tasks;
  if (T && !T.bonus && T.list.filter(q => q.claimed).length === 2) out.push({ id: 'task', text: t('Bir görev kaldı efendim. Bitirin, bütün mülkler bir saat 2x kazansın.'), go: { k: 'tasks' } });
  // akıllı ikili fırsatı: boş arsanın komşusunda eşi açılmış bir bina
  for (let i = 0; i < N && !out.some(o => o.id === 'pair'); i++) {
    if (lots[i]) continue;
    for (const j of neighbors(i)) {
      const q = lots[j]; if (!q || q.sp || q.lvl < 1) continue;
      const mate = PAIRS[q.t]; if (!S.seen[mate]) continue;
      out.push({ id: 'pair', text: pairText(q.t), go: { k: 'plot', key: k, i } });
      break;
    }
  }
  const nk = nextDistrict(k);
  if (nk && isFull(k) && !S.lien[k]) { const kap = kaporaOf(nk), fee = unlockInfo(nk).fee; if (S.cash >= kap && S.cash < fee) out.push({ id: 'kapora', text: t('{d} için kapora hazır efendim. Tapuyu beklemeyin; %30 verip hemen başlayın.', { d: nm(DMAP[nk].n) }), go: { k: 'map' } }); }
  const obi = lots.findIndex(p => p && p.ob);
  if (obi >= 0 && S.cash >= clearCost(k)) out.push({ id: 'ob', text: t('Arsadaki hurdayı bir temizletin; içinden ne çıkacağı belli olmaz.'), go: { k: 'plot', key: k, i: obi } });
  const ng = nearestGoal();
  if (ng && ng.ratio >= .6) out.push({ id: 'goal', text: t('{loc} bir yıldıza az kaldı: {goal}. Söylemedi demeyin.', { loc: loc(nm(DMAP[ng.k].n)), goal: lowTxt(t(ng.g.t)) }), go: { k: 'map' } });
  const wk = weekKey(new Date(tn)), sp = weekSpecial(wk);
  if (!(S.ozel.week === wk && S.ozel.bought) && S.cash >= specialPrice()) out.push({ id: 'ozel', text: t('Bu hafta {name} satışta. Böyle tapu her gün çıkmaz efendim.', { name: t(sp.n) }), go: { k: 'ozel' } });
  const empty = lots.findIndex(p => !p);
  if (empty >= 0 && ORDER.some(b => S.seen[b] && S.cash >= withDisc(buildCost(k, b)))) out.push({ id: 'empty', text: t('{loc} boş arsa var. Arsa boş durunca kira getirmez; küçük bir ev bile iş görür.', { loc: loc(nm(d.n)) }), go: { k: 'plot', key: k, i: empty } });
  // tapu beklerken: en çok kazandıran binaya 2x (tasarım M3)
  const tg = saveTarget(), bs = tg && boostSaving(tg.rem);
  if (tg && bs && bs.now >= 5 && bs.saved >= 2 && performance.now() - last2x > CFG.HINT2X_EVERY) {
    const q = lotsOf(S, bs.lot.k)[bs.lot.i]!;
    out.unshift({ id: 'save2x', text: save2xText(q.sp ? 'sp' : q.t, { d: nm(DMAP[tg.k].n), n: Math.round(bs.now), m: Math.max(1, Math.round(bs.now - bs.saved)) }), go: { k: 'plot', key: bs.lot.k, i: bs.lot.i } });
  }
  let best = -1, br = 0;
  lots.forEach((p, i) => { if (producing(p) && !((p!.bu || 0) > tn)) { const r = rate(k, i, tn); if (r > br) { br = r; best = i; } } });
  if (best >= 0 && S.collects > 10) out.push({ id: 'boost', text: boostText(lots[best]!.sp ? 'sp' : lots[best]!.t), go: { k: 'plot', key: k, i: best } });
  return out;
}

export function hideTip() { const el = $('#rifki'); if (el) el.hidden = true; current = null; clearTimeout(hideT); }
export function showTip(tip: Tip) {
  const el = $('#rifki'); if (!el) return;
  current = tip; lastId = tip.id;
  el.innerHTML = `<div class="rk-face">${FACE}</div><button class="rk-bub" data-rk="go"><b>${t('RIFKI ABİ')}</b><span>${tip.text}</span></button><button class="rk-x" data-rk="x" aria-label="${t('Kapat')}">×</button>`;
  el.hidden = false; clearTimeout(hideT); hideT = setTimeout(hideTip, 10e3);
}
/** Oyun döngüsünden çağrılır. */
export function maybeTip(pt: number) {
  if (!S.rifki || !S.city || ui.sheet || ui.modal || ui.ad || current) return;
  if (pt - lastAt < CFG.TIP_EVERY) return;
  const list = tips(); if (!list.length) { lastAt = pt - CFG.TIP_EVERY + 15e3; return; } // söylenecek yok: 15 sn sonra yeniden bak
  const tip = list.find(x => x.id !== lastId) || list[0];
  lastAt = pt; if (tip.id === 'save2x') last2x = performance.now(); showTip(tip);
}
export function onTipClick(e: Event) {
  const b = (e.target as HTMLElement).closest('[data-rk]') as HTMLElement | null; if (!b) return;
  const go = current && current.go; hideTip();
  if (b.dataset.rk === 'go' && go) openSheet(go);
}
