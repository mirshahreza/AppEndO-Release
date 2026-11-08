import type { AssistantRequestClass } from '../../api/contracts/ai/appendooGateway.types';
import { isAppendooTestEnvironment, isV1DirectWriteBlocked } from './appendooCutover';

export const APPENDOO_V1_ENGINEERING_GUARD_VERSION = '1.0.0';

export type AppendooEngineeringExecutionPath =
  | 'v3_pipeline'
  | 'v1_proposal_blocked'
  | 'v1_legacy_test_only';

/** AE-22.4 — resolve whether engineering execution uses V3 pipeline or agent-loop v1 path. */
export const resolveAppendooEngineeringExecutionPath = (input: {
  useEngineeringPipeline: boolean;
  requestClass?: AssistantRequestClass;
}): AppendooEngineeringExecutionPath => {
  // p-63 — pipeline routing is the gateway's decision and stands on its own; it no longer
  // depends on the (reopened) v1 write block. Non-pipeline turns use the v1 agent-loop path.
  if (input.useEngineeringPipeline) {
    return 'v3_pipeline';
  }

  return 'v1_legacy_test_only';
};

export const isV1EngineeringWritePathBlocked = (
  input: Parameters<typeof resolveAppendooEngineeringExecutionPath>[0],
): boolean => resolveAppendooEngineeringExecutionPath(input) === 'v3_pipeline';

export const describeAppendooEngineeringExecutionPath = (
  path: AppendooEngineeringExecutionPath,
): string => {
  switch (path) {
    case 'v3_pipeline':
      return 'V3 engineering pipeline (Workspace → Builders → Verification → Promotion)';
    case 'v1_proposal_blocked':
      return 'V1 proposal auto-apply blocked under cutover';
    case 'v1_legacy_test_only':
      return isAppendooTestEnvironment()
        ? 'V1 legacy path allowed in test environment only'
        : 'V1 legacy path (deprecated)';
  }
};
