/**
 * js/api-client.js - Full-Stack RESTful API Client for OmniQuiz PRO
 * Bridges Frontend SPA with Node.js Backend Server & Persistent Database.
 * Implements the 12-step request-response architecture with JWT Authentication,
 * automatic fallback to offline storage, and realtime status tracking.
 */

const ApiClient = (() => {
    // Determine default API Base URL (relative path works on same host, or fallback to localhost:3000)
    const isLocalFile = window.location.protocol === 'file:';
    const DEFAULT_BASE_URL = isLocalFile ? 'http://localhost:3000/api' : '/api';
    
    const STORAGE_KEY_TOKEN = 'omni_auth_token';
    const STORAGE_KEY_USER = 'omni_auth_user';
    const STORAGE_KEY_API_URL = 'omni_api_base_url';

    let apiBaseUrl = localStorage.getItem(STORAGE_KEY_API_URL) || DEFAULT_BASE_URL;
    let authToken = localStorage.getItem(STORAGE_KEY_TOKEN) || null;
    let currentUser = null;
    let serverOnline = false;
    let serverHealthData = null;

    const authListeners = [];
    const statusListeners = [];

    // Restore cached user info
    try {
        const cachedUser = localStorage.getItem(STORAGE_KEY_USER);
        if (cachedUser) currentUser = JSON.parse(cachedUser);
    } catch (e) {
        currentUser = null;
    }

    /**
     * Core Fetch Wrapper with Bearer Token and JSON Parsing
     */
    async function request(endpoint, options = {}) {
        const url = `${apiBaseUrl}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;
        const headers = {
            'Content-Type': 'application/json',
            ...(options.headers || {})
        };

        if (authToken) {
            headers['Authorization'] = `Bearer ${authToken}`;
        }

        const config = {
            ...options,
            headers
        };

        if (config.body && typeof config.body === 'object') {
            config.body = JSON.stringify(config.body);
        }

        try {
            const res = await fetch(url, config);
            const data = await res.json().catch(() => ({}));
            
            if (!res.ok) {
                const errorMsg = data.error || data.message || `Lỗi HTTP ${res.status}: ${res.statusText}`;
                const err = new Error(errorMsg);
                err.status = res.status;
                err.data = data;
                throw err;
            }

            return data;
        } catch (err) {
            // Check if network error (server offline)
            if (err.name === 'TypeError' && err.message.includes('fetch')) {
                setOnlineStatus(false);
                throw new Error('Không thể kết nối đến máy chủ API (Máy chủ đang tắt hoặc mất mạng)');
            }
            throw err;
        }
    }

    function setOnlineStatus(isOnline, healthData = null) {
        serverOnline = isOnline;
        serverHealthData = healthData;
        statusListeners.forEach(fn => {
            try { fn(serverOnline, serverHealthData); } catch (e) {}
        });
    }

    function setAuth(token, user) {
        authToken = token;
        currentUser = user;
        if (token) {
            localStorage.setItem(STORAGE_KEY_TOKEN, token);
        } else {
            localStorage.removeItem(STORAGE_KEY_TOKEN);
        }

        if (user) {
            localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(user));
        } else {
            localStorage.removeItem(STORAGE_KEY_USER);
        }

        authListeners.forEach(fn => {
            try { fn(currentUser, authToken); } catch (e) {}
        });
    }

    // ==========================================
    // 1. HEALTH & SYSTEM DIAGNOSTICS (Step 1-5)
    // ==========================================

    async function checkHealth() {
        try {
            const res = await request('/health', { method: 'GET' });
            if (res && res.success) {
                setOnlineStatus(true, res);
                return res;
            }
            setOnlineStatus(false, null);
            return null;
        } catch (err) {
            setOnlineStatus(false, null);
            return null;
        }
    }

    // ==========================================
    // 2. AUTHENTICATION & USERS (Step 6-8)
    // ==========================================

    async function login(email, password) {
        const res = await request('/auth/login', {
            method: 'POST',
            body: { email, password }
        });

        if (res.success && res.data) {
            setAuth(res.data.token, res.data.user);
            return res.data;
        }
        throw new Error(res.error || 'Đăng nhập thất bại!');
    }

    async function register(payload) {
        const res = await request('/auth/register', {
            method: 'POST',
            body: payload
        });

        if (res.success && res.data) {
            setAuth(res.data.token, res.data.user);
            return res.data;
        }
        throw new Error(res.error || 'Đăng ký thất bại!');
    }

    async function getMe() {
        if (!authToken) return null;
        try {
            const res = await request('/auth/me', { method: 'GET' });
            if (res.success && res.data && res.data.user) {
                currentUser = res.data.user;
                localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(currentUser));
                return currentUser;
            }
            return null;
        } catch (err) {
            if (err.status === 401) {
                logout();
            }
            return null;
        }
    }

    function logout() {
        setAuth(null, null);
    }

    // ==========================================
    // 3. EXAMS & QUESTION BANKS (Step 8-11)
    // ==========================================

    async function getExams(query = {}) {
        const qs = new URLSearchParams();
        if (query.subject) qs.append('subject', query.subject);
        if (query.search) qs.append('search', query.search);
        
        const endpoint = `/exams${qs.toString() ? `?${qs.toString()}` : ''}`;
        const res = await request(endpoint, { method: 'GET' });
        return res.data || [];
    }

    async function getExamById(id, mode = 'practice') {
        const res = await request(`/exams/${id}?mode=${encodeURIComponent(mode)}`, { method: 'GET' });
        return res.data || null;
    }

    async function createExam(examData) {
        const res = await request('/exams', {
            method: 'POST',
            body: examData
        });
        return res.data;
    }

    async function deleteExam(id) {
        const res = await request(`/exams/${id}`, { method: 'DELETE' });
        return res.success;
    }

    // ==========================================
    // 4. SUBMISSIONS & SERVER-SIDE GRADING
    // ==========================================

    async function submitExam(submissionData) {
        const res = await request('/submissions', {
            method: 'POST',
            body: submissionData
        });
        return res.data;
    }

    async function getMyHistory() {
        if (!authToken) return [];
        const res = await request('/submissions/my-history', { method: 'GET' });
        return res.data || [];
    }

    // ==========================================
    // 5. ONLINE ROOMS & LIVE LEADERBOARD
    // ==========================================

    async function createRoom(roomData) {
        const res = await request('/rooms', {
            method: 'POST',
            body: roomData
        });
        return res.data;
    }

    async function getRoom(pin) {
        const res = await request(`/rooms/${pin}`, { method: 'GET' });
        return res.data || null;
    }

    async function submitRoomExam(pin, studentSubmission) {
        const res = await request(`/rooms/${pin}/submit`, {
            method: 'POST',
            body: studentSubmission
        });
        return res.data;
    }

    async function getRoomLeaderboard(pin) {
        const res = await request(`/rooms/${pin}/leaderboard`, { method: 'GET' });
        return res.data || null;
    }

    // ==========================================
    // 6. SERVER-SIDE AI TUTOR & OCR PROXY
    // ==========================================

    async function askAiTutor(prompt, context = {}) {
        const res = await request('/ai/tutor', {
            method: 'POST',
            body: { prompt, context }
        });
        return res.data;
    }

    async function ocrImage(base64Image, mimeType = 'image/jpeg') {
        const res = await request('/ai/ocr', {
            method: 'POST',
            body: { image: base64Image, mimeType }
        });
        return res.data;
    }

    // ==========================================
    // 7. EVENT SUBSCRIPTION & AUTO INITIALIZE
    // ==========================================

    function onAuthChange(callback) {
        if (typeof callback === 'function') authListeners.push(callback);
    }

    function onStatusChange(callback) {
        if (typeof callback === 'function') statusListeners.push(callback);
    }

    function setBaseUrl(newUrl) {
        apiBaseUrl = newUrl.replace(/\/+$/, '');
        localStorage.setItem(STORAGE_KEY_API_URL, apiBaseUrl);
        checkHealth();
    }

    function getBaseUrl() {
        return apiBaseUrl;
    }

    // Auto initialize upon loading
    async function init() {
        console.log('[ApiClient] Initializing REST API connection to:', apiBaseUrl);
        await checkHealth();

        if (authToken) {
            await getMe();
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    return {
        // Core state getters
        isOnline: () => serverOnline,
        getHealthData: () => serverHealthData,
        getCurrentUser: () => currentUser,
        getToken: () => authToken,
        getBaseUrl,
        setBaseUrl,

        // Authentication
        login,
        register,
        logout,
        getMe,
        onAuthChange,
        onStatusChange,
        checkHealth,

        // Exams & Question Bank
        getExams,
        getExamById,
        createExam,
        deleteExam,

        // Submissions & Grading
        submitExam,
        getMyHistory,

        // Realtime Rooms & Leaderboard
        createRoom,
        getRoom,
        submitRoomExam,
        getRoomLeaderboard,

        // AI Services
        askAiTutor,
        ocrImage
    };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = ApiClient;
}
