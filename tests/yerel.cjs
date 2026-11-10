// Yerelleştirme uçtan uca testleri: ilk açılış (dil → bölge → şehir), İngilizce + Almanya, Japonca + Japonya,
// Global (5 şehir, 4. ve 5. şehir bedeli), bölge değiştirince kayıtların ayrı kalması, dil değiştirme,
// İngilizce/Almanca/Japonca arayüzde Türkçe kalıntı taraması ve 320px taşma denetimi.
// Çalıştır: npm run test:yerel
const {chromium}=require('playwright');
const { serve, out, vis, state, makeTap, dismissCards, checker } = require('./helpers.cjs');
let URL; // http://127.0.0.1:<port>/index.html — main başında serve() ile
const { fails, ok }=checker();
const tap=makeTap({run:400,wait:250,fallback:true,timeout:3000});
const dismiss=p=>dismissCards(p,{n:6,run:400,wait:200});
const S=state;
async function fresh(b,vp={width:390,height:844},locale='en-US'){ const ctx=await b.newContext({viewport:vp,locale}); const p=await ctx.newPage(); p.errs=[]; p.on('pageerror',e=>p.errs.push(e.message)); await p.clock.install(); await p.goto(URL); await p.clock.runFor(600); await p.waitForTimeout(300); return p; }
// Türkçeye özgü harfler (özel adlar hariç) görünür metinde kalmış mı?
const TR_CH=/[ğışĞİŞ]|(^|\s)(ve|bir|için|kira|semt|arsa)(\s|$)/i;
const NAMES=['İstanbul','İzmir','Kadıköy','Beşiktaş','Şişli','Nişantaşı','Karşıyaka','Kızılay','Çankaya','Ümitköy','İncek','Bahçelievler','Göztepe','Çeşme','TAPU'];
async function turkishLeft(p){ return p.evaluate(([re,names])=>{ const R=new RegExp(re,'i'); const bad=[]; const w=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT); let n;
  while(n=w.nextNode()){ const el=n.parentElement; if(!el||!el.offsetParent&&el.tagName!=='BODY') continue; let t=n.nodeValue.trim(); if(!t) continue; for(const x of names) t=t.split(x).join(''); if(R.test(t)) bad.push(t.slice(0,60)); } return [...new Set(bad)].slice(0,8); },[TR_CH.source,NAMES]); }

(async()=>{
 const b=await chromium.launch(); URL=await serve();

 console.log('Y1–Y3 ilk açılış: İngilizce dil, Almanya bölgesi, Berlin');
 let p=await fresh(b);
 ok(await vis(p,'#modal .cityopt[data-a="en"]'),'dil seçimi çıktı');
 ok((await p.getAttribute('#modal .cityopt[data-a="en"]','class')).includes('on'),'cihaz dili (en-US) seçili geldi');
 await tap(p,'#modal .cityopt[data-a="en"]');
 ok(await vis(p,'#modal .cityopt[data-a="gl"]') && (await p.$$('#modal .cityopt')).length===6,'bölge seçimi: 5 ülke + Global');
 ok((await p.textContent('#modal .card h3')).toLowerCase().includes('invest'),'bölge kartı İngilizce');
 await tap(p,'#modal .cityopt[data-a="de"]');
 ok(await vis(p,'#modal .cityopt[data-a="ber"]'),'Almanya şehirleri: München, Berlin, Hamburg');
 ok((await p.textContent('#modal .citylist')).includes('Munich'),'İngilizcede "Munich"');
 await tap(p,'#modal .cityopt[data-a="ber"]'); await p.waitForTimeout(500);
 ok((await p.textContent('#modal .postcard')).includes('Marzahn'),'Berlin kartpostalı ve ilk semt Marzahn');
 await p.screenshot({path:out+'yerel-kartpostal-ber.png'}); await dismiss(p);
 let s=await S(p); ok(s.city==='ber'&&s.cur==='ber-0','Berlin seçildi');
 ok((await p.textContent('#cash')).startsWith('€'),'para birimi €');
 ok(await p.evaluate(()=>document.documentElement.lang)==='en','sayfa dili en');
 // birkaç ekranı gez ve Türkçe kalıntı ara
 await tap(p,'.lot[data-i="0"]'); let left=await turkishLeft(p); ok(left.length===0,'arsa paneli İngilizce '+JSON.stringify(left)); await p.keyboard.press('Escape'); await p.clock.runFor(300); await p.waitForTimeout(450);
 for(const a of ['lb','sezon','arsiv','ozel','store','set']){ await dismiss(p); await tap(p,'#menuBtn'); await tap(p,`#sheet [data-a="${a}"]`); left=await turkishLeft(p); ok(left.length===0,`${a} ekranı İngilizce `+JSON.stringify(left)); await p.keyboard.press('Escape'); await p.clock.runFor(300); await p.waitForTimeout(450); }
 await dismiss(p); await tap(p,'#mapBtn'); left=await turkishLeft(p); ok(left.length===0,'harita İngilizce '+JSON.stringify(left)); await p.screenshot({path:out+'yerel-harita-en.png'}); await p.keyboard.press('Escape'); await p.waitForTimeout(450);
 await p.screenshot({path:out+'yerel-ana-en-ber.png'});
 ok(p.errs.length===0,'konsol temiz '+p.errs.join('|'));

 console.log('Bölge değiştirme: Almanya kaydı korunur, Türkiye ayrı başlar');
 await p.evaluate(()=>{ const S=window.__tapuState(); S.cash=12345; });
 await dismiss(p); await tap(p,'#menuBtn'); await tap(p,'#sheet [data-a="set"]');
 ok(await vis(p,'#sheet [data-a="region"][data-r="tr"]'),'ayarlarda bölge seçenekleri');
 await tap(p,'#sheet [data-a="region"][data-r="tr"]'); await p.waitForTimeout(800); await p.clock.runFor(800); await p.waitForTimeout(400);
 ok(await vis(p,'#modal .cityopt[data-a="ist"]'),'Türkiye: yeni bölge için şehir seçimi');
 await tap(p,'#modal .cityopt[data-a="ist"]'); await p.waitForTimeout(400); await dismiss(p);
 ok((await p.textContent('#cash')).startsWith('₺'),'Türkiye bölgesinde ₺');
 await dismiss(p); await tap(p,'#menuBtn'); await tap(p,'#sheet [data-a="set"]'); await tap(p,'#sheet [data-a="region"][data-r="de"]'); await p.waitForTimeout(800); await p.clock.runFor(800); await p.waitForTimeout(400); await dismiss(p);
 s=await S(p); ok(s.city==='ber' && Math.round(s.cash)>=12345,'Almanya’ya dönünce kayıt yerinde (kasa '+Math.round(s.cash)+')');

 console.log('Dil değiştirme: Deutsch');
 await dismiss(p); await tap(p,'#menuBtn'); await tap(p,'#sheet [data-a="set"]'); await tap(p,'#sheet [data-a="lang"][data-l="de"]'); await p.waitForTimeout(800); await p.clock.runFor(800); await p.waitForTimeout(400); await dismiss(p);
 ok(await p.evaluate(()=>document.documentElement.lang)==='de','sayfa dili de');
 ok((await p.textContent('#modal, body')).length>0,'');
 left=await turkishLeft(p); ok(left.length===0,'ana ekran Almanca '+JSON.stringify(left));
 await p.context().close();

 console.log('Japonca + Japonya, 320px');
 p=await fresh(b,{width:320,height:568},'ja-JP');
 await tap(p,'#modal .cityopt[data-a="ja"]'); await tap(p,'#modal .cityopt[data-a="jp"]'); await tap(p,'#modal .cityopt[data-a="tyo"]'); await p.waitForTimeout(400); await dismiss(p);
 ok((await p.textContent('#cash')).startsWith('¥'),'¥ para birimi'); ok((await p.textContent('#dname')).includes('東京'),'東京 · 足立');
 const sw=await p.evaluate(()=>document.documentElement.scrollWidth-innerWidth); ok(sw<=0,'320px yatay taşma yok ('+sw+')');
 for(const a of ['store','set']){ await dismiss(p); await tap(p,'#menuBtn'); await tap(p,`#sheet [data-a="${a}"]`); const ov=await p.evaluate(()=>[...document.querySelectorAll('#sheetBody *')].filter(e=>{const r=e.getBoundingClientRect(); return r.width>0&&r.right>innerWidth+1;}).length); ok(ov===0,`${a} 320px'e sığıyor (ja)`); await p.keyboard.press('Escape'); await p.clock.runFor(300); await p.waitForTimeout(450); }
 { const lay=await p.evaluate(()=>({dock:document.querySelector('.dock').getBoundingClientRect().top,last:Math.max(...[...document.querySelectorAll('.lot')].map(e=>e.getBoundingClientRect().bottom))})); ok(lay.last<=lay.dock,'320px: arsalar alt çubuğun üstünde ('+Math.round(lay.last)+' ≤ '+Math.round(lay.dock)+')'); }
 await p.screenshot({path:out+'yerel-ana-ja-320.png'});
 ok(p.errs.length===0,'konsol temiz '+p.errs.join('|')); await p.context().close();

 console.log('Almanca 320px taşma');
 p=await fresh(b,{width:320,height:568},'de-DE');
 await tap(p,'#modal .cityopt[data-a="de"]'); await tap(p,'#modal .cityopt[data-a="de"]'); await tap(p,'#modal .cityopt[data-a="muc"]'); await p.waitForTimeout(400); await dismiss(p);
 for(const a of ['lb','sezon','arsiv','store','holding','set']){ await dismiss(p); await tap(p,'#menuBtn'); await tap(p,`#sheet [data-a="${a}"]`); const ov=await p.evaluate(()=>[...document.querySelectorAll('#sheetBody *')].filter(e=>{const r=e.getBoundingClientRect(); return r.width>0&&r.right>innerWidth+1;}).map(e=>e.textContent.slice(0,20))); ok(ov.length===0,`${a} 320px'e sığıyor (de) ${JSON.stringify(ov.slice(0,3))}`); await p.keyboard.press('Escape'); await p.clock.runFor(300); await p.waitForTimeout(450); }
 const sw2=await p.evaluate(()=>document.documentElement.scrollWidth-innerWidth); ok(sw2<=0,'ana ekran 320px taşma yok (de)');
 await p.screenshot({path:out+'yerel-ana-de-320.png'});
 ok(p.errs.length===0,'konsol temiz '+p.errs.join('|')); await p.context().close();

 console.log('Global: 5 şehir, 4. ve 5. şehir bedeli');
 p=await fresh(b);
 await tap(p,'#modal .cityopt[data-a="en"]'); await tap(p,'#modal .cityopt[data-a="gl"]');
 ok((await p.$$('#modal .cityopt')).length===5,'Global’de 5 başlangıç şehri');
 await tap(p,'#modal .cityopt[data-a="nyc"]'); await p.waitForTimeout(400); await dismiss(p);
 await p.evaluate(()=>{ const S=window.__tapuState(); const T=['ev','kafe','dukkan','ofis']; const full=()=>Array.from({length:20},(_,i)=>({t:T[i%4],lvl:2,buf:0,until:0,dur:1,up:false})); S.d['nyc-0']=full(); for(const c of ['lon','muc']){ S.own.push(c+'-0'); S.d[c+'-0']=full(); } S.cash=1e9; });
 await p.clock.runFor(3000); await dismiss(p); await p.evaluate(()=>{ window.__tapuState().cash=1e9; });
 await dismiss(p); await tap(p,'#mapBtn'); const mt=await p.textContent('#sheetBody');
 ok(['New York','London','Munich','Istanbul','Tokyo'].every(c=>mt.includes(c)),'haritada 5 şehir');
 ok(mt.includes('$6M'),'4. şehir bedeli $6M: '+(mt.match(/\$[0-9.,]+M/g)||[]).join(','));
 await p.screenshot({path:out+'yerel-global.png'});
 const buy=await p.$('#sheet [data-a="buy"][data-k="ist-0"]'); if(buy){ await buy.click({force:true}); await p.clock.runFor(600); await dismiss(p); }
 s=await S(p); ok(s.own.includes('ist-0') && s.cash<1e9-5.9e6,'İstanbul 4. şehir olarak $6M’a alındı');
 await p.keyboard.press('Escape'); await p.waitForTimeout(450);
 await dismiss(p); await tap(p,'#mapBtn'); ok((await p.textContent('#sheetBody')).includes('$60M'),'5. şehir bedeli $60M'); await p.keyboard.press('Escape'); await p.waitForTimeout(450);
 ok(p.errs.length===0,'konsol temiz '+p.errs.join('|')); await p.context().close();

 console.log('Yeni oyun: dil ve bölge seçimi yeniden gelir, diğer bölgenin kaydı korunur');
 p=await fresh(b); await tap(p,'#modal .cityopt[data-a="en"]'); await tap(p,'#modal .cityopt[data-a="us"]'); await tap(p,'#modal .cityopt[data-a="nyc"]'); await p.waitForTimeout(400); await dismiss(p);
 await p.evaluate(()=>{ window.__tapuState().cash=4242; }); await p.clock.runFor(11000);
 await tap(p,'#menuBtn'); await tap(p,'#sheet [data-a="set"]'); await tap(p,'#sheet [data-a="reset"]'); await tap(p,'#sheet [data-a="reset"]');
 ok(await vis(p,'#modal .cityopt[data-a="de"]'),'Yeni oyun → dil seçimi');
 await tap(p,'#modal .cityopt[data-a="en"]'); ok(await vis(p,'#modal .cityopt[data-a="gl"]'),'Yeni oyun → bölge seçimi');
 await tap(p,'#modal .cityopt[data-a="uk"]'); ok(await vis(p,'#modal .cityopt[data-a="lon"]'),'İngiltere şehirleri');
 await tap(p,'#modal .cityopt[data-a="lon"]'); await p.waitForTimeout(1200); await p.clock.runFor(1500); await p.waitForTimeout(400); await dismiss(p);
 let s2=await S(p); ok(s2.city==='lon','İngiltere · Londra ile yeni oyun');
 const us=await p.evaluate(()=>{ const w=localStorage.getItem('tapu-save-v2-us'); return w?JSON.parse(JSON.parse(w).j).cash:null; }); ok(us!==null && Math.round(us)>=4242,'ABD kaydı korundu ('+Math.round(us||0)+')');
 ok(p.errs.length===0,'konsol temiz '+p.errs.join('|')); await p.context().close();

 console.log('Mevcut oyuncu: kaydı olan ve tercihi olmayan → Türkçe/Türkiye, seçim ekranı yok');
 { const ctx=await b.newContext({locale:'en-US'}); const q=await ctx.newPage(); await q.clock.install();
   await q.addInitScript(()=>{ if(!sessionStorage.s){ sessionStorage.s=1; localStorage.setItem('tapu-save-v2',JSON.stringify({v:2,city:'izm',own:['izm-0'],cur:'izm-0',d:{'izm-0':[]},cash:777})); } });
   await q.goto(URL); await q.clock.runFor(800); await q.waitForTimeout(300);
   ok(!(await vis(q,'#modal .cityopt[data-a="en"]')),'dil seçimi sorulmadı');
   ok(await q.evaluate(()=>document.documentElement.lang)==='tr' && (await q.textContent('#cash')).startsWith('₺'),'Türkçe ve ₺ ile devam');
   await q.clock.runFor(2000); await q.waitForTimeout(400);
   ok((await q.textContent('#modal .card').catch(()=>'')).includes('Yeni: diller ve ülkeler'),'mevcut oyuncuya bir kez yeni diller/ülkeler kartı');
   await q.click('#modal [data-a="pick"]',{force:true}); await q.clock.runFor(400); await q.waitForTimeout(300);
   ok(await vis(q,'#modal .cityopt[data-a="en"]'),'karttan dil seçimine geçildi');
   await q.click('#modal .cityopt[data-a="tr"]',{force:true}); await q.clock.runFor(400); await q.waitForTimeout(300);
   ok(await vis(q,'#modal .cityopt[data-a="us"]'),'ardından bölge seçimi (ABD, Almanya, Global…)');
   await ctx.close(); }

 console.log('\nSONUÇ:',fails.length?fails.length+' sorun':'hepsi geçti'); await b.close(); process.exit(fails.length?1:0);
})().catch(e=>{ console.error('ÇÖKTÜ',e); process.exit(2); });
