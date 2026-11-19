/* =========================================================
   İHALE — arayüz: ödül adı/çizimi/etkisi, Rıfkı'nın tavsiyesi, tanıtım ve sonuç kartları, köşe başı damgası,
   oyun döngüsü bağlantısı ve bildirim metinleri. Kurallar game/auccore.ts'te (saf), panel ui/sheets/ihale.ts'te.
   ========================================================= */
import { CFG, DMAP, CITIES, DistrictKey } from '../config';
import { now } from '../economy';
import { fmt, fmtCost, esc } from '../format';
import { t, tk, nm, pn, pt, pctTxt } from '../i18n';
import { IHALE_LM, lmSvg } from '../landmarks';
import { svg } from '../draw';
import { ui, view } from '../ui/ctx';
import { openModal, closeModal, toast, bigStamp } from '../ui/modal';
import { rivalFace, type RivalMood } from '../ui/rivalFace';
import { rifkiFace, type Mood } from '../ui/rifkiFace';
import { Snd, buzz } from '../sound';
import { persist } from './persist';
import { Funnel } from '../services/funnel';
import { sayTip } from './rifki';
import {
  IH, ihaleTickCore, setProxyCore, placeKoseCore, standing, isLate, advice, rivalById, rivalHere, nextWindow, ARCHE,
  type Auction, type Rival,
} from './auccore';

export * from './auccore';

/* ---------- ad ve görünüm ---------- */
/** Rakibin adı: HTML (h) ya da düz metin. */
export const rvName = (r: Rival, html = true) => (html ? pn(t(r.n)) : pt(t(r.n)));
export const rvOf = (a: Auction) => rivalById(a.rv);
export function prizeName(a: Auction, html = true): string {
  if (a.kind === 'lm') { const l = IHALE_LM.find(x => x.id === a.prize); const n = l ? t(l.n) : a.prize; return html ? pn(n) : pt(n); }
  return t('Köşe başı arsa');
}
/** Köşe başı arsa çizimi: çitle çevrili köşe parseli ve kırmızı bayrak (tema token'lı). */
export const KOSE_ART = '<rect class="sl" x="12" y="44" width="76" height="40"/><path class="rl" style="stroke-width:1;stroke-dasharray:3 2" d="M16 48h68v32H16z"/><path class="pl2" d="M12 84h76v4H12z"/><rect class="pst" x="62" y="20" width="3" height="40"/><path class="sgn" d="M65 20h18l-5 6 5 6H65z"/><path class="tr" d="M22 60a8 8 0 1 1 16 0z"/>';
export const prizeArt = (a: Auction) => svg(a.kind === 'lm' ? lmSvg(a.prize) : KOSE_ART);
export function prizeEffect(a: Auction): string {
  if (a.kind === 'lm') return t('İhale salonuna girer · tüm kiralar kalıcı +{p}', { p: pctTxt(Math.round(CFG.IH_LM_X * 100)) });
  return t('Bir arsana “köşe başı” damgası · o arsanın kirası +{p}', { p: pctTxt(Math.round(CFG.IH_KOSE_X * 100)) });
}
const DAYN = [tk('Pazar'), tk('Pazartesi'), tk('Salı'), tk('Çarşamba'), tk('Perşembe'), tk('Cuma'), tk('Cumartesi')];
export const dayName = (tn: number) => t(DAYN[new Date(tn).getDay()]);
export const hh = (h: number) => `${String(Math.floor(h)).padStart(2, '0')}:00`;
/** Rakibin ifadesi panelde: öndeyse kendinden emin, sen öndeysen hamle (son düzlükte kızgın). */
export const rvMood = (a: Auction, tn: number): RivalMood => { const st = standing(a, tn); return st.lead === 'me' ? (isLate(a, tn) ? 'mad' : 'bid') : isLate(a, tn) ? 'bid' : 'smug'; };

/* ---------- Rıfkı Abi ---------- */
export function rifkiLine(a: Auction, tn: number): { mood: Mood; text: string } {
  const r = rvOf(a), name = rvName(r), st = standing(a, tn);
  if (st.lead === 'me' && a.my >= a.capHi + a.step) return { mood: 'party', text: t('Vekâletiniz {r} için fazlasıyla yeter. Arkanıza yaslanın efendim; ödeyeceğiniz onun tavanının bir adım fazlası.', { r: name }) };
  if (isLate(a, tn)) return { mood: 'warn', text: t('Son düzlük! {r} artık tavanına kadar çıkıyor. Vekâletiniz {x} altındaysa risktesiniz.', { r: name, x: fmtCost(a.capHi) }) };
  if (st.lead === 'me') return { mood: 'think', text: t('Şimdilik öndesiniz efendim, ama {r} son iki saatte {a}–{b} arasına çıkar. Vekâleti {c} yaparsanız içiniz rahat eder.', { r: name, a: fmtCost(a.capLo), b: fmtCost(a.capHi), c: fmtCost(advice(a)) }) };
  const m = IH().rm[a.rv] || 0;
  const mood = m > 0 ? t('Geçen sefer kaybetti, bu hafta hırslı.') : m < 0 ? t('Geçen sefer kazandı, kasası biraz boşaldı.') : '';
  return { mood: 'think', text: t('{r} böyle bir tapuya {a}–{b} arası verir. {m} Vekâleti {c} verin; ödeyeceğiniz yine onun tavanının bir adım üstü olur.', { r: name, a: fmtCost(a.capLo), b: fmtCost(a.capHi), m: mood, c: fmtCost(advice(a)) }).replace('  ', ' ') };
}
/** Takvim cümlesi (CFG'den). */
export const calText = () => t('{d1} tarihi yapı, {d2} nadir arsa · {a}–{b}', { d1: t(DAYN[((CFG.IH_LM_DAY % 7) + 7) % 7]), d2: t(DAYN[((CFG.IH_ARSA_DAY % 7) + 7) % 7]), a: hh(CFG.IH_OPEN_H), b: hh(CFG.IH_CLOSE_H) });

/* ---------- kartlar ---------- */
const face = (html: string, cls = '') => `<div class="ih-face${cls}">${html}</div>`;
/** İlk ihale: Rıfkı Abi rakibi tanıtır (tek seferlik). */
export function showIntro(onGo: () => void) {
  const a = IH().cur, r = a ? rvOf(a) : rivalHere(), name = rvName(r);
  openModal(`<div class="card ih-card"><div class="ih-duo">${face(rifkiFace('think'))}<span class="ih-vs">VS</span>${face(rivalFace(r.id, 'smug'), ' rv')}</div>
    <h3>${t('Rakip emlakçı: {r}', { r: name })}</h3>
    <div class="ih-say"><b>${t('RIFKI ABİ')}</b><span>${t('Efendim, bu {r}: {tag}. Her şehrin bir emlakçısı var, haftada iki kez değerli tapular için ihaleye çıkarlar. Hesabını bilirler; tavanlarının üstüne çıkmazlar.', { r: name, tag: t(r.tag) })}</span></div>
    <ul class="ih-rules"><li>${calText()}</li><li>${t('Vekâlet verirsin, oyun senin yerine adım adım artırır; kazanırsan rakibin sınırının bir adım üstünü ödersin')}</li><li>${t('Yalnızca önde olduğun fiyat kasadan ayrılır; geçilirsen ya da kaybedersen paran geri gelir')}</li></ul>
    <div class="btns"><button class="btn" data-a="go">${t('İhaleye bak')}</button><button class="txt" data-a="later" data-back>${t('Sonra')}</button></div></div>`,
  act => { closeModal(); IH().intro = true; persist(); if (act === 'go') onGo(); });
}
/** İhale hapına / menü satırına dokunuş: ilk seferde tanıtım, sonra panel. */
export function openIhale() { if (!IH().intro) showIntro(() => view.openSheet({ k: 'ihale' })); else view.openSheet({ k: 'ihale' }); }

/** Sonuç anı: kazandın / kaybettin. */
export function showResult(a: Auction) {
  a.seen = true; persist();
  const r = rvOf(a), name = rvName(r), won = a.done === 'won', line = ARCHE_LINES[r.a];
  const body = won
    ? `<div class="ih-hero bpbg">${prizeArt(a)}<span class="ih-sold">${t('SATILDI')}</span></div>
       <h3>${t('{p} senin!', { p: prizeName(a) })}</h3>
       <p>${prizeEffect(a)}. ${t('{x} ödedin: rakibin tavanının tam bir adım üstü. Vekâletinin kalanı kasandan hiç çıkmadı.', { x: fmt(a.paid || 0) })}</p>`
    : `<div class="ih-hero bpbg lost">${prizeArt(a)}<span class="ih-sold rv">${t('{r} ALDI', { r: name })}</span></div>
       <h3>${t('Bu sefer {r} kaptı', { r: name })}</h3>
       <p>${t('{p}, {x} ile {r} adına gitti. Önde olduğun sürece emanette duran para, geçildiğin an kasana döndü; hiçbir şey kaybetmedin.', { p: prizeName(a), x: fmt(a.paid || a.start), r: name })}</p>`;
  const btn = won ? (a.kind === 'lm' ? t('İhale salonuna koy') : t('Arsayı seç')) : t('Tamam');
  openModal(`<div class="card ih-card ih-res ${won ? 'won' : 'lost'}">${body}
    <div class="ih-quote">${face(rivalFace(r.id, won ? 'mad' : 'smug'), ' rv sm')}<div class="ih-say rv"><b>${name}</b><span>${t(won ? line.lose : line.win)}</span></div></div>
    ${won ? '' : `<div class="ih-quote">${face(rifkiFace('happy'), ' sm')}<div class="ih-say"><b>${t('RIFKI ABİ')}</b><span>${t('Kaybetmek yok efendim, paranız yerinde. Rakip bu sefer kazandığı için bir dahakine kasası biraz boş olacak.')}</span></div></div>`}
    <div class="btns"><button class="btn" data-a="ok" data-back>${btn}</button></div></div>`,
  () => { closeModal(); if (won && a.kind === 'arsa' && IH().kp > 0) view.openSheet({ k: 'kose' }); else if (won) view.openSheet({ k: 'coll' }); view.render(); });
  if (won) { Snd.unlock(); buzz.success(); }
}
/** Rakibin sonuç cümlesi (arketipe göre; rakip konuşur). win: rakip kazandı. */
export const ARCHE_LINES: Record<keyof typeof ARCHE, { win: string; lose: string }> = {
  temkinli: { win: tk('Hesap kitap işi bu. Bir dahaki sefere, komşu.'), lose: tk('Rakamlar sizden yanaydı. Tebrik ederim, hakkınızdır.') },
  atak: { win: tk('Hızlı olan kazanır! Bir dahakine erken kalk.'), lose: tk('Bu sefer sen hızlıydın. Rövanşı alacağım!') },
  koleksiyoncu: { win: tk('Bu güzellik benim koleksiyonuma yakıştı. Üzülme evlat.'), lose: tk('Ah, o yapıya çok göz koymuştum… İyi bakın ona.') },
  pazarlikci: { win: tk('Pazarlık bitti, el sıkıştık. Bir dahakine yine gel!'), lose: tk('İyi pazarlık ettin, hakkını veririm. Bir dahakine kolay kolay bırakmam!') },
};

/* ---------- eylemler ---------- */
/** Vekâlet ver / yükselt (panel düğmesi). */
export function setProxy(a: Auction, max: number, tn = now()): boolean {
  const e = setProxyCore(a, max, tn);
  if (e === 'cash') { toast(t('Kasada yeterli para yok')); return false; }
  if (e) return false;
  const st = standing(a, tn);
  Funnel.ihale('proxy', a, { lead: st.lead }, tn);
  if (st.lead === 'me') { Snd.collect(2); buzz.light(); } else buzz.light();
  persist(); ui.sheetSig = ''; view.render();
  return true;
}
/** Köşe başı damgasını arsaya vur. */
export function placeKose(k: DistrictKey, i: number): boolean {
  if (!placeKoseCore(k, i)) return false;
  Funnel.ihale('kose', null, { district: k });
  persist(); ui.tileSig = []; ui.sheetSig = ''; Snd.unlock(); buzz.success();
  bigStamp(t('KÖŞE BAŞI'), t('KİRA +{p}', { p: pctTxt(Math.round(CFG.IH_KOSE_X * 100)) }));
  view.render();
  return true;
}

/* ---------- oyun döngüsü ---------- */
/** Oyun döngüsünden (4 Hz). Sonuç kartı oyun serbestken (ya da ihale paneli açıkken) açılır; katılmayana kart yok. */
export function ihaleTick(tn: number) {
  const ev = ihaleTickCore(tn);
  const a = IH().cur;
  if (ev.created) { ui.sheetSig = ''; Funnel.ihale('open', ev.created, {}, tn); }
  if (ev.cut) sayTip({ id: 'ihcut', text: t('Efendim, kasa vekâleti karşılamadı; vekâletiniz {x} oldu. Biraz para birikince yükseltebilirsiniz.', { x: fmtCost(ev.cut.my) }), go: { k: 'ihale' } });
  if (ev.late) Funnel.ihale('passed', ev.late, {}, tn);
  if (ev.late) sayTip({ id: 'ihlate', text: t('Son düzlük! {r} sizi geçti: {p}. Vekâleti yükseltmek isterseniz bakalım.', { r: rvName(rvOf(ev.late)), p: prizeName(ev.late) }), go: { k: 'ihale' } });
  if (ev.resolved) { ui.sheetSig = ''; persist(); Funnel.ihale('close', ev.resolved, {}, tn); }
  if (a && a.done && !a.seen) {
    if (tn - a.close > CFG.IH_SHOW_MS) { a.seen = true; return; } // çok eski sonuç: kart yok (ödül zaten verildi)
    if (!ui.modal && !ui.ad && (!ui.sheet || ui.sheet.k === 'ihale')) showResult(a);
  }
}
/** Rıfkı'nın ihale ipucu (ihale başına en çok bir kez; rifki.ts tips() çağırır). */
export function ihaleTip(): { id: string; text: string; go: { k: 'ihale' } } | null {
  const a = IH().cur, tn = now();
  if (!a || a.done || a.tip || a.my > 0 || tn >= a.close) return null;
  const r = rvOf(a);
  return { id: 'ihale', text: t('Bugün ihale var efendim: {p}. {r} de gözünü dikmiş; bir vekâlet verelim mi?', { p: prizeName(a), r: rvName(r) }), go: { k: 'ihale' } };
}
/** Bildirim metinleri (services/notify.ts). */
export function ihaleNoteText(a: Auction, kind: 'passed' | 'won' | 'lost'): { title: string; body: string } {
  const r = rvName(rvOf(a), false), p = prizeName(a, false);
  if (kind === 'passed') return { title: t('{r} seni geçti', { r }), body: t('İhale: {p}. Son düzlük başladı, {n} saat kaldı.', { p, n: Math.round(CFG.IH_LATE_MS / 3600e3) }) };
  if (kind === 'won') return { title: t('İhaleyi kazandın'), body: t('{p} senin! Ödülünü yerine koymaya gel.', { p }) };
  return { title: t('İhale sonuçlandı'), body: t('{p}, {r} adına gitti. Paran kasanda.', { p, r }) };
}
/** Boş panel metni: sıradaki ihale. */
export function nextText(tn: number): string {
  const w = nextWindow(tn); if (!w) return '';
  return t('Sıradaki ihale: {d} {h}', { d: dayName(w.open), h: hh(CFG.IH_OPEN_H) });
}
/** Şehir · semt etiketi (köşe başı seçimi). */
export const placeName = (k: DistrictKey) => `${nm(CITIES[DMAP[k].city].n)} · ${nm(DMAP[k].n)}`;
export { esc };
