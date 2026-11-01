/* =========================================================
   TAPU — Cloud Functions (Firebase, Node 22)
   hello            : sunucu saati + tekil davet kodu + yeni davet ödülleri + geçen haftanın lig sonucu
   redeemInvite     : davet kodu kullanımı (hesap başına bir kez, kendi kodu olmaz)
   submitScore      : haftalık skor (lig grubuna yerleşir); zamana göre makul mü kontrol edilir, aşırı artış kırpılır
   deleteAccount    : oyuncunun tüm verisini ve kimliğini siler (mağaza zorunluluğu)
   admobSsv         : AdMob ödüllü reklam sunucu doğrulaması (imza kontrolü, kayıt)
   revenuecatWebhook: satın alma olayları (premium bayrağı sunucuda tutulur)
   ========================================================= */
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { onCall, onRequest, HttpsError, type CallableRequest } from 'firebase-functions/v2/https';
import { setGlobalOptions } from 'firebase-functions/v2';
import { defineSecret } from 'firebase-functions/params';
import { createVerify } from 'node:crypto';
import { settle, ensureGroup } from './league';

initializeApp();
// Kapasite: her kopya aynı anda 80 isteğe bakar (2. nesil varsayılanı); 200 kopya ≈ 16.000 eşzamanlı istek.
// Maliyet tavanı için Google Cloud'da bütçe uyarısı kurun (docs/RELEASE.md).
setGlobalOptions({ region: 'europe-west1', maxInstances: 200, concurrency: 80, cpu: 1, memory: '256MiB' }); // concurrency > 1 için cpu en az 1 olmalı
const db = getFirestore();
const RC_SECRET = defineSecret('REVENUECAT_WEBHOOK_SECRET');

const CODE_RE = /^TP[A-Z0-9]{4}$/;
const DISTRICT_RE = /^(ist|izm|ank)-[0-4]$/;
const ALPHA = 'ABCDEFGHJKLMNPRSTUVYZ23456789';

function uidOf(req: CallableRequest): string {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Oturum yok');
  return req.auth.uid;
}
/** İstemciyle aynı ISO hafta anahtarı: 2026-H44 */
function weekKey(d = new Date()): string {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const wd = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - wd);
  const y = t.getUTCFullYear();
  return y + '-H' + String(Math.ceil(((+t - Date.UTC(y, 0, 1)) / 864e5 + 1) / 7)).padStart(2, '0');
}
/** Haftanın başından (pazartesi 00:00 UTC) bu yana geçen saniye */
function secondsIntoWeek(d = new Date()): number {
  const wd = (d.getUTCDay() + 6) % 7;
  const start = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - wd);
  return Math.max(60, (+d - start) / 1000);
}
const randomCode = () => 'TP' + Array.from({ length: 4 }, () => ALPHA[Math.floor(Math.random() * ALPHA.length)]).join('');

/* ---------- hello ---------- */
export const hello = onCall(async req => {
  const uid = uidOf(req);
  const asked = String((req.data && req.data.code) || '').toUpperCase();
  const userRef = db.doc(`users/${uid}`);
  const code = await db.runTransaction(async tx => {
    const u = await tx.get(userRef);
    if (u.exists && u.get('code')) return u.get('code') as string;
    // önce istemcinin ürettiği kodu dene; doluysa yenisini üret
    const tries = CODE_RE.test(asked) ? [asked] : [];
    for (let k = 0; k < 8; k++) tries.push(randomCode());
    for (const c of tries) {
      const cref = db.doc(`codes/${c}`);
      const cs = await tx.get(cref);
      if (!cs.exists) {
        tx.set(cref, { uid, at: FieldValue.serverTimestamp() });
        tx.set(userRef, { code: c, granted: 0, created: FieldValue.serverTimestamp() }, { merge: true });
        return c;
      }
    }
    throw new HttpsError('resource-exhausted', 'Kod üretilemedi');
  });
  // kodumu kullanan yeni arkadaşlar → ödül (her biri bir kez)
  const used = (await db.collection('invites').where('inviter', '==', uid).count().get()).data().count;
  let grants = 0;
  await db.runTransaction(async tx => {
    const u = await tx.get(userRef);
    const given = (u.get('granted') as number) || 0;
    if (used > given) { grants = Math.min(used - given, 20); tx.update(userRef, { granted: given + grants }); }
  });
  // lig: geçen hafta bittiyse sonucu hesapla (bir kez)
  const result = await settle(uid, weekKey()).catch(() => null);
  const L = ((await userRef.get()).get('league') as any) || {};
  return { now: Date.now(), code, grants, league: { tier: L.tier || 0, result } };
});

/* ---------- redeemInvite ---------- */
export const redeemInvite = onCall(async req => {
  const uid = uidOf(req);
  const code = String((req.data && req.data.code) || '').toUpperCase();
  if (!CODE_RE.test(code)) return { result: 'invalid' };
  return db.runTransaction(async tx => {
    const mine = db.doc(`invites/${uid}`);
    if ((await tx.get(mine)).exists) return { result: 'used' };
    const owner = await tx.get(db.doc(`codes/${code}`));
    if (!owner.exists || owner.get('uid') === uid) return { result: 'invalid' };
    tx.set(mine, { code, inviter: owner.get('uid'), at: FieldValue.serverTimestamp() });
    return { result: 'ok' };
  });
});

/* ---------- submitScore ----------
   Haftalık kazanç makul mü? Tek kontrol değil, katmanlı:
   - hafta anahtarı sunucu haftasıyla aynı olmalı
   - ilk gönderimde haftanın geçen süresine göre üst sınır
   - sonraki gönderimlerde son gönderimden bu yana geçen süreye göre büyüme sınırı (bileşik, cömert)
   Sınırı aşan değer kırpılır ve hesap işaretlenir (inceleme/analitik). */
export const submitScore = onCall(async req => {
  const uid = uidOf(req);
  const d = req.data || {};
  const week = weekKey();
  if (d.week !== week) return { ok: false, reason: 'week' };
  let earned = Number(d.earned);
  if (!Number.isFinite(earned) || earned < 0) throw new HttpsError('invalid-argument', 'earned');
  const district = DISTRICT_RE.test(String(d.district)) ? String(d.district) : 'ist-0';
  const shares = Math.max(0, Math.min(1e6, Math.floor(Number(d.shares) || 0)));
  const lg = await ensureGroup(uid, week);
  const ref = db.doc(`lb/${week}_${uid}`); // hafta başına bir belge; 6 hafta sonra TTL ile silinir (expireAt)
  const nowMs = Date.now();
  return db.runTransaction(async tx => {
    const prev = await tx.get(ref);
    const p = prev.exists ? prev.data()! : null;
    const mult = 1 + 0.1 * shares; // holding hisseleri kirayı katlar
    // oyuncunun kanıtlanmış hızı: geçen haftanın ortalamasının 5 katı ya da bu haftaki ortalamanın 5 katı (en az 2e4/sn)
    const lastWeek = p ? p.lastWeek || 0 : lg.lastWeek;
    const sw = secondsIntoWeek();
    const rate = Math.max(2e4 * mult, (lastWeek / 604800) * 5, p ? (p.earned / sw) * 5 : 0);
    let cap: number;
    if (!p) cap = sw * rate;
    else {
      const dt = Math.max(1, (nowMs - (p.atMs || nowMs)) / 1000);
      cap = p.earned * Math.pow(1.002, Math.min(dt, 7 * 864e2)) + dt * rate;
    }
    let flagged = false;
    if (earned > cap) { earned = Math.floor(cap); flagged = true; }
    if (p && earned < p.earned) earned = p.earned; // sıralama geriye gitmez
    const user = await getAuth().getUser(uid).catch(() => null);
    const code = (await tx.get(db.doc(`users/${uid}`))).get('code') || '';
    const first = (user?.displayName || '').trim().split(/\s+/)[0];
    const name = first ? first.slice(0, 14) : 'Emlakçı ' + String(code).slice(2);
    tx.set(ref, { uid, week, tier: lg.tier, group: lg.group, earned, district, shares, name, atMs: nowMs, lastWeek,
      flagged: flagged || !!(p && p.flagged), expireAt: Timestamp.fromMillis(nowMs + 42 * 864e5) });
    return { ok: true, earned, flagged, tier: lg.tier, group: lg.group };
  });
});

/* ---------- deleteAccount ---------- */
export const deleteAccount = onCall(async req => {
  const uid = uidOf(req);
  const batch = db.batch();
  const user = await db.doc(`users/${uid}`).get();
  if (user.exists && user.get('code')) batch.delete(db.doc(`codes/${user.get('code')}`));
  for (const p of [`saves/${uid}`, `users/${uid}`, `invites/${uid}`]) batch.delete(db.doc(p));
  (await db.collection('lb').where('uid', '==', uid).limit(400).get()).docs.forEach(d => batch.delete(d.ref));
  await batch.commit();
  const rewards = await db.collection('rewards').where('uid', '==', uid).limit(500).get();
  if (!rewards.empty) { const b2 = db.batch(); rewards.docs.forEach(r => b2.delete(r.ref)); await b2.commit(); }
  await getAuth().deleteUser(uid);
  return { ok: true };
});

/* ---------- AdMob SSV ----------
   AdMob, ödül verildiğinde bu adrese imzalı GET isteği atar. İmza Google'ın açık anahtarlarıyla doğrulanır.
   Kayıt: rewards/{transaction_id} — aynı işlem iki kez sayılmaz; hile analizi ve destek için kullanılır.
   AdMob konsolunda: Reklam birimi → Sunucu tarafı doğrulama → bu fonksiyonun URL'si. */
let keyCache: { at: number; keys: Record<string, string> } | null = null;
async function admobKeys(): Promise<Record<string, string>> {
  if (keyCache && Date.now() - keyCache.at < 6 * 3600e3) return keyCache.keys;
  const r = await fetch('https://www.gstatic.com/admob/reward/verifier-keys.json');
  const j = await r.json() as { keys: { keyId: number; pem: string }[] };
  const keys: Record<string, string> = {};
  for (const k of j.keys) keys[String(k.keyId)] = k.pem;
  keyCache = { at: Date.now(), keys };
  return keys;
}
export const admobSsv = onRequest(async (req, res) => {
  try {
    const raw = req.originalUrl.split('?')[1] || '';
    const sigAt = raw.indexOf('&signature=');
    if (sigAt < 0) { res.status(400).send('no signature'); return; }
    const message = raw.slice(0, sigAt);
    const q = new URLSearchParams(raw);
    const signature = q.get('signature') || '', keyId = q.get('key_id') || '';
    const pem = (await admobKeys())[keyId];
    if (!pem) { res.status(400).send('unknown key'); return; }
    const sig = Buffer.from(signature.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
    const ok = createVerify('SHA256').update(message).verify(pem, sig);
    if (!ok) { res.status(403).send('bad signature'); return; }
    const tx = q.get('transaction_id') || '';
    if (tx) await db.doc(`rewards/${tx}`).set({ uid: q.get('user_id') || '', kind: q.get('custom_data') || '', unit: q.get('ad_unit') || '', at: FieldValue.serverTimestamp() }, { merge: true });
    res.status(200).send('ok');
  } catch { res.status(500).send('error'); }
});

/* ---------- RevenueCat webhook ----------
   RevenueCat panelinde Webhook URL = bu fonksiyon, Authorization = REVENUECAT_WEBHOOK_SECRET.
   app_user_id = Firebase uid (istemci RC.configure/logIn ile verir). */
export const revenuecatWebhook = onRequest({ secrets: [RC_SECRET] }, async (req, res) => {
  if (req.get('authorization') !== RC_SECRET.value()) { res.status(401).send('no'); return; }
  const ev = (req.body && req.body.event) || {};
  const uid = String(ev.app_user_id || '');
  if (!uid || uid.startsWith('$RCAnonymousID')) { res.status(200).send('skip'); return; }
  const active = ['INITIAL_PURCHASE', 'NON_RENEWING_PURCHASE', 'RENEWAL', 'UNCANCELLATION', 'PRODUCT_CHANGE'].includes(ev.type);
  const revoked = ['EXPIRATION', 'REFUND', 'CANCELLATION'].includes(ev.type) && ev.cancel_reason !== 'UNSUBSCRIBE';
  if (active || revoked) await db.doc(`users/${uid}`).set({ premium: active, premiumAt: FieldValue.serverTimestamp() }, { merge: true });
  res.status(200).send('ok');
});
