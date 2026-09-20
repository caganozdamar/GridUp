# Kurulum Yaklaşımı ve Arıza Modları Analizi

Hackathon brief'i, pano içinde kablo kalabalığının, canlı bir kabinde çalışmanın
hayati riskinin ve planlı kesinti gerekliliğinin göz önüne alınmasını; "kurulum
sırasında ve sonrasındaki tüm hataların, sorunların ve etkilerinin iyi
düşünülmesini", mümkünse kablosuz, tak-çalıştır ve bakım gerektirmeyen bir
sistemi ister. Bu doküman bu talebe yanıt verir. Çevre koşulları için bkz.
[field-conditions.md](field-conditions.md).

> **Kapsam ve dürüst çerçeve.** Bu bir **tasarım ve analiz dokümanıdır**. Kurulum
> hiçbir gerçek panoda yapılmamış, arıza modları gerçek donanımda
> denenmemiştir. "Bugünkü davranış" sütunları yalnızca kodda okunan ya da
> Wokwi/birim testlerinde gözlenen davranışı anlatır; öneriler ise
> uygulanmamıştır. Elektrik güvenliği açısından bağlayıcı bir montaj talimatı
> **değildir**; gerçek uygulamadan önce ADM/GDZ'nin saha prosedürleri, üretici
> gereksinimleri ve yetkili mühendis onayı zorunludur (bkz.
> [panel-deployment-concept.md](panel-deployment-concept.md)).

## 1. Kurulum ilkeleri

### 1.1 Hayati risk ve planlı kesinti

Pano içinde canlı parçalara yakın her işlem hayati risk taşır ve şebeke etkisi
nedeniyle planlı kesinti gerektirebilir. Tasarım hedefi, bu riski **azaltmak**,
ortadan kaldırdığını iddia etmemektir:

- **Elektronik canlı bölümde durmaz.** Modül, alçak gerilim/servis bölmesine
  monte edilir; canlı iletkenlere yalnızca dokunmayan (non-invasive) sensör
  uçları uzanır.
- **Hiçbir sensör güç devresine seri girmez.** Akım ölçümü split-core CT ile,
  iletkeni kesmeden yapılır. Modülden panoya hiçbir çıkış (röle, kesici komutu)
  yoktur, yani modül panonun çalışmasını etkileyemez (bkz.
  [electronic-design.md](electronic-design.md)).
- **Canlı parçaya yakın her adım**, kurumun prosedürüne göre yetkili personel,
  enerjisiz hale getirme ve kilitleme-etiketleme (LOTO) ile ya da onaylı canlı
  çalışma yöntemiyle yapılır. Bu dokümandaki hiçbir adım bunun yerine geçmez.
- **Müdahale sayısını azaltmak** bir tasarım hedefidir: bir kez kurulan modül
  bakım gerektirmez, arızalanırsa çıkarılabilir konnektörlerle değiştirilir
  (bkz. 1.3).

### 1.2 Kablo kalabalığı

| Sorun | Yaklaşım |
| ----- | -------- |
| Yeni kablolar panoyu daha da karmaşıklaştırır | **Panoda tek modül**, kısa sensör uçları, mevcut kablo kanallarını kullanmak |
| Yeni kablo, şebeke kablosuna yakın geçer | Güç kablolarından ayrı yol, kesişimlerde 90°, kablo bağı ve klipsle sabitleme |
| Yeni delik/geçiş | Yeni pano geçişi açılmaz; mevcut boşluklar kullanılır |
| Modül bakımı diğer kablolara zarar verir | Ayrılabilir, etiketli konnektörler; modül tek hamlede sökülür |
| Sensör kabloları yanlış bağlanır | Konnektörler kodlu ve renk/etiketli; her sensör girişi farklı tipte |

### 1.3 Tak-çalıştır (plug and play)

Bugünkü prototipte bu **yazılım tarafında** gerçekleştirilmiştir:

- Modül sadece **pano kodunu** (`CONFIG_GRIDUP_PANEL_CODE`) ve API adresini bilir.
  Açılışta `GET /panels` ile panoyu ve sensörlerini kendi bulur (provizyon); sensör
  kimliklerini elle girmek gerekmez. Wokwi'de çalıştırılmıştır
  (`[module] provisioned 6 sensors`).
- Sunucu o anda kapalıysa modül çökmez; okumayı ve tamponlamayı sürdürür, her 5
  tickte bir yeniden dener.
- Yerel göstergeler: **yeşil LED** = son gönderim sunucu tarafından kabul edildi,
  **kırmızı LED** = kritik bant. Kurulumu yapan kişi bağlantıyı bunlarla teyit eder.

**Eksik olan, dürüstçe:** Wi-Fi bilgisi ve pano kodu bugün **derleme zamanında**
(`menuconfig`) gömülüdür; sahada kod değiştirmeden kimlik verme (kalıcı
yapılandırma, QR ile eşleştirme, kablosuz güncelleme/OTA) yoktur. "Gerçek"
tak-çalıştır için bu gereklidir.

### 1.4 Kablosuz sensör seçeneği ve bakım gerektirmeyen çalışma

Brief örnek olarak kablosuz sensörü verir. Tasarım yaklaşımı iki aşamalıdır:

| Aşama | Yaklaşım | Kazanç | Sınır |
| ----- | -------- | ------ | ----- |
| 1 (bugünkü konsept) | Modül panoda, **kısa kablolu** sensörler | Basit, kanıtlı | Sensör başına kablo |
| 2 (öneri) | **Kablosuz sensör düğümleri** (BLE / sub-GHz/LoRa sınıfı) modüle veri yollar | Kablo kalabalığı ve müdahale azalır | Metal pano içinde radyo zayıflar, güvenlik ve pil/güç sorunları |

Kablosuz düğüm için "bakım gerektirmez" iddiası yalnızca güç problemi çözülürse
geçerlidir: **CT'den enerji hasadı** (akım ölçen düğüm, ölçtüğü iletkenden
beslenir) ya da uzun ömürlü ve sıcaklığa dayanıklı bir güç kaynağı. Pil, yüksek
sıcaklıkta ömür kaybı ve yangın riski nedeniyle önerilmez (bkz.
[field-conditions.md](field-conditions.md)). Bu aşama **tasarlanmıştır, inşa
edilmemiştir**; haberleşme seçenekleri için bkz.
[hardware-architecture.md](hardware-architecture.md).

### 1.5 Kurulum ve devreye alma adımları (öneri, prosedür değildir)

1. **Ön hazırlık (panodan bağımsız):** Modülün pano kodu ve ağ ayarı verilir;
   masada API'ye bağlantı ve sensör provizyonu denenir.
2. **Yerinde keşif:** Sensör noktaları, modül konumu ve kablo yolu belirlenir;
   ölçüm noktaları pano çizimine işlenir.
3. **Planlı kesinti/yetkili çalışma:** Kurumun prosedürüne göre.
4. **Montaj:** Modül monte edilir, konnektörlerle sensörler bağlanır, kablolar
   kanala sabitlenir.
5. **Devreye alma testi:** LED'ler ve dashboard'da 6 kanalın geldiği doğrulanır;
   her sensöre bilinen bir uyarı verilir (örn. sıcaklık probuna ısı) ve tepkisi
   izlenir; **yanlış bağlanmış sensör** bu adımda yakalanır.
6. **Kabul:** Pano etiketi ile dashboard'daki panonun eşleştiği teyit edilir.

## 2. Arıza modları ve etki analizi (FMEA)

Aşağıdaki tablo, kurulum sırasında ve sonrasında beklenebilecek arızaları,
sistemin **bugünkü** davranışını (koddan/testten doğrulanmış) ve önerilen
önlemi gösterir.

| # | Arıza modu | Olası neden | Etki | Bugünkü davranış | Öneri / önlem | Durum |
| - | ---------- | ----------- | ---- | ---------------- | ------------- | ----- |
| 1 | Sensör kopması veya kısa devre (NTC açık/kısa) | Kablo koptu, konnektör gevşedi | O kanal ölçülemez | Firmware ADC uç değerinde `NaN` üretir ve o kanalı **göndermez**; yerel kritik-bant kontrolü yok sayar | Tek sensör için "veri yok" alarmı (modül düzeyi alarm #3'te var) | Kısmen |
| 2 | Wi-Fi/ağ kopması | Metal pano zayıf sinyal, ağ arızası | Veri merkeze ulaşmaz | Modül örneklemeyi sürdürür; ESP32 derlemesinde **32 tick** tamponlar (2 sn aralıkta ≈ 64 sn); dolunca en eski kayıt düşer; bağlanınca birikeni tek batch'te yollar (birim testli) | Daha uzun kesinti için kalıcı tampon, ağ yedekliliği | Var, sınırlı |
| 3 | **Modül/sensör susar** | Güç kesildi, modül kilitlendi, sürekli Wi-Fi yok | Pano izlenmez; risk skoru eski okumalarla kalır | **Çözüldü (panonun tamamı için):** `ModuleHealthService`, panonun **hiçbir** sensöründen 60 sn okuma gelmezse `MODULE_OFFLINE` alarmı (HIGH) açar ve SMS gönderir; veri geri gelince kendiliğinden çözülür. Dashboard'da ayrıca `dataHealth` rozeti (`STALE`), SCADA'da `Data Quality` = INVALID. **Hâlâ açık:** risk skoru susan panoda eski okumalarla hesaplanmaya devam eder (yalnızca modül alarmı bunu duyurur); yalnızca **bir** sensör susarsa (diğerleri canlıyken) alarm yoktur, pano sadece `STALE` görünür; panonun `status` alanı güncellenmez | Tek sensör için ayrı alarm, risk skorunu bayat veriye dayandırmamak | **Kısmen çözüldü (modül düzeyinde)** |
| 4 | Modül kilitlenmesi | Yazılım hatası, gürültü | Örnekleme durur | Görev watchdog'u yapılandırmada açık (`CONFIG_ESP_TASK_WDT_EN`); gerçek kartta denenmedi | Watchdog'un gerçek kartta doğrulanması, reset nedeninin kaydı | Kısmen |
| 5 | Güç kesintisi / brownout | Panonun ya da modül beslemesinin gitmesi | Modül yeniden başlar, RAM'deki tampon kaybolur | Açılışta yeniden provizyon eder; tampon kalıcı değildir | Kalıcı tampon, güç izleme | Var, sınırlı |
| 6 | Yanlış pozitif (sahte alarm) | EMI/ADC sıçraması | Gereksiz SMS, güven kaybı | Ortalama alma ve 10 okumalık pencere gürültüyü azaltır; **ark flaş/akustik pencere tepe değerini kullanır**, tek sıçrama 10 tick boyunca skor tabanı oluşturabilir | Girişte filtre, kritik kanallarda kısa süreli teyit (bkz. [field-conditions.md](field-conditions.md)) | Kısmen |
| 7 | Yanlış negatif (tehlike görülmez) | Sıcaklık probu yüzeye temas etmiyor, yanlış konum | Gerçek sıcaklık düşük okunur | Yok; yalnızca devreye alma testi yakalar | Devreye alma testi, kablo-ortam farkının akımla tutarlılığını denetleyen bir kural | Yapılmadı |
| 8 | **Alarm dalgalanması (flapping) ve bildirim fırtınası** | Skor eşik civarında gidip gelir (gürültü ya da iki veri kaynağı) | Aynı pano için art arda alarm açılıp kapanır, her yeni alarm yeni SMS/WhatsApp gönderir | Gözlendi: aynı panoya iki kaynak yazarken (`demo:critical`'ın simülatörü ve büyük olasılıkla açık kalmış Wokwi) alarm yaklaşık 2 sn arayla açılıp kapandı. **Çözüldü:** RISK alarmı arka arkaya 5 normal analizden önce çözülmez (histerezis), seviye düşüşü yeni alarm açmaz, ve aynı pano/tür/kanal için 2 dk içinde aynı ya da daha düşük seviyede tekrar SMS gitmez (cooldown); seviye yükselişi her zaman bildirilir | Sahada eşikler (5 tick, 2 dk) gerçek veriyle ayarlanmalı | **Çözüldü (prototipte)**; anomali kayıtları hâlâ anında çözülür, bastırılan bildirim yalnızca log'a yazılır |
| 9 | Yanlış pano koduna bağlı modül | Konfigürasyon hatası, yanlış etiket | Veri başka panoya yazılır | Kod eşleşmesiyle provizyon; kimlik doğrulama yok | Devreye alma kabulünde etiket teyidi, modül başına API anahtarı | Eksik |
| 10 | Yetkisiz/sahte veri | Ağa erişen biri veri yollar | Yanlış alarm ya da gerçek alarmın maskelenmesi | Ingest'te kimlik doğrulama yok | Modül başına API anahtarı/mTLS, ağ segmentasyonu | Eksik (production öncesi zorunlu) |
| 11 | Saat hatası | SNTP'ye erişilemedi | Yanlış zaman damgası | Saat senkron olmadan zaman damgası **göndermez**, sunucu kendi zamanını kullanır (birim testli) | Çevrimdışı saat kaynağı | Var |
| 12 | Bildirim kanalı hatası | SMS/WhatsApp gateway kapalı | Operasyon ekibi uyarılmaz | 3 deneme ve `FAILED` kaydı, alarm etkilenmez; kanal yedeği ve escalation yok (bkz. [notification-policy.md](notification-policy.md)) | Kanal yedeği, onaylanmayan alarm için escalation | Kısmen |
| 13 | Sunucu (API/DB) arızası | Docker/host arızası | İzleme durur | Docker Compose `restart: unless-stopped`; tek örnek, yüksek erişilebilirlik yok | Yedekli kurulum, sağlık denetimi | Sınırlı |
| 14 | Sensör kalibrasyon kayması | Yaşlanma, sıcaklık | Yanlış değer | Yok; ADC eşlemesi sahaya göre kalibre edilmemiştir | Periyodik doğrulama/kalibrasyon | Yapılmadı |
| 15 | Modül kaynaklı yangın/hasar | Kısa devre, aşırı ısınma | Pano riski | Modülün panoya çıkışı yoktur; kutu ve sigorta önerisi var, uygulanmadı | Sigorta, V-0 kutu, izolasyon (bkz. [field-conditions.md](field-conditions.md)) | Yapılmadı |

**Öncelik.** Bu sürümde iki en kritik boşluk kapatıldı: 3 numaralı madde
(susan modül artık alarm ve SMS üretir) ve 8 numaralı madde (histerezis ve
cooldown). Kalan öncelikli işler: 10 numaralı (ingest'te kimlik doğrulama yok),
tek sensör susması (#1/#3) ve risk skorunun bayat veriye dayanması.

## 3. Bakım

- **Rutin bakım hedefi: yok.** Modül sürekli çalışır, arızayı kendisi bildirmelidir
  (bu, 3 numaralı maddenin çözümüne bağlıdır).
- **Periyodik kontrol (öneri):** Yıllık LED/bağlantı kontrolü, sensör kalibrasyon
  doğrulaması, konnektör sıkılığı.
- **Yazılım güncellemesi:** Bugün karta fiziksel erişim ve yeniden derleme
  gerekir. Kablosuz güncelleme (OTA) yoktur; müdahale sayısını azaltmak için
  gerekli bir ek olarak öngörülür.
- **Modül değişimi:** Çıkarılabilir konnektörlerle; yeni modüle pano kodu verilir,
  provizyon sensörleri kendisi bulur.

## İlgili dosyalar

| Dosya | İçerik |
| ----- | ------ |
| [field-conditions.md](field-conditions.md) | Sıcaklık, manyetik alan ve çevre etkileri |
| [field-installation.md](field-installation.md) | Kurulum ve güç prensipleri |
| [panel-deployment-concept.md](panel-deployment-concept.md) | 1600 kVA AG panel yerleşim konsepti |
| [notification-policy.md](notification-policy.md) | Bildirim politikası |
| [firmware-flow.md](firmware-flow.md) | Firmware akışı ve hata yönetimi |
