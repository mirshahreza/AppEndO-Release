import { describe, expect, it } from 'vitest';
import { ImageEditorAiService } from '../imageEditorAi.service';
import { HttpError } from '../../../errors/HttpError';

describe('ImageEditorAiService', () => {
  const service = new ImageEditorAiService();

  it('requires prompt', async () => {
    await expect(service.edit({
      prompt: '   ',
      imageDataUrl: 'data:image/png;base64,abc',
    })).rejects.toMatchObject({
      statusCode: 400,
      message: 'prompt is required.',
    } satisfies Partial<HttpError>);
  });

  it('requires imageDataUrl', async () => {
    await expect(service.edit({
      prompt: 'Brighten the photo',
      imageDataUrl: '',
    })).rejects.toMatchObject({
      statusCode: 400,
      message: 'imageDataUrl is required.',
    } satisfies Partial<HttpError>);
  });

  it('rejects invalid data URLs', async () => {
    await expect(service.edit({
      prompt: 'Brighten the photo',
      imageDataUrl: 'not-a-data-url',
    })).rejects.toMatchObject({
      statusCode: 400,
      message: 'imageDataUrl must be a base64 data URL.',
    } satisfies Partial<HttpError>);
  });
});
