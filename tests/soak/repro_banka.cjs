// KÜÇÜLTÜLMÜŞ YENİDEN ÜRETİM (banka; soak H1/H2/H4) — düzeltmeden sonra denetim olarak çalışır:
// (1) DE emaneti beklerken başlanmış ABD'ye havale kartı "kasasına geçti" demeli (H4); (2) iki sekme: ikinci sekme oyunu açamaz
// (tek sekme kilidi, H2); (3) bayat sekme devralındıktan sonra TR kaydını ezemez (H1). node tests/soak/repro_banka.cjs
const L = require('./lib.cjs'), C = require('./common.cjs');
const saves = p => p.evaluate(() => { const o = {}; for (const r of ['tr', 'us', 'de']) { const v = localStorage.getItem(r === 'tr' ? 'tapu-save-v2' : 'tapu-save-v2-' + r); o[r] = v ? (x => x.j ? JSON.parse(x.j) : x)(JSON.parse(v)) : null; } return o; });
async function setup(b) {
  const ctx = await L.newCtx(b, { time: new Date(2026, 10, 17, 10, 0) });
  let p = await L.openPage(ctx); await L.pickCity(p, 'ist');
  await L.mut(p, C.seedMid, { cash: 5e6 });
  await L.inject(p); await L.cards(p);
  // ABD başlanmış kayıt (sağlamasız biçim kabul edilir)
  await p.evaluate(() => { const S = JSON.parse(JSON.stringify(window.__tapuState())); S.city = 'nyc'; S.own = ['nyc-0']; S.cur = 'nyc-0'; S.d = { 'nyc-0': S.d['ist-0'] }; S.cash = 1000; S.earned = 0; S.bank = { rate: 100, ep: 'usep', in: [], out: [], day: { k: '', got: 0 }, log: [], tip: '' }; S.ten = []; S.pj = {}; S.ihale = { cur: null, rm: {}, got: [], kose: [], kp: 0, intro: true, wins: 0, losses: 0 }; localStorage.setItem('tapu-save-v2-us', JSON.stringify(S)); });
  return { ctx, p };
}
async function send(p, to, pick) {
  await L.closeAll(p); await L.tap(p, '#menuBtn', 500); await L.tap(p, '#sheetBody .drow[data-a="banka"]', 600);
  for (let k = 0; k < 20 && !(await p.$(`#sheetBody [data-a="to"][data-r="${to}"]`)); k++) await p.clock.runFor(300);
  await L.tap(p, `#sheetBody [data-a="to"][data-r="${to}"]`, 300); await L.tap(p, `#sheetBody [data-a="pick"][data-v="${pick}"]`, 300);
}
(async () => {
  const b = await L.launch(); const res = [];
  const ok = (c, m, x) => { res.push(!!c); console.log(c ? '  ✓' : '  ✗', m, x ? JSON.stringify(x).slice(0, 300) : ''); };
  const card = p => p.evaluate(() => document.querySelector('#modal').innerText.replace(/\n+/g, ' | ').slice(0, 140));
  const waiting = p => p.evaluate(() => !!document.querySelector('.tabwait') && typeof window.__tapuState === 'undefined');
  { // (1) H4: DE emaneti beklerken başlanmış ABD'ye havale
    const { ctx, p } = await setup(b);
    await send(p, 'de', 1); await L.clk(p, '#sheetBody [data-a="send"]'); for (let k = 0; k < 10; k++) await p.clock.runFor(200);
    ok(/emanet/i.test(await card(p)), '(1) DE (başlanmamış): "Emanete alındı"');
    await L.cards(p, 1);
    const us0 = (await saves(p)).us.cash;
    await send(p, 'us', 0.1); await L.clk(p, '#sheetBody [data-a="send"]'); for (let k = 0; k < 10; k++) await p.clock.runFor(200);
    const s = await saves(p), c = await card(p);
    ok(!/emanete alındı/i.test(c) && s.us.cash > us0, '(1) H4: başlanmış ABD\'ye havale kartı "kasasına geçti" (DE emaneti beklerken)', { c, us0, us: s.us.cash });
    await ctx.close();
  }
  { // (2) H2: iki sekme aynı anda — ikinci sekme oyunu açamaz, aktarım tek sekmeden
    const { ctx, p } = await setup(b); await L.closeApp(p);
    const pa = await L.openPage(ctx), pb = await L.openPage(ctx); await L.cards(pa);
    ok(await waiting(pb), '(2) H2: ikinci sekme "Oyun başka bir sekmede açık" ekranında (oyun yok, Aktar yok)');
    const s0 = await saves(pa);
    await send(pa, 'us', 0.1); await L.clk(pa, '#sheetBody [data-a="send"]'); for (let k = 0; k < 10; k++) await pa.clock.runFor(200);
    await L.closeApp(pb); await L.closeApp(pa);
    const q = await L.openPage(ctx); await L.cards(q); const s2 = await saves(q);
    const sent = (s0.tr.cash - s0.tr.earned) - (s2.tr.cash - s2.tr.earned), got = s2.us.cash - s0.us.cash;
    ok(sent > 0 && got / sent < 1, '(2) çıkan > 0 ve varan/çıkan < 1 (para çoğalmadı)', { sent: Math.round(sent), got, oran: +(got / sent).toFixed(3) });
    await ctx.close();
  }
  { // (3) H1: bayat sekme — devralınan sekme kayda yazamaz
    const { ctx, p } = await setup(b); await L.closeApp(p);
    const pa = await L.openPage(ctx), pb = await L.openPage(ctx); await L.cards(pa);
    const s0 = await saves(pa);
    await L.clk(pb, '.tabwait button'); for (let k = 0; k < 20; k++) await pb.clock.runFor(200); await L.boot(pb); await L.cards(pb);
    ok(await pa.evaluate(() => !!document.querySelector('.tabwait')), '(3) "Burada devam et": eski sekme durdu');
    await send(pb, 'us', 0.5); await L.clk(pb, '#sheetBody [data-a="send"]'); for (let k = 0; k < 10; k++) await pb.clock.runFor(200);
    const s1 = await saves(pb);
    await pa.clock.runFor(11e3);
    const s2 = await saves(pa);
    ok(Math.abs(s2.tr.cash - s1.tr.cash) < 1, '(3) H1: eski sekmenin 10 sn kaydı TR kaydını ezmedi', { gönderdikten: Math.round(s1.tr.cash), sonra: Math.round(s2.tr.cash) });
    await L.closeApp(pb); await L.closeApp(pa);
    const q = await L.openPage(ctx); await L.cards(q); const s3 = await saves(q);
    const sent = (s0.tr.cash - s0.tr.earned) - (s3.tr.cash - s3.tr.earned), got = s3.us.cash - s0.us.cash;
    ok(sent > 0 && got <= sent, '(3) kapat-aç: varan ≤ çıkan (para çoğalmadı)', { sent: Math.round(sent), got });
    await ctx.close();
  }
  await b.close();
  const pass = res.filter(Boolean).length; console.log(`\nSONUÇ: ${pass}/${res.length} geçti`); process.exit(pass === res.length ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
