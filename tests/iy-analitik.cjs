// ANALİTİK HUNİSİ (uçtan uca): önizleme paketinde gönderilen olaylar window.__tapuTest.events() ile okunur (ağa bir şey gitmez).
// 1) İlk dakikalar: ilk bina → ms_first_build, ilk toplama → ms_first_collect; her biri bir kez, yeniden yüklemede tekrar etmez.
// 2) Kiracı: aday → kart → istek → anahtar olayları doğru parametrelerle; ilk kiracı kilometre taşı ve sistem kilidi bir kez;
//    banka paneli ve sekmesi. Hiçbir parametrede karakter adı / serbest metin yok.
// iyilestirme.cjs (npm run test:iy) içinden çağrılır; tek başına: vite build --mode preview && node tests/iy-analitik.cjs
const { serve, PREF_IF, vis } = require('./helpers.cjs');

const events = p => p.evaluate(() => JSON.parse(JSON.stringify(window.__tapuTest.events())));
const named = (ev, n) => ev.filter(e => e.name === n);
const cards = async p => { for (let k = 0; k < 6 && await vis(p, '#modal .card'); k++) { await p.click('#modal .card [data-a]', { force: true }).catch(() => {}); await p.clock.runFor(400); } };

async function analitikBolum(b, ok, URL) {
  const start = async (ctx) => {
    const p = await ctx.newPage(); p.errs = []; p.on('pageerror', e => p.errs.push(e.message));
    await p.clock.install(); await p.goto(URL); await p.clock.runFor(700);
    if (await vis(p, '#modal .cityopt[data-a="ist"]')) { await p.click('#modal .cityopt[data-a="ist"]', { force: true }); await p.clock.runFor(400); }
    await cards(p);
    return p;
  };
  const quiet = p => p.evaluate(() => { const S = window.__tapuState(); S.rifki = false; S.nextEvent = 9e12; S.nextOffer = 9e12; S.nextCivic = 9e12; S.nextAd = 9e12; S.nextTaxi = 9e12; S.starter = { at: 1, bought: true }; S.guideHint = true;
    const d = new Date(); S.daily = { last: d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'), streak: 1 }; });
  const buildAt = async (p, i) => {
    if (await vis(p, '#sheet.on')) { await p.keyboard.press('Escape'); await p.clock.runFor(300); }
    await p.click(`#grid .lot[data-i="${i}"]`, { force: true }); await p.clock.runFor(400); await p.waitForTimeout(400); // panel kayarak açılır (gerçek zaman)
    await p.click('#sheetBody [data-a="build"][data-t="ev"]', { force: true }); await p.clock.runFor(400);
  };

  /* ---------- 1) ilk dakikalar ---------- */
  let ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await ctx.addInitScript(PREF_IF);
  let p = await start(ctx); await quiet(p);
  let ev = await events(p);
  ok(typeof (await p.evaluate(() => typeof window.__tapuTest.events)) === 'string' && Array.isArray(ev), 'önizleme kancası: __tapuTest.events() olay listesini veriyor');
  const props = named(ev, '$props')[0];
  ok(props && props.params.region === 'tr' && props.params.lang === 'tr' && props.params.payer === 'none' && props.params.collect_mode === 'tap', 'kullanıcı özellikleri açılışta: ' + JSON.stringify(props && props.params));
  ok(!ev.some(e => /^ms_/.test(e.name)) && (await p.evaluate(() => window.__tapuState().fn)) === 0, 'yeni oyunda kilometre taşı yok (fn = 0)');
  await buildAt(p, 5);
  ev = await events(p); let m = named(ev, 'ms_first_build');
  ok((await p.evaluate(() => !!window.__tapuState().d['ist-0'][5])) && m.length === 1 && m[0].params.play_min === 0 && m[0].params.play_b === 'm0000' && m[0].params.own === 1, 'ilk bina → ms_first_build (oyun süresi kovasıyla): ' + JSON.stringify(m.map(e => e.params)));
  await p.evaluate(() => { window.__tapuState().cash = 1e5; });
  await buildAt(p, 6);
  ev = await events(p);
  ok(named(ev, 'build').length === 2 && named(ev, 'ms_first_build').length === 1, 'ikinci binada kilometre taşı tekrar etmiyor (build 2, ms_first_build 1)');
  await p.evaluate(() => { const S = window.__tapuState(); for (const i of [5, 6]) S.d['ist-0'][i].until = Date.now() + 300; }); await p.clock.runFor(1500); await cards(p);
  await p.evaluate(() => { const S = window.__tapuState(); S.d['ist-0'][5].buf = 50; }); await p.clock.runFor(300);
  await p.click('#collectBtn', { force: true }); await p.clock.runFor(400);
  await p.evaluate(() => { const S = window.__tapuState(); S.d['ist-0'][5].buf = 50; }); await p.clock.runFor(300);
  await p.click('#collectBtn', { force: true }); await p.clock.runFor(400);
  ev = await events(p); m = named(ev, 'ms_first_collect');
  ok(m.length === 1 && (await p.evaluate(() => window.__tapuState().collects)) >= 2, 'ilk toplama → ms_first_collect, ikinci toplamada tekrar yok');
  ok((await p.evaluate(() => window.__tapuState().fn)) === 3, 'bir-kez bitleri kayıtta: fn = 3');
  // yeniden yükleme: bitler kayıttan gelir, olay tekrar etmez
  await p.evaluate(() => dispatchEvent(new Event('pagehide'))); await p.clock.runFor(300);
  const errs1 = p.errs.slice(); await p.close();
  p = await start(ctx); await quiet(p);
  ok((await p.evaluate(() => window.__tapuState().fn)) === 3 && (await p.evaluate(() => !!window.__tapuState().d['ist-0'][5])), 'yeniden yüklemede fn ve binalar korunuyor');
  await p.evaluate(() => { window.__tapuState().cash = 1e5; });
  await buildAt(p, 7);
  ev = await events(p);
  ok(named(ev, 'build').length === 1 && !ev.some(e => /^ms_/.test(e.name)), 'yeniden yüklemeden sonra yeni binada kilometre taşı gönderilmiyor: ' + JSON.stringify(ev.map(e => e.name)));
  ok(!errs1.length && !p.errs.length, 'konsol temiz' + (errs1.concat(p.errs).length ? ' [' + errs1.concat(p.errs).slice(0, 2).join('|') + ']' : ''));
  await ctx.close();

  /* ---------- 2) kiracı: aday → kart → istek → anahtar; banka ---------- */
  ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await ctx.addInitScript(PREF_IF);
  p = await start(ctx); await quiet(p);
  await p.evaluate(() => { const S = window.__tapuState(); const k = S.cur;
    S.d[k] = Array.from({ length: 20 }, (_, i) => (i < 6 ? { t: 'ev', lvl: 1, buf: 0, until: 0, dur: 1, up: false } : null));
    S.own = [k]; S.collectMode = 'tap'; S.cash = 1e6; S.earned = 5000; S.seen = { ev: true, kafe: true }; S.rifki = true; S.ten = []; S.tdef = {}; S.tdc = {}; S.nextTen = 9e15; });
  await p.clock.runFor(1500); await cards(p);
  if (await vis(p, '#rifki:not([hidden])')) await p.evaluate(() => document.querySelector('#rifki .rk-x').click());
  await p.evaluate(() => { const S = window.__tapuState(); S.nextTen = S.playMs + 300; const r = Math.random; Math.random = () => 0; setTimeout(() => { Math.random = r; }, 700); });
  await p.clock.runFor(1200);
  ev = await events(p); let a = named(ev, 'tenant_arrive');
  const want = { district: 'ist-0', city: 'ist', tier: 0, arch: 'ogrenci', wish: 'nb', wtype: 'kafe', late: 0, trait: 'sosyal', ch: 'ist.ogrenci' };
  ok(a.length === 1 && Object.keys(want).every(k => a[0].params[k] === want[k]) && /^m\d{4}$/.test(a[0].params.play_b), 'aday geldi → tenant_arrive (tip, istek, kişilik, şehir, kademe): ' + JSON.stringify(a.map(e => e.params)));
  await p.click('#rifki .rk-bub', { force: true }); await p.clock.runFor(400);
  ev = await events(p); a = named(ev, 'tenant_open');
  ok(await vis(p, '#sheetBody .tn-head') && a.length === 1 && a[0].params.st === 'wait' && a[0].params.arch === 'ogrenci', 'kiracı kartı açıldı → tenant_open (st = wait)');
  await p.keyboard.press('Escape'); await p.clock.runFor(400);
  await p.clock.runFor(61e3); // bekleme süresi kovası için bir dakika
  await p.evaluate(() => { const S = window.__tapuState(); S.d[S.cur][6] = { t: 'kafe', lvl: 1, buf: 0, until: 0, dur: 1, up: false }; }); await p.clock.runFor(1500);
  ev = await events(p); a = named(ev, 'tenant_ready');
  ok((await p.evaluate(() => window.__tapuState().ten[0].st)) === 'ready' && a.length === 1 && a[0].params.wait_b === 'm0001' && a[0].params.wish === 'nb', 'istek karşılandı → tenant_ready (wait_b = m0001): ' + JSON.stringify(a.map(e => e.params)));
  await p.evaluate(() => { const r = document.querySelector('#rifki .rk-x'); if (r) r.click(); });
  await p.click('#grid .lot[data-i="2"]', { force: true }); await p.clock.runFor(400);
  if ((await p.evaluate(() => window.__tapuState().ten[0].st)) !== 'live' && await vis(p, '#sheetBody [data-a="key"]')) { await p.click('#sheetBody [data-a="key"]', { force: true }); await p.clock.runFor(400); }
  await p.clock.runFor(6000); // sistem kilidi denetimi 5 sn'de bir
  ev = await events(p); a = named(ev, 'tenant_settle');
  ok((await p.evaluate(() => window.__tapuState().ten[0].st)) === 'live' && a.length === 1 && a[0].params.arch === 'ogrenci' && a[0].params.trait === 'sosyal' && a[0].params.nth === 1 && a[0].params.new_ch === 1 && /^m\d{4}$/.test(a[0].params.key_b || ''),
    'anahtar verildi → tenant_settle (nth 1, yeni pul, anahtar süresi): ' + JSON.stringify(a.map(e => e.params)));
  ok(named(ev, 'ms_first_tenant').length === 1 && ev.findIndex(e => e.name === 'tenant_settle') < ev.findIndex(e => e.name === 'ms_first_tenant'), 'ilk kiracı → ms_first_tenant (bir kez, anahtardan sonra)');
  const un = named(ev, 'sys_unlock').map(e => e.params.sys);
  ok(un.filter(s => s === 'tenant').length === 1 && un.includes('bank') && new Set(un).size === un.length, 'sistem kilidi olayları sistem başına bir kez: ' + JSON.stringify(un));
  const order = ev.filter(e => /^tenant_/.test(e.name)).map(e => e.name);
  ok(JSON.stringify(order) === JSON.stringify(['tenant_arrive', 'tenant_open', 'tenant_ready', 'tenant_settle']), 'kiracı hunisi sırayla, her adım bir kez: ' + order.join(' → '));
  // banka paneli ve sekme
  await p.evaluate(() => window.__tapuTest.openSheet({ k: 'banka' })); await p.clock.runFor(1500); await p.waitForTimeout(300); await p.clock.runFor(500);
  await p.click('#sheetBody [data-a="tab"][data-v="fx"]', { force: true }); await p.clock.runFor(400);
  ev = await events(p);
  const bo = named(ev, 'bank_open'), bt = named(ev, 'bank_tab');
  ok(bo.length === 1 && bo[0].params.from === 'tr' && bo[0].params.unlocked === 1 && bt.length === 1 && bt[0].params.tab === 'fx', 'banka: bank_open (from tr, açık) ve bank_tab (fx): ' + JSON.stringify([bo.map(e => e.params), bt.map(e => e.params)]));
  // kurallar: ad ve parametreler; karakter adı / serbest metin yok
  const bad = [];
  for (const e of ev) {
    if (e.name === '$props') continue;
    if (!/^[a-z][a-z0-9_]{0,39}$/.test(e.name)) bad.push(e.name);
    const ks = Object.keys(e.params || {}); if (ks.length > 25) bad.push(e.name + ': ' + ks.length + ' parametre');
    for (const k of ks) { const v = e.params[k];
      if (!/^[a-z][a-z0-9_]{0,39}$/.test(k)) bad.push(e.name + '.' + k);
      if (typeof v === 'string' && (v.length > 100 || /\s|Ece|@/.test(v))) bad.push(e.name + '.' + k + '=' + v); }
  }
  ok(!bad.length, 'bütün olaylar Firebase kurallarına uyuyor, parametrelerde ad / serbest metin yok' + (bad.length ? ' [' + bad.slice(0, 4).join(' | ') + ']' : ''));
  ok(!p.errs.length, 'konsol temiz' + (p.errs.length ? ' [' + p.errs.slice(0, 2).join('|') + ']' : ''));
  await ctx.close();
}

module.exports = { analitikBolum };

if (require.main === module) (async () => {
  const { chromium } = require('playwright');
  const results = []; const ok = (c, m) => { results.push(!!c); console.log((c ? '  ✓ ' : '  ✗ ') + m); };
  const URL = await serve(); const b = await chromium.launch();
  await analitikBolum(b, ok, URL); await b.close();
  const pass = results.filter(Boolean).length; console.log(`\nSONUÇ: ${pass}/${results.length} geçti`); process.exit(pass === results.length ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
