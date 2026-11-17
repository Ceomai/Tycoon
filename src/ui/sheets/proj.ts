/* PROJE PANELİ: büyük projeye dokununca açılır. Çizim, ad, tür ve etap; dört bina; kira dökümü; kiracılar;
   2. etap (kat ekle) ve "Projeyi ayır" (iki dokunuşla). Proje inşaatında reklamla hızlandırma ve 2x yok. */
import { CFG, DMAP } from '../../config';
import { S, Pj } from '../../state';
import { fmt, fmtCost, fmtTime, clock, esc } from '../../format';
import { pjOf, pjCells, pjX, rate, tenantMult } from '../../economy';
import { projSvg, projSite, psvg } from '../../projdraw';
import { pjName, styleOf, pjCost, pjTime, upgradeProject, splitProject, KIND_N, pjMinLv } from '../../game/project';
import { tenantAt, tName, bonusPct } from '../../game/tenants';
import { I } from '../../icons';
import { t, nm, pctTxt } from '../../i18n';
import { $ } from '../ctx';
import { Panel, STAY, later, lv } from './core';
import { pjChips, pjRates } from '../pjcard';

const progOf = (q: Pj, tn: number) => Math.max(0, Math.min(1, 1 - (q.until - tn) / q.dur));
/** Projedeki (sözleşmesi süren) kiracılar. */
const liveTen = (k: string, q: Pj) => pjCells(q.a).map(j => tenantAt(k, j)).filter(x => x && x.st === 'live');

export const proj: Panel<{ q: Pj | null }> = {
  sig(s, tn, c) {
    const q = c.q = pjOf(s.key!, s.i!); if (!q) return 'none';
    const k = s.key!;
    return 'pj|' + q.a + q.st + (q.until ? 1 : 0) + (q.st === 1 && !q.until && S.cash >= pjCost(k, q.a, 2) ? 1 : 0) + (s.del ? 1 : 0)
      + (q.until ? Math.floor(progOf(q, tn) * 20) : '') + liveTen(k, q).map(x => x!.id).join();
  },
  render(s, tn, { q }) {
    if (!q) return `<p class="gdp">${t('Proje ayrıldı · dört bina yerinde')}</p>`;
    const k = s.key!, name = pjName(k, q.kd), stage = Math.max(1, q.st + (q.until ? 1 : 0));
    const art = q.until ? projSite(q.kd, styleOf(k), q.st + 1, progOf(q, tn), 'pjsc') : projSvg(q.kd, styleOf(k), q.st);
    const head = `<div class="sh-head pj-head"><div class="sh-art bpbg pjsh" data-pjart>${psvg(art)}</div><div class="sh-t"><h3>${esc(name)}${q.st >= 2 ? ' II' : ''}</h3><p>${nm(DMAP[k].n)} · ${t(KIND_N[q.kd])} · ${t('Etap {s}/2', { s: stage })}</p></div>
      <button class="iconbtn${s.del ? ' warn' : ''}" data-a="split" aria-label="${s.del ? t('Ayırmayı onayla') : t('Projeyi ayır')}">${I.trash}</button></div>
      ${s.del ? `<p class="sec u-tc u-m0b-4">${t('Tekrar dokunursan proje ayrılır · dört bina Sv {lv} olarak kalır, bedel iade edilmez', { lv: pjMinLv() })}</p>` : ''}`;
    const tens = liveTen(k, q).map(x => `<div><span>${t('Kiracı · {n}', { n: esc(tName(x!.a, k)[0]) })}</span><i></i><b class="up">+${bonusPct()} · ${lv('pjt' + x!.id, () => t('{m} dk', { m: Math.ceil(Math.max(0, x!.end - S.playMs) / 60e3) }))}</b></div>`).join('');
    if (q.until) return `${head}<div class="cd"><span class="sec">${q.st ? t('2. etap') : t('Proje inşaatı')}</span><span class="cdv" data-cd>${clock(q.until - tn)}</span></div>
      <div class="prog pjpb"><i data-pb style="width:${(progOf(q, tn) * 100).toFixed(1)}%"></i></div>
      <p class="note">${t('İnşaat sürerken dört bina kira vermeye devam eder.')}</p>${pjChips(k, q.a)}
      ${tens ? `<div class="ledger">${tens}</div>` : ''}
      <div class="btns"><button class="txt" data-a="close">${t('Bekle')}</button></div>`;
    // binaların kendi kirası: proje bonusu çıkarılmış (kiracı bonusu toplamsal: r × m / (m + x))
    const own = pjCells(q.a).reduce((x, j) => { const m = tenantMult(k, j); return x + rate(k, j) * m / (m + pjX(q.st)); }, 0);
    const c2 = pjCost(k, q.a, 2), can2 = q.st === 1;
    const after2 = can2 ? pjRates(k, q.a, CFG.PJ_X2 - CFG.PJ_X1)[1] : 0;
    return `${head}${pjChips(k, q.a)}
      <div class="ledger">
        <div><span>${t('Proje kirası')}</span><i></i><b>${lv('pjsum', () => t('{v}/sn', { v: fmt(pjCells(q.a).reduce((x, j) => x + rate(k, j), 0), true) }))}</b></div>
        <div><span>${t('Dört binanın kendi kirası')}</span><i></i><b>${t('{v}/sn', { v: fmt(own, true) })}</b></div>
        <div><span>${t('Proje bonusu')}</span><i></i><b class="up">+${pctTxt(Math.round(pjX(q.st) * 100))}</b></div>
        ${tens}
        <div><span>${t('Komşuluk ve semt kuralı')}</span><i></i><b>${t('aynen sayılır')}</b></div>
        ${can2 ? `<div><span>${t('2. etap olunca')}</span><i></i><b>${t('{v}/sn', { v: fmt(after2, true) })} · +${pctTxt(Math.round(CFG.PJ_X2 * 100))}</b></div>` : ''}
      </div>
      <div class="btns">${can2 ? `<button class="btn" data-a="pj2" ${S.cash >= c2 ? '' : 'disabled'}>${t('2. etap · kat ekle')} · ${fmtCost(c2)} <small>${fmtTime(pjTime(k, q.a, 2))}</small></button>` : `<button class="btn" disabled>${t('Son etap')}</button>`}</div>`;
  },
  live(s, tn) {
    const q = pjOf(s.key!, s.i!); if (!q || !q.until) return;
    const pb = $('#sheetBody [data-pb]'), cd = $('#sheetBody [data-cd]');
    if (pb) pb.style.width = (progOf(q, tn) * 100).toFixed(1) + '%';
    if (cd) cd.textContent = clock(q.until - tn);
  },
  action(a, _btn, s) {
    const q = pjOf(s.key!, s.i!); if (!q) return;
    if (a === 'pj2') { upgradeProject(s.key!, q); return STAY; }
    if (a === 'split') { if (s.del) { splitProject(s.key!, q); return STAY; } s.del = true; later(s, 'del'); }
  },
};
