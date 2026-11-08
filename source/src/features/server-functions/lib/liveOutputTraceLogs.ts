import type { EdgeLogEntry } from '../../../shared/api/contracts/server-functions/types';

/** Run traces that are not already restated by Active Live Output status/JSON. */
const TRACE_PREFIXES = [
  'Compiling ',
  'Invoking published Data API route ',
  'Invoking built-in API route ',
] as const;

export function isLiveOutputTraceLog(msg: string): boolean {
  return TRACE_PREFIXES.some((prefix) => msg.startsWith(prefix));
}

export function selectLiveOutputTraceLogs(logs: EdgeLogEntry[]): EdgeLogEntry[] {
  return logs.filter((log) => isLiveOutputTraceLog(log.msg));
}
