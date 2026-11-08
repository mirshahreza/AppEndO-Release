import fs from 'node:fs';
import { execSync } from 'node:child_process';

const files = execSync('git ls-files "src/**/*.tsx"', { encoding: 'utf8' })
  .trim()
  .split(/\r?\n/)
  .filter((f) => f && fs.existsSync(f) && fs.readFileSync(f, 'utf8').includes('<ListPageToolbarScrollRoot'));

function findMisclosedScrollRoot(s, openIndex) {
  const gt = s.indexOf('>', openIndex);
  if (gt === -1) return -1;
  let pos = gt + 1;
  const stack = ['ListPageToolbarScrollRoot'];
  while (pos < s.length && stack.length > 0) {
    const next = s.indexOf('<', pos);
    if (next === -1) return -1;
    if (s.startsWith('</', next)) {
      const m = s.slice(next).match(/^<\/([A-Za-z][\w.]*)\s*>/);
      if (!m) {
        pos = next + 2;
        continue;
      }
      const name = m[1];
      const end = next + m[0].length;
      if (name === stack[stack.length - 1]) {
        stack.pop();
        if (stack.length === 0) return -1;
      } else if (
        name === 'div'
        && stack.length === 1
        && stack[0] === 'ListPageToolbarScrollRoot'
      ) {
        return next;
      }
      pos = end;
      continue;
    }
    if (s.startsWith('<!--', next)) {
      const endComment = s.indexOf('-->', next);
      pos = endComment === -1 ? s.length : endComment + 3;
      continue;
    }
    const m = s.slice(next).match(/^<([A-Za-z][\w.]*)([\s\S]*?)>/);
    if (!m) {
      pos = next + 1;
      continue;
    }
    const name = m[1];
    const tagBody = m[2];
    const end = next + m[0].length;
    const selfClosing = tagBody.trimEnd().endsWith('/') || s.slice(next, end).endsWith('/>');
    if (!selfClosing) stack.push(name);
    pos = end;
  }
  return -1;
}

for (const file of files) {
  let s = fs.readFileSync(file, 'utf8');
  let openIndex = 0;
  let changed = false;
  while ((openIndex = s.indexOf('<ListPageToolbarScrollRoot', openIndex)) !== -1) {
    const closeIndex = findMisclosedScrollRoot(s, openIndex);
    if (closeIndex === -1) {
      openIndex += 1;
      continue;
    }
    const closeTag = s.slice(closeIndex).match(/^<\/[A-Za-z][\w.]*\s*>/)?.[0] ?? '';
    s = s.slice(0, closeIndex) + '</ListPageToolbarScrollRoot>' + s.slice(closeIndex + closeTag.length);
    changed = true;
    openIndex = closeIndex + 1;
  }
  if (changed) {
    fs.writeFileSync(file, s);
    console.log('fixed', file);
  }
}
