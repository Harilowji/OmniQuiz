/**
 * ai-tutor.js - Smart AI Tutor & OCR Quiz Generator Module
 * Powered by Google Gemini API (gemini-1.5-flash / gemini-2.0-flash)
 * Features:
 * 1. Deep explanation & Cognitive trap analysis on any question
 * 2. Rapid 30-second test-taking heuristics & tips
 * 3. Multi-modal Image-to-Quiz OCR parsing & Question generation
 * 4. KaTeX & Markdown formatted responses
 */
const AITutor = (() => {
    const STORAGE_KEY_API_KEY = 'omniquiz_gemini_api_key';
    const DEFAULT_MODEL = 'gemini-1.5-flash';
    const FALLBACK_MODEL = 'gemini-2.0-flash';

    function getApiKey() {
        return localStorage.getItem(STORAGE_KEY_API_KEY) || '';
    }

    function setApiKey(key) {
        if (!key) {
            localStorage.removeItem(STORAGE_KEY_API_KEY);
        } else {
            localStorage.setItem(STORAGE_KEY_API_KEY, key.trim());
        }
    }

    function hasApiKey() {
        const key = getApiKey();
        return Boolean(key && key.length > 10);
    }

    /**
     * Send structured payload to Google Gemini API
     */
    async function callGemini(contents, model = DEFAULT_MODEL) {
        const apiKey = getApiKey();
        if (!apiKey) {
            throw new Error('MISSING_API_KEY');
        }

        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contents: contents,
                generationConfig: {
                    temperature: 0.4,
                    topP: 0.95,
                    maxOutputTokens: 2048
                }
            })
        });

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            const errMsg = errData.error?.message || `HTTP ${response.status}: ${response.statusText}`;

            // Try fallback model if 1.5-flash is not available
            if (model === DEFAULT_MODEL && (response.status === 404 || errMsg.includes('not found') || errMsg.includes('deprecated'))) {
                console.warn(`[AITutor] ${DEFAULT_MODEL} failed, attempting fallback to ${FALLBACK_MODEL}...`);
                return callGemini(contents, FALLBACK_MODEL);
            }

            throw new Error(errMsg);
        }

        const data = await response.json();
        const candidate = data.candidates?.[0];
        if (!candidate || !candidate.content?.parts?.[0]?.text) {
            throw new Error('Gemini API returned an empty response.');
        }

        return candidate.content.parts[0].text;
    }

    /**
     * Convert markdown text to clean HTML with KaTeX formatting preservation
     */
    function formatAIText(text) {
        if (!text) return '';

        // Escape HTML entities to prevent XSS
        let safe = text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');

        // Markdown Headers: ###, ##, #
        safe = safe.replace(/^### (.*?)$/gm, '<h4 class="ai-h4">$1</h4>');
        safe = safe.replace(/^## (.*?)$/gm, '<h3 class="ai-h3">$1</h3>');
        safe = safe.replace(/^# (.*?)$/gm, '<h2 class="ai-h2">$1</h2>');

        // Bold & Italic
        safe = safe.replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>');
        safe = safe.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        safe = safe.replace(/\*(.*?)\*/g, '<em>$1</em>');

        // Lists
        safe = safe.replace(/^\s*[\-\*]\s+(.*?)$/gm, '<li class="ai-li">$1</li>');
        safe = safe.replace(/(<li.*<\/li>)/s, '<ul class="ai-ul">$1</ul>');

        // Line breaks
        safe = safe.replace(/\n\n/g, '<p class="ai-p"></p>');
        safe = safe.replace(/\n/g, '<br>');

        return safe;
    }

    /**
     * Explain a specific question with cognitive trap analysis & speed tips
     */
    async function explainQuestion(q, selectedIndices = [], correctIndices = []) {
        if (!hasApiKey()) {
            openApiKeySettingsModal('Vui lòng nhập Google Gemini API Key để kích hoạt Gia sư AI (Miễn phí 100%).');
            throw new Error('MISSING_API_KEY');
        }

        const letters = ['A', 'B', 'C', 'D', 'E', 'F'];
        const optionsText = q.options.map((opt, i) => `${letters[i] || i + 1}. ${opt}`).join('\n');

        const userAnsStr = selectedIndices.length > 0 
            ? selectedIndices.map(i => `${letters[i] || i + 1}. ${q.options[i] || ''}`).join(', ')
            : 'Chưa chọn';

        const correctAnsStr = correctIndices.length > 0
            ? correctIndices.map(i => `${letters[i] || i + 1}. ${q.options[i] || ''}`).join(', ')
            : 'Chưa có thông tin';

        const hasUserSelected = selectedIndices.length > 0;
        const isUserCorrect = hasUserSelected && 
            selectedIndices.length === correctIndices.length && 
            selectedIndices.every(i => correctIndices.includes(i));

        const prompt = `
Bạn là Gia sư Luyện thi Trắc nghiệm Thông minh (AI Exam Tutor) của hệ thống OmniQuiz PRO.
Nhiệm vụ của bạn là phân tích và giảng giải chi tiết câu hỏi trắc nghiệm dưới đây cho học sinh:

【ĐỀ BÀI】:
${q.q}

【CÁC PHƯƠNG ÁN LỰA CHỌN】:
${optionsText}

【TRẠNG THÁI BÀI LÀM】:
- Phương án học sinh đã chọn: ${userAnsStr}
- Đáp án chính xác: ${correctAnsStr}
- Lời giải mẫu có sẵn (nếu có): ${q.explanation || 'Chưa có'}

【YÊU CẦU GIẢNG BÀI】:
Hãy trình bày bằng tiếng Việt mạch lạc, cuốn hút, ngắn gọn và sâu sắc theo đúng 3 phần sau:

1. 🎯 **Bản chất kiến thức cốt lõi**:
   - Giải thích phương pháp giải chuẩn mực, công thức toán học hoặc quy luật cần áp dụng (Giữ nguyên định dạng công thức toán $...$ hoặc $$...$$ cho KaTeX).

2. ⚠️ **Vạch trần bẫy tư duy & Phân tích lựa chọn**:
   ${!hasUserSelected 
       ? '- Phân tích tại sao học sinh thường bị lừa ở các phương án nhiễu (distractors).' 
       : isUserCorrect 
           ? '- Khen ngợi học sinh đã nhận ra phương án đúng! Chỉ ra các bẫy tư duy ở các phương án còn lại để củng cố phản xạ.' 
           : `- Chỉ rõ tại sao phương án [${userAnsStr}] học sinh chọn là một bẫy tinh vi của người ra đề, chỉ ra sự ngộ nhận hoặc sai lầm biến đổi phổ biến.`}

3. ⚡ **Mẹo giải nhanh 30 giây (Fast-solve Heuristics)**:
   - Chia sẻ mẹo tư duy loại trừ thần tốc, mẹo bấm máy tính bỏ túi Casio (nếu là môn tự nhiên), dấu hiệu đặc trưng nhận biết ngay đáp án hoặc quy tắc loại suy.

LƯU Ý: Giữ câu trả lời súc tích, dễ hiểu, định dạng rõ ràng bằng Markdown và công thức KaTeX ($...$).
`;

        const contents = [
            {
                role: 'user',
                parts: [{ text: prompt }]
            }
        ];

        return await callGemini(contents);
    }

    /**
     * Parse questions from image using Gemini Multimodal Vision API
     */
    async function generateQuestionsFromImage(base64Data, mimeType = 'image/jpeg') {
        if (!hasApiKey()) {
            openApiKeySettingsModal('Vui lòng nhập Google Gemini API Key để dùng tính năng OCR quét đề thi từ hình ảnh.');
            throw new Error('MISSING_API_KEY');
        }

        // Strip data:image/...;base64, prefix if present
        const cleanBase64 = base64Data.replace(/^data:[^;]+;base64,/, '');

        const prompt = `
Bạn là hệ thống trích xuất đề thi trắc nghiệm thông minh chuyên nghiệp (CBT OCR Engine).
Hãy bóc tách tất cả các câu hỏi trắc nghiệm có trong hình ảnh này thành một mảng JSON chuẩn.

YÊU CẦU ĐỊNH DẠNG ĐẦU RA:
- CHỈ TRẢ VỀ DUY NHẤT một khối JSON hợp lệ nằm trong cặp dấu: \`\`\`json ... \`\`\`
- Cấu trúc từng câu hỏi trong mảng JSON:
[
  {
    "q": "Nội dung câu hỏi (Công thức toán đặt trong $...$ hoặc $$...$$)",
    "options": [
      "Phương án A",
      "Phương án B",
      "Phương án C",
      "Phương án D"
    ],
    "answers": [0], // Mảng chỉ số đáp án đúng: 0 cho A, 1 cho B, 2 cho C, 3 cho D. Nếu trong ảnh đã khoanh/đánh dấu đáp án thì lấy theo đó; nếu không có, hãy giải và tìm đáp án đúng nhất.
    "type": "single", // "single" hoặc "multiple"
    "explanation": "Lời giải ngắn gọn và công thức chứng minh (nếu có)"
  }
]

CHÚ Ý:
- Giữ nguyên công thức toán, lý, hóa dạng KaTeX ($x^2 + y^2$, $\\frac{a}{b}$, $\\int_a^b f(x)dx$).
- Nếu có nhiều câu hỏi trong ảnh, hãy trích xuất toàn bộ lần lượt theo thứ tự.
- Đảm bảo JSON tuyệt đối hợp lệ, không có trailing comma.
`;

        const contents = [
            {
                role: 'user',
                parts: [
                    { text: prompt },
                    {
                        inlineData: {
                            mimeType: mimeType,
                            data: cleanBase64
                        }
                    }
                ]
            }
        ];

        const responseText = await callGemini(contents, 'gemini-1.5-flash');

        // Extract JSON block
        let jsonStr = responseText;
        const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        if (jsonMatch) {
            jsonStr = jsonMatch[1];
        }

        try {
            const parsed = JSON.parse(jsonStr.trim());
            if (!Array.isArray(parsed) || parsed.length === 0) {
                throw new Error('Không tìm thấy câu hỏi trắc nghiệm hợp lệ nào trong ảnh.');
            }
            return parsed;
        } catch (e) {
            console.error('[AITutor] Failed to parse JSON from Gemini:', responseText);
            throw new Error('Không thể chuyển đổi dữ liệu trích xuất từ ảnh thành định dạng câu hỏi chuẩn. Vui lòng chụp ảnh rõ nét hơn!');
        }
    }

    /**
     * Show API Key Modal
     */
    function openApiKeySettingsModal(customNotice = '') {
        let modal = document.getElementById('ai-api-key-modal');
        if (!modal) {
            createApiKeyModal();
            modal = document.getElementById('ai-api-key-modal');
        }

        const noticeEl = document.getElementById('ai-key-notice');
        if (noticeEl) {
            noticeEl.innerText = customNotice || 'Google Gemini API hoàn toàn miễn phí cho mục đích học tập cá nhân.';
        }

        const inputEl = document.getElementById('input-gemini-api-key');
        if (inputEl) {
            inputEl.value = getApiKey();
        }

        modal.style.display = 'flex';
    }

    function closeApiKeySettingsModal() {
        const modal = document.getElementById('ai-api-key-modal');
        if (modal) modal.style.display = 'none';
    }

    function createApiKeyModal() {
        const modalDiv = document.createElement('div');
        modalDiv.className = 'modal-overlay';
        modalDiv.id = 'ai-api-key-modal';
        modalDiv.style.display = 'none';
        modalDiv.style.zIndex = '99999';

        modalDiv.innerHTML = `
            <div class="modal-content ai-modal-card">
                <div class="ai-modal-header">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <span class="ai-modal-robot-icon">🤖</span>
                        <div>
                            <h3 style="margin: 0; color: var(--heading-color); font-size: 1.3em;">Cài Đặt Google Gemini API Key</h3>
                            <div style="font-size: 0.82em; opacity: 0.75;">Kích hoạt Gia sư AI & Trích xuất đề thi từ ảnh OCR</div>
                        </div>
                    </div>
                    <button type="button" class="btn-action btn-history-action btn-del" id="btn-close-ai-key-modal" style="padding: 4px 10px;">✕</button>
                </div>

                <div class="ai-key-notice-box" id="ai-key-notice">
                    Google Gemini API Key hoàn toàn miễn phí cho người dùng cá nhân (15 yêu cầu/phút).
                </div>

                <div style="margin: 16px 0;">
                    <label style="display: block; font-size: 0.88em; font-weight: 700; margin-bottom: 6px;">
                        Gemini API Key:
                    </label>
                    <div style="position: relative;">
                        <input type="password" id="input-gemini-api-key" class="custom-select" 
                            placeholder="Dán AIzaSy..." 
                            style="width: 100%; padding-right: 40px; font-family: monospace; font-size: 0.95em;">
                        <button type="button" id="btn-toggle-key-visibility" 
                            style="position: absolute; right: 8px; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; opacity: 0.6; font-size: 1.1em;">
                            👁️
                        </button>
                    </div>
                </div>

                <div class="ai-guide-box">
                    <strong>💡 Cách lấy API Key miễn phí trong 30 giây:</strong>
                    <ol style="margin: 6px 0 0 18px; padding: 0; font-size: 0.85em; line-height: 1.6;">
                        <li>Truy cập <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" style="color: var(--primary-color); font-weight: 600;">Google AI Studio (aistudio.google.com)</a></li>
                        <li>Đăng nhập bằng tài khoản Google của bạn.</li>
                        <li>Bấm <strong>"Create API key"</strong> &rarr; Sao chép và dán vào ô trên.</li>
                    </ol>
                    <div style="margin-top: 8px; font-size: 0.8em; opacity: 0.8;">
                        🔒 <em>Khóa API của bạn được lưu an toàn 100% trong trình duyệt cục bộ (LocalStorage) và không bao giờ gửi qua máy chủ trung gian.</em>
                    </div>
                </div>

                <div style="display: flex; gap: 10px; margin-top: 20px;">
                    <button type="button" class="btn-action" id="btn-test-ai-key" style="flex: 1; justify-content: center;">
                        ⚡ Kiểm tra kết nối
                    </button>
                    <button type="button" class="btn-action btn-primary" id="btn-save-ai-key" style="flex: 1.2; justify-content: center; font-weight: 700;">
                        💾 Lưu cấu hình
                    </button>
                </div>
                <div id="ai-key-status-msg" style="margin-top: 10px; text-align: center; font-size: 0.85em; font-weight: 600; display: none;"></div>
            </div>
        `;

        document.body.appendChild(modalDiv);

        // Bind events
        document.getElementById('btn-close-ai-key-modal')?.addEventListener('click', closeApiKeySettingsModal);
        
        const inp = document.getElementById('input-gemini-api-key');
        const toggleBtn = document.getElementById('btn-toggle-key-visibility');
        toggleBtn?.addEventListener('click', () => {
            if (inp.type === 'password') {
                inp.type = 'text';
                toggleBtn.innerText = '🔒';
            } else {
                inp.type = 'password';
                toggleBtn.innerText = '👁️';
            }
        });

        document.getElementById('btn-save-ai-key')?.addEventListener('click', () => {
            const val = inp.value.trim();
            setApiKey(val);
            const statusEl = document.getElementById('ai-key-status-msg');
            statusEl.style.display = 'block';
            if (val) {
                statusEl.style.color = '#10b981';
                statusEl.innerText = '✓ Đã lưu API Key thành công!';
                setTimeout(() => {
                    closeApiKeySettingsModal();
                }, 1000);
            } else {
                statusEl.style.color = '#ef4444';
                statusEl.innerText = 'Đã xóa API Key.';
            }
        });

        document.getElementById('btn-test-ai-key')?.addEventListener('click', async () => {
            const val = inp.value.trim();
            if (!val) {
                alert('Vui lòng nhập API key trước khi kiểm tra!');
                return;
            }
            setApiKey(val);
            const statusEl = document.getElementById('ai-key-status-msg');
            statusEl.style.display = 'block';
            statusEl.style.color = '#3b82f6';
            statusEl.innerText = '⏳ Đang kiểm tra kết nối với Gemini API...';

            try {
                const res = await callGemini([{ role: 'user', parts: [{ text: 'Trả lời đúng 1 chữ: OK' }] }]);
                if (res && res.includes('OK')) {
                    statusEl.style.color = '#10b981';
                    statusEl.innerText = '✓ Kết nối thành công! API Key hoạt động hoàn hảo.';
                } else {
                    statusEl.style.color = '#10b981';
                    statusEl.innerText = '✓ Kết nối thành công!';
                }
            } catch (err) {
                statusEl.style.color = '#ef4444';
                statusEl.innerText = `✗ Lỗi kết nối: ${err.message}`;
            }
        });
    }

    /**
     * Modal for Image-to-Quiz OCR scanner
     */
    function openImageOcrModal() {
        if (!hasApiKey()) {
            openApiKeySettingsModal('Vui lòng nhập Google Gemini API Key để dùng tính năng Quét ảnh tạo bài thi trắc nghiệm (OCR).');
            return;
        }

        let modal = document.getElementById('ai-ocr-modal');
        if (!modal) {
            createOcrModal();
            modal = document.getElementById('ai-ocr-modal');
        }
        modal.style.display = 'flex';
    }

    function closeImageOcrModal() {
        const modal = document.getElementById('ai-ocr-modal');
        if (modal) modal.style.display = 'none';
    }

    function createOcrModal() {
        const modalDiv = document.createElement('div');
        modalDiv.className = 'modal-overlay';
        modalDiv.id = 'ai-ocr-modal';
        modalDiv.style.display = 'none';
        modalDiv.style.zIndex = '99998';

        modalDiv.innerHTML = `
            <div class="modal-content ai-modal-card" style="max-width: 580px;">
                <div class="ai-modal-header">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <span class="ai-modal-robot-icon">📸</span>
                        <div>
                            <h3 style="margin: 0; color: var(--heading-color); font-size: 1.3em;">Trích Xuất Đề Thi Từ Ảnh (AI OCR)</h3>
                            <div style="font-size: 0.82em; opacity: 0.75;">Chụp ảnh sách giáo khoa, bài tập hoặc màn hình &rarr; Tự động tạo bài thi CBT</div>
                        </div>
                    </div>
                    <button type="button" class="btn-action btn-history-action btn-del" id="btn-close-ai-ocr-modal" style="padding: 4px 10px;">✕</button>
                </div>

                <div class="ocr-dropzone-box" id="ocr-dropzone">
                    <div id="ocr-dropzone-prompt">
                        <div style="font-size: 2.5em; margin-bottom: 8px;">📷</div>
                        <div style="font-weight: 700; margin-bottom: 4px;">Kéo thả ảnh vào đây hoặc bấm để tải lên</div>
                        <div style="font-size: 0.85em; opacity: 0.75;">Hỗ trợ dán trực tiếp từ Clipboard (Ctrl + V)</div>
                        <label class="btn-action btn-primary" style="margin-top: 12px; cursor: pointer; display: inline-flex;">
                            📁 Chọn ảnh từ thiết bị
                            <input type="file" id="ocr-file-input" accept="image/*" style="display: none;">
                        </label>
                    </div>

                    <div id="ocr-preview-wrap" style="display: none; position: relative;">
                        <img id="ocr-preview-img" style="max-width: 100%; max-height: 260px; border-radius: 12px; object-fit: contain; box-shadow: 0 4px 12px rgba(0,0,0,0.15);">
                        <button type="button" class="btn-action btn-danger" id="btn-ocr-remove-img" style="position: absolute; top: 8px; right: 8px; padding: 4px 8px; font-size: 0.8em;">✕ Đổi ảnh khác</button>
                    </div>
                </div>

                <div id="ocr-loading-state" style="display: none; text-align: center; padding: 20px 0;">
                    <div class="loading-spinner-ring" style="margin: 0 auto 12px;"></div>
                    <div style="font-weight: 700; color: var(--heading-color);">🤖 AI đang đọc đề bài & giải toán...</div>
                    <div style="font-size: 0.85em; opacity: 0.75; margin-top: 4px;">Trích xuất văn bản, công thức KaTeX và phương án trắc nghiệm...</div>
                </div>

                <div style="display: flex; gap: 10px; margin-top: 16px;">
                    <button type="button" class="btn-action" id="btn-ocr-cancel" style="flex: 1; justify-content: center;">Hủy bỏ</button>
                    <button type="button" class="btn-action btn-primary" id="btn-ocr-start-parse" style="flex: 1.5; justify-content: center; font-weight: 700;" disabled>
                        🚀 Trích xuất & Bắt đầu làm bài
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(modalDiv);

        let selectedBase64 = null;
        let selectedMime = 'image/jpeg';

        const fileInp = document.getElementById('ocr-file-input');
        const previewWrap = document.getElementById('ocr-preview-wrap');
        const previewImg = document.getElementById('ocr-preview-img');
        const promptWrap = document.getElementById('ocr-dropzone-prompt');
        const startBtn = document.getElementById('btn-ocr-start-parse');
        const dropzone = document.getElementById('ocr-dropzone');
        const loadingState = document.getElementById('ocr-loading-state');

        function handleImageFile(file) {
            if (!file || !file.type.startsWith('image/')) {
                alert('Vui lòng chọn một file ảnh hợp lệ (PNG, JPG, WEBP)!');
                return;
            }
            selectedMime = file.type;
            const reader = new FileReader();
            reader.onload = (e) => {
                selectedBase64 = e.target.result;
                previewImg.src = selectedBase64;
                promptWrap.style.display = 'none';
                previewWrap.style.display = 'block';
                startBtn.disabled = false;
            };
            reader.readAsDataURL(file);
        }

        fileInp?.addEventListener('change', (e) => {
            if (e.target.files?.[0]) handleImageFile(e.target.files[0]);
        });

        // Paste clipboard support
        window.addEventListener('paste', (e) => {
            const modal = document.getElementById('ai-ocr-modal');
            if (modal && modal.style.display === 'flex') {
                const items = (e.clipboardData || e.originalEvent.clipboardData).items;
                for (const item of items) {
                    if (item.kind === 'file' && item.type.startsWith('image/')) {
                        handleImageFile(item.getAsFile());
                        break;
                    }
                }
            }
        });

        document.getElementById('btn-ocr-remove-img')?.addEventListener('click', () => {
            selectedBase64 = null;
            previewImg.src = '';
            previewWrap.style.display = 'none';
            promptWrap.style.display = 'block';
            startBtn.disabled = true;
            fileInp.value = '';
        });

        document.getElementById('btn-close-ai-ocr-modal')?.addEventListener('click', closeImageOcrModal);
        document.getElementById('btn-ocr-cancel')?.addEventListener('click', closeImageOcrModal);

        startBtn?.addEventListener('click', async () => {
            if (!selectedBase64) return;
            startBtn.disabled = true;
            loadingState.style.display = 'block';

            try {
                const questions = await generateQuestionsFromImage(selectedBase64, selectedMime);
                if (questions && questions.length > 0) {
                    closeImageOcrModal();
                    if (typeof window.onQuestionsLoadedFromAI === 'function') {
                        window.onQuestionsLoadedFromAI(questions);
                    }
                }
            } catch (err) {
                alert(`Lỗi khi trích xuất đề thi: ${err.message}`);
            } finally {
                loadingState.style.display = 'none';
                startBtn.disabled = false;
            }
        });
    }

    /**
     * Ask AI Tutor for a specific question and render formatted explanation inside question block
     */
    async function askTutorForQuestion(qIndex, q, selectedIndices, correctIndices, targetContainer) {
        if (!targetContainer) return;

        // Toggle existing box if open
        const existingBox = targetContainer.querySelector('.ai-tutor-response-box');
        if (existingBox) {
            existingBox.remove();
            return;
        }

        if (!hasApiKey()) {
            openApiKeySettingsModal('Vui lòng nhập Google Gemini API Key để kích hoạt Gia sư AI giải thích câu hỏi.');
            return;
        }

        const box = document.createElement('div');
        box.className = 'ai-tutor-response-box';
        box.innerHTML = `
            <div class="ai-tutor-box-header">
                <div style="display: flex; align-items: center; gap: 8px;">
                    <span class="ai-pulsing-robot">🤖</span>
                    <strong>Gia Sư AI (Gemini Flash)</strong>
                    <span class="ai-tag-pacing">⚡ Phân tích bẫy tư duy & Mẹo giải nhanh</span>
                </div>
                <button type="button" class="ai-close-box-btn" title="Đóng giải thích">✕</button>
            </div>
            <div class="ai-tutor-box-body">
                <div class="ai-loading-skeleton">
                    <div class="ai-skeleton-line" style="width: 70%;"></div>
                    <div class="ai-skeleton-line" style="width: 90%;"></div>
                    <div class="ai-skeleton-line" style="width: 60%;"></div>
                </div>
            </div>
        `;

        targetContainer.appendChild(box);

        box.querySelector('.ai-close-box-btn').onclick = () => box.remove();

        try {
            const explanation = await explainQuestion(q, selectedIndices, correctIndices);
            const bodyEl = box.querySelector('.ai-tutor-box-body');
            bodyEl.innerHTML = formatAIText(explanation);

            // Re-render KaTeX inside the AI box
            if (typeof renderMathInElement === 'function') {
                renderMathInElement(bodyEl, {
                    delimiters: [
                        { left: '$$', right: '$$', display: true },
                        { left: '$', right: '$', display: false },
                        { left: '\\(', right: '\\)', display: false },
                        { left: '\\[', right: '\\]', display: true }
                    ],
                    throwOnError: false
                });
            }
        } catch (err) {
            const bodyEl = box.querySelector('.ai-tutor-box-body');
            if (err.message === 'MISSING_API_KEY') {
                bodyEl.innerHTML = '<div style="color: #ef4444;">Chưa cấu hình API Key. Vui lòng bấm vào ⚙️ Tiện ích > Cài đặt Gemini API Key để thiết lập.</div>';
            } else {
                bodyEl.innerHTML = `<div style="color: #ef4444;">Không thể kết nối với Gia sư AI: ${err.message}</div>`;
            }
        }
    }

    return {
        getApiKey,
        setApiKey,
        hasApiKey,
        openApiKeySettingsModal,
        closeApiKeySettingsModal,
        openImageOcrModal,
        closeImageOcrModal,
        explainQuestion,
        generateQuestionsFromImage,
        askTutorForQuestion
    };
})();

// Export for global usage
if (typeof window !== 'undefined') {
    window.AITutor = AITutor;
}
