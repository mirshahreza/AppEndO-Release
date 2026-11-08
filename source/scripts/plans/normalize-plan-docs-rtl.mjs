/**
 * Normalize all plans/*.md: RTL wrapper, shared CSS, Markdown tables → HTML (skip fenced code).
 * Optional operator intro for files that lack one.
 *
 * Run from repo root:
 *   node scripts/plans/normalize-plan-docs-rtl.mjs
 *   node scripts/plans/normalize-plan-docs-rtl.mjs --intros
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const plansRoot = path.join(repoRoot, 'plans');
const addIntros = process.argv.includes('--intros');

const STYLE_BLOCK = `<style>
  .hwy-parity-doc { text-align: right; unicode-bidi: plaintext; }
  .hwy-parity-doc h1, .hwy-parity-doc h2, .hwy-parity-doc h3, .hwy-parity-doc h4, .hwy-parity-doc p, .hwy-parity-doc li { text-align: right; }
  .hwy-parity-doc table { direction: rtl; text-align: right; width: 100%; border-collapse: collapse; margin: 0.75rem 0; }
  .hwy-parity-doc th, .hwy-parity-doc td { border: 1px solid #c4c4c4; padding: 0.35rem 0.5rem; vertical-align: top; text-align: right; }
  .hwy-parity-doc th { background: #f6f6f6; font-weight: 600; }
  .hwy-parity-doc blockquote { text-align: right; border-right: 3px solid #ccc; border-left: none; padding-right: 1rem; margin-right: 0; }
  .hwy-parity-doc ul, .hwy-parity-doc ol { padding-right: 1.25rem; padding-left: 0; }
  .hwy-parity-doc pre, .hwy-parity-doc code { direction: ltr; text-align: left; unicode-bidi: embed; }
</style>`;

/** @param {string} relPosix path under plans/ using / */
function operatorIntro(relPosix) {
  if (relPosix.includes('hawiety-package/')) return null;
  if (relPosix === 'README.md') {
    return `<p><strong>خلاصه برای operatore:</strong> پوشهٔ <code dir="ltr">plans/</code> فقط کار <strong>باز و ناتمام</strong> را نگه می‌دارد. برای ریلیز فعلی از <a href="core/todo/p-00-todo-index.md">core/todo index</a>، برای پکیج‌های Studio از <a href="packages/todo/p-00-packages-index.md">packages index</a>، و برای backlog موکول از <a href="core/next/p-00-next-index.md">core/next index</a> شروع کنید.</p>
<p><strong>راهنمای خواندن:</strong> جداول RTL هستند؛ متن انگلیسی داخل بعضی پلن‌ها برای agent است. قالب: <a href="plans-operator-doc-standard.md">plans-operator-doc-standard.md</a>.</p>`;
  }
  if (relPosix === 'plans-operator-doc-standard.md') return null;
  if (relPosix === 'core/README.md') {
    return `<p><strong>خلاصه برای operatore:</strong> شاخهٔ <code dir="ltr">core/</code> پلن‌های <strong>پلتفرم AppEndO</strong> را جدا می‌کند: <code dir="ltr">todo</code> = ریلیز فعلی، <code dir="ltr">next</code> = موکول.</p>`;
  }
  if (relPosix === 'core/todo/README.md') {
    return `<p><strong>خلاصه برای operatore:</strong> اینجا فقط کارهایی است که برای <strong>ریلیز جاری</strong> اولویت دارند. نقطهٔ ورود: <a href="p-00-todo-index.md">p-00-todo-index.md</a>.</p>`;
  }
  if (relPosix === 'core/next/README.md') {
    return `<p><strong>خلاصه برای operatore:</strong> ایده‌ها و فازهای <strong>موکول</strong> — تا وقتی به todo منتقل نشوند، blocker ریلیز فعلی نیستند. فهرست: <a href="p-00-next-index.md">p-00-next-index.md</a>.</p>`;
  }
  if (relPosix === 'core/todo/p-00-todo-index.md') {
    return `<p><strong>خلاصه برای operatore:</strong> <strong>نقشهٔ ریلیز فعلی</strong> — کدام پلن فعال است، چه چیز تمام شده، و agent با چه دستوری شروع کند. جدول «پیشرفت» وضعیت واقعی هر سند را نشان می‌دهد.</p>
<p><strong>راهنمای خواندن:</strong> اول «وضعیت»، بعد «پیشرفت»؛ برای پکیج‌ها به <a href="../../packages/todo/p-00-packages-index.md">packages index</a> بروید.</p>`;
  }
  if (relPosix === 'core/next/p-00-next-index.md') {
    return `<p><strong>خلاصه برای operatore:</strong> فهرست کارهای <strong>آینده</strong> (AI، mobile، marketplace، …) — اولویت با شماست وقتی به todo graduate شوند.</p>`;
  }
  if (relPosix === 'packages/todo/p-00-packages-index.md') {
    return `<p><strong>خلاصه برای operatore:</strong> همهٔ <strong>پکیج‌های Studio</strong> (Task، CRM، Hawiety، …) — کدام design-only است و کدام فعال. هویتی: parity از <a href="hawiety-package/hwy-legacy-vs-appendo-feature-parity.md">§۰ parity</a>.</p>`;
  }
  if (relPosix === 'packages/todo/p-packages-backlog.md') {
    return `<p><strong>خلاصه برای operatore:</strong> ایده‌های پکیج که هنوز سند اجرایی جدا ندارند — برای اولویت‌بندی جلسه.</p>`;
  }
  if (relPosix.endsWith('/README.md')) {
    const pkg = relPosix.split('/').slice(-2, -1)[0];
    return `<p><strong>خلاصه برای operatore:</strong> فهرست اسناد پوشهٔ <strong>${pkg}</strong> — از README به پلن اصلی و promptهای فاز لینک می‌شود.</p>`;
  }
  if (relPosix.includes('phase-execution-prompts') || relPosix.includes('-execution-prompts')) {
    return `<p><strong>خلاصه برای operatore:</strong> دستور copy-paste برای <strong>agent</strong> تا فازهای npm را اجرا کند — شما معمولاً فقط دستور و «done criteria» را می‌بینید.</p>`;
  }
  if (relPosix.includes('plan-review-and-benchmark')) {
    return `<p><strong>خلاصه برای operatore:</strong> مقایسه با بازار/OSS — برای تصمیم scope، نه وضعیت پیاده‌سازی روزانه.</p>`;
  }
  if (relPosix.startsWith('packages/todo/hawiety-package/')) return null;

  const base = path.basename(relPosix, '.md');
  const indexHref = indexHrefFor(relPosix);
  return `<p><strong>خلاصه برای operatore:</strong> این سند جزو <strong>plans</strong> است (${base}). ستون وضعیت در <a href="${indexHref}">index مربوطه</a> مرجع «شروع شده / design / تمام» است.</p>
<p><strong>راهنمای خواندن:</strong> بخش‌های انگلیسی برای agent/dev هستند؛ جداول وضعیت و یادداشت‌های فارسی را اول بخوانید.</p>`;
}

function indexHrefFor(relPosix) {
  const dir = path.posix.dirname(relPosix);
  let indexPath = 'README.md';
  if (relPosix.startsWith('core/next/')) indexPath = 'core/next/p-00-next-index.md';
  else if (relPosix.startsWith('core/todo/')) indexPath = 'core/todo/p-00-todo-index.md';
  else if (relPosix.startsWith('packages/todo/')) indexPath = 'packages/todo/p-00-packages-index.md';
  let rel = path.posix.relative(dir, indexPath);
  if (!rel.startsWith('.')) rel = `./${rel}`;
  return rel;
}

function parseRow(line) {
  let s = line.trim();
  if (!s.startsWith('|')) return null;
  if (/^\|[\s\-:|]+\|$/.test(s)) return 'sep';
  s = s.slice(1);
  if (s.endsWith('|')) s = s.slice(0, -1);
  return s.split('|').map((c) => c.trim());
}

function mdInlineToHtml(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    .replace(/`([^`]+)`/g, '<code dir="ltr" style="unicode-bidi: embed;">$1</code>');
}

function convertMarkdownTables(text) {
  const lines = text.split(/\r?\n/);
  const out = [];
  let i = 0;
  let inFence = false;
  while (i < lines.length) {
    const trimmed = lines[i].trim();
    if (/^```/.test(trimmed)) {
      inFence = !inFence;
      out.push(lines[i]);
      i++;
      continue;
    }
    if (!inFence && trimmed.startsWith('|')) {
      const rows = [];
      let j = i;
      while (j < lines.length && lines[j].trim().startsWith('|')) {
        const parsed = parseRow(lines[j]);
        if (parsed === 'sep') {
          j++;
          continue;
        }
        if (parsed) rows.push(parsed);
        j++;
      }
      if (rows.length >= 1) {
        const [header, ...body] = rows;
        let html = '<table dir="rtl">\n<thead><tr>';
        for (const h of header) html += `<th>${mdInlineToHtml(h)}</th>`;
        html += '</tr></thead>\n<tbody>';
        for (const row of body) {
          html += '<tr>';
          for (let c = 0; c < header.length; c++) {
            html += `<td>${mdInlineToHtml(row[c] ?? '')}</td>`;
          }
          html += '</tr>\n';
        }
        html += '</tbody></table>';
        out.push(html);
        i = j;
        continue;
      }
    }
    out.push(lines[i]);
    i++;
  }
  return out.join('\n');
}

function ensureWrapper(text) {
  if (text.includes('class="hwy-parity-doc"')) {
    if (!text.includes('.hwy-parity-doc table')) {
      return text.replace(
        /(<div dir="rtl" lang="fa" class="hwy-parity-doc">)/,
        `$1\n${STYLE_BLOCK}`,
      );
    }
    if (!text.includes('.hwy-parity-doc pre')) {
      return text.replace(
        /(<\/style>)/,
        `  .hwy-parity-doc pre, .hwy-parity-doc code { direction: ltr; text-align: left; unicode-bidi: embed; }\n$1`,
      );
    }
    return text;
  }
  if (text.startsWith('<div dir="rtl"') && !text.includes('hwy-parity-doc')) {
    return text.replace(
      '<div dir="rtl" lang="fa">',
      `<div dir="rtl" lang="fa" class="hwy-parity-doc">\n${STYLE_BLOCK}`,
    );
  }
  const trimmed = text.replace(/^\uFEFF/, '').trimStart();
  return `<div dir="rtl" lang="fa" class="hwy-parity-doc">\n${STYLE_BLOCK}\n\n${trimmed}\n\n</div>\n`;
}

function injectIntro(text, intro) {
  if (!intro || text.includes('خلاصه برای operatore')) return text;
  const styleEnd = text.indexOf('</style>');
  if (styleEnd !== -1) {
    const insertAt = styleEnd + '</style>'.length;
    return `${text.slice(0, insertAt)}\n\n${intro}\n${text.slice(insertAt)}`;
  }
  const wrapperEnd = text.indexOf('class="hwy-parity-doc">');
  if (wrapperEnd !== -1) {
    const insertAt = text.indexOf('\n', wrapperEnd) + 1;
    return `${text.slice(0, insertAt)}\n${intro}\n${text.slice(insertAt)}`;
  }
  return `${intro}\n\n${text}`;
}

function walkMdFiles(dir, acc = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) walkMdFiles(full, acc);
    else if (ent.name.endsWith('.md')) acc.push(full);
  }
  return acc;
}

function processFile(filePath) {
  const rel = path.relative(plansRoot, filePath).split(path.sep).join('/');
  let text = fs.readFileSync(filePath, 'utf8');
  const before = text;
  text = convertMarkdownTables(text);
  text = ensureWrapper(text);
  if (addIntros) {
    const intro = operatorIntro(rel);
    text = injectIntro(text, intro);
  }
  if (text !== before) {
    fs.writeFileSync(filePath, text, 'utf8');
    return true;
  }
  return false;
}

let changed = 0;
for (const file of walkMdFiles(plansRoot)) {
  if (processFile(file)) {
    changed++;
    console.log('updated:', path.relative(repoRoot, file));
  }
}
console.log(`Done. ${changed} file(s) modified under plans/.`);
