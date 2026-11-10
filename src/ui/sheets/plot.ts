/* ARSA PANELİ (boş arsa, engel, inşaat, bina) ve CEPHE paneli (tasarım H6) */
import { COLS, N, CFG, DRULES, MAXLV, ORDER, TYPES, LV_INC, DMAP, BuildingType } from '../../config';
import { S, lotsOf, Plot } from '../../state';
import { fmt, fmtTime, clock } from '../../format';
import { PAIRS, ruleMult, neighborBonus, pairAdj, spAdj, districtMult, withDisc, buildCost, buildTime, upCost, upTime, adj, rate, incM, permMult, fxMult } from '../../economy';
import { bld, site, svg } from '../../draw';
import { I } from '../../icons';
import { $, ui } from '../ctx';
import { build, upgrade, skip, demolish, lotBoost, useToken, placeSpecial } from '../../game/actions';
import { specialSvg, specialOf } from '../../specials';
import { lienBlocks, closeLien, clearCost, clearObstacle, obstacleSvg, OBSTACLES } from '../../game/district';
import { SKIN_COLORS, ROOFS, skinUnlocked, skinStyle, setSkin } from '../../game/fun';
import { t, tk, nm, pctTxt } from '../../i18n';
import { Panel, STAY, openSheet, lv, lvBar, discBox, later } from './core';

interface PlotC { k: string; i: number; p: Plot | null; cc: number; nearly: boolean; canUp: boolean; uc: number; afford: boolean; a: number; pa: number; sa: number; lbLeft: number }

export const plot: Panel<PlotC> = {
  sig(s, tn, c) {
    const k = c.k = s.key!, i = c.i = s.i!, p = c.p = lotsOf(S, k)[i];
    if (!p) return 'e|' + ORDER.map(b => (S.seen[b] ? 1 : 0) + '' + (S.cash >= withDisc(buildCost(k, b)) ? 1 : 0)).join() + S.disc + S.inv.join() + (lienBlocks(k) ? 'L' + (S.cash >= S.lien[k] ? 1 : 0) : '');
    if (p.ob) { c.cc = clearCost(k); return 'ob|' + p.ob + (S.cash >= c.cc ? 1 : 0); }
    if (p.until) { c.nearly = p.until - tn <= CFG.SKIP_LEFT + 1e3; return 'c|' + p.t + p.lvl + (p.up ? 1 : 0) + (p.until - tn <= CFG.AD_SKIP ? 1 : 0) + (c.nearly ? 1 : 0); }
    const canUp = c.canUp = p.lvl < MAXLV && !p.sp, uc = c.uc = canUp ? withDisc(upCost(k, p)) : 0, afford = c.afford = canUp && S.cash >= uc, a = c.a = adj(k, i);
    c.pa = pairAdj(k, i); c.sa = spAdj(k, i);
    const lbLeft = c.lbLeft = Math.max(0, (p.bu || 0) - tn);
    return 'b|' + S.tokens + p.t + p.lvl + (afford ? 1 : 0) + a + (S.boostUntil > tn ? Math.ceil((S.boostUntil - tn) / 60e3) : 0) + '|' + Math.ceil(lbLeft / 60e3) + fxMult(k, i, p, tn) + S.disc + (s.del ? 1 : 0);
  },
  render(s, tn, c) {
    const { k, i, p } = c;
    if (!p) {
      if (lienBlocks(k)) return `<div class="sh-head"><div class="sh-t"><h3>${t('Kilitli arsa')}</h3><p>${nm(DMAP[k].n)} · ${t('kaporalı semt')}</p></div></div>
          <p class="gdp">${t('Kapora ile alınan semtte {lots} arsa açık. Kalan {debt} borç {semt} kirasının yarısıyla kendiliğinden ödeniyor; bitince 20 arsanın hepsi açılır.', { lots: CFG.KAPORA_LOTS, debt: lv('ld' + k, () => fmt(S.lien[k] || 0)), semt: nm(DMAP[k].n) })}</p>
          <div class="btns"><button class="btn" data-a="payoff" ${S.cash >= S.lien[k] ? '' : 'disabled'}>${t('Borcu şimdi kapat')} · ${lv('ld' + k, () => fmt(S.lien[k] || 0))}</button></div>`;
      const short = ORDER.some(b => S.seen[b] && S.cash < withDisc(buildCost(k, b)));
      const inv = S.inv.length ? `<p class="sec">${t('Depodaki özel yapılar')}</p><div class="cards spcards">${S.inv.map(id => `<button class="bcard bpbg k-ozel" data-a="place" data-id="${id}">${svg(specialSvg(id))}<span class="bn">${t(specialOf(id).n)}</span><span class="bm">${t('Komşularına +%{n}', { n: Math.round(CFG.SP_ADJ * 100) })}</span><span class="bp">${t('Yerleştir')}</span></button>`).join('')}</div><p class="sec">${t('Yeni bina')}</p>` : '';
      return `${discBox()}${inv}<div class="cards">${ORDER.map(b => {
        const T = TYPES[b];
        if (!S.seen[b]) return `<div class="bcard locked bpbg k-${b}">${svg(bld(b, 1))}<span class="bn">${t(T.n)}</span><span class="bl">${t('{m} kazanınca', { m: fmt(T.unlock) })}</span><span class="lk">${I.lock}</span></div>`;
        const cst = withDisc(buildCost(k, b)), nb = neighborBonus(k, i, b);
        return `<button class="bcard bpbg k-${b}" data-a="build" data-t="${b}" ${S.cash >= cst ? '' : 'disabled'}>${svg(bld(b, 1))}
            <span class="bn">${t(T.n)}</span><span class="bm">${t('{v}/sn', { v: fmt(T.inc * incM(k) * (1 + nb) * permMult() * districtMult(k), true) })} · ${fmtTime(buildTime(k, b))}</span><span class="bp">${fmt(cst)}</span>${nb ? `<span class="chain" title="${t('Komşu bonusu')}">+${pctTxt(Math.round(nb * 100))}</span>` : ''}</button>`;
      }).join('')}</div>${short ? `<p class="note">${t('Kira toplamak için ortadaki TOPLA mührüne bas.')}</p>` : ''}`;
    }
    if (p.ob) {
      const ob = OBSTACLES[p.ob];
      return `<div class="sh-head"><div class="sh-art bpbg">${svg(obstacleSvg(p.ob))}</div><div class="sh-t"><h3>${t(ob.n)}</h3><p>${nm(DMAP[k].n)} · ${t('engelli arsa')}</p></div></div>
          <p class="gdp">${t(ob.d)} ${t('Temizlenmeden bina kurulamaz. Molozun arasından bazen eski eşyalar, nadiren tarihi bir kalıntı çıkar.')}</p>
          <div class="btns"><button class="btn lotb" data-a="clear" ${S.cash >= c.cc ? '' : 'disabled'}><span class="lbl">${t('Temizle')} · ${fmt(c.cc)}</span><small>${t('anında · kasaya ufak bir sürpriz')}</small></button></div>`;
    }
    if (p.until) {
      return `<div class="sh-head k-${p.t}"><div class="sh-art bpbg" data-art></div><div class="sh-t"><h3>${t(TYPES[p.t].n)}</h3><p data-pt></p></div></div>
          <div class="cd"><span class="sec">${t('Kalan süre')}</span><span class="cdv" data-cd></span></div>
          <div class="k-${p.t}"><div class="prog"><i data-pb></i></div></div>
          <p class="note">${t('İnşaat sen oyunda değilken de sürer.')}</p>
          <div class="btns">${c.nearly ? `<button class="btn" disabled>${t('Bitmek üzere…')}</button>` : `<button class="btn gold" data-a="skip">${I.play} ${p.until - tn <= CFG.AD_SKIP ? t('İzle, 5 saniyeye indir') : t('İzle, 30 dk kısalt')}</button>`}<button class="txt" data-a="close">${t('Bekle')}</button></div>`;
    }
    const { canUp, uc, afford, a, pa, sa, lbLeft } = c;
    const next = canUp ? TYPES[p.t].inc * LV_INC[p.lvl + 1] * incM(k) * (1 + neighborBonus(k, i)) * permMult() * districtMult(k) * fxMult(k, i, p, tn) * (S.boostUntil > tn ? 2 : 1) * (lbLeft > 0 ? 2 : 1) : 0;
    const sp = p.sp ? specialOf(p.sp) : null;
    return `<div class="sh-head k-${sp ? 'ozel' : p.t}"><div class="sh-art bpbg">${svg(sp ? specialSvg(p.sp!) : bld(p.t, p.lvl))}</div>
          <div class="sh-t"><h3>${sp ? t(sp.n) : t(TYPES[p.t].n)}</h3><p>${nm(DMAP[k].n)} · ${sp ? t('özel yapı') : t('Sv {l}/{m}', { l: p.lvl, m: MAXLV })}</p>${sp ? `<p class="spd">${t(sp.d)}</p>` : lvBar(p.lvl)}</div>
          <button class="iconbtn${s.del ? ' warn' : ''}" data-a="del" aria-label="${s.del ? t('Yıkmayı onayla') : t('Binayı yık')}">${I.trash}</button></div>
          ${s.del ? `<p class="sec u-tc u-m0b-4">${t('Tekrar dokunursan bina yıkılır')}</p>` : ''}
          <div class="ledger">
            <div><span>${t('Kira')}</span><i></i><b>${t('{v}/sn', { v: fmt(rate(k, i), true) })}</b></div>
            ${sp ? `<div><span>${t('Komşularına')}</span><i></i><b>${t('her yöne +%{n}', { n: Math.round(CFG.SP_ADJ * 100) })}</b></div>` : `<div><span>${t('Aynı tür komşu')}</span><i></i><b>${a ? '+' + pctTxt(Math.round(a * CFG.ADJ * 100)) : t('yok')}</b></div>
            <div><span>${t('Akıllı ikili ({ad})', { ad: t(PAIR_NAME[p.t]) })}</span><i></i><b>${pa ? '+' + pctTxt(Math.round(pa * CFG.PAIR * 100)) : t('yok')}</b></div>
            ${sa ? `<div><span>${t('Özel yapı komşusu')}</span><i></i><b>+${pctTxt(Math.round(sa * CFG.SP_ADJ * 100))}</b></div>` : ''}`}
            ${!sp && DRULES[k] && (ruleMult(k, i, p.t) > 1 || DRULES[k].kind === 'pair' && pa || DRULES[k].kind === 'speed' || DRULES[k].kind === 'upDisc') ? `<div class="rule"><span>${t('Semt kuralı')} · ${t(DRULES[k].n)}</span><i></i><b>${t(DRULES[k].t).replace(/ \(.*\)/, '')}</b></div>` : ''}
            ${districtMult(k) > 1 ? `<div><span>${t('3 yıldızlı semt')}</span><i></i><b>+${pctTxt(Math.round(CFG.STAR_BONUS * 100))}</b></div>` : ''}
            ${lbLeft > 0 ? `<div><span>${t('Bu mülke 2x')}</span><i></i><b class="red">${t('{s} kaldı', { s: fmtTime(lbLeft) })}</b></div>` : ''}
            ${S.boostUntil > tn ? `<div><span>${t('Tüm mülklere 2x')}</span><i></i><b class="red">${t('{s} kaldı', { s: fmtTime(S.boostUntil - tn) })}</b></div>` : ''}
            ${canUp ? `<div><span>${t('Sv {l} olunca', { l: p.lvl + 1 })}</span><i></i><b>${t('{v}/sn', { v: fmt(next, true) })}</b></div>` : ''}
          </div>${sp ? '' : nbDiagram(k, i)}${canUp ? discBox() : ''}
          <div class="btns">${canUp ? `<button class="btn" data-a="up" ${afford ? '' : 'disabled'}>${t('Kat çık')} · ${fmt(uc)} <small>${fmtTime(upTime(k, p))}</small></button>` : sp ? '' : `<button class="btn" disabled>${t('Son seviye')}</button>`}
          <button class="btn gold lotb" data-a="lotboost" ${lbLeft > CFG.LOT_BOOST_MAX - CFG.LOT_BOOST / 2 ? 'disabled' : ''}><span class="lbl">${I.play} ${t('İzle · bu mülke 2x')}</span><small>${t('+1 saat')}${lbLeft ? ' · ' + t('en fazla 4 saat') : ''}</small></button>
          ${S.tokens > 0 ? `<button class="btn soft" data-a="token" ${lbLeft > CFG.LOT_BOOST_MAX - CFG.LOT_BOOST / 2 ? 'disabled' : ''}>${t('2x jetonu kullan · {n} jeton', { n: S.tokens })}</button>` : ''}
          <button class="txt" data-a="skin">${t('Görünümü değiştir')}</button></div>`;
  },
  /** İnşaat: şantiye çizimi (%5 adım), ilerleme çubuğu, yüzde ve geri sayım her çizimde yerinde güncellenir. */
  live(s, tn) {
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
  },
  action(a, btn, s) {
    const k = s.key!, i = s.i!;
    if (a === 'payoff') { closeLien(k); ui.sheetSig = ''; return STAY; }
    if (a === 'build') { build(k, i, btn.dataset.t as BuildingType); return STAY; }
    if (a === 'up') upgrade(k, i);
    if (a === 'skip') skip(k, i);
    if (a === 'lotboost') lotBoost(k, i);
    if (a === 'clear') { clearObstacle(k, i); return STAY; }
    if (a === 'skin') { openSheet({ k: 'skin', key: s.key, i: s.i }); return STAY; }
    if (a === 'token') { useToken(k, i); return STAY; }
    if (a === 'place') { placeSpecial(k, i, btn.dataset.id!); return STAY; }
    if (a === 'del') { if (s.del) { demolish(k, i); return STAY; } s.del = true; later(s, 'del'); }
  },
};

export const skin: Panel<{ p: Plot | null }> = {
  sig(s, _tn, c) {
    const p = c.p = lotsOf(S, s.key!)[s.i!];
    return 'sk|' + JSON.stringify(p && p.sk) + S.ach.length + S.skinsU.join();
  },
  render(_s, _tn, { p }) {
    if (!p) return undefined;
    const sk = p.sk || {}, name = p.sp ? specialOf(p.sp).n : TYPES[p.t].n;
    return `<div class="sh-head k-${p.sp ? 'ozel' : p.t}"><div class="sh-art bpbg" style="${skinStyle(p)}">${svg(p.sp ? specialSvg(p.sp) : bld(p.t, Math.max(1, p.lvl)))}</div><div class="sh-t"><h3>${t('Görünümü seç')}</h3><p>${t(name)} · ${t('yalnızca görünüm, kira değişmez')}</p></div></div>
        <p class="sec">${t('Cephe rengi')}</p><div class="skc">${SKIN_COLORS.map((cl, n) => `<button class="sw2${(sk.c ?? -1) === n ? ' on' : ''}${skinUnlocked(n) ? '' : ' lk'}" data-a="sc" data-n="${n}" style="background:${cl.f}" aria-label="${t(cl.n)}${skinUnlocked(n) ? '' : ' (' + t('kilitli: {s}', { s: t(cl.lock!) }) + ')'}">${skinUnlocked(n) ? '' : I.lock}</button>`).join('')}<button class="sw2 none${sk.c == null ? ' on' : ''}" data-a="sc" data-n="-1" aria-label="${t('Varsayılan')}">×</button></div>
        ${p.t === 'ev' && !p.sp ? `<p class="sec">${t('Çatı')}</p><div class="skr">${ROOFS.map((r, n) => `<button class="rf2b${(sk.r || 0) === n ? ' on' : ''}" data-a="sr" data-n="${n}"><i style="background:${r.rf || 'var(--rf)'}"></i>${t(r.n)}</button>`).join('')}</div>` : ''}
        <div class="srow"><span>${t('Tabela')}</span><button class="sw${sk.s ? ' on' : ''}" role="switch" aria-checked="${!!(sk.s)}" data-a="ss" aria-label="${t('Tabela')}"></button></div>
        <p class="note">${t('Kilitli renkler tapu arşivinden ve tapu sezonundan açılır.')}</p>
        <div class="btns"><button class="btn soft" data-a="back">${t('Mülke dön')}</button></div>`;
  },
  action(a, btn, s) {
    if (a === 'back') { openSheet({ k: 'plot', key: s.key, i: s.i }); return STAY; }
    if (a === 'sc') { const n = +btn.dataset.n!; setSkin(s.key!, s.i!, { c: n < 0 ? undefined : n }); return STAY; }
    if (a === 'sr') { setSkin(s.key!, s.i!, { r: +btn.dataset.n! }); return STAY; }
    if (a === 'ss') { const q = lotsOf(S, s.key!)[s.i!]; setSkin(s.key!, s.i!, { s: !(q && q.sk && q.sk.s) }); return STAY; }
  },
};

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
