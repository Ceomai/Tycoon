// Senaryoların ortak parçaları: orta oyun tohumu, kayıt karşılaştırma (yeniden yükleme), günlük denetim.
const L = require('./lib.cjs');

/** Orta oyun: Kadıköy dolu (sol üst 2×2 Sv5: proje adayı), Beşiktaş yarım, tüm türler açık. Ekonomi doğal ilerler. */
function seedMid(S, o) {
  const k0 = S.cur, k1 = k0.replace(/-0$/, '-1');
  const T = ['ev', 'kafe', 'kafe', 'dukkan', 'ev', 'kafe', 'dukkan', 'ev', 'kafe', 'dukkan'];
  S.d[k0] = Array.from({ length: 20 }, (_, i) => ({ t: T[i % 10], lvl: [0, 1, 4, 5].includes(i) ? 5 : 3 + (i % 2), buf: 0, until: 0, dur: 1, up: false }));
  S.d[k1] = Array.from({ length: 20 }, (_, i) => (i < 6 ? { t: i % 2 ? 'kafe' : 'ev', lvl: 1 + (i % 2), buf: 0, until: 0, dur: 1, up: false } : null));
  S.own = [k0, k1]; S.cash = o.cash || 60000; S.earned = o.earned || 900000; S.seen = { ev: true, kafe: true, dukkan: true, ofis: true };
  S.collects = 120; S.guideHint = true; S.cards = Object.keys(S.d); S.week.earned = 0; S.lien = {}; S.lienT = {};
}

/** Kayıt karşılaştırma anahtarı: yeniden yüklemede aynı kalması gerekenler. */
const keyOf = () => { const S = window.__tapuState(), a = S.ihale.cur;
  const sk = o => JSON.stringify(Object.keys(o || {}).sort().map(k => [k, o[k]]));
  return { WmE: S.cash + (a && !a.done ? a.held : 0) - S.earned, cash: S.cash, W: S.cash + (a && !a.done ? a.held : 0), earned: S.earned, own: S.own.join(), cur: S.cur,
    lots: Object.fromEntries(Object.entries(S.d).map(([k, v]) => [k, v.map(q => (q ? [q.t, q.lvl, q.up, q.until, q.sp || '', q.ob || ''].join(',') : '-')).join('|')])),
    ten: S.ten.map(x => ({ id: x.id, k: x.k, i: x.i, st: x.st, end: x.end, dl: x.dl, c: x.c || '' })),
    pj: JSON.stringify(S.pj), ih: JSON.stringify({ cur: a && { id: a.id, my: a.my, held: a.held, done: a.done || '', paid: a.paid || 0, cap: a.cap }, got: S.ihale.got, kose: S.ihale.kose, kp: S.ihale.kp, wins: S.ihale.wins, losses: S.ihale.losses }),
    bank: JSON.stringify({ out: S.bank.out, in: S.bank.in, day: S.bank.day, ep: S.bank.ep }), week: JSON.stringify(S.week), shares: S.shares, tdef: sk(S.tdef), tdc: sk(S.tdc), lien: JSON.stringify(S.lien), playMs: S.playMs, now: Date.now() }; };
function diffKeys(a, b) {
  const d = [];
  for (const k of Object.keys(a)) {
    if (k === 'playMs' || k === 'now') continue;
    if (k === 'ten') { const A = JSON.stringify(a.ten.map(x => ({ ...x, dl: Math.round(x.dl / 1e4), end: Math.round(x.end / 1e4) }))), B = JSON.stringify(b.ten.map(x => ({ ...x, dl: Math.round(x.dl / 1e4), end: Math.round(x.end / 1e4) }))); if (A !== B) d.push(['kiracılar', A, B]); continue; }
    if (k === 'cash' || k === 'earned' || k === 'W' || k === 'WmE') { if (Math.abs(a[k] - b[k]) > 1e-6 * Math.max(1, a[k])) d.push([k, a[k], b[k]]); continue; }
    if (k === 'lots') { for (const kk of new Set([...Object.keys(a.lots), ...Object.keys(b.lots)])) if (a.lots[kk] !== b.lots[kk]) {
      // arada süresi dolan inşaat (until ≤ şimdi) bitmiş olabilir: o arsalar sayılmaz
      const A = (a.lots[kk] || '').split('|'), B = (b.lots[kk] || '').split('|');
      const bad = A.map((x, i) => [x, B[i], i]).filter(([x, y]) => { if (x === y) return false; const u = x && x !== '-' ? +x.split(',')[3] : 0; return !(u && u <= b.now + 1000); });
      if (bad.length) d.push(['arsalar ' + kk, bad.map(z => z[2] + ':' + z[0]).join(' '), bad.map(z => z[2] + ':' + z[1]).join(' ')]);
    } continue; }
    if (JSON.stringify(a[k]) !== JSON.stringify(b[k])) d.push([k, a[k], b[k]]);
  }
  return d;
}
const snapKey = p => p.evaluate(keyOf);

/** Sayfayı yeniler (pagehide → kayıt) ve kaydın aynı geldiğini denetler. Döner: fark listesi. */
async function reloadCheck(p) {
  await L.closeAll(p);
  const a = await snapKey(p);
  await p.reload(); await L.boot(p);
  const b = await snapKey(p), d = diffKeys(a, b);
  // kazanç (görev/hedef ödülü açılış adımında) kasa ve kazancı birlikte artırabilir: WmE değişmediyse sayılmaz
  return d.some(x => x[0] === 'WmE') ? d : d.filter(x => !['cash', 'W', 'earned'].includes(x[0]));
}
/** Lig sayacı: Δhafta ≤ Δkazanç (hafta değişmediyse). */
function leagueOk(m0, m1) { if (m0.wkKey !== m1.wkKey) return true; return m1.wk - m0.wk <= (m1.earned - m0.earned) * (1 + 1e-9) + 1e-6; }

/** Kapanış → açılış arasında (saat ilerledi) beklenen farkları ayıklar: biten inşaat, ihalenin kapanması/açılması (emanet kasaya). */
function tenNorm(j) { return JSON.stringify(JSON.parse(j).map(x => ({ ...x, st: x.st === 'ready' ? 'wait' : x.st }))); }
function offlineFilter(df) {
  df = df.filter(x => !(x[0] === 'kiracılar' && tenNorm(x[1]) === tenNorm(x[2]))); // çevrimdışı biten inşaat isteği karşılamış olabilir
  // süren ihalede emanet/vekâlet arada değişebilir (son düzlükte rakip yükselir: settle) — kasa+emanet (W) ayrıca denetlenir
  const ihNorm = j => { const o = JSON.parse(j); if (o.cur && !o.cur.done) { delete o.cur.held; delete o.cur.my; } return JSON.stringify(o); };
  df = df.filter(x => !(x[0] === 'ih' && ihNorm(x[1]) === ihNorm(x[2])));
  const ihChanged = df.some(x => x[0] === 'ih' && (() => { const A = JSON.parse(x[1]), B = JSON.parse(x[2]); return !A.cur || !B.cur || A.cur.id !== B.cur.id || A.cur.done !== B.cur.done; })());
  // ihale arada kazanıldıysa kasa−kazanç tam ödenen bedel kadar düşer
  const ih = df.find(x => x[0] === 'ih'), wme = df.find(x => x[0] === 'WmE');
  if (ih && wme) { const A = JSON.parse(ih[1]), B = JSON.parse(ih[2]); const paid = B.cur && B.cur.done === 'won' && (!A.cur || A.cur.id !== B.cur.id || A.cur.done !== 'won') ? B.cur.paid : 0;
    if (Math.abs((wme[2] - wme[1]) + paid) <= 1e-6 * Math.max(1, Math.abs(wme[1]))) df = df.filter(x => x !== wme); else wme.push('beklenen Δ=' + (-paid)); }
  return df.filter(x => !/^arsalar/.test(x[0]) && !(x[0] === 'ih' && ihChanged) && !(x[0] === 'cash' && ihChanged && !df.some(y => y[0] === 'W')) && x[0] !== 'pj' && !(x[0] === 'week') && !['cash', 'W', 'earned', 'tdef', 'tdc'].includes(x[0]));
}
module.exports = { offlineFilter, seedMid, keyOf, diffKeys, snapKey, reloadCheck, leagueOk };

/** Tüm bölge kayıtları (localStorage; sağlamalı ya da düz biçim). */
const saves = p => p.evaluate(() => { const o = {}; for (const r of ['tr', 'us', 'uk', 'de', 'jp', 'gl']) { const v = localStorage.getItem(r === 'tr' ? 'tapu-save-v2' : 'tapu-save-v2-' + r); try { o[r] = v ? (x => (typeof x.j === 'string' ? JSON.parse(x.j) : x))(JSON.parse(v)) : null; } catch { o[r] = 'BOZUK'; } } return o; });
/** Ayarlar → bölge (sayfa yenilenir). */
async function setRegion(q, r) {
  await L.closeAll(q); await L.tap(q, '#menuBtn', 500); await L.tap(q, '#sheetBody .drow[data-a="set"]', 600);
  await Promise.all([q.waitForEvent('load', { timeout: 15000 }).catch(() => {}), L.clk(q, `#sheetBody [data-a="region"][data-r="${r}"]`)]);
  await L.boot(q);
}
/** Başlanmış bir bölge kaydını doğrudan yazar (düz biçim; sanitize temizler). */
const seedRegion = (p, r, city, o = {}) => p.evaluate(([r, city, o]) => { const S = JSON.parse(JSON.stringify(window.__tapuState())), k = city + '-0';
  S.city = city; S.own = [k]; S.cur = k; S.d = { [k]: S.d[S.cur] || Array(20).fill(null) }; S.cash = o.cash || 1000; S.earned = 0; S.bank = { rate: o.rate || 100, ep: r + 'ep', in: [], out: [], day: { k: '', got: 0 }, log: [], tip: '' };
  S.ten = []; S.pj = {}; S.ihale = { cur: null, rm: {}, got: [], kose: [], kp: 0, intro: true, wins: 0, losses: 0 }; S.lien = {}; S.lienT = {};
  localStorage.setItem('tapu-save-v2-' + r, JSON.stringify(S)); }, [r, city, o]);
module.exports.saves = saves; module.exports.setRegion = setRegion; module.exports.seedRegion = seedRegion;
