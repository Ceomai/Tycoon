/* =========================================================
   BULUT — hesap, bulut kaydı, haftalık sıralama, davetler, sunucu saati
   Arka uç seçimi:
     1) Firebase ayarları (.env) varsa ve önizleme değilse → Firebase (firebase.ts, ayrı parça olarak yüklenir)
     2) Claude artifact ortamındaysa → artifact'ın paylaşılan veritabanı (önizleme/test)
     3) Hiçbiri yoksa → çevrimdışı: oyun tamamen yerel çalışır
   Oyun koduna tek bir arayüz sunar; arka ucun ne olduğu bilinmez.
   ========================================================= */
import { CFG } from '../config';
import { S } from '../state';
import { weekKey } from '../format';
import { now } from '../economy';
import { Time } from '../time';
import { I } from '../icons';
import { fmt } from '../format';
import { openModal, closeModal, toast } from '../ui/modal';
import { writeSaveForce, lockSaves, unlockSaves, readRegionSave, writeRegionSave } from '../storage';
import { REGION, REGION_ORDER, RegionId } from '../config';
import { Snd } from '../sound';
import { Analytics } from './analytics';
import { showLeagueResult, type LeagueResult } from '../game/league';
import { addCash } from '../game/actions';
import { inviteGift } from '../game/referral';
import { t } from '../i18n';

export type RedeemResult = 'ok' | 'invalid' | 'used' | 'error';
export interface LbRow { name: string; district: string; earned: number; me: boolean; }
export interface Account { enabled: boolean; linked: boolean; provider: string; apple: boolean; }
export interface RemoteSave { json: string; savedAt: number; earned: number; }
export interface Hello { now?: number; code?: string; grants?: number; league?: { tier: number; result: LeagueResult | null }; }
export interface LeagueView { tier: number; group: string; rows: LbRow[]; myRank: number | null; size: number; }

/** Arka uçların uyguladığı arayüz. */
export interface Backend {
  uid: string | null;
  init(): Promise<boolean>;
  hello(localCode: string): Promise<Hello>;
  account(): Account;
  link(p: 'google' | 'apple'): Promise<'linked' | 'switched' | 'fail'>;
  deleteAccount(): Promise<boolean>;
  pushSave(json: string, savedAt: number, earned: number): Promise<void>;
  pullSave(): Promise<RemoteSave | null>;
  postScore(p: { week: string; earned: number; district: string; shares: number; total: number }): Promise<void>;
  /** Bu haftaki lig grubum (30 kişi); henüz gruba girmediysem null. */
  league(week: string): Promise<LeagueView | null>;
  redeemInvite(code: string): Promise<RedeemResult>;
}

let be: Backend | null = null;
let isReady = false, lastPost = 0, posted = -1;
/* maliyet: lig tablosu 5 dk önbellekte; aynı kayıt iki kez yazılmaz; bulut kaydı 12 saatte bir (ya da yeni kurulumda) indirilir */
const LEAGUE_TTL = 5 * 60e3, PULL_EVERY = 12 * 3600e3, CHECK_KEY = 'tapu-cloud-check';
let lgCache: { at: number; week: string; v: LeagueView } | null = null;
let lastPushed = -1;
const lastCheck = () => { try { return Number(localStorage.getItem(CHECK_KEY) || 0); } catch { return 0; } };
const markCheck = () => { try { localStorage.setItem(CHECK_KEY, String(Date.now())); } catch { /* yok */ } };
/** Hiç arka uç ayarlı değil (geliştirme / yerel test): davet kodu yerelde kabul edilir. */
let localOnly = false;
const OFF: Account = { enabled: false, linked: false, provider: '', apple: false };

async function pickBackend(): Promise<Backend | null> {
  const env = import.meta.env;
  if (!__PREVIEW__ && env.VITE_FIREBASE_API_KEY && env.VITE_FIREBASE_PROJECT_ID) {
    const m = await import('./firebase');
    return m.createFirebaseBackend();
  }
  if (typeof window !== 'undefined' && window.claude && window.claude.use) {
    const m = await import('./artifactCloud');
    return m.createArtifactBackend();
  }
  return null;
}

export const Cloud = {
  ready: () => isReady,
  uid: () => (be ? be.uid : null),
  account: (): Account => (be && isReady ? be.account() : OFF),

  /** Açılışta bir kez: oturum aç, sunucu saatini al, davet kodunu ve bekleyen ödülleri sor, bulut kaydını karşılaştır. */
  async init(): Promise<void> {
    try {
      be = await pickBackend();
      localOnly = !be;
      if (!be || !(await be.init())) { be = null; return; }
      isReady = true;
      if (be.uid) Analytics.setUser(be.uid);
      await this.hello();
      await this.reconcile();
    } catch (e) { Analytics.error(e, 'cloud_init'); }
  },

  async hello() {
    if (!be) return;
    const sent = Date.now();
    try {
      const h = await be.hello(S.ref.code);
      if (typeof h.now === 'number' && Number.isFinite(h.now) && h.now > 0) Time.setServer(h.now, sent, Date.now());
      if (h.code && h.code !== S.ref.code) S.ref.code = h.code;
      if (h.grants && h.grants > 0) grantInvites(h.grants);
      if (h.league) { S.league.tier = h.league.tier; if (h.league.result) showLeagueResult(h.league.result); }
    } catch (e) { Analytics.error(e, 'cloud_hello'); }
  },

  /** Bulut kaydı yerelden belirgin şekilde ilerideyse oyuncuya sorulur; yeni oyunda sessizce alınır. */
  async reconcile(force = false) {
    if (!be) return;
    const freshLocal = !S.city || S.earned < 1000;
    if (!force && !freshLocal && Date.now() - lastCheck() < PULL_EVERY) { void this.pushSave(); return; }
    let r: RemoteSave | null = null;
    try { r = await be.pullSave(); markCheck(); } catch { return; }
    if (!r || !r.json) { void this.pushSave(); return; }
    const localEarned = (await bundle()).earned;
    if (r.savedAt <= S.savedAt + 60e3 || r.earned <= localEarned) { if (r.savedAt < S.savedAt) void this.pushSave(); return; }
    if (freshLocal) { await adopt(r.json); return; }
    openModal(`<div class="card"><div class="badge">${I.users}</div><h3>${t('Buluttaki kayıt')}</h3>
      <p>${t('Hesabında daha ileri bir şehir var.')}<br>${t('Bulut: {a} · Bu cihaz: {b}', { a: `<b>${fmt(r.earned)}</b>`, b: `<b>${fmt(localEarned)}</b>` })}</p>
      <div class="btns"><button class="btn gold" data-a="cloud">${t('Buluttakini yükle')}</button><button class="txt" data-a="local">${t('Bu cihazdakiyle devam et')}</button></div></div>`,
      a => { closeModal(); if (a === 'cloud') void adopt(r!.json); else void this.pushSave(); });
  },

  async pushSave() {
    if (!be || !isReady || !S.city || S.savedAt === lastPushed) return; // değişmemiş kayıt tekrar yazılmaz
    const at = S.savedAt;
    try { const b = await bundle(); await be.pushSave(b.json, at || now(), Math.floor(b.earned)); lastPushed = at; } catch (e) { Analytics.error(e, 'cloud_save'); }
  },

  /** Haftalık skor: değiştiyse en fazla SCORE_POST_MS'de bir gönderilir (sunucu ayrıca doğrular, lig grubuna yerleştirir). */
  maybePostScore(force = false): Promise<void> {
    if (!be || !isReady || !S.city) return Promise.resolve();
    const e = Math.floor(S.week.earned), tn = Date.now();
    if (e === posted || (!force && tn - lastPost < CFG.SCORE_POST_MS)) return Promise.resolve();
    posted = e; lastPost = tn;
    return be.postScore({ week: S.week.key || weekKey(new Date(now())), earned: e, district: S.cur, shares: S.shares || 0, total: Math.floor(S.earned) })
      .catch(err => { posted = -1; Analytics.error(err, 'cloud_score'); });
  },

  /** Lig tablosu: önce güncel skor gönderilir (ilk gönderim gruba yerleştirir), sonra grup okunur. */
  async league(): Promise<LeagueView | null> {
    if (!be || !isReady) return null;
    const week = weekKey(new Date(now()));
    if (lgCache && lgCache.week === week && Date.now() - lgCache.at < LEAGUE_TTL) return lgCache.v;
    await this.maybePostScore(true);
    const v = await be.league(week);
    if (v) lgCache = { at: Date.now(), week, v };
    if (v) { if (v.tier < 0) v.tier = S.league.tier; else S.league.tier = v.tier; }
    return v;
  },

  async redeemInvite(code: string): Promise<RedeemResult> {
    if (localOnly) return 'ok';
    if (!be || !isReady) return 'error';
    try { return await be.redeemInvite(code); } catch { return 'error'; }
  },

  async link(p: 'google' | 'apple'): Promise<boolean> {
    if (!be || !isReady) return false;
    const r = await be.link(p);
    if (r === 'switched') { lgCache = null; lastPushed = -1; await this.reconcile(true); await this.hello(); }
    else if (r === 'linked') void this.pushSave();
    if (r !== 'fail') Analytics.log('account_link', { provider: p });
    return r !== 'fail';
  },

  async deleteAccount(): Promise<boolean> {
    if (!be || !isReady) return true; // bulutta veri yok: yerel silme yeterli
    const ok = await be.deleteAccount();
    if (ok) { isReady = false; posted = -1; lgCache = null; lastPushed = -1; try { localStorage.removeItem(CHECK_KEY); } catch { /* yok */ } }
    return ok;
  },
};

function grantInvites(n: number) {
  S.ref.rewarded += n;
  const gift = inviteGift() * n; addCash(gift);
  toast(t('{n} arkadaşın katıldı: {gift} tapu hediyesi', { n, gift: fmt(gift) })); Snd.unlock();
}

/** Bulut yedeği tüm bölgeleri tek belgede taşır: { b: 1, saves: { tr: {...}, de: {...} } } (Firestore kuralı değişmeden). */
async function bundle(): Promise<{ json: string; earned: number }> {
  const saves: Record<string, unknown> = {}; let earned = 0;
  for (const r of REGION_ORDER) {
    const v: any = r === REGION ? S : await readRegionSave(r);
    if (v && v.city) { saves[r] = v; earned += Number(v.earned) || 0; }
  }
  return { json: JSON.stringify({ b: 1, saves }), earned };
}
/** Bulut kaydını yükler: önce kayıtlar kilitlenir (oyunun periyodik yazmaları yüklenen kaydı ezmesin),
 *  yüklenen kayıt kilidi aşarak doğrudan yazılır, yazma bitince sayfa yenilenir. */
async function adopt(json: string) {
  let obj: any;
  try { obj = JSON.parse(json); } catch (e) { Analytics.error(e, 'cloud_adopt'); toast(t('Bulut kaydı açılamadı')); return; }
  lockSaves();
  try {
    if (obj && obj.b === 1 && obj.saves) {   // çok bölgeli paket
      for (const r of REGION_ORDER) if (obj.saves[r] && r !== REGION) await writeRegionSave(r as RegionId, obj.saves[r]);
      if (obj.saves[REGION]) await writeSaveForce(obj.saves[REGION]);
    } else if (REGION === 'tr') await writeSaveForce(obj); // eski tek kayıt biçimi = Türkiye
    else await writeRegionSave('tr', obj);
  } catch (e) { unlockSaves(); Analytics.error(e, 'cloud_adopt'); toast(t('Bulut kaydı açılamadı')); return; }
  location.reload();
}
