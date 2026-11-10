/* SÜRELİ FIRSATLAR — kısa hedef, sayaç ve ödül */
import { S, lotsOf } from '../state';
import { CFG } from '../config';
import { fmt } from '../format';
import { now, totalRate, producing } from '../economy';
import { I } from '../icons';
import { Snd, buzz } from '../sound';
import { openModal, closeModal, bump } from '../ui/modal';
import { addCash } from './actions';
import { Ads } from '../services/ads';
import { persist } from './persist';
import { t, tk } from '../i18n';

const OFFERS = [
  { k: 'upgrade', goal: 3, min: 10, title: tk('Kentsel dönüşüm'), text: tk('10 dakika içinde 3 binaya kat çık.'), need: () => lotsOf(S, S.cur).some(producing) },
  { k: 'collect', goal: 40, min: 5, title: tk('Kira maratonu'), text: tk('5 dakika içinde 40 kez kira topla.'), need: () => lotsOf(S, S.cur).filter(producing).length >= 3 },
  { k: 'build', goal: 2, min: 8, title: tk('Hızlı müteahhit'), text: tk('8 dakika içinde 2 yeni bina kur.'), need: () => lotsOf(S, S.cur).filter(p => !p).length >= 2 },
  { k: 'taxi', goal: 2, min: 8, title: tk('Altın taksi avı'), text: tk('8 dakika içinde 2 altın taksi yakala. Taksiler daha sık geçecek.'), need: () => true },
];
export const offerReward = () => Math.max(1500, totalRate(false) * CFG.CARD_FLOOR_SEC);
export function showOffer() {
  const list = OFFERS.filter(o => o.need()); if (!list.length) return;
  const o = list[Math.floor(Math.random() * list.length)], rw = offerReward();
  openModal(`<div class="card"><div class="badge">${I.clock}</div><h3>${t(o.title)}</h3><p>${t(o.text)}</p>
    <div class="big">${fmt(rw)}</div>
    <div class="btns"><button class="btn gold" data-a="ok">${t('Kabul et')}</button><button class="txt" data-a="no" data-back>${t('Şimdi değil')}</button></div></div>`,
    a => { closeModal(); if (a === 'ok') { S.offer = { k: o.k, goal: o.goal, prog: 0, until: now() + o.min * 60e3, title: o.title, rw, done: false }; if (o.k === 'taxi') S.nextTaxi = S.playMs + 8e3; persist(); } });
}
export function offerComplete() {
  const o = S.offer!; Snd.unlock(); buzz.success();
  const claim = (m: number) => { addCash(o.rw * m); bump(); S.offer = null; persist(); };
  openModal(`<div class="card"><div class="badge">${I.check}</div><h3>${t('{title} tamam', { title: t(o.title) })}</h3><p>${t('Süre bitmeden başardın.')}</p>
    <div class="big">${fmt(o.rw)}</div>
    <div class="btns"><button class="btn gold" data-a="x2">${I.play} ${t('İzle, {n} katını al', { n: 2 })}</button><button class="txt" data-a="x1">${t('Al')}</button></div></div>`,
    a => { closeModal(); if (a === 'x1') claim(1); else Ads.rewarded('offer', t('{n} ödül', { n: fmt(o.rw * 2) }), () => claim(2), () => claim(1)); }); // reklam olmazsa 1 kat
}
