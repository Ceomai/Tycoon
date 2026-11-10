/* =========================================================
   GELİR MODELİ (tasarım M2–M8) — oyun dengesine dokunmaz; yalnızca var olan ödülleri doğru anda sunar.
   - Tapu beklenirken 2x ipucu (harita satırı + Rıfkı Abi)
   - Başlangıç paketi (ilk tapu duvarında bir kez, 48 saat)
   - Emlak Kulübü ayrıcalıkları: her gün 1 adet 2x jetonu, Altın Tapu açık
   ========================================================= */
import { CFG, DMAP, DistrictKey, N, currency } from '../config';
import { t, nm } from '../i18n';
import { S, lotsOf } from '../state';
import { now, producing, rate, totalRate, unlockInfo, buyableDistricts, isFull } from '../economy';
import { dayKey, fmt, clock } from '../format';
import { I } from '../icons';
import { Snd } from '../sound';
import { ui } from '../ui/ctx';
import { openModal, closeModal, toast, bump } from '../ui/modal';
import { ensureSeason } from './fun';
import { persist } from './persist';
import { nextDistrict } from './district';
import { Purchases } from '../services/purchases';
import { Analytics } from '../services/analytics';

export const STARTER_SKIN = 9; // fun.ts › SKIN_COLORS: "Tuğla kırmızısı"

/** En çok kazandıran ve 2x'i açık olmayan bina (tüm semtlerde). */
export function bestBoostLot(): { k: DistrictKey; i: number; r: number } | null {
  const t = now(); let best: { k: DistrictKey; i: number; r: number } | null = null;
  for (const k of S.own) {
    const lots = lotsOf(S, k);
    for (let i = 0; i < N; i++) { const p = lots[i]; if (!producing(p) || (p!.bu || 0) > t) continue; const r = rate(k, i, t); if (!best || r > best.r) best = { k, i, r }; }
  }
  return best;
}
/** Oyuncunun para biriktirdiği tapu: alınabilir ama parası yetmeyen, en ucuz semt. */
export function saveTarget(): { k: DistrictKey; rem: number } | null {
  const nk = nextDistrict(S.cur); // önce bulunduğu ilin sıradaki semti (oyuncunun asıl hedefi)
  if (nk && unlockInfo(nk).ok) { const rem = unlockInfo(nk).fee - S.cash; return rem > 0 ? { k: nk, rem } : null; }
  let out: { k: DistrictKey; rem: number } | null = null;
  for (const k of buyableDistricts()) { const fee = unlockInfo(k).fee, rem = fee - S.cash; if (rem > 0 && (!out || rem < out.rem)) out = { k, rem }; }
  return out;
}
/** 2x (1 saat) bu tapuyu kaç dakika öne çeker? Kira hızı sabit varsayılır. */
export function boostSaving(rem: number): { now: number; saved: number; lot: { k: DistrictKey; i: number; r: number } } | null {
  const lot = bestBoostLot(), R = totalRate(true); if (!lot || R <= 0 || rem <= 0) return null;
  const H = CFG.LOT_BOOST / 1000, t0 = rem / R, R2 = R + lot.r;
  const t1 = rem <= R2 * H ? rem / R2 : H + (rem - R2 * H) / R;
  return { now: t0 / 60, saved: (t0 - t1) / 60, lot };
}

/* ---------- başlangıç paketi ---------- */
export const starterActive = () => !!(S.starter.at && !S.starter.bought && now() < S.starter.at + CFG.STARTER_MS);
export const starterLeft = () => Math.max(0, S.starter.at + CFG.STARTER_MS - now());
const starterCash = () => Math.max(5000, totalRate(false) * CFG.STARTER_CASH_SEC);
/** İlk tapu duvarı: başlangıç semti dolu, sıradaki tapuya para yetmiyor. Oyun döngüsünden (kart sırası boşken) çağrılır. */
export function maybeStarter(): boolean {
  if (S.starter.at || S.starter.bought || S.premium || S.club) return false;
  if (S.own.length !== 1 || !isFull(S.own[0])) return false;
  const tg = saveTarget(); if (!tg) return false;
  S.starter.at = now(); persist(); showStarter(); Analytics.log('starter_shown', {});
  return true;
}
export function showStarter() {
  if (!starterActive()) return;
  const cash = starterCash(), tg = saveTarget();
  openModal(`<div class="card starter"><span class="gseal st">TAPU<br>${t('HEDİYE<br>SETİ')}</span><p class="sec u-m0">${t('Yalnızca bir kez')}</p><h3>${t('Başlangıç paketi')}</h3>
    <p>${tg ? t('{d} tapusuna {amt} kaldı. Bu paketle hemen alırsın.', { d: nm(DMAP[tg.k].n), amt: fmt(tg.rem) }) : t('Hızlı bir başlangıç için.')}</p>
    <ul class="pkit"><li><span class="pk">${currency()}</span><span><b>${t('{amt} nakit', { amt: fmt(cash) })}</b><small>≈ ${t('{h} saatlik kira', { h: Math.round(CFG.STARTER_CASH_SEC / 3600) })}</small></span></li>
      <li><span class="pk">2x</span><span><b>${t('{n} adet 2x jetonu', { n: CFG.STARTER_TOKENS })}</b><small>${t('istediğin binaya, reklamsız 1 sa 2x')}</small></span></li>
      <li><span class="pk"><svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true"><circle cx="11" cy="11" r="10" fill="#d98b6c" stroke="var(--ink)" stroke-width="1.5"/></svg></span><span><b>${t('Tuğla kırmızısı cephe')}</b><small>${t('pakete özel renk')}</small></span></li></ul>
    <div class="pkfoot"><span></span><span class="tm">${t('Bitiş {time}', { time: clock(starterLeft()) })}</span></div>
    <div class="btns"><button class="btn gold" data-a="buy">${t('Satın al · {price}', { price: Purchases.price('baslangic') })}</button><button class="txt" data-a="no" data-back>${t('Belki sonra')}</button></div></div>`,
    a => { closeModal(); if (a === 'buy') buyStarter(); });
}
export function buyStarter() {
  return Purchases.buyProduct('baslangic', () => {
    const cash = starterCash();
    S.starter.bought = true; S.cash += cash; S.tokens += CFG.STARTER_TOKENS;
    if (!S.skinsU.includes(STARTER_SKIN)) S.skinsU.push(STARTER_SKIN);
    bump(); Snd.unlock(); ui.sheetSig = ''; persist();
    toast(t('Başlangıç paketi: {amt} + {n} jeton + cephe', { amt: fmt(cash), n: CFG.STARTER_TOKENS }));
  });
}
/** Jeton paketleri (tüketilen ürün). */
export function buyTokens(n: 5 | 15) {
  return Purchases.buyProduct(n === 5 ? 'jeton5' : 'jeton15', () => { S.tokens += n; ui.sheetSig = ''; persist(); Snd.unlock(); toast(t('{n} adet 2x jetonu eklendi', { n })); });
}

/* ---------- Emlak Kulübü ---------- */
/** Her gün 1 jeton ve Altın Tapu. Oyun döngüsünden birkaç saniyede bir çağrılır. */
export function clubTick() {
  if (!S.club) return;
  const today = dayKey(new Date(now()));
  if (S.clubDay !== today) { S.clubDay = today; S.tokens++; toast(t('Emlak Kulübü: günün 2x jetonu eklendi')); persist(); }
  ensureSeason(); if (!S.season.gold) { S.season.gold = true; ui.sheetSig = ''; persist(); }
}
