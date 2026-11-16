// İYİLEŞTİRME TESTİ (hata düzeltmeleri): otomatik toplama (OTO) açıkken açık panel her tick yeniden yazılmamalı,
// semt satırı ve görev "Al" düğmesi basılı tutulan dokunuşla (180 ms) çalışmalı; canlı sayılar yine güncel kalmalı.
// Adım 2a: web geri (popstate) ve kartlar, anahtar rolleri, dil adları, dokunma alanları, koyu tema kontrastı, odak halkası.
// Adım 2b: panel tutamağı/X/sürükleyerek kapatma, tema seçimi, titreşim ayarı, lig hata durumu, açılış hata ekranı.
// Adım 3: HUD yerleşimi — bindirmeler (Rıfkı, toast, semt özeti, büyük mühür, ipucu) arsalara binmez; küçük ekran/yatay/tablet ölçüleri.
// Adım 4: animasyonlar (pop, para uçuşu→sayaç, kart kapanışı, panel/semt geçişi, basma, boşta duraklama) ve titreşim; hareketi azalt.
// Adım 9: Rıfkı Abi'nin yüzü (ifade ipucuna göre; göz kırpma/nefes boşta ve hareketi azalt açıkken durur).
// Kiracılar (16): Rıfkı tanıtır, kart, hedef arsa, inşaatta süre durur, anahtar teslimi, gidiş/bitiş bildirimi, defter, koyu tema, 320 px, EN.
// Büyük projeler (17): Rıfkı tanıtır, arsa panelinde teklif, seçim çerçevesi (çakışan iki blok), onay kartı (kiracı notu), şantiye,
// teslim, 2. etap, ayırma; reklamla hızlandırma yok; UK/DE üslubu; koyu tema + hareketi azalt, 320 px, yatay 844×390.
// Rakip ve ihale (18): hap, tanıtım, panel, vekâlet/emanet, geçilme, kazanma/kaybetme, köşe başı seçimi, şehir rakipleri, koyu tema, 320 px, UK, EN.
// Çalıştır: npm run test:iy  (önizleme paketi dist-preview/index.html; Playwright gerekir)
const {chromium}=require('playwright');
const { serve, PREF_IF: PREF, state, vis, recorder, out } = require('./helpers.cjs');
let URL; // http://127.0.0.1:<port>/index.html — main başında serve() ile
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

// ---------- 16) Kiracılar: tanıtım, kart, hedef arsa, anahtar teslimi, gidiş bildirimi, defter, koyu tema, hareketi azalt, 320 px / EN ----------
async function kiraciBolum(b) {
  /** Kiracı vakası: tek semt (Kadıköy), ilk sıradaki 6 ev üretimde, kafe açık, tap modu, Rıfkı açık. Adayı oyunun kendi
   *  tick'i getirir (Math.random o an 0: ilk aday deterministik → Ece, 2. arsadaki ev, 6. arsaya kafe ister). */
  async function openTen(o = {}) {
    const ctx = await b.newContext({ viewport: o.vp || { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, reducedMotion: o.rm ? 'reduce' : 'no-preference' });
    await ctx.addInitScript(`localStorage.setItem('tapu-prefs',JSON.stringify({lang:'${o.lang || 'tr'}',region:'${o.region || 'tr'}',ent:{},news:true${o.dark ? ",theme:'dark'" : ''}}));` + (o.dark ? "localStorage.setItem('tapu-theme','dark');" : ''));
    const p = await ctx.newPage(); p.errs = []; p.on('pageerror', e => p.errs.push(e.message));
    await p.clock.install(); await p.goto(URL); await p.clock.runFor(700);
    await p.click(`#modal .cityopt[data-a="${o.city || 'ist'}"]`, { force: true }); await p.clock.runFor(400);
    for (let k = 0; k < 5 && await has(p, '#modal .card'); k++) { await p.click('#modal .card [data-a]', { force: true }); await p.clock.runFor(400); }
    await p.evaluate(() => { const S = window.__tapuState(); const k = S.cur;
      S.d[k] = Array.from({ length: 20 }, (_, i) => (i < 6 ? { t: 'ev', lvl: 1, buf: 0, until: 0, dur: 1, up: false } : null));
      S.own = [k]; S.lien = {}; S.lienT = {}; S.collectMode = 'tap'; S.cash = 1e6; S.earned = 5000; S.seen = { ev: true, kafe: true };
      S.nextEvent = 9e12; S.nextOffer = 9e12; S.nextCivic = 9e12; S.nextAd = 9e12; S.nextTaxi = 9e12; S.collects = 0; S.market = 'x'; S.rifki = true; S.guideHint = true;
      S.starter = { at: 1, bought: true }; S.offer = null; S.ten = []; S.tdef = {}; S.nextTen = 9e15;
      const d = new Date(); S.daily = { last: d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'), streak: 1 };
      S.tasks = { day: S.daily.last, bonus: false, list: [{ k: 'taxi', goal: 1e9, prog: 0, claimed: false }] }; });
    await p.clock.runFor(1500);
    for (let k = 0; k < 5 && await has(p, '#modal .card'); k++) { await p.click('#modal .card [data-a]', { force: true }); await p.clock.runFor(400); }
    if (await has(p, '#rifki:not([hidden])')) await p.evaluate(() => document.querySelector('#rifki .rk-x').click());
    // aday: bir sonraki tick'te gelir (Math.random = 0 yalnız o an)
    await p.evaluate(() => { const S = window.__tapuState(); S.nextTen = S.playMs + 300; const r = Math.random; Math.random = () => 0; setTimeout(() => { Math.random = r; }, 700); });
    await p.clock.runFor(1200);
    return p;
  }
  const rk = p => p.evaluate(() => { const r = document.querySelector('#rifki'); return r.hidden ? null : { mood: r.querySelector('.rk-face')?.dataset.mood, txt: r.querySelector('.rk-bub span')?.textContent || '', tn: !!r.querySelector('.rk-bub .rk-tn svg') }; });
  const tile = (p, i) => `#grid .lot[data-i="${i}"]`;
  const tapTile = async (p, i) => { await p.click(tile(p, i), { force: true }); await p.clock.runFor(400); await p.waitForTimeout(350); };
  const noOverflow = p => p.evaluate(() => { const sh = document.querySelector('#sheet'); return { doc: document.documentElement.scrollWidth, vw: innerWidth, sheet: sh ? sh.scrollWidth - sh.clientWidth : 0, body: [...document.querySelectorAll('#sheetBody *')].filter(e => { const r = e.getBoundingClientRect(); return r.width && (r.right > innerWidth + 0.5 || r.left < -0.5); }).map(e => e.tagName + '.' + (e.getAttribute('class') || '') + ':' + Math.round(e.getBoundingClientRect().left) + '-' + Math.round(e.getBoundingClientRect().right)).slice(0, 4) }; });

  let p = await openTen();
  // tanıtım
  const st0 = await S(p), x0 = st0.ten[0];
  ok(st0.ten.length === 1 && x0.a === 'ogrenci' && x0.i === 2 && x0.w.k === 'nb' && x0.w.t === 'kafe' && x0.st === 'wait', 'aday oyunun tick\'iyle geldi (Ece, 2. arsa, yanında kafe): ' + JSON.stringify(x0));
  const r0 = await rk(p);
  ok(r0 && r0.mood === 'wow' && r0.tn && /Ece/.test(r0.txt) && /kiracı adayı/.test(r0.txt) && /%50/.test(r0.txt), 'Rıfkı tanıtıyor: şaşkın yüz, balonda kiracının yüzü, ad ve %50: ' + JSON.stringify(r0));
  ok(await has(p, tile(p, 2) + ' .tn.s-wait svg') && await has(p, tile(p, 2) + ' .tn .td'), 'tahtada rozet: 2. arsada yüz, halka ve "…"');
  const tg = await p.evaluate(() => { const e = document.querySelector('#grid .lot[data-i="6"]'); return { tq: e.classList.contains('tq'), lbl: e.querySelector('.tgt')?.textContent, aria: e.getAttribute('aria-label') }; });
  ok(tg.tq && tg.lbl === 'KAFE?' && /kiracı burada kafe istiyor/.test(tg.aria), 'hedef arsa (6): kesik çizgi, "KAFE?" etiketi, ekran okuyucu metni: ' + JSON.stringify(tg));
  await p.waitForTimeout(450); await p.screenshot({ path: out + 'kiraci-1-tanitim.png' });
  // Rıfkı balonuna dokunmak kiracı kartını açar
  await p.click('#rifki .rk-bub', { force: true }); await p.clock.runFor(400); await p.waitForTimeout(350);
  const card = await p.evaluate(() => ({ h: document.querySelector('#sheetBody .tn-head h3')?.textContent, q: document.querySelector('#sheetBody .tn-q')?.textContent || '', go: document.querySelector('#sheetBody [data-a="go"]')?.textContent, por: !!document.querySelector('#sheetBody .tn-por svg[data-arch="ogrenci"][data-m="wait"]'), led: document.querySelectorAll('#sheetBody .ledger > div').length }));
  ok(card.h === 'Ece' && /kafe/.test(card.q) && card.go === 'Arsaya git · kafe kur' && card.por && card.led === 5, 'kiracı kartı (balondan): portre, ad, alıntı, 5 satır defter, tek düğme: ' + JSON.stringify(card));
  await p.waitForTimeout(450); await p.screenshot({ path: out + 'kiraci-2-kart.png' });
  // kart → hedef arsanın paneli: şerit ve KİRACI İSTİYOR kartı
  await p.click('#sheetBody [data-a="go"]', { force: true }); await p.clock.runFor(400); await p.waitForTimeout(350);
  const pl = await p.evaluate(() => ({ strip: document.querySelector('#sheetBody .tn-strip small')?.textContent || '', want: document.querySelector('#sheetBody .bcard.want')?.dataset.t, tag: document.querySelector('#sheetBody .bcard.want .wtag')?.textContent }));
  ok(/Komşusu Ece burada kafe istiyor/.test(pl.strip) && pl.want === 'kafe' && pl.tag === 'KİRACI İSTİYOR', 'hedef arsa paneli: kiracı şeridi ve işaretli kafe kartı: ' + JSON.stringify(pl));
  await p.click('#sheetBody .bcard.want', { force: true }); await p.clock.runFor(400);
  const dl0 = (await S(p)).ten[0].dl, pm0 = (await S(p)).playMs; await p.clock.runFor(20e3); const s20 = await S(p);
  ok(s20.d['ist-0'][6] && s20.d['ist-0'][6].t === 'kafe' && s20.ten[0].dl - dl0 >= (s20.playMs - pm0) - 500, 'inşaat sürerken kiracının süresi duruyor (usta çalışıyor)');
  await p.evaluate(() => { const S = window.__tapuState(); S.d['ist-0'][6].until = Date.now() + 300; }); await p.clock.runFor(1500);
  if (await has(p, '#sheet.on')) { await p.keyboard.press('Escape'); await p.clock.runFor(400); }
  await p.clock.runFor(800);
  const s1 = await S(p), r1 = await rk(p);
  ok(s1.ten[0].st === 'ready' && await has(p, tile(p, 2) + ' .tn.s-ready .tk svg'), 'istek oldu: halka yeşil, rozette altın anahtar');
  ok(r1 && r1.mood === 'happy' && /anahtar/.test(r1.txt), 'Rıfkı haber veriyor (memnun): ' + JSON.stringify(r1));
  // anahtar teslimi: tek dokunuş
  const rate0 = await p.evaluate(() => window.__tapuTest.totalRate());
  await p.evaluate(() => { const r = document.querySelector('#rifki .rk-x'); if (r) r.click(); });
  await p.click(tile(p, 2), { force: true }); await p.clock.runFor(300);
  const s2 = await S(p), stamp = await p.evaluate(() => { const e = document.querySelector('#grid .lot[data-i="2"] .teslim.ts-tn'); return e ? e.textContent : ''; });
  const rate1 = await p.evaluate(() => window.__tapuTest.totalRate());
  ok(s2.ten[0].st === 'live' && !(await has(p, '#sheet.on')), 'tek dokunuşla yerleşti (panel açılmadı)');
  ok(/YERLEŞTİ/.test(stamp) && /Ece/.test(stamp), 'binaya YERLEŞTİ mührü basıldı: ' + stamp);
  ok(rate1 > rate0, 'toplam kira arttı (' + rate0.toFixed(2) + ' → ' + rate1.toFixed(2) + ')');
  await p.clock.runFor(600); const r2 = await rk(p);
  ok(r2 && r2.mood === 'party' && /taşındı/.test(r2.txt), 'Rıfkı kutluyor (kutlama yüzü): ' + JSON.stringify(r2));
  await p.waitForTimeout(450); await p.screenshot({ path: out + 'kiraci-3-yerlesti.png' });
  await p.clock.runFor(2500);
  ok(await has(p, tile(p, 2) + ' .tn.s-live .th'), 'yerleşen kiracının rozetinde kalp');
  await tapTile(p, 2);
  const led = await p.evaluate(() => [...document.querySelectorAll('#sheetBody .ledger > div')].map(d => d.textContent).find(s => /Kiracı/.test(s)) || '');
  ok(/Kiracı · Ece/.test(led) && /%50/.test(led), 'mülk panelinde defter satırı: ' + led.replace(/\s+/g, ' '));
  await p.keyboard.press('Escape'); await p.clock.runFor(400);
  // gidiş bildirimi: istek karşılanmayan aday süre sonunda gider (Rıfkı konuşmaz, kısa bildirim)
  await p.evaluate(() => { const r = document.querySelector('#rifki .rk-x'); if (r && !document.querySelector('#rifki').hidden) r.click();
    const S = window.__tapuState(); S.ten.push({ id: 99, a: 'aile', k: S.cur, i: 3, w: { k: 'lvl', n: 2 }, dl: S.playMs + 600, st: 'wait', end: 0, noted: true }); });
  await p.clock.runFor(1500);
  const toast1 = await p.textContent('#toast'), s3 = await S(p), r3 = await rk(p);
  ok(/Yılmaz ailesi başka bir yere baktı/.test(toast1) && !s3.ten.some(x => x.id === 99) && !r3 && s3.cash >= 0, 'gidiş: kısa bildirim, ceza yok, Rıfkı sessiz: ' + toast1);
  await p.evaluate(() => { const S = window.__tapuState(); S.ten[0].end = S.playMs + 500; }); await p.clock.runFor(1500);
  const toast2 = await p.textContent('#toast');
  ok(/Sözleşme bitti: Ece/.test(toast2) && (await S(p)).ten.length === 0, 'sözleşme bitince teşekkür bildirimi: ' + toast2);
  // kiracı defteri (menüden)
  await p.click('#menuBtn', { force: true }); await p.clock.runFor(400); await p.waitForTimeout(350);
  ok(await has(p, '#sheetBody .drow[data-a="defter"]'), 'menüde "Kiracı defteri" satırı');
  await p.click('#sheetBody .drow[data-a="defter"]', { force: true }); await p.clock.runFor(400); await p.waitForTimeout(350);
  const df = await p.evaluate(() => ({ n: document.querySelectorAll('#sheetBody .tdc').length, unk: document.querySelectorAll('#sheetBody .tdc.unk').length, ece: document.querySelector('#sheetBody .tdc[data-arch="ogrenci"] .tdn')?.textContent, on: document.querySelectorAll('#sheetBody .tdc[data-arch="ogrenci"] .tds i.on').length }));
  ok(df.n === 6 && df.unk === 5 && df.ece === 'Ece' && df.on === 1, 'defter: 6 tip, gelmeyenler "???", Ece\'nin 1 pulu: ' + JSON.stringify(df));
  await p.waitForTimeout(450); await p.screenshot({ path: out + 'kiraci-4-defter.png' });
  // dokunma alanı: rozetli arsa ≥ 44 px (rozet tıklamayı yutmaz)
  await p.keyboard.press('Escape'); await p.clock.runFor(400);
  const hit = await p.evaluate(() => { const e = document.querySelector('#grid .lot[data-i="2"]'), r = e.getBoundingClientRect(), b = e.querySelector('.tn'); const bb = b ? b.getBoundingClientRect() : r; const at = document.elementFromPoint(bb.x + bb.width / 2, bb.y + bb.height / 2); return { w: r.width, h: r.height, hit: !!(at && at.closest('.lot') === e) }; });
  ok(hit.w >= 44 && hit.h >= 44 && hit.hit, 'rozetli arsanın dokunma alanı ≥44 px ve rozet dokunuşu arsaya gider: ' + JSON.stringify(hit));
  ok(!p.errs.length, 'konsol temiz' + (p.errs.length ? ' [' + p.errs.slice(0, 2).join('|') + ']' : ''));
  await p.context().close();

  // koyu tema + hareketi azalt
  p = await openTen({ dark: true, rm: true });
  const dk = await p.evaluate(() => { const b = document.querySelector('#grid .lot[data-i="2"] .tn svg'); return { th: document.documentElement.dataset.theme, bg: b ? getComputedStyle(b).backgroundColor : '' }; });
  ok(dk.th === 'dark' && dk.bg === 'rgb(31, 25, 15)', 'koyu tema: rozet zemini koyu kart rengi (--rk-card): ' + JSON.stringify(dk));
  await p.evaluate(() => { const r = document.querySelector('#rifki .rk-x'); if (r && !document.querySelector('#rifki').hidden) r.click(); });
  await tapTile(p, 2);
  const dq = await p.evaluate(() => { const q = document.querySelector('#sheetBody .tn-q'); const cs = q && getComputedStyle(q); return cs ? { bg: cs.backgroundColor, fg: cs.color } : null; });
  ok(dq && dq.bg === 'rgb(31, 25, 15)' && dq.fg === 'rgb(227, 234, 223)', 'koyu tema: kiracı kartı alıntısı koyu zemin, açık yazı: ' + JSON.stringify(dq));
  await p.waitForTimeout(450); await p.screenshot({ path: out + 'kiraci-5-koyu-kart.png' });
  await p.keyboard.press('Escape'); await p.clock.runFor(400);
  await p.evaluate(() => { const S = window.__tapuState(); S.d[S.cur][6] = { t: 'kafe', lvl: 1, buf: 0, until: 0, dur: 1, up: false }; }); await p.clock.runFor(800);
  const an = await p.evaluate(() => { const e = document.querySelector('#grid .lot[data-i="2"] .tn.s-ready'); return e ? { a: getComputedStyle(e).animationName, n: e.getAnimations().length } : null; });
  ok(an && an.a === 'none' && an.n === 0, 'hareketi azalt: anahtar zıplaması yok: ' + JSON.stringify(an));
  await p.evaluate(() => { const r = document.querySelector('#rifki .rk-x'); if (r && !document.querySelector('#rifki').hidden) r.click(); });
  await p.waitForTimeout(450); await p.screenshot({ path: out + 'kiraci-6-koyu-tahta.png' });
  ok(!p.errs.length, 'konsol temiz' + (p.errs.length ? ' [' + p.errs.slice(0, 2).join('|') + ']' : ''));
  await p.context().close();

  // 320 px · İngiltere / İngilizce (yerel adlar, çeviri)
  p = await openTen({ vp: { width: 320, height: 568 }, lang: 'en', region: 'uk', city: 'lon' });
  const e0 = await S(p), r4 = await rk(p);
  ok(e0.ten.length === 1 && r4 && /Olivia/.test(r4.txt) && /tenant/.test(r4.txt) && !/kiracı|efendim/.test(r4.txt), 'İngiltere/EN: yerel ad (Olivia), İngilizce tanıtım: ' + JSON.stringify(r4));
  await p.evaluate(() => { const r = document.querySelector('#rifki .rk-x'); if (r && !document.querySelector('#rifki').hidden) r.click(); });
  await tapTile(p, 2);
  const c320 = await p.evaluate(() => ({ h: document.querySelector('#sheetBody .tn-head h3')?.textContent, go: document.querySelector('#sheetBody [data-a="go"]')?.textContent, role: document.querySelector('#sheetBody .tn-head .sh-t p:last-child')?.textContent }));
  const tt = await p.evaluate(() => getComputedStyle(document.querySelector('#sheetBody .tn-head h3')).textTransform);
  ok(tt === 'none', 'kiracı adı büyük harfe çevrilmiyor (Türkçe kuralı yabancı adı bozmasın): ' + tt);
  ok(c320.h === 'Olivia' && c320.go === 'Go to plot · build a café' && /university student/.test(c320.role || ''), '320 px kart İngilizce: ' + JSON.stringify(c320));
  const o1 = await noOverflow(p);
  ok(o1.doc <= 320 && o1.sheet <= 0 && !o1.body.length, '320 px: kiracı kartında yatay taşma yok: ' + JSON.stringify(o1));
  const btnH = await p.evaluate(() => [...document.querySelectorAll('#sheetBody .btns button')].map(b => (b.getBoundingClientRect().height).toFixed(2)));
  ok(btnH.length && btnH.every(h => +h >= 44), '320 px: kart düğmeleri ≥44 px: ' + btnH.join(','));
  await p.waitForTimeout(450); await p.screenshot({ path: out + 'kiraci-7-320-kart.png' });
  await p.click('#sheetBody [data-a="defter"]', { force: true }); await p.clock.runFor(400); await p.waitForTimeout(350);
  const o2 = await noOverflow(p);
  ok(o2.doc <= 320 && o2.sheet <= 0 && !o2.body.length, '320 px: defterde yatay taşma yok: ' + JSON.stringify(o2));
  await p.waitForTimeout(450); await p.screenshot({ path: out + 'kiraci-8-320-defter.png' });
  await p.keyboard.press('Escape'); await p.clock.runFor(400); await p.keyboard.press('Escape'); await p.clock.runFor(400);
  await p.click('#grid .lot[data-i="6"]', { force: true }); await p.clock.runFor(400); await p.waitForTimeout(350);
  const o3 = await noOverflow(p);
  ok(o3.doc <= 320 && o3.sheet <= 0 && !o3.body.length && await has(p, '#sheetBody .tn-strip'), '320 px: hedef arsa paneli (şerit) taşmıyor: ' + JSON.stringify(o3));
  ok(!p.errs.length, 'konsol temiz' + (p.errs.length ? ' [' + p.errs.slice(0, 2).join('|') + ']' : ''));
  await p.context().close();
}

// ---------- 17) Büyük projeler: teklif, seçim çerçevesi, onay kartı, şantiye, teslim, 2. etap, ayırma, koyu tema, 320 px, yatay ----------
async function projeBolum(b) {
  /** Proje vakası: Kadıköy dolu; 0,1,2,4,5,6 Sv5, diğerleri Sv4 → 5. arsayı içeren iki uygun blok (0: Han, 1: Pasaj). Beşiktaş alınmış. */
  async function openPj(o = {}) {
    const ctx = await b.newContext({ viewport: o.vp || { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: !o.desk, hasTouch: true, reducedMotion: o.rm ? 'reduce' : 'no-preference' });
    await ctx.addInitScript(`localStorage.setItem('tapu-prefs',JSON.stringify({lang:'${o.lang || 'tr'}',region:'${o.region || 'tr'}',ent:{},news:true${o.dark ? ",theme:'dark'" : ''}}));` + (o.dark ? "localStorage.setItem('tapu-theme','dark');" : ''));
    const p = await ctx.newPage(); p.errs = []; p.on('pageerror', e => p.errs.push(e.message));
    await p.clock.install(); await p.goto(URL); await p.clock.runFor(700);
    await p.click(`#modal .cityopt[data-a="${o.city || 'ist'}"]`, { force: true }); await p.clock.runFor(400);
    for (let k = 0; k < 5 && await has(p, '#modal .card'); k++) { await p.click('#modal .card [data-a]', { force: true }); await p.clock.runFor(400); }
    await p.evaluate(() => { const S = window.__tapuState(), k = S.cur, k2 = k.replace(/-0$/, '-1');
      const T = ['ev', 'kafe', 'kafe', 'ofis', 'ev', 'dukkan', 'dukkan', 'ofis'];
      S.d[k] = Array.from({ length: 20 }, (_, i) => ({ t: T[i % 8], lvl: [0, 1, 2, 4, 5, 6].includes(i) ? 5 : 4, buf: 0, until: 0, dur: 1, up: false }));
      S.d[k2] = Array(20).fill(null); S.own = [k, k2]; S.lien = {}; S.lienT = {}; S.collectMode = 'tap'; S.cash = 1e13; S.earned = 1e9; S.seen = { ev: true, kafe: true, dukkan: true, ofis: true };
      S.nextEvent = 9e12; S.nextOffer = 9e12; S.nextCivic = 9e12; S.nextAd = 9e12; S.nextTaxi = 9e12; S.collects = 0; S.market = 'x'; S.rifki = true; S.guideHint = true;
      S.starter = { at: 1, bought: true }; S.offer = null; S.ten = []; S.tdef = {}; S.nextTen = 9e15; S.pj = {}; S.pjIntro = false; S.cards = Object.keys(S.d);
      const d = new Date(); S.daily = { last: d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'), streak: 1 };
      S.tasks = { day: S.daily.last, bonus: false, list: [{ k: 'taxi', goal: 1e9, prog: 0, claimed: false }] }; });
    await p.clock.runFor(1500);
    for (let k = 0; k < 5 && await has(p, '#modal .card'); k++) { await p.click('#modal .card [data-a]', { force: true }); await p.clock.runFor(400); }
    return p;
  }
  const rk = p => p.evaluate(() => { const r = document.querySelector('#rifki'); return r.hidden ? null : { mood: r.querySelector('.rk-face')?.dataset.mood, txt: r.querySelector('.rk-bub span')?.textContent || '' }; });
  const rkX = p => p.evaluate(() => { const r = document.querySelector('#rifki .rk-x'); if (r && !document.querySelector('#rifki').hidden) r.click(); });
  const tile = i => `#grid .lot[data-i="${i}"]`;
  const tapTile = async (p, i) => { await p.click(tile(i), { force: true }); await p.clock.runFor(400); await p.waitForTimeout(350); };
  const rate = p => p.evaluate(() => window.__tapuTest.totalRate());
  const noOverflow = (p, root) => p.evaluate(r => { const els = [...document.querySelectorAll(r + ' *')].filter(e => { const b = e.getBoundingClientRect(); return b.width && (b.right > innerWidth + 0.5 || b.left < -0.5); }); return { doc: document.documentElement.scrollWidth, vw: innerWidth, bad: els.map(e => e.tagName + '.' + (e.getAttribute('class') || '')).slice(0, 4) }; }, root);
  const frames = p => p.evaluate(() => [...document.querySelectorAll('#grid .pjframe')].map(f => { const l = f.querySelector('.pjf-l'), r = l.getBoundingClientRect(); return { a: +f.dataset.a, txt: l.textContent, x: r.x, y: r.y, w: r.width, h: r.height }; }));
  const overlap = (a, c) => a.x < c.x + c.w && c.x < a.x + a.w && a.y < c.y + c.h && c.y < a.y + a.h;

  let p = await openPj();
  // Rıfkı tanıtır (bir kez): şaşkın yüz, yerel ad
  await p.clock.runFor(46e3); const r0 = await rk(p);
  ok(r0 && r0.mood === 'wow' && /koca bir proje/.test(r0.txt) && /Kadıköy’de bir (Han|Pasaj)/.test(r0.txt) && (await S(p)).pjIntro, 'Rıfkı projeleri tanıtıyor (wow, "Kadıköy’de bir …"): ' + JSON.stringify(r0));
  await rkX(p);
  // arsa panelinde teklif
  await tapTile(p, 5);
  const of = await p.evaluate(() => { const o = document.querySelector('#sheetBody .pjoffer'); return o ? { t: o.textContent, svg: !!o.querySelector('.pjo-ic svg'), bh: o.querySelector('[data-a="pj"]').getBoundingClientRect().height } : null; });
  ok(of && /Büyük proje/.test(of.t) && /2 blok uygun/.test(of.t) && /kira \+%20/.test(of.t) && of.svg && of.bh >= 44, 'arsa panelinde "Büyük proje" teklifi (2 blok, +%20, ≥44 px düğme): ' + JSON.stringify(of));
  await p.waitForTimeout(400); await p.screenshot({ path: out + 'proje-1-teklif.png' });
  await p.keyboard.press('Escape'); await p.clock.runFor(400);
  await tapTile(p, 12); // Sv4 bina, aynı semt: ilerleme notu
  const note = await p.evaluate(() => document.querySelector('#sheetBody .pjnote')?.textContent || '');
  ok(/bu 2×2 blokta \d\/4 bina Sv 5 · \d kat kaldı/.test(note), 'Sv4 binada ilerleme notu: ' + note);
  await p.keyboard.press('Escape'); await p.clock.runFor(400);
  // seçim modu: çakışan iki blok, etiketler ≥44 px ve üst üste binmiyor, diğer arsalar soluk
  await tapTile(p, 5); await p.click('#sheetBody [data-a="pj"]', { force: true }); await p.clock.runFor(400); await p.waitForTimeout(300);
  const fr = await frames(p), bar = await p.evaluate(() => { const b = document.querySelector('#pjBar'); return b && !b.hidden ? b.textContent : ''; });
  const dim = await p.evaluate(() => ({ sel: document.querySelector('#grid').classList.contains('pjsel'), op: getComputedStyle(document.querySelector('#grid .lot[data-i="19"]')).opacity }));
  ok(fr.length === 2 && fr.map(f => f.txt).sort().join() === 'Han,Pasaj' && fr.every(f => f.h >= 44 && f.w >= 44) && !overlap(fr[0], fr[1]), 'seçim çerçevesi: Han ve Pasaj, etiketler ≥44 px, çakışmıyor: ' + JSON.stringify(fr));
  ok(/2 blok uygun · birini seç/.test(bar) && dim.sel && +dim.op < 0.5 && !(await has(p, '#sheet.on')), 'şerit "2 blok uygun", panel kapalı, diğer arsalar soluk: ' + JSON.stringify(dim));
  await p.waitForTimeout(300); await p.screenshot({ path: out + 'proje-2-secim.png' });
  // çerçeve dışına dokunmak seçimi bırakır; yeniden gir
  await p.click(tile(9), { force: true }); await p.clock.runFor(400);
  ok(!(await frames(p)).length && !(await has(p, '#pjBar:not([hidden])')) && !(await has(p, '#sheet.on')), 'çerçeve dışına dokununca seçim kapanır (panel açılmaz)');
  // kiracı: 5. arsada yerleşik kiracı (esnaf, dükkân) — onay kartı söyler, projede kalır
  await p.evaluate(() => { const S = window.__tapuState(); S.ten.push({ id: 7, a: 'esnaf', k: S.cur, i: 5, w: { k: 'nb', t: 'ev' }, dl: S.playMs, st: 'live', end: S.playMs + 40 * 60e3 }); });
  await tapTile(p, 5); await p.click('#sheetBody [data-a="pj"]', { force: true }); await p.clock.runFor(400); await p.waitForTimeout(300);
  const pas = (await frames(p)).find(f => f.txt === 'Pasaj');
  await p.mouse.click(pas.x + pas.w / 2, pas.y + pas.h / 2); await p.clock.runFor(400); await p.waitForTimeout(350);
  const card = await p.evaluate(() => { const c = document.querySelector('#modal .pjcard'); return c ? { h: c.querySelector('h3').textContent, chips: c.querySelectorAll('.pjchip').length, led: [...c.querySelectorAll('.ledger > div')].map(d => d.textContent.replace(/\s+/g, ' ')), ten: c.querySelector('.pjten')?.textContent || '', go: !c.querySelector('[data-a="go"]').disabled, svg: !!c.querySelector('.pjart svg'), tt: getComputedStyle(c.querySelector('h3')).textTransform } : null; });
  ok(card && card.h === 'Pasaj' && card.chips === 4 && card.led.length === 4 && /\+%20/.test(card.led[1]) && card.go && card.svg, 'onay kartı (proje ruhsatı): Pasaj, 4 bina, kira önce/sonra +%20, bedel, süre: ' + JSON.stringify(card && card.led));
  ok(card && /Hüseyin Usta projede oturmaya devam eder/.test(card.ten) && /tek bina sayılır/.test(card.ten), 'onay kartı kiracıyı söylüyor (sessizce düşmez): ' + (card && card.ten));
  await p.waitForTimeout(300); await p.screenshot({ path: out + 'proje-3-onay.png' });
  const rate0 = await rate(p);
  await p.click('#modal [data-a="go"]', { force: true }); await p.clock.runFor(600); await p.waitForTimeout(300);
  const s1 = await S(p), q1 = s1.pj[s1.cur] && s1.pj[s1.cur][0];
  const tl = await p.evaluate(() => { const e = document.querySelector('#grid .lot[data-i="1"]'), r = e.getBoundingClientRect(); return { cls: e.className, gc: e.style.gridColumn, w: r.width, h: r.height, hidden: [2, 5, 6].map(i => getComputedStyle(document.querySelector(`#grid .lot[data-i="${i}"]`)).display), prog: e.querySelector('.pjprog')?.textContent || '', one: document.querySelector('#grid .lot[data-i="0"]').getBoundingClientRect().width }; });
  ok(q1 && q1.a === 1 && q1.kd === 'carsi' && q1.st === 0 && q1.until > Date.now(), 'proje başladı (Pasaj, 1. etap inşaatta): ' + JSON.stringify(q1));
  ok(/\bpj\b/.test(tl.cls) && /\bc\b/.test(tl.cls) && /span 2/.test(tl.gc) && tl.w > tl.one * 1.9 && tl.hidden.every(d => d === 'none') && /Proje inşaatı/i.test(tl.prog), '2×2 şantiye karosu, diğer üç karo gizli, "PROJE İNŞAATI" çubuğu: ' + JSON.stringify(tl));
  ok(Math.abs((await rate(p)) / rate0 - 1) < 0.01, 'inşaat sürerken kira değişmiyor');
  ok(s1.ten.some(x => x.id === 7 && x.st === 'live') && !(await frames(p)).length, 'kiracı projede kaldı; seçim çerçeveleri kalktı');
  await p.waitForTimeout(300); await p.screenshot({ path: out + 'proje-4-santiye.png' });
  // proje inşaatında reklamla hızlandırma ve 2x yok
  await tapTile(p, 1);
  const ps = await p.evaluate(() => ({ h: document.querySelector('#sheetBody .pj-head h3')?.textContent, ad: !!document.querySelector('#sheetBody [data-a="skip"],#sheetBody [data-a="lotboost"],#sheetBody [data-a="token"]'), cd: !!document.querySelector('#sheetBody [data-cd]') }));
  ok(ps.h === 'Pasaj' && !ps.ad && ps.cd, 'proje paneli (inşaat): geri sayım var, reklamla hızlandırma / 2x yok: ' + JSON.stringify(ps));
  await p.keyboard.press('Escape'); await p.clock.runFor(400); await rkX(p);
  // teslim
  await p.evaluate(() => { const S = window.__tapuState(); S.pj[S.cur][0].until = Date.now() + 500; }); await p.clock.runFor(900); await p.waitForTimeout(150);
  const del = await p.evaluate(() => ({ ts: document.querySelector('#grid .lot[data-i="1"] .teslim')?.textContent || '', big: document.querySelector('#bigStamp:not([hidden])')?.textContent || '' }));
  await p.screenshot({ path: out + 'proje-5-teslim.png' });
  const s2 = await S(p), rate1 = await rate(p);
  ok(s2.pj[s2.cur][0].st === 1 && /TESLİM/.test(del.ts) && /Pasaj/.test(del.ts) && /PROJE TESLİM/.test(del.big) && /KİRALAR \+%20/.test(del.big), 'teslim: karoda TESLİM mührü (Pasaj), büyük mühür "PROJE TESLİM · KİRALAR +%20": ' + JSON.stringify(del));
  ok(rate1 > rate0 * 1.01, 'teslimde toplam kira arttı (' + rate0.toFixed(1) + ' → ' + rate1.toFixed(1) + ')');
  await p.clock.runFor(3000); const r1 = await rk(p);
  ok(r1 && r1.mood === 'party' && /Pasaj hayırlı olsun/.test(r1.txt), 'Rıfkı teslimi kutluyor: ' + JSON.stringify(r1));
  await rkX(p);
  ok(await has(p, tile(1) + ' .pjn') && await has(p, tile(1) + ' .tn.s-live'), 'bitmiş proje karosunda ad etiketi ve kiracı rozeti');
  // proje paneli: döküm, 2. etap
  await tapTile(p, 1);
  const pp = await p.evaluate(() => ({ led: [...document.querySelectorAll('#sheetBody .ledger > div')].map(d => d.textContent.replace(/\s+/g, ' ')), b2: document.querySelector('#sheetBody [data-a="pj2"]')?.textContent || '' }));
  ok(pp.led.some(s => /Proje bonusu.*\+%20/.test(s)) && pp.led.some(s => /Kiracı · Hüseyin Usta/.test(s)) && pp.led.some(s => /aynen sayılır/.test(s)) && /2. etap · kat ekle/.test(pp.b2), 'proje paneli: kira dökümü, kiracı satırı, 2. etap düğmesi: ' + JSON.stringify(pp.led));
  await p.waitForTimeout(300); await p.screenshot({ path: out + 'proje-6-panel.png' });
  await p.click('#sheetBody [data-a="pj2"]', { force: true }); await p.clock.runFor(400);
  ok((await S(p)).pj[s2.cur][0].until > Date.now(), '2. etap başladı');
  await p.evaluate(() => { const S = window.__tapuState(); S.pj[S.cur][0].until = Date.now() + 500; }); await p.clock.runFor(1200);
  const s3 = await S(p), rate2 = await rate(p);
  ok(s3.pj[s3.cur][0].st === 2 && rate2 > rate1, '2. etap teslim: etap 2, kira yine arttı');
  const fin = await p.evaluate(() => ({ last: document.querySelector('#sheetBody .btns .btn[disabled]')?.textContent || '', h: document.querySelector('#sheetBody .pj-head h3')?.textContent }));
  ok(/Son etap/.test(fin.last) && /II/.test(fin.h), 'panelde "Son etap", adda II: ' + JSON.stringify(fin));
  // ayırma: iki dokunuş; kira eski hâline, karolar geri
  await p.click('#sheetBody [data-a="split"]', { force: true }); await p.clock.runFor(300);
  ok((await S(p)).pj[s3.cur] && await has(p, '#sheetBody .iconbtn.warn'), 'ayır: ilk dokunuş onay ister');
  await p.click('#sheetBody [data-a="split"]', { force: true }); await p.clock.runFor(600);
  const s4 = await S(p), rate3 = await rate(p), back = await p.evaluate(() => [1, 2, 5, 6].map(i => { const e = document.querySelector(`#grid .lot[data-i="${i}"]`); return getComputedStyle(e).display !== 'none' && !e.classList.contains('pj'); }));
  ok(!s4.pj[s4.cur] && back.every(Boolean) && Math.abs(rate3 / rate0 - 1) < 0.01 && s4.d[s4.cur].every(x => x && x.lvl >= 4) && /Proje ayrıldı/.test(await p.textContent('#toast')), 'ayırınca dört bina yerinde, kira eski hâline: ' + rate3.toFixed(1));
  ok(s4.ten.some(x => x.id === 7 && x.st === 'live'), 'ayırınca kiracı binasında kalıyor');
  ok(!p.errs.length, 'konsol temiz' + (p.errs.length ? ' [' + p.errs.slice(0, 2).join('|') + ']' : ''));
  await p.context().close();

  // koyu tema + hareketi azalt + 320 px (Almanya / Almanca: Markthalle üslubu)
  p = await openPj({ dark: true, rm: true, vp: { width: 320, height: 568 }, lang: 'de', region: 'de', city: 'muc' });
  await rkX(p);
  await tapTile(p, 5);
  const o320 = await noOverflow(p, '#sheetBody');
  ok(o320.doc <= 320 && !o320.bad.length && await has(p, '#sheetBody .pjoffer'), '320 px (DE): teklif taşmıyor: ' + JSON.stringify(o320));
  await p.click('#sheetBody [data-a="pj"]', { force: true }); await p.clock.runFor(400); await p.waitForTimeout(300);
  const f320 = await frames(p), an = await p.evaluate(() => { const f = document.querySelector('#grid .pjframe'); return f ? getComputedStyle(f).animationName : ''; });
  ok(f320.length === 2 && f320.every(f => f.h >= 44 && f.x >= -0.5 && f.x + f.w <= 320.5) && !overlap(f320[0], f320[1]), '320 px: iki etiket ekranda, ≥44 px, çakışmıyor: ' + JSON.stringify(f320.map(f => f.txt)));
  ok(an === 'none', 'hareketi azalt: çerçeve nabzı yok');
  ok(f320.some(f => f.txt === 'Markthalle'), 'Almanya üslubu: Markthalle');
  await p.waitForTimeout(300); await p.screenshot({ path: out + 'proje-7-320-koyu-secim.png' });
  await p.mouse.click(f320[0].x + f320[0].w / 2, f320[0].y + f320[0].h / 2); await p.clock.runFor(400); await p.waitForTimeout(350);
  const c320 = await noOverflow(p, '#modal'), dk = await p.evaluate(() => { const c = document.querySelector('#modal .pjcard'); return c ? { th: document.documentElement.dataset.theme, bg: getComputedStyle(c).backgroundColor, btn: [...c.querySelectorAll('.btns button')].map(x => x.getBoundingClientRect().height) } : null; });
  ok(dk && dk.th === 'dark' && !/255, 255, 255/.test(dk.bg) && dk.btn.every(h => h >= 44) && !c320.bad.length, '320 px koyu: onay kartı koyu zeminde, düğmeler ≥44 px, taşma yok: ' + JSON.stringify(dk));
  await p.waitForTimeout(300); await p.screenshot({ path: out + 'proje-8-320-koyu-onay.png' });
  await p.click('#modal [data-a="go"]', { force: true }); await p.clock.runFor(400);
  await p.evaluate(() => { const S = window.__tapuState(); S.pj[S.cur][0].until = Date.now() + 500; }); await p.clock.runFor(3500); await rkX(p);
  await p.waitForTimeout(300); await p.screenshot({ path: out + 'proje-9-320-koyu-tahta.png' });
  ok(await has(p, '#grid .lot.pj.b .pjn'), 'koyu tema: bitmiş proje karosu ve adı');
  ok(!p.errs.length, 'konsol temiz' + (p.errs.length ? ' [' + p.errs.slice(0, 2).join('|') + ']' : ''));
  await p.context().close();

  // yatay 844×390 (Birleşik Krallık / İngilizce)
  p = await openPj({ vp: { width: 844, height: 390 }, lang: 'en', region: 'uk', city: 'lon' });
  await rkX(p);
  await tapTile(p, 5); await p.click('#sheetBody [data-a="pj"]', { force: true }); await p.clock.runFor(400); await p.waitForTimeout(300);
  const fl = await frames(p), bl = await p.evaluate(() => { const b = document.querySelector('#pjBar').getBoundingClientRect(), g = document.querySelector('#grid').getBoundingClientRect(); return { b: [b.left, b.right, b.top, b.bottom], g: [g.left, g.right, g.top, g.bottom], doc: document.documentElement.scrollWidth }; });
  ok(fl.length === 2 && fl.every(f => f.y >= -0.5 && f.y + f.h <= 390.5 && f.h >= 44) && fl.some(f => /Victorian Arcade/.test(f.txt)), 'yatay: etiketler ekranda, İngiltere adı (Victorian Arcade): ' + JSON.stringify(fl.map(f => f.txt)));
  ok(bl.doc <= 844 && (bl.b[1] <= bl.g[0] || bl.b[0] >= bl.g[1] || bl.b[3] <= bl.g[2] || bl.b[2] >= bl.g[3]), 'yatay: şerit tahtaya binmiyor, yatay kaydırma yok: ' + JSON.stringify(bl));
  await p.waitForTimeout(300); await p.screenshot({ path: out + 'proje-10-yatay-secim.png' });
  await p.mouse.click(fl[0].x + fl[0].w / 2, fl[0].y + fl[0].h / 2); await p.clock.runFor(400); await p.waitForTimeout(350);
  const go = await p.evaluate(() => { const c = document.querySelector('#modal .pjcard'); const b = c && c.querySelector('[data-a="go"]'); if (!b) return null; b.scrollIntoView({ block: 'nearest' }); const r = b.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, h: r.height, txt: b.textContent }; });
  ok(go && go.bottom <= 390.5 && go.h >= 44 && /Start project/.test(go.txt), 'yatay: onay kartı kaydırılarak "Start project" erişilebilir: ' + JSON.stringify(go));
  await p.click('#modal [data-a="go"]', { force: true }); await p.clock.runFor(400);
  await p.evaluate(() => { const S = window.__tapuState(); S.pj[S.cur][0].until = Date.now() + 500; }); await p.clock.runFor(3500); await rkX(p);
  await p.waitForTimeout(300); await p.screenshot({ path: out + 'proje-11-yatay-uk.png' });
  const t2 = await p.evaluate(() => { const e = document.querySelector('#grid .lot.pj'); return e ? e.getAttribute('aria-label') : ''; });
  ok(/big project/.test(t2), 'yatay UK: proje karosu, ekran okuyucu metni İngilizce: ' + t2);
  ok(!p.errs.length, 'konsol temiz' + (p.errs.length ? ' [' + p.errs.slice(0, 2).join('|') + ']' : ''));
  await p.context().close();
}

// ---------- 18) Rakip emlakçı ve ihale: hap, tanıtım, panel, vekâlet/emanet, geçilme, kazanma/kaybetme, köşe başı, şehir rakipleri,
// koyu tema + hareketi azalt, 320 px, UK (Türkçe büyük harf), yok sayan oyuncu ----------
async function ihaleBolum(b) {
  const MON = new Date(2026, 10, 16, 10, 0).getTime(), THU = new Date(2026, 10, 19, 10, 0).getTime();
  /** İhale vakası: iki semt (ihale açık), kasada bol para, Pazartesi 10:00 (ya da o.t). */
  async function openIh(o = {}) {
    const ctx = await b.newContext({ viewport: o.vp || { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, reducedMotion: o.rm ? 'reduce' : 'no-preference' });
    await ctx.addInitScript(`localStorage.setItem('tapu-prefs',JSON.stringify({lang:'${o.lang || 'tr'}',region:'${o.region || 'tr'}',ent:{},news:true${o.dark ? ",theme:'dark'" : ''}}));` + (o.dark ? "localStorage.setItem('tapu-theme','dark');" : ''));
    const p = await ctx.newPage(); p.errs = []; p.on('pageerror', e => p.errs.push(e.message));
    await p.clock.install({ time: o.t || MON }); await p.goto(URL); await p.clock.runFor(700);
    await p.click(`#modal .cityopt[data-a="${o.city || 'ist'}"]`, { force: true }); await p.clock.runFor(400);
    for (let k = 0; k < 5 && await has(p, '#modal .card'); k++) { await p.click('#modal .card [data-a]', { force: true }); await p.clock.runFor(400); }
    await p.evaluate(rifki => { const S = window.__tapuState(), k = S.cur, k2 = k.replace(/-0$/, '-1'); const T = ['ev', 'kafe', 'dukkan', 'ofis'];
      S.d[k] = Array.from({ length: 20 }, (_, i) => ({ t: T[i % 4], lvl: 3, buf: 0, until: 0, dur: 1, up: false })); S.d[k2] = Array(20).fill(null); S.own = [k, k2];
      S.lien = {}; S.lienT = {}; S.collectMode = 'tap'; S.cash = 1e9; S.earned = 1e9; S.seen = { ev: true, kafe: true, dukkan: true, ofis: true };
      S.nextEvent = 9e12; S.nextOffer = 9e12; S.nextCivic = 9e12; S.nextAd = 9e12; S.nextTaxi = 9e12; S.collects = 0; S.market = 'x'; S.rifki = rifki; S.guideHint = true;
      S.starter = { at: 1, bought: true }; S.offer = null; S.ten = []; S.nextTen = 9e15; S.pjIntro = true; S.cards = Object.keys(S.d);
      const d = new Date(); S.daily = { last: d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'), streak: 1 };
      S.tasks = { day: S.daily.last, bonus: false, list: [{ k: 'taxi', goal: 1e9, prog: 0, claimed: false }] }; }, !!o.rifki);
    await p.clock.runFor(1500);
    for (let k = 0; k < 5 && await has(p, '#modal .card'); k++) { await p.click('#modal .card [data-a]', { force: true }); await p.clock.runFor(400); }
    return p;
  }
  const cur = p => p.evaluate(() => JSON.parse(JSON.stringify(window.__tapuState().ihale.cur)));
  const cash = p => p.evaluate(() => window.__tapuState().cash);
  const rk = p => p.evaluate(() => { const r = document.querySelector('#rifki'); return r.hidden ? null : { mood: r.querySelector('.rk-face')?.dataset.mood, txt: r.querySelector('.rk-bub span')?.textContent || '' }; });
  const pill = p => p.evaluate(() => { const e = document.querySelector('#ihalePill'); return e.hidden ? null : { txt: e.innerText, me: !!e.querySelector('.ihd.me'), rv: !!e.querySelector('.ihd.rv') }; });
  const openPanel = async p => { await p.click('#ihalePill', { force: true }); await p.clock.runFor(400); await p.waitForTimeout(300); if (await has(p, '#modal [data-a="go"]')) { await p.click('#modal [data-a="go"]', { force: true }); await p.clock.runFor(400); } await p.waitForTimeout(450); };
  const proxy = (p, f) => p.evaluate(f => { const T = window.__tapuTest.ihale, a = T.IH().cur; return T.setProxy(a, (0, eval)('(' + f + ')')(a, T)); }, f.toString());
  const ff = async (p, ms) => { await p.clock.fastForward(ms); await p.clock.runFor(1500); await p.waitForTimeout(500); };
  const noOverflow = p => p.evaluate(() => { const els = [...document.querySelectorAll('#sheetBody *, #modal *')].filter(e => { const r = e.getBoundingClientRect(); return r.width && (r.right > innerWidth + 0.5 || r.left < -0.5); }); return { doc: document.documentElement.scrollWidth, vw: innerWidth, bad: els.map(e => e.tagName + '.' + (e.getAttribute('class') || '')).slice(0, 4) }; });
  const sizes = p => p.evaluate(() => [...document.querySelectorAll('#sheetBody .ih-sb, #sheetBody .ih-chip, #sheetBody [data-a="give"]')].map(e => { const r = e.getBoundingClientRect(); return Math.round(Math.min(r.width, r.height)); }));

  // hap, Rıfkı ipucu, tanıtım
  let p = await openIh({ rifki: true });
  const a0 = await cur(p), h0 = await pill(p);
  ok(a0 && a0.kind === 'lm' && a0.prize === 'beylerbeyi' && a0.rv === 'cemil' && a0.close === new Date(2026, 10, 16, 23).getTime(), 'Pazartesi 10:00: tarihi yapı ihalesi (Beylerbeyi, Kurnaz Cemil, kapanış 23:00): ' + JSON.stringify(a0 && { k: a0.kind, p: a0.prize, rv: a0.rv }));
  ok(h0 && /İHALE · BEYLERBEYİ SARAYI/.test(h0.txt) && /12:59:\d\d/.test(h0.txt) && h0.rv, 'tahtada ihale hapı (kırmızı nokta: rakip önde, geri sayım): ' + JSON.stringify(h0));
  const hb = await p.evaluate(() => { const e = document.querySelector('#ihalePill'), r = e.getBoundingClientRect(), g = document.querySelector('#grid').getBoundingClientRect(), bf = getComputedStyle(e, '::before'); return { h: r.height - parseFloat(bf.top) - parseFloat(bf.bottom), below: r.bottom <= g.top + 1 }; });
  ok(hb.h >= 44 && hb.below, 'hap dokunma alanı ≥44 px ve arsalara binmiyor: ' + JSON.stringify(hb));
  await p.clock.runFor(46e3); const r0 = await rk(p);
  ok(r0 && r0.mood === 'think' && /Bugün ihale var efendim: Beylerbeyi Sarayı/.test(r0.txt) && /Kurnaz Cemil/.test(r0.txt), 'Rıfkı ihaleyi bir kez söyler (düşünceli): ' + JSON.stringify(r0));
  await p.evaluate(() => document.querySelector('#rifki .rk-x')?.click());
  await p.screenshot({ path: out + 'ihale-1-hap.png' });
  await p.click('#ihalePill', { force: true }); await p.clock.runFor(400); await p.waitForTimeout(400);
  const intro = await p.evaluate(() => { const c = document.querySelector('#modal .card'); return c ? { t: c.innerText, faces: c.querySelectorAll('.ih-duo svg').length, rv: c.querySelector('.rv-svg')?.dataset.rival, rules: c.querySelectorAll('.ih-rules li').length } : null; });
  ok(intro && intro.faces === 2 && intro.rv === 'cemil' && /RAKİP EMLAKÇI: KURNAZ CEMİL/.test(intro.t) && /Beyoğlu’nun eski tilkisi/.test(intro.t) && intro.rules === 3 && /Pazartesi tarihi yapı, Perşembe nadir arsa · 08:00–23:00/.test(intro.t), 'tanıtım: Rıfkı vs Kurnaz Cemil, şehre özgü tanıtım, 3 kural (takvim 08:00–23:00): ' + JSON.stringify(intro && intro.t.slice(0, 80)));
  await p.screenshot({ path: out + 'ihale-2-tanitim.png' });
  await p.click('#modal [data-a="go"]', { force: true }); await p.clock.runFor(400); await p.waitForTimeout(450);
  // panel
  const pn0 = await p.evaluate(() => { const b = document.querySelector('#sheetBody'); return { t: b.innerText, lead: b.querySelector('.ih-side.rv.lead') ? 'rv' : 'me', face: b.querySelector('.ih-side .rv-svg')?.dataset.mood, chip: !!b.querySelector('.ih-chip.on') }; });
  ok((await S(p)).ihale.intro && /BEYLERBEYİ SARAYI/.test(pn0.t) && pn0.lead === 'rv' && pn0.face === 'smug' && /Kurnaz Cemil böyle bir tapuya/.test(pn0.t) && pn0.chip && /VEKÂLET VER/.test(pn0.t) && /Koleksiyoncu/.test(pn0.t), 'panel: ödül, masa (Cemil önde, kendinden emin), Rıfkı aralığı, öneri seçili: ' + JSON.stringify(pn0.t.slice(0, 60)));
  const sz = await sizes(p); ok(sz.length === 4 && sz.every(v => v >= 44), 'adımlayıcı, öneri ve ana düğme ≥44 px: ' + sz);
  await p.screenshot({ path: out + 'ihale-3-panel.png' });
  // vekâlet ve emanet
  const c0 = await cash(p);
  await p.click('#sheetBody [data-a="give"]', { force: true }); await p.clock.runFor(800); await p.waitForTimeout(300);
  const a1 = await cur(p), c1 = await cash(p), h1 = await pill(p);
  const early = Math.max(a1.start, Math.floor(a1.cap * a1.early / a1.step) * a1.step) + a1.step;
  ok(a1.my === a1.capHi + a1.step && a1.held === early && Math.abs(c0 - c1 - early) < 1e6, 'vekâlet (Rıfkı’nın önerisi): yalnız önde olunan fiyat emanete (' + a1.held + '), kasa o kadar azaldı');
  const pn1 = await p.evaluate(() => { const b = document.querySelector('#sheetBody'); return { me: !!b.querySelector('.ih-side.me.lead .ih-stamp.me'), mood: b.querySelector('.ih-side .rv-svg')?.dataset.mood, t: b.innerText }; });
  ok(h1 && h1.me && pn1.me && pn1.mood === 'bid' && /Emanette/.test(pn1.t), 'öne geçince hap yeşil, masada ÖNDE mührü bende, rakip hamle ifadesinde: ' + JSON.stringify({ h: h1, mood: pn1.mood }));
  await p.screenshot({ path: out + 'ihale-4-vekalet.png' });
  await p.keyboard.press('Escape'); await p.clock.runFor(400);
  await p.click('#menuBtn', { force: true }); await p.clock.runFor(400); await p.waitForTimeout(300);
  const mrow = await p.evaluate(() => document.querySelector('#sheetBody .drow[data-a="ihale"]')?.innerText || '');
  ok(/İHALE · BEYLERBEYİ SARAYI/i.test(mrow) && /Kurnaz Cemil ile yarış/.test(mrow), 'menüde ihale satırı: ' + mrow.replace(/\n/g, ' '));
  await p.keyboard.press('Escape'); await p.clock.runFor(400);
  // kazanma: kapanışta tavan + 1 adım ödenir, SATILDI, İhale salonu
  await ff(p, 13 * 3600e3 + 60e3);
  const res = await p.evaluate(() => { const c = document.querySelector('#modal .card.ih-res'); return c ? { t: c.innerText, won: c.classList.contains('won'), mood: c.querySelector('.rv-svg')?.dataset.mood, op: getComputedStyle(c).opacity } : null; });
  const a2 = await cur(p);
  ok(res && res.won && /SATILDI/.test(res.t) && /BEYLERBEYİ SARAYI SENİN!/.test(res.t) && res.mood === 'mad' && res.op === '1' && a2.paid === a2.cap + a2.step, 'kazanma: SATILDI, rakip kızgın, ödenen = tavan + 1 adım (' + (a2 && a2.paid) + ')');
  ok(Math.abs((c0 - (await cash(p))) - a2.paid) < 1e6 && (await S(p)).ihale.got.includes('beylerbeyi'), 'kasadan yalnız fiyat çıktı; yapı İhale salonunda');
  await p.screenshot({ path: out + 'ihale-5-kazandin.png' });
  await p.click('#modal [data-a="ok"]', { force: true }); await p.clock.runFor(400); await p.waitForTimeout(450);
  const coll = await p.evaluate(() => document.querySelector('#sheetBody')?.innerText || '');
  ok(/İHALE SALONU · 1\/4/.test(coll) && /BEYLERBEYİ SARAYI/.test(coll) && /İHALEDE/.test(coll), 'koleksiyonda "İhale salonu · 1/4" sırası: ' + (coll.match(/İHALE SALONU[^\n]*/) || [''])[0]);
  await p.screenshot({ path: out + 'ihale-6-salon.png' });
  ok(!p.errs.length, 'konsol temiz (kazanma)' + (p.errs.length ? ' [' + p.errs.slice(0, 2).join('|') + ']' : ''));
  await p.context().close();

  // geçilme ve kaybetme (İzmir: şehrin kendi rakibi)
  p = await openIh({ city: 'izm', rifki: true });
  const ai = await cur(p); ok(ai.prize === 'kizlaragasi' && ai.rv === 'nevzat', 'İzmir: ihale yapısı Kızlarağası Hanı, rakip Kordonlu Nevzat: ' + ai.rv);
  const cz = await cash(p); await proxy(p, a => a.cap - a.step); await p.clock.runFor(400);
  ok((await cur(p)).held > 0, 'tavanın altındaki vekâlet erken saatlerde önde (emanette)');
  await ff(p, 11 * 3600e3 + 120e3); await p.clock.runFor(2000);
  const ag = await cur(p), rg = await rk(p);
  ok(ag.held === 0 && Math.abs((await cash(p)) - cz) < 1e6, 'son düzlükte geçilince emanet kasaya döndü');
  ok(rg && rg.mood === 'warn' && /Son düzlük! Kordonlu Nevzat sizi geçti/.test(rg.txt), 'Rıfkı uyarır (uyarı ifadesi): ' + JSON.stringify(rg));
  await openPanel(p);
  const late = await p.evaluate(() => ({ band: document.querySelector('#sheetBody .ih-late')?.innerText || '', mood: document.querySelector('#sheetBody .ih-side .rv-svg')?.dataset.mood }));
  ok(/SON DÜZLÜK/.test(late.band) && late.mood === 'bid', 'panelde SON DÜZLÜK şeridi, rakip hamle: ' + JSON.stringify(late));
  await p.screenshot({ path: out + 'ihale-7-gecildi-izmir.png' });
  await p.keyboard.press('Escape'); await p.clock.runFor(400);
  await ff(p, 2 * 3600e3 + 60e3);
  const lost = await p.evaluate(() => { const c = document.querySelector('#modal .card.ih-res'); return c ? { t: c.innerText, lost: c.classList.contains('lost'), mood: c.querySelector('.rv-svg')?.dataset.mood, rifki: !!c.querySelector('.rk-svg') } : null; });
  ok(lost && lost.lost && /KORDONLU NEVZAT ALDI/.test(lost.t) && lost.mood === 'smug' && lost.rifki && /hiçbir şey kaybetmedin/.test(lost.t) && Math.abs((await cash(p)) - cz) < 1e6, 'kaybetme: rakip mührü, rakip kendinden emin, Rıfkı teselli, para kasada');
  await p.screenshot({ path: out + 'ihale-8-kaybettin.png' });
  ok(!p.errs.length, 'konsol temiz (kaybetme)' + (p.errs.length ? ' [' + p.errs.slice(0, 2).join('|') + ']' : ''));
  await p.context().close();

  // köşe başı (Perşembe nadir arsa): kazan, seçim ekranı, damga
  p = await openIh({ t: THU, city: 'ank' });
  const ak = await cur(p); ok(ak.kind === 'arsa' && ak.rv === 'sabri', 'Perşembe: nadir arsa ihalesi (Ankara: Bürokrat Sabri): ' + ak.rv);
  await proxy(p, (a, T) => T.advice(a)); await ff(p, 13 * 3600e3 + 60e3);
  ok(/ARSAYI SEÇ/.test(await p.evaluate(() => document.querySelector('#modal .card')?.innerText || '')), 'kazanınca "Arsayı seç"');
  await p.click('#modal [data-a="ok"]', { force: true }); await p.clock.runFor(400); await p.waitForTimeout(450);
  const ks = await p.evaluate(() => { const b = document.querySelector('#sheetBody'); return { t: b.innerText, cells: b.querySelectorAll('.ks-grid .ks-cell').length, chips: b.querySelectorAll('.ks-ds .chip').length, h: Math.min(...[...b.querySelectorAll('.ks-cell')].map(e => e.getBoundingClientRect().height)) }; });
  ok(/ARSANI SEÇ/.test(ks.t) && ks.cells === 20 && ks.chips === 2 && ks.h >= 44, 'köşe başı seçme ekranı: 2 semt, 20 arsa (≥44 px): ' + JSON.stringify({ c: ks.cells, ch: ks.chips, h: ks.h }));
  const lr0 = await p.evaluate(() => window.__tapuTest.totalRate());
  await p.click('#sheetBody .ks-cell[data-i="3"]', { force: true }); await p.clock.runFor(300); await p.waitForTimeout(200);
  await p.screenshot({ path: out + 'ihale-9-kosebasi-secim.png' });
  await p.click('#sheetBody [data-a="stamp"]', { force: true }); await p.clock.runFor(900); await p.waitForTimeout(400);
  const kz = await S(p), lr1 = await p.evaluate(() => window.__tapuTest.totalRate());
  const flag = await p.evaluate(() => !!document.querySelector('#grid .lot[data-i="3"] .kose') && document.querySelectorAll('#grid .lot .kose').length === 1);
  ok(kz.ihale.kose[0] === kz.cur + ':3' && kz.ihale.kp === 0 && flag && lr1 > lr0, 'damga vuruldu: arsada bayrak, kira arttı (' + Math.round(lr0) + '→' + Math.round(lr1) + ')');
  await p.click('#grid .lot[data-i="3"]', { force: true }); await p.clock.runFor(400); await p.waitForTimeout(400);
  ok(/Köşe başı arsa\s*\+%40/.test(await p.evaluate(() => document.querySelector('#sheetBody .ledger')?.innerText || '')), 'arsa panelinde "Köşe başı arsa +%40" satırı');
  await p.screenshot({ path: out + 'ihale-10-kosebasi.png' });
  ok(!p.errs.length, 'konsol temiz (köşe başı)' + (p.errs.length ? ' [' + p.errs.slice(0, 2).join('|') + ']' : ''));
  await p.context().close();

  // UK · koyu tema + hareketi azalt: Big Ben, Sir Reginald; Türkçe büyük harf (SIR REGINALD / BIG BEN, İ yok)
  p = await openIh({ region: 'uk', city: 'lon', dark: true, rm: true });
  const hu = await pill(p); ok(hu && /BIG BEN/.test(hu.txt) && !/İ/.test(hu.txt.replace('İHALE', '')), 'UK hap: "BIG BEN" (Türkçe İ yok): ' + JSON.stringify(hu));
  await openPanel(p); await proxy(p, a => a.cap - a.step); await p.clock.runFor(400);
  await p.clock.fastForward(11 * 3600e3 + 120e3); await p.clock.runFor(1500); await p.waitForTimeout(400);
  const uk = await p.evaluate(() => { const b = document.querySelector('#sheetBody'); return { name: b.querySelector('.ih-side.rv > b')?.innerText, h: b.querySelector('.lgt')?.innerText, th: document.documentElement.dataset.theme, bg: getComputedStyle(b.querySelector('.ih-side .rv-svg rect')).fill, band: !!b.querySelector('.ih-late') }; });
  ok(uk.name === 'SIR REGINALD' && uk.h === 'BIG BEN' && uk.band, 'UK panel: "SIR REGINALD", "BIG BEN" (lang="en"), son düzlük: ' + JSON.stringify(uk));
  ok(uk.th === 'dark', 'koyu tema: rakip kartı koyu (--rv-card): ' + uk.bg);
  const ov = await noOverflow(p); ok(ov.doc <= ov.vw && !ov.bad.length, 'koyu tema panel taşmıyor: ' + JSON.stringify(ov));
  await p.screenshot({ path: out + 'ihale-11-uk-koyu-sonduzluk.png' });
  await p.keyboard.press('Escape'); await p.clock.runFor(400);
  await proxy(p, (a, T) => T.advice(a)); await ff(p, 2 * 3600e3 + 60e3);
  const anim = await p.evaluate(() => { const s = document.querySelector('#modal .ih-sold'); return s ? { a: getComputedStyle(s).animationName, t: s.innerText } : null; });
  ok(anim && anim.a === 'none' && anim.t === 'SATILDI', 'hareketi azalt: SATILDI mührü animasyonsuz: ' + JSON.stringify(anim));
  await p.screenshot({ path: out + 'ihale-12-uk-kazandin.png' });
  ok(!p.errs.length, 'konsol temiz (UK)' + (p.errs.length ? ' [' + p.errs.slice(0, 2).join('|') + ']' : ''));
  await p.context().close();

  // 320 px (Global · Tokyo: Tanaka-san) ve EN
  p = await openIh({ region: 'gl', city: 'tyo', vp: { width: 320, height: 568 } });
  const ag2 = await cur(p); ok(ag2.rv === 'tanaka' && ['tokyotower', 'kaminarimon'].includes(ag2.prize), 'Global · Tokyo: Japonya ihale yapısı, rakip Tanaka-san: ' + ag2.prize);
  await openPanel(p);
  const o320 = await noOverflow(p), s320 = await sizes(p);
  ok(o320.doc <= o320.vw && !o320.bad.length && s320.every(v => v >= 44), '320 px: panel taşmıyor, dokunma alanları ≥44 px: ' + JSON.stringify({ o: o320, s: s320 }));
  await p.screenshot({ path: out + 'ihale-13-320-tokyo.png' });
  await p.context().close();
  p = await openIh({ region: 'us', city: 'nyc', lang: 'en' });
  await openPanel(p);
  const en = await p.evaluate(() => document.querySelector('#sheetBody').innerText);
  ok(/STATUE OF LIBERTY|EMPIRE STATE/.test(en) && /HUSTLIN’ HANK/.test(en) && /PLACE PROXY BID/.test(en) && !/Vekâlet|İhale/.test(en), 'EN · New York: çeviriler ve rakip Hustlin’ Hank');
  await p.screenshot({ path: out + 'ihale-14-en-nyc.png' });
  await p.context().close();

  // yok sayan oyuncu: kart yok, kasa ve kira aynı
  p = await openIh();
  const cy = await cash(p), ry = await p.evaluate(() => window.__tapuTest.totalRate());
  await ff(p, 13 * 3600e3 + 60e3);
  const ign = await p.evaluate(() => ({ card: !!document.querySelector('#modal .card.ih-res'), pill: !document.querySelector('#ihalePill').hidden, s: window.__tapuState().ihale }));
  ok(!ign.card && !ign.pill && ign.s.cur.done === 'lost' && ign.s.cur.seen && !ign.s.got.length && (await cash(p)) >= cy && Math.abs((await p.evaluate(() => window.__tapuTest.totalRate())) - ry) < 1e-6 * ry, 'yok sayan: sonuç kartı yok, hap kayboldu, kasa/kira değişmedi');
  ok(!p.errs.length, 'konsol temiz (yok sayan)' + (p.errs.length ? ' [' + p.errs.slice(0, 2).join('|') + ']' : ''));
  await p.context().close();
}

(async()=>{
  const b=await chromium.launch(); URL=await serve();
  if(process.env.IY_ONLY==='18'){ // yalnızca ihale bölümü: IY_ONLY=18 node tests/iyilestirme.cjs
    console.log('18) Rakip emlakçı ve ihale'); await ihaleBolum(b); await b.close();
    const pass=results.filter(r=>r.pass).length; console.log(`\nSONUÇ: ${pass}/${results.length} geçti`); process.exit(pass===results.length?0:1);
  }
  if(process.env.IY_ONLY==='17'){ // yalnızca büyük projeler bölümü: IY_ONLY=17 node tests/iyilestirme.cjs
    console.log('17) Büyük projeler'); await projeBolum(b); await b.close();
    const pass=results.filter(r=>r.pass).length; console.log(`\nSONUÇ: ${pass}/${results.length} geçti`); process.exit(pass===results.length?0:1);
  }

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
  const labels=await p.evaluate(()=>[...document.querySelectorAll('#sheetBody .seg [data-a="theme"]')].map(e=>e.textContent.trim()).join('/'));
  ok(labels==='Otomatik/Açık/Koyu','tema etiketleri: '+labels);
  const bgOf=()=>p.evaluate(()=>getComputedStyle(document.body).backgroundColor);
  const light=await bgOf();
  await p.$eval('#sheetBody [data-a="theme"][data-v="dark"]',e=>e.click()); await settle(p);
  const dk=await p.evaluate(()=>({t:document.documentElement.dataset.theme,bg:getComputedStyle(document.body).backgroundColor,meta:document.querySelector('meta[name=theme-color]').content,pref:JSON.parse(localStorage.getItem('tapu-prefs')).theme,chk:document.querySelector('#sheetBody [data-v="dark"]').getAttribute('aria-checked')}));
  ok(dk.t==='dark'&&dk.bg!==light&&dk.chk==='true','koyu seçilince data-theme=dark, zemin değişti ('+dk.bg+')');
  ok(dk.meta===dk.bg,'theme-color meta zeminle aynı ('+dk.meta+')');
  ok(dk.pref==='dark','tercih tapu-prefs\'e yazıldı');
  ok(await p.evaluate(()=>localStorage.getItem('tapu-theme'))==='dark','tema aynası localStorage[tapu-theme]=dark');
  // yanıp sönme: belge <body>'ye geldiğinde (CSS'ten sonra, oyun betiği çalışmadan, ilk boyamadan önce) tema zaten koyu mu?
  // Sayfa yanıtına <body> başına küçük bir gözlem betiği eklenir; oyun modülü ertelenmiş olduğundan bu an yalnızca <head>'deki satır içi betiği görür.
  await p.route(URL,async r=>{ const res=await r.fetch(); const html=(await res.text()).replace('</head>\n<body>','</head>\n<body><script>window.__early={t:document.documentElement.dataset.theme||"",m:document.querySelector(\'meta[name="theme-color"]\').content,st:!!window.__tapuState}</script>'); await r.fulfill({response:res,body:html}); });
  await p.reload();
  for(let k=0;k<60&&!(await p.evaluate(()=>!!window.__tapuState&&document.documentElement.dataset.theme==='dark').catch(()=>false));k++){ await p.clock.runFor(300).catch(()=>{}); await p.waitForTimeout(250); }
  await p.clock.runFor(1500); for(let k=0;k<5&&await has(p,'#modal .card');k++){ await p.click('#modal .card [data-a]',{force:true}); await p.clock.runFor(400); } // açılış kartları (çevrimdışı kazanç vb.)
  ok(await p.evaluate(()=>document.documentElement.dataset.theme)==='dark','yeniden açılışta koyu tema uygulandı');
  { const e=await p.evaluate(()=>window.__early||null); await p.unroute(URL);
    ok(e&&e.t==='dark'&&e.m==='#111815'&&e.st===false,'yanıp sönme yok: oyun açılmadan, ilk boyamadan önce data-theme=dark ve theme-color koyu ('+JSON.stringify(e)+')'); }
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

  console.log('14) Rıfkı Abi yüzü: ifade, göz kırpma/nefes, boşta durma, hareketi azalt');
  { const face=p=>p.evaluate(()=>{ const f=document.querySelector('#rifki .rk-face'); if(!f||document.querySelector('#rifki').hidden) return null;
      const an=f.getAnimations({subtree:true}); return {svg:!!f.querySelector('svg[viewBox="0 0 120 140"]'),mood:f.dataset.mood,svgMood:f.querySelector('svg')?.dataset.mood,
        n:an.length,inf:an.filter(a=>a.effect.getTiming().iterations===Infinity).map(a=>a.playState),props:[...new Set(an.flatMap(a=>a.effect.getKeyframes().flatMap(k=>Object.keys(k).filter(x=>!['offset','easing','composite','computedOffset'].includes(x)))))]}; });
    const show=(p,id)=>p.evaluate(id=>{ document.querySelector('#toast').classList.remove('on'); window.__tapuTest.showTip({id,text:'Deneme ipucu efendim.'}); },id);
    p=await open(b);
    const want={full:'warn',goal:'think',save2x:'think',task:'party',ozel:'wow',ob:'wow',iy:'happy'}, got={};
    for(const id in want){ await show(p,id); const f=await face(p); got[id]=f&&f.svg&&f.mood===f.svgMood?f.mood:'yok'; }
    ok(Object.keys(want).every(k=>got[k]===want[k]),'ipucuna göre ifade: '+JSON.stringify(got));
    await show(p,'goal'); await p.waitForTimeout(60); const f1=await face(p);
    ok(f1&&f1.inf.length===2&&f1.inf.every(s=>s==='running')&&f1.n>=3&&f1.props.every(x=>x==='transform'||x==='opacity'),'açılışta zıplama + sonsuz göz kırpma/nefes (yalnız transform/opacity): '+JSON.stringify(f1&&{n:f1.n,inf:f1.inf,props:f1.props}));
    await show(p,'task'); ok((await face(p)).inf.length===1,'Kutlama (kapalı, gülen gözler): göz kırpma yok, yalnız nefes');
    await p.evaluate(()=>window.__tapuTest.showTip({id:'goal',text:'x'})); await p.clock.runFor(31000); // dokunulmadan: boşta
    await p.evaluate(()=>window.__tapuTest.showTip({id:'goal',text:'x'})); await p.waitForTimeout(600);
    const f2=await face(p), idle=await p.evaluate(()=>document.body.classList.contains('idle'));
    ok(idle&&f2&&f2.inf.length===2&&f2.inf.every(s=>s==='paused')&&await p.evaluate(()=>getComputedStyle(document.querySelector('#rifki')).opacity==='1'),'boştayken göz kırpma/nefes duruyor, balon yine görünür: '+JSON.stringify(f2&&f2.inf));
    await p.evaluate(()=>document.querySelector('#rifki .rk-x').click());
    ok(await p.evaluate(()=>!document.querySelector('#rifki .rk-face')||document.querySelector('#rifki').hidden),'kapanınca yüz görünmüyor (animasyon çalışmıyor)');
    await p.emulateMedia({reducedMotion:'reduce'}); await p.clock.runFor(300); await p.waitForTimeout(250); // matchMedia değişim olayı bir karede gelir
    await show(p,'full'); await p.waitForTimeout(60); const f3=await face(p);
    ok(f3&&f3.mood==='warn'&&f3.n===0,'hareketi azalt: yüzde hiç animasyon yok (getAnimations boş), ifade yine değişiyor ('+(f3&&f3.n)+')');
    ok(!p.errs.length,'konsol temiz'+(p.errs.length?' ['+p.errs.slice(0,2).join('|')+']':''));
    await p.context().close();
  }
  console.log('15) Rıfkı Abi tapu alınınca ve semt bitince kutlar');
  { const rk=p=>p.evaluate(()=>{ const r=document.querySelector('#rifki'); return r.hidden?null:{mood:r.querySelector('.rk-face')?.dataset.mood,txt:r.querySelector('.rk-bub span')?.textContent||''}; });
    p=await open(b);
    await p.evaluate(()=>{ const S=window.__tapuState(); S.rifki=true; S.cash=1e15; S.lien={}; S.lienT={}; S.collectMode='tap'; });
    await p.click('#mapBtn',{force:true}); await p.clock.runFor(400); await p.waitForTimeout(450); // panel kayarak açılır (gerçek zaman)
    const BUY='#sheet [data-a="buy"]:not([disabled])';
    for(let r=0;r<3;r++){ const btn=await p.$(BUY); if(!btn) break; try{ await btn.evaluate(e=>e.scrollIntoView({block:'center'})); await btn.click({force:true}); break; }catch(e){ if(!/not attached|detached/i.test(String(e))) throw e; } }
    await p.clock.runFor(800);
    const during=await rk(p), cardOpen=await has(p,'#modal .card');
    ok(cardOpen&&!during,'tapu alınınca: semt kartı açıkken Rıfkı konuşmuyor');
    for(let k=0;k<5&&await has(p,'#modal .card');k++){ await p.click('#modal .card [data-a]',{force:true}); await p.clock.runFor(400); }
    await p.clock.runFor(1200); const r1=await rk(p);
    ok(r1&&r1.mood==='party'&&/tapusu sizin/.test(r1.txt),'kart kapanınca Rıfkı tebrik ediyor (kutlama yüzü): '+JSON.stringify(r1));
    await p.evaluate(()=>document.querySelector('#rifki .rk-x').click());
    await p.evaluate(()=>{ const S=window.__tapuState(); const T=['ev','kafe','dukkan','ofis'];
      S.d[S.cur]=Array.from({length:20},(_,i)=>i===19?{t:'ev',lvl:0,buf:0,until:Date.now()+600,dur:600,up:false}:{t:T[i%4],lvl:1,buf:0,until:0,dur:1,up:false}); });
    await p.clock.runFor(2500); const r2=await rk(p);
    ok(r2&&r2.mood==='party'&&/tamam!/.test(r2.txt)&&/20 arsa/.test(r2.txt),'son arsa dolunca Rıfkı semti kutluyor: '+JSON.stringify(r2));
    ok(!p.errs.length,'konsol temiz'+(p.errs.length?' ['+p.errs.slice(0,2).join('|')+']':''));
    await p.context().close();
  }
  console.log('16) Kiracılar');
  await kiraciBolum(b);
  console.log('17) Büyük projeler');
  await projeBolum(b);
  console.log('18) Rakip emlakçı ve ihale');
  await ihaleBolum(b);
  await b.close();
  const pass=results.filter(r=>r.pass).length;
  console.log(`\nSONUÇ: ${pass}/${results.length} geçti`);
  process.exit(pass===results.length?0:1);
})().catch(e=>{ console.error(e); process.exit(1); });
