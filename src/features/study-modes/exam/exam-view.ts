/**
 * src/features/study-modes/exam/exam-view.ts - Standardized CBT Exam Mode (SAT / THPT Format)
 * Enforces strict examination layout, Split-View passages, and Palette question navigation.
 */

import type { Exam, Question } from '../../../shared/types';
import { examStateMachine } from '../../exam-engine/exam-state-machine';
import { questionNavigator } from '../../exam-engine/question-navigator';
import { KaTeXRenderer } from '../../../shared/renderers/katex';
import { CodeRenderer } from '../../../shared/renderers/code';

export class ExamView {
  private exam: Exam | null = null;
  private container: HTMLElement | null = null;

  constructor() {}

  public init(exam: Exam, containerId: string = 'exam-view-container'): void {
    this.exam = exam;
    this.container = document.getElementById(containerId);

    questionNavigator.init(exam.questions.length, {
      onQuestionSelect: (idx) => this.highlightActiveQuestion(idx),
      onOptionToggle: (qIdx, optIdx) => {
        examStateMachine.selectAnswer(qIdx, optIdx);
        this.updateQuestionDom(qIdx);
      },
      onFlagToggle: (qIdx) => {
        examStateMachine.toggleFlag(qIdx);
        this.updateQuestionDom(qIdx);
      },
    });

    this.render();
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

        return `
          <div class="question-block cbt-exam-card ${q.passage ? 'has-split-passage' : ''}" id="q-card-${idx}">
            <div class="cbt-split-container">
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

    this.container.innerHTML = questionsHtml;
    this.bindEvents();
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
  }
}

export const examView = new ExamView();
