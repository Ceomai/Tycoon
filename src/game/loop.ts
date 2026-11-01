/* OYUN DÖNGÜSÜ (4 Hz), başlangıç ili seçimi, boşta duraklatma, yeni oyun */
import { CFG, N, CITIES, CITY_ORDER, CityId, dkey, TYPES } from '../config';
import { S, setS, newState, lotsOf } from '../state';
import { rand, dayKey, weekKey } from '../format';
import { now, producing, rate, pending } from '../economy';
import { Time } from '../time';
import { Snd, buzz } from '../sound';
import { $, ui } from '../ui/ctx';
import { toast, openModal, closeModal } from '../ui/modal';
import { closeSheet } from '../ui/sheets';
import { render, Street } from '../ui/board';
import { ensureTasks } from './tasks';
import { checkDaily } from './daily';
import { showEvent } from './events';
import { showOffer } from './offers';
import { nudgeCollect, autoCollect } from './actions';
import { persist, dirty, clearDirty } from './persist';
import { clearSave } from '../storage';
import { Ads } from '../services/ads';
import { Cloud } from '../services/cloud';
import { Analytics } from '../services/analytics';
import { checkGoals } from './goals';
import { maybeTip } from './rifki';
import { festivalOn } from './festival';
import { showFestGift } from './events';

let lastT = performance.now(), lastGoals = 0;
const anyProducing = () => S.own.some(k => lotsOf(S, k).some(producing));

export function tick() {
  const pt = performance.now(), dt = Math.min(pt - lastT, 1000); lastT = pt;
  if (document.hidden) return;
  const t = now();
  S.maxSeen = Math.max(S.maxSeen, t);
  for (const k of S.own) {
    const lots = lotsOf(S, k);
    for (let i = 0; i < N; i++) {
      const p = lots[i]; if (!p) continue;
      if (p.until && t >= p.until) {
        p.until = 0; if (p.up) { p.lvl++; p.up = false; } else p.lvl = 1;
        if (k === S.cur) ui.teslim[i] = { at: pt + 1600, txt: `${TYPES[p.t].n} · kat ${p.lvl}` }; // tapu teslim mührü
        if (k === S.cur && ui.tiles[i]) { const el = ui.tiles[i]; ui.tileSig[i] = ''; el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop'); }
        Snd.done(); buzz(12); ui.sheetSig = '';
      }
      if (producing(p)) { const r = rate(k, i, t), cap = r * CFG.CAP_SEC; if (p.buf < cap) p.buf = Math.min(cap, p.buf + r * dt / 1000); }
    }
  }
  if (S.fx.length) S.fx = S.fx.filter(f => f.until > t);
  if (S.boostUntil && S.boostUntil <= t) { S.boostUntil = 0; toast('Tüm mülklere 2x bitti'); }
  if (!ui.ad) S.playMs += dt;
  S.lastSeen = t;
  if (S.offer && !S.offer.done && S.offer.until <= t) { toast(S.offer.title + ': süre doldu'); S.offer = null; }
  if (!ui.ad && S.playMs >= S.nextTaxi) { S.nextTaxi = S.playMs + (S.offer && S.offer.k === 'taxi' ? rand(18e3, 30e3) : rand(70e3, 130e3)); Street.spawn('taxi'); }
  // boşta: animasyonlar ve sokak hayatı durur (pil)
  const idle = pt - ui.lastInput > CFG.IDLE_MS; if (idle !== ui.idle) ui.idle = idle;
  // bulut: kayıt ve skor seyrek gönderilir
  if (Cloud.ready() && dirty && pt - ui.lastCloudSave > CFG.CLOUD_SAVE_MS) { ui.lastCloudSave = pt; clearDirty(); void Cloud.pushSave(); }
  Cloud.maybePostScore();
  const free = !ui.sheet && !ui.modal && !ui.ad && pt - ui.lastClose > 2500 && S.city;
  if (free && S.collects >= 3 && ui.lastDay !== dayKey(new Date(t))) { ui.lastDay = dayKey(new Date(t)); ensureTasks(); checkDaily(); }
  else if (free && festivalOn(t) && S.fest !== dayKey(new Date(t))) { S.fest = dayKey(new Date(t)); showFestGift(); }
  else if (free && S.playMs >= S.nextEvent) { S.nextEvent = S.playMs + rand(CFG.EVENT_MIN, CFG.EVENT_MAX); if (anyProducing()) showEvent(); }
  else if (free && !S.offer && S.playMs >= S.nextOffer) { S.nextOffer = S.playMs + rand(CFG.OFFER_MIN, CFG.OFFER_MAX); if (anyProducing()) showOffer(); }
  else if (free && S.playMs >= S.nextAd) { S.nextAd = S.playMs + rand(CFG.INTER_MIN, CFG.INTER_MAX); Ads.interstitial(); }
  if (pt - lastGoals > 2000) { lastGoals = pt; checkGoals(); }
  maybeTip(pt);
  if (S.collectMode === 'auto') autoCollect(pt);
  // kumbaralar dolunca TOPLA mührü hafifçe sallanır (dakikada en fazla bir kez)
  else if (S.playMs - ui.lastNudge > 60e3 && pending().fill >= .9) { ui.lastNudge = S.playMs; nudgeCollect(); }
  // kılavuz sekmesini bir kez tanıt (ilk kira toplandıktan sonra)
  if (free && !S.guideHint && S.collects >= 1) {
    S.guideHint = true; persist();
    const h = $('#guideHint'), g = $('#guideBtn'); h.hidden = false; g.classList.add('wig');
    setTimeout(() => { h.hidden = true; g.classList.remove('wig'); }, 6000);
  }
  render();
}

/** İlk açılışta başlangıç ili seçimi. */
export function pickCity(onDone?: () => void) {
  openModal(`<div class="card citycard"><div class="badge">${'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M3 6.5 9 4l6 2.5L21 4v13.5L15 20l-6-2.5L3 20z"/><path d="M9 4v13.5M15 6.5V20"/></svg>'}</div>
    <h3>Hangi ilde başlıyorsun?</h3><p>İlk semtini doldurunca diğer illerde de arsa alabilirsin.</p>
    <div class="citylist">${CITY_ORDER.map(c => `<button class="cityopt" data-a="${c}"><b>${CITIES[c].n}</b><small>${CITIES[c].tagline}</small><span>${CITIES[c].districts.map(d => d.n).join(' · ')}</span></button>`).join('')}</div></div>`,
    a => {
      const c = a as CityId; if (!CITIES[c]) return;
      closeModal();
      const fresh = newState(now(), weekKey(new Date(now())), c);
      Object.assign(S, { city: c, own: fresh.own, cur: fresh.cur, d: fresh.d });
      ui.tileSig = []; ui.linkSig = ''; persist(); render(); Snd.unlock();
      Analytics.log('start_city', { city: c });
      onDone && onDone();
    });
}

export async function resetGame() {
  await clearSave();
  setS(newState(now(), weekKey(new Date(now()))));
  ui.tileSig = []; ui.linkSig = ''; closeSheet(); persist(); render();
  pickCity();
}
export { dkey };
