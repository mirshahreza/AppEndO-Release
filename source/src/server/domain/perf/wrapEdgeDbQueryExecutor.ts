import type {
  createEdgeDbQueryExecutor,
  EdgeDbQueryContext,
  EdgeDbQueryResult,
} from '../../../core/database/EdgeDbRouter';
import { recordEdgeDbQueryTiming } from './requestPerfAls';

type EdgeDbExecutor = ReturnType<typeof createEdgeDbQueryExecutor>;

export const wrapEdgeDbQueryExecutorWithPerf = (execute: EdgeDbExecutor): EdgeDbExecutor => (
  async <T = unknown>(
    operation: string,
    params: unknown[] = [],
    context?: EdgeDbQueryContext,
  ): Promise<EdgeDbQueryResult<T>> => {
    const startedAt = Date.now();
    const result = await execute<T>(operation, params, context);
    const rowCount = typeof result.count === 'number'
      ? result.count
      : (Array.isArray(result.data) ? result.data.length : null);
    recordEdgeDbQueryTiming(
      context?.dataSourceId ? `edge-router:${context.dataSourceId}` : 'edge-router',
      operation,
      Date.now() - startedAt,
      rowCount,
    );
    return result;
  }
);
