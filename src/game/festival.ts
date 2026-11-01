/* =========================================================
   BAYRAMLAR VE MEVSİMLER — yalnızca tarihi her yıl aynı olan günler (bakım gerektirmez)
   Bayram günü: kiralar +%20, haritada bayrak zinciri, günde bir bayram ikramiyesi.
   Mevsim: kışın kar yağar, yazın Çeşme'deki boş arsalarda plaj şemsiyeleri.
   ========================================================= */
export interface Fest { n: string; k: 'milli' | 'yil'; }

const DAYS: { m: number; d: number; f: Fest }[] = [
  { m: 12, d: 31, f: { n: 'Yılbaşı', k: 'yil' } },
  { m: 1, d: 1, f: { n: 'Yılbaşı', k: 'yil' } },
  { m: 4, d: 23, f: { n: '23 Nisan Ulusal Egemenlik ve Çocuk Bayramı', k: 'milli' } },
  { m: 5, d: 19, f: { n: '19 Mayıs Atatürk’ü Anma, Gençlik ve Spor Bayramı', k: 'milli' } },
  { m: 8, d: 30, f: { n: '30 Ağustos Zafer Bayramı', k: 'milli' } },
  { m: 10, d: 29, f: { n: '29 Ekim Cumhuriyet Bayramı', k: 'milli' } },
];

/** Bugün bayram mı? (cihazın yerel tarihine göre) */
export function festivalOn(t: number): Fest | null {
  const d = new Date(t), m = d.getMonth() + 1, day = d.getDate();
  const x = DAYS.find(q => q.m === m && q.d === day);
  return x ? x.f : null;
}
/** Bayramın bitmesine kalan süre (gün sonu). */
export function festivalLeft(t: number): number {
  const d = new Date(t); const end = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
  return +end - t;
}
export type Season = 'kis' | 'yaz' | '';
export function season(t: number): Season {
  const m = new Date(t).getMonth() + 1;
  return m === 12 || m <= 2 ? 'kis' : m >= 6 && m <= 8 ? 'yaz' : '';
}
