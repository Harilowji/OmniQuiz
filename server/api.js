/**
 * server/api.js - RESTful API Router & Business Logic Controller
 * Maps all 12 steps of the Full-Stack Web Architecture (Client -> API -> Backend -> DB -> Response).
 */
const express = require('express');
const router = express.Router();
const Database = require('./database');
const { signToken, authenticate, requireRole } = require('./auth');

// ==========================================
// 1. AUTHENTICATION & USER MANAGEMENT
// ==========================================

/**
 * POST /api/auth/register
 * Body: { email, username, password, role }
 */
router.post('/auth/register', (req, res) => {
    try {
        const { email, username, password, role } = req.body;

        if (!email || !email.includes('@')) {
            return res.status(400).json({ success: false, error: 'Email không hợp lệ!' });
        }
        if (!username || username.trim().length < 2) {
            return res.status(400).json({ success: false, error: 'Họ tên phải có ít nhất 2 ký tự!' });
        }
        if (!password || password.length < 6) {
            return res.status(400).json({ success: false, error: 'Mật khẩu phải có ít nhất 6 ký tự!' });
        }

        const user = Database.createUser({ email, username, password, role });
        const token = signToken({ userId: user.id, role: user.role });

        res.status(201).json({
            success: true,
            message: 'Đăng ký tài khoản thành công!',
            data: {
                token,
                user: {
                    id: user.id,
                    email: user.email,
                    username: user.username,
                    role: user.role,
                    createdAt: user.createdAt
                }
            }
        });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
});

/**
 * POST /api/auth/login
 * Body: { email, password }
 */
router.post('/auth/login', (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ success: false, error: 'Vui lòng nhập đầy đủ email và mật khẩu!' });
        }

        const user = Database.findUserByEmail(email);
        if (!user) {
            return res.status(401).json({ success: false, error: 'Email hoặc mật khẩu không chính xác!' });
        }

        const computedHash = Database.hashPassword(password, user.salt);
        if (computedHash !== user.passwordHash) {
            return res.status(401).json({ success: false, error: 'Email hoặc mật khẩu không chính xác!' });
        }

        const token = signToken({ userId: user.id, role: user.role });

        res.json({
            success: true,
            message: 'Đăng nhập thành công!',
            data: {
                token,
                user: {
                    id: user.id,
                    email: user.email,
                    username: user.username,
                    role: user.role,
                    createdAt: user.createdAt
                }
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * GET /api/auth/me
 * Header: Authorization: Bearer <token>
 */
router.get('/auth/me', authenticate(true), (req, res) => {
    res.json({
        success: true,
        data: {
            user: req.user
        }
    });
});

// ==========================================
// 2. EXAMS & QUESTION BANKS
// ==========================================

/**
 * GET /api/exams
 * Query: ?subject=math&search=thpt
 */
router.get('/exams', (req, res) => {
    try {
        const { subject, search } = req.query;
        const exams = Database.getExams({ subject, search });
        res.json({
            success: true,
            total: exams.length,
            data: exams
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * GET /api/exams/:id
 * Query: ?mode=exam|practice
 */
router.get('/exams/:id', (req, res) => {
    try {
        const { id } = req.params;
        const isExamMode = req.query.mode === 'exam';

        // In exam mode, hide raw answer keys from client inspection
        const exam = Database.getExamById(id, !isExamMode);
        if (!exam) {
            return res.status(404).json({ success: false, error: 'Không tìm thấy đề thi!' });
        }

        res.json({
            success: true,
            data: exam
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * POST /api/exams
 * Auth: Optional or Teacher/Admin
 */
router.post('/exams', authenticate(false), (req, res) => {
    try {
        const { title, description, subject, durationMinutes, questions } = req.body;
        if (!title || !title.trim()) {
            return res.status(400).json({ success: false, error: 'Tiêu đề đề thi không được để trống!' });
        }
        if (!Array.isArray(questions) || questions.length === 0) {
            return res.status(400).json({ success: false, error: 'Đề thi phải có ít nhất 1 câu hỏi!' });
        }

        const newExam = Database.createExam({
            title,
            description,
            subject,
            durationMinutes,
            questions,
            createdBy: req.user ? req.user.id : 'anonymous'
        });

        res.status(201).json({
            success: true,
            message: 'Tạo đề thi mới thành công!',
            data: newExam
        });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
});

/**
 * DELETE /api/exams/:id
 * Auth: Required
 */
router.delete('/exams/:id', authenticate(true), (req, res) => {
    try {
        const { id } = req.params;
        const deleted = Database.deleteExam(id, req.user.id);
        if (!deleted) {
            return res.status(404).json({ success: false, error: 'Đề thi không tồn tại hoặc đã bị xóa!' });
        }
        res.json({ success: true, message: 'Đã xóa đề thi thành công!' });
    } catch (err) {
        res.status(403).json({ success: false, error: err.message });
    }
});

// ==========================================
// 3. EXAM SUBMISSION & SERVER-SIDE GRADING
// ==========================================

/**
 * POST /api/submissions
 * Body: { examId, studentName, studentSbd, answers, timeSpentSeconds, violations }
 */
router.post('/submissions', authenticate(false), (req, res) => {
    try {
        const { examId, studentName, studentSbd, answers, timeSpentSeconds, violations } = req.body;
        if (!examId) {
            return res.status(400).json({ success: false, error: 'Thiếu mã đề thi (examId)!' });
        }

        const submission = Database.evaluateAndSaveSubmission({
            examId,
            userId: req.user ? req.user.id : null,
            studentName: studentName || (req.user ? req.user.username : 'Thí sinh tự do'),
            studentSbd,
            answers: answers || {},
            timeSpentSeconds,
            violations
        });

        res.status(201).json({
            success: true,
            message: 'Nộp bài và chấm điểm máy chủ thành công!',
            data: submission
        });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
});

/**
 * GET /api/submissions/my-history
 * Auth: Required
 */
router.get('/submissions/my-history', authenticate(true), (req, res) => {
    try {
        const history = Database.getSubmissionsByUser(req.user.id);
        res.json({
            success: true,
            total: history.length,
            data: history
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * GET /api/submissions/:id
 */
router.get('/submissions/:id', (req, res) => {
    try {
        const submission = Database.getSubmissionById(req.params.id);
        if (!submission) {
            return res.status(404).json({ success: false, error: 'Không tìm thấy bài làm!' });
        }
        res.json({
            success: true,
            data: submission
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// ==========================================
// 4. ONLINE EXAM ROOMS (PIN-BASED) & LEADERBOARD
// ==========================================

/**
 * POST /api/rooms
 * Body: { title, examId, questions, durationMinutes, isAnticheat }
 */
router.post('/rooms', authenticate(false), (req, res) => {
    try {
        const { title, examId, questions, durationMinutes, isAnticheat } = req.body;
        const room = Database.createRoom({
            title,
            examId,
            questions,
            hostUserId: req.user ? req.user.id : null,
            durationMinutes,
            isAnticheat
        });

        res.status(201).json({
            success: true,
            message: `Khởi tạo phòng thi thành công! Mã PIN: ${room.pin}`,
            data: room
        });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
});

/**
 * GET /api/rooms/:pin
 */
router.get('/rooms/:pin', (req, res) => {
    try {
        const { pin } = req.params;
        const room = Database.getRoomByPin(pin, true);
        if (!room) {
            return res.status(404).json({ success: false, error: 'Phòng thi không tồn tại hoặc mã PIN không đúng!' });
        }
        res.json({
            success: true,
            data: room
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * POST /api/rooms/:pin/submit
 * Body: { studentName, studentSbd, score, totalQuestions, correctCount, incorrectCount, timeSpentSeconds, violations }
 */
router.post('/rooms/:pin/submit', (req, res) => {
    try {
        const { pin } = req.params;
        const { studentName, studentSbd, score, totalQuestions, correctCount, incorrectCount, timeSpentSeconds, violations } = req.body;

        if (!studentName || !studentName.trim()) {
            return res.status(400).json({ success: false, error: 'Vui lòng nhập tên thí sinh!' });
        }

        const result = Database.submitRoomResult({
            pin,
            studentName,
            studentSbd,
            score,
            totalQuestions,
            correctCount,
            incorrectCount,
            timeSpentSeconds,
            violations
        });

        res.status(201).json({
            success: true,
            message: 'Đã nộp bài vào phòng thi thành công!',
            data: result
        });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
});

/**
 * GET /api/rooms/:pin/leaderboard
 */
router.get('/rooms/:pin/leaderboard', (req, res) => {
    try {
        const { pin } = req.params;
        const leaderboard = Database.getRoomLeaderboard(pin);
        res.json({
            success: true,
            pin,
            total: leaderboard.length,
            data: leaderboard
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// ==========================================
// 5. SERVER-SIDE AI PROXY (GEMINI API)
// ==========================================

/**
 * POST /api/ai/tutor
 * Body: { question, options, selectedAnswers, correctAnswers, explanation }
 */
router.post('/ai/tutor', async (req, res) => {
    const serverApiKey = process.env.GEMINI_API_KEY;
    const clientApiKey = req.headers['x-gemini-key'];
    const apiKey = serverApiKey || clientApiKey;

    if (!apiKey) {
        return res.status(400).json({
            success: false,
            error: 'Chưa cấu hình Google Gemini API Key trên Server hoặc Client!'
        });
    }

    try {
        const { question, options, selectedAnswers, correctAnswers, explanation } = req.body;
        const letters = ['A', 'B', 'C', 'D', 'E', 'F'];
        const optionsText = (options || []).map((opt, i) => `${letters[i] || i + 1}. ${opt}`).join('\n');
        const userAnsStr = (selectedAnswers || []).map(i => `${letters[i] || i + 1}. ${options[i] || ''}`).join(', ') || 'Chưa chọn';
        const correctAnsStr = (correctAnswers || []).map(i => `${letters[i] || i + 1}. ${options[i] || ''}`).join(', ') || 'Chưa có thông tin';

        const prompt = `
Bạn là Gia sư Luyện thi Trắc nghiệm Thông minh (AI Exam Tutor) của hệ thống OmniQuiz PRO.
Nhiệm vụ của bạn là phân tích và giảng giải chi tiết câu hỏi trắc nghiệm dưới đây cho học sinh:

【ĐỀ BÀI】:
${question}

【CÁC PHƯƠNG ÁN LỰA CHỌN】:
${optionsText}

【TRẠNG THÁI BÀI LÀM】:
- Phương án học sinh đã chọn: ${userAnsStr}
- Đáp án chính xác: ${correctAnsStr}
- Lời giải mẫu có sẵn (nếu có): ${explanation || 'Chưa có'}

【YÊU CẦU GIẢNG BÀI】:
Hãy trình bày bằng tiếng Việt mạch lạc, cuốn hút, ngắn gọn và sâu sắc theo đúng 3 phần sau (Markdown và KaTeX $...$):
1. 🎯 **Bản chất kiến thức cốt lõi**: Phương pháp chuẩn, công thức cần nhớ.
2. ⚠️ **Vạch trần bẫy tư duy**: Chỉ rõ bẫy đánh lừa ở các phương án nhiễu hoặc sai lầm thường gặp.
3. ⚡ **Mẹo giải nhanh 30 giây**: Thủ thuật loại trừ, bấm máy Casio hoặc nhận diện nhanh dấu hiệu đặc trưng.
`;

        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
        const response = await fetch(geminiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ role: 'user', parts: [{ text: prompt }] }],
                generationConfig: { temperature: 0.4, maxOutputTokens: 2048 }
            })
        });

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.error?.message || `HTTP ${response.status}`);
        }

        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

        res.json({
            success: true,
            data: {
                explanation: text
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// ==========================================
// 6. SYSTEM HEALTH & METRICS
// ==========================================

/**
 * GET /api/health
 */
router.get('/health', (req, res) => {
    try {
        const stats = Database.getSystemStats();
        res.json({
            success: true,
            status: 'healthy',
            timestamp: new Date().toISOString(),
            data: stats
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
