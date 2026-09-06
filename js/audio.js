/**
 * audio.js - Audio Feedback Manager
 * Hybrid: HTML5 Audio with Web Audio API Synthesizer fallback
 */
const AudioManager = (() => {
    let ding = null;
    let buzz = null;

    try {
        ding = new Audio('ding.wav');
        buzz = new Audio('buzz.wav');
    } catch (e) {}

    // Web Audio API Synthesizer (100% offline, zero latency, guaranteed fallback)
    function playSynthesizedTone(freq, type, duration, delay = 0) {
        try {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (!AudioCtx) return;
            const ctx = new AudioCtx();
            setTimeout(() => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = type;
                osc.frequency.setValueAtTime(freq, ctx.currentTime);
                gain.gain.setValueAtTime(0.25, ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start();
                osc.stop(ctx.currentTime + duration);
            }, delay * 1000);
        } catch (e) {}
    }

    return {
        playCorrect: () => {
            let played = false;
            if (ding) {
                ding.currentTime = 0;
                const promise = ding.play();
                if (promise !== undefined) {
                    promise.then(() => { played = true; }).catch(() => {
                        // Fallback chime: C5 -> G5
                        playSynthesizedTone(523.25, 'sine', 0.25, 0);
                        playSynthesizedTone(783.99, 'sine', 0.35, 0.12);
                    });
                }
            } else {
                playSynthesizedTone(523.25, 'sine', 0.25, 0);
                playSynthesizedTone(783.99, 'sine', 0.35, 0.12);
            }
        },
        playIncorrect: () => {
            let played = false;
            if (buzz) {
                buzz.currentTime = 0;
                const promise = buzz.play();
                if (promise !== undefined) {
                    promise.then(() => { played = true; }).catch(() => {
                        // Fallback buzz
                        playSynthesizedTone(180, 'sawtooth', 0.18, 0);
                        playSynthesizedTone(140, 'sawtooth', 0.25, 0.14);
                    });
                }
            } else {
                playSynthesizedTone(180, 'sawtooth', 0.18, 0);
                playSynthesizedTone(140, 'sawtooth', 0.25, 0.14);
            }
        }
    };
})();
