# GRID UP Field Module — Wokwi Devresi

`diagram.json`, Field Module'ün elektronik tasarımını Wokwi'de gösterir:
ESP32 DevKit V1 + 5 sensör/kanal + 2 LED + 1 buton. Bu bir **simülasyondur**;
gerçek pano, gerçek CT veya gerçek optik ark sensörü yoktur (bkz.
[../../docs/project-status.md](../../docs/project-status.md)).

Kullanım: <https://wokwi.com> üzerinde yeni bir "ESP32" projesi açıp
`diagram.json` içeriğini yapıştırın veya VS Code Wokwi eklentisiyle bu klasörü
açın (eklenti lisans koşullarını kullanmadan önce kontrol edin).

> **Durum:** Bu klasörde henüz ESP32 firmware'i yoktur; yalnızca devre ve
> bağlantı dokümantasyonu vardır. Aynı C çekirdeği (`../core/`) için ESP32 HAL
> katmanı sonraki adımdır.

## Parçalar ve GRID UP sensör tipi eşlemesi

| Wokwi parçası | id | GRID UP `SensorType` | Sahadaki karşılığı (önerilen sınıf, doğrulanmadı) |
| ------------- | -- | -------------------- | ------------------------------------------------ |
| DHT22 (sıcaklık) | `dht` | `AMBIENT_TEMPERATURE` | Endüstriyel dijital sıcaklık/nem sensörü |
| DHT22 (nem) | `dht` | `HUMIDITY` | (aynı sensör) |
| NTC sıcaklık modülü | `ntc` | `CABLE_TEMPERATURE` | Kablo/bara yüzeyine temaslı NTC/PT100 prob |
| Potansiyometre | `ct` | `CURRENT` | Split-core CT + burden direnci |
| Fotodirenç (LDR) modülü | `ldr` | `ARC_FLASH` | Fotodiyot / optik ark sensörü |
| Küçük ses sensörü | `mic` | `ACOUSTIC` | MEMS mikrofon / ultrasonik sensör |
| Yeşil LED + 330 Ω | `led_ok` | — | Durum LED'i (modül çalışıyor) |
| Kırmızı LED + 330 Ω | `led_alarm` | — | Alarm LED'i (yerel uyarı) |
| Buton | `btn` | — | Demo senaryosu değiştirme |

Not: Wokwi'de gerçek bir CT yoktur; potansiyometre CT'nin (burden direnci
üzerindeki) gerilim çıkışını temsil eder. Akustik değer bir **kısmi deşarj
göstergesidir**, gerçek PD ölçümü (UHF/TEV/HFCT) değildir.

## Pin tablosu (ESP32 DevKit V1)

| ESP32 pini | GPIO | Bağlandığı yer | Yön | Not |
| ---------- | ---- | -------------- | --- | --- |
| D4 | GPIO4 | DHT22 `SDA` | I/O | Tek-tel protokol |
| D34 | GPIO34 | NTC `OUT` | Analog giriş | ADC1_CH6 |
| D35 | GPIO35 | Potansiyometre `SIG` (akım) | Analog giriş | ADC1_CH7 |
| D32 | GPIO32 | LDR `AO` (ark flaş) | Analog giriş | ADC1_CH4 |
| D33 | GPIO33 | Ses sensörü `AOUT` (akustik) | Analog giriş | ADC1_CH5 |
| D26 | GPIO26 | Yeşil LED (330 Ω üzerinden) | Çıkış | Durum |
| D27 | GPIO27 | Kırmızı LED (330 Ω üzerinden) | Çıkış | Alarm |
| D25 | GPIO25 | Buton | Giriş (`INPUT_PULLUP`) | Basınca GND'ye çeker |
| 3V3 | — | Tüm sensörlerin `VCC` | Güç | |
| GND.1 / GND.2 | — | Sensör GND / LED ve buton GND | Güç | |
| TX0 / RX0 | GPIO1/3 | Seri monitör | UART | JSON çıktısı |

**Neden bu pinler?** Tüm analog girişler **ADC1** kanallarındadır (GPIO32-39).
ESP32'de ADC2, Wi-Fi çalışırken kullanılamaz; gerçek karta geçildiğinde
Wi-Fi ile çakışma olmaması için analog sensörler bilerek ADC1'e konmuştur.
GPIO34-39 yalnızca giriştir ve iç pull-up'ı yoktur, bu yüzden LED'ler
GPIO26/27'ye konmuştur.

## ADC → fiziksel birim dönüşümü (firmware için)

ESP32 ADC'si 12 bit (0-4095), 3.3 V referans. Aşağıdakiler simülasyon
kalibrasyonudur; gerçek sensörde saha kalibrasyonu gerekir.

| Kanal | Dönüşüm | Aralık |
| ----- | ------- | ------ |
| Kablo sıcaklığı (NTC) | Wokwi NTC örneğindeki Steinhart-Hart formülü, β = 3950: `1 / (ln(1 / (4095 / adc - 1)) / 3950 + 1 / 298.15) - 273.15` | °C |
| Akım (CT) | Doğrusal: `adc / 4095 * 250` | 0-250 A |
| Ark flaş (LDR) | Doğrusal yüzde: `adc / 4095 * 100`. **Yönü (ışıkla artıyor mu) Wokwi'de doğrulanmalıdır** | 0-100 % |
| Akustik | Doğrusal: `30 + adc / 4095 * 70` | 30-100 dB |
| Ortam sıcaklığı / nem | DHT22 kütüphanesi (`DHTesp` veya eşdeğeri) | °C / % |

Bu aralıklar backend eşikleriyle uyumludur: kablo 45 °C üstü yükselen risk,
akım 110 A üstü, ark flaş 3 % üstü, akustik 45 dB üstü (bkz.
`apps/api/src/risk-engine/risk-engine.config.ts`).

## Demo için elle deneme

| Ayar | Beklenen sonuç |
| ---- | -------------- |
| Potansiyometreyi ~%45'e (≈110 A) çekin | Normal sınırın üstü, risk artmaya başlar |
| Potansiyometreyi ~%70'e (≈170 A) çekin | Kritik akım |
| NTC sıcaklığını 75 °C üstüne çıkarın (Wokwi'de parçaya tıklayıp slider) | Kritik kablo sıcaklığı |
| LDR ışığını aniden yüksek yapın | Ark flaş → skor doğrudan CRITICAL |
| Ses sensörünü yükseltin | Kısmi deşarj göstergesi (tek başına en fazla HIGH) |

## Doğrulama

`diagram.json`, `@wokwi/elements` paketindeki gerçek pin tanımlarına karşı
otomatik kontrol edilmiştir: 11 parça, 25 bağlantı, bilinmeyen parça veya pin
yok, hiçbir GPIO iki kez kullanılmıyor. **Wokwi editöründe görsel olarak
açılıp çalıştırılmamıştır** (bu ortamda tarayıcı yok); parça yerleşimi
(`top`/`left`) yaklaşıktır ve editörde sürüklenerek düzeltilebilir.
