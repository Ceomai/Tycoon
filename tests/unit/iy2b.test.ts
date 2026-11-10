// Adım 2b: mağaza yükleniyor/hata durumu (telefonda sabit fiyat yok), uzak ayar zaman aşımı/sınır kontrolü,
// titreşim ayarı, tema tercihi kaydı.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const h = vi.hoisted(() => ({
  offerings: vi.fn(), configure: vi.fn(async () => {}), impact: vi.fn(async () => {}),
  fetch: vi.fn(), getNumber: vi.fn(), prefGet: vi.fn(), toast: vi.fn(),
}));
vi.mock('@capacitor/preferences', () => ({ Preferences: { get: h.prefGet, set: vi.fn(async () => {}) } }));
vi.mock('@capacitor/core', async orig => {
  const a: any = await orig();
  return { ...a, Capacitor: { ...a.Capacitor, isNativePlatform: () => true, getPlatform: () => 'android' } };
});
vi.mock('@revenuecat/purchases-capacitor', () => ({
  Purchases: { configure: h.configure, getCustomerInfo: vi.fn(async () => ({ customerInfo: { entitlements: { active: {} } } })), getOfferings: h.offerings },
}));
vi.mock('@capacitor/haptics', () => ({ Haptics: { impact: h.impact }, ImpactStyle: { Medium: 'MEDIUM', Light: 'LIGHT' } }));
vi.mock('@capacitor-firebase/remote-config', () => ({ FirebaseRemoteConfig: { fetchAndActivate: h.fetch, getNumber: h.getNumber } }));
vi.mock('../../src/ui/modal', () => ({ toast: h.toast, flushQueue: vi.fn(), openModal: vi.fn(), closeModal: vi.fn(), bump: vi.fn() }));

import { Purchases } from '../../src/services/purchases';
import { Ads } from '../../src/services/ads';
import { applyRemoteConfig, applyValues, sane, REMOTE_TIMEOUT_MS } from '../../src/services/remote';
import { CFG } from '../../src/config';
import { buzz } from '../../src/sound';
import { newState, setS, S } from '../../src/state';
import { loadPrefs, P } from '../../src/prefs';

const pkg = (id: string, price: string) => ({ identifier: id, product: { identifier: id, priceString: price } });

describe('Mağaza (telefon): fiyat yüklenene kadar sabit ₺ yok', () => {
  beforeEach(() => { setS(newState(0, 'x')); vi.stubEnv('VITE_REVENUECAT_ANDROID', 'test-key'); });
  afterEach(() => vi.unstubAllEnvs());

  it('init öncesi: yükleniyor, fiyat "…", satın alınamaz', () => {
    expect(Purchases.state()).toBe('loading');
    expect(Purchases.price('holding')).toBe('…');
    expect(Purchases.price('holding')).not.toMatch(/₺/);
    expect(Purchases.can('holding')).toBe(false);
  });
  it('mağaza hata verirse: hata durumu, fiyat yine "…"; tekrar dene başarılıysa mağaza fiyatı', async () => {
    h.offerings.mockRejectedValueOnce(new Error('ağ yok'));
    await Purchases.init('u1');
    expect(Purchases.state()).toBe('error');
    expect(Purchases.price('reklamsiz')).toBe('…');
    expect(Purchases.can('reklamsiz')).toBe(false);
    h.offerings.mockResolvedValueOnce({ all: { d: { availablePackages: [pkg('tapu_reklamsiz', '$2.99'), pkg('tapu_premium', '$7.99'), pkg('tapu_sezon', '$3.99')] } } });
    await Purchases.retry();
    expect(Purchases.state()).toBe('ready');
    expect(Purchases.price('reklamsiz')).toBe('$2.99');
    expect(Purchases.can('holding')).toBe(true);
    expect(h.configure).toHaveBeenCalledTimes(1); // yeniden denemede RevenueCat ikinci kez kurulmaz
    // paketi gelmeyen ürün: fiyat yok, düğme kapalı; ilk sezon indirimi yoksa normal sezon ürünü
    expect(Purchases.price('jeton5')).toBe('…'); expect(Purchases.can('jeton5')).toBe(false);
    expect(Purchases.can('sezonIlk')).toBe(true); expect(Purchases.seasonPrice()).toBe('$3.99');
  });
});

describe('Uzak ayar: zaman aşımı ve sınır kontrolü', () => {
  const def = { ...CFG };
  afterEach(() => { Object.assign(CFG, def); vi.useRealTimers(); h.fetch.mockReset(); h.getNumber.mockReset(); });

  it('sınır: varsayılanın 1/10–10 katı, oranlar ≤ 1, sayı olmayan/negatif reddedilir', () => {
    expect(sane('INTER_MIN', def.INTER_MIN * 2)).toBe(true);
    expect(sane('INTER_MIN', def.INTER_MIN * 100)).toBe(false);
    expect(sane('OFFLINE_RATE', 0.5)).toBe(true);
    expect(sane('OFFLINE_RATE', 2)).toBe(false);
    expect(sane('CAP_SEC', NaN)).toBe(false); expect(sane('CAP_SEC', -5)).toBe(false); expect(sane('CAP_SEC', '90' as any)).toBe(false);
    expect(sane('YOK', 5)).toBe(false);
  });
  it('MIN > MAX olursa çift varsayılana döner', () => {
    applyValues({ INTER_MIN: def.INTER_MAX * 2, EVENT_MIN: def.EVENT_MIN * 1.5 });
    expect(CFG.INTER_MIN).toBe(def.INTER_MIN); expect(CFG.INTER_MAX).toBe(def.INTER_MAX);
    expect(CFG.EVENT_MIN).toBe(def.EVENT_MIN * 1.5);
  });
  it('yanıt gelmezse 4 sn sonra varsayılanlarla devam; geç gelen değer uygulanmaz', async () => {
    vi.useFakeTimers();
    let release!: () => void;
    h.fetch.mockReturnValue(new Promise<void>(r => { release = r; }));
    h.getNumber.mockResolvedValue({ value: def.CAP_SEC * 2 });
    let done = false; const p = applyRemoteConfig().then(() => { done = true; });
    await vi.advanceTimersByTimeAsync(REMOTE_TIMEOUT_MS - 10); expect(done).toBe(false);
    await vi.advanceTimersByTimeAsync(20); await p; expect(done).toBe(true);
    release(); await vi.advanceTimersByTimeAsync(10);
    expect(CFG.CAP_SEC).toBe(def.CAP_SEC);
  });
  it('zamanında gelen geçerli değer uygulanır, geçersizi atlanır', async () => {
    h.fetch.mockResolvedValue(undefined);
    h.getNumber.mockImplementation(async ({ key }: { key: string }) => ({ value: key === 'CAP_SEC' ? 120 : key === 'KAPORA' ? 5 : 0 }));
    await applyRemoteConfig();
    expect(CFG.CAP_SEC).toBe(120); expect(CFG.KAPORA).toBe(def.KAPORA);
  });
});

describe('Titreşim ayarı', () => {
  beforeEach(() => { setS(newState(0, 'x')); h.impact.mockClear(); });
  it('varsayılan açık; kapalıyken buzz titreştirmez; eski kayıtta alan yoksa açık sayılır', () => {
    expect(S.vib).toBe(true);
    buzz(30); expect(h.impact).toHaveBeenCalledTimes(1);
    S.vib = false; buzz(30); expect(h.impact).toHaveBeenCalledTimes(1);
    delete (S as any).vib; buzz(10); expect(h.impact).toHaveBeenCalledTimes(2);
  });
});

describe('Tema tercihi (tapu-prefs)', () => {
  it('geçerli tema okunur, geçersiz değer otomatik kalır', async () => {
    const get = h.prefGet;
    get.mockResolvedValueOnce({ value: JSON.stringify({ lang: 'tr', region: 'tr', theme: 'dark' }) });
    await loadPrefs(); expect(P.theme).toBe('dark');
    P.theme = 'auto';
    get.mockResolvedValueOnce({ value: JSON.stringify({ lang: 'tr', region: 'tr', theme: 'mor' }) });
    await loadPrefs(); expect(P.theme).toBe('auto');
  });
});

describe('Reklam hatası bildirimi', () => {
  it('reklam yüklenemezse mevcut metin ≥3.5 sn gösterilir, 1x yolu (onFail) çalışır', async () => {
    setS(newState(0, 'x')); h.toast.mockClear(); const fail = vi.fn();
    await Ads.rewarded('event', '', () => {}, fail);
    expect(h.toast).toHaveBeenCalledWith('Reklam şu an yüklenemedi', expect.any(Number));
    expect(h.toast.mock.calls[0][1]).toBeGreaterThanOrEqual(3500);
    expect(fail).toHaveBeenCalledTimes(1);
  });
});
