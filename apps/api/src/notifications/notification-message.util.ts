import { AlarmKind, NotificationChannel, Severity } from '@prisma/client';

// Asama 6 madde 8: mesaj icerigi hard-coded pano/site kullanmaz, gercek risk
// data'sindan (RiskExplanationResult.score/reasons) turetilir. Prisma'ya
// bagimliligi yoktur; risk-engine mimarisini bozmadan cagrilabilir.
export interface AlarmNotificationContext {
  panelCode: string;
  siteName: string;
  severity: Severity;
  score: number;
  reasons: string[];
  // Varsayilan RISK. MODULE_OFFLINE'da score/reasons kullanilmaz, bunun yerine
  // verinin ne kadar suredir kesik oldugu (silentForMs) yazilir.
  kind?: AlarmKind;
  silentForMs?: number;
}

function formatSilence(ms: number | undefined): string {
  if (ms === undefined) return 'for some time';
  const minutes = Math.max(1, Math.round(ms / 60_000));
  return minutes < 60 ? `for ${minutes} min` : `for ${Math.round(minutes / 60)} h`;
}

function buildOfflineMessage(channel: NotificationChannel, context: AlarmNotificationContext): string {
  const silence = formatSilence(context.silentForMs);
  if (channel === NotificationChannel.SMS) {
    return [
      'GRID UP ALERT',
      `${context.panelCode} module offline.`,
      `No sensor data ${silence}.`,
      'Panel is not being monitored. Check the field module and network.',
    ].join('\n');
  }
  return [
    'GRID UP — MODULE OFFLINE',
    '',
    `Panel: ${context.panelCode}`,
    `Site: ${context.siteName}`,
    `No sensor data received ${silence}.`,
    '',
    'The panel is not being monitored while the module is silent.',
    'Check the field module, its power and the network link.',
  ].join('\n');
}

export function buildNotificationMessage(channel: NotificationChannel, context: AlarmNotificationContext): string {
  if (context.kind === AlarmKind.MODULE_OFFLINE) return buildOfflineMessage(channel, context);
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
