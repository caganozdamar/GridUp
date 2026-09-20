# Final Demo Script (Aşama 8-9)

3-5 dakikalık jüri demosu için adım adım akış. Demoya başlamadan önce
[demo-checklist.md](demo-checklist.md) içindeki pre-flight kontrolünü
tamamlayın. Aşama 9'da eklenen decision-support özelliklerinin arka planı
için bkz. [decision-support.md](decision-support.md).

## STEP 1 — Normal Operation

Dashboard'da Overview sayfasını açın.

Göster:

- 5 panel (PANO-001..005)
- Hepsi NORMAL
- Aktif alarm yok
- Data Health kolonu: hepsi `VALID`
- Canlı sensör verisi (birkaç saniyede bir güncelleniyor)
- Alt bölümde **Early Warning Activity** (Early Warnings / Critical
  Escalations / Notifications Delivered) — gerçek DB sayaçları, ana 6 KPI
  kartının altında, daha düşük görsel hiyerarşide

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

Risk Analysis bölümünde **Critical Threshold Estimate** kartını gösterin
(trend-based, ML/AI değil):

```
Critical Threshold Estimate
≈ X min
Risk is rising at +Y points/min.
```

> Bilinen sınırlama: `COMBINED_FAILURE` senaryosu çok hızlı escalate olduğu
> için bu `RISING` durumu birkaç saniye görünüp doğrudan `CRITICAL`'a
> geçebilir — bkz. [decision-support.md](decision-support.md#limitations).
> Kart altındaki *"Estimate assumes the recent trend continues and is not a
> failure prediction."* cümlesini vurgulayın.

**Recommended Actions** bölümünü gösterin — deterministic, inspection-oriented
öneriler (örn. "Inspect conductor loading and compare current with expected
operating conditions.") ve altındaki *"Inspection guidance only. Follow
authorized electrical safety procedures."* notunu.

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

Panel Detail'e dönüp **Event Timeline**'ı gösterin (newest-first, compact
enterprise log):

```
HIGH → CRITICAL     Risk level changed
Alarm created
SMS sent
WhatsApp sent
WARNING → HIGH       Risk level changed
```

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
100 panels | 400 sensors | 2000 readings | 0 failed
Average batch processing ≈ 1006.9 ms
```

Anlat:

> "This is a measured prototype benchmark, not a production guarantee."

## STEP 8 — Physical Module

Field Module blok diyagramını gösterin (bkz.
[hardware-architecture.md](hardware-architecture.md)).

Anlat:

> "Real deployment replaces the simulator with a low-cost field module. The
> central software architecture remains the same."

## Demo sonrası

Simülatörü baseline'a döndürün:

```bash
npm run demo:normal
```

(Bkz. [demo-checklist.md](demo-checklist.md) "Emergency fallback" bölümü
sorun yaşanması durumunda.)
