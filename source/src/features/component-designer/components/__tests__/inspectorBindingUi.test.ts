import { describe, expect, it } from 'vitest';
import {
  resolvePropertyBindingSourceMode,
  resolvePropertyBindingValueSource,
  resolvePropBindingSourceKind,
  isManagedNodeBindingKey,
  PROP_BINDING_SOURCE_INDICATOR,
} from '../inspectorBindingUi';
import type { DesignerNode } from '../../../../domain/component-designer/types';
import { createPropertyBindingDefinition, propertyBindingKeyForProp } from '../../../../domain/component-designer/bindingEngine';
import { createRegionColumnBindingDefinition } from '../../../../domain/component-designer/bindingRegionEngine';
import { createStoreReadBindingDefinition } from '../../../../domain/component-designer/bindingStoreEngine';

const baseNode = (binding: DesignerNode['binding'] = {}): DesignerNode => ({
  id: 'node-1',
  type: 'element',
  parentId: null,
  order: 0,
  props: {},
  layout: {},
  children: [],
  binding,
});

describe('resolvePropertyBindingSourceMode', () => {
  it('prefers store when a store binding exists', () => {
    expect(resolvePropertyBindingSourceMode('/api/users', true, undefined, 'api')).toBe('store');
  });

  it('detects api mode from endpoint', () => {
    expect(resolvePropertyBindingSourceMode('/api/users', false)).toBe('api');
  });

  it('preserves api mode while endpoint is still being edited', () => {
    expect(resolvePropertyBindingSourceMode('', false, undefined, 'api')).toBe('api');
  });

  it('detects api mode from shared LOV reference', () => {
    expect(resolvePropertyBindingSourceMode('', false, 'countryOptions')).toBe('api');
  });

  it('defaults to state when no endpoint and no preferred mode', () => {
    expect(resolvePropertyBindingSourceMode('', false)).toBe('state');
  });
});

describe('resolvePropertyBindingValueSource', () => {
  it('prefers record field when region column binding exists', () => {
    expect(resolvePropertyBindingValueSource(true, 'api')).toBe('recordField');
  });

  it('maps store mode to store value source', () => {
    expect(resolvePropertyBindingValueSource(false, 'store')).toBe('store');
  });
});

describe('isManagedNodeBindingKey', () => {
  it('treats grid list resource as managed', () => {
    expect(isManagedNodeBindingKey('gridListResource')).toBe(true);
    expect(isManagedNodeBindingKey('regionDataSource')).toBe(true);
    expect(isManagedNodeBindingKey('customKey')).toBe(false);
  });
});

describe('resolvePropBindingSourceKind (T1-11f)', () => {
  it('returns null for a static unbound prop', () => {
    expect(resolvePropBindingSourceKind(baseNode(), 'value')).toBeNull();
  });

  it('detects region column bindings', () => {
    const node = baseNode({
      [propertyBindingKeyForProp('value')]: createRegionColumnBindingDefinition('value', 'FIRST_NAME'),
    });
    expect(resolvePropBindingSourceKind(node, 'value')).toBe('regionColumn');
    expect(PROP_BINDING_SOURCE_INDICATOR.regionColumn.dotClassName).toContain('sky');
  });

  it('detects store bindings', () => {
    const store = createStoreReadBindingDefinition('value', 'selection.countryId');
    const node = baseNode({
      [store.bindingKey]: store.definition,
    });
    expect(resolvePropBindingSourceKind(node, 'value')).toBe('store');
    expect(PROP_BINDING_SOURCE_INDICATOR.store.dotClassName).toContain('violet');
  });

  it('detects API bindings via fetch endpoint', () => {
    const node = baseNode({
      [propertyBindingKeyForProp('value')]: createPropertyBindingDefinition('value', 'user.email', {
        fetchEndpoint: '/api/users/me',
      }),
    });
    expect(resolvePropBindingSourceKind(node, 'value')).toBe('api');
    expect(PROP_BINDING_SOURCE_INDICATOR.api.dotClassName).toContain('indigo');
  });

  it('detects expression / page-data bindings', () => {
    const node = baseNode({
      [propertyBindingKeyForProp('value')]: createPropertyBindingDefinition('value', 'state.user.name'),
    });
    expect(resolvePropBindingSourceKind(node, 'value')).toBe('expression');
    expect(PROP_BINDING_SOURCE_INDICATOR.expression.dotClassName).toContain('amber');
  });

  it('prefers region column over other sources on the same prop', () => {
    const store = createStoreReadBindingDefinition('value', 'selection.id');
    const node = baseNode({
      [propertyBindingKeyForProp('value')]: createRegionColumnBindingDefinition('value', 'NAME'),
      [store.bindingKey]: store.definition,
    });
    expect(resolvePropBindingSourceKind(node, 'value')).toBe('regionColumn');
  });
});
