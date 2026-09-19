# Field Module Data Contract (Aşama 8)

Bu doküman, saha cihazı (gerçek Field Module veya bugünkü simulator) ile
GRID UP arasındaki veri sözleşmesini iki seviyede tanımlar:

1. **Conceptual field payload** — Field Module'ün "doğal" olarak ne
   göndermesinin mantıklı olacağı (panelCode + moduleId + sensorType bazlı).
2. **Current API ingestion contract** — bugün gerçekten çalışan, test
   edilmiş `POST /readings/batch` sözleşmesi (`sensorId` bazlı).

Bu iki seviye **kasıtlı olarak farklıdır** ve aşağıda bu fark açıkça
belirtilmiştir. Bu doküman, mevcut API'yi değiştirmez.

## 1. Conceptual field payload

Sahada bir Field Module, kendi bakış açısından "ben PANO-003'teyim, benim ID'm
FM-003, şu anda şu dört sensörden şu değerleri okudum" bilgisini taşımak
ister — bir field cihazı için en doğal/insan-okur payload budur:

```json
{
  "panelCode": "PANO-003",
  "moduleId": "FM-003",
  "timestamp": "2026-09-19T19:21:12.219Z",
  "readings": [
    { "sensorType": "CABLE_TEMPERATURE", "value": 72.4 },
    { "sensorType": "CURRENT", "value": 164.8 },
    { "sensorType": "AMBIENT_TEMPERATURE", "value": 29.1 },
    { "sensorType": "HUMIDITY", "value": 61.5 }
  ]
}
```

`sensorType` değerleri, `packages/shared/src/sensor.ts` içindeki `SensorType`
enum'u ile birebir aynıdır (`AMBIENT_TEMPERATURE`, `CABLE_TEMPERATURE`,
`HUMIDITY`, `CURRENT`).

## 2. Mevcut API ingestion contract (gerçek, çalışan)

Bugün gerçekten çalışan uç nokta, `sensorType`/`panelCode` değil, **veritabanı
`sensorId`'si** bekler (bkz. `apps/api/src/readings/readings.service.ts` ve
`apps/api/src/readings/readings-ingest.controller.ts`):

```
POST /readings/batch
Content-Type: application/json

{
  "readings": [
    { "sensorId": "<uuid>", "value": 72.4, "timestamp": "2026-09-19T19:21:12.219Z" },
    { "sensorId": "<uuid>", "value": 164.8, "timestamp": "2026-09-19T19:21:12.219Z" }
  ]
}
```

Kurallar (kaynak: `ReadingsService.validateReading` / `createBatch`):

- `readings` boş olmayan bir dizi olmalı; **maksimum 500** eleman
  (`MAX_BATCH_SIZE`) — daha büyük batch'ler `400 Bad Request` döner.
- Her eleman: `sensorId` (non-empty string, gerçek bir `Sensor.id`),
  `value` (finite number), `timestamp` (opsiyonel, ISO 8601 string; verilmezse
  sunucu zamanı kullanılır).
- Batch içindeki herhangi bir `sensorId` veritabanında yoksa, **tüm batch**
  `404 Not Found` ile reddedilir (`Sensor(s) not found: ...`).
- Başarılı yanıt: `{ "inserted": <count> }`.
- Insert sonrası, yalnızca bu batch'ten etkilenen panolar için Risk Engine
  senkron olarak tetiklenir (`riskEngineService.analyzePanels(affectedPanelIds)`)
  — tüm veritabanı değil.

Tek okuma için ayrıca `POST /readings` (`{ sensorId, value, timestamp? }`)
vardır; bugünkü simulator ve scale-test script'i **batch** endpoint'ini
kullanır.

### `sensorId` nereden gelir?

Bugünkü simulator, başlangıçta panoları ve onların sensörlerini
`GET /panels` + `GET /panels/:id/sensors` (discovery) üzerinden keşfeder
(`apps/simulator/src/api-client.ts` — `discoverOnlinePanels`) ve elde ettiği
gerçek `sensor.id` UUID'lerini her tick'te `POST /readings/batch`'e gönderir.
Yani bugünkü sistemde "conceptual field payload"taki `panelCode` +
`sensorType` bilgisi, **discovery adımıyla** `sensorId`'ye çevrilir; ingestion
endpoint'inin kendisi `panelCode`/`sensorType` hiç görmez.

## Neden bu fark kasıtlı?

- `sensorId`, veritabanındaki `Sensor` tablosunun birincil anahtarıdır ve
  her okumanın hangi panoya/sensöre ait olduğunu **belirsizliğe yer
  bırakmadan** ifade eder.
- `panelCode` + `sensorType` bazlı bir sözleşme, aynı panoda aynı tipten
  birden fazla sensör olması durumunda (örn. iki farklı kablo noktası için
  iki `CABLE_TEMPERATURE` sensörü) belirsiz hale gelebilir; `sensorId`
  bazlı sözleşme bu belirsizliği baştan ortadan kaldırır.
- Gerçek bir Field Module'ün üretim firmware'i, GRID UP'a ilk bağlandığında
  bir "provisioning/discovery" adımıyla kendi `panelCode`/sensör
  konfigürasyonunu karşılık gelen `sensorId`'lere eşleyip önbelleğe alabilir
  — bugünkü simulator'ın yaptığı tam olarak budur.

## Gelecek production seçenekleri (bu aşamada implement edilmedi)

Aşağıdakiler yalnızca planlama notlarıdır, bugün mevcut değildir:

- Field Module'ün `panelCode` + `moduleId` + `sensorType` bazlı bir
  provisioning endpoint'i üzerinden kendi `sensorId`'lerini otomatik
  keşfetmesi (bugünkü simulator discovery mantığının firmware'e taşınması).
- Alan bazında bir "field payload" → "ingestion payload" çeviri katmanının
  (örn. Local Gateway seviyesinde) eklenmesi, böylece ingestion API'sinin
  sözleşmesi hiç değişmeden kalması.

Bu doküman, mevcut `POST /readings/batch` sözleşmesinde **hiçbir değişiklik
önermez veya yapmaz**; sadece saha tarafındaki kavramsal modeli belgeler.

## İlgili dosyalar

| Dosya | Sorumluluk |
| ----- | ---------- |
| `apps/api/src/readings/readings-ingest.controller.ts` | `POST /readings`, `POST /readings/batch` |
| `apps/api/src/readings/readings.service.ts` | Validasyon, batch limiti, Risk Engine tetikleme |
| `apps/simulator/src/api-client.ts` | Panel/sensor discovery (bugünkü "conceptual → sensorId" çevirisi) |
| `packages/shared/src/sensor.ts` | `SensorType` enum (tek kaynak) |
