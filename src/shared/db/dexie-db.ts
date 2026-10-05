/**
 * src/shared/db/dexie-db.ts - Local-First IndexedDB Database via Dexie.js
 * Handles Local Storage, Crash Recovery, Auto-Save every 2s, and Offline State.
 */

import Dexie, { type Table } from 'dexie';
import type { Exam, ExamAttempt, FlashcardItem, UserProfile } from '../types';

export interface ActiveSessionRecord {
  id: string; // key: 'current_active_session'
  attempt: ExamAttempt;
  exam: Exam;
  savedAt: number;
}

export class OmniQuizDatabase extends Dexie {
  exams!: Table<Exam, string>;
  attempts!: Table<ExamAttempt, string>;
  flashcards!: Table<FlashcardItem, string>;
  activeSession!: Table<ActiveSessionRecord, string>;
  profiles!: Table<UserProfile, string>;

  constructor() {
    super('OmniQuizPro_DB');

    this.version(1).stores({
      exams: 'id, title, subject, createdAt, updatedAt',
      attempts: 'id, examId, mode, startedAt, submittedAt, isCompleted',
      flashcards: 'id, questionId, dueDate, interval, easeFactor',
      activeSession: 'id, savedAt',
      profiles: 'id, email, role',
    });
  }

  /**
   * Save or update an exam locally
   */
  async saveExam(exam: Exam): Promise<string> {
    await this.exams.put(exam);
    return exam.id;
  }

  /**
   * Get all exams ordered by update date
   */
  async getAllExams(): Promise<Exam[]> {
    return this.exams.orderBy('updatedAt').reverse().toArray();
  }

  /**
   * Get single exam by ID
   */
  async getExamById(id: string): Promise<Exam | undefined> {
    return this.exams.get(id);
  }

  /**
   * Auto-save active examination attempt to prevent any data loss
   */
  async saveActiveSession(attempt: ExamAttempt, exam: Exam): Promise<void> {
    const record: ActiveSessionRecord = {
      id: 'current_active_session',
      attempt,
      exam,
      savedAt: Date.now(),
    };
    await this.activeSession.put(record);
  }

  /**
   * Load active recovery session if one exists and is incomplete
   */
  async loadActiveSession(): Promise<ActiveSessionRecord | null> {
    const session = await this.activeSession.get('current_active_session');
    if (!session) return null;
    if (session.attempt.isCompleted) {
      await this.clearActiveSession();
      return null;
    }
    return session;
  }

  /**
   * Clear active session upon legitimate completion or discard
   */
  async clearActiveSession(): Promise<void> {
    await this.activeSession.delete('current_active_session');
  }

  /**
   * Save completed or paused attempt into persistent history
   */
  async saveAttempt(attempt: ExamAttempt): Promise<string> {
    await this.attempts.put(attempt);
    if (attempt.isCompleted) {
      await this.clearActiveSession();
    }
    return attempt.id;
  }

  /**
   * Get attempts history for an exam
   */
  async getAttemptsByExam(examId: string): Promise<ExamAttempt[]> {
    return this.attempts.where('examId').equals(examId).reverse().sortBy('startedAt');
  }

  /**
   * Get single attempt by ID
   */
  async getAttemptById(id: string): Promise<ExamAttempt | undefined> {
    return this.attempts.get(id);
  }

  /**
   * Flashcards: Get items due for review today
   */
  async getDueFlashcards(now: number = Date.now()): Promise<FlashcardItem[]> {
    return this.flashcards.where('dueDate').belowOrEqual(now).toArray();
  }

  /**
   * Flashcards: Save or update item
   */
  async saveFlashcard(item: FlashcardItem): Promise<void> {
    await this.flashcards.put(item);
  }

  /**
   * Flashcards: Bulk create from exam questions
   */
  async importQuestionsToFlashcards(exam: Exam): Promise<number> {
    const now = Date.now();
    const flashcards: FlashcardItem[] = exam.questions.map((q) => ({
      id: `fc_${exam.id}_${q.id}`,
      questionId: q.id,
      front: q.text,
      back: q.correctAnswer
        .map((idx) => q.options[idx] ?? `Phương án ${idx + 1}`)
        .join(', '),
      explanation: q.explanation || 'Không có giải thích chi tiết',
      repetitions: 0,
      interval: 1,
      easeFactor: 2.5,
      dueDate: now,
      history: [],
    }));

    await this.flashcards.bulkPut(flashcards);
    return flashcards.length;
  }

  /**
   * Export all database tables as JSON backup
   */
  async exportBackup(): Promise<string> {
    const [exams, attempts, flashcards, profiles] = await Promise.all([
      this.exams.toArray(),
      this.attempts.toArray(),
      this.flashcards.toArray(),
      this.profiles.toArray(),
    ]);

    const backup = {
      version: 1,
      exportedAt: new Date().toISOString(),
      exams,
      attempts,
      flashcards,
      profiles,
    };

    return JSON.stringify(backup, null, 2);
  }

  /**
   * Import database tables from JSON backup
   */
  async importBackup(jsonString: string): Promise<{ success: boolean; count: number }> {
    try {
      const data = JSON.parse(jsonString);
      if (!data || typeof data !== 'object') {
        throw new Error('Dữ liệu sao lưu không đúng định dạng!');
      }

      let count = 0;
      if (Array.isArray(data.exams)) {
        await this.exams.bulkPut(data.exams);
        count += data.exams.length;
      }
      if (Array.isArray(data.attempts)) {
        await this.attempts.bulkPut(data.attempts);
        count += data.attempts.length;
      }
      if (Array.isArray(data.flashcards)) {
        await this.flashcards.bulkPut(data.flashcards);
        count += data.flashcards.length;
      }

      return { success: true, count };
    } catch (err) {
      console.error('[Dexie Import Error]', err);
      return { success: false, count: 0 };
    }
  }
}

export const localDB = new OmniQuizDatabase();
