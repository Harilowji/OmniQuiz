/**
 * quiz-engine.js - Core Business Logic & State Machine
 */
const QuizEngine = (() => {
    let state = {
        questions: [],
        userAnswers: {}, // { [qIndex]: [selectedIndices] }
        evaluatedQuestions: new Set(), // { qIndex }
        flaggedQuestions: new Set(),
        customImages: {}, // { [qIndex]: base64Data }
        currentMode: 'practice', // 'practice' | 'exam'
        currentTheme: 'academic',
        currentLang: 'vi',
        isSubmitted: false,
        durationMinutes: 60,
        timeLeft: 3600,
        targetEndTime: null,
        violationCount: 0,
        maxViolations: 3,
        violationLogs: [],
        incorrectQData: []
    };

    function setQuestions(newQuestions) {
        state.questions = newQuestions;
        state.userAnswers = {};
        state.evaluatedQuestions = new Set();
        state.flaggedQuestions.clear();
        state.customImages = {};
        state.isSubmitted = false;
        state.incorrectQData = [];
        state.violationCount = 0;
        state.violationLogs = [];
        state.timeLeft = state.durationMinutes > 0 ? state.durationMinutes * 60 : -1;
        state.targetEndTime = state.timeLeft > 0 ? (Date.now() + state.timeLeft * 1000) : null;
    }

    function setExamDuration(minutes) {
        const mins = parseInt(minutes, 10);
        state.durationMinutes = isNaN(mins) ? 60 : mins;
        state.timeLeft = state.durationMinutes > 0 ? state.durationMinutes * 60 : -1;
        state.targetEndTime = state.timeLeft > 0 ? (Date.now() + state.timeLeft * 1000) : null;
    }

    function syncTimeLeft() {
        if (state.timeLeft === -1 || !state.targetEndTime) return state.timeLeft;
        const remaining = Math.max(0, Math.round((state.targetEndTime - Date.now()) / 1000));
        state.timeLeft = remaining;
        return state.timeLeft;
    }

    function recordViolation(reason) {
        if (state.currentMode !== 'exam' || state.isSubmitted || !state.questions || state.questions.length === 0) {
            return null;
        }
        state.violationCount++;
        const logEntry = {
            time: new Date().toLocaleTimeString(),
            reason: reason || 'Rời màn hình thi (Chuyển tab / Mở ứng dụng khác)'
        };
        state.violationLogs.push(logEntry);
        return {
            count: state.violationCount,
            max: state.maxViolations,
            isExceeded: state.violationCount >= state.maxViolations,
            logEntry
        };
    }

    function createRetakeMistakesExam() {
        if (!state.questions || state.questions.length === 0) return null;

        const mistakeIndices = [];
        state.questions.forEach((q, idx) => {
            const userAns = state.userAnswers[idx] || [];
            if (userAns.length === 0) {
                mistakeIndices.push(idx); // Unattempted
            } else {
                const isCorrect = isAnswerCorrect(q, userAns);
                if (!isCorrect) {
                    mistakeIndices.push(idx); // Incorrect
                }
            }
        });

        if (mistakeIndices.length === 0) return null;

        // Clone mistake questions
        const filteredQuestions = mistakeIndices.map(idx => JSON.parse(JSON.stringify(state.questions[idx])));
        const filteredImages = {};
        mistakeIndices.forEach((oldIdx, newIdx) => {
            if (state.customImages && state.customImages[oldIdx]) {
                filteredImages[newIdx] = state.customImages[oldIdx];
            }
        });

        state.questions = filteredQuestions;
        state.customImages = filteredImages;
        state.userAnswers = {};
        state.evaluatedQuestions.clear();
        state.flaggedQuestions.clear();
        state.isSubmitted = false;
        state.incorrectQData = [];
        state.violationCount = 0;
        state.violationLogs = [];
        state.timeLeft = state.durationMinutes > 0 ? state.durationMinutes * 60 : -1;
        state.targetEndTime = state.timeLeft > 0 ? (Date.now() + state.timeLeft * 1000) : null;

        return {
            count: filteredQuestions.length
        };
    }

    function attachQuestionImage(qIndex, base64Data) {
        if (!state.customImages) state.customImages = {};
        state.customImages[qIndex] = base64Data;
    }

    function removeQuestionImage(qIndex) {
        if (state.customImages && state.customImages[qIndex]) {
            delete state.customImages[qIndex];
        }
    }

    function selectOption(qIndex, oIndex) {
        if (state.isSubmitted) return false;
        const q = state.questions[qIndex];
        if (!q) return false;

        // In practice mode, lock option changes if already evaluated
        if (state.currentMode === 'practice' && state.evaluatedQuestions.has(qIndex)) {
            return false;
        }

        const currentSelected = state.userAnswers[qIndex] ? [...state.userAnswers[qIndex]] : [];

        if (state.currentMode === 'practice') {
            if (q.type === 'single') {
                state.userAnswers[qIndex] = [oIndex];
            } else {
                const pos = currentSelected.indexOf(oIndex);
                if (pos > -1) currentSelected.splice(pos, 1);
                else currentSelected.push(oIndex);
                state.userAnswers[qIndex] = currentSelected;
            }
        } else {
            // Exam mode: allow updating selection freely
            if (q.type === 'single') {
                state.userAnswers[qIndex] = [oIndex];
            } else {
                const pos = currentSelected.indexOf(oIndex);
                if (pos > -1) currentSelected.splice(pos, 1);
                else currentSelected.push(oIndex);
                state.userAnswers[qIndex] = currentSelected;
            }
        }

        return true;
    }

    function toggleFlag(qIndex) {
        if (state.flaggedQuestions.has(qIndex)) {
            state.flaggedQuestions.delete(qIndex);
        } else {
            state.flaggedQuestions.add(qIndex);
        }
    }

    function isAnswerCorrect(q, selectedIndices) {
        if (!q || !Array.isArray(q.answers) || q.answers.length === 0) {
            return false;
        }
        if (!Array.isArray(selectedIndices) || selectedIndices.length === 0) {
            return false;
        }
        const cleanSelected = selectedIndices.map(Number).filter(n => !isNaN(n));
        const cleanAnswers = q.answers.map(Number).filter(n => !isNaN(n));

        const selSet = new Set(cleanSelected);
        const ansSet = new Set(cleanAnswers);

        if (cleanSelected.length !== selSet.size || selSet.size !== ansSet.size) {
            return false;
        }
        for (const val of ansSet) {
            if (!selSet.has(val)) return false;
        }
        return true;
    }

    function evaluateQuestion(qIndex) {
        const q = state.questions[qIndex];
        if (!q) return null;
        const sel = state.userAnswers[qIndex] || [];
        if (sel.length === 0) return null;

        state.evaluatedQuestions.add(qIndex);
        const correct = isAnswerCorrect(q, sel);
        if (!correct) {
            if (!state.incorrectQData.some(item => item.qIndex === qIndex)) {
                state.incorrectQData.push({ qIndex, q, userAnswers: sel, reason: 'incorrect' });
            }
        }
        return correct;
    }

    function shuffleQuestionOptions(q) {
        if (!q || !Array.isArray(q.options) || q.options.length <= 1) return;

        // Never shuffle options if any choice refers to other letters (e.g. "Cả A và B đều đúng", "All of the above")
        const hasRelativeOption = q.options.some(opt => {
            if (!opt || typeof opt !== 'string') return false;
            return /(?:cả|ca)\s+[a-d]|(?:tất\s+cả|tat\s+ca)(?:\s+(?:các|cac))?\s*(?:đáp|dap)\s*án|all\s+of\s+the\s+above|both\s+[a-d]|neither\s+[a-d]|none\s+of\s+the\s+above|(?:đáp|dap)\s*án\s+khác/i.test(opt);
        });
        if (hasRelativeOption) return;

        // Pair option text with correctness
        const indexedOpts = q.options.map((text, idx) => ({
            text,
            isCorrect: q.answers.includes(idx)
        }));

        // Fisher-Yates shuffle on options
        for (let i = indexedOpts.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [indexedOpts[i], indexedOpts[j]] = [indexedOpts[j], indexedOpts[i]];
        }

        q.options = indexedOpts.map(o => o.text);
        q.answers = [];
        indexedOpts.forEach((o, idx) => {
            if (o.isCorrect) q.answers.push(idx);
        });
    }

    function shuffle() {
        if (state.isSubmitted) return;

        // 1. Shuffle question order and maintain strict question-image pairing
        const paired = state.questions.map((q, idx) => ({
            question: q,
            image: (state.customImages && state.customImages[idx]) || q.image || null
        }));

        // Fisher-Yates shuffle on questions
        for (let i = paired.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [paired[i], paired[j]] = [paired[j], paired[i]];
        }

        // Reconstruct questions & re-map customImages
        state.questions = paired.map(p => p.question);
        state.customImages = {};
        paired.forEach((p, idx) => {
            if (p.image) {
                state.customImages[idx] = p.image;
                p.question.image = p.image;
            }
            // 2. Also randomize options within each question safely
            shuffleQuestionOptions(p.question);
        });

        // Reset answers and flags for a fresh randomized test
        state.userAnswers = {};
        state.evaluatedQuestions.clear();
        state.flaggedQuestions.clear();
        state.incorrectQData = [];
    }

    function calculateResults() {
        let correct = 0;
        let incorrectAttempted = 0;
        let unattempted = 0;
        state.incorrectQData = [];

        state.questions.forEach((q, qIndex) => {
            const sel = state.userAnswers[qIndex] || [];
            if (sel.length > 0) {
                if (isAnswerCorrect(q, sel)) {
                    correct++;
                } else {
                    incorrectAttempted++;
                    state.incorrectQData.push({ qIndex, q, userAnswers: sel, reason: 'incorrect' });
                }
            } else {
                unattempted++;
                state.incorrectQData.push({ qIndex, q, userAnswers: [], reason: 'unattempted' });
            }
        });

        const total = state.questions.length;
        const totalIncorrect = incorrectAttempted + unattempted;
        const answered = total - unattempted;
        const score100 = total > 0 ? Math.round((correct / total) * 100) : 0;
        const score10 = total > 0 ? ((correct / total) * 10).toFixed(2) : '0.00';

        const durationSpent = (state.durationMinutes > 0 && state.timeLeft >= 0)
            ? Math.max(0, (state.durationMinutes * 60) - state.timeLeft)
            : 0;
        const pacingSeconds = (answered > 0 && durationSpent > 0)
            ? Math.round(durationSpent / answered)
            : (total > 0 && durationSpent > 0 ? Math.round(durationSpent / total) : 0);

        let pacingDisplay = '--';
        if (pacingSeconds > 0) {
            const pm = Math.floor(pacingSeconds / 60);
            const ps = pacingSeconds % 60;
            pacingDisplay = pm > 0 ? `${pm}m ${ps}s` : `${ps}s`;
        }

        return {
            total,
            answered,
            correct,
            incorrect: incorrectAttempted,
            unattempted,
            totalIncorrect,
            score100,
            score10,
            durationSpent,
            pacingSeconds,
            pacingDisplay,
            violations: state.violationCount,
            violationLogs: state.violationLogs
        };
    }

    function exportPDFReport() {
        const container = document.createElement('div');
        container.style.padding = '25px';
        container.style.fontFamily = 'Arial, sans-serif';
        container.style.color = '#0f172a';
        container.style.background = '#ffffff';

        let html = `<h1 style="text-align:center; color:#1e3a8a; margin-bottom:6px;">${t('pdfReportTitle')}</h1>`;
        html += `<p style="text-align:center; color:#64748b; font-size:12px; margin-bottom:25px;">Exported on: ${new Date().toLocaleString()}</p>`;

        if (state.incorrectQData.length === 0) {
            html += `<p style="text-align:center; color:#16a34a; font-size:16px; margin:40px 0;"><strong>${t('pdfOutstanding')}</strong></p>`;
        } else {
            const incorrectCount = state.incorrectQData.filter(i => i.reason === 'incorrect').length;
            const unattemptedCount = state.incorrectQData.filter(i => i.reason === 'unattempted').length;
            const breakdown = (unattemptedCount > 0 && incorrectCount > 0)
                ? `(${state.incorrectQData.length} câu: ${incorrectCount} làm sai, ${unattemptedCount} chưa làm)`
                : `(${state.incorrectQData.length} câu)`;

            html += `<h3 style="border-bottom:2px solid #ef4444; padding-bottom:6px; color:#ef4444; margin-bottom:18px;">${t('pdfReviewSection')} ${breakdown}</h3>`;
            state.incorrectQData.forEach(item => {
                const q = item.q;
                const correctTexts = q.answers.map(idx => q.options[idx]).join(' | ');
                const safeQ = (typeof QuestionParser !== 'undefined' && QuestionParser.formatMathText) ? QuestionParser.formatMathText(q.q) : q.q;
                const safeAns = (typeof QuestionParser !== 'undefined' && QuestionParser.formatMathText) ? QuestionParser.formatMathText(correctTexts) : correctTexts;
                const imgData = (state.customImages && state.customImages[item.qIndex]) || q.image || null;
                const imgHtml = imgData ? `<div style="text-align:center; margin:10px 0;"><img src="${imgData}" style="max-width:100%; max-height:220px; border-radius:6px; border:1px solid #cbd5e1; object-fit:contain;"></div>` : '';
                
                let expHtml = '';
                if (q.explanation && q.explanation.trim().length > 0) {
                    const safeExp = (typeof QuestionParser !== 'undefined' && QuestionParser.formatMathText) ? QuestionParser.formatMathText(q.explanation) : q.explanation;
                    expHtml = `
                        <div style="color:#334155; font-size:13px; background:#e2e8f0; padding:8px 12px; border-radius:4px; margin-top:6px;">
                            <strong>${t('explanation')}</strong> ${safeExp}
                        </div>
                    `;
                }

                const statusTag = item.reason === 'unattempted'
                    ? `<span style="background:#e2e8f0; color:#475569; padding:2px 8px; border-radius:4px; font-size:11px; margin-left:8px; font-weight:normal;">[${t('badgeUnattempted') || 'Chưa làm'}]</span>`
                    : `<span style="background:#fee2e2; color:#dc2626; padding:2px 8px; border-radius:4px; font-size:11px; margin-left:8px; font-weight:normal;">[${t('badgeIncorrect') || 'Làm sai'}]</span>`;

                html += `
                    <div style="margin-bottom: 20px; padding: 15px; border: 1px solid #cbd5e1; border-radius: 6px; page-break-inside: avoid; background:#f8fafc;">
                        <div style="font-weight:bold; font-size:14px; margin-bottom:8px; color:#0f172a;">
                            ${t('questionLabel') || 'Câu'} ${item.qIndex + 1}: ${safeQ} ${statusTag}
                        </div>
                        ${imgHtml}
                        <div style="color:#15803d; font-size:13px; margin-bottom:6px;">
                            <strong>${t('correctAnswer')}</strong> ${safeAns}
                        </div>
                        ${expHtml}
                    </div>
                `;
            });
        }

        container.innerHTML = html;
        container.style.position = 'absolute';
        container.style.left = '-9999px';
        document.body.appendChild(container);

        const opt = {
            margin: 10,
            filename: 'OmniQuiz_Performance_Report.pdf',
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2 },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };

        const renderPDF = () => {
            html2pdf().set(opt).from(container).save().then(() => {
                document.body.removeChild(container);
            });
        };

        if (window.MathJax) {
            MathJax.typesetPromise([container]).then(renderPDF).catch(renderPDF);
        } else {
            renderPDF();
        }
    }

    return {
        state,
        setQuestions,
        attachQuestionImage,
        removeQuestionImage,
        selectOption,
        toggleFlag,
        isAnswerCorrect,
        evaluateQuestion,
        shuffle,
        calculateResults,
        exportPDFReport,
        setExamDuration,
        syncTimeLeft,
        recordViolation,
        createRetakeMistakesExam
    };
})();
