// DAYANIKLILIK (SOAK) TESTLERİNİN ORTAK YARDIMCILARI
// tests/soak/lib.cjs → helpers '../helpers.cjs' (dist-preview: önce vite build --mode preview). Çalıştır: npm run test:soak
// Ortam değişkeni TAPU_TESTS ile helpers klasörü değiştirilebilir.
const path = require('path'), fs = require('fs');
const HDIR = process.env.TAPU_TESTS || (fs.existsSync(path.resolve(__dirname, '../helpers.cjs')) ? path.resolve(__dirname, '..') : path.resolve(__dirname, 'app/tests'));
const H = require(path.join(HDIR, 'helpers.cjs'));
const { chromium } = require('playwright');

const OUT = path.resolve(__dirname, 'out'); fs.mkdirSync(OUT, { recursive: true });
let URL = null;
async function url() { if (!URL) URL = await H.serve(); return URL; }
async function launch() { await url(); return chromium.launch(); }

const prefs = (region = 'tr', lang = 'tr') => `try{if(location.protocol.startsWith('http')&&!localStorage.getItem('tapu-prefs'))localStorage.setItem('tapu-prefs',JSON.stringify({lang:'${lang}',region:'${region}',ent:{},news:true}));}catch(e){}`;

/** Yeni oyuncu (ayrı tarayıcı bağlamı = ayrı depolama). time: sahte saatin başlangıcı (yerel). */
async function newCtx(b, o = {}) {
  const ctx = await b.newContext({ viewport: o.vp || { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, timezoneId: o.tz || 'UTC' /* Node (betik) ile aynı: new Date(y,m,d,h) her iki tarafta aynı yerel saat */ });
  await ctx.addInitScript(prefs(o.region, o.lang));
  await ctx.clock.install({ time: o.time || new Date(2026, 10, 16, 9, 0) });
  ctx.errs = [];
  return ctx;
}
/** Sayfa açar (oyun önyüklenene kadar sahte saati azar azar ilerletir). Konsol hataları ctx.errs / p.errs'e. */
async function openPage(ctx, o = {}) {
  const p = await ctx.newPage(); p.errs = [];
  const rec = m => { p.errs.push(m); ctx.errs.push(m); };
  p.on('pageerror', e => rec('pageerror: ' + e.message));
  p.on('console', m => { if (m.type() === 'error') rec('console.error: ' + m.text()); });
  await p.goto(await url());
  await boot(p);
  return p;
}
async function boot(p) {
  for (let k = 0; k < 40; k++) { await p.clock.runFor(100); if (await p.evaluate(() => !!(window.__tapuState && window.__tapuState()))) break; }
  await p.clock.runFor(300);
}
/** İlk açılış: şehir seçimi + açılış kartları (ikincil düğme). */
async function pickCity(p, city = 'ist') {
  if (await H.vis(p, `#modal .cityopt[data-a="${city}"]`)) { await p.click(`#modal .cityopt[data-a="${city}"]`, { force: true }); await p.clock.runFor(600); }
  await cards(p);
}
/** Açık kartları kapatır: önce data-back (geri ile kapatılabilir), yoksa .txt, yoksa ilk düğme. Döner: kapatılan kart başlıkları. */
async function cards(p, n = 8) {
  const seen = [];
  for (let k = 0; k < n; k++) {
    await p.clock.runFor(450);
    if (await adClose(p)) { seen.push('[reklam]'); continue; }
    const c = await p.evaluate(() => { const m = document.querySelector('#modal'); if (!m || m.hidden || !m.querySelector('.card')) return null; const b = m.querySelector('[data-back][data-a]') || m.querySelector('.card .txt[data-a]') || m.querySelector('.card [data-a]'); return { h: (m.querySelector('h3') || {}).textContent || '', cls: m.querySelector('.card').className, a: b ? b.dataset.a : null }; });
    if (!c) break;
    seen.push(c.h);
    if (!c.a) break;
    await p.$eval(`#modal [data-a="${c.a}"]`, e => e.click()).catch(() => {});
  }
  await p.clock.runFor(400);
  return seen;
}

/* ---------- durum ---------- */
const S = p => p.evaluate(() => JSON.parse(JSON.stringify(window.__tapuState())));
const mut = H.mut;
/** Para durumunun özeti: W = kasa + süren ihaledeki emanet. */
const money = p => p.evaluate(() => { const S = window.__tapuState(), a = S.ihale && S.ihale.cur; const held = a && !a.done ? a.held : 0;
  return { cash: S.cash, earned: S.earned, held, W: S.cash + held, wk: S.week.earned, wkKey: S.week.key, now: Date.now(), playMs: S.playMs,
    ih: a ? { id: a.id, done: a.done || '', paid: a.paid || 0, my: a.my, held: a.held, kind: a.kind } : null,
    inLog: S.bank.log.filter(l => l.dir === 'in').map(l => ({ id: l.id, a: l.a })), bin: S.bank.in.slice(), out: S.bank.out.map(o => ({ ...o })) }; });

/** Değişmez denetimleri: NaN/Infinity, negatif tutarlar, takılan kart/görünmez modal/boş perde. Döner: sorun listesi. */
async function invariants(p) {
  await p.waitForTimeout(400); // kart açılış animasyonu (CSS gerçek zamanla) bitsin
  return p.evaluate(() => {
    const bad = [], S = window.__tapuState();
    const NONNEG = new Set(['cash', 'earned', 'buf', 'held', 'my', 'a', 'b', 'got', 'rate', 'lvl', 'playMs', 'tokens', 'shares', 'paid', 'v', 'start', 'step', 'cap', 'until', 'dur', 'end', 'dl', 'kp', 'wins', 'losses', 'collects']);
    const walk = (o, pth, d) => {
      if (d > 8 || o == null) return;
      if (typeof o === 'number') { if (!Number.isFinite(o)) bad.push('sayı değil/sonsuz: ' + pth + '=' + o); else { const k = pth.split('.').pop(); if (NONNEG.has(k) && o < 0) bad.push('negatif: ' + pth + '=' + o); } return; }
      if (typeof o !== 'object') return;
      for (const k of Object.keys(o)) walk(o[k], pth ? pth + '.' + k : k, d + 1);
    };
    walk(S, '', 0);
    const m = document.querySelector('#modal'), sh = document.querySelector('#sheet'), sc = document.querySelector('#scrim');
    const card = m && m.querySelector('.card');
    if (m && !m.hidden) {
      if (!card) bad.push('modal açık ama kart yok');
      else { const r = card.getBoundingClientRect(), cs = getComputedStyle(card); if (r.width < 10 || r.height < 10 || +cs.opacity < 0.5 || cs.visibility === 'hidden') bad.push('görünmez modal kartı: ' + card.className + ' op=' + cs.opacity); }
    } else if (card) bad.push('gizli modalde kart kaldı');
    if (sc && sc.classList.contains('on') && (!m || m.hidden) && !(sh && sh.classList.contains('on'))) bad.push('perde (scrim) açık ama kart/panel yok');
    const ghost = document.querySelector('#modalOut'); if (ghost && ghost.children.length > 2) bad.push('kapanış kopyaları birikti: ' + ghost.children.length);
    const vw = document.documentElement.scrollWidth; if (vw > innerWidth + 1) bad.push('yatay taşma: ' + vw + '>' + innerWidth);
    return bad;
  });
}

/* ---------- kasa defteri ----------
   W = kasa + süren ihale emaneti. Beklenen: W0 + Δkazanç (earned) − harcamalar (eylem eylem ölçülür ve ekrandaki fiyatla
   karşılaştırılır) − kazanılan ihale bedelleri + gelen havaleler − giden havaleler. Açıklanamayan fark > %0,1 → hata. */
class Ledger {
  constructor(m, tag = '') { this.tag = tag; this.reset(m); this.log = []; }
  reset(m) { this.W0 = m.W; this.E0 = m.earned; this.spend = 0; this.paid = 0; this.bin = 0; this.bout = 0; this.seenWon = new Set(m.ih && m.ih.done === 'won' ? [m.ih.id] : []); this.seenIn = new Set(m.inLog.map(l => l.id).concat(m.bin)); this.earnAdj = 0; }
  /** Holding / sıfırlama gibi kazancın sıfırlandığı anlar: earned farkı başa alınır. */
  rebase(m) { this.reset(m); }
  observe(m) { // ihale ve gelen havaleler durumdan izlenir
    if (m.ih && m.ih.done === 'won' && !this.seenWon.has(m.ih.id)) { this.seenWon.add(m.ih.id); this.paid += m.ih.paid; this.log.push(['ihale-ödendi', m.ih.paid]); }
    for (const l of m.inLog) if (l.id && !this.seenIn.has(l.id)) { this.seenIn.add(l.id); this.bin += l.a; this.log.push(['havale-geldi', l.a]); }
    for (const id of m.bin) this.seenIn.add(id);
  }
  expected(m) { return this.W0 + (m.earned - this.E0) - this.spend - this.paid + this.bin - this.bout; }
  check(m) { this.observe(m); const e = this.expected(m), d = m.W - e; return { exp: e, got: m.W, diff: d, rel: Math.abs(d) / Math.max(1, Math.abs(e)) }; }
}

/** Eylemi saat dururken yapar ve para farkını ölçer. f: async () => void. Döner: { spend, dEarn, before, after }. */
async function measured(p, L, kind, f) {
  const a = await money(p); L.observe(a);
  await f();
  const b = await money(p);
  const spend = -((b.W - a.W) - (b.earned - a.earned));
  if (kind === 'bank') { L.bout += spend; } else L.spend += spend;
  L.observe(b);
  if (Math.abs(spend) > 1e-9) L.log.push([kind, spend]);
  return { spend, dEarn: b.earned - a.earned, a, b };
}

/** Ülke fiyat seviyesi (CFG.PL_*): ekrandaki tutar = iç birim × seviye. */
const PL = { tr: 12000, us: 2500, uk: 2200, de: 1800, jp: 240000, gl: 2500 };
/** Ekrandaki parayı (TR biçimi: ₺1,2Mn) iç birime çevirir; sc: bölgenin fiyat seviyesi (PL). */
function parseMoney(txt, sc = PL.tr, hi = false, lo = false) {
  const m = /([₺$€£¥])\s?([\d.,]+)\s?(B|Mn|Mr|Tn|Kn|Kt|Sk|Sp|Ok|Nn|K|M|T)?/.exec(txt || ''); if (!m) return NaN;
  const U = { B: 1e3, Mn: 1e6, Mr: 1e9, Tn: 1e12, Kn: 1e15, Kt: 1e18, Sk: 1e21, Sp: 1e24, Ok: 1e27, Nn: 1e30, K: 1e3, M: 1e6, T: 1e12 };
  const v = parseFloat(m[2].replace(/\./g, '').replace(',', '.')), u = m[3] ? U[m[3]] : 1;
  // gösterim aşağı yuvarlı: birimli ve <100 ise 0,1 hane, değilse 1 hane hassasiyet
  // hi: aşağı yuvarlı gösterimin (kasa, kazanç) üst sınırı · lo: yukarı yuvarlı gösterimin (bedel, fmtCost) alt sınırı
  const st = m[3] && v < 100 ? 0.1 : 1;
  return (hi ? v + st : lo ? Math.max(0, v - st) : v) * u / sc;
}

/* ---------- arayüz eylemleri ---------- */
const tile = i => `#grid .lot[data-i="${i}"]`;
/** Dokunuş: DOM click (panel içi kaydırma/animasyon ve üstteki baloncuklar koordinatlı tıklamayı yanlış öğeye götürmesin).
 *  Oyun düğmeleri click olayını dinler. h: seçici ya da ElementHandle. */
async function clk(p, h) {
  if (typeof h === 'string') await p.$eval(h, e => e.click());
  else await h.evaluate(e => e.click());
}
/** Reklam ekranı (önizleme simülasyonu: geçiş reklamı ya da ödüllü): süre dolunca kapat / ödülü al. Döner: kapatıldı mı. */
async function adClose(p) {
  if (!(await p.evaluate(() => { const a = document.querySelector('#ad'); return !!a && !a.hidden; }))) return false;
  for (let k = 0; k < 40; k++) { if (await p.evaluate(() => { const x = document.querySelector('#adX'); return !!x && !x.disabled; })) break; await p.clock.runFor(1000); }
  await p.$eval('#adX', e => e.click()).catch(() => {}); await p.clock.runFor(400);
  return true;
}
async function tap(p, sel, run = 400) { await clk(p, sel); await p.clock.runFor(run); }
async function esc(p) { await p.keyboard.press('Escape'); await p.clock.runFor(350); }
async function closeAll(p) { await adClose(p); for (let k = 0; k < 4; k++) { const o = await p.evaluate(() => ({ m: !document.querySelector('#modal').hidden, s: document.querySelector('#sheet').classList.contains('on') })); if (!o.m && !o.s) return; if (o.m) await cards(p, 1); else await esc(p); } }
const sheetOn = p => p.evaluate(() => document.querySelector('#sheet').classList.contains('on'));
const modalOn = p => p.evaluate(() => !document.querySelector('#modal').hidden);
/** Kaydı bir sonraki açılışta oyun başlamadan yerleştirir ve yeniler (helpers.injectReload'un about:blank'te hata vermeyen hâli). */
async function inject(p, state) {
  if (state === undefined) await p.evaluate(() => sessionStorage.setItem('__inj', JSON.stringify(window.__tapuState())));
  else await p.evaluate(v => sessionStorage.setItem('__inj', JSON.stringify(v)), state);
  if (!p.__inj2) { p.__inj2 = 1; await p.addInitScript(() => { try { if (!location.protocol.startsWith('http')) return; const v = sessionStorage.getItem('__inj'); if (v) { sessionStorage.removeItem('__inj'); const r = (JSON.parse(localStorage.getItem('tapu-prefs') || '{}').region) || 'tr'; localStorage.setItem(r === 'tr' ? 'tapu-save-v2' : 'tapu-save-v2-' + r, v); } } catch (e) { /* yok */ } }); }
  await p.reload(); await boot(p);
}
/** Uygulamayı kapatır: sayfadan ayrılır (pagehide → kayıt), sonra sekmeyi kapatır. */
async function closeApp(p) { await p.goto('about:blank'); await p.close(); }
async function openTile(p, i) { await closeAll(p); await p.$eval(tile(i), e => e.click()); await p.clock.runFor(400); }

module.exports = { inject, adClose, clk, closeApp, H, OUT, url, launch, newCtx, openPage, boot, pickCity, cards, S, mut, money, invariants, Ledger, measured, parseMoney, PL, tile, tap, esc, closeAll, sheetOn, modalOn, openTile, prefs };
