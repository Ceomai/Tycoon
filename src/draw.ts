// @ts-nocheck — saf SVG metni üreten çizim modülü (girdi/çıktı string)
/* =========================================================
   ÇİZİM — gerçekçi 3/4 görünüm. Seviye = kat sayısı.
   Ev mimarisi semtin "v" değerine göre: 0 kırma çatı, 1 tuğla apartman, 2 rezidans,
   3 taş apartman (mansart), 4 yalı (cumba), 5 Ege taş evi (düz dam, mavi doğrama).
   İnşaat = betonarme karkas + iskele + file + kule vinç + bariyer.
   ========================================================= */
import { DMAP } from './config';
import { S } from './state';
const D=14, DD=10, Y=90, TAN=DD/D, ANG=Math.atan(TAN)*180/Math.PI;
const BW={ev:46,kafe:52,dukkan:52,ofis:36};
const FH={ev:11,kafe:10,dukkan:10,ofis:6};
const OF=[0,4,6,8,10,12];
function H(t,lv){ if(lv<=0) return 0; if(t==='ev') return 3+11*lv; if(t==='kafe') return 14+10*(lv-1); if(t==='dukkan') return 15+10*(lv-1); return 8+6*OF[lv]; }
const BX=t=>(100-BW[t]-D)/2;
export const r1=n=>+(+n).toFixed(2);
export const P=(...a)=>a.map(p=>r1(p[0])+','+r1(p[1])).join(' ');
function prism(x,yb,W,h,cf,cs,ct,d,dd){
  d=d==null?D:d; dd=dd==null?DD:dd; const yt=yb-h;
  return `<rect class="${cf}" x="${r1(x)}" y="${r1(yt)}" width="${r1(W)}" height="${r1(h)}"/><polygon class="${cs}" points="${P([x+W,yb],[x+W+d,yb-dd],[x+W+d,yt-dd],[x+W,yt])}"/>`
    +(ct?`<polygon class="${ct}" points="${P([x,yt],[x+W,yt],[x+W+d,yt-dd],[x+d,yt-dd])}"/>`:'');
}
// yan cephe: yerel (u,y) koordinatları eğik düzleme taşınır
const side=(x,W,inner)=>`<g transform="translate(${r1(x+W)} 0) skewY(${-ANG.toFixed(2)})">${inner}</g>`;
function win(x,y,w,h){
  return `<rect class="fr" x="${r1(x)}" y="${r1(y)}" width="${w}" height="${h}"/><rect class="gl" x="${r1(x+.8)}" y="${r1(y+.8)}" width="${r1(w-1.6)}" height="${r1(h-1.6)}"/>`
    +`<rect class="fr" x="${r1(x+w/2-.3)}" y="${r1(y)}" width=".6" height="${h}"/><rect class="fr" x="${r1(x-.8)}" y="${r1(y+h)}" width="${r1(w+1.6)}" height="1.1"/>`;
}
function swin(u,y,w,h){ return `<rect class="fr" x="${u}" y="${r1(y)}" width="${w}" height="${h}"/><rect class="gl2" x="${r1(u+.7)}" y="${r1(y+.7)}" width="${r1(w-1.4)}" height="${r1(h-1.4)}"/>`; }
function shadow(t){ const x=BX(t),W=BW[t]; return `<polygon class="sh" points="${P([x+2,Y+1.5],[x+W+3,Y+1.5],[x+W+D+7,Y-DD+1],[x+D+6,Y-DD+1])}"/>`; }

// Ev, semte göre mimari değiştirir: 0 Kadıköy kırma çatı, 1 Beşiktaş tuğla apartman, 2 Şişli modern rezidans,
// 3 Nişantaşı tarihi taş apartman (kemerli pencere, korniş, mansart çatı), 4 Bebek yalı (ahşap kaplama, cumba, geniş saçak)
function drawEv(lv,o){
  const v=(o&&o.v)||0, W=BW.ev, x=BX('ev'), h=H('ev',lv), yt=Y-h; let s=prism(x,Y,W,h,'f','s'), sd='';
  if(v===4){ let sg=''; for(let yy=Y-4.6;yy>yt+1;yy-=2.2) sg+=`M${x} ${r1(yy)}h${W}`; s+=`<path d="${sg}" stroke="var(--ln)" stroke-width=".5"/>`; }
  if(v===1){ let bk=''; for(let yy=Y-5;yy>yt+1;yy-=2.4) bk+=`M${x} ${r1(yy)}h${W}`; s+=`<path d="${bk}" stroke="var(--ln)" stroke-width=".4"/>`; }
  s+=`<rect class="pl" x="${x}" y="${Y-3}" width="${W}" height="3"/>`; sd+=`<rect class="pl2" x="0" y="${Y-3}" width="${D}" height="3"/>`;
  for(let k=0;k<lv;k++){
    const fb=Y-3-k*11, wy=fb-9.2;
    s+=win(x+4,wy+1,8,6.5)+win(x+W-12,wy+1,8,6.5);
    if(v===3) s+=`<path class="fr" d="M${x+4} ${r1(wy+1)}a4 2.6 0 0 1 8 0zM${x+W-12} ${r1(wy+1)}a4 2.6 0 0 1 8 0z"/>`;
    if(k===0){
      s+=`<rect class="fr" x="${x+W/2-5}" y="${r1(fb-9.6)}" width="10" height="9.6"/><rect class="dr" x="${x+W/2-4}" y="${r1(fb-8.8)}" width="8" height="8.8"/><rect class="sl" x="${x+W/2-6}" y="${r1(fb-.6)}" width="12" height="1.4"/>`;
      if(v===3) s+=`<path class="fr" d="M${x+W/2-5} ${r1(fb-9.6)}a5 3.2 0 0 1 10 0z"/>`;
    } else if(v===4&&k%2===1){
      const bx=x+W/2-10; // cumba
      s+=prism(bx,fb+1,20,10.5,'f','s','t',3,2.2)+win(bx+2,wy+1.5,5,6)+win(bx+7.5,wy+1.5,5,6)+win(bx+13,wy+1.5,5,6);
    } else {
      const bx=x+W/2-8;
      s+=`<rect class="gl" x="${x+W/2-4.5}" y="${r1(wy)}" width="9" height="8.6"/><rect class="fr" x="${x+W/2-.3}" y="${r1(wy)}" width=".6" height="8.6"/>`;
      s+=`<rect class="sl" x="${bx}" y="${r1(fb-1.4)}" width="16" height="1.6"/>`;
      s+= v===2? `<rect class="gl2" x="${bx}" y="${r1(fb-5.2)}" width="16" height="3.8" opacity=".7"/>` : `<path class="rl" d="M${bx} ${r1(fb-5.2)}h16${[0.4,4,8,12,15.6].map(q=>`M${r1(bx+q)} ${r1(fb-5.2)}v3.8`).join('')}"/>`;
    }
    if(k>0) s+= v===3? `<rect class="sl" x="${x-1}" y="${r1(fb-.6)}" width="${W+2}" height="1.8"/>` : `<rect class="ln" x="${x}" y="${fb}" width="${W}" height=".9"/>`;
    sd+=swin(4,wy+1,6,6.5);
  }
  if(lv>=2&&v!==3&&v!==4){ const ay=Y-3-11-2; sd+=`<rect class="ac" x="${D-6}" y="${ay}" width="5" height="3.6"/><path class="acl" d="M${D-5.3} ${ay+.9}h3.6M${D-5.3} ${ay+1.8}h3.6M${D-5.3} ${ay+2.7}h3.6"/>`; }
  s+=side(x,W,sd);
  if(o&&o.noRoof) return s;
  if(v===1||v===2||v===5){ // düz çatı: parapet, su deposu, güneş paneli
    s+=`<polygon class="t" points="${P([x,yt],[x+W,yt],[x+W+D,yt-DD],[x+D,yt-DD])}"/><rect class="sl" x="${x-.5}" y="${r1(yt-1.6)}" width="${W+1}" height="1.8"/>`;
    const tx=x+W*.62, ty=yt-DD*.5;
    s+=`<rect class="tk2" x="${r1(tx)}" y="${r1(ty-5)}" width="7" height="5"/><ellipse class="tk2" cx="${r1(tx+3.5)}" cy="${r1(ty)}" rx="3.5" ry="1.4"/><ellipse class="tk" cx="${r1(tx+3.5)}" cy="${r1(ty-5)}" rx="3.5" ry="1.4"/>`;
    if(lv>=2){ const px=x+4, py=yt-2; s+=`<polygon class="sol" points="${P([px,py],[px+13,py],[px+17,py-6],[px+4,py-6])}"/>`; }
    if(v===2&&lv>=3) s+=`<rect class="gl2" x="${x-.5}" y="${r1(yt-5)}" width="${W+1}" height="3.4" opacity=".55"/>`;
    return s;
  }
  if(v===3){ // mansart çatı + çatı pencereleri
    const mh=10;
    s+=`<polygon class="rf2" points="${P([x+W+1,yt],[x+W+1+D,yt-DD],[x+W-3+D,yt-DD-mh],[x+W-3,yt-mh])}"/>`;
    s+=`<polygon class="rf" points="${P([x-1,yt],[x+W+1,yt],[x+W-3,yt-mh],[x+3,yt-mh])}"/>`;
    s+=`<polygon class="sl" points="${P([x+3,yt-mh],[x+W-3,yt-mh],[x+W-3+D,yt-mh-DD],[x+3+D,yt-mh-DD])}"/>`;
    s+=win(x+9,yt-8,6,5)+win(x+W-15,yt-8,6,5);
    s+=prism(x+W-8, yt-mh-DD*.4, 3.4, 6,'ch','ch2','ch2',2.4,1.7);
    return s;
  }
  // kırma çatı (Kadıköy) ya da geniş saçaklı yalı çatısı (Bebek)
  const ov=v===4?5:2, rb=yt+1, l=x-ov, r=x+W+ov, rh=v===4?11:12, ins=10;
  const rl=[l+ins+D/2, rb-rh-DD/2], rr=[r-ins+D/2, rb-rh-DD/2];
  s+=`<polygon class="rf2" points="${P([r,rb],[r+D,rb-DD],rr)}"/>`;
  s+=`<polygon class="rf" points="${P([l,rb],[r,rb],rr,rl)}"/>`;
  if(v===4) s+=`<rect class="sl" x="${r1(l)}" y="${r1(rb)}" width="${r1(r-l)}" height="1.2"/>`;
  s+=prism(r+D*.35-2, rb-DD*.35-3, 3.4, 7,'ch','ch2','ch2',2.4,1.7);
  let ln=''; for(let k=1;k<4;k++){ const f=k/4; ln+=`M${r1(l+(rl[0]-l)*f)} ${r1(rb+(rl[1]-rb)*f)}L${r1(r+(rr[0]-r)*f)} ${r1(rb+(rr[1]-rb)*f)}`; }
  s+=`<path class="rfl" d="${ln}"/>`;
  if(v===0&&lv>=3){ // güneş enerjisi paneli + depo
    const vx=rl[0]-l, vy=rl[1]-rb, a=[l+10+vx*.12, rb+vy*.12], f=.5;
    s+=`<polygon class="solf" points="${P(a,[a[0]+14,a[1]],[a[0]+14+vx*f,a[1]+vy*f],[a[0]+vx*f,a[1]+vy*f])}"/>`;
    s+=`<polygon class="sol" points="${P([a[0]+.8,a[1]-.6],[a[0]+13.2,a[1]-.6],[a[0]+13.2+vx*(f-.06),a[1]+vy*(f-.06)],[a[0]+.8+vx*(f-.06),a[1]+vy*(f-.06)])}"/>`;
    s+=`<rect class="tk" x="${r1(a[0]+vx*f)}" y="${r1(a[1]+vy*f-3.4)}" width="14" height="3.6" rx="1.8"/>`;
  }
  if(v===0&&lv>=4){ const cx=r+D-4, cy=rb-DD-2; s+=`<path class="rl" d="M${r1(cx)} ${r1(cy)}l2 3"/><ellipse class="tk" cx="${r1(cx)}" cy="${r1(cy)}" rx="2.4" ry="3.2" transform="rotate(-25 ${r1(cx)} ${r1(cy)})"/>`; }
  return s;
}

function drawKafe(lv,o){
  const W=BW.kafe, x=BX('kafe'), h=H('kafe',lv), yt=Y-h, nr=o&&o.noRoof;
  let s=prism(x,Y,W,h,'f','s',nr?null:'t');
  let bk=''; for(let yy=Y-1.8;yy>yt+1;yy-=2.4) bk+=`M${x} ${r1(yy)}h${W}`;
  s+=`<path d="${bk}" stroke="var(--ln)" stroke-width=".45"/>`;
  s+=`<rect class="fr" x="${x+3}" y="${Y-11}" width="${W-16}" height="10"/><rect class="gl" x="${x+3.8}" y="${Y-10.2}" width="${W-17.6}" height="8.4"/>`;
  let mu=''; const vw=(W-16)/4; for(let k=1;k<4;k++) mu+=`M${r1(x+3+vw*k)} ${Y-11}v10`;
  s+=`<path d="${mu}" stroke="var(--fr)" stroke-width=".8"/>`;
  s+=`<rect class="fr" x="${x+W-11}" y="${Y-11}" width="8" height="11"/><rect class="dr" x="${x+W-10.3}" y="${Y-10.3}" width="6.6" height="10.3"/><rect class="gl" x="${x+W-9.3}" y="${Y-9.3}" width="4.6" height="4"/>`;
  const n=8, sw=(W+2)/n;
  for(let k=0;k<n;k++){ const a=x-1+k*sw; s+=`<polygon class="${k%2?'aw2':'aw1'}" points="${P([a,Y-14.5],[a+sw,Y-14.5],[a+sw-2,Y-9.5],[a-2,Y-9.5])}"/>`; }
  s+=`<rect class="pl2" x="${x-2}" y="${Y-3}" width="5" height="3"/><circle class="tr" cx="${x+.5}" cy="${Y-4.6}" r="2.7"/>`;
  let sd=swin(3,Y-11,8,8);
  for(let k=1;k<lv;k++){ const fb=Y-14-(k-1)*10, wy=fb-8.2;
    for(let c=0;c<3;c++) s+=win(x+5+c*16,wy,8,6.2);
    sd+=swin(4,wy,6,6.2);
  }
  s+=side(x,W,sd);
  if(!nr){
    const tx=x+W*.66, ty=yt-DD*.5;
    s+=`<rect class="tk2" x="${r1(tx)}" y="${r1(ty-5)}" width="7" height="5"/><ellipse class="tk2" cx="${r1(tx+3.5)}" cy="${r1(ty)}" rx="3.5" ry="1.4"/><ellipse class="tk" cx="${r1(tx+3.5)}" cy="${r1(ty-5)}" rx="3.5" ry="1.4"/>`;
    if(lv>=2){ const px=x+5, py=yt-2; s+=`<polygon class="sol" points="${P([px,py],[px+15,py],[px+20,py-6.5],[px+5,py-6.5])}"/><path class="mu" d="M${px+7.5} ${py}l5 -6.5"/>`; }
  }
  return s;
}

function drawDukkan(lv,o){
  const W=BW.dukkan, x=BX('dukkan'), h=H('dukkan',lv), yt=Y-h, nr=o&&o.noRoof;
  let s=prism(x,Y,W,h,'f','s',nr?null:'t');
  if(lv>1){ let pj=''; for(let k=1;k<4;k++) pj+=`M${r1(x+W*k/4)} ${r1(yt)}V${Y-15}`; s+=`<path d="${pj}" stroke="var(--ln)" stroke-width=".6"/>`; }
  s+=`<rect class="sg" x="${x}" y="${Y-15}" width="${W}" height="4"/>`;
  s+=`<rect class="fr" x="${x+2}" y="${Y-11}" width="${W-4}" height="11"/><rect class="gl" x="${x+2.8}" y="${Y-10.2}" width="${W-5.6}" height="10.2"/>`;
  const bw=(W-4)/4; let vm=''; for(let k=1;k<4;k++) vm+=`M${r1(x+2+bw*k)} ${Y-11}v11`;
  s+=`<path d="${vm}" stroke="var(--fr)" stroke-width=".9"/>`;
  s+=`<rect class="shut" x="${x+2.5}" y="${Y-10.6}" width="${r1(bw-.6)}" height="6.2"/>`;
  let sl=''; for(let yy=Y-9.8;yy<Y-4.6;yy+=1.1) sl+=`M${x+2.5} ${r1(yy)}h${r1(bw-.6)}`; s+=`<path class="shl" d="${sl}"/>`;
  let sd=`<rect class="sg" x="0" y="${Y-15}" width="${D}" height="4"/>`+swin(3,Y-10,8,8);
  for(let k=1;k<lv;k++){ const fb=Y-15-(k-1)*10, wy=fb-7.4;
    s+=`<rect class="fr" x="${x+3}" y="${r1(wy)}" width="${W-6}" height="5.4"/><rect class="gl" x="${x+3.7}" y="${r1(wy+.7)}" width="${W-7.4}" height="4"/>`;
    let m=''; for(let c=1;c<6;c++) m+=`M${r1(x+3+(W-6)*c/6)} ${r1(wy)}v5.4`; s+=`<path d="${m}" stroke="var(--fr)" stroke-width=".7"/>`;
    sd+=`<rect class="fr" x="2" y="${r1(wy)}" width="${D-4}" height="5.4"/><rect class="gl2" x="2.7" y="${r1(wy+.7)}" width="${D-5.4}" height="4"/>`;
  }
  s+=side(x,W,sd);
  if(!nr){
    s+=prism(x+W*.58, yt-DD*.4, 6, 3.5,'ac','tk2','tk',4,2.8);
    if(lv>=2) s+=prism(x+W*.34, yt-DD*.7, 5, 3,'ac','tk2','tk',4,2.8);
    if(lv>=3){ const bx=x+3, by=yt-1.5;
      s+=`<rect class="pst" x="${bx+4}" y="${r1(by-9)}" width="1.3" height="9"/><rect class="pst" x="${bx+17}" y="${r1(by-9)}" width="1.3" height="9"/>`
        +`<rect class="bb" x="${bx}" y="${r1(by-19)}" width="23" height="11" rx=".8"/><rect class="fr" x="${bx+2.5}" y="${r1(by-16.5)}" width="18" height="1.8" opacity=".75"/><rect class="fr" x="${bx+2.5}" y="${r1(by-13.2)}" width="11" height="1.8" opacity=".75"/>`; }
  }
  return s;
}

function drawOfis(lv,o){
  const W=BW.ofis, x=BX('ofis'), h=H('ofis',lv), yt=Y-h, nr=o&&o.noRoof;
  let s=prism(x,Y,W,h,'f','s',nr?null:'t');
  s+=`<polygon class="rfx" points="${P([x,yt+h*.25],[x+W*.4,yt],[x+W*.72,yt],[x,yt+h*.62])}"/>`;
  let m=''; for(let xx=x+6;xx<x+W-1;xx+=6) m+=`M${xx} ${r1(yt)}V${Y-8}`; for(let yy=Y-8;yy>yt+.5;yy-=6) m+=`M${x} ${yy}h${W}`;
  s+=`<path class="mu" d="${m}"/>`;
  let sm=''; for(let u=4.7;u<D;u+=4.7) sm+=`M${r1(u)} ${r1(yt)}V${Y-8}`; for(let yy=Y-8;yy>yt+.5;yy-=6) sm+=`M0 ${yy}h${D}`;
  s+=`<rect class="lb" x="${x}" y="${Y-8}" width="${W}" height="8"/><rect class="gl" x="${x+W/2-5}" y="${Y-6.5}" width="10" height="6.5"/><rect class="fr" x="${x+W/2-.3}" y="${Y-6.5}" width=".6" height="6.5"/><rect class="sl" x="${x-2}" y="${Y-8.8}" width="${W+4}" height="1.4"/>`;
  s+=side(x,W,`<path class="mu" d="${sm}"/><rect class="lb" x="0" y="${Y-8}" width="${D}" height="8"/>`);
  if(!nr){
    s+=prism(x+5, yt-DD*.3, W-12, 4,'t','s','tk',D-5,(D-5)*TAN);
    if(lv>=3) s+=`<path class="rl" d="M${r1(x+W/2+4)} ${r1(yt-8)}v-${4+lv*1.5}"/>`;
    if(lv>=5) s+=`<ellipse fill="none" stroke="var(--haz)" stroke-width=".9" cx="${r1(x+W/2+4.5)}" cy="${r1(yt-8.6)}" rx="5.5" ry="2"/>`;
  }
  return s;
}

const DRAW={ev:drawEv,kafe:drawKafe,dukkan:drawDukkan,ofis:drawOfis};
export function bld(t?:any,lv?:any,v?:any){ return shadow(t)+DRAW[t](lv,{v:v==null?DMAP[S.cur].v:v}); }

function skeleton(t,yb,h){
  const x=BX(t), W=BW[t], fh=FH[t]; let s=prism(x,yb,W,h,'in','in2',null);
  const cols=t==='ofis'?[0,W/2-1,W-2]:[0,W/3-1,2*W/3-1,W-2];
  for(const c of cols) s+=`<rect class="cn" x="${r1(x+c)}" y="${r1(yb-h)}" width="2" height="${r1(h)}"/>`;
  let sd=`<rect class="cn" x="${D-2}" y="${r1(yb-h)}" width="2" height="${r1(h)}"/>`;
  for(let k=fh;k<=h+.01;k+=fh){ const yy=yb-k; s+=`<rect class="cn" x="${r1(x)}" y="${r1(yy)}" width="${W}" height="1.8"/>`; sd+=`<rect class="cn" x="0" y="${r1(yy)}" width="${D}" height="1.8"/>`; }
  s+=side(x,W,sd);
  const full=Math.floor(h/fh+1e-6)*fh;
  if(full>0){ const yy=yb-full; s+=`<polygon class="sl" points="${P([x,yy],[x+W,yy],[x+W+D,yy-DD],[x+D,yy-DD])}"/>`; }
  return s;
}
function scaffold(t,yb,h){
  const x=BX(t)-2.5, W=BW[t]+5; let p='';
  for(let k=0;k<=4;k++) p+=`M${r1(x+W*k/4)} ${r1(yb+1)}V${r1(yb-h-3)}`;
  for(let yy=yb-1;yy>yb-h-3;yy-=5) p+=`M${r1(x)} ${r1(yy)}h${r1(W)}`;
  p+=`M${r1(x)} ${r1(yb-1)}L${r1(x+W/4)} ${r1(Math.max(yb-h-3,yb-11))}`;
  return `<rect class="net" x="${r1(x)}" y="${r1(yb-h-3)}" width="${r1(W)}" height="${r1(Math.max(2,h*.55))}"/><path class="sc" d="${p}"/>`;
}
function crane(t,topY){
  const x=BX(t), W=BW[t], mx=x+W+D+3, top=Math.max(3,topY-14), jl=x+2, base=Y+1, hx=x+W*.35;
  let z=''; for(let yy=base;yy>top+3;yy-=3) z+=`M${r1(mx-1.4)} ${r1(yy)}L${r1(mx+1.4)} ${r1(yy-1.5)}L${r1(mx-1.4)} ${r1(yy-3)}`;
  let j=''; for(let xx=mx-2;xx>jl+3;xx-=3) j+=`M${r1(xx)} ${r1(top)}L${r1(xx-1.5)} ${r1(top+2)}L${r1(xx-3)} ${r1(top)}`;
  return `<path class="cr" d="M${r1(mx-1.4)} ${base}V${r1(top)}M${r1(mx+1.4)} ${base}V${r1(top)}${z}M${r1(mx+1.4)} ${r1(top)}H${r1(jl)}M${r1(mx+1.4)} ${r1(top+2)}H${r1(jl)}${j}M${r1(mx)} ${r1(top)}v-4L${r1(jl+8)} ${r1(top)}M${r1(mx)} ${r1(top-4)}L${r1(mx+8)} ${r1(top)}"/>`
    +`<rect class="cw" x="${r1(mx+3)}" y="${r1(top)}" width="5" height="3.8"/><rect class="crf" x="${r1(mx-2.8)}" y="${r1(top+2)}" width="4" height="3.2"/>`
    +`<path class="hook" d="M${r1(hx)} ${r1(top+2)}V${r1(top+11)}"/><rect class="cn" x="${r1(hx-3)}" y="${r1(top+11)}" width="6" height="2"/>`;
}
function barrier(t){
  const x=BX(t)-4, W=BW[t]+D+8, y=Y+3;
  let s=`<rect class="pst" x="${r1(x)}" y="${y-1}" width="1.2" height="5"/><rect class="pst" x="${r1(x+W-1.2)}" y="${y-1}" width="1.2" height="5"/>`;
  for(let k=0;k<W;k+=3) s+=`<rect class="${(k/3)%2<1?'hz':'hk'}" x="${r1(x+k)}" y="${y}" width="${r1(Math.min(3,W-k))}" height="2.2"/>`;
  return s;
}
export function site(t?:any,from?:any,to?:any,prog?:any,v?:any){ v=v==null?DMAP[S.cur].v:v;
  const h0=H(t,from), h1=H(t,to), hb=Math.max(h0+2,h0+(h1-h0)*prog), x=BX(t), W=BW[t];
  let s=shadow(t);
  s+=`<path class="gh" d="M${r1(x)} ${r1(Y-h1)}h${W}l${D} ${-DD}h${-W}zM${r1(x+W)} ${r1(Y-h1)}V${Y}M${r1(x+W+D)} ${r1(Y-h1-DD)}V${Y-DD}"/>`;
  if(from>0) s+=DRAW[t](from,{noRoof:true,v});
  s+=skeleton(t,Y-h0,hb-h0)+scaffold(t,Y-h0,hb-h0)+crane(t,Y-h1)+barrier(t);
  return s;
}
export function emptyLot(i){
  const r=k=>{ const v=Math.sin((i+1)*(k+3)*12.9898)*43758.5453; return v-Math.floor(v); };
  let s=`<rect class="sv" x="9" y="9" width="82" height="82"/>`;
  for(let k=0;k<16;k++) s+=`<circle class="gv" cx="${r1(14+r(k+20)*72)}" cy="${r1(14+r(k+40)*72)}" r="${r1(.6+r(k+60)*.9)}"/>`;
  for(const [a,b] of [[9,9],[91,9],[9,91],[91,91]]) s+=`<rect class="pst" x="${a-.9}" y="${b-4}" width="1.8" height="5"/><rect class="stk" x="${a-.9}" y="${b-5.5}" width="1.8" height="2.2"/>`;
  if(r(4)<.5){ const cx=20+r(5)*22, cy=30+r(6)*40, rr=7+r(7)*4;
    s+=`<ellipse class="sh" cx="${r1(cx+3)}" cy="${r1(cy+rr*.8)}" rx="${r1(rr)}" ry="${r1(rr*.45)}"/><circle class="tr2" cx="${r1(cx)}" cy="${r1(cy)}" r="${r1(rr)}"/><circle class="tr" cx="${r1(cx-rr*.18)}" cy="${r1(cy-rr*.22)}" r="${r1(rr*.78)}"/>`; }
  if(r(1)<.45){ const sx=58+r(2)*14, sy=44+r(3)*22;
    s+=`<rect class="pst" x="${r1(sx+6.2)}" y="${r1(sy)}" width="1.6" height="16"/><rect class="sgn" x="${r1(sx)}" y="${r1(sy-11)}" width="14" height="11" rx=".8"/>`
      +`<rect class="sgw" x="${r1(sx+1.6)}" y="${r1(sy-9.4)}" width="10.8" height="7.8"/><rect fill="#fff" x="${r1(sx+3.5)}" y="${r1(sy-7.2)}" width="7" height="1.4"/><rect fill="#fff" x="${r1(sx+3.5)}" y="${r1(sy-4.6)}" width="4.5" height="1.4"/>`; }
  return s;
}
export const svg=(inner?:any,cls?:any)=>`<svg class="${cls||''}" viewBox="0 0 100 100"${cls==='art'?' preserveAspectRatio="xMidYMax meet"':''} aria-hidden="true">${inner}</svg>`;
