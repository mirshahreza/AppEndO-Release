export type ApiCallFixture = {
  expectedStatus?: number | null;
  expectedBodyJson?: string;
};

export type ApiCallFixtureVerdict =
  | { state: 'unset' }
  | { state: 'pass' }
  | { state: 'fail'; reasons: string[] };

const deepEqual = (a: unknown, b: unknown): boolean => {
  if (a === b) {
    return true;
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((item, index) => deepEqual(item, b[index]));
  }
  if (
    a && b && typeof a === 'object' && typeof b === 'object'
    && !Array.isArray(a) && !Array.isArray(b)
  ) {
    const aRecord = a as Record<string, unknown>;
    const bRecord = b as Record<string, unknown>;
    const aKeys = Object.keys(aRecord);
    const bKeys = Object.keys(bRecord);
    return aKeys.length === bKeys.length && aKeys.every((key) => deepEqual(aRecord[key], bRecord[key]));
  }
  return false;
};

/**
 * Compares an API call's response against a saved fixture — status must match exactly, and every
 * key present in the expected body must deep-equal the same key in the actual body (partial/subset
 * match, not a full snapshot — an operator asserting on 2 fields shouldn't break on an unrelated
 * field the response starts including later). Used by the Data API operation tester.
 */
export const evaluateApiCallFixture = (
  output: Record<string, unknown> | null,
  fixture: ApiCallFixture | null | undefined,
): ApiCallFixtureVerdict => {
  const hasStatusExpectation = fixture?.expectedStatus != null;
  const trimmedBodyExpectation = fixture?.expectedBodyJson?.trim() ?? '';
  const hasBodyExpectation = trimmedBodyExpectation.length > 0;

  if (!hasStatusExpectation && !hasBodyExpectation) {
    return { state: 'unset' };
  }

  if (!output) {
    return { state: 'fail', reasons: ['No response yet — run it first.'] };
  }

  const reasons: string[] = [];
  const actualStatus = typeof output._httpStatus === 'number'
    ? output._httpStatus
    : (typeof output.status === 'number' ? output.status : null);

  if (hasStatusExpectation && actualStatus !== fixture!.expectedStatus) {
    reasons.push(`Expected status ${fixture!.expectedStatus}, got ${actualStatus ?? 'unknown'}.`);
  }

  if (hasBodyExpectation) {
    let expectedBody: Record<string, unknown> | null = null;
    try {
      const parsed = JSON.parse(trimmedBodyExpectation);
      expectedBody = parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? parsed as Record<string, unknown>
        : null;
    } catch {
      reasons.push('Expected body is not valid JSON.');
    }

    if (expectedBody) {
      const { _httpStatus, status, statusText, ...actualBody } = output;
      Object.entries(expectedBody).forEach(([key, expectedValue]) => {
        const actualValue = (actualBody as Record<string, unknown>)[key];
        if (!deepEqual(actualValue, expectedValue)) {
          reasons.push(`Key "${key}" mismatch: expected ${JSON.stringify(expectedValue)}, got ${JSON.stringify(actualValue)}.`);
        }
      });
    } else if (expectedBody === null && reasons.length === 0) {
      reasons.push('Expected body must be a JSON object.');
    }
  }

  return reasons.length > 0 ? { state: 'fail', reasons } : { state: 'pass' };
};
