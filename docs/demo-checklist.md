# Demo Reset / Pre-Flight Checklist (Aşama 8)

Final sunumdan hemen önce, sırasıyla kontrol edin.

## Pre-flight checklist

- [ ] PostgreSQL çalışıyor (`docker ps` → `grid-up-postgres` "healthy")
- [ ] API health OK (`curl http://localhost:3000/health` → `{"status":"ok","database":"up",...}`)
- [ ] Web çalışıyor (`http://localhost:5173` açılıyor)
- [ ] Tam olarak **BİR** simulator instance'ı çalışıyor (birden fazla instance
      risk skorlarında beklenmedik salınıma sebep olur — bkz. README "Not")
- [ ] SCADA Gateway çalışıyor (`npm run dev:scada`)
- [ ] Modbus port 1502 erişilebilir (`npm run scada:read -- PANO-001` başarılı dönüyor)
- [ ] Baseline NORMAL (`npm run demo:normal` çalıştırılmış, tüm panolar NORMAL)
- [ ] PANO-003 mevcut (seed edilmiş demo verisi — `GET /panels` içinde görünüyor)
- [ ] Beklenmeyen aktif alarm yok (`GET /alarms?status=ACTIVE` boş veya beklenen)
- [ ] Notification provider = demo (`NOTIFICATION_PROVIDER` ayarlanmamışsa varsayılan zaten `demo`)
- [ ] Dashboard polling çalışıyor (Overview sayfasında değerler birkaç saniyede bir değişiyor)
- [ ] Browser console temiz (F12 → Console'da kırmızı hata yok)
- [ ] `npm run scada:read -- PANO-003` client'ı çalışıyor
- [ ] Demo critical komutu hazır (`npm run demo:critical` — ayrı bir terminalde çalıştırmaya hazır, henüz çalıştırılmamış)
- [ ] Firmware derlenmiş (`firmware/esp32/build/gridup-field-module.elf` var; yoksa `idf.py build`, bkz. [../firmware/esp32/README.md](../firmware/esp32/README.md))
- [ ] Wokwi **kapalı** (demo:critical ile aynı panoya yazar; STEP 8'de açılacak)
- [ ] İsteğe bağlı: bildirim gateway gösterimi için `npm run mock:sms` hazır (bkz. [notification-policy.md](notification-policy.md))
- [ ] Sunum/tarayıcı zoom seviyesi kontrol edildi (okunabilir font boyutu)
- [ ] Terminal pencereleri hazırlandı (API, Web, Simulator, SCADA Gateway — her biri ayrı, etiketli pencerede)

## Emergency fallback

**Simulator çalışmazsa ne kontrol edilir?**
`apps/simulator/.env` dosyasının var olduğunu ve `API_BASE_URL`'in doğru
API portunu gösterdiğini kontrol edin; API'nin ayakta olduğunu doğrulayın
(simulator discovery başarısız olursa 5 kez retry eder ve sonra durur —
terminal log'unda `[SIMULATOR] Panel discovery failed` görürseniz önce API'yi
başlatın).

**SCADA Gateway bağlanmazsa ne kontrol edilir?**
`apps/scada-gateway/.env` içindeki `API_BASE_URL`'in API'yi gösterdiğini ve
API'nin `GET /scada/panels` endpoint'inin yanıt verdiğini kontrol edin
(`curl http://localhost:3000/scada/panels`). Gateway API'ye ulaşamasa bile
çökmez; son bilinen değerleri korur ve API tekrar erişilebilir olduğunda
otomatik senkronize olur (bkz. modbus-register-map.md "Stale data").

**Port 1502 doluysa ne kontrol edilir?**
Başka bir SCADA Gateway instance'ının zaten çalışıp çalışmadığını kontrol
edin (aynı anda yalnızca bir gateway instance'ı çalıştırılmalı). Gerekirse
`apps/scada-gateway/.env` içindeki `MODBUS_TCP_PORT`'u geçici olarak
değiştirip gateway'i yeniden başlatın (ve `scada:read` client'ını da aynı
porta yönlendirin).

**Wokwi bağlanamıyorsa ne kontrol edilir?**
API'nin `3000` portunda çalıştığını doğrulayın (`curl http://localhost:3000/panels`).
Firmware sunucuya ulaşamazsa çökmez: en fazla 32 tick tamponlar ve her 5 tickte
bir yeniden dener (seri konsolda `[module] not provisioned, buffering`). API
ayağa kalkınca birikmiş veriyi gönderir.

**Wokwi açıkken kart karışık değer gösteriyorsa ne kontrol edilir?**
Aynı anda hem simülatör hem Wokwi PANO-003'e veri yazıyordur. Birini kapatın.
Wokwi'de LDR'nin başlangıç değeri `lux: 30000` olmalıdır (arc ≈ %6, skor
NORMAL); farklıysa `firmware/wokwi/diagram.json` dosyasını kontrol edin.

**Dashboard eski data gösteriyorsa ne kontrol edilir?**
Tarayıcı sekmesini yenileyin; API'nin ayakta olduğunu ve simulator'ın hâlâ
tick attığını (terminal log'unda `[SIMULATOR] Tick #N` ilerliyor mu)
doğrulayın. Sorun devam ederse tarayıcı console'unda ağ hatası olup
olmadığını kontrol edin (`VITE_API_BASE_URL` yanlış porta işaret ediyor
olabilir).

## System Resilience (isteğe bağlı jüri sorusu için)

Jüri "veri akışı kesilirse ne olur?" diye sorarsa, mevcut (Aşama 7'den beri
çalışan) davranış şu şekildedir — yeni bir mekanizma yazmaya gerek yoktur,
zaten çalışan bir özelliktir:

```
Simulator / field data stops
       ↓
Data becomes stale (SCADA_DATA_STALE_MS, varsayılan 10000ms)
       ↓
SCADA Data Quality = INVALID
       ↓
Gateway stays alive (son bilinen değerleri korur, çökmez)
       ↓
Data resumes
       ↓
Data Quality = VALID
```

Canlı göstermek isterseniz: simulator'ı durdurun (`Ctrl+C`), ~10-15 saniye
bekleyin, `npm run scada:read -- PANO-003` çalıştırıp `Data Quality: INVALID`
görün (diğer register'lar son bilinen değerlerinde kalır), sonra simulator'ı
`npm run demo:normal` ile yeniden başlatıp bir sonraki snapshot'ta
`Data Quality: VALID`'e döndüğünü gösterin. Detaylı davranış için bkz.
[modbus-register-map.md](modbus-register-map.md) "Stale data / Data Quality
davranışı".

## İlgili dosyalar

| Dosya | İçerik |
| ----- | ------ |
| [demo-script.md](demo-script.md) | Adım adım demo akışı |
| [code-freeze.md](code-freeze.md) | Son doğrulanmış sistem durumu |
