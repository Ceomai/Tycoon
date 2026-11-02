# Test Kapsamı

Bütün sayılar bu oturumda gerçekten çalıştırılan testlerden alındı (2026-11-01, son koşu). Kod satırı kapsamı (%) **ölçülmedi**; bu yüzden yüzde verilmedi.

## Test paketleri

| Paket | Komut | Araç | Kontrol | Geçti | Kaldı | Süre |
|---|---|---|---|---|---|---|
| Tür denetimi (istemci) | `npm run typecheck` | tsc strict | tüm `src/` | ✓ | 0 | 3,5 sn |
| Tür denetimi (sunucu) | `cd functions && npx tsc --noEmit` | tsc | `functions/src` | ✓ | 0 | — |
| Birim: çekirdek | `npx vitest run` | Vitest 4.1.12 | 25 | 25 | 0 | |
| Birim: denetim (yeni) | 〃 `tests/unit/audit.test.ts` | Vitest | 22 | 22 | 0 | |
| Birim: performans (yeni) | 〃 `tests/unit/perf.test.ts` | Vitest | 1 | 1 | 0 | |
| **Birim toplam** | | | **48** | **48** | **0** | ~1,5 sn |
| E2E: oyun akışı | `npm run test:e2e` | Playwright + Chromium, sahte saat | 189 | 189 | 0 | ~4 dk |
| E2E: denetim (yeni) | `npm run test:audit` | Playwright + Chromium, mobil emülasyon | 111 | 111 | 0 | 301 sn |
| Ekonomi simülasyonu | `npm run sim` | gerçek ekonomi kodu | 5 semt | ✓ | — | <1 sn |
| Bağımlılık taraması | `npm audit --omit=dev` | npm | — | 0 açık | — | |
| **Genel toplam** | | | **348** | **348** | **0** | |

Engellenen (çalıştırılamayan) testler: 11 alan. Ayrıntısı aşağıda, "Test edilemeyen alanlar" bölümünde.

## Özellik envanteri ve kapsam

✓ = otomatik testle sınandı · ◐ = kısmen · ✗ = sınanamadı

| Özellik | Birim | E2E | Persona | Not |
|---|---|---|---|---|
| İl seçimi, kartpostal, ilk semt | | ✓ | P01, P02 | |
| İnşaat, tadilat, yıkım (iki adımlı onay) | | ✓ | P01, P13 | |
| TOPLA mührü / OTO toplama | | ✓ | P05, P06 | 120 hızlı dokunuş, çift toplama yok |
| Reklamla hızlandırma (5 sn kalır), mülke 2x, 4 sa tavan | | ✓ | | önizleme reklamı; gerçek AdMob ✗ |
| Geçiş reklamı sıklığı | | ✓ | P20 | 45 dk'da 2–3, 2 saatte 6 |
| Etkinlik, fırsat, günlük kartlar | | ✓ | P20 | 2 saatte 51 kart |
| Semt tapusu, kapora, borç ödeme | ✓ | ✓ | P09, P10 | |
| Engelli arsalar, temizleme | ✓ | ✓ | P11 | |
| Özel tapu, depo, yerleştirme | ✓ | ✓ | P12 | |
| Semt kuralları, komşuluk, akıllı ikili | ✓ | | | |
| Semt hedefleri (yıldız) | ✓ | ✓ | | |
| Piyasa raporu, belediye, arşiv, cephe, sezon | ✓ | ✓ | | sezon satın alma (IAP) ✗ |
| Bayram ve mevsim | ✓ | ✓ | E1 | sabit tarihler |
| Lig ve sıralama (istemci) | ✓ | ✓ | P17 (çevrimdışı) | sunucu tarafı ✗ (yayında değil) |
| Davet kodu (doğrulama, girdi) | | ✓ | E2, P17 | sunucu ✗ |
| Ayarlar (ses, gece, Rıfkı, bildirim, toplama modu) ve kalıcılık | | ✓ | P07 | |
| Kılavuz (20 bölüm, ileri/geri sınırları) | | ✓ | P23 | |
| Kayıt: yazma, yedek, sağlama, v1→v2 taşıma | ✓ | ✓ | P03, P07 | |
| Kayıt: bozuk / kötü niyetli veri | ✓ (fuzz 400) | ✓ | P16 | B1–B4 düzeltildi |
| Saat hilesi koruması | ✓ | ✓ | P04 | |
| Çevrimdışı kazanç | | ✓ | P03 | |
| Çevrimdışı ağ | | ✓ | P17 | |
| Depolama dolu / kapalı | | ✓ | P18 | |
| Geri tuşu / Escape | | ✓ | P22 | Android donanım geri tuşu ✗ (gerçek cihaz) |
| Erişilebilirlik: etiketler, hareket azaltma | | ✓ | P21 | ekran okuyucuyla elle test ✗ |
| Ekran boyutları × gece/gündüz | | ✓ | 13 boyut × 2 tema | |
| Bulut kaydı, Google girişi | | ◐ | | önceki oturumda canlı kurallar sınandı; bu oturumda üretim verisine dokunulmadı |
| Bildirimler, paylaşım, titreşim (yerel eklentiler) | | ✗ | | gerçek cihaz gerekli |
| Satın alma / geri yükleme (RevenueCat) | | ✗ | | mağaza ürünleri yok |

## Persona yolculukları (23 persona, hepsi geçti)

P01 yeni oyuncu (İzmir) · P02 Ankara · P03 3 gün sonra dönen · P04 saat hilesi · P05 hızlı tıklayan (120 TOPLA, 40 inşaat, 60 panel) · P06 OTO toplama · P07 her ayarı değiştiren + yeniden açılış · P08 gündüz görünümü + sistem karanlık tema · P09 balina (premium, 15 semt) · P10 kaporacı · P11 engel temizleyen · P12 özel tapu · P13 yıkım · P14 320px ekranda 8 menü ekranı · P15 tablet yatay · P16 bozuk kayıt (4 tür) · P17 çevrimdışı · P18 depolama kapalı · P19 3x yoğunluk · P20 2 saatlik seans · P21 hareket azaltma / erişilebilirlik · P22 geri tuşu · P23 kılavuz sınırları.

Her persona sonunda ortak değişmezler denetlendi: kasa sonlu ve ≥0, arsa tamponları sonlu, kat 0–5 arası, yatay taşma yok, konsol hatası yok.

## Kenar durumlar

- **Tarih:** yıl sonu 23:59:30 → gece yarısı geçişi, 29 Şubat 2028, yaz saati günü 29 Mart 2026, 29 Ekim bayramı; ISO hafta sınırları (2026-H53, 2025-H01); `dayDiff` yaz saati ve artık yıl.
- **Sayı:** NaN, negatif, Infinity, `Number.MAX_VALUE`, 1e100; birim sınırları (999 / 999.999 / 1e6); 15 semtin hepsi en üst seviyede, 1e6 hisse ve premium ile toplam kira sonlu.
- **Girdi:** boş, emoji, 500 karakter, HTML enjeksiyonu (`<img onerror>`), SQL benzeri metin, kendi davet kodu (küçük harfle).
- **Yetersiz bakiye:** 4 bina türü ve tüm semt ile kapora düğmeleri.
- **Eşzamanlılık:** iki sekme aynı anda açık → hata yok; son yazan kazanır (U5).

## Test edilemeyen alanlar

1. Gerçek Android ve iOS cihazlar (yalnızca Chromium mobil emülasyonu kullanıldı).
2. iOS WebKit / Safari (ortamda yalnızca Chromium var).
3. Cloud Functions (`submitScore`, `redeemInvite`, `deleteAccount`, `admobSsv`, `revenuecatWebhook`): yayında değiller.
4. Firestore kuralları emülatörde (Java ve firebase-tools yok). Kurallar önceki oturumda canlı projede, kendi oluşturulup silinen test kullanıcısıyla, yıkıcı olmayan biçimde doğrulandı. Bu oturumda üretime **dokunulmadı**.
5. AdMob gerçek reklamları, UMP onayı, ATT.
6. RevenueCat satın alma ve geri yükleme.
7. Yerel bildirimler, paylaşım sayfası, titreşim, ekran yönü kilidi.
8. Google ile giriş (`GOOGLE_SERVICES_JSON` eklenmedi).
9. Ağ gecikmesi altında bulut kaydı çakışması (sunucu yok).
10. Yük testi (k6): sunucu yayında olmadığı için hedef yok.
11. Elle ekran okuyucu testi (TalkBack / VoiceOver).
