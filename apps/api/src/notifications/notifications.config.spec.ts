import { afterEach, describe, expect, it } from 'vitest';
import { dispatchMode, notificationCooldownMs, parseRecipients } from './notifications.config.js';

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

describe('notificationCooldownMs', () => {
  afterEach(() => {
    delete process.env.NOTIFICATION_COOLDOWN_MS;
  });

  it('defaults to two minutes', () => {
    expect(notificationCooldownMs()).toBe(120_000);
  });

  it('can be changed or disabled with NOTIFICATION_COOLDOWN_MS', () => {
    process.env.NOTIFICATION_COOLDOWN_MS = '30000';
    expect(notificationCooldownMs()).toBe(30_000);
    process.env.NOTIFICATION_COOLDOWN_MS = '0';
    expect(notificationCooldownMs()).toBe(0);
  });

  it('ignores garbage and negative values', () => {
    process.env.NOTIFICATION_COOLDOWN_MS = 'soon';
    expect(notificationCooldownMs()).toBe(120_000);
    process.env.NOTIFICATION_COOLDOWN_MS = '-5';
    expect(notificationCooldownMs()).toBe(120_000);
  });
});
