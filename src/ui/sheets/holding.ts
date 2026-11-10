/* HOLDING PANELİ — hisse önizlemesi ve holding kurma (onaylı) */
import { S } from '../../state';
import { fmtX } from '../../format';
import { I } from '../../icons';
import { canHolding, sharesPreview, doHolding } from '../../game/collection';
import { t } from '../../i18n';
import { Panel, STAY, later } from './core';

export const holding: Panel<{ n: number }> = {
  sig(s, _tn, c) {
    const n = c.n = sharesPreview();
    return 'ho|' + n + canHolding() + (s.conf ? 1 : 0) + (S.shares || 0) + S.own.join();
  },
  render(s, _tn, { n }) {
    return `<div class="sh-head"><div class="badge u-m0">${I.tower}</div><div class="sh-t"><h3>${t('Holding')}</h3><p>${t('{n} hisse · kiralar {x}', { n: S.shares || 0, x: fmtX(1 + 0.1 * (S.shares || 0)) })}</p></div></div>
        <p class="note u-mt0">${t('Herhangi bir ilin 5. semtinin tapusunu alınca holding kurabilirsin. Semtler ve binalar sıfırlanır; kazandığın hisseler kiraları kalıcı olarak artırır. Koleksiyon, seri, davet ve satın alımlar korunur.')}</p>
        <div class="task"><div class="tt"><b>${t('Bu turda kazanılacak hisse')}</b><small>${t('Her hisse +%10 kira · bu turdaki toplam kazanca göre')}</small></div><b class="u-num">${n}</b></div>
        <div class="btns">${canHolding() ? `<button class="btn gold" data-a="hold">${s.conf ? t('Emin misin? Tekrar dokun') : t('Holding kur')}</button>` : `<button class="btn" disabled>${n < 1 ? t('En az 1 hisse gerekli') : t('Önce bir ilin 5. semti')}</button>`}</div>`;
  },
  action(a, _btn, s) { if (a === 'hold') { if (s.conf) { doHolding(); return STAY; } s.conf = true; later(s, 'conf'); } },
};
