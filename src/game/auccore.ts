/* =========================================================
   RAKİP EMLAKÇI VE İHALE — saf kurallar (arayüz içe aktarmaz; simülasyon ve birim testleri de kullanır).
   Kartlar, panel, Rıfkı ve bildirim metinleri game/auction.ts ve ui/sheets/ihale.ts'te; portreler ui/rivalFace.ts'te.
   - Takvim: CFG.IH_LM_DAY (Pazartesi) ülkeye özgü tarihi yapı, CFG.IH_ARSA_DAY (Perşembe) nadir arsa (köşe başı);
     yerel CFG.IH_OPEN_H–IH_CLOSE_H (08:00–23:00); aynı anda tek ihale. Pencere kaçarsa ihale kurulmaz (geriye dönük yok).
   - Rakip: ihaleye konu olan yapının (arsada: oyuncunun o anki semtinin) şehrinin emlakçısı (15 şehir, Global'de de).
     Hepsi aynı adalet kurallarına uyar; dört ortak arketip (temkinli, atak, koleksiyoncu, pazarlıkçı) tavanı ve temposu
     küçük farklarla belirler. Tavan ihale açılırken belirlenir, hiç değişmez; son düzlükten önce tavanın ~%70'ine,
     son düzlükte (CFG.IH_LATE_MS) tamamına kadar çıkar. Son saniye kapmacası yok; eşitlikte rakip önde (ilk o teklif verdi).
   - Birim: dakikalık kira (ihale ilk kurulduğunda taban kira × 60, ihale boyunca sabit): fiyatlar ekonomiyle ölçeklenir.
   - Vekâlet (ikinci fiyat): oyuncu üst sınır verir; kazanan karşı tarafın sınırının bir adım üstünü öder.
   - Emanet: kasadan yalnızca önde olunan fiyat ayrılır (a.held); geçilince kasaya döner. Kasa yetmezse vekâlet kasanın
     karşıladığı yere iner. Kaybetmek ceza değildir. Holding'de süren katılım düşer (kasa zaten sıfırlanır).
   - Ödül: tarihi yapı → İhale salonu, tüm kiralar kalıcı +CFG.IH_LM_X (en çok CFG.IH_LM_N yapı); nadir arsa → köşe başı
     damgası (S.ihale.kp), oyuncu sahip olduğu bir semtte bir arsaya vurur: o arsanın kirası +CFG.IH_KOSE_X (semt başına 1,
     Holding'de semtle gider). İkisi de haftalık lig kazancına sayılmaz (economy.ts ihaleLotMult / leagueShare).
   ========================================================= */
import { CFG, N, DMAP, CityId, DistrictKey, REGION, cityRegion } from '../config';
import { S, Auction, IhaleState, AucKind } from '../state';
import { totalRate } from '../economy';
import { IHALE_LM, IhaleLm } from '../landmarks';
import { tk } from '../i18n';

export type { Auction, IhaleState, AucKind };
/* ---------- rakipler: şehir başına bir emlakçı, dört ortak arketip ---------- */
export type Arche = 'temkinli' | 'atak' | 'koleksiyoncu' | 'pazarlikci';
export const ARCHES: readonly Arche[] = ['temkinli', 'atak', 'koleksiyoncu', 'pazarlikci'];
/** Arketip: tavan çarpanı (tür başına) ve son düzlükten önceki tempo (tavanın payı). Beklenen zorluk dengeli: ortalama ≈ 1. */
export const ARCHE: Record<Arche, { n: string; k: Record<AucKind, number>; early: number }> = {
  temkinli: { n: tk('Temkinli'), k: { lm: 0.95, arsa: 0.95 }, early: -0.05 },
  atak: { n: tk('Atak'), k: { lm: 1.08, arsa: 1.08 }, early: 0.05 },
  koleksiyoncu: { n: tk('Koleksiyoncu'), k: { lm: 1.12, arsa: 0.92 }, early: 0 },
  pazarlikci: { n: tk('Pazarlıkçı'), k: { lm: 0.92, arsa: 1.12 }, early: 0 },
};
/** n: ad ([köşeli parantez]: yabancı özel ad) · tag: şehre özgü kısa tanıtım (cümle içi). */
export interface Rival { id: string; city: CityId; n: string; a: Arche; tag: string }
const RV = (id: string, city: CityId, n: string, a: Arche, tag: string): Rival => ({ id, city, n, a, tag });
export const RIVALS: Rival[] = [
  RV('cemil', 'ist', tk('Kurnaz Cemil'), 'koleksiyoncu', tk('Beyoğlu’nun eski tilkisi, tarihi yapılara düşkün')),
  RV('nevzat', 'izm', tk('Kordonlu Nevzat'), 'pazarlikci', tk('Kordon’un kurnaz emlakçısı, köşe başı arsayı kokusundan bilir')),
  RV('sabri', 'ank', tk('Bürokrat Sabri'), 'temkinli', tk('Kızılay’ın ağır başlı emlakçısı, her teklifi üç kez hesaplar')),
  RV('hank', 'nyc', tk('[Hustlin’ Hank]'), 'atak', tk('Manhattan’ın hızlı konuşan simsarı, beklemeyi sevmez')),
  RV('dolly', 'la', tk('[Dolly Sunset]'), 'koleksiyoncu', tk('Hollywood tepelerinin emlak kraliçesi, ünlü yapıları sever')),
  RV('walt', 'chi', tk('[Big Walt]'), 'temkinli', tk('Rüzgârlı Şehir’in çelik adamı, sağlam iş ister')),
  RV('reginald', 'lon', tk('[Sir Reginald]'), 'koleksiyoncu', tk('Londra’nın monoklü beyefendisi, saat kulelerine hayran')),
  RV('alf', 'man', tk('[Alf Higgins]'), 'atak', tk('Manchester’ın eski fabrika ustası, ilk teklifi hep o verir')),
  RV('hamish', 'edi', tk('[Laird Hamish]'), 'temkinli', tk('Royal Mile’ın inatçı toprak ağası, kesesini sıkı tutar')),
  RV('pfennig', 'muc', tk('[Herr Pfennig]'), 'temkinli', tk('Münih’in titiz muhasebecisi, hesabı şaşmaz')),
  RV('brandt', 'ber', tk('[Frau Brandt]'), 'atak', tk('Kreuzberg’in hızlı simsarı, fırsatı kaçırmaz')),
  RV('jansen', 'ham', tk('[Kapitän Jansen]'), 'pazarlikci', tk('Limanın emekli kaptanı, rıhtım arsalarına göz diker')),
  RV('tanaka', 'tyo', tk('[Tanaka-san]'), 'atak', tk('Shinjuku’nun çalışkan emlakçısı, kartvizitini hiç eksik etmez')),
  RV('omori', 'osa', tk('[Ōmori-han]'), 'pazarlikci', tk('Namba’nın güler yüzlü tüccarı, pazarlığı oyun sayar')),
  RV('hasegawa', 'kyo', tk('[Hasegawa-san]'), 'koleksiyoncu', tk('Kyoto’nun antika tüccarı, eski yapılara gönül vermiş')),
];
export const rivalOf = (city: CityId): Rival => RIVALS.find(r => r.city === city) || RIVALS[0];
export const rivalById = (id: string): Rival => RIVALS.find(r => r.id === id) || RIVALS[0];
/** Şu an karşılaşılacak rakip (ekrandaki semtin şehri): tanıtım kartı ve menü için. */
export const rivalHere = (): Rival => { const a = IH().cur; return a && !a.done ? rivalById(a.rv) : rivalOf(DMAP[S.cur] ? DMAP[S.cur].city : 'ist'); };

/* ---------- durum ---------- */
export function IH(): IhaleState {
  return S.ihale || (S.ihale = { cur: null, rm: {}, got: [], kose: [], kp: 0, intro: false, wins: 0, losses: 0 });
}
export const ihaleUnlocked = () => S.own.length >= CFG.IH_UNLOCK_OWN || (S.shares || 0) > 0;

/* ---------- yardımcılar ---------- */
/** "Güzel" sayı: ilk iki hane, yukarı yuvarlanır. */
export const nice = (v: number) => { const p = Math.pow(10, Math.max(0, Math.floor(Math.log10(Math.max(1, v))) - 1)); return Math.ceil(v / p) * p; };
/** Tohumlu [0,1): ihale kimliğinden (FNV-1a + karıştırma). */
export function seeded(id: string) { let h = 2166136261; for (const c of id) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } h ^= h >>> 13; h = Math.imul(h, 0x5bd1e995); h ^= h >>> 15; return ((h >>> 0) % 10000) / 10000; }
/** Ruh hali: rakip son ihaleyi kaybettiyse (+1) hırslı, kazandıysa (−1) kasası boşalmış. */
export const moodMult = (m: number) => (m > 0 ? 1 + CFG.IH_MOOD : m < 0 ? 1 - CFG.IH_MOOD : 1);
const day = (v: number) => ((Math.floor(v) % 7) + 7) % 7;

/** İhale oluşturur. unitPerMin: dakikalık kira. */
export function makeAuction(id: string, kind: AucKind, prize: string, city: CityId, open: number, unitPerMin: number): Auction {
  const rv = rivalOf(city), ar = ARCHE[rv.a], unit = Math.max(50, unitPerMin);
  const start = nice(unit * (kind === 'lm' ? CFG.IH_LM_OPEN : CFG.IH_ARSA_OPEN)), step = nice(start * CFG.IH_STEP);
  const mid = start * (kind === 'lm' ? CFG.IH_LM_K : CFG.IH_ARSA_K) * ar.k[kind] * moodMult(IH().rm[rv.id] || 0), nz = CFG.IH_NOISE;
  const cap = Math.max(start, Math.round(mid * (1 - nz + 2 * nz * seeded(id + rv.id)) / step) * step);
  const len = Math.max(3, CFG.IH_CLOSE_H - CFG.IH_OPEN_H) * 3600e3;
  return { id, kind, prize, city, rv: rv.id, open, close: open + len, start, step, cap,
    capLo: Math.max(start, Math.floor(mid * (1 - nz) / step) * step), capHi: Math.ceil(mid * (1 + nz) / step) * step,
    early: Math.min(0.95, Math.max(0.3, CFG.IH_EARLY + ar.early)), my: 0, held: 0, log: [{ who: 'rv', v: start, at: open }] };
}
export const isLate = (a: Auction, tn: number) => tn >= a.close - CFG.IH_LATE_MS;
/** Rakibin şu anki sınırı: son düzlükten önce tavanın a.early payı, son düzlükte tamamı. */
export const rivalMax = (a: Auction, tn: number) => (isLate(a, tn) ? a.cap : Math.max(a.start, Math.floor(a.cap * a.early / a.step) * a.step));
/** Önde kim, fiyat kaç (vekâlet / ikinci fiyat). Eşitlikte rakip önde. my: denenecek vekâlet (varsayılan a.my). */
export function standing(a: Auction, tn: number, my = a.my): { lead: 'me' | 'rv'; price: number } {
  const r = rivalMax(a, tn);
  if (my > r) return { lead: 'me', price: Math.min(my, Math.max(a.start, r + a.step)) };
  return { lead: 'rv', price: my ? Math.min(r, my + a.step) : a.start };
}
/** Kasa cash iken tn anında: vekâlet (kasa yetmezse inmiş hâliyle), önde kim, fiyat, emanet. Durumu değiştirmez. */
export function project(a: Auction, tn: number, cash: number) {
  let my = a.my, st = standing(a, tn, my), cut = false;
  if (st.lead === 'me' && st.price - a.held > cash) { my = Math.floor((a.held + cash) / a.step) * a.step; cut = true; st = standing(a, tn, my); }
  return { my, lead: st.lead, price: st.price, held: st.lead === 'me' ? st.price : 0, cut };
}
/** Emanet: önde olunan fiyat kasadan ayrılır; geçilince kasaya döner. Kasa yetmezse vekâlet iner (dönen: indi mi). */
export function settle(a: Auction, tn: number): boolean {
  if (a.done) return false;
  const p = project(a, tn, S.cash);
  a.my = p.my; S.cash -= p.held - a.held; a.held = p.held;
  return p.cut;
}
/** Rıfkı'nın önerisi: tavan aralığının üstü + 1 adım (bunu veren kesin kazanır; ödenen yine rakip tavanı + 1 adım). */
export const advice = (a: Auction) => a.capHi + a.step;
/** Vekâlet için en düşük anlamlı tutar (güncel fiyatın bir adım üstü ya da mevcut vekâletin bir adım üstü). */
export const minProxy = (a: Auction, tn: number) => Math.max(a.my, standing(a, tn).price) + a.step;
/** Bu vekâlet verilirse kasadan ek olarak ayrılacak tutar (önde kalınan fiyat − mevcut emanet). */
export function heldNeed(a: Auction, max: number, tn: number) { const st = standing(a, tn, max); return Math.max(0, (st.lead === 'me' ? st.price : 0) - a.held); }
export type ProxyErr = 'done' | 'low' | 'cash';
/** Vekâlet ver / yükselt. Hata yoksa null. */
export function setProxyCore(a: Auction, max: number, tn: number): ProxyErr | null {
  if (a.done || tn >= a.close) return 'done';
  max = Math.round(max / a.step) * a.step;
  if (max < minProxy(a, tn)) return 'low';
  if (S.cash < heldNeed(a, max, tn)) return 'cash';
  a.my = max; settle(a, tn);
  const st = standing(a, tn);
  a.log.push({ who: 'me', v: st.lead === 'me' ? st.price : max, at: tn });
  if (st.lead === 'rv') a.log.push({ who: 'rv', v: st.price, at: tn + 3000 }); // rakip birkaç saniye "düşünür"
  if (a.log.length > 12) a.log.splice(0, a.log.length - 12);
  return null;
}
/** Kapanış (kapanış anındaki duruma göre): kazanırsan emanet ödenir, kaybedersen kasana döner; rakibin ruh hali güncellenir. */
export function resolve(a: Auction) {
  if (a.done) return;
  const ih = IH(), at = a.close, joined = a.my > 0;
  settle(a, at);
  const st = standing(a, at);
  if (st.lead === 'me') {
    a.done = 'won'; a.paid = a.held; a.held = 0; ih.wins++; ih.rm[a.rv] = 1;
    if (a.kind === 'lm') { if (!ih.got.includes(a.prize)) ih.got.push(a.prize); } else ih.kp++;
  } else {
    a.done = 'lost'; a.paid = st.price; S.cash += a.held; a.held = 0; ih.rm[a.rv] = -1; if (joined) ih.losses++;
  }
  if (!joined) a.seen = true; // katılmayana sonuç kartı yok
}

/* ---------- takvim ---------- */
export interface Win { id: string; kind: AucKind; open: number; close: number }
/** tn anında açık ihale penceresi (yerel saat) ya da null. */
export function windowAt(tn: number): Win | null {
  const d = new Date(tn), g = d.getDay();
  const kind: AucKind | null = g === day(CFG.IH_LM_DAY) ? 'lm' : g === day(CFG.IH_ARSA_DAY) ? 'arsa' : null; if (!kind) return null;
  const oh = Math.max(0, Math.min(23, Math.floor(CFG.IH_OPEN_H))), ch = Math.max(oh + 1, Math.min(24, Math.floor(CFG.IH_CLOSE_H)));
  const open = new Date(d.getFullYear(), d.getMonth(), d.getDate(), oh).getTime(), close = new Date(d.getFullYear(), d.getMonth(), d.getDate(), ch).getTime();
  if (tn < open || tn >= close) return null;
  return { id: `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`, kind, open, close };
}
/** Sıradaki ihale penceresinin açılışı (Kılavuz ve boş panel için). */
export function nextWindow(tn: number): Win | null {
  for (let k = 0; k < 8; k++) {
    const d = new Date(tn); d.setDate(d.getDate() + k); d.setHours(Math.floor(CFG.IH_OPEN_H), 0, 30, 0);
    const w = windowAt(+d); if (w && w.close > tn) return w;
  }
  return null;
}
/** Bölgenin (Global'de şehrin ülkesinin) ihale yapıları. */
export const lmPool = (city: CityId) => IHALE_LM.filter(l => l.reg === (REGION === 'gl' ? cityRegion(city) : REGION));
export const lmGotN = () => Math.min(IH().got.length, Math.max(0, Math.floor(CFG.IH_LM_N)));
/** Köşe başı damgası vurulabilecek semt var mı (bekleyen damgalar dahil). */
export const koseRoom = () => S.own.filter(k => koseOf(k) < 0).length - IH().kp;
/** Semtteki köşe başı arsa (yoksa -1). */
export function koseOf(k: DistrictKey): number { for (const x of IH().kose) { const [d, i] = x.split(':'); if (d === k) return +i; } return -1; }
/** Ödül seçimi: Pazartesi henüz alınmamış bir ihale yapısı (önce ekrandaki semtin şehri). Yapılar bittiyse ya da köşe başı
 *  için yer kalmadıysa diğer tür; ikisi de olmazsa ihale yok. */
export function pickPrize(kind: AucKind): { kind: AucKind; prize: string; city: CityId } | null {
  const city = DMAP[S.cur] ? DMAP[S.cur].city : 'ist', ih = IH();
  const lm = (): IhaleLm | undefined => {
    if (lmGotN() >= Math.floor(CFG.IH_LM_N)) return undefined;
    const left = lmPool(city).filter(l => !ih.got.includes(l.id));
    return left.find(l => l.city === city) || left[0];
  };
  if (kind === 'lm') { const l = lm(); if (l) return { kind: 'lm', prize: l.id, city: l.city }; }
  if (koseRoom() > 0) return { kind: 'arsa', prize: 'kose', city };
  if (kind === 'arsa') { const l = lm(); if (l) return { kind: 'lm', prize: l.id, city: l.city }; }
  return null;
}
export interface TickEv { resolved?: Auction; created?: Auction; late?: Auction; cut?: Auction }
/** Oyun döngüsünden: süren ihalede emanet, kapanışta sonuç, pencere açıldıysa yeni ihale. Olayları döner (arayüz söyler). */
export function ihaleTickCore(tn: number, unit = () => totalRate(false) * 60): TickEv {
  const ev: TickEv = {}, ih = IH(); let a = ih.cur;
  if (a && !a.done) {
    if (tn < a.close) {
      if (settle(a, tn) && a.my > 0 && !a.cutSaid) { a.cutSaid = true; ev.cut = a; }
      if (isLate(a, tn) && !a.lateSaid && a.my > 0) { a.lateSaid = true; if (standing(a, tn).lead === 'rv') ev.late = a; }
    } else { resolve(a); ev.resolved = a; }
  }
  if (!ihaleUnlocked()) return ev;
  const w = windowAt(tn);
  if (w && (!a || a.id !== w.id) && ih.skip !== w.id) {
    if (a && !a.done) { resolve(a); ev.resolved = a; } // önceki (normalde kapanmış olur)
    const p = pickPrize(w.kind);
    if (p) { a = makeAuction(w.id, p.kind, p.prize, p.city, w.open, unit()); a.close = w.close; ih.cur = a; ev.created = a; }
    else ih.skip = w.id; // ödül kalmadı: bu pencere boş geçer
  }
  return ev;
}
/** Köşe başı damgası vurulabilir mi (sahip olunan, damgasız semt; geçerli arsa). */
export const koseOk = (k: DistrictKey, i: number) => IH().kp > 0 && S.own.includes(k) && koseOf(k) < 0 && Number.isInteger(i) && i >= 0 && i < N;
export function placeKoseCore(k: DistrictKey, i: number): boolean {
  if (!koseOk(k, i)) return false;
  const ih = IH(); ih.kp--; ih.kose.push(k + ':' + i); return true;
}
/** Holding: köşe başı semtle gider, süren ihaleye katılım düşer (emanet kasayla birlikte sıfırlanır), yapılar kalır. */
export function ihaleHolding() {
  const ih = S.ihale; if (!ih) return;
  ih.kose = [];
  const a = ih.cur; if (a && !a.done) { a.my = 0; a.held = 0; }
}
/** Bildirim planı (çıkarken): ihale başına en çok 2 — vekâlet verip önde olan, son düzlükte geçilecekse; katıldıysa sonuç.
 *  Kasa çevrimdışıyken değişmez: kapanış hesabı aynı kasayla yapılır (oyuna dönünce iptal edilir, sonuç kartı açılır). */
export function ihalePlan(t0: number): { passed: number | null; result: number; won: boolean } | null {
  const a = S.ihale && S.ihale.cur; if (!a || a.done || !(a.my > 0) || a.close <= t0) return null;
  const nowSt = standing(a, t0), lateAt = Math.max(t0, a.close - CFG.IH_LATE_MS);
  const late = project(a, lateAt, S.cash), end = project(a, a.close, S.cash);
  const passed = nowSt.lead === 'me' && late.lead === 'rv' && lateAt > t0 ? lateAt : null;
  return { passed, result: a.close, won: end.lead === 'me' };
}
