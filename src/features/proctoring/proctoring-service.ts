/**
 * src/features/proctoring/proctoring-service.ts - CBT Proctoring & Anti-Cheat Hub
 * Enforces HTML5 Fullscreen, tab visibility, interaction lockdowns, and tiered violations.
 */

import type { ExamViolation, ViolationType } from '../../shared/types';

export interface ProctoringCallbacks {
  onTier1Warning: (violation: ExamViolation) => void;
  onTier2Modal: (violation: ExamViolation, resume: () => void) => void;
  onTier3Disqualified: (violation: ExamViolation) => void;
  onTimerPause: () => void;
  onTimerResume: () => void;
}

export class ProctoringService {
  private isActive: boolean = false;
  private violations: ExamViolation[] = [];
  private callbacks: ProctoringCallbacks | null = null;
  private resizeDebounce: number = 0;
  private blurTimeout: number = 0;
  private readonly BLUR_GRACE_PERIOD_MS = 400;
  private originalWidth: number = 0;
  private originalHeight: number = 0;

  constructor() {
    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.handleContextMenu = this.handleContextMenu.bind(this);
    this.handleCopyCut = this.handleCopyCut.bind(this);
    this.handleSelectStart = this.handleSelectStart.bind(this);
    this.handleVisibilityChange = this.handleVisibilityChange.bind(this);
    this.handleWindowBlur = this.handleWindowBlur.bind(this);
    this.handleWindowFocus = this.handleWindowFocus.bind(this);
    this.handleFullscreenChange = this.handleFullscreenChange.bind(this);
    this.handleResize = this.handleResize.bind(this);
  }

  /**
   * Start proctoring session for CBT Exam
   */
  public async startProctoring(callbacks: ProctoringCallbacks): Promise<boolean> {
    this.isActive = true;
    this.violations = [];
    this.callbacks = callbacks;

    if (typeof window !== 'undefined') {
      this.originalWidth = window.innerWidth;
      this.originalHeight = window.innerHeight;

      // 1. Enforce Fullscreen
      await this.requestFullscreen();

      // 2. Attach Security Listeners
      window.addEventListener('keydown', this.handleKeyDown, true);
      document.addEventListener('contextmenu', this.handleContextMenu, true);
      document.addEventListener('copy', this.handleCopyCut, true);
      document.addEventListener('cut', this.handleCopyCut, true);
      document.addEventListener('selectstart', this.handleSelectStart, true);
      document.addEventListener('visibilitychange', this.handleVisibilityChange, true);
      window.addEventListener('blur', this.handleWindowBlur, true);
      window.addEventListener('focus', this.handleWindowFocus, true);
      document.addEventListener('fullscreenchange', this.handleFullscreenChange, true);
      window.addEventListener('resize', this.handleResize, true);
    }

    return true;
  }

  /**
   * Stop proctoring session
   */
  public stopProctoring(): void {
    this.isActive = false;
    this.cancelBlurCheck();

    if (typeof window !== 'undefined') {
      window.removeEventListener('keydown', this.handleKeyDown, true);
      document.removeEventListener('contextmenu', this.handleContextMenu, true);
      document.removeEventListener('copy', this.handleCopyCut, true);
      document.removeEventListener('cut', this.handleCopyCut, true);
      document.removeEventListener('selectstart', this.handleSelectStart, true);
      document.removeEventListener('visibilitychange', this.handleVisibilityChange, true);
      window.removeEventListener('blur', this.handleWindowBlur, true);
      window.removeEventListener('focus', this.handleWindowFocus, true);
      document.removeEventListener('fullscreenchange', this.handleFullscreenChange, true);
      window.removeEventListener('resize', this.handleResize, true);

      this.exitFullscreen();
    }
  }

  public getViolations(): ExamViolation[] {
    return [...this.violations];
  }

  /**
   * Fullscreen API Request
   */
  private async requestFullscreen(): Promise<void> {
    const docEl = document.documentElement as HTMLElement & {
      webkitRequestFullscreen?: () => Promise<void>;
      mozRequestFullScreen?: () => Promise<void>;
      msRequestFullscreen?: () => Promise<void>;
    };

    try {
      if (docEl.requestFullscreen) {
        await docEl.requestFullscreen();
      } else if (docEl.webkitRequestFullscreen) {
        await docEl.webkitRequestFullscreen();
      } else if (docEl.mozRequestFullScreen) {
        await docEl.mozRequestFullScreen();
      } else if (docEl.msRequestFullscreen) {
        await docEl.msRequestFullscreen();
      }
    } catch (err) {
      console.warn('[Proctoring Fullscreen Request Warning]:', err);
    }
  }

  /**
   * Exit Fullscreen
   */
  private exitFullscreen(): void {
    if (!document.fullscreenElement) return;
    try {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
    } catch {
      // Ignore exit error
    }
  }

  /**
   * Record a security violation and trigger tiered handling
   */
  private recordViolation(type: ViolationType, detail: string): void {
    if (!this.isActive) return;

    const count = this.violations.length + 1;
    const tier = count === 1 ? 1 : count === 2 ? 2 : 3;

    const violation: ExamViolation = {
      id: `viol_${Date.now()}_${count}`,
      type,
      timestamp: Date.now(),
      detail,
      tier,
    };

    this.violations.push(violation);

    // Pause exam timer immediately
    this.callbacks?.onTimerPause();

    if (tier === 1) {
      this.callbacks?.onTier1Warning(violation);
    } else if (tier === 2) {
      this.callbacks?.onTier2Modal(violation, () => {
        this.requestFullscreen().then(() => {
          this.callbacks?.onTimerResume();
        });
      });
    } else {
      // Tier 3: Complete disqualification and freeze
      this.callbacks?.onTier3Disqualified(violation);
      this.stopProctoring();
    }
  }

  /**
   * Event Handlers
   */
  private handleKeyDown(e: KeyboardEvent): void {
    if (!this.isActive) return;

    // Block F12 DevTools
    if (e.key === 'F12') {
      e.preventDefault();
      e.stopPropagation();
      this.recordViolation('dev_tools', 'Cố gắng mở Developer Tools (F12)');
      return;
    }

    // Block Ctrl+Shift+I / J / C (DevTools)
    if (e.ctrlKey && e.shiftKey && ['I', 'J', 'C', 'i', 'j', 'c'].includes(e.key)) {
      e.preventDefault();
      e.stopPropagation();
      this.recordViolation('dev_tools', 'Phím tắt Developer Tools (Ctrl+Shift+I/J/C)');
      return;
    }

    // Block PrintScreen
    if (e.key === 'PrintScreen') {
      e.preventDefault();
      this.recordViolation('copy_paste_attempt', 'Cố gắng chụp ảnh màn hình đề thi (PrintScreen)');
      return;
    }

    // Block Ctrl+U (View Source)
    if (e.ctrlKey && (e.key === 'u' || e.key === 'U')) {
      e.preventDefault();
      this.recordViolation('dev_tools', 'Cố gắng xem mã nguồn trang (Ctrl+U)');
      return;
    }

    // Block Ctrl+C, Ctrl+V, Ctrl+X
    if (e.ctrlKey && ['c', 'v', 'x', 'C', 'V', 'X'].includes(e.key)) {
      e.preventDefault();
      this.recordViolation('copy_paste_attempt', `Cố gắng sao chép/dán nội dung (Ctrl+${e.key.toUpperCase()})`);
      return;
    }
  }

  private handleContextMenu(e: MouseEvent): void {
    if (!this.isActive) return;
    e.preventDefault();
    this.recordViolation('context_menu', 'Cố gắng nhấp chuột phải trên đề thi');
  }

  private handleCopyCut(e: ClipboardEvent): void {
    if (!this.isActive) return;
    e.preventDefault();
    this.recordViolation('copy_paste_attempt', 'Hành vi sao chép/cắt văn bản bị chặn');
  }

  private handleSelectStart(e: Event): void {
    if (!this.isActive) return;
    // Disallow text selection on question blocks
    const target = e.target as HTMLElement;
    if (target?.closest?.('.question-block, .q-text, .option')) {
      e.preventDefault();
    }
  }

  private handleVisibilityChange(): void {
    if (!this.isActive) return;
    if (typeof document !== 'undefined' && document.hidden) {
      this.scheduleBlurCheck('visibility_hidden', 'Rời khỏi trang thi hoặc chuyển sang tab khác');
    } else {
      this.cancelBlurCheck();
    }
  }

  private handleWindowBlur(): void {
    if (!this.isActive) return;
    this.scheduleBlurCheck('tab_blur', 'Cửa sổ thi bị mất tiêu điểm (Focus)');
  }

  private handleWindowFocus(): void {
    this.cancelBlurCheck();
  }

  private scheduleBlurCheck(type: ViolationType, message: string): void {
    this.cancelBlurCheck();
    if (typeof window === 'undefined') return;

    this.blurTimeout = window.setTimeout(() => {
      if (!this.isActive) return;
      const isBlurred =
        typeof document !== 'undefined' &&
        (typeof document.hasFocus === 'function' ? !document.hasFocus() : false || document.hidden);

      if (isBlurred) {
        this.recordViolation(type, message);
      }
    }, this.BLUR_GRACE_PERIOD_MS);
  }

  private cancelBlurCheck(): void {
    if (this.blurTimeout) {
      window.clearTimeout(this.blurTimeout);
      this.blurTimeout = 0;
    }
  }

  private handleFullscreenChange(): void {
    if (!this.isActive) return;
    if (!document.fullscreenElement) {
      this.recordViolation('fullscreen_exit', 'Thoát khỏi chế độ toàn màn hình khi đang làm bài thi');
    }
  }

  private handleResize(): void {
    if (!this.isActive) return;
    window.clearTimeout(this.resizeDebounce);
    this.resizeDebounce = window.setTimeout(() => {
      const widthDiff = Math.abs(window.innerWidth - this.originalWidth);
      const heightDiff = Math.abs(window.innerHeight - this.originalHeight);
      // If sudden major size drop without fullscreen exit (e.g. split screen)
      if (widthDiff > 200 || heightDiff > 200) {
        if (!document.fullscreenElement) {
          this.recordViolation('fullscreen_exit', 'Thay đổi kích thước cửa sổ đột ngột (Chia đôi màn hình)');
        }
      }
    }, 400);
  }
}

export const proctoringService = new ProctoringService();
