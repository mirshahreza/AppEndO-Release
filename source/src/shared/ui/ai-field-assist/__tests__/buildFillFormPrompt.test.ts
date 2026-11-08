import { describe, expect, it } from 'vitest';
import { filterEuaFieldsBySection } from '../buildFillFormPrompt';

const fields = [
  { name: 'a', label: 'A', type: 'text', sectionId: 'sec-1' },
  { name: 'b', label: 'B', type: 'text', sectionId: 'sec-2' },
  { name: 'c', label: 'C', type: 'text' },
];

describe('buildFillFormPrompt', () => {
  it('filterEuaFieldsBySection returns all fields when sectionId omitted', () => {
    expect(filterEuaFieldsBySection(fields)).toHaveLength(3);
  });

  it('filterEuaFieldsBySection keeps matching section and unscoped fields', () => {
    expect(filterEuaFieldsBySection(fields, 'sec-1').map((field) => field.name)).toEqual(['a', 'c']);
  });
});
