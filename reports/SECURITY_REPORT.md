# Güvenlik Raporu (savunma amaçlı)

Kapsam: istemci kodu, yerel kayıt, Firestore kuralları, Cloud Functions kaynak kodu, bağımlılıklar, depodaki gizli bilgiler.
Üretim Firebase projesine bu oturumda **hiçbir istek atılmadı**; yıkıcı test yapılmadı.

## Özet

| Alan | Durum |
|---|---|
| Üretim bağımlılıkları | 7 yüksek açık vardı → **0** (grpc-js override) |
| Geliştirme bağımlılıkları | 17 açık (1 kritik `tar`); yalnızca ikon aracı zincirinde, pakete girmiyor (U6) |
| `functions/` bağımlılıkları | 9 orta (`uuid`); düzeltme için kırıcı ana sürüm gerekli (U7) |
| Depoda gizli bilgi | Yok. Tarananlar: özel anahtar, `sk_live`, AWS, GitHub ve Slack belirteçleri, servis hesabı JSON'u. `.env.production` yalnızca herkese açık Firebase web yapılandırmasını içeriyor. `ci/test-debug.keystore` test anahtarı ve bilerek depoda; yayın anahtarı depoda değil. |
| Kayıt manipülasyonu | Tür doğrulamalı temizleyici eklendi (B1–B4). Fuzz testinde 400 bozuk kayıtta 0 çökme. |
| XSS | Sunucudan gelen tek metin (sıralama adları) `esc()` ile kaçırılıyor. Davet girdisi `^TP[A-Z0-9]{4}$` ile doğrulanıyor. e2e'de `<img onerror>` enjeksiyonu çalışmadı. Kayıttan gelen fırsat başlığı artık kaçırılıyor (B7). `eval`, `new Function` ve `document.write` kullanılmıyor. |
| Prototip kirletme | `__proto__` semt anahtarı reddediliyor (B4); JSON `__proto__` alanı etkisiz (test). |

## Firestore kuralları (`firestore.rules`): inceleme

- `saves/{uid}`: yalnızca sahibi okur, yazar ve siler. Alan beyaz listesi `j`, `savedAt`, `earned`, `v`; `j` metin ve 950 KB altında; sayısal alanların türü denetleniyor. ✓
- `lb/{id}`: istemci yazamaz; sıralamayı yalnızca `submitScore` yazar. ✓ Oturum açmış herkes okuyabiliyor: bu, diğer oyuncuların **ilk adını** (Google hesap adından) ve uid'sini gösterir. Gizlilik politikasında belirtilmeli.
- Diğer her şey reddediliyor. ✓
- Not: istemci `earned` alanını kendisi yazar; sıralama bu alanı değil, sunucunun sınırladığı `lb` değerini kullanır. ✓ Asıl kural: "ön yüze güvenme".

## Cloud Functions (kaynak incelemesi; yayında değil)

| Fonksiyon | Yetki | Bulgu |
|---|---|---|
| `submitScore` | `req.auth` zorunlu | Katmanlı hile sınırı var: hafta anahtarı, geçen süreye göre üst sınır, bileşik büyüme. Sınırı aşan değer kırpılır ve işaretlenir. Sıralama geriye gitmez. ✓ |
| `redeemInvite` | `req.auth` zorunlu | İşlem (transaction) içinde tek kullanım; kendi kodu reddediliyor. ✓ |
| `deleteAccount` | `req.auth` zorunlu | Yalnızca çağıranın verisini siler. ✓ |
| `admobSsv` | Google imzası (ECDSA) | ✓; `transaction_id` yol enjeksiyonu kapatıldı (S3). |
| `revenuecatWebhook` | Paylaşılan gizli anahtar | Sabit zamanlı karşılaştırma eklendi; boş anahtar reddedilir (S2). |
| Hepsi | — | **App Check zorunlu değil** (U2): yayın öncesi açılmalı. |

## İstemci tarafı hile (tek oyunculu oyun)

- Yerel kayıt cihazda düz JSON; sağlama (FNV) yalnızca bozulmayı yakalar, hileyi değil. Bu kabul edilmiş bir durum: rekabet sunucu tarafında sınırlanıyor.
- Saat geri alma hilesi yakalanıyor (P04: `clockFlag`).
- Davet kodu: sunucu yoksa önizleme dışında `error` dönüyor; üretimde yerel ödül verilmiyor. ✓

## Öneriler (öncelik sırasıyla)

1. Fonksiyonları `firebase-admin@14` ile yayına almak ve `enforceAppCheck: true` açmak.
2. Gerçek cihaz testiyle birlikte CSP meta etiketi eklemek (U8).
3. `@capacitor/assets`'i ikon üretiminden sonra kaldırmak (U6).
4. Gizlilik politikasına sıralamada ilk adın görüneceğini eklemek.
5. Firestore kurallarını CI'da emülatörle sınamak (`@firebase/rules-unit-testing`).
