# Tapu: Tam Uygulama Denetimi

**Tarih:** 2026-11-01/02
**Dal:** `denetim`, `main`'e birleştirildi
**Kapsam:** istemci (Vite + TS + Capacitor 8), yerel kayıt, Firestore kuralları, Cloud Functions kaynağı, bağımlılıklar, CI.

Ayrıntılı raporlar: [TEST_COVERAGE](TEST_COVERAGE.md) · [BUGS_AND_FIXES](BUGS_AND_FIXES.md) · [PERFORMANCE_REPORT](PERFORMANCE_REPORT.md) · [SECURITY_REPORT](SECURITY_REPORT.md)

## 1. Sağlık puanı: **80 / 100**

| Boyut | Puan | Gerekçe |
|---|---|---|
| İşlevsellik | 24 / 25 | 348 kontrolün tamamı geçti; yerel eklentiler ve IAP sınanamadı. |
| Sağlamlık / veri bütünlüğü | 18 / 20 | Bozuk kayıt çökmesi düzeltildi, fuzz testinde 0 çökme. Kalan: iki sekmede son yazan kazanır. |
| Güvenlik | 14 / 20 | Üretim bağımlılık açığı 0, kurallar sıkı. Kalan: App Check yok, araç zincirinde açıklar, CSP yok. |
| Performans | 14 / 15 | FCP 132 ms (4x yavaş CPU'da 556 ms), kararlı durumda uzun görev yok, sızıntı yok. Gerçek cihazda ölçülmedi. |
| Arayüz / erişilebilirlik | 8 / 10 | 13 ekran boyutu × 2 temada taşma yok. Küçük ekranda dokunma alanı 40–43px. |
| Sunucu / yayın hazırlığı | 2 / 10 | Fonksiyonlar yayında değil (lig, davet, hesap silme), IAP ürünleri yok, gerçek cihaz testi yok. |

## 2. Test özeti

| | Sayı |
|---|---|
| Toplam çalıştırılan kontrol | **348** (48 birim + 189 e2e oyun + 111 e2e denetim) |
| Geçti | **348** |
| Kaldı | **0** (son koşu; ilk koşuda 7 birim ve 12 e2e hata bulundu, hepsi düzeltildi) |
| Engellendi / çalıştırılamadı | **11 alan** (bkz. bölüm 9) |
| Persona yolculuğu | 23 |
| Ekran boyutu × tema | 13 × 2 = 26 |
| Fuzz edilen bozuk kayıt | 400 + alan başına null ve 4 yanlış tür |

## 3. Özellik envanteri

Oyun:

- il seçimi ve kartpostal
- 3 il × 5 semt
- 4 bina türü × 5 kat; inşaat, tadilat, yıkım
- TOPLA mührü / OTO toplama
- reklamla hızlandırma, mülke 2x, 2x jetonu
- semt tapusu, kapora ve borç
- engelli arsalar
- özel tapu ve depo
- semt kuralları, komşuluk ve akıllı ikili
- semt hedefleri (yıldız)
- piyasa raporu, belediye kararları, tapu arşivi, cephe ve çatı, tapu sezonu
- bayram ve mevsim, gece görünümü
- Rıfkı Abi ipuçları, kılavuz (20 bölüm)
- günlük ödül, görevler, süreli fırsatlar, altın taksi
- holding (prestij) ve koleksiyon
- paylaşım görseli, davet kodu, haftalık lig

Altyapı:

- kayıt: yedek, sağlama, taşıma, temizleyici
- saat hilesi koruması, çevrimdışı kazanç
- bulut kaydı, analitik, Crashlytics
- AdMob, RevenueCat, bildirimler
- PWA / service worker

Her özelliğin kapsam durumu [TEST_COVERAGE.md](TEST_COVERAGE.md) dosyasında.

## 4. Önem derecesine göre bulgular

| Önem | Bulunan | Düzeltilen | Açık |
|---|---|---|---|
| Kritik | 0 | 0 | 0 |
| Yüksek | 2 (B1 kayıt çökmesi, S1 grpc-js) | 2 | 1 yayın engeli: U1, fonksiyonlar yayında değil (kod hatası değil, altyapı) |
| Orta | 3 (B2, B3, B5) | 3 | 2 (U2 App Check, U3 IAP ürünleri) |
| Düşük | 5 (B4, B6, B7, S2, S3) | 5 | 2 (U4 dokunma alanı, U5 iki sekme) |
| Bilgi | — | — | 3 (U6 araç zinciri açıkları, U7 functions bağımlılığı, U8 CSP) |

## 5. Düzeltilenler (özet)

- **B1:** bozuk ya da değiştirilmiş kayıt açılışta çöküyordu. Tür doğrulamalı `sanitize()` eklendi.
- **B2, B3, B4:** bilinmeyen engel türü, 20'den uzun arsa dizisi, `__proto__` semt anahtarı.
- **B5:** yönlendirme balonu 390px'te 4px yatay kaydırma yaratıyor, 320px'te kesiliyordu.
- **B6, B7:** `NaN sn`; kayıttan gelen fırsat başlığı kaçırılmıyordu.
- **S1:** üretim bağımlılığında 2 yüksek açık (grpc-js) giderildi.
- **S2, S3:** webhook için sabit zamanlı karşılaştırma; SSV işlem kimliği doğrulaması.
- Oyun kuralları ve dengesi **değiştirilmedi**; temizleyici yalnızca geçersiz değerleri varsayılana döndürüyor.

## 6. Bulgular: güvenlik, performans, veritabanı, arayüz

- **Güvenlik:** Firestore kuralları sahip temelli ve alan beyaz listeli. Sıralama yazımı yalnızca sunucuda. Fonksiyonlarda yetki denetimi doğru. App Check eksik. Depoda gizli bilgi yok.
- **Performans:**
  - FCP 132 ms; 4x yavaş CPU'da 556 ms.
  - 300 binada betik yükü %7, kararlı durumda 0 uzun görev.
  - 2 saatte yığın 2,2 → 3,2 MB.
  - Oyun paketi gzip 71,8 kB.
- **Veritabanı ve kayıt:**
  - En büyük kayıt 33,4 KB (sınır 950 KB).
  - Yedekli ve sağlamalı yazma; depolama dolu olsa da oyun sürüyor.
  - Sunucu `lb` değerlerini istemciden bağımsız sınırlıyor.
- **Arayüz ve erişilebilirlik:**
  - 280–1280px arası 13 boyutta ve gece/gündüz temasında taşma yok.
  - 20/20 arsada ekran okuyucu etiketi var, görünür düğmelerin hepsinin adı var.
  - Hareket azaltma tercihi destekleniyor.
  - ≤360px'te arsa genişliği 40–43px.

## 7. Cihaz uyumluluğu

| Ortam | Durum |
|---|---|
| Chromium mobil emülasyonu (280×653 … 430×932, 1x/2x/3x DPR, dokunmatik) | ✓ sınandı |
| Tablet dikey ve yatay (600×960, 768×1024, 820×1180, 1024×768) ve masaüstü 1280×800 | ✓ sınandı |
| Sistem karanlık tema, hareket azaltma | ✓ sınandı |
| Gerçek Android (WebView) | ✗. Önceki geri bildirim: Android'deki tıklama sorunu düzeltilmişti, yeniden doğrulanmalı. |
| Gerçek iOS (WKWebView) | ✗. Kullanıcı daha önce iPhone'da akıcı olduğunu bildirdi. |
| Safari / WebKit | ✗ (ortamda yok) |

## 8. Otomasyon altyapısı (bu denetimde eklendi)

- `tests/unit/audit.test.ts`: kenar durumlar, fuzz, tarih/saat dilimi, ekonomi değişmezleri (22 test).
- `tests/unit/perf.test.ts`: ekonomi sıcak yol ölçümü.
- `tests/audit.cjs` + `npm run test:audit`: 23 persona, kenar durumlar, 26 ekran/tema, performans ve stres; ölçümleri JSON'a yazar.
- `package.json` › `overrides`: grpc-js güvenlik yaması.

## 9. Test edilemeyen alanlar

1. gerçek cihazlar
2. iOS WebKit
3. Cloud Functions (yayında değil)
4. Firestore kuralları emülatörde
5. AdMob, UMP, ATT
6. RevenueCat
7. yerel bildirim, paylaşım, titreşim
8. Google girişi
9. bulut çakışması
10. sunucu yük testi (k6)
11. elle ekran okuyucu testi

Nedenleri [TEST_COVERAGE.md](TEST_COVERAGE.md) dosyasında.

## 10. Sonraki adımlar

1. **Blaze planı + IAM rolleri → fonksiyonları yayına al** (lig, davet, hesap silme). Google Play için hesap silme zorunlu.
2. `firebase-admin@14` yükseltmesi ve `enforceAppCheck`.
3. Play Console'da `tapu_premium` ve `tapu_sezon` ürünleri + RevenueCat eşlemesi.
4. `GOOGLE_SERVICES_JSON` sırrı + SHA-1/256 → Google girişi ve Crashlytics.
5. En az 1 düşük seviye Android (Android 10, 3 GB RAM) ve 1 iPhone üzerinde elle duman testi: dokunma, geri tuşu, bildirim, reklam.
6. Küçük ekran dokunma alanı (U4) için tasarım önerisi.
7. CSP meta etiketi ve iki sekme uyarısı.
8. CI'a `npm run test:audit` ve Firestore kural emülatör testi.

## 11. Yayına hazırlık değerlendirmesi

**İstemci kodu: hazır.** Bilinen kritik ya da yüksek kod hatası kalmadı. Otomatik testlerin hepsi geçiyor, performans düşük seviye cihaz yaklaşımında da rahat.

**Uygulama bütünü: henüz mağazaya hazır değil.** Engelleyen kalemler kod dışı:

- sunucu fonksiyonları yayında değil (hesap silme zorunluluğu dahil)
- IAP ürünleri tanımlı değil
- gerçek cihaz testi yapılmadı

Bunlar tamamlanınca kapalı test (internal testing) kanalına çıkılabilir.

## 12. Denetim kontrol listesi

- [x] Keşif ve mimari inceleme
- [x] Mevcut testler (tsc, vitest, e2e) çalıştırıldı
- [x] npm audit (istemci, araçlar, functions)
- [x] Birim kenar durum ve fuzz testleri
- [x] 23 persona yolculuğu
- [x] Tarih, saat dilimi, yaz saati, artık yıl
- [x] Hızlı tıklama, yeniden başlatma, kalıcılık, çevrimdışı, depolama hatası, iki sekme
- [x] 13 ekran boyutu × gece/gündüz
- [x] Erişilebilirlik (etiketler, hareket azaltma)
- [x] Açılış, çalışma anı, uzun seans, stres, kayıt boyutu ölçümleri
- [x] Kural, fonksiyon, gizli bilgi ve XSS incelemesi
- [x] Hataların düzeltilmesi ve regresyon (348/348)
- [ ] Gerçek cihaz (ortamda yok)
- [ ] Sunucu entegrasyonu (yayında değil)
