/* KİRACI KARTI ve KİRACI DEFTERİ + kiracı olaylarının arayüz bağlantısı (Rıfkı Abi, YERLEŞTİ mührü, bildirim, kayıt).
   Mantık game/tenants.ts'te (arayüz içe aktarmaz); burası yalnız gösterim ve tenantHooks kaydı. */
import { CFG, DMAP, TYPES, LV_INC, CITIES, CITY_ORDER, REGIONS, CityId } from '../../config';
import { S, lotsOf } from '../../state';
import { fmt, clock, fmtCost, fmtTime } from '../../format';
import { rate, incM, permMult, ruleMult, districtMult } from '../../economy';
import { t, nm, pctTxt } from '../../i18n';
import { I } from '../../icons';
import { Snd, buzz } from '../../sound';
import { ui } from '../ctx';
import { toast } from '../modal';
import { tenantFace, tenantBadge, tenantLook } from '../tenantFace';
import {
  tenantAt, tenantHooks, tName, quote, wishShort, wishLink, goLabel, inProgress, handKey, targetLot, ARCHS, Tenant, bonusPct, liveMin,
  renovFee, renovMs, startRenov,
  stampsOf, leaveText, endText, charOfT, charName, charOk, charMet, cityCount, cityBadge, countryCities, countryDone, postcards,
} from '../../game/tenants';
import { CHAR, CHARS, TRAITS, TChar, bonusOf, liveOf, traitOf } from '../../game/tenantChars';
import { SKIN_COLORS, COUNTRY_SKIN } from '../../game/fun';
import { sayEvent } from '../../game/rifki';
import { pjOf } from '../../economy';
import { deny } from '../motion';
import { view } from '../ctx';
import { persist } from '../../game/persist';
import { Funnel } from '../../services/funnel';
import { Panel, STAY, openSheet, closeSheet, lv } from './core';

const where = (x: Tenant) => {
  const p = lotsOf(S, x.k)[x.i], d = nm(DMAP[x.k].n);
  return p ? t('{d} · {b}, kat {l}', { d, b: t(TYPES[p.t].n), l: p.lvl }) : t('{d} · boş arsa', { d });
};
/** Bu binaya getirisi (sn başına): yerleşmişse gerçek pay, değilse bugünkü kiranın (boş arsada kurulacak binanın 1. kat kirasının) bonusu. */
function gain(x: Tenant): number {
  const b = bonusOf(charOfT(x));
  if (x.w.k === 'new' && !lotsOf(S, x.k)[x.i]) { const ty = x.w.t!; return TYPES[ty].inc * LV_INC[1] * incM(x.k) * permMult() * ruleMult(x.k, x.i, ty) * districtMult(x.k) * b; }
  const r = rate(x.k, x.i);
  return x.st === 'live' ? r - r / (1 + b) : r * b;
}
const mins = (ms: number) => Math.ceil(Math.max(0, ms) / 60e3);
const leftTxt = (x: Tenant) => (x.st === 'live' ? t('{m} dk', { m: mins(x.end - S.playMs) })
  : x.rv != null && x.rv > S.playMs ? t('yenileniyor · {c}', { c: clock(x.rv - S.playMs) }) : inProgress(x) ? t('usta çalışıyor · süre durdu') : clock(Math.max(0, x.dl - S.playMs)));
/** Yenileme düğmesi: bedel ve süre (kasa yetmezse pasif). */
const renovBtn = (x: Tenant) => { const f = renovFee(x.k, x.i); return `<button class="btn" data-a="renov" ${S.cash >= f ? '' : 'disabled'}>${t('Yenile')} · ${fmtCost(f)} <small>${fmtTime(renovMs(x.k, x.i))}</small></button>`; };
/** Kişiliğin kira bonusu ve süresi ("+%60 kira · 50 dk"). */
const traitGain = (ch: TChar | null) => t('+{p} kira · {m} dk', { p: pctTxt(Math.round(bonusOf(ch) * 100)), m: Math.round(liveOf(ch) / 60e3) });
/** Kişiliğin açıklaması ({p}/{m} yer tutucuları karakterin değerleriyle). */
const traitDesc = (ch: TChar) => t(TRAITS[traitOf(ch)].d, { p: pctTxt(Math.round(bonusOf(ch) * 100)), m: Math.round(liveOf(ch) / 60e3) });

export const kiraci: Panel<{ x: Tenant | null }> = {
  sig(s, _tn, c) { const x = c.x = tenantAt(s.key!, s.i!); return 'tn|' + (x ? x.id + x.st + (inProgress(x) ? 'p' : '') + (x.dl - S.playMs < CFG.TEN_NOTE ? 'n' : '') + (x.w.k === 'renov' && x.rv == null ? (S.cash >= renovFee(x.k, x.i) ? 'r' : 'R') : '') : '-'); },
  render(_s, _tn, { x }) {
    if (!x) return `<p class="sec">${t('Kiracı adayı')}</p><p class="gdp">${t('Kiracı adayı başka bir yere baktı. Yenisi gelir.')}</p>
      <div class="btns"><button class="txt" data-a="defter">${t('Kiracı defteri')}</button></div>`;
    const [name, role] = tName(x.a, x.k), live = x.st === 'live', ready = x.st === 'ready', ch = charOfT(x), L = tenantLook(x);
    const head = live ? t('KİRACI · YERLEŞTİ') : ready ? t('İSTEĞİ OLDU') : t('KİRACI ADAYI');
    return `<div class="sh-head tn-head"><div class="tn-por">${tenantFace(L.p, live || ready ? 'happy' : 'wait', true, L.id)}</div>
        <div class="sh-t"><p class="sec tn-sec">${head}</p><h3>${name}</h3><p>${role} · ${where(x)}</p>${ch ? `<p class="tn-own">“${t(ch.q)}”</p>` : ''}</div></div>
      <blockquote class="tn-q">“${quote(x)}”</blockquote>
      <div class="ledger tn-led">
        <div><span>${t('İstek')}</span><i></i><b>${wishShort(x)}</b></div>
        ${ch ? `<div><span>${t('Kişilik')}</span><i></i><b class="tn-tr" data-trait="${traitOf(ch)}">${t(TRAITS[traitOf(ch)].n)}</b></div>` : ''}
        <div><span>${t('Kazandırır')}</span><i></i><b class="up">${t('+{p} kira · {m} dk', { p: bonusPct(x), m: liveMin(x) })}</b></div>
        <div><span>${t('Bu binaya')}</span><i></i><b>+${lv('tng', () => t('{v}/sn', { v: fmt(gain(x)) }))}</b></div>
        <div><span>${live ? t('Sözleşme') : t('Kalan süre')}</span><i></i><b class="${!live && x.dl - S.playMs < CFG.TEN_NOTE ? 'red' : ''}">${lv('tnl', () => leftTxt(x))}</b></div>
        <div class="rule"><span>${t('Bağlantı')}</span><i></i><b>${wishLink(x)}</b></div>
      </div>
      <div class="btns">${live ? '' : ready ? `<button class="btn gold" data-a="key">${t('Anahtarı ver')}</button>` : x.w.k === 'renov' ? (x.rv == null ? renovBtn(x) : '') : `<button class="btn" data-a="go">${goLabel(x)}</button>`}
        <button class="txt" data-a="defter">${t('Kiracı defteri')}</button></div>
      <p class="note">${live ? t('Sözleşme bitince {n} teşekkür edip taşınır; defterindeki pulu kalır.', { n: name }) : t('İstek karşılanmazsa {n} başka yere bakar. Ceza yok, yalnızca bonus kaçar.', { n: name })}</p>`;
  },
  action(a, _b, s) {
    if (a === 'defter') { const x = tenantAt(s.key!, s.i!); if (x) dview.city = DMAP[x.k].city; dview.sel = ''; openSheet({ k: 'defter' }); return STAY; }
    const x = tenantAt(s.key!, s.i!); if (!x) return;
    if (a === 'go') {
      if (x.w.k === 'proj') { // 1. etap: proje seçim modu (bu binayı içeren blok) · 2. etap: proje paneli
        const q = pjOf(x.k, x.i);
        if (q) { openSheet({ k: 'proj', key: x.k, i: q.a }); return STAY; }
        if (x.k === S.cur) { closeSheet(); view.pjSelect(x.k, x.i); return STAY; }
      }
      if (x.w.k === 'paint') { openSheet({ k: 'skin', key: x.k, i: x.i }); return STAY; }
      openSheet({ k: 'plot', key: x.k, i: targetLot(x) }); return STAY;
    }
    if (a === 'renov') { if (startRenov(x)) { Snd.tap(); persist(); } else deny(); return; }
    if (a === 'key') { handKey(x); closeSheet(); return STAY; }
  },
};

/* ---------- kiracı defteri: bölgenin şehirleri sekme sekme; her şehirde 6 karakter ----------
   Pul (karakter bir kez yerleşince) · şehir rozeti (6'sı da) · ülke cephe rengi (ülkenin bölgedeki tüm şehir rozetleri) ·
   kartpostal (gezgin karakter). Eski tip pulları (müdavim → "Kiracı yeşili") alt satırda aynen. Yalnız koleksiyon: kiraya etkisi yok. */
const STAR = '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M12 2l2.9 6.6 7.1.6-5.4 4.7 1.7 7-6.3-3.8-6.3 3.8 1.7-7L2 9.2l7.1-.6z" fill="currentColor"/></svg>';
/** Defterde açık sekme (şehir) ve ayrıntısı açılan karakter (yalnız arayüz durumu). */
export const dview = { city: '' as CityId | '', sel: '' };
const tabCity = (): CityId => (dview.city && CITY_ORDER.includes(dview.city) ? dview.city : CITY_ORDER.includes(DMAP[S.cur] && DMAP[S.cur].city) ? DMAP[S.cur].city : CITY_ORDER[0]);
export const defter: Panel = {
  sig: () => 'df|' + tabCity() + dview.sel + JSON.stringify(S.tdef || {}) + JSON.stringify(S.tdc || {}),
  render() {
    const d = S.tdef || {}, need = Math.max(1, Math.floor(CFG.TEN_STAMP)), city = tabCity(), dc = S.tdc || {};
    const tabs = CITY_ORDER.map(c => `<button role="tab" class="dtb${cityBadge(c) ? ' rz' : ''}" data-a="dtab" data-c="${c}" aria-selected="${c === city}">${nm(CITIES[c].n)}<small>${cityBadge(c) ? `<span class="rzs" role="img" aria-label="${t('Şehir rozeti')}">${STAR}</span>` : ''}${cityCount(c)}/6</small></button>`).join('');
    const cards = ARCHS.map(a => CHAR[city + '.' + a]).filter(Boolean).map(ch => {
      const seen = charMet(ch.id), ok = charOk(ch.id), [name, role] = charName(ch), sel = dview.sel === ch.id;
      return `<${seen ? `button data-a="dch" data-c="${ch.id}" aria-expanded="${sel}"` : 'div'} class="tdc${seen ? '' : ' unk'}${ok ? ' done' : ''}${sel ? ' sel' : ''}" data-arch="${ch.a}" data-ch="${ch.id}">${ok ? `<span class="tdk" role="img" aria-label="${t('yerleşti')}">${I.check}</span>` : ''}<div class="tdp">${seen ? tenantBadge(ch.look, ok ? 'happy' : 'wait', ch.id) : '<b aria-hidden="true">?</b>'}</div>
          <b class="tdn">${seen ? name : '???'}</b><small>${seen ? role : t('henüz gelmedi')}</small>${seen ? `<span class="tdt">${t(TRAITS[ch.trait].n)}</span>` : ''}</${seen ? 'button' : 'div'}>`;
    }).join('');
    const sc = dview.sel && CHAR[dview.sel] && CHAR[dview.sel].city === city && charMet(dview.sel) ? CHAR[dview.sel] : null;
    const det = sc ? `<div class="tdd"><b>${charName(sc)[0]} · ${t(TRAITS[sc.trait].n)} · ${traitGain(sc)}</b><p>“${t(sc.q)}”</p><small>${traitDesc(sc)}</small></div>` : '';
    const co = CHAR[city + '.ogrenci'].country, cl = SKIN_COLORS[COUNTRY_SKIN[co]], cc = countryCities(co);
    const cty = `<div class="cty${countryDone(co) ? ' on' : ''}"><span class="csw" style="background:${cl.f}"></span><div><b>${t('{c} · {s} cephe', { c: t(REGIONS[co].n), s: t(cl.n) })}</b><small>${t('{n}/{m} şehir rozeti', { n: cc.filter(c => cityBadge(c)).length, m: cc.length })}${countryDone(co) ? ' · ' + t('açıldı') : ''}</small></div></div>`;
    const pcs = CHARS.filter(c => CITY_ORDER.includes(c.city) && TRAITS[c.trait].rare), got = new Set(postcards().map(c => c.id));
    const post = pcs.length ? `<p class="sec tdh">${t('Kartpostallar')}</p><p class="note">${t('Gezgin kiracılar kısa kalır ama defterine şehirlerinden bir kartpostal bırakır.')}</p>
      <div class="pcs">${pcs.map(c => `<div class="pc${got.has(c.id) ? ' on' : ''}" data-ch="${c.id}">${got.has(c.id) ? `${nm(CITIES[c.city].n)}<br>${charName(c)[0]}` : `${nm(CITIES[c.city].n)}<br>?`}</div>`).join('')}</div>` : '';
    const met = CHARS.filter(c => CITY_ORDER.includes(c.city) && charMet(c.id, dc)).length, okN = CHARS.filter(c => CITY_ORDER.includes(c.city) && charOk(c.id, dc)).length;
    return `<p class="sec">${t('Kiracı defteri')}</p><p class="gdp">${t('Tanıştığın kiracılar şehir şehir. Her şehrin 6 kiracısı var; hepsi bir kez yerleşince şehir rozeti, bir ülkenin şehir rozetlerinin hepsi o ülkenin cephe rengini açar. Kiraya etkisi yok, yalnızca görünüm.')}</p>
      <div class="dtab" role="tablist" aria-label="${t('Şehirler')}">${tabs}</div>
      <div class="tdf" role="tabpanel">${cards}</div>${det}
      ${cty}${post}
      <p class="note u-tc">${t('{n}/{m} kiracı tanışıldı · {k} yerleşti', { n: met, m: CITY_ORDER.length * 6, k: okN })}</p>
      <p class="note u-tc tdm">${t('Müdavim pulları (tipe göre): {n}/6 · bir tipten {m} kiracı yerleşince pul; 6 pul “Kiracı yeşili” cephe rengini açar', { n: stampsOf(d), m: need })}</p>`;
  },
  action(a, b) {
    if (a === 'dtab') { const c = b.dataset.c as CityId; if (CITY_ORDER.includes(c)) { dview.city = c; dview.sel = ''; } return; }
    if (a === 'dch') { const id = b.dataset.c || ''; dview.sel = dview.sel === id ? '' : id; return; }
  },
};

/** Yerleşmenin defter ödülü (en önemlisi gösterilir): ülke cephe rengi > şehir rozeti > kartpostal > müdavim pulu (tip). */
function settleToast(x: Tenant) {
  const ch = charOfT(x), first = !!ch && ((S.tdc[ch.id] || { ok: 0 }).ok === 1), n = tName(x.a, x.k)[0];
  if (ch && first && cityBadge(ch.city)) {
    const city = nm(CITIES[ch.city].n), cl = SKIN_COLORS[COUNTRY_SKIN[ch.country]];
    if (countryDone(ch.country)) { toast(t('{c} cephe rengi açıldı: {s}', { c: t(REGIONS[ch.country].n), s: t(cl.n) }), 3500); return; }
    toast(t('{c} rozeti kazanıldı: şehrin 6 kiracısı da yerleşti', { c: city }), 3500); return;
  }
  if (ch && first && TRAITS[ch.trait].rare) { toast(t('{n} defterine bir kartpostal bıraktı', { n }), 3000); return; }
  if ((S.tdef[x.a] || { ok: 0 }).ok === Math.max(1, Math.floor(CFG.TEN_STAMP))) // müdavim pulu (6'sı: Kiracı yeşili cephe rengi)
    toast(stampsOf() >= ARCHS.length ? t('Kiracı defteri tamam: “Kiracı yeşili” cephe rengi açıldı') : t('Kiracı defterine müdavim pulu basıldı: {n}', { n }), 3000);
}

/* ---------- olaylar: Rıfkı Abi tanıtır, hatırlatır, haber verir, kutlar; gidişte konuşmaz (kısa bildirim, suçlamaz) ---------- */
const redraw = (x: Tenant) => { if (x.k === S.cur) ui.tileSig[x.i] = ''; ui.sheetSig = ''; };
tenantHooks.arrive = x => { redraw(x); sayEvent('ten', x.k, x); Funnel.tenant('arrive', x); persist(); };
tenantHooks.note = x => sayEvent('tennote', x.k, x);
tenantHooks.ready = x => { redraw(x); sayEvent('tenready', x.k, x); Funnel.tenant('ready', x); };
tenantHooks.settle = x => {
  if (x.k === S.cur) { ui.teslim[x.i] = { at: performance.now() + 1800, txt: tName(x.a, x.k)[0], b: t('YERLEŞTİ') }; ui.pop.add(x.i); }
  redraw(x); Snd.unlock(); buzz.success();
  settleToast(x);
  sayEvent('tenok', x.k, x); Funnel.tenant('settle', x); persist();
};
tenantHooks.leave = x => { redraw(x); toast(leaveText(x), 3000); Funnel.tenant('leave', x); };
tenantHooks.renov = x => { redraw(x); sayEvent('tenrv', x.k, x); Funnel.tenant('renov', x); };
tenantHooks.end = x => { redraw(x); toast(endText(x), 3000); Funnel.tenant('end', x); };
