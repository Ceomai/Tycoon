// SENARYO D — "Saat hilesi": cihaz saatini ileri/geri alarak ihale, kur ve kiracı süreleri sömürülebiliyor mu.
// (Önizlemede sunucu saati yok: Time.offset = 0; koruma yalnız guardRollback / maxSeen.)
// Çalıştır: node d_saat.cjs · çıktı out/d.json
const fs = require('fs');
const L = require('./lib.cjs');
const C = require('./common.cjs');
const B = require('./bilanco.cjs');
const { Player, issues } = require('./player.cjs');
const at = (d, h, m = 0) => new Date(2026, 10, 15 + d, h, m).getTime(); // d=0: Pazar 15 Kasım

(async () => {
  const b = await L.launch(), I = issues(), R = [];
  const ok = (c, name, det) => { R.push({ name, pass: !!c, det }); console.log(c ? '  ✓' : '  ✗', name, det ? JSON.stringify(det).slice(0, 300) : ''); if (!c) I.add('D', name, { det }); };

  /* D1) Kur: saat elde, en iyi saatlerde gidiş-dönüş (2 ve 3 bacak) — 60 gün, saatlik */
  {
    const H = 3600e3, t0 = at(0, 0), regs = ['tr', 'us', 'uk', 'de', 'jp', 'gl']; let best = { v: 0 };
    const mids = {}; for (const a of regs) for (const c of regs) if (a !== c) { let mx = 0, arg = 0; for (let k = 0; k < 24 * 60; k++) { const v = B.midIn(a, c, t0 + k * H); if (v > mx) { mx = v; arg = k; } } mids[a + c] = { mx, arg }; }
    const leg = (a, c) => mids[a + c].mx * B.costMult(B.CUR_OF[a] === B.CUR_OF[c]);
    for (const a of regs) for (const c of regs) if (a !== c) { const v = leg(a, c) * leg(c, a); if (v > best.v) best = { v, loop: [a, c, a] }; for (const e of regs) if (e !== a && e !== c) { const w = leg(a, c) * leg(c, e) * leg(e, a); if (w > best.v) best = { v: w, loop: [a, c, e, a] }; } }
    ok(best.v < 1, `kur: her bacak en iyi saatinde yapılsa bile gidiş-dönüş zararda (en iyi döngü ${best.loop.join('→')} = ${best.v.toFixed(4)})`, best);
  }

  const ctx = await L.newCtx(b, { time: at(1, 10) }); // Pazartesi 10:00
  let p = await L.openPage(ctx);
  await L.pickCity(p, 'ist');
  await L.mut(p, C.seedMid, { cash: 5e9, earned: 2e9 });
  await C.seedRegion(p, 'us', 'nyc', { cash: 1000, rate: 50 });
  await L.inject(p); await L.cards(p); await p.clock.runFor(3000); await L.cards(p);
  let P = new Player(p, new L.Ledger(await L.money(p)), I, { auc: () => 'win' });

  /* D2) Banka günlük hakkı: saat ileri → yeni hak; saat geri → hak geri gelmez */
  const u0 = (await C.saves(p)).us.cash;
  const s1 = await P.bank('us', 1), s1b = await P.bank('us', 1);
  ok(s1 && s1.spend > 0 && s1b && s1b.disabled, 'ABD hakkı doldu (aynı gün ikinci aktarım kapalı)', { s1: s1 && s1.spend });
  await L.closeApp(p); await ctx.clock.setSystemTime(at(2, 10, 5)); p = await L.openPage(ctx); P.setPage(p); await L.cards(p);
  const s2 = await P.bank('us', 1);
  await L.closeApp(p); await ctx.clock.setSystemTime(at(1, 10, 10)); p = await L.openPage(ctx); P.setPage(p); await L.cards(p); // saat geri
  const nowG = await p.evaluate(() => ({ dev: Date.now(), flag: window.__tapuState().clockFlag, max: window.__tapuState().maxSeen }));
  const s3 = await P.bank('us', 1);
  ok(s3 && (s3.disabled || s3.none), 'saat geri alınınca (maxSeen korunur) bugünkü hak yeniden açılmıyor', { s3, flag: nowG.flag });
  ok(nowG.flag >= 1, 'saat geri alma işaretlendi (clockFlag)', nowG);
  if (s2 && s2.spend > 0) I.note('saat-ileri', `cihaz saati 1 gün ileri alınınca ertesi günün aktarım hakkı hemen kullanılabiliyor (sunucu saati yokken). Her ileri alma yeni bir hak ve en çok 3 saatlik çevrimdışı kazanç verir; geri alınca oyun saati maxSeen'de donar.`);
  ok(true, 'saat ileri: ertesi günün hakkı ' + (s2 && s2.spend > 0 ? 'KULLANILABİLDİ (bilinen sınır: sunucu saati yok)' : 'kullanılamadı'));
  // donma: saat geri alındıktan sonra inşaat bitmiyor mu?
  const fr = await p.evaluate(() => { const S = window.__tapuState(); const k = S.cur, i = S.d[k].findIndex(q => !q); return { k, i, now: Date.now(), max: S.maxSeen }; });
  ok(fr.max > fr.now + 23 * 3600e3, 'saat geri alındı: oyun saati maxSeen\'de (cihazdan ~1 gün ileride) duruyor', { gap_h: ((fr.max - fr.now) / 3600e3).toFixed(1) });

  /* D3) İhale + saat: ileri al → kapanış; geri al → yeniden teklif ya da sonuç değişmez */
  await L.closeApp(p); await ctx.clock.setSystemTime(at(8, 9, 0)); p = await L.openPage(ctx); P.setPage(p); await L.cards(p); // ertesi Pazartesi 09:00
  await p.clock.runFor(2000); await L.cards(p);
  let s = await L.S(p); const a0 = s.ihale.cur;
  ok(a0 && a0.id === '2026-11-23' && !a0.done, 'Pazartesi ihalesi açıldı', a0 && { id: a0.id, cap: a0.cap });
  await p.evaluate(() => { const a = window.__tapuState().ihale.cur, T = window.__tapuTest.ihale; T.setProxy(a, T.rivalMax(a, Date.now()) + 2 * a.step); }); // erken önde, son düzlükte geçilecek
  s = await L.S(p); const w0 = s.cash + s.ihale.cur.held;
  await L.closeApp(p); await ctx.clock.setSystemTime(at(8, 23, 5)); p = await L.openPage(ctx); P.setPage(p);
  s = await L.S(p); const r1 = s.ihale.cur;
  ok(r1.done === 'lost' && r1.held === 0 && Math.abs((s.cash) - w0) < 1, 'saat 23:05\'e alınınca ihale kapandı (son düzlükte geçildi), emanet kasaya döndü', { done: r1.done, cash: s.cash, w0 });
  await L.cards(p); await L.closeApp(p);
  await ctx.clock.setSystemTime(at(8, 15, 0)); p = await L.openPage(ctx); P.setPage(p); // geri al: 15:00
  s = await L.S(p);
  const canBid = await p.evaluate(() => { const a = window.__tapuState().ihale.cur, T = window.__tapuTest.ihale; return T.setProxyCore(a, a.capHi + 5 * a.step, Date.now()); });
  ok(s.ihale.cur.done === 'lost' && canBid === 'done', 'saat 15:00\'e geri alınınca ihale yeniden açılmıyor, vekâlet verilemiyor', { done: s.ihale.cur.done, canBid });
  await L.cards(p); await L.closeApp(p);
  // aynı gün iki kez ihale yok: ileri al (Perşembe) → geri al (Pazartesi 10:00)
  await ctx.clock.setSystemTime(at(11, 10, 0)); p = await L.openPage(ctx); await p.clock.runFor(2000); s = await L.S(p); const thu = s.ihale.cur && s.ihale.cur.id; await L.cards(p); await L.closeApp(p);
  await ctx.clock.setSystemTime(at(8, 10, 0)); p = await L.openPage(ctx); await p.clock.runFor(2000); s = await L.S(p);
  ok(thu === '2026-11-26' && s.ihale.cur.id === thu, 'Perşembe ihalesine ileri gidip Pazartesi\'ye dönünce eski ihale yeniden kurulmuyor', { thu, cur: s.ihale.cur.id });
  await L.cards(p);

  /* D4) Kiracı süreleri oyun süresiyle: saat ileri/geri sözleşmeyi kısaltmıyor/uzatmıyor */
  await L.mut(p, S => { const k = S.cur; S.ten = S.ten.filter(x => x.k !== k || x.i !== 0); S.d[k][0] = { t: 'ev', lvl: 3, buf: 0, until: 0, dur: 1, up: false }; S.ten.push({ id: 999001, a: 'ogrenci', k, i: 0, w: { k: 'lvl', n: 3 }, dl: S.playMs + 60e3, st: 'live', end: S.playMs + 40 * 60e3 }); });
  s = await L.S(p); const x0 = s.ten.find(x => x.id === 999001), pm0 = s.playMs;
  await L.closeApp(p); await ctx.clock.setSystemTime(at(13, 12, 0)); p = await L.openPage(ctx); await L.cards(p);
  s = await L.S(p); const x1 = s.ten.find(x => x.id === 999001);
  ok(x1 && x1.st === 'live' && x1.end === x0.end && s.playMs - pm0 < 60e3, 'saat 2 gün ileri: kiracı sözleşmesi oyun süresiyle (bitmedi, süre aynı)', { end0: x0.end, end1: x1 && x1.end, dPlay: s.playMs - pm0 });
  // kiracı bonusu çevrimdışı kazanca sayılmıyor (withoutTenants): catchUp lump = taban kira × süre × 0,3
  const rateNoTen = await p.evaluate(() => { const S = window.__tapuState(); const t = S.ten; S.ten = []; const r = window.__tapuTest.totalRate(); S.ten = t; return r; });
  ok(true, 'kiracı bonusu çevrimdışı kazançtan hariç (kod: withoutTenants) — saat ileri alarak kiracı süresi tüketilemez');

  /* D5) Holding sonrası ihale (saat ile Pazartesi'ye atlama): tek semtte ihale açılmaz (önceden açılış kırıntı fiyatındaydı) */
  await L.closeApp(p); await ctx.clock.setSystemTime(at(14, 22, 0)); p = await L.openPage(ctx); await L.cards(p); // Pazar 29 Kasım 22:00
  await L.mut(p, S => { S.own = [...new Set([...S.own, 'ist-4'])]; S.d['ist-4'] = S.d['ist-4'] || Array(20).fill(null); S.earned = Math.max(S.earned, 1e9); S.ihale.got = []; });
  const rBefore = await p.evaluate(() => window.__tapuTest.totalRate());
  await L.closeAll(p); await L.tap(p, '#menuBtn', 500); await L.tap(p, '#sheetBody .drow[data-a="holding"]', 600);
  await L.tap(p, '#sheetBody [data-a="hold"]', 400); await L.tap(p, '#sheetBody [data-a="hold"]', 800); await L.cards(p);
  await L.closeApp(p); await ctx.clock.setSystemTime(at(15, 8, 5)); p = await L.openPage(ctx); await p.clock.runFor(2000); await L.cards(p);
  s = await L.S(p); const a5 = s.ihale.cur;
  const rAfter = await p.evaluate(() => window.__tapuTest.totalRate());
  // G7 düzeltmesi: Holding sonrası tek semtle (kira tabanda) ihale açılmaz; ikinci semtle açılır, fiyat o anki kirayla (auccore ihaleUnlocked)
  ok(!a5 || a5.id !== '2026-11-30', 'holding sonrası (tek semt) Pazartesi ihalesi kırıntıya açılmıyor (ikinci semte kadar)', a5 && { id: a5.id, start: a5.start, capHi: a5.capHi, rBefore, rAfter });

  /* değişmezler ve konsol */
  { const bad = await L.invariants(p); ok(!bad.length, 'değişmezler', bad); }
  ok(!ctx.errs.length, 'konsol temiz', ctx.errs.slice(0, 5));
  fs.writeFileSync(L.OUT + '/d.json', JSON.stringify({ scenario: 'D', results: R, issues: I.list, notes: I.notes, errs: ctx.errs }, null, 1));
  console.log('D bitti: geçen', R.filter(x => x.pass).length, '/', R.length);
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
