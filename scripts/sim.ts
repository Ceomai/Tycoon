/* =========================================================
   EKONOMİ SİMÜLASYONU — oyunun gerçek ekonomi kodunu (src/economy.ts) kullanır.
   Aktif oyuncu: kirayı sürekli toplar (kumbara kaybı yok), reklam izlemez,
   en hızlı geri dönen yatırımı yapar (bedel ÷ kira artışı + inşaat süresi).
   Semt dolunca sıradaki tapuya para biriktirir; beklerken yalnızca tapudan önce
   kendini amorti eden yatırımları yapar. Çıktı: her semt için dolma süresi ve
   "duvar" (semt doldu → sonraki tapu alındı arası bekleme).
   Çalıştır: npm run sim
   ========================================================= */
import { TYPES, ORDER, MAXLV, CITIES, dkey, N, BuildingType, TIER_M, TIER_FEE, CFG } from '../src/config';

// denemeler için: SIM_TIER_M='[1,6,36,216,1296]' SIM_TIER_FEE='[0,150e3,...]' npm run sim
const env = (globalThis as any).process?.env || {};
if (env.SIM_TIER_M) JSON.parse(env.SIM_TIER_M).forEach((v: number, i: number) => { TIER_M[i] = v; });
if (env.SIM_TIER_INC) CFG.TIER_INC = +env.SIM_TIER_INC;
if (env.SIM_TIER_FEE) JSON.parse(env.SIM_TIER_FEE).forEach((v: number, i: number) => { TIER_FEE[i] = v; });
import { newState, setS, S, lotsOf, Lot } from '../src/state';
import { Time } from '../src/time';
import { baseRate, buildCost, buildTime, upCost, upTime, isFull, unlockInfo } from '../src/economy';

const START = Date.UTC(2027, 2, 10, 9); // bayram olmayan bir gün
const DT = 5;                            // saniye adımı
const HORIZON = 96 * 3600;               // en fazla 96 saat aktif oyun
let simT = 0;
const setClock = () => { Time.offset = START + simT * 1000 - Date.now(); };

const city = 'ist';
const fmtT = (s: number) => s < 3600 ? `${Math.round(s / 60)} dk` : `${(s / 3600).toFixed(1)} sa`;
const districtRate = (k: string) => { let r = 0; for (let i = 0; i < N; i++) r += baseRate(k, i); return r; };

type Opt = { pay: number; cost: number; run: () => void };
function options(k: string, horizonLeft: number): Opt[] {
  const lots = lotsOf(S, k), out: Opt[] = [], before = districtRate(k);
  for (let i = 0; i < N; i++) {
    const p = lots[i];
    if (!p) {
      for (const b of ORDER as BuildingType[]) {
        if (S.earned < TYPES[b].unlock) continue;
        lots[i] = { t: b, lvl: 1, buf: 0, until: 0, dur: 1, up: false };
        const gain = districtRate(k) - before; lots[i] = null;
        if (gain <= 0) continue;
        const cost = buildCost(k, b), time = buildTime(k, b) / 1000;
        const pay = cost / gain + time;
        if (pay > horizonLeft) continue;
        out.push({ pay, cost, run: () => { lots[i] = { t: b, lvl: 0, buf: 0, until: simT + time, dur: time, up: false }; } });
      }
    } else if (p.lvl >= 1 && p.lvl < MAXLV && !p.until) {
      p.lvl++; const gain = districtRate(k) - before; p.lvl--;
      if (gain <= 0) continue;
      const cost = upCost(k, p), time = upTime(k, p) / 1000, pay = cost / gain + time;
      if (pay > horizonLeft) continue;
      out.push({ pay, cost, run: () => { p.until = simT + time; p.dur = time; p.up = true; } });
    }
  }
  return out;
}

function simulate() {
  setClock();
  setS(newState(Time.now(), 'x', city));
  S.cash = 150;
  const rows: { n: string; open: number; full?: number; next?: number }[] = [{ n: CITIES[city].districts[0].n, open: 0 }];
  let idx = 0;
  while (simT < HORIZON) {
    simT += DT; setClock();
    // inşaatlar ve kira
    for (const k of S.own) for (const p of lotsOf(S, k) as Lot[]) {
      if (p && p.until && p.until <= simT) { p.until = 0; if (p.up) { p.lvl++; p.up = false; } else p.lvl = 1; }
    }
    let inc = 0; for (const k of S.own) inc += districtRate(k);
    S.cash += inc * DT; S.earned += inc * DT;
    const cur = dkey(city, idx), row = rows[idx];
    if (row.full == null && isFull(cur)) row.full = simT;
    // sıradaki tapu
    if (idx < 4) {
      const nk = dkey(city, idx + 1), u = unlockInfo(nk);
      if (u.ok && S.cash >= u.fee) {
        S.cash -= u.fee; S.own.push(nk); lotsOf(S, nk); S.cur = nk;
        row.next = simT; idx++; rows.push({ n: CITIES[city].districts[idx].n, open: simT }); continue;
      }
    } else if (row.full != null) break;
    // yatırım: semt doluysa yalnızca tapudan önce amorti olanlar
    let left = Infinity;
    if (row.full != null && idx < 4) { const fee = unlockInfo(dkey(city, idx + 1)).fee; left = Math.max(60, (fee - S.cash) / Math.max(inc, 1e-9)); }
    for (let n = 0; n < 6; n++) {
      const opts = S.own.flatMap(k => options(k, left)).sort((a, b) => a.pay - b.pay);
      const best = opts[0]; if (!best || S.cash < best.cost) break;
      S.cash -= best.cost; best.run();
    }
  }
  return rows;
}

const rows = simulate();
console.log(`\nTapu · aktif oyuncu (reklamsız), İstanbul · kademe ${JSON.stringify(TIER_M)} · kira artışı ${CFG.TIER_INC} · tapu ${JSON.stringify(TIER_FEE)}\n`);
console.log('Semt'.padEnd(12), 'Açılış'.padStart(9), 'Doldu'.padStart(9), 'Dolma süresi'.padStart(14), 'Duvar (bekleme)'.padStart(17));
for (const r of rows) {
  const fill = r.full != null ? r.full - r.open : null, wall = r.full != null && r.next != null ? r.next - r.full : null;
  console.log(r.n.padEnd(12), fmtT(r.open).padStart(9), (r.full != null ? fmtT(r.full) : '—').padStart(9), (fill != null ? fmtT(fill) : '—').padStart(14), (wall != null ? fmtT(wall) : r.full != null && rows.indexOf(r) < 4 ? '> süre sonu' : '—').padStart(17));
}
console.log(`\nToplam simülasyon: ${fmtT(simT)} aktif oyun\n`);
