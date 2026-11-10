/* AYARLAR — ayar düğmelerinin durum değişiklikleri. Ayarlar paneli (ui/sheets/settings.ts) yalnızca bunları çağırır. */
import { S } from '../state';
import { Snd, buzz } from '../sound';
import { ui } from '../ui/ctx';
import { toast } from '../ui/modal';
import { P, savePrefs } from '../prefs';
import { applyTheme, isTheme } from '../theme';
import { wipeAllSaves } from '../storage';
import { Cloud } from '../services/cloud';
import { Notify } from '../services/notify';
import { persist } from './persist';
import { hideTip } from './rifki';
import { resetGame } from './loop';
import { t } from '../i18n';

export function toggleSound() { S.sound = !S.sound; persist(); Snd.tap(); }
/** Titreşim (eski kayıtta alan yok = açık). */
export function toggleVib() { S.vib = S.vib === false; persist(); Snd.tap(); buzz.select(); }
/** Tema tercihi (tapu-prefs; kayıttan bağımsız, tüm bölgelerde aynı). */
export function setTheme(v: unknown) { if (isTheme(v) && v !== P.theme) { P.theme = v; void savePrefs(); applyTheme(v); Snd.tap(); } }
export function toggleNight() { S.night = S.night === false; persist(); Snd.tap(); }
export function toggleRifki() { S.rifki = !S.rifki; if (!S.rifki) hideTip(); persist(); Snd.tap(); }
export function setCollectMode(m: 'tap' | 'auto') {
  S.collectMode = m; ui.tileSig = []; persist(); Snd.tap();
  toast(S.collectMode === 'auto' ? t('Kiralar otomatik toplanacak') : t('Kiraları TOPLA mührüyle toplayacaksın'));
}
export function toggleNotif() { S.notif = !S.notif; if (S.notif) Notify.ask(); persist(); }
export async function linkAccount(p: 'google' | 'apple') {
  const ok = await Cloud.link(p); toast(ok ? t('Hesabın bağlandı. İlerlemen artık her cihazda.') : t('Bağlanamadı, tekrar dene'));
}
/** Hesap silme: bulut hesabı silinirse bu cihazdaki tüm bölge kayıtları da silinir ve yeni oyun başlar. */
export async function deleteAccount() {
  const ok = await Cloud.deleteAccount();
  if (ok) { await wipeAllSaves(); P.region = ''; await savePrefs(); await resetGame(); toast(t('Hesabın ve verilerin silindi')); }
  else toast(t('Silinemedi, internet bağlantını kontrol et'));
}
