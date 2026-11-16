/* KİRACI KARTI ve KİRACI DEFTERİ + kiracı olaylarının arayüz bağlantısı (Rıfkı Abi, YERLEŞTİ mührü, bildirim, kayıt).
   Mantık game/tenants.ts'te (arayüz içe aktarmaz); burası yalnız gösterim ve tenantHooks kaydı. */
import { CFG, DMAP, TYPES, LV_INC } from '../../config';
import { S, lotsOf } from '../../state';
import { fmt, clock } from '../../format';
import { rate, incM, permMult, ruleMult, districtMult } from '../../economy';
import { t, nm } from '../../i18n';
import { Snd, buzz } from '../../sound';
import { ui } from '../ctx';
import { toast } from '../modal';
import { tenantFace, tenantBadge } from '../tenantFace';
import {
  tenantAt, tenantHooks, tName, quote, wishShort, wishLink, goLabel, inProgress, handKey, targetLot, ARCHS, Tenant, bonusPct,
  stampsOf, leaveText, endText,
} from '../../game/tenants';
import { sayEvent } from '../../game/rifki';
import { persist } from '../../game/persist';
import { Analytics } from '../../services/analytics';
import { Panel, STAY, openSheet, closeSheet, lv } from './core';

const where = (x: Tenant) => {
  const p = lotsOf(S, x.k)[x.i], d = nm(DMAP[x.k].n);
  return p ? t('{d} · {b}, kat {l}', { d, b: t(TYPES[p.t].n), l: p.lvl }) : t('{d} · boş arsa', { d });
};
/** Bu binaya getirisi (sn başına): yerleşmişse gerçek pay, değilse bugünkü kiranın (boş arsada kurulacak binanın 1. kat kirasının) bonusu. */
function gain(x: Tenant): number {
  const b = CFG.TEN_BONUS;
  if (x.w.k === 'new' && !lotsOf(S, x.k)[x.i]) { const ty = x.w.t!; return TYPES[ty].inc * LV_INC[1] * incM(x.k) * permMult() * ruleMult(x.k, x.i, ty) * districtMult(x.k) * b; }
  const r = rate(x.k, x.i);
  return x.st === 'live' ? r - r / (1 + b) : r * b;
}
const mins = (ms: number) => Math.ceil(Math.max(0, ms) / 60e3);
const leftTxt = (x: Tenant) => (x.st === 'live' ? t('{m} dk', { m: mins(x.end - S.playMs) }) : inProgress(x) ? t('usta çalışıyor · süre durdu') : clock(Math.max(0, x.dl - S.playMs)));

export const kiraci: Panel<{ x: Tenant | null }> = {
  sig(s, _tn, c) { const x = c.x = tenantAt(s.key!, s.i!); return 'tn|' + (x ? x.id + x.st + (inProgress(x) ? 'p' : '') + (x.dl - S.playMs < CFG.TEN_NOTE ? 'n' : '') : '-'); },
  render(_s, _tn, { x }) {
    if (!x) return `<p class="sec">${t('Kiracı adayı')}</p><p class="gdp">${t('Kiracı adayı başka bir yere baktı. Yenisi gelir.')}</p>
      <div class="btns"><button class="txt" data-a="defter">${t('Kiracı defteri')}</button></div>`;
    const [name, role] = tName(x.a, x.k), live = x.st === 'live', ready = x.st === 'ready';
    const head = live ? t('KİRACI · YERLEŞTİ') : ready ? t('İSTEĞİ OLDU') : t('KİRACI ADAYI');
    return `<div class="sh-head tn-head"><div class="tn-por">${tenantFace(x.a, live || ready ? 'happy' : 'wait')}</div>
        <div class="sh-t"><p class="sec tn-sec">${head}</p><h3>${name}</h3><p>${role} · ${where(x)}</p></div></div>
      <blockquote class="tn-q">“${quote(x)}”</blockquote>
      <div class="ledger tn-led">
        <div><span>${t('İstek')}</span><i></i><b>${wishShort(x)}</b></div>
        <div><span>${t('Kazandırır')}</span><i></i><b class="up">${t('+{p} kira · {m} dk', { p: bonusPct(), m: Math.round(CFG.TEN_LIVE / 60e3) })}</b></div>
        <div><span>${t('Bu binaya')}</span><i></i><b>+${lv('tng', () => t('{v}/sn', { v: fmt(gain(x), true) }))}</b></div>
        <div><span>${live ? t('Sözleşme') : t('Kalan süre')}</span><i></i><b class="${!live && x.dl - S.playMs < CFG.TEN_NOTE ? 'red' : ''}">${lv('tnl', () => leftTxt(x))}</b></div>
        <div class="rule"><span>${t('Bağlantı')}</span><i></i><b>${wishLink(x)}</b></div>
      </div>
      <div class="btns">${live ? '' : ready ? `<button class="btn gold" data-a="key">${t('Anahtarı ver')}</button>` : `<button class="btn" data-a="go">${goLabel(x)}</button>`}
        <button class="txt" data-a="defter">${t('Kiracı defteri')}</button></div>
      <p class="note">${live ? t('Sözleşme bitince {n} teşekkür edip taşınır; defterindeki pulu kalır.', { n: name }) : t('İstek karşılanmazsa {n} başka yere bakar. Ceza yok, yalnızca bonus kaçar.', { n: name })}</p>`;
  },
  action(a, _b, s) {
    if (a === 'defter') { openSheet({ k: 'defter' }); return STAY; }
    const x = tenantAt(s.key!, s.i!); if (!x) return;
    if (a === 'go') { openSheet({ k: 'plot', key: x.k, i: targetLot(x) }); return STAY; }
    if (a === 'key') { handKey(x); closeSheet(); return STAY; }
  },
};

/** Kiracı defteri: 6 tip, tanışılan / yerleşen; bir tipten CFG.TEN_STAMP yerleşmede "müdavim" pulu. Yalnız koleksiyon: kiraya etkisi yok. */
export const defter: Panel = {
  sig: () => 'df|' + S.cur + JSON.stringify(S.tdef || {}),
  render() {
    const d = S.tdef || {}, need = Math.max(1, Math.floor(CFG.TEN_STAMP));
    return `<p class="sec">${t('Kiracı defteri')}</p><p class="gdp">${t('Tanıştığın kiracılar. Bir tipten {n} kiracı yerleşince müdavim pulu basılır; 6 pulun hepsi “Kiracı yeşili” cephe rengini açar. Kiraya etkisi yok, yalnızca görünüm.', { n: need })}</p>
      <div class="tdf">${ARCHS.map(a => {
        const r = d[a] || { met: 0, ok: 0 }, [name, role] = tName(a), seen = r.met > 0 || r.ok > 0, done = r.ok >= need;
        return `<div class="tdc${seen ? '' : ' unk'}${done ? ' done' : ''}" data-arch="${a}"><div class="tdp">${seen ? tenantBadge(a, r.ok ? 'happy' : 'wait') : '<b aria-hidden="true">?</b>'}</div>
          <b class="tdn">${seen ? name : '???'}</b><small>${seen ? role : t('henüz gelmedi')}</small>
          <span class="tds" role="img" aria-label="${t('{n}/{m} yerleşti', { n: Math.min(r.ok, need), m: need })}">${Array.from({ length: need }, (_, n) => `<i class="${n < r.ok ? 'on' : ''}"></i>`).join('')}</span>${done ? `<em>${t('MÜDAVİM')}</em>` : ''}</div>`;
      }).join('')}</div>
      <p class="note u-tc">${t('{n}/6 pul', { n: stampsOf(d) })}</p>`;
  },
};

/* ---------- olaylar: Rıfkı Abi tanıtır, hatırlatır, haber verir, kutlar; gidişte konuşmaz (kısa bildirim, suçlamaz) ---------- */
const redraw = (x: Tenant) => { if (x.k === S.cur) ui.tileSig[x.i] = ''; ui.sheetSig = ''; };
tenantHooks.arrive = x => { redraw(x); sayEvent('ten', x.k, x); Analytics.log('tenant_arrive', { arch: x.a, wish: x.w.k }); persist(); };
tenantHooks.note = x => sayEvent('tennote', x.k, x);
tenantHooks.ready = x => { redraw(x); sayEvent('tenready', x.k, x); };
tenantHooks.settle = x => {
  if (x.k === S.cur) { ui.teslim[x.i] = { at: performance.now() + 1800, txt: tName(x.a, x.k)[0], b: t('YERLEŞTİ') }; ui.pop.add(x.i); }
  redraw(x); Snd.unlock(); buzz.success();
  if ((S.tdef[x.a] || { ok: 0 }).ok === Math.max(1, Math.floor(CFG.TEN_STAMP))) // müdavim pulu (6'sı: Kiracı yeşili cephe rengi)
    toast(stampsOf() >= ARCHS.length ? t('Kiracı defteri tamam: “Kiracı yeşili” cephe rengi açıldı') : t('Kiracı defterine müdavim pulu basıldı: {n}', { n: tName(x.a, x.k)[0] }), 3000);
  sayEvent('tenok', x.k, x); Analytics.log('tenant_settle', { arch: x.a, wish: x.w.k }); persist();
};
tenantHooks.leave = x => { redraw(x); toast(leaveText(x), 3000); };
tenantHooks.end = x => { redraw(x); toast(endText(x), 3000); };
