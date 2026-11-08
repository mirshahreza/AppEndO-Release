import type { EdgeLogEntry } from '../../../shared/api/contracts/server-functions/types';

const MAX_LOGS = 40;
const MAX_OUTPUT_CHARS = 12_000;

export type ServerFunctionAiSnapshotInput = {
  name: string;
  method: string | null;
  path: string;
  language: string;
  engineType: string;
  readOnly: boolean;
  testPayload: string;
  source: string;
  lastRun: {
    isRunning: boolean;
    output: Record<string, unknown> | null;
    logs: EdgeLogEntry[];
  };
};

const clipOutput = (output: Record<string, unknown> | null): Record<string, unknown> | null => {
  if (!output) {
    return null;
  }
  try {
    const serialized = JSON.stringify(output);
    if (serialized.length <= MAX_OUTPUT_CHARS) {
      return output;
    }
    return { truncated: true, preview: serialized.slice(0, MAX_OUTPUT_CHARS) };
  } catch {
    return { error: 'Unserializable Test Console output' };
  }
};

export const buildServerFunctionAiSnapshot = (input: ServerFunctionAiSnapshotInput): string => (
  JSON.stringify({
    name: input.name,
    method: input.method,
    path: input.path,
    language: input.language,
    engineType: input.engineType,
    readOnly: input.readOnly,
    testPayload: input.testPayload,
    source: input.source,
    lastRun: {
      isRunning: input.lastRun.isRunning,
      output: clipOutput(input.lastRun.output ?? null),
      logs: (Array.isArray(input.lastRun.logs) ? input.lastRun.logs : []).slice(-MAX_LOGS).map((log) => ({
        time: log.time,
        type: log.type,
        msg: log.msg,
      })),
    },
  }, null, 2)
);
