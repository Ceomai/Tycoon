/* HAREKET — kısa, kesilebilir WAAPI animasyonları. İlkeler: 150–350 ms, yalnız transform/opacity (compositor), yay benzeri
   eğri (hafif aşma), yeni animasyon aynı öğedeki eskisini iptal eder (kilitlemez). Hareketi azalt açıkken hareket yerine
   kısa bir opaklık geçişi (ya da hiçbir şey) oynar; bilgi taşıyan öğe her durumda yerinde ve görünür kalır.
   Süre/eğri değerleri styles.css'teki --dur* / --ease* belirteçleriyle aynıdır. */
import { ui, reduceMotion } from './ctx';
import { Snd, buzz } from '../sound';

export const DUR = { fast: 150, base: 250, slow: 350, out: 180 } as const;
export const EASE = { out: 'cubic-bezier(.2,.8,.2,1)', spring: 'cubic-bezier(.2,.9,.3,1.2)', in: 'cubic-bezier(.4,0,1,1)' } as const;

const running = new WeakMap<Element, Map<string, Animation>>();
/** Öğede `key` adlı animasyonu oynatır; aynı anahtarlı önceki animasyon iptal edilir. Animasyon yoksa null. */
export function play(el: Element | null | undefined, key: string, frames: Keyframe[], opts: KeyframeAnimationOptions): Animation | null {
  if (!el || !(el as any).animate) return null;
  let m = running.get(el); if (!m) { m = new Map(); running.set(el, m); }
  const old = m.get(key); if (old) old.cancel();
  const a = el.animate(frames, opts); m.set(key, a);
  a.onfinish = a.oncancel = () => { if (m!.get(key) === a) m!.delete(key); };
  return a;
}
export function stop(el: Element | null | undefined, key: string) { const m = el && running.get(el), a = m && m.get(key); if (a) a.cancel(); }
/** Hareketi azalt: hareket yerine kısa opaklık. */
export const fadeIn = (el: Element | null | undefined, key = 'fade', ms = 140) => play(el, key, [{ opacity: 0 }, { opacity: 1 }], { duration: ms, easing: 'linear' });

/** Küçük "pop" (karo inşaatı/teslimi, kasa vurgusu). */
export function pop(el: Element | null | undefined, from = .85, ms = DUR.slow) {
  if (reduceMotion) return fadeIn(el, 'pop', 140);
  return play(el, 'pop', [{ transform: `scale(${from}) translateY(4px)` }, { transform: 'none' }], { duration: ms, easing: EASE.spring });
}
/** Kısa ölçek vurgusu (ör. açık toast'a yeni mesaj, kasa artışı). */
export function pulse(el: Element | null | undefined, s = 1.04, ms = DUR.fast * 1.4) {
  if (reduceMotion) return null;
  return play(el, 'pulse', [{ transform: 'scale(1)' }, { transform: `scale(${s})` }, { transform: 'scale(1)' }], { duration: ms, easing: EASE.out, composite: 'add' as CompositeOperation });
}
/** Başarısız işlem: 250 ms yatay sallama (hareketi azalt açıkken yalnız kısa renk/opaklık yanıp sönmesi). */
export function shake(el: Element | null | undefined) {
  if (!el) return null;
  if (reduceMotion) return play(el, 'shake', [{ opacity: 1 }, { opacity: .45 }, { opacity: 1 }], { duration: 250, easing: 'linear' });
  return play(el, 'shake', [{ transform: 'translateX(0)' }, { transform: 'translateX(-6px)' }, { transform: 'translateX(5px)' }, { transform: 'translateX(-3px)' }, { transform: 'translateX(2px)' }, { transform: 'translateX(0)' }],
    { duration: 250, easing: 'ease-out', composite: 'add' as CompositeOperation });
}
/** Başarısız işlem geri bildirimi: ret sesi + hata titreşimi + basılan düğmeye (yoksa verilen öğeye) sallama. */
export function deny(fallback?: Element | null) {
  Snd.no(); buzz.error();
  const recent = ui.lastPress && ui.lastPress.isConnected && performance.now() - ui.lastPressAt < 800 ? ui.lastPress : null;
  shake(recent || fallback || null);
}
