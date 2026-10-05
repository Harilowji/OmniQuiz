/**
 * editor.js - Question Studio & Interactive Exam Editor Module
 * Phase 3 EdTech Studio & Azota-Like Interactive Answer Matrix
 * 
 * Features:
 * - Azota-like 0ms Answer Matrix Grid (one-click instant key selection)
 * - Quick Key String Importer (1A 2B 3C..., 1.A 2.B..., ABCD...)
 * - AI Auto-Solve & Auto-Fill for unanswered questions (via Gemini)
 * - Raw Document Text Viewer & Live Re-parser
 * - Full Question Detailed Editor with Live KaTeX & Chemistry Preview
 * - Full JSON/TXT import & export
 */

const QuestionStudio = (() => {
    let currentQuestions = [];
    let activeQuestionIndex = 0;
    let onApplyCallback = null;
    let currentRawSource = '';
    let currentCustomImages = {};
    let currentViewMode = 'matrix'; // 'matrix' | 'detail' | 'source'
    let currentMatrixFilter = 'all'; // 'all' | 'unanswered' | 'answered'

    /**
     * Open Question Studio with a given list of questions
     */
    function open(questions, onApply, options = {}) {
        if (!Array.isArray(questions) || questions.length === 0) {
            currentQuestions = [createBlankQuestion(1)];
        } else {
            // Deep clone questions to prevent mutating active state until Applied
            currentQuestions = JSON.parse(JSON.stringify(questions));
        }

        activeQuestionIndex = 0;
        onApplyCallback = onApply;
        currentRawSource = options.rawText || '';
        currentCustomImages = options.customImages || {};

        const modal = document.getElementById('question-studio-modal');
        if (!modal) return;

        modal.style.display = 'flex';

        // Check unanswered questions
        const unansweredCount = countUnanswered();
        const needsReview = options.autoOpened || unansweredCount > 0;

        // Default to Azota matrix view
        switchView('matrix');

        if (needsReview && unansweredCount > 0) {
            showReviewBanner(unansweredCount, currentQuestions.length);
        } else {
            hideReviewBanner();
        }

        updateHeaderStats();
        renderAnswerMatrix();
        renderQuestionList();
        loadQuestionDetail(activeQuestionIndex);
        updateSourceView();
    }

    /**
     * Close Question Studio without applying changes
     */
    function close() {
        const modal = document.getElementById('question-studio-modal');
        if (modal) modal.style.display = 'none';
        closeQuickKeyModal();
    }

    /**
     * Count how many questions are missing answers
     */
    function countUnanswered() {
        return currentQuestions.filter(q => q.isDefaultAnswer || !q.answers || q.answers.length === 0).length;
    }

    /**
     * Update Studio Header Statistics and Status Badge
     */
    function updateHeaderStats() {
        const total = currentQuestions.length;
        const unanswered = countUnanswered();
        const answered = total - unanswered;
        const completeness = total > 0 ? Math.round((answered / total) * 100) : 0;

        const countEl = document.getElementById('studio-total-count');
        if (countEl) countEl.innerText = `${total} câu hỏi`;

        const badgeEl = document.getElementById('studio-status-badge');
        if (badgeEl) {
            if (unanswered === 0) {
                badgeEl.className = 'studio-health-badge status-ok';
                badgeEl.innerText = `✓ 100% Đầy đủ đáp án`;
            } else {
                badgeEl.className = 'studio-health-badge status-warn';
                badgeEl.innerText = `⚠️ Còn ${unanswered} câu chưa có đáp án`;
            }
        }

        const compText = document.getElementById('studio-completeness-text');
        if (compText) {
            compText.innerText = `Độ hoàn thiện: ${completeness}% (${answered}/${total} câu)`;
            compText.style.color = unanswered === 0 ? '#10b981' : '#f59e0b';
        }

        const tabMatrixCount = document.getElementById('badge-matrix-count');
        if (tabMatrixCount) {
            tabMatrixCount.innerText = `${answered}/${total}`;
        }

        // Filter numbers
        const fAll = document.getElementById('azota-filter-all-count');
        const fUn = document.getElementById('azota-filter-unanswered-count');
        const fAns = document.getElementById('azota-filter-answered-count');
        if (fAll) fAll.innerText = String(total);
        if (fUn) fUn.innerText = String(unanswered);
        if (fAns) fAns.innerText = String(answered);
    }

    /**
     * Show / Hide the Review Banner
     */
    function showReviewBanner(unanswered, total) {
        const banner = document.getElementById('studio-review-banner');
        if (!banner) return;
        banner.style.display = 'flex';
        const titleEl = document.getElementById('studio-review-title');
        const descEl = document.getElementById('studio-review-desc');
        if (titleEl) {
            titleEl.innerText = `Phát hiện ${unanswered}/${total} câu hỏi chưa có đáp án trong tài liệu!`;
        }
        if (descEl) {
            descEl.innerText = `Vui lòng click chọn đáp án trong bảng ma trận Azota bên dưới, hoặc dùng "Nhập nhanh đáp án" / "AI Tự điền" để hoàn tất bộ đề trước khi luyện tập.`;
        }
    }

    function hideReviewBanner() {
        const banner = document.getElementById('studio-review-banner');
        if (banner) banner.style.display = 'none';
    }

    /**
     * Switch View Tabs: 'matrix' | 'detail' | 'source'
     */
    function switchView(viewMode) {
        currentViewMode = viewMode;

        // Tab buttons
        document.querySelectorAll('.studio-tab-btn').forEach(btn => {
            if (btn.dataset.view === viewMode) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        // Panes
        const matrixPane = document.getElementById('studio-matrix-pane');
        const detailPane = document.getElementById('studio-detail-pane');
        const sourcePane = document.getElementById('studio-source-pane');

        if (matrixPane) matrixPane.style.display = viewMode === 'matrix' ? 'flex' : 'none';
        if (detailPane) detailPane.style.display = viewMode === 'detail' ? 'flex' : 'none';
        if (sourcePane) sourcePane.style.display = viewMode === 'source' ? 'flex' : 'none';

        if (viewMode === 'matrix') {
            renderAnswerMatrix();
        } else if (viewMode === 'detail') {
            renderQuestionList();
            loadQuestionDetail(activeQuestionIndex);
        } else if (viewMode === 'source') {
            updateSourceView();
        }
    }

    /**
     * Render Azota Answer Matrix Grid (Instant 0ms Feedback)
     */
    function renderAnswerMatrix(filter = currentMatrixFilter, searchKeyword = '') {
        const grid = document.getElementById('azota-matrix-grid');
        if (!grid) return;

        grid.innerHTML = '';
        currentMatrixFilter = filter;
        const kw = (searchKeyword || '').trim().toLowerCase();

        currentQuestions.forEach((q, idx) => {
            const isUnanswered = q.isDefaultAnswer || !q.answers || q.answers.length === 0;

            // Apply filter
            if (filter === 'unanswered' && !isUnanswered) return;
            if (filter === 'answered' && isUnanswered) return;

            // Apply search
            if (kw && !((q.q || '').toLowerCase().includes(kw) || `câu ${idx + 1}`.includes(kw))) {
                return;
            }

            const row = document.createElement('div');
            row.className = `azota-row ${isUnanswered ? 'needs-answer' : 'has-answer'}`;
            row.dataset.qIndex = String(idx);

            const snippet = (stripMathTags(q.q || '') || '(Chưa có nội dung)').slice(0, 65);
            const selectedLetters = (q.answers || []).map(a => String.fromCharCode(65 + a)).join(', ');

            // Left side
            const leftDiv = document.createElement('div');
            leftDiv.className = 'azota-row-left';
            leftDiv.innerHTML = `
                <span class="azota-q-number">Câu ${idx + 1}</span>
                <span class="azota-q-snippet" title="${escapeHtml(q.q || '')}">${escapeHtml(snippet)}...</span>
                <span id="azota-badge-${idx}" class="${isUnanswered ? 'azota-badge-unanswered' : 'azota-badge-answered'}">
                    ${isUnanswered ? '⚠️ Chưa chọn' : `✓ ${selectedLetters}`}
                </span>
            `;

            // Clicking snippet opens detail editor for this question
            leftDiv.querySelector('.azota-q-snippet').onclick = () => {
                activeQuestionIndex = idx;
                switchView('detail');
            };

            // Right side: Option Pills
            const rightDiv = document.createElement('div');
            rightDiv.className = 'azota-row-right';

            const pillsContainer = document.createElement('div');
            pillsContainer.className = 'azota-options-pills';

            const numOpts = (q.options && q.options.length >= 2) ? q.options.length : 4;
            for (let optIdx = 0; optIdx < numOpts; optIdx++) {
                const letter = String.fromCharCode(65 + optIdx);
                const isSelected = (q.answers || []).includes(optIdx) && !q.isDefaultAnswer;

                const pill = document.createElement('button');
                pill.type = 'button';
                pill.className = `azota-opt-pill ${isSelected ? 'active' : ''}`;
                pill.dataset.q = String(idx);
                pill.dataset.opt = String(optIdx);
                pill.title = `Chọn đáp án ${letter} cho Câu ${idx + 1}`;
                pill.innerText = letter;

                // 0ms Sub-millisecond Instant Click Handler
                pill.onclick = (e) => {
                    e.stopPropagation();
                    handleMatrixPillClick(idx, optIdx, row, pillsContainer);
                };

                pillsContainer.appendChild(pill);
            }

            // Edit button
            const editBtn = document.createElement('button');
            editBtn.type = 'button';
            editBtn.className = 'btn-action btn-sm azota-btn-edit';
            editBtn.title = `Chỉnh sửa chi tiết Câu ${idx + 1}`;
            editBtn.innerHTML = '✏️';
            editBtn.onclick = () => {
                activeQuestionIndex = idx;
                switchView('detail');
            };

            rightDiv.appendChild(pillsContainer);
            rightDiv.appendChild(editBtn);

            row.appendChild(leftDiv);
            row.appendChild(rightDiv);
            grid.appendChild(row);
        });

        updateHeaderStats();
    }

    /**
     * Handle Instant 0ms Answer Matrix Pill Click
     */
    function handleMatrixPillClick(qIdx, optIdx, rowEl, pillsContainer) {
        if (qIdx < 0 || qIdx >= currentQuestions.length) return;
        const q = currentQuestions[qIdx];
        const letter = String.fromCharCode(65 + optIdx);

        if (q.type === 'multiple') {
            if (!Array.isArray(q.answers) || q.isDefaultAnswer) {
                q.answers = [];
            }
            const existIdx = q.answers.indexOf(optIdx);
            if (existIdx > -1) {
                q.answers.splice(existIdx, 1);
            } else {
                q.answers.push(optIdx);
                q.answers.sort((a, b) => a - b);
            }
            q.isDefaultAnswer = false;
        } else {
            // Single choice
            q.answers = [optIdx];
            q.isDefaultAnswer = false;
        }

        // Direct DOM update (0ms latency, zero re-rendering overhead!)
        const isUnanswered = !q.answers || q.answers.length === 0;
        pillsContainer.querySelectorAll('.azota-opt-pill').forEach(btn => {
            const bOpt = parseInt(btn.dataset.opt, 10);
            if (q.answers.includes(bOpt)) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        rowEl.className = `azota-row ${isUnanswered ? 'needs-answer' : 'has-answer'}`;
        const badgeEl = document.getElementById(`azota-badge-${qIdx}`);
        if (badgeEl) {
            const selectedLetters = q.answers.map(a => String.fromCharCode(65 + a)).join(', ');
            badgeEl.className = isUnanswered ? 'azota-badge-unanswered' : 'azota-badge-answered';
            badgeEl.innerText = isUnanswered ? '⚠️ Chưa chọn' : `✓ ${selectedLetters}`;
        }

        updateHeaderStats();

        // If all questions are now answered, hide the warning banner
        if (countUnanswered() === 0) {
            hideReviewBanner();
        }
    }

    /**
     * Quick Key String Modal (Azota Key Importer)
     */
    function openQuickKeyModal() {
        const modal = document.getElementById('quick-key-modal');
        if (!modal) return;
        modal.style.display = 'flex';
        const txt = document.getElementById('input-quick-key-text');
        if (txt) {
            txt.value = '';
            txt.focus();
        }
        const start = document.getElementById('input-quick-key-start');
        if (start) start.value = '1';
    }

    function closeQuickKeyModal() {
        const modal = document.getElementById('quick-key-modal');
        if (modal) modal.style.display = 'none';
    }

    function applyQuickKeyString() {
        const txtEl = document.getElementById('input-quick-key-text');
        const startEl = document.getElementById('input-quick-key-start');
        if (!txtEl || !txtEl.value.trim()) {
            alert('Vui lòng nhập chuỗi đáp án (Ví dụ: 1A 2B 3C... hoặc ABCD...)!');
            return;
        }

        const startNum = parseInt(startEl?.value || '1', 10) || 1;
        const keyMap = QuestionParser.parseAnswerKeyString(txtEl.value, startNum);
        const mappedKeys = Object.keys(keyMap);

        if (mappedKeys.length === 0) {
            alert('Không tìm thấy cặp đáp án hợp lệ trong chuỗi vừa dán. Vui lòng kiểm tra lại định dạng!');
            return;
        }

        let appliedCount = 0;
        mappedKeys.forEach(qNumStr => {
            const qNum = parseInt(qNumStr, 10);
            const qIdx = qNum - 1;
            if (qIdx >= 0 && qIdx < currentQuestions.length) {
                currentQuestions[qIdx].answers = [keyMap[qNum]];
                currentQuestions[qIdx].isDefaultAnswer = false;
                appliedCount++;
            }
        });

        closeQuickKeyModal();
        renderAnswerMatrix();
        updateHeaderStats();

        if (countUnanswered() === 0) {
            hideReviewBanner();
        }

        if (window.UIManager) {
            UIManager.showToast(`✓ Đã tự động cập nhật đáp án cho ${appliedCount} câu hỏi!`);
        }
    }

    /**
     * AI Auto-Solve for unanswered questions using Gemini API
     */
    async function triggerAiSolveForMissing() {
        const missingIndices = [];
        currentQuestions.forEach((q, idx) => {
            if (q.isDefaultAnswer || !q.answers || q.answers.length === 0) {
                missingIndices.push(idx);
            }
        });

        if (missingIndices.length === 0) {
            if (window.UIManager) {
                UIManager.showToast('✓ Tất cả các câu hỏi trong đề đều đã có đáp án đầy đủ!');
            } else {
                alert('Tất cả các câu hỏi trong đề đều đã có đáp án đầy đủ!');
            }
            return;
        }

        if (typeof AITutor === 'undefined' || !AITutor.hasApiKey()) {
            if (typeof AITutor !== 'undefined' && AITutor.openApiKeySettingsModal) {
                AITutor.openApiKeySettingsModal('Vui lòng nhập Google Gemini API Key để kích hoạt AI Tự động giải và điền đáp án.');
            } else {
                alert('Chưa cấu hình Google Gemini API Key để sử dụng tính năng này.');
            }
            return;
        }

        if (window.UIManager) {
            UIManager.showLoadingModal(
                '🤖 AI đang phân tích và giải đề...',
                `Đang đọc nội dung & suy luận đáp án chính xác cho ${missingIndices.length} câu hỏi...`
            );
        }

        try {
            // Build question prompt batch (up to 30 questions per request)
            const batchIndices = missingIndices.slice(0, 30);
            const questionsPrompt = batchIndices.map(i => {
                const q = currentQuestions[i];
                const opts = (q.options || []).map((o, optIdx) => `${String.fromCharCode(65 + optIdx)}. ${o}`).join('\n');
                return `[Câu ${i + 1}]\n${q.q}\n${opts}`;
            }).join('\n\n');

            const systemPrompt = `Bạn là một giáo viên chuyên môn cao và chuyên gia giải đề thi trắc nghiệm Việt Nam.
Hãy giải các câu hỏi trắc nghiệm dưới đây và xác định đáp án đúng chính xác nhất (chỉ chọn A, B, C, D, E, F...).
Trả về DUY NHẤT một chuỗi JSON mảng (không giải thích thêm ngoài JSON):
[
  {
    "qNum": 1,
    "answer": "A",
    "explanation": "Giải thích ngắn gọn 1-2 câu"
  }
]

DANH SÁCH CÂU HỎI CẦN GIẢI:
${questionsPrompt}`;

            const responseText = await AITutor.askTutorGeneric(systemPrompt);
            if (!responseText) throw new Error('AI không phản hồi.');

            // Extract JSON
            let cleanJson = responseText.trim();
            const jsonMatch = cleanJson.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
            if (jsonMatch) cleanJson = jsonMatch[1].trim();

            const parsedResults = JSON.parse(cleanJson);
            let solvedCount = 0;

            if (Array.isArray(parsedResults)) {
                parsedResults.forEach(item => {
                    const qNum = parseInt(item.qNum, 10);
                    const qIdx = qNum - 1;
                    if (qIdx >= 0 && qIdx < currentQuestions.length && item.answer) {
                        const letter = String(item.answer).trim().toUpperCase();
                        const ansIdx = letter.charCodeAt(0) - 65;
                        if (ansIdx >= 0 && ansIdx < (currentQuestions[qIdx].options || []).length) {
                            currentQuestions[qIdx].answers = [ansIdx];
                            currentQuestions[qIdx].isDefaultAnswer = false;
                            if (item.explanation && !currentQuestions[qIdx].explanation) {
                                currentQuestions[qIdx].explanation = item.explanation;
                            }
                            solvedCount++;
                        }
                    }
                });
            }

            if (window.UIManager) {
                UIManager.hideLoadingModal();
                renderAnswerMatrix();
                updateHeaderStats();
                if (countUnanswered() === 0) {
                    hideReviewBanner();
                }
                UIManager.showToast(`🎉 AI đã tự động giải & điền thành công đáp án cho ${solvedCount} câu hỏi!`);
            }
        } catch (err) {
            console.error('[Studio AI Solve Error]', err);
            if (window.UIManager) {
                UIManager.hideLoadingModal();
                alert('Lỗi khi AI giải đề: ' + err.message + '\nBạn có thể chọn đáp án bằng tay trên bảng ma trận Azota.');
            }
        }
    }

    /**
     * Raw Source View functions
     */
    function updateSourceView() {
        const area = document.getElementById('studio-source-textarea');
        if (area) {
            area.value = currentRawSource || questionsToTxt(currentQuestions);
        }
    }

    function copySourceText() {
        const area = document.getElementById('studio-source-textarea');
        if (area && area.value) {
            navigator.clipboard.writeText(area.value).then(() => {
                if (window.UIManager) UIManager.showToast('✓ Đã sao chép văn bản gốc vào bộ nhớ tạm!');
            });
        }
    }

    function reparseFromSource() {
        const area = document.getElementById('studio-source-textarea');
        if (!area || !area.value.trim()) return;

        if (!confirm('Bạn có chắc muốn phân tích lại đề thi từ nội dung văn bản này? Các thay đổi thủ công chưa áp dụng sẽ được làm mới.')) {
            return;
        }

        const newText = area.value.trim();
        const analysis = QuestionParser.analyzeAndParse(newText);
        if (analysis.questions.length === 0) {
            alert('Không tìm thấy câu hỏi hợp lệ trong văn bản!');
            return;
        }

        currentQuestions = analysis.questions;
        currentRawSource = newText;
        activeQuestionIndex = 0;

        renderAnswerMatrix();
        renderQuestionList();
        loadQuestionDetail(activeQuestionIndex);
        updateHeaderStats();

        if (analysis.unansweredCount > 0) {
            showReviewBanner(analysis.unansweredCount, analysis.total);
            switchView('matrix');
        } else {
            hideReviewBanner();
        }

        if (window.UIManager) {
            UIManager.showToast(`✓ Đã phân tích lại thành công ${analysis.total} câu hỏi!`);
        }
    }

    /**
     * Create a blank default question
     */
    function createBlankQuestion(number = 1) {
        return {
            q: `Câu ${number}: Nhập nội dung câu hỏi tại đây...`,
            options: [
                'Phương án A',
                'Phương án B',
                'Phương án C',
                'Phương án D'
            ],
            type: 'single',
            answers: [0],
            explanation: '',
            isDefaultAnswer: false
        };
    }

    /**
     * Render the left sidebar question list (for Detailed Editor)
     */
    function renderQuestionList(filterKeyword = '') {
        const listContainer = document.getElementById('studio-qlist');
        if (!listContainer) return;

        listContainer.innerHTML = '';
        const keyword = (filterKeyword || '').trim().toLowerCase();

        currentQuestions.forEach((q, idx) => {
            const matchesSearch = !keyword || (q.q && q.q.toLowerCase().includes(keyword));
            if (!matchesSearch) return;

            const item = document.createElement('div');
            item.className = 'studio-q-item' + (idx === activeQuestionIndex ? ' active' : '');
            item.dataset.index = String(idx);

            const hasWarning = !q.q || !q.options || q.options.length < 2 || !q.answers || q.answers.length === 0 || q.isDefaultAnswer;
            const badgeType = q.type === 'multiple' ? 'Nhiều đáp án' : '1 đáp án';
            const numOptions = q.options ? q.options.length : 0;

            item.innerHTML = `
                <div class="studio-q-item-header">
                    <span class="studio-q-num">Câu ${idx + 1}</span>
                    <span class="studio-q-badge ${q.type}">${badgeType}</span>
                </div>
                <div class="studio-q-snippet">${escapeHtml(stripMathTags(q.q || '')).slice(0, 70) || '(Chưa có nội dung)'}...</div>
                <div class="studio-q-meta">
                    <span>${numOptions} lựa chọn</span>
                    ${hasWarning ? '<span class="studio-q-warn" title="Chưa có đáp án hoặc thiếu dữ liệu">⚠️ Thiếu đáp án</span>' : '<span>✓ Hợp lệ</span>'}
                </div>
            `;

            item.onclick = () => {
                saveCurrentQuestionFromForm();
                activeQuestionIndex = idx;
                renderQuestionList(filterKeyword);
                loadQuestionDetail(activeQuestionIndex);
            };

            listContainer.appendChild(item);
        });

        updateHeaderStats();
    }

    /**
     * Strip math tags for snippet display while keeping formula text readable
     */
    function stripMathTags(str) {
        if (!str) return '';
        return str
            .replace(/\$\$(.*?)\$\$/g, ' $1 ')
            .replace(/\$(.*?)\$/g, '$1')
            .replace(/\\(?:frac|text|mathrm|mathbf|sqrt)\b/g, '')
            .replace(/[{}]/g, '')
            .replace(/\s+/g, ' ')
            .trim();
    }

    /**
     * Load question details into the right form
     */
    function loadQuestionDetail(idx) {
        if (idx < 0 || idx >= currentQuestions.length) return;
        const q = currentQuestions[idx];

        const qTitleInput = document.getElementById('studio-input-q');
        const qTypeSelect = document.getElementById('studio-select-type');
        const qExpInput = document.getElementById('studio-input-exp');
        const qImageUrlInput = document.getElementById('studio-input-imgurl');
        const curIndexLabel = document.getElementById('studio-current-q-index');

        if (curIndexLabel) curIndexLabel.innerText = `Câu ${idx + 1} / ${currentQuestions.length}`;
        if (qTitleInput) qTitleInput.value = q.q || '';
        if (qTypeSelect) qTypeSelect.value = q.type || 'single';
        if (qExpInput) qExpInput.value = q.explanation || '';
        if (qImageUrlInput) qImageUrlInput.value = q.image || '';

        renderOptionsForm(q);
        updateLivePreview();
    }

    /**
     * Render dynamic options list inside the form
     */
    function renderOptionsForm(q) {
        const container = document.getElementById('studio-options-container');
        if (!container) return;

        container.innerHTML = '';
        const isMultiple = q.type === 'multiple';
        const answers = Array.isArray(q.answers) ? q.answers : [];

        q.options.forEach((optText, optIdx) => {
            const row = document.createElement('div');
            row.className = 'studio-opt-row';

            const isChecked = answers.includes(optIdx) && !q.isDefaultAnswer;
            const inputType = isMultiple ? 'checkbox' : 'radio';
            const charCode = String.fromCharCode(65 + optIdx);

            row.innerHTML = `
                <label class="studio-opt-check-label" title="Đánh dấu đáp án đúng">
                    <input type="${inputType}" name="studio-correct-opt" class="studio-opt-check" data-idx="${optIdx}" ${isChecked ? 'checked' : ''}>
                    <span class="studio-opt-letter">${charCode}</span>
                </label>
                <input type="text" class="custom-select studio-opt-text" value="${escapeHtml(optText)}" placeholder="Nhập phương án ${charCode}..." data-idx="${optIdx}">
                <button type="button" class="btn-action btn-danger studio-btn-del-opt" title="Xóa phương án này" data-idx="${optIdx}">✕</button>
            `;

            container.appendChild(row);
        });

        // Attach listeners for options
        container.querySelectorAll('.studio-opt-text').forEach(input => {
            input.addEventListener('input', () => {
                saveCurrentQuestionFromForm();
                updateLivePreview();
            });
        });

        container.querySelectorAll('.studio-opt-check').forEach(check => {
            check.addEventListener('change', () => {
                saveCurrentQuestionFromForm();
                updateLivePreview();
                updateHeaderStats();
            });
        });

        container.querySelectorAll('.studio-btn-del-opt').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const optIdx = parseInt(e.target.dataset.idx, 10);
                if (q.options.length <= 2) {
                    alert('Câu hỏi trắc nghiệm cần có ít nhất 2 phương án lựa chọn!');
                    return;
                }
                q.options.splice(optIdx, 1);
                q.answers = (q.answers || [])
                    .filter(a => a !== optIdx)
                    .map(a => (a > optIdx ? a - 1 : a));
                if (q.answers.length === 0 && q.options.length > 0) {
                    q.answers = [0];
                    q.isDefaultAnswer = true;
                }
                renderOptionsForm(q);
                saveCurrentQuestionFromForm();
                updateLivePreview();
                updateHeaderStats();
            });
        });
    }

    /**
     * Save form inputs into currentQuestions[activeQuestionIndex]
     */
    function saveCurrentQuestionFromForm() {
        if (activeQuestionIndex < 0 || activeQuestionIndex >= currentQuestions.length) return;
        const q = currentQuestions[activeQuestionIndex];

        const qTitleInput = document.getElementById('studio-input-q');
        const qTypeSelect = document.getElementById('studio-select-type');
        const qExpInput = document.getElementById('studio-input-exp');
        const qImageUrlInput = document.getElementById('studio-input-imgurl');

        if (qTitleInput) q.q = qTitleInput.value.trim();
        if (qTypeSelect) q.type = qTypeSelect.value;
        if (qExpInput) q.explanation = qExpInput.value.trim();
        if (qImageUrlInput) q.image = qImageUrlInput.value.trim();

        // Read options
        const optInputs = document.querySelectorAll('.studio-opt-text');
        const newOptions = [];
        optInputs.forEach(input => {
            newOptions.push(input.value.trim());
        });
        if (newOptions.length >= 2) {
            q.options = newOptions;
        }

        // Read correct answers
        const checkedBoxes = document.querySelectorAll('.studio-opt-check:checked');
        const newAnswers = [];
        checkedBoxes.forEach(chk => {
            newAnswers.push(parseInt(chk.dataset.idx, 10));
        });
        q.answers = newAnswers;
        if (newAnswers.length > 0) {
            q.isDefaultAnswer = false;
        }
    }

    /**
     * Real-time Live KaTeX & Question Preview
     */
    function updateLivePreview() {
        const previewContainer = document.getElementById('studio-preview-box');
        if (!previewContainer) return;

        if (activeQuestionIndex < 0 || activeQuestionIndex >= currentQuestions.length) {
            previewContainer.innerHTML = '<em>Chọn một câu hỏi để xem trước.</em>';
            return;
        }

        const q = currentQuestions[activeQuestionIndex];
        const formattedQ = QuestionParser ? QuestionParser.formatMathText(q.q || '') : escapeHtml(q.q || '');
        const formattedExp = QuestionParser ? QuestionParser.formatMathText(q.explanation || '') : escapeHtml(q.explanation || '');

        let optionsHtml = '';
        (q.options || []).forEach((opt, idx) => {
            const char = String.fromCharCode(65 + idx);
            const isCorrect = (q.answers || []).includes(idx) && !q.isDefaultAnswer;
            const formattedOpt = QuestionParser ? QuestionParser.formatMathText(opt) : escapeHtml(opt);
            optionsHtml += `
                <div class="studio-preview-opt ${isCorrect ? 'correct-mark' : ''}">
                    <strong class="opt-prefix">${char}.</strong>
                    <span>${formattedOpt}</span>
                    ${isCorrect ? '<span class="correct-tag">✓ Đáp án đúng</span>' : ''}
                </div>
            `;
        });

        previewContainer.innerHTML = `
            <div class="studio-preview-card">
                <div class="studio-preview-title">
                    <span class="preview-badge">Câu ${activeQuestionIndex + 1}</span>
                    <div>${formattedQ}</div>
                </div>
                ${q.image ? `<div class="studio-preview-img-wrap"><img src="${escapeHtml(q.image)}" alt="Hình minh họa"></div>` : ''}
                <div class="studio-preview-options">${optionsHtml}</div>
                ${q.explanation ? `
                    <div class="studio-preview-exp">
                        <strong>💡 Lời giải chi tiết:</strong>
                        <div>${formattedExp}</div>
                    </div>
                ` : ''}
            </div>
        `;

        if (window.renderMathInElement) {
            try {
                window.renderMathInElement(previewContainer, {
                    delimiters: [
                        { left: '$$', right: '$$', display: true },
                        { left: '$', right: '$', display: false },
                        { left: '\\(', right: '\\)', display: false },
                        { left: '\\[', right: '\\]', display: true }
                    ],
                    throwOnError: false
                });
            } catch (e) {
                console.warn('[Studio] KaTeX render warning:', e);
            }
        }
    }

    /**
     * Add a new question at the end
     */
    function addNewQuestion() {
        saveCurrentQuestionFromForm();
        const newQ = createBlankQuestion(currentQuestions.length + 1);
        currentQuestions.push(newQ);
        activeQuestionIndex = currentQuestions.length - 1;
        renderQuestionList();
        loadQuestionDetail(activeQuestionIndex);

        const list = document.getElementById('studio-qlist');
        if (list) list.scrollTop = list.scrollHeight;
    }

    /**
     * Delete active question
     */
    function deleteActiveQuestion() {
        if (currentQuestions.length <= 1) {
            alert('Đề thi cần có ít nhất 1 câu hỏi!');
            return;
        }

        if (!confirm(`Bạn có chắc muốn xóa Câu ${activeQuestionIndex + 1}?`)) return;

        currentQuestions.splice(activeQuestionIndex, 1);
        if (activeQuestionIndex >= currentQuestions.length) {
            activeQuestionIndex = currentQuestions.length - 1;
        }
        renderQuestionList();
        loadQuestionDetail(activeQuestionIndex);
        updateHeaderStats();
    }

    /**
     * Move active question Up or Down
     */
    function moveQuestion(direction) {
        saveCurrentQuestionFromForm();
        const targetIndex = activeQuestionIndex + direction;
        if (targetIndex < 0 || targetIndex >= currentQuestions.length) return;

        const temp = currentQuestions[activeQuestionIndex];
        currentQuestions[activeQuestionIndex] = currentQuestions[targetIndex];
        currentQuestions[targetIndex] = temp;

        activeQuestionIndex = targetIndex;
        renderQuestionList();
        loadQuestionDetail(activeQuestionIndex);
    }

    /**
     * Add a new option to the current question
     */
    function addNewOption() {
        saveCurrentQuestionFromForm();
        const q = currentQuestions[activeQuestionIndex];
        if (!q.options) q.options = [];
        const nextChar = String.fromCharCode(65 + q.options.length);
        q.options.push(`Phương án ${nextChar}`);
        renderOptionsForm(q);
        updateLivePreview();
    }

    /**
     * Validate and Apply changes back to the main QuizEngine
     */
    function applyChanges() {
        if (currentViewMode === 'detail') {
            saveCurrentQuestionFromForm();
        }

        // Validate basic validity
        for (let i = 0; i < currentQuestions.length; i++) {
            const q = currentQuestions[i];
            if (!q.q || !q.q.trim()) {
                alert(`Câu ${i + 1} chưa có nội dung! Vui lòng kiểm tra lại.`);
                activeQuestionIndex = i;
                switchView('detail');
                return;
            }
            if (!q.options || q.options.length < 2) {
                alert(`Câu ${i + 1} cần có ít nhất 2 phương án lựa chọn!`);
                activeQuestionIndex = i;
                switchView('detail');
                return;
            }
        }

        const un = countUnanswered();
        if (un > 0) {
            const proceed = confirm(`Đề thi vẫn còn ${un} câu hỏi chưa chọn đáp án. Bạn có muốn tự động gán đáp án mặc định (A) để bắt đầu luyện tập ngay không?`);
            if (!proceed) {
                switchView('matrix');
                return;
            }
            // Fallback unassigned questions to A
            currentQuestions.forEach(q => {
                if (q.isDefaultAnswer || !q.answers || q.answers.length === 0) {
                    q.answers = [0];
                    q.isDefaultAnswer = false;
                }
            });
        }

        if (typeof onApplyCallback === 'function') {
            onApplyCallback(currentQuestions);
        }

        close();
        if (window.UIManager) {
            UIManager.showToast('✓ Đã áp dụng đề thi thành công! Bắt đầu luyện tập ngay.');
        }
    }

    /**
     * Serialize question array to clean text format
     */
    function questionsToTxt(questions) {
        if (!Array.isArray(questions)) return '';
        let txt = '';
        questions.forEach((q, idx) => {
            txt += `Câu ${idx + 1}: ${q.q}\n`;
            (q.options || []).forEach((opt, optIdx) => {
                const char = String.fromCharCode(65 + optIdx);
                txt += `${char}. ${opt}\n`;
            });
            if (q.answers && q.answers.length > 0 && !q.isDefaultAnswer) {
                const ansLetters = q.answers.map(a => String.fromCharCode(65 + a)).join(', ');
                txt += `Đáp án: ${ansLetters}\n`;
            }
            if (q.explanation) {
                txt += `Lời giải: ${q.explanation}\n`;
            }
            txt += '\n';
        });
        return txt;
    }

    /**
     * Export current question set to JSON file
     */
    function exportToJson() {
        if (currentViewMode === 'detail') saveCurrentQuestionFromForm();
        const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(currentQuestions, null, 2));
        const dlAnchor = document.createElement('a');
        dlAnchor.setAttribute('href', dataStr);
        dlAnchor.setAttribute('download', `omniquiz_exam_${Date.now()}.json`);
        document.body.appendChild(dlAnchor);
        dlAnchor.click();
        dlAnchor.remove();
    }

    /**
     * Export to clean CBT formatted text
     */
    function exportToTxt() {
        if (currentViewMode === 'detail') saveCurrentQuestionFromForm();
        const txt = questionsToTxt(currentQuestions);
        const dataStr = 'data:text/plain;charset=utf-8,' + encodeURIComponent(txt);
        const dlAnchor = document.createElement('a');
        dlAnchor.setAttribute('href', dataStr);
        dlAnchor.setAttribute('download', `omniquiz_exam_${Date.now()}.txt`);
        document.body.appendChild(dlAnchor);
        dlAnchor.click();
        dlAnchor.remove();
    }

    /**
     * Helper to escape HTML characters
     */
    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    /**
     * Initialize DOM Event listeners for Question Studio
     */
    function init() {
        document.getElementById('btn-close-studio')?.addEventListener('click', close);
        document.getElementById('btn-studio-apply')?.addEventListener('click', applyChanges);
        document.getElementById('btn-studio-add-q')?.addEventListener('click', addNewQuestion);
        document.getElementById('btn-studio-del-q')?.addEventListener('click', deleteActiveQuestion);
        document.getElementById('btn-studio-move-up')?.addEventListener('click', () => moveQuestion(-1));
        document.getElementById('btn-studio-move-down')?.addEventListener('click', () => moveQuestion(1));
        document.getElementById('btn-studio-add-opt')?.addEventListener('click', addNewOption);
        document.getElementById('btn-studio-export-json')?.addEventListener('click', exportToJson);
        document.getElementById('btn-studio-export-txt')?.addEventListener('click', exportToTxt);

        // Tab Navigation
        document.getElementById('tab-btn-matrix')?.addEventListener('click', () => switchView('matrix'));
        document.getElementById('tab-btn-detail')?.addEventListener('click', () => switchView('detail'));
        document.getElementById('tab-btn-source')?.addEventListener('click', () => switchView('source'));

        // Quick Key Modal buttons
        document.getElementById('btn-studio-quick-key')?.addEventListener('click', openQuickKeyModal);
        document.getElementById('btn-banner-quick-key')?.addEventListener('click', openQuickKeyModal);
        document.getElementById('btn-matrix-quick-key')?.addEventListener('click', openQuickKeyModal);
        document.getElementById('btn-close-quick-key')?.addEventListener('click', closeQuickKeyModal);
        document.getElementById('btn-cancel-quick-key')?.addEventListener('click', closeQuickKeyModal);
        document.getElementById('btn-apply-quick-key')?.addEventListener('click', applyQuickKeyString);

        // AI Auto Solve buttons
        document.getElementById('btn-studio-ai-solve')?.addEventListener('click', triggerAiSolveForMissing);
        document.getElementById('btn-banner-ai-solve')?.addEventListener('click', triggerAiSolveForMissing);

        // Matrix filter buttons
        document.getElementById('azota-filter-all')?.addEventListener('click', () => {
            setActiveFilter('all');
            renderAnswerMatrix('all', document.getElementById('azota-search-input')?.value);
        });
        document.getElementById('azota-filter-unanswered')?.addEventListener('click', () => {
            setActiveFilter('unanswered');
            renderAnswerMatrix('unanswered', document.getElementById('azota-search-input')?.value);
        });
        document.getElementById('azota-filter-answered')?.addEventListener('click', () => {
            setActiveFilter('answered');
            renderAnswerMatrix('answered', document.getElementById('azota-search-input')?.value);
        });

        function setActiveFilter(fName) {
            document.querySelectorAll('.azota-filter-btn').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.filter === fName);
            });
        }

        // Matrix search input
        document.getElementById('azota-search-input')?.addEventListener('input', (e) => {
            renderAnswerMatrix(currentMatrixFilter, e.target.value);
        });

        // Source View Buttons
        document.getElementById('btn-copy-source-text')?.addEventListener('click', copySourceText);
        document.getElementById('btn-reparse-source')?.addEventListener('click', reparseFromSource);

        // Filter search in question list
        document.getElementById('studio-search-q')?.addEventListener('input', (e) => {
            renderQuestionList(e.target.value);
        });

        // Text inputs change handlers
        const qTitleInput = document.getElementById('studio-input-q');
        if (qTitleInput) {
            qTitleInput.addEventListener('input', () => {
                saveCurrentQuestionFromForm();
                updateLivePreview();
                const activeItem = document.querySelector(`.studio-q-item[data-index="${activeQuestionIndex}"] .studio-q-snippet`);
                if (activeItem) {
                    activeItem.innerText = (stripMathTags(qTitleInput.value).slice(0, 70) || '(Chưa có nội dung)') + '...';
                }
            });
        }

        const qExpInput = document.getElementById('studio-input-exp');
        if (qExpInput) {
            qExpInput.addEventListener('input', () => {
                saveCurrentQuestionFromForm();
                updateLivePreview();
            });
        }

        const qTypeSelect = document.getElementById('studio-select-type');
        if (qTypeSelect) {
            qTypeSelect.addEventListener('change', () => {
                saveCurrentQuestionFromForm();
                renderOptionsForm(currentQuestions[activeQuestionIndex]);
                updateLivePreview();
            });
        }

        // Image file upload handler
        document.getElementById('studio-file-img')?.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (evt) => {
                    const imgUrlInput = document.getElementById('studio-input-imgurl');
                    if (imgUrlInput) imgUrlInput.value = evt.target.result;
                    saveCurrentQuestionFromForm();
                    updateLivePreview();
                };
                reader.readAsDataURL(file);
            }
        });

        // Quick Paste / OCR Import button
        document.getElementById('btn-studio-quick-paste')?.addEventListener('click', () => {
            const raw = prompt('Dán đoạn văn bản chứa câu hỏi mới (định dạng tự nhiên hoặc Câu 1: ... A. ... B. ... Đáp án: ...):');
            if (raw && raw.trim() && window.QuestionParser) {
                const parsed = QuestionParser.parse(raw);
                if (parsed && parsed.length > 0) {
                    if (currentViewMode === 'detail') saveCurrentQuestionFromForm();
                    currentQuestions.push(...parsed);
                    renderAnswerMatrix();
                    renderQuestionList();
                    activeQuestionIndex = currentQuestions.length - 1;
                    loadQuestionDetail(activeQuestionIndex);
                    updateHeaderStats();
                    alert(`✓ Đã nạp thêm thành công ${parsed.length} câu hỏi mới vào đề!`);
                } else {
                    alert('Không nhận diện được câu hỏi hợp lệ từ đoạn văn bản vừa dán.');
                }
            }
        });
    }

    return {
        open,
        close,
        init,
        switchView,
        renderAnswerMatrix,
        openQuickKeyModal,
        closeQuickKeyModal,
        applyQuickKeyString,
        triggerAiSolveForMissing,
        questionsToTxt,
        getCurrentQuestions: () => {
            if (currentViewMode === 'detail') saveCurrentQuestionFromForm();
            return currentQuestions;
        }
    };
})();

// Attach to global window
if (typeof window !== 'undefined') {
    window.QuestionStudio = QuestionStudio;
}

// Auto initialize on DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', QuestionStudio.init);
} else {
    QuestionStudio.init();
}
