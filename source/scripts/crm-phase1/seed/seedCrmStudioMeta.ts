/**
 * CRM Phase 1 — seed Data Studio studio-meta (groups, widgets, stories, associationMeta).
 * v2: customer = base_users + base_user_profiles + `crm_customers` extension.
 * Opt-in only; not part of app bootstrap.
 */

import type {
  ColumnFormWidget,
  ColumnFormWidgetProps,
  ColumnSearchRole,
  EdgeModelAssociation,
  EdgeModelDefinition,
  EdgeModelStudioAssociationMeta,
  EdgeModelStudioColumnMeta,
  RelationFormWidget,
  RelationTargetFilterCondition,
  UpsertEdgeModelStudioMetaInput,
} from '../../../src/shared/api/contracts/data-api';
import type { EdgeModelService } from '../../../src/server/services/data-api/edgeModelService';
import type { CrmBaseInfoSeedResult } from './seedCrmBaseInfo';

const GROUP_ORDER_KEY = 'columnGroupOrder';
const GROUP_PRESENTATION_KEY = 'columnGroupPresentation';
const STORY_KEY = 'story';

type ColumnSeed = {
  columnName: string;
  group: string;
  sortOrder: number;
  formWidget: ColumnFormWidget;
  formWidgetProps?: ColumnFormWidgetProps;
  searchRole?: ColumnSearchRole;
  required?: boolean;
  icon?: string;
  developerNotes?: string;
  interfaceNotes?: string;
};

type GroupSeed = {
  name: string;
  icon: string;
  color: string;
};

type AssocSeed = {
  as: string;
  displayLabel: string;
  icon?: string;
  formWidget: RelationFormWidget;
  attachedFields?: Array<{ sourceColumn: string; as: string }>;
  /** Base Info category title under CRM root — resolved to parent_id at seed time. */
  baseInfoCategoryTitle?: string;
};

type ModelStudioSeed = {
  objectName: string;
  tags: string[];
  story: string;
  groups: GroupSeed[];
  columns: ColumnSeed[];
  associations: AssocSeed[];
};

const col = (
  columnName: string,
  group: string,
  sortOrder: number,
  formWidget: ColumnFormWidget,
  extras: Omit<ColumnSeed, 'columnName' | 'group' | 'sortOrder' | 'formWidget'> = {},
): ColumnSeed => ({
  columnName,
  group,
  sortOrder,
  formWidget,
  ...extras,
});

const assoc = (
  as: string,
  displayLabel: string,
  formWidget: RelationFormWidget,
  extras: Omit<AssocSeed, 'as' | 'displayLabel' | 'formWidget'> = {},
): AssocSeed => ({
  as,
  displayLabel,
  formWidget,
  ...extras,
});

const CUSTOMERS_STORY = `## Purpose

\`crm_customers\` is the 1:1 CRM extension for a platform user (\`base_users\` + \`base_user_profiles\`). Identity fields live on the profile; this table holds CRM lifecycle, source, owner, and note only.

## Lifecycle

1. **Create** — Add Individual / Add Company (Users) → role CUSTOMER → insert extension row with \`lifecycle_stage = Lead\`.
2. **Qualify / progress** — operator updates lifecycle; opportunities and activities link via \`customer_user_id\`.
3. **Archive** — \`lifecycle_stage = Lost\` (no separate archive column).

## Rules of thumb

- \`person_type_code\` is platform-owned and locked after create.
- Individual→company link: \`organization_user_id\` on the profile, not on this table.
- Internal staff are \`base_users\` with sales/support roles — not rows here unless they are also customers.
`;

const CUSTOMER_TAGS_STORY = `## Purpose

Junction between customer (\`base_users.id\`) and Base Info tags under **CRM / Customer Tags**. Free-form labeling (VIP, Cold, Partner, …) without a dedicated \`crm_tags\` table.

## Rules

- Composite PK \`(user_id, tag_code)\` — no surrogate id.
- Deleting a user cascades its tag rows.
`;

const OPPORTUNITIES_STORY = `## Purpose

\`crm_opportunities\` is a sales deal in progress for a customer (\`base_users\` via \`customer_user_id\`). It carries a value, an expected close date, and a current pipeline \`stage\`. It does not carry product line items — that belongs to Commerce.

## Lifecycle

1. **Create** — \`stage = New\`; set \`customer\`, \`title\`, and optionally \`amount\` / \`expected_close_date\`.
2. **Progress** — move \`stage\` forward (\`Qualifying\` → \`Proposal\` → \`Negotiation\`). Every stage change (including the initial one) writes a row to \`crm_opportunity_stage_history\`.
3. **Close** — reaching \`Won\` or \`Lost\` (the two terminal stages) stamps \`closed_at\`. Stage becomes locked.
4. **Reopen** — an explicit action clears \`closed_at\` and returns the opportunity to its last non-terminal stage.

## Rules of thumb

- Single default-currency \`amount\`; multi-currency is out of scope v1.
- Prefer \`Lost\` + history over hard-delete.
- Reporting on pipeline velocity reads \`crm_opportunity_stage_history\`, never \`updated_at\` on this row.
`;

const STAGE_HISTORY_STORY = `## Purpose

Append-only history of \`stage_code\` transitions on \`crm_opportunities\`. Written by the server whenever a stage changes (including the initial stage on create, where \`from_stage\` is null). Powers pipeline velocity reporting.

## Rules

- Rows are never edited or deleted directly; only inserted.
- Deleting an opportunity cascades its stage-history rows.
`;

const ACTIVITIES_STORY = `## Purpose

\`crm_activities\` is one shared record shape for both a logged past interaction (call, email, meeting, note) and a scheduled to-do (\`task\`). \`activity_type_code\` labels the kind; there is no separate \`crm_tasks\` table.

## Lifecycle

- **Log a past interaction** — \`completed_at\` is set at creation; \`due_at\` usually stays empty.
- **Schedule a task** — \`due_at\` is set at creation; \`completed_at\` stays empty until done.
- **Complete a task** — set \`completed_at\`.

## Rules

- \`customer_user_id\` is always required; \`opportunity_id\` is set only when the activity relates to a specific deal.
- No polymorphic \`related_type\` / \`related_id\` — always these two explicit FKs.
- Meeting scheduling itself (calendar invites, reminders) is owned by Calendar; this row is only the CRM-side log.
`;

const TICKETS_STORY = `## Purpose

\`crm_tickets\` is one support case for a customer (\`customer_user_id\` → \`base_users\`). The conversation itself lives in \`crm_ticket_messages\` — this row only tracks status/priority/channel/assignment metadata.

## Lifecycle

1. **Open** — created with \`status = New\`, \`opened_at\` stamped.
2. **Work** — \`status\` moves to \`Open\` / \`Pending\` (waiting on customer) as an agent works it; \`assigned_to\` is set.
3. **Resolve** — \`status = Resolved\`.
4. **Close** — \`status = Closed\`, \`closed_at\` stamped.
5. **Reopen** — if the customer replies again (new row in \`crm_ticket_messages\`) after \`Resolved\`/\`Closed\`, \`status\` moves back to \`Open\` and \`closed_at\` clears — a new ticket is never created for the same conversation.

## Rules

- Attachments are referenced via File Manager, never stored as bytes on this table or on messages.
- \`channel_code\` is a label only; there is no live-chat/websocket subsystem behind the \`Chat\` value in v1.
`;

const MESSAGES_STORY = `## Purpose

Append-only thread of messages on a \`crm_tickets\` row. \`author_id = null\` marks a message from the customer (\`customer_user_id\` on the ticket); a non-null \`author_id\` marks an agent (\`base_users\`) reply.

## Rules

- Messages are immutable after creation in v1 — corrections are new messages, not edits.
- Ordered by \`created_at\` ascending, like a conversation feed.
- Deleting a ticket cascades its messages.
- **v1 Studio UI** only posts **agent** replies (\`author_id = current user\`). Customer-authored rows (\`author_id = null\`) may exist when created by Portals/inbound later; auto-reopen on customer message is a server rule for that path — not a Studio create path in v1.
- No real-time delivery (websocket/push/typing indicator) here — storage and standard page read/refresh only.
- System events (assign/status change) are **not** rows in this table in v1 — only agent/customer replies live here.
`;

export const CRM_STUDIO_META_SEEDS: ModelStudioSeed[] = [
  {
    objectName: 'crm_customers',
    tags: ['crm', 'customer'],
    story: CUSTOMERS_STORY,
    groups: [
      { name: 'Link', icon: 'lucide:link', color: 'text-sky-600' },
      { name: 'CRM lifecycle', icon: 'lucide:sprout', color: 'text-indigo-600' },
      { name: 'Ownership & note', icon: 'lucide:user-cog', color: 'text-amber-600' },
      { name: 'Audit', icon: 'lucide:clock-3', color: 'text-slate-600' },
    ],
    columns: [
      col('id', 'Link', 10, 'hidden', { icon: 'lucide:hash' }),
      col('user_id', 'Link', 20, 'lookup', {
        searchRole: 'basic',
        required: true,
        icon: 'lucide:user',
        developerNotes: 'UNIQUE — 1:1 extension of base_users. Identity fields live on the profile, not here.',
      }),
      col('lifecycle_stage_code', 'CRM lifecycle', 30, 'lookup', {
        searchRole: 'basic',
        icon: 'lucide:sprout',
      }),
      col('source_code', 'CRM lifecycle', 40, 'lookup', {
        searchRole: 'advanced',
        icon: 'lucide:radio-tower',
      }),
      col('owner_id', 'Ownership & note', 50, 'lookup', {
        searchRole: 'basic',
        icon: 'lucide:user-cog',
      }),
      col('note', 'Ownership & note', 60, 'multiline', {
        icon: 'lucide:sticky-note',
        formWidgetProps: { rows: 3 },
      }),
      col('created_by', 'Audit', 70, 'lookup', { icon: 'lucide:user' }),
      col('created_at', 'Audit', 80, 'datetime', { icon: 'lucide:clock' }),
      col('updated_by', 'Audit', 90, 'lookup', { icon: 'lucide:user-pen' }),
      col('updated_at', 'Audit', 100, 'datetime', { icon: 'lucide:clock' }),
    ],
    associations: [
      assoc('user', 'User', 'lookup', {
        icon: 'lucide:user',
        attachedFields: [{ sourceColumn: 'username', as: 'user_id_username' }],
      }),
      assoc('profile', 'Profile', 'lookup', {
        icon: 'lucide:id-card',
        attachedFields: [
          { sourceColumn: 'firstname', as: 'user_id_firstname' },
          { sourceColumn: 'lastname', as: 'user_id_lastname' },
          { sourceColumn: 'nickname', as: 'user_id_nickname' },
          { sourceColumn: 'company_name', as: 'user_id_company_name' },
          { sourceColumn: 'person_type_code', as: 'user_id_person_type_code' },
          { sourceColumn: 'phone', as: 'user_id_phone' },
        ],
      }),
      assoc('lifecycle_stage', 'Lifecycle stage', 'select', {
        icon: 'lucide:sprout',
        baseInfoCategoryTitle: 'Lifecycle Stages',
        attachedFields: [{ sourceColumn: 'title', as: 'lifecycle_stage_code_title' }],
      }),
      assoc('source', 'Source', 'select', {
        icon: 'lucide:radio-tower',
        baseInfoCategoryTitle: 'Lead Sources',
        attachedFields: [{ sourceColumn: 'title', as: 'source_code_title' }],
      }),
      assoc('owner', 'Owner', 'lookup', {
        icon: 'lucide:user-cog',
        attachedFields: [{ sourceColumn: 'username', as: 'owner_id_username' }],
      }),
      assoc('createdByUser', 'Created by', 'lookup', {
        icon: 'lucide:user',
        attachedFields: [{ sourceColumn: 'username', as: 'created_by_username' }],
      }),
      assoc('updatedByUser', 'Updated by', 'lookup', {
        icon: 'lucide:user-pen',
        attachedFields: [{ sourceColumn: 'username', as: 'updated_by_username' }],
      }),
      assoc('tags', 'Tags', 'relatedGrid', { icon: 'lucide:tags' }),
    ],
  },
  {
    objectName: 'crm_customer_tags',
    tags: ['crm', 'tag'],
    story: CUSTOMER_TAGS_STORY,
    groups: [
      { name: 'Link', icon: 'lucide:link', color: 'text-emerald-600' },
    ],
    columns: [
      col('user_id', 'Link', 10, 'lookup', { searchRole: 'basic', icon: 'lucide:contact' }),
      col('tag_code', 'Link', 20, 'lookup', { searchRole: 'basic', icon: 'lucide:tag' }),
    ],
    associations: [
      assoc('customer', 'Customer', 'lookup', {
        attachedFields: [{ sourceColumn: 'username', as: 'user_id_username' }],
      }),
      assoc('tag', 'Tag', 'select', {
        baseInfoCategoryTitle: 'Customer Tags',
        attachedFields: [{ sourceColumn: 'title', as: 'tag_code_title' }],
      }),
    ],
  },
  {
    objectName: 'crm_opportunities',
    tags: ['crm', 'opportunity'],
    story: OPPORTUNITIES_STORY,
    groups: [
      { name: 'Identity', icon: 'lucide:fingerprint', color: 'text-sky-600' },
      { name: 'Pipeline', icon: 'lucide:target', color: 'text-indigo-600' },
      { name: 'Ownership & note', icon: 'lucide:user-cog', color: 'text-amber-600' },
      { name: 'Audit', icon: 'lucide:clock-3', color: 'text-slate-600' },
    ],
    columns: [
      col('id', 'Identity', 10, 'hidden', { icon: 'lucide:hash' }),
      col('customer_user_id', 'Identity', 20, 'lookup', {
        searchRole: 'basic',
        required: true,
        icon: 'lucide:contact',
      }),
      col('title', 'Identity', 30, 'text', {
        searchRole: 'basic',
        required: true,
        icon: 'lucide:type',
        formWidgetProps: { maxLength: 200 },
      }),
      col('stage_code', 'Pipeline', 40, 'lookup', {
        searchRole: 'basic',
        required: true,
        icon: 'lucide:target',
        developerNotes: 'Won/Lost are terminal; stage locked after close until Reopen.',
      }),
      col('amount', 'Pipeline', 50, 'number', {
        searchRole: 'advanced',
        icon: 'lucide:banknote',
        formWidgetProps: { step: 0.01, min: 0 },
      }),
      col('expected_close_date', 'Pipeline', 60, 'date', {
        searchRole: 'advanced',
        icon: 'lucide:calendar-clock',
      }),
      col('closed_at', 'Pipeline', 70, 'datetime', {
        icon: 'lucide:calendar-check',
        interfaceNotes: 'Server-maintained when stage reaches Won/Lost.',
      }),
      col('owner_id', 'Ownership & note', 80, 'lookup', {
        searchRole: 'basic',
        icon: 'lucide:user-cog',
      }),
      col('note', 'Ownership & note', 90, 'multiline', {
        icon: 'lucide:sticky-note',
        formWidgetProps: { rows: 3 },
      }),
      col('created_by', 'Audit', 100, 'lookup', { icon: 'lucide:user' }),
      col('created_at', 'Audit', 110, 'datetime', { icon: 'lucide:clock' }),
      col('updated_by', 'Audit', 120, 'lookup', { icon: 'lucide:user-pen' }),
      col('updated_at', 'Audit', 130, 'datetime', { icon: 'lucide:clock' }),
    ],
    associations: [
      assoc('customer', 'Customer', 'lookup', {
        icon: 'lucide:contact',
        attachedFields: [{ sourceColumn: 'username', as: 'customer_user_id_username' }],
      }),
      assoc('customerProfile', 'Customer profile', 'lookup', {
        icon: 'lucide:id-card',
        attachedFields: [
          { sourceColumn: 'firstname', as: 'customer_user_id_firstname' },
          { sourceColumn: 'lastname', as: 'customer_user_id_lastname' },
          { sourceColumn: 'nickname', as: 'customer_user_id_nickname' },
          { sourceColumn: 'company_name', as: 'customer_user_id_company_name' },
        ],
      }),
      assoc('stage', 'Stage', 'select', {
        icon: 'lucide:target',
        baseInfoCategoryTitle: 'Pipeline Stages',
        attachedFields: [{ sourceColumn: 'title', as: 'stage_code_title' }],
      }),
      assoc('owner', 'Owner', 'lookup', {
        icon: 'lucide:user-cog',
        attachedFields: [{ sourceColumn: 'username', as: 'owner_id_username' }],
      }),
      assoc('createdByUser', 'Created by', 'lookup', {
        icon: 'lucide:user',
        attachedFields: [{ sourceColumn: 'username', as: 'created_by_username' }],
      }),
      assoc('updatedByUser', 'Updated by', 'lookup', {
        icon: 'lucide:user-pen',
        attachedFields: [{ sourceColumn: 'username', as: 'updated_by_username' }],
      }),
      assoc('stageHistory', 'Stage history', 'relatedGrid', { icon: 'lucide:history' }),
      assoc('activities', 'Activities', 'relatedGrid', { icon: 'lucide:activity' }),
    ],
  },
  {
    objectName: 'crm_opportunity_stage_history',
    tags: ['crm', 'history'],
    story: STAGE_HISTORY_STORY,
    groups: [
      { name: 'Identity', icon: 'lucide:fingerprint', color: 'text-amber-600' },
      { name: 'Transition', icon: 'lucide:git-commit-horizontal', color: 'text-indigo-600' },
      { name: 'Audit', icon: 'lucide:clock-3', color: 'text-slate-600' },
    ],
    columns: [
      col('id', 'Identity', 10, 'hidden', { icon: 'lucide:hash' }),
      col('opportunity_id', 'Identity', 20, 'lookup', {
        searchRole: 'basic',
        icon: 'lucide:target',
      }),
      col('from_stage_code', 'Transition', 30, 'lookup', {
        searchRole: 'advanced',
        icon: 'lucide:circle-dashed',
      }),
      col('to_stage_code', 'Transition', 40, 'lookup', {
        searchRole: 'basic',
        icon: 'lucide:circle-dot',
      }),
      col('changed_by', 'Audit', 50, 'lookup', { icon: 'lucide:user' }),
      col('changed_at', 'Audit', 60, 'datetime', {
        searchRole: 'advanced',
        icon: 'lucide:clock',
      }),
    ],
    associations: [
      assoc('opportunity', 'Opportunity', 'lookup', {
        attachedFields: [{ sourceColumn: 'title', as: 'opportunity_id_title' }],
      }),
      assoc('fromStage', 'From stage', 'select', {
        baseInfoCategoryTitle: 'Pipeline Stages',
        attachedFields: [{ sourceColumn: 'title', as: 'from_stage_code_title' }],
      }),
      assoc('toStage', 'To stage', 'select', {
        baseInfoCategoryTitle: 'Pipeline Stages',
        attachedFields: [{ sourceColumn: 'title', as: 'to_stage_code_title' }],
      }),
      assoc('changedByUser', 'Changed by', 'lookup', {
        attachedFields: [{ sourceColumn: 'username', as: 'changed_by_username' }],
      }),
    ],
  },
  {
    objectName: 'crm_activities',
    tags: ['crm', 'activity'],
    story: ACTIVITIES_STORY,
    groups: [
      { name: 'Identity', icon: 'lucide:fingerprint', color: 'text-violet-600' },
      { name: 'Content', icon: 'lucide:pen-line', color: 'text-indigo-600' },
      { name: 'Schedule', icon: 'lucide:calendar-clock', color: 'text-amber-600' },
      { name: 'Audit', icon: 'lucide:clock-3', color: 'text-slate-600' },
    ],
    columns: [
      col('id', 'Identity', 10, 'hidden', { icon: 'lucide:hash' }),
      col('customer_user_id', 'Identity', 20, 'lookup', {
        searchRole: 'basic',
        required: true,
        icon: 'lucide:contact',
      }),
      col('opportunity_id', 'Identity', 30, 'lookup', {
        searchRole: 'advanced',
        icon: 'lucide:target',
      }),
      col('activity_type_code', 'Identity', 40, 'lookup', {
        searchRole: 'basic',
        required: true,
        icon: 'lucide:shapes',
      }),
      col('subject', 'Content', 50, 'text', {
        searchRole: 'basic',
        required: true,
        icon: 'lucide:type',
        formWidgetProps: { maxLength: 200 },
      }),
      col('note', 'Content', 60, 'multiline', {
        searchRole: 'advanced',
        icon: 'lucide:align-left',
        formWidgetProps: { rows: 3 },
      }),
      col('due_at', 'Schedule', 70, 'datetime', {
        searchRole: 'advanced',
        icon: 'lucide:calendar-clock',
        interfaceNotes: 'Set when activity_type=task.',
      }),
      col('completed_at', 'Schedule', 80, 'datetime', {
        searchRole: 'advanced',
        icon: 'lucide:calendar-check',
      }),
      col('owner_id', 'Schedule', 90, 'lookup', {
        searchRole: 'basic',
        icon: 'lucide:user-cog',
      }),
      col('created_by', 'Audit', 100, 'lookup', { icon: 'lucide:user' }),
      col('created_at', 'Audit', 110, 'datetime', { icon: 'lucide:clock' }),
      col('updated_by', 'Audit', 120, 'lookup', { icon: 'lucide:user-pen' }),
      col('updated_at', 'Audit', 130, 'datetime', { icon: 'lucide:clock' }),
    ],
    associations: [
      assoc('customer', 'Customer', 'lookup', {
        icon: 'lucide:contact',
        attachedFields: [{ sourceColumn: 'username', as: 'customer_user_id_username' }],
      }),
      assoc('customerProfile', 'Customer profile', 'lookup', {
        icon: 'lucide:id-card',
        attachedFields: [
          { sourceColumn: 'firstname', as: 'customer_user_id_firstname' },
          { sourceColumn: 'lastname', as: 'customer_user_id_lastname' },
          { sourceColumn: 'nickname', as: 'customer_user_id_nickname' },
          { sourceColumn: 'company_name', as: 'customer_user_id_company_name' },
        ],
      }),
      assoc('opportunity', 'Opportunity', 'lookup', {
        icon: 'lucide:target',
        attachedFields: [{ sourceColumn: 'title', as: 'opportunity_id_title' }],
      }),
      assoc('activity_type', 'Activity type', 'buttonGroup', {
        icon: 'lucide:shapes',
        baseInfoCategoryTitle: 'Activity Types',
        attachedFields: [{ sourceColumn: 'title', as: 'activity_type_code_title' }],
      }),
      assoc('owner', 'Owner', 'lookup', {
        icon: 'lucide:user-cog',
        attachedFields: [{ sourceColumn: 'username', as: 'owner_id_username' }],
      }),
      assoc('createdByUser', 'Created by', 'lookup', {
        icon: 'lucide:user',
        attachedFields: [{ sourceColumn: 'username', as: 'created_by_username' }],
      }),
      assoc('updatedByUser', 'Updated by', 'lookup', {
        icon: 'lucide:user-pen',
        attachedFields: [{ sourceColumn: 'username', as: 'updated_by_username' }],
      }),
    ],
  },
  {
    objectName: 'crm_tickets',
    tags: ['crm', 'ticket'],
    story: TICKETS_STORY,
    groups: [
      { name: 'Identity', icon: 'lucide:fingerprint', color: 'text-rose-600' },
      { name: 'Triage', icon: 'lucide:list-checks', color: 'text-indigo-600' },
      { name: 'Timing', icon: 'lucide:calendar-clock', color: 'text-amber-600' },
      { name: 'Audit', icon: 'lucide:clock-3', color: 'text-slate-600' },
    ],
    columns: [
      col('id', 'Identity', 10, 'hidden', { icon: 'lucide:hash' }),
      col('customer_user_id', 'Identity', 20, 'lookup', {
        searchRole: 'basic',
        required: true,
        icon: 'lucide:contact',
      }),
      col('subject', 'Identity', 30, 'text', {
        searchRole: 'basic',
        required: true,
        icon: 'lucide:type',
        formWidgetProps: { maxLength: 200 },
      }),
      col('status_code', 'Triage', 40, 'lookup', {
        searchRole: 'basic',
        required: true,
        icon: 'lucide:circle-dot',
      }),
      col('priority_code', 'Triage', 50, 'lookup', {
        searchRole: 'basic',
        required: true,
        icon: 'lucide:flag',
      }),
      col('channel_code', 'Triage', 60, 'lookup', {
        searchRole: 'advanced',
        icon: 'lucide:radio',
      }),
      col('assigned_to', 'Triage', 70, 'lookup', {
        searchRole: 'basic',
        icon: 'lucide:user-cog',
      }),
      col('opened_at', 'Timing', 80, 'datetime', {
        searchRole: 'advanced',
        icon: 'lucide:calendar-plus',
      }),
      col('closed_at', 'Timing', 90, 'datetime', {
        icon: 'lucide:calendar-check',
        interfaceNotes: 'Server-maintained on close.',
      }),
      col('created_by', 'Audit', 100, 'lookup', { icon: 'lucide:user' }),
      col('created_at', 'Audit', 110, 'datetime', { icon: 'lucide:clock' }),
      col('updated_by', 'Audit', 120, 'lookup', { icon: 'lucide:user-pen' }),
      col('updated_at', 'Audit', 130, 'datetime', { icon: 'lucide:clock' }),
    ],
    associations: [
      assoc('customer', 'Customer', 'lookup', {
        icon: 'lucide:contact',
        attachedFields: [{ sourceColumn: 'username', as: 'customer_user_id_username' }],
      }),
      assoc('customerProfile', 'Customer profile', 'lookup', {
        icon: 'lucide:id-card',
        attachedFields: [
          { sourceColumn: 'firstname', as: 'customer_user_id_firstname' },
          { sourceColumn: 'lastname', as: 'customer_user_id_lastname' },
          { sourceColumn: 'nickname', as: 'customer_user_id_nickname' },
          { sourceColumn: 'company_name', as: 'customer_user_id_company_name' },
        ],
      }),
      assoc('status', 'Status', 'select', {
        icon: 'lucide:circle-dot',
        baseInfoCategoryTitle: 'Ticket Status',
        attachedFields: [{ sourceColumn: 'title', as: 'status_code_title' }],
      }),
      assoc('priority', 'Priority', 'buttonGroup', {
        icon: 'lucide:flag',
        baseInfoCategoryTitle: 'Ticket Priority',
        attachedFields: [{ sourceColumn: 'title', as: 'priority_code_title' }],
      }),
      assoc('channel', 'Channel', 'select', {
        icon: 'lucide:radio',
        baseInfoCategoryTitle: 'Ticket Channel',
        attachedFields: [{ sourceColumn: 'title', as: 'channel_code_title' }],
      }),
      assoc('assignedToUser', 'Assigned to', 'lookup', {
        icon: 'lucide:user-cog',
        attachedFields: [{ sourceColumn: 'username', as: 'assigned_to_username' }],
      }),
      assoc('createdByUser', 'Created by', 'lookup', {
        icon: 'lucide:user',
        attachedFields: [{ sourceColumn: 'username', as: 'created_by_username' }],
      }),
      assoc('updatedByUser', 'Updated by', 'lookup', {
        icon: 'lucide:user-pen',
        attachedFields: [{ sourceColumn: 'username', as: 'updated_by_username' }],
      }),
      assoc('messages', 'Messages', 'relatedGrid', { icon: 'lucide:message-square' }),
    ],
  },
  {
    objectName: 'crm_ticket_messages',
    tags: ['crm', 'ticket', 'message'],
    story: MESSAGES_STORY,
    groups: [
      { name: 'Message', icon: 'lucide:message-square', color: 'text-orange-600' },
    ],
    columns: [
      col('id', 'Message', 10, 'hidden', { icon: 'lucide:hash' }),
      col('ticket_id', 'Message', 20, 'lookup', {
        searchRole: 'basic',
        required: true,
        icon: 'lucide:life-buoy',
      }),
      col('author_id', 'Message', 30, 'lookup', {
        searchRole: 'basic',
        icon: 'lucide:user',
        developerNotes: 'null = customer message (customer_user_id on the ticket); non-null = agent (base_users).',
      }),
      col('body', 'Message', 40, 'multiline', {
        searchRole: 'advanced',
        required: true,
        icon: 'lucide:message-square',
        formWidgetProps: { rows: 4 },
      }),
      col('created_at', 'Message', 50, 'datetime', {
        searchRole: 'advanced',
        icon: 'lucide:clock',
      }),
    ],
    associations: [
      assoc('ticket', 'Ticket', 'lookup', {
        attachedFields: [{ sourceColumn: 'subject', as: 'ticket_id_subject' }],
      }),
      assoc('author', 'Author', 'lookup', {
        attachedFields: [{ sourceColumn: 'username', as: 'author_id_username' }],
      }),
    ],
  },
];

const findAssociation = (
  associations: ReadonlyArray<EdgeModelAssociation>,
  as: string,
): EdgeModelAssociation | undefined => associations.find((entry) => entry.as === as);

const baseInfoTargetFilter = (categoryId: string): RelationTargetFilterCondition[] => ([
  { column: 'parent_id', op: 'eq', value: categoryId },
  { column: 'is_active', op: 'eq', value: 'true' },
]);

const toColumnMeta = (seed: ColumnSeed): EdgeModelStudioColumnMeta => {
  const row: EdgeModelStudioColumnMeta = {
    columnName: seed.columnName,
    group: seed.group,
    sortOrder: seed.sortOrder,
    formWidget: seed.formWidget,
  };
  if (seed.formWidgetProps) row.formWidgetProps = seed.formWidgetProps;
  if (seed.searchRole) row.searchRole = seed.searchRole;
  if (seed.required) row.required = true;
  if (seed.icon) row.icon = seed.icon;
  if (seed.developerNotes) row.developerNotes = seed.developerNotes;
  if (seed.interfaceNotes) row.interfaceNotes = seed.interfaceNotes;
  return row;
};

const buildStudioMetaInput = (
  seed: ModelStudioSeed,
  model: EdgeModelDefinition,
  categoryIdByTitle: Map<string, string>,
): UpsertEdgeModelStudioMetaInput => {
  const associationMeta: EdgeModelStudioAssociationMeta[] = [];
  for (const entry of seed.associations) {
    const association = findAssociation(model.associations, entry.as);
    if (!association) {
      throw new Error(`CRM studio-meta: association as="${entry.as}" missing on ${seed.objectName}`);
    }
    const row: EdgeModelStudioAssociationMeta = {
      relationKey: association.id,
      displayLabel: entry.displayLabel,
      formWidget: entry.formWidget,
    };
    if (entry.icon) row.icon = entry.icon;
    if (entry.attachedFields?.length) row.attachedFields = entry.attachedFields;
    if (entry.baseInfoCategoryTitle) {
      const categoryId = categoryIdByTitle.get(entry.baseInfoCategoryTitle);
      if (!categoryId) {
        throw new Error(`CRM studio-meta: Base Info category "${entry.baseInfoCategoryTitle}" not seeded`);
      }
      row.targetFilter = baseInfoTargetFilter(categoryId);
    }
    associationMeta.push(row);
  }

  const presentation: Record<string, { icon: string; color: string }> = {};
  for (const group of seed.groups) {
    presentation[group.name] = { icon: group.icon, color: group.color };
  }

  return {
    tags: seed.tags,
    columnMeta: seed.columns.map(toColumnMeta),
    associationMeta,
    extensions: {
      [STORY_KEY]: seed.story.trim(),
      [GROUP_ORDER_KEY]: seed.groups.map((group) => group.name),
      [GROUP_PRESENTATION_KEY]: presentation,
    },
  };
};

export type CrmStudioMetaSeedResult = {
  models: Array<{
    objectName: string;
    edgeModelId: string;
    columnMetaCount: number;
    associationMetaCount: number;
    groupCount: number;
  }>;
};

/** Apply studio-meta for all CRM edge models using resolved Base Info category ids. */
export const seedCrmStudioMeta = async (
  edgeModelService: EdgeModelService,
  modelsByName: Map<string, EdgeModelDefinition>,
  baseInfoSeed: CrmBaseInfoSeedResult,
): Promise<CrmStudioMetaSeedResult> => {
  const categoryIdByTitle = new Map(
    baseInfoSeed.categories.map((category) => [category.title, category.id]),
  );

  const models: CrmStudioMetaSeedResult['models'] = [];

  for (const seed of CRM_STUDIO_META_SEEDS) {
    const live = modelsByName.get(seed.objectName);
    if (!live) {
      throw new Error(`CRM studio-meta: edge model missing for ${seed.objectName}`);
    }

    const input = buildStudioMetaInput(seed, live, categoryIdByTitle);
    edgeModelService.upsertStudioMeta(live.id, input);
    models.push({
      objectName: seed.objectName,
      edgeModelId: live.id,
      columnMetaCount: input.columnMeta?.length ?? 0,
      associationMetaCount: input.associationMeta?.length ?? 0,
      groupCount: seed.groups.length,
    });
  }

  return { models };
};
