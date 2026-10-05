/**
 * src/features/study-modes/practice/practice-view.ts - Interactive Practice Mode
 * Features: Instant feedback, Detailed Explanations, and Elimination / Strikethrough Tool.
 */

import type { Exam, Question } from '../../../shared/types';
import { examStateMachine } from '../../exam-engine/exam-state-machine';
import { KaTeXRenderer } from '../../../shared/renderers/katex';
import { CodeRenderer } from '../../../shared/renderers/code';

export class PracticeView {
  private exam: Exam | null = null;
  private container: HTMLElement | null = null;
  private isEliminateMode: boolean = false;

  constructor() {}

  public init(exam: Exam, containerId: string = 'practice-view-container'): void {
    this.exam = exam;
    this.container = document.getElementById(containerId);
    this.isEliminateMode = false;
    this.render();
  }

  public toggleEliminateMode(): boolean {
    this.isEliminateMode = !this.isEliminateMode;
    const btn = document.getElementById('btn-toggle-eliminate');
    btn?.classList.toggle('active', this.isEliminateMode);
    return this.isEliminateMode;
  }

  public render(): void {
    if (!this.container || !this.exam) return;

    const attempt = examStateMachine.getAttempt();
    const answers = attempt?.answers || {};
    const eliminated = attempt?.eliminatedOptions || {};

    const questionsHtml = this.exam.questions
      .map((q: Question, idx: number) => {
        const selected = answers[idx] || [];
        const qEliminated = eliminated[idx] || [];
        const isAnswered = selected.length > 0;

        const renderedQuestion = KaTeXRenderer.renderTextWithMath(
          CodeRenderer.parseMarkdownCodeBlocks(q.text)
        );

        const optionsHtml = q.options
          .map((optText: string, optIdx: number) => {
            const isSel = selected.includes(optIdx);
            const isElim = qEliminated.includes(optIdx);
            const isCorrect = q.correctAnswer.includes(optIdx);

            let stateClass = '';
            if (isAnswered) {
              if (isCorrect) stateClass = 'correct';
              else if (isSel) stateClass = 'incorrect';
            } else if (isSel) {
              stateClass = 'selected';
            }

            if (isElim) stateClass += ' eliminated-strikethrough';

            const optLetter = String.fromCharCode(65 + optIdx);
            const optContent = KaTeXRenderer.renderTextWithMath(optText);

            return `
              <div class="option ${stateClass}" data-q="${idx}" data-opt="${optIdx}">
                <div class="option-indicator">${optLetter}</div>
                <div class="option-content">${optContent}</div>
                <button type="button" class="btn-strikethrough" data-q="${idx}" data-opt="${optIdx}" title="Loại suy phương án">
                  ${isElim ? '↺' : '̶S̶'}
                </button>
              </div>
            `;
          })
          .join('');

        const explanationHtml = q.explanation
          ? KaTeXRenderer.renderTextWithMath(CodeRenderer.parseMarkdownCodeBlocks(q.explanation))
          : 'Không có lời giải chi tiết cho câu hỏi này.';

        return `
          <div class="question-block practice-question-block" id="q-card-${idx}">
            <div class="q-header">
              <span class="question-title">Câu ${idx + 1}</span>
              <span class="q-badge-type">${q.type === 'multiple' ? 'Nhiều đáp án' : 'Một đáp án'}</span>
            </div>
            ${q.passage ? `<div class="passage-box">${KaTeXRenderer.renderTextWithMath(q.passage)}</div>` : ''}
            <div class="q-text">${renderedQuestion}</div>
            <div class="options-container">${optionsHtml}</div>

            <!-- Instant Feedback Box (revealed when answered) -->
            <div class="explanation ${isAnswered ? 'show' : ''}" style="${isAnswered ? 'display: block;' : 'display: none;'}">
              <div class="exp-header">
                <strong>💡 Hướng dẫn & Giải thích chi tiết:</strong>
              </div>
              <div class="exp-body">${explanationHtml}</div>
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

    // Option clicks & Strikethrough clicks
    this.container.querySelectorAll('.option').forEach((el) => {
      el.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        const qIdx = parseInt(el.getAttribute('data-q') || '0', 10);
        const optIdx = parseInt(el.getAttribute('data-opt') || '0', 10);

        if (target.closest('.btn-strikethrough') || this.isEliminateMode) {
          e.stopPropagation();
          examStateMachine.toggleEliminateOption(qIdx, optIdx);
          this.render();
          return;
        }

        examStateMachine.selectAnswer(qIdx, optIdx);
        this.render();
      });
    });

    this.container.querySelectorAll('.btn-strikethrough').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const qIdx = parseInt(btn.getAttribute('data-q') || '0', 10);
        const optIdx = parseInt(btn.getAttribute('data-opt') || '0', 10);
        examStateMachine.toggleEliminateOption(qIdx, optIdx);
        this.render();
      });
    });
  }
}

export const practiceView = new PracticeView();
