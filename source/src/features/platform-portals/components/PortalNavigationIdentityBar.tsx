import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Check, List, Plus, Trash2, X } from 'lucide-react';
import { cn } from '../../../lib/utils';
import {
  AppButton,
  SplitButtonMenuItem,
  SPLIT_BUTTON_MENU_PANEL_CLASS,
  UiInput,
  useSplitButtonMenu,
} from '../../../shared/ui';
import { NAVIGATION_EDITOR_ID_CLASS } from '../../platform-navigations/constants';
import type { PortalNavigationsModel } from '../hooks/usePortalNavigations';

export const NAVIGATION_IDENTITY_WIDTH_CLASS = 'min-w-[440px] w-[440px] max-w-4xl shrink-0';
export const PORTAL_NAV_IDENTITY_ATTR = 'data-portal-nav-identity';

type PortalNavigationSwitcherProps = {
  items: Array<{ id: string }>;
  value: string;
  disabled?: boolean;
  onChange: (id: string) => void;
};

const PortalNavigationSwitcher: React.FC<PortalNavigationSwitcherProps> = ({
  items,
  value,
  disabled = false,
  onChange,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useSplitButtonMenu(isOpen, setIsOpen);

  useEffect(() => {
    if (disabled) {
      setIsOpen(false);
    }
  }, [disabled]);

  return (
    <div ref={menuRef} className="relative shrink-0">
      <AppButton
        intent="utility"
        size="icon-sm"
        disabled={disabled}
        aria-label="Switch navigation"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        title="Switch navigation"
        onClick={() => {
          if (disabled) {
            return;
          }
          setIsOpen((open) => !open);
        }}
      >
        <List className="h-3.5 w-3.5" />
      </AppButton>

      {isOpen && !disabled ? (
        <div
          className={cn(
            SPLIT_BUTTON_MENU_PANEL_CLASS,
            'left-0 right-auto z-30 min-w-[12rem] max-h-48 overflow-y-auto',
          )}
          role="listbox"
          aria-label="Switch navigation"
        >
          {items.map((item) => {
            const isActive = item.id === value;
            return (
              <SplitButtonMenuItem
                key={item.id}
                role="option"
                aria-selected={isActive}
                className={cn(
                  'font-mono',
                  isActive && 'bg-indigo-50/70 text-indigo-700',
                )}
                onClick={() => {
                  onChange(item.id);
                  setIsOpen(false);
                }}
              >
                {item.id}
              </SplitButtonMenuItem>
            );
          })}
        </div>
      ) : null}
    </div>
  );
};
type PortalNavigationIdentityControlProps = {
  model: PortalNavigationsModel;
  portalSegment: string;
};

export const PortalNavigationIdentityControl: React.FC<PortalNavigationIdentityControlProps> = ({
  model,
  portalSegment,
}) => {
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const identityAnchorRef = useRef<HTMLButtonElement | HTMLDivElement>(null);

  const restoreIdentityFocus = useCallback(() => {
    window.requestAnimationFrame(() => {
      identityAnchorRef.current?.focus({ preventScroll: true });
    });
  }, []);

  const selectedItem = model.items.find((item) => item.id === model.editorId);
  const canRename = Boolean(
    model.editorId
    && selectedItem
    && !selectedItem.builtIn
    && !model.isCreateMode,
  );
  const showNavigationSwitcher = !model.isCreateMode && model.items.length > 1;

  useEffect(() => {
    if (!isRenaming) {
      setRenameValue(model.editorId ?? '');
    }
  }, [isRenaming, model.editorId]);

  const startRename = useCallback(() => {
    if (!canRename || model.isSaving) {
      return;
    }
    setRenameValue(model.editorId ?? '');
    setIsRenaming(true);
  }, [canRename, model.editorId, model.isSaving]);

  const cancelRename = useCallback(() => {
    setRenameValue(model.editorId ?? '');
    setIsRenaming(false);
  }, [model.editorId]);

  const exitRenameMode = useCallback(() => {
    setIsRenaming(false);
  }, []);

  const confirmRename = useCallback(async () => {
    if (!model.editorId || model.isSaving) {
      return;
    }

    const trimmed = renameValue.trim();
    if (!trimmed) {
      return;
    }

    model.beginModalCloseProtection();

    try {
      if (trimmed === model.editorId) {
        exitRenameMode();
        restoreIdentityFocus();
        return;
      }

      const saved = await model.renameNavigation(model.editorId, renameValue);
      if (saved) {
        exitRenameMode();
        restoreIdentityFocus();
      }
    } finally {
      model.endModalCloseProtection();
    }
  }, [exitRenameMode, model, renameValue, restoreIdentityFocus]);

  const handleRenameEnterKey = useCallback((event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter') {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    void confirmRename();
  }, [confirmRename]);

  const swallowRenameEnterKey = useCallback((event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter') {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
  }, []);

  const confirmCreate = useCallback(async () => {
    if (model.isSaving || !model.canSavePortalNavigation) {
      return;
    }

    await model.savePortalNavigation();
  }, [model]);

  const handleCreateEnterKey = useCallback((event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter') {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    void confirmCreate();
  }, [confirmCreate]);

  const swallowCreateEnterKey = useCallback((event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter') {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
  }, []);

  const handleDropdownChange = (value: string) => {
    model.selectNavigation(value);
  };

  let identityContent: React.ReactNode;

  if (model.isCreateMode) {
    identityContent = (
      <div
        data-portal-nav-identity=""
        className={`${NAVIGATION_EDITOR_ID_CLASS} ${NAVIGATION_IDENTITY_WIDTH_CLASS} !flex-none !p-0 overflow-hidden border-indigo-300 bg-indigo-50/40`}
        onClick={(event) => event.stopPropagation()}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <UiInput
          size="sm"
          aiAssist={false}
          autoDir={false}
          autoFocus
          value={model.editor.workingManifest?.id ?? ''}
          onChange={(event) => model.updateCreateId(event.target.value)}
          onKeyDown={handleCreateEnterKey}
          onKeyUp={swallowCreateEnterKey}
          onFocus={(event) => event.currentTarget.select()}
          className="min-h-0 min-w-0 flex-1 !rounded-none !border-0 !bg-transparent px-3 py-1 font-mono text-sm text-slate-700 !shadow-none outline-none ring-0"
          placeholder={`e.g. ${portalSegment}-sidebar`}
          ariaLabel="Navigation id"
          disabled={model.isSaving}
        />
      </div>
    );
  } else if (isRenaming) {
    identityContent = (
      <div
        data-portal-nav-identity=""
        className={`${NAVIGATION_EDITOR_ID_CLASS} ${NAVIGATION_IDENTITY_WIDTH_CLASS} !flex-none !p-0 overflow-hidden border-indigo-300 bg-indigo-50/40`}
        onClick={(event) => event.stopPropagation()}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <UiInput
          size="sm"
          aiAssist={false}
          autoDir={false}
          autoFocus
          value={renameValue}
          onChange={(event) => setRenameValue(event.target.value)}
          onFocus={(event) => event.currentTarget.select()}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault();
              event.stopPropagation();
              cancelRename();
              return;
            }
            handleRenameEnterKey(event);
          }}
          onKeyUp={swallowRenameEnterKey}
          className="min-h-0 min-w-0 flex-1 !rounded-none !border-0 !bg-transparent px-3 py-1 font-mono text-sm text-slate-700 !shadow-none outline-none ring-0"
          ariaLabel="Rename navigation"
          disabled={model.isSaving}
        />
        <div className="flex shrink-0 items-center gap-px pe-1">
          <button
            type="button"
            className="inline-flex h-6 w-6 items-center justify-center rounded-sm text-emerald-600 hover:bg-emerald-50"
            aria-label="Confirm rename"
            disabled={model.isSaving}
            onMouseDown={() => {
              model.beginModalCloseProtection();
            }}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              void confirmRename();
            }}
          >
            <Check className="h-3 w-3 stroke-[2]" />
          </button>
          <button
            type="button"
            className="inline-flex h-6 w-6 items-center justify-center rounded-sm text-slate-500 hover:bg-slate-100"
            aria-label="Cancel rename"
            disabled={model.isSaving}
            onMouseDown={(event) => event.preventDefault()}
            onClick={cancelRename}
          >
            <X className="h-3 w-3 stroke-[2]" />
          </button>
        </div>
      </div>
    );
  } else {
    identityContent = (
      <button
        ref={identityAnchorRef}
        type="button"
        className={`${NAVIGATION_EDITOR_ID_CLASS} ${NAVIGATION_IDENTITY_WIDTH_CLASS} !flex-none truncate text-start ${
          canRename ? 'cursor-text hover:border-indigo-200 hover:bg-indigo-50/40' : ''
        }`}
        title={canRename ? `${model.editorId} — double-click to rename` : model.editorId ?? undefined}
        disabled={!canRename}
        onDoubleClick={startRename}
      >
        {model.editorId}
      </button>
    );
  }

  return (
    <div className="flex min-w-0 items-center gap-2">
      {showNavigationSwitcher ? (
        <PortalNavigationSwitcher
          items={model.items}
          value={model.editorId ?? ''}
          disabled={isRenaming}
          onChange={handleDropdownChange}
        />
      ) : null}      {identityContent}
    </div>
  );
};

type PortalNavigationActionsProps = {
  model: PortalNavigationsModel;
};

export const PortalNavigationActions: React.FC<PortalNavigationActionsProps> = ({ model }) => {
  const selectedItem = model.items.find((item) => item.id === model.editorId);

  return (
    <>
      <AppButton
        intent="create"
        size="sm"
        disabled={model.isCreateMode}
        onClick={model.startCreateNavigation}
      >
        <Plus className="h-3.5 w-3.5" />
        Add navigation
      </AppButton>

      {!model.isCreateMode && selectedItem && !selectedItem.builtIn ? (
        <AppButton
          intent="destructive"
          size="sm"
          onClick={() => {
            model.setFormError(null);
            model.setDeleteTargetId(selectedItem.id);
          }}
        >
          <Trash2 className="h-3.5 w-3.5" />
          Delete navigation
        </AppButton>
      ) : null}
    </>
  );
};
