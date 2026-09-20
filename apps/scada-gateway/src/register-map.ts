/**
 * SCADA / Modbus TCP register mapping - TEK merkezi kaynak.
 *
 * Register numarasi/offset'i baska hicbir dosyada hard-code edilmez; her
 * yer bu dosyadaki export'lari kullanir (bkz. docs/modbus-register-map.md).
 *
 * Addressing notu: Modbus holding register'lar geleneksel olarak "40001"
 * gibi 1-based/label adreslerle anilir, ama tel uzerindeki PDU (ve
 * modbus-serial kutuphanesinin vector callback'leri) 0-based adres kullanir.
 * Bu dosyadaki `getRegisterStartAddress` hep 0-based deger dondurur;
 * "40001" gibi label'lar sadece dokumantasyon/CLI ciktisi icindir
 * (label = 40001 + zeroBasedAddress).
 */

export const REGISTERS_PER_PANEL = 10;

/** Modicon-tarzi holding register label'larinin baslangici (dokumantasyon amacli). */
export const HOLDING_REGISTER_LABEL_BASE = 40001;

/** Prototip demo icin desteklenen maksimum pano sayisi (100 x 10 = 1000 register). */
export const MAX_SUPPORTED_PANELS = 100;

/**
 * Genisletilmis blok (ark flash + akustik). Mevcut 10-register'lik cekirdek
 * blogun adresleri DEGISMEZ (geriye uyumluluk: SCADA tarafinda mevcut
 * eslemeler bozulmasin); yeni register'lar cekirdek alanin HEMEN ARDINDAN,
 * ayri bir bolgede yer alir: label 41001'den baslar.
 */
export const EXTENDED_REGISTERS_PER_PANEL = 4;

/** Genisletilmis bolgenin 0-based baslangic adresi (= cekirdek bolgenin toplam uzunlugu). */
export const EXTENDED_BASE_ADDRESS = REGISTERS_PER_PANEL * MAX_SUPPORTED_PANELS;

export const TOTAL_HOLDING_REGISTERS = EXTENDED_BASE_ADDRESS + EXTENDED_REGISTERS_PER_PANEL * MAX_SUPPORTED_PANELS;

export enum ExtendedRegisterOffset {
  ARC_FLASH_X10 = 0,
  ACOUSTIC_X10 = 1,
  ARC_FLASH_ACTIVE = 2,
  PARTIAL_DISCHARGE_ACTIVE = 3,
}

export enum RegisterOffset {
  RISK_SCORE = 0,
  RISK_LEVEL = 1,
  AMBIENT_TEMPERATURE_X10 = 2,
  CABLE_TEMPERATURE_X10 = 3,
  HUMIDITY_X10 = 4,
  CURRENT_X10 = 5,
  ACTIVE_ALARM = 6,
  PANEL_STATUS = 7,
  ACTIVE_ANOMALY_COUNT = 8,
  DATA_QUALITY = 9,
}

export const MODBUS_RISK_LEVEL = {
  NORMAL: 0,
  WARNING: 1,
  HIGH: 2,
  CRITICAL: 3,
} as const;

export const MODBUS_PANEL_STATUS = {
  OFFLINE: 0,
  ONLINE: 1,
  MAINTENANCE: 2,
} as const;

export const MODBUS_BOOL = { NO: 0, YES: 1 } as const;

export const MODBUS_DATA_QUALITY = { INVALID: 0, VALID: 1 } as const;

const PANEL_CODE_PATTERN = /^PANO-(\d+)$/;

/**
 * "PANO-001" -> 0, "PANO-100" -> 99.
 *
 * Deterministic mapping panel code'un sayisal sirasindan turetilir; panel
 * DB UUID'i KULLANILMAZ (Asama 7 madde 5), boylece adres, panonun
 * database'e ekleniş sirasindan bagimsiz ve her zaman tekrar uretilebilir.
 */
export function getBlockIndexForPanelCode(panelCode: string): number {
  const match = PANEL_CODE_PATTERN.exec(panelCode.trim().toUpperCase());
  if (!match) {
    throw new Error(
      `Panel code "${panelCode}" does not match the expected "PANO-<digits>" Modbus mapping format`,
    );
  }

  const sequence = Number(match[1]);
  if (!Number.isInteger(sequence) || sequence < 1) {
    throw new Error(`Panel code "${panelCode}" has an invalid sequence number`);
  }

  const blockIndex = sequence - 1;
  if (blockIndex >= MAX_SUPPORTED_PANELS) {
    throw new Error(
      `Panel code "${panelCode}" maps to block index ${blockIndex}, which exceeds MAX_SUPPORTED_PANELS (${MAX_SUPPORTED_PANELS})`,
    );
  }

  return blockIndex;
}

/** blockIndex'in ilk register'inin 0-based Modbus adresi. */
export function getRegisterStartAddress(blockIndex: number): number {
  return blockIndex * REGISTERS_PER_PANEL;
}

/** blockIndex'in ilk register'inin 1-based/label ("40001" tarzi) adresi. */
export function getRegisterStartLabel(blockIndex: number): number {
  return HOLDING_REGISTER_LABEL_BASE + getRegisterStartAddress(blockIndex);
}

/** blockIndex'in genisletilmis blogunun ilk register'inin 0-based Modbus adresi. */
export function getExtendedRegisterStartAddress(blockIndex: number): number {
  return EXTENDED_BASE_ADDRESS + blockIndex * EXTENDED_REGISTERS_PER_PANEL;
}

/** blockIndex'in genisletilmis blogunun ilk register'inin label ("41001" tarzi) adresi. */
export function getExtendedRegisterStartLabel(blockIndex: number): number {
  return HOLDING_REGISTER_LABEL_BASE + getExtendedRegisterStartAddress(blockIndex);
}

export function getRegisterStartAddressForPanelCode(panelCode: string): number {
  return getRegisterStartAddress(getBlockIndexForPanelCode(panelCode));
}
