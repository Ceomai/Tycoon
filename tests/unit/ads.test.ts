// Ödüllü reklam (telefon yolu, AdMob taklidi): başarısızlıkta onFail, dinleyici temizliği, eşzamanlı çağrı koruması (bulgu 3, 4).
import { describe, it, expect, vi, beforeEach } from 'vitest';

const h = vi.hoisted(() => ({ remove: vi.fn(), listener: null as null | (() => void), show: vi.fn(), prepare: vi.fn(), toast: vi.fn() }));
vi.mock('@capacitor/core', async orig => {
  const a: any = await orig();
  return { ...a, Capacitor: { ...a.Capacitor, isNativePlatform: () => true, getPlatform: () => 'android' } };
});
vi.mock('@capacitor-community/admob', () => ({
  AdMob: {
    initialize: vi.fn(async () => {}),
    requestConsentInfo: vi.fn(async () => ({ canRequestAds: true, status: 'NOT_REQUIRED' })),
    prepareRewardVideoAd: h.prepare, prepareInterstitial: vi.fn(async () => {}),
    addListener: vi.fn(async (_e: string, f: () => void) => { h.listener = f; return { remove: h.remove }; }),
    showRewardVideoAd: h.show,
  },
  RewardAdPluginEvents: { Rewarded: 'onRewardedVideoAdReward' },
  AdmobConsentStatus: { REQUIRED: 'REQUIRED' },
}));
vi.mock('../../src/ui/modal', () => ({ toast: h.toast, flushQueue: vi.fn(), openModal: vi.fn(), closeModal: vi.fn(), bump: vi.fn() }));
vi.mock('../../src/ui/board', () => ({ render: vi.fn() }));
vi.mock('../../src/sound', () => ({ Snd: new Proxy({}, { get: () => () => {} }), buzz: Object.assign(vi.fn(), { light: vi.fn(), medium: vi.fn(), success: vi.fn(), error: vi.fn(), select: vi.fn() }) }));
vi.mock('../../src/ui/sheets', () => ({ openSheet: vi.fn(), closeSheet: vi.fn() }));

import { Ads } from '../../src/services/ads';
import { ui } from '../../src/ui/ctx';
import { newState, setS } from '../../src/state';

describe('Ads.rewarded (telefon)', () => {
  beforeEach(() => {
    setS(newState(0, 'x')); ui.ad = false; h.listener = null;
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
    h.show.mockResolvedValue(undefined); // ödül olayı gelmeden kapandı
    const ok = vi.fn(), fail = vi.fn();
    await Ads.rewarded('offline', '', ok, fail);
    expect(fail).toHaveBeenCalledTimes(1); expect(ok).not.toHaveBeenCalled();
    expect(h.remove).toHaveBeenCalledTimes(1); expect(ui.ad).toBe(false);
  });

  it('gösterim hata verirse onFail, dinleyici yine kaldırılır', async () => {
    h.show.mockRejectedValue(new Error('no fill'));
    const ok = vi.fn(), fail = vi.fn();
    await Ads.rewarded('offline', '', ok, fail);
    expect(fail).toHaveBeenCalledTimes(1); expect(ok).not.toHaveBeenCalled();
    expect(h.remove).toHaveBeenCalledTimes(1); expect(ui.ad).toBe(false);
  });

  it('ödül kazanılırsa onReward, onFail çağrılmaz', async () => {
    h.show.mockImplementation(async () => { h.listener!(); });
    const ok = vi.fn(), fail = vi.fn();
    await Ads.rewarded('offline', '', ok, fail);
    expect(ok).toHaveBeenCalledTimes(1); expect(fail).not.toHaveBeenCalled();
  });

  it('süren reklam varken ikinci çağrı yok sayılır (onFail ile 1x verilir)', async () => {
    let end!: () => void; h.show.mockImplementation(() => new Promise<void>(r => { end = r; }));
    const ok1 = vi.fn(), ok2 = vi.fn(), fail2 = vi.fn();
    const first = Ads.rewarded('event', '', ok1);
    await new Promise(r => setTimeout(r, 0));
    await Ads.rewarded('offline', '', ok2, fail2);
    expect(ok2).not.toHaveBeenCalled(); expect(fail2).toHaveBeenCalledTimes(1);
    expect(h.show).toHaveBeenCalledTimes(1);
    h.listener!(); end(); await first;
    expect(ok1).toHaveBeenCalledTimes(1);
  });
});
