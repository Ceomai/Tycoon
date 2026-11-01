/* DAVET KODU — doğrulama sunucuda (Cloud.redeemInvite); sunucu yoksa önizlemede yerel çalışır */
import { S } from '../state';
import { totalRate } from '../economy';
import { Snd } from '../sound';
import { ui } from '../ui/ctx';
import { toast, bump } from '../ui/modal';
import { addBoost, addCash } from './actions';
import { persist } from './persist';
import { Cloud } from '../services/cloud';

export const normalizeCode = (raw: string) => String(raw || '').trim().toLocaleUpperCase('tr-TR').replace(/İ/g, 'I');
export const validCode = (c: string) => /^TP[A-Z0-9]{4}$/.test(c);

export async function useCode(raw: string) {
  const c = normalizeCode(raw);
  if (S.ref.used) return toast('Zaten bir davet kodu kullandın');
  if (!validCode(c)) return toast('Kod TP ile başlayan 6 karakter olmalı');
  if (c === S.ref.code) return toast('Kendi kodunu kullanamazsın');
  const res = await Cloud.redeemInvite(c);
  if (res === 'invalid') return toast('Bu kod bulunamadı');
  if (res === 'used') return toast('Bu hesapla daha önce kod kullanıldı');
  if (res === 'error') return toast('Şu an doğrulanamadı, sonra tekrar dene');
  S.ref.used = c; addBoost(2 * 3600e3); addCash(Math.max(500, totalRate(false) * 300)); bump(); Snd.reward(); persist();
  toast('Hoş geldin hediyesi: 2 saat 2x'); ui.sheetSig = '';
}
