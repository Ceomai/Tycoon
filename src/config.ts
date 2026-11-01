/* =========================================================
   AYARLAR — oyunun hızı, reklam dengesi ve harita
   CFG içindeki değerler Remote Config ile uygulamayı güncellemeden değiştirilebilir.
   ========================================================= */
export const COLS = 4, ROWS = 5, N = COLS * ROWS;

export type BuildingType = 'ev' | 'kafe' | 'dukkan' | 'ofis';
export const TYPES: Record<BuildingType, { n: string; cost: number; inc: number; time: number; unlock: number }> = {
  ev: { n: 'Ev', cost: 100, inc: 1, time: 20, unlock: 0 },
  kafe: { n: 'Kafe', cost: 1500, inc: 9, time: 90, unlock: 1000 },
  dukkan: { n: 'Dükkân', cost: 20000, inc: 80, time: 300, unlock: 15000 },
  ofis: { n: 'Ofis', cost: 250000, inc: 700, time: 900, unlock: 200000 },
};
export const ORDER: BuildingType[] = ['ev', 'kafe', 'dukkan', 'ofis'];
export const LV_INC = [0, 1, 2.5, 6, 14, 32];
export const UP_COST = [0, 2, 5, 12, 30];
export const UP_TIME = [0, 2, 4, 8, 16];
export const MAXLV = 5;

/* ---------- iller ve semtler ----------
   Her ilin 5 semti var; aynı sıradaki semtler aynı ekonomik kademede.
   v = ev mimarisi (0 kırma çatı, 1 tuğla apartman, 2 rezidans, 3 taş apartman/mansart, 4 yalı, 5 Ege taş evi) */
export type CityId = 'ist' | 'izm' | 'ank';
export const CITIES: Record<CityId, { n: string; districts: { n: string; v: number }[]; tagline: string }> = {
  ist: { n: 'İstanbul', tagline: 'Boğaz manzaralı semtler, yalılar ve plazalar', districts: [
    { n: 'Kadıköy', v: 0 }, { n: 'Beşiktaş', v: 1 }, { n: 'Şişli', v: 2 }, { n: 'Nişantaşı', v: 3 }, { n: 'Bebek', v: 4 }] },
  izm: { n: 'İzmir', tagline: 'Körfez, Levanten evleri ve Ege taş evleri', districts: [
    { n: 'Karşıyaka', v: 0 }, { n: 'Bornova', v: 1 }, { n: 'Alsancak', v: 3 }, { n: 'Göztepe', v: 2 }, { n: 'Çeşme', v: 5 }] },
  ank: { n: 'Ankara', tagline: 'Bahçeli evler, bulvarlar ve yeni yerleşimler', districts: [
    { n: 'Bahçelievler', v: 0 }, { n: 'Kızılay', v: 1 }, { n: 'Çankaya', v: 3 }, { n: 'Ümitköy', v: 2 }, { n: 'İncek', v: 0 }] },
};
export const CITY_ORDER: CityId[] = ['ist', 'izm', 'ank'];
export const TIER_M = [1, 6, 36, 216, 1296];           // kademe çarpanı (maliyet)
export const TIER_FEE = [0, 150e3, 4e6, 1.2e8, 4e9];    // il içinde sonraki semtin tapu bedeli

export type DistrictKey = string; // örn. "ist-0"
export interface District { key: DistrictKey; city: CityId; idx: number; n: string; v: number; }
export const DLIST: District[] = CITY_ORDER.flatMap(city => CITIES[city].districts.map((d, idx) => ({ key: `${city}-${idx}`, city, idx, n: d.n, v: d.v })));
export const DMAP: Record<DistrictKey, District> = Object.fromEntries(DLIST.map(d => [d.key, d]));
export const dkey = (city: CityId, idx: number): DistrictKey => `${city}-${idx}`;

/* ---------- denge (Remote Config ile değişebilir) ---------- */
export const CFG = {
  CAP_SEC: 90,                 // kira kumbarası kaç saniyede dolar
  ADJ: 0.2,                    // aynı tür komşu başına bonus
  BOOST_STEP: 30 * 60e3, BOOST_MAX: 4 * 3600e3, AD_SKIP: 30 * 60e3,
  OFFLINE_RATE: 0.3, OFFLINE_MAX: 3 * 3600e3,
  INTER_MIN: 15 * 60e3, INTER_MAX: 20 * 60e3,
  EVENT_MIN: 150e3, EVENT_MAX: 270e3,
  OFFER_MIN: 6 * 60e3, OFFER_MAX: 9 * 60e3,
  AD_SECONDS: 5,               // yalnızca web simülasyonu
  EXTRA_CITY_FEE_1: 60e3,      // ikinci ilin ilk semti
  EXTRA_CITY_FEE_2: 600e3,     // üçüncü ilin ilk semti
  PORTFOLIO_BONUS: 0.1,        // sahip olunan her ek il için kalıcı kira bonusu
  SHARE_BASE: 1e8,             // holding hissesi = √(tur kazancı / SHARE_BASE)
  TICK_MS: 250,                // oyun döngüsü (4 Hz)
  IDLE_MS: 30e3,               // bu kadar dokunulmazsa animasyonlar durur
  CLOUD_SAVE_MS: 5 * 60e3,     // bulut kaydı sıklığı (ayrıca uygulama arka plana alınınca hemen gönderilir)
  SCORE_POST_MS: 5 * 60e3,     // sıralamaya skor gönderme sıklığı
};
export type Cfg = typeof CFG;

export const SAVE_KEY = 'tapu-save-v2';
export const LEGACY_SAVE_KEY = 'tapu-save-v1';
export const SCHEMA = 2;
export const PRIVACY_URL = (import.meta.env.VITE_PRIVACY_URL as string) || 'https://example.com/tapu/gizlilik';

/* ---------- haftalık lig ---------- */
export const LEAGUES = [
  { id: 'arsa', n: 'Arsa Ligi', short: 'ARSA' },
  { id: 'kat', n: 'Kat Ligi', short: 'KAT' },
  { id: 'apartman', n: 'Apartman Ligi', short: 'APARTMAN' },
  { id: 'plaza', n: 'Plaza Ligi', short: 'PLAZA' },
  { id: 'gokdelen', n: 'Gökdelen Ligi', short: 'GÖKDELEN' },
] as const;
export const LEAGUE_TOP = LEAGUES.length - 1;
export const GROUP_SIZE = 30;
