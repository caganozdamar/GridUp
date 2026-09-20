import { useState } from 'react';
import { Header } from '../components/layout/Header';
import { LoadingState } from '../components/common/LoadingState';
import { ErrorBanner } from '../components/common/ErrorBanner';
import { usePolling } from '../hooks/usePolling';
import { scadaApi, type ScadaPanelRegisters, type ScadaRegisterRow } from '../api/scada';
import { SCADA_GATEWAY_URL, POLLING_INTERVALS } from '../config';
import { formatRelativeTime } from '../utils/status';

const LEVEL_CLASS: Record<string, string> = {
  NORMAL: 'status-normal',
  WARNING: 'status-warning',
  HIGH: 'status-high',
  CRITICAL: 'status-critical',
};

function register(panel: ScadaPanelRegisters, name: string): ScadaRegisterRow | undefined {
  return panel.registers.find((row) => row.name === name);
}

// "3 (CRITICAL)" -> "CRITICAL"
function levelName(display: string | undefined): string {
  return display?.match(/\(([A-Z]+)\)/)?.[1] ?? '—';
}

/**
 * SCADA / Modbus gorunumu: bir SCADA istemcisinin gateway'den FC03 ile
 * okuyacagi register tablosunun ta kendisi (salt-okunur). Degerler GRID UP
 * API'sinden degil, Modbus sunucusunun sundugu register tablosundan gelir.
 */
export function ScadaPage() {
  const { data, error, isLoading } = usePolling(() => scadaApi.registers(), POLLING_INTERVALS.scada);
  const [selectedCode, setSelectedCode] = useState<string | null>(null);

  const panels = data?.panels ?? [];
  // Secim yoksa (ya da secili pano artik listede degilse) ilk pano gosterilir.
  const selected = panels.find((panel) => panel.panelCode === selectedCode) ?? panels[0];

  return (
    <div className="page">
      <Header
        title="SCADA / Modbus"
        subtitle="Holding registers as a SCADA master reads them (read-only)"
        autoRefreshMs={POLLING_INTERVALS.scada}
      />

      {error && !data && (
        <ErrorBanner message={`${error}. Start the gateway with "npm run dev:scada" (Modbus TCP :1502, register view :1580).`} />
      )}
      {isLoading && !data && <LoadingState label="Reading registers…" />}

      {data && (
        <>
          {error && <ErrorBanner message={`Showing last known registers. Connection issue: ${error}`} />}

          <div className="scada-strip">
            <div className="scada-strip-item">
              <span className="scada-strip-label">Gateway</span>
              <span className="risk-badge status-normal">REACHABLE</span>
            </div>
            <div className="scada-strip-item">
              <span className="scada-strip-label">Modbus TCP</span>
              <span className="mono">:{data.modbus.port}</span>
              <span className="table-subtext">{data.modbus.functions.join(' / ')} · read-only</span>
            </div>
            <div className="scada-strip-item">
              <span className="scada-strip-label">GRID UP API link</span>
              <span className={`risk-badge ${data.api.reachable ? 'status-normal' : 'status-critical'}`}>
                {data.api.reachable ? 'OK' : 'UNREACHABLE'}
              </span>
              {data.api.lastSuccessAt && (
                <span className="table-subtext">last data {formatRelativeTime(data.api.lastSuccessAt)}</span>
              )}
            </div>
            <div className="scada-strip-item">
              <span className="scada-strip-label">Stale threshold</span>
              <span className="mono">{Math.round(data.staleMs / 1000)} s</span>
              <span className="table-subtext">older data → Data Quality INVALID</span>
            </div>
          </div>

          <section className="panel-status-section">
            <div className="section-heading-row">
              <div>
                <h2 className="section-heading-title">Panels</h2>
                <p className="section-heading-subtitle">Select a panel to see its register block</p>
              </div>
            </div>
            {panels.length === 0 ? (
              <p className="empty-hint">The gateway has no panel snapshot yet.</p>
            ) : (
              <div className="table-wrapper">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Panel</th>
                      <th>Risk score</th>
                      <th>Risk level</th>
                      <th>Active alarm</th>
                      <th>Data quality</th>
                    </tr>
                  </thead>
                  <tbody>
                    {panels.map((panel) => {
                      const level = levelName(register(panel, 'Risk Level')?.display);
                      const quality = register(panel, 'Data Quality')?.display;
                      const alarm = register(panel, 'Active Alarm')?.display;
                      return (
                        <tr
                          key={panel.panelCode}
                          className={`scada-row${panel.panelCode === selected?.panelCode ? ' selected' : ''}`}
                          onClick={() => setSelectedCode(panel.panelCode)}
                        >
                          <td>
                            <span className="table-strong">{panel.panelCode}</span>
                            <div className="table-subtext mono">
                              {panel.registers[0].label}–{panel.registers[9].label}
                            </div>
                          </td>
                          <td>{register(panel, 'Risk Score')?.display}</td>
                          <td>
                            <span className={`risk-badge ${LEVEL_CLASS[level] ?? ''}`}>{level}</span>
                          </td>
                          <td>{alarm}</td>
                          <td>
                            <span className={`risk-badge ${quality === 'VALID' ? 'status-normal' : 'status-warning'}`}>
                              {quality}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {selected && (
            <section className="panel-status-section">
              <div className="section-heading-row">
                <div>
                  <h2 className="section-heading-title">{selected.panelCode} — holding registers</h2>
                  <p className="section-heading-subtitle">
                    What a SCADA client gets from FC03 on port {data.modbus.port}. Temperatures, humidity, current, arc
                    flash and acoustic are stored ×10 (one decimal).
                  </p>
                </div>
              </div>
              <div className="table-wrapper">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Register</th>
                      <th>Address</th>
                      <th>Description</th>
                      <th>Raw</th>
                      <th>Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selected.registers.map((row, index) => (
                      <tr
                        key={row.label}
                        className={index > 0 && row.group !== selected.registers[index - 1].group ? 'scada-group-start' : undefined}
                      >
                        <td className="mono">{row.label}</td>
                        <td className="mono">{row.address}</td>
                        <td>{row.name}</td>
                        <td className="mono">{row.raw}</td>
                        <td className="table-strong">{row.display}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="table-subtext scada-footnote">
                Source: {SCADA_GATEWAY_URL}/registers · the same register table the Modbus TCP server serves. Full map:
                docs/modbus-register-map.md
              </p>
            </section>
          )}
        </>
      )}
    </div>
  );
}
