// Kiracılar · geç oyun istekleri (game/tenants.ts LATE_KINDS): dolu ve olgun (Sv5) semtte proje, köşe başı, cephe rengi ve
// yenileme istekleri. Yalnız geç oyunda (bir ilin son semti dolu), olgun semtte ve hiçbir semtte eski türden aday yokken çıkar;
// erken oyun (ve rastgele sayı dizisi) değişmez. Yenileme bedeli/süresi, karşılanma, anahtar, kayıt temizliği, veri ve metinler.
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/ui/modal', () => ({
  openModal: vi.fn(), closeModal: vi.fn(), bump: vi.fn(), toast: vi.fn(), flushQueue: vi.fn(), flyTo: vi.fn(async () => {}), flyCoin: vi.fn(async () => {}),
  countUp: vi.fn(), showGain: vi.fn(), bigStamp: vi.fn(), cashText: vi.fn(),
}));
vi.mock('../../src/game/persist', () => ({ persist: vi.fn(), persistSync: vi.fn(), persistNow: vi.fn(async () => {}), dirty: false, clearDirty: vi.fn() }));
vi.mock('../../src/ui/board', () => ({ render: vi.fn(), Street: { spawn: vi.fn(), idle: vi.fn() } }));
vi.mock('../../src/services/ads', () => ({ Ads: { rewarded: vi.fn(), native: () => false, privacyRequired: () => false, tickInterstitial: vi.fn() }, adUser: { uid: () => null } }));
vi.mock('../../src/sound', () => ({ Snd: new Proxy({}, { get: () => () => {} }), buzz: Object.assign(vi.fn(), { light: vi.fn(), medium: vi.fn(), success: vi.fn(), error: vi.fn(), select: vi.fn() }) }));

import { newState, setS, S, migrate, Plot, Pj } from '../../src/state';
import { CFG, MAXLV, DRULES, setRegion, BuildingType } from '../../src/config';
import { weekKey } from '../../src/format';
import { setLang } from '../../src/i18n';
import { baseRate, totalRate, tenantMult, withoutTenants, upTime, pjCells, renovating } from '../../src/economy';
import { sane } from '../../src/services/remote';
import { CHARS, TRAITS, TRAIT_IDS, bonusOf, liveOf, charOpts } from '../../src/game/tenantChars';
import {
  tenantTick, spawnTenant, handKey, tenants, candidates, lateCandidates, lateGame, mature, satisfied, inProgress, tenantHooks, tenantReset,
  startRenov, renovFee, renovMs, paintFor, ARCH, ARCHS, LATE_KINDS, isLate, quote, wishShort, wishLink, goLabel, tenantSay, tenantSim, Tenant,
} from '../../src/game/tenants';
import { blocks, pjStart, pjStage2, pjDue } from '../../src/game/project';
import { SKIN_COLORS } from '../../src/game/fun';
import { EN } from '../../src/locales/en';
import { DE } from '../../src/locales/de';
import { JA } from '../../src/locales/ja';

const T = Date.UTC(2026, 10, 16, 12), WK = weekKey(new Date(T));
const P = (t: BuildingType, lvl = 5, extra: Partial<Plot> = {}): Plot => ({ t, lvl, buf: 0, until: 0, dur: 1, up: false, ...extra });
const TY: BuildingType[] = ['ev', 'kafe', 'dukkan', 'ofis'];
const DEF = { ...CFG };
const K = 'ist-4';
/** İstanbul'un beş semti de alınmış ve dolu (hepsi Sv lv, türler sırayla): il tamam, geç oyun. */
function setup(lv = 5) {
  setS(newState(T, WK, 'ist'));
  S.own = [0, 1, 2, 3, 4].map(d => 'ist-' + d);
  for (const k of S.own) S.d[k] = Array.from({ length: 20 }, (_, i) => P(TY[i % 4], lv));
  S.cur = K; S.cash = 1e15; S.earned = 1e12; S.seen = { ev: true, kafe: true, dukkan: true, ofis: true }; S.nextTen = 9e15; S.playMs = 1e6;
}
/** Bebek'te iki proje (ruhsat dolu): sol üst 0 ve 10; kalan 12 arsa kiracı hedefi olabilir. */
function twoProjects(st = 1) {
  const L: Pj[] = [{ a: 0, kd: 'karma', st, until: 0, dur: 1 }, { a: 10, kd: 'karma', st, until: 0, dur: 1 }];
  S.pj[K] = L; return L;
}
const step = (ms: number, n = 1, rnd = () => 0.5) => { for (let k = 0; k < n; k++) { S.playMs += ms; tenantTick(ms, rnd); } };
const mk = (x: Partial<Tenant>): Tenant => { const r = { id: 1, a: 'ogrenci', k: K, i: 18, w: { k: 'renov' }, dl: S.playMs + CFG.TEN_WAIT, st: 'wait', end: 0, ...x } as Tenant; tenants().push(r); return r; };

beforeEach(() => {
  Object.assign(CFG, DEF); setRegion('tr'); setLang('tr'); tenantReset(); charOpts.off = false; charOpts.force = ''; tenantSim.noLate = false;
  for (const k of Object.keys(tenantHooks) as (keyof typeof tenantHooks)[]) tenantHooks[k] = () => {};
});

describe('ne zaman çıkar: yalnız geç oyunda, olgun semtte, eski türden aday yokken', () => {
  it('il tamamlanmadan (son semt alınmamış / dolmamış) olgun semtte bile geç istek yok; spawn rastgele sayı çekmez', () => {
    setup(); S.own = ['ist-0', 'ist-1']; S.cur = 'ist-1';
    expect(lateGame()).toBe(false); expect(mature('ist-1')).toBe(true);
    expect(lateCandidates('ist-1')).toEqual([]);
    let calls = 0; expect(spawnTenant(() => { calls++; return 0.5; })).toBe(null); expect(calls).toBe(0);
    setup(); S.d[K][19] = null; // Bebek'te bir boş arsa: il tamam sayılmaz
    expect(lateGame()).toBe(false); expect(lateCandidates('ist-0')).toEqual([]);
    setup(); expect(lateGame()).toBe(true); expect(lateCandidates(K).length).toBeGreaterThan(0);
  });
  it('olgunluk eşiği: dolu ve Sv5 payı ≥ TEN_LATE_LV', () => {
    setup(4); expect(mature(K)).toBe(false); expect(lateCandidates(K)).toEqual([]);
    for (let i = 0; i < 9; i++) S.d[K][i]!.lvl = 5; expect(mature(K)).toBe(false);
    S.d[K][9]!.lvl = 5; expect(mature(K)).toBe(true); // 10/20 = %50
    CFG.TEN_LATE_LV = 0.75; expect(mature(K)).toBe(false);
  });
  it('herhangi bir semtte eski türden aday varsa o gelir (geç istek ikinci tur); yoksa geç istek gelir', () => {
    setup(); S.d['ist-0'][16]!.lvl = 4; // Kadıköy'de bir ev Sv4: kat isteği (kısa süreli)
    expect(candidates('ist-0').some(c => c.w.k === 'lvl')).toBe(true);
    const x = spawnTenant(() => 0.5)!; expect(x.w.k).toBe('lvl'); expect(x.k).toBe('ist-0');
    tenants().length = 0; tenantReset(); S.d['ist-0'][16]!.lvl = 5;
    const y = spawnTenant(() => 0.5)!; expect(isLate(y.w.k)).toBe(true);
    tenants().length = 0; tenantReset(); tenantSim.noLate = true; expect(spawnTenant(() => 0.5)).toBe(null);
  });
  it('geç aday gelince sıradaki aday CFG.TEN_LATE_GAP kadar daha geç gelir; eski türde aralık aynı', () => {
    setup(); S.nextTen = S.playMs + 1000; const got: Tenant[] = []; tenantHooks.arrive = x => got.push(x);
    step(1000); expect(got.length).toBe(1); expect(isLate(got[0].w.k)).toBe(true);
    const gap = S.nextTen - S.playMs; expect(gap).toBeGreaterThanOrEqual(CFG.TEN_MIN + CFG.TEN_LATE_GAP); expect(gap).toBeLessThanOrEqual(CFG.TEN_MAX + CFG.TEN_LATE_GAP);
  });
});

describe('proje isteği', () => {
  it('her bloğu hazır semtte (ruhsat var) yalnız proje isteği: kiracının kiraladığı türde, uygun 2×2 içinde; para yetmezse yok', () => {
    setup(); const cs = lateCandidates(K);
    expect(cs.length).toBeGreaterThan(0); expect(cs.every(c => c.w.k === 'proj' && c.w.n === 1)).toBe(true);
    for (const c of cs) { expect(blocks(K, c.i).length).toBeGreaterThan(0); expect(ARCH[c.a].rents).toContain(S.d[K][c.i]!.t); }
    S.cash = 0; CFG.TEN_PJ_AFFORD_SEC = 1; expect(lateCandidates(K).some(c => c.w.k === 'proj')).toBe(false);
  });
  it('proje kurulunca aday ayrılmaz, inşaat sürerken süre durur; teslimde anahtar, tek dokunuşla yerleşir', () => {
    setup(); const x = mk({ a: 'aile', i: 0, w: { k: 'proj', n: 1 } });
    expect(satisfied(x)).toBe(false);
    const a = blocks(K, 0)[0]; expect(pjStart(K, a, 0, 1)).toBeTruthy(); // inşaat t0 = 0, süre pjTime ms (S.pj until)
    expect(tenants()).toContain(x); expect(x.st).toBe('wait'); expect(inProgress(x)).toBe(true);
    const dl = x.dl; step(60e3); expect(x.dl).toBe(dl + 60e3); expect(tenants()).toContain(x);
    pjDue(9e15); expect(satisfied(x)).toBe(true);
    step(1000); expect(x.st).toBe('ready'); expect(handKey(x)).toBe(true); expect(x.st).toBe('live');
    expect(tenantMult(K, 0)).toBeCloseTo(1 + bonusOf(CHARS.find(c => c.id === 'ist.aile')!), 9);
  });
  it('ruhsat doluysa teslim edilmiş projenin 2. etabı istenir; 2. etap bitince anahtar', () => {
    setup(); const [q] = twoProjects(1);
    const cs = lateCandidates(K), p2 = cs.filter(c => c.w.k === 'proj');
    expect(p2.length).toBeGreaterThan(0); expect(p2.every(c => c.w.n === 2 && (pjCells(0).includes(c.i) || pjCells(10).includes(c.i)))).toBe(true);
    expect(cs.some(c => c.w.k === 'paint' || c.w.k === 'renov')).toBe(true); // kalan 12 arsada cephe / yenileme
    const x = mk({ a: 'aile', i: 0, w: { k: 'proj', n: 2 } });
    expect(satisfied(x)).toBe(false); expect(pjStage2(K, q, 0, 1)).toBe(true); expect(inProgress(x)).toBe(true);
    pjDue(9e15); expect(q.st).toBe(2); step(1000); expect(x.st).toBe('ready');
  });
  it('blok başka projeye gidip istek artık olamazsa aday bildirimle ayrılır', () => {
    setup(); const x = mk({ a: 'ogrenci', i: 16, w: { k: 'proj', n: 1 } });
    const left: Tenant[] = []; tenantHooks.leave = y => left.push(y);
    twoProjects(1); step(1000); expect(tenants()).not.toContain(x); expect(left).toEqual([x]);
  });
});

describe('köşe başı isteği', () => {
  it('yalnız köşe başı damgası olan semtte, damgalı Sv5 binaya; istek hemen olur, anahtarla yerleşir', () => {
    setup(); twoProjects(1);
    expect(lateCandidates(K).some(c => c.w.k === 'kose')).toBe(false);
    S.ihale.kose = [K + ':18'];
    const ks = lateCandidates(K).filter(c => c.w.k === 'kose');
    expect(ks.length).toBeGreaterThan(0); expect(ks.every(c => c.i === 18 && ARCH[c.a].rents.includes('dukkan'))).toBe(true);
    const x = mk({ a: 'esnaf', i: 18, w: { k: 'kose' } }); step(1000); expect(x.st).toBe('ready'); expect(handKey(x)).toBe(true);
    S.d[K][18]!.lvl = 4; expect(lateCandidates(K).some(c => c.w.k === 'kose')).toBe(false); // Sv5 değilse istenmez
  });
});

describe('cephe rengi isteği', () => {
  it('renk oyuncuda açık, bölgede görünür ve binanın şimdiki renginden farklı; kilitli renk istenmez', () => {
    setup(); const p = S.d[K][18]!;
    expect(paintFor('esnaf', K, p)).toBe(0); // Tuğla kırmızısı ve Hardal kilitli → Krem
    p.sk = { c: 0 }; expect(paintFor('esnaf', K, p)).toBe(1);
    S.ach = Array.from({ length: 8 }, (_, i) => 'a' + i); p.sk = undefined; expect(paintFor('esnaf', K, p)).toBe(4); // Hardal açıldı
    S.skinsU = [9]; expect(paintFor('esnaf', K, p)).toBe(9);
    twoProjects(1);
    for (const c of lateCandidates(K).filter(c => c.w.k === 'paint')) { expect(SKIN_COLORS[c.w.c!]).toBeTruthy(); expect(c.w.c).not.toBe(S.d[K][c.i]!.sk?.c); }
  });
  it('cephe istenen renge boyanınca anahtar; renk kilitlenirse (kayıt bozulursa) aday ayrılır', () => {
    setup(); twoProjects(1); const x = mk({ a: 'sanatci', i: 13, w: { k: 'paint', c: 2 } });
    step(1000); expect(x.st).toBe('wait');
    S.d[K][13]!.sk = { c: 2 }; step(1000); expect(x.st).toBe('ready');
    const y = mk({ id: 2, a: 'esnaf', i: 18, w: { k: 'paint', c: 9 } }); // Tuğla kırmızısı kilitli
    step(1000); expect(tenants()).not.toContain(y);
  });
});

describe('yenileme isteği: bedel, süre, kira', () => {
  it('bedel = binanın taban kirası × TEN_RV_FEE_SEC; süre = son kat süresi × TEN_RV_PCT (1 dk – TEN_TIME_MAX)', () => {
    setup(); twoProjects(1);
    expect(renovFee(K, 18)).toBeCloseTo(baseRate(K, 18) * CFG.TEN_RV_FEE_SEC, 6);
    for (const i of [12, 13, 18, 19]) {
      const up = upTime(K, P(S.d[K][i]!.t, MAXLV - 1)), ms = renovMs(K, i);
      expect(ms).toBe(Math.round(Math.min(CFG.TEN_TIME_MAX, Math.max(60e3, up * CFG.TEN_RV_PCT))));
      expect(ms).toBeGreaterThanOrEqual(60e3); expect(ms).toBeLessThanOrEqual(CFG.TEN_TIME_MAX);
    }
    S.d['ist-0'][0]!.lvl = 5; expect(renovMs('ist-0', 0)).toBe(60e3); // Kadıköy evi: kısa (alt sınır)
  });
  it('başlatınca bedel kasadan, bina süre boyunca kira vermez (çevrimdışı hesap hariç); bitince anahtar ve bonus', () => {
    setup(); twoProjects(1); const x = mk({ a: 'esnaf', i: 18, w: { k: 'renov' } });
    const r0 = baseRate(K, 18), tot0 = totalRate(false), fee = renovFee(K, 18), ms = renovMs(K, 18), cash = S.cash;
    expect(satisfied(x)).toBe(false); expect(startRenov(x)).toBe(true);
    expect(S.cash).toBeCloseTo(cash - fee, 0); expect(x.rv).toBe(S.playMs + ms);
    expect(startRenov(x)).toBe(false); // ikinci kez olmaz
    expect(renovating(K, 18)).toBe(true); expect(baseRate(K, 18)).toBe(0); expect(totalRate(false)).toBeCloseTo(tot0 - r0, 3);
    expect(withoutTenants(() => baseRate(K, 18))).toBeCloseTo(r0, 9);
    const dl = x.dl; step(30e3); expect(x.dl).toBe(dl + 30e3); expect(inProgress(x)).toBe(true); // süre durur
    step(ms); expect(x.st).toBe('ready'); expect(baseRate(K, 18)).toBeCloseTo(r0, 9);
    expect(handKey(x)).toBe(true); expect(baseRate(K, 18)).toBeCloseTo(r0 * (1 + bonusOf(CHARS.find(c => c.id === 'ist.esnaf')!)), 6);
  });
  it('kasa yetmezse başlamaz; yalnız bekleyen yenileme isteğiyle başlar (sömürülemez)', () => {
    setup(); twoProjects(1); const x = mk({ a: 'esnaf', i: 18, w: { k: 'renov' } });
    S.cash = renovFee(K, 18) * 0.99; expect(startRenov(x)).toBe(false); expect(x.rv).toBeUndefined();
    S.cash = 1e15; const y = mk({ id: 2, a: 'aile', i: 12, w: { k: 'paint', c: 1 } }); expect(startRenov(y)).toBe(false);
    x.st = 'ready'; expect(startRenov(x)).toBe(false);
  });
  it('beklenen değer: her kişilikte bedel + kayıp kira bonusun %15–60\'ı (kârlı ama bedava değil)', () => {
    setup();
    for (const [k, i] of [['ist-0', 0], ['ist-2', 1], [K, 2], [K, 3]] as [string, number][]) {
      const R = baseRate(k, i), cost = renovFee(k, i) + R * renovMs(k, i) / 1000;
      for (const id of TRAIT_IDS) {
        charOpts.force = id; const gain = R * bonusOf(null) * liveOf(null) / 1000;
        expect(cost / gain, `${k}:${i} ${id}`).toBeGreaterThan(0.15); expect(cost / gain, `${k}:${i} ${id}`).toBeLessThan(0.6);
      }
      charOpts.force = '';
    }
  });
});

describe('ağırlıklar: tip havuzu × kişilik (90 karakter)', () => {
  const sum = (l: [string, number][]) => l.reduce((s, w) => s + w[1], 0);
  it('tip havuzu toplamı 4, türler geçerli; her karakterin havuzu tipinkiyle aynı toplam (sıklık aynı)', () => {
    for (const a of ARCHS) { expect(sum(ARCH[a].late)).toBeCloseTo(4, 9); expect(new Set(ARCH[a].late.map(w => w[0]))).toEqual(new Set(LATE_KINDS)); }
    for (const c of CHARS) {
      expect(Math.abs(sum(c.late) - sum(ARCH[c.a].late)), c.id).toBeLessThan(0.05);
      for (const [k, n] of c.late) { expect(LATE_KINDS, c.id).toContain(k); expect(n, c.id).toBeGreaterThan(0); }
    }
  });
  it('kişilik çarpanları: Titiz yenilemeyi, Manzara sever köşe başını, Coşkulu cepheyi tipinden sık ister', () => {
    const share = (l: [string, number][], k: string) => (l.find(w => w[0] === k)?.[1] || 0) / sum(l);
    const check = (trait: string, kind: string) => {
      const cs = CHARS.filter(c => c.trait === trait); expect(cs.length, trait).toBeGreaterThan(0);
      for (const c of cs) expect(share(c.late, kind), c.id).toBeGreaterThan(share(ARCH[c.a].late, kind));
    };
    check('titiz', 'renov'); check('manzaraci', 'kose'); check('coskulu', 'paint'); check('koklu', 'proj');
    for (const id of TRAIT_IDS) for (const k of Object.keys(TRAITS[id].late)) expect(LATE_KINDS).toContain(k);
  });
  it('semt kuralı: ucuz tadilat semtinde yenileme ×2 (aday başına)', () => {
    setup(); twoProjects(1);
    const w = () => lateCandidates(K).filter(c => c.w.k === 'renov').reduce((s, c) => s + c.wt, 0);
    const w1 = w(), o = DRULES[K]; expect(w1).toBeGreaterThan(0);
    DRULES[K] = { n: 'x', t: 'x', kind: 'upDisc', x: 0.2 };
    try { const lots = S.d[K]; expect(lots.every(p => !!p)).toBe(true); expect(w()).toBeGreaterThan(w1 * 1.5); } finally { DRULES[K] = o; }
  });
});

describe('kayıt: sanitize ve bulut paketi', () => {
  const save = (extra: Record<string, unknown>) => JSON.parse(JSON.stringify({ ...newState(T, WK, 'ist'), ...extra }));
  it('geçerli geç istekler korunur; bozuk etap/renk ve bilinmeyen tür düşer; yenileme bitişi elle uzatılamaz', () => {
    const b = { id: 5, a: 'aile', k: 'ist-0', dl: 1000, st: 'wait', end: 0 };
    const s = migrate(save({
      playMs: 10e3,
      ten: [{ ...b, i: 0, w: { k: 'proj', n: 2 } }, { ...b, i: 1, w: { k: 'proj', n: 3 } }, { ...b, i: 2, w: { k: 'paint', c: 3 } }, { ...b, i: 3, w: { k: 'paint', c: -1 } },
        { ...b, i: 4, w: { k: 'paint' } }, { ...b, i: 5, w: { k: 'kose' } }, { ...b, i: 6, w: { k: 'renov' }, rv: 9e15 }, { ...b, i: 7, w: { k: 'zzz' } },
        { ...b, i: 8, w: { k: 'renov' }, rv: 'x' }, { ...b, i: 9, w: { k: 'lvl', n: 3 }, rv: 50 }],
    }), T, WK)!;
    expect(s.ten.map(x => x.i)).toEqual([0, 2, 5, 6, 8, 9]);
    expect(s.ten[0].w).toEqual({ k: 'proj', n: 2 }); expect(s.ten[1].w).toEqual({ k: 'paint', c: 3 }); expect(s.ten[2].w).toEqual({ k: 'kose' });
    expect(s.ten[3].rv).toBe(10e3 + CFG.TEN_TIME_MAX); expect(s.ten[4].rv).toBeUndefined(); expect(s.ten[5].rv).toBeUndefined();
  });
  it('bulut paketi gidiş-dönüşü', () => {
    setup(); twoProjects(1); mk({ i: 18, a: 'esnaf', w: { k: 'renov' }, rv: S.playMs + 1000 }); mk({ id: 2, i: 13, a: 'sanatci', w: { k: 'paint', c: 2 } });
    mk({ id: 3, i: 0, a: 'aile', w: { k: 'proj', n: 2 } });
    const back = migrate(JSON.parse(JSON.stringify({ b: 1, saves: { tr: S } })).saves.tr, T, WK)!;
    expect(back.ten).toEqual(S.ten);
  });
  it('yeni CFG sabitleri Remote Config sınırından geçer', () => {
    for (const k of ['TEN_LATE_LV', 'TEN_LATE_GAP', 'TEN_PJ_AFFORD_SEC', 'TEN_RV_FEE_SEC', 'TEN_RV_PCT']) expect(sane(k, (DEF as any)[k]), k).toBe(true);
    expect(sane('TEN_RV_PCT', 2)).toBe(false); expect(sane('TEN_LATE_LV', 1.5)).toBe(false);
  });
});

describe('metinler (4 dil)', () => {
  it('her geç istek türü için söz, kısa istek, bağlantı, düğme ve Rıfkı cümlesi; yer tutucu kalmaz, çeviri var', () => {
    setup(); twoProjects(1); S.ihale.kose = [K + ':18'];
    const xs = [mk({ a: 'aile', i: 0, w: { k: 'proj', n: 1 } }), mk({ id: 2, a: 'esnaf', i: 1, w: { k: 'proj', n: 2 } }), mk({ id: 3, a: 'esnaf', i: 18, w: { k: 'kose' } }),
      mk({ id: 4, a: 'sanatci', i: 13, w: { k: 'paint', c: 2 } }), mk({ id: 5, a: 'emekli', i: 12, w: { k: 'renov' } }), mk({ id: 6, a: 'ogrenci', i: 16, w: { k: 'renov' } })];
    for (const lang of ['tr', 'en', 'de', 'ja'] as const) {
      setLang(lang);
      for (const x of xs) {
        const all = [quote(x), wishShort(x), wishLink(x), goLabel(x), ...(['ten', 'tennote', 'tenready', 'tenok', 'tenrv'] as const).map(e => tenantSay(e, x))];
        for (const s of all) { expect(s, lang + x.w.k).not.toMatch(/\{|undefined|NaN/); expect(s.length).toBeGreaterThan(1); }
      }
    }
    setLang('tr');
    const keys = ['Bu blok projeye dönüşsün', 'Projenin 2. etabı', 'Köşe başı arsada otursun', 'Cephe rengi: {c}', 'Binayı yenile', 'YENİLENİYOR', 'Yenile'];
    for (const d of [EN, DE, JA]) for (const k of keys) expect(d.s[k], k).toBeTruthy();
  });
});
