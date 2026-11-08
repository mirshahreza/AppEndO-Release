import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Save, Trash2, X } from 'lucide-react';
import { UiColorField } from '../../../components/ui/UiColorField';
import { normalizeHexColor } from '../../../shared/lib/uiColorUtils';
import { AppButton, CreateEditModalShell, ICON_ACTION_BUTTON_BASE_CLASS, ICON_ACTION_DELETE_CLASS, UiInput } from '../../../shared/ui';
import { cn } from '../../../lib/utils';
import { InspectorLucideIconPickerField } from '../../component-designer/components/InspectorLucideIconPickerField';
import type { ScopedBaseInfoTreeModel } from '../hooks/useScopedBaseInfoTree';
import {
  createEmptyOrgChartRootConfig,
  listOrgChartLevelDepths,
  maxSavedLevelDepth,
  measureOrgChartMaxDepth,
  readOrgChartRootConfig,
  resolveOrgChartLevelColor,
  resolveOrgChartLevelIcon,
  resolveOrgChartLevelTitle,
  type OrgChartRootConfig,
} from '../lib/orgChartRootConfig';
import type { OrgGeoWorkspaceConfig } from '../lib/orgGeoWorkspaceConfig';

type LevelDraft = {
  title: string;
  icon: string;
  color: string;
};

type OrgGeoChartSettingsDialogProps = {
  open: boolean;
  page: ScopedBaseInfoTreeModel;
  workspaceConfig: OrgGeoWorkspaceConfig;
  onClose: () => void;
};

const buildInitialDrafts = (
  depths: number[],
  savedConfig: OrgChartRootConfig,
  workspaceConfig: OrgGeoWorkspaceConfig,
): Record<string, LevelDraft> => {
  const next: Record<string, LevelDraft> = {};
  for (const depth of depths) {
    next[String(depth)] = {
      title: resolveOrgChartLevelTitle(depth, savedConfig, workspaceConfig.levelLabel),
      icon: resolveOrgChartLevelIcon(depth, savedConfig, ''),
      color: resolveOrgChartLevelColor(depth, savedConfig),
    };
  }
  for (const [key, level] of Object.entries(savedConfig.levels)) {
    if (next[key]) continue;
    next[key] = {
      title: level.title || '',
      icon: level.icon || '',
      color: level.color || '',
    };
  }
  return next;
};

export const OrgGeoChartSettingsDialog: React.FC<OrgGeoChartSettingsDialogProps> = ({
  open,
  page,
  workspaceConfig,
  onClose,
}) => {
  const [drafts, setDrafts] = useState<Record<string, LevelDraft>>({});
  const [levelCount, setLevelCount] = useState(4);

  const maxTreeDepth = useMemo(() => {
    const syntheticRoot = { children: page.chartTreeData };
    return measureOrgChartMaxDepth(syntheticRoot, 0);
  }, [page.chartTreeData]);

  const savedConfig = useMemo(
    () => readOrgChartRootConfig(page.rootMetadata),
    [page.rootMetadata],
  );

  const depths = useMemo(
    () => Array.from({ length: Math.max(1, levelCount) }, (_, index) => index),
    [levelCount],
  );

  useEffect(() => {
    if (!open) return;
    const savedMax = maxSavedLevelDepth(savedConfig);
    const initialDepths = listOrgChartLevelDepths(maxTreeDepth, {
      savedMaxDepth: savedMax,
      spare: 1,
      minLevels: workspaceConfig.dimensionKey === 'geo' ? 5 : 4,
    });
    setLevelCount(initialDepths.length);
    setDrafts(buildInitialDrafts(initialDepths, savedConfig, workspaceConfig));
  }, [open, maxTreeDepth, savedConfig, workspaceConfig]);

  if (!open) return null;

  const updateDraft = (key: string, patch: Partial<LevelDraft>) => {
    setDrafts((current) => ({
      ...current,
      [key]: {
        title: current[key]?.title ?? '',
        icon: current[key]?.icon ?? '',
        color: current[key]?.color ?? '',
        ...patch,
      },
    }));
  };

  const handleAddLevel = () => {
    const nextDepth = levelCount;
    const key = String(nextDepth);
    setLevelCount((count) => count + 1);
    setDrafts((current) => ({
      ...current,
      [key]: {
        title: workspaceConfig.levelLabel(nextDepth),
        icon: '',
        color: '',
      },
    }));
  };

  const handleRemoveLevel = (depth: number) => {
    if (levelCount <= 1) return;
    const newCount = levelCount - 1;
    const next: Record<string, LevelDraft> = {};
    for (let i = 0; i < newCount; i += 1) {
      const sourceDepth = i < depth ? i : i + 1;
      const sourceKey = String(sourceDepth);
      next[String(i)] = drafts[sourceKey] ?? {
        title: workspaceConfig.levelLabel(i),
        icon: '',
        color: '',
      };
    }
    setLevelCount(newCount);
    setDrafts(next);
  };

  const handleSave = () => {
    const levels: OrgChartRootConfig['levels'] = {};
    for (const depth of depths) {
      const key = String(depth);
      const draft = drafts[key];
      if (!draft) continue;
      const title = draft.title.trim();
      const icon = draft.icon.trim();
      const color = normalizeHexColor(draft.color) ?? '';
      if (!title && !icon && !color) continue;
      levels[key] = {
        title: title || workspaceConfig.levelLabel(depth),
        ...(icon ? { icon } : {}),
        ...(color ? { color } : {}),
      };
    }
    const next: OrgChartRootConfig = {
      ...createEmptyOrgChartRootConfig(),
      levels,
    };
    void page.saveRootChartConfig(next).then((ok) => {
      if (ok) onClose();
    });
  };

  return (
    <CreateEditModalShell
      size="lg"
      title="Chart settings"
      onClose={onClose}
      auxiliaryFooter={(
        <AppButton
          type="button"
          intent="secondary"
          size="sm"
          disabled={page.isSaving}
          onClick={handleAddLevel}
        >
          <Plus className="h-3.5 w-3.5" />
          Add level
        </AppButton>
      )}
      auxiliaryFooterClassName="!mt-0 justify-center"
      footer={(
        <>
          <AppButton intent="cancel" size="sm" onClick={onClose} disabled={page.isSaving}>
            <X className="h-3.5 w-3.5" />
            Cancel
          </AppButton>
          <AppButton
            intent="primary"
            size="sm"
            onClick={handleSave}
            disabled={page.isSaving}
          >
            <Save className="h-3.5 w-3.5" />
            {page.isSaving ? 'Saving…' : 'Save'}
          </AppButton>
        </>
      )}
    >
      <div className="space-y-2">
        {depths.map((depth) => {
          const key = String(depth);
          const draft = drafts[key] || { title: '', icon: '', color: '' };
          return (
            <div key={key} className="flex items-center gap-2">
              <span className="w-14 shrink-0 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                L{depth}
              </span>
              <InspectorLucideIconPickerField
                label=""
                compact
                clearable
                value={draft.icon}
                onChange={(iconName) => updateDraft(key, { icon: iconName })}
                ariaLabel={`Level ${depth} icon`}
                fallbackIcon={workspaceConfig.fallbackIcon}
              />
              <div className="w-[7.5rem] shrink-0">
                <UiColorField
                  value={draft.color}
                  onChange={(value) => updateDraft(key, { color: value })}
                  ariaLabel={`Level ${depth} color`}
                  disabled={page.isSaving}
                  placeholder="#hex"
                  clearable
                />
              </div>
              <UiInput
                className="min-w-0 flex-1"
                id={`org-geo-level-title-${key}`}
                size="sm"
                value={draft.title}
                placeholder={workspaceConfig.levelLabel(depth)}
                ariaLabel={`Level ${depth} title`}
                disabled={page.isSaving}
                onChange={(event) => updateDraft(key, { title: event.target.value })}
              />
              <AppButton
                type="button"
                size="icon-sm"
                className={cn(ICON_ACTION_BUTTON_BASE_CLASS, 'h-7 w-7 shrink-0', ICON_ACTION_DELETE_CLASS)}
                disabled={page.isSaving || levelCount <= 1}
                onClick={() => handleRemoveLevel(depth)}
                aria-label={`Remove level ${depth}`}
                title={`Remove level ${depth}`}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </AppButton>
            </div>
          );
        })}
      </div>
    </CreateEditModalShell>
  );
};
