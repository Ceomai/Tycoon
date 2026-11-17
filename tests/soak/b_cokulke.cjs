// SENARYO B — "Çok ülkeli": TR'de ilerle → bankadan ABD (başlanmamış: emanet) ve Almanya'ya aktar → Ayarlar'dan ABD'ye geç
// (sayfa yenilenir) → emanet kasaya geçti mi → ABD'de oyna → ABD'den TR'ye havale → TR'ye dön → havale bir kez mi geldi.
// Eşzamanlılık: aynı bağlamda iki sekme (aynı anda gönder; bayat sekme üstüne yazar; açık sekmeye gelen havale).
// Global bölgesi; bilanço: tüm bölge kayıtlarından bağımsız hesapla karşılaştırma.
// Çalıştır: node b_cokulke.cjs  · çıktı out/b.json
const fs = require('fs');
const L = require('./lib.cjs');
const C = require('./common.cjs');
const B = require('./bilanco.cjs');
const { Player, issues } = require('./player.cjs');

const T0 = new Date(2026, 10, 17, 10, 0).getTime(); // Salı (ihale yok)
const KEY = r => (r === 'tr' ? 'tapu-save-v2' : 'tapu-save-v2-' + r);
const saves = p => p.evaluate(() => { const o = {}; for (const r of ['tr', 'us', 'uk', 'de', 'jp', 'gl']) { const v = localStorage.getItem(r === 'tr' ? 'tapu-save-v2' : 'tapu-save-v2-' + r); try { o[r] = v ? JSON.parse(JSON.parse(v).j) : null; } catch { o[r] = 'BOZUK'; } } return o; });
const region = p => p.evaluate(() => JSON.parse(localStorage.getItem('tapu-prefs')).region);

(async () => {
  const b = await L.launch(), I = issues(), R = [];
  const ok = (c, name, det) => { R.push({ name, pass: !!c, det }); console.log(c ? '  ✓' : '  ✗', name, det ? JSON.stringify(det).slice(0, 300) : ''); if (!c) I.add('B', name, { det }); };
  const ctx = await L.newCtx(b, { time: T0 });
  let p = await L.openPage(ctx);
  await L.pickCity(p, 'ist');
  await L.mut(p, C.seedMid, { cash: 2e6 });
  await L.inject(p); await L.cards(p);
  let Lg = new L.Ledger(await L.money(p)), P = new Player(p, Lg, I);
  for (let t = 0; t < 8; t++) { await P.turn({ builds: 1, buy: false }); await p.clock.runFor(60e3); }
  await P.handleCards(); await L.closeAll(p);

  /* 1) TR → ABD ve DE (başlanmamış): emanet */
  const tr0 = await L.S(p);
  const sUS = await P.bank('us', 1);
  const sDE = await P.bank('de', 1);
  const tr1 = await L.S(p);
  ok(sUS && sUS.spend > 0 && sDE && sDE.spend > 0, 'TR → ABD ve DE aktarımı yapıldı (en çok)', { us: sUS && sUS.spend, de: sDE && sDE.spend, cardUS: sUS && sUS.card.slice(0, 80) });
  ok(/EMANETE ALINDI|Emanete alındı/.test((sUS && sUS.card) || '') && /EMANETE ALINDI|Emanete alındı/.test((sDE && sDE.card) || ''), 'havale kartı "Emanete alındı" (başlanmamış bölge)');
  const oUS = tr1.bank.out.find(o => o.to === 'us'), oDE = tr1.bank.out.find(o => o.to === 'de');
  ok(oUS && oDE && !oUS.s && !oDE.s && tr1.bank.out.length === 2, 'TR kaydında iki emanet (yolda, onaysız)', tr1.bank.out);
  ok(Math.abs(oUS.a - Math.floor(sUS.spend * B.net('tr', 'us', oUS.at))) <= 1 && Math.abs(oDE.a - Math.floor(sDE.spend * B.net('tr', 'de', oDE.at))) <= 1, 'varacak tutar = gönderilen × orta kur × (1−makas)(1−komisyon)', { us: [oUS.a, sUS.spend], de: [oDE.a, sDE.spend] });
  ok(oUS.a <= 2500 + 1e-6 && oDE.a <= 2500 + 1e-6, 'başlanmamış bölgenin günlük hakkı (taban 2.500 iç birim) aşılmadı', { us: oUS.a, de: oDE.a });
  ok(tr1.earned === tr0.earned && tr1.week.earned === tr0.week.earned, 'aktarım kazanç ve lig sayacını değiştirmedi');
  // ikinci kez aynı gün: hak dolu
  const again = await P.bank('us', 1);
  ok(again && again.disabled, 'ABD için bugünkü hak doldu: düğme kapalı', again);

  /* bilanço (TR'de): bağımsız hesap */
  await bilanco(p, 'TR (iki emanet yolda)');

  /* 2) Ayarlar → ABD (yenilenir) → şehir seç → emanet kasada */
  const trSaved = (await saves(p)).tr;
  await setRegion(p, 'us');
  ok(await region(p) === 'us' && await L.H.vis(p, '#modal .cityopt[data-a="nyc"]'), 'Ayarlar → ABD: sayfa yenilendi, şehir seçimi açık');
  await L.clk(p, '#modal .cityopt[data-a="nyc"]'); await p.clock.runFor(1500);
  const toastUS = await p.evaluate(() => document.querySelector('#toast')?.textContent || '');
  await L.cards(p);
  let us = await L.S(p), all = await saves(p);
  ok(Math.abs(us.cash - (150 + oUS.a)) < 1e-6 && us.earned === 0, 'ABD: emanet başlangıç sermayesine eklendi (150 + emanet), kazanç sayılmadı', { cash: us.cash, exp: 150 + oUS.a, earned: us.earned, toast: toastUS });
  const trO = all.tr.bank.out.find(o => o.id === oUS.id);
  ok(trO && trO.s && trO.ep === us.bank.ep && us.bank.in.includes(oUS.id), 'gönderen (TR) kaydında havale teslim edildi olarak işaretlendi (s, ep)', trO);
  ok(all.tr.bank.out.some(o => o.id === oDE.id && !o.s), 'DE emaneti TR kaydında beklemeye devam ediyor');
  // yeniden yükle: emanet ikinci kez gelmesin
  await p.reload(); await L.boot(p); await L.cards(p);
  const us2 = await L.S(p);
  ok(Math.abs(us2.cash - us.cash) < 1e-6 && us2.bank.in.filter(x => x === oUS.id).length === 1, 'ABD yeniden açılınca emanet ikinci kez eklenmedi', { a: us.cash, b: us2.cash });

  /* 3) ABD'de oyna: banka açılana kadar (5.000 iç birim kazanç) */
  Lg = new L.Ledger(await L.money(p)); P = new Player(p, Lg, I, { sc: 1 / 43 });
  for (let t = 0; t < 80; t++) { await P.turn({ builds: 2, auction: false }); await p.clock.runFor(60e3); if (await p.evaluate(() => window.__tapuTest.bank.bankOpen())) break; }
  us = await L.S(p);
  ok(await p.evaluate(() => window.__tapuTest.bank.bankOpen()), 'ABD: banka açıldı (kazanç ' + Math.round(us.earned) + ')');
  { const c = Lg.check(await L.money(p)); ok(c.rel < 1e-3, 'ABD kasa defteri tutuyor', c); }
  // ABD ekranında fiyatlar $ ölçeğinde (₺ değil)
  const cashTxt = await p.evaluate(() => document.querySelector('#cash')?.textContent || '');
  ok(/\$/.test(cashTxt) && !/₺/.test(cashTxt), 'ABD kasası $ ile gösteriliyor: ' + cashTxt);

  /* 4) ABD → TR havale (TR başlanmış: doğrudan TR kaydına) */
  const trBefore = (await saves(p)).tr;
  const sTR = await P.bank('tr', 0.5);
  all = await saves(p); us = await L.S(p);
  const oTR = us.bank.out.find(o => o.to === 'tr');
  ok(sTR && sTR.spend > 0 && oTR && oTR.s && all.tr.bank.in.includes(oTR.id), 'ABD → TR: TR kaydına yazıldı, ABD kaydında onay bekliyor', { spend: sTR && sTR.spend, o: oTR });
  ok(oTR && Math.abs(all.tr.cash - (trBefore.cash + oTR.a)) < 1e-6, 'TR kaydının kasası tam havale kadar arttı', { before: trBefore.cash, after: all.tr.cash, a: oTR && oTR.a });
  await bilanco(p, 'ABD (TR havalesi teslim, DE emaneti yolda)');

  /* 5) TR'ye dön: havale bir kez (kart/çevrimdışı kazanç ayıklanır: kasa − kazanç) */
  await setRegion(p, 'tr');
  let tr = await L.S(p); all = await saves(p);
  const wme = s => s.cash - s.earned;
  ok(Math.abs(wme(tr) - (wme(trBefore) + oTR.a)) < Math.max(1, tr.cash * 1e-9) && tr.bank.in.filter(x => x === oTR.id).length === 1 && tr.bank.log.filter(l => l.id === oTR.id).length === 1, 'TR açılınca havale bir kez (kasa − kazanç = önceki + havale)', { got: wme(tr), exp: wme(trBefore) + oTR.a });
  ok(all.us.bank.out.some(o => o.id === oTR.id && o.s), 'ABD kaydında havale onay bekliyor (gönderen açılınca silinecek; tasarım gereği)');
  ok(tr.bank.out.some(o => o.id === oDE.id && !o.s), 'DE emaneti hâlâ bekliyor (TR kaydı)');
  await L.cards(p);
  await p.reload(); await L.boot(p); const tr2 = await L.S(p); await L.cards(p);
  ok(Math.abs(wme(tr2) - wme(await L.S(p)) ) < 1e9 && tr2.bank.in.filter(x => x === oTR.id).length === 1 && Math.abs(wme(tr2) - (wme(trBefore) + oTR.a)) < Math.max(1, tr2.cash * 1e-9), 'TR yeniden yüklenince havale yine bir kez', { got: wme(tr2), exp: wme(trBefore) + oTR.a });
  /* 6) Eşzamanlı iki sekme (aynı bağlam, ikisi de TR) */
  await L.closeApp(p);
  await ctx.clock.setSystemTime(T0 + 26 * 3600e3); // ertesi gün: haklar yenilendi
  // 6) Web'de oyun tek sekmede (src/tabs.ts): ikinci sekme "Oyun başka bir sekmede açık · Burada devam et" ekranında bekler,
  //    kayda yazmaz; devralınca ilk sekme durur. (Önceki sürümde iki sekme aynı kaydı ezip parayı çoğaltıyordu: H1/H2.)
  const net6 = B.net('tr', 'us', T0 + 26 * 3600e3);
  const waitOn = q => q.evaluate(() => !!document.querySelector('.tabwait') && typeof window.__tapuState === 'undefined');
  // 6a) ikinci sekme bekler; ilk sekmeden ABD'ye aktarım (DE emaneti beklerken): kart "kasasına geçti" (H4), para çoğalmaz
  {
    const pa = await L.openPage(ctx); await L.cards(pa);
    const pb = await L.openPage(ctx);
    ok(await waitOn(pb), 'ikinci sekme: "Oyun başka bir sekmede açık" ekranı, oyun açılmadı (H1/H2)');
    const s0 = await saves(pa);
    const PA = new Player(pa, new L.Ledger(await L.money(pa)), I);
    await L.closeAll(pa); await L.tap(pa, '#menuBtn', 500); await L.tap(pa, '#sheetBody .drow[data-a="banka"]', 600);
    for (let k = 0; k < 10 && !(await pa.$('#sheetBody [data-a="send"]')); k++) await pa.clock.runFor(300);
    await L.tap(pa, '#sheetBody [data-a="to"][data-r="us"]', 300); await L.tap(pa, '#sheetBody [data-a="pick"][data-v="0.1"]', 300);
    await L.clk(pa, '#sheetBody [data-a="send"]'); for (let k = 0; k < 10; k++) await pa.clock.runFor(200);
    const card = await pa.evaluate(() => document.querySelector('#modal').innerText.slice(0, 80));
    ok(!/EMANETE ALINDI|Emanete alındı/.test(card), 'başlanmış ABD\'ye havale kartı "kasasına geçti" diyor (DE emaneti beklerken de) (H4)', { card });
    await L.closeApp(pb); await L.closeApp(pa);
    const q = await L.openPage(ctx); await L.cards(q); const s1 = await saves(q); await L.closeApp(q);
    const sent = (s0.tr.cash - s0.tr.earned) - (s1.tr.cash - s1.tr.earned), got = (s1.us.cash - s1.us.earned) - (s0.us.cash - s0.us.earned);
    ok(sent > 0 && got <= sent * net6 * 1.001 + 2, 'ikinci sekme açıkken aktarım: ABD\'ye varan ≤ TR\'den çıkan × net (para çoğalmıyor)', { sent, got });
  }
  await ctx.clock.setSystemTime(T0 + 50 * 3600e3); // ertesi gün: ABD hakkı yenilendi
  // 6b) bayat sekme: B "Burada devam et" ile devralır ve gönderir; A (eski durum) artık kayda yazamaz
  {
    const pa = await L.openPage(ctx); await L.cards(pa);
    const pb = await L.openPage(ctx);
    const s0 = await saves(pa);
    await L.clk(pb, '.tabwait button'); for (let k = 0; k < 20; k++) await pb.clock.runFor(200); await L.boot(pb); await L.cards(pb);
    ok(await pa.evaluate(() => !!document.querySelector('.tabwait')) && await pb.evaluate(() => !!window.__tapuState), '"Burada devam et": ilk sekme durdu, ikinci sekme oyunu açtı');
    const PB = new Player(pb, new L.Ledger(await L.money(pb)), I);
    const r = await PB.bank('us', 0.5);
    await pa.clock.runFor(11e3); // A'nın periyodik kaydı (10 sn) — durduğu için yazmaz
    await L.closeApp(pb); await L.closeApp(pa);
    const q = await L.openPage(ctx); await L.cards(q); const s1 = await saves(q); await L.closeApp(q);
    const sent = (s0.tr.cash - s0.tr.earned) - (s1.tr.cash - s1.tr.earned), got = (s1.us.cash - s1.us.earned) - (s0.us.cash - s0.us.earned);
    ok(r && r.spend > 0 && got <= sent * net6 * 1.001 + 2, 'bayat sekme (aynı bölge, eski durum) havaleden sonra üstüne yazamıyor: para çoğalmıyor', { sent, got, spend: r && r.spend });
  }
  // 6c) ABD'den TR'ye havale (tek sekmede bölge değiştirerek): TR açılınca havale bir kez
  {
    const pc = await L.openPage(ctx); await L.cards(pc);
    const tr0 = (await saves(pc)).tr, trA0 = tr0.cash - tr0.earned;
    await pc.evaluate(() => { const o = JSON.parse(localStorage.getItem('tapu-prefs')); o.region = 'us'; localStorage.setItem('tapu-prefs', JSON.stringify(o)); });
    await pc.reload(); await L.boot(pc); await L.cards(pc);
    const PC = new Player(pc, new L.Ledger(await L.money(pc)), I, { sc: 1 / 43 });
    const r = await PC.bank('tr', 0.25);
    const oc = (await L.S(pc)).bank.out.find(o => o.to === 'tr');
    await pc.evaluate(() => { const o = JSON.parse(localStorage.getItem('tapu-prefs')); o.region = 'tr'; localStorage.setItem('tapu-prefs', JSON.stringify(o)); });
    await L.closeApp(pc);
    const q = await L.openPage(ctx); await L.cards(q); const trq = await L.S(q);
    const d = (trq.cash - trq.earned) - trA0; // kazanç dışı kasa farkı
    ok(oc && Math.abs(d - oc.a) < Math.max(2, oc.a * 1e-6), 'ABD → TR havalesi TR kasasında (bir kez)', { d, a: oc && oc.a, spend: r && r.spend });
    ok(oc && trq.bank.in.filter(x => x === oc.id).length === 1, 'kapat-aç sonrası TR kaydında havale kimliği bir kez', { in: trq.bank.in.length });
    p = q;
  }

  /* 7) Global bölgesi: emanetle başla, bilanço */
  P = new Player(p, new L.Ledger(await L.money(p)), I);
  const sGL = await P.bank('gl', 1);
  await setRegion(p, 'gl');
  const glOpts = await p.evaluate(() => [...document.querySelectorAll('#modal .cityopt')].map(b => b.dataset.a));
  ok(glOpts.join() === 'ist,nyc,lon,muc,tyo', 'Global şehirleri: ' + glOpts.join());
  await L.clk(p, '#modal .cityopt[data-a="tyo"]'); await p.clock.runFor(1500); await L.cards(p);
  const gl = await L.S(p); all = await saves(p);
  const oGL = all.tr.bank.out.find(o => o.to === 'gl');
  ok(sGL && sGL.spend > 0 && oGL && oGL.s && Math.abs(gl.cash - (150 + oGL.a)) < 1e-6, 'Global (Tokyo): TR emaneti başlangıç sermayesinde', { cash: gl.cash, a: oGL && oGL.a });
  ok(!all.tr.bank.out.some(o => o.to === 'tr'), 'Global ile Türkiye anahtarları karışmadı (TR kaydında kendine havale yok)');
  ok(JSON.stringify(Object.keys(all.tr.d)) !== JSON.stringify(Object.keys(gl.d)) || all.tr.d['ist-0'] !== gl.d['ist-0'], 'Global ve TR ayrı kayıt');
  await bilanco(p, 'Global (TR, ABD, Global başlanmış; DE emaneti yolda)');
  // DE'ye geç: emanet
  await setRegion(p, 'de'); await L.clk(p, '#modal .cityopt[data-a="muc"]'); await p.clock.runFor(1500); await L.cards(p);
  const de = await L.S(p); all = await saves(p);
  ok(Math.abs(de.cash - (150 + oDE.a)) < 1e-6 && all.tr.bank.out.find(o => o.id === oDE.id)?.s, 'DE: 1. gün bırakılan emanet (günler sonra) kasaya geçti', { cash: de.cash, a: oDE.a });
  await bilanco(p, 'DE (tüm bölgeler)');

  fs.writeFileSync(L.OUT + '/b.json', JSON.stringify({ scenario: 'B', results: R, issues: I.list, notes: I.notes, errs: ctx.errs }, null, 1));
  console.log('B bitti: geçen', R.filter(x => x.pass).length, '/', R.length, ' konsol', ctx.errs.length);
  await b.close();

  async function setRegion(q, r) {
    await L.closeAll(q); await L.tap(q, '#menuBtn', 500); await L.tap(q, '#sheetBody .drow[data-a="set"]', 600);
    await Promise.all([q.waitForEvent('load', { timeout: 15000 }).catch(() => {}), L.clk(q, `#sheetBody [data-a="region"][data-r="${r}"]`)]);
    await L.boot(q);
  }
  async function bilanco(q, label) {
    await L.closeAll(q); await L.tap(q, '#menuBtn', 500); await L.tap(q, '#sheetBody .drow[data-a="banka"]', 600);
    for (let k = 0; k < 10 && !(await q.$('#sheetBody [data-a="tab"][data-v="bil"]')); k++) await q.clock.runFor(300);
    await L.tap(q, '#sheetBody [data-a="tab"][data-v="bil"]', 400);
    for (let k = 0; k < 10 && !(await q.$('#sheetBody [data-a="cur"][data-v="TRY"]')); k++) await q.clock.runFor(300);
    await L.tap(q, '#sheetBody [data-a="cur"][data-v="TRY"]', 400);
    const shown = await q.evaluate(() => document.querySelector('#sheetBody .bk-big b')?.textContent || '');
    const regs = await q.evaluate(() => [...document.querySelectorAll('#sheetBody .bk-reg')].map(e => e.innerText.replace(/\n/g, ' ')));
    const sv = await saves(q), live = await L.S(q), cur = await region(q); sv[cur] = live;
    const tn = await q.evaluate(() => Date.now()), tot = B.total(sv, 'TRY', tn);
    const lo = L.parseMoney(shown), hi = L.parseMoney(shown, 1, true);
    const all = tot.sum + tot.pend; // başlanmamış bölgelere yolda bekleyen emanet de bilançoda (o bölgenin satırında)
    ok(all >= lo * 0.995 && all <= hi * 1.005, `bilanço ${label}: panel "${shown}" ≈ bağımsız hesap ₺${Math.round(all)} (emanet ₺${Math.round(tot.pend)} dahil)`, { rows: tot.rows });
    if (tot.pend > 0) ok(regs.some(x => /emanette/.test(x)), `bilanço ${label}: başlanmamış bölgedeki emanet satırda görünüyor`, { regs });
    await L.closeAll(q);
    return { shown, tot, regs };
  }
})().catch(e => { console.error(e); process.exit(1); });
