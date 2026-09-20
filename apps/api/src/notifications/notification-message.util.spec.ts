import { describe, expect, it } from 'vitest';
import { AlarmKind, NotificationChannel, Severity } from '@prisma/client';
import { buildNotificationMessage } from './notification-message.util.js';

const baseContext = {
  panelCode: 'PANO-007',
  siteName: 'Grid Up Demo Site',
  score: 67,
  reasons: ['Cable temperature is elevated and approaching critical levels'],
};

describe('buildNotificationMessage', () => {
  it('builds a short SMS message for a HIGH alarm', () => {
    const message = buildNotificationMessage(NotificationChannel.SMS, {
      ...baseContext,
      severity: Severity.HIGH,
    });

    expect(message).toContain('GRID UP ALERT');
    expect(message).toContain('PANO-007 HIGH risk.');
    expect(message).toContain('Score: 67/100.');
    expect(message).not.toContain('PANO-003');
  });

  it('builds a short SMS message for a CRITICAL alarm without hard-coded panel codes', () => {
    const message = buildNotificationMessage(NotificationChannel.SMS, {
      ...baseContext,
      panelCode: 'PANO-011',
      severity: Severity.CRITICAL,
      score: 94,
    });

    expect(message).toContain('GRID UP CRITICAL');
    expect(message).toContain('PANO-011 CRITICAL risk.');
    expect(message).toContain('Immediate inspection recommended.');
    expect(message).not.toContain('PANO-003');
  });

  it('builds a more detailed WhatsApp message for a CRITICAL alarm', () => {
    const message = buildNotificationMessage(NotificationChannel.WHATSAPP, {
      panelCode: 'PANO-011',
      siteName: 'Grid Up Demo Site',
      severity: Severity.CRITICAL,
      score: 94,
      reasons: ['Cable temperature is at a critical level', 'Current draw is critically high'],
    });

    expect(message).toContain('Panel: PANO-011');
    expect(message).toContain('Site: Grid Up Demo Site');
    expect(message).toContain('Risk Score: 94/100');
    expect(message).toContain('Severity: CRITICAL');
    expect(message).toContain('- Cable temperature is at a critical level');
    expect(message).toContain('- Current draw is critically high');
  });
});

describe('buildNotificationMessage for a silent module', () => {
  const offline = { ...baseContext, severity: Severity.HIGH, kind: AlarmKind.MODULE_OFFLINE, silentForMs: 4 * 60_000 };

  it('says the module is offline and for how long, not a risk score', () => {
    const sms = buildNotificationMessage(NotificationChannel.SMS, offline);

    expect(sms).toContain('PANO-007 module offline.');
    expect(sms).toContain('for 4 min');
    expect(sms).toContain('not being monitored');
    expect(sms).not.toContain('Score:');
  });

  it('builds a WhatsApp message with the panel and site', () => {
    const whatsapp = buildNotificationMessage(NotificationChannel.WHATSAPP, offline);

    expect(whatsapp).toContain('MODULE OFFLINE');
    expect(whatsapp).toContain('Panel: PANO-007');
    expect(whatsapp).toContain('Site: Grid Up Demo Site');
    expect(whatsapp).not.toContain('Risk Score');
  });

  it('formats long silences in hours and never says "0 min"', () => {
    expect(buildNotificationMessage(NotificationChannel.SMS, { ...offline, silentForMs: 3 * 3_600_000 })).toContain('for 3 h');
    expect(buildNotificationMessage(NotificationChannel.SMS, { ...offline, silentForMs: 5_000 })).toContain('for 1 min');
  });

  it('keeps the risk message for alarms without a kind', () => {
    const risk = buildNotificationMessage(NotificationChannel.SMS, { ...baseContext, severity: Severity.HIGH });
    expect(risk).toContain('PANO-007 HIGH risk.');
  });
});

