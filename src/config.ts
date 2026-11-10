/* =========================================================
   AYARLAR — oyunun hızı, reklam dengesi ve harita
   CFG içindeki değerler Remote Config ile uygulamayı güncellemeden değiştirilebilir.
   ========================================================= */
import { tk } from './i18n';

export const COLS = 4, ROWS = 5, N = COLS * ROWS;

export type BuildingType = 'ev' | 'kafe' | 'dukkan' | 'ofis';
export const TYPES: Record<BuildingType, { n: string; cost: number; inc: number; time: number; unlock: number }> = {
  ev: { n: tk('Ev'), cost: 100, inc: 1, time: 20, unlock: 0 },
  kafe: { n: tk('Kafe'), cost: 1500, inc: 9, time: 90, unlock: 1000 },
  dukkan: { n: tk('Dükkân'), cost: 20000, inc: 80, time: 300, unlock: 15000 },
  ofis: { n: tk('Ofis'), cost: 250000, inc: 700, time: 900, unlock: 200000 },
};
export const ORDER: BuildingType[] = ['ev', 'kafe', 'dukkan', 'ofis'];
export const LV_INC = [0, 1, 2.5, 6, 14, 32];
export const UP_COST = [0, 2, 5, 12, 30];
export const UP_TIME = [0, 2, 4, 8, 16];
export const MAXLV = 5;

/* ---------- iller ve semtler ----------
   Her ilin 5 semti var; aynı sıradaki semtler aynı ekonomik kademede.
   v = ev mimarisi (0 kırma çatı, 1 tuğla apartman, 2 rezidans, 3 taş apartman/mansart, 4 yalı, 5 Ege taş evi) */
export type CityId = string;
/** Şehirler. n: varsayılan ad (dile göre i18n'de çevrilir), tagline: Türkçe kaynak metin (i18n anahtarı).
 *  Semtler ucuzdan pahalıya; aynı sıradaki semtler aynı ekonomik kademede (tüm bölgelerde ekonomi aynı). */
export const CITIES: Record<CityId, { n: string; districts: { n: string; v: number }[]; tagline: string }> = {
  ist: { n: 'İstanbul', tagline: tk('Boğaz manzaralı semtler, yalılar ve plazalar'), districts: [
    { n: 'Kadıköy', v: 0 }, { n: 'Beşiktaş', v: 1 }, { n: 'Şişli', v: 2 }, { n: 'Nişantaşı', v: 3 }, { n: 'Bebek', v: 4 }] },
  izm: { n: 'İzmir', tagline: tk('Körfez, Levanten evleri ve Ege taş evleri'), districts: [
    { n: 'Karşıyaka', v: 0 }, { n: 'Bornova', v: 1 }, { n: 'Alsancak', v: 3 }, { n: 'Göztepe', v: 2 }, { n: 'Çeşme', v: 5 }] },
  ank: { n: 'Ankara', tagline: tk('Bahçeli evler, bulvarlar ve yeni yerleşimler'), districts: [
    { n: 'Bahçelievler', v: 0 }, { n: 'Kızılay', v: 1 }, { n: 'Çankaya', v: 3 }, { n: 'Ümitköy', v: 2 }, { n: 'İncek', v: 0 }] },
  nyc: { n: 'New York', tagline: tk('Gökdelenler, kahverengi taş evler ve çatı katları'), districts: [
    { n: 'Queens', v: 0 }, { n: 'Brooklyn', v: 1 }, { n: 'Harlem', v: 3 }, { n: 'Upper West Side', v: 3 }, { n: 'Tribeca', v: 2 }] },
  la: { n: 'Los Angeles', tagline: tk('Palmiyeli bulvarlar, plajlar ve tepe villaları'), districts: [
    { n: 'Long Beach', v: 0 }, { n: 'Downtown', v: 2 }, { n: 'Santa Monica', v: 5 }, { n: 'Hollywood Hills', v: 0 }, { n: 'Beverly Hills', v: 4 }] },
  chi: { n: 'Chicago', tagline: tk('Göl kıyısı, tuğla apartmanlar ve kuleler'), districts: [
    { n: 'Pilsen', v: 1 }, { n: 'Wicker Park', v: 1 }, { n: 'Lincoln Park', v: 3 }, { n: 'River North', v: 2 }, { n: 'Gold Coast', v: 4 }] },
  lon: { n: 'London', tagline: tk('Sıra evler, ara sokaklar ve rıhtımlar'), districts: [
    { n: 'Croydon', v: 0 }, { n: 'Camden', v: 1 }, { n: 'Shoreditch', v: 2 }, { n: 'Notting Hill', v: 3 }, { n: 'Mayfair', v: 3 }] },
  man: { n: 'Manchester', tagline: tk('Tuğla fabrikalar, kanallar ve yeni kuleler'), districts: [
    { n: 'Salford', v: 0 }, { n: 'Ancoats', v: 1 }, { n: 'Northern Quarter', v: 1 }, { n: 'Spinningfields', v: 2 }, { n: 'Didsbury', v: 3 }] },
  edi: { n: 'Edinburgh', tagline: tk('Taş konaklar, kale ve liman'), districts: [
    { n: 'Leith', v: 1 }, { n: 'Gorgie', v: 0 }, { n: 'Marchmont', v: 3 }, { n: 'Stockbridge', v: 3 }, { n: 'New Town', v: 4 }] },
  muc: { n: 'Munich', tagline: tk('Bira bahçeleri, eski apartmanlar ve Alp villaları'), districts: [
    { n: 'Neuperlach', v: 0 }, { n: 'Sendling', v: 1 }, { n: 'Maxvorstadt', v: 3 }, { n: 'Schwabing', v: 3 }, { n: 'Bogenhausen', v: 4 }] },
  ber: { n: 'Berlin', tagline: tk('Sokak sanatı, avlulu apartmanlar ve göl villaları'), districts: [
    { n: 'Marzahn', v: 2 }, { n: 'Neukölln', v: 1 }, { n: 'Kreuzberg', v: 1 }, { n: 'Prenzlauer Berg', v: 3 }, { n: 'Grunewald', v: 4 }] },
  ham: { n: 'Hamburg', tagline: tk('Liman lofları, kanallar ve Elbe konakları'), districts: [
    { n: 'Wilhelmsburg', v: 0 }, { n: 'Altona', v: 1 }, { n: 'St. Pauli', v: 2 }, { n: 'Eppendorf', v: 3 }, { n: 'Blankenese', v: 4 }] },
  tyo: { n: 'Tokyo', tagline: tk('Neon kuleler, ara sokaklar ve sakin tapınaklar'), districts: [
    { n: 'Adachi', v: 0 }, { n: 'Nakano', v: 1 }, { n: 'Shibuya', v: 2 }, { n: 'Ginza', v: 2 }, { n: 'Azabu', v: 4 }] },
  osa: { n: 'Osaka', tagline: tk('Sokak lezzetleri, kanallar ve iş kuleleri'), districts: [
    { n: 'Nishinari', v: 0 }, { n: 'Tennoji', v: 1 }, { n: 'Namba', v: 2 }, { n: 'Umeda', v: 2 }, { n: 'Kitashinchi', v: 3 }] },
  kyo: { n: 'Kyoto', tagline: tk('Ahşap evler, bahçeler ve tapınaklar'), districts: [
    { n: 'Fushimi', v: 0 }, { n: 'Nakagyo', v: 1 }, { n: 'Higashiyama', v: 3 }, { n: 'Arashiyama', v: 5 }, { n: 'Gion', v: 4 }] },
};

/* ---------- bölgeler: dil ayrı seçilir; bölge şehirleri ve para birimini belirler ---------- */
export type RegionId = 'tr' | 'us' | 'uk' | 'de' | 'jp' | 'gl';
export const REGIONS: Record<RegionId, { n: string; cur: string; cities: CityId[]; lang: string; tagline: string }> = {
  tr: { n: tk('Türkiye'), cur: '₺', cities: ['ist', 'izm', 'ank'], lang: 'tr', tagline: tk('Boğaz, Ege ve başkent') },
  us: { n: tk('ABD'), cur: '$', cities: ['nyc', 'la', 'chi'], lang: 'en', tagline: tk('Gökdelenler ve gün batımı bulvarları') },
  uk: { n: tk('Birleşik Krallık'), cur: '£', cities: ['lon', 'man', 'edi'], lang: 'en', tagline: tk('Sıra evler, ara sokaklar ve rıhtımlar') },
  de: { n: tk('Almanya'), cur: '€', cities: ['muc', 'ber', 'ham'], lang: 'de', tagline: tk('Eski apartmanlar, villalar ve limanlar') },
  jp: { n: tk('Japonya'), cur: '¥', cities: ['tyo', 'osa', 'kyo'], lang: 'ja', tagline: tk('Neon kuleler ve sakin tapınaklar') },
  gl: { n: tk('GLOBAL'), cur: '$', cities: ['ist', 'nyc', 'lon', 'muc', 'tyo'], lang: 'en', tagline: tk('Her ülkenin en pahalı şehri') },
};
export const REGION_ORDER: RegionId[] = ['tr', 'us', 'uk', 'de', 'jp', 'gl'];
/** Etkin bölgenin şehirleri (setRegion yerinde günceller; içe aktaranlar aynı diziyi görür). */
export const CITY_ORDER: CityId[] = ['ist', 'izm', 'ank'];
export let REGION: RegionId = 'tr';
export function setRegion(r: RegionId) {
  REGION = REGIONS[r] ? r : 'tr';
  CITY_ORDER.splice(0, CITY_ORDER.length, ...REGIONS[REGION].cities);
}
export const currency = () => REGIONS[REGION].cur;
// Denge (scripts/sim.ts ile ölçüldü): semtler 15–45 dk'da dolar, tapu beklemesi ≤ ~17 dk
export const TIER_M = [1, 10, 100, 1000, 10000];       // kademe çarpanı (maliyet)
export const TIER_FEE = [0, 80e3, 1e6, 1.2e7, 1.5e8];   // il içinde sonraki semtin tapu bedeli

export type DistrictKey = string; // örn. "ist-0"
export interface District { key: DistrictKey; city: CityId; idx: number; n: string; v: number; }
export const DLIST: District[] = Object.keys(CITIES).flatMap(city => CITIES[city].districts.map((d, idx) => ({ key: `${city}-${idx}`, city, idx, n: d.n, v: d.v })));
export const DMAP: Record<DistrictKey, District> = Object.fromEntries(DLIST.map(d => [d.key, d]));
export const dkey = (city: CityId, idx: number): DistrictKey => `${city}-${idx}`;

/* ---------- denge (Remote Config ile değişebilir) ---------- */
export const CFG = {
  CAP_SEC: 90,                 // kira kumbarası kaç saniyede dolar
  ADJ: 0.2,                    // aynı tür komşu başına bonus
  BOOST_MAX: 4 * 3600e3,       // tüm mülklere 2x (yalnızca günlük görevlerin üçü bitince) en fazla birikim
  TASK_BOOST: 60 * 60e3,       // görev bonusu: tüm mülklere 2x süresi
  LOT_BOOST: 60 * 60e3, LOT_BOOST_MAX: 4 * 3600e3, // mülke özel 2x: reklam başına süre, en fazla birikim
  AD_SKIP: 30 * 60e3,          // reklamla hızlandırma: süreden düşülen
  SKIP_LEFT: 5e3,
  TIER_INC: 0.6,               // kira çarpanı = kademe çarpanı × TIER_INC^kademe (yeni semtin binaları eski kiralarla anında dolmasın)
  KAPORA: 0.3,                 // kapora: tapunun bu kadarı peşin
  KAPORA_LOTS: 4,              // kaporalı semtte açılan arsa sayısı
  KAPORA_SHARE: 0.5,           // kaporalı semtin kirasının borca giden payı
  PAIR: 0.1,                   // akıllı ikili komşu (kafe+ofis, ev+dükkân) başına bonus
  SP_ADJ: 0.15,                // özel yapının her komşusuna bonus
  STAR_BONUS: 0.1,             // 3 yıldızlı semte kalıcı bonus
  SP_PRICE_H: 2,               // haftanın özel tapusu: kaç saatlik kira geliri
  TIP_EVERY: 180e3,            // Rıfkı Abi en fazla bu sıklıkla konuşur              // reklam inşaatı tamamen bitirmez: son 5 sn kalır (bitiş anı oyuncunun gözü önünde)
  OFFLINE_RATE: 0.3, OFFLINE_MAX: 3 * 3600e3,
  INTER_MIN: 15 * 60e3, INTER_MAX: 20 * 60e3,
  EVENT_MIN: 150e3, EVENT_MAX: 270e3,
  OFFER_MIN: 6 * 60e3, OFFER_MAX: 9 * 60e3,
  AD_SECONDS: 5,               // yalnızca web simülasyonu
  EXTRA_CITY_FEE_1: 60e3,      // ikinci ilin ilk semti
  EXTRA_CITY_FEE_2: 600e3,     // üçüncü ilin ilk semti
  EXTRA_CITY_FEE_3: 6e6,       // dördüncü şehir (yalnızca Global)
  EXTRA_CITY_FEE_4: 60e6,      // beşinci şehir (yalnızca Global)
  PORTFOLIO_BONUS: 0.1,        // sahip olunan her ek il için kalıcı kira bonusu
  SHARE_BASE: 1e8,             // holding hissesi = √(tur kazancı / SHARE_BASE)
  TICK_MS: 250,                // oyun döngüsü (4 Hz)
  IDLE_MS: 30e3,               // bu kadar dokunulmazsa animasyonlar durur
  CLOUD_SAVE_MS: 5 * 60e3,     // bulut kaydı sıklığı (ayrıca uygulama arka plana alınınca hemen gönderilir)
  SCORE_POST_MS: 5 * 60e3,     // sıralamaya skor gönderme sıklığı
  // gelir modeli (Remote Config ile değiştirilebilir; oyun dengesine dokunmaz)
  AD_CREDIT_MS: 10 * 60e3,     // ödüllü reklamdan sonra bu süre geçiş reklamı yok
  FIRST_FREE_MS: 30 * 60e3,    // ilk 30 dk oyunda geçiş reklamı yok
  BOOT_QUIET_MS: 60e3,         // açılışın ilk 60 sn'sinde geçiş reklamı yok
  BREAK_WAIT_MS: 3 * 60e3,     // doğal durak gelmezse en fazla bu kadar beklenir
  DAILY7_X: 3,                 // günlük ödülün 7. gününde reklam çarpanı
  CARD_FLOOR_SEC: 600,         // etkinlik/fırsat nakit ödülü tabanı (sn kira)
  HINT2X_EVERY: 15 * 60e3,     // Rıfkı'nın 2x hatırlatması en fazla bu sıklıkla
  STARTER_MS: 48 * 3600e3,     // başlangıç paketi süresi
  STARTER_CASH_SEC: 7200,      // başlangıç paketi nakdi (sn kira)
  STARTER_TOKENS: 5,
  STARTER_CASH_MIN: 5000,      // başlangıç paketi en düşük nakdi
  AD_REWARD_QUIET_MS: 5 * 60e3, // ödüllü reklamdan sonra sıradaki geçiş reklamı en az bu kadar ertelenir
  // altın taksi, tarihi yapı şansı, özel tapu
  TAXI_MIN: 70e3, TAXI_MAX: 130e3, // altın taksi aralığı (oyun süresi)
  TAXI_OFFER_MIN: 18e3, TAXI_OFFER_MAX: 30e3, // "taksi yakala" fırsatı sürerken aralık
  TAXI_SEC: 120,               // altın taksi ödülü (sn kira) ...
  TAXI_CASH_MIN: 100,          // ... en az
  LM_CHANCE: 0.08,             // altın taksiden ve moloz temizliğinden tarihi yapı çıkma şansı
  SP_PRICE_MIN: 20000,         // haftanın özel tapusu en düşük fiyatı
};
export type Cfg = typeof CFG;

/** Engelli arsa türleri (çizim ve metinler game/district.ts'te). Kayıt doğrulaması için burada. */
export const OBSTACLE_IDS = ['gecekondu', 'hurda', 'moloz', 'duvar'];
/** Sunucu fonksiyonları (lig, davet) yayında mı? Yayına alınınca .env.production'da VITE_SERVER_FUNCTIONS=true. Önizlemede açık. */
export const SERVER_FEATURES = __PREVIEW__ || import.meta.env.VITE_SERVER_FUNCTIONS === 'true';
export const SAVE_KEY = 'tapu-save-v2';
export const LEGACY_SAVE_KEY = 'tapu-save-v1';
export const SCHEMA = 2;
export const PRIVACY_URL = (import.meta.env.VITE_PRIVACY_URL as string) || 'https://ceomai.github.io/Tycoon/gizlilik.html';
/** Kullanım koşulları: verilmezse Apple'ın standart son kullanıcı sözleşmesi (App Store aboneliklerinde kabul edilir). */
export const TERMS_URL = (import.meta.env.VITE_TERMS_URL as string) || 'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/';

/* ---------- haftalık lig ---------- */
export const LEAGUES = [
  { id: 'arsa', n: tk('Arsa Ligi'), short: tk('ARSA') },
  { id: 'kat', n: tk('Kat Ligi'), short: tk('KAT') },
  { id: 'apartman', n: tk('Apartman Ligi'), short: tk('APARTMAN') },
  { id: 'plaza', n: tk('Plaza Ligi'), short: tk('PLAZA') },
  { id: 'gokdelen', n: tk('Gökdelen Ligi'), short: tk('GÖKDELEN') },
] as const;
export const LEAGUE_TOP = LEAGUES.length - 1;
export const GROUP_SIZE = 30;

/* ---------- semt kuralları (her semtin oynanışı değiştiren küçük özelliği) ----------
   type: o türdeki binalar +x · row: en alt sıra (sahil) +x · speed: inşaat/tadilat x kadar hızlı
   upDisc: tadilat x kadar ucuz · pair: akıllı ikili bonusu +x (ek) */
export interface DRule { n: string; t: string; kind: 'type' | 'row' | 'speed' | 'upDisc' | 'pair'; type?: BuildingType; x: number; }
export const DRULES: Record<string, DRule> = {
  'ist-0': { n: tk('Bahçeli evler'), t: tk('Evler +%15'), kind: 'type', type: 'ev', x: 0.15 },
  'ist-1': { n: tk('Çarşı semti'), t: tk('Kafeler +%20'), kind: 'type', type: 'kafe', x: 0.2 },
  'ist-2': { n: tk('İş merkezi'), t: tk('Ofisler +%15'), kind: 'type', type: 'ofis', x: 0.15 },
  'ist-3': { n: tk('Butik caddesi'), t: tk('Dükkânlar +%25'), kind: 'type', type: 'dukkan', x: 0.25 },
  'ist-4': { n: tk('Boğaz kıyısı'), t: tk('Sahil sırası (en alt sıra) +%30'), kind: 'row', x: 0.3 },
  'izm-0': { n: tk('Çarşı ve sahil'), t: tk('Evler +%15'), kind: 'type', type: 'ev', x: 0.15 },
  'izm-1': { n: tk('Genç ve hareketli'), t: tk('İnşaatlar %25 hızlı'), kind: 'speed', x: 0.25 },
  'izm-2': { n: tk('Kordon boyu'), t: tk('Kafeler +%25'), kind: 'type', type: 'kafe', x: 0.25 },
  'izm-3': { n: tk('Mahalle kültürü'), t: tk('Akıllı ikililer +%20'), kind: 'pair', x: 0.1 },
  'izm-4': { n: tk('Ege kıyısı'), t: tk('Sahil sırası (en alt sıra) +%30'), kind: 'row', x: 0.3 },
  'ank-0': { n: tk('Bahçeli evler'), t: tk('Evler +%20'), kind: 'type', type: 'ev', x: 0.2 },
  'ank-1': { n: tk('Bulvar etkisi'), t: tk('Dükkânlar +%25'), kind: 'type', type: 'dukkan', x: 0.25 },
  'ank-2': { n: tk('Elçilikler semti'), t: tk('Ofisler +%20'), kind: 'type', type: 'ofis', x: 0.2 },
  'ank-3': { n: tk('Yeni yerleşim'), t: tk('Tadilat %20 ucuz'), kind: 'upDisc', x: 0.2 },
  'ank-4': { n: tk('Yükselen bölge'), t: tk('İnşaatlar %25 hızlı'), kind: 'speed', x: 0.25 },
  // Diğer ülkeler: denge, bölgedeki aynı sıradaki Türkiye şehrininkiyle aynı (1. şehir = İstanbul, 2. = İzmir, 3. = Ankara);
  // adlar ve açıklamalar şehre özgü. Global, şehirlerin kendi kurallarını kullanır.
  'nyc-0': { n: tk('Müstakil aile evleri'), t: tk('Evler +%15'), kind: 'type', type: 'ev', x: 0.15 },
  'nyc-1': { n: tk('Kahverengi taş sokaklar'), t: tk('Kafeler +%20'), kind: 'type', type: 'kafe', x: 0.2 },
  'nyc-2': { n: tk('125. Cadde ofisleri'), t: tk('Ofisler +%15'), kind: 'type', type: 'ofis', x: 0.15 },
  'nyc-3': { n: tk('Columbus Avenue butikleri'), t: tk('Dükkânlar +%25'), kind: 'type', type: 'dukkan', x: 0.25 },
  'nyc-4': { n: tk('Hudson kıyısı'), t: tk('Nehir kıyısı (en alt sıra) +%30'), kind: 'row', x: 0.3 },
  'la-0': { n: tk('Bungalov sokakları'), t: tk('Evler +%15'), kind: 'type', type: 'ev', x: 0.15 },
  'la-1': { n: tk('Merkezde dönüşüm'), t: tk('İnşaatlar %25 hızlı'), kind: 'speed', x: 0.25 },
  'la-2': { n: tk('Promenade kafeleri'), t: tk('Kafeler +%25'), kind: 'type', type: 'kafe', x: 0.25 },
  'la-3': { n: tk('Yaratıcı komşuluk'), t: tk('Akıllı ikililer +%20'), kind: 'pair', x: 0.1 },
  'la-4': { n: tk('Rodeo Drive cephesi'), t: tk('Cadde cephesi (en alt sıra) +%30'), kind: 'row', x: 0.3 },
  'chi-0': { n: tk('İşçi evleri'), t: tk('Evler +%20'), kind: 'type', type: 'ev', x: 0.2 },
  'chi-1': { n: tk('Milwaukee Avenue butikleri'), t: tk('Dükkânlar +%25'), kind: 'type', type: 'dukkan', x: 0.25 },
  'chi-2': { n: tk('Park kenarı ofisleri'), t: tk('Ofisler +%20'), kind: 'type', type: 'ofis', x: 0.2 },
  'chi-3': { n: tk('Depodan lofta'), t: tk('Tadilat %20 ucuz'), kind: 'upDisc', x: 0.2 },
  'chi-4': { n: tk('Göl kıyısı kuleleri'), t: tk('İnşaatlar %25 hızlı'), kind: 'speed', x: 0.25 },
  'lon-0': { n: tk('Banliyö evleri'), t: tk('Evler +%15'), kind: 'type', type: 'ev', x: 0.15 },
  'lon-1': { n: tk('Camden Lock kafeleri'), t: tk('Kafeler +%20'), kind: 'type', type: 'kafe', x: 0.2 },
  'lon-2': { n: tk('Silicon Roundabout'), t: tk('Ofisler +%15'), kind: 'type', type: 'ofis', x: 0.15 },
  'lon-3': { n: tk('Portobello Road'), t: tk('Dükkânlar +%25'), kind: 'type', type: 'dukkan', x: 0.25 },
  'lon-4': { n: tk('Park Lane cephesi'), t: tk('Park cephesi (en alt sıra) +%30'), kind: 'row', x: 0.3 },
  'man-0': { n: tk('Tuğla sıra evler'), t: tk('Evler +%15'), kind: 'type', type: 'ev', x: 0.15 },
  'man-1': { n: tk('Fabrika dönüşümü'), t: tk('İnşaatlar %25 hızlı'), kind: 'speed', x: 0.25 },
  'man-2': { n: tk('Bağımsız kafeler'), t: tk('Kafeler +%25'), kind: 'type', type: 'kafe', x: 0.25 },
  'man-3': { n: tk('Ofis ve restoran karması'), t: tk('Akıllı ikililer +%20'), kind: 'pair', x: 0.1 },
  'man-4': { n: tk('Mersey kıyısı'), t: tk('Nehir kıyısı (en alt sıra) +%30'), kind: 'row', x: 0.3 },
  'edi-0': { n: tk('Liman mahallesi'), t: tk('Evler +%20'), kind: 'type', type: 'ev', x: 0.2 },
  'edi-1': { n: tk('Gorgie Road dükkânları'), t: tk('Dükkânlar +%25'), kind: 'type', type: 'dukkan', x: 0.25 },
  'edi-2': { n: tk('Üniversite komşuluğu'), t: tk('Ofisler +%20'), kind: 'type', type: 'ofis', x: 0.2 },
  'edi-3': { n: tk('Tarihî ev restorasyonu'), t: tk('Tadilat %20 ucuz'), kind: 'upDisc', x: 0.2 },
  'edi-4': { n: tk('Izgara planlı sokaklar'), t: tk('İnşaatlar %25 hızlı'), kind: 'speed', x: 0.25 },
  'muc-0': { n: tk('Büyük konut sitesi'), t: tk('Evler +%15'), kind: 'type', type: 'ev', x: 0.15 },
  'muc-1': { n: tk('Bira bahçeleri'), t: tk('Kafeler +%20'), kind: 'type', type: 'kafe', x: 0.2 },
  'muc-2': { n: tk('Üniversite ve enstitüler'), t: tk('Ofisler +%15'), kind: 'type', type: 'ofis', x: 0.15 },
  'muc-3': { n: tk('Leopoldstraße'), t: tk('Dükkânlar +%25'), kind: 'type', type: 'dukkan', x: 0.25 },
  'muc-4': { n: tk('Isar kıyısı'), t: tk('Nehir kıyısı (en alt sıra) +%30'), kind: 'row', x: 0.3 },
  'ber-0': { n: tk('Plattenbau siteleri'), t: tk('Evler +%15'), kind: 'type', type: 'ev', x: 0.15 },
  'ber-1': { n: tk('Hızlı dönüşüm'), t: tk('İnşaatlar %25 hızlı'), kind: 'speed', x: 0.25 },
  'ber-2': { n: tk('Kanal kenarı kafeler'), t: tk('Kafeler +%25'), kind: 'type', type: 'kafe', x: 0.25 },
  'ber-3': { n: tk('Avlulu apartmanlar'), t: tk('Akıllı ikililer +%20'), kind: 'pair', x: 0.1 },
  'ber-4': { n: tk('Göl villaları'), t: tk('Göl kıyısı (en alt sıra) +%30'), kind: 'row', x: 0.3 },
  'ham-0': { n: tk('Elbe adası evleri'), t: tk('Evler +%20'), kind: 'type', type: 'ev', x: 0.2 },
  'ham-1': { n: tk('Ottensen çarşısı'), t: tk('Dükkânlar +%25'), kind: 'type', type: 'dukkan', x: 0.25 },
  'ham-2': { n: tk('Rıhtım ofisleri'), t: tk('Ofisler +%20'), kind: 'type', type: 'ofis', x: 0.2 },
  'ham-3': { n: tk('Eski apartman yenileme'), t: tk('Tadilat %20 ucuz'), kind: 'upDisc', x: 0.2 },
  'ham-4': { n: tk('Elbe yamacı'), t: tk('İnşaatlar %25 hızlı'), kind: 'speed', x: 0.25 },
  'tyo-0': { n: tk('Eski mahalle evleri'), t: tk('Evler +%15'), kind: 'type', type: 'ev', x: 0.15 },
  'tyo-1': { n: tk('Sun Mall çarşısı'), t: tk('Kafeler +%20'), kind: 'type', type: 'kafe', x: 0.2 },
  'tyo-2': { n: tk('Teknoloji ofisleri'), t: tk('Ofisler +%15'), kind: 'type', type: 'ofis', x: 0.15 },
  'tyo-3': { n: tk('Chuo-dori butikleri'), t: tk('Dükkânlar +%25'), kind: 'type', type: 'dukkan', x: 0.25 },
  'tyo-4': { n: tk('Arisugawa Parkı'), t: tk('Park cephesi (en alt sıra) +%30'), kind: 'row', x: 0.3 },
  'osa-0': { n: tk('Nagaya sıra evleri'), t: tk('Evler +%15'), kind: 'type', type: 'ev', x: 0.15 },
  'osa-1': { n: tk('İstasyon dönüşümü'), t: tk('İnşaatlar %25 hızlı'), kind: 'speed', x: 0.25 },
  'osa-2': { n: tk('Dotonbori lezzetleri'), t: tk('Kafeler +%25'), kind: 'type', type: 'kafe', x: 0.25 },
  'osa-3': { n: tk('Yeraltı çarşıları'), t: tk('Akıllı ikililer +%20'), kind: 'pair', x: 0.1 },
  'osa-4': { n: tk('Dojima kıyısı'), t: tk('Nehir kıyısı (en alt sıra) +%30'), kind: 'row', x: 0.3 },
  'kyo-0': { n: tk('Sake mahallesi'), t: tk('Evler +%20'), kind: 'type', type: 'ev', x: 0.2 },
  'kyo-1': { n: tk('Nishiki Pazarı'), t: tk('Dükkânlar +%25'), kind: 'type', type: 'dukkan', x: 0.25 },
  'kyo-2': { n: tk('Machiya ofisleri'), t: tk('Ofisler +%20'), kind: 'type', type: 'ofis', x: 0.2 },
  'kyo-3': { n: tk('Ahşap ustaları'), t: tk('Tadilat %20 ucuz'), kind: 'upDisc', x: 0.2 },
  'kyo-4': { n: tk('Hanamikoji sokağı'), t: tk('İnşaatlar %25 hızlı'), kind: 'speed', x: 0.25 },
};
