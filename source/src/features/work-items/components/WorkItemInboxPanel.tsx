import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CircleCheck } from 'lucide-react';
import {
  AppButton,
  QueryErrorPanel,
  ToolbarActionGroupWithRefresh,
  ToolbarRefreshButton,
  UiSelect,
  UiTextarea,
  UiInput,
  UiCheckbox,
  WorkspaceBackIcon,
  PAGE_TOOLBAR_ACTIONS_CLUSTER_CLASS,
  PAGE_TOOLBAR_FILTERS_CLUSTER_CLASS,
  PAGE_TOOLBAR_SINGLE_ROW_CLASS,
} from '../../../shared/ui';
import { ListPageToolbarScrollHost } from '../../../shared/ui/list-page/listPageToolbarChrome';
import { useListPageToolbarScroll } from '../../../shared/lib/useListPageToolbarScroll';
import { cn } from '../../../lib/utils';
import { formatDisplayDateYmd } from '../../../shared/lib/gridDateFormat';
import { workItemsApi, WorkItemsApiError } from '../api/workItemsApi';
import type { WorkItemInboxBucket, WorkItemRecord, WorkItemSummary, WorkItemTransition, WorkItemFormConfig, WorkItemComment, WorkItemAttachmentMeta } from '../types';
import { DynamicWorkItemForm } from './DynamicWorkItemForm';
import { WorkItemPayloadReadView } from './WorkItemPayloadReadView';
import {
  hasRenderableObjectSchema,
  resolveRawOutputSchema,
  workItemPayloadHasDisplayableFields,
} from '../lib/workItemSchemaUtils';
import { OutOfOfficePanel } from './OutOfOfficePanel';
import { NotificationPreferencesPanel } from './NotificationPreferencesPanel';
import { savedFiltersApi, type WorkItemSavedFilter } from '../api/savedFiltersApi';
import { useAuth } from '../../../contexts/AuthContext';
import { useCultureT } from '../../../core/culture/CultureContext';
import { resolveCultureLabel } from '../../../core/culture/cultureShellKeys';
import { DesignerDocumentPreview } from '../../../domain/component-designer/designerRuntimePreview';
import { createDefaultBindingDefinitions } from '../../../domain/component-designer/bindingRegistry';
import { loadComponentDesignerDraft, type DesignerVersionRecord } from '../../../shared/api/queries/component-designer';
import { buildWorkItemInboxBucketGroups, type WorkItemInboxTab } from '../lib/workItemInboxCulture';
import {
  notifyPersonalInboxChangedWithFallback,
  personalInboxApi,
} from '../../../shared/api/personalInboxApi';
import type { PersonalInboxItem } from '../../../shared/api/contracts/personal-inbox/types';
import { inboxSupportsCorrespondenceAction } from '../../../shared/personal-inbox/inboxCorrespondencePolicy';
import { PersonalInboxCorrespondenceDialog } from '../../../shared/personal-inbox/PersonalInboxCorrespondenceDialog';
import { PersonalInboxForwardIcon } from '../../../shared/personal-inbox/personalInboxCorrespondenceIcons';
import {
  PERSONAL_INBOX_MESSAGE_DETAIL_PAGE_CLASS,
  PERSONAL_INBOX_MESSAGE_DETAIL_TOOLBAR_CLASS,
} from '../../../shared/personal-inbox/personalInboxMessageDetailLayout';
import type { PersonalInboxEnvelopeMessage } from '../../../shared/api/contracts/personal-inbox/envelopeTypes';
import { PersonalInboxEnvelopeMessageBlock } from '../../../shared/personal-inbox/PersonalInboxEnvelopeMessageBlock';

const EMPTY_DESIGNER_BINDING_DEFINITIONS = createDefaultBindingDefinitions();

type InboxTab = WorkItemInboxTab;

const sortInboxItems = (items: WorkItemSummary[]): WorkItemSummary[] => (
  [...items].sort((left, right) => {
    if (right.priority !== left.priority) return right.priority - left.priority;
    const leftCreated = left.createdAt ? Date.parse(left.createdAt) : 0;
    const rightCreated = right.createdAt ? Date.parse(right.createdAt) : 0;
    if (leftCreated !== rightCreated) return leftCreated - rightCreated;
    return left.id - right.id;
  })
);

const mergeInboxItems = (groups: WorkItemSummary[][]): WorkItemSummary[] => {
  const byId = new Map<number, WorkItemSummary>();
  for (const group of groups) {
    for (const item of group) byId.set(item.id, item);
  }
  return sortInboxItems([...byId.values()]);
};

type InboxRow = { kind: 'single'; item: WorkItemSummary } | { kind: 'group'; key: string; items: WorkItemSummary[] };

/** HWF-3.1 — WORK_ITEM nodes sharing a literal `approvalGroupKey` (macro-expanded from a PARALLEL_SPLIT) render as one visual multi-approver group instead of N unrelated rows, while each member stays independently claimable/completable. Pure display grouping — no engine concept of a "group" exists. */
const groupItemsForDisplay = (items: WorkItemSummary[]): InboxRow[] => {
  const rows: InboxRow[] = [];
  const groupRowIndex = new Map<string, number>();
  for (const item of items) {
    const key = item.approvalGroupKey;
    if (!key) {
      rows.push({ kind: 'single', item });
      continue;
    }
    const existingIndex = groupRowIndex.get(key);
    if (existingIndex === undefined) {
      groupRowIndex.set(key, rows.length);
      rows.push({ kind: 'group', key, items: [item] });
    } else {
      const row = rows[existingIndex];
      if (row.kind === 'group') row.items.push(item);
    }
  }
  return rows;
};

const priorityLabel = (priority: number): string => (priority >= 2 ? 'High' : priority === 1 ? 'Medium' : 'Normal');

const WORK_ITEM_TYPES = ['APPROVAL', 'REVIEW', 'DATA_ENTRY', 'DECISION', 'CONFIRMATION', 'EXCEPTION', 'AI_REVIEW'] as const;

type PriorityFilter = 'ALL' | 'NORMAL' | 'MEDIUM' | 'HIGH';

const priorityFilterToRange = (filter: PriorityFilter): { priorityMin?: number; priorityMax?: number } => {
  switch (filter) {
    case 'NORMAL': return { priorityMax: 0 };
    case 'MEDIUM': return { priorityMin: 1, priorityMax: 1 };
    case 'HIGH': return { priorityMin: 2 };
    default: return {};
  }
};

const formatDate = (value: string | null): string => formatDisplayDateYmd(value, '—');

const workItemStatusToneClass = (status: string): string => {
  switch (status) {
    case 'OPEN':
      return 'border-sky-200 bg-sky-50 text-sky-800';
    case 'CLAIMED':
      return 'border-emerald-200 bg-emerald-50 text-emerald-800';
    case 'COMPLETED':
      return 'border-slate-200 bg-slate-100 text-slate-700';
    default:
      return 'border-slate-200 bg-slate-50 text-slate-700';
  }
};

const InboxItemRow: React.FC<{
  item: WorkItemSummary;
  selected: boolean;
  selectedIds: Set<number>;
  toggleSelected: (id: number) => void;
  openItem: (item: WorkItemSummary) => Promise<void>;
}> = ({ item, selected, selectedIds, toggleSelected, openItem }) => (
  <li className={`flex items-stretch border-b border-slate-100 ${selected ? 'bg-slate-50' : ''}`}>
    {item.status === 'OPEN' ? (
      <label className="flex items-center px-2" onClick={(e) => e.stopPropagation()}>
        <UiCheckbox size="sm" ariaLabel={`Select ${item.titleText}`} checked={selectedIds.has(item.id)} onChange={() => toggleSelected(item.id)} />
      </label>
    ) : (
      <span className="w-7 shrink-0" />
    )}
    <button
      type="button"
      onClick={() => void openItem(item)}
      className="flex min-w-0 flex-1 flex-col gap-0.5 py-2.5 pe-3 text-start hover:bg-slate-50"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-sm font-medium text-slate-900">{item.titleText}</span>
        {item.priority > 0 ? <span className="shrink-0 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">{priorityLabel(item.priority)}</span> : null}
      </div>
      {item.summaryText ? <span className="truncate text-xs text-slate-500">{item.summaryText}</span> : null}
      <span className="text-[10px] text-slate-400">
        {item.workItemType} · {formatDate(item.createdAt)}
        {item.dueAt ? (
          <span className={new Date(item.dueAt).getTime() < Date.now() ? 'font-semibold text-rose-600' : ''}> · due {formatDate(item.dueAt)}</span>
        ) : null}
      </span>
    </button>
  </li>
);

type WorkItemInboxPanelProps = {
  initialWorkItemId?: number;
  onBackToInbox?: () => void;
};

export const WorkItemInboxPanel: React.FC<WorkItemInboxPanelProps> = ({ initialWorkItemId, onBackToInbox }) => {
  const t = useCultureT();
  const personalInboxFocus = Boolean(onBackToInbox);
  const bucketGroups = buildWorkItemInboxBucketGroups(t);
  const backToInboxLabel = resolveCultureLabel(t, 'shell.inbox.backToInbox', 'Back to inbox');
  const inboxWorkItemLabel = (key: string, fallback: string) => resolveCultureLabel(t, key, fallback);
  const workItemStatusLabel = (status: string) => inboxWorkItemLabel(`shell.inbox.workItem.status.${status}`, status);
  const outOfOfficeLabel = resolveCultureLabel(t, 'shell.inbox.workItem.outOfOffice', 'Out-of-Office');
  const notificationsLabel = resolveCultureLabel(t, 'shell.inbox.workItem.notifications', 'Notifications');
  const { listToolbarCollapsed, handleGridScroll } = useListPageToolbarScroll();
  const [bucket, setBucket] = useState<InboxTab>('OPEN_TASKS');
  const [items, setItems] = useState<WorkItemSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('ALL');
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [showOutOfOffice, setShowOutOfOffice] = useState(false);
  const [showNotificationPreferences, setShowNotificationPreferences] = useState(false);
  const [savedFilters, setSavedFilters] = useState<WorkItemSavedFilter[]>([]);
  const [savingFilterName, setSavingFilterName] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkError, setBulkError] = useState<string | null>(null);

  const [selected, setSelected] = useState<WorkItemRecord | null>(null);
  const [formConfig, setFormConfig] = useState<WorkItemFormConfig | null>(null);
  const [outcome, setOutcome] = useState('');
  const [outputJson, setOutputJson] = useState('{}');
  const [dynamicOutputValue, setDynamicOutputValue] = useState<unknown>({});
  const [detailError, setDetailError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [transitions, setTransitions] = useState<WorkItemTransition[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [inboxForwardOpen, setInboxForwardOpen] = useState(false);
  const [inboxEnvelopeMessages, setInboxEnvelopeMessages] = useState<PersonalInboxEnvelopeMessage[]>([]);
  const [inboxEnvelopeLoading, setInboxEnvelopeLoading] = useState(false);
  const [comments, setComments] = useState<WorkItemComment[]>([]);
  const [isLoadingComments, setIsLoadingComments] = useState(false);
  const [newCommentText, setNewCommentText] = useState('');
  const [newCommentMentions, setNewCommentMentions] = useState('');
  const [showAttachments, setShowAttachments] = useState(false);
  const [attachments, setAttachments] = useState<WorkItemAttachmentMeta[]>([]);
  const [isLoadingAttachments, setIsLoadingAttachments] = useState(false);
  const [attachmentBusy, setAttachmentBusy] = useState(false);
  const [designedDraft, setDesignedDraft] = useState<DesignerVersionRecord | null>(null);
  const [designedDraftError, setDesignedDraftError] = useState<string | null>(null);
  const [isLoadingDesignedDraft, setIsLoadingDesignedDraft] = useState(false);
  const [forwardOpen, setForwardOpen] = useState(false);
  const [forwardStrategy, setForwardStrategy] = useState<'USER' | 'ROLE'>('USER');
  const [forwardTarget, setForwardTarget] = useState('');
  const [reasonText, setReasonText] = useState('');
  const [showAdvancedOutputJson, setShowAdvancedOutputJson] = useState(false);
  const [adHocOpen, setAdHocOpen] = useState(false);
  const [adHocType, setAdHocType] = useState('EXCEPTION');
  const [adHocTitle, setAdHocTitle] = useState('');
  const [adHocAssignStrategy, setAdHocAssignStrategy] = useState<'USER' | 'ROLE'>('ROLE');
  const [adHocAssignTarget, setAdHocAssignTarget] = useState('');
  const [adHocOutcomes, setAdHocOutcomes] = useState('DONE');
  const [adHocBusy, setAdHocBusy] = useState(false);
  const [adHocError, setAdHocError] = useState<string | null>(null);
  const { currentUser } = useAuth();

  const load = useCallback(async (mode: 'initial' | 'refresh' = 'initial') => {
    if (mode === 'initial') setIsLoading(true);
    else setIsRefreshing(true);
    setError(null);
    const filters = { workItemType: typeFilter || undefined, overdueOnly: overdueOnly || undefined, ...priorityFilterToRange(priorityFilter) };
    try {
      if (bucket === 'OPEN_TASKS') {
        const [assigned, claimable, claimed] = await Promise.all([
          workItemsApi.listInbox('MINE_ASSIGNED', { filters }),
          workItemsApi.listInbox('AVAILABLE_TO_CLAIM', { filters }),
          workItemsApi.listInbox('MINE_CLAIMED', { filters }),
        ]);
        setItems(mergeInboxItems([assigned.items, claimable.items, claimed.items]));
      } else {
        const result = await workItemsApi.listInbox(bucket, { filters });
        setItems(result.items);
      }
    } catch (err) {
      setError(err instanceof WorkItemsApiError ? `${err.code}: ${err.message}` : 'Failed to load Work Item inbox.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [bucket, typeFilter, priorityFilter, overdueOnly]);

  useEffect(() => {
    if (personalInboxFocus) {
      setIsLoading(false);
      return;
    }
    void load('initial');
    setSelected(null);
    setSelectedIds(new Set());
  }, [load, personalInboxFocus]);

  useEffect(() => {
    savedFiltersApi.list().then((result) => setSavedFilters(result.filters)).catch(() => {});
  }, []);

  const applySavedFilter = (filter: WorkItemSavedFilter) => {
    try {
      const parsed = JSON.parse(filter.filterJson) as { typeFilter?: string; priorityFilter?: PriorityFilter; overdueOnly?: boolean };
      setTypeFilter(parsed.typeFilter ?? '');
      setPriorityFilter(parsed.priorityFilter ?? 'ALL');
      setOverdueOnly(Boolean(parsed.overdueOnly));
    } catch {
      // Corrupted saved filter — ignore rather than crash the panel.
    }
  };

  const saveCurrentFilter = async () => {
    if (!savingFilterName?.trim()) return;
    try {
      const result = await savedFiltersApi.create(savingFilterName.trim(), { typeFilter, priorityFilter, overdueOnly });
      setSavedFilters((prev) => [result.filter, ...prev]);
      setSavingFilterName(null);
    } catch {
      // Best-effort — the filter bar itself already reflects the current selection either way.
    }
  };

  const removeSavedFilter = async (id: number) => {
    setSavedFilters((prev) => prev.filter((f) => f.id !== id));
    savedFiltersApi.remove(id).catch(() => {});
  };

  const toggleSelected = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  /** HWF-4.3 — bulk claim: loops the existing single-item claim endpoint (no new backend surface needed); reports partial failure honestly instead of silently swallowing it. */
  const bulkClaim = async () => {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    setBulkBusy(true);
    setBulkError(null);
    const results = await Promise.allSettled(ids.map((id) => workItemsApi.claim(id)));
    const failed = results.filter((r) => r.status === 'rejected').length;
    if (failed > 0) {
      setBulkError(`${failed} of ${ids.length} claims failed (likely already claimed by someone else).`);
    }
    setSelectedIds(new Set());
    setBulkBusy(false);
    await load('refresh');
  };

  const openItem = async (item: WorkItemSummary) => {
    setDetailError(null);
    setShowHistory(false);
    setTransitions([]);
    setShowComments(false);
    setComments([]);
    setNewCommentText('');
    setNewCommentMentions('');
    setShowAttachments(false);
    setAttachments([]);
    setDesignedDraft(null);
    setDesignedDraftError(null);
    setForwardOpen(false);
    setForwardTarget('');
    setReasonText('');
    setShowAdvancedOutputJson(false);
    try {
      const result = await workItemsApi.get(item.id);
      setSelected(result.workItem);
      setFormConfig(result.formConfig);
      const outcomes = JSON.parse(result.workItem.allowedOutcomesJson) as string[];
      setOutcome(outcomes[0] ?? '');
      const initialOutput = result.workItem.outputJson ?? '{}';
      setOutputJson(initialOutput);
      try {
        setDynamicOutputValue(JSON.parse(initialOutput));
      } catch {
        setDynamicOutputValue({});
      }
    } catch (err) {
      setDetailError(err instanceof WorkItemsApiError ? `${err.code}: ${err.message}` : 'Failed to load Work Item.');
    }
  };

  useEffect(() => {
    if (!personalInboxFocus || !initialWorkItemId || initialWorkItemId <= 0) return;
    const itemKey = `work_item:${initialWorkItemId}`;
    void personalInboxApi.dismissAttention(itemKey).then(({ summary }) => {
      void notifyPersonalInboxChangedWithFallback(summary);
    }).catch(() => undefined);
  }, [initialWorkItemId, personalInboxFocus]);

  useEffect(() => {
    if (!initialWorkItemId || initialWorkItemId <= 0) return;
    let cancelled = false;
    void (async () => {
      try {
        const result = await workItemsApi.get(initialWorkItemId);
        if (cancelled) return;
        setSelected(result.workItem);
        setFormConfig(result.formConfig);
        setShowAdvancedOutputJson(false);
        const outcomes = JSON.parse(result.workItem.allowedOutcomesJson) as string[];
        setOutcome(outcomes[0] ?? '');
        const initialOutput = result.workItem.outputJson ?? '{}';
        setOutputJson(initialOutput);
        try {
          setDynamicOutputValue(JSON.parse(initialOutput));
        } catch {
          setDynamicOutputValue({});
        }
      } catch (err) {
        if (!cancelled) {
          setDetailError(err instanceof WorkItemsApiError ? `${err.code}: ${err.message}` : 'Failed to load Work Item.');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [initialWorkItemId]);

  useEffect(() => {
    if (!personalInboxFocus || !selected?.id) {
      setInboxEnvelopeMessages([]);
      return;
    }
    let cancelled = false;
    setInboxEnvelopeLoading(true);
    void personalInboxApi.getItemDetail(`work_item:${selected.id}`)
      .then((detail) => {
        if (!cancelled) {
          setInboxEnvelopeMessages(detail.messages);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setInboxEnvelopeMessages([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setInboxEnvelopeLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [personalInboxFocus, selected?.id]);

  /** HWF-1.6 — DESIGNED_COMPONENT mode: load the referenced Component Designer draft once the item + its formConfig are known. */
  useEffect(() => {
    if (!selected || formConfig?.formMode !== 'DESIGNED_COMPONENT' || !formConfig.formComponentRef) return;
    let cancelled = false;
    setIsLoadingDesignedDraft(true);
    setDesignedDraftError(null);
    loadComponentDesignerDraft(formConfig.formComponentRef)
      .then((draft) => { if (!cancelled) setDesignedDraft(draft); })
      .catch((err) => { if (!cancelled) setDesignedDraftError(err instanceof Error ? err.message : 'Failed to load designed form component.'); })
      .finally(() => { if (!cancelled) setIsLoadingDesignedDraft(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id, formConfig?.formMode, formConfig?.formComponentRef]);

  const toggleHistory = async () => {
    if (!selected) return;
    const next = !showHistory;
    setShowHistory(next);
    if (next && transitions.length === 0) {
      setIsLoadingHistory(true);
      try {
        const result = await workItemsApi.transitions(selected.id);
        setTransitions(result.transitions);
      } catch (err) {
        setDetailError(err instanceof WorkItemsApiError ? `${err.code}: ${err.message}` : 'Failed to load Work Item history.');
      } finally {
        setIsLoadingHistory(false);
      }
    }
  };

  const loadComments = async () => {
    if (!selected) return;
    setIsLoadingComments(true);
    try {
      const result = await workItemsApi.comments(selected.id);
      setComments(result.comments);
    } catch (err) {
      setDetailError(err instanceof WorkItemsApiError ? `${err.code}: ${err.message}` : 'Failed to load comments.');
    } finally {
      setIsLoadingComments(false);
    }
  };

  const toggleComments = async () => {
    if (!selected) return;
    const next = !showComments;
    setShowComments(next);
    if (next) await loadComments();
  };

  const postComment = async () => {
    if (!selected || !newCommentText.trim()) return;
    setBusy(true);
    setDetailError(null);
    try {
      const mentionedUserIds = newCommentMentions.split(',').map((s) => Number(s.trim())).filter((n) => Number.isInteger(n) && n > 0);
      await workItemsApi.addComment(selected.id, newCommentText.trim(), mentionedUserIds);
      setNewCommentText('');
      setNewCommentMentions('');
      await loadComments();
    } catch (err) {
      setDetailError(err instanceof WorkItemsApiError ? `${err.code}: ${err.message}` : 'Failed to post comment.');
    } finally {
      setBusy(false);
    }
  };

  const loadAttachments = async () => {
    if (!selected) return;
    setIsLoadingAttachments(true);
    try {
      const result = await workItemsApi.attachments(selected.id);
      setAttachments(result.attachments);
    } catch (err) {
      setDetailError(err instanceof WorkItemsApiError ? `${err.code}: ${err.message}` : 'Failed to load attachments.');
    } finally {
      setIsLoadingAttachments(false);
    }
  };

  const toggleAttachments = async () => {
    if (!selected) return;
    const next = !showAttachments;
    setShowAttachments(next);
    if (next) await loadAttachments();
  };

  const uploadAttachment = async (file: File) => {
    if (!selected) return;
    setAttachmentBusy(true);
    setDetailError(null);
    try {
      await workItemsApi.uploadAttachment(selected.id, file);
      await loadAttachments();
    } catch (err) {
      setDetailError(err instanceof WorkItemsApiError ? `${err.code}: ${err.message}` : 'Failed to upload attachment.');
    } finally {
      setAttachmentBusy(false);
    }
  };

  const removeAttachment = async (attachmentId: number) => {
    if (!selected) return;
    setAttachmentBusy(true);
    try {
      await workItemsApi.deleteAttachment(selected.id, attachmentId);
      await loadAttachments();
    } catch (err) {
      setDetailError(err instanceof WorkItemsApiError ? `${err.code}: ${err.message}` : 'Failed to delete attachment.');
    } finally {
      setAttachmentBusy(false);
    }
  };

  const claim = async () => {
    if (!selected) return;
    setBusy(true);
    setDetailError(null);
    try {
      const result = await workItemsApi.claim(selected.id);
      setSelected(result.workItem);
      await load('refresh');
    } catch (err) {
      setDetailError(err instanceof WorkItemsApiError ? `${err.code}: ${err.message}` : 'Failed to claim Work Item.');
    } finally {
      setBusy(false);
    }
  };

  const outputSchema = selected ? resolveRawOutputSchema(selected.outputSchemaJson) : null;
  const useOutputSchemaForm = Boolean(
    formConfig?.formMode !== 'DESIGNED_COMPONENT'
      && outputSchema
      && hasRenderableObjectSchema(outputSchema),
  );
  const showTaskContextSection = Boolean(
    selected?.inputJson && workItemPayloadHasDisplayableFields(selected.inputJson),
  );

  /** HWF-4.5 — `reasonText` is merged into `output.reason` at submit time (kept as a separate field, not part of `outputSchema`, so authors don't have to touch their schema just to require this). Only reachable for RAW_JSON/DYNAMIC_SCHEMA_FORM — a DESIGNED_COMPONENT submits directly to the API and is enforced server-side only (see that mode's own module note). */
  const complete = async () => {
    if (!selected) return;
    if (formConfig?.requireReasonOutcomes.includes(outcome) && !reasonText.trim()) {
      setDetailError(`Outcome "${outcome}" requires a reason.`);
      return;
    }
    setBusy(true);
    setDetailError(null);
    try {
      const baseOutput = useOutputSchemaForm
        ? dynamicOutputValue
        : showAdvancedOutputJson
          ? JSON.parse(outputJson || '{}')
          : {};
      const output = reasonText.trim()
        ? { ...(baseOutput && typeof baseOutput === 'object' ? baseOutput : {}), reason: reasonText.trim() }
        : baseOutput;
      await workItemsApi.complete(selected.id, outcome, output);
      if (personalInboxFocus && onBackToInbox) {
        onBackToInbox();
        return;
      }
      setSelected(null);
      await load('refresh');
    } catch (err) {
      setDetailError(err instanceof WorkItemsApiError ? `${err.code}: ${err.message}` : 'Invalid output JSON or completion failed.');
    } finally {
      setBusy(false);
    }
  };

  const forward = async () => {
    if (!selected || !forwardTarget.trim()) return;
    setBusy(true);
    setDetailError(null);
    try {
      const newAssignment = forwardStrategy === 'USER'
        ? { strategy: 'USER' as const, userId: Number(forwardTarget) }
        : { strategy: 'ROLE' as const, roleId: forwardTarget.trim() };
      await workItemsApi.forward(selected.id, newAssignment);
      setSelected(null);
      setForwardOpen(false);
      setForwardTarget('');
      await load('refresh');
    } catch (err) {
      setDetailError(err instanceof WorkItemsApiError ? `${err.code}: ${err.message}` : 'Failed to forward Work Item.');
    } finally {
      setBusy(false);
    }
  };

  /** HWF-3.2 — attaches a brand-new ad-hoc Work Item to the same instance as the currently-selected item; the server enforces "ADMIN or existing participant on this instance", so a non-eligible caller just gets a clear error here. */
  const attachAdHoc = async () => {
    if (!selected || !adHocTitle.trim() || !adHocAssignTarget.trim()) return;
    setAdHocBusy(true);
    setAdHocError(null);
    try {
      const assignment = adHocAssignStrategy === 'USER'
        ? { strategy: 'USER' as const, userId: Number(adHocAssignTarget) }
        : { strategy: 'ROLE' as const, roleId: adHocAssignTarget.trim() };
      await workItemsApi.attachAdHoc(selected.workflowInstanceId, {
        workItemType: adHocType,
        titleText: adHocTitle.trim(),
        assignment,
        allowedOutcomes: adHocOutcomes.split(',').map((s) => s.trim()).filter(Boolean),
      });
      setAdHocOpen(false);
      setAdHocTitle('');
      setAdHocAssignTarget('');
      await load('refresh');
    } catch (err) {
      setAdHocError(err instanceof WorkItemsApiError ? `${err.code}: ${err.message}` : 'Failed to attach ad-hoc Work Item.');
    } finally {
      setAdHocBusy(false);
    }
  };

  const allowedOutcomes: string[] = selected ? (JSON.parse(selected.allowedOutcomesJson) as string[]) : [];
  const inboxForwardLabel = inboxWorkItemLabel('shell.inbox.correspondence.forward', 'Forward');
  const personalInboxWorkItem = useMemo((): PersonalInboxItem | null => {
    if (!personalInboxFocus || !selected) {
      return null;
    }
    return {
      id: `work_item:${selected.id}`,
      kind: 'work_item',
      origin: 'Work item',
      originDetail: selected.workItemType,
      title: selected.titleText,
      summary: selected.summaryText ?? null,
      surfacedAt: selected.createdAt ?? new Date().toISOString(),
      attention: 'none',
      href: `my-inbox?workItemId=${selected.id}`,
      ref: { type: 'work_item', id: selected.id },
    };
  }, [personalInboxFocus, selected]);

  return (
    <>
    <div className="flex h-full min-h-0 w-full min-w-0 font-sans">
      {!personalInboxFocus ? (
      <div className="flex min-w-0 flex-1 flex-col border-e border-slate-200">
        <ListPageToolbarScrollHost collapsed={listToolbarCollapsed}>
        <div
          className={cn(
            'flex items-center justify-between gap-2 border-b border-slate-200 px-3 py-2',
          )}
        >
          <div className="flex items-center gap-3 overflow-x-auto text-xs">
            {onBackToInbox ? (
              <WorkspaceBackIcon ariaLabel={backToInboxLabel} title={backToInboxLabel} onClick={onBackToInbox} />
            ) : null}
            {bucketGroups.map((group, groupIndex) => (
              <React.Fragment key={group.groupLabel}>
                {groupIndex > 0 ? <div className="h-5 w-px shrink-0 bg-slate-200" /> : null}
                <div className="flex shrink-0 flex-col gap-0.5">
                  <span className="px-0.5 text-[9px] font-semibold uppercase tracking-wide text-slate-400">{group.groupLabel}</span>
                  <div className="flex gap-1">
                    {group.buckets.map((b) => (
                      <button
                        key={b.value}
                        type="button"
                        onClick={() => setBucket(b.value)}
                        className={`shrink-0 rounded px-2.5 py-1.5 font-semibold ${bucket === b.value ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-100'}`}
                      >
                        {b.label}
                      </button>
                    ))}
                  </div>
                </div>
              </React.Fragment>
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            <button type="button" onClick={() => setShowOutOfOffice((o) => !o)} className="rounded px-2 py-1 text-[11px] font-medium text-slate-500 hover:bg-slate-100">
              {outOfOfficeLabel}
            </button>
            <button type="button" onClick={() => setShowNotificationPreferences((o) => !o)} className="rounded px-2 py-1 text-[11px] font-medium text-slate-500 hover:bg-slate-100">
              {notificationsLabel}
            </button>
            <ToolbarActionGroupWithRefresh
              onRefresh={() => void load('refresh')}
              isRefreshing={isRefreshing && !isLoading}
              actions={[]}
            />
          </div>
        </div>
        </ListPageToolbarScrollHost>

        {showOutOfOffice ? (
          <div className="border-b border-slate-200 bg-slate-50">
            <OutOfOfficePanel />
          </div>
        ) : null}

        {showNotificationPreferences ? (
          <div className="border-b border-slate-200 bg-slate-50">
            <NotificationPreferencesPanel />
          </div>
        ) : null}

        <div className="flex items-center gap-2 border-b border-slate-200 px-3 py-2">
          <UiSelect size="sm" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} ariaLabel="Filter by Work Item type">
            <option value="">All types</option>
            {WORK_ITEM_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </UiSelect>
          <UiSelect size="sm" value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value as PriorityFilter)} ariaLabel="Filter by priority">
            <option value="ALL">All priorities</option>
            <option value="NORMAL">Normal</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
          </UiSelect>
          <label className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
            <UiCheckbox size="sm" checked={overdueOnly} onChange={(e) => setOverdueOnly(e.target.checked)} />
            Overdue only
          </label>
          <div className="ms-auto flex items-center gap-1.5">
            {savingFilterName === null ? (
              <button type="button" onClick={() => setSavingFilterName('')} className="text-[11px] font-medium text-primary-700 hover:underline">
                Save filter
              </button>
            ) : (
              <>
                <UiInput size="sm" aiAssist={false} autoDir={false} className="w-32 text-xs" placeholder="Filter name" value={savingFilterName} onChange={(e) => setSavingFilterName(e.target.value)} />
                <button type="button" onClick={() => void saveCurrentFilter()} className="text-[11px] font-medium text-primary-700 hover:underline">Save</button>
                <button type="button" onClick={() => setSavingFilterName(null)} className="text-[11px] text-slate-400 hover:underline">Cancel</button>
              </>
            )}
          </div>
        </div>

        {savedFilters.length > 0 ? (
          <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-200 px-3 py-1.5">
            {savedFilters.map((f) => (
              <span key={f.id} className="flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">
                <button type="button" onClick={() => applySavedFilter(f)} className="hover:underline">{f.name}</button>
                <button type="button" onClick={() => void removeSavedFilter(f.id)} className="text-slate-400 hover:text-rose-600">×</button>
              </span>
            ))}
          </div>
        ) : null}

        {selectedIds.size > 0 ? (
          <div className="flex items-center justify-between gap-2 border-b border-slate-200 bg-primary-subtle/30 px-3 py-1.5">
            <span className="text-xs font-medium text-slate-600">{selectedIds.size} selected</span>
            <div className="flex items-center gap-2">
              {bulkError ? <span className="text-[11px] text-rose-600">{bulkError}</span> : null}
              <AppButton size="sm" intent="primary" disabled={bulkBusy} onClick={() => void bulkClaim()}>
                Claim {selectedIds.size}
              </AppButton>
              <button type="button" onClick={() => setSelectedIds(new Set())} className="text-xs text-slate-400 hover:text-slate-600">
                Clear
              </button>
            </div>
          </div>
        ) : null}

        <div className="min-h-0 flex-1 overflow-auto" onScroll={handleGridScroll}>
          {isLoading ? (
            <div className="flex h-40 items-center justify-center text-sm font-medium text-slate-400">Loading…</div>
          ) : error ? (
            <QueryErrorPanel message="Failed to load Work Items." detail={error} onRetry={() => void load('refresh')} isRetrying={isRefreshing} />
          ) : items.length === 0 ? (
            <div className="flex h-40 flex-col items-center justify-center gap-1 px-4 text-center text-sm font-medium text-slate-400">
              <span>No Work Items in this bucket.</span>
              {bucket === 'MINE_ASSIGNED' ? (
                <span className="text-xs font-normal text-slate-400">Role-assigned tasks appear under Open tasks or Available to claim.</span>
              ) : null}
            </div>
          ) : (
            <ul>
              {groupItemsForDisplay(items).map((row) => {
                if (row.kind === 'group') {
                  return (
                    <li key={`group-${row.key}`} className="border-b border-slate-100 bg-slate-50/60">
                      <div className="flex items-center gap-1.5 px-3 pt-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                        <span>Multi-approver group</span>
                        <span className="rounded bg-slate-200 px-1.5 py-0.5 text-slate-600">{row.items.length}</span>
                        <span className="truncate font-normal normal-case text-slate-400">· {row.key}</span>
                      </div>
                      <ul className="ps-2">
                        {row.items.map((item) => (
                          <InboxItemRow key={item.id} item={item} selected={selected?.id === item.id} selectedIds={selectedIds} toggleSelected={toggleSelected} openItem={openItem} />
                        ))}
                      </ul>
                    </li>
                  );
                }
                return <InboxItemRow key={row.item.id} item={row.item} selected={selected?.id === row.item.id} selectedIds={selectedIds} toggleSelected={toggleSelected} openItem={openItem} />;
              })}
            </ul>
          )}
        </div>
      </div>
      ) : null}

      <div
        className={cn(
          personalInboxFocus ? 'flex min-w-0 flex-1 flex-col overflow-y-auto bg-white' : 'w-96 shrink-0 overflow-y-auto',
        )}
      >
        {personalInboxFocus ? (
          <div className={PERSONAL_INBOX_MESSAGE_DETAIL_TOOLBAR_CLASS}>
            <div className={PAGE_TOOLBAR_FILTERS_CLUSTER_CLASS}>
              {onBackToInbox ? (
                <WorkspaceBackIcon ariaLabel={backToInboxLabel} title={backToInboxLabel} onClick={onBackToInbox} />
              ) : null}
              <span
                className="min-w-0 truncate text-sm font-semibold text-slate-800"
                title={selected?.titleText ?? undefined}
              >
                {selected?.titleText ?? inboxWorkItemLabel('shell.inbox.workItem.loadingDetail', 'Loading task…')}
              </span>
              {selected ? (
                <span
                  className={cn(
                    'shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide',
                    workItemStatusToneClass(selected.status),
                  )}
                >
                  {workItemStatusLabel(selected.status)}
                </span>
              ) : null}
            </div>
            <div className={PAGE_TOOLBAR_ACTIONS_CLUSTER_CLASS}>
              {selected && inboxSupportsCorrespondenceAction('work_item', 'forward') ? (
                <AppButton
                  type="button"
                  size="sm"
                  intent="secondary"
                  disabled={busy}
                  onClick={() => setInboxForwardOpen(true)}
                >
                  <PersonalInboxForwardIcon className="h-3.5 w-3.5" />
                  {inboxForwardLabel}
                </AppButton>
              ) : null}
              <ToolbarRefreshButton
                separatorBefore={false}
                onRefresh={() => {
                  if (initialWorkItemId) {
                    void openItem({ id: initialWorkItemId } as WorkItemSummary);
                  }
                }}
                isRefreshing={isLoading || busy}
              />
            </div>
          </div>
        ) : null}
        <div className={personalInboxFocus ? PERSONAL_INBOX_MESSAGE_DETAIL_PAGE_CLASS : 'p-3'}>
        {!selected ? (
          <p className="text-xs text-slate-500">
            {resolveCultureLabel(t, 'shell.inbox.workItem.selectPrompt', 'Select a Work Item to see its details.')}
          </p>
        ) : (
          <div className={cn('flex flex-col text-sm', personalInboxFocus ? 'gap-4' : 'gap-3')}>
            <div className={personalInboxFocus ? 'flex flex-col gap-2 pb-1' : undefined}>
              {!personalInboxFocus ? (
                <h3 className="font-semibold text-slate-900">{selected.titleText}</h3>
              ) : null}
              {selected.summaryText ? (
                <p className={cn('text-slate-600', personalInboxFocus ? 'text-sm leading-snug' : 'mt-1 text-xs text-slate-500')}>
                  {selected.summaryText}
                </p>
              ) : null}
              {personalInboxFocus && inboxEnvelopeLoading && inboxEnvelopeMessages.length === 0 ? (
                <p className="text-xs text-slate-500">
                  {resolveCultureLabel(t, 'shell.inbox.loading', 'Loading inbox…')}
                </p>
              ) : null}
              {personalInboxFocus && inboxEnvelopeMessages.length > 0 ? (
                <PersonalInboxEnvelopeMessageBlock messages={inboxEnvelopeMessages} />
              ) : null}
              {!personalInboxFocus ? (
                <p className="mt-1 text-[11px] text-slate-400">
                  status {selected.status} · claimedBy {selected.claimedByUserId ?? '—'}
                </p>
              ) : (
                <p className="text-xs text-slate-500">
                  {inboxWorkItemLabel('shell.inbox.workItem.claimedBy', 'Claimed by')}
                  {' '}
                  <span className="font-medium text-slate-700">
                    {selected.claimedByUserId ?? inboxWorkItemLabel('shell.inbox.workItem.claimedByNone', 'Unassigned')}
                  </span>
                </p>
              )}
              <div className={cn('flex flex-wrap gap-x-3 gap-y-1', personalInboxFocus ? 'pt-1' : 'mt-1')}>
                <button
                  type="button"
                  onClick={() => void toggleHistory()}
                  className="text-xs font-medium text-slate-600 hover:text-primary-700"
                >
                  {showHistory
                    ? inboxWorkItemLabel('shell.inbox.workItem.hideHistory', 'Hide history')
                    : inboxWorkItemLabel('shell.inbox.workItem.showHistory', 'Show history')}
                </button>
                <button
                  type="button"
                  onClick={() => void toggleComments()}
                  className="text-xs font-medium text-slate-600 hover:text-primary-700"
                >
                  {showComments
                    ? inboxWorkItemLabel('shell.inbox.workItem.hideComments', 'Hide comments')
                    : `${inboxWorkItemLabel('shell.inbox.workItem.comments', 'Comments')}${comments.length > 0 ? ` (${comments.length})` : ''}`}
                </button>
                <button
                  type="button"
                  onClick={() => void toggleAttachments()}
                  className="text-xs font-medium text-slate-600 hover:text-primary-700"
                >
                  {showAttachments
                    ? inboxWorkItemLabel('shell.inbox.workItem.hideAttachments', 'Hide attachments')
                    : `${inboxWorkItemLabel('shell.inbox.workItem.attachments', 'Attachments')}${attachments.length > 0 ? ` (${attachments.length})` : ''}`}
                </button>
                <button
                  type="button"
                  onClick={() => setAdHocOpen((o) => !o)}
                  className="text-xs font-medium text-slate-600 hover:text-primary-700"
                >
                  {adHocOpen
                    ? inboxWorkItemLabel('shell.inbox.workItem.cancelAdHoc', 'Cancel ad-hoc task')
                    : inboxWorkItemLabel('shell.inbox.workItem.attachAdHoc', 'Attach ad-hoc task…')}
                </button>
              </div>
            </div>

            {adHocOpen ? (
              <div className="flex flex-col gap-1.5 rounded border border-slate-200 bg-slate-50 p-2">
                <p className="text-[10px] font-normal text-slate-400">
                  Attaches a brand-new Work Item to this same workflow run, outside its defined graph (HWF-3.2 case-management escape hatch). Requires ADMIN, or having held a Work Item on this run before.
                </p>
                <UiSelect size="sm" value={adHocType} onChange={(e) => setAdHocType(e.target.value)}>
                  {WORK_ITEM_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </UiSelect>
                <UiInput size="sm" aiAssist={false} autoDir={false} className="text-xs" value={adHocTitle} onChange={(e) => setAdHocTitle(e.target.value)} placeholder="Title" />
                <div className="flex gap-1.5">
                  <UiSelect size="sm" className="w-28 shrink-0" value={adHocAssignStrategy} onChange={(e) => setAdHocAssignStrategy(e.target.value as 'USER' | 'ROLE')}>
                    <option value="USER">User id</option>
                    <option value="ROLE">Role</option>
                  </UiSelect>
                  <UiInput
                    size="sm"
                    aiAssist={false}
                    autoDir={false}
                    className="flex-1 text-xs"
                    value={adHocAssignTarget}
                    onChange={(e) => setAdHocAssignTarget(e.target.value)}
                    placeholder={adHocAssignStrategy === 'USER' ? 'assignee user id' : 'role name'}
                  />
                </div>
                <UiInput size="sm" aiAssist={false} autoDir={false} className="text-xs" value={adHocOutcomes} onChange={(e) => setAdHocOutcomes(e.target.value)} placeholder="Allowed outcomes (comma-separated)" />
                {adHocError ? <div className="rounded border border-rose-200 bg-rose-50 px-2 py-1.5 text-xs text-rose-700">{adHocError}</div> : null}
                <AppButton size="sm" intent="primary" disabled={adHocBusy || !adHocTitle.trim() || !adHocAssignTarget.trim()} onClick={() => void attachAdHoc()}>
                  Attach
                </AppButton>
              </div>
            ) : null}

            {showHistory ? (
              <div className="flex flex-col gap-1 rounded border border-slate-200 bg-slate-50 p-2">
                {isLoadingHistory ? (
                  <span className="text-xs text-slate-400">Loading history…</span>
                ) : transitions.length === 0 ? (
                  <span className="text-xs text-slate-400">No transitions recorded.</span>
                ) : (
                  <ul className="flex flex-col gap-1.5">
                    {transitions.map((t) => (
                      <li key={t.id} className="text-[11px] text-slate-600">
                        <span className="font-semibold text-slate-800">{t.fromStatus} → {t.toStatus}</span>
                        {' '}({t.transitionType}) · {t.actorType}{t.actorId ? ` #${t.actorId}` : ''} · {formatDate(t.occurredAt)}
                        {t.reasonCode ? <span className="text-slate-400"> · {t.reasonCode}</span> : null}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : null}

            {showComments ? (
              <div className="flex flex-col gap-2 rounded border border-slate-200 bg-slate-50 p-2">
                {isLoadingComments ? (
                  <span className="text-xs text-slate-400">Loading comments…</span>
                ) : comments.length === 0 ? (
                  <span className="text-xs text-slate-400">No comments yet.</span>
                ) : (
                  <ul className="flex flex-col gap-1.5">
                    {comments.map((c) => (
                      <li key={c.id} className="rounded bg-white p-1.5 text-[11px]">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-slate-800">User #{c.authorUserId}</span>
                          <span className="text-slate-400">{formatDate(c.createdAt)}</span>
                        </div>
                        <p className="mt-0.5 whitespace-pre-wrap text-slate-600">{c.text}</p>
                        {c.mentionedUserIds.length > 0 ? <p className="mt-0.5 text-slate-400">mentions: {c.mentionedUserIds.map((id) => `#${id}`).join(', ')}</p> : null}
                      </li>
                    ))}
                  </ul>
                )}
                <UiTextarea size="sm" aiAssist={false} autoDir={false} className="h-16 text-xs" placeholder="Write a comment…" value={newCommentText} onChange={(e) => setNewCommentText(e.target.value)} ariaLabel="New comment" />
                <UiInput size="sm" aiAssist={false} autoDir={false} className="text-xs" placeholder="Mention user ids (comma-separated, optional)" value={newCommentMentions} onChange={(e) => setNewCommentMentions(e.target.value)} />
                <AppButton size="sm" intent="secondary" disabled={busy || !newCommentText.trim()} onClick={() => void postComment()}>
                  Post comment
                </AppButton>
              </div>
            ) : null}

            {showAttachments ? (
              <div className="flex flex-col gap-2 rounded border border-slate-200 bg-slate-50 p-2">
                {isLoadingAttachments ? (
                  <span className="text-xs text-slate-400">Loading attachments…</span>
                ) : attachments.length === 0 ? (
                  <span className="text-xs text-slate-400">No attachments yet.</span>
                ) : (
                  <ul className="flex flex-col gap-1">
                    {attachments.map((a) => (
                      <li key={a.id} className="flex items-center justify-between rounded bg-white px-2 py-1 text-[11px]">
                        <a href={workItemsApi.attachmentDownloadUrl(selected.id, a.id)} target="_blank" rel="noreferrer" className="truncate text-primary-700 hover:underline">
                          {a.filename} <span className="text-slate-400">({Math.ceil(a.sizeBytes / 1024)} KB)</span>
                        </a>
                        <button type="button" disabled={attachmentBusy} onClick={() => void removeAttachment(a.id)} className="text-slate-400 hover:text-rose-600">Remove</button>
                      </li>
                    ))}
                  </ul>
                )}
                <input
                  type="file"
                  disabled={attachmentBusy}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void uploadAttachment(file);
                    e.target.value = '';
                  }}
                  className="text-[11px]"
                />
                <p className="text-[10px] text-slate-400">Stored in the database (not the disk-based file manager) — max 5 MB per file, 10 files per Work Item.</p>
              </div>
            ) : null}

            {detailError ? <div className="rounded border border-rose-200 bg-rose-50 px-2 py-1.5 text-xs text-rose-700">{detailError}</div> : null}

            {showTaskContextSection ? (
              <section className={cn('flex flex-col gap-2', personalInboxFocus && 'rounded-lg border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/30')}>
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {inboxWorkItemLabel('shell.inbox.workItem.inputContext', 'Task context')}
                  </h3>
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    {inboxWorkItemLabel('shell.inbox.workItem.inputContextHint', 'Read-only data passed from the workflow.')}
                  </p>
                </div>
                <WorkItemPayloadReadView
                  json={selected.inputJson}
                  emptyLabel={inboxWorkItemLabel('shell.inbox.workItem.inputEmpty', 'No context fields for this task.')}
                  invalidLabel={inboxWorkItemLabel('shell.inbox.workItem.inputInvalid', 'Context data could not be read.')}
                />
              </section>
            ) : null}

            {selected.status === 'OPEN' ? (
              <div className={personalInboxFocus ? 'pt-1' : undefined}>
                <AppButton size="sm" intent="primary" className={personalInboxFocus ? 'min-h-9 w-full sm:w-auto' : undefined} disabled={busy} onClick={() => void claim()}>
                  {inboxWorkItemLabel('shell.inbox.workItem.claim', 'Claim')}
                </AppButton>
              </div>
            ) : null}

            {selected.status === 'CLAIMED' ? (
              <div className={cn('flex flex-col gap-1 rounded border border-slate-200 p-2', personalInboxFocus && 'bg-slate-50/40')}>
                <button type="button" onClick={() => setForwardOpen((o) => !o)} className="text-start text-xs font-semibold text-slate-700 hover:text-primary-700">
                  {forwardOpen
                    ? inboxWorkItemLabel('shell.inbox.workItem.cancelForward', 'Cancel forward')
                    : inboxWorkItemLabel('shell.inbox.workItem.forwardTo', 'Forward to someone else…')}
                </button>
                {forwardOpen ? (
                  <div className="mt-1 flex flex-col gap-1.5">
                    <UiSelect size="sm" value={forwardStrategy} onChange={(e) => setForwardStrategy(e.target.value as 'USER' | 'ROLE')}>
                      <option value="USER">Specific user (id)</option>
                      <option value="ROLE">Role</option>
                    </UiSelect>
                    <UiInput
                      size="sm"
                      aiAssist={false}
                      autoDir={false}
                      className="text-xs"
                      value={forwardTarget}
                      onChange={(e) => setForwardTarget(e.target.value)}
                      placeholder={forwardStrategy === 'USER' ? 'target user id' : 'role name'}
                    />
                    <AppButton size="sm" intent="secondary" disabled={busy || !forwardTarget.trim()} onClick={() => void forward()}>
                      Forward
                    </AppButton>
                  </div>
                ) : null}
              </div>
            ) : null}

            {selected.status === 'CLAIMED' && formConfig?.formMode === 'DESIGNED_COMPONENT' ? (
              <div className="flex flex-col gap-2">
                <p className="text-[10px] font-normal text-slate-400">
                  This node uses a designed form — its own submit action completes the Work Item directly (the host inbox does not drive completion for this mode).
                </p>
                {isLoadingDesignedDraft ? (
                  <span className="text-xs text-slate-400">Loading designed form…</span>
                ) : designedDraftError ? (
                  <div className="rounded border border-rose-200 bg-rose-50 px-2 py-1.5 text-xs text-rose-700">{designedDraftError}</div>
                ) : designedDraft ? (
                  <div className="rounded border border-slate-200">
                    <DesignerDocumentPreview
                      document={designedDraft.document}
                      bindingDefinitions={designedDraft.bindingDefinitions ?? EMPTY_DESIGNER_BINDING_DEFINITIONS}
                      interactive
                      routeParams={{ id: String(selected.id) }}
                      authUser={currentUser}
                      onMutationLog={(entry) => {
                        if (entry.ok && entry.endpoint.includes(`/workflow-work-items/${selected.id}/complete`)) {
                          setSelected(null);
                          void load('refresh');
                        }
                      }}
                    />
                  </div>
                ) : null}
              </div>
            ) : null}

            {selected.status === 'CLAIMED' && formConfig?.formMode !== 'DESIGNED_COMPONENT' ? (
              <section className={cn('flex flex-col gap-3', personalInboxFocus && 'rounded-lg border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/30')}>
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {inboxWorkItemLabel('shell.inbox.workItem.decisionSection', 'Your decision')}
                  </h3>
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    {useOutputSchemaForm
                      ? inboxWorkItemLabel(
                        'shell.inbox.workItem.decisionSectionHint',
                        'Choose an outcome and fill in the required fields.',
                      )
                      : inboxWorkItemLabel(
                        'shell.inbox.workItem.decisionSectionHintSimple',
                        'Choose an outcome to finish this task.',
                      )}
                  </p>
                </div>
                <label className="text-xs font-semibold text-slate-700">
                  {inboxWorkItemLabel('shell.inbox.workItem.outcome', 'Outcome')}
                </label>
                <UiSelect size="sm" value={outcome} onChange={(e) => { setOutcome(e.target.value); setReasonText(''); }}>
                  {allowedOutcomes.map((o) => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                </UiSelect>
                {formConfig?.requireReasonOutcomes.includes(outcome) ? (
                  <label className="flex flex-col gap-1">
                    <span className="text-xs font-semibold text-slate-700">Reason (required for &quot;{outcome}&quot;)</span>
                    <UiTextarea
                      size="sm"
                      aiAssist={false}
                      autoDir={false}
                      className="h-16 text-xs"
                      value={reasonText}
                      onChange={(e) => setReasonText(e.target.value)}
                      ariaLabel="Reason"
                    />
                  </label>
                ) : null}
                {useOutputSchemaForm && outputSchema ? (
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold text-slate-700">
                      {inboxWorkItemLabel('shell.inbox.workItem.outputFields', 'Response fields')}
                    </label>
                    <DynamicWorkItemForm
                      schema={outputSchema}
                      uiSchema={(formConfig?.outputUiSchema as Record<string, unknown> | undefined) ?? undefined}
                      formData={dynamicOutputValue}
                      onChange={setDynamicOutputValue}
                    />
                  </div>
                ) : showAdvancedOutputJson ? (
                  <div className="flex flex-col gap-2 rounded-lg border border-dashed border-slate-200 bg-slate-50/60 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-slate-600">
                        {inboxWorkItemLabel('shell.inbox.workItem.outputJsonAdvanced', 'Advanced output (JSON)')}
                      </span>
                      <button
                        type="button"
                        className="text-xs font-medium text-primary-700 hover:underline"
                        onClick={() => setShowAdvancedOutputJson(false)}
                      >
                        {inboxWorkItemLabel('shell.inbox.workItem.outputJsonAdvancedHide', 'Hide JSON editor')}
                      </button>
                    </div>
                    <UiTextarea
                      size="sm"
                      aiAssist={false}
                      autoDir={false}
                      className="h-28 font-mono text-xs"
                      value={outputJson}
                      onChange={(e) => setOutputJson(e.target.value)}
                      ariaLabel="Output JSON"
                    />
                  </div>
                ) : (
                  <div className="rounded-lg border border-slate-100 bg-slate-50/50 px-3 py-2.5 text-sm text-slate-600">
                    {inboxWorkItemLabel(
                      'shell.inbox.workItem.outputNoFieldsRequired',
                      'No additional fields are required for this task.',
                    )}
                    <button
                      type="button"
                      className="mt-1 block text-xs font-medium text-primary-700 hover:underline"
                      onClick={() => setShowAdvancedOutputJson(true)}
                    >
                      {inboxWorkItemLabel('shell.inbox.workItem.outputJsonAdvancedShow', 'Advanced: edit output as JSON')}
                    </button>
                  </div>
                )}
                <div className="flex justify-start pt-1">
                  <AppButton
                    size="sm"
                    intent="primary"
                    disabled={busy || !outcome || (formConfig?.requireReasonOutcomes.includes(outcome) && !reasonText.trim())}
                    onClick={() => void complete()}
                  >
                    <CircleCheck className="h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden />
                    {inboxWorkItemLabel('shell.inbox.workItem.complete', 'Complete')}
                  </AppButton>
                </div>
              </section>
            ) : null}
          </div>
        )}
        </div>
      </div>
    </div>
      <PersonalInboxCorrespondenceDialog
        open={inboxForwardOpen}
        mode="forward"
        item={personalInboxWorkItem}
        onOpenChange={setInboxForwardOpen}
      />
    </>
  );
};
