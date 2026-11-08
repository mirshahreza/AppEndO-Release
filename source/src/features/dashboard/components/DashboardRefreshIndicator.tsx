import React, { useEffect, useState } from 'react';

const RADIUS = 8;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

type DashboardRefreshIndicatorProps = {
  lastUpdatedTimestamp: number;
  pollMs: number;
};

export const DashboardRefreshIndicator: React.FC<DashboardRefreshIndicatorProps> = ({
  lastUpdatedTimestamp,
  pollMs,
}) => {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    setNow(Date.now());
  }, [lastUpdatedTimestamp]);

  useEffect(() => {
    const tick = () => setNow(Date.now());

    if (document.visibilityState === 'visible') {
      tick();
    }

    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        tick();
      }
    }, 250);

    return () => window.clearInterval(id);
  }, []);

  const countdownProgress = Math.min(100, ((now - lastUpdatedTimestamp) / pollMs) * 100);
  const dashOffset = CIRCUMFERENCE - (countdownProgress / 100) * CIRCUMFERENCE;

  return (
    <div
      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-slate-700"
      role="img"
      aria-label="Dashboard data refresh timer"
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        className="shrink-0"
        style={{ transform: 'rotate(-90deg)' }}
      >
        <circle
          cx="12"
          cy="12"
          r={RADIUS}
          fill="none"
          strokeWidth="3"
          className="stroke-primary-subtle"
        />
        <circle
          cx="12"
          cy="12"
          r={RADIUS}
          fill="none"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={`${CIRCUMFERENCE} ${CIRCUMFERENCE}`}
          strokeDashoffset={dashOffset}
          className="stroke-primary-600 transition-[stroke-dashoffset] duration-300 ease-linear"
        />
      </svg>
    </div>
  );
};
