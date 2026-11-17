/* =========================================================
   KİRACILAR — binalara ara ara karakterli kiracı adayları gelir; her birinin küçük bir isteği var.
   İstek karşılanınca arsada anahtar belirir; oyuncu bir kez dokununca kiracı yerleşir: o bina sözleşme boyunca
   +CFG.TEN_BONUS kira getirir (economy.ts tenantMult). Karşılanmazsa süre sonunda gider: ceza yok, yalnızca bonus kaçar.
   İstekler mevcut mekaniklere bağlı: komşuluk / akıllı ikili, kat, sahil sırası (semt kuralı).
   Saatler oyun süresiyle (S.playMs) işler: oyuncu yokken kimse gelmez, kimse gitmez, sözleşme de azalmaz.
   Her şehrin 6 tipten birer karakteri var (game/tenantChars.ts: 15 şehir × 6 = 90): ad, meslek, söz, istek ağırlıkları, portre
   ve kişilik. Kişilik kira bonusunu ve sözleşme süresini değiştirir (bonus × süre aynı kalır); kayıtta Tenant.c.
   Bu modül arayüz içe aktarmaz (simülasyon da kullanır); arayüz geri çağrıları tenantHooks ile kaydedilir (ui/sheets/tenant.ts).
   Geç oyun (dolu ve olgun semt): boş arsa ve kat kalmayınca eski istekler çıkmaz; o semtte dört yeni istek açılır (LATE_KINDS):
   proje (uygun 2×2'yi projeye dönüştür / projenin 2. etabı), köşe başı (ihale ödülü damgalı arsa), cephe rengi (oyuncunun açık
   renklerinden) ve yenileme (Sv5 binada küçük bedel + kısa süre kira yok). Yalnız geç oyunda (bir ilin son semti dolu), olgun
   semtte (dolu, Sv5 payı ≥ CFG.TEN_LATE_LV) ve hiçbir semtte eski türden aday çıkmıyorsa; erken oyun aynen kalır
   (scripts/sim.ts SIM_TEN=table ve tek koşular birebir).
   ========================================================= */
import { CFG, COLS, ROWS, N, DRULES, DMAP, REGIONS, CITIES, CITY_ORDER, ORDER, MAXLV, BuildingType, DistrictKey, CityId } from '../config';
import { S, lotsOf, Lot, Pj } from '../state';
import { neighbors, buildCost, buildTime, upCost, upTime, withDisc, producing, totalRate, PAIRS, isFull, pjOf, pjCells, baseRate } from '../economy';
import { koseOf } from './auccore';
import { SKIN_COLORS, COUNTRY_SKIN, skinShown, skinUnlocked } from './skins';
import { t, tk, nm, lowTxt, pctTxt } from '../i18n';
import { charFor, charOpts, CHAR, CHARS, TRAITS, bonusOf, liveOf, TChar, Country } from './tenantChars';
export type { Country };

export type Arch = 'ogrenci' | 'aile' | 'sanatci' | 'yazilimci' | 'emekli' | 'esnaf';
export const ARCHS: readonly Arch[] = ['ogrenci', 'aile', 'sanatci', 'yazilimci', 'emekli', 'esnaf'];
/** Geç oyun istekleri (dolu/olgun semt): proj · kose · paint · renov. */
export type LateKind = 'proj' | 'kose' | 'paint' | 'renov';
export const LATE_KINDS: readonly LateKind[] = ['proj', 'kose', 'paint', 'renov'];
export type WishKind = 'nb' | 'quiet' | 'lvl' | 'new' | LateKind;
export const WISH_KINDS: readonly WishKind[] = ['nb', 'quiet', 'lvl', 'new', ...LATE_KINDS];
export const isLate = (k: WishKind): k is LateKind => (LATE_KINDS as readonly string[]).includes(k);
/** nb: yanında t türü bina · quiet: yanında ev, ofis olmasın · lvl: en az n. kat · new: bu boş arsaya t türü bina (sea: sahil sırası) ·
 *  proj: bu bina projeye girsin (n = 1) / projenin 2. etabı (n = 2) · kose: köşe başı arsada (Sv5) oturmak · paint: bu binanın cephesi
 *  c rengi (SKIN_COLORS sırası) · renov: Sv5 binayı yenile (bedel + kısa süre kira yok; bitişi Tenant.rv) */
export interface Wish { k: WishKind; t?: BuildingType; n?: number; sea?: boolean; c?: number }
export type TenantSt = 'wait' | 'ready' | 'live';
/** dl: bekleme / anahtar teslimi bitişi · end: sözleşme bitişi (ikisi de oyun süresi, S.playMs ms) · noted: Rıfkı hatırlattı ·
 *  c: karakter kimliği ("izm.emekli"; eski kayıtta yok → semtin şehrinin aynı tipteki karakteri) */
export interface Tenant { id: number; a: Arch; k: DistrictKey; i: number; w: Wish; dl: number; st: TenantSt; end: number; noted?: boolean; c?: string; rv?: number }
export interface TDef { met: number; ok: number }
/** Kiracının karakteri (c yoksa — eski kayıt — semtin şehrinin aynı tipteki karakteri). */
export const charOfT = (x: Pick<Tenant, 'a' | 'k' | 'c'>): TChar | null => (x.c && !charOpts.off && CHAR[x.c]) || charFor(x.k, x.a);

/** Kiracı tipleri: kiraladığı bina türleri, istek havuzu [tür, ağırlık, bina] ve geç oyun havuzu [tür, ağırlık] (toplam 4;
 *  scripts/kiracilar/gen.mjs LATE ile aynı). "Sessiz komşu" (quiet) bilerek seyrek. */
export const ARCH: Record<Arch, { rents: BuildingType[]; wishes: [WishKind, number, BuildingType?][]; late: [LateKind, number][] }> = {
  ogrenci: { rents: ['ev'], wishes: [['nb', 3, 'kafe'], ['lvl', 1], ['new', 1, 'ev']], late: [['paint', 1.5], ['renov', 1], ['proj', 1], ['kose', 0.5]] },
  aile: { rents: ['ev'], wishes: [['nb', 3, 'dukkan'], ['lvl', 2], ['new', 1, 'ev']], late: [['proj', 1.5], ['renov', 1], ['paint', 1], ['kose', 0.5]] },
  sanatci: { rents: ['ev', 'kafe'], wishes: [['lvl', 2], ['new', 2, 'ev']], late: [['paint', 2], ['renov', 1], ['proj', 0.5], ['kose', 0.5]] },
  yazilimci: { rents: ['ofis', 'ev'], wishes: [['nb', 3, 'kafe'], ['lvl', 1], ['new', 1, 'ofis']], late: [['proj', 1.5], ['renov', 1], ['paint', 1], ['kose', 0.5]] },
  emekli: { rents: ['ev'], wishes: [['new', 2, 'ev'], ['nb', 1.5, 'kafe'], ['quiet', 0.5]], late: [['renov', 1.5], ['paint', 1], ['proj', 0.5], ['kose', 1]] },
  esnaf: { rents: ['dukkan', 'kafe'], wishes: [['nb', 3], ['nb', 1, 'dukkan'], ['new', 1, 'dukkan']], late: [['kose', 2], ['proj', 1], ['renov', 0.5], ['paint', 0.5]] }, // nb (bina yok) = akıllı ikili eşi
};
/** Geç oyun havuzu: karakterinki (yoksa tipinki); simülasyonda kişilik zorlanırsa tipin havuzuna o kişiliğin late çarpanları. */
function lateOf(a: Arch, ch: TChar | null): [LateKind, number][] {
  if (!ch) return ARCH[a].late;
  if (!charOpts.force) return ch.late;
  const T = TRAITS[charOpts.force], base = ARCH[a].late, tot = base.reduce((v, w) => v + w[1], 0);
  const w = base.map(([k, n]) => [k, n * (T.late[k] || 1)] as [LateKind, number]), f = tot / w.reduce((v, x) => v + x[1], 0);
  return w.map(([k, n]) => [k, n * f]);
}

/** Karakterin istek havuzu (karakter yoksa tipinki). Simülasyonda kişilik zorlanırsa tipin havuzuna o kişiliğin ağırlıkları uygulanır. */
function wishesOf(a: Arch, ch: TChar | null): [WishKind, number, BuildingType?][] {
  if (!ch) return ARCH[a].wishes;
  if (!charOpts.force) return ch.wishes;
  const T = TRAITS[charOpts.force], base = ARCH[a].wishes, tot = base.reduce((v, w) => v + w[1], 0);
  let w = base.map(([k, n, b]) => [k, n * (T.wish[k] || 1), b] as [WishKind, number, BuildingType?]);
  if (T.wish.quiet && !w.some(x => x[0] === 'quiet') && ARCH[a].rents.includes('ev')) w.push(['quiet', 0.5]);
  const f = tot / w.reduce((v, x) => v + x[1], 0); w = w.map(([k, n, b]) => [k, n * f, b]); return w;
}
const seaOf = (ch: TChar | null) => (charOpts.force ? TRAITS[charOpts.force].wish.sea || 1 : (ch && ch.sea) || 1);

/* ---------- ülkeye göre adlar: bölgedeki şehrin ülkesi (Global'de semtin şehri hangi ülkedeyse) ----------
   Oyunda ad ve meslek karakterden gelir (game/tenantChars.ts); NAMES yalnız karakteri olmayan kiracı için (simülasyon). */
export const COUNTRIES: readonly Country[] = ['tr', 'us', 'uk', 'de', 'jp'];
const CITY_COUNTRY: Record<CityId, Country> = Object.fromEntries(COUNTRIES.flatMap(c => REGIONS[c].cities.map(city => [city, c])));
export const countryOf = (k: DistrictKey): Country => (DMAP[k] && CITY_COUNTRY[DMAP[k].city]) || 'tr';
/** n: özel ad (ja için scripts/names.json, nm() ile) · r: meslek (çevrilir) · fam: n soyadıdır, "{n} ailesi" diye yazılır */
interface TName { n: string; r: string; fam?: true }
const R_STU = tk('üniversite öğrencisi'), R_FAM = tk('iki çocuklu aile'), R_DEV = tk('yazılımcı');
export const NAMES: Record<Country, Record<Arch, TName>> = {
  tr: { ogrenci: { n: 'Ece', r: R_STU }, aile: { n: 'Yılmaz', r: R_FAM, fam: true }, sanatci: { n: 'Deniz', r: tk('ressam') }, yazilimci: { n: 'Kaan', r: R_DEV }, emekli: { n: 'Nevin Teyze', r: tk('emekli öğretmen') }, esnaf: { n: 'Hüseyin Usta', r: tk('mahalle esnafı') } },
  us: { ogrenci: { n: 'Maya', r: R_STU }, aile: { n: 'Garcia', r: R_FAM, fam: true }, sanatci: { n: 'Jules', r: tk('ressam') }, yazilimci: { n: 'Dev', r: R_DEV }, emekli: { n: 'Mr Walker', r: tk('emekli postacı') }, esnaf: { n: 'Tony', r: tk('şarküteri sahibi') } },
  uk: { ogrenci: { n: 'Olivia', r: R_STU }, aile: { n: 'Patel', r: R_FAM, fam: true }, sanatci: { n: 'Theo', r: tk('illüstratör') }, yazilimci: { n: 'Priya', r: R_DEV }, emekli: { n: 'Mrs Hughes', r: tk('emekli kütüphaneci') }, esnaf: { n: 'Mr Okafor', r: tk('köşe bakkalı') } },
  de: { ogrenci: { n: 'Lena', r: R_STU }, aile: { n: 'Schneider', r: R_FAM, fam: true }, sanatci: { n: 'Jonas', r: tk('fotoğrafçı') }, yazilimci: { n: 'Mert', r: R_DEV }, emekli: { n: 'Frau Weber', r: tk('emekli öğretmen') }, esnaf: { n: 'Herr Becker', r: tk('fırıncı') } },
  jp: { ogrenci: { n: 'Yui', r: R_STU }, aile: { n: 'Tanaka', r: R_FAM, fam: true }, sanatci: { n: 'Ren', r: tk('seramik sanatçısı') }, yazilimci: { n: 'Sōta', r: R_DEV }, emekli: { n: 'Satō-san', r: tk('emekli çiçekçi') }, esnaf: { n: 'Kimura-san', r: tk('tofu ustası') } },
};
/** Karakterin görünen adı ve mesleği. */
export const charName = (e: TName | TChar): [string, string] => [e.fam ? t('{n} ailesi', { n: nm(e.n) }) : nm(e.n), t(e.r)];
/** Kiracının görünen adı ve mesleği (semtin şehrinin karakteri; yoksa ülkeye göre eski ad). */
export function tName(a: Arch, k: DistrictKey = S.cur): [string, string] {
  return charName(charFor(k, a) || NAMES[countryOf(k)][a]);
}

/** Arayüz geri çağrıları (ui/sheets/tenant.ts kaydeder; simülasyonda boş). */
export const tenantHooks = {
  arrive: (_x: Tenant) => {}, ready: (_x: Tenant) => {}, note: (_x: Tenant) => {}, settle: (_x: Tenant) => {}, leave: (_x: Tenant) => {}, end: (_x: Tenant) => {},
  renov: (_x: Tenant) => {},
};

/* ---------- hedef dışı arsalar: projelere (arsa birleştirme) ayrılan arsalar kiracı hedefi olmaz ----------
   excludeTenantLots((k, i) => …) ile koşul eklenir; böyle bir arsada kiracı doğmaz, komşu isteği oraya yönelmez.
   keep = false: sonradan hedef dışı kalan arsadaki aday da sessizce (bildirim olmadan) çekilir.
   keep = true (projeler): yalnızca yeni hedef seçimi etkilenir; arsadaki mevcut kiracıyı kaydı açan modül kendisi ele alır
   (game/project.ts: birleşmede yerleşik kiracı projede kalır, anahtar bekleyen yerleşir; sessizce düşen olmaz).
   Yerleşmiş kiracı (sözleşme sürerken) hiçbir koşulda düşürülmez. */
const excludes: { f: (k: DistrictKey, i: number) => boolean; keep: boolean }[] = [];
export function excludeTenantLots(f: (k: DistrictKey, i: number) => boolean, keep = false): () => void {
  const e = { f, keep }; excludes.push(e); return () => { const j = excludes.indexOf(e); if (j >= 0) excludes.splice(j, 1); };
}
export const lotExcluded = (k: DistrictKey, i: number) => excludes.some(e => e.f(k, i));
const lotDropped = (k: DistrictKey, i: number) => excludes.some(e => !e.keep && e.f(k, i));

const isBottom = (i: number) => Math.floor(i / COLS) === ROWS - 1;
const seaDistrict = (k: DistrictKey) => { const r = DRULES[k]; return !!r && r.kind === 'row'; };
const built = (q: Lot) => !!q && !q.sp && !q.ob && q.lvl >= 1;

export const tenants = (): Tenant[] => (S.ten || (S.ten = []));
export const tenantAt = (k: DistrictKey, i: number) => tenants().find(x => x.k === k && x.i === i) || null;
/** Komşu isteğinin gideceği boş arsalar (hedef dışı arsalar hariç). */
const freeNb = (x: { k: DistrictKey; i: number }) => { const lots = lotsOf(S, x.k); return neighbors(x.i).filter(j => !lots[j] && !lotExcluded(x.k, j)); };
/** Bekleyen kiracıların istediği boş arsalar (komşu isteği): tahtada kesik çizgiyle gösterilir. */
export function wishTargets(k: DistrictKey): Map<number, Tenant> {
  const m = new Map<number, Tenant>();
  for (const x of tenants()) if (x.k === k && x.st === 'wait' && (x.w.k === 'nb' || x.w.k === 'quiet')) for (const j of freeNb(x)) if (!m.has(j)) m.set(j, x);
  return m;
}
/** İstenen bina türü (komşu / yeni bina isteği). */
export const wishType = (x: Tenant): BuildingType | undefined => (x.w.k === 'quiet' ? 'ev' : x.w.t);
/** İsteği karşılamak için gidilecek arsa (komşu isteği: ilk uygun boş komşu). */
export function targetLot(x: Tenant): number {
  if (x.w.k === 'nb' || x.w.k === 'quiet') { const f = freeNb(x); return f.length ? f[0] : x.i; }
  return x.i;
}

/* ---------- geç oyun: proje, köşe başı, cephe rengi, yenileme ---------- */
/** Büyük proje kuralları: game/projcore.ts kaydeder (döngüsel içe aktarma olmasın diye; kayıt yokken proje isteği çıkmaz).
 *  blocks: uygun 2×2'lerin sol üst arsası · list: semtin projeleri · cost: etap bedeli. */
export const tenantPj = {
  blocks: (_k: DistrictKey, _i?: number): number[] => [],
  list: (_k: DistrictKey): Pj[] => [],
  cost: (_k: DistrictKey, _a: number, _st?: number): number => Infinity,
};
/** Olgun semt: dolu ve binaların en az CFG.TEN_LATE_LV payı en üst katta (Sv5). */
export function mature(k: DistrictKey): boolean {
  if (!isFull(k)) return false;
  const L = lotsOf(S, k).filter(p => !!p && !p.sp && !p.ob);
  return L.length > 0 && L.filter(p => p!.lvl >= MAXLV).length / L.length >= CFG.TEN_LATE_LV;
}
/** Tiplerin sevdiği cephe renkleri (SKIN_COLORS sırası); önce semtin ülke rengi, sonra bunlar, sonra açık olan herhangi biri. */
const PAINT: Record<Arch, number[]> = { ogrenci: [2, 6, 3], aile: [0, 3, 1], sanatci: [7, 6, 4], yazilimci: [5, 3, 2], emekli: [1, 0, 2], esnaf: [9, 4, 0] };
/** Kiracının bu binaya isteyeceği renk: oyuncuda açık, bölgede görünen ve binanın şimdiki renginden farklı (yoksa -1). */
export function paintFor(a: Arch, k: DistrictKey, p: Lot): number {
  const cur = p && p.sk ? p.sk.c : undefined;
  for (const c of [COUNTRY_SKIN[countryOf(k)], ...PAINT[a], ...SKIN_COLORS.map((_, n) => n)]) if (c !== cur && SKIN_COLORS[c] && skinShown(c) && skinUnlocked(c)) return c;
  return -1;
}
/** Yenileme bedeli: binanın şimdiki taban kirasının CFG.TEN_RV_FEE_SEC saniyesi. */
export const renovFee = (k: DistrictKey, i: number) => baseRate(k, i) * CFG.TEN_RV_FEE_SEC;
/** Yenileme süresi (ms, oyun süresi): binanın son kat (Sv4→5) süresinin CFG.TEN_RV_PCT payı, 1 dk ile TEN_TIME_MAX arası. */
export function renovMs(k: DistrictKey, i: number): number {
  const p = lotsOf(S, k)[i]; if (!p || p.sp) return 0;
  const up = upTime(k, { t: p.t, lvl: MAXLV - 1, buf: 0, until: 0, dur: 1, up: false });
  return Math.round(Math.min(CFG.TEN_TIME_MAX, Math.max(60e3, up * CFG.TEN_RV_PCT)));
}
/** Yenilemeyi başlatır (oyuncunun dokunuşu): bedel kasadan, bina süre boyunca kira vermez (economy.ts renovating), sonra anahtar. */
export function startRenov(x: Tenant): boolean {
  if (x.w.k !== 'renov' || x.st !== 'wait' || x.rv != null || !satisfiable(x)) return false;
  const f = renovFee(x.k, x.i); if (!(S.cash >= f)) return false;
  S.cash -= f; x.rv = S.playMs + renovMs(x.k, x.i); tenantHooks.renov(x); return true;
}
/** Geç oyun isteği hâlâ karşılanabilir mi (proje bloğu başka projeye gitti, ruhsat doldu, köşe başı damgası yok, renk kilitli…). */
function satisfiable(x: Tenant): boolean {
  const p = lotsOf(S, x.k)[x.i];
  switch (x.w.k) {
    case 'proj': { const q = pjOf(x.k, x.i); return q ? (x.w.n || 1) <= 1 || q.st >= 1 : (x.w.n || 1) <= 1 && tenantPj.blocks(x.k, x.i).length > 0; }
    case 'kose': return koseOf(x.k) === x.i;
    case 'paint': return x.w.c != null && !!SKIN_COLORS[x.w.c] && skinUnlocked(x.w.c);
    case 'renov': return !!p && !p.sp && (p.lvl >= MAXLV || x.rv != null);
    default: return true;
  }
}

/* ---------- istek durumu ---------- */
export function satisfied(x: Tenant): boolean {
  const lots = lotsOf(S, x.k), p = lots[x.i];
  switch (x.w.k) {
    case 'proj': { const q = pjOf(x.k, x.i); return !!q && q.st >= (x.w.n || 1); }
    case 'kose': return koseOf(x.k) === x.i && producing(p) && !p.sp && p.lvl >= MAXLV;
    case 'paint': return !!p && !!p.sk && p.sk.c === x.w.c;
    case 'renov': return x.rv != null && S.playMs >= x.rv && producing(p);
    case 'nb': return neighbors(x.i).some(j => { const q = lots[j]; return built(q) && q!.t === x.w.t; });
    case 'quiet': { const nb = neighbors(x.i).map(j => lots[j]); return nb.some(q => built(q) && q!.t === 'ev') && !nb.some(q => q && !q.sp && q.t === 'ofis'); }
    case 'lvl': return !!p && !p.sp && p.lvl >= x.w.n!;
    case 'new': return !!p && !p.sp && !p.ob && p.t === x.w.t && p.lvl >= 1;
  }
}
/** İsteği karşılayacak bir inşaat sürüyor mu (bekleme durur: "usta çalışıyor"). */
export function inProgress(x: Tenant): boolean {
  const lots = lotsOf(S, x.k), p = lots[x.i];
  switch (x.w.k) {
    case 'nb': case 'quiet': return neighbors(x.i).some(j => { const q = lots[j]; return !!q && !!q.until && q.lvl === 0 && q.t === wishType(x); });
    case 'lvl': return !!p && !!p.until && p.up && p.lvl + 1 >= x.w.n!;
    case 'new': return !!p && !!p.until && p.t === x.w.t;
    case 'proj': { const q = pjOf(x.k, x.i); return !!q && !!q.until && q.st + 1 >= (x.w.n || 1); }
    case 'renov': return x.rv != null && S.playMs < x.rv;
    default: return false;
  }
}
/** Kiracının binası hâlâ yerinde mi (yıkıldı, türü değişti, semt elden çıktı ya da aday arsası hedef dışı kaldıysa sessizce çekilir). */
function valid(x: Tenant): boolean {
  if (!S.own.includes(x.k) || (x.st !== 'live' && lotDropped(x.k, x.i))) return false;
  const p = lotsOf(S, x.k)[x.i];
  if (x.w.k === 'new' && x.st === 'wait') return !p || (!p.sp && !p.ob && p.t === x.w.t);
  return !!p && !p.sp && !p.ob && ARCH[x.a].rents.includes(p.t) && (p.lvl >= 1 || !!p.until);
}

/* ---------- aday üretimi ---------- */
interface Cand { a: Arch; i: number; w: Wish; wt: number }
const budget = () => Math.max(0, S.cash) + totalRate(false) * CFG.TEN_AFFORD_SEC;
/** Bu semtte şu an karşılanmamış, ödenebilir ve kısa sürede yapılabilir istekler (kiracı imkânsız bir şey istemez). */
export function candidates(k: DistrictKey): Cand[] {
  const lots = lotsOf(S, k), out: Cand[] = [], r = DRULES[k], money = budget();
  const taken = new Set(tenants().filter(x => x.k === k).map(x => x.i));
  for (const j of wishTargets(k).keys()) taken.add(j);
  const okBuild = (t: BuildingType) => !!S.seen[t] && withDisc(buildCost(k, t)) <= money && buildTime(k, t) <= CFG.TEN_TIME_MAX;
  // Semt düzeniyle uyum: "yeni bina" isteği, yanında daha üst türden bina (kafe, dükkân, ofis) olan boş arsaya alt tür (ör. ev) istemez.
  // Yoksa kiracı, büyüyen kafe/ofis kümesinin arsasını kalıcı olarak düşük kiralı bir binaya bağlatırdı (yalnız yıkıp yeniden kurarak
  // düzelir; geç oyunda kira düşüşü buydu — scripts/sim.ts SIM_PJ=table SIM_PJ_ONCE=1). Kat ve komşu istekleri etkilenmez.
  const upNear = (i: number, t: BuildingType) => !tenantSim.noFit && neighbors(i).some(j => { const q = lots[j]; return !!q && !q.sp && !q.ob && ORDER.indexOf(q.t) > ORDER.indexOf(t); });
  // semt kuralı: o türün kiracısı ×2 · sahil sırası: deniz isteği ×3 · akıllı ikili: komşu isteği ×2 · ucuz tadilat: kat isteği ×2 · hızlı inşaat: yeni bina ×2
  const typeW = (t: BuildingType) => (r && r.kind === 'type' && r.type === t ? 2 : 1);
  for (const a of ARCHS) {
    const A = ARCH[a], ch = charFor(k, a), sm = seaOf(ch);
    for (const [kind, w0, wt0] of wishesOf(a, ch)) {
      for (let i = 0; i < N; i++) {
        if (taken.has(i) || lotExcluded(k, i)) continue;
        const p = lots[i];
        if (kind === 'new') {
          if (p) continue; const t = wt0!; if (!okBuild(t) || upNear(i, t)) continue;
          const sea = seaDistrict(k) && isBottom(i);
          if (seaDistrict(k) && !sea && (a === 'emekli' || a === 'sanatci')) continue; // sahil semtinde bu tipler yalnız sahil sırası ister
          out.push({ a, i, w: { k: 'new', t, ...(sea ? { sea } : {}) }, wt: w0 * typeW(t) * (sea ? 3 * sm : 1) * (r && r.kind === 'speed' ? 2 : 1) * 0.5 });
          continue;
        }
        if (!producing(p) || p.sp || p.ob || !A.rents.includes(p.t)) continue;
        const base = w0 * typeW(p.t), nb = neighbors(i), free = freeNb({ k, i });
        if (kind === 'nb') {
          const t = wt0 || PAIRS[p.t]; if (!okBuild(t)) continue;
          if (nb.some(j => { const q = lots[j]; return !!q && !q.sp && q.t === t; })) continue; // zaten var / yapılıyor
          if (!free.length) continue;                                                          // boş komşu yok: karşılanamaz
          out.push({ a, i, w: { k: 'nb', t }, wt: base * (r && r.kind === 'pair' ? 2 : 1) });
        } else if (kind === 'quiet') {
          if (!okBuild('ev') || !free.length) continue;
          if (nb.some(j => { const q = lots[j]; return !!q && !q.sp && (q.t === 'ofis' || q.t === 'ev'); })) continue;
          out.push({ a, i, w: { k: 'quiet' }, wt: base });
        } else if (kind === 'lvl') {
          if (p.lvl >= 5) continue;
          if (a === 'sanatci' && p.lvl < 2) continue; // atölye ışık ister: en az 3. kat (yine tek kat)
          if (withDisc(upCost(k, p)) > money || upTime(k, p) > CFG.TEN_TIME_MAX) continue;
          out.push({ a, i, w: { k: 'lvl', n: p.lvl + 1 }, wt: base * (r && r.kind === 'upDisc' ? 2 : 1) });
        }
      }
    }
  }
  return out;
}
/** Geç oyun: bir ilin son semti (ör. Bebek) alınmış ve dolu, yani bir il baştan sona tamamlanmış. Tapu beklemesindeki (duvar)
 *  dolu semtler bunu tetiklemez: orta oyun aynen kalır. */
export const lateGame = () => S.own.some(k => { const d = DMAP[k]; return !!d && d.idx === CITIES[d.city].districts.length - 1 && isFull(k); });
/** Geç oyun adayları: geç oyunda ve olgun semtte. spawnTenant bunlara yalnız hiçbir semtte eski türden aday çıkmayınca bakar:
 *  erken oyun (ve onun rastgele sayı dizisi) aynen kalır. */
export function lateCandidates(k: DistrictKey): Cand[] {
  if (tenantSim.noLate || !lateGame()) return [];
  if (!mature(k)) return [];
  const taken = new Set(tenants().filter(x => x.k === k).map(x => x.i));
  for (const j of wishTargets(k).keys()) taken.add(j);
  return lateCands(k, taken, budget());
}
/** Geç oyun adayları. Ağırlık: türün payı (w0) adayların sayısına bölünür (tür sıklığı arsa sayısından bağımsız);
 *  semt kuralı: o türün kiracısı ×2 · ucuz tadilat: yenileme ×2 · kıyı/cephe sırası semti: köşe başı ×1,5. */
function lateCands(k: DistrictKey, taken: Set<number>, money: number): Cand[] {
  const lots = lotsOf(S, k), out: Cand[] = [], r = DRULES[k], pjMoney = Math.max(0, S.cash) + totalRate(false) * CFG.TEN_PJ_AFFORD_SEC;
  const rented = (a: Arch, j: number) => { const p = lots[j]; return producing(p) && !p.sp && !p.ob && ARCH[a].rents.includes(p.t); };
  const free = (j: number) => !taken.has(j) && !lotExcluded(k, j);
  // proje: uygun 2×2 (1. etap) ya da teslim edilmiş projenin 2. etabı; dört arsasında başka kiracı yoksa. Projeye dönüşecek arsalar
  // eski isteklerin hedefi değildir (projcore pjReserved); bu istek tam da onları ister.
  const pjOpts: [number[], number][] = [];
  for (const q of tenantPj.list(k)) if (q.st === 1 && !q.until && tenantPj.cost(k, q.a, 2) <= pjMoney) pjOpts.push([pjCells(q.a), 2]);
  for (const b of tenantPj.blocks(k)) if (tenantPj.cost(k, b, 1) <= pjMoney) pjOpts.push([pjCells(b), 1]);
  const ko = koseOf(k);
  for (const a of ARCHS) {
    for (const [kind, w0] of lateOf(a, charFor(k, a))) {
      const L: Cand[] = [];
      if (kind === 'proj') {
        for (const [cells, n] of pjOpts) { if (cells.some(j => taken.has(j))) continue; const j = cells.find(j => rented(a, j)); if (j != null) L.push({ a, i: j, w: { k: 'proj', n }, wt: 0 }); }
      } else if (kind === 'kose') {
        if (ko >= 0 && free(ko) && rented(a, ko) && lots[ko]!.lvl >= MAXLV) L.push({ a, i: ko, w: { k: 'kose' }, wt: 0 });
      } else for (let i = 0; i < N; i++) {
        if (!free(i) || !rented(a, i)) continue;
        const p = lots[i]!;
        if (kind === 'paint') { const c = paintFor(a, k, p); if (c >= 0) L.push({ a, i, w: { k: 'paint', c }, wt: 0 }); }
        else if (p.lvl >= MAXLV && renovFee(k, i) <= money) L.push({ a, i, w: { k: 'renov' }, wt: 0 });
      }
      for (const c of L) {
        const ty = lots[c.i]!.t;
        c.wt = (w0 / L.length) * (r && r.kind === 'type' && r.type === ty ? 2 : 1) * (kind === 'renov' && r && r.kind === 'upDisc' ? 2 : 1) * (kind === 'kose' && r && r.kind === 'row' ? 1.5 : 1);
        out.push(c);
      }
    }
  }
  return out;
}
/** Yalnız simülasyon (scripts/sim.ts "önce" ölçümü): semt düzeni uyum kuralını kapatır. Oyunda dokunulmaz. */
export const tenantSim = { noFit: false, noLate: false };
let lastA: Arch | null = null;
/** Bellekteki geçici durumu sıfırlar (simülasyonda her koşu, testlerde her vaka başında). */
export function tenantReset() { lastA = null; }
/** Yeni aday: önce ekrandaki semt, olmazsa sahip olunan diğer semtler (yeniden eskiye). Aynı tip art arda gelmez. */
export function spawnTenant(rnd: () => number = Math.random): Tenant | null {
  const L = tenants(), order = [S.cur, ...S.own.filter(k => k !== S.cur).reverse()];
  // önce eski türler (her semtte); hiçbiri yoksa geç oyun istekleri (olgun / dolu semtlerde)
  for (const [k, late] of [...order.map(k => [k, false] as const), ...order.map(k => [k, true] as const)]) {
    const cs = late ? lateCandidates(k) : candidates(k); if (!cs.length) continue;
    const recent = new Set<Arch>(L.map(x => x.a)); if (lastA) recent.add(lastA);
    const pool = cs.filter(c => !recent.has(c.a)), list = pool.length ? pool : cs;
    let sum = 0; for (const c of list) sum += c.wt;
    let r = rnd() * sum, pick = list[list.length - 1];
    for (const c of list) { r -= c.wt; if (r <= 0) { pick = c; break; } }
    const id = Math.max(Math.floor(S.playMs / 1000), ...L.map(x => x.id)) + 1;
    const x: Tenant = { id, a: pick.a, k, i: pick.i, w: pick.w, dl: S.playMs + CFG.TEN_WAIT, st: 'wait', end: 0 };
    const ch = charFor(k, pick.a); if (ch) x.c = ch.id;
    L.push(x); lastA = x.a;
    const d = S.tdef || (S.tdef = {}); (d[x.a] || (d[x.a] = { met: 0, ok: 0 })).met++;
    if (ch) { const dc = S.tdc || (S.tdc = {}); (dc[ch.id] || (dc[ch.id] = { met: 0, ok: 0 })).met++; }
    return x;
  }
  return null;
}
/** Anahtar teslimi (oyuncunun tek dokunuşu): kiracı yerleşir, sözleşme başlar. */
export function handKey(x: Tenant): boolean {
  if (x.st !== 'ready' || !satisfied(x)) return false;
  const ch = charOfT(x);
  x.st = 'live'; x.end = S.playMs + liveOf(ch);
  const d = S.tdef || (S.tdef = {}); (d[x.a] || (d[x.a] = { met: 1, ok: 0 })).ok++;
  if (ch) { const dc = S.tdc || (S.tdc = {}); (dc[ch.id] || (dc[ch.id] = { met: 1, ok: 0 })).ok++; }
  tenantHooks.settle(x); return true;
}
export const tenantsOpen = () => S.earned >= CFG.TEN_UNLOCK_EARN && S.own.some(k => lotsOf(S, k).filter(producing).length >= CFG.TEN_UNLOCK_PROD);
/** Kiracı defteri: müdavim pulu alan tip sayısı (6'sı "Kiracı yeşili" cephe rengini açar; kiraya etkisi yok). */
export const stampsOf = (d: Record<string, TDef> | undefined = S.tdef) => ARCHS.filter(a => ((d && d[a] && d[a].ok) || 0) >= Math.max(1, Math.floor(CFG.TEN_STAMP))).length;

/* ---------- karakter defteri (S.tdc; yalnız koleksiyon, kiraya etkisi yok) ----------
   Karakter pulu: bir kez yerleşince · şehir rozeti: şehrin 6 karakteri de yerleşince · ülke cephe rengi: ülkenin bu bölgedeki
   tüm şehirlerinin rozeti (Türkiye bölgesinde 3, Global'de ülkenin tek şehri) · kartpostal: gezgin karakter yerleşince. */
export const charOk = (id: string, d: Record<string, TDef> | undefined = S.tdc) => ((d && d[id] && d[id].ok) || 0) > 0;
export const charMet = (id: string, d: Record<string, TDef> | undefined = S.tdc) => !!d && !!d[id] && (d[id].met > 0 || d[id].ok > 0);
/** Şehirde yerleşmiş karakter sayısı (0–6). */
export const cityCount = (city: CityId, d: Record<string, TDef> | undefined = S.tdc) => CHARS.filter(c => c.city === city && charOk(c.id, d)).length;
export const cityBadge = (city: CityId, d: Record<string, TDef> | undefined = S.tdc) => cityCount(city, d) >= ARCHS.length;
/** Ülkenin bölgedeki şehirleri (Global'de tek şehir). */
export const countryCities = (c: Country, cities: readonly CityId[] = CITY_ORDER) => cities.filter(city => CITY_COUNTRY[city] === c);
/** Ülke cephe rengi: ülkenin bu bölgedeki tüm şehirlerinde rozet. Bölgede o ülkenin şehri yoksa kazanılamaz. */
export function countryDone(c: Country, d: Record<string, TDef> | undefined = S.tdc, cities: readonly CityId[] = CITY_ORDER): boolean {
  const L = countryCities(c, cities); return L.length > 0 && L.every(city => cityBadge(city, d));
}
/** Kartpostallar: yerleşmiş gezgin karakterler. */
export const postcards = (d: Record<string, TDef> | undefined = S.tdc) => CHARS.filter(c => TRAITS[c.trait].rare && charOk(c.id, d));

/** Oyun döngüsünden (ve simülasyondan) çağrılır. dt: oyun süresi adımı (ms; S.playMs zaten ilerletilmiş). */
export function tenantTick(dt: number, rnd: () => number = Math.random) {
  const L = tenants();
  for (let n = L.length - 1; n >= 0; n--) {
    const x = L[n];
    if (!valid(x)) { L.splice(n, 1); continue; }
    if (x.st !== 'live' && !satisfiable(x) && !satisfied(x)) { L.splice(n, 1); tenantHooks.leave(x); continue; } // geç oyun isteği artık olamaz
    if (x.st === 'wait') {
      if (satisfied(x)) { x.st = 'ready'; x.dl = Math.max(x.dl, S.playMs + CFG.TEN_READY); tenantHooks.ready(x); continue; } // anahtarı oyuncu verir
      if (inProgress(x)) { x.dl += dt; continue; } // usta çalışıyor: süre durur
      if (!x.noted && x.dl - S.playMs <= CFG.TEN_NOTE) { x.noted = true; tenantHooks.note(x); }
      if (S.playMs >= x.dl) { L.splice(n, 1); tenantHooks.leave(x); }
    } else if (x.st === 'ready') {
      if (!satisfied(x)) { x.st = 'wait'; continue; }
      if (S.playMs >= x.dl) { L.splice(n, 1); tenantHooks.leave(x); }
    } else if (S.playMs >= x.end) { L.splice(n, 1); tenantHooks.end(x); }
  }
  if (!tenantsOpen()) return;
  if (!S.nextTen) { S.nextTen = S.playMs + CFG.TEN_FIRST; return; }
  if (S.playMs < S.nextTen) return;
  S.nextTen = S.playMs + CFG.TEN_MIN + rnd() * Math.max(0, CFG.TEN_MAX - CFG.TEN_MIN);
  const cap = Math.floor(S.own.length >= 3 ? CFG.TEN_CAP3 : CFG.TEN_CAP);
  if (L.filter(x => x.st !== 'live').length < cap) {
    const x = spawnTenant(rnd);
    if (x) { if (isLate(x.w.k)) S.nextTen += CFG.TEN_LATE_GAP; tenantHooks.arrive(x); } // geç oyun adayı daha seyrek (denge: sim SIM_PJ_ROWS=gec)
  }
}

/* ---------- metinler (kiracının ağzından istek, kısa istek, bağlantı, düğme, Rıfkı ve bildirim) ----------
   Türkçede bina adı cümlede çekimlendiği için bina başına ayrı tam cümle anahtarı (rifki.ts pairText gibi). */
/** Kiracının kira bonusu yüzdesi (kişiliğe göre; x yoksa temel). */
export const bonusPct = (x?: Pick<Tenant, 'a' | 'k' | 'c'>) => pctTxt(Math.round((x ? bonusOf(charOfT(x)) : CFG.TEN_BONUS) * 100));
/** Sözleşme süresi (dk, kişiliğe göre). */
export const liveMin = (x: Pick<Tenant, 'a' | 'k' | 'c'>) => Math.round(liveOf(charOfT(x)) / 60e3);
const SEA = [tk('Sahil sırası'), tk('Nehir kıyısı'), tk('Cadde cephesi'), tk('Park cephesi'), tk('Göl kıyısı')];
/** Semt kuralındaki kıyı/cephe adı (en alt sıra): "Park cephesi", "Nehir kıyısı" … */
export function seaLabel(k: DistrictKey): string {
  const r = DRULES[k], s = r && r.kind === 'row' ? r.t.replace(/ \(.*$/, '') : '';
  return t(SEA.includes(s) ? s : 'Sahil sırası');
}
/** Kiracının kendi sözü (kartta tırnak içinde). */
export function quote(x: Tenant): string {
  const w = x.w, n = w.n;
  switch (w.k) {
    case 'nb':
      if (x.a === 'ogrenci' && w.t === 'kafe') return t('Yanımda bir kafe olsun; derslere orada çalışırım.');
      if (x.a === 'yazilimci' && w.t === 'kafe') return t('Kahvesiz kod yazılmaz. Yanımda bir kafe olsun yeter.');
      if (x.a === 'emekli' && w.t === 'kafe') return t('Akşamüstü bir çay içecek yer lazım: yanıma bir kafe olsun evladım.');
      if (x.a === 'aile' && w.t === 'dukkan') return t('Bakkal yakın olsun, çocuklar ekmeğe koşsun: yanımıza bir dükkân.');
      switch (w.t) {
        case 'ev': return t('Müşteri lazım! Yanıma bir ev kurulsun, mahalle şenlensin.');
        case 'kafe': return t('Yanıma bir kafe gelsin; müşteri çayını içip bekler.');
        case 'dukkan': return t('Çarşı dediğin yan yana olur: yanıma bir dükkân daha.');
        default: return t('Öğle kalabalığı isterim: yanıma bir ofis gelsin.');
      }
    case 'quiet': return t('Sessiz komşu isterim evladım: yanıma bir ev olsun, ofis olmasın.');
    case 'lvl':
      if (x.a === 'aile') return t('Çocuklar büyüdü, odalar yetmiyor. En az {n}. kat olsun.', { n });
      if (x.a === 'sanatci') return t('Atölye ışık ister: en az {n}. kat.', { n });
      if (x.a === 'ogrenci') return t('Çatı katı hayalim var: en az {n}. kat.', { n });
      return t('Manzaralı bir kat istiyorum: en az {n}. kat.', { n });
    case 'new':
      if (w.sea) return x.a === 'emekli' ? t('{s}! Bu arsaya bir ev kurulsun, sabahları çayımı orada içeyim.', { s: seaLabel(x.k) }) : t('{s}, tam resimlik. Buraya bir ev kurulursa ilk kiracısı benim.', { s: seaLabel(x.k) });
      switch (w.t) {
        case 'kafe': return t('Yeni bina kokusu! Bu arsaya bir kafe kurulsun, ilk kiracısı ben olayım.');
        case 'dukkan': return t('Yeni bina kokusu! Bu arsaya bir dükkân kurulsun, ilk kiracısı ben olayım.');
        case 'ofis': return t('Yeni bina kokusu! Bu arsaya bir ofis kurulsun, ilk kiracısı ben olayım.');
        default: return t('Yeni bina kokusu! Bu arsaya bir ev kurulsun, ilk kiracısı ben olayım.');
      }
    case 'proj':
      if ((n || 1) >= 2) return x.a === 'esnaf' ? t('Çarşı büyüsün: projenin 2. etabı yapılsın, yeni katta dükkânım olsun.') : t('Projenin 2. etabını yapın; yeni katlardan birinde ben oturayım.');
      if (x.a === 'aile') return t('Çocuklar bahçe ister: bu bloğu projeye dönüştürün, ilk biz taşınalım.');
      if (x.a === 'yazilimci') return t('Ekip büyüyor: bu blok tek bir projeye dönüşsün, masamı oraya kurarım.');
      if (x.a === 'esnaf') return t('Kapalı çarşı gibi olsun: bu bloğu projeye dönüştürün, ilk dükkân benim.');
      return t('Bu dört bina tek bir proje olsun; içinde oturmak isterim.');
    case 'kose': return x.a === 'esnaf' ? t('Esnafın yeri köşe başıdır: o damgalı arsada dükkânım olsun.') : t('Köşe başı iki caddeyi birden görür: oraya taşınmak isterim.');
    case 'paint': {
      const c = lowTxt(paintName(w.c));
      if (x.a === 'sanatci') return t('Bu cephe {c} olursa tam tablo olur. Boyatın, hemen taşınayım.', { c });
      return t('Bu binanın cephesi {c} olsun; ancak o zaman evim gibi hissederim.', { c });
    }
    case 'renov': return x.a === 'emekli' ? t('Bina yorulmuş evladım: bir yenileyin, temiz temiz oturayım.') : t('Tesisat eskimiş: kısa bir yenileme yapın, hemen taşınırım.');
  }
}
/** Cephe renginin görünen adı. */
export const paintName = (c?: number) => t((c != null && SKIN_COLORS[c] ? SKIN_COLORS[c] : SKIN_COLORS[0]).n);
/** Kısa istek (kart, şerit, Rıfkı). */
export function wishShort(x: Tenant): string {
  const w = x.w;
  switch (w.k) {
    case 'nb': switch (w.t) { case 'kafe': return t('Yanında kafe'); case 'dukkan': return t('Yanında dükkân'); case 'ofis': return t('Yanında ofis'); default: return t('Yanında ev'); }
    case 'quiet': return t('Yanında ev · ofis olmasın');
    case 'lvl': return t('En az {n}. kat', { n: w.n });
    case 'new':
      if (w.sea) return t('{s}: yeni ev', { s: seaLabel(x.k) });
      switch (w.t) { case 'kafe': return t('Buraya yeni kafe'); case 'dukkan': return t('Buraya yeni dükkân'); case 'ofis': return t('Buraya yeni ofis'); default: return t('Buraya yeni ev'); }
    case 'proj': return (w.n || 1) >= 2 ? t('Projenin 2. etabı') : t('Bu blok projeye dönüşsün');
    case 'kose': return t('Köşe başı arsada otursun');
    case 'paint': return t('Cephe rengi: {c}', { c: paintName(w.c) });
    case 'renov': return t('Binayı yenile');
  }
}
/** İsteğin hangi mekaniğe dayandığı (kartta küçük not). */
export function wishLink(x: Tenant): string {
  const w = x.w, own = lotsOf(S, x.k)[x.i], r = DRULES[x.k];
  if (w.k === 'nb') {
    if (own && PAIRS[own.t] === w.t) return t('Akıllı ikili: iki bina da ayrıca +{p}', { p: pctTxt(Math.round((CFG.PAIR + (r && r.kind === 'pair' ? r.x : 0)) * 100)) });
    if (own && own.t === w.t) return t('Aynı tür komşu: ayrıca +{p}', { p: pctTxt(Math.round(CFG.ADJ * 100)) });
    return t('Yeni bina kendi kirasını da getirir');
  }
  if (w.k === 'quiet') return t('Ev + ev komşuluğu: ayrıca +{p}', { p: pctTxt(Math.round(CFG.ADJ * 100)) });
  if (w.k === 'lvl') return t('Kat çıkınca kira zaten artar; kiracı üstüne +{p}', { p: bonusPct(x) });
  if (w.k === 'proj') return t('Proje dört binanın kirasına +{x}; kiracı bu binaya ayrıca +{p}', { x: pctTxt(Math.round(((w.n || 1) >= 2 ? CFG.PJ_X2 : CFG.PJ_X1) * 100)), p: bonusPct(x) });
  if (w.k === 'kose') return t('Köşe başı zaten +{x}; kiracı üstüne +{p}', { x: pctTxt(Math.round(CFG.IH_KOSE_X * 100)), p: bonusPct(x) });
  if (w.k === 'paint') return t('Cephe rengi yalnızca görünüm, bedeli yok');
  if (w.k === 'renov') return t('Yenileme {m} dk sürer, o sürede bina kira vermez', { m: Math.max(1, Math.round(renovMs(x.k, x.i) / 60e3)) });
  return w.sea && r ? t('Semt kuralı: bu sıra ayrıca +{p}', { p: pctTxt(Math.round(r.x * 100)) }) : t('Boş arsa kira getirmez; kiracıyla hemen dolar');
}
/** Kartın eylem düğmesi (isteği karşılamaya gider). */
export function goLabel(x: Tenant): string {
  if (x.w.k === 'lvl') return t('Binaya git · kat çık');
  if (x.w.k === 'proj') return (x.w.n || 1) >= 2 ? t('Projeye git · 2. etap') : t('Bloğa git · projeye dönüştür');
  if (x.w.k === 'kose') return t('Köşe başına git');
  if (x.w.k === 'paint') return t('Binaya git · cephe rengi');
  if (x.w.k === 'renov') return t('Binaya git');
  switch (wishType(x)) { case 'kafe': return t('Arsaya git · kafe kur'); case 'dukkan': return t('Arsaya git · dükkân kur'); case 'ofis': return t('Arsaya git · ofis kur'); default: return t('Arsaya git · ev kur'); }
}
/** Komşu isteğinin hedef arsasında (mülk paneli şeridi). */
export function nbAsk(x: Tenant): string {
  const n = tName(x.a, x.k)[0];
  switch (wishType(x)) { case 'kafe': return t('Komşusu {n} burada kafe istiyor', { n }); case 'dukkan': return t('Komşusu {n} burada dükkân istiyor', { n }); case 'ofis': return t('Komşusu {n} burada ofis istiyor', { n }); default: return t('Komşusu {n} burada ev istiyor', { n }); }
}
/** Rıfkı Abi'nin cümleleri (rifki.ts sayEvent) ve bildirimler (ayrılış). */
export type TenantEv = 'ten' | 'tennote' | 'tenready' | 'tenok' | 'tenrv';
export function tenantSay(ev: TenantEv, x: Tenant): string {
  const [n, r] = tName(x.a, x.k), w = lowTxt(wishShort(x)), p = bonusPct(x);
  switch (ev) {
    case 'ten': return t('{d} · yeni bir kiracı adayı var efendim: {n}, {r}. İsteği: {w}. Olursa kira {p} artar.', { d: nm(DMAP[x.k].n), n, r, w, p });
    case 'tennote': return t('{n} hâlâ bekliyor efendim. İsteği: {w}. {m} dakikası kaldı.', { n, w, m: Math.max(1, Math.round(CFG.TEN_NOTE / 60e3)) });
    case 'tenrv': return t('Yenileme başladı efendim: bina {m} dakika kira vermez, sonra {n} anahtarı bekler.', { n, m: Math.max(1, Math.round(renovMs(x.k, x.i) / 60e3)) });
    case 'tenready': return t('İstek tamam! {n} anahtarı bekliyor; arsadaki anahtara bir dokunun, sözleşmeyi imzalayalım.', { n });
    default: return t('Hayırlı olsun! {n} taşındı; bu bina {m} dakika boyunca {p} fazla kira getirir.', { n, p, m: liveMin(x) });
  }
}
export const leaveText = (x: Tenant) => t('{n} başka bir yere baktı. Dert değil, yenisi gelir.', { n: tName(x.a, x.k)[0] });
export const endText = (x: Tenant) => t('Sözleşme bitti: {n} teşekkür edip taşındı. Defterinde pulu duruyor.', { n: tName(x.a, x.k)[0] });
