import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.join(process.cwd(), 'personal-pictures');
const PORTRAITS_DIR = path.join(ROOT, 'portraits');
const COMPANIES_DIR = path.join(ROOT, 'companies');

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const downloadFile = async (url: string, targetPath: string): Promise<void> => {
  if (fs.existsSync(targetPath)) {
    console.log(`[skip] ${path.relative(ROOT, targetPath)}`);
    return;
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download ${url} (${response.status})`);
  }

  const bytes = Buffer.from(await response.arrayBuffer());
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, bytes);
  console.log(`[saved] ${path.relative(ROOT, targetPath)} (${bytes.length} bytes)`);
  await sleep(120);
};

const main = async () => {
  fs.mkdirSync(PORTRAITS_DIR, { recursive: true });
  fs.mkdirSync(COMPANIES_DIR, { recursive: true });

  await downloadFile(
    'https://api.dicebear.com/7.x/shapes/png?seed=appendo-admin&size=256',
    path.join(ROOT, 'admin.png'),
  );
  await downloadFile(
    'https://api.dicebear.com/7.x/shapes/png?seed=appendo-admin&size=64',
    path.join(ROOT, 'admin-xs.png'),
  );

  for (let i = 1; i <= 50; i += 1) {
    const num = String(i).padStart(2, '0');
    await downloadFile(
      `https://randomuser.me/api/portraits/men/${i}.jpg`,
      path.join(PORTRAITS_DIR, `male-${num}.jpg`),
    );
  }

  for (let i = 1; i <= 49; i += 1) {
    const num = String(i).padStart(2, '0');
    await downloadFile(
      `https://randomuser.me/api/portraits/women/${i}.jpg`,
      path.join(PORTRAITS_DIR, `female-${num}.jpg`),
    );
  }

  for (let i = 1; i <= 25; i += 1) {
    const num = String(i).padStart(2, '0');
    await downloadFile(
      `https://api.dicebear.com/7.x/identicon/png?seed=appendo-company-${i}&size=256`,
      path.join(COMPANIES_DIR, `company-${num}.png`),
    );
    await downloadFile(
      `https://api.dicebear.com/7.x/identicon/png?seed=appendo-company-${i}&size=64`,
      path.join(COMPANIES_DIR, `company-${num}-xs.png`),
    );
  }

  console.log('[db:seed-pictures] All seed pictures are ready.');
};

main().catch((error) => {
  console.error('[db:seed-pictures] failed:', error?.message || error);
  process.exit(1);
});
