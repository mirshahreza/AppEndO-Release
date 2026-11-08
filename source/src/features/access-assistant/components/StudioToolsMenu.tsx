import React, { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import { Blocks, Check, ChevronDown, Gauge, KeyRound, Languages, Pencil } from 'lucide-react';
import { cn } from '../../../lib/utils';
import {
  SPLIT_BUTTON_MENU_PANEL_FIXED_CLASS,
  useFixedDropDownMenuStyle,
  useSplitButtonMenu,
} from '../../../shared/ui/AppSplitButton';
import { HeaderHintTooltip } from '../../../shared/ui/SideHintTooltip';
import { useAccessAssistantEligibilityQuery } from '../../../shared/api/queries/access-assistant';
import { isAccessAssistantPageEligible } from '../../../shared/lib/access-assistant/pageEligibility';
import { useStudioToolsGate } from '../hooks/useStudioToolsGate';
import { buildEditComponentUrl, isClientComponentEditSlug } from '../lib/buildEditComponentUrl';
import { useOptionalInlineTranslation } from '../inlineTranslation/InlineTranslationProvider';
import { AccessAssistantWizard } from './AccessAssistantWizard';
import { PageLoadProfileDialog } from './PageLoadProfileDialog';
import { useOptionalCulture } from '../../../core/culture/CultureContext';
import { TRANSLATION_BASE_EN } from '../../../core/culture/translations/baseEn';
import { materializePageLoadProfileForView } from '../../../shared/lib/pageLoadProfile/store';
import { normalizeProfilePath } from '../../../shared/lib/pageLoadProfile/normalizeProfilePath';

export type StudioToolsMenuProps = {
  pageKey: string | null | undefined;
  pageTitle: string;
  /** Header chrome: mirror dropdown alignment in RTL. `window` = floating panel / modal header. */
  variant?: 'header' | 'window' | 'default';
};

export const StudioToolsMenu: React.FC<StudioToolsMenuProps> = ({
  pageKey,
  pageTitle,
  variant = 'default',
}) => {
  const gate = useStudioToolsGate();
  const location = useLocation();
  const normalizedPath = normalizeProfilePath(location.pathname);
  const culture = useOptionalCulture();
  const t = (key: string) => (
    culture?.ready ? culture.t(key) : (TRANSLATION_BASE_EN[key] ?? key)
  );
  const inlineTranslation = useOptionalInlineTranslation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const menuPanelRef = useRef<HTMLDivElement>(null);
  const headerMenuPortaled = variant === 'header' || variant === 'window';
  const menuRef = useSplitButtonMenu(
    open,
    setOpen,
    headerMenuPortaled ? [menuPanelRef] : [],
  );

  const trimmedPageKey = pageKey?.trim() ?? '';
  const eligibilityQuery = useAccessAssistantEligibilityQuery(
    trimmedPageKey,
    gate && Boolean(trimmedPageKey),
  );
  const fixedMenuStyle = useFixedDropDownMenuStyle(
    headerMenuPortaled && open,
    menuRef,
    { align: 'end', minWidth: 220, panelRef: menuPanelRef },
  );

  if (!gate) {
    return null;
  }

  const eligibility = eligibilityQuery.data?.eligibility;
  const clientEligible = isAccessAssistantPageEligible(trimmedPageKey);
  const accessEnabled = eligibilityQuery.isSuccess
    ? (eligibility?.eligible ?? false)
    : clientEligible;
  const accessDisabledReason = !accessEnabled
    ? (eligibility?.reason
      ?? (clientEligible ? undefined : t('shell.studioTools.accessNotAvailableDev'))
      ?? (eligibilityQuery.isError ? t('shell.studioTools.eligibilityLoadFailed') : undefined))
    : undefined;
  const editEnabled = eligibility?.editComponent?.enabled ?? false;
  const editSlug = eligibility?.editComponent?.componentSlug;

  const triggerClass = cn(
    variant === 'window'
      ? 'inline-flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-md transition-colors'
      : 'inline-flex h-8 min-h-8 max-h-8 shrink-0 cursor-pointer items-center gap-1 rounded-md px-2.5 text-xs font-semibold leading-none transition-colors',
    open
      ? 'bg-primary-subtle/50 text-primary-700'
      : variant === 'window'
        ? 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
        : 'text-slate-400 hover:bg-primary-subtle/45 hover:text-primary-700',
  );

  const menuAlignClass = 'end-0';

  const menuPanelClass = headerMenuPortaled
    ? cn(
      SPLIT_BUTTON_MENU_PANEL_FIXED_CLASS,
      'min-w-[220px] rounded-lg py-1',
      variant === 'window' && 'z-[10050]',
    )
    : cn(
      'absolute top-full z-[500] mt-1 min-w-[220px] rounded-lg border border-slate-200 bg-white py-1 shadow-lg',
      menuAlignClass,
    );

  const menuPanel = open ? (
    <div
      ref={headerMenuPortaled ? menuPanelRef : undefined}
      role="menu"
      className={menuPanelClass}
      style={headerMenuPortaled ? fixedMenuStyle : undefined}
    >
      <button
        type="button"
        role="menuitem"
        disabled={!trimmedPageKey || !accessEnabled}
        title={!trimmedPageKey ? t('shell.studioTools.notAvailableOnSurface') : accessDisabledReason}
        className="flex w-full items-center gap-2 px-3 py-2 text-start text-sm text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        onClick={() => {
          setOpen(false);
          setWizardOpen(true);
        }}
      >
        <KeyRound className="h-4 w-4 text-cyan-600" aria-hidden />
        {t('shell.studioTools.accessAssistant')}
      </button>
      <div className="my-1 border-t border-slate-200" role="separator" aria-hidden="true" />
      <button
        type="button"
        role="menuitem"
        disabled={!inlineTranslation}
        title={inlineTranslation ? undefined : t('shell.studioTools.inlineTranslationsUnavailable')}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-start text-sm text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        onClick={() => {
          setOpen(false);
          inlineTranslation?.toggle();
        }}
      >
        <span className="inline-flex items-center gap-2">
          <Languages className="h-4 w-4 text-emerald-600" aria-hidden />
          {t('shell.studioTools.inlineTranslations')}
        </span>
        {inlineTranslation?.active ? (
          <Check className="h-4 w-4 text-primary-600" aria-hidden />
        ) : null}
      </button>
      <div className="my-1 border-t border-slate-200" role="separator" aria-hidden="true" />
      <button
        type="button"
        role="menuitem"
        disabled={!editEnabled || !editSlug || !isClientComponentEditSlug(editSlug ?? '')}
        title={editEnabled ? undefined : eligibility?.editComponent?.reason}
        className="flex w-full items-center gap-2 px-3 py-2 text-start text-sm text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        onClick={() => {
          setOpen(false);
          if (!editSlug) {
            return;
          }
          const target = buildEditComponentUrl(location.pathname, editSlug);
          if (target) {
            navigate(target);
          }
        }}
      >
        <Pencil className="h-4 w-4 text-indigo-600" aria-hidden />
        {t('shell.studioTools.editComponent')}
      </button>
      <div className="my-1 border-t border-slate-200" role="separator" aria-hidden="true" />
      <button
        type="button"
        role="menuitem"
        className="flex w-full items-center gap-2 px-3 py-2 text-start text-sm text-slate-800 hover:bg-slate-50"
        onClick={() => {
          setOpen(false);
          materializePageLoadProfileForView(normalizedPath, trimmedPageKey || null);
          setProfileOpen(true);
        }}
      >
        <Gauge className="h-4 w-4 text-violet-600" aria-hidden />
        {t('shell.studioTools.pageLoadProfile.menu')}
      </button>
    </div>
  ) : null;

  const renderedMenu = headerMenuPortaled && menuPanel && typeof document !== 'undefined'
    ? createPortal(menuPanel, document.body)
    : menuPanel;

  return (
    <>
      <div
        ref={menuRef}
        data-studio-tools-menu
        data-floating-panel-drag-exclude
        className="relative shrink-0"
      >
        <HeaderHintTooltip
          title={t('shell.studioTools.title')}
          hint={t('shell.studioTools.hint')}
          tone="cyan"
        >
          <button
            type="button"
            className={triggerClass}
            aria-expanded={open}
            aria-haspopup="menu"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={() => setOpen((value) => !value)}
          >
            <Blocks className={cn('shrink-0', variant === 'window' ? 'h-4 w-4' : 'h-3.5 w-3.5')} aria-hidden />
            {variant === 'window' ? null : (
              <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
            )}
          </button>
        </HeaderHintTooltip>
        {renderedMenu}
      </div>
      {trimmedPageKey ? (
        <AccessAssistantWizard
          open={wizardOpen}
          pageKey={trimmedPageKey}
          pageTitle={pageTitle}
          onClose={() => setWizardOpen(false)}
        />
      ) : null}
      {profileOpen ? (
        <PageLoadProfileDialog open onClose={() => setProfileOpen(false)} />
      ) : null}
    </>
  );
};
