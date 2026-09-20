# Saha Koşulları: Sıcaklık, Manyetik Alan ve Çevre Etkileri

Hackathon brief'i şunu açıkça ister: "Tasarımda kabin içerisindeki yüksek ve
düşük sıcaklık, yoğun manyetik alan gibi olumsuz saha koşulları göz önünde
bulundurulmalıdır." Bu doküman, Field Module'ün bu koşullara karşı **tasarım
yaklaşımını** anlatır. Kurulum ve arıza analizi için bkz.
[installation-and-failure-analysis.md](installation-and-failure-analysis.md).

> **Kapsam ve dürüst çerçeve.** Bu bir **tasarım dokümanıdır**. Hiçbir sıcaklık,
> EMC veya titreşim testi yapılmamıştır ve gerçek bir kartla denenmemiştir
> (firmware yalnızca Wokwi'de çalıştırılmıştır). Aşağıdaki sıcaklık değerleri
> **tasarım hedefleridir**, seçilecek her bileşenin üretici datasheet'inden
> doğrulanmalıdır. Standart adları yol göstermek içindir; uygunluk iddiası
> değildir. ADM/GDZ'nin kendi saha şartnamesi (TEDAŞ MYD) elimizde olmadığı için
> oradaki gereksinimlerle karşılaştırılmamıştır.

## Pano içinde olumsuz koşulların kaynakları

| Koşul | Pano içindeki kaynağı | Field Module'e etkisi |
| ----- | --------------------- | --------------------- |
| Yüksek sıcaklık | Bara/kablo bağlantı noktalarındaki ısınma, yüksek yük, zayıf havalandırma | Bileşen ömrü kısalır, ADC ve sensör kayması artar, en kötüde arıza |
| Düşük sıcaklık | Açık hava/soğuk bölge, ısıtıcısız pano | Soğuk açılışta bileşen davranışı, pil kapasitesi düşer |
| Nem ve yoğuşma | Sıcaklık düşerken nemin yoğuşması | Kısa devre/kaçak akım, korozyon (nem zaten ölçülen bir kanaldır) |
| Yoğun manyetik alan | Baralardan geçen yüksek akım (50 Hz alan), anahtarlama geçici rejimleri | Analog hatlara indüklenen gerilim, CT hatası/doyma, ADC gürültüsü |
| Elektriksel gürültü (EMI) | Kontaktör/anahtarlama, ark, harmonikler | Yanlış okuma, haberleşme hatası, resetler |
| Titreşim | Trafo uğultusu (100 Hz), kontaktör darbeleri | Gevşeyen konnektör, lehim yorulması |
| Toz ve kirlilik | Pano içi ortam | Yalıtım direnci düşer, soğutma azalır |
| Yangın/ark riski | Arıza anında | Modül tutuşma kaynağı olmamalı, alevi taşımamalı |

## 1. Sıcaklık

**Yerleşim ilkesi.** Modül kartı, en sıcak noktalara (baraların birleşimi, yüksek
akımlı bağlantılar) değil, pano içindeki **daha soğuk ve erişilebilir bir
bölgeye** monte edilir; yalnızca **sensör uçları** sıcak noktaya gider. Ölçülen
şey zaten sıcak noktadır, elektronik orada durmak zorunda değildir.

**Bileşen sınıfı.** Endüstriyel sıcaklık dereceli bileşenler seçilir. Tasarım
hedefi olarak çalışma aralığı için **en az −25 °C … +70 °C** öngörülür (pano içi
en kötü durum artı marj); gerçek değer, saha sıcaklık ölçümüyle ve datasheet'lerle
kesinleştirilmelidir. Hazır geliştirme kartı yerine (demo prototipteki
ESP32 DevKit) çıplak modül ve özel kart kullanılır.

**Derating ve ömür.** Yüksek sıcaklık elektrolitik kondansatör ve konnektör
ömrünü düşürür. Seçim kriteri: sıcaklık derecesi yüksek kondansatörler, pil
kullanılmayan (ya da yüksek sıcaklığa dayanıklı) güç mimarisi.

**Modülün kendi sağlığı.** Modül kendi kart sıcaklığını okuyup (kart üstü bir
NTC) kanal olarak gönderirse, "modül aşırı ısındı" durumu pano riskinden ayrı
olarak izlenebilir. **Prototipte yoktur**, önerilen bir eklemedir.

**Düşük sıcaklık ve yoğuşma.** Soğuk bölgelerde nem yoğuşabilir. Nem kanalı
(`HUMIDITY`) bunu zaten risk skoruna katar. Kart için: conformal coating
(vernik) ve yoğuşmaya dayanıklı konnektörler. Pil kullanımı soğukta kapasite
kaybı yüzünden önerilmez.

## 2. Yoğun manyetik alan ve EMI

Baralardan geçen büyük akımlar, modülün çevresinde güçlü bir 50 Hz manyetik alan
yaratır. Bu alan, sensör kablolarının oluşturduğu **döngülerde** gerilim
indükler. Analog bir sensör (NTC, ses, optik) kısa bir kabloyla bile bundan
etkilenebilir. Kullandığımız ADC girişleri bu yüzden en zayıf halkadır.

| Önlem | Neden | Prototipteki durumu |
| ----- | ----- | ------------------- |
| Sensör kablolarını **kısa** tutmak, modülü sensöre yaklaştırmak | İndüklenen gerilim döngü alanıyla orantılıdır | Konsept |
| **Burgulu (twisted pair) ve ekranlı** kablo, ekranın tek noktadan topraklanması | Ortak mod gürültüyü ve indüksiyonu azaltır | Konsept |
| Uzun hatlarda analog gerilim yerine **dijital/akım çıkışlı** sensör (RS-485, 1-Wire, 4-20 mA) | Gürültüye çok daha dayanıklı | Konsept (prototip analog kullanır) |
| **Baralardan uzak** yerleşim, kablo-bara kesişimlerini **90°** yapmak | Alan bağlaşımını azaltır | Konsept |
| CT: **split-core/Rogowski**, yük (burden) direnci modülün girişinde, doyma payı | Manyetik alan ve doyma CT hatasına yol açar | Konsept (prototip potansiyometre) |
| Girişte **RC filtre** ve **TVS** | Geçici gerilim ve yüksek frekanslı gürültü | Konsept (Wokwi şemasında yok) |
| Metal modül kutusu (Faraday) ve anten planı | Metal pano kutusu Wi-Fi sinyalini zayıflatır; dış anten ya da kablolu hat gerekebilir | Konsept |
| **Ortalama alma ve filtreleme** | Rastgele gürültüyü bastırır | **Var:** ADC kanalları 8 örnek ortalaması, akustik kanal 64 örneklik RMS |
| **Aralık dışı/kopukluk denetimi** | Açık/kısa devre bir sıcaklık gibi görünmemeli | **Var:** NTC ADC 0 ya da tam ölçekteyse değer `NaN` olur, gönderilmez |
| **Watchdog** | Gürültü kaynaklı kilitlenmeden otomatik reset | Yapılandırmada açık (`CONFIG_ESP_TASK_WDT_EN`), gerçek kartta denenmedi |

**Bilinen tasarım gerilimi.** Ark flaş ve akustik skoru, pencere içindeki
**tepe değerden** hesaplanır (kısa süren bir ark, sonraki okumada bitse bile
pencere boyunca görünür kalsın diye). Bu, güvenlik açısından doğru tercihtir,
ama aynı zamanda tek bir gürültü sıçramasının (örn. EMI kaynaklı ADC hatası)
yanlış alarm üretebileceği anlamına gelir. Önlem olarak sahada girişte
filtreleme ve kısa süreli tekrar doğrulama (örn. iki ardışık okumada teyit)
düşünülmelidir, ama arkın hızlı doğasıyla dengelenmesi gerekir. Bu prototipte
uygulanmamıştır.

## 3. Mekanik, çevre ve güvenlik

- **Kutu:** Kendi kendine sönen (UL94 V-0 sınıfı) malzeme, uygun IP sınıfı (toz),
  modül alev taşımamalı ve tutuşma kaynağı olmamalıdır.
- **Titreşim:** Vidalı/kilitli ayrılabilir konnektörler, kart sabitleme, ağır
  bileşenlere ek destek.
- **Yalıtım mesafeleri:** Şebeke gerilimiyle doğrudan bağlantı kurulmaz; sensör
  girişleri izole edilir, modül alçak gerilim (5 V/3.3 V) tarafında kalır.
  Şebeke gerilimine breadboard/MCU bağlanması **önerilmez** (bkz.
  [field-installation.md](field-installation.md)).
- **Koruma:** Güç girişinde sigorta ve aşırı gerilim koruması, sensör girişlerinde
  TVS.

## 4. Tasarım hedefi ve doğrulama tablosu

| Hedef | Değer (tasarım hedefi) | Nasıl doğrulanır | Durum |
| ----- | ---------------------- | ---------------- | ----- |
| Çalışma sıcaklığı | −25 … +70 °C, marjlı | Datasheet taraması, sıcaklık odası testi | Yapılmadı |
| Nem/yoğuşma | Yoğuşmaya dayanıklı (vernikli) | Nem/yoğuşma testi | Yapılmadı |
| Manyetik alan | Bara yakınında ölçüm hatası sınırlı | Yüklü baraya yakın kıyaslama, sahte akım enjeksiyonu | Yapılmadı |
| EMC | Geçici gerilim/EFT/ESD bağışıklığı | Akredite EMC laboratuvarı | Yapılmadı |
| Titreşim | Trafo/kontaktör titreşimi | Titreşim testi | Yapılmadı |
| Yangın güvenliği | UL94 V-0, sigorta | Malzeme belgesi, inceleme | Yapılmadı |
| Yanlış alarm oranı | Uzun süreli sahada ölçülür | Pilot kurulum | Yapılmadı |

Bu tablodaki hiçbir madde bu hackathon kapsamında yapılmamıştır. Amaç, bir pilot
kurulumdan önce yapılması gerekenlerin açıkça listelenmesidir.

## İlgili dosyalar

| Dosya | İçerik |
| ----- | ------ |
| [installation-and-failure-analysis.md](installation-and-failure-analysis.md) | Kurulum prosedürü ve arıza modları analizi |
| [electronic-design.md](electronic-design.md) | Devre şeması ve sahaya geçişte değişecekler |
| [field-installation.md](field-installation.md) | Kurulum ve güç prensipleri |
| [field-module.md](field-module.md) | Modül konsepti ve sensör yaklaşımı |
