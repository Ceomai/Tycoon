/* HAFTALIK LİG — 30 kişilik gruplar, ilk 5 yükselir, son 5 düşer.
   Grup kurma ve sonuç hesabı sunucuda (functions/src/league.ts); buradaki kurallar onunla aynı tutulmalı. */
import { LEAGUES, LEAGUE_TOP, CFG } from '../config';
import { S } from '../state';
import { fmt } from '../format';
import { t } from '../i18n';
import { totalRate } from '../economy';
import { Snd } from '../sound';
import { openModal, closeModal, bump } from '../ui/modal';
import { addCash } from './actions';
import { addXp } from './fun';
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
/** Görünen lig adı (seçili dilde). LEAGUES tablosu tk() ile işaretli. */
export const leagueName = (tier: number) => t(LEAGUES[Math.max(0, Math.min(LEAGUE_TOP, tier | 0))].n);
export const leagueShort = (tier: number) => t(LEAGUES[Math.max(0, Math.min(LEAGUE_TOP, tier | 0))].short);

/** Hafta pazartesi 00:00 UTC'de biter (sunucuyla aynı). */
export function weekEndsAt(tm: number): number {
  const d = new Date(tm), wd = (d.getUTCDay() + 6) % 7;
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - wd + 7);
}
export function fmtLeft(ms: number): string {
  const h = Math.max(0, Math.floor(ms / 3600e3)), d = Math.floor(h / 24);
  return d ? t('{d}g {h}s', { d, h: h % 24 }) : t('{h}s {m}dk', { h, m: Math.max(0, Math.floor(ms / 60e3) % 60) });
}

const prize = (r: LeagueResult) => Math.max(10000, totalRate(false) * 1800 * (r.to + 1));

/** Hafta sonucu kartı (tasarım: L2 · terfi kartı). Her hafta için bir kez gösterilir. */
export function showLeagueResult(r: LeagueResult) {
  if (!r || S.league.last === r.week) return;
  S.league.last = r.week; S.league.tier = r.to; if (r.seal) S.league.seals++; persist();
  const up = r.to > r.from, down = r.to < r.from;
  const cash = up ? prize(r) : down ? 0 : prize(r) / 4;
  const stamp = up ? t('TERFİ') : down ? t('TAŞINMA') : r.seal ? t('ZİRVE') : t('TESCİL');
  const league = leagueName(r.to);
  const title = up ? t('{league}ne yükseldin', { league }) : down ? t('{league}ne taşındın', { league }) : t('{league}nde kaldın', { league });
  const note = down ? t('Bu hafta daha sık uğra, hemen geri dönersin.') : r.seal ? t('Gökdelen Ligi zirvesindesin: haftanın mührü senin.') : t('Yeni grubun seni bekliyor.');
  const rows = [
    cash ? [t('Tapu ikramiyesi'), fmt(cash)] : null,
    up || r.seal ? [r.seal ? t('Zirve mührü') : t('{league} mührü', { league }), t('Profilde')] : null,
  ].filter(Boolean) as string[][];
  const grant = (m: number) => { if (up) addXp(200); if (cash) addCash(cash * m); bump(); Snd.reward(); persist(); };
  Analytics.log('league_result', { from: r.from, to: r.to, rank: r.rank, size: r.size });
  openModal(`<div class="card lgcard">
    <div class="lgstamp"><span>${stamp}</span><b>${leagueShort(r.to)}</b></div>
    <h3>${title}</h3>
    <p>${t('{league} grubunda <b>{rank}.</b> oldun ({size} emlakçı).', { league: leagueName(r.from), rank: r.rank, size: r.size })} ${note}</p>
    ${rows.length ? `<div class="lgrw">${rows.map(([a, b]) => `<div><span>${a}</span><b>${b}</b></div>`).join('')}</div>` : ''}
    <div class="btns">${cash ? `<button class="btn gold" data-a="x2">${t('İzle, ikramiyeyi 2 katına çıkar')}</button>` : ''}<button class="txt" data-a="ok"${cash ? '' : ' data-back'}>${cash ? t('Al') : t('Tamam')}</button></div></div>`,
    a => { closeModal(); if (a === 'x2') Ads.rewarded('league', t('{amt} ikramiye', { amt: fmt(cash * 2) }), () => grant(2), () => grant(1)); else grant(1); }); // reklam olmazsa 1 kat
}
export { CFG };
