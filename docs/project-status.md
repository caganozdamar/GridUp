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
| Physical field module | CONCEPT / NEXT HARDWARE STEP | Bkz. field-module.md; hiçbir gerçek donanım inşa edilmedi |
| Real industrial sensors | NOT YET FIELD VALIDATED | Sensör sınıfları önerilmiştir (bkz. field-module.md), kesin model/vendor seçimi yapılmamıştır |
| Arc flash detection (backend) | IMPLEMENTED (SIMULATED SENSOR) | `SensorType.ARC_FLASH`, `ARC_FLASH` anomalisi, skor tabanı (floor), Modbus 41001+ bloğu. Veri kaynağı: `apps/simulator` (`npm run demo:arc`, sentetik) — gerçek optik sensör doğrulanmadı |
| Partial discharge / acoustic (backend) | IMPLEMENTED (SIMULATED SENSOR) | `SensorType.ACOUSTIC`, `PARTIAL_DISCHARGE` anomalisi, nem korelasyon bonusu. Akustik seviye (dB) bir **gösterge**dir; gerçek kısmi deşarj ölçümü (UHF/TEV/HFCT) değildir |
| Field module firmware (C, ESP32) | RUNS IN WOKWI, NOT RUN ON REAL HARDWARE | `firmware/`: C çekirdeği + ESP-IDF HAL (Wi-Fi, HTTP, SNTP, DHT22, ADC). ESP-IDF v5.5.5 ile derlenir; çekirdek mantığı sahte HAL'le birim testli; Wokwi'de sensörleri okuyup yerel API'ye gönderir. Gerçek kartta ve gerçek sensörlerle denenmedi. Bkz. [firmware-flow.md](firmware-flow.md) |
| Electronic design docs | DOCUMENTED (DEMO SCHEMATIC) | [electronic-design.md](electronic-design.md): devre şeması, pin ve bileşen tablosu. Özel PCB yerleşimi çizilmedi |
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
| [code-freeze.md](code-freeze.md) | Son doğrulama sonuçları ve known limitations |
