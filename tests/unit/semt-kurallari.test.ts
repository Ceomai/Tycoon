// Semt kuralları: her bölgede şehre özgü ad/açıklama, oyun dengesi Türkiye şablonuyla birebir aynı.
import { describe, it, expect } from 'vitest';
import { DRULES, REGIONS, REGION_ORDER, CITIES, DRule } from '../../src/config';

const TR = ['ist', 'izm', 'ank'];
const bal = (r: DRule) => [r.kind, r.type ?? null, r.x];
/** Eski mantık: Türkiye dışı bölgelerde şehir, bölgedeki sırasına göre ist/izm/ank kuralının kopyasıydı. */
function oldTable() {
  const out: Record<string, unknown[]> = {};
  for (const [r, reg] of Object.entries(REGIONS)) {
    if (r === 'tr' || r === 'gl') continue;
    reg.cities.forEach((c, slot) => { for (let i = 0; i < 5; i++) out[`${c}-${i}`] = bal(DRULES[`${TR[slot % 3]}-${i}`]); });
  }
  return out;
}
const foreign = Object.keys(CITIES).filter(c => !TR.includes(c));

describe('semt kuralları', () => {
  it('denge değişmedi: 60 semtin kind/type/x değerleri eski şablon kopyasıyla aynı', () => {
    const old = oldTable();
    expect(Object.keys(old).length).toBe(60);
    const now = Object.fromEntries(Object.keys(old).map(k => [k, bal(DRULES[k])]));
    expect(now).toEqual(old);
  });
  it('açıklamadaki sayı ve etki şablonla aynı (yer adı dışında)', () => {
    const fx = (s: string) => s.replace(/^.*?(\(en alt sıra\))/, '$1'); // kıyı/cephe adı serbest, etki aynı
    for (const [r, reg] of Object.entries(REGIONS)) {
      if (r === 'tr' || r === 'gl') continue;
      reg.cities.forEach((c, slot) => { for (let i = 0; i < 5; i++) expect(fx(DRULES[`${c}-${i}`].t), `${c}-${i}`).toBe(fx(DRULES[`${TR[slot % 3]}-${i}`].t)); });
    }
  });
  it('tüm bölgelerde her semtin bir kuralı var (Global aynı kuralları kullanır)', () => {
    for (const r of REGION_ORDER) for (const c of REGIONS[r].cities) for (let i = 0; i < 5; i++) {
      const d = DRULES[`${c}-${i}`]; expect(d, `${r}:${c}-${i}`).toBeTruthy(); expect(d.n.length && d.t.length).toBeTruthy();
    }
    expect(Object.keys(DRULES).sort()).toEqual(Object.keys(CITIES).flatMap(c => [0, 1, 2, 3, 4].map(i => `${c}-${i}`)).sort());
  });
  it('Türkiye dışındaki hiçbir semt Türkiye semtlerinin yere özgü ad/açıklamasını taşımıyor', () => {
    const trN = new Set(TR.flatMap(c => [0, 1, 2, 3, 4].map(i => DRULES[`${c}-${i}`].n)));
    const trPlace = [...trN, 'Sahil sırası (en alt sıra) +%30', 'Bahçeli evler', 'Boğaz kıyısı', 'Ege kıyısı', 'Elçilikler semti', 'Kordon boyu', 'Kıyı şeridi'];
    const seen = new Set<string>();
    for (const c of foreign) for (let i = 0; i < 5; i++) {
      const r = DRULES[`${c}-${i}`];
      expect(trPlace, `${c}-${i}`).not.toContain(r.n);
      expect(trPlace, `${c}-${i}`).not.toContain(r.t);
      expect(r.n + r.t).not.toMatch(/Boğaz|Ege|Kordon|Bahçeli|Elçilik|Sahil/);
      expect(seen.has(r.n), `yinelenen ad: ${r.n}`).toBe(false); seen.add(r.n);
    }
    expect(seen.size).toBe(60);
  });
  it('Türkiye kuralları aynen duruyor', () => {
    expect(['ist-0', 'ist-4', 'izm-2', 'izm-4', 'ank-0', 'ank-2'].map(k => DRULES[k].n)).toEqual(['Bahçeli evler', 'Boğaz kıyısı', 'Kordon boyu', 'Ege kıyısı', 'Bahçeli evler', 'Elçilikler semti']);
    expect(DRULES['ist-4'].t).toBe('Sahil sırası (en alt sıra) +%30');
  });
});

describe('kılavuz bölgeye göre', () => {
  it('ABD bölgesinde kılavuz İstanbul/Beşiktaş/₺ göstermiyor; Türkiye metni aynen', async () => {
    const { setRegion } = await import('../../src/config');
    const { setLang } = await import('../../src/i18n');
    const { chapters } = await import('../../src/game/guide');
    const { setS, newState } = await import('../../src/state');
    setS(newState(Date.now(), 'x', 'ist'));
    const txt = () => chapters().map(c => c.body.join(' ') + c.art()).join(' ');
    try {
      setLang('tr'); setRegion('us');
      const us = txt();
      expect(us).toContain('Oyuna bir ilde başlarsın: New York, Los Angeles ya da Chicago.');
      expect(us).toContain('örneğin Brooklyn’da kafeler +%20, Tribeca’da nehir kıyısı +%30');
      expect(us).not.toMatch(/İstanbul|Beşiktaş|Bebek|₺/); // tarihi yapı listesi (Galata Kulesi…) tüm bölgelerde ortak içerik
      setLang('en'); expect(txt()).toContain('e.g. cafés +20% in Brooklyn, riverside row +30% in Tribeca');
      setLang('tr'); setRegion('tr');
      const tr = txt();
      expect(tr).toContain('Oyuna bir ilde başlarsın: İstanbul, İzmir ya da Ankara.');
      expect(tr).toContain('örneğin Beşiktaş’ta kafeler +%20, Bebek’te sahil sırası +%30');
    } finally { setLang('tr'); setRegion('tr'); }
  });
});
