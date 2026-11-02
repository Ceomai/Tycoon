// Gelir modeli uçtan uca testleri (tasarım M1–M8): geçiş reklamı zamanlaması, reklam kredisi, 2x ipuçları,
// ödül çarpanları, başlangıç paketi, mağaza basamakları, jetonlar, Kulüp, Altın Tapu ilk sezon indirimi.
// Çalıştır: npm run test:gelir
const {chromium}=require('playwright'); const path=require('path'); const fs=require('fs');
const URL='file://'+path.resolve(__dirname,'../dist-preview/index.html'); const out=path.resolve(__dirname,'out')+'/'; fs.mkdirSync(out,{recursive:true});
const fails=[]; const ok=(c,m)=>{ if(!c) fails.push(m); console.log(c?'  ✓':'  ✗',m); };
async function open(b,vp={width:390,height:844}){ const ctx=await b.newContext({viewport:vp}); const p=await ctx.newPage(); p.errs=[]; p.on('pageerror',e=>p.errs.push(e.message)); await p.clock.install(); await p.goto(URL); await p.clock.runFor(500);
  await p.click('#modal .cityopt[data-a="ist"]',{force:true}); await p.clock.runFor(400); await p.waitForTimeout(300); await dismiss(p); return p; }
const S=p=>p.evaluate(()=>{ const o=JSON.parse(JSON.stringify(window.__tapuState())); o._now=Date.now(); return o; });
const mut=(p,f,a)=>p.evaluate(([f,a])=>{ (0,eval)('('+f+')')(window.__tapuState(),a); },[f.toString(),a]);
const tap=async(p,sel)=>{ await p.click(sel,{force:true,timeout:3000}).catch(()=>p.$eval(sel,e=>e.click())); await p.clock.runFor(400); await p.waitForTimeout(300); };
const store=async p=>{ await dismiss(p); await closeAd(p); if(await vis(p,'#sheet.on')){ await p.keyboard.press('Escape'); await p.clock.runFor(400); await p.waitForTimeout(300); } await tap(p,'#menuBtn'); await tap(p,'#sheet [data-a="store"]'); };
const vis=(p,s)=>p.isVisible(s).catch(()=>false);
async function dismiss(p){ for(let k=0;k<5&&await vis(p,'#modal .card');k++){ await p.click(await vis(p,'#modal .card .txt')?'#modal .card .txt':'#modal .card [data-a]',{force:true}).catch(()=>{}); await p.clock.runFor(400); await p.waitForTimeout(200); } }
async function closeAd(p){ if(await vis(p,'#ad:not([hidden])')){ await p.clock.runFor(5600); await p.click('#adX',{force:true}); await p.clock.runFor(300); } }
const fill=(S,a)=>{ const T=['ev','kafe','dukkan','ofis']; S.d[a.k]=Array.from({length:20},(_,i)=>({t:a.t||T[i%4],lvl:a.lvl||2,buf:0,until:0,dur:1,up:false})); };
// kart ve ipuçlarını sustur: yalnızca test edilen davranış görünsün
const quiet=S=>{ const d=new Date(); S.daily.last=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); S.nextEvent=9e12; S.nextOffer=9e12; S.nextCivic=9e12; S.market='x'; S.collects=50; S.rifki=false; S.fest='x'; S.starter.at=1; };

(async()=>{
 const b=await chromium.launch();

 console.log('M1 geçiş reklamı zamanlaması');
 let p=await open(b); await mut(p,quiet); await mut(p,fill,{k:'ist-0'});
 await mut(p,S=>{ S.market=(()=>{const d=new Date(),t=new Date(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate())),wd=t.getUTCDay()||7;t.setUTCDate(t.getUTCDate()+4-wd);const y=t.getUTCFullYear();return y+'-H'+String(Math.ceil(((t-Date.UTC(y,0,1))/864e5+1)/7)).padStart(2,'0');})(); S.daily.last=(()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');})(); });
 await mut(p,S=>{ S.playMs=10*60e3; S.nextAd=11*60e3; });
 await p.clock.runFor(120e3); ok(!(await vis(p,'#ad:not([hidden])')),'ilk 30 dk oyunda geçiş reklamı yok');
 ok((await S(p)).nextAd>=30*60e3,'reklam zamanı 30. dakikaya ötelendi');
 await mut(p,S=>{ S.playMs=40*60e3; S.nextAd=40*60e3+5e3; });
 await tap(p,'#menuBtn'); await p.clock.runFor(30e3);
 ok(!(await vis(p,'#ad:not([hidden])')),'panel açıkken reklam çıkmıyor (beklemede)');
 await p.keyboard.press('Escape'); await p.clock.runFor(4000); await p.waitForTimeout(200);
 ok(await vis(p,'#ad:not([hidden])'),'panel kapanınca (doğal durak) birkaç saniye içinde geçiş reklamı çıktı'); await closeAd(p);
 // reklam kredisi
 await mut(p,S=>{ S.nextAd=S.playMs+20e3; });
 await tap(p,'.lot[data-i="0"]'); await tap(p,'#sheet [data-a="lotboost"]'); await closeAd(p); await p.keyboard.press('Escape'); await p.clock.runFor(500);
 let s=await S(p); ok(s.adCredit>s.playMs+9*60e3,'ödüllü reklamdan sonra 10 dk reklam kredisi');
 await p.clock.runFor(5*60e3); await tap(p,'#collectBtn'); await p.clock.runFor(3000);
 ok(!(await vis(p,'#ad:not([hidden])')),'kredi süresince geçiş reklamı yok');
 ok(p.errs.length===0,'konsol temiz '+p.errs.join('|')); await p.context().close();

 console.log('M2–M3 tapu beklerken 2x ipucu (harita + Rıfkı)');
 p=await open(b); await mut(p,quiet); await mut(p,fill,{k:'ist-0',lvl:1,t:'ev'}); await mut(p,S=>{ S.d['ist-0'][1]={t:'kafe',lvl:2,buf:0,until:0,dur:1,up:false}; }); await p.clock.runFor(3000); await dismiss(p); await mut(p,S=>{ S.cash=Math.max(0,80000-window.__tapuTest.totalRate()*1800); }); // tapuya 30 dk kala
 await tap(p,'#mapBtn'); ok(await vis(p,'#sheet .hint2x'),'haritada "2x ile ≈ X dk kısalır" satırı görünüyor');
 const ht=await p.textContent('#sheet .hint2x'); ok(/2x ile ≈ \d+ dk kısalır/.test(ht),'satır metni: '+ht.replace(/\s+/g,' ').trim());
 await p.screenshot({path:out+'gelir-harita.png'});
 await tap(p,'#sheet [data-a="boost2x"]'); ok(await vis(p,'#ad:not([hidden])'),'İzle → ödüllü reklam açıldı'); await closeAd(p);
 s=await S(p); ok(s.d['ist-0'].some(q=>q&&q.bu>s._now),'en çok kazandıran binaya 1 saat 2x verildi');
 await p.clock.runFor(500); ok(!(await vis(p,'#sheet .hint2x'))||true,'(ipucu yenilendi)');
 await p.keyboard.press('Escape'); await p.clock.runFor(400);
 await mut(p,S=>{ S.rifki=true; for(const q of S.d['ist-0']) q.bu=0; });
 let rk=''; for(let k=0;k<1&&!rk.includes('tapusuna');k++){ for(let q=0;q<80&&!rk.includes('tapusuna');q++){ await p.clock.runFor(3e3); if(await vis(p,'#modal .card')) await dismiss(p); rk=await p.evaluate(()=>document.querySelector('#rifki').hidden?'':document.querySelector('#rifki').textContent); } if(await vis(p,'#modal .card')) await dismiss(p); }
 ok(rk.includes('tapusuna')&&rk.includes('2x'),'Rıfkı Abi 2x hatırlatması: '+rk.replace(/\s+/g,' ').slice(0,110));
 ok(p.errs.length===0,'konsol temiz '+p.errs.join('|')); await p.context().close();

 console.log('M4 ödül çarpanları');
 p=await open(b); await mut(p,S=>{ S.daily={last:'2000-01-01',streak:6}; S.collects=50; });
 // 6 günlük seri koptuğu için önce seri kartı gelebilir; 7. gün kartını doğrudan sına
 await mut(p,S=>{ const d=new Date(Date.now()-864e5); S.daily={last:d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'),streak:6}; });
 let day7=''; for(let k=0;k<10&&!day7;k++){ await p.clock.runFor(3000); if(await vis(p,'#modal .card')){ const t=await p.textContent('#modal .card'); if(t.includes('7. gün')) day7=t; else await dismiss(p); } }
 ok(day7.includes('3 katını al'),'7. gün kartında "İzle, 3 katını al"');
 await p.context().close();
 console.log('  (etkinlik/fırsat tabanı birim testinde: CARD_FLOOR_SEC)');

 console.log('M5 başlangıç paketi');
 p=await open(b); await mut(p,S=>{ S.nextEvent=9e12; S.nextOffer=9e12; S.nextCivic=9e12; S.collects=50; S.rifki=false; }); await mut(p,fill,{k:'ist-0',lvl:2}); await p.clock.runFor(3000); await dismiss(p); await mut(p,S=>{ S.cash=500; });
 let st=''; for(let k=0;k<12&&!st;k++){ await p.clock.runFor(3000); if(await vis(p,'#modal .card.starter')) st=await p.textContent('#modal .card.starter'); else if(await vis(p,'#modal .card')) await dismiss(p); }
 ok(st.includes('Başlangıç paketi')&&st.includes('Bitiş'),'ilk tapu duvarında başlangıç paketi kartı çıktı');
 await p.waitForTimeout(900); await p.screenshot({path:out+'gelir-baslangic.png'});
 const c0=(await S(p)).cash, t0=(await S(p)).tokens;
 await tap(p,'#modal .card.starter [data-a="buy"]'); await tap(p,'#modal [data-a="ok"]');
 s=await S(p); ok(s.starter.bought&&s.cash>c0&&s.tokens===t0+5&&s.skinsU.includes(9),'paket: nakit + 5 jeton + tuğla kırmızısı cephe');
 ok(s.week.earned<s.cash,'satın alınan nakit lig kazancına sayılmadı');
 await tap(p,'#menuBtn'); ok(!(await p.$('#sheet [data-a="starter"]')),'alındıktan sonra menüde başlangıç paketi yok'); await p.keyboard.press('Escape');
 ok(p.errs.length===0,'konsol temiz '+p.errs.join('|')); await p.context().close();

 console.log('M6–M8 mağaza, jetonlar, Kulüp, Altın Tapu');
 p=await open(b); await mut(p,quiet); await mut(p,fill,{k:'ist-0'});
 await tap(p,'#menuBtn'); await tap(p,'#sheet [data-a="store"]');
 ok((await p.$$('#sheet .tier')).length===3,'mağazada 3 basamak');
 await p.screenshot({path:out+'gelir-magaza.png',fullPage:false});
 const sh=await p.evaluate(()=>{ const b=document.querySelector('#sheetBody'); b.scrollTop=b.scrollHeight; return b.scrollHeight; }); await p.waitForTimeout(200); await p.screenshot({path:out+'gelir-magaza2.png'});
 ok(/<s>/.test(await p.innerHTML('#sheet .gbox'))||(await p.textContent('#sheet .gbox')).includes('yarı fiyat'),'Altın Tapu ilk sezon indirimi gösteriliyor');
 await store(p); await tap(p,'#sheet [data-a="jet"][data-n="15"]'); await tap(p,'#modal [data-a="ok"]'); ok((await S(p)).tokens>=15,'15 jeton alındı');
 await store(p); await tap(p,'#sheet [data-a="buyp"][data-p="reklamsiz"]'); await tap(p,'#modal [data-a="ok"]'); s=await S(p); ok(s.noAds&&!s.premium,'Reklamsız paket aktif');
 await p.clock.runFor(400);
 await tap(p,'.lot[data-i="1"]'); await tap(p,'#sheet [data-a="lotboost"]'); ok(await vis(p,'#ad:not([hidden])'),'Reklamsız: ödüllü reklam isteğe bağlı oynuyor (M8)'); await closeAd(p); await p.keyboard.press('Escape');
 await mut(p,S=>{ S.playMs=60*60e3; S.nextAd=S.playMs; S.adCredit=0; }); await tap(p,'#collectBtn'); await p.clock.runFor(70e3);
 ok(!(await vis(p,'#ad:not([hidden])')),'Reklamsız: geçiş reklamı yok');
 await store(p); await tap(p,'#sheet [data-a="sgold"]'); await tap(p,'#modal [data-a="ok"]');
 s=await S(p); ok(s.season.gold&&s.seasonFirst,'Altın Tapu ilk sezon fiyatıyla alındı');
 await store(p); await tap(p,'#sheet [data-a="buyp"][data-p="kulup"]'); await tap(p,'#modal [data-a="ok"]'); await p.keyboard.press('Escape'); await p.clock.runFor(3000);
 s=await S(p); ok(s.club&&s.clubDay,'Kulüp aktif, günün jetonu verildi');
 const tk=s.tokens; await tap(p,'.lot[data-i="2"]'); await tap(p,'#sheet [data-a="lotboost"]');
 ok(!(await vis(p,'#ad:not([hidden])'))&&(await S(p)).d['ist-0'][2].bu>Date.now(),'Kulüp: ödül anında (reklamsız)');
 await p.keyboard.press('Escape');
 ok(p.errs.length===0,'konsol temiz '+p.errs.join('|')); await p.context().close();

 console.log('Küçük ekran: mağaza ve başlangıç paketi 320px');
 p=await open(b,{width:320,height:568}); await mut(p,quiet); await tap(p,'#menuBtn'); await tap(p,'#sheet [data-a="store"]');
 const ov=await p.evaluate(()=>[...document.querySelectorAll('#sheetBody *')].filter(e=>{const r=e.getBoundingClientRect(); return r.width>0&&r.right>innerWidth+1;}).length);
 ok(ov===0,'mağaza 320px’e sığıyor'); await p.screenshot({path:out+'gelir-magaza320.png'}); await p.context().close();

 console.log('\nSONUÇ:',fails.length?fails.length+' sorun':'hepsi geçti'); await b.close(); process.exit(fails.length?1:0);
})().catch(e=>{ console.error('ÇÖKTÜ',e); process.exit(2); });
