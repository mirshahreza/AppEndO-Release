import fs from 'node:fs';
import { execSync } from 'node:child_process';

const files = execSync('git ls-files "src/**/*.tsx"', { encoding: 'utf8' })
  .trim()
  .split(/\r?\n/)
  .filter((f) => f && fs.existsSync(f) && fs.readFileSync(f, 'utf8').includes('listPageToolbarCollapsedClass'));

const openRe =
  /<div(\s+[^>]*?)className=\{cn\(\s*([\s\S]*?),\s*listPageToolbarCollapsedClass\(([^)]+)\),\s*\)\}([^>]*)>/g;

const openReSingle =
  /<div(\s+[^>]*?)className=\{cn\(([^)]*),\s*listPageToolbarCollapsedClass\(([^)]+)\)\)\}([^>]*)>/g;

for (const file of files) {
  let s = fs.readFileSync(file, 'utf8');
  const original = s;

  s = s.replace(
    /import \{ listPageToolbarCollapsedClass \} from (['"]([^'"]+)['"]);/g,
    'import { ListPageToolbarScrollRoot } from $1;',
  );

  let replaced = false;
  s = s.replace(openRe, (_m, _a, inner, collapsed, tail) => {
    replaced = true;
    return `<ListPageToolbarScrollRoot collapsed={${collapsed.trim()}} className={cn(${inner.trim()})}${tail}>`;
  });
  s = s.replace(openReSingle, (_m, _a, inner, collapsed, tail) => {
    replaced = true;
    return `<ListPageToolbarScrollRoot collapsed={${collapsed.trim()}} className={cn(${inner.trim()})}${tail}>`;
  });

  if (!replaced) {
    console.log('skip (no open match):', file);
    continue;
  }

  const lines = s.split('\n');
  const out = [];
  let depth = 0;
  let inRoot = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes('<ListPageToolbarScrollRoot')) {
      inRoot = true;
      depth = 0;
    }
    if (inRoot) {
      const opens = (line.match(/<(?![/!])([A-Za-z][\w.-]*)/g) ?? []).length;
      const closes = (line.match(/<\/[A-Za-z][\w.-]*>/g) ?? []).length;
      depth += opens - closes;
      if (depth === 0 && line.trim() === '</div>' && inRoot) {
        out.push(line.replace('</div>', '</ListPageToolbarScrollRoot>'));
        inRoot = false;
        continue;
      }
    }
    out.push(line);
  }
  s = out.join('\n');

  if (s !== original) {
    fs.writeFileSync(file, s);
    console.log('ok', file);
  }
}
