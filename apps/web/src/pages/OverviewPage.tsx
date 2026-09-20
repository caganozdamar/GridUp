import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { RiskLevel } from '@grid-up/shared';
import { Header } from '../components/layout/Header';
import { LoadingState } from '../components/common/LoadingState';
import { ErrorBanner } from '../components/common/ErrorBanner';
import { PanelStatusTable } from '../components/panels/PanelStatusTable';
import { RiskDistributionCard } from '../components/dashboard/RiskDistributionCard';
import { RecentAlarmsCard } from '../components/dashboard/RecentAlarmsCard';
import { EarlyWarningActivityCard } from '../components/dashboard/EarlyWarningActivityCard';
import {
  IconAlertOctagon,
  IconAlertTriangle,
  IconBell,
  IconCheckCircle,
  IconGrid,
  IconTrendingUp,
} from '../components/common/icons';
import { usePolling } from '../hooks/usePolling';
import { useSystemStatus } from '../context/SystemStatusContext';
import { panelsApi } from '../api/panels';
import { alarmsApi } from '../api/alarms';
import { metricsApi } from '../api/metrics';
import { POLLING_INTERVALS } from '../config';

const RISK_FILTERS: Array<{ label: string; value: RiskLevel | 'ALL' }> = [
  { label: 'All risk levels', value: 'ALL' },
  { label: 'Normal', value: RiskLevel.NORMAL },
  { label: 'Warning', value: RiskLevel.WARNING },
  { label: 'High', value: RiskLevel.HIGH },
  { label: 'Critical', value: RiskLevel.CRITICAL },
];

export function OverviewPage() {
  const { data: panels, error, isLoading, isOnline, lastUpdated } = usePolling(
    () => panelsApi.list(),
    POLLING_INTERVALS.overview,
  );
  const { data: alarms } = usePolling(() => alarmsApi.list(), POLLING_INTERVALS.overview);
  const { data: operationalMetrics } = usePolling(() => metricsApi.operations(), POLLING_INTERVALS.overview);

  const { report } = useSystemStatus();
  useEffect(() => {
    report({ isOnline, lastUpdated });
  }, [isOnline, lastUpdated, report]);

  const [search, setSearch] = useState('');
  const [riskFilter, setRiskFilter] = useState<RiskLevel | 'ALL'>('ALL');

  const filteredPanels = useMemo(() => {
    const list = panels ?? [];
    const query = search.trim().toLowerCase();
    return list.filter((panel) => {
      const level = panel.latestRiskScore?.level ?? RiskLevel.NORMAL;
      const matchesFilter = riskFilter === 'ALL' || level === riskFilter;
      const matchesSearch =
        query.length === 0 || panel.name.toLowerCase().includes(query) || panel.code.toLowerCase().includes(query);
      return matchesFilter && matchesSearch;
    });
  }, [panels, search, riskFilter]);

  const summary = useMemo(() => {
    const list = panels ?? [];
    return {
      total: list.length,
      normal: list.filter((p) => (p.latestRiskScore?.level ?? RiskLevel.NORMAL) === RiskLevel.NORMAL).length,
      warning: list.filter((p) => p.latestRiskScore?.level === RiskLevel.WARNING).length,
      high: list.filter((p) => p.latestRiskScore?.level === RiskLevel.HIGH).length,
      critical: list.filter((p) => p.latestRiskScore?.level === RiskLevel.CRITICAL).length,
      activeAlarms: list.reduce((sum, p) => sum + p.activeAlarmCount, 0),
    };
  }, [panels]);

  return (
    <div className="page">
      <Header
        title="Overview"
        subtitle="Real-time monitoring of electrical panels across all sites"
        autoRefreshMs={POLLING_INTERVALS.overview}
      />

      {error && !panels && <ErrorBanner message={`Unable to reach API: ${error}`} />}
      {isLoading && !panels && <LoadingState label="Loading panels…" />}

      {panels && (
        <>
          <section className="summary-cards">
            <SummaryCard label="Total Panels" value={summary.total} icon={<IconGrid width={18} height={18} />} />
            <SummaryCard
              label="Normal"
              value={summary.normal}
              tone="normal"
              icon={<IconCheckCircle width={18} height={18} />}
            />
            <SummaryCard
              label="Warning"
              value={summary.warning}
              tone="warning"
              icon={<IconAlertTriangle width={18} height={18} />}
            />
            <SummaryCard
              label="High"
              value={summary.high}
              tone="high"
              icon={<IconTrendingUp width={18} height={18} />}
            />
            <SummaryCard
              label="Critical"
              value={summary.critical}
              tone="critical"
              icon={<IconAlertOctagon width={18} height={18} />}
            />
            <SummaryCard
              label="Active Alarms"
              value={summary.activeAlarms}
              tone={summary.activeAlarms > 0 ? 'critical' : undefined}
              icon={<IconBell width={18} height={18} />}
            />
          </section>

          {error && <ErrorBanner message={`Showing last known data. Connection issue: ${error}`} />}

          <section className="panel-status-section">
            <div className="section-heading-row">
              <div>
                <h2 className="section-heading-title">Panel Status</h2>
                <p className="section-heading-subtitle">Current status of all electrical panels</p>
              </div>
              <div className="section-toolbar">
                <input
                  className="search-input"
                  placeholder="Search panels…"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  aria-label="Search panels"
                />
                <select
                  className="select-input"
                  value={riskFilter}
                  onChange={(event) => setRiskFilter(event.target.value as RiskLevel | 'ALL')}
                  aria-label="Filter by risk level"
                >
                  {RISK_FILTERS.map((f) => (
                    <option key={f.value} value={f.value}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <PanelStatusTable panels={filteredPanels} />
          </section>

          <section className="overview-columns">
            <RiskDistributionCard
              counts={{
                normal: summary.normal,
                warning: summary.warning,
                high: summary.high,
                critical: summary.critical,
              }}
            />
            <RecentAlarmsCard alarms={alarms ?? []} />
          </section>

          <EarlyWarningActivityCard metrics={operationalMetrics ?? null} />
        </>
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  tone,
  icon,
}: {
  label: string;
  value: number;
  tone?: 'normal' | 'warning' | 'high' | 'critical';
  icon: ReactNode;
}) {
  return (
    <div className="summary-card">
      <span className={`summary-card-icon${tone ? ` tone-${tone}` : ''}`}>{icon}</span>
      <div className="summary-card-body">
        <div className="summary-card-value">{value}</div>
        <div className="summary-card-label">{label}</div>
      </div>
    </div>
  );
}
