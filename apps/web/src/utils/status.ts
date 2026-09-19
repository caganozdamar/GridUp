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
