/* REMOTE CONFIG — denge ve reklam sıklığı uygulamayı güncellemeden değiştirilir (A/B testi için).
   Firebase konsolunda anahtar adları CFG ile aynıdır: INTER_MIN, EVENT_MIN, OFFLINE_RATE ... (sayısal). */
import { Capacitor } from '@capacitor/core';
import { FirebaseRemoteConfig } from '@capacitor-firebase/remote-config';
import { CFG } from '../config';

export async function applyRemoteConfig() {
  if (!Capacitor.isNativePlatform() || __PREVIEW__) return;
  try {
    await FirebaseRemoteConfig.fetchAndActivate();
    for (const key of Object.keys(CFG) as (keyof typeof CFG)[]) {
      const { value } = await FirebaseRemoteConfig.getNumber({ key });
      if (Number.isFinite(value) && value > 0) (CFG as any)[key] = value;
    }
  } catch { /* varsayılanlar kullanılır */ }
}
