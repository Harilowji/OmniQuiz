/**
 * src/features/parser/smart-review-editor.ts - Smart Exam Review & Split-Screen Editor 2.0 (Azota Pro Edition)
 * Implements 2-column verification:
 * - Left pane (40%): Original raw text with synchronized scroll anchors & quick filter pills
 * - Right pane (60%): Interactive Bento question cards supporting all 3 standard question types:
 *     1. Multiple Choice (ABCD) with 1-click answer toggling
 *     2. True/False Group (4 sub-items a, b, c, d) with independent toggle pills
 *     3. Short Answer (numerical fill-in) with answer key field
 * - Live KaTeX Math Preview on typing ($...$)
 * - Clipboard image paste (Ctrl+V) & drag-and-drop auto-compressed to WebP
 * - Batch tools: Quick Answer Key String Importer ("1A 2B 3C..." or "ABCDDCBA..."), question type switcher
 */

import type { Exam, Question, QuestionType, ParserWarning } from '../../shared/types';
import type { ParseExamReportResult } from './document-parser';
import { KaTeXRenderer } from '../../shared/renderers/katex';

type FilterType = 'all' | 'missing_answer' | 'missing_options';

export class SmartReviewEditor {
  private modalEl: HTMLElement | null = null;
  private currentExam: Exam | null = null;
  private warnings: ParserWarning[] = [];
  private rawText: string = '';
  private activeFilter: FilterType = 'all';
  private onConfirmCallback: ((exam: Exam) => void) | null = null;
  private activeCardIndex: number | null = null;

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

    // Deep clone exam so edits are completely isolated
    this.currentExam = JSON.parse(JSON.stringify(report.exam)) as Exam;
    this.warnings = [...report.warnings];
    this.rawText = report.rawExtractedText || '';
    this.activeFilter = 'all';
    this.onConfirmCallback = onConfirm;
    this.activeCardIndex = null;

    if (this.modalEl) {
      this.modalEl.style.display = 'flex';
      this.modalEl.style.zIndex = '9990';
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
   * Re-computes validation warnings from current questions
   */
  private updateValidationWarnings(): void {
    if (!this.currentExam) return;
    this.warnings = [];

    this.currentExam.questions.forEach((q, idx) => {
      q.index = idx + 1;

      if (q.type === 'short_answer') {
        if (!q.shortAnswerKey) {
          this.warnings.push({
            questionIndex: q.index,
            type: 'missing_answer',
            message: `Câu ${q.index} (Trả lời ngắn) chưa có đáp số.`,
          });
        }
      } else if (q.type === 'true_false_group') {
        if (!q.subItems || q.subItems.length < 2) {
          this.warnings.push({
            questionIndex: q.index,
            type: 'missing_options',
            message: `Câu ${q.index} (Đúng/Sai) có ít hơn 4 mệnh đề con.`,
          });
        }
      } else {
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
      }
    });
  }

  /**
   * Renders the entire split-screen editor UI
   */
  private render(): void {
    if (!this.modalEl || !this.currentExam) return;

    this.updateValidationWarnings();

    const missingAnsQuestions = this.currentExam.questions.filter((q) => {
      if (q.type === 'short_answer') return !q.shortAnswerKey;
      return !q.correctAnswer || q.correctAnswer.length === 0;
    });

    const missingOptQuestions = this.currentExam.questions.filter((q) => {
      if (q.type === 'short_answer') return false;
      if (q.type === 'true_false_group') return !q.subItems || q.subItems.length < 4;
      return !q.options || q.options.length < 4;
    });

    const totalQuestions = this.currentExam.questions.length;
    const missingAnsCount = missingAnsQuestions.length;
    const missingOptCount = missingOptQuestions.length;

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
            <div class="smart-review-badge">🎯 Duyệt Đề Chuẩn Azota 2.0</div>
            <h2 class="smart-review-title">${this.escapeHtml(this.currentExam.title)}</h2>
            <p class="smart-review-subtitle">
              Đối chiếu 2 cột trực quan • Hỗ trợ KaTeX • Dán ảnh Ctrl+V • Tổng số: <strong>${totalQuestions} câu</strong>
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
              <span>Phát hiện <strong>${missingAnsCount} câu</strong> chưa có đáp án đúng. Bấm vào nút A/B/C/D hoặc nút Nhập chuỗi đáp án để hoàn tất!</span>
            </div>
            <div class="alert-banner-actions">
              <button type="button" class="btn-action btn-sm btn-quick-key-import" id="btn-quick-key-import">
                ⚡ Nhập nhanh chuỗi đáp án
              </button>
              <button type="button" class="btn-action btn-sm btn-jump-error" id="btn-jump-next-error">
                🔍 Nhảy tới câu chưa có đáp án
              </button>
            </div>
          </div>
        `
            : `
          <div class="smart-review-success-banner">
            <span class="success-icon">✅</span>
            <span>Tuyệt vời! Toàn bộ <strong>${totalQuestions} câu hỏi</strong> đã có đầy đủ đáp án đúng và sẵn sàng xuất bản.</span>
            <button type="button" class="btn-action btn-sm btn-quick-key-import" id="btn-quick-key-import" style="margin-left: auto;">
              ⚡ Nhập lại chuỗi đáp án
            </button>
          </div>
        `
        }

        <!-- Split Screen Container -->
        <div class="smart-review-split-grid">
          <!-- Left Column (40%): Raw Text & Anchors -->
          <div class="smart-review-raw-pane" id="smart-review-raw-pane">
            <div class="raw-pane-toolbar">
              <span class="raw-pane-label">📄 Văn bản gốc trích xuất (Bấm để đối chiếu)</span>
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
              ${this.renderRawAnchors()}
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
    this.renderAllMathPreviews();
  }

  /**
   * Generates synchronized raw question anchors for the 40% left pane
   */
  private renderRawAnchors(): string {
    if (!this.rawText) {
      return '<pre><code>Không có văn bản gốc.</code></pre>';
    }

    if (!this.currentExam || this.currentExam.questions.length === 0) {
      return `<pre><code>${this.escapeHtml(this.rawText)}</code></pre>`;
    }

    // Split raw text into chunks matching each question index if possible
    const lines = this.rawText.split('\n');
    let currentAnchorIdx = 1;
    let anchorLines: Record<number, string[]> = {};

    lines.forEach((line) => {
      const match = line.match(/^(?:(?:Câu\s*hỏi|Câu|Question|Bài|Q)\s*(\d+)|\b(\d+)[\.:\)])/i);
      if (match) {
        const foundNum = parseInt(match[1] || match[2] || '', 10);
        if (!isNaN(foundNum)) {
          currentAnchorIdx = foundNum;
        }
      }
      if (!anchorLines[currentAnchorIdx]) {
        anchorLines[currentAnchorIdx] = [];
      }
      anchorLines[currentAnchorIdx]!.push(line);
    });

    const anchorsHtml = Object.keys(anchorLines)
      .map((keyStr) => {
        const idx = parseInt(keyStr, 10);
        const chunkText = anchorLines[idx]!.join('\n');
        return `
          <div class="raw-question-anchor" id="raw-anchor-${idx}" data-question-index="${idx}">
            <div class="anchor-label">📍 Đoạn văn bản Câu ${idx}</div>
            <pre><code>${this.escapeHtml(chunkText)}</code></pre>
          </div>
        `;
      })
      .join('');

    return anchorsHtml || `<pre><code>${this.escapeHtml(this.rawText)}</code></pre>`;
  }

  /**
   * Renders a single Bento Question Card supporting multiple_choice, true_false_group, and short_answer
   */
  private renderQuestionCard(q: Question): string {
    const letters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
    const hasAnswer =
      q.type === 'short_answer'
        ? !!q.shortAnswerKey
        : q.correctAnswer && q.correctAnswer.length > 0;

    const typeBadge =
      q.type === 'true_false_group'
        ? 'Đúng/Sai (4 ý)'
        : q.type === 'short_answer'
        ? 'Trả lời ngắn'
        : q.type === 'multiple'
        ? 'Nhiều đáp án'
        : 'Trắc nghiệm ABCD';

    return `
      <div class="review-question-card ${!hasAnswer ? 'card-has-error' : ''} ${this.activeCardIndex === q.index ? 'active-inspected' : ''}" 
           id="review-card-${q.index}" 
           data-q-index="${q.index}"
           tabindex="0">
        
        <div class="review-card-header">
          <div class="review-card-index-pill">
            <span>Câu ${q.index}</span>
            <span class="badge-type-pill">${typeBadge}</span>
            ${
              !hasAnswer
                ? `<span class="badge-error-pill">⚠️ Chưa có đáp án đúng</span>`
                : `<span class="badge-success-pill">✓ Đã có đáp án</span>`
            }
          </div>
          <div class="review-card-actions">
            <!-- Type Switcher Dropdown -->
            <select class="select-q-type" data-action="change-type" data-q-index="${q.index}" title="Đổi dạng thức câu hỏi">
              <option value="single" ${q.type === 'single' || q.type === 'multiple_choice' ? 'selected' : ''}>4 Lựa chọn ABCD</option>
              <option value="true_false_group" ${q.type === 'true_false_group' ? 'selected' : ''}>Đúng / Sai (4 ý)</option>
              <option value="short_answer" ${q.type === 'short_answer' ? 'selected' : ''}>Trả lời ngắn</option>
            </select>
            ${
              q.index > 1
                ? `<button type="button" class="btn-card-tool btn-merge-up" data-action="merge" data-index="${q.index}" title="Gộp vào câu phía trước">🔗 Gộp lên</button>`
                : ''
            }
            <button type="button" class="btn-card-tool btn-delete-q" data-action="delete" data-index="${q.index}" title="Xóa câu hỏi này">🗑️ Xóa</button>
          </div>
        </div>

        <!-- Editable Question Content -->
        <div class="review-question-body">
          <label class="review-field-label">Nội dung câu hỏi (gõ $...$ để xem công thức Toán, bấm Ctrl+V để dán ảnh):</label>
          <div class="review-editable-text question-text-editable" 
               contenteditable="true" 
               data-index="${q.index}" 
               data-field="questionText">
            ${this.escapeHtml(q.text)}
          </div>
          <div class="live-math-preview-box" id="math-preview-q-${q.index}"></div>
        </div>

        <!-- Attached Image Thumbnail (if any) -->
        ${
          q.mediaUrl || q.imageUrl
            ? `
          <div class="review-image-attachment" id="review-img-wrap-${q.index}">
            <img src="${this.escapeHtml(q.mediaUrl || q.imageUrl || '')}" alt="Hình đính kèm câu ${q.index}" class="review-attached-img" />
            <button type="button" class="btn-remove-attachment" data-action="remove-img" data-q-index="${q.index}" title="Xóa hình ảnh này">🗑️ Xóa ảnh</button>
          </div>
        `
            : ''
        }

        <!-- Question Specific Answer Control: Part I / Part II / Part III -->
        ${
          q.type === 'short_answer'
            ? `
          <div class="review-short-answer-section">
            <label class="review-field-label">🎯 Đáp số / Giá trị điền vào:</label>
            <input type="text" 
                   class="custom-select review-short-input" 
                   data-action="short-ans-input" 
                   data-q-index="${q.index}" 
                   placeholder="Nhập số (ví dụ: 12.5, -4, 2026)..." 
                   value="${this.escapeHtml(q.shortAnswerKey || '')}" />
          </div>
        `
            : q.type === 'true_false_group'
            ? `
          <div class="review-tf-subitems-list">
            <label class="review-field-label">Mệnh đề con (bấm Đúng/Sai cho từng ý a, b, c, d):</label>
            ${(q.subItems || [
              { id: 'a', text: 'Mệnh đề a', isCorrect: true },
              { id: 'b', text: 'Mệnh đề b', isCorrect: false },
              { id: 'c', text: 'Mệnh đề c', isCorrect: false },
              { id: 'd', text: 'Mệnh đề d', isCorrect: false },
            ])
              .map((sub, sIdx) => `
              <div class="review-tf-row">
                <span class="tf-letter-badge">${sub.id})</span>
                <div class="review-editable-text tf-text-editable" 
                     contenteditable="true" 
                     data-q-index="${q.index}" 
                     data-sub-idx="${sIdx}">
                  ${this.escapeHtml(sub.text)}
                </div>
                <div class="tf-toggle-group">
                  <button type="button" 
                          class="btn-tf-choice ${sub.isCorrect ? 'active-true' : ''}" 
                          data-action="tf-toggle" 
                          data-q-index="${q.index}" 
                          data-sub-idx="${sIdx}" 
                          data-val="true">
                    Đúng
                  </button>
                  <button type="button" 
                          class="btn-tf-choice ${!sub.isCorrect ? 'active-false' : ''}" 
                          data-action="tf-toggle" 
                          data-q-index="${q.index}" 
                          data-sub-idx="${sIdx}" 
                          data-val="false">
                    Sai
                  </button>
                </div>
              </div>
            `)
              .join('')}
          </div>
        `
            : `
          <!-- Standard Part I ABCD Options -->
          <div class="review-options-list">
            <label class="review-field-label">Lựa chọn (bấm nút tròn chữ cái để chọn đáp án đúng):</label>
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
                         data-opt-index="${optIdx}">
                      ${this.escapeHtml(opt)}
                    </div>
                    <button type="button" class="btn-remove-opt" data-action="remove-opt" data-q-index="${q.index}" data-opt-index="${optIdx}" title="Xóa lựa chọn này">&times;</button>
                  </div>
                `;
              })
              .join('')}
          </div>
        `
        }

        <!-- Footer Tools: Add option & Explanation -->
        <div class="review-card-footer-tools">
          ${
            q.type === 'single' || q.type === 'multiple' || q.type === 'multiple_choice'
              ? `
            <button type="button" class="btn-add-opt" data-action="add-opt" data-q-index="${q.index}">
              ➕ Thêm lựa chọn
            </button>
          `
              : ''
          }
          <div class="review-card-paste-hint">📸 Bấm vào thẻ rồi ấn Ctrl+V để dán ảnh</div>
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
   * Binds interactive events for split view, bi-directional sync scroll, Ctrl+V paste,
   * live math previews, and quick key importer.
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

    // 4. Quick Key String Importer
    const btnQuickKey = this.modalEl.querySelector('#btn-quick-key-import');
    btnQuickKey?.addEventListener('click', () => this.promptQuickKeyImport());

    // 5. Filter Pills
    this.modalEl.querySelectorAll('.filter-pill').forEach((pill) => {
      pill.addEventListener('click', (e) => {
        const filter = (e.currentTarget as HTMLElement).getAttribute('data-filter') as FilterType;
        if (filter) {
          this.activeFilter = filter;
          this.render();
        }
      });
    });

    // 6. Bi-directional Sync Scroll: Right card click scrolls left raw anchor
    this.modalEl.querySelectorAll('.review-question-card').forEach((card) => {
      card.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLElement;
        const qIdx = parseInt(target.getAttribute('data-q-index') ?? '', 10);
        if (!isNaN(qIdx)) {
          this.syncScrollToRawAnchor(qIdx);
        }
      });

      // 7. Clipboard Image Paste (Ctrl+V) directly onto the card
      card.addEventListener('paste', (e: Event) => {
        const clipEvent = e as ClipboardEvent;
        const targetCard = card as HTMLElement;
        const qIdx = parseInt(targetCard.getAttribute('data-q-index') ?? '', 10);
        if (!isNaN(qIdx) && clipEvent.clipboardData?.items) {
          this.handleClipboardImagePaste(clipEvent, qIdx);
        }
      });
    });

    // 8. Clicking raw anchor on left scrolls right question card
    this.modalEl.querySelectorAll('.raw-question-anchor').forEach((anchor) => {
      anchor.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLElement;
        const qIdx = parseInt(target.getAttribute('data-question-index') ?? '', 10);
        if (!isNaN(qIdx)) {
          this.syncScrollToQuestionCard(qIdx);
        }
      });
    });

    // 9. 1-Click Option Answer Toggle Buttons
    this.modalEl.querySelectorAll('[data-action="toggle-ans"]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const target = e.currentTarget as HTMLElement;
        const qIdx = parseInt(target.getAttribute('data-q-index') ?? '', 10);
        const optIdx = parseInt(target.getAttribute('data-opt-index') ?? '', 10);
        if (!isNaN(qIdx) && !isNaN(optIdx)) {
          this.toggleCorrectAnswer(qIdx, optIdx);
        }
      });
    });

    // 10. True/False Sub-item Toggle
    this.modalEl.querySelectorAll('[data-action="tf-toggle"]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const target = e.currentTarget as HTMLElement;
        const qIdx = parseInt(target.getAttribute('data-q-index') ?? '', 10);
        const subIdx = parseInt(target.getAttribute('data-sub-idx') ?? '', 10);
        const isTrue = target.getAttribute('data-val') === 'true';
        if (!isNaN(qIdx) && !isNaN(subIdx) && this.currentExam) {
          const q = this.currentExam.questions.find((item) => item.index === qIdx);
          if (q && q.subItems && q.subItems[subIdx]) {
            q.subItems[subIdx]!.isCorrect = isTrue;
            q.correctAnswer = q.subItems.map((s, i) => (s.isCorrect ? i : -1)).filter((i) => i >= 0);
            this.render();
          }
        }
      });
    });

    // 11. Short Answer Input
    this.modalEl.querySelectorAll('[data-action="short-ans-input"]').forEach((inp) => {
      inp.addEventListener('input', (e) => {
        const target = e.target as HTMLInputElement;
        const qIdx = parseInt(target.getAttribute('data-q-index') ?? '', 10);
        const val = target.value.trim();
        if (!isNaN(qIdx) && this.currentExam) {
          const q = this.currentExam.questions.find((item) => item.index === qIdx);
          if (q) {
            q.shortAnswerKey = val;
          }
        }
      });
    });

    // 12. Question Type Switcher
    this.modalEl.querySelectorAll('[data-action="change-type"]').forEach((sel) => {
      sel.addEventListener('change', (e) => {
        const target = e.target as HTMLSelectElement;
        const qIdx = parseInt(target.getAttribute('data-q-index') ?? '', 10);
        const newType = target.value as QuestionType;
        if (!isNaN(qIdx) && this.currentExam) {
          this.switchQuestionType(qIdx, newType);
        }
      });
    });

    // 13. Live Math Preview on typing in question text
    this.modalEl.querySelectorAll('.question-text-editable').forEach((el) => {
      el.addEventListener('input', (e) => {
        const target = e.currentTarget as HTMLElement;
        const qIdx = parseInt(target.getAttribute('data-index') ?? '', 10);
        const text = target.innerText;
        this.updateLiveMathPreview(qIdx, text);

        if (!isNaN(qIdx) && this.currentExam) {
          const q = this.currentExam.questions.find((item) => item.index === qIdx);
          if (q) q.text = text.trim();
        }
      });
    });

    // 14. Option text blur handlers
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

    // 15. Add Option Button
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

    // 16. Remove Option Button
    this.modalEl.querySelectorAll('[data-action="remove-opt"]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLElement;
        const qIdx = parseInt(target.getAttribute('data-q-index') ?? '', 10);
        const optIdx = parseInt(target.getAttribute('data-opt-index') ?? '', 10);
        if (!isNaN(qIdx) && !isNaN(optIdx) && this.currentExam) {
          const q = this.currentExam.questions.find((item) => item.index === qIdx);
          if (q && q.options.length > 2) {
            q.options.splice(optIdx, 1);
            q.correctAnswer = q.correctAnswer
              .filter((ans) => ans !== optIdx)
              .map((ans) => (ans > optIdx ? ans - 1 : ans));
            this.render();
          }
        }
      });
    });

    // 17. Delete Image Attachment
    this.modalEl.querySelectorAll('[data-action="remove-img"]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLElement;
        const qIdx = parseInt(target.getAttribute('data-q-index') ?? '', 10);
        if (!isNaN(qIdx) && this.currentExam) {
          const q = this.currentExam.questions.find((item) => item.index === qIdx);
          if (q) {
            q.mediaUrl = undefined;
            q.imageUrl = undefined;
            this.render();
          }
        }
      });
    });

    // 18. Merge with Previous Question Button
    this.modalEl.querySelectorAll('[data-action="merge"]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLElement;
        const qIdx = parseInt(target.getAttribute('data-index') ?? '', 10);
        if (!isNaN(qIdx) && this.currentExam && qIdx > 1) {
          this.mergeWithPrevious(qIdx);
        }
      });
    });

    // 19. Delete Question Button
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
   * Synchronizes left raw text pane to scroll to selected question anchor
   */
  public syncScrollToRawAnchor(questionIndex: number): void {
    this.activeCardIndex = questionIndex;
    const anchor = document.getElementById(`raw-anchor-${questionIndex}`);
    if (anchor) {
      anchor.scrollIntoView({ behavior: 'smooth', block: 'center' });
      document.querySelectorAll('.raw-question-anchor').forEach((el) => el.classList.remove('anchor-active'));
      anchor.classList.add('anchor-active');
    }
  }

  /**
   * Synchronizes right question cards pane to scroll to card matching raw anchor
   */
  public syncScrollToQuestionCard(questionIndex: number): void {
    const card = document.getElementById(`review-card-${questionIndex}`);
    if (card) {
      card.scrollIntoView({ behavior: 'smooth', block: 'center' });
      document.querySelectorAll('.review-question-card').forEach((el) => el.classList.remove('active-inspected'));
      card.classList.add('active-inspected');
    }
  }

  /**
   * Switches question type (single/multiple_choice <-> true_false_group <-> short_answer)
   */
  public switchQuestionType(questionIndex: number, newType: QuestionType): void {
    if (!this.currentExam) return;
    const q = this.currentExam.questions.find((item) => item.index === questionIndex);
    if (!q) return;

    q.type = newType;
    if (newType === 'true_false_group' && (!q.subItems || q.subItems.length === 0)) {
      q.subItems = [
        { id: 'a', text: q.options[0] || 'Mệnh đề a', isCorrect: true },
        { id: 'b', text: q.options[1] || 'Mệnh đề b', isCorrect: false },
        { id: 'c', text: q.options[2] || 'Mệnh đề c', isCorrect: false },
        { id: 'd', text: q.options[3] || 'Mệnh đề d', isCorrect: false },
      ];
      q.correctAnswer = [0];
    } else if (newType === 'short_answer') {
      if (!q.shortAnswerKey) q.shortAnswerKey = '';
      q.correctAnswer = [];
    } else {
      if (!q.options || q.options.length < 2) {
        q.options = ['Phương án A', 'Phương án B', 'Phương án C', 'Phương án D'];
      }
      if (!q.correctAnswer || q.correctAnswer.length === 0) {
        q.correctAnswer = [0];
      }
    }
    this.render();
  }

  /**
   * Handles clipboard image paste (Ctrl+V) and compresses to WebP (<900px, 0.85)
   */
  public handleClipboardImagePaste(e: ClipboardEvent, questionIndex: number): void {
    const items = e.clipboardData?.items;
    if (!items || !this.currentExam) return;

    for (let i = 0; i < items.length; i++) {
      const item = items[i]!;
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (!file) continue;

        const reader = new FileReader();
        reader.onload = (loadEvent) => {
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement('canvas');
            const maxW = 900;
            let w = img.width;
            let h = img.height;
            if (w > maxW) {
              h = Math.round((h * maxW) / w);
              w = maxW;
            }
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(img, 0, 0, w, h);
              const webpData = canvas.toDataURL('image/webp', 0.85);

              const targetQ = this.currentExam?.questions.find((q) => q.index === questionIndex);
              if (targetQ) {
                targetQ.mediaUrl = webpData;
                targetQ.imageUrl = webpData;
                this.render();
              }
            }
          };
          img.src = loadEvent.target?.result as string;
        };
        reader.readAsDataURL(file);
        break;
      }
    }
  }

  /**
   * Prompts user for a quick key string (e.g. "1A 2B 3C..." or "ABCDDCBA...") and bulk sets answers
   */
  public promptQuickKeyImport(): void {
    if (!this.currentExam) return;

    const input = prompt(
      '⚡ NHẬP CHUỖI ĐÁP ÁN NHANH (QUICK KEY IMPORTER)\n\n' +
        'Dán chuỗi đáp án (Ví dụ: 1A 2B 3C 4D... hoặc ABCDDCBA):\n' +
        'Hệ thống sẽ tự động gán đáp án đúng cho các câu hỏi tương ứng.'
    );

    if (!input || !input.trim()) return;

    const letterMap: Record<string, number> = { A: 0, B: 1, C: 2, D: 3 };
    let assignedCount = 0;

    // Pattern 1: Explicit numbered pairs: "1A", "1.A", "1: A", "1-A"
    const pairRegex = /(?:Câu\s*)?\b(\d+)[\s.:\-=]+([A-D])\b/gi;
    let m: RegExpExecArray | null;
    let hasPairs = false;

    while ((m = pairRegex.exec(input)) !== null) {
      hasPairs = true;
      const qNum = parseInt(m[1] ?? '', 10);
      const letter = (m[2] ?? '').toUpperCase();
      const optIdx = letterMap[letter];
      if (!isNaN(qNum) && optIdx !== undefined) {
        const q = this.currentExam.questions.find((item) => item.index === qNum);
        if (q && q.type !== 'short_answer') {
          q.correctAnswer = [optIdx];
          assignedCount++;
        }
      }
    }

    // Pattern 2: Continuous string of letters e.g. "ABCDDCBA"
    if (!hasPairs) {
      const letters = input.toUpperCase().replace(/[^A-D]/g, '').split('');
      letters.forEach((letter, idx) => {
        const optIdx = letterMap[letter];
        if (optIdx !== undefined && this.currentExam!.questions[idx]) {
          const q = this.currentExam!.questions[idx]!;
          if (q.type !== 'short_answer') {
            q.correctAnswer = [optIdx];
            assignedCount++;
          }
        }
      });
    }

    if (assignedCount > 0) {
      alert(`✅ Đã tự động cập nhật đáp án cho ${assignedCount} câu hỏi!`);
      this.render();
    } else {
      alert('⚠️ Không nhận diện được chuỗi đáp án hợp lệ. Vui lòng kiểm tra lại định dạng!');
    }
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

    prevQ.text += `\n${curQ.text}`;
    if (curQ.options && curQ.options.length > 0) {
      prevQ.options.push(...curQ.options);
    }
    if (curQ.mediaUrl && !prevQ.mediaUrl) {
      prevQ.mediaUrl = curQ.mediaUrl;
    }

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
    const errQ = this.currentExam.questions.find((q) => {
      if (q.type === 'short_answer') return !q.shortAnswerKey;
      return !q.correctAnswer || q.correctAnswer.length === 0;
    });
    if (!errQ) return;

    const card = document.getElementById(`review-card-${errQ.index}`);
    if (card) {
      card.scrollIntoView({ behavior: 'smooth', block: 'center' });
      card.classList.add('card-highlight-pulse');
      setTimeout(() => card.classList.remove('card-highlight-pulse'), 1800);
      this.syncScrollToRawAnchor(errQ.index);
    }
  }

  /**
   * Renders live KaTeX math formula previews across all cards
   */
  private renderAllMathPreviews(): void {
    if (!this.currentExam) return;
    this.currentExam.questions.forEach((q) => {
      this.updateLiveMathPreview(q.index, q.text);
    });
  }

  /**
   * Updates instant KaTeX preview box below an input if $ formulas are present
   */
  private updateLiveMathPreview(questionIndex: number, text: string): void {
    const previewEl = document.getElementById(`math-preview-q-${questionIndex}`);
    if (!previewEl) return;

    if (text.includes('$') || text.includes('\\frac') || text.includes('\\sqrt')) {
      previewEl.style.display = 'block';
      previewEl.innerHTML = `<span class="math-preview-tag">📐 Xem trước KaTeX:</span> ${KaTeXRenderer.renderTextWithMath(text)}`;
    } else {
      previewEl.style.display = 'none';
      previewEl.innerHTML = '';
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
