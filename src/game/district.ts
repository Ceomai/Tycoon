/* =========================================================
   SEMT GEÇİŞLERİ — kapora, engelli arsalar, il kartpostalı + semt kuralı, semt özeti
   ========================================================= */
import { CFG, N, TYPES, DMAP, CITIES, DistrictKey, DRULES, OBSTACLE_IDS, currency } from '../config';
import { t, tk, nm, pctTxt, LANG } from '../i18n';
import { S, lotsOf, Plot } from '../state';
import { fmt, loc } from '../format';
import { now, costM, unlockInfo, filled } from '../economy';
import { I } from '../icons';
import { Snd, buzz } from '../sound';
import { $, ui } from '../ui/ctx';
import { openModal, closeModal, toast, bump } from '../ui/modal';
import { lmLeft, landmarkCard } from './collection';
import { addCash } from './actions';
import { addXp } from './fun';
import { persist } from './persist';
import { Analytics } from '../services/analytics';

/* ---------- kapora ---------- */
export const kaporaOf = (k: DistrictKey) => Math.ceil(unlockInfo(k).fee * CFG.KAPORA);
export const builtCount = (k: DistrictKey) => lotsOf(S, k).filter(p => p && !p.ob).length;
/** Kaporalı semtte yeni bina kurulabilir mi (en fazla 4 arsa). */
export const lienBlocks = (k: DistrictKey) => !!S.lien[k] && builtCount(k) >= CFG.KAPORA_LOTS;
/** Borca ödeme yapar; borç biterse tapu tamamen oyuncunun olur. */
export function payLien(k: DistrictKey, amount: number) {
  if (!S.lien[k] || amount <= 0) return;
  S.lien[k] -= amount;
  if (S.lien[k] <= 0.5) {
    delete S.lien[k]; delete S.lienT[k];
    toast(t('{d} tapusu tamamen senin · 20 arsa açıldı', { d: nm(DMAP[k].n) })); Snd.unlock(); buzz(30);
    ui.sheetSig = ''; ui.tileSig = []; persist();
    Analytics.log('kapora_paid', { district: k });
  }
}
/** Kalan borcu kasadan kapatır. */
export function closeLien(k: DistrictKey) {
  const d = S.lien[k]; if (!d) return;
  if (S.cash < d) { Snd.no(); return; }
  S.cash -= d; payLien(k, d);
}

/* ---------- engelli arsalar ---------- */
export const OBSTACLES: Record<string, { n: string; d: string }> = {
  gecekondu: { n: tk('Eski gecekondu'), d: tk('Yıllardır boş duran tek katlı bir gecekondu.') },
  hurda: { n: tk('Hurda araba'), d: tk('Arsada çürümeye bırakılmış eski bir araba.') },
  moloz: { n: tk('Moloz yığını'), d: tk('Eski bir inşaattan kalma tuğla ve beton parçaları.') },
  duvar: { n: tk('Yıkık duvar'), d: tk('Bahçe duvarının ayakta kalan son parçaları.') },
};
const OB_KEYS = OBSTACLE_IDS;
export const clearCost = (k: DistrictKey) => TYPES.ev.cost * costM(k) * 4;
/** Yeni alınan semte 3–4 engel yerleştirir. */
export function placeObstacles(k: DistrictKey) {
  const lots = lotsOf(S, k), free = Array.from({ length: N }, (_, i) => i).filter(i => !lots[i]);
  const n = 3 + (Math.random() < .5 ? 1 : 0);
  for (let c = 0; c < n && free.length; c++) {
    const i = free.splice(Math.floor(Math.random() * free.length), 1)[0];
    lots[i] = { t: 'ev', lvl: 0, buf: 0, until: 0, dur: 1, up: false, ob: OB_KEYS[Math.floor(Math.random() * OB_KEYS.length)] } as Plot;
  }
}
export function clearObstacle(k: DistrictKey, i: number) {
  const p = lotsOf(S, k)[i]; if (!p || !p.ob) return;
  const c = clearCost(k); if (S.cash < c) { Snd.no(); return; }
  S.cash -= c; lotsOf(S, k)[i] = null; S.cnt.ob++; addXp(10);
  const back = Math.round(c * (1.5 + Math.random())); addCash(back); bump(); Snd.wreck(); buzz(20);
  if (k === S.cur) ui.teslim[i] = { at: performance.now() + 1600, txt: `+${fmt(back)}` };
  ui.sheetSig = ''; ui.tileSig[i] = ''; persist();
  const left = lmLeft();
  if (Math.random() < .08 && left.length) { const l = left[0]; S.coll.push(l.id); openModal(landmarkCard(l, ' ' + t('Molozun altından çıktı!')), () => closeModal()); }
  else toast(t('Arsa temizlendi · {amt} değerinde eski eşya çıktı', { amt: fmt(back) }));
  Analytics.log('obstacle_clear', { district: k });
}
export function obstacleSvg(kind: string): string {
  const ink = 'stroke="var(--ink)" stroke-linejoin="round"';
  const A: Record<string, string> = {
    gecekondu: `<polygon points="18,86 62,86 74,77 74,54 62,63 18,63" fill="#b9a98f" ${ink}/><polygon points="62,86 74,77 74,54 62,63" fill="#9f8f75" ${ink}/><polygon points="14,64 66,64 78,52 40,40 26,44" fill="#7d8a8f" ${ink}/><rect x="28" y="70" width="10" height="16" fill="#5a4636" ${ink} stroke-width=".7"/><rect x="46" y="69" width="10" height="7" fill="#bcd6e8" ${ink} stroke-width=".6"/><path d="M50 40v-8h6v10" fill="none" ${ink}/>`,
    hurda: `<polygon points="14,80 66,80 74,72 74,62 62,57 30,57 20,64 14,67" fill="#a0603f" ${ink}/><polygon points="30,57 60,57 54,48 36,48" fill="#c9d6dd" ${ink} stroke-width=".8"/><circle cx="26" cy="82" r="6" fill="#2c3440"/><circle cx="62" cy="82" r="6" fill="#2c3440"/><path d="M40 62l7 9M52 60l-4 10" stroke="var(--ink)" stroke-width=".8"/>`,
    moloz: `<polygon points="10,86 26,62 40,70 52,54 74,86" fill="#a8a196" ${ink}/><rect x="22" y="72" width="12" height="7" fill="#c4704f" ${ink} stroke-width=".6" transform="rotate(-12 28 75)"/><rect x="46" y="70" width="14" height="6" fill="#d9d6cc" ${ink} stroke-width=".6" transform="rotate(18 53 73)"/><rect x="58" y="78" width="9" height="5" fill="#c4704f" ${ink} stroke-width=".5"/>`,
    duvar: `<polygon points="12,86 40,86 40,58 34,52 28,60 22,54 12,62" fill="#d6c3a0" ${ink}/><polygon points="40,86 56,76 56,62 40,58" fill="#bfa982" ${ink}/><path d="M12 72h28M20 62v24M30 72v14M12 79h28" stroke="var(--ink)" stroke-width=".5"/><polygon points="58,86 70,80 66,74 60,78" fill="#a8a196" ${ink} stroke-width=".7"/>`,
  };
  return A[kind] || A.moloz;
}

/* ---------- il kartpostalı + semt kuralı ---------- */
/** Cümle içi küçük harf (Almancada adlar büyük harfle kalır). */
const lowTxt = (s: string) => (LANG === 'de' ? s : s.toLocaleLowerCase(LANG === 'tr' ? 'tr-TR' : LANG));
const POST: Record<string, string> = {
  ist: `<rect width="320" height="170" fill="#d9e7ef"/><rect y="118" width="320" height="52" fill="#7fa7c6"/><path d="M0 130h320M20 142h60M130 150h70M230 140h60" stroke="#bcd6e8" stroke-width="2"/>
    <polygon points="40,118 40,74 30,74 52,34 74,74 64,74 64,118" fill="#e6d3ad" stroke="#1e3a32" stroke-width="1.2"/><circle cx="52" cy="60" r="5" fill="#bcd6e8" stroke="#1e3a32"/>
    <polygon points="96,118 196,118 196,96 96,96" fill="#c9785c" stroke="#1e3a32" stroke-width="1.2"/><path d="M110 96v-22M182 96v-22" stroke="#1e3a32" stroke-width="2"/><path d="M118 96q28-34 56 0" fill="#b0634a" stroke="#1e3a32" stroke-width="1.2"/>
    <polygon points="250,126 270,126 268,96 252,96" fill="#f3ede0" stroke="#1e3a32" stroke-width="1.2"/><polygon points="248,96 272,96 260,80" fill="#c4704f" stroke="#1e3a32"/><rect x="244" y="126" width="32" height="5" fill="#8a857b" stroke="#1e3a32"/>`,
  izm: `<rect width="320" height="170" fill="#f3e6cf"/><rect y="122" width="320" height="48" fill="#6f9fc0"/><path d="M0 134h320M40 146h70M180 152h80" stroke="#bcd6e8" stroke-width="2"/>
    <rect x="142" y="56" width="26" height="66" fill="#efe2c8" stroke="#1e3a32" stroke-width="1.2"/><rect x="136" y="50" width="38" height="8" fill="#d6c3a0" stroke="#1e3a32"/><path d="M146 50q9-22 18 0" fill="#c4704f" stroke="#1e3a32"/><circle cx="155" cy="70" r="7" fill="#fbfbf7" stroke="#1e3a32"/><path d="M155 66v4h3" stroke="#1e3a32"/><rect x="128" y="118" width="54" height="6" fill="#d6c3a0" stroke="#1e3a32"/>
    <path d="M60 122v-48" stroke="#6b4a3a" stroke-width="3"/><path d="M60 74q-20-6-30 6M60 74q-16-16-30-12M60 74q16-14 30-8M60 74q20 0 28 12" fill="none" stroke="#2f7d5b" stroke-width="4" stroke-linecap="round"/>
    <path d="M250 122v-40" stroke="#6b4a3a" stroke-width="3"/><path d="M250 82q-18-4-26 6M250 82q14-12 26-6M250 82q-12-14-24-10" fill="none" stroke="#2f7d5b" stroke-width="4" stroke-linecap="round"/>`,
  ank: `<rect width="320" height="170" fill="#e4e8ee"/><path d="M0 130q60-34 120-18t110 6 90-10v62H0z" fill="#b9c4a8" stroke="#1e3a32" stroke-width="1.2"/>
    <rect x="200" y="40" width="10" height="84" fill="#dfe4e8" stroke="#1e3a32" stroke-width="1.2"/><ellipse cx="205" cy="40" rx="16" ry="9" fill="#9fb3bf" stroke="#1e3a32" stroke-width="1.2"/><path d="M205 31v-14" stroke="#1e3a32" stroke-width="1.5"/>
    <polygon points="40,112 40,86 54,86 54,80 66,80 66,86 80,86 80,80 92,80 92,86 106,86 106,112" fill="#c9b48c" stroke="#1e3a32" stroke-width="1.2"/><path d="M60 112v-10a6 6 0 0 1 12 0v10" fill="#6b4a3a" stroke="#1e3a32"/>
    <rect x="240" y="100" width="40" height="24" fill="#f3ede0" stroke="#1e3a32"/><rect x="132" y="104" width="30" height="20" fill="#f3ede0" stroke="#1e3a32"/>`,
};
export function postcard(city: string) {
  return `<svg class="postimg" viewBox="0 0 320 170" role="img" aria-label="${t('{city} kartpostalı', { city: nm(CITIES[city as 'ist'].n) })}">${POST[city] || POST.ist}</svg>`;
}
/** Yeni semte girişte: il kartpostalı + semtin kuralı. */
export function showDistrictCard(k: DistrictKey, onDone?: () => void) {
  const d = DMAP[k], r = DRULES[k], c = CITIES[d.city];
  if (!S.cards.includes(d.city)) S.cards.push(d.city);
  openModal(`<div class="card postcard">
    <p class="sec" style="text-align:center;margin:0 0 8px">${t('Yeni semt · tapu teslim')}</p>
    <div class="post"><div class="pimg">${postcard(d.city)}<span class="pst">TAPU<br>${new Date(now()).getFullYear()}</span></div>
      <b>${nm(d.n)}</b><small>${nm(c.n)} · ${t(c.tagline)}</small></div>
    ${r ? `<div class="prule"><span class="pr">${r.kind === 'type' || r.kind === 'row' ? '+' + pctTxt(Math.round(r.x * 100)) : r.kind === 'pair' ? '+' + pctTxt(Math.round((CFG.PAIR + r.x) * 100)) : pctTxt(Math.round(r.x * 100))}</span><span><small>${t('Semtin kuralı')}</small><b>${t(r.n)}: ${lowTxt(t(r.t))}</b></span></div>` : ''}
    ${S.lien[k] ? `<p class="note">${t('Kapora ile alındı: {n} arsa açık. Kalan {debt} borç {d} kirasının yarısıyla kendiliğinden ödenir.', { n: CFG.KAPORA_LOTS, debt: fmt(S.lien[k]), d: nm(d.n) })}</p>` : ''}
    <div class="btns"><button class="btn gold" data-a="ok">${t('Semte git')}</button></div></div>`, () => { closeModal(); onDone && onDone(); });
}

/* ---------- semt özeti ---------- */
let sumT: any = 0;
export function showSummary(k: DistrictKey, from: DistrictKey) {
  const a = S.dEarn[k] || 0; S.dEarn[k] = 0;
  if (a < 1 || k === from) return;
  const el = $('#sumBar'); if (!el) return;
  el.innerHTML = `<span class="tl">${currency()}</span><span class="tx">${t('{d} sen {loc}yken {amt} kazandı', { d: `<b>${nm(DMAP[k].n)}</b>`, loc: loc(nm(DMAP[from].n)), amt: `<b>${fmt(a)}</b>` })}</span>`;
  el.hidden = false; clearTimeout(sumT); sumT = setTimeout(() => { el.hidden = true; }, 4500);
}

/* ---------- ilerleme çubuğu: bu semtin yüzdesi + sonraki semt kaporası ---------- */
export function nextDistrict(k: DistrictKey): DistrictKey | null {
  const d = DMAP[k]; if (d.idx >= 4) return null;
  const nk = `${d.city}-${d.idx + 1}`; return S.own.includes(nk) ? null : nk;
}
export function progressInfo(k: DistrictKey) {
  const f = filled(k), pct = Math.round(f / N * 100), lien = S.lien[k];
  const nk = nextDistrict(k);
  let sub = '';
  if (nk) {
    const fee = unlockInfo(nk).fee, kap = Math.ceil(fee * CFG.KAPORA), dn = nm(DMAP[nk].n), full = f >= N && !lien;
    if (!full) sub = S.cash >= kap ? t('Sonraki semt {d}: kapora hazır · burayı doldurunca açılır', { d: dn }) : t('Sonraki semt {d}: kaporaya {amt} kaldı', { d: dn, amt: fmt(kap - S.cash) });
    else if (S.cash >= fee) sub = t('{d} tapusu alınabilir', { d: dn });
    else if (S.cash >= kap) sub = t('{d} kaporası verilebilir · tapuya {amt} kaldı', { d: dn, amt: fmt(fee - S.cash) });
    else sub = t('{d} kaporasına {amt} kaldı', { d: dn, amt: fmt(kap - S.cash) });
  }
  return { f, pct, lien, sub, nk };
}
