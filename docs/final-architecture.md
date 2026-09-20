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

## ÇOK ÖNEMLİ: bugünkü prototipte Field Module iki biçimde bulunur

Yukarıdaki diyagramdaki **Sensors → Field Module → Local Gateway** bloğu,
bugünkü çalışan prototipte iki yazılım bileşeniyle temsil edilir:
**`apps/simulator`** (sentetik veri) ve **`firmware/`** (ESP32 firmware'i,
Wokwi simülasyonunda çalışır).

```
FIELD (bugünkü prototip)              FIELD (gerçek saha dağıtımı)
────────────────────────────          ─────────────────────────────
                                       Sensors
                                          │
  apps/simulator                          ▼
  (sentetik sensör verisi     ≈      Field Module
   üretir)                               │
                                          ▼
  firmware/ (ESP32, Wokwi'de)        Local Gateway
  (sanal sensörleri okur)
        │
        └─ ikisi de POST /readings/batch ile GRID UP'a gönderir
```

Bu denklik şu anlama gelir:

- Simulator'ın ve firmware'in konuştuğu API sözleşmesi (`POST /readings/batch`,
  bkz. [field-data-contract.md](field-data-contract.md)) ile gerçek bir Field
  Module'ün konuşacağı sözleşme **aynıdır**. Firmware bunu Wokwi'de gerçek API'ye
  karşı denemiştir.
- Field Module'den sonraki **her şey** (Ingestion API, PostgreSQL, Risk Engine,
  Anomaly/Alarm, Dashboard, Notifications, SCADA Gateway) bugün gerçek,
  çalışan, test edilmiş kod olarak mevcuttur ve gerçek saha dağıtımında
  **değişmeden** kullanılabilir.
- Gerçek Field Module donanımı devreye girdiğinde, yapılması gereken tek şey
  veri kaynağını simulator'dan/Wokwi'den gerçek karta çevirmektir — backend
  mimarisinde bir yeniden tasarım gerekmez. Firmware gerçek kartta ve gerçek
  sensörlerle henüz denenmemiştir; sensör kalibrasyonu sahada yapılmalıdır.

## Katman sorumlulukları

| Katman | Sorumluluk | Durum |
| ------ | ---------- | ----- |
| Sensors | Fiziksel ölçüm | Concept (bkz. [field-module.md](field-module.md)) |
| Field Module | Sensör toplama + iletim | `apps/simulator` ve ESP32 firmware'i (`firmware/`, Wokwi'de çalışır); gerçek kartta denenmedi |
| Local Gateway | Birden fazla Field Module'ü aggregate etme | Concept (bkz. [scalability.md](scalability.md)) |
| Private Network | Saha ↔ on-premise bağlantısı | Bugünkü dev ortamında localhost; production'da ADM/GDZ private network (bkz. [on-premise-architecture.md](on-premise-architecture.md)) |
| Ingestion API | `POST /readings`, `POST /readings/batch` | Implemented |
| PostgreSQL | Kalıcı veri | Implemented |
| Risk Engine | 0-100 risk skoru, trend, korelasyon | Implemented |
| Anomaly / Alarm | Anomali tespiti, alarm lifecycle | Implemented |
| Dashboard | Overview / Panels / Panel Detail / Alarms | Implemented |
| Notifications | SMS + WhatsApp (demo provider ve HTTP gateway provider) | Implemented; gateway yalnızca emülatörle test edildi (bkz. [notification-policy.md](notification-policy.md)) |
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
