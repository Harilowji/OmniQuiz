/**
 * src/features/study-modes/flashcard/flashcard-view.ts - 3D Flashcard View & Spaced Repetition UI
 * Physical 3D CSS flip animations, touch gestures, SM-2 ratings and Dexie persistence.
 */

import type { FlashcardItem, Exam } from '../../../shared/types';
import { SM2Algorithm } from './sm2-algorithm';
import { localDB } from '../../../shared/db/dexie-db';
import { KaTeXRenderer } from '../../../shared/renderers/katex';
import { CodeRenderer } from '../../../shared/renderers/code';
import { sanitizeHtml } from '../../../shared/security/sanitizer';

export class FlashcardView {
  private cards: FlashcardItem[] = [];
  private currentIndex: number = 0;
  private isFlipped: boolean = false;
  private container: HTMLElement | null = null;

  constructor() {}

  public async init(exam: Exam, containerId: string = 'flashcard-deck-container'): Promise<void> {
    this.container = document.getElementById(containerId);
    if (!this.container) return;

    // Load or generate flashcards for this exam
    let existing = await localDB.getDueFlashcards(Date.now() + 86400000 * 30);
    existing = existing.filter((c) => c.id.startsWith(`fc_${exam.id}_`));

    if (existing.length === 0) {
      await localDB.importQuestionsToFlashcards(exam);
      existing = await localDB.getDueFlashcards(Date.now() + 86400000 * 30);
      existing = existing.filter((c) => c.id.startsWith(`fc_${exam.id}_`));
    }

    this.cards = existing;
    this.currentIndex = 0;
    this.isFlipped = false;

    this.render();
  }

  public render(): void {
    if (!this.container) return;

    if (this.cards.length === 0) {
      this.container.innerHTML = `
        <div class="fc-empty-state">
          <div class="fc-empty-icon">🎉</div>
          <h3>Đã hoàn thành thẻ ghi nhớ!</h3>
          <p>Không có thẻ nào cần ôn tập hôm nay theo thuật toán SM-2.</p>
        </div>
      `;
      return;
    }

    const currentCard = this.cards[this.currentIndex];
    if (!currentCard) return;

    const frontHtml = KaTeXRenderer.renderTextWithMath(CodeRenderer.parseMarkdownCodeBlocks(currentCard.front));
    const backHtml = KaTeXRenderer.renderTextWithMath(CodeRenderer.parseMarkdownCodeBlocks(currentCard.back));
    const expHtml = currentCard.explanation
      ? KaTeXRenderer.renderTextWithMath(CodeRenderer.parseMarkdownCodeBlocks(currentCard.explanation))
      : '';

    this.container.innerHTML = sanitizeHtml(`
      <div class="flashcard-studio-wrapper">
        <div class="fc-header-bar">
          <span class="fc-counter">Thẻ ${this.currentIndex + 1} / ${this.cards.length}</span>
          <span class="fc-badge-interval">Khoảng cách: ${currentCard.interval} ngày (EF: ${currentCard.easeFactor})</span>
        </div>

        <div class="fc-perspective-stage">
          <div class="fc-card-3d ${this.isFlipped ? 'flipped' : ''}" id="fc-active-card">
            <!-- Front Face -->
            <div class="fc-card-face fc-card-front">
              <span class="fc-face-tag">CÂU HỎI (MẶT TRƯỚC)</span>
              <div class="fc-card-content">${frontHtml}</div>
              <span class="fc-hint-flip">💡 Nhấp hoặc chạm để lật xem đáp án</span>
            </div>

            <!-- Back Face -->
            <div class="fc-card-face fc-card-back">
              <span class="fc-face-tag">ĐÁP ÁN & GIẢI THÍCH (MẶT SAU)</span>
              <div class="fc-card-content">
                <div class="fc-answer-highlight">${backHtml}</div>
                ${expHtml ? `<div class="fc-exp-box"><strong>Giải thích:</strong> ${expHtml}</div>` : ''}
              </div>
            </div>
          </div>
        </div>

        <!-- SM-2 Rating Controls (Shown after flipped) -->
        <div class="fc-controls-bar">
          <div class="fc-rating-buttons ${this.isFlipped ? 'visible' : ''}">
            <button type="button" class="btn-sm2 btn-sm2-again" data-rate="again">
              <span class="sm2-title">Lặp lại</span>
              <span class="sm2-days">1 ngày</span>
            </button>
            <button type="button" class="btn-sm2 btn-sm2-hard" data-rate="hard">
              <span class="sm2-title">Khó</span>
              <span class="sm2-days">${Math.max(1, Math.round(currentCard.interval * 1.2))} ngày</span>
            </button>
            <button type="button" class="btn-sm2 btn-sm2-good" data-rate="good">
              <span class="sm2-title">Tốt</span>
              <span class="sm2-days">${Math.max(2, Math.round(currentCard.interval * currentCard.easeFactor))} ngày</span>
            </button>
            <button type="button" class="btn-sm2 btn-sm2-easy" data-rate="easy">
              <span class="sm2-title">Dễ</span>
              <span class="sm2-days">${Math.max(4, Math.round(currentCard.interval * currentCard.easeFactor * 1.3))} ngày</span>
            </button>
          </div>
          <div class="fc-nav-row">
            <button type="button" class="btn-action" id="fc-btn-prev" ${this.currentIndex === 0 ? 'disabled' : ''}>← Trước</button>
            <button type="button" class="btn-primary" id="fc-btn-flip">Lật thẻ ↻</button>
            <button type="button" class="btn-action" id="fc-btn-next" ${this.currentIndex >= this.cards.length - 1 ? 'disabled' : ''}>Tiếp →</button>
          </div>
        </div>
      </div>
    `);

    this.bindEvents();
  }

  private bindEvents(): void {
    if (!this.container) return;

    const cardEl = this.container.querySelector('#fc-active-card');
    cardEl?.addEventListener('click', () => this.toggleFlip());

    const btnFlip = this.container.querySelector('#fc-btn-flip');
    btnFlip?.addEventListener('click', () => this.toggleFlip());

    const btnPrev = this.container.querySelector('#fc-btn-prev');
    btnPrev?.addEventListener('click', () => this.prevCard());

    const btnNext = this.container.querySelector('#fc-btn-next');
    btnNext?.addEventListener('click', () => this.nextCard());

    // SM-2 rating buttons
    const rateButtons = this.container.querySelectorAll('.btn-sm2');
    rateButtons.forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        const target = e.currentTarget as HTMLElement;
        const rate = target.getAttribute('data-rate') as 'again' | 'hard' | 'good' | 'easy';
        if (rate) {
          await this.handleRating(rate);
        }
      });
    });
  }

  public toggleFlip(): void {
    this.isFlipped = !this.isFlipped;
    const cardEl = this.container?.querySelector('#fc-active-card');
    cardEl?.classList.toggle('flipped', this.isFlipped);
    const ratingBar = this.container?.querySelector('.fc-rating-buttons');
    ratingBar?.classList.toggle('visible', this.isFlipped);
  }

  public async handleRating(quality: 'again' | 'hard' | 'good' | 'easy'): Promise<void> {
    const card = this.cards[this.currentIndex];
    if (!card) return;

    const updated = SM2Algorithm.rateCard(card, quality);
    this.cards[this.currentIndex] = updated;

    await localDB.saveFlashcard(updated);

    this.isFlipped = false;
    if (this.currentIndex < this.cards.length - 1) {
      this.currentIndex++;
    } else {
      this.currentIndex = 0;
    }
    this.render();
  }

  public nextCard(): void {
    if (this.currentIndex < this.cards.length - 1) {
      this.currentIndex++;
      this.isFlipped = false;
      this.render();
    }
  }

  public prevCard(): void {
    if (this.currentIndex > 0) {
      this.currentIndex--;
      this.isFlipped = false;
      this.render();
    }
  }
}

export const flashcardView = new FlashcardView();
