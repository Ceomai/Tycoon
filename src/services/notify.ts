/* BİLDİRİMLER — @capacitor/local-notifications; oyundan çıkarken planlanır */
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { CFG, TYPES } from '../config';
import { S, lotsOf } from '../state';
import { now } from '../economy';

const native = () => Capacitor.isNativePlatform() && !__PREVIEW__;
export const Notify = {
  async ask() { if (native()) try { await LocalNotifications.requestPermissions(); } catch { /* yok */ } },
  async plan() {
    if (!native() || !S.notif) return;
    try {
      const perm = await LocalNotifications.checkPermissions(); if (perm.display !== 'granted') return;
      const t = now(), list: { id: number; title: string; body: string; at: number }[] = [];
      let soon = Infinity, name = '';
      for (const k of S.own) for (const p of lotsOf(S, k)) if (p && p.until && p.until < soon) { soon = p.until; name = TYPES[p.t].n; }
      if (soon < Infinity) list.push({ id: 1, title: 'İnşaat bitti', body: `${name} hazır. Şantiyeye uğra, yeni kat çık.`, at: soon });
      list.push({ id: 2, title: 'Kasa doldu', body: 'Kiracıların 3 saattir ödüyor. Kirayı topla.', at: t + CFG.OFFLINE_MAX });
      const tm = new Date(t); tm.setDate(tm.getDate() + 1); tm.setHours(12, 0, 0, 0);
      list.push({ id: 3, title: 'Kira günü', body: `${(S.daily.streak || 0) + 1}. gün ödülün hazır. Seriyi bozma!`, at: +tm });
      await LocalNotifications.cancel({ notifications: [{ id: 1 }, { id: 2 }, { id: 3 }] });
      await LocalNotifications.schedule({ notifications: list.map(n => ({ id: n.id, title: n.title, body: n.body, schedule: { at: new Date(n.at), allowWhileIdle: true } })) });
    } catch { /* yok */ }
  },
};
