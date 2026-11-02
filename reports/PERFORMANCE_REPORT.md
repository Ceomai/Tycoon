# Performans Raporu

Ölçüm ortamı: bulut konteyneri, başsız Chromium (Playwright), önizleme paketi (`dist-preview/index.html`, tek dosya).
Mutlak süreler gerçek telefondan farklı olur. Düşük seviye cihazı yaklaşık temsil etmek için CDP ile 4x CPU yavaşlatma da kullanıldı.
Ham değerler: `tests/out/audit-metrics.json` (dosya git'e girmez; `npm run test:audit` ile yeniden üretilir).

## Açılış

| Ölçüm | Kısıtsız (5 soğuk açılış, ortanca) | 4x CPU yavaşlatma |
|---|---|---|
| İlk boyama (FCP) | **132 ms** | **556 ms** |
| DOMContentLoaded | 84 ms | — |
| load | 120 ms | — |
| `goto` → ilk arsa görünür (duvar saati) | 182 ms | 830 ms |

## Çalışma anı (15 semt dolu, 300 bina en üst seviyede, OTO toplama açık, 4x CPU)

| Ölçüm | Değer |
|---|---|
| Betik süresi | 72,7 ms/sn (ana iş parçacığının ~%7'si) |
| Yerleşim (layout) | 7,5 ms/sn |
| Stil hesaplama | 9,2 ms/sn |
| JS yığını | 3,7 MB |
| CDP profili (8 sn, kararlı durum) | %87 boşta; **0 uzun görev** |
| İlk 3 sn uzun görevler (açılış dahil, `buffered`) | 7 adet, en uzunu 263 ms. Hepsi açılış ve 15 semtin ilk çizimi sırasında. |

Profilde en çok zaman alan işlevler: `baseRate` %1,0, `citiesOwned` %0,4, `render` %0,4, `marketOf` %0,4. Darboğaz yok.

## Ekonomi sıcak yolu (Node, `tests/unit/perf.test.ts`)

300 bina üzerinde ölçüldü:

| İşlev | Süre |
|---|---|
| `totalRate` | 1,22 ms |
| `pending` | 1,50 ms |
| 300 × `baseRate` | 0,99 ms |

Tick aralığı 250 ms olduğundan oyunun ekonomi maliyeti göz ardı edilebilir düzeyde.

## Uzun seans ve bellek (P20: 120 dk sahte saat; kartlar ve reklamlar kapatılarak)

| Ölçüm | Değer |
|---|---|
| JS yığını (GC sonrası) | 2,2 MB → 3,2 MB (sızıntı belirtisi yok; eşik: 2 kat + 5 MB) |
| DOM düğümü (sonda) | 860 |
| Gösterilen kart | 51 |
| Geçiş reklamı | 6 (2 saatte) |

## Stres

| Senaryo | Sonuç |
|---|---|
| 1000 dokunuş (TOPLA ve arsa dönüşümlü, panel aç/kapa) | 2,6 sn; hata yok, durum tutarlı |
| 500 menü aç/kapa | 1,1 sn; hata yok |
| 120 ardışık TOPLA + 40 ardışık inşaat | çift harcama yok (176 harcandı, tek inşaat) |

## Paket boyutu (üretim, `npm run build`)

| Dosya | Ham | gzip |
|---|---|---|
| `index-*.js` (oyun) | 196,4 kB | 71,8 kB |
| `firebase-*.js` (tembel yüklenir; ilk boyamayı engellemez) | 551,8 kB | 163,4 kB |
| `www/` toplam | 1,5 MB | — |

## Kayıt boyutu

En kötü durumda (15 semt, en üst seviye, tüm cepheler ve 2x süreleri dolu) kayıt **33,4 KB**. Firestore kuralı 950 KB'ye izin veriyor.

## Ekonomi temposu (`npm run sim`, reklamsız aktif oyuncu)

| Semt | Açılış | Dolma süresi | Bekleme |
|---|---|---|---|
| Kadıköy | 0 dk | 19 dk | 4 dk |
| Beşiktaş | 23 dk | 15 dk | 6 dk |
| Şişli | 44 dk | 20 dk | 10 dk |
| Nişantaşı | 1,2 sa | 28 dk | 21 dk |
| Bebek | 2,0 sa | 28 dk | — |

İstanbul'un tamamı 2,5 saat aktif oyun sürüyor. Bu değerler bir önceki dengeleme onayıyla tutarlı.

## Ölçülemeyenler

- Gerçek cihazda pil tüketimi, ısınma, kare hızı (FPS).
- Android WebView ve iOS WKWebView farkları.
- Sunucu gecikmesi ve yük testi (fonksiyonlar yayında değil).
