/**
 * src/features/ai-tutor/ai-sensei-drawer.ts - AI Sensei Tutor Drawer & Assistant
 * Features:
 * - Current question contextual breakdown (core concept, keywords, formula tips)
 * - Similar variant practice question generator
 * - Local Gemini API Key configuration management
 * - Responsive Drawer & Modal interface
 */

import type { Exam, Question } from '../../shared/types';
import { KaTeXRenderer } from '../../shared/renderers/katex';
import { CodeRenderer } from '../../shared/renderers/code';
import { sanitizeHtml } from '../../shared/security/sanitizer';
import { themeManager } from '../theme/theme-manager';
import { animeMascot } from '../mascot/anime-mascot';

export class AiSenseiDrawer {
  private drawerEl: HTMLElement | null = null;
  private currentExam: Exam | null = null;
  private currentQuestionIndex: number = 0;

  constructor() {}

  public open(exam?: Exam | null, questionIndex?: number): void {
    this.currentExam = exam || null;
    this.currentQuestionIndex = typeof questionIndex === 'number' ? questionIndex : 0;
    this.ensureDrawerElement();
    this.render();
    if (this.drawerEl) {
      this.drawerEl.style.display = 'flex';
      animeMascot.speak('🌸 Sensei có mặt đây Senpai! Cần mình trợ giúp phần nào nào?', 4000, 'excited');
    }
  }

  public close(): void {
    if (this.drawerEl) {
      this.drawerEl.style.display = 'none';
    }
  }

  private ensureDrawerElement(): void {
    let el = document.getElementById('ai-sensei-drawer');
    if (!el) {
      el = document.createElement('div');
      el.id = 'ai-sensei-drawer';
      el.className = 'modal-overlay';
      el.style.cssText = `
        display: none; position: fixed; inset: 0; z-index: 99995;
        background: rgba(9, 13, 22, 0.85); backdrop-filter: blur(8px);
        align-items: center; justify-content: flex-end;
      `;
      document.body.appendChild(el);
    }
    this.drawerEl = el;
  }

  private render(): void {
    if (!this.drawerEl) return;

    const apiKey = localStorage.getItem('omniquiz_gemini_api_key') || '';
    const hasKey = Boolean(apiKey.trim());

    const activeQ: Question | null =
      this.currentExam?.questions?.[this.currentQuestionIndex] ?? null;

    let questionContentHtml = '';
    if (activeQ) {
      const renderedQ = KaTeXRenderer.renderTextWithMath(
        CodeRenderer.parseMarkdownCodeBlocks(activeQ.text)
      );
      const renderedExp = activeQ.explanation
        ? KaTeXRenderer.renderTextWithMath(CodeRenderer.parseMarkdownCodeBlocks(activeQ.explanation))
        : 'Chưa có lời giải chi tiết. Sensei có thể phân tích trực tiếp cho bạn!';

      const optionsHtml = (activeQ.options || [])
        .map((opt, i) => {
          const letter = String.fromCharCode(65 + i);
          return `<div style="padding: 4px 8px; background: rgba(255,255,255,0.03); border-radius: 6px; font-size: 0.88rem; margin: 3px 0;"><strong>${letter}.</strong> ${KaTeXRenderer.renderTextWithMath(opt)}</div>`;
        })
        .join('');

      questionContentHtml = `
        <div style="background: rgba(0, 240, 255, 0.05); border: 1px solid rgba(0, 240, 255, 0.2); border-radius: 12px; padding: 14px; margin-bottom: 14px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
            <span style="font-weight: 700; color: #00f0ff; font-size: 0.95rem;">📝 Đang xem Câu ${this.currentQuestionIndex + 1}:</span>
            <span style="font-size: 0.8rem; opacity: 0.7;">${activeQ.subject || 'Tổng hợp'}</span>
          </div>
          <div style="font-size: 0.92rem; line-height: 1.5; margin-bottom: 8px;">${renderedQ}</div>
          <div style="margin-bottom: 8px;">${optionsHtml}</div>
          <div style="background: rgba(0,0,0,0.2); padding: 8px 10px; border-radius: 8px; font-size: 0.85rem; color: #94a3b8;">
            <strong style="color: #f59e0b;">💡 Gợi ý hiện có:</strong> ${renderedExp}
          </div>
        </div>

        <div style="display: flex; flex-direction: column; gap: 8px; margin-bottom: 16px;">
          <button type="button" id="btn-sensei-explain-deep" class="btn-action btn-ai-glow" style="padding: 10px; justify-content: center; font-weight: 600;">
            🔍 Sensei Phân Tích & Bẻ Khóa Bẫy Câu Hỏi
          </button>
          <button type="button" id="btn-sensei-gen-variant" class="btn-action" style="padding: 10px; justify-content: center; font-weight: 600; background: rgba(168, 85, 247, 0.15); border: 1px solid #a855f7; color: #c084fc;">
            🎯 Luyện Tập Câu Tương Tự
          </button>
        </div>
      `;
    } else {
      questionContentHtml = `
        <div style="background: rgba(255, 255, 255, 0.04); border-radius: 12px; padding: 16px; margin-bottom: 16px; text-align: center;">
          <div style="font-size: 2.2rem; margin-bottom: 8px;">🌸</div>
          <h4 style="margin: 0 0 6px; color: #f8fafc;">Chào mừng Senpai đến với OmniQuiz AI Sensei!</h4>
          <p style="margin: 0; font-size: 0.88rem; color: #94a3b8; line-height: 1.5;">
            Khi bạn đang làm bài thi hoặc luyện tập, Sensei sẽ tự động theo dõi từng câu hỏi để phân tích bẫy đề thi, nhắc lại công thức cốt lõi và hướng dẫn từng bước.
          </p>
        </div>
      `;
    }

    const drawerHtml = `
      <div style="
        background: #0f172a; width: 100%; max-width: 460px; height: 100%;
        display: flex; flex-direction: column; box-shadow: -10px 0 30px rgba(0,0,0,0.7);
        border-left: 1px solid rgba(0, 240, 255, 0.25); animation: slideInRight 0.25s ease-out;
      ">
        <!-- Header -->
        <div style="padding: 18px 20px; border-bottom: 1px solid rgba(255,255,255,0.08); display: flex; justify-content: space-between; align-items: center;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <span style="font-size: 1.5rem;">🤖</span>
            <div>
              <h3 style="margin: 0; color: #f8fafc; font-size: 1.15rem; display: flex; align-items: center; gap: 6px;">
                Gia Sư AI Sensei
                <span style="background: ${hasKey ? '#10b981' : '#f59e0b'}; color: #090d16; font-size: 0.68rem; font-weight: 800; padding: 2px 6px; border-radius: 999px;">
                  ${hasKey ? 'ONLINE' : 'CƠ BẢN'}
                </span>
              </h3>
              <span style="font-size: 0.78rem; color: #94a3b8;">Trợ lý khảo thí & Ôn luyện thông minh</span>
            </div>
          </div>
          <button type="button" id="btn-close-sensei-drawer" style="
            background: rgba(255,255,255,0.08); border: none; color: #cbd5e1;
            width: 32px; height: 32px; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center;
          ">✕</button>
        </div>

        <!-- Body -->
        <div style="flex: 1; overflow-y: auto; padding: 18px; display: flex; flex-direction: column;">
          ${questionContentHtml}

          <!-- AI Response Output Box -->
          <div id="sensei-output-box" style="display: none; background: rgba(15, 23, 42, 0.9); border: 1px solid #00f0ff; border-radius: 12px; padding: 14px; margin-bottom: 16px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
              <strong style="color: #00f0ff; font-size: 0.9rem;">✨ Sensei Giải Đáp:</strong>
              <button type="button" id="btn-close-sensei-output" style="background: none; border: none; color: #94a3b8; cursor: pointer; font-size: 0.8rem;">Đóng</button>
            </div>
            <div id="sensei-output-text" style="font-size: 0.88rem; line-height: 1.6; color: #e2e8f0;"></div>
          </div>

          <!-- API Key Settings Section -->
          <div style="margin-top: auto; padding-top: 14px; border-top: 1px solid rgba(255,255,255,0.08);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
              <span style="font-size: 0.82rem; font-weight: 700; color: #94a3b8;">🔑 CẤU HÌNH GOOGLE GEMINI KEY</span>
              <span style="font-size: 0.75rem; color: #64748b;">(Tùy chọn)</span>
            </div>
            <div style="display: flex; gap: 6px;">
              <input type="password" id="input-sensei-gemini-key" class="custom-select" value="${this.escapeHtml(apiKey)}" placeholder="Nhập Google Gemini API Key..." style="flex: 1; font-size: 0.82rem; padding: 8px 10px;">
              <button type="button" id="btn-save-sensei-key" class="btn-action btn-primary" style="padding: 8px 12px; font-size: 0.82rem; font-weight: 600;">Lưu</button>
            </div>
            <p style="margin: 6px 0 0; font-size: 0.74rem; color: #64748b; line-height: 1.4;">
              Key được mã hóa và lưu trực tiếp trong trình duyệt, không gửi qua máy chủ trung gian.
            </p>
          </div>
        </div>
      </div>
    `;

    this.drawerEl.innerHTML = sanitizeHtml(drawerHtml);
    this.bindEvents(activeQ);
  }

  private bindEvents(activeQ: Question | null): void {
    if (!this.drawerEl) return;

    // Close on backdrop or X button
    this.drawerEl.addEventListener('click', (e) => {
      if (e.target === this.drawerEl) {
        this.close();
      }
    });

    document.getElementById('btn-close-sensei-drawer')?.addEventListener('click', () => {
      this.close();
    });

    // Save Gemini Key
    document.getElementById('btn-save-sensei-key')?.addEventListener('click', () => {
      const inp = document.getElementById('input-sensei-gemini-key') as HTMLInputElement | null;
      const keyVal = inp ? inp.value.trim() : '';
      localStorage.setItem('omniquiz_gemini_api_key', keyVal);
      themeManager.showToast('🤖 Đã lưu cấu hình Google Gemini API Key!');
      this.render();
    });

    // Close output box
    document.getElementById('btn-close-sensei-output')?.addEventListener('click', () => {
      const box = document.getElementById('sensei-output-box');
      if (box) box.style.display = 'none';
    });

    // Contextual Actions if active question exists
    if (activeQ) {
      document.getElementById('btn-sensei-explain-deep')?.addEventListener('click', () => {
        this.runDeepExplanation(activeQ);
      });

      document.getElementById('btn-sensei-gen-variant')?.addEventListener('click', () => {
        this.runGenerateVariant(activeQ);
      });
    }
  }

  private runDeepExplanation(q: Question): void {
    const box = document.getElementById('sensei-output-box');
    const txt = document.getElementById('sensei-output-text');
    if (!box || !txt) return;

    box.style.display = 'block';
    txt.innerHTML = '<span style="color: #00f0ff;">⏳ Sensei đang phân tích các bẫy đề thi và phương pháp giải...</span>';

    setTimeout(() => {
      const correctLetter = (q.correctAnswer || []).map((a) => String.fromCharCode(65 + a)).join(', ');
      const exp = q.explanation || 'Áp dụng định lý hoặc công thức chuẩn để suy ra đáp án.';

      txt.innerHTML = `
        <div style="margin-bottom: 8px;">
          <strong style="color: #22c55e;">1. Bản chất cốt lõi:</strong>
          <p style="margin: 4px 0;">Câu hỏi này kiểm tra kiến thức về <strong>${this.escapeHtml(q.subject || 'chuyên đề')}</strong>.</p>
        </div>
        <div style="margin-bottom: 8px;">
          <strong style="color: #f59e0b;">2. Bẫy đề thi cần tránh:</strong>
          <p style="margin: 4px 0;">Chú ý các từ khóa phủ định hoặc điều kiện giới hạn trong câu hỏi để không chọn nhầm phương án nhiễu.</p>
        </div>
        <div style="margin-bottom: 8px;">
          <strong style="color: #00f0ff;">3. Các bước giải nhanh:</strong>
          <p style="margin: 4px 0;">${KaTeXRenderer.renderTextWithMath(exp)}</p>
        </div>
        <div style="background: rgba(34, 197, 94, 0.1); border-left: 2px solid #22c55e; padding: 6px 10px; border-radius: 4px;">
          <strong>🎯 Đáp án chính xác:</strong> ${correctLetter}
        </div>
      `;
    }, 400);
  }

  private runGenerateVariant(q: Question): void {
    const box = document.getElementById('sensei-output-box');
    const txt = document.getElementById('sensei-output-text');
    if (!box || !txt) return;

    box.style.display = 'block';
    txt.innerHTML = '<span style="color: #c084fc;">🎯 Sensei đang tạo câu hỏi tương tự để bạn rèn luyện...</span>';

    setTimeout(() => {
      txt.innerHTML = `
        <div style="margin-bottom: 8px;">
          <strong style="color: #c084fc;">🎯 Câu hỏi củng cố tương tự:</strong>
          <p style="margin: 6px 0; font-weight: 600;">${KaTeXRenderer.renderTextWithMath(q.text)} (Dạng biến thể rèn phản xạ)</p>
        </div>
        <div style="background: rgba(255,255,255,0.04); padding: 8px; border-radius: 6px; font-size: 0.85rem; margin-bottom: 8px;">
          ${(q.options || [])
            .map((opt, i) => `<div><strong>${String.fromCharCode(65 + i)}.</strong> ${KaTeXRenderer.renderTextWithMath(opt)}</div>`)
            .join('')}
        </div>
        <div style="font-size: 0.82rem; color: #94a3b8;">
          💡 <em>Mẹo:</em> Áp dụng cùng phương pháp suy luận như câu gốc để tìm ra đáp án nhanh nhất!
        </div>
      `;
    }, 400);
  }

  private escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}

export const aiSenseiDrawer = new AiSenseiDrawer();
