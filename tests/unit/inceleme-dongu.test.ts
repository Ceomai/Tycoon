// İnceleme bulgusu 7: reklam ekranı açıkken (ui.ad) oyun döngüsü kiracı bonusunu kazandırmaz; sözleşme süresi de işlemez.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../src/ui/modal', () => ({
  openModal: vi.fn(), closeModal: vi.fn(), bump: vi.fn(), toast: vi.fn(), flushQueue: vi.fn(), flyTo: vi.fn(async () => {}), flyCoin: vi.fn(async () => {}),
  countUp: vi.fn(), showGain: vi.fn(), bigStamp: vi.fn(), cashText: vi.fn(),
}));
vi.mock('../../src/sound', () => ({ Snd: new Proxy({}, { get: () => () => {} }), buzz: Object.assign(vi.fn(), { light: vi.fn(), medium: vi.fn(), success: vi.fn(), error: vi.fn(), select: vi.fn() }) }));
vi.mock('../../src/game/persist', () => ({ persist: vi.fn(), persistSync: vi.fn(), persistNow: vi.fn(async () => {}), dirty: false, clearDirty: vi.fn() }));
vi.mock('../../src/ui/street', () => ({ Street: { spawn: vi.fn(), idle: vi.fn(), start: vi.fn(), stop: vi.fn(), init: vi.fn() } }));
vi.mock('../../src/services/ads', () => ({ Ads: { rewarded: vi.fn(), native: () => false, privacyRequired: () => false, tickInterstitial: vi.fn() }, adUser: { uid: () => null } }));
vi.mock('../../src/services/cloud', () => ({ Cloud: { ready: () => false, maybePostScore: vi.fn(), pushSave: vi.fn() } }));
vi.mock('../../src/game/rifki', () => ({ maybeTip: vi.fn(), sayEvent: vi.fn() }));
vi.mock('../../src/game/auction', () => ({ ihaleTick: vi.fn() }));

import { newState, setS, S, Plot } from '../../src/state';
import { CFG, setRegion, BuildingType } from '../../src/config';
import { weekKey } from '../../src/format';
import { setLang } from '../../src/i18n';
import { Time } from '../../src/time';
import { rate, withoutTenants } from '../../src/economy';
import { ui, view } from '../../src/ui/ctx';
import { tick, resumeTick } from '../../src/game/loop';
import { tenants, tenantReset } from '../../src/game/tenants';

const DEF = { ...CFG };
const T0 = Date.UTC(2026, 10, 16, 9, 30);
const P = (t: BuildingType, lvl = 3): Plot => ({ t, lvl, buf: 0, until: 0, dur: 1, up: false });
let pnow = 1000;

beforeEach(() => {
  Object.assign(CFG, DEF); Time.offset = T0 - Date.now(); setLang('tr'); setRegion('tr'); tenantReset();
  (globalThis as any).document = { hidden: false, querySelector: () => null };
  vi.spyOn(performance, 'now').mockImplementation(() => pnow);
  view.render = () => {};
  setS(newState(T0, weekKey(new Date(T0)), 'ist'));
  S.d['ist-0'][0] = P('ev', 3); S.collectMode = 'tap'; S.guideHint = true; S.collects = 0; S.rifki = false;
  S.nextEvent = S.nextOffer = S.nextTaxi = S.nextCivic = 9e15; S.nextTen = 9e15; S.market = 'x';
  tenants().push({ id: 1, a: 'ogrenci', k: 'ist-0', i: 0, w: { k: 'lvl' } as any, dl: 0, st: 'live', end: S.playMs + 60e3 });
});
afterEach(() => { vi.restoreAllMocks(); ui.ad = false; Object.assign(CFG, DEF); Time.offset = 0; delete (globalThis as any).document; });

const run = (ms: number) => { resumeTick(); pnow += ms; tick(); };

describe('reklam sırasında kiracı', () => {
  it('ui.ad iken kumbara kiracı bonusu olmadan dolar, sözleşme süresi işlemez', () => {
    const withT = rate('ist-0', 0), noT = withoutTenants(() => rate('ist-0', 0));
    expect(withT).toBeGreaterThan(noT * 1.01);       // kiracı bonusu var
    ui.ad = true; run(1000);
    expect(S.d['ist-0'][0]!.buf).toBeCloseTo(noT, 6);
    expect(S.playMs).toBe(0);
    ui.ad = false; S.d['ist-0'][0]!.buf = 0; run(1000);
    expect(S.d['ist-0'][0]!.buf).toBeCloseTo(withT, 6);
  });
});
