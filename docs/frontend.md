# Frontend Tasarımı

Şartname maddesi: "Frontend tasarımları ve kaynak kodları". Kaynak kod: [`apps/web`](../apps/web). Ekran görüntüleri gerçek çalışan uygulamadan (izole veritabanı, tohum verisi, simülatör) headless tarayıcı ile alınmıştır; mock-up değildir.

## Teknoloji

React 19, Vite, React Router, Recharts, TypeScript. Backend'e polling ile bağlanır (2-3 sn). SCADA sayfası ayrıca SCADA geçidinin HTTP ucundan okur. Ortak tipler `packages/shared` içindedir.

## Sayfalar

| Sayfa | Rota | Kaynak | Amaç |
|---|---|---|---|
| Overview | `/` | `src/pages/OverviewPage.tsx` | Pano sayısı, risk seviyesi dağılımı, pano tablosu (veri sağlığı dahil), son alarmlar, erken uyarı etkinliği |
| Panels | `/panels` | `src/pages/PanelsPage.tsx` | Filtrelenebilir/aranabilir pano listesi |
| Panel Detail | `/panels/:id` | `src/pages/PanelDetailPage.tsx` | Risk skoru ve bileşenleri, kritik eşik tahmini, neden/önerilen aksiyonlar, sensör değerleri ve grafikleri, anomaliler, olay zaman çizelgesi |
| Alarms | `/alarms` | `src/pages/AlarmsPage.tsx` | Alarm listesi, durum/önem filtresi, onaylama (acknowledge), bildirim teslim tablosu |
| SCADA | `/scada` | `src/pages/ScadaPage.tsx` | SCADA'nın gördüğü gerçek Modbus register tablosu, geçit ve veri kalitesi durumu |

## Ekran görüntüleri

### Overview
![Overview](assets/screens/01-overview.png)

### Panels
![Panels](assets/screens/02-panels.png)

### Panel Detail (PANO-003, kritik)
![Panel Detail](assets/screens/03-panel-detail.png)

### Alarms: risk alarmları
![Alarms](assets/screens/04-alarms-risk.png)

### Alarms: MODULE OFFLINE (saha modülü sustuğunda)
![Alarms offline](assets/screens/05-alarms-offline.png)

### SCADA / Modbus
![SCADA](assets/screens/06-scada.png)

## Notlar

- Overview ve Alarms ekranlarında görülen çok sayıda PANO-003 alarmı, aynı gün içinde defalarca tekrarlanan demo koşularından kalmadır.
- Görüntüler yerel provada alınmıştır; gerçek saha verisi değildir.
- Yeniden üretmek için: temiz DB + seed, tek simülatör (`npm run demo:critical`), sonra headless tarayıcı ile sayfaları açın.
