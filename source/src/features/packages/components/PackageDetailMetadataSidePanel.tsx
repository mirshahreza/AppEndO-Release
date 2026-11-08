import React from 'react';
import { cn } from '../../../lib/utils';
import { resolvePackageCreatedByDisplay } from '../../../core/packages/packageCreatedByDisplay';
import { formatDisplayDateYmd } from '../../../shared/lib/gridDateFormat';
import { parsePackageDescriptionBlocks } from '../../../shared/lib/packageDescription';
import type { PackageDetail } from '../types';
import {
  DirectionalText,
  FieldHintTooltip,
  ICON_LABEL_ROW_CLASS,
  INSPECTOR_RAIL_ASIDE_CLASS,
  INSPECTOR_RAIL_CARD_CLASS,
  INSPECTOR_RAIL_INNER_CLASS,
  INSPECTOR_RAIL_KV_CLASS,
  INSPECTOR_RAIL_LABEL_CLASS,
  INSPECTOR_RAIL_TITLE_CLASS,
  INSPECTOR_RAIL_VALUE_CLASS,
} from '../../../shared/ui';

export type PackageDetailMetadataSidePanelProps = {
  detailData: PackageDetail;
  widthPx?: number;
};

const RAIL_BADGE_CLASS =
  'inline-flex max-w-full truncate rounded-md bg-slate-100 px-1.5 py-0.5 text-xs font-semibold text-slate-700';
const RAIL_CHIP_CLASS =
  'flex h-8 w-full min-w-0 items-center gap-1.5 rounded-md bg-slate-100 px-2 text-start text-xs font-semibold text-slate-700';
const EMPTY_VALUE = 'None selected';

const formatAuditDate = (iso: string): string => formatDisplayDateYmd(iso, '');

const formatAuditDetail = (username: string | null | undefined, iso: string | null | undefined): string | null => {
  const who = username?.trim() || '';
  const when = iso?.trim() ? formatAuditDate(iso) : '';
  if (!who && !when) return null;
  if (who && when) return `${who} • ${when}`;
  return who || when;
};

const RailSection: React.FC<{
  title?: string;
  hint?: string;
  testId?: string;
  children: React.ReactNode;
}> = ({ title, hint, testId, children }) => (
  <section
    className={INSPECTOR_RAIL_CARD_CLASS}
    data-testid={testId}
  >
    {title ? (
      <div className={cn(ICON_LABEL_ROW_CLASS, 'mb-3')}>
        <h2 className={INSPECTOR_RAIL_TITLE_CLASS}>{title}</h2>
        {hint ? <FieldHintTooltip hint={hint} label={title} /> : null}
      </div>
    ) : null}
    {children}
  </section>
);

const KvRow: React.FC<{
  label: string;
  value: React.ReactNode;
}> = ({ label, value }) => (
  <>
    <div className={INSPECTOR_RAIL_LABEL_CLASS}>{label}</div>
    <div className={INSPECTOR_RAIL_VALUE_CLASS}>
      {typeof value === 'string' ? <DirectionalText as="span" text={value} /> : value}
    </div>
  </>
);

const EmptyValue: React.FC = () => (
  <span className="text-xs text-slate-400">{EMPTY_VALUE}</span>
);

const installStatusLabel = (status: string): string => (
  status === 'installed' ? 'Installed' : 'Not installed'
);

export const PackageDetailMetadataSidePanel: React.FC<PackageDetailMetadataSidePanelProps> = ({
  detailData,
  widthPx,
}) => {
  const manifest = detailData.bundleManifest;
  const dependencies = manifest?.dependencies ?? [];
  const descriptionBlocks = parsePackageDescriptionBlocks(manifest?.description?.trim() ?? '');
  const createdDetail = formatAuditDetail(
    resolvePackageCreatedByDisplay(manifest?.createdBy ?? null, null),
    manifest?.createdAt ?? null,
  );

  return (
    <aside
      className={cn(INSPECTOR_RAIL_ASIDE_CLASS, 'min-h-0')}
      style={widthPx ? { width: `${widthPx}px` } : undefined}
      data-testid="package-detail-inspector-rail"
    >
      <div className={INSPECTOR_RAIL_INNER_CLASS}>
        <RailSection
          title="Metadata"
          hint="Version on this node, install state, and the app version this bundle expects."
        >
          <div className={INSPECTOR_RAIL_KV_CLASS}>
            <KvRow
              label="Version"
              value={<span className={RAIL_BADGE_CLASS}>{detailData.version}</span>}
            />
            <KvRow
              label="Install status"
              value={<span className={RAIL_BADGE_CLASS}>{installStatusLabel(detailData.installStatus)}</span>}
            />
            <KvRow
              label="Active on node"
              value={detailData.activeInstalledVersion
                ? <span className={RAIL_BADGE_CLASS}>v{detailData.activeInstalledVersion}</span>
                : <EmptyValue />}
            />
            <KvRow
              label="Required app"
              value={manifest?.requiredAppVersion
                ? <span className={RAIL_BADGE_CLASS}>{manifest.requiredAppVersion}</span>
                : <EmptyValue />}
            />
          </div>
        </RailSection>

        {manifest ? (
          <>
            <RailSection
              title="Dependencies"
              hint="Other packages this bundle declares it needs."
            >
              {dependencies.length > 0 ? (
                <div className="flex w-full flex-col items-stretch gap-1.5">
                  {dependencies.map((dep) => (
                    <span key={`${dep.packageId}:${dep.versionRange}`} className={RAIL_CHIP_CLASS}>
                      <span className="min-w-0 truncate">{dep.packageId}</span>
                      <span className="shrink-0 text-slate-500">{dep.versionRange}</span>
                    </span>
                  ))}
                </div>
              ) : (
                <EmptyValue />
              )}
            </RailSection>

            <RailSection
              title="Description"
              hint="What this package is for, from the bundle manifest."
            >
              {descriptionBlocks.length > 0 ? (
                <div className="flex flex-col gap-3">
                  {descriptionBlocks.map((block, index) => (
                    <div key={`${block.version ?? 'base'}-${index}`} className="flex flex-col gap-1.5">
                      {block.version ? (
                        <span className={cn(RAIL_BADGE_CLASS, 'self-start')}>v{block.version}</span>
                      ) : null}
                      <DirectionalText
                        as="p"
                        className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700"
                        text={block.text}
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyValue />
              )}
            </RailSection>
          </>
        ) : (
          <p className="text-sm text-amber-700">
            Bundle manifest for the selected version is not available.
          </p>
        )}

        {createdDetail ? (
          <RailSection testId="package-detail-inspector-audit">
            <div className={INSPECTOR_RAIL_KV_CLASS}>
              <KvRow
                label="Created"
                value={<span className="text-xs text-slate-500">{createdDetail}</span>}
              />
            </div>
          </RailSection>
        ) : null}
      </div>
    </aside>
  );
};
