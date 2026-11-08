import React, { useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { ExperienceManifestPortal } from '../../../shared/api/contracts/platform/experienceManifest';
import { displayPackageWorkspaceAssetName, isPackageWorkspaceAssetUrl } from '../../../shared/lib/packageWorkspaceAssets';
import { isWebFontPlatformAssetUrl, webFontPlatformAssetUrlToRelativePath } from '../../../shared/lib/platformWebFonts';
import { AppButton, FormSection, SideBySideTransferList } from '../../../shared/ui';
import type { PackageBuilderManualFile } from '../lib/packageBuilderManualFiles';
import type { PortalPackageDependencies } from '../lib/resolvePortalPackageDependencies';
import { PackageWorkspaceAssetsPickerDialog } from './PackageWorkspaceAssetsPickerDialog';

type PackageBuilderPortalStepProps = {
  availablePortals: ExperienceManifestPortal[];
  selectedPortals: ExperienceManifestPortal[];
  availableShells: Array<{ shellKey: string; title: string }>;
  selectedShells: Array<{ shellKey: string; title: string }>;
  dependencies: PortalPackageDependencies;
  manualFiles: PackageBuilderManualFile[];
  onMoveToRight: (segment: string) => void;
  onMoveToLeft: (segment: string) => void;
  onShellMoveToRight: (shellKey: string) => void;
  onShellMoveToLeft: (shellKey: string) => void;
  onAddManualFiles: (workspacePaths: string[]) => void;
  onRemoveManualFile: (id: string) => void;
  onNotify?: (type: 'success' | 'error', text: string) => void;
};

type DependencyCard = {
  key: string;
  kind: 'Navigation' | 'Layout' | 'Shell' | 'Landing' | 'File';
  name: string;
  manual?: boolean;
  manualId?: string;
};

const DEPENDENCY_KIND_CLASS: Record<DependencyCard['kind'], string> = {
  Navigation: 'text-emerald-700',
  Layout: 'text-violet-700',
  Shell: 'text-indigo-700',
  Landing: 'text-cyan-700',
  File: 'text-slate-600',
};

function displayDependencyName(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return '—';
  }

  const segments = trimmed.split('/').filter(Boolean);
  if (segments.length <= 1) {
    return trimmed;
  }

  return segments[segments.length - 1] ?? trimmed;
}

function buildDependencyCards(
  dependencies: PortalPackageDependencies,
  manualFiles: PackageBuilderManualFile[],
): DependencyCard[] {
  const cards: DependencyCard[] = [];
  const seenLayouts = new Set<string>();
  const seenFiles = new Set<string>();

  for (const navigation of dependencies.navigations) {
    cards.push({
      key: `navigation:${navigation.id}`,
      kind: 'Navigation',
      name: navigation.id,
    });
  }

  for (const layout of dependencies.layouts) {
    if (seenLayouts.has(layout.layoutLabel)) {
      continue;
    }
    seenLayouts.add(layout.layoutLabel);
    cards.push({
      key: `layout:${layout.layoutLabel}`,
      kind: layout.shell ? 'Shell' : 'Layout',
      name: layout.shell
        ? layout.shell.title
        : displayDependencyName(layout.layoutLabel),
    });
  }

  for (const shell of dependencies.shells) {
    const key = `shell:${shell.shellKey}`;
    if (seenLayouts.has(key) || seenLayouts.has(`Shell · ${shell.title}`)) {
      continue;
    }
    seenLayouts.add(key);
    cards.push({
      key,
      kind: 'Shell',
      name: shell.title,
    });
  }

  for (const landing of dependencies.landings) {
    cards.push({
      key: `landing:${landing.componentKey}`,
      kind: 'Landing',
      name: landing.label || landing.componentKey,
    });
  }

  for (const file of dependencies.files) {
    if ((!isPackageWorkspaceAssetUrl(file.path) && !isWebFontPlatformAssetUrl(file.path)) || seenFiles.has(file.path)) {
      continue;
    }
    seenFiles.add(file.path);
    const fontRelative = webFontPlatformAssetUrlToRelativePath(file.path);
    cards.push({
      key: `file:${file.path}`,
      kind: 'File',
      name: fontRelative
        ? displayPackageWorkspaceAssetName(fontRelative)
        : displayPackageWorkspaceAssetName(file.path.replace(/^\/assets\/workspace\//, '')),
    });
  }

  for (const manualFile of manualFiles) {
    cards.push({
      key: `manual:${manualFile.id}`,
      kind: 'File',
      name: manualFile.fileName,
      manual: true,
      manualId: manualFile.id,
    });
  }

  return cards;
}

export const PackageBuilderPortalStep: React.FC<PackageBuilderPortalStepProps> = ({
  availablePortals,
  selectedPortals,
  availableShells,
  selectedShells,
  dependencies,
  manualFiles,
  onMoveToRight,
  onMoveToLeft,
  onShellMoveToRight,
  onShellMoveToLeft,
  onAddManualFiles,
  onRemoveManualFile,
  onNotify,
}) => {
  const [isAssetPickerOpen, setIsAssetPickerOpen] = useState(false);
  const hasSelectedPortals = selectedPortals.length > 0;
  const hasSelectedShells = selectedShells.length > 0;
  const dependencyCards = useMemo(
    () => buildDependencyCards(dependencies, manualFiles),
    [dependencies, manualFiles],
  );

  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col gap-1">
        <FormSection
          title="Portal"
          ink="accent"
          className="flex h-[26%] min-h-[9rem] max-h-[28%] shrink-0 flex-col gap-3 !space-y-0 overflow-hidden"
        >
          <div className="flex min-h-0 flex-1 flex-col">
            <SideBySideTransferList
              listId="package-builder-portals"
              tone="emerald"
              compact
              className="min-h-0 flex-1"
              leftTitle="Available"
              rightTitle="In Package"
              leftHint="Drag or double-click to attach a portal."
              rightHint="Drag or double-click to detach."
              columns={[
                { key: 'segment', label: 'Segment' },
                { key: 'name', label: 'Name' },
              ]}
              leftItems={availablePortals.map((portal) => ({
                id: portal.segment,
                cells: [
                  <span className="font-mono text-slate-600">{portal.segment}</span>,
                  portal.name,
                ],
              }))}
              rightItems={selectedPortals.map((portal) => ({
                id: portal.segment,
                cells: [
                  <span className="font-mono text-slate-600">{portal.segment}</span>,
                  portal.name,
                ],
              }))}
              onMoveToRight={onMoveToRight}
              onMoveToLeft={onMoveToLeft}
              leftEmptyMessage="No portals available."
              rightEmptyMessage="Drag portals here to include them in the package."
            />
          </div>
        </FormSection>

        <FormSection
          title="Shells"
          ink="complement"
          divided
          className="flex h-[26%] min-h-[9rem] max-h-[28%] shrink-0 flex-col gap-3 !space-y-0 overflow-hidden"
        >
          <div className="flex min-h-0 flex-1 flex-col">
            <SideBySideTransferList
              listId="package-builder-shells"
              tone="indigo"
              compact
              className="min-h-0 flex-1"
              leftTitle="Available"
              rightTitle="In Package"
              leftHint="Pack a shell alone, or portals auto-include their Shell Designer layout."
              rightHint="Portal-linked shells stay included while the portal is selected."
              columns={[
                { key: 'shellKey', label: 'Key' },
                { key: 'title', label: 'Name' },
              ]}
              leftItems={availableShells.map((shell) => ({
                id: shell.shellKey,
                cells: [
                  <span className="font-mono text-slate-600">{shell.shellKey}</span>,
                  shell.title,
                ],
              }))}
              rightItems={selectedShells.map((shell) => ({
                id: shell.shellKey,
                cells: [
                  <span className="font-mono text-slate-600">{shell.shellKey}</span>,
                  shell.title,
                ],
              }))}
              onMoveToRight={onShellMoveToRight}
              onMoveToLeft={onShellMoveToLeft}
              leftEmptyMessage="No Shell Designer shells available."
              rightEmptyMessage="Drag shells here, or select a portal that uses one."
            />
          </div>
        </FormSection>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <FormSection
            title="Dependencies"
            ink="contrast"
            divided
            className="min-h-0 flex-1 overflow-hidden"
            headerExtra={(
              <AppButton intent="utility" onClick={() => setIsAssetPickerOpen(true)}>
                <Plus className="w-3.5 h-3.5" />
                Add Files
              </AppButton>
            )}
          >
            {dependencyCards.length === 0 ? (
              <p className="text-sm text-slate-500 ps-[4px]">
                {hasSelectedPortals || hasSelectedShells
                  ? 'No extra file dependencies detected yet. Use Add Files to attach workspace assets manually.'
                  : 'Select a portal or shell to auto-detect dependencies, or use Add Files to attach workspace assets manually.'}
              </p>
            ) : (
              <div className="grid min-h-0 flex-1 grid-cols-1 gap-2 overflow-auto sm:grid-cols-2 lg:grid-cols-3">
                {dependencyCards.map((card) => (
                  <div
                    key={card.key}
                    className="relative rounded-md border border-slate-200 bg-slate-50/70 px-3 py-2.5"
                    title={card.name}
                  >
                    {card.manual && card.manualId ? (
                      <AppButton
                        closeIcon
                        className="absolute end-1.5 top-1.5"
                        onClick={() => onRemoveManualFile(card.manualId!)}
                        aria-label={`Remove ${card.name}`}
                        title={`Remove ${card.name}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </AppButton>
                    ) : null}
                    <p className={`ps-[4px] text-[10px] font-bold uppercase tracking-wider ${DEPENDENCY_KIND_CLASS[card.kind]}`}>
                      {card.kind}
                    </p>
                    <p className="mt-[2px] truncate pe-7 ps-[4px] text-sm font-medium text-slate-800">
                      {card.name}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </FormSection>
        </div>
      </div>

      <PackageWorkspaceAssetsPickerDialog
        open={isAssetPickerOpen}
        selectedPaths={manualFiles.map((file) => file.workspacePath)}
        onClose={() => setIsAssetPickerOpen(false)}
        onConfirm={onAddManualFiles}
        onNotify={onNotify}
      />
    </>
  );
};
