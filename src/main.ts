/* =========================================================
   TAPU — açılış
   Sıra: yazı tipleri → hata yakalama → uzak ayarlar → kayıt → arayüz → bulut/satın alma/reklam
   ========================================================= */
// Yazı tipleri pakete gömülü (Google Fonts'a istek yok; çevrimdışı çalışır). Türkçe için latin-ext.
import '@fontsource/barlow/latin-400.css';
import '@fontsource/barlow/latin-ext-400.css';
import '@fontsource/barlow/latin-500.css';
import '@fontsource/barlow/latin-ext-500.css';
import '@fontsource/barlow/latin-600.css';
import '@fontsource/barlow/latin-ext-600.css';
import '@fontsource/barlow-condensed/latin-600.css';
import '@fontsource/barlow-condensed/latin-ext-600.css';
import '@fontsource/barlow-condensed/latin-700.css';
import '@fontsource/barlow-condensed/latin-ext-700.css';
import '@fontsource/ibm-plex-mono/latin-500.css';
import '@fontsource/ibm-plex-mono/latin-ext-500.css';
import '@fontsource/ibm-plex-mono/latin-600.css';
import '@fontsource/ibm-plex-mono/latin-ext-600.css';
import './styles.css';

import { App } from '@capacitor/app';
import { TextZoom } from '@capacitor/text-zoom';
import { ScreenOrientation } from '@capacitor/screen-orientation';
import { Capacitor } from '@capacitor/core';
import { CFG } from './config';
import { S, setS, newState, migrate } from './state';
import { weekKey } from './format';
import { now } from './economy';
import { Time, guardRollback } from './time';
import { loadRaw } from './storage';
import { Snd } from './sound';
import { $, ui } from './ui/ctx';
import { onModalClick, justOpened } from './ui/modal';
import { openSheet, closeSheet, onSheetAction } from './ui/sheets';
import { render, fit, setupGrid, drawGuilloche, Street } from './ui/board';
import { ensureTasks } from './game/tasks';
import { catchUp } from './game/events';
import { watchBoost } from './game/actions';
import { persist, persistSync } from './game/persist';
import { tick, pickCity } from './game/loop';
import { Analytics } from './services/analytics';
import { applyRemoteConfig } from './services/remote';
import { Cloud } from './services/cloud';
import { Purchases } from './services/purchases';
import { Ads } from './services/ads';
import { Notify } from './services/notify';

let hiddenAt = 0;

/** Uygulama dışında geçen süreyi güvenli hesaplar (saat geri alındıysa sıfır sayar). */
function awayMs(): number {
  const g = guardRollback(S.maxSeen, Time.now());
  if (g.rolledBack) { S.clockFlag = (S.clockFlag || 0) + 1; Analytics.log('clock_rollback', {}); return 0; }
  return Math.max(0, g.now - S.lastSeen);
}

function onHide() {
  if (hiddenAt) return; hiddenAt = Date.now();
  S.lastSeen = now(); persistSync();
  void Notify.plan(); void Cloud.pushSave(); Cloud.maybePostScore(true);
}
function onShow() {
  if (!hiddenAt) return; hiddenAt = 0;
  catchUp(awayMs()); S.lastSeen = now(); ui.lastInput = performance.now(); render();
  if (Cloud.ready() && !Time.synced) void Cloud.hello();
}

function bindUi() {
  document.addEventListener('pointerdown', () => { Snd.init(); ui.lastInput = performance.now(); }, { capture: true });
  document.addEventListener('keydown', e => { ui.lastInput = performance.now(); if (e.key === 'Escape' && ui.sheet) closeSheet(); });
  $('#boostBtn').addEventListener('click', watchBoost);
  $('#menuBtn').addEventListener('click', () => openSheet({ k: 'menu' }));
  $('#taskBtn').addEventListener('click', () => openSheet({ k: 'tasks' }));
  $('#collBtn').addEventListener('click', () => openSheet({ k: 'coll' }));
  $('#offerPill').addEventListener('click', () => openSheet({ k: 'tasks' }));
  $('#mapBtn').addEventListener('click', () => openSheet({ k: 'map' }));
  $('#scrim').addEventListener('click', () => { if (ui.sheet && !justOpened()) closeSheet(); });
  $('#sheetBody').addEventListener('click', (e: Event) => { const b = (e.target as HTMLElement).closest('[data-a]') as HTMLButtonElement | null; if (b && !b.disabled && !justOpened()) void onSheetAction(b.dataset.a!, b); });
  $('#modal').addEventListener('click', onModalClick);
  if (typeof ResizeObserver !== "undefined") new ResizeObserver(() => fit()).observe($('#board')); else window.addEventListener('resize', fit);
  document.addEventListener('visibilitychange', () => (document.hidden ? onHide() : onShow()));
  window.addEventListener('pagehide', () => { S.lastSeen = now(); persistSync(); });
  if (Capacitor.isNativePlatform()) {
    void App.addListener('pause', onHide);
    void App.addListener('resume', onShow);
    // Android geri tuşu: önce panel/kart kapanır, sonra uygulama arka plana alınır
    void App.addListener('backButton', () => { if (ui.sheet) closeSheet(); else if (!ui.modal && !ui.ad) void App.minimizeApp(); });
  }
}

/** Telefona özgü ayarlar: oyun dikey tasarlandı; sistem yazı boyutu büyütülse de düzen bozulmasın.
 *  (Android WebView sistem yazı ölçeğini sayfaya uyguluyor; oyunun yazıları zaten büyük ve sabit.) */
async function deviceSetup() {
  if (!Capacitor.isNativePlatform()) return;
  await Promise.all([
    ScreenOrientation.lock({ orientation: 'portrait' }).catch(() => { /* tablet/çoklu pencere: kilit desteklenmeyebilir */ }),
    TextZoom.set({ value: 1 }).catch(() => { /* yok */ }),
  ]);
}

async function boot() {
  Analytics.installGlobalHandlers();
  void deviceSetup();
  await applyRemoteConfig();
  const t0 = Date.now();
  const raw = await loadRaw();
  setS((raw ? migrate(raw, t0, weekKey(new Date(t0))) : null) || newState(t0, weekKey(new Date(t0))));

  if (__PREVIEW__) (window as any).__tapuState = () => S; // uçtan uca testler için (yalnızca önizleme paketi)
  setupGrid(); Street.init(); ensureTasks(); drawGuilloche(); bindUi(); fit();
  ui.lastInput = performance.now();
  render();
  setInterval(tick, CFG.TICK_MS);
  setInterval(() => { if (!document.hidden) persist(); }, 10e3);

  // ağ işleri arayüzü bekletmez
  const cloud = Cloud.init();
  if (!S.city) pickCity(() => { void Notify.ask(); });
  else { catchUp(awayMs()); S.lastSeen = now(); }
  await cloud;
  void Purchases.init(Cloud.uid());
  void Ads.init();
  Analytics.log('app_open', { city: S.city || 'none', own: S.own.length });
}

/* Web sürümü (GitHub Pages): çevrimdışı çalışsın ve ana ekrana eklenebilsin diye service worker */
if (!__PREVIEW__ && !Capacitor.isNativePlatform() && 'serviceWorker' in navigator && location.protocol === 'https:') {
  window.addEventListener('load', () => { navigator.serviceWorker.register('./sw.js').catch(() => { /* yok */ }); });
}

void boot().catch(e => { Analytics.error(e, 'boot'); console.error(e); });
