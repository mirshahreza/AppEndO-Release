/** PDK-9 — static, registry-only usage graph for a Designer component. No hit-tracking (see p-94). */
export type DesignerComponentUsagePageEntry = {
  pageKey: string;
  title: string;
  loaderKind: 'core' | 'designer' | 'package';
  ownerPackageId: string | null;
  mounts: string[];
  /** `ownerPackageId` set but `loaderKind` is still `"core"` — a registry inconsistency, warn only, never auto-migrated. */
  loaderKindInvariantWarning: boolean;
};

export type DesignerComponentUsageReport = {
  pages: DesignerComponentUsagePageEntry[];
  /**
   * No workflow → component registry link exists in this codebase (a workflow can trigger via a
   * component's own Dynamic Action config, but nothing on the workflow side records the reverse
   * reference) — always empty until such a registry exists. Kept as a field, not omitted, so the
   * UI has a stable shape to render an explicit "not tracked" state instead of guessing.
   */
  workflows: never[];
};
