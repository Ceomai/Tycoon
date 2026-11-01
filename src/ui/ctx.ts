/* Arayüzün geçici durumu (kayda girmez) ve küçük DOM yardımcıları */
export const $ = (s: string): any => document.querySelector(s);
export const reduceMotion = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export interface SheetState { k: string; key?: string; i?: number; del?: boolean; conf?: boolean; reset?: boolean; req?: boolean; rows?: any[] | null; [x: string]: any; }

export const ui = {
  mq: [] as [string, (a: string) => void][],
  lastDay: '',
  sheet: null as SheetState | null,
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
  lastCloudSave: 0,
  /** Panel/kart açıldığı an: Android'de dokunuşun ardından gelen hayalet tıklamayı yok saymak için */
  openedAt: 0,
  /** Tapu teslim mührü: arsa → { bitiş zamanı, yazı } */
  teslim: {} as Record<number, { at: number; txt: string }>,
};
