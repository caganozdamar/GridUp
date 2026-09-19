import { NotificationChannel, Severity } from '@prisma/client';

// Asama 6 madde 8: mesaj icerigi hard-coded pano/site kullanmaz, gercek risk
// data'sindan (RiskExplanationResult.score/reasons) turetilir. Prisma'ya
// bagimliligi yoktur; risk-engine mimarisini bozmadan cagrilabilir.
export interface AlarmNotificationContext {
  panelCode: string;
  siteName: string;
  severity: Severity;
  score: number;
  reasons: string[];
}

export function buildNotificationMessage(channel: NotificationChannel, context: AlarmNotificationContext): string {
  return channel === NotificationChannel.SMS ? buildSmsMessage(context) : buildWhatsAppMessage(context);
}

function buildSmsMessage(context: AlarmNotificationContext): string {
  const isCritical = context.severity === Severity.CRITICAL;
  const lines = [
    isCritical ? 'GRID UP CRITICAL' : 'GRID UP ALERT',
    `${context.panelCode} ${context.severity} risk.`,
    `Score: ${context.score}/100.`,
    isCritical ? 'Immediate inspection recommended.' : (context.reasons[0] ?? 'Elevated electrical risk detected.'),
  ];
  if (!isCritical) lines.push('Check monitoring dashboard.');
  return lines.join('\n');
}

function buildWhatsAppMessage(context: AlarmNotificationContext): string {
  const reasons = context.reasons.length > 0 ? context.reasons.slice(0, 4) : ['Elevated electrical risk detected'];
  return [
    `GRID UP — ${context.severity} ALERT`,
    '',
    `Panel: ${context.panelCode}`,
    `Site: ${context.siteName}`,
    `Risk Score: ${context.score}/100`,
    `Severity: ${context.severity}`,
    '',
    'Detected conditions:',
    ...reasons.map((reason) => `- ${reason}`),
    '',
    'Immediate inspection is recommended.',
  ].join('\n');
}
