// Gelir modeli: 2x ipucu hesabı, başlangıç paketi koşulu
import { describe, it, expect, beforeEach } from 'vitest';
import { newState, setS, S } from '../../src/state';
import { saveTarget, boostSaving } from '../../src/game/monetize';
import { totalRate } from '../../src/economy';
const T = Date.now();
const fill = (lvl: number) => Array.from({ length: 20 }, (_, i) => ({ t: (['ev', 'kafe', 'dukkan', 'ofis'] as const)[i % 4], lvl, buf: 0, until: 0, dur: 1, up: false }));
describe('2x ipucu', () => {
  beforeEach(() => { setS(newState(T, 'x', 'ist')); S.d['ist-0'] = fill(1); S.cash = 0; });
  it('hedef bulunduğu ilin sıradaki semti', () => { expect(saveTarget()!.k).toBe('ist-1'); });
  it('ileri semtte (uzun bekleme) 2x anlamlı süre kazandırır', () => {
    S.own = ['ist-0', 'ist-1', 'ist-2']; S.cur = 'ist-2';
    for (const k of S.own) S.d[k] = fill(2);
    S.d['ist-2'][0] = { t: 'ofis', lvl: 4, buf: 0, until: 0, dur: 1, up: false };
    S.cash = 12e6 - totalRate(true) * 1800; // tapuya 30 dk kala
    const tg = saveTarget()!, bs = boostSaving(tg.rem)!;
    console.log(JSON.stringify({ k: tg.k, rem: tg.rem, now: +bs.now.toFixed(1), saved: +bs.saved.toFixed(1) }));
    expect(tg.k).toBe('ist-3');
    expect(bs.saved).toBeGreaterThan(1);
    expect(bs.saved).toBeLessThan(bs.now);
  });
  it('parası yeten oyuncuya ipucu yok', () => { S.cash = 1e9; expect(saveTarget()).toBeNull(); });
});
