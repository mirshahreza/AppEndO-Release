import { describe, expect, it } from 'vitest';
import { evaluateApiCallFixture } from '../apiCallFixtureMatch';

describe('evaluateApiCallFixture', () => {
  it('reports unset when no expectation is configured', () => {
    expect(evaluateApiCallFixture({ ok: true }, undefined)).toEqual({ state: 'unset' });
    expect(evaluateApiCallFixture({ ok: true }, {})).toEqual({ state: 'unset' });
    expect(evaluateApiCallFixture({ ok: true }, { expectedBodyJson: '   ' })).toEqual({ state: 'unset' });
  });

  it('fails when there is no output yet', () => {
    const verdict = evaluateApiCallFixture(null, { expectedStatus: 200 });
    expect(verdict.state).toBe('fail');
  });

  it('passes when status matches and no body expectation is set', () => {
    const verdict = evaluateApiCallFixture({ _httpStatus: 201 }, { expectedStatus: 201 });
    expect(verdict).toEqual({ state: 'pass' });
  });

  it('fails when status does not match', () => {
    const verdict = evaluateApiCallFixture({ _httpStatus: 500 }, { expectedStatus: 200 });
    expect(verdict.state).toBe('fail');
    if (verdict.state === 'fail') {
      expect(verdict.reasons[0]).toContain('Expected status 200');
    }
  });

  it('passes on a partial/subset body match, ignoring extra actual fields', () => {
    const verdict = evaluateApiCallFixture(
      { _httpStatus: 200, id: 42, name: 'sum-two-numbers', extra: 'ignored' },
      { expectedStatus: 200, expectedBodyJson: '{"name":"sum-two-numbers"}' },
    );
    expect(verdict).toEqual({ state: 'pass' });
  });

  it('fails on a body key mismatch and reports it', () => {
    const verdict = evaluateApiCallFixture(
      { _httpStatus: 200, total: 3 },
      { expectedBodyJson: '{"total":4}' },
    );
    expect(verdict.state).toBe('fail');
    if (verdict.state === 'fail') {
      expect(verdict.reasons[0]).toContain('total');
    }
  });

  it('deep-compares nested objects and arrays regardless of key order', () => {
    const verdict = evaluateApiCallFixture(
      { _httpStatus: 200, data: { b: 2, a: 1 }, items: [1, 2, 3] },
      { expectedBodyJson: '{"data":{"a":1,"b":2},"items":[1,2,3]}' },
    );
    expect(verdict).toEqual({ state: 'pass' });
  });

  it('fails with a clear reason when expected body is not valid JSON', () => {
    const verdict = evaluateApiCallFixture({ _httpStatus: 200 }, { expectedBodyJson: '{not json' });
    expect(verdict.state).toBe('fail');
    if (verdict.state === 'fail') {
      expect(verdict.reasons[0]).toContain('not valid JSON');
    }
  });

  it('fails when the expected body is not a JSON object', () => {
    const verdict = evaluateApiCallFixture({ _httpStatus: 200 }, { expectedBodyJson: '[1,2,3]' });
    expect(verdict.state).toBe('fail');
    if (verdict.state === 'fail') {
      expect(verdict.reasons[0]).toContain('JSON object');
    }
  });
});
