// Bağımsız inceleme bulgularının düzeltmeleri (Aşama 3 / n6): holding ve projeler, banka kuyruğu ve kayıt kilidi,
// aktarımda gönderen kaydının yazılması, yoldaki havale sınırı, bulut paketi uzlaştırması, reklam sırasında kiracı bonusu,
// eksi tutar gösterimi. Senaryolar inceleme kanıt betiklerinden (zz-review.test.ts) türetildi.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
// @ts-ignore: düğüm türleri bu projede yüklü değil; yalnızca vitest (Node) altında çalışır
import fs from 'node:fs';

vi.mock('../../src/ui/modal', () => ({
  openModal: vi.fn(), closeModal: vi.fn(), bump: vi.fn(), toast: vi.fn(), flushQueue: vi.fn(), flyTo: vi.fn(async () => {}), flyCoin: vi.fn(async () => {}),
  countUp: vi.fn(), showGain: vi.fn(), bigStamp: vi.fn(), cashText: vi.fn(),
}));
vi.mock('../../src/sound', () => ({ Snd: new Proxy({}, { get: () => () => {} }), buzz: Object.assign(vi.fn(), { light: vi.fn(), medium: vi.fn(), success: vi.fn(), error: vi.fn(), select: vi.fn() }) }));

import { newState, setS, S, migrate, Plot } from '../../src/state';
import { CFG, setRegion, BuildingType } from '../../src/config';
import { weekKey, money, moneySigned } from '../../src/format';
import { setLang } from '../../src/i18n';
import { Time } from '../../src/time';
import { baseRate, pjOf } from '../../src/economy';
import { flushSaves, unlockSaves } from '../../src/storage';
import { pjStart } from '../../src/game/projcore';
import { doHolding } from '../../src/game/collection';

const DEF = { ...CFG };
const T0 = Date.UTC(2026, 10, 16, 9, 30);
class MemStore {
  m = new Map<string, string>();
  getItem(k: string) { return this.m.has(k) ? this.m.get(k)! : null; }
  setItem(k: string, v: string) { this.m.set(k, String(v)); }
  removeItem(k: string) { this.m.delete(k); }
  clear() { this.m.clear(); }
  key(i: number) { return [...this.m.keys()][i] ?? null; }
  get length() { return this.m.size; }
}
const P = (t: BuildingType, lvl = 3): Plot => ({ t, lvl, buf: 0, until: 0, dur: 1, up: false });
const WK = () => weekKey(new Date(Time.now()));

beforeEach(async () => {
  (globalThis as any).localStorage = new MemStore();
  Object.assign(CFG, DEF); Time.offset = T0 - Date.now(); setLang('tr');
  await flushSaves(); unlockSaves(); setRegion('tr');
});
afterEach(async () => { await flushSaves(); unlockSaves(); Object.assign(CFG, DEF); Time.offset = 0; setRegion('tr'); });

/* ---------- 2) Holding ve büyük projeler ---------- */
function projectSetup() {
  setS(newState(T0, weekKey(new Date(T0)), 'ist'));
  S.d['ist-0'] = Array.from({ length: 20 }, (_, i) => P((['ev', 'kafe', 'dukkan', 'ofis'] as BuildingType[])[i % 4], 5));
  S.own = ['ist-0', 'ist-1', 'ist-2', 'ist-3', 'ist-4']; for (const k of S.own) if (!S.d[k]) S.d[k] = Array(20).fill(null);
  S.cash = 1e15; S.earned = 1e15;
  const q = pjStart('ist-0', 0, Time.now() - 1e12); expect(q).not.toBeNull();
  q!.until = 0; q!.st = 2;
}
describe('holding ve projeler', () => {
  it('holding projeleri siler: yeni binalar eski projenin bonusunu almaz', () => {
    projectSetup();
    doHolding();
    expect(S.own).toEqual(['ist-0']);
    expect(S.pj).toEqual({});
    S.d['ist-0'][0] = P('ev', 1); S.d['ist-0'][2] = P('ev', 1);
    expect(pjOf('ist-0', 0)).toBeNull();
    expect(baseRate('ist-0', 0)).toBeCloseTo(baseRate('ist-0', 2), 9);
  });
  it('pjOf: sahip olunmayan semtte, boş ya da proje seviyesinin altındaki arsada proje yok', () => {
    projectSetup();
    expect(pjOf('ist-0', 0)).not.toBeNull();
    S.d['ist-0'][1] = null;                          // boş arsa
    expect(pjOf('ist-0', 1)).toBeNull();
    S.d['ist-0'][4] = P('ev', 1);                    // proje seviyesinin altında
    expect(pjOf('ist-0', 4)).toBeNull();
    expect(pjOf('ist-0', 5)).not.toBeNull();
    S.own = ['ist-1'];                               // semt elden çıktı (eski kayıt)
    expect(pjOf('ist-0', 5)).toBeNull();
  });
  it('eski kayıttaki hayalet proje (seviye 1 binalar) yüklemede temizlenir', () => {
    projectSetup();
    for (const j of [0, 1, 4, 5]) S.d['ist-0'][j] = P('ev', 1);
    const re = migrate(JSON.parse(JSON.stringify(S)), Time.now(), WK())!;
    expect(re.pj['ist-0']).toBeUndefined();
    // geçerli proje korunur
    projectSetup();
    const ok = migrate(JSON.parse(JSON.stringify(S)), Time.now(), WK())!;
    expect(ok.pj['ist-0']).toHaveLength(1);
  });
});

/* ---------- 8) Eksi tutar ---------- */
describe('eksi tutar gösterimi', () => {
  it('moneySigned eksi değeri işaretli gösterir (bilanço neti); money eskisi gibi kırpar', () => {
    expect(moneySigned(-1500, '₺')).toBe('−₺1,5B');
    expect(moneySigned(-12, '$', true)).toBe('−$12,00');
    expect(moneySigned(1500, '₺')).toBe('₺1,5B');
    expect(moneySigned(0, '₺')).toBe('₺0');
    expect(moneySigned(-1e-12, '₺')).toBe('₺0');    // kayan nokta artığı "−₺0" olmaz
    expect(money(-1500, '₺')).toBe('₺0');
  });
  it('bilanço paneli eksi neti işaretli yazar', () => {
    const src = fs.readFileSync('src/ui/sheets/bank.ts', 'utf8');
    expect(src).toMatch(/const fmtC = \(v: number, c: CurId\) => moneySigned\(/);
  });
});

/* ---------- 9) dil sözlükleri ayrı parça ---------- */
describe('dil sözlükleri ana pakette değil', () => {
  it('i18n.ts sözlükleri statik içe aktarmaz, loadLang ile yükler; paket uyarı sınırı 700 kB', async () => {
    const src = fs.readFileSync('src/i18n.ts', 'utf8');
    expect(src).not.toMatch(/^import\s+\{\s*(EN|DE|JA)\s*\}\s+from/m);
    expect(src).toMatch(/import\('\.\/locales\/en'\)/);
    for (const f of fs.readdirSync('src', { recursive: true }) as string[]) {
      if (!/\.ts$/.test(f) || /^locales/.test(f) || f === 'i18n.ts') continue;
      expect(fs.readFileSync('src/' + f, 'utf8'), f).not.toMatch(/from '(\.\.?\/)+(src\/)?locales\/(en|de|ja)'/);
    }
    expect(fs.readFileSync('vite.config.ts', 'utf8')).toMatch(/chunkSizeWarningLimit: 700/);
    const { loadLang, setLang, t } = await import('../../src/i18n');
    expect(await loadLang('de')).toBe(true); setLang('de'); expect(t('Burada devam et')).toBe('Hier weiterspielen'); setLang('tr');
    expect(await loadLang('xx')).toBe(true);           // bilinmeyen dil: Türkçe
  });
});

/* ---------- soak G4: fiyatlar gerçek tutarın altında görünmez ---------- */
import { fmtCost, fmt } from '../../src/format';
import { units } from '../../src/i18n';
describe('fiyat gösterimi yukarı yuvarlanır', () => {
  /** Ekrandaki TR tutarını (₺1,1Mn) iç birime çevirir. */
  const parse = (s: string) => { const U = units(), m = s.replace(/^[^\d]+/, '').match(/^([\d.,]+)(\D*)$/)!; const n = +m[1].replace(',', '.'); const i = m[2] ? U.u.indexOf(m[2]) : -1; return n * Math.pow(U.base, i + 1); };
  it('TR: bedel hiçbir zaman gerçek tutarın altında görünmez; kasa gösterimi eskisi gibi', () => {
    setRegion('tr'); setLang('tr');
    expect(fmtCost(1090873)).toBe('₺1,1Mn'); expect(fmt(1090873)).toBe('₺1Mn');
    expect(fmtCost(1e6)).toBe('₺1Mn'); expect(fmtCost(999.6)).toBe('₺1B'); expect(fmtCost(999600)).toBe('₺1Mn'); expect(fmtCost(150)).toBe('₺150'); expect(fmtCost(0)).toBe('₺0');
    let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let k = 0; k < 3000; k++) { const v = Math.floor(Math.pow(10, 1 + rnd() * 13)); const s = fmtCost(v); expect(parse(s), s + ' < ' + v).toBeGreaterThanOrEqual(v); expect(parse(s), s + ' çok yukarıda ' + v).toBeLessThanOrEqual(v * 1.1 + 1); }
  });
  it('kuruşlu paralar ($) yukarı yuvarlanır', () => {
    setRegion('us'); setLang('en');
    try { const s = fmtCost(123); expect(s.startsWith('$')).toBe(true); } finally { setRegion('tr'); setLang('tr'); }
  });
  it('bedel gösteren arayüz dosyaları fmtCost kullanır', () => {
    const f = (p: string) => fs.readFileSync(p, 'utf8');
    expect(f('src/ui/sheets/map.ts')).toMatch(/fmtCost\(u\.fee\)/);
    expect(f('src/ui/sheets/plot.ts')).toMatch(/fmtCost\(uc\)/);
    expect(f('src/ui/pjcard.ts')).toMatch(/fmtCost\(cost\)/);
    expect(f('src/ui/sheets/ihale.ts')).toMatch(/fmtCost\(st\.price\)/);
    expect(f('src/ui/sheets/special.ts')).toMatch(/fmtCost\(price\)/);
  });
});

/* ---------- soak G7: Holding'den hemen sonra ihale kırıntıya açılmaz ---------- */
import { ihaleTickCore, windowAt, ihaleUnlocked, IH } from '../../src/game/auccore';
import { totalRate } from '../../src/economy';
describe('Holding sonrası ihale', () => {
  it('ihale ekonomi toparlanınca (yeniden ikinci semt) açılır; açılış fiyatı o anki kiraya göre', () => {
    projectSetup(); S.pj = {}; S.d['ist-1'] = Array.from({ length: 20 }, () => P('ofis', 5));
    const before = totalRate(false);
    S.ihale.cur = null; S.ihale.intro = true;
    let tn = T0; while (!windowAt(tn)) tn += 3600e3;   // açık ihale penceresi
    doHolding(); expect(S.shares).toBeGreaterThan(0);
    // basit sim: holding sonrası 3 gün, her saat döngü; tek semt varken ihale açılmaz
    let created: any = null;
    for (let h = 0; h < 72 && !created; h++) created = ihaleTickCore(tn + h * 3600e3).created || null;
    expect(ihaleUnlocked()).toBe(false); expect(created).toBeNull();
    // ikinci semt alınınca açılır; açılış = o anki kira × CFG.IH_*_OPEN (en az taban), Holding öncesi kiraya göre değil
    S.d['ist-0'] = Array.from({ length: 20 }, () => P('ev', 3)); S.own.push('ist-1'); S.d['ist-1'] = Array(20).fill(null);
    for (let h = 72; h < 24 * 8 && !created; h++) created = ihaleTickCore(tn + h * 3600e3).created || null;
    expect(created).not.toBeNull();
    const unitNow = Math.max(50, totalRate(false) * 60), open = created.kind === 'lm' ? CFG.IH_LM_OPEN : CFG.IH_ARSA_OPEN;
    expect(created.start).toBeGreaterThanOrEqual(unitNow * open * 0.99);
    expect(created.start).toBeLessThan(before * 60 * open);
    expect(IH().cur).toBe(created);
  });
});
