import { MODEL_GATEWAY_TASK_PROFILE_POLICIES } from './modelGatewayPolicy';
import { probeModelGatewayTelemetryRedaction } from './modelGatewayTelemetry';
import { APPENDOO_PROMPT_TEMPLATES } from './promptRuntimeScaffold';

export type AppendooGatewayHealth = {
  ok: boolean;
  taskProfilePolicyCount: number;
  promptTemplateCount: number;
  telemetryRedactionOk: boolean;
  failures: string[];
};

/** AE-2.2 — lightweight gateway scaffold health probe for golden eval. */
export const probeAppendooGatewayScaffold = (): AppendooGatewayHealth => {
  const failures: string[] = [];
  const expectedProfiles = [
    'GENERAL_CHAT',
    'TOOL_SESSION',
    'INTENT_COMPILE',
    'SEMANTIC_GRADE',
  ] as const;

  for (const profile of expectedProfiles) {
    if (!MODEL_GATEWAY_TASK_PROFILE_POLICIES[profile]) {
      failures.push(`Missing task profile policy: ${profile}`);
    }
  }

  if (APPENDOO_PROMPT_TEMPLATES.length < 3) {
    failures.push('Expected at least 3 versioned prompt templates.');
  }

  const telemetryRedaction = probeModelGatewayTelemetryRedaction();
  if (!telemetryRedaction.ok) {
    failures.push(...telemetryRedaction.failures);
  }

  if (!APPENDOO_PROMPT_TEMPLATES.some((template) => template.taskProfile === 'TOOL_SESSION')) {
    failures.push('Missing TOOL_SESSION prompt template.');
  }

  return {
    ok: failures.length === 0,
    taskProfilePolicyCount: Object.keys(MODEL_GATEWAY_TASK_PROFILE_POLICIES).length,
    promptTemplateCount: APPENDOO_PROMPT_TEMPLATES.length,
    telemetryRedactionOk: telemetryRedaction.ok,
    failures,
  };
};
