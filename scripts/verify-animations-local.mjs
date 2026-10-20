import { spawn } from 'child_process';
import http from 'http';
import fs from 'fs';
import path from 'path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const CDP_PORT = 9225;
const APP_PORT = 3055;
const APP_URL = `http://127.0.0.1:${APP_PORT}/`;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function getWsEndpoint() {
  for (let i = 0; i < 20; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`);
      if (res.ok) {
        const data = await res.json();
        return data.webSocketDebuggerUrl;
      }
    } catch (e) {}
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

async function runVerification() {
  console.log('🚀 1. Starting Express Server on port', APP_PORT);
  process.env.PORT = String(APP_PORT);
  const serverProc = spawn('node', ['server.js'], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: String(APP_PORT) }
  });

  serverProc.stdout.on('data', data => console.log('[Server stdout]:', data.toString().trim()));
  serverProc.stderr.on('data', data => console.error('[Server stderr]:', data.toString().trim()));

  await sleep(2000);

  console.log('🚀 2. Spawning Chrome headless for verification...');
  const chromeProc = spawn(CHROME_PATH, [
    '--headless=new',
    `--remote-debugging-port=${CDP_PORT}`,
    '--disable-gpu',
    '--no-sandbox',
    '--window-size=1440,900'
  ]);

  try {
    const wsUrl = await getWsEndpoint();
    const browserClient = new CDPClient(wsUrl);
    await browserClient.connect();

    const { targetId } = await browserClient.send('Target.createTarget', { url: 'about:blank' });
    const targetWsUrl = `ws://127.0.0.1:${CDP_PORT}/devtools/page/${targetId}`;
    const pageClient = new CDPClient(targetWsUrl);
    await pageClient.connect();

    await pageClient.send('Page.enable');
    await pageClient.send('Runtime.enable');

    console.log(`🌐 3. Navigating to ${APP_URL}...`);
    await pageClient.send('Page.navigate', { url: APP_URL });
    await sleep(4000);

    const initialCheck = await pageClient.send('Runtime.evaluate', {
      returnByValue: true,
      expression: `
        (() => {
          const video = document.getElementById('app-bg-video');
          const still = document.getElementById('app-bg-still');
          const ambientCanvas = document.getElementById('bg-ambient-canvas');
          const confettiCanvas = document.getElementById('confetti-canvas');

          return {
            bodyClass: document.body.className,
            video: video ? {
              display: window.getComputedStyle(video).display,
              opacity: window.getComputedStyle(video).opacity,
              zIndex: window.getComputedStyle(video).zIndex,
              src: video.src,
              paused: video.paused,
              readyState: video.readyState,
              duration: video.duration
            } : 'MISSING',
            ambientCanvas: ambientCanvas ? {
              display: window.getComputedStyle(ambientCanvas).display,
              opacity: window.getComputedStyle(ambientCanvas).opacity,
              zIndex: window.getComputedStyle(ambientCanvas).zIndex,
              width: ambientCanvas.width,
              height: ambientCanvas.height
            } : 'MISSING',
            confettiCanvas: confettiCanvas ? {
              zIndex: window.getComputedStyle(confettiCanvas).zIndex
            } : 'MISSING'
          };
        })()
      `
    });

    console.log('\n📊 Initial Load Verification Result:\n', JSON.stringify(initialCheck.result.value, null, 2));

    // Capture initial screenshot
    const shot1 = await pageClient.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('docs/screenshots/cbt-lobby-animated-verified.png', Buffer.from(shot1.data, 'base64'));
    console.log('📸 Saved verification screenshot to docs/screenshots/cbt-lobby-animated-verified.png');

    // Switch theme to Sakura (Playful)
    console.log('\n🔄 4. Testing Quick Theme Switch to Sakura...');
    await pageClient.send('Runtime.evaluate', {
      expression: `
        (() => {
          const btn = document.getElementById('btn-quick-theme');
          if (btn) btn.click();
        })()
      `
    });
    await sleep(2500);

    const afterSwitchCheck = await pageClient.send('Runtime.evaluate', {
      returnByValue: true,
      expression: `
        (() => {
          const video = document.getElementById('app-bg-video');
          return {
            bodyClass: document.body.className,
            video: video ? {
              display: window.getComputedStyle(video).display,
              src: video.src,
              paused: video.paused,
              readyState: video.readyState
            } : 'MISSING'
          };
        })()
      `
    });
    console.log('\n📊 After Theme Switch Result:\n', JSON.stringify(afterSwitchCheck.result.value, null, 2));

    // Test exam flow functionality
    console.log('\n📝 5. Testing Exam / Practice Launch Feature...');
    const examLaunchCheck = await pageClient.send('Runtime.evaluate', {
      returnByValue: true,
      expression: `
        (() => {
          const galleryBtn = document.getElementById('btn-open-sample-gallery');
          const subjPills = document.querySelectorAll('.subj-pill');
          const setupCards = document.querySelectorAll('.setup-mode-card');
          
          if (galleryBtn) galleryBtn.click();
          const galleryModal = document.getElementById('sample-gallery-modal');

          return {
            hasGalleryBtn: !!galleryBtn,
            subjPillsCount: subjPills.length,
            setupCardsCount: setupCards.length,
            galleryModalOpened: galleryModal ? galleryModal.style.display !== 'none' : false
          };
        })()
      `
    });
    console.log('\n📊 Exam Launch Check Result:\n', JSON.stringify(examLaunchCheck.result.value, null, 2));

    await sleep(1000);
    const shot2 = await pageClient.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('docs/screenshots/cbt-sample-gallery-verified.png', Buffer.from(shot2.data, 'base64'));
    console.log('📸 Saved gallery screenshot to docs/screenshots/cbt-sample-gallery-verified.png');

    pageClient.close();
    browserClient.close();
  } catch (err) {
    console.error('❌ Error during local verification:', err);
  } finally {
    chromeProc.kill();
    serverProc.kill();
  }
}

runVerification();
