// Uçtan uca testlerin ortak yardımcıları (qa, gelir, yerel, yon, audit, iyilestirme).
// Her test kendi akışını korur; burada yalnızca tekrar eden küçük parçalar var.
const path = require('path'), fs = require('fs'), http = require('http');

/** Önizleme paketi (npm run build:preview / vite build --mode preview) klasörü; testler bunu http üzerinden açar. */
const DIST = path.resolve(__dirname, '../dist-preview');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8' };
/** dist-preview'u 127.0.0.1'de rastgele boş bir portta servis eden küçük statik sunucu başlatır, sayfa adresini döner.
 *  (file:// yerine http: başsız Chromium'da file:// kökeninde localStorage yeniden yüklemede ara ara boşalıyordu.)
 *  Sunucu süreci canlı tutmaz (unref) ve süreç çıkarken kapanır; her bağlam (newContext) kendi deposuyla yalıtılır. */
async function serve() {
  if (!fs.existsSync(path.join(DIST, 'index.html'))) throw new Error('dist-preview/index.html yok: önce vite build --mode preview');
  const server = http.createServer((req, res) => {
    let rel; try { rel = decodeURIComponent(new globalThis.URL(req.url, 'http://x').pathname); } catch { res.writeHead(400).end(); return; }
    if (rel.endsWith('/')) rel += 'index.html';
    const f = path.join(DIST, path.normalize(rel));
    if (!f.startsWith(DIST + path.sep)) { res.writeHead(403).end(); return; }
    fs.readFile(f, (err, buf) => {
      if (err) { res.writeHead(404, { 'Content-Type': 'text/plain' }).end('yok'); return; }
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(f).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      res.end(req.method === 'HEAD' ? undefined : buf);
    });
  });
  await new Promise((ok, no) => { server.once('error', no); server.listen(0, '127.0.0.1', ok); });
  server.unref();
  process.once('exit', () => server.close());
  return `http://127.0.0.1:${server.address().port}/index.html`;
}
/** Ekran görüntüleri ve ölçümler: tests/out/ */
const OUT_DIR = path.resolve(__dirname, 'out'); fs.mkdirSync(OUT_DIR, { recursive: true });
const out = OUT_DIR + '/';
/** İlk açılış akışını (dil → bölge) atlayan tercihler: Türkçe · Türkiye. PREF_IF: tercih yoksa yazar (yeniden yüklemede korunur). */
const PREF = "localStorage.setItem('tapu-prefs',JSON.stringify({lang:'tr',region:'tr',ent:{},news:true}));";
const PREF_IF = "if(!localStorage.getItem('tapu-prefs'))" + PREF;

/** Öğe görünür mü (sayfa kapanırken hata vermez). */
const vis = (p, sel) => p.isVisible(sel).catch(() => false);
/** Oyun durumunun kopyası (önizleme paketindeki window.__tapuState). */
const state = p => p.evaluate(() => JSON.parse(JSON.stringify(window.__tapuState())));
/** Durum kopyası + o anki (sahte) saat: o._now. */
const stateNow = p => p.evaluate(() => { const o = JSON.parse(JSON.stringify(window.__tapuState())); o._now = Date.now(); return o; });
/** Sayfadaki canlı durumu değiştirir: f(S, a) sayfada çalışır. */
const mut = (p, f, a) => p.evaluate(([f, a]) => { (0, eval)('(' + f + ')')(window.__tapuState(), a); }, [f.toString(), a]);

/** Basit denetim: ok(koşul, ad) yazdırır, başarısızları fails'e ekler. */
function checker() { const fails = []; return { fails, ok: (c, m) => { if (!c) fails.push(m); console.log(c ? '  ✓' : '  ✗', m); } }; }
/** Sonuç listesine yazan denetim ({...extra(), name, pass}); audit bölüm adını extra ile ekler. */
function recorder(results, extra) { return (c, m) => { results.push({ ...(extra ? extra() : {}), name: m, pass: !!c }); console.log(c ? '  ✓' : '  ✗', m); }; }

/** Dokunma: zorla tıklar; fallback ise tıklanamazsa (örtülü/ekran dışı) DOM click; sonra sahte saat (run ms) ve gerçek bekleme (wait ms). */
function makeTap({ run = 0, wait = 0, fallback = false, timeout } = {}) {
  return async (p, sel) => {
    const o = timeout ? { force: true, timeout } : { force: true };
    if (fallback) await p.click(sel, o).catch(() => p.$eval(sel, e => e.click())); else await p.click(sel, o);
    if (run) await p.clock.runFor(run);
    if (wait) await p.waitForTimeout(wait);
  };
}
/** Açık kartları kapatır (en çok n kart): varsa ikincil düğme (.txt), yoksa ilk düğme. safe: tıklama hatası yutulur. */
async function dismissCards(p, { n, run = 0, wait = 0, safe = true }) {
  const seen = safe ? s => vis(p, s) : s => p.isVisible(s);
  for (let k = 0; k < n && await seen('#modal .card'); k++) {
    const c = p.click(await seen('#modal .card .txt') ? '#modal .card .txt' : '#modal .card [data-a]', { force: true });
    if (safe) await c.catch(() => {}); else await c;
    if (run) await p.clock.runFor(run);
    if (wait) await p.waitForTimeout(wait);
  }
}

/** Kaydı bir sonraki yüklemede, oyun başlamadan yerleştirir ve sayfayı yeniler. Doğrudan localStorage + reload yarışlı:
 *  oyunun pagehide → persistSync'i test kaydını ezebilir. Durum sessionStorage'a konur, ilk betik (init script) yeni
 *  sayfada oyun açılmadan önce kayda yazar. state verilmezse sayfadaki canlı durum kullanılır. */
async function injectReload(p, state) {
  if (state === undefined) await p.evaluate(() => sessionStorage.setItem('__inj', JSON.stringify(window.__tapuState())));
  else await p.evaluate(v => sessionStorage.setItem('__inj', JSON.stringify(v)), state);
  if (!p.__injHook) { p.__injHook = 1; await p.addInitScript(() => { const v = sessionStorage.getItem('__inj'); if (v) { sessionStorage.removeItem('__inj'); localStorage.setItem('tapu-save-v2', v); } }); }
  await p.reload();
}

module.exports = { serve, OUT_DIR, out, PREF, PREF_IF, vis, state, stateNow, mut, checker, recorder, makeTap, dismissCards, injectReload };
