/**
 * app.js - Main Application Orchestrator & Event Coordinator
 */
(() => {
    let timerInterval = null;

    window.addEventListener('DOMContentLoaded', () => {
        initSettings();
        bindGlobalEvents();
        loadQuestions();
    });

    function initSettings() {
        const savedTheme = StorageManager.loadPreference('theme', 'academic');
        const savedLang = StorageManager.loadPreference('lang', 'vi');
        const savedMode = StorageManager.loadPreference('mode', 'practice');

        QuizEngine.state.currentTheme = savedTheme;
        QuizEngine.state.currentLang = savedLang;
        QuizEngine.state.currentMode = savedMode;

        const selTheme = document.getElementById('theme-selector');
        const selLang = document.getElementById('lang-selector');
        const selMode = document.getElementById('mode-selector');

        if (selTheme) selTheme.value = savedTheme;
        if (selLang) selLang.value = savedLang;
        if (selMode) selMode.value = savedMode;

        document.body.className = 'theme-' + savedTheme;
        updateUILanguage(savedLang);
    }

    function bindGlobalEvents() {
        // Theme selector
        document.getElementById('theme-selector')?.addEventListener('change', (e) => {
            const theme = e.target.value;
            QuizEngine.state.currentTheme = theme;
            document.body.className = 'theme-' + theme;
            StorageManager.savePreference('theme', theme);
        });

        // Language selector
        document.getElementById('lang-selector')?.addEventListener('change', (e) => {
            const lang = e.target.value;
            QuizEngine.state.currentLang = lang;
            StorageManager.savePreference('lang', lang);
            updateUILanguage(lang);
            refreshUI();
        });

        // Mode selector
        document.getElementById('mode-selector')?.addEventListener('change', (e) => {
            const mode = e.target.value;
            QuizEngine.state.currentMode = mode;
            StorageManager.savePreference('mode', mode);
            refreshUI();
        });

        // Shuffle button
        document.getElementById('btn-shuffle')?.addEventListener('click', () => {
            if (QuizEngine.state.isSubmitted) return;
            if (confirm(t('confirmShuffle'))) {
                QuizEngine.shuffle();
                StorageManager.saveState(QuizEngine.state);
                refreshUI();
            }
        });

        // Reset button
        document.getElementById('btn-reset')?.addEventListener('click', () => {
            if (confirm(t('confirmReset'))) {
                StorageManager.clearState();
                QuizEngine.state.userAnswers = {};
                QuizEngine.state.flaggedQuestions.clear();
                QuizEngine.state.isSubmitted = false;
                QuizEngine.state.timeLeft = 3600;
                QuizEngine.state.incorrectQData = [];
                refreshUI();
                startTimer();
            }
        });

        // Finish button (Navbar & Sidebar)
        document.getElementById('finish-btn')?.addEventListener('click', promptFinishQuiz);
        document.getElementById('txt-btn-submit-aside')?.addEventListener('click', promptFinishQuiz);

        // Modal buttons
        document.getElementById('txt-modal-review')?.addEventListener('click', () => {
            UIManager.hideSummaryModal();
        });
        document.getElementById('txt-modal-export')?.addEventListener('click', () => {
            QuizEngine.exportPDFReport();
        });

        // Palette filter buttons
        document.getElementById('flt-all')?.addEventListener('click', () => {
            UIManager.setFilter('all', refreshPalette);
        });
        document.getElementById('flt-answered')?.addEventListener('click', () => {
            UIManager.setFilter('answered', refreshPalette);
        });
        document.getElementById('flt-flagged')?.addEventListener('click', () => {
            UIManager.setFilter('flagged', refreshPalette);
        });
        document.getElementById('flt-unanswered')?.addEventListener('click', () => {
            UIManager.setFilter('unanswered', refreshPalette);
        });

        // Azota Mobile Drawer Toggles
        document.getElementById('btn-mobile-palette-toggle')?.addEventListener('click', () => {
            UIManager.toggleMobilePalette();
        });
        document.getElementById('btn-close-palette-drawer')?.addEventListener('click', () => {
            UIManager.closeMobilePalette();
        });

        // Fast Question Keyboard Navigation (Arrow Keys)
        window.addEventListener('keydown', (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
            if (!QuizEngine.state.questions || QuizEngine.state.questions.length === 0) return;

            // Get currently active question
            const activeBtn = document.querySelector('.palette-btn.current-viewing');
            let currentIdx = 0;
            if (activeBtn && activeBtn.id && activeBtn.id.startsWith('pbtn-')) {
                currentIdx = parseInt(activeBtn.id.replace('pbtn-', ''), 10) || 0;
            }

            if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                if (currentIdx < QuizEngine.state.questions.length - 1) {
                    e.preventDefault();
                    UIManager.scrollToQuestion(currentIdx + 1);
                }
            } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                if (currentIdx > 0) {
                    e.preventDefault();
                    UIManager.scrollToQuestion(currentIdx - 1);
                }
            }
        });
    }

    async function loadQuestions() {
        // Wire sample exam button
        document.getElementById('btn-load-sample')?.addEventListener('click', async () => {
            const tryPaths = ['questions.txt', 'data/questions.txt'];
            let loadedText = null;
            for (const path of tryPaths) {
                try {
                    const res = await fetch(path);
                    if (res.ok) {
                        loadedText = await res.text();
                        break;
                    }
                } catch (err) {
                    // Ignore and try next
                }
            }

            if (loadedText) {
                document.getElementById('upload-section').style.display = 'none';
                setupQuiz(loadedText, true);
            } else {
                // Embedded demo fallback if file:// protocol blocks fetch
                alert(QuizEngine.state.currentLang === 'vi' 
                    ? 'Đang mở trực tiếp từ file://, vui lòng chọn file questions.txt hoặc kéo thả file vào ô bên dưới!'
                    : 'Opening via file:// protocol. Please select questions.txt or drag and drop a file below!');
            }
        });

        // Wire drag and drop
        const dropZone = document.getElementById('upload-section');
        if (dropZone) {
            ['dragenter', 'dragover'].forEach(eventName => {
                dropZone.addEventListener(eventName, (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    dropZone.classList.add('dragover');
                });
            });

            ['dragleave', 'drop'].forEach(eventName => {
                dropZone.addEventListener(eventName, (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    dropZone.classList.remove('dragover');
                });
            });

            dropZone.addEventListener('drop', (e) => {
                const files = e.dataTransfer.files;
                if (files && files.length > 0) {
                    handleUploadedFile(files[0]);
                }
            });
        }

        // Wire file input
        document.getElementById('file-input')?.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) handleUploadedFile(file);
        });

        // Try automatic auto-fetch for HTTP/HTTPS web servers
        const tryPaths = ['questions.txt', 'data/questions.txt'];
        let loadedText = null;

        for (const path of tryPaths) {
            try {
                const res = await fetch(path);
                if (res.ok) {
                    loadedText = await res.text();
                    break;
                }
            } catch (err) {
                // Ignore and try next
            }
        }

        if (loadedText) {
            document.getElementById('upload-section').style.display = 'none';
            setupQuiz(loadedText, false);
        } else {
            document.getElementById('upload-section').style.display = 'block';
        }
    }

    function handleUploadedFile(file) {
        if (!file) return;
        const fileName = file.name.toLowerCase();

        if (fileName.endsWith('.docx')) {
            const reader = new FileReader();
            reader.onload = function(loadEvent) {
                const arrayBuffer = loadEvent.target.result;
                if (window.mammoth) {
                    mammoth.extractRawText({ arrayBuffer: arrayBuffer })
                        .then(function(result) {
                            document.getElementById('upload-section').style.display = 'none';
                            setupQuiz(result.value, true);
                        })
                        .catch(function(err) {
                            alert(QuizEngine.state.currentLang === 'vi' 
                                ? 'Lỗi đọc file .docx: ' + err.message
                                : 'Error reading .docx file: ' + err.message);
                        });
                } else {
                    alert(QuizEngine.state.currentLang === 'vi'
                        ? 'Thư viện đọc file Word (Mammoth.js) chưa sẵn sàng.'
                        : 'Word parsing library (Mammoth.js) not ready.');
                }
            };
            reader.readAsArrayBuffer(file);
        } else if (fileName.endsWith('.doc')) {
            alert(QuizEngine.state.currentLang === 'vi'
                ? 'ℹ️ File của bạn là định dạng Word 97-2003 (.doc) nhị phân cũ.\n\nTrình duyệt chỉ hỗ trợ trực tiếp định dạng Word hiện đại (.docx) hoặc (.txt).\n👉 Vui lòng mở file bằng Word hoặc Google Docs, chọn File > Save As (Lưu dưới dạng) thành ".docx" rồi tải lên nhé!'
                : 'ℹ️ Your file is in legacy Word 97-2003 binary format (.doc).\n\nModern browsers only support modern Word (.docx) or (.txt).\n👉 Please open the file in Word or Google Docs, Save As ".docx", and upload again!'
            );
        } else {
            const reader = new FileReader();
            reader.onload = (evt) => {
                document.getElementById('upload-section').style.display = 'none';
                setupQuiz(evt.target.result, true);
            };
            reader.readAsText(file, 'UTF-8');
        }
    }

    function setupQuiz(rawText, isNewExam = false) {
        const parsed = QuestionParser.parse(rawText);
        if (parsed.length === 0) {
            alert(QuizEngine.state.currentLang === 'vi' 
                ? 'Không tìm thấy câu hỏi hợp lệ trong file. Vui lòng kiểm tra lại định dạng file!' 
                : 'No valid questions found in the file. Please check the file format!');
            return;
        }

        QuizEngine.setQuestions(parsed);

        // When loading a new file or exam, always start clean with no revealed answers
        if (isNewExam) {
            StorageManager.clearState();
            QuizEngine.state.userAnswers = {};
            QuizEngine.state.flaggedQuestions = new Set();
            QuizEngine.state.isSubmitted = false;
            QuizEngine.state.timeLeft = 3600;
            QuizEngine.state.incorrectQData = [];
        } else {
            // Restore saved progress ONLY if available, not submitted, and question count matches
            const saved = StorageManager.loadState();
            if (saved && !saved.isSubmitted && saved.questionCount === parsed.length) {
                QuizEngine.state.userAnswers = saved.answers || {};
                QuizEngine.state.flaggedQuestions = saved.flagged || new Set();
                QuizEngine.state.isSubmitted = false;
                QuizEngine.state.timeLeft = saved.timeLeft || 3600;
            } else {
                StorageManager.clearState();
                QuizEngine.state.userAnswers = {};
                QuizEngine.state.flaggedQuestions = new Set();
                QuizEngine.state.isSubmitted = false;
                QuizEngine.state.timeLeft = 3600;
                QuizEngine.state.incorrectQData = [];
            }
        }

        UIManager.hideSummaryModal();

        document.getElementById('stats-section').style.display = 'block';
        document.getElementById('palette-section').style.display = 'block';
        const fab = document.getElementById('btn-mobile-palette-toggle');
        if (fab) fab.style.display = 'inline-flex';

        refreshUI();
        startTimer();
    }

    function refreshUI() {
        UIManager.renderQuestionsList(
            QuizEngine.state.questions,
            QuizEngine.state.userAnswers,
            QuizEngine.state.flaggedQuestions,
            QuizEngine.state.currentMode,
            QuizEngine.state.isSubmitted,
            onOptionClicked,
            onFlagToggled,
            onCheckAnswerClicked
        );
        refreshPalette();
        UIManager.updateStats(
            QuizEngine.state.questions,
            QuizEngine.state.userAnswers,
            QuizEngine.state.currentMode,
            QuizEngine.state.isSubmitted
        );

        // Targeted MathJax rendering
        if (window.MathJax && typeof MathJax.typesetPromise === 'function') {
            const container = document.getElementById('quiz-container');
            if (container) {
                MathJax.typesetPromise([container]).catch(() => {});
            }
        }
    }

    // Reactive MathJax hook when MathJax finishes loading asynchronously
    window.onMathJaxReady = () => {
        const container = document.getElementById('quiz-container');
        if (container && window.MathJax && typeof MathJax.typesetPromise === 'function') {
            MathJax.typesetPromise([container]).catch(() => {});
        }
    };

    function refreshPalette() {
        UIManager.renderPalette(
            QuizEngine.state.questions,
            QuizEngine.state.userAnswers,
            QuizEngine.state.flaggedQuestions,
            QuizEngine.state.currentMode,
            QuizEngine.state.isSubmitted,
            (qIndex) => UIManager.scrollToQuestion(qIndex)
        );
    }

    function onOptionClicked(qIndex, oIndex) {
        const changed = QuizEngine.selectOption(qIndex, oIndex);
        if (!changed) return;

        StorageManager.saveState(QuizEngine.state);

        if (QuizEngine.state.currentMode === 'practice') {
            const q = QuizEngine.state.questions[qIndex];
            if (q.type === 'single') {
                const correct = QuizEngine.evaluateQuestion(qIndex);
                if (correct) AudioManager.playCorrect();
                else AudioManager.playIncorrect();
            }
        }

        UIManager.updateSingleQuestion(
            qIndex,
            QuizEngine.state.questions,
            QuizEngine.state.userAnswers,
            QuizEngine.state.flaggedQuestions,
            QuizEngine.state.currentMode,
            QuizEngine.state.isSubmitted
        );
        refreshPalette();
        UIManager.updateStats(
            QuizEngine.state.questions,
            QuizEngine.state.userAnswers,
            QuizEngine.state.currentMode,
            QuizEngine.state.isSubmitted
        );
        UIManager.popAnsweredPaletteButton(qIndex);
    }

    function onFlagToggled(qIndex) {
        QuizEngine.toggleFlag(qIndex);
        StorageManager.saveState(QuizEngine.state);
        UIManager.updateSingleQuestion(
            qIndex,
            QuizEngine.state.questions,
            QuizEngine.state.userAnswers,
            QuizEngine.state.flaggedQuestions,
            QuizEngine.state.currentMode,
            QuizEngine.state.isSubmitted
        );
        refreshPalette();
    }

    function onCheckAnswerClicked(qIndex) {
        const correct = QuizEngine.evaluateQuestion(qIndex);
        if (correct === null) return;

        if (correct) AudioManager.playCorrect();
        else AudioManager.playIncorrect();

        StorageManager.saveState(QuizEngine.state);
        UIManager.updateSingleQuestion(
            qIndex,
            QuizEngine.state.questions,
            QuizEngine.state.userAnswers,
            QuizEngine.state.flaggedQuestions,
            QuizEngine.state.currentMode,
            QuizEngine.state.isSubmitted
        );
        refreshPalette();
        UIManager.updateStats(
            QuizEngine.state.questions,
            QuizEngine.state.userAnswers,
            QuizEngine.state.currentMode,
            QuizEngine.state.isSubmitted
        );
        UIManager.popAnsweredPaletteButton(qIndex);
    }

    function startTimer() {
        if (timerInterval) clearInterval(timerInterval);

        const updateTimerDisplay = () => {
            let m = Math.floor(QuizEngine.state.timeLeft / 60);
            let s = QuizEngine.state.timeLeft % 60;
            const display = (m < 10 ? '0' + m : m) + ':' + (s < 10 ? '0' + s : s);
            const timerEl = document.getElementById('time-remaining');
            if (timerEl) timerEl.innerText = display;
        };

        updateTimerDisplay();

        timerInterval = setInterval(() => {
            if (QuizEngine.state.isSubmitted) {
                clearInterval(timerInterval);
                return;
            }

            QuizEngine.state.timeLeft--;
            updateTimerDisplay();

            if (QuizEngine.state.timeLeft <= 0) {
                clearInterval(timerInterval);
                finishQuiz(true);
            }
        }, 1000);
    }

    function promptFinishQuiz() {
        if (QuizEngine.state.isSubmitted) return;

        let answeredCount = 0;
        QuizEngine.state.questions.forEach((q, i) => {
            if (QuizEngine.state.userAnswers[i] && QuizEngine.state.userAnswers[i].length > 0) {
                answeredCount++;
            }
        });
        const unattempted = QuizEngine.state.questions.length - answeredCount;

        let msg = t('confirmFinish');
        if (unattempted > 0) {
            msg += '\n' + t('unansweredWarning', unattempted);
        }

        if (confirm(msg)) {
            finishQuiz(false);
        }
    }

    function finishQuiz(isTimeout) {
        if (timerInterval) clearInterval(timerInterval);
        QuizEngine.state.isSubmitted = true;
        StorageManager.saveState(QuizEngine.state);

        const results = QuizEngine.calculateResults();
        UIManager.showSummaryModal(results, isTimeout);

        refreshUI();

        if (results.score100 >= 75) {
            Confetti.launch();
        }
    }
})();
