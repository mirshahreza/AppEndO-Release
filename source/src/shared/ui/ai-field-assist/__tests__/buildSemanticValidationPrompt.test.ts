import { describe, expect, it } from 'vitest';
import { parseSemanticValidationModelJson } from '../buildSemanticValidationPrompt';

describe('parseSemanticValidationModelJson', () => {
  it('accepts Valid with empty reasons', () => {
    expect(parseSemanticValidationModelJson(JSON.stringify({
      ValidationResult: 'Valid',
      Reasons: [],
    }))).toEqual({ valid: true, reasons: [] });
  });

  it('returns reasons for Not Valid', () => {
    expect(parseSemanticValidationModelJson(JSON.stringify({
      ValidationResult: 'Not Valid',
      Reasons: ['Missing second reason'],
    }))).toEqual({
      valid: false,
      reasons: ['Missing second reason'],
    });
  });
});
