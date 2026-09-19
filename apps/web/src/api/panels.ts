import type { Anomaly, PanelDetail, PanelRiskResponse, PanelSummary, Sensor, SensorReading } from '@grid-up/shared';
import { apiGet } from './client';

export const panelsApi = {
  list: () => apiGet<PanelSummary[]>('/panels'),

  get: (id: string) => apiGet<PanelDetail>(`/panels/${id}`),

  risk: (id: string, limit?: number) => apiGet<PanelRiskResponse>(`/panels/${id}/risk`, { limit }),

  sensors: (id: string) => apiGet<Sensor[]>(`/panels/${id}/sensors`),

  readings: (id: string, params: { sensorId?: string; limit?: number } = {}) =>
    apiGet<SensorReading[]>(`/panels/${id}/readings`, params),

  anomalies: (id: string, resolved?: boolean) =>
    apiGet<Anomaly[]>(`/panels/${id}/anomalies`, resolved === undefined ? {} : { resolved: String(resolved) }),
};
