/**
 * supabase-client.js - BaaS (Backend-as-a-Service) Integration with Supabase
 * Provides serverless persistent storage, cloud synchronization, and user authentication
 * for exam history without maintaining any dedicated backend server.
 */
const SupabaseClient = (() => {
    const STORAGE_KEY_URL = 'omni_supabase_url';
    const STORAGE_KEY_ANON = 'omni_supabase_anon_key';

    let client = null;

    function getStoredConfig() {
        const url = localStorage.getItem(STORAGE_KEY_URL) || '';
        const key = localStorage.getItem(STORAGE_KEY_ANON) || '';
        return { url, key };
    }

    function saveConfig(url, key) {
        if (!url || !key) {
            localStorage.removeItem(STORAGE_KEY_URL);
            localStorage.removeItem(STORAGE_KEY_ANON);
            client = null;
            return false;
        }
        localStorage.setItem(STORAGE_KEY_URL, url.trim());
        localStorage.setItem(STORAGE_KEY_ANON, key.trim());
        initClient();
        return true;
    }

    function initClient() {
        const { url, key } = getStoredConfig();
        if (url && key && window.supabase && typeof window.supabase.createClient === 'function') {
            try {
                client = window.supabase.createClient(url, key);
                console.log('[Supabase] BaaS Client initialized successfully');
                return client;
            } catch (err) {
                console.warn('[Supabase] Initialization failed:', err);
                client = null;
            }
        }
        return null;
    }

    function isConfigured() {
        if (!client) initClient();
        return Boolean(client);
    }

    // Auto-init on script load
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initClient);
    } else {
        initClient();
    }

    /**
     * Synchronize a completed exam result to Supabase PostgreSQL table: "exam_history"
     * Table schema:
     * id (text, PK), title (text), score10 (numeric), score100 (numeric),
     * correct_count (int), wrong_count (int), total_questions (int),
     * duration_spent (int), created_at (timestamptz), user_email (text)
     */
    async function syncExamResult(record) {
        if (!isConfigured()) return false;

        try {
            const user = await getCurrentUser();
            const payload = {
                id: record.id,
                title: record.title || 'Bài thi trắc nghiệm',
                score10: record.score10,
                score100: record.score100,
                correct_count: record.correctCount,
                wrong_count: record.wrongCount,
                unattempted_count: record.unattemptedCount,
                total_questions: record.totalQuestions,
                duration_spent: record.durationSpent,
                created_at: new Date(record.timestamp || Date.now()).toISOString(),
                user_email: user ? user.email : 'guest'
            };

            const { data, error } = await client
                .from('exam_history')
                .upsert([payload]);

            if (error) {
                console.warn('[Supabase] Failed to sync exam result to cloud:', error.message);
                return false;
            }

            console.log('[Supabase] Exam successfully synced to cloud PostgreSQL');
            return true;
        } catch (err) {
            console.warn('[Supabase] Cloud sync error:', err);
            return false;
        }
    }

    /**
     * Fetch all past exam history from Supabase cloud database
     */
    async function fetchCloudHistory() {
        if (!isConfigured()) return [];

        try {
            const { data, error } = await client
                .from('exam_history')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(50);

            if (error) {
                console.warn('[Supabase] Error fetching cloud history:', error.message);
                return [];
            }

            return (data || []).map(row => ({
                id: row.id,
                title: row.title,
                score10: row.score10,
                score100: row.score100,
                correctCount: row.correct_count,
                wrongCount: row.wrong_count,
                unattemptedCount: row.unattempted_count,
                totalQuestions: row.total_questions,
                durationSpent: row.duration_spent,
                timestamp: new Date(row.created_at).getTime(),
                dateFormatted: new Date(row.created_at).toLocaleString('vi-VN'),
                syncedToCloud: true
            }));
        } catch (err) {
            console.warn('[Supabase] Failed to load cloud history:', err);
            return [];
        }
    }

    // ================= AUTHENTICATION (OPTIONAL) =================

    async function getCurrentUser() {
        if (!isConfigured()) return null;
        try {
            const { data } = await client.auth.getUser();
            return data ? data.user : null;
        } catch (e) {
            return null;
        }
    }

    async function signInWithEmail(email, password) {
        if (!isConfigured()) throw new Error('Supabase chưa được cấu hình URL và Anon Key');
        const { data, error } = await client.auth.signInWithPassword({ email, password });
        if (error) throw error;
        return data.user;
    }

    async function signUpWithEmail(email, password) {
        if (!isConfigured()) throw new Error('Supabase chưa được cấu hình URL và Anon Key');
        const { data, error } = await client.auth.signUp({ email, password });
        if (error) throw error;
        return data.user;
    }

    async function signOut() {
        if (!isConfigured()) return;
        await client.auth.signOut();
    }

    return {
        getStoredConfig,
        saveConfig,
        initClient,
        isConfigured,
        syncExamResult,
        fetchCloudHistory,
        getCurrentUser,
        signInWithEmail,
        signUpWithEmail,
        signOut
    };
})();
