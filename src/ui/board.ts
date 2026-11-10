/* ANA EKRAN — üst bilgi, arsalar, birleşik parseller, yönlendirme balonu, sokak hayatı, dokunma */
import { CFG, COLS, ROWS, N, TYPES, DMAP, CITIES } from '../config';
import { t, nm, upper, pctTxt } from '../i18n';
import { S, lotsOf } from '../state';
import { fmt, fmtX, clock, rand, esc } from '../format';
import { now, totalRate, coinFill, fxMult, producing, buyableDistricts, pending, unlockInfo } from '../economy';
import { bld, site, emptyLot, svg } from '../draw';
import { specialSvg, specialOf } from '../specials';
import { season } from '../game/festival';
import { skinStyle, marketChip, seasonClaimable } from '../game/fun';
import { progressInfo, builtCount, lienBlocks, obstacleSvg, OBSTACLES } from '../game/district';
import { I } from '../icons';
import { Snd, buzz } from '../sound';
import { $, ui, reduceMotion } from './ctx';
import { flyCoin, toast, openModal, closeModal } from './modal';
import { openSheet, renderSheet } from './sheets';
import { addCash } from '../game/actions';
import { track, tasksClaimable } from '../game/tasks';
import { canHolding, lmLeft, landmarkCard } from '../game/collection';
import { persist } from '../game/persist';

export function render() {
  const tn = now(), k = S.cur, d = DMAP[k], boosted = S.boostUntil > tn;
  const ssn = season(tn);
  const hr = new Date(tn).getHours(), night = S.night !== false && (hr >= 19 || hr < 6);
  const bodyCls = 'd-' + d.v + (ui.idle ? ' idle' : '') + (ssn ? ' ' + ssn : '') + (night ? ' night' : '');
  if (document.body.className !== bodyCls) document.body.className = bodyCls;
  const dn = S.city ? `${nm(CITIES[d.city].n)} · ${nm(d.n)}` : t('İl seçimi'); const dEl = $('#dname'); if (dEl.textContent !== dn) dEl.textContent = dn;
  const ca = ui.cashAnim; let cv = S.cash;
  if (ca) { const q = (performance.now() - ca.t0) / 500; if (q >= 1) ui.cashAnim = null; else if (q > 0) cv = ca.from + (ca.to - ca.from) * (1 - Math.pow(1 - q, 3)) + (S.cash - ca.to); else cv = ca.from + (S.cash - ca.to); }
  $('#cash').textContent = fmt(cv);
  // semt ilerlemesi: bu semtin yüzdesi + altta gri yazıyla sonraki semt kaporası
  const pi = progressInfo(k), db = $('#distBar');
  const dh = !S.city ? '' : pi.lien
    ? `<span class="dl"><b>${t('{d} · kaporalı', { d: nm(d.n) })}</b><i>${t('borç {x}', { x: fmt(pi.lien) })}</i></span><span class="dp"><u style="width:${Math.round(100 * (1 - pi.lien / Math.max(pi.lien, S.lienT[k] || pi.lien)))}%" class="kp"></u></span><small>${t('{n}/{m} arsa açık · borç {d} kirasının yarısıyla ödeniyor', { n: builtCount(k), m: CFG.KAPORA_LOTS, d: nm(d.n) })}</small>`
    : `<span class="dl"><b>${nm(d.n)} · ${pctTxt(pi.pct)}</b><i>${pi.f >= N ? t('tamamlandı') : t('bitirmeye {n} arsa kaldı', { n: N - pi.f })}</i></span><span class="dp"><u style="width:${pi.pct}%"></u></span>${pi.sub ? `<small>${pi.sub}</small>` : ''}`;
  if (db.dataset.v !== dh) { const was = db.hidden; db.dataset.v = dh; db.innerHTML = dh; db.hidden = !dh; if (was !== db.hidden) requestAnimationFrame(() => fit()); } // çubuk belirince ızgara yeniden boyutlanır
  const rateHtml = `${t('{rate}/sn', { rate: fmt(totalRate(true), true) })}${boosted ? '<span class="x2">2x</span>' : ''}${S.premium ? '<span class="x2">PRO</span>' : ''}<span class="x2 mk">${marketChip()}</span>${S.shares ? `<span class="x2">${I.crown.replace('<svg', '<svg width="10" height="10"')} ${fmtX(1 + 0.1 * S.shares)}</span>` : ''}`;
  if (ui.rateHtml !== rateHtml) { ui.rateHtml = rateHtml; $('#rate').innerHTML = rateHtml; }
  const op = $('#offerPill'), o = S.offer;
  if (o && !o.done) { const h = `<span class="otl">${esc(t(o.title))}</span> <i><b style="width:${o.prog / o.goal * 100}%"></b></i> ${o.prog}/${o.goal} <span class="ot">${clock(o.until - tn)}</span>`; if (op.dataset.v !== h) { op.dataset.v = h; op.innerHTML = h; } op.hidden = false; } else op.hidden = true;
  $('#taskDot').hidden = !tasksClaimable();
  $('#menuDot').hidden = !(canHolding() || seasonClaimable());
  // orta mühür: TOPLA (bekleyen kira + kumbara doluluğu) ya da OTO (saniyelik kira)
  const auto = S.collectMode === 'auto', pd = auto ? { amount: 0, fill: 1 } : pending();
  const cb = $('#collectBtn'), cls = 'boost collect' + (auto ? ' auto' : pd.fill >= .999 ? ' full' : '') + (cb.classList.contains('nudge') ? ' nudge' : '');
  if (cb.className !== cls) cb.className = cls;
  $('#ringFg').style.strokeDashoffset = String(245 * (1 - pd.fill));
  const main = auto ? t('OTO') : t('TOPLA'), sub = auto ? t('{rate}/sn', { rate: fmt(totalRate(true), true) }) : fmt(pd.amount);
  const cm = $('#cmain'); if (cm.textContent !== main) { cm.textContent = main; cb.setAttribute('aria-label', auto ? t('Kiralar otomatik toplanıyor') : t('Tüm kiraları topla')); }
  const cs = $('#csub'); if (cs.textContent !== sub) cs.textContent = sub;
  $('#mapDot').hidden = !buyableDistricts().length;
  const lots = lotsOf(S, k), first = !S.own.some(o2 => lotsOf(S, o2).some(p => p)), hintI = first ? 5 : -1;
  for (let i = 0; i < N; i++) {
    const el = ui.tiles[i], p = lots[i];
    let sig: string;
    const lockE = !p && lienBlocks(k);
    if (!p) sig = 'e' + (i === hintI ? 1 : 0) + (lockE ? 'L' : '');
    else if (p.ob) sig = 'ob|' + p.ob + (ui.teslim[i] && ui.teslim[i].at > performance.now() ? 1 : 0);
    else {
      const coin = S.collectMode === 'auto' || !producing(p) ? -1 : Math.round(coinFill(k, i) * 10);
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
    if (producing(p) && S.collectMode !== 'auto') { const f = coinFill(k, i); h += `<span class="fill${f >= .999 ? ' full' : ''}"><i style="width:${Math.round(f * 100)}%"></i></span>`; }
    if ((p.bu || 0) > tn) h += '<span class="lb2">2x</span>';
    if (p.sk && p.sk.s && !p.until) h += `<span class="tab">${p.sp ? t('ÖZEL') : upper(t(TYPES[p.t].n))}</span>`;
    el.innerHTML = h; el.style.cssText = skinStyle(p);
    el.setAttribute('aria-label', t('{name}, seviye {lvl}', { name: p.sp ? t(specialOf(p.sp).n) : t(TYPES[p.t].n), lvl: p.lvl }) + (p.until ? t(', inşaatta') : '') + ((p.bu || 0) > tn ? t(', 2x kazanıyor') : ''));
  }
  renderLinks(); renderBubble();
  if (ui.sheet) renderSheet();
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

/* ---------- SOKAK HAYATI — araçlar, yayalar ve altın taksi; boşta durur ---------- */
const CAR_COLORS = ['var(--sgn)', 'var(--fr)', 'var(--sol)', 'var(--aw1)', 'var(--pl)', 'var(--ofis-s)', 'var(--kafe-f)'];
export const Street = {
  low: null as HTMLElement | null, high: null as HTMLElement | null, n: 0,
  init() {
    const g = $('#grid'); this.low = document.createElement('div'); this.low.className = 'street'; this.high = document.createElement('div'); this.high.className = 'street top';
    g.prepend(this.low); g.appendChild(this.high); this.loop();
  },
  spawn(kind: 'car' | 'ped' | 'taxi') {
    if (kind !== 'taxi' && document.body.classList.contains('night') && Math.random() < .6) return; // gece sokaklar sakin
    if (document.hidden || (ui.idle && kind !== 'taxi') || (reduceMotion && kind !== 'taxi') || this.n > 8) return;
    const s = ui.sw, sh = ui.sh, g = ui.gap, off = ui.pad, Wd = COLS * s + (COLS - 1) * g + 2 * off, Ht = ROWS * sh + (ROWS - 1) * g + 2 * off, taxi = kind === 'taxi', ped = kind === 'ped';
    const horiz = Math.random() < .5, fwd = Math.random() < .5, e = document.createElement('div');
    e.className = ped ? 'ped' : 'car' + (taxi ? ' taxi' : '') + (horiz ? '' : ' v') + (fwd ? '' : ' rev');
    if (!ped && !taxi) e.style.setProperty('--cc', CAR_COLORS[Math.floor(Math.random() * CAR_COLORS.length)]);
    const len = taxi ? 18 : ped ? 3 : 14, thick = taxi ? 8 : ped ? 3 : 6;
    let from: number, to: number;
    if (horiz) { const r = 1 + Math.floor(Math.random() * (ROWS - 1)); const cy = off + r * (sh + g) - g / 2; e.style.top = (ped ? cy + (fwd ? 5 : -8) : (taxi ? cy - thick / 2 : (fwd ? cy + 1 : cy - 1 - thick))) + 'px'; from = fwd ? -len : Wd; to = fwd ? Wd : -len; }
    else { const c = 1 + Math.floor(Math.random() * (COLS - 1)); const cx = off + c * (s + g) - g / 2; e.style.left = (ped ? cx + (fwd ? 5 : -8) : (taxi ? cx - thick / 2 : (fwd ? cx - 1 - thick : cx + 1))) + 'px'; from = fwd ? -len : Ht; to = fwd ? Ht : -len; }
    const speed = taxi ? 28 : ped ? 9 : rand(38, 64), dur = Math.abs(to - from) / speed * 1000;
    (taxi ? this.high : this.low)!.appendChild(e); this.n++;
    const tf = (x: number) => horiz ? `translateX(${x}px)` : `translateY(${x}px)`;
    if (!e.animate) { e.remove(); this.n--; return; }
    const an = e.animate([{ transform: tf(from) }, { transform: tf(to) }], { duration: dur, easing: 'linear' });
    an.onfinish = () => { e.remove(); this.n--; };
    if (taxi) e.addEventListener('pointerdown', ev => { ev.stopPropagation(); an.cancel(); catchTaxi(e); this.n--; }, { once: true });
  },
  loop() { setTimeout(() => { this.spawn(Math.random() < .25 ? 'ped' : 'car'); this.loop(); }, rand(900, 2200)); },
};
function catchTaxi(el: HTMLElement) {
  const amt = Math.max(100, totalRate(false) * 120); addCash(amt); track('taxi'); Snd.reward(); buzz(20);
  const r = el.getBoundingClientRect(), dot = document.createElement('span'); dot.style.cssText = `position:fixed;left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px`;
  document.body.appendChild(dot); flyCoin(dot); setTimeout(() => dot.remove(), 50); el.remove();
  toast(t('Altın taksi: {amt}', { amt: fmt(amt) }));
  if (Math.random() < .08 && lmLeft().length) { const l = lmLeft()[0]; S.coll.push(l.id); openModal(landmarkCard(l, ' ' + t('Altın taksiden çıktı!')), () => closeModal()); }
  persist();
}
