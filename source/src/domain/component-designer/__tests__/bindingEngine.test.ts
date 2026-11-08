import { describe, expect, it } from 'vitest';
import { generateDesignerJsonString, generateDesignerTsx, parseDesignerJson, syncCodeToCanvas } from '../codegen';
import {
  collectDocumentBindingPlan,
  createEventBindingDefinition,
  createPropertyBindingDefinition,
  dataPathToOptionalChainExpression,
  formatBoundPlaceholder,
  propertyBindingKeyForProp,
  resolveBoundCanvasTextContent,
  resolveDesignerEventJsxAttributeName,
  resolveNodeEventBindingTargets,
} from '../bindingEngine';
import { createInitialDesignerState, designerReducer } from '../state';
import type { DesignerNode } from '../types';

const withBinding = (
  state: ReturnType<typeof createInitialDesignerState>,
  nodeId: string,
  bindingKey: string,
  definition: ReturnType<typeof createPropertyBindingDefinition>,
) => designerReducer(state, {
  type: 'set-node-binding',
  nodeId,
  bindingKey,
  definition,
});

describe('component designer binding engine', () => {
  it('formats canvas placeholders for bound properties', () => {
    const node: DesignerNode = {
      id: 'heading-1',
      type: 'heading',
      parentId: 'root',
      order: 0,
      props: { text: 'Static title' },
      layout: {},
      binding: {
        [propertyBindingKeyForProp('text')]: createPropertyBindingDefinition('text', 'page.title'),
      },
      children: [],
    };

    expect(formatBoundPlaceholder('user.email')).toBe('[Bound: user.email]');
    expect(resolveBoundCanvasTextContent(node, 'Fallback')).toBe('[Bound: page.title]');
  });

  it('builds optional chaining expressions for codegen', () => {
    expect(dataPathToOptionalChainExpression('user.email')).toBe('dataContext?.user?.email');
  });

  it('collects property and event bindings from the document', () => {
    let state = createInitialDesignerState();
    state = designerReducer(state, {
      type: 'insert-palette-item',
      itemId: 'heroui.input-text',
      parentId: state.document.rootNodeId,
    });
    const inputId = state.document.nodes[state.document.rootNodeId].children[0];

    state = withBinding(
      state,
      inputId,
      propertyBindingKeyForProp('placeholder'),
      createPropertyBindingDefinition('placeholder', 'user.email', {
        fetchEndpoint: '/api/v1/user/profile',
      }),
    );

    state = designerReducer(state, {
      type: 'insert-palette-item',
      itemId: 'html.form',
      parentId: state.document.rootNodeId,
    });
    const formId = state.document.nodes[state.document.rootNodeId].children[1];
    state = designerReducer(state, {
      type: 'set-node-binding',
      nodeId: formId,
      bindingKey: 'event:onSubmit',
      definition: createEventBindingDefinition('onSubmit', '/api/v1/user/update', 'PUT', { email: 'email' }),
    });

    const plan = collectDocumentBindingPlan(state.document, state.bindingDefinitions);
    expect(plan.propertyBindings.some((item) => item.targetProp === 'placeholder')).toBe(true);
    expect(plan.eventBindings.some((item) => item.targetEvent === 'onSubmit')).toBe(true);
    expect(plan.hydrationEndpoints).toContain('/api/v1/user/profile');
  });

  it('resolves expanded event binding targets for form inputs and buttons', () => {
    let state = createInitialDesignerState();
    state = designerReducer(state, {
      type: 'insert-palette-item',
      itemId: 'heroui.input-text',
      parentId: state.document.rootNodeId,
    });
    const inputNode = state.document.nodes[state.document.nodes[state.document.rootNodeId].children[0]];

    expect(resolveNodeEventBindingTargets(inputNode)).toEqual(['onChange', 'onBlur', 'onKeyDown', 'onKeyUp', 'onHover']);
    expect(resolveDesignerEventJsxAttributeName('onHover')).toBe('onMouseEnter');
    expect(resolveDesignerEventJsxAttributeName('onKeyDown')).toBe('onKeyDown');
  });

  it('generates keyboard event handlers with key payload in TSX output', () => {
    let state = createInitialDesignerState();
    state = designerReducer(state, {
      type: 'insert-palette-item',
      itemId: 'heroui.input-text',
      parentId: state.document.rootNodeId,
    });
    const inputId = state.document.nodes[state.document.rootNodeId].children[0];

    state = designerReducer(state, {
      type: 'set-node-binding',
      nodeId: inputId,
      bindingKey: 'event:onKeyDown',
      definition: createEventBindingDefinition('onKeyDown', '/api/v1/search', 'POST'),
    });

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    expect(tsx).toContain('onKeyDown={handleonKeyDown_');
    expect(tsx).toContain('event.key');
    expect(tsx).toContain('event.code');
  });

  it('generates onChange handlers and mouse enter bindings in TSX output', () => {
    let state = createInitialDesignerState();
    state = designerReducer(state, {
      type: 'insert-palette-item',
      itemId: 'heroui.input-text',
      parentId: state.document.rootNodeId,
    });
    const inputId = state.document.nodes[state.document.rootNodeId].children[0];

    state = designerReducer(state, {
      type: 'set-node-binding',
      nodeId: inputId,
      bindingKey: 'event:onChange',
      definition: createEventBindingDefinition('onChange', '/api/v1/user/update', 'POST'),
    });

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    expect(tsx).toContain('onChange={handleonChange_');
    expect(tsx).toContain('event.target.value');
  });
});

describe('component designer binding codegen', () => {
  it('generates hydration state, fetch effect, and bound JSX attributes', () => {
    let state = createInitialDesignerState();
    state = designerReducer(state, {
      type: 'insert-palette-item',
      itemId: 'heroui.input-text',
      parentId: state.document.rootNodeId,
    });
    const inputId = state.document.nodes[state.document.rootNodeId].children[0];

    state = withBinding(
      state,
      inputId,
      propertyBindingKeyForProp('placeholder'),
      createPropertyBindingDefinition('placeholder', 'user.email', {
        fetchEndpoint: '/api/v1/user/profile',
      }),
    );

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);

    expect(tsx).toContain('function useDataFetch<T>');
    expect(tsx).toContain('refresh: refreshDataContext } = useDataFetch');
    expect(tsx).toContain('method: "GET"');
    expect(tsx).toContain('defaultValue={dataContext?.user?.email}');
  });

  it('generates URL params, headers, nested payloads, and mutation error handling', () => {
    let state = createInitialDesignerState();
    state = designerReducer(state, {
      type: 'insert-palette-item',
      itemId: 'html.form',
      parentId: state.document.rootNodeId,
    });
    const formId = state.document.nodes[state.document.rootNodeId].children[0];

    state = designerReducer(state, {
      type: 'set-node-binding',
      nodeId: formId,
      bindingKey: 'event:onSubmit',
      definition: createEventBindingDefinition(
        'onSubmit',
        '/api/v1/users/{userId}',
        'PUT',
        { 'user.profile.email': 'email' },
        {
          urlParams: { userId: 'route.userId' },
          headers: { Authorization: 'Bearer {token}' },
        },
      ),
    });

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    expect(tsx).toContain('resolveBindingUrl("/api/v1/users/{userId}"');
    expect(tsx).toContain('"userId": "route.userId"');
    expect(tsx).toContain('Bearer {token}');
    expect(tsx).toContain('setNestedPayloadValue(payload, "user.profile.email"');
    expect(tsx).toContain("toast(mutationFailure instanceof Error ? mutationFailure.message : 'Request failed', { variant: 'danger' })");
    expect(tsx).toContain('parseApiErrorMessage(response)');
    expect(tsx).not.toContain('const [mutationError, setMutationError]');
  });

  it('generates submit handlers for form event bindings', () => {
    let state = createInitialDesignerState();
    state = designerReducer(state, {
      type: 'insert-palette-item',
      itemId: 'html.form',
      parentId: state.document.rootNodeId,
    });
    const formId = state.document.nodes[state.document.rootNodeId].children[0];

    state = designerReducer(state, {
      type: 'set-node-binding',
      nodeId: formId,
      bindingKey: 'event:onSubmit',
      definition: createEventBindingDefinition('onSubmit', '/api/v1/user/update', 'PUT'),
    });

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    expect(tsx).toContain('const [isSubmitting, setIsSubmitting] = React.useState(false);');
    expect(tsx).toContain('resolveBindingUrl("/api/v1/user/update"');
    expect(tsx).toContain('onSubmit={handleonSubmit_');
  });

  it('round-trips binding metadata through designer meta sidecar', () => {
    let state = createInitialDesignerState();
    state = designerReducer(state, {
      type: 'insert-palette-item',
      itemId: 'html.heading',
      parentId: state.document.rootNodeId,
    });
    const headingId = state.document.nodes[state.document.rootNodeId].children[0];
    state = withBinding(
      state,
      headingId,
      propertyBindingKeyForProp('text'),
      createPropertyBindingDefinition('text', 'page.title', {
        fetchEndpoint: '/api/v1/page',
      }),
    );

    const meta = generateDesignerJsonString(state.document, state.bindingDefinitions);
    const parsed = parseDesignerJson(meta);
    const parsedNode = parsed.document.nodes[headingId];

    expect(parsedNode.binding[propertyBindingKeyForProp('text')].dataPath).toBe('page.title');
    expect(parsedNode.binding[propertyBindingKeyForProp('text')].fetchEndpoint).toBe('/api/v1/page');
  });

  it('reverse-parses dataContext JSX bindings into node binding state', () => {
    let state = createInitialDesignerState();
    state = designerReducer(state, {
      type: 'insert-palette-item',
      itemId: 'heroui.input-text',
      parentId: state.document.rootNodeId,
    });
    const inputId = state.document.nodes[state.document.rootNodeId].children[0];

    state = withBinding(
      state,
      inputId,
      propertyBindingKeyForProp('placeholder'),
      createPropertyBindingDefinition('placeholder', 'user.email'),
    );

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    const editedTsx = tsx.replace(
      'defaultValue={dataContext?.user?.email}',
      'defaultValue={dataContext?.profile?.email}',
    );

    const synced = syncCodeToCanvas({
      format: 'tsx',
      code: editedTsx,
      currentDocument: state.document,
      currentBindingDefinitions: state.bindingDefinitions,
    });

    expect(synced.ok).toBe(true);
    if (!synced.ok) {
      return;
    }

    const inputNode = synced.document.nodes[inputId];
    expect(inputNode.binding[propertyBindingKeyForProp('placeholder')]?.dataPath).toBe('profile.email');
  });
});
