import { BuildingType, CityId, DistrictKey, N, SCHEMA, dkey, CFG } from './config';

export interface Plot { t: BuildingType; lvl: number; buf: number; until: number; dur: number; up: boolean; }
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
  guideHint: boolean;              // kılavuz sekmesi bir kez tanıtıldı mı // lig (kaynak sunucu; bu önbellek), last = gösterilen son hafta sonucu
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
    offer: null, premium: false, clockFlag: 0, league: { tier: 0, seals: 0, last: '' }, guideHint: false,
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
  if (s.v !== SCHEMA || typeof s.d !== 'object' || !Array.isArray(s.own)) return null;
  const base = newState(now, weekKey, s.city || null);
  for (const k of Object.keys(base) as (keyof State)[]) if (s[k] === undefined) (s as any)[k] = base[k];
  if (!s.ref || !s.ref.code) s.ref = base.ref;
  if (!s.own.length) s.own = base.own;
  if (!s.own.includes(s.cur)) s.cur = s.own[0];
  for (const k of s.own) if (!Array.isArray(s.d[k])) s.d[k] = emptyLots();
  if (!Number.isFinite(s.cash) || s.cash < 0) s.cash = 0;
  return s as State;
}

/* oyun genelinde paylaşılan canlı durum */
export let S: State;
export function setS(next: State) { S = next; }
