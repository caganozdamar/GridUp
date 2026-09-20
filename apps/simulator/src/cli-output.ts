import type { DiscoveredPanel, PanelSensorState } from './types.js';

export function printTickSummary(
  tick: number,
  panels: DiscoveredPanel[],
  states: Map<string, PanelSensorState>,
  insertedCount: number,
  readingCount: number,
): void {
  console.log(`\n[SIMULATOR] Tick #${tick}`);
  console.log(`${panels.length} panels | ${readingCount} readings sent`);

  for (const panel of panels) {
    const state = states.get(panel.id);
    if (!state) continue;

    console.log(`\n${panel.code}`);
    console.log(`Ambient: ${state.ambientTemperature.toFixed(1)} °C`);
    console.log(`Cable:   ${state.cableTemperature.toFixed(1)} °C`);
    console.log(`Humidity: ${state.humidity.toFixed(1)} %`);
    console.log(`Current: ${state.current.toFixed(1)} A`);
    console.log(`Arc Flash: ${state.arcFlash.toFixed(1)} %`);
    console.log(`Acoustic: ${state.acoustic.toFixed(1)} dB`);
  }

  console.log(`\nAPI response:\n${insertedCount} readings inserted`);
}
