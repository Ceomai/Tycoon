/* ŞEHRİNİ PAYLAŞ — story boyutunda görsel (1080×1920) */
import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { COLS, ROWS, N, DMAP, CITIES } from '../config';
import { S, lotsOf } from '../state';
import { fmt } from '../format';
import { now, totalRate } from '../economy';
import { bld, site, emptyLot } from '../draw';
import { I } from '../icons';
import { $ } from '../ui/ctx';
import { openModal, closeModal, toast } from '../ui/modal';
import { closeSheet } from '../ui/sheets';
import { track } from './tasks';
import { Analytics } from '../services/analytics';

function svgCss(): string {
  let txt = '';
  for (const ss of Array.from(document.styleSheets)) {
    let rules: CSSRuleList; try { rules = ss.cssRules; } catch { continue; }
    for (const r of Array.from(rules) as CSSStyleRule[]) if (r.selectorText && (/^svg /.test(r.selectorText) || /\.k-|\.d-\d/.test(r.selectorText))) txt += r.cssText + '\n';
  }
  const cs = getComputedStyle(document.body); let vars = '';
  new Set(txt.match(/--[a-z0-9-]+/g) || []).forEach(n => { const v = cs.getPropertyValue(n).trim(); if (v) vars += `${n}:${v};`; });
  return `svg{${vars}}\n` + txt;
}
function citySvg() {
  const k = S.cur, v = DMAP[k].v, L = 100, G = 16, P = 22, Wd = COLS * L + (COLS - 1) * G + 2 * P, Ht = ROWS * L + (ROWS - 1) * G + 2 * P;
  const cs = getComputedStyle(document.body), c = (n: string) => cs.getPropertyValue(n).trim();
  let s = `<rect x="0" y="0" width="${Wd}" height="${Ht}" rx="26" fill="${c('--asph')}"/>`;
  for (let i = 1; i < COLS; i++) s += `<line x1="${P + i * (L + G) - G / 2}" y1="${P}" x2="${P + i * (L + G) - G / 2}" y2="${Ht - P}" stroke="${c('--lane')}" stroke-width="2" stroke-dasharray="8 8"/>`;
  for (let r = 1; r < ROWS; r++) s += `<line x1="${P}" y1="${P + r * (L + G) - G / 2}" x2="${Wd - P}" y2="${P + r * (L + G) - G / 2}" stroke="${c('--lane')}" stroke-width="2" stroke-dasharray="8 8"/>`;
  const lots = lotsOf(S, k);
  for (let i = 0; i < N; i++) {
    const p = lots[i], x = P + (i % COLS) * (L + G), y = P + Math.floor(i / COLS) * (L + G);
    if (!p) { s += `<rect x="${x}" y="${y}" width="${L}" height="${L}" rx="7" fill="${c('--dirt')}"/><g transform="translate(${x} ${y})">${emptyLot(i)}</g>`; continue; }
    s += `<rect x="${x}" y="${y}" width="${L}" height="${L}" rx="7" fill="${p.until ? c('--site') : c('--' + p.t + '-z')}" stroke="${c('--ink')}" stroke-width="1.5"/>`;
    const prog = p.until ? Math.min(1, 1 - (p.until - now()) / p.dur) : 1;
    s += `<g class="k-${p.t} inked" transform="translate(${x} ${y})">${p.until ? site(p.t, p.up ? p.lvl : 0, p.up ? p.lvl + 1 : 1, prog, v) : bld(p.t, p.lvl, v)}</g>`;
  }
  return { w: Wd, h: Ht, str: `<svg xmlns="http://www.w3.org/2000/svg" class="d-${v}" viewBox="0 0 ${Wd} ${Ht}" width="${Wd * 2}" height="${Ht * 2}"><style>${svgCss()}</style>${s}</svg>` };
}
const loadImg = (src: string) => new Promise<HTMLImageElement>((ok, no) => { const im = new Image(); im.onload = () => ok(im); im.onerror = no; im.src = src; });

async function genShare(): Promise<Blob> {
  try { await (document as any).fonts.ready; } catch { /* yok */ }
  const W = 1080, H = 1920, cv = document.createElement('canvas'); cv.width = W; cv.height = H; const g = cv.getContext('2d')!;
  const cs = getComputedStyle(document.body), v = (n: string) => cs.getPropertyValue(n).trim();
  const d = DMAP[S.cur];
  g.fillStyle = v('--bg'); g.fillRect(0, 0, W, H);
  g.fillStyle = v('--stamp'); g.fillRect(0, 0, W, 30); g.fillRect(0, H - 30, W, 30);
  g.textAlign = 'center';
  g.fillStyle = v('--muted'); g.font = '600 44px "IBM Plex Mono", monospace'; g.fillText(`${CITIES[d.city].n} · ${d.n}`.toLocaleUpperCase('tr-TR'), W / 2, 170);
  g.fillStyle = v('--ink'); g.font = '700 168px "Barlow Condensed", "Arial Narrow", sans-serif'; g.fillText(fmt(S.cash), W / 2, 340);
  g.fillStyle = v('--muted'); g.font = '600 50px "Barlow Condensed", "Arial Narrow", sans-serif'; g.fillText(`saniyede ${fmt(totalRate(true), true)} kira`, W / 2, 410);
  const city = citySvg(), im = await loadImg('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(city.str));
  const cw = 920, ch = cw * city.h / city.w; g.drawImage(im, (W - cw) / 2, 470, cw, ch);
  g.save(); g.translate(W / 2, H - 196); g.rotate(-5 * Math.PI / 180); g.strokeStyle = v('--stamp'); g.fillStyle = v('--stamp');
  g.lineWidth = 10; g.strokeRect(-180, -82, 360, 164); g.lineWidth = 3; g.strokeRect(-162, -64, 324, 128);
  g.font = '600 92px "IBM Plex Mono", monospace'; g.fillText('TAPU', 0, 22); g.font = '500 20px "IBM Plex Mono", monospace'; g.fillText('A D A  ·  P A R S E L', 0, 52); g.restore();
  g.fillStyle = v('--muted'); g.font = '500 36px "IBM Plex Mono", monospace'; g.fillText(`Davet kodum: ${S.ref.code}`, W / 2, H - 66);
  return await new Promise<Blob>(r => cv.toBlob(b => r(b!), 'image/png'));
}
export const shareText = () => `Tapu'da ${CITIES[DMAP[S.cur].city].n} ${DMAP[S.cur].n}'de ${fmt(S.cash)} kasalı emlak imparatorluğu kurdum. Davet kodum: ${S.ref.code}`;
export async function copyText(t: string) { try { await navigator.clipboard.writeText(t); toast('Kopyalandı'); } catch { toast(t); } }
export async function shareTextOnly() {
  const t = shareText();
  if (Capacitor.isNativePlatform()) { try { await Share.share({ title: 'Tapu', text: t }); return; } catch { /* iptal */ } }
  if (navigator.share) try { await navigator.share({ text: t }); return; } catch { /* iptal */ }
  copyText(t);
}
const toBase64 = (b: Blob) => new Promise<string>(ok => { const fr = new FileReader(); fr.onload = () => ok(String(fr.result).split(',')[1]); fr.readAsDataURL(b); });

let shareBlob: Blob | null = null, shareUrl = '';
export async function openShare() {
  closeSheet();
  openModal(`<div class="card"><h3>Şehrini paylaş</h3><p id="shareMsg">Görsel hazırlanıyor…</p><div id="shareBox"></div>
    <div class="btns"><button class="btn gold" data-a="share" disabled>${I.share} Paylaş</button><button class="btn soft" data-a="save" disabled>Kaydet</button><button class="txt" data-a="no">Kapat</button></div></div>`,
    async a => {
      if (a === 'no') { closeModal(); return; }
      if (!shareBlob) return;
      track('share'); Analytics.log('share', { kind: a });
      if (Capacitor.isNativePlatform()) {
        try {
          const file = await Filesystem.writeFile({ path: 'tapu-sehrim.png', data: await toBase64(shareBlob), directory: Directory.Cache });
          await Share.share({ title: 'Tapu', text: shareText(), files: [file.uri] });
        } catch { /* iptal */ }
        return;
      }
      if (a === 'share') {
        const f = new File([shareBlob], 'tapu-sehrim.png', { type: 'image/png' });
        if ((navigator as any).canShare && (navigator as any).canShare({ files: [f] })) try { await navigator.share({ files: [f], text: shareText() }); return; } catch (e: any) { if (e && e.name === 'AbortError') return; }
        shareTextOnly();
      }
      if (a === 'save') {
        try { const dl = window.claude?.use ? await window.claude.use('downloads') : null; if (dl) { await dl.save({ filename: 'tapu-sehrim.png', data: shareBlob }); return; } } catch (e: any) { if (e && e.code === 'declined') return; }
        toast('Görsele basılı tutup kaydedebilirsin');
      }
    });
  try {
    shareBlob = await genShare(); if (shareUrl) URL.revokeObjectURL(shareUrl); shareUrl = URL.createObjectURL(shareBlob);
    const box = $('#shareBox'); if (!box) return;
    box.innerHTML = `<img class="shareimg" src="${shareUrl}" alt="${DMAP[S.cur].n} şehir görseli">`;
    $('#shareMsg').textContent = 'Story olarak paylaş ya da kaydet.';
    document.querySelectorAll<HTMLButtonElement>('#modal [data-a="share"],#modal [data-a="save"]').forEach(b => b.disabled = false);
  } catch {
    const m = $('#shareMsg'); if (m) m.textContent = 'Görsel hazırlanamadı. Metin olarak paylaşabilirsin.';
    const b = document.querySelector<HTMLButtonElement>('#modal [data-a="share"]'); if (b) { b.disabled = false; shareBlob = new Blob([]); }
  }
}
