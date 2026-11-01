/* =========================================================
   KİRA DEĞİŞTİRİCİLERİ (saf hesap, arayüzsüz) — haftalık piyasa, belediye kararları, arşiv bonusu
   economy.ts bunları kullanır; arayüz tarafı game/fun.ts'te.
   ========================================================= */
import { ORDER, BuildingType, DistrictKey } from '../config';
import { S } from '../state';

/* ---------- 2 · haftalık piyasa raporu (herkes için aynı; hafta numarasına göre) ---------- */
export const MARKET_UP = 0.3, MARKET_DOWN = 0.1;
const HEAD: Record<BuildingType, [string, string]> = {
  ofis: ['Ofis talebi patladı', 'Şirketler yeni merkez arıyor; plazalar dolup taşıyor.'],
  kafe: ['Kahve çılgınlığı', 'Herkes yeni açılan kahvecilerin peşinde.'],
  dukkan: ['Alışveriş sezonu', 'Vitrinler dolu, kasalar şakır şakır.'],
  ev: ['Konut talebi rekorda', 'Kiralık ev bulmak hiç bu kadar zor olmamıştı.'],
};
export function marketOf(week: string) {
  const n = parseInt(String(week || '').split('H')[1] || '0', 10) || 0;
  const up = ORDER[n % 4], down = ORDER[(n + 2) % 4];
  return { up, down, head: HEAD[up][0], why: HEAD[up][1], n };
}
export function marketMult(t: BuildingType, week: string): number {
  const m = marketOf(week);
  return t === m.up ? 1 + MARKET_UP : t === m.down ? 1 - MARKET_DOWN : 1;
}

/* ---------- 5 · belediye kararları (semt başına en fazla 2, kalıcı) ---------- */
export interface CivicOpt { id: string; n: string; t: BuildingType; d: string; }
export const CIVIC_X = 0.15;
export const CIVIC: { id: string; title: string; q: string; a: CivicOpt; b: CivicOpt }[] = [
  { id: 'arsa', title: 'Boş belediye arsası', q: 'Belediye semtine bir yatırım yapacak ve senin fikrini soruyor.',
    a: { id: 'park', n: 'Park', t: 'ev', d: 'Çocuklar, ağaçlar, huzur' }, b: { id: 'otopark', n: 'Otopark', t: 'dukkan', d: 'Müşteri kolay gelir' } },
  { id: 'ulasim', title: 'Ulaşım yatırımı', q: 'Semte hangi ulaşım yatırımı yapılsın?',
    a: { id: 'metro', n: 'Metro durağı', t: 'ofis', d: 'Çalışanlar dakikasında işte' }, b: { id: 'bisiklet', n: 'Bisiklet yolu', t: 'kafe', d: 'Yol boyu kahve molası' } },
];
const OPT: Record<string, CivicOpt> = Object.fromEntries(CIVIC.flatMap(c => [[c.a.id, c.a], [c.b.id, c.b]]));
export const civicOpt = (id: string) => OPT[id];
export function civicMult(k: DistrictKey, t: BuildingType): number {
  const list = (S.civic && S.civic[k]) || [];
  return 1 + list.reduce((m, id) => (OPT[id] && OPT[id].t === t ? m + CIVIC_X : m), 0);
}

/* ---------- 4 · tapu arşivi bonusu: her 4 mühür +%1 ---------- */
export const achBonus = () => Math.floor(((S.ach && S.ach.length) || 0) / 4) * 0.01;
