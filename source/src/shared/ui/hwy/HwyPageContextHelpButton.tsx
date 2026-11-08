import React, { useMemo, useState } from 'react';
import { Info, X } from 'lucide-react';

import { useCulture } from '../../../core/culture/CultureContext';
import { navDescriptionKey, resolveNavLabel } from '../../../core/culture/cultureShellKeys';
import {
  findHwyBusinessRulesReferenceSection,
  hwyBusinessRulesReferenceRuleBodyKey,
  hwyBusinessRulesReferenceRuleTitleKey,
  hwyBusinessRulesReferenceSectionIntroKey,
  hwyBusinessRulesReferenceSectionTitleKey,
  type HwyBusinessRulesReferenceSectionId,
} from '../../../domain/hwy/hwyBusinessRulesReferenceCatalog';
import {
  isHwyPageContextHelpEligible,
  resolveHwyPageContextHelpSections,
} from '../../../domain/hwy/hwyPageContextHelpCatalog';
import { useOptionalActiveStudioPageKey } from '../../context/ActiveStudioPageKeyContext';
import { cn } from '../../../lib/utils';
import { AppButton } from '../AppButton';
import { ConfirmDialogShell } from '../ConfirmDialogShell';
import { PAGE_TOOLBAR_ACTION_SEPARATOR_CLASS } from '../surfaceClasses';

const HWY_PAGE_HELP_BUTTON_CLASS = cn(
  'shrink-0 border border-sky-200/90 bg-gradient-to-b from-white to-sky-50/80',
  'text-sky-800 shadow-xs hover:border-sky-300/90 hover:from-white hover:to-sky-50',
);

export type HwyPageContextHelpButtonProps = {
  pageKey?: string;
  pageTitle?: string;
  sectionIds?: readonly HwyBusinessRulesReferenceSectionId[];
  className?: string;
  /** When false, omits the leading separator in the actions cluster. */
  separatorBefore?: boolean;
};

export const HwyPageContextHelpButton: React.FC<HwyPageContextHelpButtonProps> = ({
  pageKey: pageKeyProp,
  pageTitle,
  sectionIds: sectionIdsProp,
  className,
  separatorBefore = false,
}) => {
  const culture = useCulture();
  const t = (key: string, fallback: string) => culture.t(key) || fallback;
  const contextPageKey = useOptionalActiveStudioPageKey();
  const pageKey = (pageKeyProp ?? contextPageKey ?? '').trim();
  const [open, setOpen] = useState(false);

  const sectionIds = useMemo(
    () => sectionIdsProp ?? resolveHwyPageContextHelpSections(pageKey),
    [pageKey, sectionIdsProp],
  );

  if (!isHwyPageContextHelpEligible(pageKey)) {
    return null;
  }

  const title = pageTitle?.trim()
    || resolveNavLabel(culture.t, pageKey, pageKey);
  const descriptionKey = navDescriptionKey(pageKey);
  const descriptionRaw = t(descriptionKey, '');
  const pageDescription = descriptionRaw && descriptionRaw !== descriptionKey
    ? descriptionRaw
    : '';

  const extraIntroKey = `hwy.pageHelp.${pageKey}.intro`;
  const extraIntroRaw = t(extraIntroKey, '');
  const extraIntro = extraIntroRaw && extraIntroRaw !== extraIntroKey ? extraIntroRaw : '';

  const rulesHeading = t('hwy.pageHelp.rulesHeading', 'Applied rules');
  const closeLabel = t('actions.close', 'Close');
  const buttonAria = t('hwy.pageHelp.buttonAria', 'About this page and its rules');

  const ruleBlocks = sectionIds.flatMap((sectionId) => {
    const section = findHwyBusinessRulesReferenceSection(sectionId);
    if (!section) {
      return [];
    }
    const sectionTitle = t(
      hwyBusinessRulesReferenceSectionTitleKey(sectionId),
      sectionId,
    );
    const sectionIntro = t(
      hwyBusinessRulesReferenceSectionIntroKey(sectionId),
      '',
    );
    const rules = section.ruleIds.map((ruleId) => ({
      id: ruleId,
      title: t(hwyBusinessRulesReferenceRuleTitleKey(ruleId), ruleId),
      body: t(hwyBusinessRulesReferenceRuleBodyKey(ruleId), ''),
    }));
    return [{ sectionId, sectionTitle, sectionIntro, rules }];
  });

  return (
    <>
      {separatorBefore ? (
        <span className={PAGE_TOOLBAR_ACTION_SEPARATOR_CLASS} aria-hidden="true" />
      ) : null}
      <AppButton
        intent="secondary"
        size="icon-md"
        className={cn(HWY_PAGE_HELP_BUTTON_CLASS, className)}
        aria-label={buttonAria}
        title={buttonAria}
        onClick={() => setOpen(true)}
      >
        <Info className="h-4 w-4 shrink-0 stroke-[2]" aria-hidden />
      </AppButton>

      <ConfirmDialogShell
        open={open}
        title={title}
        onClose={() => setOpen(false)}
        size="maximized"
        bodyFill
        footer={(
          <AppButton intent="cancel" size="sm" onClick={() => setOpen(false)}>
            <X className="h-3.5 w-3.5 shrink-0" aria-hidden />
            {closeLabel}
          </AppButton>
        )}
      >
        <div className="space-y-4 text-start">
          {pageDescription ? (
            <p className="text-sm leading-relaxed text-slate-700">{pageDescription}</p>
          ) : null}
          {extraIntro ? (
            <p className="text-sm leading-relaxed text-slate-600">{extraIntro}</p>
          ) : null}
          {pageKey === 'hwy-business-rules-reference' ? (
            <p className="text-sm leading-relaxed text-slate-600">
              {t(
                'hwy.businessRules.page.lead',
                'This page documents rules enforced in the new system. Update it when domain logic changes.',
              )}
            </p>
          ) : null}
          {ruleBlocks.length > 0 ? (
            <div className="space-y-4 border-t border-slate-200/80 pt-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {rulesHeading}
              </p>
              {ruleBlocks.map((block) => (
                <section key={block.sectionId} className="space-y-2">
                  <h3 className="text-sm font-semibold text-slate-900">{block.sectionTitle}</h3>
                  {block.sectionIntro ? (
                    <p className="text-xs leading-relaxed text-slate-600">{block.sectionIntro}</p>
                  ) : null}
                  <ul className="m-0 list-none space-y-2 p-0">
                    {block.rules.map((rule) => (
                      <li
                        key={rule.id}
                        className="rounded-md border border-slate-200/70 bg-slate-50/50 px-2.5 py-2"
                      >
                        <p className="text-xs font-semibold text-slate-800">{rule.title}</p>
                        {rule.body ? (
                          <p className="mt-1 text-xs leading-relaxed text-slate-600">{rule.body}</p>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          ) : null}
        </div>
      </ConfirmDialogShell>
    </>
  );
};
