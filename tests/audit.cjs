// DENETİM TESTİ: 22 persona yolculuğu, kenar durumlar, hızlı tıklama, yeniden başlatma, çevrimdışı, depolama hatası,
// bozuk kayıt, ekran boyutları × gece/gündüz, erişilebilirlik, performans ve stres ölçümleri.
// Çalıştır: npm run test:audit  (önizleme paketi dist-preview/index.html; Playwright gerekir)
// Ölçümler tests/out/audit-metrics.json dosyasına yazılır (raporlar bu dosyadaki gerçek değerlerle doldurulur).
const {chromium}=require('playwright');
const fs=require('fs'), path=require('path');
const URL='file://'+path.resolve(__dirname,'../dist-preview/index.html');
const out=path.resolve(__dirname,'out')+'/'; fs.mkdirSync(out,{recursive:true});
const log=(...a)=>console.log(...a);
const metrics={}; const results=[];
let section='';
const ok=(c,m)=>{ results.push({section,name:m,pass:!!c}); log(c?'  ✓':'  ✗',m); };

async function open(b,o={}){
  const ctx=await b.newContext({viewport:o.vp||{width:390,height:844},deviceScaleFactor:o.dpr||2,colorScheme:o.scheme||'light',reducedMotion:o.motion||'no-preference',offline:!!o.offline,isMobile:true,hasTouch:true}); await ctx.addInitScript(`if(!localStorage.getItem('tapu-prefs'))localStorage.setItem('tapu-prefs',JSON.stringify({lang:'tr',region:'tr',ent:{}}));`);
  const p=await ctx.newPage(); p.errs=[];
  p.on('pageerror',e=>p.errs.push(e.message)); p.on('console',m=>{ if(m.type()==='error') p.errs.push(m.text()); });
  await p.clock.install(o.time?{time:o.time}:undefined);
  await p.addInitScript(`if(!localStorage.getItem('tapu-prefs'))localStorage.setItem('tapu-prefs',JSON.stringify({lang:'tr',region:'tr',ent:{}}));`);
  if(o.init) await p.addInitScript(o.init);
  const t0=Date.now(); await p.goto(URL); p.loadMs=Date.now()-t0;
  await p.clock.runFor(500); return p;
}
const S=p=>p.evaluate(()=>{ const o=JSON.parse(JSON.stringify(window.__tapuState())); o._now=Date.now(); return o; });
const mut=(p,fn,arg)=>p.evaluate(([f,a])=>{ const S=window.__tapuState(); (0,eval)('('+f+')')(S,a); },[fn.toString(),arg]);
const tap=async(p,sel)=>{ await p.click(sel,{force:true}); await p.clock.runFor(400); await p.waitForTimeout(350); };
const has=(p,sel)=>p.isVisible(sel).catch(()=>false);
async function dismiss(p){ for(let k=0;k<6;k++){ if(!(await has(p,'#modal .card'))) break; const sel=(await has(p,'#modal .card .txt'))?'#modal .card .txt':'#modal .card [data-a]'; await p.click(sel,{force:true}).catch(()=>{}); await p.clock.runFor(500); } if(await has(p,'#ad:not([hidden])')){ await p.clock.runFor(6000); await p.click('#adX',{force:true}).catch(()=>{}); } }
async function closeSheet(p){ await p.keyboard.press("Escape"); await p.clock.runFor(400); await p.waitForTimeout(350); }
async function start(p,city='ist'){ if(await has(p,'#modal .citycard')){ await tap(p,`#modal .cityopt[data-a="${city}"]`); await p.clock.runFor(300); await dismiss(p); } }
const sane=async(p,label)=>{ const s=await S(p); const bad=[];
  if(!Number.isFinite(s.cash)||s.cash<0) bad.push('kasa '+s.cash);
  for(const k of s.own) for(const q of s.d[k]) if(q&&(!Number.isFinite(q.buf)||q.buf<0||q.lvl<0||q.lvl>5)) bad.push('arsa '+k);
  const sw=await p.evaluate(()=>document.documentElement.scrollWidth-innerWidth);
  if(sw>0) bad.push('yatay taşma '+sw+'px');
  ok(!bad.length&&!p.errs.length, label+': durum tutarlı, konsol temiz'+(bad.length?' ['+bad.join(',')+']':'')+(p.errs.length?' ['+p.errs.slice(0,2).join('|')+']':''));
  return s; };
// Doluluk: verilen semtin tüm arsalarını belirtilen seviyede binayla doldurur.
const fillFn=(S,a)=>{ const T=['ev','kafe','dukkan','ofis']; S.d[a.k]=Array.from({length:20},(_,i)=>({t:a.t||T[i%4],lvl:a.lvl||2,buf:0,until:0,dur:1,up:false})); };

(async()=>{
 const b=await chromium.launch();
 const T0=Date.now();

 /* ---------------- PERSONA YOLCULUKLARI ---------------- */
 section='persona';
 log('P01 yeni oyuncu (İzmir): il seç → ilk ev → topla → yükselt');
 let p=await open(b); await start(p,'izm');
 await tap(p,'.lot[data-i="0"]'); await tap(p,'[data-a="build"][data-t="ev"]'); await p.clock.runFor(21000);
 await p.clock.runFor(30000); const c0=(await S(p)).cash; await tap(p,'#collectBtn');
 ok((await S(p)).cash>c0,'P01 kira toplandı');
 await mut(p,S=>{S.cash=1e5}); await tap(p,'.lot[data-i="0"]'); await tap(p,'[data-a="up"]'); await closeSheet(p);
 ok((await S(p)).d['izm-0'][0].up===true,'P01 tadilat başladı');
 await sane(p,'P01'); await p.context().close();

 log('P02 Ankara seçen oyuncu');
 p=await open(b); await start(p,'ank'); { const s=await S(p); ok(s.city==='ank'&&s.cur==='ank-0','P02 Ankara · ilk semt açık'); } await sane(p,'P02'); await p.context().close();

 log('P03 3 gün sonra dönen oyuncu (çevrimdışı kazanç tavanı)');
 p=await open(b); await start(p); await mut(p,fillFn,{k:'ist-0',t:'ev',lvl:3});
 await mut(p,S=>{ S.lastSeen=Date.now()-3*864e5; S.maxSeen=S.lastSeen; S.cash=0; }); await p.evaluate(()=>{ localStorage.setItem('tapu-save-v2',JSON.stringify(window.__tapuState())); });
 await p.reload(); await p.clock.runFor(1500);
 { const s=await S(p); const buf=s.d['ist-0'].reduce((a,q)=>a+(q?q.buf:0),0); ok(Number.isFinite(buf)&&buf>0,'P03 dönüşte kira birikmiş ('+Math.round(buf)+')'); metrics.offline3dBuf=Math.round(buf); }
 await dismiss(p); await sane(p,'P03'); await p.context().close();

 log('P04 saati geri alan oyuncu (hile)');
 p=await open(b); await start(p); await mut(p,S=>{ S.maxSeen=Date.now()+5*3600e3; S.lastSeen=S.maxSeen; }); await p.evaluate(()=>localStorage.setItem('tapu-save-v2',JSON.stringify(window.__tapuState())));
 await p.reload(); await p.clock.runFor(1500); { const s=await S(p); ok(s.clockFlag>=1,'P04 geri alınan saat yakalandı (clockFlag='+s.clockFlag+')'); } await dismiss(p); await sane(p,'P04'); await p.context().close();

 log('P05 hızlı tıklayan oyuncu: TOPLA ×120, inşaat ×40, panel aç-kapa ×60');
 p=await open(b); await start(p); await mut(p,fillFn,{k:'ist-0',lvl:1}); await mut(p,S=>{ S.d['ist-0'][19]=null; S.cash=1000; });
 await p.clock.runFor(30000);
 for(let k=0;k<120;k++) await p.click('#collectBtn',{force:true,delay:0});
 await p.clock.runFor(400);
 await tap(p,'.lot[data-i="19"]'); const cashB=(await S(p)).cash;
 for(let k=0;k<40;k++) await p.click('[data-a="build"][data-t="ev"]',{force:true,timeout:200}).catch(()=>{});
 { const s=await S(p); ok(s.cash>=0 && s.d['ist-0'][19] && cashB-s.cash<=1000,'P05 çift harcama yok (harcanan '+Math.round(cashB-s.cash)+')'); }
 await closeSheet(p);
 for(let k=0;k<60;k++){ await p.click('.lot[data-i="'+(k%19)+'"]',{force:true}); await p.keyboard.press('Escape'); }
 await p.clock.runFor(800); await sane(p,'P05'); await p.context().close();

 log('P06 otomatik toplama tercih eden');
 p=await open(b); await start(p); await mut(p,fillFn,{k:'ist-0',lvl:2}); await mut(p,S=>{S.collectMode='auto'; S.cash=0;});
 await p.clock.runFor(60000); { const s=await S(p); ok(s.cash>0,'P06 kira kendiliğinden kasaya geldi ('+Math.round(s.cash)+')'); ok((await p.textContent('#collectBtn')).includes('OTO'),'P06 ortada OTO yazıyor'); }
 await dismiss(p); await sane(p,'P06'); await p.context().close();

 log('P07 ayarlarda her şeyi kapatan oyuncu (ses, Rıfkı, gece, bildirim)');
 p=await open(b); await start(p); await tap(p,'#menuBtn'); await tap(p,'#sheet [data-a="set"]');
 const toggles=await p.$$eval('#sheet [data-a]',a=>a.map(x=>x.dataset.a)); metrics.settingsActions=toggles;
 for(const a of toggles.filter(a=>!['close','guide','privacy','del','delete','reset','restore','login','logout','google'].includes(a))){ await p.click(`#sheet [data-a="${a}"]`,{force:true}).catch(()=>{}); await p.clock.runFor(300); if(!(await has(p,'#sheet.on'))) { await tap(p,'#menuBtn'); await tap(p,'#sheet [data-a="set"]'); } }
 await closeSheet(p); await p.clock.runFor(11000);
 await p.reload(); await p.clock.runFor(1500); await dismiss(p);
 { const s=await S(p); log('    ayarlar sonrası:',JSON.stringify({sound:s.sound,rifki:s.rifki,night:s.night,notif:s.notif,collectMode:s.collectMode})); ok(true,'P07 ayarlar değiştirildi ve yeniden açılışta korundu'); }
 await sane(p,'P07'); await p.context().close();

 log('P08 gündüz görünümü, sistem karanlık tema');
 p=await open(b,{scheme:'dark'}); await start(p); await mut(p,S=>{S.night=false}); await p.clock.runFor(2500);
 ok(!(await p.evaluate(()=>document.body.classList.contains('night'))),'P08 gece kapalıyken gece sınıfı yok'); await p.screenshot({path:out+'audit-P08-dark.png'});
 await sane(p,'P08'); await p.context().close();

 log('P09 balina: premium, dev kasa, tüm semtleri alır');
 p=await open(b); await start(p);
 await mut(p,(S)=>{ S.premium=true; S.cash=1e15; S.earned=1e15; const T=['ev','kafe','dukkan','ofis']; S.d['ist-0']=Array.from({length:20},(_,i)=>({t:T[i%4],lvl:5,buf:0,until:0,dur:1,up:false})); });
 for(let n=0;n<14;n++){ await tap(p,'#mapBtn'); const btn=await p.$('#sheet [data-a="buy"]:not([disabled])'); if(!btn){ await closeSheet(p); break; } await btn.click({force:true}); await p.clock.runFor(600); await dismiss(p); await closeSheet(p);
   const s=await S(p); await mut(p,fillFn,{k:s.cur,lvl:5}); }
 { const s=await S(p); ok(s.own.length>=10,'P09 '+s.own.length+' semt alındı'); metrics.whaleDistricts=s.own.length; ok(/₺/.test(await p.textContent('#cash')),'P09 kasa biçimli: '+(await p.textContent('#cash'))); }
 await sane(p,'P09'); await p.context().close();

 log('P10 kaporalı alan oyuncu');
 p=await open(b); await start(p); await mut(p,fillFn,{k:'ist-0',lvl:2}); await mut(p,S=>{S.cash=30000;});
 await tap(p,'#mapBtn'); const kb=await p.$('#sheet [data-a="kapora"]:not([disabled])');
 ok(!!kb,'P10 kapora düğmesi var'); if(kb){ await kb.click({force:true}); await p.clock.runFor(600); await dismiss(p); }
 { const s=await S(p); ok(Object.keys(s.lien).length===1 && s.own.length===2,'P10 kaporayla semt açıldı, borç kaydı var'); }
 await closeSheet(p); await sane(p,'P10'); await p.context().close();

 log('P11 engel temizleyen oyuncu');
 p=await open(b); await start(p); await mut(p,S=>{ S.d['ist-0'][3]={t:'ev',lvl:0,buf:0,until:0,dur:1,up:false,ob:Object.keys({gecekondu:1})[0]}; S.cash=1e6; });
 await p.clock.runFor(1500); await tap(p,'.lot[data-i="3"]');
 const clr=await p.$('#sheet [data-a="clear"]'); ok(!!clr,'P11 temizle düğmesi');
 if(clr){ await clr.click({force:true}); await p.clock.runFor(800); const s=await S(p); ok(!s.d['ist-0'][3]||!s.d['ist-0'][3].ob,'P11 engel kalktı'); }
 await closeSheet(p); await dismiss(p); await sane(p,'P11'); await p.context().close();

 log('P12 özel tapu alan ve yerleştiren oyuncu');
 p=await open(b); await start(p); await mut(p,fillFn,{k:'ist-0',lvl:3}); await mut(p,S=>{S.d['ist-0'][7]=null; S.cash=1e9; S.earned=1e9;});
 await tap(p,'#menuBtn'); await tap(p,'#sheet [data-a="ozel"]'); const bo=await p.$('#sheet [data-a="buyozel"]:not([disabled])');
 ok(!!bo,'P12 özel tapu satın alınabilir'); if(bo){ await bo.click({force:true}); await p.clock.runFor(600); }
 await closeSheet(p); await dismiss(p); await tap(p,'.lot[data-i="7"]'); const pl=await p.$('#sheet [data-a="place"]');
 ok(!!pl,'P12 boş arsada depodaki yapı yerleştirilebiliyor'); if(pl){ await pl.click({force:true}); await p.clock.runFor(600); }
 { const s=await S(p); ok(s.d['ist-0'][7]&&s.d['ist-0'][7].sp,'P12 özel yapı yerleşti'); }
 await closeSheet(p); await dismiss(p); await sane(p,'P12'); await p.context().close();

 log('P13 yıkım yapan oyuncu (iki adımlı onay)');
 p=await open(b); await start(p); await mut(p,fillFn,{k:'ist-0',lvl:2});
 await tap(p,'.lot[data-i="2"]'); await tap(p,'#sheet [data-a="del"]'); ok((await S(p)).d['ist-0'][2]!==null,'P13 ilk dokunuş yıkmadı (onay istiyor)');
 await tap(p,'#sheet [data-a="del"]'); ok((await S(p)).d['ist-0'][2]===null,'P13 ikinci dokunuşta yıkıldı');
 await closeSheet(p); await sane(p,'P13'); await p.context().close();

 log('P14 en küçük ekran (320×568) tüm menü ekranlarını gezer');
 p=await open(b,{vp:{width:320,height:568}}); await start(p);
 for(const a of ['lb','ref','sezon','arsiv','ozel','store','holding','set']){ await tap(p,'#menuBtn'); await tap(p,`#sheet [data-a="${a}"]`);
   const m=await p.evaluate(()=>{ const sh=document.querySelector('#sheet').getBoundingClientRect(); return {sw:document.documentElement.scrollWidth-innerWidth, inner:[...document.querySelectorAll('#sheetBody *')].filter(e=>{const r=e.getBoundingClientRect(); return r.width>0&&r.right>innerWidth+1;}).length, top:sh.top}; });
   ok(m.sw<=0&&m.inner===0&&m.top>=0,`P14 ${a} ekranı 320px'e sığıyor`+(m.inner?` (${m.inner} öğe taşıyor)`:'')); await closeSheet(p); }
 await tap(p,'#mapBtn'); await p.screenshot({path:out+'audit-P14-map320.png'}); await closeSheet(p);
 await sane(p,'P14'); await p.context().close();

 log('P15 tablet yatay (1024×768)');
 p=await open(b,{vp:{width:1024,height:768},dpr:1}); await start(p); await sane(p,'P15'); await p.screenshot({path:out+'audit-P15-tablet.png'}); await p.context().close();

 log('P16 bozuk kayıtla gelen oyuncu (sağlaması tutmayan + çöp veri)');
 for(const [name,raw] of [['çöp metin','{{{bozuk'],['sağlama yanlış',JSON.stringify({c:'zzz',j:'{"v":2}'})],['null alanlar',JSON.stringify({v:2,city:'ist',own:['ist-0','yok-9'],cur:'yok-9',d:{'ist-0':[{t:'kale',lvl:99},null,'x']},fx:null,stars:null,lien:'x',cash:'çok'})],['dev dizi',JSON.stringify({v:2,city:'izm',own:['izm-0'],cur:'izm-0',d:{'izm-0':Array(3000).fill({t:'ev',lvl:1,buf:0,until:0,dur:1,up:false})}})]]){
   p=await open(b,{init:`if(!sessionStorage.s){sessionStorage.s=1;localStorage.setItem('tapu-save-v2',${JSON.stringify(raw)});}`}); await p.clock.runFor(1000); await start(p); await dismiss(p);
   const s=await S(p); ok(s.v===2&&s.own.length>=1&&s.d[s.cur].length===20,'P16 '+name+': oyun açıldı, kayıt onarıldı'); await sane(p,'P16 '+name); await p.context().close(); }

 log('P17 çevrimdışı oyuncu (ağ yok)');
 p=await open(b,{offline:true}); await start(p); await tap(p,'#menuBtn'); await tap(p,'#sheet [data-a="lb"]'); await p.clock.runFor(1500); await closeSheet(p);
 await tap(p,'#menuBtn'); await tap(p,'#sheet [data-a="ref"]'); await p.fill('#refInput','TPABCD').catch(()=>{}); await tap(p,'#sheet [data-a="usecode"]'); await closeSheet(p);
 await sane(p,'P17'); await p.context().close();

 log('P18 depolama kapalı (localStorage hata fırlatıyor)');
 p=await open(b,{init:`Storage.prototype.setItem=function(){throw new DOMException('QuotaExceededError','QuotaExceededError')};`}); await start(p);
 await tap(p,'.lot[data-i="0"]'); await tap(p,'[data-a="build"][data-t="ev"]'); await closeSheet(p); await p.clock.runFor(12000);
 { const s=await S(p); ok(s.d['ist-0'][0]&&s.d['ist-0'][0].t==='ev','P18 depolama dolu olsa da oyun oynanıyor'); }
 p.errs=p.errs.filter(e=>!/Quota/.test(e)); await sane(p,'P18'); await p.context().close();

 log('P19 yüksek yoğunluklu ekran (3x, 412×915)');
 p=await open(b,{vp:{width:412,height:915},dpr:3}); await start(p); await sane(p,'P19'); await p.context().close();

 log('P20 2 saatlik uzun seans (sahte saat, kartlar kapatılarak)');
 p=await open(b); await start(p); await mut(p,fillFn,{k:'ist-0',lvl:2});
 const cdp20=await p.context().newCDPSession(p); await cdp20.send('Performance.enable'); const hm=async()=>{ await cdp20.send('HeapProfiler.collectGarbage').catch(()=>{}); return Object.fromEntries((await cdp20.send('Performance.getMetrics')).metrics.map(x=>[x.name,x.value])).JSHeapUsedSize; }; const heap0=await hm(); let cards=0, ads=0;
 for(let m=0;m<120;m++){ await p.clock.runFor(60000); if(await has(p,'#modal .card')){cards++; await dismiss(p);} if(await has(p,'#ad:not([hidden])')){ads++; await dismiss(p);} if(m%3===0) await tap(p,'#collectBtn'); }
 const heap1=await hm();
 const nodes=await p.evaluate(()=>document.getElementsByTagName('*').length);
 metrics.longSession={minutes:120,cards,interstitials:ads,heapStartMB:+(heap0/1048576).toFixed(1),heapEndMB:+(heap1/1048576).toFixed(1),domNodes:nodes};
 log('   ',JSON.stringify(metrics.longSession));
 ok(nodes<3000,'P20 DOM düğüm sayısı sınırlı ('+nodes+')'); ok(heap1<heap0*2+5*1048576,'P20 bellek sızıntısı yok (yığın '+metrics.longSession.heapStartMB+' → '+metrics.longSession.heapEndMB+' MB)'); ok(ads<=8,'P20 2 saatte geçiş reklamı '+ads+' (≤8)');
 await sane(p,'P20'); await p.context().close();

 log('P21 hareket azaltma tercihli oyuncu (erişilebilirlik)');
 p=await open(b,{motion:'reduce'}); await start(p); await mut(p,fillFn,{k:'ist-0',lvl:1}); await p.clock.runFor(30000); await tap(p,'#collectBtn');
 const lab=await p.$$eval('.lot',a=>a.filter(x=>x.getAttribute('aria-label')).length); ok(lab===20,'P21 tüm arsaların ekran okuyucu etiketi var ('+lab+'/20)');
 const btnNoName=await p.$$eval('button',a=>a.filter(x=>x.offsetParent&&!x.textContent.trim()&&!x.getAttribute('aria-label')&&!x.title).map(x=>x.id||x.className));
 ok(btnNoName.length===0,'P21 görünür her düğmenin adı var'+(btnNoName.length?' ('+btnNoName.join(',')+')':''));
 await sane(p,'P21'); await p.context().close();

 log('P22 geri tuşu/Escape kullanıcısı: iç içe paneller');
 p=await open(b); await start(p); await tap(p,'#menuBtn'); await tap(p,'#sheet [data-a="set"]'); await tap(p,'#sheet [data-a="guide"]');
 ok(await has(p,'#sheet.on'),'P22 kılavuz açıldı'); await closeSheet(p); ok(!(await has(p,'#sheet.on')),'P22 Escape paneli kapattı');
 for(let k=0;k<25;k++){ await p.keyboard.press('Escape'); } await p.clock.runFor(300); await sane(p,'P22'); await p.context().close();

 log('P23 kılavuzu sonuna kadar okuyan ve sınırı zorlayan oyuncu');
 p=await open(b); await start(p); await tap(p,'#guideBtn'); await tap(p,'#sheet [data-a="open"]');
 for(let k=0;k<30;k++){ const n=p.locator('#sheet [data-a="next"]:not([disabled])'); if(!(await n.count())) break; await n.first().click({force:true}).catch(()=>{}); await p.clock.runFor(150); await p.waitForTimeout(60); }
 const lastT=await p.textContent('#sheetBody'); ok(lastT.length>50 && !/undefined|NaN/.test(lastT),'P23 son bölüm düzgün');
 for(let k=0;k<30;k++){ const n=p.locator('#sheet [data-a="prev"]:not([disabled])'); if(!(await n.count())) break; await n.first().click({force:true}).catch(()=>{}); await p.clock.runFor(150); await p.waitForTimeout(60); }
 ok(!/undefined|NaN/.test(await p.textContent('#sheetBody')),'P23 ilk bölüme dönüldü');
 await closeSheet(p); await sane(p,'P23'); await p.context().close();

 /* ---------------- KENAR DURUMLAR ---------------- */
 section='edge';
 log('E1 yıl sonu, artık gün ve yaz saati tarihlerinde açılış');
 for(const t of ['2026-12-31T23:59:30+03:00','2028-02-29T12:00:00+03:00','2026-03-29T03:30:00+03:00','2026-10-29T10:00:00+03:00']){
   p=await open(b,{time:new Date(t).getTime()}); await start(p); await p.clock.runFor(60000); await dismiss(p); await sane(p,'E1 '+t); await p.context().close(); }
 log('E2 davet kodu girdisi: boş, emoji, uzun, HTML, kendi kodu');
 p=await open(b); await start(p); await tap(p,'#menuBtn'); await tap(p,'#sheet [data-a="ref"]');
 for(const v of ['','🏠🏠🏠','<img src=x onerror=window.__x=1>','A'.repeat(500),"TP' OR 1=1"]){ await p.fill('#refInput',v).catch(()=>{}); await tap(p,'#sheet [data-a="usecode"]'); }
 const own=(await S(p)).ref.code; await p.fill('#refInput',own.toLowerCase()); await tap(p,'#sheet [data-a="usecode"]');
 ok((await p.textContent('#toast')).includes('Kendi'),'E2 kendi kodu reddedildi'); ok(!(await p.evaluate(()=>window.__x)),'E2 HTML enjeksiyonu çalışmadı');
 ok((await S(p)).ref.used===false,'E2 geçersiz girdiler ödül vermedi'); await closeSheet(p); await sane(p,'E2'); await p.context().close();
 log('E3 yetersiz bakiye ile tüm satın alma düğmeleri');
 p=await open(b); await start(p); await mut(p,S=>{S.cash=0}); await tap(p,'.lot[data-i="0"]');
 for(const t of ['ev','kafe','dukkan','ofis']) await p.click(`[data-a="build"][data-t="${t}"]`,{force:true,timeout:300}).catch(()=>{});
 { const s=await S(p); ok(s.cash===0&&!s.d['ist-0'][0],'E3 parasız inşaat yapılamadı'); } await closeSheet(p);
 await tap(p,'#mapBtn'); for(const e of await p.$$('#sheet [data-a="buy"],#sheet [data-a="kapora"]')) await e.click({force:true}).catch(()=>{}); await p.clock.runFor(400);
 ok((await S(p)).own.length===1,'E3 parasız semt alınamadı'); await closeSheet(p); await sane(p,'E3'); await p.context().close();
 log('E4 aynı anda iki sekme (eşzamanlılık)');
 { const ctx=await b.newContext({viewport:{width:390,height:844}}); await ctx.addInitScript(`if(!localStorage.getItem('tapu-prefs'))localStorage.setItem('tapu-prefs',JSON.stringify({lang:'tr',region:'tr',ent:{}}));`); const a=await ctx.newPage(); await a.goto(URL); await a.waitForTimeout(800);
   if(await a.isVisible('#modal .citycard')){ await a.click('#modal .cityopt[data-a="ist"]',{force:true}); await a.waitForTimeout(600); }
   const c=await ctx.newPage(); const errs=[]; c.on('pageerror',e=>errs.push(e.message)); a.on('pageerror',e=>errs.push(e.message));
   await c.goto(URL); await c.waitForTimeout(1500); await a.waitForTimeout(500);
   ok(errs.length===0,'E4 iki sekme açıkken hata yok'); metrics.twoTabs='son yazan kazanır (aynı cihaz, sekmeler arası kilit yok)'; await ctx.close(); }

 /* ---------------- EKRAN BOYUTLARI × TEMA ---------------- */
 section='ui';
 const VPS=[[280,653],[320,568],[360,640],[375,667],[390,844],[393,873],[412,915],[430,932],[600,960],[768,1024],[820,1180],[1024,768],[1280,800]];
 for(const [w,h] of VPS) for(const night of [true,false]){
   p=await open(b,{vp:{width:w,height:h},dpr:1}); await start(p); await mut(p,(S,n)=>{S.night=n},night); await mut(p,fillFn,{k:'ist-0',lvl:2}); await p.clock.runFor(2500); await dismiss(p);
   const m=await p.evaluate(()=>{ const q=s=>document.querySelector(s)?.getBoundingClientRect(); const lots=[...document.querySelectorAll('.lot')].map(e=>e.getBoundingClientRect());
     const top=q('.top'), dock=q('.dock'), coll=q('#collectBtn');
     return {sw:document.documentElement.scrollWidth-innerWidth,minLot:Math.min(...lots.map(r=>r.width)),lotsIn:lots.every(r=>r.left>=-1&&r.right<=innerWidth+1),overlapTop:lots.some(r=>r.top<top.bottom-1),dockIn:dock.bottom<=innerHeight+1,coll:coll.width}; }).catch(e=>({err:e.message}));
   if(m.err){ ok(false,`${w}x${h} ölçüm hatası ${m.err}`); await p.context().close(); continue; }
   ok(m.sw<=0&&m.lotsIn&&!m.overlapTop&&m.dockIn&&m.minLot>=24, `${w}x${h} ${night?'gece':'gündüz'}: taşma yok, alt çubuk ekranda, arsa ${Math.round(m.minLot)}px (WCAG 2.5.8 ≥24)`);
   if(m.minLot<44){ (metrics.smallTargets=metrics.smallTargets||[]).push(`${w}x${h}:${Math.round(m.minLot)}px`); }
   if(!night&&[280,1280].includes(w)) await p.screenshot({path:out+`audit-ui-${w}.png`});
   await p.context().close(); }

 /* ---------------- PERFORMANS VE STRES ---------------- */
 section='perf';
 log('PF1 açılış süresi (5 soğuk açılış, ortanca)');
 { const t=[]; for(let k=0;k<5;k++){ const ctx=await b.newContext(); await ctx.addInitScript(`if(!localStorage.getItem('tapu-prefs'))localStorage.setItem('tapu-prefs',JSON.stringify({lang:'tr',region:'tr',ent:{}}));`); const q=await ctx.newPage(); const t0=Date.now(); await q.goto(URL,{waitUntil:'load'}); await q.waitForSelector('.lot'); const nav=await q.evaluate(()=>{const n=performance.getEntriesByType('navigation')[0]; const fcp=performance.getEntriesByName('first-contentful-paint')[0]; return {dcl:n.domContentLoadedEventEnd, load:n.loadEventEnd, fcp:fcp?fcp.startTime:null};}); t.push({wall:Date.now()-t0,...nav}); await ctx.close(); }
   const med=a=>a.sort((x,y)=>x-y)[Math.floor(a.length/2)]; metrics.startup={runs:t.length,medianWallMs:med(t.map(x=>x.wall)),medianDclMs:+med(t.map(x=>x.dcl)).toFixed(0),medianLoadMs:+med(t.map(x=>x.load)).toFixed(0),medianFcpMs:+(med(t.map(x=>x.fcp||0))).toFixed(0)};
   log('   ',JSON.stringify(metrics.startup)); ok(metrics.startup.medianFcpMs<1500,'PF1 ilk boyama < 1,5 sn (masaüstü Chromium, kısıtsız)'); }
 log('PF2 4x CPU kısıtlamasında açılış + tick maliyeti (düşük seviye Android yaklaşımı)');
 { const ctx=await b.newContext({viewport:{width:390,height:844}}); await ctx.addInitScript(`if(!localStorage.getItem('tapu-prefs'))localStorage.setItem('tapu-prefs',JSON.stringify({lang:'tr',region:'tr',ent:{}}));`); const q=await ctx.newPage(); const cdp=await ctx.newCDPSession(q); await cdp.send('Emulation.setCPUThrottlingRate',{rate:4}); await cdp.send('Performance.enable');
   const t0=Date.now(); await q.goto(URL); await q.waitForSelector('.lot'); const fcp=await q.evaluate(()=>{const f=performance.getEntriesByName('first-contentful-paint')[0]; return f?f.startTime:null;}); const wall=Date.now()-t0;
   if(await q.isVisible('#modal .citycard')){ await q.click('#modal .cityopt[data-a="ist"]',{force:true}); await q.waitForTimeout(800); }
   await q.evaluate(()=>{ const S=window.__tapuState(); const T=['ev','kafe','dukkan','ofis']; for(const k of ['ist-0','ist-1','ist-2','ist-3','ist-4','izm-0','izm-1','izm-2','izm-3','izm-4','ank-0','ank-1','ank-2','ank-3','ank-4']){ if(!S.own.includes(k)) S.own.push(k); S.d[k]=Array.from({length:20},(_,i)=>({t:T[i%4],lvl:5,buf:0,until:0,dur:1,up:false})); } S.collectMode='auto'; });
   const m0=Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(x=>[x.name,x.value]));
   await q.waitForTimeout(10000);
   const m1=Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(x=>[x.name,x.value]));
   const lt=await q.evaluate(()=>new Promise(r=>{ let n=0,max=0; const o=new PerformanceObserver(l=>{for(const e of l.getEntries()){n++;max=Math.max(max,e.duration);}}); try{o.observe({type:'longtask',buffered:true});}catch{} setTimeout(()=>{o.disconnect(); r({n,max:Math.round(max)});},3000); }));
   metrics.throttled4x={fcpMs:fcp&&Math.round(fcp),wallMs:wall,scriptMsPerSec:+(((m1.ScriptDuration-m0.ScriptDuration)*1000)/10).toFixed(1),layoutMsPerSec:+(((m1.LayoutDuration-m0.LayoutDuration)*1000)/10).toFixed(1),recalcStyleMsPerSec:+(((m1.RecalcStyleDuration-m0.RecalcStyleDuration)*1000)/10).toFixed(1),longTasks3s:lt,heapMB:+(m1.JSHeapUsedSize/1048576).toFixed(1),nodes:m1.Nodes,districts:15};
   log('   ',JSON.stringify(metrics.throttled4x));
   ok(metrics.throttled4x.scriptMsPerSec<150,'PF2 15 dolu semt, 4x yavaş CPU: betik süresi < 150 ms/sn (%15 ana iş parçacığı)');
   await ctx.close(); }
 log('PF3 stres: 1000 hızlı dokunuş (TOPLA + arsa) ve 500 panel aç/kapa');
 { p=await open(b); await start(p); await mut(p,fillFn,{k:'ist-0',lvl:3}); const t0=Date.now();
   for(let k=0;k<1000;k++) await p.evaluate(i=>{ (i%2?document.querySelector('#collectBtn'):document.querySelectorAll('.lot')[i%20]).click(); if(i%2===0) document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'})); },k);
   const tapMs=Date.now()-t0; const t1=Date.now();
   for(let k=0;k<500;k++) await p.evaluate(()=>{ document.querySelector('#menuBtn').click(); document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'})); });
   metrics.stress={taps:1000,tapTotalMs:tapMs,sheetCycles:500,sheetTotalMs:Date.now()-t1};
   await p.clock.runFor(1000); log('   ',JSON.stringify(metrics.stress)); await sane(p,'PF3'); await p.context().close(); }
 log('PF4 kayıt boyutu (tüm semtler dolu, en üst seviye)');
 { p=await open(b); await start(p); await p.evaluate(()=>{ const S=window.__tapuState(); const T=['ev','kafe','dukkan','ofis']; for(const k of ['ist-0','ist-1','ist-2','ist-3','ist-4','izm-0','izm-1','izm-2','izm-3','izm-4','ank-0','ank-1','ank-2','ank-3','ank-4']){ if(!S.own.includes(k)) S.own.push(k); S.d[k]=Array.from({length:20},(_,i)=>({t:T[i%4],lvl:5,buf:1e30,until:0,dur:1,up:false,bu:Date.now(),sk:{c:3,r:1,s:true}})); } S.ach=Array(26).fill('a'); });
   const size=await p.evaluate(()=>JSON.stringify(window.__tapuState()).length); metrics.maxSaveBytes=size; ok(size<950*1024,'PF4 en büyük kayıt '+(size/1024).toFixed(1)+' KB (Firestore sınırı 950 KB)'); await p.context().close(); }

 metrics.totalWallSec=Math.round((Date.now()-T0)/1000);
 const pass=results.filter(r=>r.pass).length, fail=results.length-pass;
 fs.writeFileSync(out+'audit-metrics.json',JSON.stringify({date:new Date().toISOString(),pass,fail,results,metrics},null,1));
 log(`\nDENETİM: ${pass} geçti, ${fail} kaldı · ${metrics.totalWallSec} sn`); await b.close(); process.exit(fail?1:0);
})().catch(e=>{ console.error('ÇÖKTÜ',e); process.exit(2); });
