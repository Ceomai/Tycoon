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

import { tickMemo, freezeRates, permMult, curWeek } from '../../src/economy';
it('adım önbelleği: sonuçlar önbelleksiz hesapla aynı; girdiler değişince permMult yenilenir; adım bitince kapanır', () => {
  setS(newState(Date.now(), '2026-H44', 'ist'));
  S.own = DLIST.slice(0, 3).map(d => d.key);
  for (const k of S.own) S.d[k] = Array.from({ length: 20 }, (_, i) => ({ t: ORDER[i % 4], lvl: 3, buf: 5, until: 0, dur: 1, up: false }));
  const raw = { pm: permMult(), tr: totalRate(true), tb: totalRate(false), pd: pending(), wk: curWeek() };
  tickMemo(true);
  expect(permMult()).toBe(raw.pm); expect(curWeek()).toBe(raw.wk);
  S.ach.push('a', 'b', 'c', 'd'); // arşiv bonusu: aynı adımda değişirse yeniden hesaplanır
  const pm2 = permMult(); expect(pm2).toBeGreaterThan(raw.pm);
  freezeRates();
  const tr = totalRate(true); expect(totalRate(true)).toBe(tr); expect(totalRate(false)).toBeCloseTo(raw.tb * pm2 / raw.pm);
  expect(pending()).toBe(pending()); // aynı nesne: adımda bir kez
  tickMemo(false);
  S.ach.length = 0;
  expect(permMult()).toBe(raw.pm); expect(totalRate(true)).toBeCloseTo(raw.tr); expect(pending()).toEqual(raw.pd);
});
