import { BuildingType, CityId, DistrictKey, N, COLS, ROWS, SCHEMA, dkey, CFG, DMAP, TYPES, MAXLV, CITY_ORDER, OBSTACLE_IDS, REGION, CITIES } from './config';
import { IHALE_IDS, migrateColl } from './landmarks';
import type { Tenant } from './game/tenants';

export interface Skin { c?: number; r?: number; s?: boolean; }
export interface Plot { t: BuildingType; lvl: number; buf: number; until: number; dur: number; up: boolean; bu?: number; sp?: string; ob?: string; sk?: Skin; } // bu: bu mülke 2x bitişi · sp: özel yapı · ob: engel (gecekondu, hurda…)
export type Lot = Plot | null;
/** Büyük proje (game/project.ts): 2×2 blok, a: sol üst arsa. st: tamamlanan etap (0 = ilk inşaat sürüyor, 2 = son).
 *  until/dur: süren etabın bitişi (oyun saati, binalar gibi) ve süresi; until 0 = inşaat yok. kd: tür (yalnızca ad/görünüm). */
export interface Pj { a: number; kd: PjKind; st: number; until: number; dur: number; }
export type PjKind = 'site' | 'carsi' | 'plaza' | 'karma';
export const PJ_KINDS: readonly PjKind[] = ['site', 'carsi', 'plaza', 'karma'];
/** İhale (game/auccore.ts). kind: lm tarihi yapı · arsa köşe başı. Tutarlar oyun parası; rv: rakip (şehrin emlakçısı).
 *  my: oyuncunun vekâleti (0 = katılmadı) · held: kasadan ayrılan emanet (önde olunan fiyat) · log: son teklifler (görünüm). */
export type AucKind = 'lm' | 'arsa';
export interface Bid { who: 'me' | 'rv'; v: number; at: number }
export interface Auction {
  id: string; kind: AucKind; prize: string; city: CityId; rv: string; open: number; close: number;
  start: number; step: number; cap: number; capLo: number; capHi: number; early: number;
  my: number; held: number; log: Bid[]; done?: 'won' | 'lost'; paid?: number;
  seen?: boolean; tip?: boolean; lateSaid?: boolean; cutSaid?: boolean;
}
/** rm: rakip → son sonucun ruh hali (+1 hırslı, −1 kasası boşalmış) · got: İhale salonu yapıları · kose: "semt:arsa" köşe başı
 *  damgaları · kp: vurulmayı bekleyen damga · intro: Rıfkı rakibi tanıttı mı · skip: ödülsüz geçen pencere. */
export interface IhaleState { cur: Auction | null; rm: Record<string, number>; got: string[]; kose: string[]; kp: number; intro: boolean; wins: number; losses: number; skip?: string }
export interface Fx { k: 'row' | 'type'; d?: DistrictKey; r?: number; t?: BuildingType; x: number; until: number; }
export interface Task { k: string; goal: number; prog: number; claimed: boolean; }
export interface Offer { k: string; goal: number; prog: number; until: number; title: string; rw: number; done: boolean; }

export interface State {
  v: number;
  city: CityId | null;             // başlangıç ili (oyuncu seçer)
  own: DistrictKey[];              // tapusu alınmış semtler
  cur: DistrictKey;                // ekrandaki semt
  d: Record<DistrictKey, Lot[]>;
  cash: number; earned: number;    // earned: bu holding turundaki toplam kazanç
  boostUntil: number; lastSeen: number; maxSeen: number; savedAt: number;
  fx: Fx[]; disc: number; playMs: number;
  nextAd: number; nextEvent: number; nextOffer: number; nextTaxi: number;
  sound: boolean; notif: boolean; collects: number; ads: number; skipHint: number;
  seen: Partial<Record<BuildingType, boolean>>;
  daily: { last: string; streak: number };
  tasks: { day: string; bonus: boolean; list: Task[] } | null;
  shares: number; coll: string[];
  ref: { code: string; used: string | false; rewarded: number };
  week: { key: string; earned: number };
  offer: Offer | null;
  premium: boolean;                // önbellek; kaynak RevenueCat
  clockFlag: number;               // saat geri alındığında artar (analitik için)
  league: { tier: number; seals: number; last: string };
  guideHint: boolean;              // kılavuz sekmesi bir kez tanıtıldı mı
  collectMode: 'tap' | 'auto';     // kira toplama: ortadaki TOPLA mührü ya da otomatik
  stars: Record<DistrictKey, number[]>; // semt hedefleri: kazanılan hedeflerin sırası
  inv: string[];                   // depodaki özel yapılar (yerleştirilmeyi bekleyen)
  ozel: { week: string; bought: boolean }; // haftanın özel tapusu
  rifki: boolean;                  // Rıfkı Abi'nin ipuçları açık mı
  lien: Record<DistrictKey, number>; // kaporalı semtlerin kalan borcu
  lienT: Record<DistrictKey, number>; // kaporalı semtlerin ilk borcu (ilerleme için)
  dEarn: Record<DistrictKey, number>; // semt, oyuncu başka semtteyken ne kazandı (semt özeti)
  cards: string[];                 // gösterilen il kartpostalları
  market: string;                  // piyasa raporu gösterilen hafta
  ach: string[];                   // tapu arşivi: kazanılan mühürler
  cnt: { ob: number; civic: number; skin: number; kapora: number }; // arşiv sayaçları
  civic: Record<DistrictKey, string[]>; // belediye kararları
  nextCivic: number;               // sonraki belediye kartı (oyun süresi, ms)
  night: boolean;                  // gece görünümü açık mı
  vib?: boolean;                   // titreşim (false: kapalı; eski kayıtta yok = açık)
  tokens: number;                  // 2x jetonu (reklamsız mülke 2x)
  skinsU: number[];                // açılmış cephe renkleri
  season: { id: string; xp: number; got: number[]; ggot: number[]; gold: boolean };
  noAds: boolean;                  // Reklamsız paket (önbellek; kaynak RevenueCat)
  club: boolean;                   // Emlak Kulübü aboneliği (önbellek)
  starter: { at: number; bought: boolean }; // başlangıç paketi: gösterildiği an, alındı mı
  seasonFirst: boolean;            // Altın Tapu ilk sezon indirimi kullanıldı mı
  adCredit: number;                // bu oyun süresine (playMs) kadar geçiş reklamı yok
  ten: Tenant[];                   // kiracılar (game/tenants.ts): bekleyen adaylar, anahtar bekleyenler ve yerleşenler
  tdef: Record<string, { met: number; ok: number }>; // kiracı defteri: tip → tanışılan / yerleşen (yalnızca görünüm)
  nextTen: number;                 // sonraki kiracı adayı (oyun süresi, ms; 0 = henüz açılmadı)
  pj: Record<DistrictKey, Pj[]>;   // büyük projeler (arsa birleştirme), semt başına en fazla CFG.PJ_MAX
  pjIntro: boolean;                // Rıfkı projeleri bir kez tanıttı mı
  ihale: IhaleState;               // rakip emlakçı ve ihale (game/auccore.ts)
  clubDay: string;                 // Kulüp günlük jetonunun verildiği gün // tapu sezonu // lig (kaynak sunucu; bu önbellek), last = gösterilen son hafta sonucu
}

const emptyLots = (): Lot[] => Array(N).fill(null);

export function makeCode(): string {
  const A = 'ABCDEFGHJKLMNPRSTUVYZ23456789'; let c = 'TP';
  for (let k = 0; k < 4; k++) c += A[Math.floor(Math.random() * A.length)];
  return c;
}

export function newState(now: number, weekKey: string, city: CityId | null = null): State {
  const start = city || CITY_ORDER[0];
  return {
    v: SCHEMA, city, own: [dkey(start, 0)], cur: dkey(start, 0), d: { [dkey(start, 0)]: emptyLots() },
    cash: 150, earned: 0, boostUntil: 0, lastSeen: now, maxSeen: now, savedAt: 0,
    fx: [], disc: 0, playMs: 0,
    nextAd: CFG.INTER_MIN + Math.random() * (CFG.INTER_MAX - CFG.INTER_MIN), nextEvent: 90e3, nextOffer: 6 * 60e3, nextTaxi: 75e3,
    sound: true, notif: true, collects: 0, ads: 0, skipHint: 0, seen: { ev: true },
    daily: { last: '', streak: 0 }, tasks: null, shares: 0, coll: [],
    ref: { code: makeCode(), used: false, rewarded: 0 }, week: { key: weekKey, earned: 0 },
    offer: null, premium: false, clockFlag: 0, league: { tier: 0, seals: 0, last: '' }, guideHint: false, collectMode: 'tap', stars: {}, inv: [], ozel: { week: '', bought: false }, rifki: true, lien: {}, lienT: {}, dEarn: {}, cards: [],
    market: '', ach: [], cnt: { ob: 0, civic: 0, skin: 0, kapora: 0 }, civic: {}, nextCivic: 12 * 60e3, night: true, vib: true, tokens: 0, skinsU: [], season: { id: '', xp: 0, got: [], ggot: [], gold: false },
    noAds: false, club: false, starter: { at: 0, bought: false }, seasonFirst: false, adCredit: 0, clubDay: '',
    ten: [], tdef: {}, nextTen: 0, pj: {}, pjIntro: false,
    ihale: { cur: null, rm: {}, got: [], kose: [], kp: 0, intro: false, wins: 0, losses: 0 },
  };
}

export function lotsOf(s: State, k: DistrictKey): Lot[] {
  if (!s.d[k]) s.d[k] = emptyLots();
  return s.d[k];
}

/** Eski kayıtları güncel şemaya taşır. Bozuk veri için null döner. */
export function migrate(raw: any, now: number, weekKey: string): State | null {
  if (!raw || typeof raw !== 'object') return null;
  let s = raw;
  if (s.v === 1) {
    if (!Array.isArray(s.d)) return null;
    const d: Record<string, Lot[]> = {};
    s.d.forEach((lots: Lot[], i: number) => { if (i < 5) d[dkey('ist', i)] = Array.isArray(lots) ? lots.slice(0, N) : emptyLots(); });
    const unlocked = Math.max(1, Math.min(5, s.unlocked | 0));
    s = { ...s, v: 2, city: 'ist', own: Array.from({ length: unlocked }, (_, i) => dkey('ist', i)), cur: dkey('ist', Math.min(s.cur | 0, unlocked - 1)), d,
      fx: (s.fx || []).map((f: any) => f.k === 'row' ? { ...f, d: dkey('ist', f.d | 0) } : f), maxSeen: s.lastSeen || now, savedAt: 0, clockFlag: 0 };
    delete s.unlocked;
  }
  if (s.v !== SCHEMA || !s.d || typeof s.d !== 'object' || Array.isArray(s.d) || !Array.isArray(s.own)) return null;
  return sanitize(s, now, weekKey);
}

/* ---------- kayıt temizliği: bozuk, eksik ya da elle değiştirilmiş alanlar varsayılana döner ---------- */
const kind = (x: unknown) => (x === null ? 'null' : Array.isArray(x) ? 'array' : typeof x);
const isObj = (x: unknown): x is Record<string, any> => kind(x) === 'object';
const num = (x: unknown, def: number, min = -Infinity, max = Infinity) => (typeof x === 'number' && Number.isFinite(x) ? Math.min(max, Math.max(min, x)) : def);
const strs = (x: unknown) => (Array.isArray(x) ? x.filter(v => typeof v === 'string') : []);
const nums = (x: unknown) => (Array.isArray(x) ? x.filter(v => typeof v === 'number' && Number.isFinite(v)) : []);
const isD = (k: unknown): k is DistrictKey => typeof k === 'string' && Object.prototype.hasOwnProperty.call(DMAP, k);
const MAX_CASH = 1e300; // taşmayı (Infinity) önler
function rec<T>(x: unknown, f: (v: unknown, k: DistrictKey) => T | undefined): Record<string, T> {
  const o: Record<string, T> = {};
  if (isObj(x)) for (const k of Object.keys(x)) { if (!isD(k)) continue; const v = f(x[k], k); if (v !== undefined) o[k] = v; }
  return o;
}
function cleanLot(q: unknown): Lot {
  if (!isObj(q) || !TYPES[q.t as BuildingType]) return null;
  const p: Plot = { t: q.t, lvl: Math.round(num(q.lvl, 0, 0, MAXLV)), buf: num(q.buf, 0, 0, MAX_CASH), until: num(q.until, 0, 0), dur: num(q.dur, 1, 1), up: q.up === true };
  if (typeof q.bu === 'number' && Number.isFinite(q.bu)) p.bu = q.bu;
  if (typeof q.sp === 'string') p.sp = q.sp;
  if (typeof q.ob === 'string') { if (!OBSTACLE_IDS.includes(q.ob)) return null; p.ob = q.ob; } // bilinmeyen engel: boş arsa
  if (isObj(q.sk)) p.sk = { ...(typeof q.sk.c === 'number' ? { c: q.sk.c } : {}), ...(typeof q.sk.r === 'number' ? { r: q.sk.r } : {}), ...(q.sk.s === true ? { s: true } : {}) };
  return p;
}
const cleanLots = (x: unknown): Lot[] => { const a = Array.isArray(x) ? x.slice(0, N).map(cleanLot) : []; while (a.length < N) a.push(null); return a; };
/* kiracılar: game/tenants.ts ile aynı listeler (döngüsel içe aktarma olmasın diye burada; birim testi eşitliği denetler) */
export const TEN_ARCHS = ['ogrenci', 'aile', 'sanatci', 'yazilimci', 'emekli', 'esnaf'];
const TEN_WISH = ['nb', 'quiet', 'lvl', 'new'], TEN_ST = ['wait', 'ready', 'live'], TEN_MAX_N = 24;
const int = (x: unknown, min: number, max: number) => typeof x === 'number' && Number.isInteger(x) && x >= min && x <= max;
/** Kiracı listesi: bozuk / bilinmeyen kayıtlar düşer; süreler oyun süresine göre makul aralığa çekilir (elle uzatılamaz). */
function cleanTenants(x: unknown, own: DistrictKey[], playMs: number): Tenant[] {
  if (!Array.isArray(x)) return [];
  const out: Tenant[] = [], seen = new Set<string>(), fin = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
  for (const q of x) {
    if (out.length >= TEN_MAX_N) break;
    if (!isObj(q) || !TEN_ARCHS.includes(q.a) || !isD(q.k) || !own.includes(q.k) || !int(q.i, 0, N - 1) || !TEN_ST.includes(q.st) || !fin(q.id) || !fin(q.dl) || !fin(q.end)) continue;
    const w = q.w; if (!isObj(w) || !TEN_WISH.includes(w.k)) continue;
    const wt = w.t === undefined ? undefined : TYPES[w.t as BuildingType] ? (w.t as BuildingType) : null;
    if (wt === null || ((w.k === 'nb' || w.k === 'new') && !wt) || (w.k === 'lvl' && !int(w.n, 1, MAXLV))) continue;
    const key = q.k + ':' + q.i; if (seen.has(key)) continue; seen.add(key);
    const wish: Tenant['w'] = { k: w.k }; if (wt) wish.t = wt; if (w.k === 'lvl') wish.n = w.n; if (w.k === 'new' && w.sea === true) wish.sea = true;
    const t: Tenant = { id: q.id, a: q.a, k: q.k, i: q.i, w: wish, st: q.st,
      dl: Math.min(q.dl, playMs + Math.max(CFG.TEN_WAIT, CFG.TEN_READY)), end: q.st === 'live' ? Math.min(q.end, playMs + CFG.TEN_LIVE) : 0 };
    if (q.noted === true) t.noted = true;
    out.push(t);
  }
  return out;
}
function cleanTdef(x: unknown): Record<string, { met: number; ok: number }> {
  const o: Record<string, { met: number; ok: number }> = {};
  if (isObj(x)) for (const a of TEN_ARCHS) { const r = x[a]; if (isObj(r)) o[a] = { met: Math.floor(num(r.met, 0, 0, 1e6)), ok: Math.floor(num(r.ok, 0, 0, 1e6)) }; }
  return o;
}
/** Büyük projeler: geçerli 2×2 (sağ ve alt kenarı taşmaz), sahip olunan semtte, dört arsası da bina (özel yapı / engel değil),
 *  çakışmayan; etap 0–2, süren inşaat makul (elle uzatılamaz, 2. etaptan sonra inşaat olmaz). Bozuk proje düşer: binalar yerinde kalır. */
const PJ_DUR_MAX = 48 * 3600e3, PJ_N_MAX = 4; // 4×5 ızgarada en fazla 4 ayrık 2×2
function cleanPj(x: unknown, own: DistrictKey[], d: Record<string, Lot[]>, now: number): Record<DistrictKey, Pj[]> {
  return rec(x, (v, k) => {
    if (!Array.isArray(v) || !own.includes(k)) return undefined;
    const lots = d[k] || [], used = new Set<number>(), out: Pj[] = [];
    for (const q of v) {
      if (out.length >= PJ_N_MAX) break;
      if (!isObj(q) || !int(q.a, 0, N - 1) || q.a % COLS >= COLS - 1 || Math.floor(q.a / COLS) >= ROWS - 1 || !PJ_KINDS.includes(q.kd)) continue;
      const cells = [q.a, q.a + 1, q.a + COLS, q.a + COLS + 1];
      if (cells.some(j => used.has(j) || !lots[j] || lots[j]!.sp || lots[j]!.ob || lots[j]!.lvl < 1)) continue;
      cells.forEach(j => used.add(j));
      const st = Math.round(num(q.st, 0, 0, 2)), dur = num(q.dur, 1, 1, PJ_DUR_MAX);
      let until = num(q.until, 0, 0); if (until) until = Math.min(until, now + dur);
      if (st >= 2) until = 0;
      out.push({ a: q.a, kd: q.kd, st: until || st ? st : 1, until, dur }); // etap 0 ve inşaat yok: bozuk kayıt, ilk etap bitmiş sayılır
    }
    return out.length ? out : undefined;
  });
}
/** İhale: bilinmeyen yapı / bozuk damga düşer; süren ihale alan alan doğrulanır (bozuksa düşer, emaneti kasaya döner). */
const IH_LEN_MAX = 26 * 3600e3, MAX_RM = 64;
function cleanAuction(q: unknown): Auction | null {
  const f = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);
  if (!isObj(q) || typeof q.id !== 'string' || (q.kind !== 'lm' && q.kind !== 'arsa') || typeof q.prize !== 'string' || typeof q.rv !== 'string' || typeof q.city !== 'string' || !CITIES[q.city]) return null;
  if (q.kind === 'lm' && !IHALE_IDS.includes(q.prize)) return null;
  if (![q.open, q.close, q.start, q.step, q.cap, q.capLo, q.capHi, q.early, q.my, q.held].every(f)) return null;
  if (!(q.close > q.open) || q.close - q.open > IH_LEN_MAX || !(q.step > 0) || !(q.start > 0) || q.cap < q.start || q.my < 0 || q.held < 0 || q.held > MAX_CASH) return null;
  const a: Auction = { id: q.id, kind: q.kind, prize: q.prize, city: q.city, rv: q.rv, open: q.open, close: q.close, start: q.start, step: q.step, cap: q.cap,
    capLo: q.capLo, capHi: q.capHi, early: Math.min(0.95, Math.max(0.3, q.early)), my: q.my, held: q.held,
    log: Array.isArray(q.log) ? q.log.filter((b: any) => isObj(b) && (b.who === 'me' || b.who === 'rv') && f(b.v) && f(b.at)).slice(-12).map((b: any) => ({ who: b.who, v: b.v, at: b.at })) : [] };
  if (q.done === 'won' || q.done === 'lost') { a.done = q.done; a.held = 0; if (f(q.paid)) a.paid = q.paid; }
  for (const k of ['seen', 'tip', 'lateSaid', 'cutSaid'] as const) if (q[k] === true) a[k] = true;
  return a;
}
function cleanIhale(x: unknown, own: DistrictKey[], out: any): IhaleState {
  const q = isObj(x) ? x : {};
  const cur = cleanAuction(q.cur);
  if (!cur && isObj(q.cur) && typeof q.cur.held === 'number' && Number.isFinite(q.cur.held) && q.cur.held > 0 && !q.cur.done) out.cash = Math.min(MAX_CASH, out.cash + Math.min(q.cur.held, MAX_CASH)); // bozuk ihale: emanet kaybolmasın
  const rm: Record<string, number> = {};
  if (isObj(q.rm)) for (const k of Object.keys(q.rm).slice(0, MAX_RM)) { const v = q.rm[k]; if (v === 1 || v === -1) rm[k] = v; }
  const got = [...new Set(strs(q.got).filter(id => IHALE_IDS.includes(id)))];
  const kose: string[] = [], used = new Set<string>();
  for (const v of strs(q.kose)) { const [k, i] = v.split(':'); if (!own.includes(k) || used.has(k) || !/^\d+$/.test(i || '') || +i >= N) continue; used.add(k); kose.push(k + ':' + +i); }
  const r: IhaleState = { cur, rm, got, kose, kp: Math.floor(num(q.kp, 0, 0, 64)), intro: q.intro === true, wins: Math.floor(num(q.wins, 0, 0, 1e6)), losses: Math.floor(num(q.losses, 0, 0, 1e6)) };
  if (typeof q.skip === 'string') r.skip = q.skip;
  return r;
}
function sanitize(s: any, now: number, weekKey: string): State {
  const own = [...new Set(strs(s.own).filter(isD))].filter(k => CITY_ORDER.includes(DMAP[k].city)); // yalnızca etkin bölgenin semtleri
  // city: null = şehir henüz seçilmemiş (ilk açılış yarım kaldı): semtlerden türetilmez, oyuncu şehir seçer.
  // Alan hiç yoksa ya da bozuksa (eski kayıt) şehir semtlerden türetilir.
  const city: CityId | null = CITY_ORDER.includes(s.city) ? s.city : s.city !== null && own.length ? DMAP[own[0]].city : null;
  const base = newState(now, weekKey, city) as any;
  const out: any = {};
  for (const k of Object.keys(base)) {
    const bv = base[k], sv = s[k];
    if (sv === undefined || sv === null) { out[k] = bv; continue; }
    if (bv === null) { out[k] = isObj(sv) ? sv : null; continue; }           // tasks, offer: nesne ya da null
    if (kind(sv) !== kind(bv)) { out[k] = bv; continue; }
    if (typeof bv === 'number') { out[k] = num(sv, bv); continue; }
    if (isObj(bv) && Object.keys(bv).length) {                                 // yapılı nesneler: alan alan birleştir
      const o: any = {}; for (const f of Object.keys(bv)) { const a = sv[f], d = bv[f]; o[f] = a === undefined || (kind(a) !== kind(d) && !(d === false && typeof a === 'string')) ? d : typeof d === 'number' ? num(a, d) : a; }
      out[k] = o; continue;
    }
    out[k] = sv;
  }
  out.v = SCHEMA; out.city = city;
  out.own = own.length ? own : base.own;
  out.cur = out.own.includes(s.cur) ? s.cur : out.own[0];
  out.d = {}; for (const k of Object.keys(s.d)) if (isD(k)) out.d[k] = cleanLots(s.d[k]);
  for (const k of out.own) if (!out.d[k]) out.d[k] = cleanLots(null);
  out.cash = num(s.cash, 0, 0, MAX_CASH); out.earned = num(s.earned, 0, 0, MAX_CASH);
  out.disc = num(s.disc, 0, 0, 0.9); out.shares = Math.floor(num(s.shares, 0, 0, 1e6)); out.tokens = Math.floor(num(s.tokens, 0, 0, 1e6));
  out.fx = Array.isArray(s.fx) ? s.fx.filter((f: any) => isObj(f) && (f.k === 'row' || f.k === 'type') && Number.isFinite(f.x) && Number.isFinite(f.until)) : [];
  out.inv = strs(s.inv); out.coll = migrateColl(strs(s.coll), REGION); out.cards = strs(s.cards); out.ach = strs(s.ach); out.skinsU = nums(s.skinsU);
  out.stars = rec(s.stars, v => (Array.isArray(v) ? nums(v) : undefined));
  out.lien = rec(s.lien, v => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : undefined));
  out.lienT = rec(s.lienT, v => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : undefined));
  out.dEarn = rec(s.dEarn, v => (typeof v === 'number' && Number.isFinite(v) ? Math.max(0, v) : undefined));
  out.civic = rec(s.civic, v => (Array.isArray(v) ? strs(v) : undefined));
  out.seen = isObj(s.seen) ? Object.fromEntries(Object.keys(TYPES).filter(t => s.seen[t] === true).map(t => [t, true])) : base.seen;
  out.season = { ...out.season, got: nums(out.season.got), ggot: nums(out.season.ggot) };
  out.tasks = isObj(s.tasks) && Array.isArray(s.tasks.list) ? { day: String(s.tasks.day || ''), bonus: s.tasks.bonus === true, list: s.tasks.list.filter(isObj) } : null;
  const o = s.offer, fin = (x: unknown) => typeof x === 'number' && Number.isFinite(x);
  out.offer = isObj(o) && typeof o.k === 'string' && fin(o.until) && fin(o.goal) && o.goal > 0 && fin(o.prog) && typeof o.title === 'string' && fin(o.rw) && o.rw >= 0
    ? { k: o.k, goal: o.goal, prog: Math.max(0, o.prog), until: o.until, title: o.title, rw: o.rw, done: o.done === true } : null;
  out.pj = cleanPj(s.pj, out.own, out.d, now); out.pjIntro = s.pjIntro === true;
  out.ten = cleanTenants(s.ten, out.own, out.playMs); out.tdef = cleanTdef(s.tdef); out.nextTen = num(s.nextTen, 0, 0);
  out.ihale = cleanIhale(s.ihale, out.own, out);
  if (!out.ref.code || typeof out.ref.code !== 'string') out.ref = base.ref;
  if (out.collectMode !== 'auto') out.collectMode = 'tap';
  return out as State;
}

/* oyun genelinde paylaşılan canlı durum */
export let S: State;
export function setS(next: State) { S = next; }
