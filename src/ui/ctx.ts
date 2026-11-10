/* Arayüzün geçici durumu (kayda girmez) ve küçük DOM yardımcıları */
export const $ = (s: string): any => document.querySelector(s);
/* Web geçmişi: panel/kart açıkken geçmişin en üstünde bizim bir kaydımız ({tapu:1}) durur; tarayıcının geri düğmesi
   (popstate) oyunun geri mantığını çalıştırır (main.ts). Arayüzden kapatınca kayıt history.back() ile geri alınır ve o
   popstate yalnızca yeniden eşitleme yapar (çift kapanma/döngü olmasın). Karar her zaman history.state'e bakılarak
   verilir; geri gitme sürerken yeni açılış olursa eşitleme popstate'e bırakılır. Telefonda geri tuşu doğrudan dinlenir. */
export const hist = { ignore: 0, enabled: false, t: 0 as any };
/** Bizim history.back()'imizin popstate'i geldi (ya da 3 sn içinde gelmedi). Bekleyen emniyet zamanlayıcısı iptal. */
export function histSettled() { hist.ignore = 0; clearTimeout(hist.t); hist.t = 0; }
const atOverlay = () => { try { return !!(history.state && history.state.tapu); } catch { return false; } };
export function syncHistory() {
  if (!hist.enabled || hist.ignore > 0) return;
  const open = !!(ui.sheet || ui.modal), at = atOverlay();
  try {
    if (open && !at) history.pushState({ tapu: 1 }, '');
    else if (!open && at) { hist.ignore = 1; clearTimeout(hist.t); hist.t = setTimeout(histSettled, 3000); history.back(); } // emniyet: popstate hiç gelmezse kilit açılır (yeniden geri yapılmaz)
  } catch { /* geçmiş kullanılamıyor */ }
}
export const reduceMotion = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export interface SheetState { k: string; key?: string; i?: number; del?: boolean; conf?: boolean; reset?: boolean; req?: boolean; rows?: any[] | null; [x: string]: any; }

export const ui = {
  mq: [] as [string, (a: string) => void][],
  lastDay: '',
  sheet: null as SheetState | null,
  /** iç içe paneller: geri tuşu bir öncekine döner (menü → mağaza → geri → menü) */
  sheetStack: [] as SheetState[],
  /** panel/kart açılmadan önce odaktaki öğe (kapanınca odak geri verilir) */
  sheetFocus: null as HTMLElement | null, modalFocus: null as HTMLElement | null,
  modal: false,
  ad: false,
  lastClose: 0,
  lastCollect: {} as Record<number, number>,
  combo: 0, comboT: 0,
  tiles: [] as HTMLElement[],
  tileSig: [] as string[],
  linkSig: '', sheetSig: '', rateHtml: '',
  lastNudge: 0, toastT: 0 as any,
  size: 60, sw: 60, sh: 60, gap: 14,
  lastInput: 0, idle: false,
  breakAt: 0, bootAt: performance.now(), // geçiş reklamı: son doğal durak, açılış anı
  lastCloudSave: 0,
  /** Panel/kart açıldığı an: Android'de dokunuşun ardından gelen hayalet tıklamayı yok saymak için */
  openedAt: 0,
  /** TOPLA sonrası kasa sayacı */
  cashAnim: null as null | { from: number; to: number; t0: number },
  /** Tapu teslim mührü: arsa → { bitiş zamanı, yazı } */
  teslim: {} as Record<number, { at: number; txt: string }>,
};
