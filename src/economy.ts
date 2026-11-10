/* =========================================================
   EKONOMİ — kira, maliyet, süre, komşuluk ve semt/il açılışları
   ========================================================= */
import { CFG, COLS, ROWS, N, TYPES, LV_INC, UP_COST, UP_TIME, DMAP, DistrictKey, BuildingType, TIER_M, TIER_FEE, dkey, CITIES, CITY_ORDER, DRULES } from './config';
import { S, Plot, Lot, lotsOf } from './state';
import { Time } from './time';
import { LM } from './landmarks';
import { marketMult, civicMult, achBonus } from './game/modifiers';
import { weekKey } from './format';
/* Adım önbelleği (tick-scoped memo): oyun döngüsü her adımda açar (tickMemo(true)), adım bitince kapatır. Açıkken
   - permMult girdileri (hisse, koleksiyon, semtler, Holding, arşiv) değişmedikçe yeniden hesaplanmaz (her çağrıda yeni Set yok),
   - curWeek saati yeniden okumaz,
   - çizim aşamasında (freezeRates: durum artık değişmez) totalRate ve pending adım başına bir kez hesaplanır.
   Döngü dışındaki çağrılar (dokunuş, kart, panel eylemi) önbelleksiz; sonuçlar önbelleksiz hesapla aynıdır. */
interface Memo { pm: number; pmKey: unknown[] | null; wk: string; rates: boolean; tr: [number, number]; pd: { amount: number; fill: number } | null }
let memo: Memo | null = null;
export function tickMemo(on: boolean) { memo = on ? { pm: 0, pmKey: null, wk: '', rates: false, tr: [NaN, NaN], pd: null } : null; }
export function freezeRates() { if (memo) memo.rates = true; }

/** Bu hafta (piyasa raporu için; dakikada bir hesaplanır). */
let wkC = '', wkT = 0;
export const curWeek = () => {
  if (memo && memo.wk) return memo.wk;
  const t = now(); if (t - wkT > 60e3 || !wkC) { wkC = weekKey(new Date(t)); wkT = t; }
  if (memo) memo.wk = wkC;
  return wkC;
};

/** Oyun saati: sunucuyla düzeltilmiş cihaz saati. Saat geri alınırsa (5 dk tolerans) zaman,
 *  cihaz saati son görülen ana yetişene kadar donar; böylece geri-ileri oynatmayla kazanç olmaz. */
export const now = () => { const t = Time.now(); return S && t < S.maxSeen - 300e3 ? S.maxSeen : t; };
const D = (k: DistrictKey) => DMAP[k];
export const tierOf = (k: DistrictKey) => D(k).idx;
export const incM = (k: DistrictKey) => TIER_M[tierOf(k)] * Math.pow(CFG.TIER_INC, tierOf(k));
export const costM = (k: DistrictKey) => TIER_M[tierOf(k)];
export const cnt = (k: DistrictKey, t: BuildingType) => lotsOf(S, k).filter(p => p && p.t === t).length;
export const withDisc = (p: number) => p * (1 - S.disc);
export const buildCost = (k: DistrictKey, t: BuildingType) => TYPES[t].cost * costM(k) * Math.pow(1.12, cnt(k, t));
/* semt kuralı: hız ve tadilat indirimi */
const speedM = (k: DistrictKey) => { const r = DRULES[k]; return r && r.kind === 'speed' ? 1 - r.x : 1; };
const upDiscM = (k: DistrictKey) => { const r = DRULES[k]; return r && r.kind === 'upDisc' ? 1 - r.x : 1; };
export const buildTime = (k: DistrictKey, t: BuildingType) => TYPES[t].time * 1000 * (1 + 0.1 * cnt(k, t)) * (1 + 0.5 * tierOf(k)) * speedM(k);
export const upCost = (k: DistrictKey, p: Plot) => TYPES[p.t].cost * costM(k) * UP_COST[p.lvl] * upDiscM(k);
export const upTime = (k: DistrictKey, p: Plot) => TYPES[p.t].time * 1000 * UP_TIME[p.lvl] * (1 + 0.5 * tierOf(k)) * speedM(k);
/** Semt kuralının bu arsadaki binaya kira etkisi (tür ya da sahil sırası). */
export function ruleMult(k: DistrictKey, i: number, t: BuildingType): number {
  const r = DRULES[k]; if (!r) return 1;
  if (r.kind === 'type' && r.type === t) return 1 + r.x;
  if (r.kind === 'row' && Math.floor(i / COLS) === ROWS - 1) return 1 + r.x;
  return 1;
}
export const producing = (p: Lot): p is Plot => !!(p && p.lvl >= 1 && !p.until);

export function neighbors(i: number): number[] {
  const r = Math.floor(i / COLS), c = i % COLS, a: number[] = [];
  if (r > 0) a.push(i - COLS); if (r < ROWS - 1) a.push(i + COLS); if (c > 0) a.push(i - 1); if (c < COLS - 1) a.push(i + 1);
  return a;
}
export function adj(k: DistrictKey, i: number, t?: BuildingType): number {
  const lots = lotsOf(S, k); t = t || (lots[i] ? lots[i]!.t : undefined);
  return neighbors(i).filter(j => { const q = lots[j]; return q && !q.sp && q.t === t && q.lvl >= 1; }).length;
}
/** Akıllı ikililer: kafe ↔ ofis, ev ↔ dükkân (komşu başına +%10, iki tarafa da). */
export const PAIRS: Record<BuildingType, BuildingType> = { kafe: 'ofis', ofis: 'kafe', ev: 'dukkan', dukkan: 'ev' };
export function pairAdj(k: DistrictKey, i: number, t?: BuildingType): number {
  const lots = lotsOf(S, k); t = t || (lots[i] ? lots[i]!.t : undefined); if (!t) return 0;
  return neighbors(i).filter(j => { const q = lots[j]; return q && !q.sp && q.lvl >= 1 && q.t === PAIRS[t!]; }).length;
}
/** Komşu özel yapı sayısı (her biri +%15). */
export function spAdj(k: DistrictKey, i: number): number {
  const lots = lotsOf(S, k);
  return neighbors(i).filter(j => { const q = lots[j]; return q && q.sp && q.lvl >= 1 && !q.until; }).length;
}
/** Toplam komşuluk bonusu (aynı tür + akıllı ikili + özel yapı). */
export function neighborBonus(k: DistrictKey, i: number, t?: BuildingType): number {
  const r = DRULES[k], pair = CFG.PAIR + (r && r.kind === 'pair' ? r.x : 0);
  return CFG.ADJ * adj(k, i, t) + pair * pairAdj(k, i, t) + CFG.SP_ADJ * spAdj(k, i);
}
export function fxMult(k: DistrictKey, i: number, p: Plot, t: number): number {
  let m = 1;
  for (const f of S.fx) {
    if (f.until < t) continue;
    if (f.k === 'row' && f.d === k && Math.floor(i / COLS) === f.r) m *= f.x;
    if (f.k === 'type' && f.t === p.t) m *= f.x;
  }
  return m;
}
export const citiesOwned = () => new Set(S.own.map(k => D(k).city)).size;
export function collBonus(): number { const n = (S.coll || []).length; return n * 0.05 + (n === LM.length ? 0.1 : 0); }
export const portfolioBonus = () => CFG.PORTFOLIO_BONUS * Math.max(0, citiesOwned() - 1);
const permMultRaw = () => (1 + 0.1 * (S.shares || 0)) * (1 + collBonus()) * (1 + portfolioBonus()) * (S.premium ? 2 : 1) * (1 + achBonus());
/** Kalıcı çarpan: hisse, koleksiyon, portföy (il sayısı), Holding, arşiv. Adım içinde girdileri değişmedikçe önbellekten. */
export function permMult(): number {
  if (!memo) return permMultRaw();
  const key = [S, S.own, S.own.length, S.coll, S.coll && S.coll.length, S.ach, S.ach && S.ach.length, S.shares, S.premium], old = memo.pmKey;
  if (!old || key.some((v, j) => v !== old[j])) { memo.pmKey = key; memo.pm = permMultRaw(); }
  return memo.pm;
}
/** 3 yıldızlı semte kalıcı bonus. */
export const districtMult = (k: DistrictKey) => ((S.stars && S.stars[k] ? S.stars[k].length : 0) >= 3 ? 1 + CFG.STAR_BONUS : 1);
/** Özel yapı: semtteki en iyi (özel olmayan) binanın 3 katı; hiç bina yoksa 1. kat ofis kadar. */
export function specialBase(k: DistrictKey, i: number): number {
  let best = 0; const lots = lotsOf(S, k);
  lots.forEach((q, j) => { if (j === i || !q || q.sp || !producing(q)) return; best = Math.max(best, TYPES[q.t].inc * LV_INC[q.lvl] * incM(k) * (1 + CFG.ADJ * adj(k, j))); });
  if (!best) best = TYPES.ofis.inc * incM(k);
  return 3 * best;
}

export function baseRate(k: DistrictKey, i: number): number {
  const p = lotsOf(S, k)[i]; if (!producing(p)) return 0;
  if (p!.sp) return specialBase(k, i) * permMult() * districtMult(k);
  return TYPES[p!.t].inc * LV_INC[p!.lvl] * incM(k) * (1 + neighborBonus(k, i)) * ruleMult(k, i, p!.t) * marketMult(p!.t, curWeek()) * civicMult(k, p!.t) * permMult() * districtMult(k);
}
export function rate(k: DistrictKey, i: number, t = now()): number {
  const b = baseRate(k, i); if (!b) return 0;
  const p = lotsOf(S, k)[i]!;
  return b * fxMult(k, i, p, t) * (S.boostUntil > t ? 2 : 1) * ((p.bu || 0) > t ? 2 : 1); // tüm mülklere 2x × bu mülke 2x
}
export function totalRate(live: boolean): number {
  if (memo && memo.rates) { const j = live ? 1 : 0; if (Number.isNaN(memo.tr[j])) memo.tr[j] = totalRateRaw(live); return memo.tr[j]; }
  return totalRateRaw(live);
}
function totalRateRaw(live: boolean): number {
  let s = 0; const t = now();
  for (const k of S.own) for (let i = 0; i < N; i++) s += live ? rate(k, i, t) : baseRate(k, i);
  return s;
}
export const capOf = (k: DistrictKey, i: number, t?: number) => rate(k, i, t) * CFG.CAP_SEC;
export function coinFill(k: DistrictKey, i: number): number {
  const p = lotsOf(S, k)[i]; if (!p || p.buf <= 0) return 0;
  const c = capOf(k, i); if (!c) return p.buf >= 1 ? 1 : 0;
  return Math.min(1, p.buf / c);
}
/** Bekleyen toplam kira ve kumbaraların doluluğu (ortadaki TOPLA mührü için). */
export function pending(): { amount: number; fill: number } {
  if (memo && memo.rates) return memo.pd || (memo.pd = pendingRaw());
  return pendingRaw();
}
function pendingRaw(): { amount: number; fill: number } {
  let a = 0, cap = 0; const t = now();
  for (const k of S.own) lotsOf(S, k).forEach((p, i) => { if (!producing(p)) return; a += p!.buf; cap += capOf(k, i, t); });
  return { amount: a, fill: cap ? Math.min(1, a / cap) : 0 };
}
export const isFull = (k: DistrictKey) => lotsOf(S, k).every(p => p && p.lvl >= 1);
export const filled = (k: DistrictKey) => lotsOf(S, k).filter(p => p && p.lvl >= 1).length;

/* ---------- semt / il açılışı ----------
   - İl içinde: bir önceki semt dolunca sıradaki semtin tapusu (kademe bedeli) alınır.
   - Başka il: başlangıç ilinin ilk semti dolunca diğer illerin ilk semti (artan bedelle) alınır. */
export type Unlock = { ok: boolean; fee: number; why: string };
export function unlockInfo(k: DistrictKey): Unlock {
  const d = D(k);
  if (S.own.includes(k)) return { ok: false, fee: 0, why: 'owned' };
  if (d.idx > 0) {
    const prev = dkey(d.city, d.idx - 1);
    if (!S.own.includes(prev)) return { ok: false, fee: TIER_FEE[d.idx], why: 'prev-not-owned' };
    if (!isFull(prev)) return { ok: false, fee: TIER_FEE[d.idx], why: 'prev-not-full' };
    return { ok: true, fee: TIER_FEE[d.idx], why: '' };
  }
  const start = S.city || 'ist';
  const extra = citiesOwned();
  const fees = [CFG.EXTRA_CITY_FEE_1, CFG.EXTRA_CITY_FEE_2, CFG.EXTRA_CITY_FEE_3, CFG.EXTRA_CITY_FEE_4];
  const fee = fees[Math.min(fees.length - 1, Math.max(0, extra - 1))]; // 2. şehir … 5. şehir (Global)
  if (!isFull(dkey(start, 0))) return { ok: false, fee, why: 'start-not-full' };
  return { ok: true, fee, why: '' };
}
/** Satın alınabilir (şartları sağlanmış) semtler: rozet ve bildirim için. */
export const buyableDistricts = () => CITY_ORDER.flatMap(c => CITIES[c].districts.map((_, i) => dkey(c, i))).filter(k => unlockInfo(k).ok);
