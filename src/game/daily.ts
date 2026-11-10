/* GÜNLÜK KİRA GÜNÜ — 7 günlük seri; 1-2 gün kaçıran reklamla seriyi kurtarabilir */
import { S } from '../state';
import { CFG } from '../config';
import { fmt, dayKey, dayDiff } from '../format';
import { now, totalRate } from '../economy';
import { I } from '../icons';
import { Snd } from '../sound';
import { openModal, closeModal, bump } from '../ui/modal';
import { addCash, addBoost } from './actions';
import { addXp } from './fun';
import { Ads } from '../services/ads';
import { persist } from './persist';
import { Analytics } from '../services/analytics';
import { t } from '../i18n';

const DAILY_X = [1, 1.5, 2, 3, 4, 5, 12]; // 7. gün büyük nakit ödül
export const dailyAmount = (n: number) => Math.max(250 * n, totalRate(false) * 90 * DAILY_X[(n - 1) % 7]);
export function streakStrip(cur: number, doneUpTo: number) {
  return `<div class="streak">${[1, 2, 3, 4, 5, 6, 7].map(d => `<div class="dbox${d <= doneUpTo ? ' done' : ''}${d === cur ? ' today' : ''}"><small>${t('GÜN')}</small>${d === 7 ? '★' : d}</div>`).join('')}</div>`;
}
export function checkDaily() {
  const today = dayKey(new Date(now())), Dd = S.daily; if (Dd.last === today) return;
  const gap = Dd.last ? dayDiff(Dd.last, today) : 1;
  if (gap < 0) return; // saat geri alınmış: ödül verme
  if (Dd.last && gap > 1 && Dd.streak > 0) {
    if (gap <= 3) {
      const keep = Dd.streak;
      openModal(`<div class="card"><div class="badge">${I.cal}</div><h3>${t('Serin bozuldu')}</h3><p>${t('{gap} gün uğramadın. {keep} günlük serini kurtarabilirsin.', { gap: gap - 1, keep })}</p>
        <div class="btns"><button class="btn gold" data-a="save">${I.play} ${t('İzle, seriyi kurtar')}</button><button class="txt" data-a="reset">${t('Baştan başla')}</button></div></div>`,
        a => { closeModal(); if (a === 'save') Ads.rewarded('streak', t('Seri kurtarıldı'), () => showDaily(keep + 1), checkDaily); else { Dd.streak = 0; showDaily(1); } });
      // reklam olmazsa seri bedava kurtarılmaz: aynı kart yeniden açılır, oyuncu tekrar deneyebilir ya da baştan başlar
      return;
    }
    Dd.streak = 0;
  }
  showDaily(Dd.streak + 1);
}
export function showDaily(n: number) {
  const amt = dailyAmount(n), day = (n - 1) % 7 + 1, big = day === 7, mx = big ? CFG.DAILY7_X : 2; // 7. gün reklam çarpanı daha yüksek
  const claim = (m: number) => { addXp(40); addCash(amt * m); bump(); S.daily = { last: dayKey(new Date(now())), streak: n }; persist(); Analytics.log('daily_claim', { day: n, doubled: m > 1 }); };
  openModal(`<div class="card"><div class="badge">${I.cal}</div><h3>${t('{n}. gün kira günü', { n })}</h3><p>${t('Her gün uğra, 7. gün büyük ödül.')}</p>
    ${streakStrip(day, day - 1)}<div class="big">${fmt(amt)}</div>${big ? `<p><b>${t('Haftanın büyük kira ödülü')}</b></p>` : ''}
    <div class="btns"><button class="btn gold" data-a="x2">${I.play} ${t('İzle, {n} katını al', { n: mx })}</button><button class="txt" data-a="x1">${t('Al')}</button></div></div>`,
    a => { closeModal(); if (a === 'x1') { claim(1); Snd.collect(5); } else Ads.rewarded('daily', t('{n} kira', { n: fmt(amt * mx) }), () => claim(mx), () => { claim(1); Snd.collect(5); }); }); // reklam olmazsa 1 kat
}
