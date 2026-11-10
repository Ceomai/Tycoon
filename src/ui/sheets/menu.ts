/* MENÜ PANELİ — paylaş, lig, davet, sezon, arşiv, haftanın özel tapusu, başlangıç paketi, mağaza, holding, ayarlar */
import { SERVER_FEATURES } from '../../config';
import { S } from '../../state';
import { fmt, fmtX, clock, weekKey } from '../../format';
import { now } from '../../economy';
import { I } from '../../icons';
import { weekSpecial } from '../../specials';
import { ACH, seasonLevel, seasonName, seasonId, seasonClaimable, SEASON_LV } from '../../game/fun';
import { canHolding, sharesPreview } from '../../game/collection';
import { openShare } from '../../game/share';
import { starterActive, starterLeft, showStarter } from '../../game/monetize';
import { leagueName } from '../../game/league';
import { t } from '../../i18n';
import { SheetKind } from '../ctx';
import { Panel, STAY, openSheet, closeSheet, lv } from './core';

/* haftanın özel tapusu bu hafta alınabilir mi */
const ozelAvail = () => { const wk = weekKey(new Date(now())); return !(S.ozel.week === wk && S.ozel.bought); };

export const menu: Panel = {
  sig: () => 'mn|' + starterActive() + S.noAds + S.club + S.ach.length + seasonLevel() + seasonClaimable() + S.league.tier + canHolding() + S.premium + (S.shares || 0) + (canHolding() ? sharesPreview() : '') + ozelAvail(),
  render(_s, tn) {
    const row = (a: string, ic: string, b: string, sm: string, dot = false) => `<button class="drow" data-a="${a}"><span class="ic">${ic}${dot ? '<span class="dot"></span>' : ''}</span><span class="di"><b>${b}</b><small>${sm}</small></span></button>`;
    return `<p class="sec">${t('Menü')}</p><div class="dlist">
        ${row('share', I.share, t('Şehrini paylaş'), t('Story görseli, davet kodunla'))}
        ${!SERVER_FEATURES ? '' : row('lb', I.trophy, t('Haftalık lig'), `${leagueName(S.league.tier)} · ${t('bu hafta {m}', { m: lv('wk', () => fmt(S.week.earned)) })}`)}
        ${!SERVER_FEATURES ? '' : row('ref', I.users, t('Arkadaşını davet et'), t('Kodun: {c}', { c: S.ref.code }))}
        ${row('sezon', I.crown, t('Tapu sezonu'), `${seasonName(seasonId())} · ${t('basamak {l}/{m}', { l: seasonLevel(), m: SEASON_LV })}${S.season && S.season.gold ? ' · ' + t('Altın') : ''}`, seasonClaimable())}
        ${row('arsiv', I.trophy, t('Tapu arşivi'), t('{n}/{m} mühür · kira +%{p}', { n: S.ach.length, m: ACH.length, p: Math.floor(S.ach.length / 4) }))}
        ${row('ozel', I.tower, t('Haftanın özel tapusu'), ozelAvail() ? t('{ad} satışta', { ad: t(weekSpecial(weekKey(new Date(tn))).n) }) : t('{ad} alındı', { ad: t(weekSpecial(weekKey(new Date(tn))).n) }), ozelAvail())}
        ${starterActive() ? row('starter', I.crown, t('Başlangıç paketi'), t('Yalnızca bir kez · bitiş {c}', { c: lv('stl', () => clock(starterLeft())) }), true) : ''}
        ${row('store', I.noads, t('Mağaza'), S.premium ? t('Holding paketi aktif') : S.club ? t('Emlak Kulübü aktif') : S.noAds ? t('Reklamsız aktif · jetonlar, sezon') : t('Reklamsız, Holding, Kulüp, jetonlar'))}
        ${row('holding', I.tower, t('Holding kur'), canHolding() ? t('{n} hisse hazır', { n: sharesPreview() }) : S.shares ? t('{n} hisse · kiralar {x}', { n: S.shares, x: fmtX(1 + 0.1 * S.shares) }) : t('Bir ilin 5. semtini alınca açılır'), canHolding())}
        ${row('set', I.gear, t('Ayarlar'), t('Ses, bildirim, hesap, gizlilik'))}
      </div>`;
  },
  /** Menü satırları: paylaşım ve başlangıç paketi kart açar; gerisi aynı adlı paneli. */
  action(a) {
    if (a === 'share') openShare();
    else if (a === 'starter') { closeSheet(); showStarter(); }
    else openSheet({ k: a as SheetKind });
    return STAY;
  },
};
