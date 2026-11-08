import { formatProfileDurationMs } from './buildPhaseRows';
import { computePageLoadProfileTotals, computePageLoadProfileWallSplit } from './computeTotals';
import { isHttpApiRequestPath } from './httpApiPath';
import { PAGE_LOAD_PROFILE_COPY as COPY } from './pageLoadProfileCopy';
import type { PageLoadProfileApiCall, PageLoadProfileDbQuery, PageLoadProfileSnapshot } from './types';

export type PageLoadProfileSimpleBucket = {
  id: string;
  label: string;
  durationMs: number;
  note?: string;
};

export type PageLoadProfileSimpleSummary = {
  wallClockMs: number;
  isComplete: boolean;
  headline: string;
  buckets: PageLoadProfileSimpleBucket[];
  slowestApi: PageLoadProfileApiCall | null;
  slowestQuery: (PageLoadProfileDbQuery & { apiPath: string }) | null;
};

export const buildSimplePageLoadProfileSummary = (
  snapshot: PageLoadProfileSnapshot,
): PageLoadProfileSimpleSummary => {
  const totals = computePageLoadProfileTotals(snapshot);
  const split = computePageLoadProfileWallSplit(snapshot);
  const apiCalls = snapshot.apiCalls.filter((call) => isHttpApiRequestPath(call.path));
  const slowestApi = apiCalls.length > 0
    ? [...apiCalls].sort((a, b) => b.durationMs - a.durationMs)[0]
    : null;

  let slowestQuery: (PageLoadProfileDbQuery & { apiPath: string }) | null = null;
  for (const call of apiCalls) {
    const queries = call.server?.sections.database.queries ?? call.server?.queries ?? [];
    for (const query of queries) {
      if (!slowestQuery || query.ms > slowestQuery.ms) {
        slowestQuery = { ...query, apiPath: call.path };
      }
    }
  }

  const beforeMs = split.clientBeforeMs;
  const apiWindowMs = split.apiPhaseWallMs;
  const afterMs = split.clientAfterMs;

  const buckets: PageLoadProfileSimpleBucket[] = [
    {
      id: 'client-before',
      label: COPY.simpleBucketClientBefore,
      durationMs: beforeMs,
      note: COPY.simpleBucketClientBeforeNote,
    },
    {
      id: 'api-window',
      label: COPY.simpleBucketApiWindow,
      durationMs: apiWindowMs,
      note: apiCalls.length > 0 ? `${apiCalls.length} ${COPY.simpleApiCallCountSuffix}` : undefined,
    },
    {
      id: 'client-after',
      label: COPY.simpleBucketClientAfter,
      durationMs: afterMs,
      note: COPY.simpleBucketClientAfterNote,
    },
  ].filter((bucket) => bucket.durationMs > 0 || bucket.id === 'api-window');

  const wall = totals.wallClockMs;
  let headline = COPY.simpleHeadlineFast;
  if (wall >= 3000) {
    headline = COPY.simpleHeadlineSlow;
  } else if (wall >= 1200) {
    headline = COPY.simpleHeadlineModerate;
  }
  if (!totals.isComplete) {
    headline = COPY.simpleHeadlineInProgress;
  }

  return {
    wallClockMs: wall,
    isComplete: totals.isComplete,
    headline,
    buckets,
    slowestApi,
    slowestQuery,
  };
};

export const formatSimpleDuration = formatProfileDurationMs;
