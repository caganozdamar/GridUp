import type { OperationalMetrics } from '@grid-up/shared';
import { apiGet } from './client';

// Asama 9 madde 20-23: Operational / Early Warning Metrics.
export const metricsApi = {
  operations: () => apiGet<OperationalMetrics>('/metrics/operations'),
};
