/**
 * @vitest-environment jsdom
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import * as React from 'react';
import { render } from '@testing-library/react';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  CATALOG_AXIS_GROUP_TITLES,
  COMPOSITE_INSPECTOR_FAMILIES,
  SHARED_PROP_GROUP,
  resolveCatalogInspectorGroup,
} from '../../../domain/base-components/catalogInspectorGroups';
import { BASE_COMPONENT_CATALOG, getBaseComponentOptions } from '../catalog/baseComponentCatalog';
import { exportBaseComponentConfig } from '../catalog/exportBaseComponentConfig';
import { resolveBaseComponentConfig } from '../catalog/resolveBaseComponentConfig';
import type { BaseComponentOptionMeta } from '../catalog/baseComponentOptionTypes';
import { PRIMITIVE_SECTION_IDS } from '../catalog/sections/primitiveSections.options';
import { PrimitiveLivingPreview } from '../primitives/PrimitiveLivingPreview';
import type { SectionId } from '../types';

const productionOptions = BASE_COMPONENT_CATALOG.options.filter(
  (option) => option.disposition === 'public-prop' || option.disposition === 'composition-prop',
);

const primitiveIdSet = new Set<string>(PRIMITIVE_SECTION_IDS);

const alternateValue = (option: BaseComponentOptionMeta): unknown => {
  if (option.values && option.values.length > 0) {
    const next = option.values.find((value) => !Object.is(value, option.defaultValue));
    return next ?? option.defaultValue;
  }
  if (option.control === 'checkbox') return !option.defaultValue;
  if (typeof option.defaultValue === 'number') return option.defaultValue + 1;
  if (typeof option.defaultValue === 'string') {
    return option.defaultValue.length > 0 ? `${option.defaultValue}-changed` : 'changed';
  }
  if (Array.isArray(option.defaultValue) && option.defaultValue.length > 0) {
    return [...option.defaultValue, { id: 'changed', label: 'Changed', text: 'Changed' }];
  }
  return 'changed';
};

const renderPrimitive = (sectionId: string, values: Record<string, unknown>) => {
  const options = getBaseComponentOptions(sectionId);
  const resolution = resolveBaseComponentConfig(options, values);
  const exported = exportBaseComponentConfig(options, resolution.values);
  return render(
    <PrimitiveLivingPreview
      sectionId={sectionId as SectionId}
      label={sectionId}
      publicProps={exported.public}
    />,
  );
};

const FEATURE_ROOT = resolve(process.cwd(), 'src/features/base-components');
const SRC_ROOT = resolve(process.cwd(), 'src');
const PRIMITIVE_PREVIEW_SOURCE = readFileSync(
  resolve(FEATURE_ROOT, 'primitives/PrimitiveLivingPreview.tsx'),
  'utf8',
);

const SHARED_WORKSPACE_FILES: Record<string, string> = {
  'text-fields': 'form-fields/FormFieldsBaseComponentsWorkspace.tsx',
  'choice-fields': 'form-fields/FormFieldsBaseComponentsWorkspace.tsx',
  'selection-fields': 'form-fields/FormFieldsBaseComponentsWorkspace.tsx',
  'structured-fields': 'form-fields/FormFieldsBaseComponentsWorkspace.tsx',
  'ai-fields': 'form-fields/FormFieldsBaseComponentsWorkspace.tsx',
};

const isSourceFile = (candidate: string): boolean =>
  existsSync(candidate) && statSync(candidate).isFile() && !candidate.endsWith('.d.ts');

const resolveLocalImport = (fromFile: string, specifier: string): string | null => {
  const base = resolve(fromFile, '..', specifier);
  const candidates = [
    `${base}.ts`,
    `${base}.tsx`,
    resolve(base, 'index.ts'),
    resolve(base, 'index.tsx'),
    base,
  ];
  return candidates.find(isSourceFile) ?? null;
};

const collectImportedSources = (entryFile: string, seen: Set<string>): string => {
  if (seen.has(entryFile) || !existsSync(entryFile)) return '';
  seen.add(entryFile);
  const source = readFileSync(entryFile, 'utf8');
  let bundle = `\n/* ${entryFile} */\n${source}`;
  const importPattern = /import\s+(?:type\s+)?(?:\{([^}]*)\}|[\w*]+)\s+from\s+['"]([^'"]+)['"]/g;
  for (const match of source.matchAll(importPattern)) {
    const names = (match[1] ?? '').split(',').map((part) => part.trim().split(/\s+as\s+/).at(-1)).filter(Boolean);
    const specifier = match[2] ?? '';
    if (specifier.startsWith('.')) {
      const resolved = resolveLocalImport(entryFile, specifier);
      if (resolved && resolved.startsWith(SRC_ROOT) && !resolved.includes('__tests__')) {
        bundle += collectImportedSources(resolved, seen);
      }
      continue;
    }
    if (specifier.endsWith('/shared/ui') || specifier.endsWith('/ui')) {
      for (const name of names) {
        const candidate = resolve(SRC_ROOT, `shared/ui/${name}.tsx`);
        if (isSourceFile(candidate)) {
          bundle += `\n/* ${candidate} */\n${readFileSync(candidate, 'utf8')}`;
        }
      }
    }
  }
  return bundle;
};

const dedicatedWorkspaceSource = (componentId: string): string => {
  const mapped = SHARED_WORKSPACE_FILES[componentId];
  const entry = mapped
    ? resolve(FEATURE_ROOT, mapped)
    : (() => {
      const folder = resolve(FEATURE_ROOT, componentId);
      if (!existsSync(folder)) return '';
      const workspace = readdirSync(folder).find((name) => name.endsWith('Workspace.tsx'));
      return workspace ? resolve(folder, workspace) : '';
    })();
  if (!entry) return '';
  return collectImportedSources(entry, new Set());
};

const sourceMentionsProp = (source: string, option: BaseComponentOptionMeta): boolean => {
  const idLeaf = option.id.split('.').at(-1) ?? option.id;
  const pathLeaf = (option.propPath ?? option.id).split('.').at(-1) ?? option.id;
  return [option.id, option.propPath, idLeaf, pathLeaf]
    .filter((token): token is string => typeof token === 'string' && token.length >= 3)
    .some((token) => source.includes(token));
};

describe('all catalog option groups', () => {
  it('assigns every production option the shared axis or composite group', () => {
    const mismatches = productionOptions.filter((option) => {
      const expected = resolveCatalogInspectorGroup(option.id, undefined, option.axis);
      return option.inspectorGroup !== expected;
    });
    expect(mismatches.map((option) => `${option.id} → ${option.inspectorGroup}`)).toEqual([]);
  });

  it('keeps shared leaf properties in one group across components', () => {
    const conflicts: string[] = [];
    const byLeaf = new Map<string, Set<string>>();
    for (const option of productionOptions) {
      const leaf = option.id.split('.').at(-1) ?? option.id;
      const family = option.id.split('.')[1] ?? option.id;
      if (!SHARED_PROP_GROUP[leaf]) continue;
      if (COMPOSITE_INSPECTOR_FAMILIES[family]) continue;
      const group = option.inspectorGroup ?? '';
      const groups = byLeaf.get(leaf) ?? new Set<string>();
      groups.add(group);
      byLeaf.set(leaf, groups);
      if (group !== SHARED_PROP_GROUP[leaf]) {
        conflicts.push(`${option.id} is ${group}, expected ${SHARED_PROP_GROUP[leaf]}`);
      }
    }
    expect(conflicts).toEqual([]);
    for (const [leaf, groups] of byLeaf) {
      expect(groups, leaf).toEqual(new Set([SHARED_PROP_GROUP[leaf]]));
    }
  });

  it('does not invent inspector groups outside the axis ladder or composite families', () => {
    const allowed = new Set<string>([
      ...Object.values(CATALOG_AXIS_GROUP_TITLES),
      ...Object.values(COMPOSITE_INSPECTOR_FAMILIES),
    ]);
    const unexpected = productionOptions
      .map((option) => option.inspectorGroup ?? '')
      .filter((group) => group.length > 0 && !allowed.has(group));
    expect([...new Set(unexpected)].sort()).toEqual([]);
  });
});

describe('all primitive public props are live', () => {
  beforeAll(() => {
    Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
      configurable: true,
      value: () => ({
        fillStyle: '',
        fillRect: () => undefined,
        clearRect: () => undefined,
        getImageData: () => ({ data: [] }),
        putImageData: () => undefined,
        scale: () => undefined,
        setTransform: () => undefined,
      }),
    });
  });

  it.each(PRIMITIVE_SECTION_IDS)('%s has a real living preview, not a dump card', (sectionId) => {
    const { container } = renderPrimitive(sectionId, {});
    expect(container.querySelector('[data-bc-preview-fallback="dump"]')).toBeNull();
  });

  it.each(PRIMITIVE_SECTION_IDS)('%s public props are consumed by the living preview', (sectionId) => {
    const options = getBaseComponentOptions(sectionId).filter(
      (option) => option.disposition === 'public-prop',
    );
    const dead = options.filter((option) => !sourceMentionsProp(PRIMITIVE_PREVIEW_SOURCE, option)).map((option) => option.id);
    expect(dead).toEqual([]);
  });
});

describe('dedicated workspace catalogs stay wired', () => {
  const dedicatedComponents = BASE_COMPONENT_CATALOG.components
    .map((component) => component.id)
    .filter((id) => !primitiveIdSet.has(id));

  it.each(dedicatedComponents)('%s production propPaths appear in the living workspace', (componentId) => {
    const source = dedicatedWorkspaceSource(componentId);
    expect(source.length, `${componentId} workspace source`).toBeGreaterThan(0);
    const missing = getBaseComponentOptions(componentId)
      .filter((option) => option.disposition === 'public-prop' || option.disposition === 'composition-prop')
      .filter((option) => !sourceMentionsProp(source, option))
      .map((option) => option.id);
    expect(missing).toEqual([]);
  });
});
