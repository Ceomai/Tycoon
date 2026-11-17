// Kiracı karakterleri (game/tenantChars.ts, veri tenantChars.data.ts — üretici scripts/kiracilar/gen.mjs):
// 90 karakterin veri kısıtları (üreticinin denetimleri), kişilik çarpımı ve Remote Config, kayıt temizliği (c, sözleşme tavanı,
// eski kayıt, tdc), defter ödülleri (şehir rozeti, ülke cephe rengi, kartpostal, Kiracı yeşili korunur), portre determinizmi.
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/ui/modal', () => ({
  openModal: vi.fn(), closeModal: vi.fn(), bump: vi.fn(), toast: vi.fn(), flushQueue: vi.fn(), flyTo: vi.fn(async () => {}), flyCoin: vi.fn(async () => {}),
  countUp: vi.fn(), showGain: vi.fn(), bigStamp: vi.fn(), cashText: vi.fn(),
}));
vi.mock('../../src/game/persist', () => ({ persist: vi.fn(), persistSync: vi.fn(), persistNow: vi.fn(async () => {}), dirty: false, clearDirty: vi.fn() }));
vi.mock('../../src/ui/board', () => ({ render: vi.fn(), Street: { spawn: vi.fn(), idle: vi.fn() } }));
vi.mock('../../src/services/ads', () => ({ Ads: { rewarded: vi.fn(), native: () => false, privacyRequired: () => false, tickInterstitial: vi.fn() }, adUser: { uid: () => null } }));
vi.mock('../../src/sound', () => ({ Snd: new Proxy({}, { get: () => () => {} }), buzz: Object.assign(vi.fn(), { light: vi.fn(), medium: vi.fn(), success: vi.fn(), error: vi.fn(), select: vi.fn() }) }));

import { newState, setS, S, migrate, Plot } from '../../src/state';
import { CFG, REGIONS, CITIES, CITY_ORDER, TYPES, setRegion, BuildingType, CityId, DMAP } from '../../src/config';
import { weekKey } from '../../src/format';
import { setLang } from '../../src/i18n';
import { tenantMult, baseRate, withoutTenants } from '../../src/economy';
import { applyValues } from '../../src/services/remote';
import {
  ARCH, ARCHS, NAMES, tenants, spawnTenant, handKey, tenantReset, tName, charOfT, candidates, stampsOf, cityBadge, cityCount, countryDone,
  countryCities, postcards, bonusPct, liveMin, tenantSim,
} from '../../src/game/tenants';
import {
  CHARS, CHAR, TRAITS, TRAIT_IDS, charsOf, bonusOf, liveOf, maxLive, traitPM, saneTraitPair, cleanTraitCfg, charOpts, TChar,
} from '../../src/game/tenantChars';
import { tenantFace, tenantBadge, LEGACY_LOOK, SKINS } from '../../src/ui/tenantFace';
import { SKIN_COLORS, TENANT_SKIN, COUNTRY_SKIN, skinUnlocked, skinShown } from '../../src/game/fun';

const T = Date.UTC(2026, 10, 16, 12), WK = weekKey(new Date(T));
const P = (t: BuildingType, lvl = 1): Plot => ({ t, lvl, buf: 0, until: 0, dur: 1, up: false });
const DEF = { ...CFG };
const sum = (w: [string, number, string?][]) => w.reduce((v, x) => v + x[1], 0);
const by = <K extends string>(f: (c: TChar) => K) => CHARS.reduce((m, c) => ((m[f(c)] ||= []).push(c), m), {} as Record<K, TChar[]>);
const allCities = Object.values(REGIONS).flatMap(r => r.cities).filter((c, i, a) => a.indexOf(c) === i) as CityId[];

beforeEach(() => {
  Object.assign(CFG, DEF); CFG.TEN_TRAITS = {}; charOpts.off = false; charOpts.force = '';
  setRegion('tr'); setLang('tr'); tenantReset();
});

describe('90 karakter: veri kısıtları (scripts/kiracilar/gen.mjs ile aynı denetimler)', () => {
  it('15 şehir × 6 tip; kimlik "şehir.tip"; ülke şehrin ülkesi', () => {
    expect(CHARS.length).toBe(90); expect(allCities.length).toBe(15);
    for (const city of allCities) {
      const L = charsOf(city); expect(L.length, city).toBe(6);
      expect(new Set(L.map(c => c.a)), city).toEqual(new Set(ARCHS));
      for (const c of L) { expect(c.id).toBe(`${city}.${c.a}`); expect(REGIONS[c.country].cities, c.id).toContain(city); }
    }
    expect(Object.keys(CHAR).length).toBe(90);
  });
  it('şehir içinde 6 kişilik farklı; ülke içinde aynı tipin 3 karakterinin kişiliği farklı ("isim aynı olsa bile")', () => {
    for (const [city, L] of Object.entries(by(c => c.city))) expect(new Set(L.map(c => c.trait)).size, city).toBe(6);
    for (const [k, L] of Object.entries(by(c => c.country + '.' + c.a))) { expect(L.length, k).toBe(3); expect(new Set(L.map(c => c.trait)).size, k).toBe(3); }
    for (const [k, L] of Object.entries(by(c => c.city + '.' + c.n))) expect(L.length, k).toBe(1);
    // her ülkede en az bir gezgin (kartpostal); kişilikler veride tanımlı
    for (const r of ['tr', 'us', 'uk', 'de', 'jp'] as const) expect(CHARS.some(c => c.country === r && TRAITS[c.trait].rare), r).toBe(true);
    for (const c of CHARS) expect(TRAIT_IDS, c.id).toContain(c.trait);
  });
  it('istek havuzu: toplam ağırlık tipinkine eşit (tipin gelme sıklığı aynı), türler geçerli, sessiz komşu seyrek', () => {
    for (const c of CHARS) {
      expect(Math.abs(sum(c.wishes) - sum(ARCH[c.a].wishes)), c.id).toBeLessThan(0.05);
      for (const [k, n, b] of c.wishes) {
        expect(['nb', 'quiet', 'lvl', 'new'], c.id).toContain(k); expect(n, c.id).toBeGreaterThan(0);
        if (b) expect(TYPES[b], c.id + b).toBeTruthy();
        if (k === 'new') expect(b, c.id).toBeTruthy();
      }
      const q = c.wishes.find(w => w[0] === 'quiet');
      if (q) { expect(q[1] / sum(c.wishes), c.id).toBeLessThanOrEqual(0.2); expect(ARCH[c.a].rents, c.id).toContain('ev'); }
      if (c.sea) expect(c.trait).toBe('manzaraci');
      expect(c.r.length, c.id).toBeLessThanOrEqual(40); expect(c.q.length, c.id).toBeGreaterThan(10);
    }
  });
  it('kişilik: her biri bonus × süre temel (%50 × 60 dk) ile ±%5; beş "süre" kişiliği dışındakiler temel değerde', () => {
    for (const id of TRAIT_IDS) {
      const T0 = TRAITS[id]; expect(saneTraitPair([T0.pct, T0.min]), id).toBe(true);
      if (!['sabirsiz', 'sadik', 'coskulu', 'koklu', 'gezgin'].includes(id)) expect([T0.pct, T0.min], id).toEqual([50, 60]);
    }
    expect(traitPM('koklu')).toEqual([35, 86]); expect(maxLive()).toBe(86 * 60e3);
  });
  it('eski 30 ad korunur: ülkenin ilk şehrinin (Global şehirleri) karakterleri bugünkü NAMES ile aynı ad', () => {
    for (const [r, city] of [['tr', 'ist'], ['us', 'nyc'], ['uk', 'lon'], ['de', 'muc'], ['jp', 'tyo']] as const)
      for (const a of ARCHS) expect(CHAR[`${city}.${a}`].n, city + a).toBe(NAMES[r][a].n);
  });
  it('portre parametreleri geçerli (ten 0–7, renkler #rrggbb)', () => {
    for (const c of CHARS) {
      const L = c.look; expect(L.s >= 0 && L.s < SKINS.length, c.id).toBe(true);
      for (const col of [L.h, L.c]) expect(col, c.id).toMatch(/^#[0-9a-f]{6}$/i);
      expect(Array.isArray(L.a), c.id).toBe(true);
    }
  });
});

describe('kişilik çarpımı ve Remote Config', () => {
  it('bonusOf/liveOf temel × (yüzde/50, dk/60); TEN_BONUS / TEN_LIVE değişince ölçeklenir, çarpım korunur', () => {
    for (const c of CHARS) {
      const [p, m] = traitPM(c.trait);
      expect(bonusOf(c)).toBeCloseTo(CFG.TEN_BONUS * p / 50, 9); expect(liveOf(c)).toBe(Math.round(CFG.TEN_LIVE * m / 60));
      const prod = (bonusOf(c) / CFG.TEN_BONUS) * (liveOf(c) / CFG.TEN_LIVE); expect(prod, c.id).toBeGreaterThanOrEqual(0.95); expect(prod, c.id).toBeLessThanOrEqual(1.05);
    }
    CFG.TEN_BONUS = 0.4; CFG.TEN_LIVE = 30 * 60e3;
    expect(bonusOf(CHAR['ist.yazilimci'])).toBeCloseTo(0.4 * 60 / 50, 9); expect(liveOf(CHAR['ist.yazilimci'])).toBe(25 * 60e3); // Kaan: Sabırsız
    expect(bonusOf(null)).toBe(0.4); expect(liveOf(null)).toBe(30 * 60e3);
  });
  it('CFG.TEN_TRAITS geçersiz kılar; Remote Config JSON metni doğrulanır, bozuk çift düşer', () => {
    CFG.TEN_TRAITS = { koklu: [40, 75] }; expect(liveOf(CHAR['ank.aile'])).toBe(75 * 60e3); // Arslan ailesi: Köklü
    CFG.TEN_TRAITS = { koklu: [10, 60] }; expect(liveOf(CHAR['ank.aile'])).toBe(86 * 60e3);     // çarpım bandı dışı: veri değeri
    expect(saneTraitPair([60, 50])).toBe(true); expect(saneTraitPair([100, 60])).toBe(false); expect(saneTraitPair(['60', 50])).toBe(false); expect(saneTraitPair([60])).toBe(false);
    expect(cleanTraitCfg('{"sabirsiz":[55,55],"koklu":[30,30],"kral":[50,60],"sadik":"x"}')).toEqual({ sabirsiz: [55, 55] });
    expect(cleanTraitCfg('bozuk{')).toBeNull(); expect(cleanTraitCfg(5)).toBeNull();
    CFG.TEN_TRAITS = {};
    expect(applyValues({ TEN_TRAITS: '{"gezgin":[75,40]}' })).toContain('TEN_TRAITS'); expect(CFG.TEN_TRAITS).toEqual({ gezgin: [75, 40] });
    expect(liveOf(CHAR['izm.ogrenci'])).toBe(40 * 60e3); // Melis: Gezgin
    CFG.TEN_TRAITS = {}; expect(applyValues({ TEN_TRAITS: '{"gezgin":[200,40]}' })).not.toContain('TEN_TRAITS'); expect(CFG.TEN_TRAITS).toEqual({});
    expect(applyValues({ TEN_TRAITS: '' })).not.toContain('TEN_TRAITS');
  });
});

/** Kiracıların açıldığı tipik an (Kadıköy'de 6 ev). */
function setup(city: CityId = 'ist', region: 'tr' | 'us' | 'uk' | 'de' | 'jp' | 'gl' = 'tr') {
  setRegion(region); setS(newState(T, WK, city));
  const k = S.cur, L = S.d[k];
  for (const i of [0, 1, 2, 4, 5, 6]) L[i] = P('ev', 1);
  S.earned = 5000; S.cash = 1e6; S.seen = { ev: true, kafe: true, dukkan: true, ofis: true }; S.nextTen = 9e15;
  return k;
}

describe('oyunda: aday, anahtar, kira', () => {
  it('spawnTenant karakteri (c) semtin şehrinden yazar; tdc tanışma sayar; anahtarla süre ve kira kişiliğe göre', () => {
    for (const [city, region] of [['ist', 'tr'], ['izm', 'tr'], ['la', 'us'], ['edi', 'uk'], ['ham', 'de'], ['kyo', 'jp'], ['tyo', 'gl']] as const) {
      const k = setup(city, region); let r = 0.1;
      for (let n = 0; n < 6; n++) {
        const x = spawnTenant(() => (r = (r * 7.3) % 1))!; expect(x, city).toBeTruthy();
        expect(x.c).toBe(`${DMAP[x.k].city}.${x.a}`); expect(CHAR[x.c!].city).toBe(city);
        expect(S.tdc[x.c!].met).toBeGreaterThan(0); expect(charOfT(x)).toBe(CHAR[x.c!]);
      }
      // anahtar: isteği karşılanmış hâle getir
      const x = tenants()[0]; x.st = 'ready'; x.w = { k: 'lvl', n: 1 }; const L = S.d[x.k]; L[x.i] = P(CHAR[x.c!].a === 'esnaf' ? 'dukkan' : CHAR[x.c!].a === 'yazilimci' ? 'ofis' : 'ev', 2);
      const before = withoutTenants(() => baseRate(x.k, x.i));
      expect(handKey(x)).toBe(true); expect(x.end - S.playMs).toBe(liveOf(CHAR[x.c!])); expect(S.tdc[x.c!].ok).toBe(1);
      expect(tenantMult(x.k, x.i)).toBeCloseTo(1 + bonusOf(CHAR[x.c!]), 9); expect(baseRate(x.k, x.i) / before).toBeCloseTo(1 + bonusOf(CHAR[x.c!]), 9);
      expect(bonusPct(x)).toContain(String(TRAITS[CHAR[x.c!].trait].pct)); expect(liveMin(x)).toBe(traitPM(CHAR[x.c!].trait)[1]);
      void k;
    }
  });
  it('ad ve meslek karakterden, dile göre; Japoncada yerel yazım; aynı ad farklı şehirde farklı kişi olabilir', () => {
    setRegion('tr');
    expect(tName('emekli', 'izm-0')).toEqual(['Şükran Hanım', 'Kordon’da koşan emekli beden öğretmeni']);
    setLang('en'); expect(tName('emekli', 'izm-0')[1]).toBe('retired PE teacher who jogs the seafront');
    setLang('ja'); expect(tName('ogrenci', 'osa-0')[0]).toBe('陽翔'); expect(tName('aile', 'ank-0')[0]).toMatch(/アルスラン/);
    setLang('de'); expect(tName('aile', 'ham-0')[0]).toBe('Familie Petersen');
  });
  it('istek havuzu karakterden: Huzur sever dışında sessiz komşu istenmez; Manzara sever kıyı sırası ağırlığı ×2', () => {
    // Nevin Teyze (ist.emekli, Huzur sever) sessiz komşu ağırlığı tipinkinden fazla; Şükran Hanım (izm, Manzara sever) sea ×2
    const q = (c: TChar) => (c.wishes.find(w => w[0] === 'quiet') || [0, 0])[1];
    expect(q(CHAR['ist.emekli'])).toBeGreaterThan(0.5); expect(CHAR['izm.emekli'].sea).toBe(2);
    // aynı arsada sahil isteği: manzara sever ×2 (Çeşme izm-4 sahil kuralı)
    setup('izm'); S.own.push('izm-4'); S.cur = 'izm-4'; S.d['izm-4'] = Array(20).fill(null);
    const sea = candidates('izm-4').filter(c => c.a === 'emekli' && c.w.sea);
    charOpts.off = true; const sea0 = candidates('izm-4').filter(c => c.a === 'emekli' && c.w.sea); charOpts.off = false;
    expect(sea.length).toBeGreaterThan(0);
    const wOf = (L: typeof sea) => L.reduce((v, c) => v + c.wt, 0) / L.length;
    expect(wOf(sea) / wOf(sea0)).toBeCloseTo(2 * CHAR['izm.emekli'].wishes.find(w => w[0] === 'new')![1] / 2, 5);
  });
});

describe('semt düzeni uyum kuralı (geç oyun düşüşü düzeltmesi)', () => {
  it('yeni bina isteği, yanında üst türden bina olan boş arsaya alt tür istemez; uzaktaki arsaya, kat ve komşu isteklerine dokunmaz', () => {
    const k = setup('ist'); S.cash = 1e9;
    // ızgara 4 sütun: 6 evin dışında boş; 11'e kafe → komşuları 7, 10, 15 (boş) ev isteyemez; 13, 14 gibi uzak arsalar isteyebilir
    const newEv = () => new Set(candidates(k).filter(c => c.w.k === 'new' && c.w.t === 'ev').map(c => c.i));
    const before = newEv(); expect(before.has(7) && before.has(10) && before.has(15)).toBe(true);
    S.d[k][11] = P('kafe', 1);
    const after = newEv();
    for (const i of [7, 10, 15]) expect(after.has(i), 'arsa ' + i).toBe(false);
    expect(after.has(13) && after.has(14)).toBe(true);
    const cs = candidates(k); expect(cs.some(c => c.w.k === 'lvl')).toBe(true); expect(cs.some(c => c.w.k === 'nb' && c.w.t === 'kafe')).toBe(true);
    expect(candidates(k).some(c => c.w.k === 'new' && c.w.t === 'dukkan' && c.i === 10)).toBe(true); // kafenin yanına üst tür (dükkân) istenebilir
    tenantSim.noFit = true; try { expect(newEv().has(10)).toBe(true); } finally { tenantSim.noFit = false; }
  });
});

describe('kayıt: sanitize, eski kayıt, sözleşme tavanı', () => {
  const save = (extra: Record<string, unknown>) => JSON.parse(JSON.stringify({ ...newState(T, WK, 'ist'), ...extra }));
  const base = { id: 5, a: 'aile', k: 'ist-0', i: 3, w: { k: 'lvl', n: 3 }, dl: 1000, st: 'live', end: 0 };
  beforeEach(() => setRegion('tr'));
  it('c: bilinen kimlik + semtin şehri + aynı tip ise korunur; değilse silinir (kiracı kalır)', () => {
    const s = migrate(save({ playMs: 0, own: ['ist-0'], ten: [
      { ...base, i: 1, c: 'ist.aile' }, { ...base, i: 2, c: 'izm.aile' }, { ...base, i: 3, c: 'ist.emekli' }, { ...base, i: 4, c: 'kral.aile' }, { ...base, i: 5, c: 7 }, { ...base, i: 6 },
    ] }), T, WK)!;
    expect(s.ten.map(x => [x.i, x.c])).toEqual([[1, 'ist.aile'], [2, undefined], [3, undefined], [4, undefined], [5, undefined], [6, undefined]]);
    setS(s); for (const x of S.ten) expect(charOfT(x)).toBe(CHAR['ist.aile']); // c yoksa semtten türetilir
  });
  it('eski kayıt (c ve tdc yok): yüklenir, ad semtten gelir, tdef ("Kiracı yeşili") aynen kalır', () => {
    const raw = save({ playMs: 0, ten: [{ ...base, st: 'wait', dl: 5000 }], tdef: { aile: { met: 3, ok: 3 } } }); delete raw.tdc;
    const s = migrate(raw, T, WK)!; setS(s);
    expect(s.tdc).toEqual({}); expect(s.tdef).toEqual({ aile: { met: 3, ok: 3 } }); expect(s.ten[0].c).toBeUndefined();
    expect(tName(s.ten[0].a, s.ten[0].k)[0]).toBe('Yılmaz ailesi'); expect(stampsOf()).toBe(1);
  });
  it('sözleşme tavanı kişiliğe göre: Köklü 86 dk korunur (eskiden 60 dk\'ya kırpılırdı), Sabırsız 50 dk\'ya kırpılır', () => {
    setRegion('tr');
    const s = migrate(save({ playMs: 1e6, own: ['ist-0', 'ank-0'], ten: [
      { ...base, k: 'ank-0', i: 1, c: 'ank.aile', end: 1e6 + 86 * 60e3 },          // Arslan ailesi, Köklü
      { ...base, k: 'ank-0', i: 2, c: 'ank.aile', end: 1e6 + 99 * 60e3 },          // elle uzatılmış → 86 dk
      { ...base, k: 'ist-0', i: 3, a: 'yazilimci', c: 'ist.yazilimci', end: 1e6 + 80 * 60e3 }, // Kaan, Sabırsız → 50 dk
      { ...base, k: 'ank-0', i: 4, end: 1e6 + 99 * 60e3 },                          // c yok: semtin karakteri (Köklü)
    ] }), T, WK)!;
    expect(s.ten.map(x => (x.end - 1e6) / 60e3)).toEqual([86, 86, 50, 86]);
  });
  it('tdc: yalnız bilinen karakterler, sayılar 0–1e6 tam sayı; bulut paketi gidiş-dönüş', () => {
    const s = migrate(save({ tdc: { 'ist.aile': { met: 2.9, ok: -1 }, 'xx.aile': { met: 1, ok: 1 }, 'osa.esnaf': 'x', 'kyo.emekli': { met: 1, ok: 1e9 } } }), T, WK)!;
    expect(s.tdc).toEqual({ 'ist.aile': { met: 2, ok: 0 }, 'kyo.emekli': { met: 1, ok: 1e6 } });
    const back = migrate(JSON.parse(JSON.stringify({ b: 1, saves: { tr: s } })).saves.tr, T, WK)!; expect(back.tdc).toEqual(s.tdc);
  });
});

describe('defter ödülleri (kozmetik)', () => {
  const okAll = (city: CityId, n = 6) => { for (const c of charsOf(city).slice(0, n)) S.tdc[c.id] = { met: 1, ok: 1 }; };
  it('şehir rozeti 6/6; ülke cephe rengi bölgedeki tüm şehir rozetleriyle; kira etkisi yok', () => {
    setup('ist', 'tr'); okAll('ist', 5);
    expect(cityCount('ist')).toBe(5); expect(cityBadge('ist')).toBe(false);
    okAll('ist'); expect(cityBadge('ist')).toBe(true); expect(countryDone('tr')).toBe(false);
    okAll('izm'); expect(countryDone('tr')).toBe(false); expect(skinUnlocked(COUNTRY_SKIN.tr)).toBe(false);
    const r0 = baseRate('ist-0', 0); okAll('ank'); expect(countryDone('tr')).toBe(true); expect(skinUnlocked(COUNTRY_SKIN.tr)).toBe(true);
    expect(baseRate('ist-0', 0)).toBe(r0);
    expect(SKIN_COLORS[COUNTRY_SKIN.tr].n).toBe('Çini mavisi'); expect(SKIN_COLORS[TENANT_SKIN].n).toBe('Kiracı yeşili');
  });
  it('Global: ülkenin tek şehri yeter; her bölgede yalnız şehri olan ülkenin rengi görünür', () => {
    setup('lon', 'gl'); expect(countryCities('uk')).toEqual(['lon']); okAll('lon'); expect(countryDone('uk')).toBe(true); expect(countryDone('tr')).toBe(false);
    for (const n of Object.values(COUNTRY_SKIN)) expect(skinShown(n)).toBe(true);
    setRegion('de'); for (const [c, n] of Object.entries(COUNTRY_SKIN)) expect(skinShown(n), c).toBe(c === 'de');
    for (let n = 0; n <= TENANT_SKIN; n++) expect(skinShown(n)).toBe(true);
  });
  it('kartpostal: yerleşmiş gezgin; müdavim pulları (tdef) ve Kiracı yeşili ayrı ve aynen', () => {
    setup('izm', 'tr'); expect(postcards()).toEqual([]);
    S.tdc['izm.ogrenci'] = { met: 1, ok: 1 }; S.tdc['izm.aile'] = { met: 1, ok: 1 };
    expect(postcards().map(c => c.id)).toEqual(['izm.ogrenci']); // Melis: Gezgin; Aksoy ailesi değil
    S.tdef = Object.fromEntries(ARCHS.map(a => [a, { met: 3, ok: 3 }])); expect(skinUnlocked(TENANT_SKIN)).toBe(true);
    S.tdc = {}; expect(skinUnlocked(TENANT_SKIN)).toBe(true); expect(skinUnlocked(COUNTRY_SKIN.tr)).toBe(false);
  });
});

/** Basit XML denetimi: etiketler dengeli, öznitelikler tırnaklı, "undefined/NaN" yok. */
function wellFormed(svg: string): boolean {
  if (/undefined|NaN/.test(svg)) return false;
  const st: string[] = [], re = /<(\/?)([a-zA-Z]+)((?:\s+[\w:-]+="[^"]*")*)\s*(\/?)>/g; let m: RegExpExecArray | null, last = 0;
  while ((m = re.exec(svg))) {
    if (svg.slice(last, m.index).includes('<')) return false; last = re.lastIndex;
    if (m[4]) continue; if (!m[1]) st.push(m[2]); else if (st.pop() !== m[2]) return false;
  }
  return st.length === 0 && !svg.slice(last).includes('<');
}
describe('portreler', () => {
  it('90 karakter × 3 hâl: geçerli SVG, deterministik (aynı parametre → aynı çıktı), karakterler birbirinden farklı', () => {
    const seen = new Set<string>();
    for (const c of CHARS) for (const m of ['wait', 'happy', 'bye'] as const) {
      const a = tenantFace(c.look, m, true, c.id), b = tenantFace(JSON.parse(JSON.stringify(c.look)), m, true, c.id);
      expect(a).toBe(b); expect(wellFormed(a), c.id + m).toBe(true); expect(a).toContain(`data-c="${c.id}"`);
      const g = tenantBadge(c.look, m, c.id); expect(wellFormed(g), c.id).toBe(true); expect(g).toContain('viewBox="18 14 84 84"');
      if (m === 'wait') seen.add(tenantBadge(c.look, m));
    }
    expect(seen.size).toBe(90);
    for (const a of ARCHS) expect(wellFormed(tenantFace(LEGACY_LOOK[a], 'happy')), a).toBe(true);
    // sabit özet: çizim kodu değişirse bilinçli güncellensin
    let h = 0; for (const c of CHARS) for (const ch of tenantBadge(c.look, 'happy')) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    expect(h).toBe(300503342);
  });
  it('kart ve rozet temaya uyar: kart dolgusu var(--rk-card), mürekkep sabit', () => {
    const s = tenantFace(CHAR['ist.ogrenci'].look, 'wait'); expect(s).toContain('var(--rk-card)'); expect(s).toContain('#1e3a32');
  });
});

describe('isimler ve tipler: CITIES', () => {
  it('her şehir adı tanımlı', () => { for (const c of allCities) expect(CITIES[c].n).toBeTruthy(); expect(CITY_ORDER.length).toBe(3); });
});
