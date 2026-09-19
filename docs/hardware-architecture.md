# Hardware Block Diagram — Field Module Konsepti (Aşama 8)

Bu doküman, GRID UP Field Module'ün donanım blok diyagramını gösterir.
**Bu aşamada gerçek bir PCB/şematik tasarlanmamıştır**; aşağıdaki diyagram,
sistemin hangi fonksiyonel bloklardan oluşacağını gösteren bir konsept
diyagramıdır (bkz. [field-module.md](field-module.md) "Önemli çerçeve").

## Blok diyagram

```
[Ambient Temperature / Humidity Sensor]
                 │
[Cable / Surface Temperature Sensor]
                 │
[Non-invasive Current Sensor (CT / clamp)]
                 │
                 ▼
      ┌───────────────────────────┐
      │   GRID UP FIELD MODULE    │
      │                           │
      │   ┌───────────────────┐   │
      │   │        MCU        │   │
      │   └─────────┬─────────┘   │
      │             │             │
      │   ┌─────────┴─────────┐   │
      │   │  ADC / Sensor I/O  │   │
      │   │    Interfaces      │   │
      │   └─────────┬─────────┘   │
      │             │             │
      │   ┌─────────┴─────────┐   │
      │   │   Local Buffer    │   │
      │   │ (geçici okuma     │   │
      │   │  kuyruğu)         │   │
      │   └─────────┬─────────┘   │
      │             │             │
      │   ┌─────────┴─────────┐   │
      │   │  Communication    │   │
      │   │  Interface        │   │
      │   └─────────┬─────────┘   │
      └─────────────┼─────────────┘
                     │
                     ▼
              Local Gateway
                     │
                     ▼
            Private Network
                     │
                     ▼
          GRID UP On-Premise
```

Bu diyagramda **kasıtlı olarak protection/control output yoktur** — Field
Module'den panoya doğru hiçbir çıkış (röle sürücü, kesici komutu vb.)
tanımlı değildir. Tüm ok yönleri sensörden merkeze doğrudur (bkz.
[field-module.md](field-module.md) "GRID UP Field Module NEDİR / DEĞİLDİR").

## Blokların sorumlulukları (kavramsal)

| Blok | Sorumluluk | Bugünkü yazılım karşılığı |
| ---- | ---------- | -------------------------- |
| MCU | Sensör okuma döngüsü, tick zamanlaması, veri paketleme | `apps/simulator/src/index.ts` — `runTick` / `scheduleNext` |
| ADC / Sensor I/O Interfaces | Analog sensör sinyallerinin (sıcaklık, nem, akım) dijital değere çevrilmesi | `apps/simulator/src/sensor-generator.ts` — sentetik değer üretimi |
| Local Buffer | Ağ kesintisi anında birkaç tick'lik okumanın geçici olarak tutulması (production'da) | Bugün YOK — simulator ağ hatasında sadece log basıp bir sonraki tick'i dener (`apiClient.postReadingsBatch` hata yakalama) |
| Communication Interface | Local Gateway'e veri iletimi | `apps/simulator/src/api-client.ts` — `postReadingsBatch` (bugün doğrudan HTTP/REST) |

> **Not:** "Local Buffer" bugünkü prototipte gerçek bir donanım/yazılım
> bileşeni olarak yoktur; production Field Module'ün ağ kesintilerine karşı
> dayanıklılığını artırmak için planlanan bir gelecek genişleme noktasıdır.

## Local Gateway ve üstü

Local Gateway ve GRID UP On-Premise tarafı, mevcut çalışan mimariyle
birebir aynıdır — bkz. [final-architecture.md](final-architecture.md) ve
[on-premise-architecture.md](on-premise-architecture.md). Field Module'ün
somut bir donanım olarak eklenmesi, bu tarafta **hiçbir değişiklik**
gerektirmez.

## Communication seçenekleri

Field Module'den Local Gateway'e haberleşme teknolojisi için, saha
doğrulaması yapılmadan tek bir teknoloji kesin kazanan ilan edilmemiştir.
Değerlendirilecek seçenekler için bkz.
[field-module.md](field-module.md) ve README "Field Communication
Architecture" — özetle: endüstriyel Wi-Fi (altyapı uygunsa), sub-GHz/LoRa
sınıfı private haberleşme (uygun olduğunda), veya RS-485/kablolu endüstriyel
haberleşme (kablolama kabul edilebilirse).

## İlgili dosyalar

| Dosya | İçerik |
| ----- | ------ |
| [field-module.md](field-module.md) | Genel Field Module konsepti |
| [field-installation.md](field-installation.md) | Enclosure ve fiziksel kurulum |
| [bom.md](bom.md) | Bu bloklara karşılık gelen demo/production bileşen listesi |
