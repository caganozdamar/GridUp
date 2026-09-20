# Kaynak Kullanımı Değerlendirmesi

Bu belge, hackathon şartnamesindeki "gerekli kaynak kullanımının değerlendirilmesi" maddesine karşılık gelir. **Ölçülen** değerler ile **tahmin edilen (extrapolated)** değerler ayrı etiketlenmiştir.

## 1. Ölçüm düzeneği

- Ana makine: 16 çekirdek, 15,7 GB RAM (geliştirme bilgisayarı; sahadaki sunucu değildir).
- İzole veritabanı (`grid_up_load`) ve ayrı API örneği (port 3200), `MODULE_OFFLINE_CHECK_INTERVAL_MS=0`.
- Yük: 100 pano x 6 sensör. Önce 3,0 milyon okuma satırı yüklendi (tablo + indeksler 1015 MB), ardından 60 canlı tick gönderildi (6000 istek, 0 hata).
- Betik: `apps/api/scripts/resource-usage-test.mjs`, ham sonuç: `docs/assets/resource-usage-results.json`.

## 2. Ölçülen sonuçlar (yazma / ingest yolu)

| Metrik | Değer |
|---|---|
| Tick süresi (100 modül) ortalama / p95 / maks | 203 ms / 222 ms / 503 ms |
| İstek süresi p50 / p95 / maks | 184 ms / 214 ms / 483 ms |
| API CPU (tek çekirdeğin %'si) ortalama / maks | %51 / %99 |
| API RSS ortalama / maks | 246 MB / 261 MB |
| PostgreSQL CPU ortalama / maks | %21 / %142 |
| PostgreSQL RAM | ~382 MB |
| Başarısız istek | 0 / 6000 |

100 modülün 2 saniyelik döngüsü 203 ms'de işleniyor; yazma yolunda bu ölçekte bol pay var.

## 3. Depolama maliyeti (ölçülen)

| Kayıt | Bayt / satır (indeksler dahil) |
|---|---|
| `readings` | 337,5 (heap 126 + indeks 211) |
| `risk_scores` | 329 |
| Modül POST gövdesi | 719 bayt / tick |

## 4. Projeksiyon (tahmin, ölçülmedi)

100 modül x 6 sensör, 2 sn aralıkla:

| Kalem | Değer |
|---|---|
| Okuma hızı | 300 satır/sn |
| `readings` | 25,9 M satır/gün ≈ **8,7 GB/gün** |
| `risk_scores` | 4,3 M satır/gün ≈ **1,4 GB/gün** |
| Modül başına istek gövdesi | ~31 MB/gün (100 modül: ~3,1 GB/gün ağ trafiği) |

Bu değerler doğrusal ölçekleme varsayımıdır. Gerçek sahada sensör/aralık değişirse aynı formülle yeniden hesaplanmalıdır.

## 5. Ana bulgu: okuma uç noktaları tablo büyüdükçe yavaşlıyor

| Uç nokta | ~120 bin satırda p50 | 3 milyon satırda p50 |
|---|---|---|
| `GET /panels` | ~0,09 sn | 0,94 sn |
| `GET /scada/panels` | ~0,09 sn | **5,26 sn** |

Ingest ve sensör başına sıcak sorgu (0,05 ms) hızlı kalıyor. Şüphelenilen neden: "sensör başına son okuma" için kullanılan `DISTINCT ON ("sensorId")` sorguları (`decision-support.service.ts` içindeki `findLatestReadingTimestamps` ve `scada.service.ts` anlık görüntüsü). **Bu henüz `EXPLAIN` ile doğrulanmadı.**

Sonuç: SCADA geçidi API'yi 2 sn'de bir sorguluyor; yanıt 5 sn'ye çıkınca geçit bir günlük veriden önce bozulur.

## 6. Eksikler ve öneriler

1. **Saklama süresi (retention) yok.** API'de temizlik kodu bulunmuyor, disk sınırsız büyür. Öneri: ham okumalar için örn. 30 gün, sonrası saatlik özet.
2. **Son okuma sorgusu.** Sensör başına `LATERAL ... ORDER BY timestamp DESC LIMIT 1` (mevcut `(sensorId, timestamp)` indeksini kullanır) veya `latest_readings` tablosu.
3. Yukarıdakiler yapılana kadar demo verisi küçük tutulmalıdır (yüzbinlerce satır).

## 7. Saha modülü (ESP32) ayak izi

`idf.py size` çıktısı (ESP-IDF 5.5, `firmware/esp32`):

| Kaynak | Kullanım |
|---|---|
| Uygulama imajı | 931.965 bayt; bölüm 0x177000 (1,5 MB), **%39 boş** |
| Flash kodu (.text) | 687.278 bayt |
| Flash verisi (.rodata) | 128.428 bayt |
| IRAM | 98.635 / 131.072 bayt (%75,3) |
| DRAM | 38.880 / 180.736 bayt (%21,5) |

Not: Bu yalnızca derleme boyutudur; donanım üzerinde çalıştığı iddia edilmez (yalnızca Wokwi simülasyonu).

## 8. Yeniden üretme

```sh
# scratch DB oluştur (docker: grid-up-postgres), sonra:
DATABASE_URL=... npx prisma migrate deploy
API_PORT=3200 MODULE_OFFLINE_CHECK_INTERVAL_MS=0 node dist/main.js
DATABASE_URL=... API_BASE_URL=http://localhost:3200 API_PID=<pid> \
  PRELOAD_TICKS=5000 LIVE_TICKS=60 RESULT_JSON=docs/assets/resource-usage-results.json \
  node apps/api/scripts/resource-usage-test.mjs
```

Süre ~5 dk. Betik işi bitince geçici veritabanını siler.
