/* HAFTALIK LİG (tasarım L1) ve LİG BASAMAKLARI (tasarım L3) panelleri */
import { DMAP, LEAGUES, LEAGUE_TOP } from '../../config';
import { S } from '../../state';
import { fmt, esc } from '../../format';
import { I } from '../../icons';
import { Cloud, type LeagueView } from '../../services/cloud';
import { leagueZones, leagueName, leagueShort, weekEndsAt, fmtLeft } from '../../game/league';
import { ui } from '../ctx';
import { t, nm } from '../../i18n';
import { Panel, STAY, openSheet, lv } from './core';

/** Lig tablosu isteği panel durumunda: v undefined = yükleniyor, null = grupta değil (err: hata, boş grup değil). */
type LbState = { v?: LeagueView | null; err?: boolean; req?: boolean };
export const lb: Panel<{ left: string }> = {
  sig(s, tn, c) {
    const L = s as LbState;
    if (!L.req) { L.req = true; L.v = undefined; L.err = false; Cloud.league().then(v => { L.v = v; ui.sheetSig = ''; }).catch(() => { L.v = null; L.err = true; ui.sheetSig = ''; }); } // hata ≠ boş grup
    const left = c.left = fmtLeft(weekEndsAt(tn) - tn), v = L.v;
    return 'lb|' + (v === undefined ? '-' : L.err ? 'E' : v ? v.rows.length + ':' + v.myRank + ':' + v.tier : 'x') + Cloud.ready() + left;
  },
  render(s, _tn, { left }) {
    const L = s as LbState, v = L.v;
    const tier = v ? v.tier : S.league.tier, wk = (S.week.key || '').split('H')[1] || '';
    const head = `<div class="lghead"><div><p class="sec">${t('Haftalık lig')}${wk ? ' · ' + t('{n}. hafta', { n: +wk }) : ''}</p>
        <h4 class="lgt">${leagueName(tier)}${v && v.group !== 'onizleme' ? ` · ${t('grup {g}', { g: esc(v.group.slice(-3).toUpperCase()) })}` : ''}</h4>
        <small class="lgsub">${v ? t('{n} emlakçı', { n: v.size }) + ' · ' : ''}${t('bitişe {s}', { s: left })}</small></div>${leagueSeal(tier)}</div>`;
    let list = '';
    if (!Cloud.ready()) list = `<p class="note u-mt0">${t('Lig internet bağlantısıyla çalışır. Bu hafta <b>{m}</b> kira topladın; bağlanınca grubuna katılırsın.', { m: lv('wk', () => fmt(S.week.earned)) })}</p>`;
    else if (v === undefined) list = `<p class="note u-mt0" role="status">${t('Grubun yükleniyor…')}</p>`;
    else if (L.err) list = `<div class="sterr" role="alert"><p>${t('Lig tablosu yüklenemedi')}<small>${t('Bağlantı sorunu olabilir. Bu haftaki kazancın cihazında duruyor.')}</small></p><button class="chip" data-a="lbretry">${t('Tekrar dene')}</button></div>`;
    else if (!v) list = `<p class="note u-mt0">${t('Bu hafta grubuna henüz yerleşmedin. Biraz kira topla; ilk skorunla sana yakın 30 emlakçılık gruba katılırsın.')}</p>`;
    else {
      const z = leagueZones(v.size, v.tier), parts: string[] = [];
      v.rows.forEach((r, i) => {
        const rank = i + 1, inUp = rank <= z.up, inDown = z.down > 0 && rank > v.size - z.down;
        if (z.down && rank === v.size - z.down + 1) parts.push(`<div class="lgline down"><span>▼ ${t('Düşme çizgisi')}</span></div>`);
        let sub = '';
        if (r.me) sub = inUp ? t('Yükselme bölgesindesin') : inDown ? t('Düşme bölgesindesin, hızlan') : z.up ? t('{n}. sıraya {m} kaldı', { n: z.up, m: fmt(Math.max(1, v.rows[z.up - 1].earned - r.earned + 1)) }) : t('Zirvede kal');
        parts.push(`<div class="lbr${r.me ? ' me' : ''}"><span class="rk${inUp ? ' up' : inDown ? ' down' : ''}">${rank}</span><span class="nm"><b>${esc(r.me ? t('Sen') : r.name)}</b> <i>· ${esc(nm(DMAP[r.district]?.n || ''))}</i>${sub ? `<small>${sub}</small>` : ''}</span><span class="sc">${fmt(r.earned)}</span></div>`);
        if (rank === z.up && z.up < v.size) parts.push(`<div class="lgline up"><span>▲ ${t('Yükselme çizgisi')}</span></div>`);
      });
      list = `<div class="lglist">${parts.join('')}</div>`;
    }
    const chips = `<div class="lgchips">${tier < LEAGUE_TOP ? `<div class="up"><small>${t('İlk 5 · yükselir')}</small><b>${t('Büyük tapu ikramiyesi')}</b></div>` : `<div class="up"><small>${t('İlk 3')}</small><b>${t('Haftanın zirve mührü')}</b></div>`}${tier > 0 ? `<div class="down"><small>${t('Son 5 · düşer')}</small><b>${t('Bir alt ligde yeni grup')}</b></div>` : `<div class="down"><small>${t('Arsa Ligi')}</small><b>${t('Düşme yok')}</b></div>`}</div>`;
    return `${head}${list}${chips}
        <div class="btns"><button class="btn soft" data-a="leagues">${t('Ligler ve kurallar')}</button><button class="txt" data-a="ref">${I.users} ${t('Arkadaşını davet et')}</button></div>`;
  },
  action(a, _btn, s) {
    if (a === 'ref') { openSheet({ k: 'ref' }); return STAY; }
    if (a === 'leagues') { openSheet({ k: 'leagues' }); return STAY; }
    if (a === 'lbretry') { s.req = false; s.err = false; }
  },
};

export const leagues: Panel = {
  sig: () => 'lg|' + S.league.tier,
  render() {
    const rule = (i: number) => i === LEAGUE_TOP ? t('Zirve · ilk 3 haftanın mührünü alır') : i === 0 ? t('Başlangıç · düşme yok') : t('İlk 5 yükselir · son 5 düşer');
    return `<p class="sec">${t('Ligler · yükseldikçe bina büyür')}</p><div class="lgtiers">
        ${LEAGUES.map((_, i) => LEAGUE_TOP - i).map(i => `<div class="lgtier${i === S.league.tier ? ' here' : ''}">${tierArt(i)}<span class="di"><b>${leagueName(i)}</b><small>${rule(i)}</small></span>${i === S.league.tier ? `<span class="st">${t('BURADASIN')}</span>` : ''}</div>`).join('')}</div>
        <div class="lgrules"><p class="sec">${t('Nasıl işler')}</p>
        <p>${t('Her pazartesi 30 kişilik yeni grup kurulur; kazancı sana yakın oyuncularla eşleşirsin.')}</p>
        <p>${t('Puan, o hafta topladığın kiradır. Hafta pazar gecesi biter, sonucun ilk girişte gelir.')}</p>
        <p>${t('Uğramayan oyuncu gruba alınmaz; gruplar hep canlı kalır.')}</p>${S.league.seals ? `<p>${t('Zirve mührün: <b>{n}</b>', { n: S.league.seals })}</p>` : ''}</div>
        <div class="btns"><button class="btn soft" data-a="back">${t('Lig tablosuna dön')}</button></div>`;
  },
  action(a) { if (a === 'back') { openSheet({ k: 'lb' }); return STAY; } },
};

/* lig mührü (başlıkta) ve basamak çizimi */
function leagueSeal(tier: number) {
  return `<svg class="lgseal" viewBox="0 0 100 100" aria-hidden="true"><g transform="rotate(-9 50 50)"><circle cx="50" cy="50" r="44" fill="none" stroke="currentColor" stroke-width="3.5"/><circle cx="50" cy="50" r="36" fill="none" stroke="currentColor" stroke-width="1.2"/><text x="50" y="46" text-anchor="middle" font-family="IBM Plex Mono" font-weight="600" font-size="11" fill="currentColor" letter-spacing="1.5">${t('LİG')}</text><text x="50" y="64" text-anchor="middle" font-family="Barlow Condensed" font-weight="700" font-size="${leagueShort(tier).length > 5 ? 15 : 22}" fill="currentColor">${leagueShort(tier)}</text></g></svg>`;
}
function tierArt(i: number) {
  const n = [0, 2, 4, 6, 9][i], w = [0, 34, 30, 26, 18][i], h = 56 / Math.max(n, 4);
  const floors = Array.from({ length: n }, (_, k) => `<rect x="${27 - w / 2}" y="${(60 - (k + 1) * h).toFixed(1)}" width="${w}" height="${h.toFixed(1)}" fill="var(--bg)" stroke="currentColor" stroke-width="1.5"/>`).join('');
  const stake = n ? '' : '<rect x="10" y="44" width="34" height="14" fill="none" stroke="currentColor" stroke-width="1.2" stroke-dasharray="3 2"/><line x1="40" y1="34" x2="40" y2="50" stroke="var(--stamp)" stroke-width="2"/><rect x="35" y="32" width="10" height="7" fill="var(--stamp)"/>';
  return `<svg class="lgart" viewBox="0 0 54 62" aria-hidden="true"><line x1="2" y1="60" x2="52" y2="60" stroke="currentColor" stroke-width="1.5"/>${floors}${stake}</svg>`;
}
