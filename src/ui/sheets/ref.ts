/* DAVET PANELİ — davet kodu, davet mesajı, arkadaşın kodu */
import { S } from '../../state';
import { esc } from '../../format';
import { I } from '../../icons';
import { copyText, shareTextOnly } from '../../game/share';
import { useCode } from '../../game/referral';
import { $ } from '../ctx';
import { t } from '../../i18n';
import { Panel } from './core';

export const ref: Panel = {
  sig: () => 'rf|' + S.ref.used + S.ref.code,
  render: () => `<p class="sec">${t('Davet kodun')}</p><div class="codebox"><b>${S.ref.code}</b><button class="chip" data-a="copy">${t('Kopyala')}</button></div>
        <div class="btns u-mt0"><button class="btn gold" data-a="sharetext">${I.share} ${t('Davet mesajı gönder')}</button></div>
        <p class="note">${t('Arkadaşın senin kodunu girince ikinize de tapu hediyesi (nakit) verilir.')}</p>
        <p class="sec u-mt-10">${t('Arkadaşının kodu')}</p>
        ${S.ref.used ? `<p class="note u-mt0">${t('Kullandığın kod: <b>{c}</b>', { c: esc(S.ref.used) })}</p>` : `<div class="row2"><input id="refInput" class="inp" maxlength="6" placeholder="TP0000" autocomplete="off" autocapitalize="characters" spellcheck="false" aria-label="${t('Arkadaşının davet kodu')}"><button class="chip" data-a="usecode">${t('Kullan')}</button></div>`}`,
  action(a) {
    if (a === 'copy') copyText(S.ref.code);
    if (a === 'sharetext') shareTextOnly();
    if (a === 'usecode') return useCode(($('#refInput') || {}).value).then(() => undefined);
  },
};
