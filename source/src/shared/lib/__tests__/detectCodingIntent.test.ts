import { describe, expect, it } from 'vitest';
import {
  detectCodingIntent,
  detectContinuationIntent,
  detectExplicitServerFunctionOnlyIntent,
  detectImplementationIntent,
  detectInformationalQuery,
  detectServerFunctionIntent,
  detectUIIntent,
  looksLikeImplementationDump,
  resolveEffectiveUserIntent,
  shouldAutoSwitchAskToAgent,
  shouldPreferUIWorkflow,
} from '../detectCodingIntent';

describe('detectCodingIntent', () => {
  it('detects English development verbs', () => {
    expect(detectCodingIntent('Please create a new server function for users')).toBe(true);
    expect(detectCodingIntent('fix the grid column')).toBe(true);
    expect(detectCodingIntent('Build a CRUD for users')).toBe(true);
    expect(detectCodingIntent('Change the boolean column to an icon')).toBe(true);
  });

  it('returns false for short or Q&A-only text', () => {
    expect(detectCodingIntent('hi')).toBe(false);
    expect(detectCodingIntent('What is AppEndO?')).toBe(false);
    expect(detectCodingIntent('')).toBe(false);
    expect(detectCodingIntent('What is the grid standard?')).toBe(false);
  });
});

describe('detectInformationalQuery', () => {
  it('detects English lookup questions', () => {
    const userTest = 'ask: what is the grid standard? or where is VibeHarness defined?';
    expect(detectInformationalQuery(userTest)).toBe(true);
    expect(shouldAutoSwitchAskToAgent(userTest)).toBe(false);
    expect(detectInformationalQuery('Where is VibeHarness defined?')).toBe(true);
    expect(detectInformationalQuery('what is the grid standard?')).toBe(true);
  });

  it('does not block implementation requests', () => {
    expect(detectInformationalQuery('Build a CRUD with a grid')).toBe(false);
    expect(detectInformationalQuery('Can you build a UI for this function?')).toBe(false);
    expect(shouldAutoSwitchAskToAgent('Build a CRUD with a grid')).toBe(true);
  });
});

describe('detectContinuationIntent', () => {
  it('detects short continue affirmations', () => {
    expect(detectContinuationIntent('continue')).toBe(true);
    expect(detectContinuationIntent('go ahead')).toBe(true);
    expect(detectContinuationIntent('do it')).toBe(true);
    expect(detectContinuationIntent('try again')).toBe(true);
  });

  it('does not treat lookup questions as continuation', () => {
    expect(detectContinuationIntent('Where do I enable tools?')).toBe(false);
    expect(detectContinuationIntent('what can you do?')).toBe(false);
  });
});

describe('resolveEffectiveUserIntent', () => {
  it('returns the latest substantive request after a continuation turn', () => {
    const messages = [
      { role: 'user', content: 'Build a user interface for sum-two-numbers' },
      { role: 'assistant', content: 'Okay' },
      { role: 'user', content: 'try again' },
    ];
    expect(resolveEffectiveUserIntent(messages)).toBe('Build a user interface for sum-two-numbers');
  });

  it('uses page context when continuation follows only Q&A', () => {
    const messages = [
      { role: 'user', content: 'What can you do?' },
      { role: 'user', content: 'try again' },
    ];
    const effective = resolveEffectiveUserIntent(messages, {
      pageKey: 'server-functions',
      functionId: 'math.sum-two-numbers',
      functionName: 'sum-two-numbers',
    });
    expect(effective).toContain('sum-two-numbers');
    expect(detectUIIntent(effective)).toBe(true);
  });
});

describe('detectImplementationIntent', () => {
  it('detects create/build requests', () => {
    expect(detectImplementationIntent('Create a new function that adds two numbers')).toBe(true);
    expect(detectImplementationIntent('Create a POST endpoint for sum')).toBe(true);
  });

  it('returns false for Q&A without implementation verbs', () => {
    expect(detectImplementationIntent('What grid boolean column rule applies?')).toBe(false);
  });
});

describe('detectServerFunctionIntent', () => {
  it('detects server function wording', () => {
    expect(detectServerFunctionIntent('Create a new server function')).toBe(true);
    expect(detectServerFunctionIntent('Add a server function for users')).toBe(true);
  });

  it('does not treat bare UI requests as server function intent', () => {
    expect(detectServerFunctionIntent('Build a user interface')).toBe(false);
  });
});

describe('detectUIIntent', () => {
  it('detects UI and interface requests', () => {
    expect(detectUIIntent('build a user interface for this API')).toBe(true);
    expect(detectUIIntent('Build a user interface')).toBe(true);
    expect(detectUIIntent('Build a CRUD page with a grid and form')).toBe(true);
  });
});

describe('shouldPreferUIWorkflow', () => {
  it('prefers UI workflow on server-functions page context phrasing', () => {
    expect(shouldPreferUIWorkflow('Build a user interface')).toBe(true);
    expect(shouldPreferUIWorkflow('build user interface for sum-two-numbers')).toBe(true);
  });

  it('keeps backend-only requests on server function workflow', () => {
    expect(shouldPreferUIWorkflow('Create a new server function that adds two numbers')).toBe(false);
    expect(detectExplicitServerFunctionOnlyIntent('Create a new server function that adds two numbers')).toBe(true);
  });
});

describe('looksLikeImplementationDump', () => {
  it('detects fenced handler source in chat', () => {
    const dump = [
      'Here is the function:',
      '```typescript',
      'const edgeReq = req as EdgeReq;',
      'async function handler() { edgeRes.json({ success: true }); }',
      '```',
    ].join('\n');
    expect(looksLikeImplementationDump(dump)).toBe(true);
  });

  it('returns false for short explanations', () => {
    expect(looksLikeImplementationDump('Use draft_server_function to save managed functions.')).toBe(false);
  });
});
