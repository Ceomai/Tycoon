// GERÇEKÇİ OYUNCU DÖNGÜSÜ — yalnız arayüzden (dokunuş) oynar; her para hareketi saat dururken ölçülür (lib.measured)
// ve ekrandaki fiyatla karşılaştırılır. Kararlar sayfadaki durumdan okunur.
const L = require('./lib.cjs');

/** Sorun kaydı (senaryo raporu). */
function issues() { const list = [], notes = {}; return { list, notes, note: (k, m) => { notes[k] = notes[k] || { n: 0, ex: [] }; notes[k].n++; if (notes[k].ex.length < 5) notes[k].ex.push(m); }, add: (kind, msg, extra) => { list.push({ kind, msg, ...(extra || {}) }); console.log('  ✗', kind, msg); } }; }
const scale = p => p.evaluate(() => { const s = getComputedStyle(document.documentElement).getPropertyValue('--cur'); return s; });

/** Ekrandaki fiyatla harcamayı karşılaştırır. Bedel gösterimi yukarı yuvarlı (format.ts fmtCost): kasadan çıkan ekrandakinden
 *  fazla olamaz, en çok bir gösterim basamağı (birimli <100: 0,1; değilse 1) az olabilir. sc: bölgenin fiyat seviyesi. */
function priceOk(I, what, txt, spend, sc = L.PL.tr) {
  const hi = L.parseMoney(txt, sc), lo = L.parseMoney(txt, sc, false, true);
  if (!Number.isFinite(hi) || hi <= 0) return;
  if (!(spend <= hi * 1.001 + 1e-9 && spend >= lo * 0.999 - 1e-9)) I.add('fiyat', `${what}: ekranda "${(txt.match(/[₺$€£¥][\d.,]+\s?\S*/) || [txt])[0]}" yazıyor, kasadan ${Math.round(spend)} çıktı`);
}

class Player {
  constructor(p, Lg, I, o = {}) { this.p = p; this.L = Lg; this.I = I; this.sc = o.sc || L.PL.tr; this.stats = { collect: 0, build: 0, up: 0, buy: 0, key: 0, pj: 0, pj2: 0, bid: 0, kose: 0, bank: 0 }; this.auc = o.auc || (() => 'win'); }
  setPage(p) { this.p = p; }
  async plan() {
    return this.p.evaluate(() => {
      const S = window.__tapuState(), lots = S.d[S.cur] || [], T = window.__tapuTest;
      const nb = i => { const c = i % 4, r = []; if (i >= 4) r.push(i - 4); if (i + 4 < 20) r.push(i + 4); if (c > 0) r.push(i - 1); if (c < 3) r.push(i + 1); return r; };
      const pjCells = new Set(); for (const q of (S.pj[S.cur] || [])) [q.a, q.a + 1, q.a + 4, q.a + 5].forEach(j => pjCells.add(j));
      const ten = S.ten.map(x => ({ id: x.id, k: x.k, i: x.i, st: x.st, w: x.w, free: nb(x.i).filter(j => !(S.d[x.k] || [])[j]) }));
      const empty = lots.map((q, i) => q ? -1 : i).filter(i => i >= 0);
      const prod = lots.map((q, i) => ({ q, i })).filter(x => x.q && !x.q.ob && !x.q.sp && x.q.lvl >= 1 && !x.q.until && x.q.lvl < 5 && !pjCells.has(x.i)).sort((a, b) => a.q.lvl - b.q.lvl);
      const ob = lots.map((q, i) => (q && q.ob ? i : -1)).filter(i => i >= 0);
      const a = S.ihale.cur;
      return { cur: S.cur, own: S.own, cash: S.cash, lien: !!S.lien[S.cur], ten, empty, prod: prod.map(x => x.i), ob, collectMode: S.collectMode,
        pending: S.own.reduce((s, k) => s + (S.d[k] || []).reduce((t, q) => t + (q ? q.buf : 0), 0), 0), rate: T.totalRate(),
        ih: a && !a.done && Date.now() < a.close ? { id: a.id, my: a.my, kind: a.kind, adv: T.ihale.advice(a) } : null, kp: S.ihale.kp,
        pjs: (S.pj[S.cur] || []).map(q => ({ a: q.a, st: q.st, until: q.until })), lv5: lots.map((q, i) => (q && q.lvl === 5 && !q.until && !pjCells.has(i) ? i : -1)).filter(i => i >= 0) };
    });
  }
  /** Bir oyuncu "dokunuş turu": kart → topla → kiracı → köşe başı → ihale → proje → semt → inşaat/kat. */
  async turn(o = {}) {
    const { p, L: Lg } = this;
    await this.handleCards();
    let pl = await this.plan();
    if (pl.collectMode === 'tap' && pl.pending > Math.max(5, pl.rate * 20)) await this.collect();
    pl = await this.plan();
    await this.tenants(pl);
    if (pl.kp > 0) await this.kose();
    let saving = false;
    if (pl.ih && o.auction !== false) {
      const mode = this.auc(pl.ih);
      if (!pl.ih.my || (mode === 'win' && pl.ih.my < pl.ih.adv)) await this.bid(pl.ih);
      pl = await this.plan();
      saving = mode === 'win' && pl.ih && pl.ih.my < pl.ih.adv; // kazanmak isteyen oyuncu vekâleti yükseltmek için biriktirir
    }
    pl = await this.plan();
    if (saving) { await L.closeAll(p); return; }
    if (o.pj !== false) await this.project();
    pl = await this.plan();
    if (o.buy !== false) await this.buyDistrict();
    pl = await this.plan();
    for (let n = 0; n < (o.builds || 2); n++) { pl = await this.plan(); if (!(await this.buildOrUp(pl))) break; }
    await L.closeAll(p);
  }
  async handleCards() {
    const p = this.p;
    for (let k = 0; k < 6; k++) {
      if (await L.adClose(p)) { this.stats.ad = (this.stats.ad || 0) + 1; continue; }
      const c = await p.evaluate(() => { const m = document.querySelector('#modal'); if (m.hidden) return null; const card = m.querySelector('.card'); return card ? { cls: card.className, h: (card.querySelector('h3') || {}).textContent || '' } : null; });
      if (!c) return;
      if (/ih-res/.test(c.cls)) { // ihale sonucu: kazandıysa "Arsayı seç"/"İhale salonuna koy"
        await L.measured(p, this.L, 'ihale-sonuç', async () => { await L.clk(p, '#modal [data-a="ok"]'); await p.clock.runFor(500); });
        await this.kose(); await L.closeAll(p); continue;
      }
      await L.measured(p, this.L, 'kart:' + c.h.slice(0, 24), async () => { await L.cards(p, 1); });
    }
  }
  async collect() {
    const { p } = this;
    const r = await L.measured(p, this.L, 'topla', async () => { await L.closeAll(p); await L.clk(p, '#collectBtn'); await p.clock.runFor(300); });
    if (Math.abs(r.spend) > Math.max(1e-6, 1e-12 * r.a.cash)) this.I.add('defter', 'TOPLA kasadan para düşürdü/ekledi (kazanç dışı): ' + r.spend);
    this.stats.collect++;
  }
  async gotoDistrict(k) {
    const { p } = this; const cur = await p.evaluate(() => window.__tapuState().cur); if (cur === k) return true;
    await L.closeAll(p); await L.tap(p, '#mapBtn', 500);
    const ok = await p.$(`#sheetBody [data-a="go"][data-k="${k}"]`); if (!ok) { await L.closeAll(p); return false; }
    await L.clk(p, `#sheetBody [data-a="go"][data-k="${k}"]`); await p.clock.runFor(500); await L.closeAll(p);
    return (await p.evaluate(() => window.__tapuState().cur)) === k;
  }
  async build(i, type, opened = false) {
    const { p } = this; if (!opened) await L.openTile(p, i);
    const sel = type ? `#sheetBody [data-a="build"][data-t="${type}"]:not([disabled])` : '#sheetBody [data-a="build"]:not([disabled])';
    const all = await p.$$(sel); if (!all.length) { await L.closeAll(p); return false; }
    const btn = all[all.length - 1], shown = await btn.$eval('.bp', e => e.textContent).catch(() => '');
    const r = await L.measured(p, this.L, 'inşaat', async () => { await L.clk(p, btn); await p.clock.runFor(300); });
    priceOk(this.I, 'inşaat', shown, r.spend, this.sc); this.stats.build++; await L.closeAll(p); return r.spend > 0;
  }
  async upgrade(i, opened = false) {
    const { p } = this; if (!opened) await L.openTile(p, i);
    const b = await p.$('#sheetBody [data-a="up"]:not([disabled])'); if (!b) { await L.closeAll(p); return false; }
    const shown = await b.textContent();
    const ctx0 = await p.evaluate(() => { const h = document.querySelector('#sheetBody h3'); return (h ? h.textContent : '') + ' · ' + ((document.querySelector('#sheetBody .sh-t p') || {}).textContent || ''); });
    const r = await L.measured(p, this.L, 'kat', async () => { await L.clk(p, b); await p.clock.runFor(300); });
    if (r.spend <= 0) { this.I.add('kat', `"Kat çık" etkin ama dokununca bir şey olmadı: ${ctx0} · düğme "${shown.trim().slice(0, 40)}" · kasa ${Math.round(r.a.cash)}`); await p.screenshot({ path: L.OUT + '/kat-noop.png' }).catch(() => {}); }
    else priceOk(this.I, 'kat çık', shown, r.spend, this.sc); this.stats.up++; await L.closeAll(p); return r.spend > 0;
  }
  async buildOrUp(pl) {
    if (pl.empty.length && !pl.lien) { for (const i of pl.empty.slice(0, 3)) if (await this.build(i)) return true; }
    for (const i of pl.prod.slice(0, 3)) if (await this.upgrade(i)) return true;
    return false;
  }
  async tenants(pl) {
    const { p } = this;
    for (const x of pl.ten) {
      if (x.st === 'live') continue;
      if (!(await this.gotoDistrict(x.k))) continue;
      if (x.st === 'ready') { // hazır kiracı: karoya dokunmak anahtarı verir (ya da panelde "Anahtarı ver")
        const r0 = await L.measured(p, this.L, 'anahtar', async () => { await L.openTile(p, x.i); });
        const st = await p.evaluate(id => (window.__tapuState().ten.find(t => t.id === id) || {}).st, x.id);
        if (Math.abs(r0.spend) > 1e-6) this.I.add('defter', 'anahtar teslimi para hareketi yaptı: ' + r0.spend);
        if (st === 'live') { this.stats.key++; await L.closeAll(p); continue; }
      } else await L.openTile(p, x.i); // kiracılı arsa: kiracı paneli açılır
      if (x.st === 'ready') {
        const b = await p.$('#sheetBody [data-a="key"]') || await p.$('#sheetBody [data-a="tkey"]');
        if (b) { const r = await L.measured(p, this.L, 'anahtar', async () => { await L.clk(p, b); await p.clock.runFor(400); }); if (Math.abs(r.spend) > 1e-6) this.I.add('defter', 'anahtar teslimi para hareketi yaptı: ' + r.spend); this.stats.key++; }
        else this.I.add('kiracı', `hazır kiracının panelinde "Anahtarı ver" yok (${x.k}:${x.i})`);
        await L.closeAll(p); continue;
      }
      const go = await p.$('#sheetBody [data-a="go"]');
      if (go) { await L.clk(p, go); await p.clock.runFor(500); }
      const w = x.w;
      if (w.k === 'lvl') await this.upgrade(x.i, true);
      else await this.build(-1, w.k === 'quiet' ? 'ev' : w.t, true);
      await L.closeAll(p);
    }
  }
  async kose() {
    const { p } = this;
    if (!(await p.evaluate(() => window.__tapuState().ihale.kp > 0))) return;
    if (!(await L.sheetOn(p)) || !(await p.$('#sheetBody .ks-grid'))) { await L.closeAll(p); await p.evaluate(() => window.__tapuTest.openSheet({ k: 'kose' })); await p.clock.runFor(500); }
    // en çok kira getiren arsa
    const i = await p.evaluate(() => { const c = [...document.querySelectorAll('#sheetBody .ks-cell:not(.em)')]; return c.length ? +c[Math.floor(c.length / 2)].dataset.i : -1; });
    if (i < 0) { await L.closeAll(p); return; }
    await L.tap(p, `#sheetBody .ks-cell[data-i="${i}"]`, 300);
    const r = await L.measured(p, this.L, 'köşe', async () => { await L.tap(p, '#sheetBody [data-a="stamp"]', 600); });
    if (Math.abs(r.spend) > 1e-6) this.I.add('defter', 'köşe başı damgası para hareketi yaptı: ' + r.spend);
    this.stats.kose++; await L.closeAll(p);
  }
  async bid(ih) {
    const { p } = this, mode = this.auc(ih);
    await L.closeAll(p);
    if (!(await L.H.vis(p, '#ihalePill'))) { this.I.add('ihale', 'açık ihale var ama tahtada hap görünmüyor: ' + ih.id); return; }
    await L.tap(p, '#ihalePill', 500);
    if (await L.modalOn(p)) { await L.clk(p, '#modal [data-a="go"]').catch(() => {}); await p.clock.runFor(600); }
    if (!(await p.$('#sheetBody [data-a="give"]'))) { await L.closeAll(p); return; }
    if (mode === 'win') await L.tap(p, '#sheetBody [data-a="adv"]', 300);
    else { // panel önerilen vekâletle açılır: önce en düşüğe in
      for (let k = 0; k < 200 && !(await p.$eval('#sheetBody [data-a="dn"]', b => b.disabled)); k++) await L.tap(p, '#sheetBody [data-a="dn"]', 30);
    }
    if (mode === 'pass') { // son düzlükte geçilecek kadar: rakibin erken sınırının 2 adım üstü
      const n = await p.evaluate(() => { const a = window.__tapuState().ihale.cur, T = window.__tapuTest.ihale; const early = T.rivalMax(a, Date.now()); return Math.max(1, Math.round((early + 2 * a.step - T.minProxy(a, Date.now())) / a.step)); });
      for (let k = 0; k < Math.min(n, 40); k++) await L.tap(p, '#sheetBody [data-a="up"]', 60);
    } // 'lose': en düşük vekâlet
    const dis = await p.$eval('#sheetBody [data-a="give"]', b => b.disabled);
    if (dis) { // kasa yetmiyorsa en düşük vekâlet
      for (let k = 0; k < 60 && await p.$eval('#sheetBody [data-a="give"]', b => b.disabled) && !(await p.$eval('#sheetBody [data-a="dn"]', b => b.disabled)); k++) await L.tap(p, '#sheetBody [data-a="dn"]', 60);
    }
    const r = await L.measured(p, this.L, 'vekâlet', async () => { await L.tap(p, '#sheetBody [data-a="give"]', 500); });
    if (Math.abs(r.spend) > 1e-6) this.I.add('defter', 'vekâlet kasa+emanet toplamını değiştirdi: ' + r.spend);
    this.stats.bid++; await L.closeAll(p);
  }
  async project() {
    const { p } = this;
    const cand = await p.evaluate(() => { const S = window.__tapuState(); return S.own.map(k => { const lots = S.d[k] || [], pjs = S.pj[k] || [], cells = new Set(); pjs.forEach(q => [q.a, q.a + 1, q.a + 4, q.a + 5].forEach(j => cells.add(j)));
      return { k, pjs: pjs.map(q => ({ a: q.a, st: q.st, until: q.until })), lv5: lots.map((q, i) => (q && q.lvl === 5 && !q.until && !q.sp && !cells.has(i) ? i : -1)).filter(i => i >= 0), lien: !!S.lien[k] }; }); });
    for (const c of cand) {
      const s2 = c.pjs.filter(q => q.st === 1 && !q.until);
      if (!s2.length && (c.pjs.length >= 2 || c.lv5.length < 4 || c.lien)) continue;
      if (!(await this.gotoDistrict(c.k))) continue;
      for (const q of s2) { // 2. etap
        await L.openTile(p, q.a);
        const b = await p.$('#sheetBody [data-a="pj2"]:not([disabled])');
        if (b) { const shown = await b.textContent(); const r = await L.measured(p, this.L, 'proje-2', async () => { await L.clk(p, b); await p.clock.runFor(500); }); priceOk(this.I, 'proje 2. etap', shown, r.spend, this.sc); this.stats.pj2++; }
        await L.closeAll(p);
      }
      if (c.pjs.length >= 2 || c.lv5.length < 4 || c.lien) continue;
      for (const i of c.lv5.slice(0, 6)) {
        await L.openTile(p, i);
        if (!(await p.$('#sheetBody [data-a="pj"]'))) { await L.closeAll(p); continue; }
        await L.tap(p, '#sheetBody [data-a="pj"]', 500);
        const fr = await p.$$('#grid .pjframe .pjf-l');
        if (!fr.length) { await L.closeAll(p); continue; }
        await fr[0].evaluate(e => (e.closest('.pjframe') || e).click()); await p.clock.runFor(500);
        const go = await p.$('#modal .pjcard [data-a="go"]');
        if (!go || await go.evaluate(b => b.disabled)) { await L.closeAll(p); await p.keyboard.press('Escape'); await p.clock.runFor(300); break; }
        const shown = await p.evaluate(() => [...document.querySelectorAll('#modal .pjcard .ledger > div')].map(d => d.textContent).find(t => /[Bb]edel/.test(t)) || '');
        const r = await L.measured(p, this.L, 'proje', async () => { await L.clk(p, go); await p.clock.runFor(600); });
        priceOk(this.I, 'proje 1. etap', shown, r.spend, this.sc); this.stats.pj++;
        await L.closeAll(p); break;
      }
    }
  }
  async buyDistrict() {
    const { p } = this;
    await L.closeAll(p); await L.tap(p, '#mapBtn', 500);
    const b = await p.$('#sheetBody [data-a="buy"]:not([disabled])');
    if (b) {
      const shown = await b.textContent(), k = await b.evaluate(e => e.dataset.k), own0 = await p.evaluate(() => window.__tapuState().own.length);
      const r = await L.measured(p, this.L, 'semt', async () => { await L.clk(p, b); await p.clock.runFor(600); });
      const own1 = await p.evaluate(() => window.__tapuState().own.length);
      if (own1 === own0) this.I.add('semt', `"Tapuyu al" (${k}) etkin ama dokununca semt alınmadı (kasa ${Math.round(r.a.cash)}, düğme "${shown.trim()}")`);
      else { priceOk(this.I, 'semt tapusu', shown, r.spend, this.sc); this.stats.buy++; }
    }
    await L.closeAll(p);
  }
  /** Banka: menü → banka → alıcı → tutar → aktar. Döner: { spend, got, held } ya da null. */
  async bank(to, pick = 0.25, o = {}) {
    const { p } = this;
    await this.handleCards(); await L.closeAll(p); await L.tap(p, '#menuBtn', 500); await L.tap(p, '#sheetBody .drow[data-a="banka"]', 600);
    for (let k = 0; k < 20 && !(await p.$(`#sheetBody [data-a="to"][data-r="${to}"]`)); k++) { await p.clock.runFor(300); if (await L.modalOn(p)) { await this.handleCards(); await L.tap(p, '#menuBtn', 500); await L.tap(p, '#sheetBody .drow[data-a="banka"]', 600); } }
    if (!(await p.$(`#sheetBody [data-a="to"][data-r="${to}"]`))) { const why = await p.evaluate(() => (document.querySelector('#sheetBody') || {}).innerText || ''); await L.closeAll(p); return { none: true, why: why.slice(0, 120) }; }
    await L.tap(p, `#sheetBody [data-a="to"][data-r="${to}"]`, 300);
    await L.tap(p, `#sheetBody [data-a="pick"][data-v="${pick}"]`, 300);
    const slip = await p.evaluate(() => [...document.querySelectorAll('#sheetBody .bk-l b')].map(b => b.textContent));
    const dis = await p.$eval('#sheetBody [data-a="send"]', b => b.disabled);
    if (dis) { await L.closeAll(p); return { disabled: true, slip }; }
    const r = await L.measured(p, this.L, 'bank', async () => { await L.clk(p, '#sheetBody [data-a="send"]'); for (let k = 0; k < 10; k++) { await p.clock.runFor(200); if (await L.modalOn(p)) break; } });
    const card = await p.evaluate(() => document.querySelector('#modal .bk-done') ? document.querySelector('#modal').innerText : '');
    if (o.go) { await L.clk(p, '#modal [data-a="go"]'); }
    else { await L.clk(p, '#modal [data-a="stay"]').catch(() => {}); await p.clock.runFor(500); await L.closeAll(p); }
    this.stats.bank++;
    return { spend: r.spend, slip, card };
  }
}
module.exports = { Player, issues, priceOk };
