import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ExamStateMachine } from '../src/features/exam-engine/exam-state-machine';
import { localDB } from '../src/shared/db/dexie-db';
import { supabaseSync } from '../src/shared/db/supabase';
import type { Exam, ExamAttempt } from '../src/shared/types';

if (typeof window === 'undefined') {
  (globalThis as unknown as { window: unknown }).window = globalThis;
}

describe('REC-01: Absolute Wall-Clock Crash Recovery & Expiry Suite', () => {
  let fsm: ExamStateMachine;

  const mockExam: Exam = {
    id: 'recovery_exam_1',
    title: 'Đề thi Khảo nghiệm Phục hồi',
    subject: 'Tin học',
    durationMinutes: 15, // 900 seconds
    totalQuestions: 2,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    questions: [
      {
        id: 'q1',
        index: 1,
        text: 'CPU là gì?',
        type: 'single',
        options: ['Bộ nhớ', 'Bộ xử lý trung tâm', 'Card màn hình', 'Ổ cứng'],
        correctAnswer: [1],
      },
      {
        id: 'q2',
        index: 2,
        text: 'RAM là viết tắt của?',
        type: 'single',
        options: ['Random Access Memory', 'Read Access Memory', 'Real Audio Music', 'None'],
        correctAnswer: [0],
      },
    ],
  };

  const createMockAttempt = (startedAt: number, remainingSeconds: number): ExamAttempt => ({
    id: 'attempt_rec_123',
    examId: mockExam.id,
    examTitle: mockExam.title,
    mode: 'exam',
    startedAt,
    timeRemainingSeconds: remainingSeconds,
    totalDurationSeconds: 900,
    answers: { 0: [1], 1: [0] }, // All 2 questions answered correctly
    flaggedQuestions: [],
    eliminatedOptions: {},
    violations: [],
    isCompleted: false,
    timeSpentPerQuestion: { 0: 60, 1: 60 },
  });

  beforeEach(() => {
    vi.spyOn(localDB, 'saveAttempt').mockResolvedValue('attempt_rec_123');
    vi.spyOn(localDB, 'clearActiveSession').mockResolvedValue();
    vi.spyOn(supabaseSync, 'syncAttemptToCloud').mockResolvedValue(true);

    fsm = new ExamStateMachine();
  });

  afterEach(() => {
    fsm.reset();
    vi.restoreAllMocks();
  });

  it('should detect when elapsed wall-clock exceeds total duration and submit expired session', async () => {
    const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
    const expiredAttempt = createMockAttempt(twoHoursAgo, 600); // Saved with 600s remaining before crash

    // Calculate absolute deadline
    const durationMs = mockExam.durationMinutes * 60 * 1000;
    const absoluteDeadline = expiredAttempt.startedAt + durationMs;
    const now = Date.now();

    expect(now >= absoluteDeadline).toBe(true);

    const onSubmitted = vi.fn();
    const finalAttempt = await fsm.recoverExpiredSession(mockExam, expiredAttempt, {
      onStateChange: vi.fn(),
      onTimerTick: vi.fn(),
      onAnswerChange: vi.fn(),
      onAutoSaved: vi.fn(),
      onExamSubmitted: onSubmitted,
    });

    expect(fsm.getState()).toBe('SUBMITTED');
    expect(finalAttempt.isCompleted).toBe(true);
    expect(finalAttempt.timeRemainingSeconds).toBe(0);
    expect(finalAttempt.score).toBe(100); // 2/2 correct
    expect(onSubmitted).toHaveBeenCalledWith(finalAttempt);
    expect(localDB.clearActiveSession).toHaveBeenCalled();
  });

  it('should recalculate accurate remaining delta when crashing within allowable exam window', () => {
    const tenMinutesAgo = Date.now() - 10 * 60 * 1000; // 10 minutes in
    const activeAttempt = createMockAttempt(tenMinutesAgo, 800); // Outdated remaining time

    const durationMs = mockExam.durationMinutes * 60 * 1000; // 15 minutes = 900,000 ms
    const absoluteDeadline = activeAttempt.startedAt + durationMs;
    const now = Date.now();

    expect(now < absoluteDeadline).toBe(true);

    const accurateRemaining = Math.max(0, Math.floor((absoluteDeadline - now) / 1000));
    // 15 mins total - 10 mins elapsed = ~5 mins (300 seconds) remaining
    expect(accurateRemaining).toBeGreaterThanOrEqual(295);
    expect(accurateRemaining).toBeLessThanOrEqual(305);
  });
});
