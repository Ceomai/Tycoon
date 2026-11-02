# Hatalar ve Düzeltmeler

Denetim tarihi: 2026-11-01 · Dal: `denetim` · Her düzeltme otomatik bir testle korunur (regresyon).

## Bulunan ve düzeltilen hatalar

| # | Önem | Alan | Hata | Nasıl bulundu | Düzeltme | Regresyon testi |
|---|---|---|---|---|---|---|
| B1 | **Yüksek** | Kayıt | Bozuk ya da elle değiştirilmiş kayıt oyunu açılışta çökertiyordu. Örnekler: `fx: null` ("S.fx is not iterable"), bilinmeyen bina türü (`t:'kale'` → `TYPES[t].inc` undefined), yanlış türde alanlar. Oyuncu ana ekrana hiç ulaşamıyordu. | Birim fuzz testi: her alan null ve yanlış türle denendi, 400 rastgele bozuk kayıt üretildi. | `src/state.ts`'e `sanitize()` eklendi. Her alanın türü varsayılan durumla karşılaştırılır. Sayılar sonlu tutulur ve sınırlanır. Arsalar tek tek doğrulanır, semt anahtarları beyaz listeden geçer. | `tests/unit/audit.test.ts` › "kayıt: bozuk ve kötü niyetli veri" (7 test), e2e P16 (4 senaryo) |
| B2 | Orta | Kayıt / çizim | Kayıtta bilinmeyen engel türü (`ob:'ufo'`) tahta çiziminde `OBSTACLES[p.ob].n` hatasına yol açıyordu. | Güvenlik incelemesi: kayıttan gelen kimliklerin innerHTML'e akışı izlendi. | Engel kimlikleri `config.ts` › `OBSTACLE_IDS` ile doğrulanır. Bilinmeyen engel boş arsaya döner. | audit.test › "bilinmeyen engel türü boş arsaya döner" |
| B3 | Orta | Kayıt / bellek | Semt dizisi 20 arsa ile sınırlanmıyordu: 5000 elemanlı kayıt olduğu gibi kalıyor, belleği ve bulut kaydını şişiriyordu. | Fuzz testi ("dev dizi") | `cleanLots` diziyi 20 arsaya kırpar ya da 20'ye tamamlar. | audit.test › "dizi uzunluğu 20 ile sınırlı", e2e P16 "dev dizi" |
| B4 | Düşük | Kayıt | `own` listesinde `__proto__` anahtarı kabul ediliyordu (`DMAP['__proto__']` prototipten doğru dönüyordu). | Birim testi | Semt anahtarı `Object.prototype.hasOwnProperty` ile denetlenir. | audit.test › "bilinmeyen semt anahtarları…", "__proto__ ile prototip kirletme etkisiz" |
| B5 | Orta | Arayüz | Yönlendirme balonu (`#bubble`) `white-space:nowrap` yüzünden uzun metinde ekrandan taşıyordu: 390px'te 4px yatay kaydırma vardı, 320px'te metin kesiliyordu. 12 persona yolculuğunun 11'inde görüldü. | e2e taşma denetimi (`scrollWidth > innerWidth`), ardından öğe öğe tarama | Balon artık satır kaydırıyor, `max-width: calc(100vw - 24px)`. | `tests/audit.cjs`: her persona sonunda "yatay taşma" denetimi |
| B6 | Düşük | Biçim | `fmtTime(NaN)` "NaN sn" döndürüyordu. | Birim kenar durum testi | `Math.ceil(...) \|\| 0` | audit.test › "süre biçimleri" |
| B7 | Düşük | Güvenlik | Fırsat başlığı (`S.offer.title`) kayıttan geldiği halde kaçışsız innerHTML'e yazılıyordu. Yalnızca kendi kaydını değiştirebilen biri etkilenir (self-XSS). | innerHTML akış incelemesi | `esc(o.title)` | (kod incelemesi) |
| S1 | **Yüksek** | Bağımlılık | Üretim bağımlılığı `firebase@12.19.0` → `@grpc/grpc-js@1.9.16` içinde 2 yüksek açık vardı (GHSA-m9gg-hp2v-232j, GHSA-f596-whhp-79r4). | `npm audit --omit=dev` | `package.json` › `overrides: {"@grpc/grpc-js": "^1.14.7"}`. Üretim açığı 7 → **0**. | `npm audit --omit=dev` → "found 0 vulnerabilities" |
| S2 | Düşük | Sunucu (yayında değil) | RevenueCat webhook gizli anahtarı `!==` ile karşılaştırılıyordu; zamanlama yan kanalı oluşturuyordu. Boş gizli anahtarda boş başlık da kabul edilebilirdi. | Kod incelemesi | `timingSafeEqual`; boş anahtar reddedilir. | `functions` tsc |
| S3 | Düşük | Sunucu (yayında değil) | AdMob SSV `transaction_id` doğrudan belge yoluna yazılıyordu (`rewards/${tx}`); içinde `/` olan bir değer alt yol üretebilirdi. İmza doğrulaması nedeniyle istismarı zordu. | Kod incelemesi | `^[A-Za-z0-9_-]{1,128}$` denetimi | `functions` tsc |

## Çözülmemiş bulgular

| # | Önem | Bulgu | Neden açık | Öneri |
|---|---|---|---|---|
| U1 | **Yüksek (yayın engeli)** | Cloud Functions yayında değil (Spark planı). Lig, davet kodu ve **hesap silme** üretimde çalışmıyor. Google Play, hesap oluşturan uygulamalarda uygulama içinden hesap silmeyi zorunlu tutuyor. | Blaze planı ve IAM rolleri kullanıcı tarafında bekliyor. | Blaze'e geç, servis hesabına rolleri ver, `firebase-deploy.yml` → `hepsi`. |
| U2 | Orta | Callable fonksiyonlarda App Check zorunlu değil; bot hesaplarla maliyet ve sıralama kötüye kullanımı mümkün. | Fonksiyonlar yayında değil. | `onCall({ enforceAppCheck: true })` + Play Integrity / App Attest. |
| U3 | Orta | IAP ürünleri (`tapu_premium`, `tapu_sezon`) mağazalarda oluşturulmadı; satın alma uçtan uca sınanamadı. | Mağaza hesabı gerekli. | Play Console / App Store Connect + RevenueCat eşlemesi. |
| U4 | Düşük | Küçük telefonlarda arsa dokunma alanı 40–43px (280×653: 42, 320×568: 40, 360×640: 43). Apple'ın 44pt önerisinin altında, WCAG 2.5.8'in 24px alt sınırının üstünde. | Düzeltmek ızgara yerleşimini değiştirmeyi gerektiriyor; tasarım onayı gerek (kural: arayüz önerisi önce tasarımda gösterilir). | Küçük ekranlarda üst bilgi alanını sıkıştırma önerisi tasarım tuvalinde gösterilebilir. |
| U5 | Düşük | İki sekme ya da iki cihaz aynı anda açıksa son yazan kazanır; sekmeler arası kilit yok. | Tek oyunculu, nadir senaryo. | `BroadcastChannel` ile ikinci sekmeye "oyun başka sekmede açık" uyarısı. |
| U6 | Bilgi | Geliştirme araçlarında açıklar var (`tar` kritik, `sharp`, `glob`, `minimatch` vb.). Hepsi `@capacitor/assets@3.0.5` → `@capacitor/cli@5` zincirinden geliyor; yalnızca ikon üretiminde çalışıyor ve uygulama paketine girmiyor. | Düzeltme kırıcı ana sürüm yükseltmesi istiyor. | İkon üretimi bitince `@capacitor/assets`'i kaldır ya da güncel sürüme geç. |
| U7 | Bilgi | `functions/` altında 9 orta açık var (`uuid`, google-gax zinciri). | `firebase-admin@14` kırıcı ana sürüm. | Fonksiyonlar yayına alınmadan önce `firebase-admin` 14'e yükselt ve yeniden sına. |
| U8 | Bilgi | `index.html` içinde Content-Security-Policy yok. | AdMob, Firebase ve RevenueCat alan adlarıyla gerçek cihazda sınanmadan eklemek reklamları kırabilir. | Gerçek cihaz testinde CSP meta etiketi ekle ve sına. |
