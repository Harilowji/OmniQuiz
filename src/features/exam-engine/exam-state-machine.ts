/**
 * src/features/exam-engine/exam-state-machine.ts - Exam State Machine & Auto-Save
 * Governs active exam state, timer ticks, auto-save to Dexie every 2s, and grading logic.
 */

import type { Exam, ExamAttempt, StudyMode, Question } from '../../shared/types';
import { localDB } from '../../shared/db/dexie-db';
import { supabaseSync } from '../../shared/db/supabase';

export type ExamState = 'idle' | 'running' | 'paused' | 'submitted' | 'disqualified';

export interface ExamStateCallbacks {
  onStateChange: (state: ExamState) => void;
  onTimerTick: (timeRemaining: number, isWarning: boolean) => void;
  onAnswerChange: (questionIndex: number, selectedOptions: number[]) => void;
  onAutoSaved: (timestamp: number) => void;
  onExamSubmitted: (attempt: ExamAttempt) => void;
}

export class ExamStateMachine {
  private state: ExamState = 'idle';
  private currentExam: Exam | null = null;
  private currentAttempt: ExamAttempt | null = null;
  private callbacks: ExamStateCallbacks | null = null;

  private timerInterval: number = 0;
  private autoSaveInterval: number = 0;
  private questionStartTime: number = Date.now();
  private currentQuestionIndex: number = -1;

  constructor() {}

  public getState(): ExamState {
    return this.state;
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
    this.state = 'idle';
    this.currentExam = null;
    this.currentAttempt = null;
    this.currentQuestionIndex = -1;
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

    this.state = 'running';
    this.callbacks.onStateChange(this.state);

    this.startTimer();
    this.startAutoSave();
  }

  /**
   * Select or toggle answer option for a question
   */
  public selectAnswer(questionIndex: number, optionIndex: number): void {
    if (this.state !== 'running' || !this.currentAttempt || !this.currentExam) return;

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
   * Pause exam (e.g. during proctoring warning)
   */
  public pause(): void {
    if (this.state === 'running') {
      this.state = 'paused';
      this.recordTimeSpent(this.currentQuestionIndex);
      window.clearInterval(this.timerInterval);
      this.callbacks?.onStateChange(this.state);
    }
  }

  /**
   * Resume exam
   */
  public resume(): void {
    if (this.state === 'paused') {
      this.state = 'running';
      this.questionStartTime = Date.now();
      this.startTimer();
      this.callbacks?.onStateChange(this.state);
    }
  }

  /**
   * Disqualify candidate due to excessive violations
   */
  public disqualify(): void {
    this.state = 'disqualified';
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

    this.state = 'submitted';
    this.calculateFinalGrading();

    // Persist final attempt to Dexie & Cloud
    await localDB.saveAttempt(this.currentAttempt);
    await supabaseSync.syncAttemptToCloud(this.currentAttempt);

    this.callbacks?.onStateChange(this.state);
    this.callbacks?.onExamSubmitted(this.currentAttempt);

    return this.currentAttempt;
  }

  private startTimer(): void {
    window.clearInterval(this.timerInterval);
    this.timerInterval = window.setInterval(() => {
      if (!this.currentAttempt) return;

      this.currentAttempt.timeRemainingSeconds = Math.max(0, this.currentAttempt.timeRemainingSeconds - 1);
      const isWarning = this.currentAttempt.timeRemainingSeconds <= 300; // < 5 mins warning

      this.callbacks?.onTimerTick(this.currentAttempt.timeRemainingSeconds, isWarning);

      if (this.currentAttempt.timeRemainingSeconds <= 0) {
        this.submit();
      }
    }, 1000);
  }

  private startAutoSave(): void {
    window.clearInterval(this.autoSaveInterval);
    this.autoSaveInterval = window.setInterval(() => {
      this.saveToDexie();
    }, 2000); // 2-second crash-recovery checkpoint
  }

  private async saveToDexie(): Promise<void> {
    if (!this.currentAttempt || !this.currentExam || this.state === 'submitted') return;
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
    window.clearInterval(this.timerInterval);
    window.clearInterval(this.autoSaveInterval);
  }
}

export const examStateMachine = new ExamStateMachine();
