/**
 * i18n.js - Multi-language Localization Module
 * Supports English & Vietnamese with seamless live switching
 * Complete coverage across all UI cards, modals, navigation, and controls
 */
const I18N = {
    vi: {
        // App & Brand
        appTitle: "Nền tảng thi trắc nghiệm đa môn học",
        uploadTitle: "Khởi tạo đề thi hoặc Khám phá kho đề tuyển chọn",
        uploadPrompt: "Hỗ trợ tải trực tiếp file <strong>.PDF</strong> (Tự động cắt ảnh/code), <strong>.DOCX (Word)</strong> và <strong>.TXT</strong>",
        dropzoneTitle: "Tải lên file đề thi",
        dropzoneHint: "Kéo thả file vào đây hoặc bấm nút duyệt file từ thiết bị",
        btnBrowse: "Chọn file từ thiết bị",
        btnSample: "Bắt đầu làm bài",
        btnHeroOcr: "📸 Quét ảnh đề (OCR AI)",
        btnStudioHero: "✏️ Tự soạn đề thi",
        dropzoneNote: "* File .doc cũ: Vui lòng lưu thành .docx để đọc tốt nhất",

        // Navbar Controls & Tooltips
        navAiTutor: "Gia sư AI",
        navTools: "Tiện ích",
        navAccount: "Tài khoản",
        navThemeTitle: "Đổi màu giao diện / Chế độ tập trung (Sepia, Sage, Dark...)",
        navAiTutorTitle: "Trợ lý Gia sư AI & Trích xuất đề thi từ ảnh (Gemini OCR)",
        navToolsTitle: "Tiện ích & Cài đặt hệ thống",
        navServerStatusTitle: "Trạng thái kết nối máy chủ OmniQuiz Cloud",
        navAccountTitle: "Đăng nhập / Quản lý tài khoản",
        navFullscreenTitle: "Toàn màn hình",
        navResetTitle: "Làm mới và quay về trang nhập đề thi",

        // Duration Options
        lblExamDuration: "Thời gian:",
        optDurationUnlimited: "Không giới hạn",
        optDurationMins: "{0} phút",
        optDuration15: "⏱️ 15 phút",
        optDuration30: "⏱️ 30 phút",
        optDuration45: "⏱️ 45 phút",
        optDuration60: "⏱️ 60 phút",
        optDuration90: "⏱️ 90 phút",
        optDuration120: "⏱️ 120 phút",
        optDuration0: "♾️ Không giới hạn",

        // Curated Banks & Join Room
        curatedTitle: "Kho đề thi mẫu chuẩn",
        curatedSubtitle: "Chọn nhanh môn học để bắt đầu ôn luyện ngay",
        optgroupCloud: "🌐 Đề thi Máy chủ (Cloud Database)",
        optgroupOffline: "📚 Đề thi mẫu Offline",
        joinPinTitle: "Phòng thi trực tuyến",
        joinPinSubtitle: "Nhập mã PIN 6 số để vào thi ngay",
        joinPinPlaceholder: "MÃ PIN 6 SỐ",
        joinNamePlaceholder: "Họ và tên thí sinh...",
        joinSbdPlaceholder: "Số báo danh / Lớp (tùy chọn)...",
        btnJoinRoom: "🎯 Vào phòng thi",

        // Stats & Palette
        lblAnswered: "Đã làm:",
        lblCorrect: "Đúng:",
        lblIncorrect: "Sai:",
        lblUnattempted: "Chưa làm:",
        btnSubmit: "Nộp bài",
        paletteTitle: "Bản đồ câu hỏi",
        fltAll: "Tất cả",
        fltAnswered: "Đã làm",
        fltFlagged: "Cần xem 🚩",
        fltUnanswered: "Chưa làm",
        fltIncorrect: "❌ Câu sai",
        legCorrect: "Đúng",
        legIncorrect: "Sai",
        legAnswered: "Đã chọn",
        legFlagged: "Đánh dấu 🚩",
        legUnattempted: "Chưa làm",
        btnSubmitAside: "Nộp bài & Chấm điểm",
        btnShuffle: "🔀 Đảo đề",
        tooltipShuffle: "Đảo ngẫu nhiên câu hỏi và các đáp án",
        btnReset: "🔄 Làm mới",
        btnChangeExam: "📂 Đổi đề thi",
        confirmChangeExam: "Bạn có chắc muốn thoát bài làm hiện tại để tải lên đề thi khác không?",

        // Questions & Answering
        singleHelp: "(Chọn duy nhất 1 đáp án đúng)",
        multipleHelp: "(Chọn một hoặc nhiều đáp án đúng rồi bấm 'Kiểm tra')",
        checkAnswer: "Kiểm tra đáp án",
        explanation: "Giải thích:",
        reviewFlag: "Xem lại",
        flagActive: "Đã gắn cờ",
        prevQuestion: "Câu trước",
        nextQuestion: "Câu sau",
        questionLabel: "Câu",
        mobileFab: "Bản đồ",
        modePractice: "🎯 Luyện tập",
        modeExam: "⏱️ Thi thử",
        modeFlashcard: "🎴 Flashcard",
        askAiTutor: "Hỏi Gia sư AI (Phân tích bẫy & Mẹo giải nhanh)",
        noAnswerDeclared: "Chưa có đáp án chính thức",
        badgeCorrect: "Đúng",
        badgeIncorrect: "Sai",
        badgeUnattempted: "Chưa làm",
        toastSelectFirst: "Vui lòng chọn ít nhất một đáp án trước khi kiểm tra!",

        // Summary Modal
        modalTitleDone: "Hoàn thành bài thi!",
        modalTitleTimeout: "Hết giờ làm bài!",
        modalSubtitle: "Kết quả chi tiết bài làm của bạn",
        modalCorrect: "Câu đúng",
        modalIncorrect: "Câu sai",
        modalUnattempted: "Chưa làm",
        modalReview: "Xem lại bài làm",
        modalExport: "Xuất PDF câu sai",
        modalNewQuiz: "🔄 Làm bài mới",
        btnRetakeIncorrect: "🎯 Luyện lại câu sai ({0})",
        btnRetakeUnattempted: "🎯 Làm lại câu chưa làm ({0})",
        btnRetakeMixed: "🎯 Luyện lại {0} câu chưa đạt ({1} câu sai + {2} chưa làm)",
        lblPacing: "Tốc độ tb/câu",

        // Submit Confirm Modal
        confirmTitle: "Xác Nhận Nộp Bài Thi",
        confirmSubtitle: "Vui lòng kiểm tra kỹ ma trận trạng thái bài làm trước khi nộp điểm chính thức",
        matrixAnswered: "Đã làm",
        matrixUnanswered: "Chưa làm",
        matrixFlagged: "Đang cắm cờ",
        btnCancelSubmit: "↩️ Quay lại làm bài",
        btnProceedSubmit: "✓ Xác nhận nộp bài",
        confirmWarningTitle: "Cảnh báo:",
        confirmWarningText: "Bạn vẫn còn {0} câu chưa làm. Các câu này sẽ bị tính 0 điểm nếu nộp bài ngay bây giờ!",

        // Anti-Cheat & Reset Alerts
        antiCheatWarningTitle: "⚠️ Cảnh báo Liêm chính Phòng thi!",
        antiCheatWarningText: "Hệ thống phát hiện bạn vừa rời khỏi màn hình bài thi (chuyển tab hoặc ứng dụng khác).",
        antiCheatViolations: "Số lần vi phạm: {0}/{1}",
        antiCheatLimitReached: "Bạn đã vi phạm rời màn hình quá số lần quy định. Bài thi sẽ được tự động thu nộp ngay bây giờ!",
        antiCheatBtnAcknowledge: "Tôi hiểu và cam kết tiếp tục làm bài",
        antiCheatCopyWarning: "⚠️ Chế độ Thi thử: Đã khóa thao tác sao chép & chuột phải để đảm bảo tính công bằng!",
        cannotResetDuringExam: "Bạn đang trong quá trình làm bài thi! Không thể làm mới.\n\nVui lòng hoàn thành và nộp bài trước khi bắt đầu bài thi mới.",
        tooltipResetDisabled: "Không thể làm mới khi đang làm bài thi. Vui lòng nộp bài trước!",
        tooltipResetEnabled: "Làm mới và quay về màn hình nhập đề thi ban đầu",
        confirmFinish: "Bạn có chắc chắn muốn nộp bài sớm không?",
        unansweredWarning: "Bạn vẫn còn {0} câu chưa hoàn thành!",
        confirmReset: "Bạn có chắc muốn làm mới và quay về màn hình nhập đề thi ban đầu không?",
        confirmShuffle: "Bạn muốn đảo ngẫu nhiên danh sách câu hỏi và các đáp án?",
        btnFullscreen: "⛶ Toàn màn hình",
        btnExitFullscreen: "🗗 Thu nhỏ",
        lblViolations: "Rời màn hình:",
        cleanViolations: "0 lần (Hợp lệ)",

        // Tools & Settings Center Modal
        toolsModalTitle: "Trung Tâm Tiện Ích & Cài Đặt",
        toolsModalSubtitle: "Tùy chỉnh giao diện, công cụ đề thi, phòng thi trực tuyến và trợ lý AI",
        toolsCard1Title: "Giao diện & Chế độ màu",
        toolsCard1Desc: "Tối ưu độ tương phản và êm mắt khi làm bài thi",
        badgeThemeAcademic: "Mặc định",
        badgeThemeSepia: "Giấy êm mắt",
        badgeThemeEmerald: "Thảo mộc dịu",
        badgeThemeCyberpunk: "Đêm dịu mắt",
        badgeThemeMinimalist: "Tối giản",
        badgeThemePlayful: "Gam ấm",
        toolsLangLabel: "🌐 Ngôn ngữ:",
        toolsSoundLabel: "🔊 Hiệu ứng âm thanh:",
        soundOn: "🔔 Bật",
        soundOff: "🔇 Tắt (Tối ưu phản hồi)",
        toolsCard2Title: "Công cụ soạn thảo & Đề thi",
        toolsCard2Desc: "Biên tập câu hỏi, xáo trộn và xem lịch sử",
        toolsStudioName: "Question Studio",
        toolsStudioDesc: "Soạn thảo, thêm bớt câu hỏi, chỉnh sửa LaTeX/KaTeX",
        toolsShuffleName: "Xáo trộn đề & Đáp án",
        toolsShuffleDesc: "Đảo ngẫu nhiên vị trí câu hỏi và phương án A, B, C, D",
        toolsHistoryName: "Lịch sử thi & Bảng điểm",
        toolsHistoryDesc: "Xem lại điểm số, câu đúng/sai và đồng bộ đám mây",
        toolsCard3Title: "Phòng thi trực tuyến (CBT Online)",
        toolsCard3Desc: "Tổ chức thi đồng bộ và theo dõi xếp hạng thời gian thực",
        toolsHostName: "Khởi tạo phòng thi (Mã PIN)",
        toolsHostDesc: "Tạo mã PIN 6 số để học sinh vào thi cùng lúc trên các thiết bị",
        toolsLbName: "Bảng xếp hạng trực tiếp",
        toolsLbDesc: "Xem điểm số, thời gian làm bài và thứ hạng thời gian thực",
        toolsCard4Title: "Trí tuệ nhân tạo (AI Assistant)",
        toolsCard4Desc: "Quét ảnh đề OCR và phân tích bẫy câu hỏi",
        toolsOcrName: "Quét ảnh đề thi (AI OCR Vision)",
        toolsOcrDesc: "Chụp hoặc tải ảnh đề giấy để Gemini tự động trích xuất đề",
        toolsAiKeyName: "Cài đặt Gemini API Key",
        toolsAiKeyDesc: "Quản lý khóa API cá nhân để dùng AI miễn phí không giới hạn",
        btnDoneTools: "✓ Hoàn tất",

        // Question Studio Modal
        studioHeaderTitle: "Question Studio - Biên Tập & Soạn Thảo Đề Thi",
        studioBtnPaste: "📸 Dán nhanh / OCR",
        studioBtnExportJson: "📥 Xuất JSON",
        studioBtnExportTxt: "📄 Xuất TXT",
        studioBtnCloud: "☁️ Lưu lên Máy chủ",
        studioBtnApply: "💾 Áp dụng & Bắt đầu thi",
        studioSearchPlaceholder: "🔍 Tìm câu hỏi...",
        studioBtnAddQ: "➕ Thêm câu mới",

        // Host Room Modal
        hostTitle: "🌐 Mở Phòng Thi Trực Tuyến",
        hostDesc: "Khởi tạo phòng thi với mã PIN để thí sinh truy cập đồng thời từ bất kỳ thiết bị nào.",
        hostLblTitle: "Tên đề / Tiêu đề phòng thi:",
        hostInputTitlePlaceholder: "VD: Kiểm tra 15 phút - Tin học 10",
        hostLblQCount: "Số câu hỏi:",
        hostLblDuration: "Thời gian làm bài:",
        hostLblAnticheat: "Bật chế độ Giám sát phòng thi (Bắt buộc Toàn màn hình & khóa khi vi phạm)",
        btnConfirmHost: "🚀 Kích hoạt & Nhận mã PIN",
        hostPinLbl: "MÃ PIN PHÒNG THI",
        hostPinDesc: "Cung cấp mã PIN này cho thí sinh để vào làm bài thi",
        btnCopyPin: "📋 Sao chép mã PIN",
        btnViewLb: "🏆 Bảng xếp hạng",

        // Room Leaderboard Modal
        lbTitle: "🏆 Bảng Xếp Hạng Phòng Thi",
        lbPinLabel: "Mã PIN",
        btnRefreshLb: "🔄 Làm mới",
        thLbRank: "Hạng",
        thLbName: "Thí sinh",
        thLbSbd: "SBD / Lớp",
        thLbScore: "Điểm",
        thLbTime: "Thời gian",
        thLbViolations: "Vi phạm",

        // Exam History Modal
        histTitle: "📜 Lịch Sử Bài Thi & Thống Kê",
        histSubtitle: "Lưu trữ bài thi cục bộ (IndexedDB) & Tự động đồng bộ Supabase Cloud",
        histStatTotal: "Bài thi đã làm",
        histStatAvg: "Điểm trung bình (/10)",
        histStatBest: "Điểm cao nhất (/100)",
        tabHistList: "Danh sách bài thi",
        btnClearHistory: "Xóa toàn bộ lịch sử",
        btnCloseHistory: "Đóng",

        // Full-Stack Auth Modal
        authTitle: "Tài khoản OmniQuiz PRO",
        authSubtitle: "Xác thực máy chủ bảo mật JWT & RBAC",
        tabLogin: "Đăng nhập",
        tabRegister: "Đăng ký mới",
        lblLoginEmail: "Email đăng nhập",
        lblLoginPassword: "Mật khẩu",
        btnLoginSubmit: "🚀 Đăng nhập hệ thống",
        authDemoTitle: "⚡ Đăng nhập nhanh tài khoản mẫu:",
        btnDemoTeacher: "👨‍🏫 Giáo viên (Admin)",
        btnDemoStudent: "🎓 Học sinh",
        lblRegName: "Họ và tên",
        lblRegEmail: "Email",
        lblRegPassword: "Mật khẩu (Tối thiểu 6 ký tự)",
        lblRegRole: "Vai trò",
        optRoleStudent: "🎓 Thí sinh / Học sinh",
        optRoleTeacher: "👨‍🏫 Giáo viên / Giảng viên",
        btnRegSubmit: "✨ Tạo tài khoản ngay",

        // Welcome / Fallback
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
        // App & Brand
        appTitle: "Universal Multi-Subject CBT Platform",
        uploadTitle: "Create an Exam or Explore Curated Question Banks",
        uploadPrompt: "Directly import <strong>.PDF</strong> (Auto-crop diagrams/code), <strong>.DOCX (Word)</strong>, and <strong>.TXT</strong>",
        dropzoneTitle: "Upload Exam File",
        dropzoneHint: "Drag & drop your exam file here or browse from device",
        btnBrowse: "Browse file from device",
        btnSample: "Start Selected Exam",
        btnHeroOcr: "📸 Scan Exam (AI OCR)",
        btnStudioHero: "✏️ Question Studio",
        dropzoneNote: "* Legacy .doc files: Please save as .docx for best parsing",

        // Navbar Controls & Tooltips
        navAiTutor: "AI Tutor",
        navTools: "Tools",
        navAccount: "Account",
        navThemeTitle: "Switch Theme / Focus Mode (Sepia, Sage, Dark...)",
        navAiTutorTitle: "AI Tutor Assistant & Exam OCR (Gemini)",
        navToolsTitle: "Tools & Settings Center",
        navServerStatusTitle: "OmniQuiz Cloud Server Connection Status",
        navAccountTitle: "Login / Account Management",
        navFullscreenTitle: "Fullscreen",
        navResetTitle: "Start fresh and return to upload screen",

        // Duration Options
        lblExamDuration: "Duration:",
        optDurationUnlimited: "No limit",
        optDurationMins: "{0} mins",
        optDuration15: "⏱️ 15 mins",
        optDuration30: "⏱️ 30 mins",
        optDuration45: "⏱️ 45 mins",
        optDuration60: "⏱️ 60 mins",
        optDuration90: "⏱️ 90 mins",
        optDuration120: "⏱️ 120 mins",
        optDuration0: "♾️ Unlimited",

        // Curated Banks & Join Room
        curatedTitle: "Curated Question Banks",
        curatedSubtitle: "Quickly select a subject to start practicing immediately",
        optgroupCloud: "🌐 Cloud Exams (Online Server)",
        optgroupOffline: "📚 Offline Sample Exams",
        joinPinTitle: "Online Exam Room",
        joinPinSubtitle: "Enter 6-digit PIN to join instantly",
        joinPinPlaceholder: "6-DIGIT PIN",
        joinNamePlaceholder: "Candidate full name...",
        joinSbdPlaceholder: "Candidate ID / Class (optional)...",
        btnJoinRoom: "🎯 Join Exam Room",

        // Stats & Palette
        lblAnswered: "Answered:",
        lblCorrect: "Correct:",
        lblIncorrect: "Incorrect:",
        lblUnattempted: "Unattempted:",
        btnSubmit: "Submit",
        paletteTitle: "Question Map",
        fltAll: "All",
        fltAnswered: "Answered",
        fltFlagged: "Flagged 🚩",
        fltUnanswered: "Unanswered",
        fltIncorrect: "❌ Incorrect",
        legCorrect: "Correct",
        legIncorrect: "Incorrect",
        legAnswered: "Selected",
        legFlagged: "Flagged 🚩",
        legUnattempted: "Unattempted",
        btnSubmitAside: "Submit & Grade Quiz",
        btnShuffle: "🔀 Shuffle",
        tooltipShuffle: "Shuffle questions and answer choices",
        btnReset: "🔄 Start Fresh",
        btnChangeExam: "📂 Change Exam",
        confirmChangeExam: "Are you sure you want to exit the current exam to choose another one?",

        // Questions & Answering
        singleHelp: "(Select exactly one correct option)",
        multipleHelp: "(Select one or more options and click 'Check Answer')",
        checkAnswer: "Check Answer",
        explanation: "Explanation:",
        reviewFlag: "Review",
        flagActive: "Flagged",
        prevQuestion: "Previous",
        nextQuestion: "Next",
        questionLabel: "Question",
        mobileFab: "Map",
        modePractice: "🎯 Practice",
        modeExam: "⏱️ Exam",
        modeFlashcard: "🎴 Flashcard",
        askAiTutor: "Ask AI Tutor (Trap Analysis & Speed Tips)",
        noAnswerDeclared: "No official answer key",
        badgeCorrect: "Correct",
        badgeIncorrect: "Incorrect",
        badgeUnattempted: "Unattempted",
        toastSelectFirst: "Please select at least one option before checking!",

        // Summary Modal
        modalTitleDone: "Quiz Completed!",
        modalTitleTimeout: "Time's Up!",
        modalSubtitle: "Your detailed quiz performance report",
        modalCorrect: "Correct",
        modalIncorrect: "Incorrect",
        modalUnattempted: "Unattempted",
        modalReview: "Review Answers",
        modalExport: "Export Incorrect (PDF)",
        modalNewQuiz: "🔄 New Exam / Upload",
        btnRetakeIncorrect: "🎯 Retake Mistakes ({0})",
        btnRetakeUnattempted: "🎯 Attempt Unanswered ({0})",
        btnRetakeMixed: "🎯 Retake {0} Missed Questions ({1} wrong + {2} unattempted)",
        lblPacing: "Avg Pacing",

        // Submit Confirm Modal
        confirmTitle: "Confirm Exam Submission",
        confirmSubtitle: "Please review your question completion matrix before final grading",
        matrixAnswered: "Answered",
        matrixUnanswered: "Unattempted",
        matrixFlagged: "Flagged",
        btnCancelSubmit: "↩️ Return to Exam",
        btnProceedSubmit: "✓ Submit & Grade",
        confirmWarningTitle: "Warning:",
        confirmWarningText: "You still have {0} unanswered question(s). These will be graded 0 points if submitted now!",

        // Anti-Cheat & Reset Alerts
        antiCheatWarningTitle: "⚠️ Exam Integrity Alert!",
        antiCheatWarningText: "The system detected that you left the exam screen (tab switch or external application).",
        antiCheatViolations: "Violations: {0}/{1}",
        antiCheatLimitReached: "You have exceeded the maximum allowed screen-switch violations. Your exam will be automatically submitted now!",
        antiCheatBtnAcknowledge: "I understand and promise to continue my exam",
        antiCheatCopyWarning: "⚠️ Exam Mode: Copy-paste and right-click are disabled to ensure test integrity!",
        cannotResetDuringExam: "You are currently taking an exam! Resetting is disabled.\n\nPlease finish and submit your exam first before starting a new one.",
        tooltipResetDisabled: "Cannot reset while taking an exam. Please submit first!",
        tooltipResetEnabled: "Reset and return to the initial exam upload screen",
        confirmFinish: "Are you sure you want to finish the quiz?",
        unansweredWarning: "You still have {0} unanswered question(s)!",
        confirmReset: "Are you sure you want to reset and return to the initial exam upload screen?",
        confirmShuffle: "Shuffle questions and choices?",
        btnFullscreen: "⛶ Fullscreen",
        btnExitFullscreen: "🗗 Exit Fullscreen",
        lblViolations: "Screen switches:",
        cleanViolations: "0 times (Valid)",

        // Tools & Settings Center Modal
        toolsModalTitle: "Tools & Settings Center",
        toolsModalSubtitle: "Customize themes, authoring tools, online CBT room, and AI assistant",
        toolsCard1Title: "Theme & Focus Appearance",
        toolsCard1Desc: "Optimized contrast and eye comfort for long exam sessions",
        badgeThemeAcademic: "Default",
        badgeThemeSepia: "Warm Paper",
        badgeThemeEmerald: "Sage Calm",
        badgeThemeCyberpunk: "Nordic Night",
        badgeThemeMinimalist: "Minimalist",
        badgeThemePlayful: "Soft Warm",
        toolsLangLabel: "🌐 Language:",
        toolsSoundLabel: "🔊 Sound Effects:",
        soundOn: "🔔 On",
        soundOff: "🔇 Off (Max Speed)",
        toolsCard2Title: "Authoring Tools & Exam Utilities",
        toolsCard2Desc: "Edit questions, shuffle items, and view exam records",
        toolsStudioName: "Question Studio",
        toolsStudioDesc: "Compose, add/remove questions, edit LaTeX/KaTeX",
        toolsShuffleName: "Shuffle Questions & Choices",
        toolsShuffleDesc: "Randomize question order and A, B, C, D options",
        toolsHistoryName: "Exam History & Score Records",
        toolsHistoryDesc: "Review scores, accuracy, and cloud sync history",
        toolsCard3Title: "Online CBT Exam Rooms",
        toolsCard3Desc: "Host synchronized exams and live leaderboard",
        toolsHostName: "Host Exam Room (PIN Code)",
        toolsHostDesc: "Create 6-digit PIN for students to take the exam simultaneously",
        toolsLbName: "Live Leaderboard",
        toolsLbDesc: "View real-time rankings, scores, and completion times",
        toolsCard4Title: "Artificial Intelligence (AI Assistant)",
        toolsCard4Desc: "OCR paper exam scan and trap analysis",
        toolsOcrName: "Scan Exam Photo (AI OCR Vision)",
        toolsOcrDesc: "Snap or upload photo for Gemini to automatically extract questions",
        toolsAiKeyName: "Gemini API Key Settings",
        toolsAiKeyDesc: "Manage your personal API key for unlimited free AI access",
        btnDoneTools: "✓ Done",

        // Question Studio Modal
        studioHeaderTitle: "Question Studio - Exam Authoring & Editing",
        studioBtnPaste: "📸 Quick Paste / OCR",
        studioBtnExportJson: "📥 Export JSON",
        studioBtnExportTxt: "📄 Export TXT",
        studioBtnCloud: "☁️ Save to Cloud",
        studioBtnApply: "💾 Apply & Start Exam",
        studioSearchPlaceholder: "🔍 Search questions...",
        studioBtnAddQ: "➕ Add New Question",

        // Host Room Modal
        hostTitle: "🌐 Host Online Exam Room",
        hostDesc: "Create an exam room with a PIN for students to access simultaneously from any device.",
        hostLblTitle: "Exam Title / Room Name:",
        hostInputTitlePlaceholder: "e.g. 15-Minute Informatics Quiz",
        hostLblQCount: "Number of Questions:",
        hostLblDuration: "Exam Duration:",
        hostLblAnticheat: "Enable Proctoring Mode (Enforced fullscreen & lock on violation)",
        btnConfirmHost: "🚀 Activate & Generate PIN",
        hostPinLbl: "EXAM ROOM PIN",
        hostPinDesc: "Provide this PIN code to students to enter the exam",
        btnCopyPin: "📋 Copy PIN Code",
        btnViewLb: "🏆 Leaderboard",

        // Room Leaderboard Modal
        lbTitle: "🏆 Exam Room Leaderboard",
        lbPinLabel: "PIN Code",
        btnRefreshLb: "🔄 Refresh",
        thLbRank: "Rank",
        thLbName: "Student Name",
        thLbSbd: "ID / Class",
        thLbScore: "Score",
        thLbTime: "Duration",
        thLbViolations: "Violations",

        // Exam History Modal
        histTitle: "📜 Exam History & Analytics",
        histSubtitle: "Local IndexedDB storage & automatic Supabase Cloud synchronization",
        histStatTotal: "Exams Taken",
        histStatAvg: "Average Score (/10)",
        histStatBest: "High Score (/100)",
        tabHistList: "Exam Records",
        btnClearHistory: "Clear All Records",
        btnCloseHistory: "Close",

        // Full-Stack Auth Modal
        authTitle: "OmniQuiz PRO Account",
        authSubtitle: "Secure Server Authentication JWT & RBAC",
        tabLogin: "Sign In",
        tabRegister: "Create Account",
        lblLoginEmail: "Email Address",
        lblLoginPassword: "Password",
        btnLoginSubmit: "🚀 Sign In",
        authDemoTitle: "⚡ Quick Demo Login:",
        btnDemoTeacher: "👨‍🏫 Teacher (Admin)",
        btnDemoStudent: "🎓 Student",
        lblRegName: "Full Name",
        lblRegEmail: "Email Address",
        lblRegPassword: "Password (min 6 characters)",
        lblRegRole: "Account Role",
        optRoleStudent: "🎓 Candidate / Student",
        optRoleTeacher: "👨‍🏫 Teacher / Instructor",
        btnRegSubmit: "✨ Create Account Now",

        // Welcome / Fallback
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
        // Brand & Hero
        'txt-app-title': trans.appTitle,
        'txt-upload-title': trans.uploadTitle,
        'txt-upload-prompt': trans.uploadPrompt,
        'txt-dropzone-title': trans.dropzoneTitle,
        'txt-dropzone-hint': trans.dropzoneHint,
        'txt-curated-title': trans.curatedTitle,
        'txt-curated-subtitle': trans.curatedSubtitle,
        'txt-btn-browse': trans.btnBrowse,
        'txt-btn-sample': trans.btnSample,
        'txt-btn-hero-ocr': trans.btnHeroOcr,
        'txt-btn-studio-hero': trans.btnStudioHero,
        'txt-dropzone-note': trans.dropzoneNote,
        'txt-btn-change-exam': trans.btnChangeExam,

        // Navbar Action Buttons
        'txt-btn-ai-tutor': trans.navAiTutor,
        'txt-btn-tools': trans.navTools,
        'auth-btn-label': trans.navAccount,

        // Curated & Join Room
        'txt-join-pin-title': trans.joinPinTitle,
        'txt-join-pin-subtitle': trans.joinPinSubtitle,
        'txt-btn-join-room': trans.btnJoinRoom,

        // Stats & Palette
        'lbl-answered': trans.lblAnswered,
        'txt-lbl-correct': trans.lblCorrect,
        'txt-lbl-incorrect': trans.lblIncorrect,
        'txt-lbl-unattempted': trans.lblUnattempted,
        'finish-btn': trans.btnSubmit,
        'txt-btn-submit-aside': trans.btnSubmitAside,
        'btn-shuffle': trans.btnShuffle,
        'txt-leg-correct': trans.legCorrect,
        'txt-leg-incorrect': trans.legIncorrect,
        'txt-leg-answered': trans.legAnswered,
        'txt-leg-flagged': trans.legFlagged,
        'txt-leg-unattempted': trans.legUnattempted,
        'txt-mobile-fab-lbl': trans.mobileFab,

        // Summary Modal
        'modal-subtitle': trans.modalSubtitle,
        'txt-modal-correct': trans.modalCorrect,
        'txt-modal-incorrect': trans.modalIncorrect,
        'txt-modal-unattempted': trans.modalUnattempted,
        'txt-modal-review': trans.modalReview,
        'txt-modal-retake': trans.modalRetake,
        'txt-modal-export': trans.modalExport,
        'txt-modal-new-quiz': trans.modalNewQuiz,
        'txt-modal-pacing': trans.lblPacing,

        // Submit Confirm Modal
        'txt-confirm-title': trans.confirmTitle,
        'txt-confirm-subtitle': trans.confirmSubtitle,
        'txt-matrix-answered': trans.matrixAnswered,
        'txt-matrix-unanswered': trans.matrixUnanswered,
        'txt-matrix-flagged': trans.matrixFlagged,
        'btn-cancel-submit': trans.btnCancelSubmit,
        'btn-proceed-submit': trans.btnProceedSubmit,

        // Tools Modal
        'txt-tools-modal-title': trans.toolsModalTitle,
        'txt-tools-modal-subtitle': trans.toolsModalSubtitle,
        'txt-tools-card1-title': trans.toolsCard1Title,
        'txt-tools-card1-desc': trans.toolsCard1Desc,
        'badge-theme-academic': trans.badgeThemeAcademic,
        'badge-theme-sepia': trans.badgeThemeSepia,
        'badge-theme-emerald': trans.badgeThemeEmerald,
        'badge-theme-cyberpunk': trans.badgeThemeCyberpunk,
        'badge-theme-minimalist': trans.badgeThemeMinimalist,
        'badge-theme-playful': trans.badgeThemePlayful,
        'txt-tools-lang-label': trans.toolsLangLabel,
        'txt-tools-sound-label': trans.toolsSoundLabel,
        'btn-sound-on': trans.soundOn,
        'btn-sound-off': trans.soundOff,
        'txt-tools-card2-title': trans.toolsCard2Title,
        'txt-tools-card2-desc': trans.toolsCard2Desc,
        'txt-tools-f-studio-name': trans.toolsStudioName,
        'txt-tools-f-studio-desc': trans.toolsStudioDesc,
        'txt-tools-f-shuffle-name': trans.toolsShuffleName,
        'txt-tools-f-shuffle-desc': trans.toolsShuffleDesc,
        'txt-tools-f-history-name': trans.toolsHistoryName,
        'txt-tools-f-history-desc': trans.toolsHistoryDesc,
        'txt-tools-card3-title': trans.toolsCard3Title,
        'txt-tools-card3-desc': trans.toolsCard3Desc,
        'txt-tools-f-host-name': trans.toolsHostName,
        'txt-tools-f-host-desc': trans.toolsHostDesc,
        'txt-tools-f-lb-name': trans.toolsLbName,
        'txt-tools-f-lb-desc': trans.toolsLbDesc,
        'txt-tools-card4-title': trans.toolsCard4Title,
        'txt-tools-card4-desc': trans.toolsCard4Desc,
        'txt-tools-f-ocr-name': trans.toolsOcrName,
        'txt-tools-f-ocr-desc': trans.toolsOcrDesc,
        'txt-tools-f-aikey-name': trans.toolsAiKeyName,
        'txt-tools-f-aikey-desc': trans.toolsAiKeyDesc,
        'txt-btn-done-tools': trans.btnDoneTools,

        // Question Studio
        'txt-studio-header-title': trans.studioHeaderTitle,
        'txt-btn-studio-paste': trans.studioBtnPaste,
        'txt-btn-studio-export-json': trans.studioBtnExportJson,
        'txt-btn-studio-export-txt': trans.studioBtnExportTxt,
        'txt-btn-studio-cloud': trans.studioBtnCloud,
        'txt-btn-studio-apply': trans.studioBtnApply,
        'txt-btn-studio-add-q': trans.studioBtnAddQ,

        // Host Room Modal
        'txt-host-title': trans.hostTitle,
        'txt-host-desc': trans.hostDesc,
        'txt-host-lbl-title': trans.hostLblTitle,
        'txt-host-lbl-qcount': trans.hostLblQCount,
        'txt-host-lbl-duration': trans.hostLblDuration,
        'txt-host-lbl-anticheat': trans.hostLblAnticheat,
        'txt-btn-confirm-host': trans.btnConfirmHost,
        'txt-host-pin-lbl': trans.hostPinLbl,
        'txt-host-pin-desc': trans.hostPinDesc,
        'txt-btn-copy-pin': trans.btnCopyPin,
        'txt-btn-view-lb': trans.btnViewLb,

        // Leaderboard Modal
        'txt-lb-title': trans.lbTitle,
        'txt-lb-pin-label': trans.lbPinLabel,
        'txt-btn-refresh-lb': trans.btnRefreshLb,
        'th-lb-rank': trans.thLbRank,
        'th-lb-name': trans.thLbName,
        'th-lb-sbd': trans.thLbSbd,
        'th-lb-score': trans.thLbScore,
        'th-lb-time': trans.thLbTime,
        'th-lb-violations': trans.thLbViolations,

        // Exam History Modal
        'txt-hist-title': trans.histTitle,
        'txt-hist-subtitle': trans.histSubtitle,
        'txt-hist-stat-total': trans.histStatTotal,
        'txt-hist-stat-avg': trans.histStatAvg,
        'txt-hist-stat-best': trans.histStatBest,
        'txt-tab-hist-list': trans.tabHistList,
        'txt-btn-clear-history': trans.btnClearHistory,
        'txt-btn-close-history': trans.btnCloseHistory,

        // Full-Stack Auth Modal
        'txt-auth-title': trans.authTitle,
        'txt-auth-subtitle': trans.authSubtitle,
        'txt-tab-login': trans.tabLogin,
        'txt-tab-register': trans.tabRegister,
        'txt-lbl-login-email': trans.lblLoginEmail,
        'txt-lbl-login-password': trans.lblLoginPassword,
        'txt-btn-login-submit': trans.btnLoginSubmit,
        'txt-auth-demo-title': trans.authDemoTitle,
        'txt-btn-demo-teacher': trans.btnDemoTeacher,
        'txt-btn-demo-student': trans.btnDemoStudent,
        'txt-lbl-reg-name': trans.lblRegName,
        'txt-lbl-reg-email': trans.lblRegEmail,
        'txt-lbl-reg-password': trans.lblRegPassword,
        'txt-lbl-reg-role': trans.lblRegRole,
        'opt-role-student': trans.optRoleStudent,
        'opt-role-teacher': trans.optRoleTeacher,
        'txt-btn-reg-submit': trans.btnRegSubmit
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

    // Curated Optgroup labels
    const optCloud = document.getElementById('optgroup-cloud-exams');
    if (optCloud) optCloud.label = trans.optgroupCloud;
    const optOffline = document.getElementById('optgroup-offline-exams');
    if (optOffline) optOffline.label = trans.optgroupOffline;

    // Input Placeholders
    const pinInput = document.getElementById('input-join-pin');
    if (pinInput) pinInput.placeholder = trans.joinPinPlaceholder;
    const nameInput = document.getElementById('input-join-name');
    if (nameInput) nameInput.placeholder = trans.joinNamePlaceholder;
    const sbdInput = document.getElementById('input-join-sbd');
    if (sbdInput) sbdInput.placeholder = trans.joinSbdPlaceholder;
    const studioSearch = document.getElementById('studio-search-q');
    if (studioSearch) studioSearch.placeholder = trans.studioSearchPlaceholder;
    const hostTitleInput = document.getElementById('host-input-title');
    if (hostTitleInput) hostTitleInput.placeholder = trans.hostInputTitlePlaceholder;

    // Navbar Tooltips
    const btnAiTutor = document.getElementById('btn-open-ai-tutor');
    if (btnAiTutor && trans.navAiTutorTitle) btnAiTutor.title = trans.navAiTutorTitle;
    const btnTools = document.getElementById('btn-tools-toggle');
    if (btnTools && trans.navToolsTitle) btnTools.title = trans.navToolsTitle;
    const srvStatus = document.getElementById('server-status-badge');
    if (srvStatus && trans.navServerStatusTitle) srvStatus.title = trans.navServerStatusTitle;
    const btnAuth = document.getElementById('btn-auth-toggle');
    if (btnAuth && trans.navAccountTitle) btnAuth.title = trans.navAccountTitle;
    const btnTheme = document.getElementById('btn-quick-theme');
    if (btnTheme && trans.navThemeTitle) btnTheme.title = trans.navThemeTitle;
    const btnFs = document.getElementById('btn-fullscreen-toggle');
    if (btnFs && trans.navFullscreenTitle) btnFs.title = trans.navFullscreenTitle;
    const btnReset = document.getElementById('btn-reset');
    if (btnReset && trans.navResetTitle) btnReset.title = trans.navResetTitle;
    const btnShuffle = document.getElementById('btn-shuffle');
    if (btnShuffle && trans.tooltipShuffle) btnShuffle.title = trans.tooltipShuffle;

    // Duration Selector Option Text
    const durSelect = document.getElementById('duration-selector');
    if (durSelect) {
        const durOpts = durSelect.querySelectorAll('option');
        durOpts.forEach(opt => {
            const val = opt.value;
            if (val === '0') opt.innerText = trans.optDuration0;
            else if (trans[`optDuration${val}`]) opt.innerText = trans[`optDuration${val}`];
        });
    }

    // Host Duration Selector Option Text
    const hostDurSelect = document.getElementById('host-select-duration');
    if (hostDurSelect) {
        const hostDurOpts = hostDurSelect.querySelectorAll('option');
        hostDurOpts.forEach(opt => {
            const val = opt.value;
            if (val === '0') opt.innerText = trans.optDuration0;
            else if (trans[`optDuration${val}`]) opt.innerText = trans[`optDuration${val}`];
        });
    }

    // Update Mode Selector options
    const modeSelect = document.getElementById('mode-selector');
    if (modeSelect) {
        const optPractice = modeSelect.querySelector('option[value="practice"]');
        if (optPractice) optPractice.innerText = trans.modePractice;
        const optExam = modeSelect.querySelector('option[value="exam"]');
        if (optExam) optExam.innerText = trans.modeExam;
        const optFlashcard = modeSelect.querySelector('option[value="flashcard"]');
        if (optFlashcard) optFlashcard.innerText = trans.modeFlashcard;
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

    // Update Palette filter chips labels with current count numbers
    const fltAll = document.getElementById('flt-all');
    const fltAns = document.getElementById('flt-answered');
    const fltFlg = document.getElementById('flt-flagged');
    const fltUna = document.getElementById('flt-unanswered');
    const fltInc = document.getElementById('flt-incorrect');
    if (fltAll) {
        const num = (fltAll.innerText.match(/\((\d+)\)/) || ['', '0'])[1];
        fltAll.innerText = `${trans.fltAll} (${num})`;
    }
    if (fltAns) {
        const num = (fltAns.innerText.match(/\((\d+)\)/) || ['', '0'])[1];
        fltAns.innerText = `${trans.fltAnswered} (${num})`;
    }
    if (fltFlg) {
        const num = (fltFlg.innerText.match(/\((\d+)\)/) || ['', '0'])[1];
        fltFlg.innerText = `${trans.fltFlagged} (${num})`;
    }
    if (fltUna) {
        const num = (fltUna.innerText.match(/\((\d+)\)/) || ['', '0'])[1];
        fltUna.innerText = `${trans.fltUnanswered} (${num})`;
    }
    if (fltInc) {
        const num = (fltInc.innerText.match(/\((\d+)\)/) || ['', '0'])[1];
        fltInc.innerText = `${trans.fltIncorrect || '❌ Câu sai'} (${num})`;
    }

    // Sync language choice buttons in Tools modal
    document.querySelectorAll('.btn-lang-choice').forEach(b => {
        b.classList.toggle('active', b.getAttribute('data-lang') === lang);
    });
}
