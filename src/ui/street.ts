/* SOKAK HAYATI — araçlar, yayalar ve altın taksi (tahtanın sokaklarında); boşta ve arka planda durur */
import { COLS, ROWS } from '../config';
import { t } from '../i18n';
import { fmt, rand } from '../format';
import { Snd, buzz } from '../sound';
import { $, ui, reduceMotion } from './ctx';
import { flyCoin, toast, openModal, closeModal } from './modal';
import { catchTaxiReward } from '../game/actions';
import { landmarkCard } from '../game/collection';

const CAR_COLORS = ['var(--sgn)', 'var(--fr)', 'var(--sol)', 'var(--aw1)', 'var(--pl)', 'var(--ofis-s)', 'var(--kafe-f)'];
export const Street = {
  low: null as HTMLElement | null, high: null as HTMLElement | null, n: 0, anims: new Set<Animation>(), timer: 0 as ReturnType<typeof setTimeout> | 0,
  init() {
    const g = $('#grid'); this.low = document.createElement('div'); this.low.className = 'street'; this.high = document.createElement('div'); this.high.className = 'street top';
    g.prepend(this.low); g.appendChild(this.high); this.loop();
  },
  spawn(kind: 'car' | 'ped' | 'taxi') {
    if (kind !== 'taxi' && document.body.classList.contains('night') && Math.random() < .6) return; // gece sokaklar sakin
    // altın taksi sınırdan ve boşta kuralından muaf: zamanı geldiyse mutlaka çıkar (ödül kaybolmaz; boştaysa oyuncu dönene dek bekler)
    if (document.hidden || (ui.idle && kind !== 'taxi') || (reduceMotion && kind !== 'taxi') || (this.n > 8 && kind !== 'taxi')) return;
    const s = ui.sw, sh = ui.sh, g = ui.gap, off = ui.pad, Wd = COLS * s + (COLS - 1) * g + 2 * off, Ht = ROWS * sh + (ROWS - 1) * g + 2 * off, taxi = kind === 'taxi', ped = kind === 'ped';
    const horiz = Math.random() < .5, fwd = Math.random() < .5, e = document.createElement('div');
    e.className = ped ? 'ped' : 'car' + (taxi ? ' taxi' : '') + (horiz ? '' : ' v') + (fwd ? '' : ' rev');
    if (!ped && !taxi) e.style.setProperty('--cc', CAR_COLORS[Math.floor(Math.random() * CAR_COLORS.length)]);
    const len = taxi ? 18 : ped ? 3 : 14, thick = taxi ? 8 : ped ? 3 : 6;
    let from: number, to: number;
    if (horiz) { const r = 1 + Math.floor(Math.random() * (ROWS - 1)); const cy = off + r * (sh + g) - g / 2; e.style.top = (ped ? cy + (fwd ? 5 : -8) : (taxi ? cy - thick / 2 : (fwd ? cy + 1 : cy - 1 - thick))) + 'px'; from = fwd ? -len : Wd; to = fwd ? Wd : -len; }
    else { const c = 1 + Math.floor(Math.random() * (COLS - 1)); const cx = off + c * (s + g) - g / 2; e.style.left = (ped ? cx + (fwd ? 5 : -8) : (taxi ? cx - thick / 2 : (fwd ? cx - 1 - thick : cx + 1))) + 'px'; from = fwd ? -len : Ht; to = fwd ? Ht : -len; }
    const speed = taxi ? 28 : ped ? 9 : rand(38, 64), dur = Math.abs(to - from) / speed * 1000;
    (taxi ? this.high : this.low)!.appendChild(e); this.n++;
    const tf = (x: number) => horiz ? `translateX(${x}px)` : `translateY(${x}px)`;
    if (!e.animate) { e.remove(); this.n--; return; }
    const an = e.animate([{ transform: tf(from) }, { transform: tf(to) }], { duration: dur, easing: 'linear' });
    this.anims.add(an); if (ui.idle) an.pause();
    an.onfinish = () => { this.anims.delete(an); e.remove(); this.n--; };
    if (taxi) e.addEventListener('pointerdown', ev => { ev.stopPropagation(); this.anims.delete(an); an.cancel(); catchTaxi(e); this.n--; }, { once: true });
  },
  /** Boşta sokak durur (pil): yoldaki araçlar olduğu yerde bekler, oyuncu dönünce devam eder. */
  idle(on: boolean) { for (const a of this.anims) { if (on) a.pause(); else a.play(); } },
  loop() { this.timer = setTimeout(() => { this.spawn(Math.random() < .25 ? 'ped' : 'car'); this.loop(); }, rand(900, 2200)); },
  /** Arka planda (onHide) araç üretimi durur; öne gelince (onShow) kaldığı yerden sürer. */
  stop() { clearTimeout(this.timer); this.timer = 0; },
  start() { if (!this.timer && this.low) this.loop(); },
};
/** Altın taksi yakalandı: ödül oyun katmanında (catchTaxiReward); burada ses, para uçuşu, bildirim ve çıkan tarihi yapı kartı. */
function catchTaxi(el: HTMLElement) {
  const { amt, lm } = catchTaxiReward(); Snd.reward(); buzz.success();
  const r = el.getBoundingClientRect(), dot = document.createElement('span'); dot.style.cssText = `position:fixed;left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px`;
  document.body.appendChild(dot); flyCoin(dot); setTimeout(() => dot.remove(), 50); el.remove();
  toast(t('Altın taksi: {amt}', { amt: fmt(amt) }));
  if (lm) openModal(landmarkCard(lm, ' ' + t('Altın taksiden çıktı!')), () => closeModal());
}
