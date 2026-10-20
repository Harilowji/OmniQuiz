/**
 * src/shared/db/offline-queue.ts - Offline Sync Queue Engine
 * Buffers submissions, profile updates, and exams when disconnected or during network failures.
 * Automatically synchronizes with Supabase BaaS as soon as internet connectivity resumes.
 */

import { omniQuizDb, type PendingSyncItem } from './dexie-db';
import { supabaseSync } from './supabase';

export class OfflineSyncQueue {
  private isProcessing = false;
  private isInitialized = false;

  public init(): void {
    if (this.isInitialized || typeof window === 'undefined') return;
    this.isInitialized = true;

    window.addEventListener('online', () => {
      console.log('[OfflineSyncQueue] Network restored. Draining offline queue...');
      void this.drainQueue();
    });

    // Also attempt initial drain on startup if online
    if (navigator.onLine) {
      setTimeout(() => {
        void this.drainQueue();
      }, 3000);
    }
  }

  /**
   * Enqueue a pending sync task
   */
  public async enqueue(type: 'submission' | 'profile' | 'exam', payload: any): Promise<string> {
    try {
      const id = await omniQuizDb.enqueuePendingSync(type, payload);
      console.log(`[OfflineSyncQueue] Enqueued offline task [${type}]:`, id);
      return id;
    } catch (err) {
      console.warn('[OfflineSyncQueue] Failed to enqueue task locally:', err);
      return '';
    }
  }

  /**
   * Returns number of items awaiting cloud sync
   */
  public async getPendingCount(): Promise<number> {
    try {
      const items = await omniQuizDb.getPendingSyncQueue();
      return items.length;
    } catch {
      return 0;
    }
  }

  /**
   * Process all queued items sequentially
   */
  public async drainQueue(): Promise<void> {
    if (this.isProcessing) return;
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;
    if (!supabaseSync.isConnected()) return;

    this.isProcessing = true;
    try {
      const queue = await omniQuizDb.getPendingSyncQueue();
      for (const item of queue) {
        const success = await this.processItem(item);
        if (success) {
          await omniQuizDb.removePendingSync(item.id);
          console.log(`[OfflineSyncQueue] Successfully synced and removed item ${item.id}`);
        } else {
          // Increment retries
          item.retries++;
          if (item.retries > 5) {
            console.warn(`[OfflineSyncQueue] Max retries exceeded for ${item.id}. Dropping.`);
            await omniQuizDb.removePendingSync(item.id);
          } else {
            await omniQuizDb.pendingSyncQueue.put(item);
          }
        }
      }
    } catch (err) {
      console.warn('[OfflineSyncQueue] Error draining sync queue:', err);
    } finally {
      this.isProcessing = false;
    }
  }

  private async processItem(item: PendingSyncItem): Promise<boolean> {
    switch (item.type) {
      case 'submission': {
        const { examId, answers, timeSpentSeconds, tabSwitches, candidateName, candidateSbd } = item.payload;
        const res = await supabaseSync.submitExamViaRPC(
          examId,
          answers,
          timeSpentSeconds,
          tabSwitches,
          candidateName,
          candidateSbd
        );
        return res.success;
      }

      case 'profile': {
        const client = supabaseSync.getClient();
        if (!client) return false;
        const { id, exp, level, streakDays, totalAnswered, totalCorrect, rankTier } = item.payload;
        const { error } = await client
          .from('profiles')
          .update({
            exp,
            level,
            streak_days: streakDays,
            total_answered: totalAnswered,
            total_correct: totalCorrect,
            rank_tier: rankTier,
            updated_at: new Date().toISOString(),
          })
          .eq('id', id);
        return !error;
      }

      case 'exam': {
        const client = supabaseSync.getClient();
        if (!client) return false;
        const { exam } = item.payload;
        const { error } = await client.from('exams').upsert({
          id: exam.id,
          title: exam.title,
          description: exam.description || '',
          duration_minutes: exam.durationMinutes || 45,
          total_questions: exam.questions?.length || 0,
        });
        return !error;
      }

      default:
        return true;
    }
  }
}

export const offlineSyncQueue = new OfflineSyncQueue();
