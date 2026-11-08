import { describe, expect, it } from 'vitest';
import { resolveTurnExecutionProfile } from '../../../../core/ai/agent/turnExecutionProfile';
import {
  buildPageContextContinuationIntent,
  detectContinuationIntent,
  detectUIIntent,
  resolveEffectiveUserIntent,
} from '../../../../shared/lib/detectCodingIntent';
import { routeAssistantRequest } from '../assistantRequestRouter';

const sumTwoNumbersPageContext = {
  path: '/us/studio/server-functions/math/sum-two-numbers',
  pageKey: 'server-functions',
  pageLabel: 'Server Functions',
  functionId: 'math.sum-two-numbers',
  functionName: 'sum-two-numbers',
};

describe('AppEndoo English continuation on server-functions page', () => {
  it('treats "try again" as implementation continuation', () => {
    expect(detectContinuationIntent('try again')).toBe(true);
    expect(resolveTurnExecutionProfile('agent', 'try again')).toBe('agent_implement');
  });

  it('infers UI build intent from open function when chat only had Q&A', () => {
    const messages = [
      { role: 'user', content: 'What can you do?' },
      { role: 'assistant', content: 'I can build a UI.' },
      { role: 'user', content: 'Where do I enable tools?' },
      { role: 'assistant', content: 'Stay in Agent mode.' },
      { role: 'user', content: 'try again' },
    ];

    const effective = resolveEffectiveUserIntent(messages, sumTwoNumbersPageContext);
    expect(detectUIIntent(effective)).toBe(true);
    expect(effective).toContain('sum-two-numbers');
  });

  it('routes continuation with page context to agent-loop (not pipeline)', () => {
    const routingPrompt = resolveEffectiveUserIntent(
      [{ role: 'user', content: 'try again' }],
      sumTwoNumbersPageContext,
    );

    const routing = routeAssistantRequest({
      mode: 'agent',
      userPrompt: routingPrompt,
      executionProfile: resolveTurnExecutionProfile('agent', 'try again'),
      pageContext: sumTwoNumbersPageContext,
    });

    expect(routing.requestClass).toBe('ENGINEERING_CHANGE');
    expect(routing.useEngineeringPipeline).toBe(false);
    expect(routing.taskProfile).toBe('TOOL_SESSION');
  });

  it('buildPageContextContinuationIntent targets the open server function', () => {
    const intent = buildPageContextContinuationIntent(sumTwoNumbersPageContext);
    expect(intent).toContain('math.sum-two-numbers');
    expect(detectUIIntent(intent!)).toBe(true);
  });

  it('infers UI intent from path + functionId without pageKey enrichment', () => {
    const pageContext = {
      path: '/us/studio/server-functions/math/sum-two-numbers',
      functionId: 'math.sum-two-numbers',
      functionName: 'sum-two-numbers',
    };
    const effective = resolveEffectiveUserIntent(
      [{ role: 'user', content: 'try again' }],
      pageContext,
    );
    expect(effective).toContain('math.sum-two-numbers');
    expect(detectUIIntent(effective)).toBe(true);

    const routing = routeAssistantRequest({
      mode: 'agent',
      userPrompt: effective,
      executionProfile: resolveTurnExecutionProfile('agent', 'try again'),
      pageContext,
    });
    expect(routing.useEngineeringPipeline).toBe(false);
    expect(routing.requestClass).toBe('ENGINEERING_CHANGE');
  });
});
