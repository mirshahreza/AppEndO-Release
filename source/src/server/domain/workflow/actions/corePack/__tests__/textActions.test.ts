import { describe, expect, it } from 'vitest';
import { textTemplateExecutor } from '../textActions';

const fakeContext = {
  workflowInstanceId: 'i1',
  nodeInstanceId: 'n1',
  logicalInvocationId: 'l1',
  idempotencyKey: 'k1',
  effectiveIdentity: { type: 'SYSTEM' as const, id: null },
  cancellationSignal: new AbortController().signal,
  resolveSecret: async () => 'secret',
  logger: { info: () => {}, warn: () => {}, error: () => {} },
  writeTraceMetadata: () => {},
};

describe('text.template executor (p-99/WFT-10)', () => {
  it('renders using the templateEngine (nested paths + #each, not just flat keys)', async () => {
    const result = await textTemplateExecutor.execute(fakeContext, {}, {
      template: 'Hi {{user.name}}, you have {{#each items}}{{.}} {{/each}}items.',
      variables: { user: { name: 'Ada' }, items: ['x', 'y'] },
    });
    expect(result).toEqual({ status: 'SUCCEEDED', output: { text: 'Hi Ada, you have x y items.' } });
  });

  it('rejects a missing/wrong-typed template or variables input', async () => {
    const result = await textTemplateExecutor.execute(fakeContext, {}, { template: 123, variables: {} });
    expect(result).toMatchObject({ status: 'FAILED', errorCode: 'WF_EXEC_ACTION_OUTPUT_INVALID', errorClass: 'VALIDATION' });
  });

  it('maps an unclosed #each/#if into a VALIDATION failure, not an unhandled throw', async () => {
    const result = await textTemplateExecutor.execute(fakeContext, {}, { template: '{{#each items}}x', variables: { items: [] } });
    expect(result).toMatchObject({ status: 'FAILED', errorCode: 'TEXT_TEMPLATE_SYNTAX_INVALID', errorClass: 'VALIDATION' });
  });
});
