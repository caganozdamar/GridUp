# Project Status — Implemented vs Future (Aşama 8)

Bu tablo, GRID UP'ın hangi özelliklerinin bugün **gerçekten çalıştığını**,
hangilerinin **planlama/konsept seviyesinde** olduğunu net şekilde ayırır.
Sistemin yapmadığı bir şeyi yapıyormuş gibi göstermemek bu dokümanın temel
amacıdır.

| Feature | Status | Notes |
| ------- | ------ | ----- |
| Synthetic sensor ingestion | IMPLEMENTED | `apps/simulator` → `POST /readings/batch` (bkz. field-data-contract.md) |
| Real-time risk engine | IMPLEMENTED | 0-100 skor, 4 seviye (NORMAL/WARNING/HIGH/CRITICAL) — `apps/api/src/risk-engine` |
| Trend detection | IMPLEMENTED | Pencere içi değişim hızı → aciliyet skoru (`*_TREND_ANCHORS`) |
| Multi-sensor correlation bonuses | IMPLEMENTED | `CORRELATION_BONUSES` (current+cable temp, humidity+cable temp) |
| Anomaly lifecycle | IMPLEMENTED | `HIGH_TEMPERATURE`, `TEMPERATURE_RISE`, `OVERCURRENT`, `HIGH_HUMIDITY`, `MULTI_SENSOR_RISK` |
| Alarm lifecycle | IMPLEMENTED | ACTIVE → RESOLVED (bu Aşama 8 rehearsal'ında canlı sistemde uçtan uca doğrulandı) |
| Live dashboard | IMPLEMENTED | Overview / Panels / Panel Detail / Alarms (polling tabanlı) |
| SMS/WhatsApp workflow | IMPLEMENTED WITH DEMO PROVIDER | `DemoNotificationProvider`; gerçek SMS/WhatsApp gönderilmez, gerçek credential kullanılmaz |
| SCADA Modbus TCP | IMPLEMENTED PROTOTYPE | Read-only, demo portu 1502; bkz. modbus-register-map.md |
| On-prem Docker deployment | IMPLEMENTED PROTOTYPE | `docker-compose.onprem.yml`; gerçekten build edilip çalıştırılarak doğrulandı |
| 100-panel load test | VALIDATED IN TEST | Bkz. scalability.md — tek makine/tek çalıştırma benchmark'ı, production garantisi değil |
| Trend-based Critical Threshold Estimate | IMPLEMENTED PROTOTYPE | Aşama 9 — `apps/api/src/decision-support/trend-estimate.util.ts`; ML/AI değil, doğrusal trend + guard'lar. Bkz. decision-support.md |
| Recommended Actions | IMPLEMENTED | Aşama 9 — mevcut anomaly flag'lerinden deterministic, inspection-oriented mapping. Bkz. decision-support.md |
| Panel Event Timeline | IMPLEMENTED | Aşama 9 — mevcut RiskScore/Anomaly/Alarm/Notification kayıtlarından derived, yeni DB modeli yok. Bkz. decision-support.md |
| Sensor Data Health | IMPLEMENTED | Aşama 9 — panel seviyesinde VALID/STALE/NO_DATA, SCADA Gateway'in stale-data semantiğiyle tutarlı. Bkz. decision-support.md |
| Operational Metrics | IMPLEMENTED | Aşama 9 — `GET /metrics/operations`, gerçek DB aggregate'leri (Early Warnings/Critical Escalations/Notifications Delivered). Bkz. decision-support.md |
| Physical field module | CONCEPT / NEXT HARDWARE STEP | Bkz. field-module.md; hiçbir gerçek donanım inşa edilmedi |
| Real industrial sensors | NOT YET FIELD VALIDATED | Sensör sınıfları önerilmiştir (bkz. field-module.md), kesin model/vendor seçimi yapılmamıştır |
| Partial discharge | FUTURE | `SensorType` enum'unda yok; yalnızca kod yorumunda gelecek notu var |
| Arc flash sensing | FUTURE | Aynı şekilde — kod tabanında karşılığı yok |
| Acoustic sensing | FUTURE | Aynı şekilde — kod tabanında karşılığı yok |
| Real ADM/GDZ SCADA connection | NOT REQUIRED FOR HACKATHON / FUTURE FIELD PILOT | Gerçek SCADA sistemine bağlanılmadı; sadece Modbus TCP server prototipi çalışıyor |
| Authentication | NOT IMPLEMENTED | Hackathon kapsamı dışı; production öncesi zorunlu (bkz. on-premise-architecture.md "Production Considerations") |
| Public cloud / AWS / Azure / Firebase | NOT USED | Sistem tamamen on-premise/Docker Compose ile çalışır |
| Machine learning / predictive AI | NOT IMPLEMENTED | Risk Engine kural/ağırlık tabanlıdır, ML kullanmaz |

## Nasıl doğrulandı?

Bu tablodaki "IMPLEMENTED" satırları, Aşama 8 kapsamında yeniden çalıştırılan
gerçek testler ve canlı sistem üzerinde yapılan rehearsal ile doğrulanmıştır:
`npm run typecheck`, `npm run lint`, `npm run build`, `npm run test`,
`npm run test:e2e` (hepsi geçti) ve NORMAL → COMBINED_FAILURE → NORMAL uçtan
uca senaryosu (bkz. [code-freeze.md](code-freeze.md)).

## İlgili dosyalar

| Dosya | İçerik |
| ----- | ------ |
| [final-architecture.md](final-architecture.md) | Katman bazlı implemented/concept özeti |
| [field-module.md](field-module.md) | Future sensor extension detayları |
| [decision-support.md](decision-support.md) | Aşama 9: Time-to-Critical, Recommended Actions, Data Health, Timeline, Metrics |
| [code-freeze.md](code-freeze.md) | Son doğrulama sonuçları ve known limitations |
