// Kiracılar (game/tenants.ts): istek üretimi ve karşılanma, anahtar teslimi, süreler oyun süresiyle, kayıt temizliği
// (sanitize) ve bulut paketi, lig sayımı, ülkeye göre adlar, proje kancası (hedef dışı arsalar), CFG / Remote Config.
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/ui/modal', () => ({
  openModal: vi.fn(), closeModal: vi.fn(), bump: vi.fn(), toast: vi.fn(), flushQueue: vi.fn(), flyTo: vi.fn(async () => {}), flyCoin: vi.fn(async () => {}),
  countUp: vi.fn(), showGain: vi.fn(), bigStamp: vi.fn(), cashText: vi.fn(),
}));
vi.mock('../../src/game/persist', () => ({ persist: vi.fn(), persistSync: vi.fn(), persistNow: vi.fn(async () => {}), dirty: false, clearDirty: vi.fn() }));
vi.mock('../../src/ui/board', () => ({ render: vi.fn(), Street: { spawn: vi.fn(), idle: vi.fn() } }));
vi.mock('../../src/services/ads', () => ({ Ads: { rewarded: vi.fn(), native: () => false, privacyRequired: () => false, tickInterstitial: vi.fn() }, adUser: { uid: () => null } }));
vi.mock('../../src/sound', () => ({ Snd: new Proxy({}, { get: () => () => {} }), buzz: Object.assign(vi.fn(), { light: vi.fn(), medium: vi.fn(), success: vi.fn(), error: vi.fn(), select: vi.fn() }) }));

import { newState, setS, S, migrate, TEN_ARCHS, Plot } from '../../src/state';
import { CFG, DRULES, REGIONS, setRegion, BuildingType } from '../../src/config';
import { weekKey } from '../../src/format';
import { setLang } from '../../src/i18n';
import { baseRate, rate, tenantMult, withoutTenants, totalRate } from '../../src/economy';
import { sane, applyValues } from '../../src/services/remote';
import { addCash } from '../../src/game/actions';
import { CHAR, liveOf } from '../../src/game/tenantChars';
import {
  tenantTick, spawnTenant, handKey, tenants, tenantAt, candidates, satisfied, inProgress, tenantsOpen, tenantHooks, tenantReset,
  ARCHS, NAMES, COUNTRIES, tName, countryOf, seaLabel, excludeTenantLots, wishTargets, targetLot, stampsOf, quote, wishShort, tenantSay, Tenant,
} from '../../src/game/tenants';

const T = Date.UTC(2026, 10, 16, 12), WK = weekKey(new Date(T));
const P = (t: BuildingType, lvl = 1, extra: Partial<Plot> = {}): Plot => ({ t, lvl, buf: 0, until: 0, dur: 1, up: false, ...extra });
const DEF = { ...CFG };
/** Kiracıların açıldığı tipik bir an: Kadıköy'de 6 ev üretimde, kafe açılmış, kasada para var. */
function setup(cash = 1e6) {
  setS(newState(T, WK, 'ist'));
  const L = S.d['ist-0'];
  for (const i of [0, 1, 2, 4, 5, 6]) L[i] = P('ev', 1);
  S.earned = 5000; S.cash = cash; S.seen = { ev: true, kafe: true }; S.nextTen = 9e15; // vakalar kendi adayını kurar
}
// Izgara 4 sütun: 6. arsanın komşuları 2 (dolu), 5 (dolu), 7 ve 10 (boş).
const step = (ms: number, n = 1, rnd = () => 0.5) => { for (let k = 0; k < n; k++) { S.playMs += ms; tenantTick(ms, rnd); } };
const mk = (x: Partial<Tenant>): Tenant => { const t = { id: 1, a: 'ogrenci', k: 'ist-0', i: 0, w: { k: 'nb', t: 'kafe' }, dl: S.playMs + CFG.TEN_WAIT, st: 'wait', end: 0, ...x } as Tenant; tenants().push(t); return t; };

beforeEach(() => {
  Object.assign(CFG, DEF); setRegion('tr'); setLang('tr'); tenantReset();
  for (const k of Object.keys(tenantHooks) as (keyof typeof tenantHooks)[]) tenantHooks[k] = () => {};
});

describe('istek üretimi', () => {
  it('kafe açılıp 6 bina kira getirmeden açılmaz; açılınca ilk aday TEN_FIRST sonra gelir', () => {
    setup(); S.earned = 500; S.nextTen = 0;
    expect(tenantsOpen()).toBe(false); step(1000, 5); expect(S.nextTen).toBe(0);
    S.earned = 5000; expect(tenantsOpen()).toBe(true);
    step(1000); expect(S.nextTen).toBe(S.playMs + CFG.TEN_FIRST);
    const arrived: Tenant[] = []; tenantHooks.arrive = x => arrived.push(x);
    step(1000, CFG.TEN_FIRST / 1000);
    expect(arrived.length).toBe(1); expect(tenants().length).toBe(1);
    expect(S.nextTen - S.playMs).toBeGreaterThanOrEqual(CFG.TEN_MIN); expect(S.nextTen - S.playMs).toBeLessThanOrEqual(CFG.TEN_MAX);
    expect(S.tdef[arrived[0].a].met).toBe(1);
  });
  it('kiracı yalnızca şu an karşılanmamış, ödenebilir ve kısa sürede yapılabilir şey ister', () => {
    setup();
    const cs = candidates('ist-0');
    expect(cs.length).toBeGreaterThan(0);
    for (const c of cs) {
      const x = { id: 0, a: c.a, k: 'ist-0', i: c.i, w: c.w, dl: 0, st: 'wait', end: 0 } as Tenant;
      expect(satisfied(x), JSON.stringify(c)).toBe(false);
      if (c.w.k === 'lvl') expect(c.w.n).toBe(S.d['ist-0'][c.i]!.lvl + 1); // tek kat
      if (c.w.t) expect(S.seen[c.w.t]).toBe(true);
    }
    // para yokken ve kira yokken pahalı istek gelmez (kafe 1.500)
    setup(0); S.d['ist-0'] = S.d['ist-0'].map((p, i) => (i < 2 ? p : null));
    const poor = candidates('ist-0').filter(c => c.w.t === 'kafe');
    // kasa 0 + 3 dk kira (2 ev) < kafe bedeli: kafe isteği yok
    expect(totalRate(false) * CFG.TEN_AFFORD_SEC).toBeLessThan(1500); expect(poor.length).toBe(0);
  });
  it('aynı anda en fazla TEN_CAP bekleyen aday; aynı tip art arda gelmez', () => {
    setup();
    for (let n = 0; n < 4; n++) spawnTenant(() => 0.3);
    const L = tenants(); expect(L.length).toBe(4); expect(new Set(L.map(x => x.a)).size).toBe(4); // farklı tipler
    tenants().length = 0; tenantReset();
    for (let n = 0; n < 6; n++) { S.nextTen = S.playMs + 1; step(1000); }
    expect(tenants().length).toBe(CFG.TEN_CAP);
    expect(tenants().filter(x => x.st !== 'live').length).toBeLessThanOrEqual(CFG.TEN_CAP);
  });
  it('"sessiz komşu" isteği seyrek: emeklinin istek ağırlığı en düşük', async () => {
    const { ARCH } = await import('../../src/game/tenants');
    const w = ARCH.emekli.wishes, q = w.find(x => x[0] === 'quiet')![1];
    expect(Math.min(...w.map(x => x[1]))).toBe(q); expect(q / w.reduce((a, x) => a + x[1], 0)).toBeLessThan(0.2);
  });
});

describe('karşılanma ve anahtar teslimi', () => {
  it('komşuya istenen kafe kurulunca anahtar hazır; tek dokunuşla yerleşir, kira +%50', () => {
    setup(); const x = mk({ i: 6, w: { k: 'nb', t: 'kafe' } });
    const ready: Tenant[] = [], settled: Tenant[] = []; tenantHooks.ready = y => ready.push(y); tenantHooks.settle = y => settled.push(y);
    expect(handKey(x)).toBe(false); // istek olmadan anahtar yok
    S.d['ist-0'][7] = P('kafe', 0, { until: 1e15 }); // inşaat sürüyor: süre durur
    const dl = x.dl; step(10e3, 6); expect(inProgress(x)).toBe(true); expect(x.dl).toBe(dl + 60e3);
    S.d['ist-0'][7] = P('kafe', 1); step(1000);
    expect(x.st).toBe('ready'); expect(ready.length).toBe(1);
    expect(x.dl - S.playMs).toBeGreaterThanOrEqual(CFG.TEN_READY - 1000);
    const before = baseRate('ist-0', 6);
    expect(handKey(x)).toBe(true); expect(settled.length).toBe(1);
    expect(x.st).toBe('live'); expect(x.end).toBe(S.playMs + CFG.TEN_LIVE);
    expect(baseRate('ist-0', 6) / before).toBeCloseTo(1 + CFG.TEN_BONUS, 9);
    expect(tenantMult('ist-0', 6)).toBe(1.5); expect(S.tdef.ogrenci.ok).toBe(1);
  });
  it('yok sayan oyuncu: istek tesadüfen karşılansa da anahtar verilmezse bonus hiç yok, kiracı gider (ceza yok)', () => {
    setup(); const x = mk({ i: 6 }), left: Tenant[] = []; tenantHooks.leave = y => left.push(y);
    const r0 = baseRate('ist-0', 6), cash0 = S.cash;
    S.d['ist-0'][7] = P('kafe', 1); step(1000); expect(x.st).toBe('ready');
    expect(baseRate('ist-0', 6)).toBe(r0 * (1 + 0)); // ready: bonus yok
    step(1000, CFG.TEN_WAIT / 1000 + 5);
    expect(tenants().length).toBe(0); expect(left.length).toBe(1); expect(S.cash).toBe(cash0);
  });
  it('hatırlatma son TEN_NOTE içinde bir kez; bina yıkılınca kiracı sessizce çekilir', () => {
    setup(); const x = mk({ i: 6 }); let notes = 0; tenantHooks.note = () => { notes++; };
    step(1000, (CFG.TEN_WAIT - CFG.TEN_NOTE) / 1000 + 10); expect(notes).toBe(1); expect(x.noted).toBe(true);
    const left: Tenant[] = []; tenantHooks.leave = y => left.push(y);
    S.d['ist-0'][6] = null; step(1000); expect(tenants().length).toBe(0); expect(left.length).toBe(0);
  });
  it('kat isteği: tadilat bitince hazır; yeni bina isteği: boş arsaya istenen bina', () => {
    setup(); const a = mk({ i: 0, a: 'aile', w: { k: 'lvl', n: 2 } }), b = mk({ i: 10, a: 'sanatci', w: { k: 'new', t: 'ev' } });
    S.d['ist-0'][0]!.lvl = 2; S.d['ist-0'][10] = P('ev', 1); step(1000);
    expect(a.st).toBe('ready'); expect(b.st).toBe('ready');
    S.d['ist-0'][10] = P('dukkan', 1); step(1000); expect(tenantAt('ist-0', 10)).toBe(null); // tür değişti: çekildi
  });
});

describe('süreler oyun süresiyle', () => {
  it('saat (Time) ilerlese de playMs ilerlemedikçe kimse gelmez, gitmez; sözleşme azalmaz', async () => {
    const { Time } = await import('../../src/time');
    setup(); const x = mk({ i: 1, st: 'live', end: S.playMs + CFG.TEN_LIVE });
    const off = Time.offset; Time.offset += 5 * 3600e3; tenantTick(0);
    expect(x.st).toBe('live'); expect(tenants().length).toBe(1); Time.offset = off;
    step(60e3, CFG.TEN_LIVE / 60e3 - 1); expect(tenants().length).toBe(1);
    const ended: Tenant[] = []; tenantHooks.end = y => ended.push(y);
    step(60e3, 2); expect(tenants().length).toBe(0); expect(ended.length).toBe(1);
  });
  it('çevrimdışı kazanç kiracı bonusunu saymaz (withoutTenants)', () => {
    setup(); mk({ i: 6, st: 'live', end: S.playMs + CFG.TEN_LIVE });
    const on = totalRate(false), off = withoutTenants(() => totalRate(false));
    expect(on - off).toBeCloseTo(baseRate('ist-0', 6) - baseRate('ist-0', 6) / 1.5, 9);
    expect(totalRate(false)).toBe(on); // bayrak geri döndü
  });
});

describe('lig sayımı', () => {
  it('kiracı bonusu kira olarak toplanır ve haftalık lig kazancına (week.earned) girer', () => {
    setup(); S.week = { key: weekKey(new Date(Date.now())), earned: 0 };
    const r0 = rate('ist-0', 1); mk({ i: 1, st: 'live', end: S.playMs + CFG.TEN_LIVE });
    const r1 = rate('ist-0', 1); expect(r1).toBeCloseTo(r0 * 1.5, 9);
    addCash(r1 * 60); expect(S.week.earned).toBeCloseTo(r1 * 60, 6); // 1 dk'lık kira: bonus dahil
  });
});

describe('kayıt: sanitize ve bulut paketi', () => {
  const save = (extra: Record<string, unknown>) => JSON.parse(JSON.stringify({ ...newState(T, WK, 'ist'), ...extra }));
  it('eski kayıt (alan yok): varsayılanlar', () => {
    const raw = save({}); delete raw.ten; delete raw.tdef; delete raw.nextTen;
    const s = migrate(raw, T, WK)!; expect(s.ten).toEqual([]); expect(s.tdef).toEqual({}); expect(s.nextTen).toBe(0);
  });
  it('bozuk / elle değiştirilmiş kiracılar düşer, süreler sınırlanır', () => {
    const ok = { id: 5, a: 'aile', k: 'ist-0', i: 3, w: { k: 'lvl', n: 3 }, dl: 1000, st: 'wait', end: 0, noted: true };
    const s = migrate(save({
      playMs: 10e3, nextTen: 'x',
      ten: [ok, { ...ok, i: 3 }, { ...ok, a: 'kral' }, { ...ok, k: 'nyc-0' }, { ...ok, k: 'ist-4' }, { ...ok, i: 20 }, { ...ok, i: 4, st: 'boss' },
        { ...ok, i: 5, w: { k: 'nb' } }, { ...ok, i: 6, w: { k: 'new', t: 'saray' } }, { ...ok, i: 7, w: { k: 'lvl', n: 9 } }, 'çöp', null,
        { ...ok, i: 8, st: 'live', end: 9e15, dl: 9e15 }, { ...ok, i: 9, w: { k: 'new', t: 'ev', sea: true, x: 1 } }],
      tdef: { aile: { met: 4, ok: -2 }, kral: { met: 9, ok: 9 }, emekli: 'x', ogrenci: { met: 2.7, ok: 1 } },
    }), T, WK)!;
    expect(s.ten.map(x => x.i)).toEqual([3, 8, 9]);
    expect(s.ten[0]).toEqual(ok);
    expect(s.ten[1].end).toBe(10e3 + liveOf(CHAR['ist.aile'])); // karakteri semtten (Yılmaz ailesi, Sadık: 75 dk) expect(s.ten[1].dl).toBeLessThanOrEqual(10e3 + CFG.TEN_WAIT);
    expect(s.ten[2].w).toEqual({ k: 'new', t: 'ev', sea: true });
    expect(s.tdef).toEqual({ aile: { met: 4, ok: 0 }, ogrenci: { met: 2, ok: 1 } });
    expect(s.nextTen).toBe(0);
  });
  it('bulut paketi: kiracılar JSON gidiş-dönüşünde (çok bölgeli paket) aynen kalır', () => {
    setup(); mk({ i: 1, st: 'live', end: S.playMs + 10 }); mk({ id: 2, i: 2, a: 'emekli', w: { k: 'quiet' } }); S.tdef = { ogrenci: { met: 1, ok: 1 } }; S.nextTen = 1234;
    const bundle = JSON.parse(JSON.stringify({ b: 1, saves: { tr: S } })), back = migrate(bundle.saves.tr, T, WK)!;
    expect(back.ten).toEqual(S.ten); expect(back.tdef).toEqual(S.tdef); expect(back.nextTen).toBe(1234);
    expect(JSON.stringify(back).length).toBeLessThan(950000);
  });
  it('state.ts doğrulama listesi tenants.ts tipleriyle aynı', () => { expect(TEN_ARCHS).toEqual([...ARCHS]); });
});

describe('adlar, metinler, CFG', () => {
  it('5 ülke × 6 tip yerel ad ve meslek; Global semtin ülkesine göre', () => {
    for (const c of COUNTRIES) for (const a of ARCHS) { const e = NAMES[c][a]; expect(e.n.length && e.r.length, c + a).toBeTruthy(); }
    expect(new Set(COUNTRIES.map(c => NAMES[c].ogrenci.n)).size).toBe(5);
    setRegion('gl');
    expect(countryOf('lon-2')).toBe('uk'); expect(tName('emekli', 'lon-2')[0]).toBe('Mrs Hughes');
    expect(tName('ogrenci', 'tyo-0')[0]).toBe('Yui'); expect(tName('esnaf', 'muc-1')[0]).toBe('Herr Becker');
    expect(tName('aile', 'nyc-3')[0]).toBe('Garcia ailesi'); expect(tName('ogrenci', 'ist-0')[0]).toBe('Ece');
    for (const r of ['us', 'uk', 'de', 'jp'] as const) for (const city of REGIONS[r].cities) expect(countryOf(city + '-0')).toBe(r);
  });
  it('dile göre: meslek çevrilir, aile adı kalıbı dile uyar, Japoncada adlar yerel yazımla', () => {
    setLang('de'); expect(tName('aile', 'muc-0')).toEqual(['Familie Schneider', 'Bergsteigerfamilie']);
    setLang('en'); expect(tName('emekli', 'lon-0')).toEqual(['Mrs Hughes', 'retired librarian']);
    setLang('ja'); expect(tName('ogrenci', 'tyo-0')[0]).toBe('結衣'); expect(tName('aile', 'ist-0')[0]).toBe('ユルマズ一家');
  });
  it('kıyı/cephe adı her "en alt sıra" kuralında tanınıyor; metinler boş değil', () => {
    for (const [k, r] of Object.entries(DRULES)) if (r.kind === 'row') expect(seaLabel(k), k).toBe(r.t.replace(/ \(.*$/, ''));
    setup(); const x = mk({ i: 16, a: 'emekli', k: 'ist-0', w: { k: 'new', t: 'ev', sea: true } });
    for (const ev of ['ten', 'tennote', 'tenready', 'tenok'] as const) expect(tenantSay(ev, x)).not.toMatch(/\{|undefined/);
    expect(quote(x)).toMatch(/^Sahil sırası!/); expect(wishShort(x)).toBe('Sahil sırası: yeni ev');
  });
  it('TEN_* sabitleri CFG\'de ve Remote Config sınır denetiminden geçer; MIN/MAX çifti ters düşerse varsayılan', () => {
    const keys = Object.keys(DEF).filter(k => k.startsWith('TEN_') && typeof (DEF as any)[k] === 'number'); // TEN_TRAITS: JSON (kiraci-karakter.test.ts)
    expect(keys.length).toBeGreaterThanOrEqual(13);
    for (const k of keys) expect(sane(k, (DEF as any)[k]), k).toBe(true);
    expect(sane('TEN_BONUS', 1.5)).toBe(false);
    applyValues({ TEN_MIN: 9 * 60e3, TEN_MAX: 6 * 60e3 }); expect(CFG.TEN_MIN).toBe(DEF.TEN_MIN); expect(CFG.TEN_MAX).toBe(DEF.TEN_MAX);
    applyValues({ TEN_BONUS: 0.3 }); expect(CFG.TEN_BONUS).toBe(0.3);
    setup(); mk({ i: 1, st: 'live', end: 1e12 }); expect(tenantMult('ist-0', 1)).toBe(1.3);
  });
  it('kiracı defteri: müdavim pulu TEN_STAMP yerleşmede; 6 pul Kiracı yeşili', async () => {
    const { skinUnlocked, TENANT_SKIN, SKIN_COLORS } = await import('../../src/game/fun');
    setup(); expect(SKIN_COLORS[TENANT_SKIN].n).toBe('Kiracı yeşili');
    S.tdef = Object.fromEntries(ARCHS.map(a => [a, { met: 3, ok: 3 }])); S.tdef.esnaf.ok = 2;
    expect(stampsOf()).toBe(5); expect(skinUnlocked(TENANT_SKIN)).toBe(false);
    S.tdef.esnaf.ok = 3; expect(stampsOf()).toBe(6); expect(skinUnlocked(TENANT_SKIN)).toBe(true);
  });
});

describe('proje kancası: hedef dışı arsalar', () => {
  it('hariç tutulan arsada kiracı doğmaz, komşu isteği oraya yönelmez, sonradan hariç kalan aday sessizce çekilir', () => {
    setup();
    const off = excludeTenantLots((k, i) => k === 'ist-0' && (i === 0 || i === 3));
    try {
      expect(candidates('ist-0').some(c => c.i === 0 || c.i === 3)).toBe(false);
      const x = mk({ i: 2, w: { k: 'nb', t: 'kafe' } }); // komşuları: 6 (dolu), 1 (dolu), 3 (hariç)
      expect(wishTargets('ist-0').has(3)).toBe(false); expect(targetLot(x)).toBe(2);
      const left: Tenant[] = []; tenantHooks.leave = y => left.push(y);
      const y = mk({ id: 3, i: 4, a: 'aile', w: { k: 'lvl', n: 2 } });
      off(); const off2 = excludeTenantLots((k, i) => k === 'ist-0' && i === 4);
      step(1000); expect(tenants().includes(y)).toBe(false); expect(left.length).toBe(0); off2();
    } finally { off(); }
  });
});
