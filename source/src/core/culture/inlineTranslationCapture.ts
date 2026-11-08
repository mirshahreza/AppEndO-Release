const listeners = new Set<() => void>();

let captureActive = false;

/** Keys resolved via `t()` during the current capture pass (key → displayed text). */
let pendingKeys = new Map<string, string>();

export function isInlineTranslationCaptureActive(): boolean {
  return captureActive;
}

export function setInlineTranslationCaptureActive(value: boolean): void {
  if (captureActive === value) {
    return;
  }
  captureActive = value;
  if (!value) {
    pendingKeys.clear();
  }
  for (const listener of listeners) {
    listener();
  }
}

export function subscribeInlineTranslationCapture(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function noteInlineTranslationKey(key: string, displayed: string): void {
  if (!captureActive) {
    return;
  }
  const normalizedKey = key.trim();
  if (!normalizedKey) {
    return;
  }
  pendingKeys.set(normalizedKey, displayed);
}

export function takePendingInlineTranslationKeys(): Map<string, string> {
  const snapshot = new Map(pendingKeys);
  pendingKeys.clear();
  return snapshot;
}
