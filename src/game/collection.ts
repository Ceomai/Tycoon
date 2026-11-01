/* KOLEKSİYON yardımcıları ve HOLDİNG (prestij) */
import { CFG, DLIST, dkey, N } from '../config';
import { S, newState, lotsOf } from '../state';
import { LM, lmSvg, Landmark } from '../landmarks';
import { svg } from '../draw';
import { I } from '../icons';
import { fmtX, weekKey } from '../format';
import { now } from '../economy';
import { Snd, buzz } from '../sound';
import { ui } from '../ui/ctx';
import { openModal, closeModal } from '../ui/modal';
import { closeSheet } from '../ui/sheets';
import { render } from '../ui/board';
import { persist } from './persist';
import { Analytics } from '../services/analytics';

export const lmLeft = (): Landmark[] => LM.filter(l => !S.coll.includes(l.id));
export function landmarkCard(l: Landmark, extra = '') {
  return `<div class="card"><div class="lmhero bpbg">${svg(lmSvg(l.id))}</div><h3>${l.n}</h3><p>Koleksiyonuna eklendi. Tüm kiralar kalıcı olarak %5 arttı.${extra}</p>
    <div class="btns"><button class="btn" data-a="ok">Harika</button></div></div>`;
}

/* Holding: herhangi bir ilin son semtinin tapusunu alınca kurulabilir. */
export const sharesPreview = () => Math.floor(Math.sqrt(S.earned / CFG.SHARE_BASE));
export const ownsTopTier = () => S.own.some(k => DLIST.find(d => d.key === k)!.idx === 4);
export const canHolding = () => ownsTopTier() && sharesPreview() >= 1;
export function doHolding() {
  const n = sharesPreview(); if (!canHolding()) return;
  const fresh = newState(now(), weekKey(new Date(now())), S.city);
  S.shares = (S.shares || 0) + n;
  for (const k of S.own) for (const q of lotsOf(S, k)) if (q && q.sp) S.inv.push(q.sp); // özel yapılar korunur
  S.lien = {}; S.lienT = {}; S.dEarn = {};
  Object.assign(S, { cash: 150, earned: 0, own: fresh.own, cur: fresh.cur, d: fresh.d, fx: [], disc: 0, offer: null });
  lotsOf(S, S.cur);
  ui.tileSig = []; ui.linkSig = ''; closeSheet(); persist(); render(); Snd.unlock(); buzz(40);
  Analytics.log('holding', { shares: n, total: S.shares });
  openModal(`<div class="card"><div class="badge">${I.crown}</div><h3>Holding kuruldu</h3><p>${n} yeni hisse aldın. Artık tüm kiralar kalıcı olarak ${fmtX(1 + 0.1 * S.shares)}.</p>
    <div class="btns"><button class="btn" data-a="ok">Yeniden başla</button></div></div>`, () => closeModal());
}
export { N, dkey };
