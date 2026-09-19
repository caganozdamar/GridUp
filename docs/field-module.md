# GRID UP Field Monitoring Module — Konsept (Aşama 8)

Bu doküman, GRID UP'ın saha (elektrik panosu/hücre) tarafındaki fiziksel
donanım konseptini tanımlar. **Bu bir üretim tasarım spesifikasyonu değildir**;
mevcut, çalışan yazılım prototipini (simulator → ingestion API → risk engine)
gerçek sahaya taşımak için izlenecek kavramsal mimariyi ve karar noktalarını
açıklar.

> **Önemli çerçeve:** Aşama 8 kapsamında yeni bir donanım inşa edilmedi,
> gerçek bir sensör satın alınıp test edilmedi. Buradaki içerik **konsept /
> planlama** seviyesindedir; "Implemented" değil, "Concept / Next Hardware
> Step"tir (bkz. [project-status.md](project-status.md)).

## Temel yaklaşım

```
Electrical Panel
      │
      ├─ Ambient Temperature
      ├─ Cable/Surface Temperature
      ├─ Humidity
      └─ Current
             │
             ▼
       Field Module
             │
             ▼
       Local Gateway / Network
             │
             ▼
       GRID UP On-Premise
```

Field Module, panonun içine yerleştirilen; dört sensör tipinden veri toplayıp
periyodik olarak bir yerel gateway üzerinden GRID UP'a ileten bir cihazdır.
Mevcut prototipte bu kutunun **yazılım karşılığı `apps/simulator`'dır** —
gerçek saha dağıtımında simulator'ın yerini Field Module alır, ama simulator'ın
konuştuğu API sözleşmesi (`POST /readings/batch`) ve onun ardındaki tüm
backend mimarisi (Risk Engine, Anomaly, Alarm, Notification, SCADA Gateway)
**değişmeden** kalır. Bu denklik [final-architecture.md](final-architecture.md)
içinde açıkça vurgulanmıştır.

## Neden mevcut sensor type'larla birebir uyumlu?

Mevcut çalışan prototipte `packages/shared/src/sensor.ts` içinde tanımlı dört
sensör tipi vardır:

```ts
export enum SensorType {
  AMBIENT_TEMPERATURE = 'AMBIENT_TEMPERATURE',
  CABLE_TEMPERATURE = 'CABLE_TEMPERATURE',
  HUMIDITY = 'HUMIDITY',
  CURRENT = 'CURRENT',
}
```

Bu dört tip; Risk Engine'in ağırlıklı skorlama formülünde
(`apps/api/src/risk-engine/risk-engine.config.ts` — `RISK_WEIGHTS`), anomaly
tiplerinde (`HIGH_TEMPERATURE`, `TEMPERATURE_RISE`, `OVERCURRENT`,
`HIGH_HUMIDITY`, `MULTI_SENSOR_RISK`) ve Modbus register haritasında
(`docs/modbus-register-map.md`, offset 2-5) uçtan uca kullanılır. Field Module
konsepti, bu dört tipin ölçümüyle **birebir** eşleşecek şekilde tasarlanmıştır;
böylece gerçek donanım devreye girdiğinde backend'de **hiçbir değişiklik**
gerekmez — sadece veri kaynağı simulator'dan Field Module'e döner.

## Sensor yaklaşımı (özet)

Her sensör tipi için ne ölçtüğü, panoda nereye yerleştirileceği, neden
gerekli olduğu, olası gerçek sensör sınıfı ve prototip/production farkı için
bkz. aşağıdaki tablo. Detaylı gerekçeler ve production notları için ayrıca
[hardware-architecture.md](hardware-architecture.md) ve
[panel-deployment-concept.md](panel-deployment-concept.md)'e bakın.

### Ambient Temperature / Humidity

- **Ne ölçer:** Pano iç ortamının genel sıcaklık ve nem seviyesi.
- **Neden gerekli:** Aşırı ısınan/nemlenen bir kabin, içindeki tüm
  ekipmanların yalıtım ömrünü kısaltır; erken bir "ortam kötüleşiyor"
  sinyalidir ve Risk Engine'in `humidity` component'inde ve
  `MULTI_SENSOR_RISK` korelasyon bonusunda kullanılır.
- **Panoda yaklaşık konum:** Düşük gerilim kontrol bölgesi / pano iç hacminin
  havalandırma akışını temsil eden bir nokta (canlı/yüksek gerilim
  baralarından uzak).
- **Prototip sınıfı:** Dijital sıcaklık/nem sensörü sınıfı (örn. I2C tabanlı
  bir digital temperature/humidity sensor sınıfı) — hackathon demo modülünde
  kullanılabilir.
- **Production sınıfı:** Endüstriyel dereceli (geniş sıcaklık/nem aralığı,
  IP korumalı gövde) sıcaklık/nem sensörü. **Kesin model seçimi bu aşamada
  yapılmamıştır**; saha koşullarına göre tedarikçi/model seçimi doğrulanmalıdır.

### Cable Temperature

- **Ne ölçer:** Kritik bir kablo, bara (busbar) veya terminal bağlantısının
  yüzey sıcaklığı.
- **Neden gerekli:** Gevşek bir bağlantı veya aşırı yüklenme, önce lokal bir
  sıcaklık artışı olarak ortaya çıkar; bu sensör Risk Engine'de en yüksek
  ağırlığa sahip component'tir (`RISK_WEIGHTS.temperature = 0.35`) ve
  `HIGH_TEMPERATURE` / `TEMPERATURE_RISE` anomaly tiplerinin doğrudan
  kaynağıdır.
- **Panoda yaklaşık konum:** Kritik kablo/bara/terminal yakınına, yüzeye
  temas edecek veya yakın mesafeden ölçüm yapacak şekilde.
- **Prototip sınıfı:** Temas tipi (contact) sıcaklık probu.
- **Production sınıfı:** İzole edilmiş, endüstriyel dereceli bir yüzey
  sıcaklık sensörü **veya** uygun bir non-contact (örn. kızılötesi nokta
  sensörü) yaklaşım. **Bu, saha doğrulaması gerektiren açık bir karar
  noktasıdır** — hangi yaklaşımın seçileceği, panonun fiziksel erişilebilirlik
  ve elektriksel izolasyon gereksinimlerine bağlıdır.

### Current

- **Ne ölçer:** Seçilen bir giden/gelen iletkenin akımı.
- **Neden gerekli:** Aşırı akım, hem ısınmanın öncü nedenlerinden biridir hem
  de bağımsız bir arıza göstergesidir; `CURRENT_ANCHORS` ve
  `currentAndCableTemperature` korelasyon bonusu ile Risk Engine'de akım ve
  kablo sıcaklığının **birlikte** yükselmesi ekstra risk puanı üretir.
- **Panoda yaklaşık konum:** Ölçülecek iletkenin etrafı (kesme/bağlantı
  değişikliği gerektirmeden).
- **Prototip sınıfı:** Clamp / açılabilir (split-core) akım trafosu (current
  transformer) tabanlı ölçüm — iletkeni kesmeden takılabilir.
- **Production sınıfı:** Split-core CT veya endüstriyel akım transducer'ı.
  Mümkün olduğunca **iletkeni kesmeden** (non-invasive) ölçüm yaklaşımı
  esastır (bkz. "Low-Risk Installation Concept" bölümü aşağıda).

## Genişletilmiş sensörler — ark flaş ve akustik / kısmi deşarj

Backend ve `firmware/` artık iki ek kanalı destekler (simüle edilmiş veriyle):

| Kanal | `SensorType` | Birim | Ne ölçer | Gerçek sensör sınıfı (önerilen, doğrulanmadı) |
| ----- | ------------ | ----- | -------- | --------------------------------------------- |
| Ark flaş | `ARC_FLASH` | % (optik yoğunluk) | Pano içinde ani, güçlü ışık patlaması | Fotodiyot / optik ark sensörü |
| Akustik / kısmi deşarj | `ACOUSTIC` | dB | Deşarj / ark çıtırtısı kaynaklı ses seviyesi | MEMS mikrofon / ultrasonik sensör |

Risk motoru bu iki kanalı diğerlerinden farklı ele alır
(`apps/api/src/risk-engine`):

- **Ağırlıklı toplama girmezler.** Ark flaş güvenlik-kritik bir olaydır;
  diğer sensörler normalken bile skoru düşük tutmamalıdır. Bunun yerine nihai
  skora **taban (floor)** olurlar: skor ≥ ark flaş riski × 1.0 ve ≥ akustik
  risk × 0.7 (+ nem korelasyon bonusu). Sonuç: güçlü bir ark tek başına
  CRITICAL üretir; yalnızca yüksek ses ise en fazla HIGH üretir (gürültü tek
  başına ark kanıtı değildir).
- **Anlık değil, pencere zirvesi** değerlendirilir: kısa süren bir ark,
  sonraki okumada 0'a dönse bile analiz penceresi (10 okuma) boyunca görünür
  kalır.
- Yeni anomali tipleri: `ARC_FLASH`, `PARTIAL_DISCHARGE`. Alarm başlığında ark
  flaş her zaman önceliklidir ("Critical arc flash risk detected").
- Modbus'ta 41001+ genişletilmiş bloğu ([modbus-register-map.md](modbus-register-map.md)).

> **Dürüst çerçeve:** Akustik kanal bir **kısmi deşarj göstergesi**dir.
> Gerçek kısmi deşarj ölçümü (UHF, TEV, HFCT) çok daha özel donanım gerektirir
> ve bu prototipin kapsamı dışındadır. Ark flaş ve akustik değerler şu an
> yalnızca `firmware/` içindeki sentetik senaryolardan gelir; gerçek sensörle
> saha doğrulaması yapılmamıştır.

## Low-Risk Installation — tasarım prensipleri

Hackathon probleminin özünde, pano içindeki mevcut kablo karmaşasını ve
kurulum riskini **artırmamak** vardır. Field Module konsepti şu prensiplere
göre tasarlanır:

- **Minimal ek kablolama:** Mümkün olduğunca az yeni kablo/bağlantı noktası.
- **Non-invasive sensing (mümkün olduğunca):** Özellikle akım ölçümünde
  iletkeni kesmeden clamp/split-core yaklaşım.
- **Kompakt enclosure:** Panonun mevcut serbest hacmine sığacak küçük bir
  kutu.
- **Düşük gerilim sensör tarafı:** Sensörlerin kendisi ve Field Module'ün
  sensör girişleri düşük gerilim/düşük akım seviyesinde çalışır; sensör
  tarafında yüksek gerilime doğrudan temas YOKTUR.
- **Modüler sensör konnektörleri:** Her sensör tipi için ayrı,
  etiketlenmiş, çıkarılabilir konnektör (bkz.
  [field-installation.md](field-installation.md)).
- **Bakım dostu değişim:** Bir sensör veya modülün kendisi, panonun geri
  kalanına dokunmadan sökülüp takılabilmeli.
- **Koruma/kontrol lojiğine müdahale YOK:** Field Module, panonun mevcut
  koruma rölesi, kesici kontrolü veya SCADA kontrol devresine **hiçbir
  şekilde** bağlanmaz veya müdahale etmez.
- **Sadece izleme mimarisi (monitoring-only):** Field Module tek yönlü veri
  üretir (sensör → GRID UP); GRID UP'tan panoya doğru hiçbir komut veya
  kontrol sinyali gönderilmez.

### GRID UP Field Module NEDİR / DEĞİLDİR

| GRID UP Field Module **DEĞİLDİR** | GRID UP Field Module'dür |
| ----------------------------------- | -------------------------- |
| Koruma rölesi (protection relay)    | Monitoring / early-warning sensörü |
| Kesici kontrol sistemi (breaker control) | Salt-okunur veri kaynağı |
| SCADA kontrol sistemi               | SCADA'ya read-only besleme yapan bir uç nokta (bkz. modbus-register-map.md) |

Bu ayrım, [on-premise-architecture.md](on-premise-architecture.md) içindeki
"SCADA Gateway read-only olmalı" prensibiyle ve
[modbus-register-map.md](modbus-register-map.md) içindeki "Read-only
prototip" bölümüyle tutarlıdır: mevcut prototipte SCADA Gateway zaten hiçbir
write vector'u implemente etmez; Field Module konsepti de aynı tek-yönlü
felsefeyi sahaya taşır.

## İlgili dosyalar

| Doküman | İçerik |
| ------- | ------ |
| [field-data-contract.md](field-data-contract.md) | Field Module → GRID UP arası conceptual payload ve mevcut API sözleşmesi |
| [hardware-architecture.md](hardware-architecture.md) | Donanım blok diyagramı |
| [field-installation.md](field-installation.md) | Enclosure/kurulum konsepti |
| [panel-deployment-concept.md](panel-deployment-concept.md) | 1600 kVA AG panel için generic deployment konsepti |
| [bom.md](bom.md) | Demo ve production BOM |
| [scalability.md](scalability.md) | 100 modül ölçek mimarisi |
| [project-status.md](project-status.md) | Implemented vs Future matrisi |
