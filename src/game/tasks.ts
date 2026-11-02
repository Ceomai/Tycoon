/* GÜNLÜK GÖREVLER — her gün 3 görev, hepsi bitince bonus. Süreli fırsatın ilerlemesi de buradan sayılır. */
import { S } from '../state';
import { CFG } from '../config';
import { fmt, dayKey } from '../format';
import { now, totalRate } from '../economy';
import { Snd } from '../sound';
import { toast, bump } from '../ui/modal';
import { addCash, addBoost } from './actions';
import { persist } from './persist';
import { offerComplete } from './offers';
import { addXp } from './fun';
import { t } from '../i18n';

export const TASKS: Record<string, { t: (n: number) => string; n: () => number }> = {
  collect: { t: n => t('Kiraları {n} kez topla', { n }), n: () => 8 },
  lotboost: { t: () => t('Bir mülke 2x ver'), n: () => 1 },
  build: { t: n => t('{n} yeni bina kur', { n }), n: () => 2 },
  upgrade: { t: n => t('{n} kez kat çık', { n }), n: () => 2 },
  ad: { t: () => t('Bir ödüllü reklam izle'), n: () => 1 },
  earn: { t: n => t('{n} kira kazan', { n: fmt(n) }), n: () => Math.max(1000, Math.round(totalRate(false) * 600)) },
  taxi: { t: () => t('Altın taksiyi yakala'), n: () => 1 },
  event: { t: n => t('{n} etkinlik kartı değerlendir', { n }), n: () => 2 },
};
export const taskText = (q: { k: string; goal: number }) => TASKS[q.k] ? TASKS[q.k].t(q.goal) : q.k;
export const taskReward = () => Math.max(300, totalRate(false) * 150);
export const bonusReward = () => Math.max(800, totalRate(false) * 300);

export function ensureTasks() {
  const today = dayKey(new Date(now()));
  if (S.tasks && S.tasks.day === today) return;
  const keys = Object.keys(TASKS).sort(() => Math.random() - .5).slice(0, 3);
  S.tasks = { day: today, bonus: false, list: keys.map(k => ({ k, goal: TASKS[k].n(), prog: 0, claimed: false })) };
}
export function track(k: string, amt = 1) {
  if (!S) return;
  ensureTasks();
  for (const q of S.tasks!.list) if (q.k === k && q.prog < q.goal) {
    q.prog = Math.min(q.goal, q.prog + amt);
    if (q.prog >= q.goal) { toast(t('Görev tamam: {task}', { task: taskText(q) })); Snd.unlock(); }
  }
  const o = S.offer;
  if (o && !o.done && o.k === k && o.until > now()) { o.prog = Math.min(o.goal, o.prog + amt); if (o.prog >= o.goal) { o.done = true; offerComplete(); } }
}
export function claimTask(i: number) {
  const q = S.tasks?.list[i]; if (!q || q.claimed || q.prog < q.goal) return;
  q.claimed = true; addXp(60); addCash(taskReward()); bump(); Snd.collect(6); persist();
}
export function claimBonus() {
  const T = S.tasks; if (!T || T.bonus || !T.list.every(q => q.claimed)) return;
  T.bonus = true; addXp(100); addCash(bonusReward()); addBoost(CFG.TASK_BOOST); bump(); Snd.reward(); toast(t('Günün büyük ödülü: tüm mülklere 2x · 1 saat')); persist();
}
export function tasksClaimable() { ensureTasks(); const T = S.tasks!; return T.list.some(q => !q.claimed && q.prog >= q.goal) || (!T.bonus && T.list.every(q => q.claimed)); }
