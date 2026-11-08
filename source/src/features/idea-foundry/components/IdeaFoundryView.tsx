import React, { useEffect, useRef, useState } from 'react';
import { Pencil, SlidersHorizontal } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { NavigationIcon } from '../../../shared/lib/navigationIcons/NavigationIcon';
import { PAGE_GUIDE_EN } from '../../../core/culture/translations/pageGuideEn';
import type { ProductIdeaRecord } from '../../../shared/api/contracts/idea-foundry/types';
import {
  AppButton,
  FormSection,
  MarkdownEditDialog,
  MarkdownPreview,
  PAGE_HEADER_ICON_SLOT_CLASS,
  PAGE_HEADER_ICON_TITLE_CLUSTER_CLASS,
  PAGE_TOOLBAR_ACTIONS_CLUSTER_CLASS,
  FORM_SECTION_DIVIDED_CLASS,
  UiInputCore,
  WorkspaceBackIcon,
  WorkspaceVerticalSplitHandle,
  WORKSPACE_SPLIT_PANEL_KEYS,
  useInspectorRailSplit,
} from '../../../shared/ui';
import { pageGuideLocalProps } from '../../../shared/ui/shell/pageGuide/pageGuideChrome';
import {
  IDEA_MATURITY_LABEL,
  resolveIdeaCardChrome,
  resolveIdeaIconRef,
} from '../ideaFoundryCatalog';
import { IdeaFoundryViewRail } from './IdeaFoundryViewRail';

export type IdeaMarkdownField = 'description' | 'frontOffice' | 'backOffice';

type IdeaFoundryViewProps = {
  idea: ProductIdeaRecord;
  onBack: () => void;
  onReconfigure: () => void;
  onSaveTitle: (value: string) => void;
  onSaveMarkdown: (field: IdeaMarkdownField, value: string) => void;
};

const EDITABLE_MARKDOWN_CLASS = cn(
  'w-full min-w-0 cursor-pointer rounded-md px-1 py-1 text-start',
  'transition-colors hover:bg-slate-50/80',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300',
);

const EMPTY_MARKDOWN_CLASS = cn(
  'flex w-full min-w-0 flex-col items-start gap-1 rounded-md',
  'border border-dashed border-slate-200 bg-white px-2.5 py-3 text-start',
  'transition-colors hover:border-slate-300 hover:bg-slate-50/80',
);

const MARKDOWN_FIELDS: Record<IdeaMarkdownField, {
  dialogTitle: string;
  placeholder: string;
  emptyLabel: string;
}> = {
  description: {
    dialogTitle: 'Edit spark',
    placeholder: 'Warehouse clerks lose half an hour each night reconciling pick lists by hand.',
    emptyLabel: 'Add the pitch in Markdown.',
  },
  frontOffice: {
    dialogTitle: 'Edit front office',
    placeholder: 'Catalog search, product page, and checkout.\n- Guest finds a SKU by barcode\n- Pays and gets an order number',
    emptyLabel: 'Add front-office Markdown.',
  },
  backOffice: {
    dialogTitle: 'Edit back office',
    placeholder: 'Pick-list desk and exception queue.\n- Clerk confirms the pick\n- Supervisor clears a short-pick',
    emptyLabel: 'Add back-office Markdown.',
  },
};

const IdeaHeaderTitle: React.FC<{
  title: string;
  onSave: (value: string) => void;
}> = ({ title, onSave }) => {
  const [draft, setDraft] = useState<string | null>(null);
  const editingRef = useRef(false);

  useEffect(() => {
    editingRef.current = false;
    setDraft(null);
  }, [title]);

  const startEdit = () => {
    editingRef.current = true;
    setDraft(title);
  };

  const finish = (raw: string, save: boolean) => {
    if (!editingRef.current) return;
    editingRef.current = false;
    setDraft(null);
    if (!save) return;
    const trimmed = raw.trim();
    if (!trimmed || trimmed === title) return;
    onSave(trimmed);
  };

  if (draft !== null) {
    return (
      <UiInputCore
        size="sm"
        value={draft}
        ariaLabel="Idea title"
        autoDir
        autoFocus
        maxLength={255}
        className="min-w-0 max-w-full flex-1"
        placeholder="Night-shift dispatch board"
        onChange={(event) => setDraft(event.target.value)}
        onFocus={(event) => {
          const node = event.target as HTMLInputElement;
          if (typeof node.select === 'function') node.select();
        }}
        onBlur={() => finish(draft, true)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            finish(draft, true);
          }
          if (event.key === 'Escape') {
            event.preventDefault();
            finish(draft, false);
          }
        }}
      />
    );
  }

  return (
    <button
      type="button"
      data-testid="idea-foundry-view-title"
      className={cn(
        'm-0 min-w-0 max-w-full flex-1 truncate rounded-sm bg-transparent text-start',
        'cursor-text text-lg font-bold tracking-tight leading-none text-slate-800',
        'hover:bg-slate-50/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300',
      )}
      title={`${title} — double-click to edit`}
      aria-label={title}
      onDoubleClick={startEdit}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === 'F2') {
          event.preventDefault();
          startEdit();
        }
      }}
    >
      {title}
    </button>
  );
};

const HOVER_EDIT_BUTTON_CLASS =
  'opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 focus-within:opacity-100';

const EditMarkdownButton: React.FC<{
  label: string;
  onClick: () => void;
}> = ({ label, onClick }) => (
  <span className={HOVER_EDIT_BUTTON_CLASS}>
    <AppButton
      intent="secondary"
      size="icon-sm"
      aria-label={label}
      title={label}
      onClick={onClick}
    >
      <Pencil className="h-3.5 w-3.5" />
    </AppButton>
  </span>
);

const ClickableMarkdown: React.FC<{
  field: IdeaMarkdownField;
  content: string;
  onEdit: () => void;
  className?: string;
}> = ({ field, content, onEdit, className }) => {
  const copy = MARKDOWN_FIELDS[field];
  const open = (event: React.MouseEvent | React.KeyboardEvent) => {
    if ('target' in event && (event.target as HTMLElement).closest('a')) {
      return;
    }
    onEdit();
  };

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={copy.dialogTitle}
      className={cn(EDITABLE_MARKDOWN_CLASS, className)}
      onClick={open}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          open(event);
        }
      }}
    >
      <MarkdownPreview
        content={content}
        emptyFallback={(
          <span className={EMPTY_MARKDOWN_CLASS}>
            <span className="text-[11px] font-medium text-slate-600">{copy.emptyLabel}</span>
          </span>
        )}
      />
    </div>
  );
};

export const IdeaFoundryView: React.FC<IdeaFoundryViewProps> = ({
  idea,
  onBack,
  onReconfigure,
  onSaveTitle,
  onSaveMarkdown,
}) => {
  const chrome = resolveIdeaCardChrome(idea);
  const [editingField, setEditingField] = useState<IdeaMarkdownField | null>(null);
  const editingCopy = editingField ? MARKDOWN_FIELDS[editingField] : null;
  const { containerRef, split } = useInspectorRailSplit(WORKSPACE_SPLIT_PANEL_KEYS.ideaFoundryInspector);

  return (
    <div className="flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden bg-white" data-testid="idea-foundry-view">
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white px-3 py-2.5 sm:px-5">
        <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
          <WorkspaceBackIcon
            ariaLabel="Back to Idea Foundry list"
            title="Back to list"
            onClick={onBack}
          />
          <div className={PAGE_HEADER_ICON_TITLE_CLUSTER_CLASS}>
            <span className={PAGE_HEADER_ICON_SLOT_CLASS} aria-hidden>
              <NavigationIcon
                iconRef={resolveIdeaIconRef(idea.icon)}
                className={chrome.titleClass}
              />
            </span>
            <IdeaHeaderTitle
              title={idea.title}
              onSave={onSaveTitle}
            />
            <span className={cn('shrink-0', chrome.maturityChipClass)} aria-label="Stage">
              {IDEA_MATURITY_LABEL[idea.maturity] ?? idea.maturity}
            </span>
          </div>
        </div>
        <div className={PAGE_TOOLBAR_ACTIONS_CLUSTER_CLASS}>
          <AppButton
            intent="secondary"
            size="sm"
            onClick={onReconfigure}
            {...pageGuideLocalProps(
              'Reconfigure',
              PAGE_GUIDE_EN['pageGuide.page.ideaFoundry.reconfigure.hint'],
            )}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Reconfigure
          </AppButton>
        </div>
      </div>

      <div
        ref={containerRef}
        className={cn('flex min-h-0 flex-1 overflow-hidden bg-white', split.isResizing && 'select-none')}
      >
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-white">
          <div className="min-h-0 flex-1 overflow-auto px-5 py-4" data-testid="idea-foundry-view-body">
            <FormSection
              title="Spark"
              ink="accent"
              hint="The pitch that landed on the board. Click the text to edit."
              className="group"
              headerExtra={(
                <EditMarkdownButton label="Edit spark" onClick={() => setEditingField('description')} />
              )}
            >
              <ClickableMarkdown
                field="description"
                content={idea.description}
                onEdit={() => setEditingField('description')}
              />
            </FormSection>
            <div className={cn('grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-2', FORM_SECTION_DIVIDED_CLASS)}>
              <div className="group min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="ps-[4px] text-xs font-semibold uppercase tracking-wider text-slate-600">
                    Front office
                  </p>
                  <EditMarkdownButton
                    label="Edit front office"
                    onClick={() => setEditingField('frontOffice')}
                  />
                </div>
                <ClickableMarkdown
                  field="frontOffice"
                  content={idea.frontOffice}
                  onEdit={() => setEditingField('frontOffice')}
                  className="mt-1"
                />
              </div>
              <div className="group min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="ps-[4px] text-xs font-semibold uppercase tracking-wider text-slate-600">
                    Back office
                  </p>
                  <EditMarkdownButton
                    label="Edit back office"
                    onClick={() => setEditingField('backOffice')}
                  />
                </div>
                <ClickableMarkdown
                  field="backOffice"
                  content={idea.backOffice}
                  onEdit={() => setEditingField('backOffice')}
                  className="mt-1"
                />
              </div>
            </div>
          </div>
        </div>

        <WorkspaceVerticalSplitHandle {...split.splitHandleProps} appearance="ghost" />
        <IdeaFoundryViewRail idea={idea} widthPx={split.size} />
      </div>

      <MarkdownEditDialog
        open={Boolean(editingField)}
        title={editingCopy?.dialogTitle ?? 'Edit Markdown'}
        initialValue={editingField ? idea[editingField] : ''}
        placeholder={editingCopy?.placeholder}
        onClose={() => setEditingField(null)}
        onSave={(value) => {
          if (!editingField) return;
          onSaveMarkdown(editingField, value);
        }}
      />
    </div>
  );
};
