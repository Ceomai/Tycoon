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
