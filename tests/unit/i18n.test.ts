// Yerelleştirme: sözlük bütünlüğü, yer tutucular, para/birim biçimleri, bölgeler.
import { describe, it, expect, afterEach } from 'vitest';
// @ts-ignore: düğüm türleri bu projede yüklü değil; yalnızca vitest (Node) altında çalışır
import fs from 'node:fs';
import { setLang, t, tc, nm, loc } from '../../src/i18n';
import { EN } from '../../src/locales/en';
import { DE } from '../../src/locales/de';
import { JA } from '../../src/locales/ja';
import { fmt } from '../../src/format';
import { setRegion, REGIONS, REGION_ORDER, CITIES, DRULES, CITY_ORDER } from '../../src/config';

const keys: string[] = JSON.parse(fs.readFileSync('scripts/i18n-keys.json', 'utf8')).keys;
const ph = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort().join(',');
const tags = (s: string) => (s.match(/<\/?[a-z]+/gi) || []).length;
afterEach(() => { setLang('tr'); setRegion('tr'); });

describe('sözlükler', () => {
  for (const [l, d] of [['en', EN], ['de', DE], ['ja', JA]] as const) {
    it(`${l}: tüm anahtarlar çevrili, yer tutucular ve etiketler uyumlu`, () => {
      const miss = keys.filter(k => !d.s[k]);
      expect(miss).toEqual([]);
      for (const k of keys) { expect(ph(d.s[k]), k).toBe(ph(k)); expect(tags(d.s[k]), k).toBe(tags(k)); }
    });
    it(`${l}: tüm şehir/semt adlarının yazımı tanımlı (Japonca) ya da özgün`, () => {
      setLang(l);
      for (const c of Object.values(CITIES)) for (const n of [c.n, ...c.districts.map(x => x.n)]) expect(nm(n).length).toBeGreaterThan(0);
      if (l === 'ja') expect(nm('Shibuya')).toBe('渋谷');
    });
  }
  it('Türkçede çeviri kaynak metnin kendisi', () => { setLang('tr'); expect(t('{n} semt', { n: 3 })).toBe('3 semt'); });
  it('eksik anahtar Türkçeye düşer', () => { setLang('en'); expect(t('olmayan anahtar')).toBe('olmayan anahtar'); });
  it('bağlamlı çeviri: tema "Açık" = Light, düz "Açık" = On olarak kalır', () => {
    expect(keys).toContain('tema|Açık');
    setLang('tr'); expect(tc('tema', 'Açık')).toBe('Açık'); expect(tc('tema', 'Koyu')).toBe('Koyu'); expect(tc('tema', 'Otomatik')).toBe('Otomatik');
    setLang('en'); expect([tc('tema', 'Otomatik'), tc('tema', 'Açık'), tc('tema', 'Koyu')]).toEqual(['Auto', 'Light', 'Dark']); expect(t('Açık')).toBe('On');
    setLang('de'); expect([tc('tema', 'Otomatik'), tc('tema', 'Açık'), tc('tema', 'Koyu')]).toEqual(['Automatisch', 'Hell', 'Dunkel']); expect(t('Açık')).toBe('An');
    setLang('ja'); expect([tc('tema', 'Otomatik'), tc('tema', 'Açık'), tc('tema', 'Koyu')]).toEqual(['自動', 'ライト', 'ダーク']); expect(t('Açık')).toBe('オン');
    setLang('en'); expect(tc('başka', 'Açık')).toBe('Açık'); // bağlamı olmayan anahtar kaynak metne düşer
  });
});

describe('biçimler', () => {
  it('para birimi bölgeden, kısaltma dilden', () => {
    setRegion('de'); setLang('de'); expect(fmt(1.5e6)).toBe('€1,5Mio');
    setRegion('us'); setLang('en'); expect(fmt(2500)).toBe('$2.5K');
    setRegion('jp'); setLang('ja'); expect(fmt(1.5e6)).toBe('¥150万'); expect(fmt(3e8)).toBe('¥3億');
    setRegion('tr'); setLang('tr'); expect(fmt(1.5e6)).toBe('₺1,5Mn');
  });
  it('dile göre yer eki', () => {
    setLang('tr'); expect(loc('Kadıköy')).toBe('Kadıköy’de');
    setLang('en'); expect(loc('Brooklyn')).toBe('in Brooklyn');
    setLang('ja'); expect(loc('渋谷')).toBe('渋谷で');
  });
});

describe('bölgeler', () => {
  it('5 ülke × 3 şehir + Global 5 şehir; her semtin kuralı var', () => {
    expect(REGION_ORDER.length).toBe(6);
    for (const r of REGION_ORDER) { const n = REGIONS[r].cities.length; expect(n).toBe(r === 'gl' ? 5 : 3); for (const c of REGIONS[r].cities) for (let i = 0; i < 5; i++) expect(DRULES[`${c}-${i}`], `${c}-${i}`).toBeTruthy(); }
  });
  it('setRegion şehir listesini yerinde değiştirir', () => {
    setRegion('jp'); expect(CITY_ORDER).toEqual(['tyo', 'osa', 'kyo']);
    setRegion('gl'); expect(CITY_ORDER).toEqual(['ist', 'nyc', 'lon', 'muc', 'tyo']);
  });
});
