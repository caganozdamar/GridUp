# Final Architecture (Aşama 8)

Bu doküman, GRID UP'ın saha (field) tarafından SCADA entegrasyonuna kadar
uzanan uçtan uca final mimarisini tek bir diyagramda özetler.

## Tek diyagram

```
FIELD
─────
   Sensors
      │
      ▼
  Field Module
      │
      ▼
 Local Gateway
      │
      ▼
┌─────────────────────┐
│  PRIVATE NETWORK     │
└─────────┬────────────┘
          │
          ▼
GRID UP ON-PREMISE
──────────────────
  Ingestion API (NestJS)
      │
      ▼
  PostgreSQL
      │
      ▼
  Risk Engine
      │
      ▼
  Anomaly / Alarm
      │
      ├──────────────► Dashboard (Web)
      │
      ├──────────────► Notifications (SMS / WhatsApp)
      │
      └──────────────► SCADA Gateway
                              │
                              ▼
                        Modbus TCP (read-only)
                              │
                              ▼
                        Existing SCADA
```

## ÇOK ÖNEMLİ: bugünkü prototipte "Field Module = Simulator"

Yukarıdaki diyagramdaki **Sensors → Field Module → Local Gateway** bloğu,
bugünkü çalışan prototipte tek bir yazılım bileşeniyle temsil edilir:
**`apps/simulator`**.

```
FIELD (bugünkü prototip)          FIELD (gerçek saha dağıtımı)
─────────────────────────         ─────────────────────────────
                                   Sensors
                                      │
  apps/simulator          ≈          ▼
  (sentetik sensör verisi     Field Module
   üretir, POST /readings/         │
   batch ile GRID UP'a              ▼
   gönderir)                  Local Gateway
```

Bu denklik şu anlama gelir:

- Simulator'ın konuştuğu API sözleşmesi (`POST /readings/batch`, bkz.
  [field-data-contract.md](field-data-contract.md)) ile gerçek bir Field
  Module'ün konuşacağı sözleşme **aynı olmalıdır/olacaktır**.
- Simulator'dan sonraki **her şey** (Ingestion API, PostgreSQL, Risk Engine,
  Anomaly/Alarm, Dashboard, Notifications, SCADA Gateway) bugün gerçek,
  çalışan, test edilmiş kod olarak mevcuttur ve gerçek saha dağıtımında
  **değişmeden** kullanılabilir.
- Field Module donanımı devreye girdiğinde, yapılması gereken tek şey veri
  kaynağını simulator'dan Field Module'e çevirmektir — backend mimarisinde
  bir yeniden tasarım gerekmez.

## Katman sorumlulukları

| Katman | Sorumluluk | Durum |
| ------ | ---------- | ----- |
| Sensors | Fiziksel ölçüm | Concept (bkz. [field-module.md](field-module.md)) |
| Field Module | Sensör toplama + iletim | Concept; bugün `apps/simulator` ile temsil ediliyor |
| Local Gateway | Birden fazla Field Module'ü aggregate etme | Concept (bkz. [scalability.md](scalability.md)) |
| Private Network | Saha ↔ on-premise bağlantısı | Bugünkü dev ortamında localhost; production'da ADM/GDZ private network (bkz. [on-premise-architecture.md](on-premise-architecture.md)) |
| Ingestion API | `POST /readings`, `POST /readings/batch` | Implemented |
| PostgreSQL | Kalıcı veri | Implemented |
| Risk Engine | 0-100 risk skoru, trend, korelasyon | Implemented |
| Anomaly / Alarm | Anomali tespiti, alarm lifecycle | Implemented |
| Dashboard | Overview / Panels / Panel Detail / Alarms | Implemented |
| Notifications | SMS + WhatsApp (demo provider) | Implemented with demo provider |
| SCADA Gateway | Modbus TCP (read-only) | Implemented prototype |

Detaylı matris için bkz. [project-status.md](project-status.md).

## İlgili dosyalar

| Dosya | İçerik |
| ----- | ------ |
| [architecture.md](architecture.md) | Backend mimarisi (Aşama 1-7) |
| [on-premise-architecture.md](on-premise-architecture.md) | On-prem Docker dağıtımı |
| [modbus-register-map.md](modbus-register-map.md) | SCADA/Modbus detayları |
| [field-module.md](field-module.md) | Field Module konsepti |
| [scalability.md](scalability.md) | 100 modül ölçek mimarisi |
