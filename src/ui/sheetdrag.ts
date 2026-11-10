/* Panel jestleri: tutamaktan/başlıktan ya da içerik en üstteyken aşağı sürükleyince panel parmağı izler; eşik
   (yüksekliğin %25'i) ya da hızlı fırlatma aşılırsa kapanır, aksi halde yerine yaylanır. Yatay düzende panel sağdan
   geldiği için sağa sürükleyerek kapanır. Kapanış her zaman verilen kapatma işlevinden geçer (closeSheet: geçmiş kaydı
   ve odak aynı yoldan eşitlenir). İçerik kaydırması bozulmaz: başlık dışından başlayan dikey sürükleme yalnızca panel en
   üstteyken ve aşağı doğruysa yakalanır. Hareketi azalt açıkken geri yaylanma anlıktır, kapanış kısa opaklıkla olur (styles.css hareketi azalt bölümü). */
import { ui } from './ctx';

const SLOP = 8;          // yön kararından önceki hareket (px)
const DIST = 0.25;       // kapanma eşiği: panel boyutunun oranı
const FLING = 0.5;       // kapanma eşiği: hız (px/ms)
const side = () => typeof matchMedia === 'function' && matchMedia('(orientation: landscape) and (min-aspect-ratio: 13/10)').matches;

interface Drag { x0: number; y0: number; fromBar: boolean; on: boolean; dead: boolean; d: number; h: [number, number][]; horiz: boolean; id: number | 'touch' }

export function bindSheetDrag(sheet: HTMLElement, bar: HTMLElement, scrim: HTMLElement, close: () => void) {
  let g: Drag | null = null, suppressUntil = 0;

  const begin = (x: number, y: number, target: EventTarget | null, id: Drag['id']) => {
    if (!ui.sheet || !sheet.classList.contains('on')) return;
    const el = target as HTMLElement | null;
    if (el && el.closest && el.closest('input,textarea,select,[data-nodrag]')) return;
    const fromBar = !!(el && bar.contains(el)) && !(el && el.closest('#sheetX'));
    g = { x0: x, y0: y, fromBar, on: false, dead: false, d: 0, h: [[performance.now(), 0]], horiz: side(), id };
  };
  /** true: sürükleme bizde (tarayıcı kaydırması engellenmeli) */
  const move = (x: number, y: number): boolean => {
    if (!g || g.dead) return false;
    const dx = x - g.x0, dy = y - g.y0;
    if (!g.on) {
      if (Math.abs(dx) < SLOP && Math.abs(dy) < SLOP) return false;
      const along = g.horiz ? dx : dy, across = g.horiz ? dy : dx;
      // kapanma yönünde ve o eksende baskın değilse bırak (içerik kaydırması / ters yön)
      const atTop = sheet.scrollTop <= 0;
      if (along <= 0 || Math.abs(along) < Math.abs(across) || (!g.horiz && !g.fromBar && !atTop)) { g.dead = true; return false; }
      g.on = true; g.x0 = x; g.y0 = y; sheet.classList.add('drag');
    }
    const d = Math.max(0, g.horiz ? x - g.x0 : y - g.y0);
    g.d = d; const t = performance.now(); g.h.push([t, d]); while (g.h.length > 2 && t - g.h[0][0] > 100) g.h.shift();
    sheet.style.transform = g.horiz ? `translateX(${d}px)` : `translateY(${d}px)`;
    const size = g.horiz ? sheet.offsetWidth : sheet.offsetHeight;
    scrim.style.opacity = String(Math.max(0, 1 - d / Math.max(1, size)));
    return true;
  };
  const end = (cancel = false) => {
    const s = g; g = null; if (!s || !s.on) return;
    suppressUntil = performance.now() + 400; // sürüklemenin sonundaki tıklama (altındaki düğme) yok sayılır
    const size = s.horiz ? sheet.offsetWidth : sheet.offsetHeight;
    const [t0, d0] = s.h[0], dt = performance.now() - t0, v = dt > 0 ? (s.d - d0) / dt : 0;
    sheet.classList.remove('drag'); sheet.style.transform = ''; scrim.style.opacity = '';
    if (!cancel && (s.d > size * DIST || (v > FLING && s.d > 20))) close();
  };

  // fare/kalem her yerde, dokunma yalnızca başlıkta (touch-action:none) pointer olaylarıyla
  sheet.addEventListener('pointerdown', e => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    if (e.pointerType === 'touch' && !bar.contains(e.target as Node)) return; // içerikte dokunma: touch olaylarıyla (kaydırmayla birlikte)
    begin(e.clientX, e.clientY, e.target, e.pointerId);
  });
  window.addEventListener('pointermove', e => { if (g && g.id === e.pointerId && move(e.clientX, e.clientY)) e.preventDefault(); });
  window.addEventListener('pointerup', e => { if (g && g.id === e.pointerId) end(); });
  window.addEventListener('pointercancel', e => { if (g && g.id === e.pointerId) end(true); });
  // içerikte dokunma: en üstteyken aşağı çekiş yakalanır, ilk touchmove'da preventDefault ile tarayıcı kaydırması durur
  sheet.addEventListener('touchstart', e => { if (e.touches.length !== 1 || bar.contains(e.target as Node)) return; const t = e.touches[0]; begin(t.clientX, t.clientY, e.target, 'touch'); }, { passive: true });
  sheet.addEventListener('touchmove', e => {
    if (!g || g.id !== 'touch') return; const t = e.touches[0]; if (!t) return;
    const pre = !g.on && !g.dead && (g.horiz ? t.clientX - g.x0 > 0 && t.clientX - g.x0 >= Math.abs(t.clientY - g.y0) : sheet.scrollTop <= 0 && t.clientY - g.y0 > 0 && t.clientY - g.y0 >= Math.abs(t.clientX - g.x0));
    // eşik altındaki ilk hareketlerde de kapanma yönündeyse kaydırma başlamasın (Chrome ilk touchmove'a göre karar verir)
    if ((move(t.clientX, t.clientY) || pre) && e.cancelable) e.preventDefault();
  }, { passive: false });
  sheet.addEventListener('touchend', () => { if (g && g.id === 'touch') end(); });
  sheet.addEventListener('touchcancel', () => { if (g && g.id === 'touch') end(true); });
  sheet.addEventListener('click', e => { if (performance.now() < suppressUntil) { e.stopPropagation(); e.preventDefault(); } }, true);
}
