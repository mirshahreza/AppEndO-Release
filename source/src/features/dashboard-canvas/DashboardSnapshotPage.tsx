import React, { useEffect, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { formatApiErrorMessage, isApiError, apiGet } from '../../shared/api/client';
import {
  PAGE_TOOLBAR_FILTERS_CLUSTER_CLASS,
  PAGE_TOOLBAR_SINGLE_ROW_CLASS,
} from '../../shared/ui';
import { cn } from '../../lib/utils';
import {
  DesignerRuntimeDashboardSnapshotView,
  frozenSnapshotBanner,
} from '../../domain/component-designer/DesignerRuntimeDashboardSnapshotView';

type SnapshotResponse = {
  success?: boolean;
  snapshot?: {
    id: string;
    pageId: string;
    payload?: unknown;
    createdAt: string;
    banner?: string;
  };
};

const errorStatus = (error: unknown): number => (
  isApiError(error) ? error.status : 0
);

export const DashboardSnapshotPage: React.FC = () => {
  const { snapshotId } = useParams<{ snapshotId: string }>();
  const [snapshot, setSnapshot] = useState<SnapshotResponse['snapshot'] | null>(null);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    if (!snapshotId) {
      return;
    }
    let cancelled = false;
    setError(null);
    setSnapshot(null);
    void apiGet<SnapshotResponse>(`/api/dashboard-canvas/snapshots/${encodeURIComponent(snapshotId)}`)
      .then(({ data }) => {
        if (!cancelled) {
          setSnapshot(data.snapshot ?? null);
        }
      })
      .catch((next) => {
        if (!cancelled) {
          setError(next);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [snapshotId]);

  if (errorStatus(error) === 401) {
    const returnPath = `/shared/dashboard-snapshots/${encodeURIComponent(snapshotId ?? '')}`;
    return <Navigate to={`/login?return=${encodeURIComponent(returnPath)}`} replace />;
  }

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-white" data-testid="dashboard-snapshot-page">
      <div className={cn(PAGE_TOOLBAR_SINGLE_ROW_CLASS, 'shrink-0 border-b border-slate-200')}>
        <div className={PAGE_TOOLBAR_FILTERS_CLUSTER_CLASS}>
          <span className="text-sm font-semibold text-slate-800">Dashboard snapshot</span>
        </div>
      </div>
      {error ? (
        <p className="p-4 text-sm text-rose-700">
          {formatApiErrorMessage(error) || 'Unable to load this snapshot.'}
        </p>
      ) : !snapshot ? (
        <p className="p-4 text-sm text-slate-600">Loading snapshot…</p>
      ) : (
        <DesignerRuntimeDashboardSnapshotView
          banner={snapshot.banner?.trim() || frozenSnapshotBanner(snapshot.createdAt)}
          payload={snapshot.payload}
        />
      )}
    </div>
  );
};
