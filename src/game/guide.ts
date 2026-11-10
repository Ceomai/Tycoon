/* =========================================================
   KILAVUZ — "Emlakçının el kitabı" (tasarım: K3 konu listesi, K4 konu sayfası)
   Sayılar oyunun ayarlarından okunur; Remote Config ile denge değişirse kılavuz da güncel kalır.
   ========================================================= */
import { SERVER_FEATURES, CFG, TYPES, ORDER, LV_INC, UP_COST, UP_TIME, MAXLV, TIER_FEE, TIER_M, CITIES, CITY_ORDER, LEAGUES, GROUP_SIZE, DRULES, dkey, currency } from '../config';
import { S } from '../state';
import { fmt, fmtTime } from '../format';
import { LM, lmSvg } from '../landmarks';
import { bld, svg } from '../draw';
import { I } from '../icons';
import { SPECIALS, specialSvg, weekSpecial } from '../specials';
import { ACH, SEASON_LV, XP_PER } from './fun';
import { t, nm, pctTxt, loc, lowTxt, LANG } from '../i18n';

export interface Chapter { t: string; s: string; isNew?: boolean; art: () => string; body: string[]; facts: [string, string][]; tip?: string; }

const pct = (x: number) => pctTxt(Math.round(x * 100));
const dk = (ms: number) => fmtTime(ms);
const sec = (s: number) => fmtTime(s * 1000);
const icon = (s: string) => `<span class="gdicon">${s}</span>`;

/** Kılavuzdaki semt kuralı örneği: etkin bölgenin ilk şehrinin 2. ve 5. semti (Türkiye'de Beşiktaş ve Bebek). */
function ruleEx() {
  const c = CITY_ORDER[0], d = (i: number) => loc(nm(CITIES[c].districts[i].n)), r = (i: number) => lowTxt(t(DRULES[dkey(c, i)].t).replace(/ \(.*\)/, ''));
  return { d1: d(1), r1: r(1), d2: d(4), r2: r(4) };
}
export function chapters(): Chapter[] {
  const T = TYPES, tierRent = Math.round(TIER_M[1] * CFG.TIER_INC * 10) / 10;
  const list: Chapter[] = [
    {
      t: t('İlk adımlar'), s: t('İl seç, arsaya dokun, ilk evini kur'),
      art: () => svg(bld('ev', 1), 'art'),
      body: [
        t('Oyuna bir ilde başlarsın: {list} ya da {last}. Ekrandaki kareler senin <b>arsaların</b>.', { list: CITY_ORDER.slice(0, -1).map(c => nm(CITIES[c].n)).join(LANG === 'ja' ? '、' : ', '), last: nm(CITIES[CITY_ORDER[CITY_ORDER.length - 1]].n) }),
        t('Boş bir arsaya dokun, <b>Ev</b> seç. İnşaat bitince ev kira üretmeye başlar. Para birikince yeni binalar dik, kat çık, semti doldur.'),
      ],
      facts: [[t('Başlangıç kasası'), fmt(150)], [t('İlk bina'), t('Ev · {cost}', { cost: fmt(T.ev.cost) })], [t('İlk inşaat'), sec(T.ev.time)], [t('Bir semtte'), t('20 arsa')]],
      tip: t('Kira binaların kumbarasında birikir; ortadaki TOPLA mührüne basınca hepsi kasana geçer.'),
    },
    {
      t: t('Binalar'), s: t('Ev, Kafe, Dükkân, Ofis · ne zaman açılır'),
      art: () => `<div class="gdrow">${ORDER.map(ty => svg(bld(ty, 2), 'art')).join('')}</div>`,
      body: [
        t('Dört bina türü var. Pahalı bina daha çok kira getirir ama daha uzun sürede yapılır.'),
        t('Yeni türler, o turda toplam kazancın belli bir eşiği geçince açılır.'),
      ],
      facts: ORDER.map(ty => [t(T[ty].n), `${fmt(T[ty].cost)} · ${sec(T[ty].time)}${T[ty].unlock ? ` · ${t('{n} kazanınca', { n: fmt(T[ty].unlock) })}` : ''}`] as [string, string]),
      tip: t('Değerler ilk semt içindir; ileri semtlerde bedeller ve kiralar katlanır (madde 06).'),
    },
    {
      t: t('Kira ve kumbara'), s: t('TOPLA mührü ya da otomatik · kumbara {t}’de dolar', { t: sec(CFG.CAP_SEC) }),
      art: () => svg(bld('ev', 2), 'art') + `<span class="gdcoin">${currency()}</span>`,
      body: [
        t('Kurduğun her bina saniye saniye kira üretir. Kira, binanın <b>kumbarasında</b> birikir; binanın altındaki ince çubuk ne kadar dolduğunu gösterir.'),
        t('Ortadaki <b>TOPLA</b> mührüne bas: bütün semtlerdeki kira tek seferde kasana geçer. Mührün halkası kumbaraların doluluğunu gösterir; kumbara dolunca kira birikmeyi bırakır. İstersen Ayarlar’dan <b>Otomatik</b>’e geç: oyun açıkken kira kendiliğinden kasana akar.'),
      ],
      facts: [[t('Kumbaranın dolma süresi'), sec(CFG.CAP_SEC)], [t('Toplamak için'), t('TOPLA mührü')], [t('Otomatik mod'), t('Ayarlar → Kira toplama')], [t('Kumbara dolunca'), t('Kira durur')]],
      tip: t('Binaya dokunmak her zaman mülk panelini açar; kira toplamak için binalara tek tek dokunman gerekmez.'),
    },
    {
      t: t('Kat çıkmak ve komşuluk'), s: t('{max} kat · aynı tür komşu başına +{p}', { max: MAXLV, p: pct(CFG.ADJ) }),
      art: () => svg(bld('ev', 4), 'art'),
      body: [
        t('Bir binaya dokunup <b>kat çık</b>. Her bina {max} kata kadar büyür ve her katta kirası katlanır. Tadilat sürerken bina kira üretmez.', { max: MAXLV }),
        t('Aynı türden binaları <b>yan yana</b> (sağ, sol, üst, alt) kur: her komşu kirayı +{adj} artırır. <b>Akıllı ikililer</b> de kazandırır: Kafe + Ofis ve Ev + Dükkân yan yana olunca ikisine de +{pair}. Mülk panelindeki şema dört komşuyu gösterir.', { adj: pct(CFG.ADJ), pair: pct(CFG.PAIR) }),
      ],
      facts: [
        [t('Kira çarpanı (1→5. kat)'), LV_INC.slice(1).map(x => `${String(x).replace('.', ',')}x`).join(' · ')],
        [t('Tadilat bedeli'), t('bina bedelinin {x} katı', { x: UP_COST.slice(1).join(' · ') })],
        [t('Tadilat süresi'), t('inşaatın {x} katı', { x: UP_TIME.slice(1).join(' · ') })],
        [t('Aynı tür komşu'), t('komşu başına +{p}', { p: pct(CFG.ADJ) })],
        [t('Akıllı ikili'), t('Kafe+Ofis, Ev+Dükkân · +{p}', { p: pct(CFG.PAIR) })],
        [t('Özel yapı komşusu'), `+${pct(CFG.SP_ADJ)}`],
      ],
      tip: t('Ortadaki arsalar dört komşuya dokunur; en değerli binayı ortaya koy.'),
    },
    {
      t: t('İnşaat ve hızlandırma'), s: t('Reklamla {t} kısalt · son 5 sn senin', { t: dk(CFG.AD_SKIP) }),
      art: () => icon(I.tower || I.play),
      body: [
        t('İnşaat ve tadilat süreyle ilerler. Panelden kalan süreyi görürsün.'),
        t('Beklemek istemezsen kısa bir reklam izle: {t}’dan kısa işler <b>5 saniyeye</b> iner, bitiş anını izlersin; daha uzunsa süreden {t} düşer.', { t: dk(CFG.AD_SKIP) }),
      ],
      facts: [[t('Reklamla hızlandırma'), t('{t} kısalır', { t: dk(CFG.AD_SKIP) })], [t('Kısa işlerde'), t('5 sn kalır')], [t('Tadilatta'), t('kira üretilmez')], [t('Yıkmak'), t('iki kez dokun (onaylı)')]],
    },
    {
      t: t('Semtler ve iller'), s: t('Tapu, kapora, semt kuralları, engelli arsalar'), isNew: true,
      art: () => icon('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M3 6.5 9 4l6 2.5L21 4v13.5L15 20l-6-2.5L3 20z"/><path d="M9 4v13.5M15 6.5V20"/></svg>'),
      body: [
        t('Her ilde 5 semt var ({list}). Bir semtin 20 arsasını doldurunca sıradaki semtin <b>tapusunu</b> alabilirsin.', { list: CITY_ORDER.map(c => nm(CITIES[c].n)).join(', ') }),
        t('Paran tapuya yetmiyorsa <b>kapora</b> ver: tapunun {p}’unu öde, yeni semtin {lots} arsası hemen açılır. Kalan borç o semtin kirasının yarısıyla kendiliğinden ödenir; bitince 20 arsanın hepsi senin. Ana ekrandaki çubuk bu semtin ne kadarının dolduğunu ve sonraki kaporaya ne kadar kaldığını gösterir.', { p: pctTxt(Math.round(CFG.KAPORA * 100)), lots: CFG.KAPORA_LOTS }),
        t('Her semtin kendine özel bir <b>kuralı</b> var (örneğin {d1} {r1}, {d2} {r2}). Yeni semtlerde 3–4 arsa gecekondu, hurda araba ya da molozla dolu gelir: küçük bir bedelle temizle, eski eşyalardan para çıkar, nadiren tarihi bir kalıntı.', ruleEx()),
        t('Her yeni semt kademesinde bina bedelleri {m} kat, kiralar {r} kat artar. Başlangıç ilinin ilk semtini doldurunca diğer illerin ilk semtleri de satışa çıkar; her ek il tüm kiralarına kalıcı +{p} kazandırır.', { m: TIER_M[1], r: String(tierRent).replace('.', ','), p: pct(CFG.PORTFOLIO_BONUS) }),
      ],
      facts: [
        [t('2. semt tapusu'), fmt(TIER_FEE[1])], [t('3. semt tapusu'), fmt(TIER_FEE[2])], [t('4. semt tapusu'), fmt(TIER_FEE[3])], [t('5. semt tapusu'), fmt(TIER_FEE[4])],
        [t('2. il · 3. il'), `${fmt(CFG.EXTRA_CITY_FEE_1)} · ${fmt(CFG.EXTRA_CITY_FEE_2)}`], [t('Portföy bonusu'), t('il başına +{p}', { p: pct(CFG.PORTFOLIO_BONUS) })],
        [t('Kapora'), t('{p} peşin · {lots} arsa hemen', { p: pctTxt(Math.round(CFG.KAPORA * 100)), lots: CFG.KAPORA_LOTS })], [t('Borç ödemesi'), t('o semtin kirasının yarısı')],
      ],
      tip: t('Semtler arasında geçince, uzaktaki semtinin sen yokken ne kazandığını altta görürsün.'),
    },
    {
      t: t('Semt hedefleri'), s: t('Her semtte 3 yıldız · 3 yıldıza +{p}', { p: pct(CFG.STAR_BONUS) }), isNew: true,
      art: () => '<span class="gdstamp sm">★★★</span>',
      body: [
        t('Her semtin 3 hedefi var: aynı türden binaları yan yana dizmek, bir binayı belli bir kata çıkarmak, semti doldurmak. İleri semtlerde hedefler büyür.'),
        t('Her hedef bir yıldız ve tapu ikramiyesi verir. 3 yıldızlı semt <b>altın mühür</b> alır ve kiraları kalıcı +{p} artar. Hedefler Semtler düğmesinde, haritanın en üstünde.', { p: pct(CFG.STAR_BONUS) }),
      ],
      facts: [[t('Semt başına'), t('3 hedef')], [t('Her yıldız'), t('tapu ikramiyesi')], [t('3 yıldız'), t('kalıcı +{p} · altın mühür', { p: pct(CFG.STAR_BONUS) })], [t('Kazanılan yıldız'), t('kaybolmaz')]],
      tip: t('Hedefleri baştan planla: yan yana dizilen binalar hem yıldız hem komşuluk bonusu getirir.'),
    },
    {
      t: t('2x gelir'), s: t('Mülke özel 2x · görev ödülü: tüm mülklere 2x'),
      art: () => '<span class="gdstamp">2x</span>',
      body: [
        t('Bir binaya dokun, panelde <b>“İzle · bu mülke 2x”</b>e bas: kısa bir reklamla yalnızca o bina {t} boyunca iki kat kira getirir. Binanın üstünde küçük “2x” etiketi görünür.', { t: dk(CFG.LOT_BOOST) }),
        t('<b>Tüm mülklere 2x</b> ise yalnızca günün 3 görevini bitirince verilir ({t}). Reklamsız paket tüm kiraları kalıcı olarak 2 kat yapar.', { t: dk(CFG.TASK_BOOST) }),
      ],
      facts: [[t('Bu mülke 2x (reklam)'), t('+{t} · en fazla {max}', { t: dk(CFG.LOT_BOOST), max: dk(CFG.LOT_BOOST_MAX) })], [t('Tüm mülklere 2x'), t('günün 3 görevi · {t}', { t: dk(CFG.TASK_BOOST) })], [t('İkisi birlikte'), t('4 kat kira')], [t('Reklamsız paket'), t('kalıcı 2x + reklamsız')]],
      tip: t('Reklamı en çok kira getiren binana izlet; aynı süre orada çok daha fazla para eder.'),
    },
    {
      t: t('Kira günü ve görevler'), s: t('7 günlük seri · her gün 3 görev'),
      art: () => icon(I.cal || I.play),
      body: [
        t('Her gün ilk girişte <b>kira günü</b> ödülü alırsın; seri büyüdükçe ödül artar, 7. gün büyük nakit ödül verir. 1–2 gün kaçırırsan seriyi reklamla kurtarabilirsin.'),
        t('Her gün 3 yeni <b>görev</b> gelir (kira topla, kat çık, bir mülke 2x ver…). Üçünü bitirince bonus ve <b>tüm mülklere 2x</b> ({t}) kazanırsın; bu ödül başka hiçbir yerden verilmez.', { t: dk(CFG.TASK_BOOST) }),
      ],
      facts: [[t('Seri'), t('7 gün · sonra yeniden')], [t('7. gün'), t('büyük nakit ödül')], [t('Görev bonusu'), t('tüm mülklere 2x · {t}', { t: dk(CFG.TASK_BOOST) })]],
    },
    {
      t: t('Etkinlikler ve altın taksi'), s: t('Kartlar, süreli fırsatlar, taksi avı'),
      art: () => '<span class="gdtaxi"></span>',
      body: [
        t('Oynarken arada bir <b>etkinlik kartı</b> çıkar (metro açıldı, turist akını, vergi iadesi…). Bazıları bir sırayı ya da bina türünü bir süre güçlendirir.'),
        t('Süreli <b>fırsatlar</b> üstte sayaçlı bant olarak görünür; süresi bitmeden tamamlarsan ödül alırsın. Yollarda arada <b>altın taksi</b> geçer: yakala, para kazan; şansın varsa tarihi yapı çıkar.'),
      ],
      facts: [[t('Etkinlik kartı'), t('{a}–{b}’da bir', { a: dk(CFG.EVENT_MIN), b: dk(CFG.EVENT_MAX) })], [t('Süreli fırsat'), t('{a}–{b}’da bir', { a: dk(CFG.OFFER_MIN), b: dk(CFG.OFFER_MAX) })], [t('Altın taksi'), t('yaklaşık 1–2 dk’da bir')], [t('Taksiden tarihi yapı'), t('%8 şans')]],
    },
    {
      t: t('Mevsimler'), s: t('Kışın kar, yazın plaj şemsiyeleri'), isNew: true,
      art: () => '<span class="gdstamp sm">❄</span>',
      body: [t('Mevsimler şehirde görünür: kışın kar yağar, yazın sahil semtlerinin boş arsalarında plaj şemsiyeleri açılır. Yalnızca görünümdür; kiraları değiştirmez.')],
      facts: [[t('Kış'), t('Aralık–Şubat · kar')], [t('Yaz'), t('Haziran–Ağustos · plaj şemsiyeleri')]],
    },
    {
      t: t('Piyasa ve belediye'), s: t('Haftalık piyasa raporu · kalıcı belediye kararları'), isNew: true,
      art: () => '<span class="gdstamp sm">↑</span>',
      body: [
        t('Her pazartesi bir <b>piyasa raporu</b> gelir: bir bina türü o hafta +%30 kazanır, bir başkası −%10. Rapor herkes için aynıdır; kira göstergesindeki küçük işaret (örneğin “OFİS ↑”) hafta boyunca durur.'),
        t('Arada bir <b>belediye</b> görüşünü sorar: park mı otopark mı, metro durağı mı bisiklet yolu mu? Seçtiğin yatırım o semtte ilgili türe kalıcı +%15 verir. Her semtte en fazla 2 karar.'),
      ],
      facts: [[t('Piyasa'), t('bir tür +%30 · bir tür −%10')], [t('Belediye kararı'), t('semtte kalıcı +%15')], [t('Semt başına'), t('en fazla 2 karar')]],
      tip: t('Piyasa raporu ofisi gösteriyorsa, o hafta ofislere kat çıkmanın tam zamanı.'),
    },
    {
      t: t('Tapu arşivi ve cephe'), s: t('Mühür albümü · binalarına renk ve çatı'), isNew: true,
      art: () => `<span class="gdstamp sm">${t('MÜHÜR')}</span>`,
      body: [
        t('<b>Tapu arşivi</b> (Menü) {n} mühürlük bir albüm: ilk ofis, 100. bina, üç il, altın mühür… Her 4 mühür tüm kiralara kalıcı +%1 verir.', { n: ACH.length }),
        t('Bir binaya dokunup <b>Görünümü değiştir</b> ile cephe rengini, evlerde çatıyı ve tabelayı seçebilirsin. Yalnızca görünümdür; bazı renkler arşivden ve tapu sezonundan açılır.'),
      ],
      facts: [[t('Arşiv bonusu'), t('her 4 mühürde +%1')], [t('Cephe'), t('9 renk · 3 çatı · tabela')], [t('Kira etkisi'), t('yok (yalnızca görünüm)')]],
    },
    {
      t: t('Tapu sezonu'), s: t('Aylık {n} basamak · ücretsiz ve Altın Tapu yolu', { n: SEASON_LV }), isNew: true,
      art: () => '<span class="gdstamp sm">30</span>',
      body: [
        t('Her ay yeni bir <b>tapu sezonu</b> başlar. Kira toplamak, görev bitirmek, kat çıkmak, yıldız ve terfi kazanmak puan verir; her {xp} puanda bir basamak atlarsın.', { xp: XP_PER }),
        t('Ücretsiz yolda nakit, <b>2x jetonu</b> (bir mülke reklamsız 1 saat 2x) ve cephe renkleri var. <b>Altın Tapu</b> her basamakta ek ödül, altın cephe ve 30. basamakta özel bir yapı verir.'),
      ],
      facts: [[t('Basamak'), t('{n} · her biri {xp} puan', { n: SEASON_LV, xp: XP_PER })], [t('Puan'), t('kira, görev, inşaat, yıldız, lig')], [t('Yenilenme'), t('her ayın başında')]],
    },
    {
      t: t('Tarihi yapılar'), s: t('Her biri +%5 · hepsi ek +%10'),
      art: () => svg(lmSvg(LM[0].id), 'art'),
      body: [
        t('{n} tarihi yapı var: {list}.', { n: LM.length, list: LM.map(l => t(l.n)).join(', ') }),
        t('Etkinliklerden ve altın taksiden çıkarlar. Her yapı tüm kiralarını kalıcı olarak artırır; koleksiyon Holding kursan da silinmez.'),
      ],
      facts: [[t('Yapı başına'), t('+%5 kalıcı')], [t('Hepsini toplayana'), t('ek +%10')], [t('Şu an'), `${S.coll.length}/${LM.length}`]],
    },
    {
      t: t('Haftanın özel tapusu'), s: t('Her hafta bir nadir yapı'), isNew: true,
      art: () => svg(specialSvg(weekSpecial(S.week.key).id), 'art'),
      body: [
        t('Her hafta bir nadir yapı satışa çıkar: {list}. Menü → Haftanın özel tapusu. Fiyatı yaklaşık {h} saatlik kira gelirin kadardır.', { list: SPECIALS.map(x => t(x.n)).join(', '), h: CFG.SP_PRICE_H }),
        t('Aldığın yapı depoya girer; boş bir arsaya dokunup yerleştirirsin. Semtteki en iyi binanın 3 katı kira getirir ve dört komşusuna +{p} verir. Kat çıkılmaz; yıkarsan ya da Holding kurarsan depoya döner.', { p: pct(CFG.SP_ADJ) }),
      ],
      facts: [[t('Sıklık'), t('haftada bir')], [t('Kira'), t('en iyi binanın 3 katı')], [t('Komşularına'), `+${pct(CFG.SP_ADJ)}`], [t('Holding’de'), t('kaybolmaz')]],
    },
    {
      t: t('Haftalık lig'), s: t('{n} kişilik grup · ilk 5 yükselir', { n: GROUP_SIZE }),
      art: () => `<span class="gdstamp sm">${t('LİG')}</span>`,
      body: [
        t('Her pazartesi, kazancı sana yakın {n} emlakçıyla bir gruba girersin. Puan, o hafta topladığın kiradır.', { n: GROUP_SIZE }),
        t('Ligler: {list}. Hafta sonunda ilk 5 bir üst lige çıkar (büyük tapu ikramiyesi), son 5 bir alt lige iner. Arsa Ligi\'nde düşme yok; Gökdelen\'de ilk 3 zirve mührü alır.', { list: LEAGUES.map(l => t(l.n)).join(' → ') }),
      ],
      facts: [[t('Grup'), t('{n} kişi', { n: GROUP_SIZE })], [t('Yükselen · düşen'), t('ilk 5 · son 5')], [t('Hafta biter'), t('pazartesi 03:00 (TSİ)')], [t('Gerekir'), t('internet bağlantısı')]],
    },
    {
      t: t('Holding'), s: t('Baştan başla, kalıcı hisse çarpanı'),
      art: () => icon(I.crown || I.tower),
      body: [
        t('Bir ilin 5. semtini alınca <b>Holding</b> kurabilirsin: semtlerin ve kasan sıfırlanır, ama bu turdaki kazancına göre <b>hisse</b> alırsın.'),
        t('Her hisse tüm kiralarını kalıcı +%10 artırır; ikinci turda çok daha hızlı büyürsün. Koleksiyon, lig ve reklamsız paket korunur.'),
      ],
      facts: [[t('Hisse'), t('√(tur kazancı ÷ {base})', { base: fmt(CFG.SHARE_BASE) })], [t('Hisse başına'), t('+%10 kalıcı')], [t('Korunanlar'), t('hisseler, tarihi yapılar, lig')], [t('Sıfırlananlar'), t('kasa, semtler, binalar')]],
    },
    {
      t: t('Sen yokken'), s: t('{p} verim · en fazla {max} · 3x seçeneği', { p: pct(CFG.OFFLINE_RATE), max: dk(CFG.OFFLINE_MAX) }),
      art: () => icon(I.moon || I.play),
      body: [
        t('Oyundan çıktığında da kiraların {p} verimle işler. Döndüğünde biriken tutarı alırsın; istersen reklam izleyip 3 katını alabilirsin.', { p: pct(CFG.OFFLINE_RATE) }),
        t('Görev ödülü “tüm mülklere 2x” süresi yokken de geçerlidir.'),
      ],
      facts: [[t('Verim'), pct(CFG.OFFLINE_RATE)], [t('En fazla'), dk(CFG.OFFLINE_MAX)], [t('Reklamla'), t('3 katı')], [t('Bildirim'), t('kasa dolunca haber verir')]],
    },
    {
      t: t('Hesap ve kayıt'), s: t('Bulut yedeği · Google/Apple ile bağla'),
      art: () => icon(I.users),
      body: [
        t('İlerlemen bu cihazda saklanır ve internet varken buluta yedeklenir. Telefon değiştirirsen ilerlemen kaybolmasın diye Ayarlar’dan <b>Google ya da Apple ile bağla</b>.'),
        t('Ayarlar’dan bildirimleri, sesi ve reklam izinlerini yönetebilir; hesabını ve tüm verilerini silebilirsin.'),
      ],
      facts: [[t('Bulut yedeği'), t('{t}’da bir + çıkarken', { t: dk(CFG.CLOUD_SAVE_MS) })], [t('Hesap bağlama'), t('Ayarlar → Hesap')], [t('Veri silme'), t('Ayarlar → Hesabımı sil')]],
    },
  ];
  return SERVER_FEATURES ? list : list.filter(c => c.t !== t('Haftalık lig')); // lig sunucu yayına alınınca görünür
}
