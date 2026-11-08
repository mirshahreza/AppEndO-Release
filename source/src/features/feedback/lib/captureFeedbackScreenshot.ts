import { domToBlob } from 'modern-screenshot';

export class FeedbackScreenshotError extends Error {
  constructor(
    public readonly code: 'unsupported' | 'cancelled' | 'capture_failed',
    message: string,
  ) {
    super(message);
    this.name = 'FeedbackScreenshotError';
  }
}

export type CaptureFeedbackScreenshotOptions = {
  /** Runs before the frame is read (e.g. hide the feedback panel). */
  beforeFrameCapture?: () => void | Promise<void>;
};

const FEEDBACK_PANEL_MARKER = 'feedback-submit';

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });

const waitForPaint = (): Promise<void> =>
  new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve());
    });
  });

const resolveCaptureTarget = (): HTMLElement => {
  const shell = document.querySelector<HTMLElement>('[data-admin-shell-root]');
  if (shell) {
    return shell;
  }
  return document.body;
};

const shouldIncludeDomNode = (node: Node): boolean => {
  if (!(node instanceof Element)) {
    return true;
  }
  if (node.closest(`[data-floating-panel-marker="${FEEDBACK_PANEL_MARKER}"]`)) {
    return false;
  }
  return true;
};

const blobToScreenshotFile = (blob: Blob): File => {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const type = blob.type || 'image/png';
  const extension = type.includes('jpeg') ? 'jpg' : 'png';
  return new File([blob], `screenshot-${stamp}.${extension}`, { type });
};

const captureDomScreenshot = async (
  options?: CaptureFeedbackScreenshotOptions,
): Promise<File> => {
  if (options?.beforeFrameCapture) {
    await options.beforeFrameCapture();
  }
  await waitForPaint();
  await sleep(200);

  const target = resolveCaptureTarget();
  const scale = Math.min(window.devicePixelRatio || 1, 2);
  const blob = await domToBlob(target, {
    scale,
    filter: shouldIncludeDomNode,
  });

  if (!blob || blob.size <= 0) {
    throw new FeedbackScreenshotError('capture_failed', 'Could not encode screenshot.');
  }
  return blobToScreenshotFile(blob);
};

const waitForVideoDimensions = (
  video: HTMLVideoElement,
  timeoutMs = 5000,
): Promise<void> => {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      if (video.videoWidth > 0 && video.videoHeight > 0) {
        resolve();
        return;
      }
      if (Date.now() - started > timeoutMs) {
        reject(new FeedbackScreenshotError('capture_failed', 'Timed out waiting for video frame.'));
        return;
      }
      requestAnimationFrame(tick);
    };
    tick();
  });
};

const grabFrameWithImageCapture = async (track: MediaStreamTrack): Promise<HTMLCanvasElement | null> => {
  const ImageCaptureCtor = (globalThis as typeof globalThis & {
    ImageCapture?: typeof ImageCapture;
  }).ImageCapture;
  if (!ImageCaptureCtor) {
    return null;
  }
  try {
    const capture = new ImageCaptureCtor(track);
    const bitmap = await capture.grabFrame();
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext('2d');
    if (!context || canvas.width <= 0 || canvas.height <= 0) {
      bitmap.close();
      return null;
    }
    context.drawImage(bitmap, 0, 0);
    bitmap.close();
    return canvas;
  } catch {
    return null;
  }
};

const grabFrameWithVideoElement = async (stream: MediaStream): Promise<HTMLCanvasElement> => {
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.autoplay = true;
  video.setAttribute('playsinline', 'true');
  video.style.position = 'fixed';
  video.style.width = '1px';
  video.style.height = '1px';
  video.style.opacity = '0';
  video.style.pointerEvents = 'none';
  document.body.appendChild(video);

  try {
    video.srcObject = stream;
    await video.play().catch(() => undefined);
    await waitForVideoDimensions(video);
    await waitForPaint();
    await sleep(120);

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext('2d');
    if (!context || canvas.width <= 0 || canvas.height <= 0) {
      throw new FeedbackScreenshotError('capture_failed', 'Could not read screenshot frame.');
    }
    context.drawImage(video, 0, 0);
    return canvas;
  } finally {
    video.pause();
    video.srcObject = null;
    video.remove();
  }
};

const grabFrameFromStream = async (stream: MediaStream): Promise<HTMLCanvasElement> => {
  const track = stream.getVideoTracks()[0];
  if (!track) {
    throw new FeedbackScreenshotError('capture_failed', 'No video track in capture stream.');
  }

  const fromImageCapture = await grabFrameWithImageCapture(track);
  if (fromImageCapture) {
    return fromImageCapture;
  }
  return grabFrameWithVideoElement(stream);
};

const canvasToImageFile = (canvas: HTMLCanvasElement): Promise<File> =>
  new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new FeedbackScreenshotError('capture_failed', 'Could not encode screenshot.'));
        return;
      }
      resolve(blobToScreenshotFile(blob));
    }, 'image/png');
  });

const requestDisplayStream = async (): Promise<MediaStream> => {
  const mediaDevices = navigator.mediaDevices;
  if (!mediaDevices?.getDisplayMedia) {
    throw new FeedbackScreenshotError('unsupported', 'Screen capture is not supported in this browser.');
  }

  try {
    return await mediaDevices.getDisplayMedia({ video: true, audio: false });
  } catch (err) {
    const name = err instanceof DOMException ? err.name : '';
    if (name === 'NotAllowedError' || name === 'AbortError') {
      throw new FeedbackScreenshotError('cancelled', 'Screenshot capture was cancelled.');
    }
    throw new FeedbackScreenshotError('capture_failed', 'Screen capture failed.');
  }
};

const captureDisplayMediaScreenshot = async (
  options?: CaptureFeedbackScreenshotOptions,
): Promise<File> => {
  let stream: MediaStream | null = null;
  try {
    stream = await requestDisplayStream();
    if (options?.beforeFrameCapture) {
      await options.beforeFrameCapture();
      await waitForPaint();
      await sleep(150);
    }
    const canvas = await grabFrameFromStream(stream);
    return await canvasToImageFile(canvas);
  } finally {
    stream?.getTracks().forEach((track) => track.stop());
  }
};

/**
 * Captures the current Studio shell for feedback attachments.
 * Prefers in-page DOM capture (no browser picker); falls back to Screen Capture API.
 */
export const captureFeedbackScreenshotFile = async (
  options?: CaptureFeedbackScreenshotOptions,
): Promise<File> => {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    throw new FeedbackScreenshotError('unsupported', 'Screen capture is not supported in this browser.');
  }

  try {
    return await captureDomScreenshot(options);
  } catch (domError) {
    if (domError instanceof FeedbackScreenshotError && domError.code === 'cancelled') {
      throw domError;
    }
    try {
      return await captureDisplayMediaScreenshot(options);
    } catch (displayError) {
      if (displayError instanceof FeedbackScreenshotError) {
        throw displayError;
      }
      if (domError instanceof FeedbackScreenshotError) {
        throw domError;
      }
      throw new FeedbackScreenshotError('capture_failed', 'Screenshot capture failed.');
    }
  }
};
