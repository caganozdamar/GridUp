# Final Demo Script (Aşama 8)

3-5 dakikalık jüri demosu için adım adım akış. Demoya başlamadan önce
[demo-checklist.md](demo-checklist.md) içindeki pre-flight kontrolünü
tamamlayın.

## STEP 1 — Normal Operation

Dashboard'da Overview sayfasını açın.

Göster:

- 5 panel (PANO-001..005)
- Hepsi NORMAL
- Aktif alarm yok
- Canlı sensör verisi (birkaç saniyede bir güncelleniyor)

Anlat:

> "GRID UP continuously evaluates temperature, cable temperature, humidity
> and current."

## STEP 2 — Failure Starts

Ayrı bir terminalde:

```bash
npm run demo:critical
```

Bu komut, PANO-003 üzerinde `COMBINED_FAILURE` senaryosunu başlatır (diğer
tüm panolar NORMAL kalır). `apps/simulator/.env` dosyasını **değiştirmez**
(bkz. `scripts/demo.mjs`).

> **Uyarı:** Wokwi simülasyonu açıksa kapatın. Firmware da PANO-003'e veri
> yazar; ikisi birden çalışırsa panonun "son değeri" iki kaynak arasında gidip
> gelir ve kart karışık görünür. Wokwi'yi STEP 8'de, bu adımlardan sonra açın.

İsteğe bağlı: ark flaşı göstermek için `npm run demo:arc` (yalnızca
`ARC_FLASH`, diğer sensörler normal kalır, tek başına CRITICAL üretir).

Dashboard'u refresh etmeden izleyin — sensör değerlerinin (özellikle cable
temperature ve current) yükseldiğini gösterin.

## STEP 3 — Early Warning

Panel Detail sayfasında (PANO-003) risk score geçişini gösterin:

```
NORMAL → WARNING → HIGH → CRITICAL
```

Risk Components panelinde `temperature` / `current` / `humidity` / `trend`
component skorlarını ve Anomaly listesindeki reasons'ları gösterin (örn.
"Cable temperature is rising rapidly", "Current and cable temperature are
rising together").

## STEP 4 — Notification

Alarms sayfasına geçin. PANO-003 için yeni bir CRITICAL alarm ve
**Notification Delivery** tablosunda:

```
SMS:      SENT
WhatsApp: SENT
```

görün.

Anlat:

> "Demo provider is used during the hackathon; the provider interface can be
> connected to the organization's approved messaging gateway."

İsteğe bağlı, gerçek HTTP yolunu göstermek için (bkz.
[notification-policy.md](notification-policy.md)): önce `MOCK_GATEWAY_FAIL_FIRST=2
npm run mock:sms`, sonra API'yi `NOTIFICATION_PROVIDER=http
NOTIFICATION_GATEWAY_URL=http://localhost:4010/send` ile başlatıp senaryoyu
tekrar tetikleyin. Emülatör penceresinde gelen mesajı ve ilk iki isteğin bilerek
503 ile reddedilip yeniden denendiğini gösterin. Bu, gerçek bir SMS/WhatsApp
hesabıyla denenmemiştir; söylerken bunu belirtin.

## STEP 5 — SCADA

Ayrı bir terminalde:

```bash
npm run scada:read -- PANO-003
```

Göster:

```
Risk Score      : CRITICAL bandında (80-100)
Cable Temperature
Current
Active Alarm    : YES
Data Quality    : VALID
```

Anlat:

> "GRID UP does not require replacing the existing SCADA. It exposes the
> calculated risk through a read-only Modbus TCP gateway."

## STEP 6 — Architecture

On-premise mimariyi gösterin (bkz. [on-premise-architecture.md](on-premise-architecture.md)
diyagramı veya `docker-compose.onprem.yml`). Public cloud kullanılmadığını
vurgulayın.

## STEP 7 — Scale

100 panel test sonucunu gösterin (bkz. [scalability.md](scalability.md)):

```
100 panels | 600 sensors | 3000 readings per mode | 0 failed
Gateway (500-reading chunks): average tick ≈ 1482 ms
100 modules, concurrent:      average tick ≈ 206 ms
```

Anlat:

> "This is a measured prototype benchmark, not a production guarantee."

## STEP 8 — Physical Module

Önce devre şemasını (`docs/assets/field-module-schematic.svg`, bkz.
[electronic-design.md](electronic-design.md)) ve firmware akış diyagramını
(bkz. [firmware-flow.md](firmware-flow.md)) gösterin. Sonra canlı gösterim:

1. `npm run demo:normal` ile simülatörü baseline'a alın, API'nin çalıştığından
   emin olun.
2. `firmware/wokwi/` klasörünü VS Code'da Wokwi eklentisiyle açıp simülasyonu
   başlatın. Seri konsolda `[module] provisioned 6 sensors` ve her tick'te
   `[tick N] ... buffered=1` satırlarını gösterin.
3. Wokwi'de potansiyometreyi (akım) ya da LDR'yi (ışığı azaltmak ark flaş
   değerini yükseltir) kaydırın; dashboard'da PANO-003'ün değerlerinin ve
   skorunun değiştiğini gösterin.

Anlat:

> "The firmware runs on the same API contract as the simulator. In the field
> a low-cost ESP32-class module replaces it, and the central software stays the
> same. Here it runs in a simulator; it has not been tested on a real board."

Dürüst çerçeve: firmware bugün yalnızca Wokwi'de çalıştırılmıştır, gerçek kart
ve gerçek sensörle denenmemiştir.

## Demo sonrası

Simülatörü baseline'a döndürün:

```bash
npm run demo:normal
```

(Bkz. [demo-checklist.md](demo-checklist.md) "Emergency fallback" bölümü
sorun yaşanması durumunda.)
