import { chromium } from 'playwright';

const browser = await chromium.launch({ channel: 'chrome', args: ['--no-sandbox'] });
const page = await browser.newPage();

let total = 0;
let finished = 0;
const inflight = new Set();
const startedAt = new Map();
let bootStarted = null;
let bootFinished = null;

page.on('request', (req) => {
  total += 1;
  inflight.add(req);
  startedAt.set(req, Date.now());
  if (req.url().includes('/api/boot')) {
    bootStarted = Date.now();
    console.log(`[t+?] /api/boot request STARTED (request #${total})`);
  }
});
page.on('requestfinished', (req) => {
  finished += 1;
  inflight.delete(req);
  if (req.url().includes('/api/boot')) {
    bootFinished = Date.now();
    console.log(`[t+?] /api/boot request FINISHED`);
  }
});
page.on('requestfailed', (req) => {
  inflight.delete(req);
});

const t0 = Date.now();
page.goto('http://127.0.0.1:3000/', { waitUntil: 'load', timeout: 60000 }).catch((e) => console.log('goto error (expected if slow):', e.message));

const timer = setInterval(() => {
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`t=${elapsed}s  total=${total} finished=${finished} inflight=${inflight.size}` + (bootStarted && !bootFinished ? `  [boot pending for ${((Date.now() - bootStarted) / 1000).toFixed(1)}s]` : ''));
}, 2000);

await page.waitForTimeout(30000);
clearInterval(timer);

console.log('\nStill in-flight after 30s:');
for (const req of inflight) {
  console.log(`  ${req.method()} ${req.url()}  (pending ${((Date.now() - startedAt.get(req)) / 1000).toFixed(1)}s)`);
}

await browser.close();
