import { useEffect, useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { SensorType, type RiskComponents, type RiskLevel } from '@grid-up/shared';
import { Header } from '../components/layout/Header';
import { LoadingState } from '../components/common/LoadingState';
import { ErrorBanner } from '../components/common/ErrorBanner';
import { IconArrowLeft } from '../components/common/icons';
import { RiskGauge } from '../components/risk/RiskGauge';
import { RiskComponentsPanel } from '../components/risk/RiskComponentsPanel';
import { ReasonsList } from '../components/risk/ReasonsList';
import { SensorCard } from '../components/sensors/SensorCard';
import { CableCurrentChart } from '../components/charts/CableCurrentChart';
import { HumidityChart } from '../components/charts/HumidityChart';
import { AnomaliesList } from '../components/anomalies/AnomaliesList';
import { usePolling } from '../hooks/usePolling';
import { useSystemStatus } from '../context/SystemStatusContext';
import { panelsApi } from '../api/panels';
import { POLLING_INTERVALS, CHART_POINTS } from '../config';
import { formatTime } from '../utils/status';

const READINGS_LIMIT = 200;

export function PanelDetailPage() {
  const { id } = useParams<{ id: string }>();
  const panelId = id ?? '';

  const panelPoll = usePolling(() => panelsApi.get(panelId), POLLING_INTERVALS.panelDetail, [panelId]);
  const riskPoll = usePolling(() => panelsApi.risk(panelId, 30), POLLING_INTERVALS.panelDetail, [panelId]);
  const anomaliesPoll = usePolling(() => panelsApi.anomalies(panelId), POLLING_INTERVALS.panelDetail, [panelId]);
  const readingsPoll = usePolling(
    () => panelsApi.readings(panelId, { limit: READINGS_LIMIT }),
    POLLING_INTERVALS.panelDetail,
    [panelId],
  );

  const isOnline = panelPoll.isOnline && riskPoll.isOnline && anomaliesPoll.isOnline && readingsPoll.isOnline;
  const lastUpdated = useMemo(() => {
    const candidates = [panelPoll.lastUpdated, riskPoll.lastUpdated, anomaliesPoll.lastUpdated, readingsPoll.lastUpdated].filter(
      (d): d is Date => d !== null,
    );
    if (candidates.length === 0) return null;
    return new Date(Math.max(...candidates.map((d) => d.getTime())));
  }, [panelPoll.lastUpdated, riskPoll.lastUpdated, anomaliesPoll.lastUpdated, readingsPoll.lastUpdated]);

  const { report } = useSystemStatus();
  useEffect(() => {
    report({ isOnline, lastUpdated });
  }, [isOnline, lastUpdated, report]);

  const panel = panelPoll.data;
  const risk = riskPoll.data?.latest ?? null;
  const anomalies = anomaliesPoll.data ?? [];
  const readings = useMemo(() => readingsPoll.data ?? [], [readingsPoll.data]);

  const sensorIdByType = useMemo(() => {
    const map = new Map<SensorType, string>();
    for (const sensor of panel?.sensors ?? []) {
      map.set(sensor.type, sensor.id);
    }
    return map;
  }, [panel]);

  const latestBySensorId = useMemo(() => {
    const map = new Map<string, number>();
    for (const reading of readings) {
      if (!map.has(reading.sensorId)) map.set(reading.sensorId, reading.value);
    }
    return map;
  }, [readings]);

  const seriesFor = (type: SensorType) => {
    const sensorId = sensorIdByType.get(type);
    if (!sensorId) return [];
    return readings
      .filter((r) => r.sensorId === sensorId)
      .slice()
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
      .slice(-CHART_POINTS);
  };

  const cableSeries = seriesFor(SensorType.CABLE_TEMPERATURE);
  const currentSeries = seriesFor(SensorType.CURRENT);
  const humiditySeries = seriesFor(SensorType.HUMIDITY);

  const combinedLen = Math.min(cableSeries.length, currentSeries.length);
  const cableCurrentData = cableSeries.slice(-combinedLen).map((reading, index) => ({
    time: formatTime(reading.timestamp),
    cableTemp: reading.value,
    current: currentSeries.slice(-combinedLen)[index]?.value ?? null,
  }));
  const humidityData = humiditySeries.map((reading) => ({ time: formatTime(reading.timestamp), humidity: reading.value }));

  if (panelPoll.isLoading && !panel) {
    return (
      <div className="page">
        <Header title="Panel Detail" />
        <LoadingState label="Loading panel data…" />
      </div>
    );
  }

  if (!panel) {
    return (
      <div className="page">
        <Header title="Panel Detail" />
        <ErrorBanner message={panelPoll.error ?? 'Panel not found'} />
      </div>
    );
  }

  const score = risk?.score ?? panel.latestRiskScore?.score ?? 0;
  const level = (risk?.level ?? panel.latestRiskScore?.level ?? 'NORMAL') as RiskLevel;
  const components: RiskComponents | null = risk && 'components' in risk ? risk.components : null;
  const reasons: string[] = risk && 'reasons' in risk ? risk.reasons : [];
  const hasConnectionIssue = panelPoll.error || riskPoll.error || anomaliesPoll.error || readingsPoll.error;

  const statusLabel = panel.status.charAt(0) + panel.status.slice(1).toLowerCase();

  return (
    <div className="page">
      <Link to="/panels" className="back-link">
        <IconArrowLeft width={14} height={14} />
        Back to Panels
      </Link>

      <Header
        title={panel.code}
        subtitle={`${panel.site.name} • ${statusLabel}`}
        autoRefreshMs={POLLING_INTERVALS.panelDetail}
      />

      {hasConnectionIssue && <ErrorBanner message="Showing last known data. Connection issue detected." />}

      <section className="risk-overview card">
        <div className="risk-overview-gauge">
          <h3 className="section-title">Risk Score</h3>
          <RiskGauge score={score} level={level} />
        </div>
        <div className="risk-overview-details">
          <h3 className="section-title">Risk Analysis</h3>
          {components ? <RiskComponentsPanel components={components} /> : <p className="empty-hint">Risk data pending…</p>}
        </div>
      </section>

      <section className="card">
        <h3 className="section-title">Why is risk increasing?</h3>
        {reasons.length > 0 ? <ReasonsList reasons={reasons} /> : <p className="empty-hint">No active risk factors.</p>}
      </section>

      <section className="sensor-cards-grid">
        {panel.sensors.map((sensor) => (
          <SensorCard key={sensor.id} sensor={sensor} value={latestBySensorId.get(sensor.id) ?? null} />
        ))}
      </section>

      <section className="charts-grid">
        <CableCurrentChart data={cableCurrentData} />
        <HumidityChart data={humidityData} />
      </section>

      <section className="card">
        <h3 className="section-title">Anomalies</h3>
        <AnomaliesList anomalies={anomalies} />
      </section>
    </div>
  );
}
