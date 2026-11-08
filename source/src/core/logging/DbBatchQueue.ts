export type DbBatchQueueOptions<T> = {
  batchSize: number;
  flushIntervalMs: number;
  maxQueueSize: number;
  errorLabel: string;
  shouldEnqueue?: (item: T) => boolean;
  insertBatch: (batch: T[]) => Promise<void>;
};

export class DbBatchQueue<T> {
  private readonly batchSize: number;
  private readonly flushIntervalMs: number;
  private readonly maxQueueSize: number;
  private readonly errorLabel: string;
  private readonly shouldEnqueue: (item: T) => boolean;
  private readonly insertBatch: (batch: T[]) => Promise<void>;

  private readonly queue: T[] = [];
  private flushTimer: NodeJS.Timeout | null = null;
  private activeFlush: Promise<void> | null = null;
  private closed = false;
  private droppedCount = 0;

  constructor(options: DbBatchQueueOptions<T>) {
    this.batchSize = options.batchSize;
    this.flushIntervalMs = options.flushIntervalMs;
    this.maxQueueSize = options.maxQueueSize;
    this.errorLabel = options.errorLabel;
    this.shouldEnqueue = options.shouldEnqueue ?? (() => true);
    this.insertBatch = options.insertBatch;
  }

  start(): void {
    if (this.flushTimer || this.closed) return;
    this.flushTimer = setInterval(() => {
      if (this.queue.length === 0) return;
      void this.flush();
    }, this.flushIntervalMs);
    this.flushTimer.unref?.();
  }

  enqueue(item: T): void {
    if (this.closed || !this.shouldEnqueue(item)) {
      return;
    }

    if (this.queue.length >= this.maxQueueSize) {
      this.queue.shift();
      this.droppedCount += 1;
    }

    this.queue.push(item);

    if (this.queue.length >= this.batchSize) {
      void this.flush();
    }
  }

  async flush(): Promise<void> {
    if (this.closed && this.queue.length === 0) {
      return;
    }
    if (this.activeFlush) {
      await this.activeFlush;
      if (this.queue.length === 0) return;
    }

    this.activeFlush = this.flushInternal();
    try {
      await this.activeFlush;
    } finally {
      this.activeFlush = null;
    }
  }

  async shutdown(): Promise<void> {
    this.closed = true;
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    await this.flush();
  }

  getQueueSize(): number {
    return this.queue.length;
  }

  getDroppedCount(): number {
    return this.droppedCount;
  }

  private async flushInternal(): Promise<void> {
    while (this.queue.length > 0) {
      const batch = this.queue.splice(0, this.batchSize);
      this.reportDroppedIfNeeded();
      try {
        await this.insertBatch(batch);
      } catch (error) {
        console.error(`[${this.errorLabel}] Failed to write batch`, error);
        return;
      }
    }
  }

  private reportDroppedIfNeeded(): void {
    if (this.droppedCount === 0) return;
    const count = this.droppedCount;
    this.droppedCount = 0;
    console.error(`[${this.errorLabel}] Dropped ${count} queued item(s); queue limit is ${this.maxQueueSize}.`);
  }
}

export const createDbBatchQueue = <T>(options: DbBatchQueueOptions<T>): DbBatchQueue<T> => {
  const queue = new DbBatchQueue(options);
  queue.start();
  return queue;
};
