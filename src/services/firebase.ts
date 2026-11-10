/* =========================================================
   FIREBASE ARKA UCU (ayrı parça olarak yüklenir; ayar yoksa hiç indirilmez)
   - Kimlik: anonim oturum (ilk açılışta otomatik). Google / Apple ile "hesabı bağla"
     telefonda yerel giriş penceresiyle (@capacitor-firebase/authentication, skipNativeAuth)
     alınan kimlik bilgisi JS SDK'daki anonim kullanıcıya bağlanır → uid değişmez, ilerleme korunur.
   - Bulut kaydı: Firestore saves/{uid} (yalnızca sahibi okur/yazar, firestore.rules).
   - Lig: istemci yazamaz; skor "submitScore" fonksiyonuyla gönderilir, sunucu zamana göre makul mü
     diye kontrol eder ve 30 kişilik gruba yerleştirir. Okuma: lb/{hafta}_{uid} → group == X, earned desc.
   - Davet, kod üretimi, ödül, sunucu saati, hesap silme: Cloud Functions (functions/src/index.ts).
   ========================================================= */
import { Capacitor } from '@capacitor/core';
import { initializeApp } from 'firebase/app';
import {
  initializeAuth, indexedDBLocalPersistence, browserLocalPersistence, signInAnonymously, onAuthStateChanged,
  GoogleAuthProvider, OAuthProvider, linkWithCredential, signInWithCredential, signOut, deleteUser, type Auth, type AuthCredential, type User,
} from 'firebase/auth';
import {
  getFirestore, doc, getDoc, setDoc, deleteDoc, collection, query, where, orderBy, limit, getDocs, type Firestore,
} from 'firebase/firestore';
import { getFunctions, httpsCallable, type Functions } from 'firebase/functions';
import type { Backend, LbRow, RedeemResult } from './backend';
import { t } from '../i18n';
import { GROUP_SIZE } from '../config';

export function createFirebaseBackend(): Backend {
  const env = import.meta.env;
  let auth: Auth, fs: Firestore, fn: Functions, user: User | null = null;
  const call = async <T = any>(name: string, data: unknown = {}): Promise<T> => (await httpsCallable(fn, name)(data)).data as T;

  async function nativeCredential(p: 'google' | 'apple'): Promise<AuthCredential | null> {
    if (!Capacitor.isNativePlatform()) return null;
    const { FirebaseAuthentication } = await import('@capacitor-firebase/authentication');
    if (p === 'google') {
      const r = await FirebaseAuthentication.signInWithGoogle({ skipNativeAuth: true });
      return r.credential?.idToken ? GoogleAuthProvider.credential(r.credential.idToken) : null;
    }
    const r = await FirebaseAuthentication.signInWithApple({ skipNativeAuth: true });
    if (!r.credential?.idToken) return null;
    return new OAuthProvider('apple.com').credential({ idToken: r.credential.idToken, rawNonce: r.credential.nonce });
  }

  const be: Backend = {
    uid: null,
    async init() {
      const app = initializeApp({
        apiKey: env.VITE_FIREBASE_API_KEY, authDomain: env.VITE_FIREBASE_AUTH_DOMAIN, projectId: env.VITE_FIREBASE_PROJECT_ID,
        appId: env.VITE_FIREBASE_APP_ID, storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET, messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
      });
      // WebView içinde popup/redirect çözücüsü yüklenmez; kalıcılık IndexedDB
      auth = initializeAuth(app, { persistence: [indexedDBLocalPersistence, browserLocalPersistence] });
      fs = getFirestore(app);
      fn = getFunctions(app, env.VITE_FIREBASE_REGION || 'europe-west1');
      user = await new Promise<User | null>(res => { const off = onAuthStateChanged(auth, u => { off(); res(u); }); });
      if (!user) user = (await signInAnonymously(auth)).user;
      onAuthStateChanged(auth, u => { user = u; be.uid = u ? u.uid : null; });
      be.uid = user.uid;
      return true;
    },
    async hello(localCode) {
      // { now: sunucu saati, code: tekil davet kodu, grants: yeni ödüllenecek davet sayısı }
      return call('hello', { code: localCode });
    },
    account() {
      const ids = (user?.providerData || []).map(p => p.providerId);
      const provider = ids.includes('apple.com') ? 'Apple' : ids.includes('google.com') ? 'Google' : '';
      return { enabled: Capacitor.isNativePlatform(), linked: !!provider, provider, apple: Capacitor.getPlatform() === 'ios' };
    },
    async link(p) {
      try {
        const cred = await nativeCredential(p);
        if (!cred || !auth.currentUser) return 'fail';
        try { await linkWithCredential(auth.currentUser, cred); user = auth.currentUser; return 'linked'; }
        catch (e: any) {
          // bu Google/Apple hesabı zaten başka bir oyuncu kaydına bağlı → o hesaba geç
          if (e?.code === 'auth/credential-already-in-use' || e?.code === 'auth/email-already-in-use') {
            const c = OAuthProvider.credentialFromError(e) || GoogleAuthProvider.credentialFromError(e) || cred;
            user = (await signInWithCredential(auth, c)).user; be.uid = user.uid;
            return 'switched';
          }
          throw e;
        }
      } catch { return 'fail'; }
    },
    async deleteAccount() {
      try {
        try { await call('deleteAccount'); }
        catch {
          // sunucu fonksiyonu yayında değilse: oyuncu kendi kaydını (kural: yalnızca sahibi silebilir) ve hesabını istemciden siler
          if (be.uid) await deleteDoc(doc(fs, 'saves', be.uid));
          if (auth.currentUser) await deleteUser(auth.currentUser);
        }
        await signOut(auth).catch(() => { /* yok */ });
        if (Capacitor.isNativePlatform()) { const { FirebaseAuthentication } = await import('@capacitor-firebase/authentication'); await FirebaseAuthentication.signOut().catch(() => {}); }
        user = (await signInAnonymously(auth)).user; be.uid = user.uid;
        return true;
      } catch { return false; }
    },
    async pushSave(json, savedAt, earned) {
      if (!be.uid || json.length > 900_000) return;
      await setDoc(doc(fs, 'saves', be.uid), { j: json, savedAt, earned, v: 2 });
    },
    async pullSave() {
      if (!be.uid) return null;
      const snap = await getDoc(doc(fs, 'saves', be.uid));
      if (!snap.exists()) return null;
      const d = snap.data() as any;
      return { json: d.j, savedAt: d.savedAt || 0, earned: d.earned || 0 };
    },
    async postScore(p) { await call('submitScore', p); },
    async league(week) {
      if (!be.uid) return null;
      const mine = await getDoc(doc(fs, 'lb', `${week}_${be.uid}`));
      if (!mine.exists()) return null; // bu hafta henüz skor gönderilmedi → grup yok
      const m = mine.data() as any;
      const snap = await getDocs(query(collection(fs, 'lb'), where('group', '==', m.group), orderBy('earned', 'desc'), limit(GROUP_SIZE * 2)));
      const rows: LbRow[] = snap.docs.map(d => { const x = d.data() as any; return { name: x.name || t('Emlakçı'), district: x.district, earned: x.earned, me: x.uid === be.uid }; });
      const i = rows.findIndex(r => r.me);
      return { tier: m.tier || 0, group: m.group, rows, myRank: i >= 0 ? i + 1 : null, size: rows.length };
    },
    async redeemInvite(code): Promise<RedeemResult> {
      const r = await call<{ result: RedeemResult }>('redeemInvite', { code });
      return r.result;
    },
  };
  return be;
}
