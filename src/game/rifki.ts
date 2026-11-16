/* =========================================================
   RIFKI ABİ — klasik, nazik bir emlakçı; ara sıra hafif esprili tek satırlık ipuçları.
   En fazla 3 dakikada bir konuşur, × ile kapanır, Ayarlar'dan tamamen kapatılabilir.
   ========================================================= */
import { CFG, ORDER, DMAP, N, DistrictKey } from '../config';
import { S, lotsOf } from '../state';
import { now, pending, producing, neighbors, PAIRS, buildCost, withDisc, rate, isFull, unlockInfo } from '../economy';
import { weekKey, loc } from '../format';
import { t, nm, lowTxt, pctTxt } from '../i18n';
import { $, ui, SheetState, view, reduceMotion } from '../ui/ctx';
import { rifkiFace, moodOf, faceIn } from '../ui/rifkiFace';
import { nearestGoal } from './goals';
import { nextDistrict, kaporaOf, clearCost } from './district';
import { weekSpecial } from '../specials';
import { specialPrice } from './actions';
import { saveTarget, boostSaving } from './monetize';
import { tenantSay, Tenant, TenantEv } from './tenants';
import { tenantBadge } from '../ui/tenantFace';
import type { Arch } from './tenants';
import { ihaleTip, IH } from './auction';
import { blocks, nearest, pjDistrictOk, pjUnlocked, pjName, kindOf, typesAt } from './projcore';

let last2x = -1e9; // 2x hatırlatması (CFG.HINT2X_EVERY) en fazla bu sıklıkla

/** tn: kiracı olayında balonun köşesinde kiracının küçük yüzü (Rıfkı onu tanıtıyor). */
export interface Tip { id: string; text: string; go?: SheetState; tn?: Arch; }

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
  projectTips(out);
  const ih = ihaleTip(); if (ih) out.splice(out[0] && out[0].id === 'pjintro' ? 1 : 0, 0, ih); // ihale günü: ihale başına bir kez (proje tanıtımından sonra)
  let best = -1, br = 0;
  lots.forEach((p, i) => { if (producing(p) && !((p!.bu || 0) > tn)) { const r = rate(k, i, tn); if (r > br) { br = r; best = i; } } });
  if (best >= 0 && S.collects > 10) out.push({ id: 'boost', text: boostText(lots[best]!.sp ? 'sp' : lots[best]!.t), go: { k: 'plot', key: k, i: best } });
  return out;
}

/** Büyük projeler: açılış (bir kez, ilk uygun blok çıkınca) ve "blok neredeyse hazır" (1–2 kat kaldı). */
function projectTips(out: Tip[]) {
  if (!pjUnlocked()) return;
  if (!S.pjIntro) {
    const k = [S.cur, ...S.own.filter(o => o !== S.cur)].find(o => blocks(o).length);
    if (k) {
      const a = blocks(k)[0];
      out.unshift({ id: 'pjintro', text: t('Efendim, dolu semtte yan yana dört binanız varsa birleştirip koca bir proje yapabiliriz. {loc} bir {name}, ne dersiniz?', { loc: loc(nm(DMAP[k].n)), name: pjName(k, kindOf(typesAt(k, a))) }), go: { k: 'plot', key: k, i: a } });
      return;
    }
  }
  const k = S.cur, why = pjDistrictOk(k);
  if (why || blocks(k).length) return; // ruhsat yok (ya da semt sınırı dolu) veya hazır blok zaten var
  const n = nearest(k);
  if (n && n.floors >= 1 && n.floors <= 2) out.push({ id: 'pjnear', text: t('Şu dört binaya {f} kat daha çıkılırsa tek proje olur, kira da {p} artar. Benden söylemesi.', { f: n.floors, p: pctTxt(Math.round(CFG.PJ_X1 * 100)) }), go: { k: 'plot', key: k, i: n.i } });
}
/** Olay konuşması (proje teslimi, kaporalı semtte ruhsat): açık kart/panel kapanınca söylenir. */
export function sayTip(tip: Tip) { if (S.rifki) pendingEv = tip; }

export function hideTip() { const el = $('#rifki'); if (el) el.hidden = true; current = null; clearTimeout(hideT); }
export function showTip(tip: Tip) {
  const el = $('#rifki'); if (!el) return;
  current = tip; lastId = tip.id;
  if (tip.id === 'pjintro') S.pjIntro = true; // tanıtım bir kez
  if (tip.id === 'ihale' && IH().cur) IH().cur!.tip = true; // ihale ipucu ihale başına bir kez
  const mood = moodOf(tip.id); // ifade: ipucu kimliğinden (ui/rifkiFace.ts TIP_MOOD)
  el.innerHTML = `<div class="rk-face" data-mood="${mood}">${rifkiFace(mood)}</div><button class="rk-bub${tip.tn ? ' has-tn' : ''}" data-rk="go"><b>${t('RIFKI ABİ')}</b><span>${tip.text}</span>${tip.tn ? `<i class="rk-tn">${tenantBadge(tip.tn, tip.id === 'tenok' || tip.id === 'tenready' ? 'happy' : 'wait')}</i>` : ''}</button><button class="rk-x" data-rk="x" aria-label="${t('Kapat')}">×</button>`;
  el.hidden = false; faceIn(el.querySelector('.rk-face svg'), reduceMotion); clearTimeout(hideT); hideT = setTimeout(hideTip, 10e3);
}
/** Oyun döngüsünden çağrılır. */
let pendingEv: Tip | null = null;
/** Anlık olaylar (tapu alındı, semt bitti, kiracı geldi / hâlâ bekliyor / isteği oldu / yerleşti): normal ipucu aralığını
 *  beklemez; açık kart/panel kapanınca hemen söylenir. Kiracı olaylarında balonda kiracının yüzü görünür, dokunuş kartını açar. */
export function sayEvent(kind: 'deed' | 'done', k: DistrictKey): void;
export function sayEvent(kind: TenantEv, k: DistrictKey, x: Tenant): void;
export function sayEvent(kind: 'deed' | 'done' | TenantEv, k: DistrictKey, x?: Tenant) {
  if (!S.rifki) return;
  if (x) { pendingEv = { id: kind, text: tenantSay(kind as TenantEv, x), go: { k: 'kiraci', key: x.k, i: x.i }, tn: x.a }; return; }
  const d = nm(DMAP[k].n);
  pendingEv = kind === 'deed'
    ? { id: 'deed', text: t('{d} tapusu sizin, hayırlı olsun efendim! İlk arsaya bir ev kondurun, kira hemen başlar.', { d }) }
    : { id: 'done', text: t('{d} tamam! {n} arsanın hepsi sizin. Bir sonraki tapuya bakalım mı efendim?', { d, n: N }), go: { k: 'map' } };
}
export function maybeTip(pt: number) {
  if (!S.rifki || !S.city || ui.sheet || ui.modal || ui.ad) return;
  if (pendingEv) { const tip = pendingEv; pendingEv = null; lastAt = pt; lastId = tip.id; showTip(tip); return; } // olay: açık ipucunun yerine geçer; sonraki ipucu normal aralıkla
  if (current) return;
  if (pt - lastAt < CFG.TIP_EVERY) return;
  const list = tips(); if (!list.length) { lastAt = pt - CFG.TIP_EVERY + 15e3; return; } // söylenecek yok: 15 sn sonra yeniden bak
  const tip = list.find(x => x.id !== lastId) || list[0];
  lastAt = pt; if (tip.id === 'save2x') last2x = performance.now(); showTip(tip);
}
export function onTipClick(e: Event) {
  const b = (e.target as HTMLElement).closest('[data-rk]') as HTMLElement | null; if (!b) return;
  const go = current && current.go; hideTip();
  if (b.dataset.rk === 'go' && go) view.openSheet(go);
}
