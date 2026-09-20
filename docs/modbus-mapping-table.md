# Modbus Haritalama Tablosu (MPR-53CS sütun düzeni)

Organizatör, mevcut SCADA entegrasyonu için doldurulmuş bir **Modbus haritalama tablosu** bekliyor (arayüz gerekmiyor). Bu tablo, [modbus-register-map.md](modbus-register-map.md) içindeki register haritasının aynısıdır; yalnızca sağlanan örnek harita (MPR-53CS) sütun düzenine çevrilmiştir. Register numaraları değişmemiştir. Organizatörün kendi şablonu ayrıca paylaşılırsa değerler oraya aktarılmalıdır.

- **Protokol:** Modbus TCP, salt-okunur (FC03 / FC04), demo portu 1502 (production 502)
- **Slave / Unit ID:** gateway varsayılanı (prototipte tek unit)
- **Adresleme:** ADDRESS = 0-based PDU adresi; REGISTER LABEL = 40001 + ADDRESS (Modicon gösterimi)
- **Format:** tüm register'lar 16 bit işaretsiz (unsigned int); değer `Raw x MULTIPLIER`. Ondalıklı değerler ×10 saklanır, `NaN` yerine 0 yazılır, sonuç 0-65535'e sıkıştırılır
- **Pano bloğu:** PANO-NNN için çekirdek blok `ADDRESS = (NNN-1) x 10 + offset`, genişletilmiş blok `ADDRESS = 1000 + (NNN-1) x 4 + offset`; en çok 100 pano
- **Tam liste (100 pano, 1400 satır):** [assets/modbus-register-map.csv](assets/modbus-register-map.csv), `node scripts/export-modbus-map.mjs` ile üretilir (kaynak: `apps/scada-gateway/src/register-map.ts`)

## Tablo (PANO-001 bloğu; diğer panolar için formülü kullanın)

| ADDRESS | HEX | LABEL | REGISTER | R/W | RANGE | UNIT | MULTIPLIER | FORMAT |
|---|---|---|---|---|---|---|---|---|
| 0 | 0000 | 40001 | RISK SCORE | R | 0-100 | - | 1 | unsigned int |
| 1 | 0001 | 40002 | RISK LEVEL (0=NORMAL, 1=WARNING, 2=HIGH, 3=CRITICAL) | R | 0-3 | enum | 1 | unsigned int |
| 2 | 0002 | 40003 | AMBIENT TEMPERATURE | R | 0-65535 | °C | 0.1 | unsigned int |
| 3 | 0003 | 40004 | CABLE TEMPERATURE | R | 0-65535 | °C | 0.1 | unsigned int |
| 4 | 0004 | 40005 | HUMIDITY | R | 0-65535 | % | 0.1 | unsigned int |
| 5 | 0005 | 40006 | CURRENT | R | 0-65535 | Amper | 0.1 | unsigned int |
| 6 | 0006 | 40007 | ACTIVE ALARM (0=NO, 1=YES) | R | 0-1 | bool | 1 | unsigned int |
| 7 | 0007 | 40008 | PANEL STATUS (0=OFFLINE, 1=ONLINE, 2=MAINTENANCE) | R | 0-2 | enum | 1 | unsigned int |
| 8 | 0008 | 40009 | ACTIVE ANOMALY COUNT | R | 0-65535 | - | 1 | unsigned int |
| 9 | 0009 | 40010 | DATA QUALITY (0=INVALID/STALE, 1=VALID) | R | 0-1 | bool | 1 | unsigned int |
| 1000 | 03E8 | 41001 | ARC FLASH | R | 0-65535 | % | 0.1 | unsigned int |
| 1001 | 03E9 | 41002 | ACOUSTIC | R | 0-65535 | dB | 0.1 | unsigned int |
| 1002 | 03EA | 41003 | ARC FLASH ACTIVE | R | 0-1 | bool | 1 | unsigned int |
| 1003 | 03EB | 41004 | PARTIAL DISCHARGE ACTIVE | R | 0-1 | bool | 1 | unsigned int |

Örnek: PANO-003 risk skoru = `(3-1) x 10 + 0 = 20` -> 40021; ark flaş = `1000 + (3-1) x 4 + 0 = 1008` -> 41009.

## Notlar

- Register'lar yalnızca okunur; yazma (FC06/FC16) desteklenmez, SCADA tarafı GRID UP'a komut veremez.
- Veri 10 sn'den eskiyse yalnızca DATA QUALITY = 0 olur, diğer değerler son bilinen değerini korur ([modbus-register-map.md](modbus-register-map.md)).
- Doğrulama: çalışan gateway'e `npm run scada:read -- PANO-003` ile FC03 okuması yapılır; çıktı bu tabloyla birebir aynıdır.
- **Doğrulanmamış:** Gediz'in gerçek SCADA yazılımındaki etiketleme/ölçekleme kuralları bilinmiyor. Sunulan tablo GRID UP tarafının sözleşmesidir; gerçek SCADA'da tag eşlemesi ayrıca yapılmalıdır.
