/* Ödül kartlarının ortak seçimi (günlük ödül, etkinlik, süreli fırsat, lig ikramiyesi). */
import { Ads } from '../services/ads';

/** Kartta "İzle, … katını al" seçildiyse (ad) ödüllü reklam açılır: izlenirse `mx` kat verilir; reklam gösterilemez ya da
 *  ödülsüz kapanırsa 1 kat (yokken kazanç kaybolmasın). Diğer seçim doğrudan 1 kat. `give(m)` ödülü m katıyla verir. */
export function rewardChoice(ad: boolean, kind: string, label: string, give: (m: number) => void, mx = 2) {
  if (ad) Ads.rewarded(kind, label, () => give(mx), () => give(1));
  else give(1);
}
