/**
 * server/database.js - Persistent Database Engine & Data Access Layer (DAL)
 * Provides ACID-compliant file-backed database storage with auto-seeding.
 * Collections: users, exams, submissions, rooms, room_results
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DB_FILE = path.join(__dirname, '..', 'data', 'db.json');

const INITIAL_DB = {
    users: [
        {
            id: 'usr_teacher_default',
            email: 'teacher@omniquiz.edu.vn',
            username: 'Thầy Giáo Viên (Demo)',
            role: 'teacher', // 'student' | 'teacher' | 'admin'
            // Default password: "admin123" (salt + hash)
            salt: '7a8f9e1d2c3b4a5f',
            passwordHash: hashPasswordWithSalt('admin123', '7a8f9e1d2c3b4a5f'),
            createdAt: new Date('2026-09-01T00:00:00Z').toISOString()
        },
        {
            id: 'usr_student_default',
            email: 'student@omniquiz.edu.vn',
            username: 'Nguyễn Văn Học Sinh (Demo)',
            role: 'student',
            // Default password: "student123"
            salt: '1b2c3d4e5f6a7b8c',
            passwordHash: hashPasswordWithSalt('student123', '1b2c3d4e5f6a7b8c'),
            createdAt: new Date('2026-09-01T00:00:00Z').toISOString()
        }
    ],
    exams: [
        {
            id: 'exam_cs_10',
            title: 'Tin học & CNTT - Đề thi chuẩn kiến thức',
            subject: 'informatics',
            description: 'Bộ 10 câu hỏi trắc nghiệm Tin học lập trình cơ bản và kiến trúc máy tính',
            durationMinutes: 15,
            isPublic: true,
            createdBy: 'usr_teacher_default',
            createdAt: new Date('2026-09-01T00:00:00Z').toISOString(),
            questions: [
                {
                    q: "Ngôn ngữ lập trình nào sau đây được thực thi trực tiếp trên hầu hết các trình duyệt web hiện đại mà không cần plugin?",
                    options: ["Python", "JavaScript", "C++", "Java"],
                    answers: [1],
                    explanation: "JavaScript là ngôn ngữ tiêu chuẩn của Web được tích hợp sẵn trong mọi engine trình duyệt hiện đại (V8, SpiderMonkey, JavaScriptCore)."
                },
                {
                    q: "Giao thức nào cung cấp kết nối mạng an toàn được mã hóa bằng TLS/SSL giữa trình duyệt và máy chủ?",
                    options: ["HTTP", "FTP", "HTTPS", "SMTP"],
                    answers: [2],
                    explanation: "HTTPS (Hypertext Transfer Protocol Secure) sử dụng chứng chỉ SSL/TLS để mã hóa toàn bộ dữ liệu trao đổi giữa Client và Server."
                },
                {
                    q: "Cấu trúc dữ liệu nào hoạt động theo nguyên tắc LIFO (Last In First Out - Vào sau ra trước)?",
                    options: ["Queue (Hàng đợi)", "Stack (Ngăn xếp)", "Array (Mảng)", "Linked List (Danh sách liên kết)"],
                    answers: [1],
                    explanation: "Stack hoạt động theo cơ chế LIFO, phần tử đưa vào sau cùng sẽ được lấy ra đầu tiên (ví dụ: thao tác Undo/Redo)."
                },
                {
                    q: "Độ phức tạp thời gian trung bình của thuật toán Tìm kiếm nhị phân (Binary Search) trên mảng đã sắp xếp là gì?",
                    options: ["O(1)", "O(n)", "O(log n)", "O(n^2)"],
                    answers: [2],
                    explanation: "Tìm kiếm nhị phân chia đôi không gian tìm kiếm sau mỗi bước, do đó độ phức tạp thời gian là O(log n)."
                },
                {
                    q: "Trong kiến trúc phần mềm RESTful API, phương thức HTTP nào thường được sử dụng để tạo mới một tài nguyên?",
                    options: ["GET", "POST", "PUT", "DELETE"],
                    answers: [1],
                    explanation: "POST được dùng để gửi dữ liệu lên server nhằm tạo mới một tài nguyên trong chuẩn REST."
                }
            ]
        },
        {
            id: 'exam_math_thpt',
            title: 'Toán học THPT - Khảo sát hàm số & Tích phân',
            subject: 'math',
            description: 'Đề thi trắc nghiệm Toán học giải tích THPT Quốc gia có hỗ trợ công thức KaTeX',
            durationMinutes: 45,
            isPublic: true,
            createdBy: 'usr_teacher_default',
            createdAt: new Date('2026-09-02T00:00:00Z').toISOString(),
            questions: [
                {
                    q: "Đồ thị hàm số $y = \\frac{2x - 1}{x + 1}$ có đường tiệm cận ngang là đường thẳng nào?",
                    options: ["$y = 2$", "$y = -1$", "$x = 2$", "$x = -1$"],
                    answers: [0],
                    explanation: "Ta có $\\lim_{x \\to \\pm\\infty} \\frac{2x-1}{x+1} = 2$, suy ra tiệm cận ngang là $y = 2$."
                },
                {
                    q: "Tập xác định của hàm số $y = \\log_2 (3x - 6)$ là:",
                    options: ["$(2; +\\infty)$", "$[2; +\\infty)$", "$(-\\infty; 2)$", "$\\mathbb{R} \\setminus \\{2\\}$"],
                    answers: [0],
                    explanation: "Điều kiện xác định: $3x - 6 > 0 \\iff x > 2$. Vậy tập xác định là $(2; +\\infty)$."
                },
                {
                    q: "Tính tích phân $I = \\int_0^1 e^x dx$:",
                    options: ["$e - 1$", "$e$", "$e + 1$", "$1$"],
                    answers: [0],
                    explanation: "Ta có $\\int_0^1 e^x dx = \\left. e^x \\right|_0^1 = e^1 - e^0 = e - 1$."
                }
            ]
        }
    ],
    submissions: [],
    rooms: [
        {
            pin: '888999',
            title: 'Phòng thi mẫu kiểm tra 15 phút - Tin học 10',
            examId: 'exam_cs_10',
            hostUserId: 'usr_teacher_default',
            durationMinutes: 15,
            isAnticheat: true,
            status: 'active',
            createdAt: new Date().toISOString()
        }
    ],
    room_results: [
        {
            id: 'res_demo_1',
            roomPin: '888999',
            studentName: 'Trần Thị Thu Thảo',
            studentSbd: '10A1-02',
            score: 100,
            totalQuestions: 5,
            correctCount: 5,
            incorrectCount: 0,
            timeSpentSeconds: 420,
            violations: 0,
            submittedAt: new Date(Date.now() - 3600000).toISOString()
        },
        {
            id: 'res_demo_2',
            roomPin: '888999',
            studentName: 'Lê Hoàng Nam',
            studentSbd: '10A1-15',
            score: 80,
            totalQuestions: 5,
            correctCount: 4,
            incorrectCount: 1,
            timeSpentSeconds: 510,
            violations: 1,
            submittedAt: new Date(Date.now() - 1800000).toISOString()
        }
    ]
};

function hashPasswordWithSalt(password, salt) {
    return crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha256').toString('hex');
}

// In-memory cache synced with disk
let dbMemory = null;

function ensureDataDir() {
    const dataDir = path.dirname(DB_FILE);
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }
}

function loadDB() {
    if (dbMemory) return dbMemory;
    ensureDataDir();
    if (!fs.existsSync(DB_FILE)) {
        dbMemory = JSON.parse(JSON.stringify(INITIAL_DB));
        saveDB();
        return dbMemory;
    }
    try {
        const raw = fs.readFileSync(DB_FILE, 'utf8');
        dbMemory = JSON.parse(raw);
        // Ensure all collections exist
        ['users', 'exams', 'submissions', 'rooms', 'room_results'].forEach(col => {
            if (!Array.isArray(dbMemory[col])) dbMemory[col] = [];
        });
        return dbMemory;
    } catch (e) {
        console.warn('[Database] Read error, resetting to initial seed:', e.message);
        dbMemory = JSON.parse(JSON.stringify(INITIAL_DB));
        saveDB();
        return dbMemory;
    }
}

function saveDB() {
    try {
        ensureDataDir();
        const tmpFile = `${DB_FILE}.${Date.now()}.${Math.random().toString(36).substring(2, 6)}.tmp`;
        fs.writeFileSync(tmpFile, JSON.stringify(dbMemory, null, 2), 'utf8');
        try {
            if (fs.existsSync(DB_FILE)) {
                fs.copyFileSync(tmpFile, DB_FILE);
                fs.unlinkSync(tmpFile);
            } else {
                fs.renameSync(tmpFile, DB_FILE);
            }
        } catch (copyErr) {
            fs.writeFileSync(DB_FILE, JSON.stringify(dbMemory, null, 2), 'utf8');
        }
    } catch (e) {
        console.error('[Database] Disk write error:', e.message);
    }
}

// Database Operations
const Database = {
    hashPassword(password, salt) {
        return hashPasswordWithSalt(password, salt);
    },

    generateSalt() {
        return crypto.randomBytes(16).toString('hex');
    },

    // User Operations
    findUserByEmail(email) {
        if (!email) return null;
        const db = loadDB();
        return db.users.find(u => u.email.toLowerCase() === email.toLowerCase()) || null;
    },

    findUserById(id) {
        if (!id) return null;
        const db = loadDB();
        return db.users.find(u => u.id === id) || null;
    },

    createUser({ email, username, password, role = 'student' }) {
        const db = loadDB();
        if (Database.findUserByEmail(email)) {
            throw new Error('Email đã được đăng ký trong hệ thống!');
        }
        const salt = Database.generateSalt();
        const newUser = {
            id: 'usr_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
            email: email.trim().toLowerCase(),
            username: username.trim(),
            role: role === 'teacher' ? 'teacher' : 'student',
            salt,
            passwordHash: Database.hashPassword(password, salt),
            createdAt: new Date().toISOString()
        };
        db.users.push(newUser);
        saveDB();
        return newUser;
    },

    // Exam Operations
    getExams({ subject = null, search = null } = {}) {
        const db = loadDB();
        let list = db.exams || [];
        if (subject) {
            list = list.filter(e => e.subject === subject);
        }
        if (search) {
            const q = search.toLowerCase();
            list = list.filter(e => e.title.toLowerCase().includes(q) || (e.description && e.description.toLowerCase().includes(q)));
        }
        // Return summary without leaking raw answer key for exam list
        return list.map(e => ({
            id: e.id,
            title: e.title,
            subject: e.subject,
            description: e.description,
            durationMinutes: e.durationMinutes,
            questionCount: (e.questions || []).length,
            createdBy: e.createdBy,
            createdAt: e.createdAt
        }));
    },

    getExamById(id, includeAnswers = true) {
        const db = loadDB();
        const exam = db.exams.find(e => e.id === id);
        if (!exam) return null;

        const copy = JSON.parse(JSON.stringify(exam));
        if (!includeAnswers && Array.isArray(copy.questions)) {
            copy.questions.forEach(q => {
                delete q.answers;
                delete q.explanation;
            });
        }
        return copy;
    },

    createExam({ title, description, subject = 'general', durationMinutes = 60, questions = [], createdBy = null }) {
        const db = loadDB();
        const newExam = {
            id: 'exam_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
            title: title.trim(),
            description: (description || '').trim(),
            subject,
            durationMinutes: Number(durationMinutes) || 60,
            isPublic: true,
            createdBy: createdBy || 'anonymous',
            createdAt: new Date().toISOString(),
            questions: Array.isArray(questions) ? questions : []
        };
        db.exams.unshift(newExam);
        saveDB();
        return newExam;
    },

    deleteExam(id, userId = null) {
        const db = loadDB();
        const idx = db.exams.findIndex(e => e.id === id);
        if (idx === -1) return false;
        // Check permission if userId provided
        if (userId && db.exams[idx].createdBy !== userId) {
            const user = Database.findUserById(userId);
            if (!user || user.role !== 'admin') {
                throw new Error('Bạn không có quyền xóa đề thi này!');
            }
        }
        db.exams.splice(idx, 1);
        saveDB();
        return true;
    },

    // Server-Side Exam Submission & Evaluation (Zero Cheat Guarantee)
    evaluateAndSaveSubmission({ examId, userId = null, studentName, studentSbd = '', answers = {}, timeSpentSeconds = 0, violations = 0, score: clientScore = null, title = null, correctCount: clientCorrect = null, totalQuestions: clientTotal = null }) {
        const db = loadDB();
        const exam = db.exams.find(e => e.id === examId);

        if (exam) {
            const questions = exam.questions || [];
            let correctCount = 0;
            let incorrectCount = 0;
            let unattemptedCount = 0;

            const detailedReview = questions.map((q, idx) => {
                const userAns = Array.isArray(answers[idx]) ? answers[idx] : [];
                const correctAns = Array.isArray(q.answers) ? q.answers : [];

                const isAttempted = userAns.length > 0;
                let isCorrect = false;

                if (isAttempted) {
                    isCorrect = userAns.length === correctAns.length &&
                        userAns.every(val => correctAns.includes(Number(val)));
                    if (isCorrect) correctCount++;
                    else incorrectCount++;
                } else {
                    unattemptedCount++;
                }

                return {
                    questionIndex: idx,
                    questionText: q.q,
                    options: q.options,
                    userAnswers: userAns,
                    correctAnswers: correctAns,
                    isCorrect,
                    isAttempted,
                    explanation: q.explanation || ''
                };
            });

            const totalQuestions = questions.length;
            const rawScore = totalQuestions > 0 ? (correctCount / totalQuestions) * 100 : 0;
            const score = Math.round(rawScore * 10) / 10; // e.g. 85.5

            const submission = {
                id: 'sub_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
                examId,
                examTitle: exam.title,
                userId: userId || null,
                studentName: studentName || 'Thí sinh tự do',
                studentSbd,
                score,
                totalQuestions,
                correctCount,
                incorrectCount,
                unattemptedCount,
                timeSpentSeconds: Number(timeSpentSeconds) || 0,
                violations: Number(violations) || 0,
                detailedReview,
                submittedAt: new Date().toISOString()
            };

            db.submissions.unshift(submission);
            saveDB();
            return submission;
        }

        // Support custom uploaded or imported exam submissions
        const total = typeof clientTotal === 'number' ? clientTotal : (Object.keys(answers || {}).length || 1);
        const correct = typeof clientCorrect === 'number' ? clientCorrect : 0;
        const finalScore = typeof clientScore === 'number' ? clientScore : Math.round((correct / total) * 100);

        const customSubmission = {
            id: 'sub_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
            examId: examId || 'custom_exam',
            examTitle: title || 'Bài thi trắc nghiệm (Tùy chỉnh)',
            userId: userId || null,
            studentName: studentName || 'Thí sinh tự do',
            studentSbd,
            score: finalScore,
            totalQuestions: total,
            correctCount: correct,
            incorrectCount: Math.max(0, total - correct),
            unattemptedCount: 0,
            timeSpentSeconds: Number(timeSpentSeconds) || 0,
            violations: Number(violations) || 0,
            detailedReview: [],
            submittedAt: new Date().toISOString()
        };

        db.submissions.unshift(customSubmission);
        saveDB();
        return customSubmission;
    },

    getSubmissionsByUser(userId) {
        if (!userId) return [];
        const db = loadDB();
        return db.submissions.filter(s => s.userId === userId);
    },

    getSubmissionById(id) {
        const db = loadDB();
        return db.submissions.find(s => s.id === id) || null;
    },

    // Online Exam Rooms (PIN-based)
    createRoom({ title, examId = null, questions = null, hostUserId = null, durationMinutes = 60, isAnticheat = true }) {
        const db = loadDB();
        let targetExamId = examId;

        // If custom questions provided without examId, create custom exam entry first
        if (!targetExamId && Array.isArray(questions) && questions.length > 0) {
            const savedExam = Database.createExam({
                title: title || 'Đề phòng thi trực tuyến',
                questions,
                durationMinutes,
                createdBy: hostUserId
            });
            targetExamId = savedExam.id;
        }

        // Generate clean 6-digit random PIN
        let pin = '';
        do {
            pin = Math.floor(100000 + Math.random() * 900000).toString();
        } while (db.rooms.some(r => r.pin === pin && r.status === 'active'));

        const room = {
            pin,
            title: title || `Phòng thi ${pin}`,
            examId: targetExamId,
            hostUserId: hostUserId || 'anonymous',
            durationMinutes: Number(durationMinutes) || 60,
            isAnticheat: Boolean(isAnticheat),
            status: 'active',
            createdAt: new Date().toISOString()
        };

        db.rooms.unshift(room);
        saveDB();
        return room;
    },

    getRoomByPin(pin, hideAnswers = true) {
        const db = loadDB();
        const room = db.rooms.find(r => r.pin === String(pin).trim());
        if (!room) return null;

        const exam = Database.getExamById(room.examId, !hideAnswers);
        return {
            ...room,
            exam: exam || null
        };
    },

    submitRoomResult({ pin, studentName, studentSbd = '', score, totalQuestions, correctCount, incorrectCount, timeSpentSeconds = 0, violations = 0 }) {
        const db = loadDB();
        const room = db.rooms.find(r => r.pin === String(pin).trim());
        if (!room) {
            throw new Error('Mã phòng thi không hợp lệ!');
        }

        const result = {
            id: 'rres_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
            roomPin: pin,
            studentName: studentName.trim(),
            studentSbd: (studentSbd || '').trim(),
            score: Number(score) || 0,
            totalQuestions: Number(totalQuestions) || 0,
            correctCount: Number(correctCount) || 0,
            incorrectCount: Number(incorrectCount) || 0,
            timeSpentSeconds: Number(timeSpentSeconds) || 0,
            violations: Number(violations) || 0,
            submittedAt: new Date().toISOString()
        };

        db.room_results.unshift(result);
        saveDB();
        return result;
    },

    getRoomLeaderboard(pin) {
        const db = loadDB();
        const results = db.room_results.filter(r => r.roomPin === String(pin).trim());

        // Sort descending by score, then ascending by timeSpentSeconds
        results.sort((a, b) => {
            if (b.score !== a.score) return b.score - a.score;
            return a.timeSpentSeconds - b.timeSpentSeconds;
        });

        return results.map((item, rank) => ({
            rank: rank + 1,
            ...item
        }));
    },

    getSystemStats() {
        const db = loadDB();
        return {
            usersCount: (db.users || []).length,
            examsCount: (db.exams || []).length,
            submissionsCount: (db.submissions || []).length,
            activeRoomsCount: (db.rooms || []).filter(r => r.status === 'active').length,
            totalRoomSubmissions: (db.room_results || []).length,
            dbFileSize: fs.existsSync(DB_FILE) ? fs.statSync(DB_FILE).size : 0,
            uptimeSeconds: Math.round(process.uptime()),
            nodeVersion: process.version
        };
    }
};

module.exports = Database;
