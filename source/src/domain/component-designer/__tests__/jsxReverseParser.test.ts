import { describe, expect, it } from 'vitest';
import { generateDesignerTsx, syncCodeToCanvas } from '../codegen';
import { DESIGNER_GENERATED_ROOT_CLASS } from '../designerGeneratedRoot';
import { createInitialDesignerState, designerReducer } from '../state';

const editGeneratedComponentJsx = (tsx: string, replacer: (jsxBody: string) => string): string => {
  const marker = 'export const GeneratedComponent';
  const markerIndex = tsx.indexOf(marker);
  if (markerIndex < 0) {
    throw new Error('Generated component marker not found.');
  }

  return `${tsx.slice(0, markerIndex)}${replacer(tsx.slice(markerIndex))}`;
};

describe('component designer jsx reverse parser', () => {
  const createPopulatedState = () => {
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

  it('emits the height-capable generated root wrapper and default text markup', () => {
    const state = createPopulatedState();
    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    expect(tsx).toContain(`<div className="${DESIGNER_GENERATED_ROOT_CLASS}">`);
    expect(tsx).toContain('<p className="!text-sm text-default-700">Sample text</p>');
  });

  it('unwraps the height-capable generated root so JSX edits apply to document nodes', () => {
    const state = createInitialDesignerState();
    const tsx = [
      "import React from 'react';",
      '',
      'export const GeneratedComponent: React.FC = () => {',
      '  return (',
      `    <div className="${DESIGNER_GENERATED_ROOT_CLASS}">`,
      '      <p className="text-sm text-default-700">Hello from wrapper</p>',
      '    </div>',
      '  );',
      '};',
      '',
    ].join('\n');

    const result = syncCodeToCanvas({
      format: 'tsx',
      code: tsx,
      currentDocument: state.document,
      currentBindingDefinitions: state.bindingDefinitions,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    const wrapper = Object.values(result.document.nodes).find(
      (node) => node.type === 'container' && node.props.className === DESIGNER_GENERATED_ROOT_CLASS,
    );
    expect(wrapper).toBeUndefined();
    const textNode = Object.values(result.document.nodes).find((node) => node.type === 'text');
    expect(textNode?.props.text).toBe('Hello from wrapper');
  });

  it('parses JSX body edits back into the designer document tree', () => {
    const state = createPopulatedState();
    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    const editedTsx = editGeneratedComponentJsx(tsx, (jsxBody) => jsxBody.replace(
      '<p className="!text-sm text-default-700">Sample text</p>',
      '<p className="!text-sm text-default-700">Updated from JSX</p>',
    ));

    const result = syncCodeToCanvas({
      format: 'tsx',
      code: editedTsx,
      currentDocument: state.document,
      currentBindingDefinitions: state.bindingDefinitions,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    const textNode = Object.values(result.document.nodes).find((node) => node.type === 'text');
    expect(textNode?.props.text).toBe('Updated from JSX');
    expect(result.jsxStructureFingerprint).toBeTruthy();
  });

  it('preserves node ids when JSX structure is unchanged aside from prop edits', () => {
    const state = createPopulatedState();
    const originalTextNodeId = Object.values(state.document.nodes).find((node) => node.type === 'text')?.id;
    expect(originalTextNodeId).toBeTruthy();

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    const editedTsx = editGeneratedComponentJsx(tsx, (jsxBody) => jsxBody.replace(
      '<p className="!text-sm text-default-700">Sample text</p>',
      '<p className="!text-sm text-default-700">Only the copy changed</p>',
    ));

    const result = syncCodeToCanvas({
      format: 'tsx',
      code: editedTsx,
      currentDocument: state.document,
      currentBindingDefinitions: state.bindingDefinitions,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.document.nodes[originalTextNodeId as string]?.props.text).toBe('Only the copy changed');
  });

  it('rejects invalid JSX without mutating the document contract', () => {
    const state = createPopulatedState();
    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    const brokenTsx = tsx.replace('</p>', '');

    const result = syncCodeToCanvas({
      format: 'tsx',
      code: brokenTsx,
      currentDocument: state.document,
      currentBindingDefinitions: state.bindingDefinitions,
    });

    expect(result.ok).toBe(false);
    if (result.ok === false) {
      expect(result.diagnostics[0]?.code).toBe('parse-tsx');
      expect(result.diagnostics[0]?.message.toLowerCase()).toContain('jsx');
    }
  });

  it('maps newly added div containers from raw JSX into container nodes', () => {
    const state = createPopulatedState();
    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    const editedTsx = editGeneratedComponentJsx(tsx, (jsxBody) => jsxBody.replace(
      '<div className="!min-h-6">',
      '<div className="!min-h-6">\n        <div className="rounded border p-2">Manual block</div>',
    ));

    const result = syncCodeToCanvas({
      format: 'tsx',
      code: editedTsx,
      currentDocument: state.document,
      currentBindingDefinitions: state.bindingDefinitions,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    const manualNode = Object.values(result.document.nodes).find(
      (node) => node.type === 'container'
        && typeof node.props.className === 'string'
        && node.props.className.includes('rounded border p-2'),
    );
    expect(manualNode).toBeTruthy();
  });

  it('falls back to generic container nodes for unsupported JSX components', () => {
    const state = createInitialDesignerState();
    const tsx = [
      "import React from 'react';",
      '',
      '/*__DESIGNER_JSON_START__',
      JSON.stringify({
        schema: 'component-designer-export',
        version: '1.0.0',
        document: state.document,
        bindingDefinitions: state.bindingDefinitions,
      }),
      '__DESIGNER_JSON_END__*/',
      '',
      'export const GeneratedComponent: React.FC = () => {',
      '  return (',
      '    <div className="space-y-3">',
      '      <CustomWidget className="p-2" />',
      '    </div>',
      '  );',
      '};',
      '',
    ].join('\n');

    const result = syncCodeToCanvas({
      format: 'tsx',
      code: tsx,
      currentDocument: state.document,
      currentBindingDefinitions: state.bindingDefinitions,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    const customNode = Object.values(result.document.nodes).find(
      (node) => node.props._jsxSourceTag === 'CustomWidget',
    );
    expect(customNode?.type).toBe('container');
  });

  it('maps aria-describedby and title attributes from JSX back into node props', () => {
    const state = createInitialDesignerState();
    const tsx = [
      "import React from 'react';",
      '',
      '/*__DESIGNER_JSON_START__',
      JSON.stringify({
        schema: 'component-designer-export',
        version: '1.0.0',
        document: state.document,
        bindingDefinitions: state.bindingDefinitions,
      }),
      '__DESIGNER_JSON_END__*/',
      '',
      'export const GeneratedComponent: React.FC = () => {',
      '  return (',
      '    <div className="space-y-3">',
      '      <p className="text-sm text-slate-700" aria-describedby="hint" title="Caption">Hello</p>',
      '    </div>',
      '  );',
      '};',
      '',
    ].join('\n');

    const result = syncCodeToCanvas({
      format: 'tsx',
      code: tsx,
      currentDocument: state.document,
      currentBindingDefinitions: state.bindingDefinitions,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    const textNode = Object.values(result.document.nodes).find((node) => node.type === 'text');
    expect(textNode?.props.ariaDescribedby).toBe('hint');
    expect(textNode?.props.title).toBe('Caption');
  });

  it('syncs tailwind utility keys when className is edited in JSX', () => {
    const state = createPopulatedState();
    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    const editedTsx = editGeneratedComponentJsx(tsx, (jsxBody) => jsxBody.replace(
      'className="!min-h-6"',
      'className="!min-h-6 flex flex-col gap-4"',
    ));

    const result = syncCodeToCanvas({
      format: 'tsx',
      code: editedTsx,
      currentDocument: state.document,
      currentBindingDefinitions: state.bindingDefinitions,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    const containerNode = Object.values(result.document.nodes).find(
      (node) => node.type === 'container' && typeof node.props.className === 'string' && node.props.className.includes('gap-4'),
    );
    expect(containerNode?.props.twFlexDirection).toBe('flex-col');
    expect(containerNode?.props.twGap).toBe('gap-4');
  });

  it('reconstructs property bindings from dataContext JSX attribute expressions', () => {
    const state = createInitialDesignerState();
    const tsx = [
      "import React from 'react';",
      '',
      '/*__DESIGNER_JSON_START__',
      JSON.stringify({
        schema: 'component-designer-export',
        version: '1.0.0',
        document: state.document,
        bindingDefinitions: state.bindingDefinitions,
      }),
      '__DESIGNER_JSON_END__*/',
      '',
      'export const GeneratedComponent: React.FC = () => {',
      '  const [dataContext, setDataContext] = React.useState<Record<string, unknown> | null>(null);',
      '  return (',
      '    <div className="space-y-3">',
      '      <Input defaultValue={dataContext?.user?.email} placeholder="Email" />',
      '    </div>',
      '  );',
      '};',
      '',
    ].join('\n');

    const result = syncCodeToCanvas({
      format: 'tsx',
      code: tsx,
      currentDocument: state.document,
      currentBindingDefinitions: state.bindingDefinitions,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    const inputNode = Object.values(result.document.nodes).find(
      (node) => node.props._designerPaletteItemId === 'heroui.input-text',
    );
    expect(inputNode?.binding['prop:placeholder']?.dataPath).toBe('user.email');
    expect(inputNode?.binding['prop:placeholder']?.bindingRole).toBe('property');
    expect(inputNode?.props.placeholder).toBe('Email');
  });

  it('reconstructs text content bindings from dynamic JSX children', () => {
    const state = createInitialDesignerState();
    const tsx = [
      "import React from 'react';",
      '',
      '/*__DESIGNER_JSON_START__',
      JSON.stringify({
        schema: 'component-designer-export',
        version: '1.0.0',
        document: state.document,
        bindingDefinitions: state.bindingDefinitions,
      }),
      '__DESIGNER_JSON_END__*/',
      '',
      'export const GeneratedComponent: React.FC = () => {',
      '  const [dataContext, setDataContext] = React.useState<Record<string, unknown> | null>(null);',
      '  return (',
      '    <div className="space-y-3">',
      '      <h2 className="text-2xl font-semibold">{dataContext?.pageTitle}</h2>',
      '    </div>',
      '  );',
      '};',
      '',
    ].join('\n');

    const result = syncCodeToCanvas({
      format: 'tsx',
      code: tsx,
      currentDocument: state.document,
      currentBindingDefinitions: state.bindingDefinitions,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    const headingNode = Object.values(result.document.nodes).find((node) => node.type === 'heading');
    expect(headingNode?.binding['prop:text']?.dataPath).toBe('pageTitle');
    expect(headingNode?.props.text).toBeUndefined();
  });

  it('round-trips card, modal, and select structures without flattening them to generic containers', () => {
    let state = createInitialDesignerState();
    state = designerReducer(state, {
      type: 'insert-palette-item',
      itemId: 'heroui.card',
      parentId: state.document.rootNodeId,
    });
    const cardId = state.document.nodes[state.document.rootNodeId].children[0]!;
    state = designerReducer(state, {
      type: 'insert-palette-item',
      itemId: 'html.text',
      parentId: cardId,
    });
    state = designerReducer(state, {
      type: 'insert-palette-item',
      itemId: 'heroui.modal',
      parentId: state.document.rootNodeId,
    });
    state = designerReducer(state, {
      type: 'insert-palette-item',
      itemId: 'heroui.select',
      parentId: state.document.rootNodeId,
    });

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    const result = syncCodeToCanvas({
      format: 'tsx',
      code: tsx,
      currentDocument: state.document,
      currentBindingDefinitions: state.bindingDefinitions,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    const paletteIds = Object.values(result.document.nodes)
      .map((node) => node.props._designerPaletteItemId)
      .filter((value): value is string => typeof value === 'string');
    expect(paletteIds).toContain('heroui.card');
    expect(paletteIds).toContain('heroui.modal');
    expect(paletteIds).toContain('heroui.select');
    expect(
      Object.values(result.document.nodes).some((node) => node.props._jsxSourceTag === 'Card.Content'),
    ).toBe(false);
    expect(
      Object.values(result.document.nodes).some((node) => node.props._jsxSourceTag === 'Modal.Body'),
    ).toBe(false);
  });
});
