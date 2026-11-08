import { describe, expect, it } from 'vitest';
import {
  buildStructuredExtractUserPrompt,
  extractFieldValuesLocally,
  extractStructuredFieldValues,
  parseLabeledSourceText,
  parseStructuredExtractResponse,
} from '../buildStructuredExtractPrompt';

const schema = [
  { name: 'displayName', label: 'Display name', type: 'text' },
  { name: 'environment', label: 'Environment', type: 'select' },
  { name: 'notes', label: 'Notes', type: 'textarea' },
];

const sampleText = `Display name: Northwind API Gateway
Environment: production
Notes: Nightly sync job for operators in the EU region.`;

describe('buildStructuredExtractPrompt', () => {
  it('builds extract prompt with field schema and source text', () => {
    const prompt = buildStructuredExtractUserPrompt({
      text: 'Name: Northwind',
      fields: [{ name: 'displayName', label: 'Display name', type: 'text' }],
      sectionDescription: 'Deployment metadata',
    });

    expect(prompt).toContain('displayName');
    expect(prompt).toContain('Northwind');
    expect(prompt).toContain('Deployment metadata');
  });

  it('parses structured extract JSON by schema name', () => {
    const parsed = parseStructuredExtractResponse(
      '{"fields":[{"name":"displayName","value":"Northwind API"}]}',
      [{ name: 'displayName', label: 'Display name', type: 'text' }],
    );

    expect(parsed).toEqual([{ name: 'displayName', value: 'Northwind API' }]);
  });

  it('maps AI label keys to schema names', () => {
    const parsed = parseStructuredExtractResponse(
      '{"fields":[{"name":"Display name","value":"Northwind API"}]}',
      [{ name: 'displayName', label: 'Display name', type: 'text' }],
    );

    expect(parsed).toEqual([{ name: 'displayName', value: 'Northwind API' }]);
  });

  it('parses labeled source text without AI', () => {
    expect(parseLabeledSourceText(sampleText, schema)).toEqual([
      { name: 'displayName', value: 'Northwind API Gateway' },
      { name: 'environment', value: 'production' },
      { name: 'notes', value: 'Nightly sync job for operators in the EU region.' },
    ]);
  });

  it('falls back to labeled source text when AI JSON has no matches', () => {
    const parsed = extractStructuredFieldValues(
      '{"fields":[{"name":"unknown","value":"x"}]}',
      sampleText,
      schema,
    );

    expect(parsed).toEqual([
      { name: 'displayName', value: 'Northwind API Gateway' },
      { name: 'environment', value: 'production' },
      { name: 'notes', value: 'Nightly sync job for operators in the EU region.' },
    ]);
  });

  it('parses multiline notes after a label marker', () => {
    const text = `Display name: Northwind API Gateway
Environment: production
Notes: Line one of notes
Line two continues here.`;

    expect(parseLabeledSourceText(text, schema)).toEqual([
      { name: 'displayName', value: 'Northwind API Gateway' },
      { name: 'environment', value: 'production' },
      { name: 'notes', value: 'Line one of notes\nLine two continues here.' },
    ]);
  });

  it('strips BOM before labeled parsing', () => {
    const text = `\uFEFFDisplay name: Northwind API Gateway
Environment: production`;

    expect(parseLabeledSourceText(text, schema)).toEqual([
      { name: 'displayName', value: 'Northwind API Gateway' },
      { name: 'environment', value: 'production' },
    ]);
  });

  it('extractFieldValuesLocally works without server', () => {
    expect(extractFieldValuesLocally(sampleText, schema)).toEqual([
      { name: 'displayName', value: 'Northwind API Gateway' },
      { name: 'environment', value: 'production' },
      { name: 'notes', value: 'Nightly sync job for operators in the EU region.' },
    ]);
  });

  it('throws on invalid JSON when no labeled fallback exists', () => {
    expect(() => parseStructuredExtractResponse('not json', [
      { name: 'displayName', label: 'Display name', type: 'text' },
    ])).toThrow(/invalid JSON/i);
  });
});
