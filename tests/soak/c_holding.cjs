// SENARYO C — "Holding ve sıfırlama": ileri bir TR kaydında (5 semt, süren ihale + emanet, köşe başı, bankada yolda havaleler)
// Holding kur → sonra "Yeni oyun" (aynı bölge / başka bölge) ve "Hesabı sil". Banka giden/gelen havaleler, emanetler ve ihale
// emaneti ne oluyor; para kaybı ya da hayalet havale var mı.
// Çalıştır: node c_holding.cjs · çıktı out/c.json
const fs = require('fs');
const L = require('./lib.cjs');
const C = require('./common.cjs');
const { Player, issues } = require('./player.cjs');

const T0 = new Date(2026, 10, 16, 9, 30).getTime(); // Pazartesi: tarihi yapı ihalesi açık

(async () => {
  const b = await L.launch(), I = issues(), R = [];
  const ok = (c, name, det) => { R.push({ name, pass: !!c, det }); console.log(c ? '  ✓' : '  ✗', name, det ? JSON.stringify(det).slice(0, 300) : ''); if (!c) I.add('C', name, { det }); };
  const ctx = await L.newCtx(b, { time: T0 });
  let p = await L.openPage(ctx);
  await L.pickCity(p, 'ist');
  await L.mut(p, (S) => {
    const T = ['ev', 'kafe', 'dukkan', 'ofis'];
    for (let d = 0; d < 5; d++) S.d['ist-' + d] = Array.from({ length: 20 }, (_, i) => ({ t: T[(i + d) % 4], lvl: 3 + (i % 3), buf: 0, until: 0, dur: 1, up: false }));
    S.own = ['ist-0', 'ist-1', 'ist-2', 'ist-3', 'ist-4']; S.cur = 'ist-0'; S.cash = 3e9; S.earned = 4e8; S.seen = { ev: true, kafe: true, dukkan: true, ofis: true };
    S.collects = 300; S.guideHint = true; S.cards = Object.keys(S.d); S.ihale.intro = true; S.ihale.kose = ['ist-1:3']; S.ihale.got = []; S.pjIntro = true;
  });
  await C.seedRegion(p, 'us', 'nyc', { cash: 5000, rate: 50 });
  await L.inject(p); await L.cards(p);
  await p.clock.runFor(3000); await L.cards(p);
  let Lg = new L.Ledger(await L.money(p)), P = new Player(p, Lg, I, { auc: () => 'win' });

  // ihaleye vekâlet (emanet), bankada: DE (başlanmamış) emanet + ABD (başlanmış) havale
  let pl = await P.plan(); ok(pl.ih, 'Pazartesi ihalesi açık', pl.ih);
  if (pl.ih) await P.bid(pl.ih);
  const sDE = await P.bank('de', 1), sUS = await P.bank('us', 1);
  let tr = await L.S(p), all = await C.saves(p);
  const held0 = tr.ihale.cur && tr.ihale.cur.held, oDE = tr.bank.out.find(o => o.to === 'de'), oUS = tr.bank.out.find(o => o.to === 'us');
  ok(held0 > 0 && oDE && !oDE.s && oUS && oUS.s, 'hazırlık: ihale emaneti, DE emaneti (yolda), ABD havalesi (teslim, onay bekliyor)', { held0, oDE, oUS });
  const us0 = all.us.cash;

  /* C1) Holding */
  const sh0 = { shares: tr.shares, got: tr.ihale.got.slice(), kp: tr.ihale.kp, out: tr.bank.out.map(o => o.id), in: tr.bank.in.slice(), ep: tr.bank.ep, coll: tr.coll.length };
  await L.closeAll(p); await L.tap(p, '#menuBtn', 500); await L.tap(p, '#sheetBody .drow[data-a="holding"]', 600);
  const hb = await p.$('#sheetBody [data-a="hold"]'); ok(!!hb, 'Holding paneli: "Holding kur" düğmesi');
  if (hb) { await L.tap(p, '#sheetBody [data-a="hold"]', 400); await L.tap(p, '#sheetBody [data-a="hold"]', 800); }
  const hcard = await p.evaluate(() => document.querySelector('#modal').innerText.replace(/\n+/g, ' ').slice(0, 100));
  await L.cards(p);
  tr = await L.S(p); all = await C.saves(p);
  ok(/HOLDİNG KURULDU|HOLDING KURULDU|Holding kuruldu/.test(hcard) && tr.shares > sh0.shares && tr.cash === 150 && tr.earned === 0 && tr.own.length === 1, 'Holding kuruldu: hisse arttı, kasa 150, kazanç 0, tek semt', { card: hcard, shares: tr.shares, cash: tr.cash, earned: tr.earned, own: tr.own });
  ok(!(await p.evaluate(() => window.__tapuTest.bank.bankOpen())), 'not: holding sonrası banka yeniden kapandı (tek semt, kazanç 0) — yolda havalesi olan oyuncu için');
  ok(tr.ihale.cur && tr.ihale.cur.my === 0 && tr.ihale.cur.held === 0 && !tr.ihale.cur.done, 'süren ihaleye katılım düştü (vekâlet 0, emanet 0)', tr.ihale.cur && { my: tr.ihale.cur.my, held: tr.ihale.cur.held });
  if (held0 > 0) I.note('holding-ihale', `Holding kurulurken süren ihaledeki ₺${Math.round(held0)} emanet kasa ile birlikte sıfırlandı (tasarım: "kasa zaten sıfırlanır"); kartta/panelde bu söylenmiyor`);
  ok(JSON.stringify(tr.ihale.got) === JSON.stringify(sh0.got) && tr.ihale.kose.length === 0, 'ihale yapıları kaldı, köşe başı semtle gitti', { got: tr.ihale.got, kose: tr.ihale.kose });
  ok(JSON.stringify(tr.bank.out.map(o => o.id)) === JSON.stringify(sh0.out) && tr.bank.ep === sh0.ep, 'bankada yoldaki havaleler ve kayıt kimliği korundu (emanet kaybolmadı)', { out: tr.bank.out.length });
  ok(all.us.cash === us0, 'ABD kaydı holdingden etkilenmedi');
  // yeniden yükle: TR açılışında ABD havalesi onaylanıp silinmeli, ABD'ye ikinci kez eklenmemeli
  await p.reload(); await L.boot(p); await L.cards(p);
  tr = await L.S(p); all = await C.saves(p);
  ok(!tr.bank.out.some(o => o.id === oUS.id) && all.us.cash === us0 && all.us.bank.in.filter(x => x === oUS.id).length === 1, 'yeniden açılış: ABD havalesi onaylandı (silindi), ABD kasası değişmedi (hayalet yok)', { usCash: all.us.cash, us0 });
  ok(tr.bank.out.some(o => o.id === oDE.id && !o.s), 'DE emaneti holdingden sonra da bekliyor');
  // ihale kapanışı (holding sonrası katılım yok): kasa değişmemeli
  const c0 = tr.cash, e0 = tr.earned;
  await L.closeApp(p); await ctx.clock.setSystemTime(new Date(2026, 10, 16, 23, 30).getTime());
  p = await L.openPage(ctx); P.setPage(p);
  tr = await L.S(p);
  ok(tr.ihale.cur && tr.ihale.cur.done === 'lost' && (tr.cash - tr.earned) === (c0 - e0) && tr.ihale.losses === 0, 'ihale kapandı: katılım yok sayıldı, kasaya hayalet iade yok, kayıp sayılmadı', { done: tr.ihale.cur && tr.ihale.cur.done, cash: tr.cash, c0, losses: tr.ihale.losses });
  await L.cards(p);
  { const bad = await L.invariants(p); ok(!bad.length, 'değişmezler (holding sonrası)', bad); }

  /* C2) DE'ye geç: holding öncesi bırakılan emanet gelir */
  await C.setRegion(p, 'de'); await L.clk(p, '#modal .cityopt[data-a="muc"]'); await p.clock.runFor(1500); await L.cards(p);
  let de = await L.S(p); all = await C.saves(p);
  ok(Math.abs(de.cash - (150 + oDE.a)) < 1e-6 && all.tr.bank.out.find(o => o.id === oDE.id)?.s, 'DE: holding öncesi emanet başlangıç sermayesinde', { cash: de.cash, a: oDE.a });
  await C.setRegion(p, 'tr'); await L.cards(p);

  /* C3) "Yeni oyun" (aynı bölge: TR) — yoldaki emanet ve gelen havaleler */
  // ABD'den TR'ye havale (TR'ye yazılır, ABD kaydında onay bekler) + TR'den UK'ye (başlanmamış) emanet
  await L.mut(p, S => { S.cash = 5e6; S.earned = Math.max(S.earned, 6000); }); await L.inject(p); await L.cards(p);
  P = new Player(p, new L.Ledger(await L.money(p)), I);
  const sUK = await P.bank('uk', 1);
  tr = await L.S(p); const oUK = tr.bank.out.find(o => o.to === 'uk');
  ok(oUK && !oUK.s, 'TR → UK emaneti yolda', oUK);
  await C.setRegion(p, 'us'); await L.cards(p);
  await L.mut(p, S => { S.cash = Math.max(S.cash, 1e6); S.earned = Math.max(S.earned, 6000); }); await L.inject(p); await L.cards(p);
  const PU = new Player(p, new L.Ledger(await L.money(p)), I, { sc: L.PL.us });
  const sUT = await PU.bank('tr', 0.5);
  let us = await L.S(p); const oUT = us.bank.out.find(o => o.to === 'tr');
  ok(oUT && oUT.s, 'ABD → TR havalesi TR kaydına yazıldı (onay bekliyor)', oUT);
  await C.setRegion(p, 'tr'); await L.cards(p);
  const trPre = await L.S(p);
  // Ayarlar → Oyunu sıfırla (iki dokunuş) → dil → bölge (TR) → şehir
  await L.closeAll(p); await L.tap(p, '#menuBtn', 500); await L.tap(p, '#sheetBody .drow[data-a="set"]', 600);
  await L.tap(p, '#sheetBody [data-a="reset"]', 400); await L.tap(p, '#sheetBody [data-a="reset"]', 800);
  const flow = [];
  for (let k = 0; k < 4; k++) {
    const h = await p.evaluate(() => { const m = document.querySelector('#modal'); return m.hidden ? '' : (m.querySelector('h3') || {}).textContent; }); flow.push(h);
    if (/Dil/.test(h)) { await L.clk(p, '#modal .cityopt[data-a="tr"]'); await p.clock.runFor(600); }
    else if (/Nerede/.test(h)) { await L.clk(p, '#modal .cityopt[data-a="tr"]'); await p.clock.runFor(1200); }
    else if (/Hangi şehir/.test(h)) {
      const nav = p.waitForEvent('load', { timeout: 20000 }).catch(() => {});
      await L.clk(p, '#modal .cityopt[data-a="izm"]');
      for (let j = 0; j < 12; j++) { try { await p.clock.runFor(500); await p.evaluate(() => { const b = document.querySelector('#modal [data-back][data-a]') || document.querySelector('#modal .card [data-a]'); if (b) b.click(); }); } catch { break; } }
      await nav; break;
    }
    else break;
  }
  await L.boot(p); await L.cards(p);
  tr = await L.S(p); all = await C.saves(p);
  ok(flow.length >= 3 && tr.city === 'izm' && tr.cash === 150 && tr.bank.ep !== trPre.bank.ep, 'Yeni oyun (TR → İzmir): sıfır kayıt, yeni kayıt kimliği', { flow, city: tr.city, cash: tr.cash });
  ok(!tr.bank.in.length && tr.cash === 150, 'yeni TR oyununa eski havale (ABD → eski TR) hayalet olarak gelmedi', { in: tr.bank.in, cash: tr.cash });
  // ABD açılınca eski TR'ye giden havale yeniden eklenmemeli
  await C.setRegion(p, 'us'); await L.cards(p);
  us = await L.S(p); all = await C.saves(p);
  ok(!us.bank.out.some(o => o.id === oUT.id) && all.tr.cash === 150 && !all.tr.bank.in.includes(oUT.id), 'ABD açılışı: eski TR\'ye gitmiş havale düştü, yeni TR\'ye eklenmedi', { trCash: all.tr.cash });
  // UK emaneti: eski TR kaydıyla silindi mi?
  await C.setRegion(p, 'uk'); await L.clk(p, '#modal .cityopt[data-a="lon"]'); await p.clock.runFor(1500); await L.cards(p);
  const uk = await L.S(p);
  ok(Math.abs(uk.cash - (150 + oUK.a)) < 1e-6, '"Yeni oyun" öncesi TR\'den UK\'ye bırakılan emanet UK\'ye ulaştı', { ukCash: uk.cash, emanet: oUK.a, gönderilen: sUK && sUK.spend });

  /* C4) "Hesabı sil" (buluta bağlı değilken düğme gizli: aynı eylem satırı panelde yeniden oluşturulup dokunulur) */
  await L.closeAll(p); await L.tap(p, '#menuBtn', 500); await L.tap(p, '#sheetBody .drow[data-a="set"]', 600);
  const hasDel = !!(await p.$('#sheetBody [data-a="delete"]'));
  if (!hasDel) await p.evaluate(() => { const b = document.createElement('button'); b.className = 'linkbtn'; b.dataset.a = 'delete'; b.textContent = 'Hesabımı ve verilerimi sil'; document.querySelector('#sheetBody').appendChild(b); });
  await L.tap(p, '#sheetBody [data-a="delete"]', 300);
  if (!(await p.$('#sheetBody [data-a="delete"]'))) await p.evaluate(() => { const b = document.createElement('button'); b.dataset.a = 'delete'; document.querySelector('#sheetBody').appendChild(b); });
  await L.tap(p, '#sheetBody [data-a="delete"]', 1500);
  const keys = () => p.evaluate(() => Object.keys(localStorage).filter(k => /^tapu-save/.test(k)));
  const k1 = await keys(), pr = await p.evaluate(() => JSON.parse(localStorage.getItem('tapu-prefs') || '{}'));
  ok(!k1.length && !pr.region, 'Hesabı sil: tüm bölge kayıtları ve yedekleri silindi, bölge tercihi boş' + (hasDel ? '' : ' (düğme önizlemede gizli; eylem satırı enjekte edildi)'), { keys: k1, region: pr.region });
  await p.clock.runFor(15e3); // dil seçimi açıkken 10 sn'lik kayıt döngüsü eski durumu yazmamalı
  ok(!(await keys()).length, 'silme sonrası seçim ekranı beklerken eski durum yeniden yazılmadı', await keys());
  await p.goto('about:blank'); await p.goto(await L.url()); await L.boot(p);
  ok(!(await keys()).length && /Dil/.test(await p.evaluate(() => (document.querySelector('#modal h3') || {}).textContent || '')), 'kapat-aç: kayıt yok, ilk açılış (dil seçimi)', await keys());
  await L.clk(p, '#modal .cityopt[data-a="tr"]'); await p.clock.runFor(600); await L.clk(p, '#modal .cityopt[data-a="tr"]'); await p.clock.runFor(1200);
  await L.clk(p, '#modal .cityopt[data-a="ist"]'); await p.clock.runFor(1500); await L.cards(p);
  tr = await L.S(p);
  ok(tr.cash === 150 && !tr.bank.in.length && !tr.bank.out.length && tr.shares === 0, 'silme sonrası yeni oyun: kasa 150, banka boş, hisse 0', { cash: tr.cash, shares: tr.shares });
  ok(!ctx.errs.length, 'konsol temiz', ctx.errs.slice(0, 5));

  fs.writeFileSync(L.OUT + '/c.json', JSON.stringify({ scenario: 'C', results: R, issues: I.list, notes: I.notes, errs: ctx.errs }, null, 1));
  console.log('C bitti: geçen', R.filter(x => x.pass).length, '/', R.length);
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
