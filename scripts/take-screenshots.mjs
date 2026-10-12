import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9222;
const TARGET_URL = 'https://omni-quiz-harilowji.vercel.app/';
const OUTPUT_DIR = path.resolve('docs/screenshots');

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function getWsEndpoint() {
  for (let i = 0; i < 20; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      if (res.ok) {
        const data = await res.json();
        return data.webSocketDebuggerUrl;
      }
    } catch (e) {
      // wait
    }
    await sleep(500);
  }
  throw new Error('Failed to connect to Chrome remote debugging port.');
}

class CDPClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.ws = null;
    this.id = 1;
    this.callbacks = new Map();
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.wsUrl);
      this.ws.onopen = () => resolve();
      this.ws.onerror = err => reject(err);
      this.ws.onmessage = evt => {
        try {
          const msg = JSON.parse(evt.data);
          if (msg.id && this.callbacks.has(msg.id)) {
            const cb = this.callbacks.get(msg.id);
            this.callbacks.delete(msg.id);
            if (msg.error) cb.reject(new Error(msg.error.message));
            else cb.resolve(msg.result);
          }
        } catch (e) {}
      };
    });
  }

  send(method, params = {}) {
    const id = this.id++;
    return new Promise((resolve, reject) => {
      this.callbacks.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  close() {
    if (this.ws) this.ws.close();
  }
}

async function main() {
  console.log('🚀 Spawning headless Chrome...');
  const chromeProc = spawn(CHROME_PATH, [
    '--headless=new',
    `--remote-debugging-port=${PORT}`,
    '--disable-gpu',
    '--no-sandbox',
    '--disable-extensions',
    '--hide-scrollbars',
    '--window-size=1440,900'
  ]);

  try {
    const wsUrl = await getWsEndpoint();
    console.log('🔌 Connected to Chrome DevTools Protocol at:', wsUrl);

    // Create target page
    const browserClient = new CDPClient(wsUrl);
    await browserClient.connect();

    const { targetId } = await browserClient.send('Target.createTarget', { url: 'about:blank' });
    const targetWsUrl = `ws://127.0.0.1:${PORT}/devtools/page/${targetId}`;

    const pageClient = new CDPClient(targetWsUrl);
    await pageClient.connect();

    // Setup viewport 1440x900
    await pageClient.send('Page.enable');
    await pageClient.send('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 900,
      deviceScaleFactor: 2,
      mobile: false
    });

    console.log(`🌐 Navigating to ${TARGET_URL}...`);
    await pageClient.send('Page.navigate', { url: TARGET_URL });
    await sleep(4000); // Wait for fonts, KaTeX, and canvas worker to render

    // 1. Capture Lobby Hero Screenshot
    console.log('📸 Capturing Desktop Lobby Hero...');
    const lobbyScreenshot = await pageClient.send('Page.captureScreenshot', { format: 'png' });
    const lobbyPath = path.join(OUTPUT_DIR, 'cbt-lobby-hero.png');
    fs.writeFileSync(lobbyPath, Buffer.from(lobbyScreenshot.data, 'base64'));
    console.log(`✅ Saved: ${lobbyPath}`);

    // Click on Sample Exam or Gallery to enter Exam view
    console.log('🖱️ Clicking Sample Gallery Exam to enter CBT Exam view...');
    await pageClient.send('Runtime.evaluate', {
      expression: `
        (() => {
          const btn = document.querySelector('.gallery-item-card .btn-select-gallery-exam') ||
                      document.querySelector('[data-action="start-practice"]') ||
                      document.querySelector('#btn-mode-practice') ||
                      document.querySelector('.btn-mode-select');
          if (btn) btn.click();
        })()
      `
    });
    await sleep(2500);

    // If modal appeared, click start or confirm
    await pageClient.send('Runtime.evaluate', {
      expression: `
        (() => {
          const startBtn = document.querySelector('#btn-confirm-start-exam') ||
                           document.querySelector('#btn-start-exam') ||
                           document.querySelector('.btn-start-practice') ||
                           document.querySelector('#btn-setup-start');
          if (startBtn) startBtn.click();
        })()
      `
    });
    await sleep(2500);

    // 2. Capture CBT Exam Interface
    console.log('📸 Capturing CBT Exam Interface...');
    const examScreenshot = await pageClient.send('Page.captureScreenshot', { format: 'png' });
    const examPath = path.join(OUTPUT_DIR, 'cbt-exam-view.png');
    fs.writeFileSync(examPath, Buffer.from(examScreenshot.data, 'base64'));
    console.log(`✅ Saved: ${examPath}`);

    // 3. Mobile Viewport (iPhone 14 / modern Android 390x844)
    console.log('📱 Switching to Mobile Viewport (390x844)...');
    await pageClient.send('Emulation.setDeviceMetricsOverride', {
      width: 390,
      height: 844,
      deviceScaleFactor: 3,
      mobile: true
    });
    await pageClient.send('Page.navigate', { url: TARGET_URL });
    await sleep(3500);

    const mobileScreenshot = await pageClient.send('Page.captureScreenshot', { format: 'png' });
    const mobilePath = path.join(OUTPUT_DIR, 'cbt-mobile-view.png');
    fs.writeFileSync(mobilePath, Buffer.from(mobileScreenshot.data, 'base64'));
    console.log(`✅ Saved: ${mobilePath}`);

    pageClient.close();
    browserClient.close();
  } catch (err) {
    console.error('❌ Error capturing screenshots:', err);
  } finally {
    chromeProc.kill();
    console.log('🏁 Done capturing screenshots!');
  }
}

main();
