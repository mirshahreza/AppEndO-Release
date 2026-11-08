import type { DesignerDiagnostic } from '../../../domain/component-designer/types';

export type DesignerDialogMode = 'save' | 'duplicate' | 'delete' | 'edit' | 'tags' | null;

export type DesignerPreviewRuntimeState = {
  isRunning: boolean;
  lastRunAt: string | null;
  diagnostics: DesignerDiagnostic[];
  results: Record<string, unknown>;
  logs: Array<{
    traceId?: string;
    sequence?: number;
    bindingKey: string;
    startedAt: string;
    finishedAt: string;
    endpoint: string;
    method: string;
    attempts: number;
    ok: boolean;
    status?: number;
    durationMs: number;
    errorCode?: string;
    errorMessage?: string;
    dependencies?: string[];
  }>;
};
