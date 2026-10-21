/**
 * src/features/editor/question-studio.ts - TypeScript Question Studio & Azota Matrix Editor
 * Enterprise Architecture: 0ms Interactive Answer Matrix, Live KaTeX Preview,
 * Quick Key String Importer, AI Auto-Solve, and Raw Source Synchronization.
 */

import type { Exam, Question, QuestionType } from '../../shared/types';
import { KaTeXRenderer } from '../../shared/renderers/katex';
import { CodeRenderer } from '../../shared/renderers/code';
import { sanitizeHtml } from '../../shared/security/sanitizer';
import { localDB } from '../../shared/db/dexie-db';
import { themeManager } from '../theme/theme-manager';
import { visionExamImporter } from './vision-exam-importer';
import { shareExamLinkService } from '../classroom/share-exam-link';
import { soundEngine } from '../../shared/audio/sound-engine';
import { animeMascot } from '../mascot/anime-mascot';

export class QuestionStudio {
  private currentExam: Exam | null = null;
  private currentQuestions: Question[] = [];
  private activeQuestionIndex = 0;
  private currentViewMode: 'matrix' | 'detail' | 'source' = 'matrix';
  private currentMatrixFilter: 'all' | 'unanswered' | 'answered' = 'all';
  private onApplyCallback: ((exam: Exam) => void) | null = null;
  private rawSourceText = '';
  private isInitialized = false;

  constructor() {}

  public getViewMode(): 'matrix' | 'detail' | 'source' {
    return this.currentViewMode;
  }

  public init(): void {
    if (this.isInitialized) return;
    this.isInitialized = true;
    this.bindStaticListeners();
  }

  /**
   * Open Question Studio modal with existing exam or blank template
   */
  public open(exam?: Exam | null, onApply?: (updatedExam: Exam) => void, rawSource?: string): void {
    this.init();

    if (exam && exam.questions && exam.questions.length > 0) {
      this.currentExam = JSON.parse(JSON.stringify(exam)) as Exam;
      this.currentQuestions = this.currentExam.questions;
    } else {
      const newExam: Exam = {
        id: `exam_studio_${Date.now()}`,
        title: 'Đề thi tự soạn - OmniQuiz Studio',
        description: 'Đề thi được biên tập bằng công cụ Question Studio',
        subject: 'Tự do',
        durationMinutes: 60,
        totalQuestions: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        roomCode: `${Math.floor(100000 + Math.random() * 900000)}`,
        questions: [this.createBlankQuestion(1)],
      };
      this.currentExam = newExam;
      this.currentQuestions = newExam.questions;
    }

    this.activeQuestionIndex = 0;
    this.onApplyCallback = onApply || null;
    this.rawSourceText = rawSource || this.questionsToTxt(this.currentQuestions);

    const modal = document.getElementById('question-studio-modal');
    if (!modal) return;
    modal.style.display = 'flex';

    const unansweredCount = this.countUnanswered();
    if (unansweredCount > 0) {
      this.showReviewBanner(unansweredCount, this.currentQuestions.length);
    } else {
      this.hideReviewBanner();
    }

    this.switchView('matrix');
    this.updateHeaderStats();
    this.renderAnswerMatrix();
    this.renderQuestionList();
    this.loadQuestionDetail(this.activeQuestionIndex);
    this.updateSourceView();
  }

  public close(): void {
    const modal = document.getElementById('question-studio-modal');
    if (modal) modal.style.display = 'none';
    this.closeQuickKeyModal();
  }

  private countUnanswered(): number {
    return this.currentQuestions.filter((q) => !q.correctAnswer || q.correctAnswer.length === 0).length;
  }

  private updateHeaderStats(): void {
    const total = this.currentQuestions.length;
    const unanswered = this.countUnanswered();
    const answered = total - unanswered;
    const completeness = total > 0 ? Math.round((answered / total) * 100) : 0;

    const countEl = document.getElementById('studio-total-count');
    if (countEl) countEl.textContent = `${total} câu hỏi`;

    const badgeEl = document.getElementById('studio-status-badge');
    if (badgeEl) {
      if (unanswered === 0) {
        badgeEl.className = 'studio-health-badge status-ok';
        badgeEl.textContent = `✓ 100% Đầy đủ đáp án`;
      } else {
        badgeEl.className = 'studio-health-badge status-warn';
        badgeEl.textContent = `⚠️ Còn ${unanswered} câu chưa có đáp án`;
      }
    }

    const compText = document.getElementById('studio-completeness-text');
    if (compText) {
      compText.textContent = `Độ hoàn thiện: ${completeness}% (${answered}/${total} câu)`;
      compText.style.color = unanswered === 0 ? '#10b981' : '#f59e0b';
    }

    const tabMatrixCount = document.getElementById('badge-matrix-count');
    if (tabMatrixCount) {
      tabMatrixCount.textContent = `${answered}/${total}`;
    }

    const fAll = document.getElementById('azota-filter-all-count');
    const fUn = document.getElementById('azota-filter-unanswered-count');
    const fAns = document.getElementById('azota-filter-answered-count');
    if (fAll) fAll.textContent = String(total);
    if (fUn) fUn.textContent = String(unanswered);
    if (fAns) fAns.textContent = String(answered);
  }

  private showReviewBanner(unanswered: number, total: number): void {
    const banner = document.getElementById('studio-review-banner');
    if (!banner) return;
    banner.style.display = 'flex';
    const titleEl = document.getElementById('studio-review-title');
    const descEl = document.getElementById('studio-review-desc');
    if (titleEl) {
      titleEl.textContent = `Phát hiện ${unanswered}/${total} câu hỏi chưa có đáp án trong đề thi!`;
    }
    if (descEl) {
      descEl.textContent = `Vui lòng click chọn đáp án trong bảng ma trận Azota bên dưới, hoặc dùng "Nhập nhanh đáp án" / "AI Tự điền" để hoàn tất bộ đề trước khi luyện tập.`;
    }
  }

  private hideReviewBanner(): void {
    const banner = document.getElementById('studio-review-banner');
    if (banner) banner.style.display = 'none';
  }

  public switchView(viewMode: 'matrix' | 'detail' | 'source'): void {
    this.currentViewMode = viewMode;

    document.querySelectorAll('.studio-tab-btn').forEach((btn) => {
      const mode = btn.getAttribute('data-view');
      btn.classList.toggle('active', mode === viewMode);
    });

    const matrixPane = document.getElementById('studio-matrix-pane');
    const detailPane = document.getElementById('studio-detail-pane');
    const sourcePane = document.getElementById('studio-source-pane');

    if (matrixPane) matrixPane.style.display = viewMode === 'matrix' ? 'flex' : 'none';
    if (detailPane) detailPane.style.display = viewMode === 'detail' ? 'flex' : 'none';
    if (sourcePane) sourcePane.style.display = viewMode === 'source' ? 'flex' : 'none';

    if (viewMode === 'matrix') {
      this.renderAnswerMatrix();
    } else if (viewMode === 'detail') {
      this.renderQuestionList();
      this.loadQuestionDetail(this.activeQuestionIndex);
    } else if (viewMode === 'source') {
      this.updateSourceView();
    }
  }

  public appendOrReplaceQuestions(newQuestions: Question[]): void {
    if (!newQuestions || newQuestions.length === 0) return;

    // If current questions are empty or only contains a single default blank question
    const firstQ = this.currentQuestions[0];
    if (
      this.currentQuestions.length <= 1 &&
      (!firstQ ||
        firstQ.text.trim() === 'Nhập nội dung câu hỏi tại đây...' ||
        !firstQ.text.trim())
    ) {
      this.currentQuestions = newQuestions.map((q, idx) => ({ ...q, index: idx + 1 }));
    } else {
      const startIdx = this.currentQuestions.length;
      const mapped = newQuestions.map((q, idx) => ({ ...q, index: startIdx + idx + 1 }));
      this.currentQuestions.push(...mapped);
    }

    if (this.currentExam) {
      this.currentExam.questions = this.currentQuestions;
      this.currentExam.totalQuestions = this.currentQuestions.length;
    }

    this.activeQuestionIndex = 0;
    this.updateHeaderStats();
    this.renderAnswerMatrix();
    this.renderQuestionList();
    this.loadQuestionDetail(0);
    this.updateSourceView();

    animeMascot.speak(`🎉 Đã nạp thành công ${newQuestions.length} câu hỏi vào Question Studio! ✨`, 4000, 'happy');
  }

  public renderAnswerMatrix(filter = this.currentMatrixFilter, searchKeyword = ''): void {
    const grid = document.getElementById('azota-matrix-grid');
    if (!grid) return;

    grid.innerHTML = '';
    this.currentMatrixFilter = filter;
    const kw = (searchKeyword || '').trim().toLowerCase();

    this.currentQuestions.forEach((q, idx) => {
      const isUnanswered = !q.correctAnswer || q.correctAnswer.length === 0;

      if (filter === 'unanswered' && !isUnanswered) return;
      if (filter === 'answered' && isUnanswered) return;

      if (kw && !((q.text || '').toLowerCase().includes(kw) || `câu ${idx + 1}`.includes(kw))) {
        return;
      }

      const row = document.createElement('div');
      row.className = `azota-row ${isUnanswered ? 'needs-answer' : 'has-answer'}`;
      row.dataset.qIndex = String(idx);

      const snippet = (this.stripMathTags(q.text || '') || '(Chưa có nội dung)').slice(0, 65);
      const selectedLetters = (q.correctAnswer || []).map((a) => String.fromCharCode(65 + a)).join(', ');

      const leftDiv = document.createElement('div');
      leftDiv.className = 'azota-row-left';
      leftDiv.innerHTML = `
        <span class="azota-q-number">Câu ${idx + 1}</span>
        <span class="azota-q-snippet" title="${this.escapeHtml(q.text || '')}">${this.escapeHtml(snippet)}...</span>
        <span id="azota-badge-${idx}" class="${isUnanswered ? 'azota-badge-unanswered' : 'azota-badge-answered'}">
          ${isUnanswered ? '⚠️ Chưa chọn' : `✓ ${selectedLetters}`}
        </span>
      `;

      leftDiv.querySelector('.azota-q-snippet')?.addEventListener('click', () => {
        this.activeQuestionIndex = idx;
        this.switchView('detail');
      });

      const rightDiv = document.createElement('div');
      rightDiv.className = 'azota-row-right';

      const pillsContainer = document.createElement('div');
      pillsContainer.className = 'azota-options-pills';

      const numOpts = q.options && q.options.length >= 2 ? q.options.length : 4;
      for (let optIdx = 0; optIdx < numOpts; optIdx++) {
        const letter = String.fromCharCode(65 + optIdx);
        const isSelected = (q.correctAnswer || []).includes(optIdx);

        const pill = document.createElement('button');
        pill.type = 'button';
        pill.className = `azota-opt-pill ${isSelected ? 'active' : ''}`;
        pill.dataset.q = String(idx);
        pill.dataset.opt = String(optIdx);
        pill.title = `Chọn đáp án ${letter} cho Câu ${idx + 1}`;
        pill.textContent = letter;

        pill.addEventListener('click', (e) => {
          e.stopPropagation();
          this.handleMatrixPillClick(idx, optIdx, row, pillsContainer);
        });

        pillsContainer.appendChild(pill);
      }

      const editBtn = document.createElement('button');
      editBtn.type = 'button';
      editBtn.className = 'btn-action btn-sm azota-btn-edit';
      editBtn.title = `Chỉnh sửa chi tiết Câu ${idx + 1}`;
      editBtn.textContent = '✏️';
      editBtn.addEventListener('click', () => {
        this.activeQuestionIndex = idx;
        this.switchView('detail');
      });

      rightDiv.appendChild(pillsContainer);
      rightDiv.appendChild(editBtn);

      row.appendChild(leftDiv);
      row.appendChild(rightDiv);
      grid.appendChild(row);
    });

    this.updateHeaderStats();
  }

  private handleMatrixPillClick(
    qIdx: number,
    optIdx: number,
    rowEl: HTMLElement,
    pillsContainer: HTMLElement
  ): void {
    if (qIdx < 0 || qIdx >= this.currentQuestions.length) return;
    const q = this.currentQuestions[qIdx];
    if (!q) return;

    if (q.type === 'multiple') {
      if (!Array.isArray(q.correctAnswer)) {
        q.correctAnswer = [];
      }
      const existIdx = q.correctAnswer.indexOf(optIdx);
      if (existIdx > -1) {
        q.correctAnswer.splice(existIdx, 1);
      } else {
        q.correctAnswer.push(optIdx);
        q.correctAnswer.sort((a, b) => a - b);
      }
    } else {
      q.correctAnswer = [optIdx];
    }

    const isUnanswered = !q.correctAnswer || q.correctAnswer.length === 0;
    pillsContainer.querySelectorAll<HTMLButtonElement>('.azota-opt-pill').forEach((btn) => {
      const bOpt = parseInt(btn.dataset.opt || '-1', 10);
      btn.classList.toggle('active', q.correctAnswer.includes(bOpt));
    });

    rowEl.className = `azota-row ${isUnanswered ? 'needs-answer' : 'has-answer'}`;
    const badgeEl = document.getElementById(`azota-badge-${qIdx}`);
    if (badgeEl) {
      const selectedLetters = q.correctAnswer.map((a) => String.fromCharCode(65 + a)).join(', ');
      badgeEl.className = isUnanswered ? 'azota-badge-unanswered' : 'azota-badge-answered';
      badgeEl.textContent = isUnanswered ? '⚠️ Chưa chọn' : `✓ ${selectedLetters}`;
    }

    this.updateHeaderStats();

    if (this.countUnanswered() === 0) {
      this.hideReviewBanner();
    }
  }

  public openQuickKeyModal(): void {
    const modal = document.getElementById('quick-key-modal');
    if (!modal) return;
    modal.style.display = 'flex';
    const txt = document.getElementById('input-quick-key-text') as HTMLTextAreaElement | null;
    if (txt) {
      txt.value = '';
      txt.focus();
    }
    const start = document.getElementById('input-quick-key-start') as HTMLInputElement | null;
    if (start) start.value = '1';
  }

  public closeQuickKeyModal(): void {
    const modal = document.getElementById('quick-key-modal');
    if (modal) modal.style.display = 'none';
  }

  public applyQuickKeyString(): void {
    const txtEl = document.getElementById('input-quick-key-text') as HTMLTextAreaElement | null;
    const startEl = document.getElementById('input-quick-key-start') as HTMLInputElement | null;
    if (!txtEl || !txtEl.value.trim()) {
      alert('Vui lòng nhập chuỗi đáp án (Ví dụ: 1A 2B 3C... hoặc ABCD...)!');
      return;
    }

    const startNum = parseInt(startEl?.value || '1', 10) || 1;
    const keyMap = this.parseAnswerKeyString(txtEl.value, startNum);
    const mappedKeys = Object.keys(keyMap);

    if (mappedKeys.length === 0) {
      alert('Không tìm thấy cặp đáp án hợp lệ trong chuỗi vừa dán. Vui lòng kiểm tra lại định dạng!');
      return;
    }

    let appliedCount = 0;
    mappedKeys.forEach((qNumStr) => {
      const qNum = parseInt(qNumStr, 10);
      const qIdx = qNum - 1;
      if (qIdx >= 0 && qIdx < this.currentQuestions.length) {
        const optVal = keyMap[qNum];
        if (typeof optVal === 'number') {
          this.currentQuestions[qIdx]!.correctAnswer = [optVal];
          appliedCount++;
        }
      }
    });

    this.closeQuickKeyModal();
    this.renderAnswerMatrix();
    this.updateHeaderStats();

    if (this.countUnanswered() === 0) {
      this.hideReviewBanner();
    }

    themeManager.showToast(`✓ Đã tự động cập nhật đáp án cho ${appliedCount} câu hỏi!`);
  }

  public parseAnswerKeyString(input: string, startNum: number = 1): Record<number, number> {
    const result: Record<number, number> = {};
    const text = input.trim();

    // Format 1: 1A 2B 3C or 1.A 2.B or Câu 1: A
    const regexExplicit = /(?:câu\s*)?(\d+)\s*[:.\-=_)]*\s*([A-Fa-f])/gi;
    let match: RegExpExecArray | null;
    let foundExplicit = false;

    while ((match = regexExplicit.exec(text)) !== null) {
      foundExplicit = true;
      const qNum = parseInt(match[1] || '0', 10);
      const letter = (match[2] || 'A').toUpperCase();
      const optIdx = letter.charCodeAt(0) - 65;
      if (qNum > 0 && optIdx >= 0 && optIdx < 10) {
        result[qNum] = optIdx;
      }
    }

    // Format 2: Continuous letters (ABCDABCD...)
    if (!foundExplicit) {
      const cleanLetters = text.replace(/[^A-Fa-f]/g, '').toUpperCase();
      for (let i = 0; i < cleanLetters.length; i++) {
        const qNum = startNum + i;
        const optIdx = cleanLetters.charCodeAt(i) - 65;
        if (optIdx >= 0 && optIdx < 10) {
          result[qNum] = optIdx;
        }
      }
    }

    return result;
  }

  public async triggerAiSolveForMissing(): Promise<void> {
    const missingIndices: number[] = [];
    this.currentQuestions.forEach((q, idx) => {
      if (!q.correctAnswer || q.correctAnswer.length === 0) {
        missingIndices.push(idx);
      }
    });

    if (missingIndices.length === 0) {
      themeManager.showToast('✓ Tất cả các câu hỏi trong đề đều đã có đáp án đầy đủ!');
      return;
    }

    const apiKey = localStorage.getItem('omniquiz_gemini_api_key') || '';
    if (!apiKey) {
      const enteredKey = prompt(
        'Vui lòng nhập Google Gemini API Key để kích hoạt AI Tự động giải và điền đáp án:\n(Khóa được lưu cục bộ trên trình duyệt của bạn)',
        ''
      );
      if (enteredKey && enteredKey.trim()) {
        localStorage.setItem('omniquiz_gemini_api_key', enteredKey.trim());
      } else {
        return;
      }
    }

    themeManager.showToast('🤖 AI đang phân tích và giải các câu còn thiếu...');

    try {
      const batchIndices = missingIndices.slice(0, 30);
      const questionsPrompt = batchIndices
        .map((i) => {
          const q = this.currentQuestions[i]!;
          const opts = (q.options || [])
            .map((o, optIdx) => `${String.fromCharCode(65 + optIdx)}. ${o}`)
            .join('\n');
          return `[Câu ${i + 1}]\n${q.text}\n${opts}`;
        })
        .join('\n\n');

      const systemPrompt = `Bạn là một giáo viên chuyên môn cao và chuyên gia giải đề thi trắc nghiệm Việt Nam.
Hãy giải các câu hỏi trắc nghiệm dưới đây và xác định đáp án đúng chính xác nhất (chỉ chọn A, B, C, D, E, F...).
Trả về DUY NHẤT một chuỗi JSON mảng (không thêm text ngoài JSON):
[
  {
    "qNum": 1,
    "answer": "A",
    "explanation": "Giải thích ngắn gọn 1-2 câu"
  }
]

DANH SÁCH CÂU HỎI CẦN GIẢI:
${questionsPrompt}`;

      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: systemPrompt }] }],
          }),
        }
      );

      if (!res.ok) {
        throw new Error(`Gemini API returned status ${res.status}`);
      }

      const resData = (await res.json()) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      };
      const rawText = resData.candidates?.[0]?.content?.parts?.[0]?.text || '';
      let cleanJson = rawText.trim();
      const jsonMatch = cleanJson.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
      if (jsonMatch) cleanJson = jsonMatch[1]?.trim() || '';

      const parsedResults = JSON.parse(cleanJson) as Array<{
        qNum: number;
        answer: string;
        explanation?: string;
      }>;
      let solvedCount = 0;

      if (Array.isArray(parsedResults)) {
        parsedResults.forEach((item) => {
          const qNum = item.qNum;
          const qIdx = qNum - 1;
          if (qIdx >= 0 && qIdx < this.currentQuestions.length && item.answer) {
            const letter = String(item.answer).trim().toUpperCase();
            const ansIdx = letter.charCodeAt(0) - 65;
            const targetQ = this.currentQuestions[qIdx];
            if (targetQ && ansIdx >= 0 && ansIdx < targetQ.options.length) {
              targetQ.correctAnswer = [ansIdx];
              if (item.explanation && !targetQ.explanation) {
                targetQ.explanation = item.explanation;
              }
              solvedCount++;
            }
          }
        });
      }

      this.renderAnswerMatrix();
      this.updateHeaderStats();
      if (this.countUnanswered() === 0) {
        this.hideReviewBanner();
      }
      themeManager.showToast(`🎉 AI đã tự động giải & điền thành công đáp án cho ${solvedCount} câu hỏi!`);
    } catch (err) {
      console.error('[AI Solve Error]', err);
      alert('Lỗi khi AI giải đề. Bạn có thể chọn đáp án bằng tay trên bảng ma trận Azota.');
    }
  }

  private updateSourceView(): void {
    const area = document.getElementById('studio-source-textarea') as HTMLTextAreaElement | null;
    if (area) {
      area.value = this.rawSourceText || this.questionsToTxt(this.currentQuestions);
    }
  }

  private copySourceText(): void {
    const area = document.getElementById('studio-source-textarea') as HTMLTextAreaElement | null;
    if (area && area.value) {
      void navigator.clipboard.writeText(area.value);
      themeManager.showToast('✓ Đã sao chép văn bản gốc vào bộ nhớ tạm!');
    }
  }

  public questionsToTxt(questions: Question[]): string {
    return questions
      .map((q, idx) => {
        const opts = (q.options || [])
          .map((opt, oIdx) => `${String.fromCharCode(65 + oIdx)}. ${opt}`)
          .join('\n');
        const correctLetters = (q.correctAnswer || [])
          .map((a) => String.fromCharCode(65 + a))
          .join(', ');
        const exp = q.explanation ? `\nLời giải: ${q.explanation}` : '';
        return `Câu ${idx + 1}: ${q.text}\n${opts}\nĐáp án: ${correctLetters}${exp}`;
      })
      .join('\n\n');
  }

  public createBlankQuestion(number = 1): Question {
    return {
      id: `q_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      index: number - 1,
      text: `Câu ${number}: Nhập nội dung câu hỏi tại đây...`,
      options: ['Phương án A', 'Phương án B', 'Phương án C', 'Phương án D'],
      type: 'single',
      correctAnswer: [0],
      explanation: '',
    };
  }

  private renderQuestionList(filterKeyword = ''): void {
    const listContainer = document.getElementById('studio-qlist');
    if (!listContainer) return;

    listContainer.innerHTML = '';
    const keyword = (filterKeyword || '').trim().toLowerCase();

    this.currentQuestions.forEach((q, idx) => {
      const matchesSearch = !keyword || (q.text && q.text.toLowerCase().includes(keyword));
      if (!matchesSearch) return;

      const item = document.createElement('div');
      item.className = 'studio-q-item' + (idx === this.activeQuestionIndex ? ' active' : '');
      item.dataset.index = String(idx);

      const hasWarning =
        !q.text || !q.options || q.options.length < 2 || !q.correctAnswer || q.correctAnswer.length === 0;
      const badgeType = q.type === 'multiple' ? 'Nhiều đáp án' : '1 đáp án';
      const numOptions = q.options ? q.options.length : 0;

      item.innerHTML = `
        <div class="studio-q-item-header">
          <span class="studio-q-num">Câu ${idx + 1}</span>
          <span class="studio-q-badge ${q.type}">${badgeType}</span>
        </div>
        <div class="studio-q-snippet">${this.escapeHtml(this.stripMathTags(q.text || '')).slice(0, 70) || '(Chưa có nội dung)'}...</div>
        <div class="studio-q-meta">
          <span>${numOptions} lựa chọn</span>
          ${hasWarning ? '<span class="studio-q-warn" title="Chưa có đáp án">⚠️ Thiếu đáp án</span>' : '<span>✓ Hợp lệ</span>'}
        </div>
      `;

      item.addEventListener('click', () => {
        this.saveCurrentQuestionFromForm();
        this.activeQuestionIndex = idx;
        this.renderQuestionList(filterKeyword);
        this.loadQuestionDetail(this.activeQuestionIndex);
      });

      listContainer.appendChild(item);
    });

    this.updateHeaderStats();
  }

  private loadQuestionDetail(idx: number): void {
    if (idx < 0 || idx >= this.currentQuestions.length) return;
    const q = this.currentQuestions[idx];
    if (!q) return;

    const qTitleInput = document.getElementById('studio-input-q') as HTMLTextAreaElement | null;
    const qTypeSelect = document.getElementById('studio-select-type') as HTMLSelectElement | null;
    const qExpInput = document.getElementById('studio-input-exp') as HTMLTextAreaElement | null;
    const qImageUrlInput = document.getElementById('studio-input-imgurl') as HTMLInputElement | null;
    const curIndexLabel = document.getElementById('studio-current-q-index');

    if (curIndexLabel) curIndexLabel.textContent = `Câu ${idx + 1} / ${this.currentQuestions.length}`;
    if (qTitleInput) qTitleInput.value = q.text || '';
    if (qTypeSelect) qTypeSelect.value = q.type || 'single';
    if (qExpInput) qExpInput.value = q.explanation || '';
    if (qImageUrlInput) qImageUrlInput.value = q.imageUrl || '';

    this.renderOptionsForm(q);
    this.updateLivePreview(q);
  }

  private renderOptionsForm(q: Question): void {
    const container = document.getElementById('studio-options-container');
    if (!container) return;

    container.innerHTML = '';
    const answers = q.correctAnswer || [];

    q.options.forEach((optText, optIdx) => {
      const letter = String.fromCharCode(65 + optIdx);
      const isCorrect = answers.includes(optIdx);

      const row = document.createElement('div');
      row.className = 'studio-opt-row';
      row.style.cssText = 'display: flex; align-items: center; gap: 8px; margin-bottom: 8px;';

      row.innerHTML = `
        <button type="button" class="btn-action azota-opt-pill ${isCorrect ? 'active' : ''}" style="width: 32px; height: 32px; padding: 0; font-weight: 700;" title="Đánh dấu đây là đáp án đúng">${letter}</button>
        <input type="text" class="custom-select studio-opt-input" data-opt="${optIdx}" value="${this.escapeHtml(optText)}" style="flex: 1; padding: 6px 10px;">
        <button type="button" class="btn-action btn-del-opt" data-opt="${optIdx}" style="padding: 4px 8px; color: #ef4444;" title="Xóa phương án">✕</button>
      `;

      // Pill toggle correct answer
      row.querySelector('.azota-opt-pill')?.addEventListener('click', () => {
        if (q.type === 'multiple') {
          const exIdx = q.correctAnswer.indexOf(optIdx);
          if (exIdx > -1) q.correctAnswer.splice(exIdx, 1);
          else {
            q.correctAnswer.push(optIdx);
            q.correctAnswer.sort((a, b) => a - b);
          }
        } else {
          q.correctAnswer = [optIdx];
        }
        this.renderOptionsForm(q);
        this.updateLivePreview(q);
        this.updateHeaderStats();
      });

      // Text input change
      const inputEl = row.querySelector('.studio-opt-input') as HTMLInputElement | null;
      inputEl?.addEventListener('input', () => {
        q.options[optIdx] = inputEl.value;
        this.updateLivePreview(q);
      });

      // Delete option button
      row.querySelector('.btn-del-opt')?.addEventListener('click', () => {
        if (q.options.length <= 2) {
          alert('Mỗi câu hỏi cần có tối thiểu 2 phương án lựa chọn!');
          return;
        }
        q.options.splice(optIdx, 1);
        q.correctAnswer = q.correctAnswer
          .filter((a) => a !== optIdx)
          .map((a) => (a > optIdx ? a - 1 : a));
        this.renderOptionsForm(q);
        this.updateLivePreview(q);
      });

      container.appendChild(row);
    });
  }

  private updateLivePreview(q: Question): void {
    const previewBox = document.getElementById('studio-preview-box');
    if (!previewBox) return;

    const renderedQ = KaTeXRenderer.renderTextWithMath(
      CodeRenderer.parseMarkdownCodeBlocks(q.text || '')
    );
    const answers = q.correctAnswer || [];

    const optionsHtml = (q.options || [])
      .map((opt, optIdx) => {
        const letter = String.fromCharCode(65 + optIdx);
        const isCorr = answers.includes(optIdx);
        return `
          <div style="display: flex; align-items: baseline; gap: 8px; margin: 4px 0; color: ${isCorr ? '#22c55e' : 'inherit'}; font-weight: ${isCorr ? '700' : 'normal'};">
            <span><strong>${letter}.</strong></span>
            <span>${KaTeXRenderer.renderTextWithMath(opt)}</span>
            ${isCorr ? '<span style="font-size: 0.8rem; margin-left: 6px;">✓ (Đúng)</span>' : ''}
          </div>
        `;
      })
      .join('');

    const expHtml = q.explanation
      ? `<div style="margin-top: 8px; padding-top: 8px; border-top: 1px dashed rgba(255,255,255,0.1); font-size: 0.88rem; color: #94a3b8;"><strong>💡 Lời giải:</strong> ${KaTeXRenderer.renderTextWithMath(q.explanation)}</div>`
      : '';

    previewBox.innerHTML = sanitizeHtml(`
      <div style="font-weight: 600; margin-bottom: 8px;">${renderedQ}</div>
      <div>${optionsHtml}</div>
      ${expHtml}
    `);
  }

  private saveCurrentQuestionFromForm(): void {
    if (this.activeQuestionIndex < 0 || this.activeQuestionIndex >= this.currentQuestions.length) return;
    const q = this.currentQuestions[this.activeQuestionIndex];
    if (!q) return;

    const qTitleInput = document.getElementById('studio-input-q') as HTMLTextAreaElement | null;
    const qTypeSelect = document.getElementById('studio-select-type') as HTMLSelectElement | null;
    const qExpInput = document.getElementById('studio-input-exp') as HTMLTextAreaElement | null;
    const qImageUrlInput = document.getElementById('studio-input-imgurl') as HTMLInputElement | null;

    if (qTitleInput) q.text = qTitleInput.value;
    if (qTypeSelect) q.type = (qTypeSelect.value || 'single') as QuestionType;
    if (qExpInput) q.explanation = qExpInput.value;
    if (qImageUrlInput) q.imageUrl = qImageUrlInput.value.trim() || undefined;
  }

  public applyAndStartExam(): void {
    this.saveCurrentQuestionFromForm();

    const unanswered = this.countUnanswered();
    if (unanswered > 0) {
      const ok = confirm(
        `Vẫn còn ${unanswered} câu chưa có đáp án trong bảng ma trận. Bạn có chắc muốn lưu và bắt đầu bài thi không?`
      );
      if (!ok) {
        this.switchView('matrix');
        return;
      }
    }

    if (!this.currentExam) return;

    this.currentExam.questions = this.currentQuestions;
    this.currentExam.totalQuestions = this.currentQuestions.length;
    this.currentExam.updatedAt = new Date().toISOString();

    void localDB.saveExam(this.currentExam);
    themeManager.showToast('💾 Đã lưu thành công bộ đề thi vào hệ thống!');

    this.close();

    if (this.onApplyCallback) {
      this.onApplyCallback(this.currentExam);
    }
  }

  private bindStaticListeners(): void {
    // Tab switching
    document.getElementById('tab-btn-matrix')?.addEventListener('click', () => this.switchView('matrix'));
    document.getElementById('tab-btn-detail')?.addEventListener('click', () => this.switchView('detail'));
    document.getElementById('tab-btn-source')?.addEventListener('click', () => this.switchView('source'));

    // Close studio
    document.getElementById('btn-close-studio')?.addEventListener('click', () => this.close());

    // AI Vision OCR & Camera Scan
    document.getElementById('btn-studio-vision-ocr')?.addEventListener('click', () => {
      soundEngine.playClick();
      visionExamImporter.openVisionModal((newQuestions) => {
        this.appendOrReplaceQuestions(newQuestions);
      });
    });

    // AI Topic Generator
    document.getElementById('btn-studio-ai-topic')?.addEventListener('click', () => {
      soundEngine.playClick();
      visionExamImporter.openTopicGeneratorModal((newQuestions) => {
        this.appendOrReplaceQuestions(newQuestions);
      });
    });

    // Share Link & QR
    document.getElementById('btn-studio-share-link')?.addEventListener('click', () => {
      soundEngine.playClick();
      if (!this.currentExam) return;
      this.currentExam.questions = this.currentQuestions;
      this.currentExam.totalQuestions = this.currentQuestions.length;
      void shareExamLinkService.openShareModal(this.currentExam);
    });

    // Apply & practice
    document.getElementById('btn-studio-apply')?.addEventListener('click', () => this.applyAndStartExam());

    // Quick key modal buttons
    const openQuick = () => this.openQuickKeyModal();
    document.getElementById('btn-studio-quick-key')?.addEventListener('click', openQuick);
    document.getElementById('btn-matrix-quick-key')?.addEventListener('click', openQuick);
    document.getElementById('btn-banner-quick-key')?.addEventListener('click', openQuick);

    document.getElementById('btn-close-quick-key')?.addEventListener('click', () => this.closeQuickKeyModal());
    document.getElementById('btn-cancel-quick-key')?.addEventListener('click', () => this.closeQuickKeyModal());
    document.getElementById('btn-apply-quick-key')?.addEventListener('click', () => this.applyQuickKeyString());

    // AI solve buttons
    const aiSolve = () => void this.triggerAiSolveForMissing();
    document.getElementById('btn-studio-ai-solve')?.addEventListener('click', aiSolve);
    document.getElementById('btn-banner-ai-solve')?.addEventListener('click', aiSolve);

    // Filter matrix buttons
    document.getElementById('azota-filter-all')?.addEventListener('click', (e) => {
      this.setFilterActive(e.currentTarget as HTMLElement);
      this.renderAnswerMatrix('all');
    });
    document.getElementById('azota-filter-unanswered')?.addEventListener('click', (e) => {
      this.setFilterActive(e.currentTarget as HTMLElement);
      this.renderAnswerMatrix('unanswered');
    });
    document.getElementById('azota-filter-answered')?.addEventListener('click', (e) => {
      this.setFilterActive(e.currentTarget as HTMLElement);
      this.renderAnswerMatrix('answered');
    });

    // Matrix search input
    const searchInp = document.getElementById('azota-search-input') as HTMLInputElement | null;
    searchInp?.addEventListener('input', () => {
      this.renderAnswerMatrix(this.currentMatrixFilter, searchInp.value);
    });

    // Source buttons
    document.getElementById('btn-copy-source-text')?.addEventListener('click', () => this.copySourceText());

    // Detail form live inputs
    const qTitleInput = document.getElementById('studio-input-q') as HTMLTextAreaElement | null;
    qTitleInput?.addEventListener('input', () => {
      const q = this.currentQuestions[this.activeQuestionIndex];
      if (q) {
        q.text = qTitleInput.value;
        this.updateLivePreview(q);
      }
    });

    const qExpInput = document.getElementById('studio-input-exp') as HTMLTextAreaElement | null;
    qExpInput?.addEventListener('input', () => {
      const q = this.currentQuestions[this.activeQuestionIndex];
      if (q) {
        q.explanation = qExpInput.value;
        this.updateLivePreview(q);
      }
    });

    // Add option button
    document.getElementById('btn-studio-add-opt')?.addEventListener('click', () => {
      const q = this.currentQuestions[this.activeQuestionIndex];
      if (q) {
        const nextLetter = String.fromCharCode(65 + q.options.length);
        q.options.push(`Phương án ${nextLetter}`);
        this.renderOptionsForm(q);
        this.updateLivePreview(q);
      }
    });

    // Add new question button
    document.getElementById('btn-studio-add-q')?.addEventListener('click', () => {
      this.saveCurrentQuestionFromForm();
      const newNum = this.currentQuestions.length + 1;
      const blank = this.createBlankQuestion(newNum);
      this.currentQuestions.push(blank);
      this.activeQuestionIndex = this.currentQuestions.length - 1;
      this.renderQuestionList();
      this.loadQuestionDetail(this.activeQuestionIndex);
      this.updateHeaderStats();
    });

    // Delete question button
    document.getElementById('btn-studio-del-q')?.addEventListener('click', () => {
      if (this.currentQuestions.length <= 1) {
        alert('Đề thi cần có ít nhất 1 câu hỏi!');
        return;
      }
      if (confirm(`Bạn có chắc muốn xóa câu số ${this.activeQuestionIndex + 1}?`)) {
        this.currentQuestions.splice(this.activeQuestionIndex, 1);
        if (this.activeQuestionIndex >= this.currentQuestions.length) {
          this.activeQuestionIndex = this.currentQuestions.length - 1;
        }
        this.renderQuestionList();
        this.loadQuestionDetail(this.activeQuestionIndex);
        this.updateHeaderStats();
      }
    });

    // Export buttons
    document.getElementById('btn-studio-export-json')?.addEventListener('click', () => {
      this.saveCurrentQuestionFromForm();
      const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(this.currentExam, null, 2));
      const dl = document.createElement('a');
      dl.setAttribute('href', dataStr);
      dl.setAttribute('download', `${this.currentExam?.title || 'exam'}.json`);
      dl.click();
    });

    document.getElementById('btn-studio-export-txt')?.addEventListener('click', () => {
      this.saveCurrentQuestionFromForm();
      const txt = this.questionsToTxt(this.currentQuestions);
      const dataStr = 'data:text/plain;charset=utf-8,' + encodeURIComponent(txt);
      const dl = document.createElement('a');
      dl.setAttribute('href', dataStr);
      dl.setAttribute('download', `${this.currentExam?.title || 'exam'}.txt`);
      dl.click();
    });
  }

  private setFilterActive(targetBtn: HTMLElement): void {
    document.querySelectorAll('.azota-filter-btn').forEach((b) => b.classList.remove('active'));
    targetBtn.classList.add('active');
  }

  private stripMathTags(str: string): string {
    if (!str) return '';
    return str
      .replace(/\$\$(.*?)\$\$/g, ' $1 ')
      .replace(/\$(.*?)\$/g, '$1')
      .replace(/\\(?:frac|text|mathrm|mathbf|sqrt)\b/g, '')
      .replace(/[{}]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}

export const questionStudio = new QuestionStudio();
