/* ALT PANELLER — arsa, semtler (çok şehirli), görevler, koleksiyon, menü, sıralama, davet, mağaza, holding, ayarlar */
import { COLS, N, CFG, MAXLV, ORDER, TYPES, LV_INC, DMAP, CITIES, CITY_ORDER, dkey, PRIVACY_URL, BuildingType } from '../config';
import { S, lotsOf } from '../state';
import { fmt, fmtTime, fmtX, clock, esc, dayKey, dayDiff, weekKey } from '../format';
import { now, PAIRS, neighborBonus, pairAdj, spAdj, districtMult, neighbors, withDisc, buildCost, buildTime, upCost, upTime, adj, rate, incM, permMult, fxMult, filled, unlockInfo, collBonus, citiesOwned, portfolioBonus } from '../economy';
import { bld, site, svg } from '../draw';
import { LM, lmSvg } from '../landmarks';
import { I, small } from '../icons';
import { Snd } from '../sound';
import { $, ui, SheetState } from './ctx';
import { toast } from './modal';
import { build, upgrade, skip, demolish, lotBoost, buyDistrict, switchDistrict, buySpecial, placeSpecial, specialPrice } from '../game/actions';
import { specialSvg, specialOf, weekSpecial } from '../specials';
import { goalsOf, starsOf } from '../game/goals';
import { hideTip } from '../game/rifki';
import { ensureTasks, taskText, taskReward, bonusReward, claimTask, claimBonus } from '../game/tasks';
import { streakStrip } from '../game/daily';
import { canHolding, sharesPreview, doHolding } from '../game/collection';
import { openShare, copyText, shareTextOnly } from '../game/share';
import { useCode } from '../game/referral';
import { persist } from '../game/persist';
import { Cloud } from '../services/cloud';
import { Purchases } from '../services/purchases';
import { Notify } from '../services/notify';
import { Ads } from '../services/ads';
import { resetGame } from '../game/loop';
import { chapters } from '../game/guide';
import { leagueZones, leagueName, leagueShort, weekEndsAt, fmtLeft } from '../game/league';
import { LEAGUES, LEAGUE_TOP } from '../config';

export function openSheet(s: SheetState) { ui.openedAt = performance.now(); ui.sheet = s; ui.sheetSig = ''; renderSheet(); $('#sheet').classList.add('on'); $('#scrim').classList.add('on'); Snd.tap(); }
export function closeSheet() { if (!ui.sheet) return; ui.sheet = null; ui.lastClose = performance.now(); $('#sheet').classList.remove('on'); if (!ui.modal) $('#scrim').classList.remove('on'); }
const lvBar = (l: number) => `<div class="lv">${[1, 2, 3, 4, 5].map(k => `<i class="${k <= l ? 'on' : ''}"></i>`).join('')}</div>`;
const discBox = () => S.disc ? `<div class="disc">${small(I.tag, 16)} %${Math.round(S.disc * 100)} müteahhit indirimi</div>` : '';

export function renderSheet() {
  const s = ui.sheet; if (!s) return;
  const t = now(); let sig = '', html: string | undefined;
  if (s.k === 'plot') {
    const k = s.key!, i = s.i!, p = lotsOf(S, k)[i];
    if (!p) {
      sig = 'e|' + ORDER.map(b => (S.seen[b] ? 1 : 0) + '' + (S.cash >= withDisc(buildCost(k, b)) ? 1 : 0)).join() + S.disc + S.inv.join();
      if (sig !== ui.sheetSig) {
        const short = ORDER.some(b => S.seen[b] && S.cash < withDisc(buildCost(k, b)));
        const inv = S.inv.length ? `<p class="sec">Depodaki özel yapılar</p><div class="cards spcards">${S.inv.map(id => `<button class="bcard bpbg k-ozel" data-a="place" data-id="${id}">${svg(specialSvg(id))}<span class="bn">${specialOf(id).n}</span><span class="bm">Komşularına +%${Math.round(CFG.SP_ADJ * 100)}</span><span class="bp">Yerleştir</span></button>`).join('')}</div><p class="sec">Yeni bina</p>` : '';
        html = `${discBox()}${inv}<div class="cards">${ORDER.map(b => {
          const T = TYPES[b];
          if (!S.seen[b]) return `<div class="bcard locked bpbg k-${b}">${svg(bld(b, 1))}<span class="bn">${T.n}</span><span class="bl">${fmt(T.unlock)} kazanınca</span><span class="lk">${I.lock}</span></div>`;
          const c = withDisc(buildCost(k, b)), nb = neighborBonus(k, i, b);
          return `<button class="bcard bpbg k-${b}" data-a="build" data-t="${b}" ${S.cash >= c ? '' : 'disabled'}>${svg(bld(b, 1))}
            <span class="bn">${T.n}</span><span class="bm">${fmt(T.inc * incM(k) * (1 + nb) * permMult() * districtMult(k), true)}/sn · ${fmtTime(buildTime(k, b))}</span><span class="bp">${fmt(c)}</span>${nb ? `<span class="chain" title="Komşu bonusu">+%${Math.round(nb * 100)}</span>` : ''}</button>`;
        }).join('')}</div>${short ? '<p class="note">Kira toplamak için ortadaki TOPLA mührüne bas.</p>' : ''}`;
      }
    } else if (p.until) {
      const nearly = p.until - t <= CFG.SKIP_LEFT + 1e3;
      sig = 'c|' + p.t + p.lvl + (p.up ? 1 : 0) + (p.until - t <= CFG.AD_SKIP ? 1 : 0) + (nearly ? 1 : 0);
      if (sig !== ui.sheetSig) {
        html = `<div class="sh-head k-${p.t}"><div class="sh-art bpbg" data-art></div><div class="sh-t"><h3>${TYPES[p.t].n}</h3><p data-pt></p></div></div>
          <div class="cd"><span class="sec">Kalan süre</span><span class="cdv" data-cd></span></div>
          <div class="k-${p.t}"><div class="prog"><i data-pb></i></div></div>
          <p class="note">İnşaat sen oyunda değilken de sürer.</p>
          <div class="btns">${nearly ? '<button class="btn" disabled>Bitmek üzere…</button>' : `<button class="btn gold" data-a="skip">${I.play} ${p.until - t <= CFG.AD_SKIP ? 'İzle, 5 saniyeye indir' : 'İzle, 30 dk kısalt'}</button>`}<button class="txt" data-a="close">Bekle</button></div>`;
      }
    } else {
      const canUp = p.lvl < MAXLV && !p.sp, uc = canUp ? withDisc(upCost(k, p)) : 0, afford = canUp && S.cash >= uc, a = adj(k, i), pa = pairAdj(k, i), sa = spAdj(k, i);
      const lbLeft = Math.max(0, (p.bu || 0) - t);
      sig = 'b|' + p.t + p.lvl + (afford ? 1 : 0) + a + (S.boostUntil > t ? 1 : 0) + Math.ceil(lbLeft / 60e3) + fxMult(k, i, p, t) + S.disc + (s.del ? 1 : 0);
      if (sig !== ui.sheetSig) {
        const next = canUp ? TYPES[p.t].inc * LV_INC[p.lvl + 1] * incM(k) * (1 + neighborBonus(k, i)) * permMult() * districtMult(k) * fxMult(k, i, p, t) * (S.boostUntil > t ? 2 : 1) * (lbLeft > 0 ? 2 : 1) : 0;
        const sp = p.sp ? specialOf(p.sp) : null;
        html = `<div class="sh-head k-${sp ? 'ozel' : p.t}"><div class="sh-art bpbg">${svg(sp ? specialSvg(p.sp) : bld(p.t, p.lvl))}</div>
          <div class="sh-t"><h3>${sp ? sp.n : TYPES[p.t].n}</h3><p>${DMAP[k].n} · ${sp ? 'özel yapı' : `Sv ${p.lvl}/${MAXLV}`}</p>${sp ? `<p class="spd">${sp.d}</p>` : lvBar(p.lvl)}</div>
          <button class="iconbtn${s.del ? ' warn' : ''}" data-a="del" aria-label="${s.del ? 'Yıkmayı onayla' : 'Binayı yık'}">${I.trash}</button></div>
          ${s.del ? '<p class="sec" style="text-align:center;margin:0 0 8px">Tekrar dokunursan bina yıkılır</p>' : ''}
          <div class="ledger">
            <div><span>Kira</span><i></i><b>${fmt(rate(k, i), true)}/sn</b></div>
            ${sp ? `<div><span>Komşularına</span><i></i><b>her yöne +%${Math.round(CFG.SP_ADJ * 100)}</b></div>` : `<div><span>Aynı tür komşu</span><i></i><b>${a ? '+%' + Math.round(a * CFG.ADJ * 100) : 'yok'}</b></div>
            <div><span>Akıllı ikili (${PAIR_NAME[p.t]})</span><i></i><b>${pa ? '+%' + Math.round(pa * CFG.PAIR * 100) : 'yok'}</b></div>
            ${sa ? `<div><span>Özel yapı komşusu</span><i></i><b>+%${Math.round(sa * CFG.SP_ADJ * 100)}</b></div>` : ''}`}
            ${districtMult(k) > 1 ? `<div><span>3 yıldızlı semt</span><i></i><b>+%${Math.round(CFG.STAR_BONUS * 100)}</b></div>` : ''}
            ${lbLeft > 0 ? `<div><span>Bu mülke 2x</span><i></i><b class="red">${fmtTime(lbLeft)} kaldı</b></div>` : ''}
            ${S.boostUntil > t ? `<div><span>Tüm mülklere 2x</span><i></i><b class="red">${fmtTime(S.boostUntil - t)} kaldı</b></div>` : ''}
            ${canUp ? `<div><span>Sv ${p.lvl + 1} olunca</span><i></i><b>${fmt(next, true)}/sn</b></div>` : ''}
          </div>${sp ? '' : nbDiagram(k, i)}${canUp ? discBox() : ''}
          <div class="btns">${canUp ? `<button class="btn" data-a="up" ${afford ? '' : 'disabled'}>Kat çık · ${fmt(uc)} <small>${fmtTime(upTime(k, p))}</small></button>` : sp ? '' : '<button class="btn" disabled>Son seviye</button>'}
          <button class="btn gold lotb" data-a="lotboost" ${lbLeft > CFG.LOT_BOOST_MAX - CFG.LOT_BOOST / 2 ? 'disabled' : ''}><span class="lbl">${I.play} İzle · bu mülke 2x</span><small>+1 saat${lbLeft ? ' · en fazla 4 saat' : ''}</small></button></div>`;
      }
    }
  }
  else if (s.k === 'map') {
    sig = 'm|' + JSON.stringify(S.stars) + goalsOf(S.cur).map(g => g.f(S.cur).join('/')).join() + S.cur + S.own.join() + S.own.map(filled).join() + CITY_ORDER.map(c => CITIES[c].districts.map((_, i) => { const u = unlockInfo(dkey(c, i)); return (u.ok ? 1 : 0) + '' + (S.cash >= u.fee ? 1 : 0); }).join('')).join();
    if (sig !== ui.sheetSig) {
      const start = S.city || 'ist';
      const order = [start, ...CITY_ORDER.filter(c => c !== start)];
      let anyShort = false;
      html = goalsCard(S.cur) + `<p class="sec">Portföy · ${citiesOwned()} il${portfolioBonus() ? ` · kiralar +%${Math.round(portfolioBonus() * 100)}` : ''}</p>` + order.map(c => {
        const ownedHere = S.own.filter(k => DMAP[k].city === c).length;
        const rows = CITIES[c].districts.map((d, i) => {
          const k = dkey(c, i);
          if (S.own.includes(k)) return `<button class="drow${k === S.cur ? ' on' : ''}" data-a="go" data-k="${k}"><span class="di"><b>${d.n}${starsOf(k).length >= 3 ? ' <span class="gold">ALTIN MÜHÜR</span>' : ''}</b><small>${filled(k)}/20 dolu · ${'★'.repeat(starsOf(k).length)}${'☆'.repeat(3 - starsOf(k).length)}</small></span><span class="mini"><i style="width:${filled(k) / 20 * 100}%"></i></span></button>`;
          const u = unlockInfo(k);
          if (u.ok) { const af = S.cash >= u.fee; if (!af) anyShort = true; return `<button class="drow" data-a="buy" data-k="${k}" ${af ? '' : 'disabled'}><span class="di"><b>${d.n}</b><small>Tapu ${fmt(u.fee)}</small></span><span class="st">SATIŞTA</span></button>`; }
          const why = u.why === 'prev-not-full' ? `${CITIES[c].districts[i - 1].n} dolunca açılır` : u.why === 'start-not-full' ? `${CITIES[start].districts[0].n} dolunca açılır · ${fmt(u.fee)}` : 'Kilitli';
          return `<div class="drow" style="opacity:.5"><span class="di"><b>${d.n}</b><small>${why}</small></span>${I.lock}</div>`;
        }).join('');
        return `<div class="cityhead"><span>${CITIES[c].n}</span><small>${ownedHere ? `${ownedHere}/5 semt` : CITIES[c].tagline}</small></div><div class="dlist">${rows}</div>`;
      }).join('') + `<p class="note">Başlangıç ilinin ilk semtini doldurunca diğer illerin ilk semtini alabilirsin. Her yeni il tüm kiralara kalıcı +%${Math.round(CFG.PORTFOLIO_BONUS * 100)} katar.</p>`;
    }
  }
  else if (s.k === 'set') {
    const acct = Cloud.account();
    sig = 's|' + S.rifki + S.collectMode + S.sound + S.notif + S.premium + (s.reset ? 1 : 0) + (s.del ? 1 : 0) + JSON.stringify(acct) + Ads.privacyRequired();
    if (sig !== ui.sheetSig) {
      html = `<p class="sec">Nasıl oynanır</p>
        <ul class="rules">
          <li><b>Arsaya dokun</b>, inşaatı başlat. Bina kat kat yükselir.</li>
          <li>Kira binaların kumbarasında birikir; ortadaki <b>TOPLA</b> mührüyle hepsini tek seferde al (ya da aşağıdan otomatiğe geç).</li>
          <li>Kumbara dolunca kira birikmeyi bırakır. <b>Sık uğra.</b></li>
          <li>Aynı türü <b>yan yana</b> kur; bahçeler, teraslar birleşir ve daha çok kazandırır.</li>
          <li>Semti doldur, <b>yeni semtin tapusunu</b> al. Başka illerde de arsa alabilirsin.</li>
        </ul>
        <div class="btns" style="margin:-6px 0 14px"><button class="btn soft" data-a="guide">Kılavuzun tamamı</button></div>
        <p class="sec" style="margin-top:4px">Kira toplama</p>
        <div class="cmode">
          <button class="cm${S.collectMode === 'tap' ? ' on' : ''}" data-a="cm-tap"><span class="rd"></span><span class="di"><b>Tek tuşla topla</b><small>Ortadaki TOPLA mührüne bas, bütün semtlerdeki kira tek seferde kasana geçsin.</small></span></button>
          <button class="cm${S.collectMode === 'auto' ? ' on' : ''}" data-a="cm-auto"><span class="rd"></span><span class="di"><b>Otomatik</b><small>Oyun açıkken kira kendiliğinden kasana akar.</small></span></button>
        </div>
        <div class="srow"><span>Rıfkı Abi’nin ipuçları</span><button class="sw${S.rifki ? ' on' : ''}" data-a="rifki" aria-label="Rıfkı Abi’nin ipuçları"></button></div>
        <div class="srow"><span>Ses</span><button class="sw${S.sound ? ' on' : ''}" data-a="sound" aria-label="Ses"></button></div>
        <div class="srow"><span>Bildirimler</span><button class="sw${S.notif ? ' on' : ''}" data-a="notif" aria-label="Bildirimler"></button></div>
        <div class="srow"><span>Reklamlar</span><span>${S.premium ? 'Kapalı (reklamsız paket)' : Ads.native() ? 'Açık' : 'Test modu'}</span></div>
        <p class="sec" style="margin-top:18px">Hesap ve kayıt</p>
        <div class="srow"><span>Kayıt</span><span>${acct.enabled ? (acct.linked ? `${esc(acct.provider)} hesabına bağlı` : 'Misafir · bulutta yedekleniyor') : 'Bu cihazda'}</span></div>
        <div class="acct">
          ${acct.enabled && !acct.linked ? `<button class="btn soft" data-a="link-google">Google ile bağla</button>${acct.apple ? '<button class="btn soft" data-a="link-apple">Apple ile bağla</button>' : ''}` : ''}
          ${Ads.privacyRequired() ? '<button class="linkbtn" data-a="ads-privacy">Reklam izinlerini yönet</button>' : ''}
          <button class="linkbtn" data-a="privacy">Gizlilik politikası ve KVKK aydınlatma metni</button>
          ${acct.enabled ? `<button class="linkbtn" data-a="delete" style="color:var(--stamp)">${s.del ? 'Emin misin? Hesabın ve tüm verilerin silinir' : 'Hesabımı ve verilerimi sil'}</button>` : ''}
        </div>
        <button class="txt" data-a="reset" style="color:var(--stamp)">${s.reset ? 'Emin misin? Tekrar dokun' : 'Oyunu sıfırla'}</button>`;
    }
  }
  else if (s.k === 'menu') {
    sig = 'mn|' + S.league.tier + canHolding() + S.premium + Math.floor(S.week.earned) + (S.shares || 0);
    if (sig !== ui.sheetSig) {
      const row = (a: string, ic: string, b: string, sm: string, dot = false) => `<button class="drow" data-a="${a}"><span class="ic">${ic}${dot ? '<span class="dot"></span>' : ''}</span><span class="di"><b>${b}</b><small>${sm}</small></span></button>`;
      html = `<p class="sec">Menü</p><div class="dlist">
        ${row('share', I.share, 'Şehrini paylaş', 'Story görseli, davet kodunla')}
        ${row('lb', I.trophy, 'Haftalık lig', `${leagueName(S.league.tier)} · bu hafta ${fmt(S.week.earned)}`)}
        ${row('ref', I.users, 'Arkadaşını davet et', `Kodun: ${S.ref.code}`)}
        ${row('ozel', I.tower, 'Haftanın özel tapusu', ozelAvail() ? `${weekSpecial(weekKey(new Date(t))).n} satışta` : `${weekSpecial(weekKey(new Date(t))).n} alındı`, ozelAvail())}
        ${row('store', I.noads, 'Reklamsız paket', S.premium ? 'Aktif' : 'Reklamsız + kalıcı 2x gelir')}
        ${row('holding', I.tower, 'Holding kur', canHolding() ? `${sharesPreview()} hisse hazır` : S.shares ? `${S.shares} hisse · kiralar ${fmtX(1 + 0.1 * S.shares)}` : 'Bir ilin 5. semtini alınca açılır', canHolding())}
        ${row('set', I.gear, 'Ayarlar', 'Ses, bildirim, hesap, gizlilik')}
      </div>`;
    }
  }
  else if (s.k === 'tasks') {
    ensureTasks(); const T = S.tasks!, d = S.daily, today = dayKey(new Date(t)), done = d.last === today;
    const broken = d.last && !done && dayDiff(d.last, today) > 1, nextDay = broken ? 1 : (d.streak % 7) + 1, pos = done ? ((d.streak - 1) % 7) + 1 : nextDay;
    sig = 'tk|' + JSON.stringify(T) + d.last + d.streak + (S.offer ? S.offer.prog + '' + S.offer.done : '');
    if (sig !== ui.sheetSig) {
      html = `<p class="sec">Kira günü serisi</p>${streakStrip(done ? 0 : pos, done ? pos : pos - 1)}
        <p class="note" style="margin-top:6px">${done ? `${d.streak} gündür uğruyorsun. Yarın ${(d.streak % 7) + 1}. günün ödülü hazır olacak.` : 'Bugünün ödülü seni bekliyor.'}</p>
        ${done ? '' : '<div class="btns"><button class="btn gold" data-a="daily">Bugünün ödülünü al</button></div>'}
        <p class="sec" style="margin-top:20px">Günlük görevler</p>
        ${T.list.map((q, i) => `<div class="task"><div class="tt"><b>${taskText(q)}</b><small>${q.k === 'earn' ? fmt(q.prog) + ' / ' + fmt(q.goal) : q.prog + ' / ' + q.goal} · Ödül ${fmt(taskReward())}</small><div class="tbar"><i style="width:${Math.min(100, q.prog / q.goal * 100)}%"></i></div></div>
          <button class="chip${q.claimed ? ' got' : ''}" data-a="claim" data-i="${i}" ${q.claimed || q.prog < q.goal ? 'disabled' : ''}>${q.claimed ? 'Alındı' : 'Al'}</button></div>`).join('')}
        <div class="task"><div class="tt"><b>Üçünü de bitir</b><small>${fmt(bonusReward())} + tüm mülklere 2x · 1 saat</small></div><button class="chip${T.bonus ? ' got' : ''}" data-a="bonus" ${T.bonus || !T.list.every(q => q.claimed) ? 'disabled' : ''}>${T.bonus ? 'Alındı' : 'Al'}</button></div>
        ${S.offer && !S.offer.done ? `<p class="sec" style="margin-top:20px">Süreli fırsat</p><div class="task"><div class="tt"><b>${S.offer.title}</b><small>${S.offer.prog} / ${S.offer.goal} · Ödül ${fmt(S.offer.rw)} + 30 dk 2x</small><div class="tbar"><i style="width:${S.offer.prog / S.offer.goal * 100}%"></i></div></div></div>` : ''}`;
    }
  }
  else if (s.k === 'coll') {
    sig = 'co|' + S.coll.join();
    if (sig !== ui.sheetSig) {
      html = `<p class="sec">Tarihi yapılar · ${S.coll.length}/${LM.length}</p>
        <p class="note" style="margin:0 0 12px">Her yapı tüm kiraları kalıcı %5 artırır, hepsini toplayana ek %10. Etkinliklerden ve altın taksiden çıkar. Şu an <b>+%${Math.round(collBonus() * 100)}</b>.</p>
        <div class="coll">${LM.map(l => { const has = S.coll.includes(l.id); return `<div class="lmc bpbg${has ? '' : ' no'}">${svg(lmSvg(l.id))}<b>${has ? l.n : 'Bulunmadı'}</b></div>`; }).join('')}</div>`;
    }
  }
  else if (s.k === 'lb') {
    // tasarım: L1 · haftalık lig tablosu
    if (!s.req) { s.req = true; s.v = undefined; Cloud.league().then(v => { s.v = v; ui.sheetSig = ''; }).catch(() => { s.v = null; ui.sheetSig = ''; }); }
    const left = fmtLeft(weekEndsAt(t) - t), v = s.v;
    sig = 'lb|' + (v === undefined ? '-' : v ? v.rows.length + ':' + v.myRank + ':' + v.tier : 'x') + Cloud.ready() + Math.floor(S.week.earned) + left;
    if (sig !== ui.sheetSig) {
      const tier = v ? v.tier : S.league.tier, wk = (S.week.key || '').split('H')[1] || '';
      const head = `<div class="lghead"><div><p class="sec">Haftalık lig${wk ? ` · ${+wk}. hafta` : ''}</p>
        <h4 class="lgt">${leagueName(tier)}${v && v.group !== 'onizleme' ? ` · grup ${esc(v.group.slice(-3).toUpperCase())}` : ''}</h4>
        <small class="lgsub">${v ? `${v.size} emlakçı · ` : ''}bitişe ${left}</small></div>${leagueSeal(tier)}</div>`;
      let list = '';
      if (!Cloud.ready()) list = `<p class="note" style="margin-top:0">Lig internet bağlantısıyla çalışır. Bu hafta <b>${fmt(S.week.earned)}</b> kira topladın; bağlanınca grubuna katılırsın.</p>`;
      else if (v === undefined) list = '<p class="note" style="margin-top:0">Grubun yükleniyor…</p>';
      else if (!v) list = '<p class="note" style="margin-top:0">Bu hafta grubuna henüz yerleşmedin. Biraz kira topla; ilk skorunla sana yakın 30 emlakçılık gruba katılırsın.</p>';
      else {
        const z = leagueZones(v.size, v.tier), parts: string[] = [];
        v.rows.forEach((r: any, i: number) => {
          const rank = i + 1, inUp = rank <= z.up, inDown = z.down > 0 && rank > v.size - z.down;
          if (z.down && rank === v.size - z.down + 1) parts.push('<div class="lgline down"><span>▼ Düşme çizgisi</span></div>');
          let sub = '';
          if (r.me) sub = inUp ? 'Yükselme bölgesindesin' : inDown ? 'Düşme bölgesindesin, hızlan' : z.up ? `${z.up}. sıraya ${fmt(Math.max(1, v.rows[z.up - 1].earned - r.earned + 1))} kaldı` : 'Zirvede kal';
          parts.push(`<div class="lbr${r.me ? ' me' : ''}"><span class="rk${inUp ? ' up' : inDown ? ' down' : ''}">${rank}</span><span class="nm"><b>${esc(r.me ? 'Sen' : r.name)}</b> <i>· ${esc(DMAP[r.district]?.n || '')}</i>${sub ? `<small>${sub}</small>` : ''}</span><span class="sc">${fmt(r.earned)}</span></div>`);
          if (rank === z.up && z.up < v.size) parts.push('<div class="lgline up"><span>▲ Yükselme çizgisi</span></div>');
        });
        list = `<div class="lglist">${parts.join('')}</div>`;
      }
      const chips = `<div class="lgchips">${tier < LEAGUE_TOP ? '<div class="up"><small>İlk 5 · yükselir</small><b>Büyük tapu ikramiyesi</b></div>' : '<div class="up"><small>İlk 3</small><b>Haftanın zirve mührü</b></div>'}${tier > 0 ? '<div class="down"><small>Son 5 · düşer</small><b>Bir alt ligde yeni grup</b></div>' : '<div class="down"><small>Arsa Ligi</small><b>Düşme yok</b></div>'}</div>`;
      html = `${head}${list}${chips}
        <div class="btns"><button class="btn soft" data-a="leagues">Ligler ve kurallar</button><button class="txt" data-a="ref">${I.users} Arkadaşını davet et</button></div>`;
    }
  }
  else if (s.k === 'ozel') {
    // tasarım: F5 · haftanın özel tapusu
    const wk = weekKey(new Date(t)), sp = weekSpecial(wk), price = specialPrice(), got = S.ozel.week === wk && S.ozel.bought;
    sig = 'oz|' + wk + got + (S.cash >= price ? 1 : 0) + Math.floor(price) + Math.floor((weekEndsAt(t) - t) / 3600e3) + S.inv.join();
    if (sig !== ui.sheetSig) {
      html = `<div class="lghead"><div><p class="sec">Haftanın özel tapusu</p><h4 class="lgt">${sp.n}</h4><small class="lgsub" style="color:var(--stamp)">Satış bitişi ${fmtLeft(weekEndsAt(t) - t)}</small></div><span class="st spst">NADİR</span></div>
        <div class="spart bpbg">${svg(specialSvg(sp.id), 'art')}</div>
        <p class="gdp">${sp.d}. Boş bir arsaya yerleştirilir; kat çıkılmaz ama tek başına çok kazandırır.</p>
        <div class="lgrw"><div><span>Kira</span><b>semtteki en iyi binanın 3 katı</b></div><div><span>Komşularına</span><b>her yöne +%${Math.round(CFG.SP_ADJ * 100)}</b></div><div><span>Kat çıkma</span><b>yok · tek seviye</b></div><div><span>Holding kurunca</span><b>depoda kalır</b></div></div>
        <div class="btns">${got ? '<button class="btn" disabled>Bu haftanın tapusu alındı</button>' : `<button class="btn lotb" data-a="buyozel" ${S.cash >= price ? '' : 'disabled'}><span class="lbl">Tapuyu al · ${fmt(price)}</span><small>sonra boş bir arsaya yerleştir</small></button>`}</div>
        ${S.inv.length ? `<p class="note">Depoda ${S.inv.length} özel yapı var: boş bir arsaya dokunup yerleştir.</p>` : ''}
        <p class="note" style="text-align:center">Her hafta farklı bir yapı: Han, Pasaj, Yalı Köşkü, Bahçeli Köşk.</p>`;
    }
  }
  else if (s.k === 'guide') {
    // tasarım: K3 · konu listesi
    sig = 'gd';
    if (sig !== ui.sheetSig) {
      const C = chapters();
      html = `<div class="lghead"><div><p class="sec">Kılavuz · ${C.length} madde</p><h4 class="lgt">Emlakçının el kitabı</h4>
        <small class="gdsub">Oyunun tüm kuralları, sayılarıyla. İstediğin maddeye dokun.</small></div>
        <svg class="lgseal" viewBox="0 0 100 100" aria-hidden="true"><g transform="rotate(-9 50 50)"><circle cx="50" cy="50" r="44" fill="none" stroke="currentColor" stroke-width="3.5"/><circle cx="50" cy="50" r="36" fill="none" stroke="currentColor" stroke-width="1.2"/><text x="50" y="62" text-anchor="middle" font-family="IBM Plex Mono" font-weight="600" font-size="38" fill="currentColor">?</text></g></svg></div>
        <div class="gdlist">${C.map((c, i) => `<button class="gditem" data-a="open" data-i="${i}"><span class="no">${String(i + 1).padStart(2, '0')}</span><span class="di"><b>${c.t}</b><small>${c.s}</small></span>${c.isNew ? '<span class="st">YENİ</span>' : ''}<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg></button>`).join('')}</div>`;
    }
  }
  else if (s.k === 'guideItem') {
    // tasarım: K4 · konu sayfası
    const C = chapters(), i = Math.max(0, Math.min(C.length - 1, s.i || 0)), c = C[i], no = (n: number) => String(n + 1).padStart(2, '0');
    sig = 'gi|' + i;
    if (sig !== ui.sheetSig) {
      html = `<button class="gdback" data-a="list"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>Kılavuz</button>
        <div class="gdhead"><div><p class="sec gdno">Madde ${no(i)}</p><h4 class="lgt">${c.t}</h4></div><div class="gdart bpbg">${c.art()}</div></div>
        ${c.body.map(b => `<p class="gdp">${b}</p>`).join('')}
        <div class="lgrw gdfacts">${c.facts.map(([k, v]) => `<div><span>${k}</span><b>${v}</b></div>`).join('')}</div>
        ${c.tip ? `<div class="gdtip"><span class="st">İPUCU</span><span>${c.tip}</span></div>` : ''}
        <div class="gdnav">${i > 0 ? `<button class="gdprev" data-a="prev"><small>← Madde ${no(i - 1)}</small><b>${C[i - 1].t}</b></button>` : '<span></span>'}${i < C.length - 1 ? `<button class="gdnext" data-a="next"><small>Madde ${no(i + 1)} →</small><b>${C[i + 1].t}</b></button>` : '<span></span>'}</div>`;
    }
  }
  else if (s.k === 'leagues') {
    // tasarım: L3 · lig basamakları
    sig = 'lg|' + S.league.tier;
    if (sig !== ui.sheetSig) {
      const rule = (i: number) => i === LEAGUE_TOP ? 'Zirve · ilk 3 haftanın mührünü alır' : i === 0 ? 'Başlangıç · düşme yok' : 'İlk 5 yükselir · son 5 düşer';
      html = `<p class="sec">Ligler · yükseldikçe bina büyür</p><div class="lgtiers">
        ${LEAGUES.map((_, i) => LEAGUE_TOP - i).map(i => `<div class="lgtier${i === S.league.tier ? ' here' : ''}">${tierArt(i)}<span class="di"><b>${leagueName(i)}</b><small>${rule(i)}</small></span>${i === S.league.tier ? '<span class="st">BURADASIN</span>' : ''}</div>`).join('')}</div>
        <div class="lgrules"><p class="sec">Nasıl işler</p>
        <p>Her pazartesi 30 kişilik yeni grup kurulur; kazancı sana yakın oyuncularla eşleşirsin.</p>
        <p>Puan, o hafta topladığın kiradır. Hafta pazar gecesi biter, sonucun ilk girişte gelir.</p>
        <p>Uğramayan oyuncu gruba alınmaz; gruplar hep canlı kalır.</p>${S.league.seals ? `<p>Zirve mührün: <b>${S.league.seals}</b></p>` : ''}</div>
        <div class="btns"><button class="btn soft" data-a="back">Lig tablosuna dön</button></div>`;
    }
  }
  else if (s.k === 'ref') {
    sig = 'rf|' + S.ref.used + S.ref.code;
    if (sig !== ui.sheetSig) {
      html = `<p class="sec">Davet kodun</p><div class="codebox"><b>${S.ref.code}</b><button class="chip" data-a="copy">Kopyala</button></div>
        <div class="btns" style="margin-top:0"><button class="btn gold" data-a="sharetext">${I.share} Davet mesajı gönder</button></div>
        <p class="note">Arkadaşın senin kodunu girince ikinize de tapu hediyesi (nakit) verilir.</p>
        <p class="sec" style="margin-top:20px">Arkadaşının kodu</p>
        ${S.ref.used ? `<p class="note" style="margin-top:0">Kullandığın kod: <b>${esc(S.ref.used)}</b></p>` : `<div class="row2"><input id="refInput" class="inp" maxlength="6" placeholder="TP0000" autocomplete="off" autocapitalize="characters" spellcheck="false" aria-label="Arkadaşının davet kodu"><button class="chip" data-a="usecode">Kullan</button></div>`}`;
    }
  }
  else if (s.k === 'store') {
    sig = 'st|' + S.premium + Purchases.price();
    if (sig !== ui.sheetSig) {
      html = `<div class="sh-head"><div class="badge" style="margin:0">${I.crown}</div><div class="sh-t"><h3>Reklamsız paket</h3><p>Tek seferlik satın alım</p></div></div>
        <ul class="prem"><li>${I.noads}Geçiş reklamı yok</li><li>${I.bolt}Ödüllü reklam ödülleri izlemeden, anında</li><li>${I.crown}Tüm kiralar kalıcı olarak 2 kat</li></ul>
        ${S.premium ? '<div class="btns"><button class="btn" disabled>Aktif</button></div>' : `<div class="price">${Purchases.price()}</div><div class="btns"><button class="btn gold" data-a="buy">Satın al</button><button class="txt" data-a="restore">Satın alımı geri yükle</button></div>`}`;
    }
  }
  else if (s.k === 'holding') {
    const n = sharesPreview();
    sig = 'ho|' + n + canHolding() + (s.conf ? 1 : 0) + (S.shares || 0) + S.own.join();
    if (sig !== ui.sheetSig) {
      html = `<div class="sh-head"><div class="badge" style="margin:0">${I.tower}</div><div class="sh-t"><h3>Holding</h3><p>${S.shares || 0} hisse · kiralar ${fmtX(1 + 0.1 * (S.shares || 0))}</p></div></div>
        <p class="note" style="margin-top:0">Herhangi bir ilin 5. semtinin tapusunu alınca holding kurabilirsin. Semtler ve binalar sıfırlanır; kazandığın hisseler kiraları kalıcı olarak artırır. Koleksiyon, seri, davet ve satın alımlar korunur.</p>
        <div class="task"><div class="tt"><b>Bu turda kazanılacak hisse</b><small>Her hisse +%10 kira · bu turdaki toplam kazanca göre</small></div><b style="font:700 28px var(--cond)">${n}</b></div>
        <div class="btns">${canHolding() ? `<button class="btn gold" data-a="hold">${s.conf ? 'Emin misin? Tekrar dokun' : 'Holding kur'}</button>` : `<button class="btn" disabled>${n < 1 ? 'En az 1 hisse gerekli' : 'Önce bir ilin 5. semti'}</button>`}</div>`;
    }
  }
  if (html !== undefined) { ui.sheetSig = sig; $('#sheetBody').innerHTML = html; }
  if (s.k === 'plot') { // canlı kısımlar (inşaat)
    const p = lotsOf(S, s.key!)[s.i!];
    if (p && p.until) {
      const rem = p.until - t, prog = Math.min(1, 1 - rem / p.dur);
      const art = $('#sheetBody [data-art]'), pb = $('#sheetBody [data-pb]'), pt = $('#sheetBody [data-pt]'), cd = $('#sheetBody [data-cd]');
      const step = Math.floor(prog * 20);
      if (art && art.dataset.s !== String(step)) { art.dataset.s = String(step); art.innerHTML = svg(site(p.t, p.up ? p.lvl : 0, p.up ? p.lvl + 1 : 1, prog)); }
      if (pb) pb.style.width = prog * 100 + '%';
      if (pt) pt.textContent = `${p.up ? 'Kat çıkılıyor' : 'Kaba inşaat'} · %${Math.floor(prog * 100)}`;
      if (cd) cd.textContent = clock(rem);
    }
  }
}

const later = (s: SheetState, key: string) => setTimeout(() => { if (ui.sheet === s) { s[key] = false; ui.sheetSig = ''; } }, 3000);
export async function onSheetAction(a: string, btn: HTMLElement) {
  const s = ui.sheet; if (!s) return;
  if (a === 'close') return closeSheet();
  if (s.k === 'plot') {
    if (a === 'build') return build(s.key!, s.i!, btn.dataset.t as BuildingType);
    if (a === 'up') upgrade(s.key!, s.i!);
    if (a === 'skip') skip(s.key!, s.i!);
    if (a === 'lotboost') lotBoost(s.key!, s.i!);
    if (a === 'place') return placeSpecial(s.key!, s.i!, btn.dataset.id!);
    if (a === 'del') { if (s.del) return demolish(s.key!, s.i!); s.del = true; later(s, 'del'); }
  }
  if (s.k === 'map') {
    const k = btn.dataset.k!;
    if (a === 'go') { switchDistrict(k); closeSheet(); return; }
    if (a === 'buy') return buyDistrict(k);
  }
  if (s.k === 'menu') { if (a === 'share') return openShare(); return openSheet({ k: a }); }
  if (s.k === 'tasks') { if (a === 'daily') { closeSheet(); ui.lastDay = ''; return; } if (a === 'claim') claimTask(+btn.dataset.i!); if (a === 'bonus') claimBonus(); }
  if (s.k === 'lb') { if (a === 'ref') return openSheet({ k: 'ref' }); if (a === 'leagues') return openSheet({ k: 'leagues' }); }
  if (s.k === 'leagues' && a === 'back') return openSheet({ k: 'lb' });
  if (s.k === 'ozel' && a === 'buyozel') return buySpecial();
  if (s.k === 'guide' && a === 'open') return openSheet({ k: 'guideItem', i: +btn.dataset.i! });
  if (s.k === 'guideItem') {
    if (a === 'list') return openSheet({ k: 'guide' });
    if (a === 'prev' || a === 'next') { s.i = (s.i || 0) + (a === 'next' ? 1 : -1); ui.sheetSig = ''; $('#sheetBody').scrollTop = 0; return; }
  }
  if (s.k === 'set' && a === 'guide') return openSheet({ k: 'guide' });
  if (s.k === 'ref') { if (a === 'copy') copyText(S.ref.code); if (a === 'sharetext') shareTextOnly(); if (a === 'usecode') await useCode(($('#refInput') || {}).value); }
  if (s.k === 'store') { if (a === 'buy') return Purchases.buy(); if (a === 'restore') return Purchases.restore(); }
  if (s.k === 'holding' && a === 'hold') { if (s.conf) return doHolding(); s.conf = true; later(s, 'conf'); }
  if (s.k === 'set') {
    if (a === 'sound') { S.sound = !S.sound; persist(); Snd.tap(); }
    if (a === 'rifki') { S.rifki = !S.rifki; if (!S.rifki) hideTip(); persist(); Snd.tap(); }
    if (a === 'cm-tap' || a === 'cm-auto') { S.collectMode = a === 'cm-auto' ? 'auto' : 'tap'; ui.tileSig = []; persist(); Snd.tap(); toast(S.collectMode === 'auto' ? 'Kiralar otomatik toplanacak' : 'Kiraları TOPLA mührüyle toplayacaksın'); }
    if (a === 'notif') { S.notif = !S.notif; if (S.notif) Notify.ask(); persist(); }
    if (a === 'link-google' || a === 'link-apple') { const ok = await Cloud.link(a === 'link-google' ? 'google' : 'apple'); toast(ok ? 'Hesabın bağlandı. İlerlemen artık her cihazda.' : 'Bağlanamadı, tekrar dene'); }
    if (a === 'ads-privacy') await Ads.showPrivacyOptions();
    if (a === 'privacy') window.open(PRIVACY_URL, '_blank');
    if (a === 'delete') { if (s.del) { const ok = await Cloud.deleteAccount(); if (ok) { await resetGame(); toast('Hesabın ve verilerin silindi'); } else toast('Silinemedi, internet bağlantını kontrol et'); return; } s.del = true; later(s, 'del'); }
    if (a === 'reset') { if (s.reset) { await resetGame(); toast('Yeni oyun'); return; } s.reset = true; later(s, 'reset'); }
  }
  ui.sheetSig = ''; if (ui.sheet) renderSheet();
}

/* lig mührü (başlıkta) ve basamak çizimi */
function leagueSeal(tier: number) {
  return `<svg class="lgseal" viewBox="0 0 100 100" aria-hidden="true"><g transform="rotate(-9 50 50)"><circle cx="50" cy="50" r="44" fill="none" stroke="currentColor" stroke-width="3.5"/><circle cx="50" cy="50" r="36" fill="none" stroke="currentColor" stroke-width="1.2"/><text x="50" y="46" text-anchor="middle" font-family="IBM Plex Mono" font-weight="600" font-size="11" fill="currentColor" letter-spacing="1.5">LİG</text><text x="50" y="64" text-anchor="middle" font-family="Barlow Condensed" font-weight="700" font-size="${leagueShort(tier).length > 5 ? 15 : 22}" fill="currentColor">${leagueShort(tier)}</text></g></svg>`;
}
function tierArt(i: number) {
  const n = [0, 2, 4, 6, 9][i], w = [0, 34, 30, 26, 18][i], h = 56 / Math.max(n, 4);
  const floors = Array.from({ length: n }, (_, k) => `<rect x="${27 - w / 2}" y="${(60 - (k + 1) * h).toFixed(1)}" width="${w}" height="${h.toFixed(1)}" fill="var(--bg)" stroke="currentColor" stroke-width="1.5"/>`).join('');
  const stake = n ? '' : '<rect x="10" y="44" width="34" height="14" fill="none" stroke="currentColor" stroke-width="1.2" stroke-dasharray="3 2"/><line x1="40" y1="34" x2="40" y2="50" stroke="var(--stamp)" stroke-width="2"/><rect x="35" y="32" width="10" height="7" fill="var(--stamp)"/>';
  return `<svg class="lgart" viewBox="0 0 54 62" aria-hidden="true"><line x1="2" y1="60" x2="52" y2="60" stroke="currentColor" stroke-width="1.5"/>${floors}${stake}</svg>`;
}

/* haftanın özel tapusu bu hafta alınabilir mi */
const ozelAvail = () => { const wk = weekKey(new Date(now())); return !(S.ozel.week === wk && S.ozel.bought); };
const PAIR_NAME: Record<string, string> = { kafe: 'ofis', ofis: 'kafe', ev: 'dükkân', dukkan: 'ev' };
/* komşuluk şeması: binanın dört komşusu ve etkisi (tasarım F3) */
function nbDiagram(k: string, i: number) {
  const lots = lotsOf(S, k), p = lots[i]!, cell = (j: number | null, pos: string) => {
    if (j == null) return `<span class="nb ${pos} off"></span>`;
    const q = lots[j]; let lab = 'boş arsa', eff = '', cls = 'emp';
    if (q && q.sp) { lab = specialOf(q.sp).n; eff = `+%${Math.round(CFG.SP_ADJ * 100)}`; cls = 'sp'; }
    else if (q && q.lvl >= 1 && !q.until) { lab = TYPES[q.t].n; if (q.t === p.t) { eff = `+%${Math.round(CFG.ADJ * 100)}`; cls = 'same'; } else if (PAIRS[p.t] === q.t) { eff = `+%${Math.round(CFG.PAIR * 100)}`; cls = 'pair'; } else cls = 'none'; }
    else if (q) { lab = 'inşaatta'; cls = 'emp'; }
    return `<span class="nb ${pos} ${cls}"><b>${lab}</b>${eff ? `<i>${eff}</i>` : ''}</span>`;
  };
  const c = i % COLS, up = i >= COLS ? i - COLS : null, dn = i + COLS < N ? i + COLS : null, lf = c > 0 ? i - 1 : null, rt = c < COLS - 1 ? i + 1 : null;
  return `<div class="nbgrid">${cell(up, 'u')}${cell(lf, 'l')}<span class="nb c me"><b>${TYPES[p.t].n}</b></span>${cell(rt, 'r')}${cell(dn, 'd')}</div>
    <p class="note nbnote">Akıllı ikililer: <b>Kafe + Ofis</b>, <b>Ev + Dükkân</b> · ikisine de +%${Math.round(CFG.PAIR * 100)}</p>`;
}
/* semt hedefleri kartı (tasarım F2) */
function goalsCard(k: string) {
  const got = starsOf(k), gs = goalsOf(k);
  return `<div class="goals"><div class="gh"><div><p class="sec">Semt hedefleri · ${got.length}/3</p><h4 class="lgt">${DMAP[k].n}</h4></div><span class="stars">${[0, 1, 2].map(n => `<i class="${n < got.length ? 'on' : ''}">★</i>`).join('')}</span></div>
    ${gs.map((g, gi) => { const [pv, n] = g.f(k), done = got.includes(gi); return `<div class="gr${done ? ' done' : ''}"><span class="gm">${done ? '★' : ''}</span><span class="gt"><b>${g.t}</b><i><u style="width:${done ? 100 : Math.round(pv / n * 100)}%"></u></i></span><span class="gp">${done ? 'tamam' : `${pv}/${n}`}</span></div>`; }).join('')}
    <p class="note" style="margin:8px 0 0">3 yıldız: ${DMAP[k].n} kiralarına kalıcı +%${Math.round(CFG.STAR_BONUS * 100)} ve altın mühür. Her yıldız tapu ikramiyesi verir.</p></div>`;
}
