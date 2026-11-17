// Rakip emlakçı ve ihale (game/auccore.ts, game/auction.ts): takvim ve saat penceresi, rakip tavanı ve adımlar, ikinci fiyat,
// vekâlet, emanet, sonuç ve ruh hali, lig dışı tutma (ihale çarpanı lig sayacına girmez), köşe başı, Holding, bildirim planı,
// kayıt temizliği ve göç (bölgeye göre koleksiyon), bölgeye göre yapılar ve 15 şehir rakibi, CFG / Remote Config, adlar.
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
import { CFG, REGIONS, setRegion, CITIES, BuildingType, cityRegion, REGION_ORDER } from '../../src/config';
import { weekKey } from '../../src/format';
import { setLang, t, pn, pt } from '../../src/i18n';
import { baseRate, totalRate, ihaleLotMult, leagueShare, collBonus } from '../../src/economy';
import { addCash, collect } from '../../src/game/actions';
import { sane } from '../../src/services/remote';
import {
  IH, windowAt, nextWindow, makeAuction, rivalMax, standing, settle, setProxyCore, resolve, advice, heldNeed, minProxy, pickPrize, ihaleTickCore,
  placeKoseCore, koseOf, ihaleHolding, ihalePlan, RIVALS, ARCHE, ARCHES, rivalOf, nice, lmPool, ihaleUnlocked, isLate,
} from '../../src/game/auccore';
import { prizeName, ARCHE_LINES, ihaleNoteText, rifkiLine } from '../../src/game/auction';
import { LM, LM_SETS, LM_TR, IHALE_LM, lmSvg, migrateColl } from '../../src/landmarks';
import { rivalFace, LOOKS, RIVAL_MOODS } from '../../src/ui/rivalFace';
import { moodOf } from '../../src/ui/rifkiFace';
import { EN } from '../../src/locales/en';
import { DE } from '../../src/locales/de';
import { JA } from '../../src/locales/ja';
import { Time } from '../../src/time';

const DEF = { ...CFG };
const MON = new Date(2026, 10, 16, 10, 0).getTime(); // Pazartesi 10:00 (yerel)
const at = (d: number, h: number, m = 0) => new Date(2026, 10, d, h, m).getTime();
const WK = weekKey(new Date(MON));
const P = (t: BuildingType, lvl = 3): Plot => ({ t, lvl, buf: 0, until: 0, dur: 1, up: false });
function setup(city = 'ist', tn = MON) {
  Time.offset = tn - Date.now();
  setS(newState(tn, WK, city));
  const k0 = city + '-0', k1 = city + '-1';
  S.d[k0] = Array.from({ length: 20 }, (_, i) => P((['ev', 'kafe', 'dukkan', 'ofis'] as BuildingType[])[i % 4]));
  S.d[k1] = Array(20).fill(null); S.own = [k0, k1]; S.cur = k0; S.cash = 1e9; S.earned = 1e9;
}
const auc = (kind: 'lm' | 'arsa' = 'lm', city = 'ist', unit = 1000, id = 'x') => makeAuction(id, kind, kind === 'lm' ? 'beylerbeyi' : 'kose', city, MON - 2 * 3600e3, unit);

beforeEach(() => { Object.assign(CFG, DEF); setRegion('tr'); setLang('tr'); Time.offset = 0; });

describe('takvim ve saat penceresi (yerel 08:00–23:00, Pazartesi tarihi yapı, Perşembe nadir arsa)', () => {
  it('Pazartesi 08:00 açılır, 23:00 kapanır; dışında ihale yok', () => {
    expect(windowAt(at(16, 7, 59))).toBeNull();
    const w = windowAt(at(16, 8))!; expect(w.kind).toBe('lm'); expect(w.open).toBe(at(16, 8)); expect(w.close).toBe(at(16, 23));
    expect(windowAt(at(16, 22, 59))!.id).toBe(w.id);
    expect(windowAt(at(16, 23))).toBeNull();
  });
  it('Perşembe nadir arsa; Salı, Cumartesi (özel yapı ihalesi yok) boş', () => {
    expect(windowAt(at(19, 12))!.kind).toBe('arsa');
    expect(windowAt(at(17, 12))).toBeNull(); expect(windowAt(at(21, 12))).toBeNull(); expect(windowAt(at(22, 12))).toBeNull();
  });
  it('sıradaki pencere ve CFG ile gün/saat değişir', () => {
    expect(nextWindow(at(17, 12))!.open).toBe(at(19, 8));
    expect(nextWindow(at(16, 23, 30))!.open).toBe(at(19, 8));
    CFG.IH_ARSA_DAY = 5; CFG.IH_OPEN_H = 9; CFG.IH_CLOSE_H = 21;
    expect(windowAt(at(19, 12))).toBeNull(); expect(windowAt(at(20, 9))!.kind).toBe('arsa'); expect(windowAt(at(20, 21))).toBeNull();
  });
});

describe('rakip tavanı, adımlar ve tempo', () => {
  it('açılış = dakikalık kira × 15 (tarihi yapı) / 8 (arsa), adım = açılışın %10\'u, "güzel" sayılar', () => {
    setup(); const a = auc('lm', 'ist', 1234), b = auc('arsa', 'ist', 1234);
    expect(a.start).toBe(nice(1234 * 15)); expect(a.step).toBe(nice(a.start * 0.1)); expect(b.start).toBe(nice(1234 * 8));
    expect(nice(18510)).toBe(19000); expect(nice(37)).toBe(37);
  });
  it('tavan tohumlu ve sabit; Rıfkı aralığının içinde; açılışta belli', () => {
    setup(); const a = auc('lm', 'ist', 5000, 'a1'), a2 = auc('lm', 'ist', 5000, 'a1'), a3 = auc('lm', 'ist', 5000, 'z9');
    expect(a.cap).toBe(a2.cap); expect(a.cap).toBeGreaterThanOrEqual(a.capLo); expect(a.cap).toBeLessThanOrEqual(a.capHi);
    expect(a.cap % a.step).toBe(0); expect([a.cap, a3.cap].length).toBe(2);
    const mid = a.start * CFG.IH_LM_K * ARCHE.koleksiyoncu.k.lm; expect(a.capHi).toBeLessThanOrEqual(Math.ceil(mid * 1.08 / a.step) * a.step);
  });
  it('arketip ve ruh hali tavanı küçük farklarla değiştirir (beklenen zorluk dengeli)', () => {
    setup();
    for (const ar of ARCHES) { const k = ARCHE[ar].k; expect((k.lm + k.arsa) / 2).toBeGreaterThan(0.94); expect((k.lm + k.arsa) / 2).toBeLessThan(1.09); }
    const avg = ARCHES.reduce((s, a) => s + ARCHE[a].k.lm + ARCHE[a].k.arsa, 0) / 8; expect(Math.abs(avg - 1)).toBeLessThan(0.03);
    const base = auc('lm', 'ist', 5000, 'm'); IH().rm.cemil = 1; const hungry = auc('lm', 'ist', 5000, 'm'); IH().rm.cemil = -1; const poor = auc('lm', 'ist', 5000, 'm');
    expect(hungry.capHi).toBeGreaterThan(base.capHi); expect(poor.capHi).toBeLessThan(base.capHi);
  });
  it('son düzlükten önce tavanın %70\'i (arketip ±), son düzlükte tamamı', () => {
    setup(); const a = auc();
    expect(rivalMax(a, a.close - CFG.IH_LATE_MS - 1)).toBe(Math.max(a.start, Math.floor(a.cap * a.early / a.step) * a.step));
    expect(rivalMax(a, a.close - CFG.IH_LATE_MS)).toBe(a.cap); expect(isLate(a, a.close - 1)).toBe(true);
    expect(makeAuction('t', 'lm', 'x', 'nyc', MON, 1000).early).toBeCloseTo(0.75); expect(makeAuction('t', 'lm', 'x', 'ank', MON, 1000).early).toBeCloseTo(0.65);
  });
});

describe('ikinci fiyat, vekâlet ve emanet', () => {
  it('eşitlikte rakip önde; önde olan karşı tarafın sınırının bir adım üstünü öder', () => {
    setup(); const a = auc(), tn = MON, r = rivalMax(a, tn);
    expect(standing(a, tn, r)).toEqual({ lead: 'rv', price: r });
    expect(standing(a, tn, r + a.step)).toEqual({ lead: 'me', price: r + a.step });
    expect(standing(a, tn, r * 10)).toEqual({ lead: 'me', price: r + a.step }); // yüksek vekâlet daha pahalı değil
    expect(standing(a, tn, 0)).toEqual({ lead: 'rv', price: a.start });
  });
  it('vekâlet: düşük tutar ve yetersiz kasa reddedilir; verilince yalnız önde olunan fiyat kasadan ayrılır', () => {
    setup(); const a = auc(), tn = MON;
    expect(setProxyCore(a, a.start, tn)).toBe('low');
    S.cash = 10; expect(setProxyCore(a, advice(a), tn)).toBe('cash'); expect(a.my).toBe(0);
    S.cash = 1e9; const c0 = S.cash, need = heldNeed(a, advice(a), tn);
    expect(setProxyCore(a, advice(a), tn)).toBeNull();
    expect(a.held).toBe(rivalMax(a, tn) + a.step); expect(need).toBe(a.held); expect(S.cash).toBe(c0 - a.held);
    expect(minProxy(a, tn)).toBe(a.my + a.step);
  });
  it('son düzlükte geçilince emanet kasaya döner; tavanın üstündeyse fiyat yükselir', () => {
    setup(); const a = auc(), tn = MON, c0 = S.cash;
    setProxyCore(a, a.cap - a.step, tn); expect(a.held).toBeGreaterThan(0);
    settle(a, a.close - 1000); expect(a.held).toBe(0); expect(S.cash).toBe(c0);
    const b = auc('lm', 'ist', 1000, 'b'); setProxyCore(b, advice(b), tn); settle(b, b.close - 1000);
    expect(b.held).toBe(b.cap + b.step); expect(S.cash).toBe(c0 - b.cap - b.step);
  });
  it('kasa yetmezse vekâlet kasanın karşıladığı yere iner', () => {
    setup(); const a = auc(), tn = MON; setProxyCore(a, advice(a), tn);
    S.cash = 0; expect(settle(a, a.close - 1000)).toBe(true);
    expect(a.my).toBeLessThan(advice(a)); expect(standing(a, a.close - 1000).lead).toBe('rv'); expect(a.held).toBe(0);
  });
});

describe('sonuç, ödüller ve ruh hali', () => {
  it('kazanınca: fiyat tavan + 1 adım ödenir, yapı İhale salonuna; rakip bir dahakine hırslı', () => {
    setup(); const a = auc(), c0 = S.cash; setProxyCore(a, advice(a), MON); resolve(a);
    expect(a.done).toBe('won'); expect(a.paid).toBe(a.cap + a.step); expect(S.cash).toBe(c0 - a.paid!); expect(a.held).toBe(0);
    expect(IH().got).toEqual(['beylerbeyi']); expect(IH().wins).toBe(1); expect(IH().rm.cemil).toBe(1);
  });
  it('kaybedince: para olduğu gibi kasada, ödül yok; katılmayana kart yok', () => {
    setup(); const a = auc(), c0 = S.cash; setProxyCore(a, a.cap - a.step, MON); resolve(a);
    expect(a.done).toBe('lost'); expect(S.cash).toBe(c0); expect(IH().got).toEqual([]); expect(IH().losses).toBe(1); expect(IH().rm.cemil).toBe(-1); expect(a.seen).toBeFalsy();
    const b = auc('lm', 'ist', 1000, 'b'); resolve(b); expect(b.seen).toBe(true); expect(IH().losses).toBe(1);
  });
  it('nadir arsa: köşe başı damgası, semt başına bir; o arsa +%40', () => {
    setup(); const a = auc('arsa'); setProxyCore(a, advice(a), MON); resolve(a); expect(IH().kp).toBe(1);
    const r0 = baseRate('ist-0', 3);
    expect(placeKoseCore('ist-9', 3)).toBe(false); expect(placeKoseCore('ist-0', 20)).toBe(false);
    expect(placeKoseCore('ist-0', 3)).toBe(true); expect(koseOf('ist-0')).toBe(3); expect(IH().kp).toBe(0);
    expect(baseRate('ist-0', 3) / r0).toBeCloseTo(1 + CFG.IH_KOSE_X, 6);
    IH().kp = 1; expect(placeKoseCore('ist-0', 5)).toBe(false);
  });
  it('ihale yapısı tüm kiralara kalıcı +%3 (en çok 4)', () => {
    setup(); const r0 = totalRate(false);
    IH().got = ['beylerbeyi', 'sirkeci']; expect(totalRate(false) / r0).toBeCloseTo(1.06, 6);
    IH().got = IHALE_LM.map(l => l.id); expect(totalRate(false) / r0).toBeCloseTo(1.12, 6);
  });
  it('Holding: köşe başı semtle gider, süren katılım düşer, yapılar kalır', () => {
    setup(); IH().got = ['beylerbeyi']; IH().kose = ['ist-0:3']; const a = auc(); setProxyCore(a, advice(a), MON); IH().cur = a;
    ihaleHolding(); expect(IH().kose).toEqual([]); expect(a.my).toBe(0); expect(a.held).toBe(0); expect(IH().got).toEqual(['beylerbeyi']);
  });
});

describe('lig dışı tutma (ihale ödülleri haftalık lig kazancına sayılmaz)', () => {
  it('ihalesiz oyuncuda lig payı tam 1 (yok sayan %0)', () => {
    setup(); expect(leagueShare()).toBe(1); const w0 = S.week.earned; addCash(1000); expect(S.week.earned - w0).toBe(1000);
  });
  it('köşe başı arsadan toplanan kira lige çarpansız yazılır; kasaya tamamı', () => {
    setup(); IH().kose = ['ist-0:3']; IH().got = ['beylerbeyi'];
    const lots = S.d['ist-0']; lots[3]!.buf = 1400 * 1.03; lots[4]!.buf = 1000;
    const c0 = S.cash, w0 = S.week.earned; collect('ist-0', 3);
    expect(S.cash - c0).toBeCloseTo(1400 * 1.03, 6); expect(S.week.earned - w0).toBeCloseTo(1000, 6);
    expect(ihaleLotMult('ist-0', 4)).toBeCloseTo(1.03, 9);
  });
  it('diğer kazançlar (taksi, kart…) toplam kiradaki ihale payına bölünür; kiracı/proje bonusu sayılmaya devam eder', () => {
    setup(); IH().got = IHALE_LM.slice(0, 4).map(l => l.id);
    expect(leagueShare()).toBeCloseTo(1 / 1.12, 6);
    const w0 = S.week.earned; addCash(1120); expect(S.week.earned - w0).toBeCloseTo(1000, 6);
    S.ten = [{ id: 1, a: 'ogrenci', k: 'ist-0', i: 0, w: { k: 'lvl', n: 1 }, dl: 0, st: 'live', end: 9e15 } as any];
    expect(leagueShare()).toBeCloseTo(1 / 1.12, 6); // kiracı bonusu lig payını düşürmez
  });
});

describe('ödül seçimi, oyun döngüsü ve bildirim planı', () => {
  it('Pazartesi bölgenin yapısı (önce ekrandaki şehir); 4 yapı alınınca köşe başı; yer yoksa ihale yok', () => {
    setup('ank'); expect(pickPrize('lm')).toEqual({ kind: 'lm', prize: 'ankaragar', city: 'ank' });
    IH().got = ['beylerbeyi', 'sirkeci', 'kizlaragasi', 'ankaragar']; expect(pickPrize('lm')!.kind).toBe('arsa');
    IH().kose = ['ank-0:1', 'ank-1:1']; expect(pickPrize('lm')).toBeNull(); expect(pickPrize('arsa')).toBeNull();
  });
  it('Global: ihale yapısı ve rakip semtin şehrinin ülkesine göre', () => {
    setRegion('gl'); setup('lon'); const p = pickPrize('lm')!; expect(p.city).toBe('lon'); expect(IHALE_LM.find(l => l.id === p.prize)!.reg).toBe('uk');
    expect(rivalOf(p.city).id).toBe('reginald');
    setup('tyo'); expect(IHALE_LM.find(l => l.id === pickPrize('lm')!.prize)!.reg).toBe('jp');
  });
  it('döngü: pencerede (açılmışsa) ihale kurulur, kapanınca sonuçlanır, bir sonraki pencereye kadar yenisi yok', () => {
    setup(); S.own = ['ist-0']; expect(ihaleUnlocked()).toBe(false); expect(ihaleTickCore(MON).created).toBeUndefined();
    S.own = ['ist-0', 'ist-1']; const ev = ihaleTickCore(MON, () => 6000); expect(ev.created!.prize).toBe('beylerbeyi'); expect(ev.created!.close).toBe(at(16, 23));
    const a = IH().cur!; setProxyCore(a, advice(a), MON);
    expect(ihaleTickCore(at(16, 22)).late).toBeUndefined(); // öndeyken uyarı yok
    expect(ihaleTickCore(at(16, 23, 1)).resolved).toBe(a); expect(a.done).toBe('won');
    expect(ihaleTickCore(at(17, 12)).created).toBeUndefined();
    expect(ihaleTickCore(at(19, 9), () => 6000).created!.kind).toBe('arsa');
  });
  it('son düzlükte geçilince Rıfkı uyarısı (bir kez); kasa yetmezse vekâlet iner uyarısı', () => {
    setup(); ihaleTickCore(MON, () => 6000); const a = IH().cur!; setProxyCore(a, a.cap - a.step, MON);
    expect(ihaleTickCore(at(16, 21, 1)).late).toBe(a); expect(ihaleTickCore(at(16, 21, 2)).late).toBeUndefined();
  });
  it('bildirim planı: ihale başına en çok 2 (öndeyken son düzlükte geçilecekse + sonuç); katılmayana yok', () => {
    setup(); const a = auc(); IH().cur = a;
    expect(ihalePlan(MON)).toBeNull();
    setProxyCore(a, a.cap - a.step, MON); const p = ihalePlan(MON)!;
    expect(p.passed).toBe(a.close - CFG.IH_LATE_MS); expect(p.result).toBe(a.close); expect(p.won).toBe(false);
    const b = auc('lm', 'ist', 1000, 'b'); IH().cur = b; setProxyCore(b, advice(b), MON); const q = ihalePlan(MON)!;
    expect(q.passed).toBeNull(); expect(q.won).toBe(true);
    S.cash = 0; expect(ihalePlan(MON)!.won).toBe(false); // kasa son düzlüğü karşılamazsa kaybeder (oyunla aynı hesap)
    expect(ihaleNoteText(b, 'passed').title).toBe('Kurnaz Cemil seni geçti');
  });
});

describe('kayıt: temizlik, göç, bulut', () => {
  const save = (x: any) => JSON.parse(JSON.stringify({ ...newState(MON, WK, 'ist'), own: ['ist-0', 'ist-1'], ...x }));
  it('eski kayıt (ihale alanı yok) ve bozuk alanlar varsayılana döner', () => {
    const raw = save({}); delete raw.ihale;
    expect(migrate(raw, MON, WK)!.ihale).toEqual({ cur: null, rm: {}, got: [], kose: [], kp: 0, intro: false, wins: 0, losses: 0 });
    const s = migrate(save({ ihale: { cur: 5, rm: { cemil: 7, hank: -1 }, got: ['bigben', 'yok', 'bigben', 3], kose: ['ist-0:3', 'ist-0:4', 'ist-9:1', 'ist-1:x', 'ist-1:22'], kp: -4, intro: 'evet', wins: 1e99 } }), MON, WK)!;
    expect(s.ihale).toEqual({ cur: null, rm: { hank: -1 }, got: ['bigben'], kose: ['ist-0:3'], kp: 0, intro: false, wins: 1e6, losses: 0 });
  });
  it('süren ihale alan alan doğrulanır; bozuksa düşer ve emaneti kasaya döner', () => {
    setup(); const a = auc(); setProxyCore(a, advice(a), MON);
    const ok = migrate(save({ cash: 5, ihale: { ...IH(), cur: a } }), MON, WK)!; expect(ok.ihale.cur).toEqual(a); expect(ok.cash).toBe(5);
    const bad = migrate(save({ cash: 5, ihale: { ...IH(), cur: { ...a, step: -1 } } }), MON, WK)!; expect(bad.ihale.cur).toBeNull(); expect(bad.cash).toBe(5 + a.held);
    const unk = migrate(save({ ihale: { ...IH(), cur: { ...a, prize: 'yok' } } }), MON, WK)!; expect(unk.ihale.cur).toBeNull();
    const done = migrate(save({ ihale: { ...IH(), cur: { ...a, done: 'won', held: 99 } } }), MON, WK)!; expect(done.ihale.cur!.held).toBe(0);
  });
  it('bulut paketi (JSON) gidip gelince aynı', () => {
    setup(); const a = auc(); setProxyCore(a, advice(a), MON); IH().cur = a; IH().got = ['sirkeci']; IH().kose = ['ist-0:2']; IH().rm = { cemil: 1 };
    const back = migrate(JSON.parse(JSON.stringify({ b: 1, saves: { tr: S } })).saves.tr, MON, WK)!;
    expect(back.ihale).toEqual(JSON.parse(JSON.stringify(S.ihale)));
  });
  it('koleksiyon bölgeye göre: Türkiye aynen; eski kayıttaki Türk yapıları diğer bölgede aynı sıradaki bölge yapısına döner', () => {
    expect(migrateColl(['galata', 'kale', 'xx'], 'tr')).toEqual(['galata', 'kale']);
    expect(migrateColl(['galata', 'kale'], 'us')).toEqual([LM_SETS.us[0].id, LM_SETS.us[9].id]);
    expect(migrateColl(['brooklyn', 'galata'], 'us')).toEqual(['brooklyn']); // çakışan tekilleşir
    expect(migrateColl(['galata', 'kiz', 'saat'], 'gl')).toEqual(['galata', 'kiz', LM_SETS.gl[2].id]);
    expect(migrateColl(migrateColl(['konak', 'rumeli'], 'de'), 'de')).toEqual(migrateColl(['konak', 'rumeli'], 'de')); // tekrar uygulanabilir
    setRegion('jp'); const s = migrate(save({ coll: ['galata', 'kiz', 'asansor'] }), MON, WK)!;
    expect(s.coll).toEqual(['skytree', 'rainbow', 'yasaka']); expect(LM).toBe(LM); expect(LM[0].id).toBe('skytree');
    setS(s); expect(collBonus()).toBeCloseTo(0.15, 9);
  });
});

describe('bölgeye göre yapılar ve rakipler', () => {
  it('her bölgenin 10 koleksiyon ve 4 ihale yapısı; Türkiye\'nin 10 yapısı aynen; çizimleri var ve farklı', () => {
    expect(LM_TR.map(l => l.id)).toEqual(['galata', 'kiz', 'saat', 'rumeli', 'tramvay', 'haydarpasa', 'konak', 'asansor', 'atakule', 'kale']);
    const fallback = lmSvg('___');
    for (const r of REGION_ORDER) {
      const L = LM_SETS[r]; expect(L.length).toBe(10);
      for (const l of L) { expect(lmSvg(l.id)).not.toBe(r === 'tr' && l.id === 'haydarpasa' ? '' : fallback); expect(CITIES[l.city]).toBeTruthy(); if (r !== 'gl') expect(cityRegion(l.city)).toBe(r); }
      setRegion(r); expect(LM.map(l => l.id)).toEqual(L.map(l => l.id));
    }
    for (const r of ['tr', 'us', 'uk', 'de', 'jp']) { const P4 = IHALE_LM.filter(l => l.reg === r); expect(P4.length).toBe(4); for (const l of P4) { expect(cityRegion(l.city)).toBe(r); expect(lmSvg(l.id)).not.toBe(fallback); } }
    const ids = [...IHALE_LM, ...Object.values(LM_SETS).flat()].map(l => l.id); expect(new Set(lmSvgAll(ids)).size).toBe(new Set(ids).size);
    setRegion('us'); expect(lmPool('nyc').map(l => l.id)).toEqual(['liberty', 'empire', 'griffith', 'watertower']);
  });
  it('15 şehir, 15 rakip; her biri bir arketipte, 3 ifadeli portre; adları 4 dilde', () => {
    const cities = Object.keys(CITIES); expect(RIVALS.length).toBe(15); expect(new Set(RIVALS.map(r => r.city))).toEqual(new Set(cities));
    expect(RIVALS.filter(r => ['cemil', 'reginald', 'hank', 'pfennig', 'tanaka'].includes(r.id)).map(r => r.city).sort()).toEqual(['ist', 'lon', 'muc', 'nyc', 'tyo']);
    for (const a of ARCHES) expect(RIVALS.filter(r => r.a === a).length).toBeGreaterThanOrEqual(3);
    const svgs = new Set<string>();
    for (const r of RIVALS) {
      expect(LOOKS[r.id]).toBeTruthy();
      for (const m of RIVAL_MOODS) { const f = rivalFace(r.id, m); expect(f).toMatch(/^<svg[^>]*data-mood="/); expect(f).not.toMatch(/NaN|undefined/); svgs.add(f); }
      for (const D of [EN, DE, JA]) { expect(D.s[r.n]).toBeTruthy(); expect(D.s[r.tag]).toBeTruthy(); }
    }
    expect(svgs.size).toBe(45);
    for (const a of ARCHES) for (const D of [EN, DE, JA]) { expect(D.s[ARCHE[a].n]).toBeTruthy(); expect(D.s[ARCHE_LINES[a].win]).toBeTruthy(); expect(D.s[ARCHE_LINES[a].lose]).toBeTruthy(); }
    for (const l of [...IHALE_LM, ...Object.values(LM_SETS).flat()]) for (const D of [EN, DE, JA]) expect(D.s[l.n]).toBeTruthy();
  });
  it('Türkçe büyük harf: yabancı özel ad lang="en" ile (BİG BEN olmaz); düz metinde köşeli parantez yok', () => {
    expect(pn(t('[Big Ben]'))).toBe('<span lang="en">Big Ben</span>'); expect(pn(t('[Edinburgh] Kalesi'))).toBe('<span lang="en">Edinburgh</span> Kalesi');
    expect(pn('Kurnaz Cemil')).toBe('Kurnaz Cemil'); expect(pt(t('[Sir Reginald]'))).toBe('Sir Reginald');
    setLang('en'); expect(pn(t('[Big Ben]'))).toBe('Big Ben'); expect(pn(t('[Edinburgh] Kalesi'))).toBe('Edinburgh Castle');
    setLang('tr'); setup(); const a = auc(); expect(prizeName(a)).toBe('Beylerbeyi Sarayı');
    const b = makeAuction('b', 'lm', 'bigben', 'lon', MON, 1000); expect(prizeName(b)).toContain('lang="en"'); expect(prizeName(b, false)).toBe('Big Ben');
    expect(rifkiLine(b, MON).text).toContain('<span lang="en">Sir Reginald</span>');
  });
});

describe('CFG / Remote Config ve Rıfkı', () => {
  it('ihale sabitleri CFG\'de ve Remote Config sınır denetiminden geçer', () => {
    for (const k of ['IH_LM_DAY', 'IH_ARSA_DAY', 'IH_OPEN_H', 'IH_CLOSE_H', 'IH_LATE_MS', 'IH_EARLY', 'IH_LM_OPEN', 'IH_ARSA_OPEN', 'IH_LM_K', 'IH_ARSA_K', 'IH_STEP', 'IH_NOISE', 'IH_MOOD', 'IH_LM_X', 'IH_LM_N', 'IH_KOSE_X', 'IH_UNLOCK_OWN', 'IH_SHOW_MS'])
      expect(typeof (CFG as any)[k]).toBe('number');
    expect(sane('IH_KOSE_X', 0.3)).toBe(true); expect(sane('IH_KOSE_X', 1.5)).toBe(false); expect(sane('IH_LM_OPEN', 10)).toBe(true);
    CFG.IH_LM_X = 0.05; setup(); const r0 = totalRate(false); IH().got = ['beylerbeyi']; expect(totalRate(false) / r0).toBeCloseTo(1.05, 6);
  });
  it('Rıfkı\'nın ifadeleri: ihale düşünceli, son düzlük ve kasa uyarı', () => {
    expect(moodOf('ihale')).toBe('think'); expect(moodOf('ihlate')).toBe('warn'); expect(moodOf('ihcut')).toBe('warn');
    setup(); const a = auc(); expect(rifkiLine(a, MON).mood).toBe('think'); expect(rifkiLine(a, a.close - 1000).mood).toBe('warn');
    setProxyCore(a, advice(a), MON); expect(rifkiLine(a, MON).mood).toBe('party');
  });
  it('bölgeler tanımlı (REGIONS) ve her bölgenin şehir rakibi var', () => {
    for (const r of Object.keys(REGIONS)) for (const c of REGIONS[r as keyof typeof REGIONS].cities) expect(rivalOf(c).city).toBe(c);
  });
});
function lmSvgAll(ids: string[]) { return ids.map(id => lmSvg(id)); }
