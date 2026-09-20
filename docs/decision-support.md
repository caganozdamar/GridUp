# Decision Support / Early Warning Intelligence (Aşama 9)

Bu doküman, Aşama 9 kapsamında eklenen decision-support katmanını açıklar:
**Time-to-Critical estimate**, **Recommended Actions**, **Sensor/Panel Data
Health**, **Panel Event Timeline** ve **Operational Metrics**.

Bu aşama yeni bir altyapı kurmaz. Risk score formülü, threshold'lar,
simulator matematiği, alarm/anomaly lifecycle'ı, notification mapping'i,
Modbus register haritası ve SCADA Gateway davranışı **değiştirilmemiştir**.
Aşağıdaki tüm özellikler, mevcut `RiskScore` / `Anomaly` / `Alarm` /
`Notification` / `SensorReading` kayıtlarından **derived** (türetilmiş),
salt-okunur bir katmandır — kaynak: `apps/api/src/decision-support/`.

## Kritik netlik

Bu sistem **Machine Learning / AI değildir**. Tamamı deterministic,
açıklanabilir, kural/trend tabanlı bir hesaplamadır. Bu dokümanda ve UI'da
kasıtlı olarak şu ifadeler **kullanılmaz**: "AI-powered", "AI predicts
failures", "machine learning predicts failure", "confidence %X",
"prevented fires/failures/outages", "money saved". Bunun yerine: "trend-based
early warning", "deterministic anomaly detection", "trend-based critical
threshold estimate", "decision-support guidance".

---

## A) Time-to-Critical / Critical Threshold Estimate

Kaynak: [`trend-estimate.util.ts`](../apps/api/src/decision-support/trend-estimate.util.ts),
config: [`decision-support.config.ts`](../apps/api/src/decision-support/decision-support.config.ts).

### Hesaplama

`PanelsService.getRisk` içinde, panel için son `TREND_SAMPLE_WINDOW` (varsayılan
10) `RiskScore` kaydı `calculatedAt` sırasına göre okunur. CRITICAL threshold,
yeni bir yerde hard-code edilmez; `@grid-up/shared`'daki
`RISK_LEVEL_THRESHOLDS[CRITICAL].min` (mevcut risk-engine seviyesi, bkz.
`packages/shared/src/risk.ts`) değerinden okunur.

1. En eski ve en yeni örnek arasındaki `riskSlopePerMinute` (risk puanı /
   dakika) hesaplanır (doğrusal — iki uç nokta arası eğim).
2. `remaining = CRITICAL_THRESHOLD - currentScore`
3. `estimatedMinutesToCritical = remaining / riskSlopePerMinute` (yalnızca
   eğim pozitif ve anlamlıysa).

### Guard'lar (sırasıyla uygulanır)

| Guard | Davranış |
| ----- | -------- |
| Örnek yok / `TREND_MIN_SAMPLES`'dan az (varsayılan 3) | `INSUFFICIENT_DATA` — "Insufficient trend data." |
| Güncel skor zaten CRITICAL threshold'unda/üstünde | `CRITICAL` — "Critical threshold reached." |
| Pencerenin kapsadığı süre `TREND_MIN_OBSERVATION_MS`'den (varsayılan 3000ms) kısa | `INSUFFICIENT_DATA` |
| Eğim `TREND_NOISE_SLOPE_PER_MINUTE`'ın (varsayılan 1 puan/dk) altında/negatif | `STABLE` — "No critical escalation trend." |
| Tahmini süre `TREND_MAX_DISPLAY_HORIZON_MINUTES`'i (varsayılan 60dk) aşıyor | `STABLE` — "No near-term critical escalation." |
| Yukarıdakilerin hiçbiri | `RISING` — `estimatedMinutesToCritical` dolu |

Bu guard'lar, "0.01 puan/dakika eğimle 4800 dakika sonra kritik" gibi anlamsız
tahminlerin gösterilmesini engeller.

### Trend Quality (LOW / MEDIUM / HIGH)

**ML confidence değildir**, hiçbir yüzde/olasılık üretilmez. Sadece üç
deterministic kriterden türetilen bir sınıflandırmadır:

- örnek sayısı (`sampleCount`)
- gözlem süresi (`durationMs`)
- **slope consistency**: ardışık örneklerin ne kadarının genel eğim yönüyle
  tutarlı olduğu (0-1 oran) — bkz. `computeConsistency`.

Üç kriter de HIGH eşiklerini geçerse `HIGH`, MEDIUM eşiklerini geçerse
`MEDIUM`, aksi halde `LOW` döner. Eşikler `decision-support.config.ts`'de
env ile ayarlanabilir.

### API response

`GET /panels/:id/risk` yanıtına backwards-compatible bir alan eklenir
(`latest`/`history` değişmez):

```jsonc
{
  "latest": { /* değişmedi */ },
  "history": [ /* değişmedi */ ],
  "trendEstimate": {
    "status": "INSUFFICIENT_DATA" | "STABLE" | "RISING" | "CRITICAL",
    "riskSlopePerMinute": number | null,
    "estimatedMinutesToCritical": number | null,
    "message": string,
    "quality": "LOW" | "MEDIUM" | "HIGH" | null
  },
  "recommendedActions": [ /* bkz. B */ ]
}
```

### Limitations

- Doğrusal ekstrapolasyondur; ani/step-function davranışlarda (örn. demo
  `COMBINED_FAILURE` senaryosu, bkz. aşağıdaki "Bilinen demo sınırlaması")
  `RISING` durumu çok kısa süre görünebilir veya hiç görünmeyip doğrudan
  `CRITICAL`'a geçebilir.
- Bir arıza tahmini/kestirimi (failure prediction) **değildir** — yalnızca
  "mevcut trend aynen devam ederse" varsayımına dayanan bir projeksiyondur.
  UI'da bu, sabit bir uyarı cümlesiyle belirtilir: *"Estimate assumes the
  recent trend continues and is not a failure prediction."*

---

## B) Recommended Actions

Kaynak: [`recommended-actions.util.ts`](../apps/api/src/decision-support/recommended-actions.util.ts),
mapping: [`recommended-actions.config.ts`](../apps/api/src/decision-support/recommended-actions.config.ts).

### Mapping

`AnomalyType` enum değerleri `@grid-up/shared`'dan (Prisma schema ile senkron)
birebir kullanılır; uydurma enum yoktur.

| `AnomalyType` | Recommended action mesajı |
| ------------- | -------------------------- |
| `HIGH_TEMPERATURE` | "Inspect cable terminations, connection points and local heat sources." |
| `TEMPERATURE_RISE` | "Check for increasing load or developing thermal hotspots." |
| `OVERCURRENT` | "Inspect conductor loading and compare current with expected operating conditions." |
| `HIGH_HUMIDITY` | "Inspect enclosure moisture, ventilation and environmental sealing." |
| `ARC_FLASH` | "Maintain safe distance and inspect for visible arc damage, tracking marks or insulation breakdown from outside the enclosure before any further action." |
| `PARTIAL_DISCHARGE` | "Inspect insulation surfaces and connection points for partial discharge indicators and consider scheduling an acoustic/ultrasonic emission survey." |
| `MULTI_SENSOR_RISK` | "Prioritize inspection: multiple sensor conditions are increasing simultaneously." |

`ARC_FLASH`/`PARTIAL_DISCHARGE`, decision-support katmanından *sonra* ana
branch'e eklenen arc flash / partial discharge (acoustic) risk motoruyla
birlikte gelen `AnomalyType` değerleridir (bkz. project-status.md); mapping
tablosu bu iki değeri de kapsayacak şekilde genişletildi, aksi halde
`Record<AnomalyType, string>` derlenmezdi.

Mesajlar mevcut risk-engine flag'lerinden (`RiskFlags` —
`highTemperature`/`temperatureRise`/`overcurrent`/`highHumidity`/
`arcFlash`/`partialDischarge`/`multiSensorRisk`) üretilir; bunlar
`RiskEngineService`'in zaten hesapladığı ve `Anomaly` olarak persist ettiği
ile **aynı** flag'lerdir. Risk engine'in kendisi değiştirilmez, yalnızca aynı
bilgiden salt-okunur bir türetim yapılır.

### Priority

| Aktif flag'in bağlı olduğu component skorunun risk seviyesi | Priority |
| ------------------------------------------------------------ | -------- |
| CRITICAL | `URGENT` |
| HIGH | `PROMPT` |
| WARNING / NORMAL | `ROUTINE` |

Bu yalnızca UI/decision-support metadata'sıdır — severity/risk lifecycle'ı
değiştirmez.

### Action safety

Tüm mesajlar **inspection-oriented, non-invasive, monitoring-oriented**'dır.
Şunlar hiçbir zaman önerilmez: energized ekipmana müdahale, breaker
aç/kapat, protection relay ayarı değiştirme, canlı iletkene dokunma, bypass,
equipment control. Bu, `recommended-actions.util.spec.ts`'de yasaklı terim
listesiyle (breaker, bypass, energiz-, live conductor, relay setting,
switch on/off, open/close the...) test edilir. UI'da sabit bir not gösterilir:
*"Inspection guidance only. Follow authorized electrical safety
procedures."*

### API response

`GET /panels/:id/risk` yanıtındaki `recommendedActions` alanı:

```jsonc
[
  { "source": "OVERCURRENT", "priority": "URGENT", "message": "Inspect conductor loading and compare current with expected operating conditions." }
]
```

---

## C) Sensor / Panel Data Health

Kaynak: [`data-health.util.ts`](../apps/api/src/decision-support/data-health.util.ts),
servis: [`decision-support.service.ts`](../apps/api/src/decision-support/decision-support.service.ts).

Fikir, SCADA Gateway'deki stale-data mekanizmasından
(`apps/scada-gateway/src/encode.ts` → `isSnapshotFresh`) alınmıştır, ancak
register-encoding logic'i kopyalanmamıştır — bu, panel seviyesinde bağımsız,
küçük bir derived model'dir.

### Mantık

Panelin **aktif** sensörlerinin (`Sensor.isActive`) en son
`SensorReading.timestamp`'ine bakılır (`DISTINCT ON` ile batched — N+1 yok).

| Durum | Sonuç |
| ----- | ----- |
| Panelin hiç sensörü yok, veya hiçbir sensöre hiç reading gelmemiş | `NO_DATA` |
| En az bir sensörün son okuması `staleMs`'den eski | `STALE` |
| Tüm sensörlerin son okuması `staleMs` içinde | `VALID` |

`staleMs`, SCADA Gateway'deki `SCADA_DATA_STALE_MS` ile **aynı env
adı/varsayılanı** (`10000`) paylaşır — ayrı bir process olduğu için doğrudan
import edilemez, bu yüzden aynı semantik iki tarafta da korunur.

### API response

- `GET /panels` ve `GET /panels/:id` → her panel objesine `dataHealth`
  eklenir: `{ status, lastSensorUpdate, staleSensorCount }`.
- `GET /panels` için tüm panellerin data health'i **tek seferde** (batched
  sorgu) hesaplanır (`ScadaService.getPanelsSnapshot`'taki N+1-önleme
  deseniyle aynı yaklaşım).

---

## D) Panel Event Timeline

Kaynak: [`timeline.util.ts`](../apps/api/src/decision-support/timeline.util.ts) (saf
türetim fonksiyonu) + [`decision-support.service.ts`](../apps/api/src/decision-support/decision-support.service.ts)
(DB erişimi) + [`panel-timeline.controller.ts`](../apps/api/src/decision-support/panel-timeline.controller.ts).

Yeni bir event database modeli **yoktur**. Mevcut `RiskScore` / `Anomaly` /
`Alarm` / `Notification` kayıtlarından chronological bir event listesi
türetilir.

### Endpoint

```
GET /panels/:panelId/timeline?limit=30
```

- `limit`: opsiyonel, varsayılan `TIMELINE_DEFAULT_LIMIT=30`,
  `TIMELINE_MAX_LIMIT=100`'e clamp edilir (0 veya negatif → 1'e clamp edilir,
  unbounded/unlimited history asla dönmez).
- Bilinmeyen `panelId` → `404`.
- Response newest-first sıralıdır.

### Event type'ları (derived, DB enum değil)

`RISK_LEVEL_CHANGED`, `ANOMALY_DETECTED`, `ANOMALY_RESOLVED`,
`ALARM_CREATED`, `ALARM_RESOLVED`, `NOTIFICATION_SENT`,
`NOTIFICATION_FAILED`.

### Risk level transition derivation

`RiskScore` geçmişindeki **her** kayıt değil, yalnızca gerçek seviye
**transition'ları** event'e çevrilir (örn. NORMAL→WARNING→HIGH→CRITICAL gibi
ardışık aynı-seviye kayıtlar tek bir event'e sıkıştırılır). `PENDING`
bildirimler (henüz teslim edilmemiş/başarısız olmamış) timeline'da
gösterilmez.

### Performans

Her kaynak tablodan (`RiskScore`/`Anomaly`/`Alarm`/`Notification`) sabit bir
üst sınırla (`TIMELINE_RAW_FETCH_CAP=200`) satır çekilir — panelin **tüm**
geçmişi memory'e yüklenmez.

---

## E) Operational / Early Warning Metrics

Kaynak: [`decision-support.service.ts`](../apps/api/src/decision-support/decision-support.service.ts) →
`getOperationalMetrics`, controller:
[`operational-metrics.controller.ts`](../apps/api/src/decision-support/operational-metrics.controller.ts).

### Endpoint

```
GET /metrics/operations
```

```json
{ "earlyWarningsGenerated": 7, "criticalEscalationsDetected": 3, "notificationsDelivered": 8 }
```

### Tanımlar (gerçek DB aggregate query'leri — hard-code değil)

| Metrik | Tanım |
| ------ | ----- |
| `earlyWarningsGenerated` | `Alarm` tablosunda `severity = HIGH` olan kayıt sayısı |
| `criticalEscalationsDetected` | `Alarm` tablosunda `severity = CRITICAL` olan kayıt sayısı |
| `notificationsDelivered` | `Notification` tablosunda `status = SENT` olan kayıt sayısı |

**Kullanılmayan / kanıtlanamayan metrikler:** "Prevented Fires", "Failures
Prevented", "Money Saved", "Outages Prevented" gibi ifadeler bu sistemde
**yoktur** ve kullanılmamalıdır — sistem yalnızca ne kadar erken uyarı/
escalasyon/bildirim ürettiğini sayar, hiçbir sonucu (bir arızanın gerçekten
önlendiğini) iddia etmez.

---

## İlgili dosyalar

| Dosya | İçerik |
| ----- | ------ |
| [demo-script.md](demo-script.md) | Aşama 9 özelliklerini içeren güncel demo akışı |
| [project-status.md](project-status.md) | Implemented vs future matrisi |
| [code-freeze.md](code-freeze.md) | Aşama 9 validation sonuçları |
