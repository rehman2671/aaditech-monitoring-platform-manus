export type AlertRule = {
  id: string;
  name: string;
  metric: 'cpu' | 'ram' | 'disk_free' | 'battery_health' | 'network_latency' | 'offline';
  condition: '>' | '<';
  threshold: number;
  severity: 'warning' | 'critical';
  durationMinutes?: number;
};

export type AlertEvent = {
  type: 'opened' | 'resolved';
  alertKey: string;
  endpointId: string;
  ruleId: string;
  ruleName: string;
  metric: AlertRule['metric'];
  value?: number;
  threshold: number;
  severity: AlertRule['severity'];
  occurredAt: string;
  reason: string;
};

export function evaluateRules(endpointId: string, values: Partial<Record<AlertRule['metric'], number>>, rules: AlertRule[], now = new Date()): AlertEvent[] {
  const events: AlertEvent[] = [];
  for (const rule of rules.filter(item => item.enabled !== false)) {
    const value = values[rule.metric];
    if (value == null) continue;
    const breached = rule.condition === '>' ? value > rule.threshold : value < rule.threshold;
    events.push({
      type: breached ? 'opened' : 'resolved',
      alertKey: `${endpointId}:${rule.id}`,
      endpointId,
      ruleId: rule.id,
      ruleName: rule.name,
      metric: rule.metric,
      value,
      threshold: rule.threshold,
      severity: rule.severity,
      occurredAt: now.toISOString(),
      reason: breached ? `${rule.metric} ${rule.condition} ${rule.threshold}` : `${rule.metric} returned within threshold`,
    });
  }
  return events;
}
