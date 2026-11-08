import React from 'react';
import type { DataSourceStatus } from '../../../shared/api/contracts/data-sources/types';

export const DATA_SOURCE_CARD_BADGE_BASE_CLASS =
  'inline-flex h-5 items-center rounded px-2 text-[10px] font-semibold uppercase tracking-wide leading-none';

type ConnectivityStatusBadgeProps = {
  status: DataSourceStatus;
};

export const ConnectivityStatusBadge: React.FC<ConnectivityStatusBadgeProps> = ({ status }) => (
  <span
    className={`${DATA_SOURCE_CARD_BADGE_BASE_CLASS} ${
      status === 'connected'
        ? 'bg-emerald-100 text-emerald-700'
        : status === 'error'
          ? 'bg-red-100 text-red-700'
          : status === 'testing'
            ? 'bg-amber-100 text-amber-700'
            : 'bg-slate-100 text-slate-700'
    }`}
  >
    {status}
  </span>
);
