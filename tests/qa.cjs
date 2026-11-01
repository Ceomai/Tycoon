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
  await p.clock.install();
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
 let s=await st(p); ok(s.city==='izm'&&s.cur==='izm-0'&&s.own.join()==='izm-0','İzmir seçildi, Karşıyaka açık');
 ok((await p.textContent('#dname')).includes('Karşıyaka'),'üstte İzmir · Karşıyaka');
 ok(await p.isVisible('#bubble:not([data-off])'),'yönlendirme balonu görünüyor');
 await tap(p,'.lot[data-i="5"]'); await p.clock.runFor(400);
 ok(await p.isVisible('#sheet.on'),'arsa paneli açıldı');
 await tap(p,'[data-a="build"][data-t="ev"]'); await p.clock.runFor(300);
 s=await st(p); ok(s.cash===50 && s.d['izm-0'][5]&&s.d['izm-0'][5].t==='ev','ev inşaatı başladı, kasa 150→50');
 await p.clock.runFor(11000); { const sv=await saved(p); ok(sv&&sv.city==='izm'&&sv.d['izm-0'][5],'kayıt sağlamalı biçimde yazıldı'); }
 await p.clock.runFor(10000); s=await st(p); ok(s.d['izm-0'][5].lvl===1,'inşaat 20 sn sonra bitti');
 await p.clock.runFor(15000); ok(await p.isVisible('.lot[data-i="5"] .coin'),'kira parası çıktı');
 const before=(await st(p)).cash; await tap(p,'.lot[data-i="5"]'); s=await st(p); ok(s.cash>before,'dokununca kira toplandı');
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
 await tap(p,'#boostBtn'); await p.clock.runFor(300); ok(await p.isVisible('#ad:not([hidden])'),'2x reklamı açıldı');
 ok(await p.isDisabled('#adX'),'süre bitmeden kapatılamıyor');
 await p.clock.runFor(5200); await tap(p,'#adX'); s=await st(p); ok(s.boostUntil-s._now>25*60e3,'2x gelir 30 dk eklendi');
 for(let k=0;k<9;k++){ await tap(p,'#boostBtn'); await p.clock.runFor(5400); if(await p.isVisible('#adX:not([disabled])')) await tap(p,'#adX'); await p.clock.runFor(300);} 
 s=await st(p); ok(s.boostUntil-s._now<=4*3600e3+1000,'2x en fazla 4 saat birikiyor');
 await tap(p,'.lot[data-i="1"]'); await p.clock.runFor(300); await tap(p,'[data-a="skip"]'); await p.clock.runFor(5300); await tap(p,'#adX'); await p.clock.runFor(400);
 s=await st(p); ok(s.d['ist-0'][1].lvl===1,'10 dk inşaat reklamla anında bitti');
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
 await tap(p,'[data-a="bonus"]'); s=await st(p); ok(s.tasks.bonus&&s.boostUntil>s._now,'üç görev bonusu + 2x');
 await p.keyboard.press('Escape'); await p.waitForTimeout(380);
 await tap(p,'.lot[data-i="0"]'); await p.clock.runFor(400); { const dbg=await st(p); const h=await p.textContent('#modal .card h3').catch(()=>'YOK'); if(!h.includes('tamam')) log('   dbg',h,JSON.stringify(dbg.offer),dbg.collects,await p.isVisible('#sheet.on')); ok(h.includes('tamam'),'fırsat tamamlandı kartı çıktı'); }
 await tap(p,'#modal [data-a="x1"]'); s=await st(p); ok(s.offer===null,'fırsat ödülü alındı');
 let taxi=false; for(let k=0;k<10&&!taxi;k++){ await p.clock.runFor(1000); taxi=await p.isVisible('.car.taxi'); }
 ok(taxi,'altın taksi geçiyor');
 if(taxi){ const cX=(await st(p)).cash; await p.dispatchEvent('.car.taxi','pointerdown'); s=await st(p); ok(s.cash>cX,'altın taksi yakalandı, para geldi'); }
 await dismiss(p); await tap(p,'#menuBtn'); await tap(p,'[data-a="ref"]'); await p.fill('#refInput','tpxyz9'); await tap(p,'[data-a="usecode"]'); s=await st(p); ok(s.ref.used==='TPXYZ9'&&s.boostUntil-s._now>3600e3,'davet kodu kullanıldı, 2 saat 2x');
 await p.keyboard.press('Escape'); await p.waitForTimeout(380); await tap(p,'#menuBtn'); await tap(p,'[data-a="store"]'); await tap(p,'[data-a="buy"]'); await tap(p,'#modal [data-a="ok"]'); s=await st(p); ok(s.premium===true,'reklamsız paket alındı (test)');
 const b0=s.boostUntil; await tap(p,'#boostBtn'); ok(!(await p.isVisible('#ad:not([hidden])')),'premiumda reklam ekranı açılmıyor'); s=await st(p); ok(s.boostUntil>b0,'premiumda 2x anında eklendi');
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
 await tap(p,'[data-a="buy"][data-k="izm-0"]'); s=await st(p);
 ok(s.own.includes('izm-0')&&s.cur==='izm-0'&&r0-s.cash>=59e3,'İzmir\'den arsa alındı (60B tapu)');
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
   await touch('.lot[data-i="6"]'); ok(await p.isVisible('#sheet.on'), 'arsaya dokununca panel açık kalıyor');
   await touch('[data-a="build"][data-t="ev"]'); s = await S(); ok(s.d['ank-0'][6] && s.d['ank-0'][6].t === 'ev', 'dokunuşla inşaat başladı');
   await touch('#scrim'); ok(!(await p.isVisible('#sheet.on')), 'boşluğa dokununca panel kapandı');
   await p.evaluate(() => { const st = window.__tapuState(); const l = st.d['ank-0'][6]; l.until = 0; l.lvl = 1; l.buf = 1e6; });
   await p.waitForTimeout(600); const c0 = (await S()).cash;
   await touch('.lot[data-i="6"]'); s = await S(); ok(s.cash > c0 && !(await p.isVisible('#sheet.on')), 'paraya dokununca toplandı, panel açılmadı');
   await touch('#mapBtn'); ok(await p.isVisible('#sheet.on'), 'harita düğmesi açtı');
   await touch('#scrim', 110, 3, 0.1); ok(!(await p.isVisible('#sheet.on')), 'büyük panel de üstteki boşluğa dokununca kapandı');
   await touch('#menuBtn'); await touch('[data-a="set"]'); ok((await p.textContent('#sheetBody')).includes('Nasıl oynanır'), 'menüden ayarlara geçildi');
   await touch('#scrim', 110, 3, 0.1); await touch('#boostBtn'); ok(await p.isVisible('#ad:not([hidden])'), '2x düğmesi reklamı açtı');
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
   ok(st.cash > c0 && st.boostUntil > Date.now() + 2.5 * 3600e3 && st.league.tier === 2, 'ikramiye + 3 saat 2x verildi, lig Apartman oldu');
   await p.evaluate(() => window.__tapuTest.showLeagueResult({ week: '2026-H43', from: 1, to: 2, rank: 3, size: 30, seal: false }));
   await p.waitForTimeout(300); ok(!(await p.isVisible('#modal .card')), 'aynı haftanın kartı ikinci kez çıkmıyor');
   ok(p.errs.length === 0, 'konsol hatası yok ' + p.errs.join('|'));
   await ctx.close();
 }

 log('E) ekran boyutları');
 for(const vp of [{width:320,height:568},{width:360,height:640},{width:412,height:915},{width:768,height:1024},{width:1280,height:720}]){
   p=await page(b,{vp});
   const m=await p.evaluate(()=>{ const g=document.querySelector('.plate').getBoundingClientRect(), d=document.querySelector('.dock').getBoundingClientRect(), top=document.querySelector('.top').getBoundingClientRect(); return {sw:document.documentElement.scrollWidth, w:innerWidth, h:innerHeight, gb:g.bottom, gt:g.top, topb:top.bottom, db:d.bottom, lot:document.querySelector('.lot').getBoundingClientRect().width}; });
   ok(m.sw<=m.w && m.db<=m.h+1 && m.gt>=m.topb-1, `${vp.width}x${vp.height}: taşma yok, arsa ${Math.round(m.lot)}px`);
   if(vp.width===320) await p.screenshot({path:out+'E320.png'});
   await p.context().close();
 }
 log('\nSONUÇ:',fails.length?fails.length+' sorun':'hepsi geçti'); await b.close(); process.exit(fails.length?1:0);
})();
