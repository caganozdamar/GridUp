# Scalability — 100 Panel / Field Module Ölçeği (Aşama 8)

Bu doküman, GRID UP'ın 100 panel/modül başlangıç ölçeğini nasıl
karşılayabileceğini, hem **ölçülmüş bir yazılım benchmark'ı** hem de
**field module ölçek mimarisi** açısından açıklar.

## Measured prototype result

Aşağıdaki sayılar, `apps/api/scripts/scada-scale-test.mjs` script'i ile
**gerçek, çalışan** bir API'ye (`npm run dev:api`) ve gerçek Postgres'e karşı,
bu doküman yazılırken (2026-09-19) yeniden çalıştırılarak elde edilmiştir.
Script; 100 geçici pano + 400 sensör oluşturur, `POST /readings/batch`'e 5
tick boyunca gerçek istek gönderir (Risk Engine hesaplaması dahil), süreleri
ölçer ve sonunda oluşturduğu her şeyi siler — mevcut 5 demo panosu
(PANO-001..005) bu test sırasında ve sonrasında **değişmeden** kaldığı
doğrulanmıştır.

```
============================================================
RESULTS (real measurements, POST /readings/batch, incl. risk analysis)
============================================================
100 panels | 400 sensors | 400 readings/tick | 5 ticks
Total readings sent   : 2000
Total inserted        : 2000
Failed ticks          : 0
Average batch time    : 1006.9 ms
Min / Max batch time  : 923.5 ms / 1052.4 ms
============================================================
```

> **Bu bir production garantisi DEĞİLDİR.** Bu, tek bir geliştirme
> makinesinde, tek bir çalıştırmada elde edilen bir **prototip
> benchmark'ıdır**. Bu test aynı zamanda geliştirme ortamındaki NORMAL
> senaryolu 5 demo panosunu besleyen canlı bir simulator'ın da çalıştığı
> bir arka planda ölçülmüştür (yani izole olmayan, gerçekçi bir eşzamanlı
> yük koşuludur) — ancak yine de tek makine/tek çalıştırma sonucudur.
> Production'da gerçek 100+ panolu saha verisiyle, gerçek network
> koşullarında sürekli yük testi yapılmalıdır.

### Bilinen sınırlama: geçici bağlantı hatası

Bu doküman için testi ilk çalıştırdığımızda, ilk tick'te bir `fetch failed`
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
  sadece kendi panosunun 4 sensöründen veri toplar ve iletir.
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
  kabul eder (`MAX_BATCH_SIZE`); 100 panel × 4 sensör = 400 reading/tick bu
  sınırın altındadır. Daha büyük ölçeklerde (örn. 150+ panel) saha tarafının
  isteklerini birden fazla batch'e bölmesi gerekir.
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
