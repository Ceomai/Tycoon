/* LİG — 30 kişilik haftalık gruplar (istemcideki src/game/league.ts → leagueOutcome ile aynı kurallar)
   Arsa(0) → Kat(1) → Apartman(2) → Plaza(3) → Gökdelen(4) */
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

export const LEAGUE_TOP = 4;
export const GROUP_SIZE = 30;
const SHARDS = 8; // aynı anda katılan çok oyuncu tek grup belgesine yığılmasın

export interface LeagueResult { week: string; from: number; to: number; rank: number; size: number; seal: boolean; }

/** Küçük gruplarda daha az kişi yükselir; 15 kişinin altında kimse düşmez. Arsa'da düşme, Gökdelen'de yükselme yok. */
export function leagueOutcome(rank: number, size: number, tier: number): { to: number; seal: boolean } {
  const up = size >= 10 ? 5 : Math.max(1, Math.floor(size / 3));
  const down = size >= 15 ? 5 : 0;
  let to = tier;
  if (rank <= up && tier < LEAGUE_TOP) to = tier + 1;
  else if (down && rank > size - down && tier > 0) to = tier - 1;
  return { to, seal: tier === LEAGUE_TOP && rank <= 3 };
}

const db = () => getFirestore();

/** Oyuncunun katıldığı son haftanın sonucunu (hafta bittiyse) bir kez hesaplar. */
export async function settle(uid: string, currentWeek: string): Promise<LeagueResult | null> {
  const userRef = db().doc(`users/${uid}`);
  const L = (await userRef.get()).get('league') as any;
  if (!L || !L.week || !L.group || L.week === currentWeek || L.settled === L.week) return null;
  const snap = await db().collection('lb').where('group', '==', L.group).orderBy('earned', 'desc').limit(GROUP_SIZE * 2).get();
  const ids = snap.docs.map(d => d.get('uid'));
  const rank = ids.indexOf(uid) + 1;
  if (!rank) { await userRef.set({ league: { ...L, settled: L.week } }, { merge: true }); return null; }
  const o = leagueOutcome(rank, ids.length, L.tier || 0);
  const res: LeagueResult = { week: L.week, from: L.tier || 0, to: o.to, rank, size: ids.length, seal: o.seal };
  const done = await db().runTransaction(async tx => {
    const cur = (await tx.get(userRef)).get('league') as any;
    if (!cur || cur.settled === L.week || cur.week !== L.week) return false; // başka istek hesapladı
    tx.set(userRef, { league: { ...cur, tier: o.to, settled: L.week }, lastLeague: res }, { merge: true });
    return true;
  });
  return done ? res : null;
}

/** Bu haftanın grubuna yerleştirir (yoksa); { tier, group, lastWeek } döner. */
export async function ensureGroup(uid: string, week: string): Promise<{ tier: number; group: string; lastWeek: number }> {
  await settle(uid, week);
  const userRef = db().doc(`users/${uid}`);
  const L = ((await userRef.get()).get('league') as any) || { tier: 0 };
  let lastWeek = 0;
  if (L.week && L.week !== week) { const prev = await db().doc(`lb/${L.week}_${uid}`).get(); lastWeek = prev.exists ? prev.get('earned') || 0 : 0; }
  if (L.week === week && L.group) return { tier: L.tier || 0, group: L.group, lastWeek };
  const tier = L.tier || 0;
  const bucket = Math.max(0, Math.min(20, Math.floor(Math.log10(Math.max(1, lastWeek))))); // benzer kazançtakiler eşleşir
  const shard = Math.floor(Math.random() * SHARDS);
  const group = await db().runTransaction(async tx => {
    const u = await tx.get(userRef);
    const cur = (u.get('league') as any) || {};
    if (cur.week === week && cur.group) return cur.group as string;
    const q = await tx.get(db().collection('groups').where('week', '==', week).where('tier', '==', tier).where('bucket', '==', bucket).where('shard', '==', shard).where('full', '==', false).limit(1));
    let ref;
    if (q.empty) { ref = db().collection('groups').doc(); tx.set(ref, { week, tier, bucket, shard, count: 1, full: false, at: FieldValue.serverTimestamp() }); }
    else { ref = q.docs[0].ref; const c = (q.docs[0].get('count') || 0) + 1; tx.update(ref, { count: c, full: c >= GROUP_SIZE }); }
    tx.set(userRef, { league: { ...cur, tier, week, group: ref.id } }, { merge: true });
    return ref.id;
  });
  return { tier, group, lastWeek };
}
