/**
 * ui.js - User Interface & DOM Rendering Module
 */
const UIManager = (() => {
    let currentPaletteFilter = 'all';

    function renderQuestionsList(
        questions, 
        userAnswers, 
        flaggedQuestions, 
        mode, 
        isSubmitted, 
        onOptionClick, 
        onFlagClick, 
        onCheckAnswer, 
        customImages = {}, 
        onAttachImage = null, 
        onRemoveImage = null,
        evaluatedQuestions = null
    ) {
        const container = document.getElementById('quiz-container');
        if (!container) return;
        container.innerHTML = '';

        questions.forEach((q, qIndex) => {
            const block = document.createElement('div');
            block.className = 'question-block';
            block.id = 'qblock-' + qIndex;

            const selected = userAnswers[qIndex] || [];
            const hasAnswered = selected.length > 0;
            const isFlagged = flaggedQuestions.has(qIndex);
            const isEvaluated = isSubmitted || (mode === 'practice' && evaluatedQuestions && evaluatedQuestions.has(qIndex));

            // Header
            const header = document.createElement('div');
            header.className = 'q-header';

            const title = document.createElement('div');
            title.className = 'question-title';
            const safeQText = (typeof QuestionParser !== 'undefined' && QuestionParser.formatMathText) 
                ? QuestionParser.formatMathText(q.q) 
                : q.q;
            title.innerHTML = `Q${qIndex + 1}. ${safeQText}`;

            if (isEvaluated) {
                const badge = document.createElement('span');
                if (hasAnswered) {
                    if (QuizEngine.isAnswerCorrect(q, selected)) {
                        badge.className = 'badge-q-status badge-q-correct';
                        badge.innerText = '✓ ' + (t('badgeCorrect') || 'Đúng');
                    } else {
                        badge.className = 'badge-q-status badge-q-incorrect';
                        badge.innerText = '✗ ' + (t('badgeIncorrect') || 'Sai');
                    }
                } else if (isSubmitted) {
                    badge.className = 'badge-q-status badge-q-unattempted';
                    badge.innerText = '⚪ ' + (t('badgeUnattempted') || 'Chưa làm');
                }
                title.appendChild(badge);
            } else if (q.isDefaultAnswer) {
                const badge = document.createElement('span');
                badge.className = 'badge-no-answer';
                badge.innerText = '⚠️ ' + (t('noAnswerDeclared') || 'Chưa có đáp án');
                title.appendChild(badge);
            }
            header.appendChild(title);

            const flagBtn = document.createElement('button');
            flagBtn.className = 'flag-btn' + (isFlagged ? ' active' : '');
            flagBtn.innerHTML = (isFlagged ? '🚩 ' : '🏳️ ') + (isFlagged ? (t('flagActive') || 'Đã gắn cờ') : (t('reviewFlag') || 'Xem lại'));
            flagBtn.onclick = () => onFlagClick(qIndex);
            header.appendChild(flagBtn);
            block.appendChild(header);

            // Custom Attached Image
            if (customImages && customImages[qIndex]) {
                const imgWrap = document.createElement('div');
                imgWrap.className = 'custom-q-image-wrap';
                imgWrap.id = 'custom-img-' + qIndex;

                const img = document.createElement('img');
                img.className = 'quiz-img';
                img.src = customImages[qIndex];
                img.alt = `Ảnh minh họa Câu ${qIndex + 1}`;
                imgWrap.appendChild(img);

                const removeBtn = document.createElement('button');
                removeBtn.className = 'btn-remove-img';
                removeBtn.innerHTML = '✕ Gỡ';
                removeBtn.title = 'Gỡ ảnh minh họa này';
                removeBtn.onclick = (e) => {
                    e.stopPropagation();
                    if (typeof onRemoveImage === 'function') {
                        onRemoveImage(qIndex);
                    }
                };
                imgWrap.appendChild(removeBtn);

                block.appendChild(imgWrap);
            }

            // Help Text
            const helpText = document.createElement('div');
            helpText.className = 'help-text';
            helpText.innerText = q.type === 'multiple' ? t('multipleHelp') : t('singleHelp');
            block.appendChild(helpText);

            // Options List
            const optContainer = document.createElement('div');
            optContainer.className = 'options-container';
            if (isEvaluated) {
                optContainer.classList.add('disabled-options');
            }

            q.options.forEach((optText, oIndex) => {
                const optDiv = document.createElement('div');
                optDiv.className = 'option';

                const isSelected = selected.includes(oIndex);
                const isCorrect = q.answers.map(Number).includes(oIndex);

                if (isSelected) optDiv.classList.add('selected');

                if (isEvaluated) {
                    if (isCorrect) optDiv.classList.add('correct');
                    else if (isSelected) optDiv.classList.add('incorrect');
                }

                // WCAG 2.1 AA Keyboard & Screen Reader Accessibility
                optDiv.setAttribute('tabindex', '0');
                optDiv.setAttribute('role', q.type === 'multiple' ? 'checkbox' : 'radio');
                optDiv.setAttribute('aria-checked', isSelected ? 'true' : 'false');
                const plainOptText = optText.replace(/<[^>]+>/g, '').trim();
                optDiv.setAttribute('aria-label', `${String.fromCharCode(65 + oIndex)}. ${plainOptText}`);

                // Keyboard activation with Space or Enter
                optDiv.addEventListener('keydown', (e) => {
                    if (e.key === ' ' || e.key === 'Enter') {
                        e.preventDefault();
                        onOptionClick(qIndex, oIndex);
                    }
                });

                const indicator = document.createElement('span');
                indicator.className = 'option-indicator';
                indicator.innerText = String.fromCharCode(65 + oIndex); // A, B, C, D
                optDiv.appendChild(indicator);

                const textSpan = document.createElement('span');
                const safeOptText = (typeof QuestionParser !== 'undefined' && QuestionParser.formatMathText) 
                    ? QuestionParser.formatMathText(optText) 
                    : optText;
                textSpan.innerHTML = safeOptText;
                optDiv.appendChild(textSpan);

                optDiv.onclick = () => onOptionClick(qIndex, oIndex);
                optContainer.appendChild(optDiv);
            });
            block.appendChild(optContainer);

            // Practice Mode: Check Answer Button for Multiple Choice
            if (q.type === 'multiple' && mode === 'practice' && !isEvaluated) {
                const checkBtn = document.createElement('button');
                checkBtn.className = 'btn-action btn-primary btn-check-answer';
                checkBtn.style.marginTop = '15px';
                checkBtn.innerText = t('checkAnswer');
                checkBtn.onclick = () => onCheckAnswer(qIndex);
                block.appendChild(checkBtn);
            }

            // Explanation box
            const expDiv = document.createElement('div');
            expDiv.className = 'explanation';
            expDiv.id = 'exp-' + qIndex;
            const safeExpText = (typeof QuestionParser !== 'undefined' && QuestionParser.formatMathText) 
                ? QuestionParser.formatMathText(q.explanation) 
                : q.explanation;
            const hasExpText = q.explanation && q.explanation.trim().length > 0;
            expDiv.innerHTML = `<strong>${t('explanation')}</strong> ${safeExpText}`;
            if (isEvaluated && hasExpText) {
                expDiv.style.display = 'block';
            } else {
                expDiv.style.display = 'none';
            }
            block.appendChild(expDiv);

            // Azota Question Navigation Footer (Previous / Counter / Next)
            const navFooter = document.createElement('div');
            navFooter.className = 'q-nav-footer';

            const prevBtn = document.createElement('button');
            prevBtn.className = 'btn-q-nav';
            prevBtn.innerHTML = '◀ ' + (t('prevQuestion') || 'Câu trước');
            prevBtn.disabled = qIndex === 0;
            prevBtn.onclick = () => scrollToQuestion(qIndex - 1);
            navFooter.appendChild(prevBtn);

            const counterPill = document.createElement('div');
            counterPill.className = 'q-indicator-pill';
            counterPill.innerText = `${t('questionLabel') || 'Câu'} ${qIndex + 1} / ${questions.length}`;
            navFooter.appendChild(counterPill);

            const nextBtn = document.createElement('button');
            nextBtn.className = 'btn-q-nav' + (qIndex < questions.length - 1 ? ' btn-next-main' : '');
            nextBtn.innerHTML = (t('nextQuestion') || 'Câu sau') + ' ▶';
            nextBtn.disabled = qIndex === questions.length - 1;
            nextBtn.onclick = () => scrollToQuestion(qIndex + 1);
            navFooter.appendChild(nextBtn);

            block.appendChild(navFooter);

            container.appendChild(block);
        });

        // Initialize scroll spy after rendering
        setupScrollSpy(questions);

        // Ultra-Fast KaTeX Math & Chemistry Rendering with Progressive MathJax Fallback
        typesetMath(container);
    }

    let mathObserver = null;

    function typesetMath(container) {
        if (!container) return;

        // 1. Fast Synchronous KaTeX rendering (Instantaneous, eliminates math freezing/broken formulas)
        if (typeof renderMathInElement === 'function') {
            try {
                renderMathInElement(container, {
                    delimiters: [
                        { left: '$$', right: '$$', display: true },
                        { left: '$', right: '$', display: false },
                        { left: '\\(', right: '\\)', display: false },
                        { left: '\\[', right: '\\]', display: true }
                    ],
                    throwOnError: false,
                    ignoredTags: ['script', 'noscript', 'style', 'textarea', 'pre', 'code']
                });
                return;
            } catch (e) {
                console.warn('[KaTeX] Render error, falling back to MathJax:', e);
            }
        }

        // 2. Fallback to MathJax 3 Progressive Typesetting
        typesetMathJaxProgressively(container);
    }

    function typesetMathJaxProgressively(container) {
        if (!container || !window.MathJax || typeof MathJax.typesetPromise !== 'function') return;

        if (mathObserver) {
            mathObserver.disconnect();
            mathObserver = null;
        }

        const blocks = Array.from(container.querySelectorAll('.question-block'));
        if (blocks.length === 0) return;

        // Fast path: if 5 questions or fewer, typeset all together
        if (blocks.length <= 5) {
            MathJax.typesetPromise([container]).catch(() => {});
            return;
        }

        // Medium/large exam: immediately typeset first 3 visible questions
        const immediateBatch = blocks.slice(0, 3);
        MathJax.typesetPromise(immediateBatch).catch(() => {});

        // Progressive rendering via IntersectionObserver
        if ('IntersectionObserver' in window) {
            mathObserver = new IntersectionObserver((entries, observer) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        observer.unobserve(entry.target);
                        if (window.MathJax && typeof MathJax.typesetPromise === 'function') {
                            MathJax.typesetPromise([entry.target]).catch(() => {});
                        }
                    }
                });
            }, { rootMargin: '350px 0px' });

            blocks.slice(3).forEach(b => mathObserver.observe(b));
        } else {
            let idx = 3;
            function processNextChunk() {
                if (idx >= blocks.length) return;
                const chunk = blocks.slice(idx, idx + 4);
                idx += 4;
                MathJax.typesetPromise(chunk).then(() => {
                    setTimeout(processNextChunk, 80);
                }).catch(() => {
                    setTimeout(processNextChunk, 80);
                });
            }
            setTimeout(processNextChunk, 100);
        }
    }

    function updateSingleQuestion(qIndex, questions, userAnswers, flaggedQuestions, mode, isSubmitted, evaluatedQuestions) {
        const block = document.getElementById('qblock-' + qIndex);
        if (!block) return;
        const q = questions[qIndex];
        if (!q) return;

        const selected = userAnswers[qIndex] || [];
        const hasAnswered = selected.length > 0;
        const isFlagged = flaggedQuestions.has(qIndex);
        const isEvaluated = isSubmitted || (mode === 'practice' && evaluatedQuestions && evaluatedQuestions.has(qIndex));

        // Update Flag button
        const flagBtn = block.querySelector('.flag-btn');
        if (flagBtn) {
            flagBtn.className = 'flag-btn' + (isFlagged ? ' active' : '');
            flagBtn.innerHTML = (isFlagged ? '🚩 ' : '🏳️ ') + (isFlagged ? (t('flagActive') || 'Đã gắn cờ') : (t('reviewFlag') || 'Xem lại'));
        }

        // Update Header Status Badge
        const titleEl = block.querySelector('.question-title');
        if (titleEl) {
            const oldBadge = titleEl.querySelector('.badge-q-status');
            if (oldBadge) oldBadge.remove();

            if (isEvaluated) {
                const badge = document.createElement('span');
                if (hasAnswered) {
                    if (QuizEngine.isAnswerCorrect(q, selected)) {
                        badge.className = 'badge-q-status badge-q-correct';
                        badge.innerText = '✓ ' + (t('badgeCorrect') || 'Đúng');
                    } else {
                        badge.className = 'badge-q-status badge-q-incorrect';
                        badge.innerText = '✗ ' + (t('badgeIncorrect') || 'Sai');
                    }
                } else if (isSubmitted) {
                    badge.className = 'badge-q-status badge-q-unattempted';
                    badge.innerText = '⚪ ' + (t('badgeUnattempted') || 'Chưa làm');
                }
                titleEl.appendChild(badge);
            }
        }

        // Update Options
        const optContainer = block.querySelector('.options-container');
        if (optContainer) {
            if (isEvaluated) {
                optContainer.classList.add('disabled-options');
            } else {
                optContainer.classList.remove('disabled-options');
            }

            const optDivs = optContainer.querySelectorAll('.option');
            optDivs.forEach((optDiv, oIndex) => {
                const isSelected = selected.includes(oIndex);
                const isCorrect = q.answers.map(Number).includes(oIndex);

                optDiv.classList.remove('selected', 'correct', 'incorrect');
                if (isSelected) optDiv.classList.add('selected');
                optDiv.setAttribute('aria-checked', isSelected ? 'true' : 'false');

                if (isEvaluated) {
                    if (isCorrect) optDiv.classList.add('correct');
                    else if (isSelected) optDiv.classList.add('incorrect');
                }
            });
        }

        // Multiple choice check answer button
        const checkBtn = block.querySelector('.btn-check-answer');
        if (checkBtn) {
            checkBtn.style.display = (q.type === 'multiple' && mode === 'practice' && !isEvaluated) ? 'inline-flex' : 'none';
        }

        // Update explanation
        const expDiv = document.getElementById('exp-' + qIndex);
        if (expDiv) {
            const hasExpText = q.explanation && q.explanation.trim().length > 0;
            expDiv.style.display = (isEvaluated && hasExpText) ? 'block' : 'none';
        }
    }

    let activeViewingQuestionIndex = 0;
    let scrollObserver = null;

    function renderPalette(questions, userAnswers, flaggedQuestions, mode, isSubmitted, onSelectQuestion, evaluatedQuestions) {
        const grid = document.getElementById('palette-grid');
        if (!grid) return;

        // Create buttons once to eliminate DOM destruction & layout jitter
        if (grid.children.length !== questions.length) {
            grid.innerHTML = '';
            questions.forEach((q, qIndex) => {
                const btn = document.createElement('button');
                btn.className = 'palette-btn';
                btn.id = 'pbtn-' + qIndex;
                btn.innerText = qIndex + 1;
                btn.setAttribute('aria-label', `Question ${qIndex + 1}`);
                btn.onclick = () => {
                    onSelectQuestion(qIndex);
                    closeMobilePalette();
                };
                grid.appendChild(btn);
            });
        }

        let countAnswered = 0;
        const countFlagged = flaggedQuestions.size;

        questions.forEach((q, qIndex) => {
            const btn = document.getElementById('pbtn-' + qIndex);
            if (!btn) return;

            const answers = userAnswers[qIndex] || [];
            const hasAnswered = answers.length > 0;
            const isFlagged = flaggedQuestions.has(qIndex);
            const isEvaluated = isSubmitted || (mode === 'practice' && evaluatedQuestions && evaluatedQuestions.has(qIndex));

            if (hasAnswered) countAnswered++;

            // Preserve current-viewing state
            const isCurrentViewing = qIndex === activeViewingQuestionIndex;
            btn.className = 'palette-btn' + (isCurrentViewing ? ' current-viewing' : '');

            if (isFlagged) btn.classList.add('flagged');

            if (isEvaluated) {
                if (hasAnswered) {
                    const correct = QuizEngine.isAnswerCorrect(q, answers);
                    if (correct) btn.classList.add('correct');
                    else btn.classList.add('incorrect');
                } else {
                    btn.classList.add('unattempted');
                }
            } else if (hasAnswered) {
                if (mode === 'practice' && q.type === 'multiple') {
                    btn.classList.add('in-progress');
                } else {
                    btn.classList.add('answered-exam');
                }
            }

            // Filter visibility
            let visible = true;
            if (currentPaletteFilter === 'answered' && !hasAnswered) visible = false;
            if (currentPaletteFilter === 'unanswered' && hasAnswered) visible = false;
            if (currentPaletteFilter === 'flagged' && !isFlagged) visible = false;

            btn.style.display = visible ? 'flex' : 'none';
        });

        // Update filter chips counts
        const fltAll = document.getElementById('flt-all');
        const fltAns = document.getElementById('flt-answered');
        const fltFlg = document.getElementById('flt-flagged');
        const fltUna = document.getElementById('flt-unanswered');

        if (fltAll) fltAll.innerText = `${t('fltAll')} (${questions.length})`;
        if (fltAns) fltAns.innerText = `${t('fltAnswered')} (${countAnswered})`;
        if (fltFlg) fltFlg.innerText = `${t('fltFlagged')} (${countFlagged})`;
        if (fltUna) fltUna.innerText = `${t('fltUnanswered')} (${questions.length - countAnswered})`;

        // Azota Circular Progress Gauge (circumference for r=13 is ~81.68)
        const pctVal = questions.length > 0 ? (countAnswered / questions.length) : 0;
        const circle = document.getElementById('palette-progress-circle');
        if (circle) {
            circle.style.strokeDashoffset = 81.68 * (1 - pctVal);
        }

        const badge = document.getElementById('palette-completion-badge');
        if (badge) badge.innerText = Math.round(pctVal * 100) + '%';

        // Mobile FAB answered counter
        const fabAns = document.getElementById('fab-answered-count');
        const fabTot = document.getElementById('fab-total-count');
        if (fabAns) fabAns.innerText = countAnswered;
        if (fabTot) fabTot.innerText = questions.length;
    }

    function setActiveQuestion(qIndex) {
        if (activeViewingQuestionIndex === qIndex) return;
        activeViewingQuestionIndex = qIndex;

        document.querySelectorAll('.palette-btn.current-viewing').forEach(el => {
            el.classList.remove('current-viewing');
        });
        const currentBtn = document.getElementById('pbtn-' + qIndex);
        if (currentBtn) {
            currentBtn.classList.add('current-viewing');
        }
    }

    function popAnsweredPaletteButton(qIndex) {
        const btn = document.getElementById('pbtn-' + qIndex);
        if (btn) {
            btn.classList.remove('just-answered');
            void btn.offsetWidth;
            btn.classList.add('just-answered');
        }
    }

    function setupScrollSpy(questions) {
        if (scrollObserver) {
            scrollObserver.disconnect();
        }

        if (!('IntersectionObserver' in window)) return;

        scrollObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const id = entry.target.id;
                    if (id && id.startsWith('qblock-')) {
                        const qIndex = parseInt(id.replace('qblock-', ''), 10);
                        if (!isNaN(qIndex)) {
                            setActiveQuestion(qIndex);
                        }
                    }
                }
            });
        }, {
            root: null,
            rootMargin: "-20% 0px -50% 0px",
            threshold: 0.1
        });

        document.querySelectorAll('.question-block').forEach(el => {
            scrollObserver.observe(el);
        });
    }

    function toggleMobilePalette() {
        const sidebar = document.getElementById('palette-section');
        if (sidebar) {
            sidebar.classList.toggle('mobile-drawer');
            const closeBtn = document.getElementById('btn-close-palette-drawer');
            if (closeBtn) {
                closeBtn.style.display = sidebar.classList.contains('mobile-drawer') ? 'inline-flex' : 'none';
            }
        }
    }

    function closeMobilePalette() {
        const sidebar = document.getElementById('palette-section');
        if (sidebar && sidebar.classList.contains('mobile-drawer')) {
            sidebar.classList.remove('mobile-drawer');
            const closeBtn = document.getElementById('btn-close-palette-drawer');
            if (closeBtn) closeBtn.style.display = 'none';
        }
    }

    function setFilter(filterName, onFilterChange) {
        currentPaletteFilter = filterName;
        document.querySelectorAll('.filter-chip').forEach(el => el.classList.remove('active'));
        const target = document.getElementById('flt-' + filterName);
        if (target) target.classList.add('active');
        if (typeof onFilterChange === 'function') onFilterChange();
    }

    function updateStats(questions, userAnswers, mode, isSubmitted, evaluatedQuestions) {
        let answered = 0;
        let correct = 0;
        let incorrect = 0;
        let unattempted = 0;

        questions.forEach((q, qIndex) => {
            const ans = userAnswers[qIndex] || [];
            const hasAns = ans.length > 0;
            if (hasAns) answered++;
            else unattempted++;

            const isEvaluated = isSubmitted || (mode === 'practice' && evaluatedQuestions && evaluatedQuestions.has(qIndex));
            if (isEvaluated) {
                if (hasAns) {
                    if (QuizEngine.isAnswerCorrect(q, ans)) {
                        correct++;
                    } else {
                        incorrect++;
                    }
                }
            }
        });

        const elAnswered = document.getElementById('total-answered');
        const elTotal = document.getElementById('total-questions');
        const elCorrect = document.getElementById('correct-count');
        const elIncorrect = document.getElementById('incorrect-count');
        const elUnattempted = document.getElementById('unattempted-count');
        const wrapUnattempted = document.getElementById('stat-unattempted-wrap');
        const elBar = document.getElementById('quiz-progress-bar');

        if (elAnswered) elAnswered.innerText = answered;
        if (elTotal) elTotal.innerText = questions.length;

        if (mode === 'practice' || isSubmitted) {
            if (elCorrect) elCorrect.innerText = correct;
            if (elIncorrect) elIncorrect.innerText = incorrect;
            if (isSubmitted) {
                if (wrapUnattempted) wrapUnattempted.style.display = 'inline';
                if (elUnattempted) elUnattempted.innerText = unattempted;
            } else {
                if (wrapUnattempted) wrapUnattempted.style.display = 'none';
            }
        } else {
            if (elCorrect) elCorrect.innerText = '-';
            if (elIncorrect) elIncorrect.innerText = '-';
            if (wrapUnattempted) wrapUnattempted.style.display = 'none';
        }

        const pct = questions.length > 0 ? (answered / questions.length) * 100 : 0;
        if (elBar) elBar.style.width = pct + '%';
    }

    function scrollToQuestion(qIndex) {
        const block = document.getElementById('qblock-' + qIndex);
        if (block) {
            block.scrollIntoView({ behavior: 'smooth', block: 'start' });
            block.classList.remove('target-pulse');
            void block.offsetWidth;
            block.classList.add('target-pulse');
            setActiveQuestion(qIndex);
        }
    }

    function showSummaryModal(results, isTimeout) {
        const modal = document.getElementById('summary-modal');
        if (!modal) return;

        document.getElementById('modal-title').innerText = isTimeout ? t('modalTitleTimeout') : t('modalTitleDone');
        document.getElementById('modal-score').innerText = results.score100;
        document.getElementById('modal-correct').innerText = results.correct;
        document.getElementById('modal-incorrect').innerText = results.incorrect;
        document.getElementById('modal-unattempted').innerText = results.unattempted;

        const subEl = document.getElementById('modal-subtitle');
        if (subEl) {
            const score10Text = results.score10 ? ` • ${results.score10}/10 đ` : '';
            subEl.innerText = `${t('modalSubtitle')}${score10Text}`;
        }

        // Retake incorrect questions button
        const retakeBtn = document.getElementById('txt-modal-retake');
        if (retakeBtn) {
            const totalMissed = (results.incorrect || 0) + (results.unattempted || 0);
            if (totalMissed > 0) {
                retakeBtn.style.display = 'inline-flex';
                if (results.unattempted > 0 && results.incorrect > 0) {
                    retakeBtn.innerText = t('btnRetakeMixed', totalMissed, results.incorrect, results.unattempted);
                } else if (results.unattempted > 0) {
                    retakeBtn.innerText = t('btnRetakeUnattempted', results.unattempted);
                } else {
                    retakeBtn.innerText = t('btnRetakeIncorrect', results.incorrect);
                }
            } else {
                retakeBtn.style.display = 'none';
            }
        }

        // Violations count stat box
        const vioBox = document.getElementById('modal-box-violations');
        const vioNum = document.getElementById('modal-violations');
        if (vioBox && vioNum) {
            if (results.violations !== undefined && results.violations > 0) {
                vioBox.style.display = 'block';
                vioNum.innerText = results.violations;
                vioNum.style.color = '#ef4444';
            } else if (results.violations !== undefined) {
                vioBox.style.display = 'block';
                vioNum.innerText = '0';
                vioNum.style.color = '#10b981';
            } else {
                vioBox.style.display = 'none';
            }
        }

        // Pacing analysis box
        const pacingBox = document.getElementById('modal-box-pacing');
        const pacingNum = document.getElementById('modal-pacing');
        if (pacingBox && pacingNum) {
            pacingBox.style.display = 'block';
            pacingNum.innerText = results.pacingDisplay || '--';
        }

        modal.style.display = 'flex';
    }

    function hideSummaryModal() {
        const modal = document.getElementById('summary-modal');
        if (modal) modal.style.display = 'none';
    }

    function showAntiCheatModal(count, max, isExceeded, onConfirm) {
        const modal = document.getElementById('anticheat-modal');
        if (!modal) return;

        const titleEl = modal.querySelector('#anticheat-title');
        const descEl = modal.querySelector('#anticheat-desc');
        const pillEl = modal.querySelector('#anticheat-pill');
        const ackBtn = modal.querySelector('#anticheat-ack-btn');

        if (titleEl) titleEl.innerText = t('antiCheatWarningTitle');
        if (descEl) {
            descEl.innerText = isExceeded ? t('antiCheatLimitReached') : t('antiCheatWarningText');
        }
        if (pillEl) {
            pillEl.innerText = t('antiCheatViolations', count, max);
            pillEl.className = 'anticheat-violation-pill ' + (isExceeded ? 'danger' : 'warning');
        }
        if (ackBtn) {
            ackBtn.innerText = isExceeded ? t('btnSubmit') : t('antiCheatBtnAcknowledge');
            ackBtn.onclick = () => {
                modal.style.display = 'none';
                if (typeof onConfirm === 'function') onConfirm();
            };
        }

        modal.style.display = 'flex';
    }

    function hideAntiCheatModal() {
        const modal = document.getElementById('anticheat-modal');
        if (modal) modal.style.display = 'none';
    }

    function showToast(message) {
        let toast = document.getElementById('omni-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'omni-toast';
            toast.className = 'omni-toast';
            document.body.appendChild(toast);
        }
        toast.innerText = message;
        toast.classList.add('show');
        if (toast._timer) clearTimeout(toast._timer);
        toast._timer = setTimeout(() => {
            toast.classList.remove('show');
        }, 2200);
    }

    function openLightbox(src, caption) {
        const modal = document.getElementById('image-lightbox-modal');
        const img = document.getElementById('lightbox-img');
        const cap = document.getElementById('lightbox-caption');
        if (!modal || !img) return;
        img.src = src;
        if (cap) cap.innerText = caption || '';
        modal.style.display = 'flex';
    }

    function closeLightbox() {
        const modal = document.getElementById('image-lightbox-modal');
        if (modal) modal.style.display = 'none';
    }

    let hasBoundGlobalUIEvents = false;
    function initGlobalUI(onAttachImage) {
        if (hasBoundGlobalUIEvents) return;
        hasBoundGlobalUIEvents = true;

        const closeBtn = document.getElementById('btn-close-lightbox');
        if (closeBtn) {
            closeBtn.onclick = closeLightbox;
        }

        const modal = document.getElementById('image-lightbox-modal');
        if (modal) {
            modal.onclick = (e) => {
                if (e.target === modal || e.target.classList.contains('image-lightbox-content')) {
                    closeLightbox();
                }
            };
        }

        // Summary modal click-outside to dismiss
        const sumModal = document.getElementById('summary-modal');
        if (sumModal) {
            sumModal.addEventListener('click', (e) => {
                if (e.target === sumModal) {
                    hideSummaryModal();
                }
            });
        }

        const histModal = document.getElementById('history-modal');
        if (histModal) {
            histModal.addEventListener('click', (e) => {
                if (e.target === histModal) {
                    hideHistoryModal();
                }
            });
        }

        const subModal = document.getElementById('submit-confirm-modal');
        if (subModal) {
            subModal.addEventListener('click', (e) => {
                if (e.target === subModal) {
                    hideSubmitConfirmModal();
                }
            });
        }

        const studioModal = document.getElementById('question-studio-modal');
        if (studioModal) {
            studioModal.addEventListener('click', (e) => {
                if (e.target === studioModal && window.QuestionStudio) {
                    QuestionStudio.close();
                }
            });
        }

        const hostModal = document.getElementById('host-room-modal');
        if (hostModal) {
            hostModal.addEventListener('click', (e) => {
                if (e.target === hostModal) {
                    hostModal.style.display = 'none';
                }
            });
        }

        const lbModal = document.getElementById('room-leaderboard-modal');
        if (lbModal) {
            lbModal.addEventListener('click', (e) => {
                if (e.target === lbModal) {
                    lbModal.style.display = 'none';
                }
            });
        }

        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                closeLightbox();
                hideSummaryModal();
                hideHistoryModal();
                hideSubmitConfirmModal();
                if (window.QuestionStudio) QuestionStudio.close();
                const hModal = document.getElementById('host-room-modal');
                if (hModal) hModal.style.display = 'none';
                const lModal = document.getElementById('room-leaderboard-modal');
                if (lModal) lModal.style.display = 'none';
            }
        });

        const quizContainer = document.getElementById('quiz-container');
        if (quizContainer) {
            quizContainer.addEventListener('click', (e) => {
                // Click on quiz image -> open lightbox
                const img = e.target.closest('img');
                if (img && (img.classList.contains('quiz-img') || img.closest('.quiz-image-wrap') || img.closest('.custom-q-image-wrap'))) {
                    openLightbox(img.src, img.alt || 'Hình minh họa câu hỏi');
                    return;
                }

                // Click on copy code button
                const copyBtn = e.target.closest('.btn-copy-code');
                if (copyBtn) {
                    const code = decodeURIComponent(copyBtn.dataset.code || '');
                    const onCopySuccess = () => {
                        const origText = copyBtn.innerText;
                        copyBtn.innerText = '✓ Đã chép!';
                        copyBtn.classList.add('copied');
                        setTimeout(() => {
                            copyBtn.innerText = origText;
                            copyBtn.classList.remove('copied');
                        }, 1500);
                    };

                    if (navigator.clipboard && navigator.clipboard.writeText) {
                        navigator.clipboard.writeText(code).then(onCopySuccess).catch(() => {
                            fallbackCopy(code, onCopySuccess);
                        });
                    } else {
                        fallbackCopy(code, onCopySuccess);
                    }
                    return;
                }
            });
        }

        function fallbackCopy(text, onSuccess) {
            try {
                const ta = document.createElement('textarea');
                ta.value = text;
                ta.style.position = 'fixed';
                ta.style.opacity = '0';
                ta.style.left = '-9999px';
                document.body.appendChild(ta);
                ta.focus();
                ta.select();
                const successful = document.execCommand('copy');
                document.body.removeChild(ta);
                if (successful && typeof onSuccess === 'function') onSuccess();
            } catch (e) {}
        }

        // Quick clipboard paste listener (Ctrl+V for cropped diagrams/code)
        window.addEventListener('paste', (e) => {
            if (!e.clipboardData || !e.clipboardData.items) return;
            const items = e.clipboardData.items;
            for (let i = 0; i < items.length; i++) {
                if (items[i].type && items[i].type.indexOf('image') !== -1) {
                    const blob = items[i].getAsFile();
                    if (blob) {
                        const reader = new FileReader();
                        reader.onload = (evt) => {
                            if (typeof onAttachImage === 'function') {
                                onAttachImage(activeViewingQuestionIndex, evt.target.result);
                                showToast(`✓ Đã dán ảnh vào Câu ${activeViewingQuestionIndex + 1}`);
                            }
                        };
                        reader.readAsDataURL(blob);
                    }
                    break;
                }
            }
        });
    }

    function showLoadingModal(title, initialStep = '') {
        const modal = document.getElementById('loading-modal');
        if (!modal) return;
        const titleEl = document.getElementById('loading-modal-title');
        const stepEl = document.getElementById('loading-modal-step');
        const barEl = document.getElementById('loading-progress-bar');
        const numEl = document.getElementById('loading-progress-num');
        const badgeEl = document.getElementById('loading-details-badge');

        if (titleEl) titleEl.innerText = title || 'Đang xử lý đề thi...';
        if (stepEl) stepEl.innerText = initialStep;
        if (barEl) barEl.style.width = '0%';
        if (numEl) numEl.innerText = '0%';
        if (badgeEl) badgeEl.style.display = 'none';

        modal.style.display = 'flex';
    }

    function updateLoadingProgress(percent, stepText, detailsBadge = '') {
        const stepEl = document.getElementById('loading-modal-step');
        const barEl = document.getElementById('loading-progress-bar');
        const numEl = document.getElementById('loading-progress-num');
        const badgeEl = document.getElementById('loading-details-badge');

        const rounded = Math.min(100, Math.max(0, Math.round(percent)));
        if (barEl) barEl.style.width = rounded + '%';
        if (numEl) numEl.innerText = rounded + '%';
        if (stepText && stepEl) stepEl.innerText = stepText;

        if (badgeEl) {
            if (detailsBadge) {
                badgeEl.innerText = detailsBadge;
                badgeEl.style.display = 'inline-block';
            } else {
                badgeEl.style.display = 'none';
            }
        }
    }

    function hideLoadingModal() {
        const modal = document.getElementById('loading-modal');
        if (modal) modal.style.display = 'none';
    }

    function showHistoryModal(historyList, onReviewExam, onDeleteExam, onClearAll) {
        const modal = document.getElementById('history-modal');
        if (!modal) return;

        const totalEl = document.getElementById('hist-stat-total');
        const avgEl = document.getElementById('hist-stat-avg');
        const bestEl = document.getElementById('hist-stat-best');
        const listContainer = document.getElementById('hist-view-list');
        const countPill = document.getElementById('hist-count-pill');

        const count = historyList ? historyList.length : 0;
        if (countPill) countPill.innerText = count;
        if (totalEl) totalEl.innerText = count;

        if (count > 0) {
            const sumScore = historyList.reduce((acc, cur) => acc + (cur.score10 || 0), 0);
            const avg = (sumScore / count).toFixed(1);
            const maxScore = Math.max(...historyList.map(h => h.score100 || 0));
            if (avgEl) avgEl.innerText = avg;
            if (bestEl) bestEl.innerText = maxScore + '/100';
        } else {
            if (avgEl) avgEl.innerText = '0.0';
            if (bestEl) bestEl.innerText = '0';
        }

        if (listContainer) {
            if (!historyList || historyList.length === 0) {
                listContainer.innerHTML = `
                    <div style="text-align: center; padding: 40px 20px; opacity: 0.65;">
                        <div style="font-size: 3em; margin-bottom: 8px;">📭</div>
                        <p style="font-size: 1.05em; font-weight: 600;">Chưa có lịch sử làm bài thi nào</p>
                        <p style="font-size: 0.85em;">Hãy hoàn thành một bài thi để kết quả được lưu trữ tại đây!</p>
                    </div>
                `;
            } else {
                listContainer.innerHTML = '';
                historyList.forEach(item => {
                    const row = document.createElement('div');
                    row.className = 'history-item-row';

                    let scoreBadgeClass = 'mid';
                    if (item.score100 >= 80) scoreBadgeClass = 'high';
                    else if (item.score100 < 50) scoreBadgeClass = 'low';

                    row.innerHTML = `
                        <div class="history-score-badge ${scoreBadgeClass}">
                            ${item.score10}đ
                            <div style="font-size: 0.7em; font-weight: 600; opacity: 0.8;">${item.score100}%</div>
                        </div>
                        <div class="history-item-info">
                            <div class="history-item-title">${escapeHTML(item.title || 'Bài thi trắc nghiệm')}</div>
                            <div class="history-item-meta">
                                <span>📅 ${item.dateFormatted || new Date(item.timestamp).toLocaleDateString()}</span>
                                <span>⏱️ ${item.durationSpent ? Math.round(item.durationSpent / 60) + ' phút' : 'Tự do'}</span>
                                <span>✓ ${item.correctCount}/${item.totalQuestions} đúng</span>
                                ${item.pacingDisplay && item.pacingDisplay !== '--' ? `<span>⚡ ${item.pacingDisplay}/câu</span>` : ''}
                                ${item.syncedToCloud ? '<span style="color: #38bdf8; font-weight: 700;">☁️ Supabase</span>' : ''}
                            </div>
                        </div>
                        <div class="history-actions-cell">
                            <button class="btn-history-action btn-del" title="Xóa bài thi này">🗑️ Xóa</button>
                        </div>
                    `;

                    row.querySelector('.btn-del').onclick = async (e) => {
                        e.stopPropagation();
                        if (confirm('Bạn có chắc muốn xóa bản ghi thi này không?')) {
                            if (typeof onDeleteExam === 'function') {
                                await onDeleteExam(item.id);
                            }
                        }
                    };

                    listContainer.appendChild(row);
                });
            }
        }

        // Tab Switching
        const tabListBtn = document.getElementById('tab-btn-hist-list');
        const tabCloudBtn = document.getElementById('tab-btn-hist-cloud');
        const viewList = document.getElementById('hist-view-list');
        const viewCloud = document.getElementById('hist-view-cloud');

        if (tabListBtn && tabCloudBtn && viewList && viewCloud) {
            tabListBtn.onclick = () => {
                tabListBtn.classList.add('active');
                tabCloudBtn.classList.remove('active');
                viewList.style.display = 'block';
                viewCloud.style.display = 'none';
            };
            tabCloudBtn.onclick = () => {
                tabCloudBtn.classList.add('active');
                tabListBtn.classList.remove('active');
                viewList.style.display = 'none';
                viewCloud.style.display = 'block';
                updateSupabaseConfigView();
            };
        }

        modal.style.display = 'flex';
    }

    function hideHistoryModal() {
        const modal = document.getElementById('history-modal');
        if (modal) modal.style.display = 'none';
    }

    function updateSupabaseConfigView() {
        if (typeof SupabaseClient === 'undefined') return;
        const cfg = SupabaseClient.getStoredConfig();
        const urlInput = document.getElementById('supabase-input-url');
        const keyInput = document.getElementById('supabase-input-key');
        const statusEl = document.getElementById('supabase-status-pill');

        if (urlInput) urlInput.value = cfg.url || '';
        if (keyInput) keyInput.value = cfg.key || '';

        if (statusEl) {
            if (SupabaseClient.isConfigured()) {
                statusEl.innerHTML = '<span style="color: #22c55e;">🟢 Đã kết nối Supabase Cloud Database</span>';
            } else {
                statusEl.innerHTML = '<span style="color: #94a3b8;">⚪ Chưa kết nối (Lịch sử lưu cục bộ IndexedDB)</span>';
            }
        }
    }

    function showFullscreenLockout(violationCount, maxViolations, onReturnToFullscreen) {
        const modal = document.getElementById('fullscreen-lockout-modal');
        if (!modal) return;
        const badge = document.getElementById('lockout-violation-badge');
        if (badge) {
            badge.innerText = `Số lần vi phạm: ${violationCount}/${maxViolations}`;
        }
        const btn = document.getElementById('btn-lockout-return');
        if (btn) {
            btn.onclick = () => {
                modal.style.display = 'none';
                if (typeof onReturnToFullscreen === 'function') {
                    onReturnToFullscreen();
                }
            };
        }
        modal.style.display = 'flex';
    }

    function hideFullscreenLockout() {
        const modal = document.getElementById('fullscreen-lockout-modal');
        if (modal) modal.style.display = 'none';
    }

    function showFullscreenExamPrompt(onStartFullscreen, onCancel) {
        const modal = document.getElementById('fullscreen-prompt-modal');
        if (!modal) return;
        const btnStart = document.getElementById('btn-prompt-start-fullscreen');
        const btnCancel = document.getElementById('btn-prompt-cancel-fullscreen');

        if (btnStart) {
            btnStart.onclick = () => {
                modal.style.display = 'none';
                if (typeof onStartFullscreen === 'function') onStartFullscreen();
            };
        }
        if (btnCancel) {
            btnCancel.onclick = () => {
                modal.style.display = 'none';
                if (typeof onCancel === 'function') onCancel();
            };
        }
        modal.style.display = 'flex';
    }

    function hideFullscreenExamPrompt() {
        const modal = document.getElementById('fullscreen-prompt-modal');
        if (modal) modal.style.display = 'none';
    }

    function showSubmitConfirmModal(stats, onConfirm, onCancel) {
        const modal = document.getElementById('submit-confirm-modal');
        if (!modal) return;

        const total = stats.total || 0;
        const answered = stats.answered || 0;
        const unanswered = stats.unanswered || 0;
        const flagged = stats.flagged || 0;
        const percent = total > 0 ? Math.round((answered / total) * 100) : 0;

        const ansEl = document.getElementById('matrix-count-answered');
        const pctEl = document.getElementById('matrix-percent-answered');
        const unEl = document.getElementById('matrix-count-unanswered');
        const flgEl = document.getElementById('matrix-count-flagged');

        if (ansEl) ansEl.innerText = answered;
        if (pctEl) pctEl.innerText = percent + '%';
        if (unEl) unEl.innerText = unanswered;
        if (flgEl) flgEl.innerText = flagged;

        const unBox = document.getElementById('matrix-box-unanswered');
        const warnBanner = document.getElementById('confirm-unanswered-warning');
        const unHighlight = document.getElementById('confirm-unanswered-highlight');

        if (unanswered > 0) {
            if (unBox) unBox.classList.add('has-warning');
            if (warnBanner) {
                warnBanner.style.display = 'block';
                if (unHighlight) unHighlight.innerText = unanswered;
            }
        } else {
            if (unBox) unBox.classList.remove('has-warning');
            if (warnBanner) warnBanner.style.display = 'none';
        }

        const btnCancel = document.getElementById('btn-cancel-submit');
        const btnProceed = document.getElementById('btn-proceed-submit');

        if (btnCancel) {
            btnCancel.onclick = () => {
                hideSubmitConfirmModal();
                if (typeof onCancel === 'function') onCancel();
            };
        }
        if (btnProceed) {
            btnProceed.onclick = () => {
                hideSubmitConfirmModal();
                if (typeof onConfirm === 'function') onConfirm();
            };
        }

        modal.style.display = 'flex';
    }

    function hideSubmitConfirmModal() {
        const modal = document.getElementById('submit-confirm-modal');
        if (modal) modal.style.display = 'none';
    }

    function getActiveQuestionIndex() {
        return activeViewingQuestionIndex;
    }

    return {
        renderQuestionsList,
        updateSingleQuestion,
        renderPalette,
        setActiveQuestion,
        getActiveQuestionIndex,
        popAnsweredPaletteButton,
        setupScrollSpy,
        toggleMobilePalette,
        closeMobilePalette,
        setFilter,
        updateStats,
        scrollToQuestion,
        showSummaryModal,
        hideSummaryModal,
        showToast,
        openLightbox,
        closeLightbox,
        initGlobalUI,
        showLoadingModal,
        updateLoadingProgress,
        hideLoadingModal,
        showAntiCheatModal,
        hideAntiCheatModal,
        typesetMath,
        typesetMathJaxProgressively,
        showHistoryModal,
        hideHistoryModal,
        showFullscreenLockout,
        hideFullscreenLockout,
        showFullscreenExamPrompt,
        hideFullscreenExamPrompt,
        showSubmitConfirmModal,
        hideSubmitConfirmModal
    };
})();
