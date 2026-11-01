/* ANALİTİK ve HATA TAKİBİ — Firebase Analytics + Crashlytics (yalnızca telefonda); web'de sessiz */
import { Capacitor } from '@capacitor/core';
import { FirebaseAnalytics } from '@capacitor-firebase/analytics';
import { FirebaseCrashlytics } from '@capacitor-firebase/crashlytics';

const native = () => Capacitor.isNativePlatform() && !__PREVIEW__;
export const Analytics = {
  log(name: string, params: Record<string, unknown> = {}) {
    if (!native()) return;
    void FirebaseAnalytics.logEvent({ name, params: params as any }).catch(() => { /* yok */ });
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
