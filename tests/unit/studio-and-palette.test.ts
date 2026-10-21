/**
 * @vitest-environment jsdom
 * tests/unit/studio-and-palette.test.ts - Phase 5.0 Unit Tests
 * Tests for Question Studio, Azota Quick Key Importer, 6-digit Room PINs, and Review Mode.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { questionStudio } from '../../src/features/editor/question-studio';
import { findSampleExamByPin, SAMPLE_PIN_MAP } from '../../src/shared/sample-banks';
import { examView } from '../../src/features/study-modes/exam/exam-view';
import type { Exam, ExamAttempt } from '../../src/shared/types';

describe('Phase 5.0: Question Studio & Azota Key Importer Unit Tests', () => {
  it('parses explicit answer key string: 1A 2B 3C 4D', () => {
    const input = '1A 2B 3C 4D 5A';
    const parsed = questionStudio.parseAnswerKeyString(input);
    expect(parsed[1]).toBe(0); // A -> 0
    expect(parsed[2]).toBe(1); // B -> 1
    expect(parsed[3]).toBe(2); // C -> 2
    expect(parsed[4]).toBe(3); // D -> 3
    expect(parsed[5]).toBe(0); // A -> 0
  });

  it('parses dotted format: 1.A 2.B 3.C', () => {
    const input = '1.A 2.B 3.C 4.D';
    const parsed = questionStudio.parseAnswerKeyString(input);
    expect(parsed[1]).toBe(0);
    expect(parsed[2]).toBe(1);
    expect(parsed[3]).toBe(2);
    expect(parsed[4]).toBe(3);
  });

  it('parses Vietnamese format: Câu 1: A, Câu 2: C', () => {
    const input = 'Câu 1: A, Câu 2: C, Câu 3: D';
    const parsed = questionStudio.parseAnswerKeyString(input);
    expect(parsed[1]).toBe(0);
    expect(parsed[2]).toBe(2);
    expect(parsed[3]).toBe(3);
  });

  it('parses continuous letter stream: ABCDABCD', () => {
    const input = 'ABCDABCD';
    const parsed = questionStudio.parseAnswerKeyString(input, 1);
    expect(parsed[1]).toBe(0); // A
    expect(parsed[2]).toBe(1); // B
    expect(parsed[3]).toBe(2); // C
    expect(parsed[4]).toBe(3); // D
    expect(parsed[5]).toBe(0); // A
    expect(parsed[6]).toBe(1); // B
    expect(parsed[7]).toBe(2); // C
    expect(parsed[8]).toBe(3); // D
  });

  it('creates valid default blank question with 4 options and single choice', () => {
    const q = questionStudio.createBlankQuestion(5);
    expect(q.text).toContain('Câu 5');
    expect(q.options.length).toBe(4);
    expect(q.type).toBe('single');
    expect(q.correctAnswer).toEqual([0]);
  });
});

describe('Phase 5.0: 6-Digit PIN Room Lookup Unit Tests', () => {
  it('correctly finds all 9 sample exams by their assigned 6-digit PIN', () => {
    for (const [subjKey, pin] of Object.entries(SAMPLE_PIN_MAP)) {
      const exam = findSampleExamByPin(pin);
      expect(exam).toBeDefined();
      expect(exam?.id).toContain(subjKey);
      expect(exam?.roomCode).toBe(pin);
    }
  });

  it('returns undefined for non-existent PIN', () => {
    const notFound = findSampleExamByPin('999999');
    expect(notFound).toBeUndefined();
  });
});

describe('Phase 5.0: ExamView Review Mode Unit Tests', () => {
  let sampleExam: Exam;

  beforeEach(() => {
    document.body.innerHTML = `
      <div id="exam-view-container"></div>
      <div id="palette-grid"></div>
    `;

    sampleExam = {
      id: 'test_exam',
      title: 'Bài thi thử nghiệm',
      subject: 'Toán',
      durationMinutes: 45,
      totalQuestions: 2,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      questions: [
        {
          id: 'q1',
          index: 0,
          text: '2 + 2 = ?',
          options: ['3', '4', '5'],
          correctAnswer: [1],
          type: 'single',
          explanation: 'Vì 2 + 2 = 4',
        },
        {
          id: 'q2',
          index: 1,
          text: 'Thủ đô của Việt Nam là gì?',
          options: ['Hà Nội', 'Huế', 'Đà Nẵng'],
          correctAnswer: [0],
          type: 'single',
          explanation: 'Hà Nội là thủ đô của Việt Nam.',
        },
      ],
    };
  });

  it('initializes in standard non-review mode', () => {
    examView.init(sampleExam, 'exam-view-container');
    expect(examView.isReview()).toBe(false);
  });

  it('renders review mode with correct and incorrect feedback badges', () => {
    const attempt: ExamAttempt = {
      id: 'att_123',
      examId: sampleExam.id,
      examTitle: sampleExam.title,
      mode: 'exam',
      startedAt: Date.now() - 30000,
      submittedAt: Date.now(),
      timeRemainingSeconds: 0,
      totalDurationSeconds: 45 * 60,
      answers: {
        0: [1], // Correct
        1: [2], // Wrong (selected Đà Nẵng instead of Hà Nội)
      },
      flaggedQuestions: [1],
      eliminatedOptions: {},
      violations: [],
      isCompleted: true,
      timeSpentPerQuestion: { 0: 15, 1: 15 },
    };

    examView.init(sampleExam, 'exam-view-container');
    examView.renderReviewMode(attempt, 'exam-view-container');

    expect(examView.isReview()).toBe(true);

    const container = document.getElementById('exam-view-container');
    expect(container?.innerHTML).toContain('✓ ĐÚNG');
    expect(container?.innerHTML).toContain('✗ SAI');
    expect(container?.innerHTML).toContain('Lời giải &amp; Giải thích chi tiết');
  });
});
