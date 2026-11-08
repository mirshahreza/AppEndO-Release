import { describe, expect, it } from 'vitest';
import {
  isV1EngineeringWritePathBlocked,
  resolveAppendooEngineeringExecutionPath,
} from '../appendooV1EngineeringGuard';

describe('appendooV1EngineeringGuard', () => {
  it('routes engineering pipeline to v3 under cutover', () => {
    expect(resolveAppendooEngineeringExecutionPath({
      useEngineeringPipeline: true,
      requestClass: 'ENGINEERING_CHANGE',
    })).toBe('v3_pipeline');

    expect(isV1EngineeringWritePathBlocked({
      useEngineeringPipeline: true,
      requestClass: 'ENGINEERING_CHANGE',
    })).toBe(true);
  });

  it('allows agent-loop path for ENGINEERING_CHANGE without governed pipeline', () => {
    expect(resolveAppendooEngineeringExecutionPath({
      useEngineeringPipeline: false,
      requestClass: 'ENGINEERING_CHANGE',
    })).toBe('v1_legacy_test_only');

    expect(isV1EngineeringWritePathBlocked({
      useEngineeringPipeline: false,
      requestClass: 'ENGINEERING_CHANGE',
    })).toBe(false);
  });
});
