import { describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';
import { AiController } from '../ai.controller';

describe('AiController.getWorkspaceEmbeddingsIndexStatus', () => {
  it('returns the workspace index status payload', async () => {
    const controller = new AiController();
    const json = vi.fn();
    const res = { json } as unknown as Response;

    await controller.getWorkspaceEmbeddingsIndexStatus({} as Request, res, vi.fn());

    expect(json).toHaveBeenCalledTimes(1);
    const payload = json.mock.calls[0]?.[0] as {
      success: boolean;
      status: { state: string; totalChunks: number; indexedChunks: number };
    };
    expect(payload.success).toBe(true);
    expect([
      'unavailable',
      'empty',
      'pending',
      'indexing',
      'ready',
      'error',
    ]).toContain(payload.status.state);
    expect(payload.status.totalChunks).toBeGreaterThanOrEqual(0);
    expect(payload.status.indexedChunks).toBeGreaterThanOrEqual(0);
  });
});
