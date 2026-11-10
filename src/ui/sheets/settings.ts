/* AYARLAR PANELİ — dil ve bölge, kurallar özeti, kira toplama, tema ve anahtarlar, hesap ve kayıt */
import { CITIES, PRIVACY_URL, REGIONS, REGION_ORDER, REGION, RegionId } from '../../config';
import { S } from '../../state';
import { esc } from '../../format';
import { Cloud } from '../../services/cloud';
import { Ads } from '../../services/ads';
import { resetGame, switchLang, switchRegion } from '../../game/loop';
import { toggleSound, toggleVib, setTheme, toggleNight, toggleRifki, setCollectMode, toggleNotif, linkAccount, deleteAccount } from '../../game/settings';
import { REGION_INFO } from '../../storage';
import { P } from '../../prefs';
import { type Theme } from '../../theme';
import { toast } from '../modal';
import { t, nm, LANG, LANGS } from '../../i18n';
import { Panel, STAY, openSheet, later } from './core';

export const settings: Panel<{ acct: ReturnType<typeof Cloud.account> }> = {
  sig(s, _tn, c) {
    const acct = c.acct = Cloud.account();
    return 's|' + LANG + REGION + JSON.stringify(REGION_INFO) + P.theme + S.night + S.rifki + S.collectMode + S.sound + (S.vib !== false) + S.notif + S.premium + S.noAds + S.club + (s.reset ? 1 : 0) + (s.del ? 1 : 0) + JSON.stringify(acct) + Ads.privacyRequired();
  },
  render(s, _tn, { acct }) {
    const regRow = (r: RegionId) => { const R = REGIONS[r], cur = r === REGION, inf = REGION_INFO[r];
      const st = cur ? t('şu an oynanıyor') : inf ? t('kayıtlı · {n} semt', { n: inf.own }) : t('başlanmadı');
      return `<button class="cm${cur ? ' on' : ''}" data-a="region" data-r="${r}"><span class="rd"></span><span class="di"><b>${t(R.n)} · ${R.cur}</b><small>${R.cities.map(c => nm(CITIES[c].n)).join(' · ')} · ${st}</small></span></button>`; };
    return `<p class="sec">${t('Dil ve bölge')}</p>
        <div class="langs">${LANGS.map(l => `<button class="chip${l.id === LANG ? ' on' : ''}" data-a="lang" data-l="${l.id}" lang="${l.id}" aria-pressed="${l.id === LANG}">${l.n}</button>`).join('')}</div>
        <div class="cmode">${REGION_ORDER.map(regRow).join('')}</div>
        <p class="note">${t('Her bölgenin ilerlemesi, tapuları ve sırası ayrıdır. Dil yalnızca metinleri değiştirir; şehirleri ve para birimini bölge belirler. Satın aldığın paketler tüm bölgelerde geçerli.')}</p>
        <p class="sec u-mt-7">${t('Nasıl oynanır')}</p>
        <ul class="rules">
          <li>${t('<b>Arsaya dokun</b>, inşaatı başlat. Bina kat kat yükselir.')}</li>
          <li>${t('Kira binaların kumbarasında birikir; ortadaki <b>TOPLA</b> mührüyle hepsini tek seferde al (ya da aşağıdan otomatiğe geç).')}</li>
          <li>${t('Kumbara dolunca kira birikmeyi bırakır. <b>Sık uğra.</b>')}</li>
          <li>${t('Aynı türü <b>yan yana</b> kur; bahçeler, teraslar birleşir ve daha çok kazandırır.')}</li>
          <li>${t('Semti doldur, <b>yeni semtin tapusunu</b> al. Başka illerde de arsa alabilirsin.')}</li>
        </ul>
        <div class="btns u-pull"><button class="btn soft" data-a="guide">${t('Kılavuzun tamamı')}</button></div>
        <p class="sec u-mt-2">${t('Kira toplama')}</p>
        <div class="cmode">
          <button class="cm${S.collectMode === 'tap' ? ' on' : ''}" data-a="cm-tap"><span class="rd"></span><span class="di"><b>${t('Tek tuşla topla')}</b><small>${t('Ortadaki TOPLA mührüne bas, bütün semtlerdeki kira tek seferde kasana geçsin.')}</small></span></button>
          <button class="cm${S.collectMode === 'auto' ? ' on' : ''}" data-a="cm-auto"><span class="rd"></span><span class="di"><b>${t('Otomatik')}</b><small>${t('Oyun açıkken kira kendiliğinden kasana akar.')}</small></span></button>
        </div>
        <div class="srow srow-col"><span id="thmL">${t('Tema')}</span><div class="seg" role="radiogroup" aria-labelledby="thmL">${([['auto', t('Otomatik')], ['light', t('Açık renk')], ['dark', t('Koyu renk')]] as [Theme, string][]).map(([v, l]) => `<button class="chip${P.theme === v ? ' on' : ''}" role="radio" aria-checked="${P.theme === v}" data-a="theme" data-v="${v}">${l}</button>`).join('')}</div></div>
        <div class="srow"><span>${t('Gece görünümü (19:00–06:00)')}</span><button class="sw${S.night !== false ? ' on' : ''}" role="switch" aria-checked="${!!(S.night !== false)}" data-a="night" aria-label="${t('Gece görünümü')}"></button></div>
        <div class="srow"><span>${t('Rıfkı Abi’nin ipuçları')}</span><button class="sw${S.rifki ? ' on' : ''}" role="switch" aria-checked="${!!(S.rifki)}" data-a="rifki" aria-label="${t('Rıfkı Abi’nin ipuçları')}"></button></div>
        <div class="srow"><span>${t('Ses')}</span><button class="sw${S.sound ? ' on' : ''}" role="switch" aria-checked="${!!(S.sound)}" data-a="sound" aria-label="${t('Ses')}"></button></div>
        <div class="srow"><span>${t('Titreşim')}</span><button class="sw${S.vib !== false ? ' on' : ''}" role="switch" aria-checked="${S.vib !== false}" data-a="vib" aria-label="${t('Titreşim')}"></button></div>
        <div class="srow"><span>${t('Bildirimler')}</span><button class="sw${S.notif ? ' on' : ''}" role="switch" aria-checked="${!!(S.notif)}" data-a="notif" aria-label="${t('Bildirimler')}"></button></div>
        <div class="srow"><span>${t('Reklamlar')}</span><span>${S.premium ? t('Kapalı (Holding paketi)') : S.club ? t('Kapalı (Emlak Kulübü)') : S.noAds ? t('Yalnızca isteğe bağlı (Reklamsız)') : Ads.native() ? t('Açık') : t('Test modu')}</span></div>
        <p class="sec u-mt-9">${t('Hesap ve kayıt')}</p>
        <div class="srow"><span>${t('Oyuncu kodun')}</span><span>${S.ref.code}</span></div>
        <div class="srow"><span>${t('Kayıt')}</span><span>${acct.enabled ? (acct.linked ? t('{p} hesabına bağlı', { p: esc(acct.provider) }) : t('Misafir · bulutta yedekleniyor')) : t('Bu cihazda')}</span></div>
        <div class="acct">
          ${acct.enabled && !acct.linked ? `<button class="btn soft" data-a="link-google">${t('Google ile bağla')}</button>${acct.apple ? `<button class="btn soft" data-a="link-apple">${t('Apple ile bağla')}</button>` : ''}` : ''}
          ${Ads.privacyRequired() ? `<button class="linkbtn" data-a="ads-privacy">${t('Reklam izinlerini yönet')}</button>` : ''}
          <button class="linkbtn" data-a="privacy">${t('Gizlilik politikası ve KVKK aydınlatma metni')}</button>
          ${acct.enabled ? `<button class="linkbtn u-stamp" data-a="delete">${s.del ? t('Emin misin? Hesabın ve tüm verilerin silinir') : t('Hesabımı ve verilerimi sil')}</button>` : ''}
        </div>
        <button class="txt u-stamp" data-a="reset">${s.reset ? t('Emin misin? Tekrar dokun') : t('Oyunu sıfırla')}</button>`;
  },
  /** Bekleyen işlem (hesap bağlama, reklam izinleri, silme, sıfırlama) söz döner; diğerlerinden sonra panel hemen yeniden çizilir. */
  action(a, btn, s) {
    if (a === 'guide') { openSheet({ k: 'guide' }); return STAY; }
    if (a === 'lang') { switchLang(btn.dataset.l!); return STAY; }
    if (a === 'region') { switchRegion(btn.dataset.r as RegionId); return STAY; }
    if (a === 'sound') toggleSound();
    if (a === 'vib') toggleVib();
    if (a === 'theme') setTheme(btn.dataset.v);
    if (a === 'night') toggleNight();
    if (a === 'rifki') toggleRifki();
    if (a === 'cm-tap' || a === 'cm-auto') setCollectMode(a === 'cm-auto' ? 'auto' : 'tap');
    if (a === 'notif') toggleNotif();
    if (a === 'link-google' || a === 'link-apple') return linkAccount(a === 'link-google' ? 'google' : 'apple');
    if (a === 'ads-privacy') return Ads.showPrivacyOptions();
    if (a === 'privacy') window.open(PRIVACY_URL, '_blank');
    if (a === 'delete') { if (s.del) return deleteAccount().then(() => STAY); s.del = true; later(s, 'del'); }
    if (a === 'reset') { if (s.reset) return resetGame().then(() => { toast(t('Yeni oyun')); return STAY; }); s.reset = true; later(s, 'reset'); }
  },
};
