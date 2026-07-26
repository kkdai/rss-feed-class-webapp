/**
 * Boots the server and loads the homepage in a headless browser, failing
 * if the server won't start or the page throws during init(). This is the
 * exact regression class that has previously reached production (a syntax
 * error and a null DOM reference both crashed init() silently in the browser
 * with no server-side signal), so a real server response is not enough.
 */
import { spawn } from 'child_process';
import puppeteer from 'puppeteer';

const PORT = 8977;
const BASE_URL = `http://localhost:${PORT}`;

function waitForServer(proc, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Server did not start in time')), timeoutMs);
    proc.stdout.on('data', (chunk) => {
      if (chunk.toString().includes('FeedFlow server running')) {
        clearTimeout(timer);
        resolve();
      }
    });
    proc.on('exit', (code) => {
      clearTimeout(timer);
      reject(new Error(`Server exited early with code ${code}`));
    });
  });
}

async function main() {
  const server = spawn('node', ['server.js'], {
    env: {
      ...process.env,
      PORT: String(PORT),
      SESSION_SECRET: 'smoke-test-session-secret',
      LINE_CHANNEL_ID: '',
      LINE_CHANNEL_SECRET: '',
      LINE_LIFF_ID: '',
      GEMINI_API_KEY: '',
      GCP_PROJECT: ''
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  let serverOutput = '';
  server.stdout.on('data', (d) => { serverOutput += d.toString(); });
  server.stderr.on('data', (d) => { serverOutput += d.toString(); });

  try {
    await waitForServer(server);

    const configRes = await fetch(`${BASE_URL}/api/config`);
    if (!configRes.ok) {
      throw new Error(`/api/config returned HTTP ${configRes.status}`);
    }

    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
    try {
      const page = await browser.newPage();
      const pageErrors = [];

      page.on('pageerror', (err) => pageErrors.push(`pageerror: ${err.message}`));
      page.on('console', (msg) => {
        if (msg.type() === 'error') pageErrors.push(`console.error: ${msg.text()}`);
      });

      const response = await page.goto(BASE_URL, { waitUntil: 'networkidle0', timeout: 15000 });
      if (!response || !response.ok()) {
        throw new Error(`Homepage returned HTTP ${response ? response.status() : 'no response'}`);
      }

      // init() should have run and rendered the sidebar without throwing.
      await page.waitForSelector('#sidebar', { timeout: 5000 });

      if (pageErrors.length > 0) {
        throw new Error(`Frontend errors during load:\n${pageErrors.join('\n')}`);
      }

      console.log('Smoke test passed: server started, /api/config responded, homepage loaded with no console/page errors.');
    } finally {
      await browser.close();
    }
  } catch (err) {
    console.error('Smoke test failed:', err.message);
    console.error('--- server output ---');
    console.error(serverOutput);
    process.exitCode = 1;
  } finally {
    server.kill();
  }
}

main();
