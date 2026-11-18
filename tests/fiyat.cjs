// FİYAT SEVİYESİ TESTİ: her bölgede (TR, US, UK, DE, JP, Global) gösterim = iç birim × ülke fiyat seviyesi (yerel para), kuruş yok.
// Ana ekran (kasa), arsa paneli (ilk ev fiyatı ve kirası), banka aktarımı (gönderilen → kur → varacak tutarlı; pahalı ülkeye giden
// para daha az iç birim), bilanço (gerçek değerler; para birimi değişince doğru çevrim; bağımsız hesapla karşılaştırma).
// Ekran görüntüleri: tests/out/fiyat-<bölge>-{ana,arsa,aktar,bilanco}.png
// Çalıştır: npm run test:fiyat  (önizleme paketi dist-preview/index.html; Playwright gerekir)
const { chromium } = require('playwright');
const { serve, vis: has, recorder, out } = require('./helpers.cjs');
const B = require('./soak/bilanco.cjs');
const results = [], ok = recorder(results);

const TUE = new Date(2026, 10, 17, 10, 0).getTime();
/** Bölge · dil · şehir · bilanço/aktarım için başlanmış ikinci bölge · beklenen: başlangıç kasası (iç 150), ilk ev (iç 100), ilk ev kirası (iç 1/sn). */
const CASES = [
  { r: 'tr', lang: 'tr', city: 'ist', other: 'us', ocity: 'nyc', cash: '₺1,8Mn', ev: '₺1,2Mn', kira: '₺12B', lo: 1e6, hi: 1.5e6 },
  { r: 'us', lang: 'en', city: 'nyc', other: 'tr', ocity: 'ist', cash: '$375K', ev: '$250K', kira: '$2.5K', lo: 250e3, hi: 300e3 },
  { r: 'uk', lang: 'en', city: 'lon', other: 'tr', ocity: 'ist', cash: '£330K', ev: '£220K', kira: '£2.2K', lo: 220e3, hi: 280e3 },
  { r: 'de', lang: 'de', city: 'muc', other: 'tr', ocity: 'ist', cash: '€270Tsd', ev: '€180Tsd', kira: '€1,8Tsd', lo: 180e3, hi: 230e3 },
  { r: 'jp', lang: 'ja', city: 'tyo', other: 'tr', ocity: 'ist', cash: '¥3600万', ev: '¥2400万', kira: '¥24万', lo: 20e6, hi: 30e6 },
  { r: 'gl', lang: 'en', city: 'nyc', other: 'tr', ocity: 'ist', cash: '$375K', ev: '$250K', kira: '$2.5K', lo: 250e3, hi: 300e3 },
];
const UNITS = {
  tr: { dec: ',', base: 1e3, u: ['B', 'Mn', 'Mr', 'Tn', 'Kn', 'Kt', 'Sk', 'Sp'] },
  en: { dec: '.', base: 1e3, u: ['K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp'] },
  de: { dec: ',', base: 1e3, u: ['Tsd', 'Mio', 'Mrd', 'Bio', 'Brd', 'Tri', 'Trd'] },
  ja: { dec: '.', base: 1e4, u: ['万', '億', '兆', '京', '垓'] },
};
/** Ekrandaki tutarı (dilin kısaltmasıyla) sayıya çevirir. */
function parse(txt, lang) {
  const U = UNITS[lang], m = new RegExp('[₺$€£¥]\\s?(\\d+(?:[' + U.dec + ']\\d+)?)\\s?(' + [...U.u].sort((a, b) => b.length - a.length).join('|') + ')?').exec(txt || '');
  return m ? +m[1].replace(',', '.') * (m[2] ? Math.pow(U.base, U.u.indexOf(m[2]) + 1) : 1) : NaN;
}
/** Kuruşlu tutar (₺12,34 · $0.80) — kur satırları ("1 $ = ₺43,12") ve mağaza fiyatları hariç metinde olmamalı. */
const KURUS = /[₺$€£¥]\s?\d+[.,]\d{2,}/;
const kurus = t => (t || '').split('\n').filter(l => !l.includes('=') && KURUS.test(l));
const keyOf = r => 'tapu-save-v2' + (r === 'tr' ? '' : '-' + r);
const tapS = async (p, sel, w = 350) => { await p.click(sel, { force: true }); await p.clock.runFor(300); await p.waitForTimeout(w); };
const dismiss = async p => { for (let k = 0; k < 6 && await has(p, '#modal .card'); k++) { await p.click('#modal .card [data-a]', { force: true }); await p.clock.runFor(400); } };
const saves = p => p.evaluate(() => { const o = {}; for (const r of ['tr', 'us', 'uk', 'de', 'jp', 'gl']) { const raw = localStorage.getItem('tapu-save-v2' + (r === 'tr' ? '' : '-' + r)); if (raw) { try { const v = JSON.parse(JSON.parse(raw).j); if (v && v.city) o[r] = v; } catch { /* yok */ } } } return o; });

(async () => {
  const b = await chromium.launch(), URL = await serve(), yields = {}, firstUsd = {};
  for (const c of CASES) {
    console.log(`\n${c.r.toUpperCase()} · ${c.lang}`);
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    await ctx.addInitScript(`if(!localStorage.getItem('tapu-prefs'))localStorage.setItem('tapu-prefs',JSON.stringify({lang:'${c.lang}',region:'${c.r}',ent:{},news:true}));`);
    const p = await ctx.newPage(); p.errs = []; p.on('pageerror', e => p.errs.push(e.message));
    await p.clock.install({ time: TUE }); await p.goto(URL); await p.clock.runFor(700); await p.waitForTimeout(300);
    await p.click(`#modal .cityopt[data-a="${c.city}"]`, { force: true }); await p.clock.runFor(400); await dismiss(p);
    await p.evaluate(() => { const S = window.__tapuState(); S.nextEvent = 9e12; S.nextOffer = 9e12; S.nextCivic = 9e12; S.nextAd = 9e12; S.nextTaxi = 9e12; S.rifki = false; S.guideHint = true; S.starter = { at: 1, bought: true }; S.offer = null; S.nextTen = 9e15; });
    await p.clock.runFor(600); await dismiss(p);

    /* 1) yeni oyun: başlangıç kasası ve arsa panelinde ilk ev */
    const cash0 = await p.textContent('#cash');
    ok(cash0 === c.cash, `başlangıç kasası (iç 150) ${c.cash}: ${cash0}`);
    await tapS(p, '#grid .lot[data-i="10"]', 500);
    const lot = await p.evaluate(() => { const e = document.querySelector('#sheetBody .bcard.k-ev'); return e ? { bp: e.querySelector('.bp').textContent, bm: e.querySelector('.bm').textContent, all: document.querySelector('#sheetBody').innerText } : null; });
    const price = lot ? parse(lot.bp, c.lang) : NaN, rent = lot ? parse(lot.bm, c.lang) : NaN;
    ok(lot && lot.bp === c.ev && price >= c.lo && price <= c.hi, `arsa paneli: ilk ev ${c.ev} (hedef aralıkta): ${lot && lot.bp}`);
    ok(lot && lot.bm.startsWith(c.kira), `ilk ev kirası ${c.kira}/sn: ${lot && lot.bm}`);
    ok(lot && !kurus(lot.all).length, 'arsa panelinde kuruş yok ' + JSON.stringify(lot ? kurus(lot.all) : []));
    yields[c.r] = rent / price; firstUsd[c.r] = price * B.tryPer(B.CUR_OF[c.r]) / B.tryPer('USD');
    await p.screenshot({ path: out + `fiyat-${c.r}-arsa.png` });
    await p.keyboard.press('Escape'); await p.clock.runFor(400);

    /* 2) orta oyun: iki semt, banka açık; ikinci bölge başlanmış */
    await p.evaluate(([city, other, ocity, okey]) => {
      const S = window.__tapuState(), T = ['ev', 'kafe', 'dukkan', 'ofis'];
      S.d[city + '-0'] = Array.from({ length: 20 }, (_, i) => ({ t: T[i % 4], lvl: 3, buf: 0, until: 0, dur: 1, up: false })); S.d[city + '-1'] = Array.from({ length: 20 }, (_, i) => (i < 6 ? { t: T[i % 2], lvl: 1, buf: 0, until: 0, dur: 1, up: false } : null));
      S.own = [city + '-0', city + '-1']; S.lien = {}; S.lienT = {}; S.collectMode = 'tap'; S.cash = 1e9; S.earned = 1e9; S.seen = { ev: true, kafe: true, dukkan: true, ofis: true };
      S.collects = 0; S.market = 'x'; S.ten = []; S.pjIntro = true; S.cards = Object.keys(S.d); S.ihale.intro = true;
      const d = new Date(); S.daily = { last: d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'), streak: 1 };
      S.tasks = { day: S.daily.last, bonus: false, list: [{ k: 'taxi', goal: 1e9, prog: 0, claimed: false }] };
      const o = JSON.parse(JSON.stringify(S)); o.city = ocity; o.own = [ocity + '-0', ocity + '-1']; o.cur = ocity + '-0';
      o.d = { [ocity + '-0']: Array.from({ length: 20 }, (_, i) => ({ t: T[i % 4], lvl: 2, buf: 0, until: 0, dur: 1, up: false })), [ocity + '-1']: Array(20).fill(null) };
      o.cash = 4e6; o.earned = 5e6; o.week.earned = 77; o.bank = { rate: 3000, ep: 'oep', in: [], out: [], day: { k: '', got: 0 }, log: [], tip: '' };
      o.ihale = { cur: null, rm: {}, got: [], kose: [], kp: 0, intro: true, wins: 0, losses: 0 }; o.ten = []; o.pj = {};
      const j = JSON.stringify(o); let h = 0x811c9dc5; for (let i = 0; i < j.length; i++) { h ^= j.charCodeAt(i); h = Math.imul(h, 0x01000193); }
      localStorage.setItem(okey, JSON.stringify({ c: (h >>> 0).toString(36), j }));
    }, [c.city, c.other, c.ocity, keyOf(c.other)]);
    await p.clock.runFor(1500); await dismiss(p); await p.waitForTimeout(200);
    const main = await p.evaluate(() => ({ cash: document.querySelector('#cash').textContent, rate: document.querySelector('#rate').textContent, hud: document.querySelector('#app').innerText }));
    const st = await p.evaluate(() => { const S = window.__tapuState(); return { cash: S.cash }; });
    const shownCash = parse(main.cash, c.lang), expCash = st.cash * B.PL[c.r];
    ok(Math.abs(shownCash / expCash - 1) < 0.02, `ana ekran kasa = iç birim × seviye (${B.PL[c.r]}): ${main.cash} · ${main.rate}`);
    ok(!kurus(main.hud).length, 'ana ekranda kuruş yok ' + JSON.stringify(kurus(main.hud)));
    await p.screenshot({ path: out + `fiyat-${c.r}-ana.png` });

    /* 3) banka: aktar */
    await tapS(p, '#menuBtn'); await tapS(p, '#sheetBody .drow[data-a="banka"]', 600); await p.clock.runFor(300); await p.waitForTimeout(300);
    for (let k = 0; k < 10 && !(await p.$(`#sheetBody .bk-to[data-r="${c.other}"]`)); k++) { await p.clock.runFor(300); await p.waitForTimeout(100); }
    await tapS(p, `#sheetBody .bk-to[data-r="${c.other}"]`, 400);
    const slip = await p.evaluate(() => ({ l: [...document.querySelectorAll('#sheetBody .bk-slip .bk-l')].map(e => [e.querySelector('span').textContent, e.querySelector('b').textContent]), all: document.querySelector('#sheetBody').innerText }));
    // ekrandaki tutarlar iki-üç anlamlı haneye yuvarlı (gönderilen yukarı, varacak aşağı): %10 pay; kesin eşitlik birim testinde (fiyat.test.ts)
    const sent = parse(slip.l[0][1], c.lang), kurTxt = slip.l[1][1], arr = parse(slip.l[3][1], c.lang);
    const km = /^(\d+) \S+ = ([\d.,]+)$/.exec(kurTxt.replace(/[₺$€£¥](?=\d)/, '')), kur = km ? +km[2].replace(',', '.') / +km[1] : NaN;
    const same = B.CUR_OF[c.r] === B.CUR_OF[c.other], cost = B.costMult(same);
    ok(sent > 0 && arr > 0 && Math.abs(arr / (sent * (same ? 1 : kur) * cost) - 1) < 0.1, `aktar: gönderilen ${slip.l[0][1]} × kur (${kurTxt}) × ${cost.toFixed(4)} = varacak ${slip.l[3][1]}`);
    const inRatio = (arr / B.PL[c.other]) / (sent / B.PL[c.r]), lev = B.unitTry(c.r) / B.unitTry(c.other);
    ok(Math.abs(inRatio / (lev * cost) - 1) < 0.1 && (c.r === 'tr' ? inRatio < 0.3 : inRatio > 3.5), `iç birim oranı ${inRatio.toFixed(3)} ≈ seviye oranı ${lev.toFixed(3)} × maliyet (${c.r === 'tr' ? 'pahalı ülkeye giden para daha az' : 'ucuz ülkeye giden para daha çok'} iç birim)`);
    ok(!kurus(slip.all).length, 'banka aktar panelinde kuruş yok ' + JSON.stringify(kurus(slip.all)));
    await p.evaluate(() => document.querySelector('#sheetBody .bk-slip').scrollIntoView({ block: 'center' })); await p.waitForTimeout(150);
    await p.screenshot({ path: out + `fiyat-${c.r}-aktar.png` });

    /* 4) bilanço: kendi parasıyla ve başka parayla */
    await tapS(p, '#sheetBody [data-a="tab"][data-v="bil"]', 500);
    const my = B.CUR_OF[c.r], alt = my === 'USD' ? 'TRY' : 'USD';
    const big = () => p.evaluate(() => document.querySelector('#sheetBody .bk-big b').textContent);
    const sv = await saves(p); sv[c.r] = await p.evaluate(() => JSON.parse(JSON.stringify(window.__tapuState())));
    const tn = await p.evaluate(() => Date.now());
    const b1 = await big(), t1 = B.total(sv, my, tn), v1 = parse(b1, c.lang);
    ok(Math.abs(v1 / (t1.sum + t1.pend) - 1) < 0.02, `bilanço (${my}): panel ${b1} ≈ bağımsız hesap ${Math.round(t1.sum + t1.pend)}`);
    const own = B.valueOf(sv[c.r]).net * B.PL[c.r], oth = B.valueOf(sv[c.other]).net * B.PL[c.other] * B.tryPer(B.CUR_OF[c.other]) / B.tryPer(my);
    ok(Math.abs(v1 / (own + oth) - 1) < 0.04, `bilanço gerçek değerlerle: bu bölge (iç × ${B.PL[c.r]}) + ${c.other} (iç × ${B.PL[c.other]}, kurla) ≈ ${b1}`);
    const sheetTxt = await p.evaluate(() => document.querySelector('#sheetBody').innerText);
    ok(!kurus(sheetTxt).length, 'bilançoda kuruş yok ' + JSON.stringify(kurus(sheetTxt)));
    await p.screenshot({ path: out + `fiyat-${c.r}-bilanco.png` });
    await tapS(p, `#sheetBody [data-a="cur"][data-v="${alt}"]`, 400);
    const b2 = await big(), v2 = parse(b2, c.lang), fx = B.tryPer(my) / B.tryPer(alt);
    ok(Math.abs(v2 / v1 / fx - 1) < 0.04, `para birimi ${alt} seçilince doğru çevrim: ${b1} → ${b2} (taban kur ${fx.toPrecision(4)})`);
    await p.keyboard.press('Escape'); await p.clock.runFor(400);
    ok(!p.errs.length, 'konsol temiz' + (p.errs.length ? ' [' + p.errs.slice(0, 2).join('|') + ']' : ''));
    await ctx.close();
  }
  console.log('\nÜlkeler arası');
  const ys = Object.values(yields);
  ok(ys.every(y => Math.abs(y / ys[0] - 1) < 0.01), 'kira/fiyat oranı (getiri) her ülkede aynı: ' + JSON.stringify(Object.fromEntries(Object.entries(yields).map(([k, v]) => [k, +v.toFixed(4)]))));
  const x = r => firstUsd[r] / firstUsd.tr;
  ok(x('us') >= 8 && x('us') <= 10 && x('uk') >= 9 && x('uk') <= 11 && x('de') >= 6 && x('de') <= 8 && x('jp') >= 4 && x('jp') <= 6, 'ilk evin $ karşılığı Türkiye’ye oranı: ' + ['us', 'uk', 'de', 'jp', 'gl'].map(r => r + ' ' + x(r).toFixed(2) + '×').join(' · '));
  await b.close();
  const bad = results.filter(r => !r.pass);
  console.log(`\nSONUÇ: ${results.length - bad.length}/${results.length}` + (bad.length ? ' · KALAN: ' + bad.map(r => r.name).join(' | ') : ' · hepsi geçti'));
  process.exit(bad.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
