import type {
  DbEnrichmentColumnKnowledge,
  DbEnrichmentConfidenceBasis,
  DbEnrichmentDocumentation,
  DbEnrichmentDocumentationObject,
  DbEnrichmentQuestion,
} from '../../../shared/api/contracts/db-enrichment';
import { ENRICHMENT_QUESTION_KIND_LABEL } from '../components/dataEnrichmentQuestionGridColumns';

const CONFIDENCE_BASIS_LABEL: Record<DbEnrichmentConfidenceBasis, string> = {
  human_authored: 'Human authored',
  human_answered: 'Human answered',
  fk_lookup_sampled: 'Foreign key lookup',
  value_sampled: 'Sampled values',
  name_pattern_only: 'Name pattern only',
  unresolved: 'Unresolved',
};

const QUESTION_STATUS_LABEL: Record<DbEnrichmentQuestion['status'], string> = {
  open: 'Open',
  answered: 'Answered',
  dismissed: 'Dismissed',
};

const escapeHtml = (value: string): string => (
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
);

const slugify = (value: string): string => (
  value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'x'
);

const objectAnchor = (object: Pick<DbEnrichmentDocumentationObject, 'objectType' | 'objectName'>): string => (
  `${object.objectType.toLowerCase()}-${slugify(object.objectName)}`
);

const formatPercent = (value: number | null): string => (
  value === null ? '—' : `${Math.round(value * 100)}%`
);

const formatDateTime = (iso: string): string => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  return date.toLocaleString('en-GB', {
    year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit',
  });
};

const confidenceTone = (value: number | null): 'good' | 'warn' | 'bad' | 'neutral' => {
  if (value === null) return 'neutral';
  if (value >= 0.8) return 'good';
  if (value >= 0.5) return 'warn';
  return 'bad';
};

export const buildDbDocumentationFilename = (
  documentation: DbEnrichmentDocumentation,
  extension: 'html' | 'md',
): string => {
  const datePart = documentation.generatedAt.slice(0, 10);
  return `db-doc-${slugify(documentation.dataSourceName)}-${datePart}.${extension}`;
};

export const downloadTextFile = (content: string, filename: string, mimeType: string): void => {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = 'noopener';
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
};

const TONE_LABEL: Record<ReturnType<typeof confidenceTone>, string> = {
  good: 'High confidence',
  warn: 'Medium confidence',
  bad: 'Low confidence',
  neutral: 'No enrichment yet',
};

/** Plain lowercased text (name + purpose + every column's name/meaning/glossary + relation targets) used to drive the in-page search filter. */
const buildObjectSearchText = (object: DbEnrichmentDocumentationObject): string => {
  const parts = [object.objectName, object.purpose ?? ''];
  for (const column of object.columns) {
    parts.push(column.name, column.dataType, column.meaning ?? '');
    for (const entry of column.valueGlossary ?? []) {
      parts.push(entry.value, entry.meaning);
    }
  }
  for (const relation of object.relations) {
    parts.push(relation.fromColumn, relation.toTable, relation.toColumn, relation.intent);
  }
  return parts.join(' ').toLowerCase();
};

const buildQuestionSearchText = (question: DbEnrichmentQuestion): string => (
  [
    question.objectName,
    question.columnName ?? '',
    ENRICHMENT_QUESTION_KIND_LABEL[question.kind],
    QUESTION_STATUS_LABEL[question.status],
    question.question,
    question.answer ?? '',
  ].join(' ').toLowerCase()
);

const buildHtmlColumnGlossary = (column: { valueGlossary?: DbEnrichmentColumnKnowledge['valueGlossary'] }): string => {
  if (!column.valueGlossary || column.valueGlossary.length === 0) {
    return '';
  }
  const items = column.valueGlossary
    .map((entry) => `<span class="chip"><code>${escapeHtml(entry.value)}</code> ${escapeHtml(entry.meaning)}</span>`)
    .join('');
  return `<div class="glossary">${items}</div>`;
};

const buildHtmlColumnsTable = (object: DbEnrichmentDocumentationObject): string => {
  const rows = object.columns.map((column) => {
    const tone = confidenceTone(column.confidence);
    return `
      <tr>
        <td class="col-name"><code>${escapeHtml(column.name)}</code>${column.isPrimaryKey ? '<span class="pk-badge" title="Primary key">PK</span>' : ''}</td>
        <td class="col-type"><code>${escapeHtml(column.dataType)}</code></td>
        <td class="col-meaning">
          ${column.meaning ? escapeHtml(column.meaning) : '<span class="muted">Not documented yet</span>'}
          ${buildHtmlColumnGlossary(column)}
        </td>
        <td class="col-confidence">
          <div class="confidence-badge tone-${tone}">${formatPercent(column.confidence)}</div>
          ${column.confidenceBasis ? `<div class="basis-label">${escapeHtml(CONFIDENCE_BASIS_LABEL[column.confidenceBasis])}</div>` : ''}
        </td>
      </tr>`;
  }).join('');

  return `
    <div class="table-scroll">
      <table class="columns-table">
        <thead>
          <tr><th>Column</th><th>Type</th><th>Meaning</th><th>Confidence</th></tr>
        </thead>
        <tbody>${rows || '<tr><td colspan="4" class="muted">No columns.</td></tr>'}</tbody>
      </table>
    </div>`;
};

const buildHtmlRelations = (object: DbEnrichmentDocumentationObject): string => {
  if (object.relations.length === 0) {
    return '';
  }
  const items = object.relations
    .map((relation) => (
      `<li><code>${escapeHtml(relation.fromColumn)}</code><span class="arrow">→</span><code>${escapeHtml(relation.toTable)}.${escapeHtml(relation.toColumn)}</code>`
      + `<span class="relation-intent">${escapeHtml(relation.intent)}</span></li>`
    ))
    .join('');
  return `<div class="relations"><h3>Relationships</h3><ul>${items}</ul></div>`;
};

const BACK_TO_LIST_LINK = '<a class="back-link" href="#doc-top">↑ Back to top</a>';

const buildObjectCard = (object: DbEnrichmentDocumentationObject, idLabel: string): string => {
  const tone = confidenceTone(object.confidence);
  const barWidth = object.confidence === null ? 0 : Math.round(object.confidence * 100);
  const kindClass = object.objectType === 'TABLE' ? 'kind-table' : 'kind-view';
  return `
    <article class="item-card ${kindClass}" id="${objectAnchor(object)}" data-object-section data-search="${escapeHtml(buildObjectSearchText(object))}">
      <div class="item-head">
        <span class="item-id">${idLabel}</span>
        <h3 class="item-title">${escapeHtml(object.objectName)}</h3>
        <span class="item-type-badge">${object.objectType}</span>
      </div>
      <p class="item-desc">${object.purpose ? escapeHtml(object.purpose) : '<span class="muted">No documented purpose yet.</span>'}</p>
      <div class="confidence-row" title="${TONE_LABEL[tone]}">
        <div class="confidence-bar"><div class="confidence-bar-fill tone-${tone}" style="width:${barWidth}%"></div></div>
        <span class="pill tone-${tone}">${formatPercent(object.confidence)}</span>
      </div>
      ${buildHtmlColumnsTable(object)}
      ${buildHtmlRelations(object)}
      <div class="item-tags">
        ${object.sourceOfTruth ? `<span class="pill tag-outline">${object.sourceOfTruth}</span>` : ''}
        <span class="pill tag-outline">${object.columns.length} column${object.columns.length === 1 ? '' : 's'}</span>
        ${BACK_TO_LIST_LINK}
      </div>
    </article>`;
};

const buildQuestionCard = (question: DbEnrichmentQuestion, idLabel: string): string => `
    <article class="item-card kind-question" id="q-${question.id}" data-question-row data-search="${escapeHtml(buildQuestionSearchText(question))}">
      <div class="item-head">
        <span class="item-id">${idLabel}</span>
        <h3 class="item-title">${escapeHtml(question.question)}</h3>
      </div>
      <p class="item-desc">
        <code>${escapeHtml(question.objectName)}${question.columnName ? `.${escapeHtml(question.columnName)}` : ''}</code>
        <span class="muted"> · ${escapeHtml(ENRICHMENT_QUESTION_KIND_LABEL[question.kind])}</span>
      </p>
      ${question.reason.length > 0 ? `<ul class="reason-list">${question.reason.map((reason) => `<li>${escapeHtml(reason)}</li>`).join('')}</ul>` : ''}
      ${question.answer ? `<p class="answer-note">${escapeHtml(question.answer)}</p>` : ''}
      <div class="item-tags">
        <span class="pill status-${question.status}">${QUESTION_STATUS_LABEL[question.status]}</span>
        <span class="pill tag-outline">${escapeHtml(ENRICHMENT_QUESTION_KIND_LABEL[question.kind])}</span>
        ${BACK_TO_LIST_LINK}
      </div>
    </article>`;

const buildTier = (params: {
  dotColor: string;
  title: string;
  description: string;
  count: number;
  anchorId?: string;
  bodyHtml: string;
}): string => {
  if (params.count === 0) {
    return '';
  }
  return `
    <section class="tier"${params.anchorId ? ` id="${params.anchorId}"` : ''}>
      <div class="tier-head">
        <span class="tier-dot" style="background:${params.dotColor}"></span>
        <h2>${params.title}</h2>
        <span class="pill tag-outline">${params.count} item${params.count === 1 ? '' : 's'}</span>
      </div>
      <p class="tier-desc">${params.description}</p>
      <div class="item-card-list">${params.bodyHtml}</div>
    </section>`;
};

/** Tree-branch leaves for one group of tables/views — clicking scrolls to that object's card. */
const buildObjectTreeItems = (objects: DbEnrichmentDocumentationObject[]): string => (
  objects.map((object) => {
    const tone = confidenceTone(object.confidence);
    return `
      <li class="tree-item" data-toc-object data-search="${escapeHtml(buildObjectSearchText(object))}">
        <a class="tree-link" href="#${objectAnchor(object)}">
          <span class="tree-dot tone-${tone}" aria-hidden="true"></span>
          <span class="tree-name">${escapeHtml(object.objectName)}</span>
        </a>
      </li>`;
  }).join('')
);

/** Tree-branch leaves for open questions — each links straight to its own card, not just the section. */
const buildQuestionTreeItems = (questions: DbEnrichmentQuestion[]): string => (
  questions.map((question, index) => {
    const tone = question.status === 'open' ? 'warn' : question.status === 'answered' ? 'good' : 'neutral';
    const label = `Q${index + 1} · ${question.objectName}${question.columnName ? `.${question.columnName}` : ''}`;
    return `
      <li class="tree-item" data-toc-object data-search="${escapeHtml(buildQuestionSearchText(question))}">
        <a class="tree-link" href="#q-${question.id}">
          <span class="tree-dot tone-${tone}" aria-hidden="true"></span>
          <span class="tree-name">${escapeHtml(label)}</span>
        </a>
      </li>`;
  }).join('')
);

const buildTreeGroup = (params: { groupColor: string; title: string; count: number; bodyHtml: string }): string => {
  if (params.count === 0) {
    return '';
  }
  return `
    <details class="tree-group" open>
      <summary>
        <span class="tree-group-dot" style="background:${params.groupColor}" aria-hidden="true"></span>
        <span class="tree-group-title">${params.title}</span>
        <span class="tree-group-count">${params.count}</span>
        <span class="tree-chevron" aria-hidden="true"></span>
      </summary>
      <ul class="tree-list">${params.bodyHtml}</ul>
    </details>`;
};

/** Left-rail navigation tree, grouped by subject (Tables / Views / Ambiguities) — each branch collapsible via native <details>. */
const buildSidebarTree = (documentation: DbEnrichmentDocumentation): string => {
  const tableObjects = documentation.objects.filter((object) => object.objectType === 'TABLE');
  const viewObjects = documentation.objects.filter((object) => object.objectType === 'VIEW');
  return [
    buildTreeGroup({ groupColor: 'var(--accent)', title: 'Tables', count: tableObjects.length, bodyHtml: buildObjectTreeItems(tableObjects) }),
    buildTreeGroup({ groupColor: 'var(--accent2)', title: 'Views', count: viewObjects.length, bodyHtml: buildObjectTreeItems(viewObjects) }),
    buildTreeGroup({ groupColor: 'var(--warn)', title: 'Ambiguities', count: documentation.questions.length, bodyHtml: buildQuestionTreeItems(documentation.questions) }),
  ].join('');
};

const buildInlineScript = (): string => `
(function () {
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var input = document.getElementById('search-input');
  var countEl = document.getElementById('search-count');
  var tocItems = Array.prototype.slice.call(document.querySelectorAll('[data-toc-object]'));
  var treeGroups = Array.prototype.slice.call(document.querySelectorAll('.tree-group'));
  var sections = Array.prototype.slice.call(document.querySelectorAll('[data-object-section]'));
  var questionRows = Array.prototype.slice.call(document.querySelectorAll('[data-question-row]'));
  var total = tocItems.length;

  function applyFilter() {
    var query = input ? input.value.trim().toLowerCase() : '';
    var visible = 0;
    tocItems.forEach(function (li) {
      var match = !query || (li.getAttribute('data-search') || '').indexOf(query) !== -1;
      li.style.display = match ? '' : 'none';
      if (match) visible += 1;
    });
    sections.forEach(function (section) {
      var match = !query || (section.getAttribute('data-search') || '').indexOf(query) !== -1;
      section.style.display = match ? '' : 'none';
    });
    questionRows.forEach(function (row) {
      var match = !query || (row.getAttribute('data-search') || '').indexOf(query) !== -1;
      row.style.display = match ? '' : 'none';
    });
    treeGroups.forEach(function (group) {
      var items = Array.prototype.slice.call(group.querySelectorAll('.tree-item'));
      var anyVisible = items.some(function (li) { return li.style.display !== 'none'; });
      group.style.display = anyVisible ? '' : 'none';
    });
    if (countEl) {
      countEl.textContent = query ? (visible + ' / ' + total + ' match' + (visible === 1 ? '' : 'es')) : (total + ' total');
    }
  }

  if (input) {
    input.addEventListener('input', applyFilter);
    document.addEventListener('keydown', function (event) {
      if (event.key === '/' && document.activeElement !== input) {
        event.preventDefault();
        input.focus();
      }
    });
    applyFilter();
  }

  document.addEventListener('click', function (event) {
    var anchor = event.target.closest ? event.target.closest('a[href^="#"]') : null;
    if (!anchor) return;
    var id = anchor.getAttribute('href').slice(1);
    var target = id ? document.getElementById(id) : null;
    if (target) {
      event.preventDefault();
      target.scrollIntoView(reduceMotion ? { block: 'start' } : { block: 'start', behavior: 'smooth' });
    }
  });

  var tocLinks = Array.prototype.slice.call(document.querySelectorAll('.tree-link[href^="#"]'));
  var linkByTarget = {};
  tocLinks.forEach(function (a) { linkByTarget[a.getAttribute('href').slice(1)] = a; });
  var observedSections = Array.prototype.slice.call(document.querySelectorAll('main [id]'));
  if ('IntersectionObserver' in window && observedSections.length) {
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        var link = linkByTarget[entry.target.id];
        if (!link || !entry.isIntersecting) return;
        tocLinks.forEach(function (l) { l.classList.remove('active'); });
        link.classList.add('active');
      });
    }, { rootMargin: '-15% 0px -70% 0px', threshold: 0 });
    observedSections.forEach(function (section) { observer.observe(section); });
  }
})();
`;

/**
 * Self-contained HTML document — inline CSS/JS only, no external assets, so it renders and
 * behaves identically wherever the saved file is opened later (no network required).
 */
export const buildDbDocumentationHtml = (documentation: DbEnrichmentDocumentation): string => {
  const title = `${documentation.dataSourceName} — Database Documentation`;
  const tableObjects = documentation.objects.filter((object) => object.objectType === 'TABLE');
  const viewObjects = documentation.objects.filter((object) => object.objectType === 'VIEW');
  const coverage = documentation.tablesTotal > 0 ? documentation.tablesEnriched / documentation.tablesTotal : null;
  const overallTone = confidenceTone(documentation.overallConfidence);
  const toneVar = (tone: ReturnType<typeof confidenceTone>): string => `var(--${tone})`;

  const tablesTier = buildTier({
    dotColor: 'var(--accent)',
    title: 'Tables',
    description: 'Base tables — the source of truth for this database.',
    count: tableObjects.length,
    bodyHtml: tableObjects.map((object, index) => buildObjectCard(object, `T${index + 1}`)).join(''),
  });
  const viewsTier = buildTier({
    dotColor: 'var(--good)',
    title: 'Views',
    description: 'Derived views built on top of the tables above.',
    count: viewObjects.length,
    bodyHtml: viewObjects.map((object, index) => buildObjectCard(object, `V${index + 1}`)).join(''),
  });
  const questionsTier = buildTier({
    dotColor: 'var(--warn)',
    title: 'Ambiguities & Open Questions',
    description: 'Left unresolved by automatic enrichment — each one needs a human answer.',
    count: documentation.questions.length,
    anchorId: 'open-questions',
    bodyHtml: documentation.questions.map((question, index) => buildQuestionCard(question, `Q${index + 1}`)).join(''),
  });

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<title>${escapeHtml(title)}</title>
<style>
  :root {
    --bg: #ffffff; --surface: #fafaf9; --line: #ebeae5; --ink: #14161a; --ink-soft: #686e78;
    --accent: #3654d6; --accent-soft: #ebeefb; --accent2: #7c3aed; --accent2-soft: #f1eafd;
    --good: #0f8f6c; --good-bg: #e7f5ef; --warn: #b4650d; --warn-bg: #fbeedd; --bad: #d33b2c; --bad-bg: #fbe7e3; --neutral: #7a756b; --neutral-bg: #f0eee8;
    --font-sans: -apple-system, 'Segoe UI', 'Helvetica Neue', Roboto, Arial, sans-serif;
    --font-mono: ui-monospace, 'SF Mono', 'Cascadia Code', Consolas, 'Roboto Mono', monospace;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --bg: #101114; --surface: #1a1c20; --ink: #ece9e2; --ink-soft: #9a978d; --line: #2b2d32;
      --accent: #86a0f2; --accent-soft: #1d2646; --accent2: #b79bf5; --accent2-soft: #271f3d;
      --good: #52c9a0; --good-bg: #12281f; --warn: #e5a957; --warn-bg: #332510; --bad: #ef7a6a; --bad-bg: #3a1d18; --neutral: #a69f91; --neutral-bg: #232019;
    }
  }
  * { box-sizing: border-box; }
  html { scroll-behavior: smooth; }
  @media (prefers-reduced-motion: reduce) { html { scroll-behavior: auto; } }
  body {
    margin: 0; background: var(--bg); color: var(--ink); overflow-x: hidden;
    font-family: var(--font-sans); font-size: 14.5px; line-height: 1.65; font-weight: 440;
  }
  h1, h2, h3 { font-family: var(--font-sans); color: var(--ink); text-wrap: balance; letter-spacing: -0.015em; }
  code { font-family: var(--font-mono); font-size: 0.86em; background: var(--surface); padding: 0.12em 0.4em; border-radius: 5px; overflow-wrap: anywhere; }
  a { color: var(--accent); text-decoration: none; }
  a:hover { text-decoration: underline; }
  a:focus-visible, button:focus-visible, input:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
  .muted { color: var(--ink-soft); }

  .layout { display: grid; grid-template-columns: 272px 1fr; max-width: 1240px; margin: 0 auto; min-height: 100vh; }
  .sidebar {
    position: sticky; top: 0; align-self: start; height: 100vh; overflow-y: auto;
    border-right: 1px solid var(--line); background: var(--surface); padding: 22px 16px; display: flex; flex-direction: column; gap: 16px;
  }
  .brand-row { display: flex; align-items: center; gap: 9px; }
  .brand-mark {
    display: inline-flex; align-items: center; justify-content: center; width: 26px; height: 26px; border-radius: 7px; flex-shrink: 0;
    background: var(--accent); color: var(--bg); font-family: var(--font-mono); font-weight: 700; font-size: 10.5px;
  }
  .brand-name { font-weight: 700; font-size: 13px; line-height: 1.3; overflow-wrap: anywhere; }
  .brand-sub { font-size: 10.5px; color: var(--ink-soft); }
  .sidebar input#search-input {
    width: 100%; font: inherit; font-size: 13px; padding: 8px 10px; border-radius: 8px;
    border: 1px solid var(--line); background: var(--bg); color: var(--ink);
  }
  .sidebar input#search-input::placeholder { color: var(--ink-soft); }
  .search-count { font-size: 10.5px; color: var(--ink-soft); font-variant-numeric: tabular-nums; padding-left: 2px; }

  .tree-group { border: none; }
  .tree-group summary {
    list-style: none; cursor: pointer; display: flex; align-items: center; gap: 8px;
    padding: 6px 6px; border-radius: 6px; font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--ink-soft);
  }
  .tree-group summary::-webkit-details-marker { display: none; }
  .tree-group summary:hover { background: var(--bg); }
  .tree-group-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
  .tree-group-title { flex: 1; }
  .tree-group-count { font-variant-numeric: tabular-nums; }
  .tree-chevron::before { content: '▸'; color: var(--ink-soft); font-size: 10px; }
  .tree-group[open] .tree-chevron::before { content: '▾'; }
  .tree-list { list-style: none; margin: 2px 0 6px; padding: 0 0 0 14px; border-left: 1px solid var(--line); }
  .tree-item { margin: 0; }
  .tree-link { display: flex; align-items: center; gap: 7px; padding: 5px 8px; border-radius: 6px; font-size: 12.5px; color: var(--ink); }
  .tree-link:hover { background: var(--bg); text-decoration: none; }
  .tree-link.active { background: var(--accent-soft); color: var(--accent); font-weight: 600; }
  .tree-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
  .tree-dot.tone-good { background: var(--good); }
  .tree-dot.tone-warn { background: var(--warn); }
  .tree-dot.tone-bad { background: var(--bad); }
  .tree-dot.tone-neutral { background: var(--neutral); }
  .tree-name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

  .doc { max-width: 860px; padding: 48px 48px 110px; overflow-x: hidden; }
  .eyebrow { margin: 0; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: var(--accent); }
  .doc-header h1 { margin: 10px 0 0; font-size: 34px; font-weight: 800; overflow-wrap: anywhere; }
  .intro { max-width: 68ch; margin: 14px 0 0; color: var(--ink-soft); font-size: 15px; overflow-wrap: anywhere; }
  .intro strong { color: var(--ink); font-weight: 700; }

  #overview { margin: 40px 0 0; }
  .stat-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
  .stat-card { border: 1px solid var(--line); border-radius: 8px; padding: 15px 16px; background: var(--surface); }
  .stat-label { font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--ink-soft); margin-bottom: 7px; }
  .stat-value { font-size: 24px; font-weight: 800; font-variant-numeric: tabular-nums; }
  .stat-sub { font-size: 11px; color: var(--ink-soft); margin-top: 4px; }

  .tier { margin: 48px 0 0; }
  .tier-head { display: flex; align-items: center; gap: 10px; }
  .tier-dot { width: 9px; height: 9px; border-radius: 50%; flex-shrink: 0; }
  .tier-head h2 { margin: 0; font-size: 19px; font-weight: 700; }
  .tier-desc { margin: 5px 0 0 19px; color: var(--ink-soft); font-size: 12.5px; }
  .item-card-list { display: flex; flex-direction: column; gap: 14px; margin-top: 16px; }

  .item-card {
    border: 1px solid var(--line); border-left: 3px solid var(--line); border-radius: 8px;
    background: var(--bg); padding: 20px 22px; scroll-margin-top: 76px; overflow-wrap: anywhere;
  }
  .item-card.kind-table { border-left-color: var(--accent); }
  .item-card.kind-view { border-left-color: var(--accent2); }
  .item-card.kind-question { border-left-color: var(--warn); }
  .item-head { display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; margin-bottom: 6px; }
  .item-id { font-family: var(--font-mono); font-size: 11px; font-weight: 700; }
  .kind-table .item-id { color: var(--accent); }
  .kind-view .item-id { color: var(--accent2); }
  .kind-question .item-id { color: var(--warn); }
  .item-title { margin: 0; font-size: 16.5px; font-weight: 700; flex: 1; min-width: 0; }
  .item-type-badge { font-family: var(--font-mono); font-size: 9.5px; font-weight: 700; letter-spacing: 0.03em; padding: 3px 9px; border-radius: 999px; }
  .kind-table .item-type-badge { background: var(--accent-soft); color: var(--accent); }
  .kind-view .item-type-badge { background: var(--accent2-soft); color: var(--accent2); }
  .item-desc { color: var(--ink-soft); max-width: 70ch; margin: 4px 0 14px; font-size: 13px; }
  .back-link { margin-left: auto; font-size: 11px; color: var(--ink-soft); white-space: nowrap; }
  .back-link:hover { color: var(--accent); text-decoration: none; }
  .confidence-row { display: flex; align-items: center; gap: 10px; margin-bottom: 16px; }
  .confidence-bar { flex: 0 0 120px; height: 6px; border-radius: 999px; background: var(--surface); overflow: hidden; }
  .confidence-bar-fill { height: 100%; border-radius: 999px; }
  .confidence-bar-fill.tone-good { background: var(--good); }
  .confidence-bar-fill.tone-warn { background: var(--warn); }
  .confidence-bar-fill.tone-bad { background: var(--bad); }
  .confidence-bar-fill.tone-neutral { background: var(--neutral); }
  .pill { display: inline-block; font-size: 11.5px; font-weight: 700; padding: 3px 10px; border-radius: 999px; font-variant-numeric: tabular-nums; }
  .pill.tone-good { color: var(--good); background: var(--good-bg); }
  .pill.tone-warn { color: var(--warn); background: var(--warn-bg); }
  .pill.tone-bad { color: var(--bad); background: var(--bad-bg); }
  .pill.tone-neutral { color: var(--neutral); background: var(--neutral-bg); }
  .pill.tag-outline { color: var(--ink-soft); background: var(--bg); border: 1px solid var(--line); font-weight: 600; }
  .pill.status-open { color: var(--warn); background: var(--warn-bg); }
  .pill.status-answered { color: var(--good); background: var(--good-bg); }
  .pill.status-dismissed { color: var(--neutral); background: var(--neutral-bg); }
  .item-tags { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; margin-top: 14px; }

  .table-scroll { overflow-x: auto; border: 1px solid var(--line); border-radius: 8px; }
  .columns-table { width: 100%; border-collapse: collapse; min-width: 500px; }
  .columns-table th { text-align: left; font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--ink-soft); background: var(--surface); border-bottom: 1px solid var(--line); padding: 9px 12px; }
  .columns-table td { padding: 11px 12px; border-bottom: 1px solid var(--line); vertical-align: top; overflow-wrap: break-word; }
  .columns-table td code { overflow-wrap: anywhere; }
  .columns-table tbody tr:last-child td { border-bottom: none; }
  .columns-table tbody tr:hover { background: var(--accent-soft); }
  .col-name { white-space: nowrap; }
  .col-confidence { width: 76px; text-align: center; white-space: normal; }
  .pk-badge { margin-left: 6px; font-family: var(--font-mono); font-size: 9.5px; font-weight: 700; color: var(--warn); background: var(--warn-bg); border-radius: 4px; padding: 1px 5px; vertical-align: middle; }
  .confidence-badge {
    display: flex; align-items: center; justify-content: center; margin: 0 auto;
    width: 38px; height: 38px; border-radius: 50%; flex-shrink: 0;
    font-size: 10.5px; font-weight: 700; font-variant-numeric: tabular-nums;
  }
  .confidence-badge.tone-good { color: var(--good); background: var(--good-bg); }
  .confidence-badge.tone-warn { color: var(--warn); background: var(--warn-bg); }
  .confidence-badge.tone-bad { color: var(--bad); background: var(--bad-bg); }
  .confidence-badge.tone-neutral { color: var(--neutral); background: var(--neutral-bg); }
  .basis-label { font-size: 10px; color: var(--ink-soft); margin-top: 5px; text-align: center; }
  .glossary { margin-top: 8px; display: flex; flex-wrap: wrap; gap: 5px; }
  .chip { font-size: 11.5px; background: var(--surface); border: 1px solid var(--line); border-radius: 6px; padding: 3px 9px; color: var(--ink-soft); line-height: 1.4; }
  .chip code { background: none; padding: 0; color: var(--ink); }

  .relations { margin-top: 18px; }
  .relations h3 { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--ink-soft); margin: 0 0 8px; }
  .relations ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
  .relations li { display: flex; align-items: center; gap: 8px; font-size: 12.5px; flex-wrap: wrap; }
  .arrow { color: var(--ink-soft); }
  .relation-intent { color: var(--ink-soft); }

  .answer-note { margin: 8px 0 0; padding: 10px 12px; border-radius: 8px; background: var(--good-bg); color: var(--ink); font-size: 12.5px; }
  .reason-list { margin: 6px 0 0; padding-left: 16px; font-size: 12px; color: var(--ink-soft); }

  .doc-footer { margin-top: 56px; padding-top: 18px; border-top: 1px solid var(--line); color: var(--ink-soft); font-size: 11.5px; display: flex; justify-content: space-between; gap: 12px; flex-wrap: wrap; }

  @media (max-width: 900px) {
    .layout { grid-template-columns: 1fr; }
    .sidebar { position: static; height: auto; border-right: none; border-bottom: 1px solid var(--line); }
  }
  @media (max-width: 640px) {
    .doc { padding: 32px 20px 80px; }
    .doc-header h1 { font-size: 26px; }
    .stat-grid { grid-template-columns: repeat(2, 1fr); }
  }
  @media print {
    .sidebar { display: none; }
    .layout { grid-template-columns: 1fr; }
    .item-card { break-inside: avoid; }
    a { color: inherit; text-decoration: none; }
  }
</style>
</head>
<body>
<div class="layout">
  <nav class="sidebar" aria-label="Table of contents">
    <div class="brand-row">
      <span class="brand-mark">DB</span>
      <div>
        <div class="brand-name">${escapeHtml(documentation.dataSourceName)}</div>
        <div class="brand-sub">${escapeHtml(documentation.dataSourceType)}</div>
      </div>
    </div>
    <div>
      <input id="search-input" type="search" placeholder="Search… ( / )" aria-label="Search documentation" autocomplete="off">
      <div id="search-count" class="search-count">${documentation.tablesTotal} total</div>
    </div>
    ${buildSidebarTree(documentation)}
  </nav>
  <main class="doc">
  <header class="doc-header" id="doc-top">
    <p class="eyebrow">AppEndO · Database Documentation</p>
    <h1>${escapeHtml(documentation.dataSourceName)}</h1>
    <p class="intro">
      A living reference for the <strong>${escapeHtml(documentation.dataSourceType)}</strong> database behind ${escapeHtml(documentation.dataSourceName)} —
      <strong>${documentation.tablesEnriched} of ${documentation.tablesTotal}</strong> objects enriched so far
      (<strong>${formatPercent(documentation.overallConfidence)}</strong> average confidence)${documentation.openQuestionCount > 0 ? `, with <strong>${documentation.openQuestionCount}</strong> open question${documentation.openQuestionCount === 1 ? '' : 's'} still needing a human answer` : ''}.
      Generated ${formatDateTime(documentation.generatedAt)}.
    </p>
  </header>

  <section id="overview">
    <div class="stat-grid">
      <div class="stat-card">
        <div class="stat-label">Tables &amp; Views</div>
        <div class="stat-value" style="color:var(--accent)">${documentation.tablesTotal}</div>
        <div class="stat-sub">${tableObjects.length} table${tableObjects.length === 1 ? '' : 's'} · ${viewObjects.length} view${viewObjects.length === 1 ? '' : 's'}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Enriched</div>
        <div class="stat-value" style="color:var(--good)">${documentation.tablesEnriched} / ${documentation.tablesTotal}</div>
        <div class="stat-sub">${formatPercent(coverage)} coverage</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Confidence</div>
        <div class="stat-value" style="color:${toneVar(overallTone)}">${formatPercent(documentation.overallConfidence)}</div>
        <div class="stat-sub">across enriched columns</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Open Questions</div>
        <div class="stat-value" style="color:${documentation.openQuestionCount > 0 ? 'var(--warn)' : 'var(--neutral)'}">${documentation.openQuestionCount}</div>
        <div class="stat-sub">need human input</div>
      </div>
    </div>
  </section>

  ${tablesTier}
  ${viewsTier}
  ${questionsTier}

  <footer class="doc-footer">
    <span>Generated by AppEndO DB Enricher on ${formatDateTime(documentation.generatedAt)}.</span>
    <span>Press <code>/</code> to search.</span>
  </footer>
  </main>
</div>
<script>${buildInlineScript()}</script>
</body>
</html>`;
};

const mdEscape = (value: string): string => value.replace(/\|/g, '\\|').replace(/\n/g, ' ');

/** Approximates the GitHub-flavored heading-anchor algorithm so TOC links resolve in any standard markdown renderer. */
const githubHeadingSlug = (text: string): string => (
  text.toLowerCase().trim().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-')
);

const buildMarkdownColumnsTable = (object: DbEnrichmentDocumentationObject): string => {
  if (object.columns.length === 0) {
    return '_No columns._\n';
  }
  const header = '| Column | Type | Meaning | Confidence |\n|---|---|---|---|\n';
  const rows = object.columns.map((column) => {
    const name = `${column.name}${column.isPrimaryKey ? ' `PK`' : ''}`;
    const glossary = column.valueGlossary && column.valueGlossary.length > 0
      ? ` (${column.valueGlossary.map((entry) => `\`${entry.value}\`=${entry.meaning}`).join(', ')})`
      : '';
    const meaning = `${column.meaning ? mdEscape(column.meaning) : '—'}${glossary}`;
    const confidence = `${formatPercent(column.confidence)}${column.confidenceBasis ? ` (${CONFIDENCE_BASIS_LABEL[column.confidenceBasis]})` : ''}`;
    return `| ${mdEscape(name)} | \`${mdEscape(column.dataType)}\` | ${mdEscape(meaning)} | ${confidence} |`;
  }).join('\n');
  return `${header}${rows}\n`;
};

const buildMarkdownTableSection = (object: DbEnrichmentDocumentationObject): string => {
  const lines: string[] = [];
  lines.push(`## ${object.objectName} (${object.objectType})`);
  lines.push('');
  lines.push(object.purpose ? object.purpose : '_No documented purpose yet._');
  lines.push('');
  lines.push(`**Confidence:** ${formatPercent(object.confidence)}${object.sourceOfTruth ? ` · **Source:** ${object.sourceOfTruth}` : ''} · **Columns:** ${object.columns.length}`);
  lines.push('');
  lines.push(buildMarkdownColumnsTable(object));
  if (object.relations.length > 0) {
    lines.push('**Relationships**');
    lines.push('');
    for (const relation of object.relations) {
      lines.push(`- \`${relation.fromColumn}\` → \`${relation.toTable}.${relation.toColumn}\` — ${relation.intent}`);
    }
    lines.push('');
  }
  return lines.join('\n');
};

const buildMarkdownQuestionsSection = (questions: DbEnrichmentQuestion[]): string => {
  if (questions.length === 0) {
    return '';
  }
  const header = '| Status | Object | Kind | Question | Answer |\n|---|---|---|---|---|\n';
  const rows = questions.map((question) => {
    const object = `${question.objectName}${question.columnName ? `.${question.columnName}` : ''}`;
    return `| ${QUESTION_STATUS_LABEL[question.status]} | \`${mdEscape(object)}\` | ${ENRICHMENT_QUESTION_KIND_LABEL[question.kind]} | ${mdEscape(question.question)} | ${question.answer ? mdEscape(question.answer) : '—'} |`;
  }).join('\n');
  return `## Ambiguities & Open Questions\n\n${header}${rows}\n`;
};

export const buildDbDocumentationMarkdown = (documentation: DbEnrichmentDocumentation): string => {
  const lines: string[] = [];
  lines.push(`# ${documentation.dataSourceName} — Database Documentation`);
  lines.push('');
  lines.push(`${documentation.dataSourceType} database documentation · generated ${formatDateTime(documentation.generatedAt)}`);
  lines.push('');
  lines.push('## Overview');
  lines.push('');
  lines.push(`- **Tables / Views:** ${documentation.tablesTotal}`);
  lines.push(`- **Enriched:** ${documentation.tablesEnriched}`);
  lines.push(`- **Overall confidence:** ${formatPercent(documentation.overallConfidence)}`);
  lines.push(`- **Open questions:** ${documentation.openQuestionCount}`);
  lines.push('');
  lines.push('## Contents');
  lines.push('');
  for (const object of documentation.objects) {
    const heading = `${object.objectName} (${object.objectType})`;
    lines.push(`- [${object.objectName}](#${githubHeadingSlug(heading)}) (${object.objectType})`);
  }
  if (documentation.questions.length > 0) {
    lines.push(`- [Ambiguities & Open Questions](#${githubHeadingSlug('Ambiguities & Open Questions')})`);
  }
  lines.push('');
  lines.push(documentation.objects.map(buildMarkdownTableSection).join('\n'));
  lines.push(buildMarkdownQuestionsSection(documentation.questions));
  lines.push(`_Generated by AppEndO DB Enricher on ${formatDateTime(documentation.generatedAt)}._`);
  return lines.join('\n');
};
