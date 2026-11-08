/**
 * CMS Phase 1 — seed Data Studio studio-meta (groups, widgets, stories, associationMeta).
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
} from '../../../shared/api/contracts/data-api';
import type { EdgeModelService } from '../../services/data-api/edgeModelService';
import type { CmsBaseInfoSeedResult } from './seedCmsBaseInfo';

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
  /** Base Info category title under CMS root — resolved to parent_id at seed time. */
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

const CMS_CONTENTS_STORY = `## Purpose

\`cms_contents\` is the single editorial unit of the CMS package: one row holds the **current** title, summary, body, SEO, type, language, format, slug, and status. Public readers always read from this row when status is Published — never from revisions.

## Lifecycle

1. **Create** — usually \`status = Draft\`. Set \`content_type\`, \`language\`, \`slug\`, \`body_format\`, and editorial fields. Audit (\`created_*\`) is set by the server.
2. **Edit** — writers always mutate current columns on this row. Before replacing \`title\` / \`summary\` / \`body\` on a meaningful save (or explicit checkpoint), the previous triple is snapshotted into \`cms_content_revisions\` with the next \`revision_no\`.
3. **Publish** — set \`status = Published\`, stamp \`published_at\`, and update \`status_code_updated_at\` / \`status_code_updated_by\`. SEO and \`body_format\` stay on this row (not copied into revisions).
4. **Archive / unpublish** — change status only (+ status audit fields). History and assets remain.
5. **Restore** — copy \`title\` / \`summary\` / \`body\` from a revision back onto this row; optionally snapshot the pre-restore text first. Do not overwrite SEO or \`body_format\` from revision (revisions do not store them).

## Identity & language

- \`(language_code, slug)\` is unique. Slug is a Latin URL segment (\`LATIN_SLUG_RE\`).
- Another language is **another content row** (optional duplicate), not an i18n overlay on the same id.
- \`content_type\` is an intent label (Article / News / Announcement / Gallery / Comment / **Page** / **Fragment**) — it does **not** change schema or open a different form. Comment rows set \`parent_content_id\` to the parent editorial content. Page rows are public site routes. Fragment rows are reusable chrome/home pieces (\`site-brand\`, \`slide-*\`, …).

## Tags, assets, related, comments

- Tags attach via \`cms_content_tags\` to Base Info items under **CMS / Content Tags**.
- Files live only in \`cms_content_assets\` (bytes in DB); not as content types.
- Related contents are an undirected self-M2M through \`cms_content_relations\` (\`relatedContents\`). Persist normalized \`content_id_a < content_id_b\`.
- \`comments_enabled\` / \`comments_policy_code\` / \`comments_body_format_code\` are **nullable overrides** on editorial rows; \`NULL\` means inherit from the singleton \`cms_settings\` row. Effective value = \`content.override ?? settings.default\`.
- Submitted comments are **child rows** in this same table (\`content_type = Comment\`, \`parent_content_id\` set). Moderation uses shared Statuses (\`in_review\` awaiting / \`published\` approved / \`rejected\`).

## Rules of thumb

- Prefer Archive over hard-delete.
- No per-type custom fields / EAV / shortcodes.
- Operator-only notes use \`operator_note\` (never shown publicly).
`;

const CMS_REVISIONS_STORY = `## Purpose

Append-only **history** of editorial text. Each row is a snapshot of \`title\` / \`summary\` / \`body\` taken immediately before those fields change on \`cms_contents\` (meaningful save or checkpoint). Not an autosave stream.

## Lifecycle

1. **Checkpoint** — before a meaningful save, the service inserts the previous triple with the next \`revision_no\` for that \`content_id\`, then writes the new text onto \`cms_contents\`.
2. **Restore** — copy snapshot fields back to the current content row; optionally checkpoint the live text first so restore is reversible.
3. **Cascade** — deleting the parent content deletes its revisions.

## Rules

- \`revision_no\` increases per \`content_id\` (unique pair).
- Do **not** store SEO, \`body_format_code\`, status, slug, or assets here.
- Restore copies snapshot fields back to \`cms_contents\` current columns; optionally snapshot the live text first.
- Rows are not edited in place; new edits create new revision rows.
- Deleting a content cascades revisions.
`;

const CMS_ASSETS_STORY = `## Purpose

Binary attachments for a single content row. **Database bytes are the source of truth** (\`file\`, optional \`file_xs\`). Disk cache is a disposable runtime hydrate on first use (key ≈ \`asset_id\` + \`sha256\`).

## Lifecycle

1. **Upload** — insert under \`content_id\`; store bytes in \`file\` (and \`file_xs\` when a thumbnail is generated); compute \`sha256\`, mime, size, name.
2. **Replace** — overwrite bytes and metadata in place; the new hash invalidates disk cache.
3. **Reorder** — change \`sort_order\` only; peers stay on the same content.
4. **Delete** — remove the row (and cached files); does not delete the parent content.

## Rules

- Always tied to \`content_id\`. No global media library and no “Media” content type.
- \`sort_order\` defines gallery / attachment order.
- \`sha256\` detects change and invalidates cache.
- No \`kind\` discriminator — all files for a content are peers ordered by \`sort_order\`.
- Upload / replace recomputes size, mime, name, hash, and timestamps.
`;

const CMS_TAGS_STORY = `## Purpose

Composite junction between a content row and a Base Info tag item under **CMS / Content Tags**. There is no \`cms_tags\` table.

## Rules

- PK = (\`content_id\`, \`tag_code\`).
- \`tag_code\` stores \`base_info.id\` of the tag item (not shortName alone).
- Filtering “has all tags” = AND joins on this table.
- Tag vocabulary is managed in Base Info; this table only attaches.
`;

const CMS_RELATIONS_STORY = `## Purpose

Undirected “related content” edges. One row links two \`cms_contents\` ids. Reading related for X = rows where \`content_id_a = X\` OR \`content_id_b = X\`.

## Rules

- Surrogate \`id\` PK; **UNIQUE** (\`content_id_a\`, \`content_id_b\`).
- Always normalize on write: \`content_id_a < content_id_b\`.
- Forbid self-links (\`a ≠ b\`) — enforced by check + app logic.
- Do **not** model two directional associations; edge model uses one self-M2M \`relatedContents\` on contents.
- Optional \`note\` is operator-internal.
- Deleting a content removes edges touching that id.
`;

const CMS_SETTINGS_STORY = `## Purpose

Singleton domain settings row (\`id\` is always \`1\`) — global defaults for comment policy and public read cache TTL. The **Settings** page in the CMS portal edits this row; it is not a Base Info vocabulary and not a platform Settings Attribute.

## Lifecycle

1. **Get-or-create** — first read ensures \`id = 1\` exists with package defaults.
2. **Edit** — Settings page PATCHes this row only. Changing defaults does **not** rewrite existing content override columns.
3. **Effective comments** — public/studio comment UI uses \`content.override ?? settings.default\` for enabled / policy / body format.

## Rules

- Exactly one row (\`id = 1\`); API/UI must get-or-create only \`id=1\`, never insert a second row.
- \`comments_enabled\` / \`comments_policy_code\` / \`comments_body_format_code\` are the **global defaults** that \`cms_contents\`'s nullable override columns fall back to.
- \`public_cache_ttl_seconds\` is the TTL used by public read Server Functions (\`cms_contents\` list/getOne).
`;

export const CMS_STUDIO_META_SEEDS: ModelStudioSeed[] = [
  {
    objectName: 'cms_contents',
    tags: ['cms', 'content'],
    story: CMS_CONTENTS_STORY,
    groups: [
      { name: 'Identity', icon: 'lucide:fingerprint', color: 'text-sky-600' },
      { name: 'Editorial', icon: 'lucide:pen-line', color: 'text-indigo-600' },
      { name: 'SEO', icon: 'lucide:search', color: 'text-emerald-700' },
      { name: 'Comments', icon: 'lucide:message-square', color: 'text-violet-600' },
      { name: 'Status & publish', icon: 'lucide:badge-check', color: 'text-amber-600' },
      { name: 'Audit', icon: 'lucide:clock-3', color: 'text-slate-600' },
    ],
    columns: [
      col('id', 'Identity', 10, 'hidden', { icon: 'lucide:hash' }),
      col('content_type_code', 'Identity', 20, 'lookup', { searchRole: 'basic', required: true, icon: 'lucide:shapes' }),
      col('language_code', 'Identity', 30, 'lookup', { searchRole: 'basic', required: true, icon: 'lucide:languages' }),
      col('slug', 'Identity', 40, 'text', {
        searchRole: 'basic',
        required: true,
        icon: 'lucide:link',
        formWidgetProps: { maxLength: 180 },
        developerNotes: 'Latin slug; unique with language_code (LATIN_SLUG_RE).',
      }),
      col('title', 'Editorial', 50, 'text', {
        searchRole: 'basic',
        required: true,
        icon: 'lucide:type',
        formWidgetProps: { maxLength: 300 },
      }),
      col('summary', 'Editorial', 60, 'multiline', {
        searchRole: 'advanced',
        icon: 'lucide:align-left',
        formWidgetProps: { rows: 3 },
      }),
      col('body_format_code', 'Editorial', 70, 'lookup', {
        searchRole: 'basic',
        required: true,
        icon: 'lucide:file-code',
        interfaceNotes: 'plain / markdown / html',
      }),
      col('body', 'Editorial', 80, 'markdown', {
        searchRole: 'advanced',
        icon: 'lucide:file-text',
        formWidgetProps: { rows: 12 },
      }),
      col('operator_note', 'Editorial', 90, 'multiline', {
        icon: 'lucide:sticky-note',
        formWidgetProps: { rows: 2 },
        interfaceNotes: 'Internal operator note — never shown publicly.',
      }),
      col('seo_title', 'SEO', 100, 'text', {
        searchRole: 'advanced',
        icon: 'lucide:heading',
        formWidgetProps: { maxLength: 200 },
      }),
      col('seo_note', 'SEO', 110, 'multiline', {
        icon: 'lucide:text',
        formWidgetProps: { rows: 3 },
      }),
      col('comments_enabled', 'Comments', 112, 'checkbox', {
        icon: 'lucide:messages-square',
        interfaceNotes: 'NULL = inherit global default from cms_settings.',
      }),
      col('comments_policy_code', 'Comments', 114, 'lookup', {
        icon: 'lucide:shield-check',
        interfaceNotes: 'NULL = inherit global default.',
      }),
      col('comments_body_format_code', 'Comments', 116, 'lookup', {
        icon: 'lucide:file-code-2',
        interfaceNotes: 'plain / html only; NULL = inherit global default.',
      }),
      col('parent_content_id', 'Comments', 118, 'lookup', {
        icon: 'lucide:corner-down-right',
        interfaceNotes: 'Set for content_type=comment rows — parent editorial content.',
      }),
      col('author_display_name', 'Comments', 119, 'text', {
        searchRole: 'basic',
        icon: 'lucide:user',
        interfaceNotes: 'Guest author display name on comment rows.',
      }),
      col('author_email', 'Comments', 120, 'text', {
        icon: 'lucide:mail',
        interfaceNotes: 'Guest author email on comment rows.',
      }),
      col('moderated_by', 'Comments', 122, 'lookup', { icon: 'lucide:user-cog' }),
      col('moderated_at', 'Comments', 124, 'datetime', { icon: 'lucide:calendar-clock' }),
      col('status_code', 'Status & publish', 130, 'lookup', {
        searchRole: 'basic',
        required: true,
        icon: 'lucide:circle-dot',
      }),
      col('published_at', 'Status & publish', 140, 'datetime', {
        searchRole: 'advanced',
        icon: 'lucide:calendar-check',
      }),
      col('status_code_updated_at', 'Status & publish', 150, 'datetime', { icon: 'lucide:calendar-clock' }),
      col('status_code_updated_by', 'Status & publish', 160, 'lookup', { icon: 'lucide:user-cog' }),
      col('created_by', 'Audit', 170, 'lookup', { icon: 'lucide:user' }),
      col('created_at', 'Audit', 180, 'datetime', { icon: 'lucide:clock' }),
      col('updated_by', 'Audit', 190, 'lookup', { icon: 'lucide:user-pen' }),
      col('updated_at', 'Audit', 200, 'datetime', { icon: 'lucide:clock' }),
    ],
    associations: [
      assoc('revisions', 'Revisions', 'relatedGrid', { icon: 'lucide:history' }),
      assoc('assets', 'Assets', 'relatedGrid', { icon: 'lucide:paperclip' }),
      assoc('tags', 'Tags', 'relatedGrid', { icon: 'lucide:tags' }),
      assoc('relatedContents', 'Related contents', 'tagsList', {
        icon: 'lucide:git-branch',
        attachedFields: [
          { sourceColumn: 'title', as: 'related_title' },
          { sourceColumn: 'slug', as: 'related_slug' },
        ],
      }),
      assoc('childContents', 'Child comments', 'relatedGrid', { icon: 'lucide:message-square' }),
      assoc('parentContent', 'Parent content', 'lookup', {
        icon: 'lucide:corner-down-right',
        attachedFields: [
          { sourceColumn: 'title', as: 'parent_content_id_title' },
          { sourceColumn: 'slug', as: 'parent_content_id_slug' },
        ],
      }),
      assoc('content_type', 'Content type', 'select', {
        icon: 'lucide:shapes',
        baseInfoCategoryTitle: 'Content Types',
        attachedFields: [
          { sourceColumn: 'title', as: 'content_type_code_title' },
          { sourceColumn: 'ui_html', as: 'content_type_code_ui_html' },
        ],
      }),
      assoc('language', 'Language', 'select', {
        icon: 'lucide:languages',
        baseInfoCategoryTitle: 'Languages',
        attachedFields: [{ sourceColumn: 'title', as: 'language_code_title' }],
      }),
      assoc('status', 'Status', 'select', {
        icon: 'lucide:circle-dot',
        baseInfoCategoryTitle: 'Statuses',
        attachedFields: [
          { sourceColumn: 'title', as: 'status_code_title' },
          { sourceColumn: 'ui_html', as: 'status_code_ui_html' },
        ],
      }),
      assoc('body_format', 'Body format', 'buttonGroup', {
        icon: 'lucide:file-code',
        baseInfoCategoryTitle: 'Body Formats',
        attachedFields: [
          { sourceColumn: 'title', as: 'body_format_code_title' },
          { sourceColumn: 'short_name', as: 'body_format_code_short_name' },
        ],
      }),
      assoc('comments_policy', 'Comments policy', 'select', {
        icon: 'lucide:shield-check',
        baseInfoCategoryTitle: 'Comment Policies',
        attachedFields: [{ sourceColumn: 'title', as: 'comments_policy_code_title' }],
      }),
      assoc('comments_body_format', 'Comments body format', 'buttonGroup', {
        icon: 'lucide:file-code-2',
        baseInfoCategoryTitle: 'Body Formats',
        attachedFields: [{ sourceColumn: 'title', as: 'comments_body_format_code_title' }],
      }),
      assoc('statusUpdatedBy', 'Status updated by', 'lookup', {
        icon: 'lucide:user-cog',
        attachedFields: [{ sourceColumn: 'username', as: 'status_code_updated_by_username' }],
      }),
      assoc('createdByUser', 'Created by', 'lookup', {
        icon: 'lucide:user',
        attachedFields: [{ sourceColumn: 'username', as: 'created_by_username' }],
      }),
      assoc('updatedByUser', 'Updated by', 'lookup', {
        icon: 'lucide:user-pen',
        attachedFields: [{ sourceColumn: 'username', as: 'updated_by_username' }],
      }),
      assoc('moderatedByUser', 'Moderated by', 'lookup', {
        attachedFields: [{ sourceColumn: 'username', as: 'moderated_by_username' }],
      }),
    ],
  },
  {
    objectName: 'cms_content_revisions',
    tags: ['cms', 'revision'],
    story: CMS_REVISIONS_STORY,
    groups: [
      { name: 'Identity', icon: 'lucide:fingerprint', color: 'text-amber-600' },
      { name: 'Snapshot', icon: 'lucide:file-stack', color: 'text-indigo-600' },
      { name: 'Audit', icon: 'lucide:clock-3', color: 'text-slate-600' },
    ],
    columns: [
      col('id', 'Identity', 10, 'hidden', { icon: 'lucide:hash' }),
      col('content_id', 'Identity', 20, 'lookup', { searchRole: 'basic', icon: 'lucide:newspaper' }),
      col('revision_no', 'Identity', 30, 'number', { searchRole: 'basic', icon: 'lucide:list-ordered' }),
      col('title', 'Snapshot', 40, 'text', { searchRole: 'basic', icon: 'lucide:type' }),
      col('summary', 'Snapshot', 50, 'multiline', { searchRole: 'advanced', icon: 'lucide:align-left' }),
      col('body', 'Snapshot', 60, 'markdown', { icon: 'lucide:file-text' }),
      col('created_by', 'Audit', 70, 'lookup', { icon: 'lucide:user' }),
      col('created_at', 'Audit', 80, 'datetime', { searchRole: 'advanced', icon: 'lucide:clock' }),
    ],
    associations: [
      assoc('content', 'Content', 'lookup', {
        attachedFields: [
          { sourceColumn: 'title', as: 'content_id_title' },
          { sourceColumn: 'slug', as: 'content_id_slug' },
        ],
      }),
      assoc('createdByUser', 'Created by', 'lookup', {
        attachedFields: [{ sourceColumn: 'username', as: 'created_by_username' }],
      }),
    ],
  },
  {
    objectName: 'cms_content_assets',
    tags: ['cms', 'asset'],
    story: CMS_ASSETS_STORY,
    groups: [
      { name: 'Identity', icon: 'lucide:fingerprint', color: 'text-violet-600' },
      { name: 'File', icon: 'lucide:file', color: 'text-indigo-600' },
      { name: 'Audit', icon: 'lucide:clock-3', color: 'text-slate-600' },
    ],
    columns: [
      col('id', 'Identity', 10, 'hidden', { icon: 'lucide:hash' }),
      col('content_id', 'Identity', 20, 'lookup', { searchRole: 'basic', icon: 'lucide:newspaper' }),
      col('sort_order', 'Identity', 30, 'number', {
        icon: 'lucide:arrow-up-down',
        formWidgetProps: { min: 0 },
      }),
      col('file_name', 'File', 40, 'text', { searchRole: 'basic', icon: 'lucide:file' }),
      col('file_mime', 'File', 50, 'text', { searchRole: 'advanced', icon: 'lucide:badge-info' }),
      col('file_size', 'File', 60, 'number', { icon: 'lucide:gauge', formWidgetProps: { min: 0 } }),
      col('sha256', 'File', 70, 'text', { icon: 'lucide:fingerprint' }),
      col('file', 'File', 80, 'file', { icon: 'lucide:paperclip' }),
      col('file_xs', 'File', 90, 'image', { icon: 'lucide:image' }),
      col('created_by', 'Audit', 100, 'lookup', { icon: 'lucide:user' }),
      col('created_at', 'Audit', 110, 'datetime', { icon: 'lucide:clock' }),
      col('updated_by', 'Audit', 120, 'lookup', { icon: 'lucide:user-pen' }),
      col('updated_at', 'Audit', 130, 'datetime', { icon: 'lucide:clock' }),
    ],
    associations: [
      assoc('content', 'Content', 'lookup', {
        attachedFields: [{ sourceColumn: 'title', as: 'content_id_title' }],
      }),
      assoc('createdByUser', 'Created by', 'lookup', {
        attachedFields: [{ sourceColumn: 'username', as: 'created_by_username' }],
      }),
      assoc('updatedByUser', 'Updated by', 'lookup', {
        attachedFields: [{ sourceColumn: 'username', as: 'updated_by_username' }],
      }),
    ],
  },
  {
    objectName: 'cms_content_tags',
    tags: ['cms', 'tag'],
    story: CMS_TAGS_STORY,
    groups: [
      { name: 'Identity', icon: 'lucide:link-2', color: 'text-emerald-700' },
    ],
    columns: [
      col('content_id', 'Identity', 10, 'lookup', { searchRole: 'basic', icon: 'lucide:newspaper' }),
      col('tag_code', 'Identity', 20, 'lookup', { searchRole: 'basic', icon: 'lucide:tag' }),
    ],
    associations: [
      assoc('content', 'Content', 'lookup', {
        attachedFields: [{ sourceColumn: 'title', as: 'content_id_title' }],
      }),
      assoc('tag', 'Tag', 'typeahead', {
        icon: 'lucide:tag',
        baseInfoCategoryTitle: 'Content Tags',
        attachedFields: [
          { sourceColumn: 'title', as: 'tag_code_title' },
          { sourceColumn: 'ui_html', as: 'tag_code_ui_html' },
        ],
      }),
    ],
  },
  {
    objectName: 'cms_content_relations',
    tags: ['cms', 'relation'],
    story: CMS_RELATIONS_STORY,
    groups: [
      { name: 'Identity', icon: 'lucide:git-branch', color: 'text-rose-600' },
      { name: 'Note', icon: 'lucide:sticky-note', color: 'text-slate-600' },
    ],
    columns: [
      col('id', 'Identity', 10, 'hidden', { icon: 'lucide:hash' }),
      col('content_id_a', 'Identity', 20, 'lookup', { searchRole: 'basic', icon: 'lucide:newspaper' }),
      col('content_id_b', 'Identity', 30, 'lookup', { searchRole: 'basic', icon: 'lucide:newspaper' }),
      col('note', 'Note', 40, 'multiline', { icon: 'lucide:sticky-note' }),
    ],
    associations: [
      assoc('contentA', 'Content A', 'lookup', {
        attachedFields: [
          { sourceColumn: 'title', as: 'content_id_a_title' },
          { sourceColumn: 'slug', as: 'content_id_a_slug' },
        ],
      }),
      assoc('contentB', 'Content B', 'lookup', {
        attachedFields: [
          { sourceColumn: 'title', as: 'content_id_b_title' },
          { sourceColumn: 'slug', as: 'content_id_b_slug' },
        ],
      }),
    ],
  },
  {
    objectName: 'cms_settings',
    tags: ['cms', 'settings'],
    story: CMS_SETTINGS_STORY,
    groups: [
      { name: 'Comments defaults', icon: 'lucide:message-square', color: 'text-violet-600' },
      { name: 'Cache', icon: 'lucide:zap', color: 'text-amber-600' },
      { name: 'Audit', icon: 'lucide:clock-3', color: 'text-slate-600' },
    ],
    columns: [
      col('id', 'Comments defaults', 10, 'hidden', { icon: 'lucide:hash' }),
      col('comments_enabled', 'Comments defaults', 20, 'checkbox', { required: true, icon: 'lucide:messages-square' }),
      col('comments_policy_code', 'Comments defaults', 30, 'lookup', { required: true, icon: 'lucide:shield-check' }),
      col('comments_body_format_code', 'Comments defaults', 40, 'lookup', { required: true, icon: 'lucide:file-code-2' }),
      col('public_cache_ttl_seconds', 'Cache', 50, 'number', {
        required: true,
        icon: 'lucide:timer',
        formWidgetProps: { min: 0 },
        interfaceNotes: 'TTL (seconds) for public read Server Functions.',
      }),
      col('updated_by', 'Audit', 60, 'lookup', { icon: 'lucide:user-pen' }),
      col('updated_at', 'Audit', 70, 'datetime', { icon: 'lucide:clock' }),
    ],
    associations: [
      assoc('comments_policy', 'Comments policy', 'select', {
        icon: 'lucide:shield-check',
        baseInfoCategoryTitle: 'Comment Policies',
        attachedFields: [{ sourceColumn: 'title', as: 'comments_policy_code_title' }],
      }),
      assoc('comments_body_format', 'Comments body format', 'buttonGroup', {
        icon: 'lucide:file-code-2',
        baseInfoCategoryTitle: 'Body Formats',
        attachedFields: [{ sourceColumn: 'title', as: 'comments_body_format_code_title' }],
      }),
      assoc('updatedByUser', 'Updated by', 'lookup', {
        attachedFields: [{ sourceColumn: 'username', as: 'updated_by_username' }],
      }),
    ],
  },
];

const findAssociation = (
  associations: ReadonlyArray<EdgeModelAssociation>,
  as: string,
): EdgeModelAssociation | undefined => associations.find((item) => item.as === as);

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
  for (const item of seed.associations) {
    const association = findAssociation(model.associations, item.as);
    if (!association) {
      throw new Error(`CMS studio-meta: association as="${item.as}" missing on ${seed.objectName}`);
    }
    const row: EdgeModelStudioAssociationMeta = {
      relationKey: association.id,
      displayLabel: item.displayLabel,
      formWidget: item.formWidget,
    };
    if (item.icon) row.icon = item.icon;
    if (item.attachedFields?.length) row.attachedFields = item.attachedFields;
    if (item.baseInfoCategoryTitle) {
      const categoryId = categoryIdByTitle.get(item.baseInfoCategoryTitle);
      if (!categoryId) {
        throw new Error(`CMS studio-meta: Base Info category "${item.baseInfoCategoryTitle}" not seeded`);
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

export type CmsStudioMetaSeedResult = {
  models: Array<{
    objectName: string;
    edgeModelId: string;
    columnMetaCount: number;
    associationMetaCount: number;
    groupCount: number;
  }>;
};

/** Apply studio-meta for all CMS edge models using resolved Base Info category ids. */
export const seedCmsStudioMeta = (
  edgeModelService: EdgeModelService,
  modelsByName: Map<string, EdgeModelDefinition>,
  baseInfoSeed: CmsBaseInfoSeedResult,
): CmsStudioMetaSeedResult => {
  const categoryIdByTitle = new Map(
    baseInfoSeed.categories.map((category) => [category.title, category.id]),
  );

  const models: CmsStudioMetaSeedResult['models'] = [];

  for (const seed of CMS_STUDIO_META_SEEDS) {
    const model = modelsByName.get(seed.objectName);
    if (!model) {
      throw new Error(`CMS studio-meta: edge model missing for ${seed.objectName}`);
    }
    // Re-read after association wiring so association ids are current.
    const fresh = edgeModelService.getStudioMeta
      ? model
      : model;
    const live = modelsByName.get(seed.objectName);
    if (!live) {
      throw new Error(`CMS studio-meta: live model missing for ${seed.objectName}`);
    }

    // Prefer associations from the in-memory map; caller should refresh after wire.
    const input = buildStudioMetaInput(seed, live, categoryIdByTitle);
    edgeModelService.upsertStudioMeta(live.id, input);
    models.push({
      objectName: seed.objectName,
      edgeModelId: live.id,
      columnMetaCount: input.columnMeta?.length ?? 0,
      associationMetaCount: input.associationMeta?.length ?? 0,
      groupCount: seed.groups.length,
    });
    void fresh;
  }

  return { models };
};
