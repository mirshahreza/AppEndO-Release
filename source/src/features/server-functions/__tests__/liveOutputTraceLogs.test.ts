import { describe, expect, it } from 'vitest';
import { isLiveOutputTraceLog, selectLiveOutputTraceLogs } from '../lib/liveOutputTraceLogs';
import type { EdgeLogEntry } from '../types';

const entry = (msg: string, id = msg): EdgeLogEntry => ({
  id,
  time: '11:00:00',
  type: 'info',
  msg,
});

describe('selectLiveOutputTraceLogs', () => {
  it('keeps compile and invoke traces', () => {
    const logs = [
      entry('Compiling test.ts and preparing VM thread allocation (VM: v20.x, RAM: 128MB, Timeout: 5000ms)...'),
      entry('Invoking published Data API route GET /api/items via Sequelize executor...'),
      entry('Invoking built-in API route GET /api/users directly...'),
    ];
    expect(selectLiveOutputTraceLogs(logs)).toEqual(logs);
  });

  it('drops traces that duplicate live output status or JSON', () => {
    const logs = [
      entry('Execution failed: Missing SerpAPI key'),
      entry('Execution error: network down'),
      entry('Failed compile: Request body parsing error (Malformatted JSON)'),
      entry('Built-in route GET completed successfully.'),
      entry('Data API route GET completed successfully.'),
      entry('VM completed execution loop on thread :3000 in 12ms. Code 200 returned.'),
      entry('Saved edge configuration to workspace/server-functions/custom.'),
    ];
    expect(selectLiveOutputTraceLogs(logs)).toEqual([]);
  });

  it('matches only the unique prefixes', () => {
    expect(isLiveOutputTraceLog('Compiling probe.ts and preparing VM thread allocation...')).toBe(true);
    expect(isLiveOutputTraceLog('Using edge runner data source: Local (postgres)')).toBe(false);
    expect(isLiveOutputTraceLog('Execution failed: Missing SerpAPI key')).toBe(false);
  });
});
