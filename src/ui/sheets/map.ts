/* HARİTA PANELİ — semt hedefleri (tasarım F2), iller ve semtler, tapu/kapora, borç, 2x ipucu */
import { CFG, DRULES, DMAP, CITIES, CITY_ORDER, dkey } from '../../config';
import { S } from '../../state';
import { fmt } from '../../format';
import { filled, unlockInfo, citiesOwned, portfolioBonus } from '../../economy';
import { I } from '../../icons';
import { ui } from '../ctx';
import { lotBoost, buyDistrict, switchDistrict } from '../../game/actions';
import { goalsOf, starsOf } from '../../game/goals';
import { kaporaOf, builtCount, closeLien } from '../../game/district';
import { instantRewards } from '../../services/purchases';
import { saveTarget, boostSaving } from '../../game/monetize';
import { t, nm, LANG } from '../../i18n';
import { Panel, STAY, closeSheet, lv, lw } from './core';

/** Haritadaki 2x ipucu (saveTarget/boostSaving) birkaç saniyede bir hesaplanır. */
let hintAt = -1e9, hintV: { k: string; bs: NonNullable<ReturnType<typeof boostSaving>> } | null = null;
function mapHint() {
  const pt = performance.now();
  if (pt - hintAt > 3000 || pt < hintAt) { hintAt = pt; const tg = saveTarget(), bs = tg ? boostSaving(tg.rem) : null; hintV = tg && bs && bs.saved >= 1 ? { k: tg.k, bs } : null; }
  return hintV;
}
const lienPct = (k: string) => Math.round(100 * (1 - S.lien[k] / Math.max(S.lien[k], S.lienT[k] || S.lien[k])));

export const map: Panel<{ hint: ReturnType<typeof mapHint> }> = {
  sig(_s, _tn, c) {
    const hint = c.hint = mapHint();
    return 'm|' + (hint ? hint.k + Math.round(hint.bs.saved) + hint.bs.lot.k + hint.bs.lot.i + instantRewards() : '') + Object.keys(S.lien).map(k => k + (S.cash >= S.lien[k] ? 1 : 0)).join() + JSON.stringify(S.stars) + goalsOf(S.cur).map(g => g.f(S.cur).join('/')).join() + S.cur + S.own.join() + S.own.map(filled).join() + CITY_ORDER.map(cc => CITIES[cc].districts.map((_, i) => { const k = dkey(cc, i), u = unlockInfo(k); return (u.ok ? 1 : 0) + '' + (S.cash >= u.fee ? 1 : 0) + (u.ok && S.cash >= kaporaOf(k) ? 1 : 0); }).join('')).join();
  },
  render(_s, _tn, { hint }) {
    const start = S.city || 'ist';
    const order = [start, ...CITY_ORDER.filter(c => c !== start)];
    return goalsCard(S.cur) + `<p class="sec">${t('Portföy · {n} il', { n: citiesOwned() })}${portfolioBonus() ? ' · ' + t('kiralar +%{n}', { n: Math.round(portfolioBonus() * 100) }) : ''}</p>` + order.map(c => {
      const ownedHere = S.own.filter(k => DMAP[k].city === c).length;
      const rows = CITIES[c].districts.map((d, i) => {
        const k = dkey(c, i);
        const rl = DRULES[k] ? `<em class="rl">${t(DRULES[k].n)}: ${t(DRULES[k].t).toLocaleLowerCase(LANG === 'tr' ? 'tr-TR' : LANG)}</em>` : '';
        if (S.own.includes(k) && S.lien[k]) return `<div class="lienrow"><button class="drow${k === S.cur ? ' on' : ''}" data-a="go" data-k="${k}"><span class="di"><b>${nm(d.n)} · ${t('kaporalı')}</b><small>${t('{a}/{b} arsa açık · kalan borç {m}', { a: builtCount(k), b: CFG.KAPORA_LOTS, m: lv('ld' + k, () => fmt(S.lien[k] || 0)) })}</small>${rl}</span></button>
            <span class="dp"><u ${lw('lp' + k, () => (S.lien[k] ? lienPct(k) : 100))}></u></span>
            <button class="chip" data-a="payoff" data-k="${k}" ${S.cash >= S.lien[k] ? '' : 'disabled'}>${t('Borcu kapat')} · ${lv('ld' + k, () => fmt(S.lien[k] || 0))}</button></div>`;
        if (S.own.includes(k)) return `<button class="drow${k === S.cur ? ' on' : ''}" data-a="go" data-k="${k}"><span class="di"><b>${nm(d.n)}${starsOf(k).length >= 3 ? ` <span class="badge-gold">${t('ALTIN MÜHÜR')}</span>` : ''}</b><small>${t('{n}/20 dolu', { n: filled(k) })} · ${'★'.repeat(starsOf(k).length)}${'☆'.repeat(3 - starsOf(k).length)}</small>${rl}</span><span class="mini"><i style="width:${filled(k) / 20 * 100}%"></i></span></button>`;
        const u = unlockInfo(k);
        if (u.ok) {
          const af = S.cash >= u.fee, kap = kaporaOf(k), kf = S.cash >= kap;
          return `<div class="salerow"><div class="sh2"><b>${nm(d.n)}</b><span class="st">${t('SATIŞTA')}</span></div>${rl}
              <p>${t('Tapu {m}', { m: fmt(u.fee) })}${af ? '' : kf ? ' · ' + t('paran şimdilik yetmiyor ama kapora verip hemen başlayabilirsin') : ' · ' + t('kaporaya {m} kaldı', { m: lv('kp' + k, () => fmt(kaporaOf(k) - S.cash)) })}</p>
              ${hint && hint.k === k ? `<div class="hint2x"><span class="h2c">2x</span><span class="h2t"><b>${t('2x ile ≈ {m} dk kısalır', { m: Math.round(hint.bs.saved) })}</b><small>${t('en çok kazandıran binana 1 sa 2x')}</small></span><button class="chip h2b" data-a="boost2x" data-k="${hint.bs.lot.k}" data-i="${hint.bs.lot.i}">${instantRewards() ? '★ ' + t('Ver') : `${I.play} ${t('İzle')}`}</button></div>` : ''}
              <div class="sbtns"><button class="btn" data-a="kapora" data-k="${k}" ${kf && !af ? '' : 'disabled'}>${t('Kapora')} · ${fmt(kap)}<small>${t('%{p} · {n} arsa hemen', { p: Math.round(CFG.KAPORA * 100), n: CFG.KAPORA_LOTS })}</small></button>
              <button class="btn ${af ? 'gold' : 'soft'}" data-a="buy" data-k="${k}" ${af ? '' : 'disabled'}>${t('Tapuyu al')} · ${fmt(u.fee)}<small>${t('20 arsa')}</small></button></div></div>`;
        }
        const why = u.why === 'prev-not-full' ? t('{semt} dolunca açılır', { semt: nm(CITIES[c].districts[i - 1].n) }) : u.why === 'start-not-full' ? t('{semt} dolunca açılır', { semt: nm(CITIES[start].districts[0].n) }) + ' · ' + fmt(u.fee) : t('Kilitli');
        return `<div class="drow lkd"><span class="di"><b>${nm(d.n)}</b><small>${why}</small></span>${I.lock}</div>`;
      }).join('');
      return `<div class="cityhead"><span>${nm(CITIES[c].n)}</span><small>${ownedHere ? t('{n}/5 semt', { n: ownedHere }) : t(CITIES[c].tagline)}</small></div><div class="dlist">${rows}</div>`;
    }).join('') + `<p class="note">${t('Kapora: tapunun %{p}’unu öde, ilk {n} arsa hemen açılır; kalan borç o semtin kirasının yarısıyla kendiliğinden ödenir.', { p: Math.round(CFG.KAPORA * 100), n: CFG.KAPORA_LOTS })}</p><p class="note">${t('Başlangıç ilinin ilk semtini doldurunca diğer illerin ilk semtini alabilirsin. Her yeni il tüm kiralara kalıcı +%{p} katar.', { p: Math.round(CFG.PORTFOLIO_BONUS * 100) })}</p>`;
  },
  action(a, btn) {
    const k = btn.dataset.k!;
    if (a === 'go') { switchDistrict(k); closeSheet(); return STAY; }
    if (a === 'buy') { buyDistrict(k); return STAY; }
    if (a === 'kapora') { buyDistrict(k, true); return STAY; }
    if (a === 'payoff') { closeLien(k); ui.sheetSig = ''; return STAY; }
    if (a === 'boost2x') { lotBoost(k, +btn.dataset.i!); ui.sheetSig = ''; return STAY; }
  },
};

/* semt hedefleri kartı (tasarım F2) */
function goalsCard(k: string) {
  const got = starsOf(k), gs = goalsOf(k);
  return `<div class="goals"><div class="gh"><div><p class="sec">${t('Semt hedefleri · {n}/3', { n: got.length })}</p><h4 class="lgt">${nm(DMAP[k].n)}</h4></div><span class="stars">${[0, 1, 2].map(n => `<i class="${n < got.length ? 'on' : ''}">★</i>`).join('')}</span></div>
    ${gs.map((g, gi) => { const [pv, n] = g.f(k), done = got.includes(gi); return `<div class="gr${done ? ' done' : ''}"><span class="gm">${done ? '★' : ''}</span><span class="gt"><b>${g.t}</b><i><u style="width:${done ? 100 : Math.round(pv / n * 100)}%"></u></i></span><span class="gp">${done ? t('tamam') : `${pv}/${n}`}</span></div>`; }).join('')}
    <p class="note u-m0t-4">${t('3 yıldız: {semt} kiralarına kalıcı +%{p} ve altın mühür. Her yıldız tapu ikramiyesi verir.', { semt: nm(DMAP[k].n), p: Math.round(CFG.STAR_BONUS * 100) })}</p></div>`;
}
