import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9224;
const TARGET_URL = 'https://omni-quiz-harilowji.vercel.app/';

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

async function main() {
  const chromeProc = spawn(CHROME_PATH, [
    '--headless=new',
    `--remote-debugging-port=${PORT}`,
    '--disable-gpu',
    '--no-sandbox',
    '--window-size=1280,800'
  ]);

  try {
    const wsUrl = await getWsEndpoint();
    const browserClient = new CDPClient(wsUrl);
    await browserClient.connect();

    const { targetId } = await browserClient.send('Target.createTarget', { url: 'about:blank' });
    const pageClient = new CDPClient(`ws://127.0.0.1:${PORT}/devtools/page/${targetId}`);
    await pageClient.connect();

    await pageClient.send('Page.enable');
    await pageClient.send('Page.navigate', { url: TARGET_URL });
    await sleep(3500);

    // Switch to Dracula theme
    await pageClient.send('Runtime.evaluate', {
      expression: `
        (() => {
          // Force apply Dracula theme
          const sel = document.getElementById('theme-selector');
          if (window.themeManager) {
            window.themeManager.applyTheme('minimalist', false);
          } else {
            // Find theme button in tools modal or click quick theme
            const btn = document.querySelector('[data-theme="minimalist"]');
            if (btn) btn.click();
          }
        })()
      `
    });
    await sleep(2000);

    // Inspect video element in detail
    const videoState = await pageClient.send('Runtime.evaluate', {
      returnByValue: true,
      expression: `
        (() => {
          const v = document.getElementById('app-bg-video');
          const still = document.getElementById('app-bg-still');
          return {
            video: v ? {
              tagName: v.tagName,
              src: v.src,
              currentSrc: v.currentSrc,
              videoWidth: v.videoWidth,
              videoHeight: v.videoHeight,
              currentTime: v.currentTime,
              duration: v.duration,
              paused: v.paused,
              muted: v.muted,
              autoplay: v.autoplay,
              loop: v.loop,
              readyState: v.readyState,
              networkState: v.networkState,
              display: window.getComputedStyle(v).display,
              visibility: window.getComputedStyle(v).visibility,
              opacity: window.getComputedStyle(v).opacity,
              zIndex: window.getComputedStyle(v).zIndex
            } : null,
            bodyBg: window.getComputedStyle(document.body).backgroundColor,
            htmlBg: window.getComputedStyle(document.documentElement).backgroundColor,
            bodyBeforeBg: window.getComputedStyle(document.body, '::before').backgroundColor
          };
        })()
      `
    });

    console.log('Video detailed inspection:', JSON.stringify(videoState.result.value, null, 2));

    // Capture screenshot of Dracula theme
    const shot = await pageClient.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('dracula-test.png', Buffer.from(shot.data, 'base64'));
    console.log('Screenshot saved to dracula-test.png');

    pageClient.close();
    browserClient.close();
  } catch (e) {
    console.error(e);
  } finally {
    chromeProc.kill();
  }
}

main();
