import fs from 'node:fs';
import { execSync } from 'node:child_process';

const files = execSync('git ls-files "src/**/*.tsx"', { encoding: 'utf8' })
  .trim()
  .split(/\r?\n/)
  .filter((f) => f && fs.existsSync(f) && fs.readFileSync(f, 'utf8').includes('ListPageToolbarScrollRoot'));

for (const file of files) {
  let s = fs.readFileSync(file, 'utf8');
  const opens = (s.match(/<ListPageToolbarScrollRoot/g) ?? []).length;
  let closes = (s.match(/<\/ListPageToolbarScrollRoot>/g) ?? []).length;
  let changed = false;
  while (opens > closes) {
    const i = s.lastIndexOf('</div>');
    if (i === -1) break;
    s = `${s.slice(0, i)}</ListPageToolbarScrollRoot>${s.slice(i + '</div>'.length)}`;
    closes += 1;
    changed = true;
  }
  if (changed) {
    fs.writeFileSync(file, s);
    console.log('fixed', file);
  }
  const closesAfter = (s.match(/<\/ListPageToolbarScrollRoot>/g) ?? []).length;
  if (opens !== closesAfter) {
    console.log('still broken', file, opens, closesAfter);
  }
}
