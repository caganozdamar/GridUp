# Demo Provası Sonuçları

Tarih: 2026-09-20. [demo-script.md](demo-script.md) adımları, temiz ve izole bir yığında (ayrı veritabanı `grid_up_screens`, API :3100, SCADA geçidi Modbus :1512 / HTTP :1590, Vite :5174, tohum verisi: 5 pano) koşturuldu. Kontroller API ve `scada:read` çıktısı üzerinden yapıldı; dashboard'un **görsel** kontrolü bu provada yapılmadı.

| Adım | Sonuç | Not |
|---|---|---|
| 1. Normal işletim | GEÇTİ | 5 pano NORMAL (skor 3-9), aktif alarm yok. Önceki MODULE_OFFLINE alarmları veri gelince kendiliğinden çözüldü. |
| 2. Arıza başlangıcı | GEÇTİ | `demo:critical` PANO-003'ü birkaç saniyede CRITICAL yapıyor. |
| 3. Erken uyarı | KISMEN | Skor NORMAL → WARNING → CRITICAL geçişi görüldü, ama çok hızlı; HIGH bandı gözden kaçabiliyor (bilinen sınırlama, [decision-support.md](decision-support.md)). |
| 4. Bildirim | GEÇTİ | CRITICAL alarm için SMS ve WhatsApp `SENT`; olay zaman çizelgesi anomali/risk seviyesi olaylarını içeriyor. |
| 5. SCADA | GEÇTİ | `scada:read`: Risk Score 100, CRITICAL, Cable 95,0 °C, Current 220 A, Active Alarm YES, Data Quality VALID. |
| 5b. Veri kesintisi | GEÇTİ | Simülatör durunca ~15 sn içinde Data Quality INVALID; ~1 dk içinde 5 panelin hepsinde MODULE_OFFLINE alarmı açıldı. |
| 6. On-prem mimari | GEÇTİ | `docker compose -f docker-compose.onprem.yml up -d --build` ilk kez gerçekten çalıştırıldı: 4 konteyner ayağa kalktı, API `/health` ok, web :8080 200, Modbus/SCADA geçidi yanıt verdi; simülatör verisiyle risk 100 CRITICAL ve alarm/bildirim üretildi. `down` ile kapatıldı. |
| 7. Ölçek | GEÇTİ | Sayılar [scalability.md](scalability.md) ve [resource-usage.md](resource-usage.md) içinde. |
| 8. Fiziksel modül | ATLANDI | Wokwi/VS Code gerektirir; kullanıcı tarafından denenmeli. Firmware yalnızca Wokwi'de çalıştırılmıştır. |

## Prova sırasında bulunan sorunlar

1. **On-prem yığında tohum verisi yok.** Yeni kurulumda `/panels` boş döner ve simülatör çalışamaz. Prova için host'tan, konteyner IP'sine `DATABASE_URL` verilerek `npm run prisma:seed` çalıştırıldı (onprem-postgres portu host'a açık değil). Demo öncesi bu adım belgelenmeli veya compose'a seed eklenmeli. **Düzeltilmedi.**
2. **Risk skoru çırpınıyor.** `COMBINED_FAILURE` sırasında PANO-003 skoru arada NORMAL'e (3-9) düşüp tekrar 100'e dönebiliyor; bu yüzden aynı panoda kısa aralıklarla birden çok CRITICAL alarm açılıp çözülüyor (yaklaşık 30 alarm satırı birkaç dakikada). Bildirim cooldown'u SMS/WhatsApp yağmurunu engelliyor. Jüri önünde Alarms sayfası kalabalık görünebilir. **Düzeltilmedi.**
3. **Aynı anda aynı panoya iki alarm.** Aynı milisaniyede aynı panoya iki CRITICAL alarm satırı oluşuyor (çift kayıt). **Düzeltilmedi.**
4. **Prova hatası (ürün hatası değil):** Birden fazla simülatör örneği üst üste çalışınca (`demo:*` betiği `tsx watch` alt süreçlerini bırakıyor) sonuçlar karışıyor. Demoda yeni senaryoya geçmeden önce eski simülatörün gerçekten durduğu `ps` ile kontrol edilmeli; `Ctrl+C` ile durdurmak yeterli olmalı.
5. **Okuma uç noktaları büyük veride yavaşlıyor** ([resource-usage.md](resource-usage.md) §5); demo veritabanı küçük tutulmalı.

## Demo öncesi kısa liste

- Temiz DB + seed; tek simülatör; Wokwi yalnızca adım 8'de.
- Adım 1 için `npm run demo:normal`, ~40 sn bekleyip tüm panoların NORMAL olduğunu doğrulayın.
- Simülatör aynı anda yalnızca bir tane çalışsın.
