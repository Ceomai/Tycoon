/* Kartlar (tebligat), sıra kuyruğu, bildirim şeridi ve para uçuşu efekti */
import { $, ui, reduceMotion, syncHistory, view } from './ctx';
import { S } from '../state';
import { Snd } from '../sound';
import { fmt } from '../format';
import { play, pulse, fadeIn, DUR, EASE } from './motion';

let modalHandler: ((a: string) => void) | null = null;

/** Kart (tebligat) açar. Kartta `data-back` taşıyan düğme varsa kart geri tuşuyla/Esc ile o düğmeye basılmış gibi
 *  kapanır; yoksa (ilk açılış dil/bölge/il seçimi, ödül seçimi gibi zorunlu kararlar) geri tuşu kartı kapatmaz. */
export function openModal(html: string, handler: (a: string) => void) {
  if (ui.modal || ui.ad) { ui.mq.push([html, handler]); return; }
  const focus = ui.sheet ? ui.sheetFocus : document.activeElement as HTMLElement | null;
  ui.modal = true; view.closeSheet(); modalHandler = handler; ui.openedAt = performance.now(); ui.modalFocus = focus;
  dropGhost(); // kapanmakta olan kart hemen gider (kesilebilir)
  const m = $('#modal'); m.innerHTML = html; m.hidden = false; $('#scrim').classList.add('on'); Snd.unlock();
  if (reduceMotion) fadeIn(m.querySelector('.card'), 'in', 140);
  const card = m.querySelector('.card') as HTMLElement | null;
  if (card) { card.setAttribute('tabindex', '-1'); const h = card.querySelector('h3'); if (h) { h.id = h.id || 'modalTitle'; m.setAttribute('aria-labelledby', h.id); } else m.removeAttribute('aria-labelledby'); card.focus({ preventScroll: true }); }
  syncHistory();
}
/* Kapanış animasyonu: kartın kopyası ayrı, etkileşimsiz bir katmanda (#modalOut) ~180 ms solup aşağı kayar; asıl #modal
   anında boşalır (durum, odak ve kuyruk eskisi gibi hemen işler; yeni kart açılırsa kopya hemen kaldırılır). */
let ghost: { el: HTMLElement; a: Animation } | null = null;
function dropGhost() { if (ghost) { const g = ghost; ghost = null; g.a.cancel(); g.el.remove(); } }
function exitCard(card: HTMLElement | null) {
  dropGhost();
  if (!card || !card.animate) return;
  const host = document.createElement('div'); host.className = 'modal modal-out'; host.setAttribute('aria-hidden', 'true'); host.inert = true;
  const top = card.scrollTop; host.appendChild(card); document.body.appendChild(host); card.scrollTop = top;
  const a = reduceMotion
    ? card.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 120, easing: 'linear', fill: 'forwards' })
    : card.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(16px)' }], { duration: DUR.out, easing: EASE.in, fill: 'forwards' });
  const g = ghost = { el: host, a }; a.onfinish = () => { if (ghost === g) dropGhost(); };
}
export function closeModal() {
  const m = $('#modal'), card = m.querySelector('.card') as HTMLElement | null;
  ui.modal = false; modalHandler = null; if (card && !m.hidden) exitCard(card); m.hidden = true; m.innerHTML = ''; $('#scrim').classList.remove('on');
  ui.lastClose = ui.breakAt = performance.now();
  const f = ui.modalFocus; ui.modalFocus = null; if (f && f.isConnected && !ui.sheet) f.focus({ preventScroll: true });
  syncHistory(); flushQueue();
}
/** Geri tuşu/Esc: kart kapatılabilirse (data-back) kapatır. Kart açıkken geri her durumda burada tüketilir. */
export function modalBack() {
  const b = document.querySelector('#modal [data-back][data-a]') as HTMLElement | null;
  if (b && modalHandler && !(b as HTMLButtonElement).disabled) modalHandler(b.dataset.a!);
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

/** Kasa vurgusu: kısa yaylı büyüme (WAAPI; zorunlu yeniden yerleşim yok). */
export function bump() {
  const c = $('#cash'); if (reduceMotion) return;
  play(c, 'bump', [{ transform: 'scale(1)' }, { transform: 'scale(1.06)', offset: .4 }, { transform: 'scale(1)' }], { duration: DUR.base, easing: EASE.out });
}
/** Kasa metni yalnızca değişince yazılır. */
export function cashText(v: number) { const c = $('#cash'), s = fmt(v); if (c.textContent !== s) c.textContent = s; }
/** Kısa bildirim şeridi. ms: görünme süresi (hata bildirimleri okunabilsin diye daha uzun verilir). Açıkken yeni mesaj gelirse kısa vurgu. */
export function toast(msg: string, ms = 2200) {
  const t = $('#toast'), was = t.classList.contains('on'); t.textContent = msg; t.classList.add('on');
  if (was) pulse(t, 1.04);
  clearTimeout(ui.toastT); ui.toastT = setTimeout(() => t.classList.remove('on'), ms);
}
/** Taksiden/tek binadan kasaya para uçar; varınca kasa vurgulanır. */
export function flyCoin(fromEl: Element): Promise<void> {
  const to = $('#cash');
  return flyTo(fromEl, to, 0, .5).then(() => bump());
}

/** Binadan bir hedefe para uçar (iz çizgisi yok). Para varınca (ya da animasyon yoksa hemen) çözülür. */
export function flyTo(fromEl: Element, toEl: Element, delay = 0, y = .35): Promise<void> {
  if (reduceMotion || !(fromEl as any).animate) return Promise.resolve();
  const r = fromEl.getBoundingClientRect(), to = toEl.getBoundingClientRect();
  const c = document.createElement('div'); c.className = 'fly';
  c.style.left = (r.left + r.width / 2 - 11) + 'px'; c.style.top = (r.top + r.height * y - 11) + 'px';
  document.body.appendChild(c);
  const dx = to.left + to.width / 2 - (r.left + r.width / 2), dy = to.top + to.height / 2 - (r.top + r.height * y);
  return new Promise(res => {
    const a = c.animate([{ transform: 'translate(0,0) scale(.6)', opacity: 0 }, { transform: `translate(${dx * .2}px,${Math.min(-10, dy * .1 - 28)}px) scale(1)`, opacity: 1, offset: .25 }, { transform: `translate(${dx}px,${dy}px) scale(.55)`, opacity: .8 }],
      { duration: 560, delay, easing: 'cubic-bezier(.5,0,.75,1)', fill: 'both' });
    a.onfinish = a.oncancel = () => { c.remove(); res(); };
  });
}
/** Kasa sayacı: `after` çözülünce (son para kasaya varınca) yarım saniyede sayarak yükselir. Sayım sürerken #cash'i
 *  yalnız bu rAF döngüsü yazar (render dokunmaz); o ana kadar eski değer (artı aradaki gelir) görünür. */
let cashRaf = 0;
export function countUp(from: number, to: number, after?: Promise<unknown>) {
  cancelAnimationFrame(cashRaf);
  const ca = ui.cashAnim = { from, to, t0: Infinity };
  cashText(from + (S.cash - to));
  const step = () => {
    if (ui.cashAnim !== ca) return;
    const q = (performance.now() - ca.t0) / 500;
    if (q >= 1) { ui.cashAnim = null; cashText(S.cash); return; }
    cashText(ca.from + (ca.to - ca.from) * (1 - Math.pow(1 - Math.max(0, q), 3)) + (S.cash - ca.to));
    cashRaf = requestAnimationFrame(step);
  };
  const go = () => { if (ui.cashAnim !== ca) return; if (reduceMotion) { ui.cashAnim = null; cashText(S.cash); return; } ca.t0 = performance.now(); step(); };
  if (after) void Promise.race([after, new Promise(r => setTimeout(r, 1500))]).then(go); else go();
}
let gainT: any = 0;
/** Kazanç etiketi: yukarı süzülüp söner (1,6 sn). Hareketi azalt açıkken durağan görünür, 1,6 sn sonra kaybolur. */
export function showGain(text: string) {
  const g = $('#gain') as HTMLElement | null; if (!g) return;
  g.textContent = text; g.hidden = false; clearTimeout(gainT);
  if (reduceMotion) { play(g, 'gain', [{ opacity: 0 }, { opacity: 1 }], { duration: 120 }); gainT = setTimeout(() => { g.hidden = true; }, 1600); return; }
  play(g, 'gain', [{ transform: 'translateY(6px)', opacity: 0 }, { transform: 'none', opacity: 1, offset: .15 }, { opacity: 1, offset: .75 }, { transform: 'translateY(-10px)', opacity: 0 }], { duration: 1600, easing: 'ease-out', fill: 'forwards' });
  gainT = setTimeout(() => { g.hidden = true; }, 1600);
}
let stampT: any = 0;
/** Büyük mühür (bildirim şeridinde): yaylı basılır, 1,4 sn sonra kısa solmayla kalkar. */
export function bigStamp(main: string, sub: string) {
  const s = $('#bigStamp') as HTMLElement | null; if (!s) return;
  s.innerHTML = `<b>${main}</b><small>${sub}</small>`; s.hidden = false; clearTimeout(stampT);
  if (reduceMotion) fadeIn(s, 'stamp', 140);
  else play(s, 'stamp', [{ transform: 'rotate(-10deg) scale(2.2)', opacity: 0 }, { transform: 'rotate(-10deg) scale(.92)', opacity: 1, offset: .6 }, { transform: 'rotate(-10deg) scale(1)', opacity: 1 }], { duration: DUR.slow, easing: EASE.out });
  stampT = setTimeout(() => {
    const a = play(s, 'stamp', [{ opacity: 1 }, { opacity: 0 }], { duration: DUR.fast, easing: 'linear', fill: 'forwards' });
    const hide = () => { s.hidden = true; if (a) a.cancel(); };
    if (a) a.onfinish = hide; else hide();
  }, 1400);
}
