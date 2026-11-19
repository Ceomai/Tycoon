/* BANKA PANELİ — üç sekme: Aktar (bölgeler arası havale), Kur (gün içi 24 saat + 7 gün grafik), Bilanço (tüm bölgeler tek
   para biriminde). Hesaplar game/bankcore.ts, aktarım ve teslim game/bank.ts. Tutarlar iç birimde tutulur, her bölgenin
   kendi fiyat seviyesiyle (config.ts priceLevel) yazılır (format.ts fmtIn / money). */
import { REGIONS, REGION, REGION_ORDER, RegionId, CITIES, CFG, CurId, CUR_SYM } from '../../config';
import { S } from '../../state';
import { fmtIn, moneySigned, esc } from '../../format';
import { now } from '../../economy';
import { I } from '../../icons';
import { t, nm, LANG, units } from '../../i18n';
import { ui } from '../ctx';
import { openModal, closeModal, toast } from '../modal';
import { rifkiFace } from '../rifkiFace';
import { Snd } from '../../sound';
import { switchRegion } from '../../game/loop';
import { CURS, CUR_OF, CUR_N, worthIn, quote, fxPair, rnum, curWord, hist, valueOf, type Sheet } from '../../game/bankcore';
import { REG, loadAll, capLeft, maxSend, transfer, bankOpen, cheapCur, pendingTo } from '../../game/bank';
import { Panel, STAY, lv, openSheet } from './core';
import { Funnel } from '../../services/funnel';

const regName = (r: RegionId) => t(REGIONS[r].n);
const symOf = (r: RegionId) => REGIONS[r].cur;
const RCOL: Record<RegionId, string> = { tr: 'var(--stamp)', us: 'var(--win-blue2)', uk: 'var(--guil)', de: 'var(--gold-d)', jp: 'var(--up)', gl: 'var(--muted)' };
const CCOL: Record<CurId, string> = { TRY: RCOL.tr, USD: RCOL.us, GBP: RCOL.uk, EUR: RCOL.de, JPY: RCOL.jp };
const PICKS = [0.1, 0.25, 0.5, 1]; // 1 = en çok (hak ya da kasanın yarısı)
const dec = () => units().dec;
/** Yüzde (ondalıklı): Türkçede %0,4, diğerlerinde 0.4%. */
const pctD = (x: number, d = 1) => { const n = Math.abs(x * 100).toFixed(d).replace('.', dec()); return LANG === 'tr' ? '%' + n : n + '%'; };
const pair = fxPair;
const inCur = worthIn; // iç birim (r bölgesinde) → c parasıyla gerçek değer
const fmtC = (v: number, c: CurId) => moneySigned(v, CUR_SYM[c], true); // net eksi olabilir (kapora borcu)

let loading = false;
/** Diğer bölgelerin kayıtları panel açıkken en geç 15 sn'de bir diskten okunur (önbellek değil: başka sekme / yeni kayıt). */
function ensure() { if (loading || Date.now() - REG.at < 15e3) return; loading = true; void loadAll(true).finally(() => { loading = false; ui.sheetSig = ''; }); }
const others = () => REGION_ORDER.filter(r => r !== REGION);
const started = (r: RegionId) => !!REG.saves[r];
function amountOf(to: RegionId, pick: number) { const m = maxSend(to); return Math.floor(pick >= 1 ? m : Math.min(m, S.cash * pick)); }
const rifkiNote = (txt: string, mood: 'think' | 'wow') => `<div class="bk-rk"><div class="rk-face" data-mood="${mood}">${rifkiFace(mood)}</div><p><b>${t('RIFKI ABİ')}</b>${txt}</p></div>`;

/* ---------- sekme: aktar ---------- */
function tabSend(s: any): string {
  if (!bankOpen()) return `<p class="note u-mt0 bk-closed">${t('Banka hesabın ikinci semtini alınca ya da {m} kazanınca açılır.', { m: fmtIn(CFG.BANK_OPEN_EARN, REGION) })}</p>`;
  const to: RegionId = s.to && s.to !== REGION && REGION_ORDER.includes(s.to) ? s.to : (others().find(started) || others()[0]);
  s.to = to;
  const tn = now(), pick = s.pick ?? 1, q = quote(REGION, to, tn), amt = amountOf(to, pick), got = Math.floor(amt * q.net), c = capLeft(to);
  const rrow = (r: RegionId) => {
    const sv = REG.saves[r], cl = capLeft(r), on = r === to;
    const st = sv ? `${t('kasa {k}', { k: fmtIn(sv.cash, r) })}<br>${t('hak {h}', { h: fmtIn(cl.left, r) })}` : `${t('başlanmadı')}<br>${t('emanette bekler')}`;
    return `<button class="bk-to${on ? ' on' : ''}${sv ? '' : ' new'}" data-a="to" data-r="${r}" role="radio" aria-checked="${on}"><span class="bk-cur" style="--rc:${RCOL[r]}">${symOf(r)}</span><span class="di"><b>${regName(r)}</b><small>${st}</small></span></button>`;
  };
  const usedPct = c.cap ? Math.min(100, (c.used / c.cap) * 100) : 100, addPct = c.cap ? Math.min(100 - usedPct, (got / c.cap) * 100) : 0;
  const lg = S.bank.log.slice(0, 4).map(l => `<div><span>${l.dir === 'out' ? '→' : '←'} ${regName(l.r)}</span><b class="${l.dir}">${l.dir === 'out' ? '−' : '+'}${fmtIn(l.a, REGION)}</b></div>`).join('');
  return `<p class="sec">${t('Gönderen')}</p>
    <div class="bk-from"><span class="bk-cur" style="--rc:${RCOL[REGION]}">${symOf(REGION)}</span><span class="di"><b>${regName(REGION)}</b><small>${t('Kasa {k} · bir seferde en fazla yarısı', { k: lv('bkc', () => fmtIn(S.cash, REGION)) })}</small></span></div>
    <p class="sec u-mt-7">${t('Alıcı bölge')}</p>
    <div class="bk-list" role="radiogroup" aria-label="${t('Alıcı bölge')}">${others().map(rrow).join('')}</div>
    <p class="sec">${t('Tutar')}</p>
    <div class="seg bk-pick" role="radiogroup" aria-label="${t('Tutar')}">${PICKS.map(p => `<button class="chip${p === pick ? ' on' : ''}" role="radio" aria-checked="${p === pick}" data-a="pick" data-v="${p}">${p >= 1 ? t('En çok') : (LANG === 'tr' ? '%' + Math.round(p * 100) : Math.round(p * 100) + '%')}</button>`).join('')}</div>
    <div class="bk-slip">
      <div class="bk-l"><span>${t('Gönderilen')}</span><b>${fmtIn(amt, REGION, true)}</b></div>
      <div class="bk-l"><span>${t('Kur (şimdi)')}</span><b>${pair(CUR_OF[REGION], CUR_OF[to], q.show)}</b></div>
      <div class="bk-l"><span>${q.spread ? t('Makas %{m} · komisyon %{k}', { m: Math.round(q.spread * 100), k: Math.round(q.fee * 100) }) : t('Komisyon %{k}', { k: Math.round(q.fee * 100) })}</span><b>−${fmtIn(Math.max(0, amt * q.mid - got), to)}</b></div>
      <div class="bk-l bk-tot"><span>${started(to) ? t('{r} kasasına varacak', { r: regName(to) }) : t('Emanette bekleyecek')}</span><b>${fmtIn(got, to)}</b></div>
      <div class="bk-cap"><div class="bk-bar"><i style="width:${usedPct}%"></i><u style="width:${addPct}%"></u></div><small>${t('Bugünkü hak: {u} / {c} · gece yarısı yenilenir', { u: fmtIn(c.used + got, to), c: fmtIn(c.cap, to) })}</small></div>
    </div>
    <div class="btns"><button class="btn gold" data-a="send"${got < 1 ? ' disabled' : ''}>${got < 1 ? (S.cash * CFG.BANK_SRC_SHARE * q.net >= 1 ? t('Bugünkü hak doldu') : t('Kasada aktarılacak para yok')) : `${t('Aktar')} <small>${fmtIn(got, to)}</small>`}</button></div>
    <p class="note">${t('Hak, alıcı bölgenin 30 dakikalık kirası kadardır (en az {f}). Aktarılan para kazanç sayılmaz: haftalık lige, görevlere ve holding hissesine eklenmez.', { f: fmtIn(CFG.BANK_FLOOR, to) })} ${t('Fiyat seviyesi ülkeye göre değişir: aynı para pahalı ülkede daha az, ucuz ülkede daha çok iş görür.')}</p>
    ${lg ? `<p class="sec u-mt-7">${t('Son hareketler')}</p><div class="bk-log">${lg}</div>` : ''}`;
}

/* ---------- sekme: kur ---------- */
const W = 320, H = 132, PX = 6, PY = 14;
/** Büyük grafik (tek seri: seçili paranın oynanan paradaki kuru). Dokununca / üstünde gezinince o saatin kuru (bk-chv). */
function chart(vals: number[], t0: number, stepH: number, from: CurId, to: CurId): string {
  const lo = Math.min(...vals), hi = Math.max(...vals), sp = hi - lo || hi * 0.001;
  const X = (k: number) => PX + k * (W - 2 * PX) / (vals.length - 1), Y = (v: number) => PY + (hi - v) / sp * (H - 2 * PY);
  const pts = vals.map((v, k) => `${X(k).toFixed(1)},${Y(v).toFixed(1)}`).join(' '), n = vals.length - 1;
  const grid = [0, 0.5, 1].map(f => `<line class="g" x1="0" x2="${W}" y1="${(PY + f * (H - 2 * PY)).toFixed(1)}" y2="${(PY + f * (H - 2 * PY)).toFixed(1)}"/>`).join('');
  return `<div class="bk-chw"><svg class="bk-ch" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(t('Kur grafiği'))}"
      data-v="${vals.map(v => v.toPrecision(6)).join(',')}" data-t0="${t0}" data-st="${stepH}" data-p="${CUR_SYM[from]}|${CUR_SYM[to]}">
      ${grid}<polyline points="${pts}"/><line class="x" x1="${X(n)}" x2="${X(n)}" y1="0" y2="${H}"/><circle class="m" cx="${X(n).toFixed(1)}" cy="${Y(vals[n]).toFixed(1)}" r="4"/></svg>
    <div class="bk-chax"><span>${t('en yüksek')} ${rnum(hi)}</span><span class="bk-chv" aria-live="polite">${pair(from, to, vals[n])}</span><span>${t('en düşük')} ${rnum(lo)}</span></div></div>`;
}
const spark = (vals: number[]) => {
  const lo = Math.min(...vals), hi = Math.max(...vals), sp = hi - lo || hi * 0.001, w = 64, h = 24;
  const pts = vals.map((v, k) => `${(k * w / (vals.length - 1)).toFixed(1)},${(h - 3 - (v - lo) / sp * (h - 6)).toFixed(1)}`).join(' ');
  const last = pts.split(' ').pop()!.split(',');
  return `<svg class="bk-sp" viewBox="0 0 ${w} ${h}" aria-hidden="true"><polyline points="${pts}"/><circle cx="${last[0]}" cy="${last[1]}" r="2.6"/></svg>`;
};
/** 24 saat: saatlik 25 nokta · 7 gün: 4 saatlik 43 nokta. */
const series = (from: CurId, to: CurId, tn: number, rng: string) => (rng === 'w' ? { v: hist(from, to, tn, 43, 4), st: 4 } : { v: hist(from, to, tn, 25, 1), st: 1 });
function tabFx(s: any): string {
  const tn = now(), my = CUR_OF[REGION], rng = s.rng === 'w' ? 'w' : 'd', ch = cheapCur(false, tn);
  const list = CURS.filter(c => c !== my), sel: CurId = list.includes(s.fx) ? s.fx : list[0];
  const h0 = Math.floor(tn / 3600e3) * 3600e3;
  const rows = list.map(c => {
    const { v } = series(c, my, tn, rng), d = v[v.length - 1] / v[0] - 1, rs = REGION_ORDER.filter(r => CUR_OF[r] === c).map(regName).join(' · ');
    return `<button class="bk-fx${c === sel ? ' on' : ''}" data-a="fx" data-v="${c}" aria-pressed="${c === sel}"><span class="bk-cur" style="--rc:${CCOL[c]}">${CUR_SYM[c]}</span><span class="di"><b>${t(CUR_N[c])}</b><small>${rs}</small></span>${spark(v)}<span class="bk-q"><b>${pair(c, my, v[v.length - 1])}</b><small class="${d >= 0 ? 'up' : 'dn'}">${d >= 0 ? '▲' : '▼'} ${pctD(d, 2)}</small></span></button>`;
  }).join('');
  const sv = series(sel, my, tn, rng);
  const tip = ch ? rifkiNote(t('Şu an {c} ucuz efendim, haftalık ortalamasının {p} altında. {r} kasasına para göndermenin tam zamanı; kur saat saat değişir.', { c: curWord(CUR_OF[ch.r]), p: pctD(ch.v), r: regName(ch.r) }), 'wow')
    : rifkiNote(t('Kurlar durgun efendim. Acele yok; hakkınız her gece yenilenir.'), 'think');
  return `${tip}
    <div class="bk-fxh"><p class="sec">${t('1 birim kaç {s}', { s: CUR_SYM[my] })}</p><div class="seg bk-rng" role="radiogroup" aria-label="${t('Aralık')}">${[['d', t('24 saat')], ['w', t('7 gün')]].map(([k, n]) => `<button class="chip${k === rng ? ' on' : ''}" role="radio" aria-checked="${k === rng}" data-a="rng" data-v="${k}">${n}</button>`).join('')}</div></div>
    ${chart(sv.v, h0 - (sv.v.length - 1) * sv.st * 3600e3, sv.st, sel, my)}
    <div class="bk-fxs">${rows}</div>
    <p class="note">${t('Kurlar gerçek kurlara yakın taban oranların üstünde saat saat hafifçe oynar: gün içinde en fazla ±%1, haftada ±%3. Herkes için aynıdır. Aktarımda makas %{m} ve komisyon %{k} alınır; bu yüzden gidip gelerek kâr edilemez.', { m: Math.round(CFG.BANK_SPREAD * 100), k: Math.round(CFG.BANK_FEE * 100) })}</p>`;
}
/** Grafikte dokunulan / üstünde gezinilen saatin kuru (panel yeniden çizilmeden). */
function onChart(e: PointerEvent) {
  const sv = (e.target as Element | null)?.closest?.('.bk-ch') as SVGSVGElement | null; if (!sv) return;
  const vals = (sv.dataset.v || '').split(',').map(Number), n = vals.length - 1; if (n < 1) return;
  const r = sv.getBoundingClientRect(), f = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width - PX / W) / (1 - 2 * PX / W));
  const k = Math.round(f * n), x = PX + k * (W - 2 * PX) / n, lo = Math.min(...vals), hi = Math.max(...vals), sp = hi - lo || hi * 0.001;
  sv.querySelector('.x')?.setAttribute('x1', String(x)); sv.querySelector('.x')?.setAttribute('x2', String(x));
  const m = sv.querySelector('.m'); m?.setAttribute('cx', String(x)); m?.setAttribute('cy', String(PY + (hi - vals[k]) / sp * (H - 2 * PY)));
  const at = new Date(+sv.dataset.t0! + k * +sv.dataset.st! * 3600e3), [a, b] = (sv.dataset.p || '|').split('|');
  const when = (+sv.dataset.st! > 1 ? at.toLocaleDateString(LANG === 'tr' ? 'tr-TR' : LANG, { weekday: 'short' }) + ' ' : '') + String(at.getHours()).padStart(2, '0') + ':00';
  const out = sv.parentElement?.querySelector('.bk-chv'); const v = vals[k], nn = v < 0.1 ? 100 : 1;
  if (out) out.textContent = `${when} · ${nn} ${a} = ${b}${rnum(v * nn)}`;
}
if (typeof document !== 'undefined') { document.addEventListener('pointermove', onChart, { passive: true }); document.addEventListener('pointerdown', onChart, { passive: true }); }

/* ---------- sekme: bilanço ---------- */
function tabSheet(s: any): string {
  const tn = now(), cur: CurId = CURS.includes(s.cur) ? s.cur : CUR_OF[REGION];
  // başlanmamış bölgeye yolda bekleyen emanet: o bölgenin satırında ve toplamda (para kaybolmuş görünmesin)
  const rows = REGION_ORDER.map(r => { const v = valueOf(REG.saves[r] || (r === REGION ? S : null)), held = v ? 0 : pendingTo(r); return { r, v, held, net: v ? inCur(v.net, r, cur, tn) : inCur(held, r, cur, tn) }; });
  const act = rows.filter(x => x.v || x.held > 0), tot = act.reduce((a, x) => a + x.net, 0), share = (x: number) => (tot > 0 ? Math.max(0, x) / tot : 0);
  const sum = (f: (v: Sheet) => number) => act.reduce((a, x) => a + (x.v ? inCur(f(x.v), x.r, cur, tn) : 0), 0);
  const heldSum = act.reduce((a, x) => a + (x.v ? 0 : x.net), 0);
  const bar = act.map(x => `<i style="width:${(share(x.net) * 100).toFixed(2)}%;background:${RCOL[x.r]}" title="${esc(regName(x.r))}"></i>`).join('');
  const row = (x: typeof rows[number]) => {
    const cs = REGIONS[x.r].cities.map(c => nm(CITIES[c].n)).slice(0, 3).join(' · ');
    if (!x.v && x.held > 0) return `<div class="bk-reg off"><span class="bk-cur" style="--rc:${RCOL[x.r]}">${symOf(x.r)}</span><span class="di"><b>${regName(x.r)}</b><small>${t('başlanmadı')} · ${t('emanette {m}', { m: fmtIn(x.held, x.r) })}</small></span><span class="bk-q"><b>${fmtC(x.net, cur)}</b><small>${LANG === 'tr' ? '%' + Math.round(share(x.net) * 100) : Math.round(share(x.net) * 100) + '%'}</small></span></div>`;
    if (!x.v) return `<div class="bk-reg off"><span class="bk-cur" style="--rc:var(--line)">${symOf(x.r)}</span><span class="di"><b>${regName(x.r)}</b><small>${cs} · ${t('başlanmadı')}</small></span><span class="bk-q"><b>—</b></span></div>`;
    return `<div class="bk-reg"><span class="bk-cur" style="--rc:${RCOL[x.r]}">${symOf(x.r)}</span><span class="di"><b>${regName(x.r)}${x.r === REGION ? ` <em>${t('burada')}</em>` : ''}</b><small>${t('kasa {k} · mülk {m}', { k: fmtIn(x.v.cash + x.v.rent, x.r), m: fmtIn(x.v.prop, x.r) })}${x.v.debt ? ' · ' + t('borç {b}', { b: fmtIn(x.v.debt, x.r) }) : ''}</small></span><span class="bk-q"><b>${fmtC(x.net, cur)}</b><small>${LANG === 'tr' ? '%' + Math.round(share(x.net) * 100) : Math.round(share(x.net) * 100) + '%'}</small></span></div>`;
  };
  return `<div class="seg bk-curs" role="radiogroup" aria-label="${t('Para birimi')}">${CURS.map(c => `<button class="chip${c === cur ? ' on' : ''}" role="radio" aria-checked="${c === cur}" data-a="cur" data-v="${c}" aria-label="${esc(t(CUR_N[c]))}">${CUR_SYM[c]}</button>`).join('')}</div>
    <div class="bk-big"><small>${t('Toplam net varlık · {c}', { c: t(CUR_N[cur]) })}</small><b>${fmtC(tot, cur)}</b><span>${t('{n} bölge · şimdiki orta kurla', { n: act.filter(x => x.v).length })}</span></div>
    <div class="bk-share" role="img" aria-label="${t('Bölgelere göre pay')}">${bar}</div>
    <div class="bk-regs">${rows.map(row).join('')}</div>
    <div class="bk-sum"><div><span>${t('Kasa ve toplanmamış kira')}</span><b>${fmtC(sum(v => v.cash + v.rent), cur)}</b></div><div><span>${t('Mülkler (semt, bina, proje, ihale)')}</span><b>${fmtC(sum(v => v.prop), cur)}</b></div>${heldSum > 0 ? `<div><span>${t('Emanette (başlanmamış bölgeler)')}</span><b>${fmtC(heldSum, cur)}</b></div>` : ''}<div><span>${t('Kapora borcu')}</span><b>−${fmtC(sum(v => v.debt), cur)}</b></div><div class="bk-tot"><span>${t('Net')}</span><b>${fmtC(tot, cur)}</b></div></div>
    <p class="note">${t('Mülk değeri: tapu bedeli ve yapım maliyetinin %{p}’i. Bilanço yalnızca gösterir; kira ve lig puanı değişmez, paylaşılmaz.', { p: Math.round(CFG.BANK_VALUE_X * 100) })}</p>`;
}

export const banka: Panel = {
  sig(s) { ensure(); return 'bk|' + (s.tab || 'send') + '|' + (s.to || '') + '|' + (s.pick ?? 1) + '|' + (s.cur || '') + '|' + (s.fx || '') + '|' + (s.rng || '') + '|' + REG.at + '|' + S.bank.log.length + '|' + Math.floor(now() / 3600e3) + '|' + Math.floor(Math.log2(1 + S.cash) * 4) + '|' + bankOpen(); },
  render(s) {
    const tab = s.tab || 'send';
    const tabs = [['send', t('Aktar')], ['fx', t('Kur')], ['bil', t('Bilanço')]];
    const body = !REG.at ? `<p class="note u-mt0">${t('Kayıtlar okunuyor…')}</p>` : tab === 'fx' ? tabFx(s) : tab === 'bil' ? tabSheet(s) : tabSend(s);
    return `<div class="sh-head"><div class="badge u-m0">${I.coin}</div><div class="sh-t"><h3>${t('Banka')}</h3><p>${t('Kur · aktarım · bilanço')}</p></div></div>
      <div class="seg bk-tabs" role="tablist">${tabs.map(([k, n]) => `<button class="chip${k === tab ? ' on' : ''}" role="tab" aria-selected="${k === tab}" data-a="tab" data-v="${k}">${n}</button>`).join('')}</div>
      <div class="bk-body">${body}</div>`;
  },
  async action(a, btn, s) {
    const v = btn.dataset.v; Funnel.bankAct(a, v);
    if (a === 'tab') s.tab = v;
    else if (a === 'to') s.to = btn.dataset.r;
    else if (a === 'pick') s.pick = +v!;
    else if (a === 'cur') s.cur = v;
    else if (a === 'fx') s.fx = v;
    else if (a === 'rng') s.rng = v;
    else if (a === 'send') {
      const to = s.to as RegionId, amt = amountOf(to, s.pick ?? 1);
      btn.setAttribute('disabled', '');
      const r = await transfer(to, amt);
      if (!r.ok) {
        toast(r.why === 'cap' ? t('Bugünkü hak doldu') : r.why === 'save' ? t('Aktarım yapılamadı: kayıt yazılamadı, para kasanda kaldı')
          : r.why === 'busy' ? t('Yolda çok havale var: teslim edilince yeniden dene') : t('Aktarım yapılamadı'));
        ui.sheetSig = ''; return;
      }
      Snd.unlock(); ui.sheetSig = '';
      const m = `<b>${fmtIn(r.got, to)}</b>`;
      openModal(`<div class="card bk-done"><div class="bk-stamp">${t('HAVALE')}</div><h3>${r.held ? t('Emanete alındı') : t('{r} kasasına geçti', { r: regName(to) })}</h3>
        <p>${r.held ? t('{m}, {r} bölgesine başladığında başlangıç sermayesi olarak kasanda olacak.', { m, r: regName(to) }) : t('{m} {r} kasasında. Orada harcamak için bölgeye geç.', { m, r: regName(to) })}</p>
        <div class="btns"><button class="btn gold" data-a="go">${t('{r} bölgesine geç', { r: regName(to) })}</button><button class="txt" data-a="stay" data-back>${t('Burada kal')}</button></div></div>`,
        k => { closeModal(); if (k === 'go') { Funnel.bank('go', { to }); switchRegion(to); } else openSheet({ k: 'banka', tab: 'send', to, pick: s.pick }); }); // kart paneli kapatır: geri açılır
      return STAY;
    }
  },
};
