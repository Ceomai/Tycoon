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
   active: karşılanabilir her isteği hemen yapar ve anahtarı verir. SIM_TEN=table: "önce" (tip tabanlı, karaktersiz, semt düzeni uyum
   kuralı yok) ile bugünkü karakterli kiracıları kiracısız oyuna göre karşılaştırır (60/90/120 dk, son semt dk) · SIM_SEEDS='[1,…,24]' ·
   SIM_CITY=izm ya da SIM_CITIES=1 (15 şehir) · SIM_MODES=passive,half,active · SIM_TRAITS=1|id,… (hepsini tek kişiliğe zorlar) ·
   SIM_TP='{"koklu":[35,86]}' (kişilik denemesi, CFG.TEN_TRAITS) · SIM_NOFIT=1 (uyum kuralını kapatır).
   Büyük projeler (src/game/projcore.ts): SIM_PJ=1 aktif oyuncu projeleri (ve 2. etabı) da aynı geri dönüş ölçütüyle yatırım
   seçeneği sayar · SIM_EXTRA=saat: son semt dolduktan sonra da oyna (kira ölçümü) · ayar: SIM_PJ_X1, SIM_PJ_X2, SIM_PJ_COST
   (yüzde), SIM_PJ_COST2, SIM_PJ_MINLV, SIM_PJ_MAX · SIM_PJ=table: yok sayan / projeler / kiracılar / ikisi birlikte tablosu
   (SIM_SEEDS; SIM_PJ_ONCE=1: geç oyun düşüşü için "önce" ve "gerçekçi oyuncu" satırları da; SIM_PJ_ROWS=ten: yalnız kiracı
   satırları) · tanı: SIM_TYPES=1|2 (tek koşu sonunda semt başına bina türleri / yerleşim), SIM_SKIP=new,nb,lvl,quiet (o istekleri yapmaz),
   SIM_REAL=1 (yalnız kârlı istekleri yapan oyuncu).
   Rakip ve ihale (src/game/auccore.ts, gerçek kurallar): SIM_IH=table · ihaleler oyunun kendi makeAuction / setProxyCore /
   settle / resolve işlevleriyle; takvim (Pazartesi tarihi yapı, Perşembe nadir arsa) aktif oyun süresine sıkıştırılır:
   ihale tablodaki saatte açılır, SIM_IH_LEN dk (50) sonra kapanır (son düzlük son SIM_IH_LATE dk, 15). Oyuncu kasası yettiği an
   Rıfkı'nın önerisini (kazan) ya da tavanın altını (kaybet) vekâlet verir; vekâlet verince son düzlüğe yetecek parayı tutar
   (save: açılıştan biriktirip yatırımı durduran oyuncu). Lig sayacı (ihale çarpanı hariç) ayrıca izlenir. SIM_IH=one SIM_IH_LOG=1: tek koşu.
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
import { tenantTick, tenants, tenantHooks, tenantReset, handKey, targetLot, wishType, tenantSim, charOfT } from '../src/game/tenants';
if (env.SIM_NOFIT) tenantSim.noFit = true; // semt düzeni uyum kuralı kapalı (eski davranış)
/** Kiracı kurgusu: 'once' = 4e3ec9e (tip tabanlı, karaktersiz, semt düzeni uyum kuralı yok) · 'char' = karakterler, uyum kuralı yok ·
 *  'sonra' = bugünkü oyun · 'gercekci' = bugünkü oyun + yalnız kârlı istekleri yapan oyuncu (SIM_REAL=1 ile varsayılan da bu olur). */
type TKurgu = 'once' | 'char' | 'sonra' | 'gercekci';
function kurgu<T>(k: TKurgu, f: () => T): T {
  const o = [charOpts.off, tenantSim.noFit, REAL] as const;
  charOpts.off = k === 'once'; tenantSim.noFit = k === 'once' || k === 'char' || !!env.SIM_NOFIT; REAL = k === 'gercekci' || !!env.SIM_REAL;
  try { return f(); } finally { [charOpts.off, tenantSim.noFit, REAL] = o; }
}
import { charOpts, TRAITS, TraitId, bonusOf, liveOf } from '../src/game/tenantChars';
import { makeAuction, setProxyCore, settle, resolve, advice, heldNeed, pickPrize, placeKoseCore, IH } from '../src/game/auccore';
import { ihaleLotMult } from '../src/economy';
import { blocks, pjStart, pjStage2, pjDue, pjList, kindOf, typesAt, pjCost, pjTime } from '../src/game/projcore';

if (env.SIM_PJ_X1) CFG.PJ_X1 = +env.SIM_PJ_X1; if (env.SIM_PJ_X2) CFG.PJ_X2 = +env.SIM_PJ_X2;
if (env.SIM_PJ_COST) CFG.PJ_COST_PCT = +env.SIM_PJ_COST; if (env.SIM_PJ_COST2) CFG.PJ_COST2 = +env.SIM_PJ_COST2;
if (env.SIM_PJ_MINLV) CFG.PJ_MINLV = +env.SIM_PJ_MINLV; if (env.SIM_PJ_MAX) CFG.PJ_MAX = +env.SIM_PJ_MAX;
let PJ = env.SIM_PJ === '1'; const EXTRA = +(env.SIM_EXTRA || 0) * 3600;
const pstat = { pj: 0, pj2: 0, spent: 0, first: -1, log: [] as string[] };

type TMode = 'off' | 'passive' | 'half' | 'active';
if (env.SIM_TEN_BONUS) CFG.TEN_BONUS = +env.SIM_TEN_BONUS;
if (env.SIM_TP) CFG.TEN_TRAITS = JSON.parse(env.SIM_TP); // kişilik denemesi: {"sadik":[45,70]}
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

let city = env.SIM_CITY || 'ist';
const fmtT = (s: number) => s < 3600 ? `${Math.round(s / 60)} dk` : `${(s / 3600).toFixed(1)} sa`;
const fmtM = (s: number) => `${(s / 60).toFixed(1)} dk`;
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

/** Kiracıyla ilgilenen oyuncu: anahtarı hemen verir; bekleyen kiracının isteğini parası yetiyorsa hemen yapar ("aktif").
 *  SIM_REAL=1 (ya da 'gercekci' kurgusu): isteği yalnız kârlı ya da nötrse yapar — yatırımla aynı ölçüt: bedel, kendi kira artışı ve
 *  kiracı bonusuyla (sözleşme süresince) yatırım ufku içinde (sıradaki tapuya kadar; semt dolmadıysa sınırsız) geri dönmeli.
 *  Ölçüm (SIM_PJ=table SIM_PJ_ONCE=1): geç oyun düşüşünü bu oyuncu modeli değil, oyundaki "yeni bina" isteği yapıyordu; gerçekçi
 *  oyuncu da kısa ufuklu olduğundan uzun vadeli kafe kümesini kaçırır (+3 sa kirada körü körüne oyuncudan geride kalır). */
let serveLeft = Infinity, REAL = !!env.SIM_REAL;
function serveTenants(mode: TMode) {
  for (const x of tenants()) {
    if (mode === 'half' && x.id % 2) continue; // yarı ilgili oyuncu: adayların yarısına bakar
    if (x.st === 'ready') { handKey(x); continue; }
    if (x.st !== 'wait') continue;
    if (env.SIM_SKIP && env.SIM_SKIP.split(',').includes(x.w.k)) continue; // tanı: bu tür isteği hiç yapmaz
    const lots = lotsOf(S, x.k), w = x.w, before = districtRate(x.k);
    /** İstek kârlı mı: bedel ≤ (kira artışı × kalan ufuk) + (kiracı bonusu × sözleşme, ufukla sınırlı). run: işi tamamlanmış say. */
    const worth = (cost: number, time: number, apply: () => () => void) => {
      if (!REAL) return true;
      const undo = apply(); const gain = Math.max(0, districtRate(x.k) - before), tb = baseRate(x.k, x.i) * bonusOf(charOfT(x)); undo();
      const h = Math.max(0, serveLeft - time); return gain * h + tb * Math.min(liveOf(charOfT(x)) / 1000, h) >= cost;
    };
    const startBuild = (i: number, t: BuildingType) => {
      const c = buildCost(x.k, t); if (S.cash < c || lots[i]) return; const time = buildTime(x.k, t) / 1000;
      if (!worth(c, time, () => { lots[i] = { t, lvl: 1, buf: 0, until: 0, dur: 1, up: false }; return () => { lots[i] = null; }; })) return;
      S.cash -= c; lots[i] = { t, lvl: 0, buf: 0, until: simT + time, dur: time, up: false };
    };
    if (w.k === 'nb' || w.k === 'quiet') { const j = targetLot(x); if (j !== x.i) startBuild(j, wishType(x)!); }
    else if (w.k === 'new') startBuild(x.i, w.t!);
    else { const p = lots[x.i]; if (p && !p.until && p.lvl < (w.n || 0)) { const c = upCost(x.k, p), time = upTime(x.k, p) / 1000; if (S.cash >= c && worth(c, time, () => { p.lvl++; return () => { p.lvl--; }; })) { S.cash -= c; p.until = simT + time; p.dur = time; p.up = true; } } }
  }
}
/* ---------- ihale ---------- */
type IhPlan = { at: number; kind: 'lm' | 'arsa'; win: boolean; save?: boolean }[];
let IHP: IhPlan = [], IH_PRE = 0, lgEarned = 0, ihKeep = 0; const ihStat = { won: 0, lost: 0, paid: 0, heldMax: 0 };
const IH_LEN = +(env.SIM_IH_LEN || 50) * 60, IH_LATE = +(env.SIM_IH_LATE || 15) * 60;
/** Kazanmak isteyen oyuncu ihale sürerken yatırıma ara verip vekâleti ve son düzlükteki farkı karşılayacak parayı tutar
 *  (yalnızca o kadarını; fazlası yatırıma gider). Kaybeden plan biriktirmez. */
function ihStep() {
  const ih = IH(), tn = Time.now(), a = ih.cur; ihKeep = 0;
  if (a && !a.done) {
    if (tn >= a.close) { resolve(a); if (env.SIM_IH_LOG) console.log('close', fmtT(simT), a.done, 'my', a.my, 'cap', a.cap, 'paid', a.paid, 'cash', Math.round(S.cash)); if (a.done === 'won') { ihStat.won++; ihStat.paid += a.paid || 0; if (a.kind === 'arsa') { const k = S.cur; let bi = 0, br = -1; for (let i = 0; i < N; i++) { const r = baseRate(k, i); if (r > br) { br = r; bi = i; } } placeKoseCore(k, bi); } } else if (a.my) ihStat.lost++; }
    else {
      const pl = (a as any).plan as IhPlan[0];
      const want = pl.win ? advice(a) : Math.floor(a.cap * 0.9 / a.step) * a.step;
      if (!a.my) { if (want > a.start && S.cash >= heldNeed(a, want, tn)) setProxyCore(a, want, tn); else if (pl.win && pl.save) ihKeep = heldNeed(a, want, tn); }
      settle(a, tn); ihStat.heldMax = Math.max(ihStat.heldMax, a.held);
      if (pl.win && a.my) ihKeep = Math.max(0, Math.min(a.my, a.cap + a.step) - a.held); // son düzlüğe para tut
    }
  }
  for (const pl of IHP) {
    if ((pl as any).done || simT < pl.at || (ih.cur && !ih.cur.done)) continue; (pl as any).done = true;
    const pr = pickPrize(pl.kind); if (!pr) continue;
    let unit = 0; for (const k of S.own) unit += districtRate(k);
    if (env.SIM_IH_LOG) console.log('open', fmtT(simT), pr.kind, 'unit/dk', Math.round(unit * 60), 'cash', Math.round(S.cash));
    const b = makeAuction('sim' + pl.at, pr.kind, pr.prize, pr.city, tn, unit * 60); b.close = tn + IH_LEN * 1000; (b as any).plan = pl; ih.cur = b;
  }
}
let earnedAt: number[] = [], rateAt: number[] = [], endT = -1;
function simulate(mode: TMode = 'off', sd = 1) {
  simT = 0; seed = sd; earnedAt = []; rateAt = []; endT = -1; serveLeft = Infinity; tstat.arrived = tstat.settled = tstat.left = 0; tenantReset();
  pstat.pj = pstat.pj2 = pstat.spent = 0; pstat.first = -1; pstat.log = [];
  setClock();
  setS(newState(Time.now(), 'x', city));
  S.cash = 150;
  IHP.forEach(x => { delete (x as any).done; }); ihStat.won = ihStat.lost = ihStat.paid = ihStat.heldMax = 0; lgEarned = 0; ihKeep = 0;
  S.ihale.got = ['beylerbeyi', 'sirkeci', 'kizlaragasi', 'ankaragar'].slice(0, IH_PRE); CFG.IH_LATE_MS = IH_LATE * 1000;
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
    let inc = 0, lg = 0; for (const k of S.own) for (let i = 0; i < N; i++) { const r = baseRate(k, i); inc += r; lg += r / ihaleLotMult(k, i); }
    S.cash += inc * DT; S.earned += inc * DT; lgEarned += lg * DT; earnedAt.push(S.earned); rateAt.push(inc);
    if (IHP.length) ihStep();
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
    serveLeft = left; // kiracı isteği de aynı ufukla tartılır (bir sonraki adımda)
    for (let n = 0; n < 6; n++) {
      const opts = S.own.flatMap(k => options(k, left)).sort((a, b) => a.pay - b.pay);
      const best = opts[0]; if (!best || S.cash - ihKeep < best.cost) break; // ihale için tutulan para yatırıma gitmez
      S.cash -= best.cost; best.run();
    }
  }
  return rows;
}

const MODE = (env.SIM_TEN || 'off') as TMode | 'table';
if (MODE === 'table') {
  // n1b: karakterli kiracılar · SIM_TRAITS=1 her trait'i tek başına zorlar · SIM_CITIES=1 15 şehirde karşılaştırır
  const SEEDS = (env.SIM_SEEDS ? JSON.parse(env.SIM_SEEDS) : [1, 2, 3, 4, 5, 6, 7, 8]) as number[], at = (m: number) => earnedAt[Math.round(m * 60 / DT) - 1];
  const pct = (v: number, b: number) => `${v >= b ? '+' : '−'}${(Math.abs(v / b - 1) * 100).toFixed(1)}%`;
  const run = (label: string, set: () => void, modes: TMode[] = ['passive', 'half', 'active']) => {
    charOpts.off = false; charOpts.force = ''; set();
    const out: Record<string, number[]> = {};
    for (const m of modes) {
      let e60 = 0, e90 = 0, e120 = 0, arr = 0, ok = 0, fin = 0, op5 = 0;
      for (const sd of SEEDS) { const rows = simulate(m, sd); fin += rows[4] && rows[4].full != null ? rows[4].full / 60 : NaN; op5 += rows[4] ? rows[4].open / 60 : NaN; e60 += at(60); e90 += at(90); e120 += at(120); arr += tstat.arrived; ok += tstat.settled; }
      const n = SEEDS.length; out[m] = [e60 / n, e90 / n, e120 / n, arr / n, ok / n, fin / n, op5 / n];
    }
    return { label, out };
  };
  // 5. tapu dk: son semtin tapusunun alındığı an (ilerleme) · son semt dk: son semtin dolduğu an (greedy oyuncu kirayı dolumdan önde tutabilir)
  const show = (rs: ReturnType<typeof run>[], b: number[], modes: TMode[], fb: number, f5: number) => {
    console.log('Kurgu'.padEnd(26), ...modes.flatMap(m => [`${({ passive: 'Yok sayan', half: 'Yarı', active: 'Aktif' } as any)[m]} 60/90/120`.padStart(26)]), 'Gelen/Yerleşen (aktif)'.padStart(24), '5. tapu dk (aktif)'.padStart(20), 'Son semt dk (aktif)'.padStart(20));
    for (const r of rs) console.log(r.label.padEnd(26), ...modes.map(m => r.out[m].slice(0, 3).map((v, j) => pct(v, b[j])).join(' ').padStart(26)), (r.out.active ? `${r.out.active[3].toFixed(1)} / ${r.out.active[4].toFixed(1)}` : '').padStart(24), (r.out.active ? `${r.out.active[6].toFixed(1)} (${pct(f5, r.out.active[6])})` : '').padStart(20), (r.out.active ? `${r.out.active[5].toFixed(1)} (${pct(fb, r.out.active[5])})` : '').padStart(20));
    console.log('Kiracısız'.padEnd(26), ...modes.map(() => ''.padStart(26)), ''.padStart(24), f5.toFixed(1).padStart(20), fb.toFixed(1).padStart(20));
  };
  const cities = env.SIM_CITIES ? ['ist', 'izm', 'ank', 'nyc', 'la', 'chi', 'lon', 'man', 'edi', 'muc', 'ber', 'ham', 'tyo', 'osa', 'kyo'] : [city];
  for (const c of cities) {
    city = c;
    let fb = 0, f5 = 0; const b = [0, 0, 0]; { const rows = simulate('off', 1); b[0] = at(60); b[1] = at(90); b[2] = at(120); fb = rows[4].full! / 60; f5 = rows[4].open / 60; } // kiracısız oyun tohumdan bağımsız
    console.log(`\nKiracılar · ${CITIES[city].n}, reklamsız aktif oyuncu · +%${Math.round(CFG.TEN_BONUS * 100)} / ${CFG.TEN_LIVE / 60e3} dk · ${SEEDS.length} tohum · fark: kiracısız oyuna göre\n`);
    const modes: TMode[] = env.SIM_MODES ? env.SIM_MODES.split(',') : env.SIM_CITIES ? ['passive', 'active'] : ['passive', 'half', 'active'];
    const rs = [kurgu('once', () => run('Önce (4e3ec9e)', () => { charOpts.off = true; }, modes)), run('Karakterler (bugün)', () => {}, modes)];
    if (env.SIM_TEN_ARA) rs.splice(1, 0, kurgu('char', () => run('Karakterler, kural yok', () => {}, modes)));
    if (env.SIM_TEN_REAL) rs.push(kurgu('gercekci', () => run('Karakterler, gerçekçi oyuncu', () => {}, modes)));
    if (env.SIM_ONLY) rs.splice(0, rs.length);
    if (env.SIM_TRAITS) for (const id of (env.SIM_TRAITS === '1' ? Object.keys(TRAITS) : env.SIM_TRAITS.split(',')) as TraitId[]) rs.push(run(`Hepsi ${TRAITS[id].n} (${((CFG as any).TEN_TRAITS?.[id] || [TRAITS[id].pct, TRAITS[id].min]).join('·')})`, () => { charOpts.force = id; }, modes));
    show(rs, b, modes, fb, f5);
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
  const SDS = (env.SIM_SEEDS ? JSON.parse(env.SIM_SEEDS) : [1, 2, 3, 4, 5, 6, 7, 8]) as number[];
  const avg = (pj: boolean, mode: TMode) => { const sds = mode === 'off' ? [1] : SDS, rs = sds.map(sd => run(pj, mode, sd));
    const o: any = {}; for (const key of Object.keys(rs[0]) as (keyof R)[]) o[key] = key === 'fills' ? rs[0].fills.map((_, j) => rs.reduce((x, r) => x + r.fills[j], 0) / rs.length) : rs.reduce((x, r) => x + (r[key] as number), 0) / rs.length; return o as R; };
  const base = avg(false, 'off');
  const pct = (v: number, b: number) => { const d = (v / b - 1) * 100; return (Math.abs(d) < 0.05 ? '%0' : (d > 0 ? '+%' : '−%') + Math.abs(d).toFixed(1)).replace('.', ','); };
  console.log(`\nBüyük projeler · İstanbul, reklamsız aktif oyuncu · +%${Math.round(CFG.PJ_X1 * 100)} / +%${Math.round(CFG.PJ_X2 * 100)} · semt başına ${CFG.PJ_MAX} · Sv${CFG.PJ_MINLV} · bedel %${CFG.PJ_COST_PCT} · Bebek + ${EXTRA / 3600} sa\n`);
  console.log('| Senaryo | Proje / 2. etap | İlk proje | Semt dolma (dk) | Bebek dolma | Kazanç 2 sa | Kazanç 4 sa | Kira (Bebek dolunca) | Kira (+1 sa) | Kira (+3 sa) | Toplam kazanç |');
  console.log('|---|---|---|---|---|---|---|---|---|---|---|');
  const line = (n: string, r: R) => console.log(`| ${n} | ${r.pj.toFixed(r.pj % 1 ? 1 : 0)} / ${r.pj2.toFixed(r.pj2 % 1 ? 1 : 0)} | ${r.first >= 0 ? fmtT(r.first) : '—'} | ${r.fills.map(v => v.toFixed(0)).join('/')} | ${fmtT(r.full)} | ${pct(r.e2, base.e2)} | ${pct(r.e4, base.e4)} | ${pct(r.rF, base.rF)} | ${pct(r.r1, base.r1)} | ${pct(r.r3, base.r3)} | ${pct(r.eEnd, base.eEnd)} |`);
  line('yok sayan (proje ve kiracı yok)', base);
  if (env.SIM_PJ_ROWS !== 'ten') line('projeler (aktif)', avg(true, 'off'));
  if (env.SIM_PJ_ONCE) { // geç oyun düşüşü: önce · karakterler · uyum kuralı (hepsi körü körüne oyuncu) · sonra (gerçekçi oyuncu)
    line('kiracılar (aktif) · önce: 4e3ec9e', kurgu('once', () => avg(false, 'active')));
    line('kiracılar (aktif) · karakterler, uyum kuralı yok', kurgu('char', () => avg(false, 'active')));
  }
  line('kiracılar (aktif)', avg(false, 'active'));
  if (env.SIM_PJ_ONCE) line('kiracılar (gerçekçi: yalnız kârlı istekler)', kurgu('gercekci', () => avg(false, 'active')));
  if (env.SIM_PJ_ONCE) line('kiracılar + projeler (aktif) · önce', kurgu('once', () => avg(true, 'active')));
  if (env.SIM_PJ_ROWS !== 'ten') line('kiracılar + projeler (aktif)', avg(true, 'active'));
  if (env.SIM_PJ_ONCE) line('kiracılar yarı ilgili + projeler · önce', kurgu('once', () => avg(true, 'half')));
  if (env.SIM_PJ_ROWS !== 'ten') line('kiracılar yarı ilgili + projeler', avg(true, 'half'));
  console.log('');
  (globalThis as any).process.exit(0);
}
if (env.SIM_IH === 'table') {
  // denge tablosu (ihale): 5 semti bitirme süresi ve kazanç; 6 zaman kaydırması (0–0,5 sa) ortalaması; lig sayacı / toplam kazanç
  const OFFS = [0, 0.1, 0.2, 0.3, 0.4, 0.5].map(h => h * 3600);
  type Sc = { n: string; pre?: number; plan?: IhPlan; ten?: TMode; pj?: boolean };
  const L = (h: number, win = true): IhPlan[0] => ({ at: h * 3600, kind: 'lm', win }), A = (h: number, win = true): IhPlan[0] => ({ at: h * 3600, kind: 'arsa', win });
  const run = (sc: Sc) => {
    let end = 0, e3 = 0, rEnd = 0, lgR = 0, won = 0, paid = 0, held = 0, n = 0;
    for (const off of (sc.plan ? OFFS : [0])) {
      IHP = (sc.plan || []).map(x => ({ ...x, at: x.at + off })); IH_PRE = sc.pre || 0; PJ = !!sc.pj;
      const seeds = sc.ten && sc.ten !== 'off' ? [1, 2, 3, 4] : [1];
      for (const sd of seeds) {
        const rows = simulate(sc.ten || 'off', sd); end += rows[4].full!; e3 += earnedAt[Math.min(earnedAt.length, Math.round(2 * 3600 / DT)) - 1]; rEnd += rateAt[rateAt.length - 1]; lgR += lgEarned / S.earned; won += ihStat.won; paid += ihStat.paid; held += ihStat.heldMax; n++;
      }
    }
    IHP = []; return { end: end / n, e3: e3 / n, rEnd: rEnd / n, lg: lgR / n, won: won / n, paid: paid / n, held: held / n };
  };
  const pct = (v: number, b: number) => { const d = (v / b - 1) * 100; return (Math.abs(d) < 0.05 ? '%0' : (d > 0 ? '+%' : '−%') + Math.abs(d).toFixed(1)).replace('.', ','); };
  console.log(`\nRakip ve ihale · İstanbul, reklamsız aktif oyuncu · tarihi yapı +%${Math.round(CFG.IH_LM_X * 100)} · köşe başı +%${Math.round(CFG.IH_KOSE_X * 100)} · açılış ${CFG.IH_LM_OPEN}/${CFG.IH_ARSA_OPEN} dk kira · ihale ${IH_LEN / 60} dk (son düzlük ${IH_LATE / 60} dk)\n`);
  console.log('| Senaryo | 5 semti bitirme | Fark | Kazanç (2 sa) | Kira (bitişte) | Kazanılan · ödenen | Lig sayacı / kazanç |');
  console.log('|---|---|---|---|---|---|---|');
  const S_ = (x: IhPlan[0]) => ({ ...x, save: true });
  const groups: [Sc, Sc[]][] = [
    [{ n: 'yok sayan' }, [
      { n: 'katılıp kaybeden (2 ihale, tavan altı vekâlet)', plan: [L(0.45, false), A(1.3, false)] },
      { n: '1 tarihi yapı kazanır (kasası yetince vekâlet)', plan: [L(0.45)] },
      { n: '1 hafta: tarihi yapı + köşe başı (kasası yetince)', plan: [L(0.45), A(1.3)] },
      { n: '1 hafta, açılıştan biriktiren (yatırımı durdurur)', plan: [S_(L(0.45)), S_(A(1.3))] },
      { n: 'önceki haftalarda 1 yapı (+%3)', pre: 1 },
      { n: 'önceki haftalarda 4 yapı (+%12)', pre: 4 },
      { n: '4 yapı + bu hafta köşe başı', pre: 4, plan: [A(1.3)] },
    ]],
    [{ n: 'kiracı + proje (aktif), ihalesiz', ten: 'active', pj: true }, [
      { n: 'kiracı + proje + 1 hafta ihale', ten: 'active', pj: true, plan: [L(0.45), A(1.3)] },
      { n: 'kiracı + proje + 4 yapı', ten: 'active', pj: true, pre: 4 },
    ]],
  ];
  for (const [b0, rest] of groups) {
    const base = run(b0);
    console.log(`| ${b0.n} | ${fmtM(base.end)} | %0 | %0 | %0 | — | ${base.lg.toFixed(3)} |`);
    for (const sc of rest) { const r = run(sc); console.log(`| ${sc.n} | ${fmtM(r.end)} | ${pct(r.end, base.end)} | ${pct(r.e3, base.e3)} | ${pct(r.rEnd, base.rEnd)} | ${r.won.toFixed(1)} · ödenen ${Math.round(r.paid).toLocaleString('tr')} | ${r.lg.toFixed(3)} |`); }
  }
  console.log('');
  (globalThis as any).process.exit(0);
}
if (env.SIM_IH === 'one') IHP = [{ at: 0.6 * 3600, kind: 'lm', win: true }, { at: 1.3 * 3600, kind: 'arsa', win: true }];
const rows = simulate(MODE as TMode, +(env.SIM_SEED || 1));
if (env.SIM_TYPES) { // tanı: semt başına bina türü / ortalama kat ve kira
  for (const k of S.own) { const c: Record<string, number> = {}; let lv = 0, n = 0; for (const p of lotsOf(S, k) as Lot[]) if (p) { c[p.t] = (c[p.t] || 0) + 1; lv += p.lvl; n++; }
    console.log(k, JSON.stringify(c), 'ort. kat', (lv / Math.max(1, n)).toFixed(2), 'kira/sn', Math.round(districtRate(k)));
    if (env.SIM_TYPES === '2') for (let r = 0; r < 5; r++) console.log('   ' + (lotsOf(S, k) as Lot[]).slice(r * 4, r * 4 + 4).map(p => (p ? p.t[0] + p.lvl : '..')).join(' ')); }
  console.log('toplam kira/sn', Math.round(S.own.reduce((v, k) => v + districtRate(k), 0)), 'kazanç', Math.round(S.earned), 'kiracı', JSON.stringify(tstat));
}
if (PJ) console.log(`büyük proje: ${pstat.pj} proje · ${pstat.pj2} 2. etap · ilk ${pstat.first >= 0 ? fmtT(pstat.first) : '—'}\n${env.SIM_LOG ? pstat.log.join('\n') : ''}`);
if (MODE !== 'off') console.log(`kiracı: ${MODE} · tohum ${env.SIM_SEED || 1} · ${JSON.stringify(tstat)}`);
console.log(`\nTapu · aktif oyuncu (reklamsız), İstanbul · kademe ${JSON.stringify(TIER_M)} · kira artışı ${CFG.TIER_INC} · tapu ${JSON.stringify(TIER_FEE)}\n`);
console.log('Semt'.padEnd(12), 'Açılış'.padStart(9), 'Doldu'.padStart(9), 'Dolma süresi'.padStart(14), 'Duvar (bekleme)'.padStart(17));
for (const r of rows) {
  const fill = r.full != null ? r.full - r.open : null, wall = r.full != null && r.next != null ? r.next - r.full : null;
  console.log(r.n.padEnd(12), fmtT(r.open).padStart(9), (r.full != null ? fmtT(r.full) : '—').padStart(9), (fill != null ? fmtT(fill) : '—').padStart(14), (wall != null ? fmtT(wall) : r.full != null && rows.indexOf(r) < 4 ? '> süre sonu' : '—').padStart(17));
}
console.log(`\nToplam simülasyon: ${fmtT(simT)} aktif oyun\n`);
