import React from 'react';
import {
  ArrowRight,
  Database,
  Eye,
  FunctionSquare,
  Link2,
  Table2,
  TableProperties,
  Workflow,
} from 'lucide-react';
import type {
  SchemaObjectDependencyItem,
  SchemaObjectDependencyKind,
} from '../../../shared/api/contracts/data-sources/schemaObjectDependencies';
import { useSchemaObjectDependenciesQuery } from '../../../shared/api/queries/data-sources';
import { cn } from '../../../lib/utils';
import { FormSection } from '../../../shared/ui';
import { MODELER_CAPTION_CLASS } from '../lib/modelerChipStyles';
import {
  DATA_STUDIO_EXPLORER_OBJECT_KIND_SINGULAR_LABELS,
  resolveDataStudioExplorerObjectKindFromDependencyKind,
  resolveExplorerSchemaQuery,
} from '../lib/explorerObjectKinds';
import type { DataStudioExplorerObjectKind } from '../types';

export type SchemaObjectDependenciesSectionProps = {
  dataSourceId: string;
  objectName: string;
  objectKind: DataStudioExplorerObjectKind;
  onOpenObject: (item: SchemaObjectDependencyItem) => void;
  resolveObjectHref: (item: SchemaObjectDependencyItem) => string;
  enabled?: boolean;
  chrome?: 'section' | 'none';
  layout?: 'stack' | 'columns';
};

const EMPTY_TEXT = 'No related objects detected.';

const DEPENDENCY_KIND_ICON: Record<
  SchemaObjectDependencyKind,
  React.ComponentType<{ className?: string }>
> = {
  TABLE: Table2,
  VIEW: Eye,
  STORED_PROCEDURE: Workflow,
  SCALAR_FUNCTION: FunctionSquare,
  TABLE_VALUED_FUNCTION: TableProperties,
  UNKNOWN: Database,
};

/** Identity / technical / relation hues on icons and labels only — no object fills. */
const DEPENDENCY_KIND_COLOR: Record<SchemaObjectDependencyKind, string> = {
  TABLE: 'text-indigo-600',
  VIEW: 'text-cyan-600',
  STORED_PROCEDURE: 'text-violet-600',
  SCALAR_FUNCTION: 'text-emerald-600',
  TABLE_VALUED_FUNCTION: 'text-teal-600',
  UNKNOWN: 'text-slate-500',
};

const COLUMN_TONE = {
  depends: {
    title: 'text-indigo-700',
    badge: 'bg-indigo-100 text-indigo-700',
    accent: 'bg-indigo-500',
  },
  usedBy: {
    title: 'text-emerald-700',
    badge: 'bg-emerald-100 text-emerald-700',
    accent: 'bg-emerald-500',
  },
} as const;

type ColumnToneKey = keyof typeof COLUMN_TONE;

const dependencyKindLabel = (item: SchemaObjectDependencyItem): string => {
  const explorerKind = resolveDataStudioExplorerObjectKindFromDependencyKind(item.objectKind);
  return explorerKind ? DATA_STUDIO_EXPLORER_OBJECT_KIND_SINGULAR_LABELS[explorerKind] : 'Object';
};

const detailsToneClass = (details?: string | null): string => {
  const value = details?.trim().toLowerCase() ?? '';
  if (!value) {
    return '';
  }
  if (value.includes('foreign key')) {
    return 'text-amber-700';
  }
  if (value.includes('referenced')) {
    return 'text-cyan-700';
  }
  return 'text-slate-500';
};

const DependencyItemLink: React.FC<{
  item: SchemaObjectDependencyItem;
  onOpenObject: (item: SchemaObjectDependencyItem) => void;
  resolveObjectHref: (item: SchemaObjectDependencyItem) => string;
}> = ({ item, onOpenObject, resolveObjectHref }) => {
  const KindIcon = DEPENDENCY_KIND_ICON[item.objectKind];
  const kindColor = DEPENDENCY_KIND_COLOR[item.objectKind];
  const details = item.details?.trim() ?? '';

  return (
    <a
      href={resolveObjectHref(item)}
      className={cn(
        'group flex min-w-0 items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2',
        'transition hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
      )}
      onClick={(event) => {
        if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
          return;
        }
        event.preventDefault();
        onOpenObject(item);
      }}
    >
      <span className="flex min-w-0 flex-1 items-start gap-2">
        <KindIcon className={cn('mt-0.5 h-3.5 w-3.5 shrink-0', kindColor)} />
        <span className="min-w-0 flex-1">
          <span className={cn('block truncate font-mono text-xs font-semibold', kindColor)}>
            {item.objectName}
          </span>
          <span className={cn(MODELER_CAPTION_CLASS, 'mt-0.5 block truncate')}>
            <span className={kindColor}>{dependencyKindLabel(item)}</span>
            {details ? (
              <>
                {' · '}
                <span className={detailsToneClass(details)}>{details}</span>
              </>
            ) : null}
          </span>
        </span>
      </span>
      <ArrowRight className={cn('h-3.5 w-3.5 shrink-0 transition group-hover:opacity-80', kindColor)} />
    </a>
  );
};

const DependencyList: React.FC<{
  title: string;
  tone: ColumnToneKey;
  items: SchemaObjectDependencyItem[];
  onOpenObject: (item: SchemaObjectDependencyItem) => void;
  resolveObjectHref: (item: SchemaObjectDependencyItem) => string;
}> = ({ title, tone, items, onOpenObject, resolveObjectHref }) => {
  if (items.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-2">
      <p className={cn('ps-[4px] text-xs font-bold uppercase tracking-wider', COLUMN_TONE[tone].title)}>
        {title}
      </p>
      <div className="flex flex-col gap-1.5">
        {items.map((item) => (
          <DependencyItemLink
            key={`${item.objectKind}:${item.objectName}`}
            item={item}
            onOpenObject={onOpenObject}
            resolveObjectHref={resolveObjectHref}
          />
        ))}
      </div>
    </div>
  );
};

const DependencyColumn: React.FC<{
  title: string;
  tone: ColumnToneKey;
  items: SchemaObjectDependencyItem[];
  isLoading: boolean;
  divided?: boolean;
  onOpenObject: (item: SchemaObjectDependencyItem) => void;
  resolveObjectHref: (item: SchemaObjectDependencyItem) => string;
}> = ({ title, tone, items, isLoading, divided = false, onOpenObject, resolveObjectHref }) => {
  const colors = COLUMN_TONE[tone];

  return (
    <section
      className={cn(
        'flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-white',
        divided && 'border-b border-slate-200 md:border-b-0 md:border-s',
      )}
    >
      <div className="relative flex shrink-0 items-center justify-between gap-2 border-b border-slate-200 px-3 py-2">
        <span className={cn('pointer-events-none absolute inset-y-0 start-0 w-0.5', colors.accent)} aria-hidden />
        <p className={cn('text-xs font-bold uppercase tracking-wider', colors.title)}>
          {title}
        </p>
        <span className={cn(
          'inline-flex min-w-[1.125rem] items-center justify-center rounded-full px-1.5 py-px text-[11px] font-bold leading-none',
          colors.badge,
        )}>
          {isLoading ? '…' : items.length}
        </span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {isLoading ? (
          <p className={MODELER_CAPTION_CLASS}>Loading related objects…</p>
        ) : items.length > 0 ? (
          <div className="flex flex-col gap-1.5">
            {items.map((item) => (
              <DependencyItemLink
                key={`${item.objectKind}:${item.objectName}`}
                item={item}
                onOpenObject={onOpenObject}
                resolveObjectHref={resolveObjectHref}
              />
            ))}
          </div>
        ) : (
          <div className={cn(
            'flex items-center gap-2 rounded-lg border border-dashed border-slate-200 px-3 py-2',
            MODELER_CAPTION_CLASS,
          )}>
            <Database className="h-3.5 w-3.5 text-slate-400" />
            {EMPTY_TEXT}
          </div>
        )}
      </div>
    </section>
  );
};

export const SchemaObjectDependenciesSection: React.FC<SchemaObjectDependenciesSectionProps> = ({
  dataSourceId,
  objectName,
  objectKind,
  onOpenObject,
  resolveObjectHref,
  enabled = true,
  chrome = 'section',
  layout = 'stack',
}) => {
  const schemaQuery = resolveExplorerSchemaQuery(objectKind);
  const dependenciesQuery = useSchemaObjectDependenciesQuery(
    dataSourceId,
    schemaQuery.objectType,
    objectName,
    schemaQuery.functionKind,
    enabled && Boolean(dataSourceId && objectName),
  );

  const error = dependenciesQuery.error instanceof Error
    ? dependenciesQuery.error.message
    : null;
  const dependencies = dependenciesQuery.data?.dependencies ?? [];
  const dependents = dependenciesQuery.data?.dependents ?? [];
  const isColumns = layout === 'columns';
  const isLoading = dependenciesQuery.isLoading;

  const body = (
    <div className={cn(
      'flex min-h-0 flex-col',
      isColumns ? 'h-full flex-1' : 'gap-3',
    )}>
      {!isLoading && error ? (
        <div className={cn(
          'shrink-0 border-b border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-medium text-amber-900',
          !isColumns && 'rounded-lg border',
        )}>
          Could not load related objects.
          {' '}
          {error}
        </div>
      ) : null}

      {isColumns ? (
        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          <DependencyColumn
            title="Depends on"
            tone="depends"
            items={dependencies}
            isLoading={isLoading}
            onOpenObject={onOpenObject}
            resolveObjectHref={resolveObjectHref}
          />
          <DependencyColumn
            title="Used by"
            tone="usedBy"
            items={dependents}
            isLoading={isLoading}
            divided
            onOpenObject={onOpenObject}
            resolveObjectHref={resolveObjectHref}
          />
        </div>
      ) : null}

      {!isLoading && !error && !isColumns ? (
        <>
          <DependencyList
            title="Depends on"
            tone="depends"
            items={dependencies}
            onOpenObject={onOpenObject}
            resolveObjectHref={resolveObjectHref}
          />
          <DependencyList
            title="Used by"
            tone="usedBy"
            items={dependents}
            onOpenObject={onOpenObject}
            resolveObjectHref={resolveObjectHref}
          />
        </>
      ) : null}

      {!isLoading && !error && !isColumns
        && dependencies.length === 0
        && dependents.length === 0 ? (
          <div className={cn(
            'flex items-center gap-2 rounded-lg border border-dashed border-slate-200 px-3 py-2',
            MODELER_CAPTION_CLASS,
          )}>
            <Database className="h-3.5 w-3.5 text-slate-400" />
            {EMPTY_TEXT}
          </div>
        ) : null}
    </div>
  );

  if (chrome === 'none') {
    return body;
  }

  return (
    <FormSection
      title="Dependencies"
      ink="contrast"
      headerExtra={<Link2 className="h-3.5 w-3.5 text-slate-400" />}
    >
      {body}
    </FormSection>
  );
};
