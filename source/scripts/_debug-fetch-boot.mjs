import { chromium } from 'playwright';

const browser = await chromium.launch({ channel: 'chrome', args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.goto('http://127.0.0.1:3000/', { waitUntil: 'commit' });

console.log('Issuing raw fetch("/api/boot", { credentials: "include", cache: "no-store" }) from the page...');
const result = await page.evaluate(async () => {
  const start = performance.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    const res = await fetch('/api/boot', { credentials: 'include', cache: 'no-store', signal: controller.signal });
    clearTimeout(timeout);
    const text = await res.text();
    return { ok: true, status: res.status, ms: performance.now() - start, len: text.length };
  } catch (e) {
    return { ok: false, error: String(e), ms: performance.now() - start };
  }
});
console.log('Result:', JSON.stringify(result, null, 2));

await browser.close();
