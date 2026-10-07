/**
 * src/features/exam-engine/question-navigator.ts - Question Palette Navigator & Hotkey Controls
 * Supports Keyboard Shortcuts (Arrows, 1-4, A-D, F, E), ScrollSpy & Palette Status Sync
 */

import type { QuestionCardStatus } from '../../shared/types';
import { examStateMachine } from './exam-state-machine';

export interface NavigatorCallbacks {
  onQuestionSelect: (index: number) => void;
  onOptionToggle: (qIndex: number, optIndex: number) => void;
  onFlagToggle: (qIndex: number) => void;
  onEliminateToggle?: (qIndex: number, optIndex: number) => void;
}

export class QuestionNavigator {
  private totalQuestions: number = 0;
  private currentIndex: number = 0;
  private callbacks: NavigatorCallbacks | null = null;
  private isEliminateMode: boolean = false;
  private isEnabled: boolean = false;

  constructor() {
    this.handleGlobalKeyDown = this.handleGlobalKeyDown.bind(this);
  }

  public init(totalQuestions: number, callbacks: NavigatorCallbacks): void {
    this.totalQuestions = totalQuestions;
    this.currentIndex = 0;
    this.callbacks = callbacks;
    this.isEnabled = true;
    this.isEliminateMode = false;

    if (typeof window !== 'undefined') {
      window.removeEventListener('keydown', this.handleGlobalKeyDown);
      window.addEventListener('keydown', this.handleGlobalKeyDown);
    }
  }

  public destroy(): void {
    this.isEnabled = false;
    if (typeof window !== 'undefined') {
      window.removeEventListener('keydown', this.handleGlobalKeyDown);
    }
  }

  public setIndex(index: number): void {
    if (index >= 0 && index < this.totalQuestions) {
      this.currentIndex = index;
      examStateMachine.setCurrentQuestionIndex(index);
      this.callbacks?.onQuestionSelect(index);
      this.scrollToQuestion(index);
    }
  }

  public getCurrentIndex(): number {
    return this.currentIndex;
  }

  public nextQuestion(): void {
    if (this.currentIndex < this.totalQuestions - 1) {
      this.setIndex(this.currentIndex + 1);
    }
  }

  public prevQuestion(): void {
    if (this.currentIndex > 0) {
      this.setIndex(this.currentIndex - 1);
    }
  }

  /**
   * Bind touch swipe left/right gestures on a container element (<768px navigation)
   */
  public bindTouchSwipe(container: HTMLElement): () => void {
    let touchStartX = 0;
    let touchStartY = 0;

    const onTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      if (touch) {
        touchStartX = touch.clientX;
        touchStartY = touch.clientY;
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      const touch = e.changedTouches[0];
      if (!touch) return;
      const diffX = touch.clientX - touchStartX;
      const diffY = touch.clientY - touchStartY;

      // Minimum swipe threshold 50px, predominantly horizontal
      if (Math.abs(diffX) > 50 && Math.abs(diffX) > Math.abs(diffY) * 1.5) {
        const triggerNav = () => {
          if (diffX < 0) {
            // Swipe left -> next question
            this.nextQuestion();
          } else {
            // Swipe right -> previous question
            this.prevQuestion();
          }
        };

        if (typeof requestAnimationFrame === 'function') {
          requestAnimationFrame(triggerNav);
        } else {
          triggerNav();
        }
      }
    };

    container.addEventListener('touchstart', onTouchStart, { passive: true });
    container.addEventListener('touchend', onTouchEnd, { passive: true });

    return () => {
      container.removeEventListener('touchstart', onTouchStart);
      container.removeEventListener('touchend', onTouchEnd);
    };
  }

  public toggleEliminateMode(): boolean {
    this.isEliminateMode = !this.isEliminateMode;
    return this.isEliminateMode;
  }

  public getQuestionStatus(
    index: number,
    answers: Record<number, number[]>,
    flagged: number[]
  ): QuestionCardStatus {
    if (index === this.currentIndex) return 'current';
    if (flagged.includes(index)) return 'flagged';
    const userAns = answers[index];
    if (userAns && userAns.length > 0) return 'answered';
    return 'unanswered';
  }

  /**
   * Scroll smoothly to question element in DOM (120 FPS requestAnimationFrame paced)
   */
  public scrollToQuestion(index: number): void {
    if (typeof document === 'undefined') return;
    const target = document.getElementById(`q-card-${index}`);
    if (target && typeof target.scrollIntoView === 'function') {
      const doScroll = () => {
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      };
      if (typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(doScroll);
      } else {
        doScroll();
      }
    }
  }

  /**
   * Keyboard shortcuts router
   */
  private handleGlobalKeyDown(e: KeyboardEvent): void {
    if (!this.isEnabled) return;

    // Ignore hotkeys when typing in text inputs or textareas
    const activeEl = document.activeElement;
    if (
      activeEl &&
      (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.getAttribute('contenteditable'))
    ) {
      return;
    }

    // 1. Navigation: ArrowLeft / ArrowRight / J / K
    if (e.key === 'ArrowRight' || e.key === 'j' || e.key === 'J') {
      e.preventDefault();
      this.nextQuestion();
      return;
    }
    if (e.key === 'ArrowLeft' || e.key === 'k' || e.key === 'K') {
      e.preventDefault();
      this.prevQuestion();
      return;
    }

    // 2. Option Selection: 1-4 or A-D
    const key = e.key.toUpperCase();
    const optMap: Record<string, number> = {
      '1': 0,
      '2': 1,
      '3': 2,
      '4': 3,
      A: 0,
      B: 1,
      C: 2,
      D: 3,
    };

    if (key in optMap) {
      const optIdx = optMap[key];
      if (optIdx !== undefined) {
        e.preventDefault();
        if (this.isEliminateMode && this.callbacks?.onEliminateToggle) {
          this.callbacks.onEliminateToggle(this.currentIndex, optIdx);
        } else {
          this.callbacks?.onOptionToggle(this.currentIndex, optIdx);
        }
      }
      return;
    }

    // 3. Flag / Bookmark: F
    if (key === 'F') {
      e.preventDefault();
      this.callbacks?.onFlagToggle(this.currentIndex);
      return;
    }

    // 4. Eliminate Tool: E
    if (key === 'E') {
      e.preventDefault();
      this.toggleEliminateMode();
      return;
    }
  }
}

export const questionNavigator = new QuestionNavigator();
