import {
  EXTENDED_REGISTERS_PER_PANEL,
  ExtendedRegisterOffset,
  getExtendedRegisterStartAddress,
  getExtendedRegisterStartLabel,
  getRegisterStartAddress,
  getRegisterStartLabel,
  MODBUS_BOOL,
  MODBUS_DATA_QUALITY,
  REGISTERS_PER_PANEL,
  RegisterOffset,
} from './register-map.js';

/**
 * Register'larin insan tarafindan okunur aciklamasi - TEK kaynak. Hem CLI
 * okuyucu (`npm run scada:read`) hem de dashboard'daki SCADA ekrani icin HTTP
 * ucu bunu kullanir; register adlari/birimleri/olcekleri baska hicbir yerde
 * tekrar yazilmaz.
 */

const RISK_LEVEL_NAMES = ['NORMAL', 'WARNING', 'HIGH', 'CRITICAL'];
const PANEL_STATUS_NAMES = ['OFFLINE', 'ONLINE', 'MAINTENANCE'];

export type RegisterGroup = 'core' | 'extended';

export interface RegisterRow {
  group: RegisterGroup;
  /** "40021" tarzi Modicon label'i. */
  label: number;
  /** Tel uzerindeki 0-based adres. */
  address: number;
  name: string;
  /** Register'in ham 16-bit degeri (Modbus'ta tasinan sayi). */
  raw: number;
  /** Mühendislik degeri ve birimi, okunur bicimde ("31.4 °C", "3 (CRITICAL)", "YES"). */
  display: string;
}

const yesNo = (value: number): string => (value === MODBUS_BOOL.YES ? 'YES' : 'NO');
const scaled = (value: number, unit: string): string => `${(value / 10).toFixed(1)} ${unit}`;

/**
 * Bir panonun 14 register'ini (10 cekirdek + 4 genisletilmis) aciklar.
 * `readRegister`, 0-based adresten ham degeri dondurur (RegisterStore ya da
 * bir Modbus istemcisinin okudugu diziler).
 */
export function describePanelRegisters(readRegister: (address: number) => number, blockIndex: number): RegisterRow[] {
  const coreStart = getRegisterStartAddress(blockIndex);
  const coreLabel = getRegisterStartLabel(blockIndex);
  const extStart = getExtendedRegisterStartAddress(blockIndex);
  const extLabel = getExtendedRegisterStartLabel(blockIndex);

  const core = (offset: number, name: string, render: (raw: number) => string): RegisterRow => {
    const raw = readRegister(coreStart + offset);
    return { group: 'core', label: coreLabel + offset, address: coreStart + offset, name, raw, display: render(raw) };
  };
  const extended = (offset: number, name: string, render: (raw: number) => string): RegisterRow => {
    const raw = readRegister(extStart + offset);
    return { group: 'extended', label: extLabel + offset, address: extStart + offset, name, raw, display: render(raw) };
  };

  return [
    core(RegisterOffset.RISK_SCORE, 'Risk Score', (raw) => String(raw)),
    core(RegisterOffset.RISK_LEVEL, 'Risk Level', (raw) => `${raw} (${RISK_LEVEL_NAMES[raw] ?? 'UNKNOWN'})`),
    core(RegisterOffset.AMBIENT_TEMPERATURE_X10, 'Ambient Temperature', (raw) => scaled(raw, '°C')),
    core(RegisterOffset.CABLE_TEMPERATURE_X10, 'Cable Temperature', (raw) => scaled(raw, '°C')),
    core(RegisterOffset.HUMIDITY_X10, 'Humidity', (raw) => scaled(raw, '%')),
    core(RegisterOffset.CURRENT_X10, 'Current', (raw) => scaled(raw, 'A')),
    core(RegisterOffset.ACTIVE_ALARM, 'Active Alarm', yesNo),
    core(RegisterOffset.PANEL_STATUS, 'Panel Status', (raw) => PANEL_STATUS_NAMES[raw] ?? 'UNKNOWN'),
    core(RegisterOffset.ACTIVE_ANOMALY_COUNT, 'Active Anomalies', (raw) => String(raw)),
    core(RegisterOffset.DATA_QUALITY, 'Data Quality', (raw) => (raw === MODBUS_DATA_QUALITY.VALID ? 'VALID' : 'INVALID')),
    extended(ExtendedRegisterOffset.ARC_FLASH_X10, 'Arc Flash', (raw) => scaled(raw, '%')),
    extended(ExtendedRegisterOffset.ACOUSTIC_X10, 'Acoustic', (raw) => scaled(raw, 'dB')),
    extended(ExtendedRegisterOffset.ARC_FLASH_ACTIVE, 'Arc Flash Active', yesNo),
    extended(ExtendedRegisterOffset.PARTIAL_DISCHARGE_ACTIVE, 'Partial Discharge', yesNo),
  ];
}

export const REGISTER_ROWS_PER_PANEL = REGISTERS_PER_PANEL + EXTENDED_REGISTERS_PER_PANEL;
