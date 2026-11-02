import { BuildingType, CityId, DistrictKey, N, SCHEMA, dkey, CFG, DMAP, TYPES, MAXLV, CITY_ORDER, OBSTACLE_IDS } from './config';

export interface Skin { c?: number; r?: number; s?: boolean; }
export interface Plot { t: BuildingType; lvl: number; buf: number; until: number; dur: number; up: boolean; bu?: number; sp?: string; ob?: string; sk?: Skin; } // bu: bu mülke 2x bitişi · sp: özel yapı · ob: engel (gecekondu, hurda…)
export type Lot = Plot | null;
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
  fest: string;                    // bayram ikramiyesinin alındığı gün
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
  tokens: number;                  // 2x jetonu (reklamsız mülke 2x)
  skinsU: number[];                // açılmış cephe renkleri
  season: { id: string; xp: number; got: number[]; ggot: number[]; gold: boolean };
  noAds: boolean;                  // Reklamsız paket (önbellek; kaynak RevenueCat)
  club: boolean;                   // Emlak Kulübü aboneliği (önbellek)
  starter: { at: number; bought: boolean }; // başlangıç paketi: gösterildiği an, alındı mı
  seasonFirst: boolean;            // Altın Tapu ilk sezon indirimi kullanıldı mı
  adCredit: number;                // bu oyun süresine (playMs) kadar geçiş reklamı yok
  clubDay: string;                 // Kulüp günlük jetonunun verildiği gün // tapu sezonu // lig (kaynak sunucu; bu önbellek), last = gösterilen son hafta sonucu
}

const emptyLots = (): Lot[] => Array(N).fill(null);

export function makeCode(): string {
  const A = 'ABCDEFGHJKLMNPRSTUVYZ23456789'; let c = 'TP';
  for (let k = 0; k < 4; k++) c += A[Math.floor(Math.random() * A.length)];
  return c;
}

export function newState(now: number, weekKey: string, city: CityId | null = null): State {
  const start = city || 'ist';
  return {
    v: SCHEMA, city, own: [dkey(start, 0)], cur: dkey(start, 0), d: { [dkey(start, 0)]: emptyLots() },
    cash: 150, earned: 0, boostUntil: 0, lastSeen: now, maxSeen: now, savedAt: 0,
    fx: [], disc: 0, playMs: 0,
    nextAd: CFG.INTER_MIN + Math.random() * (CFG.INTER_MAX - CFG.INTER_MIN), nextEvent: 90e3, nextOffer: 6 * 60e3, nextTaxi: 75e3,
    sound: true, notif: true, collects: 0, ads: 0, skipHint: 0, seen: { ev: true },
    daily: { last: '', streak: 0 }, tasks: null, shares: 0, coll: [],
    ref: { code: makeCode(), used: false, rewarded: 0 }, week: { key: weekKey, earned: 0 },
    offer: null, premium: false, clockFlag: 0, league: { tier: 0, seals: 0, last: '' }, guideHint: false, collectMode: 'tap', stars: {}, inv: [], ozel: { week: '', bought: false }, fest: '', rifki: true, lien: {}, lienT: {}, dEarn: {}, cards: [],
    market: '', ach: [], cnt: { ob: 0, civic: 0, skin: 0, kapora: 0 }, civic: {}, nextCivic: 12 * 60e3, night: true, tokens: 0, skinsU: [], season: { id: '', xp: 0, got: [], ggot: [], gold: false },
    noAds: false, club: false, starter: { at: 0, bought: false }, seasonFirst: false, adCredit: 0, clubDay: '',
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
function rec<T>(x: unknown, f: (v: unknown) => T | undefined): Record<string, T> {
  const o: Record<string, T> = {};
  if (isObj(x)) for (const k of Object.keys(x)) { if (!isD(k)) continue; const v = f(x[k]); if (v !== undefined) o[k] = v; }
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
function sanitize(s: any, now: number, weekKey: string): State {
  const own = [...new Set(strs(s.own).filter(isD))];
  const city: CityId | null = CITY_ORDER.includes(s.city) ? s.city : own.length ? DMAP[own[0]].city : null;
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
  out.inv = strs(s.inv); out.coll = strs(s.coll); out.cards = strs(s.cards); out.ach = strs(s.ach); out.skinsU = nums(s.skinsU);
  out.stars = rec(s.stars, v => (Array.isArray(v) ? nums(v) : undefined));
  out.lien = rec(s.lien, v => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : undefined));
  out.lienT = rec(s.lienT, v => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : undefined));
  out.dEarn = rec(s.dEarn, v => (typeof v === 'number' && Number.isFinite(v) ? Math.max(0, v) : undefined));
  out.civic = rec(s.civic, v => (Array.isArray(v) ? strs(v) : undefined));
  out.seen = isObj(s.seen) ? Object.fromEntries(Object.keys(TYPES).filter(t => s.seen[t] === true).map(t => [t, true])) : base.seen;
  out.season = { ...out.season, got: nums(out.season.got), ggot: nums(out.season.ggot) };
  out.tasks = isObj(s.tasks) && Array.isArray(s.tasks.list) ? { day: String(s.tasks.day || ''), bonus: s.tasks.bonus === true, list: s.tasks.list.filter(isObj) } : null;
  out.offer = isObj(s.offer) && typeof s.offer.k === 'string' && Number.isFinite(s.offer.until) ? s.offer : null;
  if (!out.ref.code || typeof out.ref.code !== 'string') out.ref = base.ref;
  if (out.collectMode !== 'auto') out.collectMode = 'tap';
  return out as State;
}

/* oyun genelinde paylaşılan canlı durum */
export let S: State;
export function setS(next: State) { S = next; }
