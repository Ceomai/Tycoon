/* HAFTANIN ÖZEL TAPUSU PANELİ (tasarım F5) */
import { CFG } from '../../config';
import { S } from '../../state';
import { fmt, weekKey } from '../../format';
import { svg } from '../../draw';
import { buySpecial, specialPrice } from '../../game/actions';
import { specialSvg, weekSpecial } from '../../specials';
import { weekEndsAt, fmtLeft } from '../../game/league';
import { t } from '../../i18n';
import { Panel, STAY } from './core';

export const ozel: Panel = {
  sig(_s, tn) {
    const wk = weekKey(new Date(tn)), price = specialPrice(), got = S.ozel.week === wk && S.ozel.bought;
    return 'oz|' + wk + got + (S.cash >= price ? 1 : 0) + Math.floor(price) + Math.floor((weekEndsAt(tn) - tn) / 3600e3) + S.inv.join();
  },
  render(_s, tn) {
    const wk = weekKey(new Date(tn)), sp = weekSpecial(wk), price = specialPrice(), got = S.ozel.week === wk && S.ozel.bought;
    return `<div class="lghead"><div><p class="sec">${t('Haftanın özel tapusu')}</p><h4 class="lgt">${t(sp.n)}</h4><small class="lgsub u-stamp">${t('Satış bitişi {s}', { s: fmtLeft(weekEndsAt(tn) - tn) })}</small></div><span class="st spst">${t('NADİR')}</span></div>
        <div class="spart bpbg">${svg(specialSvg(sp.id), 'art')}</div>
        <p class="gdp">${t('{d}. Boş bir arsaya yerleştirilir; kat çıkılmaz ama tek başına çok kazandırır.', { d: t(sp.d) })}</p>
        <div class="lgrw"><div><span>${t('Kira')}</span><b>${t('semtteki en iyi binanın 3 katı')}</b></div><div><span>${t('Komşularına')}</span><b>${t('her yöne +%{n}', { n: Math.round(CFG.SP_ADJ * 100) })}</b></div><div><span>${t('Kat çıkma')}</span><b>${t('yok · tek seviye')}</b></div><div><span>${t('Holding kurunca')}</span><b>${t('depoda kalır')}</b></div></div>
        <div class="btns">${got ? `<button class="btn" disabled>${t('Bu haftanın tapusu alındı')}</button>` : `<button class="btn lotb" data-a="buyozel" ${S.cash >= price ? '' : 'disabled'}><span class="lbl">${t('Tapuyu al')} · ${fmt(price)}</span><small>${t('sonra boş bir arsaya yerleştir')}</small></button>`}</div>
        ${S.inv.length ? `<p class="note">${t('Depoda {n} özel yapı var: boş bir arsaya dokunup yerleştir.', { n: S.inv.length })}</p>` : ''}
        <p class="note u-tc">${t('Her hafta farklı bir yapı: Han, Pasaj, Yalı Köşkü, Bahçeli Köşk.')}</p>`;
  },
  action(a) { if (a === 'buyozel') { buySpecial(); return STAY; } },
};
