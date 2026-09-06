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
        updateResetButtonState();
    }

    function isExamActiveUnsubmitted() {
        return Boolean(QuizEngine.state.questions && QuizEngine.state.questions.length > 0 && !QuizEngine.state.isSubmitted);
    }

    function updateResetButtonState() {
        const btnReset = document.getElementById('btn-reset');
        if (!btnReset) return;

        if (isExamActiveUnsubmitted()) {
            btnReset.classList.add('btn-locked');
            btnReset.setAttribute('aria-disabled', 'true');
            btnReset.title = t('tooltipResetDisabled');
        } else {
            btnReset.classList.remove('btn-locked');
            btnReset.removeAttribute('aria-disabled');
            btnReset.title = t('tooltipResetEnabled');
        }
    }

    function resetToInitialUploadScreen() {
        StorageManager.clearCurrentExam();
        StorageManager.clearState();
        if (timerInterval) clearInterval(timerInterval);
        QuizEngine.state.questions = [];
        QuizEngine.state.userAnswers = {};
        QuizEngine.state.flaggedQuestions = new Set();
        QuizEngine.state.isSubmitted = false;
        QuizEngine.state.timeLeft = 3600;
        QuizEngine.state.incorrectQData = [];

        // Reset file input
        const fileInput = document.getElementById('file-input');
        if (fileInput) fileInput.value = '';

        // Show upload section, hide stats and palette
        const uploadSec = document.getElementById('upload-section');
        if (uploadSec) uploadSec.style.display = 'block';
        const statsSec = document.getElementById('stats-section');
        if (statsSec) statsSec.style.display = 'none';
        const paletteSec = document.getElementById('palette-section');
        if (paletteSec) paletteSec.style.display = 'none';
        const fab = document.getElementById('btn-mobile-palette-toggle');
        if (fab) fab.style.display = 'none';

        // Show clean empty welcome state
        const container = document.getElementById('quiz-container');
        if (container) {
            container.innerHTML = `
                <div id="empty-quiz-welcome" style="text-align: center; padding: 50px 20px; opacity: 0.85;">
                    <div style="font-size: 2.5em; margin-bottom: 10px;">🎓</div>
                    <h3 style="margin-bottom: 6px; font-weight: 700;">Chào mừng bạn đến với OmniQuiz!</h3>
                    <p style="font-size: 0.95em; opacity: 0.8;">Vui lòng tải lên file đề thi của bạn ở khung phía trên, hoặc chọn một đề mẫu đa môn học để bắt đầu ôn luyện.</p>
                </div>
            `;
        }

        UIManager.hideSummaryModal();
        updateResetButtonState();
        window.scrollTo({ top: 0, behavior: 'smooth' });
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
            updateResetButtonState();
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

        // Reset button: returns completely to the initial exam selection/upload screen
        document.getElementById('btn-reset')?.addEventListener('click', () => {
            // Cannot reset while actively taking an exam
            if (isExamActiveUnsubmitted()) {
                alert(t('cannotResetDuringExam'));
                return;
            }

            // Only confirm if a quiz was completed / loaded
            if (QuizEngine.state.questions && QuizEngine.state.questions.length > 0) {
                if (!confirm(t('confirmReset'))) return;
            }

            resetToInitialUploadScreen();
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
        document.getElementById('txt-modal-new-quiz')?.addEventListener('click', () => {
            if (confirm(t('confirmReset'))) {
                resetToInitialUploadScreen();
            }
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
            const selectEl = document.getElementById('sample-subject-select');
            const subjectKey = selectEl ? selectEl.value : 'math_50';

            // 1. Try bundled sample banks first (fastest, offline-safe, 0 network failure)
            if (typeof SampleBanks !== 'undefined' && SampleBanks[subjectKey]) {
                document.getElementById('upload-section').style.display = 'none';
                setupQuiz(SampleBanks[subjectKey], true);
                return;
            }

            // 2. Fallback to fetch paths
            const pathMap = {
                math_50: 'question_banks/questions.txt',
                physics_12: 'question_banks/08_vat_ly_12_dao_dong_co.txt',
                chem_12: 'question_banks/09_hoa_hoc_12_este_lipit.txt',
                english_thpt: 'question_banks/10_tieng_anh_thpt_reading_grammar.txt',
                social_12: 'question_banks/11_lich_su_dia_ly_tong_hop.txt',
                sat_math: 'question_banks/06_sat_math_cbt_english.txt',
                quick_5: 'question_banks/07_de_test_nhanh_5_cau.txt'
            };

            const filePath = pathMap[subjectKey] || 'question_banks/questions.txt';
            try {
                const res = await fetch(filePath);
                if (res.ok) {
                    const loadedText = await res.text();
                    document.getElementById('upload-section').style.display = 'none';
                    setupQuiz(loadedText, true);
                    return;
                }
            } catch (err) {
                // Ignore and alert below
            }

            alert(QuizEngine.state.currentLang === 'vi' 
                ? 'Không thể tải đề thi mẫu. Vui lòng chọn file .docx hoặc .txt từ máy tính của bạn!'
                : 'Unable to load sample quiz. Please select a .docx or .txt file from your computer!');
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

        // Restore active exam ONLY if user was already taking one
        const savedExam = StorageManager.loadCurrentExam();
        if (savedExam && savedExam.rawText) {
            document.getElementById('upload-section').style.display = 'none';
            setupQuiz(savedExam.rawText, false);
        } else {
            // First time opening or clean visit: ALWAYS show upload section! DO NOT auto-load hardcoded exam!
            document.getElementById('upload-section').style.display = 'block';
            document.getElementById('stats-section').style.display = 'none';
            document.getElementById('palette-section').style.display = 'none';
            const fab = document.getElementById('btn-mobile-palette-toggle');
            if (fab) fab.style.display = 'none';
            updateResetButtonState();
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

        // Save active exam text for refresh recovery
        StorageManager.saveCurrentExam(rawText);

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
        updateResetButtonState();
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
        updateResetButtonState();

        if (results.score100 >= 75) {
            Confetti.launch();
        }
    }
})();
