/**
 * i18n.js - Multi-language Localization Module
 * Supports English & Vietnamese with seamless switching
 */
const I18N = {
    vi: {
        appTitle: "Nền tảng thi trắc nghiệm đa môn học",
        uploadTitle: "Khởi tạo đề thi hoặc Khám phá kho đề tuyển chọn",
        uploadPrompt: "Hỗ trợ tải trực tiếp file <strong>.PDF</strong> (Tự động cắt ảnh/code), <strong>.DOCX (Word)</strong> và <strong>.TXT</strong>",
        dropzoneTitle: "Tải lên file đề thi",
        dropzoneHint: "Kéo thả file vào đây hoặc bấm nút duyệt file từ thiết bị",
        btnBrowse: "Chọn file từ thiết bị",
        btnSample: "Bắt đầu làm bài",
        curatedTitle: "Kho đề thi mẫu chuẩn",
        curatedSubtitle: "Chọn nhanh môn học để bắt đầu ôn luyện ngay",
        lblAnswered: "Đã làm:",
        lblCorrect: "Đúng:",
        lblIncorrect: "Sai:",
        btnSubmit: "Nộp bài",
        paletteTitle: "Bản đồ câu hỏi",
        fltAll: "Tất cả",
        fltAnswered: "Đã làm",
        fltFlagged: "Cần xem 🚩",
        fltUnanswered: "Chưa làm",
        legCorrect: "Đúng",
        legIncorrect: "Sai",
        legAnswered: "Đã chọn",
        legFlagged: "Đánh dấu 🚩",
        btnSubmitAside: "Nộp bài & Chấm điểm",
        btnShuffle: "🔀 Đảo đề",
        tooltipShuffle: "Đảo ngẫu nhiên câu hỏi và các đáp án",
        btnReset: "🔄 Làm mới",
        btnChangeExam: "📂 Đổi đề thi",
        confirmChangeExam: "Bạn có chắc muốn thoát bài làm hiện tại để tải lên đề thi khác không?",
        modalTitleDone: "Hoàn thành bài thi!",
        modalTitleTimeout: "Hết giờ làm bài!",
        modalSubtitle: "Kết quả chi tiết bài làm của bạn",
        modalCorrect: "Câu đúng",
        modalIncorrect: "Câu sai",
        modalUnattempted: "Chưa làm",
        modalReview: "Xem lại bài làm",
        modalExport: "Xuất PDF câu sai",
        modalNewQuiz: "🔄 Làm bài mới",
        cannotResetDuringExam: "Bạn đang trong quá trình làm bài thi! Không thể làm mới.\n\nVui lòng hoàn thành và nộp bài trước khi bắt đầu bài thi mới.",
        tooltipResetDisabled: "Không thể làm mới khi đang làm bài thi. Vui lòng nộp bài trước!",
        tooltipResetEnabled: "Làm mới và quay về màn hình nhập đề thi ban đầu",
        confirmFinish: "Bạn có chắc chắn muốn nộp bài sớm không?",
        unansweredWarning: "Bạn vẫn còn {0} câu chưa hoàn thành!",
        confirmReset: "Bạn có chắc muốn làm mới và quay về màn hình nhập đề thi ban đầu không?",
        confirmShuffle: "Bạn muốn đảo ngẫu nhiên danh sách câu hỏi và các đáp án?",
        singleHelp: "(Chọn duy nhất 1 đáp án đúng)",
        multipleHelp: "(Chọn một hoặc nhiều đáp án đúng rồi bấm 'Kiểm tra')",
        checkAnswer: "Kiểm tra đáp án",
        explanation: "Giải thích:",
        reviewFlag: "Xem lại",
        pdfReportTitle: "OmniQuiz - Báo cáo kết quả kiểm tra trắc nghiệm",
        pdfOutstanding: "Xuất sắc! Bạn đạt điểm tuyệt đối 100% không sai câu nào.",
        pdfReviewSection: "Danh sách câu hỏi cần ôn tập lại",
        correctAnswer: "Đáp án đúng:",
        prevQuestion: "Câu trước",
        nextQuestion: "Câu sau",
        questionLabel: "Câu",
        mobileFab: "Bản đồ",
        modePractice: "🎯 Luyện tập (Practice)",
        modeExam: "⏱️ Thi thử (Exam)",
        welcomeTitle: "Chào mừng bạn đến với OmniQuiz!",
        welcomeSubtitle: "Vui lòng tải lên file đề thi của bạn ở khung phía trên, hoặc chọn một đề mẫu đa môn học để bắt đầu ôn luyện.",
        subjects: {
            informatics_10: "💻 Tin học - Lập trình & CNTT (10 câu)",
            chem_40_pdf: "🧪 Hóa học - 40 câu trắc nghiệm (Trích xuất từ file PDF)",
            math_50: "📐 Toán học - Đề thi thử THPT (50 câu)",
            physics_12: "⚡ Vật lý 12 - Dao động cơ học (5 câu)",
            chem_12: "🧪 Hóa học 12 - Este & Lipit (5 câu)",
            english_thpt: "🇬🇧 Tiếng Anh THPT - Ngữ pháp (5 câu)",
            social_12: "🌏 KHXH - Lịch sử & Địa lý (5 câu)",
            sat_math: "🎓 Digital SAT Math CBT (English)",
            quick_5: "⚡ Đề kiểm tra nhanh (5 câu)"
        },
        pills: {
            informatics_10: "💻 Tin học",
            chem_40_pdf: "🧪 Hóa học",
            math_50: "📐 Toán học",
            physics_12: "⚡ Vật lý",
            sat_math: "🎓 SAT Math"
        }
    },
    en: {
        appTitle: "Universal Multi-Subject CBT Platform",
        uploadTitle: "Create an Exam or Explore Curated Question Banks",
        uploadPrompt: "Directly import <strong>.PDF</strong> (Auto-crop diagrams/code), <strong>.DOCX (Word)</strong>, and <strong>.TXT</strong>",
        dropzoneTitle: "Upload Exam File",
        dropzoneHint: "Drag & drop your exam file here or browse from device",
        btnBrowse: "Browse file from device",
        btnSample: "Start Selected Exam",
        curatedTitle: "Curated Question Banks",
        curatedSubtitle: "Quickly select a subject to start practicing immediately",
        lblAnswered: "Answered:",
        lblCorrect: "Correct:",
        lblIncorrect: "Incorrect:",
        btnSubmit: "Submit",
        paletteTitle: "Question Map",
        fltAll: "All",
        fltAnswered: "Answered",
        fltFlagged: "Flagged 🚩",
        fltUnanswered: "Unanswered",
        legCorrect: "Correct",
        legIncorrect: "Incorrect",
        legAnswered: "Selected",
        legFlagged: "Flagged 🚩",
        btnSubmitAside: "Submit & Grade Quiz",
        btnShuffle: "🔀 Shuffle",
        tooltipShuffle: "Shuffle questions and answer choices",
        btnReset: "🔄 Start Fresh",
        btnChangeExam: "📂 Change Exam",
        confirmChangeExam: "Are you sure you want to exit the current exam to choose another one?",
        modalTitleDone: "Quiz Completed!",
        modalTitleTimeout: "Time's Up!",
        modalSubtitle: "Your detailed quiz performance report",
        modalCorrect: "Correct",
        modalIncorrect: "Incorrect",
        modalUnattempted: "Unattempted",
        modalReview: "Review Answers",
        modalExport: "Export Incorrect (PDF)",
        modalNewQuiz: "🔄 New Exam / Upload",
        cannotResetDuringExam: "You are currently taking an exam! Resetting is disabled.\n\nPlease finish and submit your exam first before starting a new one.",
        tooltipResetDisabled: "Cannot reset while taking an exam. Please submit first!",
        tooltipResetEnabled: "Reset and return to the initial exam upload screen",
        confirmFinish: "Are you sure you want to finish the quiz?",
        unansweredWarning: "You still have {0} unanswered question(s)!",
        confirmReset: "Are you sure you want to reset and return to the initial exam upload screen?",
        confirmShuffle: "Shuffle questions and choices?",
        singleHelp: "(Select exactly one correct option)",
        multipleHelp: "(Select one or more options and click 'Check Answer')",
        checkAnswer: "Check Answer",
        explanation: "Explanation:",
        reviewFlag: "Review",
        pdfReportTitle: "OmniQuiz - Performance Report",
        pdfOutstanding: "Outstanding! You scored 100% with no incorrect answers.",
        pdfReviewSection: "Questions for Review",
        correctAnswer: "Correct Answer:",
        prevQuestion: "Previous",
        nextQuestion: "Next",
        questionLabel: "Question",
        mobileFab: "Map",
        modePractice: "🎯 Practice Mode",
        modeExam: "⏱️ Exam Mode",
        welcomeTitle: "Welcome to OmniQuiz!",
        welcomeSubtitle: "Please upload your exam file in the area above, or choose a curated multi-subject test to begin practicing.",
        subjects: {
            informatics_10: "💻 Computer Science - Programming & IT (10 questions)",
            chem_40_pdf: "🧪 Chemistry - 40 Questions (Extracted from PDF)",
            math_50: "📐 Mathematics - High School Mock Exam (50 questions)",
            physics_12: "⚡ Physics 12 - Harmonic Oscillation (5 questions)",
            chem_12: "🧪 Chemistry 12 - Esters & Lipids (5 questions)",
            english_thpt: "🇬🇧 High School English - Grammar & Reading (5 questions)",
            social_12: "🌏 Social Sciences - History & Geography (5 questions)",
            sat_math: "🎓 Digital SAT Math CBT (English)",
            quick_5: "⚡ Quick Check Exam (5 questions)"
        },
        pills: {
            informatics_10: "💻 Informatics",
            chem_40_pdf: "🧪 Chemistry",
            math_50: "📐 Mathematics",
            physics_12: "⚡ Physics",
            sat_math: "🎓 SAT Math"
        }
    }
};

let currentLang = 'vi';

function t(key, ...params) {
    let str = (I18N[currentLang] && I18N[currentLang][key]) || (I18N['en'][key]) || key;
    params.forEach((param, index) => {
        str = str.replace(`{${index}}`, param);
    });
    return str;
}

function updateUILanguage(lang) {
    currentLang = lang;
    const trans = I18N[currentLang] || I18N['en'];

    const elementMap = {
        'txt-app-title': trans.appTitle,
        'txt-upload-title': trans.uploadTitle,
        'txt-upload-prompt': trans.uploadPrompt,
        'txt-btn-browse': trans.btnBrowse,
        'txt-btn-sample': trans.btnSample,
        'txt-btn-change-exam': trans.btnChangeExam,
        'lbl-answered': trans.lblAnswered,
        'finish-btn': trans.btnSubmit,
        'txt-btn-submit-aside': trans.btnSubmitAside,
        'btn-shuffle': trans.btnShuffle,
        'btn-reset': trans.btnReset,
        'txt-leg-correct': trans.legCorrect,
        'txt-leg-incorrect': trans.legIncorrect,
        'txt-leg-answered': trans.legAnswered,
        'txt-leg-flagged': trans.legFlagged,
        'txt-mobile-fab-lbl': trans.mobileFab,
        'modal-subtitle': trans.modalSubtitle,
        'txt-modal-correct': trans.modalCorrect,
        'txt-modal-incorrect': trans.modalIncorrect,
        'txt-modal-unattempted': trans.modalUnattempted,
        'txt-modal-review': trans.modalReview,
        'txt-modal-export': trans.modalExport,
        'txt-modal-new-quiz': trans.modalNewQuiz
    };

    for (const [id, text] of Object.entries(elementMap)) {
        const el = document.getElementById(id);
        if (el) {
            if (id === 'txt-upload-prompt') el.innerHTML = text;
            else el.innerText = text;
        }
    }

    // Palette title with icon
    const palTitle = document.getElementById('txt-palette-title');
    if (palTitle) {
        palTitle.innerHTML = `<span>📋</span> <span>${trans.paletteTitle}</span>`;
    }

    // Dropzone labels
    const dropTitle = document.querySelector('.dropzone-title');
    if (dropTitle) dropTitle.innerText = trans.dropzoneTitle;
    const dropHint = document.querySelector('.dropzone-hint');
    if (dropHint) dropHint.innerText = trans.dropzoneHint;

    // Curated header labels
    const curTitle = document.querySelector('.curated-title');
    if (curTitle) curTitle.innerText = trans.curatedTitle;
    const curSub = document.querySelector('.curated-subtitle');
    if (curSub) curSub.innerText = trans.curatedSubtitle;

    // Tooltip for shuffle button
    const btnShuffle = document.getElementById('btn-shuffle');
    if (btnShuffle && trans.tooltipShuffle) {
        btnShuffle.title = trans.tooltipShuffle;
    }

    // Update Mode Selector options
    const modeSelect = document.getElementById('mode-selector');
    if (modeSelect) {
        const optPractice = modeSelect.querySelector('option[value="practice"]');
        if (optPractice) optPractice.innerText = trans.modePractice;
        const optExam = modeSelect.querySelector('option[value="exam"]');
        if (optExam) optExam.innerText = trans.modeExam;
    }

    // Update Subject Select options
    const sampleSelect = document.getElementById('sample-subject-select');
    if (sampleSelect && trans.subjects) {
        for (const [key, label] of Object.entries(trans.subjects)) {
            const opt = sampleSelect.querySelector(`option[value="${key}"]`);
            if (opt) opt.innerText = label;
        }
    }

    // Update Subject Quick Pills
    if (trans.pills) {
        document.querySelectorAll('.subj-pill').forEach(pill => {
            const subj = pill.getAttribute('data-subj');
            if (subj && trans.pills[subj]) {
                pill.innerText = trans.pills[subj];
            }
        });
    }

    // Update Empty Welcome message if currently visible
    const emptyWelcome = document.getElementById('empty-quiz-welcome');
    if (emptyWelcome) {
        const h3 = emptyWelcome.querySelector('h3');
        const p = emptyWelcome.querySelector('p');
        if (h3) h3.innerText = trans.welcomeTitle;
        if (p) p.innerText = trans.welcomeSubtitle;
    }

    // Stats bar labels
    const lblCorrect = document.getElementById('lbl-correct');
    if (lblCorrect && lblCorrect.childNodes[0]) {
        lblCorrect.childNodes[0].nodeValue = trans.lblCorrect + ' ';
    }
    const lblIncorrect = document.getElementById('lbl-incorrect');
    if (lblIncorrect && lblIncorrect.childNodes[0]) {
        lblIncorrect.childNodes[0].nodeValue = trans.lblIncorrect + ' ';
    }
}
