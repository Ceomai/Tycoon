// Kullanım hunisi (services/funnel.ts): her adım doğru olayı doğru parametrelerle bir kez gönderir; bir-kez olaylar (S.fn)
// tekrar etmez ve kayıtta korunur; adlar ve parametreler Firebase kurallarına uyar; kişisel veri ve serbest metin yok; hız sınırı;
// eski kayıt sessizce işaretlenir; docs/ANALYTICS.md koddaki olay listesiyle aynıdır; rehberdeki CFG anahtarları gerçektir.
import { describe, it, expect, vi, beforeEach } from 'vitest';
// @ts-ignore: düğüm türleri bu projede yüklü değil; yalnızca vitest (Node) altında çalışır
import fs from 'node:fs';

const log = vi.hoisted(() => ({ ev: [] as { name: string; params: Record<string, any> }[], props: [] as Record<string, string>[], boom: false }));
vi.mock('../../src/services/analytics', () => ({
  Analytics: {
    log: (name: string, params: Record<string, any>) => { if (log.boom) throw new Error('analitik çöktü'); log.ev.push({ name, params }); },
    props: (p: Record<string, string>) => { log.props.push(p); },
    error: vi.fn(), setUser: vi.fn(),
  },
}));

import { newState, setS, S, migrate } from '../../src/state';
import type { Auction, Pj } from '../../src/state';
import type { Tenant } from '../../src/game/tenants';
import { CFG, setRegion } from '../../src/config';
import { weekKey } from '../../src/format';
import {
  Funnel, EVENTS, OLD_EVENTS, USER_PROPS, MS, SYS, NAME_RE, MAX_PARAMS, MAX_STR, MAX_PROP_NAME, MAX_PROP_VAL, RESERVED, validName,
  clean, send, seed, minB, magB, cntB, pctB, xB, LIMIT, stats, userProps, FN_MASK,
} from '../../src/services/funnel';

const T = Date.UTC(2026, 10, 16, 12), WK = weekKey(new Date(T));
const names = () => log.ev.map(e => e.name);
const last = (n: string) => { const e = [...log.ev].reverse().find(x => x.name === n); if (!e) throw new Error('olay yok: ' + n + ' [' + names().join(',') + ']'); return e.params; };
const count = (n: string) => log.ev.filter(e => e.name === n).length;
const ten = (o: Partial<Tenant> = {}): Tenant => ({ id: 7, a: 'ogrenci', k: 'ist-0', i: 3, w: { k: 'nb', t: 'kafe' }, dl: 8 * 60e3, st: 'wait', end: 0, c: 'ist.ogrenci', ...o } as Tenant);
const auc = (o: Partial<Auction> = {}): Auction => ({ id: '2026-W47-lm', kind: 'lm', prize: 'x', city: 'ist', rv: 'ist', open: T, close: T + 15 * 3600e3,
  start: 1000, step: 100, cap: 2400, capLo: 2200, capHi: 2600, early: 0.7, my: 0, held: 0, log: [], ...o });

beforeEach(() => {
  setRegion('tr'); setS(newState(T, WK, 'ist'));
  log.ev.length = 0; log.props.length = 0; log.boom = false; Funnel.reset();
});

describe('Firebase kuralları', () => {
  it('olay adları: ≤40 karakter, snake_case, ayrılmış değil, tekrarsız; yeni ad sayısı 25–35', () => {
    expect(new Set(EVENTS).size).toBe(EVENTS.length);
    for (const n of EVENTS) { expect(n.length, n).toBeLessThanOrEqual(40); expect(NAME_RE.test(n), n).toBe(true); expect(validName(n), n).toBe(true); }
    for (const n of OLD_EVENTS) expect(EVENTS, n).toContain(n);
    const fresh = EVENTS.filter(n => !OLD_EVENTS.includes(n));
    expect(fresh.length).toBeGreaterThanOrEqual(25); expect(fresh.length).toBeLessThanOrEqual(35);
  });
  it('ayrılmış ad ve önek gönderilmez', () => {
    for (const n of ['session_start', 'first_open', 'ad_reward', 'firebase_x', 'google_x', 'ga_x', 'Büyük', 'a b', '1abc', 'x'.repeat(41), '']) {
      expect(validName(n), n).toBe(false); expect(send(n, {}), n).toBe(false);
    }
    expect(RESERVED.has('screen_view')).toBe(true);
    expect(log.ev.length).toBe(0); expect(stats.invalid).toBe(11);
  });
  it('kullanıcı özellikleri: ≤25 adet, ad ≤24, değer ≤36, kişisel veri yok', () => {
    expect(USER_PROPS.length).toBeLessThanOrEqual(25);
    const p = userProps();
    expect(Object.keys(p).sort()).toEqual([...USER_PROPS].sort());
    for (const [k, v] of Object.entries(p)) { expect(k.length).toBeLessThanOrEqual(MAX_PROP_NAME); expect(NAME_RE.test(k)).toBe(true); expect(v.length).toBeLessThanOrEqual(MAX_PROP_VAL); }
    expect(p).toEqual({ region: 'tr', lang: expect.any(String), payer: 'none', holding_b: '0', own_b: '1', collect_mode: 'tap' });
    S.club = true; S.shares = 7; S.collectMode = 'auto'; S.own = ['ist-0', 'ist-1', 'ist-2'];
    expect(userProps()).toMatchObject({ payer: 'club', holding_b: '5', own_b: '3', collect_mode: 'auto' });
  });
  it('clean: mantıksal → 0/1, boş ve sonsuz düşer, metin kısalır ve serbest metin karakterleri atılır, en çok 25 parametre', () => {
    const c = clean({ a: true, b: false, c: null, d: undefined, e: '', f: NaN, g: Infinity, h: 1.23456789, i: 'Ece Yılmaz <ece@x.com>', j: 'x'.repeat(90), 'Kötü Ad': 1, firebase_x: 1 });
    expect(c).toEqual({ a: 1, b: 0, h: 1.2346, i: 'EceYlmazecex.com', j: 'x'.repeat(MAX_STR) });
    const many: Record<string, number> = {}; for (let n = 0; n < 40; n++) many['p' + n] = n;
    expect(Object.keys(clean(many)).length).toBe(MAX_PARAMS);
  });
  it('kovalar', () => {
    expect([0, 30e3, 60e3, 7 * 60e3, 59 * 60e3, 60 * 60e3, 3 * 24 * 3600e3, NaN, -5].map(minB)).toEqual(['m0000', 'm0000', 'm0001', 'm0005', 'm0045', 'm0060', 'm1440', 'm0000', 'm0000']);
    expect([0, 0.5, 1, 9, 10, 2500, 1e6, 1e30, NaN].map(magB)).toEqual([0, 0, 0, 0, 1, 3, 6, 18, 0]);
    expect([0, 1, 4, 5, 19, 20, 1000].map(cntB)).toEqual([0, 1, 3, 5, 10, 20, 100]);
    expect([0, 0.04, 0.26, 0.5, 0.96, 3, NaN].map(pctB)).toEqual([0, 0, 30, 50, 100, 100, 0]);
    expect([0.5, 1, 1.3, 1.7, 2.5, 99].map(xB)).toEqual([0, 1, 1.2, 1.5, 2, 10]);
  });
});

describe('kiracı hunisi', () => {
  it('aday → kart → istek → anahtar → bitti: her adım bir olay, ortak parametreler ve süre kovaları', () => {
    const x = ten();
    S.playMs = 10 * 60e3; Funnel.tenant('arrive', x);
    expect(last('tenant_arrive')).toEqual({ district: 'ist-0', city: 'ist', tier: 0, arch: 'ogrenci', wish: 'nb', wtype: 'kafe', late: 0, trait: 'sosyal', ch: 'ist.ogrenci', play_b: 'm0010' });
    Funnel.sheet({ k: 'kiraci', key: 'ist-0', i: 3 }); expect(count('tenant_open')).toBe(0); // tahtada böyle aday yok
    S.ten = [x];
    Funnel.sheet({ k: 'kiraci', key: 'ist-0', i: 3 }); Funnel.sheet({ k: 'kiraci', key: 'ist-0', i: 3 });
    expect(count('tenant_open')).toBe(1); expect(last('tenant_open')).toMatchObject({ arch: 'ogrenci', st: 'wait' });
    S.playMs = 13.5 * 60e3; x.st = 'ready'; Funnel.tenant('ready', x);
    expect(last('tenant_ready')).toMatchObject({ wish: 'nb', wait_b: 'm0003' });
    Funnel.sheet({ k: 'kiraci', key: 'ist-0', i: 3 }); expect(count('tenant_open')).toBe(2); // durum değişti: yeniden sayılır
    expect(last('tenant_open').st).toBe('ready');
    S.playMs = 14.6 * 60e3; x.st = 'live'; S.tdef = { ogrenci: { met: 1, ok: 1 } }; S.tdc = { 'ist.ogrenci': { met: 1, ok: 1 } };
    Funnel.tenant('settle', x);
    expect(last('tenant_settle')).toMatchObject({ arch: 'ogrenci', key_b: 'm0001', nth: 1, new_ch: 1, trait: 'sosyal' });
    Funnel.tenant('end', x); expect(last('tenant_end')).toMatchObject({ arch: 'ogrenci', city: 'ist' });
    expect(names()).toEqual(['tenant_arrive', 'tenant_open', 'tenant_ready', 'tenant_open', 'tenant_settle', 'ms_first_tenant', 'tenant_end']);
  });
  it('gidiş: bekleme süresi ve durum (wait = istek karşılanmadı, ready = anahtar verilmedi); geç oyun isteği late = 1', () => {
    const x = ten({ id: 9, w: { k: 'renov' } as any, c: undefined });
    S.playMs = 0; Funnel.tenant('arrive', x); S.playMs = 8 * 60e3; Funnel.tenant('leave', x);
    expect(last('tenant_arrive')).toMatchObject({ wish: 'renov', late: 1 });
    expect(last('tenant_arrive')).not.toHaveProperty('ch'); expect(last('tenant_arrive')).not.toHaveProperty('wtype');
    expect(last('tenant_leave')).toMatchObject({ st: 'wait', wait_b: 'm0005', late: 1 });
    Funnel.tenant('renov', x); expect(last('tenant_renov')).toMatchObject({ arch: 'ogrenci', wish: 'renov' });
    Funnel.tenant('leave', ten({ id: 10, st: 'ready' })); expect(last('tenant_leave').st).toBe('ready');
    expect(last('tenant_leave')).not.toHaveProperty('wait_b'); // bu oturumda gelişi görülmedi
  });
  it('ilk kiracı kilometre taşı bir kez; ikinci anahtarda yeni pul yok', () => {
    S.tdef = { ogrenci: { met: 2, ok: 2 } }; S.tdc = { 'ist.ogrenci': { met: 2, ok: 2 } };
    Funnel.tenant('settle', ten()); Funnel.tenant('settle', ten({ id: 8 }));
    expect(count('tenant_settle')).toBe(2); expect(count('ms_first_tenant')).toBe(1);
    expect(last('tenant_settle')).toMatchObject({ nth: 2, new_ch: 0 });
  });
  it('defter: oturumda bir kez, pul ve tanışma kovası', () => {
    S.tdc = { 'ist.ogrenci': { met: 1, ok: 1 }, 'ist.aile': { met: 2, ok: 0 } };
    Funnel.sheet({ k: 'defter' }); Funnel.sheet({ k: 'defter' });
    expect(count('defter_open')).toBe(1); expect(last('defter_open')).toMatchObject({ stamps: 1, met: 2 });
  });
});

describe('proje hunisi', () => {
  const q: Pj = { a: 6, kd: 'plaza', st: 1, until: 0, dur: 1 };
  it('teklif (semt başına bir kez) → seçim → kart → başlat → teslim → 2. etap → ayır', () => {
    S.cash = 5000;
    Funnel.project('offer', 'ist-1', { kind: 'plaza', n: 2 }); Funnel.project('offer', 'ist-1', { kind: 'plaza', n: 2 }); Funnel.project('offer', 'ist-0', { kind: 'site', n: 1 });
    expect(count('project_offer')).toBe(2);
    expect(log.ev[0].params).toEqual({ district: 'ist-1', city: 'ist', tier: 1, kind: 'plaza', n: 2, own_pj: 0, play_b: 'm0000' });
    Funnel.project('select', 'ist-1', { n: 2 }); expect(last('project_select')).toMatchObject({ district: 'ist-1', n: 2 });
    Funnel.project('card', 'ist-1', { kind: 'plaza', cost: 25000 }); expect(last('project_card')).toMatchObject({ kind: 'plaza', cost_e: 4, afford: 0 });
    S.cash = 1e6; Funnel.project('card', 'ist-1', { kind: 'plaza', cost: 25000 }); expect(last('project_card').afford).toBe(1);
    S.pj = { 'ist-1': [q] };
    Funnel.project('start', 'ist-1', { q }); expect(last('project_start')).toMatchObject({ kind: 'plaza', st: 1, own_pj: 1, tier: 1 });
    Funnel.project('done', 'ist-1', { q }); Funnel.project('stage2', 'ist-1', { q }); Funnel.project('split', 'ist-1', { q });
    Funnel.sheet({ k: 'proj', key: 'ist-1', i: 6 }); Funnel.sheet({ k: 'proj', key: 'ist-1', i: 6 });
    expect(count('project_open')).toBe(1); expect(last('project_open')).toMatchObject({ kind: 'plaza', st: 1 });
    expect(names().slice(2)).toEqual(['project_select', 'project_card', 'project_card', 'project_start', 'ms_first_project', 'project_done', 'project_stage2', 'project_split', 'project_open']);
    Funnel.project('start', 'ist-1', { q }); expect(count('ms_first_project')).toBe(1);
  });
});

describe('ihale hunisi', () => {
  it('açıldı → panel → vekâlet (ilk / yükseltme) → geçildi → sonuç → köşe başı', () => {
    const a = auc(); S.ihale.cur = a;
    Funnel.ihale('open', a, {}, T);
    expect(last('ihale_open')).toEqual({ kind: 'lm', rival: 'ist', city: 'ist', joined: 0, phase: 'early', open_e: 3, play_b: 'm0000' });
    Funnel.sheet({ k: 'ihale' }); Funnel.sheet({ k: 'ihale' }); expect(count('ihale_view')).toBe(1);
    a.my = 1500; Funnel.ihale('proxy', a, { lead: 'me' }, T);
    expect(last('ihale_proxy')).toMatchObject({ nth: 1, lead: 'me', joined: 1, my_x: 1.5 });
    Funnel.sheet({ k: 'ihale' }); expect(count('ihale_view')).toBe(2); // katılınca bir kez daha
    a.my = 2100; Funnel.ihale('proxy', a, { lead: 'rv' }, a.close - 3600e3);
    expect(last('ihale_proxy')).toMatchObject({ nth: 2, lead: 'rv', phase: 'late', my_x: 2 });
    Funnel.ihale('passed', a, {}, a.close - 3600e3); expect(last('ihale_passed')).toMatchObject({ kind: 'lm', phase: 'late' });
    a.done = 'won'; a.paid = 2000; Funnel.ihale('close', a, {}, a.close);
    expect(last('ihale_close')).toMatchObject({ result: 'won', joined: 1, paid_x: 2, phase: 'done' });
    S.ihale.kp = 1; Funnel.sheet({ k: 'kose' }); Funnel.sheet({ k: 'kose' }); expect(count('kose_open')).toBe(1); expect(last('kose_open').kp).toBe(1);
    Funnel.ihale('kose', null, { district: 'ist-1' }); expect(last('ihale_kose')).toEqual({ district: 'ist-1', city: 'ist', tier: 1, play_b: 'm0000' });
    expect(count('ms_first_auction')).toBe(1);
  });
  it('katılmadan kapanan ihale: joined = 0; ihale yokken panel: phase = none', () => {
    Funnel.ihale('close', auc({ done: 'lost' }), {}, T);
    expect(last('ihale_close')).toMatchObject({ result: 'lost', joined: 0 }); expect(last('ihale_close')).not.toHaveProperty('my_x');
    S.ihale.cur = null; Funnel.sheet({ k: 'ihale' }); expect(last('ihale_view')).toEqual({ phase: 'none', play_b: 'm0000' });
  });
});

describe('banka hunisi', () => {
  it('panel (oturumda bir kez), sekme, bilanço parası, aktarım (yön çifti, tutar ve hak kovaları), hata, emanet, bölge geçişi', () => {
    Funnel.boot({ bank: () => true }); log.ev.length = 0;
    Funnel.sheet({ k: 'banka' }); Funnel.sheet({ k: 'banka', tab: 'fx' });
    expect(count('bank_open')).toBe(1); expect(last('bank_open')).toEqual({ from: 'tr', tab: 'send', unlocked: 1, play_b: 'm0000' });
    Funnel.bankAct('tab', 'fx'); Funnel.bankAct('cur', 'USD'); Funnel.bankAct('pick', '0.5'); Funnel.bankAct('to', undefined);
    expect(last('bank_tab')).toMatchObject({ from: 'tr', tab: 'fx' }); expect(last('bank_cur')).toMatchObject({ cur: 'USD' });
    expect(names()).toEqual(['bank_open', 'bank_tab', 'bank_cur']);
    S.bank.log = [{ at: T, dir: 'out', r: 'us', a: 20000, b: 450, id: 'x' }];
    Funnel.bankSend('us', 20000, { ok: true, got: 450, held: true }, { cap: 2500, used: 450 }, 80000);
    expect(last('bank_transfer')).toEqual({ from: 'tr', to: 'us', amt_e: 4, got_e: 2, held: 1, cap_pct: 20, cash_pct: 30, nth: 1, play_b: 'm0000' });
    expect(count('ms_first_transfer')).toBe(1);
    Funnel.bankSend('us', 999, { ok: false, why: 'cap' }, { cap: 2500, used: 2500 }, 5000);
    expect(last('bank_fail')).toMatchObject({ to: 'us', why: 'cap', amt_e: 2 }); expect(count('ms_first_transfer')).toBe(1);
    Funnel.bank('claim', { amt_e: magB(2500) }); expect(last('bank_claim')).toMatchObject({ from: 'tr', amt_e: 3 });
    Funnel.bank('go', { to: 'us' }); expect(last('bank_go')).toMatchObject({ from: 'tr', to: 'us' });
  });
});

describe('bir-kez olaylar ve kayıt', () => {
  it('kilometre taşları: her biri bir kez, oyun süresi dakikasıyla; S.fn kayıtta korunur', () => {
    S.playMs = 4.5 * 60e3;
    for (const m of MS) { Funnel.ms(m); Funnel.ms(m); }
    expect(names()).toEqual(MS.map(m => 'ms_' + m));
    expect(last('ms_first_build')).toEqual({ play_min: 4, own: 1, play_b: 'm0003' });
    const back = migrate(JSON.parse(JSON.stringify(S)), T, WK)!;
    expect(back.fn).toBe(S.fn); expect(back.fn).toBe((1 << MS.length) - 1);
    setS(back); log.ev.length = 0; Funnel.reset();
    for (const m of MS) Funnel.ms(m);
    expect(log.ev.length).toBe(0);
  });
  it('sistem kilidi: açılınca bir kez; kapalıyken ve tekrar açılınca yok', () => {
    let open = false; S.playMs = 20 * 60e3;
    Funnel.boot({ tenant: () => open, bank: () => { throw new Error('x'); } });
    expect(count('sys_unlock')).toBe(0);
    open = true; Funnel.tick(); Funnel.tick(); Funnel.unlock('tenant', true);
    expect(count('sys_unlock')).toBe(1); expect(last('sys_unlock')).toEqual({ sys: 'tenant', play_min: 20, own: 1, play_b: 'm0020' });
    for (const s of SYS) { Funnel.unlock(s, false); Funnel.unlock(s, true); Funnel.unlock(s, true); }
    expect(count('sys_unlock')).toBe(SYS.length);
  });
  it('bozuk fn temizlenir; yeni oyunda 0', () => {
    expect(newState(T, WK, 'ist').fn).toBe(0);
    for (const [bad, want] of [['abc', 0], [-5, 0], [NaN, 0], [3.7, 3], [1e12, 0xFFFF], [null, 0]] as const) {
      const raw = JSON.parse(JSON.stringify(S)); raw.fn = bad;
      expect(migrate(raw, T, WK)!.fn, String(bad)).toBe(want);
    }
    S.fn = 0xFFFFF; Funnel.ms('first_build'); expect(S.fn).toBeLessThanOrEqual(0xFFFFF); // bit zaten dolu: olay yok
    expect(log.ev.length).toBe(0);
    const old = JSON.parse(JSON.stringify(S)); delete old.fn; expect(migrate(old, T, WK)!.fn).toBe(0); // eski kayıt
  });
  it('eski kayıt (fn yok, ilerleme var): yaşanmış olanlar olay göndermeden işaretlenir, yaşanmamışlar ilk kez gönderilir', () => {
    S.d['ist-0'][0] = { t: 'ev', lvl: 1, buf: 0, until: 0, dur: 1, up: false }; S.collects = 4; S.own = ['ist-0', 'ist-1'];
    S.tdef = { aile: { met: 3, ok: 1 } }; S.bank.log = [{ at: T, dir: 'in', r: 'us', a: 5, b: 0, id: 'y' }];
    seed();
    expect(log.ev.length).toBe(0);
    for (const m of ['first_build', 'first_collect', 'district_full', 'second_deed', 'first_tenant'] as const) Funnel.ms(m);
    Funnel.unlock('tenant', true); Funnel.unlock('bank', true);
    expect(log.ev.length).toBe(0);
    Funnel.ms('first_project'); Funnel.ms('first_auction'); Funnel.ms('first_transfer'); Funnel.unlock('project', true); Funnel.unlock('ihale', true);
    expect(names()).toEqual(['ms_first_project', 'ms_first_auction', 'ms_first_transfer', 'sys_unlock', 'sys_unlock']);
    expect(S.fn & ~FN_MASK).toBe(0);
  });
  it('yeni oyunda seed hiçbir şeyi işaretlemez', () => { seed(); expect(S.fn).toBe(0); });
  it('kullanıcı özellikleri açılışta ve yalnız değişince yazılır', () => {
    Funnel.boot({}); expect(log.props.length).toBe(1); expect(Object.keys(log.props[0]).sort()).toEqual([...USER_PROPS].sort());
    Funnel.tick(); expect(log.props.length).toBe(1);
    S.premium = true; Funnel.tick(); expect(log.props[1]).toEqual({ payer: 'premium' });
    Funnel.boot({});
  });
});

describe('hız sınırı ve dayanıklılık', () => {
  it('ad başına dakikada LIMIT.name; süre geçince yeniden; toplam ve oturum sınırı', () => {
    let ok = 0; for (let n = 0; n < 20; n++) if (send('bank_tab', { tab: 'fx' }, T + n)) ok++;
    expect(ok).toBe(LIMIT.name); expect(stats.dropped).toBe(20 - LIMIT.name);
    expect(send('bank_tab', {}, T + 59e3)).toBe(false); expect(send('bank_tab', {}, T + 61e3)).toBe(true);
    Funnel.reset(); ok = 0;
    for (let n = 0; n < 200; n++) if (send('ev_' + n, {}, T)) ok++;
    expect(ok).toBe(LIMIT.all);
    Funnel.reset(); ok = 0;
    for (let n = 0; n < 2000; n++) if (send('ev_' + (n % 500), {}, T + n * 10e3)) ok++;
    expect(ok).toBe(LIMIT.session);
  });
  it('analitik hata verse de çağrılar atmaz; bir-kez biti yine işaretlenir (oyun etkilenmez)', () => {
    log.boom = true;
    expect(() => { Funnel.tenant('arrive', ten()); Funnel.project('start', 'ist-0', {}); Funnel.ihale('open', auc()); Funnel.bank('open'); Funnel.ms('first_build'); Funnel.sheet({ k: 'banka' }); Funnel.tick(); }).not.toThrow();
    expect(() => { Funnel.tenant('settle', null as any); Funnel.sheet(null as any); Funnel.bankSend('us', 1, null as any, null as any, 0); Funnel.project('card', 'yok-9', { cost: NaN }); }).not.toThrow();
    expect(log.ev.length).toBe(0);
  });
  it('gönderilen her olay: bilinen ad, kurallara uygun parametreler, kişisel veri ve serbest metin yok', () => {
    const x = ten(), a = auc({ my: 1200 }), q: Pj = { a: 0, kd: 'site', st: 2, until: 0, dur: 1 };
    Funnel.boot({ tenant: () => true, project: () => true, ihale: () => true, bank: () => true }); // boş kayıtta: hiçbir bit işaretli değil
    S.ten = [x]; S.ihale.cur = a; S.pj = { 'ist-0': [q] };
    for (const st of ['arrive', 'open', 'ready', 'settle', 'leave', 'end', 'renov'] as const) Funnel.tenant(st, x);
    for (const st of ['offer', 'select', 'card', 'open', 'start', 'done', 'stage2', 'split'] as const) Funnel.project(st, 'ist-0', { q, n: 1, cost: 1e7 });
    for (const st of ['open', 'view', 'proxy', 'passed', 'close', 'kose_open', 'kose'] as const) Funnel.ihale(st, a, { lead: 'me', district: 'ist-0' }, T);
    for (const st of ['open', 'tab', 'transfer', 'fail', 'claim', 'cur', 'go'] as const) Funnel.bank(st, { to: 'us', tab: 'bil', cur: 'JPY', why: 'cap' });
    Funnel.sheet({ k: 'defter' }); for (const m of MS) Funnel.ms(m);
    expect(new Set(names())).toEqual(new Set(EVENTS)); // her olay adı en az bir kez üretildi, bilinmeyen ad yok
    const PII = /^(uid|user.*|e?mail|phone|.*name|device.*|ip|adid|idfa|token|lat|lon|lng|address|text|msg)$/;
    for (const e of log.ev) {
      const ks = Object.keys(e.params);
      expect(ks.length, e.name).toBeLessThanOrEqual(MAX_PARAMS);
      for (const k of ks) {
        const v = e.params[k];
        expect(NAME_RE.test(k), e.name + '.' + k).toBe(true); expect(PII.test(k), e.name + '.' + k).toBe(false);
        expect(['string', 'number'], e.name + '.' + k).toContain(typeof v);
        if (typeof v === 'string') { expect(v.length).toBeLessThanOrEqual(MAX_STR); expect(v, e.name + '.' + k).toMatch(/^[A-Za-z0-9_.:-]+$/); expect(v).not.toMatch(/Ece|Yılmaz/); }
        else expect(Number.isFinite(v)).toBe(true);
      }
      expect(e.params.play_b).toMatch(/^m\d{4}$/);
    }
    Funnel.boot({});
  });
});

describe('belge', () => {
  const doc = fs.readFileSync('docs/ANALYTICS.md', 'utf8') as string;
  it('docs/ANALYTICS.md koddaki her olayı ve kullanıcı özelliğini anlatır; belgede koda girmemiş huni olayı yok', () => {
    for (const n of EVENTS) expect(doc, n).toContain('`' + n + '`');
    for (const p of USER_PROPS) expect(doc, p).toContain('`' + p + '`');
    const rows = [...doc.matchAll(/\| `([a-z0-9_]+)` \| (yeni|eski) \|/g)];
    expect(rows.map(r => r[1]).sort()).toEqual([...EVENTS].sort());
    expect(rows.filter(r => r[2] === 'eski').map(r => r[1]).sort()).toEqual([...OLD_EVENTS].sort());
  });
  it('pano rehberindeki CFG anahtarları gerçek', () => {
    const guide = doc.slice(doc.indexOf('## Pano ve karar rehberi'), doc.indexOf('## Onam ve gizlilik'));
    const keys = new Set([...guide.matchAll(/`((?:TEN|PJ|IH|BANK)_[A-Z0-9_]+)`/g)].map(m => m[1]));
    expect(keys.size).toBeGreaterThan(20);
    for (const k of keys) expect(CFG, k).toHaveProperty(k);
  });
});
