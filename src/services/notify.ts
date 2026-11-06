/* BİLDİRİMLER — @capacitor/local-notifications; oyundan çıkarken planlanır */
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { CFG, TYPES, DMAP } from '../config';
import { S, lotsOf } from '../state';
import { now, totalRate, isFull } from '../economy';
import { nextDistrict, kaporaOf } from '../game/district';
import { loc } from '../format';
import { t, nm } from '../i18n';

const native = () => Capacitor.isNativePlatform() && !__PREVIEW__;
export const Notify = {
  async ask() { if (native()) try { await LocalNotifications.requestPermissions(); } catch { /* yok */ } },
  async plan() {
    if (!native() || !S.notif) return;
    try {
      const perm = await LocalNotifications.checkPermissions(); if (perm.display !== 'granted') return;
      const t0 = now(), list: { id: number; title: string; body: string; at: number }[] = [];
      let soon = Infinity, name = '';
      for (const k of S.own) for (const p of lotsOf(S, k)) if (p && p.until && p.until < soon) { soon = p.until; name = t(TYPES[p.t].n); }
      if (soon < Infinity) list.push({ id: 1, title: t('İnşaat bitti'), body: t('{name} hazır. Şantiyeye uğra, yeni kat çık.', { name }), at: soon });
      list.push({ id: 2, title: t('Kasa doldu'), body: t('Kiracıların 3 saattir ödüyor. Kirayı topla.'), at: t0 + CFG.OFFLINE_MAX });
      // sonraki semt: kapora parası sen yokken birikince haber ver (yalnızca semt doluysa)
      const nk = nextDistrict(S.cur), rr = totalRate(false) * CFG.OFFLINE_RATE;
      if (nk && isFull(S.cur) && !S.lien[S.cur] && rr > 0) {
        const kap = kaporaOf(nk), need = kap - S.cash;
        if (need > 0 && need / rr * 1000 < CFG.OFFLINE_MAX) list.push({ id: 4, title: t('{name} kaporası hazır', { name: nm(DMAP[nk].n) }), body: t('Kasada yeterli para birikti. Kapora ver, {yer} hemen başla.', { yer: loc(nm(DMAP[nk].n)) }), at: t0 + need / rr * 1000 });
      }
      const tm = new Date(t0); tm.setDate(tm.getDate() + 1); tm.setHours(12, 0, 0, 0);
      list.push({ id: 3, title: t('Kira günü'), body: t('{n}. gün ödülün hazır. Seriyi bozma!', { n: (S.daily.streak || 0) + 1 }), at: +tm });
      await LocalNotifications.cancel({ notifications: [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }] });
      await LocalNotifications.schedule({ notifications: list.map(n => ({ id: n.id, title: n.title, body: n.body, schedule: { at: new Date(n.at) } })) });
    } catch { /* yok */ }
  },
};
