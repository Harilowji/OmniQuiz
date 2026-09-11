/**
 * flashcard.js - 3D Flashcard & Spaced Repetition Engine
 * Features:
 * 1. 3D card flip animation with smooth cubic-bezier transitions
 * 2. Front face: Question + Math (KaTeX) + Options (A, B, C, D)
 * 3. Back face: Correct answer highlight + Detailed explanation + AI Tutor prompt
 * 4. Mastery tracking: Mastered vs Unmastered sets
 * 5. Spaced repetition loop: Retake unmastered cards until 100% mastery
 * 6. Ergonomic keyboard shortcuts (Space, ArrowLeft, ArrowRight, 1, 2)
 */
const FlashcardEngine = (() => {
    let state = {
        questions: [],
        currentIndex: 0,
        isFlipped: false,
        masteredSet: new Set(),
        unmasteredSet: new Set(),
        historyStack: [], // Array of { index, isMastered } for undo
        isCompleted: false,
        isActive: false
    };

    let keydownListenerAttached = false;

    function init(questions) {
        state.questions = questions || [];
        state.currentIndex = 0;
        state.isFlipped = false;
        state.masteredSet.clear();
        state.unmasteredSet.clear();
        state.historyStack = [];
        state.isCompleted = false;
        state.isActive = true;

        attachKeyboardEvents();
        render();
    }

    function restartAll() {
        state.currentIndex = 0;
        state.isFlipped = false;
        state.masteredSet.clear();
        state.unmasteredSet.clear();
        state.historyStack = [];
        state.isCompleted = false;
        render();
    }

    function retakeUnmasteredOnly() {
        if (state.unmasteredSet.size === 0) {
            restartAll();
            return;
        }

        // Filter only questions that user marked as unmastered
        const unmasteredQuestions = Array.from(state.unmasteredSet).map(idx => state.questions[idx]);
        init(unmasteredQuestions);
    }

    function flip() {
        if (state.isCompleted) return;
        state.isFlipped = !state.isFlipped;
        const cardEl = document.getElementById('flashcard-card');
        if (cardEl) {
            if (state.isFlipped) {
                cardEl.classList.add('is-flipped');
            } else {
                cardEl.classList.remove('is-flipped');
            }
        }
    }

    function markCard(isMastered) {
        if (state.isCompleted || state.currentIndex >= state.questions.length) return;

        const currentIdx = state.currentIndex;
        const cardEl = document.getElementById('flashcard-card');

        // Animation swipe
        if (cardEl) {
            cardEl.classList.add(isMastered ? 'swipe-right' : 'swipe-left');
        }

        // Record history
        state.historyStack.push({
            index: currentIdx,
            isMastered: isMastered
        });

        if (isMastered) {
            state.masteredSet.add(currentIdx);
            state.unmasteredSet.delete(currentIdx);
            if (typeof AudioManager !== 'undefined' && AudioManager.playDing) {
                AudioManager.playDing();
            }
        } else {
            state.unmasteredSet.add(currentIdx);
            state.masteredSet.delete(currentIdx);
            if (typeof AudioManager !== 'undefined' && AudioManager.playBuzz) {
                AudioManager.playBuzz();
            }
        }

        setTimeout(() => {
            state.currentIndex++;
            state.isFlipped = false;
            if (state.currentIndex >= state.questions.length) {
                state.isCompleted = true;
            }
            render();
        }, 280);
    }

    function undo() {
        if (state.historyStack.length === 0) return;

        const last = state.historyStack.pop();
        state.currentIndex = last.index;
        state.isFlipped = false;
        state.isCompleted = false;

        if (last.isMastered) {
            state.masteredSet.delete(last.index);
        } else {
            state.unmasteredSet.delete(last.index);
        }

        render();
    }

    function attachKeyboardEvents() {
        if (keydownListenerAttached) return;
        keydownListenerAttached = true;

        window.addEventListener('keydown', (e) => {
            // Only trigger if flashcard mode is active and not typing in an input/textarea
            if (!state.isActive) return;
            const targetTag = e.target.tagName.toLowerCase();
            if (targetTag === 'input' || targetTag === 'textarea' || targetTag === 'select') return;

            // Check if summary modal or other modals are open
            const anyModalOpen = document.querySelector('.modal-overlay[style*="display: flex"]');
            if (anyModalOpen) return;

            if (e.code === 'Space') {
                e.preventDefault();
                flip();
            } else if (e.code === 'ArrowLeft' || e.key === '1') {
                e.preventDefault();
                markCard(false);
            } else if (e.code === 'ArrowRight' || e.key === '2') {
                e.preventDefault();
                markCard(true);
            } else if (e.code === 'Backspace' || (e.ctrlKey && e.code === 'KeyZ')) {
                e.preventDefault();
                undo();
            }
        });
    }

    function render() {
        const container = document.getElementById('flashcard-section');
        if (!container) return;

        if (!state.questions || state.questions.length === 0) {
            container.innerHTML = `
                <div class="flashcard-empty-state">
                    <div style="font-size: 3em; margin-bottom: 12px;">🎴</div>
                    <h3 style="margin-bottom: 6px;">Chưa có dữ liệu thẻ ghi nhớ</h3>
                    <p style="opacity: 0.8; font-size: 0.95em;">Vui lòng tải lên đề thi hoặc chọn đề mẫu để bắt đầu ôn luyện bằng Flashcard.</p>
                </div>
            `;
            return;
        }

        const total = state.questions.length;

        // If completed all cards in this session
        if (state.isCompleted || state.currentIndex >= total) {
            renderSummary(container);
            return;
        }

        const qIndex = state.currentIndex;
        const q = state.questions[qIndex];
        const correctAnswers = (typeof QuizEngine !== 'undefined' && QuizEngine.getCorrectAnswers)
            ? QuizEngine.getCorrectAnswers(q)
            : (q.answers || []);

        const explanation = (typeof QuizEngine !== 'undefined' && QuizEngine.getExplanation)
            ? QuizEngine.getExplanation(q)
            : (q.explanation || '');

        const progressPercent = Math.round(((qIndex) / total) * 100);
        const letters = ['A', 'B', 'C', 'D', 'E', 'F'];

        // Format correct answers string
        const correctLetters = correctAnswers.map(i => letters[i] || (i + 1)).join(', ');
        const correctOptionsText = correctAnswers.map(i => {
            const opt = q.options[i] || '';
            const safeOpt = (typeof QuestionParser !== 'undefined' && QuestionParser.formatMathText)
                ? QuestionParser.formatMathText(opt)
                : opt;
            return `<strong>${letters[i] || (i + 1)}.</strong> ${safeOpt}`;
        }).join('<br>');

        const safeQuestionText = (typeof QuestionParser !== 'undefined' && QuestionParser.formatMathText)
            ? QuestionParser.formatMathText(q.q)
            : q.q;

        const safeExplanation = (typeof QuestionParser !== 'undefined' && QuestionParser.formatMathText)
            ? QuestionParser.formatMathText(explanation)
            : explanation;

        // Options for Front face
        const optionsListHtml = q.options.map((opt, i) => {
            const safeOpt = (typeof QuestionParser !== 'undefined' && QuestionParser.formatMathText)
                ? QuestionParser.formatMathText(opt)
                : opt;
            return `
                <div class="flashcard-option-preview">
                    <span class="flashcard-option-badge">${letters[i] || (i + 1)}</span>
                    <span class="flashcard-option-text">${safeOpt}</span>
                </div>
            `;
        }).join('');

        container.innerHTML = `
            <div class="flashcard-arena">
                <!-- Top Toolbar: Navigation & Progress -->
                <div class="flashcard-topbar">
                    <div class="flashcard-progress-info">
                        <span class="flashcard-pill-idx">Thẻ <strong>${qIndex + 1}</strong> / ${total}</span>
                        <div class="flashcard-counts">
                            <span class="fc-badge fc-mastered">✅ Đã thuộc: <strong>${state.masteredSet.size}</strong></span>
                            <span class="fc-badge fc-unmastered">❌ Chưa thuộc: <strong>${state.unmasteredSet.size}</strong></span>
                        </div>
                    </div>
                    <div class="flashcard-actions-quick">
                        <button type="button" class="btn-action" id="btn-fc-undo" ${state.historyStack.length === 0 ? 'disabled' : ''} title="Quay lại thẻ trước (Backspace / Ctrl+Z)">
                            ↩️ Hoàn tác
                        </button>
                    </div>
                </div>

                <!-- Progress Track -->
                <div class="flashcard-progress-track">
                    <div class="flashcard-progress-bar" style="width: ${progressPercent}%;"></div>
                </div>

                <!-- 3D Perspective Scene -->
                <div class="flashcard-scene" id="flashcard-scene-box">
                    <div class="flashcard-card ${state.isFlipped ? 'is-flipped' : ''}" id="flashcard-card">
                        
                        <!-- FRONT FACE: Question + Options -->
                        <div class="flashcard-face flashcard-front">
                            <div class="flashcard-face-header">
                                <span class="fc-front-tag">💡 MẶT TRƯỚC - CÂU HỎI</span>
                                <span class="fc-click-hint">🖱️ Click hoặc nhấn Space để lật thẻ</span>
                            </div>

                            <div class="flashcard-body-content">
                                <div class="flashcard-question-text">
                                    ${safeQuestionText}
                                </div>

                                <div class="flashcard-options-list">
                                    ${optionsListHtml}
                                </div>
                            </div>

                            <div class="flashcard-face-footer">
                                <span class="fc-hint-txt">Hãy suy nghĩ và chọn đáp án trong đầu trước khi lật xem kết quả</span>
                                <button type="button" class="btn-action btn-primary btn-fc-flip" id="btn-flip-front">
                                    🔄 Lật thẻ xem đáp án (Space)
                                </button>
                            </div>
                        </div>

                        <!-- BACK FACE: Answer + Explanation + AI Tutor -->
                        <div class="flashcard-face flashcard-back">
                            <div class="flashcard-face-header">
                                <span class="fc-back-tag">✓ MẶT SAU - ĐÁP ÁN & GIẢI THÍCH</span>
                                <span class="fc-click-hint">🖱️ Click hoặc nhấn Space để lật lại</span>
                            </div>

                            <div class="flashcard-body-content">
                                <!-- Correct Answer Highlight Box -->
                                <div class="flashcard-correct-badge-card">
                                    <div class="fc-correct-title">🎯 ĐÁP ÁN ĐÚNG: ${correctLetters}</div>
                                    <div class="fc-correct-detail">${correctOptionsText}</div>
                                </div>

                                <!-- Explanation Box -->
                                ${safeExplanation ? `
                                    <div class="flashcard-explanation-card">
                                        <div class="fc-exp-header">📖 Lời giải chi tiết:</div>
                                        <div class="fc-exp-content">${safeExplanation}</div>
                                    </div>
                                ` : ''}

                                <!-- AI Tutor Prompt Button -->
                                <div class="flashcard-ai-cta-wrap">
                                    <button type="button" class="btn-action btn-fc-ai" id="btn-fc-ask-ai">
                                        🤖 Hỏi Gia sư AI (Phân tích bẫy tư duy & Mẹo giải nhanh 30s)
                                    </button>
                                    <div id="fc-ai-response-slot" style="margin-top: 12px;"></div>
                                </div>
                            </div>

                            <div class="flashcard-face-footer">
                                <button type="button" class="btn-action btn-fc-flip" id="btn-flip-back">
                                    🔄 Lật lại mặt trước
                                </button>
                            </div>
                        </div>

                    </div>
                </div>

                <!-- Bottom Decision Controls: Chưa thuộc vs Đã thuộc -->
                <div class="flashcard-controls-bar">
                    <button type="button" class="btn-fc-rate btn-fc-fail" id="btn-fc-unmastered" title="Phím tắt: 1 hoặc Mũi tên Trái">
                        <span class="fc-rate-icon">❌</span>
                        <div class="fc-rate-text">
                            <div class="fc-rate-label">Chưa thuộc</div>
                            <div class="fc-rate-shortcut">Phím [ ← ] hoặc [ 1 ]</div>
                        </div>
                    </button>

                    <button type="button" class="btn-fc-rate btn-fc-flip-mid" id="btn-fc-flip-mid" title="Phím tắt: Space">
                        <span class="fc-rate-icon">🔄</span>
                        <div class="fc-rate-text">
                            <div class="fc-rate-label">Lật thẻ</div>
                            <div class="fc-rate-shortcut">[ Space ]</div>
                        </div>
                    </button>

                    <button type="button" class="btn-fc-rate btn-fc-pass" id="btn-fc-mastered" title="Phím tắt: 2 hoặc Mũi tên Phải">
                        <span class="fc-rate-icon">✅</span>
                        <div class="fc-rate-text">
                            <div class="fc-rate-label">Đã thuộc</div>
                            <div class="fc-rate-shortcut">Phím [ → ] hoặc [ 2 ]</div>
                        </div>
                    </button>
                </div>
            </div>
        `;

        // Bind click events
        document.getElementById('flashcard-card')?.addEventListener('click', (e) => {
            // Prevent flip if clicked on interactive buttons or AI slot
            if (e.target.closest('button') || e.target.closest('.flashcard-ai-cta-wrap') || e.target.closest('a')) {
                return;
            }
            flip();
        });

        document.getElementById('btn-flip-front')?.addEventListener('click', (e) => {
            e.stopPropagation();
            flip();
        });
        document.getElementById('btn-flip-back')?.addEventListener('click', (e) => {
            e.stopPropagation();
            flip();
        });
        document.getElementById('btn-fc-flip-mid')?.addEventListener('click', () => flip());

        document.getElementById('btn-fc-unmastered')?.addEventListener('click', () => markCard(false));
        document.getElementById('btn-fc-mastered')?.addEventListener('click', () => markCard(true));
        document.getElementById('btn-fc-undo')?.addEventListener('click', () => undo());

        // Ask AI Tutor button on back face
        document.getElementById('btn-fc-ask-ai')?.addEventListener('click', (e) => {
            e.stopPropagation();
            const slot = document.getElementById('fc-ai-response-slot');
            if (slot && typeof AITutor !== 'undefined' && AITutor.askTutorForQuestion) {
                AITutor.askTutorForQuestion(qIndex, q, [], correctAnswers, slot);
            }
        });

        // Fast KaTeX typesetting
        if (typeof renderMathInElement === 'function') {
            renderMathInElement(container, {
                delimiters: [
                    { left: '$$', right: '$$', display: true },
                    { left: '$', right: '$', display: false },
                    { left: '\\(', right: '\\)', display: false },
                    { left: '\\[', right: '\\]', display: true }
                ],
                throwOnError: false
            });
        }
    }

    function renderSummary(container) {
        const total = state.questions.length;
        const masteredCount = state.masteredSet.size;
        const unmasteredCount = state.unmasteredSet.size;
        const rate = total > 0 ? Math.round((masteredCount / total) * 100) : 0;

        let gradeBadge = '🌟 Xuất sắc!';
        let gradeColor = '#22c55e';
        let gradeDesc = 'Bạn đã ghi nhớ toàn bộ kiến thức của bộ thẻ!';

        if (rate < 60) {
            gradeBadge = '⚡ Cần cố gắng!';
            gradeColor = '#f59e0b';
            gradeDesc = 'Hãy lặp lại vòng ôn ngắt quãng để củng cố các câu chưa thuộc.';
        } else if (rate < 90) {
            gradeBadge = '👍 Rất tốt!';
            gradeColor = '#3b82f6';
            gradeDesc = 'Chỉ còn một số ít câu cần rèn luyện thêm để đạt 100%!';
        }

        container.innerHTML = `
            <div class="flashcard-summary-card">
                <div style="font-size: 3.5em; margin-bottom: 8px;">🎉</div>
                <h2 style="margin: 0 0 6px; color: var(--heading-color);">Hoàn Thành Phiên Lật Thẻ!</h2>
                <p style="opacity: 0.8; margin: 0 0 20px; font-size: 0.95em;">${gradeDesc}</p>

                <div class="fc-summary-meter-wrap">
                    <div class="fc-summary-percent" style="color: ${gradeColor};">${rate}%</div>
                    <div class="fc-summary-badge" style="background: ${gradeColor}22; color: ${gradeColor}; border: 1px solid ${gradeColor}55;">
                        ${gradeBadge}
                    </div>
                </div>

                <div class="fc-summary-grid">
                    <div class="fc-sum-box fc-box-mastered">
                        <div class="fc-sum-num" style="color: #22c55e;">${masteredCount}</div>
                        <div class="fc-sum-lbl">Đã thuộc hoàn toàn</div>
                    </div>
                    <div class="fc-sum-box fc-box-unmastered">
                        <div class="fc-sum-num" style="color: #ef4444;">${unmasteredCount}</div>
                        <div class="fc-sum-lbl">Cần ôn lại ngắt quãng</div>
                    </div>
                    <div class="fc-sum-box">
                        <div class="fc-sum-num" style="color: var(--primary-color);">${total}</div>
                        <div class="fc-sum-lbl">Tổng số thẻ ghi nhớ</div>
                    </div>
                </div>

                <div class="fc-summary-actions">
                    ${unmasteredCount > 0 ? `
                        <button type="button" class="btn-action btn-primary btn-fc-action-main" id="btn-fc-retake-unmastered">
                            🔁 Ôn lại ngay ${unmasteredCount} câu chưa thuộc
                        </button>
                    ` : ''}
                    <button type="button" class="btn-action" id="btn-fc-restart-all">
                        🔄 Bắt đầu lại toàn bộ (${total} thẻ)
                    </button>
                    <button type="button" class="btn-action btn-success" id="btn-fc-switch-exam">
                        ⏱️ Chuyển sang Thi Thử (Kiểm tra thực chiến)
                    </button>
                </div>
            </div>
        `;

        document.getElementById('btn-fc-retake-unmastered')?.addEventListener('click', () => {
            retakeUnmasteredOnly();
        });

        document.getElementById('btn-fc-restart-all')?.addEventListener('click', () => {
            restartAll();
        });

        document.getElementById('btn-fc-switch-exam')?.addEventListener('click', () => {
            const modeSelect = document.getElementById('mode-selector');
            if (modeSelect) {
                modeSelect.value = 'exam';
                modeSelect.dispatchEvent(new Event('change'));
            }
        });
    }

    function setActive(active) {
        state.isActive = Boolean(active);
    }

    return {
        init,
        flip,
        markCard,
        undo,
        restartAll,
        retakeUnmasteredOnly,
        setActive,
        render
    };
})();

// Export for global usage
if (typeof window !== 'undefined') {
    window.FlashcardEngine = FlashcardEngine;
}
