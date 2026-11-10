/* ANA EKRAN — üst bilgi, arsalar, birleşik parseller, yönlendirme balonu, dokunma (sokak hayatı: street.ts) */
import { CFG, COLS, ROWS, N, TYPES, DMAP, CITIES, DistrictKey } from '../config';
import { t, nm, upper, pctTxt } from '../i18n';
import { S, lotsOf } from '../state';
import { fmt, fmtX, clock, esc } from '../format';
import { now, totalRate, coinFill, fxMult, producing, buyableDistricts, pending } from '../economy';
import { bld, site, emptyLot, svg } from '../draw';
import { specialSvg, specialOf } from '../specials';
import { season } from '../game/calendar';
import { skinStyle, marketChip, seasonClaimable } from '../game/fun';
import { progressInfo, builtCount, lienBlocks, obstacleSvg, OBSTACLES } from '../game/district';
import { I } from '../icons';
import { Snd } from '../sound';
import { $, ui, view } from './ctx';
import { cashText } from './modal';
import { pop } from './motion';
import { openSheet, renderSheet } from './sheets';
import { tasksClaimable } from '../game/tasks';
import { canHolding } from '../game/collection';

export function render() {
  const tn = now(), k = S.cur, d = DMAP[k], boosted = S.boostUntil > tn;
  const ssn = season(tn);
  const hr = new Date(tn).getHours(), night = S.night !== false && (hr >= 19 || hr < 6);
  const bodyCls = 'd-' + d.v + (ui.idle ? ' idle' : '') + (ssn ? ' ' + ssn : '') + (night ? ' night' : '');
  if (document.body.className !== bodyCls) document.body.className = bodyCls;
  const dn = S.city ? `${nm(CITIES[d.city].n)} · ${nm(d.n)}` : t('İl seçimi'); const dEl = $('#dname'); if (dEl.textContent !== dn) dEl.textContent = dn;
  if (!ui.cashAnim) cashText(S.cash); // TOPLA sonrası sayım sürerken kasayı yalnızca sayaç döngüsü yazar (modal.ts countUp)
  // semt ilerlemesi: bu semtin yüzdesi + altta gri yazıyla sonraki semt kaporası. Çubuğun iskeleti yalnızca türü değişince
  // kurulur; yazılar ve doluluk (translateX) yerinde güncellenir ki geçiş oynasın
  const pi = progressInfo(k), db = $('#distBar');
  const mode = !S.city ? '' : pi.lien ? 'L' : pi.sub ? 'Ns' : 'N';
  if (db.dataset.v !== mode) {
    const was = db.hidden; db.dataset.v = mode; db.hidden = !mode;
    db.innerHTML = mode ? `<span class="dl"><b></b><i></i></span><span class="dp"><u${mode === 'L' ? ' class="kp"' : ''}></u></span>${mode !== 'N' ? '<small></small>' : ''}` : '';
    if (was !== db.hidden) requestAnimationFrame(() => fit()); // çubuk belirince ızgara yeniden boyutlanır
  }
  if (mode) {
    const L = mode === 'L', q = (sel: string) => db.querySelector(sel) as HTMLElement | null;
    setText(q('.dl b'), L ? t('{d} · kaporalı', { d: nm(d.n) }) : `${nm(d.n)} · ${pctTxt(pi.pct)}`);
    setText(q('.dl i'), L ? t('borç {x}', { x: fmt(pi.lien) }) : pi.f >= N ? t('tamamlandı') : t('bitirmeye {n} arsa kaldı', { n: N - pi.f }));
    setText(q('small'), L ? t('{n}/{m} arsa açık · borç {d} kirasının yarısıyla ödeniyor', { n: builtCount(k), m: CFG.KAPORA_LOTS, d: nm(d.n) }) : pi.sub || '');
    setFill(q('.dp u'), L ? 1 - pi.lien / Math.max(pi.lien, S.lienT[k] || pi.lien) : pi.pct / 100);
  }
  const rateHtml = `${t('{rate}/sn', { rate: fmt(totalRate(true), true) })}${boosted ? '<span class="x2">2x</span>' : ''}${S.premium ? '<span class="x2">PRO</span>' : ''}<span class="x2 mk">${marketChip()}</span>${S.shares ? `<span class="x2">${I.crown.replace('<svg', '<svg width="10" height="10"')} ${fmtX(1 + 0.1 * S.shares)}</span>` : ''}`;
  if (ui.rateHtml !== rateHtml) { ui.rateHtml = rateHtml; $('#rate').innerHTML = rateHtml; }
  const op = $('#offerPill'), o = S.offer;
  if (o && !o.done) {
    const ttl = t(o.title); if (op.dataset.v !== ttl) { op.dataset.v = ttl; op.innerHTML = `<span class="otl">${esc(ttl)}</span><i><b></b></i><span class="opg"></span><span class="ot"></span>`; }
    setFill(op.querySelector('i b'), o.prog / o.goal); setText(op.querySelector('.opg'), `${o.prog}/${o.goal}`); setText(op.querySelector('.ot'), clock(o.until - tn)); op.hidden = false;
  } else op.hidden = true;
  $('#taskDot').hidden = !tasksClaimable();
  $('#menuDot').hidden = !(canHolding() || seasonClaimable());
  // orta mühür: TOPLA (bekleyen kira + kumbara doluluğu) ya da OTO (saniyelik kira)
  const auto = S.collectMode === 'auto', pd = auto ? { amount: 0, fill: 1 } : pending();
  const cb = $('#collectBtn'), cls = 'boost collect' + (auto ? ' auto' : pd.fill >= .999 ? ' full' : '');
  if (cb.className !== cls) cb.className = cls;
  // halka: yalnızca gözle görülür bir değişimde ve oyuncu boşta değilken yazılır (her tikte yeniden başlayan geçiş = sürekli boyama)
  const ro = 245 * (1 - pd.fill);
  if (!ui.idle && Math.abs(ro - ringV) > .6 || (ro !== ringV && (pd.fill >= .999 || pd.fill === 0))) {
    const rf = $('#ringFg'); rf.classList.toggle('tr', ringV >= 0 && Math.abs(ro - ringV) > 12); ringV = ro; rf.style.strokeDashoffset = ro.toFixed(1);
  }
  const main = auto ? t('OTO') : t('TOPLA'), sub = auto ? t('{rate}/sn', { rate: fmt(totalRate(true), true) }) : fmt(pd.amount);
  const cm = $('#cmain'); if (cm.textContent !== main) { cm.textContent = main; cb.setAttribute('aria-label', auto ? t('Kiralar otomatik toplanıyor') : t('Tüm kiraları topla')); }
  const cs = $('#csub'); if (cs.textContent !== sub) cs.textContent = sub;
  $('#mapDot').hidden = !buyableDistricts().length;
  const lots = lotsOf(S, k), first = !S.own.some(o2 => lotsOf(S, o2).some(p => p)), hintI = first ? 5 : -1;
  for (let i = 0; i < N; i++) {
    const el = ui.tiles[i], p = lots[i];
    let sig: string;
    liveFill(i, el, p, k);
    const lockE = !p && lienBlocks(k);
    if (!p) sig = 'e' + (i === hintI ? 1 : 0) + (lockE ? 'L' : '');
    else if (p.ob) sig = 'ob|' + p.ob + (ui.teslim[i] && ui.teslim[i].at > performance.now() ? 1 : 0);
    else {
      const coin = S.collectMode === 'auto' || !producing(p) ? -1 : 0; // doluluk çubuğu kalıcı: değeri aşağıda yerinde güncellenir
      const lb = (p.bu || 0) > tn ? 1 : 0;
      const prog = p.until ? Math.floor((1 - (p.until - tn) / p.dur) * 20) : 0; // %5 adım: gereksiz yeniden çizim yok
      const hot = producing(p) && fxMult(k, i, p, tn) > 1;
      const cd = p.until && p.until - tn <= CFG.SKIP_LEFT ? Math.ceil((p.until - tn) / 1000) : 0; // son 5 sn geri sayım
      const ts = ui.teslim[i] && ui.teslim[i].at > performance.now() ? 1 : 0;
      sig = [JSON.stringify(p.sk || ''), p.t, p.sp || '', p.lvl, p.until ? 1 : 0, prog, cd, ts, coin, lb, hot ? 1 : 0, mergeSides(i), d.v].join('|');
    }
    if (sig === ui.tileSig[i]) continue;
    ui.tileSig[i] = sig;
    if (!p) {
      el.className = 'lot' + (i === hintI ? ' hint' : '') + (lockE ? ' lk' : ''); el.style.cssText = '';
      const tsl = ui.teslim[i] && ui.teslim[i].at > performance.now() ? `<span class="teslim"><b>${t('TEMİZ')}</b><small>${ui.teslim[i].txt}</small></span>` : '';
      el.innerHTML = svg(emptyLot(i), 'art') + (lockE ? `<span class="lkb">${I.lock}</span>` : '') + tsl;
      el.setAttribute('aria-label', lockE ? t('Kilitli arsa (kapora borcu)') : t('Boş arsa')); continue;
    }
    if (p.ob) { el.className = 'lot ob'; el.style.cssText = ''; el.innerHTML = svg(obstacleSvg(p.ob), 'art') + `<span class="obn">${t(OBSTACLES[p.ob].n)}</span>`; el.setAttribute('aria-label', t('{name}: temizlenmesi gerekiyor', { name: t(OBSTACLES[p.ob].n) })); continue; }
    const prog = p.until ? Math.min(1, 1 - (p.until - tn) / p.dur) : 1;
    const hot = producing(p) && fxMult(k, i, p, tn) > 1;
    el.className = `lot k-${p.t} ${p.until ? 'c' : 'b'}${hot ? ' hot' : ''}${p.until ? '' : mergeSides(i)}`;
    const art = p.sp ? specialSvg(p.sp) : p.until ? site(p.t, p.up ? p.lvl : 0, p.up ? p.lvl + 1 : 1, prog) : bld(p.t, p.lvl);
    if (p.sp) el.className = `lot k-ozel b${hot ? ' hot' : ''}`;
    let h = svg(art, 'art');
    const left = p.until ? p.until - tn : 0;
    if (p.until && left <= CFG.SKIP_LEFT) { el.classList.add('final'); h += `<span class="cd"><small>${t('TESLİME')}</small><b>0:0${Math.max(0, Math.ceil(left / 1000))}</b><i><u style="width:${Math.round(prog * 100)}%"></u></i></span>`; }
    else if (p.until) h += `<span class="ff">${I.ff}</span>`;
    const tsl = ui.teslim[i];
    if (tsl && tsl.at > performance.now()) h += `<span class="teslim"><b>${t('TESLİM')}</b><small>${tsl.txt}</small></span>`;
    // para baloncuğu yok: ince doluluk çubuğu (tek tuş modunda) ve mülke özel 2x etiketi
    if (producing(p) && S.collectMode !== 'auto') { const f = coinFill(k, i); h += `<span class="fill${f >= .999 ? ' full' : ''}"><i style="transform:${fillTf(f)}"></i></span>`; }
    if ((p.bu || 0) > tn) h += '<span class="lb2">2x</span>';
    if (p.sk && p.sk.s && !p.until) h += `<span class="tab">${p.sp ? t('ÖZEL') : upper(t(TYPES[p.t].n))}</span>`;
    el.innerHTML = h; el.style.cssText = skinStyle(p);
    el.setAttribute('aria-label', t('{name}, seviye {lvl}', { name: p.sp ? t(specialOf(p.sp).n) : t(TYPES[p.t].n), lvl: p.lvl }) + (p.until ? t(', inşaatta') : '') + ((p.bu || 0) > tn ? t(', 2x kazanıyor') : ''));
  }
  if (ui.pop.size) { for (const i of ui.pop) pop(ui.tiles[i] && ui.tiles[i].querySelector('svg.art')); ui.pop.clear(); } // inşaat başlangıcı / teslim
  renderLinks(); renderBubble();
  if (ui.sheet) renderSheet();
}
let ringV = -1;
const setText = (el: Element | null, v: string) => { if (el && el.textContent !== v) el.textContent = v; };
/** Doluluk (0–1): tam genişlikteki dolgu taşmayı kesen kabın içinde translateX ile kayar (genişlik/boyama yok; scaleX
 *  taramalı kapora dolgusunu bozardı). Yalnızca değişince yazılır; geçiş compositor'da oynar. */
const fillTf = (f: number) => `translateX(${((Math.max(0, Math.min(1, f)) - 1) * 100).toFixed(1)}%)`;
function setFill(el: Element | null, f: number) { if (!el) return; const v = fillTf(f); const st = (el as HTMLElement).style; if (st.transform !== v) st.transform = v; }
/** Kira doluluk çubuğu karo yeniden çizilmeden yerinde güncellenir (translateX; %1 adım). */
function liveFill(i: number, el: HTMLElement, p: ReturnType<typeof lotsOf>[number], k: DistrictKey) {
  if (!p || p.ob || p.until || !producing(p) || S.collectMode === 'auto') return;
  const b = el.querySelector('.fill') as HTMLElement | null; if (!b) return;
  const f = coinFill(k, i), full = f >= .999; if (b.classList.contains('full') !== full) b.classList.toggle('full', full);
  // boştayken yalnızca dolunca yazılır (kare üretmesin)
  if ((!ui.idle && Math.abs(f - +(b.dataset.f ?? -1)) >= .01) || (full && b.dataset.f !== '1')) { b.dataset.f = full ? '1' : f.toFixed(3); setFill(b.firstElementChild, f); }
}
/* aynı türden komşu arsalar tek parsel gibi görünür (komşuluk bonusu) */
export function mergeSides(i: number): string {
  const lots = lotsOf(S, S.cur), p = lots[i]; if (!p || p.lvl < 1 || p.until || p.sp) return '';
  const same = (j: number) => { const q = lots[j]; return !!q && !q.sp && q.lvl >= 1 && q.t === p.t; }, c = i % COLS; let m = '';
  if (i >= COLS && same(i - COLS)) m += ' mN'; if (i + COLS < N && same(i + COLS)) m += ' mS'; if (c > 0 && same(i - 1)) m += ' mW'; if (c < COLS - 1 && same(i + 1)) m += ' mE';
  return m;
}
export function renderLinks() {
  const lots = lotsOf(S, S.cur), parts: [string, number, string][] = [];
  const ok = (j: number, t: string) => { const q = lots[j]; return !!q && !q.sp && q.lvl >= 1 && q.t === t; };
  for (let i = 0; i < N; i++) {
    const p = lots[i]; if (!p || p.lvl < 1 || p.sp) continue; const c = i % COLS;
    if (c < COLS - 1 && ok(i + 1, p.t)) parts.push(['r', i, p.t]);
    if (i + COLS < N && ok(i + COLS, p.t)) parts.push(['b', i, p.t]);
    if (c < COLS - 1 && i + COLS < N && [i + 1, i + COLS, i + COLS + 1].every(j => ok(j, p.t))) parts.push(['m', i, p.t]);
  }
  parts.sort((a, b) => Number(a[0] === 'm') - Number(b[0] === 'm'));
  const sig = parts.map(x => x.join()).join('|') + '@' + ui.sw + 'x' + ui.sh;
  if (sig === ui.linkSig) return; ui.linkSig = sig;
  const g = $('#grid'); g.querySelectorAll('.link').forEach((n: Element) => n.remove());
  const sw = ui.sw, sh = ui.sh, gp = ui.gap;
  for (const [dir, i, t] of parts) {
    const r = Math.floor(i / COLS), c = i % COLS, e = document.createElement('span'); e.className = 'link k-' + t + ' l' + dir;
    if (dir === 'r') e.style.cssText = `left:${c * (sw + gp) + sw - 14}px;top:${r * (sh + gp)}px;width:${gp + 28}px;height:${sh}px`;
    else if (dir === 'b') e.style.cssText = `left:${c * (sw + gp)}px;top:${r * (sh + gp) + sh - 14}px;width:${sw}px;height:${gp + 28}px`;
    else e.style.cssText = `left:${c * (sw + gp) + sw - 14}px;top:${r * (sh + gp) + sh - 14}px;width:${gp + 28}px;height:${gp + 28}px`;
    g.appendChild(e);
  }
}
/* yalnızca ilk adımlarda kısa yönlendirme */
function renderBubble() {
  const b = $('#bubble'); let m = '';
  const any = S.own.some(k => lotsOf(S, k).some(p => p)), prod = S.own.some(k => lotsOf(S, k).some(producing));
  if (!any) m = t('Bir arsaya dokun, ilk binanı kur');
  else if (!prod && !S.skipHint) m = t('Bina yükseliyor · ▶▶ ile hızlandır');
  else if (S.collects < 3 && S.collectMode === 'tap' && pending().amount >= 1) m = t('Kirayı toplamak için ortadaki TOPLA mührüne bas');
  if (m) { if (b.textContent !== m) b.textContent = m; b.removeAttribute('data-off'); } else b.setAttribute('data-off', '');
}

/* ---------- ızgara: arsalar ekrana göre büyür (en fazla %30 dikey uzar) ---------- */
/** En küçük arsa kenarı (dokunma hedefi). Kısa ekranda üst/alt öğeler sıkışır ki arsalar bunun altına inmesin. */
const MIN_LOT = 44;
export function fit() {
  const board = $('#board'), b = board.getBoundingClientRect(), grid = $('#grid'), cs = getComputedStyle(grid);
  // sokak genişliği ve tahta kenar boşluğu CSS'ten (kısa ekranda daralır)
  const g = ui.gap = parseFloat(cs.columnGap) || 14, pp = ui.pad = parseFloat(getComputedStyle(grid.parentElement!).paddingLeft) || 14, pad = 2 * pp + 4; // + çerçeve çizgisi
  // kullanılabilir yükseklik: alt çubuğun üstüne kadar (ilerleme çubuğu sonradan belirince ızgara taşmasın)
  const dock = document.querySelector('.dock'), dr = dock && dock.getBoundingClientRect();
  const below = !!dr && dr.left < b.right && dr.right > b.left && dr.top > b.top; // dikeyde alt çubuk tahtanın altında; yatayda yanda
  const availH = below ? Math.min(b.height, dr!.top - b.top - 6) : b.height;
  const gt = $('#guideBtn').getBoundingClientRect(), tabIn = below && gt.width > 0 && gt.left > b.left + b.width / 2 && gt.left < b.right && gt.top < b.bottom;
  // dikeyde kılavuz sekmesi tahtanın sağ kenarında durur: yalnız sağdan sekme kadar yer açılır (tahta birkaç px sola kayar), çerçeve sekmeye binmez
  const tabW = tabIn ? Math.max(0, b.right - gt.left + 2) : 0, availW = b.width - tabW;
  ($('.plate') as HTMLElement).style.marginRight = tabW ? tabW + 'px' : '';
  const byW = Math.floor((availW - pad - g * (COLS - 1)) / COLS), byH = Math.floor((availH - pad - 4 - g * (ROWS - 1)) / ROWS);
  const sw = Math.max(MIN_LOT, Math.min(byW, Math.max(byH, MIN_LOT))), sh = Math.max(MIN_LOT, Math.min(byH, Math.round(sw * 1.3)));
  ui.size = sw; ui.sw = sw; ui.sh = sh; grid.style.gridTemplateColumns = `repeat(${COLS},${sw}px)`; grid.style.gridAutoRows = sh + 'px';
  grid.querySelectorAll('.lane').forEach((n: Element) => n.remove());
  const Wd = COLS * sw + (COLS - 1) * g, Ht = ROWS * sh + (ROWS - 1) * g;
  for (let c = 1; c < COLS; c++) { const e = document.createElement('span'); e.className = 'lane v'; e.style.cssText = `left:${c * (sw + g) - g / 2 - 1}px;top:0;height:${Ht}px`; grid.prepend(e); }
  for (let r = 1; r < ROWS; r++) { const e = document.createElement('span'); e.className = 'lane h'; e.style.cssText = `top:${r * (sh + g) - g / 2 - 1}px;left:0;width:${Wd}px`; grid.prepend(e); }
  placeOverlays(below);
  if (S) renderLinks();
}
/** Bildirim alanı: Rıfkı, ipucu balonu, semt özeti, büyük mühür ve kısa bildirim (toast) arsaların üstüne binmesin diye
 *  hepsi aynı şeride yerleşir. Dikeyde tahtanın hemen üstü (üst bilginin alt kısmının üzerine, aşağıdan yukarı büyür);
 *  yatayda sol bilgi sütununun altı (kılavuz düğmesinin üstü). Konum CSS değişkenleriyle verilir (styles.css .ovl). */
function placeOverlays(portrait: boolean) {
  const st = document.documentElement.style, H = document.documentElement.clientHeight;
  let l: number, w: number, bot: number;
  if (portrait) {
    const app = $('#app'), ar = app.getBoundingClientRect(), acs = getComputedStyle(app), pr = $('.plate').getBoundingClientRect();
    l = ar.left + parseFloat(acs.paddingLeft); w = ar.width - parseFloat(acs.paddingLeft) - parseFloat(acs.paddingRight); bot = H - pr.top + 6;
  } else {
    const tr = $('.top').getBoundingClientRect(), gb = $('#guideBtn').getBoundingClientRect();
    l = tr.left; w = tr.width; bot = H - (gb.height ? gb.top : tr.bottom) + 8;
  }
  st.setProperty('--ovl-l', Math.round(l) + 'px'); st.setProperty('--ovl-w', Math.round(w) + 'px'); st.setProperty('--ovl-b', Math.round(bot) + 'px');
}
function tileAt(x: number, y: number): number | null {
  const el = document.elementFromPoint(x, y); const tl = el && (el as HTMLElement).closest && (el as HTMLElement).closest('.lot') as HTMLElement | null;
  return tl ? +tl.dataset.i! : null;
}
function tapTile(i: number) {
  openSheet({ k: 'plot', key: S.cur, i });
}
export function setupGrid() {
  const grid = $('#grid'); grid.innerHTML = '';
  for (let i = 0; i < N; i++) { const b = document.createElement('button'); b.className = 'lot'; b.dataset.i = String(i); grid.appendChild(b); ui.tiles[i] = b; }
  let g: { start: number | null; x: number; y: number; got: boolean } | null = null;
  // binaya dokunmak her zaman mülk panelini açar (kira ortadaki mühürle toplanır)
  grid.addEventListener('pointerdown', (e: PointerEvent) => {
    Snd.init();
    const i = tileAt(e.clientX, e.clientY); g = { start: i, x: e.clientX, y: e.clientY, got: false };
  });
  // Dokunuş parmak kalkınca "beklemeye" alınır ve tarayıcının ardından gönderdiği click ile açılır.
  // Paneli doğrudan pointerup'ta açmak Android'de sorun çıkarıyordu: aynı dokunuşun click'i yeni açılan
  // arka plana (scrim) düşüp paneli anında kapatıyordu. click gelmezse 350 ms sonra yine açılır.
  let pending: number | null = null, pendingT: any = 0;
  const fire = () => { clearTimeout(pendingT); const i = pending; pending = null; if (i != null) tapTile(i); };
  window.addEventListener('pointerup', (e: PointerEvent) => {
    if (!g) return; const i = tileAt(e.clientX, e.clientY), moved = Math.hypot(e.clientX - g.x, e.clientY - g.y);
    if (!g.got && i != null && i === g.start && moved < 14) { pending = i; clearTimeout(pendingT); pendingT = setTimeout(fire, 350); }
    g = null; render();
  });
  window.addEventListener('pointercancel', () => { g = null; });
  grid.addEventListener('click', (e: MouseEvent) => {
    if (pending != null) { fire(); return; }
    if (e.detail === 0) { const tl = (e.target as HTMLElement).closest('.lot') as HTMLElement | null; if (tl) tapTile(+tl.dataset.i!); } // klavye
  });
}
export function drawGuilloche() {
  let g = ''; for (let k = 0; k < 6; k++) { let d = ''; for (let x = 0; x <= 360; x += 4) d += (x ? 'L' : 'M') + x + ' ' + (8 + Math.sin(x / 360 * Math.PI * 8 + k * .9) * 6).toFixed(1); g += `<path d="${d}" fill="none" stroke="var(--guil)" stroke-width=".7" opacity=".85"/>`; }
  $('#guil').innerHTML = g;
  let h = ''; for (let k = 0; k < 3; k++) { let d = ''; for (let x = 0; x <= 360; x += 4) d += (x ? 'L' : 'M') + x + ' ' + (5 + Math.sin(x / 360 * Math.PI * 10 + k * 1.1) * 3.6).toFixed(1); h += `<path d="${d}" fill="none" stroke="var(--guil)" stroke-width=".7"/>`; }
  $('#sheetGuil').innerHTML = h;
}
view.render = render;
