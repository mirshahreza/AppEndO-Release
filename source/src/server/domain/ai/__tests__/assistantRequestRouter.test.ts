import { describe, expect, it } from 'vitest';
import { routeAssistantRequest } from '../assistantRequestRouter';

describe('routeAssistantRequest', () => {
  it('routes ask mode without page context to TOOL_QUERY', () => {
    const result = routeAssistantRequest({
      mode: 'ask',
      userPrompt: 'What server functions exist?',
      executionProfile: 'ask_lookup',
    });

    expect(result.requestClass).toBe('TOOL_QUERY');
    expect(result.taskProfile).toBe('TOOL_SESSION');
    expect(result.useEngineeringPipeline).toBe(false);
  });

  it('routes ask mode with page context to CONTEXT_QUERY', () => {
    const result = routeAssistantRequest({
      mode: 'ask',
      userPrompt: 'Explain this page',
      executionProfile: 'ask_lookup',
      pageContext: { path: '/studio/server-functions', pageLabel: 'Server Functions' },
    });

    expect(result.requestClass).toBe('CONTEXT_QUERY');
    expect(result.taskProfile).toBe('PAGE_CONTEXT_QUERY');
  });

  it('routes plan mode to ENGINEERING_QUERY with PLAN task', () => {
    const result = routeAssistantRequest({
      mode: 'plan',
      userPrompt: 'Add CRM module',
      executionProfile: 'plan_authoring',
    });

    expect(result.requestClass).toBe('ENGINEERING_QUERY');
    expect(result.taskProfile).toBe('PLAN');
    expect(result.useEngineeringPipeline).toBe(false);
  });

  it('routes agent implement to ENGINEERING_CHANGE via agent-loop (no pipeline by default)', () => {
    const result = routeAssistantRequest({
      mode: 'agent',
      userPrompt: 'Create a server function to list users',
      executionProfile: 'agent_implement',
    });

    expect(result.requestClass).toBe('ENGINEERING_CHANGE');
    expect(result.taskProfile).toBe('TOOL_SESSION');
    expect(result.useEngineeringPipeline).toBe(false);
  });

  it('routes governed agent implement to engineering pipeline', () => {
    const result = routeAssistantRequest({
      mode: 'agent',
      userPrompt: 'Export this to package with architect approval',
      executionProfile: 'agent_implement',
    });

    expect(result.requestClass).toBe('ENGINEERING_CHANGE');
    expect(result.taskProfile).toBe('INTENT_COMPILE');
    expect(result.useEngineeringPipeline).toBe(true);
  });

  it('routes agent_implement_governed profile to pipeline without regex fallback', () => {
    const result = routeAssistantRequest({
      mode: 'agent',
      userPrompt: 'Build users CRUD',
      executionProfile: 'agent_implement_governed',
    });

    expect(result.requestClass).toBe('ENGINEERING_CHANGE');
    expect(result.taskProfile).toBe('INTENT_COMPILE');
    expect(result.useEngineeringPipeline).toBe(true);
  });

  it('routes agent lookup to ENGINEERING_QUERY', () => {
    const result = routeAssistantRequest({
      mode: 'agent',
      userPrompt: 'How does auth work?',
      executionProfile: 'agent_lookup',
    });

    expect(result.requestClass).toBe('ENGINEERING_QUERY');
    expect(result.useEngineeringPipeline).toBe(false);
  });

  it('routes platform job requests to OPERATIONAL_ACTION', () => {
    const result = routeAssistantRequest({
      mode: 'agent',
      userPrompt: 'Create a platform job to rebuild search indexes.',
      executionProfile: 'agent_lookup',
    });

    expect(result.requestClass).toBe('OPERATIONAL_ACTION');
    expect(result.useEngineeringPipeline).toBe(false);
  });
});
