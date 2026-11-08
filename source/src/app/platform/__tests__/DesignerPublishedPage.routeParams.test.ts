import { describe, expect, it } from 'vitest';
import { buildRouteParamsFromRouter } from '../DesignerPublishedPage';

describe('DesignerPublishedPage route params', () => {
  it('uses the final splat segment as the record id for nested Studio routes', () => {
    expect(buildRouteParamsFromRouter({
      '*': 'studio/cms/contents/edit/42',
    })).toMatchObject({
      id: '42',
      editSlug: 'studio/cms/contents/edit/42',
    });
  });

  it('keeps direct wildcard record ids working', () => {
    expect(buildRouteParamsFromRouter({ '*': '42' }).id).toBe('42');
  });

  it('does not treat a nested list route as a record id', () => {
    expect(buildRouteParamsFromRouter({
      '*': 'studio/cms/contents',
    })).toEqual({});
  });
});
