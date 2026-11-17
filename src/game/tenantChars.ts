/* =========================================================
   KİRACI KARAKTERLERİ — 15 şehir × 6 temel tip = 90 karakter (veri: tenantChars.data.ts, üretici scripts/kiracilar/gen.mjs).
   Mekanik temel tipe (Arch: kiraladığı bina türleri, istek türleri) dayanır; karakter şehre özgü ad, meslek, söz, istek
   ağırlıkları, portre ve bir kişilik (trait) ekler. Aynı ad farklı şehirde olabilir ama ülke içinde aynı tipin üç karakterinin
   kişiliği farklıdır; şehir içinde altı kişilik farklıdır (birim testi denetler).
   Kişiliğin kiraya etkisi: kira bonusu ve sözleşme süresi (bonus × süre temel %50 × 60 dk ile ±%5 aynı); kalanlar yalnız istek
   karışımını değiştirir. CFG.TEN_TRAITS ({ id: [yüzde, dakika] }, Remote Config) ile kodsuz ayarlanır.
   Bu modül arayüz ve durum (state) içe aktarmaz: state.ts sanitize, sim ve testler de kullanır.
   ========================================================= */
import { CFG, DMAP, BuildingType, CityId, DistrictKey } from '../config';
import type { Arch, WishKind, LateKind } from './tenants';
import { TRAITS as TRAIT_DATA, CHARS as CHAR_DATA } from './tenantChars.data';

export type TraitId = 'uyumlu' | 'sabirsiz' | 'sadik' | 'coskulu' | 'koklu' | 'gezgin' | 'titiz' | 'sosyal' | 'manzaraci' | 'huzurlu';
export type Country = 'tr' | 'us' | 'uk' | 'de' | 'jp';
/** Portre parametreleri (ui/tenantFace.ts): s ten 0–7 · h saç rengi · hs saç biçimi · c giysi · a aksesuarlar · g gözlük ·
 *  b sakal/bıyık · e küpe · hat başlık · age yaş. Aynı parametre → aynı SVG. */
export interface FaceParams { s: number; h: string; hs: string; c: string; a: string[]; g?: '' | 'round' | 'square'; b?: string; e?: number; hat?: string; age?: 'genc' | 'orta' | 'yasli' }
export interface TChar {
  id: string;             // "izm.emekli" (kayıtta Tenant.c)
  city: CityId; country: Country; a: Arch;
  n: string; fam?: true;  // özel ad (ja: scripts/names.json) · fam: soyadı, "{n} ailesi"
  r: string; q: string;   // meslek, kendi sözü (Türkçe kaynak; t() ile)
  trait: TraitId;
  wishes: [WishKind, number, BuildingType?][]; // ARCH[a].wishes yerine (toplam ağırlık tipinkine eşit: tipin gelme sıklığı aynı)
  late: [LateKind, number][];  // geç oyun (dolu/olgun semt) istekleri: ARCH[a].late × kişiliğin late çarpanları (toplam tipinkine eşit)
  sea?: number;           // kıyı/cephe sırası isteği ek çarpanı (manzara sever)
  look: FaceParams;
}
/** pct: kira bonusu (%) · min: sözleşme (dk) · wish: istek ağırlığı çarpanları · late: geç oyun istek çarpanları ·
 *  rare: defterde kartpostal (gezgin) */
export interface TTrait { pct: number; min: number; wish: Partial<Record<WishKind | 'sea', number>>; late: Partial<Record<LateKind, number>>; rare?: true; n: string; d: string }

export const TRAITS: Record<TraitId, TTrait> = TRAIT_DATA;
export const TRAIT_IDS = Object.keys(TRAITS) as TraitId[];
export const CHARS: readonly TChar[] = CHAR_DATA;
export const CHAR: Record<string, TChar> = Object.fromEntries(CHARS.map(c => [c.id, c]));
export const charsOf = (city: CityId) => CHARS.filter(c => c.city === city);

/** Simülasyon / deneme: karakterleri kapatır (eski tip tabanlı kiracı) ya da hepsini tek kişiliğe zorlar. Oyunda dokunulmaz. */
export const charOpts = { off: false, force: '' as TraitId | '' };

/** Semtin şehrine göre bu tipin karakteri. */
export function charFor(k: DistrictKey, a: Arch): TChar | null {
  if (charOpts.off) return null;
  const d = DMAP[k]; return (d && CHAR[d.city + '.' + a]) || null;
}
export const traitOf = (c: TChar | null | undefined): TraitId => (charOpts.force || (c ? c.trait : 'uyumlu')) as TraitId;

/* ---------- kira bonusu ve sözleşme süresi ---------- */
const BASE_PCT = 50, BASE_MIN = 60, PROD_TOL = 0.05;
/** Uzak ayar geçerli mi: [yüzde, dakika] sayı çifti, makul aralıkta ve bonus×süre temel ile ±%5. */
export function saneTraitPair(v: unknown): v is [number, number] {
  if (!Array.isArray(v) || v.length !== 2) return false;
  const [p, m] = v;
  if (typeof p !== 'number' || typeof m !== 'number' || !Number.isFinite(p) || !Number.isFinite(m)) return false;
  if (p < 10 || p > 150 || m < 15 || m > 180) return false;
  return Math.abs((p * m) / (BASE_PCT * BASE_MIN) - 1) <= PROD_TOL + 1e-9;
}
/** Remote Config değeri ({ id: [yüzde, dakika] } ya da onun JSON metni): bilinmeyen kişilik ve bozuk çift düşer. */
export function cleanTraitCfg(v: unknown): Record<string, [number, number]> | null {
  let o = v;
  if (typeof o === 'string') { try { o = JSON.parse(o); } catch { return null; } }
  if (!o || typeof o !== 'object' || Array.isArray(o)) return null;
  const out: Record<string, [number, number]> = {};
  for (const id of TRAIT_IDS) { const x = (o as Record<string, unknown>)[id]; if (saneTraitPair(x)) out[id] = [x[0], x[1]]; }
  return out;
}
/** Kişiliğin [yüzde, dakika] değeri (CFG.TEN_TRAITS varsa o). */
export function traitPM(id: TraitId): [number, number] {
  const o = CFG.TEN_TRAITS as Record<string, [number, number]> | undefined, T = TRAITS[id] || TRAITS.uyumlu;
  return o && saneTraitPair(o[id]) ? o[id] : [T.pct, T.min];
}
/** Temel değerlere (CFG.TEN_BONUS, CFG.TEN_LIVE) göre çarpanlar. */
function mult(id: TraitId): [number, number] {
  const [p, m] = traitPM(id);
  return [Math.min(3, Math.max(0.25, p / BASE_PCT)), Math.min(3, Math.max(0.25, m / BASE_MIN))];
}
/** Kiracının binasına kira bonusu (oran; 0,5 = +%50). */
export const bonusOf = (c: TChar | null | undefined) => CFG.TEN_BONUS * mult(traitOf(c))[0];
/** Sözleşme süresi (ms, oyun süresi). */
export const liveOf = (c: TChar | null | undefined) => Math.round(CFG.TEN_LIVE * mult(traitOf(c))[1]);
/** En uzun sözleşme (kayıt doğrulamasının tavanı: Köklü 86 dk). */
export const maxLive = () => Math.max(...TRAIT_IDS.map(id => Math.round(CFG.TEN_LIVE * mult(id)[1])));
