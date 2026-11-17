/* KOLEKSİYON (tarihi yapılar) ve TAPU ARŞİVİ (tasarım H4) panelleri */
import { S } from '../../state';
import { collBonus } from '../../economy';
import { svg } from '../../draw';
import { LM, lmSvg, IHALE_LM } from '../../landmarks';
import { CFG, REGION } from '../../config';
import { IH, lmPool, ihaleUnlocked } from '../../game/auccore';
import { pctTxt } from '../../i18n';
import { ACH } from '../../game/fun';
import { ui } from '../ctx';
import { t, pn } from '../../i18n';
import { Panel, STAY } from './core';

/** İhale salonu: rakip emlakçıyla ihaleyle alınan yapılar (bölge başına 4; Global'de hangi ülkeden olursa). */
function salon(): string {
  const got = IH().got, max = Math.max(0, Math.floor(CFG.IH_LM_N));
  if (!got.length && !ihaleUnlocked()) return '';
  const pool = REGION === 'gl' ? [...got.map(id => IHALE_LM.find(l => l.id === id)!).filter(Boolean), ...lmPool(S.cur.split('-')[0]).filter(l => !got.includes(l.id))].slice(0, max) : lmPool('');
  return `<p class="sec ih-salh">${t('İhale salonu')} · ${Math.min(got.length, max)}/${max}</p>
    <p class="note u-m0b-6">${t('Rakip emlakçıyla ihaleden alınır. Her yapı tüm kiraları kalıcı {p} artırır; lig puanına sayılmaz.', { p: pctTxt(Math.round(CFG.IH_LM_X * 100)) })}</p>
    <div class="coll salon">${pool.map(l => { const has = got.includes(l.id); return `<div class="lmc bpbg${has ? '' : ' no'}">${svg(lmSvg(l.id))}<b>${has ? pn(t(l.n)) : t('İhalede')}</b></div>`; }).join('')}</div>`;
}
export const coll: Panel = {
  sig: () => 'co|' + S.coll.join() + '|' + IH().got.join() + ihaleUnlocked(),
  render: () => `<p class="sec">${t('Tarihi yapılar')} · ${S.coll.length}/${LM.length}</p>
        <p class="note u-m0b-6">${t('Her yapı tüm kiraları kalıcı %5 artırır, hepsini toplayana ek %10. Etkinliklerden ve altın taksiden çıkar. Şu an <b>+%{p}</b>.', { p: Math.round(collBonus() * 100) })}</p>
        <div class="coll">${LM.map(l => { const has = S.coll.includes(l.id); return `<div class="lmc bpbg${has ? '' : ' no'}">${svg(lmSvg(l.id))}<b>${has ? pn(t(l.n)) : t('Bulunmadı')}</b></div>`; }).join('')}</div>
        ${salon()}`,
};

export const arsiv: Panel = {
  sig: s => 'ar|' + S.ach.join() + (s.sel || ''),
  render(s) {
    const n = S.ach.length, sel = ACH.find(a => a.id === s.sel);
    return `<div class="lghead"><div><p class="sec">${t('Tapu arşivi · {n}/{m} mühür', { n, m: ACH.length })}</p><h4 class="lgt">${t('Emlakçının albümü')}</h4></div><span class="arb">${t('kira +%{p}', { p: Math.floor(n / 4) })}</span></div>
        <span class="dp u-mb-6"><u class="u-bg-stamp" style="width:${Math.round(n / ACH.length * 100)}%"></u></span>
        <div class="argrid">${ACH.map((a, j) => `<button class="arst${S.ach.includes(a.id) ? ' on' : ''}${s.sel === a.id ? ' sel' : ''}" data-a="arsel" data-id="${a.id}" style="--rot:${[-8, 6, -4, 9, -6, 4][j % 6]}deg">${t(a.n)}</button>`).join('')}</div>
        <div class="ardet">${sel ? `<b>${t(sel.n)}</b><span>${t(sel.d)}</span><em>${S.ach.includes(sel.id) ? t('Kazanıldı') : t('Henüz kazanılmadı')}</em>` : t('Bir mühre dokun: nasıl kazanılacağını gör.')}</div>
        <p class="note">${t('Her 4 mühür tüm kiralara kalıcı +%1. 8 ve 16 mühürde yeni cephe renkleri açılır.')}</p>`;
  },
  action(a, btn, s) { if (a === 'arsel') { s.sel = btn.dataset.id; ui.sheetSig = ''; return STAY; } },
};
