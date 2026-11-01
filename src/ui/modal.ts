/* Kartlar (tebligat), sıra kuyruğu, bildirim şeridi ve para uçuşu efekti */
import { $, ui, reduceMotion } from './ctx';
import { S } from '../state';
import { Snd } from '../sound';
import { closeSheet } from './sheets';

let modalHandler: ((a: string) => void) | null = null;

export function openModal(html: string, handler: (a: string) => void) {
  if (ui.modal || ui.ad) { ui.mq.push([html, handler]); return; }
  closeSheet(); ui.modal = true; modalHandler = handler; ui.openedAt = performance.now();
  const m = $('#modal'); m.innerHTML = html; m.hidden = false; $('#scrim').classList.add('on'); Snd.unlock();
}
export function closeModal() {
  S.nextAd = Math.max(S.nextAd, S.playMs + 60e3);
  ui.modal = false; modalHandler = null; $('#modal').hidden = true; $('#modal').innerHTML = ''; $('#scrim').classList.remove('on');
  ui.lastClose = performance.now(); flushQueue();
}
export function flushQueue() {
  if (ui.mq.length && !ui.modal && !ui.ad) setTimeout(() => { if (ui.mq.length && !ui.modal && !ui.ad) openModal(...ui.mq.shift()!); }, 350);
}
/** Açılıştan hemen sonraki tıklama, kartı açan dokunuşun devamıdır (Android hayalet tıklama). */
export const justOpened = () => performance.now() - ui.openedAt < 350;
export function onModalClick(e: Event) {
  if (justOpened()) return;
  const b = (e.target as HTMLElement).closest('[data-a]') as HTMLElement | null;
  if (b && modalHandler) modalHandler(b.dataset.a!);
}

export function bump() {
  const c = $('#cash'); c.classList.remove('bump'); void c.offsetWidth; c.classList.add('bump');
  clearTimeout((bump as any).t); (bump as any).t = setTimeout(() => c.classList.remove('bump'), 140);
}
export function toast(msg: string) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('on');
  clearTimeout(ui.toastT); ui.toastT = setTimeout(() => t.classList.remove('on'), 2200);
}
export function flyCoin(fromEl: Element) {
  if (reduceMotion || !(fromEl as any).animate) { bump(); return; }
  const r = fromEl.getBoundingClientRect(), to = $('#cash').getBoundingClientRect();
  const c = document.createElement('div'); c.className = 'fly';
  c.style.left = (r.left + r.width / 2 - 11) + 'px'; c.style.top = (r.top + r.height / 2 - 11) + 'px';
  document.body.appendChild(c);
  const dx = to.left + to.width / 2 - (r.left + r.width / 2), dy = to.top + to.height / 2 - (r.top + r.height / 2);
  c.animate([{ transform: 'translate(0,0) scale(1)' }, { transform: `translate(${dx * .25}px,${dy * .15 - 36}px) scale(1.15)`, offset: .3 }, { transform: `translate(${dx}px,${dy}px) scale(.5)`, opacity: .7 }],
    { duration: 620, easing: 'cubic-bezier(.45,0,.7,1)' }).onfinish = () => { c.remove(); bump(); };
}

/** TOPLA anı: binalardan bir hedefe para uçar (iz çizgisi yok). */
export function flyTo(fromEl: Element, toEl: Element, delay = 0) {
  if (reduceMotion || !(fromEl as any).animate) return;
  const r = fromEl.getBoundingClientRect(), to = toEl.getBoundingClientRect();
  const c = document.createElement('div'); c.className = 'fly';
  c.style.left = (r.left + r.width / 2 - 11) + 'px'; c.style.top = (r.top + r.height * .35 - 11) + 'px';
  document.body.appendChild(c);
  const dx = to.left + to.width / 2 - (r.left + r.width / 2), dy = to.top + to.height / 2 - (r.top + r.height * .35);
  c.animate([{ transform: 'translate(0,0) scale(.6)', opacity: 0 }, { transform: 'translate(0,-10px) scale(1)', opacity: 1, offset: .15 }, { transform: `translate(${dx}px,${dy}px) scale(.55)`, opacity: .8 }],
    { duration: 560, delay, easing: 'cubic-bezier(.5,0,.75,1)', fill: 'both' }).onfinish = () => c.remove();
}
/** Kasa rakamı yarım saniyede sayarak yükselir. */
export function countUp(from: number, to: number) { ui.cashAnim = { from, to, t0: performance.now() + 420 }; }
let gainT: any = 0;
export function showGain(text: string) {
  const g = $('#gain'); if (!g) return;
  g.textContent = text; g.hidden = false; g.classList.remove('go'); void (g as HTMLElement).offsetWidth; g.classList.add('go');
  clearTimeout(gainT); gainT = setTimeout(() => { g.hidden = true; }, 1600);
}
let stampT: any = 0;
export function bigStamp(main: string, sub: string) {
  const s = $('#bigStamp'); if (!s) return;
  s.innerHTML = `<b>${main}</b><small>${sub}</small>`; s.hidden = false; s.classList.remove('go'); void (s as HTMLElement).offsetWidth; s.classList.add('go');
  clearTimeout(stampT); stampT = setTimeout(() => { s.hidden = true; }, 1400);
}
