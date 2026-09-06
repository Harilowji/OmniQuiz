/**
 * quiz-engine.js - Core Business Logic & State Machine
 */
const QuizEngine = (() => {
    let state = {
        questions: [],
        userAnswers: {}, // { [qIndex]: [selectedIndices] }
        flaggedQuestions: new Set(),
        customImages: {}, // { [qIndex]: base64Data }
        currentMode: 'practice', // 'practice' | 'exam'
        currentTheme: 'academic',
        currentLang: 'vi',
        isSubmitted: false,
        timeLeft: 3600,
        incorrectQData: []
    };

    function setQuestions(newQuestions) {
        state.questions = newQuestions;
        state.userAnswers = {};
        state.flaggedQuestions.clear();
        state.customImages = {};
        state.isSubmitted = false;
        state.incorrectQData = [];
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

        const currentSelected = state.userAnswers[qIndex] ? [...state.userAnswers[qIndex]] : [];

        if (state.currentMode === 'practice') {
            if (q.type === 'single') {
                if (currentSelected.length > 0) return false; // Already locked
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
        if (!q || !Array.isArray(selectedIndices) || selectedIndices.length !== q.answers.length) {
            return false;
        }
        return q.answers.every(ans => selectedIndices.includes(ans));
    }

    function evaluateQuestion(qIndex) {
        const q = state.questions[qIndex];
        const sel = state.userAnswers[qIndex] || [];
        if (sel.length === 0) return null;

        const correct = isAnswerCorrect(q, sel);
        if (!correct) {
            if (!state.incorrectQData.some(item => item.qIndex === qIndex)) {
                state.incorrectQData.push({ qIndex, q });
            }
        }
        return correct;
    }

    function shuffle() {
        if (state.isSubmitted) return;

        // Pair each question with its custom image so they never get disconnected
        const paired = state.questions.map((q, idx) => ({
            question: q,
            image: (state.customImages && state.customImages[idx]) || q.image || null
        }));

        // Fisher-Yates shuffle
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
        });

        // Reset answers
        state.userAnswers = {};
        state.flaggedQuestions.clear();
        state.incorrectQData = [];
    }

    function calculateResults() {
        let correct = 0;
        let answered = 0;
        state.incorrectQData = [];

        state.questions.forEach((q, qIndex) => {
            const sel = state.userAnswers[qIndex] || [];
            if (sel.length > 0) {
                answered++;
                if (isAnswerCorrect(q, sel)) {
                    correct++;
                } else {
                    state.incorrectQData.push({ qIndex, q });
                }
            } else {
                state.incorrectQData.push({ qIndex, q });
            }
        });

        const unattempted = state.questions.length - answered;
        const score100 = state.questions.length > 0 ? Math.round((correct / state.questions.length) * 100) : 0;

        return {
            total: state.questions.length,
            answered,
            correct,
            incorrect: answered - correct,
            unattempted,
            score100
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
            html += `<h3 style="border-bottom:2px solid #ef4444; padding-bottom:6px; color:#ef4444; margin-bottom:18px;">${t('pdfReviewSection')} (${state.incorrectQData.length})</h3>`;
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

                html += `
                    <div style="margin-bottom: 20px; padding: 15px; border: 1px solid #cbd5e1; border-radius: 6px; page-break-inside: avoid; background:#f8fafc;">
                        <div style="font-weight:bold; font-size:14px; margin-bottom:8px; color:#0f172a;">
                            ${t('questionLabel') || 'Câu'} ${item.qIndex + 1}: ${safeQ}
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
        exportPDFReport
    };
})();
