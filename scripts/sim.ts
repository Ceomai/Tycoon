/* =========================================================
   EKONOMİ SİMÜLASYONU — oyunun gerçek ekonomi kodunu (src/economy.ts) kullanır.
   Aktif oyuncu: kirayı sürekli toplar (kumbara kaybı yok), reklam izlemez,
   en hızlı geri dönen yatırımı yapar (bedel ÷ kira artışı + inşaat süresi).
   Semt dolunca sıradaki tapuya para biriktirir; beklerken yalnızca tapudan önce
   kendini amorti eden yatırımları yapar. Çıktı: her semt için dolma süresi ve
   "duvar" (semt doldu → sonraki tapu alındı arası bekleme).
   Çalıştır: npm run sim
   Kiracılar (src/game/tenants.ts): SIM_TEN=off|passive|half|active · SIM_SEED (tohum) · SIM_TEN_BONUS · SIM_TEN_LIVE (dk) ·
   SIM_TEN_MIN / SIM_TEN_MAX (dk). passive: kiracılar gelir ama oyuncu bakmaz (anahtar verilmez) · half: adayların yarısına bakar ·
   active: karşılanabilir her isteği hemen yapar ve anahtarı verir. SIM_TEN=table: dört kipi 8 tohumla karşılaştıran tablo.
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
import { tenantTick, tenants, tenantHooks, tenantReset, handKey, targetLot, wishType } from '../src/game/tenants';

type TMode = 'off' | 'passive' | 'half' | 'active';
if (env.SIM_TEN_BONUS) CFG.TEN_BONUS = +env.SIM_TEN_BONUS;
if (env.SIM_TEN_LIVE) CFG.TEN_LIVE = +env.SIM_TEN_LIVE * 60e3;
if (env.SIM_TEN_MIN) CFG.TEN_MIN = +env.SIM_TEN_MIN * 60e3;
if (env.SIM_TEN_MAX) CFG.TEN_MAX = +env.SIM_TEN_MAX * 60e3;
let seed = 1; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
const tstat = { arrived: 0, settled: 0, left: 0 };
tenantHooks.arrive = () => { tstat.arrived++; }; tenantHooks.settle = () => { tstat.settled++; }; tenantHooks.leave = () => { tstat.left++; };

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

/** Kiracıyla ilgilenen oyuncu: bekleyen kiracının isteği parası yetiyorsa hemen yapılır, anahtar hemen verilir. */
function serveTenants(mode: TMode) {
  for (const x of tenants()) {
    if (mode === 'half' && x.id % 2) continue; // yarı ilgili oyuncu: adayların yarısına bakar
    if (x.st === 'ready') { handKey(x); continue; }
    if (x.st !== 'wait') continue;
    const lots = lotsOf(S, x.k), w = x.w;
    const startBuild = (i: number, t: BuildingType) => { const c = buildCost(x.k, t); if (S.cash < c || lots[i]) return; S.cash -= c; const time = buildTime(x.k, t) / 1000; lots[i] = { t, lvl: 0, buf: 0, until: simT + time, dur: time, up: false }; };
    if (w.k === 'nb' || w.k === 'quiet') { const j = targetLot(x); if (j !== x.i) startBuild(j, wishType(x)!); }
    else if (w.k === 'new') startBuild(x.i, w.t!);
    else { const p = lots[x.i]; if (p && !p.until && p.lvl < (w.n || 0)) { const c = upCost(x.k, p); if (S.cash >= c) { S.cash -= c; const time = upTime(x.k, p) / 1000; p.until = simT + time; p.dur = time; p.up = true; } } }
  }
}
let earnedAt: number[] = [];
function simulate(mode: TMode = 'off', sd = 1) {
  simT = 0; seed = sd; earnedAt = []; tstat.arrived = tstat.settled = tstat.left = 0; tenantReset();
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
    for (const b of ORDER) if (S.earned >= TYPES[b].unlock) S.seen[b] = true;
    if (mode !== 'off') { S.playMs = simT * 1000; tenantTick(DT * 1000, rnd); if (mode !== 'passive') serveTenants(mode); }
    let inc = 0; for (const k of S.own) inc += districtRate(k);
    S.cash += inc * DT; S.earned += inc * DT; earnedAt.push(S.earned);
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

const MODE = (env.SIM_TEN || 'off') as TMode | 'table';
if (MODE === 'table') {
  // denge tablosu: kazanç farkı (60/90/120 dk), semt dolma süreleri, son semtin dolması, gelen / yerleşen (8 tohum ortalaması)
  const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8], at = (m: number) => earnedAt[Math.round(m * 60 / DT) - 1];
  const fill = (rows: ReturnType<typeof simulate>) => rows.map(r => (r.full != null ? (r.full - r.open) / 60 : NaN));
  const base = simulate('off'); const b60 = at(60), b90 = at(90), b120 = at(120), bFill = fill(base), bEnd = base[4] && base[4].full != null ? base[4].full / 60 : NaN;
  const pct = (v: number, b: number) => `${v >= b ? '+' : '−'}${(Math.abs(v / b - 1) * 100).toFixed(1)}%`;
  console.log(`\nKiracılar · İstanbul, reklamsız aktif oyuncu · +%${Math.round(CFG.TEN_BONUS * 100)} / ${CFG.TEN_LIVE / 60e3} dk / ${CFG.TEN_MIN / 60e3}–${CFG.TEN_MAX / 60e3} dk · ${SEEDS.length} tohum\n`);
  console.log('Oyuncu'.padEnd(12), '60 dk'.padStart(8), '90 dk'.padStart(8), '120 dk'.padStart(8), '  Semt dolma (dk)'.padEnd(34), 'Son semt'.padStart(9), 'Gelen/Yerleşen'.padStart(15));
  console.log('Önce (yok)'.padEnd(12), '—'.padStart(8), '—'.padStart(8), '—'.padStart(8), '  ' + bFill.map(v => v.toFixed(1)).join(' / ').padEnd(32), `${bEnd.toFixed(1)}`.padStart(9), '—'.padStart(15));
  for (const m of ['passive', 'half', 'active'] as TMode[]) {
    let e60 = 0, e90 = 0, e120 = 0, end = 0, arr = 0, ok = 0; const f = [0, 0, 0, 0, 0];
    for (const sd of SEEDS) { const rows = simulate(m, sd); e60 += at(60); e90 += at(90); e120 += at(120); fill(rows).forEach((v, j) => { f[j] += v; }); end += rows[4] && rows[4].full != null ? rows[4].full / 60 : NaN; arr += tstat.arrived; ok += tstat.settled; }
    const n = SEEDS.length, name = { passive: 'Yok sayan', half: 'Yarı ilgili', active: 'Aktif' }[m as 'passive'];
    console.log(name.padEnd(12), pct(e60 / n, b60).padStart(8), pct(e90 / n, b90).padStart(8), pct(e120 / n, b120).padStart(8), '  ' + f.map(v => (v / n).toFixed(1)).join(' / ').padEnd(32), (end / n).toFixed(1).padStart(9), `${(arr / n).toFixed(1)} / ${(ok / n).toFixed(1)}`.padStart(15));
  }
  console.log('');
  (globalThis as any).process.exit(0);
}
const rows = simulate(MODE as TMode, +(env.SIM_SEED || 1));
if (MODE !== 'off') console.log(`kiracı: ${MODE} · tohum ${env.SIM_SEED || 1} · ${JSON.stringify(tstat)}`);
console.log(`\nTapu · aktif oyuncu (reklamsız), İstanbul · kademe ${JSON.stringify(TIER_M)} · kira artışı ${CFG.TIER_INC} · tapu ${JSON.stringify(TIER_FEE)}\n`);
console.log('Semt'.padEnd(12), 'Açılış'.padStart(9), 'Doldu'.padStart(9), 'Dolma süresi'.padStart(14), 'Duvar (bekleme)'.padStart(17));
for (const r of rows) {
  const fill = r.full != null ? r.full - r.open : null, wall = r.full != null && r.next != null ? r.next - r.full : null;
  console.log(r.n.padEnd(12), fmtT(r.open).padStart(9), (r.full != null ? fmtT(r.full) : '—').padStart(9), (fill != null ? fmtT(fill) : '—').padStart(14), (wall != null ? fmtT(wall) : r.full != null && rows.indexOf(r) < 4 ? '> süre sonu' : '—').padStart(17));
}
console.log(`\nToplam simülasyon: ${fmtT(simT)} aktif oyun\n`);
