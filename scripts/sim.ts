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
   Büyük projeler (src/game/projcore.ts): SIM_PJ=1 aktif oyuncu projeleri (ve 2. etabı) da aynı geri dönüş ölçütüyle yatırım
   seçeneği sayar · SIM_EXTRA=saat: son semt dolduktan sonra da oyna (kira ölçümü) · ayar: SIM_PJ_X1, SIM_PJ_X2, SIM_PJ_COST
   (yüzde), SIM_PJ_COST2, SIM_PJ_MINLV, SIM_PJ_MAX · SIM_PJ=table: yok sayan / projeler / kiracılar / ikisi birlikte tablosu.
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
import { blocks, pjStart, pjStage2, pjDue, pjList, kindOf, typesAt, pjCost, pjTime } from '../src/game/projcore';

if (env.SIM_PJ_X1) CFG.PJ_X1 = +env.SIM_PJ_X1; if (env.SIM_PJ_X2) CFG.PJ_X2 = +env.SIM_PJ_X2;
if (env.SIM_PJ_COST) CFG.PJ_COST_PCT = +env.SIM_PJ_COST; if (env.SIM_PJ_COST2) CFG.PJ_COST2 = +env.SIM_PJ_COST2;
if (env.SIM_PJ_MINLV) CFG.PJ_MINLV = +env.SIM_PJ_MINLV; if (env.SIM_PJ_MAX) CFG.PJ_MAX = +env.SIM_PJ_MAX;
let PJ = env.SIM_PJ === '1'; const EXTRA = +(env.SIM_EXTRA || 0) * 3600;
const pstat = { pj: 0, pj2: 0, spent: 0, first: -1, log: [] as string[] };

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
  if (PJ) {
    // proje: dört binanın kirası korunur, üstüne etap bonusu; kazanç = proje bitince semt kirası farkı
    for (const a of blocks(k)) {
      const L = (S.pj[k] = S.pj[k] || []); L.push({ a, kd: kindOf(typesAt(k, a)), st: 1, until: 0, dur: 1 });
      const gain = districtRate(k) - before; L.pop(); if (!L.length) delete S.pj[k];
      const cost = pjCost(k, a), time = pjTime(k, a) / 1000, pay = cost / gain + time;
      if (gain <= 0 || pay > horizonLeft) continue;
      out.push({ pay, cost, run: () => { S.cash += cost; if (pjStart(k, a, simT, 1 / 1000)) { pstat.pj++; pstat.spent += cost; if (pstat.first < 0) pstat.first = simT; pstat.log.push(`${fmtT(simT)} ${k} a${a} ${kindOf(typesAt(k, a))} geri dönüş ${fmtT(pay)}`); } else S.cash -= cost; } });
    }
    for (const q of pjList(k)) {
      if (q.st !== 1 || q.until) continue;
      q.st = 2; const gain = districtRate(k) - before; q.st = 1;
      const cost = pjCost(k, q.a, 2), time = pjTime(k, q.a, 2) / 1000, pay = cost / gain + time;
      if (gain <= 0 || pay > horizonLeft) continue;
      out.push({ pay, cost, run: () => { S.cash += cost; if (pjStage2(k, q, simT, 1 / 1000)) { pstat.pj2++; pstat.spent += cost; pstat.log.push(`${fmtT(simT)} ${k} a${q.a} 2. etap geri dönüş ${fmtT(pay)}`); } else S.cash -= cost; } });
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
let earnedAt: number[] = [], rateAt: number[] = [], endT = -1;
function simulate(mode: TMode = 'off', sd = 1) {
  simT = 0; seed = sd; earnedAt = []; rateAt = []; endT = -1; tstat.arrived = tstat.settled = tstat.left = 0; tenantReset();
  pstat.pj = pstat.pj2 = pstat.spent = 0; pstat.first = -1; pstat.log = [];
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
    pjDue(simT); // proje etapları
    for (const b of ORDER) if (S.earned >= TYPES[b].unlock) S.seen[b] = true;
    if (mode !== 'off') { S.playMs = simT * 1000; tenantTick(DT * 1000, rnd); if (mode !== 'passive') serveTenants(mode); }
    let inc = 0; for (const k of S.own) inc += districtRate(k);
    S.cash += inc * DT; S.earned += inc * DT; earnedAt.push(S.earned); rateAt.push(inc);
    const cur = dkey(city, idx), row = rows[idx];
    if (row.full == null && isFull(cur)) row.full = simT;
    // sıradaki tapu
    if (idx < 4) {
      const nk = dkey(city, idx + 1), u = unlockInfo(nk);
      if (u.ok && S.cash >= u.fee) {
        S.cash -= u.fee; S.own.push(nk); lotsOf(S, nk); S.cur = nk;
        row.next = simT; idx++; rows.push({ n: CITIES[city].districts[idx].n, open: simT }); continue;
      }
    } else if (row.full != null) { if (!EXTRA) break; if (endT < 0) endT = simT; if (simT - endT >= EXTRA) break; }
    // yatırım: semt doluysa yalnızca tapudan önce amorti olanlar (son semt dolduysa: kalan ek süre içinde amorti olanlar)
    let left = Infinity;
    if (endT >= 0) left = Math.max(60, EXTRA - (simT - endT));
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
if (env.SIM_PJ === 'table') {
  // denge tablosu (projeler): Bebek dolunca 3 saat daha oynanır. Kazanç (2/4 sa, toplam) ve kira (Bebek dolunca, +1, +3 sa)
  // farkı "yok sayan" (proje ve kiracıya hiç dokunmayan) oyuncuya göre; kiracılı satırlar 8 tohum ortalaması.
  if (!EXTRA) { console.log('SIM_EXTRA gerekli (ör. SIM_EXTRA=3)'); (globalThis as any).process.exit(1); }
  const at = (a: number[], sec: number) => a[Math.min(a.length, Math.round(sec / DT)) - 1];
  type R = { full: number; e2: number; e4: number; eEnd: number; rF: number; r1: number; r3: number; pj: number; pj2: number; first: number; fills: number[] };
  const run = (pj: boolean, mode: TMode, sd: number): R => {
    PJ = pj; const rows = simulate(mode, sd), fullT = rows[4].full!;
    return { full: fullT, e2: at(earnedAt, 7200), e4: at(earnedAt, 14400), eEnd: earnedAt[earnedAt.length - 1], rF: at(rateAt, fullT), r1: at(rateAt, fullT + 3600), r3: rateAt[rateAt.length - 1],
      pj: pstat.pj, pj2: pstat.pj2, first: pstat.first, fills: rows.map(r => (r.full! - r.open) / 60) };
  };
  const avg = (pj: boolean, mode: TMode) => { const sds = mode === 'off' ? [1] : [1, 2, 3, 4, 5, 6, 7, 8], rs = sds.map(sd => run(pj, mode, sd));
    const o: any = {}; for (const key of Object.keys(rs[0]) as (keyof R)[]) o[key] = key === 'fills' ? rs[0].fills.map((_, j) => rs.reduce((x, r) => x + r.fills[j], 0) / rs.length) : rs.reduce((x, r) => x + (r[key] as number), 0) / rs.length; return o as R; };
  const base = avg(false, 'off');
  const pct = (v: number, b: number) => { const d = (v / b - 1) * 100; return (Math.abs(d) < 0.05 ? '%0' : (d > 0 ? '+%' : '−%') + Math.abs(d).toFixed(1)).replace('.', ','); };
  console.log(`\nBüyük projeler · İstanbul, reklamsız aktif oyuncu · +%${Math.round(CFG.PJ_X1 * 100)} / +%${Math.round(CFG.PJ_X2 * 100)} · semt başına ${CFG.PJ_MAX} · Sv${CFG.PJ_MINLV} · bedel %${CFG.PJ_COST_PCT} · Bebek + ${EXTRA / 3600} sa\n`);
  console.log('| Senaryo | Proje / 2. etap | İlk proje | Semt dolma (dk) | Bebek dolma | Kazanç 2 sa | Kazanç 4 sa | Kira (Bebek dolunca) | Kira (+1 sa) | Kira (+3 sa) | Toplam kazanç |');
  console.log('|---|---|---|---|---|---|---|---|---|---|---|');
  const line = (n: string, r: R) => console.log(`| ${n} | ${r.pj.toFixed(r.pj % 1 ? 1 : 0)} / ${r.pj2.toFixed(r.pj2 % 1 ? 1 : 0)} | ${r.first >= 0 ? fmtT(r.first) : '—'} | ${r.fills.map(v => v.toFixed(0)).join('/')} | ${fmtT(r.full)} | ${pct(r.e2, base.e2)} | ${pct(r.e4, base.e4)} | ${pct(r.rF, base.rF)} | ${pct(r.r1, base.r1)} | ${pct(r.r3, base.r3)} | ${pct(r.eEnd, base.eEnd)} |`);
  line('yok sayan (proje ve kiracı yok)', base);
  line('projeler (aktif)', avg(true, 'off'));
  line('kiracılar (aktif)', avg(false, 'active'));
  line('kiracılar + projeler (aktif)', avg(true, 'active'));
  line('kiracılar yarı ilgili + projeler', avg(true, 'half'));
  console.log('');
  (globalThis as any).process.exit(0);
}
const rows = simulate(MODE as TMode, +(env.SIM_SEED || 1));
if (PJ) console.log(`büyük proje: ${pstat.pj} proje · ${pstat.pj2} 2. etap · ilk ${pstat.first >= 0 ? fmtT(pstat.first) : '—'}\n${env.SIM_LOG ? pstat.log.join('\n') : ''}`);
if (MODE !== 'off') console.log(`kiracı: ${MODE} · tohum ${env.SIM_SEED || 1} · ${JSON.stringify(tstat)}`);
console.log(`\nTapu · aktif oyuncu (reklamsız), İstanbul · kademe ${JSON.stringify(TIER_M)} · kira artışı ${CFG.TIER_INC} · tapu ${JSON.stringify(TIER_FEE)}\n`);
console.log('Semt'.padEnd(12), 'Açılış'.padStart(9), 'Doldu'.padStart(9), 'Dolma süresi'.padStart(14), 'Duvar (bekleme)'.padStart(17));
for (const r of rows) {
  const fill = r.full != null ? r.full - r.open : null, wall = r.full != null && r.next != null ? r.next - r.full : null;
  console.log(r.n.padEnd(12), fmtT(r.open).padStart(9), (r.full != null ? fmtT(r.full) : '—').padStart(9), (fill != null ? fmtT(fill) : '—').padStart(14), (wall != null ? fmtT(wall) : r.full != null && rows.indexOf(r) < 4 ? '> süre sonu' : '—').padStart(17));
}
console.log(`\nToplam simülasyon: ${fmtT(simT)} aktif oyun\n`);
