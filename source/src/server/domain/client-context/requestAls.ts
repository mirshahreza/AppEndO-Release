import { AsyncLocalStorage } from 'node:async_hooks';
import type { Request } from 'express';

export type RecordEventRequestScope = {
  req: Request;
  source?: 'patch' | 'workflow' | 'status-log';
  workflowInstanceId?: string;
  workflowWorkItemId?: string;
  agentRunId?: string;
};

export const recordEventRequestAls = new AsyncLocalStorage<RecordEventRequestScope>();

export const getRecordEventRequestScope = (): RecordEventRequestScope | undefined => (
  recordEventRequestAls.getStore()
);

export const runWithRecordEventRequestScope = <T>(
  scope: RecordEventRequestScope,
  fn: () => T,
): T => recordEventRequestAls.run(scope, fn);
