import { afterEach, describe, expect, it } from 'vitest';
import { dispatchMode, parseRecipients } from './notifications.config.js';

describe('parseRecipients', () => {
  it('splits, trims and de-duplicates a comma separated list', () => {
    expect(parseRecipients(' +905551112233, +905554445566 ,+905551112233', 'fallback')).toEqual([
      '+905551112233',
      '+905554445566',
    ]);
  });

  it('falls back to a single label when nothing is configured', () => {
    expect(parseRecipients(undefined, 'Operations Team')).toEqual(['Operations Team']);
    expect(parseRecipients(' , ', 'Operations Team')).toEqual(['Operations Team']);
  });
});

describe('dispatchMode', () => {
  afterEach(() => {
    delete process.env.NOTIFICATION_DISPATCH;
  });

  it('waits inline for the demo provider and goes to background for network providers', () => {
    expect(dispatchMode('demo')).toBe('inline');
    expect(dispatchMode('http')).toBe('background');
  });

  it('can be forced with NOTIFICATION_DISPATCH', () => {
    process.env.NOTIFICATION_DISPATCH = 'inline';
    expect(dispatchMode('http')).toBe('inline');
  });
});
