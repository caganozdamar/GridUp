# Scalability — 100 Panel / Field Module Ölçeği (Aşama 8)

Bu doküman, GRID UP'ın 100 panel/modül başlangıç ölçeğini nasıl
karşılayabileceğini, hem **ölçülmüş bir yazılım benchmark'ı** hem de
**field module ölçek mimarisi** açısından açıklar.

## Measured prototype result

Aşağıdaki sayılar, `apps/api/scripts/scada-scale-test.mjs` script'i ile
**gerçek, çalışan** bir API'ye (`npm run dev:api`) ve gerçek Postgres'e karşı,
2026-09-20'de yeniden çalıştırılarak elde edilmiştir. Script; 100 geçici pano
ve **pano başına 6 sensör (toplam 600)** oluşturur (ambient/kablo sıcaklığı,
nem, akım, ark flaş, akustik; hepsi normal çalışma aralığında, alarm üretmez),
`POST /readings/batch`'e 5 tick boyunca gerçek istek gönderir (Risk Engine
hesaplaması dahil), süreleri ölçer ve sonunda oluşturduğu her şeyi siler. Test
sonrası `SCALE-TEST-*` kaydı kalmadığı doğrulanmıştır.

Test iki gönderim biçimini ölçer, çünkü API tek istekte en fazla 500 reading
kabul eder ve bir tick artık 600 reading'dir:

- **Mod A — gateway:** Tüm panoların okumaları 500'lük parçalarla (2 istek),
  sırayla gönderilir. Birden fazla modülü aggregate eden bir local gateway'i
  temsil eder.
- **Mod B — modüller:** 100 modülün her biri kendi 6 reading'lik küçük
  batch'ini gönderir, 100 istek aynı anda başlar. Firmware'in gerçek
  davranışıdır ve en kötü durumdur: sahada modüllerin tick'leri senkron olmaz.

```
============================================================
RESULTS (real measurements, POST /readings/batch, incl. risk analysis)
============================================================
100 panels | 600 sensors | 600 readings/tick | 5 ticks per mode
Mode A (gateway, 500-reading chunks):
  Requests/tick         : 2
  Total readings sent   : 3000
  Total inserted        : 3000
  Failed ticks          : 0
  Average tick time     : 1481.9 ms
  Min / Max tick time   : 1270.8 ms / 1695.3 ms
Mode B (100 modules, concurrent):
  Requests/tick         : 100
  Total readings sent   : 3000
  Total inserted        : 3000
  Failed ticks          : 0
  Average tick time     : 206.2 ms
  Min / Max tick time   : 182.1 ms / 243.7 ms
============================================================
```

Her iki mod da varsayılan 2 saniyelik örnekleme aralığının (firmware
`CONFIG_GRIDUP_SAMPLE_INTERVAL_MS`) altında tamamlanmıştır. Önceki ölçüm
(4 sensör, tek 400'lük batch: ortalama 1006.9 ms) ile karşılaştırıldığında Mod A,
reading sayısıyla yaklaşık doğrusal ölçeklenir.

> **Bu bir production garantisi DEĞİLDİR.** Bu, tek bir geliştirme
> makinesinde, tek bir çalıştırmada elde edilen bir **prototip
> benchmark'ıdır**. Ölçüm sırasında arka planda başka bir veri üreticisi
> (simulator/Wokwi) çalışıp çalışmadığı kayıt altına alınmamıştır. Sahada
> gerçek ağ gecikmesi, Wi-Fi kayıpları ve uzun süreli yük ayrıca ölçülmelidir.
> Production'da gerçek 100+ panolu saha verisiyle sürekli yük testi
> yapılmalıdır.

### Bilinen sınırlama: geçici bağlantı hatası

Bu doküman için testi ilk çalıştırdığımızda (2026-09-19, 4 sensörlü sürüm), ilk tick'te bir `fetch failed`
/ `ECONNRESET` hatası alındı; script `finally` bloğu sayesinde oluşturduğu
fixture'ları yine de temizledi ve ikinci çalıştırmada test sorunsuz
tamamlandı. Bu, geliştirme ortamında ara sıra görülebilen geçici bir
bağlantı sıçraması olarak not edilmiştir; kalıcı bir hata değildir (bkz.
[code-freeze.md](code-freeze.md) "Known limitations").

## Mimari: 100 modülden GRID UP On-Premise'a

```
     100 Field Modules
            │
            ▼
  one or more Local Gateways
            │
            ▼
     Private Network
            │
            ▼
   GRID UP On-Premise
            │
   ┌────────┼────────┐
   ▼        ▼         ▼
Dashboard  Notifications  SCADA Gateway
```

Bu mimaride 100 pano için **100 pahalı Linux bilgisayar/Raspberry Pi**
yaklaşımından kaçınılır (bkz. [field-module.md](field-module.md) "Field
Communication Architecture"):

- **Field Module:** Düşük maliyetli, mikrokontrolör sınıfı bir cihaz —
  sadece kendi panosunun 6 sensöründen veri toplar ve iletir.
- **Local Gateway:** Birden fazla Field Module'ü aggregate edebilen, saha
  içinde birkaç adet bulunması yeterli olan bir cihaz/bilgisayar.
- **GRID UP On-Premise:** Bugünkü mevcut backend mimarisi — ölçek
  büyüdükçe **değişmeyen** taraf.

## Backend tarafında ölçeği destekleyen mevcut tasarım kararları

- **Windowed analysis:** Risk Engine, her panoyu son `ANALYSIS_WINDOW_SIZE`
  (10) reading'lik pencereyle değerlendirir — tüm geçmişi taramaz (bkz.
  `apps/api/src/risk-engine/risk-engine.config.ts`).
- **Sadece etkilenen panolar analiz edilir:** `ReadingsService.createBatch`,
  tüm veritabanını değil, yalnızca o batch'teki `sensorId`'lerin ait olduğu
  panoları `riskEngineService.analyzePanels(affectedPanelIds)` ile analiz
  eder.
- **Batch limiti:** `POST /readings/batch` tek istekte en fazla 500 reading
  kabul eder (`MAX_BATCH_SIZE`). Bir modül tick başına 6 reading gönderir;
  firmware'in 32 tick'lik tamponu en kötü durumda 192 reading'dir, yani sınırın
  altındadır. Ancak 100 panelin okumalarını tek istekte toplayan bir gateway
  100 × 6 = 600 reading üretir ve sınırı **aşar**: gateway 500'lük parçalara
  bölmelidir (ölçek testinin Mod A'sı bunu yapar).
- **İndeksli sorgular:** `SensorReading` tablosu zaman bazlı sorgular için
  indekslenmiştir (bkz. `apps/api/prisma/schema.prisma`); ileride time-series
  optimizasyonu (örn. partitioning) değerlendirilebilir (bkz.
  architecture.md "Gelecek Genisleme Noktalari").
- **SCADA tarafında collision-free adresleme:** Modbus register haritası
  100 panoya kadar (1000 register) collision'siz çalışacak şekilde
  tasarlanmıştır (bkz. [modbus-register-map.md](modbus-register-map.md)).

## İlgili dosyalar

| Dosya | İçerik |
| ----- | ------ |
| `apps/api/scripts/scada-scale-test.mjs` | Ölçek testinin kaynak kodu |
| [field-module.md](field-module.md) | Field Communication Architecture (Local Gateway kavramı) |
| [modbus-register-map.md](modbus-register-map.md) | 100 pano register haritası |
| [final-architecture.md](final-architecture.md) | Uçtan uca mimari |
