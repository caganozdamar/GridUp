import { RiskLevel, Severity } from '@grid-up/shared';

export const RISK_LEVEL_CLASS: Record<RiskLevel, string> = {
  [RiskLevel.NORMAL]: 'status-normal',
  [RiskLevel.WARNING]: 'status-warning',
  [RiskLevel.HIGH]: 'status-high',
  [RiskLevel.CRITICAL]: 'status-critical',
};

export const SEVERITY_CLASS: Record<Severity, string> = {
  [Severity.LOW]: 'status-normal',
  [Severity.MEDIUM]: 'status-warning',
  [Severity.HIGH]: 'status-high',
  [Severity.CRITICAL]: 'status-critical',
};

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

// Asama 9 madde 13: "Last update: 4 seconds ago" gibi Data Health metinleri icin.
export function formatRelativeTime(iso: string, now: number = Date.now()): string {
  const deltaSeconds = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (deltaSeconds < 60) return `${deltaSeconds} second${deltaSeconds === 1 ? '' : 's'} ago`;
  const deltaMinutes = Math.round(deltaSeconds / 60);
  if (deltaMinutes < 60) return `${deltaMinutes} minute${deltaMinutes === 1 ? '' : 's'} ago`;
  const deltaHours = Math.round(deltaMinutes / 60);
  return `${deltaHours} hour${deltaHours === 1 ? '' : 's'} ago`;
}
