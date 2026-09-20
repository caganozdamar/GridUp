# 1600 kVA AG Panel — Deployment Concept (Aşama 8)

Bu doküman, hackathon problem tanımındaki 1600 kVA AG (alçak gerilim) panel
senaryosu için **generic** bir Field Module dağıtım konsepti açıklar.

> **UYARI — bu doküman ne DEĞİLDİR:** Bu, belirli bir gerçek panonun kesin
> montaj talimatı, elektrik projesi veya saha uygulama planı **değildir**.
> Elektrik güvenliği açısından bağlayıcı bir montaj talimatı içermez.
> Gerçek uygulamadan önce panel drawing, üretici gereksinimleri, elektrik
> güvenliği incelemesi ve saha mühendisliği onayı **zorunludur**.

## Generic konsept

```
1600 kVA AG PANEL
│
├─ Ambient sensor        → panonun iç hacminin genel havalandırma/ortam
│                           koşullarını temsil eden bir nokta
│
├─ Cable/surface         → kritik termination / busbar / kablo bölgesi
│  temperature sensor       (seçim, panonun en yüksek termal risk taşıyan
│                            bağlantı noktasına göre yapılır)
│
├─ Current sensing        → seçilen bir giden/gelen iletken (non-invasive,
│                            clamp/split-core yaklaşım)
│
├─ Field Module            → uygun bir düşük gerilim/servis alanı
│                            (bkz. field-installation.md)
│
└─ Communication           → local gateway (bkz. field-module.md "Field
                             Communication Architecture")
```

Bu dört ölçüm noktası, bugünkü çalışan prototipteki dört `SensorType` ile
birebir eşleşir (bkz. [field-module.md](field-module.md)) — yani aynı panel
üzerinde birden fazla Field Module veya birden fazla sensör noktası
(örn. birden fazla kritik kablo bölgesi) production'da değerlendirilebilir,
ancak bu doküman kapsamında **tek bir generic örnek** sunulmuştur.

## TEDAŞ referans verisi (organizatör dokümanları)

Organizatörün sağladığı TEDAŞ-MLZ/2003-06.B AG pano şartnamesi ve 1250-1600 kVA teknik resmi incelenmiştir. Aşağıdakiler **standart tip pano** verisidir; belirli bir üreticinin panosu değildir.

| Özellik | 1600 kVA değeri | Kaynak |
| ------- | --------------- | ------ |
| Boyutlar (G x Y x D) | 1600 x 1500 x 450 mm (tolerans +100/0, +50/0) | EK-II/14 çizimi |
| Ana bara anma akımı | 2312 A | Tablo 3a |
| Ana bara kesiti | 2x(100x10 mm²) kalay kaplı bakır | EK-I/8 Tablo 8 |
| Ana giriş akım trafosu | 2500/5 | EK-I/8 Tablo 8 |
| Besleme çıkışı | 5 adet + 2 yedek, DSYA buşon 250/400 A | EK-I/8 Tablo 8 |
| Beklenen kısa devre akımı | 38 kA etken / 80 kA tepe | Tablo 3b |
| Koruma derecesi | bina içi IP 2X, bina dışı IP 54 | Madde 2.2.2 |
| Ortam (bina içi) | en çok 40 °C, 24 saat ortalaması 35 °C, bağıl nem +40 °C'de %50 / +20 °C'de %90 | Tablo 1 |
| Haberleşme | Enerji analizöründe RS485 + Modbus; üst bölümde modem/haberleşme ünitesi bölmesi | Madde 2.2.8, analizör tablosu |
| Havalandırma | Alt kısımda hava girişi, üst kısımda çıkış; dahili panoların üst kapağında açıklık yok | Madde 2.2.8.5 |

Çizimde (yerleşim, önden görünüm): üst bölümde kompanzasyon, modem ve ölçü bölmeleri; ortada beş sıra DSYA buşon; sağda "T1" etiketli ölçü cihazı (enerji analizörü/sayaç bölgesi); altta en az 400 mm kablo bölgesi.

### Bu verinin GRID UP'a etkisi

- **Modül yerleşimi (öneri, doğrulanmamış):** Field Module, üstteki haberleşme/modem bölmesinin yanında (düşük gerilim tarafında) konumlanabilir; Şartname bu bölmelerin nemden korunmasını ve ayrı yapılmasını ister. Kablo sıcaklık sensörü alttaki kablo bağlantı bölgesine, ortam sıcaklık/nem sensörü panonun orta-üst hacmine yerleştirilebilir.
- **Akım kaynağı:** Panoda zaten Modbus'lu enerji analizörü bulunduğundan akım, ayrı sensör yerine analizörden okunabilir ([sensor-modbus-mapping.md](sensor-modbus-mapping.md)). Analizör akım aralığı 0,2-5,5 A (sekonder), 2500/5 trafo ile primer ≈ 100-2750 A.
- **Sıcaklık eşikleri:** Bina içi ortam en çok 40 °C kabul edilir; ortam sıcaklık eşiklerinin bunu dikkate alması gerekir. Sıcaklık artışı sınırları TS EN 61439-1 Çizelge 8'e göredir (bu belgede değerleri alınmadı).
- **Havalandırma:** Üst kapakta açıklık olmaması, üst bölmede ısı birikimi olabileceği anlamına gelir; ortam sensörünü hava çıkışına yakın koymak yararlıdır (öneri).

### Akım eşikleri anma akımına göre ölçeklenir

Risk motoru akım eşiklerini **panonun anma akımına oranla** hesaplar: `PANEL_RATED_CURRENT_A` (varsayılan 150 A, demo ölçeği). Eşikler yük yüzdesidir: anma akımının yaklaşık %73'üne kadar normal, %87'de yükselen, %100'de yüksek, %113 üzerinde kritik; akım trendi (A/dk) de aynı oranla ölçeklenir. 1600 kVA panoda ana bara anma akımı 2312 A olduğundan API `PANEL_RATED_CURRENT_A=2312` ile çalıştırılır. Bu ayarla organizatörün sentetik verisinin üst değeri (540 A, %23) NORMAL kalır; 2312 A'nın %120'si ise CRITICAL olur.

Simülatör aynı değişkenle akım okumalarını orantılı ölçekler (`PANEL_RATED_CURRENT_A=2312 npm run demo:critical`, kritik senaryoda ~3390 A). Bu değişken API ve simülatörde **aynı** olmalıdır. Ayar tüm panolar için tek değerdir; pano başına anma akımı (veritabanında) yapılmadı. ESP32 firmware'i henüz ölçeklenmemiştir (demo ölçeğinde akım üretir).

## Neden "generic"?

1600 kVA'lık bir AG panonun iç düzeni (kaç çıkış hücresi olduğu, hangi
bara/kablo bölgesinin en kritik olduğu, mevcut serbest montaj alanı) her
panoda ve her üreticide farklıdır. Bu yüzden bu doküman:

- **Yapar:** Hangi tip ölçümün, hangi genel bölgeyle ilişkilendirileceğini
  kavramsal olarak açıklar.
- **Yapmaz:** Belirli bir üretici/model panonun hangi vidasına, hangi
  mesafede, hangi izolasyon sınıfıyla montaj yapılacağını belirtmez.

## Doğrulama gereksinimleri (production öncesi zorunlu)

Gerçek bir 1600 kVA AG panelde Field Module dağıtımı yapılmadan önce
aşağıdakiler doğrulanmalıdır:

- **Panel drawing:** Panonun güncel tek hat şeması ve fiziksel yerleşim
  planı. (TEDAŞ standart yerleşim resmi elimizde; belirli panonun kendi
  şeması ve tek hat şeması hâlâ gerekli.)
- **Manufacturer requirements:** Panel üreticisinin montaj/delme/ek ekipman
  ekleme konusundaki kısıtları ve garanti şartları.
- **Electrical safety review:** Yetkili bir elektrik mühendisi/saha
  güvenlik ekibi tarafından, önerilen sensör konumlarının güvenli mesafe ve
  izolasyon gereksinimlerine uygunluğunun incelenmesi.
- **Field engineering:** Saha ekibinin, kablo güzergahı ve Field Module
  montaj noktasının fiziksel olarak uygulanabilir olduğunu doğrulaması.

## İlgili dosyalar

| Dosya | İçerik |
| ----- | ------ |
| [field-module.md](field-module.md) | Sensör yaklaşımı ve low-risk installation prensipleri |
| [field-installation.md](field-installation.md) | Enclosure/port konsepti |
| [hardware-architecture.md](hardware-architecture.md) | Donanım blok diyagramı |
