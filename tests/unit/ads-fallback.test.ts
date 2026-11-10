// Ödüllü reklam başarısız olunca (gösterilemez / ödülsüz kapanır) kartın 1 kat ödülü verilir; seri kurtarma bedava olmaz.
import { describe, it, expect, vi, beforeEach } from 'vitest';

const h = vi.hoisted(() => ({
  mode: 'fail' as 'fail' | 'ok',
  handler: null as null | ((a: string) => void),
  html: '',
  opens: 0,
  addCash: vi.fn(),
}));
vi.mock('../../src/services/ads', () => ({
  Ads: {
    rewarded: vi.fn(async (_k: string, _l: string, onReward: () => void, onFail?: () => void) => { if (h.mode === 'ok') onReward(); else onFail?.(); }),
    native: () => false, privacyRequired: () => false,
  },
}));
vi.mock('../../src/ui/modal', () => ({
  openModal: (html: string, f: (a: string) => void) => { h.html = html; h.handler = f; h.opens++; },
  closeModal: vi.fn(), bump: vi.fn(), toast: vi.fn(), flushQueue: vi.fn(),
}));
vi.mock('../../src/game/actions', () => ({ addCash: h.addCash, addBoost: vi.fn(), grantReward: (f?: () => void) => f?.() }));
vi.mock('../../src/game/persist', () => ({ persist: vi.fn(), persistSync: vi.fn() }));
vi.mock('../../src/game/fun', () => ({ addXp: vi.fn() }));
vi.mock('../../src/game/tasks', () => ({ track: vi.fn() }));
vi.mock('../../src/sound', () => ({ Snd: new Proxy({}, { get: () => () => {} }), buzz: Object.assign(vi.fn(), { light: vi.fn(), medium: vi.fn(), success: vi.fn(), error: vi.fn(), select: vi.fn() }) }));

import { newState, setS, S } from '../../src/state';
import { showEvent } from '../../src/game/events';
import { offerComplete } from '../../src/game/offers';
import { showLeagueResult } from '../../src/game/league';
import { showDaily, checkDaily, dailyAmount } from '../../src/game/daily';
import { Ads } from '../../src/services/ads';
import { dayKey } from '../../src/format';

const T = Date.UTC(2026, 10, 9, 12);
const tap = async (a: string) => { h.handler!(a); await Promise.resolve(); };
const paid = () => h.addCash.mock.calls.map(c => c[0] as number);

beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(T);
  setS(newState(T, 'x', 'ist' as any)); h.mode = 'fail'; h.handler = null; h.opens = 0; h.addCash.mockReset(); (Ads.rewarded as any).mockClear();
});

describe('reklam başarısız: 1 kat ödül', () => {
  it('etkinlik x2', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0); // ilk etkinlik: vergi iadesi (nakit)
    showEvent(); await tap('x2');
    expect(Ads.rewarded).toHaveBeenCalledTimes(1);
    expect(paid()).toHaveLength(1);
    h.addCash.mockReset(); h.mode = 'ok'; showEvent(); await tap('x2');
    const one = paid()[0];
    expect(one).toBeGreaterThan(0);
    vi.restoreAllMocks();
  });
  it('etkinlik: başarısızlıkta verilen tutar, başarıdakinin yarısı', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    h.mode = 'ok'; showEvent(); await tap('x2'); const two = paid()[0];
    h.addCash.mockReset(); h.mode = 'fail'; showEvent(); await tap('x2'); const one = paid()[0];
    expect(one * 2).toBeCloseTo(two);
    vi.restoreAllMocks();
  });
  it('süreli fırsat', async () => {
    S.offer = { k: 'build', goal: 2, prog: 2, until: T + 6e5, title: 'Hızlı müteahhit', rw: 5000, done: true } as any;
    offerComplete(); await tap('x2');
    expect(paid()).toEqual([5000]); expect(S.offer).toBeNull();
  });
  it('lig ikramiyesi', async () => {
    showLeagueResult({ week: 'w1', from: 0, to: 1, rank: 2, size: 30, seal: false });
    await tap('x2');
    expect(paid()).toHaveLength(1);
    const one = paid()[0];
    h.addCash.mockReset(); h.mode = 'ok';
    showLeagueResult({ week: 'w2', from: 0, to: 1, rank: 2, size: 30, seal: false });
    await tap('x2');
    expect(paid()[0]).toBeCloseTo(one * 2);
  });
  it('günlük ödül x2', async () => {
    showDaily(1); await tap('x2');
    expect(paid()).toEqual([dailyAmount(1)]);
    expect(S.daily.last).toBe(dayKey(new Date(T))); expect(S.daily.streak).toBe(1);
  });
});

describe('seri kurtarma: reklam başarısızsa bedava kurtarma yok', () => {
  const yday = (n: number) => dayKey(new Date(T - n * 86400e3));
  it('başarısızlıkta seri korunur, kurtarma kartı yeniden açılır; başarıda kurtarılır', async () => {
    S.daily = { last: yday(2), streak: 4 } as any;
    checkDaily(); expect(h.html).toContain('data-a="save"'); expect(h.opens).toBe(1);
    await tap('save');
    expect(h.opens).toBe(2); expect(h.html).toContain('data-a="save"'); // aynı kart
    expect(S.daily.streak).toBe(4); expect(paid()).toEqual([]);
    h.mode = 'ok'; await tap('save');
    expect(h.html).not.toContain('data-a="save"'); // 5. gün kartı
    await tap('x1'); expect(S.daily.streak).toBe(5);
  });
});
