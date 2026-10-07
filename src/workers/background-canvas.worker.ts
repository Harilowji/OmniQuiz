/**
 * src/workers/background-canvas.worker.ts
 * High-Refresh 120 FPS Ambient Background Canvas Engine using OffscreenCanvas
 * Frees 100% of the UI Main Thread from animation loops and canvas rendering overhead.
 */

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  baseAlpha: number;
}

export interface WorkerInitMessage {
  type: 'INIT';
  canvas: OffscreenCanvas;
  width: number;
  height: number;
  theme?: string;
}

export interface WorkerResizeMessage {
  type: 'RESIZE';
  width: number;
  height: number;
}

export interface WorkerThemeMessage {
  type: 'THEME';
  theme: string;
}

export interface WorkerControlMessage {
  type: 'PAUSE' | 'RESUME';
}

export type WorkerMessage =
  | WorkerInitMessage
  | WorkerResizeMessage
  | WorkerThemeMessage
  | WorkerControlMessage;

class BackgroundCanvasWorker {
  private canvas: OffscreenCanvas | null = null;
  private ctx: OffscreenCanvasRenderingContext2D | null = null;
  private width: number = 0;
  private height: number = 0;
  private particles: Particle[] = [];
  private isRunning: boolean = false;
  private isPaused: boolean = false;
  private animFrameId: number | null = null;
  private particleColor: string = 'rgba(0, 240, 255, 0.4)';
  private lineColor: string = 'rgba(0, 240, 255, 0.12)';

  public init(canvas: OffscreenCanvas, width: number, height: number, theme: string = 'cyberpunk'): void {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d') as OffscreenCanvasRenderingContext2D | null;
    this.resize(width, height);
    this.setTheme(theme);
    this.spawnParticles();
    this.startLoop();
  }

  public resize(width: number, height: number): void {
    this.width = Math.max(10, width);
    this.height = Math.max(10, height);
    if (this.canvas) {
      this.canvas.width = this.width;
      this.canvas.height = this.height;
    }
  }

  public setTheme(theme: string): void {
    switch (theme) {
      case 'academic':
        this.particleColor = 'rgba(74, 155, 201, 0.45)';
        this.lineColor = 'rgba(74, 155, 201, 0.15)';
        break;
      case 'playful':
        this.particleColor = 'rgba(255, 154, 175, 0.45)';
        this.lineColor = 'rgba(255, 154, 175, 0.15)';
        break;
      case 'emerald':
        this.particleColor = 'rgba(16, 185, 129, 0.45)';
        this.lineColor = 'rgba(16, 185, 129, 0.15)';
        break;
      case 'sepia':
        this.particleColor = 'rgba(245, 158, 11, 0.45)';
        this.lineColor = 'rgba(245, 158, 11, 0.15)';
        break;
      case 'minimalist':
        this.particleColor = 'rgba(189, 147, 249, 0.45)';
        this.lineColor = 'rgba(189, 147, 249, 0.15)';
        break;
      case 'cyberpunk':
      default:
        this.particleColor = 'rgba(0, 240, 255, 0.45)';
        this.lineColor = 'rgba(0, 240, 255, 0.15)';
        break;
    }
  }

  public pause(): void {
    this.isPaused = true;
    if (this.animFrameId !== null && typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
  }

  public resume(): void {
    if (this.isPaused) {
      this.isPaused = false;
      this.startLoop();
    }
  }

  private spawnParticles(): void {
    const count = Math.min(45, Math.floor((this.width * this.height) / 35000));
    this.particles = [];

    for (let i = 0; i < count; i++) {
      this.particles.push({
        x: Math.random() * this.width,
        y: Math.random() * this.height,
        vx: (Math.random() - 0.5) * 0.75,
        vy: (Math.random() - 0.5) * 0.75,
        radius: Math.random() * 2 + 1.2,
        baseAlpha: Math.random() * 0.5 + 0.3,
      });
    }
  }

  private startLoop(): void {
    if (!this.ctx || this.isPaused) return;
    this.isRunning = true;

    const render = () => {
      if (!this.isRunning || this.isPaused || !this.ctx) return;
      this.drawFrame();
      if (typeof requestAnimationFrame === 'function') {
        this.animFrameId = requestAnimationFrame(render);
      }
    };

    if (typeof requestAnimationFrame === 'function') {
      this.animFrameId = requestAnimationFrame(render);
    }
  }

  private drawFrame(): void {
    if (!this.ctx) return;
    this.ctx.clearRect(0, 0, this.width, this.height);

    const maxDist = 120;
    const len = this.particles.length;

    // Draw connecting vectors
    for (let i = 0; i < len; i++) {
      const p1 = this.particles[i];
      if (!p1) continue;

      for (let j = i + 1; j < len; j++) {
        const p2 = this.particles[j];
        if (!p2) continue;

        const dx = p1.x - p2.x;
        const dy = p1.y - p2.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < maxDist) {
          const alpha = (1 - dist / maxDist) * 0.25;
          this.ctx.beginPath();
          this.ctx.strokeStyle = this.lineColor.replace(/[\d.]+\)$/, `${alpha})`);
          this.ctx.lineWidth = 0.8;
          this.ctx.moveTo(p1.x, p1.y);
          this.ctx.lineTo(p2.x, p2.y);
          this.ctx.stroke();
        }
      }
    }

    // Update and draw particle nodes
    for (let i = 0; i < len; i++) {
      const p = this.particles[i];
      if (!p) continue;

      p.x += p.vx;
      p.y += p.vy;

      if (p.x < 0) {
        p.x = 0;
        p.vx *= -1;
      } else if (p.x > this.width) {
        p.x = this.width;
        p.vx *= -1;
      }

      if (p.y < 0) {
        p.y = 0;
        p.vy *= -1;
      } else if (p.y > this.height) {
        p.y = this.height;
        p.vy *= -1;
      }

      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      this.ctx.fillStyle = this.particleColor;
      this.ctx.fill();
    }
  }
}

// Attach listener in Web Worker scope
if (typeof self !== 'undefined' && typeof (self as unknown as WorkerGlobalScope).addEventListener === 'function') {
  const engine = new BackgroundCanvasWorker();

  self.addEventListener('message', (event: MessageEvent<WorkerMessage>) => {
    const data = event.data;
    if (!data) return;

    switch (data.type) {
      case 'INIT':
        engine.init(data.canvas, data.width, data.height, data.theme);
        break;
      case 'RESIZE':
        engine.resize(data.width, data.height);
        break;
      case 'THEME':
        engine.setTheme(data.theme);
        break;
      case 'PAUSE':
        engine.pause();
        break;
      case 'RESUME':
        engine.resume();
        break;
    }
  });
}
