/* BANKA simülasyonu (npm run sim:banka): ikinci bölgeye başlayan aktif oyuncu, zengin bir bölgeden günlük hakla para aktarır.
   Oyunun gerçek ekonomi kodu (src/economy.ts) ve banka sabitleri (CFG.BANK_FLOOR, CFG.BANK_RENT_MIN) kullanılır.
   Senaryo: oyuncu yeni bölgede (New York) günde H saat aktif oynar; her "gün" başında bankadan hakkın tamamını aktarır (kaynak
   sınırsız zengin). Hak = max(TABAN, DK dakikalık alan bölge taban kirası) · makas + komisyon kaynak tarafında (alana etkisi yok).
   Başlangıç sermayesi (başlanmamış bölgeye emanet) = ilk günün hakkı (taban). Gösterim ölçeği (kur) ekonomiye dokunmaz. */
import { TYPES, ORDER, MAXLV, dkey, N, BuildingType, CFG } from '../src/config';
import { newState, setS, S, lotsOf, Lot } from '../src/state';
import { Time } from '../src/time';
import { baseRate, buildCost, buildTime, upCost, upTime, isFull, unlockInfo } from '../src/economy';

const START = Date.UTC(2027, 2, 10, 9), DT = 5, HORIZON = 12 * 3600;
let simT = 0;
const setClock = () => { Time.offset = START + simT * 1000 - Date.now(); };
const city = 'nyc';
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
        const cost = buildCost(k, b), time = buildTime(k, b) / 1000, pay = cost / gain + time;
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
interface Bank { floor: number; min: number; dayH: number; unlimited?: boolean; seed?: number }
function simulate(bank: Bank | null) {
  simT = 0; setClock();
  setS(newState(Time.now(), 'x', city)); S.cash = 150 + (bank?.seed || 0); const seedMoved = bank?.seed || 0;
  const rows: { open: number; full?: number; next?: number }[] = [{ open: 0 }];
  let idx = 0, nextDay = 0, moved = 0, earned4 = 0, done = -1;
  while (simT < HORIZON) {
    if (bank && simT >= nextDay) {
      nextDay += bank.dayH * 3600;
      let inc = 0; for (const k of S.own) inc += districtRate(k);
      const lim = bank.unlimited ? 1e15 : Math.max(bank.floor, bank.min * 60 * inc);
      S.cash += lim; moved += lim;
    }
    simT += DT; setClock();
    for (const k of S.own) for (const p of lotsOf(S, k) as Lot[]) if (p && p.until && p.until <= simT) { p.until = 0; if (p.up) { p.lvl++; p.up = false; } else p.lvl = 1; }
    let inc = 0; for (const k of S.own) inc += districtRate(k);
    S.cash += inc * DT; S.earned += inc * DT;
    if (simT === 4 * 3600) earned4 = S.earned;
    const cur = dkey(city, idx), row = rows[idx];
    if (row.full == null && isFull(cur)) { row.full = simT; if (idx === 4) { done = simT; } }
    if (idx < 4) {
      const nk = dkey(city, idx + 1), u = unlockInfo(nk);
      if (u.ok && S.cash >= u.fee) { S.cash -= u.fee; S.own.push(nk); lotsOf(S, nk); S.cur = nk; row.next = simT; idx++; rows.push({ open: simT }); continue; }
    } else if (row.full != null) break;
    let left = Infinity;
    if (row.full != null && idx < 4) { const fee = unlockInfo(dkey(city, idx + 1)).fee; left = Math.max(60, (fee - S.cash) / Math.max(inc, 1e-9)); }
    for (let n = 0; n < 6; n++) {
      const opts = S.own.flatMap(k => options(k, left)).sort((a, b) => a.pay - b.pay);
      const best = opts[0]; if (!best || S.cash < best.cost) break;
      S.cash -= best.cost; best.run();
    }
  }
  return { rows, done: done < 0 ? simT : done, moved: moved + seedMoved, earned4: earned4 || S.earned };
}
const m = (s: number) => Math.round(s / 60);
const base = simulate(null);
const env = (globalThis as any).process?.env || {};
const F = CFG.BANK_FLOOR, MIN = CFG.BANK_RENT_MIN;
const scen: [string, Bank | null][] = [
  ['Banka yok (taban)', null],
  [`CFG (taban ${F} + ${MIN} dk kira/gün), günde 2 sa oyun`, { floor: F, min: MIN, dayH: 2 }],
  ['CFG, günde 1 sa oyun (sık gelen)', { floor: F, min: MIN, dayH: 1 }],
  ['CFG, günde 30 dk oyun (en uç)', { floor: F, min: MIN, dayH: 0.5 }],
  ['Sıkı: 15 dk kira/gün, günde 2 sa', { floor: F, min: 15, dayH: 2 }],
  ['Gevşek: 60 dk kira/gün, günde 2 sa', { floor: F, min: 60, dayH: 2 }],
  [`Yalnız başlangıç sermayesi ${F}`, { floor: 0, min: 0, dayH: 1e9, seed: F }],
  ['LİMİTSİZ (bir kerede sınırsız)', { floor: 0, min: 0, dayH: 1e9, unlimited: true }],
];
if (env.SIM_ONLY) scen.splice(1, scen.length);
console.log('\nBanka · ikinci bölge (New York) · aktif oyuncu\n');
console.log('| Senaryo | Kadıköy-eşi dolu | 2. semt | 3. semt | 4. semt | 5. semt dolu | Fark | Aktarılan (iç birim) |');
console.log('|---|---|---|---|---|---|---|---|');
for (const [n, b] of scen) {
  const r = b ? simulate(b) : base;
  const f = (i: number) => (r.rows[i] && r.rows[i].full != null ? m(r.rows[i].full!) + ' dk' : '—');
  console.log(`| ${n} | ${f(0)} | ${f(1)} | ${f(2)} | ${f(3)} | ${f(4)} | ${b ? ((r.done / base.done - 1) * 100).toFixed(1) + '%' : '—'} | ${b ? (r.moved >= 1e14 ? 'sınırsız' : Math.round(r.moved).toLocaleString('tr-TR')) : '—'} |`);
}
