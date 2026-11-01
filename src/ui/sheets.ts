/* ALT PANELLER — arsa, semtler (çok şehirli), görevler, koleksiyon, menü, sıralama, davet, mağaza, holding, ayarlar */
import { CFG, MAXLV, ORDER, TYPES, LV_INC, DMAP, CITIES, CITY_ORDER, dkey, PRIVACY_URL, BuildingType } from '../config';
import { S, lotsOf } from '../state';
import { fmt, fmtTime, fmtX, clock, esc, dayKey, dayDiff } from '../format';
import { now, withDisc, buildCost, buildTime, upCost, upTime, adj, rate, incM, permMult, fxMult, filled, unlockInfo, collBonus, citiesOwned, portfolioBonus } from '../economy';
import { bld, site, svg } from '../draw';
import { LM, lmSvg } from '../landmarks';
import { I, small } from '../icons';
import { Snd } from '../sound';
import { $, ui, SheetState } from './ctx';
import { toast } from './modal';
import { build, upgrade, skip, demolish, watchBoost, buyDistrict, switchDistrict } from '../game/actions';
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

export function openSheet(s: SheetState) { ui.openedAt = performance.now(); ui.sheet = s; ui.sheetSig = ''; renderSheet(); $('#sheet').classList.add('on'); $('#scrim').classList.add('on'); Snd.tap(); }
export function closeSheet() { if (!ui.sheet) return; ui.sheet = null; ui.lastClose = performance.now(); $('#sheet').classList.remove('on'); if (!ui.modal) $('#scrim').classList.remove('on'); }
const lvBar = (l: number) => `<div class="lv">${[1, 2, 3, 4, 5].map(k => `<i class="${k <= l ? 'on' : ''}"></i>`).join('')}</div>`;
const discBox = () => S.disc ? `<div class="disc">${small(I.tag, 16)} %${Math.round(S.disc * 100)} müteahhit indirimi</div>` : '';
const boostBtn = (soft = false) => `<button class="btn ${soft ? 'soft' : 'gold'}" data-a="boost">${soft ? small(I.play, 12) : I.play} ${soft ? 'Reklam izle, 2x kazan' : 'İzle, 2x kazan'}</button>`;

export function renderSheet() {
  const s = ui.sheet; if (!s) return;
  const t = now(); let sig = '', html: string | undefined;
  if (s.k === 'plot') {
    const k = s.key!, i = s.i!, p = lotsOf(S, k)[i];
    if (!p) {
      sig = 'e|' + ORDER.map(b => (S.seen[b] ? 1 : 0) + '' + (S.cash >= withDisc(buildCost(k, b)) ? 1 : 0)).join() + S.disc;
      if (sig !== ui.sheetSig) {
        const short = ORDER.some(b => S.seen[b] && S.cash < withDisc(buildCost(k, b)));
        html = `${discBox()}<div class="cards">${ORDER.map(b => {
          const T = TYPES[b];
          if (!S.seen[b]) return `<div class="bcard locked bpbg k-${b}">${svg(bld(b, 1))}<span class="bn">${T.n}</span><span class="bl">${fmt(T.unlock)} kazanınca</span><span class="lk">${I.lock}</span></div>`;
          const c = withDisc(buildCost(k, b)), a = adj(k, i, b);
          return `<button class="bcard bpbg k-${b}" data-a="build" data-t="${b}" ${S.cash >= c ? '' : 'disabled'}>${svg(bld(b, 1))}
            <span class="bn">${T.n}</span><span class="bm">${fmt(T.inc * incM(k) * (1 + CFG.ADJ * a) * permMult(), true)}/sn · ${fmtTime(buildTime(k, b))}</span><span class="bp">${fmt(c)}</span>${a ? `<span class="chain" title="Komşu bonusu">+%${a * 20}</span>` : ''}</button>`;
        }).join('')}</div>${short ? `<div class="btns">${boostBtn(true)}</div>` : ''}`;
      }
    } else if (p.until) {
      sig = 'c|' + p.t + p.lvl + (p.up ? 1 : 0) + (p.until - t <= CFG.AD_SKIP ? 1 : 0);
      if (sig !== ui.sheetSig) {
        html = `<div class="sh-head k-${p.t}"><div class="sh-art bpbg" data-art></div><div class="sh-t"><h3>${TYPES[p.t].n}</h3><p data-pt></p></div></div>
          <div class="cd"><span class="sec">Kalan süre</span><span class="cdv" data-cd></span></div>
          <div class="k-${p.t}"><div class="prog"><i data-pb></i></div></div>
          <p class="note">İnşaat sen oyunda değilken de sürer.</p>
          <div class="btns"><button class="btn gold" data-a="skip">${I.play} ${p.until - t <= CFG.AD_SKIP ? 'İzle, hemen bitir' : 'İzle, 30 dk kısalt'}</button><button class="txt" data-a="close">Bekle</button></div>`;
      }
    } else {
      const canUp = p.lvl < MAXLV, uc = canUp ? withDisc(upCost(k, p)) : 0, afford = canUp && S.cash >= uc, a = adj(k, i);
      sig = 'b|' + p.t + p.lvl + (afford ? 1 : 0) + a + (S.boostUntil > t ? 1 : 0) + fxMult(k, i, p, t) + S.disc + (s.del ? 1 : 0);
      if (sig !== ui.sheetSig) {
        const next = canUp ? TYPES[p.t].inc * LV_INC[p.lvl + 1] * incM(k) * (1 + CFG.ADJ * a) * permMult() * fxMult(k, i, p, t) * (S.boostUntil > t ? 2 : 1) : 0;
        html = `<div class="sh-head k-${p.t}"><div class="sh-art bpbg">${svg(bld(p.t, p.lvl))}</div>
          <div class="sh-t"><h3>${TYPES[p.t].n}</h3><p>${DMAP[k].n} · Sv ${p.lvl}/${MAXLV}</p>${lvBar(p.lvl)}</div>
          <button class="iconbtn${s.del ? ' warn' : ''}" data-a="del" aria-label="${s.del ? 'Yıkmayı onayla' : 'Binayı yık'}">${I.trash}</button></div>
          ${s.del ? '<p class="sec" style="text-align:center;margin:0 0 8px">Tekrar dokunursan bina yıkılır</p>' : ''}
          <div class="ledger">
            <div><span>Kira</span><i></i><b>${fmt(rate(k, i), true)}/sn</b></div>
            <div><span>Komşu bonusu</span><i></i><b>${a ? '+%' + a * 20 : 'yok'}</b></div>
            ${S.boostUntil > t ? '<div><span>2x gelir</span><i></i><b class="red">aktif</b></div>' : ''}
            ${canUp ? `<div><span>Sv ${p.lvl + 1} olunca</span><i></i><b>${fmt(next, true)}/sn</b></div>` : ''}
          </div>${canUp ? discBox() : ''}
          <div class="btns">${canUp ? `<button class="btn" data-a="up" ${afford ? '' : 'disabled'}>Kat çık · ${fmt(uc)} <small>${fmtTime(upTime(k, p))}</small></button>` : '<button class="btn" disabled>Son seviye</button>'}
          ${canUp && !afford ? boostBtn() : ''}</div>`;
      }
    }
  }
  else if (s.k === 'map') {
    sig = 'm|' + S.cur + S.own.join() + S.own.map(filled).join() + CITY_ORDER.map(c => CITIES[c].districts.map((_, i) => { const u = unlockInfo(dkey(c, i)); return (u.ok ? 1 : 0) + '' + (S.cash >= u.fee ? 1 : 0); }).join('')).join();
    if (sig !== ui.sheetSig) {
      const start = S.city || 'ist';
      const order = [start, ...CITY_ORDER.filter(c => c !== start)];
      let anyShort = false;
      html = `<p class="sec">Portföy · ${citiesOwned()} il${portfolioBonus() ? ` · kiralar +%${Math.round(portfolioBonus() * 100)}` : ''}</p>` + order.map(c => {
        const ownedHere = S.own.filter(k => DMAP[k].city === c).length;
        const rows = CITIES[c].districts.map((d, i) => {
          const k = dkey(c, i);
          if (S.own.includes(k)) return `<button class="drow${k === S.cur ? ' on' : ''}" data-a="go" data-k="${k}"><span class="di"><b>${d.n}</b><small>${filled(k)}/20 dolu</small></span><span class="mini"><i style="width:${filled(k) / 20 * 100}%"></i></span></button>`;
          const u = unlockInfo(k);
          if (u.ok) { const af = S.cash >= u.fee; if (!af) anyShort = true; return `<button class="drow" data-a="buy" data-k="${k}" ${af ? '' : 'disabled'}><span class="di"><b>${d.n}</b><small>Tapu ${fmt(u.fee)}</small></span><span class="st">SATIŞTA</span></button>`; }
          const why = u.why === 'prev-not-full' ? `${CITIES[c].districts[i - 1].n} dolunca açılır` : u.why === 'start-not-full' ? `${CITIES[start].districts[0].n} dolunca açılır · ${fmt(u.fee)}` : 'Kilitli';
          return `<div class="drow" style="opacity:.5"><span class="di"><b>${d.n}</b><small>${why}</small></span>${I.lock}</div>`;
        }).join('');
        return `<div class="cityhead"><span>${CITIES[c].n}</span><small>${ownedHere ? `${ownedHere}/5 semt` : CITIES[c].tagline}</small></div><div class="dlist">${rows}</div>`;
      }).join('') + `<p class="note">Başlangıç ilinin ilk semtini doldurunca diğer illerin ilk semtini alabilirsin. Her yeni il tüm kiralara kalıcı +%${Math.round(CFG.PORTFOLIO_BONUS * 100)} katar.</p>`
        + (anyShort ? `<div class="btns">${boostBtn()}</div>` : '');
    }
  }
  else if (s.k === 'set') {
    const acct = Cloud.account();
    sig = 's|' + S.sound + S.notif + S.premium + (s.reset ? 1 : 0) + (s.del ? 1 : 0) + JSON.stringify(acct) + Ads.privacyRequired();
    if (sig !== ui.sheetSig) {
      html = `<p class="sec">Nasıl oynanır</p>
        <ul class="rules">
          <li><b>Arsaya dokun</b>, inşaatı başlat. Bina kat kat yükselir.</li>
          <li><b>Para</b> çıkınca dokun ya da parmağını üstünden kaydır.</li>
          <li>Para büyüyüp dolunca kira birikmeyi bırakır. <b>Sık uğra.</b></li>
          <li>Aynı türü <b>yan yana</b> kur; bahçeler, teraslar birleşir ve daha çok kazandırır.</li>
          <li>Semti doldur, <b>yeni semtin tapusunu</b> al. Başka illerde de arsa alabilirsin.</li>
        </ul>
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
    sig = 'mn|' + canHolding() + S.premium + Math.floor(S.week.earned) + (S.shares || 0);
    if (sig !== ui.sheetSig) {
      const row = (a: string, ic: string, b: string, sm: string, dot = false) => `<button class="drow" data-a="${a}"><span class="ic">${ic}${dot ? '<span class="dot"></span>' : ''}</span><span class="di"><b>${b}</b><small>${sm}</small></span></button>`;
      html = `<p class="sec">Menü</p><div class="dlist">
        ${row('share', I.share, 'Şehrini paylaş', 'Story görseli, davet kodunla')}
        ${row('lb', I.trophy, 'Haftalık sıralama', `Bu hafta ${fmt(S.week.earned)} kazandın`)}
        ${row('ref', I.users, 'Arkadaşını davet et', `Kodun: ${S.ref.code}`)}
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
        <div class="task"><div class="tt"><b>Üçünü de bitir</b><small>${fmt(bonusReward())} + 30 dk 2x gelir</small></div><button class="chip${T.bonus ? ' got' : ''}" data-a="bonus" ${T.bonus || !T.list.every(q => q.claimed) ? 'disabled' : ''}>${T.bonus ? 'Alındı' : 'Al'}</button></div>
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
    if (!s.req) { s.req = true; s.rows = null; Cloud.top().then(r => { s.rows = r ? r.rows : []; s.rank = r ? r.myRank : null; ui.sheetSig = ''; }).catch(() => { s.rows = []; ui.sheetSig = ''; }); }
    sig = 'lb|' + (s.rows ? s.rows.length : '-') + Cloud.ready() + Math.floor(S.week.earned);
    if (sig !== ui.sheetSig) {
      const list = !Cloud.ready() ? `<p class="note" style="margin-top:0">Sıralama internet bağlantısıyla çalışır.</p>`
        : !s.rows ? '<p class="note" style="margin-top:0">Yükleniyor…</p>'
          : !s.rows.length ? '<p class="note" style="margin-top:0">Bu hafta henüz kimse yok. İlk sen ol.</p>'
            : `<div>${s.rows.map((r: any, i: number) => `<div class="lbr${r.me ? ' me' : ''}"><span class="rk">${i + 1}</span><span class="nm">${esc(r.me ? 'Sen' : r.name)} · ${esc(DMAP[r.district]?.n || '')}</span><span class="sc">${fmt(r.earned)}</span></div>`).join('')}</div>`;
      html = `<p class="sec">Haftalık sıralama</p>${list}
        <div class="task"><div class="tt"><b>Bu haftaki kazancın</b><small>${s.rank ? `${s.rank}. sıradasın · ` : ''}Her pazartesi sıfırlanır</small></div><b style="font:700 24px var(--cond)">${fmt(S.week.earned)}</b></div>
        <div class="btns"><button class="btn gold" data-a="ref">${I.users} Arkadaşlarını yarışa davet et</button></div>`;
    }
  }
  else if (s.k === 'ref') {
    sig = 'rf|' + S.ref.used + S.ref.code;
    if (sig !== ui.sheetSig) {
      html = `<p class="sec">Davet kodun</p><div class="codebox"><b>${S.ref.code}</b><button class="chip" data-a="copy">Kopyala</button></div>
        <div class="btns" style="margin-top:0"><button class="btn gold" data-a="sharetext">${I.share} Davet mesajı gönder</button></div>
        <p class="note">Arkadaşın senin kodunu girince ona hoş geldin hediyesi, sana 2 saat 2x gelir.</p>
        <p class="sec" style="margin-top:20px">Arkadaşının kodu</p>
        ${S.ref.used ? `<p class="note" style="margin-top:0">Kullandığın kod: <b>${esc(S.ref.used)}</b></p>` : `<div class="row2"><input id="refInput" class="inp" maxlength="6" placeholder="TP0000" autocomplete="off" autocapitalize="characters" spellcheck="false" aria-label="Arkadaşının davet kodu"><button class="chip" data-a="usecode">Kullan</button></div>`}`;
    }
  }
  else if (s.k === 'store') {
    sig = 'st|' + S.premium + Purchases.price();
    if (sig !== ui.sheetSig) {
      html = `<div class="sh-head"><div class="badge" style="margin:0">${I.crown}</div><div class="sh-t"><h3>Reklamsız paket</h3><p>Tek seferlik satın alım</p></div></div>
        <ul class="prem"><li>${I.noads}Geçiş reklamı yok</li><li>${I.bolt}Ödüllü reklam ödülleri izlemeden, anında</li><li>${I.crown}Kalıcı 2x gelir (2x ile birlikte 4x)</li></ul>
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
  if (a === 'boost') { closeSheet(); return watchBoost(); }
  if (s.k === 'plot') {
    if (a === 'build') return build(s.key!, s.i!, btn.dataset.t as BuildingType);
    if (a === 'up') upgrade(s.key!, s.i!);
    if (a === 'skip') skip(s.key!, s.i!);
    if (a === 'del') { if (s.del) return demolish(s.key!, s.i!); s.del = true; later(s, 'del'); }
  }
  if (s.k === 'map') {
    const k = btn.dataset.k!;
    if (a === 'go') { switchDistrict(k); closeSheet(); return; }
    if (a === 'buy') return buyDistrict(k);
  }
  if (s.k === 'menu') { if (a === 'share') return openShare(); return openSheet({ k: a }); }
  if (s.k === 'tasks') { if (a === 'daily') { closeSheet(); ui.lastDay = ''; return; } if (a === 'claim') claimTask(+btn.dataset.i!); if (a === 'bonus') claimBonus(); }
  if (s.k === 'lb' && a === 'ref') return openSheet({ k: 'ref' });
  if (s.k === 'ref') { if (a === 'copy') copyText(S.ref.code); if (a === 'sharetext') shareTextOnly(); if (a === 'usecode') await useCode(($('#refInput') || {}).value); }
  if (s.k === 'store') { if (a === 'buy') return Purchases.buy(); if (a === 'restore') return Purchases.restore(); }
  if (s.k === 'holding' && a === 'hold') { if (s.conf) return doHolding(); s.conf = true; later(s, 'conf'); }
  if (s.k === 'set') {
    if (a === 'sound') { S.sound = !S.sound; persist(); Snd.tap(); }
    if (a === 'notif') { S.notif = !S.notif; if (S.notif) Notify.ask(); persist(); }
    if (a === 'link-google' || a === 'link-apple') { const ok = await Cloud.link(a === 'link-google' ? 'google' : 'apple'); toast(ok ? 'Hesabın bağlandı. İlerlemen artık her cihazda.' : 'Bağlanamadı, tekrar dene'); }
    if (a === 'ads-privacy') await Ads.showPrivacyOptions();
    if (a === 'privacy') window.open(PRIVACY_URL, '_blank');
    if (a === 'delete') { if (s.del) { const ok = await Cloud.deleteAccount(); if (ok) { await resetGame(); toast('Hesabın ve verilerin silindi'); } else toast('Silinemedi, internet bağlantını kontrol et'); return; } s.del = true; later(s, 'del'); }
    if (a === 'reset') { if (s.reset) { await resetGame(); toast('Yeni oyun'); return; } s.reset = true; later(s, 'reset'); }
  }
  ui.sheetSig = ''; if (ui.sheet) renderSheet();
}
