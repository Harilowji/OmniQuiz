/**
 * storage.js - LocalStorage & State Persistence Manager
 */
const StorageManager = (() => {
    const STORAGE_KEY = 'quiz_cbt_v3';

    function saveState(state) {
        const data = {
            answers: state.userAnswers,
            flagged: Array.from(state.flaggedQuestions),
            customImages: state.customImages || {},
            isSubmitted: state.isSubmitted,
            timeLeft: state.timeLeft,
            mode: state.currentMode,
            theme: state.currentTheme,
            lang: state.currentLang,
            questionCount: state.questions ? state.questions.length : 0
        };
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        } catch (e) {
            console.warn('Storage save failed with images, retrying without heavy image payload:', e);
            try {
                // Strip customImages payload if storage quota is hit so user answers are NEVER lost
                const lightData = Object.assign({}, data, { customImages: {} });
                localStorage.setItem(STORAGE_KEY, JSON.stringify(lightData));
            } catch (e2) {
                console.warn('Storage save completely failed:', e2);
            }
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
                customImages: data.customImages || {},
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

    const EXAM_KEY = 'quiz_cbt_current_exam';

    function saveCurrentExam(rawText, title = '') {
        try {
            if (!rawText) {
                localStorage.removeItem(EXAM_KEY);
                return;
            }
            const data = {
                rawText: rawText,
                title: title,
                timestamp: Date.now()
            };
            localStorage.setItem(EXAM_KEY, JSON.stringify(data));
        } catch (e) {
            console.warn('Exam save failed:', e);
        }
    }

    function loadCurrentExam() {
        try {
            const raw = localStorage.getItem(EXAM_KEY);
            if (!raw) return null;
            return JSON.parse(raw);
        } catch (e) {
            console.warn('Exam load failed:', e);
            return null;
        }
    }

    function clearCurrentExam() {
        try {
            localStorage.removeItem(EXAM_KEY);
        } catch (e) {}
    }

    return {
        saveState,
        loadState,
        clearState,
        savePreference,
        loadPreference,
        saveCurrentExam,
        loadCurrentExam,
        clearCurrentExam
    };
})();
