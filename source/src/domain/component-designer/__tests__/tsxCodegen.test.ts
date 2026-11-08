import { describe, expect, it } from 'vitest';
import { generateDesignerTsx } from '../codegen';
import { createInitialDesignerState, designerReducer } from '../state';
import { buildNodeJsxAttributes, renderJsxAttribute, renderStyleJsxAttribute, shouldSkipTsxPropKey } from '../tsxPropMapper';
import { resolveTsxComponentSpec } from '../tsxComponentRegistry';
import type { DesignerNode } from '../types';

describe('tsxPropMapper', () => {
  it('converts inline CSS strings to React style object syntax', () => {
    expect(renderStyleJsxAttribute('text-align: right; color: red;')).toBe(" style={{ textAlign: 'right', color: 'red' }}");
    expect(renderStyleJsxAttribute('')).toBe('');
    expect(renderStyleJsxAttribute('color: blue;;')).toBe(" style={{ color: 'blue' }}");
  });

  it('maps accessibility and boolean props to React-compliant JSX', () => {
    expect(renderJsxAttribute('ariaLabel', 'Close dialog')).toBe(' aria-label="Close dialog"');
    expect(renderJsxAttribute('isDisabled', true)).toBe(' isDisabled');
    expect(renderJsxAttribute('isInvalid', true)).toBe(' isInvalid');
    expect(renderJsxAttribute('isDisabled', false)).toBe(' isDisabled={false}');
    expect(renderJsxAttribute('dir', 'rtl')).toBe(' dir="rtl"');
  });

  it('skips internal designer metadata keys', () => {
    expect(shouldSkipTsxPropKey('_designerPaletteItemId')).toBe(true);
    expect(shouldSkipTsxPropKey('twPadding')).toBe(true);
    expect(shouldSkipTsxPropKey('className')).toBe(false);
    expect(shouldSkipTsxPropKey('title')).toBe(false);
  });

  it('deduplicates JSX attributes when props and reserved defaults overlap', () => {
    const attrs = buildNodeJsxAttributes(
      {
        id: 'node-1',
        type: 'container',
        parentId: 'root',
        order: 0,
        props: {
          ariaLabel: 'testrole',
          className: 'w-full',
        },
        layout: {},
        binding: {},
        children: [],
      },
      {
        reservedAttributes: {
          ariaLabel: 'slider',
          defaultValue: 40,
        },
      },
    );

    expect(attrs.match(/aria-label=/g)).toHaveLength(1);
    expect(attrs).toContain('aria-label="testrole"');
    expect(attrs).toContain('defaultValue={40}');
  });
});

describe('tsxComponentRegistry', () => {
  it('resolves generic HeroUI palette items to React tags and imports', () => {
    const state = createInitialDesignerState();
    const withDatePicker = designerReducer(state, {
      type: 'insert-palette-item',
      itemId: 'heroui.date-picker',
      parentId: state.document.rootNodeId,
    });
    const nodeId = withDatePicker.document.nodes[withDatePicker.document.rootNodeId].children[0];
    const node = withDatePicker.document.nodes[nodeId];
    const spec = resolveTsxComponentSpec(node);

    expect(spec.kind).toBe('library-custom');
    expect(spec.reactTag).toBe('DesignerDatePickerField');
    expect(spec.importFrom).toBe('@/shared/ui/DesignerFormFields');
    expect(spec.importSymbols).toContain('DesignerDatePickerField');
  });

  it('resolves semantic textarea to SemanticAssistTextarea import', () => {
    const state = createInitialDesignerState();
    const withTextarea = designerReducer(state, {
      type: 'insert-palette-item',
      itemId: 'heroui.textarea',
      parentId: state.document.rootNodeId,
    });
    const nodeId = withTextarea.document.nodes[withTextarea.document.rootNodeId].children[0];
    let docState = designerReducer(withTextarea, {
      type: 'set-node-prop',
      nodeId,
      key: 'semanticRubricKind',
      value: 'static',
    });
    docState = designerReducer(docState, {
      type: 'set-node-prop',
      nodeId,
      key: 'semanticRubricStatic',
      value: 'Must be detailed',
    });
    const node = docState.document.nodes[nodeId];
    const spec = resolveTsxComponentSpec(node);

    expect(spec.reactTag).toBe('SemanticAssistTextarea');
    expect(spec.importFrom).toBe('@/shared/ui/ai-field-assist/SemanticAssistTextarea');
  });

  it('resolves hwy institute logo upload to HwyInstituteLogoUploadField', () => {
    const node: DesignerNode = {
      id: 'logo-node',
      type: 'container',
      parentId: 'root',
      order: 0,
      props: { _designerPaletteItemId: 'hwy.institute-logo-upload' },
      layout: {},
      binding: {},
      children: [],
    };
    const spec = resolveTsxComponentSpec(node);
    expect(spec.kind).toBe('library-custom');
    expect(spec.reactTag).toBe('HwyInstituteLogoUploadField');
    expect(spec.importFrom).toBe('@/domain/hwy/HwyInstituteLogoUploadField');
  });
});

describe('tsx codegen integration', () => {
  it('generates DatePicker tag and import instead of fallback div', () => {
    const state = createInitialDesignerState();
    const withDatePicker = designerReducer(state, {
      type: 'insert-palette-item',
      itemId: 'heroui.date-picker',
      parentId: state.document.rootNodeId,
    });
    const nodeId = withDatePicker.document.nodes[withDatePicker.document.rootNodeId].children[0];
    const withProps = designerReducer(withDatePicker, {
      type: 'set-node-prop',
      nodeId,
      key: 'ariaLabel',
      value: 'Pick a date',
    });
    const withStyle = designerReducer(withProps, {
      type: 'set-node-prop',
      nodeId,
      key: 'style',
      value: 'text-align: right; color: red;',
    });

    const tsx = generateDesignerTsx(withStyle.document, withStyle.bindingDefinitions);

    expect(tsx).toContain("import { DesignerDatePickerField } from '@/shared/ui/DesignerFormFields';");
    expect(tsx).toContain('<DesignerDatePickerField');
    expect(tsx).toContain('aria-label="Pick a date"');
    expect(tsx).toContain("style={{ textAlign: 'right', color: 'red' }}");
    expect(tsx).not.toContain('data-node-type');
  });

  it('emits decorative image alt as an empty string', () => {
    const state = createInitialDesignerState();
    const withImage = designerReducer(state, {
      type: 'insert-palette-item',
      itemId: 'html.image',
      parentId: state.document.rootNodeId,
    });

    const tsx = generateDesignerTsx(withImage.document, withImage.bindingDefinitions);

    const generatedJsx = tsx.slice(tsx.indexOf('export const GeneratedComponent'));

    expect(generatedJsx).toContain('alt=""');
    expect(generatedJsx).not.toContain('_designerPaletteItemId');
    expect(generatedJsx).not.toMatch(/className=""/);
  });

  it('passes through HTML attributes on container nodes', () => {
    const state = createInitialDesignerState();
    const withForm = designerReducer(state, {
      type: 'insert-palette-item',
      itemId: 'html.form',
      parentId: state.document.rootNodeId,
    });
    const nodeId = withForm.document.nodes[withForm.document.rootNodeId].children[0];
    const withProps = designerReducer(withForm, {
      type: 'set-node-prop',
      nodeId,
      key: 'action',
      value: '/submit',
    });
    const withMethod = designerReducer(withProps, {
      type: 'set-node-prop',
      nodeId,
      key: 'method',
      value: 'post',
    });
    const withNoValidate = designerReducer(withMethod, {
      type: 'set-node-prop',
      nodeId,
      key: 'noValidate',
      value: true,
    });

    const tsx = generateDesignerTsx(withNoValidate.document, withNoValidate.bindingDefinitions);

    expect(tsx).toContain('<form');
    expect(tsx).toContain('action="/submit"');
    expect(tsx).toContain('method="post"');
    expect(tsx).toContain('noValidate');
  });

  it('emits title on library nodes and avoids duplicate aria-label on Slider', () => {
    const state = createInitialDesignerState();
    const withSlider = designerReducer(state, {
      type: 'insert-palette-item',
      itemId: 'heroui.slider',
      parentId: state.document.rootNodeId,
    });
    const sliderId = withSlider.document.nodes[withSlider.document.rootNodeId].children[0];
    const withSliderProps = ['ariaLabel', 'title', 'dir'].reduce(
      (current, key) => designerReducer(current, {
        type: 'set-node-prop',
        nodeId: sliderId,
        key,
        value: key === 'dir' ? 'rtl' : key === 'title' ? 'test' : 'testrole',
      }),
      withSlider,
    );

    const withDropdown = designerReducer(withSliderProps, {
      type: 'insert-palette-item',
      itemId: 'heroui.dropdown',
      parentId: withSliderProps.document.rootNodeId,
    });
    const dropdownId = withDropdown.document.nodes[withDropdown.document.rootNodeId].children[1];
    const withDropdownTitle = designerReducer(withDropdown, {
      type: 'set-node-prop',
      nodeId: dropdownId,
      key: 'title',
      value: 'test',
    });

    const tsx = generateDesignerTsx(withDropdownTitle.document, withDropdownTitle.bindingDefinitions);
    const sliderLine = tsx.split('\n').find((line) => line.includes('<Slider')) ?? '';

    expect(sliderLine.match(/aria-label=/g)).toHaveLength(1);
    expect(sliderLine).toContain('aria-label="testrole"');
    expect(sliderLine).toContain('title="test"');
    expect(tsx).toMatch(/<Dropdown[^>]*title="test"/);
  });
});
