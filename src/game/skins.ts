/* =========================================================
   CEPHE RENKLERİ — saf veri ve kilit kuralları (arayüz içe aktarmaz; game/fun.ts yeniden dışa aktarır).
   Kiracıların "cephe rengi" isteği (game/tenants.ts) ve simülasyon da kullanır.
   ========================================================= */
import { S } from '../state';
import { tk } from '../i18n';
import { stampsOf, ARCHS, countryDone, countryCities, Country } from './tenants';

export const SKIN_COLORS: { n: string; f: string; s: string; t: string; lock?: string }[] = [
  { n: tk('Krem'), f: '#efd8b3', s: '#d6b98f', t: '#e2cfae' },
  { n: tk('Gül kurusu'), f: '#e8c4b8', s: '#cfa597', t: '#dcb6a9' },
  { n: tk('Nane'), f: '#cfe0d2', s: '#b5ccb9', t: '#c3d8c7' },
  { n: tk('Buz mavisi'), f: '#d6dde8', s: '#b9c3d3', t: '#c9d2df' },
  { n: tk('Hardal'), f: '#efd27a', s: '#d5b45a', t: '#e4c56c', lock: tk('Arşivde 8 mühür') },
  { n: tk('Antrasit'), f: '#5a6270', s: '#454c58', t: '#505865', lock: tk('Arşivde 16 mühür') },
  { n: tk('Lavanta'), f: '#d9cfe8', s: '#bfb2d3', t: '#cdc2df', lock: tk('Sezon · 10. basamak') },
  { n: tk('Mercan'), f: '#f2b7a0', s: '#d99a83', t: '#e8a993', lock: tk('Sezon · 20. basamak') },
  { n: tk('Altın'), f: '#e9c46a', s: '#c9a24a', t: '#dcb65c', lock: tk('Altın Tapu · 15. basamak') },
  { n: tk('Tuğla kırmızısı'), f: '#d98b6c', s: '#bf6f52', t: '#cf7e60', lock: tk('Başlangıç paketi') },
  { n: tk('Kiracı yeşili'), f: '#a9c99a', s: '#8aae7b', t: '#9dbf8e', lock: tk('Kiracı defteri · 6 müdavim pulu') },
  // kiracı defteri · ülke cephe renkleri: ülkenin bölgedeki tüm şehir rozetleri (game/tenants.ts countryDone; yalnızca görünüm)
  { n: tk('Çini mavisi'), f: '#b9d3e3', s: '#9bb7ca', t: '#aac5d7', lock: tk('Kiracı defteri · Türkiye şehir rozetleri') },
  { n: tk('Kumtaşı'), f: '#c8a283', s: '#ab8467', t: '#ba9375', lock: tk('Kiracı defteri · ABD şehir rozetleri') },
  { n: tk('Sıra ev mavisi'), f: '#a3b8cf', s: '#869cb4', t: '#95aac2', lock: tk('Kiracı defteri · Birleşik Krallık şehir rozetleri') },
  { n: tk('Altbau sarısı'), f: '#efdca0', s: '#d5c080', t: '#e2ce90', lock: tk('Kiracı defteri · Almanya şehir rozetleri') },
  { n: tk('Sakura pembesi'), f: '#f2cfd6', s: '#d9b1ba', t: '#e6c0c8', lock: tk('Kiracı defteri · Japonya şehir rozetleri') },
];
/** Kiracı defterinin ödülü (yalnızca görünüm): 6 tipin hepsinde müdavim pulu. */
export const TENANT_SKIN = 10;
/** Ülke cephe renkleri (SKIN_COLORS sırası). */
export const COUNTRY_SKIN: Record<Country, number> = { tr: 11, us: 12, uk: 13, de: 14, jp: 15 };
const SKIN_COUNTRY = Object.fromEntries(Object.entries(COUNTRY_SKIN).map(([c, n]) => [n, c])) as Record<number, Country>;
/** Cephe rengi bu bölgede seçilebilir mi (ülke rengi yalnız o ülkenin şehri olan bölgede görünür; ör. Türkiye bölgesinde Çini mavisi, Global'de beşi). */
export const skinShown = (c: number) => !SKIN_COUNTRY[c] || countryCities(SKIN_COUNTRY[c]).length > 0;
export function skinUnlocked(c: number) {
  if (c < 4) return true;
  if (c === 4) return S.ach.length >= 8;
  if (c === 5) return S.ach.length >= 16;
  if (c === TENANT_SKIN) return stampsOf() >= ARCHS.length;
  if (SKIN_COUNTRY[c]) return countryDone(SKIN_COUNTRY[c]);
  return S.skinsU.includes(c);
}
