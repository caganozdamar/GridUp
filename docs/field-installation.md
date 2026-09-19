# Field Module — Enclosure / Installation Concept (Aşama 8)

Bu doküman, GRID UP Field Module'ün fiziksel enclosure ve kurulum konseptini
tanımlar. **Bu, üretim seviyesinde bir endüstriyel tasarım değildir** — saha
mühendisliği, panel çizimleri ve üretici gereksinimleriyle doğrulanması
gereken bir kavramsal yaklaşımdır (bkz.
[panel-deployment-concept.md](panel-deployment-concept.md)).

## Konsept prensipleri

- **Compact enclosure:** Panonun mevcut serbest hacmine sığacak küçük,
  tek parça bir kutu.
- **DIN-rail mounting (uygun olduğunda):** Çoğu AG panosunda zaten mevcut
  olan DIN ray sistemine takılabilir montaj ayağı.
- **Removable connectors:** Her sensör girişi, ayrı ve çıkarılabilir bir
  konnektörle bağlanır — sensör kablosunu sökmek için modülün kendisini
  sökmek gerekmez.
- **Labelled sensor ports:** Yanlış bağlantı riskini azaltmak için her port
  net şekilde etiketlenir.
- **Module ID / QR label:** Her modülün üzerinde, saha ekibinin hangi modülün
  hangi panoya ait olduğunu hızlıca doğrulayabileceği bir modül ID etiketi
  (ve isteğe bağlı QR kod).
- **Status LED:** Modülün temel durumunu (güç var / haberleşiyor / hata)
  saha ekibine görsel olarak gösteren tek bir LED.
- **Service/replacement access:** Modül, panonun geri kalanına dokunmadan
  sökülüp değiştirilebilir olmalı (bakım dostu).
- **Cable routing minimized:** Sensör kabloları, mevcut kablo kanallarını
  izleyecek şekilde en kısa güzergahtan geçirilir; panodaki kablo
  karmaşasını artırmayacak şekilde planlanır.
- **HV/live bölümlere güvenli mesafe:** Modülün kendisi ve düşük gerilim
  sensör kablolaması, saha tasarımının gerektirdiği güvenli mesafe
  kurallarına uygun şekilde yerleştirilir (kesin mesafe değerleri saha
  mühendisliği tarafından belirlenir — bu doküman kesin bir mesafe
  önermez).

## Örnek port isimlendirmesi (konsept)

```
┌─────────────────────────────┐
│      GRID UP FIELD MODULE    │
│                              │
│  [ TEMP/HUM ]  [ CABLE TEMP ]│
│                              │
│  [ CURRENT ]   [ SERVICE ]   │
│                              │
│  [ POWER ]        ● STATUS  │
└─────────────────────────────┘
```

| Port | Amaç |
| ---- | ---- |
| TEMP/HUM | Ambient temperature + humidity sensör girişi |
| CABLE TEMP | Cable/surface temperature sensör girişi |
| CURRENT | Non-invasive akım sensörü (CT/clamp) girişi |
| SERVICE | Bakım/debug erişimi (örn. firmware güncelleme, lokal teşhis) |
| POWER | İzole düşük gerilim DC güç girişi (bkz. aşağıdaki "Power" notu) |
| STATUS | Tek durum LED'i |

> Port isimleri ve sayısı yalnızca konsept amaçlıdır; gerçek üretim
> tasarımında saha mühendisliği ve seçilen bileşenlere göre değişebilir.

## Power (özet)

Field Module'ün güç yaklaşımı, doğrudan şebeke gerilimine bağlanmayan,
izole düşük gerilim DC bir besleme öngörür. Detaylar için bkz. README
"Production Considerations" bölümü ve aşağıdaki uyarı:

> Şebeke gerilimine doğrudan breadboard/MCU bağlantısı **önerilmez**.
> Hackathon demo modülünde USB güç kullanılması yalnızca demo amaçlıdır,
> production yaklaşımı değildir.

## Bu doküman NE YAPMAZ

- Kesin bir montaj noktası, mesafe veya vida/ray ölçüsü belirtmez.
- Belirli bir marka/model enclosure önermez.
- Elektrik güvenliği açısından bağlayıcı bir saha montaj talimatı değildir.

Gerçek saha kurulumu; panel drawing, üretici gereksinimleri, elektrik
güvenliği incelemesi ve saha mühendisliği ile doğrulanmalıdır (bkz.
[panel-deployment-concept.md](panel-deployment-concept.md)).

## İlgili dosyalar

| Dosya | İçerik |
| ----- | ------ |
| [field-module.md](field-module.md) | Low-Risk Installation tasarım prensipleri (genel) |
| [hardware-architecture.md](hardware-architecture.md) | Donanım blok diyagramı |
| [panel-deployment-concept.md](panel-deployment-concept.md) | 1600 kVA AG panel için generic deployment konsepti |
