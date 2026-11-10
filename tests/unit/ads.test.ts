// Ödüllü reklam (telefon yolu, AdMob taklidi): başarısızlıkta onFail, dinleyici temizliği, eşzamanlı çağrı koruması.
// Taklit eklentinin gerçek sözleşmesini izler: showRewardVideoAd yalnızca ödül kazanılınca çözülür;
// ödülsüz kapanış ve gösterilememe yalnızca Dismissed / FailedToShow olayı yayar (söz hiç çözülmez).
import { describe, it, expect, vi, beforeEach } from 'vitest';

const h = vi.hoisted(() => ({ remove: vi.fn(), on: {} as Record<string, (e?: unknown) => void>, show: vi.fn(), prepare: vi.fn(), toast: vi.fn() }));
vi.mock('@capacitor/core', async orig => {
  const a: any = await orig();
  return { ...a, Capacitor: { ...a.Capacitor, isNativePlatform: () => true, getPlatform: () => 'android' } };
});
vi.mock('@capacitor-community/admob', () => ({
  AdMob: {
    initialize: vi.fn(async () => {}),
    requestConsentInfo: vi.fn(async () => ({ canRequestAds: true, status: 'NOT_REQUIRED' })),
    prepareRewardVideoAd: h.prepare, prepareInterstitial: vi.fn(async () => {}),
    addListener: vi.fn(async (e: string, f: (x?: unknown) => void) => { h.on[e] = f; return { remove: h.remove }; }),
    showRewardVideoAd: h.show,
  },
  RewardAdPluginEvents: { Rewarded: 'onRewardedVideoAdReward', Dismissed: 'onRewardedVideoAdDismissed', FailedToShow: 'onRewardedVideoAdFailedToShow' },
  AdmobConsentStatus: { REQUIRED: 'REQUIRED' },
}));
vi.mock('../../src/ui/modal', () => ({ toast: h.toast, flushQueue: vi.fn(), openModal: vi.fn(), closeModal: vi.fn(), bump: vi.fn() }));
vi.mock('../../src/ui/board', () => ({ render: vi.fn() }));
vi.mock('../../src/sound', () => ({ Snd: new Proxy({}, { get: () => () => {} }), buzz: Object.assign(vi.fn(), { light: vi.fn(), medium: vi.fn(), success: vi.fn(), error: vi.fn(), select: vi.fn() }) }));
vi.mock('../../src/ui/sheets', () => ({ openSheet: vi.fn(), closeSheet: vi.fn() }));

import { Ads } from '../../src/services/ads';
import { ui } from '../../src/ui/ctx';
import { newState, setS } from '../../src/state';

const R = 'onRewardedVideoAdReward', D = 'onRewardedVideoAdDismissed', F = 'onRewardedVideoAdFailedToShow';
const tick = () => new Promise(r => setTimeout(r, 0));
/** Eklenti: ödül olayı + söz çözülür, sonra kapanış. */
const earnThenClose = () => h.show.mockImplementation(() => { setTimeout(() => { h.on[R]?.(); setTimeout(() => h.on[D]?.(), 0); }, 0); return new Promise(r => setTimeout(r, 0)); });
/** Eklenti: ödülsüz kapanış — söz hiç çözülmez, yalnızca Dismissed yayılır. */
const closeNoReward = () => h.show.mockImplementation(() => { setTimeout(() => h.on[D]?.(), 0); return new Promise(() => {}); });

describe('Ads.rewarded (telefon)', () => {
  beforeEach(() => {
    setS(newState(0, 'x')); ui.ad = false; h.on = {};
    h.remove.mockReset(); h.show.mockReset(); h.prepare.mockReset(); h.toast.mockReset();
    h.prepare.mockResolvedValue(undefined);
  });

  it('hazır değilse (init yok) onFail çağrılır; onFail verilmeyen eski çağrı bozulmaz', async () => {
    const ok = vi.fn(), fail = vi.fn();
    await Ads.rewarded('offline', '', ok, fail);
    expect(fail).toHaveBeenCalledTimes(1); expect(ok).not.toHaveBeenCalled();
    await expect(Ads.rewarded('event', '', ok)).resolves.toBeUndefined();
  });

  it('reklam ödülsüz kapanırsa onFail, dinleyici kaldırılır', async () => {
    await Ads.init();
    closeNoReward(); // ödül olayı gelmeden kapandı: söz çözülmez, yalnız Dismissed
    const ok = vi.fn(), fail = vi.fn();
    await Ads.rewarded('offline', '', ok, fail);
    expect(fail).toHaveBeenCalledTimes(1); expect(ok).not.toHaveBeenCalled();
    expect(h.remove).toHaveBeenCalledTimes(3); expect(ui.ad).toBe(false);
  });

  it('gösterim hata verirse onFail, dinleyiciler yine kaldırılır', async () => {
    h.show.mockRejectedValue(new Error('no fill'));
    const ok = vi.fn(), fail = vi.fn();
    await Ads.rewarded('offline', '', ok, fail);
    expect(fail).toHaveBeenCalledTimes(1); expect(ok).not.toHaveBeenCalled();
    expect(h.remove).toHaveBeenCalledTimes(3); expect(ui.ad).toBe(false);
  });

  it('gösterilemezse (FailedToShow olayı, söz çözülmez) onFail ve kilit açılır', async () => {
    h.show.mockImplementation(() => { setTimeout(() => h.on[F]?.({ code: 1 }), 0); return new Promise(() => {}); });
    const ok = vi.fn(), fail = vi.fn();
    await Ads.rewarded('offline', '', ok, fail);
    expect(fail).toHaveBeenCalledTimes(1); expect(ok).not.toHaveBeenCalled(); expect(ui.ad).toBe(false);
    // kilit açık: sonraki istek yeniden gösterim dener
    earnThenClose(); const ok2 = vi.fn(); await Ads.rewarded('event', '', ok2);
    expect(ok2).toHaveBeenCalledTimes(1);
  });

  it('ödül, reklam kapanmadan verilmez (ui.ad kapanışa kadar açık)', async () => {
    let close!: () => void;
    h.show.mockImplementation(() => { setTimeout(() => h.on[R]?.(), 0); close = () => h.on[D]?.(); return Promise.resolve(); });
    const ok = vi.fn(); const run = Ads.rewarded('offline', '', ok);
    await tick(); await tick();
    expect(ok).not.toHaveBeenCalled(); expect(ui.ad).toBe(true);
    close(); await run;
    expect(ok).toHaveBeenCalledTimes(1); expect(ui.ad).toBe(false);
  });

  it('kapanış olayı hiç gelmezse güvenlik süresinden sonra kilit açılır', async () => {
    vi.useFakeTimers();
    try {
      h.show.mockImplementation(() => new Promise(() => {}));
      const fail = vi.fn(); const run = Ads.rewarded('offline', '', vi.fn(), fail);
      await vi.advanceTimersByTimeAsync(151_000); await run;
      expect(fail).toHaveBeenCalledTimes(1); expect(ui.ad).toBe(false);
    } finally { vi.useRealTimers(); }
  });

  it('ödül kazanılırsa onReward, onFail çağrılmaz', async () => {
    earnThenClose();
    const ok = vi.fn(), fail = vi.fn();
    await Ads.rewarded('offline', '', ok, fail);
    expect(ok).toHaveBeenCalledTimes(1); expect(fail).not.toHaveBeenCalled();
  });

  it('süren reklam varken ikinci çağrı yok sayılır (onFail ile 1x verilir)', async () => {
    h.show.mockImplementation(() => new Promise<void>(() => {}));
    const ok1 = vi.fn(), ok2 = vi.fn(), fail2 = vi.fn();
    const first = Ads.rewarded('event', '', ok1);
    await new Promise(r => setTimeout(r, 0));
    await Ads.rewarded('offline', '', ok2, fail2);
    expect(ok2).not.toHaveBeenCalled(); expect(fail2).toHaveBeenCalledTimes(1);
    expect(h.show).toHaveBeenCalledTimes(1);
    h.on[R]!(); h.on[D]!(); await first;
    expect(ok1).toHaveBeenCalledTimes(1);
  });
});
