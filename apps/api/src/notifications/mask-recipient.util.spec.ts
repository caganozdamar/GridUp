import { describe, expect, it } from 'vitest';
import { maskRecipient } from './mask-recipient.util.js';

describe('maskRecipient', () => {
  it('hides the middle of a phone number', () => {
    const masked = maskRecipient('+905551234567');
    expect(masked.startsWith('+90')).toBe(true);
    expect(masked.endsWith('67')).toBe(true);
    expect(masked).not.toContain('5551234');
    expect(masked).toHaveLength('+905551234567'.length);
  });

  it('leaves non-phone labels untouched', () => {
    expect(maskRecipient('Operations Team')).toBe('Operations Team');
  });
});
