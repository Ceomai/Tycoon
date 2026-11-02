/* =========================================================
   KEYİF PAKETİ — piyasa kartı, tapu arşivi, belediye kartı, cephe, tapu sezonu
   ========================================================= */
import { DMAP, ORDER, TYPES, LEAGUE_TOP, DistrictKey, BuildingType, N, CFG } from '../config';
import { S, lotsOf } from '../state';
import { fmt, weekKey } from '../format';
import { now, totalRate, filled, curWeek, isFull, producing } from '../economy';
import { LM } from '../landmarks';
import { Snd, buzz } from '../sound';
import { ui } from '../ui/ctx';
import { openModal, closeModal, toast, bump } from '../ui/modal';
import { marketOf, MARKET_UP, MARKET_DOWN, CIVIC, CIVIC_X, civicOpt } from './modifiers';
import { addCash } from './actions';
import { persist } from './persist';
import { Analytics } from '../services/analytics';
import { SPECIALS } from '../specials';
import { t, tk, nm, upper, pctTxt } from '../i18n';

/* ---------- 2 · piyasa raporu kartı ---------- */
export function showMarket() {
  const wk = curWeek(), m = marketOf(wk);
  S.market = wk; persist();
  const rows = ORDER.map(ty => { const v = ty === m.up ? MARKET_UP : ty === m.down ? -MARKET_DOWN : 0; return `<div class="mkr"><b>${t(TYPES[ty].n)}</b><span class="mkb"><i></i><u class="${v > 0 ? 'up' : v < 0 ? 'dn' : ''}" style="width:${Math.abs(v) * 140}%"></u></span><em class="${v > 0 ? 'up' : v < 0 ? 'dn' : ''}">${v > 0 ? '+' : v < 0 ? '−' : ''}${pctTxt(Math.round(Math.abs(v) * 100))}</em></div>`; }).join('');
  openModal(`<div class="card mkcard"><p class="sec" style="margin:0 0 4px">${t('Emlak piyasası · {n}. hafta', { n: m.n })}</p><h3>${t(m.head)}</h3><p>${t(m.why)}</p>
    <div class="mkrows">${rows}</div><p class="note">${t('Her pazartesi yeni rapor; herkes için aynı, haftalık ligde de geçerli.')}</p>
    <div class="btns"><button class="btn" data-a="ok">${t('Anladım, yatırım zamanı')}</button></div></div>`, () => closeModal());
}
export const marketChip = () => { const m = marketOf(curWeek()); return `${upper(t(TYPES[m.up].n))} ↑`; };

/* ---------- 4 · tapu arşivi ---------- */
const builtAll = () => S.own.reduce((n, k) => n + lotsOf(S, k).filter(p => p && !p.ob && p.lvl >= 1).length, 0);
const hasType = (t: BuildingType) => S.own.some(k => lotsOf(S, k).some(p => p && !p.sp && !p.ob && p.t === t && p.lvl >= 1));
const cities = () => new Set(S.own.map(k => k.split('-')[0])).size;
const starsAll = () => Object.values(S.stars || {}).reduce((n, a) => n + a.length, 0);
export const ACH: { id: string; n: string; d: string; ok: () => boolean }[] = [
  { id: 'ev', n: tk('İLK EV'), d: tk('İlk evini kur'), ok: () => hasType('ev') },
  { id: 'kafe', n: tk('İLK KAFE'), d: tk('İlk kafeni aç'), ok: () => hasType('kafe') },
  { id: 'dukkan', n: tk('İLK DÜKKÂN'), d: tk('İlk dükkânını aç'), ok: () => hasType('dukkan') },
  { id: 'ofis', n: tk('İLK OFİS'), d: tk('İlk ofisini kur'), ok: () => hasType('ofis') },
  { id: 'b20', n: tk('20 BİNA'), d: tk('Toplam 20 bina'), ok: () => builtAll() >= 20 },
  { id: 'b50', n: tk('50 BİNA'), d: tk('Toplam 50 bina'), ok: () => builtAll() >= 50 },
  { id: 'b100', n: tk('100. BİNA'), d: tk('Toplam 100 bina'), ok: () => builtAll() >= 100 },
  { id: 'kat5', n: tk('5. KAT'), d: tk('Bir binayı 5. kata çıkar'), ok: () => S.own.some(k => lotsOf(S, k).some(p => p && p.lvl >= 5)) },
  { id: 'full', n: tk('DOLU SEMT'), d: tk('Bir semtin 20 arsasını doldur'), ok: () => S.own.some(isFull) },
  { id: 'il2', n: tk('İKİ İL'), d: tk('İki ilde mülk sahibi ol'), ok: () => cities() >= 2 },
  { id: 'il3', n: tk('ÜÇ İL'), d: tk('Üç ilde mülk sahibi ol'), ok: () => cities() >= 3 },
  { id: 'yali', n: tk('BOĞAZDA YALI'), d: tk('Bebek tapusunu al'), ok: () => S.own.includes('ist-4') },
  { id: 'altin', n: tk('ALTIN MÜHÜR'), d: tk('Bir semtte 3 yıldız'), ok: () => Object.values(S.stars || {}).some(a => a.length >= 3) },
  { id: 'y10', n: tk('10 YILDIZ'), d: tk('Toplam 10 semt yıldızı'), ok: () => starsAll() >= 10 },
  { id: 'ozel', n: tk('ÖZEL TAPU'), d: tk('Bir özel yapıya sahip ol'), ok: () => S.inv.length > 0 || S.own.some(k => lotsOf(S, k).some(p => p && p.sp)) },
  { id: 'hold', n: tk('HOLDİNG'), d: tk('Holding kur'), ok: () => (S.shares || 0) > 0 },
  { id: 'seri7', n: tk('7 GÜN SERİ'), d: tk('7 gün üst üste kira günü'), ok: () => (S.daily.streak || 0) >= 7 },
  { id: 'lig', n: tk('TERFİ'), d: tk('Ligde bir üst lige çık'), ok: () => S.league.tier >= 1 },
  { id: 'gok', n: tk('GÖKDELEN LİGİ'), d: tk('En üst lige çık'), ok: () => S.league.tier >= LEAGUE_TOP },
  { id: 'kol5', n: tk('5 TARİHİ YAPI'), d: tk('Koleksiyonda 5 tarihi yapı'), ok: () => S.coll.length >= 5 },
  { id: 'kolt', n: tk('TÜM YAPILAR'), d: tk('Tüm tarihi yapıları topla'), ok: () => S.coll.length >= LM.length },
  { id: 'kap', n: tk('KAPORA'), d: tk('Bir semti kapora ile al'), ok: () => S.cnt.kapora > 0 },
  { id: 'ob10', n: tk('TEMİZLİKÇİ'), d: tk('10 engelli arsa temizle'), ok: () => S.cnt.ob >= 10 },
  { id: 'civ', n: tk('MECLİS ÜYESİ'), d: tk('3 belediye kararı ver'), ok: () => S.cnt.civic >= 3 },
  { id: 'cep', n: tk('MİMAR'), d: tk('Bir binanın cephesini değiştir'), ok: () => S.cnt.skin > 0 },
  { id: 'mn', n: tk('MİLYONER'), d: tk('Toplam ₺1 milyon kazan'), ok: () => S.earned >= 1e6 },
];
/** Yeni mühürleri verir (birkaç saniyede bir). */
export function checkAch() {
  for (const a of ACH) if (!S.ach.includes(a.id) && a.ok()) {
    S.ach.push(a.id); toast(t('Arşive mühür: {n}', { n: t(a.n) })); Snd.unlock(); buzz(12); persist();
    if (S.ach.length % 4 === 0) toast(t('{n} mühür · tüm kiralar kalıcı +{p}', { n: S.ach.length, p: pctTxt(S.ach.length / 4) }));
    Analytics.log('ach', { id: a.id, n: S.ach.length });
  }
}

/* ---------- 5 · belediye karar kartı ---------- */
const PL: Record<BuildingType, string> = { ev: tk('Evler'), kafe: tk('Kafeler'), dukkan: tk('Dükkânlar'), ofis: tk('Ofisler') };
/** Cümle içinde küçük harfle (toast). */
const PL_LOW: Record<BuildingType, string> = { ev: tk('evler'), kafe: tk('kafeler'), dukkan: tk('dükkânlar'), ofis: tk('ofisler') };
export function maybeCivic(): boolean {
  const k = S.cur, list = S.civic[k] || [];
  if (list.length >= CIVIC.length || filled(k) < 6 || S.playMs < S.nextCivic) return false;
  S.nextCivic = S.playMs + (12 + Math.random() * 8) * 60e3;
  const c = CIVIC[list.length], btn = (o: typeof c.a) => `<button class="cvo" data-a="${o.id}"><b>${t(o.n)}</b><em>${t(PL[o.t])} +${pctTxt(Math.round(CIVIC_X * 100))}</em><small>${t(o.d)}</small></button>`;
  openModal(`<div class="card cvcard"><p class="sec" style="margin:0 0 6px">${t('Tebligat · {d} belediyesi', { d: nm(DMAP[k].n) })}</p>
    <svg class="cvic" viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="29" fill="none" stroke="currentColor" stroke-width="3"/><path d="M18 44h28M20 44V28h24v16M17 28l15-10 15 10M26 44v-9h12v9" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"/></svg>
    <h3>${t(c.title)}</h3><p>${t(c.q)} ${t('Kararın bu semtte kalıcı olur.')}</p>
    <div class="cvopts">${btn(c.a)}${btn(c.b)}</div><p class="note">${t('Her semtte en fazla {n} karar · {i}/{n}', { n: CIVIC.length, i: list.length + 1 })}</p></div>`,
    a => {
      const o = civicOpt(a); if (!o) return;
      closeModal(); S.civic[k] = [...list, o.id]; S.cnt.civic++; ui.sheetSig = ''; persist(); Snd.unlock(); bump();
      toast(t('{n} yapılıyor · {type} +{p}', { n: t(o.n), type: t(PL_LOW[o.t]), p: pctTxt(Math.round(CIVIC_X * 100)) })); addXp(30);
      Analytics.log('civic', { id: o.id, district: k });
    });
  return true;
}

/* ---------- 6 · cephe ---------- */
export const SKIN_COLORS: { n: string; f: string; s: string; t: string; lock?: string }[] = [
  { n: tk('Krem'), f: '#efd8b3', s: '#d6b98f', t: '#e2cfae' },
  { n: tk('Gül kurusu'), f: '#e8c4b8', s: '#cfa597', t: '#dcb6a9' },
  { n: tk('Nane'), f: '#cfe0d2', s: '#b5ccb9', t: '#c3d8c7' },
  { n: tk('Buz mavisi'), f: '#d6dde8', s: '#b9c3d3', t: '#c9d2df' },
  { n: tk('Hardal'), f: '#efd27a', s: '#d5b45a', t: '#e4c56c', lock: tk('Arşivde 8 mühür') },
  { n: tk('Antrasit'), f: '#5a6270', s: '#454c58', t: '#505865', lock: tk('Arşivde 16 mühür') },
  { n: tk('Lavanta'), f: '#d9cfe8', s: '#bfb2d3', t: '#cdc2df', lock: tk('Sezon · 10. basamak') },
  { n: tk('Mercan'), f: '#f2b7a0', s: '#d99a83', t: '#e8a993', lock: tk('Sezon · 20. basamak') },
  { n: tk('Altın'), f: '#e9c46a', s: '#c9a24a', t: '#dcb65c', lock: tk('Altın Tapu · 15. basamak') },
  { n: tk('Tuğla kırmızısı'), f: '#d98b6c', s: '#bf6f52', t: '#cf7e60', lock: tk('Başlangıç paketi') },
];
export const ROOFS = [{ n: tk('Kiremit') }, { n: tk('Arduvaz'), rf: '#4f5b6b', rf2: '#3d4855' }, { n: tk('Yeşil'), rf: '#5f8a4c', rf2: '#476a38' }];
export function skinUnlocked(c: number) {
  if (c < 4) return true;
  if (c === 4) return S.ach.length >= 8;
  if (c === 5) return S.ach.length >= 16;
  return S.skinsU.includes(c);
}
/** Binanın inline stil değişkenleri (render'da kullanılır). */
export function skinStyle(p: { sk?: { c?: number; r?: number } }): string {
  const sk = p.sk; if (!sk) return '';
  let s = '';
  if (sk.c != null && SKIN_COLORS[sk.c]) { const c = SKIN_COLORS[sk.c]; s += `--cf:${c.f};--cs:${c.s};--ct:${c.t};`; }
  if (sk.r && ROOFS[sk.r] && ROOFS[sk.r].rf) s += `--rf:${ROOFS[sk.r].rf};--rf2:${ROOFS[sk.r].rf2};`;
  return s;
}
export function setSkin(k: DistrictKey, i: number, patch: { c?: number; r?: number; s?: boolean }) {
  const p = lotsOf(S, k)[i]; if (!p) return;
  if (patch.c != null && !skinUnlocked(patch.c)) { toast(t('Kilitli · {lock}', { lock: t(SKIN_COLORS[patch.c].lock || '') })); Snd.no(); return; }
  p.sk = { ...(p.sk || {}), ...patch }; S.cnt.skin++; ui.tileSig[i] = ''; ui.sheetSig = ''; persist(); Snd.tap();
}

/* ---------- 8 · tapu sezonu ---------- */
export const SEASON_LV = 30, XP_PER = 500;
export const seasonId = (t = now()) => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };
const MONTHS = [tk('Ocak'), tk('Şubat'), tk('Mart'), tk('Nisan'), tk('Mayıs'), tk('Haziran'), tk('Temmuz'), tk('Ağustos'), tk('Eylül'), tk('Ekim'), tk('Kasım'), tk('Aralık')];
export const seasonName = (id: string) => t(MONTHS[(parseInt(id.split('-')[1], 10) || 1) - 1]);
export function seasonLeft(t = now()) { const d = new Date(t); return +new Date(d.getFullYear(), d.getMonth() + 1, 1) - t; }
export function ensureSeason() {
  const id = seasonId();
  if (!S.season || S.season.id !== id) S.season = { id, xp: 0, got: [], ggot: [], gold: false };
}
export const seasonLevel = () => { ensureSeason(); return Math.min(SEASON_LV, Math.floor(S.season.xp / XP_PER)); };
export function addXp(n: number) {
  if (!S || !S.city) return; ensureSeason();
  const before = seasonLevel(); S.season.xp += n;
  const after = seasonLevel();
  if (after > before) { toast(t('Tapu sezonu · basamak {n}', { n: after })); Snd.unlock(); ui.sheetSig = ''; }
}
export interface SReward { kind: 'cash' | 'token' | 'skin' | 'special'; v: number; label: string; }
export function seasonReward(lv: number, gold: boolean): SReward {
  const base = Math.max(800, totalRate(false) * 120 * (1 + lv / 10));
  if (!gold) {
    if (lv === 10) return { kind: 'skin', v: 6, label: t('LAVANTA') };
    if (lv === 20) return { kind: 'skin', v: 7, label: t('MERCAN') };
    if (lv === 30) return { kind: 'cash', v: base * 10, label: '₺₺₺' };
    if (lv % 3 === 0) return { kind: 'token', v: 1, label: '2x' };
    return { kind: 'cash', v: base, label: '₺' };
  }
  if (lv === 15) return { kind: 'skin', v: 8, label: t('ALTIN') };
  if (lv === 30) return { kind: 'special', v: (parseInt(S.season.id.split('-')[1], 10) || 0) % SPECIALS.length, label: t('ÖZEL') };
  if (lv % 3 === 0) return { kind: 'token', v: 2, label: '2x2' };
  return { kind: 'cash', v: base * 2, label: '₺₺' };
}
function grant(r: SReward) {
  if (r.kind === 'cash') addCash(r.v);
  if (r.kind === 'token') S.tokens += r.v;
  if (r.kind === 'skin' && !S.skinsU.includes(r.v)) S.skinsU.push(r.v);
  if (r.kind === 'special') S.inv.push(SPECIALS[r.v].id);
}
/** Ulaşılmış ve alınmamış tüm ödülleri verir. */
export function claimSeason(): number {
  ensureSeason(); const lv = seasonLevel(); let n = 0;
  for (let l = 1; l <= lv; l++) {
    if (!S.season.got.includes(l)) { grant(seasonReward(l, false)); S.season.got.push(l); n++; }
    if (S.season.gold && !S.season.ggot.includes(l)) { grant(seasonReward(l, true)); S.season.ggot.push(l); n++; }
  }
  if (n) { bump(); Snd.reward(); toast(t('{n} sezon ödülü alındı', { n })); ui.sheetSig = ''; persist(); }
  return n;
}
export const seasonClaimable = () => { ensureSeason(); const lv = seasonLevel(); for (let l = 1; l <= lv; l++) if (!S.season.got.includes(l) || (S.season.gold && !S.season.ggot.includes(l))) return true; return false; };
export { N, producing, weekKey, fmt, CFG };
