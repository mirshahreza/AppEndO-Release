import fs from 'node:fs';
import { execSync } from 'node:child_process';

const files = execSync('git ls-files "src/**/*.tsx"', { encoding: 'utf8' })
  .trim()
  .split(/\r?\n/)
  .filter((f) => f && fs.existsSync(f) && fs.readFileSync(f, 'utf8').includes('listPageToolbarCollapsedClass'));

const openRe =
  /(\s*)<div\n(\s*)className=\{cn\(\n([\s\S]*?),\n\s*listPageToolbarCollapsedClass\(([^)]+)\),\n\s*\)\}\n(\s*)>/g;

const openReSingle =
  /(\s*)<div\n(\s*)className=\{cn\(([^)]*),\s*listPageToolbarCollapsedClass\(([^)]+)\)\)\}\n(\s*)>/g;

for (const file of files) {
  let s = fs.readFileSync(file, 'utf8');
  const original = s;

  s = s.replace(
    /import \{ listPageToolbarCollapsedClass \} from (['"]([^'"]+)['"]);/g,
    'import { ListPageToolbarScrollHost } from $1;',
  );

  let opens = 0;
  s = s.replace(openRe, (_m, indent, indent2, inner, collapsed, indent3) => {
    opens += 1;
    return `${indent}<ListPageToolbarScrollHost collapsed={${collapsed.trim()}}>\n${indent}<div\n${indent2}className={cn(\n${inner.trim()},\n${indent2})}\n${indent3}>`;
  });
  s = s.replace(openReSingle, (_m, indent, indent2, inner, collapsed, indent3) => {
    opens += 1;
    return `${indent}<ListPageToolbarScrollHost collapsed={${collapsed.trim()}}>\n${indent}<div\n${indent2}className={cn(${inner.trim()})}\n${indent3}>`;
  });

  for (let i = 0; i < opens; i += 1) {
    const idx = s.indexOf('<ListPageToolbarScrollHost');
    if (idx === -1) break;
    const after = s.slice(idx);
    const closeToolbar = after.match(
      /\r?\n([ \t]*)<\/div>\r?\n\r?\n[ \t]*<div/,
    );
    if (!closeToolbar) {
      console.log('no toolbar close pattern', file);
      break;
    }
    const insertAt = idx + closeToolbar.index + closeToolbar[0].indexOf('</div>') + '</div>'.length;
    s = `${s.slice(0, insertAt)}\n${closeToolbar[1]}</ListPageToolbarScrollHost>${s.slice(insertAt)}`;
  }

  if (s !== original) {
    fs.writeFileSync(file, s);
    console.log('ok', file);
  }
}
