/* ETKİNLİK KARTLARI ve YOKKEN KAZANÇ */
import { CFG, COLS, N, DMAP, BuildingType } from '../config';
import { S, lotsOf } from '../state';
import { fmt, fmtTime } from '../format';
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

interface Ev { ic?: string; art?: string; title: string; text: string; big?: boolean; rw: (m: number) => string; apply: (m: number) => void; }

function pickEvent(): Ev {
  const R = totalRate(false), list: { w: number; e: () => Ev }[] = [], cur = S.cur, dn = DMAP[cur].n;
  const any = (t: BuildingType) => S.own.some(k => lotsOf(S, k).some(p => producing(p) && p.t === t));
  list.push({ w: 3, e: () => { const a = Math.max(60, R * 90); return { ic: I.coin, title: 'Vergi iadesi', text: 'Belediye fazla ödediğin emlak vergisini geri yatırdı.', rw: m => fmt(a * m), big: true, apply: m => { addCash(a * m); bump(); } }; } });
  list.push({ w: 2, e: () => { const a = Math.max(150, R * 180); return { ic: I.coin, title: 'Yatırımcı ziyareti', text: 'Bir yatırımcı portföyünü beğendi ve danışmanlık ücreti ödedi.', rw: m => fmt(a * m), big: true, apply: m => { addCash(a * m); bump(); } }; } });
  const rows = [...new Set(lotsOf(S, cur).map((p, i) => producing(p) ? Math.floor(i / COLS) : -1).filter(r => r >= 0))];
  if (rows.length) list.push({ w: 3, e: () => { const r = rows[Math.floor(Math.random() * rows.length)]; return { ic: I.train, title: 'Metro geliyor', text: `${dn}'de bir sokağa durak açılıyor. O sokaktaki kiralar ikiye katlanıyor.`, rw: m => `${3 * m} dk 2x kira`, apply: m => { S.fx.push({ k: 'row', d: cur, r, x: 2, until: now() + 3 * 60e3 * m }); } }; } });
  if (any('kafe')) list.push({ w: 2, e: () => ({ ic: I.spark, title: 'Turist akını', text: 'Şehre turist akını var. Kafeler tıklım tıklım.', rw: m => `${2 * m} dk kafeler 3x`, apply: m => { S.fx.push({ k: 'type', t: 'kafe', x: 3, until: now() + 2 * 60e3 * m }); } }) });
  if (any('ev')) list.push({ w: 2, e: () => ({ ic: I.spark, title: 'Öğrenci sezonu', text: 'Üniversiteler açıldı, herkes kiralık ev arıyor.', rw: m => `${3 * m} dk evler 2x`, apply: m => { S.fx.push({ k: 'type', t: 'ev', x: 2, until: now() + 3 * 60e3 * m }); } }) });
  if (any('dukkan')) list.push({ w: 1, e: () => ({ ic: I.spark, title: 'Bayram alışverişi', text: 'Çarşı kalabalık, dükkânlar rekor kırıyor.', rw: m => `${2 * m} dk dükkânlar 3x`, apply: m => { S.fx.push({ k: 'type', t: 'dukkan', x: 3, until: now() + 2 * 60e3 * m }); } }) });
  const left = lmLeft();
  if (left.length) list.push({ w: 1, e: () => { const l = left[Math.floor(Math.random() * left.length)]; return { art: lmSvg(l.id), title: 'Tarihi yapı bulundu', text: `Tapu arşivinde ${l.n} kaydı çıktı. Koleksiyonuna eklenince tüm kiralar %5 artar.`, rw: m => m > 1 ? `yapı + ${fmt(Math.max(1000, totalRate(false) * 600))}` : 'Yapıyı al', apply: m => { if (!S.coll.includes(l.id)) S.coll.push(l.id); if (m > 1) addCash(Math.max(1000, totalRate(false) * 600)); toast(l.n + ' koleksiyonda'); } }; } });
  if (!S.disc) list.push({ w: 2, e: () => ({ ic: I.tag, title: 'Müteahhit indirimi', text: 'Tanıdık bir müteahhit sonraki inşaatın için indirim yapacak.', rw: m => `%${25 * m} indirim`, apply: m => { S.disc = 0.25 * m; } }) });
  let r = Math.random() * list.reduce((s, x) => s + x.w, 0);
  for (const x of list) { if ((r -= x.w) <= 0) return x.e(); }
  return list[0].e();
}
export function showEvent() {
  const ev = pickEvent();
  openModal(`<div class="card">${ev.art ? `<div class="lmhero bpbg">${svg(ev.art)}</div>` : `<div class="badge">${ev.ic}</div>`}<h3>${ev.title}</h3><p>${ev.text}</p>
    ${ev.big ? `<div class="big">${ev.rw(1)}</div>` : ''}
    <div class="btns"><button class="btn gold" data-a="x2">${I.play} İzle, ${ev.big ? '2 katını al' : ev.rw(2)}</button>
    <button class="txt" data-a="x1">${ev.big ? 'Al' : ev.art ? ev.rw(1) : 'Normal ödülü al'}</button></div></div>`,
    a => {
      track('event');
      if (a === 'x1') { ev.apply(1); closeModal(); Snd.collect(3); }
      if (a === 'x2') { closeModal(); Ads.rewarded('event', ev.rw(2), () => ev.apply(2)); }
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
  const away = Math.min(ms, CFG.OFFLINE_MAX), boostAway = Math.max(0, Math.min(S.boostUntil, now()) - (now() - ms));
  const lump = totalRate(false) * (away + Math.min(boostAway, away)) / 1000 * CFG.OFFLINE_RATE;
  if (lump < 1) return;
  openModal(`<div class="card"><div class="badge">${I.moon}</div><h3>Sen yokken</h3><p>${fmtTime(away)} boyunca kiralar yattı.</p>
    <div class="big">${fmt(lump)}</div>
    <div class="btns"><button class="btn gold" data-a="x3">${I.play} İzle, 3 katını al</button>
    <button class="txt" data-a="x1">Al</button></div></div>`,
    a => {
      if (a === 'x1') { addCash(lump); bump(); closeModal(); Snd.collect(4); }
      if (a === 'x3') { closeModal(); Ads.rewarded('offline', `${fmt(lump * 3)} kira`, () => { addCash(lump * 3); bump(); }); }
    });
}
