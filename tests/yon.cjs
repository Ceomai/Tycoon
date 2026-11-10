// Ekran yönü testi (tasarım E0–E7): dikey/yatay telefon ve tablet boyutları, oyun sırasında döndürme, panel/kart sığması, dokunma.
// Çalıştır: npm run test:yon (önizleme paketi; Playwright)
const {chromium}=require('playwright'); const fs=require('fs');
const { serve, out, PREF } = require('./helpers.cjs');
let URL; // http://127.0.0.1:<port>/index.html — main başında serve() ile
const OUT=out+'yon-';
const rows=[]; const rec=(o)=>{ rows.push(o); console.log((o.ok?'  ✓ ':'  ✗ ')+o.name+(o.ok?'':'  → '+o.why)); };
const DEV=[['iPhone SE',320,568],['Galaxy S8',360,740],['iPhone 13',390,844],['Pixel 7',412,915],['iPhone Pro Max',430,932],['iPad mini',744,1133],['iPad',820,1180]];
async function setup(b,w,h,lang='tr'){ const ctx=await b.newContext({viewport:{width:w,height:h},hasTouch:true,isMobile:true,deviceScaleFactor:2});
  await ctx.addInitScript(PREF.replace("lang:'tr'",`lang:'${lang}'`));
  const p=await ctx.newPage(); p.errs=[]; p.on('pageerror',e=>p.errs.push(e.message)); await p.clock.install(); await p.goto(URL); await p.clock.runFor(700); await p.waitForTimeout(300);
  await p.click('#modal .cityopt[data-a="ist"]',{force:true}); await p.clock.runFor(400); await p.waitForTimeout(300);
  for(let k=0;k<4;k++) if(await p.isVisible('#modal .card')){ await p.click('#modal .card [data-a]',{force:true}); await p.waitForTimeout(300); }
  await p.evaluate(()=>{ const S=window.__tapuState(); const T=['ev','kafe','dukkan','ofis']; S.d['ist-0']=Array.from({length:20},(_,i)=>i<14?{t:T[i%4],lvl:1+(i%3),buf:20,until:0,dur:1,up:false}:null); S.nextEvent=9e12; S.nextOffer=9e12; S.nextCivic=9e12; S.collects=50; S.market='x'; S.rifki=false; S.guideHint=true; const d=new Date(); S.daily={last:d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'),streak:1}; S.tasks=null; });
  await p.clock.runFor(1500); for(let k=0;k<4;k++) if(await p.isVisible('#modal .card')){ await p.click('#modal .card [data-a]',{force:true}); await p.waitForTimeout(300); }
  return p; }
async function measure(p){ return p.evaluate(()=>{ const R=e=>e?e.getBoundingClientRect():null; const hit=(a,b)=>a&&b&&!(a.right<=b.left+1||a.left>=b.right-1||a.bottom<=b.top+1||a.top>=b.bottom-1);
  const lots=[...document.querySelectorAll('.lot')].map(R); const dock=R(document.querySelector('.dock')), top=R(document.querySelector('.top')), guide=R(document.querySelector('#guideBtn'));
  const dockBtns=[...document.querySelectorAll('.dock button')].map(R);
  const W=innerWidth,H=innerHeight;
  return {W,H,sw:document.documentElement.scrollWidth-W, sh:document.documentElement.scrollHeight-H,
    lotDock:lots.some(l=>dockBtns.some(d=>hit(l,d))), lotTop:lots.some(l=>hit(l,top)), lotGuide:lots.some(l=>hit(l,guide)), lotOverlap:lots.some((l,i)=>lots.some((m,j)=>j>i&&hit(l,m))),
    outside:lots.some(l=>l.left<-1||l.top<-1||l.right>W+1||l.bottom>H+1), dockOut:dockBtns.some(d=>d.left<-1||d.top<-1||d.right>W+1||d.bottom>H+1),
    lotW:Math.round(Math.min(...lots.map(r=>r.width))), lotH:Math.round(Math.min(...lots.map(r=>r.height)))}; }); }
function judge(name,m){ const why=[];
  if(m.sw>0) why.push('yatay taşma '+m.sw+'px'); if(m.sh>2) why.push('dikey taşma '+m.sh+'px');
  if(m.lotDock) why.push('arsa, alt çubuk düğmelerinin altında kalıyor'); if(m.lotTop) why.push('arsa, üst bilgiye biniyor'); if(m.lotGuide) why.push('kılavuz sekmesi arsaya biniyor');
  if(m.lotOverlap) why.push('arsalar üst üste'); if(m.outside) why.push('arsa ekran dışında'); if(m.dockOut) why.push('düğme ekran dışında');
  if(Math.min(m.lotW,m.lotH)<24) why.push('arsa çok küçük ('+m.lotW+'×'+m.lotH+')');
  rec({name:name+' · arsa '+m.lotW+'×'+m.lotH,ok:!why.length,why:why.join('; '),m}); }
async function sheetsFit(p,label){ for(const a of ['map','menu','set','store','sezon','guide']){
    if(a==='map') await p.click('#mapBtn',{force:true}); else if(a==='guide') await p.click('#guideBtn',{force:true}); else { await p.click('#menuBtn',{force:true}); await p.waitForTimeout(350); if(a!=='menu') await p.click(`#sheet [data-a="${a}"]`,{force:true}); }
    await p.clock.runFor(300); await p.waitForTimeout(400);
    const r=await p.evaluate(()=>{ const s=document.querySelector('#sheet').getBoundingClientRect(), b=document.querySelector('#sheetBody'); const over=[...b.querySelectorAll('*')].filter(e=>{const x=e.getBoundingClientRect(); return x.width>0&&x.right>innerWidth+1;}).length;
      return {top:Math.round(s.top),h:Math.round(s.height),H:innerHeight,scroll:b.scrollHeight>b.clientHeight+2,bodyH:b.clientHeight,over}; });
    const why=[]; if(r.top<0) why.push('panel ekranın üstünden taşıyor'); if(r.over) why.push(r.over+' öğe sağa taşıyor'); if(r.bodyH<120) why.push('içerik alanı çok kısa ('+r.bodyH+'px)');
    rec({name:`${label} · ${a} paneli`,ok:!why.length,why:why.join('; '),m:r});
    await p.keyboard.press('Escape'); await p.clock.runFor(300); await p.waitForTimeout(400); }
  // kart (modal): günlük ödül kartını zorla
  await p.evaluate(()=>{ window.__tapuState().daily={last:'2000-01-01',streak:0}; }); await p.clock.runFor(4000); await p.waitForTimeout(400);
  const c=await p.evaluate(()=>{ const e=document.querySelector('#modal .card'); if(!e) return null; const r=e.getBoundingClientRect(); const btn=e.querySelector('.btns'); const br=btn?btn.getBoundingClientRect():r; return {top:Math.round(r.top),bottom:Math.round(r.bottom),H:innerHeight,btnBottom:Math.round(br.bottom),scroll:e.scrollHeight>e.clientHeight+2}; });
  if(c){ const why=[]; if(c.top<0) why.push('kart üstten taşıyor'); if(c.btnBottom>c.H && !c.scroll) why.push('kart düğmeleri ekran dışında ve kaydırılamıyor'); rec({name:`${label} · kart (günlük ödül)`,ok:!why.length,why:why.join('; '),m:c}); await p.click('#modal .card .txt',{force:true}).catch(()=>{}); await p.waitForTimeout(300); }
}
(async()=>{ const b=await chromium.launch(); URL=await serve();
 console.log('1) Dikey ve yatay boyutlar');
 for(const [n,w,h] of DEV){ for(const [o,W,H] of [['dikey',w,h],['yatay',h,w]]){ const p=await setup(b,W,H); const m=await measure(p); judge(`${n} ${o} ${W}×${H}`,m); if(o==='yatay'&&['iPhone 13','iPad'].includes(n)) await p.screenshot({path:OUT+`${n.replace(/ /g,'')}-${o}.png`}); await p.context().close(); } }
 console.log('2) Oyun sırasında döndürme (dikey → yatay → dikey), durum ve dokunma');
 for(const [n,w,h] of [['iPhone 13',390,844],['Pixel 7',412,915],['iPad',820,1180]]){
   const p=await setup(b,w,h); for(let k=0;k<4;k++) if(await p.isVisible('#modal .card')){ await p.click('#modal .card [data-a]',{force:true}); await p.waitForTimeout(300); }
   const s0=await p.evaluate(()=>JSON.stringify(window.__tapuState().d['ist-0']));
   await p.setViewportSize({width:h,height:w}); await p.waitForTimeout(500); await p.clock.runFor(500); judge(`${n} döndürüldü → yatay`,await measure(p));
   await p.click('.lot[data-i="15"]',{force:true}).catch(()=>{}); await p.clock.runFor(400); await p.waitForTimeout(500); rec({name:`${n} yatayda arsa paneli açılıyor`,ok:await p.isVisible('#sheet.on'),why:'panel açılmadı'}); await p.keyboard.press('Escape'); await p.waitForTimeout(400);
   const c0=await p.evaluate(()=>window.__tapuState().cash); await p.click('#collectBtn',{force:true}).catch(()=>{}); await p.waitForTimeout(400);
   rec({name:`${n} yatayda TOPLA çalışıyor`,ok:(await p.evaluate(()=>window.__tapuState().cash))>c0,why:'kasa artmadı'});
   await p.setViewportSize({width:w,height:h}); await p.waitForTimeout(500); await p.clock.runFor(500); judge(`${n} geri döndürüldü → dikey`,await measure(p));
   const s1=await p.evaluate(()=>JSON.stringify(window.__tapuState().d['ist-0'].map(q=>q&&{t:q.t,lvl:q.lvl})));
   rec({name:`${n} döndürmede oyun durumu korunuyor`,ok:JSON.parse(s1).filter(Boolean).length===14,why:'arsalar değişti'});
   rec({name:`${n} konsol temiz`,ok:p.errs.length===0,why:p.errs.slice(0,2).join('|')}); await p.context().close(); }
 console.log('3) Paneller ve kartlar: dikey ve yatay');
 for(const [n,w,h] of [['iPhone SE',320,568],['iPhone 13',390,844]]){ for(const [o,W,H] of [['dikey',w,h],['yatay',h,w]]){ const p=await setup(b,W,H); await sheetsFit(p,`${n} ${o}`); if(o==='yatay'&&n==='iPhone 13'){ await p.click('#mapBtn',{force:true}); await p.waitForTimeout(500); await p.screenshot({path:OUT+'harita-yatay.png'}); } await p.context().close(); } }
 console.log('4) Uzun dil (Almanca) yatayda');
 { const p=await setup(b,844,390,'de'); judge('Almanca iPhone 13 yatay',await measure(p)); await p.screenshot({path:OUT+'de-yatay.png'}); await p.context().close(); }

 console.log('5) Yatayda kılavuz düğmesi (yatay, sol alt) ve arsa panelinde 4 bina kartı');
 for(const [n,W,H] of [['iPhone SE',568,320],['iPhone 13',844,390],['Pixel 7',915,412],['iPad',1180,820]]){
   const p=await setup(b,W,H);
   const g=await p.evaluate(()=>{ const R=e=>e.getBoundingClientRect(); const hit=(a,b)=>!(a.right<=b.left+1||a.left>=b.right-1||a.bottom<=b.top+1||a.top>=b.bottom-1);
     const gb=R(document.querySelector('#guideBtn')), l=document.querySelector('#guideBtn .l'); const lots=[...document.querySelectorAll('.lot')].map(R); const btns=[...document.querySelectorAll('.dock button, #distBar')].map(R);
     return {horiz:gb.width>gb.height, left:gb.left<innerWidth*0.35, bottom:gb.bottom>innerHeight*0.7, wm:getComputedStyle(l).writingMode, hit:lots.concat(btns).some(r=>hit(gb,r))}; });
   rec({name:`${n} yatay ${W}×${H}: kılavuz düğmesi yatay ve sol altta`,ok:g.horiz&&g.left&&g.bottom&&g.wm==='horizontal-tb'&&!g.hit,why:JSON.stringify(g)});
   await p.click('.lot[data-i="16"]',{force:true}); await p.clock.runFor(400); await p.waitForTimeout(600);
   const c=await p.evaluate(()=>{ const cs=[...document.querySelectorAll('#sheet .bcard')].map(e=>e.getBoundingClientRect()); return {n:cs.length, allIn:cs.every(r=>r.top>=-1&&r.bottom<=innerHeight+1), maxBottom:Math.round(Math.max(...cs.map(r=>r.bottom))), H:innerHeight}; });
   rec({name:`${n} yatay: arsa panelinde ${c.n} bina kartının hepsi tek ekranda`,ok:c.n===4&&c.allIn,why:JSON.stringify(c)});
   if(n==='iPhone 13') await p.screenshot({path:OUT+'arsa-yatay.png'});
   await p.context().close(); }
 const f=rows.filter(r=>!r.ok); console.log(`\nSONUÇ: ${rows.length-f.length}/${rows.length} geçti`); fs.writeFileSync(OUT+'sonuc.json',JSON.stringify(rows,null,1)); await b.close(); process.exit(f.length?1:0);
})().catch(e=>{ console.error('ÇÖKTÜ',e); process.exit(2); });
