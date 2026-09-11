/**
 * storage.js - Dual-Layer Persistence Engine (IndexedDB + LocalStorage)
 * Eliminates exam loss during reload/crash, handles large image payloads (>50MB),
 * and maintains persistent exam history.
 */
const StorageManager = (() => {
    const STORAGE_KEY = 'quiz_cbt_v3';
    const EXAM_KEY = 'quiz_cbt_current_exam';
    const HISTORY_KEY = 'quiz_cbt_history';
    const DB_NAME = 'OmniQuizDB';
    const DB_VERSION = 2;

    let dbPromise = null;

    // SEC-04: Reversible XOR-based obfuscator for sensitive exam state in LocalStorage & IndexedDB
    const MASK_SALT = 'OmniQuizSecuredExamVault_2026';

    function maskPayload(str) {
        if (!str || typeof str !== 'string') return '';
        let res = '';
        for (let i = 0; i < str.length; i++) {
            res += String.fromCharCode(str.charCodeAt(i) ^ MASK_SALT.charCodeAt(i % MASK_SALT.length));
        }
        try {
            return btoa(encodeURIComponent(res));
        } catch (e) {
            return res;
        }
    }

    function unmaskPayload(str) {
        if (!str || typeof str !== 'string') return '';
        try {
            const raw = decodeURIComponent(atob(str));
            let res = '';
            for (let i = 0; i < raw.length; i++) {
                res += String.fromCharCode(raw.charCodeAt(i) ^ MASK_SALT.charCodeAt(i % MASK_SALT.length));
            }
            return res;
        } catch (e) {
            return str;
        }
    }

    // Initialize IndexedDB
    function getDB() {
        if (!('indexedDB' in window)) return Promise.resolve(null);
        if (dbPromise) return dbPromise;

        dbPromise = new Promise((resolve) => {
            try {
                const request = indexedDB.open(DB_NAME, DB_VERSION);

                request.onupgradeneeded = (e) => {
                    const db = e.target.result;
                    if (!db.objectStoreNames.contains('active_session')) {
                        db.createObjectStore('active_session', { keyPath: 'id' });
                    }
                    if (!db.objectStoreNames.contains('exam_history')) {
                        const histStore = db.createObjectStore('exam_history', { keyPath: 'id' });
                        histStore.createIndex('timestamp', 'timestamp', { unique: false });
                    }
                };

                request.onsuccess = (e) => {
                    resolve(e.target.result);
                };

                request.onerror = (e) => {
                    console.warn('[Storage] IndexedDB open error, falling back to LocalStorage:', e);
                    resolve(null);
                };
            } catch (err) {
                console.warn('[Storage] IndexedDB initialization failed:', err);
                resolve(null);
            }
        });

        return dbPromise;
    }

    // ================= ACTIVE EXAM STATE MANAGEMENT =================

    function saveState(state) {
        if (!state) return;
        const data = {
            answers: state.userAnswers || {},
            evaluated: Array.from(state.evaluatedQuestions || []),
            flagged: Array.from(state.flaggedQuestions || []),
            customImages: state.customImages || {},
            isSubmitted: Boolean(state.isSubmitted),
            timeLeft: typeof state.timeLeft === 'number' ? state.timeLeft : 3600,
            targetEndTime: state.targetEndTime || null,
            durationMinutes: state.durationMinutes || 60,
            mode: state.currentMode || 'practice',
            theme: state.currentTheme || 'academic',
            lang: state.currentLang || 'vi',
            questionCount: state.questions ? state.questions.length : 0,
            violationCount: state.violationCount || 0,
            questionTimeSpent: state.questionTimeSpent || {},
            updatedAt: Date.now()
        };

        // 1. Fast Synchronous Backup to LocalStorage
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        } catch (e) {
            try {
                // Strip heavy customImages if localStorage quota is exceeded
                const lightData = Object.assign({}, data, { customImages: {} });
                localStorage.setItem(STORAGE_KEY, JSON.stringify(lightData));
            } catch (e2) {
                console.warn('[Storage] LocalStorage quota exceeded:', e2);
            }
        }

        // 2. Comprehensive Async Save to IndexedDB (Can store 100MB+ of PDF screenshots & questions)
        getDB().then(db => {
            if (!db) return;
            try {
                const tx = db.transaction('active_session', 'readwrite');
                const store = tx.objectStore('active_session');

                // SEC-04: If exam is active and unsubmitted, mask answer keys in storage snapshot
                let questionsToStore = [];
                if (Array.isArray(state.questions)) {
                    if (state.currentMode === 'exam' && !state.isSubmitted) {
                        questionsToStore = state.questions.map(q => {
                            const realAnswers = (typeof QuizEngine !== 'undefined' && QuizEngine.getCorrectAnswers)
                                ? QuizEngine.getCorrectAnswers(q)
                                : (q.answers || []);
                            const realExp = (typeof QuizEngine !== 'undefined' && QuizEngine.getExplanation)
                                ? QuizEngine.getExplanation(q)
                                : (q.explanation || '');
                            return {
                                ...q,
                                answers: [],
                                explanation: '',
                                _secVault: maskPayload(JSON.stringify(realAnswers)),
                                _secExp: maskPayload(realExp)
                            };
                        });
                    } else {
                        questionsToStore = state.questions;
                    }
                }

                store.put({
                    id: 'current_state',
                    ...data,
                    // If questions are present, store questions snapshot to guarantee 100% crash recovery
                    questions: questionsToStore
                });
            } catch (err) {
                console.warn('[Storage] IndexedDB save state error:', err);
            }
        });
    }

    function loadState() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return null;
            const data = JSON.parse(raw);
            return {
                answers: data.answers || {},
                evaluated: new Set(data.evaluated || []),
                flagged: new Set(data.flagged || []),
                customImages: data.customImages || {},
                isSubmitted: Boolean(data.isSubmitted),
                timeLeft: typeof data.timeLeft === 'number' ? data.timeLeft : 3600,
                targetEndTime: data.targetEndTime || null,
                durationMinutes: data.durationMinutes || 60,
                mode: data.mode || 'practice',
                theme: data.theme || 'academic',
                lang: data.lang || 'vi',
                questionCount: data.questionCount || 0,
                violationCount: data.violationCount || 0,
                questionTimeSpent: data.questionTimeSpent || {},
                updatedAt: data.updatedAt || 0
            };
        } catch (e) {
            console.warn('[Storage] LocalStorage load failed:', e);
            return null;
        }
    }

    async function loadActiveSessionAsync() {
        const db = await getDB();
        if (db) {
            try {
                const session = await new Promise((resolve) => {
                    const tx = db.transaction('active_session', 'readonly');
                    const store = tx.objectStore('active_session');
                    const req = store.get('current_state');
                    req.onsuccess = () => resolve(req.result || null);
                    req.onerror = () => resolve(null);
                });
                if (session) {
                    // SEC-04: Restore masked answers and explanations if present
                    if (Array.isArray(session.questions)) {
                        session.questions = session.questions.map(q => {
                            if (q._secVault) {
                                try {
                                    q.answers = JSON.parse(unmaskPayload(q._secVault));
                                    delete q._secVault;
                                } catch (e) {
                                    q.answers = [];
                                }
                            }
                            if (q._secExp) {
                                try {
                                    q.explanation = unmaskPayload(q._secExp);
                                    delete q._secExp;
                                } catch (e) {
                                    q.explanation = '';
                                }
                            }
                            return q;
                        });
                    }
                    return {
                        ...session,
                        evaluated: new Set(session.evaluated || []),
                        flagged: new Set(session.flagged || [])
                    };
                }
            } catch (err) {
                console.warn('[Storage] Error reading session from IndexedDB:', err);
            }
        }
        return loadState();
    }

    function clearState() {
        try {
            localStorage.removeItem(STORAGE_KEY);
        } catch (e) {}

        getDB().then(db => {
            if (!db) return;
            try {
                const tx = db.transaction('active_session', 'readwrite');
                tx.objectStore('active_session').delete('current_state');
            } catch (e) {}
        });
    }

    // ================= EXAM RAW TEXT PERSISTENCE =================

    function saveCurrentExam(rawText, title = '', isExamMode = false) {
        try {
            if (!rawText) {
                localStorage.removeItem(EXAM_KEY);
                return;
            }
            const shouldMask = Boolean(isExamMode);
            const data = {
                rawText: shouldMask ? maskPayload(rawText) : rawText,
                isMasked: shouldMask,
                title: title,
                timestamp: Date.now()
            };
            localStorage.setItem(EXAM_KEY, JSON.stringify(data));
        } catch (e) {
            console.warn('[Storage] Exam save failed in localStorage:', e);
        }

        getDB().then(db => {
            if (!db) return;
            try {
                const shouldMask = Boolean(isExamMode);
                const tx = db.transaction('active_session', 'readwrite');
                tx.objectStore('active_session').put({
                    id: 'current_exam_raw',
                    rawText: shouldMask ? maskPayload(rawText) : rawText,
                    isMasked: shouldMask,
                    title: title,
                    timestamp: Date.now()
                });
            } catch (e) {}
        });
    }

    function loadCurrentExam() {
        try {
            const raw = localStorage.getItem(EXAM_KEY);
            if (!raw) return null;
            const data = JSON.parse(raw);
            if (data.isMasked && data.rawText) {
                data.rawText = unmaskPayload(data.rawText);
            }
            return data;
        } catch (e) {
            console.warn('[Storage] Exam load failed:', e);
            return null;
        }
    }

    async function loadCurrentExamAsync() {
        const db = await getDB();
        if (db) {
            try {
                const res = await new Promise((resolve) => {
                    const tx = db.transaction('active_session', 'readonly');
                    const req = tx.objectStore('active_session').get('current_exam_raw');
                    req.onsuccess = () => resolve(req.result || null);
                    req.onerror = () => resolve(null);
                });
                if (res && res.rawText) {
                    if (res.isMasked) {
                        res.rawText = unmaskPayload(res.rawText);
                    }
                    return res;
                }
            } catch (e) {}
        }
        return loadCurrentExam();
    }

    function clearCurrentExam() {
        try {
            localStorage.removeItem(EXAM_KEY);
        } catch (e) {}

        getDB().then(db => {
            if (!db) return;
            try {
                const tx = db.transaction('active_session', 'readwrite');
                tx.objectStore('active_session').delete('current_exam_raw');
            } catch (e) {}
        });
    }

    // ================= EXAM HISTORY MANAGEMENT (BaaS / Local History) =================

    async function saveExamToHistory(record) {
        if (!record) return;
        const historyItem = {
            id: record.id || 'exam_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
            title: record.title || 'Bài thi trắc nghiệm',
            timestamp: record.timestamp || Date.now(),
            dateFormatted: new Date(record.timestamp || Date.now()).toLocaleString('vi-VN'),
            durationSpent: record.durationSpent || 0,
            pacingSeconds: record.pacingSeconds || 0,
            pacingDisplay: record.pacingDisplay || '--',
            score10: record.score10 !== undefined ? record.score10 : 0,
            score100: record.score100 !== undefined ? record.score100 : 0,
            correctCount: record.correctCount || 0,
            wrongCount: record.wrongCount || 0,
            unattemptedCount: record.unattemptedCount || 0,
            totalQuestions: record.totalQuestions || 0,
            mode: record.mode || 'exam',
            violationCount: record.violationCount || 0,
            syncedToCloud: Boolean(record.syncedToCloud)
        };

        // 1. Save to LocalStorage summary list (capped at last 30 items)
        try {
            let list = getHistoryFromLocalStorage();
            list.unshift(historyItem);
            if (list.length > 30) list = list.slice(0, 30);
            localStorage.setItem(HISTORY_KEY, JSON.stringify(list));
        } catch (e) {
            console.warn('[Storage] Could not save history to localStorage:', e);
        }

        // 2. Save full detail (including answers snapshot) to IndexedDB
        const db = await getDB();
        if (db) {
            try {
                const tx = db.transaction('exam_history', 'readwrite');
                const store = tx.objectStore('exam_history');
                store.put({
                    ...historyItem,
                    userAnswers: record.userAnswers || {},
                    questionsSnapshot: record.questionsSnapshot || []
                });
            } catch (err) {
                console.warn('[Storage] Error saving history to IndexedDB:', err);
            }
        }

        // 3. Trigger cloud sync if Supabase is connected
        if (typeof SupabaseClient !== 'undefined' && SupabaseClient.isConfigured()) {
            SupabaseClient.syncExamResult(historyItem).then(synced => {
                if (synced) {
                    historyItem.syncedToCloud = true;
                    updateHistoryItemSyncStatus(historyItem.id, true);
                }
            }).catch(() => {});
        }

        return historyItem;
    }

    function getHistoryFromLocalStorage() {
        try {
            const raw = localStorage.getItem(HISTORY_KEY);
            return raw ? JSON.parse(raw) : [];
        } catch (e) {
            return [];
        }
    }

    async function getExamHistory() {
        const db = await getDB();
        if (db) {
            try {
                return await new Promise((resolve) => {
                    const tx = db.transaction('exam_history', 'readonly');
                    const store = tx.objectStore('exam_history');
                    const req = store.getAll();
                    req.onsuccess = () => {
                        const items = req.result || [];
                        items.sort((a, b) => b.timestamp - a.timestamp);
                        resolve(items);
                    };
                    req.onerror = () => resolve(getHistoryFromLocalStorage());
                });
            } catch (e) {
                return getHistoryFromLocalStorage();
            }
        }
        return getHistoryFromLocalStorage();
    }

    async function deleteExamHistory(id) {
        // LocalStorage
        try {
            let list = getHistoryFromLocalStorage();
            list = list.filter(item => item.id !== id);
            localStorage.setItem(HISTORY_KEY, JSON.stringify(list));
        } catch (e) {}

        // IndexedDB
        const db = await getDB();
        if (db) {
            try {
                const tx = db.transaction('exam_history', 'readwrite');
                tx.objectStore('exam_history').delete(id);
            } catch (e) {}
        }
    }

    async function clearAllHistory() {
        try {
            localStorage.removeItem(HISTORY_KEY);
        } catch (e) {}

        const db = await getDB();
        if (db) {
            try {
                const tx = db.transaction('exam_history', 'readwrite');
                tx.objectStore('exam_history').clear();
            } catch (e) {}
        }
    }

    function updateHistoryItemSyncStatus(id, synced) {
        try {
            let list = getHistoryFromLocalStorage();
            const it = list.find(i => i.id === id);
            if (it) {
                it.syncedToCloud = synced;
                localStorage.setItem(HISTORY_KEY, JSON.stringify(list));
            }
        } catch (e) {}

        getDB().then(db => {
            if (!db) return;
            try {
                const tx = db.transaction('exam_history', 'readwrite');
                const store = tx.objectStore('exam_history');
                const req = store.get(id);
                req.onsuccess = () => {
                    if (req.result) {
                        const updated = { ...req.result, syncedToCloud: synced };
                        store.put(updated);
                    }
                };
            } catch (err) {
                console.warn('[Storage] Error updating sync status in IndexedDB:', err);
            }
        });
    }

    // ================= PREFERENCES =================

    function savePreference(key, value) {
        try {
            localStorage.setItem('pref_' + key, value);
        } catch (e) {}
    }

    function loadPreference(key, defaultValue) {
        try {
            return localStorage.getItem('pref_' + key) || defaultValue;
        } catch (e) {
            return defaultValue;
        }
    }

    return {
        saveState,
        loadState,
        loadActiveSessionAsync,
        clearState,
        savePreference,
        loadPreference,
        saveCurrentExam,
        loadCurrentExam,
        loadCurrentExamAsync,
        clearCurrentExam,
        saveExamToHistory,
        getExamHistory,
        deleteExamHistory,
        clearAllHistory,
        maskPayload,
        unmaskPayload
    };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = StorageManager;
}

