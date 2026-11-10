// Kritik mantık (Adım 5, karakterizasyon): reklam kapısı. Geçiş reklamı yalnızca zamanı gelince, ilk 30 dk ve
// ödüllü reklam kredisi bitince, açılışın ilk dakikasından sonra, doğal durakta (ya da en fazla 3 dk bekleyip) çıkar;
// Holding/Reklamsız/Kulüp'te hiç çıkmaz. Holding ve Kulüp'te ödül izlemeden verilir.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const h = vi.hoisted(() => ({ toast: vi.fn(), grant: vi.fn((f?: () => void) => f?.()) }));
vi.mock('../../src/ui/modal', () => ({ toast: h.toast, flushQueue: vi.fn(), openModal: vi.fn(), closeModal: vi.fn(), bump: vi.fn() }));
vi.mock('../../src/game/actions', () => ({ grantReward: h.grant, addCash: vi.fn() }));
vi.mock('../../src/game/persist', () => ({ persist: vi.fn() }));
vi.mock('../../src/ui/board', () => ({ render: vi.fn() }));
vi.mock('../../src/ui/sheets', () => ({ openSheet: vi.fn(), closeSheet: vi.fn() }));
vi.mock('../../src/sound', () => ({ Snd: new Proxy({}, { get: () => () => {} }), buzz: Object.assign(vi.fn(), { light: vi.fn(), medium: vi.fn(), success: vi.fn(), error: vi.fn(), select: vi.fn() }) }));

import { Ads } from '../../src/services/ads';
import { adFree, instantRewards } from '../../src/services/purchases';
import { CFG } from '../../src/config';
import { ui } from '../../src/ui/ctx';
import { newState, setS, S } from '../../src/state';

let inter: ReturnType<typeof vi.spyOn>;
const BOOT = 1000;
beforeEach(() => {
  setS(newState(0, 'x', 'ist' as any)); h.toast.mockReset(); h.grant.mockClear();
  ui.bootAt = BOOT; ui.breakAt = -1e9; ui.lastInput = -1e9; ui.ad = false;
  inter = vi.spyOn(Ads, 'interstitial').mockResolvedValue(undefined as any);
  vi.spyOn(Math, 'random').mockReturnValue(0);
  Ads.tickInterstitial(0, false); // bekleyen "zamanı geldi" anını sıfırla (adFree yolu dueAt = 0)
});
afterEach(() => { vi.restoreAllMocks(); });

describe('ayrıcalıklar', () => {
  it('adFree: Holding, Reklamsız ya da Kulüp; instantRewards: yalnız Holding ya da Kulüp', () => {
    expect([adFree(), instantRewards()]).toEqual([false, false]);
    S.noAds = true; expect([adFree(), instantRewards()]).toEqual([true, false]);
    S.noAds = false; S.premium = true; expect([adFree(), instantRewards()]).toEqual([true, true]);
    S.premium = false; S.club = true; expect([adFree(), instantRewards()]).toEqual([true, true]);
  });
  it('anında ödül: reklam açılmadan grantReward ve bildirim', async () => {
    const f = vi.fn(); S.club = true;
    await Ads.rewarded('x', '', f); expect(h.grant).toHaveBeenCalledTimes(1); expect(f).toHaveBeenCalledTimes(1);
    expect(h.toast).toHaveBeenCalledWith('Kulüp: ödül anında');
    S.club = false; S.premium = true; await Ads.rewarded('x', '', f); expect(h.toast).toHaveBeenLastCalledWith('Holding: ödül anında');
  });
  it('başka reklam sürerken: onFail, ödül yok', async () => {
    const f = vi.fn(), no = vi.fn(); ui.ad = true;
    await Ads.rewarded('x', '', f, no); expect(f).not.toHaveBeenCalled(); expect(no).toHaveBeenCalledTimes(1);
    ui.ad = false;
  });
});

describe('geçiş reklamı kapısı (tickInterstitial)', () => {
  const late = BOOT + CFG.BOOT_QUIET_MS + 1;
  it('reklamsız paketlerde hiç çıkmaz', () => {
    S.playMs = 1e9; S.nextAd = 0; S.noAds = true; ui.breakAt = late; Ads.tickInterstitial(late + 1000, true);
    expect(inter).not.toHaveBeenCalled();
  });
  it('zamanı gelmeden çıkmaz', () => {
    S.playMs = 40 * 60e3; S.nextAd = 41 * 60e3; ui.breakAt = late; Ads.tickInterstitial(late + 1000, true);
    expect(inter).not.toHaveBeenCalled();
  });
  it('ilk 30 dk: sıradaki reklam 30. dakikaya ertelenir', () => {
    S.playMs = 20 * 60e3; S.nextAd = 0; Ads.tickInterstitial(late + 1000, true);
    expect(inter).not.toHaveBeenCalled(); expect(S.nextAd).toBe(CFG.FIRST_FREE_MS);
  });
  it('ödüllü reklam kredisi: kredi bitene kadar ertelenir', () => {
    S.playMs = 40 * 60e3; S.nextAd = 0; S.adCredit = 45 * 60e3; Ads.tickInterstitial(late + 1000, true);
    expect(inter).not.toHaveBeenCalled(); expect(S.nextAd).toBe(45 * 60e3);
  });
  it('açılışın ilk dakikası: çıkmaz', () => {
    S.playMs = 40 * 60e3; S.nextAd = 0; ui.breakAt = BOOT + 10; Ads.tickInterstitial(BOOT + 20, true);
    expect(inter).not.toHaveBeenCalled();
  });
  it('doğal durakta ve oyuncu boştayken çıkar; sonraki reklam 15–20 dk sonra', () => {
    S.playMs = 40 * 60e3; S.nextAd = 0;
    ui.breakAt = late; ui.lastInput = late + 500; Ads.tickInterstitial(late + 1000, true); // dokunuştan 0,5 sn sonra: beklenir
    expect(inter).not.toHaveBeenCalled();
    Ads.tickInterstitial(late + 1400, false); // panel açık: beklenir
    expect(inter).not.toHaveBeenCalled();
    Ads.tickInterstitial(late + 1400, true);
    expect(inter).toHaveBeenCalledTimes(1); expect(S.nextAd).toBe(40 * 60e3 + CFG.INTER_MIN);
  });
  it('doğal durak gelmezse en fazla 3 dk beklenir (oyuncu 2 sn boşta)', () => {
    S.playMs = 40 * 60e3; S.nextAd = 0;
    Ads.tickInterstitial(late, true); expect(inter).not.toHaveBeenCalled(); // bekleme başladı
    Ads.tickInterstitial(late + CFG.BREAK_WAIT_MS, true); expect(inter).not.toHaveBeenCalled();
    Ads.tickInterstitial(late + CFG.BREAK_WAIT_MS + 1, true); expect(inter).toHaveBeenCalledTimes(1);
  });
});
