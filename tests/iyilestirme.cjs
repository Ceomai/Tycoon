// İYİLEŞTİRME TESTİ (hata düzeltmeleri): otomatik toplama (OTO) açıkken açık panel her tick yeniden yazılmamalı,
// semt satırı ve görev "Al" düğmesi basılı tutulan dokunuşla (180 ms) çalışmalı; canlı sayılar yine güncel kalmalı.
// Çalıştır: npm run test:iy  (önizleme paketi dist-preview/index.html; Playwright gerekir)
const {chromium}=require('playwright');
const path=require('path');
const URL='file://'+path.resolve(__dirname,'../dist-preview/index.html');
const PREF="if(!localStorage.getItem('tapu-prefs'))localStorage.setItem('tapu-prefs',JSON.stringify({lang:'tr',region:'tr',ent:{},news:true}));";
const results=[]; const ok=(c,m)=>{ results.push({name:m,pass:!!c}); console.log(c?'  ✓':'  ✗',m); };
const S=p=>p.evaluate(()=>JSON.parse(JSON.stringify(window.__tapuState())));
const has=(p,sel)=>p.isVisible(sel).catch(()=>false);

async function open(b){
  const ctx=await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});
  await ctx.addInitScript(PREF);
  const p=await ctx.newPage(); p.errs=[]; p.on('pageerror',e=>p.errs.push(e.message));
  await p.clock.install(); await p.goto(URL); await p.clock.runFor(700);
  await p.click('#modal .cityopt[data-a="ist"]',{force:true}); await p.clock.runFor(400);
  for(let k=0;k<5&&await has(p,'#modal .card');k++){ await p.click('#modal .card [data-a]',{force:true}); await p.clock.runFor(400); }
  // OTO modu, iki semt (biri kaporalı: borç kiradan canlı ödenir), bitmiş bir görev ve sürekli ilerleyen "kira kazan" görevi
  await p.evaluate(()=>{ const S=window.__tapuState(); const T=['ev','kafe','dukkan','ofis'];
    const fill=lv=>Array.from({length:20},(_,i)=>({t:T[i%4],lvl:lv,buf:0,until:0,dur:1,up:false}));
    S.d['ist-0']=fill(3); S.d['ist-1']=fill(2); S.own=['ist-0','ist-1']; S.lien={'ist-1':1e9}; S.lienT={'ist-1':1e9};
    S.collectMode='auto'; S.cash=10; S.nextEvent=9e12; S.nextOffer=9e12; S.nextCivic=9e12; S.nextAd=9e12; S.collects=0; S.market='x'; S.rifki=false; S.guideHint=true;
    S.starter={at:1,bought:true}; S.offer=null;
    const d=new Date(); const day=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
    S.daily={last:day,streak:1};
    S.tasks={day:S.tasks?S.tasks.day:day,bonus:false,list:[{k:'build',goal:2,prog:2,claimed:false},{k:'earn',goal:1e15,prog:0,claimed:false},{k:'taxi',goal:1,prog:0,claimed:false}]}; });
  await p.clock.runFor(1500);
  for(let k=0;k<5&&await has(p,'#modal .card');k++){ await p.click('#modal .card [data-a]',{force:true}); await p.clock.runFor(400); }
  return p;
}
/** #sheetBody'nin innerHTML ile yeniden yazılma sayısı (MutationObserver). */
async function watchWrites(p){ await p.evaluate(()=>{ window.__w=0; const o=new MutationObserver(r=>{ window.__w+=r.length; }); o.observe(document.querySelector('#sheetBody'),{childList:true}); window.__wo=o; }); }
const writes=p=>p.evaluate(()=>{ window.__wo.disconnect(); return window.__w; });
/** Basılı tutulan dokunuş: aşağı → 180 ms (oyun döngüsü işlemeye devam eder) → yukarı. */
async function hold(p,sel){
  const el=p.locator(sel).first(); await el.scrollIntoViewIfNeeded(); const bb=await el.boundingBox();
  await p.mouse.move(bb.x+bb.width/2,bb.y+bb.height/2); await p.mouse.down(); await p.clock.runFor(180); await p.mouse.up(); await p.clock.runFor(400);
}

(async()=>{
  const b=await chromium.launch();

  console.log('1) Semtler paneli · OTO modu');
  let p=await open(b);
  ok((await S(p)).collectMode==='auto','OTO (otomatik toplama) açık');
  { // borç ~30 sn'lik kira payı olsun ki gösterilen (biçimlenmiş) tutar 5 sn'de belirgin değişsin
    const l0=(await S(p)).lien['ist-1']; await p.clock.runFor(1000); const l1=(await S(p)).lien['ist-1'];
    await p.evaluate(v=>{ const S=window.__tapuState(); S.lien['ist-1']=v; S.lienT['ist-1']=v*2; },Math.max(1000,(l0-l1)*30)); }
  await p.click('#mapBtn',{force:true}); await p.clock.runFor(600);
  const c0=(await S(p)).cash, d0=await p.textContent('#sheetBody [data-lv="ldist-1"]');
  await watchWrites(p); await p.clock.runFor(5000); const w=await writes(p);
  const c1=(await S(p)).cash, d1=await p.textContent('#sheetBody [data-lv="ldist-1"]');
  ok(c1>c0,'kasa OTO ile her tick artıyor ('+Math.round(c0)+' → '+Math.round(c1)+')');
  ok(w<=1,'5 sn içinde panel yeniden yazılma sayısı: '+w+' (≤ 1)');
  ok(d0&&d1&&d0!==d1,'kaporalı semtin kalan borcu yine canlı güncelleniyor ('+d0+' → '+d1+')');
  await hold(p,'#sheetBody .drow[data-a="go"][data-k="ist-1"]');
  ok((await S(p)).cur==='ist-1','semt satırı 180 ms basılı tutunca semt değişti');
  ok(!p.errs.length,'konsol temiz'+(p.errs.length?' ['+p.errs.slice(0,2).join('|')+']':''));
  await p.context().close();

  console.log('2) Görevler paneli · OTO modu');
  p=await open(b);
  await p.click('#taskBtn',{force:true}); await p.clock.runFor(600);
  const e0=(await S(p)).tasks.list[1].prog, t0=await p.textContent('#sheetBody [data-lv="tp1"]');
  await watchWrites(p); await p.clock.runFor(5000); const w2=await writes(p);
  const e1=(await S(p)).tasks.list[1].prog, t1=await p.textContent('#sheetBody [data-lv="tp1"]');
  ok(e1>e0,'"kira kazan" görevi her tick ilerliyor');
  ok(w2<=1,'5 sn içinde panel yeniden yazılma sayısı: '+w2+' (≤ 1)');
  ok(t0!==t1,'görev ilerleme yazısı yine canlı güncelleniyor ('+t0+' → '+t1+')');
  await hold(p,'#sheetBody [data-a="claim"][data-i="0"]');
  ok((await S(p)).tasks.list[0].claimed===true,'görev "Al" düğmesi 180 ms basılı tutunca ödül alındı');
  ok(!p.errs.length,'konsol temiz'+(p.errs.length?' ['+p.errs.slice(0,2).join('|')+']':''));
  await p.context().close();

  await b.close();
  const pass=results.filter(r=>r.pass).length;
  console.log(`\nSONUÇ: ${pass}/${results.length} geçti`);
  process.exit(pass===results.length?0:1);
})().catch(e=>{ console.error(e); process.exit(1); });
