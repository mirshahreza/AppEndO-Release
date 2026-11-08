import { describe, expect, it } from 'vitest';
import { generateDesignerTsx } from '../codegen';
import { buildPreviewDesignerStoreWithRole } from '../designerPreviewResolvers';
import { compileNodeVisibilityAccessToCondition } from '../designerNodeVisibilityAccess';
import { createInitialDesignerState, designerReducer } from '../state';
import {
  authPrincipalFromAuthUser,
  evaluateDesignerCondition,
  isNodeVisibleForPreviewStore,
  isNodeVisibleForRuntime,
  readNodeVisibleCondition,
} from '../visibilityConditionEngine';
import type { DesignerNode } from '../types';

const roleNode = (condition: string): DesignerNode => ({
  id: 'node-1',
  type: 'text',
  parentId: 'root',
  order: 0,
  props: { text: 'Admin only' },
  layout: { visibleCondition: condition },
  binding: {},
  children: [],
});

const accessNode = (): DesignerNode => ({
  id: 'node-2',
  type: 'text',
  parentId: 'root',
  order: 0,
  props: { text: 'Admin only' },
  layout: {
    visibilityAccess: {
      accessMode: 'specific',
      allowRoles: ['ADMIN'],
      allowUsers: [],
      denyRoles: [],
      denyUsers: [],
    },
    visibleCondition: '["ADMIN"].includes(String(store.user?.role ?? \'\').toUpperCase())',
  },
  binding: {},
  children: [],
});

describe('preview role visibility (CD-J02)', () => {
  it('injects simulated role into store.user.role', () => {
    const store = buildPreviewDesignerStoreWithRole({}, 'ADMIN');
    expect(evaluateDesignerCondition(store, {}, {}, "store.user.role === 'ADMIN'")).toBe(true);
    expect(evaluateDesignerCondition(store, {}, {}, "store.user.role === 'USER'")).toBe(false);
  });

  it('hides nodes when role condition fails', () => {
    const store = buildPreviewDesignerStoreWithRole({}, 'USER');
    const node = roleNode("store.user.role === 'ADMIN'");

    expect(isNodeVisibleForPreviewStore(node, store)).toBe(false);

    const adminStore = buildPreviewDesignerStoreWithRole({}, 'ADMIN');
    expect(isNodeVisibleForPreviewStore(node, adminStore)).toBe(true);
  });

  it('enforces visibilityAccess via access principal', () => {
    const adminPrincipal = authPrincipalFromAuthUser({
      id: 1,
      email: 'admin@example.com',
      role: 'ADMIN',
      roles: ['ADMIN'],
    });
    const userPrincipal = authPrincipalFromAuthUser({
      id: 2,
      email: 'user@example.com',
      role: 'USER',
      roles: ['USER'],
    });

    expect(isNodeVisibleForRuntime(accessNode(), {}, {}, {}, adminPrincipal)).toBe(true);
    expect(isNodeVisibleForRuntime(accessNode(), {}, {}, {}, userPrincipal)).toBe(false);
  });

  it('Preview and Export agree on role-gated visibility (T1-10 ACL parity)', () => {
    let state = createInitialDesignerState();
    state = designerReducer(state, {
      type: 'insert-palette-item',
      itemId: 'html.text',
      parentId: state.document.rootNodeId,
    });
    const adminNodeId = state.document.nodes[state.document.rootNodeId].children[0] as string;
    state = designerReducer(state, {
      type: 'insert-palette-item',
      itemId: 'html.text',
      parentId: state.document.rootNodeId,
    });
    const editorNodeId = state.document.nodes[state.document.rootNodeId].children[1] as string;

    const adminAccess = {
      accessMode: 'specific' as const,
      allowRoles: ['ADMIN'],
      allowUsers: [] as string[],
      denyRoles: [] as string[],
      denyUsers: [] as string[],
    };
    const editorAccess = {
      accessMode: 'specific' as const,
      allowRoles: ['EDITOR'],
      allowUsers: [] as string[],
      denyRoles: [] as string[],
      denyUsers: [] as string[],
    };
    const adminCondition = compileNodeVisibilityAccessToCondition(adminAccess)!;
    const editorCondition = compileNodeVisibilityAccessToCondition(editorAccess)!;

    state = {
      ...state,
      document: {
        ...state.document,
        nodes: {
          ...state.document.nodes,
          [adminNodeId]: {
            ...state.document.nodes[adminNodeId]!,
            props: { ...state.document.nodes[adminNodeId]!.props, text: 'Admin panel' },
            layout: {
              ...state.document.nodes[adminNodeId]!.layout,
              visibilityAccess: adminAccess,
              visibleCondition: adminCondition,
            },
          },
          [editorNodeId]: {
            ...state.document.nodes[editorNodeId]!,
            props: { ...state.document.nodes[editorNodeId]!.props, text: 'Editor tools' },
            layout: {
              ...state.document.nodes[editorNodeId]!.layout,
              visibilityAccess: editorAccess,
              visibleCondition: editorCondition,
            },
          },
        },
      },
    };

    const adminNode = state.document.nodes[adminNodeId]!;
    const editorNode = state.document.nodes[editorNodeId]!;

    // Export embeds the same condition string Preview evaluates.
    expect(readNodeVisibleCondition(adminNode)).toBe(adminCondition);
    expect(readNodeVisibleCondition(editorNode)).toBe(editorCondition);

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    expect(tsx).toContain('function evaluateDesignerCondition');
    // Export passes the condition through JSON.stringify into evaluateDesignerCondition(...).
    expect(tsx).toContain(JSON.stringify(adminCondition));
    expect(tsx).toContain(JSON.stringify(editorCondition));

    const adminStore = buildPreviewDesignerStoreWithRole({}, 'ADMIN');
    const editorStore = buildPreviewDesignerStoreWithRole({}, 'EDITOR');
    const userStore = buildPreviewDesignerStoreWithRole({}, 'USER');

    expect(isNodeVisibleForPreviewStore(adminNode, adminStore)).toBe(true);
    expect(isNodeVisibleForPreviewStore(editorNode, adminStore)).toBe(false);
    expect(isNodeVisibleForPreviewStore(adminNode, editorStore)).toBe(false);
    expect(isNodeVisibleForPreviewStore(editorNode, editorStore)).toBe(true);
    expect(isNodeVisibleForPreviewStore(adminNode, userStore)).toBe(false);
    expect(isNodeVisibleForPreviewStore(editorNode, userStore)).toBe(false);

    // Export-path evaluation of the same condition strings must match Preview.
    expect(evaluateDesignerCondition(adminStore, {}, {}, adminCondition)).toBe(true);
    expect(evaluateDesignerCondition(adminStore, {}, {}, editorCondition)).toBe(false);
    expect(evaluateDesignerCondition(editorStore, {}, {}, adminCondition)).toBe(false);
    expect(evaluateDesignerCondition(editorStore, {}, {}, editorCondition)).toBe(true);
  });
});
