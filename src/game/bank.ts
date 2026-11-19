/* =========================================================
   BANKA — bölgeler arası para aktarımı (çift kayıt defteri), emanet ve bilanço verisi. Hesaplar bankcore.ts'te.
   Tüm tutarlar iç birimde; gösterim bölgenin ölçeğiyle (format.ts fmtIn).
   Güvenlik (kayıt kuyruğu ile):
     1) Gönderen: kasadan düşer, havale "yolda" (S.bank.out) yazılır → persistNow (tek atomik yazma).
     2) Alan: kaydı okunur; havale kimliği alanın bank.in listesinde yoksa kasaya eklenir, kimlik listeye ve bugünkü hakka
        yazılır → kendi kuyruğumuz boşalınca (flushSaves) writeRegionSave (bölge önbelleği de güncellenir).
     3) Onay: havale gönderende s (yazıldığı an) ve ep (alan kaydın kimliği) ile kalır. Sonraki teslimde (açılış ya da yeni
        aktarım) alan kimliği gösteriyorsa silinir; göstermiyorsa ve kayıt aynı oyunsa (ep aynı: ör. web'de başka sekmede açık
        kalan eski durum üstüne yazdı) yeniden eklenir; kayıt sıfırlanmışsa (ep farklı) para o oyuna gitmişti, eklenmez.
   Bulut paketi tüm bölgelerin anlık görüntüsü: paket ya (hiçbiri), ya (1) ya (1+2) durumunu taşır → hiçbir sırada para
   çoğalmaz; (1)'de kalan havale bir sonraki açılışta teslim edilir. Pakette olmayan bölgelerle uzlaştırma: bankcore reconcileBundle.
   Web'de oyun aynı anda tek sekmede çalışır (tabs.ts): başka sekmenin eski durumu kaydın üstüne yazamaz.
   Başlanmamış bölgeye havale: alan kayıt olmadığı için EMANET olarak gönderende bekler; bölge açılıp şehir seçilince
   claimIn ile başlangıç sermayesi olarak kasaya geçer.
   Aktarılan para kazanç DEĞİLDİR: addCash kullanılmaz (earned, haftalık lig, görev, holding hissesi, bina kilitleri değişmez).
   ========================================================= */
import { CFG, REGION, REGION_ORDER, RegionId, CUR_OF } from '../config';
import { S } from '../state';
import { now } from '../economy';
import { dayKey } from '../format';
import { readRegionSave, cachedRegionSave, writeRegionSave, flushSaves, validSave, onSaveBarrier } from '../storage';
import { persist, persistNow } from './persist';
import { BankOut, BankState, rid, dailyCap, usedToday, quote, newBank, vsWeek, trimIn, BANK_LOG, BANK_OUT_MAX } from './bankcore';
import { REGION_INFO } from '../storage';
import { Funnel, magB } from '../services/funnel';

export const today = () => dayKey(new Date(now()));
const bank = (): BankState => (S.bank || (S.bank = newBank()));
const newId = () => REGION + '-' + Date.now().toString(36) + '-' + rid();
const logIn = (b: BankState, e: BankState['log'][number]) => { b.log.unshift(e); if (b.log.length > BANK_LOG) b.log.length = BANK_LOG; };

/** Diğer bölgelerin kayıtları (panel açılınca okunur; panel bu önbellekten çizer). null: başlanmamış. */
export const REG: { saves: Partial<Record<RegionId, any | null>>; at: number } = { saves: {}, at: 0 };
export async function loadAll(fresh = false) {
  for (const r of REGION_ORDER) { const v: any = r === REGION ? S : fresh ? await readRegionSave(r) : await cachedRegionSave(r); REG.saves[r] = validSave(v) && v.city ? v : null; }
  REG.at = Date.now();
}
const saveOf = (r: RegionId): any | null => (r === REGION ? S : REG.saves[r] || null);
/** Başlanmamış alana bekleyen emanetler (tüm bölgelerin gönderen kayıtlarından). */
export function pendingTo(to: RegionId): number {
  let s = 0;
  for (const r of REGION_ORDER) { const v: any = saveOf(r); const out = v && v.bank && Array.isArray(v.bank.out) ? v.bank.out : []; for (const o of out) if (o && o.to === to && !o.s) s += +o.a || 0; }
  return s;
}
/** Alanın bugün kalan hakkı (iç birim). */
export function capLeft(to: RegionId): { cap: number; used: number; left: number } {
  const sv = saveOf(to), d = today();
  const cap = dailyCap(sv), used = usedToday(sv, d) + (sv ? 0 : pendingTo(to));
  return { cap, used, left: Math.max(0, cap - used) };
}
/** Banka hesabı açık mı: 2. semt ya da BANK_OPEN_EARN kazanç (ilk semt dolmaya yakın). */
export const bankOpen = () => !!S.city && (S.own.length >= Math.max(1, Math.round(CFG.BANK_OPEN_OWN)) || S.earned >= CFG.BANK_OPEN_EARN);
/** Bu aktarımda gönderilebilecek en çok (kaynak iç birim): hak ya da kasanın en çok BANK_SRC_SHARE'i. */
export function maxSend(to: RegionId, t = now()): number {
  const q = quote(REGION, to, t), left = capLeft(to).left;
  return Math.max(0, Math.min(S.cash * CFG.BANK_SRC_SHARE, q.net > 0 ? left / q.net : 0));
}

/* ---------- banka kuyruğu ----------
   Aktarım, teslim ve emanet alma diğer bölgelerin kayıtlarını oku-değiştir-yaz ile günceller: aynı anda iki iş (ör. açılış
   teslimi sürerken aktarım) aynı kaydı eski haliyle ezmesin diye işler tek sırada çalışır. Bulut kaydı yükleme ve hesap silme
   kayıtları kilitledikten sonra sıradaki işlerin bitmesini bekler (storage.ts saveBarrier); kilitliyken iş yazamaz. */
let queue: Promise<unknown> = Promise.resolve();
function serial<T>(f: () => Promise<T>): Promise<T> { const r = queue.then(f, f); queue = r.catch(() => {}); return r; }
/** Sıradaki ve süren banka işleri bitene kadar bekler. */
export async function bankIdle(): Promise<void> { let tail: Promise<unknown>; do { tail = queue; await tail; } while (tail !== queue); }
onSaveBarrier(bankIdle);
export { BANK_OUT_MAX };

export type TransferResult = { ok: true; got: number; held: boolean } | { ok: false; why: 'closed' | 'same' | 'cash' | 'cap' | 'busy' | 'save' };
/** Aktarım: amt kaynak iç biriminde. busy: yoldaki havale sınırı dolu · save: gönderen kaydı yazılamadı (para geri). */
export function transfer(to: RegionId, amt: number): Promise<TransferResult> { const c0 = S.cash; return serial(() => transferNow(to, amt)).then(r => { Funnel.bankSend(to, amt, r, capLeft(to), c0); return r; }); }
async function transferNow(to: RegionId, amt: number): Promise<TransferResult> {
  if (!bankOpen()) return { ok: false, why: 'closed' };
  if (to === REGION || !REGION_ORDER.includes(to)) return { ok: false, why: 'same' };
  amt = Math.floor(amt);
  if (!(amt > 0) || amt > S.cash * CFG.BANK_SRC_SHARE + 1e-9) return { ok: false, why: 'cash' };
  await loadAll(true);
  const tn = now(), q = quote(REGION, to, tn), got = Math.floor(amt * q.net);
  if (!(got >= 1) || got > capLeft(to).left + 1e-6) return { ok: false, why: 'cap' };
  const b = bank();
  // başlanmamış bölgeye giden emanet: bekleyen emanetle tek kayıtta birleşir (alan kayıt yok: kimliği kimse almadı)
  let o: BankOut | undefined = REG.saves[to] ? undefined : b.out.find(x => x.to === to && !x.s);
  if (!o && b.out.length >= BANK_OUT_MAX) { await deliverNow(); if (b.out.length >= BANK_OUT_MAX) return { ok: false, why: 'busy' }; }
  const merged = !!o, prevA = o ? o.a : 0;
  if (o) o.a += got; else { o = { id: newId(), to, a: got, at: tn }; b.out.push(o); }
  const entry = { at: tn, dir: 'out' as const, r: to, a: amt, b: got, id: o.id };
  S.cash -= amt; b.log.unshift(entry); if (b.log.length > BANK_LOG) b.log.length = BANK_LOG;
  if (!(await persistNow())) {                           // (1) yazılamadı: teslim yok, aktarım geri alınır
    S.cash += amt; if (merged) o.a = prevA; else b.out = b.out.filter(x => x !== o);
    b.log = b.log.filter(l => l !== entry);
    return { ok: false, why: 'save' };
  }
  await deliverNow();                                    // (2) + (3)
  const id = o.id, held = !b.out.some(x => x.id === id && x.s); // bu havale alan kayda yazılmadıysa (emanet ya da yolda) bekliyor
  return { ok: true, got, held };
}
/** Gönderenin yoldaki havalelerini teslim eder. Başlanmamış bölgeye emanet kalmadıysa true. */
export function deliverOut(): Promise<boolean> { return serial(deliverNow); }
async function deliverNow(): Promise<boolean> {
  const b = bank(); if (!b.out.length) return true;
  let all = true, changed = false; const keep: BankOut[] = [];
  for (const o of b.out) {
    const tv: any = await readRegionSave(o.to);
    if (!validSave(tv) || !tv.city) {                    // emanet: bölge açılınca claimIn alır
      if (o.s) { changed = true; continue; }             // teslim edilmiş kayıt silinmiş (bölge sıfırlandı): para o oyuna gitmişti
      keep.push(o); all = false; continue;
    }
    const tb = tv.bank && typeof tv.bank === 'object' ? tv.bank : (tv.bank = newBank());
    tb.in = Array.isArray(tb.in) ? tb.in : [];
    if (tb.in.includes(o.id)) { changed = true; continue; } // alan kimliği gösteriyor: onaylı, silinir
    if (o.s && o.ep && tb.ep !== o.ep) { changed = true; continue; } // alan kayıt sıfırlanmış: yeniden eklenmez
    if (typeof tb.ep !== 'string' || !tb.ep) tb.ep = newBank().ep;
    const d = today(), day = tb.day && tb.day.k === d ? tb.day : { k: d, got: 0 };
    tv.cash = (+tv.cash || 0) + o.a; tb.in = trimIn([...tb.in, o.id]);
    tb.day = { k: d, got: (+day.got || 0) + o.a };
    tb.log = [{ at: o.at, dir: 'in', r: REGION, a: o.a, b: 0, id: o.id }, ...(Array.isArray(tb.log) ? tb.log : [])].slice(0, BANK_LOG);
    await flushSaves();                                  // kendi kaydımızın kuyruğu boşalsın (aynı depolamaya sırayla)
    if (!(await writeRegionSave(o.to, tv))) { keep.push(o); all = false; continue; } // (2) alan yazılamadı (kilit/depolama): yolda kalır
    REG.saves[o.to] = tv; REG.at = Date.now();
    keep.push({ ...o, s: now(), ep: tb.ep }); changed = true; // (3) onay bekler: sonraki teslimde kimlik görülünce silinir
  }
  b.out = keep; if (changed) persist();
  return all;
}
/** Açılışta / şehir seçilince: diğer bölgelerin bu bölgeye bıraktığı, henüz hiçbir kayda yazılmamış havaleleri (emanet) alır.
 *  Önce bu kayıt yazılır (kimlik bizde), sonra gönderenin kaydında havale teslim edilmiş olarak işaretlenir (s, ep): bu bölge
 *  sonradan sıfırlanırsa emanet yeni oyuna ikinci kez gelmez. Arada kesilirse gönderen kimliği bizde görür ve siler.
 *  Bu kayıt yazılamazsa (kilit, depolama) gönderende işaretlenmez: emanet sonraki açılışta yeniden alınır. */
export function claimIn(): Promise<number> { return serial(claimNow); }
async function claimNow(): Promise<number> {
  if (!S.city) return 0;
  const b = bank(); let sum = 0; const senders: [RegionId, any][] = [];
  for (const r of REGION_ORDER) {
    if (r === REGION) continue;
    const v: any = await readRegionSave(r); const out = v && v.bank && Array.isArray(v.bank.out) ? v.bank.out : [];
    let mine = false;
    for (const o of out) {
      if (!o || o.to !== REGION || o.s || typeof o.id !== 'string' || !(+o.a > 0) || !Number.isFinite(+o.a)) continue;
      mine = true; if (b.in.includes(o.id)) continue;
      const d = today(); if (b.day.k !== d) b.day = { k: d, got: 0 };
      S.cash += +o.a; b.day.got += +o.a; b.in.push(o.id); sum += +o.a;
      logIn(b, { at: +o.at || now(), dir: 'in', r, a: +o.a, b: 0, id: o.id });
    }
    if (mine) senders.push([r, v]);
  }
  if (!senders.length) return 0;
  b.in = trimIn(b.in);
  if (!(await persistNow())) return sum;                 // alınanlar bizim kayda yazılamadı: gönderende işaretlenmez
  for (const [r, v] of senders) {
    for (const o of v.bank.out) if (o && o.to === REGION && !o.s && b.in.includes(o.id)) { o.s = now(); o.ep = b.ep; }
    await flushSaves(); await writeRegionSave(r, v);
  }
  return sum;
}
/** Yeni oyun (bölge sıfırlanırken): eski kaydın yoldaki (alan kayda yazılmamış) havaleleri yeni duruma taşınır — para kaybolmaz.
 *  Teslim edilmiş (onay bekleyen) havaleler taşınmaz: para alana geçmişti. */
export function carryOut(old: any): BankOut[] {
  const out = old && old.bank && Array.isArray(old.bank.out) ? old.bank.out : [];
  return out.filter((o: any) => o && typeof o.id === 'string' && REGION_ORDER.includes(o.to) && typeof o.s !== 'number' && Number.isFinite(+o.a) && +o.a > 0)
    .map((o: any) => ({ id: o.id, to: o.to, a: +o.a, at: Number.isFinite(+o.at) ? +o.at : 0 }));
}
/** Açılış: önce gelen emanetler, sonra yoldaki gidenler. Dönen: alınan emanet (iç birim). */
export function bankBoot(): Promise<number> { return serial(async () => { const got = await claimNow(); await deliverNow(); if (got > 0) Funnel.bank('claim', { amt_e: magB(got) }); return got; }); }

/** Başka bir (başlanmış) bölgenin parası şimdi, oynanan paraya göre 7 günlük ortalamasından en az BANK_TIP_PCT ucuzsa: o bölge.
 *  started: yalnız başlanmış bölgeler (REGION_INFO ya da panelin okuduğu kayıtlar). Rıfkı'nın kur notu için. */
export function cheapCur(started = true, t = now()): { r: RegionId; v: number } | null {
  const my = CUR_OF[REGION]; let best: { r: RegionId; v: number } | null = null;
  for (const r of REGION_ORDER) {
    if (r === REGION || CUR_OF[r] === my || (started && !REGION_INFO[r] && !REG.saves[r])) continue;
    const v = vsWeek(CUR_OF[r], my, t); if (v <= -CFG.BANK_TIP_PCT && (!best || v < best.v)) best = { r, v };
  }
  return best;
}
