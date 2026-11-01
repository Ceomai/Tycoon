/// <reference types="vite/client" />
declare const __PREVIEW__: boolean;
interface ImportMetaEnv {
  readonly VITE_FIREBASE_API_KEY?: string;
  readonly VITE_FIREBASE_AUTH_DOMAIN?: string;
  readonly VITE_FIREBASE_PROJECT_ID?: string;
  readonly VITE_FIREBASE_APP_ID?: string;
  readonly VITE_FIREBASE_STORAGE_BUCKET?: string;
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID?: string;
  readonly VITE_FIREBASE_REGION?: string;
  readonly VITE_ADMOB_REWARDED_ANDROID?: string;
  readonly VITE_ADMOB_REWARDED_IOS?: string;
  readonly VITE_ADMOB_INTERSTITIAL_ANDROID?: string;
  readonly VITE_ADMOB_INTERSTITIAL_IOS?: string;
  readonly VITE_ADMOB_TESTING?: string;
  readonly VITE_REVENUECAT_ANDROID?: string;
  readonly VITE_REVENUECAT_IOS?: string;
  readonly VITE_PRIVACY_URL?: string;
  readonly VITE_TERMS_URL?: string;
}
interface Window { claude?: any; }
