/**
 * src/features/study-modes/practice/practice-view.ts - Interactive Practice Mode
 * Features: Instant feedback, Detailed Explanations, and Elimination / Strikethrough Tool.
 */

import type { Exam, Question } from '../../../shared/types';
import { examStateMachine } from '../../exam-engine/exam-state-machine';
import { questionNavigator } from '../../exam-engine/question-navigator';
import { KaTeXRenderer } from '../../../shared/renderers/katex';
import { CodeRenderer } from '../../../shared/renderers/code';
import { sanitizeHtml } from '../../../shared/security/sanitizer';
import { animeMascot } from '../../mascot/anime-mascot';
import { guildCardManager } from '../../gamification/guild-card';

export class PracticeView {
  private exam: Exam | null = null;
  private container: HTMLElement | null = null;
  private isEliminateMode: boolean = false;
  private processedQuestions = new Set<number>();

  constructor() {}

  public init(exam: Exam, containerId: string = 'practice-view-container'): void {
    this.exam = exam;
    this.container = document.getElementById(containerId);
    this.isEliminateMode = false;
    this.processedQuestions.clear();

    questionNavigator.init(exam.questions.length, {
      onQuestionSelect: (idx) => this.highlightActiveQuestion(idx),
      onOptionToggle: (qIdx, optIdx) => {
        examStateMachine.selectAnswer(qIdx, optIdx);
        this.render();
      },
      onFlagToggle: (qIdx) => {
        examStateMachine.toggleFlag(qIdx);
        this.render();
        const attempt = examStateMachine.getAttempt();
        const flaggedCount = attempt?.flaggedQuestions.length || 0;
        const fltFlagged = document.getElementById('flt-flagged');
        if (fltFlagged) {
          fltFlagged.textContent = `Cần xem 🚩 (${flaggedCount})`;
        }
        const app = (window as unknown as { OmniQuizAppInstance?: { syncQuestionPaletteAndCounters: () => void } }).OmniQuizAppInstance;
        app?.syncQuestionPaletteAndCounters();
      },
      onEliminateToggle: (qIdx, optIdx) => {
        examStateMachine.toggleEliminateOption(qIdx, optIdx);
        this.render();
      },
    });

    this.render();
  }

  private highlightActiveQuestion(index: number): void {
    document.querySelectorAll('.question-block').forEach((el) => el.classList.remove('active-focus'));
    const target = document.getElementById(`q-card-${index}`);
    target?.classList.add('active-focus');

    document.querySelectorAll('.palette-btn').forEach((b) => b.classList.remove('active-current'));
    const paletteBtn = document.getElementById(`palette-btn-${index}`);
    paletteBtn?.classList.add('active-current');
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

    this.container.innerHTML = sanitizeHtml(questionsHtml);
    this.bindEvents();
  }

  private bindEvents(): void {
    if (!this.container) return;

    questionNavigator.bindTouchSwipe(this.container);

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
        this.evaluateGamificationOnAnswer(qIdx);
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

  private evaluateGamificationOnAnswer(qIdx: number): void {
    if (this.processedQuestions.has(qIdx) || !this.exam) return;

    const q = this.exam.questions[qIdx];
    const attempt = examStateMachine.getAttempt();
    const selected = attempt?.answers[qIdx] || [];
    if (!q || selected.length === 0) return;

    this.processedQuestions.add(qIdx);
    const isCorrect =
      q.correctAnswer.length > 0 &&
      q.correctAnswer.every((a) => selected.includes(a)) &&
      selected.length === q.correctAnswer.length;

    if (isCorrect) {
      animeMascot.onCorrectAnswer();
      const { leveledUp } = guildCardManager.recordAnswer(true);
      if (leveledUp) {
        animeMascot.speak(
          `🎉 Chúc mừng Senpai vừa thăng cấp lên Level ${guildCardManager.getProfile().level}! Quá xuất sắc! 👑`,
          6000,
          'proud'
        );
      }
    } else {
      const studentAnsText = selected.map((idx) => q.options[idx] || '').join(', ');
      animeMascot.explainWrongAnswer(
        q.text,
        studentAnsText,
        q.explanation,
        () => this.openAiDeepExplain(q),
        () => this.generateVariantQuestion(q)
      );
      guildCardManager.recordAnswer(false);
    }
  }

  /**
   * AI Sensei Step-by-Step Deep Explanation Dialog
   */
  public openAiDeepExplain(q: Question): void {
    let modal = document.getElementById('ai-sensei-explain-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'ai-sensei-explain-modal';
      modal.style.cssText = `
        position: fixed; inset: 0; z-index: 9998; background: rgba(9, 13, 22, 0.85);
        backdrop-filter: blur(8px); display: flex; align-items: center; justify-content: center; padding: 16px;
      `;
      document.body.appendChild(modal);
    }

    const renderedQuestion = KaTeXRenderer.renderTextWithMath(q.text);
    const renderedExplanation = q.explanation
      ? KaTeXRenderer.renderTextWithMath(q.explanation)
      : 'Để giải quyết câu hỏi này, bạn cần xác định bản chất hiện tượng/công thức cốt lõi và loại trừ các phương án gây nhiễu.';

    modal.innerHTML = `
      <div style="
        background: #0f172a; border: 1px solid rgba(0, 240, 255, 0.35); border-radius: 20px;
        width: 95%; max-width: 680px; max-height: 85vh; display: flex; flex-direction: column; overflow: hidden;
        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.8);
      ">
        <div style="padding: 16px 22px; border-bottom: 1px solid rgba(255,255,255,0.08); display: flex; justify-content: space-between; align-items: center;">
          <h3 style="margin: 0; font-size: 1.15rem; color: #00f0ff; display: flex; align-items: center; gap: 8px;">
            🌸 AI Sensei • Hướng Dẫn Giải Chi Tiết
          </h3>
          <button type="button" id="btn-close-ai-explain" style="background: rgba(255,255,255,0.1); color: #cbd5e1; border: none; padding: 6px 12px; border-radius: 8px; cursor: pointer;">✕</button>
        </div>
        <div style="padding: 20px; overflow-y: auto; display: flex; flex-direction: column; gap: 14px;">
          <div style="background: rgba(255,255,255,0.04); border-left: 3px solid #00f0ff; padding: 12px 14px; border-radius: 6px;">
            <strong style="color: #94a3b8; font-size: 0.8rem; display: block; margin-bottom: 4px;">ĐỀ BÀI:</strong>
            <div style="color: #f8fafc; font-size: 0.95rem;">${renderedQuestion}</div>
          </div>
          <div>
            <strong style="color: #f59e0b; font-size: 0.85rem; display: flex; align-items: center; gap: 6px; margin-bottom: 6px;">
              💡 Phân tích từng bước từ AI Sensei:
            </strong>
            <div style="background: rgba(15, 23, 42, 0.8); border: 1px solid rgba(245, 158, 11, 0.25); border-radius: 12px; padding: 14px; color: #e2e8f0; line-height: 1.6; font-size: 0.92rem;">
              ${renderedExplanation}
            </div>
          </div>
          <div style="background: rgba(34, 197, 94, 0.08); border: 1px solid rgba(34, 197, 94, 0.3); border-radius: 10px; padding: 12px; font-size: 0.85rem; color: #86efac;">
            🎯 <strong>Mẹo thi cử của Sensei:</strong> Luôn đọc kỹ điều kiện đề bài, chú ý các từ phủ định hoặc đơn vị đo lường trước khi chọn đáp án!
          </div>
        </div>
      </div>
    `;

    modal.style.display = 'flex';
    modal.querySelector('#btn-close-ai-explain')?.addEventListener('click', () => {
      if (modal) modal.style.display = 'none';
    });
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.style.display = 'none';
    });
  }

  /**
   * Generates a similar practice question variant for skill reinforcement
   */
  public generateVariantQuestion(q: Question): void {
    if (!this.exam) return;

    // Create variant question with adapted context
    const variantQuestion: Question = {
      ...q,
      id: `${q.id}_variant_${Date.now()}`,
      text: `[Luyện tập thêm dạng tương tự] ${q.text}`,
      correctAnswer: [...q.correctAnswer],
      explanation: q.explanation ? `[Lời giải câu tương tự]: ${q.explanation}` : undefined,
    };

    // Append to current exam in practice mode
    this.exam.questions.push(variantQuestion);
    this.processedQuestions.delete(this.exam.questions.length - 1);
    this.render();

    // Scroll to the new question
    const newIdx = this.exam.questions.length - 1;
    setTimeout(() => {
      const el = document.getElementById(`q-card-${newIdx}`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el?.classList.add('active-focus');
    }, 150);

    animeMascot.speak(`✨ Sensei đã tạo xong câu hỏi tương tự ở cuối trang (Câu ${this.exam.questions.length}) để Senpai thử sức lại!`, 5000, 'excited');
  }
}

export const practiceView = new PracticeView();
