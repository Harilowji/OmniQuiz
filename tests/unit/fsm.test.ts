import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ExamStateMachine } from '../../src/features/exam-engine/exam-state-machine';
import { localDB } from '../../src/shared/db/dexie-db';
import { supabaseSync } from '../../src/shared/db/supabase';
import type { Exam } from '../../src/shared/types';

// Mock window globals if running in Node environment
if (typeof window === 'undefined') {
  (globalThis as unknown as { window: unknown }).window = globalThis;
}

describe('Exam State Machine & FSM Transition Engine', () => {
  let fsm: ExamStateMachine;

  const mockExam: Exam = {
    id: 'test_exam_1',
    title: 'Đề thi Thử nghiệm FSM',
    subject: 'Toán học',
    durationMinutes: 10,
    totalQuestions: 2,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    questions: [
      {
        id: 'q1',
        index: 1,
        text: '1 + 1 bằng mấy?',
        type: 'single',
        options: ['1', '2', '3', '4'],
        correctAnswer: [1], // Index 1 is '2'
      },
      {
        id: 'q2',
        index: 2,
        text: 'Chọn các số chẵn:',
        type: 'multiple',
        options: ['2', '3', '4', '5'],
        correctAnswer: [0, 2], // '2' and '4'
      },
    ],
  };

  beforeEach(() => {
    vi.spyOn(localDB, 'saveActiveSession').mockResolvedValue(undefined as unknown as string);
    vi.spyOn(localDB, 'saveAttempt').mockResolvedValue('attempt_id');
    vi.spyOn(supabaseSync, 'syncAttemptToCloud').mockResolvedValue(true);

    fsm = new ExamStateMachine();
  });

  afterEach(() => {
    fsm.reset();
    vi.restoreAllMocks();
  });

  it('should initialize strictly in IDLE state', () => {
    expect(fsm.getState()).toBe('IDLE');
    expect(fsm.isIdle()).toBe(true);
    expect(fsm.getAttempt()).toBeNull();
    expect(fsm.getExam()).toBeNull();
  });

  it('should transition to CONFIGURING on configure call', () => {
    fsm.configure(mockExam);
    expect(fsm.getState()).toBe('CONFIGURING');
    expect(fsm.isConfiguring()).toBe(true);
  });

  it('should transition to RUNNING upon starting session and initialize attempt', async () => {
    const onStateChange = vi.fn();
    await fsm.startSession(mockExam, 'exam', {
      onStateChange,
      onTimerTick: vi.fn(),
      onAnswerChange: vi.fn(),
      onAutoSaved: vi.fn(),
      onExamSubmitted: vi.fn(),
    });

    expect(fsm.getState()).toBe('RUNNING');
    expect(fsm.isRunning()).toBe(true);
    expect(onStateChange).toHaveBeenCalledWith('RUNNING');

    const attempt = fsm.getAttempt();
    expect(attempt).not.toBeNull();
    expect(attempt?.examId).toBe('test_exam_1');
    expect(attempt?.timeRemainingSeconds).toBe(600); // 10 minutes * 60s
  });

  it('should properly record single-choice and multiple-choice answers', async () => {
    const onAnswerChange = vi.fn();
    await fsm.startSession(mockExam, 'exam', {
      onStateChange: vi.fn(),
      onTimerTick: vi.fn(),
      onAnswerChange,
      onAutoSaved: vi.fn(),
      onExamSubmitted: vi.fn(),
    });

    // Single choice selection (Q1 -> Option 1)
    fsm.selectAnswer(0, 1);
    expect(fsm.getAttempt()?.answers[0]).toEqual([1]);
    expect(onAnswerChange).toHaveBeenCalledWith(0, [1]);

    // Multiple choice toggle (Q2 -> Option 0 then Option 2)
    fsm.selectAnswer(1, 0);
    expect(fsm.getAttempt()?.answers[1]).toEqual([0]);

    fsm.selectAnswer(1, 2);
    expect(fsm.getAttempt()?.answers[1]).toEqual([0, 2]);

    // Untoggle Option 0
    fsm.selectAnswer(1, 0);
    expect(fsm.getAttempt()?.answers[1]).toEqual([2]);
  });

  it('should toggle question bookmark flags and option elimination', async () => {
    await fsm.startSession(mockExam, 'practice', {
      onStateChange: vi.fn(),
      onTimerTick: vi.fn(),
      onAnswerChange: vi.fn(),
      onAutoSaved: vi.fn(),
      onExamSubmitted: vi.fn(),
    });

    // Toggle Flag
    const isFlagged = fsm.toggleFlag(0);
    expect(isFlagged).toBe(true);
    expect(fsm.getAttempt()?.flaggedQuestions).toContain(0);

    const isUnflagged = fsm.toggleFlag(0);
    expect(isUnflagged).toBe(false);
    expect(fsm.getAttempt()?.flaggedQuestions).not.toContain(0);

    // Toggle Elimination
    const isEliminated = fsm.toggleEliminateOption(0, 3);
    expect(isEliminated).toBe(true);
    expect(fsm.getAttempt()?.eliminatedOptions[0]).toContain(3);
  });

  it('should handle pause for normal pause vs proctoring violation', async () => {
    await fsm.startSession(mockExam, 'exam', {
      onStateChange: vi.fn(),
      onTimerTick: vi.fn(),
      onAnswerChange: vi.fn(),
      onAutoSaved: vi.fn(),
      onExamSubmitted: vi.fn(),
    });

    // Normal pause
    fsm.pause(false);
    expect(fsm.getState()).toBe('PAUSED');
    expect(fsm.isPaused()).toBe(true);

    fsm.resume();
    expect(fsm.getState()).toBe('RUNNING');

    // Proctoring violation pause
    fsm.pause(true);
    expect(fsm.getState()).toBe('PAUSED_VIOLATION');
    expect(fsm.isPaused()).toBe(true);

    fsm.resume();
    expect(fsm.getState()).toBe('RUNNING');
  });

  it('should evaluate 100% correct answers and grade accurately upon submission', async () => {
    const onExamSubmitted = vi.fn();
    await fsm.startSession(mockExam, 'exam', {
      onStateChange: vi.fn(),
      onTimerTick: vi.fn(),
      onAnswerChange: vi.fn(),
      onAutoSaved: vi.fn(),
      onExamSubmitted,
    });

    // Answer Q1 correctly (index 1: '2')
    fsm.selectAnswer(0, 1);
    // Answer Q2 correctly (indices 0 and 2: '2' and '4')
    fsm.selectAnswer(1, 0);
    fsm.selectAnswer(1, 2);

    const finalAttempt = await fsm.submit();
    expect(fsm.getState()).toBe('SUBMITTED');
    expect(fsm.isSubmitted()).toBe(true);
    expect(finalAttempt?.isCompleted).toBe(true);
    expect(finalAttempt?.score).toBe(100);
    expect(finalAttempt?.accuracy).toBe(100);
    expect(onExamSubmitted).toHaveBeenCalledWith(finalAttempt);
  });

  it('should transition to DISQUALIFIED on proctoring 3-tier violation lockout', async () => {
    const onExamSubmitted = vi.fn();
    await fsm.startSession(mockExam, 'exam', {
      onStateChange: vi.fn(),
      onTimerTick: vi.fn(),
      onAnswerChange: vi.fn(),
      onAutoSaved: vi.fn(),
      onExamSubmitted,
    });

    fsm.disqualify();
    expect(fsm.getState()).toBe('DISQUALIFIED');
    expect(fsm.isDisqualified()).toBe(true);
    expect(fsm.getAttempt()?.isCompleted).toBe(true);
  });
});
