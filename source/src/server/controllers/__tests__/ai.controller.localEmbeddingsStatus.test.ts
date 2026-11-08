import { describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';
import { AiController } from '../ai.controller';

describe('AiController.getLocalEmbeddingsModelStatus', () => {
  it('returns the lifecycle status payload', async () => {
    const controller = new AiController();
    const json = vi.fn();
    const res = { json } as unknown as Response;

    await controller.getLocalEmbeddingsModelStatus({} as Request, res, vi.fn());

    expect(json).toHaveBeenCalledTimes(1);
    const payload = json.mock.calls[0]?.[0] as {
      success: boolean;
      status: { modelId: string; state: string };
    };
    expect(payload.success).toBe(true);
    expect(payload.status.modelId).toContain('jina-embeddings');
    expect(['missing', 'downloading', 'ready', 'error']).toContain(payload.status.state);
  });
});
