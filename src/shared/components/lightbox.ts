/**
 * src/shared/components/lightbox.ts - Interactive Diagram Lightbox
 * Features: Wheel Zoom (100% - 400%), Drag/Pan, 90-degree Rotation, Reset & Keyboard Shortcuts
 */

export class DiagramLightbox {
  private overlay: HTMLElement | null = null;
  private imgElement: HTMLImageElement | null = null;
  private scale: number = 1;
  private translateX: number = 0;
  private translateY: number = 0;
  private rotation: number = 0;
  private isDragging: boolean = false;
  private startX: number = 0;
  private startY: number = 0;

  constructor() {
    this.createDom();
  }

  private createDom(): void {
    if (typeof document === 'undefined') return;

    let el = document.getElementById('omniquiz-diagram-lightbox');
    if (!el) {
      el = document.createElement('div');
      el.id = 'omniquiz-diagram-lightbox';
      el.className = 'omniquiz-lightbox-overlay';
      el.style.display = 'none';
      el.innerHTML = `
        <div class="lightbox-toolbar">
          <button type="button" class="btn-lb-tool" id="btn-lb-zoom-in" title="Phóng to (+)">🔍+</button>
          <button type="button" class="btn-lb-tool" id="btn-lb-zoom-out" title="Thu nhỏ (-)">🔍-</button>
          <button type="button" class="btn-lb-tool" id="btn-lb-rotate" title="Xoay 90°">🔄</button>
          <button type="button" class="btn-lb-tool" id="btn-lb-reset" title="Đặt lại (R)">↺</button>
          <button type="button" class="btn-lb-tool btn-lb-close" id="btn-lb-close" title="Đóng (Esc)">✕</button>
        </div>
        <div class="lightbox-viewport" id="lb-viewport">
          <img class="lightbox-img" id="lb-img" alt="Diagram preview" />
        </div>
        <div class="lightbox-hint">Cuộn chuột để Phóng to/Thu nhỏ • Kéo để di chuyển • Nhấn Esc để đóng</div>
      `;
      document.body.appendChild(el);
    }

    this.overlay = el;
    this.imgElement = el.querySelector('#lb-img') as HTMLImageElement;

    this.bindEvents();
  }

  private bindEvents(): void {
    if (!this.overlay || !this.imgElement) return;

    // Close buttons
    const btnClose = this.overlay.querySelector('#btn-lb-close');
    btnClose?.addEventListener('click', () => this.close());

    // Zoom buttons
    this.overlay.querySelector('#btn-lb-zoom-in')?.addEventListener('click', () => {
      this.zoom(0.3);
    });
    this.overlay.querySelector('#btn-lb-zoom-out')?.addEventListener('click', () => {
      this.zoom(-0.3);
    });
    this.overlay.querySelector('#btn-lb-rotate')?.addEventListener('click', () => {
      this.rotate(90);
    });
    this.overlay.querySelector('#btn-lb-reset')?.addEventListener('click', () => {
      this.resetTransform();
    });

    // Viewport pan & mouse wheel zoom
    const viewport = this.overlay.querySelector('#lb-viewport') as HTMLElement;
    viewport?.addEventListener(
      'wheel',
      (e: WheelEvent) => {
        e.preventDefault();
        const delta = e.deltaY < 0 ? 0.2 : -0.2;
        this.zoom(delta);
      },
      { passive: false }
    );

    viewport?.addEventListener('mousedown', (e: MouseEvent) => {
      if (e.button !== 0) return;
      this.isDragging = true;
      this.startX = e.clientX - this.translateX;
      this.startY = e.clientY - this.translateY;
      viewport.style.cursor = 'grabbing';
    });

    window.addEventListener('mousemove', (e: MouseEvent) => {
      if (!this.isDragging) return;
      this.translateX = e.clientX - this.startX;
      this.translateY = e.clientY - this.startY;
      this.updateTransform();
    });

    window.addEventListener('mouseup', () => {
      if (this.isDragging) {
        this.isDragging = false;
        if (viewport) viewport.style.cursor = 'grab';
      }
    });

    // Keyboard support (Escape, +, -, R)
    window.addEventListener('keydown', (e: KeyboardEvent) => {
      if (!this.overlay || this.overlay.style.display === 'none') return;
      if (e.key === 'Escape') this.close();
      if (e.key === '+' || e.key === '=') this.zoom(0.2);
      if (e.key === '-' || e.key === '_') this.zoom(-0.2);
      if (e.key === 'r' || e.key === 'R') this.resetTransform();
    });
  }

  public open(imageSrc: string): void {
    if (!this.overlay || !this.imgElement) return;
    this.imgElement.src = imageSrc;
    this.resetTransform();
    this.overlay.style.display = 'flex';
  }

  public close(): void {
    if (!this.overlay) return;
    this.overlay.style.display = 'none';
    if (this.imgElement) this.imgElement.src = '';
  }

  public zoom(delta: number): void {
    this.scale = Math.min(4.0, Math.max(1.0, this.scale + delta));
    this.updateTransform();
  }

  public rotate(deg: number): void {
    this.rotation = (this.rotation + deg) % 360;
    this.updateTransform();
  }

  public resetTransform(): void {
    this.scale = 1;
    this.translateX = 0;
    this.translateY = 0;
    this.rotation = 0;
    this.updateTransform();
  }

  private updateTransform(): void {
    if (!this.imgElement) return;
    this.imgElement.style.transform = `translate(${this.translateX}px, ${this.translateY}px) scale(${this.scale}) rotate(${this.rotation}deg)`;
  }
}

export const diagramLightbox = new DiagramLightbox();
