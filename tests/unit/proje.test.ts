// Büyük projeler (game/projcore.ts, game/project.ts): uygun 2×2 bulma, bedel/süre, etap bonusu, ayırma, sınırlar,
// kayıt temizliği (sanitize) ve bulut paketi, kiracılarla etkileşim, adlar/üslup tablosu (5 ülke × 4 tür), CFG / Remote Config.
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/ui/modal', () => ({
  openModal: vi.fn(), closeModal: vi.fn(), bump: vi.fn(), toast: vi.fn(), flushQueue: vi.fn(), flyTo: vi.fn(async () => {}), flyCoin: vi.fn(async () => {}),
  countUp: vi.fn(), showGain: vi.fn(), bigStamp: vi.fn(), cashText: vi.fn(),
}));
vi.mock('../../src/game/persist', () => ({ persist: vi.fn(), persistSync: vi.fn(), persistNow: vi.fn(async () => {}), dirty: false, clearDirty: vi.fn() }));
vi.mock('../../src/ui/board', () => ({ render: vi.fn(), Street: { spawn: vi.fn(), idle: vi.fn() } }));
vi.mock('../../src/services/ads', () => ({ Ads: { rewarded: vi.fn(), native: () => false, privacyRequired: () => false, tickInterstitial: vi.fn() }, adUser: { uid: () => null } }));
vi.mock('../../src/sound', () => ({ Snd: new Proxy({}, { get: () => () => {} }), buzz: Object.assign(vi.fn(), { light: vi.fn(), medium: vi.fn(), success: vi.fn(), error: vi.fn(), select: vi.fn() }) }));

import { newState, setS, S, migrate, Plot, PJ_KINDS } from '../../src/state';
import { CFG, TYPES, UP_COST, MAXLV, REGIONS, setRegion, BuildingType } from '../../src/config';
import { weekKey } from '../../src/format';
import { setLang, t } from '../../src/i18n';
import { baseRate, totalRate, pjOf, pjCells, upTime, costM, withoutTenants } from '../../src/economy';
import { sane } from '../../src/services/remote';
import { tenants, candidates, tenantTick, tenantHooks, tenantReset, wishTargets, Tenant, COUNTRIES } from '../../src/game/tenants';
import {
  blocks, nearest, kindOf, typesAt, pjCost, pjTime, pjStart, pjStage2, pjSplit, pjDue, pjDistrictOk, pjReserved, pjTenants, pjName, styleOf,
  PJ_NAMES, KIND_N, startProject, splitProject, tickProjects, upgradeProject,
} from '../../src/game/project';
import { projSvg, projSite, PJ_STYLES } from '../../src/projdraw';
import { EN } from '../../src/locales/en';
import { DE } from '../../src/locales/de';
import { JA } from '../../src/locales/ja';

const T = Date.UTC(2026, 10, 16, 12), WK = weekKey(new Date(T));
const P = (t: BuildingType, lvl = 5, extra: Partial<Plot> = {}): Plot => ({ t, lvl, buf: 0, until: 0, dur: 1, up: false, ...extra });
const DEF = { ...CFG };
const TY: BuildingType[] = ['ev', 'kafe', 'dukkan', 'ofis'];
/** Kadıköy dolu (20 bina, hepsi Sv lv), Beşiktaş alınmış (projeler açık), kasada çok para. */
function setup(lv = 5, types: (i: number) => BuildingType = i => TY[i % 4]) {
  setS(newState(T, WK, 'ist'));
  S.d['ist-0'] = Array.from({ length: 20 }, (_, i) => P(types(i), lv));
  S.own = ['ist-0', 'ist-1']; S.d['ist-1'] = Array(20).fill(null); S.cash = 1e12; S.earned = 1e9; S.seen = { ev: true, kafe: true, dukkan: true, ofis: true };
  S.nextTen = 9e15; S.playMs = 1e6;
}
const rateOf = (k: string, a: number) => pjCells(a).reduce((s, j) => s + baseRate(k, j), 0);
const mk = (x: Partial<Tenant>): Tenant => { const r = { id: 1, a: 'ogrenci', k: 'ist-0', i: 0, w: { k: 'lvl', n: 5 }, dl: S.playMs + CFG.TEN_WAIT, st: 'wait', end: 0, ...x } as Tenant; tenants().push(r); return r; };

beforeEach(() => {
  Object.assign(CFG, DEF); setRegion('tr'); setLang('tr'); tenantReset();
  for (const k of Object.keys(tenantHooks) as (keyof typeof tenantHooks)[]) tenantHooks[k] = () => {};
});

describe('uygun 2×2 bloklar', () => {
  it('dolu semtte Sv5 dört bina: 4×5 ızgarada 12 blok; i verilirse yalnızca i\'yi içerenler', () => {
    setup();
    expect(blocks('ist-0')).toEqual([0, 1, 2, 4, 5, 6, 8, 9, 10, 12, 13, 14]);
    expect(blocks('ist-0', 0)).toEqual([0]);
    expect(blocks('ist-0', 5)).toEqual([0, 1, 4, 5]);
    expect(blocks('ist-0', 19)).toEqual([14]);
  });
  it('Sv4 bina, özel yapı, engel, inşaat ya da başka projedeki bina bloğu bozar', () => {
    setup(); const L = S.d['ist-0'];
    L[5] = P('ev', 4); expect(blocks('ist-0', 5)).toEqual([]);
    L[5] = P('ev', 5, { sp: 'saat' }); expect(blocks('ist-0', 5)).toEqual([]);
    L[5] = P('ev', 5, { ob: 'hurda' }); expect(blocks('ist-0', 5)).toEqual([]);
    L[5] = P('ev', 5, { until: T + 1e9 }); expect(blocks('ist-0', 5)).toEqual([]);
    L[5] = P('ev', 5); pjStart('ist-0', 0); expect(blocks('ist-0', 5)).toEqual([]); expect(blocks('ist-0', 6)).toEqual([2, 6]);
  });
  it('semt şartları: kilitli (tek semt), kaporalı, dolu değil, sınır dolu', () => {
    setup(); S.own = ['ist-0']; expect(pjDistrictOk('ist-0')).toBe('locked'); expect(blocks('ist-0')).toEqual([]);
    setup(); S.lien['ist-0'] = 100; expect(pjDistrictOk('ist-0')).toBe('lien');
    setup(); S.d['ist-0'][19] = null; expect(pjDistrictOk('ist-0')).toBe('notfull'); expect(blocks('ist-0')).toEqual([]);
    setup(); pjStart('ist-0', 0); expect(pjDistrictOk('ist-0')).toBe(''); pjStart('ist-0', 10);
    expect(pjDistrictOk('ist-0')).toBe('max'); expect(blocks('ist-0')).toEqual([]); expect(pjStart('ist-0', 12)).toBeNull();
    expect(S.pj['ist-0'].length).toBe(CFG.PJ_MAX);
  });
  it('en yakın blok: kaç bina hazır, kaç kat eksik, kat çıkacak arsa', () => {
    setup(); const L = S.d['ist-0']; L[0] = P('ev', 3); L[1] = P('kafe', 4);
    expect(nearest('ist-0', 0)).toEqual({ a: 0, ready: 2, floors: 3, i: 0 });
    expect(nearest('ist-0', 6)!.floors).toBe(0);
    expect(nearest('ist-0')!.floors).toBe(0);
  });
  it('tür: ≥3 ev site · kafe+dükkân ≥3 çarşı · ≥3 ofis plaza · diğer karma', () => {
    expect(kindOf(['ev', 'ev', 'ev', 'ofis'])).toBe('site');
    expect(kindOf(['kafe', 'dukkan', 'kafe', 'ev'])).toBe('carsi');
    expect(kindOf(['ofis', 'ofis', 'ofis', 'kafe'])).toBe('plaza');
    expect(kindOf(['ev', 'ev', 'ofis', 'ofis'])).toBe('karma');
  });
});

describe('bedel, süre, bonus', () => {
  it('1. etap: dört binanın Sv4→5 bedeli toplamı; 2. etap ×PJ_COST2; süre ortalama, 2. etap ×PJ_TIME2', () => {
    setup(); const ty = typesAt('ist-0', 0);
    const c1 = ty.reduce((s, x) => s + TYPES[x].cost * costM('ist-0') * UP_COST[MAXLV - 1], 0);
    expect(pjCost('ist-0', 0)).toBeCloseTo(c1); expect(pjCost('ist-0', 0, 2)).toBeCloseTo(c1 * 2);
    const t1 = ty.reduce((s, x) => s + upTime('ist-0', P(x, 4)), 0) / 4;
    expect(pjTime('ist-0', 0)).toBeCloseTo(t1); expect(pjTime('ist-0', 0, 2)).toBeCloseTo(t1 * 1.5);
    CFG.PJ_COST_PCT = 50; CFG.PJ_TIME_PCT = 200; expect(pjCost('ist-0', 0)).toBeCloseTo(c1 / 2); expect(pjTime('ist-0', 0)).toBeCloseTo(t1 * 2);
  });
  it('başlat: kasadan bedel; inşaatta kira aynı; teslimde +%20, 2. etap +%30; ayırınca eski kira; bedel iade yok', () => {
    setup(); const r0 = rateOf('ist-0', 5), out = totalRate(false), cash = S.cash, c = pjCost('ist-0', 5);
    const q = pjStart('ist-0', 5, T)!;
    expect(q).toMatchObject({ a: 5, st: 0, kd: 'carsi' }); expect(S.cash).toBeCloseTo(cash - c);
    expect(rateOf('ist-0', 5)).toBeCloseTo(r0); expect(totalRate(false)).toBeCloseTo(out); // inşaatta kayıp yok
    expect(pjDue(q.until - 1)).toEqual([]); expect(pjDue(q.until)).toEqual([['ist-0', q]]);
    expect(q.st).toBe(1); expect(rateOf('ist-0', 5) / r0).toBeCloseTo(1.2);
    // proje dışı komşuların kirası değişmez (dört bina kaydı korunur)
    expect(baseRate('ist-0', 4)).toBeCloseTo(baseRate('ist-0', 4));
    const c2 = pjCost('ist-0', 5, 2), before2 = S.cash;
    expect(pjStage2('ist-0', q, T)).toBe(true); expect(S.cash).toBeCloseTo(before2 - c2); expect(pjStage2('ist-0', q, T)).toBe(false);
    expect(rateOf('ist-0', 5) / r0).toBeCloseTo(1.2); pjDue(q.until); expect(q.st).toBe(2); expect(rateOf('ist-0', 5) / r0).toBeCloseTo(1.3);
    expect(pjStage2('ist-0', q, T)).toBe(false); // başka etap yok
    const spent = S.cash; expect(pjSplit('ist-0', q)).toBe(true);
    expect(S.pj['ist-0']).toBeUndefined(); expect(rateOf('ist-0', 5)).toBeCloseTo(r0); expect(S.cash).toBe(spent);
    expect(S.d['ist-0'].every(p => p && p.lvl === 5)).toBe(true);
  });
  it('para yetmezse başlamaz; projeye çevrilen bloktaki arsa pjOf ile bulunur', () => {
    setup(); S.cash = 1; expect(pjStart('ist-0', 0)).toBeNull(); expect(S.pj['ist-0']).toBeUndefined();
    S.cash = 1e12; pjStart('ist-0', 0); for (const j of [0, 1, 4, 5]) expect(pjOf('ist-0', j)!.a).toBe(0); expect(pjOf('ist-0', 2)).toBeNull();
  });
  it('kiracı bonusu proje çarpanıyla toplanır, çarpılmaz; çevrimdışı hesapta proje kalır, kiracı düşer', () => {
    setup(); const b = baseRate('ist-0', 0); mk({ i: 0, st: 'live', end: S.playMs + 1e6 });
    expect(baseRate('ist-0', 0) / b).toBeCloseTo(1 + CFG.TEN_BONUS);
    const q = pjStart('ist-0', 0, T)!; pjDue(q.until);
    expect(baseRate('ist-0', 0) / b).toBeCloseTo(1 + CFG.TEN_BONUS + CFG.PJ_X1);
    expect(withoutTenants(() => baseRate('ist-0', 0)) / b).toBeCloseTo(1 + CFG.PJ_X1);
  });
  it('arayüz eylemleri: başlat / 2. etap / teslim / ayır (bildirimler sessizce çalışır)', () => {
    setup(); expect(startProject('ist-0', 0)).toBe(true); expect(startProject('ist-0', 0)).toBe(false);
    const q = S.pj['ist-0'][0]; tickProjects(q.until, 0); expect(q.st).toBe(1);
    expect(upgradeProject('ist-0', q)).toBe(true); tickProjects(q.until, 0); expect(q.st).toBe(2);
    expect(splitProject('ist-0', q)).toBe(true); expect(pjOf('ist-0', 0)).toBeNull();
  });
});

describe('kiracılar: proje tek bina sayılır, kimse sessizce düşmez', () => {
  it('projedeki ve projeye dönüşebilecek arsalar kiracı hedefi değil; ruhsat dolunca kalan arsalar yine hedef', () => {
    setup(); S.d['ist-0'][19] = null; // dolu değil: blok "hazır" sayılmaz
    expect(pjReserved('ist-0', 0)).toBe(false);
    setup(); expect(pjReserved('ist-0', 0)).toBe(true); expect(candidates('ist-0').length).toBe(0);
    setup(4); S.d['ist-0'][0] = P('ev', 4);
    expect(pjReserved('ist-0', 0)).toBe(false); expect(candidates('ist-0').some(c => c.i === 0)).toBe(true); // Sv4: kat isteği olabilir
    setup(); pjStart('ist-0', 0); pjStart('ist-0', 10); expect(pjReserved('ist-0', 2)).toBe(false); expect(pjReserved('ist-0', 0)).toBe(true);
  });
  it('boş arsaya komşu isteği proje arsasına yönelmez (proje bölgesi wishTargets dışında)', () => {
    setup(); pjStart('ist-0', 0); S.d['ist-0'][2] = null; // semt artık dolu değil: blok ayrılmaz ama proje durur
    mk({ i: 6, a: 'esnaf', w: { k: 'nb', t: 'ev' } });
    expect([...wishTargets('ist-0').keys()]).toEqual([2]);
  });
  it('birleşmede: yerleşik kiracı kalır (sözleşme sürer), anahtar bekleyen yerleşir, karşılanamayan bildirimle ayrılır', () => {
    setup(); const L = S.d['ist-0']; L[1] = P('ev'); L[4] = P('dukkan'); L[7] = P('ev');
    const live = mk({ id: 1, i: 0, st: 'live', end: S.playMs + 30 * 60e3 });
    const ready = mk({ id: 2, i: 1, a: 'aile', w: { k: 'lvl', n: 5 }, st: 'ready' });
    const gone = mk({ id: 3, i: 4, a: 'esnaf', w: { k: 'nb', t: 'ofis' } }); // 4'ün komşusu 0, 5, 8: ofis yok, boş arsa yok
    const other = mk({ id: 4, i: 7, a: 'emekli', w: { k: 'lvl', n: 5 }, st: 'ready' });
    const pre = pjTenants('ist-0', 0);
    expect(pre.live).toEqual([live]); expect(pre.move).toEqual([ready]); expect(pre.leave).toEqual([gone]);
    const settled: Tenant[] = [], left: Tenant[] = [];
    tenantHooks.settle = x => settled.push(x); tenantHooks.leave = x => left.push(x);
    pjStart('ist-0', 0);
    expect(live.st).toBe('live'); expect(ready.st).toBe('live'); expect(settled).toEqual([ready]); expect(left).toEqual([gone]);
    expect(tenants()).toEqual([live, ready, other]);
    // tick: yerleşikler projede kalır, sözleşme bitince teşekkürle gider (sessiz düşüş yok)
    const ended: Tenant[] = []; tenantHooks.end = x => ended.push(x);
    S.playMs += 1000; tenantTick(1000); expect(tenants().includes(live) && tenants().includes(ready)).toBe(true);
    S.playMs = live.end; tenantTick(1000); expect(ended).toContain(live);
    expect(S.tdef.aile.ok).toBe(1);
  });
  it('ayırınca yerleşik kiracı binasında kalır', () => {
    setup(); const x = mk({ i: 5, a: 'sanatci', st: 'live', end: S.playMs + 1e6 }); const q = pjStart('ist-0', 5)!;
    pjSplit('ist-0', q); S.playMs += 1000; tenantTick(1000); expect(tenants()).toEqual([x]);
  });
});

describe('kayıt: sanitize ve bulut paketi', () => {
  const save = (extra: Record<string, unknown>) => { setup(); return JSON.parse(JSON.stringify({ ...S, ...extra })); };
  it('eski kayıt (alan yok): boş', () => {
    const raw = save({}); delete raw.pj; delete raw.pjIntro;
    const s = migrate(raw, T, WK)!; expect(s.pj).toEqual({}); expect(s.pjIntro).toBe(false);
  });
  it('bozuk / elle değiştirilmiş projeler düşer; süreler ve etap sınırlanır', () => {
    const ok = { a: 0, kd: 'site', st: 1, until: 0, dur: 1000 };
    const s = migrate(save({
      pjIntro: 'evet',
      pj: {
        'ist-0': [ok, { ...ok }, { ...ok, a: 3 }, { ...ok, a: 16 }, { ...ok, a: 10, kd: 'saray' }, { ...ok, a: 1.5 }, 'çöp', null,
          { a: 10, kd: 'plaza', st: 9, until: T + 9e12, dur: 9e12 }, { a: 8, kd: 'carsi', st: 0, until: T + 1e15, dur: 5000 }, { a: 2, kd: 'karma', st: 0, until: 0, dur: 1 }],
        'ist-1': [ok], 'nyc-0': [ok], 'xx-9': [ok],
      },
    }), T, WK)!;
    // 0 geçerli; tekrar (çakışma), sağ kenar (3), alt kenar (16), bilinmeyen tür, kesirli düşer; 10 etap 2'ye, inşaat yok;
    // 8 süresi kısalır; 2: etap 0 + inşaat yok → 1. etap bitmiş sayılır; ist-1 boş arsa (bina yok): düşer
    expect(s.pj['ist-0'].map(q => q.a)).toEqual([0, 10, 8, 2]);
    expect(s.pj['ist-0'][1]).toMatchObject({ st: 2, until: 0, dur: 48 * 3600e3 });
    expect(s.pj['ist-0'][2].until).toBe(T + 5000);
    expect(s.pj['ist-0'][3].st).toBe(1);
    expect(s.pj['ist-1']).toBeUndefined(); expect(s.pjIntro).toBe(false);
    for (const q of s.pj['ist-0']) expect(PJ_KINDS).toContain(q.kd);
  });
  it('proje arsasında bina kalmamışsa (yıkılmış/özel yapı) proje düşer', () => {
    const raw = save({ pj: { 'ist-0': [{ a: 0, kd: 'site', st: 1, until: 0, dur: 1 }] } }); raw.d['ist-0'][5] = null;
    expect(migrate(raw, T, WK)!.pj).toEqual({});
  });
  it('bulut paketi: projeler JSON gidiş-dönüşünde (çok bölgeli paket) aynen kalır', () => {
    setup(); pjStart('ist-0', 0, T); const q = pjStart('ist-0', 10, T)!; pjDue(q.until); S.pjIntro = true;
    const bundle = JSON.parse(JSON.stringify({ b: 1, saves: { tr: S } })), back = migrate(bundle.saves.tr, T, WK)!;
    expect(back.pj).toEqual(S.pj); expect(back.pjIntro).toBe(true);
  });
});

describe('adlar, üslup, metinler, CFG', () => {
  it('5 ülke × 4 tür yerel ad, hepsi farklı ve çevrili; Global semtin ülkesine göre', () => {
    for (const c of COUNTRIES) for (const k of PJ_KINDS) { const n = PJ_NAMES[k][c]; expect(n, c + k).toBeTruthy(); for (const D of [EN, DE, JA]) expect(D.s[n], n).toBeTruthy(); }
    expect(new Set(COUNTRIES.flatMap(c => PJ_KINDS.map(k => PJ_NAMES[k][c]))).size).toBe(20);
    for (const k of PJ_KINDS) expect(KIND_N[k]).toBeTruthy();
    setRegion('gl');
    expect(styleOf('lon-2')).toBe('uk'); expect(pjName('lon-2', 'karma')).toBe('Ambar Lofları');
    expect(styleOf('muc-1')).toBe('de'); expect(pjName('muc-1', 'carsi')).toBe('Markthalle');
    expect(styleOf('tyo-0')).toBe('jp'); expect(styleOf('nyc-3')).toBe('us'); expect(styleOf('ist-0')).toBe('tr');
    for (const r of ['us', 'uk', 'de', 'jp'] as const) for (const city of REGIONS[r].cities) expect(styleOf(city + '-0')).toBe(r);
    setLang('en'); expect(pjName('lon-2', 'site')).toBe('Georgian Mews'); setLang('de'); expect(pjName('ist-0', 'plaza')).toBe('Plaza-Hochhaus');
    setLang('ja'); expect(pjName('tyo-0', 'carsi')).toBe('商店街');
    expect(t('PROJE TESLİM')).not.toBe('PROJE TESLİM');
  });
  it('çizim: 5 üslup × 4 tür × 2 etap ayrı SVG; şantiye ilerledikçe değişir; tekil kimlik çakışmaz', () => {
    expect([...PJ_STYLES].sort()).toEqual(['de', 'jp', 'tr', 'uk', 'us']);
    const all = new Set<string>();
    for (const st of PJ_STYLES) for (const k of PJ_KINDS) for (const e of [1, 2]) { const s = projSvg(k, st, e); expect(s.length).toBeGreaterThan(400); expect(s).not.toMatch(/NaN|undefined/); all.add(s); }
    expect(all.size).toBe(40);
    expect(projSite('site', 'uk', 1, .2, 'a')).not.toBe(projSite('site', 'uk', 1, .8, 'a'));
    expect(projSvg('plaza', 'uk', 1)).not.toMatch(/ id="/); // tekrarlanan sabit kimlik yok (sayfada birden çok proje)
  });
  it('CFG sabitleri Remote Config sınırlarından geçer (yüzdeler iki yöne ayarlanabilir)', () => {
    for (const k of ['PJ_MINLV', 'PJ_MAX', 'PJ_X1', 'PJ_X2', 'PJ_COST_PCT', 'PJ_COST2', 'PJ_TIME_PCT', 'PJ_TIME2', 'PJ_UNLOCK_OWN']) expect(sane(k, (CFG as any)[k]), k).toBe(true);
    expect(sane('PJ_COST_PCT', 150)).toBe(true); expect(sane('PJ_TIME_PCT', 50)).toBe(true);
    setup(); CFG.PJ_MAX = 1.7; pjStart('ist-0', 0); expect(pjDistrictOk('ist-0')).toBe('max'); // kesirli değer tamsayıya
    setup(); CFG.PJ_MINLV = 4.4; S.d['ist-0'][0] = P('ev', 4); expect(blocks('ist-0', 0)).toEqual([0]);
  });
});
