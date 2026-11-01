# CI dosyaları
`test-debug.keystore`: yalnızca **test APK'sı** için hata ayıklama (debug) imzası. Şifresi standart Android değeri (`android`).
Her derleme aynı imzayı kullandığı için yeni test APK'sı eskisinin üstüne kurulur, kayıt silinmez.
Mağaza (Play) sürümü bununla **imzalanmaz**: yayın anahtarı ayrı oluşturulur ve gizli tutulur (bkz. docs/RELEASE.md).
