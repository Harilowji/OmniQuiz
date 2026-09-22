/**
 * audio.js - High-Performance Audio Feedback Manager
 * 100% Web Audio API synthesized tones (zero disk I/O, zero network delay, sub-millisecond latency).
 * Singleton AudioContext with lazy initialization and user-gesture unlock.
 */
const AudioManager = (() => {
    let audioCtx = null;
    let isSoundEnabled = localStorage.getItem('quiz_sound_enabled') === 'true'; // Default FALSE (0ms latency, zero audio overhead)

    function getAudioContext() {
        if (!audioCtx) {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (AudioCtx) {
                audioCtx = new AudioCtx();
            }
        }
        if (audioCtx && audioCtx.state === 'suspended') {
            audioCtx.resume().catch(() => {});
        }
        return audioCtx;
    }

    // Pre-warm / unlock AudioContext on first user gesture
    const unlock = () => {
        getAudioContext();
        window.removeEventListener('click', unlock);
        window.removeEventListener('keydown', unlock);
        window.removeEventListener('touchstart', unlock);
    };
    if (typeof window !== 'undefined') {
        window.addEventListener('click', unlock, { passive: true, once: true });
        window.addEventListener('keydown', unlock, { passive: true, once: true });
        window.addEventListener('touchstart', unlock, { passive: true, once: true });
    }

    function playTone(freq, type, duration, startTimeOffset = 0, volume = 0.15) {
        if (!isSoundEnabled) return;
        try {
            const ctx = getAudioContext();
            if (!ctx) return;
            const now = ctx.currentTime + startTimeOffset;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = type;
            osc.frequency.setValueAtTime(freq, now);

            gain.gain.setValueAtTime(volume, now);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.start(now);
            osc.stop(now + duration);
        } catch (e) {
            // Audio failure should never block UI
        }
    }

    function playCorrect() {
        if (!isSoundEnabled) return;
        // Crisp, pleasant two-tone chime (D5 -> A5)
        playTone(587.33, 'sine', 0.12, 0, 0.18);
        playTone(880.00, 'sine', 0.18, 0.08, 0.15);
    }

    function playIncorrect() {
        if (!isSoundEnabled) return;
        // Subtle, gentle buzz (low triangle, non-harsh)
        playTone(220, 'triangle', 0.14, 0, 0.15);
        playTone(165, 'triangle', 0.18, 0.07, 0.12);
    }

    return {
        playCorrect,
        playIncorrect,
        playDing: playCorrect,
        playBuzz: playIncorrect,
        isMuted: () => !isSoundEnabled,
        isSoundEnabled: () => isSoundEnabled,
        setSoundEnabled: (enabled) => {
            isSoundEnabled = Boolean(enabled);
            localStorage.setItem('quiz_sound_enabled', isSoundEnabled ? 'true' : 'false');
        },
        toggleSound: () => {
            isSoundEnabled = !isSoundEnabled;
            localStorage.setItem('quiz_sound_enabled', isSoundEnabled ? 'true' : 'false');
            return isSoundEnabled;
        }
    };
})();
