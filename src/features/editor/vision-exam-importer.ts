/**
 * src/features/editor/vision-exam-importer.ts
 * AI Vision OCR & Smart Topic Question Generator for OmniQuiz PRO
 * Powers image-to-exam conversion via Google Gemini 2.5 Flash and instant topic-based exam drafting
 */

import { Question } from '../../shared/types';
import { animeMascot } from '../mascot/anime-mascot';
import { soundEngine } from '../../shared/audio/sound-engine';

const API_KEY_STORAGE = 'omniquiz_gemini_api_key';

export class VisionExamImporter {
  constructor() {}

  public getSavedApiKey(): string {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        return window.localStorage.getItem(API_KEY_STORAGE) || '';
      }
    } catch {
      // Fallback
    }
    return '';
  }

  public saveApiKey(key: string): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(API_KEY_STORAGE, key.trim());
      }
    } catch {
      // Fallback
    }
  }

  /**
   * Resizes an image file to max 1600px width/height and compresses to JPEG Base64
   */
  public async compressImage(
    file: File | Blob,
    maxDimension: number = 1600
  ): Promise<{ base64: string; mimeType: string }> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          let width = img.width;
          let height = img.height;

          if (width > maxDimension || height > maxDimension) {
            if (width > height) {
              height = Math.round((height * maxDimension) / width);
              width = maxDimension;
            } else {
              width = Math.round((width * maxDimension) / height);
              height = maxDimension;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Cannot get canvas 2d context for image compression'));
            return;
          }

          ctx.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
          const base64 = dataUrl.split(',')[1] || '';
          resolve({ base64, mimeType: 'image/jpeg' });
        };
        img.onerror = () => reject(new Error('Failed to load image for compression'));
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(new Error('Failed to read file buffer'));
      reader.readAsDataURL(file);
    });
  }

  /**
   * Calls Gemini 2.5 Flash with image inline data to extract exam questions
   */
  public async processExamImages(
    files: File[],
    customApiKey?: string
  ): Promise<Question[]> {
    const apiKey = (customApiKey || this.getSavedApiKey()).trim();
    if (!apiKey) {
      throw new Error('Chưa có Google Gemini API Key. Vui lòng nhập API Key để tiếp tục.');
    }

    const allQuestions: Question[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file) continue;
      const { base64, mimeType } = await this.compressImage(file);

      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

      const prompt = `
Bạn là chuyên gia chuyển đổi và trích xuất đề thi học thuật tiếng Việt hàng đầu.
Hãy phân tích hình ảnh đề thi chụp và trích xuất toàn bộ câu hỏi trắc nghiệm có trong ảnh.

QUY TẮC BẮT BUỘC:
1. Tất cả công thức Toán học, Vật lý, Hóa học phải được giữ nguyên hoặc chuyển đổi sang chuẩn KaTeX đặt trong cặp dấu $...$ (ví dụ: $y = x^3 - 3x$, $\\int_0^1 x^2 dx$, $\\vec{v}$, $C_nH_{2n+2}$).
2. Trích xuất đúng tất cả các lựa chọn A, B, C, D (loại bỏ tiền tố A., B., C., D. ở đầu mỗi chuỗi options hoặc giữ gọn gàng).
3. Xác định đáp án đúng (chỉ số mảng: 0 cho A, 1 cho B, 2 cho C, 3 cho D). Nếu ảnh có khoanh sẵn hãy lấy theo đó, nếu không có hãy giải câu hỏi để xác định đáp án đúng nhất.
4. Cung cấp lời giải chi tiết, rõ ràng trong trường 'explanation'.
5. Trả về DUY NHẤT một mảng JSON thuần túy theo schema:
[
  {
    "text": "Câu hỏi...",
    "options": ["Lựa chọn A", "Lựa chọn B", "Lựa chọn C", "Lựa chọn D"],
    "correctAnswer": [0],
    "explanation": "Lời giải chi tiết...",
    "subject": "Toán"
  }
]
Không được thêm bất kỳ văn bản chào hỏi hay giải thích nào ngoài khối JSON.
`;

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  inlineData: {
                    mimeType,
                    data: base64,
                  },
                },
                {
                  text: prompt,
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 8192,
          },
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Lỗi gọi Gemini API (${response.status}): ${errText}`);
      }

      const result = await response.json();
      const textResponse =
        result?.candidates?.[0]?.content?.parts?.[0]?.text || '';

      const parsedQuestions = this.cleanAndParseJsonResponse(textResponse);
      parsedQuestions.forEach((q, idx) => {
        allQuestions.push({
          id: `vision_${Date.now()}_${i}_${idx}`,
          index: allQuestions.length + 1,
          text: q.text || `Câu hỏi ${allQuestions.length + 1}`,
          type: 'single',
          options:
            Array.isArray(q.options) && q.options.length >= 2
              ? q.options.map(String)
              : ['Phương án A', 'Phương án B', 'Phương án C', 'Phương án D'],
          correctAnswer:
            Array.isArray(q.correctAnswer) && q.correctAnswer.length > 0
              ? q.correctAnswer.map(Number)
              : [0],
          explanation: q.explanation || 'Lời giải chi tiết tự động từ AI Sensei.',
          subject: q.subject || 'Đề thi tổng hợp',
        });
      });
    }

    return allQuestions;
  }

  /**
   * Generates a brand-new structured exam based on subject topic, question count and difficulty
   */
  public async generateExamByTopic(
    topic: string,
    count: number = 10,
    difficulty: string = 'Vận dụng',
    customApiKey?: string
  ): Promise<Question[]> {
    const apiKey = (customApiKey || this.getSavedApiKey()).trim();
    if (!apiKey) {
      throw new Error('Chưa có Google Gemini API Key. Vui lòng nhập API Key để tiếp tục.');
    }

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

    const prompt = `
Bạn là giáo viên biên soạn đề thi chuyên nghiệp theo chuẩn Bộ Giáo Dục.
Hãy soạn một bộ đề thi trắc nghiệm gồm chính xác ${count} câu hỏi trắc nghiệm 4 lựa chọn (A, B, C, D) theo thông tin sau:
- Chủ đề: "${topic}"
- Mức độ nhận thức: "${difficulty}"

QUY TẮC BIÊN SOẠN BẮT BUỘC:
1. Tất cả các ký hiệu toán học, lý học, hóa học phải đặt chuẩn trong cặp KaTeX $ ... $ (ví dụ $f'(x) = 0$, $\\lim_{x \\to 0} \\frac{\\sin x}{x} = 1$).
2. Mỗi câu phải có đúng 4 phương án độc lập và hợp lý (A, B, C, D).
3. correctAnswer là mảng 1 phần tử chỉ số [0] = A, [1] = B, [2] = C, [3] = D.
4. Cung cấp lời giải chi tiết, rõ ràng từng bước trong 'explanation'.
5. Trả về DUY NHẤT một mảng JSON thuần theo schema:
[
  {
    "text": "Nội dung câu hỏi...",
    "options": ["Lựa chọn A", "Lựa chọn B", "Lựa chọn C", "Lựa chọn D"],
    "correctAnswer": [0],
    "explanation": "Lời giải từng bước...",
    "subject": "${topic}"
  }
]
Không được thêm bất kỳ văn bản chào hỏi hay Markdown nào ngoài khối JSON.
`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          temperature: 0.4,
          maxOutputTokens: 8192,
        },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Lỗi gọi Gemini API (${response.status}): ${errText}`);
    }

    const result = await response.json();
    const textResponse =
      result?.candidates?.[0]?.content?.parts?.[0]?.text || '';

    const parsedQuestions = this.cleanAndParseJsonResponse(textResponse);
    return parsedQuestions.map((q, idx) => ({
      id: `ai_topic_${Date.now()}_${idx}`,
      index: idx + 1,
      text: q.text || `Câu hỏi ${idx + 1}`,
      type: 'single',
      options:
        Array.isArray(q.options) && q.options.length >= 2
          ? q.options.map(String)
          : ['Phương án A', 'Phương án B', 'Phương án C', 'Phương án D'],
      correctAnswer:
        Array.isArray(q.correctAnswer) && q.correctAnswer.length > 0
          ? q.correctAnswer.map(Number)
          : [0],
      explanation: q.explanation || 'Lời giải chi tiết tự động từ AI Sensei.',
      subject: topic,
    }));
  }

  /**
   * Strips markdown fences and parses JSON safely
   */
  public cleanAndParseJsonResponse(rawText: string): Array<{
    text: string;
    options: string[];
    correctAnswer: number[];
    explanation?: string;
    subject?: string;
  }> {
    let clean = rawText.trim();
    if (clean.startsWith('```json')) {
      clean = clean.substring(7);
    } else if (clean.startsWith('```')) {
      clean = clean.substring(3);
    }
    if (clean.endsWith('```')) {
      clean = clean.substring(0, clean.length - 3);
    }
    clean = clean.trim();

    // Find the first [ and last ]
    const firstBracket = clean.indexOf('[');
    const lastBracket = clean.lastIndexOf(']');
    if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
      clean = clean.substring(firstBracket, lastBracket + 1);
    }

    try {
      const parsed = JSON.parse(clean);
      if (Array.isArray(parsed)) return parsed;
      return [];
    } catch (e) {
      console.warn('[VisionExamImporter] JSON parse error, attempting regex extraction:', e);
      return [];
    }
  }

  /**
   * Opens UI Modal for Camera / Image Upload OCR
   */
  public openVisionModal(onQuestionsLoaded: (questions: Question[]) => void): void {
    let modal = document.getElementById('vision-ocr-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'vision-ocr-modal';
      modal.className = 'modal-overlay';
      modal.style.zIndex = '99997';
      document.body.appendChild(modal);
    }

    const savedKey = this.getSavedApiKey();

    modal.innerHTML = `
      <div class="modal-content vision-modal-card">
        <div class="vision-modal-header">
          <div class="vision-modal-title-group">
            <span class="vision-modal-icon">📸</span>
            <div>
              <h2 class="vision-modal-title">Quét Đề Thi Bằng AI Vision</h2>
              <p class="vision-modal-subtitle">Chụp ảnh đề giấy hoặc dán ảnh (Ctrl+V) để AI Sensei trích xuất câu hỏi và KaTeX</p>
            </div>
          </div>
          <button type="button" class="btn-action btn-del" id="btn-close-vision-modal">✕</button>
        </div>

        <div class="vision-modal-body">
          <div class="vision-api-key-box">
            <label for="input-vision-gemini-key">🔑 Google Gemini API Key:</label>
            <div style="display: flex; gap: 8px; margin-top: 4px;">
              <input type="password" id="input-vision-gemini-key" class="custom-select" value="${savedKey}" placeholder="Nhập API Key để kích hoạt AI Vision..." style="flex: 1; padding: 8px 12px; font-size: 0.88rem;">
              <button type="button" id="btn-save-vision-key" class="btn-action btn-primary" style="padding: 8px 14px; font-weight: 600;">Lưu Key</button>
            </div>
            <small style="color: var(--text-muted); display: block; margin-top: 4px;">
              Key được lưu bảo mật trong trình duyệt của bạn (Local Storage) và dùng trực tiếp với Google Gemini.
            </small>
          </div>

          <div class="vision-dropzone" id="vision-dropzone">
            <span class="vision-drop-icon">📷</span>
            <div class="vision-drop-text">Kéo thả ảnh chụp đề thi vào đây, hoặc nhấn <strong>Ctrl+V</strong> để dán ảnh</div>
            <div class="vision-actions-row">
              <label class="btn-action btn-primary" style="cursor: pointer;">
                📁 Chọn ảnh từ máy
                <input type="file" id="input-vision-file" accept="image/*" multiple style="display: none;">
              </label>
              <label class="btn-action" style="cursor: pointer;">
                📸 Chụp từ Camera
                <input type="file" id="input-vision-camera" accept="image/*" capture="environment" style="display: none;">
              </label>
            </div>
            <div id="vision-file-preview-list" class="vision-preview-grid"></div>
          </div>

          <div id="vision-status-box" class="vision-status-box" style="display: none;">
            <div class="vision-spinner"></div>
            <span id="vision-status-text">Đang nhận diện đề thi...</span>
          </div>
        </div>

        <div class="vision-modal-footer">
          <button type="button" class="btn-action" id="btn-cancel-vision">Hủy bỏ</button>
          <button type="button" class="btn-action btn-primary" id="btn-start-vision-ocr" disabled>
            🚀 Bắt đầu Quét với AI Vision
          </button>
        </div>
      </div>
    `;

    modal.style.display = 'flex';

    const selectedFiles: File[] = [];
    const previewList = modal.querySelector('#vision-file-preview-list') as HTMLElement;
    const startBtn = modal.querySelector('#btn-start-vision-ocr') as HTMLButtonElement;
    const statusBox = modal.querySelector('#vision-status-box') as HTMLElement;
    const statusText = modal.querySelector('#vision-status-text') as HTMLElement;

    const updatePreview = () => {
      previewList.innerHTML = '';
      selectedFiles.forEach((f, i) => {
        const item = document.createElement('div');
        item.className = 'vision-preview-item';
        item.innerHTML = `
          <span>📄 ${f.name} (${Math.round(f.size / 1024)} KB)</span>
          <button type="button" class="btn-remove-preview" data-idx="${i}">✕</button>
        `;
        previewList.appendChild(item);
      });
      startBtn.disabled = selectedFiles.length === 0;

      previewList.querySelectorAll('.btn-remove-preview').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const idx = parseInt(btn.getAttribute('data-idx') || '0', 10);
          selectedFiles.splice(idx, 1);
          updatePreview();
        });
      });
    };

    const handleFiles = (files: FileList | null) => {
      if (!files) return;
      for (let i = 0; i < files.length; i++) {
        const item = files[i];
        if (item && item.type.startsWith('image/')) {
          selectedFiles.push(item);
        }
      }
      updatePreview();
    };

    modal.querySelector('#input-vision-file')?.addEventListener('change', (e) => {
      handleFiles((e.target as HTMLInputElement).files);
    });

    modal.querySelector('#input-vision-camera')?.addEventListener('change', (e) => {
      handleFiles((e.target as HTMLInputElement).files);
    });

    // Paste handler for Ctrl+V
    const onPaste = (e: ClipboardEvent) => {
      if (!modal || modal.style.display === 'none') return;
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item && item.type.startsWith('image/')) {
          const blob = item.getAsFile();
          if (blob) {
            const pasteFile = new File([blob], `pasted_exam_${Date.now()}.png`, {
              type: blob.type,
            });
            selectedFiles.push(pasteFile);
            updatePreview();
          }
        }
      }
    };
    window.addEventListener('paste', onPaste);

    modal.querySelector('#btn-save-vision-key')?.addEventListener('click', () => {
      const inp = modal?.querySelector('#input-vision-gemini-key') as HTMLInputElement | null;
      if (inp) {
        this.saveApiKey(inp.value);
        animeMascot.speak('Đã lưu Google Gemini API Key thành công! ✨', 3000, 'happy');
      }
    });

    const closeModal = () => {
      if (modal) modal.style.display = 'none';
      window.removeEventListener('paste', onPaste);
    };

    modal.querySelector('#btn-close-vision-modal')?.addEventListener('click', closeModal);
    modal.querySelector('#btn-cancel-vision')?.addEventListener('click', closeModal);

    startBtn.addEventListener('click', async () => {
      const keyInp = modal?.querySelector('#input-vision-gemini-key') as HTMLInputElement | null;
      const key = keyInp?.value.trim() || this.getSavedApiKey();
      if (!key) {
        alert('Vui lòng nhập Google Gemini API Key để thực hiện trích xuất AI Vision.');
        keyInp?.focus();
        return;
      }

      this.saveApiKey(key);
      startBtn.disabled = true;
      statusBox.style.display = 'flex';
      statusText.textContent = `AI Sensei đang đọc và bóc tách ${selectedFiles.length} trang ảnh đề thi...`;

      try {
        const questions = await this.processExamImages(selectedFiles, key);
        if (questions.length === 0) {
          alert('Không tìm thấy câu hỏi trắc nghiệm nào trong ảnh. Vui lòng thử ảnh chụp rõ nét hơn.');
          return;
        }

        soundEngine.playCorrect();
        animeMascot.speak(`🎉 Đã quét thành công ${questions.length} câu hỏi từ ảnh chụp!`, 4000, 'happy');
        closeModal();
        onQuestionsLoaded(questions);
      } catch (err: unknown) {
        console.error('[VisionExamImporter]', err);
        const msg = err instanceof Error ? err.message : String(err);
        alert(`Không thể trích xuất đề thi: ${msg}`);
      } finally {
        statusBox.style.display = 'none';
        startBtn.disabled = selectedFiles.length === 0;
      }
    });
  }

  /**
   * Opens UI Modal for Topic-based AI exam drafting
   */
  public openTopicGeneratorModal(onQuestionsLoaded: (questions: Question[]) => void): void {
    let modal = document.getElementById('ai-topic-generator-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'ai-topic-generator-modal';
      modal.className = 'modal-overlay';
      modal.style.zIndex = '99997';
      document.body.appendChild(modal);
    }

    const savedKey = this.getSavedApiKey();

    modal.innerHTML = `
      <div class="modal-content topic-gen-modal-card">
        <div class="vision-modal-header">
          <div class="vision-modal-title-group">
            <span class="vision-modal-icon">✨</span>
            <div>
              <h2 class="vision-modal-title">Nhờ AI Sensei Tự Soạn Đề Mới</h2>
              <p class="vision-modal-subtitle">Nhập chủ đề kiến thức bất kỳ, AI Sensei sẽ sinh trọn bộ đề chuẩn KaTeX</p>
            </div>
          </div>
          <button type="button" class="btn-action btn-del" id="btn-close-topic-modal">✕</button>
        </div>

        <div class="vision-modal-body">
          <div class="form-group" style="margin-bottom: 14px;">
            <label style="font-weight: 600; font-size: 0.9rem;">📚 Chủ đề hoặc bài học cần soạn:</label>
            <input type="text" id="input-topic-title" class="custom-select" placeholder="Ví dụ: Đạo hàm và Cực trị hàm số Toán 12, Từ vựng IELTS chủ đề Môi trường..." style="width: 100%; margin-top: 6px; padding: 10px 14px; font-size: 0.92rem;">
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 14px;">
            <div class="form-group">
              <label style="font-weight: 600; font-size: 0.9rem;">🔢 Số lượng câu hỏi:</label>
              <select id="select-topic-count" class="custom-select" style="width: 100%; margin-top: 6px; padding: 9px 12px;">
                <option value="5">5 câu (Đề nhanh 10 phút)</option>
                <option value="10" selected>10 câu (Đề tiêu chuẩn)</option>
                <option value="15">15 câu (Đề kiểm tra 1 tiết)</option>
                <option value="20">20 câu (Đề thi thử học kỳ)</option>
              </select>
            </div>
            <div class="form-group">
              <label style="font-weight: 600; font-size: 0.9rem;">🎯 Mức độ nhận thức:</label>
              <select id="select-topic-difficulty" class="custom-select" style="width: 100%; margin-top: 6px; padding: 9px 12px;">
                <option value="Nhận biết - Thông hiểu">Cơ bản (Nhận biết & Thông hiểu)</option>
                <option value="Thông hiểu - Vận dụng" selected>Tiêu chuẩn (Thông hiểu & Vận dụng)</option>
                <option value="Vận dụng cao">Nâng cao (Vận dụng cao 9+)</option>
              </select>
            </div>
          </div>

          <div class="vision-api-key-box">
            <label for="input-topic-gemini-key">🔑 Google Gemini API Key:</label>
            <input type="password" id="input-topic-gemini-key" class="custom-select" value="${savedKey}" placeholder="Nhập Gemini API Key..." style="width: 100%; margin-top: 4px; padding: 8px 12px; font-size: 0.88rem;">
          </div>

          <div id="topic-status-box" class="vision-status-box" style="display: none; margin-top: 12px;">
            <div class="vision-spinner"></div>
            <span id="topic-status-text">AI Sensei đang biên soạn câu hỏi...</span>
          </div>
        </div>

        <div class="vision-modal-footer">
          <button type="button" class="btn-action" id="btn-cancel-topic">Hủy bỏ</button>
          <button type="button" class="btn-action btn-primary" id="btn-start-topic-gen">
            ✨ Tạo Đề Thi Với AI Sensei
          </button>
        </div>
      </div>
    `;

    modal.style.display = 'flex';

    const closeModal = () => {
      if (modal) modal.style.display = 'none';
    };

    modal.querySelector('#btn-close-topic-modal')?.addEventListener('click', closeModal);
    modal.querySelector('#btn-cancel-topic')?.addEventListener('click', closeModal);

    const startBtn = modal.querySelector('#btn-start-topic-gen') as HTMLButtonElement;
    const statusBox = modal.querySelector('#topic-status-box') as HTMLElement;
    const statusText = modal.querySelector('#topic-status-text') as HTMLElement;

    startBtn.addEventListener('click', async () => {
      const topicInp = modal?.querySelector('#input-topic-title') as HTMLInputElement;
      const countSelect = modal?.querySelector('#select-topic-count') as HTMLSelectElement;
      const diffSelect = modal?.querySelector('#select-topic-difficulty') as HTMLSelectElement;
      const keyInp = modal?.querySelector('#input-topic-gemini-key') as HTMLInputElement;

      const topic = topicInp?.value.trim();
      if (!topic) {
        alert('Vui lòng nhập chủ đề bài học cần tạo.');
        topicInp?.focus();
        return;
      }

      const key = keyInp?.value.trim() || this.getSavedApiKey();
      if (!key) {
        alert('Vui lòng nhập Google Gemini API Key để AI Sensei có thể tạo đề thi.');
        keyInp?.focus();
        return;
      }

      this.saveApiKey(key);
      const count = parseInt(countSelect.value || '10', 10);
      const difficulty = diffSelect.value;

      startBtn.disabled = true;
      statusBox.style.display = 'flex';
      statusText.textContent = `Sensei đang biên soạn ${count} câu hỏi chủ đề "${topic}"...`;

      try {
        const questions = await this.generateExamByTopic(topic, count, difficulty, key);
        if (questions.length === 0) {
          alert('Không thể tạo được câu hỏi. Vui lòng kiểm tra lại chủ đề hoặc thử lại.');
          return;
        }

        soundEngine.playCorrect();
        animeMascot.speak(`🎉 AI Sensei đã soạn xong ${questions.length} câu hỏi chất lượng cao!`, 4000, 'happy');
        closeModal();
        onQuestionsLoaded(questions);
      } catch (err: unknown) {
        console.error('[VisionExamImporter]', err);
        const msg = err instanceof Error ? err.message : String(err);
        alert(`Lỗi khi tạo đề: ${msg}`);
      } finally {
        statusBox.style.display = 'none';
        startBtn.disabled = false;
      }
    });
  }
}

export const visionExamImporter = new VisionExamImporter();
