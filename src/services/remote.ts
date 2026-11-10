/* REMOTE CONFIG — denge ve reklam sıklığı uygulamayı güncellemeden değiştirilir (A/B testi için).
   Firebase konsolunda anahtar adları CFG ile aynıdır: INTER_MIN, EVENT_MIN, OFFLINE_RATE ... (sayısal).
   Açılışı bekletmez: en fazla REMOTE_TIMEOUT_MS beklenir, sonra varsayılanlarla devam edilir (geç gelen değer
   oyunun ortasında uygulanmaz). Her değer sınır kontrolünden geçer: varsayılanın 1/10'u ile 10 katı arası, oranlar
   (varsayılanı ≤ 1) en fazla 1; MIN/MAX çiftleri ters düşerse ikisi de varsayılana döner. */
import { Capacitor } from '@capacitor/core';
import { FirebaseRemoteConfig } from '@capacitor-firebase/remote-config';
import { CFG } from '../config';

export const REMOTE_TIMEOUT_MS = 4000;
const DEF: Record<string, number> = { ...(CFG as any) };

/** Uzak değer kabul edilebilir mi? */
export function sane(key: string, v: unknown): v is number {
  const d = DEF[key];
  if (typeof v !== 'number' || !Number.isFinite(v) || v <= 0 || typeof d !== 'number' || d <= 0) return false;
  if (d <= 1 && v > 1) return false;
  return v >= d / 10 && v <= d * 10;
}

/** Okunan değerleri sınır kontrolüyle uygular; MIN/MAX çifti ters düşerse çift varsayılana döner. Uygulanan anahtarlar döner. */
export function applyValues(vals: Record<string, unknown>): string[] {
  const used: string[] = [];
  for (const key of Object.keys(DEF)) if (sane(key, vals[key])) { (CFG as any)[key] = vals[key]; used.push(key); }
  for (const key of Object.keys(DEF)) {
    if (!key.endsWith('_MIN')) continue;
    const mx = key.slice(0, -4) + '_MAX';
    if (mx in DEF && (CFG as any)[key] > (CFG as any)[mx]) { (CFG as any)[key] = DEF[key]; (CFG as any)[mx] = DEF[mx]; }
  }
  return used;
}

export async function applyRemoteConfig() {
  if (!Capacitor.isNativePlatform() || __PREVIEW__) return;
  let late = false;
  const work = (async () => {
    await FirebaseRemoteConfig.fetchAndActivate();
    const vals: Record<string, unknown> = {};
    for (const key of Object.keys(DEF)) { if (late) return; vals[key] = (await FirebaseRemoteConfig.getNumber({ key })).value; }
    if (!late) applyValues(vals); // hepsi ya da hiçbiri: zaman aşımından sonra gelen değer uygulanmaz
  })().catch(() => { /* varsayılanlar kullanılır */ });
  let tm: any;
  await Promise.race([work, new Promise<void>(r => { tm = setTimeout(() => { late = true; r(); }, REMOTE_TIMEOUT_MS); })]);
  clearTimeout(tm);
}
