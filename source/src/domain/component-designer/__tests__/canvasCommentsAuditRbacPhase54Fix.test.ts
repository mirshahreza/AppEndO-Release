/**
 * Bug found (gap analysis #20/#21/#22 / Phase 54): zero canvas comments / audit log / presence
 * in designer state; studio editor access was hard-coded ADMIN-only (requireRole) while
 * designerPageAccess.ts only covers published consumer page RBAC.
 * Fixed in canvasComments.ts / draftAuditDiff.ts / draftAuditLog.ts /
 * canvasCommentsStore.ts / builderFolderPermissions.ts / state.ts / service+routes:
 * sidecar comments, append-only prop-level audit on PUT drafts, folderPermissions RBAC
 * (designerPageAccess untouched).
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createInitialDesignerState, designerReducer } from '../state';
import { computeDesignerDraftAuditChanges } from '../draftAuditDiff';
import { createCanvasCommentId, type DesignerCanvasComment } from '../canvasComments';
import {
  buildDesignerPageDefaultRolesJson,
  resolveDesignerDocumentPageAccess,
} from '../designerPageAccess';
import type { DesignerDocument, DesignerNode } from '../types';

let tmpDir = '';
let origCwd = '';

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'designer-phase54-'));
  origCwd = process.cwd();
  process.chdir(tmpDir);
  vi.resetModules();
});

afterEach(() => {
  process.chdir(origCwd);
  fs.rmSync(tmpDir, { recursive: true, force: true });
  vi.resetModules();
});

const makeNode = (
  partial: Partial<DesignerNode> & Pick<DesignerNode, 'id' | 'type'>,
): DesignerNode => ({
  parentId: 'root',
  order: 0,
  props: {},
  layout: {},
  binding: {},
  children: [],
  ...partial,
});

const cloneDoc = (document: DesignerDocument): DesignerDocument =>
  JSON.parse(JSON.stringify(document)) as DesignerDocument;

describe('Phase 54 — Canvas Comments + Audit Log + Builder RBAC', () => {
  it('add-canvas-comment stores a pin in DesignerState without dirtying the document', () => {
    const initial = createInitialDesignerState();
    expect(initial.canvasComments).toEqual([]);
    expect(initial.isDirty).toBe(false);

    const comment: DesignerCanvasComment = {
      id: createCanvasCommentId(),
      draftId: initial.document.id,
      nodeId: initial.document.rootNodeId,
      body: 'Please widen this section',
      author: 'designer@example.com',
      createdAt: new Date().toISOString(),
    };

    const next = designerReducer(initial, { type: 'add-canvas-comment', comment });
    expect(next.canvasComments).toHaveLength(1);
    expect(next.canvasComments[0]?.body).toBe('Please widen this section');
    expect(next.isDirty).toBe(false);
    expect(next.document.metadata.updatedAt).toBe(initial.document.metadata.updatedAt);
  });

  it('computeDesignerDraftAuditChanges emits exact prop before/after for a node prop change', () => {
    const base = createInitialDesignerState().document;
    const previous = cloneDoc(base);
    previous.nodes = {
      ...previous.nodes,
      btn1: makeNode({
        id: 'btn1',
        type: 'button',
        props: { label: 'Save', _designerPaletteItemId: 'heroui.button' },
      }),
    };
    previous.nodes.root = {
      ...previous.nodes.root!,
      children: ['btn1'],
    };

    const next = cloneDoc(previous);
    next.nodes.btn1 = {
      ...next.nodes.btn1!,
      props: { ...next.nodes.btn1!.props, label: 'Submit' },
    };

    const changes = computeDesignerDraftAuditChanges(previous, next);
    const propChange = changes.find(
      (entry) => entry.kind === 'prop-change' && entry.nodeId === 'btn1' && entry.propKey === 'label',
    );
    expect(propChange).toEqual({
      kind: 'prop-change',
      nodeId: 'btn1',
      propKey: 'label',
      before: 'Save',
      after: 'Submit',
    });
  });

  it('PUT draft update records an audit log entry with who / prop / before / after', async () => {
    const { saveDesignerDraft } = await import('../../../server/services/component-designer/draftCoordinator.service');
    const { ComponentDesignerService } = await import('../../../server/services/component-designer.service');
    const { listDesignerDraftAuditLog, clearDesignerDraftAuditLogForTests } = await import(
      '../../../server/domain/component-designer/draftAuditLog'
    );

    const initial = createInitialDesignerState('Audit Target');
    const withSection = designerReducer(initial, {
      type: 'insert-palette-item',
      itemId: 'html.container',
      parentId: initial.document.rootNodeId,
    });
    const sectionId = withSection.document.nodes[withSection.document.rootNodeId]?.children[0];
    expect(sectionId).toBeTruthy();

    const withText = designerReducer(withSection, {
      type: 'insert-palette-item',
      itemId: 'html.text',
      parentId: sectionId!,
    });
    const textId = withText.document.nodes[sectionId!]?.children[0];
    expect(textId).toBeTruthy();

    const labeled = designerReducer(withText, {
      type: 'set-node-prop',
      nodeId: textId!,
      key: 'text',
      value: 'Before Label',
    });

    const saved = saveDesignerDraft({
      name: 'Audit Target',
      folder: 'general',
      document: labeled.document,
      bindingDefinitions: labeled.bindingDefinitions as unknown as Record<string, import('../types').DesignerBindingDefinition>,
      actor: 'auditor@example.com',
    });

    clearDesignerDraftAuditLogForTests(saved.id);

    const nextDocument = cloneDoc(labeled.document);
    nextDocument.nodes[textId!] = {
      ...nextDocument.nodes[textId!]!,
      props: {
        ...nextDocument.nodes[textId!]!.props,
        text: 'After Label',
      },
    };

    const service = new ComponentDesignerService({ serverPort: 0 });
    service.updateDraft(
      saved.id,
      { document: nextDocument },
      'auditor@example.com',
      ['ADMIN'],
    );

    const entries = listDesignerDraftAuditLog(saved.id);
    expect(entries.length).toBeGreaterThanOrEqual(1);
    const latest = entries[entries.length - 1]!;
    expect(latest.actor).toBe('auditor@example.com');
    expect(latest.draftId).toBe(saved.id);
    expect(typeof latest.at).toBe('string');

    const propChange = latest.changes.find(
      (change) =>
        change.kind === 'prop-change'
        && change.nodeId === textId
        && change.propKey === 'text',
    );
    expect(propChange).toMatchObject({
      kind: 'prop-change',
      nodeId: textId,
      propKey: 'text',
      before: 'Before Label',
      after: 'After Label',
    });
  });

  it('canvas comments persist under workspace/designer/comments/{draftId}.json', async () => {
    const { addDesignerCanvasComment, listDesignerCanvasComments, draftCommentsPath } = await import(
      '../../../server/domain/component-designer/canvasCommentsStore'
    );

    const draftId = 'draft-comments-phase54';
    const comment = addDesignerCanvasComment(
      draftId,
      { body: 'Pin me', nodeId: 'node-a' },
      'author@example.com',
    );

    expect(comment.body).toBe('Pin me');
    expect(listDesignerCanvasComments(draftId)).toHaveLength(1);
    expect(fs.existsSync(draftCommentsPath(draftId))).toBe(true);

    const raw = JSON.parse(fs.readFileSync(draftCommentsPath(draftId), 'utf8')) as {
      schema: string;
      comments: unknown[];
    };
    expect(raw.schema).toBe('designer-canvas-comments');
    expect(raw.comments).toHaveLength(1);
  });

  it('builder folderPermissions grants DESIGNER access to one folder and denies another', async () => {
    const {
      setBuilderFolderPermissions,
      canAccessBuilderFolder,
      resetBuilderFolderPermissionsForTests,
    } = await import('../../../server/domain/component-designer/builderFolderPermissions');

    resetBuilderFolderPermissionsForTests();
    setBuilderFolderPermissions({
      defaultRoles: ['ADMIN'],
      folderPermissions: {
        marketing: ['DESIGNER', 'ADMIN'],
      },
    });

    expect(canAccessBuilderFolder('marketing', ['DESIGNER'])).toBe(true);
    expect(canAccessBuilderFolder('internal', ['DESIGNER'])).toBe(false);
    expect(canAccessBuilderFolder('internal', ['ADMIN'])).toBe(true);
    expect(canAccessBuilderFolder('marketing', ['ADMIN'])).toBe(true);
  });

  it('designerPageAccess (consumer RBAC) remains independent and untouched in behavior', () => {
    const document = createInitialDesignerState().document;
    document.pageAccess = {
      accessMode: 'specific',
      allowRoles: ['USER'],
      allowUsers: [],
      denyRoles: [],
      denyUsers: [],
    };
    const resolved = resolveDesignerDocumentPageAccess(document);
    expect(resolved.allowRoles).toContain('USER');
    const json = buildDesignerPageDefaultRolesJson(document);
    expect(json).toContain('USER');
  });
});
