# Tapu: şantiyeden plazaya emlak oyunu (mobil)

Tıklama bazlı, sade bir emlak oyunu. İstanbul, İzmir ve Ankara semtlerinde arsalara bina dikip kira toplarsın.
Oyun bilerek yavaş ilerler; ödüllü reklamlar oyuncuya hız kazandırır.

**Teknoloji:** Vite + TypeScript, Capacitor 8 (Android/iOS), Firebase (Auth, Firestore, Functions, Analytics, Crashlytics, Remote Config), AdMob (UMP onayı, iOS ATT, SSV), RevenueCat.
Yayına çıkış adımları: [`docs/RELEASE.md`](docs/RELEASE.md). Gizlilik metni taslağı: [`docs/privacy-policy.md`](docs/privacy-policy.md).

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
| `tests/economy_sim.py` | Ekonomi simülasyonu |

Servis ayarı yoksa (`.env` boş) oyun tamamen yerel çalışır; Firebase kodu hiç indirilmez.

## Çekirdek döngü
Arsaya dokun → inşaat (betonarme karkas kat kat yükselir) → kira birikir → dokunarak ya da parmağını gezdirerek topla → kat ekle → semti doldur → sonraki semtin tapusunu al.

| Mekanik | Değer |
|---|---|
| Binalar | Ev, Kafe, Dükkân, Ofis (toplam kazanca göre açılır) |
| Seviye | 1-5, her seviye bir kat (ofiste iki kat); tadilattaki bina kira üretmez |
| Kira kumbarası | Etkin kira hızıyla 90 sn'de dolar, sonra birikmez |
| Komşuluk | Aynı tür komşu başına +%20; bahçe/teras/kaldırım birleşerek gösterilir |
| İller ve semtler | İstanbul: Kadıköy → Beşiktaş → Şişli → Nişantaşı → Bebek · İzmir: Karşıyaka → Bornova → Alsancak → Göztepe → Çeşme · Ankara: Bahçelievler → Kızılay → Çankaya → Ümitköy → İncek |
| Başlangıç ili | İlk açılışta oyuncu seçer |
| Başka ilden arsa | Başlangıç ilinin ilk semti dolunca diğer illerin ilk semti satışa çıkar (2. il 60B, 3. il 600B). Her ek il tüm kiralara kalıcı +%10 (portföy bonusu). İller arası geçiş harita panelinden. |
| Etkinlik kartı | 2,5-4,5 dk'da bir (metro, turist akını, vergi iadesi, indirim…) |
| Yokken kazanç | %30 verim, en fazla 3 saat; yokken geçen 2x süresi de sayılır |

Simülasyona göre aktif oynayan biri reklamsız Kafe'yi ~5, Dükkân'ı ~13. dakikada açar, Beşiktaş'ı ~35. dakikada alır. Sürekli 2x ile Beşiktaş ~23. dakikaya iner.

## Geri getiren ve büyüten sistemler
| Sistem | Nasıl çalışır | Uygulamada bağlanacak servis |
|---|---|---|
| Kira günü serisi | Her gün ilk girişte ödül, 7. gün büyük ödül + 1 saat 2x. 1-2 gün kaçırana reklamla seriyi kurtarma. | – |
| Bildirimler | Çıkarken planlanır: en yakın inşaat bitişi, kasa doldu (3 sa), ertesi gün 12:00 kira günü. Ayarlardan kapatılabilir. | `@capacitor/local-notifications` |
| Günlük görevler | Her gün 3 rastgele görev (kira topla, bina kur, kat çık, reklam izle, kazan, taksi, etkinlik); üçü bitince bonus + 30 dk 2x. | – |
| Süreli fırsat | 6-9 dk'da bir teklif (Kentsel dönüşüm, Kira maratonu, Hızlı müteahhit, Altın taksi avı); üstte sayaçlı bant. | – |
| Altın taksi | 70-130 sn'de bir yollardan geçer, dokununca para ve %8 ihtimalle tarihi yapı. Yollarda araçlar ve yayalar dolaşır. | – |
| Koleksiyon | 10 tarihi yapı (İstanbul 6, İzmir: Saat Kulesi/Konak, Asansör · Ankara: Atakule, Kale); her biri +%5, tamamı ek +%10. | – |
| Semte özel mimari | Ev: kırma çatı, tuğla apartman, rezidans, taş apartman (mansart), yalı (cumba), Ege taş evi (Çeşme). | – |
| Holding (prestij) | Herhangi bir ilin 5. semtinden sonra sıfırla (başlangıç ili korunur); hisse = √(tur kazancı / 1e8), her hisse +%10 kalıcı kira. | – |
| Şehrini paylaş | 1080×1920 story görseli (şehir + kasa + davet kodu); paylaş ya da kaydet. | `@capacitor/share` + `@capacitor/filesystem` |
| Davet kodu | Arkadaşın kodunu girene 2 saat 2x + para; davet edene her katılan için 2 saat 2x. Kod tekilliği ve tek kullanım sunucuda. | Cloud Functions `hello`, `redeemInvite` |
| Haftalık sıralama | İlk 25 + kendi sıran. İstemci yazamaz; skor sunucuda zamana göre sınırlanır. | Firestore `lb` + `submitScore` |
| Reklamsız paket | Geçiş reklamı yok, ödüller izlemeden, kalıcı 2x. Yetki RevenueCat'ten okunur (makbuz sunucuda doğrulanır). | RevenueCat |

## Reklam stratejisi
| Tür | Ne zaman | Ödül |
|---|---|---|
| Geçiş (interstitial) | 15-20 dk aktif ekran süresinde bir. Ödüllü reklamdan sonra en az 5 dk, bir kart kapandıktan sonra en az 60 sn ertelenir. Panel/kart açıkken çıkmaz. | – |
| Ödüllü: 2x gelir | Alttaki mühür şeklindeki 2x düğmesi (halka kalan süreyi gösterir) | Reklam başı +30 dk, en fazla 4 saat birikir |
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
