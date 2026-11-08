import {
  changeReasonPolicySchema,
  type ChangeReasonPolicy,
} from '../../../shared/api/contracts/record-events';
import { builtinFunctionRegistry } from '../../services/builtinFunctionRegistry.service';

export const parseFunctionMetadataChangeReason = (
  metadataJson: unknown,
  fallback: ChangeReasonPolicy,
): ChangeReasonPolicy => {
  if (!metadataJson || typeof metadataJson !== 'object' || Array.isArray(metadataJson)) {
    return fallback;
  }
  const stored = (metadataJson as { changeReason?: unknown }).changeReason;
  if (stored === undefined) {
    return fallback;
  }
  const parsed = changeReasonPolicySchema.safeParse(stored);
  return parsed.success ? parsed.data : fallback;
};

export const resolveFunctionChangeReason = async (
  method: string,
  path: string,
  fallback: ChangeReasonPolicy,
): Promise<ChangeReasonPolicy> => {
  await builtinFunctionRegistry.ensureLoaded();
  const match = builtinFunctionRegistry.resolve(method, path);
  return parseFunctionMetadataChangeReason(match?.record.metadataJson, fallback);
};
