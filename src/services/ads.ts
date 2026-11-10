/* =========================================================
   REKLAMLAR
   Telefonda: Google AdMob
     - Avrupa/İngiltere için onay formu (UMP) açılışta sorulur; "Reklam izinlerini yönet" ayarlardan açılır.
     - iOS'ta takip izni (ATT) penceresi onaydan sonra istenir.
     - Ödüllü reklamlarda sunucu tarafı doğrulama (SSV): userId = Firebase uid, customData = ödül türü.
   Web ve önizlemede: 5 saniyelik simülasyon ekranı.
   Holding / Reklamsız / Kulüp sahiplerine geçiş reklamı gösterilmez; Holding ve Kulüp'te ödüller izlemeden verilir.
   Geçiş reklamı zamanlaması (tasarım M1): süresi dolunca doğal durakta (panel/kart kapanışı, TOPLA, semt değişimi) çıkar;
   ödüllü reklamdan sonra 10 dk kredi, ilk 30 dk oyunda ve açılışın ilk 60 sn'sinde hiç çıkmaz.
   ========================================================= */
import { Capacitor } from '@capacitor/core';
import { AdMob, RewardAdPluginEvents, InterstitialAdPluginEvents, AdmobConsentStatus } from '@capacitor-community/admob';
import { CFG } from '../config';
import { S } from '../state';
import { I, small } from '../icons';
import { $, ui, view } from '../ui/ctx';
import { toast, flushQueue } from '../ui/modal';
/** Reklam hatası bildirimi: okunabilsin diye normal bildirimden uzun (≥3.5 sn). */
export const AD_FAIL_MS = 4000;
import { grantReward } from '../game/actions';
import { persist } from '../game/persist';
import { Analytics } from './analytics';
import { adFree, instantRewards } from './purchases';
import { rand } from '../format';
import { t } from '../i18n';

/** Ödüllü reklam SSV kullanıcı kimliği (Firebase uid). cloud.ts bağlar; ads.ts cloud.ts'i içe aktarmaz (döngü olmasın). */
export const adUser = { uid: (): string | null => null };

let dueAt = 0; // geçiş reklamı zamanı geldiği an (performance.now); 0 = beklemiyor
/** Ödüllü reklam izlendi: kısa süre geçiş reklamı gösterilmez (reklam kredisi). */
function credit() { S.adCredit = S.playMs + CFG.AD_CREDIT_MS; }

const env = import.meta.env;
const isIOS = () => Capacitor.getPlatform() === 'ios';
const testing = () => env.VITE_ADMOB_TESTING !== 'false';
// Google'ın herkese açık test birimleri: kimlik girilmemiş test sürümünde (ör. CI APK'sı) reklam akışı yine çalışır
const TEST_IDS = {
  android: { rewarded: 'ca-app-pub-3940256099942544/5224354917', interstitial: 'ca-app-pub-3940256099942544/1033173712' },
  ios: { rewarded: 'ca-app-pub-3940256099942544/1712485313', interstitial: 'ca-app-pub-3940256099942544/4411468910' },
};
const ids = () => {
  const tid = testing() ? TEST_IDS[isIOS() ? 'ios' : 'android'] : { rewarded: '', interstitial: '' };
  return {
    rewarded: (isIOS() ? env.VITE_ADMOB_REWARDED_IOS : env.VITE_ADMOB_REWARDED_ANDROID) || tid.rewarded,
    interstitial: (isIOS() ? env.VITE_ADMOB_INTERSTITIAL_IOS : env.VITE_ADMOB_INTERSTITIAL_ANDROID) || tid.interstitial,
  };
};

let ready = false, canRequest = false, privacyRequired = false, rewardedLoaded = false, interstitialLoaded = false;
let busy = false; // ödüllü reklam sürüyor (hazırlanıyor ya da oynuyor)

/** Dismissed olayı hiç gelmezse (eklenti/ağ sorunu) oturum kilitli kalmasın: en uzun ödüllü reklamdan uzun bir güvenlik süresi. */
const REWARD_GUARD_MS = 150_000;

export const Ads = {
  native: () => Capacitor.isNativePlatform() && !__PREVIEW__,
  privacyRequired: () => privacyRequired,

  async init() {
    if (!this.native()) return;
    try {
      await AdMob.initialize({ initializeForTesting: testing() } as any);
      let info: any = await AdMob.requestConsentInfo();
      if (info.isConsentFormAvailable && info.status === AdmobConsentStatus.REQUIRED) info = await AdMob.showConsentForm();
      canRequest = info.canRequestAds !== false;
      privacyRequired = String(info.privacyOptionsRequirementStatus || '').toUpperCase() === 'REQUIRED';
      if (isIOS()) {
        const st: any = await AdMob.trackingAuthorizationStatus();
        if (st.status === 'notDetermined') await AdMob.requestTrackingAuthorization();
      }
      ready = true;
      this.preload();
    } catch (e) { Analytics.error(e, 'ads_init'); }
  },
  async preload() {
    if (!ready || !canRequest || instantRewards()) return;
    const id = ids();
    try { if (!rewardedLoaded && id.rewarded) { await AdMob.prepareRewardVideoAd({ adId: id.rewarded, isTesting: testing(), ssv: { userId: adUser.uid() || 'misafir', customData: 'tapu' } } as any); rewardedLoaded = true; } } catch { /* stok yok */ }
    try { if (!adFree() && !interstitialLoaded && id.interstitial) { await AdMob.prepareInterstitial({ adId: id.interstitial, isTesting: testing() }); interstitialLoaded = true; } } catch { /* stok yok */ }
  },
  async showPrivacyOptions() { if (this.native()) try { await AdMob.showPrivacyOptionsForm(); } catch { /* yok */ } },

  /** Ödüllü reklam: izlenirse onReward çalışır. onFail (isteğe bağlı): reklam gösterilemez, hata verir ya da ödül
   *  kazanılmadan kapanırsa çağrılır (ör. yokken kazancın 1 katı kaybolmasın). Aynı anda tek ödüllü reklam. */
  async rewarded(kind: string, label: string, onReward: () => void, onFail?: () => void) {
    if (ui.ad || busy) { onFail?.(); return; }
    Analytics.log('ad_reward_request', { kind });
    if (instantRewards()) { grantReward(onReward); toast(S.club ? t('Kulüp: ödül anında') : t('Holding: ödül anında')); return; }
    if (!this.native()) { showSimulated(true, label, onReward, kind); return; }
    if (!ready || !canRequest) { toast(t('Reklam şu an yüklenemedi'), AD_FAIL_MS); onFail?.(); return; }
    busy = true;
    // Eklenti sözleşmesi (Android/iOS): showRewardVideoAd sözü YALNIZCA ödül kazanılınca çözülür;
    // ödülsüz kapanış (Dismissed) ve gösterilememe (FailedToShow) yalnızca olay yayar. Bu yüzden
    // bitiş Dismissed/FailedToShow olayı, gösterim hatası ya da güvenlik zaman aşımıyla belirlenir;
    // ödül ve kuyruktaki kartlar reklam kapandıktan sonra verilir.
    let got = false;
    const hs: { remove: () => Promise<void> | void }[] = [];
    try {
      if (!rewardedLoaded) { await AdMob.prepareRewardVideoAd({ adId: ids().rewarded, isTesting: testing(), ssv: { userId: adUser.uid() || 'misafir', customData: kind } } as any); }
      rewardedLoaded = false; ui.ad = true;
      let finish!: (err?: unknown) => void;
      const done = new Promise<unknown>(r => { finish = r; });
      hs.push(await AdMob.addListener(RewardAdPluginEvents.Rewarded, () => { got = true; }));
      hs.push(await AdMob.addListener(RewardAdPluginEvents.Dismissed, () => finish()));
      hs.push(await AdMob.addListener(RewardAdPluginEvents.FailedToShow, (e: unknown) => finish(e || new Error('failed to show'))));
      const guard = setTimeout(() => finish(), REWARD_GUARD_MS);
      AdMob.showRewardVideoAd().then(() => { got = true; }, e => finish(e));
      const err = await done; clearTimeout(guard);
      if (err && !got) { toast(t('Reklam şu an yüklenemedi'), AD_FAIL_MS); Analytics.error(err, 'ad_rewarded'); }
    } catch (e) { if (!got) toast(t('Reklam şu an yüklenemedi'), AD_FAIL_MS); Analytics.error(e, 'ad_rewarded'); }
    finally { for (const h of hs) { try { void Promise.resolve(h.remove()).catch(() => { /* yok */ }); } catch { /* yok */ } } ui.ad = false; busy = false; }
    if (got) { credit(); grantReward(onReward); Analytics.log('ad_reward', { kind }); S.ads++; }
    else onFail?.();
    flushQueue(); this.preload();
  },
  /** Geçiş reklamı (15-20 dk'da bir). */
  /** Oyun döngüsünden çağrılır (kart sırası boşsa): zamanı gelen geçiş reklamını doğal durakta gösterir. */
  tickInterstitial(pt: number, free: boolean) {
    if (adFree() || S.playMs < S.nextAd) { dueAt = 0; return; }
    const gate = Math.max(CFG.FIRST_FREE_MS, S.adCredit || 0);
    if (S.playMs < gate) { S.nextAd = gate; dueAt = 0; return; }           // ilk oturum ya da reklam kredisi
    if (pt - ui.bootAt < CFG.BOOT_QUIET_MS) return;                          // açılışta asla
    if (!dueAt) dueAt = pt;
    if (!free) return;                                                       // panel/kart açık: beklemede
    const atBreak = pt - ui.breakAt < 6000 && pt - ui.lastInput > 800;       // doğal durak, oyuncu boşta
    const waited = pt - dueAt > CFG.BREAK_WAIT_MS && pt - ui.lastInput > 2000;
    if (!atBreak && !waited) return;
    dueAt = 0; S.nextAd = S.playMs + rand(CFG.INTER_MIN, CFG.INTER_MAX); void this.interstitial();
  },
  async interstitial() {
    if (adFree()) return;
    Analytics.log('ad_interstitial', {});
    if (!this.native()) { showSimulated(false, '', null, 'interstitial'); return; }
    if (!ready || !canRequest || !interstitialLoaded) { this.preload(); return; }
    // showInterstitial sözü reklam ekrana gelir gelmez çözülür; kartlar reklamın arkasında açılmasın diye kapanış olayı beklenir.
    const hs: { remove: () => Promise<void> | void }[] = [];
    try {
      interstitialLoaded = false; ui.ad = true;
      let finish!: () => void; const done = new Promise<void>(r => { finish = r; });
      hs.push(await AdMob.addListener(InterstitialAdPluginEvents.Dismissed, () => finish()));
      hs.push(await AdMob.addListener(InterstitialAdPluginEvents.FailedToShow, () => finish()));
      const guard = setTimeout(() => finish(), REWARD_GUARD_MS);
      AdMob.showInterstitial().catch(() => finish());
      await done; clearTimeout(guard);
    } catch { /* yok */ }
    finally { for (const h of hs) { try { void Promise.resolve(h.remove()).catch(() => { /* yok */ }); } catch { /* yok */ } } ui.ad = false; ui.lastClose = performance.now(); flushQueue(); this.preload(); }
  },
};

/* ---------- web/önizleme simülasyonu ---------- */
function showSimulated(rewarded: boolean, label: string, onReward: (() => void) | null, kind: string) {
  ui.ad = true; const el = $('#ad'); let left = CFG.AD_SECONDS, done = false;
  el.innerHTML = `<div class="ad-top"><span>${t('Reklam')}</span><button class="ad-x" id="adX" disabled>${left}</button></div>
    <div class="ad-body"><div class="ad-box">${t('Reklam alanı')}<br>${t('(uygulamada AdMob reklamı oynar)')}</div>
    ${rewarded ? `<div class="ad-rw">${small(I.spark, 16)} ${label}</div>` : `<button class="ad-prem" id="adPrem">${t('Reklamları kaldır')}</button>`}</div>`;
  el.hidden = false;
  const x = $('#adX');
  const iv = setInterval(() => { left--; if (left > 0) x.textContent = left; else { clearInterval(iv); done = true; x.disabled = false; x.textContent = rewarded ? t('Ödülü al') : t('Kapat'); } }, 1000);
  x.onclick = () => {
    if (!done) return;
    el.hidden = true; el.innerHTML = ''; ui.ad = false; ui.lastClose = performance.now(); S.ads++;
    if (rewarded) { credit(); grantReward(onReward || undefined); Analytics.log('ad_reward', { kind }); } else { persist(); view.render(); }
    flushQueue();
  };
  const pr = $('#adPrem'); if (pr) pr.onclick = () => { if (!done) return toast(t('Reklam bitince açılır')); x.onclick(); view.openSheet({ k: 'store' }); };
}
