/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from 'vitest';
import { waitFor } from '@testing-library/react';
import {
  hidePickFileUploadProgress,
  showPickFileUploadProgress,
  updatePickFileUploadProgress,
} from '../designerGridPickFileUploadProgress';

describe('designerGridPickFileUploadProgress', () => {
  it('shows determinate progress while uploading multiple files', async () => {
    showPickFileUploadProgress(2);
    updatePickFileUploadProgress({
      completed: 0,
      currentFileName: 'photo-a.png',
      phase: 'uploading',
      withinFileRatio: 0.5,
    });

    await waitFor(() => {
      expect(document.querySelector('[data-pick-file-upload-progress]')).not.toBeNull();
      expect(document.body.textContent).toContain('Uploading 1 of 2: photo-a.png');
      expect(document.body.textContent).toMatch(/25%/);
    });

    updatePickFileUploadProgress({
      completed: 1,
      currentFileName: 'photo-b.png',
      phase: 'preparing',
      withinFileRatio: 0.1,
    });

    await waitFor(() => {
      expect(document.body.textContent).toContain('Preparing photo-b.png');
    });

    hidePickFileUploadProgress();
    expect(document.querySelector('[data-pick-file-upload-progress]')).toBeNull();

    showPickFileUploadProgress(1);
    await waitFor(() => {
      expect(document.querySelector('[data-pick-file-upload-progress]')).not.toBeNull();
    });
    hidePickFileUploadProgress();
    expect(document.querySelector('[data-pick-file-upload-progress]')).toBeNull();
  });
});
