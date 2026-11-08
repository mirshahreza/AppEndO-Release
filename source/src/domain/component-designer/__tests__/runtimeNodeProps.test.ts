import { describe, expect, it } from 'vitest';
import { createInitialDesignerState, designerReducer } from '../state';
import { createRegionColumnBindingDefinition } from '../bindingRegionEngine';
import { propertyBindingKeyForProp } from '../bindingEngine';
import { resolveImageObjectFitStyle, resolveAutocompleteMenuProps, resolveInputUxProps, resolveInputValidationProps, resolveModalOverlayPartProps, resolveOverlayBehaviorProps, resolveRegionFormFieldNameProps, resolveRuntimeComponentProps, resolveSelectMenuProps, resolveTableProps, resolveTableSelectionProps } from '../runtimeNodeProps';

describe('component designer runtime node props', () => {
  it('injects region form field name props when a region column binding exists', () => {
    const initial = createInitialDesignerState();
    const withInput = designerReducer(initial, {
      type: 'insert-palette-item',
      itemId: 'heroui.input-text',
      parentId: initial.document.rootNodeId,
    });
    const nodeId = withInput.document.nodes[withInput.document.rootNodeId].children[0];
    const node = designerReducer(withInput, {
      type: 'set-node-binding',
      nodeId,
      bindingKey: propertyBindingKeyForProp('value'),
      definition: createRegionColumnBindingDefinition('value', 'FIRST_NAME'),
    }).document.nodes[nodeId];

    expect(resolveRegionFormFieldNameProps(node)).toEqual({ name: nodeId });
  });

  it('maps library boolean aliases and aria-label for live canvas render', () => {
    const initial = createInitialDesignerState();
    const withInput = designerReducer(initial, {
      type: 'insert-palette-item',
      itemId: 'heroui.input-text',
      parentId: initial.document.rootNodeId,
    });
    const nodeId = withInput.document.nodes[withInput.document.rootNodeId].children[0];
    const node = designerReducer(withInput, {
      type: 'set-node-prop',
      nodeId,
      key: 'isDisabled',
      value: true,
    }).document.nodes[nodeId];

    const props = resolveRuntimeComponentProps(node, { libraryComponent: true });

    expect(props.isDisabled).toBe(true);
    expect(props.disabled).toBeUndefined();
  });

  it('passes placeholder and required flags through to library components', () => {
    const initial = createInitialDesignerState();
    const withInput = designerReducer(initial, {
      type: 'insert-palette-item',
      itemId: 'heroui.input-text',
      parentId: initial.document.rootNodeId,
    });
    const nodeId = withInput.document.nodes[withInput.document.rootNodeId].children[0];

    let state = designerReducer(withInput, {
      type: 'set-node-prop',
      nodeId,
      key: 'placeholder',
      value: 'Enter email',
    });
    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId,
      key: 'isRequired',
      value: true,
    });
    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId,
      key: 'ariaLabel',
      value: 'Email address',
    });

    const props = resolveRuntimeComponentProps(state.document.nodes[nodeId], { libraryComponent: true });

    expect(props.placeholder).toBe('Enter email');
    expect(props.required).toBe(true);
    expect(props['aria-label']).toBe('Email address');
  });

  it('re-merges dataTestId and htmlExtraAttrs for library components (parity with TSX special merge)', () => {
    const initial = createInitialDesignerState();
    const withInput = designerReducer(initial, {
      type: 'insert-palette-item',
      itemId: 'heroui.input-text',
      parentId: initial.document.rootNodeId,
    });
    const nodeId = withInput.document.nodes[withInput.document.rootNodeId].children[0];
    let state = designerReducer(withInput, {
      type: 'set-node-prop',
      nodeId,
      key: 'dataTestId',
      value: 'email-field',
    });
    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId,
      key: 'htmlExtraAttrs',
      value: '{"data-field":"email"}',
    });

    const props = resolveRuntimeComponentProps(state.document.nodes[nodeId], { libraryComponent: true });

    expect(props['data-testid']).toBe('email-field');
    expect(props['data-field']).toBe('email');
    expect(props.dataTestId).toBeUndefined();
    expect(props.htmlExtraAttrs).toBeUndefined();
  });

  it('maps image objectFit inspector value to inline style for canvas preview', () => {
    const initial = createInitialDesignerState();
    const withImage = designerReducer(initial, {
      type: 'insert-palette-item',
      itemId: 'html.image',
      parentId: initial.document.rootNodeId,
    });
    const nodeId = withImage.document.nodes[withImage.document.rootNodeId].children[0];
    const node = designerReducer(withImage, {
      type: 'set-node-prop',
      nodeId,
      key: 'objectFit',
      value: 'cover',
    }).document.nodes[nodeId];

    expect(resolveImageObjectFitStyle(node)).toEqual({ objectFit: 'cover' });
  });

  it('maps validation props for HeroUI inputs', () => {
    const initial = createInitialDesignerState();
    const withInput = designerReducer(initial, {
      type: 'insert-palette-item',
      itemId: 'heroui.input-text',
      parentId: initial.document.rootNodeId,
    });
    const nodeId = withInput.document.nodes[withInput.document.rootNodeId].children[0];
    let state = designerReducer(withInput, { type: 'set-node-prop', nodeId, key: 'isInvalid', value: true });
    state = designerReducer(state, { type: 'set-node-prop', nodeId, key: 'errorMessage', value: 'Required field' });
    state = designerReducer(state, { type: 'set-node-prop', nodeId, key: 'pattern', value: '^[a-z]+$' });
    state = designerReducer(state, { type: 'set-node-prop', nodeId, key: 'maxLength', value: 32 });

    const validationProps = resolveInputValidationProps(state.document.nodes[nodeId]);
    expect(validationProps.isInvalid).toBe(true);
    expect(validationProps.errorMessage).toBe('Required field');
    expect(validationProps.pattern).toBe('^[a-z]+$');
    expect(validationProps.maxLength).toBe(32);
  });

  it('maps table selection props from inspector values', () => {
    const initial = createInitialDesignerState();
    const withTable = designerReducer(initial, {
      type: 'insert-palette-item',
      itemId: 'heroui.table',
      parentId: initial.document.rootNodeId,
    });
    const nodeId = withTable.document.nodes[withTable.document.rootNodeId].children[0];
    let state = designerReducer(withTable, { type: 'set-node-prop', nodeId, key: 'selectionMode', value: 'multiple' });
    state = designerReducer(state, { type: 'set-node-prop', nodeId, key: 'selectedKeys', value: 'row-1,row-2' });

    expect(resolveTableSelectionProps(state.document.nodes[nodeId])).toEqual({
      selectionMode: 'multiple',
      selectedKeys: ['row-1', 'row-2'],
    });
  });

  it('maps input UX props for adornments, helper text, and keyboard modes', () => {
    const initial = createInitialDesignerState();
    const withInput = designerReducer(initial, {
      type: 'insert-palette-item',
      itemId: 'heroui.input-text',
      parentId: initial.document.rootNodeId,
    });
    const nodeId = withInput.document.nodes[withInput.document.rootNodeId].children[0];
    let state = designerReducer(withInput, { type: 'set-node-prop', nodeId, key: 'description', value: 'Enter your email' });
    state = designerReducer(state, { type: 'set-node-prop', nodeId, key: 'startContent', value: 'Search' });
    state = designerReducer(state, { type: 'set-node-prop', nodeId, key: 'endContent', value: '@' });
    state = designerReducer(state, { type: 'set-node-prop', nodeId, key: 'isClearable', value: true });
    state = designerReducer(state, { type: 'set-node-prop', nodeId, key: 'autoFocus', value: true });
    state = designerReducer(state, { type: 'set-node-prop', nodeId, key: 'inputMode', value: 'email' });

    expect(resolveInputUxProps(state.document.nodes[nodeId])).toEqual({
      description: 'Enter your email',
      startContent: 'Search',
      endContent: '@',
      isClearable: true,
      autoFocus: true,
      inputMode: 'email',
    });
  });

  it('maps menu async props for select and autocomplete', () => {
    const initial = createInitialDesignerState();
    const withSelect = designerReducer(initial, {
      type: 'insert-palette-item',
      itemId: 'heroui.select',
      parentId: initial.document.rootNodeId,
    });
    const selectId = withSelect.document.nodes[withSelect.document.rootNodeId].children[0];
    // Bug found (parity audit item 47, re-verified): `closeOnSelect` is set here to prove it's a
    // no-op now — `shouldCloseOnSelect` isn't a real prop on Select/Autocomplete (only
    // Menu/DatePicker support it), so the field was removed from Inspector and this resolver no
    // longer forwards it under either name.
    let state = designerReducer(withSelect, { type: 'set-node-prop', nodeId: selectId, key: 'isLoading', value: true });
    state = designerReducer(state, { type: 'set-node-prop', nodeId: selectId, key: 'closeOnSelect', value: true });

    expect(resolveSelectMenuProps(state.document.nodes[selectId])).toEqual({
      isLoading: true,
      isPending: true,
    });
    expect(resolveSelectMenuProps(state.document.nodes[selectId])).not.toHaveProperty('shouldCloseOnSelect');

    const withAutocomplete = designerReducer(initial, {
      type: 'insert-palette-item',
      itemId: 'heroui.autocomplete',
      parentId: initial.document.rootNodeId,
    });
    const autocompleteId = withAutocomplete.document.nodes[withAutocomplete.document.rootNodeId].children[0];
    state = designerReducer(withAutocomplete, {
      type: 'set-node-prop',
      nodeId: autocompleteId,
      key: 'isLoading',
      value: true,
    });
    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId: autocompleteId,
      key: 'closeOnSelect',
      value: true,
    });

    expect(resolveAutocompleteMenuProps(state.document.nodes[autocompleteId])).toEqual({
      isLoading: true,
      isPending: true,
    });
    // Legacy allowCustomValue is ignored (parity audit item 92).
    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId: autocompleteId,
      key: 'allowCustomValue',
      value: true,
    });
    expect(resolveAutocompleteMenuProps(state.document.nodes[autocompleteId])).not.toHaveProperty('allowCustomValue');
  });

  it('maps overlay behavior props for modal and drawer surfaces', () => {
    const initial = createInitialDesignerState();
    const withModal = designerReducer(initial, {
      type: 'insert-palette-item',
      itemId: 'heroui.modal',
      parentId: initial.document.rootNodeId,
    });
    const nodeId = withModal.document.nodes[withModal.document.rootNodeId].children[0];
    let state = designerReducer(withModal, { type: 'set-node-prop', nodeId, key: 'backdrop', value: 'blur' });
    state = designerReducer(state, { type: 'set-node-prop', nodeId, key: 'scrollBehavior', value: 'inside' });
    state = designerReducer(state, { type: 'set-node-prop', nodeId, key: 'isKeyboardDismissDisabled', value: true });

    expect(resolveOverlayBehaviorProps(state.document.nodes[nodeId])).toEqual({
      backdrop: 'blur',
      scrollBehavior: 'inside',
      isKeyboardDismissDisabled: true,
    });

    expect(resolveModalOverlayPartProps(state.document.nodes[nodeId])).toEqual({
      backdrop: {
        variant: 'blur',
        isKeyboardDismissDisabled: true,
      },
      container: {
        scroll: 'inside',
      },
    });
  });

  it('maps table structure props for striped rows, sticky header, and empty state', () => {
    const initial = createInitialDesignerState();
    const withTable = designerReducer(initial, {
      type: 'insert-palette-item',
      itemId: 'heroui.table',
      parentId: initial.document.rootNodeId,
    });
    const nodeId = withTable.document.nodes[withTable.document.rootNodeId].children[0];
    let state = designerReducer(withTable, { type: 'set-node-prop', nodeId, key: 'isStriped', value: true });
    state = designerReducer(state, { type: 'set-node-prop', nodeId, key: 'isHeaderSticky', value: true });
    state = designerReducer(state, { type: 'set-node-prop', nodeId, key: 'emptyContent', value: 'No records found' });

    expect(resolveTableProps(state.document.nodes[nodeId])).toEqual({
      isStriped: true,
      isHeaderSticky: true,
      emptyContent: 'No records found',
    });
  });
});
