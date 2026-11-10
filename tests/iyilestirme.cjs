// İYİLEŞTİRME TESTİ (hata düzeltmeleri): otomatik toplama (OTO) açıkken açık panel her tick yeniden yazılmamalı,
// semt satırı ve görev "Al" düğmesi basılı tutulan dokunuşla (180 ms) çalışmalı; canlı sayılar yine güncel kalmalı.
// Adım 2a: web geri (popstate) ve kartlar, anahtar rolleri, dil adları, dokunma alanları, koyu tema kontrastı, odak halkası.
// Adım 2b: panel tutamağı/X/sürükleyerek kapatma, tema seçimi, titreşim ayarı, lig hata durumu, açılış hata ekranı.
// Adım 3: HUD yerleşimi — bindirmeler (Rıfkı, toast, semt özeti, büyük mühür, ipucu) arsalara binmez; küçük ekran/yatay/tablet ölçüleri.
// Adım 4: animasyonlar (pop, para uçuşu→sayaç, kart kapanışı, panel/semt geçişi, basma, boşta duraklama) ve titreşim; hareketi azalt.
// Çalıştır: npm run test:iy  (önizleme paketi dist-preview/index.html; Playwright gerekir)
const {chromium}=require('playwright');
const { URL, PREF_IF: PREF, state, vis, recorder, reloadKeep } = require('./helpers.cjs');
const results=[]; const ok=recorder(results);
const S=state;
const has=vis;

async function open(b,o={}){
  const ctx=await b.newContext({viewport:o.vp||{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});
  await ctx.addInitScript(PREF); if(o.init) await ctx.addInitScript(o.init);
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

  // ---------- Adım 2a: geri tuşu/geçmiş, erişilebilirlik, dokunma alanı, kontrast ----------
  const back=async p=>{ await p.evaluate(()=>history.back()); await p.waitForTimeout(150); await p.clock.runFor(400); await p.waitForTimeout(50); };
  const sheetK=p=>p.evaluate(()=>{ const s=document.querySelector('#sheet'); return s.classList.contains('on')?(document.querySelector('#sheetBody .sec,#sheetBody h3')||{}).textContent:null; });
  const atOv=p=>p.evaluate(()=>!!(history.state&&history.state.tapu));

  console.log('3) Web geri (popstate): iç içe panel, kart, döngü yok');
  p=await open(b);
  await p.click('#menuBtn',{force:true}); await p.clock.runFor(500);
  ok(await atOv(p),'panel açılınca geçmişe kayıt eklendi');
  await p.$eval('#sheetBody [data-a="store"]',e=>e.click()); await p.clock.runFor(500);
  const hl0=await p.evaluate(()=>history.length);
  await back(p);
  ok(await p.isVisible('#sheet.on #sheetBody [data-a="store"]'),'Mağaza → geri: menüye döndü (panel kapanmadı)');
  ok(await atOv(p),'iç içe geri sonrası kayıt yeniden eklendi');
  await back(p);
  ok(!(await sheetK(p)),'menü → geri: panel kapandı');
  ok(!(await atOv(p)),'panel kapanınca bizim kaydımız kalmadı');
  for(let k=0;k<4;k++){ await p.click('#menuBtn',{force:true}); await p.clock.runFor(500); await p.click('#scrim',{force:true}); await p.waitForTimeout(80); await p.clock.runFor(500); await p.waitForTimeout(80); }
  await p.clock.runFor(1200);
  ok(!(await atOv(p))&&!(await sheetK(p)),'arayüzden 4 kez aç/kapa: geçmişte asılı kayıt yok, panel kapalı');
  ok(await p.evaluate(()=>history.length)<=hl0+1,'geçmiş şişmiyor (uzunluk '+await p.evaluate(()=>history.length)+')');
  // kapatılabilir kart (piyasa raporu, data-back) geri ile kapanır
  await p.evaluate(()=>{ const S=window.__tapuState(); S.collects=5; S.market=''; }); await p.clock.runFor(1500);
  ok(await p.isVisible('#modal .mkcard'),'piyasa kartı açıldı');
  ok(await p.evaluate(()=>{ const m=document.querySelector('#modal'); return m.getAttribute('role')==='dialog'&&m.getAttribute('aria-modal')==='true'&&!!document.activeElement.closest('#modal .card'); }),'kart: role=dialog, aria-modal, odak kartta');
  await back(p);
  ok(!(await p.isVisible('#modal .card')),'kapatılabilir kart geri ile kapandı');
  // zorunlu karar kartı (ödüllü lig sonucu: data-back yok) geri ile kapanmaz
  await p.evaluate(()=>window.__tapuTest.showLeagueResult({week:'iy-'+Date.now(),from:0,to:1,rank:2,size:30,seal:false})); await p.clock.runFor(500);
  await back(p);
  ok(await p.isVisible('#modal .lgcard'),'ödül seçimi kartı geri ile kapanmadı');
  ok(await atOv(p),'kart hâlâ açıkken geçmiş kaydı yeniden eklendi (geri sayfadan çıkarmaz)');
  await p.$eval('#modal [data-a="ok"]',e=>e.click()); await p.clock.runFor(1500);
  ok(!(await p.isVisible('#modal .card'))&&!(await atOv(p)),'kart düğmeyle kapandı, kayıt geri alındı');
  // Esc aynı geri mantığı
  await p.click('#mapBtn',{force:true}); await p.clock.runFor(500); await p.keyboard.press('Escape'); await p.clock.runFor(500);
  ok(!(await sheetK(p)),'Esc paneli kapattı');
  await p.click('#menuBtn',{force:true}); await p.clock.runFor(500); await p.$eval('#sheetBody [data-a="store"]',e=>e.click()); await p.clock.runFor(500); await p.keyboard.press('Escape'); await p.clock.runFor(500);
  ok(!(await sheetK(p))&&!(await atOv(p)),'Esc iç içe paneli de tümden kapattı, geçmiş kaydı geri alındı');
  ok(!p.errs.length,'konsol temiz'+(p.errs.length?' ['+p.errs.slice(0,2).join('|')+']':''));
  await p.context().close();

  console.log('4) Erişilebilirlik: anahtar rolleri, dil adları, kapalı panel');
  p=await open(b);
  ok(await p.evaluate(()=>{ const s=document.querySelector('#sheet'); return s.inert&&s.getAttribute('aria-hidden')==='true'; }),'kapalı panel inert + aria-hidden');
  await p.click('#menuBtn',{force:true}); await p.clock.runFor(500); await p.$eval('#sheetBody [data-a="set"]',e=>e.click()); await p.clock.runFor(500);
  const sw=await p.evaluate(()=>[...document.querySelectorAll('#sheetBody .sw')].map(e=>({r:e.getAttribute('role'),c:e.getAttribute('aria-checked'),on:e.classList.contains('on'),l:e.getAttribute('aria-label')})));
  ok(sw.length>=4&&sw.every(x=>x.r==='switch'&&x.c===String(x.on)&&x.l),'ayar anahtarları role=switch, aria-checked durumla aynı, etiketli ('+sw.length+')');
  const snd0=(await S(p)).sound; await p.$eval('#sheetBody .sw[data-a="sound"]',e=>e.click()); await p.clock.runFor(400);
  ok(await p.getAttribute('#sheetBody .sw[data-a="sound"]','aria-checked')===String(!snd0),'anahtara basınca aria-checked güncellendi');
  const en=await p.evaluate(()=>{ const e=document.querySelector('#sheetBody .langs [data-l="en"]'); return e&&e.getAttribute('lang')+'|'+e.innerText; });
  ok(en==='en|ENGLISH','dil adı kendi dilinde büyük harf: '+en+' (ENGLİSH değil)');
  ok(!p.errs.length,'konsol temiz'+(p.errs.length?' ['+p.errs.slice(0,2).join('|')+']':''));
  await p.context().close();

  console.log('5) Dokunma alanları (≥44 px; elementFromPoint ile)');
  p=await open(b);
  const HIT=(sel)=>p.evaluate(sel=>{ const el=[...document.querySelectorAll(sel)].find(e=>e.getBoundingClientRect().width>0); if(!el) return null; el.scrollIntoView({block:'center'});
    const r=el.getBoundingClientRect(), cx=r.left+r.width/2, cy=r.top+r.height/2;
    const own=(x,y)=>{ if(x<0||y<0||x>=innerWidth||y>=innerHeight) return false; const h=document.elementFromPoint(x,y); return !!h&&(h===el||el.contains(h)); };
    const ext=(dx,dy)=>{ let d=0; while(d<60&&own(cx+dx*(d+1),cy+dy*(d+1))) d++; return d; };
    return {w:ext(-1,0)+ext(1,0)+1,h:ext(0,-1)+ext(0,1)+1,right:innerWidth-r.right}; },sel);
  const g=await HIT('#guideBtn'); ok(g&&g.w>=44&&g.h>=44&&g.right>=8,'kılavuz sekmesi: tıklama '+(g&&g.w+'×'+g.h)+', kenardan '+(g&&Math.round(g.right))+' px');
  await p.click('#taskBtn',{force:true}); await p.clock.runFor(500); await p.waitForTimeout(400);
  const c=await HIT('#sheetBody .chip'); ok(c&&c.h>=44,'çip tıklama yüksekliği '+(c&&c.h));
  await p.keyboard.press('Escape'); await p.clock.runFor(500); await p.waitForTimeout(400); await p.click('#menuBtn',{force:true}); await p.clock.runFor(500); await p.waitForTimeout(400); await p.$eval('#sheetBody [data-a="set"]',e=>e.click()); await p.clock.runFor(500); await p.waitForTimeout(400);
  const s2=await HIT('#sheetBody .sw'); ok(s2&&s2.h>=44&&s2.w>=44,'anahtar tıklama '+(s2&&s2.w+'×'+s2.h));
  await p.keyboard.press('Escape'); await p.clock.runFor(500); await p.waitForTimeout(400); await p.click('#menuBtn',{force:true}); await p.clock.runFor(500); await p.waitForTimeout(400); await p.$eval('#sheetBody [data-a="store"]',e=>e.click()); await p.clock.runFor(500); await p.waitForTimeout(400);
  const lk=await HIT('.note.subnote .linkbtn'); ok(lk&&lk.h>=44,'abonelik yasal linki tıklama yüksekliği '+(lk&&lk.h));
  await p.context().close();

  console.log('6) Kontrast (koyu tema; WCAG AA)');
  p=await open(b); await p.emulateMedia({colorScheme:'dark'});
  await p.evaluate(()=>{ const S=window.__tapuState(); S.collectMode='tap'; S.offer={k:'build',goal:2,prog:1,until:Date.now()+300000,title:'Hızlı müteahhit',rw:1000,done:false}; }); await p.clock.runFor(600);
  const CR=await p.evaluate(()=>{ const P=s=>{ const c=document.createElement('canvas').getContext('2d'); c.fillStyle=s; const h=c.fillStyle; if(h[0]==='#') return [1,3,5].map(i=>parseInt(h.slice(i,i+2),16)); const m=h.match(/[\d.]+/g).map(Number); return m.slice(0,3); };
    const L=c=>{ const l=c.map(v=>{v/=255;return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4)}); return .2126*l[0]+.7152*l[1]+.0722*l[2]; };
    const R=(a,b)=>{ const x=L(P(a)),y=L(P(b)); return (Math.max(x,y)+.05)/(Math.min(x,y)+.05); };
    const bg=e=>{ for(;e;e=e.parentElement){ const c=getComputedStyle(e).backgroundColor; if(c&&c!=='rgba(0, 0, 0, 0)'&&c!=='transparent') return c; } return getComputedStyle(document.body).backgroundColor; };
    const q=s=>{ const e=document.querySelector(s); return e?R(getComputedStyle(e).color,bg(e)):0; };
    return {ot:q('.offer .ot'),mk:q('.x2.mk'),bsub:q('#csub'),cmain:q('#cmain')}; });
  for(const [k,v] of Object.entries(CR)) ok(v>=4.5,'koyu tema '+k+' kontrastı '+v.toFixed(2)+' (≥ 4.5)');
  await p.keyboard.press('Tab'); await p.focus('#menuBtn');
  const fr=await p.evaluate(()=>{ const e=document.activeElement, cs=getComputedStyle(e); return cs.outlineStyle!=='none'&&parseFloat(cs.outlineWidth)>=2; });
  ok(fr,'klavye odağında görünür halka (:focus-visible)');
  await p.context().close();

  // ---------- Adım 2b ----------
  const isOn=p=>p.evaluate(()=>document.querySelector('#sheet').classList.contains('on'));
  const settle=async p=>{ await p.clock.runFor(500); await p.waitForTimeout(250); };
  /** CDP ile tek parmak sürükleme (adım başına 16 ms sahte saat: hız ölçümü kararlı) */
  async function swipe(p,x0,y0,x1,y1,steps=10){
    const c=p.__cdp||(p.__cdp=await p.context().newCDPSession(p));
    await p.clock.pauseAt(await p.evaluate(()=>Date.now())+50); // sahte saat durur: hız yalnızca adımlarla ölçülür (yük altında kararlı)
    await c.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:x0,y:y0}]});
    for(let i=1;i<=steps;i++){ await c.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x0+(x1-x0)*i/steps,y:y0+(y1-y0)*i/steps}]}); await p.clock.runFor(16); }
    await c.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]}); await p.clock.resume(); await settle(p);
  }
  const rect=(p,s)=>p.$eval(s,e=>{ const r=e.getBoundingClientRect(); return {x:r.x,y:r.y,w:r.width,h:r.height}; });
  const openSet=async p=>{ await p.click('#menuBtn',{force:true}); await settle(p); await p.$eval('#sheetBody [data-a="set"]',e=>e.click()); await settle(p); };

  console.log('7) Panel: tutamak, X, sürükleyerek kapatma');
  p=await open(b);
  await openSet(p);
  ok(await p.isVisible('#sheet .shbar .grab')&&await p.isVisible('#sheetX'),'panel başında tutamak ve X var');
  const xr=await rect(p,'#sheetX'); ok(xr.w>=44&&xr.h>=44&&await p.getAttribute('#sheetX','aria-label'),'X ≥44 px ('+xr.w+'×'+xr.h+') ve etiketli');
  await p.$eval('#sheet',e=>e.scrollTop=400); await p.waitForTimeout(50);
  const br=await rect(p,'#sheetBar'), sr=await rect(p,'#sheet');
  ok(Math.abs(br.y-sr.y)<1,'kaydırınca başlık (tutamak+X) üstte kalıyor');
  await swipe(p,sr.x+sr.w/2,sr.y+260,sr.x+sr.w/2,sr.y+460);
  ok(await isOn(p)&&await p.$eval('#sheet',e=>e.scrollTop)<400,'içerik kaydırılmışken aşağı sürükleme içeriği kaydırır, paneli kapatmaz');
  await swipe(p,sr.x+sr.w/2,sr.y+20,sr.x+sr.w/2,sr.y+70,12);
  ok(await isOn(p)&&!(await p.$eval('#sheet',e=>e.style.transform)),'tutamaktan kısa/yavaş sürükleme: panel yerine yaylandı');
  await swipe(p,sr.x+sr.w/2,sr.y+20,sr.x+sr.w/2,sr.y+20+sr.h*.4);
  ok(!(await isOn(p))&&!(await atOv(p)),'tutamaktan eşiği aşan sürükleme kapattı, geçmiş kaydı geri alındı');
  await openSet(p); await p.$eval('#sheet',e=>e.scrollTop=0);
  await swipe(p,sr.x+sr.w/2,sr.y+240,sr.x+sr.w/2,sr.y+240+sr.h*.4);
  ok(!(await isOn(p)),'içerik en üstteyken aşağı sürükleme kapattı');
  await openSet(p); await swipe(p,sr.x+sr.w/2,sr.y+20,sr.x+sr.w/2,sr.y+90,3);
  ok(!(await isOn(p)),'hızlı fırlatma (kısa mesafe) kapattı');
  await p.click('#menuBtn',{force:true}); await settle(p); await p.$eval('#sheetBody [data-a="store"]',e=>e.click()); await settle(p);
  await p.click('#sheetX'); await settle(p);
  ok(!(await isOn(p))&&!(await atOv(p)),'X iç içe paneli kapattı, geçmiş kaydı geri alındı');
  ok(!p.errs.length,'konsol temiz'+(p.errs.length?' ['+p.errs.slice(0,2).join('|')+']':''));
  await p.context().close();
  p=await open(b,{vp:{width:844,height:390}});
  await openSet(p); const wr=await rect(p,'#sheet');
  await swipe(p,wr.x+wr.w/2,wr.y+200,wr.x+wr.w/2,wr.y+330);
  ok(await isOn(p),'yatay: aşağı sürükleme kapatmıyor');
  await swipe(p,wr.x+60,wr.y+200,wr.x+60+wr.w*.45,wr.y+205);
  ok(!(await isOn(p)),'yatay: sağa sürükleme kapattı');
  await p.context().close();

  console.log('8) Tema seçimi ve titreşim ayarı');
  p=await open(b,{init:"window.__vib=0; navigator.vibrate=()=>{ window.__vib++; return true; };"});
  await openSet(p);
  const radios=await p.evaluate(()=>[...document.querySelectorAll('#sheetBody .seg [data-a="theme"]')].map(e=>e.dataset.v+':'+e.getAttribute('role')+':'+e.getAttribute('aria-checked')));
  ok(radios.join()==='auto:radio:true,light:radio:false,dark:radio:false','tema: otomatik/açık/koyu (radio, otomatik seçili)');
  const bgOf=()=>p.evaluate(()=>getComputedStyle(document.body).backgroundColor);
  const light=await bgOf();
  await p.$eval('#sheetBody [data-a="theme"][data-v="dark"]',e=>e.click()); await settle(p);
  const dk=await p.evaluate(()=>({t:document.documentElement.dataset.theme,bg:getComputedStyle(document.body).backgroundColor,meta:document.querySelector('meta[name=theme-color]').content,pref:JSON.parse(localStorage.getItem('tapu-prefs')).theme,chk:document.querySelector('#sheetBody [data-v="dark"]').getAttribute('aria-checked')}));
  ok(dk.t==='dark'&&dk.bg!==light&&dk.chk==='true','koyu seçilince data-theme=dark, zemin değişti ('+dk.bg+')');
  ok(dk.meta===dk.bg,'theme-color meta zeminle aynı ('+dk.meta+')');
  ok(dk.pref==='dark','tercih tapu-prefs\'e yazıldı');
  await reloadKeep(p); // ortam: başsız Chromium'da file:// localStorage yenilemede ara ara boş geliyor (helpers.cjs)
  for(let k=0;k<60&&!(await p.evaluate(()=>!!window.__tapuState&&document.documentElement.dataset.theme==='dark').catch(()=>false));k++){ await p.clock.runFor(300).catch(()=>{}); await p.waitForTimeout(250); }
  await p.clock.runFor(1500); for(let k=0;k<5&&await has(p,'#modal .card');k++){ await p.click('#modal .card [data-a]',{force:true}); await p.clock.runFor(400); } // açılış kartları (çevrimdışı kazanç vb.)
  ok(await p.evaluate(()=>document.documentElement.dataset.theme)==='dark','yeniden açılışta koyu tema uygulandı');
  await p.emulateMedia({colorScheme:'dark'}); await openSet(p);
  await p.$eval('#sheetBody [data-a="theme"][data-v="light"]',e=>e.click()); await settle(p);
  ok(await p.evaluate(()=>document.documentElement.dataset.theme)==='light'&&await bgOf()===light,'sistem koyuyken "açık" seçimi açık zemin verir');
  await p.$eval('#sheetBody [data-a="theme"][data-v="auto"]',e=>e.click()); await settle(p);
  ok(await p.evaluate(()=>!('theme' in document.documentElement.dataset))&&await bgOf()!==light,'otomatik: öznitelik kaldırıldı, sistem (koyu) izleniyor');
  const vs=await p.evaluate(()=>{ const e=document.querySelector('#sheetBody .sw[data-a="vib"]'); return e&&e.getAttribute('role')+':'+e.getAttribute('aria-checked')+':'+e.getAttribute('aria-label'); });
  ok(vs==='switch:true:Titreşim','titreşim anahtarı (role=switch, açık, etiketli)');
  const v0=await p.evaluate(()=>window.__vib);
  await p.$eval('#sheetBody .sw[data-a="vib"]',e=>e.click()); await settle(p);
  ok((await S(p)).vib===false&&await p.evaluate(()=>window.__vib)===v0,'titreşim kapatıldı, titreşmedi');
  await p.$eval('#sheetBody .sw[data-a="vib"]',e=>e.click()); await settle(p);
  ok((await S(p)).vib===true&&await p.evaluate(()=>window.__vib)===v0+1,'titreşim açılınca bir kez titreşti (geri bildirim)');
  ok(!p.errs.length,'konsol temiz'+(p.errs.length?' ['+p.errs.slice(0,2).join('|')+']':''));
  await p.context().close();

  console.log('9) Lig: hata durumu ayrı ve "Tekrar dene"');
  p=await open(b,{init:`window.__lbFail=true; (()=>{ const doc=()=>({get:async()=>({exists:false}),set:async()=>{},delete:async()=>{}});
    const coll=()=>({where:()=>({get:async()=>{ if(window.__lbFail) throw new Error('ağ'); return {docs:[{id:'u1',data:()=>({earned:5,district:'ist-0'})}]}; }})});
    window.claude={use:async k=>k==='db'?{doc,collection:coll}:{id:async()=>'u1',profiles:async()=>({})}}; })();`});
  await p.click('#menuBtn',{force:true}); await settle(p); await p.$eval('#sheetBody [data-a="lb"]',e=>e.click()); await settle(p); await settle(p);
  ok(await p.isVisible('#sheetBody .sterr [data-a="lbretry"]')&&!(await p.textContent('#sheetBody')).includes('henüz yerleşmedin'),'hata durumu boş grup gibi görünmüyor, "Tekrar dene" var');
  await p.evaluate(()=>{ window.__lbFail=false; }); await p.$eval('#sheetBody [data-a="lbretry"]',e=>e.click()); await settle(p); await settle(p);
  ok(await p.isVisible('#sheetBody .lglist')&&!(await p.isVisible('#sheetBody .sterr')),'tekrar dene: tablo yüklendi');
  await p.context().close();

  console.log('10) Açılış hatası ekranı');
  { const ctx=await b.newContext({viewport:{width:390,height:844}}); await ctx.addInitScript(PREF);
    await ctx.addInitScript("Object.defineProperty(window,'ResizeObserver',{configurable:true,get(){ throw new Error('iy-test açılış hatası'); }});"); // arayüz kurulurken düşer
    p=await ctx.newPage(); await p.goto(URL); await p.waitForTimeout(1200); }
  const bf=await p.evaluate(()=>{ const d=document.querySelector('.bootfail'); return d&&{r:d.getAttribute('role'),t:d.innerText,f:document.activeElement===d.querySelector('button')}; });
  ok(bf&&bf.r==='alertdialog'&&bf.t.includes('BİR SORUN OLUŞTU')&&bf.t.includes('YENİDEN BAŞLAT')&&bf.f,'yakalanmayan açılış hatasında "Bir sorun oluştu · Yeniden başlat" ekranı (odak düğmede)');
  await p.context().close();

  console.log('11) HUD yerleşimi: bindirmeler arsalara binmiyor, küçük ekran, yatay, tablet (Adım 3)');
  /** Bindirme öğesinin herhangi bir arsayla kesişme oranı (arsa alanına göre, en kötü arsa). */
  const hud=(p)=>p.evaluate(()=>{
    const R=e=>e.getBoundingClientRect(), lots=[...document.querySelectorAll('#grid .lot')].map(R);
    const vis=e=>{ if(!e||e.hidden) return false; const c=getComputedStyle(e); return c.display!=='none'&&c.visibility!=='hidden'&&+c.opacity>0.05; };
    const cov=a=>Math.max(0,...lots.map(l=>Math.max(0,Math.min(a.right,l.right)-Math.max(a.left,l.left))*Math.max(0,Math.min(a.bottom,l.bottom)-Math.max(a.top,l.top))/(l.width*l.height)));
    const hit=(a,b)=>!(a.right<=b.left+1||a.left>=b.right-1||a.bottom<=b.top+1||a.top>=b.bottom-1);
    const o={}; for(const s of ['#rifki','#toast','#sumBar','#bigStamp','#bubble']){ const e=document.querySelector(s); o[s]=vis(e)?cov(R(e)):null; }
    const t=document.querySelector('#toast'), st=document.querySelector('#bigStamp');
    o.toastCash=vis(t)&&hit(R(t),R(document.querySelector('#cash')));
    o.stampDock=vis(st)&&[...document.querySelectorAll('.dock button')].some(d=>hit(R(st),R(d)));
    o.minLot=Math.round(Math.min(...lots.map(l=>Math.min(l.width,l.height)))); o.lotW=Math.round(Math.min(...lots.map(l=>l.width)));
    const bu=document.querySelector('#bubble'); o.bubbleHud=vis(bu)&&['#offerPill','#distBar'].some(s=>{ const e=document.querySelector(s); return vis(e)&&hit(R(bu),R(e)); });
    const g=R(document.querySelector('#guideBtn')), pl=R(document.querySelector('.plate')); o.tabPlate=g.width>0&&hit(g,pl);
    o.plateDock=innerHeight>innerWidth&&pl.bottom>Math.min(...[...document.querySelectorAll('.dock button')].map(e=>R(e).top))+1;
    const d=document.querySelector('#dname'); o.dnameOne=d.scrollHeight<=parseFloat(getComputedStyle(d).lineHeight)+2;
    const op=document.querySelector('#offerPill'), tp=R(document.querySelector('.top')); o.offerIn=op.hidden||(R(op).right<=tp.right+1&&R(op).left>=tp.left-1);
    o.dock=Math.round(Math.min(...[...document.querySelectorAll('.dock .dk')].map(e=>Math.min(R(e).width,R(e).height))));
    o.app=Math.round(R(document.querySelector('#app')).width); o.sx=document.documentElement.scrollWidth-innerWidth;
    return o; });
  const showAll=async(p,kind)=>{ await p.evaluate(k=>{ const T=window.__tapuTest, S=window.__tapuState(), $=s=>document.querySelector(s);
      ['#rifki','#sumBar','#bigStamp'].forEach(s=>{ $(s).hidden=true; }); $('#toast').classList.remove('on');
      if(k==='rifki') T.showTip({id:'iy',text:'Kadıköy tapusuna 12 dakika var efendim. Kafenize bir reklamlık 2x verirseniz 6 dakikaya iner, benden söylemesi.'});
      if(k==='toast') T.toast('Kaporalı semtte 8 arsa açık · borç bitince hepsi açılır · uzun bir bildirim metni',60000);
      if(k==='sum'){ S.dEarn['ist-0']=12345e6; T.showSummary('ist-0','ist-1'); }
      if(k==='stamp') T.bigStamp('DOLU KASA!','KUMBARALAR TAŞMADAN'); },kind); await p.clock.runFor(500); await p.waitForTimeout(450); };
  for(const [W,H] of [[320,568],[360,640],[390,844],[430,932],[768,1024],[834,1194],[844,390],[568,320],[1280,720]]){
    p=await open(b,{vp:{width:W,height:H}});
    await p.evaluate(()=>{ const S=window.__tapuState(); S.collectMode='tap'; S.collects=1; S.offer={k:'taxi',goal:2,prog:1,until:Date.now()+7*60e3,title:'Altın taksi avı',rw:500,done:false}; });
    await p.clock.runFor(1500); await p.waitForTimeout(200);
    const n=`${W}×${H}`, port=H>W, base=await hud(p), bad=[];
    for(const k of ['rifki','toast','sum','stamp']){ await showAll(p,k); const m=await hud(p);
      for(const [s,v] of Object.entries(m)) if(s[0]==='#'&&v!=null&&v>0.05) bad.push(`${k}:${s} %${Math.round(v*100)}`);
      if(m.toastCash) bad.push(k+': toast kasanın üstünde'); if(m.stampDock) bad.push(k+': mühür alt çubukta');
      if(k==='rifki'){ const x=await p.evaluate(()=>{ const r=document.querySelector('#rifki .rk-x').getBoundingClientRect(); return Math.min(r.width,r.height); }); if(x<44) bad.push('Rıfkı X '+x+'px'); } }
    if(base['#bubble']>0.05) bad.push('ipucu balonu %'+Math.round(base['#bubble']*100));
    if(base.bubbleHud) bad.push('kalıcı ipucu balonu teklif hapını / semt çubuğunu örtüyor');
    ok(!bad.length,`${n}: Rıfkı/toast/semt özeti/mühür/ipucu hiçbir arsanın %5'inden fazlasını örtmüyor; kalıcı ipucu teklif hapını/semt çubuğunu örtmüyor; toast kasayı, mühür alt çubuğu örtmüyor`+(bad.length?' ['+bad.join(', ')+']':''));
    const lay=[]; if(base.minLot<44) lay.push('arsa '+base.minLot+'px'); if(!base.dnameOne) lay.push('semt adı iki satır'); if(!base.offerIn) lay.push('teklif hapı taşıyor');
    if(base.dock<44) lay.push('alt çubuk düğmesi '+base.dock+'px'); if(base.sx>0) lay.push('yatay kaydırma'); if(port&&base.tabPlate) lay.push('kılavuz sekmesi tahta çerçevesine biniyor'); if(base.plateDock) lay.push('tahta alt çubuk düğmelerine biniyor');
    if(W===390&&base.lotW<66) lay.push('390 genişlikte karo daraldı ('+base.lotW+'px, ≥66 olmalı)');
    if(W>=700&&port&&base.app<=480) lay.push('tablette ızgara dar ('+base.app+'px)');
    ok(!lay.length,`${n}: arsalar ≥44 px (${base.minLot}, genişlik ${base.lotW}), semt adı tek satır, teklif hapı sütunda, alt çubuk ≥44`+(port?', kılavuz sekmesi tahtaya, tahta alt çubuğa binmiyor':'')+(lay.length?' ['+lay.join(', ')+']':''));
    if(W===390){
      await showAll(p,'sum'); await p.$eval('#sumBar',e=>e.click()); await p.clock.runFor(200);
      ok(await p.isHidden('#sumBar'),'semt özeti dokununca kapanıyor');
      const fh=await p.evaluate(()=>{ const f=document.querySelector('#grid .lot .fill'); return f?f.getBoundingClientRect().height:0; });
      ok(fh>=6,'kira doluluk çubuğu '+fh+' px (≥6)');
      const ng=await p.evaluate(()=>{ document.body.classList.add('night'); const c=getComputedStyle(document.querySelector('.plate')).backgroundColor, l=getComputedStyle(document.querySelector('.lot.b')).backgroundColor;
        const Y=s=>{ const m=s.match(/[\d.]+/g).map(Number); return (.2126*m[0]+.7152*m[1]+.0722*m[2])/255; }; return {plate:Y(c),lot:Y(l)}; });
      ok(ng.plate<0.3&&ng.lot<0.3,'gece görünümü açık temada da tahta zemini koyu (asfalt '+ng.plate.toFixed(2)+', arsa '+ng.lot.toFixed(2)+')');
    }
    ok(!p.errs.length,n+': konsol temiz'+(p.errs.length?' ['+p.errs.slice(0,2).join('|')+']':''));
    await p.context().close();
  }

  // Adım 4: animasyonlar (WAAPI, kesilebilir, yalnız transform/opacity) ve anlamsal titreşim; hareketi azalt
  { // kendi kapsamı (değişken adları önceki bölümlerle çakışmasın)
  const settle4=async p=>{ await p.clock.runFor(500); await p.waitForTimeout(250); };
  const anims=(p,sel)=>p.evaluate(s=>{ const e=document.querySelector(s); return e?e.getAnimations().filter(a=>a.playState!=='finished').length:-1; },sel);
  console.log('12) Animasyonlar ve haptik (Adım 4)');
  p=await open(b,{init:"window.__vibs=[]; navigator.vibrate=x=>{ window.__vibs.push(x); return true; };"});
  await p.evaluate(()=>{ const S=window.__tapuState(); S.collectMode='tap'; S.cash=1e9; S.collects=5; S.lien={}; S.lienT={}; S.d['ist-0'][3]=null; });
  await settle4(p);
  // inşaat başlangıcı: karoda pop + hafif titreşim
  await p.$eval('#grid .lot[data-i="3"]',e=>e.click()); await settle4(p);
  const v0=await p.evaluate(()=>window.__vibs.length);
  await p.$eval('#sheetBody [data-a="build"]:not([disabled])',e=>e.click());
  ok(await anims(p,'#grid .lot[data-i="3"] svg.art')>0,'inşaat başlayınca karoda pop oynuyor (WAAPI, render sonrası)');
  ok(await p.evaluate(v0=>JSON.stringify(window.__vibs.slice(v0)),v0)==='[12]','inşaat başlangıcında hafif titreşim (12 ms)');
  // teslim: pop artık gerçekten oynuyor (eskiden aynı tikte siliniyordu)
  await p.clock.runFor(400);
  await p.evaluate(()=>{ const q=window.__tapuState().d['ist-0'][3]; q.until=Date.now()+300; });
  await p.clock.runFor(600);
  ok(await anims(p,'#grid .lot[data-i="3"] svg.art')>0,'teslimde karo pop animasyonu oynuyor');
  ok(await p.evaluate(()=>JSON.stringify(window.__vibs[window.__vibs.length-1]))==='[14,60,24]','teslimde başarı titreşimi (desen)');
  // TOPLA: kasa hemen sıçramaz; paralar kasaya varınca sayar
  await p.clock.runFor(2000);
  await p.evaluate(()=>{ for(const q of window.__tapuState().d['ist-0']) if(q) q.buf=5000; });
  const before=await p.textContent('#cash');
  await p.$eval('#collectBtn',e=>e.click());
  const mid=await p.evaluate(()=>({cash:document.querySelector('#cash').textContent,fly:document.querySelectorAll('.fly').length,S:window.__tapuState().cash}));
  ok(mid.cash===before&&mid.fly>0,`TOPLA: paralar uçuyor (${mid.fly}), kasa varıştan önce saymıyor (${mid.cash})`);
  await p.waitForTimeout(1100); await p.clock.runFor(700); await p.waitForTimeout(100); await p.clock.runFor(300);
  const end=await p.evaluate(()=>({cash:document.querySelector('#cash').textContent,fly:document.querySelectorAll('.fly').length}));
  ok(end.cash!==before&&end.fly===0,`para kasaya vardı, sayaç son değere ulaştı (${before} → ${end.cash})`);
  // başarısız işlem: hata titreşimi + sallama
  await p.clock.runFor(600);
  await p.evaluate(()=>{ for(const k of ['ist-0','ist-1']) for(const q of window.__tapuState().d[k]) if(q) q.buf=0; });
  await p.$eval('#collectBtn',e=>e.click());
  ok(await p.evaluate(()=>JSON.stringify(window.__vibs[window.__vibs.length-1]))==='[30,50,30]'&&await anims(p,'#collectBtn')>0,'boş TOPLA: hata titreşimi ve mühür 250 ms sallanıyor');
  // titreşim kapalıysa hiç titremez
  const vn=await p.evaluate(()=>{ window.__tapuState().vib=false; return window.__vibs.length; });
  await p.$eval('#collectBtn',e=>e.click()); await p.clock.runFor(300);
  ok(await p.evaluate(()=>window.__vibs.length)===vn,'titreşim ayarı kapalıyken hata titreşimi yok');
  await p.evaluate(()=>{ window.__tapuState().vib=true; });
  // toast açıkken yeni mesaj: kısa vurgu
  await p.clock.runFor(2500); await p.evaluate(()=>window.__tapuTest.toast('bir')); await p.clock.runFor(100); await p.evaluate(()=>window.__tapuTest.toast('iki'));
  ok(await anims(p,'#toast')>0,'açık toast yeni mesajda kısa scale vurgusu');
  // semt değişimi: ızgara yönlü kayar
  await p.clock.runFor(2500);
  await p.evaluate(()=>window.__tapuTest.switchDistrict('ist-1'));
  ok(await p.evaluate(()=>{ const a=document.querySelector('.plate').getAnimations()[0]; return !!a&&a.effect.getKeyframes()[0].transform==='translateX(24px)'; }),'semt değişince ızgara sağdan kayarak geliyor');
  await p.clock.runFor(500); await p.evaluate(()=>window.__tapuTest.switchDistrict('ist-0'));
  ok(await p.evaluate(()=>{ const a=document.querySelector('.plate').getAnimations()[0]; return !!a&&a.effect.getKeyframes()[0].transform==='translateX(-24px)'; }),'geri semtte soldan kayıyor');
  // panel içi geçiş
  await p.clock.runFor(3000);
  for(let k=0;k<5&&await has(p,'#modal .card');k++){ await p.click('#modal .card [data-a]',{force:true}); await p.clock.runFor(400); }
  await p.click('#menuBtn',{force:true}); await settle4(p);
  await p.$eval('#sheetBody [data-a="set"]',e=>e.click());
  const nav=await p.evaluate(()=>{ const a=document.querySelector('#sheetBody').getAnimations()[0]; return a?a.effect.getKeyframes()[0].transform:''; });
  ok(nav==='translateX(28px)','panel içinde ileri geçiş: içerik sağdan kayıp beliriyor');
  await settle4(p); await p.evaluate(()=>history.back()); await p.waitForTimeout(50);
  const nav2=await p.evaluate(()=>{ const a=document.querySelector('#sheetBody').getAnimations()[0]; return a?a.effect.getKeyframes()[0].transform:''; });
  ok(nav2==='translateX(-28px)','geri: soldan ('+nav2+')');
  // basma geri bildirimi
  await p.keyboard.press('Escape'); await settle4(p);
  const mb=await p.locator('#menuBtn').boundingBox(); await p.mouse.move(mb.x+mb.width/2,mb.y+mb.height/2); await p.mouse.down(); await p.waitForTimeout(200);
  const tf=await p.evaluate(()=>getComputedStyle(document.querySelector('#menuBtn')).transform); await p.mouse.up(); await settle4(p);
  ok(/matrix\(0\.97/.test(tf),'alt çubuk düğmesi basılıyken %97 ('+tf+')');
  await p.keyboard.press('Escape'); await settle4(p);
  // kart kapanışı: kart anında kapanır (durum), kopyası ~180 ms solar
  await p.evaluate(()=>{ const S=window.__tapuState(); S.nextEvent=0; });
  for(let k=0;k<20&&!(await has(p,'#modal .card'));k++) await p.clock.runFor(500);
  const hadCard=await has(p,'#modal .card');
  await p.clock.runFor(400); await p.$eval('#modal .card [data-a="x1"], #modal .card [data-back]',e=>e.click());
  const ex=await p.evaluate(()=>({hid:document.querySelector('#modal').hidden,ghost:!!document.querySelector('.modal-out .card'),an:document.querySelector('.modal-out .card')?.getAnimations().length||0,inert:document.querySelector('.modal-out')?.inert}));
  ok(hadCard&&ex.hid&&ex.ghost&&ex.an>0&&ex.inert,'kart kapanışı: #modal anında gizli, kopyası etkileşimsiz katmanda kapanış animasyonu oynuyor');
  await p.waitForTimeout(350);
  ok(!(await p.evaluate(()=>!!document.querySelector('.modal-out'))),'kapanış animasyonu bitince kopya kaldırıldı');
  // boşta: sokak durur, halka/doluluk yazılmaz
  await p.keyboard.press('Escape'); await settle4(p);
  await p.evaluate(()=>{ for(const q of window.__tapuState().d['ist-0']) if(q) q.buf=0; });
  await p.clock.runFor(29000);
  const pre=await p.evaluate(()=>document.querySelectorAll('.street .car,.street .ped').length);
  await p.clock.runFor(2500);
  const id=await p.evaluate(()=>{ const st=document.getAnimations().filter(a=>a.effect&&a.effect.target&&a.effect.target.closest&&a.effect.target.closest('.street'));
    return {idle:document.body.classList.contains('idle'),n:st.length,paused:st.every(a=>a.playState==='paused'),ring:document.querySelector('#ringFg').style.strokeDashoffset}; });
  await p.clock.runFor(3000);
  const ring2=await p.evaluate(()=>document.querySelector('#ringFg').style.strokeDashoffset);
  ok(id.idle&&id.paused&&id.ring===ring2,`boşta: sokak animasyonları duraklatıldı (${id.n} araç, önce ${pre}), halka yazılmıyor (${id.ring})`);
  await p.mouse.move(5,300); await p.mouse.down(); await p.mouse.up(); await p.clock.runFor(300);
  ok(await p.evaluate(()=>!document.body.classList.contains('idle')&&document.getAnimations().filter(a=>a.effect&&a.effect.target&&a.effect.target.closest&&a.effect.target.closest('.street')).every(a=>a.playState!=='paused')),'dokununca sokak kaldığı yerden devam ediyor');
  ok(!p.errs.length,'konsol temiz'+(p.errs.length?' ['+p.errs.slice(0,2).join('|')+']':''));
  await p.context().close();

  console.log('13) Hareketi azalt (Adım 4)');
  p=await open(b,{init:"window.__vibs=[]; navigator.vibrate=x=>{ window.__vibs.push(x); return true; };"});
  await p.emulateMedia({reducedMotion:'reduce'}); // açıkken değişir: matchMedia dinleyicisi
  await p.evaluate(()=>{ const S=window.__tapuState(); S.collectMode='tap'; S.collects=5; S.lien={}; S.lienT={}; for(const q of S.d['ist-0']) q.buf=1e9; });
  await settle4(p);
  const rs=await p.evaluate(()=>{ const cb=document.querySelector('#collectBtn'), a=getComputedStyle(cb,'::after');
    return {full:cb.classList.contains('full'),an:a.animationName,op:a.opacity,sheet:getComputedStyle(document.querySelector('#sheet')).transitionProperty}; });
  ok(rs.full&&rs.an==='none'&&rs.op==='0.6','dolu halka nabzı durağan (görünür, animasyonsuz)');
  ok(/opacity/.test(rs.sheet),'panel hareket yerine opaklıkla açılıp kapanıyor ('+rs.sheet+')');
  await p.$eval('#collectBtn',e=>e.click()); await p.waitForTimeout(200);
  const g1=await p.evaluate(()=>({vis:!document.querySelector('#gain').hidden,op:getComputedStyle(document.querySelector('#gain')).opacity,fly:document.querySelectorAll('.fly').length,txt:document.querySelector('#gain').textContent}));
  await p.clock.runFor(1200); const g2=await p.evaluate(()=>!document.querySelector('#gain').hidden&&getComputedStyle(document.querySelector('#gain')).opacity==='1');
  await p.clock.runFor(600); const g3=await p.evaluate(()=>document.querySelector('#gain').hidden);
  ok(g1.vis&&g1.op==='1'&&g1.fly===0&&g2&&g3,'kazanç etiketi görünür (opaklık 1, uçan para yok), ~1,6 sn sonra kayboluyor');
  ok(await p.evaluate(()=>getComputedStyle(document.querySelector('#bigStamp')).transform)!=='none','büyük mühür yerinde (döndürülmüş, ölçek animasyonu yok)');
  // kart: giriş/çıkış yalnız opaklık
  await p.clock.runFor(2500); await p.evaluate(()=>{ window.__tapuState().nextEvent=0; });
  for(let k=0;k<20&&!(await has(p,'#modal .card'));k++) await p.clock.runFor(500);
  const ci=await p.evaluate(()=>getComputedStyle(document.querySelector('#modal .card')).animationName);
  await p.clock.runFor(400); await p.$eval('#modal .card [data-a="x1"], #modal .card [data-back]',e=>e.click());
  const co=await p.evaluate(()=>{ const a=document.querySelector('.modal-out .card')?.getAnimations()[0]; return a?a.effect.getKeyframes().map(k=>k.transform||'').join(''):'yok'; });
  ok(ci==='rmFade'&&co==='','kart girişte ve çıkışta yalnız opaklık ('+ci+')');
  // başarısız işlem: sallama yerine kısa yanıp sönme
  await p.clock.runFor(3000); await p.evaluate(()=>{ for(const k of ['ist-0','ist-1']) for(const q of window.__tapuState().d[k]) if(q) q.buf=0; });
  await p.$eval('#collectBtn',e=>e.click());
  ok(await p.evaluate(()=>{ const a=document.querySelector('#collectBtn').getAnimations()[0]; return !!a&&a.effect.getKeyframes().every(k=>!k.transform); }),'boş TOPLA: sallama yok, yalnız opaklık yanıp sönmesi');
  ok(!p.errs.length,'konsol temiz'+(p.errs.length?' ['+p.errs.slice(0,2).join('|')+']':''));
  await p.context().close();
  }
  await b.close();
  const pass=results.filter(r=>r.pass).length;
  console.log(`\nSONUÇ: ${pass}/${results.length} geçti`);
  process.exit(pass===results.length?0:1);
})().catch(e=>{ console.error(e); process.exit(1); });
