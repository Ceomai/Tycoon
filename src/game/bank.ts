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
   çoğalmaz; (1)'de kalan havale bir sonraki açılışta teslim edilir.
   Başlanmamış bölgeye havale: alan kayıt olmadığı için EMANET olarak gönderende bekler; bölge açılıp şehir seçilince
   claimIn ile başlangıç sermayesi olarak kasaya geçer.
   Aktarılan para kazanç DEĞİLDİR: addCash kullanılmaz (earned, haftalık lig, görev, holding hissesi, bina kilitleri değişmez).
   ========================================================= */
import { CFG, REGION, REGION_ORDER, RegionId, CUR_OF } from '../config';
import { S } from '../state';
import { now } from '../economy';
import { dayKey } from '../format';
import { readRegionSave, cachedRegionSave, writeRegionSave, flushSaves, validSave, saveKeyOf, parseSave } from '../storage';
import { persist, persistNow } from './persist';
import { BankOut, BankState, rid, dailyCap, usedToday, quote, newBank, vsWeek, trimIn, BANK_LOG } from './bankcore';
import { REGION_INFO } from '../storage';

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
function pendingTo(to: RegionId): number {
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

export type TransferResult = { ok: true; got: number; held: boolean } | { ok: false; why: 'closed' | 'same' | 'cash' | 'cap' };
/** Aktarım: amt kaynak iç biriminde. */
export async function transfer(to: RegionId, amt: number): Promise<TransferResult> {
  if (!bankOpen()) return { ok: false, why: 'closed' };
  if (to === REGION || !REGION_ORDER.includes(to)) return { ok: false, why: 'same' };
  amt = Math.floor(amt);
  if (!(amt > 0) || amt > S.cash * CFG.BANK_SRC_SHARE + 1e-9) return { ok: false, why: 'cash' };
  await loadAll(true);
  const tn = now(), q = quote(REGION, to, tn), got = Math.floor(amt * q.net);
  if (!(got >= 1) || got > capLeft(to).left + 1e-6) return { ok: false, why: 'cap' };
  const o: BankOut = { id: newId(), to, a: got, at: tn }, b = bank();
  S.cash -= amt; b.out.push(o);
  b.log.unshift({ at: tn, dir: 'out', r: to, a: amt, b: got }); if (b.log.length > BANK_LOG) b.log.length = BANK_LOG;
  await persistNow();                                    // (1) gönderen: kasadan düştü + yolda
  const held = !(await deliverOut());                    // (2) + (3)
  return { ok: true, got, held };
}
/** Gönderenin yoldaki havalelerini teslim eder. Başlanmamış bölgeye emanet kalmadıysa true. */
export async function deliverOut(): Promise<boolean> {
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
    await writeRegionSave(o.to, tv);                     // (2) alan
    REG.saves[o.to] = tv; REG.at = Date.now();
    keep.push({ ...o, s: now(), ep: tb.ep }); changed = true; // (3) onay bekler: sonraki teslimde kimlik görülünce silinir
  }
  b.out = keep; if (changed) persist();
  return all;
}
/** Açılışta / şehir seçilince: diğer bölgelerin bu bölgeye bıraktığı, henüz hiçbir kayda yazılmamış havaleleri (emanet) alır.
 *  Önce bu kayıt yazılır (kimlik bizde), sonra gönderenin kaydında havale teslim edilmiş olarak işaretlenir (s, ep): bu bölge
 *  sonradan sıfırlanırsa emanet yeni oyuna ikinci kez gelmez. Arada kesilirse gönderen kimliği bizde görür ve siler. */
export async function claimIn(): Promise<number> {
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
  await persistNow();                                    // alınanlar bizim kayıtta
  for (const [r, v] of senders) {
    for (const o of v.bank.out) if (o && o.to === REGION && !o.s && b.in.includes(o.id)) { o.s = now(); o.ep = b.ep; }
    await flushSaves(); await writeRegionSave(r, v);
  }
  return sum;
}
/** Açılış: önce gelen emanetler, sonra yoldaki gidenler. Dönen: alınan emanet (iç birim). */
export async function bankBoot(): Promise<number> { const got = await claimIn(); await deliverOut(); return got; }

/** Web'de çok sekme: bu bölge başka bir sekmede açıkken bir havale kayda yazılırsa (storage olayı), yazılan kayıttaki yeni
 *  havaleler bu sekmenin canlı durumuna da eklenir (bu sekme eski durumla üstüne yazınca havale kaybolmasın). Dönen: eklenen. */
export function mergeForeign(raw: unknown): number {
  const v: any = raw; if (!S || !S.city || !v || !v.bank || !Array.isArray(v.bank.log)) return 0;
  const b = bank(); if (v.bank.ep && b.ep && v.bank.ep !== b.ep) return 0; // başka oyun (sıfırlanmış kayıt)
  let sum = 0;
  for (const l of v.bank.log) {
    if (!l || l.dir !== 'in' || typeof l.id !== 'string' || b.in.includes(l.id) || !(+l.a > 0) || !Number.isFinite(+l.a)) continue;
    if (!Array.isArray(v.bank.in) || !v.bank.in.includes(l.id)) continue;
    const d = today(); if (b.day.k !== d) b.day = { k: d, got: 0 };
    S.cash += +l.a; b.day.got += +l.a; b.in.push(l.id); sum += +l.a; logIn(b, { ...l });
  }
  if (sum) { b.in = trimIn(b.in); persist(); }
  return sum;
}
let watching = false;
/** Çok sekme dinleyicisi (yalnız web; telefonda tek oturum). onGot: eklenen tutarla (bildirim için). */
export function watchTabs(onGot: (a: number) => void) {
  if (watching || typeof window === 'undefined') return; watching = true;
  window.addEventListener('storage', e => { if (e.key !== saveKeyOf(REGION) || !e.newValue) return; const got = mergeForeign(parseSave(e.newValue)); if (got) onGot(got); });
}

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
