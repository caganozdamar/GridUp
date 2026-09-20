// SCADA Gateway register haritasini MPR-53CS sutun duzeninde CSV olarak uretir.
// Adresler apps/scada-gateway/src/register-map.ts'ten (derlenmis dist) gelir; aciklama
// metinleri burada tutulur. Kullanim: npm run build:scada-gateway && node scripts/export-modbus-map.mjs [cikti.csv]
import { writeFileSync } from 'node:fs';
import {
  MAX_SUPPORTED_PANELS,
  REGISTERS_PER_PANEL,
  EXTENDED_REGISTERS_PER_PANEL,
  EXTENDED_BASE_ADDRESS,
  HOLDING_REGISTER_LABEL_BASE,
  RegisterOffset,
  ExtendedRegisterOffset,
} from '../apps/scada-gateway/dist/register-map.js';

// [offset, ad, aralik, birim, carpan, aciklama]
const CORE = [
  [RegisterOffset.RISK_SCORE, 'RISK SCORE', '0-100', '-', '1', 'Risk skoru'],
  [RegisterOffset.RISK_LEVEL, 'RISK LEVEL', '0-3', 'enum', '1', '0=NORMAL 1=WARNING 2=HIGH 3=CRITICAL'],
  [RegisterOffset.AMBIENT_TEMPERATURE_X10, 'AMBIENT TEMPERATURE', '0-65535', '°C', '0.1', 'Pano ici ortam sicakligi'],
  [RegisterOffset.CABLE_TEMPERATURE_X10, 'CABLE TEMPERATURE', '0-65535', '°C', '0.1', 'Kablo/baglanti sicakligi'],
  [RegisterOffset.HUMIDITY_X10, 'HUMIDITY', '0-65535', '%', '0.1', 'Bagil nem'],
  [RegisterOffset.CURRENT_X10, 'CURRENT', '0-65535', 'Amper', '0.1', 'Akim'],
  [RegisterOffset.ACTIVE_ALARM, 'ACTIVE ALARM', '0-1', 'bool', '1', '0=NO 1=YES'],
  [RegisterOffset.PANEL_STATUS, 'PANEL STATUS', '0-2', 'enum', '1', '0=OFFLINE 1=ONLINE 2=MAINTENANCE'],
  [RegisterOffset.ACTIVE_ANOMALY_COUNT, 'ACTIVE ANOMALY COUNT', '0-65535', '-', '1', 'Aktif anomali sayisi'],
  [RegisterOffset.DATA_QUALITY, 'DATA QUALITY', '0-1', 'bool', '1', '0=INVALID/STALE 1=VALID'],
];
const EXT = [
  [ExtendedRegisterOffset.ARC_FLASH_X10, 'ARC FLASH', '0-65535', '%', '0.1', 'Optik yogunluk; sensor yoksa 0'],
  [ExtendedRegisterOffset.ACOUSTIC_X10, 'ACOUSTIC', '0-65535', 'dB', '0.1', 'Akustik seviye; sensor yoksa 0'],
  [ExtendedRegisterOffset.ARC_FLASH_ACTIVE, 'ARC FLASH ACTIVE', '0-1', 'bool', '1', 'Aktif ARC_FLASH anomalisi'],
  [ExtendedRegisterOffset.PARTIAL_DISCHARGE_ACTIVE, 'PARTIAL DISCHARGE ACTIVE', '0-1', 'bool', '1', 'Aktif PARTIAL_DISCHARGE anomalisi'],
];

const hex = (n) => n.toString(16).toUpperCase().padStart(4, '0');
const rows = [['PANEL', 'ADDRESS', 'ADDRESS (HEX)', 'REGISTER LABEL', 'REGISTER', 'R/W', 'RANGE', 'UNIT', 'MULTIPLIER', 'FORMAT', 'DESCRIPTION']];
for (let i = 0; i < MAX_SUPPORTED_PANELS; i++) {
  const code = `PANO-${String(i + 1).padStart(3, '0')}`;
  for (const [off, name, range, unit, mult, desc] of CORE) {
    const a = i * REGISTERS_PER_PANEL + off;
    rows.push([code, a, hex(a), HOLDING_REGISTER_LABEL_BASE + a, name, 'R', range, unit, mult, 'unsigned int (16 bit)', desc]);
  }
  for (const [off, name, range, unit, mult, desc] of EXT) {
    const a = EXTENDED_BASE_ADDRESS + i * EXTENDED_REGISTERS_PER_PANEL + off;
    rows.push([code, a, hex(a), HOLDING_REGISTER_LABEL_BASE + a, name, 'R', range, unit, mult, 'unsigned int (16 bit)', desc]);
  }
}
const out = process.argv[2] ?? 'docs/assets/modbus-register-map.csv';
writeFileSync(out, rows.map((r) => r.join(';')).join('\n') + '\n');
console.log(`${rows.length - 1} register satiri -> ${out}`);
