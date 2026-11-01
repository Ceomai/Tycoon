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

/* ---------- 2 · piyasa raporu kartı ---------- */
export function showMarket() {
  const wk = curWeek(), m = marketOf(wk);
  S.market = wk; persist();
  const rows = ORDER.map(t => { const v = t === m.up ? MARKET_UP : t === m.down ? -MARKET_DOWN : 0; return `<div class="mkr"><b>${TYPES[t].n}</b><span class="mkb"><i></i><u class="${v > 0 ? 'up' : v < 0 ? 'dn' : ''}" style="width:${Math.abs(v) * 140}%"></u></span><em class="${v > 0 ? 'up' : v < 0 ? 'dn' : ''}">${v > 0 ? '+' : v < 0 ? '−' : ''}%${Math.round(Math.abs(v) * 100)}</em></div>`; }).join('');
  openModal(`<div class="card mkcard"><p class="sec" style="margin:0 0 4px">Emlak piyasası · ${m.n}. hafta</p><h3>${m.head}</h3><p>${m.why}</p>
    <div class="mkrows">${rows}</div><p class="note">Her pazartesi yeni rapor; herkes için aynı, haftalık ligde de geçerli.</p>
    <div class="btns"><button class="btn" data-a="ok">Anladım, yatırım zamanı</button></div></div>`, () => closeModal());
}
export const marketChip = () => { const m = marketOf(curWeek()); return `${TYPES[m.up].n.toLocaleUpperCase('tr-TR')} ↑`; };

/* ---------- 4 · tapu arşivi ---------- */
const builtAll = () => S.own.reduce((n, k) => n + lotsOf(S, k).filter(p => p && !p.ob && p.lvl >= 1).length, 0);
const hasType = (t: BuildingType) => S.own.some(k => lotsOf(S, k).some(p => p && !p.sp && !p.ob && p.t === t && p.lvl >= 1));
const cities = () => new Set(S.own.map(k => k.split('-')[0])).size;
const starsAll = () => Object.values(S.stars || {}).reduce((n, a) => n + a.length, 0);
export const ACH: { id: string; n: string; d: string; ok: () => boolean }[] = [
  { id: 'ev', n: 'İLK EV', d: 'İlk evini kur', ok: () => hasType('ev') },
  { id: 'kafe', n: 'İLK KAFE', d: 'İlk kafeni aç', ok: () => hasType('kafe') },
  { id: 'dukkan', n: 'İLK DÜKKÂN', d: 'İlk dükkânını aç', ok: () => hasType('dukkan') },
  { id: 'ofis', n: 'İLK OFİS', d: 'İlk ofisini kur', ok: () => hasType('ofis') },
  { id: 'b20', n: '20 BİNA', d: 'Toplam 20 bina', ok: () => builtAll() >= 20 },
  { id: 'b50', n: '50 BİNA', d: 'Toplam 50 bina', ok: () => builtAll() >= 50 },
  { id: 'b100', n: '100. BİNA', d: 'Toplam 100 bina', ok: () => builtAll() >= 100 },
  { id: 'kat5', n: '5. KAT', d: 'Bir binayı 5. kata çıkar', ok: () => S.own.some(k => lotsOf(S, k).some(p => p && p.lvl >= 5)) },
  { id: 'full', n: 'DOLU SEMT', d: 'Bir semtin 20 arsasını doldur', ok: () => S.own.some(isFull) },
  { id: 'il2', n: 'İKİ İL', d: 'İki ilde mülk sahibi ol', ok: () => cities() >= 2 },
  { id: 'il3', n: 'ÜÇ İL', d: 'Üç ilde mülk sahibi ol', ok: () => cities() >= 3 },
  { id: 'yali', n: 'BOĞAZDA YALI', d: 'Bebek tapusunu al', ok: () => S.own.includes('ist-4') },
  { id: 'altin', n: 'ALTIN MÜHÜR', d: 'Bir semtte 3 yıldız', ok: () => Object.values(S.stars || {}).some(a => a.length >= 3) },
  { id: 'y10', n: '10 YILDIZ', d: 'Toplam 10 semt yıldızı', ok: () => starsAll() >= 10 },
  { id: 'ozel', n: 'ÖZEL TAPU', d: 'Bir özel yapıya sahip ol', ok: () => S.inv.length > 0 || S.own.some(k => lotsOf(S, k).some(p => p && p.sp)) },
  { id: 'hold', n: 'HOLDİNG', d: 'Holding kur', ok: () => (S.shares || 0) > 0 },
  { id: 'seri7', n: '7 GÜN SERİ', d: '7 gün üst üste kira günü', ok: () => (S.daily.streak || 0) >= 7 },
  { id: 'lig', n: 'TERFİ', d: 'Ligde bir üst lige çık', ok: () => S.league.tier >= 1 },
  { id: 'gok', n: 'GÖKDELEN LİGİ', d: 'En üst lige çık', ok: () => S.league.tier >= LEAGUE_TOP },
  { id: 'kol5', n: '5 TARİHİ YAPI', d: 'Koleksiyonda 5 tarihi yapı', ok: () => S.coll.length >= 5 },
  { id: 'kolt', n: 'TÜM YAPILAR', d: 'Tüm tarihi yapıları topla', ok: () => S.coll.length >= LM.length },
  { id: 'kap', n: 'KAPORA', d: 'Bir semti kapora ile al', ok: () => S.cnt.kapora > 0 },
  { id: 'ob10', n: 'TEMİZLİKÇİ', d: '10 engelli arsa temizle', ok: () => S.cnt.ob >= 10 },
  { id: 'civ', n: 'MECLİS ÜYESİ', d: '3 belediye kararı ver', ok: () => S.cnt.civic >= 3 },
  { id: 'cep', n: 'MİMAR', d: 'Bir binanın cephesini değiştir', ok: () => S.cnt.skin > 0 },
  { id: 'mn', n: 'MİLYONER', d: 'Toplam ₺1 milyon kazan', ok: () => S.earned >= 1e6 },
];
/** Yeni mühürleri verir (birkaç saniyede bir). */
export function checkAch() {
  for (const a of ACH) if (!S.ach.includes(a.id) && a.ok()) {
    S.ach.push(a.id); toast(`Arşive mühür: ${a.n}`); Snd.unlock(); buzz(12); persist();
    if (S.ach.length % 4 === 0) toast(`${S.ach.length} mühür · tüm kiralar kalıcı +%${S.ach.length / 4}`);
    Analytics.log('ach', { id: a.id, n: S.ach.length });
  }
}

/* ---------- 5 · belediye karar kartı ---------- */
const PL: Record<BuildingType, string> = { ev: 'Evler', kafe: 'Kafeler', dukkan: 'Dükkânlar', ofis: 'Ofisler' };
export function maybeCivic(): boolean {
  const k = S.cur, list = S.civic[k] || [];
  if (list.length >= CIVIC.length || filled(k) < 6 || S.playMs < S.nextCivic) return false;
  S.nextCivic = S.playMs + (12 + Math.random() * 8) * 60e3;
  const c = CIVIC[list.length], btn = (o: typeof c.a) => `<button class="cvo" data-a="${o.id}"><b>${o.n}</b><em>${PL[o.t]} +%${Math.round(CIVIC_X * 100)}</em><small>${o.d}</small></button>`;
  openModal(`<div class="card cvcard"><p class="sec" style="margin:0 0 6px">Tebligat · ${DMAP[k].n} belediyesi</p>
    <svg class="cvic" viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="29" fill="none" stroke="currentColor" stroke-width="3"/><path d="M18 44h28M20 44V28h24v16M17 28l15-10 15 10M26 44v-9h12v9" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"/></svg>
    <h3>${c.title}</h3><p>${c.q} Kararın bu semtte kalıcı olur.</p>
    <div class="cvopts">${btn(c.a)}${btn(c.b)}</div><p class="note">Her semtte en fazla ${CIVIC.length} karar · ${list.length + 1}/${CIVIC.length}</p></div>`,
    a => {
      const o = civicOpt(a); if (!o) return;
      closeModal(); S.civic[k] = [...list, o.id]; S.cnt.civic++; ui.sheetSig = ''; persist(); Snd.unlock(); bump();
      toast(`${o.n} yapılıyor · ${PL[o.t].toLocaleLowerCase('tr-TR')} +%${Math.round(CIVIC_X * 100)}`); addXp(30);
      Analytics.log('civic', { id: o.id, district: k });
    });
  return true;
}

/* ---------- 6 · cephe ---------- */
export const SKIN_COLORS: { n: string; f: string; s: string; t: string; lock?: string }[] = [
  { n: 'Krem', f: '#efd8b3', s: '#d6b98f', t: '#e2cfae' },
  { n: 'Gül kurusu', f: '#e8c4b8', s: '#cfa597', t: '#dcb6a9' },
  { n: 'Nane', f: '#cfe0d2', s: '#b5ccb9', t: '#c3d8c7' },
  { n: 'Buz mavisi', f: '#d6dde8', s: '#b9c3d3', t: '#c9d2df' },
  { n: 'Hardal', f: '#efd27a', s: '#d5b45a', t: '#e4c56c', lock: 'Arşivde 8 mühür' },
  { n: 'Antrasit', f: '#5a6270', s: '#454c58', t: '#505865', lock: 'Arşivde 16 mühür' },
  { n: 'Lavanta', f: '#d9cfe8', s: '#bfb2d3', t: '#cdc2df', lock: 'Sezon · 10. basamak' },
  { n: 'Mercan', f: '#f2b7a0', s: '#d99a83', t: '#e8a993', lock: 'Sezon · 20. basamak' },
  { n: 'Altın', f: '#e9c46a', s: '#c9a24a', t: '#dcb65c', lock: 'Altın Tapu · 15. basamak' },
];
export const ROOFS = [{ n: 'Kiremit' }, { n: 'Arduvaz', rf: '#4f5b6b', rf2: '#3d4855' }, { n: 'Yeşil', rf: '#5f8a4c', rf2: '#476a38' }];
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
  if (patch.c != null && !skinUnlocked(patch.c)) { toast(`Kilitli · ${SKIN_COLORS[patch.c].lock}`); Snd.no(); return; }
  p.sk = { ...(p.sk || {}), ...patch }; S.cnt.skin++; ui.tileSig[i] = ''; ui.sheetSig = ''; persist(); Snd.tap();
}

/* ---------- 8 · tapu sezonu ---------- */
export const SEASON_LV = 30, XP_PER = 500;
export const seasonId = (t = now()) => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };
const MONTHS = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
export const seasonName = (id: string) => MONTHS[(parseInt(id.split('-')[1], 10) || 1) - 1];
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
  if (after > before) { toast(`Tapu sezonu · basamak ${after}`); Snd.unlock(); ui.sheetSig = ''; }
}
export interface SReward { kind: 'cash' | 'token' | 'skin' | 'special'; v: number; label: string; }
export function seasonReward(lv: number, gold: boolean): SReward {
  const base = Math.max(800, totalRate(false) * 120 * (1 + lv / 10));
  if (!gold) {
    if (lv === 10) return { kind: 'skin', v: 6, label: 'LAVANTA' };
    if (lv === 20) return { kind: 'skin', v: 7, label: 'MERCAN' };
    if (lv === 30) return { kind: 'cash', v: base * 10, label: '₺₺₺' };
    if (lv % 3 === 0) return { kind: 'token', v: 1, label: '2x' };
    return { kind: 'cash', v: base, label: '₺' };
  }
  if (lv === 15) return { kind: 'skin', v: 8, label: 'ALTIN' };
  if (lv === 30) return { kind: 'special', v: (parseInt(S.season.id.split('-')[1], 10) || 0) % SPECIALS.length, label: 'ÖZEL' };
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
  if (n) { bump(); Snd.reward(); toast(`${n} sezon ödülü alındı`); ui.sheetSig = ''; persist(); }
  return n;
}
export const seasonClaimable = () => { ensureSeason(); const lv = seasonLevel(); for (let l = 1; l <= lv; l++) if (!S.season.got.includes(l) || (S.season.gold && !S.season.ggot.includes(l))) return true; return false; };
export { N, producing, weekKey, fmt, CFG };
