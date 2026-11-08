import { describe, expect, it } from 'vitest';
import {
  getTaskProfilePolicy,
  MODEL_GATEWAY_TASK_PROFILE_POLICIES,
  validateTaskProfileCapabilities,
} from '../modelGatewayPolicy';
import type { EffectiveModelCapabilities } from '../../../api/contracts/ai/appendooGateway.types';

describe('modelGatewayPolicy', () => {
  it('defines policy for every task profile', () => {
    const profiles = Object.keys(MODEL_GATEWAY_TASK_PROFILE_POLICIES);
    expect(profiles).toContain('TOOL_SESSION');
    expect(profiles).toContain('INTENT_COMPILE');
    expect(getTaskProfilePolicy('TOOL_SESSION').requiredCapabilities).toContain('tools');
  });

  it('requires tools capability for TOOL_SESSION', () => {
    const capabilities: EffectiveModelCapabilities = {
      modelId: 'chat-only',
      declaredChat: true,
      declaredStreaming: false,
      declaredTools: false,
      effectiveTools: false,
      effectiveStreaming: false,
    };

    const result = validateTaskProfileCapabilities('TOOL_SESSION', capabilities);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((error) => error.includes('tools'))).toBe(true);
    }
  });

  it('passes when effective tools are available', () => {
    const capabilities: EffectiveModelCapabilities = {
      modelId: 'tool-model',
      declaredChat: true,
      declaredStreaming: true,
      declaredTools: true,
      effectiveTools: true,
      effectiveStreaming: true,
    };

    expect(validateTaskProfileCapabilities('TOOL_SESSION', capabilities).ok).toBe(true);
  });
});
