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
import { now, totalRate } from './economy';
import { Time, guardRollback } from './time';
import { loadRaw } from './storage';
import { Snd } from './sound';
import { $, ui, hist, syncHistory, histSettled } from './ui/ctx';
import { onModalClick, justOpened, modalBack, bigStamp } from './ui/modal';
import { openSheet, closeSheet, sheetBack, onSheetAction } from './ui/sheets';
import { bindSheetDrag } from './ui/sheetdrag';
import { render, fit, setupGrid, drawGuilloche } from './ui/board';
import { Street } from './ui/street';
import { ensureTasks } from './game/tasks';
import { catchUp } from './game/events';
import { collectAll, switchDistrict } from './game/actions';
import { toast } from './ui/modal';
import { persist, persistSync } from './game/persist';
import { tick, resumeTick, pickCity, firstRun, applyRegion, showRegionNews } from './game/loop';
import { P, loadPrefs, savePrefs } from './prefs';
import { applyTheme } from './theme';
import { anySave, loadRegionInfo } from './storage';
import { setLang, deviceLang, t } from './i18n';
import { REGIONS, RegionId } from './config';
import { Analytics } from './services/analytics';
import { applyRemoteConfig } from './services/remote';
import { Cloud } from './services/cloud';
import { Purchases } from './services/purchases';
import { Ads } from './services/ads';
import { Notify } from './services/notify';
import { showLeagueResult } from './game/league';
import { onTipClick, showTip } from './game/rifki';
import { showSummary } from './game/district';

let hiddenAt = 0;

/** Uygulama dışında geçen süreyi güvenli hesaplar (saat geri alındıysa sıfır sayar). */
function awayMs(): number {
  const g = guardRollback(S.maxSeen, Time.now());
  if (g.rolledBack) { S.clockFlag = (S.clockFlag || 0) + 1; Analytics.log('clock_rollback', {}); return 0; }
  return Math.max(0, g.now - S.lastSeen);
}

/* Oyun döngüsü (4 Hz) ve periyodik kayıt (10 sn). Arka planda durur, öne gelince yeniden başlar. */
let looping = false, tickIv: ReturnType<typeof setInterval> | 0 = 0, saveIv: ReturnType<typeof setInterval> | 0 = 0;
function startLoops() {
  if (!looping || tickIv) return;
  tickIv = setInterval(tick, CFG.TICK_MS);
  saveIv = setInterval(() => { if (!document.hidden) persist(); }, 10e3);
}
function stopLoops() { clearInterval(tickIv); clearInterval(saveIv); tickIv = saveIv = 0; }

/** Arka plana geçiş: kayıt, hatırlatma planı, bulut; döngüler, sokak hayatı ve ses bağlamı durur (pil). */
function onHide() {
  if (hiddenAt) return; hiddenAt = Date.now();
  S.lastSeen = now(); persistSync();
  void Notify.plan(); void Cloud.pushSave(); Cloud.maybePostScore(true);
  stopLoops(); Street.stop(); Snd.suspend();
}
function onShow() {
  if (!hiddenAt) return; hiddenAt = 0;
  catchUp(awayMs()); S.lastSeen = now(); ui.lastInput = performance.now(); render();
  resumeTick(); startLoops(); Street.start(); Snd.resume();
  void Notify.cancel(); // oyuna dönüldü: planlı hatırlatmalar artık gereksiz
  if (Cloud.ready() && !Time.synced) void Cloud.hello();
}

/** Geri: (1) reklam ekranı açıksa hiçbir şey; (2) kart açıksa kapatılabilir karttır ise kapat (zorunlu kartlar kalır);
 *  (3) panel açıksa iç içe panelde bir öncekine dön, değilse kapat. Bir şey tükettiyse true; yoksa false (uygulama arka plana). */
function handleBack(): boolean {
  if (ui.ad) return true;
  if (ui.modal) { modalBack(); return true; }
  if (ui.sheet) { sheetBack(); return true; }
  return false;
}

function bindUi() {
  document.addEventListener('pointerdown', () => { Snd.init(); ui.lastInput = performance.now(); }, { capture: true });
  // başarısız işlemde sallanacak öğe: son basılan düğme (motion.ts deny)
  document.addEventListener('click', e => { const b = (e.target as Element | null)?.closest?.('button,[role="button"]') as HTMLElement | null; if (b) { ui.lastPress = b; ui.lastPressAt = performance.now(); } }, { capture: true });
  // Esc (masaüstü): kartı kapatılabiliyorsa kapatır; paneli iç içe olsa da tümden kapatır (geri tuşu/tarayıcı geri bir önceki panele döner)
  document.addEventListener('keydown', e => { ui.lastInput = performance.now(); if (e.key !== 'Escape') return; if (ui.modal) modalBack(); else if (ui.sheet) closeSheet(); });
  $('#collectBtn').addEventListener('click', () => {
    if (S.collectMode === 'auto') toast(t('Kiralar otomatik toplanıyor · Ayarlar’dan değiştirebilirsin'));
    else collectAll($('#collectBtn .core'));
  });
  $('#menuBtn').addEventListener('click', () => openSheet({ k: 'menu' }));
  $('#taskBtn').addEventListener('click', () => openSheet({ k: 'tasks' }));
  $('#collBtn').addEventListener('click', () => openSheet({ k: 'coll' }));
  $('#offerPill').addEventListener('click', () => openSheet({ k: 'tasks' }));
  $('#mapBtn').addEventListener('click', () => openSheet({ k: 'map' }));
  $('#rifki').addEventListener('click', onTipClick);
  $('#distBar').addEventListener('click', () => openSheet({ k: 'map' }));
  $('#guideBtn').addEventListener('click', () => { $('#guideHint').hidden = true; $('#guideBtn').classList.remove('wig'); openSheet({ k: 'guide' }); });
  $('#scrim').addEventListener('click', () => { if (ui.sheet && !justOpened()) closeSheet(); });
  // panel başlığı: X ve aşağı (yatayda sağa) sürükleyerek kapatma; ikisi de closeSheet (geçmiş/odak aynı yoldan)
  $('#sheetX').addEventListener('click', () => { if (ui.sheet && !justOpened()) closeSheet(); });
  bindSheetDrag($('#sheet'), $('#sheetBar'), $('#scrim'), closeSheet);
  $('#sheetBody').addEventListener('click', (e: Event) => { const b = (e.target as HTMLElement).closest('[data-a]') as HTMLButtonElement | null; if (b && !b.disabled && !justOpened()) void onSheetAction(b.dataset.a!, b); });
  $('#modal').addEventListener('click', onModalClick);
  if (typeof ResizeObserver !== "undefined") new ResizeObserver(() => fit()).observe($('#board')); else window.addEventListener('resize', fit);
  document.addEventListener('visibilitychange', () => (document.hidden ? onHide() : onShow()));
  window.addEventListener('pagehide', () => { S.lastSeen = now(); persistSync(); });
  if (Capacitor.isNativePlatform()) {
    void App.addListener('pause', onHide);
    void App.addListener('resume', onShow);
    // Android geri tuşu: kart → panel (iç içe ise bir önceki) → uygulama arka plana
    void App.addListener('backButton', () => { if (!handleBack()) void App.minimizeApp(); });
  } else {
    // web: panel/kart açılınca geçmişe bir kayıt eklenir; tarayıcı geri düğmesi aynı geri mantığını çalıştırır
    hist.enabled = true;
    window.addEventListener('popstate', () => {
      if (hist.ignore > 0) { histSettled(); syncHistory(); return; } // arayüzden kapatınca bizim yaptığımız history.back()
      handleBack(); syncHistory(); // hâlâ açıksa (iç içe panel, zorunlu kart) kayıt yeniden eklenir
    });
  }
}

/** Telefona özgü ayarlar: oyun dikey tasarlandı.
 *  Sistem yazı boyutu: WebView'in kendi metin yakınlaştırması (her px yazıyı ölçekler, tahta/alt çubuk taşar) kapalı tutulur;
 *  bunun yerine sistemin tercih ettiği ölçek kök yazı boyutuna (rem) uygulanır. Metinler rem tabanlıdır, arsa içi etiketler
 *  karo genişliğine bağlıdır. Düzen denendi: 390×844'te 1.3, 320×568'de 1.2 kata kadar bozulmuyor; bu yüzden üst sınır
 *  uzun ekranda 1.3, kısa ekranda (<700px) 1.15. */
export const TEXT_SCALE_MAX = 1.3;
async function deviceSetup() {
  if (!Capacitor.isNativePlatform()) return;
  await Promise.all([
    ScreenOrientation.lock({ orientation: 'portrait' }).catch(() => { /* tablet/çoklu pencere: kilit desteklenmeyebilir */ }),
    (async () => {
      try {
        const pref = (await TextZoom.getPreferred()).value;
        await TextZoom.set({ value: 1 });
        const k = Math.min(window.innerHeight >= 700 ? TEXT_SCALE_MAX : 1.15, Math.max(1, +pref || 1)); // kısa ekranda tahta alt çubuğa taşmasın
        if (k > 1.01) document.documentElement.style.fontSize = (16 * k).toFixed(1) + 'px';
      } catch { /* yok */ }
    })(),
  ]);
}

/** index.html'deki sabit metinler (Türkçe varsayılan) seçili dile çevrilir. */
function localizeStatic() {
  document.title = t('Tapu');
  const aria: [string, string][] = [
    ['#distBar', t('Semt ilerlemesi')], ['#guideBtn', t('Kılavuz: oyunun kuralları')], ['#menuBtn', t('Menü')],
    ['#taskBtn', t('Görevler')], ['#collectBtn', t('Tüm kiraları topla')], ['#mapBtn', t('Semtler')], ['#collBtn', t('Koleksiyon')], ['#sheetX', t('Kapat')],
  ];
  for (const [sel, txt] of aria) document.querySelector(sel)?.setAttribute('aria-label', txt);
  document.querySelector('.stamp')?.setAttribute('aria-label', t('Tapu'));
  const txt: [string, string][] = [['#guideBtn .l', t('KILAVUZ')], ['#guideHint', t('Kurallar burada')], ['#cmain', t('TOPLA')], ['.stamp text:nth-of-type(2)', t('ADA · PARSEL')]];
  for (const [sel, v] of txt) { const el = document.querySelector(sel); if (el) el.textContent = v; }
}

let uiReady = false;
/** Açılış arayüz kurulmadan düşerse beyaz ekran yerine basit bir hata ekranı ve "Yeniden başlat". */
function showBootFail() {
  try { if (!P.lang) setLang(deviceLang()); } catch { /* Türkçe kalır */ }
  const d = document.createElement('div'); d.className = 'bootfail'; d.setAttribute('role', 'alertdialog'); d.setAttribute('aria-modal', 'true'); d.setAttribute('aria-labelledby', 'bootFailT');
  d.innerHTML = `<div class="card"><h3 id="bootFailT">${t('Bir sorun oluştu')}</h3><p>${t('Oyun açılırken beklenmedik bir hata oldu. Yeniden başlatmayı dene.')}</p><div class="btns"><button class="btn" type="button">${t('Yeniden başlat')}</button></div></div>`;
  document.body.appendChild(d);
  const b = d.querySelector('button')!; b.addEventListener('click', () => location.reload()); b.focus();
}

async function boot() {
  Analytics.installGlobalHandlers();
  void deviceSetup();
  await applyRemoteConfig();
  // dil ve bölge: mevcut oyuncu (kaydı var, tercihi yok) Türkçe/Türkiye ile devam eder
  await loadPrefs();
  applyTheme(P.theme);
  let migrated = false;
  if (!P.region && await anySave()) { P.region = 'tr'; P.lang = P.lang || 'tr'; savePrefs(); migrated = true; }
  const first = !P.region;
  setLang(P.lang || deviceLang());
  localizeStatic();
  applyRegion((REGIONS[P.region as RegionId] ? P.region : 'tr') as RegionId);
  const t0 = Date.now();
  const raw = await loadRaw();
  setS((raw ? migrate(raw, t0, weekKey(new Date(t0))) : null) || newState(t0, weekKey(new Date(t0))));
  // satın alınan paketler tüm bölgelerde geçerli
  S.premium = S.premium || P.ent.premium; S.noAds = S.noAds || P.ent.noAds; S.club = S.club || P.ent.club;

  if (__PREVIEW__) { (window as any).__tapuState = () => S; (window as any).__tapuTest = { showLeagueResult, totalRate: () => totalRate(true), showTip, toast, showSummary, bigStamp, switchDistrict }; } // uçtan uca testler için (yalnızca önizleme paketi)
  setupGrid(); Street.init(); ensureTasks(); drawGuilloche(); bindUi(); fit();
  ui.lastInput = performance.now();
  render();
  looping = true; startLoops();
  uiReady = true; // bundan sonraki hatalar (bulut, mağaza, reklam) oyunu durdurmaz; yalnızca kaydedilir

  // ağ işleri arayüzü bekletmez
  const cloud = Cloud.init();
  if (first) firstRun(() => { void Notify.ask(); }, localizeStatic); // dil ilk açılışta seçilir
  else if (!S.city) pickCity(() => { void Notify.ask(); });
  else if (!P.news && (migrated || P.region === 'tr')) setTimeout(() => { if (!ui.modal) showRegionNews(); }, 1200); // mevcut oyuncuya bir kez
  else { catchUp(awayMs()); S.lastSeen = now(); }
  void loadRegionInfo();
  await cloud;
  void Purchases.init(Cloud.uid());
  void Ads.init();
  Analytics.log('app_open', { city: S.city || 'none', own: S.own.length });
}

/* Web sürümü (GitHub Pages): çevrimdışı çalışsın ve ana ekrana eklenebilsin diye service worker */
if (!__PREVIEW__ && !Capacitor.isNativePlatform() && 'serviceWorker' in navigator && location.protocol === 'https:') {
  window.addEventListener('load', () => { navigator.serviceWorker.register('./sw.js').catch(() => { /* yok */ }); });
}

void boot().catch(e => { Analytics.error(e, 'boot'); console.error(e); if (!uiReady) showBootFail(); });
