// SENARYO E — 320×640 ve 844×390: yeni panellerin hepsi (kiracı, defter, proje, ihale, köşe başı, banka: aktar/kur/bilanço)
// ve yeni kartlar (ihale tanıtımı, proje onayı, havale) aç-kapa: Esc ve tarayıcı geri tuşu; taşma, erişilebilir düğme, konsol.
// Çalıştır: node e_ekran.cjs · çıktı out/e.json, ekran görüntüleri out/e-*.png
const fs = require('fs');
const L = require('./lib.cjs');
const C = require('./common.cjs');
const { issues } = require('./player.cjs');

(async () => {
  const b = await L.launch(), I = issues(), R = [];
  const ok = (c, name, det) => { R.push({ name, pass: !!c, det }); console.log(c ? '  ✓' : '  ✗', name, det ? JSON.stringify(det).slice(0, 260) : ''); if (!c) I.add('E', name, { det }); };
  for (const vp of [{ width: 320, height: 640 }, { width: 844, height: 390 }]) {
    const tag = vp.width + '×' + vp.height;
    const ctx = await L.newCtx(b, { vp, time: new Date(2026, 10, 16, 10, 0).getTime() });
    const p = await L.openPage(ctx);
    await L.pickCity(p, 'ist');
    await L.mut(p, (S) => {
      const T = ['ev', 'kafe', 'dukkan', 'ofis'], k = S.cur;
      S.d[k] = Array.from({ length: 20 }, (_, i) => ({ t: T[i % 4], lvl: [0, 1, 4, 5].includes(i) ? 5 : 4, buf: 0, until: 0, dur: 1, up: false }));
      S.d['ist-1'] = Array.from({ length: 20 }, (_, i) => ({ t: T[(i + 1) % 4], lvl: 5, buf: 0, until: 0, dur: 1, up: false }));
      S.own = [k, 'ist-1']; S.cash = 5e10; S.earned = 1e9; S.seen = { ev: true, kafe: true, dukkan: true, ofis: true }; S.collects = 200; S.guideHint = true; S.cards = Object.keys(S.d);
      S.pj = { [k]: [{ a: 0, kd: 'site', st: 1, until: 0, dur: 1 }] }; S.pjIntro = true;
      S.ten = [{ id: 501, a: 'ogrenci', k, i: 2, w: { k: 'nb', t: 'kafe' }, dl: S.playMs + 9e5, st: 'live', end: S.playMs + 40 * 60e3, c: 'ist.ogrenci' }];
      S.tdc = { 'ist.ogrenci': { met: 1, ok: 1 } }; S.ihale.kp = 1; S.ihale.intro = false;
    });
    await C.seedRegion(p, 'us', 'nyc', { cash: 1000, rate: 50 });
    await L.inject(p); await L.cards(p); await p.clock.runFor(3000); await L.cards(p);
    const errs0 = ctx.errs.length;
    const st = () => p.evaluate(() => ({ sheet: document.querySelector('#sheet').classList.contains('on'), modal: !document.querySelector('#modal').hidden }));
    const measure = sel => p.evaluate(sel => {
      const root = document.querySelector(sel); if (!root) return null; const r = root.getBoundingClientRect();
      const over = [...root.querySelectorAll('*')].filter(e => { const b = e.getBoundingClientRect(); return b.width && (b.right > innerWidth + 0.5 || b.left < -0.5); }).map(e => e.tagName + '.' + (e.getAttribute('class') || '')).slice(0, 3);
      const btn = [...root.querySelectorAll('button')].filter(e => e.offsetParent).map(e => { const b = e.getBoundingClientRect(); return { h: b.height, w: b.width, t: e.textContent.trim().slice(0, 18) }; });
      const small = btn.filter(x => x.h < 32 && x.t).slice(0, 3);
      return { top: r.top, bottom: r.bottom, h: r.height, vw: innerWidth, vh: innerHeight, doc: document.documentElement.scrollWidth, over, small, scroll: root.scrollHeight > root.clientHeight + 1 };
    }, sel);
    const panels = [
      ['kiracı', () => p.evaluate(() => window.__tapuTest.openSheet({ k: 'kiraci', key: window.__tapuState().cur, i: 2 }))],
      ['kiracı defteri', () => p.evaluate(() => window.__tapuTest.openSheet({ k: 'defter' }))],
      ['proje', () => p.evaluate(() => window.__tapuTest.openSheet({ k: 'proj', key: window.__tapuState().cur, i: 0 }))],
      ['ihale', async () => { await L.clk(p, '#ihalePill'); await p.clock.runFor(500); if ((await st()).modal) { await L.clk(p, '#modal [data-a="go"]'); } }],
      ['köşe başı', () => p.evaluate(() => window.__tapuTest.openSheet({ k: 'kose' }))],
      ['banka · aktar', async () => { await L.tap(p, '#menuBtn', 500); await L.tap(p, '#sheetBody .drow[data-a="banka"]', 600); for (let k = 0; k < 10 && !(await p.$('#sheetBody [data-a="send"]')); k++) await p.clock.runFor(300); }],
      ['banka · kur', async () => { await L.tap(p, '#menuBtn', 500); await L.tap(p, '#sheetBody .drow[data-a="banka"]', 600); for (let k = 0; k < 10 && !(await p.$('#sheetBody [data-a="tab"]')); k++) await p.clock.runFor(300); await L.tap(p, '#sheetBody [data-a="tab"][data-v="fx"]', 400); }],
      ['banka · bilanço', async () => { await L.tap(p, '#menuBtn', 500); await L.tap(p, '#sheetBody .drow[data-a="banka"]', 600); for (let k = 0; k < 10 && !(await p.$('#sheetBody [data-a="tab"]')); k++) await p.clock.runFor(300); await L.tap(p, '#sheetBody [data-a="tab"][data-v="bil"]', 400); }],
    ];
    // ihale tanıtım kartı (ilk kez)
    await L.clk(p, '#ihalePill').catch(() => {}); await p.clock.runFor(500); await p.waitForTimeout(300);
    const intro = await measure('#modal .card');
    ok(intro && intro.bottom <= vp.height + 1 || (intro && intro.scroll), `${tag} ihale tanıtım kartı ekrana sığıyor/kayıyor`, intro);
    await p.screenshot({ path: L.OUT + `/e-${tag}-ihale-tanitim.png` });
    await p.keyboard.press('Escape'); await p.clock.runFor(400);
    ok(!(await st()).modal, `${tag} ihale tanıtım kartı Esc ile kapandı`);
    for (const [name, open] of panels) {
      for (const how of ['Esc', 'geri']) {
        await L.closeAll(p);
        await open(); await p.clock.runFor(500); await p.waitForTimeout(350);
        const s0 = await st(), m = await measure('#sheet');
        if (how === 'Esc') await p.screenshot({ path: L.OUT + `/e-${tag}-${name.replace(/[ ·]+/g, '-')}.png` });
        ok(s0.sheet && m && !m.over.length && m.doc <= vp.width + 1 && m.top >= -1, `${tag} ${name}: açıldı, yatay taşma yok`, m && { over: m.over, doc: m.doc, top: m.top });
        if (m && m.small.length) I.note('küçük-düğme', `${tag} ${name}: 32 px'ten alçak düğme(ler): ${JSON.stringify(m.small)}`);
        if (how === 'Esc') await p.keyboard.press('Escape'); else await p.goBack().catch(() => {});
        await p.clock.runFor(500); await p.waitForTimeout(250);
        if (how === 'geri' && /banka/.test(name)) { // menüden açılan iç içe panel: geri önce menüye döner (tasarım), ikinci geri kapatır
          const menu = await p.evaluate(() => !!document.querySelector('#sheet.on #sheetBody .drow[data-a="banka"]'));
          ok(menu, `${tag} ${name}: geri → menü paneline döndü (iç içe panel)`);
          await p.goBack().catch(() => {}); await p.clock.runFor(500); await p.waitForTimeout(250);
        }
        const s1 = await st();
        ok(!s1.sheet && !s1.modal, `${tag} ${name}: ${how} ile kapandı`, s1);
        const bad = await L.invariants(p); ok(!bad.length, `${tag} ${name} (${how}) sonrası değişmezler`, bad);
      }
    }
    // proje onay kartı (2. blok: ist-1 dolu Sv5) ve havale kartı
    await p.evaluate(() => window.__tapuTest.switchDistrict('ist-1')); await p.clock.runFor(500);
    await L.openTile(p, 5); await p.clock.runFor(300);
    if (await p.$('#sheetBody [data-a="pj"]')) {
      await L.tap(p, '#sheetBody [data-a="pj"]', 500);
      const fr = await p.$$('#grid .pjframe'); if (fr.length) { await fr[0].evaluate(e => e.click()); await p.clock.runFor(500); await p.waitForTimeout(300); }
      const card = await measure('#modal .card');
      const go = await p.evaluate(() => { const b = document.querySelector('#modal [data-a="go"]'); if (!b) return null; b.scrollIntoView({ block: 'nearest' }); const r = b.getBoundingClientRect(); return { bottom: r.bottom, h: r.height }; });
      ok(card && go && go.bottom <= vp.height + 0.5, `${tag} proje onay kartı: "Projeyi başlat" erişilebilir`, { card, go });
      await p.screenshot({ path: L.OUT + `/e-${tag}-proje-onay.png` });
      await p.goBack(); await p.clock.runFor(500);
      ok(!(await st()).modal, `${tag} proje onay kartı geri tuşuyla kapandı`);
      await p.keyboard.press('Escape'); await p.clock.runFor(300); // seçim modundan çık
      ok(!(await p.$('#grid .pjframe')), `${tag} proje seçim çerçeveleri kalktı`);
    } else ok(false, `${tag} proje teklifi bulunamadı (ist-1 arsa 5)`);
    await L.closeAll(p); await L.tap(p, '#menuBtn', 500); await L.tap(p, '#sheetBody .drow[data-a="banka"]', 600);
    for (let k = 0; k < 10 && !(await p.$('#sheetBody [data-a="to"][data-r="us"]')); k++) await p.clock.runFor(300);
    await L.tap(p, '#sheetBody [data-a="to"][data-r="us"]', 300); await L.tap(p, '#sheetBody [data-a="pick"][data-v="0.1"]', 300);
    await L.clk(p, '#sheetBody [data-a="send"]'); for (let k = 0; k < 10 && !(await st()).modal; k++) await p.clock.runFor(200);
    await p.waitForTimeout(300);
    const hv = await measure('#modal .card'); await p.screenshot({ path: L.OUT + `/e-${tag}-havale.png` });
    ok(hv && hv.bottom <= vp.height + 1 && !hv.over.length, `${tag} havale kartı sığıyor`, hv);
    await p.goBack(); await p.clock.runFor(600); await p.waitForTimeout(200);
    const after = await st();
    ok(!after.modal, `${tag} havale kartı geri tuşuyla kapandı ("Burada kal" → banka paneli geri açılır)`, after);
    await L.closeAll(p);
    const ce = ctx.errs.slice(errs0); ok(!ce.length, `${tag} konsol temiz`, ce.slice(0, 4));
    await ctx.close();
  }
  fs.writeFileSync(L.OUT + '/e.json', JSON.stringify({ scenario: 'E', results: R, issues: I.list, notes: I.notes }, null, 1));
  console.log('E bitti: geçen', R.filter(x => x.pass).length, '/', R.length);
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
