/* TAPU SEZONU PANELİ (tasarım H8) — basamaklar, ücretsiz ve Altın yol ödülleri */
import { S } from '../../state';
import { fmtLeft } from '../../game/league';
import { ensureSeason, seasonLevel, seasonReward, seasonLeft, seasonName, seasonClaimable, claimSeason, SEASON_LV, XP_PER } from '../../game/fun';
import { buySeasonGold } from '../../game/monetize';
import { Purchases } from '../../services/purchases';
import { t } from '../../i18n';
import { Panel, STAY, off } from './core';

export const sezon: Panel = {
  sig() {
    ensureSeason(); const sv = S.season;
    return 'se|' + S.seasonFirst + sv.id + sv.xp + sv.got.length + sv.ggot.length + sv.gold + Math.floor(seasonLeft() / 3600e3) + Purchases.state() + Purchases.seasonPrice();
  },
  render() {
    const lv = seasonLevel(), sv = S.season;
    const from = Math.max(1, Math.min(SEASON_LV - 5, lv - 1)), cols = Array.from({ length: 6 }, (_, q) => from + q);
    const cell = (l: number, gold: boolean) => { const r = seasonReward(l, gold), got = (gold ? sv.ggot : sv.got).includes(l), ready = l <= lv && !got && (!gold || sv.gold); return `<span class="sc ${gold ? 'g' : ''}${got ? ' got' : ready ? ' rd' : ''}${l > lv || (gold && !sv.gold) ? ' lk' : ''}">${r.label}</span>`; };
    return `<div class="lghead"><div><p class="sec">${t('Tapu sezonu')} · ${seasonName(sv.id)}</p><h4 class="lgt">${t('Basamak {l} / {m}', { l: lv, m: SEASON_LV })}</h4><small class="lgsub u-stamp">${t('Sezon bitişi {s}', { s: fmtLeft(seasonLeft()) })}</small></div><span class="gseal">${t('ALTIN<br>TAPU')}</span></div>
        <span class="dp"><u style="width:${lv >= SEASON_LV ? 100 : Math.round((sv.xp % XP_PER) / XP_PER * 100)}%"></u></span>
        <small class="lgsub">${lv >= SEASON_LV ? t('Sezon tamamlandı!') : t('{n} / {m} puan', { n: sv.xp % XP_PER, m: XP_PER })} · ${t('kira topla, görev bitir, kat çık, ligde yüksel')}</small>
        <div class="sgrid"><span class="sl"></span>${cols.map(l => `<span class="sn${l === lv ? ' cur' : ''}">${l}</span>`).join('')}
          <span class="sl">${t('ÜCRETSİZ')}</span>${cols.map(l => cell(l, false)).join('')}
          <span class="sl g">${t('ALTIN')}</span>${cols.map(l => cell(l, true)).join('')}</div>
        <div class="btns"><button class="btn gold" data-a="sclaim" ${seasonClaimable() ? '' : 'disabled'}>${t('Ödülleri al')}</button></div>
        ${sv.gold ? `<p class="note u-tc">${t('Altın Tapu bu sezon açık · her basamakta ek ödül')}</p>` : `<div class="gbox"><span><b>${t('Altın Tapu')}</b><small>${t('Her basamakta ek ödül, sezona özel altın cephe ve 30. basamakta özel yapı.')}</small></span><button class="btn gprice" data-a="sgold"${off(!S.seasonFirst ? 'sezonIlk' : 'sezon')}>${!S.seasonFirst ? `<s>${Purchases.seasonFull()}</s>` : ''}${Purchases.seasonPrice()}</button></div>`}
        <p class="note">${t('Ödüller: nakit, 2x jetonu (bir mülke reklamsız 1 saat 2x), cephe renkleri; 30. basamakta büyük ödül. Her ayın başında yeni sezon.')}</p>`;
  },
  action(a) {
    if (a === 'sclaim') { claimSeason(); return STAY; }
    if (a === 'sgold') { void buySeasonGold(true); return STAY; } // sezon panelinden: birikmiş altın ödüller hemen verilir
  },
};
