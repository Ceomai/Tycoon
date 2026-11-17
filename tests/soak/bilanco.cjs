// Bilançonun bağımsız hesabı (src/game/bankcore.ts valueOf + idx ve ui/sheets/bank.ts inCur'un düz JS kopyası, varsayılan CFG).
// Panelin "Toplam net varlık" rakamını bölge kayıtlarından ayrıca toplayıp karşılaştırmak için.
const CFG = { FX_DAY: 0.0098, FX_HOUR: 0.0049, BANK_SPREAD: 0.01, BANK_FEE: 0.02, BANK_VALUE_X: 0.8, SP_PRICE_MIN: 20000, SP_PRICE_H: 2,
  PJ_COST_PCT: 100, PJ_COST2: 2, IH_LM_OPEN: 15, IH_LM_K: 2.4, IH_ARSA_OPEN: 8, IH_ARSA_K: 2.2, FX_USD_TRY: 43, FX_EUR_USD: 1.15, FX_GBP_USD: 1.33, FX_JPY100_USD: 0.66 };
const TYPES = { ev: 100, kafe: 1500, dukkan: 20000, ofis: 250000 };
const UP_COST = [0, 2, 5, 12, 30], MAXLV = 5, COLS = 4, TIER_M = [1, 10, 100, 1000, 10000], TIER_FEE = [0, 80e3, 1e6, 1.2e7, 1.5e8];
const FEES = [60e3, 600e3, 6e6, 60e6];
const CUR_OF = { tr: 'TRY', us: 'USD', uk: 'GBP', de: 'EUR', jp: 'JPY', gl: 'USD' };
const tryPer = c => ({ USD: 43, EUR: 43 * 1.15, GBP: 43 * 1.33, JPY: 43 * 0.66 / 100, TRY: 1 }[c]);
function h01(s) { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); } h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16; return (h >>> 0) / 4294967296; }
const noise = (c, k, n) => h01(c + k + n) * 2 - 1;
const costMult = (same = false) => (same ? 1 : 1 - CFG.BANK_SPREAD) * (1 - CFG.BANK_FEE);
function amps() { let day = CFG.FX_DAY, hour = CFG.FX_HOUR; const c = costMult(), safe = 0.98 * (1 - c) / (1 + c), a = day + hour; if (a > safe) { day *= safe / a; hour *= safe / a; } return { day, hour }; }
const dayNode = (c, d) => 0.5 * noise(c, ':d', d) + 0.3 * noise(c, ':d', d - 1) + 0.2 * noise(c, ':d', d - 2);
const hourNode = (c, h) => 0.4 * noise(c, ':h', h) + 0.3 * noise(c, ':h', h - 1) + 0.2 * noise(c, ':h', h - 2) + 0.1 * noise(c, ':h', h - 3);
function idx(c, t) { const h = Math.floor(t / 3600e3), d = Math.floor(h / 24), f = (h - d * 24) / 24, A = amps(); return 1 + A.day * (dayNode(c, d) * (1 - f) + dayNode(c, d + 1) * f) + A.hour * hourNode(c, h); }
const midIn = (from, to, t) => { const a = CUR_OF[from], b = CUR_OF[to]; return a === b ? 1 : idx(a, t) / idx(b, t); };
const net = (from, to, t) => midIn(from, to, t) * costMult(CUR_OF[from] === CUR_OF[to]);
const inCur = (x, r, c, t) => x * idx(CUR_OF[r], t) / idx(c, t) / tryPer(c);
const lotCost = (t, m, j, lv) => { let v = TYPES[t] * m * Math.pow(1.12, j); for (let l = 1; l < lv && l < UP_COST.length; l++) v += TYPES[t] * m * UP_COST[l]; return v; };
function valueOf(save) {
  if (!save || !save.city || !Array.isArray(save.own)) return null;
  const rt = save.bank && Number.isFinite(+save.bank.rate) ? Math.max(0, +save.bank.rate) : 0;
  let prop = 0, rent = 0, xc = 0;
  for (const k of save.own) {
    const [city, sidx] = k.split('-'), di = +sidx;
    if (di > 0) prop += TIER_FEE[di]; else if (city !== save.city) { prop += FEES[Math.min(3, xc)]; xc++; }
    const m = TIER_M[di], seen = {}, lots = (save.d && save.d[k]) || [];
    for (const p of lots) {
      if (!p || p.ob || !TYPES[p.t]) continue;
      rent += Math.max(0, +p.buf || 0);
      if (p.sp) { prop += Math.max(CFG.SP_PRICE_MIN, rt * 3600 * CFG.SP_PRICE_H); continue; }
      const j = seen[p.t] || 0; seen[p.t] = j + 1;
      prop += lotCost(p.t, m, j, (p.lvl | 0) + (p.up && p.until ? 1 : 0));
    }
    for (const q of (save.pj && Array.isArray(save.pj[k]) ? save.pj[k] : [])) {
      const cells = [q.a, q.a + 1, q.a + COLS, q.a + COLS + 1].map(j => lots[j]).filter(p => p && TYPES[p.t]);
      const base = cells.reduce((s, p) => s + TYPES[p.t] * m * UP_COST[MAXLV - 1], 0) * CFG.PJ_COST_PCT / 100;
      const st = (q.st | 0) + (q.until ? 1 : 0);
      prop += (st >= 1 ? base : 0) + (st >= 2 ? base * CFG.PJ_COST2 : 0);
    }
  }
  const ih = save.ihale || {}, unit = Math.max(50, rt * 60);
  prop += (ih.got || []).length * unit * CFG.IH_LM_OPEN * CFG.IH_LM_K + (ih.kose || []).length * unit * CFG.IH_ARSA_OPEN * CFG.IH_ARSA_K;
  prop *= CFG.BANK_VALUE_X;
  const debt = Object.values(save.lien || {}).reduce((s, v) => s + (v > 0 ? v : 0), 0);
  const held = ih.cur && !ih.cur.done ? Math.max(0, ih.cur.held || 0) : 0;
  const cash = Math.max(0, +save.cash || 0) + held;
  return { cash, rent, prop, debt, net: cash + rent + prop - debt };
}
/** Tüm bölgelerin net varlığı c parasıyla; emanet: başlanmamış bölgelere yolda bekleyen (hiçbir satırda sayılmayan). */
function total(saves, c, t) {
  let sum = 0, pend = 0; const rows = {};
  for (const r of Object.keys(CUR_OF)) { const v = valueOf(saves[r]); if (v) { rows[r] = inCur(v.net, r, c, t); sum += rows[r]; } }
  for (const r of Object.keys(CUR_OF)) { const s = saves[r]; for (const o of (s && s.bank && s.bank.out) || []) if (!o.s && !saves[o.to]) pend += inCur(o.a, o.to, c, t); }
  return { sum, rows, pend };
}
module.exports = { valueOf, total, inCur, idx, midIn, net, costMult, tryPer, CUR_OF };
