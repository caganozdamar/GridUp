import type { PanelSummary } from '@grid-up/shared';
import { PanelStatusRow } from './PanelStatusRow';

export function PanelStatusTable({ panels }: { panels: PanelSummary[] }) {
  return (
    <div className="table-wrapper">
      <table className="data-table">
        <thead>
          <tr>
            <th>Panel</th>
            <th>Site</th>
            <th>Status</th>
            <th>Risk Score</th>
            <th>Risk Level</th>
            <th>Key Sensor Values</th>
            <th>Active Alarms</th>
            <th>Last Update</th>
          </tr>
        </thead>
        <tbody>
          {panels.map((panel) => (
            <PanelStatusRow key={panel.id} panel={panel} />
          ))}
          {panels.length === 0 && (
            <tr>
              <td colSpan={8} className="empty-row">
                No panels found
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
