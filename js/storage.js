/**
 * storage.js - LocalStorage & State Persistence Manager
 */
const StorageManager = (() => {
    const STORAGE_KEY = 'quiz_cbt_v3';

    function saveState(state) {
        try {
            const data = {
                answers: state.userAnswers,
                flagged: Array.from(state.flaggedQuestions),
                isSubmitted: state.isSubmitted,
                timeLeft: state.timeLeft,
                mode: state.currentMode,
                theme: state.currentTheme,
                lang: state.currentLang,
                questionCount: state.questions ? state.questions.length : 0
            };
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        } catch (e) {
            console.warn('Storage save failed:', e);
        }
    }

    function loadState() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return null;
            const data = JSON.parse(raw);
            return {
                answers: data.answers || {},
                flagged: new Set(data.flagged || []),
                isSubmitted: data.isSubmitted || false,
                timeLeft: typeof data.timeLeft === 'number' ? data.timeLeft : 3600,
                mode: data.mode || 'practice',
                theme: data.theme || 'academic',
                lang: data.lang || 'vi',
                questionCount: data.questionCount || 0
            };
        } catch (e) {
            console.warn('Storage load failed:', e);
            return null;
        }
    }

    function clearState() {
        try {
            localStorage.removeItem(STORAGE_KEY);
        } catch (e) {}
    }

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
        clearState,
        savePreference,
        loadPreference
    };
})();
