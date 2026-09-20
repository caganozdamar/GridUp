# Modbus TCP Register Map (Aşama 7 — SCADA Gateway)

Bu doküman, `apps/scada-gateway`'in GRID UP verisini bir SCADA sistemine
sunduğu Modbus TCP holding register haritasını tanımlar. Merkezi kod
kaynağı `apps/scada-gateway/src/register-map.ts`'tir — register numarası
başka hiçbir dosyada hard-code edilmez.

> MPR-53CS sütun düzeninde (ADDRESS/HEX/R-W/RANGE/UNIT/MULTIPLIER/FORMAT) doldurulmuş
> tablo ve CSV için bkz. [modbus-mapping-table.md](modbus-mapping-table.md).

## Kapsam ve amaç

GRID UP tarafından hesaplanan risk skoru, sensör değerleri ve alarm/anomali
durumunun mevcut bir SCADA sistemine **Modbus TCP** üzerinden aktarılabildiğini
gösteren çalışan bir prototip. Gerçek ADM/GDZ SCADA sistemine bağlanılmaz;
gerçek PLC/RTU donanımı kullanılmaz.

- **Protokol:** Modbus TCP
- **Demo portu (varsayılan):** `1502`
- **Production standart portu:** `502`
- **Fonksiyon:** Sadece Read Holding Registers (FC03/FC04) — **READ-ONLY**
- **Kaynak:** SCADA Gateway, GRID UP veritabanına doğrudan bağlanmaz; verileri
  `GET /scada/panels` REST endpoint'inden çeker.

### Neden 502 değil, 1502?

Standart Modbus TCP portu (502) birçok işletim sisteminde ayrıcalıklı
(privileged, <1024) bir porttur ve geliştirme ortamında başka bir servisle
çakışma riski taşır. Bu yüzden geliştirme/demo ortamında `MODBUS_TCP_PORT=1502`
kullanılır. **Production dağıtımında, uygun olduğunda servis standart Modbus
TCP portu 502'ye map edilebilir/expose edilebilir** (örn. Docker port mapping
veya reverse-proxy ile).

## Addressing notu (0-based vs 1-based)

Modbus holding register'lar geleneksel olarak "40001" gibi **1-based/label**
adreslerle anılır (Modicon konvansiyonu), ama telin üzerindeki PDU (ve bu
projede kullanılan `modbus-serial` kütüphanesinin vector callback'leri)
**0-based** adres kullanır.

```
label (40001 tabanlı) = 40001 + zeroBasedAddress
```

Bu dokümandaki tüm register numaraları **label (40001 tabanlı)** olarak
verilmiştir; kod tarafında (`register-map.ts`) karşılık gelen 0-based adres
`getRegisterStartAddress()` ile hesaplanır.

## Holding register stratejisi

Her pano için **10 sabit holding register** ayrılır (`REGISTERS_PER_PANEL = 10`).
Prototip, **maksimum 100 pano** (`MAX_SUPPORTED_PANELS = 100`) için adres alanı
ayırır → toplam **1000 holding register**.

| Pano  | Blok Index | Başlangıç adresi (0-based) | Başlangıç label |
| ----- | ---------- | -------------------------- | ---------------- |
| PANO-001 | 0   | 0    | 40001 |
| PANO-002 | 1   | 10   | 40011 |
| PANO-003 | 2   | 20   | 40021 |
| ...      | ... | ...  | ...   |
| PANO-100 | 99  | 990  | 40991 |

### Pano → blok eşlemesi (deterministic mapping)

Eşleme, panonun **database UUID'sinden değil**, panel **code**'undaki
sıra numarasından türetilir:

```
PANO-<NNN>  ->  blockIndex = NNN - 1
```

Bu sayede eşleme:

- **Deterministic**'tir (aynı kod her zaman aynı adrese gider).
- Panonun veritabanına ekleniş sırasından **bağımsızdır**.
- `PANO-101` gibi 100 pano sınırını aşan veya `PANO-xxx` formatına uymayan
  kodlar için açıkça hata fırlatır (gateway bu kodları loglayıp atlar, çökmez).

## Register offset tablosu (her 10-register bloğun içi)

| Offset | Alan | Tip / Birim | Açıklama |
| ------ | ---- | ----------- | -------- |
| 0 | Risk Score | Integer, 0-100 | Panonun güncel risk skoru (clamp edilmiş) |
| 1 | Risk Level | Enum (aşağıda) | 0=NORMAL, 1=WARNING, 2=HIGH, 3=CRITICAL |
| 2 | Ambient Temperature | Integer, °C × 10 | 27.4°C → 274 |
| 3 | Cable Temperature | Integer, °C × 10 | 63.7°C → 637 |
| 4 | Humidity | Integer, % × 10 | 47.2% → 472 |
| 5 | Current | Integer, A × 10 | 142.6A → 1426 |
| 6 | Active Alarm | Bool (0/1) | 0=NO, 1=YES |
| 7 | Panel Status | Enum (aşağıda) | 0=OFFLINE, 1=ONLINE, 2=MAINTENANCE |
| 8 | Active Anomaly Count | Integer | Panonun aktif (resolve edilmemiş) anomali sayısı |
| 9 | Data Quality / Validity | Bool (0/1) | 0=INVALID/STALE, 1=VALID |

### Enum eşlemeleri

```
Risk Level:     NORMAL=0  WARNING=1  HIGH=2  CRITICAL=3
Panel Status:   OFFLINE=0 ONLINE=1  MAINTENANCE=2
Active Alarm:   NO=0      YES=1
Data Quality:   INVALID=0 VALID=1
```

Bu eşlemeler `apps/scada-gateway/src/register-map.ts` içindeki
`MODBUS_RISK_LEVEL`, `MODBUS_PANEL_STATUS`, `MODBUS_BOOL`,
`MODBUS_DATA_QUALITY` sabitlerinde tek yerde tanımlıdır.

## Genişletilmiş blok: ark flaş ve akustik / kısmi deşarj

Çekirdek 10-register'lık bloğun adresleri **değişmemiştir** (mevcut SCADA
eşlemeleri bozulmaz). Ark flaş ve akustik/kısmi deşarj verisi, çekirdek
bölgenin **hemen ardında** ayrı bir bölgede yer alır: 0-based adres `1000`,
label `41001`'den başlar. Her pano için **4 register**, toplam 100 pano ×
4 = 400 register (tüm adres alanı: 1400 register).

```
extendedLabel(PANO-NNN) = 41001 + (NNN - 1) * 4
```

| Pano | Başlangıç adresi (0-based) | Başlangıç label |
| ---- | -------------------------- | --------------- |
| PANO-001 | 1000 | 41001 |
| PANO-003 | 1008 | 41009 |
| PANO-100 | 1396 | 41397 |

| Offset | Alan | Tip / Birim | Açıklama |
| ------ | ---- | ----------- | -------- |
| 0 | Arc Flash | Integer, % × 10 | Optik yoğunluk. 100.0% → 1000. Sensör yoksa 0 |
| 1 | Acoustic | Integer, dB × 10 | Pano içi ses seviyesi. 68.3 dB → 683. Sensör yoksa 0 |
| 2 | Arc Flash Active | Bool (0/1) | Aktif (çözülmemiş) `ARC_FLASH` anomalisi var |
| 3 | Partial Discharge Active | Bool (0/1) | Aktif (çözülmemiş) `PARTIAL_DISCHARGE` anomalisi var |

Bu bölgedeki değerler de çekirdek bloktaki gibi `×10` ölçeklenir ve
`NaN`/`Infinity` yerine `0` yazılır. Data Quality register'ı (offset 9)
yalnızca çekirdek blokta tutulur; genişletilmiş değerler son bilinen
değerlerini korur. Kaynak: `register-map.ts` (`ExtendedRegisterOffset`,
`getExtendedRegisterStartAddress`), `encode.ts` (`encodeExtendedRegisters`).

## Ölçeklendirme (×10) ve clamp/validation kuralları

- Ondalıklı sensör değerleri (`°C`, `%`, `A`) tam sayı register'a yazılabilmesi
  için **×10** ölçeklenir ve `Math.round()` ile yuvarlanır.
- **Risk Score** her zaman 0-100 aralığına clamp edilir (negatif veya >100
  gelen değerler sınırlara çekilir; `null`/`NaN` → 0).
- `NaN` / `Infinity` gibi güvensiz değerler **hiçbir zaman** register'a
  yazılmaz; bunun yerine 0 yazılır ve Data Quality register'ı ayrıca
  freshness'a göre INVALID/VALID durumunu taşır (bkz. aşağıdaki "Stale data").
- Tüm register değerleri son olarak 0-65535 (uint16) aralığına clamp edilir.
- Bu kurallar tek merkezi dosyada (`apps/scada-gateway/src/encode.ts`)
  uygulanır; register numarası veya enum değeri başka hiçbir dosyada
  yeniden tanımlanmaz.

## Stale data / Data Quality davranışı

- `SCADA_DATA_STALE_MS` (varsayılan: `10000` ms) konfigürasyonu, bir panonun
  en son sensör okumasının ne kadar süre "taze" sayılacağını belirler.
- SCADA Gateway her `SCADA_REFRESH_INTERVAL_MS` (varsayılan: `2000` ms) tikinde
  `GET /scada/panels`'i poll eder ve panonun `lastReadingAt` alanını duvar
  saatiyle karşılaştırır.
- Okuma bu süreden daha eskiyse (veya hiç okuma yoksa), **sadece** Data Quality
  register'ı (offset 9) `0` (INVALID) olarak işaretlenir; panonun diğer
  register'ları (risk score, sensör değerleri vb.) **son bilinen değerlerini
  korur** — sıfırlanmaz.
- Bu kontrol duvar saatine göre **her tikte yeniden hesaplanır**; yani
  GRID UP API'ye hiç ulaşılamasa bile (ağ kesintisi) ya da simulator durmuş
  olsa bile, zaman geçtikçe ilgili panoların Data Quality'si otomatik olarak
  INVALID'e döner. Simulator/veri akışı geri geldiğinde bir sonraki başarılı
  snapshot'ta Data Quality tekrar VALID'e döner.
- GRID UP API'ye geçici olarak ulaşılamazsa (network hatası, API restart vb.)
  SCADA Gateway **çökmez**; son başarılı snapshot'ı bellekte tutmaya devam
  eder ve API tekrar erişilebilir olduğunda otomatik senkronize olur.

## Dashboard'daki SCADA ekranı

Dashboard'un **SCADA** sayfası, bir SCADA istemcisinin gateway'den FC03 ile
okuyacağı register tablosunu gösterir. Tarayıcı Modbus TCP konuşamadığı için
gateway, **aynı register tablosunu** (`RegisterStore`) salt-okunur bir HTTP ucundan
JSON olarak sunar; ekrandaki değerler GRID UP API'sinden ayrı hesaplanmaz.

```
GET http://localhost:1580/registers   -> { modbus, api, staleMs, panels: [{ panelCode, registers: [
                                            { label: 40021, address: 20, name: "Risk Score", raw: 94, display: "94" }, ... ] }] }
GET http://localhost:1580/health
```

- Yalnızca `GET` (diğer yöntemler `405`); hiçbir yazma yolu yoktur.
- Ayarlar: `SCADA_HTTP_PORT` (varsayılan `1580`, `0` = kapalı), `SCADA_HTTP_HOST`
  (varsayılan `127.0.0.1`, docker'da `0.0.0.0`), `SCADA_HTTP_ALLOWED_ORIGIN` (CORS).
- Register adı, birimi ve ×10 ölçeği tek bir yerde tutulur (`register-view.ts`);
  komut satırı okuyucu (`npm run scada:read`) ve bu uç aynı açıklamayı kullanır.
- Bu bir **izleme ekranıdır**; gerçek bir SCADA yazılımının (alarm yönetimi,
  trend, HMI) yerini tutmaz. Modbus portu gibi bu port da yalnızca private/OT
  ağa açılmalıdır.

## Read-only prototip

Bu Modbus TCP server **salt-okunurdur**:

- Sadece `getHoldingRegister` (FC03/FC04 — Read Holding Registers) implemente
  edilir.
- `setRegister` / `setCoil` vektörleri **kasıtlı olarak tanımlanmaz**. Kullanılan
  kütüphanede (`modbus-serial`) bir write vector'u yoksa, gelen FC06/FC16 yazma
  istekleri hiçbir state değiştirmeden yanıtsız bırakılır (istemci tarafında
  timeout oluşur).
- Sonuç: SCADA/PLC tarafı bu prototip üzerinden GRID UP'a **asla komut veya
  veri yazamaz**. Bu sistem şu an için yalnızca bir **monitoring/early-warning**
  entegrasyonudur, equipment control değildir.

## Örnek: PANO-001 / PANO-003 / PANO-100

### PANO-001 (blockIndex 0, 40001-40010)

| Register | Alan | Örnek değer |
| -------- | ---- | ----------- |
| 40001 | Risk Score | 13 |
| 40002 | Risk Level | 0 (NORMAL) |
| 40003 | Ambient Temperature | 278 (27.8°C) |
| 40004 | Cable Temperature | 350 (35.0°C) |
| 40005 | Humidity | 420 (42.0%) |
| 40006 | Current | 800 (80.0A) |
| 40007 | Active Alarm | 0 (NO) |
| 40008 | Panel Status | 1 (ONLINE) |
| 40009 | Active Anomaly Count | 0 |
| 40010 | Data Quality | 1 (VALID) |

### PANO-003 (blockIndex 2, 40021-40030) — CRITICAL senaryo örneği

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

Ark flaş senaryosunda (`GRIDUP_SCENARIO=ARC_FLASH`, bkz. `firmware/`) aynı
komut genişletilmiş bloğu da gösterir:

```
41009 Arc Flash            : 100.0 %
41010 Acoustic             : 95.0 dB
41011 Arc Flash Active     : YES
41012 Partial Discharge    : YES
```

(Bu çıktı `npm run scada:read -- PANO-003` ile gerçek, çalışan bir sistemden
üretilmiştir; bkz. README "SCADA Gateway / Modbus TCP" bölümü.)

### PANO-100 (blockIndex 99, 40991-41000)

100 panoluk adres alanının son bloğudur. `PANO-101` veya sonrası
`MAX_SUPPORTED_PANELS` sınırını aştığı için desteklenmez; SCADA Gateway bu
kodları register tablosuna yazmadan loglayıp atlar (çökmez).

## İlgili dosyalar

| Dosya | Sorumluluk |
| ----- | ---------- |
| `apps/scada-gateway/src/register-map.ts` | Register offset'leri, enum değerleri, pano→blok eşlemesi (tek merkezi kaynak) |
| `apps/scada-gateway/src/encode.ts` | Snapshot → register dizisi dönüşümü, clamp/validation |
| `apps/scada-gateway/src/register-store.ts` | Bellek-içi register tablosu, staleness recompute |
| `apps/scada-gateway/src/modbus-server.ts` | Read-only Modbus TCP server (`modbus-serial` `ServerTCP`) |
| `apps/scada-gateway/src/read-client.ts` | `npm run scada:read` CLI test client |
| `apps/api/src/scada/scada.service.ts` | `GET /scada/panels` snapshot endpoint (GRID UP tarafı) |
