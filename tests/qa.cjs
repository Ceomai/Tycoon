// Uçtan uca test: sahte saatle 45 dk oyun, reklam/etkinlik sıklığı, ödüllü reklamlar, tadilat, semt, ekran boyutları.
// Çalıştır: npm run test:e2e  (önizleme paketi dist-preview/index.html üzerinde; Playwright gerekir)
// Tohum kayıtlar eski (v1) biçimde yazılır: böylece v1→v2 taşıma da her testte sınanır.
const {chromium}=require('playwright');
const path=require('path'); const URL='file://'+path.resolve(__dirname,'../dist-preview/index.html');
const out=path.resolve(__dirname,'out')+'/'; require('fs').mkdirSync(out,{recursive:true});
const log=(...a)=>console.log(...a);
const st=async p=>{ await p.clock.runFor(300); return await p.evaluate(()=>{const o=JSON.parse(JSON.stringify(window.__tapuState())); o._now=Date.now(); return o;}); };
const saved=async p=>p.evaluate(()=>{const w=JSON.parse(localStorage.getItem('tapu-save-v2')||'null'); return w&&JSON.parse(w.j);});
async function page(b,opts={},seed){
  const ctx=await b.newContext({viewport:opts.vp||{width:390,height:800}});
  const p=await ctx.newPage(); p.errs=[]; p.on('pageerror',e=>p.errs.push(e.message)); p.on('console',m=>{if(m.type()==='error')p.errs.push(m.text())});
  await p.clock.install(opts.time ? { time: opts.time } : undefined);
  if(seed) await p.addInitScript(`if(!sessionStorage.getItem('s')){sessionStorage.setItem('s',1);localStorage.setItem('tapu-save-v1',JSON.stringify((${seed})(Date.now())));}`);
  await p.goto(URL); await p.clock.runFor(500); return p;
}
const dismiss=async p=>{ for(let k=0;k<4&&await p.isVisible('#modal .card');k++){ await p.click(await p.isVisible('#modal .card .txt')?'#modal .card .txt':'#modal .card [data-a]',{force:true}); await p.waitForTimeout(500); } };
const tap=async(p,sel)=>{ await p.click(sel,{force:true}); await p.waitForTimeout(380); };
(async()=>{
 const b=await chromium.launch(); const fails=[]; const ok=(c,m)=>{ if(!c){fails.push(m); log('  ✗',m);} else log('  ✓',m); };

 log('A) ilk oyun akışı');
 let p=await page(b);
 ok(await p.isVisible('#modal .citycard'),'ilk açılışta il seçimi çıktı');
 ok((await p.$$('#modal .cityopt')).length===3,'3 il seçeneği var');
 await tap(p,'#modal .cityopt[data-a="izm"]'); await p.clock.runFor(300);
 ok(await p.isVisible('#modal .postcard') && (await p.textContent('#modal .postcard')).includes('Karşıyaka') && (await p.textContent('#modal .postcard')).includes('evler'),'il kartpostalı ve başlangıç semtinin kuralı çıktı');
 await tap(p,'#modal [data-a="ok"]');
 ok(await p.isVisible('#distBar') && /%0/.test(await p.textContent('#distBar')),'ilerleme çubuğu: semtin yüzdesi');
 let s=await st(p); ok(s.city==='izm'&&s.cur==='izm-0'&&s.own.join()==='izm-0','İzmir seçildi, Karşıyaka açık');
 ok((await p.textContent('#dname')).includes('Karşıyaka'),'üstte İzmir · Karşıyaka');
 ok(await p.isVisible('#bubble:not([data-off])'),'yönlendirme balonu görünüyor');
 await tap(p,'.lot[data-i="5"]'); await p.clock.runFor(400);
 ok(await p.isVisible('#sheet.on'),'arsa paneli açıldı');
 await tap(p,'[data-a="build"][data-t="ev"]'); await p.clock.runFor(300);
 s=await st(p); ok(s.cash===50 && s.d['izm-0'][5]&&s.d['izm-0'][5].t==='ev','ev inşaatı başladı, kasa 150→50');
 await p.clock.runFor(11000); { const sv=await saved(p); ok(sv&&sv.city==='izm'&&sv.d['izm-0'][5],'kayıt sağlamalı biçimde yazıldı'); }
 await p.clock.runFor(10000); s=await st(p); ok(s.d['izm-0'][5].lvl===1,'inşaat 20 sn sonra bitti');
 await p.clock.runFor(15000); ok(await p.isVisible('.lot[data-i="5"] .fill') && !(await p.$('.coin')),'binada para baloncuğu yok, doluluk çubuğu var');
 ok((await p.textContent('#collectBtn')).includes('TOPLA'),'ortada TOPLA mührü, bekleyen kira yazıyor');
 const before=(await st(p)).cash; await tap(p,'#collectBtn'); s=await st(p); ok(s.cash>before && s.d['izm-0'][5].buf<2,'TOPLA mührüyle tüm kira toplandı');
 await tap(p,'.lot[data-i="5"]'); ok(await p.isVisible('#sheet.on [data-a="lotboost"]'),'binaya dokununca mülk paneli açılıyor (toplama değil)');
 await p.keyboard.press('Escape'); await p.waitForTimeout(400);
 await p.clock.runFor(60000); // etkinlik zamanı (90 sn oyun süresi)
 ok(await p.isVisible('#modal .card'),'etkinlik kartı çıktı'); 
 if(await p.isVisible('#modal .card')){ await tap(p,'#modal .card .txt'); await p.clock.runFor(300); ok(!(await p.isVisible('#modal .card')),'kart kapandı'); }
 await p.screenshot({path:out+'A.png'}); ok(p.errs.length===0,'konsol hatası yok '+p.errs.join('|')); await p.context().close();

 log('B) 45 dk oyun: geçiş reklamı ve etkinlik sıklığı');
 p=await page(b,{},`t=>{const d=[0,1,2,3,4].map(()=>Array(20).fill(null)); for(let i=0;i<8;i++) d[0][i]={t:'ev',lvl:2,buf:0,until:0,dur:1,up:false}; return {v:1,cash:500,earned:5000,boostUntil:0,lastSeen:t,unlocked:1,cur:0,d,fx:[],disc:0,playMs:0,nextAd:16*60e3,nextEvent:150e3,sound:false,collects:50,seen:{ev:true,kafe:true},ads:0,skipHint:1}}`);
 let inter=0, ev=0, interTimes=[];
 for(let sec=0;sec<45*60;sec+=5){
   await p.clock.runFor(5000);
   if(await p.isVisible('#modal .card')){ ev++; if(await p.isVisible('#modal .card .txt')) await tap(p,'#modal .card .txt'); else await tap(p,'#modal .card [data-a]'); }
   if(await p.isVisible('#ad:not([hidden])')){ inter++; interTimes.push(Math.round(sec/60)); await p.clock.runFor(5500); await tap(p,'#adX'); }
 }
 log('   geçiş reklamı:',inter,'kez, dakika',interTimes.join(','),'| etkinlik:',ev);
 ok(inter>=2&&inter<=3,'45 dk içinde 2-3 geçiş reklamı');
 ok(ev>=8&&ev<=30,'kart (etkinlik/fırsat/günlük) sıklığı makul');
 ok(p.errs.length===0,'konsol hatası yok '+p.errs.join('|')); await p.context().close();

 log('C) ödüllü reklamlar, tadilat, yıkım');
 p=await page(b,{},`t=>{const d=[0,1,2,3,4].map(()=>Array(20).fill(null)); d[0][0]={t:'ev',lvl:1,buf:0,until:0,dur:1,up:false}; d[0][1]={t:'kafe',lvl:0,buf:0,until:t+600000,dur:600000,up:false}; d[0][2]={t:'ofis',lvl:3,buf:0,until:t+5*3600e3,dur:5*3600e3,up:true}; return {v:1,cash:1e6,earned:1e6,boostUntil:0,lastSeen:t,unlocked:1,cur:0,d,fx:[],disc:0,playMs:0,nextAd:9e9,nextEvent:9e9,sound:false,collects:50,seen:{ev:true,kafe:true,dukkan:true,ofis:true},ads:0,skipHint:1}}`);
 await tap(p,'#collectBtn'); ok(!(await p.isVisible('#ad:not([hidden])')),'ortadaki mühür reklam açmıyor');
 await tap(p,'.lot[data-i="0"]'); await p.clock.runFor(300); await tap(p,'[data-a="lotboost"]'); await p.clock.runFor(300); ok(await p.isVisible('#ad:not([hidden])'),'mülke 2x reklamı açıldı');
 ok(await p.isDisabled('#adX'),'süre bitmeden kapatılamıyor');
 await p.clock.runFor(5200); await tap(p,'#adX'); s=await st(p); ok(s.d['ist-0'][0].bu-s._now>55*60e3 && !(s.boostUntil>s._now),'yalnızca bu mülke 1 saat 2x (tüm mülklere değil)');
 ok(await p.isVisible('.lot[data-i="0"] .lb2'),'binada 2x etiketi görünüyor');
 for(let k=0;k<5;k++){ if(await p.isEnabled('[data-a="lotboost"]').catch(()=>false)){ await tap(p,'[data-a="lotboost"]'); await p.clock.runFor(5400); if(await p.isVisible('#adX:not([disabled])')) await tap(p,'#adX'); await p.clock.runFor(300);} }
 s=await st(p); ok(s.d['ist-0'][0].bu-s._now<=4*3600e3+1000,'mülke 2x en fazla 4 saat birikiyor');
 await p.keyboard.press('Escape'); await p.waitForTimeout(400);
 await tap(p,'.lot[data-i="1"]'); await p.clock.runFor(300); await tap(p,'[data-a="skip"]'); await p.clock.runFor(5300); await tap(p,'#adX'); await p.clock.runFor(400);
 s=await st(p); { const left=(s.d['ist-0'][1].until-s._now)/1000; ok(s.d['ist-0'][1].lvl===0 && left>3 && left<=5.5,'10 dk inşaat reklamla 5 saniyeye indi (kalan '+left.toFixed(1)+' sn)'); }
 ok(await p.isDisabled('#sheetBody .btn[disabled]'),'son saniyelerde hızlandırma kapalı (bitmek üzere)');
 await p.clock.runFor(5500); s=await st(p); ok(s.d['ist-0'][1].lvl===1,'5 saniye sonra inşaat bitti');
 await p.keyboard.press('Escape'); await p.waitForTimeout(380);
 await tap(p,'.lot[data-i="2"]'); await p.clock.runFor(300); await tap(p,'[data-a="skip"]'); await p.clock.runFor(5300); await tap(p,'#adX'); await p.clock.runFor(400);
 s=await st(p); {const rem=(s.d['ist-0'][2].until-s._now)/60e3; ok(rem>262&&rem<271,'5 saatlik tadilattan 30 dk düştü (kalan '+rem.toFixed(1)+' dk)');}
 await p.keyboard.press('Escape'); await p.waitForTimeout(380); await p.clock.runFor(300);
 await p.clock.runFor(800); await tap(p,'.lot[data-i="0"]'); await p.clock.runFor(800); if(!(await p.isVisible('#sheet.on'))){ await p.clock.runFor(800); await tap(p,'.lot[data-i="0"]'); await p.clock.runFor(300);} 
 ok(await p.isVisible('[data-a="up"]'),'bina paneli açıldı');
 await tap(p,'[data-a="up"]'); s=await st(p); ok(s.d['ist-0'][0].up===true,'tadilat başladı');
 await p.keyboard.press('Escape'); await p.waitForTimeout(380); await p.clock.runFor(300);
 await tap(p,'.lot[data-i="1"]'); await p.clock.runFor(900); if(!(await p.isVisible('#sheet.on'))){ await tap(p,'.lot[data-i="1"]'); await p.clock.runFor(300);} 
 await tap(p,'[data-a="del"]'); ok(await p.isVisible('.iconbtn.warn'),'ilk dokunuşta onay istendi');
 await tap(p,'[data-a="del"]'); s=await st(p); ok(s.d['ist-0'][1]===null,'ikinci dokunuşta yıkıldı');
 ok(p.errs.length===0,'konsol hatası yok '+p.errs.join('|')); await p.context().close();

 log('D) semt satın alma ve yokken kazanç');
 p=await page(b,{},`t=>{const d=[0,1,2,3,4].map(()=>Array(20).fill(null)); for(let i=0;i<20;i++) d[0][i]={t:i%2?'ev':'kafe',lvl:2,buf:0,until:0,dur:1,up:false}; return {v:1,cash:2e5,earned:3e5,boostUntil:0,lastSeen:t-2*3600e3,unlocked:1,cur:0,d,fx:[],disc:0,playMs:0,nextAd:9e9,nextEvent:9e9,sound:false,collects:50,seen:{ev:true,kafe:true,dukkan:true,ofis:true},ads:0,skipHint:1}}`);
 ok(await p.isVisible('#modal .card'),'yokken kazanç kartı çıktı');
 const c0=(await st(p)).cash; await tap(p,'[data-a="x3"]'); await p.clock.runFor(5300); await tap(p,'#adX'); s=await st(p); ok(s.cash>c0,'3 kat ödül eklendi');
 ok(!(await p.isHidden('#mapDot')),'semt düğmesinde bildirim noktası var');
 await p.clock.runFor(3000); while(await p.isVisible('#modal .card')){ await tap(p,'#modal .card .txt'); await p.clock.runFor(800); }
 await tap(p,'#mapBtn'); await p.clock.runFor(300); await tap(p,'[data-a="buy"]'); s=await st(p); ok(s.own.length===2&&s.cur==='ist-1','Beşiktaş alındı ve açıldı');
 ok((await p.textContent('#dname')).includes('Beşiktaş'),'üstte yeni semt adı');
 ok(await p.isVisible('#modal .postcard') && (await p.textContent('#modal .postcard')).includes('Çarşı'),'yeni semtte kartpostal + kural (Çarşı semti)');
 await tap(p,'#modal [data-a="ok"]');
 { const n=(await st(p)).d['ist-1'].filter(q=>q&&q.ob).length; ok(n>=3&&n<=4,'yeni semtte '+n+' engelli arsa'); }
 await tap(p,'#menuBtn'); await tap(p,'[data-a="set"]'); await p.clock.runFor(300); await tap(p,'[data-a="reset"]'); await tap(p,'[data-a="reset"]'); s=await st(p); ok(s.own.length===1&&s.cash===150&&s.city===null,'oyun sıfırlandı');
 ok(await p.isVisible('#modal .citycard'),'sıfırlamadan sonra il seçimi soruluyor');
 await tap(p,'#modal .cityopt[data-a="ank"]'); s=await st(p); ok(s.cur==='ank-0','Ankara · Bahçelievler ile yeniden başlandı');
 ok(p.errs.length===0,'konsol hatası yok '+p.errs.join('|')); await p.context().close();


 log('F) günlük ödül, görevler, fırsat, taksi, premium, davet, holding');
 const yest=`(()=>{const d=new Date(Date.now()-864e5);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')})()`;
 const day=n=>`(()=>{const d=new Date(Date.now()-${n}*864e5);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')})()`;
 const today=day(0);
 const baseSeed=extra=>`t=>{const d=[0,1,2,3,4].map(()=>Array(20).fill(null)); for(let i=0;i<6;i++) d[0][i]={t:'ev',lvl:2,buf:i<2?50:0,until:0,dur:1,up:false}; return Object.assign({v:1,cash:1000,earned:5000,boostUntil:0,lastSeen:t,unlocked:1,cur:0,d,fx:[],disc:0,playMs:0,nextAd:9e9,nextEvent:9e9,sound:false,collects:50,seen:{ev:true,kafe:true},ads:0,skipHint:1,daily:{last:${today},streak:1},tasks:null,shares:0,coll:[],ref:{code:'TPAAAA',used:false,rewarded:0},week:{key:'x',earned:0},offer:null,nextOffer:9e9,nextTaxi:9e9,premium:false,notif:true},${extra})}`;
 p=await page(b,{},baseSeed(`{daily:{last:${yest},streak:2}}`));
 await p.clock.runFor(3500); ok((await p.textContent('#modal .card h3').catch(()=>''))?.includes('3. gün'),'dün gelen oyuncuya 3. gün ödülü çıktı');
 let cD=(await st(p)).cash; await tap(p,'#modal [data-a="x1"]'); s=await st(p); ok(s.cash>cD&&s.daily.streak===3,'günlük ödül alındı, seri 3');
 await p.context().close();
 p=await page(b,{},baseSeed(`{daily:{last:${day(3)},streak:4}}`));
 await p.clock.runFor(3500); ok((await p.textContent('#modal .card h3').catch(()=>''))?.includes('bozuldu'),'2 gün kaçırana seri kurtarma teklifi');
 await tap(p,'#modal [data-a="save"]'); await p.clock.runFor(5300); await tap(p,'#adX'); await p.clock.runFor(800);
 ok((await p.textContent('#modal .card h3').catch(()=>''))?.includes('5. gün'),'reklamla seri kurtarıldı (5. gün)');
 await p.context().close();
 p=await page(b,{},baseSeed(`{tasks:{day:${today},bonus:false,list:[{k:'collect',goal:2,prog:2,claimed:false},{k:'build',goal:1,prog:1,claimed:true},{k:'ad',goal:1,prog:1,claimed:true}]},offer:{k:'collect',goal:1,prog:0,until:t+300000,title:'Kira maratonu',rw:5000,done:false},nextTaxi:3000}`));
 ok(!(await p.isHidden('#taskDot')),'görev noktası yanıyor');
 ok(await p.isVisible('#offerPill'),'süreli fırsat bandı görünüyor');
 await tap(p,'#taskBtn'); let cT=(await st(p)).cash; await tap(p,'[data-a="claim"][data-i="0"]'); s=await st(p); ok(s.tasks.list[0].claimed&&s.cash>cT,'görev ödülü alındı');
 await tap(p,'[data-a="bonus"]'); s=await st(p); ok(s.tasks.bonus&&s.boostUntil-s._now>55*60e3,'üç görev bonusu: tüm mülklere 2x · 1 saat');
 await p.keyboard.press('Escape'); await p.waitForTimeout(380);
 await tap(p,'#collectBtn'); await p.clock.runFor(400); { const dbg=await st(p); const h=await p.textContent('#modal .card h3').catch(()=>'YOK'); if(!h.includes('tamam')) log('   dbg',h,JSON.stringify(dbg.offer),dbg.collects,await p.isVisible('#sheet.on')); ok(h.includes('tamam'),'fırsat tamamlandı kartı çıktı'); }
 await tap(p,'#modal [data-a="x1"]'); s=await st(p); ok(s.offer===null,'fırsat ödülü alındı');
 let taxi=false; for(let k=0;k<10&&!taxi;k++){ await p.clock.runFor(1000); taxi=await p.isVisible('.car.taxi'); }
 ok(taxi,'altın taksi geçiyor');
 if(taxi){ const cX=(await st(p)).cash; await p.dispatchEvent('.car.taxi','pointerdown'); s=await st(p); ok(s.cash>cX,'altın taksi yakalandı, para geldi'); }
 await dismiss(p); await tap(p,'#menuBtn'); await tap(p,'[data-a="ref"]'); await p.fill('#refInput','tpxyz9'); await tap(p,'[data-a="usecode"]'); s=await st(p); ok(s.ref.used==='TPXYZ9',"davet kodu kullanıldı"); ok(s.cash>=2000,'davet hediyesi nakit verildi');
 const cRef=s.cash; await p.keyboard.press('Escape'); await p.waitForTimeout(380); await tap(p,'#menuBtn'); await tap(p,'[data-a="store"]'); await tap(p,'[data-a="buy"]'); await tap(p,'#modal [data-a="ok"]'); s=await st(p); ok(s.premium===true,'reklamsız paket alındı (test)');
 await p.keyboard.press('Escape'); await p.waitForTimeout(400); await tap(p,'.lot[data-i="1"]'); await tap(p,'[data-a="lotboost"]'); ok(!(await p.isVisible('#ad:not([hidden])')),'premiumda reklam ekranı açılmıyor'); s=await st(p); ok(s.d['ist-0'][1].bu>s._now,'premiumda mülke 2x anında eklendi');
 ok(p.errs.length===0,'konsol hatası yok '+p.errs.join('|')); await p.context().close();
 p=await page(b,{},baseSeed(`{unlocked:5,earned:1e10}`));
 await tap(p,'#menuBtn'); await tap(p,'[data-a="holding"]'); await tap(p,'[data-a="hold"]'); await tap(p,'[data-a="hold"]'); s=await st(p);
 ok(s.shares===10&&s.own.length===1&&s.cash===150,'holding kuruldu: 10 hisse, Kadıköy\'den yeniden');
 await tap(p,'#modal [data-a="ok"]'); ok((await p.textContent('#rate')).includes('2,0x'),'hisse çarpanı üstte görünüyor');
 ok(p.errs.length===0,'konsol hatası yok '+p.errs.join('|')); await p.context().close();

 log('G) birden fazla ilden arsa');
 const fullSeed=(n,cash)=>`t=>{const d=[0,1,2,3,4].map(()=>Array(20).fill(null)); for(let i=0;i<${n};i++) d[0][i]={t:'ev',lvl:2,buf:0,until:0,dur:1,up:false}; return {v:1,cash:${cash},earned:2e5,boostUntil:0,lastSeen:t,unlocked:1,cur:0,d,fx:[],disc:0,playMs:0,nextAd:9e9,nextEvent:9e9,nextOffer:9e9,nextTaxi:9e9,sound:false,collects:50,seen:{ev:true,kafe:true},ads:0,skipHint:1,daily:{last:${today},streak:1}}}`;
 p=await page(b,{},fullSeed(12,1e5));
 await dismiss(p); await tap(p,'#mapBtn');
 ok(!(await p.$('[data-a="buy"][data-k="izm-0"]')),'ilk semt dolmadan başka ilde arsa satılmıyor');
 ok((await p.textContent('#sheetBody')).includes('İzmir'),'haritada İzmir bölümü var');
 await p.context().close();
 p=await page(b,{},fullSeed(20,1e5));
 await dismiss(p); await tap(p,'#mapBtn');
 ok(await p.isEnabled('[data-a="buy"][data-k="izm-0"]'),'Kadıköy dolunca İzmir · Karşıyaka satışta');
 ok(await p.isVisible('[data-a="buy"][data-k="ank-0"]'),'Ankara · Bahçelievler da satışta');
 ok(!(await p.$('[data-a="buy"][data-k="izm-1"]')),'İzmir\'in 2. semti henüz satılmıyor');
 const r0=await p.evaluate(()=>window.__tapuState().cash);
 await tap(p,'[data-a="buy"][data-k="izm-0"]'); await dismiss(p); s=await st(p);
 ok(s.own.includes('izm-0')&&s.cur==='izm-0'&&!s.lien['izm-0'],'İzmir\'den arsa alındı (60B tapu)');
 ok((await p.textContent('#dname')).includes('İzmir'),'üstte İzmir · Karşıyaka');
 await tap(p,'#mapBtn'); ok(await p.isDisabled('[data-a="buy"][data-k="ank-0"]'),'üçüncü il daha pahalı (600B), parası yetmiyor');
 ok((await p.textContent('#sheetBody')).includes('%10'),'portföy bonusu haritada yazıyor');
 await tap(p,'[data-a="go"][data-k="ist-0"]'); s=await st(p); ok(s.cur==='ist-0','iller arasında geçiş yapıldı');
 ok(p.errs.length===0,'konsol hatası yok '+p.errs.join('|')); await p.context().close();

 log('H) Android dokunmatik (Pixel 7, gerçek dokunuş olayları)');
 {
   const { devices } = require('playwright');
   const ctx = await b.newContext({ ...devices['Pixel 7'] }); const p = await ctx.newPage(); p.errs = [];
   p.on('pageerror', e => p.errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') p.errs.push(m.text()); });
   await p.goto(URL); await p.waitForTimeout(800);
   const cdp = await ctx.newCDPSession(p);
   const touch = async (sel, hold = 110, jitter = 3, fy = 0.5) => {
     const r = await p.locator(sel).first().boundingBox(); const x = r.x + r.width / 2, y = r.y + r.height * fy;
     await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] }); await p.waitForTimeout(hold / 2);
     await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + jitter, y: y + jitter }] }); await p.waitForTimeout(hold / 2);
     await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await p.waitForTimeout(450);
   };
   const S = () => p.evaluate(() => JSON.parse(JSON.stringify(window.__tapuState())));
   await touch('.cityopt[data-a="ank"]'); let s = await S(); ok(s.city === 'ank', 'dokunuşla il seçildi');
   await touch('#modal [data-a="ok"]');
   await touch('.lot[data-i="6"]'); ok(await p.isVisible('#sheet.on'), 'arsaya dokununca panel açık kalıyor');
   await touch('[data-a="build"][data-t="ev"]'); s = await S(); ok(s.d['ank-0'][6] && s.d['ank-0'][6].t === 'ev', 'dokunuşla inşaat başladı');
   await touch('#scrim'); ok(!(await p.isVisible('#sheet.on')), 'boşluğa dokununca panel kapandı');
   await p.evaluate(() => { const st = window.__tapuState(); const l = st.d['ank-0'][6]; l.until = 0; l.lvl = 1; l.buf = 1e6; });
   await p.waitForTimeout(600); const c0 = (await S()).cash;
   await touch('#collectBtn'); s = await S(); ok(s.cash > c0, 'TOPLA mührüne dokununca kira toplandı');
   await touch('#mapBtn'); ok(await p.isVisible('#sheet.on'), 'harita düğmesi açtı');
   await touch('#scrim', 110, 3, 0.1); ok(!(await p.isVisible('#sheet.on')), 'büyük panel de üstteki boşluğa dokununca kapandı');
   await touch('#menuBtn'); await touch('[data-a="set"]'); ok((await p.textContent('#sheetBody')).includes('Nasıl oynanır'), 'menüden ayarlara geçildi');
   await touch('#scrim', 110, 3, 0.1); await p.evaluate(() => { const st = window.__tapuState(); st.d['ank-0'][6].buf = 5e5; }); const cc = (await S()).cash; await touch('#collectBtn'); ok((await S()).cash > cc, 'TOPLA mührü dokunuşla çalışıyor');
   ok(p.errs.length === 0, 'konsol hatası yok ' + p.errs.join('|'));
   await ctx.close();
 }

 log('I) haftalık lig (paylaşılan veritabanı taklidiyle)');
 {
   const ctx = await b.newContext({ viewport: { width: 390, height: 844 } }); const p = await ctx.newPage(); p.errs = [];
   p.on('pageerror', e => p.errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') p.errs.push(m.text()); });
   await p.addInitScript(() => {
     const wk = d => { const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())); const wd = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - wd); const y = t.getUTCFullYear(); return y + '-H' + String(Math.ceil(((t - Date.UTC(y, 0, 1)) / 864e5 + 1) / 7)).padStart(2, '0'); };
     const week = wk(new Date()), store = {};
     const names = ['Ayşe', 'Mert', 'Zeynep', 'Can', 'Elif', 'Burak', 'Deniz', 'Ece', 'Kaan', 'Selin'];
     for (let k = 0; k < 29; k++) store['lb/u' + k] = { week, earned: Math.round(3e6 * Math.pow(0.88, k)), district: 'izm-' + (k % 5), tier: 1, n: names[k % 10] };
     const snap = (id, d) => ({ id, exists: !!d, data: () => d && JSON.parse(JSON.stringify(d)) });
     const db = {
       doc: path => ({ get: async () => snap(path.split('/').pop(), store[path]), set: async v => { store[path] = JSON.parse(JSON.stringify(v)); }, delete: async () => { delete store[path]; } }),
       collection: name => ({ where: (f, op, v) => ({ get: async () => (window.__queries = (window.__queries || 0) + 1, { docs: Object.keys(store).filter(k => k.startsWith(name + '/') && store[k][f] === v).map(k => snap(k.split('/').pop(), store[k])) }) }) }),
     };
     const user = { id: async () => 'me', profiles: async ids => Object.fromEntries(ids.map(id => [id, { name: id === 'me' ? 'Ben' : (store['lb/' + id] || {}).n || '' }])) };
     window.claude = { use: async n => (n === 'db' ? db : n === 'user' ? user : null) };
     window.__store = store;
     if (!sessionStorage.getItem('s')) { sessionStorage.setItem('s', 1); const t = Date.now(); const d = [0, 1, 2, 3, 4].map(() => Array(20).fill(null)); for (let i = 0; i < 6; i++) d[0][i] = { t: 'ev', lvl: 2, buf: 0, until: 0, dur: 1, up: false };
       localStorage.setItem('tapu-save-v1', JSON.stringify({ v: 1, cash: 1000, earned: 5e6, unlocked: 1, cur: 0, d, lastSeen: t, nextAd: 9e9, nextEvent: 9e9, nextOffer: 9e9, nextTaxi: 9e9, sound: false, collects: 50, seen: { ev: true }, daily: { last: new Date().getFullYear() + '-' + String(new Date().getMonth() + 1).padStart(2, '0') + '-' + String(new Date().getDate()).padStart(2, '0'), streak: 1 }, week: { key: week, earned: 1.5e6 }, league: { tier: 1, seals: 0, last: '' } })); }
   });
   await p.goto(URL); await p.waitForTimeout(1500);
   await dismiss(p);
   await tap(p, '#menuBtn'); ok((await p.textContent('#sheetBody')).includes('Haftalık lig'), 'menüde haftalık lig satırı');
   await tap(p, '[data-a="lb"]'); await p.waitForTimeout(800);
   const body = await p.textContent('#sheetBody');
   ok(body.includes('Kat Ligi') && body.includes('30 emlakçı'), 'lig başlığı: Kat Ligi, 30 emlakçı');
   ok(await p.isVisible('.lgline.up') && await p.isVisible('.lgline.down'), 'yükselme ve düşme çizgileri çiziliyor');
   const me = await p.textContent('.lbr.me'); ok(/Sen/.test(me) && /5\. sıraya/.test(me), 'senin satırın vurgulu, "5. sıraya … kaldı" yazıyor');
   ok((await p.$$('.lglist .lbr')).length === 30, '30 satır');
   await p.screenshot({ path: out + 'I-lig.png' }); await p.evaluate(() => document.querySelector('.lbr.me').scrollIntoView({ block: 'center' })); await p.screenshot({ path: out + 'I-lig-ben.png' });
   ok(await p.evaluate(() => [...document.querySelectorAll('.lglist > *')].findIndex(e => e.classList.contains('lgline') && e.classList.contains('up')) === 5), 'yükselme çizgisi 5. sıranın altında');
   await tap(p, '[data-a="leagues"]'); ok((await p.$$('.lgtier')).length === 5 && (await p.textContent('.lgtier.here')).includes('Kat Ligi'), 'lig basamakları: 5 lig, "buradasın" Kat Ligi\'nde');
   await p.screenshot({ path: out + 'I-basamak.png' });
   await tap(p, '[data-a="back"]'); ok(await p.isVisible('.lglist'), 'tabloya geri dönüldü');
   const q0 = await p.evaluate(() => window.__queries);
   await p.keyboard.press('Escape'); await p.waitForTimeout(400); await tap(p, '#menuBtn'); await tap(p, '[data-a="lb"]'); await p.waitForTimeout(500);
   ok(await p.isVisible('.lglist') && (await p.evaluate(() => window.__queries)) === q0, 'lig tablosu 5 dk önbellekte: tekrar açınca veritabanı sorgulanmıyor');
   await p.keyboard.press('Escape'); await p.waitForTimeout(400);
   const c0 = await p.evaluate(() => window.__tapuState().cash);
   await p.evaluate(() => window.__tapuTest.showLeagueResult({ week: '2026-H43', from: 1, to: 2, rank: 3, size: 30, seal: false }));
   await p.waitForTimeout(400);
   ok((await p.textContent('#modal .card')).includes('Apartman Ligine yükseldin'), 'terfi kartı: "Apartman Ligine yükseldin"');
   await p.screenshot({ path: out + 'I-terfi.png' });
   await tap(p, '#modal [data-a="ok"]'); let st = await p.evaluate(() => JSON.parse(JSON.stringify(window.__tapuState())));
   ok(st.cash > c0 && !(st.boostUntil > Date.now()) && st.league.tier === 2, 'büyük ikramiye verildi (2x yok), lig Apartman oldu');
   await p.evaluate(() => window.__tapuTest.showLeagueResult({ week: '2026-H43', from: 1, to: 2, rank: 3, size: 30, seal: false }));
   await p.waitForTimeout(300); ok(!(await p.isVisible('#modal .card')), 'aynı haftanın kartı ikinci kez çıkmıyor');
   ok(p.errs.length === 0, 'konsol hatası yok ' + p.errs.join('|'));
   await ctx.close();
 }

 log('J) kılavuz');
 {
   p=await page(b,{},baseSeed(`{collects:0}`));
   await dismiss(p);
   ok(await p.isVisible('#guideBtn'), 'ana ekranda kılavuz sekmesi var');
   ok(await p.isHidden('#guideHint'), 'tanıtım balonu henüz yok');
   await tap(p,'#collectBtn'); await p.clock.runFor(3000);
   ok(await p.isVisible('#guideHint') && await p.evaluate(() => document.querySelector('#guideBtn').classList.contains('wig')), 'ilk kira toplanınca sekme bir kez tanıtılıyor');
   await p.clock.runFor(6500); ok(await p.isHidden('#guideHint'), 'tanıtım 6 sn sonra kayboluyor');
   s=await st(p); ok(s.guideHint===true, 'tanıtım bir daha gösterilmeyecek');
   await tap(p,'#guideBtn'); ok((await p.$$('.gditem')).length===17, 'kılavuzda 17 madde');
   await tap(p,'.gditem[data-i="2"]'); let t=await p.textContent('#sheetBody');
   ok(t.includes('Madde 03') && t.includes('Kira ve kumbara') && t.includes('1 dk 30 sn')||t.includes('90'), 'madde 03: kira ve kumbara, sayılar ayarlardan');
   await tap(p,'[data-a="next"]'); ok((await p.textContent('#sheetBody')).includes('Madde 04'), 'sonraki maddeye geçildi');
   await tap(p,'[data-a="prev"]'); await tap(p,'[data-a="prev"]'); ok((await p.textContent('#sheetBody')).includes('Madde 02'), 'önceki maddeye dönüldü');
   await tap(p,'[data-a="list"]'); ok(await p.isVisible('.gdlist'), 'listeye dönüldü');
   // her madde hatasız açılıyor
   let bad=[]; for (let k=0;k<17;k++){ await tap(p,`.gditem[data-i="${k}"]`); const tx=await p.textContent('#sheetBody'); if(!tx.includes('Madde '+String(k+1).padStart(2,'0'))||/undefined|NaN/.test(tx)) bad.push(k+1); await tap(p,'[data-a="list"]'); }
   ok(bad.length===0, '17 maddenin hepsi açılıyor, "undefined/NaN" yok '+bad.join(','));
   await p.keyboard.press('Escape'); await p.waitForTimeout(400);
   await tap(p,'#menuBtn'); await tap(p,'[data-a="set"]'); await tap(p,'[data-a="guide"]'); ok(await p.isVisible('.gdlist'), 'ayarlardan da kılavuza ulaşılıyor');
   await p.screenshot({path:out+'J-kilavuz.png'});
   ok(p.errs.length===0,'konsol hatası yok '+p.errs.join('|')); await p.context().close();
 }

 log('K) otomatik toplama');
 {
   p=await page(b,{},baseSeed(`{}`));
   await dismiss(p);
   await tap(p,'#menuBtn'); await tap(p,'[data-a="set"]'); await tap(p,'[data-a="cm-auto"]'); s=await st(p); ok(s.collectMode==='auto','ayarlardan otomatiğe geçildi');
   await p.keyboard.press('Escape'); await p.waitForTimeout(400);
   ok((await p.textContent('#collectBtn')).includes('OTO') && !(await p.$('.lot .fill')),'ortada OTO, binalarda doluluk çubuğu yok');
   const a0=(await st(p)).cash; await p.clock.runFor(20000); s=await st(p);
   ok(s.cash>a0 && Object.values(s.d).flat().every(q=>!q||q.buf<1),'kira hiçbir şeye basmadan kasaya aktı');
   await tap(p,'#collectBtn'); ok(!(await p.isVisible('#ad:not([hidden])')),'OTO mührü reklam açmıyor');
   ok(p.errs.length===0,'konsol hatası yok '+p.errs.join('|')); await p.context().close();
 }

 log('L) yeni özellikler: teslim anı, semt hedefleri, karma komşuluk, özel tapu, bayram, Rıfkı Abi');
 {
   // teslim anı
   p=await page(b,{},`t=>{const d=[0,1,2,3,4].map(()=>Array(20).fill(null)); d[0][6]={t:'ofis',lvl:0,buf:0,until:t+3000,dur:600000,up:false}; return {v:1,cash:1000,earned:5000,boostUntil:0,lastSeen:t,unlocked:1,cur:0,d,fx:[],disc:0,playMs:0,nextAd:9e9,nextEvent:9e9,nextOffer:9e9,nextTaxi:9e9,sound:false,collects:50,seen:{ev:true},ads:0,skipHint:1,guideHint:true,rifki:false,daily:{last:${today},streak:1}}}`);
   await dismiss(p); await p.clock.runFor(300);
   ok(await p.isVisible('.lot[data-i="6"] .cd') && /0:0\d/.test(await p.textContent('.lot[data-i="6"] .cd')),'son 5 saniyede geri sayım görünüyor');
   await p.clock.runFor(3200); ok(await p.isVisible('.lot[data-i="6"] .teslim') && (await p.textContent('.lot[data-i="6"] .teslim')).includes('TESLİM'),'inşaat bitince TESLİM mührü vuruluyor');
   await p.clock.runFor(2200); ok(!(await p.$('.lot[data-i="6"] .teslim')),'mühür kısa süre sonra kalkıyor');
   ok(p.errs.length===0,'konsol hatası yok '+p.errs.join('|')); await p.context().close();

   // semt hedefleri + karma komşuluk + özel tapu
   p=await page(b,{},`t=>{const d=[0,1,2,3,4].map(()=>Array(20).fill(null)); const B=(x,l)=>({t:x,lvl:l,buf:0,until:0,dur:1,up:false}); d[0][0]=B('ev',1); d[0][1]=B('ev',1); d[0][4]=B('ev',1); d[0][5]=B('ev',1); d[0][2]=B('ev',5); d[0][8]=B('kafe',1); d[0][9]=B('ofis',1); return {v:1,cash:1e9,earned:1e9,boostUntil:0,lastSeen:t,unlocked:1,cur:0,d,fx:[],disc:0,playMs:0,nextAd:9e9,nextEvent:9e9,nextOffer:9e9,nextTaxi:9e9,sound:false,collects:50,seen:{ev:true,kafe:true,dukkan:true,ofis:true},ads:0,skipHint:1,guideHint:true,rifki:false,daily:{last:${today},streak:1}}}`);
   await dismiss(p); await p.clock.runFor(2600); await dismiss(p);
   let s2=await st(p); ok((s2.stars['ist-0']||[]).includes(0) && (s2.stars['ist-0']||[]).includes(1),'iki semt hedefi tamamlandı, 2 yıldız');
   await tap(p,'#mapBtn'); ok(await p.isVisible('.goals') && (await p.textContent('.goals')).includes('2/3'),'haritada semt hedefleri kartı: 2/3');
   await p.keyboard.press('Escape'); await p.waitForTimeout(400);
   await tap(p,'.lot[data-i="8"]'); ok(await p.isVisible('.nbgrid .nb.pair') && (await p.textContent('#sheetBody')).includes('Akıllı ikili'),'mülk panelinde komşuluk şeması: akıllı ikili +%10');
   await p.keyboard.press('Escape'); await p.waitForTimeout(400);
   await tap(p,'#menuBtn'); await tap(p,'[data-a="ozel"]'); ok((await p.textContent('#sheetBody')).includes('Haftanın özel tapusu'),'özel tapu paneli açıldı');
   await tap(p,'[data-a="buyozel"]'); s2=await st(p); ok(s2.inv.length===1 && s2.ozel.bought,'özel tapu satın alındı, depoda');
   ok(await p.isDisabled('#sheetBody .btn[disabled]'),'haftada bir kez alınabiliyor');
   await p.keyboard.press('Escape'); await p.waitForTimeout(400);
   await tap(p,'.lot[data-i="15"]'); await tap(p,'[data-a="place"]'); s2=await st(p);
   ok(s2.d['ist-0'][15] && s2.d['ist-0'][15].sp && s2.inv.length===0 && await p.isVisible('.lot[data-i="15"].k-ozel'),'özel yapı arsaya yerleştirildi');
   await tap(p,'.lot[data-i="15"]'); ok(!(await p.$('[data-a="up"]')) && await p.isVisible('[data-a="lotboost"]'),'özel yapıda kat çıkma yok, mülke 2x var');
   await tap(p,'[data-a="del"]'); await tap(p,'[data-a="del"]'); s2=await st(p); ok(s2.d['ist-0'][15]===null && s2.inv.length===1,'yıkılan özel yapı depoya döndü');
   ok(p.errs.length===0,'konsol hatası yok '+p.errs.join('|')); await p.context().close();

   // bayram (29 Ekim)
   p=await page(b,{time:new Date('2026-10-29T12:00:00')},baseSeed(`{rifki:false,guideHint:true}`));
   const titles=[]; for(let k=0;k<5&&await p.isVisible('#modal .card');k++){ titles.push(await p.textContent('#modal .card h3')); await tap(p,'#modal .card .txt'); await p.clock.runFor(3000); }
   for(let k=0;k<3;k++){ await p.clock.runFor(1500); if(await p.isVisible('#modal .card')){ titles.push(await p.textContent('#modal .card h3')); await tap(p,'#modal .card .txt'); } }
   ok(await p.isVisible('#festBar') && (await p.textContent('#festBar')).includes('Cumhuriyet'),'29 Ekim: bayram şeridi görünüyor');
   ok(titles.some(x=>x.includes('Bayram ikramiyesi')),'bayram ikramiyesi kartı çıktı');
   ok((await p.textContent('#rate')).includes('+%20'),'kira göstergesinde +%20');
   ok(await p.evaluate(()=>document.body.classList.contains('fest-milli')),'harita bayrak zinciriyle süslendi');
   ok(p.errs.length===0,'konsol hatası yok '+p.errs.join('|')); await p.context().close();

   // Rıfkı Abi
   p=await page(b,{},baseSeed(`{guideHint:true}`));
   await dismiss(p); let seen=false; for(let k=0;k<12&&!seen;k++){ await p.clock.runFor(5000); await dismiss(p); seen=await p.isVisible('#rifki'); }
   ok(seen && (await p.textContent('#rifki')).includes('RIFKI ABİ'),'Rıfkı Abi bir ipucu verdi');
   await p.waitForTimeout(600); ok(await p.evaluate(()=>getComputedStyle(document.querySelector('#rifki')).opacity==='1' && document.body.classList.contains('idle')),'oyuncu boştayken bile balon tamamen görünür (animasyon donmuyor)');
   await tap(p,'#rifki .rk-x'); ok(await p.isHidden('#rifki'),'× ile kapandı');
   await tap(p,'#menuBtn'); await tap(p,'[data-a="set"]'); await tap(p,'[data-a="rifki"]'); s2=await st(p); ok(s2.rifki===false,'ayarlardan kapatıldı');
   ok(p.errs.length===0,'konsol hatası yok '+p.errs.join('|')); await p.context().close();
 }

 log('M) semt geçişleri: kapora, engelli arsa, ilerleme çubuğu, semt özeti, kural');
 {
   const seedFull=(cash)=>`t=>{const d=[0,1,2,3,4].map(()=>Array(20).fill(null)); for(let i=0;i<20;i++) d[0][i]={t:i%2?'ev':'kafe',lvl:2,buf:0,until:0,dur:1,up:false}; return {v:1,cash:${cash},earned:3e5,boostUntil:0,lastSeen:t,unlocked:1,cur:0,d,fx:[],disc:0,playMs:0,nextAd:9e9,nextEvent:9e9,nextOffer:9e9,nextTaxi:9e9,sound:false,collects:50,seen:{ev:true,kafe:true},ads:0,skipHint:1,guideHint:true,rifki:false,daily:{last:${today},streak:1}}}`;
   p=await page(b,{},seedFull(30000));
   await dismiss(p); await p.clock.runFor(2600); await dismiss(p);
   await p.evaluate(()=>{ window.__tapuState().cash=30000; }); await p.clock.runFor(400); // yıldız ödüllerinden sonra kasa sabitlenir
   const bar=await p.textContent('#distBar'); ok(bar.includes('%100') && bar.includes('Beşiktaş kaporası verilebilir'),'çubuk: semt %100, altta "Beşiktaş kaporası verilebilir"');
   await tap(p,'#mapBtn'); ok(await p.isEnabled('[data-a="kapora"][data-k="ist-1"]') && await p.isDisabled('[data-a="buy"][data-k="ist-1"]'),'tapuya yetmiyor, kapora verilebiliyor');
   await tap(p,'[data-a="kapora"][data-k="ist-1"]'); let s3=await st(p);
   ok(s3.cur==='ist-1' && Math.abs(s3.lien['ist-1']-56000)<1 && Math.abs(30000-s3.cash-24000)<1,'kapora verildi: ₺24B peşin, ₺56B borç');
   await tap(p,'#modal [data-a="ok"]');
   ok((await p.textContent('#distBar')).includes('kaporalı'),'çubuk kaporalı semti ve borcu gösteriyor');
   // 4 arsa sınırı
   await p.evaluate(()=>{ const st=window.__tapuState(); st.cash=1e6; const L=st.d['ist-1']; let n=0; for(let i=0;i<20&&n<4;i++) if(!L[i]){ L[i]={t:'ev',lvl:1,buf:0,until:0,dur:1,up:false}; n++; } });
   await p.clock.runFor(600);
   const free=await p.evaluate(()=>window.__tapuState().d['ist-1'].findIndex(q=>!q));
   ok(await p.isVisible(`.lot[data-i="${free}"].lk`),'4 arsadan sonra kalan arsalar kilitli görünüyor');
   await tap(p,`.lot[data-i="${free}"]`); ok((await p.textContent('#sheetBody')).includes('Kilitli arsa'),'kilitli arsada borç açıklaması');
   await tap(p,'[data-a="payoff"]'); s3=await st(p); ok(!s3.lien['ist-1'],'borç kasadan kapatıldı, 20 arsa açık');
   await p.keyboard.press('Escape'); await p.waitForTimeout(400);
   // engelli arsa temizleme
   const ob=await p.evaluate(()=>window.__tapuState().d['ist-1'].findIndex(q=>q&&q.ob));
   ok(ob>=0 && await p.isVisible(`.lot[data-i="${ob}"].ob`),'engelli arsa haritada çiziliyor');
   const c0=(await st(p)).cash; await tap(p,`.lot[data-i="${ob}"]`); await tap(p,'[data-a="clear"]'); s3=await st(p);
   ok(s3.d['ist-1'][ob]===null && s3.cash>c0-50000,'engel temizlendi, eski eşyadan para çıktı');
   await dismiss(p);
   // borç kiradan ödenir
   await p.evaluate(()=>{ const st=window.__tapuState(); st.lien['ist-1']=50; st.lienT['ist-1']=56000; }); await p.clock.runFor(4000); s3=await st(p);
   ok(!s3.lien['ist-1'],'kalan borç semtin kirasından kendiliğinden ödendi');
   // semt özeti
   await p.clock.runFor(8000); await dismiss(p); await p.keyboard.press('Escape'); await p.waitForTimeout(400); await tap(p,'#mapBtn'); await tap(p,'[data-a="go"][data-k="ist-0"]');
   ok(await p.isVisible('#sumBar') && (await p.textContent('#sumBar')).includes('Kadıköy sen Beşiktaş’tayken'),'semt özeti: "Kadıköy sen Beşiktaş’tayken … kazandı"');
   // kural: Beşiktaş kafeleri +%20
   ok(p.errs.length===0,'konsol hatası yok '+p.errs.join('|')); await p.context().close();
 }

 log('E) ekran boyutları');
 for(const vp of [{width:320,height:568},{width:360,height:640},{width:412,height:915},{width:768,height:1024},{width:1280,height:720}]){
   p=await page(b,{vp});
   const m=await p.evaluate(()=>{ const g=document.querySelector('.plate').getBoundingClientRect(), d=document.querySelector('.dock').getBoundingClientRect(), top=document.querySelector('.top').getBoundingClientRect(); return {sw:document.documentElement.scrollWidth, w:innerWidth, h:innerHeight, gb:g.bottom, gt:g.top, topb:top.bottom, db:d.bottom, lot:document.querySelector('.lot').getBoundingClientRect().width}; });
   ok(m.sw<=m.w && m.db<=m.h+1 && m.gt>=m.topb-1, `${vp.width}x${vp.height}: taşma yok, arsa ${Math.round(m.lot)}px`);
   const gt=await p.evaluate(()=>{ const g=document.querySelector('#guideBtn').getBoundingClientRect(); const hit=[...document.querySelectorAll('.lot')].some(l=>{const r=l.getBoundingClientRect(); return !(r.right<=g.left||r.left>=g.right||r.bottom<=g.top||r.top>=g.bottom);}); return {hit, inView:g.right<=innerWidth+1&&g.left>=0&&g.width>0}; });
   ok(!gt.hit && gt.inView, `${vp.width}x${vp.height}: kılavuz sekmesi görünür ve hiçbir arsanın üstüne binmiyor`);
   if(vp.width===320) await p.screenshot({path:out+'E320.png'});
   await p.context().close();
 }
 log('\nSONUÇ:',fails.length?fails.length+' sorun':'hepsi geçti'); await b.close(); process.exit(fails.length?1:0);
})();
