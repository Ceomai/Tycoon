/* GÖREVLER PANELİ — kira günü serisi, günlük görevler, süreli fırsat */
import { S } from '../../state';
import { fmt, dayKey, dayDiff } from '../../format';
import { ui } from '../ctx';
import { ensureTasks, taskText, taskReward, bonusReward, claimTask, claimBonus } from '../../game/tasks';
import { streakStrip } from '../../game/daily';
import { t } from '../../i18n';
import { Panel, STAY, closeSheet, lv, lw } from './core';

export const tasks: Panel<{ done: boolean; pos: number }> = {
  sig(_s, tn, c) {
    ensureTasks(); const T = S.tasks!, d = S.daily, today = dayKey(new Date(tn)), done = c.done = d.last === today;
    const broken = d.last && !done && dayDiff(d.last, today) > 1, nextDay = broken ? 1 : (d.streak % 7) + 1;
    c.pos = done ? ((d.streak - 1) % 7) + 1 : nextDay;
    return 'tk|' + T.day + T.bonus + T.list.map(q => q.k + q.goal + q.claimed + (q.prog >= q.goal ? 1 : 0)).join() + d.last + d.streak + (S.offer ? S.offer.title + S.offer.goal + S.offer.prog + S.offer.done : '');
  },
  render(_s, _tn, { done, pos }) {
    const T = S.tasks!, d = S.daily;
    return `<p class="sec">${t('Kira günü serisi')}</p>${streakStrip(done ? 0 : pos, done ? pos : pos - 1)}
        <p class="note u-mt-3">${done ? t('{n} gündür uğruyorsun. Yarın {g}. günün ödülü hazır olacak.', { n: d.streak, g: (d.streak % 7) + 1 }) : t('Bugünün ödülü seni bekliyor.')}</p>
        ${done ? '' : `<div class="btns"><button class="btn gold" data-a="daily">${t('Bugünün ödülünü al')}</button></div>`}
        <p class="sec u-mt-10">${t('Günlük görevler')}</p>
        ${T.list.map((q, i) => `<div class="task"><div class="tt"><b>${taskText(q)}</b><small>${lv('tp' + i, () => { const x = S.tasks?.list[i]; return !x ? '' : x.k === 'earn' ? fmt(x.prog) + ' / ' + fmt(x.goal) : x.prog + ' / ' + x.goal; })} · ${t('Ödül {m}', { m: fmt(taskReward()) })}</small><div class="tbar"><i ${lw('tb' + i, () => { const x = S.tasks?.list[i]; return x ? Math.round(Math.min(100, x.prog / x.goal * 100)) : 0; })}></i></div></div>
          <button class="chip${q.claimed ? ' got' : ''}" data-a="claim" data-i="${i}" ${q.claimed || q.prog < q.goal ? 'disabled' : ''}>${q.claimed ? t('Alındı') : t('Al')}</button></div>`).join('')}
        <div class="task"><div class="tt"><b>${t('Üçünü de bitir')}</b><small>${t('{m} + tüm mülklere 2x · 1 saat', { m: fmt(bonusReward()) })}</small></div><button class="chip${T.bonus ? ' got' : ''}" data-a="bonus" ${T.bonus || !T.list.every(q => q.claimed) ? 'disabled' : ''}>${T.bonus ? t('Alındı') : t('Al')}</button></div>
        ${S.offer && !S.offer.done ? `<p class="sec u-mt-10">${t('Süreli fırsat')}</p><div class="task"><div class="tt"><b>${t(S.offer.title)}</b><small>${S.offer.prog} / ${S.offer.goal} · ${t('Ödül {m} + 30 dk 2x', { m: fmt(S.offer.rw) })}</small><div class="tbar"><i style="width:${S.offer.prog / S.offer.goal * 100}%"></i></div></div></div>` : ''}`;
  },
  action(a, btn) {
    if (a === 'daily') { closeSheet(); ui.lastDay = ''; return STAY; } // günlük ödül kartı döngüde açılır
    if (a === 'claim') claimTask(+btn.dataset.i!);
    if (a === 'bonus') claimBonus();
  },
};
