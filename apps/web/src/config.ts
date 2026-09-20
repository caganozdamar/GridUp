export const API_BASE_URL: string = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';

// SCADA ekrani, SCADA Gateway'in read-only HTTP ucundan (Modbus register tablosu) okur.
export const SCADA_GATEWAY_URL: string = import.meta.env.VITE_SCADA_GATEWAY_URL ?? 'http://localhost:1580';

// Asama 5 madde 8: polling araliklari (ms) - tek yerden degistirilebilir.
export const POLLING_INTERVALS = {
  overview: 3000,
  panelsList: 3000,
  panelDetail: 2000,
  alarms: 3000,
  scada: 2000,
} as const;

// Asama 5 madde 7: sensor/chart basina gosterilecek reading sayisi.
export const CHART_POINTS = 30;
