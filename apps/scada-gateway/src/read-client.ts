import 'dotenv/config';
import { createRequire } from 'module';
import { loadConfig } from './config.js';
import {
  getBlockIndexForPanelCode,
  getRegisterStartAddress,
  getRegisterStartLabel,
  MODBUS_BOOL,
  MODBUS_DATA_QUALITY,
  EXTENDED_REGISTERS_PER_PANEL,
  ExtendedRegisterOffset,
  getExtendedRegisterStartAddress,
  getExtendedRegisterStartLabel,
  REGISTERS_PER_PANEL,
  RegisterOffset,
} from './register-map.js';

const RISK_LEVEL_NAMES = ['NORMAL', 'WARNING', 'HIGH', 'CRITICAL'];
const PANEL_STATUS_NAMES = ['OFFLINE', 'ONLINE', 'MAINTENANCE'];

/**
 * modbus-serial'in CJS default export'u, bu ESM paketinde nodenext'in
 * default-import interop'uyla dogru construct signature'a sahip olmuyor
 * (kutuphanenin index.d.ts'i bunu ESM `export default` sozdizimiyle
 * tanimliyor ama paket kendisi CJS). `createRequire` ile dogrudan CJS
 * olarak yuklenip ihtiyac duyulan minimal arayuzle cast ediliyor.
 */
interface ModbusClient {
  connectTCP(host: string, options: { port: number }): Promise<void>;
  setID(id: number): void;
  setTimeout(durationMs: number): void;
  readHoldingRegisters(address: number, length: number): Promise<{ data: number[] }>;
  close(callback: () => void): void;
}

const require = createRequire(import.meta.url);
const ModbusRTU = require('modbus-serial') as new () => ModbusClient;

function formatBool(value: number): string {
  return value === MODBUS_BOOL.YES ? 'YES' : 'NO';
}

function pad(label: string, width = 20): string {
  return label.padEnd(width, ' ');
}

async function main(): Promise<void> {
  const config = loadConfig();
  const host = process.env.MODBUS_HOST?.trim() || '127.0.0.1';
  const panelCode = (process.argv[2] ?? 'PANO-003').trim().toUpperCase();

  const blockIndex = getBlockIndexForPanelCode(panelCode);
  const startAddress = getRegisterStartAddress(blockIndex);
  const startLabel = getRegisterStartLabel(blockIndex);

  const client = new ModbusRTU();
  await client.connectTCP(host, { port: config.modbusTcpPort });
  client.setID(1);
  client.setTimeout(3000);

  try {
    const { data } = await client.readHoldingRegisters(startAddress, REGISTERS_PER_PANEL);
    const { data: extended } = await client.readHoldingRegisters(
      getExtendedRegisterStartAddress(blockIndex),
      EXTENDED_REGISTERS_PER_PANEL,
    );
    const extendedLabel = getExtendedRegisterStartLabel(blockIndex);

    const riskScore = data[RegisterOffset.RISK_SCORE];
    const riskLevel = data[RegisterOffset.RISK_LEVEL];
    const ambient = data[RegisterOffset.AMBIENT_TEMPERATURE_X10] / 10;
    const cable = data[RegisterOffset.CABLE_TEMPERATURE_X10] / 10;
    const humidity = data[RegisterOffset.HUMIDITY_X10] / 10;
    const current = data[RegisterOffset.CURRENT_X10] / 10;
    const activeAlarm = data[RegisterOffset.ACTIVE_ALARM];
    const panelStatus = data[RegisterOffset.PANEL_STATUS];
    const anomalyCount = data[RegisterOffset.ACTIVE_ANOMALY_COUNT];
    const dataQuality = data[RegisterOffset.DATA_QUALITY];

    const separator = '-'.repeat(40);
    console.log(separator);
    console.log('SCADA / MODBUS TCP READ');
    console.log('');
    console.log(`Panel: ${panelCode}`);
    console.log('');
    console.log(`${startLabel + 0} ${pad('Risk Score')} : ${riskScore}`);
    console.log(
      `${startLabel + 1} ${pad('Risk Level')} : ${riskLevel} (${RISK_LEVEL_NAMES[riskLevel] ?? 'UNKNOWN'})`,
    );
    console.log(`${startLabel + 2} ${pad('Ambient Temperature')} : ${ambient.toFixed(1)} °C`);
    console.log(`${startLabel + 3} ${pad('Cable Temperature')} : ${cable.toFixed(1)} °C`);
    console.log(`${startLabel + 4} ${pad('Humidity')} : ${humidity.toFixed(1)} %`);
    console.log(`${startLabel + 5} ${pad('Current')} : ${current.toFixed(1)} A`);
    console.log(`${startLabel + 6} ${pad('Active Alarm')} : ${formatBool(activeAlarm)}`);
    console.log(`${startLabel + 7} ${pad('Panel Status')} : ${PANEL_STATUS_NAMES[panelStatus] ?? 'UNKNOWN'}`);
    console.log(`${startLabel + 8} ${pad('Active Anomalies')} : ${anomalyCount}`);
    console.log(
      `${startLabel + 9} ${pad('Data Quality')} : ${dataQuality === MODBUS_DATA_QUALITY.VALID ? 'VALID' : 'INVALID'}`,
    );
    console.log('');
    console.log(
      `${extendedLabel + 0} ${pad('Arc Flash')} : ${(extended[ExtendedRegisterOffset.ARC_FLASH_X10] / 10).toFixed(1)} %`,
    );
    console.log(
      `${extendedLabel + 1} ${pad('Acoustic')} : ${(extended[ExtendedRegisterOffset.ACOUSTIC_X10] / 10).toFixed(1)} dB`,
    );
    console.log(
      `${extendedLabel + 2} ${pad('Arc Flash Active')} : ${formatBool(extended[ExtendedRegisterOffset.ARC_FLASH_ACTIVE])}`,
    );
    console.log(
      `${extendedLabel + 3} ${pad('Partial Discharge')} : ${formatBool(extended[ExtendedRegisterOffset.PARTIAL_DISCHARGE_ACTIVE])}`,
    );
    console.log(separator);
  } finally {
    client.close(() => undefined);
  }
}

main().catch((error) => {
  console.error('[SCADA READ CLIENT] Error:', (error as Error).message);
  process.exitCode = 1;
});
