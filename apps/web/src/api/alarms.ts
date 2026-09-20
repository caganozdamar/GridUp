import type { Alarm, AlarmStatus, AlarmWithPanel, Severity } from '@grid-up/shared';
import { apiGet, apiPatch } from './client';

export const alarmsApi = {
  list: (params: { status?: AlarmStatus; severity?: Severity } = {}) =>
    apiGet<AlarmWithPanel[]>('/alarms', params),

  byPanel: (panelId: string, status?: AlarmStatus) =>
    apiGet<Alarm[]>(`/panels/${panelId}/alarms`, status ? { status } : {}),

  acknowledge: (alarmId: string) => apiPatch<Alarm>(`/alarms/${alarmId}/acknowledge`),
};
