# Sensör Modbus Eşlemesi (ABB TVOC-2, HFCT30/50, MPR-53CS)

Organizatörün sağladığı sensör dokümanlarının GRID UP register haritasına nasıl bağlanacağını anlatır. Yön: **sensör → GRID UP** (giriş tarafı). SCADA'ya sunulan harita için bkz. [modbus-mapping-table.md](modbus-mapping-table.md).

> Bu eşleme dokümanlardan çıkarılmış bir **tasarımdır**. Gerçek cihazla test edilmemiştir; prototip sentetik veriyle çalışır.

## 1. ABB Arc Guard TVOC-2-COM (ark flaş)

Kaynak: TVOC-2-COM Modbus Configuration Manual (Rev D). Excel'deki ARC sayfası bu sensörün Modbus ile okunacağını söylüyor.

**Bağlantı:** RS485 2 telli, Modbus RTU **slave**. Varsayılan 19200 baud, 8 veri biti, çift parite (even), 1 stop bit. Adres 1-248 (**248 = haberleşme kapalı**). FC03/04 okuma, FC06/16 yazma desteklenir (GRID UP yalnızca okur).

**Önemli fark:** TVOC-2 analog ışık şiddeti vermez; **olay (trip) tabanlıdır**. Bir dedektör eşiği aştığında trip kaydı oluşur. Bu yüzden GRID UP'un sürekli değer olan "Arc Flash %" alanı bu cihazdan doğrudan gelmez; olay bilgisi gelir.

PDU adresleri (0-based; register numarası = adres + 1):

| PDU (dec) | HEX | Parametre | GRID UP kullanımı |
|---|---|---|---|
| 1300 | 0x514 | System state (bit0 = aktif trip, bit1 = aktif hata, bit2 = açılış, bit3 = tanılama) | bit0 -> ARC FLASH ACTIVE (41003 bloğu); bit1 -> DATA QUALITY |
| 149 | 0x95 | Number of trips | Artış = yeni ark olayı (olay sayacı) |
| 100, 101 | 0x64, 0x65 | Trip 1 detector low / high (hangi dedektör: X1:1 ... X3:10) | Olay ayrıntısı (hangi sensör kanalı) |
| 103-105 | 0x67-0x69 | Trip 1 date (1970'ten gün), time HHMM, time SS | Olay zamanı |
| 222-225 | 0xDE-0xE1 | Sensor status / Ambient light warning X2, X3 (firmware >= 3.00.00) | Sensör arızası ya da ortam ışığı uyarısı -> DATA QUALITY |
| 1301-1306 | 0x515-0x51A | Active DTC 1-6 (hata kodları) | Tanı bilgisi |
| 1100, 1101 | 0x44C, 0x44D | System date / time | Saat senkronu kontrolü |

Önerilen dönüşüm (gateway/field module tarafında):

- `System state` bit0 = 1 veya `Number of trips` arttı -> ARC FLASH ACTIVE = 1 (41003 + 4x(NNN-1)); Arc Flash % = 100.0 (1000 raw).
- Trip yoksa Arc Flash % için ışık şiddeti okunamaz; mevcut prototipin optik (LDR/analog) girişi sentetik/opsiyoneldir.
- Sensör hatası (bit1) veya Ambient Light Warning -> ilgili panonun DATA QUALITY = 0.
- Modbus istisnası alınırsa `Modbus failure register` (1200, 0x4B0) hatalı adresi gösterir.

## 2. Techimp HFCT30 / HFCT50 (kısmi deşarj)

Kaynak: `DS_HFCT30_eng.pdf`, `DS_HFCT50_eng.pdf`, Excel PD sayfası ("PD tespiti için HFCT sensörleri | EA Technology SEA").

HFCT **pasif endüktif akım trafosudur**: BNC çıkışı, 50 ohm yük, bant genişliği 1-60 MHz (HFCT50: 1-80 MHz), duyarlılık 17 mV/mA, delik çapı 30 / 50 mm, topraklama iletkenine takılır. **Modbus çıkışı yoktur**; ham yüksek frekanslı sinyal verir.

Bu yüzden zincir şöyle olmalıdır:

```
HFCT (BNC) -> PD dedektör/analizör ünitesi (pC, darbe sayısı, olay) -> Modbus RTU/TCP -> GRID UP
```

- Analizör modeli ve **register haritası bize verilmedi**; bu bir açık noktadır. Analizör seçilince PD değerleri (örn. tepe pC, darbe sayısı, alarm bayrağı) Modbus'tan okunup PARTIAL DISCHARGE ACTIVE (41004 + 4x(NNN-1)) register'ına eşlenir.
- Prototipte PD bayrağı, akustik sensör skorundan risk motorunda türetilir (`risk-engine.service.ts`); gerçek PD ölçümü değildir.
- Ham HFCT sinyalini ESP32 ile doğrudan okumak mümkün değildir (MHz bandı).

## 3. Enerji analizörü / MPR-53CS (akım, gerilim)

Kaynak: `MPR-53CS_Modbus_Register_Map_EN.pdf` ve TEDAŞ AG pano şartnamesi (madde "Enerji Analizörü": RS485 portu ile MODBUS haberleşme, akım ölçme aralığı 0,2-5,5 A, harmonik izleme 1-49, faz akımı min/max kaydı).

Şartname gereği panoda RS485/Modbus'lu bir enerji analizörü zaten bulunur; **ayrı bir akım sensörü almak yerine akım bu cihazdan okunabilir**. MPR-53CS haritasından ilgili kayıtlar:

| ADDRESS (dec) | HEX | Register | Birim | Çarpan | Format |
|---|---|---|---|---|---|
| 6 | 0006 | L1 PHASE CURRENT | A | 0.001 | unsigned int |
| 8 | 0008 | L2 PHASE CURRENT | A | 0.001 | unsigned int |
| 10 | 000A | L3 PHASE CURRENT | A | 0.001 | unsigned int |
| 12 | 000C | NEUTRAL CURRENT | A | 0.001 | unsigned int |
| 78 / 80 / 82 | 004E... | L1/L2/L3 PHASE CURRENT THD | % | 0.1 | unsigned int |
| 32769 | 8001 | CURRENT TRANSFORMER RATIO | - | 1 | R/W |

Eşleme: GRID UP "Current" = `max(L1, L2, L3)` (Raw x 0.001 A) -> CURRENT register'ı (x10). 1600 kVA panoda akım trafosu 2500/5 olduğundan analizör değeri zaten primer tarafa çevrilmiş verir; `CURRENT TRANSFORMER RATIO` register'ı oranla tutarlı olmalıdır.

**Doğrulanmamış:** Akım register'larının aralarında 2 adres boşluğu olması 32 bit (iki register) okumayı düşündürür; kelime sırası sağlanan PDF'te açıkça yazmıyor. Gerçek cihazda kontrol edilmeli. Ayrıca sağlanan harita MPR-53CS'e aittir; sahadaki cihaz modeli farklıysa harita değişir.

## 4. Sentetik akım verisi (İstenen Veriler.xlsx)

- 15 dakikalık aralıkla L1 fazı için sekonder akımı (15-90 mA), çarpan 6000, hesaplanan primer 90-540 A.
- Dosyada iki farklı sensör tanımı var: "125 mA sekonderli sensör (125 mA = 5 A trafo)" ve "sekonder 100 mA, primer 600 A" (çarpan 6000 buna göre). 1600 kVA panoda akım trafosu ise **2500/5**. Hangisinin esas alınacağı organizatöre sorulmalıdır.
- Bu veri simülatörün akım profilinde kullanılabilir (primer amper olarak).
