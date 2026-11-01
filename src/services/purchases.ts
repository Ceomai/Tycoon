/* =========================================================
   SATIN ALMA — RevenueCat (makbuz doğrulaması RevenueCat sunucularında yapılır)
   Ürün: "premium" yetkisi (entitlement) → tek seferlik "tapu_premium" ürünü.
   Uygulama yerel bayrağa değil, RevenueCat'in verdiği yetkiye güvenir; bayrak yalnızca önbellek.
   Web/önizlemede test satın alma kartı gösterilir.
   ========================================================= */
import { Capacitor } from '@capacitor/core';
import { Purchases as RC } from '@revenuecat/purchases-capacitor';
import { S } from '../state';
import { I } from '../icons';
import { ui } from '../ui/ctx';
import { openModal, closeModal, toast } from '../ui/modal';
import { Snd } from '../sound';
import { persist } from '../game/persist';
import { Analytics } from './analytics';

const ENTITLEMENT = 'premium';
let configured = false, priceStr = '₺149,99', pkg: any = null, seasonPriceStr = '₺99,99', seasonPkg: any = null;
const native = () => Capacitor.isNativePlatform() && !__PREVIEW__;
const apiKey = () => (Capacitor.getPlatform() === 'ios' ? import.meta.env.VITE_REVENUECAT_IOS : import.meta.env.VITE_REVENUECAT_ANDROID) || '';

function apply(info: any) {
  const active = !!(info && info.entitlements && info.entitlements.active && info.entitlements.active[ENTITLEMENT]);
  if (active !== S.premium) { S.premium = active; ui.rateHtml = ''; ui.sheetSig = ''; persist(); }
}
function unlocked() { S.premium = true; ui.rateHtml = ''; ui.sheetSig = ''; persist(); Snd.unlock(); toast('Reklamsız paket aktif'); Analytics.log('iap_purchase', { product: 'premium' }); }

export const Purchases = {
  price: () => priceStr,
  async init(uid: string | null) {
    if (!native() || !apiKey()) return;
    try {
      await RC.configure({ apiKey: apiKey(), appUserID: uid || undefined } as any);
      configured = true;
      const { customerInfo } = await RC.getCustomerInfo() as any; apply(customerInfo);
      const off: any = await RC.getOfferings();
      pkg = off?.current?.availablePackages?.[0] || null;
      if (pkg?.product?.priceString) priceStr = pkg.product.priceString;
      const all: any[] = Object.values(off?.all || {}).flatMap((o: any) => o?.availablePackages || []);
      seasonPkg = all.find((p: any) => /sezon|season/i.test(p?.product?.identifier || p?.identifier || '')) || null;
      if (seasonPkg?.product?.priceString) seasonPriceStr = seasonPkg.product.priceString;
    } catch (e) { Analytics.error(e, 'rc_init'); }
  },
  async login(uid: string) { if (configured) try { const r: any = await RC.logIn({ appUserID: uid }); apply(r.customerInfo); } catch { /* yok */ } },
  async buy() {
    if (!native()) {
      openModal(`<div class="card"><div class="badge">${I.crown}</div><h3>Test satın alma</h3><p>Önizlemede gerçek ödeme alınmaz. Uygulamada mağazanın ödeme ekranı açılır.</p>
        <div class="btns"><button class="btn gold" data-a="ok">Satın al · ${priceStr}</button><button class="txt" data-a="no">Vazgeç</button></div></div>`,
        a => { closeModal(); if (a === 'ok') unlocked(); });
      return;
    }
    if (!configured || !pkg) { toast('Mağaza şu an kullanılamıyor'); return; }
    try { const r: any = await RC.purchasePackage({ aPackage: pkg }); apply(r.customerInfo); if (S.premium) unlocked(); }
    catch (e: any) { if (!e?.userCancelled) toast('Satın alma tamamlanamadı'); }
  },
  /** Tapu sezonu: Altın Tapu (her sezon tekrar alınır; RevenueCat'te tüketilen ürün "tapu_sezon"). */
  seasonPrice: () => seasonPriceStr,
  async buySeason(onOk: () => void) {
    if (!native()) {
      openModal(`<div class="card"><div class="badge">${I.crown}</div><h3>Test satın alma</h3><p>Önizlemede gerçek ödeme alınmaz. Uygulamada mağazanın ödeme ekranı açılır.</p>
        <div class="btns"><button class="btn gold" data-a="ok">Altın Tapu · ${seasonPriceStr}</button><button class="txt" data-a="no">Vazgeç</button></div></div>`,
        a => { closeModal(); if (a === 'ok') { onOk(); Analytics.log('iap_purchase', { product: 'season' }); } });
      return;
    }
    if (!configured || !seasonPkg) { toast('Mağaza şu an kullanılamıyor'); return; }
    try { await RC.purchasePackage({ aPackage: seasonPkg }); onOk(); Analytics.log('iap_purchase', { product: 'season' }); }
    catch (e: any) { if (!e?.userCancelled) toast('Satın alma tamamlanamadı'); }
  },
  async restore() {
    if (!native()) { toast(S.premium ? 'Satın alım geri yüklendi' : 'Geri yüklenecek satın alım yok'); return; }
    try { const r: any = await RC.restorePurchases(); apply(r.customerInfo); toast(S.premium ? 'Satın alım geri yüklendi' : 'Geri yüklenecek satın alım yok'); }
    catch { toast('Geri yükleme başarısız'); }
  },
};
