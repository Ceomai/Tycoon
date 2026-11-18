/* BÜYÜK PROJE — onay kartı ("Proje ruhsatı"): çizim, ad ve tür, dört bina, kira önce/sonra, bedel, süre ve
   bloktaki kiracıların ne olacağı (sessizce düşen olmasın diye kart önceden söyler). */
import { CFG, TYPES, DMAP, CITIES, DistrictKey } from '../config';
import { S, lotsOf } from '../state';
import { fmt, fmtCost, fmtTime, esc } from '../format';
import { t, nm, pctTxt } from '../i18n';
import { rate, pjCells, tenantMult } from '../economy';
import { projSvg, psvg } from '../projdraw';
import { pjName, styleOf, kindOf, typesAt, pjCost, pjTime, pjTenants, startProject, KIND_N } from '../game/project';
import { tName, tenantsOpen, bonusPct } from '../game/tenants';
import { openModal, closeModal } from './modal';

/** Dört binanın kirası ve proje olunca (kiracı bonusuyla toplanır, çarpılmaz: economy.ts baseRate). */
export function pjRates(k: DistrictKey, a: number, x: number): [number, number] {
  let now4 = 0, after = 0;
  for (const j of pjCells(a)) { const r = rate(k, j), m = tenantMult(k, j); now4 += r; after += r * (m + x) / m; }
  return [now4, after];
}
/** Bloğun binaları: "Kafe · Sv 5" rozetleri. */
export const pjChips = (k: DistrictKey, a: number) => {
  const lots = lotsOf(S, k);
  return `<div class="pjchips">${pjCells(a).map(j => `<span class="pjchip">${t(TYPES[lots[j]!.t].n)} · ${t('Sv {l}', { l: lots[j]!.lvl })}</span>`).join('')}</div>`;
};

export function openPjConfirm(k: DistrictKey, a: number, onStart: () => void, onCancel: () => void) {
  const kind = kindOf(typesAt(k, a)), name = pjName(k, kind), cost = pjCost(k, a), time = pjTime(k, a), d = DMAP[k];
  const [now4, after] = pjRates(k, a, CFG.PJ_X1), afford = S.cash >= cost, tn = pjTenants(k, a);
  const nameOf = (x: { a: Parameters<typeof tName>[0]; k: DistrictKey }) => esc(tName(x.a, x.k)[0]);
  const ten = [
    ...tn.live.map(x => t('{n} projede oturmaya devam eder: sözleşmesi bitene kadar +{p}.', { n: nameOf(x), p: bonusPct() })),
    ...tn.move.map(x => t('{n} anahtarı bekliyor: proje başlayınca projeye yerleşir.', { n: nameOf(x) })),
    ...tn.leave.map(x => t('{n} başka yere bakacak: isteği bu blokta karşılanamaz.', { n: nameOf(x) })),
  ];
  const tenNote = ten.length || tenantsOpen() ? `<div class="pjten"><b>${t('Kiracılar')}</b>${ten.map(s => `<span>${s}</span>`).join('')}<span>${t('Proje tek bina sayılır: bu dört arsaya yeni kiracı adayı gelmez.')}</span></div>` : '';
  openModal(`<div class="card pjcard">
    <p class="sec u-tc u-m0b-4">${t('Proje ruhsatı')} · ${nm(CITIES[d.city].n)} · ${nm(d.n)}</p>
    <div class="pjart bpbg">${psvg(projSvg(kind, styleOf(k), 1))}</div>
    <h3>${esc(name)}</h3><p>${t('Dört bina birleşip tek {kind} olur.', { kind: t(KIND_N[kind]) })}</p>
    ${pjChips(k, a)}
    <div class="ledger">
      <div><span>${t('Dört binanın kirası')}</span><i></i><b>${t('{v}/sn', { v: fmt(now4) })}</b></div>
      <div><span>${t('Proje olunca')}</span><i></i><b class="up">${t('{v}/sn', { v: fmt(after) })} · +${pctTxt(Math.round(CFG.PJ_X1 * 100))}</b></div>
      <div><span>${t('Bedel')}</span><i></i><b>${fmtCost(cost)}</b></div>
      <div><span>${t('İnşaat')}</span><i></i><b>${fmtTime(time)}</b></div>
    </div>
    ${tenNote}
    <p class="note">${t('İnşaat sürerken binalar kira vermeye devam eder. Komşuluk ve semt kuralı aynen sayılır. Proje sonradan ayrılabilir (bedel iade edilmez).')}</p>
    <div class="btns"><button class="btn gold" data-a="go" ${afford ? '' : 'disabled'}>${t('Projeyi başlat')} · ${fmtCost(cost)}</button><button class="txt" data-a="no" data-back>${t('Vazgeç')}</button></div></div>`,
  act => {
    if (act === 'go') { if (startProject(k, a)) { closeModal(); onStart(); } return; }
    closeModal(); onCancel();
  });
}
