/* İHALE PANELİ — ödül, masa (rakip · güncel fiyat · sen), son iki teklif, Rıfkı'nın tavsiyesi, vekâlet adımlayıcısı;
   KÖŞE BAŞI SEÇİMİ — kazanılan damganın vurulacağı semt ve arsa. Kurallar game/auccore.ts, metinler game/auction.ts. */
import { CFG, COLS, N, TYPES, DistrictKey } from '../../config';
import { S, lotsOf } from '../../state';
import { fmt, fmtCost, clock } from '../../format';
import { now, rate } from '../../economy';
import { t, pctTxt } from '../../i18n';
import { rifkiFace } from '../rifkiFace';
import { rivalFace } from '../rivalFace';
import {
  IH, standing, isLate, advice, heldNeed, minProxy, setProxy, prizeName, prizeArt, prizeEffect, rifkiLine, rvOf, rvName, rvMood,
  dayName, nextText, calText, koseOf, placeKose, placeName, ARCHE, type Auction,
} from '../../game/auction';
import { Panel, STAY, closeSheet, lv } from './core';

const draftOf = (s: { draft?: number }, a: Auction, tn: number) => (s.draft = Math.max(s.draft == null ? (a.my || advice(a)) : s.draft, minProxy(a, tn)));

export const ihale: Panel = {
  sig(s, tn) {
    const a = IH().cur; if (!a || a.done) return 'ih|none|' + (a ? a.id + a.done : '') + IH().kp;
    const st = standing(a, tn), d = draftOf(s, a, tn);
    return ['ih', a.id, a.my, st.lead, st.price, isLate(a, tn), d, S.cash >= heldNeed(a, d, tn) ? 1 : 0, a.held, a.log.length].join('|');
  },
  render(s, tn) {
    const a = IH().cur;
    if (!a || a.done) {
      const last = a && a.done ? `<p class="note">${a.done === 'won' ? t('Son ihale: {p} senin oldu.', { p: prizeName(a) }) : t('Son ihale: {p}, {r} adına gitti.', { p: prizeName(a), r: rvName(rvOf(a)) })}</p>` : '';
      return `<p class="sec">${t('İhale')}</p><p class="gdp">${t('Şu an açık ihale yok.')} ${calText()}.</p><p class="note">${nextText(tn)}</p>${last}`;
    }
    const r = rvOf(a), name = rvName(r), st = standing(a, tn), late = isLate(a, tn), meLead = st.lead === 'me';
    const draft = draftOf(s, a, tn), need = heldNeed(a, draft, tn), rk = rifkiLine(a, tn), adv = advice(a);
    const tm = (x: number) => new Date(x).toTimeString().slice(0, 5);
    const log = a.log.slice(-2).reverse().map(b => `<li class="${b.who}"><span>${b.who === 'me' ? t('Sen') : name}</span><b>${fmt(b.v)}</b><i>${tm(b.at)}</i></li>`).join('');
    return `<div class="lghead"><div><p class="sec">${t('İhale · {d}', { d: dayName(a.open) })}</p><h4 class="lgt">${prizeName(a)}</h4>
        <small class="lgsub">${t('Kapanış')} <b class="ih-clock">${lv('ihc', () => clock(Math.max(0, a.close - now())))}</b></small></div><span class="st spst">${a.kind === 'lm' ? t('TARİHİ YAPI') : t('NADİR ARSA')}</span></div>
      ${late ? `<div class="ih-late"><b>${t('SON DÜZLÜK')}</b><span>${t('{r} artık tavanına kadar çıkıyor', { r: name })}</span></div>` : ''}
      <div class="ih-prow"><div class="ih-prize bpbg">${prizeArt(a)}</div><p class="ih-eff">${prizeEffect(a)}<small>${t('Açılış {x} · {r} tavanını ihale açılırken belirler, sonradan değiştirmez.', { x: fmtCost(a.start), r: name })}</small></p></div>
      <div class="ih-table">
        <div class="ih-side rv${meLead ? '' : ' lead'}"><div class="ih-face rv">${rivalFace(r.id, rvMood(a, tn))}</div><b>${name}</b><small>${t(ARCHE[r.a].n)}</small>${meLead ? '' : `<span class="ih-stamp">${t('ÖNDE')}</span>`}</div>
        <div class="ih-mid"><small>${t('Güncel fiyat')}</small><b class="ih-price">${fmtCost(st.price)}</b><small>${t('adım {x}', { x: fmtCost(a.step) })}</small></div>
        <div class="ih-side me${meLead ? ' lead' : ''}"><div class="ih-you"><span>${t('SEN')}</span></div><b>${t('Sen')}</b><small>${a.my ? t('vekâlet {x}', { x: fmtCost(a.my) }) : t('henüz teklif yok')}</small>${meLead ? `<span class="ih-stamp me">${t('ÖNDE')}</span>` : ''}</div>
      </div>
      <ol class="ih-log">${log}</ol>
      <div class="ih-rk"><div class="ih-face sm">${rifkiFace(rk.mood)}</div><div class="ih-say"><b>${t('RIFKI ABİ')}</b><span>${rk.text}</span></div></div>
      <div class="ih-proxy"><span class="ih-pl">${t('Vekâlet · en fazla')}</span>
        <div class="ih-step"><button class="ih-sb" data-a="dn" aria-label="${t('Bir adım azalt')}" ${draft - a.step < minProxy(a, tn) ? 'disabled' : ''}>−</button><b>${fmtCost(draft)}</b><button class="ih-sb" data-a="up" aria-label="${t('Bir adım artır')}">+</button></div>
        <button class="ih-chip${draft === adv ? ' on' : ''}" data-a="adv">${t('Rıfkı’nın önerisi · {x}', { x: fmtCost(adv) })}</button></div>
      <div class="btns"><button class="btn lotb" data-a="give" ${draft > a.my && S.cash >= need ? '' : 'disabled'}><span class="lbl">${a.my ? t('Vekâleti yükselt · {x}', { x: fmtCost(draft) }) : t('Vekâlet ver · {x}', { x: fmtCost(draft) })}</span><small>${S.cash < need ? t('Kasada {x} gerek', { x: fmtCost(need) }) : need ? t('önde kaldıkça {x} emanette · geçilirsen geri', { x: fmtCost(a.held + need) }) : t('şimdilik kasadan para çıkmaz')}</small></button></div>
      ${a.held ? `<p class="note u-tc">${t('Emanette: {x} (önde olduğun fiyat)', { x: fmtCost(a.held) })}</p>` : ''}
      <p class="note u-tc">${t('Rakip son saniyede kapmaz; tavanı ihale açılırken bellidir. İhale ödülleri lig puanına sayılmaz.')}</p>`;
  },
  action(act, _btn, s) {
    const a = IH().cur; if (!a || a.done) return;
    const tn = now(), d = draftOf(s, a, tn);
    if (act === 'up') s.draft = d + a.step;
    else if (act === 'dn') s.draft = Math.max(minProxy(a, tn), d - a.step);
    else if (act === 'adv') s.draft = Math.max(minProxy(a, tn), advice(a));
    else if (act === 'give') { setProxy(a, d, tn); s.draft = undefined; }
  },
};

/** Köşe başı seçimi: damgasız semt (s.key) ve arsa (s.i). */
const koseDistricts = () => S.own.filter(k => koseOf(k) < 0);
export const kose: Panel = {
  sig: s => ['ks', IH().kp, IH().kose.join(), s.key, s.i, S.own.length].join('|'),
  render(s) {
    const ih = IH(), ds = koseDistricts();
    const stamped = ih.kose.length ? `<p class="note">${t('Köşe başı arsaların: {l}', { l: ih.kose.map(x => placeName(x.split(':')[0])).join(', ') })}</p>` : '';
    if (ih.kp <= 0 || !ds.length) return `<p class="sec">${t('Köşe başı arsa')}</p><p class="gdp">${ih.kp > 0 ? t('Her semtte zaten bir köşe başı arsan var. Yeni bir semt alınca damgayı vurabilirsin.') : t('Bekleyen köşe başı damgası yok. Nadir arsa ihalesini kazanınca buradan bir arsana vurursun.')}</p>${stamped}`;
    const k: DistrictKey = s.key && ds.includes(s.key) ? s.key : ds.includes(S.cur) ? S.cur : ds[0]; s.key = k;
    const lots = lotsOf(S, k), x = CFG.IH_KOSE_X;
    const cells = Array.from({ length: N }, (_, i) => {
      const p = lots[i], r = p ? rate(k, i) : 0;
      const lbl = !p ? t('Boş') : p.ob ? t('Engel') : p.sp ? t('Özel yapı') : `${t(TYPES[p.t].n)} · ${t('Sv {l}', { l: p.lvl })}`;
      return `<button class="ks-cell${s.i === i ? ' on' : ''}${p && !p.ob ? '' : ' em'}" data-a="pick" data-i="${i}" aria-pressed="${s.i === i}"><b>${lbl}</b><small>${r ? '+' + t('{v}/sn', { v: fmt(r * x) }) : '—'}</small></button>`;
    }).join('');
    return `<div class="lghead"><div><p class="sec">${t('Köşe başı damgası · {n}', { n: ih.kp })}</p><h4 class="lgt">${t('Arsanı seç')}</h4>
        <small class="lgsub">${t('Seçtiğin arsanın kirası kalıcı +{p} · semt başına bir köşe başı', { p: pctTxt(Math.round(x * 100)) })}</small></div></div>
      ${ds.length > 1 ? `<div class="ks-ds">${ds.map(d => `<button class="chip${d === k ? ' on' : ''}" data-a="dist" data-k="${d}">${placeName(d)}</button>`).join('')}</div>` : `<p class="note u-m0b-4">${placeName(k)}</p>`}
      <div class="ks-grid" style="--cols:${COLS}">${cells}</div>
      <div class="btns"><button class="btn gold" data-a="stamp" ${s.i != null ? '' : 'disabled'}>${t('Damgayı vur')}</button></div>
      <p class="note u-tc">${t('Bina değişse de damga arsada kalır. Holding kurunca semtle birlikte gider; lig puanına sayılmaz.')}</p>${stamped}`;
  },
  action(act, btn, s) {
    if (act === 'dist') { s.key = btn.dataset.k; s.i = undefined; }
    else if (act === 'pick') s.i = +btn.dataset.i!;
    else if (act === 'stamp' && s.key && s.i != null) { if (placeKose(s.key, s.i)) { closeSheet(); return STAY; } }
  },
};
