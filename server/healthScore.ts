export type HealthScoreInputs = {
  cpuUtilizationPercent?: number | null;
  memoryUtilizationPercent?: number | null;
  diskFreePercent?: number | null;
  batteryHealthPercent?: number | null;
  networkLatencyMs?: number | null;
  securityScore?: number | null;
};

export type HealthScoreResult = {
  overall: number;
  components: {
    cpu: number;
    memory: number;
    disk: number;
    battery: number;
    network: number;
    security: number;
  };
  formulaVersion: string;
};

const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value)));
const fallback = (value: number | null | undefined, defaultValue = 100) => value == null || Number.isNaN(value) ? defaultValue : value;

export function calculateHealthScore(input: HealthScoreInputs): HealthScoreResult {
  const cpu = clamp(100 - fallback(input.cpuUtilizationPercent, 0));
  const memory = clamp(100 - fallback(input.memoryUtilizationPercent, 0));
  const disk = clamp(fallback(input.diskFreePercent, 100) * 2);
  const battery = clamp(fallback(input.batteryHealthPercent, 100));
  const network = clamp(100 - Math.max(0, fallback(input.networkLatencyMs, 0) - 20) * 1.5);
  const security = clamp(fallback(input.securityScore, 100));
  const overall = clamp(cpu * 0.2 + memory * 0.2 + disk * 0.2 + battery * 0.15 + network * 0.15 + security * 0.1);
  return { overall, components: { cpu, memory, disk, battery, network, security }, formulaVersion: 'health-v1' };
}
