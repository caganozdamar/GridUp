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
tick'lerinde ya da alarm sürerken tekrar gönderilmez. Alarm iki türdür
(`Alarm.kind`): **RISK** (risk skoru HIGH/CRITICAL) ve **MODULE_OFFLINE** (panonun
hiçbir sensöründen veri gelmiyor). İki tür birbirinin yaşam döngüsünü etkilemez.

**Seviye değişimi.** Seviye **yükselirse** (HIGH → CRITICAL) eski alarm kapanır,
yeni seviyede yeni bir alarm açılır ve **yeni bildirim** gider; kötüleşen durum
her zaman yeniden duyurulur. Seviye **düşerse** (CRITICAL → HIGH) mevcut alarm
olduğu gibi açık kalır: risk hâlâ alarm bandındadır ve seviye sınırında gidip
gelen bir skor her tick yeni SMS üretmez.

| Risk seviyesi | Risk skoru | Kanal | Mesaj |
| ------------- | ---------- | ----- | ----- |
| NORMAL / WARNING | 0-59 | Bildirim yok (alarm oluşmaz, dashboard'da izlenir) | — |
| HIGH | 60-79 | SMS | Kısa: pano, skor, ilk neden, "dashboard'a bakın" |
| CRITICAL | 80-100 | SMS + WhatsApp | SMS: "acil inceleme önerilir"; WhatsApp: pano, saha, skor, tespit edilen koşullar (en fazla 4) |
| **Susan modül** (MODULE_OFFLINE) | — | SMS (HIGH) | "module offline", ne kadar süredir veri yok, "pano izlenmiyor" |

### Susan modül alarmı

Risk motoru yalnızca veri **geldiğinde** çalışır, bu yüzden veri kesilince kendi
başına bir şey tetiklemez. `ModuleHealthService` her 15 saniyede bir her panonun
**en yeni okumasının yaşına** bakar:

- **Açılır:** panonun hiçbir sensöründen `MODULE_OFFLINE_AFTER_MS` (varsayılan
  **60 sn**) boyunca okuma gelmediyse. Eşik, dashboard'daki 10 sn'lik "STALE"
  rozetinden bilerek daha uzundur: kısa bir ağ kesintisi alarm üretmesin.
- **Çözülür:** okuma tekrar geldiğinde (en yeni okuma 10 sn'den taze).
- **Açılmaz:** hiç veri göndermemiş pano (`NO_DATA`) için. Henüz kurulmamış bir
  modül kimseyi uyandırmamalıdır. Diğer sensörler canlıyken **tek bir sensörün**
  susması bu alarmın kapsamı dışındadır (pano yalnızca `STALE` görünür).
- Alarm bir kez açılır, sessizlik sürdükçe tekrar açılmaz ve bildirim yinelenmez.
  Onaylanabilir (Acknowledge).

Konfigürasyon: `apps/api/src/notifications/notifications.config.ts`
(`SEVERITY_CHANNEL_MAP`). Mesaj içeriği sabit değildir; gerçek risk verisinden
(`score`, `reasons`) üretilir (`notification-message.util.ts`).

### Histerezis ve cooldown

İki mekanizma, eşik civarında gidip gelen bir skorun **alarm ve SMS fırtınası**
üretmesini engeller:

- **Çözülme histerezisi.** Bir RISK alarmı, risk **arka arkaya
  `ALARM_RESOLVE_AFTER_TICKS` (varsayılan 5, yani 2 sn'lik tick'te ≈ 10 sn)
  analiz boyunca** alarm bandının altında kalırsa çözülür. Tek bir düşük okuma
  alarmı kapatıp bir sonraki tick'te yeniden açmaz. Durum `RiskScore` kayıtlarından
  türetilir, API yeniden başlasa da sayaç kaybolmaz.
- **Bildirim cooldown'u.** Aynı pano + aynı alarm türü + aynı kanal için, son
  `NOTIFICATION_COOLDOWN_MS` (varsayılan **2 dk**) içinde **aynı ya da daha
  yüksek seviyede** bir bildirim zaten gönderildiyse yenisi gönderilmez
  (log'a `suppressed` yazılır). **Seviye yükselişi cooldown'a takılmaz**
  (HIGH sonrası CRITICAL her zaman bildirilir). Ulaşmamış (`FAILED`) bildirimler
  cooldown sayılmaz. `0` = kapalı; demo provalarında kullanılır.

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
- **Cooldown bir uyarıyı bilerek bastırır.** Aynı seviyede yeni bir alarm, ilk
  bildirimden 2 dk sonra açılırsa SMS gider; 2 dk içinde açılırsa gitmez (alarm
  ve dashboard'da görünür, ama SMS yok). Bastırılan bildirim şu an yalnızca log'a
  yazılır, `notifications` tablosunda ayrı bir `SUPPRESSED` kaydı yoktur.
  Aynı pano dalgalanması gerçekten sürüyorsa bu, ilk SMS'in yeterli olduğu
  varsayımına dayanır.
- **Anomali kayıtları hâlâ anında çözülür.** Histerezis yalnızca **alarm**
  yaşam döngüsündedir; ayrı `Anomaly` kayıtları (ve zaman çizelgesindeki
  ANOMALY olayları) eşikte gidip gelirse eskisi gibi açılıp kapanır.
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
