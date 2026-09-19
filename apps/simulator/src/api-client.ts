import { PanelStatus } from '@grid-up/shared';
import type { ApiPanel, ApiSensor, BatchReadingInput, DiscoveredPanel } from './types.js';

export class ApiClient {
  constructor(private readonly baseUrl: string) {}

  async discoverOnlinePanels(): Promise<DiscoveredPanel[]> {
    const panels = await this.getPanels();
    const onlinePanels = panels.filter((panel) => panel.status === PanelStatus.ONLINE);

    const discovered: DiscoveredPanel[] = [];
    for (const panel of onlinePanels) {
      const sensors = await this.getSensorsForPanel(panel.id);
      const sensorsByType: DiscoveredPanel['sensorsByType'] = {};
      for (const sensor of sensors) {
        if (sensor.isActive) {
          sensorsByType[sensor.type] = sensor;
        }
      }
      discovered.push({ id: panel.id, code: panel.code, sensorsByType });
    }

    return discovered;
  }

  private async getPanels(): Promise<ApiPanel[]> {
    const res = await fetch(`${this.baseUrl}/panels`);
    if (!res.ok) {
      throw new Error(`GET /panels failed: ${res.status} ${res.statusText}`);
    }
    return (await res.json()) as ApiPanel[];
  }

  private async getSensorsForPanel(panelId: string): Promise<ApiSensor[]> {
    const res = await fetch(`${this.baseUrl}/panels/${panelId}/sensors`);
    if (!res.ok) {
      throw new Error(`GET /panels/${panelId}/sensors failed: ${res.status} ${res.statusText}`);
    }
    return (await res.json()) as ApiSensor[];
  }

  async postReadingsBatch(readings: BatchReadingInput[]): Promise<{ inserted: number }> {
    const res = await fetch(`${this.baseUrl}/readings/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ readings }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`POST /readings/batch failed: ${res.status} ${res.statusText} ${text}`);
    }

    return (await res.json()) as { inserted: number };
  }
}
