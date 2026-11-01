# Tapu: şantiyeden plazaya emlak oyunu (mobil)

Tıklama bazlı, sade bir emlak oyunu. İstanbul, İzmir ve Ankara semtlerinde arsalara bina dikip kira toplarsın.
Oyun bilerek yavaş ilerler; ödüllü reklamlar oyuncuya hız kazandırır.

**Teknoloji:** Vite + TypeScript, Capacitor 8 (Android/iOS), Firebase (Auth, Firestore, Functions, Analytics, Crashlytics, Remote Config), AdMob (UMP onayı, iOS ATT, SSV), RevenueCat.
Yayına çıkış adımları: [`docs/RELEASE.md`](docs/RELEASE.md). Gizlilik metni taslağı: [`docs/privacy-policy.md`](docs/privacy-policy.md).

## Hemen dene
| | Bağlantı |
|---|---|
| Web (her cihaz, tarayıcıda; ana ekrana eklenince uygulama gibi açılır, internetsiz çalışır) | https://ceomai.github.io/Tycoon/ |
| Android test APK'sı (her güncellemede yenilenir) | https://github.com/Ceomai/tycoon/releases/latest/download/tapu-test.apk |

İkisi de `main` dalına her gönderimde GitHub Actions ile otomatik yenilenir (`.github/workflows/`).
Test APK'sında Google'ın test reklamları çıkar; Firebase ayarı eklenmediyse bulut kaydı ve sıralama kapalıdır, oyun telefonda çalışır.

## Klasörler
| Yol | İçerik |
|---|---|
| `src/config.ts` | Denge değerleri (CFG), binalar, iller/semtler. Remote Config aynı anahtarlarla bunları ezer. |
| `src/state.ts` | Kayıt şeması (v2), yeni oyun, eski kayıt taşıma (v1 → v2) |
| `src/economy.ts` | Kira, maliyet, süre, komşuluk, semt/il açılışı, güvenli oyun saati |
| `src/storage.ts` | Kalıcı kayıt: telefonda Preferences, sağlamalı (checksum) + yedek |
| `src/time.ts` | Sunucu saati farkı, saat geri alma koruması |
| `src/draw.ts`, `src/landmarks.ts` | Bina ve tarihi yapı çizimleri (SVG) |
| `src/ui/` | Ana ekran (pafta), paneller, kartlar |
| `src/game/` | Oyun döngüsü (4 Hz), eylemler, görevler, günlük ödül, fırsatlar, etkinlikler, koleksiyon, paylaşım, davet |
| `src/services/` | `cloud.ts` (tek arayüz) → `firebase.ts` (uygulama) / `artifactCloud.ts` (önizleme); `ads.ts`, `purchases.ts`, `notify.ts`, `analytics.ts`, `remote.ts` |
| `functions/` | Cloud Functions: `hello`, `redeemInvite`, `submitScore`, `deleteAccount`, `admobSsv`, `revenuecatWebhook` |
| `firestore.rules`, `firestore.indexes.json`, `firebase.json` | Güvenlik kuralları ve sıralama dizini |
| `tests/unit/` | Birim testleri (vitest): biçimleme, kayıt taşıma, saat hilesi, il açılışı, portföy bonusu |
| `tests/qa.cjs` | Uçtan uca test (Playwright, sahte saat): 75 kontrol, 5 ekran boyutu |
| `scripts/sim.ts` | Ekonomi simülasyonu (oyunun gerçek ekonomi koduyla; `npm run sim`, ayar denemesi için `SIM_TIER_M`, `SIM_TIER_INC`, `SIM_TIER_FEE`) |

Servis ayarı yoksa (`.env` boş) oyun tamamen yerel çalışır; Firebase kodu hiç indirilmez.

## Çekirdek döngü
Arsaya dokun → inşaat (betonarme karkas kat kat yükselir) → kira birikir → dokunarak ya da parmağını gezdirerek topla → kat ekle → semti doldur → sonraki semtin tapusunu al.

| Mekanik | Değer |
|---|---|
| Binalar | Ev, Kafe, Dükkân, Ofis (toplam kazanca göre açılır) |
| Seviye | 1-5, her seviye bir kat (ofiste iki kat); tadilattaki bina kira üretmez |
| Kira kumbarası | Etkin kira hızıyla 90 sn'de dolar, sonra birikmez. Ortadaki **TOPLA** mührü bütün semtlerdeki kirayı tek seferde toplar; Ayarlar'dan **Otomatik** seçilirse oyun açıkken kira kendiliğinden kasaya akar. Binaya dokunmak her zaman mülk panelini açar. |
| Komşuluk | Aynı tür komşu başına +%20; bahçe/teras/kaldırım birleşerek gösterilir |
| İller ve semtler | İstanbul: Kadıköy → Beşiktaş → Şişli → Nişantaşı → Bebek · İzmir: Karşıyaka → Bornova → Alsancak → Göztepe → Çeşme · Ankara: Bahçelievler → Kızılay → Çankaya → Ümitköy → İncek |
| Başlangıç ili | İlk açılışta oyuncu seçer |
| Başka ilden arsa | Başlangıç ilinin ilk semti dolunca diğer illerin ilk semti satışa çıkar (2. il 60B, 3. il 600B). Her ek il tüm kiralara kalıcı +%10 (portföy bonusu). İller arası geçiş harita panelinden. |
| Etkinlik kartı | 2,5-4,5 dk'da bir (metro, turist akını, vergi iadesi, indirim…) |
| Yokken kazanç | %30 verim, en fazla 3 saat; görev ödülü "tüm mülklere 2x" süresi yokken de sayılır |

Simülasyona göre (`npm run sim`, aktif oyuncu, reklamsız) İstanbul'un semtleri 18 / 12 / 27 / 34 / 27 dk'da dolar; tapu beklemesi 4 / 6 / 7 / 13 dk. Denge: kademe çarpanı ×10, yeni semtte kira artışı 0,6, tapu ₺80B / ₺1Mn / ₺12Mn / ₺150Mn.

## Geri getiren ve büyüten sistemler
| Sistem | Nasıl çalışır | Uygulamada bağlanacak servis |
|---|---|---|
| Kira günü serisi | Her gün ilk girişte ödül, 7. gün büyük nakit ödül. 1-2 gün kaçırana reklamla seriyi kurtarma. | – |
| Bildirimler | Çıkarken planlanır: en yakın inşaat bitişi, kasa doldu (3 sa), ertesi gün 12:00 kira günü. Ayarlardan kapatılabilir. | `@capacitor/local-notifications` |
| Günlük görevler | Her gün 3 rastgele görev (kira topla, bina kur, kat çık, bir mülke 2x ver, reklam izle, kazan, taksi, etkinlik); üçü bitince bonus + **tüm mülklere 2x · 1 saat** (bu ödülün tek kaynağı). | – |
| Süreli fırsat | 6-9 dk'da bir teklif (Kentsel dönüşüm, Kira maratonu, Hızlı müteahhit, Altın taksi avı); üstte sayaçlı bant. | – |
| Altın taksi | 70-130 sn'de bir yollardan geçer, dokununca para ve %8 ihtimalle tarihi yapı. Yollarda araçlar ve yayalar dolaşır. | – |
| Koleksiyon | 10 tarihi yapı (İstanbul 6, İzmir: Saat Kulesi/Konak, Asansör · Ankara: Atakule, Kale); her biri +%5, tamamı ek +%10. | – |
| Semte özel mimari | Ev: kırma çatı, tuğla apartman, rezidans, taş apartman (mansart), yalı (cumba), Ege taş evi (Çeşme). | – |
| Holding (prestij) | Herhangi bir ilin 5. semtinden sonra sıfırla (başlangıç ili korunur); hisse = √(tur kazancı / 1e8), her hisse +%10 kalıcı kira. | – |
| Şehrini paylaş | 1080×1920 story görseli (şehir + kasa + davet kodu); paylaş ya da kaydet. | `@capacitor/share` + `@capacitor/filesystem` |
| Davet kodu | Arkadaşın kodunu girene ve davet edene (her katılan için) nakit tapu hediyesi. Kod tekilliği ve tek kullanım sunucuda. | Cloud Functions `hello`, `redeemInvite` |
| Semt ilerlemesi | Ana ekranda bu semtin yüzdesi ("bitirmeye N arsa kaldı"); altta gri yazıyla sonraki semtin kaporasına ne kadar kaldığı. Para sen yokken birikince bildirim. | – |
| Kapora | Tapunun %30'u peşin: yeni semtin 4 arsası hemen açılır; kalan borç o semtin kirasının yarısıyla (sen yokken de) ödenir, bitince 20 arsa açılır; istenirse kasadan kapatılır. | – |
| İl kartpostalı ve semt kuralları | Yeni semtte il kartpostalı ve semtin kuralı (ör. Beşiktaş kafeler +%20, Bebek sahil sırası +%30, Bornova inşaatlar %25 hızlı, Ümitköy tadilat %20 ucuz). | – |
| Engelli arsalar | Yeni semtte 3–4 arsa gecekondu / hurda / moloz / yıkık duvar; küçük bedelle temizlenir, bedelden fazlası geri döner, nadiren tarihi yapı çıkar. | – |
| Semt özeti | Semte dönünce "Kadıköy sen Beşiktaş'tayken ₺… kazandı" şeridi. | – |
| TOPLA anı | Binalardan mühre para uçar, kasa sayarak yükselir, "+₺… ↑" göstergesi; kumbaralar doluyken "DOLU KASA!" mührü. | – |
| Haftalık piyasa raporu | Her pazartesi bir tür +%30, bir tür −%10 (herkes için aynı); kira göstergesinde işaret. | – |
| Gece ve gündüz | 19:00–06:00 gece görünümü, pencereler yanar, sokaklar sakin; Ayarlar'dan kapatılabilir. | – |
| Tapu arşivi | 26 mühürlük albüm; her 4 mühür kiraya kalıcı +%1, 8 ve 16 mühürde yeni cephe renkleri. | – |
| Belediye kararları | Semtte iki seçenekli kalıcı yatırım (park/otopark, metro/bisiklet yolu): ilgili türe +%15; semt başına en fazla 2. | – |
| Cephe | Bina başına cephe rengi (9), çatı (3), tabela; yalnızca görünüm. | – |
| Tapu sezonu | Aylık 30 basamak; puan: kira, görev, inşaat, yıldız, lig. Ücretsiz yol (nakit, 2x jetonu, renk) ve Altın Tapu (₺99,99, RevenueCat ürünü `tapu_sezon`). | RevenueCat |
| Tapu teslim anı | İnşaatın son 5 saniyesinde geri sayım; bitince binaya "TESLİM" mührü vurulur. Reklamla hızlandırma son 5 saniyeyi bırakır. | – |
| Semt hedefleri | Her semtte 3 hedef (yan yana dizme, kat çıkma, semti doldurma); her yıldız ikramiye, 3 yıldız kalıcı +%10 ve altın mühür. | – |
| Karma komşuluk | Aynı tür komşu +%20; akıllı ikililer Kafe+Ofis ve Ev+Dükkân +%10; mülk panelinde dört komşunun şeması. | – |
| Bayramlar ve mevsimler | Yılbaşı, 23 Nisan, 19 Mayıs, 30 Ağustos, 29 Ekim: kiralar +%20, bayrak zinciri, günde bir bayram ikramiyesi. Kışın kar, yazın Çeşme'de plaj şemsiyeleri. Tarih girişi gerektirmez. | – |
| Haftanın özel tapusu | Her hafta bir nadir yapı (Han, Pasaj, Yalı Köşkü, Bahçeli Köşk), ~2 saatlik kira geliri fiyatında; semtteki en iyi binanın 3 katı kira, komşularına +%15; depoya girer, yıkınca/Holding'de kaybolmaz. | – |
| Rıfkı Abi | Klasik, hafif esprili emlakçı; en fazla 3 dakikada bir duruma göre tek satırlık ipucu (kumbara doldu, akıllı ikili, yıldıza az kaldı, özel tapu…). Ayarlar'dan kapatılabilir. | – |
| Haftalık lig | Arsa → Kat → Apartman → Plaza → Gökdelen. Her pazartesi benzer kazançtaki 30 oyuncuyla grup; ilk 5 yükselir (büyük tapu ikramiyesi), son 5 düşer; Gökdelen'de ilk 3 zirve mührü. Sonuç yeni haftanın ilk girişinde gelir. İstemci yazamaz; skor sunucuda zamana göre sınırlanır. | Firestore `lb`, `groups` + `submitScore`, `hello` (`functions/src/league.ts`) |
| Reklamsız paket | Geçiş reklamı yok, ödüller izlemeden, kalıcı 2x. Yetki RevenueCat'ten okunur (makbuz sunucuda doğrulanır). | RevenueCat |

## Reklam stratejisi
| Tür | Ne zaman | Ödül |
|---|---|---|
| Geçiş (interstitial) | 15-20 dk aktif ekran süresinde bir. Ödüllü reklamdan sonra en az 5 dk, bir kart kapandıktan sonra en az 60 sn ertelenir. Panel/kart açıkken çıkmaz. | – |
| Ödüllü: mülke 2x | Mülk paneli ("İzle · bu mülke 2x") | Yalnızca o bina: reklam başı +1 saat, en fazla 4 saat birikir |
| Ödüllü: inşaat hızlandırma | İnşaat paneli | 30 dk'ya kadar anında bitirir, daha uzunsa 30 dk düşer |
| Ödüllü: yokken kazanç 3x | Oyuna dönüş kartı | Kazancın 3 katı |
| Ödüllü: etkinlik 2x | Etkinlik kartı | Ödül/süre 2 katı |

## Komutlar
```bash
npm install --legacy-peer-deps
cp .env.example .env      # anahtarları doldur
npm run dev               # tarayıcıda geliştirme
npm test                  # typecheck + birim + uçtan uca
npm run build:preview     # tek dosyalık önizleme (dist-preview/tapu.html)
npx cap add android && npx cap add ios
npm run android           # derle, eşitle, Android Studio'yu aç
npm run ios
```
