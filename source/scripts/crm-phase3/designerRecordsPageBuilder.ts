/**
 * Records-style Designer page builder (grid + modals).
 * Uses Component Designer reducer + Auto Form merge for create/edit overlays.
 */

import {
  mergeAutoFormIntoDocument,
  type AutoFormFieldConfig,
} from '../../src/domain/component-designer/autoFormTemplateBuilder';
import type { FormBindingSuccessBehavior } from '../../src/domain/component-designer/bindingResourceModel';
import type { ApiFormField } from '../../src/domain/component-designer/apiFieldSchema';
import { humanizeFieldName, mapApiFieldToControl } from '../../src/domain/component-designer/apiFieldToControl';
import {
  createDynamicAction,
  createDynamicActionsEventBindingDefinition,
  visibilityStorePathForNode,
} from '../../src/domain/component-designer/bindingDynamicActionsEngine';
import { cloneTemplateSeedsToNodes } from '../../src/domain/component-designer/builtInTemplateClone';
import {
  createActionGroupColumn,
  type DesignerGridRowAction,
  type DesignerGridRowActionBehavior,
} from '../../src/domain/component-designer/designerGridActionColumns';
import {
  parseDesignerAppTableGridColumns,
  serializeDesignerDataGridColumns,
  type DesignerDataGridColumn,
} from '../../src/domain/component-designer/designerDataGridColumns';
import {
  parseDesignerGridToolbarConfig,
  serializeDesignerGridToolbarConfig,
  type DesignerGridToolbarConfig,
} from '../../src/domain/component-designer/designerGridToolbarConfig';
import { DESIGNER_PALETTE_ITEM_ID_PROP } from '../../src/domain/component-designer/propRegistry';
import { createInitialDesignerState, designerReducer } from '../../src/domain/component-designer/state';
import {
  DESIGNER_DIALOG_CANCEL_BUTTON_CLASS,
  DESIGNER_DIALOG_CREATE_BUTTON_CLASS,
  DESIGNER_DIALOG_DESTRUCTIVE_BUTTON_CLASS,
  DESIGNER_DIALOG_FOOTER_ACTIONS_CLASS,
  DESIGNER_DIALOG_PRIMARY_BUTTON_CLASS,
} from '../../src/domain/component-designer/designerModalChrome';
import type {
  DataSourceDefinition,
  DesignerBindingDefinitions,
  DesignerDocument,
  DesignerNode,
  DesignerState,
  TemplateNodeSeed,
} from '../../src/domain/component-designer/types';

export type RecordsCrudPageActions = {
  create: boolean;
  edit: boolean;
  delete: boolean;
};

export type RecordsCrudPageBuildResult = {
  state: DesignerState;
  gridNodeId: string;
  createModalNodeId: string | null;
  editModalNodeId: string | null;
  deleteDialogNodeId: string | null;
};

export type StandaloneFormOverlayBuildResult = {
  state: DesignerState;
  modalNodeId: string;
};

export type ConfirmMutationOverlayBuildResult = {
  state: DesignerState;
  dialogNodeId: string;
};

const selectionStorePathForPrimaryKey = (primaryKey: string): string => `selection.${primaryKey}`;

const openModalBehavior = (
  modalNodeId: string,
  primaryKey: string,
): DesignerGridRowActionBehavior => ({
  kind: 'open-modal',
  modalNodeId,
  primaryKeyField: primaryKey,
  selectionStorePath: selectionStorePathForPrimaryKey(primaryKey),
});

const buildOverlayShellSeed = (
  paletteItemId: 'heroui.modal' | 'heroui.alert-dialog',
  title: string,
  options: { tone?: 'default' | 'danger' } = {},
): TemplateNodeSeed => ({
  type: 'container',
  paletteItemId,
  props: {
    title,
    // Create/Edit Base Components default form shell uses lg; confirms use sm.
    size: paletteItemId === 'heroui.modal' ? 'lg' : 'sm',
    isOpen: false,
    ...(paletteItemId === 'heroui.alert-dialog'
      ? { tone: options.tone ?? 'danger' }
      : {}),
  },
});

const appendChildrenToNode = (
  document: DesignerDocument,
  parentId: string,
  childIds: string[],
  childNodes: Record<string, DesignerNode>,
): DesignerDocument => {
  const parent = document.nodes[parentId];
  if (!parent) {
    throw new Error(`Records page overlay parent "${parentId}" was not found.`);
  }
  return {
    ...document,
    nodes: {
      ...document.nodes,
      ...childNodes,
      [parentId]: {
        ...parent,
        children: [...parent.children, ...childIds],
      },
    },
  };
};

const insertOverlayShell = (
  document: DesignerDocument,
  parentId: string,
  seed: TemplateNodeSeed,
): { document: DesignerDocument; nodeId: string } => {
  const parent = document.nodes[parentId];
  if (!parent) {
    throw new Error(`Records page overlay parent "${parentId}" was not found.`);
  }
  const { nodes, rootNodeIds } = cloneTemplateSeedsToNodes([seed], parentId, parent.children.length);
  const nodeId = rootNodeIds[0];
  if (!nodeId) {
    throw new Error('Records page overlay clone produced no node.');
  }
  return {
    document: appendChildrenToNode(document, parentId, rootNodeIds, nodes),
    nodeId,
  };
};

const setOverlayVisibleCondition = (
  document: DesignerDocument,
  overlayNodeId: string,
): DesignerDocument => {
  const overlay = document.nodes[overlayNodeId];
  if (!overlay) {
    return document;
  }
  return {
    ...document,
    nodes: {
      ...document.nodes,
      [overlayNodeId]: {
        ...overlay,
        layout: {
          ...overlay.layout,
          visibleCondition: `store.${visibilityStorePathForNode(overlayNodeId)} === true`,
        },
      },
    },
  };
};

const ensureSelectionStoreSegment = (
  bindingDefinitions: DesignerBindingDefinitions,
  primaryKey: string,
): DesignerBindingDefinitions => {
  if (bindingDefinitions.storeSegments?.selection) {
    return bindingDefinitions;
  }
  return {
    ...bindingDefinitions,
    storeSegments: {
      ...bindingDefinitions.storeSegments,
      selection: {
        id: 'selection',
        initialValue: { [primaryKey]: null },
        persist: 'none',
      },
    },
  };
};

const buildDeleteConfirmBodySeeds = (
  dataSourceId: string,
  dialogNodeId: string,
  resourceLabel: string,
): TemplateNodeSeed[] => {
  const cancelHide = createDynamicAction('showHide');
  cancelHide.targetNodeId = dialogNodeId;
  cancelHide.showHideEffect = 'hide';

  const deleteMutation = createDynamicAction('callMutation');
  deleteMutation.dataSourceRef = dataSourceId;
  deleteMutation.mutationOperation = 'delete';
  deleteMutation.mutationRecordIdStorePath = 'selection.id';

  const refresh = createDynamicAction('refreshDataSource');
  refresh.dataSourceRef = dataSourceId;

  const toast = createDynamicAction('showToast');
  toast.toastTitle = 'Deleted';
  toast.toastVariant = 'success';

  const confirmHide = createDynamicAction('showHide');
  confirmHide.targetNodeId = dialogNodeId;
  confirmHide.showHideEffect = 'hide';

  return [
    {
      type: 'text',
      paletteItemId: 'html.text',
      props: {
        text: `Delete this ${resourceLabel.toLowerCase()}? This cannot be undone.`,
        className: 'block p-[15px] text-sm text-slate-700',
      },
    },
    {
      type: 'container',
      paletteItemId: 'layout.flex-row',
      props: { className: DESIGNER_DIALOG_FOOTER_ACTIONS_CLASS },
      children: [
        {
          type: 'link',
          paletteItemId: 'heroui.button-outline',
          props: {
            text: 'Cancel',
            icon: 'X',
            type: 'button',
            className: DESIGNER_DIALOG_CANCEL_BUTTON_CLASS,
          },
          binding: {
            'event:onClick': createDynamicActionsEventBindingDefinition('onClick', [cancelHide]),
          },
        },
        {
          type: 'link',
          paletteItemId: 'heroui.button-solid',
          props: {
            text: 'Delete',
            icon: 'Trash2',
            type: 'button',
            className: DESIGNER_DIALOG_DESTRUCTIVE_BUTTON_CLASS,
          },
          binding: {
            'event:onClick': createDynamicActionsEventBindingDefinition('onClick', [
              deleteMutation,
              refresh,
              toast,
              confirmHide,
            ]),
          },
        },
      ],
    },
  ];
};

const buildMutationConfirmBodySeeds = (input: {
  dataSourceId: string;
  dialogNodeId: string;
  message: string;
  confirmLabel: string;
  /** `update` | `delete`, or any other string resolved via `operations.custom[key]` (e.g. `archive`). */
  mutationOperation: string;
  mutationBody?: Record<string, unknown>;
  successToast: string;
  /** Defaults to 'selection.id' (grid row actions). Detail/editor pages pass 'routeParams.id'. */
  mutationRecordIdStorePath?: string;
  /** Defaults to the Check/Trash2 + indigo/rose look. Lets callers color-code confirm buttons. */
  confirmIcon?: string;
  confirmClassName?: string;
  /** Header tone — default for non-destructive status confirms; danger for deletes. */
  tone?: 'default' | 'danger';
}): TemplateNodeSeed[] => {
  const cancelHide = createDynamicAction('showHide');
  cancelHide.targetNodeId = input.dialogNodeId;
  cancelHide.showHideEffect = 'hide';

  const mutation = createDynamicAction('callMutation');
  mutation.dataSourceRef = input.dataSourceId;
  mutation.mutationOperation = input.mutationOperation;
  mutation.mutationRecordIdStorePath = input.mutationRecordIdStorePath ?? 'selection.id';
  mutation.mutationBody = input.mutationBody;

  const refresh = createDynamicAction('refreshDataSource');
  refresh.dataSourceRef = input.dataSourceId;

  const toast = createDynamicAction('showToast');
  toast.toastTitle = input.successToast;
  toast.toastVariant = 'success';

  const confirmHide = createDynamicAction('showHide');
  confirmHide.targetNodeId = input.dialogNodeId;
  confirmHide.showHideEffect = 'hide';

  const isDestructive = input.mutationOperation === 'delete'
    || (input.confirmClassName?.includes('rose') ?? false);

  return [
    {
      type: 'text',
      paletteItemId: 'html.text',
      props: {
        text: input.message,
        className: 'block p-[15px] text-sm leading-relaxed text-slate-700',
      },
    },
    {
      type: 'container',
      paletteItemId: 'layout.flex-row',
      props: { className: DESIGNER_DIALOG_FOOTER_ACTIONS_CLASS },
      children: [
        {
          type: 'link',
          paletteItemId: 'heroui.button-outline',
          props: {
            text: 'Cancel',
            icon: 'X',
            type: 'button',
            className: DESIGNER_DIALOG_CANCEL_BUTTON_CLASS,
          },
          binding: {
            'event:onClick': createDynamicActionsEventBindingDefinition('onClick', [cancelHide]),
          },
        },
        {
          type: 'link',
          paletteItemId: 'heroui.button-solid',
          props: {
            text: input.confirmLabel,
            icon: input.confirmIcon ?? (input.mutationOperation === 'delete' ? 'Trash2' : 'Check'),
            type: 'button',
            className: input.confirmClassName ?? (isDestructive
              ? DESIGNER_DIALOG_DESTRUCTIVE_BUTTON_CLASS
              : DESIGNER_DIALOG_PRIMARY_BUTTON_CLASS),
          },
          binding: {
            'event:onClick': createDynamicActionsEventBindingDefinition('onClick', [
              mutation,
              refresh,
              toast,
              confirmHide,
            ]),
          },
        },
      ],
    },
  ];
};

const patchActionBehavior = (
  columns: DesignerDataGridColumn[],
  actionId: string,
  behavior: DesignerGridRowActionBehavior,
): DesignerDataGridColumn[] => columns.map((column) => {
  if (column.kind === 'action-group' && column.actions) {
    return {
      ...column,
      actions: column.actions.map((action) => (
        action.actionId === actionId ? { ...action, behavior } : action
      )),
    };
  }
  if (column.kind === 'action' && column.actionId === actionId) {
    return { ...column, actionBehavior: behavior };
  }
  return column;
});

const wireGridCrudBehaviors = (
  document: DesignerDocument,
  gridNodeId: string,
  options: {
    primaryKey: string;
    createModalNodeId: string | null;
    editModalNodeId: string | null;
    deleteDialogNodeId: string | null;
    toolbarConfig?: DesignerGridToolbarConfig;
  },
): DesignerDocument => {
  const grid = document.nodes[gridNodeId];
  if (!grid) {
    return document;
  }

  let columns = parseDesignerAppTableGridColumns(grid.props.columns);
  if (options.editModalNodeId) {
    const editBehavior = openModalBehavior(options.editModalNodeId, options.primaryKey);
    columns = patchActionBehavior(columns, 'edit', editBehavior);
    columns = columns.map((column) => (
      column.key === options.primaryKey && column.kind !== 'action' && column.kind !== 'action-group'
        ? { ...column, cellClickBehavior: editBehavior }
        : column
    ));
  }
  if (options.deleteDialogNodeId) {
    columns = patchActionBehavior(columns, 'delete', openModalBehavior(options.deleteDialogNodeId, options.primaryKey));
  }

  const toolbar = options.toolbarConfig ?? parseDesignerGridToolbarConfig(grid.props.toolbarConfig) ?? { enabled: true };
  const nextToolbar = options.createModalNodeId && toolbar.create
    ? {
      ...toolbar,
      create: {
        ...toolbar.create,
        behavior: openModalBehavior(options.createModalNodeId, options.primaryKey),
      },
    }
    : toolbar;

  return {
    ...document,
    nodes: {
      ...document.nodes,
      [gridNodeId]: {
        ...grid,
        props: {
          ...grid.props,
          columns: serializeDesignerDataGridColumns(columns),
          toolbarConfig: serializeDesignerGridToolbarConfig(nextToolbar),
          rowKeyField: options.primaryKey,
        },
      },
    },
  };
};

export const buildAutoFormFieldConfigs = (
  fields: readonly ApiFormField[],
  options: { primaryKey?: string; includeInForm?: (field: ApiFormField) => boolean } = {},
): AutoFormFieldConfig[] => {
  const pk = options.primaryKey?.trim() || 'id';
  return fields.map((field) => {
    const mapped = mapApiFieldToControl(field);
    const include = options.includeInForm ? options.includeInForm(field) : field.name !== pk;
    return {
      field,
      enabled: include,
      label: humanizeFieldName(field.name),
      controlPaletteItemId: mapped.paletteItemId,
    };
  });
};

const standardizeRecordsFormModal = (
  document: DesignerDocument,
  modalNodeId: string,
  submitLabel: string,
): DesignerDocument => {
  const modal = document.nodes[modalNodeId];
  const formNodeId = modal?.children.find((childId) => (
    document.nodes[childId]?.props[DESIGNER_PALETTE_ITEM_ID_PROP] === 'html.form'
  ));
  const formNode = formNodeId ? document.nodes[formNodeId] : undefined;
  const submitNodeId = formNode?.children.find((childId) => (
    Object.values(document.nodes[childId]?.binding ?? {}).some(
      (definition) => definition?.regionSubmit === true,
    )
  ));
  if (!modal || !formNodeId || !formNode || !submitNodeId) {
    return document;
  }

  const bodyNodeId = formNode.children.find((childId) => childId !== submitNodeId);
  const cancelHide = createDynamicAction('showHide');
  cancelHide.targetNodeId = modalNodeId;
  cancelHide.showHideEffect = 'hide';
  const footer = cloneTemplateSeedsToNodes([{
    type: 'container',
    paletteItemId: 'layout.flex-row',
    props: {
      // CreateEditModalShell DialogFooter supplies band / edge alignment.
      className: DESIGNER_DIALOG_FOOTER_ACTIONS_CLASS,
    },
    children: [{
      type: 'link',
      paletteItemId: 'heroui.button-outline',
      props: {
        text: 'Cancel',
        icon: 'X',
        type: 'button',
        className: DESIGNER_DIALOG_CANCEL_BUTTON_CLASS,
      },
      binding: {
        'event:onClick': createDynamicActionsEventBindingDefinition('onClick', [cancelHide]),
      },
    }],
  }], modalNodeId, modal.children.length);
  const footerNodeId = footer.rootNodeIds[0]!;
  const submitNode = document.nodes[submitNodeId]!;
  const submitBinding = Object.fromEntries(
    Object.entries(submitNode.binding).map(([bindingKey, definition]) => {
      if (!definition?.trueActions) return [bindingKey, definition];
      const close = definition.trueActions.filter(
        (action) => action.type === 'showHide' && action.showHideEffect === 'hide',
      );
      const toast = definition.trueActions.filter((action) => action.type === 'showToast');
      const refresh = definition.trueActions.filter((action) => action.type === 'refreshDataSource');
      const rest = definition.trueActions.filter(
        (action) => !close.includes(action) && !toast.includes(action) && !refresh.includes(action),
      );
      return [bindingKey, { ...definition, trueActions: [...close, ...toast, ...refresh, ...rest] }];
    }),
  );

  const fieldChildIds = formNode.children.filter((childId) => childId !== submitNodeId);
  const formDomId = typeof formNode.props.id === 'string' && formNode.props.id.trim().length > 0
    ? formNode.props.id.trim()
    : formNodeId;

  return {
    ...document,
    nodes: {
      ...document.nodes,
      ...footer.nodes,
      [modalNodeId]: {
        ...modal,
        props: {
          ...modal.props,
          size: 'lg',
          backdrop: 'blur',
          scrollBehavior: 'inside',
        },
        children: [formNodeId, footerNodeId],
      },
      [formNodeId]: {
        ...formNode,
        props: { ...formNode.props, id: formDomId, className: 'flex min-h-0 flex-col gap-0 bg-white' },
        children: fieldChildIds,
      },
      ...(bodyNodeId && document.nodes[bodyNodeId] ? {
        [bodyNodeId]: {
          ...document.nodes[bodyNodeId]!,
          props: { ...document.nodes[bodyNodeId]!.props, className: 'flex min-w-0 flex-col gap-2 bg-white p-[15px]' },
        },
      } : {}),
      [footerNodeId]: {
        ...footer.nodes[footerNodeId]!,
        parentId: modalNodeId,
        children: [...footer.nodes[footerNodeId]!.children, submitNodeId],
      },
      [submitNodeId]: {
        ...submitNode,
        binding: submitBinding,
        parentId: footerNodeId,
        order: footer.nodes[footerNodeId]!.children.length,
        props: {
          ...submitNode.props,
          text: submitLabel,
          form: formDomId,
          icon: submitLabel.toLowerCase().startsWith('create') ? 'Plus' : 'Save',
          className: submitLabel.toLowerCase().startsWith('create')
            ? DESIGNER_DIALOG_CREATE_BUTTON_CLASS
            : DESIGNER_DIALOG_PRIMARY_BUTTON_CLASS,
        },
      },
    },
  };
};

export const appendRecordsCrudOverlays = (input: {
  state: DesignerState;
  gridNodeId: string;
  dataSource: DataSourceDefinition;
  createDataSource?: DataSourceDefinition;
  formFields: AutoFormFieldConfig[];
  /** When set, Edit modal uses these fields instead of `formFields`. */
  editFormFields?: AutoFormFieldConfig[];
  actions: RecordsCrudPageActions;
  resourceLabel: string;
  toolbarConfig?: DesignerGridToolbarConfig;
  rowActions?: DesignerGridRowAction[];
  createSuccessBehaviors?: FormBindingSuccessBehavior[];
  createResponseStorePath?: string;
  createNavigateTarget?: string;
}): RecordsCrudPageBuildResult => {
  const primaryKey = input.dataSource.primaryKey?.trim() || 'id';
  let document = input.state.document;
  let bindingDefinitions = ensureSelectionStoreSegment(input.state.bindingDefinitions, primaryKey);
  const overlayParentId = document.rootNodeId;
  let createModalNodeId: string | null = null;
  let editModalNodeId: string | null = null;
  let deleteDialogNodeId: string | null = null;

  if (input.actions.create) {
    const inserted = insertOverlayShell(document, overlayParentId, buildOverlayShellSeed('heroui.modal', `Create ${input.resourceLabel}`));
    createModalNodeId = inserted.nodeId;
    document = setOverlayVisibleCondition(inserted.document, createModalNodeId);
    const merged = mergeAutoFormIntoDocument(document, bindingDefinitions, {
      includeTitle: false,
      dataSource: input.createDataSource ?? input.dataSource,
      scenario: 'create',
      fields: input.formFields,
      submitLabel: `Create ${input.resourceLabel}`,
      successBehaviors: input.createSuccessBehaviors ?? ['toast', 'refresh', 'reset', 'close'],
      layout: 'single',
    }, { mode: 'modal-insert', modalNodeId: createModalNodeId });
    document = standardizeRecordsFormModal(
      merged.document,
      createModalNodeId,
      `Create ${input.resourceLabel}`,
    );
    bindingDefinitions = merged.bindingDefinitions;

    if (input.createResponseStorePath || input.createNavigateTarget) {
      const navigateAction = input.createNavigateTarget
        ? createDynamicAction('navigate')
        : null;
      if (navigateAction) {
        navigateAction.navigateTarget = input.createNavigateTarget;
      }
      document = {
        ...document,
        nodes: Object.fromEntries(Object.entries(document.nodes).map(([nodeId, node]) => {
          if (!Object.values(node.binding).some((definition) => definition?.regionSubmit === true)) {
            return [nodeId, node];
          }
          return [
            nodeId,
            {
              ...node,
              binding: Object.fromEntries(Object.entries(node.binding).map(([key, definition]) => (
                definition?.regionSubmit === true
                  ? [
                    key,
                    {
                      ...definition,
                      responseStorePath: input.createResponseStorePath,
                      trueActions: navigateAction
                        ? [...(definition.trueActions ?? []), navigateAction]
                        : definition.trueActions,
                    },
                  ]
                  : [key, definition]
              ))),
            },
          ];
        })),
      };
    }
  }

  if (input.actions.edit) {
    const inserted = insertOverlayShell(document, overlayParentId, buildOverlayShellSeed('heroui.modal', `Edit ${input.resourceLabel}`));
    editModalNodeId = inserted.nodeId;
    document = setOverlayVisibleCondition(inserted.document, editModalNodeId);
    const merged = mergeAutoFormIntoDocument(document, bindingDefinitions, {
      includeTitle: false,
      dataSource: input.dataSource,
      scenario: 'edit',
      fields: input.editFormFields ?? input.formFields,
      submitLabel: 'Save',
      successBehaviors: ['toast', 'refresh', 'close'],
      layout: 'single',
      detailIdSource: 'selection',
    }, { mode: 'modal-insert', modalNodeId: editModalNodeId });
    document = standardizeRecordsFormModal(merged.document, editModalNodeId, 'Save');
    bindingDefinitions = merged.bindingDefinitions;
  }

  if (input.actions.delete) {
    const inserted = insertOverlayShell(document, overlayParentId, buildOverlayShellSeed('heroui.alert-dialog', `Delete ${input.resourceLabel}?`));
    deleteDialogNodeId = inserted.nodeId;
    document = setOverlayVisibleCondition(inserted.document, deleteDialogNodeId);
    const { nodes, rootNodeIds } = cloneTemplateSeedsToNodes(
      buildDeleteConfirmBodySeeds(input.dataSource.id, deleteDialogNodeId, input.resourceLabel),
      deleteDialogNodeId,
      0,
    );
    document = appendChildrenToNode(document, deleteDialogNodeId, rootNodeIds, nodes);
  }

  if (input.rowActions && input.rowActions.length > 0) {
    const grid = document.nodes[input.gridNodeId];
    if (grid) {
      const existing = parseDesignerAppTableGridColumns(grid.props.columns)
        .filter((column) => column.kind !== 'action-group' && column.kind !== 'action');
      document = {
        ...document,
        nodes: {
          ...document.nodes,
          [input.gridNodeId]: {
            ...grid,
            props: {
              ...grid.props,
              columns: serializeDesignerDataGridColumns([
                ...existing,
                createActionGroupColumn(input.rowActions),
              ]),
            },
          },
        },
      };
    }
  } else if (input.actions.edit || input.actions.delete) {
    const actions: DesignerGridRowAction[] = [];
    if (input.actions.edit) {
      actions.push({ actionId: 'edit', icon: 'Pencil', intent: 'edit', tooltip: 'Edit', behavior: { kind: 'none' } });
    }
    if (input.actions.delete) {
      actions.push({ actionId: 'delete', icon: 'Trash2', intent: 'delete', tooltip: 'Delete', behavior: { kind: 'none' } });
    }
    const grid = document.nodes[input.gridNodeId];
    if (grid && actions.length > 0) {
      const existing = parseDesignerAppTableGridColumns(grid.props.columns)
        .filter((column) => column.kind !== 'action-group' && column.kind !== 'action');
      document = {
        ...document,
        nodes: {
          ...document.nodes,
          [input.gridNodeId]: {
            ...grid,
            props: {
              ...grid.props,
              columns: serializeDesignerDataGridColumns([...existing, createActionGroupColumn(actions)]),
            },
          },
        },
      };
    }
  }

  document = wireGridCrudBehaviors(document, input.gridNodeId, {
    primaryKey,
    createModalNodeId,
    editModalNodeId,
    deleteDialogNodeId,
    toolbarConfig: input.toolbarConfig,
  });

  return {
    state: {
      ...input.state,
      document: {
        ...document,
        metadata: { ...document.metadata, updatedAt: new Date().toISOString() },
      },
      bindingDefinitions,
    },
    gridNodeId: input.gridNodeId,
    createModalNodeId,
    editModalNodeId,
    deleteDialogNodeId,
  };
};

export const appendStatusPickerOverlay = (input: {
  state: DesignerState;
  dataSourceId: string;
  title: string;
  statusLovRef: string;
  /** Defaults to `selection.id` (grid row actions). Editor passes `routeParams.id`. */
  mutationRecordIdStorePath?: string;
  successToast?: string;
}): StandaloneFormOverlayBuildResult => {
  const parentId = input.state.document.rootNodeId;
  const inserted = insertOverlayShell(
    input.state.document,
    parentId,
    buildOverlayShellSeed('heroui.modal', input.title),
  );
  const modalNodeId = inserted.nodeId;
  let document = setOverlayVisibleCondition(inserted.document, modalNodeId);

  const recordIdPath = input.mutationRecordIdStorePath ?? 'selection.id';
  const bodySeeds: TemplateNodeSeed[] = [
    {
      type: 'container',
      paletteItemId: 'layout.flex-column',
      props: {
        className: 'flex flex-col gap-2 bg-white p-[15px]',
        contentStatusPicker: true,
        contentStatusPickerLovRef: input.statusLovRef,
        contentStatusPickerDataSourceRef: input.dataSourceId,
        contentStatusPickerRecordIdPath: recordIdPath,
        contentStatusPickerModalNodeId: modalNodeId,
        contentStatusPickerSuccessToast: input.successToast ?? 'Status updated',
      },
    },
  ];

  const cloned = cloneTemplateSeedsToNodes(bodySeeds, modalNodeId, 0);
  document = appendChildrenToNode(document, modalNodeId, cloned.rootNodeIds, cloned.nodes);

  const modal = document.nodes[modalNodeId];
  if (modal) {
    document = {
      ...document,
      nodes: {
        ...document.nodes,
        [modalNodeId]: {
          ...modal,
          props: {
            ...modal.props,
            size: 'lg',
            backdrop: 'blur',
          },
        },
      },
    };
  }

  return {
    modalNodeId,
    state: {
      ...input.state,
      document: {
        ...document,
        metadata: { ...document.metadata, updatedAt: new Date().toISOString() },
      },
      bindingDefinitions: ensureSelectionStoreSegment(input.state.bindingDefinitions, 'id'),
    },
  };
};

export const appendConfirmMutationOverlay = (input: {
  state: DesignerState;
  dataSourceId: string;
  title: string;
  message: string;
  confirmLabel: string;
  /** `update` | `delete`, or any other string resolved via `operations.custom[key]` (e.g. `archive`). */
  mutationOperation: string;
  mutationBody?: Record<string, unknown>;
  successToast: string;
  mutationRecordIdStorePath?: string;
  confirmIcon?: string;
  confirmClassName?: string;
  /** Alert header tone — defaults to danger for delete, default for update confirms. */
  tone?: 'default' | 'danger';
}): ConfirmMutationOverlayBuildResult => {
  const parentId = input.state.document.rootNodeId;
  const resolvedTone = input.tone
    ?? (input.mutationOperation === 'delete' ? 'danger' : 'default');
  const inserted = insertOverlayShell(
    input.state.document,
    parentId,
    buildOverlayShellSeed('heroui.alert-dialog', input.title, { tone: resolvedTone }),
  );
  let document = setOverlayVisibleCondition(inserted.document, inserted.nodeId);
  const body = buildMutationConfirmBodySeeds({
    dataSourceId: input.dataSourceId,
    dialogNodeId: inserted.nodeId,
    message: input.message,
    confirmLabel: input.confirmLabel,
    mutationOperation: input.mutationOperation,
    mutationBody: input.mutationBody,
    successToast: input.successToast,
    mutationRecordIdStorePath: input.mutationRecordIdStorePath,
    confirmIcon: input.confirmIcon,
    confirmClassName: input.confirmClassName,
    tone: resolvedTone,
  });
  const cloned = cloneTemplateSeedsToNodes(body, inserted.nodeId, 0);
  document = appendChildrenToNode(document, inserted.nodeId, cloned.rootNodeIds, cloned.nodes);

  return {
    state: {
      ...input.state,
      document: {
        ...document,
        metadata: { ...document.metadata, updatedAt: new Date().toISOString() },
      },
      bindingDefinitions: ensureSelectionStoreSegment(input.state.bindingDefinitions, 'id'),
    },
    dialogNodeId: inserted.nodeId,
  };
};

export const appendStandaloneEditOverlay = (input: {
  state: DesignerState;
  dataSource: DataSourceDefinition;
  formFields: AutoFormFieldConfig[];
  title: string;
  submitLabel?: string;
  /** Defaults to `urlParam` (editor deep-links). List pages pass `selection`. */
  detailIdSource?: 'selection' | 'urlParam';
}): StandaloneFormOverlayBuildResult => {
  const inserted = insertOverlayShell(
    input.state.document,
    input.state.document.rootNodeId,
    buildOverlayShellSeed('heroui.modal', input.title),
  );
  const modalNodeId = inserted.nodeId;
  const document = setOverlayVisibleCondition(inserted.document, modalNodeId);
  const merged = mergeAutoFormIntoDocument(document, input.state.bindingDefinitions, {
    includeTitle: false,
    dataSource: input.dataSource,
    scenario: 'edit',
    fields: input.formFields,
    submitLabel: input.submitLabel ?? 'Save',
    successBehaviors: ['toast', 'refresh', 'close'],
    layout: 'single',
    detailIdSource: input.detailIdSource ?? 'urlParam',
  }, { mode: 'modal-insert', modalNodeId });
  const standardizedDocument = standardizeRecordsFormModal(
    merged.document,
    modalNodeId,
    input.submitLabel ?? 'Save changes',
  );

  return {
    modalNodeId,
    state: {
      ...input.state,
      document: {
        ...standardizedDocument,
        metadata: { ...standardizedDocument.metadata, updatedAt: new Date().toISOString() },
      },
      bindingDefinitions: merged.bindingDefinitions,
    },
  };
};

/**
 * Standalone "create"-scenario modal not tied to any grid's CRUD triad — posts to
 * `dataSource.operations.create` (e.g. a domain action endpoint like `parties/merge`).
 * Unlike {@link appendRecordsCrudOverlays}'s create modal, the caller supplies the
 * refresh target explicitly since the posting data source usually isn't the grid's.
 */
export const appendStandaloneCreateOverlay = (input: {
  state: DesignerState;
  dataSource: DataSourceDefinition;
  formFields: AutoFormFieldConfig[];
  title: string;
  submitLabel?: string;
  /** Data source to refresh after a successful submit (e.g. the list grid's data source id). */
  refreshDataSourceId?: string;
}): StandaloneFormOverlayBuildResult => {
  const inserted = insertOverlayShell(
    input.state.document,
    input.state.document.rootNodeId,
    buildOverlayShellSeed('heroui.modal', input.title),
  );
  const modalNodeId = inserted.nodeId;
  const document = setOverlayVisibleCondition(inserted.document, modalNodeId);
  const merged = mergeAutoFormIntoDocument(document, input.state.bindingDefinitions, {
    includeTitle: false,
    dataSource: input.dataSource,
    scenario: 'create',
    fields: input.formFields,
    submitLabel: input.submitLabel ?? 'Submit',
    successBehaviors: ['toast', 'reset', 'close'],
    layout: 'single',
  }, { mode: 'modal-insert', modalNodeId });
  let standardizedDocument = standardizeRecordsFormModal(
    merged.document,
    modalNodeId,
    input.submitLabel ?? 'Submit',
  );

  if (input.refreshDataSourceId) {
    const refresh = createDynamicAction('refreshDataSource');
    refresh.dataSourceRef = input.refreshDataSourceId;
    standardizedDocument = {
      ...standardizedDocument,
      nodes: Object.fromEntries(Object.entries(standardizedDocument.nodes).map(([nodeId, node]) => {
        if (!Object.values(node.binding).some((definition) => definition?.regionSubmit === true)) {
          return [nodeId, node];
        }
        return [
          nodeId,
          {
            ...node,
            binding: Object.fromEntries(Object.entries(node.binding).map(([key, definition]) => [
              key,
              definition?.regionSubmit === true
                ? { ...definition, trueActions: [...(definition.trueActions ?? []), refresh] }
                : definition,
            ])),
          },
        ];
      })),
    };
  }

  return {
    modalNodeId,
    state: {
      ...input.state,
      document: {
        ...standardizedDocument,
        metadata: { ...standardizedDocument.metadata, updatedAt: new Date().toISOString() },
      },
      bindingDefinitions: merged.bindingDefinitions,
    },
  };
};

export const createRecordsPageState = (title: string): DesignerState => {
  const state = createInitialDesignerState(title);
  const withShell = designerReducer(state, {
    type: 'set-node-prop',
    nodeId: state.document.rootNodeId,
    key: 'className',
    value: 'flex h-full min-h-0 w-full flex-col bg-white font-sans',
  });
  return designerReducer(withShell, {
    type: 'set-node-prop',
    nodeId: withShell.document.rootNodeId,
    key: 'publishedFormAssist',
    value: false,
  });
};

export const findAppTableGridNodeId = (document: DesignerDocument): string | null => {
  for (const node of Object.values(document.nodes)) {
    if (node.props[DESIGNER_PALETTE_ITEM_ID_PROP] === 'heroui.app-table-grid') {
      return node.id;
    }
  }
  return null;
};
