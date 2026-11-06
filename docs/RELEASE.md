# Yayına çıkış kontrol listesi

Kod tarafı hazır. Aşağıdakiler senin hesaplarınla yapılması gereken adımlar. Sırayla ilerle; her adımın sonunda ne değiştiği yazıyor.

## 0. Yayın hazırlık durumu (son denetim)

**Kodda düzeltilenler (bu sürüm):**
- Uygulama ikonu ve açılış ekranı artık `assets/icon.png`'den üretiliyor (önceden Capacitor'ın varsayılan ikonu çıkıyordu) — `ci/android/prepare.sh`.
- Bildirim ikonu `ic_stat_tapu` eklendi (yoksa bildirimler boş ikonla görünür ya da düşebilir).
- Android: tam zamanlı alarm izni (`SCHEDULE_EXACT_ALARM`) kaldırıldı; hatırlatmalar normal zamanlamayla.
- Hesap silme sunucu fonksiyonu olmadan da çalışır: oyuncu kendi bulut kaydını ve Firebase hesabını uygulamadan siler (Apple 5.1.1(v), Google Play hesap silme şartı).
- Lig ve davet kodu, sunucu fonksiyonları yayına alınana kadar gizli (`VITE_SERVER_FUNCTIONS=true` ile açılır); yarım çalışan özellik mağaza incelemesine girmez.
- Emlak Kulübü aboneliği için otomatik yenileme/iptal bilgisi ve gizlilik + kullanım koşulları bağlantıları (Apple 3.1.2, Google abonelik politikası).
- Başlangıç paketindeki "… değerinde" referans fiyatı kaldırıldı (yanıltıcı fiyat iddiası riski).
- Gizlilik sayfası: `public/gizlilik.html` → https://ceomai.github.io/Tycoon/gizlilik.html (uygulamadaki bağlantı buraya gider). Ayarlar'da oyuncu kodu görünür (silme talebi için).
- Google Play için imzalı AAB iş akışı: `.github/workflows/android-release.yml` (elle çalıştırılır, sürüm kodu otomatik artar, AdMob test modu kapalı).

**Senin yapman gerekenler (yayın engelleri):**
1. **Gizlilik sayfasındaki sarı alanları doldur** (`public/gizlilik.html`): geliştirici/şirket adı, adres, iletişim e-postası, tarih. Bir hukukçuya kontrol ettir.
2. **Google Play yükleme anahtarı**: `keytool -genkeypair -v -keystore upload.jks -keyalg RSA -keysize 2048 -validity 10000 -alias upload` → GitHub sırları: `ANDROID_KEYSTORE_BASE64` (`base64 -w0 upload.jks`), `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`. Play App Signing'i aç. Anahtarı güvenli yerde yedekle (kaybolursa güncelleme yüklenemez).
3. **AdMob**: gerçek uygulama ve reklam birimi kimlikleri → sırlar `ADMOB_APP_ID_ANDROID`, `VITE_ADMOB_REWARDED_ANDROID`, `VITE_ADMOB_INTERSTITIAL_ANDROID`; `app-ads.txt` yayınla.
4. **RevenueCat + mağaza ürünleri** (bölüm 4) → sır `VITE_REVENUECAT_ANDROID`.
5. **Firebase Android** `google-services.json` → sır `GOOGLE_SERVICES_JSON`; SHA-1/SHA-256'yı (yükleme ve Play imza anahtarı) Firebase'e ekle.
6. **Play Console formları**: veri güvenliği (bölüm 6), içerik derecelendirmesi, hedef kitle 13+, reklam içerir, hesap silme web adresi (gizlilik sayfası §4), mağaza görselleri.
7. İsteğe bağlı: Blaze planı + fonksiyonlar → lig ve davet (`VITE_SERVER_FUNCTIONS=true`).

**iOS (App Store) — Mac ve Xcode gerekir, bu depoda iOS projesi yok:**
- `npx cap add ios` → `npx capacitor-assets generate --ios` → `npx cap sync ios`.
- `Info.plist`: `NSUserTrackingUsageDescription` (ATT metni), `GADApplicationIdentifier` (AdMob iOS uygulama kimliği), `SKAdNetworkItems` (Google'ın listesi), `ITSAppUsesNonExemptEncryption = NO`.
- Yetenekler: Sign in with Apple (Google ile giriş sunulduğu için zorunlu), Push yok, In-App Purchase.
- `GoogleService-Info.plist` (Firebase iOS), RevenueCat iOS anahtarı, App Store Connect ürünleri, gizlilik "beslenme etiketi" formu.

## 1. Uygulama kimliği
- [ ] `capacitor.config.json` → `appId` (`com.tapu.oyun`) kalıcı paket adın olacak; mağazaya yüklendikten sonra değiştirilemez. Kendi alan adına göre değiştir (ör. `com.sirketin.tapu`).
- [ ] `npx cap add android` ve `npx cap add ios` → `android/` ve `ios/` klasörleri oluşur. Bu klasörler git'e girer (yerel ayarlar burada).
- [ ] İkon ve açılış ekranı: `assets/icon.svg` → 1024×1024 PNG olarak `assets/icon.png`; `npm run icons`.
- [ ] Bildirim ikonu: Android için beyaz tek renkli `ic_stat_tapu` (res/drawable).

## 2. Firebase
1. [ ] console.firebase.google.com → yeni proje (Analytics açık). Bölge: `europe-west1`.
2. [ ] Android uygulaması ekle (paket adı = appId) → `google-services.json` → `android/app/`.
   iOS uygulaması ekle → `GoogleService-Info.plist` → Xcode'da `App/App` içine.
3. [ ] Web uygulaması ekle → çıkan değerleri `.env` içindeki `VITE_FIREBASE_*` alanlarına yaz.
4. [ ] Authentication → Oturum açma yöntemleri: **Anonim**, **Google**, **Apple** açık.
   - Google: Android için SHA-1/SHA-256 parmak izlerini (debug + Play App Signing) Firebase'e ekle.
   - Apple: Apple Developer'da "Sign in with Apple" yetkisi; Xcode → Signing & Capabilities → Sign in with Apple.
   - iOS: `GoogleService-Info.plist` içindeki `REVERSED_CLIENT_ID` Xcode → Info → URL Types'a eklenir.
5. [ ] Firestore → veritabanı oluştur (üretim modu, `europe-west1`).
   - [ ] Firestore → **TTL (Time-to-live)** → koleksiyon `lb`, alan `expireAt`: eski haftaların lig skorları 6 hafta sonra kendiliğinden silinir.
6. [ ] Plan: **Blaze** (Cloud Functions için gerekli). **Bütçe uyarısı kur:** Google Cloud Console → Faturalandırma → Bütçeler ve uyarılar → aylık tutar (ör. 200 $) ve %50/%90/%100 e-posta uyarısı.
   - Ölçek notları: fonksiyonlar en fazla 200 kopya × 80 eşzamanlı istek; bulut kaydı 5 dakikada bir + uygulama kapanırken; sorgulanmayan zaman/metin alanları dizinlenmez (`firestore.indexes.json` → `fieldOverrides`), böylece yüksek yazma hızında darboğaz oluşmaz.
7. [ ] Dağıt:
   ```bash
   npm i -g firebase-tools
   firebase login
   firebase use --add
   firebase functions:secrets:set REVENUECAT_WEBHOOK_SECRET
   firebase deploy --only firestore,functions
   ```
8. [ ] Crashlytics: Android'de `android/build.gradle` ve `android/app/build.gradle` dosyalarına Crashlytics Gradle eklentisi (paket belgesindeki adımlar: `@capacitor-firebase/crashlytics`). iOS'ta dSYM yükleme betiği.
9. [ ] Remote Config: istersen `INTER_MIN`, `INTER_MAX`, `OFFLINE_RATE`, `EVENT_MIN` gibi sayısal anahtarlar (bkz. `src/config.ts` → `CFG`). Boş bırakılırsa koddaki değerler geçerli.

## 3. AdMob
1. [ ] admob.google.com → Android ve iOS uygulaması → her biri için **Ödüllü** ve **Geçiş** reklam birimi.
2. [ ] Birim kimliklerini `.env` → `VITE_ADMOB_*` alanlarına yaz, `VITE_ADMOB_TESTING=false`.
3. [ ] Uygulama kimlikleri (`ca-app-pub-…~…`):
   - Android: `AndroidManifest.xml` → `<meta-data android:name="com.google.android.gms.ads.APPLICATION_ID" android:value="…"/>`
   - iOS: `Info.plist` → `GADApplicationIdentifier`, ayrıca `SKAdNetworkItems` listesi (Google'ın güncel listesi).
4. [ ] iOS `Info.plist` → `NSUserTrackingUsageDescription`: "Sana daha ilgili reklamlar gösterebilmek için kullanılır."
5. [ ] Gizlilik ve mesajlar → **GDPR (AB/İngiltere) onay mesajı** oluştur ve yayınla. Uygulama açılışta UMP formunu kendisi gösterir; ayarlarda "Reklam izinlerini yönet" çıkar.
6. [ ] Ödüllü birim → Sunucu tarafı doğrulama → URL: `https://europe-west1-<proje>.cloudfunctions.net/admobSsv`.
7. [ ] `app-ads.txt` dosyasını geliştirici web sitende yayınla.

## 4. RevenueCat (paketler)
1. [ ] Play Console ve App Store Connect'te ürünler (uygulama kimlikleri desenle eşler; fiyatlar öneri):

   | Ürün kimliği | Tür | Fiyat | Entitlement |
   |---|---|---|---|
   | `tapu_premium` | tüketilmeyen | ₺249,99 | **`premium`** (Holding paketi: reklamsız + anında ödül + kalıcı 2x kira) |
   | `tapu_reklamsiz` | tüketilmeyen | ₺99,99 | **`reklamsiz`** (yalnızca geçiş reklamı kalkar) |
   | `tapu_kulup` | aylık abonelik | ₺69,99 | **`kulup`** (reklamsız, anında ödül, günde 1 jeton, Altın Tapu) |
   | `tapu_baslangic` | tüketilmeyen | ₺49,99 | — (uygulama içinde bir kez verilir) |
   | `tapu_jeton5`, `tapu_jeton15` | tüketilen | ₺29,99 · ₺69,99 | — |
   | `tapu_sezon` | tüketilen | ₺99,99 | — (Altın Tapu, her sezon) |
   | `tapu_sezon_ilk` | tüketilen | ₺49,99 | — (ilk sezon indirimi; yoksa `tapu_sezon` kullanılır) |
2. [ ] app.revenuecat.com → proje → Android + iOS uygulamaları (Play servis hesabı JSON'u, App Store paylaşılan gizli anahtarı / In-App Purchase anahtarı).
3. [ ] Entitlement'ları oluştur ve ürünleri bağla; tüm ürünleri bir offering'e (`default`) paket olarak ekle. Uygulama paketleri ürün kimliğinden tanır.
4. [ ] Herkese açık SDK anahtarları → `.env` → `VITE_REVENUECAT_ANDROID/IOS`.
5. [ ] Integrations → Webhooks → URL: `…/revenuecatWebhook`, Authorization: Firebase'e girdiğin `REVENUECAT_WEBHOOK_SECRET`.
6. [ ] Remote Config (isteğe bağlı A/B): `AD_CREDIT_MS`, `FIRST_FREE_MS`, `DAILY7_X`, `CARD_FLOOR_SEC`, `STARTER_CASH_SEC`, `INTER_MIN/MAX` sayısal anahtarları uygulamayı güncellemeden değiştirir.

## 5. Gizlilik ve yasal
- [ ] `docs/privacy-policy.md` taslağını doldur (şirket adı, adres, iletişim e-postası, VERBİS durumu), bir web adresinde yayınla → `.env` → `VITE_PRIVACY_URL`. Kullanım koşulları için `VITE_TERMS_URL`.
- [ ] Hesap silme: uygulama içinde (Ayarlar → Hesabımı ve verilerimi sil). Google Play ayrıca **web üzerinden silme talebi** adresi ister: gizlilik sayfasına "silme talebi için e-posta" bölümü yeterli.
- [ ] Yaş: oyun 13+ hedefli olarak işaretlenmeli (reklam kişiselleştirme ve COPPA nedeniyle "çocuklara yönelik" seçme). Çocuklara da yönelik olacaksa AdMob'da `tagForChildDirectedTreatment` ve aile politikası gerekir.

## 6. Mağaza formları
**Google Play → Veri güvenliği:**
| Veri | Toplanıyor | Amaç | Paylaşılıyor |
|---|---|---|---|
| Kullanıcı kimlikleri (Firebase uid, reklam kimliği) | Evet | Uygulama işlevi, analiz, reklam | Reklam (Google AdMob) |
| Uygulama etkinliği (oyun içi olaylar) | Evet | Analiz | Hayır |
| Uygulama bilgileri ve performans (çökme kayıtları) | Evet | Analiz | Hayır |
| Satın alma geçmişi | Evet | Uygulama işlevi | Hayır |
| Ad (Google/Apple bağlanırsa, yalnızca ilk ad sıralamada) | İsteğe bağlı | Uygulama işlevi | Hayır |
Veriler aktarımda şifrelenir; kullanıcı silme talep edebilir.

**App Store → App Privacy:** Identifiers (User ID, Device ID) → Third-Party Advertising, Analytics, App Functionality; Usage Data → Analytics; Diagnostics → App Functionality; Purchases → App Functionality. "Used to track you": Device ID (ATT izni verilirse).

**İçerik derecelendirme:** şiddet yok, kumar yok (gerçek parayla ödül yok), reklam var, uygulama içi satın alma var.

## 7. Son kontroller
- [ ] `npm test` yeşil.
- [ ] Gerçek cihazda: ilk açılış → il seçimi → oyna → uygulamayı kapat/aç (kayıt duruyor) → uçak modunda aç (yerel çalışıyor).
- [ ] Ayarlar → Google ile bağla → uygulamayı sil/yeniden kur → aynı hesapla bağla → bulut kaydı yükleme sorusu geliyor.
- [ ] Test reklamları (VITE_ADMOB_TESTING=true) ile ödüllü/geçiş akışları; sonra gerçek kimliklerle **kendi reklamına tıklamadan** kontrol.
- [ ] Sandbox / lisanslı test hesabıyla satın alma ve geri yükleme.
- [ ] Firestore → `lb` koleksiyonunda `flagged: true` kayıtları ilk haftalar izle; gerekirse `submitScore` sınırlarını ayarla.
- [ ] Sürüm numarası: Android `versionCode/versionName`, iOS `CFBundleShortVersionString/CFBundleVersion`.

## Bilinçli sınırlar
- Oyun ekonomisi istemcide çalışır (çevrimdışı oynanabilsin diye). Sunucu, sıralamayı zamana göre sınırlar ve davetleri doğrular; tek oyunculu ilerlemeyi hileli değiştiren biri yalnızca kendi oyununu etkiler.
- Arayüz yalnızca Türkçe. Başka dile açılacaksa metinler `src/ui` ve `src/game` içinden bir sözlüğe taşınmalı.
