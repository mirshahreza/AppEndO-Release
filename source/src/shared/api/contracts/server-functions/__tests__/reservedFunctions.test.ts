import { describe, expect, it } from 'vitest';
import { mapApiFunction, mergeFunctionsCatalog } from '../mappers';
import {
  isCatalogHiddenServerFunction,
  isHiddenServerFunctionEditSlug,
  RESERVED_SCHEDULED_START_FUNCTION_ID,
} from '../reservedFunctions';

describe('reservedFunctions', () => {
  it('flags the workflow scheduled-start entry point as hidden', () => {
    expect(isCatalogHiddenServerFunction({ id: RESERVED_SCHEDULED_START_FUNCTION_ID })).toBe(true);
    expect(isCatalogHiddenServerFunction({ id: 'custom.hello' })).toBe(false);
    expect(isHiddenServerFunctionEditSlug('workflow-engine/scheduled-start')).toBe(true);
    expect(isHiddenServerFunctionEditSlug('workflow-engine.scheduled-start')).toBe(true);
    expect(isHiddenServerFunctionEditSlug('custom/hello')).toBe(false);
  });

  it('drops hidden managed functions from the merged catalog', () => {
    const custom = [
      mapApiFunction({
        id: RESERVED_SCHEDULED_START_FUNCTION_ID,
        name: 'scheduled-start',
        folder: 'workflow-engine',
        method: 'POST',
        path: '/system/workflow-engine/scheduled-start',
        code: '// reserved',
      }),
      mapApiFunction({
        id: 'custom.hello',
        name: 'hello',
        folder: 'custom',
        method: 'GET',
        path: '/api/custom/hello',
        code: '// hello',
      }),
    ];

    const merged = mergeFunctionsCatalog([], custom);
    expect(merged.some((fn) => fn.id === RESERVED_SCHEDULED_START_FUNCTION_ID)).toBe(false);
    expect(merged.some((fn) => fn.id === 'custom.hello')).toBe(true);
  });
});
