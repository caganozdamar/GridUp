# GRID UP Field Module — ESP32 firmware (ESP-IDF, C)

ESP32 hedefi için `../core/` (platform-bağımsız C çekirdeği) üzerine kurulu
firmware. Çekirdek okuma, tamponlama, provizyon ve gönderme mantığını yapar;
bu klasör onu karta bağlar.

```
main/
  main.c         app_main: GPIO/LED/buton, Wi-Fi, mod seçimi, module_run()
  hal_esp32.c    core/hal.h uygulaması: Wi-Fi, esp_http_client, SNTP, log
  sensors_hw.c   gerçek girişler: DHT22 + 4 ADC1 kanalı
  dht22.c        DHT22 (AM2302) bit-bang sürücüsü
  Kconfig.projbuild   yapılandırma (menuconfig)
```

Pin bağlantıları ve devre için [../wokwi/README.md](../wokwi/README.md).

## Durum — ne doğrulandı, ne doğrulanmadı

| | |
| - | - |
| Derleme (ESP-IDF v5.5.5, esp32) | ✅ Uyarısız derlenir, 933 KB, uygulama bölümünde %39 boş |
| Çekirdek mantığı (provizyon, tampon, 4xx/5xx, sunucu yokken açılış) | ✅ Sahte HAL'le birim testleri (`make test`, `../Makefile`) |
| ADC → birim dönüşümleri | ✅ Birim testli (saf fonksiyonlar) |
| **Karta/Wokwi'ye yüklenip çalıştırıldı** | ❌ **Hayır.** Bu ortamda Wokwi ve gerçek kart yok |
| DHT22 sürücüsü zamanlaması | ❌ Doğrulanmadı (yalnızca Wokwi'de veya kartta denenebilir) |
| Wokwi ADC ölçeği / LDR yönü | ❌ Doğrulanmadı ([../wokwi/README.md](../wokwi/README.md)) |
| Wi-Fi + HTTP ile gerçek API'ye gönderim | ❌ Doğrulanmadı |

Yani kod derleniyor ve mantığı test edilmiş durumda; donanım/simülatör üzerinde
ilk çalıştırma henüz yapılmadı. İlk denemede hata çıkması beklenebilir.

## Kurulum

ESP-IDF **v5.5.5** ile derlenmiştir (`~/esp/esp-idf`, `./install.sh esp32`).
İki ek adım gerekti:

```bash
# cmake ve ninja ESP-IDF 5.5'te isteğe bağlı kurulur:
python $IDF_PATH/tools/idf_tools.py install cmake ninja
```

> **Türkçe (tr_TR) locale uyarısı:** Türkçe locale'de büyük `I` küçük harfe
> noktasız `ı` dönüşür. Toolchain'in assembler'ı özel register adlarını
> (`CONFIGID0`, `ICOUNT`...) bu yüzden bulamaz ve ESP-IDF'in kendi
> `esp_gdbstub` bileşeni `unknown opcode or format name 'rsr.CONFIGID0'`
> hatasıyla derlenmez. **Derlerken locale'i C yapın:**
>
> ```bash
> export LC_ALL=C LANG=C
> ```

## Derleme

```bash
export LC_ALL=C LANG=C
. ~/esp/esp-idf/export.sh
cd firmware/esp32
idf.py set-target esp32      # ilk seferde
idf.py build
```

## Yapılandırma

`idf.py menuconfig` → **GRID UP Field Module**:

| Anahtar | Varsayılan | Anlamı |
| ------- | ---------- | ------ |
| `GRIDUP_WIFI_SSID` / `GRIDUP_WIFI_PASSWORD` | `Wokwi-GUEST` / boş | Wi-Fi ağı (Wokwi'nin açık ağı) |
| `GRIDUP_API_BASE_URL` | `http://host.wokwi.internal:3000` | On-prem GRID UP API adresi |
| `GRIDUP_PANEL_CODE` | `PANO-003` | Modülün takılı olduğu pano |
| `GRIDUP_SAMPLE_INTERVAL_MS` | `2000` | Örnekleme aralığı (en az 2000: DHT22 sınırı) |

`host.wokwi.internal`, Wokwi Private Gateway'in bilgisayarınızı gösterdiği
addır (Wokwi belgelerinden hatırladığım şekliyle; doğrulanmadı). Gerçek kartta
API sunucusunun yerel ağ adresini yazın.

## Wokwi'de çalıştırma

`../wokwi/` klasöründe `diagram.json` (devre) ve `wokwi.toml` (firmware yolu)
vardır. Derledikten sonra VS Code Wokwi eklentisiyle bu klasörü açın veya
`wokwi-cli` kullanın (ikisinin lisans/token koşullarını kullanmadan önce
kontrol edin). `wokwi.toml`'daki `flasher_args.json` yolunu Wokwi'nin ESP-IDF
belgelerinden hatırladığım şekliyle yazdım; doğrulanmadı.

**Ağ:** Wokwi'nin sanal Wi-Fi'ı `localhost`'a ulaşamaz (Private Gateway
gerekir, ücretli olabilir). Bu yüzden modül **sunucu olmadan da çalışacak**
şekilde tasarlandı: provizyon başarısız olursa sensörleri okumaya ve seri
monitöre yazmaya devam eder, okumaları 32 tick'e kadar tamponlar ve her 5
tick'te provizyonu yeniden dener. Sunucuya ulaşabildiği anda birikmiş
okumaları tek batch'te gönderir.

**Saat:** SNTP ile senkronize olana kadar okumalar zaman damgası olmadan
gönderilir (API sunucu saatini kullanır); birikmiş bir yığında bu, trend
hesabını bozar. Senkronize olduktan sonra gerçek zaman damgası gider.

## Modlar (SCENARIO düğmesi, GPIO25)

| Mod | Kaynak |
| --- | ------ |
| 0 — **HARDWARE** | Gerçek girişler: DHT22 + ADC (Wokwi'de slider/potansiyometre) |
| 1..6 — **DEMO** | Sentetik senaryo (NORMAL, OVERHEATING, OVERCURRENT, HIGH_HUMIDITY, ARC_FLASH, COMBINED_FAILURE) |

Düğmeye basmak sıradaki moda geçer, sonuncudan sonra donanıma döner. Mod her
değişimde seri monitöre yazılır (`[mode] HARDWARE...` / `[mode] DEMO...`); demo
modu gerçek sensör verisi değildir, jüriye böyle anlatılmalıdır.

## LED'ler

| LED | Anlamı |
| --- | ------ |
| Yeşil (GPIO26) | Sunucu son batch'i kabul etti (çevrimiçi ve provizyonlu) |
| Kırmızı (GPIO27) | Bir kanal kritik bantta (yerel gösterge, backend risk skorundan bağımsız) |

## Bellek

`BUFFER_CAPACITY=32` tick (`main/CMakeLists.txt`). Provizyon sırasında `/panels`
yanıtı için geçici 64 KB heap ayrılır (~100 pano) ve hemen bırakılır; gönderim
tamponu ~25 KB heap'tir.
