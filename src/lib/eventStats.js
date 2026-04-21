import { buildStockEventPerformance } from './stockEventPerformance';

export function buildEventPerformanceOverview(detail) {
  const items = buildStockEventPerformance(detail);

  return items.map((entry) => ({
    key: entry.key,
    title: entry.title,
    note: entry.note,
    sampleCount: entry.sampleCount,
    metrics: entry.metrics,
    latestSample: entry.samples?.[0] ?? null,
  }));
}
