import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import fs from 'fs';

import os from 'os';

import path from 'path';

import { createInitialDesignerState, designerReducer } from '../../../../domain/component-designer/state';
import { buildSlotPaletteItems } from '../../../../domain/component-designer/slotPalette';
import { CORE_SLOT_CATALOG } from '../../../../shared/api/contracts/slots/catalog';
import { DESIGNER_PALETTE, setDesignerPaletteCatalog } from '../../../../domain/component-designer/catalog';
import { DESIGNER_DOCUMENT_SCHEMA_VERSION } from '../../../../domain/component-designer/documentSchema';



let tmpDir = '';

let origCwd = '';



beforeEach(() => {

  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'component-designer-drafts-'));

  origCwd = process.cwd();

  process.chdir(tmpDir);

  vi.resetModules();

});



afterEach(() => {

  process.chdir(origCwd);

  fs.rmSync(tmpDir, { recursive: true, force: true });

  vi.resetModules();

});



const createDraftState = () => {

  const initial = createInitialDesignerState();

  const withSection = designerReducer(initial, {

    type: 'insert-palette-item',

    itemId: 'html.container',

    parentId: initial.document.rootNodeId,

  });

  const sectionId = withSection.document.nodes[withSection.document.rootNodeId].children[0];

  return designerReducer(withSection, {

    type: 'insert-palette-item',

    itemId: 'html.text',

    parentId: sectionId,

  });

};



async function loadDraftsModule() {

  const [drafts, coordinator] = await Promise.all([

    import('../drafts'),

    import('../../../services/component-designer/draftCoordinator.service'),

  ]);

  return { ...drafts, ...coordinator };

}



describe('component designer phase E draft persistence adapter', () => {

  it('saves and loads draft records with metadata and index updates', async () => {

    const state = createDraftState();

    const { saveDesignerDraft, getDesignerDraft, listDesignerDrafts, listDesignerDraftVersions, designerDraftStoragePaths } = await loadDraftsModule();



    const saved = saveDesignerDraft({

      name: 'Customer Summary',

      document: state.document,

      bindingDefinitions: state.bindingDefinitions,

      actor: 'admin',

    });



    const savedAgain = saveDesignerDraft({

      id: saved.id,

      name: 'Customer Summary v2',

      document: state.document,

      bindingDefinitions: state.bindingDefinitions,

      actor: 'admin',

    });



    expect(saved.metadata.createdBy).toBe('admin');

    expect(saved.metadata.updatedBy).toBe('admin');

    expect(savedAgain.metadata.createdBy).toBe('admin');

    expect(savedAgain.metadata.updatedBy).toBe('admin');

    expect(fs.existsSync(designerDraftStoragePaths.index)).toBe(true);



    const loaded = getDesignerDraft(saved.id);

    expect(loaded?.name).toBe('Customer Summary v2');



    const versions = listDesignerDraftVersions(saved.id);

    expect(versions).toHaveLength(1);

    expect(versions[0]?.name).toBe('Customer Summary v2');



    const summaries = listDesignerDrafts();

    expect(summaries).toHaveLength(1);

    expect(summaries[0].id).toBe(saved.id);

    expect(summaries[0].createdBy).toBe('admin');

    expect(summaries[0].updatedBy).toBe('admin');

    expect(summaries[0].createdAt).toBeTruthy();

    expect(summaries[0].updatedAt).toBeTruthy();

    expect(summaries[0].folder).toBe('general');

  });



  it('renames, duplicates, and deletes drafts through file-backed flow', async () => {

    const state = createDraftState();

    const { saveDesignerDraft, renameDesignerDraft, duplicateDesignerDraft, deleteDesignerDraft, listDesignerDrafts } = await loadDraftsModule();



    const saved = saveDesignerDraft({

      name: 'Sales Widget',

      document: state.document,

      bindingDefinitions: state.bindingDefinitions,

    });



    const renamed = renameDesignerDraft(saved.id, 'Sales Widget Renamed');

    expect(renamed.name).toBe('Sales Widget Renamed');



    const duplicated = duplicateDesignerDraft(saved.id, 'Sales Widget Copy');

    expect(duplicated.id).not.toBe(saved.id);



    expect(listDesignerDrafts()).toHaveLength(2);

    expect(deleteDesignerDraft(saved.id)).toBe(true);

    expect(listDesignerDrafts()).toHaveLength(1);

  });



  it('prefers draft file name when index entry is stale', async () => {

    const state = createDraftState();

    const { saveDesignerDraft, renameDesignerDraft, listDesignerDrafts, designerDraftStoragePaths } = await loadDraftsModule();



    const saved = saveDesignerDraft({

      name: 'original-name',

      document: state.document,

      bindingDefinitions: state.bindingDefinitions,

    });



    renameDesignerDraft(saved.id, 'renamed-component');



    const indexPath = designerDraftStoragePaths.index;

    const index = JSON.parse(fs.readFileSync(indexPath, 'utf8')) as {

      drafts: Array<{ id: string; name: string }>;

    };

    index.drafts = index.drafts.map((item) => (

      item.id === saved.id ? { ...item, name: 'stale-index-name' } : item

    ));

    fs.writeFileSync(indexPath, JSON.stringify(index, null, 2));



    const listed = listDesignerDrafts();

    expect(listed.find((item) => item.id === saved.id)?.name).toBe('renamed-component');

  });



  it('recovers index from draft files when index is missing or corrupt', async () => {

    const state = createDraftState();

    const { saveDesignerDraft, listDesignerDrafts, designerDraftStoragePaths } = await loadDraftsModule();



    const saved = saveDesignerDraft({

      name: 'Recovery Candidate',

      document: state.document,

      bindingDefinitions: state.bindingDefinitions,

    });



    fs.writeFileSync(designerDraftStoragePaths.index, '{corrupt json', 'utf8');



    const listAfterCorruption = listDesignerDrafts();

    expect(listAfterCorruption.some((item) => item.id === saved.id)).toBe(true);



    const recoveredIndexRaw = fs.readFileSync(designerDraftStoragePaths.index, 'utf8');

    const recoveredIndex = JSON.parse(recoveredIndexRaw) as { schema: string; drafts: Array<{ id: string }> };

    expect(recoveredIndex.schema).toBe('component-designer-drafts-index');

    expect(recoveredIndex.drafts.some((item) => item.id === saved.id)).toBe(true);

  });

  it('writes TSX and meta sidecars alongside name-based draft JSON on save and removes them on delete', async () => {
    const state = createDraftState();
    const {
      saveDesignerDraft,
      renameDesignerDraft,
      deleteDesignerDraft,
      designerDraftStoragePaths,
    } = await loadDraftsModule();

    const saved = saveDesignerDraft({
      name: 'Customer Summary',
      document: state.document,
      bindingDefinitions: state.bindingDefinitions,
      actor: 'admin',
    });

    const jsonPath = path.join(designerDraftStoragePaths.drafts, 'general', 'Customer-Summary.json');
    const companionTsxPath = path.join(designerDraftStoragePaths.drafts, 'general', 'Customer-Summary.tsx');
    const companionMetaPath = path.join(designerDraftStoragePaths.drafts, 'general', 'Customer-Summary.meta.json');

    expect(fs.existsSync(jsonPath)).toBe(true);
    expect(fs.existsSync(companionTsxPath)).toBe(true);
    expect(fs.existsSync(companionMetaPath)).toBe(true);
    expect(fs.existsSync(path.join(designerDraftStoragePaths.exports, 'general'))).toBe(false);
    expect(fs.existsSync(path.join(designerDraftStoragePaths.snapshots, 'general'))).toBe(false);

    const tsxContent = fs.readFileSync(companionTsxPath, 'utf8');
    const metaContent = fs.readFileSync(companionMetaPath, 'utf8');
    expect(tsxContent).not.toContain('/*__DESIGNER_JSON_START__');
    expect(tsxContent).not.toContain('__DESIGNER_JSON_END__*/');
    expect(metaContent).toContain(`"id": "${saved.id}"`);

    renameDesignerDraft(saved.id, 'Customer Summary v2');
    expect(fs.existsSync(path.join(designerDraftStoragePaths.drafts, 'general', 'Customer-Summary-v2.tsx'))).toBe(true);
    expect(fs.existsSync(path.join(designerDraftStoragePaths.drafts, 'general', 'Customer-Summary-v2.meta.json'))).toBe(true);
    expect(fs.existsSync(path.join(designerDraftStoragePaths.drafts, 'general', 'Customer-Summary-v2.json'))).toBe(true);
    expect(fs.existsSync(companionTsxPath)).toBe(false);
    expect(fs.existsSync(companionMetaPath)).toBe(false);
    expect(fs.existsSync(jsonPath)).toBe(false);

    expect(deleteDesignerDraft(saved.id)).toBe(true);
    expect(fs.existsSync(path.join(designerDraftStoragePaths.drafts, 'general', 'Customer-Summary-v2.tsx'))).toBe(false);
    expect(fs.existsSync(path.join(designerDraftStoragePaths.drafts, 'general', 'Customer-Summary-v2.meta.json'))).toBe(false);
    expect(fs.existsSync(path.join(designerDraftStoragePaths.drafts, 'general', 'Customer-Summary-v2.json'))).toBe(false);
  });

  it('purges leftover exports and snapshots when a draft moves folder', async () => {
    const state = createDraftState();
    const { saveDesignerDraft, designerDraftStoragePaths } = await loadDraftsModule();

    const saved = saveDesignerDraft({
      name: 'Legacy Cleanup',
      folder: 'archive',
      document: state.document,
      bindingDefinitions: state.bindingDefinitions,
    });

    expect(saved.folder).toBe('general');

    const legacyExportTsx = path.join(designerDraftStoragePaths.exports, 'general', 'Legacy-Cleanup.tsx');
    const legacyExportMeta = path.join(designerDraftStoragePaths.exports, 'general', 'Legacy-Cleanup.meta.json');
    const legacySnapshot = path.join(designerDraftStoragePaths.snapshots, 'general', saved.id, 'latest.json');

    fs.mkdirSync(path.dirname(legacyExportTsx), { recursive: true });
    fs.mkdirSync(path.dirname(legacySnapshot), { recursive: true });
    fs.writeFileSync(legacyExportTsx, '// legacy', 'utf8');
    fs.writeFileSync(legacyExportMeta, JSON.stringify({ document: { id: saved.id } }), 'utf8');
    fs.writeFileSync(legacySnapshot, '{}', 'utf8');

    saveDesignerDraft({
      id: saved.id,
      name: 'Legacy Cleanup',
      folder: 'portal-layouts',
      document: state.document,
      bindingDefinitions: state.bindingDefinitions,
    });

    expect(fs.existsSync(path.join(designerDraftStoragePaths.drafts, 'general', 'Legacy-Cleanup.json'))).toBe(true);
    expect(fs.existsSync(path.join(designerDraftStoragePaths.drafts, 'portal-layouts'))).toBe(false);
  });

  it('sanitizes draft filenames with invalid filesystem characters', async () => {
    const state = createDraftState();
    const { saveDesignerDraft, designerDraftStoragePaths } = await loadDraftsModule();

    saveDesignerDraft({
      name: 'Widget: Sales/Report *draft*',
      document: state.document,
      bindingDefinitions: state.bindingDefinitions,
    });

    const draftTsxPath = path.join(designerDraftStoragePaths.drafts, 'general', 'Widget-SalesReport-draft.tsx');
    expect(fs.existsSync(draftTsxPath)).toBe(true);
    expect(fs.existsSync(path.join(designerDraftStoragePaths.drafts, 'general', 'Widget-SalesReport-draft.json'))).toBe(true);
  });

  it('keeps every draft in general even when a shell folder is requested', async () => {
    const state = createDraftState();
    const { saveDesignerDraft, getDesignerDraft, designerDraftStoragePaths } = await loadDraftsModule();

    const saved = saveDesignerDraft({
      name: 'Landing Hero',
      folder: 'Landing Pages',
      document: state.document,
      bindingDefinitions: state.bindingDefinitions,
    });

    const generalJsonPath = path.join(designerDraftStoragePaths.drafts, 'general', 'Landing-Hero.json');
    const generalTsxPath = path.join(designerDraftStoragePaths.drafts, 'general', 'Landing-Hero.tsx');

    expect(fs.existsSync(generalJsonPath)).toBe(true);
    expect(fs.existsSync(generalTsxPath)).toBe(true);
    expect(getDesignerDraft(saved.id)?.folder).toBe('general');

    const moved = saveDesignerDraft({
      id: saved.id,
      name: 'Landing Hero',
      folder: 'portal-layouts',
      document: state.document,
      bindingDefinitions: state.bindingDefinitions,
    });

    expect(moved.folder).toBe('general');
    expect(fs.existsSync(generalJsonPath)).toBe(true);
    expect(fs.existsSync(generalTsxPath)).toBe(true);
    expect(fs.existsSync(path.join(designerDraftStoragePaths.drafts, 'portal-layouts'))).toBe(false);
  });

  it('moves leftover folder-scoped draft files into general', async () => {
    const state = createDraftState();
    const { saveDesignerDraft, listDesignerDrafts, designerDraftStoragePaths } = await loadDraftsModule();

    const saved = saveDesignerDraft({
      name: 'Legacy Folder Page',
      folder: 'general',
      document: state.document,
      bindingDefinitions: state.bindingDefinitions,
    });

    const generalDir = path.join(designerDraftStoragePaths.drafts, 'general');
    const cmsDir = path.join(designerDraftStoragePaths.drafts, 'cms');
    fs.mkdirSync(cmsDir, { recursive: true });

    const stem = 'Legacy-Folder-Page';
    for (const ext of ['.json', '.tsx', '.meta.json', '.types.ts']) {
      const fromPath = path.join(generalDir, `${stem}${ext}`);
      if (fs.existsSync(fromPath)) {
        fs.renameSync(fromPath, path.join(cmsDir, `${stem}${ext}`));
      }
    }

    const jsonPath = path.join(cmsDir, `${stem}.json`);
    const raw = JSON.parse(fs.readFileSync(jsonPath, 'utf8')) as Record<string, unknown>;
    raw.folder = 'cms';
    fs.writeFileSync(jsonPath, JSON.stringify(raw, null, 2));

    const listed = listDesignerDrafts();
    expect(listed.find((item) => item.id === saved.id)?.folder).toBe('general');
    expect(fs.existsSync(path.join(generalDir, `${stem}.json`))).toBe(true);
    expect(fs.existsSync(cmsDir)).toBe(false);
  });

  it('loads drafts by folder/component path without treating slashes as draft ids', async () => {
    const state = createDraftState();
    const { saveDesignerDraft, getDesignerDraft } = await loadDraftsModule();

    const saved = saveDesignerDraft({
      name: 'gridtest',
      folder: 'erfan',
      document: state.document,
      bindingDefinitions: state.bindingDefinitions,
    });

    const loaded = getDesignerDraft('general/gridtest');

    expect(loaded?.id).toBe(saved.id);
    expect(loaded?.name).toBe('gridtest');
    expect(loaded?.folder).toBe('general');
  });

  it('reconciles swapped folder/name metadata from the on-disk draft path', async () => {
    const state = createDraftState();
    const { saveDesignerDraft, designerDraftStoragePaths } = await loadDraftsModule();
    const { readDraftRecordByPath } = await import('../draftIo');

    const saved = saveDesignerDraft({
      name: 'c1',
      folder: 'my-tests',
      document: state.document,
      bindingDefinitions: state.bindingDefinitions,
    });

    const draftPath = path.join(
      designerDraftStoragePaths.drafts,
      'general',
      'c1.json',
    );
    const raw = JSON.parse(fs.readFileSync(draftPath, 'utf8')) as Record<string, unknown>;
    fs.writeFileSync(draftPath, JSON.stringify({
      ...raw,
      name: 'general',
      folder: 'c1',
    }, null, 2));

    const reconciled = readDraftRecordByPath(draftPath);

    expect(reconciled?.id).toBe(saved.id);
    expect(reconciled?.name).toBe('c1');
    expect(reconciled?.folder).toBe('general');
  });

  it('removes empty folder directories after deleting the last draft in a folder', async () => {
    const state = createDraftState();
    const { saveDesignerDraft, deleteDesignerDraft, designerDraftStoragePaths } = await loadDraftsModule();

    const saved = saveDesignerDraft({
      name: 'Folder Cleanup Candidate',
      folder: 'portal-layouts',
      document: state.document,
      bindingDefinitions: state.bindingDefinitions,
    });

    const draftsFolder = path.join(designerDraftStoragePaths.drafts, 'general');

    expect(fs.existsSync(draftsFolder)).toBe(true);

    expect(deleteDesignerDraft(saved.id)).toBe(true);

    expect(fs.existsSync(draftsFolder)).toBe(false);
  });

  it('deletes leftover draft JSON files that share the same id after a rename', async () => {
    const state = createDraftState();
    const { saveDesignerDraft, deleteDesignerDraft, listDesignerDrafts, designerDraftStoragePaths } = await loadDraftsModule();

    const saved = saveDesignerDraft({
      name: 'sum-two-numbers',
      document: state.document,
      bindingDefinitions: state.bindingDefinitions,
    });

    const leftoverPath = path.join(designerDraftStoragePaths.drafts, 'general', 'ui-for-sum-two-numbers.json');
    fs.writeFileSync(leftoverPath, JSON.stringify({
      schema: 'component-designer-draft',
      id: saved.id,
      name: 'ui-for-sum-two-numbers',
      folder: 'general',
      tags: [],
      document: saved.document,
      bindingDefinitions: saved.bindingDefinitions,
      metadata: saved.metadata,
    }, null, 2));

    expect(deleteDesignerDraft(saved.id)).toBe(true);
    expect(listDesignerDrafts()).toHaveLength(0);
    expect(fs.existsSync(leftoverPath)).toBe(false);
  });

  it('keeps folder directories when another draft remains in the same folder', async () => {
    const state = createDraftState();
    const { saveDesignerDraft, deleteDesignerDraft, designerDraftStoragePaths } = await loadDraftsModule();

    const first = saveDesignerDraft({
      name: 'Shared Folder A',
      folder: 'portal-layouts',
      document: state.document,
      bindingDefinitions: state.bindingDefinitions,
    });

    const second = saveDesignerDraft({
      name: 'Shared Folder B',
      folder: 'portal-layouts',
      document: {
        ...state.document,
        id: `${first.id}-sibling`,
      },
      bindingDefinitions: state.bindingDefinitions,
    });

    const draftsFolder = path.join(designerDraftStoragePaths.drafts, 'general');

    expect(deleteDesignerDraft(first.id)).toBe(true);
    expect(fs.existsSync(draftsFolder)).toBe(true);

    expect(deleteDesignerDraft(second.id)).toBe(true);
    expect(fs.existsSync(draftsFolder)).toBe(false);
  });

  it('loads drafts from folder subdirectories when index folder hint is stale', async () => {
    const state = createDraftState();
    const { saveDesignerDraft, getDesignerDraft, listDesignerDrafts, designerDraftStoragePaths } = await loadDraftsModule();

    const saved = saveDesignerDraft({
      name: 'Stale Index Candidate',
      folder: 'portal-layouts',
      document: state.document,
      bindingDefinitions: state.bindingDefinitions,
    });

    const indexPath = designerDraftStoragePaths.index;
    const index = JSON.parse(fs.readFileSync(indexPath, 'utf8')) as {
      drafts: Array<{ id: string; folder: string }>;
    };
    index.drafts = index.drafts.map((item) => (
      item.id === saved.id ? { ...item, folder: 'general' } : item
    ));
    fs.writeFileSync(indexPath, JSON.stringify(index, null, 2));

    expect(getDesignerDraft(saved.id)?.name).toBe('Stale Index Candidate');
    expect(listDesignerDrafts().find((item) => item.id === saved.id)?.folder).toBe('general');
  });

  it('persists schemaVersion and strips diagnostics from draft files', async () => {

    const state = createDraftState();

    state.document.diagnostics = [

      {

        id: 'stale',

        code: 'required-prop',

        level: 'error',

        message: 'Should not be stored',

      },

    ];



    const { saveDesignerDraft, designerDraftStoragePaths } = await loadDraftsModule();



    const saved = saveDesignerDraft({

      name: 'Persist Metadata',

      document: state.document,

      bindingDefinitions: state.bindingDefinitions,

    });



    const raw = JSON.parse(fs.readFileSync(path.join(designerDraftStoragePaths.drafts, 'general', 'Persist-Metadata.json'), 'utf8')) as {

      document: { schemaVersion: string; diagnostics: unknown[] };

    };



    expect(raw.document.schemaVersion).toBe(DESIGNER_DOCUMENT_SCHEMA_VERSION);

    expect(raw.document.diagnostics).toEqual([]);

  });



  it('round-trips system-slot nodes without SlotRegistry', async () => {

    const slotItem = buildSlotPaletteItems(CORE_SLOT_CATALOG)[1];

    setDesignerPaletteCatalog([...DESIGNER_PALETTE, slotItem]);



    const initial = createInitialDesignerState('Dashboard Slot');

    const state = designerReducer(initial, {

      type: 'insert-palette-item',

      itemId: slotItem.id,

      parentId: initial.document.rootNodeId,

    });



    const { saveDesignerDraft, getDesignerDraft } = await loadDraftsModule();



    const saved = saveDesignerDraft({

      name: 'Dashboard Slot',

      document: state.document,

      bindingDefinitions: state.bindingDefinitions,

    });



    const loaded = getDesignerDraft(saved.id);

    expect(loaded).not.toBeNull();



    const slotNode = Object.values(loaded!.document.nodes).find((node) => node.type === 'system-slot');

    expect(slotNode?.props.slotId).toBe('core.dashboard.widgets');

    expect(loaded!.document.schemaVersion).toBe(DESIGNER_DOCUMENT_SCHEMA_VERSION);

  });



  it('rejects save when slot id is not in platform catalog', async () => {

    const state = createInitialDesignerState('Bad Slot');

    const rootId = state.document.rootNodeId;

    const nodeId = 'bad-slot-node';



    const document = {

      ...state.document,

      nodes: {

        ...state.document.nodes,

        [rootId]: {

          ...state.document.nodes[rootId],

          children: [nodeId],

        },

        [nodeId]: {

          id: nodeId,

          type: 'system-slot',

          parentId: rootId,

          order: 0,

          props: { slotId: 'unknown.slot.id' },

          layout: {},

          binding: {},

          children: [],

        },

      },

    };



    const { saveDesignerDraft } = await loadDraftsModule();



    expect(() => saveDesignerDraft({

      name: 'Bad Slot',

      document,

      bindingDefinitions: state.bindingDefinitions,

    })).toThrow(/not registered in the platform catalog/);

  });

});

