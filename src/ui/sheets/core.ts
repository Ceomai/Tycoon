/* ALT PANEL ÇEKİRDEĞİ — açma/kapama, geri yığını, odak, panel içi geçiş, imza (sig) ile yeniden çizim, canlı alanlar ve
   eylem yönlendirme. Panellerin kendisi sheets/ altındaki modüllerde; kayıt tablosu sheets.ts'te doldurulur. */
import { S } from '../../state';
import { now } from '../../economy';
import { I, small } from '../../icons';
import { Snd } from '../../sound';
import { t } from '../../i18n';
import { $, ui, view, SheetState, syncHistory, reduceMotion } from '../ctx';
import { play, fadeIn, DUR, EASE } from '../motion';
import { Purchases, type ProductKey } from '../../services/purchases';

/** Panel eylemi sonucu: STAY = eylem paneli kendisi yönetti (ör. başka panel açtı, kapattı); panel yeniden çizilmez.
 *  Başka her dönüş (undefined) eylemden sonra panelin yeniden çizilmesini ister. */
export const STAY = true;
export type ActionResult = typeof STAY | void;
/** Bir panel: sig görünümü değiştiren ayrık değerlerden imza üretir (c: sig ile render arasında paylaşılan ara değerler);
 *  render yalnızca imza değişince çağrılır ve HTML döner (undefined: çizilecek bir şey yok). live: her çizimde yerinde
 *  güncellenen kısımlar. action: panel içindeki data-a düğmeleri. */
export interface Panel<C = any> {
  sig(s: SheetState, tn: number, c: C): string;
  render(s: SheetState, tn: number, c: C): string | undefined;
  live?(s: SheetState, tn: number): void;
  action?(a: string, btn: HTMLElement, s: SheetState): ActionResult | Promise<ActionResult>;
}
/** Kayıt tablosu (sheets.ts doldurur). */
export const PANELS: Partial<Record<SheetState['k'], Panel>> = {};

/** Panel açar. Açık bir panelden başka panele geçilirse önceki panel geri yığınına girer (geri tuşu oraya döner);
 *  yığında zaten olan bir panele geçmek (ör. "Mülke dön", "Kılavuz") yığını o noktaya kadar geri sarar. */
export function openSheet(s: SheetState, fromBack = false) {
  const prev = ui.sheet, wasOpen = !!prev; let dir = fromBack ? -1 : 1;
  if (!fromBack) {
    if (!prev) ui.sheetStack = [];
    else if (prev !== s) { const j = ui.sheetStack.findIndex(x => x.k === s.k); if (j >= 0) { ui.sheetStack.length = j; dir = -1; } else if (prev.k !== s.k) ui.sheetStack.push(prev); }
  }
  ui.openedAt = performance.now(); ui.sheet = s; ui.sheetSig = ''; renderSheet();
  if (wasOpen && prev !== s) slideBody(dir); // açık panelde içerik değişimi: yönüne göre kısa kayma + belirme
  const el = $('#sheet') as HTMLElement; el.inert = false; el.removeAttribute('aria-hidden'); el.classList.add('on'); $('#scrim').classList.add('on'); Snd.tap();
  if (wasOpen) el.scrollTop = 0;
  if (!wasOpen) { ui.sheetFocus = document.activeElement as HTMLElement | null; el.focus({ preventScroll: true }); }
  syncHistory();
}
export function closeSheet() {
  if (!ui.sheet) return; ui.sheet = null; ui.sheetStack = []; ui.lastClose = ui.breakAt = performance.now(); const el = $('#sheet') as HTMLElement; el.classList.remove('on'); if (!ui.modal) $('#scrim').classList.remove('on');
  const f = ui.sheetFocus; ui.sheetFocus = null; if (!ui.modal && f && f.isConnected && document.activeElement && (document.activeElement as HTMLElement).closest?.('#sheet')) f.focus({ preventScroll: true });
  el.inert = true; el.setAttribute('aria-hidden', 'true'); // kapalı panel (ekran dışı) odak/ekran okuyucuya kapalı
  syncHistory();
}
view.openSheet = openSheet; view.closeSheet = closeSheet;
/** Panel içi geçiş (~180 ms): ileri giderken yeni içerik sağdan, geri dönerken soldan kayarak belirir. Yalnız #sheetBody
 *  hareket eder; panelin kendisi (sürükle-kapat, sheetdrag.ts) etkilenmez. Hareketi azalt: yalnız kısa opaklık. */
export function slideBody(dir: number) {
  const b = $('#sheetBody') as HTMLElement;
  if (reduceMotion) { fadeIn(b, 'nav', 120); return; }
  play(b, 'nav', [{ transform: `translateX(${dir * 28}px)`, opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: DUR.out, easing: EASE.out });
}
/** Geri (Android geri tuşu, tarayıcı geri, Esc): iç içe panelde bir önceki panele döner, yoksa paneli kapatır. */
export function sheetBack() { const prev = ui.sheetStack.pop(); if (prev && ui.sheet) openSheet(prev, true); else closeSheet(); }

/* ---------- paneller arası küçük yardımcılar ---------- */
/** Telefonda mağaza fiyatı yüklenmemiş ürünün düğmesi kapalı. */
export const off = (k: ProductKey) => (Purchases.can(k) ? '' : ' disabled');
export const lvBar = (l: number) => `<div class="lv">${[1, 2, 3, 4, 5].map(k => `<i class="${k <= l ? 'on' : ''}"></i>`).join('')}</div>`;
export const discBox = () => S.disc ? `<div class="disc">${small(I.tag, 16)} ${t('%{n} müteahhit indirimi', { n: Math.round(S.disc * 100) })}</div>` : '';
/** "Emin misin?" onayı 3 sn sonra düşer (panel hâlâ açıksa yeniden çizilir). */
export const later = (s: SheetState, key: 'del' | 'conf' | 'reset') => setTimeout(() => { if (ui.sheet === s) { s[key] = false; ui.sheetSig = ''; } }, 3000);

/* Canlı alanlar: her karede değişen sayılar (kasa, borç, haftalık kazanç, görev ilerlemesi, geri sayım) paneli
   yeniden çizmeden yalnızca bu öğelerde güncellenir. Panel imzasına (sig) yalnızca görünümü değiştiren ayrık değerler girer;
   böylece otomatik toplamada da panel 4 Hz yeniden yazılmaz ve dokunuşlar kaybolmaz. */
const LIVE: Record<string, () => string> = {};
/** Metni canlı güncellenen span (yalnızca düz metin). */
export const lv = (id: string, f: () => string) => { LIVE[id] = f; return `<span data-lv="${id}">${f()}</span>`; };
/** Genişliği (yüzde) canlı güncellenen öğe için öznitelikler. */
export const lw = (id: string, f: () => number) => { LIVE[id] = () => f() + '%'; return `data-lw="${id}" style="width:${f()}%"`; };
function updateLive() {
  const body = $('#sheetBody') as HTMLElement | null; if (!body) return;
  body.querySelectorAll<HTMLElement>('[data-lv]').forEach(el => { const f = LIVE[el.dataset.lv!]; if (f) { const v = f(); if (el.textContent !== v) el.textContent = v; } });
  body.querySelectorAll<HTMLElement>('[data-lw]').forEach(el => { const f = LIVE[el.dataset.lw!]; if (f) { const v = f(); if (el.style.width !== v) el.style.width = v; } });
}

/** Açık paneli çizer: imza değiştiyse içerik yeniden yazılır; her çağrıda canlı alanlar güncellenir. */
export function renderSheet() {
  const s = ui.sheet; if (!s) return;
  const tn = now(), pn = PANELS[s.k]; let sig = '', html: string | undefined;
  if (pn) { const c = {}; sig = pn.sig(s, tn, c); if (sig !== ui.sheetSig) html = pn.render(s, tn, c); }
  if (html !== undefined) { ui.sheetSig = sig; $('#sheetBody').innerHTML = html; }
  updateLive();
  if (pn && pn.live) pn.live(s, tn);
}

/** Panel düğmesi (data-a). "close" her panelde paneli kapatır; gerisi panelin kendi eylemine gider. Eylem STAY dönmezse
 *  panel yeniden çizilir (açıksa). */
export async function onSheetAction(a: string, btn: HTMLElement) {
  const s = ui.sheet; if (!s) return;
  if (a === 'close') return closeSheet();
  const pn = PANELS[s.k];
  let r = pn && pn.action ? pn.action(a, btn, s) : undefined;
  if (r instanceof Promise) r = await r; // yalnız gerçekten bekleyen eylemde ertelenir; diğerlerinde yeniden çizim aynı anda
  if (r === STAY) return;
  ui.sheetSig = ''; if (ui.sheet) renderSheet();
}
