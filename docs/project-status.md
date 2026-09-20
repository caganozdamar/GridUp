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
| Alarm lifecycle | IMPLEMENTED | ACTIVE → ACKNOWLEDGED → RESOLVED. ACTIVE → RESOLVED Aşama 8 rehearsal'ında canlı sistemde doğrulandı; onaylama (`PATCH /alarms/:id/acknowledge`, dashboard butonu) e2e testlidir, tarayıcıda elle denenmedi |
| Module offline detection | IMPLEMENTED | Panonun hiçbir sensöründen 60 sn okuma gelmezse `MODULE_OFFLINE` alarmı (HIGH) ve SMS; veri gelince kendiliğinden çözülür. Gerçek ortamda ve e2e testlerle doğrulandı. Tek sensör susması kapsam dışı. Bkz. [notification-policy.md](notification-policy.md) |
| Alarm hysteresis and notification cooldown | IMPLEMENTED | RISK alarmı arka arkaya 5 normal analizden önce çözülmez, seviye düşüşü yeni alarm açmaz; aynı pano/tür/kanal için 2 dk içinde tekrar SMS gitmez, seviye yükselişi her zaman bildirilir. e2e testli (mutasyon kontrolü yapıldı). Anomali kayıtları hâlâ anında çözülür |
| Live dashboard | IMPLEMENTED | Overview / Panels / Panel Detail / Alarms (polling tabanlı) |
| SMS/WhatsApp workflow | IMPLEMENTED WITH DEMO PROVIDER + HTTP GATEWAY ADAPTER (TESTED AGAINST AN EMULATOR) | `DemoNotificationProvider` gerçek gönderim yapmaz; `http` sağlayıcı yapılandırılabilir bir gateway'e POST eder, çoklu alıcı, yeniden deneme ve arka plan gönderimi vardır. Gerçek bir SMS/WhatsApp hesabı veya modem ile denenmedi. Bkz. [notification-policy.md](notification-policy.md) |
| SCADA Modbus TCP | IMPLEMENTED PROTOTYPE | Read-only, demo portu 1502; bkz. modbus-register-map.md |
| SCADA screen (dashboard) | IMPLEMENTED PROTOTYPE | Dashboard'da **SCADA** sayfası: Modbus sunucusunun sunduğu register tablosunu (40001+ / 41001+) ham ve mühendislik değeriyle gösterir. Gateway'in read-only HTTP ucundan (`:1580`, yalnızca GET) okur; gerçek bir SCADA yazılımının yerini tutmaz. Bkz. [modbus-register-map.md](modbus-register-map.md) |
| On-prem Docker deployment | IMPLEMENTED PROTOTYPE | `docker-compose.onprem.yml`; gerçekten build edilip çalıştırılarak doğrulandı |
| 100-panel load test | VALIDATED IN TEST | Bkz. scalability.md — tek makine/tek çalıştırma benchmark'ı, production garantisi değil |
| Trend-based Critical Threshold Estimate | IMPLEMENTED PROTOTYPE | Aşama 9 — `apps/api/src/decision-support/trend-estimate.util.ts`; ML/AI değil, doğrusal trend + guard'lar. Bkz. decision-support.md |
| Recommended Actions | IMPLEMENTED | Aşama 9 — mevcut anomaly flag'lerinden deterministic, inspection-oriented mapping. Bkz. decision-support.md |
| Panel Event Timeline | IMPLEMENTED | Aşama 9 — mevcut RiskScore/Anomaly/Alarm/Notification kayıtlarından derived, yeni DB modeli yok. Bkz. decision-support.md |
| Sensor Data Health | IMPLEMENTED | Aşama 9 — panel seviyesinde VALID/STALE/NO_DATA, SCADA Gateway'in stale-data semantiğiyle tutarlı. Bkz. decision-support.md |
| Operational Metrics | IMPLEMENTED | Aşama 9 — `GET /metrics/operations`, gerçek DB aggregate'leri (Early Warnings/Critical Escalations/Notifications Delivered). Bkz. decision-support.md |
| Physical field module | CONCEPT + FIRMWARE IN WOKWI | Bkz. field-module.md, [electronic-design.md](electronic-design.md); gerçek kart veya PCB inşa edilmedi, firmware yalnızca Wokwi'de çalıştırıldı |
| Real industrial sensors | NOT YET FIELD VALIDATED | Sensör sınıfları önerilmiştir (bkz. field-module.md), kesin model/vendor seçimi yapılmamıştır |
| Arc flash detection (backend) | IMPLEMENTED (SIMULATED SENSOR) | `SensorType.ARC_FLASH`, `ARC_FLASH` anomalisi, skor tabanı (floor), Modbus 41001+ bloğu. Veri kaynağı: `apps/simulator` (`npm run demo:arc`, sentetik) — gerçek optik sensör doğrulanmadı |
| Partial discharge / acoustic (backend) | IMPLEMENTED (SIMULATED SENSOR) | `SensorType.ACOUSTIC`, `PARTIAL_DISCHARGE` anomalisi, nem korelasyon bonusu. Akustik seviye (dB) bir **gösterge**dir; gerçek kısmi deşarj ölçümü (UHF/TEV/HFCT) değildir |
| Field module firmware (C, ESP32) | RUNS IN WOKWI, NOT RUN ON REAL HARDWARE | `firmware/`: C çekirdeği + ESP-IDF HAL (Wi-Fi, HTTP, SNTP, DHT22, ADC). ESP-IDF v5.5.5 ile derlenir; çekirdek mantığı sahte HAL'le birim testli; Wokwi'de sensörleri okuyup yerel API'ye gönderir. Gerçek kartta ve gerçek sensörlerle denenmedi. Bkz. [firmware-flow.md](firmware-flow.md) |
| Electronic design docs | DOCUMENTED (DEMO SCHEMATIC) | [electronic-design.md](electronic-design.md): devre şeması, pin ve bileşen tablosu. Özel PCB yerleşimi çizilmedi |
| Field conditions and installation/failure analysis | DOCUMENTED (DESIGN ONLY) | [field-conditions.md](field-conditions.md), [installation-and-failure-analysis.md](installation-and-failure-analysis.md): sıcaklık/manyetik alan yaklaşımı, kurulum ilkeleri, FMEA. Hiçbir test yapılmadı. FMEA'nın işaretlediği iki kritik boşluk (susan modül için alarm/bildirim, alarm dalgalanması) sonradan kapatıldı; kalanlar: ingest kimlik doğrulaması, tek sensör susması |
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
