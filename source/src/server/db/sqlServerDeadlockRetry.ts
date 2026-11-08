const DEADLOCK_MESSAGE = /deadlock/i;

export const isSqlServerDeadlockError = (error: unknown): boolean => {
  if (!error) {
    return false;
  }
  const message = error instanceof Error ? error.message : String(error);
  if (DEADLOCK_MESSAGE.test(message) && /victim/i.test(message)) {
    return true;
  }
  if (/\b1205\b/.test(message)) {
    return true;
  }
  const parent = (error as { parent?: { number?: number } }).parent;
  return parent?.number === 1205;
};

/** Retry transient SQL Server deadlocks (error 1205) on read/write hot paths. */
export async function withSqlServerDeadlockRetry<T>(
  fn: () => Promise<T>,
  options?: { maxAttempts?: number; baseDelayMs?: number },
): Promise<T> {
  const maxAttempts = Math.max(1, options?.maxAttempts ?? 4);
  const baseDelayMs = Math.max(0, options?.baseDelayMs ?? 50);
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (!isSqlServerDeadlockError(error) || attempt >= maxAttempts) {
        throw error;
      }
      await new Promise((resolve) => {
        setTimeout(resolve, baseDelayMs * attempt);
      });
    }
  }

  throw lastError;
}
