/**
 * i18n.js - Multi-language Localization Module
 * Supports English & Vietnamese with seamless switching
 */
const I18N = {
    vi: {
        appTitle: "OmniQuiz - Nền tảng thi trắc nghiệm",
        uploadTitle: "Kéo thả file đề thi hoặc tải lên từ máy tính",
        uploadPrompt: "Hỗ trợ định dạng <strong>.docx (Word)</strong> và <strong>.txt</strong> (Định dạng chuẩn hoặc đề thi tự nhiên)",
        btnBrowse: "Chọn file từ máy",
        btnSample: "Nạp đề thi mẫu (50 câu)",
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
        mobileFab: "Bản đồ"
    },
    en: {
        appTitle: "OmniQuiz - Multi-Subject CBT Platform",
        uploadTitle: "Drag & drop quiz file or browse from computer",
        uploadPrompt: "Supports <strong>.docx (Word)</strong> and <strong>.txt</strong> (Standard CBT or natural exam format)",
        btnBrowse: "Browse file",
        btnSample: "Load Demo Exam (50 Questions)",
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
        mobileFab: "Map"
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
        'txt-palette-title': trans.paletteTitle,
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

    const lblCorrect = document.getElementById('lbl-correct');
    if (lblCorrect && lblCorrect.childNodes[0]) {
        lblCorrect.childNodes[0].nodeValue = trans.lblCorrect + ' ';
    }
    const lblIncorrect = document.getElementById('lbl-incorrect');
    if (lblIncorrect && lblIncorrect.childNodes[0]) {
        lblIncorrect.childNodes[0].nodeValue = trans.lblIncorrect + ' ';
    }
}
