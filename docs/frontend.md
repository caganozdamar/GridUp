# Frontend Tasarımı

Şartname maddesi: "Frontend tasarımları ve kaynak kodları". Kaynak kod: [`apps/web`](../apps/web). Ekran görüntüleri depoya eklenmemiştir; sayfalar yerelde çalıştırılarak görülür (aşağıdaki "Yeniden üretmek için").

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

## Notlar

- Gösterilen veri simülatörden gelir; gerçek saha verisi değildir.
- Yeniden üretmek için: temiz DB + seed (`npm run prisma:seed`), tek simülatör (`npm run demo:critical`), sonra `npm run dev:web` ile sayfaları açın.
