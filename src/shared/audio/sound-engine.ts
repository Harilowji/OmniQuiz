/**
 * src/shared/audio/sound-engine.ts
 * Pure Web Audio API Anime Sound Engine for OmniQuiz PRO
 * Zero external MP3 files - Synthesizes crisp, cheerful anime game SFX via OscillatorNode & GainNode
 */

const STORAGE_KEY = 'omniquiz_sound_enabled';

export class SoundEngine {
  private audioCtx: AudioContext | null = null;
  private isEnabled: boolean = true;

  constructor() {
    this.initSoundPreference();
  }

  private initSoundPreference(): void {
    if (typeof window === 'undefined') return;
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      // Default to true unless explicitly turned off
      this.isEnabled = saved !== 'false';
    } catch {
      this.isEnabled = true;
    }
  }

  private getAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.audioCtx) {
      const AudioCtxClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtxClass) {
        this.audioCtx = new AudioCtxClass();
      }
    }

    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      void this.audioCtx.resume();
    }

    return this.audioCtx;
  }

  public isSoundEnabled(): boolean {
    return this.isEnabled;
  }

  public isSoundActive(): boolean {
    return this.isEnabled;
  }

  public toggle(): boolean {
    return this.toggleSound();
  }

  public setSoundEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(STORAGE_KEY, enabled ? 'true' : 'false');
      }
    } catch (e) {
      console.warn('[SoundEngine] Could not persist sound preference:', e);
    }
    this.updateSoundUi();
  }

  public toggleSound(): boolean {
    this.setSoundEnabled(!this.isEnabled);
    if (this.isEnabled) {
      this.playClick();
    }
    return this.isEnabled;
  }

  public updateSoundUi(): void {
    if (typeof document === 'undefined') return;

    // 1. Top Navbar sound toggle button
    const toggleBtn = document.getElementById('btn-sound-toggle');
    if (toggleBtn) {
      toggleBtn.innerHTML = this.isEnabled ? '🔊' : '🔇';
      toggleBtn.setAttribute('title', this.isEnabled ? 'Tắt âm thanh SFX' : 'Bật âm thanh SFX');
      toggleBtn.classList.toggle('active', this.isEnabled);
    }

    // 2. Tools Modal sound option pills
    const soundOnBtn = document.getElementById('btn-sound-on');
    const soundOffBtn = document.getElementById('btn-sound-off');
    if (soundOnBtn && soundOffBtn) {
      soundOnBtn.classList.toggle('active', this.isEnabled);
      soundOffBtn.classList.toggle('active', !this.isEnabled);
    }
  }

  /**
   * Short gentle UI click sound (UI Pop)
   */
  public playClick(): void {
    if (!this.isEnabled) return;
    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(600, now);
      osc.frequency.exponentialRampToValueAtTime(950, now + 0.05);

      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.06);
    } catch {
      // Audio playback fails gracefully if context blocked
    }
  }

  /**
   * Cheerful major chord arpeggio for correct answer (C5 -> E5 -> G5)
   */
  public playCorrect(): void {
    if (!this.isEnabled) return;
    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const notes = [523.25, 659.25, 783.99]; // C5, E5, G5
      notes.forEach((freq, i) => {
        const start = now + i * 0.07;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, start);

        gain.gain.setValueAtTime(0.18, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.22);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(start);
        osc.stop(start + 0.23);
      });
    } catch {}
  }

  /**
   * Subtle descending tone for incorrect answer (A3 -> F3)
   */
  public playWrong(): void {
    if (!this.isEnabled) return;
    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, now); // A3
      osc.frequency.exponentialRampToValueAtTime(174.61, now + 0.22); // F3

      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

      // Lowpass filter to smooth harsh sawtooth
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(600, now);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.25);
    } catch {}
  }

  /**
   * Energetic ascending fanfare for combo streak (Combo 3x, 5x, 10x)
   */
  public playCombo(comboCount: number = 3): void {
    if (!this.isEnabled) return;
    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      // C5, E5, G5, C6, higher octave if combo is high
      const notes =
        comboCount >= 5
          ? [523.25, 659.25, 783.99, 1046.5, 1318.51] // C5, E5, G5, C6, E6
          : [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6

      notes.forEach((freq, idx) => {
        const start = now + idx * 0.06;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, start);

        gain.gain.setValueAtTime(0.2, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.28);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(start);
        osc.stop(start + 0.29);
      });
    } catch {}
  }

  /**
   * 3D Card flip sound for Flashcards
   */
  public playFlip(): void {
    if (!this.isEnabled) return;
    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(320, now);
      osc.frequency.exponentialRampToValueAtTime(750, now + 0.08);

      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.1);
    } catch {}
  }

  /**
   * Grand Victory completion melody for exam results and boss defeat
   */
  public playVictory(): void {
    if (!this.isEnabled) return;
    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      // G4, C5, E5, G5, wait a moment, C6 sustained
      const sequence = [
        { freq: 392.0, time: 0, dur: 0.12 }, // G4
        { freq: 523.25, time: 0.13, dur: 0.12 }, // C5
        { freq: 659.25, time: 0.26, dur: 0.12 }, // E5
        { freq: 783.99, time: 0.39, dur: 0.2 }, // G5
        { freq: 1046.5, time: 0.62, dur: 0.6 }, // C6
      ];

      sequence.forEach((item) => {
        const start = now + item.time;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(item.freq, start);

        gain.gain.setValueAtTime(0.25, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + item.dur);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(start);
        osc.stop(start + item.dur);
      });
    } catch {}
  }
}

export const soundEngine = new SoundEngine();
