/* ÖNİZLEME ARKA UCU — Claude artifact'ının paylaşılan veritabanı.
   Gerçek doğrulama yapmaz; yalnızca önizlemede sıralama ve davetleri denemek içindir.
   Uygulamada Firebase arka ucu kullanılır. */
import type { Backend, LbRow, RedeemResult } from './cloud';

export async function createArtifactBackend(): Promise<Backend> {
  let db: any = null, user: any = null;
  const be: Backend = {
    uid: null,
    async init() {
      try {
        [db, user] = await Promise.all([window.claude.use('db'), window.claude.use('user')]);
        if (!db || !user) return false;
        be.uid = await user.id();
        return !!be.uid;
      } catch { return false; }
    },
    async hello(localCode) {
      // kodu sıralama kaydına yaz ki arkadaşlar bulabilsin; kaç kişinin kullandığını say
      let grants = 0;
      try {
        const mine = await db.doc('lb/' + be.uid).get().catch(() => null);
        const base = (mine && mine.exists && mine.data && mine.data()) || {};
        await db.doc('lb/' + be.uid).set({ ...base, code: localCode });
        const snap = await db.collection('invites').where('code', '==', localCode).get();
        const n = snap.docs.filter((d: any) => d.id !== be.uid).length;
        const given = base.granted || 0;
        if (n > given) { grants = n - given; await db.doc('lb/' + be.uid).set({ ...base, code: localCode, granted: n }); }
      } catch { /* yok */ }
      return { grants };
    },
    account: () => ({ enabled: false, linked: false, provider: '', apple: false }),
    async link() { return 'fail'; },
    async deleteAccount() {
      try { await db.doc('lb/' + be.uid).delete?.(); await db.doc('invites/' + be.uid).delete?.(); return true; } catch { return false; }
    },
    async pushSave() { /* önizlemede bulut kaydı yok */ },
    async pullSave() { return null; },
    async postScore(p) {
      const mine = await db.doc('lb/' + be.uid).get().catch(() => null);
      const base = (mine && mine.exists && mine.data && mine.data()) || {};
      await db.doc('lb/' + be.uid).set({ ...base, week: p.week, earned: p.earned, district: p.district, shares: p.shares, at: Date.now() });
    },
    async top(week) {
      const snap = await db.collection('lb').where('week', '==', week).get();
      const all = snap.docs.map((d: any) => ({ id: d.id, ...d.data() })).sort((a: any, b: any) => b.earned - a.earned);
      const rows = all.slice(0, 25);
      let ps: Record<string, any> = {};
      try { ps = await user.profiles(rows.map((r: any) => r.id)); } catch { /* yok */ }
      const idx = all.findIndex((r: any) => r.id === be.uid);
      return {
        rows: rows.map((r: any): LbRow => ({ name: (ps[r.id] && ps[r.id].name) || 'Emlakçı', district: r.district, earned: r.earned, me: r.id === be.uid })),
        myRank: idx >= 0 ? idx + 1 : null,
      };
    },
    async redeemInvite(code): Promise<RedeemResult> {
      const owner = await db.collection('lb').where('code', '==', code).get();
      if (!owner.docs.some((d: any) => d.id !== be.uid)) return 'invalid';
      const prev = await db.doc('invites/' + be.uid).get().catch(() => null);
      if (prev && prev.exists) return 'used';
      await db.doc('invites/' + be.uid).set({ code, at: Date.now() });
      return 'ok';
    },
  };
  return be;
}
