import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { RiskLevel } from '@grid-up/shared';
import { Header } from '../components/layout/Header';
import { LoadingState } from '../components/common/LoadingState';
import { ErrorBanner } from '../components/common/ErrorBanner';
import { RiskBadge } from '../components/status/RiskBadge';
import { usePolling } from '../hooks/usePolling';
import { useSystemStatus } from '../context/SystemStatusContext';
import { panelsApi } from '../api/panels';
import { POLLING_INTERVALS } from '../config';

const FILTERS: Array<{ label: string; value: RiskLevel | 'ALL' }> = [
  { label: 'ALL', value: 'ALL' },
  { label: 'NORMAL', value: RiskLevel.NORMAL },
  { label: 'WARNING', value: RiskLevel.WARNING },
  { label: 'HIGH', value: RiskLevel.HIGH },
  { label: 'CRITICAL', value: RiskLevel.CRITICAL },
];

export function PanelsPage() {
  const { data: panels, error, isLoading, isOnline, lastUpdated } = usePolling(
    () => panelsApi.list(),
    POLLING_INTERVALS.panelsList,
  );

  const { report } = useSystemStatus();
  useEffect(() => {
    report({ isOnline, lastUpdated });
  }, [isOnline, lastUpdated, report]);

  const [filter, setFilter] = useState<RiskLevel | 'ALL'>('ALL');
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const list = panels ?? [];
    const query = search.trim().toLowerCase();
    return list.filter((panel) => {
      const level = panel.latestRiskScore?.level ?? RiskLevel.NORMAL;
      const matchesFilter = filter === 'ALL' || level === filter;
      const matchesSearch =
        query.length === 0 || panel.name.toLowerCase().includes(query) || panel.code.toLowerCase().includes(query);
      return matchesFilter && matchesSearch;
    });
  }, [panels, filter, search]);

  return (
    <div className="page">
      <Header
        title="Panels"
        subtitle="Monitor and inspect all electrical panels"
        autoRefreshMs={POLLING_INTERVALS.panelsList}
      />

      {error && !panels && <ErrorBanner message={`Unable to reach API: ${error}`} />}
      {isLoading && !panels && <LoadingState label="Loading panels…" />}

      {panels && (
        <>
          <div className="panels-toolbar">
            <div className="filter-chips">
              {FILTERS.map((f) => (
                <button
                  key={f.value}
                  className={`filter-chip${filter === f.value ? ' active' : ''}`}
                  onClick={() => setFilter(f.value)}
                  type="button"
                >
                  {f.label}
                </button>
              ))}
            </div>
            <input
              className="search-input"
              placeholder="Search panels by name or code…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>

          {error && <ErrorBanner message={`Showing last known data. Connection issue: ${error}`} />}

          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Panel</th>
                  <th>Site</th>
                  <th>Status</th>
                  <th>Risk Score</th>
                  <th>Risk Level</th>
                  <th>Sensors</th>
                  <th>Active Alarms</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((panel) => {
                  const level = panel.latestRiskScore?.level ?? RiskLevel.NORMAL;
                  return (
                    <tr key={panel.id}>
                      <td>
                        <Link className="table-link" to={`/panels/${panel.id}`}>
                          {panel.code}
                        </Link>
                        {panel.name !== panel.code && <div className="table-subtext">{panel.name}</div>}
                      </td>
                      <td>{panel.site.name}</td>
                      <td>
                        <span className={`status-pill ${panel.status === 'ONLINE' ? 'online' : 'offline'}`}>
                          {panel.status}
                        </span>
                      </td>
                      <td>{panel.latestRiskScore?.score ?? '—'}</td>
                      <td>
                        <RiskBadge level={level} />
                      </td>
                      <td>{panel.sensorCount}</td>
                      <td>{panel.activeAlarmCount}</td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} className="empty-row">
                      No panels match your filters
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
