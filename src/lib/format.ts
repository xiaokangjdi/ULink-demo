/** Small formatting helpers. No value is ever invented here. */

export function formatMetric(value: number | null | undefined, digits = 4): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "--";
  return value.toFixed(digits);
}

export function formatMeanStd(
  block: { mean: number | null; std: number | null; count: number } | undefined,
  digits = 4,
): string {
  if (!block || block.mean === null || block.mean === undefined) return "--";
  const mean = block.mean.toFixed(digits);
  if (block.std === null || block.std === undefined) return mean;
  return `${mean} ± ${block.std.toFixed(digits)}`;
}

/**
 * Mean ± std of a 0–1 metric, printed in percent (e.g. "79.52% ± 0.74%").
 * Used by the headline results table so every column matches the paper's
 * percent-based columns next to it. The stored value is never altered, only
 * scaled for display.
 */
export function formatMeanStdPercent(
  block: { mean: number | null; std: number | null; count: number } | undefined,
  digits = 2,
): string {
  if (!block || block.mean === null || block.mean === undefined) return "--";
  const mean = `${(block.mean * 100).toFixed(digits)}%`;
  if (block.std === null || block.std === undefined) return mean;
  return `${mean} ± ${(block.std * 100).toFixed(digits)}%`;
}

export function formatScore(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "--";
  if (value !== 0 && Math.abs(value) < 1e-4) return value.toExponential(2);
  return value.toFixed(6);
}

export function formatMs(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "--";
  if (value < 1) return `${(value * 1000).toFixed(0)} µs`;
  if (value < 1000) return `${value.toFixed(1)} ms`;
  return `${(value / 1000).toFixed(2)} s`;
}

export function formatCount(value: number | null | undefined): string {
  if (value === null || value === undefined) return "--";
  return value.toLocaleString("en-US");
}

export function formatPercent(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "--";
  return `${(value * 100).toFixed(digits)}%`;
}

/** Compact relative description of a standard deviation, used in the results table. */
export function formatStdShare(mean: number | null, std: number | null): string {
  if (mean === null || std === null || mean === 0) return "--";
  return `${((std / Math.abs(mean)) * 100).toFixed(2)}%`;
}
