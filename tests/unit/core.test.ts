import { describe, it, expect, beforeEach } from 'vitest';
import { fmt, weekKey } from '../../src/format';
import { newState, migrate, setS, S } from '../../src/state';
import { guardRollback, Time } from '../../src/time';
import { checksum } from '../../src/storage';
import { unlockInfo, now, portfolioBonus, citiesOwned, totalRate } from '../../src/economy';
import { CFG, TIER_FEE } from '../../src/config';

const T = Date.UTC(2026, 10, 1, 12);
const full = () => Array.from({ length: 20 }, () => ({ t: 'ev' as const, lvl: 2, buf: 0, until: 0, dur: 1, up: false }));

describe('fmt', () => {
  it('küçük sayılar ve birimler', () => {
    expect(fmt(150)).toBe('₺150');
    expect(fmt(1500)).toMatch(/B$/);
    expect(fmt(2.5e6)).toMatch(/Mn$/);
    expect(fmt(3e9)).toMatch(/Mr$/);
    expect(fmt(4e12)).toMatch(/Tn$/);
  });
  it('çok büyük sayılar boş ya da NaN dönmez', () => {
    for (const n of [1e20, 1e33, 1e45, 1e60, 1e100]) { const s = fmt(n); expect(s).not.toMatch(/NaN|undefined|Infinity/); expect(s.length).toBeLessThan(14); }
  });
});

describe('kayıt taşıma (v1 → v2)', () => {
  it('eski İstanbul kaydı il anahtarlarına taşınır', () => {
    const d = [0, 1, 2, 3, 4].map(() => Array(20).fill(null)); d[0][3] = { t: 'kafe', lvl: 2, buf: 0, until: 0, dur: 1, up: false };
    const s = migrate({ v: 1, cash: 900, earned: 5000, unlocked: 2, cur: 1, d, fx: [{ k: 'row', d: 1, r: 2, x: 2, until: T + 1 }], lastSeen: T }, T, weekKey(new Date(T)))!;
    expect(s.v).toBe(2); expect(s.city).toBe('ist');
    expect(s.own).toEqual(['ist-0', 'ist-1']); expect(s.cur).toBe('ist-1');
    expect(s.d['ist-0'][3]!.t).toBe('kafe');
    expect(s.fx[0].d).toBe('ist-1');
    expect((s as any).unlocked).toBeUndefined();
    expect(s.ref.code).toMatch(/^TP[A-Z0-9]{4}$/);
  });
  it('bozuk veri reddedilir', () => {
    expect(migrate(null, T, 'x')).toBeNull();
    expect(migrate({ v: 1, d: 'bozuk' }, T, 'x')).toBeNull();
    expect(migrate({ v: 99 }, T, 'x')).toBeNull();
  });
  it('eksik alanlar doldurulur, negatif kasa düzeltilir', () => {
    const s = migrate({ v: 2, city: 'ank', own: ['ank-0'], cur: 'yok', d: {}, cash: -5 }, T, 'x')!;
    expect(s.cur).toBe('ank-0'); expect(s.cash).toBe(0); expect(Array.isArray(s.d['ank-0'])).toBe(true); expect(s.daily).toBeTruthy();
  });
});

describe('saat hilesi', () => {
  it('geri alınan saat yakalanır, 5 dk tolerans', () => {
    expect(guardRollback(T, T - 60e3).rolledBack).toBe(false);
    expect(guardRollback(T, T - 3600e3)).toEqual({ now: T, rolledBack: true });
  });
  it('oyun saati geri gitmez', () => {
    setS(newState(T, 'x', 'ist'));
    S.maxSeen = Time.now() + 3600e3; // cihaz saati 1 saat geri alınmış gibi
    expect(now()).toBe(S.maxSeen);
  });
});

describe('kayıt sağlaması', () => {
  it('aynı veri aynı, farklı veri farklı', () => {
    expect(checksum('{"a":1}')).toBe(checksum('{"a":1}'));
    expect(checksum('{"a":1}')).not.toBe(checksum('{"a":2}'));
  });
});

describe('semt ve il açılışı', () => {
  beforeEach(() => setS(newState(T, 'x', 'izm')));
  it('ilk semt dolmadan sıradaki semt ve diğer iller kapalı', () => {
    expect(unlockInfo('izm-1').why).toBe('prev-not-full');
    expect(unlockInfo('ist-0').why).toBe('start-not-full');
    expect(unlockInfo('ist-1').why).toBe('prev-not-owned');
  });
  it('ilk semt dolunca: sıradaki semt kademe bedeliyle, diğer illerin ilk semti il bedeliyle', () => {
    S.d['izm-0'] = full();
    expect(unlockInfo('izm-1')).toEqual({ ok: true, fee: TIER_FEE[1], why: '' });
    expect(unlockInfo('ist-0')).toEqual({ ok: true, fee: CFG.EXTRA_CITY_FEE_1, why: '' });
    S.own.push('ist-0'); S.d['ist-0'] = [];
    expect(unlockInfo('ank-0').fee).toBe(CFG.EXTRA_CITY_FEE_2);
  });
  it('portföy bonusu her ek il için %10', () => {
    S.d['izm-0'] = full();
    const base = totalRate(false);
    S.own.push('ank-0'); S.d['ank-0'] = Array(20).fill(null);
    expect(citiesOwned()).toBe(2); expect(portfolioBonus()).toBeCloseTo(0.1);
    expect(totalRate(false)).toBeCloseTo(base * 1.1, 5);
  });
});

import { leagueOutcome, leagueZones, weekEndsAt } from '../../src/game/league';
describe('haftalık lig', () => {
  it('30 kişilik grupta ilk 5 yükselir, son 5 düşer', () => {
    expect(leagueOutcome(1, 30, 1).to).toBe(2);
    expect(leagueOutcome(5, 30, 1).to).toBe(2);
    expect(leagueOutcome(6, 30, 1).to).toBe(1);
    expect(leagueOutcome(25, 30, 1).to).toBe(1);
    expect(leagueOutcome(26, 30, 1).to).toBe(0);
  });
  it('Arsa Ligi\'nde düşme, Gökdelen\'de yükselme yok; Gökdelen ilk 3 mühür alır', () => {
    expect(leagueOutcome(30, 30, 0).to).toBe(0);
    expect(leagueOutcome(1, 30, 4)).toEqual({ to: 4, seal: true });
    expect(leagueOutcome(4, 30, 4).seal).toBe(false);
  });
  it('küçük gruplarda daha az kişi yükselir, 15 altı kimse düşmez', () => {
    expect(leagueZones(6, 2)).toEqual({ up: 2, down: 0 });
    expect(leagueZones(12, 2)).toEqual({ up: 5, down: 0 });
    expect(leagueZones(20, 2)).toEqual({ up: 5, down: 5 });
    expect(leagueOutcome(12, 12, 2).to).toBe(2);
  });
  it('hafta pazartesi 00:00 UTC biter', () => {
    const sun = Date.UTC(2026, 10, 1, 22); // pazar
    expect(new Date(weekEndsAt(sun)).toISOString()).toBe('2026-11-02T00:00:00.000Z');
    const mon = Date.UTC(2026, 10, 2, 0, 30);
    expect(new Date(weekEndsAt(mon)).toISOString()).toBe('2026-11-09T00:00:00.000Z');
  });
});

import { largestGroup, pairsCount, goalsOf } from '../../src/game/goals';
import { season } from '../../src/game/calendar';
import { loc } from '../../src/format';
import { neighborBonus, baseRate, specialBase } from '../../src/economy';
import { weekSpecial } from '../../src/specials';
describe('yeni özellikler', () => {
  const b = (t: any, lvl = 1, sp?: string) => ({ t, lvl, buf: 0, until: 0, dur: 1, up: false, ...(sp ? { sp } : {}) });
  beforeEach(() => setS(newState(T, 'x', 'ist')));
  it('yan yana en büyük grup ve akıllı ikililer', () => {
    const L = S.d['ist-0']; L[0] = b('ev'); L[1] = b('ev'); L[4] = b('ev'); L[2] = b('dukkan'); L[10] = b('ev');
    expect(largestGroup('ist-0', 'ev')).toBe(3);
    expect(pairsCount('ist-0')).toBe(1); // 1(ev) – 2(dükkân)
    L[3] = b('ev'); // satır sonu sarmamalı: 3 ile 4 komşu değil
    expect(pairsCount('ist-0')).toBe(2);
  });
  it('komşuluk bonusu: aynı tür +%20, akıllı ikili +%10, özel yapı +%15', () => {
    const L = S.d['ist-0']; L[5] = b('kafe'); L[4] = b('kafe'); L[6] = b('ofis'); L[1] = b('ofis', 1, 'han');
    expect(neighborBonus('ist-0', 5)).toBeCloseTo(0.2 + 0.1 + 0.15);
  });
  it('özel yapı semtteki en iyi binanın 3 katı', () => {
    const L = S.d['ist-0']; L[0] = b('kafe', 2); L[10] = b('ofis', 1, 'han');
    expect(specialBase('ist-0', 10)).toBeCloseTo(3 * 9 * 2.5);
    expect(baseRate('ist-0', 10)).toBeGreaterThan(0);
  });
  it('3 yıldızlı semt kalıcı +%10', () => {
    const L = S.d['ist-0']; L[0] = b('ev', 2);
    const r0 = baseRate('ist-0', 0); S.stars = { 'ist-0': [0, 1, 2] };
    expect(baseRate('ist-0', 0)).toBeCloseTo(r0 * 1.1);
  });
  it('semt hedefleri kademeye göre', () => {
    expect(goalsOf('ist-0')[0].t).toContain('evi');
    expect(goalsOf('izm-2')[1].t).toContain('ofisi');
  });
  it('mevsimler (bayram yok)', () => {
    expect(season(+new Date(2027, 0, 10))).toBe('kis');
    expect(season(+new Date(2027, 6, 10))).toBe('yaz');
    expect(season(+new Date(2027, 3, 10))).toBe('');
  });
  it('Türkçe bulunma eki', () => {
    expect(loc('Kadıköy')).toBe('Kadıköy’de'); expect(loc('Beşiktaş')).toBe('Beşiktaş’ta'); expect(loc('Bebek')).toBe('Bebek’te'); expect(loc('Çankaya')).toBe('Çankaya’da');
  });
  it('haftanın özel yapısı hafta numarasına göre döner', () => {
    expect(weekSpecial('2026-H44').id).not.toBe(weekSpecial('2026-H45').id);
  });
});

import { ruleMult, buildTime as bt, upCost as uc } from '../../src/economy';
import { kaporaOf } from '../../src/game/district';
import { DRULES, TIER_FEE as TF } from '../../src/config';
describe('semt geçişleri', () => {
  beforeEach(() => setS(newState(T, 'x', 'ist')));
  it('semt kuralları: tür, sahil sırası, hız, tadilat indirimi', () => {
    expect(ruleMult('ist-1', 0, 'kafe')).toBeCloseTo(1.2);
    expect(ruleMult('ist-1', 0, 'ev')).toBe(1);
    expect(ruleMult('ist-4', 17, 'ev')).toBeCloseTo(1.3);  // en alt sıra
    expect(ruleMult('ist-4', 5, 'ev')).toBe(1);
    expect(bt('izm-1', 'ev') / bt('izm-0', 'ev')).toBeCloseTo(0.75 * 1.5 / 1, 5); // %25 hızlı, kademe 1 → ×1.5 süre
    const p = { t: 'ev' as const, lvl: 1, buf: 0, until: 0, dur: 1, up: false };
    expect(uc('ank-3', p) / uc('ist-3', p)).toBeCloseTo(0.8);
    expect(Object.keys(DRULES).filter(k => /^(ist|izm|ank)-/.test(k)).length).toBe(15);
    expect(Object.keys(DRULES).length).toBe(15 * 5); // 15 şehir × 5 semt
  });
  it('kapora tapunun %30’u', () => {
    S.d['ist-0'] = Array.from({ length: 20 }, () => ({ t: 'ev' as const, lvl: 1, buf: 0, until: 0, dur: 1, up: false }));
    expect(kaporaOf('ist-1')).toBe(Math.ceil(TF[1] * 0.3));
  });
});
