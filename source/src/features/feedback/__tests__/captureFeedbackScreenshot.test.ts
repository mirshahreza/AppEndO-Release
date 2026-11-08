import { describe, expect, it } from 'vitest';

import {
  captureFeedbackScreenshotFile,
  FeedbackScreenshotError,
} from '../lib/captureFeedbackScreenshot';

describe('captureFeedbackScreenshotFile', () => {
  it('throws unsupported when getDisplayMedia is missing', async () => {
    const original = navigator.mediaDevices;
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: undefined,
    });
    await expect(captureFeedbackScreenshotFile()).rejects.toMatchObject({
      code: 'unsupported',
    } satisfies Partial<FeedbackScreenshotError>);
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: original,
    });
  });
});
