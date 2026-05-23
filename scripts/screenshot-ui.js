import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
import { createApp } from '../src/app.js';

const screenshotDir = path.resolve('screenshots');

async function startServer() {
  const app = createApp();

  return await new Promise((resolve, reject) => {
    const server = app.listen(0, '127.0.0.1');
    server.once('error', reject);
    server.once('listening', () => {
      const { port } = server.address();
      resolve({ server, url: `http://127.0.0.1:${port}` });
    });
  });
}

async function assertLayout(page) {
  await page.waitForSelector('.workspace');

  const overflow = await page.evaluate(() => ({
    body: document.body.scrollWidth - document.body.clientWidth,
    root: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  }));

  if (overflow.body > 1 || overflow.root > 1) {
    throw new Error(`Unexpected horizontal overflow: ${JSON.stringify(overflow)}`);
  }

  for (const selector of ['h1', '.download-form', '.queue', '#url', '#quality']) {
    const box = await page.locator(selector).boundingBox();
    if (!box || box.width <= 0 || box.height <= 0) {
      throw new Error(`${selector} is not visible.`);
    }
  }

  const workspace = await page.locator('.workspace').boundingBox();
  const viewport = page.viewportSize();

  if (!workspace || !viewport) {
    throw new Error('Could not inspect workspace layout.');
  }

  if (workspace.x < 0 || workspace.x + workspace.width > viewport.width + 1) {
    throw new Error('Workspace is not contained within the viewport.');
  }
}

async function capture(page, url, name, viewport) {
  await page.setViewportSize(viewport);
  await page.goto(url, { waitUntil: 'networkidle' });
  await assertLayout(page);
  await page.screenshot({
    path: path.join(screenshotDir, `${name}.png`),
    fullPage: true,
  });
}

const { server, url } = await startServer();
await mkdir(screenshotDir, { recursive: true });

const browser = await chromium.launch();

try {
  const page = await browser.newPage();

  await capture(page, url, 'streamvault-desktop', { width: 1440, height: 960 });
  await capture(page, url, 'streamvault-mobile', { width: 390, height: 844 });
} finally {
  await browser.close();
  server.close();
}
