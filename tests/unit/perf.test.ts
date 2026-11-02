// Ekonomi sıcak yol ölçümü: 15 dolu semt (300 bina), her tick'te çağrılan hesaplar.
import { it, expect } from 'vitest';
import { newState, setS, S } from '../../src/state';
import { totalRate, pending, baseRate } from '../../src/economy';
import { DLIST as ALL, ORDER, CITY_ORDER } from '../../src/config';
const DLIST = ALL.filter(d => CITY_ORDER.includes(d.city)); // etkin bölge: 15 semt
it('15 semt × 20 bina: totalRate/pending/baseRate süresi', () => {
  setS(newState(Date.now(), '2026-H44', 'ist'));
  S.own = DLIST.map(d => d.key);
  for (const d of DLIST) S.d[d.key] = Array.from({ length: 20 }, (_, i) => ({ t: ORDER[i % 4], lvl: 5, buf: 0, until: 0, dur: 1, up: false }));
  const time = (f: () => void, n: number) => { const t = performance.now(); for (let k = 0; k < n; k++) f(); return (performance.now() - t) / n; };
  const tr = time(() => totalRate(true), 200), pe = time(() => pending(), 200);
  const br = time(() => { for (const k of S.own) for (let i = 0; i < 20; i++) baseRate(k, i); }, 200);
  console.log(JSON.stringify({ totalRateMs: +tr.toFixed(3), pendingMs: +pe.toFixed(3), baseRate300Ms: +br.toFixed(3) }));
  expect(tr).toBeLessThan(20);
});
