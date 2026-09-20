import 'dotenv/config';
import { createRequire } from 'module';
import { loadConfig } from './config.js';
import {
  EXTENDED_REGISTERS_PER_PANEL,
  getBlockIndexForPanelCode,
  getExtendedRegisterStartAddress,
  getRegisterStartAddress,
  REGISTERS_PER_PANEL,
} from './register-map.js';
import { describePanelRegisters } from './register-view.js';

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

function pad(label: string, width = 20): string {
  return label.padEnd(width, ' ');
}

async function main(): Promise<void> {
  const config = loadConfig();
  const host = process.env.MODBUS_HOST?.trim() || '127.0.0.1';
  const panelCode = (process.argv[2] ?? 'PANO-003').trim().toUpperCase();

  const blockIndex = getBlockIndexForPanelCode(panelCode);
  const startAddress = getRegisterStartAddress(blockIndex);

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

    const rows = describePanelRegisters((address) => {
      const coreStart = getRegisterStartAddress(blockIndex);
      const extStart = getExtendedRegisterStartAddress(blockIndex);
      if (address >= extStart) return extended[address - extStart] ?? 0;
      return data[address - coreStart] ?? 0;
    }, blockIndex);

    const separator = '-'.repeat(40);
    console.log(separator);
    console.log('SCADA / MODBUS TCP READ');
    console.log('');
    console.log(`Panel: ${panelCode}`);
    console.log('');
    rows.forEach((row, index) => {
      // Cekirdek ve genisletilmis bloklar bos bir satirla ayrilir.
      if (index > 0 && row.group !== rows[index - 1].group) console.log('');
      console.log(`${row.label} ${pad(row.name)} : ${row.display}`);
    });
    console.log(separator);
  } finally {
    client.close(() => undefined);
  }
}

main().catch((error) => {
  console.error('[SCADA READ CLIENT] Error:', (error as Error).message);
  process.exitCode = 1;
});
