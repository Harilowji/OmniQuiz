/**
 * tests/api.test.js - End-to-End API Integration Test Suite
 * Validates the entire 12-step flow: Client -> API -> Backend -> DB -> Response
 */
const http = require('http');
const app = require('../server');

let server;
const PORT = 3999;
const BASE_URL = `http://127.0.0.1:${PORT}`;

function request(method, path, body = null, token = null) {
    return new Promise((resolve, reject) => {
        const url = new URL(path, BASE_URL);
        const headers = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const req = http.request(url, {
            method,
            headers
        }, (res) => {
            let rawData = '';
            res.on('data', chunk => rawData += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(rawData);
                    resolve({ status: res.statusCode, data: parsed });
                } catch (e) {
                    resolve({ status: res.statusCode, raw: rawData });
                }
            });
        });

        req.on('error', reject);
        if (body) req.write(JSON.stringify(body));
        req.end();
    });
}

async function runTests() {
    console.log('🧪 Starting Full-Stack OmniQuiz PRO API Test Suite...\n');
    let passed = 0;
    let failed = 0;

    function assert(condition, message) {
        if (condition) {
            console.log(`  ✓ ${message}`);
            passed++;
        } else {
            console.error(`  ✗ ${message}`);
            failed++;
        }
    }

    try {
        // Step 1: Health check
        console.log('[Test 1: Server & Database Health]');
        const healthRes = await request('GET', '/api/health');
        assert(healthRes.status === 200 && healthRes.data.status === 'healthy', 'GET /api/health returns status 200 & healthy');
        assert(healthRes.data.data.usersCount >= 2, 'Initial database seeded with demo users');

        // Step 2: Auth Login with Default Teacher
        console.log('\n[Test 2: Authentication & JWT Token]');
        const loginRes = await request('POST', '/api/auth/login', {
            email: 'teacher@omniquiz.edu.vn',
            password: 'admin123'
        });
        assert(loginRes.status === 200 && loginRes.data.success, 'POST /api/auth/login succeeds for demo teacher');
        const token = loginRes.data.data.token;
        assert(Boolean(token && token.includes('.')), 'JWT Token properly issued');

        // Step 3: Auth Me
        const meRes = await request('GET', '/api/auth/me', null, token);
        assert(meRes.status === 200 && meRes.data.data.user.role === 'teacher', 'GET /api/auth/me identifies teacher role correctly');

        // Step 4: Register New Student
        const newEmail = `student_${Date.now()}@example.com`;
        const regRes = await request('POST', '/api/auth/register', {
            email: newEmail,
            username: 'Nguyễn Kiểm Thử',
            password: 'password123',
            role: 'student'
        });
        assert(regRes.status === 201 && regRes.data.success, 'POST /api/auth/register creates new student account');

        // Step 5: Get Exams List
        console.log('\n[Test 3: Exams & Question Bank]');
        const examsRes = await request('GET', '/api/exams');
        assert(examsRes.status === 200 && Array.isArray(examsRes.data.data), 'GET /api/exams returns array of exams');
        assert(examsRes.data.total >= 2, 'Default seeded exams available');

        const examId = examsRes.data.data[0].id;
        const examDetail = await request('GET', `/api/exams/${examId}?mode=practice`);
        assert(examDetail.status === 200 && examDetail.data.data.questions.length > 0, 'GET /api/exams/:id loads full questions');

        // Step 6: Server-Side Exam Submission & Grading
        console.log('\n[Test 4: Exam Submission & Server-Side Grading]');
        const submitRes = await request('POST', '/api/submissions', {
            examId: 'exam_cs_10',
            studentName: 'Nguyễn Kiểm Thử',
            studentSbd: 'TEST-001',
            answers: {
                0: [1], // Correct
                1: [2], // Correct
                2: [0], // Incorrect (Correct is 1)
                3: [2], // Correct
                4: [1]  // Correct
            },
            timeSpentSeconds: 180,
            violations: 0
        });
        assert(submitRes.status === 201 && submitRes.data.success, 'POST /api/submissions evaluated successfully by backend');
        assert(submitRes.data.data.correctCount === 4, 'Server accurately calculated 4 correct answers');
        assert(submitRes.data.data.score === 80, 'Server accurately calculated 80/100 points');

        // Step 7: PIN Room & Leaderboard
        console.log('\n[Test 5: Online PIN Rooms & Realtime Leaderboard]');
        const roomRes = await request('POST', '/api/rooms', {
            title: 'Phòng thi thử tự động',
            examId: 'exam_cs_10',
            durationMinutes: 30
        });
        assert(roomRes.status === 201 && Boolean(roomRes.data.data.pin), 'POST /api/rooms generated 6-digit PIN room');
        const pin = roomRes.data.data.pin;

        const getRoom = await request('GET', `/api/rooms/${pin}`);
        assert(getRoom.status === 200 && getRoom.data.data.pin === pin, 'GET /api/rooms/:pin fetches room by PIN');

        const submitRoom = await request('POST', `/api/rooms/${pin}/submit`, {
            studentName: 'Vũ Thí Sinh',
            studentSbd: '12A-99',
            score: 95,
            totalQuestions: 5,
            correctCount: 5,
            timeSpentSeconds: 300,
            violations: 0
        });
        assert(submitRoom.status === 201 && submitRoom.data.success, 'POST /api/rooms/:pin/submit records room score');

        const leaderboard = await request('GET', `/api/rooms/${pin}/leaderboard`);
        assert(leaderboard.status === 200 && leaderboard.data.data.length >= 1, 'GET /api/rooms/:pin/leaderboard returns live rankings');
        assert(leaderboard.data.data[0].studentName === 'Vũ Thí Sinh', 'Top rank correctly assigned to highest score');

        console.log(`\n🎉 Test Suite Completed: ${passed} PASSED, ${failed} FAILED.`);
    } catch (e) {
        console.error('Fatal Test Error:', e);
        failed++;
    } finally {
        server.close();
        process.exit(failed > 0 ? 1 : 0);
    }
}

// Start temporary test server
server = app.listen(PORT, () => {
    runTests();
});
