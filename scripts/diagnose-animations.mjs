import { spawn } from 'child_process';
import path from 'path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9223;
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
  console.log('🚀 Spawning Chrome for diagnostics...');
  const chromeProc = spawn(CHROME_PATH, [
    '--headless=new',
    `--remote-debugging-port=${PORT}`,
    '--disable-gpu',
    '--no-sandbox',
    '--window-size=1440,900'
  ]);

  try {
    const wsUrl = await getWsEndpoint();
    const browserClient = new CDPClient(wsUrl);
    await browserClient.connect();

    const { targetId } = await browserClient.send('Target.createTarget', { url: 'about:blank' });
    const targetWsUrl = `ws://127.0.0.1:${PORT}/devtools/page/${targetId}`;
    const pageClient = new CDPClient(targetWsUrl);
    await pageClient.connect();

    await pageClient.send('Page.enable');
    await pageClient.send('Runtime.enable');
    await pageClient.send('Log.enable');

    const consoleLogs = [];
    pageClient.ws.addEventListener('message', evt => {
      try {
        const msg = JSON.parse(evt.data);
        if (msg.method === 'Runtime.consoleAPICalled') {
          consoleLogs.push(`[Console ${msg.params.type}] ` + msg.params.args.map(a => a.value || a.description).join(' '));
        } else if (msg.method === 'Runtime.exceptionThrown') {
          consoleLogs.push(`[Exception] ` + msg.params.exceptionDetails.text + ' ' + (msg.params.exceptionDetails.exception?.description || ''));
        }
      } catch (e) {}
    });

    console.log(`🌐 Navigating to ${TARGET_URL}...`);
    await pageClient.send('Page.navigate', { url: TARGET_URL });
    await sleep(4000);

    const diagnostics = await pageClient.send('Runtime.evaluate', {
      returnByValue: true,
      expression: `
        (() => {
          const video = document.getElementById('app-bg-video');
          const still = document.getElementById('app-bg-still');
          const canvas = document.getElementById('bg-ambient-canvas');
          const bodyTheme = document.body.className;

          return {
            bodyClass: bodyTheme,
            video: video ? {
              display: window.getComputedStyle(video).display,
              opacity: window.getComputedStyle(video).opacity,
              zIndex: window.getComputedStyle(video).zIndex,
              src: video.src,
              paused: video.paused,
              readyState: video.readyState,
              error: video.error ? video.error.message : null
            } : 'MISSING',
            still: still ? {
              display: window.getComputedStyle(still).display,
              opacity: window.getComputedStyle(still).opacity,
              zIndex: window.getComputedStyle(still).zIndex,
              bgImage: window.getComputedStyle(still).backgroundImage
            } : 'MISSING',
            canvas: canvas ? {
              display: window.getComputedStyle(canvas).display,
              opacity: window.getComputedStyle(canvas).opacity,
              zIndex: window.getComputedStyle(canvas).zIndex,
              width: canvas.width,
              height: canvas.height
            } : 'MISSING',
            localStorage: {
              theme: localStorage.getItem('omniquiz_theme'),
              live_bg: localStorage.getItem('omniquiz_live_bg'),
              opacity: localStorage.getItem('omniquiz_bg_opacity')
            }
          };
        })()
      `
    });

    console.log('📊 Diagnostics Result:\n', JSON.stringify(diagnostics.result.value, null, 2));
    console.log('📝 Console Logs:\n', consoleLogs.join('\n'));

    // Now test switching to a video theme (e.g., Dracula or Sakura)
    console.log('\n🔄 Testing switching to Sakura / Dracula theme...');
    await pageClient.send('Runtime.evaluate', {
      expression: `
        (() => {
          const btn = document.getElementById('btn-quick-theme');
          if (btn) btn.click();
        })()
      `
    });
    await sleep(2000);

    const afterSwitch = await pageClient.send('Runtime.evaluate', {
      returnByValue: true,
      expression: `
        (() => {
          const video = document.getElementById('app-bg-video');
          const still = document.getElementById('app-bg-still');
          const canvas = document.getElementById('bg-ambient-canvas');
          return {
            bodyClass: document.body.className,
            video: video ? {
              display: window.getComputedStyle(video).display,
              src: video.src,
              paused: video.paused,
              readyState: video.readyState
            } : 'MISSING',
            still: still ? {
              display: window.getComputedStyle(still).display,
              bgImage: window.getComputedStyle(still).backgroundImage
            } : 'MISSING'
          };
        })()
      `
    });
    console.log('📊 After Switch Result:\n', JSON.stringify(afterSwitch.result.value, null, 2));

    pageClient.close();
    browserClient.close();
  } catch (err) {
    console.error('❌ Error during diagnostics:', err);
  } finally {
    chromeProc.kill();
  }
}

main();
