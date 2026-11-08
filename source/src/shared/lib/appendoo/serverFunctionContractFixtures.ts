import type { ContextPack } from '../../api/contracts/appendoo/contextPack.types';

export type ServerFunctionContractField = {
  fieldId: string;
  contractPath: string;
  label: string;
  required: boolean;
  type: 'number' | 'string' | 'enum' | 'object';
  enumValues?: string[];
};

export type ServerFunctionContractFixture = {
  canonicalId: string;
  displayName: string;
  fingerprint: string;
  inputFields: ServerFunctionContractField[];
  outputFields: ServerFunctionContractField[];
  permissions: string[];
  errors: Array<{ code: string; message: string }>;
  analogousUiRef: string;
  packageOwner: string;
};

/** GE-SF-UI-001 fixture — known function with full contract for vertical slice eval. */
export const MATH_SUM_TWO_NUMBERS_FIXTURE: ServerFunctionContractFixture = {
  canonicalId: 'math.sum-two-numbers',
  displayName: 'sum-two-numbers',
  fingerprint: 'sf:math.sum-two-numbers:v1',
  inputFields: [
    {
      fieldId: 'a',
      contractPath: 'input.a',
      label: 'First number',
      required: true,
      type: 'number',
    },
    {
      fieldId: 'b',
      contractPath: 'input.b',
      label: 'Second number',
      required: true,
      type: 'number',
    },
    {
      fieldId: 'mode',
      contractPath: 'input.mode',
      label: 'Operation mode',
      required: false,
      type: 'enum',
      enumValues: ['add', 'subtract'],
    },
  ],
  outputFields: [
    {
      fieldId: 'result',
      contractPath: 'output.result',
      label: 'Result',
      required: true,
      type: 'number',
    },
    {
      fieldId: 'expression',
      contractPath: 'output.expression',
      label: 'Expression',
      required: true,
      type: 'string',
    },
  ],
  permissions: ['server-function:math.sum-two-numbers:execute'],
  errors: [
    { code: 'VALIDATION_ERROR', message: 'Both numbers are required.' },
  ],
  analogousUiRef: 'src/features/math/components/SumTwoNumbersCalculator.tsx',
  packageOwner: 'math',
};

export const SERVER_FUNCTION_UI_FIXTURES: Record<string, ServerFunctionContractFixture> = {
  [MATH_SUM_TWO_NUMBERS_FIXTURE.canonicalId]: MATH_SUM_TWO_NUMBERS_FIXTURE,
};

export const resolveServerFunctionFixture = (
  canonicalId: string,
): ServerFunctionContractFixture | undefined => (
  SERVER_FUNCTION_UI_FIXTURES[canonicalId.trim()]
);

export const enrichContextPackForServerFunctionFixture = (
  pack: ContextPack,
  fixture: ServerFunctionContractFixture,
): ContextPack => ({
  ...pack,
  permissions: Array.from(new Set([...pack.permissions, ...fixture.permissions])),
  structuralEvidence: Array.from(new Set([
    ...pack.structuralEvidence,
    `contract:${fixture.canonicalId}:input`,
    `contract:${fixture.canonicalId}:output`,
    `contract:${fixture.canonicalId}:errors`,
  ])),
  similarImplementations: Array.from(new Set([
    ...pack.similarImplementations,
    fixture.analogousUiRef,
  ])),
  selectionExplanations: [
    ...pack.selectionExplanations,
    {
      reasonCode: 'EXACT_TARGET',
      evidenceId: `function:${fixture.canonicalId}`,
      summary: `Resolved server function ${fixture.displayName}.`,
    },
    {
      reasonCode: 'PERMISSION',
      evidenceId: fixture.permissions[0] ?? `permission:${fixture.canonicalId}`,
      summary: 'Function execute permission.',
    },
    {
      reasonCode: 'SIMILAR_FEATURE',
      evidenceId: fixture.analogousUiRef,
      summary: 'Analogous UI implementation.',
    },
  ],
});
