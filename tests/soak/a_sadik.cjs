// SENARYO A — "Sadık oyuncu 3 hafta": Türkiye (İstanbul), orta oyundan başlar, 21 oyun günü, günde 1–2 oturum.
// Her oturum: kapanmış uygulamayı açar (çevrimdışı süre), kartlar, TOPLA, inşaat/kat, kiracı isteği + anahtar, proje + 2. etap,
// semt alımı, ihale (kazan / kaybet / son düzlükte geçil), köşe başı; oturum sonunda sayfa kapanır, saat ileri alınır.
// Her gün sonunda: yeniden yükleme karşılaştırması, değişmezler, kasa defteri (%0,1), konsol, lig sayacı.
// Çalıştır: node a_sadik.cjs [gün=21]  · çıktı out/a.json
const fs = require('fs');
const L = require('./lib.cjs');
const C = require('./common.cjs');
const { Player, issues } = require('./player.cjs');

const DAYS = +(process.argv[2] || 21);
const D0 = new Date(2026, 10, 16); // Pazartesi
const at = (d, h, m = 0) => new Date(D0.getFullYear(), D0.getMonth(), D0.getDate() + d, h, m).getTime();
// Oturum planı: [saat, dakika, süre dk]. Pazartesi/Perşembe ihale günleri: sabah teklif, akşam son düzlükte göz atma.
function sessions(d) {
  const wd = new Date(at(d, 12)).getDay(), r = (d * 7919) % 13;
  if (wd === 1 || wd === 4) return [[8, 40 + (r % 15), 14], [21, 20 + r, 10]];
  if (d % 3 === 2) return [[13, 10 + r, 18]];               // tek oturum
  return [[8 + (r % 3), 15 + r, 12], [19 + (r % 3), 5 + r, 12]];
}
// İhale stratejisi: kazan / son düzlükte geçil / en düşükle kaybet (ihale sırasına göre)
const plan = process.env.A_PLAN ? process.env.A_PLAN.split(',') : ['win', 'pass', 'win', 'win', 'lose', 'win', 'pass'];
let aucN = 0; const aucMode = new Map();
const auc = ih => { if (!aucMode.has(ih.id)) aucMode.set(ih.id, plan[aucN++ % plan.length]); return aucMode.get(ih.id); };

(async () => {
  const b = await L.launch(), I = issues(), daysOut = [];
  const ctx = await L.newCtx(b, { time: at(0, 8, 30) });
  let p = await L.openPage(ctx);
  await L.pickCity(p, 'ist');
  await L.mut(p, C.seedMid, {});
  await L.inject(p); await L.cards(p);
  let m = await L.money(p);
  const Lg = new L.Ledger(m, 'A');
  const P = new Player(p, Lg, I, { auc });
  let last = await C.snapKey(p);
  await L.closeApp(p);

  for (let d = 0; d < DAYS; d++) {
    const ss = sessions(d), mDay0 = m, errs0 = ctx.errs.length;
    const dayRec = { day: d, date: new Date(at(d, 12)).toDateString(), sessions: ss.length };
    for (let si = 0; si < ss.length; si++) {
      const [h, mi, len] = ss[si];
      await ctx.clock.setSystemTime(at(d, h, mi));
      p = await L.openPage(ctx); P.setPage(p);
      // kapanış → açılış: kayıt aynı mı (saat ilerledi; kasa/kiracı/proje/ihale/banka değişmemeli)
      const real = C.offlineFilter(C.diffKeys(last, await C.snapKey(p)));
      for (const x of real) I.add('kayıt', `gün ${d} oturum ${si}: kapanıştan sonra açılınca "${x[0]}" farklı`, { a: String(x[1]).slice(0, 300), b: String(x[2]).slice(0, 300) });
      for (let t = 0; t < len; t++) {
        await P.turn({ builds: 2 });
        await p.clock.runFor(60e3);
        if (t % 5 === 4) { const bad = await L.invariants(p); for (const x of bad) I.add('değişmez', `gün ${d} dk ${t}: ${x}`); }
      }
      if (d === 9 && si === 0) { // bir kez: Almanya'ya (başlanmamış) aktarım — emanet olarak bekler
        const r = await P.bank('de', 0.1); dayRec.bank = r && { spend: r.spend, card: (r.card || '').replace(/\n/g, ' ').slice(0, 120) };
      }
      await P.handleCards(); await L.closeAll(p);
      if (si === ss.length - 1) { // gün sonu denetimleri
        const df2 = await C.reloadCheck(p);
        for (const x of df2) I.add('kayıt', `gün ${d}: yeniden yüklemede "${x[0]}" değişti`, { a: String(x[1]).slice(0, 300), b: String(x[2]).slice(0, 300) });
        await P.handleCards();
        const bad = await L.invariants(p); for (const x of bad) I.add('değişmez', `gün ${d} sonu: ${x}`);
      }
      m = await L.money(p); const c = Lg.check(m);
      if (c.rel > 1e-3) I.add('defter', `gün ${d} oturum ${si}: kasa+emanet ${Math.round(c.got)}, beklenen ${Math.round(c.exp)} (fark ${Math.round(c.diff)}, %${(c.rel * 100).toFixed(3)})`, { log: Lg.log.slice(-15) });
      if (c.rel > 1e-3) Lg.reset(m); // tek hata sonraki günlere taşınmasın
      last = await C.snapKey(p);
      await L.closeApp(p);
    }
    if (!C.leagueOk(mDay0, m)) I.add('lig', `gün ${d}: lig sayacı kazançtan fazla arttı (${Math.round(m.wk - mDay0.wk)} > ${Math.round(m.earned - mDay0.earned)})`);
    const ce = ctx.errs.slice(errs0); for (const e of ce) I.add('konsol', `gün ${d}: ${e.slice(0, 200)}`);
    const st = await (async () => { const q = await L.openPage(ctx); const s = await L.S(q); const r = await q.evaluate(() => window.__tapuTest.totalRate()); await L.cards(q); last = await C.snapKey(q); await L.closeApp(q); return { s, r }; })();
    Object.assign(dayRec, { cash: Math.round(m.cash), held: Math.round(m.held), earned: Math.round(m.earned), rate: +st.r.toFixed(1), own: st.s.own.length, ten: st.s.ten.map(x => x.st).join(','), tdefOk: Object.values(st.s.tdef).reduce((a, x) => a + x.ok, 0), pj: Object.values(st.s.pj).flat().map(q => q.st).join(','), ih: { wins: st.s.ihale.wins, losses: st.s.ihale.losses, got: st.s.ihale.got.length, kose: st.s.ihale.kose.length, cur: st.s.ihale.cur && { id: st.s.ihale.cur.id, done: st.s.ihale.cur.done, my: st.s.ihale.cur.my } }, bankOut: st.s.bank.out.length, stats: { ...P.stats } });
    daysOut.push(dayRec);
    console.log('gün', d, JSON.stringify(dayRec));
  }
  const res = { scenario: 'A', days: daysOut, issues: I.list, ledgerTail: Lg.log.slice(-30), stats: P.stats };
  fs.writeFileSync(L.OUT + (process.env.A_OUT || '/a.json'), JSON.stringify(res, null, 1));
  console.log('SORUN', I.list.length);
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
