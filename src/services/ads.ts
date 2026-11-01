/* =========================================================
   REKLAMLAR
   Telefonda: Google AdMob
     - Avrupa/İngiltere için onay formu (UMP) açılışta sorulur; "Reklam izinlerini yönet" ayarlardan açılır.
     - iOS'ta takip izni (ATT) penceresi onaydan sonra istenir.
     - Ödüllü reklamlarda sunucu tarafı doğrulama (SSV): userId = Firebase uid, customData = ödül türü.
   Web ve önizlemede: 5 saniyelik simülasyon ekranı.
   Premium oyuncuya geçiş reklamı gösterilmez, ödüller izlemeden verilir.
   ========================================================= */
import { Capacitor } from '@capacitor/core';
import { AdMob, RewardAdPluginEvents, AdmobConsentStatus } from '@capacitor-community/admob';
import { CFG } from '../config';
import { S } from '../state';
import { I, small } from '../icons';
import { $, ui } from '../ui/ctx';
import { toast, flushQueue } from '../ui/modal';
import { openSheet } from '../ui/sheets';
import { render } from '../ui/board';
import { grantReward } from '../game/actions';
import { persist } from '../game/persist';
import { Analytics } from './analytics';
import { Cloud } from './cloud';

const env = import.meta.env;
const isIOS = () => Capacitor.getPlatform() === 'ios';
const ids = () => ({
  rewarded: (isIOS() ? env.VITE_ADMOB_REWARDED_IOS : env.VITE_ADMOB_REWARDED_ANDROID) || '',
  interstitial: (isIOS() ? env.VITE_ADMOB_INTERSTITIAL_IOS : env.VITE_ADMOB_INTERSTITIAL_ANDROID) || '',
});
const testing = () => env.VITE_ADMOB_TESTING !== 'false';

let ready = false, canRequest = false, privacyRequired = false, rewardedLoaded = false, interstitialLoaded = false;

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
    if (!ready || !canRequest || S.premium) return;
    const id = ids();
    try { if (!rewardedLoaded && id.rewarded) { await AdMob.prepareRewardVideoAd({ adId: id.rewarded, isTesting: testing(), ssv: { userId: Cloud.uid() || 'misafir', customData: 'tapu' } } as any); rewardedLoaded = true; } } catch { /* stok yok */ }
    try { if (!interstitialLoaded && id.interstitial) { await AdMob.prepareInterstitial({ adId: id.interstitial, isTesting: testing() }); interstitialLoaded = true; } } catch { /* stok yok */ }
  },
  async showPrivacyOptions() { if (this.native()) try { await AdMob.showPrivacyOptionsForm(); } catch { /* yok */ } },

  /** Ödüllü reklam: izlenirse onReward çalışır. */
  async rewarded(kind: string, label: string, onReward: () => void) {
    Analytics.log('ad_reward_request', { kind });
    if (S.premium) { grantReward(onReward); toast('Premium: ödül anında'); return; }
    if (!this.native()) { showSimulated(true, label, onReward, kind); return; }
    if (!ready || !canRequest) { toast('Reklam şu an yüklenemedi'); return; }
    try {
      if (!rewardedLoaded) { await AdMob.prepareRewardVideoAd({ adId: ids().rewarded, isTesting: testing(), ssv: { userId: Cloud.uid() || 'misafir', customData: kind } } as any); }
      rewardedLoaded = false; ui.ad = true;
      let got = false;
      const h = await AdMob.addListener(RewardAdPluginEvents.Rewarded, () => { got = true; });
      await AdMob.showRewardVideoAd();
      h.remove(); ui.ad = false;
      if (got) { grantReward(onReward); Analytics.log('ad_reward', { kind }); S.ads++; }
      flushQueue(); this.preload();
    } catch (e) { ui.ad = false; toast('Reklam şu an yüklenemedi'); Analytics.error(e, 'ad_rewarded'); this.preload(); }
  },
  /** Geçiş reklamı (15-20 dk'da bir). */
  async interstitial() {
    if (S.premium) return;
    Analytics.log('ad_interstitial', {});
    if (!this.native()) { showSimulated(false, '', null, 'interstitial'); return; }
    if (!ready || !canRequest || !interstitialLoaded) { this.preload(); return; }
    try { interstitialLoaded = false; ui.ad = true; await AdMob.showInterstitial(); } catch { /* yok */ } finally { ui.ad = false; ui.lastClose = performance.now(); flushQueue(); this.preload(); }
  },
};

/* ---------- web/önizleme simülasyonu ---------- */
function showSimulated(rewarded: boolean, label: string, onReward: (() => void) | null, kind: string) {
  ui.ad = true; const el = $('#ad'); let left = CFG.AD_SECONDS, done = false;
  el.innerHTML = `<div class="ad-top"><span>Reklam</span><button class="ad-x" id="adX" disabled>${left}</button></div>
    <div class="ad-body"><div class="ad-box">Reklam alanı<br>(uygulamada AdMob reklamı oynar)</div>
    ${rewarded ? `<div class="ad-rw">${small(I.spark, 16)} ${label}</div>` : '<button class="ad-prem" id="adPrem">Reklamları kaldır</button>'}</div>`;
  el.hidden = false;
  const x = $('#adX');
  const iv = setInterval(() => { left--; if (left > 0) x.textContent = left; else { clearInterval(iv); done = true; x.disabled = false; x.textContent = rewarded ? 'Ödülü al' : 'Kapat'; } }, 1000);
  x.onclick = () => {
    if (!done) return;
    el.hidden = true; el.innerHTML = ''; ui.ad = false; ui.lastClose = performance.now(); S.ads++;
    if (rewarded) { grantReward(onReward || undefined); Analytics.log('ad_reward', { kind }); } else { persist(); render(); }
    flushQueue();
  };
  const pr = $('#adPrem'); if (pr) pr.onclick = () => { if (!done) return toast('Reklam bitince açılır'); x.onclick(); openSheet({ k: 'store' }); };
}
