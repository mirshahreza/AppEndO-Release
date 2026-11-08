export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR'
}

export type MethodLogConfig = {
  enabled?: boolean;
  minLevel: LogLevel;
};

export type LogRecord = {
  timestamp: string;
  actor: string;
  callSuccess: boolean | null;
  failureReason: string | null;
  durationMs: number | null;
  level: LogLevel;
  context: string;
  message: string;
  meta?: unknown;
};

export type LogSink = (entry: LogRecord) => void;

const LOG_LEVEL_WEIGHT: Record<LogLevel, number> = {
  [LogLevel.DEBUG]: 10,
  [LogLevel.INFO]: 20,
  [LogLevel.WARN]: 30,
  [LogLevel.ERROR]: 40,
};

export class Logger {
  private static instance: Logger;
  private sink: LogSink | null = null;
  private readonly methodConfigs = new Map<string, MethodLogConfig>();
  private readonly recentLogs: LogRecord[] = [];
  private maxBufferSize = 1000;
  private defaultMethodLoggingEnabled = true;

  private constructor() {}

  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  public setSink(sink: LogSink) {
    this.sink = sink;
  }

  public setBufferSize(size: number) {
    this.maxBufferSize = Math.max(100, Math.min(size, 5000));
  }

  public getRecentLogs(limit: number = 200): LogRecord[] {
    const safeLimit = Math.max(1, Math.min(limit, this.maxBufferSize));
    return this.recentLogs.slice(-safeLimit).reverse();
  }

  public clearRecentLogs() {
    this.recentLogs.length = 0;
  }

  public registerMethod(id: string, defaults?: Partial<MethodLogConfig>) {
    if (this.methodConfigs.has(id)) return;
    this.methodConfigs.set(id, {
      enabled: typeof defaults?.enabled === 'boolean' ? defaults.enabled : undefined,
      minLevel: defaults?.minLevel ?? LogLevel.DEBUG,
    });
  }

  public getMethodConfig(id: string): MethodLogConfig {
    const cfg = this.methodConfigs.get(id);
    return {
      enabled: typeof cfg?.enabled === 'boolean' ? cfg.enabled : this.defaultMethodLoggingEnabled,
      minLevel: cfg?.minLevel ?? LogLevel.DEBUG,
    };
  }

  public getMethodConfigRaw(id: string): MethodLogConfig {
    return this.methodConfigs.get(id) || { enabled: undefined, minLevel: LogLevel.DEBUG };
  }

  public setDefaultMethodLoggingEnabled(enabled: boolean) {
    this.defaultMethodLoggingEnabled = Boolean(enabled);
  }

  public getDefaultMethodLoggingEnabled() {
    return this.defaultMethodLoggingEnabled;
  }

  public setMethodConfig(id: string, config: Partial<MethodLogConfig>) {
    const current = this.getMethodConfigRaw(id);
    this.methodConfigs.set(id, {
      enabled: typeof config.enabled === 'boolean' ? config.enabled : current.enabled,
      minLevel: config.minLevel ?? current.minLevel,
    });
  }

  public setMethodConfigs(configs: Record<string, Partial<MethodLogConfig>>) {
    Object.entries(configs).forEach(([id, cfg]) => this.setMethodConfig(id, cfg));
  }

  public getMethodConfigs(): Record<string, MethodLogConfig> {
    const output: Record<string, MethodLogConfig> = {};
    this.methodConfigs.forEach((value, key) => {
      output[key] = { ...value };
    });
    return output;
  }

  public shouldLogMethod(id: string, level: LogLevel): boolean {
    const cfg = this.getMethodConfigRaw(id);
    const enabled = typeof cfg.enabled === 'boolean' ? cfg.enabled : this.defaultMethodLoggingEnabled;
    const minLevel = cfg.minLevel ?? LogLevel.DEBUG;
    return enabled && LOG_LEVEL_WEIGHT[level] >= LOG_LEVEL_WEIGHT[minLevel];
  }

  public log(level: LogLevel, context: string, message: string, meta?: any): void {
    const actor = (meta && typeof meta === 'object' && typeof meta.actor === 'string') ? meta.actor : 'SYSTEM';
    const callSuccess = (meta && typeof meta === 'object' && typeof meta.success === 'boolean') ? meta.success : null;
    const explicitFailureReason = (meta && typeof meta === 'object' && typeof meta.failureReason === 'string') ? meta.failureReason : null;
    const errorReason = (meta && typeof meta === 'object' && meta.err && typeof meta.err.message === 'string') ? meta.err.message : null;
    const failureReason = explicitFailureReason || errorReason;
    const durationMs = (meta && typeof meta === 'object' && typeof meta.durationMs === 'number' && Number.isFinite(meta.durationMs))
      ? meta.durationMs
      : null;
    const entry: LogRecord = {
      timestamp: new Date().toISOString(),
      actor,
      callSuccess,
      failureReason,
      durationMs,
      level,
      context,
      message,
      meta,
    };

    this.recentLogs.push(entry);
    if (this.recentLogs.length > this.maxBufferSize) {
      this.recentLogs.splice(0, this.recentLogs.length - this.maxBufferSize);
    }

    if (this.sink) {
      this.sink(entry);
      return;
    }

    const logStr = `[${entry.timestamp}] [${entry.level}] [${entry.context}] ${entry.message}`;
    if (entry.level === LogLevel.ERROR) {
      console.error(logStr, entry.meta || '');
      return;
    }
    if (entry.level === LogLevel.WARN) {
      console.warn(logStr, entry.meta || '');
      return;
    }
    console.log(logStr, entry.meta || '');
  }

  public debug(context: string, message: string, meta?: any) {
    this.log(LogLevel.DEBUG, context, message, meta);
  }

  public info(context: string, message: string, meta?: any) {
    this.log(LogLevel.INFO, context, message, meta);
  }

  public warn(context: string, message: string, meta?: any) {
    this.log(LogLevel.WARN, context, message, meta);
  }

  public error(context: string, message: string, meta?: any) {
    this.log(LogLevel.ERROR, context, message, meta);
  }
}

export const logger = Logger.getInstance();

// Interceptor decorator for dynamic method logging
export function LogMethod(options?: { id?: string; enabled?: boolean; minLevel?: LogLevel }) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    const className = target?.constructor?.name || 'UnknownClass';
    const methodId = options?.id || `${className}.${propertyKey}`;
    logger.registerMethod(methodId, {
      enabled: options?.enabled,
      minLevel: options?.minLevel,
    });

    descriptor.value = function (...args: any[]) {
      if (logger.shouldLogMethod(methodId, LogLevel.DEBUG)) {
        logger.debug(className, `Calling method: ${propertyKey}`, { methodId, args, success: null });
      }
      try {
        const result = originalMethod.apply(this, args);
        if (result instanceof Promise) {
          return result.then((res) => {
             if (logger.shouldLogMethod(methodId, LogLevel.DEBUG)) {
               logger.debug(className, `Method ${propertyKey} resolved`, { methodId, success: true });
             }
             return res;
          }).catch((err) => {
             if (logger.shouldLogMethod(methodId, LogLevel.ERROR)) {
               logger.error(className, `Method ${propertyKey} rejected`, {
                 methodId,
                 err,
                 success: false,
                 failureReason: err?.message || 'Promise rejected',
               });
             }
             throw err;
          });
        }
        if (logger.shouldLogMethod(methodId, LogLevel.DEBUG)) {
          logger.debug(className, `Method ${propertyKey} completed`, { methodId, success: true });
        }
        return result;
      } catch (err) {
        if (logger.shouldLogMethod(methodId, LogLevel.ERROR)) {
          logger.error(className, `Method ${propertyKey} threw an exception`, {
            methodId,
            err,
            success: false,
            failureReason: (err as any)?.message || 'Unhandled exception',
          });
        }
        throw err;
      }
    };
    return descriptor;
  };
}
