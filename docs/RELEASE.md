# Yayına çıkış kontrol listesi

Kod tarafı hazır. Aşağıdakiler senin hesaplarınla yapılması gereken adımlar. Sırayla ilerle; her adımın sonunda ne değiştiği yazıyor.

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

## 4. RevenueCat (reklamsız paket)
1. [ ] Play Console ve App Store Connect'te tek seferlik ürün: `tapu_premium` (tüketilmeyen / non-consumable).
2. [ ] app.revenuecat.com → proje → Android + iOS uygulamaları (Play servis hesabı JSON'u, App Store paylaşılan gizli anahtarı / In-App Purchase anahtarı).
3. [ ] Entitlement: **`premium`** → ürünü bağla. Offering: `default` → paket olarak `tapu_premium`.
4. [ ] Herkese açık SDK anahtarları → `.env` → `VITE_REVENUECAT_ANDROID/IOS`.
5. [ ] Integrations → Webhooks → URL: `…/revenuecatWebhook`, Authorization: Firebase'e girdiğin `REVENUECAT_WEBHOOK_SECRET`.

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
