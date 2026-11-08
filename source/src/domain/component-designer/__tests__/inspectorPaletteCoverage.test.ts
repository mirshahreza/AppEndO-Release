import { describe, expect, it } from 'vitest';
import { DESIGNER_PALETTE, getDesignerPaletteCatalog, setDesignerPaletteCatalog, resetDesignerPaletteCatalog } from '../catalog';
import { compileInspectorForPaletteItem } from '../compileInspectorFromCatalog';
import { HEROUI_PALETTE_PROP_FIELD_MAP, PALETTE_TAILWIND_FIELD_KEY_MAP } from '../inspectorPaletteFields';
import { resolveInspectorFieldSections } from '../inspectorRegistry';
import { createInitialDesignerState, designerReducer } from '../state';
import type { DesignerState } from '../types';
import { buildSlotPaletteItems } from '../slotPalette';
import { buildPlatformNavigationPaletteItems } from '../navigationComponentPalette';
import { buildShellChromePaletteItems } from '../shellChromePalette';
import { buildReusablePaletteItems } from '../reusablePalette';

const insertPaletteItem = (state: DesignerState, itemId: string, parentId?: string): DesignerState =>
  designerReducer(state, {
    type: 'insert-palette-item',
    itemId,
    parentId: parentId ?? state.document.rootNodeId,
  });

const getLastInsertedNodeId = (state: DesignerState): string => {
  const root = state.document.nodes[state.document.rootNodeId];
  return root.children[root.children.length - 1] as string;
};

const resolveNodeForPaletteItem = (itemId: string) => {
  let state = createInitialDesignerState();

  if (itemId === 'html.list-item') {
    state = insertPaletteItem(state, 'html.list');
    const listId = getLastInsertedNodeId(state);
    state = insertPaletteItem(state, itemId, listId);
    const listNode = state.document.nodes[listId];
    const listItemId = listNode.children[listNode.children.length - 1] as string;
    return state.document.nodes[listItemId];
  }

  state = insertPaletteItem(state, itemId);
  const nodeId = getLastInsertedNodeId(state);
  const inserted = state.document.nodes[nodeId];
  if (itemId === 'layout.dock-pane') {
    const paneId = inserted.children.find(
      (childId) => state.document.nodes[childId]?.props._designerPaletteItemId === 'layout.dock-pane',
    );
    if (paneId) {
      return state.document.nodes[paneId];
    }
  }
  return inserted;
};

const flattenFieldKeys = (itemId: string): Set<string> => {
  const node = resolveNodeForPaletteItem(itemId);
  const sections = resolveInspectorFieldSections(node);
  return new Set(sections.flatMap((section) => section.fields.map((field) => field.key)));
};

/** Keys that represent the same setting under different names across sections. */
const SEMANTIC_FIELD_ALIASES: Record<string, string> = {
  disabled: 'disabled',
  isDisabled: 'disabled',
  required: 'required',
  isRequired: 'required',
  readOnly: 'readonly',
  isReadOnly: 'readonly',
  inputType: 'type',
  type: 'type',
};

describe('component designer inspector palette coverage', () => {
  it('maps heroui-specific inspector fields for every heroui palette item', () => {
    const herouiItems = DESIGNER_PALETTE.filter((item) => item.id.startsWith('heroui.'));

    expect(herouiItems.length).toBeGreaterThan(0);

    // Cluster D fix: 'heroui.card' / 'heroui.accordion-item' previously had a single 'heroui'
    // category field here ("Size"), but neither @heroui/react's <Card> nor <Accordion> has any
    // size prop or size style variant at all (proved via a byte-identical DOM diff between
    // size="lg" and size="sm" — see cardAccordionDeadSizeField.clusterD.test.tsx), so it was
    // removed as a 100%-dead field. Both items still have real, working Inspector fields
    // (title/description) — they just live in the 'content' category
    // (PALETTE_CONTENT_FIELDS), not 'heroui'. This coverage check only asserts presence in the
    // 'heroui' bucket specifically, so exempt these two rather than reintroducing a dead field.
    // Navigation & Overlays audit (same session): confirmed the identical dead-field bug for
    // 'heroui.tabs'/'heroui.breadcrumbs'/'heroui.toolbar' (no size variant in any of their real
    // HeroUI style configs) and 'heroui.field-container' (a plain <fieldset>, no HeroUI variant
    // system at all) — their only 'heroui'-category field ("Size") was removed too.
    // Parity audit item 20: 'heroui.link' exempted too — its real Link component
    // (`linkVariants` in @heroui/styles) defines zero variants at all, so its Size AND Color
    // fields (its only two 'heroui'-category fields) were both removed as fully dead; it still
    // has a real, working 'content' field (text/"Label").
    // Parity audit item 66: 'heroui.typography-lead' Color was its only 'heroui'-category field
    // and was fully dead (raw `<p>`, not Typography) — removed; only content `text` remains.
    const exemptFromHeroUiCategory = new Set([
      'heroui.card', 'heroui.accordion-item',
      'heroui.tabs', 'heroui.breadcrumbs', 'heroui.toolbar', 'heroui.field-container',
      'heroui.link',
      'heroui.typography-lead',
    ]);

    for (const item of herouiItems) {
      if (exemptFromHeroUiCategory.has(item.id)) {
        continue;
      }
      const compiled = compileInspectorForPaletteItem(item.id);
      const mapped = HEROUI_PALETTE_PROP_FIELD_MAP[item.id];
      expect(
        mapped ?? compiled,
        `missing heroui or compiled catalog fields for ${item.id}`,
      ).toBeDefined();
      expect((mapped?.length ?? compiled?.length) ?? 0).toBeGreaterThan(0);
    }
  });

  it('resolves global and html-extra sections for every palette item', () => {
    for (const item of DESIGNER_PALETTE) {
      const fieldKeys = flattenFieldKeys(item.id);
      expect(fieldKeys.has('className'), `${item.id} missing className`).toBe(true);
      expect(fieldKeys.has('htmlExtraAttrs'), `${item.id} missing htmlExtraAttrs`).toBe(true);
    }
  });

  it('exposes contextual content or tag fields for semantic html items', () => {
    const expectations: Record<string, readonly string[]> = {
      'html.text': ['textContentMode', 'text', 'translationKey'],
      'html.heading': ['textContentMode', 'text', 'translationKey', 'level'],
      'html.link': ['text', 'href'],
      'html.list-item': ['text'],
      'html.image': ['src', 'alt', 'objectFit', 'fallbackSrc'],
      'html.iframe': ['src', 'title', 'width', 'height', 'allowFullScreen'],
      'html.file-upload': [
        'accept',
        'multiple',
        'maxFileSizeMb',
        'maxFiles',
        'showPreview',
        'dragDropZone',
        'uploadDestination',
        'invalidTypeMessage',
        'invalidSizeMessage',
        'invalidCountMessage',
      ],
      'html.form': ['method', 'action'],
    };

    for (const [itemId, requiredKeys] of Object.entries(expectations)) {
      const fieldKeys = flattenFieldKeys(itemId);
      for (const key of requiredKeys) {
        expect(fieldKeys.has(key), `${itemId} missing ${key}`).toBe(true);
      }
    }
  });

  it('never repeats the same property across inspector sections for any palette item', () => {
    for (const item of DESIGNER_PALETTE) {
      const node = resolveNodeForPaletteItem(item.id);
      const sections = resolveInspectorFieldSections(node);

      const keyOwners = new Map<string, string>();
      const semanticOwners = new Map<string, { section: string; key: string }>();

      for (const section of sections) {
        for (const field of section.fields) {
          const existingKeyOwner = keyOwners.get(field.key);
          expect(
            existingKeyOwner,
            `${item.id}: field "${field.key}" duplicated in sections "${existingKeyOwner}" and "${section.id}"`,
          ).toBeUndefined();
          keyOwners.set(field.key, section.id);

          const semantic = SEMANTIC_FIELD_ALIASES[field.key];
          if (semantic) {
            const existingSemanticOwner = semanticOwners.get(semantic);
            if (existingSemanticOwner && existingSemanticOwner.section !== section.id) {
              throw new Error(
                `${item.id}: setting "${semantic}" duplicated via "${existingSemanticOwner.section}:${existingSemanticOwner.key}" and "${section.id}:${field.key}"`,
              );
            }
            semanticOwners.set(semantic, { section: section.id, key: field.key });
          }
        }
      }
    }
  });

  it('exposes layout tailwind controls for configured layout palette items', () => {
    for (const [itemId, tailwindKeys] of Object.entries(PALETTE_TAILWIND_FIELD_KEY_MAP)) {
      const fieldKeys = flattenFieldKeys(itemId);
      for (const key of tailwindKeys) {
        expect(fieldKeys.has(key), `${itemId} missing tailwind key ${key}`).toBe(true);
      }
    }
  });

  it('exposes heroui section fields on canvas nodes for library components', () => {
    const samples: Array<{ itemId: string; requiredKeys: readonly string[] }> = [
      {
        itemId: 'heroui.input-text',
        requiredKeys: [
          'placeholder', 'isDisabled', 'isRequired', 'size', 'type', 'isInvalid', 'errorMessage', 'pattern', 'maxLength', 'minLength',
          'startContent', 'endContent', 'description', 'isClearable', 'autoFocus', 'inputMode',
        ],
      },
      {
        itemId: 'heroui.table',
        requiredKeys: ['columns', 'gridQueryMode', 'pageSize', 'page', 'total', 'isStriped', 'emptyContent'],
      },
      // 'color' removed (parity audit item 19) — @heroui/react's real Button has no such
      // prop/variant at all.
      { itemId: 'heroui.button-solid', requiredKeys: ['variant', 'size', 'isDisabled'] },
      {
        itemId: 'heroui.select',
        requiredKeys: ['placeholder', 'isDisabled', 'isRequired', 'size', 'isLoading'],
      },
      {
        itemId: 'heroui.autocomplete',
        requiredKeys: ['label', 'placeholder', 'items', 'isDisabled', 'size', 'isLoading'],
      },
      {
        itemId: 'heroui.modal',
        requiredKeys: ['backdrop', 'scrollBehavior', 'isKeyboardDismissDisabled'],
      },
    ];

    for (const sample of samples) {
      const fieldKeys = flattenFieldKeys(sample.itemId);
      for (const key of sample.requiredKeys) {
        expect(fieldKeys.has(key), `${sample.itemId} missing ${key}`).toBe(true);
      }
    }

    // Bug found (parity audit item 92): allowCustomValue removed from autocomplete Inspector.
    expect(flattenFieldKeys('heroui.autocomplete').has('allowCustomValue')).toBe(false);
    // Bug found (parity audit item 47, re-verified): closeOnSelect removed from select/
    // autocomplete/entity-picker Inspector — shouldCloseOnSelect isn't a real prop on
    // Select/Autocomplete (only Menu/DatePicker), so the field was inert under either name.
    expect(flattenFieldKeys('heroui.select').has('closeOnSelect')).toBe(false);
    expect(flattenFieldKeys('heroui.autocomplete').has('closeOnSelect')).toBe(false);
    expect(flattenFieldKeys('heroui.entity-picker').has('closeOnSelect')).toBe(false);
    // Bug found (parity audit items 46/90): entity-picker exposes LOV field remapping.
    expect(flattenFieldKeys('heroui.entity-picker').has('returnField')).toBe(true);
    expect(flattenFieldKeys('heroui.entity-picker').has('displayField')).toBe(true);
  });

  it('keeps universal layout widget inspector fields scoped per palette id', () => {
    const expectations: Array<{ itemId: string; required: string[]; forbidden: string[] }> = [
      { itemId: 'layout.aspect-ratio', required: ['ratio'], forbidden: ['offset', 'overlayLabel', 'visibleCondition', 'mediaSide'] },
      { itemId: 'layout.sticky', required: ['offset'], forbidden: ['ratio', 'overlayLabel', 'visibleCondition', 'mediaSide'] },
      { itemId: 'layout.overlay', required: ['overlayLabel'], forbidden: ['ratio', 'offset', 'visibleCondition', 'mediaSide'] },
      { itemId: 'logic.visibility-container', required: ['visibleCondition'], forbidden: ['ratio', 'offset', 'overlayLabel', 'mediaSide'] },
      { itemId: 'content.split-media', required: ['title', 'mediaSide', 'mediaType', 'mediaSrc'], forbidden: ['ratio', 'offset', 'overlayLabel', 'visibleCondition'] },
    ];

    for (const { itemId, required, forbidden } of expectations) {
      const fieldKeys = flattenFieldKeys(itemId);
      for (const key of required) {
        expect(fieldKeys.has(key), `${itemId} missing ${key}`).toBe(true);
      }
      for (const key of forbidden) {
        expect(fieldKeys.has(key), `${itemId} should not expose ${key}`).toBe(false);
      }
    }
  });

  it('maps inspector coverage for merged dynamic palette items (slots, nav, shell, reusable)', () => {
    const slotItems = buildSlotPaletteItems([{ id: 'test-slot', label: 'Test Slot', description: 'Test slot', surface: 'admin-shell' }]);
    const navItems = buildPlatformNavigationPaletteItems();
    const shellItems = buildShellChromePaletteItems();
    const reusableItems = buildReusablePaletteItems([{ id: 'test-reusable', name: 'Test Reusable' }]);

    const merged = [...DESIGNER_PALETTE, ...slotItems, ...navItems, ...shellItems, ...reusableItems];
    setDesignerPaletteCatalog(merged);

    try {
      const allItems = getDesignerPaletteCatalog();
      expect(allItems.length).toBeGreaterThan(DESIGNER_PALETTE.length);

      for (const item of allItems) {
        const node = resolveNodeForPaletteItem(item.id);
        const sections = resolveInspectorFieldSections(node);
        expect(sections.length).toBeGreaterThan(0);

        const fieldKeys = new Set(sections.flatMap((s) => s.fields.map((f) => f.key)));
        expect(fieldKeys.has('className'), `${item.id} missing className`).toBe(true);
        expect(fieldKeys.has('htmlExtraAttrs'), `${item.id} missing htmlExtraAttrs`).toBe(true);
      }
    } finally {
      resetDesignerPaletteCatalog();
    }
  });
});
