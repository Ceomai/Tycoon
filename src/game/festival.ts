/* =========================================================
   MEVSİMLER — yalnızca görünüm (kışın kar, yazın plaj şemsiyeleri). Oyunda bayram ya da özel gün yok.
   ========================================================= */
export type Season = 'kis' | 'yaz' | '';
export function season(t: number): Season {
  const m = new Date(t).getMonth() + 1;
  return m === 12 || m <= 2 ? 'kis' : m >= 6 && m <= 8 ? 'yaz' : '';
}
