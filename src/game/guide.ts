/* =========================================================
   KILAVUZ — "Emlakçının el kitabı" (tasarım: K3 konu listesi, K4 konu sayfası)
   Sayılar oyunun ayarlarından okunur; Remote Config ile denge değişirse kılavuz da güncel kalır.
   ========================================================= */
import { CFG, TYPES, ORDER, LV_INC, UP_COST, UP_TIME, MAXLV, TIER_FEE, TIER_M, CITIES, CITY_ORDER, LEAGUES, GROUP_SIZE } from '../config';
import { S } from '../state';
import { fmt, fmtTime } from '../format';
import { LM, lmSvg } from '../landmarks';
import { bld, svg } from '../draw';
import { I } from '../icons';
import { SPECIALS, specialSvg, weekSpecial } from '../specials';

export interface Chapter { t: string; s: string; isNew?: boolean; art: () => string; body: string[]; facts: [string, string][]; tip?: string; }

const pct = (x: number) => `%${Math.round(x * 100)}`;
const dk = (ms: number) => fmtTime(ms);
const sec = (s: number) => fmtTime(s * 1000);
const icon = (s: string) => `<span class="gdicon">${s}</span>`;

export function chapters(): Chapter[] {
  const T = TYPES, tierRent = Math.round(TIER_M[1] * CFG.TIER_INC * 10) / 10;
  return [
    {
      t: 'İlk adımlar', s: 'İl seç, arsaya dokun, ilk evini kur',
      art: () => svg(bld('ev', 1), 'art'),
      body: [
        'Oyuna bir ilde başlarsın: İstanbul, İzmir ya da Ankara. Ekrandaki kareler senin <b>arsaların</b>.',
        'Boş bir arsaya dokun, <b>Ev</b> seç. İnşaat bitince ev kira üretmeye başlar. Para birikince yeni binalar dik, kat çık, semti doldur.',
      ],
      facts: [['Başlangıç kasası', fmt(150)], ['İlk bina', `Ev · ${fmt(T.ev.cost)}`], ['İlk inşaat', sec(T.ev.time)], ['Bir semtte', '20 arsa']],
      tip: 'Kira binaların kumbarasında birikir; ortadaki TOPLA mührüne basınca hepsi kasana geçer.',
    },
    {
      t: 'Binalar', s: 'Ev, Kafe, Dükkân, Ofis · ne zaman açılır',
      art: () => `<div class="gdrow">${ORDER.map(t => svg(bld(t, 2), 'art')).join('')}</div>`,
      body: [
        'Dört bina türü var. Pahalı bina daha çok kira getirir ama daha uzun sürede yapılır.',
        'Yeni türler, o turda toplam kazancın belli bir eşiği geçince açılır.',
      ],
      facts: ORDER.map(t => [T[t].n, `${fmt(T[t].cost)} · ${sec(T[t].time)}${T[t].unlock ? ` · ${fmt(T[t].unlock)} kazanınca` : ''}`] as [string, string]),
      tip: 'Değerler ilk semt içindir; ileri semtlerde bedeller ve kiralar katlanır (madde 06).',
    },
    {
      t: 'Kira ve kumbara', s: `TOPLA mührü ya da otomatik · kumbara ${sec(CFG.CAP_SEC)}’de dolar`,
      art: () => svg(bld('ev', 2), 'art') + '<span class="gdcoin">₺</span>',
      body: [
        'Kurduğun her bina saniye saniye kira üretir. Kira, binanın <b>kumbarasında</b> birikir; binanın altındaki ince çubuk ne kadar dolduğunu gösterir.',
        'Ortadaki <b>TOPLA</b> mührüne bas: bütün semtlerdeki kira tek seferde kasana geçer. Mührün halkası kumbaraların doluluğunu gösterir; kumbara dolunca kira birikmeyi bırakır. İstersen Ayarlar’dan <b>Otomatik</b>’e geç: oyun açıkken kira kendiliğinden kasana akar.',
      ],
      facts: [['Kumbaranın dolma süresi', sec(CFG.CAP_SEC)], ['Toplamak için', 'TOPLA mührü'], ['Otomatik mod', 'Ayarlar → Kira toplama'], ['Kumbara dolunca', 'Kira durur']],
      tip: 'Binaya dokunmak her zaman mülk panelini açar; kira toplamak için binalara tek tek dokunman gerekmez.',
    },
    {
      t: 'Kat çıkmak ve komşuluk', s: `${MAXLV} kat · aynı tür komşu başına +${pct(CFG.ADJ)}`,
      art: () => svg(bld('ev', 4), 'art'),
      body: [
        `Bir binaya dokunup <b>kat çık</b>. Her bina ${MAXLV} kata kadar büyür ve her katta kirası katlanır. Tadilat sürerken bina kira üretmez.`,
        `Aynı türden binaları <b>yan yana</b> (sağ, sol, üst, alt) kur: her komşu kirayı +${pct(CFG.ADJ)} artırır. <b>Akıllı ikililer</b> de kazandırır: Kafe + Ofis ve Ev + Dükkân yan yana olunca ikisine de +${pct(CFG.PAIR)}. Mülk panelindeki şema dört komşuyu gösterir.`,
      ],
      facts: [
        ['Kira çarpanı (1→5. kat)', LV_INC.slice(1).map(x => `${String(x).replace('.', ',')}x`).join(' · ')],
        ['Tadilat bedeli', `bina bedelinin ${UP_COST.slice(1).join(' · ')} katı`],
        ['Tadilat süresi', `inşaatın ${UP_TIME.slice(1).join(' · ')} katı`],
        ['Aynı tür komşu', `komşu başına +${pct(CFG.ADJ)}`],
        ['Akıllı ikili', `Kafe+Ofis, Ev+Dükkân · +${pct(CFG.PAIR)}`],
        ['Özel yapı komşusu', `+${pct(CFG.SP_ADJ)}`],
      ],
      tip: 'Ortadaki arsalar dört komşuya dokunur; en değerli binayı ortaya koy.',
    },
    {
      t: 'İnşaat ve hızlandırma', s: `Reklamla ${dk(CFG.AD_SKIP)} kısalt · son 5 sn senin`,
      art: () => icon(I.tower || I.play),
      body: [
        'İnşaat ve tadilat süreyle ilerler. Panelden kalan süreyi görürsün.',
        `Beklemek istemezsen kısa bir reklam izle: ${dk(CFG.AD_SKIP)}’dan kısa işler <b>5 saniyeye</b> iner, bitiş anını izlersin; daha uzunsa süreden ${dk(CFG.AD_SKIP)} düşer.`,
      ],
      facts: [['Reklamla hızlandırma', `${dk(CFG.AD_SKIP)} kısalır`], ['Kısa işlerde', '5 sn kalır'], ['Tadilatta', 'kira üretilmez'], ['Yıkmak', 'iki kez dokun (onaylı)']],
    },
    {
      t: 'Semtler ve iller', s: 'Tapu, kapora, semt kuralları, engelli arsalar', isNew: true,
      art: () => icon('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M3 6.5 9 4l6 2.5L21 4v13.5L15 20l-6-2.5L3 20z"/><path d="M9 4v13.5M15 6.5V20"/></svg>'),
      body: [
        `Her ilde 5 semt var (${CITY_ORDER.map(c => CITIES[c].n).join(', ')}). Bir semtin 20 arsasını doldurunca sıradaki semtin <b>tapusunu</b> alabilirsin.`,
        `Paran tapuya yetmiyorsa <b>kapora</b> ver: tapunun %${Math.round(CFG.KAPORA * 100)}’unu öde, yeni semtin ${CFG.KAPORA_LOTS} arsası hemen açılır. Kalan borç o semtin kirasının yarısıyla kendiliğinden ödenir; bitince 20 arsanın hepsi senin. Ana ekrandaki çubuk bu semtin ne kadarının dolduğunu ve sonraki kaporaya ne kadar kaldığını gösterir.`,
        `Her semtin kendine özel bir <b>kuralı</b> var (örneğin Beşiktaş’ta kafeler +%20, Bebek’te sahil sırası +%30). Yeni semtlerde 3–4 arsa gecekondu, hurda araba ya da molozla dolu gelir: küçük bir bedelle temizle, eski eşyalardan para çıkar, nadiren tarihi bir kalıntı.`,
        `Her yeni semt kademesinde bina bedelleri ${TIER_M[1]} kat, kiralar ${String(tierRent).replace('.', ',')} kat artar. Başlangıç ilinin ilk semtini doldurunca diğer illerin ilk semtleri de satışa çıkar; her ek il tüm kiralarına kalıcı +${pct(CFG.PORTFOLIO_BONUS)} kazandırır.`,
      ],
      facts: [
        ['2. semt tapusu', fmt(TIER_FEE[1])], ['3. semt tapusu', fmt(TIER_FEE[2])], ['4. semt tapusu', fmt(TIER_FEE[3])], ['5. semt tapusu', fmt(TIER_FEE[4])],
        ['2. il · 3. il', `${fmt(CFG.EXTRA_CITY_FEE_1)} · ${fmt(CFG.EXTRA_CITY_FEE_2)}`], ['Portföy bonusu', `il başına +${pct(CFG.PORTFOLIO_BONUS)}`],
        ['Kapora', `%${Math.round(CFG.KAPORA * 100)} peşin · ${CFG.KAPORA_LOTS} arsa hemen`], ['Borç ödemesi', 'o semtin kirasının yarısı'],
      ],
      tip: 'Semtler arasında geçince, uzaktaki semtinin sen yokken ne kazandığını altta görürsün.',
    },
    {
      t: 'Semt hedefleri', s: `Her semtte 3 yıldız · 3 yıldıza +${pct(CFG.STAR_BONUS)}`, isNew: true,
      art: () => '<span class="gdstamp sm">★★★</span>',
      body: [
        'Her semtin 3 hedefi var: aynı türden binaları yan yana dizmek, bir binayı belli bir kata çıkarmak, semti doldurmak. İleri semtlerde hedefler büyür.',
        `Her hedef bir yıldız ve tapu ikramiyesi verir. 3 yıldızlı semt <b>altın mühür</b> alır ve kiraları kalıcı +${pct(CFG.STAR_BONUS)} artar. Hedefler Semtler düğmesinde, haritanın en üstünde.`,
      ],
      facts: [['Semt başına', '3 hedef'], ['Her yıldız', 'tapu ikramiyesi'], ['3 yıldız', `kalıcı +${pct(CFG.STAR_BONUS)} · altın mühür`], ['Kazanılan yıldız', 'kaybolmaz']],
      tip: 'Hedefleri baştan planla: yan yana dizilen binalar hem yıldız hem komşuluk bonusu getirir.',
    },
    {
      t: '2x gelir', s: 'Mülke özel 2x · görev ödülü: tüm mülklere 2x',
      art: () => '<span class="gdstamp">2x</span>',
      body: [
        `Bir binaya dokun, panelde <b>“İzle · bu mülke 2x”</b>e bas: kısa bir reklamla yalnızca o bina ${dk(CFG.LOT_BOOST)} boyunca iki kat kira getirir. Binanın üstünde küçük “2x” etiketi görünür.`,
        `<b>Tüm mülklere 2x</b> ise yalnızca günün 3 görevini bitirince verilir (${dk(CFG.TASK_BOOST)}). Reklamsız paket tüm kiraları kalıcı olarak 2 kat yapar.`,
      ],
      facts: [['Bu mülke 2x (reklam)', `+${dk(CFG.LOT_BOOST)} · en fazla ${dk(CFG.LOT_BOOST_MAX)}`], ['Tüm mülklere 2x', `günün 3 görevi · ${dk(CFG.TASK_BOOST)}`], ['İkisi birlikte', '4 kat kira'], ['Reklamsız paket', 'kalıcı 2x + reklamsız']],
      tip: 'Reklamı en çok kira getiren binana izlet; aynı süre orada çok daha fazla para eder.',
    },
    {
      t: 'Kira günü ve görevler', s: '7 günlük seri · her gün 3 görev',
      art: () => icon(I.cal || I.play),
      body: [
        'Her gün ilk girişte <b>kira günü</b> ödülü alırsın; seri büyüdükçe ödül artar, 7. gün büyük nakit ödül verir. 1–2 gün kaçırırsan seriyi reklamla kurtarabilirsin.',
        `Her gün 3 yeni <b>görev</b> gelir (kira topla, kat çık, bir mülke 2x ver…). Üçünü bitirince bonus ve <b>tüm mülklere 2x</b> (${dk(CFG.TASK_BOOST)}) kazanırsın; bu ödül başka hiçbir yerden verilmez.`,
      ],
      facts: [['Seri', '7 gün · sonra yeniden'], ['7. gün', 'büyük nakit ödül'], ['Görev bonusu', `tüm mülklere 2x · ${dk(CFG.TASK_BOOST)}`]],
    },
    {
      t: 'Etkinlikler ve altın taksi', s: 'Kartlar, süreli fırsatlar, taksi avı',
      art: () => '<span class="gdtaxi"></span>',
      body: [
        `Oynarken arada bir <b>etkinlik kartı</b> çıkar (metro açıldı, turist akını, vergi iadesi…). Bazıları bir sırayı ya da bina türünü bir süre güçlendirir.`,
        'Süreli <b>fırsatlar</b> üstte sayaçlı bant olarak görünür; süresi bitmeden tamamlarsan ödül alırsın. Yollarda arada <b>altın taksi</b> geçer: yakala, para kazan; şansın varsa tarihi yapı çıkar.',
      ],
      facts: [['Etkinlik kartı', `${dk(CFG.EVENT_MIN)}–${dk(CFG.EVENT_MAX)}’da bir`], ['Süreli fırsat', `${dk(CFG.OFFER_MIN)}–${dk(CFG.OFFER_MAX)}’da bir`], ['Altın taksi', 'yaklaşık 1–2 dk’da bir'], ['Taksiden tarihi yapı', '%8 şans']],
    },
    {
      t: 'Bayramlar ve mevsimler', s: `Bayram günleri kiralar +${pct(CFG.FEST_BONUS)}`, isNew: true,
      art: () => '<span class="gdstamp sm">29</span>',
      body: [
        `Yılbaşı, 23 Nisan, 19 Mayıs, 30 Ağustos ve 29 Ekim’de şehir bayramlık giyinir: haritanın üstüne bayrak zinciri gelir, kiralar +${pct(CFG.FEST_BONUS)} artar ve günde bir kez <b>bayram ikramiyesi</b> verilir.`,
        'Mevsimler de görünür: kışın kar yağar, yazın Çeşme’nin boş arsalarında plaj şemsiyeleri açılır.',
      ],
      facts: [['Bayram günleri', 'Yılbaşı · 23 Nisan · 19 Mayıs · 30 Ağustos · 29 Ekim'], ['Kira', `+${pct(CFG.FEST_BONUS)}`], ['Bayram ikramiyesi', 'günde bir (reklamla 2 katı)']],
    },
    {
      t: 'Tarihi yapılar', s: `Her biri +%5 · hepsi ek +%10`,
      art: () => svg(lmSvg(LM[0].id), 'art'),
      body: [
        `${LM.length} tarihi yapı var: ${LM.map(l => l.n).join(', ')}.`,
        'Etkinliklerden ve altın taksiden çıkarlar. Her yapı tüm kiralarını kalıcı olarak artırır; koleksiyon Holding kursan da silinmez.',
      ],
      facts: [['Yapı başına', '+%5 kalıcı'], ['Hepsini toplayana', 'ek +%10'], ['Şu an', `${S.coll.length}/${LM.length}`]],
    },
    {
      t: 'Haftanın özel tapusu', s: 'Her hafta bir nadir yapı', isNew: true,
      art: () => svg(specialSvg(weekSpecial(S.week.key).id), 'art'),
      body: [
        `Her hafta bir nadir yapı satışa çıkar: ${SPECIALS.map(x => x.n).join(', ')}. Menü → Haftanın özel tapusu. Fiyatı yaklaşık ${CFG.SP_PRICE_H} saatlik kira gelirin kadardır.`,
        `Aldığın yapı depoya girer; boş bir arsaya dokunup yerleştirirsin. Semtteki en iyi binanın 3 katı kira getirir ve dört komşusuna +${pct(CFG.SP_ADJ)} verir. Kat çıkılmaz; yıkarsan ya da Holding kurarsan depoya döner.`,
      ],
      facts: [['Sıklık', 'haftada bir'], ['Kira', 'en iyi binanın 3 katı'], ['Komşularına', `+${pct(CFG.SP_ADJ)}`], ['Holding’de', 'kaybolmaz']],
    },
    {
      t: 'Haftalık lig', s: `${GROUP_SIZE} kişilik grup · ilk 5 yükselir`,
      art: () => '<span class="gdstamp sm">LİG</span>',
      body: [
        `Her pazartesi, kazancı sana yakın ${GROUP_SIZE} emlakçıyla bir gruba girersin. Puan, o hafta topladığın kiradır.`,
        `Ligler: ${LEAGUES.map(l => l.n).join(' → ')}. Hafta sonunda ilk 5 bir üst lige çıkar (büyük tapu ikramiyesi), son 5 bir alt lige iner. Arsa Ligi'nde düşme yok; Gökdelen'de ilk 3 zirve mührü alır.`,
      ],
      facts: [['Grup', `${GROUP_SIZE} kişi`], ['Yükselen · düşen', 'ilk 5 · son 5'], ['Hafta biter', 'pazartesi 03:00 (TSİ)'], ['Gerekir', 'internet bağlantısı']],
    },
    {
      t: 'Holding', s: 'Baştan başla, kalıcı hisse çarpanı',
      art: () => icon(I.crown || I.tower),
      body: [
        'Bir ilin 5. semtini alınca <b>Holding</b> kurabilirsin: semtlerin ve kasan sıfırlanır, ama bu turdaki kazancına göre <b>hisse</b> alırsın.',
        'Her hisse tüm kiralarını kalıcı +%10 artırır; ikinci turda çok daha hızlı büyürsün. Koleksiyon, lig ve reklamsız paket korunur.',
      ],
      facts: [['Hisse', `√(tur kazancı ÷ ${fmt(CFG.SHARE_BASE)})`], ['Hisse başına', '+%10 kalıcı'], ['Korunanlar', 'hisseler, tarihi yapılar, lig'], ['Sıfırlananlar', 'kasa, semtler, binalar']],
    },
    {
      t: 'Sen yokken', s: `${pct(CFG.OFFLINE_RATE)} verim · en fazla ${dk(CFG.OFFLINE_MAX)} · 3x seçeneği`,
      art: () => icon(I.moon || I.play),
      body: [
        `Oyundan çıktığında da kiraların ${pct(CFG.OFFLINE_RATE)} verimle işler. Döndüğünde biriken tutarı alırsın; istersen reklam izleyip 3 katını alabilirsin.`,
        'Görev ödülü “tüm mülklere 2x” süresi yokken de geçerlidir.',
      ],
      facts: [['Verim', pct(CFG.OFFLINE_RATE)], ['En fazla', dk(CFG.OFFLINE_MAX)], ['Reklamla', '3 katı'], ['Bildirim', 'kasa dolunca haber verir']],
    },
    {
      t: 'Hesap ve kayıt', s: 'Bulut yedeği · Google/Apple ile bağla',
      art: () => icon(I.users),
      body: [
        'İlerlemen bu cihazda saklanır ve internet varken buluta yedeklenir. Telefon değiştirirsen ilerlemen kaybolmasın diye Ayarlar’dan <b>Google ya da Apple ile bağla</b>.',
        'Ayarlar’dan bildirimleri, sesi ve reklam izinlerini yönetebilir; hesabını ve tüm verilerini silebilirsin.',
      ],
      facts: [['Bulut yedeği', `${dk(CFG.CLOUD_SAVE_MS)}’da bir + çıkarken`], ['Hesap bağlama', 'Ayarlar → Hesap'], ['Veri silme', 'Ayarlar → Hesabımı sil']],
    },
  ];
}
