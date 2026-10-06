import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ExamStateMachine } from '../src/features/exam-engine/exam-state-machine';
import { localDB } from '../src/shared/db/dexie-db';
import { supabaseSync } from '../src/shared/db/supabase';
import type { Exam } from '../src/shared/types';

if (typeof window === 'undefined') {
  (globalThis as unknown as { window: unknown }).window = globalThis;
}

describe('PROC-01: Delta Wall-Clock Timer & Anti-Drift Engine', () => {
  let fsm: ExamStateMachine;

  const mockExam: Exam = {
    id: 'timer_exam_1',
    title: 'Đề thi Kiểm tra Delta Timer',
    subject: 'Toán học',
    durationMinutes: 10, // 600 seconds
    totalQuestions: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    questions: [
      {
        id: 'q1',
        index: 1,
        text: '1 + 1 = ?',
        type: 'single',
        options: ['1', '2', '3', '4'],
        correctAnswer: [1],
      },
    ],
  };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(localDB, 'saveActiveSession').mockResolvedValue(undefined as unknown as string);
    vi.spyOn(localDB, 'saveAttempt').mockResolvedValue('attempt_1');
    vi.spyOn(supabaseSync, 'syncAttemptToCloud').mockResolvedValue(true);

    fsm = new ExamStateMachine();
  });

  afterEach(() => {
    fsm.reset();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('should initialize timer with accurate total seconds from exam duration', async () => {
    await fsm.startSession(mockExam, 'exam', {
      onStateChange: vi.fn(),
      onTimerTick: vi.fn(),
      onAnswerChange: vi.fn(),
      onAutoSaved: vi.fn(),
      onExamSubmitted: vi.fn(),
    });

    const attempt = fsm.getAttempt();
    expect(attempt).not.toBeNull();
    expect(attempt?.timeRemainingSeconds).toBe(600);
    expect(attempt?.totalDurationSeconds).toBe(600);
  });

  it('should accurately calculate delta when browser tab is throttled for 30 seconds', async () => {
    const tickCallback = vi.fn();

    await fsm.startSession(mockExam, 'exam', {
      onStateChange: vi.fn(),
      onTimerTick: tickCallback,
      onAnswerChange: vi.fn(),
      onAutoSaved: vi.fn(),
      onExamSubmitted: vi.fn(),
    });

    // Simulate tab background throttle: jump time forward by 30 seconds
    vi.advanceTimersByTime(30000);

    const attempt = fsm.getAttempt();
    expect(attempt?.timeRemainingSeconds).toBe(570);
    expect(tickCallback).toHaveBeenCalledWith(570, false);
  });

  it('should automatically submit exam when wall-clock target is reached or passed', async () => {
    const submitCallback = vi.fn();
    const stateCallback = vi.fn();

    await fsm.startSession(mockExam, 'exam', {
      onStateChange: stateCallback,
      onTimerTick: vi.fn(),
      onAnswerChange: vi.fn(),
      onAutoSaved: vi.fn(),
      onExamSubmitted: submitCallback,
    });

    // Fast-forward past the entire duration (600s + 1s) and flush async promises
    await vi.advanceTimersByTimeAsync(601000);

    expect(fsm.getState()).toBe('SUBMITTED');
    expect(fsm.isSubmitted()).toBe(true);
    expect(submitCallback).toHaveBeenCalled();
  });

  it('should preserve remaining time when paused and resume from accurate delta', async () => {
    await fsm.startSession(mockExam, 'exam', {
      onStateChange: vi.fn(),
      onTimerTick: vi.fn(),
      onAnswerChange: vi.fn(),
      onAutoSaved: vi.fn(),
      onExamSubmitted: vi.fn(),
    });

    // Run for 10 seconds
    vi.advanceTimersByTime(10000);
    expect(fsm.getAttempt()?.timeRemainingSeconds).toBe(590);

    // Pause exam (e.g. for violation or proctor review)
    fsm.pause();
    expect(fsm.isPaused()).toBe(true);

    // Advance 5 minutes while paused: time remaining should not decay
    vi.advanceTimersByTime(300000);
    expect(fsm.getAttempt()?.timeRemainingSeconds).toBe(590);

    // Resume exam
    fsm.resume();
    expect(fsm.isRunning()).toBe(true);

    // Advance 5 seconds after resume
    vi.advanceTimersByTime(5000);
    expect(fsm.getAttempt()?.timeRemainingSeconds).toBe(585);
  });
});
