import { chromium } from 'playwright';

const url = 'http://127.0.0.1:3000/';
const consoleMessages = [];
const pageErrors = [];
const failedRequests = [];
const pendingRequests = new Map();

const browser = await chromium.launch({ channel: 'chrome', args: ['--no-sandbox'] });
const page = await browser.newPage();

page.on('console', (msg) => {
  consoleMessages.push(`[${msg.type()}] ${msg.text()}`);
});
page.on('pageerror', (err) => {
  pageErrors.push(String(err.stack || err.message || err));
});
page.on('request', (req) => {
  pendingRequests.set(req, `${req.method()} ${req.url()}`);
});
page.on('requestfinished', (req) => {
  pendingRequests.delete(req);
});
page.on('requestfailed', (req) => {
  pendingRequests.delete(req);
  failedRequests.push(`${req.method()} ${req.url()} -> ${req.failure()?.errorText}`);
});
page.on('response', (res) => {
  if (res.status() >= 400) {
    failedRequests.push(`${res.status()} ${res.request().method()} ${res.url()}`);
  }
});

console.log(`Navigating to ${url} ...`);
const start = Date.now();
try {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
} catch (e) {
  console.log('goto() error:', e.message);
}
console.log(`domcontentloaded after ${Date.now() - start}ms`);

let splashGone = false;
for (let i = 0; i < 25; i += 1) {
  const hidden = await page.evaluate(() => {
    const el = document.getElementById('app-boot-splash');
    return !el || el.hasAttribute('hidden');
  }).catch(() => false);
  if (hidden) {
    splashGone = true;
    break;
  }
  await page.waitForTimeout(1000);
}

console.log(`Splash gone after ~${Date.now() - start}ms: ${splashGone}`);

const rootHtml = await page.evaluate(() => document.getElementById('root')?.innerHTML?.slice(0, 500) ?? '(no #root)').catch(() => '(eval failed)');
console.log('root innerHTML (first 500 chars):', rootHtml);

await page.screenshot({ path: 'C:/Users/Mohsen/AppData/Local/Temp/claude/c--Workspace-Projects-AppEndO/6bf66eb9-cfed-4b1f-9b42-e81fa87c1c75/scratchpad/boot-screenshot.png', fullPage: true });
console.log('Screenshot saved.');

console.log('\n--- console messages ---');
for (const m of consoleMessages) console.log(m);

console.log('\n--- page errors ---');
for (const e of pageErrors) console.log(e);

console.log('\n--- failed / 4xx-5xx requests ---');
for (const f of failedRequests) console.log(f);

console.log('\n--- still-pending requests (never finished/failed) ---');
for (const label of pendingRequests.values()) console.log(label);

const winKeys = await page.evaluate(() => Object.keys(window).filter((k) => /react|vite/i.test(k))).catch(() => []);
console.log('\nwindow keys matching react/vite:', winKeys);

const rootExists = await page.evaluate(() => !!document.getElementById('root')).catch(() => 'eval-failed');
console.log('root element exists:', rootExists);

await browser.close();
