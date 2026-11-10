/* ETKİNLİK KARTLARI ve YOKKEN KAZANÇ */
import { CFG, COLS, N, DMAP, BuildingType } from '../config';
import { S, lotsOf } from '../state';
import { fmt, fmtTime } from '../format';
import { t, nm, pctTxt } from '../i18n';
import { now, totalRate, producing, baseRate } from '../economy';
import { I } from '../icons';
import { Snd } from '../sound';
import { svg } from '../draw';
import { lmSvg } from '../landmarks';
import { openModal, closeModal, bump, toast } from '../ui/modal';
import { addCash, addBoost } from './actions';
import { track } from './tasks';
import { lmLeft } from './collection';
import { Ads } from '../services/ads';
import { payLien } from './district';

interface Ev { ic?: string; art?: string; title: string; text: string; big?: boolean; rw: (m: number) => string; apply: (m: number) => void; }

function pickEvent(): Ev {
  const R = totalRate(false), list: { w: number; e: () => Ev }[] = [], cur = S.cur, dn = nm(DMAP[cur].n);
  const any = (t: BuildingType) => S.own.some(k => lotsOf(S, k).some(p => producing(p) && p.t === t));
  list.push({ w: 3, e: () => { const a = Math.max(60, R * Math.max(90, CFG.CARD_FLOOR_SEC)); return { ic: I.coin, title: t('Vergi iadesi'), text: t('Belediye fazla ödediğin emlak vergisini geri yatırdı.'), rw: m => fmt(a * m), big: true, apply: m => { addCash(a * m); bump(); } }; } });
  list.push({ w: 2, e: () => { const a = Math.max(150, R * Math.max(180, CFG.CARD_FLOOR_SEC * 2)); return { ic: I.coin, title: t('Yatırımcı ziyareti'), text: t('Bir yatırımcı portföyünü beğendi ve danışmanlık ücreti ödedi.'), rw: m => fmt(a * m), big: true, apply: m => { addCash(a * m); bump(); } }; } });
  const rows = [...new Set(lotsOf(S, cur).map((p, i) => producing(p) ? Math.floor(i / COLS) : -1).filter(r => r >= 0))];
  if (rows.length) list.push({ w: 3, e: () => { const r = rows[Math.floor(Math.random() * rows.length)]; return { ic: I.train, title: t('Metro geliyor'), text: t('{d}\'de bir sokağa durak açılıyor. O sokaktaki kiralar ikiye katlanıyor.', { d: dn }), rw: m => t('{n} dk 2x kira', { n: 3 * m }), apply: m => { S.fx.push({ k: 'row', d: cur, r, x: 2, until: now() + 3 * 60e3 * m }); } }; } });
  if (any('kafe')) list.push({ w: 2, e: () => ({ ic: I.spark, title: t('Turist akını'), text: t('Şehre turist akını var. Kafeler tıklım tıklım.'), rw: m => t('{n} dk kafeler 3x', { n: 2 * m }), apply: m => { S.fx.push({ k: 'type', t: 'kafe', x: 3, until: now() + 2 * 60e3 * m }); } }) });
  if (any('ev')) list.push({ w: 2, e: () => ({ ic: I.spark, title: t('Öğrenci sezonu'), text: t('Üniversiteler açıldı, herkes kiralık ev arıyor.'), rw: m => t('{n} dk evler 2x', { n: 3 * m }), apply: m => { S.fx.push({ k: 'type', t: 'ev', x: 2, until: now() + 3 * 60e3 * m }); } }) });
  if (any('dukkan')) list.push({ w: 1, e: () => ({ ic: I.spark, title: t('Alışveriş çılgınlığı'), text: t('Çarşı kalabalık, dükkânlar rekor kırıyor.'), rw: m => t('{n} dk dükkânlar 3x', { n: 2 * m }), apply: m => { S.fx.push({ k: 'type', t: 'dukkan', x: 3, until: now() + 2 * 60e3 * m }); } }) });
  const left = lmLeft();
  if (left.length) list.push({ w: 1, e: () => { const l = left[Math.floor(Math.random() * left.length)]; return { art: lmSvg(l.id), title: t('Tarihi yapı bulundu'), text: t('Tapu arşivinde {name} kaydı çıktı. Koleksiyonuna eklenince tüm kiralar %5 artar.', { name: t(l.n) }), rw: m => m > 1 ? t('yapı + {amt}', { amt: fmt(Math.max(1000, totalRate(false) * 600)) }) : t('Yapıyı al'), apply: m => { if (!S.coll.includes(l.id)) S.coll.push(l.id); if (m > 1) addCash(Math.max(1000, totalRate(false) * 600)); toast(t('{name} koleksiyonda', { name: t(l.n) })); } }; } });
  if (!S.disc) list.push({ w: 2, e: () => ({ ic: I.tag, title: t('Müteahhit indirimi'), text: t('Tanıdık bir müteahhit sonraki inşaatın için indirim yapacak.'), rw: m => t('{pct} indirim', { pct: pctTxt(25 * m) }), apply: m => { S.disc = 0.25 * m; } }) });
  let r = Math.random() * list.reduce((s, x) => s + x.w, 0);
  for (const x of list) { if ((r -= x.w) <= 0) return x.e(); }
  return list[0].e();
}
export function showEvent() {
  const ev = pickEvent();
  openModal(`<div class="card">${ev.art ? `<div class="lmhero bpbg">${svg(ev.art)}</div>` : `<div class="badge">${ev.ic}</div>`}<h3>${ev.title}</h3><p>${ev.text}</p>
    ${ev.big ? `<div class="big">${ev.rw(1)}</div>` : ''}
    <div class="btns"><button class="btn gold" data-a="x2">${I.play} ${ev.big ? t('İzle, 2 katını al') : t('İzle, {reward}', { reward: ev.rw(2) })}</button>
    <button class="txt" data-a="x1">${ev.big ? t('Al') : ev.art ? ev.rw(1) : t('Normal ödülü al')}</button></div></div>`,
    a => {
      track('event');
      if (a === 'x1') { ev.apply(1); closeModal(); Snd.collect(3); }
      if (a === 'x2') { closeModal(); Ads.rewarded('event', ev.rw(2), () => ev.apply(2), () => { ev.apply(1); Snd.collect(3); }); } // reklam olmazsa normal ödül
    });
}

/** Uygulama dışında geçen süre: kumbaralar dolar; 2 dk'dan uzunsa yokken kazanç kartı. */
export function catchUp(ms: number) {
  if (!(ms > 0)) return;
  for (const k of S.own) for (let i = 0; i < N; i++) {
    const p = lotsOf(S, k)[i]; if (!producing(p)) continue;
    const b = baseRate(k, i), cap = b * CFG.CAP_SEC; if (p.buf < cap) p.buf = Math.min(cap, p.buf + b * ms / 1000);
  }
  if (ms < 120e3) return;
  const away0 = Math.min(ms, CFG.OFFLINE_MAX);
  for (const k of Object.keys(S.lien)) { let r = 0; for (let i = 0; i < N; i++) r += baseRate(k, i); payLien(k, r * away0 / 1000 * CFG.OFFLINE_RATE * CFG.KAPORA_SHARE); }
  const away = away0, boostAway = Math.max(0, Math.min(S.boostUntil, now()) - (now() - ms));
  const lump = totalRate(false) * (away + Math.min(boostAway, away)) / 1000 * CFG.OFFLINE_RATE;
  if (lump < 1) return;
  openModal(`<div class="card"><div class="badge">${I.moon}</div><h3>${t('Sen yokken')}</h3><p>${t('{time} boyunca kiralar yattı.', { time: fmtTime(away) })}</p>
    <div class="big">${fmt(lump)}</div>
    <div class="btns"><button class="btn gold" data-a="x3">${I.play} ${t('İzle, 3 katını al')}</button>
    <button class="txt" data-a="x1">${t('Al')}</button></div></div>`,
    a => {
      if (a === 'x1') { addCash(lump); bump(); closeModal(); Snd.collect(4); }
      // reklam gösterilemez ya da yarıda kalırsa en azından 1 katı verilir
      if (a === 'x3') { closeModal(); Ads.rewarded('offline', t('{amt} kira', { amt: fmt(lump * 3) }), () => { addCash(lump * 3); bump(); }, () => { addCash(lump); bump(); Snd.collect(4); }); }
    });
}

