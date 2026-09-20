# GRID UP

**Elektrik Panoları için Erken Uyarı Sistemi**

ADM/GDZ Grid Up Hackathon için geliştirilen prototip.

## Problem

Elektrik panosu arızaları; anormal sıcaklık, akım, nem ve birbiriyle ilişkili
sensör davranışlarıyla, çoğu zaman kritik arızadan dakikalar ya da saatler önce
kendini gösterir. OG hücreleri ve AG panolarda bu erken belirtiler (ortam
sıcaklığı, kablo/yüzey sıcaklığı, nem, akım, ark flaş, kısmi deşarj), yeterince
erken ve doğru şekilde izlenmediğinde fark edilmeden kritik bir arızaya
dönüşebilir.

## Çözüm

GRID UP, çoklu sensör verisini sürekli değerlendirir, her pano için 0-100
arası bir risk skoru hesaplar, anomalileri tespit eder ve uyarıları canlı bir
dashboard, SMS/WhatsApp bildirimleri ve read-only bir SCADA/Modbus TCP
entegrasyonu üzerinden sunar. Sistem tamamen **on-premise** çalışır, public
cloud'a bağımlı değildir.

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
> (Aşama 8) tamamlanmıştır. Sonrasında ark flaş ve akustik kanallar, ESP32
> field module firmware'i (Wokwi'de çalışır), elektronik tasarım dokümanları
> ve yapılandırılabilir HTTP bildirim gateway'i eklenmiştir. Uygulanan ve
> gelecek özelliklerin ayrıntılı matrisi için bkz.
> [docs/project-status.md](docs/project-status.md).

## Mimari

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
/firmware          Field module firmware'i (C çekirdeği, ESP32/ESP-IDF, Wokwi devresi)
/packages
  /shared     Backend ve frontend arasında paylaşılan TypeScript tipleri (RiskLevel, SensorType, Panel, Alarm ...)
/infrastructure   Altyapı/deployment konfigürasyonları (bkz. infrastructure/README.md)
/docs             Proje dokümantasyonu (mimari, Modbus register map, field module, elektronik tasarım, bildirim politikası, demo script, vb.)
/scripts          Demo yardımcı script'leri (npm run demo:normal / demo:critical)
docker-compose.yml          Günlük geliştirme ortamı: sadece PostgreSQL servisini ayağa kaldırır
docker-compose.onprem.yml   Production-benzeri on-prem stack: PostgreSQL + API + Web + SCADA Gateway
.env.example         Ortam değişkenleri şablonu (kök seviye)
```

Bu bir **npm workspaces monorepo**'dur: `apps/*` ve `packages/*` altındaki her paket kök `package.json` üzerinden tek bir `npm install` ile yönetilir.

## Özellikler

- Sentetik sensör verisi üretimi (6 senaryo: NORMAL, OVERHEATING,
  OVERCURRENT, HIGH_HUMIDITY, ARC_FLASH, COMBINED_FAILURE)
- Gerçek zamanlı, ağırlıklı, trend-duyarlı risk skorlama motoru
- Çoklu-sensör korelasyon bonusları (örn. akım + kablo sıcaklığı birlikte
  yükseliyorsa ek risk puanı)
- Anomaly + alarm lifecycle (ACTIVE → ACKNOWLEDGED → RESOLVED); operatör alarmı dashboard'dan onaylayabilir
- SMS/WhatsApp bildirim akışı: demo provider ve yapılandırılabilir HTTP
  gateway provider'ı (çoklu alıcı, yeniden deneme, arka plan gönderimi, audit
  trail); gerçek hesap olmadan denemek için yerel gateway emülatörü
- Ark flaş ve akustik (kısmi deşarj göstergesi) kanalları
- ESP32 field module firmware'i (C çekirdeği + ESP-IDF); Wokwi simülasyonunda
  sensör okuyup API'ye veri gönderir
- Read-only SCADA/Modbus TCP gateway (mevcut SCADA'yı değiştirmeden entegrasyon)
- Public cloud kullanmayan, Docker Compose ile doğrulanmış on-premise dağıtım
- 100 panel / 400 sensör ölçeğinde ölçülmüş prototip benchmark'ı

## Mevcut Sensörler

Veri iki kaynaktan gelebilir: sentetik veri üreten simülatör ya da ESP32 field
module firmware'i (Wokwi simülasyonunda çalışır). İkisi de backend'e aynı API
üzerinden veri gönderir. Gerçek sensör ve gerçek kart kullanılmamıştır; mimari,
gerçek bir Field Module'ün (bkz. [docs/field-module.md](docs/field-module.md))
aynı API'ye veri gönderebilmesine uygun şekilde tasarlanmıştır.

| Sensör Tipi | Ne ölçer |
| ----------- | -------- |
| `AMBIENT_TEMPERATURE` | Pano iç ortam sıcaklığı |
| `CABLE_TEMPERATURE` | Kritik kablo/bara/terminal yüzey sıcaklığı |
| `HUMIDITY` | Pano iç ortam nemi |
| `CURRENT` | Seçilen iletkenin akımı |
| `ARC_FLASH` | Pano içi optik yoğunluk (%), ani ışık patlaması (simüle) |
| `ACOUSTIC` | Pano içi ses seviyesi (dB), kısmi deşarj göstergesi (simüle) |

`ARC_FLASH` ve `ACOUSTIC` kanalları risk motorunda ağırlıklı toplama girmez,
skora taban (floor) olur: güçlü bir ark flaş tek başına CRITICAL üretir.
Akustik kanal bir **kısmi deşarj göstergesidir**, gerçek PD ölçümü (UHF/TEV/
HFCT) değildir; iki kanal da şu an yalnızca simülatörden ya da Wokwi'deki sanal
sensörlerden gelir, gerçek sensörle doğrulanmamıştır. Bkz. [docs/field-module.md](docs/field-module.md) ve
[docs/project-status.md](docs/project-status.md).

## Risk Motoru

Her panonun son 10 reading'lik penceresi; sıcaklık, akım, nem ve trend
(değişim hızı) component'lerinin ağırlıklı toplamı + korelasyon bonusları
ile 0-100 arası bir skora çevrilir. Kaynak: `apps/api/src/risk-engine`.
Detaylı formül/ağırlıklar için bkz. `apps/api/src/risk-engine/risk-engine.config.ts`.

## Dashboard

React + Vite tabanlı, backend'e polling ile bağlanan bir dashboard:
**Overview**, **Panels**, **Panel Detail** ve **Alarms** sayfaları. Bkz.
"Demoyu Çalıştırma" bölümü.

## Bildirimler

HIGH/CRITICAL seviyesinde yeni bir alarm oluştuğunda Notification Service,
severity'ye göre (HIGH → SMS, CRITICAL → SMS + WhatsApp) bildirim gönderir.
Hackathon aşamasında gerçek, ücretli bir SMS/WhatsApp servisine bağımlı
olunmaz: `DemoNotificationProvider` gerçek mesaj göndermez, credential
kullanmaz; bildirim lifecycle'ını (PENDING → SENT/FAILED) terminale
okunabilir şekilde loglar ve `Notification` tablosunda audit trail olarak
saklar. Mimari, gerçek bir SMS/WhatsApp gateway'i ile (risk engine
değişmeden) kolayca değiştirilebilecek şekilde tasarlanmıştır — bkz.
[docs/architecture.md](docs/architecture.md#asama-6---alarm-ve-emergency-notification-system).

`NOTIFICATION_PROVIDER=http` ile yapılandırılabilir bir HTTP gateway
sağlayıcısı da vardır: her kanala birden fazla alıcı tanımlanabilir, hata
durumunda yeniden denenir ve gönderim arka planda yapıldığı için yavaş bir
gateway veri girişini bekletmez. Gerçek hesap olmadan denemek için yerel bir
gateway emülatörü içerir (`npm run mock:sms`). Gerçek bir gateway, modem ya da
WhatsApp hesabıyla denenmemiştir. Politika ve sahada çalışma tasarımı:
[docs/notification-policy.md](docs/notification-policy.md).

```bash
# Terminal 1: emülatör (ilk 2 isteği bilerek 503 döner)
MOCK_GATEWAY_FAIL_FIRST=2 npm run mock:sms

# Terminal 2: API'yi http sağlayıcıyla başlat, ardından npm run demo:critical
NOTIFICATION_PROVIDER=http NOTIFICATION_GATEWAY_URL=http://localhost:4010/send \
SMS_RECIPIENT="+905550000001,+905550000002" npm run dev:api
```

## SCADA / Modbus

SCADA Gateway (`apps/scada-gateway`), GRID UP'ın hesapladığı risk skoru ve
sensör verilerini mevcut bir SCADA sistemine **Modbus TCP** üzerinden
(read-only) sunan ayrı bir adapter servisidir. Veritabanına doğrudan
bağlanmaz; backend'deki `GET /scada/panels` snapshot endpoint'ini poll eder.
Tam register haritası (ark flaş ve akustik için 41001+ genişletilmiş blok
dahil) için bkz. [docs/modbus-register-map.md](docs/modbus-register-map.md).

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

## On-Premise Dağıtım

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

## Ölçeklenebilirlik Testi

100 pano / 600 sensör (pano başına 6 sensör) ölçeğinde, mevcut 5 demo panosunu
bozmadan, izole/geçici test fixture'ları ile gerçek ölçüm almak için:

```bash
node apps/api/scripts/scada-scale-test.mjs
```

En son ölçüm (bkz. [docs/scalability.md](docs/scalability.md)). API tek istekte
en fazla 500 okuma kabul ettiği için test iki biçimde ölçer: 500'lük parçalarla
gönderen bir gateway ve kendi küçük batch'ini eşzamanlı gönderen 100 modül:

```
100 panels | 600 sensors | 600 readings/tick | 5 ticks per mode
Gateway (500-reading chunks)  : average tick ≈ 1482 ms, 0 failed
100 modules, concurrent       : average tick ≈ 206 ms,  0 failed
```

Bu bir **measured prototype benchmark'ıdır**, production garantisi değildir.

## Field Module Konsepti

Gerçek saha dağıtımında simülatörün yerini alacak fiziksel donanım konsepti
— sensör yaklaşımı, low-risk installation prensipleri, haberleşme mimarisi,
BOM ve 1600 kVA AG panel deployment konsepti dahil:

| Doküman | İçerik |
| ------- | ------ |
| [docs/field-module.md](docs/field-module.md) | Genel konsept, sensör yaklaşımı, future extensions |
| [docs/field-data-contract.md](docs/field-data-contract.md) | Field → GRID UP veri sözleşmesi |
| [docs/hardware-architecture.md](docs/hardware-architecture.md) | Donanım blok diyagramı |
| [docs/electronic-design.md](docs/electronic-design.md) | Devre şeması, pin ve bileşen tablosu |
| [docs/firmware-flow.md](docs/firmware-flow.md) | Firmware akış diyagramı |
| [docs/field-conditions.md](docs/field-conditions.md) | Sıcaklık, manyetik alan ve çevre etkileri (tasarım yaklaşımı) |
| [docs/installation-and-failure-analysis.md](docs/installation-and-failure-analysis.md) | Kurulum yaklaşımı ve arıza modları analizi (FMEA) |
| [docs/notification-policy.md](docs/notification-policy.md) | Bildirim politikası ve SMS/WhatsApp gateway entegrasyonu |
| [docs/field-installation.md](docs/field-installation.md) | Enclosure/kurulum konsepti |
| [docs/panel-deployment-concept.md](docs/panel-deployment-concept.md) | 1600 kVA AG panel deployment konsepti |
| [docs/bom.md](docs/bom.md) | Demo ve production BOM |

> Field Module bugün iki biçimde bulunur: **simülatör** ve **ESP32
> firmware'i (Wokwi simülasyonu)** — bkz.
> [docs/final-architecture.md](docs/final-architecture.md). Gerçek bir kart ya
> da gerçek sensör inşa edilmedi; firmware yalnızca derlenir, birim testlidir ve
> Wokwi'de çalıştırılmıştır. Özel bir PCB yerleşimi çizilmemiştir.

## Field Module Firmware (ESP32)

`firmware/` altındaki firmware, sensörleri okur, kısa süreli tamponlar ve API'ye
gönderir. Kod iki katmandır: platformdan bağımsız **C çekirdeği** (`firmware/core`,
okuma, tamponlama, provizyon ve gönderim mantığı) ve ESP-IDF v5.5 için **ESP32
katmanı** (`firmware/esp32`: Wi-Fi, HTTP, SNTP, DHT22, ADC). API'ye ulaşamazsa
örneklemeye devam eder, bağlanınca biriken veriyi tek seferde yollar.

```bash
cd firmware && make test        # çekirdek mantığın birim testleri (sahte HAL, donanım gerekmez)

# ESP32 derlemesi (ESP-IDF v5.5 kurulu olmalı; tr_TR locale'inde assembler hata verir):
export LC_ALL=C LANG=C && . ~/esp/esp-idf/export.sh
cd firmware/esp32 && idf.py build
```

Wokwi'de çalıştırmak için `firmware/wokwi/` klasörünü VS Code'da Wokwi
eklentisiyle açın; API'nin `3000` portunda çalışıyor olması yeterlidir
(`http://host.wokwi.internal:3000`). Modül açılışta panoyu ve sensörlerini API'den
bulur, sonra okumaları gönderir. Wokwi çalışırken aynı panoya (PANO-003) veri
yazdığı için, `npm run demo:critical` denemeden önce Wokwi'yi durdurun.

| Doküman | İçerik |
| ------- | ------ |
| [firmware/esp32/README.md](firmware/esp32/README.md) | Derleme, yapılandırma ve doğrulama durumu |
| [firmware/wokwi/README.md](firmware/wokwi/README.md) | Wokwi devresi, pin tablosu, ADC dönüşümleri ve ölçülen LDR/akustik davranışı |
| [docs/electronic-design.md](docs/electronic-design.md) | Devre şeması, pin ve bileşen tablosu |
| [docs/firmware-flow.md](docs/firmware-flow.md) | Firmware akış diyagramı |

## Gereksinimler

- [Node.js](https://nodejs.org/) 20+ (geliştirme Node 24 ile test edildi)
- npm 10+
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (yalnızca PostgreSQL container'ı için; Docker Compose dahildir)

## Demoyu Çalıştırma

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
npm run demo:arc         # ARC_FLASH, TARGET_PANEL_CODE=PANO-003 (diğer sensörler normal kalır)
```

Bu komutlar `apps/simulator/.env` dosyasını **değiştirmez** — sadece bu
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
| `npm run demo:arc`          | Simülatörü ARC_FLASH + PANO-003 ile başlatır (`.env`'i değiştirmez) |
| `npm run dev:scada`         | SCADA Gateway'i (Modbus TCP server) başlatır            |
| `npm run scada:read -- <PANO-KOD>` | Modbus TCP test client'ı ile bir panonun register'larını okur |
| `npm run mock:sms`           | Yerel SMS/WhatsApp gateway emülatörünü başlatır (gerçek mesaj göndermez) |
| `make test` (firmware/)      | Firmware çekirdeğinin birim testlerini çalıştırır       |
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

## Proje Durumu

Sistemin hangi özelliklerinin bugün gerçekten çalıştığını, hangilerinin
planlama/konsept seviyesinde olduğunu gösteren tam matris için bkz.
[docs/project-status.md](docs/project-status.md).

## Production Öncesi Değerlendirmeler

Aşağıdakiler, hackathon prototipinde implement **edilmemiştir**, production
öncesi değerlendirilmesi gereken noktalardır (tam liste:
[docs/on-premise-architecture.md](docs/on-premise-architecture.md#production-considerations-yalnızca-dokümantasyon--bu-aşamada-implement-edilmemiştir)):

- API authentication (API key/mTLS)
- TLS / secure gateway (IT/OT sınırında)
- Network segmentation ve firewall allow-list (Modbus TCP için)
- Gerçek SMS/WhatsApp gateway ile doğrulama (`http` sağlayıcı ve emülatör hazır; gerçek modem/hesapla denenmedi)
- Gerçek ADM/GDZ SCADA bağlantısı
- Gerçek endüstriyel sensör/vendor seçimi ve saha doğrulaması (bkz. [docs/field-module.md](docs/field-module.md))
- Field module'ün gerçek kartta ve gerçek sensörlerle denenmesi, sensör kalibrasyonu ve özel PCB yerleşimi (bkz. [docs/electronic-design.md](docs/electronic-design.md))
- Bildirimde kanal yedeği ve yükseltme (escalation) kuralları (onaylanmayan alarm için üst kademeye otomatik bildirim)

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
| [docs/electronic-design.md](docs/electronic-design.md) | Devre şeması, pin ve bileşen tablosu |
| [docs/firmware-flow.md](docs/firmware-flow.md) | Firmware akış diyagramı |
| [docs/notification-policy.md](docs/notification-policy.md) | Bildirim politikası ve SMS/WhatsApp gateway entegrasyonu |
| [docs/field-installation.md](docs/field-installation.md) | Enclosure/kurulum konsepti |
| [docs/panel-deployment-concept.md](docs/panel-deployment-concept.md) | 1600 kVA AG panel deployment konsepti |
| [docs/bom.md](docs/bom.md) | Demo ve production BOM |
| [docs/scalability.md](docs/scalability.md) | 100 panel ölçek testi ve mimarisi |
| [firmware/esp32/README.md](firmware/esp32/README.md) | ESP32 firmware'i: derleme ve doğrulama durumu |
| [firmware/wokwi/README.md](firmware/wokwi/README.md) | Wokwi devresi, pin tablosu ve ADC dönüşümleri |
| [docs/demo-script.md](docs/demo-script.md) | Jüri demo akışı |
| [docs/demo-checklist.md](docs/demo-checklist.md) | Demo öncesi kontrol listesi ve acil durum planı |
| [docs/project-status.md](docs/project-status.md) | Uygulanan ve gelecek özellikler matrisi |
| [docs/code-freeze.md](docs/code-freeze.md) | Son doğrulama sonuçları, bilinen sınırlar |
