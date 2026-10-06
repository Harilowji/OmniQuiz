import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ExamStateMachine } from '../../src/features/exam-engine/exam-state-machine';
import { analyticsService } from '../../src/features/analytics/analytics-service';
import { localDB } from '../../src/shared/db/dexie-db';
import { supabaseSync } from '../../src/shared/db/supabase';
import { getSampleExamByKey } from '../../src/shared/sample-banks';

if (typeof window === 'undefined') {
  (globalThis as unknown as { window: unknown }).window = globalThis;
}

describe('Integration Test: End-to-End Exam Flow & Analytics Pipeline', () => {
  let fsm: ExamStateMachine;

  beforeEach(() => {
    vi.spyOn(localDB, 'saveActiveSession').mockResolvedValue(undefined as unknown as string);
    vi.spyOn(localDB, 'saveAttempt').mockResolvedValue('attempt_123');
    vi.spyOn(supabaseSync, 'syncAttemptToCloud').mockResolvedValue(true);
    fsm = new ExamStateMachine();
  });

  afterEach(() => {
    fsm.reset();
    vi.restoreAllMocks();
  });

  it('should execute full CBT exam lifecycle with 100% accurate grading and analytics', async () => {
    // 1. Load standardized fixture: chem_12 (5 questions)
    const exam = getSampleExamByKey('chem_12');
    expect(exam).toBeDefined();
    expect(exam!.questions).toHaveLength(5);

    // 2. Start exam session
    const onStateChange = vi.fn();
    const onExamSubmitted = vi.fn();
    await fsm.startSession(exam!, 'exam', {
      onStateChange,
      onTimerTick: vi.fn(),
      onAnswerChange: vi.fn(),
      onAutoSaved: vi.fn(),
      onExamSubmitted,
    });

    expect(fsm.isRunning()).toBe(true);

    // 3. Simulate answering:
    // Answer Q1 correctly: option B (index 1)
    fsm.setCurrentQuestionIndex(0);
    fsm.selectAnswer(0, 1);

    // Answer Q2 correctly: option A (index 0)
    fsm.setCurrentQuestionIndex(1);
    fsm.selectAnswer(1, 0);

    // Answer Q3 correctly: option A (index 0)
    fsm.setCurrentQuestionIndex(2);
    fsm.selectAnswer(2, 0);

    // Answer Q4 incorrectly: user picks C (index 2), correct is B (index 1)
    fsm.setCurrentQuestionIndex(3);
    fsm.selectAnswer(3, 2);

    // Q5 unanswered

    // 4. Submit exam
    const attempt = await fsm.submit();
    expect(attempt).not.toBeNull();
    expect(fsm.isSubmitted()).toBe(true);
    expect(attempt?.isCompleted).toBe(true);

    // 3 correct out of 5 questions = 60%
    expect(attempt?.accuracy).toBe(60);
    expect(attempt?.score).toBe(60);

    // 5. Generate comprehensive post-exam analytics report
    const report = analyticsService.generateReport(exam!, attempt!);
    expect(report).toBeDefined();
    expect(report.totalQuestions).toBe(5);
    expect(report.correctCount).toBe(3);
    expect(report.wrongCount).toBe(1);
    expect(report.unansweredCount).toBe(1);
    expect(report.scorePercentage).toBe(60);

    // Verify Subject Mastery Radar
    expect(report.subjectRadar.length).toBeGreaterThan(0);
    const chemMastery = report.subjectRadar.find((r) => r.subject.includes('Hóa'));
    expect(chemMastery).toBeDefined();
    expect(chemMastery?.correct).toBe(3);
    expect(chemMastery?.total).toBe(5);
    expect(chemMastery?.masteryPercentage).toBe(60);

    // Verify Time Distribution Analysis items
    expect(report.timeDistribution).toHaveLength(5);
    expect(report.timeDistribution[0]?.isCorrect).toBe(true);
    expect(report.timeDistribution[3]?.isCorrect).toBe(false);
    expect(report.timeDistribution[4]?.isCorrect).toBe(false);
  });
});
