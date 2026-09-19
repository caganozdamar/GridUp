import type { ScadaPanelSnapshot } from './types.js';

export class ScadaApiClient {
  constructor(private readonly baseUrl: string) {}

  async fetchPanelSnapshots(): Promise<ScadaPanelSnapshot[]> {
    const res = await fetch(`${this.baseUrl}/scada/panels`);
    if (!res.ok) {
      throw new Error(`GET /scada/panels failed: ${res.status} ${res.statusText}`);
    }
    return (await res.json()) as ScadaPanelSnapshot[];
  }
}
