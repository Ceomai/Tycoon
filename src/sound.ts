/* SES — Web Audio ile sentezlenen sesler (dosya gerektirmez): yumuşak marimba tonları, pentatonik dizi; inşaatta çekiç,
   bitişte zil. Arka planda (onHide) ses bağlamı askıya alınır, öne gelince sürer. */
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { S } from './state';
const SCALE = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.51, 1567.98, 1760, 2093];
type AC = AudioContext;
export const Snd = {
  c: null as AC | null, m: null as GainNode | null, send: null as GainNode | null,
  /** Vuruş gürültüsü (80 ms, sönümlü): bağlam başına bir kez üretilir, her vuruşta yeniden kullanılır. */
  noise: null as AudioBuffer | null,
  init() {
    if (this.c) { if (this.c.state === 'suspended') void this.c.resume(); return; }
    const C: typeof AudioContext | undefined = window.AudioContext || (window as any).webkitAudioContext; if (!C) return;
    try {
      const c = this.c = new C(), comp = c.createDynamicsCompressor(); comp.connect(c.destination);
      this.m = c.createGain(); this.m.gain.value = .55; this.m.connect(comp);
      const d = c.createDelay(); d.delayTime.value = .17; const fb = c.createGain(); fb.gain.value = .25; const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2200;
      const wet = c.createGain(); wet.gain.value = .22; this.send = c.createGain(); this.send.connect(d); d.connect(lp); lp.connect(fb); fb.connect(d); lp.connect(wet); wet.connect(comp);
    } catch { this.c = null; }
  },
  /** Arka plan: ses bağlamı askıya alınır (pil); öne gelince sürdürülür. */
  suspend() { const c = this.c; if (c && c.state === 'running') c.suspend().catch(() => { /* yok */ }); },
  resume() { const c = this.c; if (c && c.state === 'suspended') c.resume().catch(() => { /* yok */ }); },
  ok() { return !!(S && S.sound && this.c); },
  note(f: number, at: number, dur: number, vol: number) {
    const c = this.c!, t = c.currentTime + (at || 0), g = c.createGain(), o = c.createOscillator(), o2 = c.createOscillator(), g2 = c.createGain();
    o.type = 'sine'; o.frequency.value = f; o2.type = 'sine'; o2.frequency.value = f * 3.99;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + .006); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    g2.gain.setValueAtTime(vol * .35, t); g2.gain.exponentialRampToValueAtTime(.0001, t + .06);
    o.connect(g); o2.connect(g2); g2.connect(g); g.connect(this.m!); g.connect(this.send!);
    o.start(t); o2.start(t); o.stop(t + dur + .05); o2.stop(t + .1);
  },
  knock(f: number, at: number, vol: number, q?: number) {
    const c = this.c!, t = c.currentTime + (at || 0);
    let buf = this.noise;
    if (!buf || buf.sampleRate !== c.sampleRate) {
      const len = .08; buf = this.noise = c.createBuffer(1, Math.floor(c.sampleRate * len), c.sampleRate); const ch = buf.getChannelData(0);
      for (let k = 0; k < ch.length; k++) ch[k] = (Math.random() * 2 - 1) * Math.pow(1 - k / ch.length, 6);
    }
    const src = c.createBufferSource(); src.buffer = buf; const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = q || 4;
    const g = c.createGain(); g.gain.value = vol; src.connect(bp); bp.connect(g); g.connect(this.m!); src.start(t);
  },
  collect(combo: number) { if (!this.ok()) return; this.note(SCALE[Math.min(combo, SCALE.length - 1)], 0, .35, .22); },
  tap() { if (!this.ok()) return; this.knock(1800, 0, .25); },
  hammer(at: number) { this.knock(2700, at, .45, 16); this.knock(420, at, 1, 2); },
  build() { if (!this.ok()) return; this.hammer(0); this.hammer(.15); this.hammer(.3); },
  wreck() { if (!this.ok()) return; this.knock(260, 0, 1); this.knock(200, .08, .9); },
  done() { if (!this.ok()) return; this.knock(2700, 0, .3, 16); this.note(1046.5, .05, .6, .16); this.note(1567.98, .15, .9, .14); },
  reward() { if (!this.ok()) return; [523.25, 659.25, 783.99, 1046.5].forEach((f, k) => this.note(f, k * .07, .6, .17)); },
  unlock() { if (!this.ok()) return; [783.99, 987.77, 1174.66, 1567.98].forEach((f, k) => this.note(f, k * .09, .8, .15)); },
  no() { if (!this.ok()) return; this.note(220, 0, .25, .15); this.note(196, .1, .3, .12); },
};
/** Titreşim (anlamsal): telefonda Capacitor Haptics, web'de navigator.vibrate (en az 10–15 ms; daha kısası çoğu cihazda
 *  hissedilmez). Ayarlardan kapatılabilir (S.vib === false). Aşırı titreşim olmasın diye bir döngü adımında (250 ms) en
 *  fazla bir titreşim: aynı anda gelen ikincisi düşer (hata her zaman önceliklidir).
 *  light: hafif dokunuş (toplama, inşaat başlangıcı) · medium: belirgin dokunuş · success: tamamlanan iş, ödül, alım ·
 *  error: başarısız işlem · select: seçim değişimi (ayar anahtarı, segment). buzz(ms) eski çağrılar için: ≥25 ms medium. */
let lastBuzz = -1e9;
type Kind = 'light' | 'medium' | 'success' | 'error' | 'select';
const WEB: Record<Kind, number | number[]> = { light: 12, medium: 22, success: [14, 60, 24], error: [30, 50, 30], select: 10 };
function fire(kind: Kind) {
  if (S && S.vib === false) return;
  const t = performance.now(); if (t - lastBuzz < 250 && kind !== 'error') return; lastBuzz = t;
  try {
    if (Capacitor.isNativePlatform()) {
      if (kind === 'success' || kind === 'error') void Haptics.notification({ type: kind === 'success' ? NotificationType.Success : NotificationType.Error });
      else if (kind === 'select') void Haptics.selectionStart().then(() => Haptics.selectionChanged()).then(() => Haptics.selectionEnd()).catch(() => {});
      else void Haptics.impact({ style: kind === 'medium' ? ImpactStyle.Medium : ImpactStyle.Light });
      return;
    }
    navigator.vibrate && navigator.vibrate(WEB[kind]);
  } catch { /* yok */ }
}
export const buzz = Object.assign((ms: number) => fire(ms >= 25 ? 'medium' : 'light'), {
  light: () => fire('light'), medium: () => fire('medium'), success: () => fire('success'), error: () => fire('error'), select: () => fire('select'),
});
