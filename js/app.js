/**
 * app.js - Main Application Orchestrator & Event Coordinator
 */
(() => {
    let timerInterval = null;
    let lastViolationTimestamp = 0;

    window.addEventListener('DOMContentLoaded', () => {
        initSettings();
        bindGlobalEvents();
        UIManager.initGlobalUI(onImageAttached);
        loadQuestions();

        // PWA Service Worker Registration
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('sw.js')
                .then(reg => console.log('OmniQuiz PWA ServiceWorker ready, scope:', reg.scope))
                .catch(err => console.warn('OmniQuiz ServiceWorker registration skipped:', err));
        }
    });

    function handleAntiCheatViolation(reason) {
        if (QuizEngine.state.currentMode !== 'exam' || QuizEngine.state.isSubmitted) return;
        if (!QuizEngine.state.questions || QuizEngine.state.questions.length === 0) return;

        const now = Date.now();
        if (now - lastViolationTimestamp < 2500) return;
        lastViolationTimestamp = now;

        const res = QuizEngine.recordViolation(reason);
        if (!res) return;

        AudioManager.playBuzz();

        if (res.isExceeded) {
            UIManager.showAntiCheatModal(res.count, res.max, true, () => {
                finishQuiz(true);
            });
            finishQuiz(true);
        } else {
            UIManager.showAntiCheatModal(res.count, res.max, false);
        }
    }

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
        QuizEngine.state.customImages = {};
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
                    <h3 style="margin-bottom: 6px; font-weight: 700;">${t('welcomeTitle')}</h3>
                    <p style="font-size: 0.95em; opacity: 0.8;">${t('welcomeSubtitle')}</p>
                </div>
            `;
        }

        UIManager.hideSummaryModal();
        updateResetButtonState();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function bindGlobalEvents() {
        // Prevent default browser file drop behavior across entire window
        window.addEventListener('dragover', (e) => e.preventDefault());
        window.addEventListener('drop', (e) => e.preventDefault());

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

        // Mode selector (locked while exam is in progress to maintain test integrity)
        document.getElementById('mode-selector')?.addEventListener('change', (e) => {
            if (isExamActiveUnsubmitted()) {
                alert(QuizEngine.state.currentLang === 'vi'
                    ? 'Bạn đang trong quá trình làm bài thi! Không thể đổi chế độ thi.\nVui lòng hoàn thành bài làm trước.'
                    : 'You are currently taking an exam! Mode change is locked.\nPlease finish your exam first.');
                e.target.value = QuizEngine.state.currentMode;
                return;
            }
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
        document.getElementById('txt-modal-retake')?.addEventListener('click', () => {
            const res = QuizEngine.createRetakeMistakesExam();
            UIManager.hideSummaryModal();
            if (res && res.count > 0) {
                StorageManager.saveState(QuizEngine.state);
                refreshUI();
                startTimer();
                updateResetButtonState();
                UIManager.showToast(t('retakeSuccess', res.count));
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        });
        document.getElementById('txt-modal-export')?.addEventListener('click', () => {
            QuizEngine.exportPDFReport();
        });
        document.getElementById('txt-modal-new-quiz')?.addEventListener('click', () => {
            if (confirm(t('confirmReset'))) {
                resetToInitialUploadScreen();
            }
        });

        // Fullscreen toggle
        document.getElementById('btn-fullscreen-toggle')?.addEventListener('click', () => {
            if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen().catch(() => {});
            } else {
                document.exitFullscreen().catch(() => {});
            }
        });

        document.addEventListener('fullscreenchange', () => {
            const btn = document.getElementById('btn-fullscreen-toggle');
            if (btn) {
                btn.innerText = document.fullscreenElement ? t('btnExitFullscreen') : t('btnFullscreen');
            }
        });

        // Exam Duration Selector
        document.getElementById('duration-selector')?.addEventListener('change', (e) => {
            QuizEngine.setExamDuration(e.target.value);
            if (isExamActiveUnsubmitted()) {
                startTimer();
            }
        });

        // Anti-Cheat: Tab-switching & Window Blur monitoring for Exam Mode
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                handleAntiCheatViolation(QuizEngine.state.currentLang === 'vi' 
                    ? 'Chuyển tab / Ẩn màn hình thi' 
                    : 'Tab switch / Hidden exam window');
            }
        });

        window.addEventListener('blur', () => {
            handleAntiCheatViolation(QuizEngine.state.currentLang === 'vi' 
                ? 'Rời màn hình thi (Chuyển sang ứng dụng khác)' 
                : 'Focus lost (Switched to external app)');
        });

        // Anti-Cheat: Context menu (right-click) & Copy prevention in Exam Mode
        document.addEventListener('contextmenu', (e) => {
            if (QuizEngine.state.currentMode === 'exam' && isExamActiveUnsubmitted()) {
                const mainArea = document.querySelector('.quiz-main');
                if (mainArea && mainArea.contains(e.target)) {
                    e.preventDefault();
                    UIManager.showToast(t('antiCheatCopyWarning'));
                }
            }
        });

        document.addEventListener('copy', (e) => {
            if (QuizEngine.state.currentMode === 'exam' && isExamActiveUnsubmitted()) {
                const mainArea = document.querySelector('.quiz-main');
                if (mainArea && mainArea.contains(e.target)) {
                    e.preventDefault();
                    UIManager.showToast(t('antiCheatCopyWarning'));
                }
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

        // Fast Question Keyboard Navigation (Arrow Keys with Filter Awareness)
        window.addEventListener('keydown', (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
            if (!QuizEngine.state.questions || QuizEngine.state.questions.length === 0) return;

            // Get currently active question
            const activeBtn = document.querySelector('.palette-btn.current-viewing');
            let currentIdx = 0;
            if (activeBtn && activeBtn.id && activeBtn.id.startsWith('pbtn-')) {
                currentIdx = parseInt(activeBtn.id.replace('pbtn-', ''), 10) || 0;
            }

            // Get list of visible palette buttons (respects active filter: all / answered / flagged / unanswered)
            const visibleButtons = Array.from(document.querySelectorAll('.palette-btn'))
                .filter(btn => btn.style.display !== 'none');

            if (visibleButtons.length === 0) return;

            const currentPos = visibleButtons.findIndex(btn => btn.id === 'pbtn-' + currentIdx);

            if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                e.preventDefault();
                const nextPos = (currentPos >= 0 && currentPos < visibleButtons.length - 1) ? currentPos + 1 : 0;
                const targetId = visibleButtons[nextPos].id;
                const targetIdx = parseInt(targetId.replace('pbtn-', ''), 10);
                if (!isNaN(targetIdx)) {
                    UIManager.scrollToQuestion(targetIdx);
                }
            } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                e.preventDefault();
                const prevPos = (currentPos > 0) ? currentPos - 1 : visibleButtons.length - 1;
                const targetId = visibleButtons[prevPos].id;
                const targetIdx = parseInt(targetId.replace('pbtn-', ''), 10);
                if (!isNaN(targetIdx)) {
                    UIManager.scrollToQuestion(targetIdx);
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
                informatics_10: 'question_banks/13_tin_hoc_lap_trinh_co_ban.txt',
                chem_40_pdf: 'question_banks/12_hoa_hoc_40_cau_pdf_trac_nghiem.txt',
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

        // Subject quick pills in upload studio
        document.querySelectorAll('.subj-pill').forEach(pill => {
            pill.addEventListener('click', () => {
                const subj = pill.getAttribute('data-subj');
                const sel = document.getElementById('sample-subject-select');
                const btn = document.getElementById('btn-load-sample');
                if (sel && subj) {
                    sel.value = subj;
                    if (btn) btn.click();
                }
            });
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

        // Wire dropzone click to open file picker
        document.getElementById('dropzone-area')?.addEventListener('click', (e) => {
            if (e.target.closest('label') || e.target.id === 'file-input') return;
            document.getElementById('file-input')?.click();
        });

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

    function isCanvasBlank(canvas) {
        const ctx = canvas.getContext('2d');
        if (!ctx) return true;
        const width = canvas.width;
        const height = canvas.height;
        if (width === 0 || height === 0) return true;

        try {
            const imgData = ctx.getImageData(0, 0, width, height);
            const data = imgData.data;
            let nonWhitePixels = 0;
            const step = 16; // Sample every 4th pixel for speed
            for (let i = 0; i < data.length; i += step) {
                const r = data[i];
                const g = data[i + 1];
                const b = data[i + 2];
                const a = data[i + 3];
                if (a > 50 && (r < 235 || g < 235 || b < 235)) {
                    nonWhitePixels++;
                    if (nonWhitePixels > 50) return false;
                }
            }
            return true;
        } catch (e) {
            return false;
        }
    }

    async function handlePdfUpload(file) {
        if (!window.pdfjsLib) {
            alert(QuizEngine.state.currentLang === 'vi'
                ? 'Thư viện đọc file PDF (PDF.js) chưa sẵn sàng.'
                : 'PDF parsing library (PDF.js) not ready.');
            return;
        }

        UIManager.showLoadingModal('Đang xử lý đề thi PDF...', 'Đang nạp file và kiểm tra cấu trúc...');
        UIManager.updateLoadingProgress(6, 'Đang đọc file PDF...');

        try {
            const arrayBuffer = await file.arrayBuffer();
            const typedArray = new Uint8Array(arrayBuffer);
            const loadingTask = pdfjsLib.getDocument({ data: typedArray });
            const pdfDoc = await loadingTask.promise;
            const totalPages = pdfDoc.numPages;

            let fullExtractedText = '';
            const pageLinesMap = [];

            // Phase 1: Extract Text & Coordinates per page
            for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
                const pct = 6 + Math.round((pageNum / totalPages) * 36);
                UIManager.updateLoadingProgress(pct, `Đang trích xuất văn bản (Trang ${pageNum}/${totalPages})...`);

                const page = await pdfDoc.getPage(pageNum);
                const textContent = await page.getTextContent();
                let pageText = '';
                let lastY;

                const lines = [];
                for (const item of textContent.items) {
                    if (!item.str) continue;
                    if (lastY !== undefined && Math.abs(item.transform[5] - lastY) > 5) {
                        pageText += '\n';
                    } else if (pageText.length > 0 && !pageText.endsWith(' ') && !pageText.endsWith('\n')) {
                        pageText += ' ';
                    }
                    pageText += item.str;
                    lastY = item.transform[5];

                    const y = Math.round(item.transform[5]);
                    let line = lines.find(l => Math.abs(l.y - y) <= 4);
                    if (!line) {
                        line = { y, text: item.str.trim(), minX: item.transform[4] };
                        lines.push(line);
                    } else {
                        line.text += ' ' + item.str.trim();
                    }
                }

                lines.sort((a, b) => b.y - a.y);
                pageLinesMap.push({ pageNum, lines });
                fullExtractedText += pageText + '\n\n';
            }

            if (!fullExtractedText.trim()) {
                UIManager.hideLoadingModal();
                alert(QuizEngine.state.currentLang === 'vi'
                    ? 'Không thể trích xuất văn bản từ file PDF này (có thể do file scan dạng hình ảnh không có OCR). Vui lòng sử dụng file Word hoặc text!'
                    : 'Could not extract text from this PDF file. Please use a Word or text file!');
                return;
            }

            // Phase 2: Parse questions
            const parsedQuestions = QuestionParser.parse(fullExtractedText);
            if (parsedQuestions.length === 0) {
                UIManager.hideLoadingModal();
                alert(QuizEngine.state.currentLang === 'vi'
                    ? 'Không tìm thấy câu hỏi hợp lệ trong file PDF. Vui lòng kiểm tra lại định dạng file!'
                    : 'No valid questions found in this PDF file.');
                return;
            }

            UIManager.updateLoadingProgress(46, `Đã nhận diện ${parsedQuestions.length} câu hỏi. Đang quét hình ảnh & code...`);

            // Phase 3: Auto-Crop visual gaps (screenshots of code, diagrams, graphs, circuits)
            const autoCroppedImages = {};
            let detectedImagesCount = 0;

            for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
                const pct = 46 + Math.round((pageNum / totalPages) * 48);
                UIManager.updateLoadingProgress(
                    pct, 
                    `Đang quét & tự động cắt ảnh minh họa / code (Trang ${pageNum}/${totalPages})...`,
                    detectedImagesCount > 0 ? `Đã tìm thấy ${detectedImagesCount} ảnh minh họa` : ''
                );

                const pageData = pageLinesMap[pageNum - 1];
                if (!pageData || !pageData.lines || pageData.lines.length === 0) continue;
                const lines = pageData.lines;

                const gapsToCrop = [];
                let activeQNum = null;

                for (let i = 0; i < lines.length; i++) {
                    const cur = lines[i];
                    const next = lines[i + 1];

                    const qMatch = cur.text.match(/^(?:Câu\s*|Q\s*)?(\d+)[\.\:]\s*(.*)/i);
                    if (qMatch) {
                        activeQNum = parseInt(qMatch[1], 10);
                    }

                    if (next) {
                        const gap = cur.y - next.y;
                        if (gap > 45 && activeQNum !== null) {
                            const isNextOption = /^[A-D][\.\:\)]/i.test(next.text) || /^\d+\s*\:/.test(next.text);
                            const isNextQuestion = /^(?:Câu\s*|Q\s*)?(\d+)[\.\:]/i.test(next.text);

                            if (isNextOption || (!isNextQuestion && gap > 60)) {
                                gapsToCrop.push({
                                    questionNum: activeQNum,
                                    yTop: cur.y,
                                    yBottom: next.y
                                });
                            }
                        }
                    } else {
                        // Gap to bottom of page
                        if (activeQNum !== null && cur.y > 110) {
                            const gapToBottom = cur.y - 40;
                            if (gapToBottom > 65) {
                                gapsToCrop.push({
                                    questionNum: activeQNum,
                                    yTop: cur.y,
                                    yBottom: 40
                                });
                            }
                        }
                    }
                }

                if (gapsToCrop.length > 0) {
                    const page = await pdfDoc.getPage(pageNum);
                    const scale = 1.6;
                    const viewport = page.getViewport({ scale });
                    const pageCanvas = document.createElement('canvas');
                    pageCanvas.width = viewport.width;
                    pageCanvas.height = viewport.height;
                    const pageCtx = pageCanvas.getContext('2d');

                    await page.render({ canvasContext: pageCtx, viewport }).promise;

                    for (const gapItem of gapsToCrop) {
                        const qIndex = gapItem.questionNum - 1;
                        if (qIndex < 0 || qIndex >= parsedQuestions.length) continue;
                        if (autoCroppedImages[qIndex]) continue;

                        const [, vyTop] = viewport.convertToViewportPoint(0, gapItem.yTop);
                        const [, vyBottom] = viewport.convertToViewportPoint(0, gapItem.yBottom);

                        const cropY = Math.max(0, Math.round(vyTop + (4 * scale)));
                        const cropHeight = Math.max(10, Math.round(vyBottom - vyTop - (8 * scale)));
                        const cropX = Math.max(0, Math.round(viewport.width * 0.04));
                        const cropWidth = Math.min(viewport.width - cropX, Math.round(viewport.width * 0.92));

                        if (cropHeight < 20 || cropWidth < 50) continue;

                        const cropCanvas = document.createElement('canvas');
                        cropCanvas.width = cropWidth;
                        cropCanvas.height = cropHeight;
                        const cropCtx = cropCanvas.getContext('2d');

                        cropCtx.drawImage(
                            pageCanvas,
                            cropX, cropY, cropWidth, cropHeight,
                            0, 0, cropWidth, cropHeight
                        );

                        if (!isCanvasBlank(cropCanvas)) {
                            autoCroppedImages[qIndex] = cropCanvas.toDataURL('image/jpeg', 0.86);
                            detectedImagesCount++;
                        }
                    }
                }
            }

            // Phase 4: Finalize
            UIManager.updateLoadingProgress(
                100, 
                'Hoàn tất! Đang khởi tạo bài thi...', 
                `Tổng cộng: ${parsedQuestions.length} câu hỏi • ${detectedImagesCount} ảnh minh họa`
            );

            setTimeout(() => {
                UIManager.hideLoadingModal();
                document.getElementById('upload-section').style.display = 'none';
                setupQuiz(fullExtractedText, true, autoCroppedImages);

                if (detectedImagesCount > 0) {
                    UIManager.showToast(`✓ Đã tự động nhận diện & cắt ${detectedImagesCount} ảnh/code từ PDF!`);
                }
            }, 450);

        } catch (err) {
            UIManager.hideLoadingModal();
            alert(QuizEngine.state.currentLang === 'vi'
                ? 'Lỗi xử lý file PDF: ' + err.message
                : 'Error processing PDF file: ' + err.message);
        }
    }

    function handleUploadedFile(file) {
        if (!file) return;
        const fileName = file.name.toLowerCase();

        if (fileName.endsWith('.pdf')) {
            handlePdfUpload(file);
        } else if (fileName.endsWith('.docx')) {
            if (!window.mammoth) {
                alert(QuizEngine.state.currentLang === 'vi'
                    ? 'Thư viện đọc file Word (Mammoth.js) chưa sẵn sàng.'
                    : 'Word parsing library (Mammoth.js) not ready.');
                return;
            }

            UIManager.showLoadingModal('Đang đọc file Word (.docx)...', 'Đang trích xuất nội dung và hình ảnh nhúng...');
            UIManager.updateLoadingProgress(30, 'Đang giải nén tài liệu Word...');

            const reader = new FileReader();
            reader.onload = function(loadEvent) {
                const arrayBuffer = loadEvent.target.result;
                UIManager.updateLoadingProgress(60, 'Đang chuyển đổi định dạng và hình ảnh...');
                mammoth.convertToHtml(
                    { arrayBuffer: arrayBuffer },
                    {
                        convertImage: mammoth.images.imgElement(function(image) {
                            return image.read("base64").then(function(imageBuffer) {
                                return {
                                    src: "data:" + image.contentType + ";base64," + imageBuffer
                                };
                            });
                        })
                    }
                )
                .then(function(result) {
                    UIManager.updateLoadingProgress(100, 'Hoàn tất!');
                    setTimeout(() => {
                        UIManager.hideLoadingModal();
                        let text = result.value
                            .replace(/<br\s*\/?>/gi, '\n')
                            .replace(/<\/(?:p|div|h[1-6]|li)>/gi, '\n')
                            .replace(/<(?:p|div|h[1-6]|ul|ol)[\s\S]*?>/gi, '')
                            .replace(/<(?!(?:\/?img\b))[^>]+>/gi, '');
                        document.getElementById('upload-section').style.display = 'none';
                        setupQuiz(text.trim(), true);
                    }, 350);
                })
                .catch(function(err) {
                    UIManager.hideLoadingModal();
                    alert(QuizEngine.state.currentLang === 'vi' 
                        ? 'Lỗi đọc file .docx: ' + err.message
                        : 'Error reading .docx file: ' + err.message);
                });
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

    function setupQuiz(rawText, isNewExam = false, initialCustomImages = null) {
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

        // Configure exam duration
        if (parsed.parsedDuration) {
            QuizEngine.setExamDuration(parsed.parsedDuration);
            const durationSelect = document.getElementById('duration-selector');
            if (durationSelect) durationSelect.value = String(parsed.parsedDuration);
        } else {
            const durVal = document.getElementById('duration-selector')?.value || '60';
            QuizEngine.setExamDuration(durVal);
        }

        // When loading a new file or exam, always start clean with no revealed answers
        if (isNewExam) {
            StorageManager.clearState();
            QuizEngine.state.userAnswers = {};
            QuizEngine.state.flaggedQuestions = new Set();
            QuizEngine.state.customImages = (initialCustomImages && Object.keys(initialCustomImages).length > 0)
                ? Object.assign({}, initialCustomImages)
                : {};
            QuizEngine.state.isSubmitted = false;
            QuizEngine.state.timeLeft = QuizEngine.state.durationMinutes > 0 ? QuizEngine.state.durationMinutes * 60 : -1;
            QuizEngine.state.violationCount = 0;
            QuizEngine.state.violationLogs = [];
            QuizEngine.state.incorrectQData = [];
            StorageManager.saveState(QuizEngine.state);
        } else {
            // Restore saved progress ONLY if available, not submitted, and question count matches
            const saved = StorageManager.loadState();
            if (saved && !saved.isSubmitted && saved.questionCount === parsed.length) {
                QuizEngine.state.userAnswers = saved.answers || {};
                QuizEngine.state.flaggedQuestions = saved.flagged || new Set();
                QuizEngine.state.customImages = saved.customImages || {};
                QuizEngine.state.isSubmitted = false;
                QuizEngine.state.timeLeft = saved.timeLeft !== undefined ? saved.timeLeft : (QuizEngine.state.durationMinutes > 0 ? QuizEngine.state.durationMinutes * 60 : -1);
            } else {
                StorageManager.clearState();
                QuizEngine.state.userAnswers = {};
                QuizEngine.state.flaggedQuestions = new Set();
                QuizEngine.state.customImages = (initialCustomImages && Object.keys(initialCustomImages).length > 0)
                    ? Object.assign({}, initialCustomImages)
                    : {};
                QuizEngine.state.isSubmitted = false;
                QuizEngine.state.timeLeft = QuizEngine.state.durationMinutes > 0 ? QuizEngine.state.durationMinutes * 60 : -1;
                QuizEngine.state.violationCount = 0;
                QuizEngine.state.violationLogs = [];
                QuizEngine.state.incorrectQData = [];
                StorageManager.saveState(QuizEngine.state);
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
            onCheckAnswerClicked,
            QuizEngine.state.customImages,
            onImageAttached,
            onImageRemoved
        );
        refreshPalette();
        UIManager.updateStats(
            QuizEngine.state.questions,
            QuizEngine.state.userAnswers,
            QuizEngine.state.currentMode,
            QuizEngine.state.isSubmitted
        );
    }

    // Reactive MathJax hook when MathJax finishes loading asynchronously
    window.onMathJaxReady = () => {
        const container = document.getElementById('quiz-container');
        if (container && typeof UIManager !== 'undefined' && UIManager.typesetMathJaxProgressively) {
            UIManager.typesetMathJaxProgressively(container);
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

    function onImageAttached(qIndex, base64) {
        QuizEngine.attachQuestionImage(qIndex, base64);
        StorageManager.saveState(QuizEngine.state);
        refreshUI();
    }

    function onImageRemoved(qIndex) {
        QuizEngine.removeQuestionImage(qIndex);
        StorageManager.saveState(QuizEngine.state);
        refreshUI();
    }

    function startTimer() {
        if (timerInterval) clearInterval(timerInterval);

        const updateTimerDisplay = () => {
            const timerEl = document.getElementById('time-remaining');
            if (!timerEl) return;
            if (QuizEngine.state.timeLeft === -1) {
                timerEl.innerText = '♾️ --:--';
                return;
            }
            let m = Math.floor(QuizEngine.state.timeLeft / 60);
            let s = QuizEngine.state.timeLeft % 60;
            const display = (m < 10 ? '0' + m : m) + ':' + (s < 10 ? '0' + s : s);
            timerEl.innerText = display;
        };

        updateTimerDisplay();
        if (QuizEngine.state.timeLeft === -1) return;

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
