/**
 * @vitest-environment jsdom
 * tests/unit/phase6-ecosystem.test.ts - Phase 6.0 Anime Academy Ecosystem Tests
 * Verifies Boss Raid Arena Engine, Zero-Server Shareable Link & Canvas QR,
 * Anime Sound Engine, and Weakness Bank Smart Retry.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { bossRaidEngine, ACADEMY_BOSSES } from '../../src/features/arena/boss-raid-engine';
import { shareExamLinkService } from '../../src/features/classroom/share-exam-link';
import { soundEngine } from '../../src/shared/audio/sound-engine';
import { analyticsDashboard, type WeaknessItem } from '../../src/features/analytics/analytics-dashboard';
import type { Exam } from '../../src/shared/types';

describe('Phase 6.0: Boss Raid Arena Mode', () => {
  const mockExam: Exam = {
    id: 'exam-boss-test',
    title: 'Đề Thi Thử Boss Raid',
    subject: 'Toán Học',
    durationMinutes: 45,
    questions: [
      {
        id: 'q1',
        index: 1,
        text: 'Tìm đạo hàm của hàm số $y = x^3$',
        options: ['$3x^2$', '$2x$', '$x^2$', '$3x$'],
        correctAnswer: [0],
        type: 'single',
      },
      {
        id: 'q2',
        index: 2,
        text: 'Tính nguyên hàm của $\\int 2x dx$',
        options: ['$x^2 + C$', '$2x^2 + C$', '$x + C$', '$\\frac{x^2}{2} + C$'],
        correctAnswer: [0],
        type: 'single',
      },
      {
        id: 'q3',
        index: 3,
        text: 'Câu hỏi số 3',
        options: ['A', 'B', 'C', 'D'],
        correctAnswer: [1],
        type: 'single',
      },
    ],
  };

  beforeEach(() => {
    bossRaidEngine.endRaid();
  });

  it('exposes the 3 Academy Bosses with correct tiers and multipliers', () => {
    const bosses = bossRaidEngine.getBosses();
    expect(bosses.length).toBe(3);

    const demon = bossRaidEngine.getBossById('calculus_demon');
    expect(demon.name).toBe('Đại Ma Vương Giải Tích');
    expect(demon.maxHp).toBe(1000);
    expect(demon.expMultiplier).toBe(1.5);

    const quantum = bossRaidEngine.getBossById('quantum_entity');
    expect(quantum.name).toBe('Thực Thể Lượng Tử Không Gian');
    expect(quantum.maxHp).toBe(2500);
    expect(quantum.expMultiplier).toBe(2.0);

    const president = bossRaidEngine.getBossById('omni_president');
    expect(president.name).toBe('Hội Trưởng Tối Cao Học Viện Omni');
    expect(president.maxHp).toBe(5000);
    expect(president.expMultiplier).toBe(3.0);
  });

  it('initializes boss raid with full HP and 3 player hearts', () => {
    const demon = bossRaidEngine.getBossById('calculus_demon');
    bossRaidEngine.initRaid(demon, mockExam);

    const state = bossRaidEngine.getState();
    expect(state).not.toBeNull();
    expect(state?.boss.id).toBe('calculus_demon');
    expect(state?.bossCurrentHp).toBe(1000);
    expect(state?.studentHearts).toBe(3);
    expect(state?.combo).toBe(0);
    expect(state?.isDefeated).toBe(false);
    expect(bossRaidEngine.isActive()).toBe(true);
  });

  it('calculates damage and combo progression on correct answers', () => {
    const demon = bossRaidEngine.getBossById('calculus_demon');
    bossRaidEngine.initRaid(demon, mockExam);

    // Question 1 correct -> combo 1
    const r1 = bossRaidEngine.handleAnswerFeedback(true);
    expect(r1.damageDealt).toBeGreaterThan(0);
    expect(r1.combo).toBe(1);
    expect(r1.heartsLeft).toBe(3);
    expect(r1.bossHpLeft).toBeLessThan(1000);

    // Question 2 correct -> combo 2, combo multiplier should deal more damage
    const r2 = bossRaidEngine.handleAnswerFeedback(true);
    expect(r2.combo).toBe(2);
    expect(r2.damageDealt).toBeGreaterThan(r1.damageDealt);
  });

  it('resets combo and deducts a player heart on wrong answer', () => {
    const demon = bossRaidEngine.getBossById('calculus_demon');
    bossRaidEngine.initRaid(demon, mockExam);

    // Correct first to build combo
    bossRaidEngine.handleAnswerFeedback(true);
    expect(bossRaidEngine.getState()?.combo).toBe(1);

    // Wrong answer
    const result = bossRaidEngine.handleAnswerFeedback(false);
    expect(result.damageDealt).toBe(0);
    expect(result.combo).toBe(0);
    expect(result.heartsLeft).toBe(2);
  });

  it('detects boss defeat and calculates bonus EXP multiplier upon raid completion', () => {
    const demon = { ...ACADEMY_BOSSES[0], maxHp: 50 }; // Low HP boss for quick kill
    bossRaidEngine.initRaid(demon, mockExam);

    // Deal damage until boss is defeated
    while (!bossRaidEngine.getState()?.isDefeated) {
      bossRaidEngine.handleAnswerFeedback(true);
    }
    const state = bossRaidEngine.getState();
    expect(state?.isDefeated).toBe(true);

    const summary = bossRaidEngine.finalizeRaid(90);
    expect(summary).not.toBeNull();
    expect(summary?.isVictorious).toBe(true);
    expect(summary?.bonusExp).toBeGreaterThan(100);
  });
});

describe('Phase 6.0: Zero-Server Shareable Link & QR Service', () => {
  const sampleExam: Exam = {
    id: 'exam-share-001',
    title: 'Khảo Sát Chất Lượng Toán 12 - THPT Chuyên',
    subject: 'Toán Học',
    durationMinutes: 90,
    questions: [
      {
        id: 'q1',
        index: 1,
        text: 'Nghiệm của phương trình $\\log_2(x - 1) = 3$ là:',
        options: ['$x = 9$', '$x = 7$', '$x = 8$', '$x = 10$'],
        correctAnswer: [0],
        explanation: 'Ta có $x - 1 = 2^3 = 8 \\Rightarrow x = 9$.',
        type: 'single',
      },
      {
        id: 'q2',
        index: 2,
        text: 'Cho hàm số $f(x)$ có bảng biến thiên như sau. Số điểm cực trị là:',
        options: ['1', '2', '3', '0'],
        correctAnswer: [1],
        explanation: 'Hàm số đổi dấu 2 lần.',
        type: 'single',
      },
    ],
  };

  it('compresses exam into URL-safe base64 string using JSZip DEFLATE', async () => {
    const encoded = await shareExamLinkService.encodeShareableExam(sampleExam);
    expect(encoded).toBeDefined();
    expect(typeof encoded).toBe('string');
    expect(encoded.length).toBeGreaterThan(20);
    // Should be URL-safe (no +, /, or =)
    expect(encoded).not.toContain('+');
    expect(encoded).not.toContain('/');
    expect(encoded).not.toContain('=');
  });

  it('successfully uncompresses and reconstructs complete Exam structure with Vietnamese & Math KaTeX intact', async () => {
    const encoded = await shareExamLinkService.encodeShareableExam(sampleExam);
    const decoded = await shareExamLinkService.decodeShareableExam(encoded);

    expect(decoded).not.toBeNull();
    expect(decoded?.title).toBe(sampleExam.title);
    expect(decoded?.subject).toBe(sampleExam.subject);
    expect(decoded?.durationMinutes).toBe(sampleExam.durationMinutes);
    expect(decoded?.questions.length).toBe(2);

    // Question 1 verification
    const q1 = decoded!.questions[0];
    expect(q1.text).toBe(sampleExam.questions[0].text);
    expect(q1.options).toEqual(sampleExam.questions[0].options);
    expect(q1.correctAnswer).toEqual([0]);
    expect(q1.explanation).toBe(sampleExam.questions[0].explanation);
  });

  it('returns null on invalid or corrupt share payload', async () => {
    const result = await shareExamLinkService.decodeShareableExam('invalid_corrupted_payload_string');
    expect(result).toBeNull();
  });

  it('generates share URL with ?share= parameter', async () => {
    const url = await shareExamLinkService.generateShareUrl(sampleExam);
    expect(url).toContain('?share=');
  });
});

describe('Phase 6.0: Anime Sound Engine', () => {
  const mockStorage: Record<string, string> = {};
  const mockLocalStorage = {
    getItem: (key: string) => mockStorage[key] ?? null,
    setItem: (key: string, val: string) => {
      mockStorage[key] = String(val);
    },
    removeItem: (key: string) => {
      delete mockStorage[key];
    },
    clear: () => {
      for (const k of Object.keys(mockStorage)) delete mockStorage[k];
    },
  };

  beforeEach(() => {
    mockLocalStorage.clear();
    Object.defineProperty(globalThis, 'localStorage', {
      value: mockLocalStorage,
      writable: true,
      configurable: true,
    });
    if (typeof window !== 'undefined') {
      Object.defineProperty(window, 'localStorage', {
        value: mockLocalStorage,
        writable: true,
        configurable: true,
      });
    }
  });

  it('toggles sound on and off and persists to localStorage', () => {
    // Initial toggle
    const state1 = soundEngine.toggle();
    expect(typeof state1).toBe('boolean');
    expect(mockStorage['omniquiz_sound_enabled']).toBe(String(state1));

    const state2 = soundEngine.toggle();
    expect(state2).toBe(!state1);
    expect(mockStorage['omniquiz_sound_enabled']).toBe(String(state2));
  });

  it('calls synthesizer methods without crashing even in jsdom mock environment', () => {
    expect(() => {
      soundEngine.playClick();
      soundEngine.playCorrect();
      soundEngine.playWrong();
      soundEngine.playCombo(3);
      soundEngine.playFlip();
      soundEngine.playVictory();
    }).not.toThrow();
  });
});

describe('Phase 6.0: Analytics & Weakness Bank (Smart Retry)', () => {
  it('creates dedicated retry exam from weakness items', () => {
    const mockWeaknesses: WeaknessItem[] = [
      {
        question: {
          id: 'w1',
          index: 5,
          text: 'Câu hỏi hay làm sai 1',
          options: ['A', 'B', 'C', 'D'],
          correctAnswer: [2],
          type: 'single',
        },
        examTitle: 'Đề Toán Đợt 1',
        examId: 'ex-1',
        userAnswers: [0],
        correctAnswers: [2],
        failCount: 3,
        lastFailedAt: Date.now(),
      },
      {
        question: {
          id: 'w2',
          index: 9,
          text: 'Câu hỏi hay làm sai 2',
          options: ['X', 'Y', 'Z', 'W'],
          correctAnswer: [1],
          type: 'single',
        },
        examTitle: 'Đề Toán Đợt 2',
        examId: 'ex-2',
        userAnswers: [3],
        correctAnswers: [1],
        failCount: 2,
        lastFailedAt: Date.now(),
      },
    ];

    const retryExam = analyticsDashboard.createRetryExamFromWeakness(mockWeaknesses);
    expect(retryExam).toBeDefined();
    expect(retryExam.title).toContain('Sổ Tay');
    expect(retryExam.questions.length).toBe(2);
    expect(retryExam.questions[0].index).toBe(1);
    expect(retryExam.questions[1].index).toBe(2);
    expect(retryExam.questions[0].text).toBe('Câu hỏi hay làm sai 1');
    expect(retryExam.durationMinutes).toBe(5); // 2 questions * 1.5 rounded up = 3, min 5 mins
  });
});
