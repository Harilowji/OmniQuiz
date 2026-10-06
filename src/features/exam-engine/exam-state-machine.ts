/**
 * src/features/exam-engine/exam-state-machine.ts - Exam State Machine & Auto-Save
 * Governs active exam state, timer ticks, auto-save to Dexie every 2s, and grading logic.
 */

import type { Exam, ExamAttempt, StudyMode, Question } from '../../shared/types';
import { localDB } from '../../shared/db/dexie-db';
import { supabaseSync } from '../../shared/db/supabase';

export type ExamState =
  | 'IDLE'
  | 'CONFIGURING'
  | 'RUNNING'
  | 'PAUSED'
  | 'PAUSED_VIOLATION'
  | 'SUBMITTED'
  | 'DISQUALIFIED'
  | 'idle'
  | 'configuring'
  | 'running'
  | 'paused'
  | 'paused_violation'
  | 'submitted'
  | 'disqualified';

export interface ExamStateCallbacks {
  onStateChange: (state: ExamState) => void;
  onTimerTick: (timeRemaining: number, isWarning: boolean) => void;
  onAnswerChange: (questionIndex: number, selectedOptions: number[]) => void;
  onAutoSaved: (timestamp: number) => void;
  onExamSubmitted: (attempt: ExamAttempt) => void;
}

export class ExamStateMachine {
  private state: ExamState = 'IDLE';
  private currentExam: Exam | null = null;
  private currentAttempt: ExamAttempt | null = null;
  private callbacks: ExamStateCallbacks | null = null;

  private timerInterval: ReturnType<typeof setInterval> | number = 0;
  private autoSaveInterval: ReturnType<typeof setInterval> | number = 0;
  private questionStartTime: number = Date.now();
  private currentQuestionIndex: number = -1;
  private targetEndWallTime: number = 0;
  private lastReportedSeconds: number = -1;

  constructor() {}

  public getState(): ExamState {
    return this.state;
  }

  public isIdle(): boolean {
    return this.state === 'IDLE' || this.state === 'idle';
  }

  public isConfiguring(): boolean {
    return this.state === 'CONFIGURING' || this.state === 'configuring';
  }

  public isRunning(): boolean {
    return this.state === 'RUNNING' || this.state === 'running';
  }

  public isPaused(): boolean {
    return (
      this.state === 'PAUSED' ||
      this.state === 'paused' ||
      this.state === 'PAUSED_VIOLATION' ||
      this.state === 'paused_violation'
    );
  }

  public isSubmitted(): boolean {
    return this.state === 'SUBMITTED' || this.state === 'submitted';
  }

  public isDisqualified(): boolean {
    return this.state === 'DISQUALIFIED' || this.state === 'disqualified';
  }

  public getAttempt(): ExamAttempt | null {
    return this.currentAttempt ? { ...this.currentAttempt } : null;
  }

  public getExam(): Exam | null {
    return this.currentExam;
  }

  /**
   * Reset state machine to idle / unloaded state
   */
  public reset(): void {
    this.stopIntervals();
    this.state = 'IDLE';
    this.currentExam = null;
    this.currentAttempt = null;
    this.currentQuestionIndex = -1;
    this.targetEndWallTime = 0;
    this.lastReportedSeconds = -1;
    this.callbacks?.onStateChange(this.state);
  }

  /**
   * Transition to configuring state
   */
  public configure(exam: Exam): void {
    this.currentExam = exam;
    this.state = 'CONFIGURING';
    this.callbacks?.onStateChange(this.state);
  }

  /**
   * Start a new or recovered exam session
   */
  public async startSession(
    exam: Exam,
    mode: StudyMode,
    callbacks: ExamStateCallbacks,
    recoveredAttempt?: ExamAttempt
  ): Promise<void> {
    this.stopIntervals();

    this.currentExam = exam;
    this.callbacks = callbacks;
    this.currentQuestionIndex = 0;
    this.questionStartTime = Date.now();

    const durationSeconds = exam.durationMinutes * 60;

    if (recoveredAttempt && !recoveredAttempt.isCompleted) {
      this.currentAttempt = recoveredAttempt;
    } else {
      this.currentAttempt = {
        id: `attempt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        examId: exam.id,
        examTitle: exam.title,
        mode,
        startedAt: Date.now(),
        timeRemainingSeconds: durationSeconds,
        totalDurationSeconds: durationSeconds,
        answers: {},
        flaggedQuestions: [],
        eliminatedOptions: {},
        violations: [],
        isCompleted: false,
        timeSpentPerQuestion: {},
      };
    }

    this.state = 'RUNNING';
    this.callbacks.onStateChange(this.state);

    this.startTimer();
    this.startAutoSave();
  }

  /**
   * Select or toggle answer option for a question
   */
  public selectAnswer(questionIndex: number, optionIndex: number): void {
    if (!this.isRunning() || !this.currentAttempt || !this.currentExam) return;

    const question = this.currentExam.questions[questionIndex];
    if (!question) return;

    const currentAnswers = this.currentAttempt.answers[questionIndex] || [];

    let newAnswers: number[];
    if (question.type === 'multiple') {
      if (currentAnswers.includes(optionIndex)) {
        newAnswers = currentAnswers.filter((idx) => idx !== optionIndex);
      } else {
        newAnswers = [...currentAnswers, optionIndex].sort();
      }
    } else {
      // Single choice
      newAnswers = [optionIndex];
    }

    this.currentAttempt.answers[questionIndex] = newAnswers;
    this.recordTimeSpent(questionIndex);

    this.callbacks?.onAnswerChange(questionIndex, newAnswers);
    this.saveToDexie();
  }

  /**
   * Toggle question flagged bookmark
   */
  public toggleFlag(questionIndex: number): boolean {
    if (!this.currentAttempt) return false;
    const flags = this.currentAttempt.flaggedQuestions;
    const exists = flags.includes(questionIndex);

    if (exists) {
      this.currentAttempt.flaggedQuestions = flags.filter((i) => i !== questionIndex);
    } else {
      this.currentAttempt.flaggedQuestions = [...flags, questionIndex];
    }

    this.saveToDexie();
    return !exists;
  }

  /**
   * Toggle elimination of an option (Practice Mode Strikethrough Tool)
   */
  public toggleEliminateOption(questionIndex: number, optionIndex: number): boolean {
    if (!this.currentAttempt) return false;
    const eliminated = this.currentAttempt.eliminatedOptions[questionIndex] || [];
    const isEliminated = eliminated.includes(optionIndex);

    let updated: number[];
    if (isEliminated) {
      updated = eliminated.filter((i) => i !== optionIndex);
    } else {
      updated = [...eliminated, optionIndex];
    }

    this.currentAttempt.eliminatedOptions[questionIndex] = updated;
    this.saveToDexie();
    return !isEliminated;
  }

  /**
   * Switch current viewing question (tracks time spent)
   */
  public setCurrentQuestionIndex(newIndex: number): void {
    if (this.currentQuestionIndex !== newIndex) {
      this.recordTimeSpent(this.currentQuestionIndex);
      this.currentQuestionIndex = newIndex;
      this.questionStartTime = Date.now();
    }
  }

  /**
   * Pause exam (optionally for proctoring violation)
   */
  public pause(isViolation = false): void {
    if (this.isRunning()) {
      this.state = isViolation ? 'PAUSED_VIOLATION' : 'PAUSED';
      this.recordTimeSpent(this.currentQuestionIndex);
      clearInterval(this.timerInterval);
      if (this.currentAttempt && this.targetEndWallTime > 0) {
        const remainingMs = Math.max(0, this.targetEndWallTime - Date.now());
        this.currentAttempt.timeRemainingSeconds = Math.ceil(remainingMs / 1000);
      }
      this.callbacks?.onStateChange(this.state);
    }
  }

  /**
   * Resume exam
   */
  public resume(): void {
    if (this.isPaused()) {
      this.state = 'RUNNING';
      this.questionStartTime = Date.now();
      this.startTimer();
      this.callbacks?.onStateChange(this.state);
    }
  }

  /**
   * Disqualify candidate due to excessive violations
   */
  public disqualify(): void {
    this.state = 'DISQUALIFIED';
    this.stopIntervals();
    this.calculateFinalGrading();
    this.callbacks?.onStateChange(this.state);
    if (this.currentAttempt) {
      this.callbacks?.onExamSubmitted(this.currentAttempt);
    }
  }

  /**
   * Submit exam legitimately
   */
  public async submit(): Promise<ExamAttempt | null> {
    if (!this.currentAttempt || !this.currentExam) return null;
    this.stopIntervals();
    this.recordTimeSpent(this.currentQuestionIndex);

    this.state = 'SUBMITTED';
    this.calculateFinalGrading();

    // Persist final attempt to Dexie & Cloud
    await localDB.saveAttempt(this.currentAttempt);
    await supabaseSync.syncAttemptToCloud(this.currentAttempt);

    this.callbacks?.onStateChange(this.state);
    this.callbacks?.onExamSubmitted(this.currentAttempt);

    return this.currentAttempt;
  }

  /**
   * Automatically grades and submits an expired session recovered from Dexie checkpoint.
   */
  public async recoverExpiredSession(
    exam: Exam,
    attempt: ExamAttempt,
    callbacks?: ExamStateCallbacks
  ): Promise<ExamAttempt> {
    this.stopIntervals();
    this.currentExam = exam;
    this.currentAttempt = attempt;
    if (callbacks) {
      this.callbacks = callbacks;
    }

    this.currentAttempt.timeRemainingSeconds = 0;
    this.state = 'SUBMITTED';
    this.calculateFinalGrading();

    // Persist final attempt to Dexie & Cloud
    await localDB.saveAttempt(this.currentAttempt);
    await supabaseSync.syncAttemptToCloud(this.currentAttempt);
    await localDB.clearActiveSession();

    this.callbacks?.onStateChange(this.state);
    this.callbacks?.onExamSubmitted(this.currentAttempt);

    return this.currentAttempt;
  }

  private startTimer(): void {
    clearInterval(this.timerInterval);
    if (!this.currentAttempt) return;

    this.targetEndWallTime = Date.now() + this.currentAttempt.timeRemainingSeconds * 1000;
    this.lastReportedSeconds = this.currentAttempt.timeRemainingSeconds;

    // Fast polling (250ms) using Delta wall-clock calculation to prevent timer drift
    this.timerInterval = setInterval(() => {
      if (!this.currentAttempt) return;

      const now = Date.now();
      const remainingMs = Math.max(0, this.targetEndWallTime - now);
      const remainingSeconds = Math.ceil(remainingMs / 1000);

      this.currentAttempt.timeRemainingSeconds = remainingSeconds;

      if (remainingSeconds !== this.lastReportedSeconds) {
        this.lastReportedSeconds = remainingSeconds;
        const isWarning = remainingSeconds <= 300; // < 5 mins warning
        this.callbacks?.onTimerTick(remainingSeconds, isWarning);
      }

      if (now >= this.targetEndWallTime || remainingSeconds <= 0) {
        this.stopIntervals();
        this.submit();
      }
    }, 250);
  }

  private startAutoSave(): void {
    clearInterval(this.autoSaveInterval);
    this.autoSaveInterval = setInterval(() => {
      this.saveToDexie();
    }, 2000); // 2-second crash-recovery checkpoint
  }

  private async saveToDexie(): Promise<void> {
    if (!this.currentAttempt || !this.currentExam || this.isSubmitted()) return;
    try {
      await localDB.saveActiveSession(this.currentAttempt, this.currentExam);
      this.callbacks?.onAutoSaved(Date.now());
    } catch (err) {
      console.warn('[Auto-Save Checkpoint Warning]:', err);
    }
  }

  private recordTimeSpent(qIndex: number): void {
    if (!this.currentAttempt) return;
    const elapsedSeconds = Math.round((Date.now() - this.questionStartTime) / 1000);
    const prev = this.currentAttempt.timeSpentPerQuestion[qIndex] || 0;
    this.currentAttempt.timeSpentPerQuestion[qIndex] = prev + Math.max(0, elapsedSeconds);
  }

  private calculateFinalGrading(): void {
    if (!this.currentAttempt || !this.currentExam) return;

    let correctCount = 0;
    const totalQ = this.currentExam.questions.length;

    this.currentExam.questions.forEach((q: Question, idx: number) => {
      const userAnswers = this.currentAttempt!.answers[idx] || [];
      const correctAnswers = q.correctAnswer;

      const isMatch =
        userAnswers.length === correctAnswers.length &&
        userAnswers.every((ans) => correctAnswers.includes(ans));

      if (isMatch) correctCount++;
    });

    const accuracy = totalQ > 0 ? Math.round((correctCount / totalQ) * 100) : 0;
    const score = totalQ > 0 ? Math.round((correctCount / totalQ) * 100) : 0;

    this.currentAttempt.isCompleted = true;
    this.currentAttempt.submittedAt = Date.now();
    this.currentAttempt.score = score;
    this.currentAttempt.totalScore = 100;
    this.currentAttempt.accuracy = accuracy;
  }

  private stopIntervals(): void {
    clearInterval(this.timerInterval);
    clearInterval(this.autoSaveInterval);
  }
}

export const examStateMachine = new ExamStateMachine();
