import * as React from 'react';
import * as LucideIcons from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { cn } from '../../lib/utils';
import { DialogBand } from '../../shared/ui';
import { resolveLucideIconNameFromUiHtml } from '../../shared/lib/baseInfoUiIcon';
import { normalizeHexColor } from '../../shared/lib/uiColorUtils';
import {
  createDynamicAction,
  createDynamicActionsEventBindingDefinition,
  resolveDynamicActions,
} from './bindingDynamicActionsEngine';
import { executeDynamicActions, type DynamicActionRuntimeContext } from './bindingDynamicActionsRuntime';
import { resolveContentStatusOptionAppearance } from './designerContentStatusTrigger';
import { createDefaultBindingDefinitions, normalizeBindingDefinitions } from './bindingRegistry';
import { useDesignerLovOptions, type DesignerLovOption } from './useDesignerLovOptions';
import type { DesignerNode } from './types';
import type { RuntimeRenderOptions } from './runtimeTypes';

const readString = (value: unknown, fallback = ''): string => (
  typeof value === 'string' ? value : fallback
);

const readBoolean = (value: unknown): boolean => value === true || value === 'true';

const readCurrentUserId = (store: Record<string, unknown>): string | number | null => {
  const user = store.user;
  if (!user || typeof user !== 'object') {
    return null;
  }
  const id = (user as Record<string, unknown>).id;
  return typeof id === 'string' || typeof id === 'number' ? id : null;
};

export const buildContentStatusAuditMutationBody = (
  statusCode: string,
  store: Record<string, unknown>,
  changedAt = new Date().toISOString(),
  currentUserId?: string | number | null,
): Record<string, unknown> => {
  const actorId = currentUserId ?? readCurrentUserId(store);
  return {
    statusCode,
    statusCodeUpdatedAt: changedAt,
    ...(actorId == null ? {} : {
      statusCodeUpdatedBy: actorId,
      updatedBy: actorId,
    }),
    updatedAt: changedAt,
  };
};

const PUBLISHED_STATUS_SLUG = 'published';

export const isPublishedContentStatusOption = (option: DesignerLovOption): boolean => {
  const slug = (option.shortName ?? '').trim().toLowerCase();
  if (slug === PUBLISHED_STATUS_SLUG) {
    return true;
  }
  if (option.label.trim().toLowerCase() === PUBLISHED_STATUS_SLUG) {
    return true;
  }
  return option.value.trim().toLowerCase() === PUBLISHED_STATUS_SLUG;
};

export const partitionContentStatusPickerOptions = (
  options: DesignerLovOption[],
): { published: DesignerLovOption | null; others: DesignerLovOption[] } => {
  const publishedIndex = options.findIndex(isPublishedContentStatusOption);
  if (publishedIndex < 0) {
    return { published: null, others: options };
  }
  return {
    published: options[publishedIndex]!,
    others: options.filter((_, index) => index !== publishedIndex),
  };
};

const STATUS_PICKER_INTRO_TITLE = 'Editorial status';
const STATUS_PICKER_INTRO_BODY =
  'Choose how this content appears. Published is live for public readers. Other statuses stay off the public site.';

const resolveLucideIcon = (iconName: string): LucideIcon | null => {
  const pascal = iconName
    .split('-')
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join('');
  const icon = (LucideIcons as unknown as Record<string, LucideIcon | undefined>)[pascal];
  return icon ?? null;
};

const STATUS_PICKER_SKELETON_COUNT = 4;

type DesignerRuntimeContentStatusPickerProps = {
  node: DesignerNode;
  options: RuntimeRenderOptions;
};

export const DesignerRuntimeContentStatusPicker: React.FC<DesignerRuntimeContentStatusPickerProps> = ({
  node,
  options,
}) => {
  const { currentUser } = useAuth();
  const lovRef = readString(node.props.contentStatusPickerLovRef);
  const dataSourceRef = readString(node.props.contentStatusPickerDataSourceRef);
  const recordIdPath = readString(node.props.contentStatusPickerRecordIdPath, 'selection.id');
  const modalNodeId = readString(node.props.contentStatusPickerModalNodeId);
  const successToast = readString(node.props.contentStatusPickerSuccessToast, 'Status updated');
  const introTitle = readString(node.props.contentStatusPickerIntroTitle, STATUS_PICKER_INTRO_TITLE);
  const introBody = readString(node.props.contentStatusPickerIntroBody, STATUS_PICKER_INTRO_BODY);
  const bindingDefinitions = React.useMemo(
    () => normalizeBindingDefinitions(
      options.bindingDefinitions ?? options.previewEvents?.bindingDefinitions ?? createDefaultBindingDefinitions(),
    ),
    [options.bindingDefinitions, options.previewEvents?.bindingDefinitions],
  );
  const { options: statusOptions, isLoading } = useDesignerLovOptions(lovRef, bindingDefinitions);
  const { published, others } = React.useMemo(
    () => partitionContentStatusPickerOptions(statusOptions),
    [statusOptions],
  );

  const runtimeContext = React.useMemo((): DynamicActionRuntimeContext | undefined => {
    if (!options.previewEvents?.patchStore) {
      return undefined;
    }
    return {
      designerStore: options.designerStore ?? {},
      getDesignerStore: options.previewEvents.getDesignerStore,
      patchStore: options.previewEvents.patchStore,
      refreshDataSource: options.previewEvents.refreshDataSource,
      navigate: options.previewEvents.navigate,
    };
  }, [options.designerStore, options.previewEvents]);

  const handleSelect = React.useCallback((statusValue: string) => {
    if (!runtimeContext || !dataSourceRef || !modalNodeId) {
      return;
    }

    const mutation = createDynamicAction('callMutation');
    mutation.dataSourceRef = dataSourceRef;
    mutation.mutationOperation = 'update';
    mutation.mutationRecordIdStorePath = recordIdPath;
    mutation.mutationBody = buildContentStatusAuditMutationBody(
      statusValue,
      runtimeContext.getDesignerStore?.() ?? runtimeContext.designerStore,
      undefined,
      currentUser?.id,
    );

    const refresh = createDynamicAction('refreshDataSource');
    refresh.dataSourceRef = dataSourceRef;

    const toast = createDynamicAction('showToast');
    toast.toastTitle = successToast;
    toast.toastVariant = 'success';

    const hide = createDynamicAction('showHide');
    hide.targetNodeId = modalNodeId;
    hide.showHideEffect = 'hide';

    const binding = createDynamicActionsEventBindingDefinition('onClick', [
      mutation,
      refresh,
      toast,
      hide,
    ]);
    const resolved = resolveDynamicActions(binding, bindingDefinitions);
    void executeDynamicActions(resolved, runtimeContext);
  }, [
    bindingDefinitions,
    currentUser?.id,
    dataSourceRef,
    modalNodeId,
    recordIdPath,
    runtimeContext,
    successToast,
  ]);

  const renderStatusOption = (option: DesignerLovOption) => {
    const iconName = resolveLucideIconNameFromUiHtml(option.uiHtml);
    const Icon = iconName ? resolveLucideIcon(iconName) : null;
    const appearance = resolveContentStatusOptionAppearance(
      option.uiColor ? normalizeHexColor(option.uiColor) : null,
    );
    const description = option.description?.trim() || null;
    return (
      <button
        key={option.value}
        type="button"
        className={appearance.className}
        style={appearance.style}
        onClick={() => handleSelect(option.value)}
      >
        {Icon ? <Icon className="h-[2.625rem] w-[2.625rem] shrink-0" aria-hidden strokeWidth={1.75} /> : null}
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="font-semibold">{option.label}</span>
          {description ? (
            <span className="text-[10px] font-normal leading-snug opacity-70">
              {description}
            </span>
          ) : null}
        </span>
      </button>
    );
  };

  const containerClassName = readString(node.props.className, 'flex flex-col gap-2 bg-white p-[15px]');
  const showSkeleton = isLoading && statusOptions.length === 0;

  return (
    <div className={cn(containerClassName, 'min-h-[16rem]')}>
      <DialogBand
        tone="elevated"
        className="-mt-[15px] min-w-0 py-2.5 text-[11px] text-slate-600"
      >
        <p className="font-semibold text-slate-800">{introTitle}</p>
        <p className="mt-0.5 leading-snug">{introBody}</p>
      </DialogBand>

      {showSkeleton ? (
        <div className="flex flex-col gap-2" aria-hidden="true">
          {Array.from({ length: STATUS_PICKER_SKELETON_COUNT }, (_, index) => (
            <div key={index} className="h-12 animate-pulse rounded-md bg-slate-100" />
          ))}
        </div>
      ) : null}

      {!showSkeleton && statusOptions.length === 0 ? (
        <div className="py-2 text-xs text-slate-500">No statuses available.</div>
      ) : null}

      {!showSkeleton && published ? renderStatusOption(published) : null}

      {!showSkeleton && published && others.length > 0 ? (
        <div role="separator" className="-mx-[15px] border-t border-slate-200" />
      ) : null}

      {!showSkeleton ? others.map(renderStatusOption) : null}
    </div>
  );
};

export const isDesignerContentStatusPickerNode = (node: DesignerNode): boolean => (
  readBoolean(node.props.contentStatusPicker)
);
