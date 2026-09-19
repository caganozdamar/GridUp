import { useEffect, useMemo, useState } from 'react';
import { AlarmStatus, Severity } from '@grid-up/shared';
import { Header } from '../components/layout/Header';
import { LoadingState } from '../components/common/LoadingState';
import { ErrorBanner } from '../components/common/ErrorBanner';
import { AlarmsTable } from '../components/alarms/AlarmsTable';
import { NotificationDeliveryTable } from '../components/notifications/NotificationDeliveryTable';
import { usePolling } from '../hooks/usePolling';
import { useSystemStatus } from '../context/SystemStatusContext';
import { alarmsApi } from '../api/alarms';
import { notificationsApi } from '../api/notifications';
import { POLLING_INTERVALS } from '../config';

const STATUS_FILTERS: Array<{ label: string; value: AlarmStatus | 'ALL' }> = [
  { label: 'ALL', value: 'ALL' },
  { label: 'ACTIVE', value: AlarmStatus.ACTIVE },
  { label: 'ACKNOWLEDGED', value: AlarmStatus.ACKNOWLEDGED },
  { label: 'RESOLVED', value: AlarmStatus.RESOLVED },
];

const SEVERITY_FILTERS: Array<{ label: string; value: Severity | 'ALL' }> = [
  { label: 'ALL', value: 'ALL' },
  { label: 'LOW', value: Severity.LOW },
  { label: 'MEDIUM', value: Severity.MEDIUM },
  { label: 'HIGH', value: Severity.HIGH },
  { label: 'CRITICAL', value: Severity.CRITICAL },
];

export function AlarmsPage() {
  const [statusFilter, setStatusFilter] = useState<AlarmStatus | 'ALL'>('ALL');
  const [severityFilter, setSeverityFilter] = useState<Severity | 'ALL'>('ALL');

  const { data: alarms, error, isLoading, isOnline, lastUpdated } = usePolling(
    () =>
      alarmsApi.list({
        status: statusFilter === 'ALL' ? undefined : statusFilter,
        severity: severityFilter === 'ALL' ? undefined : severityFilter,
      }),
    POLLING_INTERVALS.alarms,
    [statusFilter, severityFilter],
  );

  const { data: notifications } = usePolling(() => notificationsApi.list(), POLLING_INTERVALS.alarms, []);

  const { report } = useSystemStatus();
  useEffect(() => {
    report({ isOnline, lastUpdated });
  }, [isOnline, lastUpdated, report]);

  const sorted = useMemo(() => {
    const list = alarms ?? [];
    return [...list].sort((a, b) => {
      if (a.status === 'ACTIVE' && b.status !== 'ACTIVE') return -1;
      if (a.status !== 'ACTIVE' && b.status === 'ACTIVE') return 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [alarms]);

  return (
    <div className="page">
      <Header
        title="Alarms"
        subtitle="System alerts and detected electrical risks"
        autoRefreshMs={POLLING_INTERVALS.alarms}
      />

      {error && !alarms && <ErrorBanner message={`Unable to reach API: ${error}`} />}
      {isLoading && !alarms && <LoadingState label="Loading alarms…" />}

      {alarms && (
        <>
          <div className="panels-toolbar">
            <div className="filter-chips">
              {STATUS_FILTERS.map((f) => (
                <button
                  key={f.value}
                  className={`filter-chip${statusFilter === f.value ? ' active' : ''}`}
                  onClick={() => setStatusFilter(f.value)}
                  type="button"
                >
                  {f.label}
                </button>
              ))}
            </div>
            <div className="filter-chips">
              {SEVERITY_FILTERS.map((f) => (
                <button
                  key={f.value}
                  className={`filter-chip${severityFilter === f.value ? ' active' : ''}`}
                  onClick={() => setSeverityFilter(f.value)}
                  type="button"
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {error && <ErrorBanner message={`Showing last known data. Connection issue: ${error}`} />}

          <AlarmsTable alarms={sorted} />

          <section className="panel-status-section">
            <div className="section-heading-row">
              <div>
                <h2 className="section-heading-title">Notification Delivery</h2>
                <p className="section-heading-subtitle">SMS and WhatsApp delivery history</p>
              </div>
            </div>
            <NotificationDeliveryTable notifications={notifications ?? []} />
          </section>
        </>
      )}
    </div>
  );
}
