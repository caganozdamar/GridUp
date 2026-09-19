/** Terminalde tek satirlik, insan tarafindan okunabilir periyodik ozet (Asama 7 madde 8). */
export function logSnapshotUpdated(panelCount: number, registerCount: number): void {
  const time = new Date().toLocaleTimeString('en-GB');
  console.log('[SCADA] Snapshot updated');
  console.log(`${panelCount} panels | ${registerCount} registers | ${time}`);
}

export function logApiUnreachable(message: string): void {
  console.warn(`[SCADA] API unreachable, keeping last known register values: ${message}`);
}

export function logApiRecovered(): void {
  console.log('[SCADA] API connection recovered');
}

export function logUnsupportedPanel(panelCode: string): void {
  console.warn(`[SCADA] Panel "${panelCode}" does not fit the Modbus mapping (see register-map.ts) and was skipped`);
}
