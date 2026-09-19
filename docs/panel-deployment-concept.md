# 1600 kVA AG Panel — Deployment Concept (Aşama 8)

Bu doküman, hackathon problem tanımındaki 1600 kVA AG (alçak gerilim) panel
senaryosu için **generic** bir Field Module dağıtım konsepti açıklar.

> **UYARI — bu doküman ne DEĞİLDİR:** Bu, belirli bir gerçek panonun kesin
> montaj talimatı, elektrik projesi veya saha uygulama planı **değildir**.
> Elektrik güvenliği açısından bağlayıcı bir montaj talimatı içermez.
> Gerçek uygulamadan önce panel drawing, üretici gereksinimleri, elektrik
> güvenliği incelemesi ve saha mühendisliği onayı **zorunludur**.

## Generic konsept

```
1600 kVA AG PANEL
│
├─ Ambient sensor        → panonun iç hacminin genel havalandırma/ortam
│                           koşullarını temsil eden bir nokta
│
├─ Cable/surface         → kritik termination / busbar / kablo bölgesi
│  temperature sensor       (seçim, panonun en yüksek termal risk taşıyan
│                            bağlantı noktasına göre yapılır)
│
├─ Current sensing        → seçilen bir giden/gelen iletken (non-invasive,
│                            clamp/split-core yaklaşım)
│
├─ Field Module            → uygun bir düşük gerilim/servis alanı
│                            (bkz. field-installation.md)
│
└─ Communication           → local gateway (bkz. field-module.md "Field
                             Communication Architecture")
```

Bu dört ölçüm noktası, bugünkü çalışan prototipteki dört `SensorType` ile
birebir eşleşir (bkz. [field-module.md](field-module.md)) — yani aynı panel
üzerinde birden fazla Field Module veya birden fazla sensör noktası
(örn. birden fazla kritik kablo bölgesi) production'da değerlendirilebilir,
ancak bu doküman kapsamında **tek bir generic örnek** sunulmuştur.

## Neden "generic"?

1600 kVA'lık bir AG panonun iç düzeni (kaç çıkış hücresi olduğu, hangi
bara/kablo bölgesinin en kritik olduğu, mevcut serbest montaj alanı) her
panoda ve her üreticide farklıdır. Bu yüzden bu doküman:

- **Yapar:** Hangi tip ölçümün, hangi genel bölgeyle ilişkilendirileceğini
  kavramsal olarak açıklar.
- **Yapmaz:** Belirli bir üretici/model panonun hangi vidasına, hangi
  mesafede, hangi izolasyon sınıfıyla montaj yapılacağını belirtmez.

## Doğrulama gereksinimleri (production öncesi zorunlu)

Gerçek bir 1600 kVA AG panelde Field Module dağıtımı yapılmadan önce
aşağıdakiler doğrulanmalıdır:

- **Panel drawing:** Panonun güncel tek hat şeması ve fiziksel yerleşim
  planı.
- **Manufacturer requirements:** Panel üreticisinin montaj/delme/ek ekipman
  ekleme konusundaki kısıtları ve garanti şartları.
- **Electrical safety review:** Yetkili bir elektrik mühendisi/saha
  güvenlik ekibi tarafından, önerilen sensör konumlarının güvenli mesafe ve
  izolasyon gereksinimlerine uygunluğunun incelenmesi.
- **Field engineering:** Saha ekibinin, kablo güzergahı ve Field Module
  montaj noktasının fiziksel olarak uygulanabilir olduğunu doğrulaması.

## İlgili dosyalar

| Dosya | İçerik |
| ----- | ------ |
| [field-module.md](field-module.md) | Sensör yaklaşımı ve low-risk installation prensipleri |
| [field-installation.md](field-installation.md) | Enclosure/port konsepti |
| [hardware-architecture.md](hardware-architecture.md) | Donanım blok diyagramı |
