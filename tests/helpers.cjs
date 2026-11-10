// Uçtan uca testlerin ortak yardımcıları (qa, gelir, yerel, yon, audit, iyilestirme).
// Her test kendi akışını korur; burada yalnızca tekrar eden küçük parçalar var.
const path = require('path'), fs = require('fs');

/** Önizleme paketi (npm run build:preview / vite build --mode preview). */
const URL = 'file://' + path.resolve(__dirname, '../dist-preview/index.html');
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

/** Sayfayı yeniler; localStorage içeriği (tercihler, kayıtlar) yeni belgeye oyun açılmadan taşınır. Başsız Chromium'da
 *  file:// sayfasında oyun oturumu sırasında tarayıcı tarafındaki localStorage ara ara boşalıyor (sayfanın kendi önbelleği
 *  dolu göründüğü için fark edilmiyor); yenilenen belge boş depoyla açılınca tercih (tema) ve kayıt kaybolur, ilk açılış
 *  akışı başlar. Oyun localStorage'ı hiçbir zaman toptan silmez; bu bir test ortamı sorunudur. Yeni belgede kayıt
 *  anahtarı yoksa yenilemeden hemen önceki içerik geri yazılır (kayıt varsa hiçbir şey yapılmaz). */
async function reloadKeep(p) {
  const snap = await p.evaluate(() => { const o = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); o[k] = localStorage.getItem(k); } return o; });
  await p.addInitScript(s => { if (localStorage.getItem('tapu-save-v2')) return; for (const k of Object.keys(s)) localStorage.setItem(k, s[k]); }, snap);
  await p.reload();
}

module.exports = { URL, OUT_DIR, out, PREF, PREF_IF, vis, state, stateNow, mut, checker, recorder, makeTap, dismissCards, injectReload, reloadKeep };
