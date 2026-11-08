export type DashboardCompactCount = {
  display: string;
  /** Full locale string when display is abbreviated; otherwise null. */
  full: string | null;
};

/** Compact count for dashboard stat tiles — 999 stays full; 1,000+ uses K/M/B. */
export function formatDashboardCompactCount(value: number): DashboardCompactCount {
  if (!Number.isFinite(value)) {
    return { display: '—', full: null };
  }

  if (Math.abs(value) < 1000) {
    return { display: String(value), full: null };
  }

  const display = new Intl.NumberFormat('en-US', {
    notation: 'compact',
    compactDisplay: 'short',
    maximumFractionDigits: (() => {
      const abs = Math.abs(value);
      if (abs < 10_000) return 1;
      if (abs < 1_000_000) return 0;
      if (abs < 10_000_000) return 1;
      return 0;
    })(),
  }).format(value);

  return {
    display,
    full: value.toLocaleString('en-US'),
  };
}
