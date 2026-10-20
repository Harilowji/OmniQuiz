/**
 * src/features/parser/smart-review-editor.ts - Smart Exam Review & Split-Screen Editor
 * Implements Azota-style 2-column verification:
 * - Left pane (40%): Original raw text with question markers & quick filter pills
 * - Right pane (60%): Interactive Bento question cards with 1-click answer toggling,
 *   inline text editing, KaTeX math preview, merge, delete, and validation banner.
 */

import type { Exam, Question, ParserWarning } from '../../shared/types';
import type { ParseExamReportResult } from './document-parser';

type FilterType = 'all' | 'missing_answer' | 'missing_options';

export class SmartReviewEditor {
  private modalEl: HTMLElement | null = null;
  private currentExam: Exam | null = null;
  private warnings: ParserWarning[] = [];
  private rawText: string = '';
  private activeFilter: FilterType = 'all';
  private onConfirmCallback: ((exam: Exam) => void) | null = null;

  public init(): void {
    this.modalEl = document.getElementById('smart-review-modal');
  }

  /**
   * Opens the Smart Review & Split-Screen Editor modal
   */
  public open(
    report: ParseExamReportResult,
    onConfirm: (updatedExam: Exam) => void
  ): void {
    if (!this.modalEl) {
      this.init();
    }

    // Deep clone exam so edits are isolated
    this.currentExam = JSON.parse(JSON.stringify(report.exam)) as Exam;
    this.warnings = [...report.warnings];
    this.rawText = report.rawExtractedText || '';
    this.activeFilter = 'all';
    this.onConfirmCallback = onConfirm;

    if (this.modalEl) {
      this.modalEl.style.display = 'flex';
      document.body.classList.add('modal-open');
      this.render();
    }
  }

  /**
   * Closes the review editor modal
   */
  public close(): void {
    if (this.modalEl) {
      this.modalEl.style.display = 'none';
      document.body.classList.remove('modal-open');
    }
  }

  /**
   * Re-computes validation warnings from the current questions
   */
  private updateValidationWarnings(): void {
    if (!this.currentExam) return;
    this.warnings = [];

    this.currentExam.questions.forEach((q, idx) => {
      // Re-index for safety
      q.index = idx + 1;

      if (!q.options || q.options.length < 2) {
        this.warnings.push({
          questionIndex: q.index,
          type: 'missing_options',
          message: `Câu ${q.index} chỉ có ${q.options ? q.options.length : 0} lựa chọn.`,
        });
      }

      if (!q.correctAnswer || q.correctAnswer.length === 0) {
        this.warnings.push({
          questionIndex: q.index,
          type: 'missing_answer',
          message: `Câu ${q.index} chưa có đáp án đúng.`,
        });
      }
    });
  }

  /**
   * Renders the entire split-screen editor UI
   */
  private render(): void {
    if (!this.modalEl || !this.currentExam) return;

    this.updateValidationWarnings();

    const missingAnsQuestions = this.currentExam.questions.filter(
      (q) => !q.correctAnswer || q.correctAnswer.length === 0
    );
    const missingOptQuestions = this.currentExam.questions.filter(
      (q) => !q.options || q.options.length < 4
    );

    const totalQuestions = this.currentExam.questions.length;
    const missingAnsCount = missingAnsQuestions.length;
    const missingOptCount = missingOptQuestions.length;

    // Filter questions for display
    let visibleQuestions = this.currentExam.questions;
    if (this.activeFilter === 'missing_answer') {
      visibleQuestions = missingAnsQuestions;
    } else if (this.activeFilter === 'missing_options') {
      visibleQuestions = missingOptQuestions;
    }

    const html = `
      <div class="modal-content smart-review-card">
        <!-- Top Sticky Header -->
        <div class="smart-review-header">
          <div class="smart-review-title-group">
            <div class="smart-review-badge">🎯 Duyệt Đề Chuẩn Azota</div>
            <h2 class="smart-review-title">${this.escapeHtml(this.currentExam.title)}</h2>
            <p class="smart-review-subtitle">
              Kiểm tra đề thi 2 cột trước khi tổ chức thi • Tổng số: <strong>${totalQuestions} câu</strong>
            </p>
          </div>
          <button type="button" class="btn-close-modal" id="btn-close-smart-review" title="Đóng">&times;</button>
        </div>

        <!-- Validation Alert Banner -->
        ${
          missingAnsCount > 0
            ? `
          <div class="smart-review-alert-banner">
            <div class="alert-banner-text">
              <span class="alert-icon">⚠️</span>
              <span>Phát hiện <strong>${missingAnsCount} câu</strong> chưa có đáp án đúng. Vui lòng bấm vào nút tròn A/B/C/D để chọn đáp án đúng!</span>
            </div>
            <button type="button" class="btn-action btn-sm btn-jump-error" id="btn-jump-next-error">
              🔍 Nhảy tới câu chưa có đáp án
            </button>
          </div>
        `
            : `
          <div class="smart-review-success-banner">
            <span class="success-icon">✅</span>
            <span>Tuyệt vời! Toàn bộ <strong>${totalQuestions} câu hỏi</strong> đã có đầy đủ đáp án đúng và sẵn sàng xuất bản.</span>
          </div>
        `
        }

        <!-- Split Screen Container -->
        <div class="smart-review-split-grid">
          <!-- Left Column (40%): Raw Text & Quick Filter -->
          <div class="smart-review-raw-pane">
            <div class="raw-pane-toolbar">
              <span class="raw-pane-label">📄 Văn bản gốc trích xuất</span>
              <div class="raw-filter-pills">
                <button type="button" class="filter-pill ${this.activeFilter === 'all' ? 'active' : ''}" data-filter="all">
                  Tất cả (${totalQuestions})
                </button>
                <button type="button" class="filter-pill ${this.activeFilter === 'missing_answer' ? 'active' : ''}" data-filter="missing_answer">
                  Thiếu đáp án (${missingAnsCount})
                </button>
                <button type="button" class="filter-pill ${this.activeFilter === 'missing_options' ? 'active' : ''}" data-filter="missing_options">
                  Lỗi lựa chọn (${missingOptCount})
                </button>
              </div>
            </div>

            <div class="raw-text-content" id="smart-review-raw-text">
              <pre><code>${this.escapeHtml(this.rawText || 'Không có văn bản gốc.')}</code></pre>
            </div>
          </div>

          <!-- Right Column (60%): Interactive Bento Question Cards -->
          <div class="smart-review-cards-pane" id="smart-review-cards-container">
            ${
              visibleQuestions.length === 0
                ? `<div class="empty-filter-state">Không có câu hỏi nào khớp với bộ lọc hiện tại.</div>`
                : visibleQuestions.map((q) => this.renderQuestionCard(q)).join('')
            }
          </div>
        </div>

        <!-- Bottom Sticky Action Bar -->
        <div class="smart-review-footer">
          <div class="footer-stats">
            <span>Sẵn sàng: <strong>${totalQuestions - missingAnsCount}/${totalQuestions}</strong> câu hợp lệ</span>
          </div>
          <div class="footer-actions">
            <button type="button" class="btn-action btn-secondary" id="btn-cancel-smart-review">Hủy</button>
            <button type="button" class="btn-action btn-primary btn-save-exam" id="btn-confirm-smart-review">
              💾 Lưu & Bắt đầu thi (${totalQuestions} câu)
            </button>
          </div>
        </div>
      </div>
    `;

    this.modalEl.innerHTML = html;
    this.bindEvents();
    this.renderMathPreview();
  }

  /**
   * Renders a single interactive Bento Question Card
   */
  private renderQuestionCard(q: Question): string {
    const letters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
    const hasAnswer = q.correctAnswer && q.correctAnswer.length > 0;

    return `
      <div class="review-question-card ${!hasAnswer ? 'card-has-error' : ''}" id="review-card-${q.index}" data-q-index="${q.index}">
        <div class="review-card-header">
          <div class="review-card-index-pill">
            <span>Câu ${q.index}</span>
            ${
              !hasAnswer
                ? `<span class="badge-error-pill">⚠️ Chưa có đáp án đúng</span>`
                : `<span class="badge-success-pill">✓ Đã có đáp án</span>`
            }
            ${q.type === 'multiple' ? `<span class="badge-type-pill">Nhiều đáp án</span>` : ''}
          </div>
          <div class="review-card-actions">
            ${
              q.index > 1
                ? `<button type="button" class="btn-card-tool btn-merge-up" data-action="merge" data-index="${q.index}" title="Gộp vào câu phía trước">🔗 Gộp vào câu trên</button>`
                : ''
            }
            <button type="button" class="btn-card-tool btn-delete-q" data-action="delete" data-index="${q.index}" title="Xóa câu hỏi này">🗑️ Xóa</button>
          </div>
        </div>

        <!-- Editable Question Content -->
        <div class="review-question-body">
          <label class="review-field-label">Nội dung câu hỏi (hỗ trợ $ LaTeX $):</label>
          <div class="review-editable-text question-text-editable" contenteditable="true" data-index="${q.index}" data-field="questionText">
            ${this.escapeHtml(q.text)}
          </div>
        </div>

        <!-- Editable Options List with 1-click correct answer toggle -->
        <div class="review-options-list">
          <label class="review-field-label">Các lựa chọn (bấm vào nút chữ cái tròn để chọn đáp án đúng):</label>
          ${q.options
            .map((opt, optIdx) => {
              const letter = letters[optIdx] ?? String(optIdx + 1);
              const isCorrect = q.correctAnswer && q.correctAnswer.includes(optIdx);

              return `
                <div class="review-option-row ${isCorrect ? 'option-row-correct' : ''}">
                  <button type="button" 
                          class="opt-toggle-badge ${isCorrect ? 'active-correct' : ''}" 
                          data-action="toggle-ans" 
                          data-q-index="${q.index}" 
                          data-opt-index="${optIdx}" 
                          title="Bấm để đánh dấu đáp án đúng">
                    ${letter}
                  </button>
                  <div class="review-editable-text option-text-editable" 
                       contenteditable="true" 
                       data-q-index="${q.index}" 
                       data-opt-index="${optIdx}" 
                       data-field="optionText">
                    ${this.escapeHtml(opt)}
                  </div>
                  <button type="button" class="btn-remove-opt" data-action="remove-opt" data-q-index="${q.index}" data-opt-index="${optIdx}" title="Xóa lựa chọn này">&times;</button>
                </div>
              `;
            })
            .join('')}
        </div>

        <!-- Add Option & Explanation -->
        <div class="review-card-footer-tools">
          <button type="button" class="btn-add-opt" data-action="add-opt" data-q-index="${q.index}">
            ➕ Thêm lựa chọn
          </button>
          ${
            q.explanation
              ? `
            <div class="review-explanation-preview">
              <span class="exp-label">💡 Lời giải:</span>
              <span class="exp-text">${this.escapeHtml(q.explanation)}</span>
            </div>
          `
              : ''
          }
        </div>
      </div>
    `;
  }

  /**
   * Binds interactive events for filter buttons, editable fields, and card tools
   */
  private bindEvents(): void {
    if (!this.modalEl || !this.currentExam) return;

    // 1. Close buttons
    const btnClose = this.modalEl.querySelector('#btn-close-smart-review');
    const btnCancel = this.modalEl.querySelector('#btn-cancel-smart-review');
    btnClose?.addEventListener('click', () => this.close());
    btnCancel?.addEventListener('click', () => this.close());

    // 2. Confirm / Save button
    const btnConfirm = this.modalEl.querySelector('#btn-confirm-smart-review');
    btnConfirm?.addEventListener('click', () => {
      this.updateValidationWarnings();
      if (this.currentExam) {
        this.currentExam.totalQuestions = this.currentExam.questions.length;
        this.currentExam.updatedAt = new Date().toISOString();
        this.onConfirmCallback?.(this.currentExam);
        this.close();
      }
    });

    // 3. Jump to Next Error Button
    const btnJump = this.modalEl.querySelector('#btn-jump-next-error');
    btnJump?.addEventListener('click', () => this.jumpToNextError());

    // 4. Filter Pills
    this.modalEl.querySelectorAll('.filter-pill').forEach((pill) => {
      pill.addEventListener('click', (e) => {
        const filter = (e.currentTarget as HTMLElement).getAttribute('data-filter') as FilterType;
        if (filter) {
          this.activeFilter = filter;
          this.render();
        }
      });
    });

    // 5. 1-Click Correct Answer Toggle Buttons
    this.modalEl.querySelectorAll('[data-action="toggle-ans"]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLElement;
        const qIdx = parseInt(target.getAttribute('data-q-index') ?? '', 10);
        const optIdx = parseInt(target.getAttribute('data-opt-index') ?? '', 10);
        if (!isNaN(qIdx) && !isNaN(optIdx)) {
          this.toggleCorrectAnswer(qIdx, optIdx);
        }
      });
    });

    // 6. In-place contenteditable blur handlers for question text
    this.modalEl.querySelectorAll('.question-text-editable').forEach((el) => {
      el.addEventListener('blur', (e) => {
        const target = e.currentTarget as HTMLElement;
        const qIdx = parseInt(target.getAttribute('data-index') ?? '', 10);
        const newText = target.innerText.trim();
        if (!isNaN(qIdx) && this.currentExam) {
          const q = this.currentExam.questions.find((item) => item.index === qIdx);
          if (q) q.text = newText;
        }
      });
    });

    // 7. In-place contenteditable blur handlers for option text
    this.modalEl.querySelectorAll('.option-text-editable').forEach((el) => {
      el.addEventListener('blur', (e) => {
        const target = e.currentTarget as HTMLElement;
        const qIdx = parseInt(target.getAttribute('data-q-index') ?? '', 10);
        const optIdx = parseInt(target.getAttribute('data-opt-index') ?? '', 10);
        const newText = target.innerText.trim();
        if (!isNaN(qIdx) && !isNaN(optIdx) && this.currentExam) {
          const q = this.currentExam.questions.find((item) => item.index === qIdx);
          if (q && q.options[optIdx] !== undefined) {
            q.options[optIdx] = newText;
          }
        }
      });
    });

    // 8. Add Option Button
    this.modalEl.querySelectorAll('[data-action="add-opt"]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLElement;
        const qIdx = parseInt(target.getAttribute('data-q-index') ?? '', 10);
        if (!isNaN(qIdx) && this.currentExam) {
          const q = this.currentExam.questions.find((item) => item.index === qIdx);
          if (q) {
            q.options.push(`Phương án ${q.options.length + 1}`);
            this.render();
          }
        }
      });
    });

    // 9. Remove Option Button
    this.modalEl.querySelectorAll('[data-action="remove-opt"]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLElement;
        const qIdx = parseInt(target.getAttribute('data-q-index') ?? '', 10);
        const optIdx = parseInt(target.getAttribute('data-opt-index') ?? '', 10);
        if (!isNaN(qIdx) && !isNaN(optIdx) && this.currentExam) {
          const q = this.currentExam.questions.find((item) => item.index === qIdx);
          if (q && q.options.length > 2) {
            q.options.splice(optIdx, 1);
            // Re-adjust correct answer indices
            q.correctAnswer = q.correctAnswer
              .filter((ans) => ans !== optIdx)
              .map((ans) => (ans > optIdx ? ans - 1 : ans));
            this.render();
          }
        }
      });
    });

    // 10. Merge with Previous Question Button
    this.modalEl.querySelectorAll('[data-action="merge"]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLElement;
        const qIdx = parseInt(target.getAttribute('data-index') ?? '', 10);
        if (!isNaN(qIdx) && this.currentExam && qIdx > 1) {
          this.mergeWithPrevious(qIdx);
        }
      });
    });

    // 11. Delete Question Button
    this.modalEl.querySelectorAll('[data-action="delete"]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLElement;
        const qIdx = parseInt(target.getAttribute('data-index') ?? '', 10);
        if (!isNaN(qIdx) && this.currentExam) {
          this.deleteQuestion(qIdx);
        }
      });
    });
  }

  /**
   * Toggles an option index in question.correctAnswer
   */
  public toggleCorrectAnswer(questionIndex: number, optionIndex: number): void {
    if (!this.currentExam) return;
    const q = this.currentExam.questions.find((item) => item.index === questionIndex);
    if (!q) return;

    if (q.type === 'multiple') {
      const idx = q.correctAnswer.indexOf(optionIndex);
      if (idx !== -1) {
        q.correctAnswer.splice(idx, 1);
      } else {
        q.correctAnswer.push(optionIndex);
      }
    } else {
      // Single choice toggle
      q.correctAnswer = [optionIndex];
    }

    this.render();
  }

  /**
   * Merges current question into previous question (solves split-error bug)
   */
  public mergeWithPrevious(questionIndex: number): void {
    if (!this.currentExam || questionIndex <= 1) return;
    const currentQIdx = this.currentExam.questions.findIndex((q) => q.index === questionIndex);
    if (currentQIdx <= 0) return;

    const prevQ = this.currentExam.questions[currentQIdx - 1]!;
    const curQ = this.currentExam.questions[currentQIdx]!;

    // Append text
    prevQ.text += `\n${curQ.text}`;
    // Merge options if current question had extra options
    if (curQ.options && curQ.options.length > 0) {
      prevQ.options.push(...curQ.options);
    }

    // Remove merged question
    this.currentExam.questions.splice(currentQIdx, 1);
    this.render();
  }

  /**
   * Deletes a question and re-indexes
   */
  public deleteQuestion(questionIndex: number): void {
    if (!this.currentExam) return;
    const idx = this.currentExam.questions.findIndex((q) => q.index === questionIndex);
    if (idx !== -1) {
      this.currentExam.questions.splice(idx, 1);
      this.render();
    }
  }

  /**
   * Smoothly scrolls to the first question that lacks an assigned correct answer
   */
  public jumpToNextError(): void {
    if (!this.currentExam) return;
    const errQ = this.currentExam.questions.find((q) => !q.correctAnswer || q.correctAnswer.length === 0);
    if (!errQ) return;

    const card = document.getElementById(`review-card-${errQ.index}`);
    if (card) {
      card.scrollIntoView({ behavior: 'smooth', block: 'center' });
      card.classList.add('card-highlight-pulse');
      setTimeout(() => card.classList.remove('card-highlight-pulse'), 1800);
    }
  }

  /**
   * Renders KaTeX math formula previews if katex auto-render is present
   */
  private renderMathPreview(): void {
    if (typeof window === 'undefined') return;
    const win = window as unknown as { renderMathInElement?: (el: HTMLElement, opts: unknown) => void };
    if (typeof win.renderMathInElement === 'function' && this.modalEl) {
      try {
        win.renderMathInElement(this.modalEl, {
          delimiters: [
            { left: '$$', right: '$$', display: true },
            { left: '$', right: '$', display: false },
          ],
          throwOnError: false,
        });
      } catch {}
    }
  }

  private escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}

export const smartReviewEditor = new SmartReviewEditor();
