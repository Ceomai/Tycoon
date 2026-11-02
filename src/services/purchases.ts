/* =========================================================
   SATIN ALMA — RevenueCat (makbuz doğrulaması RevenueCat sunucularında yapılır)
   Yetkiler (entitlement): "premium" = Holding paketi (eski tek paket; ürün tapu_premium),
   "reklamsiz" = Reklamsız paket, "kulup" = Emlak Kulübü aboneliği.
   Tekil ürünler: tapu_baslangic (tek sefer), tapu_jeton5 / tapu_jeton15 (tüketilen), tapu_sezon / tapu_sezon_ilk.
   Uygulama yerel bayraklara değil, RevenueCat'in verdiği yetkiye güvenir; bayraklar yalnızca önbellek.
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

export type ProductKey = 'holding' | 'reklamsiz' | 'kulup' | 'baslangic' | 'jeton5' | 'jeton15' | 'sezon' | 'sezonIlk';
/** Mağaza ürün kimliğini tanıyan desen ve varsayılan fiyat (mağaza yanıt vermezse gösterilir). */
const PRODUCTS: Record<ProductKey, { re: RegExp; price: string; name: string }> = {
  holding: { re: /premium|holding/i, price: '₺249,99', name: 'Holding paketi' },
  reklamsiz: { re: /reklamsiz|noads/i, price: '₺99,99', name: 'Reklamsız paket' },
  kulup: { re: /kulup|club/i, price: '₺69,99', name: 'Emlak Kulübü' },
  baslangic: { re: /baslangic|starter/i, price: '₺49,99', name: 'Başlangıç paketi' },
  jeton5: { re: /jeton_?5$|tokens_?5$/i, price: '₺29,99', name: '5 adet 2x jetonu' },
  jeton15: { re: /jeton_?15$|tokens_?15$/i, price: '₺69,99', name: '15 adet 2x jetonu' },
  sezonIlk: { re: /sezon_?ilk|season_?intro/i, price: '₺49,99', name: 'Altın Tapu (ilk sezon)' },
  sezon: { re: /sezon|season/i, price: '₺99,99', name: 'Altın Tapu' },
};
const ORDER_MATCH: ProductKey[] = ['sezonIlk', 'sezon', 'jeton15', 'jeton5', 'baslangic', 'kulup', 'reklamsiz', 'holding'];
const ENT = { premium: 'premium', reklamsiz: 'reklamsiz', kulup: 'kulup' };
let configured = false;
const pkgs: Partial<Record<ProductKey, any>> = {};
const prices: Record<ProductKey, string> = Object.fromEntries(Object.entries(PRODUCTS).map(([k, v]) => [k, v.price])) as any;
const native = () => Capacitor.isNativePlatform() && !__PREVIEW__;
const apiKey = () => (Capacitor.getPlatform() === 'ios' ? import.meta.env.VITE_REVENUECAT_IOS : import.meta.env.VITE_REVENUECAT_ANDROID) || '';

/** Geçiş reklamı yok mu? (Holding, Reklamsız ya da Kulüp) */
export const adFree = () => !!(S.premium || S.noAds || S.club);
/** Ödüllü reklam ödülü izlemeden, anında mı? (Holding ya da Kulüp) */
export const instantRewards = () => !!(S.premium || S.club);

function apply(info: any) {
  const act = (info && info.entitlements && info.entitlements.active) || {};
  const p = !!act[ENT.premium], n = !!act[ENT.reklamsiz], c = !!act[ENT.kulup];
  if (p !== S.premium || n !== S.noAds || c !== S.club) { S.premium = p; S.noAds = n; S.club = c; ui.rateHtml = ''; ui.sheetSig = ''; persist(); }
}
const identOf = (p: any) => String(p?.product?.identifier || p?.identifier || '');

/** Satın alma başarılı olunca yerel ödülü verir (yetkiler ayrıca RevenueCat'ten de gelir). */
function grant(key: ProductKey, onOk?: () => void) {
  if (key === 'holding') S.premium = true;
  if (key === 'reklamsiz') S.noAds = true;
  if (key === 'kulup') S.club = true;
  ui.rateHtml = ''; ui.sheetSig = ''; persist(); Snd.unlock();
  if (onOk) onOk(); else toast(`${PRODUCTS[key].name} aktif`);
  Analytics.log('iap_purchase', { product: key });
}

export const Purchases = {
  price: (k: ProductKey = 'holding') => prices[k],
  /** Altın Tapu için gösterilecek fiyat: ilk sezonda indirimli ürün varsa o. */
  seasonPrice: () => (!S.seasonFirst ? prices.sezonIlk : prices.sezon),
  seasonFull: () => prices.sezon,
  async init(uid: string | null) {
    if (!native() || !apiKey()) return;
    try {
      await RC.configure({ apiKey: apiKey(), appUserID: uid || undefined } as any);
      configured = true;
      const { customerInfo } = await RC.getCustomerInfo() as any; apply(customerInfo);
      const off: any = await RC.getOfferings();
      const all: any[] = Object.values(off?.all || {}).flatMap((o: any) => o?.availablePackages || []);
      for (const p of all) {
        const id = identOf(p), key = ORDER_MATCH.find(k => PRODUCTS[k].re.test(id));
        if (key && !pkgs[key]) { pkgs[key] = p; if (p?.product?.priceString) prices[key] = p.product.priceString; }
      }
    } catch (e) { Analytics.error(e, 'rc_init'); }
  },
  async login(uid: string) { if (configured) try { const r: any = await RC.logIn({ appUserID: uid }); apply(r.customerInfo); } catch { /* yok */ } },
  /** Genel satın alma: başarılıysa onOk çalışır (tüketilen ürünlerde ödülü veren yer). */
  async buyProduct(key: ProductKey, onOk?: () => void) {
    if (!native()) {
      openModal(`<div class="card"><div class="badge">${I.crown}</div><h3>Test satın alma</h3><p>Önizlemede gerçek ödeme alınmaz. Uygulamada mağazanın ödeme ekranı açılır.</p>
        <div class="btns"><button class="btn gold" data-a="ok">${PRODUCTS[key].name} · ${prices[key]}</button><button class="txt" data-a="no">Vazgeç</button></div></div>`,
        a => { closeModal(); if (a === 'ok') grant(key, onOk); });
      return;
    }
    const pkg = pkgs[key] || (key === 'sezonIlk' ? pkgs.sezon : null);
    if (!configured || !pkg) { toast('Mağaza şu an kullanılamıyor'); return; }
    try { const r: any = await RC.purchasePackage({ aPackage: pkg }); apply(r.customerInfo); grant(key, onOk); }
    catch (e: any) { if (!e?.userCancelled) toast('Satın alma tamamlanamadı'); }
  },
  /** Eski çağrı: Holding paketi (önceki "Reklamsız paket" ürünü). */
  buy() { return this.buyProduct('holding'); },
  buySeason(onOk: () => void) {
    const first = !S.seasonFirst;
    return this.buyProduct(first ? 'sezonIlk' : 'sezon', () => { if (first) S.seasonFirst = true; onOk(); });
  },
  async restore() {
    const any = () => S.premium || S.noAds || S.club;
    if (!native()) { toast(any() ? 'Satın alım geri yüklendi' : 'Geri yüklenecek satın alım yok'); return; }
    try { const r: any = await RC.restorePurchases(); apply(r.customerInfo); toast(any() ? 'Satın alım geri yüklendi' : 'Geri yüklenecek satın alım yok'); }
    catch { toast('Geri yükleme başarısız'); }
  },
};
