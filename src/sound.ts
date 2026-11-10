// @ts-nocheck — Web Audio ile sentezlenen sesler (dosya gerektirmez)
/* SES — yumuşak marimba tonları, pentatonik dizi; inşaatta çekiç, bitişte zil. */
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { S } from './state';
const SCALE=[523.25,587.33,659.25,783.99,880,1046.5,1174.66,1318.51,1567.98,1760,2093];
export const Snd={
  c:null,m:null,send:null,
  init(){
    if(this.c){ if(this.c.state==='suspended') this.c.resume(); return; }
    const C=window.AudioContext||window.webkitAudioContext; if(!C) return;
    try{
      const c=this.c=new C(), comp=c.createDynamicsCompressor(); comp.connect(c.destination);
      this.m=c.createGain(); this.m.gain.value=.55; this.m.connect(comp);
      const d=c.createDelay(); d.delayTime.value=.17; const fb=c.createGain(); fb.gain.value=.25; const lp=c.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value=2200;
      const wet=c.createGain(); wet.gain.value=.22; this.send=c.createGain(); this.send.connect(d); d.connect(lp); lp.connect(fb); fb.connect(d); lp.connect(wet); wet.connect(comp);
    }catch(e){ this.c=null; }
  },
  ok(){ return !!(S&&S.sound&&this.c); },
  note(f,at,dur,vol){
    const c=this.c, t=c.currentTime+(at||0), g=c.createGain(), o=c.createOscillator(), o2=c.createOscillator(), g2=c.createGain();
    o.type='sine'; o.frequency.value=f; o2.type='sine'; o2.frequency.value=f*3.99;
    g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(vol,t+.006); g.gain.exponentialRampToValueAtTime(.0001,t+dur);
    g2.gain.setValueAtTime(vol*.35,t); g2.gain.exponentialRampToValueAtTime(.0001,t+.06);
    o.connect(g); o2.connect(g2); g2.connect(g); g.connect(this.m); g.connect(this.send);
    o.start(t); o2.start(t); o.stop(t+dur+.05); o2.stop(t+.1);
  },
  knock(f,at,vol,q){
    const c=this.c, t=c.currentTime+(at||0), len=.08, buf=c.createBuffer(1,Math.floor(c.sampleRate*len),c.sampleRate), ch=buf.getChannelData(0);
    for(let k=0;k<ch.length;k++) ch[k]=(Math.random()*2-1)*Math.pow(1-k/ch.length,6);
    const src=c.createBufferSource(); src.buffer=buf; const bp=c.createBiquadFilter(); bp.type='bandpass'; bp.frequency.value=f; bp.Q.value=q||4;
    const g=c.createGain(); g.gain.value=vol; src.connect(bp); bp.connect(g); g.connect(this.m); src.start(t);
  },
  collect(combo){ if(!this.ok()) return; this.note(SCALE[Math.min(combo,SCALE.length-1)],0,.35,.22); },
  tap(){ if(!this.ok()) return; this.knock(1800,0,.25); },
  hammer(at){ this.knock(2700,at,.45,16); this.knock(420,at,1,2); },
  build(){ if(!this.ok()) return; this.hammer(0); this.hammer(.15); this.hammer(.3); },
  wreck(){ if(!this.ok()) return; this.knock(260,0,1); this.knock(200,.08,.9); },
  done(){ if(!this.ok()) return; this.knock(2700,0,.3,16); this.note(1046.5,.05,.6,.16); this.note(1567.98,.15,.9,.14); },
  reward(){ if(!this.ok()) return; [523.25,659.25,783.99,1046.5].forEach((f,k)=>this.note(f,k*.07,.6,.17)); },
  unlock(){ if(!this.ok()) return; [783.99,987.77,1174.66,1567.98].forEach((f,k)=>this.note(f,k*.09,.8,.15)); },
  no(){ if(!this.ok()) return; this.note(220,0,.25,.15); this.note(196,.1,.3,.12); },
};
/** Titreşim: telefonda Capacitor Haptics, web'de navigator.vibrate. Ayarlardan kapatılabilir (S.vib === false). */
export function buzz(ms: number) {
  if (S && S.vib === false) return;
  try {
    if (Capacitor.isNativePlatform()) { void Haptics.impact({ style: ms >= 25 ? ImpactStyle.Medium : ImpactStyle.Light }); return; }
    navigator.vibrate && navigator.vibrate(ms);
  } catch { /* yok */ }
}
