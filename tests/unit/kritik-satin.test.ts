// Kritik mantık (Adım 5, karakterizasyon): satın alma akışları ve ödül verme. Satın alma (web: test kartı; telefon:
// RevenueCat taklidi) yerel ödülü bir kez verir; ödeme ekranı açıkken ikinci dokunuş yok sayılır. Ödüllü reklam
// sonrası ortak işlem (grantReward), 2x jetonu kullanımı ve mülke 2x süresi (en fazla 4 saat).
import { describe, it, expect, vi, beforeEach } from 'vitest';

const h = vi.hoisted(() => ({
  native: false,
  handler: null as null | ((a: string) => void),
  html: '',
  toast: vi.fn(),
  persist: vi.fn(),
  track: vi.fn(),
  purchase: vi.fn(),
  rewarded: vi.fn(),
}));
vi.mock('@capacitor/core', async orig => {
  const a: any = await orig();
  return { ...a, Capacitor: { ...a.Capacitor, isNativePlatform: () => h.native, getPlatform: () => 'android' } };
});
vi.mock('@revenuecat/purchases-capacitor', () => ({
  Purchases: {
    configure: vi.fn(async () => {}),
    getCustomerInfo: vi.fn(async () => ({ customerInfo: { entitlements: { active: {} } } })),
    getOfferings: vi.fn(async () => ({ all: { def: { availablePackages: [
      { identifier: 'tapu_jeton5', product: { identifier: 'tapu_jeton5', priceString: '$2.99' } },
      { identifier: 'tapu_premium', product: { identifier: 'tapu_premium', priceString: '$24.99' } },
    ] } } })),
    purchasePackage: h.purchase,
  },
}));
vi.mock('../../src/ui/modal', () => ({
  openModal: (html: string, f: (a: string) => void) => { h.html = html; h.handler = f; },
  closeModal: vi.fn(), bump: vi.fn(), toast: h.toast, flushQueue: vi.fn(), flyTo: vi.fn(async () => {}), flyCoin: vi.fn(async () => {}),
  countUp: vi.fn(), showGain: vi.fn(), bigStamp: vi.fn(), cashText: vi.fn(),
}));
vi.mock('../../src/game/persist', () => ({ persist: h.persist, persistSync: vi.fn(), persistNow: vi.fn(async () => {}), dirty: false, clearDirty: vi.fn() }));
vi.mock('../../src/ui/board', () => ({ render: vi.fn(), Street: { spawn: vi.fn(), idle: vi.fn() } }));
vi.mock('../../src/services/ads', () => ({ Ads: { rewarded: h.rewarded, native: () => false, privacyRequired: () => false, tickInterstitial: vi.fn() }, adUser: { uid: () => null } }));
vi.mock('../../src/sound', () => ({ Snd: new Proxy({}, { get: () => () => {} }), buzz: Object.assign(vi.fn(), { light: vi.fn(), medium: vi.fn(), success: vi.fn(), error: vi.fn(), select: vi.fn() }) }));

import { newState, setS, S } from '../../src/state';
import { CFG } from '../../src/config';
import { totalRate } from '../../src/economy';
import { Purchases } from '../../src/services/purchases';
import { buyStarter, buyTokens, STARTER_SKIN } from '../../src/game/monetize';
import { grantReward, lotBoost } from '../../src/game/actions';
import * as tasks from '../../src/game/tasks';
import { ui } from '../../src/ui/ctx';

const T = Date.UTC(2026, 10, 9, 12);
const fill = (lvl: number) => Array.from({ length: 20 }, (_, i) => ({ t: (['ev', 'kafe', 'dukkan', 'ofis'] as const)[i % 4], lvl, buf: 0, until: 0, dur: 1, up: false }));
const okTap = () => { expect(h.handler).not.toBeNull(); const f = h.handler!; h.handler = null; f('ok'); };

beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(T);
  setS(newState(T, 'x', 'ist' as any)); S.d['ist-0'] = fill(2) as any;
  h.native = false; h.handler = null; h.html = ''; h.toast.mockReset(); h.persist.mockReset(); h.purchase.mockReset(); h.rewarded.mockReset();
  ui.sheet = null; ui.sheetSig = 'x';
});

describe('satın alma (web/önizleme: test kartı)', () => {
  it('paketler: yetki bayrağı verilir, kayıt yazılır; "Vazgeç" hiçbir şey vermez', async () => {
    await Purchases.buyProduct('holding'); h.handler!('no');
    expect(S.premium).toBe(false); expect(h.persist).not.toHaveBeenCalled();
    await Purchases.buyProduct('holding'); okTap(); expect(S.premium).toBe(true);
    await Purchases.buyProduct('reklamsiz'); okTap(); expect(S.noAds).toBe(true);
    await Purchases.buyProduct('kulup'); okTap(); expect(S.club).toBe(true);
    expect(h.persist).toHaveBeenCalledTimes(3); expect(ui.sheetSig).toBe('');
    expect(h.toast).toHaveBeenCalledTimes(3); // onOk yoksa "{name} aktif"
  });
  it('başlangıç paketi: nakit (≥5000 ya da 2 saatlik kira), 5 jeton, cephe (bir kez), alındı işareti', async () => {
    const cash0 = S.cash, want = Math.max(5000, totalRate(false) * CFG.STARTER_CASH_SEC);
    await buyStarter(); expect(h.html).toContain('₺49,99'); okTap();
    expect(S.cash - cash0).toBeCloseTo(want); expect(S.tokens).toBe(CFG.STARTER_TOKENS);
    expect(S.starter.bought).toBe(true); expect(S.skinsU).toEqual([STARTER_SKIN]);
    await buyStarter(); okTap(); // ikinci kez: cephe yinelenmez
    expect(S.skinsU).toEqual([STARTER_SKIN]); expect(S.tokens).toBe(2 * CFG.STARTER_TOKENS);
  });
  it('jeton paketleri: 5 ve 15 eklenir; ürün ayrı', async () => {
    await buyTokens(5); expect(h.html).toContain('₺29,99'); okTap(); expect(S.tokens).toBe(5);
    await buyTokens(15); expect(h.html).toContain('₺69,99'); okTap(); expect(S.tokens).toBe(20);
  });
  it('Altın Tapu: ilk sezon indirimli ürün, sonra normal ürün; ilk alımda indirim kullanılmış sayılır', async () => {
    const ok = vi.fn();
    await Purchases.buySeason(ok); expect(h.html).toContain('₺49,99'); expect(S.seasonFirst).toBe(false); okTap();
    expect(S.seasonFirst).toBe(true); expect(ok).toHaveBeenCalledTimes(1);
    await Purchases.buySeason(ok); expect(h.html).toContain('₺99,99'); okTap(); expect(ok).toHaveBeenCalledTimes(2);
  });
  it('geri yükleme (web): yetki varsa "geri yüklendi"', async () => {
    await Purchases.restore(); expect(h.toast).toHaveBeenLastCalledWith('Geri yüklenecek satın alım yok');
    S.noAds = true; await Purchases.restore(); expect(h.toast).toHaveBeenLastCalledWith('Satın alım geri yüklendi');
  });
});

describe('satın alma (telefon: RevenueCat)', () => {
  beforeEach(() => { h.native = true; vi.stubEnv('VITE_REVENUECAT_ANDROID', 'k'); });
  it('mağaza paketi yoksa satın alınamaz (bildirim), ödül yok', async () => {
    await Purchases.buyProduct('jeton5'); // init yok
    expect(h.purchase).not.toHaveBeenCalled(); expect(h.toast).toHaveBeenCalledWith('Mağaza şu an kullanılamıyor');
  });
  it('çift dokunuş: ödeme ekranı açıkken ikinci çağrı yok sayılır, ödül bir kez', async () => {
    await Purchases.init('u1'); expect(Purchases.can('jeton5')).toBe(true); expect(Purchases.price('jeton5')).toBe('$2.99');
    let done!: (v: any) => void;
    h.purchase.mockImplementation(() => new Promise(r => { done = r; }));
    const a = buyTokens(5), b = buyTokens(5);
    await b; expect(h.purchase).toHaveBeenCalledTimes(1);
    done({ customerInfo: { entitlements: { active: {} } } }); await a;
    expect(S.tokens).toBe(5);
    h.purchase.mockResolvedValue({ customerInfo: { entitlements: { active: {} } } });
    await buyTokens(5); expect(S.tokens).toBe(10); expect(h.purchase).toHaveBeenCalledTimes(2); // koruma kalktı
  });
  it('iptal: bildirim yok, ödül yok; hata: "tamamlanamadı"', async () => {
    h.purchase.mockRejectedValueOnce({ userCancelled: true });
    await buyTokens(5); expect(S.tokens).toBe(0); expect(h.toast).not.toHaveBeenCalled();
    h.purchase.mockRejectedValueOnce(new Error('x'));
    await buyTokens(5); expect(S.tokens).toBe(0); expect(h.toast).toHaveBeenCalledWith('Satın alma tamamlanamadı');
  });
  it('yetkiler RevenueCat yanıtından gelir (premium)', async () => {
    h.purchase.mockResolvedValue({ customerInfo: { entitlements: { active: { premium: {} } } } });
    await Purchases.buyProduct('holding'); expect(S.premium).toBe(true);
  });
});

describe('ödül verme ve 2x', () => {
  it('grantReward: geri çağrı çalışır, sonraki geçiş reklamı en az 5 dk ertelenir, görev sayılır, kayıt', () => {
    const tr = vi.spyOn(tasks, 'track');
    S.playMs = 10 * 60e3; S.nextAd = 0; const f = vi.fn();
    grantReward(f);
    expect(f).toHaveBeenCalledTimes(1); expect(S.nextAd).toBe(15 * 60e3); expect(h.persist).toHaveBeenCalled();
    expect(tr).toHaveBeenCalledWith('ad');
    S.nextAd = 99 * 60e3; grantReward(); expect(S.nextAd).toBe(99 * 60e3); // daha geç olan korunur
    expect(ui.sheetSig).toBe(''); tr.mockRestore();
  });
  it('mülke 2x (reklam): +1 saat, en fazla 4 saat; doluysa reklam açılmaz', () => {
    h.rewarded.mockImplementation((_k: string, _l: string, f: () => void) => f());
    lotBoost('ist-0', 0); expect(S.d['ist-0'][0]!.bu).toBe(T + CFG.LOT_BOOST);
    for (let n = 0; n < 5; n++) lotBoost('ist-0', 0);
    expect(S.d['ist-0'][0]!.bu).toBe(T + CFG.LOT_BOOST * 4);
    expect(h.rewarded).toHaveBeenCalledTimes(4); // 4. saatten sonra (yarım saat kala) reklam açılmaz
    expect(h.toast).toHaveBeenLastCalledWith('Bu mülkün 2x süresi dolu. En fazla 4 saat birikir.');
    S.d['ist-0'][1] = null; lotBoost('ist-0', 1); expect(h.rewarded).toHaveBeenCalledTimes(4); // boş arsa
  });
});

import { onSheetAction } from '../../src/ui/sheets';
describe('2x jetonu (mülk paneli)', () => {
  it('bir jeton harcanır, reklamsız +1 saat (en fazla 4 saat), görev sayılır; jeton yoksa bir şey olmaz', async () => {
    const tr = vi.spyOn(tasks, 'track');
    S.tokens = 2; ui.sheet = { k: 'plot', key: 'ist-0', i: 0 };
    await onSheetAction('token', { dataset: {} } as any);
    expect(S.tokens).toBe(1); expect(S.d['ist-0'][0]!.bu).toBe(T + CFG.LOT_BOOST);
    expect(h.toast).toHaveBeenLastCalledWith('2x jetonu kullanıldı · 1 saat 2x'); expect(h.persist).toHaveBeenCalledTimes(1);
    expect(tr).toHaveBeenCalledWith('lotboost'); expect(h.rewarded).not.toHaveBeenCalled();
    S.d['ist-0'][0]!.bu = T + CFG.LOT_BOOST_MAX; await onSheetAction('token', { dataset: {} } as any);
    expect(S.tokens).toBe(0); expect(S.d['ist-0'][0]!.bu).toBe(T + CFG.LOT_BOOST_MAX); // üst sınır (düğme bu durumda kapalı)
    await onSheetAction('token', { dataset: {} } as any); expect(S.tokens).toBe(0); expect(h.persist).toHaveBeenCalledTimes(2);
    ui.sheet = null; tr.mockRestore();
  });
});

describe('Altın Tapu satın alma: sezon paneli ile mağaza farkı', () => {
  const setup = () => { S.season = { id: '2026-11', xp: 3 * 500, got: [1, 2, 3], ggot: [], gold: false } as any; };
  it('sezon panelinden: açılır ve birikmiş altın ödüller hemen verilir', async () => {
    setup(); ui.sheet = { k: 'sezon' };
    await onSheetAction('sgold', { dataset: {} } as any); okTap();
    expect(S.season.gold).toBe(true); expect(S.season.ggot).toEqual([1, 2, 3]);
    expect(h.toast).toHaveBeenCalledWith('Altın Tapu açıldı');
  });
  it('mağazadan: yalnızca açılır, ödüller sezon panelinde alınmayı bekler', async () => {
    setup(); ui.sheet = { k: 'store' };
    await onSheetAction('sgold', { dataset: {} } as any); okTap();
    expect(S.season.gold).toBe(true); expect(S.season.ggot).toEqual([]);
    ui.sheet = null;
  });
});

import { catchTaxiReward } from '../../src/game/actions';
describe('altın taksi ödülü (oyun katmanı)', () => {
  it('2 dakikalık kira (en az 100); %8 şansla koleksiyona tarihi yapı', () => {
    const cash0 = S.cash, want = Math.max(100, totalRate(false) * 120);
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    let r = catchTaxiReward(); expect(r.amt).toBeCloseTo(want); expect(S.cash - cash0).toBeCloseTo(want); expect(r.lm).toBeNull();
    (Math.random as any).mockReturnValue(0.01);
    r = catchTaxiReward(); expect(r.lm).not.toBeNull(); expect(S.coll).toEqual([r.lm!.id]); expect(h.persist).toHaveBeenCalledTimes(2);
    S.d['ist-0'] = Array(20).fill(null) as any; expect(catchTaxiReward().amt).toBe(100);
    vi.restoreAllMocks();
  });
});
