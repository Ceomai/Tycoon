# Analitik: kullanım hunileri ve denge panosu

Kaynak: `src/services/funnel.ts` (şema, kovalar, bir-kez bitleri, hız sınırı) → `src/services/analytics.ts` (Firebase Analytics;
yalnız telefonda, web ve önizlemede ağa hiçbir şey gitmez). Oyun kodu `Funnel.tenant / project / ihale / bank / sheet / ms`
çağrılarıyla tek satırda bağlanır. Bu belgedeki olay adları birim testiyle (`tests/unit/funnel.test.ts`) koddaki listeyle karşılaştırılır.

## Kurallar

- **Kişisel veri yok, serbest metin yok.** Parametreler yalnız oyun içi kimlikler (semt `ist-2`, şehir `ist`, tip `ogrenci`,
  kişilik `sadik`, karakter `ist.ogrenci`, rakip kimliği), kovalanmış süreler ve tutarlardır. Oyuncunun yazdığı hiçbir metin, cihaz
  ya da hesap bilgisi parametreye girmez. `send()` her değeri temizler: metin ≤ 40 karakter ve yalnız `[A-Za-z0-9_.:-]`.
- **Firebase sınırları:** olay adı ≤ 40 karakter, `snake_case`, ayrılmış ad/önek değil (`firebase_`, `google_`, `ga_`); olay başına ≤ 25
  parametre; uygulama başına ≤ 500 olay adı, ≤ 25 kullanıcı özelliği (ad ≤ 24, değer ≤ 36). Bu adım 28 yeni ad ve 6 kullanıcı özelliği ekler.
- **Tutarlar** iç birimde (bölgenin fiyat seviyesi ve kurdan bağımsız) ve 10'un kuvveti olarak gider: `*_e` = ⌊log10⌋ (2 500 → 3).
- **Süreler** oyun süresi (`S.playMs`) üzerinden, dakika alt sınırı kovasıyla: `m0000, m0001, m0002, m0003, m0005, m0010, m0015, m0020,
  m0030, m0045, m0060, m0090, m0120, m0180, m0240, m0480, m1440` (metin, sıralanabilir).
- **Adet** kovaları: `0, 1, 2, 3, 5, 10, 20, 50, 100` · **oran** kovaları: yüzde, 10'luk · **kat** kovaları: `0, 1, 1.2, 1.5, 2, 3, 5, 10`.
- **Bir-kez olaylar** (`ms_*`, `sys_unlock`) kayıttaki `S.fn` bit alanıyla tutulur; Holding'de sıfırlanmaz. Bu sürümden önceki
  kayıtlarda zaten yaşanmış olanlar açılışta olay göndermeden işaretlenir (`seed`).
- **Hız sınırı:** ad başına dakikada 8, toplam dakikada 60, oturumda 600 huni olayı; "gördü / açtı" olayları oturumda aynı nesne
  (aday, semt, ihale) için bir kez. Sınıra takılan olay sessizce düşer.
- **Hata oyunu etkilemez:** her giriş noktası `try/catch` içindedir; analitik çökse de oyun sürer.
- Her huni olayına `play_b` (oyun süresi kovası) eklenir. Semt bağlamı olan olaylarda `district`, `city`, `tier` (kademe 0–4) vardır.

## Kullanıcı özellikleri (6)

| Özellik | Değerler | Not |
|---|---|---|
| `region` | `tr us uk de jp gl` | oynanan bölge (ülke fiyat seviyesi kırılımı bununla yapılır) |
| `lang` | `tr en de ja` | |
| `payer` | `none noads premium club` | satın alma durumu (en yüksek paket) |
| `holding_b` | adet kovası | Holding hissesi |
| `own_b` | adet kovası | sahip olunan semt |
| `collect_mode` | `tap auto` | |

Açılışta ve değiştikçe (5 sn'de bir denetim, yalnız değişen) yazılır.

## Olaylar

`yeni` = bu adımda eklendi; `eski` = adı önceden vardı, parametreleri genişledi (eski parametreler korunur).

### Kiracılar (gördü → açtı → karşıladı → anahtar → bitti / gitti)

Ortak parametreler: `arch` (tip), `wish` (istek türü: `nb quiet lvl new proj kose paint renov`), `wtype` (istenen bina), `late` (geç oyun
isteği 0/1), `trait` (kişilik), `ch` (karakter kimliği), `district`, `city`, `tier`.

| Adım | Olay | | Ek parametreler |
|---|---|---|---|
| aday geldi | `tenant_arrive` | eski | |
| kart açıldı | `tenant_open` | yeni | `st` (`wait ready live`); aday + durum başına oturumda bir kez |
| istek karşılandı | `tenant_ready` | yeni | `wait_b` gelişten karşılanmaya süre |
| anahtar verildi | `tenant_settle` | eski | `key_b` karşılanmadan anahtara süre, `nth` toplam yerleşen (kova), `new_ch` defterde yeni pul 0/1 |
| gitti | `tenant_leave` | yeni | `st`: `wait` = istek karşılanmadı, `ready` = anahtar verilmedi; `wait_b` |
| sözleşme bitti | `tenant_end` | yeni | (tekrar: bir sonraki `tenant_arrive`) |
| yenileme başladı | `tenant_renov` | eski | geç oyun isteği |
| defter açıldı | `defter_open` | yeni | `stamps` pullu karakter (kova), `met` tanışılan (kova); oturumda bir kez |

Geç oyun istekleri ayrı olay değildir: aynı huninin `late = 1` (ya da `wish`) kırılımıdır.

### Büyük projeler (teklif → seçim → onay kartı → başladı → teslim → 2. etap / ayrıldı)

Ortak: `district`, `city`, `tier`, `kind` (`site carsi plaza karma`), `own_pj` (semtteki proje sayısı).

| Adım | Olay | | Ek parametreler |
|---|---|---|---|
| teklif görüldü (arsa paneli) | `project_offer` | yeni | `n` uygun blok; semt başına oturumda bir kez |
| seçim açıldı | `project_select` | yeni | `n` |
| onay kartı | `project_card` | yeni | `cost_e`, `afford` 0/1 |
| başlatıldı | `project_start` | eski | `st` |
| teslim | `project_done` | eski | `st` (1 ya da 2) |
| 2. etap | `project_stage2` | eski | `st` |
| ayrıldı | `project_split` | eski | `st` |
| proje paneli açıldı | `project_open` | yeni | `st`; proje + etap başına oturumda bir kez |

### Rakip ve ihale (açıldı → panel → vekâlet → geçildi → sonuç → köşe başı)

Ortak: `kind` (`lm arsa`), `rival`, `city`, `joined` 0/1, `phase` (`early late done none`), `my_x` (vekâlet / açılış fiyatı, kat kovası), `open_e`.

| Adım | Olay | | Ek parametreler |
|---|---|---|---|
| ihale açıldı | `ihale_open` | eski | |
| panel açıldı (görüldü) | `ihale_view` | yeni | ihale + katılım durumu başına oturumda bir kez; ihale yokken `phase = none` |
| teklif / vekâlet | `ihale_proxy` | eski | `nth` (1 = ilk teklif, 2+ = yükseltme), `lead` (`me rv`) |
| son düzlükte geçildi | `ihale_passed` | yeni | |
| sonuç | `ihale_close` | eski | `result` (`won lost`), `paid_x` |
| köşe başı seçimi açıldı | `kose_open` | yeni | `kp` bekleyen damga |
| köşe başı yerleştirildi | `ihale_kose` | eski | `district`, `city`, `tier` |

Kazandı / kaybetti ayrı ad değildir: `ihale_close` + `result` (katılmayan için `joined = 0`).

### Banka, kur, bilanço (açıldı → sekme → aktarım → bölge geçişi)

Ortak: `from` (oynanan bölge).

| Adım | Olay | | Ek parametreler |
|---|---|---|---|
| panel açıldı | `bank_open` | yeni | `tab`, `unlocked` 0/1; oturumda bir kez |
| sekme | `bank_tab` | yeni | `tab` (`send fx bil`) |
| aktarım | `bank_transfer` | yeni | `to`, `amt_e`, `got_e`, `held` (emanete 0/1), `cap_pct` (aktarım sonrası günlük hak kullanımı), `cash_pct` (kasanın payı), `nth` |
| aktarım olmadı | `bank_fail` | yeni | `to`, `why` (`closed same cash cap busy save`), `amt_e` |
| emanet teslim alındı | `bank_claim` | yeni | `amt_e` |
| bilanço para birimi | `bank_cur` | yeni | `cur` |
| havale kartından bölgeye geçiş | `bank_go` | yeni | `to` (ardından eski `switch_region`) |

Ülke fiyat seviyeleri için ayrı olay yoktur: `region` kullanıcı özelliği ve `bank_transfer` `from → to` çifti kırılım verir
(eski `start_region`, `switch_region` olayları sürer).

### Sistem kilitleri ve ilk dakikalar (her biri kayıt başına bir kez)

| Olay | | Parametreler |
|---|---|---|
| `sys_unlock` | yeni | `sys` (`tenant project ihale bank`), `play_min`, `own` |
| `ms_first_build` | yeni | `play_min` (oyun süresi, dakika), `own` |
| `ms_first_collect` | yeni | aynı |
| `ms_district_full` | yeni | aynı (ilk semtin son arsası teslim) |
| `ms_second_deed` | yeni | aynı (2. tapu / kapora) |
| `ms_first_tenant` | yeni | aynı (ilk anahtar) |
| `ms_first_project` | yeni | aynı |
| `ms_first_auction` | yeni | aynı (ilk vekâlet) |
| `ms_first_transfer` | yeni | aynı |

Onboarding hunisi: `start_city` → `ms_first_build` → `ms_first_collect` → `ms_district_full` → `ms_second_deed` → … (`play_b` ile "ilk N dakikada" kırılımı).

## Pano ve karar rehberi (Remote Config)

Eşikler başlangıç önerisidir; ilk iki haftanın verisiyle güncellenmeli. Her kararda `region` ve `own_b` kırılımına bakın; A/B için
Remote Config koşulunu kullanıcı özelliğiyle kurun. Değerler `remote.ts` sınırından geçer (varsayılanın 1/10'u – 10 katı).

| Gösterge (olay / parametre) | Sağlıklı | Sapma → bakılacak anahtar |
|---|---|---|
| Anahtar oranı = `tenant_settle` / `tenant_arrive` | %45–70 | < %45: `TEN_WAIT` ↑, `TEN_AFFORD_SEC` ↓ (daha kolay istek), `TEN_TIME_MAX` ↓ · > %80: istekler fazla kolay, `TEN_BONUS` ↓ ya da `TEN_MIN/TEN_MAX` ↑ |
| `tenant_leave` `st = ready` payı | < %10 | yüksekse oyuncu anahtarı kaçırıyor: `TEN_READY` ↑ |
| `tenant_leave` `st = wait`, `wish` kırılımı | tür başına < %50 | tek tür öne çıkıyorsa o isteğin ağırlığı (`TEN_TRAITS`, veri) ya da `TEN_AFFORD_SEC` |
| `tenant_ready.wait_b` ortancası | `TEN_WAIT`'in %30–70'i | çoğu son dakikada: `TEN_NOTE` ↑ · çoğu ilk dakikada: istek zaten karşılanmış geliyor |
| Kart açma = `tenant_open` / `tenant_arrive` | > %60 | düşükse tanıtım / rozet görünürlüğü (denge değil, arayüz) |
| `late = 1` anahtar oranı | %35–60 | düşük: `TEN_PJ_AFFORD_SEC` ↑, `TEN_RV_FEE_SEC` ↓, `TEN_RV_PCT` ↓ · sıklık: `TEN_LATE_GAP` |
| Proje dönüşümü = `project_start` / `project_card` | > %50 | `afford = 0` payı yüksekse `PJ_COST_PCT` ↓ · kart → başlat düşük ve `afford = 1` ise ödül zayıf: `PJ_X1` ↑ |
| `project_offer` → `project_select` | > %40 | düşükse teklif fark edilmiyor (arayüz); `sys_unlock sys=project` → `project_offer` arası uzunsa `PJ_MINLV` ↓ |
| 2. etap = `project_stage2` / `project_done st=1` | %30–60 | düşük: `PJ_COST2` ↓ ya da `PJ_X2` ↑ · `project_split` > %5: pişmanlık, `PJ_TIME_PCT` / `PJ_TIME2` ↓ |
| İhale katılımı = `ihale_proxy nth=1` / `ihale_open` | > %35 | düşük: `IH_LM_OPEN` / `IH_ARSA_OPEN` ↓ (açılış ucuzlar) |
| Kazanma oranı = `ihale_close result=won` / `joined=1` | %40–60 | < %40: `IH_LM_K` / `IH_ARSA_K` ↓, `IH_EARLY` ↑ (rakip niyetini erken belli eder) · > %65: K ↑ |
| `ihale_passed` → sonraki `ihale_proxy` | > %30 | düşükse son düzlük kısa: `IH_LATE_MS` ↑ |
| `ihale_close.paid_x` ortancası | 1.5–3 | > 3: ödül pahalıya gidiyor, `IH_NOISE` / `IH_MOOD` ↓ |
| `ihale_kose` / (`ihale_close result=won kind=arsa`) | > %90 | düşükse köşe başı seçimi akışı (arayüz) |
| Banka kullanımı = `bank_transfer` kullanıcıları / `sys_unlock sys=bank` | %15–35 | düşük: `BANK_FEE` ↓, `BANK_OPEN_EARN` ↓ · çok yüksek ve `cash_pct` hep 50: `BANK_SRC_SHARE` ↓ |
| `bank_transfer.cap_pct ≥ 90` payı | < %40 | yüksek: hak dar, `BANK_RENT_MIN` / `BANK_FLOOR` ↑ · `bank_fail why=cap` aynı işaret |
| `bank_transfer held=1` → `start_city` (yeni bölge) | > %50 | düşük: emanet başlangıcı çekici değil, `BANK_FLOOR` ↑ |
| `bank_tab tab=fx` ardından `bank_transfer` | bilgi | kur ipucu etkisi: `BANK_TIP_PCT`; makas `BANK_SPREAD` |
| `ms_first_build.play_min` ortancası | ≤ 1 dk | uzunsa ilk açılış akışı (dil / bölge / şehir kartları) |
| `ms_district_full.play_min` ortancası | 15–30 dk | uzun: erken bina süre / bedelleri; 1. gün elde tutma ile birlikte okuyun |
| `ms_second_deed` / `ms_district_full` | > %70 | düşük: 2. semt bedeli ya da kapora tanıtımı (`KAPORA_*`) |
| `sys_unlock sys=tenant` → `ms_first_tenant` | > %60, ≤ 15 dk | düşük: `TEN_FIRST` ↓, `TEN_UNLOCK_EARN` / `TEN_UNLOCK_PROD` |

## Onam ve gizlilik

- Analitik yalnız telefon paketinde çalışır. Kodda analitik için ayrı bir onam kapısı yoktur; AB / Birleşik Krallık'ta reklam onam
  formu (UMP, `ads.ts`) açılışta sorulur, iOS'ta ATT ardından istenir. Bu adım o davranışı değiştirmez.
- Yeni olaylar gizlilik metnindeki "Oyun içi olaylar → Firebase Analytics → Oyunu geliştirmek" satırının kapsamındadır (kişisel
  veri eklenmedi). Kullanıcı özellikleri (bölge, dil, satın alma durumu kovası) için metne kısa bir ek önerilir; bkz. adım raporu.

## Test

- Birim: `tests/unit/funnel.test.ts` (adlar ve parametreler Firebase kurallarına uyar, her adım doğru olayı bir kez gönderir,
  bir-kez olaylar tekrar etmez, hız sınırı, temizlik, eski kayıt işaretleme, bu belgeyle ad eşleşmesi).
- Uçtan uca: önizleme paketinde `window.__tapuTest.events()` gönderilen olayları (`{ name, params }`; kullanıcı özellikleri
  `$props` adıyla) döndürür; `tests/iyilestirme.cjs` bölüm 22.
