# Tapu — Gizlilik Politikası ve KVKK Aydınlatma Metni (taslak)

> Bu metin bir şablondur, hukuki danışmanlık değildir. `[köşeli parantez]` içindeki alanları doldurun ve yayınlamadan önce bir hukukçuya kontrol ettirin.

**Son güncelleme:** [tarih]
**Veri sorumlusu:** [Şirket / kişi adı], [adres], [e-posta]

## 1. Hangi verileri işliyoruz?
| Veri | Nereden | Neden | Hukuki sebep (KVKK m.5 / GDPR m.6) |
|---|---|---|---|
| Oyun kaydı (binalar, kasa, ilerleme) | Uygulama | Oyunu oynatmak, cihazlar arası yedek | Sözleşmenin ifası |
| Anonim oyuncu kimliği (Firebase uid) | Firebase Authentication | Kayıt, sıralama, davet | Sözleşmenin ifası |
| Google / Apple hesabı bilgisi (kimlik, ilk ad) | Sen bağlarsan | Hesabı bağlamak, sıralamada ad | Açık rıza / sözleşme |
| Davet kodu ve kullanımı | Uygulama | Davet ödülleri | Sözleşmenin ifası |
| Haftalık skor | Uygulama | Haftalık sıralama | Meşru menfaat |
| Oyun içi olaylar (ör. semt açıldı) | Firebase Analytics | Oyunu geliştirmek | Meşru menfaat / açık rıza (AB) |
| Çökme kayıtları | Firebase Crashlytics | Hataları düzeltmek | Meşru menfaat |
| Reklam kimliği, yaklaşık konum (IP), cihaz bilgisi | Google AdMob | Reklam göstermek; izin varsa kişiselleştirmek | Açık rıza (AB/İngiltere UMP, iOS ATT) / meşru menfaat |
| Satın alma kaydı | App Store / Google Play, RevenueCat | Reklamsız paketi tanımak, geri yüklemek | Sözleşmenin ifası |

Ödeme bilgilerin (kart vb.) bize ulaşmaz; mağazalar işler.

## 2. Kimlerle paylaşıyoruz? (yurt dışına aktarım)
- **Google LLC** (Firebase, AdMob) — ABD/AB sunucuları
- **RevenueCat, Inc.** — ABD
- **Apple / Google** mağazaları

Bu hizmet sağlayıcılarla veri işleme sözleşmeleri ve standart sözleşme maddeleri kapsamında aktarım yapılır (KVKK m.9). [Gerekiyorsa: Kurul'a bildirim / taahhütname bilgisi.]

## 3. Ne kadar saklıyoruz?
- Oyun kaydı ve hesap: hesabını silene kadar. Silinince en geç 30 gün içinde yedeklerden de kalkar.
- Haftalık sıralama: hesap silinene kadar (geçmiş haftalar [N] hafta sonra silinir).
- Analitik: Firebase varsayılanı [14 ay].
- Ödüllü reklam doğrulama kayıtları: [12 ay].

## 4. Hakların (KVKK m.11, GDPR m.15-22)
Verilerinin işlenip işlenmediğini öğrenme, bilgi isteme, düzeltme, silme, aktarılan üçüncü kişileri bilme, itiraz ve zararın giderilmesini isteme.

- **Uygulama içinden silme:** Ayarlar → *Hesabımı ve verilerimi sil*. Bulut kaydı, sıralama, davet kayıtları ve kimliğin hemen silinir.
- **Uygulama yüklü değilse:** [e-posta] adresine oyuncu kodunla (Menü → Arkadaşını davet et → Kodun) yaz; 30 gün içinde yanıtlanır.
- **Reklam izinleri:** Ayarlar → *Reklam izinlerini yönet* (AB/İngiltere), iOS Ayarlar → Gizlilik → İzleme.
- **Bildirimler:** Ayarlar → Bildirimler.

## 5. Çocuklar
Tapu 13 yaş altındaki çocuklara yönelik değildir ve bilerek onlardan veri toplamaz.

## 6. Güvenlik
Veriler aktarımda şifrelenir (TLS). Bulut kaydına yalnızca hesap sahibi erişebilir (Firestore güvenlik kuralları).

## 7. Değişiklikler
Bu metni güncellersek uygulama içinde duyururuz.

**İletişim:** [e-posta]
