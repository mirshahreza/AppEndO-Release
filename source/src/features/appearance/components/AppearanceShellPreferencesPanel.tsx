import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AccentColorPicker } from '../../../components/AccentColorPicker';
import { useAccentTheme } from '../../../contexts/AccentThemeContext';
import { STUDIO_MOUNT_ID } from '../../../shared/api/contracts/platform/mountConstants';
import type {
  PortalShellAppearanceDefaults,
  UserShellExperience,
} from '../../../shared/api/contracts/appearance/shellExperience.schema';
import {
  resetUserShellExperience,
  useAppearanceSession,
  useSavePortalAppearanceDefaults,
  useSaveUserShellExperience,
} from '../../../shared/api/queries/appearance';
import {
  mergePortalShellAppearanceDefaults,
  resolveEffectiveShellExperience,
} from '../../../shared/theme/shellExperienceDefaults';
import {
  AppButton,
  FieldHintTooltip,
  UiInput,
  UiSelect,
  UiSwitch,
} from '../../../shared/ui';
import {
  ADMIN_SHELL_SIDEBAR_WIDTH_EXPANDED_DEFAULT_PX,
  ADMIN_SHELL_SIDEBAR_WIDTH_EXPANDED_MAX_PX,
  ADMIN_SHELL_SIDEBAR_WIDTH_EXPANDED_MIN_PX,
  clampAdminShellSidebarExpandedWidthPx,
} from '../../../shared/ui/adminShellSidebarWidth';
import { useAuth } from '../../../contexts/AuthContext';
import { useOptionalCulture } from '../../../core/culture/CultureContext';
import { useShellExperience } from '../../../contexts/ShellExperienceContext';
import { fetchAppearanceSession } from '../../../shared/api/queries/appearance';
import { appearanceLabel } from '../lib/appearanceCulture';

const shellFieldSize = 'sm' as const;

const AppearanceSwitchRow: React.FC<{
  label: string;
  hint?: string;
  isSelected: boolean;
  isDisabled?: boolean;
  onChange: (selected: boolean) => void;
  ariaLabel: string;
}> = ({ label, hint, isSelected, isDisabled, onChange, ariaLabel }) => (
  <div className="flex items-center justify-between gap-3">
    <div className="flex min-w-0 items-center gap-1">
      <span className="text-[11px] font-semibold leading-snug text-slate-600">{label}</span>
      {hint?.trim() ? <FieldHintTooltip hint={hint} label={label} /> : null}
    </div>
    <UiSwitch
      className="shrink-0"
      isSelected={isSelected}
      isDisabled={isDisabled}
      onChange={onChange}
      aria-label={ariaLabel}
    />
  </div>
);

type AppearanceShellPreferencesPanelProps = {
  mountId?: string;
};

export const AppearanceShellPreferencesPanel: React.FC<AppearanceShellPreferencesPanelProps> = ({
  mountId = STUDIO_MOUNT_ID,
}) => {
  const culture = useOptionalCulture();
  const t = culture?.t;
  const label = (suffix: string, fallback: string) => appearanceLabel(t, suffix, fallback);

  const { accentHex } = useAccentTheme();
  const { isAuthenticated } = useAuth();
  const {
    applySession,
    sidebarCollapsed: runtimeSidebarCollapsed,
    navExpandedGroups: runtimeNavExpandedGroups,
  } = useShellExperience();
  const sessionQuery = useAppearanceSession(mountId, isAuthenticated);
  const saveUser = useSaveUserShellExperience(mountId);
  const savePortal = useSavePortalAppearanceDefaults(mountId);

  const [userDraft, setUserDraft] = useState<Partial<UserShellExperience>>({});
  const [portalDraft, setPortalDraft] = useState<Partial<PortalShellAppearanceDefaults>>({});
  const blockUserDraftSyncRef = useRef(false);
  const blockPortalDraftSyncRef = useRef(false);
  const savedSessionRef = useRef(sessionQuery.data);
  savedSessionRef.current = sessionQuery.data;
  const interactiveChromeRef = useRef({
    sidebarCollapsed: runtimeSidebarCollapsed,
    navExpandedGroups: runtimeNavExpandedGroups,
  });
  interactiveChromeRef.current = {
    sidebarCollapsed: runtimeSidebarCollapsed,
    navExpandedGroups: runtimeNavExpandedGroups,
  };

  const hydrateUserDraftFromSession = (
    data: NonNullable<typeof sessionQuery.data>,
  ): Partial<UserShellExperience> => {
    const portal = mergePortalShellAppearanceDefaults(data.portalDefaults);
    const user = data.userExperience;
    return {
      sidebarCollapsed: user?.sidebarCollapsed ?? portal.sidebarDefaultCollapsed ?? false,
      layoutWidth: user?.layoutWidth ?? portal.layoutWidth ?? 'fluid',
    };
  };


  const isAdmin = sessionQuery.data?.isAdmin ?? false;
  const session = sessionQuery.data;
  const allowUserSidebar = session?.effective.allowUserSidebarPreference ?? true;

  const userBaseline = useMemo(() => {
    if (!session) {
      return null;
    }
    const portal = mergePortalShellAppearanceDefaults(session.portalDefaults);
    const user = session.userExperience;
    return {
      sidebarCollapsed: user?.sidebarCollapsed ?? portal.sidebarDefaultCollapsed ?? false,
      layoutWidth: user?.layoutWidth ?? portal.layoutWidth ?? 'fluid',
    };
  }, [session]);

  const userHasSavedOverrides = useMemo(() => {
    const user = session?.userExperience;
    if (!user) {
      return false;
    }
    return user.sidebarCollapsed != null
      || user.layoutWidth != null
      || (user.navExpandedGroups != null && user.navExpandedGroups.length > 0);
  }, [session?.userExperience]);

  const userDirty = useMemo(() => {
    if (!userBaseline) {
      return false;
    }
    return (userDraft.sidebarCollapsed !== undefined
        && userDraft.sidebarCollapsed !== userBaseline.sidebarCollapsed)
      || (userDraft.layoutWidth !== undefined && userDraft.layoutWidth !== userBaseline.layoutWidth);
  }, [userBaseline, userDraft.layoutWidth, userDraft.sidebarCollapsed]);

  const portalSidebarDefaultDirty = useMemo(() => {
    if (!session) {
      return false;
    }
    return portalDraft.sidebarDefaultCollapsed !== undefined
      && portalDraft.sidebarDefaultCollapsed !== session.portalDefaults.sidebarDefaultCollapsed;
  }, [portalDraft.sidebarDefaultCollapsed, session]);

  const portalDirty = useMemo(() => {
    if (!session) {
      return false;
    }
    return JSON.stringify(portalDraft) !== JSON.stringify(session.portalDefaults);
  }, [portalDraft, session]);

  useEffect(() => {
    if (!sessionQuery.data) {
      return;
    }
    if (!blockUserDraftSyncRef.current) {
      setUserDraft(hydrateUserDraftFromSession(sessionQuery.data));
    }
    if (!blockPortalDraftSyncRef.current) {
      setPortalDraft(sessionQuery.data.portalDefaults);
    }
  }, [sessionQuery.data]);

  /**
   * Live shell preview while editing (persisted only after Save).
   * Runtime sidebar / nav-group chrome is read from `interactiveChromeRef`, not deps:
   * `applySession` writes those same values back into the shell context, so depending
   * on them here would re-run this effect on its own output (render loop).
   */
  useEffect(() => {
    if (!session || portalDraft.version == null) {
      return undefined;
    }
    const {
      sidebarCollapsed: runtimeSidebarCollapsed,
      navExpandedGroups: runtimeNavExpandedGroups,
    } = interactiveChromeRef.current;
    const mergedPortal = mergePortalShellAppearanceDefaults({
      ...session.portalDefaults,
      ...portalDraft,
    });
    let effective = resolveEffectiveShellExperience(mergedPortal, session.userExperience);
    const previewUserSidebarCollapsed = userDirty
      && userDraft.sidebarCollapsed !== undefined;
    const previewPortalSidebarDefault = portalSidebarDefaultDirty
      && portalDraft.sidebarDefaultCollapsed !== undefined;
    if (userDirty) {
      effective = {
        ...effective,
        sidebarCollapsed: previewUserSidebarCollapsed
          ? userDraft.sidebarCollapsed!
          : runtimeSidebarCollapsed,
        layoutWidth: userDraft.layoutWidth ?? effective.layoutWidth,
        navExpandedGroups: [...runtimeNavExpandedGroups],
      };
    } else if (previewPortalSidebarDefault) {
      effective = {
        ...effective,
        sidebarCollapsed: portalDraft.sidebarDefaultCollapsed!,
        navExpandedGroups: [...runtimeNavExpandedGroups],
      };
    } else {
      effective = {
        ...effective,
        sidebarCollapsed: runtimeSidebarCollapsed,
        navExpandedGroups: [...runtimeNavExpandedGroups],
      };
    }
    applySession({
      ...session,
      portalDefaults: mergedPortal,
      effective,
    });
  }, [
    applySession,
    portalDraft,
    portalSidebarDefaultDirty,
    session,
    userDirty,
    userDraft.layoutWidth,
    userDraft.sidebarCollapsed,
  ]);

  useEffect(() => () => {
    const saved = savedSessionRef.current;
    if (!saved) {
      return;
    }
    const { sidebarCollapsed, navExpandedGroups } = interactiveChromeRef.current;
    applySession({
      ...saved,
      effective: {
        ...saved.effective,
        sidebarCollapsed,
        navExpandedGroups: [...navExpandedGroups],
      },
    });
  }, [applySession]);

  const refreshSession = async (next?: Awaited<ReturnType<typeof fetchAppearanceSession>>) => {
    const sessionResponse = next ?? await fetchAppearanceSession(mountId);
    blockUserDraftSyncRef.current = false;
    blockPortalDraftSyncRef.current = false;
    setUserDraft(hydrateUserDraftFromSession(sessionResponse));
    setPortalDraft(sessionResponse.portalDefaults);
    applySession(sessionResponse);
  };

  const patchUserDraft = (patch: Partial<UserShellExperience>) => {
    blockUserDraftSyncRef.current = true;
    setUserDraft((current) => ({ ...current, ...patch }));
  };

  const patchPortalDraft = (patch: Partial<PortalShellAppearanceDefaults>) => {
    blockPortalDraftSyncRef.current = true;
    setPortalDraft((current) => ({ ...current, ...patch }));
  };

  const persistUser = () => {
    if (!session) {
      return;
    }
    void saveUser.mutateAsync({
      version: 1,
      sidebarCollapsed: allowUserSidebar ? (userDraft.sidebarCollapsed ?? null) : null,
      layoutWidth: userDraft.layoutWidth ?? null,
    }).then(() => refreshSession());
  };

  const persistPortal = () => {
    void savePortal.mutateAsync({
      version: 1,
      ...portalDraft,
    }).then(() => refreshSession());
  };

  return (
    <section className="min-h-0 flex-1 overflow-y-auto border-b border-slate-200 bg-slate-50/80 px-4 py-4">
      <div className="mb-4 max-w-3xl">
        <p className="text-xs text-slate-600">
          {label(
            'shell.intro',
            'Accent color, sidebar behavior, and page width. Portal defaults apply until you save personal overrides. Use the Atmosphere tokens tab for frost, textures, and nav chrome.',
          )}
        </p>
      </div>

      <div className="mb-4 max-w-3xl rounded-lg border border-slate-200 bg-white p-3">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-700">
          {label('shell.accent.title', 'Accent')}
        </h3>
        <p className="mb-3 text-[11px] text-slate-500">
          {label(
            'shell.accent.description',
            'Primary buttons, active nav, focus rings, and the brand mark. Large surfaces stay neutral slate.',
          )}
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <AccentColorPicker size="md" />
          <div className="min-w-0">
            <p className="font-mono text-xs font-semibold tabular-nums text-slate-800">{accentHex.toUpperCase()}</p>
            <p className="text-[11px] text-slate-500">
              {label('shell.accent.paletteHint', 'Open the palette to change your accent.')}
            </p>
          </div>
        </div>
      </div>

      {sessionQuery.isLoading ? (
        <p className="text-xs text-slate-500">{label('shell.loading', 'Loading shell preferences…')}</p>
      ) : null}

      {session ? (
        <div className="grid max-w-3xl grid-cols-1 gap-4">
          <div className="relative isolate space-y-3 overflow-visible rounded-lg border border-slate-200 bg-white p-3">
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                {label('shell.userPrefs.title', 'Your preferences')}
              </h3>
              <p className="mt-1 text-[11px] text-slate-500">
                {label(
                  'shell.userPrefs.description',
                  'Saved to your account after sign-in. Reset returns to portal defaults.',
                )}
              </p>
            </div>

            <AppearanceSwitchRow
              label={label('shell.userPrefs.startCollapsed', 'Start collapsed')}
              hint={
                allowUserSidebar
                  ? label(
                    'shell.userPrefs.startCollapsed.hint',
                    'Applies on the next page load and when you have not toggled the sidebar this session.',
                  )
                  : label(
                    'shell.userPrefs.startCollapsed.hintDisabled',
                    'Your admin disabled personal sidebar overrides for this portal.',
                  )
              }
              isSelected={Boolean(userDraft.sidebarCollapsed)}
              isDisabled={!allowUserSidebar}
              onChange={(sidebarCollapsed) => patchUserDraft({ sidebarCollapsed })}
              ariaLabel={label('shell.userPrefs.startCollapsed.aria', 'Start with sidebar collapsed')}
            />

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
              <div className="flex min-w-0 items-center gap-1">
                <span className="text-[11px] font-semibold leading-snug text-slate-600">
                  {label('shell.userPrefs.pageWidth', 'Page width')}
                </span>
                <FieldHintTooltip
                  hint={
                    session.effective.layoutWidthUserControl
                      ? label(
                        'shell.userPrefs.pageWidth.hintControlled',
                        'Previews on the live shell as you change it; Save keeps your override. When portal default is bounded, the header width control toggles fluid expand.',
                      )
                      : label('shell.userPrefs.pageWidth.hintFixed', 'Page width is fixed by portal policy.')
                  }
                  label={label('shell.userPrefs.pageWidth', 'Page width')}
                />
              </div>
              <UiSelect
                className="w-full sm:max-w-[15rem]"
                size={shellFieldSize}
                value={userDraft.layoutWidth ?? session.effective.layoutWidth}
                isDisabled={!session.effective.layoutWidthUserControl}
                onChange={(event) => patchUserDraft({
                  layoutWidth: event.target.value as 'fluid' | 'bounded',
                })}
                ariaLabel={label('shell.userPrefs.pageWidth.aria', 'Page width')}
              >
                <option value="fluid">{label('shell.userPrefs.layout.fluid', 'Fluid (full content width)')}</option>
                <option value="bounded">{label('shell.userPrefs.layout.bounded', 'Bounded (centered column)')}</option>
              </UiSelect>
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              <AppButton
                intent="primary"
                size="sm"
                onClick={persistUser}
                disabled={saveUser.isPending || !userDirty}
              >
                {label('shell.userPrefs.save', 'Save my preferences')}
              </AppButton>
              <AppButton
                intent="secondary"
                size="sm"
                onClick={() => void resetUserShellExperience(mountId).then((next) => refreshSession(next))}
                disabled={saveUser.isPending || !userHasSavedOverrides}
              >
                {label('shell.userPrefs.reset', 'Reset to portal default')}
              </AppButton>
            </div>
          </div>

          {isAdmin ? (
            <div className="relative isolate space-y-4 overflow-visible rounded-lg border border-slate-200 bg-slate-50/60 p-3">
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                  {label('shell.portal.title', 'Portal defaults')}
                </h3>
                <p className="mt-1 text-[11px] text-slate-500">
                  {label(
                    'shell.portal.description',
                    'Applies to every user on this mount until they save personal overrides.',
                  )}
                </p>
              </div>

              <div className="space-y-3">
                <p className="text-[11px] font-semibold text-indigo-700">
                  {label('shell.portal.sidebar', 'Sidebar')}
                </p>
                <AppearanceSwitchRow
                  label={label('shell.portal.newUsersCollapsed', 'New users collapsed')}
                  isSelected={Boolean(portalDraft.sidebarDefaultCollapsed)}
                  onChange={(sidebarDefaultCollapsed) => patchPortalDraft({ sidebarDefaultCollapsed })}
                  ariaLabel={label('shell.portal.newUsersCollapsed.aria', 'Default sidebar collapsed')}
                />
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                  <span className="text-[11px] font-semibold leading-snug text-slate-600">
                    {label('shell.portal.whenCollapsed', 'When collapsed')}
                  </span>
                  <UiSelect
                    className="w-full sm:max-w-[15rem]"
                    size={shellFieldSize}
                    value={portalDraft.sidebarCollapsePolicy ?? 'rail'}
                    onChange={(event) => patchPortalDraft({
                      sidebarCollapsePolicy: event.target.value as 'rail' | 'hidden',
                    })}
                    ariaLabel={label('shell.portal.whenCollapsed.aria', 'Sidebar collapse policy')}
                  >
                    <option value="rail">{label('shell.portal.whenCollapsed.rail', 'Show icon rail')}</option>
                    <option value="hidden">
                      {label('shell.portal.whenCollapsed.hidden', 'Hide completely (header menu expands)')}
                    </option>
                  </UiSelect>
                </div>
                <AppearanceSwitchRow
                  label={label('shell.portal.userSidebarControl', 'User sidebar control')}
                  isSelected={portalDraft.allowUserSidebarPreference ?? true}
                  onChange={(allowUserSidebarPreference) => patchPortalDraft({ allowUserSidebarPreference })}
                  ariaLabel={label('shell.portal.userSidebarControl.aria', 'Users may override sidebar preference')}
                />
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                  <div className="flex min-w-0 items-center gap-1">
                    <span className="text-[11px] font-semibold leading-snug text-slate-600">
                      {label('shell.portal.sidebarWidth', 'Sidebar width')}
                    </span>
                    <FieldHintTooltip
                      hint={label(
                        'shell.portal.sidebarWidth.hint',
                        `Expanded sidebar width in pixels (${ADMIN_SHELL_SIDEBAR_WIDTH_EXPANDED_MIN_PX}–${ADMIN_SHELL_SIDEBAR_WIDTH_EXPANDED_MAX_PX}). Collapsed rail stays 81px.`,
                      )
                        .replace('{min}', String(ADMIN_SHELL_SIDEBAR_WIDTH_EXPANDED_MIN_PX))
                        .replace('{max}', String(ADMIN_SHELL_SIDEBAR_WIDTH_EXPANDED_MAX_PX))}
                      label={label('shell.portal.sidebarWidth', 'Sidebar width')}
                    />
                  </div>
                  <UiInput
                    className="w-full sm:max-w-[7rem]"
                    size={shellFieldSize}
                    type="number"
                    min={ADMIN_SHELL_SIDEBAR_WIDTH_EXPANDED_MIN_PX}
                    max={ADMIN_SHELL_SIDEBAR_WIDTH_EXPANDED_MAX_PX}
                    step={1}
                    value={String(
                      portalDraft.sidebarExpandedWidthPx
                        ?? session?.portalDefaults.sidebarExpandedWidthPx
                        ?? ADMIN_SHELL_SIDEBAR_WIDTH_EXPANDED_DEFAULT_PX,
                    )}
                    onChange={(event) => {
                      const parsed = Number.parseInt(event.target.value, 10);
                      if (!Number.isFinite(parsed)) {
                        return;
                      }
                      patchPortalDraft({
                        sidebarExpandedWidthPx: clampAdminShellSidebarExpandedWidthPx(parsed),
                      });
                    }}
                    ariaLabel={label('shell.portal.sidebarWidth.aria', 'Sidebar expanded width pixels')}
                  />
                </div>
              </div>

              <div className="space-y-3 border-t border-slate-200/80 pt-4">
                <p className="text-[11px] font-semibold text-indigo-700">
                  {label('shell.portal.pageWidthSection', 'Page width')}
                </p>
                <AppearanceSwitchRow
                  label={label('shell.portal.defaultBounded', 'Default bounded')}
                  isSelected={(portalDraft.layoutWidth ?? 'fluid') === 'bounded'}
                  onChange={(bounded) => patchPortalDraft({
                    layoutWidth: bounded ? 'bounded' : 'fluid',
                  })}
                  ariaLabel={label('shell.portal.defaultBounded.aria', 'Default bounded page width')}
                />
                <AppearanceSwitchRow
                  label={label('shell.portal.userWidthControl', 'User width control')}
                  isSelected={portalDraft.layoutWidthUserControl ?? true}
                  onChange={(layoutWidthUserControl) => patchPortalDraft({ layoutWidthUserControl })}
                  ariaLabel={label('shell.portal.userWidthControl.aria', 'Users may toggle page width')}
                />
              </div>

              <AppButton
                intent="primary"
                size="sm"
                onClick={persistPortal}
                disabled={savePortal.isPending || !portalDirty}
              >
                {label('shell.portal.save', 'Save portal defaults')}
              </AppButton>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
};
