/* =========================================================
   SEMT HEDEFLERİ — her semtte 3 hedef (yıldız). 3 yıldız: semte kalıcı +%10 ve altın mühür.
   Hedefler semtin kademesine göre değişir; bir kez kazanılan yıldız kaybolmaz.
   ========================================================= */
import { COLS, N, CFG, DMAP, DistrictKey, BuildingType } from '../config';
import { S, lotsOf } from '../state';
import { fmt } from '../format';
import { neighbors, filled, totalRate, PAIRS } from '../economy';
import { Snd, buzz } from '../sound';
import { toast, bump } from '../ui/modal';
import { addCash } from './actions';
import { addXp } from './fun';
import { persist } from './persist';
import { Analytics } from '../services/analytics';

export interface Goal { t: string; f: (k: DistrictKey) => [number, number]; }

/** Aynı türden, yan yana duran en büyük bina grubu. */
export function largestGroup(k: DistrictKey, t: BuildingType): number {
  const lots = lotsOf(S, k), ok = (i: number) => { const q = lots[i]; return !!q && !q.sp && q.t === t && q.lvl >= 1; };
  const seen = new Set<number>(); let best = 0;
  for (let i = 0; i < N; i++) {
    if (seen.has(i) || !ok(i)) continue;
    let n = 0; const st = [i]; seen.add(i);
    while (st.length) { const x = st.pop()!; n++; for (const j of neighbors(x)) if (!seen.has(j) && ok(j)) { seen.add(j); st.push(j); } }
    best = Math.max(best, n);
  }
  return best;
}
/** Komşu akıllı ikili sayısı (kafe-ofis, ev-dükkân). */
export function pairsCount(k: DistrictKey): number {
  const lots = lotsOf(S, k); let n = 0;
  for (let i = 0; i < N; i++) {
    const p = lots[i]; if (!p || p.sp || p.lvl < 1) continue;
    for (const j of [i + 1, i + COLS]) {
      if ((j === i + 1 && (i + 1) % COLS === 0) || j >= N) continue;
      const q = lots[j]; if (q && !q.sp && q.lvl >= 1 && PAIRS[p.t] === q.t) n++;
    }
  }
  return n;
}
const maxLvl = (k: DistrictKey, t: BuildingType) => lotsOf(S, k).reduce((m, p) => (p && !p.sp && p.t === t ? Math.max(m, p.lvl) : m), 0);
const atLeast = (k: DistrictKey, lv: number) => lotsOf(S, k).filter(p => p && p.lvl >= lv && !p.until).length;

const group = (t: BuildingType, n: number, name: string): Goal => ({ t: `${n} ${name} yan yana diz`, f: k => [Math.min(n, largestGroup(k, t)), n] });
const level = (t: BuildingType, lv: number, name: string): Goal => ({ t: `Bir ${name} ${lv}. kata çıkar`, f: k => [Math.min(lv, maxLvl(k, t)), lv] });
const full: Goal = { t: 'Semti doldur', f: k => [filled(k), 20] };

/** Kademe (semtin il içindeki sırası) başına hedefler. */
const BY_TIER: Goal[][] = [
  [group('ev', 4, 'evi'), level('ev', 5, 'evi'), full],
  [group('kafe', 4, 'kafeyi'), level('dukkan', 3, 'dükkânı'), full],
  [group('dukkan', 4, 'dükkânı'), level('ofis', 5, 'ofisi'), full],
  [group('ofis', 6, 'ofisi'), { t: '3 akıllı ikili kur', f: k => [Math.min(3, pairsCount(k)), 3] }, full],
  [group('ofis', 8, 'ofisi'), { t: 'Tüm binaları en az 3. kata çıkar', f: k => [atLeast(k, 3), 20] }, full],
];
export const goalsOf = (k: DistrictKey): Goal[] => BY_TIER[DMAP[k].idx] || BY_TIER[0];
export const starsOf = (k: DistrictKey): number[] => (S.stars && S.stars[k]) || [];
const prize = (k: DistrictKey) => Math.max(1000, totalRate(false) * 90 * (1 + 0.5 * DMAP[k].idx)); // ~1,5 dk kira: tapu dengesini bozmaz

/** Yeni kazanılan yıldızları verir (oyun döngüsünden birkaç saniyede bir çağrılır). */
export function checkGoals() {
  if (!S.stars) S.stars = {};
  for (const k of S.own) {
    const got = starsOf(k);
    goalsOf(k).forEach((g, gi) => {
      if (got.includes(gi)) return;
      const [p, n] = g.f(k); if (p < n) return;
      S.stars[k] = [...got, gi]; got.push(gi);
      const cash = prize(k); addCash(cash); addXp(80); bump(); Snd.unlock(); buzz(20);
      Analytics.log('district_star', { district: k, goal: gi, stars: got.length });
      if (got.length >= 3) toast(`${DMAP[k].n}: 3 yıldız! Altın mühür · kiralar kalıcı +%${Math.round(CFG.STAR_BONUS * 100)}`);
      else toast(`★ ${DMAP[k].n}: ${g.t} · ${fmt(cash)}`);
      persist();
    });
  }
}
/** Tamamlanmasına en az kalan hedef (Rıfkı Abi ipucu için). */
export function nearestGoal(): { k: DistrictKey; g: Goal; ratio: number } | null {
  let best: { k: DistrictKey; g: Goal; ratio: number } | null = null;
  for (const k of S.own) goalsOf(k).forEach((g, gi) => {
    if (starsOf(k).includes(gi)) return;
    const [p, n] = g.f(k), r = p / n;
    if (r < 1 && (!best || r > best.ratio)) best = { k, g, ratio: r };
  });
  return best;
}
