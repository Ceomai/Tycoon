/* =========================================================
   KULLANIM HUNİSİ — yeni sistemlerin (kiracılar, büyük projeler, ihale, banka) ve ilk dakikaların analitik olayları.
   Şema ve pano rehberi: docs/ANALYTICS.md. Oyun kodu buraya tek satırla gelir (Funnel.tenant / project / ihale / bank /
   sheet / ms); olay adı, parametreler, kovalar, bir-kez bitleri ve hız sınırı burada toplanır.
   KURALLAR
   - Kişisel veri ve serbest metin yok: yalnız oyun içi kimlikler (semt, şehir, tip, kişilik), kovalanmış süre ve tutarlar
     (iç birim, 10'un kuvveti). Her değer send() içinde temizlenir (ad ≤40, snake_case; ≤25 parametre; metin ≤40, [A-Za-z0-9_.:-]).
   - Bir-kez olaylar (ms_*, sys_unlock) kayıttaki S.fn bit alanıyla tutulur (Holding'de korunur); eski kayıtta zaten
     yaşanmış olanlar açılışta sessizce işaretlenir (seed).
   - Hız sınırı: ad başına dakikada LIMIT.name, toplamda dakikada LIMIT.all, oturumda LIMIT.session; "gördü/açtı" olayları
     oturumda aynı nesne için bir kez (once).
   - Hata oyunu etkilemez: her giriş noktası try/catch içinde. Gönderim Analytics.log üzerinden (web/önizlemede ağ yok).
   Bu modül arayüz ve oyun kuralı modüllerini içe aktarmaz (yalnız config, state, i18n ve saf karakter verisi).
   ========================================================= */
import { CFG, DMAP, REGION, DistrictKey } from '../config';
import { S } from '../state';
import type { Auction, Pj } from '../state';
import type { Tenant } from '../game/tenants';
import { LANG } from '../i18n';
import { CHAR, traitOf } from '../game/tenantChars';
import { Analytics } from './analytics';

export type Params = Record<string, string | number | boolean | null | undefined>;

/* ---------- Firebase kuralları ---------- */
export const NAME_RE = /^[a-z][a-z0-9_]{0,39}$/;
export const MAX_PARAMS = 25, MAX_STR = 40, MAX_PROP_NAME = 24, MAX_PROP_VAL = 36;
/** Firebase'in ayırdığı olay adları ve önekleri (bu adlar gönderilmez). */
export const RESERVED = new Set(['ad_activeview', 'ad_click', 'ad_exposure', 'ad_impression', 'ad_query', 'ad_reward', 'adunit_exposure', 'app_clear_data',
  'app_exception', 'app_remove', 'app_store_refund', 'app_store_subscription_cancel', 'app_store_subscription_convert', 'app_store_subscription_renew',
  'app_update', 'app_upgrade', 'dynamic_link_app_open', 'dynamic_link_app_update', 'dynamic_link_first_open', 'error', 'first_open', 'first_visit',
  'in_app_purchase', 'notification_dismiss', 'notification_foreground', 'notification_open', 'notification_receive', 'os_update', 'screen_view',
  'session_start', 'session_start_with_rollout', 'user_engagement']);
export const RESERVED_PREFIX = /^(firebase_|google_|ga_)/;
export const validName = (n: string) => NAME_RE.test(n) && !RESERVED.has(n) && !RESERVED_PREFIX.test(n);

/* ---------- olay adları (docs/ANALYTICS.md ile aynı; test ikisini karşılaştırır) ---------- */
export const MS = ['first_build', 'first_collect', 'district_full', 'second_deed', 'first_tenant', 'first_project', 'first_auction', 'first_transfer'] as const;
export type MsId = typeof MS[number];
export const SYS = ['tenant', 'project', 'ihale', 'bank'] as const;
export type SysId = typeof SYS[number];
const TENANT = { arrive: 'tenant_arrive', open: 'tenant_open', ready: 'tenant_ready', settle: 'tenant_settle', leave: 'tenant_leave', end: 'tenant_end', renov: 'tenant_renov' } as const;
const PROJECT = { offer: 'project_offer', select: 'project_select', card: 'project_card', open: 'project_open', start: 'project_start', done: 'project_done', stage2: 'project_stage2', split: 'project_split' } as const;
const IHALE = { open: 'ihale_open', view: 'ihale_view', proxy: 'ihale_proxy', passed: 'ihale_passed', close: 'ihale_close', kose_open: 'kose_open', kose: 'ihale_kose' } as const;
const BANK = { open: 'bank_open', tab: 'bank_tab', transfer: 'bank_transfer', fail: 'bank_fail', claim: 'bank_claim', cur: 'bank_cur', go: 'bank_go' } as const;
export const EVENTS: readonly string[] = [...Object.values(TENANT), 'defter_open', ...Object.values(PROJECT), ...Object.values(IHALE), ...Object.values(BANK),
  'sys_unlock', ...MS.map(m => 'ms_' + m)];
/** Bu adımda eklenen adlar (kalanlar önceden de gönderiliyordu; adları korunur, parametreleri genişler). */
export const OLD_EVENTS: readonly string[] = ['tenant_arrive', 'tenant_settle', 'tenant_renov', 'project_start', 'project_done', 'project_stage2', 'project_split',
  'ihale_open', 'ihale_proxy', 'ihale_close', 'ihale_kose'];
export const USER_PROPS = ['region', 'lang', 'payer', 'holding_b', 'own_b', 'collect_mode'] as const;

/* ---------- kovalar ---------- */
const MIN_STEPS = [0, 1, 2, 3, 5, 10, 15, 20, 30, 45, 60, 90, 120, 180, 240, 480, 1440];
/** Süre kovası (dakika alt sınırı, sıralanabilir metin): 7 dk → "m0005". */
export function minB(ms: number): string {
  const m = Number.isFinite(ms) && ms > 0 ? ms / 60e3 : 0; let b = 0;
  for (const s of MIN_STEPS) if (m >= s) b = s;
  return 'm' + String(b).padStart(4, '0');
}
/** Tutar kovası: iç birimde 10'un kuvveti (0–18). 2 500 → 3. */
export const magB = (v: number) => (Number.isFinite(v) && v >= 1 ? Math.min(18, Math.floor(Math.log10(v) + 1e-9)) : 0);
const CNT_STEPS = [0, 1, 2, 3, 5, 10, 20, 50, 100];
/** Adet kovası (alt sınır). */
export function cntB(n: number): number { let b = 0; for (const s of CNT_STEPS) if (n >= s) b = s; return b; }
/** Oran kovası: yüzde, 10'luk adımlarla (0–100). */
export const pctB = (x: number) => (Number.isFinite(x) ? Math.max(0, Math.min(100, Math.round(x * 10) * 10)) : 0);
const X_STEPS = [0, 1, 1.2, 1.5, 2, 3, 5, 10];
/** Kat kovası (ör. vekâlet / açılış fiyatı). */
export function xB(x: number): number { let b = 0; if (Number.isFinite(x)) for (const s of X_STEPS) if (x >= s) b = s; return b; }
/** Semt bağlamı: şehir ve kademe (0–4). */
const place = (k: DistrictKey | string): Params => { const d = DMAP[k as DistrictKey]; return d ? { district: k, city: d.city, tier: d.idx } : {}; };
const playMin = () => Math.max(0, Math.min(99999, Math.floor((S && S.playMs || 0) / 60e3)));

/* ---------- gönderim: temizlik + hız sınırı ---------- */
export const LIMIT = { name: 8, all: 60, session: 600, once: 2000 };
const WIN = 60e3;
let hits: Record<string, number[]> = {}, allHits: number[] = [], total = 0;
let onceSet = new Set<string>();
export const stats = { sent: 0, dropped: 0, invalid: 0 };
const fresh = (a: number[], tn: number) => { while (a.length && tn - a[0] >= WIN) a.shift(); return a; };
/** Parametreleri Firebase kurallarına indirger (boş değer düşer; mantıksal → 0/1; metin kısaltılır ve harf/rakam/_ . : - dışı atılır). */
export function clean(p: Params): Record<string, string | number> {
  const out: Record<string, string | number> = {}; let n = 0;
  for (const k of Object.keys(p)) {
    let v = p[k]; if (v == null || v === '' || !NAME_RE.test(k) || RESERVED_PREFIX.test(k)) continue;
    if (typeof v === 'boolean') v = v ? 1 : 0;
    if (typeof v === 'number') { if (!Number.isFinite(v)) continue; v = Math.round(v * 1e4) / 1e4; }
    else { v = String(v).replace(/[^A-Za-z0-9_.:-]/g, '').slice(0, MAX_STR); if (!v) continue; }
    if (++n > MAX_PARAMS) break;
    out[k] = v;
  }
  return out;
}
/** Tek çıkış: ad denetimi, hız sınırı, temizlik, Analytics.log. Gönderildiyse true. */
export function send(name: string, p: Params = {}, tn = Date.now()): boolean {
  try {
    if (!validName(name)) { stats.invalid++; return false; }
    const h = fresh(hits[name] || (hits[name] = []), tn); fresh(allHits, tn);
    if (h.length >= LIMIT.name || allHits.length >= LIMIT.all || total >= LIMIT.session) { stats.dropped++; return false; }
    h.push(tn); allHits.push(tn); total++; stats.sent++;
    Analytics.log(name, clean({ ...p, play_b: minB(S ? S.playMs : 0) }));
    return true;
  } catch { return false; }
}
/** Oturumda aynı anahtar için yalnız ilk çağrıda true ("gördü/açtı" olaylarında örnekleme). */
function once(key: string): boolean { if (onceSet.has(key)) return false; if (onceSet.size >= LIMIT.once) onceSet.clear(); onceSet.add(key); return true; }
const safe = <A extends unknown[]>(f: (...a: A) => void) => (...a: A) => { try { f(...a); } catch (e) { Analytics.error(e, 'funnel'); } };

/* ---------- bir-kez bitleri (S.fn) ---------- */
const bit = (n: number) => 1 << n;
const msBit = (m: MsId) => bit(MS.indexOf(m)), sysBit = (s: SysId) => bit(MS.length + SYS.indexOf(s));
export const FN_MASK = (1 << (MS.length + SYS.length)) - 1;
const has = (b: number) => ((S.fn | 0) & b) !== 0;
const mark = (b: number) => { S.fn = ((S.fn | 0) | b) & FN_MASK; };
/** Kilometre taşı: kayıt başına bir kez (oyun süresi dakikasıyla). */
const ms = safe((m: MsId) => {
  const b = msBit(m); if (!S || !b || has(b)) return;
  mark(b); send('ms_' + m, { play_min: playMin(), own: S.own.length });
});
/** Sistem açıldı (kilit kalktı): sistem başına bir kez. */
const unlock = safe((s: SysId, open: boolean) => {
  const b = sysBit(s); if (!open || !S || has(b)) return;
  mark(b); send('sys_unlock', { sys: s, play_min: playMin(), own: S.own.length });
});
/** Eski kayıt: zaten yaşanmış kilometre taşları ve kullanılmış sistemler olay göndermeden işaretlenir (açılışta). */
export function seed() {
  try {
    if (!S) return; let b = 0;
    const lots = Object.values(S.d || {}), any = lots.some(l => l.some(p => !!p));
    if (any) b |= msBit('first_build');
    if (S.collects > 0) b |= msBit('first_collect');
    if (S.own.length >= 2 || S.shares > 0 || lots.some(l => l.length > 0 && l.every(p => !!p && p.lvl >= 1))) b |= msBit('district_full');
    if (S.own.length >= 2 || S.shares > 0) b |= msBit('second_deed');
    const met = Object.values(S.tdef || {});
    if (met.some(d => d.ok > 0)) b |= msBit('first_tenant');
    if (met.length || (S.ten || []).length) b |= sysBit('tenant');
    if (Object.values(S.pj || {}).some(l => l.length > 0)) b |= msBit('first_project') | sysBit('project');
    if (S.pjIntro) b |= sysBit('project');
    const ih = S.ihale;
    if (ih && (ih.wins + ih.losses > 0 || (ih.cur && ih.cur.my > 0))) b |= msBit('first_auction');
    if (ih && (ih.intro || ih.cur || ih.wins + ih.losses > 0)) b |= sysBit('ihale');
    const log = (S.bank && S.bank.log) || [];
    if (log.some(l => l.dir === 'out')) b |= msBit('first_transfer');
    if (log.length) b |= sysBit('bank');
    mark(b);
  } catch (e) { Analytics.error(e, 'funnel_seed'); }
}

/* ---------- kullanıcı özellikleri ---------- */
let lastProps: Record<string, string> = {};
export function userProps(): Record<string, string> {
  return {
    region: String(REGION), lang: String(LANG),
    payer: S.club ? 'club' : S.premium ? 'premium' : S.noAds ? 'noads' : 'none',
    holding_b: String(cntB(S.shares || 0)), own_b: String(cntB(S.own.length)),
    collect_mode: S.collectMode === 'auto' ? 'auto' : 'tap',
  };
}
const syncProps = safe(() => {
  const p = userProps(), ch: Record<string, string> = {};
  for (const k of Object.keys(p)) if (lastProps[k] !== p[k]) ch[k] = p[k].slice(0, MAX_PROP_VAL);
  if (Object.keys(ch).length) { lastProps = p; Analytics.props(ch); }
});

/* ---------- oturum belleği (süre kovaları ve sayaçlar için; kayda yazılmaz) ---------- */
let tenAt: Record<number, { a?: number; r?: number }> = {}, proxyN: Record<string, number> = {};
const tenP = (x: Tenant): Params => {
  const ch = x.c ? CHAR[x.c] : null;
  return { ...place(x.k), arch: x.a, wish: x.w.k, wtype: x.w.t, late: ['proj', 'kose', 'paint', 'renov'].includes(x.w.k), trait: ch ? traitOf(ch) : undefined, ch: x.c };
};
const aucP = (a: Auction, tn: number): Params => ({
  kind: a.kind, rival: a.rv, city: a.city, joined: a.my > 0, phase: a.done ? 'done' : a.close - tn <= CFG.IH_LATE_MS ? 'late' : 'early',
  my_x: a.my > 0 && a.start > 0 ? xB(a.my / a.start) : undefined, open_e: magB(a.start),
});

let gates: Partial<Record<SysId, () => boolean>> = {}, timer: ReturnType<typeof setInterval> | null = null;

export const Funnel = {
  /** Açılışta bir kez: eski kayıt işaretlenir, kullanıcı özellikleri yazılır, kilit denetimi (5 sn'de bir) başlar. */
  boot(g: Partial<Record<SysId, () => boolean>> = {}) {
    gates = g; seed(); Funnel.tick();
    if (timer) clearInterval(timer);
    if (typeof setInterval !== 'undefined') timer = setInterval(Funnel.tick, 5000);
  },
  tick: safe(() => { if (!S) return; syncProps(); if (!S.city) return; for (const s of SYS) { const f = gates[s]; if (f) unlock(s, !!f()); } }),
  ms, unlock,

  /** Kiracı hunisi: arrive → open → ready → settle → end | leave (+ renov). */
  tenant: safe((step: keyof typeof TENANT, x: Tenant) => {
    const m = tenAt[x.id] || (tenAt[x.id] = {}), pm = S.playMs, p = tenP(x);
    if (step === 'arrive') m.a = pm;
    if (step === 'open') { if (!once('ten' + x.id + x.st)) return; p.st = x.st; }
    if (step === 'ready') { m.r = pm; if (m.a != null) p.wait_b = minB(pm - m.a); }
    if (step === 'settle') {
      if (m.r != null) p.key_b = minB(pm - m.r);
      p.nth = cntB(Object.values(S.tdef || {}).reduce((s, d) => s + (d.ok || 0), 0));
      p.new_ch = !!x.c && ((S.tdc || {})[x.c] || { ok: 0 }).ok === 1;
    }
    if (step === 'leave') { p.st = x.st; if (m.a != null) p.wait_b = minB(pm - m.a); }
    if (step === 'leave' || step === 'end') delete tenAt[x.id];
    send(TENANT[step], p);
    if (step === 'settle') ms('first_tenant');
  }),
  /** Proje hunisi: offer → select → card → start → done → stage2 | split (+ open: proje paneli). */
  project: safe((step: keyof typeof PROJECT, k: DistrictKey | string, o: { q?: Pj; kind?: string; n?: number; cost?: number } = {}) => {
    if (step === 'offer' && !once('pjo' + k)) return;
    if (step === 'open' && !once('pjp' + k + (o.q ? o.q.a + '.' + o.q.st : ''))) return;
    const q = o.q, p: Params = { ...place(k), kind: q ? q.kd : o.kind, st: q ? q.st : undefined, n: o.n, own_pj: (S.pj[k as DistrictKey] || []).length };
    if (o.cost != null) { p.cost_e = magB(o.cost); p.afford = S.cash >= o.cost; }
    send(PROJECT[step], p);
    if (step === 'start') ms('first_project');
  }),
  /** İhale hunisi: open → view → proxy → passed → close (+ kose_open → kose). */
  ihale: safe((step: keyof typeof IHALE, a: Auction | null, o: { lead?: string; district?: string } = {}, tn: number = Date.now()) => {
    const p: Params = a ? aucP(a, tn) : {};
    if (step === 'view') { if (!once('ihv' + (a ? a.id + (a.my > 0 ? 1 : 0) + (a.done || '') : ''))) return; if (!a) p.phase = 'none'; }
    if (step === 'kose_open') { if (!once('kso' + S.ihale.kp)) return; p.kp = S.ihale.kp; }
    if (step === 'proxy' && a) { p.nth = proxyN[a.id] = (proxyN[a.id] || 0) + 1; p.lead = o.lead; }
    if (step === 'close' && a) { p.result = a.done; p.paid_x = a.paid && a.start > 0 ? xB(a.paid / a.start) : undefined; delete proxyN[a.id]; }
    if (step === 'kose' && o.district) Object.assign(p, place(o.district));
    send(IHALE[step], p);
    if (step === 'proxy') ms('first_auction');
  }),
  /** Banka hunisi: open → tab → transfer | fail → go; claim (emanet teslim), cur (bilanço parası). */
  bank: safe((step: keyof typeof BANK, o: Params = {}) => { send(BANK[step], { from: REGION, ...o }); }),
  /** Banka paneli düğmeleri (sekme, bilanço parası). */
  bankAct: safe((a: string, v?: string) => {
    if (a === 'tab') Funnel.bank('tab', { tab: v });
    else if (a === 'cur') Funnel.bank('cur', { cur: v });
  }),
  /** Aktarım sonucu (game/bank.ts transfer). cashBefore: aktarımdan önceki kasa; cap: aktarımdan sonraki hak durumu. */
  bankSend: safe((to: string, amt: number, r: { ok: boolean; got?: number; held?: boolean; why?: string }, cap: { cap: number; used: number }, cashBefore: number) => {
    if (!r.ok) { Funnel.bank('fail', { to, why: r.why, amt_e: magB(amt) }); return; }
    Funnel.bank('transfer', { to, amt_e: magB(amt), got_e: magB(r.got || 0), held: !!r.held, cap_pct: cap.cap > 0 ? pctB(cap.used / cap.cap) : 100, cash_pct: cashBefore > 0 ? pctB(amt / cashBefore) : 0, nth: cntB((S.bank.log || []).filter(l => l.dir === 'out').length) });
    ms('first_transfer');
  }),
  /** Panel açıldı (ui/sheets/core.ts openSheet): yeni sistem panelleri huni olayına çevrilir. */
  sheet: safe((s: { k: string; key?: string; i?: number; tab?: string }) => {
    if (s.k === 'kiraci') { const x = (S.ten || []).find(t => t.k === s.key && t.i === s.i); if (x) Funnel.tenant('open', x); }
    else if (s.k === 'defter') { if (once('defter')) send('defter_open', { stamps: cntB(Object.values(S.tdc || {}).filter(d => d.ok > 0).length), met: cntB(Object.values(S.tdc || {}).length) }); }
    else if (s.k === 'proj' && s.key) Funnel.project('open', s.key, { q: (S.pj[s.key as DistrictKey] || []).find(q => q.a === s.i) });
    else if (s.k === 'ihale') Funnel.ihale('view', S.ihale ? S.ihale.cur : null);
    else if (s.k === 'kose') Funnel.ihale('kose_open', null);
    else if (s.k === 'banka') { if (once('bank')) Funnel.bank('open', { tab: s.tab || 'send', unlocked: gates.bank ? !!gates.bank() : undefined }); }
  }),
  /** Testler için: oturum belleğini ve hız sınırını sıfırlar. */
  reset() { hits = {}; allHits = []; total = 0; onceSet = new Set(); tenAt = {}; proxyN = {}; lastProps = {}; stats.sent = stats.dropped = stats.invalid = 0; },
};
