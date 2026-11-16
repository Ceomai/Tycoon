/* =========================================================
   BÜYÜK PROJELER (arsa birleştirme) — oyuncu eylemleri, teslim ve bildirimler. İsteğe bağlı katman: dokunmayan oyuncu
   hiçbir şey kaybetmez. Kurallar game/projcore.ts'te (arayüzsüz; simülasyon da kullanır), çizimler projdraw.ts'te.
   Reklamla hızlandırma ve 2x yok: proje inşaatı yalnızca beklenir.
   ========================================================= */
import { CFG, DMAP, DistrictKey } from '../config';
import { S, Pj } from '../state';
import { now, pjX } from '../economy';
import { t, nm, pctTxt } from '../i18n';
import { Snd, buzz } from '../sound';
import { ui, view } from '../ui/ctx';
import { toast, bigStamp } from '../ui/modal';
import { deny } from '../ui/motion';
import { persist } from './persist';
import { addXp } from './fun';
import { sayTip } from './rifki';
import { Analytics } from '../services/analytics';
import { pjStart, pjStage2, pjSplit, pjDue, pjName } from './projcore';

export * from './projcore';

const redraw = () => { ui.tileSig = []; ui.linkSig = ''; ui.sheetSig = ''; };
/** Projeyi başlatır (onay kartından). Arsalardaki kiracılar projcore.pjStart'ta ele alınır. */
export function startProject(k: DistrictKey, a: number): boolean {
  const q = pjStart(k, a);
  if (!q) { deny(); return false; }
  addXp(40); Snd.build(); buzz.success(); redraw(); persist(); view.render();
  Analytics.log('project_start', { district: k, kind: q.kd, n: (S.pj[k] || []).length });
  return true;
}
/** 2. etap (kat ekle). */
export function upgradeProject(k: DistrictKey, q: Pj): boolean {
  if (!pjStage2(k, q)) { deny(); return false; }
  addXp(40); Snd.build(); buzz.light(); redraw(); persist(); view.render();
  Analytics.log('project_stage2', { district: k, kind: q.kd });
  return true;
}
/** Projeyi ayır: dört bina Sv5 olarak yerinde kalır, ödenen bedel iade edilmez. */
export function splitProject(k: DistrictKey, q: Pj): boolean {
  if (!pjSplit(k, q)) return false;
  Snd.wreck(); toast(t('Proje ayrıldı · dört bina yerinde')); redraw(); persist(); view.closeSheet(); view.render();
  Analytics.log('project_split', { district: k, kind: q.kd, st: q.st });
  return true;
}
/** Oyun döngüsünden: biten etaplar teslim edilir. Teslim mührü projenin (sol üst) karosunda; başka semtte kısa bildirim. */
export function tickProjects(tn = now(), pt = performance.now()) {
  const done = pjDue(tn); if (!done.length) return;
  for (const [k, q] of done) {
    const name = pjName(k, q.kd), p = pctTxt(Math.round(pjX(q.st) * 100));
    if (k === S.cur) {
      ui.teslim[q.a] = { at: pt + 2200, txt: name + (q.st >= 2 ? ' · ' + t('2. etap') : '') };
      ui.tileSig[q.a] = ''; ui.pop.add(q.a);
      bigStamp(t('PROJE TESLİM'), t('KİRALAR +{p}', { p }));
    } else toast(t('{name} teslim edildi · {d}', { name, d: nm(DMAP[k].n) }), 3000);
    sayTip({ id: 'project', text: t('{name} hayırlı olsun efendim! Dört binanın kirası aynen duruyor, üstüne {p} de proje primi.', { name, p }), go: { k: 'proj', key: k, i: q.a } });
    Analytics.log('project_done', { district: k, kind: q.kd, st: q.st });
  }
  Snd.unlock(); buzz.success(); ui.sheetSig = ''; persist();
}
/** Kaporalı semtte "Büyük proje" aranınca Rıfkı uyarır (semt başına oturumda bir kez). */
const lienWarned = new Set<string>();
export function pjLienWarn(k: DistrictKey) {
  if (lienWarned.has(k)) return; lienWarned.add(k);
  sayTip({ id: 'pjlien', text: t('Borç bitmeden ruhsat çıkmaz efendim; önce tapuyu tamamen alalım.'), go: { k: 'map' } });
}
/** Teslim bildirimi yüzdesi için (CFG değişebilir). */
export const pjPct = (st: number) => pctTxt(Math.round((st >= 2 ? CFG.PJ_X2 : CFG.PJ_X1) * 100));
