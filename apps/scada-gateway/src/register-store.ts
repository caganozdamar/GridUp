import { encodePanelRegisters } from './encode.js';
import { getBlockIndexForPanelCode, getRegisterStartAddress, REGISTERS_PER_PANEL, TOTAL_HOLDING_REGISTERS } from './register-map.js';
import type { ScadaPanelSnapshot } from './types.js';

/**
 * SCADA Gateway'in bellek-ici Modbus holding register tablosu.
 *
 * - GRID UP API'den gelen en son basarili snapshot'lari saklar (API
 *   gecici olarak ulasilamaz olsa bile eski degerler korunur).
 * - `recompute` her tick'te (fetch basarili olsun ya da olmasin) cagrilir;
 *   boylece Data Quality register'i, duvar saatine gore stale hale
 *   gelen panolar icin otomatik olarak INVALID'e doner (Asama 7 madde 7/8).
 */
export class RegisterStore {
  private readonly registers = new Uint16Array(TOTAL_HOLDING_REGISTERS);
  private readonly snapshotsByPanelCode = new Map<string, ScadaPanelSnapshot>();
  private readonly unsupportedPanelCodes = new Set<string>();

  /**
   * Yeni snapshot'lari cache'e yazar. Mapping disi kalan pano kodlarini
   * (orn. MAX_SUPPORTED_PANELS'i asan ya da "PANO-xxx" formatinda olmayan)
   * sessizce atmaz; bir kere biriktirir ve ilk gorulduklerinde caller'in
   * loglayabilmesi icin dondurur.
   */
  updateSnapshots(snapshots: ScadaPanelSnapshot[]): string[] {
    const newlyUnsupported: string[] = [];
    for (const snapshot of snapshots) {
      try {
        getBlockIndexForPanelCode(snapshot.panelCode);
        this.snapshotsByPanelCode.set(snapshot.panelCode, snapshot);
      } catch {
        if (!this.unsupportedPanelCodes.has(snapshot.panelCode)) {
          newlyUnsupported.push(snapshot.panelCode);
        }
        this.unsupportedPanelCodes.add(snapshot.panelCode);
      }
    }
    return newlyUnsupported;
  }

  /** Cache'teki tum panolarin register'larini `now` zamanina gore yeniden hesaplar. */
  recompute(now: number, staleMs: number): void {
    for (const [panelCode, snapshot] of this.snapshotsByPanelCode) {
      const blockIndex = getBlockIndexForPanelCode(panelCode);
      const start = getRegisterStartAddress(blockIndex);
      const values = encodePanelRegisters(snapshot, now, staleMs);
      this.registers.set(values, start);
    }
  }

  /** Modbus FC03 (Read Holding Registers) icin: 0-based adresten tek bir register degeri okur. */
  readRegister(address: number): number {
    if (!Number.isInteger(address) || address < 0 || address >= this.registers.length) {
      return 0;
    }
    return this.registers[address];
  }

  reset(): void {
    this.registers.fill(0);
  }

  get knownPanelCodes(): string[] {
    return [...this.snapshotsByPanelCode.keys()];
  }

  get knownPanelCount(): number {
    return this.snapshotsByPanelCode.size;
  }

  get unsupportedPanelCount(): number {
    return this.unsupportedPanelCodes.size;
  }

  get totalRegisterCount(): number {
    return this.registers.length;
  }

  get usedRegisterCount(): number {
    return this.snapshotsByPanelCode.size * REGISTERS_PER_PANEL;
  }
}
