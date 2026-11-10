/* MAĞAZA PANELİ (tasarım M6–M7) — üç basamak, jetonlar, Altın Tapu, geri yükleme */
import { PRIVACY_URL, TERMS_URL } from '../../config';
import { S } from '../../state';
import { clock } from '../../format';
import { I } from '../../icons';
import { Purchases, adFree, type ProductKey } from '../../services/purchases';
import { starterActive, starterLeft, showStarter, buyTokens, buySeasonGold } from '../../game/monetize';
import { ui } from '../ctx';
import { t } from '../../i18n';
import { Panel, STAY, closeSheet, lv, off } from './core';

export const store: Panel = {
  sig: () => 'st|' + S.premium + S.noAds + S.club + S.tokens + S.seasonFirst + (S.season && S.season.gold) + starterActive() + Purchases.state() + Purchases.price('holding') + Purchases.price('reklamsiz'),
  render() {
    const li = (ok: boolean, x: string) => `<li class="${ok ? '' : 'no'}">${ok ? I.check : '–'}<span>${x}</span></li>`;
    const tier = (key: string, name: string, items: [boolean, string][], price: string, own: boolean, tag = '', best = false, sub = '') =>
      `<div class="tier${best ? ' best' : ''}">${tag ? `<span class="ttag">${tag}</span>` : ''}<div class="tl"><b>${name}</b><ul>${items.map(([o, x]) => li(o, x)).join('')}</ul></div>
          ${own ? `<button class="btn" disabled>${t('Aktif')}</button>` : `<button class="btn${best ? ' gold' : ''}" data-a="buyp" data-p="${key}"${off(key as ProductKey)}>${price}${sub ? `<small>${sub}</small>` : ''}</button>`}</div>`;
    const ss = S.season && S.season.gold, st = Purchases.state();
    return `<div class="sh-head"><div class="badge u-m0">${I.crown}</div><div class="sh-t"><h3>${t('Mağaza')}</h3><p>${t('Oyun aynı; yalnızca reklam ve hız tercihi')}</p></div></div>
        ${st === 'error' ? `<div class="sterr" role="alert"><p>${t('Mağaza şu an kullanılamıyor')}<small>${t('Fiyatlar yüklenemedi. İnternet bağlantını kontrol edip tekrar dene.')}</small></p><button class="chip" data-a="storeretry">${t('Tekrar dene')}</button></div>` : st === 'loading' ? `<p class="note u-mt0" role="status">${t('Fiyatlar yükleniyor…')}</p>` : ''}
        ${starterActive() ? `<button class="drow starterrow" data-a="starter"><span class="ic">${I.crown}<span class="dot"></span></span><span class="di"><b>${t('Başlangıç paketi')}</b><small>${t('Yalnızca bir kez · bitiş {c}', { c: lv('stl', () => clock(starterLeft())) })}</small></span><span class="pr">${Purchases.price('baslangic')}</span></button>` : ''}
        <p class="sec">${t('Paketler')}</p>
        ${tier('reklamsiz', t('Reklamsız'), [[true, t('Geçiş reklamı yok')], [true, t('Ödüllü reklamlar isteğe bağlı, ödül verir')], [false, t('Ödüller anında')], [false, t('Kalıcı 2x kira')]], Purchases.price('reklamsiz'), adFree())}
        ${tier('holding', t('Holding paketi'), [[true, t('Geçiş reklamı yok')], [true, t('Ödüller izlemeden, anında')], [true, t('Tüm kiralar kalıcı 2 kat')]], Purchases.price('holding'), S.premium, t('EN ÇOK DEĞER'), true)}
        ${tier('kulup', t('Emlak Kulübü'), [[true, t('Geçiş reklamı yok')], [true, t('Ödüller anında')], [true, t('Her gün 1 adet 2x jetonu')], [true, t('Altın Tapu sezonu dahil')], [false, t('Kalıcı 2x kira')]], Purchases.price('kulup'), S.club, t('ABONELİK'), false, t('/ay'))}
        ${S.club ? '' : `<p class="note subnote">${t('Emlak Kulübü aylık otomatik yenilenen bir aboneliktir. Ödeme, satın almayı onayladığında mağaza hesabından alınır; dönem bitmeden en az 24 saat önce iptal edilmezse aynı fiyatla yenilenir. Aboneliğini mağaza hesap ayarlarından yönetebilir ve iptal edebilirsin.')} <button class="linkbtn" data-a="privacy">${t('Gizlilik politikası')}</button> · <button class="linkbtn" data-a="terms">${t('Kullanım koşulları')}</button></p>`}
        <p class="sec">${t('2x jetonu · reklamsız 1 saat 2x')}</p>
        <div class="jets"><div class="jet"><span class="h2c">2x</span><b>× 5</b><small>${t('5 saat 2x')}</small><button class="btn" data-a="jet" data-n="5"${off('jeton5')}>${Purchases.price('jeton5')}</button></div>
          <div class="jet best"><span class="ttag">${t('%25 KÂR')}</span><span class="h2c">2x</span><b>× 15</b><small>${t('15 saat 2x')}</small><button class="btn gold" data-a="jet" data-n="15"${off('jeton15')}>${Purchases.price('jeton15')}</button></div></div>
        <p class="note">${t('Elindeki jeton: <b>{n}</b>. Jeton, mülk panelindeki “2x jetonu kullan” düğmesiyle harcanır.', { n: S.tokens })}</p>
        <p class="sec">${t('Tapu sezonu')}</p>
        ${ss ? `<p class="note u-tc">${t('Altın Tapu bu sezon açık')}${S.club ? ' · ' + t('Kulüp ile dahil') : ''}</p>` : `<div class="gbox"><span><b>${t('Altın Tapu')}</b><small>${!S.seasonFirst ? t('İlk sezonuna özel yarı fiyat.') + ' ' : ''}${t('Her basamakta ek ödül, 30. basamakta özel yapı.')}</small></span><button class="btn gprice" data-a="sgold"${off(!S.seasonFirst ? 'sezonIlk' : 'sezon')}>${!S.seasonFirst ? `<s>${Purchases.seasonFull()}</s>` : ''}${Purchases.seasonPrice()}</button></div>`}
        <p class="note">${t('Holding’i alan Reklamsız’ı da almış sayılır. Kulüp iptal edilince geçiş reklamı geri gelir; kazanılan jetonlar ve sezon ödülleri kalır.')}</p>
        <div class="btns"><button class="txt" data-a="restore">${t('Satın alımları geri yükle')}</button></div>`;
  },
  action(a, btn) {
    if (a === 'buy') { void Purchases.buy(); return STAY; }
    if (a === 'buyp') { void Purchases.buyProduct(btn.dataset.p as ProductKey); return STAY; }
    if (a === 'jet') { void buyTokens(+btn.dataset.n! === 15 ? 15 : 5); return STAY; }
    if (a === 'starter') { closeSheet(); showStarter(); return STAY; }
    if (a === 'sgold') { void buySeasonGold(false); return STAY; } // mağazadan: ödüller sezon panelinde alınır
    if (a === 'restore') { void Purchases.restore(); return STAY; }
    if (a === 'storeretry') { void Purchases.retry(); ui.sheetSig = ''; return STAY; }
    if (a === 'privacy') { window.open(PRIVACY_URL, '_blank'); return STAY; }
    if (a === 'terms') { window.open(TERMS_URL, '_blank'); return STAY; }
  },
};
