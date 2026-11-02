/* DAVET KODU — doğrulama sunucuda (Cloud.redeemInvite); sunucu yoksa önizlemede yerel çalışır */
import { S } from '../state';
import { totalRate } from '../economy';
import { Snd } from '../sound';
import { ui } from '../ui/ctx';
import { toast, bump } from '../ui/modal';
import { addCash } from './actions';
import { fmt } from '../format';
import { t } from '../i18n';
import { persist } from './persist';
import { Cloud } from '../services/cloud';

/** Davet hediyesi (davet eden ve edilen için aynı): tapu hediyesi nakit. */
export const inviteGift = () => Math.max(2000, totalRate(false) * 900);
export const normalizeCode = (raw: string) => String(raw || '').trim().toLocaleUpperCase('tr-TR').replace(/İ/g, 'I');
export const validCode = (c: string) => /^TP[A-Z0-9]{4}$/.test(c);

export async function useCode(raw: string) {
  const c = normalizeCode(raw);
  if (S.ref.used) return toast(t('Zaten bir davet kodu kullandın'));
  if (!validCode(c)) return toast(t('Kod TP ile başlayan 6 karakter olmalı'));
  if (c === S.ref.code) return toast(t('Kendi kodunu kullanamazsın'));
  const res = await Cloud.redeemInvite(c);
  if (res === 'invalid') return toast(t('Bu kod bulunamadı'));
  if (res === 'used') return toast(t('Bu hesapla daha önce kod kullanıldı'));
  if (res === 'error') return toast(t('Şu an doğrulanamadı, sonra tekrar dene'));
  const gift = inviteGift(); S.ref.used = c; addCash(gift); bump(); Snd.reward(); persist();
  toast(t('Hoş geldin hediyesi: {amt}', { amt: fmt(gift) })); ui.sheetSig = '';
}
