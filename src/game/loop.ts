/* OYUN DÖNGÜSÜ (4 Hz), başlangıç ili seçimi, boşta duraklatma, yeni oyun */
import { CFG, N, CITIES, CITY_ORDER, CityId, dkey, TYPES, REGIONS, REGION_ORDER, RegionId, setRegion, currency } from '../config';
import { t, nm, LANGS, setLang, LANG } from '../i18n';
import { P, savePrefs } from '../prefs';
import { S, setS, newState, lotsOf } from '../state';
import { rand, dayKey, weekKey } from '../format';
import { now, producing, rate, pending, curWeek } from '../economy';
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
import { checkAch, showMarket, maybeCivic } from './fun';
import { payLien, showDistrictCard } from './district';
import { maybeTip } from './rifki';
import { maybeStarter, clubTick } from './monetize';

let lastT = performance.now(), lastGoals = 0;
const anyProducing = () => S.own.some(k => lotsOf(S, k).some(producing));

export function tick() {
  const pt = performance.now(), dt = Math.min(pt - lastT, 1000); lastT = pt;
  if (document.hidden) return;
  const tn = now();
  S.maxSeen = Math.max(S.maxSeen, tn);
  for (const k of S.own) {
    const lots = lotsOf(S, k);
    for (let i = 0; i < N; i++) {
      const p = lots[i]; if (!p) continue;
      if (p.until && tn >= p.until) {
        p.until = 0; if (p.up) { p.lvl++; p.up = false; } else p.lvl = 1;
        if (k === S.cur) ui.teslim[i] = { at: pt + 1600, txt: t('{type} · kat {lvl}', { type: t(TYPES[p.t].n), lvl: p.lvl }) }; // tapu teslim mührü
        if (k === S.cur && ui.tiles[i]) { const el = ui.tiles[i]; ui.tileSig[i] = ''; el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop'); }
        Snd.done(); buzz(12); ui.sheetSig = '';
      }
      if (producing(p)) {
        const r = rate(k, i, tn), cap = r * CFG.CAP_SEC; let g = r * dt / 1000;
        if (k !== S.cur) S.dEarn[k] = (S.dEarn[k] || 0) + g; // semt özeti
        if (S.lien[k]) { const share = g * CFG.KAPORA_SHARE; payLien(k, share); g -= share; } // kapora borcu kiradan ödenir
        if (p.buf < cap) p.buf = Math.min(cap, p.buf + g);
      }
    }
  }
  if (S.fx.length) S.fx = S.fx.filter(f => f.until > tn);
  if (S.boostUntil && S.boostUntil <= tn) { S.boostUntil = 0; toast(t('Tüm mülklere 2x bitti')); }
  if (!ui.ad) S.playMs += dt;
  S.lastSeen = tn;
  if (S.offer && !S.offer.done && S.offer.until <= tn) { toast(t('{title}: süre doldu', { title: t(S.offer.title) })); S.offer = null; }
  if (!ui.ad && S.playMs >= S.nextTaxi) { S.nextTaxi = S.playMs + (S.offer && S.offer.k === 'taxi' ? rand(18e3, 30e3) : rand(70e3, 130e3)); Street.spawn('taxi'); }
  // boşta: animasyonlar ve sokak hayatı durur (pil)
  const idle = pt - ui.lastInput > CFG.IDLE_MS; if (idle !== ui.idle) ui.idle = idle;
  // bulut: kayıt ve skor seyrek gönderilir
  if (Cloud.ready() && dirty && pt - ui.lastCloudSave > CFG.CLOUD_SAVE_MS) { ui.lastCloudSave = pt; clearDirty(); void Cloud.pushSave(); }
  Cloud.maybePostScore();
  const free = !ui.sheet && !ui.modal && !ui.ad && pt - ui.lastClose > 2500 && S.city;
  if (free && S.collects >= 3 && ui.lastDay !== dayKey(new Date(tn))) { ui.lastDay = dayKey(new Date(tn)); ensureTasks(); checkDaily(); }
  else if (free && S.collects >= 3 && S.market !== curWeek()) showMarket();
  else if (free && maybeCivic()) { /* belediye kartı açıldı */ }
  else if (free && maybeStarter()) { /* başlangıç paketi: ilk tapu duvarında bir kez */ }
  else if (free && S.playMs >= S.nextEvent) { S.nextEvent = S.playMs + rand(CFG.EVENT_MIN, CFG.EVENT_MAX); if (anyProducing()) showEvent(); }
  else if (free && !S.offer && S.playMs >= S.nextOffer) { S.nextOffer = S.playMs + rand(CFG.OFFER_MIN, CFG.OFFER_MAX); if (anyProducing()) showOffer(); }
  else Ads.tickInterstitial(pt, !!free); // geçiş reklamı: zamanı gelince doğal durakta
  if (pt - lastGoals > 2000) { lastGoals = pt; checkGoals(); checkAch(); clubTick(); }
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

const MAP_IC = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M3 6.5 9 4l6 2.5L21 4v13.5L15 20l-6-2.5L3 20z"/><path d="M9 4v13.5M15 6.5V20"/></svg>';
const GLOBE_IC = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/></svg>';
const opt = (a: string, b: string, sm: string, sp = '', on = false, gold = false) => `<button class="cityopt${on ? ' on' : ''}${gold ? ' gl' : ''}" data-a="${a}"><b>${b}</b><small>${sm}</small>${sp ? `<span>${sp}</span>` : ''}</button>`;

/** İlk açılış: dil seçimi (tasarım Y1). Cihaz dili seçili gelir. */
export function pickLang(onDone: () => void) {
  openModal(`<div class="card citycard"><div class="badge">${GLOBE_IC}</div><h3>Dil · Language · Sprache</h3><p>${t('Cihaz dilin seçili geldi. İstediğin zaman Ayarlar’dan değiştirebilirsin.')}</p>
    <div class="citylist">${LANGS.map(l => opt(l.id, l.n, l.sub, '', l.id === LANG)).join('')}</div></div>`,
    a => { if (!LANGS.some(l => l.id === a)) return; closeModal(); setLang(a); P.lang = LANG; savePrefs(); onDone(); });
}
/** Bölge seçimi (tasarım Y2): 5 ülke + Global; her bölgenin ilerlemesi ayrı. */
export function pickRegion(onDone: (r: RegionId) => void, intro = true) {
  openModal(`<div class="card citycard regcard"><h3>${t('Nerede yatırım yapıyorsun?')}</h3>${intro ? `<p>${t('Her bölgenin kendi şehirleri ve kendi ilerlemesi var. Başka bir bölgeyi sonra da açabilirsin.')}</p>` : ''}
    <div class="citylist">${REGION_ORDER.map(r => { const R = REGIONS[r]; return opt(r, `${t(R.n)} · ${R.cur}`, r === 'gl' ? t('Her ülkenin en pahalı şehri') : t(R.tagline), R.cities.map(c => nm(CITIES[c].n)).join(' · '), false, r === 'gl'); }).join('')}</div></div>`,
    a => { if (!REGIONS[a as RegionId]) return; closeModal(); onDone(a as RegionId); });
}
/** İlk açılışta başlangıç şehri seçimi (etkin bölgenin şehirleri). */
export function pickCity(onDone?: () => void) {
  openModal(`<div class="card citycard"><div class="badge">${MAP_IC}</div>
    <h3>${t('Hangi şehirde başlıyorsun?')}</h3><p>${t('İlk semtini doldurunca diğer şehirlerde de arsa alabilirsin.')}</p>
    <div class="citylist">${CITY_ORDER.map(c => opt(c, nm(CITIES[c].n), t(CITIES[c].tagline), CITIES[c].districts.map(d => nm(d.n)).join(' · '))).join('')}</div></div>`,
    a => {
      const c = a as CityId; if (!CITIES[c] || !CITY_ORDER.includes(c)) return;
      closeModal();
      const fresh = newState(now(), weekKey(new Date(now())), c);
      Object.assign(S, { city: c, own: fresh.own, cur: fresh.cur, d: fresh.d });
      ui.tileSig = []; ui.linkSig = ''; persist(); render(); Snd.unlock();
      Analytics.log('start_city', { city: c });
      showDistrictCard(fresh.cur, onDone); // şehir kartpostalı + başlangıç semtinin kuralı
    });
}
/** Etkin bölgeyi uygular (para simgesi CSS'e de yazılır). */
export function applyRegion(r: RegionId) {
  setRegion(r);
  document.documentElement.style.setProperty('--cur', JSON.stringify(currency()));
}
/** İlk açılış akışı: dil → bölge → şehir. */
export function firstRun(onDone?: () => void, onLang?: () => void) {
  pickLang(() => { if (onLang) onLang(); pickRegion(r => {
    P.region = r; savePrefs(); applyRegion(r);
    const ent = { premium: S.premium, noAds: S.noAds, club: S.club };
    setS(Object.assign(newState(now(), weekKey(new Date(now()))), ent));
    ui.tileSig = []; ui.linkSig = ''; render();
    Analytics.log('start_region', { region: r, lang: LANG });
    pickCity(onDone);
  }); });
}
/** Ayarlar'dan bölge değiştirme: kayıt yazılır, diğer bölgenin kaydı açılır (yoksa şehir seçimi). */
export function switchRegion(r: RegionId) {
  if (r === P.region) return;
  persist(); P.region = r; savePrefs(); Analytics.log('switch_region', { region: r });
  setTimeout(() => location.reload(), 150);
}
/** Ayarlar'dan dil değiştirme: tüm metinler yeniden çizilsin diye sayfa yenilenir. */
export function switchLang(l: string) {
  if (l === LANG) return;
  persist(); setLang(l); P.lang = LANG; savePrefs();
  setTimeout(() => location.reload(), 150);
}

export async function resetGame() {
  await clearSave();
  setS(newState(now(), weekKey(new Date(now()))));
  ui.tileSig = []; ui.linkSig = ''; closeSheet(); persist(); render();
  pickCity();
}
export { dkey };
