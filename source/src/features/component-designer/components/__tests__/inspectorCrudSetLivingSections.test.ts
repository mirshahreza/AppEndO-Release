import { describe, expect, it } from 'vitest';
import { CRUD_SET_CONFIG_GROUP_TITLES } from '../../../../domain/base-components/catalogInspectorGroups';
import { CRUD_SET_DEFAULT_SPEC } from '../../../../domain/component-designer/crudSetSpec';
import type { DesignerNode } from '../../../../domain/component-designer/types';
import { buildInspectorCrudSetLivingSections } from '../InspectorCrudSetLivingFields';

const node: DesignerNode = {
  id: 'crud-1',
  type: 'container',
  parentId: 'root',
  order: 0,
  props: { spec: { ...CRUD_SET_DEFAULT_SPEC } },
  layout: {},
  binding: {},
  children: [],
};

describe('CRUD Set Properties groups', () => {
  it('uses the same accordion titles as Base Components → CRUD Set', () => {
    const sections = buildInspectorCrudSetLivingSections(node, () => undefined);
    expect(sections.map((section) => section.title)).toEqual([...CRUD_SET_CONFIG_GROUP_TITLES]);
    expect(sections.some((section) => section.id === 'living-apis' && section.title === 'APIs')).toBe(true);
  });
});
