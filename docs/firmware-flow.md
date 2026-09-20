# Firmware Akış Diyagramı — Field Module (ESP32)

Bu doküman, `firmware/` altındaki C kodunun çalışma mantığını gösterir
(hackathon brief'i, Teknik Çıktılar madde 3). Diyagramlar koddan çıkarılmıştır:
`firmware/esp32/main/main.c`, `firmware/core/module.c`,
`firmware/esp32/main/sensors_hw.c`, `firmware/core/provision.c`.

Kod iki katmana ayrılmıştır: **platforma bağımsız çekirdek** (`firmware/core`,
PC'de sahte HAL ile birim testli) ve **ESP32 katmanı** (`firmware/esp32`:
Wi-Fi, HTTP, SNTP, DHT22, ADC, GPIO).

## 1. Açılış (`app_main`)

```mermaid
flowchart TD
    A([Güç verildi / reset]) --> B[NVS başlat<br/>Wi-Fi kalibrasyon verisi için]
    B --> C[GPIO: LED çıkışları, buton girişi<br/>ISR ile debounce 250 ms]
    C --> D[ADC1 kanallarını hazırla<br/>GPIO34 / 35 / 32 / 33]
    D --> E[Wi-Fi istasyon modu başlat]
    E --> F[Mod = HARDWARE<br/>gerçek sensörler okunur]
    F --> G[module_run: ana döngü]
```

## 2. Ana döngü (her tick, varsayılan aralık `CONFIG_GRIDUP_SAMPLE_INTERVAL_MS`)

```mermaid
flowchart TD
    S([tick başı]) --> BTN{Butona basıldı mı?}
    BTN -- evet --> MODE[Sonraki moda geç<br/>HARDWARE → 6 demo senaryosu → HARDWARE]
    BTN -- hayır --> RD
    MODE --> RD[Sensörleri oku]
    RD --> OK{Okuma başarılı mı?}
    OK -- hayır --> SKIP[Log: okuma başarısız,<br/>tick atlanır] --> SLEEP
    OK -- evet --> TS[SNTP ile zaman damgası al]
    TS --> PUSH[Okumayı yerel tampona ekle<br/>en fazla 32 tick]
    PUSH --> PROV{Provizyon<br/>yapıldı mı?}
    PROV -- hayır --> DUE{Yeniden deneme<br/>zamanı geldi mi?<br/>her 5 tickte bir}
    DUE -- hayır --> LED
    DUE -- evet --> DISC[GET /panels<br/>panel + sensör ID eşleşmesi]
    DISC --> DOK{Başarılı mı?}
    DOK -- evet --> FL
    DOK -- hayır --> LED
    PROV -- evet --> FL[Tamponu POST /readings/batch ile gönder]
    FL --> LED[LED'leri güncelle]
    LED --> SLEEP[Bir sonraki tick'e kadar bekle]
    SLEEP --> S
```

**LED mantığı** (`on_tick` in `main.c`):

| LED | Pin | Yanma koşulu |
| --- | --- | ------------ |
| Yeşil (STATUS) | GPIO26 | Son gönderim sunucu tarafından kabul edildi |
| Kırmızı (ALARM) | GPIO27 | Herhangi bir kanal kritik banda girdi (`sensors_in_critical_band`): kablo ≥ 75 °C, nem ≥ %80, akım ≥ 150 A, ark flaş ≥ %30, akustik ≥ 70 dB. Ortam sıcaklığı hariç |

## 3. Sensör okuma (`sensors_hw_read`, HARDWARE modu)

```mermaid
flowchart LR
    R([okuma]) --> DHT[DHT22 GPIO4<br/>ortam sıcaklığı + nem]
    R --> NTC[GPIO34: NTC<br/>8 örnek ortalaması<br/>Steinhart-Hart → °C]
    R --> CT[GPIO35: CT / pot<br/>8 örnek ortalaması<br/>doğrusal → 0-250 A]
    R --> LDR[GPIO32: LDR<br/>8 örnek ortalaması<br/>doğrusal → 0-100 %]
    R --> MIC[GPIO33: ses sensörü<br/>64 örnekli seri<br/>RMS sapma → 40-100 dB]
    DHT --> ST[(sensor_state_t<br/>6 kanal)]
    NTC --> ST
    CT --> ST
    LDR --> ST
    MIC --> ST
```

Okunamayan kanal `NaN` olur; `NaN` kanallar payload'a yazılmaz ve kritik-bant
değerlendirmesinde yok sayılır. DHT22 hatası tüm turu iptal etmez, yalnızca o
iki kanal `NaN` kalır.

## 4. Gönderim ve hata yönetimi (`flush`)

```mermaid
flowchart TD
    F([flush]) --> B[Tampondan JSON batch oluştur]
    B --> SZ{Boyut sınırı<br/>aşıldı mı?}
    SZ -- evet --> DROP1[Tamponu at, logla] --> RET0([başarısız])
    SZ -- hayır --> E0{Okuma sayısı 0?}
    E0 -- evet --> CLR0[Tamponu temizle] --> RET1([başarılı])
    E0 -- hayır --> POST[POST /readings/batch]
    POST --> ST{Sonuç}
    ST -- "ağ hatası<br/>veya HTTP 5xx" --> KEEP[Veriyi tamponda tut,<br/>sonraki tick'te tekrar dene] --> RET0
    ST -- "HTTP 4xx" --> DROP2[Batch'in kendisi hatalı:<br/>at, tekrar deneme] --> RET0
    ST -- "HTTP 2xx" --> CLR[Tamponu temizle] --> RET1
```

**Tasarım kararları:**

- **Sunucu yokken de çalışır.** Modül açılışta API'yi bulamazsa örneklemeye ve
  tamponlamaya devam eder; bağlanınca birikeni tek batch'te yollar. Tampon
  ESP32 derlemesinde 32 tick'tir (`BUFFER_CAPACITY`); dolunca en eski kayıt
  düşer ve sayaçta tutulur (sınırlı bellek).
- **Yeniden deneme seyrek.** Provizyon denemesi HTTP zaman aşımı kadar
  bloklayabildiği için her 5 tickte bir yapılır; ölü bir sunucu örneklemeyi
  durdurmaz.
- **4xx yeniden denenmez.** Hatalı bir batch sonsuza kadar tekrar gönderilmez.
- **Yalnızca sensörden merkeze.** Modülde röle/kesici gibi bir çıkış yoktur
  (bkz. [field-module.md](field-module.md)); LED'ler yalnızca yerel göstergedir.

## 5. Demo modları (butona basınca)

Buton (GPIO25) modu sırayla değiştirir: `HARDWARE` (gerçek sensörler) →
`NORMAL` → `OVERHEATING` → `OVERCURRENT` → `HIGH_HUMIDITY` → `ARC_FLASH` →
`COMBINED_FAILURE` → tekrar `HARDWARE`. Demo modlarında değerler sentetik
kaynaktan gelir ve mod değişimi seri konsola `[mode] DEMO: ... (not real sensor
data)` olarak yazılır; sentetik veri gerçek ölçüm gibi sunulmaz.

## Doğrulama durumu

Çekirdek mantık (provizyon, tampon, 4xx/5xx, sunucu yokken açılış, başarısız
okuma) sahte HAL ile birim testlidir (`make test` in `firmware/`). Aynı akış
Wokwi simülasyonunda çalıştırılmıştır (bkz.
[../firmware/wokwi/README.md](../firmware/wokwi/README.md)). Gerçek kartta ve
gerçek sensörlerle denenmemiştir.

## İlgili dosyalar

| Dosya | İçerik |
| ----- | ------ |
| [electronic-design.md](electronic-design.md) | Devre şeması, pin ve bileşen tablosu |
| [hardware-architecture.md](hardware-architecture.md) | Blok diyagram (konsept) |
| [field-data-contract.md](field-data-contract.md) | Modülün gönderdiği payload biçimi |
