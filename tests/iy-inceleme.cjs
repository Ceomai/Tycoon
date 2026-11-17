// İNCELEME DÜZELTMELERİ (uçtan uca): web'de oyun aynı anda tek sekmede.
// Bulgu: aynı bölge iki sekmede açıkken gönderen tarafta para çoğalıyordu (eski sekme, aktarımdan önceki durumu kayda yazar).
// Şimdi: ikinci sekme "Oyun başka bir sekmede açık · Burada devam et" ekranını gösterir, kayda yazmaz; "Burada devam et" ilk
// sekmeyi durdurur (son durumunu yazar, ekranı gösterir, bir daha yazmaz) ve bu sekme kaydı yeniden okur.
// iyilestirme.cjs (npm run test:iy) içinden çağrılır; tek başına: vite build --mode preview && node tests/iy-inceleme.cjs
const { serve, PREF_IF, vis } = require('./helpers.cjs');

/** Kayıttaki durum (sağlamalı biçim açılır). */
const readSave = (p, key = 'tapu-save-v2') => p.evaluate(k => { const r = localStorage.getItem(k); if (!r) return null; const o = JSON.parse(r); return typeof o.j === 'string' ? JSON.parse(o.j) : o; }, key);
const US_KEY = 'tapu-save-v2-us';

async function incelemeBolum(b, ok, URL) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript(PREF_IF);
  const errs = [];
  const page = async () => { const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message)); return p; };
  const a = await page(); await a.goto(URL); await a.waitForTimeout(800);
  if (await vis(a, '#modal .cityopt[data-a="ist"]')) { await a.click('#modal .cityopt[data-a="ist"]', { force: true }); await a.waitForTimeout(600); }
  for (let k = 0; k < 5 && await vis(a, '#modal .card'); k++) { await a.click('#modal .card [data-a]', { force: true }).catch(() => {}); await a.waitForTimeout(300); }
  // banka açık, kasa dolu; ABD başlamış (alan kayıt var)
  await a.evaluate(() => { const S = window.__tapuState(); S.cash = 1e6; S.earned = 1e7; S.own = ['ist-0', 'ist-1']; S.d['ist-1'] = S.d['ist-1'] || Array(20).fill(null); S.rifki = false; });
  await a.evaluate(k => localStorage.setItem(k, JSON.stringify({ v: 9, city: 'nyc', own: ['nyc-0'], cur: 'nyc-0', d: { 'nyc-0': [] }, cash: 1000, earned: 0, bank: { rate: 1000, ep: 'us-ep', in: [], out: [], day: { k: '', got: 0 }, log: [], tip: '' } })), US_KEY);
  await a.evaluate(() => dispatchEvent(new Event('pagehide'))); // ilk sekmenin durumu kayda (sonra açılan sekme bunu okur)

  // 1) ikinci sekme: bekleme ekranı, oyun açılmaz
  const c = await page(); await c.goto(URL); await c.waitForTimeout(2000);
  const cw = await c.evaluate(() => { const d = document.querySelector('.tabwait'); const bt = d && d.querySelector('button'); const r = bt && bt.getBoundingClientRect();
    return d && { role: d.getAttribute('role'), modal: d.getAttribute('aria-modal'), lab: !!document.getElementById(d.getAttribute('aria-labelledby') || '-'), txt: d.textContent, focus: document.activeElement === bt, h: r ? r.height : 0, state: typeof window.__tapuState }; });
  ok(!!cw && cw.txt.includes('Oyun başka bir sekmede açık'), 'ikinci sekme: "Oyun başka bir sekmede açık" ekranı');
  ok(!!cw && cw.role === 'alertdialog' && cw.modal === 'true' && cw.lab && cw.focus && cw.h >= 44 && cw.txt.includes('Burada devam et'), 'bekleme ekranı erişilebilir: alertdialog, başlık bağlı, odak "Burada devam et" düğmesinde, düğme ≥44 px');
  ok(!!cw && cw.state === 'undefined', 'ikinci sekmede oyun başlamadı (durum yok)');
  ok(!(await vis(a, '.tabwait')), 'ilk sekme oynamaya devam ediyor');

  // 2) ilk sekmede ABD'ye aktarım; ikinci (eski) sekme kapanırken kayda eski durumu yazamaz → para çoğalmaz
  const before = await a.evaluate(() => window.__tapuState().cash);
  const r = await a.evaluate(() => window.__tapuTest.bank.transfer('us', 20000));
  await a.waitForTimeout(300);
  ok(r && r.ok, 'aktarım yapıldı ' + JSON.stringify(r));
  await c.close({ runBeforeUnload: true }); await a.waitForTimeout(300);
  const tr = await readSave(a), us = await readSave(a, US_KEY);
  const got = r && r.ok ? r.got : 0;
  ok(tr && Math.abs(tr.cash - (before - 20000)) < 1 && us && us.cash === 1000 + got, `para çoğalmadı: TR kasa ${tr && Math.round(tr.cash)} (beklenen ${before - 20000}), ABD ${us && us.cash} (beklenen ${1000 + got})`);

  // 3) "Burada devam et": ilk sekme durur, ikinci sekme kaydı yeniden okur
  await a.evaluate(() => { window.__tapuState().cash += 5; }); // ilk sekmenin yazılmamış son durumu
  const want = await a.evaluate(() => window.__tapuState().cash);
  const d = await page(); await d.goto(URL); await d.waitForTimeout(2000);
  ok(await vis(d, '.tabwait'), 'üçüncü sekme de bekliyor');
  await d.click('.tabwait button', { timeout: 3000 }).catch(() => {}); await d.waitForTimeout(2500);
  ok(await vis(a, '.tabwait') && (await a.textContent('.tabwait').catch(() => '')).includes('Oyun başka bir sekmede açık'), 'devralınınca ilk sekme "Oyun başka bir sekmede açık" ekranını gösterir');
  ok(await a.evaluate(() => document.getElementById('app').hasAttribute('inert')), 'ilk sekmenin oyunu arkada etkileşimsiz (inert)');
  const dState = await d.evaluate(() => window.__tapuState && window.__tapuState().cash).catch(() => null);
  ok(!(await vis(d, '.tabwait')) && Math.abs(dState - want) < 1, `devralan sekme kaydı yeniden okudu (kasa ${dState && Math.round(dState)} = ${Math.round(want)})`);
  // durmuş sekme bir daha yazmaz (periyodik kayıt, kapanış)
  await a.evaluate(() => { window.__tapuState().cash = 123; }); await a.waitForTimeout(300);
  await a.close({ runBeforeUnload: true }); await d.waitForTimeout(300);
  const after = await readSave(d);
  ok(after && Math.abs(after.cash - want) < 1e3 && after.cash !== 123, 'durmuş sekme kapanırken kayda yazmadı');

  // 4) ek güvenlik: etkin sekmenin kayıt anahtarına başka oturum yazarsa birleştirmeden yeniden yüklenir
  const e = await page(); await e.goto(URL); await e.waitForTimeout(2000); // bekleme ekranında (yazmaz)
  await d.evaluate(() => { window.__reloadMark = 1; });
  await e.evaluate(() => { const r = localStorage.getItem('tapu-save-v2'); const o = JSON.parse(r); o.w = 'yabanci'; localStorage.setItem('tapu-save-v2', JSON.stringify(o)); });
  await d.waitForTimeout(1500);
  ok(await d.evaluate(() => window.__reloadMark === undefined), 'etkin sekme kendi kaydına yabancı yazma görünce yeniden yüklendi');
  ok(errs.length === 0, 'sekmelerde hata yok ' + errs.slice(0, 3).join(' | '));
  await ctx.close();

  // 5) İngilizce bekleme ekranı
  const ctx2 = await b.newContext({ viewport: { width: 320, height: 568 } });
  await ctx2.addInitScript("if(!localStorage.getItem('tapu-prefs'))localStorage.setItem('tapu-prefs',JSON.stringify({lang:'en',region:'tr',ent:{},news:true}));");
  const x = await ctx2.newPage(); await x.goto(URL); await x.waitForTimeout(800);
  const y = await ctx2.newPage(); await y.goto(URL); await y.waitForTimeout(2000);
  const yt = await y.textContent('.tabwait').catch(() => '');
  const ov = await y.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  ok(/another tab/i.test(yt) && /continue here/i.test(yt) && ov <= 0, 'EN: "The game is open in another tab · Continue here" (320 px taşma yok)');
  await ctx2.close();
}
module.exports = { incelemeBolum };

if (require.main === module) {
  const { chromium } = require('playwright');
  const { recorder } = require('./helpers.cjs');
  (async () => {
    const URL = await serve(); const b = await chromium.launch(); const results = []; const ok = recorder(results);
    console.log('20) İnceleme düzeltmeleri: tek sekme');
    await incelemeBolum(b, ok, URL);
    await b.close();
    const pass = results.filter(r => r.pass).length; console.log(`\nSONUÇ: ${pass}/${results.length} geçti`); process.exit(pass === results.length ? 0 : 1);
  })().catch(e => { console.error(e); process.exit(1); });
}
