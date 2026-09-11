/**
 * editor.js - Question Studio & Interactive Exam Editor Module
 * Phase 3 EdTech Studio & Content Empowerment
 * Allows full in-browser visual inspection, KaTeX live preview, manual question editing,
 * adding/deleting choices, adjusting correct answers, and exporting/importing question banks.
 */

const QuestionStudio = (() => {
    let currentQuestions = [];
    let activeQuestionIndex = 0;
    let onApplyCallback = null;

    /**
     * Open Question Studio with a given list of questions
     */
    function open(questions, onApply) {
        if (!Array.isArray(questions) || questions.length === 0) {
            // If empty, initialize with 1 default question
            currentQuestions = [createBlankQuestion(1)];
        } else {
            // Deep clone questions to prevent mutating active state until Applied
            currentQuestions = JSON.parse(JSON.stringify(questions));
        }

        activeQuestionIndex = 0;
        onApplyCallback = onApply;

        const modal = document.getElementById('question-studio-modal');
        if (!modal) return;

        modal.style.display = 'flex';
        renderQuestionList();
        loadQuestionDetail(activeQuestionIndex);
    }

    /**
     * Close Question Studio without applying changes
     */
    function close() {
        const modal = document.getElementById('question-studio-modal');
        if (modal) modal.style.display = 'none';
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
     * Render the left sidebar question list
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
            item.dataset.index = idx;

            const hasWarning = !q.q || !q.options || q.options.length < 2 || !q.answers || q.answers.length === 0;
            const badgeType = q.type === 'multiple' ? 'Nhiều đáp án' : '1 đáp án';
            const numOptions = q.options ? q.options.length : 0;

            item.innerHTML = `
                <div class="studio-q-item-header">
                    <span class="studio-q-num">Câu ${idx + 1}</span>
                    <span class="studio-q-badge ${q.type}">${badgeType}</span>
                </div>
                <div class="studio-q-snippet">${escapeHtml(stripMathTags(q.q)).slice(0, 70) || '(Chưa có nội dung)'}...</div>
                <div class="studio-q-meta">
                    <span>${numOptions} lựa chọn</span>
                    ${hasWarning ? '<span class="studio-q-warn" title="Chưa hoàn thiện">⚠️ Thiếu dữ liệu</span>' : '<span>✓ Hợp lệ</span>'}
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

        // Update total counter
        const countEl = document.getElementById('studio-total-count');
        if (countEl) countEl.innerText = `${currentQuestions.length} câu hỏi`;
    }

    /**
     * Strip math tags for snippet display
     */
    function stripMathTags(str) {
        if (!str) return '';
        return str.replace(/\$\$[\s\S]*?\$\$/g, '[Công thức]').replace(/\$[^\$]*?\$/g, '[CT]');
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

            const isChecked = answers.includes(optIdx);
            const inputType = isMultiple ? 'checkbox' : 'radio';

            const charCode = String.fromCharCode(65 + optIdx); // A, B, C, D...

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
                // Adjust correct answers array
                q.answers = q.answers
                    .filter(a => a !== optIdx)
                    .map(a => (a > optIdx ? a - 1 : a));
                if (q.answers.length === 0 && q.options.length > 0) {
                    q.answers = [0]; // default fallback
                }
                renderOptionsForm(q);
                saveCurrentQuestionFromForm();
                updateLivePreview();
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
            const isCorrect = (q.answers || []).includes(idx);
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

        // Render KaTeX Math & Chemistry formulas in the preview
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

        // Scroll list to bottom
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
        saveCurrentQuestionFromForm();

        // Validate all questions
        for (let i = 0; i < currentQuestions.length; i++) {
            const q = currentQuestions[i];
            if (!q.q || !q.q.trim()) {
                alert(`Câu ${i + 1} chưa có nội dung! Vui lòng kiểm tra lại.`);
                activeQuestionIndex = i;
                renderQuestionList();
                loadQuestionDetail(i);
                return;
            }
            if (!q.options || q.options.length < 2) {
                alert(`Câu ${i + 1} cần có ít nhất 2 phương án lựa chọn!`);
                activeQuestionIndex = i;
                renderQuestionList();
                loadQuestionDetail(i);
                return;
            }
            if (!q.answers || q.answers.length === 0) {
                alert(`Câu ${i + 1} chưa có đáp án đúng! Vui lòng chọn ít nhất 1 đáp án đúng.`);
                activeQuestionIndex = i;
                renderQuestionList();
                loadQuestionDetail(i);
                return;
            }
        }

        if (typeof onApplyCallback === 'function') {
            onApplyCallback(currentQuestions);
        }

        close();
        if (window.UIManager) {
            UIManager.showToast('✓ Đã cập nhật đề thi thành công từ Question Studio!');
        }
    }

    /**
     * Export current question set to JSON file
     */
    function exportToJson() {
        saveCurrentQuestionFromForm();
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
        saveCurrentQuestionFromForm();
        let txt = '';
        currentQuestions.forEach((q, idx) => {
            txt += `Câu ${idx + 1}: ${q.q}\n`;
            (q.options || []).forEach((opt, optIdx) => {
                const char = String.fromCharCode(65 + optIdx);
                txt += `${char}. ${opt}\n`;
            });
            if (q.answers && q.answers.length > 0) {
                const ansLetters = q.answers.map(a => String.fromCharCode(65 + a)).join(', ');
                txt += `Đáp án: ${ansLetters}\n`;
            }
            if (q.explanation) {
                txt += `Lời giải: ${q.explanation}\n`;
            }
            txt += '\n';
        });

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

        // Filter search input
        document.getElementById('studio-search-q')?.addEventListener('input', (e) => {
            renderQuestionList(e.target.value);
        });

        // Text inputs change handlers
        const qTitleInput = document.getElementById('studio-input-q');
        if (qTitleInput) {
            qTitleInput.addEventListener('input', () => {
                saveCurrentQuestionFromForm();
                updateLivePreview();
                // Update snippet in list
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
                    saveCurrentQuestionFromForm();
                    currentQuestions.push(...parsed);
                    renderQuestionList();
                    activeQuestionIndex = currentQuestions.length - 1;
                    loadQuestionDetail(activeQuestionIndex);
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
        getCurrentQuestions: () => currentQuestions
    };
})();

// Auto initialize on DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', QuestionStudio.init);
} else {
    QuestionStudio.init();
}
