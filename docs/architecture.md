# Mimari Genel Bakis

## Amac

OG hucreleri ve AG panolarda kritik arizalar gerceklesmeden once ortaya cikabilecek belirtileri (ortam sicakligi, kablo/yuzey sicakligi, nem, akim) izleyip her pano icin 0-100 arasinda bir risk skoru uretmek.

Risk seviyeleri:

| Skor    | Seviye   |
| ------- | -------- |
| 0-29    | NORMAL   |
| 30-59   | WARNING  |
| 60-79   | HIGH     |
| 80-100  | CRITICAL |

## Sistem Akisi

```
Sensor/Simulator
      |
Ingestion API (NestJS)
      |
Risk Engine
      |
Anomaly
      |
Alarm
      |
Notification Service
      |
Provider
   /-------\
 SMS     WhatsApp
```

Alarm olustuktan sonra Notification Service, alarm'in severity'sine gore (HIGH -> SMS, CRITICAL -> SMS + WhatsApp) bir veya iki kanaldan bildirim gonderir ve sonucu (SENT/FAILED) `Notification` tablosunda audit trail olarak saklar (bkz. "Asama 6" bolumu).

## Durum

Monorepo temeli, backend/frontend iskeletleri, veritabani altyapisi, sentetik veri simulatoru, risk/anomaly/alarm motoru, gercek zamanli monitoring dashboard'u, alarm/emergency notification sistemi (Asama 6), SCADA/Modbus TCP entegrasyonu + on-premise Docker mimarisi (Asama 7) ve field module konsepti + final demo hazirligi (Asama 8) tamamlandi.

## Asama 6 - Alarm ve Emergency Notification System

Hackathon asamasinda gercek, ucretli bir SMS/WhatsApp servisine baglanmak yerine, notification lifecycle'ini uctan uca gosteren bir **DemoNotificationProvider** kullanilir:

- Gercek SMS veya WhatsApp mesaji GONDERMEZ, gercek credential/API key kullanmaz.
- Bildirim geldiginde terminale okunabilir bir log yazar (kanal, alici, mesaj, durum).
- `apps/api/src/notifications/notification-provider.interface.ts` icindeki `NotificationProvider` arayuzunu implemente eder; ileride yetkilendirilmis gercek bir SMS/WhatsApp gateway'i (orn. Twilio, Meta WhatsApp Business API) bu arayuzu implemente eden yeni bir provider ile, `NotificationsService`'i veya Risk Engine'i degistirmeden takilabilir.

Severity -> kanal mapping'i (`apps/api/src/notifications/notifications.config.ts`):

| Severity | Kanallar       |
| -------- | -------------- |
| HIGH     | SMS            |
| CRITICAL | SMS + WhatsApp |

Notification'lar yalnizca yeni bir Alarm CREATE event'inde olusturulur (2 saniyelik ingestion tick'lerinde tekrar tetiklenmez); ayni `alarmId` + `channel` kombinasyonu icin veritabani seviyesinde (`@@unique([alarmId, channel])`) duplicate korumasi vardir. Notification/provider hatasi, sensor ingestion / risk hesaplama / alarm olusturma pipeline'ini asla etkilemez - hata durumunda ilgili `Notification` kaydi `FAILED` olarak isaretlenir ve `errorMessage` alanina yazilir.

## Asama 7 - SCADA / Modbus TCP Entegrasyonu ve On-Premise Mimari

GRID UP tarafindan hesaplanan risk skoru, sensor degerleri ve alarm/anomali
durumu, ayri bir **SCADA Gateway** (`apps/scada-gateway`) araciligiyla mevcut
bir SCADA sistemine **Modbus TCP** uzerinden (read-only) sunulabilir hale
getirildi:

- SCADA Gateway, veritabanina dogrudan baglanmaz; GRID UP API'sindeki
  `GET /scada/panels` snapshot endpoint'ini poll eder.
- Her pano icin 10 holding register'lik sabit bir blok tanimlidir (risk
  score, risk level, sensor degerleri, active alarm, panel status, active
  anomaly count, data quality); mapping merkezi olarak
  `apps/scada-gateway/src/register-map.ts`'te tutulur ve 100 panoya kadar
  (1000 register) collision'siz calisir.
- Risk Engine, Modbus register detaylarini hicbir sekilde bilmez; entegrasyon
  tamamen ayri bir adapter katmanidir.
- Gercek ADM/GDZ SCADA baglantisi ve gercek PLC/RTU donanimi bu asamanin
  kapsaminda DEGILDIR; prototip, `npm run scada:read` ile dogrulanabilen
  calisan bir Modbus TCP server + test client'tir.
- Detaylar icin bkz. [docs/modbus-register-map.md](modbus-register-map.md).

Ayrica, `docker-compose.onprem.yml` ile PostgreSQL + API + Web + SCADA
Gateway'in tek bir private Docker network uzerinde, public cloud'a bagimli
olmadan calisabildigi bir on-premise dagitim dogrulandi; gunluk gelistirme
akisi (`docker-compose.yml`, `npm run dev:*`) DEGISTIRILMEDI. Detaylar icin
bkz. [docs/on-premise-architecture.md](on-premise-architecture.md).

## Asama 8 - Field Module Konsepti ve Final Demo Hazirligi

Bu asamada yeni bir backend feature'i **eklenmedi**; amac mevcut, calisan
sistemi saha uygulanabilirligi ve final demo acisindan tamamlamakti:

- Gercek saha donanimi (Field Module) icin bir konsept doku olusturuldu:
  sensor yaklasimi (mevcut 4 `SensorType` ile birebir uyumlu), low-risk
  installation prensipleri, haberlesme mimarisi, donanim blok diyagrami,
  enclosure konsepti, 1600 kVA AG panel deployment konsepti ve kavramsal
  BOM. Bkz. [field-module.md](field-module.md) ve orada linklenen diger
  Asama 8 dokumanlari.
- Bugunku prototipte **Field Module = Simulator** oldugu acikca
  belgelendi (bkz. [final-architecture.md](final-architecture.md)); yani
  gercek donanim devreye girdiginde backend mimarisinde degisiklik
  gerekmez.
- 100 panel olcek testi yeniden calistirilip guncel olculmus sonuclarla
  dokumante edildi (bkz. [scalability.md](scalability.md)).
- Final juri demosu icin adim adim script (`demo-script.md`), pre-flight
  checklist (`demo-checklist.md`) ve iki demo yardimci komutu
  (`npm run demo:normal`, `npm run demo:critical` — `apps/simulator/.env`'i
  degistirmeden calisir) eklendi.
- Implemented vs Future ozelligi net bir matriste ayristirildi (bkz.
  [project-status.md](project-status.md)); `PARTIAL_DISCHARGE`, `ARC_FLASH`,
  `ACOUSTIC` gibi kod tabaninda sadece yorum satirinda var olan sensor
  tipleri "Future" olarak isaretlendi, calisiyormus gibi gosterilmedi.
- Sistem, tum otomatik testler (`typecheck`, `lint`, `build`, `test`,
  `test:e2e`) gecerken ve canli NORMAL -> COMBINED_FAILURE -> NORMAL
  rehearsal'i (SCADA/notification dahil) dogrulanmisken "code freeze"
  durumuna alindi (bkz. [code-freeze.md](code-freeze.md)).

## Gelecek Genisleme Noktalari

- **Sensor girisleri**: `apps/api` altinda simdilik simulator'dan veri kabul edecek, ileride ESP32 gibi edge cihazlarin ayni REST endpoint'lerine veri gonderebilmesi hedeflenir.
- **Gercek SCADA baglantisi**: Asama 7'de kurulan Modbus TCP prototipi, gercek ADM/GDZ SCADA sistemine/PLC-RTU donanimina baglanacak sekilde genisletilebilir (bkz. docs/modbus-register-map.md "Production Considerations").
- **Gercek SMS/WhatsApp gateway'i**: Yukaridaki "Asama 6" bolumunde aciklandigi gibi, `DemoNotificationProvider` yerine `NotificationProvider` arayuzunu implemente eden yetkilendirilmis bir gateway takilabilir.
- **Olceklenme**: En az 100 pano/modul hedefi icin `SensorReading` tablosu zaman bazli sorgular icin indekslenmistir (bkz. `apps/api/prisma/schema.prisma`); ileride time-series optimizasyonu (orn. partitioning) degerlendirilebilir.
- **Public cloud kullanilmaz**: Sistem on-premise/Docker Compose ile calisacak sekilde tasarlanmistir (bkz. docs/on-premise-architecture.md).

## Monorepo Yapisi

```
/apps
  /api      NestJS backend (REST API, Prisma, Anomaly Engine burada yer alacak)
  /web      React + Vite + TypeScript dashboard
/packages
  /shared   Backend ve frontend arasinda paylasilan TypeScript tipleri
/infrastructure  Altyapi/deployment konfigurasyonlari
/docs            Proje dokumantasyonu
docker-compose.yml  Sadece PostgreSQL servisini ayaga kaldirir
```
