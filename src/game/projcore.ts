/* =========================================================
   BÜYÜK PROJELER — saf kurallar (arayüz içe aktarmaz; simülasyon ve birim testleri de kullanır).
   Adlar, üslup, bildirimler ve oyuncu eylemleri game/project.ts'te; çizimler projdraw.ts'te.
   Kurallar: ikinci semt tapusu alınınca açılır. Semt dolu (20/20) ve kaporasız olmalı, semtte CFG.PJ_MAX'tan az proje
   olmalı. Yan yana 2×2 dört bina: hepsi üretimde, en az CFG.PJ_MINLV, özel yapı / engel değil, başka projede değil.
   Tür karışımı serbest (tür yalnızca ad ve görünümü belirler). Dört bina kaydı silinmez: kira, komşuluk, semt kuralı,
   yıldız hedefleri aynen sayılır; proje üstüne etap bonusu verir (economy.ts pjMult).
   Kiracılar (game/tenants.ts): proje tek bina sayılır. Projedeki ve projeye dönüşebilecek (uygun 2×2) arsalar yeni kiracı
   hedefi olmaz. Birleşmede arsalardaki kiracılar sessizce düşmez: yerleşmiş kiracı sözleşmesi bitene kadar projede kalır,
   anahtar bekleyen (isteği olmuş) kiracı projeye yerleşir, isteği artık karşılanamayan aday bildirimle ayrılır
   (onay kartı bunu önceden söyler).
   ========================================================= */
import { CFG, COLS, ROWS, MAXLV, TYPES, UP_COST, DistrictKey, BuildingType, pjMinLv } from '../config';
import { S, lotsOf, Pj, PjKind } from '../state';
import { costM, isFull, upTime, pjCells, pjOf, producing, now } from '../economy';
import { tenants, excludeTenantLots, satisfied, handKey, tenantHooks, countryOf, tenantPj, Tenant, Country } from './tenants';
import { t, tk } from '../i18n';

/** Türü 2×2'deki binalar belirler: en az 3 ev → site · kafe+dükkân en az 3 → çarşı · en az 3 ofis → plaza · diğer → karma. */
export function kindOf(types: BuildingType[]): PjKind {
  const c = (f: (x: BuildingType) => boolean) => types.filter(f).length;
  if (c(x => x === 'ev') >= 3) return 'site';
  if (c(x => x === 'kafe' || x === 'dukkan') >= 3) return 'carsi';
  if (c(x => x === 'ofis') >= 3) return 'plaza';
  return 'karma';
}
/* ---------- ülkeye uyum: çizim üslubu ve yerel ad (Global'de semtin şehri hangi ülkedeyse) ----------
   Geometriyi tür, malzeme ve süsü üslup belirler (projdraw.ts): tr taş + kiremit · us tuğla + korniş · uk Georgian/Viktoryen
   tuğla sıra cephe · de Gründerzeit sıva cephe + Bauhaus · jp beyaz/cam + neon. */
export const styleOf = (k: DistrictKey): Country => countryOf(k);
export const PJ_NAMES: Record<PjKind, Record<Country, string>> = {
  site: { tr: tk('Bahçeli Site'), us: tk('Brownstone Sırası'), uk: tk('Mews Avlusu'), de: tk('Avlulu Apartman'), jp: tk('Danchi Sitesi') },
  carsi: { tr: tk('Pasaj'), us: tk('Alışveriş Merkezi'), uk: tk('Arcade Çarşısı'), de: tk('Markthalle'), jp: tk('Shōtengai Çarşısı') },
  plaza: { tr: tk('Plaza'), us: tk('Art Deco Kule'), uk: tk('Cam Kule'), de: tk('Büro Kulesi'), jp: tk('Gökdelen') },
  karma: { tr: tk('Han'), us: tk('Loft Bloğu'), uk: tk('Ambar Lofları'), de: tk('Kontorhaus'), jp: tk('Yokochō Bloğu') },
};
export const KIND_N: Record<PjKind, string> = { site: tk('konut projesi'), carsi: tk('çarşı projesi'), plaza: tk('iş projesi'), karma: tk('karma proje') };
/** Projenin yerel adı (semtin ülkesine göre). */
export const pjName = (k: DistrictKey, kind: PjKind) => t((PJ_NAMES[kind] || PJ_NAMES.site)[styleOf(k)]);

/* Remote Config sayıları kesirli gelebilir: tamsayı ve makul aralık. */
export { pjMinLv };
export const pjMax = () => Math.max(1, Math.floor(CFG.PJ_MAX));
/** Oyunun bu aşamasında projeler açık mı (2. semt tapusu alınmış). */
export const pjUnlocked = () => S.own.length >= Math.max(1, Math.floor(CFG.PJ_UNLOCK_OWN));
export const pjList = (k: DistrictKey): Pj[] => (S.pj && S.pj[k]) || [];
export const pjCount = () => S.own.reduce((s, k) => s + pjList(k).length, 0);
export type PjWhy = '' | 'locked' | 'lien' | 'notfull' | 'max';
/** Semtte proje kurulabilir mi: açık, kaporasız, dolu, ruhsat sınırı dolmamış ('' = evet). */
export function pjDistrictOk(k: DistrictKey): PjWhy {
  if (!pjUnlocked()) return 'locked';
  if (S.lien[k]) return 'lien';
  if (!isFull(k)) return 'notfull';
  if (pjList(k).length >= pjMax()) return 'max';
  return '';
}
const cellOk = (k: DistrictKey, i: number) => { const p = lotsOf(S, k)[i]; return !!p && !p.sp && !p.ob && producing(p) && p.lvl >= pjMinLv() && !pjOf(k, i); };
/** i'yi içeren (verilmezse tüm) 2×2 blokların sol üst arsaları. */
function corners(i?: number): number[] {
  const out: number[] = [];
  for (let r = 0; r < ROWS - 1; r++) for (let c = 0; c < COLS - 1; c++) { const a = r * COLS + c; if (i == null || pjCells(a).includes(i)) out.push(a); }
  return out;
}
/** Uygun 2×2 bloklar (sol üst arsa). i verilirse yalnızca i'yi içerenler. */
export function blocks(k: DistrictKey, i?: number): number[] {
  if (pjDistrictOk(k)) return [];
  return corners(i).filter(a => pjCells(a).every(j => cellOk(k, j)));
}
/** Proje olabilecek (ama henüz olmamış) bloğun arsaları: dört binası da hazır, semtin ruhsatı var. */
export const pjReady = (k: DistrictKey, i: number) => blocks(k, i).length > 0;
/** Kiracı hedefi olmayan arsa: projede ya da projeye dönüşebilecek bir blokta. */
export const pjReserved = (k: DistrictKey, i: number) => !!pjOf(k, i) || pjReady(k, i);
excludeTenantLots(pjReserved, true); // mevcut kiracılar pjStart'ta ele alınır (sessizce düşmez)
// kiracıların geç oyun proje isteği (tenants.ts tenantPj): uygun bloklar, semtin projeleri, etap bedeli
Object.assign(tenantPj, { blocks: (k: DistrictKey, i?: number) => blocks(k, i), list: (k: DistrictKey) => pjList(k), cost: (k: DistrictKey, a: number, st?: number) => pjCost(k, a, st) });

type Near = { a: number; ready: number; floors: number; i: number };
/** Projeye en yakın blok (i'yi içerenler ya da semtin tümü): kaç bina hazır, kaç kat eksik, kat çıkması gereken ilk arsa.
 *  Bloğun dört arsası da bina olmalı (özel yapı / engel / proje değil). Arsa panelindeki ilerleme notu ve Rıfkı için. */
export function nearest(k: DistrictKey, i?: number): Near | null {
  let best: Near | null = null; const lots = lotsOf(S, k), mn = pjMinLv();
  for (const a of corners(i)) {
    const cells = pjCells(a);
    if (cells.some(j => { const p = lots[j]; return !p || p.sp || p.ob || p.lvl < 1 || pjOf(k, j); })) continue;
    const ready = cells.filter(j => lots[j]!.lvl >= mn).length, floors = cells.reduce((s, j) => s + Math.max(0, mn - lots[j]!.lvl), 0);
    const low = cells.find(j => lots[j]!.lvl < mn && !lots[j]!.until);
    if (!best || floors < best.floors) best = { a, ready, floors, i: low ?? cells.find(j => lots[j]!.lvl < mn) ?? a };
  }
  return best;
}
export const typesAt = (k: DistrictKey, a: number) => pjCells(a).map(j => lotsOf(S, k)[j]!.t);
/** 1. etap bedeli: dört binanın son kat (Sv4→5) bedeli toplamı × PJ_COST_PCT/100. 2. etap × PJ_COST2. */
export function pjCost(k: DistrictKey, a: number, stage = 1): number {
  const base = typesAt(k, a).reduce((s, ty) => s + TYPES[ty].cost * costM(k) * UP_COST[MAXLV - 1], 0) * CFG.PJ_COST_PCT / 100;
  return stage >= 2 ? base * CFG.PJ_COST2 : base;
}
/** Süre (ms): dört binanın Sv4→5 kat çıkma süresi ortalaması × PJ_TIME_PCT/100 (2. etap × PJ_TIME2). */
export function pjTime(k: DistrictKey, a: number, stage = 1): number {
  const ts = typesAt(k, a).map(ty => upTime(k, { t: ty, lvl: MAXLV - 1, buf: 0, until: 0, dur: 1, up: false }));
  const avg = ts.reduce((s, x) => s + x, 0) / ts.length * CFG.PJ_TIME_PCT / 100;
  return stage >= 2 ? avg * CFG.PJ_TIME2 : avg;
}

/* ---------- kiracılar: birleşmede ne olur ---------- */
export interface PjTen { live: Tenant[]; move: Tenant[]; leave: Tenant[] }
/** Bloğun arsalarındaki kiracılar: live = sözleşmesi sürüyor (projede kalır), move = isteği olmuş, anahtar bekliyor
 *  (projeye yerleşir), leave = isteği artık karşılanamaz (bildirimle ayrılır). Proje isteyen kiracı (proj) ve yenilemesi süren
 *  kiracı (renov) hiçbirine girmez: beklemeye devam eder (proje / yenileme bitince anahtar). */
export function pjTenants(k: DistrictKey, a: number): PjTen {
  const cells = pjCells(a), r: PjTen = { live: [], move: [], leave: [] };
  for (const x of tenants()) {
    if (x.k !== k || !cells.includes(x.i)) continue;
    if (x.st === 'wait' && (x.w.k === 'proj' || (x.w.k === 'renov' && x.rv != null))) continue;
    if (x.st === 'live') r.live.push(x); else if (satisfied(x)) r.move.push(x); else r.leave.push(x);
  }
  return r;
}

/* ---------- durum değişiklikleri (arayüzsüz) ---------- */
/** Projeyi başlatır: bedel kasadan, inşaat t0'dan. scale: süre birimi (oyun ms; simülasyon saniye için 1/1000). */
export function pjStart(k: DistrictKey, a: number, t0 = now(), scale = 1): Pj | null {
  if (!blocks(k).includes(a)) return null;
  const c = pjCost(k, a); if (!(S.cash >= c)) return null;
  const tn = pjTenants(k, a);
  for (const x of tn.move) { x.st = 'ready'; handKey(x); }
  for (const x of tn.leave) { const L = tenants(), j = L.indexOf(x); if (j >= 0) L.splice(j, 1); tenantHooks.leave(x); }
  const d = pjTime(k, a) * scale, q: Pj = { a, kd: kindOf(typesAt(k, a)), st: 0, until: t0 + d, dur: d };
  S.cash -= c; (S.pj[k] = S.pj[k] || []).push(q);
  return q;
}
/** 2. etap (kat ekle): yalnız 1. etap bitmişken. */
export function pjStage2(k: DistrictKey, q: Pj, t0 = now(), scale = 1): boolean {
  if (q.st !== 1 || q.until) return false;
  const c = pjCost(k, q.a, 2); if (!(S.cash >= c)) return false;
  const d = pjTime(k, q.a, 2) * scale; S.cash -= c; q.until = t0 + d; q.dur = d;
  return true;
}
/** Projeyi ayır: dört bina (Sv5) yerinde kalır, bedel iade edilmez; yerleşik kiracılar binalarında kalır. */
export function pjSplit(k: DistrictKey, q: Pj): boolean {
  const L = pjList(k), at = L.indexOf(q); if (at < 0) return false;
  L.splice(at, 1); if (!L.length) delete S.pj[k];
  return true;
}
/** Süresi dolan etaplar teslim edilir; teslim edilenler döner. */
export function pjDue(tn: number): [DistrictKey, Pj][] {
  const out: [DistrictKey, Pj][] = [];
  for (const k of S.own) for (const q of pjList(k)) {
    if (!q.until || tn < q.until) continue;
    q.until = 0; q.st = Math.min(2, q.st + 1); out.push([k, q]);
  }
  return out;
}
