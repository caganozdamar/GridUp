import { describe, expect, it } from 'vitest';
import {
  getBlockIndexForPanelCode,
  getRegisterStartAddress,
  getRegisterStartLabel,
  MAX_SUPPORTED_PANELS,
  REGISTERS_PER_PANEL,
} from './register-map.js';

describe('register-map', () => {
  it('maps PANO-001 to block 0 / address 0 / label 40001', () => {
    expect(getBlockIndexForPanelCode('PANO-001')).toBe(0);
    expect(getRegisterStartAddress(0)).toBe(0);
    expect(getRegisterStartLabel(0)).toBe(40001);
  });

  it('maps PANO-003 to block 2 / address 20 / label 40021', () => {
    expect(getBlockIndexForPanelCode('PANO-003')).toBe(2);
    expect(getRegisterStartAddress(2)).toBe(20);
    expect(getRegisterStartLabel(2)).toBe(40021);
  });

  it('maps PANO-100 to block 99 / address 990 / label 40991', () => {
    expect(getBlockIndexForPanelCode('PANO-100')).toBe(99);
    expect(getRegisterStartAddress(99)).toBe(990);
    expect(getRegisterStartLabel(99)).toBe(40991);
  });

  it('rejects panel codes that are not in the PANO-<digits> format', () => {
    expect(() => getBlockIndexForPanelCode('FOO-001')).toThrow();
    expect(() => getBlockIndexForPanelCode('PANO-ABC')).toThrow();
    expect(() => getBlockIndexForPanelCode('PANO-000')).toThrow();
  });

  it('rejects panel codes beyond MAX_SUPPORTED_PANELS', () => {
    expect(() => getBlockIndexForPanelCode('PANO-101')).toThrow();
  });

  it('produces exactly MAX_SUPPORTED_PANELS non-overlapping 10-register blocks (no collisions across 1..100)', () => {
    const usedAddresses = new Set<number>();

    for (let sequence = 1; sequence <= MAX_SUPPORTED_PANELS; sequence++) {
      const code = `PANO-${String(sequence).padStart(3, '0')}`;
      const blockIndex = getBlockIndexForPanelCode(code);
      const start = getRegisterStartAddress(blockIndex);

      for (let offset = 0; offset < REGISTERS_PER_PANEL; offset++) {
        const address = start + offset;
        expect(usedAddresses.has(address)).toBe(false);
        usedAddresses.add(address);
      }
    }

    expect(usedAddresses.size).toBe(MAX_SUPPORTED_PANELS * REGISTERS_PER_PANEL);
  });
});
