import { describe, expect, it } from 'vitest';
import { buildServerFunctionAiSnapshot } from '../lib/serverFunctionAiSnapshot';

describe('buildServerFunctionAiSnapshot', () => {
  it('includes Test Console lastRun output and logs next to source', () => {
    const snapshot = JSON.parse(buildServerFunctionAiSnapshot({
      name: 'test',
      method: 'GET',
      path: '/api/test',
      language: 'ts',
      engineType: 'SANDBOX_JS',
      readOnly: false,
      testPayload: '{"q":"news"}',
      source: 'edgeRes.json({ ok: true });',
      lastRun: {
        isRunning: false,
        output: { error: 'Missing serpapi key', _httpStatus: 400 },
        logs: [
          { id: '1', time: '10:00:00', type: 'info', msg: 'Compiling test.ts...' },
          { id: '2', time: '10:00:01', type: 'warn', msg: 'Execution failed: Missing serpapi key' },
        ],
      },
    }));

    expect(snapshot.source).toContain('edgeRes.json');
    expect(snapshot.testPayload).toBe('{"q":"news"}');
    expect(snapshot.lastRun.output).toEqual({ error: 'Missing serpapi key', _httpStatus: 400 });
    expect(snapshot.lastRun.logs).toEqual([
      { time: '10:00:00', type: 'info', msg: 'Compiling test.ts...' },
      { time: '10:00:01', type: 'warn', msg: 'Execution failed: Missing serpapi key' },
    ]);
  });
});
