#!/usr/bin/env bash
# Android projesi hazırlığı (CI): `npx cap add android` sonrası çalışır.
# - Uygulama ikonu ve açılış ekranı assets/icon.png'den üretilir (aksi halde Capacitor'ın varsayılan ikonu kalır)
# - Bildirim ikonu (capacitor.config › LocalNotifications.smallIcon = ic_stat_tapu)
# - Tam zamanlı alarm izni kaldırılır (oyun hatırlatmaları için gerekmez; Android 14+ ve Play'de gerekçe ister)
# - AdMob uygulama kimliği (ADMOB_APP_ID verilmezse Google'ın test kimliği)
set -euo pipefail
npx capacitor-assets generate --android --iconBackgroundColor '#e7efed' --iconBackgroundColorDark '#111815' --splashBackgroundColor '#e7efed' --splashBackgroundColorDark '#111815'
mkdir -p android/app/src/main/res/drawable
cp ci/android/ic_stat_tapu.xml android/app/src/main/res/drawable/ic_stat_tapu.xml
MANIFEST=android/app/src/main/AndroidManifest.xml
grep -q 'xmlns:tools' "$MANIFEST" || sed -i 's#<manifest xmlns:android="http://schemas.android.com/apk/res/android"#<manifest xmlns:android="http://schemas.android.com/apk/res/android" xmlns:tools="http://schemas.android.com/tools"#' "$MANIFEST"
sed -i 's#</manifest>#    <uses-permission android:name="android.permission.SCHEDULE_EXACT_ALARM" tools:node="remove" />\n</manifest>#' "$MANIFEST"
APPID="${ADMOB_APP_ID:-ca-app-pub-3940256099942544~3347511713}"
sed -i "s#</application>#    <meta-data android:name=\"com.google.android.gms.ads.APPLICATION_ID\" android:value=\"$APPID\"/>\n    </application>#" "$MANIFEST"
grep -c 'tools:node="remove"' "$MANIFEST" >/dev/null && echo "android hazır: ikon, bildirim ikonu, izinler, AdMob ($APPID)"
