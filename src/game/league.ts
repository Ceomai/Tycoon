/* HAFTALIK LİG — 30 kişilik gruplar, ilk 5 yükselir, son 5 düşer.
   Grup kurma ve sonuç hesabı sunucuda (functions/src/league.ts); buradaki kurallar onunla aynı tutulmalı. */
import { LEAGUES, LEAGUE_TOP, CFG } from '../config';
import { S } from '../state';
import { fmt } from '../format';
import { totalRate } from '../economy';
import { Snd } from '../sound';
import { openModal, closeModal, bump } from '../ui/modal';
import { addBoost, addCash } from './actions';
import { persist } from './persist';
import { Ads } from '../services/ads';
import { Analytics } from '../services/analytics';

export interface LeagueResult { week: string; from: number; to: number; rank: number; size: number; seal: boolean; }

/** Bölge sınırları: küçük gruplarda daha az kişi yükselir; 15 kişinin altında kimse düşmez. */
export function leagueZones(size: number, tier: number) {
  const up = tier >= LEAGUE_TOP ? 0 : size >= 10 ? 5 : Math.max(1, Math.floor(size / 3));
  const down = tier <= 0 ? 0 : size >= 15 ? 5 : 0;
  return { up, down };
}
export function leagueOutcome(rank: number, size: number, tier: number): { to: number; seal: boolean } {
  const z = leagueZones(size, tier);
  let to = tier;
  if (rank <= z.up) to = tier + 1;
  else if (z.down && rank > size - z.down) to = tier - 1;
  return { to, seal: tier === LEAGUE_TOP && rank <= 3 };
}
export const leagueName = (t: number) => LEAGUES[Math.max(0, Math.min(LEAGUE_TOP, t | 0))].n;
export const leagueShort = (t: number) => LEAGUES[Math.max(0, Math.min(LEAGUE_TOP, t | 0))].short;

/** Hafta pazartesi 00:00 UTC'de biter (sunucuyla aynı). */
export function weekEndsAt(t: number): number {
  const d = new Date(t), wd = (d.getUTCDay() + 6) % 7;
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - wd + 7);
}
export function fmtLeft(ms: number): string {
  const h = Math.max(0, Math.floor(ms / 3600e3)), d = Math.floor(h / 24);
  return d ? `${d}g ${h % 24}s` : `${h}s ${Math.max(0, Math.floor(ms / 60e3) % 60)}dk`;
}

const prize = (r: LeagueResult) => Math.max(5000, totalRate(false) * 900 * (r.to + 1));

/** Hafta sonucu kartı (tasarım: L2 · terfi kartı). Her hafta için bir kez gösterilir. */
export function showLeagueResult(r: LeagueResult) {
  if (!r || S.league.last === r.week) return;
  S.league.last = r.week; S.league.tier = r.to; if (r.seal) S.league.seals++; persist();
  const up = r.to > r.from, down = r.to < r.from;
  const cash = up ? prize(r) : down ? 0 : prize(r) / 4;
  const stamp = up ? 'TERFİ' : down ? 'TAŞINMA' : r.seal ? 'ZİRVE' : 'TESCİL';
  const title = up ? `${leagueName(r.to)}ne yükseldin` : down ? `${leagueName(r.to)}ne taşındın` : `${leagueName(r.to)}nde kaldın`;
  const note = down ? 'Bu hafta daha sık uğra, hemen geri dönersin.' : r.seal ? 'Gökdelen Ligi zirvesindesin: haftanın mührü senin.' : 'Yeni grubun seni bekliyor.';
  const rows = [
    cash ? ['Tapu ikramiyesi', fmt(cash)] : null,
    up ? ['2x gelir', '3 saat'] : null,
    up || r.seal ? [`${r.seal ? 'Zirve' : leagueName(r.to)} mührü`, 'Profilde'] : null,
  ].filter(Boolean) as string[][];
  const grant = (m: number) => { if (cash) addCash(cash * m); if (up) addBoost(3 * 3600e3); bump(); Snd.reward(); persist(); };
  Analytics.log('league_result', { from: r.from, to: r.to, rank: r.rank, size: r.size });
  openModal(`<div class="card lgcard">
    <div class="lgstamp"><span>${stamp}</span><b>${leagueShort(r.to)}</b></div>
    <h3>${title}</h3>
    <p>${leagueName(r.from)} grubunda <b>${r.rank}.</b> oldun (${r.size} emlakçı). ${note}</p>
    ${rows.length ? `<div class="lgrw">${rows.map(([a, b]) => `<div><span>${a}</span><b>${b}</b></div>`).join('')}</div>` : ''}
    <div class="btns">${cash ? `<button class="btn gold" data-a="x2">İzle, ikramiyeyi 2 katına çıkar</button>` : ''}<button class="txt" data-a="ok">${cash ? 'Al' : 'Tamam'}</button></div></div>`,
    a => { closeModal(); if (a === 'x2') Ads.rewarded('league', `${fmt(cash * 2)} ikramiye`, () => grant(2)); else grant(1); });
}
export { CFG };
