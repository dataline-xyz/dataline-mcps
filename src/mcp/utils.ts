import type { DatalineError } from "../client/types.js";

function stripProviderNoise(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripProviderNoise);
  if (value && typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (k === "endpoint" || k === "latency_ms" || k === "cache_hit") continue;
      result[k] = stripProviderNoise(v);
    }
    return result;
  }
  return value;
}

function dropEmpty(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value
      .map(dropEmpty)
      .filter(
        (v) =>
          v !== null &&
          v !== undefined &&
          !(Array.isArray(v) && (v as unknown[]).length === 0) &&
          !(
            typeof v === "object" &&
            v !== null &&
            !Array.isArray(v) &&
            Object.keys(v as object).length === 0
          ),
      );
  }
  if (value && typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      const cleaned = dropEmpty(v);
      if (cleaned === null || cleaned === undefined) continue;
      if (Array.isArray(cleaned) && cleaned.length === 0) continue;
      if (
        typeof cleaned === "object" &&
        !Array.isArray(cleaned) &&
        Object.keys(cleaned as object).length === 0
      )
        continue;
      result[k] = cleaned;
    }
    return result;
  }
  return value;
}

export function compactForAgent(data: unknown): string {
  return JSON.stringify(dropEmpty(stripProviderNoise(data)));
}

export function isDatalineError(
  data: unknown,
): data is DatalineError {
  return (
    typeof data === "object" &&
    data !== null &&
    (data as Record<string, unknown>).error === true
  );
}
