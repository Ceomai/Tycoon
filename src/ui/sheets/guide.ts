/* KILAVUZ PANELLERİ — konu listesi (tasarım K3) ve konu sayfası (tasarım K4) */
import { chapters } from '../../game/guide';
import { $, ui } from '../ctx';
import { t } from '../../i18n';
import { Panel, STAY, openSheet, renderSheet, slideBody } from './core';

export const guide: Panel = {
  sig: () => 'gd',
  render() {
    const C = chapters();
    return `<div class="lghead"><div><p class="sec">${t('Kılavuz · {n} madde', { n: C.length })}</p><h4 class="lgt">${t('Emlakçının el kitabı')}</h4>
        <small class="gdsub">${t('Oyunun tüm kuralları, sayılarıyla. İstediğin maddeye dokun.')}</small></div>
        <svg class="lgseal" viewBox="0 0 100 100" aria-hidden="true"><g transform="rotate(-9 50 50)"><circle cx="50" cy="50" r="44" fill="none" stroke="currentColor" stroke-width="3.5"/><circle cx="50" cy="50" r="36" fill="none" stroke="currentColor" stroke-width="1.2"/><text x="50" y="62" text-anchor="middle" font-family="IBM Plex Mono" font-weight="600" font-size="38" fill="currentColor">?</text></g></svg></div>
        <div class="gdlist">${C.map((c, i) => `<button class="gditem" data-a="open" data-i="${i}"><span class="no">${String(i + 1).padStart(2, '0')}</span><span class="di"><b>${t(c.t)}</b><small>${t(c.s)}</small></span>${c.isNew ? `<span class="st">${t('YENİ')}</span>` : ''}<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg></button>`).join('')}</div>`;
  },
  action(a, btn) { if (a === 'open') { openSheet({ k: 'guideItem', i: +btn.dataset.i! }); return STAY; } },
};

type GiC = { C: ReturnType<typeof chapters>; i: number };
export const guideItem: Panel<GiC> = {
  sig(s, _tn, c) {
    const C = c.C = chapters(); c.i = Math.max(0, Math.min(C.length - 1, s.i || 0));
    return 'gi|' + c.i;
  },
  render(_s, _tn, { C, i }) {
    const c = C[i], no = (n: number) => String(n + 1).padStart(2, '0');
    return `<button class="gdback" data-a="list"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>${t('Kılavuz')}</button>
        <div class="gdhead"><div><p class="sec gdno">${t('Madde {n}', { n: no(i) })}</p><h4 class="lgt">${t(c.t)}</h4></div><div class="gdart bpbg">${c.art()}</div></div>
        ${c.body.map(b => `<p class="gdp">${b}</p>`).join('')}
        <div class="lgrw gdfacts">${c.facts.map(([k, v]) => `<div><span>${k}</span><b>${v}</b></div>`).join('')}</div>
        ${c.tip ? `<div class="gdtip"><span class="st">${t('İPUCU')}</span><span>${c.tip}</span></div>` : ''}
        <div class="gdnav">${i > 0 ? `<button class="gdprev" data-a="prev"><small>← ${t('Madde {n}', { n: no(i - 1) })}</small><b>${t(C[i - 1].t)}</b></button>` : '<span></span>'}${i < C.length - 1 ? `<button class="gdnext" data-a="next"><small>${t('Madde {n}', { n: no(i + 1) })} →</small><b>${t(C[i + 1].t)}</b></button>` : '<span></span>'}</div>`;
  },
  /** Önceki/sonraki madde aynı panelde: yön duyarlı geçiş, sayfa başa döner. */
  action(a, _btn, s) {
    if (a === 'list') { openSheet({ k: 'guide' }); return STAY; }
    if (a === 'prev' || a === 'next') { s.i = (s.i || 0) + (a === 'next' ? 1 : -1); ui.sheetSig = ''; $('#sheetBody').scrollTop = 0; renderSheet(); slideBody(a === 'next' ? 1 : -1); return STAY; }
  },
};
