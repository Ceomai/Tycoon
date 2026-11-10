/* TEMA — uygulama içi seçim: otomatik (işletim sistemi), açık, koyu. Tercih tapu-prefs'te (prefs.ts) tutulur.
   Renkler styles.css'teki token anahtarından gelir: burada yalnızca <html data-theme> yönetilir (otomatikte kaldırılır).
   Tarayıcı çubuğu (theme-color) ve telefonun durum çubuğu simgeleri etkin temaya göre güncellenir.
   Oyun içi gece görünümü (body.night, saat efekti) ayrıdır ve temadan bağımsız çalışır. */
import { Capacitor, SystemBars, SystemBarsStyle } from '@capacitor/core';

export type Theme = 'auto' | 'light' | 'dark';
export const THEMES: Theme[] = ['auto', 'light', 'dark'];
let cur: Theme = 'auto', mq: MediaQueryList | null = null;

export const isTheme = (v: unknown): v is Theme => THEMES.includes(v as Theme);
/** Etkin tema koyu mu (otomatikte işletim sistemine bakar)? */
export function isDark(): boolean {
  if (cur !== 'auto') return cur === 'dark';
  try { return !!(typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches); } catch { return false; }
}

function syncChrome() {
  if (typeof document === 'undefined') return;
  try {
    const bg = getComputedStyle(document.body || document.documentElement).backgroundColor;
    const m = document.querySelector('meta[name="theme-color"]');
    if (m && bg) m.setAttribute('content', bg);
  } catch { /* yok */ }
  // telefonda uygulama kenardan kenara çizilir: durum çubuğu zemini oyunun zeminidir, yalnızca simge rengi seçilir
  if (Capacitor.isNativePlatform()) void SystemBars.setStyle({ style: isDark() ? SystemBarsStyle.Dark : SystemBarsStyle.Light }).catch(() => { /* eski çekirdek */ });
}

export function applyTheme(th: Theme) {
  cur = isTheme(th) ? th : 'auto';
  if (typeof document === 'undefined') return;
  const r = document.documentElement;
  if (cur === 'auto') delete r.dataset.theme; else r.dataset.theme = cur;
  syncChrome();
  if (!mq && typeof matchMedia === 'function') {
    try { mq = matchMedia('(prefers-color-scheme: dark)'); mq.addEventListener?.('change', () => { if (cur === 'auto') syncChrome(); }); } catch { /* yok */ }
  }
}
