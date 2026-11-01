/* Oyuncu eylemleri: topla (tek tuş / otomatik), kur, kat çık, yık, hızlandır, mülke 2x, semt al */
import { CFG, MAXLV, ORDER, TYPES, BuildingType, DistrictKey, DMAP, CITIES } from '../config';
import { S, lotsOf } from '../state';
import { now, withDisc, buildCost, buildTime, upCost, upTime, producing, unlockInfo } from '../economy';
import { Snd, buzz } from '../sound';
import { ui, $ } from '../ui/ctx';
import { toast, flyCoin, bump } from '../ui/modal';
import { closeSheet } from '../ui/sheets';
import { render } from '../ui/board';
import { track } from './tasks';
import { Ads } from '../services/ads';
import { persist } from './persist';
import { Analytics } from '../services/analytics';
import { weekKey } from '../format';

export function addCash(a: number) {
  if (!Number.isFinite(a) || a <= 0) return;
  S.cash += a; S.earned += a;
  const wk = weekKey(new Date(now()));
  if (S.week.key !== wk) S.week = { key: wk, earned: 0 };
  S.week.earned += a; track('earn', a);
  for (const t of ORDER) if (!S.seen[t] && S.earned >= TYPES[t].unlock) { S.seen[t] = true; toast(`Yeni bina: ${TYPES[t].n}`); Snd.unlock(); }
}
export function addBoost(ms: number) { S.boostUntil = Math.min(Math.max(S.boostUntil, now()) + ms, now() + CFG.BOOST_MAX); }

export function collect(k: DistrictKey, i: number) {
  const p = lotsOf(S, k)[i]; if (!p || p.buf <= 0) return;
  const el = ui.tiles[i], coinEl = el && el.querySelector('.coin');
  const a = p.buf; p.buf = 0; addCash(a); S.collects++; track('collect');
  ui.lastCollect[i] = performance.now();
  const t = performance.now(); ui.combo = t - ui.comboT < 500 ? ui.combo + 1 : 0; ui.comboT = t;
  Snd.collect(ui.combo); buzz(6);
  if (coinEl) flyCoin(coinEl); else bump();
  ui.tileSig[i] = '';
}
export function build(k: DistrictKey, i: number, t: BuildingType) {
  const c = withDisc(buildCost(k, t)), d = buildTime(k, t);
  if (S.cash < c || lotsOf(S, k)[i]) { Snd.no(); return; }
  S.cash -= c; S.disc = 0;
  lotsOf(S, k)[i] = { t, lvl: 0, buf: 0, until: now() + d, dur: d, up: false }; track('build');
  Analytics.log('build', { type: t, district: k });
  Snd.build(); buzz(15); persist(); closeSheet(); render();
}
export function upgrade(k: DistrictKey, i: number) {
  const p = lotsOf(S, k)[i]; if (!producing(p) || p.lvl >= MAXLV) return;
  const c = withDisc(upCost(k, p)), d = upTime(k, p);
  if (S.cash < c) { Snd.no(); return; }
  if (p.buf > 0) collect(k, i);
  S.cash -= c; S.disc = 0; p.until = now() + d; p.dur = d; p.up = true; track('upgrade');
  Analytics.log('upgrade', { type: p.t, level: p.lvl + 1 });
  Snd.build(); buzz(15); persist(); ui.sheetSig = ''; render();
}
export function demolish(k: DistrictKey, i: number) {
  const p = lotsOf(S, k)[i]; if (p && p.buf > 0) collect(k, i);
  lotsOf(S, k)[i] = null; persist(); closeSheet(); Snd.wreck(); render();
}
export function skip(k: DistrictKey, i: number) {
  const p = lotsOf(S, k)[i]; if (!p || !p.until) return;
  const rem = p.until - now();
  Ads.rewarded('skip', rem <= CFG.AD_SKIP ? 'İnşaat hemen biter' : 'İnşaattan 30 dk düşer', () => {
    const q = lotsOf(S, k)[i]; if (!q || !q.until) return;
    q.until = (q.until - now() <= CFG.AD_SKIP) ? now() : q.until - CFG.AD_SKIP; S.skipHint = 1; ui.sheetSig = '';
  });
}
/** Tek tuşla topla: bütün semtlerdeki kumbaralar kasaya. */
export function collectAll(from?: Element | null) {
  let a = 0;
  for (const k of S.own) for (const p of lotsOf(S, k)) if (p && p.buf > 0) { a += p.buf; p.buf = 0; }
  if (a < 1) { toast('Toplanacak kira yok, biraz bekle'); Snd.no(); return; }
  addCash(a); S.collects++; track('collect');
  Snd.collect(3); buzz(10);
  if (from) flyCoin(from); else bump();
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
  if ((p!.bu || 0) - now() > CFG.LOT_BOOST_MAX - CFG.LOT_BOOST / 2) { toast('Bu mülkün 2x süresi dolu. En fazla 4 saat birikir.'); return; }
  Ads.rewarded('lotboost', `${TYPES[p!.t].n}: 1 saat 2x`, () => {
    const q = lotsOf(S, k)[i]; if (!q) return;
    q.bu = Math.min(Math.max(q.bu || 0, now()) + CFG.LOT_BOOST, now() + CFG.LOT_BOOST_MAX);
    track('lotboost'); toast(`${TYPES[q.t].n} 2x kazanıyor`);
    Analytics.log('lot_boost', { type: q.t, district: k });
  });
}
export function buyDistrict(k: DistrictKey) {
  const u = unlockInfo(k); if (!u.ok) return;
  if (S.cash < u.fee) { Snd.no(); return; }
  const d = DMAP[k], newCity = !S.own.some(o => DMAP[o].city === d.city);
  S.cash -= u.fee; S.own.push(k); lotsOf(S, k); switchDistrict(k); persist(); closeSheet();
  Snd.unlock(); buzz(30);
  toast(newCity ? `${CITIES[d.city].n} portföyüne eklendi · ${d.n}` : `${d.n} tapusu senin`);
  Analytics.log(newCity ? 'city_unlock' : 'district_unlock', { district: k });
}
export function switchDistrict(k: DistrictKey) { if (!S.own.includes(k)) return; S.cur = k; ui.tileSig = []; ui.linkSig = ''; render(); }

/** Ödüllü reklam (ya da premium) sonrası ortak işlemler. */
export function grantReward(fn?: () => void) {
  if (fn) fn();
  Snd.reward(); buzz(25); S.nextAd = Math.max(S.nextAd, S.playMs + 5 * 60e3); track('ad');
  persist(); ui.sheetSig = ''; ui.tileSig = []; render();
}
export const nudgeCollect = () => { const b = $('#collectBtn'); b.classList.remove('nudge'); void b.offsetWidth; b.classList.add('nudge'); };
