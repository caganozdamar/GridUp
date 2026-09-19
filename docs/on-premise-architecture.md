# On-Premise Architecture (Aşama 7)

GRID UP, **public cloud kullanmadan**, ADM/GDZ'nin kendi private network'ü
içinde (on-premise) çalışacak şekilde tasarlanmıştır. Bu doküman hedef
mimariyi, hackathon prototipindeki Docker Compose dağıtımını ve
prototip/production farklarını açıklar.

## Public cloud kullanılmadığının doğrulaması

- Sistemin **hiçbir bileşeni** (PostgreSQL, backend API, dashboard, SCADA
  Gateway, notification provider) bir public cloud servisine (AWS, Azure,
  GCP, Firebase, üçüncü parti SaaS API) bağımlı değildir.
- Tüm servisler tek bir private Docker network üzerinde çalışır
  (`docker-compose.onprem.yml` → `grid-up-onprem` network'ü).
- Notification sistemi (Aşama 6) gerçek bir SMS/WhatsApp sağlayıcısına değil,
  yerel `DemoNotificationProvider`'a bağlıdır (bkz.
  [architecture.md](architecture.md#asama-6---alarm-ve-emergency-notification-system)).
- `npm install` dışında (paket indirmek için) hiçbir çalışma zamanı
  bağımlılığı internet erişimi gerektirmez; sistem internet'siz bir OT
  network'ünde de çalışabilir.

## Hedef mimari

```
                    ADM/GDZ PRIVATE NETWORK
   ┌───────────────────────────────────────────────────────────────┐
   │                                                                │
   │   Field Sensors / Edge Devices (simulator / gelecekte ESP32)  │
   │                         │                                     │
   │                         ▼                                     │
   │                  GRID UP API (NestJS)                         │
   │                         │                                     │
   │                         ▼                                     │
   │                    Risk Engine                                │
   │                         │                                     │
   │                         ▼                                     │
   │                    PostgreSQL                                 │
   │                                                                │
   │   GRID UP API                                                 │
   │      ├──────────────► Web Dashboard (operatör görselleştirme) │
   │      ├──────────────► Notification Provider (SMS/WhatsApp     │
   │      │                 gateway'i / enterprise messaging)      │
   │      └──────────────► SCADA Gateway                           │
   │                             │                                 │
   │                             ▼                                 │
   │                        Modbus TCP (READ-ONLY)                 │
   │                             │                                 │
   │                             ▼                                 │
   │                       Existing SCADA                          │
   │                                                                │
   └───────────────────────────────────────────────────────────────┘

   Public internet / cloud, yukarıdaki core monitoring path'in
   HİÇBİR adımı için gerekli değildir.
```

SCADA entegrasyonu, GRID UP'ın ana business logic'inden (Risk Engine,
Anomaly/Alarm lifecycle) **ayrılmış bir adapter/gateway katmanıdır**: Risk
Engine, Modbus register yazma detaylarını hiçbir şekilde bilmez; SCADA
Gateway sadece `GET /scada/panels` REST endpoint'ini tüketir (bkz.
[modbus-register-map.md](modbus-register-map.md)).

## Hackathon prototipi: Docker Compose dağıtımı

Repo kökündeki [`docker-compose.onprem.yml`](../docker-compose.onprem.yml),
production-benzeri bir on-prem dağıtımı simüle eder:

```
┌─────────────────────────── grid-up-onprem network ───────────────────────────┐
│                                                                                │
│   onprem-postgres  ◄──────────  api (NestJS, :3000)  ◄──────────  web (:8080) │
│                                       ▲                                       │
│                                       │ GET /scada/panels                     │
│                                       │                                       │
│                                 scada-gateway (:1502, Modbus TCP)             │
│                                                                                │
└────────────────────────────────────────────────────────────────────────────────┘
```

| Servis | Image | Host portu | Açıklama |
| ------ | ----- | ----------- | -------- |
| `onprem-postgres` | `postgres:16-alpine` | (yok — sadece private network) | Kalıcı veri (`onprem_postgres_data` named volume) |
| `api` | `apps/api/Dockerfile` | `3000` | NestJS backend + Prisma; başlangıçta `prisma migrate deploy` çalıştırır |
| `web` | `apps/web/Dockerfile` (nginx) | `8080` | Statik build edilmiş React dashboard |
| `scada-gateway` | `apps/scada-gateway/Dockerfile` | `1502` (demo) | Modbus TCP server; API'yi private network üzerinden (`http://api:3000`) poll eder |

Kullanım:

```bash
docker compose -f docker-compose.onprem.yml up -d --build
docker compose -f docker-compose.onprem.yml down
```

Bu stack **gerçekten build edilip çalıştırılarak** doğrulanmıştır: tüm
image'lar başarıyla build olur, `onprem-postgres` healthy olduktan sonra
`api` ayağa kalkar (migration'ları uygular), `web` nginx üzerinden 200
döner, `scada-gateway` `api` container'ına private network üzerinden
bağlanıp Modbus TCP register'larını sunar.

### ÖNEMLİ: proje adı izolasyonu

`docker-compose.onprem.yml`, `docker-compose.yml` (günlük geliştirme
ortamı) ile **aynı dizinden** çalıştırılabilir olmalıdır. Docker Compose,
proje adını (ve dolayısıyla hangi container'ların "aynı servis" sayılacağını)
varsayılan olarak **dizin adından** türetir. İki compose dosyası aynı dizin
adını paylaştığı ve aynı servis anahtarını ("postgres") kullandığı için, bu
dosya ilk yazılırken **gerçekten** `docker compose -f
docker-compose.onprem.yml up` çalıştırıldığında geliştirme ortamının
`grid-up-postgres` container'ı yanlışlıkla "recreate" edilmiş, farklı bir
volume'e bağlanmıştı (veri, ayrı named volume sayesinde kaybolmadı ve `docker
compose -f docker-compose.yml up -d postgres` ile geri alındı). Bunu kalıcı
olarak önlemek için bu dosya artık:

- Üstte açıkça `name: grid-up-onprem` tanımlar (kendi proje adı),
- Postgres servisinin key'ini `onprem-postgres` olarak adlandırır (sade
  `postgres` değil),
- Ayrı bir `container_name` ve ayrı bir named volume (`onprem_postgres_data`)
  kullanır.

**Operasyonel kural:** Bu iki compose dosyasını aynı anda/sırayla
kullanırken, herhangi bir üçüncü compose dosyası eklenecekse mutlaka açıkça
bir proje adı (`name:` alanı ya da `docker compose -p <isim>`) verin;
aksi halde Compose'un "hangi container hangi servise ait" cevabı dizine ve
servis adına göre örtük olarak belirlenir ve beklenmeyen `Recreate`'lere yol
açabilir.

## Prototip vs Production farkları

| Konu | Hackathon prototipi | Production |
| ---- | -------------------- | ---------- |
| SCADA bağlantısı | Yok; sadece Modbus TCP server'ın çalıştığı gösterilir | Gerçek ADM/GDZ SCADA sistemine bağlanır |
| Modbus portu | `1502` (ayrıcalıksız port, dev/demo kolaylığı) | `502` (standart), uygun ağ katmanında map/expose edilebilir |
| Notification | `DemoNotificationProvider` (gerçek SMS/WhatsApp göndermez) | Yetkilendirilmiş SMS/WhatsApp gateway (`NotificationProvider` arayüzü implemente edilerek eklenir) |
| API image'ları | `node_modules` prod/dev ayrımı yapılmadan kopyalanır (basitlik) | Multi-stage'de `npm prune --omit=dev` ile küçültülmüş, güvenlik taraması yapılmış image |
| Authentication | Yok (hackathon kapsamı dışı) | Zorunlu (bkz. aşağıdaki "Production Considerations") |
| TLS | Yok (private network, plaintext) | IT/OT sınırında TLS/secure gateway değerlendirilmeli |
| Ölçek doğrulaması | 100 pano, izole/geçici test verisiyle (bkz. README "100 Panel Scalability Test") | Gerçek 100+ panolu saha verisiyle sürekli yük testi |

## Production Considerations (yalnızca dokümantasyon — bu aşamada implement edilmemiştir)

- **SCADA Gateway read-only olmalı:** Prototip zaten write vector'u
  implemente etmiyor (bkz. modbus-register-map.md); production'da da bu
  garantinin korunması, SCADA/PLC tarafının GRID UP'a asla komut
  gönderememesi açısından kritiktir.
- **Network segmentation:** SCADA Gateway, sadece trusted OT network'ü ile
  GRID UP API'si arasında bir köprü olmalı; iki taraf da ayrı VLAN/subnet'te
  tutulup aralarında sıkı bir firewall politikası uygulanmalıdır.
- **Firewall allow-list:** Modbus TCP portuna (502/1502) sadece bilinen
  SCADA/PLC IP adreslerinden erişime izin verilmeli.
- **Modbus TCP yalnızca trusted OT network içinde:** Bu port **hiçbir zaman**
  public internet'e veya genel kurumsal (IT) ağa expose edilmemelidir.
- **API authentication:** Prototipte yoktur; production'da GRID UP API'sinin
  (özellikle ingestion ve SCADA snapshot endpoint'leri) en az API key/mTLS
  seviyesinde kimlik doğrulaması olmalıdır.
- **TLS / secure gateway:** IT/OT sınırında (örn. web dashboard ve
  notification trafiği için) TLS sonlandırması ve/veya bir secure
  gateway/reverse-proxy değerlendirilmelidir.

## İlgili dosyalar

| Dosya | Amaç |
| ----- | ---- |
| `docker-compose.yml` | Günlük geliştirme ortamı (sadece PostgreSQL, host portu 55432) — **değiştirilmedi** |
| `docker-compose.onprem.yml` | Production-benzeri on-prem stack (postgres + api + web + scada-gateway) |
| `apps/api/Dockerfile`, `apps/web/Dockerfile`, `apps/scada-gateway/Dockerfile` | Her servisin production image tanımı |
| `.dockerignore` | Build context'ten `node_modules`/`dist`/`.git` gibi gereksiz dosyaları hariç tutar |
| `docs/modbus-register-map.md` | SCADA/Modbus entegrasyonunun detaylı register haritası |
