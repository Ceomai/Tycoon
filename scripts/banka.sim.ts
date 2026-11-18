/* BANKA simülasyonu (npm run sim:banka): ikinci bölgeye başlayan aktif oyuncu, zengin bir bölgeden günlük hakla para aktarır.
   Oyunun gerçek ekonomi kodu (src/economy.ts) ve banka sabitleri (CFG.BANK_FLOOR, CFG.BANK_RENT_MIN) kullanılır.
   Senaryo: oyuncu yeni bölgede (New York) günde H saat aktif oynar; her "gün" başında bankadan hakkın tamamını aktarır (kaynak
   sınırsız zengin). Hak = max(TABAN, DK dakikalık alan bölge taban kirası) · makas + komisyon kaynak tarafında (alana etkisi yok).
   Başlangıç sermayesi (başlanmamış bölgeye emanet) = ilk günün hakkı (taban). Gösterim ölçeği ekonomiye dokunmaz.
   FİYAT SEVİYESİ (CFG.PL_*): kaynakta 1 iç birim hedefte seviye × kur oranı kadar iç birim eder (bankcore levelRatio); hak alan
   bölgenin iç birimiyle sabit olduğu için "kaynak sınırsız" satırları seviyeden bağımsız üst sınırdır. İkinci tablo kaynağı
   SINIRLI alır (bitmiş bir şehir, günde 30 dk'lık kirasını ayırır): ucuz → pahalı ülkeye giden para hakkı dolduramaz (etki
   küçülür), pahalı → ucuz ülkede hak aynı tavanda dolar (etki üst sınırı aşamaz). */
import { TYPES, ORDER, MAXLV, dkey, N, BuildingType, CFG, REGION_ORDER, RegionId, CUR_OF } from '../src/config';
import { levelRatio, costMult, quote } from '../src/game/bankcore';
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
/** src: sınırlı kaynak — günde en çok `out` iç birim gönderebilir, hedefe `net` katı varır. */
interface Bank { floor: number; min: number; dayH: number; unlimited?: boolean; seed?: number; src?: { out: number; net: number } }
function simulate(bank: Bank | null) {
  simT = 0; setClock();
  setS(newState(Time.now(), 'x', city)); S.cash = 150 + (bank?.seed || 0); const seedMoved = bank?.seed || 0;
  const rows: { open: number; full?: number; next?: number }[] = [{ open: 0 }];
  let idx = 0, nextDay = 0, moved = 0, earned4 = 0, done = -1, rateEnd = 0;
  while (simT < HORIZON) {
    if (bank && simT >= nextDay) {
      nextDay += bank.dayH * 3600;
      let inc = 0; for (const k of S.own) inc += districtRate(k);
      let lim = bank.unlimited ? 1e15 : Math.max(bank.floor, bank.min * 60 * inc);
      if (bank.src) lim = Math.min(lim, bank.src.out * bank.src.net);
      S.cash += lim; moved += lim;
    }
    simT += DT; setClock();
    for (const k of S.own) for (const p of lotsOf(S, k) as Lot[]) if (p && p.until && p.until <= simT) { p.until = 0; if (p.up) { p.lvl++; p.up = false; } else p.lvl = 1; }
    let inc = 0; for (const k of S.own) inc += districtRate(k);
    S.cash += inc * DT; S.earned += inc * DT; rateEnd = inc;
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
  return { rows, done: done < 0 ? simT : done, moved: moved + seedMoved, earned4: earned4 || S.earned, rateEnd };
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

/* ---------- fiyat seviyesi: bölge çiftleri ve sınırlı kaynak ---------- */
if (!env.SIM_ONLY) {
  const T0 = Date.UTC(2026, 10, 16, 9, 30), HOUR = 3600e3, regs = REGION_ORDER as RegionId[];
  const best = (a: RegionId, b: RegionId) => { let hi = 0; for (let h = 0; h < 120 * 24; h++) hi = Math.max(hi, quote(a, b, T0 + h * HOUR).net); return hi; };
  const f = (x: number) => (x >= 10 ? x.toFixed(1) : x >= 1 ? x.toFixed(2) : x.toFixed(3));
  console.log('\nFiyat seviyesi · kaynakta 1 iç birim hedefte kaç iç birim (taban kur, makas + komisyon düşülmüş) · satır: gönderen, sütun: alan\n');
  console.log('| | ' + regs.join(' | ') + ' |'); console.log('|---|' + regs.map(() => '---').join('|') + '|');
  for (const a of regs) console.log(`| ${a} | ` + regs.map(b => (a === b ? '—' : f(levelRatio(a, b) * costMult(CUR_OF[a] === CUR_OF[b])))).join(' | ') + ' |');
  let worst = 0, wl = '';
  for (const a of regs) for (const b of regs) if (a !== b) { const v = best(a, b) * best(b, a); if (v > worst) { worst = v; wl = `${a}→${b}→${a}`; } }
  console.log(`\nGidiş-dönüş (her bacak 120 gün içindeki en iyi saatinde), en iyi çift: ${wl} = ${worst.toFixed(4)} (< 1: her zaman zarar)`);
  // sınırlı kaynak: bitmiş bir şehir (taban kirası = banka yok koşusunun sonundaki kira), günde 30 dk'lık kirasını gönderir
  const out = base.rateEnd * 30 * 60;
  const rows: [string, number][] = [
    ['seviyesiz (eski: 1 → 0,97)', costMult(false)],
    ['ucuz → pahalı: TR → ABD', levelRatio('tr', 'us') * costMult(false)],
    ['ucuz → pahalı: TR → BK', levelRatio('tr', 'uk') * costMult(false)],
    ['pahalı → ucuz: ABD → TR', levelRatio('us', 'tr') * costMult(false)],
    ['pahalı → ucuz: BK → TR', levelRatio('uk', 'tr') * costMult(false)],
  ];
  console.log(`\nSınırlı kaynak: bitmiş şehir (taban kira ${Math.round(base.rateEnd).toLocaleString('tr-TR')}/sn), günde 30 dk'lık kirasını gönderir · alan: yeni bölge, CFG hakkı\n`);
  // tek koşu, yatırım sırasına duyarlıdır (açgözlü oyuncu): günde 1–2 sa arası 9 oyun süresinin ortalaması ve aralığı
  const DAYS = Array.from({ length: 9 }, (_, k) => 1 + k * 0.125);
  console.log('| Yön | net (alan / gönderilen) | 5. semt dolu: ortalama fark | aralık | günde 2 sa | günde 1 sa | Alana varan, ortalama (iç birim) |');
  console.log('|---|---|---|---|---|---|---|');
  const pc = (x: number) => (x * 100).toFixed(1) + '%';
  for (const [n, net] of rows) {
    const rs = DAYS.map(dayH => simulate({ floor: F, min: MIN, dayH, src: { out, net } })), ds = rs.map(r => r.done / base.done - 1);
    const avg = ds.reduce((x, y) => x + y, 0) / ds.length, mv = rs.reduce((x, r) => x + r.moved, 0) / rs.length;
    console.log(`| ${n} | ${f(net)} | ${pc(avg)} | ${pc(Math.min(...ds))} … ${pc(Math.max(...ds))} | ${pc(ds[8])} | ${pc(ds[0])} | ${Math.round(mv).toLocaleString('tr-TR')} |`);
  }
}
