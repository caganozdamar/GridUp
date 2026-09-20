# GRID UP

**Early Warning System for Electrical Panels**

ADM/GDZ Grid Up Hackathon için geliştirilen prototip.

## Problem

Electrical panel failures can be preceded by abnormal temperature, current,
humidity and correlated sensor behaviour — often minutes to hours before a
critical fault. OG hücreleri ve AG panolarda bu erken belirtiler (ortam
sıcaklığı, kablo/yüzey sıcaklığı, nem, akım), yeterince erken ve doğru
şekilde izlenmediğinde fark edilmeden kritik bir arızaya dönüşebilir.

## Solution

GRID UP continuously evaluates multi-sensor data, calculates a 0-100 risk
score per panel, detects anomalies and exposes alerts through a live
dashboard, SMS/WhatsApp notifications and a read-only SCADA/Modbus TCP
integration — tamamen **on-premise**, public cloud'a bağımlı olmadan.

| Skor    | Seviye     |
| ------- | ---------- |
| 0-29    | NORMAL     |
| 30-59   | WARNING    |
| 60-79   | HIGH       |
| 80-100  | CRITICAL   |

> **Durum:** Monorepo temeli, backend/frontend, sentetik veri simülatörü,
> risk/anomaly/alarm motoru, gerçek zamanlı dashboard (Aşama 5), alarm/
> notification sistemi (Aşama 6), SCADA/Modbus TCP + on-premise Docker
> mimarisi (Aşama 7) ve final field-module konsepti/demo hazırlığı
> (Aşama 8) tamamlanmıştır. Detaylı implemented/future matrisi için bkz.
> [docs/project-status.md](docs/project-status.md).

## Architecture

```
Sensor/Simulator -> Ingestion API -> Risk Engine -> Anomaly -> Alarm
                                                        │
                        ┌───────────────┬───────────────┴──────────────┐
                        ▼               ▼                              ▼
                    Dashboard   Notifications (SMS/WhatsApp)   SCADA Gateway
                                                                → Modbus TCP
                                                                → Existing SCADA
```

Tam mimari ve saha (field module) tarafına genişleme için bkz.
[docs/final-architecture.md](docs/final-architecture.md) ve
[docs/architecture.md](docs/architecture.md). On-premise dağıtım detayları
için bkz. [docs/on-premise-architecture.md](docs/on-premise-architecture.md).

## Klasör Yapısı

```
/apps
  /api             NestJS backend (REST API, Prisma ORM)
  /web             React + Vite + TypeScript dashboard
  /simulator       Sentetik sensör verisi üreten CLI
  /scada-gateway   SCADA / Modbus TCP gateway
/packages
  /shared     Backend ve frontend arasında paylaşılan TypeScript tipleri (RiskLevel, SensorType, Panel, Alarm ...)
/infrastructure   Altyapı/deployment konfigürasyonları (bkz. infrastructure/README.md)
/docs             Proje dokümantasyonu (mimari, Modbus register map, field module konsepti, demo script, vb.)
/scripts          Demo yardımcı script'leri (npm run demo:normal / demo:critical)
docker-compose.yml          Günlük geliştirme ortamı: sadece PostgreSQL servisini ayağa kaldırır
docker-compose.onprem.yml   Production-benzeri on-prem stack: PostgreSQL + API + Web + SCADA Gateway
.env.example         Ortam değişkenleri şablonu (kök seviye)
```

Bu bir **npm workspaces monorepo**'dur: `apps/*` ve `packages/*` altındaki her paket kök `package.json` üzerinden tek bir `npm install` ile yönetilir.

## Features

- Sentetik sensör verisi üretimi (5 senaryo: NORMAL, OVERHEATING,
  OVERCURRENT, HIGH_HUMIDITY, COMBINED_FAILURE)
- Gerçek zamanlı, ağırlıklı, trend-duyarlı risk skorlama motoru
- Çoklu-sensör korelasyon bonusları (örn. akım + kablo sıcaklığı birlikte
  yükseliyorsa ek risk puanı)
- Anomaly + alarm lifecycle (ACTIVE → RESOLVED)
- SMS/WhatsApp bildirim akışı (demo provider, audit trail ile)
- Read-only SCADA/Modbus TCP gateway (mevcut SCADA'yı değiştirmeden entegrasyon)
- Public cloud kullanmayan, Docker Compose ile doğrulanmış on-premise dağıtım
- 100 panel / 400 sensör ölçeğinde ölçülmüş prototip benchmark'ı
- Decision support / early warning intelligence (Aşama 9): trend-based
  Critical Threshold Estimate, deterministic Recommended Actions, Sensor/Panel
  Data Health, Panel Event Timeline, Operational Metrics — bkz.
  [docs/decision-support.md](docs/decision-support.md)

## Current Sensors

İlk versiyonda gerçek sensör kullanılmaz; sentetik veri üreten bir simülatör
backend'e aynı API üzerinden veri gönderir. Mimari, ileride gerçek bir Field
Module'ün (bkz. [docs/field-module.md](docs/field-module.md)) aynı API'ye
veri gönderebilmesine uygun şekilde tasarlanmıştır.

| Sensor Type | Ne ölçer |
| ----------- | -------- |
| `AMBIENT_TEMPERATURE` | Pano iç ortam sıcaklığı |
| `CABLE_TEMPERATURE` | Kritik kablo/bara/terminal yüzey sıcaklığı |
| `HUMIDITY` | Pano iç ortam nemi |
| `CURRENT` | Seçilen iletkenin akımı |

Gelecek genişleme noktaları (`PARTIAL_DISCHARGE`, `ARC_FLASH`, `ACOUSTIC`)
bugün kod tabanında **implement edilmemiştir** — bkz.
[docs/field-module.md](docs/field-module.md#future--extended-module--bugün-çalişmiyor)
ve [docs/project-status.md](docs/project-status.md).

## Risk Engine

Her panonun son 10 reading'lik penceresi; sıcaklık, akım, nem ve trend
(değişim hızı) component'lerinin ağırlıklı toplamı + korelasyon bonusları
ile 0-100 arası bir skora çevrilir. Kaynak: `apps/api/src/risk-engine`.
Detaylı formül/ağırlıklar için bkz. `apps/api/src/risk-engine/risk-engine.config.ts`.

## Dashboard

React + Vite tabanlı, backend'e polling ile bağlanan bir dashboard:
**Overview**, **Panels**, **Panel Detail** ve **Alarms** sayfaları. Bkz.
"Frontend Nasıl Başlatılır" bölümü.

## Notifications

HIGH/CRITICAL seviyesinde yeni bir alarm oluştuğunda Notification Service,
severity'ye göre (HIGH → SMS, CRITICAL → SMS + WhatsApp) bildirim gönderir.
Hackathon aşamasında gerçek, ücretli bir SMS/WhatsApp servisine bağımlı
olunmaz: `DemoNotificationProvider` gerçek mesaj göndermez, credential
kullanmaz; bildirim lifecycle'ını (PENDING → SENT/FAILED) terminale
okunabilir şekilde loglar ve `Notification` tablosunda audit trail olarak
saklar. Mimari, gerçek bir SMS/WhatsApp gateway'i ile (risk engine
değişmeden) kolayca değiştirilebilecek şekilde tasarlanmıştır — bkz.
[docs/architecture.md](docs/architecture.md#asama-6---alarm-ve-emergency-notification-system).

## SCADA / Modbus

SCADA Gateway (`apps/scada-gateway`), GRID UP'ın hesapladığı risk skoru ve
sensör verilerini mevcut bir SCADA sistemine **Modbus TCP** üzerinden
(read-only) sunan ayrı bir adapter servisidir. Veritabanına doğrudan
bağlanmaz; backend'deki `GET /scada/panels` snapshot endpoint'ini poll eder.
Tam register haritası için bkz.
[docs/modbus-register-map.md](docs/modbus-register-map.md).

```bash
cp apps/scada-gateway/.env.example apps/scada-gateway/.env
npm run dev:scada
npm run scada:read -- PANO-003
```

Örnek çıktı:

```
----------------------------------------
SCADA / MODBUS TCP READ

Panel: PANO-003

40021 Risk Score           : 100
40022 Risk Level           : 3 (CRITICAL)
40023 Ambient Temperature  : 31.4 °C
40024 Cable Temperature    : 90.8 °C
40025 Humidity             : 98.0 %
40026 Current              : 220.0 A
40027 Active Alarm         : YES
40028 Panel Status         : ONLINE
40029 Active Anomalies     : 5
40030 Data Quality         : VALID
----------------------------------------
```

Bir panonun sensör verisi `SCADA_DATA_STALE_MS` (varsayılan `10000` ms)
süresinden daha eski olduğunda (örn. simülatör durduğunda), o panonun
`Data Quality` register'ı otomatik olarak `0` (INVALID) olur — gateway
çökmez, son bilinen değerleri korur ve veri akışı geri geldiğinde
`Data Quality` tekrar `1` (VALID) olur (canlı olarak doğrulanmıştır, bkz.
[docs/code-freeze.md](docs/code-freeze.md)).

## On-Premise Deployment

Production-benzeri, **public cloud kullanmayan** bir on-prem stack için
(PostgreSQL + API + Web + SCADA Gateway, tek bir private Docker network
üzerinde):

```bash
docker compose -f docker-compose.onprem.yml up -d --build
```

Bu, günlük geliştirme ortamını (`docker-compose.yml`, `npm run dev:*`)
**değiştirmez** — ayrı, opsiyonel bir dağıtım dosyasıdır. Mimari detayları
ve production considerations için bkz.
[docs/on-premise-architecture.md](docs/on-premise-architecture.md).

## Scalability Test

100 pano / 400 sensör ölçeğinde, mevcut 5 demo panosunu bozmadan, izole/geçici
test fixture'ları ile gerçek ölçüm almak için:

```bash
node apps/api/scripts/scada-scale-test.mjs
```

En son ölçüm (bkz. [docs/scalability.md](docs/scalability.md)):

```
100 panels | 400 sensors | 400 readings/tick | 5 ticks
Total readings sent: 2000 | Failed ticks: 0
Average batch processing ≈ 1006.9 ms
```

Bu bir **measured prototype benchmark'ıdır**, production garantisi değildir.

## Field Module Concept

Gerçek saha dağıtımında simülatörün yerini alacak fiziksel donanım konsepti
— sensör yaklaşımı, low-risk installation prensipleri, haberleşme mimarisi,
BOM ve 1600 kVA AG panel deployment konsepti dahil:

| Doküman | İçerik |
| ------- | ------ |
| [docs/field-module.md](docs/field-module.md) | Genel konsept, sensör yaklaşımı, future extensions |
| [docs/field-data-contract.md](docs/field-data-contract.md) | Field → GRID UP veri sözleşmesi |
| [docs/hardware-architecture.md](docs/hardware-architecture.md) | Donanım blok diyagramı |
| [docs/field-installation.md](docs/field-installation.md) | Enclosure/kurulum konsepti |
| [docs/panel-deployment-concept.md](docs/panel-deployment-concept.md) | 1600 kVA AG panel deployment konsepti |
| [docs/bom.md](docs/bom.md) | Demo ve production BOM |

> Bugünkü prototipte **Field Module = Simulator** — bkz.
> [docs/final-architecture.md](docs/final-architecture.md). Hiçbir gerçek
> donanım inşa edilmedi; bu tamamen bir planlama/konsept çalışmasıdır.

## Gereksinimler

- [Node.js](https://nodejs.org/) 20+ (geliştirme Node 24 ile test edildi)
- npm 10+
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (yalnızca PostgreSQL container'ı için; Docker Compose dahildir)

## Running the Demo

### 1. Kurulum

```bash
npm install
cp .env.example .env
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
cp apps/simulator/.env.example apps/simulator/.env
cp apps/scada-gateway/.env.example apps/scada-gateway/.env
npm run build:shared
```

> **Önemli:** Varsayılan PostgreSQL host portu **55432**'dir (standart 5432 yerine), makinenizde başka bir Postgres/servis ile çakışmayı önlemek için. Doluysa `.env` ve `apps/api/.env` içindeki `POSTGRES_PORT` / `DATABASE_URL`'i güncelleyin.

### 2. Veritabanı

```bash
npm run docker:db:up
npm run prisma:migrate -- --name init
```

### 3. Servisleri başlatın

```bash
npm run dev:api      # http://localhost:3000
npm run dev:web       # http://localhost:5173
npm run dev:scada     # Modbus TCP :1502
```

veya API + Web + Simulator'ı (PostgreSQL ayrıca ayakta olmalı) tek terminalden:

```bash
npm run dev:all
```

### 4. Demo senaryosu

```bash
npm run demo:normal      # NORMAL, tüm panolar
npm run demo:critical    # COMBINED_FAILURE, TARGET_PANEL_CODE=PANO-003
```

Bu iki komut `apps/simulator/.env` dosyasını **değiştirmez** — sadece bu
çalıştırma için `SIMULATION_SCENARIO`/`TARGET_PANEL_CODE` ortam
değişkenlerini geçici olarak override eder (bkz. `scripts/demo.mjs`).
Aynı anda yalnızca **bir** simulator instance'ı çalıştırın.

Adım adım jüri demosu için bkz. [docs/demo-script.md](docs/demo-script.md);
demo öncesi kontrol listesi için bkz.
[docs/demo-checklist.md](docs/demo-checklist.md).

### 5. Doğrulama

```bash
curl http://localhost:3000/health
npm run scada:read -- PANO-003
```

## Kök Seviye Kullanışlı Komutlar

| Komut                      | Açıklama                                              |
| --------------------------- | ------------------------------------------------------ |
| `npm run dev:api`           | Backend'i watch modunda başlatır                       |
| `npm run dev:web`           | Frontend dev server'ı başlatır                         |
| `npm run dev:simulator`     | Simülatörü başlatır (`.env`'deki senaryoyla)            |
| `npm run demo:normal`       | Simülatörü NORMAL senaryoyla başlatır (`.env`'i değiştirmez) |
| `npm run demo:critical`     | Simülatörü COMBINED_FAILURE + PANO-003 ile başlatır (`.env`'i değiştirmez) |
| `npm run dev:scada`         | SCADA Gateway'i (Modbus TCP server) başlatır            |
| `npm run scada:read -- <PANO-KOD>` | Modbus TCP test client'ı ile bir panonun register'larını okur |
| `npm run dev:all`           | API + Web + Simulator'ı tek terminalde paralel başlatır |
| `npm run build`              | Tüm workspace'leri build eder (shared önce derlenmeli) |
| `npm run typecheck`          | Tüm workspace'lerde TypeScript kontrolü yapar          |
| `npm run lint`               | Tüm workspace'lerde lint çalıştırır                    |
| `npm run test`               | Tüm workspace'lerde unit testleri çalıştırır            |
| `npm run test:e2e` (apps/api) | API e2e testlerini çalıştırır                          |
| `npm run docker:db:up`       | PostgreSQL container'ını başlatır (geliştirme ortamı)  |
| `npm run docker:db:down`     | PostgreSQL container'ını durdurur (geliştirme ortamı)  |
| `docker compose -f docker-compose.onprem.yml up -d --build` | Postgres + API + Web + SCADA Gateway on-prem stack'ini başlatır |
| `npm run prisma:generate`    | Prisma Client'ı üretir                                 |
| `npm run prisma:migrate`     | Prisma migration'larını uygular                        |
| `node apps/api/scripts/scada-scale-test.mjs` | 100 panel ölçek testini çalıştırır |

## Project Status

Sistemin hangi özelliklerinin bugün gerçekten çalıştığını, hangilerinin
planlama/konsept seviyesinde olduğunu gösteren tam matris için bkz.
[docs/project-status.md](docs/project-status.md).

## Production Considerations

Aşağıdakiler, hackathon prototipinde implement **edilmemiştir**, production
öncesi değerlendirilmesi gereken noktalardır (tam liste:
[docs/on-premise-architecture.md](docs/on-premise-architecture.md#production-considerations-yalnızca-dokümantasyon--bu-aşamada-implement-edilmemiştir)):

- API authentication (API key/mTLS)
- TLS / secure gateway (IT/OT sınırında)
- Network segmentation ve firewall allow-list (Modbus TCP için)
- Gerçek SMS/WhatsApp gateway entegrasyonu (`NotificationProvider` arayüzü ile)
- Gerçek ADM/GDZ SCADA bağlantısı
- Gerçek endüstriyel sensör/vendor seçimi ve saha doğrulaması (bkz. [docs/field-module.md](docs/field-module.md))

## Dokümantasyon

| Doküman | Kapsam |
| ------- | ------ |
| [docs/architecture.md](docs/architecture.md) | Backend mimarisi (Aşama 1-7) |
| [docs/on-premise-architecture.md](docs/on-premise-architecture.md) | On-prem Docker dağıtımı, production considerations |
| [docs/modbus-register-map.md](docs/modbus-register-map.md) | SCADA/Modbus register haritası |
| [docs/final-architecture.md](docs/final-architecture.md) | Uçtan uca final mimari (field → SCADA) |
| [docs/field-module.md](docs/field-module.md) | Field Module konsepti |
| [docs/field-data-contract.md](docs/field-data-contract.md) | Field veri sözleşmesi |
| [docs/hardware-architecture.md](docs/hardware-architecture.md) | Donanım blok diyagramı |
| [docs/field-installation.md](docs/field-installation.md) | Enclosure/kurulum konsepti |
| [docs/panel-deployment-concept.md](docs/panel-deployment-concept.md) | 1600 kVA AG panel deployment konsepti |
| [docs/bom.md](docs/bom.md) | Demo ve production BOM |
| [docs/scalability.md](docs/scalability.md) | 100 panel ölçek testi ve mimarisi |
| [docs/demo-script.md](docs/demo-script.md) | Jüri demo akışı |
| [docs/demo-checklist.md](docs/demo-checklist.md) | Pre-flight checklist ve emergency fallback |
| [docs/decision-support.md](docs/decision-support.md) | Aşama 9: Time-to-Critical, Recommended Actions, Data Health, Timeline, Metrics |
| [docs/project-status.md](docs/project-status.md) | Implemented vs Future matrisi |
| [docs/code-freeze.md](docs/code-freeze.md) | Son doğrulama sonuçları, known limitations |
