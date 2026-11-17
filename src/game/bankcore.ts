/* =========================================================
   BANKA ÇEKİRDEĞİ (saf hesap: arayüzsüz, depolamasız) — kur, makas/komisyon, günlük aktarım hakkı, bilanço değerlemesi.
   Birimler: tüm tutarlar İÇ BİRİMDE (her bölgede aynı ekonomi; ₺ = iç birim). Ekranda her bölgenin parası taban kurla
   ölçeklenir (config.ts dispScale). Bankada iç birimin değeri para birimine göre gün içinde hafifçe oynar:
     g_c(t) = 1 + FX_DAY · sürüklenme(gün) + FX_HOUR · gün içi(saat)      (|g_c − 1| ≤ A = FX_DAY + FX_HOUR)
   - herkes için aynı ve deterministik (UTC saat ve gün sırasından tohumlu), saatlik yumuşak adımlar; sürüklenme gün içinde
     bir sonraki günün değerine doğru saat saat kayar (gece yarısı sıçrama yok);
   - çapraz kur (a → b) = g_a / g_b: gün içinde ±%1, toplamda ±%3 içinde (para başına ±%0,49 ve ±%0,98).
   SÖMÜRÜLEMEZLİK: bir aktarım en çok (1+A)/(1−A) kez "iyi" zamanlanabilir; maliyeti c = (1 − makas)(1 − komisyon).
   A ≤ (1 − c)/(1 + c) iken (1+A)/(1−A) · c < 1: hangi saatlerde, kaç bacaklı (a→b→…→a) tur atılırsa atılsın her bacak
   zarardır, dolayısıyla gidiş-dönüş < 1. Remote Config bu sınırı aşan bir değer verirse genlik sınırın %98'ine indirilir.
   ========================================================= */
import { CFG, REGIONS, RegionId, CurId, CUR_OF, CUR_SYM, CURS, tryPer, TYPES, TIER_M, TIER_FEE, UP_COST, MAXLV, DMAP, BuildingType, COLS } from '../config';
import { tk, t, units, LANG } from '../i18n';

export { CURS, CUR_OF };
export const CUR_N: Record<CurId, string> = { TRY: tk('Türk lirası'), USD: tk('Dolar'), GBP: tk('Sterlin'), EUR: tk('Euro'), JPY: tk('Yen') };
export const curSym = (c: CurId) => CUR_SYM[c];
/** Cümle içinde para adı (Türkçede küçük harf: "euro ucuz"; diğer dillerde çevirideki gibi). */
export const curWord = (c: CurId) => (LANG === 'tr' ? t(CUR_N[c]).toLocaleLowerCase('tr-TR') : t(CUR_N[c]));
export const regionSym = (r: RegionId) => REGIONS[r].cur;
/** Kur sayısı: büyüklüğe göre hane (₺43,12 · $1.1534 · £0.7519), dilin ondalık ayırıcısıyla. */
export const rnum = (v: number) => (Number.isFinite(v) ? v : 0).toFixed(v >= 10 ? 2 : 4).replace('.', units().dec);
/** "1 $ = ₺43,12"; 1 birim 0,1'den küçükse 100 birim üzerinden ("100 ¥ = $0.6612"). */
export function fxPair(from: CurId, to: CurId, v: number): string { const n = v < 0.1 ? 100 : 1; return `${n} ${CUR_SYM[from]} = ${CUR_SYM[to]}${rnum(v * n)}`; }
/** Piyasa raporundaki kur: oynanan paranın yanına konan başvuru parası (₺ → $, $ → €, diğerleri → $). */
export const refCur = (my: CurId): CurId => (my === 'USD' ? 'EUR' : 'USD');

/* ---------- kur ---------- */
const HOUR = 3600e3;
function h01(s: string): number { // FNV-1a + karıştırma: ardışık saat/gün değerleri ilişkisiz
  let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
const noise = (c: CurId, k: string, n: number) => h01(c + k + n) * 2 - 1; // [-1, 1)
/** Aktarım maliyeti çarpanı (para birimi değişince): hedefe varan / gönderilen (orta kurla). */
export const costMult = (sameCur = false) => (sameCur ? 1 : 1 - clamp01(CFG.BANK_SPREAD)) * (1 - clamp01(CFG.BANK_FEE));
function clamp01(x: number) { return Number.isFinite(x) ? Math.min(0.5, Math.max(0, x)) : 0; }
/** Dalgalanma genlikleri (para başına): Remote Config sömürülebilir bir değer verirse orantılı küçültülür. */
export function amps(): { day: number; hour: number; a: number } {
  let day = Math.max(0, +CFG.FX_DAY || 0), hour = Math.max(0, +CFG.FX_HOUR || 0);
  const c = costMult(), safe = 0.98 * (1 - c) / (1 + c), a = day + hour;
  if (a > safe) { day *= safe / a; hour *= safe / a; }
  return { day, hour, a: day + hour };
}
/** Günlük sürüklenme düğümü ([-1, 1]; önceki iki günle yumuşatılmış). */
const dayNode = (c: CurId, d: number) => 0.5 * noise(c, ':d', d) + 0.3 * noise(c, ':d', d - 1) + 0.2 * noise(c, ':d', d - 2);
/** Saatlik gün içi bileşen ([-1, 1]; önceki üç saatle yumuşatılmış). */
const hourNode = (c: CurId, h: number) => 0.4 * noise(c, ':h', h) + 0.3 * noise(c, ':h', h - 1) + 0.2 * noise(c, ':h', h - 2) + 0.1 * noise(c, ':h', h - 3);
/** Para biriminin iç birim değeri (1 civarında) t anında (saat başında sabit, saatlik adım). */
export function idx(c: CurId, t: number): number {
  const h = Math.floor(t / HOUR), d = Math.floor(h / 24), f = (h - d * 24) / 24, A = amps();
  const drift = dayNode(c, d) * (1 - f) + dayNode(c, d + 1) * f;
  return 1 + A.day * drift + A.hour * hourNode(c, h);
}
/** Gösterilen kur: 1 [from] kaç [to] (taban kur × gün içi oran). */
export const rate = (from: CurId, to: CurId, t: number) => (from === to ? 1 : (tryPer(from) / tryPer(to)) * idx(from, t) / idx(to, t));
/** İç birim oranı: kaynakta 1 iç birim, hedefte kaç iç birim eder (orta kur). */
export const midIn = (from: RegionId, to: RegionId, t: number) => { const a = CUR_OF[from], b = CUR_OF[to]; return a === b ? 1 : idx(a, t) / idx(b, t); };
/** Aktarım teklifi: kaynakta 1 iç birim gönderilince hedefe varan iç birim (makas + komisyon düşülmüş). */
export function quote(from: RegionId, to: RegionId, t: number) {
  const same = CUR_OF[from] === CUR_OF[to], m = midIn(from, to, t);
  return { mid: m, show: rate(CUR_OF[from], CUR_OF[to], t), spread: same ? 0 : clamp01(CFG.BANK_SPREAD), fee: clamp01(CFG.BANK_FEE), net: m * costMult(same) };
}
/** Kur geçmişi: son n saat (saatlik) ya da son n gün (günlük, aynı saatte). */
export function hist(from: CurId, to: CurId, t: number, n: number, stepH: number): number[] {
  const h0 = Math.floor(t / HOUR) * HOUR;
  return Array.from({ length: n }, (_, k) => rate(from, to, h0 - (n - 1 - k) * stepH * HOUR));
}
/** Şimdiki kurun son 7 günün (saatlik) ortalamasına göre farkı (+ = from değerli). Rıfkı'nın notu ve kur satırları için. */
export function vsWeek(from: CurId, to: CurId, t: number): number {
  const v = hist(from, to, t, 7 * 24, 1), avg = v.reduce((s, x) => s + x, 0) / v.length;
  return rate(from, to, t) / avg - 1;
}

/* ---------- banka durumu (kayıtta S.bank) ---------- */
/** Gönderende yoldaki havale. a: hedefe varacak iç birim · s: hedef kayda yazıldığı an · ep: o andaki hedef kaydın kimliği
 *  (hedef sıfırlanırsa havale yeniden eklenmez). */
export interface BankOut { id: string; to: RegionId; a: number; at: number; s?: number; ep?: string }
/** Hareket: a bizim iç birimimizde (giden: gönderilen, gelen: varan), b karşı tarafa varan (yalnız giden). id: gelen havale. */
export interface BankLog { at: number; dir: 'out' | 'in'; r: RegionId; a: number; b: number; id?: string }
/** rate: son taban kira (2x'siz, kayıtla yazılır; diğer bölgeler bu bölgeyi yüklemeden hak ve bilanço hesaplar)
 *  ep: kaydın kimliği (yeni oyunda yenilenir) · in: alınan havale kimlikleri (gönderen başına son BANK_KEEP_IN)
 *  out: yoldaki giden havaleler (emanet dahil) · day: bugünkü hak kullanımı · tip: Rıfkı'nın kur notu günü */
export interface BankState { rate: number; ep: string; in: string[]; out: BankOut[]; day: { k: string; got: number }; log: BankLog[]; tip: string }
export const BANK_KEEP_IN = 20, BANK_LOG = 12;
/** Rastgele kısa kimlik: crypto ile (Math.random dizisini tüketmez; tohumlu simülasyonlar yeni alanla değişmesin). */
export function rid(): string {
  const c: any = (globalThis as any).crypto;
  if (c && c.getRandomValues) { const a = new Uint32Array(2); c.getRandomValues(a); return a[0].toString(36) + a[1].toString(36); }
  return Math.floor(Math.random() * 1e9).toString(36);
}
export const newEp = () => Date.now().toString(36) + rid();
export const newBank = (): BankState => ({ rate: 0, ep: newEp(), in: [], out: [], day: { k: '', got: 0 }, log: [], tip: '' });
/** Havale kimliğinin göndereni (kimlik "bölge-…" biçiminde). */
export const idFrom = (id: string) => id.slice(0, id.indexOf('-'));
/** Alınan kimlikleri gönderen başına son BANK_KEEP_IN ile sınırlar (gönderen onayı en geç bir sonraki aktarımında alır). */
export function trimIn(ids: string[]): string[] {
  const per = new Map<string, number>(), out: string[] = [];
  for (let i = ids.length - 1; i >= 0; i--) { const f = idFrom(ids[i]), n = per.get(f) || 0; if (n < BANK_KEEP_IN) { per.set(f, n + 1); out.push(ids[i]); } }
  return out.reverse();
}

/* ---------- günlük aktarım hakkı (iç birim, alan bölgede) ---------- */
/** Alan bölgenin bugünkü hakkı: max(taban, 30 dk taban kira). save: alanın kaydı (null: başlanmamış → taban = başlangıç sermayesi). */
export function dailyCap(save: any | null): number {
  const r = save && save.bank && Number.isFinite(+save.bank.rate) ? Math.max(0, +save.bank.rate) : 0;
  return Math.max(Math.max(0, +CFG.BANK_FLOOR || 0), Math.max(0, +CFG.BANK_RENT_MIN || 0) * 60 * r);
}
export function usedToday(save: any | null, day: string): number { const d = save && save.bank && save.bank.day; return d && d.k === day ? Math.max(0, +d.got || 0) : 0; }

/* ---------- bilanço: kayıttan değerleme (iç birim) ---------- */
export interface Sheet { cash: number; rent: number; prop: number; debt: number; net: number; own: number; rate: number }
const lotCost = (t: BuildingType, m: number, j: number, lv: number) => {
  let v = TYPES[t].cost * m * Math.pow(1.12, j);
  for (let l = 1; l < lv && l < UP_COST.length; l++) v += TYPES[t].cost * m * UP_COST[l];
  return v;
};
/** Bölge kaydının değeri: kasa, toplanmamış kira, mülkler (tapu bedeli + yapım maliyetinin BANK_VALUE_X'i), kapora borcu.
 *  Projeler: etap bedelleri (projcore.pjCost ile aynı formül). İhale: tarihi yapı ve köşe başı, rakibin beklenen fiyatı
 *  (açılış dakikası × K × son taban kira). Özel yapı: haftanın özel tapusu fiyatı (en az SP_PRICE_MIN, 2 saatlik kira). */
export function valueOf(save: any | null): Sheet | null {
  if (!save || typeof save !== 'object' || !save.city || !Array.isArray(save.own)) return null;
  const rt = save.bank && Number.isFinite(+save.bank.rate) ? Math.max(0, +save.bank.rate) : 0;
  let prop = 0, rent = 0, xc = 0;
  const fees = [CFG.EXTRA_CITY_FEE_1, CFG.EXTRA_CITY_FEE_2, CFG.EXTRA_CITY_FEE_3, CFG.EXTRA_CITY_FEE_4];
  for (const k of save.own as string[]) {
    const d = DMAP[k]; if (!d) continue;
    if (d.idx > 0) prop += TIER_FEE[d.idx];
    else if (d.city !== save.city) { prop += fees[Math.min(3, xc)]; xc++; }
    const m = TIER_M[d.idx], seen: Partial<Record<BuildingType, number>> = {}, lots: any[] = (save.d && save.d[k]) || [];
    for (const p of lots) {
      if (!p || p.ob || !TYPES[p.t as BuildingType]) continue;
      rent += Math.max(0, +p.buf || 0);
      if (p.sp) { prop += Math.max(CFG.SP_PRICE_MIN, rt * 3600 * CFG.SP_PRICE_H); continue; }
      const t = p.t as BuildingType, j = seen[t] || 0; seen[t] = j + 1;
      prop += lotCost(t, m, j, (p.lvl | 0) + (p.up && p.until ? 1 : 0));
    }
    for (const q of (save.pj && Array.isArray(save.pj[k]) ? save.pj[k] : [])) {
      if (!q || !Number.isInteger(q.a)) continue;
      const cells = [q.a, q.a + 1, q.a + COLS, q.a + COLS + 1].map(j => lots[j]).filter(p => p && TYPES[p.t as BuildingType]);
      const base = cells.reduce((s, p) => s + TYPES[p.t as BuildingType].cost * m * UP_COST[MAXLV - 1], 0) * CFG.PJ_COST_PCT / 100;
      const st = (q.st | 0) + (q.until ? 1 : 0); // süren etap da yapılmış sayılır (bedeli ödendi)
      prop += (st >= 1 ? base : 0) + (st >= 2 ? base * CFG.PJ_COST2 : 0);
    }
  }
  const ih = save.ihale || {}, unit = Math.max(50, rt * 60);
  prop += (Array.isArray(ih.got) ? ih.got.length : 0) * unit * CFG.IH_LM_OPEN * CFG.IH_LM_K;
  prop += (Array.isArray(ih.kose) ? ih.kose.length : 0) * unit * CFG.IH_ARSA_OPEN * CFG.IH_ARSA_K;
  prop *= Math.max(0, +CFG.BANK_VALUE_X || 0);
  const debt = Object.values(save.lien || {}).reduce((s: number, v: any) => s + (Number.isFinite(v) && v > 0 ? v : 0), 0) as number;
  const held = ih.cur && !ih.cur.done && Number.isFinite(ih.cur.held) ? Math.max(0, ih.cur.held) : 0; // ihale emaneti: oyuncunun parası
  const cash = Math.max(0, +save.cash || 0) + held;
  return { cash, rent, prop, debt, net: cash + rent + prop - debt, own: save.own.length, rate: rt };
}
