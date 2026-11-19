/* ANALİTİK ve HATA TAKİBİ — Firebase Analytics + Crashlytics (yalnızca telefonda); web'de sessiz */
import { Capacitor } from '@capacitor/core';
import { FirebaseAnalytics } from '@capacitor-firebase/analytics';
import { FirebaseCrashlytics } from '@capacitor-firebase/crashlytics';

const native = () => Capacitor.isNativePlatform() && !__PREVIEW__;
/** Önizleme paketinde gönderilen olaylar (uçtan uca testler: __tapuTest.events()); ağa hiçbir şey gitmez. */
export const sent: { name: string; params: Record<string, unknown> }[] = [];
export const Analytics = {
  log(name: string, params: Record<string, unknown> = {}) {
    if (__PREVIEW__) { sent.push({ name, params }); if (sent.length > 1000) sent.shift(); }
    if (!native()) return;
    void FirebaseAnalytics.logEvent({ name, params: params as any }).catch(() => { /* yok */ });
  },
  /** Kullanıcı özellikleri (services/funnel.ts; kişisel veri yok: bölge, dil, kovalar). */
  props(p: Record<string, string>) {
    if (__PREVIEW__) sent.push({ name: '$props', params: p });
    if (!native()) return;
    for (const key of Object.keys(p)) void FirebaseAnalytics.setUserProperty({ key, value: p[key] }).catch(() => { /* yok */ });
  },
  setUser(uid: string) { if (native()) { void FirebaseAnalytics.setUserId({ userId: uid }).catch(() => {}); void FirebaseCrashlytics.setUserId({ userId: uid }).catch(() => {}); } },
  error(e: unknown, where = '') {
    if (!native()) { if (where) console.warn(where, e); return; }
    void FirebaseCrashlytics.recordException({ message: `${where}: ${(e as any)?.message || String(e)}` }).catch(() => {});
  },
  installGlobalHandlers() {
    window.addEventListener('error', ev => this.error(ev.error || ev.message, 'window'));
    window.addEventListener('unhandledrejection', ev => this.error(ev.reason, 'promise'));
  },
};
