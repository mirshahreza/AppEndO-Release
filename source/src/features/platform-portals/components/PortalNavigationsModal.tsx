import React, { useCallback, useEffect } from 'react';
import { X } from 'lucide-react';
import { formatQueryError } from '../../../shared/api/client';
import {
  AppButton,
  CreateEditModalShell,
  DIALOG_NESTED_BACKDROP_Z_CLASS,
  QueryErrorPanel,
} from '../../../shared/ui';
import { cn } from '../../../lib/utils';
import type { ExperienceManifestPortal } from '../../../shared/api/contracts/platform/experienceManifest';
import { NavigationDeleteModal } from '../../platform-navigations/components/NavigationDeleteModal';
import {
  NavigationManifestEditorContent,
  NavigationManifestEditorFooterActions,
} from '../../platform-navigations/components/NavigationManifestEditorContent';
import { usePortalNavigations } from '../hooks/usePortalNavigations';
import {
  PortalNavigationActions,
  PortalNavigationIdentityControl,
} from './PortalNavigationIdentityBar';

type PortalNavigationsModalProps = {
  portal: ExperienceManifestPortal;
  onClose: () => void;
  onPortalUpdated?: () => void;
};

const PORTAL_NAVIGATIONS_MODAL_CLASS = 'portal-navigations-modal';

function isEnterFromModalField(event: KeyboardEvent, modalRoot: Element): boolean {
  if (event.key !== 'Enter') {
    return false;
  }

  const target = event.target;
  if (!(target instanceof HTMLElement) || !modalRoot.contains(target)) {
    return false;
  }

  if (target.tagName === 'TEXTAREA') {
    return false;
  }

  if (target.tagName === 'BUTTON' || target.closest('button')) {
    return false;
  }

  return true;
}

export const PortalNavigationsModal: React.FC<PortalNavigationsModalProps> = ({
  portal,
  onClose,
  onPortalUpdated,
}) => {
  const model = usePortalNavigations(portal, onPortalUpdated);
  const loadError = model.listQuery.isError ? model.listQuery.error : null;

  useEffect(() => {
    const guardEnterKeyDown = (event: KeyboardEvent) => {
      const modalRoot = document.querySelector(`.${PORTAL_NAVIGATIONS_MODAL_CLASS}`);
      if (!modalRoot || !isEnterFromModalField(event, modalRoot)) {
        return;
      }

      // Block implicit dialog default-button activation; field handlers still run.
      event.preventDefault();
    };

    const guardEnterKeyUp = (event: KeyboardEvent) => {
      const modalRoot = document.querySelector(`.${PORTAL_NAVIGATIONS_MODAL_CLASS}`);
      if (!modalRoot || !isEnterFromModalField(event, modalRoot)) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
    };

    window.addEventListener('keydown', guardEnterKeyDown, true);
    window.addEventListener('keyup', guardEnterKeyUp, true);
    return () => {
      window.removeEventListener('keydown', guardEnterKeyDown, true);
      window.removeEventListener('keyup', guardEnterKeyUp, true);
    };
  }, []);

  const handleRequestClose = useCallback(() => {
    if (model.isModalCloseBlocked()) {
      return;
    }
    onClose();
  }, [model, onClose]);

  const swallowFooterEnter = useCallback((event: React.KeyboardEvent) => {
    if (event.key !== 'Enter') {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
  }, []);

  const handleSaveClose = useCallback(async () => {
    if (model.deleteTargetId || model.isSaving || model.isModalCloseBlocked()) {
      return;
    }
    if (model.canSavePortalNavigation) {
      try {
        await model.savePortalNavigation();
      } catch {
        return;
      }
    }
    handleRequestClose();
  }, [handleRequestClose, model]);

  const footerContent = model.isCreateMode || model.editorId ? (
    <div className="contents" onKeyDownCapture={swallowFooterEnter}>
      {model.isCreateMode && model.items.length > 0 ? (
        <AppButton
          intent="cancel"
          size="sm"
          onClick={() => {
            model.setFormError(null);
            model.selectNavigation(model.items[0]!.id);
          }}
        >
          <X className="h-3.5 w-3.5" />
          Cancel
        </AppButton>
      ) : null}
      <NavigationManifestEditorFooterActions
        editor={model.editor}
        hideReset
        onSaveClose={handleSaveClose}
        onSave={model.savePortalNavigation}
        canSave={model.canSavePortalNavigation}
        isSaving={model.isSaving || model.editor.isSaving}
      />
    </div>
  ) : undefined;

  return (
    <>
      <CreateEditModalShell
        title={`Navigations — ${portal.name}`}
        size="maximized"
        shellClassName={cn(
          PORTAL_NAVIGATIONS_MODAL_CLASS,
          model.deleteTargetId ? 'pointer-events-none' : undefined,
        )}
        bodyOuterClassName="flex min-h-0 flex-1 flex-col"
        bodyClassName="flex min-h-0 flex-1 flex-col overflow-hidden"
        onClose={handleRequestClose}
        closeOnEscape={false}
        footer={footerContent}
      >
        <div
          className="flex min-h-0 flex-1 flex-col overflow-hidden"
        >
          {loadError ? (
            <div className="mb-3 shrink-0">
              <QueryErrorPanel
                message="Failed to load portal navigations"
                detail={formatQueryError(loadError, 'Could not load portal navigations.')}
                onRetry={() => { void model.listQuery.refetch(); }}
              />
            </div>
          ) : null}

          {model.formError && !model.deleteTargetId ? (
            <div className="mb-3 shrink-0 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
              {model.formError}
            </div>
          ) : null}

          {model.listQuery.isLoading ? (
            <div className="flex flex-1 items-center justify-center text-sm text-slate-400">
              Loading navigations…
            </div>
          ) : model.isCreateMode || model.editorId ? (
            <NavigationManifestEditorContent
              editor={model.editor}
              navigationIdentity={(
                <PortalNavigationIdentityControl model={model} portalSegment={portal.segment} />
              )}
              toolbarTrailing={<PortalNavigationActions model={model} />}
            />
          ) : (
            <div className="flex flex-1 items-center justify-center text-sm text-slate-400">
              Select a navigation to edit.
            </div>
          )}
        </div>
      </CreateEditModalShell>

      <NavigationDeleteModal
        targetId={model.deleteTargetId}
        deleteError={model.deleteTargetId ? model.formError : null}
        isDeleting={model.isSaving}
        backdropClassName={`!${DIALOG_NESTED_BACKDROP_Z_CLASS}`}
        closeOnEscape={false}
        isPrimaryNavigation={Boolean(
          model.deleteTargetId && model.deleteTargetId === model.primaryNavigationRef,
        )}
        replacementNavigationId={
          model.deleteTargetId
            ? model.items.find((item) => item.id !== model.deleteTargetId)?.id ?? null
            : null
        }
        onCancel={() => {
          model.setDeleteTargetId(null);
          model.setFormError(null);
        }}
        onConfirm={() => {
          model.beginModalCloseProtection();
          void model.removeManifest(model.deleteTargetId!);
        }}
      />
    </>
  );
};
