# Hardware BOM — Conceptual (Aşama 8)

Bu doküman, Field Module için iki seviyede **kavramsal** bir malzeme listesi
(BOM) sunar. **Hiçbir satırda kesin vendor/model/fiyat verilmemiştir** —
repository'de doğrulanmış bir tedarikçi teklifi bulunmadığı için, maliyet
alanı tutarlı şekilde "Cost to be validated with supplier quotations" olarak
işaretlenmiştir.

## A) Hackathon Demo Module

Demo modülü, mevcut simulator'ın yerini alabilecek, jüri önünde gösterilebilir
bir fiziksel prototip için düşünülen bileşen kategorileridir.

| Kategori | Açıklama | Maliyet |
| -------- | -------- | ------- |
| Microcontroller development board | Genel amaçlı bir geliştirme kartı (WiFi/network özellikli) | Cost to be validated with supplier quotations |
| Temperature/humidity sensor | Dijital sıcaklık/nem sensörü sınıfı | Cost to be validated with supplier quotations |
| Cable/surface temperature sensor | Temas tipi (contact) sıcaklık probu | Cost to be validated with supplier quotations |
| Non-invasive current sensor / CT | Clamp veya açılabilir (split-core) akım trafosu sınıfı | Cost to be validated with supplier quotations |
| Low-voltage power source | USB veya benzeri düşük gerilim demo güç kaynağı (yalnızca demo amaçlı — bkz. field-installation.md "Power") | Cost to be validated with supplier quotations |
| Enclosure / prototype box | Basit plastik prototip kutusu | Cost to be validated with supplier quotations |
| Connectors | Sensör bağlantıları için ayrılabilir konnektörler | Cost to be validated with supplier quotations |
| Status LED | Tek durum göstergesi | Cost to be validated with supplier quotations |
| Wiring / prototyping materials | Jumper kablo, breadboard/prototip PCB vb. | Cost to be validated with supplier quotations |

## B) Production Field Module

Production seviyesindeki kategoriler, saha koşullarına (endüstriyel
dayanıklılık, izolasyon, EMC/EMI) uygun bileşenleri işaret eder.

| Kategori | Açıklama | Maliyet |
| -------- | -------- | ------- |
| Low-cost MCU/module | Endüstriyel kullanım için uygun, düşük maliyetli MCU sınıfı | Cost to be validated with supplier quotations |
| Industrial temp/humidity sensor | Endüstriyel dereceli sıcaklık/nem sensörü | Cost to be validated with supplier quotations |
| Industrial cable/surface temperature sensing | İzole edilmiş yüzey sıcaklık sensörü veya uygun non-contact yaklaşım | Cost to be validated with supplier quotations |
| Split-core CT / current transducer | Endüstriyel split-core akım transducer'ı | Cost to be validated with supplier quotations |
| Isolated power stage | İzole DIN-ray güç kaynağı + koruma bileşenleri | Cost to be validated with supplier quotations |
| Communication module | Seçilecek haberleşme teknolojisine göre (bkz. field-module.md "Field Communication Architecture") | Cost to be validated with supplier quotations |
| Industrial connectors | Endüstriyel dereceli, ayrılabilir konnektörler | Cost to be validated with supplier quotations |
| PCB | Özel tasarım baskı devre kartı | Cost to be validated with supplier quotations |
| Enclosure | DIN-ray uyumlu, endüstriyel dereceli kutu | Cost to be validated with supplier quotations |
| Protection / isolation components | Sigorta, izolasyon bariyeri, EMC/EMI filtreleme bileşenleri | Cost to be validated with supplier quotations |

## Not

Bu listeler kategori bazlıdır; belirli bir marka/model **önerilmemiştir**.
Gerçek bir üretim BOM'u, seçilen haberleşme teknolojisine, saha EMC/EMI
gereksinimlerine ve tedarikçi tekliflerine göre şekillenecektir.

## İlgili dosyalar

| Dosya | İçerik |
| ----- | ------ |
| [hardware-architecture.md](hardware-architecture.md) | Bu bileşenlerin karşılık geldiği fonksiyonel bloklar |
| [field-installation.md](field-installation.md) | Enclosure/power konsept notları |
