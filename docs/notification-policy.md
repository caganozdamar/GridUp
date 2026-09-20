# Bildirim Politikası ve SMS/WhatsApp Gateway Entegrasyonu

Bu doküman, hackathon brief'inin şu maddelerini karşılar: "Kritik durumlarda
hangi otomatik aksiyonların ve bildirimlerin tetikleneceği tanımlanmalıdır" ve
"Alarm ve Acil Bildirim Mekanizması: SMS, WhatsApp veya benzeri kanallar üzerinden
uyarı gönderebilecek bir mekanizma tasarlanmalı veya prototip üzerinde
gösterilmelidir".

> **Kapsam ve dürüst çerçeve.** Bugün hiçbir gerçek SMS/WhatsApp hesabına
> bağlanılmamıştır ve gerçek bir telefona mesaj gönderilmemiştir. Çalışan
> parçalar: (1) `demo` sağlayıcı (terminale yazar), (2) yapılandırılabilir
> `http` gateway sağlayıcısı, yerel bir **gateway emülatörüne** karşı test
> edilmiştir. Gerçek bir gateway'e geçiş `.env` değişikliğidir, ama gerçek
> gateway ile denenmemiştir.

## Politika: kim, ne zaman, hangi kanaldan

Bildirim yalnızca **yeni bir alarm oluştuğu anda** tetiklenir. 2 saniyelik veri
tick'lerinde ya da alarm sürerken tekrar gönderilmez. Seviye değişirse (örn.
HIGH → CRITICAL) eski alarm kapanır, yeni seviyede yeni bir alarm açılır ve
**yeni bildirim** gider; böylece kötüleşen durum operasyon ekibine ayrıca
haber verilir.

| Risk seviyesi | Risk skoru | Kanal | Mesaj |
| ------------- | ---------- | ----- | ----- |
| NORMAL / WARNING | 0-59 | Bildirim yok (alarm oluşmaz, dashboard'da izlenir) | — |
| HIGH | 60-79 | SMS | Kısa: pano, skor, ilk neden, "dashboard'a bakın" |
| CRITICAL | 80-100 | SMS + WhatsApp | SMS: "acil inceleme önerilir"; WhatsApp: pano, saha, skor, tespit edilen koşullar (en fazla 4) |

Konfigürasyon: `apps/api/src/notifications/notifications.config.ts`
(`SEVERITY_CHANNEL_MAP`). Mesaj içeriği sabit değildir; gerçek risk verisinden
(`score`, `reasons`) üretilir (`notification-message.util.ts`).

**Alıcılar.** Her kanal için virgülle ayrılmış bir liste tanımlanır
(`SMS_RECIPIENT`, `WHATSAPP_RECIPIENT`); her alıcıya ayrı bildirim kaydı
oluşturulur. Örnek: nöbetçi operasyon mühendisi + saha ekibi lideri.

## Gönderim yaşam döngüsü

```
yeni alarm
  → her (kanal, alıcı) için Notification(PENDING) kaydı
       aynı alarm + kanal + alıcı için ikinci kayıt DB kısıtıyla engellenir
  → gönderim (provider.send)
       başarılı  → SENT   (providerMessageId, sentAt, attempts)
       hata      → bekle (0.5 sn, 1 sn, ...) ve tekrar dene, en fazla 3 deneme
       hepsi hata → FAILED (errorMessage, attempts)
```

- **Risk hattını bloklamaz.** Ağ kullanan sağlayıcıda gönderim arka planda
  çalışır; yavaş bir gateway veri girişini ve risk hesabını geciktirmez. Demo
  sağlayıcı ağsız olduğu için satır içi çalışır. `NOTIFICATION_DISPATCH` ile
  değiştirilebilir.
- **Bildirim hatası alarmı bozmaz.** Sağlayıcı hata verse bile alarm ve risk
  skoru normal kaydedilir; hata `FAILED` kaydı olarak dashboard'da görünür
  (`GET /notifications?status=FAILED`).
- **Sessiz düşmez.** `NOTIFICATION_PROVIDER` yanlış ya da gateway URL'i eksikse
  uygulama açılışta hata verir; gerçek bir alarmın sessizce demo'ya düşüp
  kimseye ulaşmaması engellenir.
- **İzlenebilirlik.** Her deneme sayısı, hata mesajı ve gateway mesaj kimliği
  `notifications` tablosunda tutulur.

## Gateway sözleşmesi (`http` sağlayıcı)

Sağlayıcı belirli bir markaya bağlı değildir. Aşağıdaki isteği kabul eden her
gateway ya da ince bir adaptör takılabilir:

```http
POST <NOTIFICATION_GATEWAY_URL>
Authorization: Bearer <NOTIFICATION_GATEWAY_TOKEN>     (token tanımlıysa)
Content-Type: application/json

{ "channel": "SMS" | "WHATSAPP", "to": "+905551112233", "message": "..." }
```

Yanıt `2xx` ise başarılıdır; gövdede `{ "id": "..." }` varsa mesaj kimliği olarak
kaydedilir. `2xx` dışındaki her yanıt ve zaman aşımı hata sayılır ve yeniden
denenir. Ayarlar: `NOTIFICATION_GATEWAY_URL`, `NOTIFICATION_GATEWAY_TOKEN`,
`NOTIFICATION_GATEWAY_TIMEOUT_MS`, `NOTIFICATION_MAX_ATTEMPTS`,
`NOTIFICATION_RETRY_BACKOFF_MS` (bkz. `apps/api/.env.example`).

## Sahada nasıl çalışır (on-premise)

Brief public cloud kullanılmamasını ister. Kanal seçenekleri:

| Seçenek | Nasıl | On-premise uyumu | Durum |
| ------- | ----- | ---------------- | ----- |
| **Yerel GSM modem / SMS gateway** | Şirket içinde SIM'li modem; gateway kutusu yukarıdaki sözleşmeye ince bir adaptörle bağlanır | **En uyumlu**: mesaj metni şirket dışına bir bulut servisine gitmez | Tasarım; denenmedi |
| **Operatör/kurumsal SMS API'si** | Sağlayıcının HTTP API'si; adaptör sözleşmeyi sağlayıcının biçimine çevirir | Yalnızca SMS metni dışarı çıkar; hesap ve gönderici başlığı onayı gerekir | Tasarım; denenmedi |
| **WhatsApp Business** | Onaylı **şablon mesaj** ve işletme doğrulaması gerekir; alıcının onayı (opt-in) alınmış olmalı; serbest metin gönderilemez | Sağlayıcı bulutu üzerinden çalışır | Tasarım; mesaj biçimi şablon değişkenlerine uyarlanmalı; denenmedi |

Öneri: birincil kanal olarak yerel GSM/SMS (bulut yok, internet kesintisinde de
çalışır), ikincil olarak WhatsApp (zengin içerik, ekip bilgilendirmesi).

## Demo: gerçek hesap olmadan tam HTTP yolu

```bash
# 1) Yerel gateway emülatörü (ilk 2 isteği bilerek 503 döner)
MOCK_GATEWAY_FAIL_FIRST=2 npm run mock:sms

# 2) API'yi http sağlayıcıyla başlat
NOTIFICATION_PROVIDER=http NOTIFICATION_GATEWAY_URL=http://localhost:4010/send \
SMS_RECIPIENT="+905550000001,+905550000002" npm run dev:api

# 3) Kritik senaryoyu tetikle
npm run demo:critical
```

Emülatör penceresinde gelen mesajlar ve simüle edilen hatalar görünür; API,
hatada yeniden dener. Dashboard'da Alarms sayfasındaki bildirim tablosunda her kayıt
izlenir; API'de `GET /notifications` `attempts` ve durumu döner. Emülatör seçenekleri: `MOCK_GATEWAY_DELAY_MS` (yavaş
gateway / zaman aşımı), `MOCK_GATEWAY_TOKEN` (yetkilendirme).

## Bilinen sınırlar

- **Gerçek gateway ile denenmedi.** Sözleşme ve hata yolları yerel emülatöre ve
  gerçek bir yerel HTTP sunucusuna karşı testlidir; gerçek bir GSM modem, SMS
  API'si veya WhatsApp Business hesabıyla doğrulanmamıştır.
- **Teslim raporu yok.** `SENT`, gateway'in isteği kabul ettiği anlamına gelir;
  mesajın telefona ulaştığı (delivery receipt) izlenmez.
- **Yeniden başlatma.** API, bir bildirim `PENDING` iken kapanırsa o kayıt
  otomatik yeniden gönderilmez (kapanışta bekleyen gönderimler tamamlanmaya
  çalışılır, ama ani kesintide kayıp mümkündür).
- **Kanal yedeği (fallback) yok.** SMS başarısız olursa otomatik WhatsApp'a
  geçilmez; her kanal bağımsızdır. İki kanal zaten CRITICAL'da birlikte gider.
- **Yükseltme (escalation) yok.** Alarm onaylanmazsa üst kademeye otomatik
  bildirim gitmez. Alarmı onaylamak mümkündür (`PATCH /alarms/:id/acknowledge`,
  dashboard'daki Alarms sayfasında **Acknowledge** butonu); onaylanan alarm açık
  kalır, aynı durum için yeni alarm veya bildirim üretilmez, risk normale
  dönünce çözülür. Ama onay süresine bağlı bir yükseltme kuralı yoktur.
- **Kişisel veri.** Telefon numaraları `notifications` tablosunda ve
  `GET /notifications` yanıtında açıktır; loglarda maskelenir. Kimlik doğrulama
  bu prototipte yoktur (production öncesi zorunludur, bkz.
  [on-premise-architecture.md](on-premise-architecture.md)).
- **Onaylı mesaj şablonu ve gönderici başlığı** gibi sağlayıcıya özgü şartlar
  koda dahil değildir.

## İlgili dosyalar

| Dosya | İçerik |
| ----- | ------ |
| `apps/api/src/notifications/` | Servis, sağlayıcılar, yapılandırma, mesaj üretimi |
| `apps/api/scripts/mock-sms-gateway.mjs` | Yerel gateway emülatörü |
| [on-premise-architecture.md](on-premise-architecture.md) | On-premise dağıtım ve production notları |
| [project-status.md](project-status.md) | Uygulanan / gelecek özellikler |
