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
        onRemoveImage = null
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

            // Header
            const header = document.createElement('div');
            header.className = 'q-header';

            const title = document.createElement('div');
            title.className = 'question-title';
            const safeQText = (typeof QuestionParser !== 'undefined' && QuestionParser.formatMathText) 
                ? QuestionParser.formatMathText(q.q) 
                : q.q;
            title.innerHTML = `Q${qIndex + 1}. ${safeQText}`;
            header.appendChild(title);

            const flagBtn = document.createElement('button');
            flagBtn.className = 'flag-btn' + (isFlagged ? ' active' : '');
            flagBtn.innerHTML = (isFlagged ? '🚩 ' : '🏳️ ') + t('reviewFlag');
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
            if ((mode === 'practice' && hasAnswered) || isSubmitted) {
                optContainer.classList.add('disabled-options');
            }

            q.options.forEach((optText, oIndex) => {
                const optDiv = document.createElement('div');
                optDiv.className = 'option';

                const isSelected = selected.includes(oIndex);
                const isCorrect = q.answers.includes(oIndex);

                if (isSelected) optDiv.classList.add('selected');

                if ((mode === 'practice' && hasAnswered) || isSubmitted) {
                    if (isCorrect) optDiv.classList.add('correct');
                    else if (isSelected) optDiv.classList.add('incorrect');
                }

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
            if (q.type === 'multiple' && mode === 'practice' && !hasAnswered && !isSubmitted) {
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
            if (((mode === 'practice' && hasAnswered) || isSubmitted) && hasExpText) {
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
    }

    function updateSingleQuestion(qIndex, questions, userAnswers, flaggedQuestions, mode, isSubmitted) {
        const block = document.getElementById('qblock-' + qIndex);
        if (!block) return;
        const q = questions[qIndex];
        if (!q) return;

        const selected = userAnswers[qIndex] || [];
        const hasAnswered = selected.length > 0;
        const isFlagged = flaggedQuestions.has(qIndex);

        // Update Flag button
        const flagBtn = block.querySelector('.flag-btn');
        if (flagBtn) {
            flagBtn.className = 'flag-btn' + (isFlagged ? ' active' : '');
            flagBtn.innerHTML = (isFlagged ? '🚩 ' : '🏳️ ') + t('reviewFlag');
        }

        // Update Options
        const optContainer = block.querySelector('.options-container');
        if (optContainer) {
            if ((mode === 'practice' && hasAnswered) || isSubmitted) {
                optContainer.classList.add('disabled-options');
            } else {
                optContainer.classList.remove('disabled-options');
            }

            const optDivs = optContainer.querySelectorAll('.option');
            optDivs.forEach((optDiv, oIndex) => {
                const isSelected = selected.includes(oIndex);
                const isCorrect = q.answers.includes(oIndex);

                optDiv.classList.remove('selected', 'correct', 'incorrect');
                if (isSelected) optDiv.classList.add('selected');

                if ((mode === 'practice' && hasAnswered) || isSubmitted) {
                    if (isCorrect) optDiv.classList.add('correct');
                    else if (isSelected) optDiv.classList.add('incorrect');
                }
            });
        }

        // Multiple choice check answer button
        const checkBtn = block.querySelector('.btn-check-answer');
        if (checkBtn) {
            checkBtn.style.display = (q.type === 'multiple' && mode === 'practice' && !hasAnswered && !isSubmitted) ? 'inline-flex' : 'none';
        }

        // Update explanation
        const expDiv = document.getElementById('exp-' + qIndex);
        if (expDiv) {
            const hasExpText = q.explanation && q.explanation.trim().length > 0;
            expDiv.style.display = (((mode === 'practice' && hasAnswered) || isSubmitted) && hasExpText) ? 'block' : 'none';
        }
    }

    let activeViewingQuestionIndex = 0;
    let scrollObserver = null;

    function renderPalette(questions, userAnswers, flaggedQuestions, mode, isSubmitted, onSelectQuestion) {
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

            if (hasAnswered) countAnswered++;

            // Preserve current-viewing state
            const isCurrentViewing = qIndex === activeViewingQuestionIndex;
            btn.className = 'palette-btn' + (isCurrentViewing ? ' current-viewing' : '');

            if (isFlagged) btn.classList.add('flagged');

            const correct = QuizEngine.isAnswerCorrect(q, answers);
            if (mode === 'practice' && hasAnswered) {
                if (correct) btn.classList.add('correct');
                else btn.classList.add('incorrect');
            } else if (mode === 'exam') {
                if (isSubmitted) {
                    if (correct) btn.classList.add('correct');
                    else btn.classList.add('incorrect');
                } else if (hasAnswered) {
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

    function updateStats(questions, userAnswers, mode, isSubmitted) {
        let answered = 0;
        let correct = 0;
        let incorrect = 0;
        questions.forEach((q, qIndex) => {
            const ans = userAnswers[qIndex];
            if (ans && ans.length > 0) {
                answered++;
                if (QuizEngine.isAnswerCorrect(q, ans)) correct++;
                else incorrect++;
            }
        });

        const elAnswered = document.getElementById('total-answered');
        const elTotal = document.getElementById('total-questions');
        const elCorrect = document.getElementById('correct-count');
        const elIncorrect = document.getElementById('incorrect-count');
        const elBar = document.getElementById('quiz-progress-bar');

        if (elAnswered) elAnswered.innerText = answered;
        if (elTotal) elTotal.innerText = questions.length;

        if (mode === 'practice' || isSubmitted) {
            if (elCorrect) elCorrect.innerText = correct;
            if (elIncorrect) elIncorrect.innerText = incorrect;
        } else {
            if (elCorrect) elCorrect.innerText = '-';
            if (elIncorrect) elIncorrect.innerText = '-';
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

        modal.style.display = 'flex';
    }

    function hideSummaryModal() {
        const modal = document.getElementById('summary-modal');
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

        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                closeLightbox();
                hideSummaryModal();
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
        hideLoadingModal
    };
})();
