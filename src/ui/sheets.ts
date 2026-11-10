/* ALT PANELLER — arsa, semtler (çok şehirli), görevler, koleksiyon, menü, sıralama, davet, mağaza, holding, ayarlar */
import { COLS, N, CFG, DRULES, MAXLV, ORDER, TYPES, LV_INC, DMAP, CITIES, CITY_ORDER, dkey, PRIVACY_URL, TERMS_URL, BuildingType } from '../config';
import { S, lotsOf } from '../state';
import { fmt, fmtTime, fmtX, clock, esc, dayKey, dayDiff, weekKey } from '../format';
import { now, PAIRS, ruleMult, neighborBonus, pairAdj, spAdj, districtMult, neighbors, withDisc, buildCost, buildTime, upCost, upTime, adj, rate, incM, permMult, fxMult, filled, unlockInfo, collBonus, citiesOwned, portfolioBonus } from '../economy';
import { bld, site, svg } from '../draw';
import { LM, lmSvg } from '../landmarks';
import { I, small } from '../icons';
import { Snd } from '../sound';
import { $, ui, SheetState, syncHistory } from './ctx';
import { toast } from './modal';
import { build, upgrade, skip, demolish, lotBoost, buyDistrict, switchDistrict, buySpecial, placeSpecial, specialPrice } from '../game/actions';
import { specialSvg, specialOf, weekSpecial } from '../specials';
import { goalsOf, starsOf } from '../game/goals';
import { kaporaOf, builtCount, lienBlocks, closeLien, clearCost, clearObstacle, obstacleSvg, OBSTACLES } from '../game/district';
import { hideTip } from '../game/rifki';
import { SKIN_COLORS, ROOFS, skinUnlocked, skinStyle, setSkin, ACH, ensureSeason, seasonLevel, seasonReward, seasonLeft, seasonName, seasonId, seasonClaimable, claimSeason, SEASON_LV, XP_PER } from '../game/fun';
import { track } from '../game/tasks';
import { ensureTasks, taskText, taskReward, bonusReward, claimTask, claimBonus } from '../game/tasks';
import { streakStrip } from '../game/daily';
import { canHolding, sharesPreview, doHolding } from '../game/collection';
import { openShare, copyText, shareTextOnly } from '../game/share';
import { useCode } from '../game/referral';
import { persist } from '../game/persist';
import { Cloud } from '../services/cloud';
import { Purchases, adFree, instantRewards } from '../services/purchases';
import { saveTarget, boostSaving, starterActive, starterLeft, showStarter, buyTokens } from '../game/monetize';
import { Notify } from '../services/notify';
import { Ads } from '../services/ads';
import { resetGame, switchLang, switchRegion } from '../game/loop';
import { REGIONS, REGION_ORDER, REGION, RegionId, SERVER_FEATURES } from '../config';
import { REGION_INFO, wipeAllSaves } from '../storage';
import { P, savePrefs } from '../prefs';
import { chapters } from '../game/guide';
import { leagueZones, leagueName, leagueShort, weekEndsAt, fmtLeft } from '../game/league';
import { LEAGUES, LEAGUE_TOP } from '../config';
import { t, tk, nm, pctTxt, LANG, LANGS } from '../i18n';

/** Panel açar. Açık bir panelden başka panele geçilirse önceki panel geri yığınına girer (geri tuşu oraya döner);
 *  yığında zaten olan bir panele geçmek (ör. "Mülke dön", "Kılavuz") yığını o noktaya kadar geri sarar. */
export function openSheet(s: SheetState, fromBack = false) {
  const prev = ui.sheet, wasOpen = !!prev;
  if (!fromBack) {
    if (!prev) ui.sheetStack = [];
    else if (prev !== s) { const j = ui.sheetStack.findIndex(x => x.k === s.k); if (j >= 0) ui.sheetStack.length = j; else if (prev.k !== s.k) ui.sheetStack.push(prev); }
  }
  ui.openedAt = performance.now(); ui.sheet = s; ui.sheetSig = ''; renderSheet();
  const el = $('#sheet') as HTMLElement; el.inert = false; el.removeAttribute('aria-hidden'); el.classList.add('on'); $('#scrim').classList.add('on'); Snd.tap();
  if (wasOpen) el.scrollTop = 0;
  if (!wasOpen) { ui.sheetFocus = document.activeElement as HTMLElement | null; el.focus({ preventScroll: true }); }
  syncHistory();
}
export function closeSheet() {
  if (!ui.sheet) return; ui.sheet = null; ui.sheetStack = []; ui.lastClose = ui.breakAt = performance.now(); const el = $('#sheet') as HTMLElement; el.classList.remove('on'); if (!ui.modal) $('#scrim').classList.remove('on');
  const f = ui.sheetFocus; ui.sheetFocus = null; if (!ui.modal && f && f.isConnected && document.activeElement && (document.activeElement as HTMLElement).closest?.('#sheet')) f.focus({ preventScroll: true });
  el.inert = true; el.setAttribute('aria-hidden', 'true'); // kapalı panel (ekran dışı) odak/ekran okuyucuya kapalı
  syncHistory();
}
/** Geri (Android geri tuşu, tarayıcı geri, Esc): iç içe panelde bir önceki panele döner, yoksa paneli kapatır. */
export function sheetBack() { const prev = ui.sheetStack.pop(); if (prev && ui.sheet) openSheet(prev, true); else closeSheet(); }
const lvBar = (l: number) => `<div class="lv">${[1, 2, 3, 4, 5].map(k => `<i class="${k <= l ? 'on' : ''}"></i>`).join('')}</div>`;
const discBox = () => S.disc ? `<div class="disc">${small(I.tag, 16)} ${t('%{n} müteahhit indirimi', { n: Math.round(S.disc * 100) })}</div>` : '';

/* Canlı alanlar: her karede değişen sayılar (kasa, borç, haftalık kazanç, görev ilerlemesi, geri sayım) paneli
   yeniden çizmeden yalnızca bu öğelerde güncellenir. Panel imzasına (sig) yalnızca görünümü değiştiren ayrık değerler girer;
   böylece otomatik toplamada da panel 4 Hz yeniden yazılmaz ve dokunuşlar kaybolmaz. */
const LIVE: Record<string, () => string> = {};
/** Metni canlı güncellenen span (yalnızca düz metin). */
const lv = (id: string, f: () => string) => { LIVE[id] = f; return `<span data-lv="${id}">${f()}</span>`; };
/** Genişliği (yüzde) canlı güncellenen öğe için öznitelikler. */
const lw = (id: string, f: () => number) => { LIVE[id] = () => f() + '%'; return `data-lw="${id}" style="width:${f()}%"`; };
function updateLive() {
  const body = $('#sheetBody') as HTMLElement | null; if (!body) return;
  body.querySelectorAll<HTMLElement>('[data-lv]').forEach(el => { const f = LIVE[el.dataset.lv!]; if (f) { const v = f(); if (el.textContent !== v) el.textContent = v; } });
  body.querySelectorAll<HTMLElement>('[data-lw]').forEach(el => { const f = LIVE[el.dataset.lw!]; if (f) { const v = f(); if (el.style.width !== v) el.style.width = v; } });
}
/** Haritadaki 2x ipucu (saveTarget/boostSaving) birkaç saniyede bir hesaplanır. */
let hintAt = -1e9, hintV: { k: string; bs: NonNullable<ReturnType<typeof boostSaving>> } | null = null;
function mapHint() {
  const pt = performance.now();
  if (pt - hintAt > 3000 || pt < hintAt) { hintAt = pt; const tg = saveTarget(), bs = tg ? boostSaving(tg.rem) : null; hintV = tg && bs && bs.saved >= 1 ? { k: tg.k, bs } : null; }
  return hintV;
}
const lienPct = (k: string) => Math.round(100 * (1 - S.lien[k] / Math.max(S.lien[k], S.lienT[k] || S.lien[k])));

export function renderSheet() {
  const s = ui.sheet; if (!s) return;
  const tn = now(); let sig = '', html: string | undefined;
  if (s.k === 'plot') {
    const k = s.key!, i = s.i!, p = lotsOf(S, k)[i];
    if (!p) {
      sig = 'e|' + ORDER.map(b => (S.seen[b] ? 1 : 0) + '' + (S.cash >= withDisc(buildCost(k, b)) ? 1 : 0)).join() + S.disc + S.inv.join() + (lienBlocks(k) ? 'L' + (S.cash >= S.lien[k] ? 1 : 0) : '');
      if (sig !== ui.sheetSig && lienBlocks(k)) {
        html = `<div class="sh-head"><div class="sh-t"><h3>${t('Kilitli arsa')}</h3><p>${nm(DMAP[k].n)} · ${t('kaporalı semt')}</p></div></div>
          <p class="gdp">${t('Kapora ile alınan semtte {lots} arsa açık. Kalan {debt} borç {semt} kirasının yarısıyla kendiliğinden ödeniyor; bitince 20 arsanın hepsi açılır.', { lots: CFG.KAPORA_LOTS, debt: lv('ld' + k, () => fmt(S.lien[k] || 0)), semt: nm(DMAP[k].n) })}</p>
          <div class="btns"><button class="btn" data-a="payoff" ${S.cash >= S.lien[k] ? '' : 'disabled'}>${t('Borcu şimdi kapat')} · ${lv('ld' + k, () => fmt(S.lien[k] || 0))}</button></div>`;
      } else if (sig !== ui.sheetSig) {
        const short = ORDER.some(b => S.seen[b] && S.cash < withDisc(buildCost(k, b)));
        const inv = S.inv.length ? `<p class="sec">${t('Depodaki özel yapılar')}</p><div class="cards spcards">${S.inv.map(id => `<button class="bcard bpbg k-ozel" data-a="place" data-id="${id}">${svg(specialSvg(id))}<span class="bn">${t(specialOf(id).n)}</span><span class="bm">${t('Komşularına +%{n}', { n: Math.round(CFG.SP_ADJ * 100) })}</span><span class="bp">${t('Yerleştir')}</span></button>`).join('')}</div><p class="sec">${t('Yeni bina')}</p>` : '';
        html = `${discBox()}${inv}<div class="cards">${ORDER.map(b => {
          const T = TYPES[b];
          if (!S.seen[b]) return `<div class="bcard locked bpbg k-${b}">${svg(bld(b, 1))}<span class="bn">${t(T.n)}</span><span class="bl">${t('{m} kazanınca', { m: fmt(T.unlock) })}</span><span class="lk">${I.lock}</span></div>`;
          const c = withDisc(buildCost(k, b)), nb = neighborBonus(k, i, b);
          return `<button class="bcard bpbg k-${b}" data-a="build" data-t="${b}" ${S.cash >= c ? '' : 'disabled'}>${svg(bld(b, 1))}
            <span class="bn">${t(T.n)}</span><span class="bm">${t('{v}/sn', { v: fmt(T.inc * incM(k) * (1 + nb) * permMult() * districtMult(k), true) })} · ${fmtTime(buildTime(k, b))}</span><span class="bp">${fmt(c)}</span>${nb ? `<span class="chain" title="${t('Komşu bonusu')}">+${pctTxt(Math.round(nb * 100))}</span>` : ''}</button>`;
        }).join('')}</div>${short ? `<p class="note">${t('Kira toplamak için ortadaki TOPLA mührüne bas.')}</p>` : ''}`;
      }
    } else if (p.ob) {
      const c = clearCost(k), ob = OBSTACLES[p.ob];
      sig = 'ob|' + p.ob + (S.cash >= c ? 1 : 0);
      if (sig !== ui.sheetSig) {
        html = `<div class="sh-head"><div class="sh-art bpbg">${svg(obstacleSvg(p.ob))}</div><div class="sh-t"><h3>${t(ob.n)}</h3><p>${nm(DMAP[k].n)} · ${t('engelli arsa')}</p></div></div>
          <p class="gdp">${t(ob.d)} ${t('Temizlenmeden bina kurulamaz. Molozun arasından bazen eski eşyalar, nadiren tarihi bir kalıntı çıkar.')}</p>
          <div class="btns"><button class="btn lotb" data-a="clear" ${S.cash >= c ? '' : 'disabled'}><span class="lbl">${t('Temizle')} · ${fmt(c)}</span><small>${t('anında · kasaya ufak bir sürpriz')}</small></button></div>`;
      }
    } else if (p.until) {
      const nearly = p.until - tn <= CFG.SKIP_LEFT + 1e3;
      sig = 'c|' + p.t + p.lvl + (p.up ? 1 : 0) + (p.until - tn <= CFG.AD_SKIP ? 1 : 0) + (nearly ? 1 : 0);
      if (sig !== ui.sheetSig) {
        html = `<div class="sh-head k-${p.t}"><div class="sh-art bpbg" data-art></div><div class="sh-t"><h3>${t(TYPES[p.t].n)}</h3><p data-pt></p></div></div>
          <div class="cd"><span class="sec">${t('Kalan süre')}</span><span class="cdv" data-cd></span></div>
          <div class="k-${p.t}"><div class="prog"><i data-pb></i></div></div>
          <p class="note">${t('İnşaat sen oyunda değilken de sürer.')}</p>
          <div class="btns">${nearly ? `<button class="btn" disabled>${t('Bitmek üzere…')}</button>` : `<button class="btn gold" data-a="skip">${I.play} ${p.until - tn <= CFG.AD_SKIP ? t('İzle, 5 saniyeye indir') : t('İzle, 30 dk kısalt')}</button>`}<button class="txt" data-a="close">${t('Bekle')}</button></div>`;
      }
    } else {
      const canUp = p.lvl < MAXLV && !p.sp, uc = canUp ? withDisc(upCost(k, p)) : 0, afford = canUp && S.cash >= uc, a = adj(k, i), pa = pairAdj(k, i), sa = spAdj(k, i);
      const lbLeft = Math.max(0, (p.bu || 0) - tn);
      sig = 'b|' + S.tokens + p.t + p.lvl + (afford ? 1 : 0) + a + (S.boostUntil > tn ? 1 : 0) + Math.ceil(lbLeft / 60e3) + fxMult(k, i, p, tn) + S.disc + (s.del ? 1 : 0);
      if (sig !== ui.sheetSig) {
        const next = canUp ? TYPES[p.t].inc * LV_INC[p.lvl + 1] * incM(k) * (1 + neighborBonus(k, i)) * permMult() * districtMult(k) * fxMult(k, i, p, tn) * (S.boostUntil > tn ? 2 : 1) * (lbLeft > 0 ? 2 : 1) : 0;
        const sp = p.sp ? specialOf(p.sp) : null;
        html = `<div class="sh-head k-${sp ? 'ozel' : p.t}"><div class="sh-art bpbg">${svg(sp ? specialSvg(p.sp) : bld(p.t, p.lvl))}</div>
          <div class="sh-t"><h3>${sp ? t(sp.n) : t(TYPES[p.t].n)}</h3><p>${nm(DMAP[k].n)} · ${sp ? t('özel yapı') : t('Sv {l}/{m}', { l: p.lvl, m: MAXLV })}</p>${sp ? `<p class="spd">${t(sp.d)}</p>` : lvBar(p.lvl)}</div>
          <button class="iconbtn${s.del ? ' warn' : ''}" data-a="del" aria-label="${s.del ? t('Yıkmayı onayla') : t('Binayı yık')}">${I.trash}</button></div>
          ${s.del ? `<p class="sec u-tc u-m0b-4">${t('Tekrar dokunursan bina yıkılır')}</p>` : ''}
          <div class="ledger">
            <div><span>${t('Kira')}</span><i></i><b>${t('{v}/sn', { v: fmt(rate(k, i), true) })}</b></div>
            ${sp ? `<div><span>${t('Komşularına')}</span><i></i><b>${t('her yöne +%{n}', { n: Math.round(CFG.SP_ADJ * 100) })}</b></div>` : `<div><span>${t('Aynı tür komşu')}</span><i></i><b>${a ? '+' + pctTxt(Math.round(a * CFG.ADJ * 100)) : t('yok')}</b></div>
            <div><span>${t('Akıllı ikili ({ad})', { ad: t(PAIR_NAME[p.t]) })}</span><i></i><b>${pa ? '+' + pctTxt(Math.round(pa * CFG.PAIR * 100)) : t('yok')}</b></div>
            ${sa ? `<div><span>${t('Özel yapı komşusu')}</span><i></i><b>+${pctTxt(Math.round(sa * CFG.SP_ADJ * 100))}</b></div>` : ''}`}
            ${!sp && DRULES[k] && (ruleMult(k, i, p.t) > 1 || DRULES[k].kind === 'pair' && pa || DRULES[k].kind === 'speed' || DRULES[k].kind === 'upDisc') ? `<div><span>${t('Semt kuralı')} · ${t(DRULES[k].n)}</span><i></i><b>${t(DRULES[k].t).replace(/ \(.*\)/, '')}</b></div>` : ''}
            ${districtMult(k) > 1 ? `<div><span>${t('3 yıldızlı semt')}</span><i></i><b>+${pctTxt(Math.round(CFG.STAR_BONUS * 100))}</b></div>` : ''}
            ${lbLeft > 0 ? `<div><span>${t('Bu mülke 2x')}</span><i></i><b class="red">${t('{s} kaldı', { s: fmtTime(lbLeft) })}</b></div>` : ''}
            ${S.boostUntil > tn ? `<div><span>${t('Tüm mülklere 2x')}</span><i></i><b class="red">${t('{s} kaldı', { s: fmtTime(S.boostUntil - tn) })}</b></div>` : ''}
            ${canUp ? `<div><span>${t('Sv {l} olunca', { l: p.lvl + 1 })}</span><i></i><b>${t('{v}/sn', { v: fmt(next, true) })}</b></div>` : ''}
          </div>${sp ? '' : nbDiagram(k, i)}${canUp ? discBox() : ''}
          <div class="btns">${canUp ? `<button class="btn" data-a="up" ${afford ? '' : 'disabled'}>${t('Kat çık')} · ${fmt(uc)} <small>${fmtTime(upTime(k, p))}</small></button>` : sp ? '' : `<button class="btn" disabled>${t('Son seviye')}</button>`}
          <button class="btn gold lotb" data-a="lotboost" ${lbLeft > CFG.LOT_BOOST_MAX - CFG.LOT_BOOST / 2 ? 'disabled' : ''}><span class="lbl">${I.play} ${t('İzle · bu mülke 2x')}</span><small>${t('+1 saat')}${lbLeft ? ' · ' + t('en fazla 4 saat') : ''}</small></button>
          ${S.tokens > 0 ? `<button class="btn soft" data-a="token" ${lbLeft > CFG.LOT_BOOST_MAX - CFG.LOT_BOOST / 2 ? 'disabled' : ''}>${t('2x jetonu kullan · {n} jeton', { n: S.tokens })}</button>` : ''}
          <button class="txt" data-a="skin">${t('Görünümü değiştir')}</button></div>`;
      }
    }
  }
  else if (s.k === 'map') {
    const hint = mapHint();
    sig = 'm|' + (hint ? hint.k + Math.round(hint.bs.saved) + hint.bs.lot.k + hint.bs.lot.i + instantRewards() : '') + Object.keys(S.lien).map(k => k + (S.cash >= S.lien[k] ? 1 : 0)).join() + JSON.stringify(S.stars) + goalsOf(S.cur).map(g => g.f(S.cur).join('/')).join() + S.cur + S.own.join() + S.own.map(filled).join() + CITY_ORDER.map(c => CITIES[c].districts.map((_, i) => { const k = dkey(c, i), u = unlockInfo(k); return (u.ok ? 1 : 0) + '' + (S.cash >= u.fee ? 1 : 0) + (u.ok && S.cash >= kaporaOf(k) ? 1 : 0); }).join('')).join();
    if (sig !== ui.sheetSig) {
      const start = S.city || 'ist';
      const order = [start, ...CITY_ORDER.filter(c => c !== start)];
      let anyShort = false;
      html = goalsCard(S.cur) + `<p class="sec">${t('Portföy · {n} il', { n: citiesOwned() })}${portfolioBonus() ? ' · ' + t('kiralar +%{n}', { n: Math.round(portfolioBonus() * 100) }) : ''}</p>` + order.map(c => {
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
            const af = S.cash >= u.fee, kap = kaporaOf(k), kf = S.cash >= kap; if (!af) anyShort = true;
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
    }
  }
  else if (s.k === 'set') {
    const acct = Cloud.account();
    sig = 's|' + LANG + REGION + JSON.stringify(REGION_INFO) + S.night + S.rifki + S.collectMode + S.sound + S.notif + S.premium + S.noAds + S.club + (s.reset ? 1 : 0) + (s.del ? 1 : 0) + JSON.stringify(acct) + Ads.privacyRequired();
    if (sig !== ui.sheetSig) {
      const regRow = (r: RegionId) => { const R = REGIONS[r], cur = r === REGION, inf = REGION_INFO[r];
        const st = cur ? t('şu an oynanıyor') : inf ? t('kayıtlı · {n} semt', { n: inf.own }) : t('başlanmadı');
        return `<button class="cm${cur ? ' on' : ''}" data-a="region" data-r="${r}"><span class="rd"></span><span class="di"><b>${t(R.n)} · ${R.cur}</b><small>${R.cities.map(c => nm(CITIES[c].n)).join(' · ')} · ${st}</small></span></button>`; };
      html = `<p class="sec">${t('Dil ve bölge')}</p>
        <div class="langs">${LANGS.map(l => `<button class="chip${l.id === LANG ? ' on' : ''}" data-a="lang" data-l="${l.id}" lang="${l.id}" aria-pressed="${l.id === LANG}">${l.n}</button>`).join('')}</div>
        <div class="cmode">${REGION_ORDER.map(regRow).join('')}</div>
        <p class="note">${t('Her bölgenin ilerlemesi, tapuları ve sırası ayrıdır. Dil yalnızca metinleri değiştirir; şehirleri ve para birimini bölge belirler. Satın aldığın paketler tüm bölgelerde geçerli.')}</p>
        <p class="sec u-mt-7">${t('Nasıl oynanır')}</p>
        <ul class="rules">
          <li>${t('<b>Arsaya dokun</b>, inşaatı başlat. Bina kat kat yükselir.')}</li>
          <li>${t('Kira binaların kumbarasında birikir; ortadaki <b>TOPLA</b> mührüyle hepsini tek seferde al (ya da aşağıdan otomatiğe geç).')}</li>
          <li>${t('Kumbara dolunca kira birikmeyi bırakır. <b>Sık uğra.</b>')}</li>
          <li>${t('Aynı türü <b>yan yana</b> kur; bahçeler, teraslar birleşir ve daha çok kazandırır.')}</li>
          <li>${t('Semti doldur, <b>yeni semtin tapusunu</b> al. Başka illerde de arsa alabilirsin.')}</li>
        </ul>
        <div class="btns u-pull"><button class="btn soft" data-a="guide">${t('Kılavuzun tamamı')}</button></div>
        <p class="sec u-mt-2">${t('Kira toplama')}</p>
        <div class="cmode">
          <button class="cm${S.collectMode === 'tap' ? ' on' : ''}" data-a="cm-tap"><span class="rd"></span><span class="di"><b>${t('Tek tuşla topla')}</b><small>${t('Ortadaki TOPLA mührüne bas, bütün semtlerdeki kira tek seferde kasana geçsin.')}</small></span></button>
          <button class="cm${S.collectMode === 'auto' ? ' on' : ''}" data-a="cm-auto"><span class="rd"></span><span class="di"><b>${t('Otomatik')}</b><small>${t('Oyun açıkken kira kendiliğinden kasana akar.')}</small></span></button>
        </div>
        <div class="srow"><span>${t('Gece görünümü (19:00–06:00)')}</span><button class="sw${S.night !== false ? ' on' : ''}" role="switch" aria-checked="${!!(S.night !== false)}" data-a="night" aria-label="${t('Gece görünümü')}"></button></div>
        <div class="srow"><span>${t('Rıfkı Abi’nin ipuçları')}</span><button class="sw${S.rifki ? ' on' : ''}" role="switch" aria-checked="${!!(S.rifki)}" data-a="rifki" aria-label="${t('Rıfkı Abi’nin ipuçları')}"></button></div>
        <div class="srow"><span>${t('Ses')}</span><button class="sw${S.sound ? ' on' : ''}" role="switch" aria-checked="${!!(S.sound)}" data-a="sound" aria-label="${t('Ses')}"></button></div>
        <div class="srow"><span>${t('Bildirimler')}</span><button class="sw${S.notif ? ' on' : ''}" role="switch" aria-checked="${!!(S.notif)}" data-a="notif" aria-label="${t('Bildirimler')}"></button></div>
        <div class="srow"><span>${t('Reklamlar')}</span><span>${S.premium ? t('Kapalı (Holding paketi)') : S.club ? t('Kapalı (Emlak Kulübü)') : S.noAds ? t('Yalnızca isteğe bağlı (Reklamsız)') : Ads.native() ? t('Açık') : t('Test modu')}</span></div>
        <p class="sec u-mt-9">${t('Hesap ve kayıt')}</p>
        <div class="srow"><span>${t('Oyuncu kodun')}</span><span>${S.ref.code}</span></div>
        <div class="srow"><span>${t('Kayıt')}</span><span>${acct.enabled ? (acct.linked ? t('{p} hesabına bağlı', { p: esc(acct.provider) }) : t('Misafir · bulutta yedekleniyor')) : t('Bu cihazda')}</span></div>
        <div class="acct">
          ${acct.enabled && !acct.linked ? `<button class="btn soft" data-a="link-google">${t('Google ile bağla')}</button>${acct.apple ? `<button class="btn soft" data-a="link-apple">${t('Apple ile bağla')}</button>` : ''}` : ''}
          ${Ads.privacyRequired() ? `<button class="linkbtn" data-a="ads-privacy">${t('Reklam izinlerini yönet')}</button>` : ''}
          <button class="linkbtn" data-a="privacy">${t('Gizlilik politikası ve KVKK aydınlatma metni')}</button>
          ${acct.enabled ? `<button class="linkbtn u-stamp" data-a="delete">${s.del ? t('Emin misin? Hesabın ve tüm verilerin silinir') : t('Hesabımı ve verilerimi sil')}</button>` : ''}
        </div>
        <button class="txt u-stamp" data-a="reset">${s.reset ? t('Emin misin? Tekrar dokun') : t('Oyunu sıfırla')}</button>`;
    }
  }
  else if (s.k === 'menu') {
    sig = 'mn|' + starterActive() + S.noAds + S.club + S.ach.length + seasonLevel() + seasonClaimable() + S.league.tier + canHolding() + S.premium + (S.shares || 0) + (canHolding() ? sharesPreview() : '') + ozelAvail();
    if (sig !== ui.sheetSig) {
      const row = (a: string, ic: string, b: string, sm: string, dot = false) => `<button class="drow" data-a="${a}"><span class="ic">${ic}${dot ? '<span class="dot"></span>' : ''}</span><span class="di"><b>${b}</b><small>${sm}</small></span></button>`;
      html = `<p class="sec">${t('Menü')}</p><div class="dlist">
        ${row('share', I.share, t('Şehrini paylaş'), t('Story görseli, davet kodunla'))}
        ${!SERVER_FEATURES ? '' : row('lb', I.trophy, t('Haftalık lig'), `${leagueName(S.league.tier)} · ${t('bu hafta {m}', { m: lv('wk', () => fmt(S.week.earned)) })}`)}
        ${!SERVER_FEATURES ? '' : row('ref', I.users, t('Arkadaşını davet et'), t('Kodun: {c}', { c: S.ref.code }))}
        ${row('sezon', I.crown, t('Tapu sezonu'), `${seasonName(seasonId())} · ${t('basamak {l}/{m}', { l: seasonLevel(), m: SEASON_LV })}${S.season && S.season.gold ? ' · ' + t('Altın') : ''}`, seasonClaimable())}
        ${row('arsiv', I.trophy, t('Tapu arşivi'), t('{n}/{m} mühür · kira +%{p}', { n: S.ach.length, m: ACH.length, p: Math.floor(S.ach.length / 4) }))}
        ${row('ozel', I.tower, t('Haftanın özel tapusu'), ozelAvail() ? t('{ad} satışta', { ad: t(weekSpecial(weekKey(new Date(tn))).n) }) : t('{ad} alındı', { ad: t(weekSpecial(weekKey(new Date(tn))).n) }), ozelAvail())}
        ${starterActive() ? row('starter', I.crown, t('Başlangıç paketi'), t('Yalnızca bir kez · bitiş {c}', { c: lv('stl', () => clock(starterLeft())) }), true) : ''}
        ${row('store', I.noads, t('Mağaza'), S.premium ? t('Holding paketi aktif') : S.club ? t('Emlak Kulübü aktif') : S.noAds ? t('Reklamsız aktif · jetonlar, sezon') : t('Reklamsız, Holding, Kulüp, jetonlar'))}
        ${row('holding', I.tower, t('Holding kur'), canHolding() ? t('{n} hisse hazır', { n: sharesPreview() }) : S.shares ? t('{n} hisse · kiralar {x}', { n: S.shares, x: fmtX(1 + 0.1 * S.shares) }) : t('Bir ilin 5. semtini alınca açılır'), canHolding())}
        ${row('set', I.gear, t('Ayarlar'), t('Ses, bildirim, hesap, gizlilik'))}
      </div>`;
    }
  }
  else if (s.k === 'tasks') {
    ensureTasks(); const T = S.tasks!, d = S.daily, today = dayKey(new Date(tn)), done = d.last === today;
    const broken = d.last && !done && dayDiff(d.last, today) > 1, nextDay = broken ? 1 : (d.streak % 7) + 1, pos = done ? ((d.streak - 1) % 7) + 1 : nextDay;
    sig = 'tk|' + T.day + T.bonus + T.list.map(q => q.k + q.goal + q.claimed + (q.prog >= q.goal ? 1 : 0)).join() + d.last + d.streak + (S.offer ? S.offer.title + S.offer.goal + S.offer.prog + S.offer.done : '');
    if (sig !== ui.sheetSig) {
      html = `<p class="sec">${t('Kira günü serisi')}</p>${streakStrip(done ? 0 : pos, done ? pos : pos - 1)}
        <p class="note u-mt-3">${done ? t('{n} gündür uğruyorsun. Yarın {g}. günün ödülü hazır olacak.', { n: d.streak, g: (d.streak % 7) + 1 }) : t('Bugünün ödülü seni bekliyor.')}</p>
        ${done ? '' : `<div class="btns"><button class="btn gold" data-a="daily">${t('Bugünün ödülünü al')}</button></div>`}
        <p class="sec u-mt-10">${t('Günlük görevler')}</p>
        ${T.list.map((q, i) => `<div class="task"><div class="tt"><b>${taskText(q)}</b><small>${lv('tp' + i, () => { const x = S.tasks?.list[i]; return !x ? '' : x.k === 'earn' ? fmt(x.prog) + ' / ' + fmt(x.goal) : x.prog + ' / ' + x.goal; })} · ${t('Ödül {m}', { m: fmt(taskReward()) })}</small><div class="tbar"><i ${lw('tb' + i, () => { const x = S.tasks?.list[i]; return x ? Math.round(Math.min(100, x.prog / x.goal * 100)) : 0; })}></i></div></div>
          <button class="chip${q.claimed ? ' got' : ''}" data-a="claim" data-i="${i}" ${q.claimed || q.prog < q.goal ? 'disabled' : ''}>${q.claimed ? t('Alındı') : t('Al')}</button></div>`).join('')}
        <div class="task"><div class="tt"><b>${t('Üçünü de bitir')}</b><small>${t('{m} + tüm mülklere 2x · 1 saat', { m: fmt(bonusReward()) })}</small></div><button class="chip${T.bonus ? ' got' : ''}" data-a="bonus" ${T.bonus || !T.list.every(q => q.claimed) ? 'disabled' : ''}>${T.bonus ? t('Alındı') : t('Al')}</button></div>
        ${S.offer && !S.offer.done ? `<p class="sec u-mt-10">${t('Süreli fırsat')}</p><div class="task"><div class="tt"><b>${t(S.offer.title)}</b><small>${S.offer.prog} / ${S.offer.goal} · ${t('Ödül {m} + 30 dk 2x', { m: fmt(S.offer.rw) })}</small><div class="tbar"><i style="width:${S.offer.prog / S.offer.goal * 100}%"></i></div></div></div>` : ''}`;
    }
  }
  else if (s.k === 'coll') {
    sig = 'co|' + S.coll.join();
    if (sig !== ui.sheetSig) {
      html = `<p class="sec">${t('Tarihi yapılar')} · ${S.coll.length}/${LM.length}</p>
        <p class="note u-m0b-6">${t('Her yapı tüm kiraları kalıcı %5 artırır, hepsini toplayana ek %10. Etkinliklerden ve altın taksiden çıkar. Şu an <b>+%{p}</b>.', { p: Math.round(collBonus() * 100) })}</p>
        <div class="coll">${LM.map(l => { const has = S.coll.includes(l.id); return `<div class="lmc bpbg${has ? '' : ' no'}">${svg(lmSvg(l.id))}<b>${has ? t(l.n) : t('Bulunmadı')}</b></div>`; }).join('')}</div>`;
    }
  }
  else if (s.k === 'lb') {
    // tasarım: L1 · haftalık lig tablosu
    if (!s.req) { s.req = true; s.v = undefined; Cloud.league().then(v => { s.v = v; ui.sheetSig = ''; }).catch(() => { s.v = null; ui.sheetSig = ''; }); }
    const left = fmtLeft(weekEndsAt(tn) - tn), v = s.v;
    sig = 'lb|' + (v === undefined ? '-' : v ? v.rows.length + ':' + v.myRank + ':' + v.tier : 'x') + Cloud.ready() + left;
    if (sig !== ui.sheetSig) {
      const tier = v ? v.tier : S.league.tier, wk = (S.week.key || '').split('H')[1] || '';
      const head = `<div class="lghead"><div><p class="sec">${t('Haftalık lig')}${wk ? ' · ' + t('{n}. hafta', { n: +wk }) : ''}</p>
        <h4 class="lgt">${leagueName(tier)}${v && v.group !== 'onizleme' ? ` · ${t('grup {g}', { g: esc(v.group.slice(-3).toUpperCase()) })}` : ''}</h4>
        <small class="lgsub">${v ? t('{n} emlakçı', { n: v.size }) + ' · ' : ''}${t('bitişe {s}', { s: left })}</small></div>${leagueSeal(tier)}</div>`;
      let list = '';
      if (!Cloud.ready()) list = `<p class="note u-mt0">${t('Lig internet bağlantısıyla çalışır. Bu hafta <b>{m}</b> kira topladın; bağlanınca grubuna katılırsın.', { m: lv('wk', () => fmt(S.week.earned)) })}</p>`;
      else if (v === undefined) list = `<p class="note u-mt0">${t('Grubun yükleniyor…')}</p>`;
      else if (!v) list = `<p class="note u-mt0">${t('Bu hafta grubuna henüz yerleşmedin. Biraz kira topla; ilk skorunla sana yakın 30 emlakçılık gruba katılırsın.')}</p>`;
      else {
        const z = leagueZones(v.size, v.tier), parts: string[] = [];
        v.rows.forEach((r: any, i: number) => {
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
      html = `${head}${list}${chips}
        <div class="btns"><button class="btn soft" data-a="leagues">${t('Ligler ve kurallar')}</button><button class="txt" data-a="ref">${I.users} ${t('Arkadaşını davet et')}</button></div>`;
    }
  }
  else if (s.k === 'skin') {
    // tasarım: H6 · cephe
    const k = s.key!, i = s.i!, p = lotsOf(S, k)[i];
    sig = 'sk|' + JSON.stringify(p && p.sk) + S.ach.length + S.skinsU.join();
    if (p && sig !== ui.sheetSig) {
      const sk = p.sk || {}, name = p.sp ? specialOf(p.sp).n : TYPES[p.t].n;
      html = `<div class="sh-head k-${p.sp ? 'ozel' : p.t}"><div class="sh-art bpbg" style="${skinStyle(p)}">${svg(p.sp ? specialSvg(p.sp) : bld(p.t, Math.max(1, p.lvl)))}</div><div class="sh-t"><h3>${t('Görünümü seç')}</h3><p>${t(name)} · ${t('yalnızca görünüm, kira değişmez')}</p></div></div>
        <p class="sec">${t('Cephe rengi')}</p><div class="skc">${SKIN_COLORS.map((c, n) => `<button class="sw2${(sk.c ?? -1) === n ? ' on' : ''}${skinUnlocked(n) ? '' : ' lk'}" data-a="sc" data-n="${n}" style="background:${c.f}" aria-label="${t(c.n)}${skinUnlocked(n) ? '' : ' (' + t('kilitli: {s}', { s: t(c.lock!) }) + ')'}">${skinUnlocked(n) ? '' : I.lock}</button>`).join('')}<button class="sw2 none${sk.c == null ? ' on' : ''}" data-a="sc" data-n="-1" aria-label="${t('Varsayılan')}">×</button></div>
        ${p.t === 'ev' && !p.sp ? `<p class="sec">${t('Çatı')}</p><div class="skr">${ROOFS.map((r, n) => `<button class="rf2b${(sk.r || 0) === n ? ' on' : ''}" data-a="sr" data-n="${n}"><i style="background:${r.rf || 'var(--rf)'}"></i>${t(r.n)}</button>`).join('')}</div>` : ''}
        <div class="srow"><span>${t('Tabela')}</span><button class="sw${sk.s ? ' on' : ''}" role="switch" aria-checked="${!!(sk.s)}" data-a="ss" aria-label="${t('Tabela')}"></button></div>
        <p class="note">${t('Kilitli renkler tapu arşivinden ve tapu sezonundan açılır.')}</p>
        <div class="btns"><button class="btn soft" data-a="back">${t('Mülke dön')}</button></div>`;
    }
  }
  else if (s.k === 'arsiv') {
    // tasarım: H4 · tapu arşivi
    sig = 'ar|' + S.ach.join() + (s.sel || '');
    if (sig !== ui.sheetSig) {
      const n = S.ach.length, sel = ACH.find(a => a.id === s.sel);
      html = `<div class="lghead"><div><p class="sec">${t('Tapu arşivi · {n}/{m} mühür', { n, m: ACH.length })}</p><h4 class="lgt">${t('Emlakçının albümü')}</h4></div><span class="arb">${t('kira +%{p}', { p: Math.floor(n / 4) })}</span></div>
        <span class="dp u-mb-6"><u class="u-bg-stamp" style="width:${Math.round(n / ACH.length * 100)}%"></u></span>
        <div class="argrid">${ACH.map((a, j) => `<button class="arst${S.ach.includes(a.id) ? ' on' : ''}${s.sel === a.id ? ' sel' : ''}" data-a="arsel" data-id="${a.id}" style="--rot:${[-8, 6, -4, 9, -6, 4][j % 6]}deg">${t(a.n)}</button>`).join('')}</div>
        <div class="ardet">${sel ? `<b>${t(sel.n)}</b><span>${t(sel.d)}</span><em>${S.ach.includes(sel.id) ? t('Kazanıldı') : t('Henüz kazanılmadı')}</em>` : t('Bir mühre dokun: nasıl kazanılacağını gör.')}</div>
        <p class="note">${t('Her 4 mühür tüm kiralara kalıcı +%1. 8 ve 16 mühürde yeni cephe renkleri açılır.')}</p>`;
    }
  }
  else if (s.k === 'sezon') {
    // tasarım: H8 · tapu sezonu
    ensureSeason(); const lv = seasonLevel(), sv = S.season;
    sig = 'se|' + S.seasonFirst + sv.id + sv.xp + sv.got.length + sv.ggot.length + sv.gold + Math.floor(seasonLeft() / 3600e3);
    if (sig !== ui.sheetSig) {
      const from = Math.max(1, Math.min(SEASON_LV - 5, lv - 1)), cols = Array.from({ length: 6 }, (_, q) => from + q);
      const cell = (l: number, gold: boolean) => { const r = seasonReward(l, gold), got = (gold ? sv.ggot : sv.got).includes(l), ready = l <= lv && !got && (!gold || sv.gold); return `<span class="sc ${gold ? 'g' : ''}${got ? ' got' : ready ? ' rd' : ''}${l > lv || (gold && !sv.gold) ? ' lk' : ''}">${r.label}</span>`; };
      html = `<div class="lghead"><div><p class="sec">${t('Tapu sezonu')} · ${seasonName(sv.id)}</p><h4 class="lgt">${t('Basamak {l} / {m}', { l: lv, m: SEASON_LV })}</h4><small class="lgsub u-stamp">${t('Sezon bitişi {s}', { s: fmtLeft(seasonLeft()) })}</small></div><span class="gseal">${t('ALTIN<br>TAPU')}</span></div>
        <span class="dp"><u style="width:${lv >= SEASON_LV ? 100 : Math.round((sv.xp % XP_PER) / XP_PER * 100)}%"></u></span>
        <small class="lgsub">${lv >= SEASON_LV ? t('Sezon tamamlandı!') : t('{n} / {m} puan', { n: sv.xp % XP_PER, m: XP_PER })} · ${t('kira topla, görev bitir, kat çık, ligde yüksel')}</small>
        <div class="sgrid"><span class="sl"></span>${cols.map(l => `<span class="sn${l === lv ? ' cur' : ''}">${l}</span>`).join('')}
          <span class="sl">${t('ÜCRETSİZ')}</span>${cols.map(l => cell(l, false)).join('')}
          <span class="sl g">${t('ALTIN')}</span>${cols.map(l => cell(l, true)).join('')}</div>
        <div class="btns"><button class="btn gold" data-a="sclaim" ${seasonClaimable() ? '' : 'disabled'}>${t('Ödülleri al')}</button></div>
        ${sv.gold ? `<p class="note u-tc">${t('Altın Tapu bu sezon açık · her basamakta ek ödül')}</p>` : `<div class="gbox"><span><b>${t('Altın Tapu')}</b><small>${t('Her basamakta ek ödül, sezona özel altın cephe ve 30. basamakta özel yapı.')}</small></span><button class="btn gprice" data-a="sgold">${!S.seasonFirst ? `<s>${Purchases.seasonFull()}</s>` : ''}${Purchases.seasonPrice()}</button></div>`}
        <p class="note">${t('Ödüller: nakit, 2x jetonu (bir mülke reklamsız 1 saat 2x), cephe renkleri; 30. basamakta büyük ödül. Her ayın başında yeni sezon.')}</p>`;
    }
  }
  else if (s.k === 'ozel') {
    // tasarım: F5 · haftanın özel tapusu
    const wk = weekKey(new Date(tn)), sp = weekSpecial(wk), price = specialPrice(), got = S.ozel.week === wk && S.ozel.bought;
    sig = 'oz|' + wk + got + (S.cash >= price ? 1 : 0) + Math.floor(price) + Math.floor((weekEndsAt(tn) - tn) / 3600e3) + S.inv.join();
    if (sig !== ui.sheetSig) {
      html = `<div class="lghead"><div><p class="sec">${t('Haftanın özel tapusu')}</p><h4 class="lgt">${t(sp.n)}</h4><small class="lgsub u-stamp">${t('Satış bitişi {s}', { s: fmtLeft(weekEndsAt(tn) - tn) })}</small></div><span class="st spst">${t('NADİR')}</span></div>
        <div class="spart bpbg">${svg(specialSvg(sp.id), 'art')}</div>
        <p class="gdp">${t('{d}. Boş bir arsaya yerleştirilir; kat çıkılmaz ama tek başına çok kazandırır.', { d: t(sp.d) })}</p>
        <div class="lgrw"><div><span>${t('Kira')}</span><b>${t('semtteki en iyi binanın 3 katı')}</b></div><div><span>${t('Komşularına')}</span><b>${t('her yöne +%{n}', { n: Math.round(CFG.SP_ADJ * 100) })}</b></div><div><span>${t('Kat çıkma')}</span><b>${t('yok · tek seviye')}</b></div><div><span>${t('Holding kurunca')}</span><b>${t('depoda kalır')}</b></div></div>
        <div class="btns">${got ? `<button class="btn" disabled>${t('Bu haftanın tapusu alındı')}</button>` : `<button class="btn lotb" data-a="buyozel" ${S.cash >= price ? '' : 'disabled'}><span class="lbl">${t('Tapuyu al')} · ${fmt(price)}</span><small>${t('sonra boş bir arsaya yerleştir')}</small></button>`}</div>
        ${S.inv.length ? `<p class="note">${t('Depoda {n} özel yapı var: boş bir arsaya dokunup yerleştir.', { n: S.inv.length })}</p>` : ''}
        <p class="note u-tc">${t('Her hafta farklı bir yapı: Han, Pasaj, Yalı Köşkü, Bahçeli Köşk.')}</p>`;
    }
  }
  else if (s.k === 'guide') {
    // tasarım: K3 · konu listesi
    sig = 'gd';
    if (sig !== ui.sheetSig) {
      const C = chapters();
      html = `<div class="lghead"><div><p class="sec">${t('Kılavuz · {n} madde', { n: C.length })}</p><h4 class="lgt">${t('Emlakçının el kitabı')}</h4>
        <small class="gdsub">${t('Oyunun tüm kuralları, sayılarıyla. İstediğin maddeye dokun.')}</small></div>
        <svg class="lgseal" viewBox="0 0 100 100" aria-hidden="true"><g transform="rotate(-9 50 50)"><circle cx="50" cy="50" r="44" fill="none" stroke="currentColor" stroke-width="3.5"/><circle cx="50" cy="50" r="36" fill="none" stroke="currentColor" stroke-width="1.2"/><text x="50" y="62" text-anchor="middle" font-family="IBM Plex Mono" font-weight="600" font-size="38" fill="currentColor">?</text></g></svg></div>
        <div class="gdlist">${C.map((c, i) => `<button class="gditem" data-a="open" data-i="${i}"><span class="no">${String(i + 1).padStart(2, '0')}</span><span class="di"><b>${t(c.t)}</b><small>${t(c.s)}</small></span>${c.isNew ? `<span class="st">${t('YENİ')}</span>` : ''}<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg></button>`).join('')}</div>`;
    }
  }
  else if (s.k === 'guideItem') {
    // tasarım: K4 · konu sayfası
    const C = chapters(), i = Math.max(0, Math.min(C.length - 1, s.i || 0)), c = C[i], no = (n: number) => String(n + 1).padStart(2, '0');
    sig = 'gi|' + i;
    if (sig !== ui.sheetSig) {
      html = `<button class="gdback" data-a="list"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>${t('Kılavuz')}</button>
        <div class="gdhead"><div><p class="sec gdno">${t('Madde {n}', { n: no(i) })}</p><h4 class="lgt">${t(c.t)}</h4></div><div class="gdart bpbg">${c.art()}</div></div>
        ${c.body.map(b => `<p class="gdp">${b}</p>`).join('')}
        <div class="lgrw gdfacts">${c.facts.map(([k, v]) => `<div><span>${k}</span><b>${v}</b></div>`).join('')}</div>
        ${c.tip ? `<div class="gdtip"><span class="st">${t('İPUCU')}</span><span>${c.tip}</span></div>` : ''}
        <div class="gdnav">${i > 0 ? `<button class="gdprev" data-a="prev"><small>← ${t('Madde {n}', { n: no(i - 1) })}</small><b>${t(C[i - 1].t)}</b></button>` : '<span></span>'}${i < C.length - 1 ? `<button class="gdnext" data-a="next"><small>${t('Madde {n}', { n: no(i + 1) })} →</small><b>${t(C[i + 1].t)}</b></button>` : '<span></span>'}</div>`;
    }
  }
  else if (s.k === 'leagues') {
    // tasarım: L3 · lig basamakları
    sig = 'lg|' + S.league.tier;
    if (sig !== ui.sheetSig) {
      const rule = (i: number) => i === LEAGUE_TOP ? t('Zirve · ilk 3 haftanın mührünü alır') : i === 0 ? t('Başlangıç · düşme yok') : t('İlk 5 yükselir · son 5 düşer');
      html = `<p class="sec">${t('Ligler · yükseldikçe bina büyür')}</p><div class="lgtiers">
        ${LEAGUES.map((_, i) => LEAGUE_TOP - i).map(i => `<div class="lgtier${i === S.league.tier ? ' here' : ''}">${tierArt(i)}<span class="di"><b>${leagueName(i)}</b><small>${rule(i)}</small></span>${i === S.league.tier ? `<span class="st">${t('BURADASIN')}</span>` : ''}</div>`).join('')}</div>
        <div class="lgrules"><p class="sec">${t('Nasıl işler')}</p>
        <p>${t('Her pazartesi 30 kişilik yeni grup kurulur; kazancı sana yakın oyuncularla eşleşirsin.')}</p>
        <p>${t('Puan, o hafta topladığın kiradır. Hafta pazar gecesi biter, sonucun ilk girişte gelir.')}</p>
        <p>${t('Uğramayan oyuncu gruba alınmaz; gruplar hep canlı kalır.')}</p>${S.league.seals ? `<p>${t('Zirve mührün: <b>{n}</b>', { n: S.league.seals })}</p>` : ''}</div>
        <div class="btns"><button class="btn soft" data-a="back">${t('Lig tablosuna dön')}</button></div>`;
    }
  }
  else if (s.k === 'ref') {
    sig = 'rf|' + S.ref.used + S.ref.code;
    if (sig !== ui.sheetSig) {
      html = `<p class="sec">${t('Davet kodun')}</p><div class="codebox"><b>${S.ref.code}</b><button class="chip" data-a="copy">${t('Kopyala')}</button></div>
        <div class="btns u-mt0"><button class="btn gold" data-a="sharetext">${I.share} ${t('Davet mesajı gönder')}</button></div>
        <p class="note">${t('Arkadaşın senin kodunu girince ikinize de tapu hediyesi (nakit) verilir.')}</p>
        <p class="sec u-mt-10">${t('Arkadaşının kodu')}</p>
        ${S.ref.used ? `<p class="note u-mt0">${t('Kullandığın kod: <b>{c}</b>', { c: esc(S.ref.used) })}</p>` : `<div class="row2"><input id="refInput" class="inp" maxlength="6" placeholder="TP0000" autocomplete="off" autocapitalize="characters" spellcheck="false" aria-label="${t('Arkadaşının davet kodu')}"><button class="chip" data-a="usecode">${t('Kullan')}</button></div>`}`;
    }
  }
  else if (s.k === 'store') {
    // tasarım M6–M7: üç basamak + jetonlar + Altın Tapu
    sig = 'st|' + S.premium + S.noAds + S.club + S.tokens + S.seasonFirst + (S.season && S.season.gold) + starterActive() + Purchases.price('holding') + Purchases.price('reklamsiz');
    if (sig !== ui.sheetSig) {
      const li = (ok: boolean, x: string) => `<li class="${ok ? '' : 'no'}">${ok ? I.check : '–'}<span>${x}</span></li>`;
      const tier = (key: string, name: string, items: [boolean, string][], price: string, own: boolean, tag = '', best = false, sub = '') =>
        `<div class="tier${best ? ' best' : ''}">${tag ? `<span class="ttag">${tag}</span>` : ''}<div class="tl"><b>${name}</b><ul>${items.map(([o, x]) => li(o, x)).join('')}</ul></div>
          ${own ? `<button class="btn" disabled>${t('Aktif')}</button>` : `<button class="btn${best ? ' gold' : ''}" data-a="buyp" data-p="${key}">${price}${sub ? `<small>${sub}</small>` : ''}</button>`}</div>`;
      const ss = S.season && S.season.gold;
      html = `<div class="sh-head"><div class="badge u-m0">${I.crown}</div><div class="sh-t"><h3>${t('Mağaza')}</h3><p>${t('Oyun aynı; yalnızca reklam ve hız tercihi')}</p></div></div>
        ${starterActive() ? `<button class="drow starterrow" data-a="starter"><span class="ic">${I.crown}<span class="dot"></span></span><span class="di"><b>${t('Başlangıç paketi')}</b><small>${t('Yalnızca bir kez · bitiş {c}', { c: lv('stl', () => clock(starterLeft())) })}</small></span><span class="pr">${Purchases.price('baslangic')}</span></button>` : ''}
        <p class="sec">${t('Paketler')}</p>
        ${tier('reklamsiz', t('Reklamsız'), [[true, t('Geçiş reklamı yok')], [true, t('Ödüllü reklamlar isteğe bağlı, ödül verir')], [false, t('Ödüller anında')], [false, t('Kalıcı 2x kira')]], Purchases.price('reklamsiz'), adFree())}
        ${tier('holding', t('Holding paketi'), [[true, t('Geçiş reklamı yok')], [true, t('Ödüller izlemeden, anında')], [true, t('Tüm kiralar kalıcı 2 kat')]], Purchases.price('holding'), S.premium, t('EN ÇOK DEĞER'), true)}
        ${tier('kulup', t('Emlak Kulübü'), [[true, t('Geçiş reklamı yok')], [true, t('Ödüller anında')], [true, t('Her gün 1 adet 2x jetonu')], [true, t('Altın Tapu sezonu dahil')], [false, t('Kalıcı 2x kira')]], Purchases.price('kulup'), S.club, t('ABONELİK'), false, t('/ay'))}
        ${S.club ? '' : `<p class="note subnote">${t('Emlak Kulübü aylık otomatik yenilenen bir aboneliktir. Ödeme, satın almayı onayladığında mağaza hesabından alınır; dönem bitmeden en az 24 saat önce iptal edilmezse aynı fiyatla yenilenir. Aboneliğini mağaza hesap ayarlarından yönetebilir ve iptal edebilirsin.')} <button class="linkbtn" data-a="privacy">${t('Gizlilik politikası')}</button> · <button class="linkbtn" data-a="terms">${t('Kullanım koşulları')}</button></p>`}
        <p class="sec">${t('2x jetonu · reklamsız 1 saat 2x')}</p>
        <div class="jets"><div class="jet"><span class="h2c">2x</span><b>× 5</b><small>${t('5 saat 2x')}</small><button class="btn" data-a="jet" data-n="5">${Purchases.price('jeton5')}</button></div>
          <div class="jet best"><span class="ttag">${t('%25 KÂR')}</span><span class="h2c">2x</span><b>× 15</b><small>${t('15 saat 2x')}</small><button class="btn gold" data-a="jet" data-n="15">${Purchases.price('jeton15')}</button></div></div>
        <p class="note">${t('Elindeki jeton: <b>{n}</b>. Jeton, mülk panelindeki “2x jetonu kullan” düğmesiyle harcanır.', { n: S.tokens })}</p>
        <p class="sec">${t('Tapu sezonu')}</p>
        ${ss ? `<p class="note u-tc">${t('Altın Tapu bu sezon açık')}${S.club ? ' · ' + t('Kulüp ile dahil') : ''}</p>` : `<div class="gbox"><span><b>${t('Altın Tapu')}</b><small>${!S.seasonFirst ? t('İlk sezonuna özel yarı fiyat.') + ' ' : ''}${t('Her basamakta ek ödül, 30. basamakta özel yapı.')}</small></span><button class="btn gprice" data-a="sgold">${!S.seasonFirst ? `<s>${Purchases.seasonFull()}</s>` : ''}${Purchases.seasonPrice()}</button></div>`}
        <p class="note">${t('Holding’i alan Reklamsız’ı da almış sayılır. Kulüp iptal edilince geçiş reklamı geri gelir; kazanılan jetonlar ve sezon ödülleri kalır.')}</p>
        <div class="btns"><button class="txt" data-a="restore">${t('Satın alımları geri yükle')}</button></div>`;
    }
  }
  else if (s.k === 'holding') {
    const n = sharesPreview();
    sig = 'ho|' + n + canHolding() + (s.conf ? 1 : 0) + (S.shares || 0) + S.own.join();
    if (sig !== ui.sheetSig) {
      html = `<div class="sh-head"><div class="badge u-m0">${I.tower}</div><div class="sh-t"><h3>${t('Holding')}</h3><p>${t('{n} hisse · kiralar {x}', { n: S.shares || 0, x: fmtX(1 + 0.1 * (S.shares || 0)) })}</p></div></div>
        <p class="note u-mt0">${t('Herhangi bir ilin 5. semtinin tapusunu alınca holding kurabilirsin. Semtler ve binalar sıfırlanır; kazandığın hisseler kiraları kalıcı olarak artırır. Koleksiyon, seri, davet ve satın alımlar korunur.')}</p>
        <div class="task"><div class="tt"><b>${t('Bu turda kazanılacak hisse')}</b><small>${t('Her hisse +%10 kira · bu turdaki toplam kazanca göre')}</small></div><b class="u-num">${n}</b></div>
        <div class="btns">${canHolding() ? `<button class="btn gold" data-a="hold">${s.conf ? t('Emin misin? Tekrar dokun') : t('Holding kur')}</button>` : `<button class="btn" disabled>${n < 1 ? t('En az 1 hisse gerekli') : t('Önce bir ilin 5. semti')}</button>`}</div>`;
    }
  }
  if (html !== undefined) { ui.sheetSig = sig; $('#sheetBody').innerHTML = html; }
  updateLive();
  if (s.k === 'plot') { // canlı kısımlar (inşaat)
    const p = lotsOf(S, s.key!)[s.i!];
    if (p && p.until) {
      const rem = p.until - tn, prog = Math.min(1, 1 - rem / p.dur);
      const art = $('#sheetBody [data-art]'), pb = $('#sheetBody [data-pb]'), pt = $('#sheetBody [data-pt]'), cd = $('#sheetBody [data-cd]');
      const step = Math.floor(prog * 20);
      if (art && art.dataset.s !== String(step)) { art.dataset.s = String(step); art.innerHTML = svg(site(p.t, p.up ? p.lvl : 0, p.up ? p.lvl + 1 : 1, prog)); }
      if (pb) pb.style.width = prog * 100 + '%';
      if (pt) pt.textContent = `${p.up ? t('Kat çıkılıyor') : t('Kaba inşaat')} · ${pctTxt(Math.floor(prog * 100))}`;
      if (cd) cd.textContent = clock(rem);
    }
  }
}

const later = (s: SheetState, key: string) => setTimeout(() => { if (ui.sheet === s) { s[key] = false; ui.sheetSig = ''; } }, 3000);
export async function onSheetAction(a: string, btn: HTMLElement) {
  const s = ui.sheet; if (!s) return;
  if (a === 'close') return closeSheet();
  if (s.k === 'plot' && a === 'payoff') { closeLien(s.key!); ui.sheetSig = ''; return; }
  if (s.k === 'plot') {
    if (a === 'build') return build(s.key!, s.i!, btn.dataset.t as BuildingType);
    if (a === 'up') upgrade(s.key!, s.i!);
    if (a === 'skip') skip(s.key!, s.i!);
    if (a === 'lotboost') lotBoost(s.key!, s.i!);
    if (a === 'clear') return clearObstacle(s.key!, s.i!);
    if (a === 'skin') return openSheet({ k: 'skin', key: s.key, i: s.i });
    if (a === 'token') { const q = lotsOf(S, s.key!)[s.i!]; if (q && S.tokens > 0) { S.tokens--; q.bu = Math.min(Math.max(q.bu || 0, now()) + CFG.LOT_BOOST, now() + CFG.LOT_BOOST_MAX); track('lotboost'); toast(t('2x jetonu kullanıldı · 1 saat 2x')); ui.sheetSig = ''; ui.tileSig = []; persist(); Snd.reward(); } return; }
    if (a === 'place') return placeSpecial(s.key!, s.i!, btn.dataset.id!);
    if (a === 'del') { if (s.del) return demolish(s.key!, s.i!); s.del = true; later(s, 'del'); }
  }
  if (s.k === 'map') {
    const k = btn.dataset.k!;
    if (a === 'go') { switchDistrict(k); closeSheet(); return; }
    if (a === 'buy') return buyDistrict(k);
    if (a === 'kapora') return buyDistrict(k, true);
    if (a === 'payoff') { closeLien(k); ui.sheetSig = ''; return; }
    if (a === 'boost2x') { lotBoost(k, +btn.dataset.i!); ui.sheetSig = ''; return; }
  }
  if (s.k === 'menu') { if (a === 'share') return openShare(); if (a === 'starter') { closeSheet(); return showStarter(); } return openSheet({ k: a }); }
  if (s.k === 'tasks') { if (a === 'daily') { closeSheet(); ui.lastDay = ''; return; } if (a === 'claim') claimTask(+btn.dataset.i!); if (a === 'bonus') claimBonus(); }
  if (s.k === 'lb') { if (a === 'ref') return openSheet({ k: 'ref' }); if (a === 'leagues') return openSheet({ k: 'leagues' }); }
  if (s.k === 'leagues' && a === 'back') return openSheet({ k: 'lb' });
  if (s.k === 'ozel' && a === 'buyozel') return buySpecial();
  if (s.k === 'skin') {
    if (a === 'back') return openSheet({ k: 'plot', key: s.key, i: s.i });
    if (a === 'sc') { const n = +btn.dataset.n!; return setSkin(s.key!, s.i!, { c: n < 0 ? undefined : n }); }
    if (a === 'sr') return setSkin(s.key!, s.i!, { r: +btn.dataset.n! });
    if (a === 'ss') { const q = lotsOf(S, s.key!)[s.i!]; return setSkin(s.key!, s.i!, { s: !(q && q.sk && q.sk.s) }); }
  }
  if (s.k === 'arsiv' && a === 'arsel') { s.sel = btn.dataset.id; ui.sheetSig = ''; return; }
  if (s.k === 'sezon') {
    if (a === 'sclaim') { claimSeason(); return; }
    if (a === 'sgold') return Purchases.buySeason(() => { ensureSeason(); S.season.gold = true; toast(t('Altın Tapu açıldı')); Snd.unlock(); ui.sheetSig = ''; persist(); claimSeason(); });
  }
  if (s.k === 'guide' && a === 'open') return openSheet({ k: 'guideItem', i: +btn.dataset.i! });
  if (s.k === 'guideItem') {
    if (a === 'list') return openSheet({ k: 'guide' });
    if (a === 'prev' || a === 'next') { s.i = (s.i || 0) + (a === 'next' ? 1 : -1); ui.sheetSig = ''; $('#sheetBody').scrollTop = 0; return; }
  }
  if (s.k === 'set' && a === 'guide') return openSheet({ k: 'guide' });
  if (s.k === 'ref') { if (a === 'copy') copyText(S.ref.code); if (a === 'sharetext') shareTextOnly(); if (a === 'usecode') await useCode(($('#refInput') || {}).value); }
  if (s.k === 'store') {
    if (a === 'buy') return Purchases.buy();
    if (a === 'buyp') return Purchases.buyProduct(btn.dataset.p as any);
    if (a === 'jet') return buyTokens(+btn.dataset.n! === 15 ? 15 : 5);
    if (a === 'starter') { closeSheet(); return showStarter(); }
    if (a === 'sgold') return Purchases.buySeason(() => { ensureSeason(); S.season.gold = true; toast(t('Altın Tapu açıldı')); Snd.unlock(); ui.sheetSig = ''; persist(); });
    if (a === 'restore') return Purchases.restore();
    if (a === 'privacy') { window.open(PRIVACY_URL, '_blank'); return; }
    if (a === 'terms') { window.open(TERMS_URL, '_blank'); return; }
  }
  if (s.k === 'holding' && a === 'hold') { if (s.conf) return doHolding(); s.conf = true; later(s, 'conf'); }
  if (s.k === 'set' && a === 'lang') return switchLang(btn.dataset.l!);
  if (s.k === 'set' && a === 'region') return switchRegion(btn.dataset.r as RegionId);
  if (s.k === 'set') {
    if (a === 'sound') { S.sound = !S.sound; persist(); Snd.tap(); }
    if (a === 'night') { S.night = S.night === false; persist(); Snd.tap(); }
    if (a === 'rifki') { S.rifki = !S.rifki; if (!S.rifki) hideTip(); persist(); Snd.tap(); }
    if (a === 'cm-tap' || a === 'cm-auto') { S.collectMode = a === 'cm-auto' ? 'auto' : 'tap'; ui.tileSig = []; persist(); Snd.tap(); toast(S.collectMode === 'auto' ? t('Kiralar otomatik toplanacak') : t('Kiraları TOPLA mührüyle toplayacaksın')); }
    if (a === 'notif') { S.notif = !S.notif; if (S.notif) Notify.ask(); persist(); }
    if (a === 'link-google' || a === 'link-apple') { const ok = await Cloud.link(a === 'link-google' ? 'google' : 'apple'); toast(ok ? t('Hesabın bağlandı. İlerlemen artık her cihazda.') : t('Bağlanamadı, tekrar dene')); }
    if (a === 'ads-privacy') await Ads.showPrivacyOptions();
    if (a === 'privacy') window.open(PRIVACY_URL, '_blank');
    if (a === 'delete') { if (s.del) { const ok = await Cloud.deleteAccount(); if (ok) { await wipeAllSaves(); P.region = ''; await savePrefs(); await resetGame(); toast(t('Hesabın ve verilerin silindi')); } else toast(t('Silinemedi, internet bağlantını kontrol et')); return; } s.del = true; later(s, 'del'); }
    if (a === 'reset') { if (s.reset) { await resetGame(); toast(t('Yeni oyun')); return; } s.reset = true; later(s, 'reset'); }
  }
  ui.sheetSig = ''; if (ui.sheet) renderSheet();
}

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

/* haftanın özel tapusu bu hafta alınabilir mi */
const ozelAvail = () => { const wk = weekKey(new Date(now())); return !(S.ozel.week === wk && S.ozel.bought); };
const PAIR_NAME: Record<string, string> = { kafe: tk('ofis'), ofis: tk('kafe'), ev: tk('dükkân'), dukkan: tk('ev') };
/* komşuluk şeması: binanın dört komşusu ve etkisi (tasarım F3) */
function nbDiagram(k: string, i: number) {
  const lots = lotsOf(S, k), p = lots[i]!, cell = (j: number | null, pos: string) => {
    if (j == null) return `<span class="nb ${pos} off"></span>`;
    const q = lots[j]; let lab = t('boş arsa'), eff = '', cls = 'emp';
    if (q && q.sp) { lab = t(specialOf(q.sp).n); eff = `+${pctTxt(Math.round(CFG.SP_ADJ * 100))}`; cls = 'sp'; }
    else if (q && q.lvl >= 1 && !q.until) { lab = t(TYPES[q.t].n); if (q.t === p.t) { eff = `+${pctTxt(Math.round(CFG.ADJ * 100))}`; cls = 'same'; } else if (PAIRS[p.t] === q.t) { eff = `+${pctTxt(Math.round(CFG.PAIR * 100))}`; cls = 'pair'; } else cls = 'none'; }
    else if (q) { lab = t('inşaatta'); cls = 'emp'; }
    return `<span class="nb ${pos} ${cls}"><b>${lab}</b>${eff ? `<i>${eff}</i>` : ''}</span>`;
  };
  const c = i % COLS, up = i >= COLS ? i - COLS : null, dn = i + COLS < N ? i + COLS : null, lf = c > 0 ? i - 1 : null, rt = c < COLS - 1 ? i + 1 : null;
  return `<div class="nbgrid">${cell(up, 'u')}${cell(lf, 'l')}<span class="nb c me"><b>${t(TYPES[p.t].n)}</b></span>${cell(rt, 'r')}${cell(dn, 'd')}</div>
    <p class="note nbnote">${t('Akıllı ikililer: <b>Kafe + Ofis</b>, <b>Ev + Dükkân</b> · ikisine de +%{p}', { p: Math.round(CFG.PAIR * 100) })}</p>`;
}
/* semt hedefleri kartı (tasarım F2) */
function goalsCard(k: string) {
  const got = starsOf(k), gs = goalsOf(k);
  return `<div class="goals"><div class="gh"><div><p class="sec">${t('Semt hedefleri · {n}/3', { n: got.length })}</p><h4 class="lgt">${nm(DMAP[k].n)}</h4></div><span class="stars">${[0, 1, 2].map(n => `<i class="${n < got.length ? 'on' : ''}">★</i>`).join('')}</span></div>
    ${gs.map((g, gi) => { const [pv, n] = g.f(k), done = got.includes(gi); return `<div class="gr${done ? ' done' : ''}"><span class="gm">${done ? '★' : ''}</span><span class="gt"><b>${g.t}</b><i><u style="width:${done ? 100 : Math.round(pv / n * 100)}%"></u></i></span><span class="gp">${done ? t('tamam') : `${pv}/${n}`}</span></div>`; }).join('')}
    <p class="note u-m0t-4">${t('3 yıldız: {semt} kiralarına kalıcı +%{p} ve altın mühür. Her yıldız tapu ikramiyesi verir.', { semt: nm(DMAP[k].n), p: Math.round(CFG.STAR_BONUS * 100) })}</p></div>`;
}
