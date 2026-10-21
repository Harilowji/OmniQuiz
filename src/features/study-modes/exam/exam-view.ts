/**
 * src/features/study-modes/exam/exam-view.ts - Standardized CBT Exam Mode (SAT / THPT Format)
 * Enforces strict examination layout, Split-View passages, and Palette question navigation.
 */

import type { Exam, Question, ExamAttempt } from '../../../shared/types';
import { examStateMachine } from '../../exam-engine/exam-state-machine';
import { questionNavigator } from '../../exam-engine/question-navigator';
import { KaTeXRenderer } from '../../../shared/renderers/katex';
import { CodeRenderer } from '../../../shared/renderers/code';
import { sanitizeHtml } from '../../../shared/security/sanitizer';

export class ExamView {
  private exam: Exam | null = null;
  private container: HTMLElement | null = null;
  private isReviewMode: boolean = false;

  constructor() {}

  public isReview(): boolean {
    return this.isReviewMode;
  }

  public init(exam: Exam, containerId: string = 'exam-view-container'): void {
    this.exam = exam;
    this.container = document.getElementById(containerId);
    this.isReviewMode = false;

    questionNavigator.init(exam.questions.length, {
      onQuestionSelect: (idx) => this.highlightActiveQuestion(idx),
      onOptionToggle: (qIdx, optIdx) => {
        if (this.isReviewMode) return;
        examStateMachine.selectAnswer(qIdx, optIdx);
        this.updateQuestionDom(qIdx);
      },
      onFlagToggle: (qIdx) => {
        if (this.isReviewMode) return;
        examStateMachine.toggleFlag(qIdx);
        this.updateQuestionDom(qIdx);
      },
    });

    this.render();
  }

  public renderReviewMode(attempt: ExamAttempt, containerId: string = 'exam-view-container'): void {
    if (!this.exam) return;
    this.container = document.getElementById(containerId);
    this.isReviewMode = true;

    questionNavigator.init(this.exam.questions.length, {
      onQuestionSelect: (idx) => this.highlightActiveQuestion(idx),
      onOptionToggle: () => {},
      onFlagToggle: () => {},
    });

    this.renderReviewDom(attempt);
  }

  private renderReviewDom(attempt: ExamAttempt): void {
    if (!this.container || !this.exam) return;

    const answers = attempt.answers || {};
    const flagged = attempt.flaggedQuestions || [];

    const questionsHtml = this.exam.questions
      .map((q: Question, idx: number) => {
        const selected = answers[idx] || [];
        const isFlagged = flagged.includes(idx);
        const correctAnswers = q.correctAnswer || [];

        const isFullyCorrect =
          selected.length === correctAnswers.length &&
          selected.every((a: number) => correctAnswers.includes(a));
        const isUnanswered = selected.length === 0;

        const correctLetters = correctAnswers.map((a) => String.fromCharCode(65 + a)).join(', ');

        const renderedQuestion = KaTeXRenderer.renderTextWithMath(
          CodeRenderer.parseMarkdownCodeBlocks(q.text)
        );

        const optionsHtml = q.options
          .map((optText: string, optIdx: number) => {
            const isSel = selected.includes(optIdx);
            const isCorr = correctAnswers.includes(optIdx);
            const optLetter = String.fromCharCode(65 + optIdx);
            const optContent = KaTeXRenderer.renderTextWithMath(optText);

            let optClass = 'option';
            if (isCorr) {
              optClass += ' correct';
            } else if (isSel && !isCorr) {
              optClass += ' incorrect';
            }

            return `
              <div class="${optClass}" data-q="${idx}" data-opt="${optIdx}" style="cursor: default;">
                <div class="option-indicator">${optLetter}</div>
                <div class="option-content">${optContent}</div>
                ${isCorr ? '<span style="margin-left: auto; color: #22c55e; font-weight: 700;">✓ Đáp án đúng</span>' : ''}
                ${isSel && !isCorr ? '<span style="margin-left: auto; color: #ef4444; font-weight: 700;">✗ Đã chọn sai</span>' : ''}
              </div>
            `;
          })
          .join('');

        const explanationHtml = q.explanation
          ? KaTeXRenderer.renderTextWithMath(CodeRenderer.parseMarkdownCodeBlocks(q.explanation))
          : 'Không có lời giải chi tiết cho câu hỏi này.';

        const statusBadge = isFullyCorrect
          ? `<span style="background: rgba(34, 197, 94, 0.15); color: #22c55e; border: 1px solid #22c55e; font-size: 0.78rem; font-weight: 700; padding: 3px 8px; border-radius: 6px;">✓ ĐÚNG</span>`
          : isUnanswered
          ? `<span style="background: rgba(148, 163, 184, 0.15); color: #94a3b8; border: 1px solid #94a3b8; font-size: 0.78rem; font-weight: 700; padding: 3px 8px; border-radius: 6px;">⚠️ CHƯA LÀM</span>`
          : `<span style="background: rgba(239, 68, 68, 0.15); color: #ef4444; border: 1px solid #ef4444; font-size: 0.78rem; font-weight: 700; padding: 3px 8px; border-radius: 6px;">✗ SAI (ĐA: ${correctLetters})</span>`;

        const passageHtml = q.passage
          ? `
            <div class="sat-passage-pane">
              <div class="passage-header">Đoạn văn đọc hiểu / Tư liệu tham khảo</div>
              <div class="passage-content">${KaTeXRenderer.renderTextWithMath(q.passage)}</div>
            </div>
          `
          : '';

        const mobileTabsHtml = q.passage
          ? `
            <div class="mobile-passage-tabs" role="tablist" aria-label="Khung đọc hiểu và câu hỏi">
              <button type="button" role="tab" class="passage-tab-btn active" data-tab="question" data-q="${idx}" aria-selected="true">
                📝 Câu hỏi & Đáp án
              </button>
              <button type="button" role="tab" class="passage-tab-btn" data-tab="passage" data-q="${idx}" aria-selected="false">
                📖 Đoạn văn đọc hiểu
              </button>
            </div>
          `
          : '';

        return `
          <div class="question-block cbt-exam-card review-mode-card ${q.passage ? 'has-split-passage' : ''}" id="q-card-${idx}">
            ${mobileTabsHtml}
            <div class="cbt-split-container active-pane-question">
              ${passageHtml}
              <div class="sat-question-pane">
                <div class="q-header">
                  <div class="q-header-left" style="display: flex; align-items: center; gap: 8px;">
                    <span class="question-title">Câu ${idx + 1}</span>
                    <span class="q-badge-type">${q.type === 'multiple' ? 'Chọn nhiều' : 'Một đáp án'}</span>
                    ${statusBadge}
                  </div>
                  <div style="font-size: 0.82rem; color: #94a3b8;">
                    ${isFlagged ? '🚩 Đã cắm cờ' : ''}
                  </div>
                </div>
                <div class="q-text">${renderedQuestion}</div>
                <div class="options-container">${optionsHtml}</div>
                <div class="explanation show" style="display: block; margin-top: 14px; background: rgba(0, 240, 255, 0.05); border-left: 3px solid #00f0ff; padding: 12px 16px; border-radius: 8px;">
                  <div style="font-weight: 700; color: #00f0ff; margin-bottom: 6px;">💡 Lời giải & Giải thích chi tiết:</div>
                  <div style="line-height: 1.6; font-size: 0.92rem; color: var(--text-color);">${explanationHtml}</div>
                </div>
              </div>
            </div>
          </div>
        `;
      })
      .join('');

    this.container.innerHTML = sanitizeHtml(questionsHtml);

    // Bind touch & passage tabs
    questionNavigator.bindTouchSwipe(this.container);
    this.container.querySelectorAll<HTMLButtonElement>('.passage-tab-btn').forEach((tabBtn) => {
      tabBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const tab = (tabBtn.getAttribute('data-tab') || 'question') as 'passage' | 'question';
        const qIdx = parseInt(tabBtn.getAttribute('data-q') || '0', 10);
        this.switchPassageTab(qIdx, tab);
      });
    });
  }

  public render(): void {
    if (!this.container || !this.exam) return;

    const attempt = examStateMachine.getAttempt();
    const answers = attempt?.answers || {};
    const flagged = attempt?.flaggedQuestions || [];

    const questionsHtml = this.exam.questions
      .map((q: Question, idx: number) => {
        const selected = answers[idx] || [];
        const isFlagged = flagged.includes(idx);

        const renderedQuestion = KaTeXRenderer.renderTextWithMath(
          CodeRenderer.parseMarkdownCodeBlocks(q.text)
        );

        const optionsHtml = q.options
          .map((optText: string, optIdx: number) => {
            const isSel = selected.includes(optIdx);
            const optLetter = String.fromCharCode(65 + optIdx);
            const optContent = KaTeXRenderer.renderTextWithMath(optText);

            return `
              <div class="option ${isSel ? 'selected' : ''}" data-q="${idx}" data-opt="${optIdx}">
                <div class="option-indicator">${optLetter}</div>
                <div class="option-content">${optContent}</div>
              </div>
            `;
          })
          .join('');

        // Split view container if passage exists (Digital SAT format)
        const passageHtml = q.passage
          ? `
            <div class="sat-passage-pane">
              <div class="passage-header">Đoạn văn đọc hiểu / Tư liệu tham khảo</div>
              <div class="passage-content">${KaTeXRenderer.renderTextWithMath(q.passage)}</div>
            </div>
          `
          : '';

        const mobileTabsHtml = q.passage
          ? `
            <div class="mobile-passage-tabs" role="tablist" aria-label="Khung đọc hiểu và câu hỏi">
              <button type="button" role="tab" class="passage-tab-btn active" data-tab="question" data-q="${idx}" aria-selected="true">
                📝 Câu hỏi & Đáp án
              </button>
              <button type="button" role="tab" class="passage-tab-btn" data-tab="passage" data-q="${idx}" aria-selected="false">
                📖 Đoạn văn đọc hiểu
              </button>
            </div>
          `
          : '';

        return `
          <div class="question-block cbt-exam-card ${q.passage ? 'has-split-passage' : ''}" id="q-card-${idx}">
            ${mobileTabsHtml}
            <div class="cbt-split-container active-pane-question">
              ${passageHtml}
              <div class="sat-question-pane">
                <div class="q-header">
                  <div class="q-header-left">
                    <span class="question-title">Câu ${idx + 1}</span>
                    <span class="q-badge-type">${q.type === 'multiple' ? 'Chọn nhiều' : 'Một đáp án'}</span>
                  </div>
                  <button type="button" class="flag-btn ${isFlagged ? 'active' : ''}" data-q="${idx}">
                    <span>${isFlagged ? '🚩 Đã gắn cờ' : '🏳 Cắm cờ'}</span>
                  </button>
                </div>
                <div class="q-text">${renderedQuestion}</div>
                <div class="options-container">${optionsHtml}</div>
              </div>
            </div>
          </div>
        `;
      })
      .join('');

    this.container.innerHTML = sanitizeHtml(questionsHtml);
    this.bindEvents();
  }

  public switchPassageTab(qIdx: number, tab: 'passage' | 'question'): void {
    const card = document.getElementById(`q-card-${qIdx}`);
    if (!card) return;
    const splitContainer = card.querySelector('.cbt-split-container');
    if (!splitContainer) return;

    card.querySelectorAll<HTMLButtonElement>('.passage-tab-btn').forEach((btn) => {
      const isTarget = btn.getAttribute('data-tab') === tab;
      btn.classList.toggle('active', isTarget);
      btn.setAttribute('aria-selected', isTarget ? 'true' : 'false');
    });

    if (tab === 'passage') {
      splitContainer.classList.add('active-pane-passage');
      splitContainer.classList.remove('active-pane-question');
    } else {
      splitContainer.classList.remove('active-pane-passage');
      splitContainer.classList.add('active-pane-question');
    }
  }

  private bindEvents(): void {
    if (!this.container) return;

    questionNavigator.bindTouchSwipe(this.container);

    // Option clicks
    this.container.querySelectorAll('.option').forEach((el) => {
      el.addEventListener('click', () => {
        const qIdx = parseInt(el.getAttribute('data-q') || '0', 10);
        const optIdx = parseInt(el.getAttribute('data-opt') || '0', 10);
        examStateMachine.selectAnswer(qIdx, optIdx);
        this.updateQuestionDom(qIdx);
      });
    });

    // Mobile passage tabs
    this.container.querySelectorAll<HTMLButtonElement>('.passage-tab-btn').forEach((tabBtn) => {
      tabBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const tab = (tabBtn.getAttribute('data-tab') || 'question') as 'passage' | 'question';
        const qIdx = parseInt(tabBtn.getAttribute('data-q') || '0', 10);
        this.switchPassageTab(qIdx, tab);
      });
    });

    // Flag button clicks
    this.container.querySelectorAll('.flag-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const qIdx = parseInt(btn.getAttribute('data-q') || '0', 10);
        examStateMachine.toggleFlag(qIdx);
        this.updateQuestionDom(qIdx);
      });
    });
  }

  private updateQuestionDom(qIdx: number): void {
    const card = document.getElementById(`q-card-${qIdx}`);
    if (!card) return;

    const attempt = examStateMachine.getAttempt();
    const selected = attempt?.answers[qIdx] || [];
    const isFlagged = attempt?.flaggedQuestions.includes(qIdx) || false;

    // Update options selection
    card.querySelectorAll('.option').forEach((optEl) => {
      const optIdx = parseInt(optEl.getAttribute('data-opt') || '-1', 10);
      optEl.classList.toggle('selected', selected.includes(optIdx));
    });

    // Update flag button
    const flagBtn = card.querySelector('.flag-btn');
    if (flagBtn) {
      flagBtn.classList.toggle('active', isFlagged);
      const span = flagBtn.querySelector('span');
      if (span) span.textContent = isFlagged ? '🚩 Đã gắn cờ' : '🏳 Cắm cờ';
    }

    // Trigger palette button update
    const paletteBtn = document.getElementById(`palette-btn-${qIdx}`);
    if (paletteBtn) {
      paletteBtn.classList.toggle('answered-exam', selected.length > 0);
      paletteBtn.classList.toggle('flagged', isFlagged);
    }
  }

  private highlightActiveQuestion(index: number): void {
    document.querySelectorAll('.question-block').forEach((el) => el.classList.remove('active-focus'));
    const target = document.getElementById(`q-card-${index}`);
    target?.classList.add('active-focus');

    document.querySelectorAll('.palette-btn').forEach((b) => b.classList.remove('active-current'));
    const paletteBtn = document.getElementById(`palette-btn-${index}`);
    paletteBtn?.classList.add('active-current');
  }
}

export const examView = new ExamView();
