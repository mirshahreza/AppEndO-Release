import type { RuntimeActivationKind } from '../../../lib/appendoo/runtimeActivationScaffold';

export type RuntimeActivationStatus = 'STAGED' | 'VALIDATED' | 'ACTIVATED' | 'FAILED';

export type RuntimeActivationRecord = {
  targetId: string;
  kind: RuntimeActivationKind;
  workspacePath: string;
  activationApi: string;
  status: RuntimeActivationStatus;
  activationRef?: string;
  errors: string[];
};

export type RuntimeActivationBatchResult = {
  records: RuntimeActivationRecord[];
  activatedCount: number;
  validatedCount: number;
  failedCount: number;
};

export const RUNTIME_ACTIVATION_VERSION = '1.0.0';
