import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { createInitialDesignerState, designerReducer } from '../../../../domain/component-designer/state';
import { generateDesignerTsx, generateDesignerTsxMeta } from '../../../../domain/component-designer/codegen';
import { draftCompanionMetaPath, draftCompanionTsxPath, draftJsonPath } from '../draftFolderPaths';
import { writeDesignerDraftTsxExport } from '../draftTsxExport';
import { hydrateDraftRecordFromTsxSources } from '../draftTsxHydration';
import type { DesignerDraftRecord } from '../draftTypes';

let tmpDir = '';
let origCwd = '';

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'component-designer-hydration-'));
  origCwd = process.cwd();
  process.chdir(tmpDir);
  vi.resetModules();
});

afterEach(() => {
  process.chdir(origCwd);
  fs.rmSync(tmpDir, { recursive: true, force: true });
  vi.resetModules();
});

const createDraftRecord = (): DesignerDraftRecord => {
  const initial = createInitialDesignerState();
  const withSection = designerReducer(initial, {
    type: 'insert-palette-item',
    itemId: 'html.container',
    parentId: initial.document.rootNodeId,
  });
  const sectionId = withSection.document.nodes[withSection.document.rootNodeId].children[0];
  const withText = designerReducer(withSection, {
    type: 'insert-palette-item',
    itemId: 'html.text',
    parentId: sectionId,
  });
  const textNodeId = withText.document.nodes[sectionId].children[0];

  return {
    schema: 'component-designer-draft',
    id: withText.document.id,
    name: withText.document.name,
    folder: 'general',
    document: withText.document,
    bindingDefinitions: withText.bindingDefinitions,
    metadata: {
      createdAt: withText.document.metadata.createdAt,
      updatedAt: withText.document.metadata.updatedAt,
    },
  };
};

describe('draftTsxHydration', () => {
  it('hydrates document changes from companion TSX when meta sidecar and TSX are newer than draft JSON', () => {
    const record = createDraftRecord();
    const jsonPath = draftJsonPath(record.name, record.folder);
    fs.mkdirSync(path.dirname(jsonPath), { recursive: true });
    fs.writeFileSync(jsonPath, JSON.stringify(record, null, 2), 'utf8');

    const jsonMtime = fs.statSync(jsonPath).mtimeMs;
    writeDesignerDraftTsxExport(record);

    const companionTsxPath = draftCompanionTsxPath(record.name, record.folder);
    const companionMetaPath = draftCompanionMetaPath(record.name, record.folder);
    expect(fs.existsSync(companionTsxPath)).toBe(true);
    expect(fs.existsSync(companionMetaPath)).toBe(true);

    const sectionId = record.document.nodes[record.document.rootNodeId].children[0];
    const textNodeId = record.document.nodes[sectionId].children[0];
    const editedTsx = generateDesignerTsx(record.document, record.bindingDefinitions).replace(
      'Sample text',
      'Hydrated label',
    );

    fs.writeFileSync(companionTsxPath, editedTsx, 'utf8');
    fs.writeFileSync(companionMetaPath, generateDesignerTsxMeta(record.document, record.bindingDefinitions), 'utf8');
    fs.utimesSync(companionTsxPath, new Date(jsonMtime + 5_000), new Date(jsonMtime + 5_000));
    fs.utimesSync(companionMetaPath, new Date(jsonMtime + 5_000), new Date(jsonMtime + 5_000));

    const result = hydrateDraftRecordFromTsxSources(record);

    expect(result.companionTsx).toContain('GeneratedComponent');
    expect(result.hydratedFromTsx).toBe(true);
    expect(result.record.document.nodes[textNodeId]?.props.text).toBe('Hydrated label');
  });

  it('refuses to hydrate (and preserves the saved document) when the companion TSX reverse-parses to fewer nodes than the saved draft', () => {
    const record = createDraftRecord();
    const jsonPath = draftJsonPath(record.name, record.folder);
    fs.mkdirSync(path.dirname(jsonPath), { recursive: true });
    fs.writeFileSync(jsonPath, JSON.stringify(record, null, 2), 'utf8');

    const jsonMtime = fs.statSync(jsonPath).mtimeMs;
    writeDesignerDraftTsxExport(record);

    const companionTsxPath = draftCompanionTsxPath(record.name, record.folder);
    const companionMetaPath = draftCompanionMetaPath(record.name, record.folder);

    // Simulate a stale/incompatible companion TSX that reverse-parses to a near-empty
    // document (e.g. an older codegen shape the reverse parser doesn't fully understand).
    const blankDocument = createInitialDesignerState().document;
    const blankBindings = createInitialDesignerState().bindingDefinitions;
    const staleTsx = generateDesignerTsx(blankDocument, blankBindings);

    fs.writeFileSync(companionTsxPath, staleTsx, 'utf8');
    fs.writeFileSync(companionMetaPath, generateDesignerTsxMeta(record.document, record.bindingDefinitions), 'utf8');
    fs.utimesSync(companionTsxPath, new Date(jsonMtime + 5_000), new Date(jsonMtime + 5_000));
    fs.utimesSync(companionMetaPath, new Date(jsonMtime + 5_000), new Date(jsonMtime + 5_000));

    const result = hydrateDraftRecordFromTsxSources(record);

    const sectionId = record.document.nodes[record.document.rootNodeId].children[0];
    const textNodeId = record.document.nodes[sectionId].children[0];

    expect(result.hydratedFromTsx).toBe(false);
    expect(result.record.document.nodes[textNodeId]?.props.text).toBeDefined();
    expect(Object.keys(result.record.document.nodes).length).toBe(Object.keys(record.document.nodes).length);
  });
});
