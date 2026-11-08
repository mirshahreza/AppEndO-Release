import React, { useCallback, useMemo, useState } from 'react';
import {
  Clock3,
  FileUp,
  ImagePlus,
  Lock,
  Plus,
  RefreshCw,
  Save,
  TableProperties,
  UserRoundPen,
} from 'lucide-react';
import { cn } from '../../../lib/utils';
import { useDataSourceObjectRelationsQuery } from '../../../shared/api/queries/data-sources';
import {
  buildOutboundForeignKeyMap,
  formatForeignKeyTargetLabel,
} from '../../../shared/lib/edgeModelForeignKeys';
import {
  AppSplitButton,
  AppButton,
  FloatingPanelShell,
  SplitButtonMenuItem,
  UiTooltip,
} from '../../../shared/ui';
import { EdgeModelDesignerDatasheet } from './EdgeModelDesignerDatasheet';
import { EdgeModelColumnNamePromptDialog } from './EdgeModelColumnNamePromptDialog';
import {
  buildFileColumnPresetSpecs,
  buildImageColumnPresetSpecs,
  buildRecordAuditColumnPresetSpecs,
  buildSetAuditColumnPresetSpecs,
} from '../lib/edgeModelColumnPresets';
import { CONTROL_PLANE_OBJECT_LOCK_LABEL } from '../lib/controlPlaneSchemaObjects';
import { resolveEdgeModelImportType } from '../lib/explorerObjectKinds';
import { useEdgeModelDesignerInstance } from '../hooks/useEdgeModelDesignerInstance';
import type { EdgeModelDesignerPanelEntry } from '../hooks/useEdgeModelDesignerManager';

const PANEL_BOUNDS = {
  minWidth: 720,
  maxWidth: 1400,
  minHeight: 320,
  maximizeInset: 16,
};

type ColumnNamePromptKind = 'image' | 'file' | 'set-audit';

type EdgeModelDesignerPanelProps = {
  panel: EdgeModelDesignerPanelEntry;
  onClose: () => void;
  onFocus: () => void;
};

export const EdgeModelDesignerPanel: React.FC<EdgeModelDesignerPanelProps> = ({
  panel,
  onClose,
  onFocus,
}) => {
  const designer = useEdgeModelDesignerInstance(panel.context);
  const [focusColumnIndex, setFocusColumnIndex] = useState<number | null>(null);
  const [focusNonce, setFocusNonce] = useState(0);
  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);
  const [namePromptKind, setNamePromptKind] = useState<ColumnNamePromptKind | null>(null);

  const model = designer.model;
  const readOnly = model?.readOnly ?? false;
  const objectType = model?.objectType
    ?? resolveEdgeModelImportType(panel.context.row.objectKind)
    ?? 'TABLE';
  const relationsQuery = useDataSourceObjectRelationsQuery(
    panel.context.dataSourceId,
    objectType,
    panel.context.row.name,
    Boolean(panel.context.dataSourceId && panel.context.row.name),
  );

  const foreignKeyTargets = useMemo(() => {
    const map = new Map<string, string>();
    const relations = relationsQuery.data?.relations ?? [];
    const outbound = buildOutboundForeignKeyMap(panel.context.row.name, relations);
    outbound.forEach((target, columnName) => {
      map.set(columnName, formatForeignKeyTargetLabel(target));
    });
    return map;
  }, [panel.context.row.name, relationsQuery.data?.relations]);

  const requestFocusColumn = useCallback((index: number) => {
    setFocusColumnIndex(index);
    setFocusNonce((current) => current + 1);
  }, []);

  const applyPresetSpecs = useCallback((
    specs: ReturnType<typeof buildImageColumnPresetSpecs>,
  ) => {
    const firstAddedIndex = designer.addPresetColumns(specs);
    if (firstAddedIndex != null) {
      requestFocusColumn(firstAddedIndex);
    }
  }, [designer.addPresetColumns, requestFocusColumn]);

  const handleAddBlankColumn = useCallback(() => {
    const nextIndex = designer.addBlankColumn();
    if (nextIndex != null) {
      requestFocusColumn(nextIndex);
    }
    setIsAddMenuOpen(false);
  }, [designer.addBlankColumn, requestFocusColumn]);

  const handleFocusColumnHandled = useCallback(() => {
    setFocusColumnIndex(null);
  }, []);

  const openNamePrompt = useCallback((kind: ColumnNamePromptKind) => {
    setIsAddMenuOpen(false);
    setNamePromptKind(kind);
  }, []);

  const handleAddRecordAudit = useCallback(() => {
    setIsAddMenuOpen(false);
    applyPresetSpecs(buildRecordAuditColumnPresetSpecs(designer.dialect));
  }, [applyPresetSpecs, designer.dialect]);

  const handleNamePromptSubmit = useCallback((name: string) => {
    if (namePromptKind === 'image') {
      applyPresetSpecs(buildImageColumnPresetSpecs(name, designer.dialect));
    } else if (namePromptKind === 'file') {
      applyPresetSpecs(buildFileColumnPresetSpecs(name, designer.dialect));
    } else if (namePromptKind === 'set-audit') {
      applyPresetSpecs(buildSetAuditColumnPresetSpecs(name, designer.dialect));
    }

    setNamePromptKind(null);
  }, [applyPresetSpecs, designer.dialect, namePromptKind]);

  const namePromptConfig = namePromptKind === 'image'
    ? {
      title: 'Add image columns',
      subtitle: 'Creates the image field plus thumbnail, size, and filename columns',
      fieldLabel: 'Image field name',
      placeholder: 'e.g. profile_pic',
      exampleName: 'profile_pic',
      confirmLabel: 'Add columns',
      buildPreviewNames: (name: string) => buildImageColumnPresetSpecs(name, designer.dialect).map((spec) => spec.name),
    }
    : namePromptKind === 'file'
      ? {
        title: 'Add file columns',
        subtitle: 'Creates the file field plus size and filename columns',
        fieldLabel: 'File field name',
        placeholder: 'e.g. attachment',
        exampleName: 'attachment',
        confirmLabel: 'Add columns',
        buildPreviewNames: (name: string) => buildFileColumnPresetSpecs(name, designer.dialect).map((spec) => spec.name),
      }
      : namePromptKind === 'set-audit'
        ? {
          title: 'Add set audit columns',
          subtitle: 'Creates updated-by / updated-at columns for a named update set',
          fieldLabel: 'Update set name',
          placeholder: 'e.g. price_update',
          exampleName: 'price_update',
          confirmLabel: 'Add columns',
          buildPreviewNames: (name: string) => buildSetAuditColumnPresetSpecs(name, designer.dialect).map((spec) => spec.name),
        }
        : null;

  return (
    <FloatingPanelShell
      open
      onClose={onClose}
      onPointerDown={onFocus}
      title={`${panel.context.dataSourceName} / ${panel.context.row.name} (${designer.draftColumns.length} columns)`}
      titleIcon={<TableProperties className="h-3.5 w-3.5 text-indigo-600" />}
      bounds={PANEL_BOUNDS}
      defaultWidth={960}
      defaultHeight={560}
      initialPosition="top-left"
      initialOffset={{
        // `x` is CSS `right` offset — negative cascade nudges stacked panels rightward.
        x: -(panel.cascadeIndex * 24),
        y: panel.cascadeIndex * 24,
      }}
      dragFromHeaderOnly
      enableDrag
      enableResize
      enableMaximize
      zIndex={panel.zOrder}
      borderClassName="border-2 border-slate-300/90"
      headerClassName="h-9 border-b border-slate-200 bg-white px-3"
      titleClassName="text-xs font-semibold tracking-tight text-slate-800"
    >
      <div className="flex h-full min-h-0 flex-col !bg-white">
        <div
          className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-200 px-2 py-1.5"
          data-floating-panel-drag-exclude
        >
          <div className="flex min-w-0 items-center gap-1.5">
            {!readOnly ? (
              <AppSplitButton
                intent="create"
                size="sm"
                className="shrink-0"
                icon={<Plus className="h-3 w-3" />}
                label="Add Column"
                isOpen={isAddMenuOpen}
                onOpenChange={setIsAddMenuOpen}
                onPrimaryClick={handleAddBlankColumn}
                triggerAriaLabel="Add Column"
                menuAriaLabel="Add column presets"
                menuFixed
                menuAlign="start"
                menuClassName="min-w-[12.5rem]"
              >
                <SplitButtonMenuItem
                  icon={<ImagePlus className="h-3.5 w-3.5 shrink-0 text-violet-600" />}
                  onClick={() => openNamePrompt('image')}
                >
                  Add Image
                </SplitButtonMenuItem>
                <SplitButtonMenuItem
                  icon={<FileUp className="h-3.5 w-3.5 shrink-0 text-sky-600" />}
                  onClick={() => openNamePrompt('file')}
                >
                  Add File
                </SplitButtonMenuItem>
                <SplitButtonMenuItem
                  icon={<Clock3 className="h-3.5 w-3.5 shrink-0 text-amber-600" />}
                  onClick={handleAddRecordAudit}
                >
                  Audit Fields
                </SplitButtonMenuItem>
                <SplitButtonMenuItem
                  icon={<UserRoundPen className="h-3.5 w-3.5 shrink-0 text-emerald-600" />}
                  onClick={() => openNamePrompt('set-audit')}
                >
                  Set Audit Fields
                </SplitButtonMenuItem>
              </AppSplitButton>
            ) : (
              <span />
            )}
            {designer.isControlPlaneObject ? (
              <UiTooltip
                className="inline-flex shrink-0 cursor-default text-amber-500 outline-none"
                aria-label={CONTROL_PLANE_OBJECT_LOCK_LABEL}
                contentClassName="z-[9999] max-w-[18rem] px-3 py-2 text-start text-[11px] font-medium leading-snug"
                content={CONTROL_PLANE_OBJECT_LOCK_LABEL}
              >
                <Lock className="h-3.5 w-3.5" aria-hidden="true" />
              </UiTooltip>
            ) : null}
          </div>
          <div className="flex items-center gap-1.5">
            {!readOnly ? (
              <AppButton
                intent="primary"
                size="sm"
                className="h-7 px-2 text-[11px]"
                disabled={!designer.isDirty || designer.isSaving || designer.draftColumns.length === 0}
                onClick={() => { void designer.saveDesigner(); }}
              >
                <Save className="h-3 w-3" />
                Save
              </AppButton>
            ) : null}
            <AppButton
              intent="utility"
              size="sm"
              className="h-7 px-2 text-[11px]"
              disabled={!model || designer.isRefreshing}
              onClick={() => { void designer.refreshFromDatabase(); }}
            >
              <RefreshCw className={cn('h-3 w-3', designer.isRefreshing && 'animate-spin')} />
              Sync model
            </AppButton>
          </div>
        </div>
        {designer.bootstrapError ? (
          <div className="flex flex-1 items-center justify-center p-4 text-xs text-rose-600">
            {designer.bootstrapError}
          </div>
        ) : (
          <EdgeModelDesignerDatasheet
            columns={designer.draftColumns}
            foreignKeyTargets={foreignKeyTargets}
            nativeTypeOptions={designer.nativeTypeOptions}
            readOnly={readOnly}
            isStructuralColumnLocked={designer.isStructuralColumnLocked}
            isLoading={designer.isLoading}
            focusColumnIndex={focusColumnIndex}
            focusNonce={focusNonce}
            onFocusColumnHandled={handleFocusColumnHandled}
            onUpdateColumn={designer.updateColumn}
            onRemoveColumn={designer.removeColumn}
            onAddBlankColumn={handleAddBlankColumn}
          />
        )}
      </div>

      {namePromptConfig ? (
        <EdgeModelColumnNamePromptDialog
          open
          title={namePromptConfig.title}
          subtitle={namePromptConfig.subtitle}
          fieldLabel={namePromptConfig.fieldLabel}
          placeholder={namePromptConfig.placeholder}
          exampleName={namePromptConfig.exampleName}
          confirmLabel={namePromptConfig.confirmLabel}
          buildPreviewNames={namePromptConfig.buildPreviewNames}
          onClose={() => setNamePromptKind(null)}
          onSubmit={handleNamePromptSubmit}
        />
      ) : null}
    </FloatingPanelShell>
  );
};
