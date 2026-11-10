/* Oyuncu eylemleri: topla (tek tuş / otomatik), kur, kat çık, yık, hızlandır, mülke 2x, semt al */
import { CFG, MAXLV, ORDER, TYPES, BuildingType, DistrictKey, DMAP, CITIES } from '../config';
import { t } from '../i18n';
import { S, lotsOf } from '../state';
import { now, withDisc, buildCost, buildTime, upCost, upTime, producing, unlockInfo, totalRate, pending } from '../economy';
import { Snd, buzz } from '../sound';
import { ui, $, reduceMotion } from '../ui/ctx';
import { toast, bump, flyTo, countUp, showGain, bigStamp } from '../ui/modal';
import { deny, play, fadeIn, EASE } from '../ui/motion';
import { closeSheet } from '../ui/sheets';
import { render } from '../ui/board';
import { track } from './tasks';
import { Ads } from '../services/ads';
import { persist } from './persist';
import { Analytics } from '../services/analytics';
import { weekKey, fmt } from '../format';
import { weekSpecial, specialOf } from '../specials';
import { addXp } from './fun';
import { kaporaOf, lienBlocks, placeObstacles, showDistrictCard, showSummary } from './district';

export function addCash(a: number) {
  if (!Number.isFinite(a) || a <= 0) return;
  S.cash += a; S.earned += a;
  const wk = weekKey(new Date(now()));
  if (S.week.key !== wk) S.week = { key: wk, earned: 0 };
  S.week.earned += a; track('earn', a);
  for (const bt of ORDER) if (!S.seen[bt] && S.earned >= TYPES[bt].unlock) { S.seen[bt] = true; toast(t('Yeni bina: {type}', { type: t(TYPES[bt].n) })); Snd.unlock(); }
}
export function addBoost(ms: number) { S.boostUntil = Math.min(Math.max(S.boostUntil, now()) + ms, now() + CFG.BOOST_MAX); }

export function collect(k: DistrictKey, i: number) {
  const p = lotsOf(S, k)[i]; if (!p || p.buf <= 0) return;
  const a = p.buf; p.buf = 0; addCash(a); S.collects++; track('collect');
  ui.lastCollect[i] = performance.now();
  const t = performance.now(); ui.combo = t - ui.comboT < 500 ? ui.combo + 1 : 0; ui.comboT = t;
  Snd.collect(ui.combo); buzz.light(); bump();
  ui.tileSig[i] = '';
}
export function build(k: DistrictKey, i: number, bt: BuildingType) {
  const c = withDisc(buildCost(k, bt)), d = buildTime(k, bt);
  if (S.cash < c || lotsOf(S, k)[i]) { deny(); return; }
  if (lienBlocks(k)) { toast(t('Kaporalı semtte {n} arsa açık · borç bitince hepsi açılır', { n: CFG.KAPORA_LOTS })); deny(); return; }
  S.cash -= c; S.disc = 0;
  lotsOf(S, k)[i] = { t: bt, lvl: 0, buf: 0, until: now() + d, dur: d, up: false }; track('build'); addXp(15);
  Analytics.log('build', { type: bt, district: k });
  if (k === S.cur) ui.pop.add(i); // inşaat başlangıcı: karoda küçük pop (render sonrası)
  Snd.build(); buzz.light(); persist(); closeSheet(); render();
}
export function upgrade(k: DistrictKey, i: number) {
  const p = lotsOf(S, k)[i]; if (!producing(p) || p!.sp || p!.lvl >= MAXLV) return;
  const c = withDisc(upCost(k, p)), d = upTime(k, p);
  if (S.cash < c) { deny(); return; }
  if (p.buf > 0) collect(k, i);
  S.cash -= c; S.disc = 0; p.until = now() + d; p.dur = d; p.up = true; track('upgrade'); addXp(20);
  Analytics.log('upgrade', { type: p.t, level: p.lvl + 1 });
  if (k === S.cur) { ui.pop.add(i); ui.tileSig[i] = ''; }
  Snd.build(); buzz.light(); persist(); ui.sheetSig = ''; render();
}
export function demolish(k: DistrictKey, i: number) {
  const p = lotsOf(S, k)[i]; if (p && p.buf > 0) collect(k, i);
  if (p && p.sp) { S.inv.push(p.sp); toast(t('{name} depoya kaldırıldı', { name: t(specialOf(p.sp).n) })); } // özel yapı kaybolmaz
  lotsOf(S, k)[i] = null; persist(); closeSheet(); Snd.wreck(); render();
}
/** Haftanın özel tapusu: yaklaşık 2 saatlik kira geliri; haftada bir kez. */
export const specialPrice = () => Math.max(20000, totalRate(false) * 3600 * CFG.SP_PRICE_H);
export function buySpecial() {
  const wk = weekKey(new Date(now())), sp = weekSpecial(wk), price = specialPrice();
  if (S.ozel.week === wk && S.ozel.bought) return toast(t('Bu haftanın tapusu zaten senin'));
  if (S.cash < price) { deny(); return; }
  S.cash -= price; S.inv.push(sp.id); S.ozel = { week: wk, bought: true };
  Snd.unlock(); buzz.success(); persist(); ui.sheetSig = '';
  toast(t('{name} tapusu senin · boş bir arsaya dokunup yerleştir', { name: t(sp.n) }));
  Analytics.log('special_buy', { id: sp.id });
}
export function placeSpecial(k: DistrictKey, i: number, id: string) {
  const at = S.inv.indexOf(id); if (at < 0 || lotsOf(S, k)[i]) return;
  if (lienBlocks(k)) { toast(t('Kaporalı semtte {n} arsa açık · borç bitince hepsi açılır', { n: CFG.KAPORA_LOTS })); return; }
  S.inv.splice(at, 1);
  lotsOf(S, k)[i] = { t: 'ofis', lvl: 1, buf: 0, until: 0, dur: 1, up: false, sp: id };
  if (k === S.cur) { ui.teslim[i] = { at: performance.now() + 1600, txt: t(specialOf(id).n) }; ui.pop.add(i); }
  Snd.unlock(); buzz.success(); persist(); closeSheet(); render();
  Analytics.log('special_place', { id, district: k });
}
export function skip(k: DistrictKey, i: number) {
  const p = lotsOf(S, k)[i]; if (!p || !p.until) return;
  const rem = p.until - now();
  if (rem <= CFG.SKIP_LEFT + 1e3) return; // zaten bitmek üzere
  Ads.rewarded('skip', rem <= CFG.AD_SKIP ? t('İnşaat 5 saniyeye iner') : t('İnşaattan 30 dk düşer'), () => {
    const q = lotsOf(S, k)[i]; if (!q || !q.until) return;
    const left = q.until - now();
    q.until = left <= CFG.AD_SKIP ? now() + Math.min(left, CFG.SKIP_LEFT) : q.until - CFG.AD_SKIP; S.skipHint = 1; ui.sheetSig = '';
  });
}
/** Tek tuşla topla: bütün semtlerdeki kumbaralar kasaya. */
export function collectAll(from?: Element | null) {
  ui.breakAt = performance.now(); // geçiş reklamı için doğal durak
  const full = pending().fill >= .999;
  // bu semtte kirası olan binalardan (en çok 7) mühre para uçar
  const src = lotsOf(S, S.cur).map((p, i) => ({ p, i })).filter(x => x.p && x.p.buf >= 1).sort((a, b) => b.p!.buf - a.p!.buf).slice(0, 7);
  let a = 0;
  for (const k of S.own) for (const p of lotsOf(S, k)) if (p && p.buf > 0) { a += p.buf; p.buf = 0; }
  if (a < 1) { toast(t('Toplanacak kira yok, biraz bekle')); deny(from || $('#collectBtn')); return; }
  const before = S.cash;
  addCash(a); S.collects++; track('collect'); addXp(5);
  // paralar binalardan kasaya uçar; sonuncusu varınca kasa vurgulanır ve sayaç saymaya başlar
  const cash = $('#cash'), flights = from ? src.map((x, n) => { const el = ui.tiles[x.i]; return el ? flyTo(el, cash, n * 45) : Promise.resolve(); }) : [];
  const landed = Promise.all(flights).then(() => bump());
  countUp(before, S.cash, landed); showGain(`+${fmt(a)} ↑`);
  if (full) bigStamp(t('DOLU KASA!'), t('KUMBARALAR TAŞMADAN'));
  Snd.collect(full ? 6 : 4); if (full) buzz.success(); else buzz.light();
  ui.tileSig = []; persist();
}
let autoAcc = 0, autoT = 0;
/** Otomatik toplama: her döngüde kumbaralar sessizce kasaya akar; görev ilerlemesi 10 sn'de bir sayılır. */
export function autoCollect(pt: number) {
  let a = 0;
  for (const k of S.own) for (const p of lotsOf(S, k)) if (p && p.buf > 0) { a += p.buf; p.buf = 0; }
  if (a > 0) { addCash(a); autoAcc += a; }
  if (pt - autoT > 10e3) { autoT = pt; if (autoAcc > 0) { autoAcc = 0; S.collects++; track('collect'); } }
}
/** Bu mülke 2x: ödüllü reklam başına +1 saat, en fazla 4 saat. */
export function lotBoost(k: DistrictKey, i: number) {
  const p = lotsOf(S, k)[i]; if (!producing(p)) return;
  if ((p!.bu || 0) - now() > CFG.LOT_BOOST_MAX - CFG.LOT_BOOST / 2) { toast(t('Bu mülkün 2x süresi dolu. En fazla 4 saat birikir.')); return; }
  Ads.rewarded('lotboost', t('{type}: 1 saat 2x', { type: t(TYPES[p!.t].n) }), () => {
    const q = lotsOf(S, k)[i]; if (!q) return;
    q.bu = Math.min(Math.max(q.bu || 0, now()) + CFG.LOT_BOOST, now() + CFG.LOT_BOOST_MAX);
    track('lotboost'); addXp(10); toast(t('{type} 2x kazanıyor', { type: t(TYPES[q.t].n) }));
    Analytics.log('lot_boost', { type: q.t, district: k });
  });
}
/** Tapu alımı (tam bedel) ya da kapora (%30 peşin, kalan borç semtin kirasıyla ödenir). */
export function buyDistrict(k: DistrictKey, kapora = false) {
  const u = unlockInfo(k); if (!u.ok) return;
  const pay = kapora ? kaporaOf(k) : u.fee;
  if (S.cash < pay) { deny(); return; }
  const d = DMAP[k], newCity = !S.own.some(o => DMAP[o].city === d.city);
  S.cash -= pay; S.own.push(k); lotsOf(S, k);
  if (kapora) { S.lien[k] = u.fee - pay; S.lienT[k] = u.fee - pay; S.cnt.kapora++; }
  placeObstacles(k);
  switchDistrict(k); persist(); closeSheet();
  Snd.unlock(); buzz.success();
  showDistrictCard(k);
  Analytics.log(newCity ? 'city_unlock' : 'district_unlock', { district: k, kapora });
}
export function switchDistrict(k: DistrictKey) {
  if (!S.own.includes(k)) return; ui.breakAt = performance.now(); const from = S.cur; S.cur = k; ui.teslim = {}; ui.pop.clear(); showSummary(k, from); ui.tileSig = []; ui.linkSig = ''; render();
  if (from !== k) slideIn($('.plate'), order(k) >= order(from) ? 1 : -1);
}
/** Semtlerin sahiplik sırası (haritadaki sıra): ileri semt sağdan, geri semt soldan kayar. */
const order = (k: DistrictKey) => { const i = S.own.indexOf(k); return i < 0 ? 0 : i; };
/** Semt değişince ızgara yön duyarlı kısa kayma + belirme (~220 ms); hareketi azalt açıkken yalnız opaklık. */
function slideIn(el: Element | null, dir: number) {
  if (reduceMotion) { fadeIn(el, 'sw', 140); return; }
  play(el, 'sw', [{ transform: `translateX(${dir * 24}px)`, opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 220, easing: EASE.out });
}

/** Ödüllü reklam (ya da premium) sonrası ortak işlemler. */
export function grantReward(fn?: () => void) {
  if (fn) fn();
  Snd.reward(); buzz.success(); S.nextAd = Math.max(S.nextAd, S.playMs + 5 * 60e3); track('ad');
  persist(); ui.sheetSig = ''; ui.tileSig = []; render();
}
/** TOPLA mührü dikkat çekmek için kısaca sallanır (WAAPI; hareketi azalt açıkken ya da boştayken oynamaz). */
export const nudgeCollect = () => {
  if (reduceMotion || ui.idle) return;
  play($('#collectBtn .core'), 'nudge', [{ transform: 'rotate(-8deg)' }, { transform: 'rotate(-8deg) scale(1.06)', offset: .2 }, { transform: 'rotate(8deg) scale(1.08)', offset: .4 }, { transform: 'rotate(-4deg)', offset: .6 }, { transform: 'rotate(2deg)', offset: .8 }, { transform: 'rotate(-8deg)' }], { duration: 900, easing: 'ease-in-out' });
};
