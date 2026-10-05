/**
 * src/shared/db/supabase.ts - Supabase BaaS Cloud Sync & Realtime Multiplayer Client
 * Integrates PostgreSQL tables: profiles, quizzes, questions, exam_attempts, room_sessions
 */

import { createClient, type SupabaseClient, type RealtimeChannel } from '@supabase/supabase-js';
import type { Exam, ExamAttempt, RoomParticipant, RoomSession } from '../types';

// Default / fallback keys (can be overridden via localStorage or env)
const DEFAULT_SUPABASE_URL = 'https://xykbfxocdquvcvjcfbqt.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh5a2JmeG9jZHF1dmN2amNmYnF0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjYwNDgzNDIsImV4cCI6MjA0MTYyNDM0Mn0.N5ZkFvFz4zB8m08hI286-9L5q8WqB3F1-m6b-0F7y5Y';

export class SupabaseSyncService {
  private client: SupabaseClient | null = null;
  private currentRoomChannel: RealtimeChannel | null = null;

  constructor() {
    this.initClient();
  }

  private initClient(): void {
    const url =
      (typeof process !== 'undefined' && process.env?.VITE_SUPABASE_URL) ||
      localStorage.getItem('omniquiz_supabase_url') ||
      DEFAULT_SUPABASE_URL;

    const anonKey =
      (typeof process !== 'undefined' && process.env?.VITE_SUPABASE_ANON_KEY) ||
      localStorage.getItem('omniquiz_supabase_key') ||
      DEFAULT_SUPABASE_ANON_KEY;

    try {
      this.client = createClient(url, anonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
        },
        realtime: {
          params: {
            eventsPerSecond: 10,
          },
        },
      });
    } catch (err) {
      console.warn('[Supabase Init Warning] Running in offline mode:', err);
      this.client = null;
    }
  }

  public getClient(): SupabaseClient | null {
    return this.client;
  }

  public isConnected(): boolean {
    return this.client !== null;
  }

  /**
   * Sync Exam Attempt to Cloud
   */
  async syncAttemptToCloud(attempt: ExamAttempt): Promise<boolean> {
    if (!this.client) return false;
    try {
      const { error } = await this.client.from('exam_attempts').upsert({
        id: attempt.id,
        exam_id: attempt.examId,
        exam_title: attempt.examTitle,
        mode: attempt.mode,
        started_at: new Date(attempt.startedAt).toISOString(),
        submitted_at: attempt.submittedAt ? new Date(attempt.submittedAt).toISOString() : null,
        answers: attempt.answers,
        score: attempt.score ?? 0,
        total_score: attempt.totalScore ?? 100,
        accuracy: attempt.accuracy ?? 0,
        violations_count: attempt.violations.length,
        time_spent_json: attempt.timeSpentPerQuestion,
      });

      return !error;
    } catch (err) {
      console.warn('[Supabase Sync Attempt Error]:', err);
      return false;
    }
  }

  /**
   * Fetch Public Cloud Quizzes
   */
  async fetchCloudQuizzes(): Promise<Exam[]> {
    if (!this.client) return [];
    try {
      const { data, error } = await this.client
        .from('quizzes')
        .select('*')
        .eq('is_published', true)
        .order('created_at', { ascending: false });

      if (error || !data) return [];

      return data.map((row: any) => ({
        id: String(row.id),
        title: row.title || 'Đề thi trực tuyến',
        description: row.description || '',
        subject: row.subject || 'Tổng hợp',
        durationMinutes: Number(row.duration_minutes) || 45,
        totalQuestions: Array.isArray(row.questions) ? row.questions.length : 0,
        createdAt: row.created_at,
        updatedAt: row.updated_at || row.created_at,
        questions: Array.isArray(row.questions) ? row.questions : [],
      }));
    } catch (err) {
      console.warn('[Supabase Fetch Quizzes Error]:', err);
      return [];
    }
  }

  /**
   * Join or Create Realtime 6-digit PIN Room
   */
  joinRealtimeRoom(
    pin: string,
    participant: RoomParticipant,
    onRoomUpdate: (session: Partial<RoomSession>) => void,
    onHostAction?: (action: string, payload?: unknown) => void
  ): RealtimeChannel | null {
    if (!this.client) return null;

    if (this.currentRoomChannel) {
      this.currentRoomChannel.unsubscribe();
      this.currentRoomChannel = null;
    }

    const channel = this.client.channel(`room_${pin}`, {
      config: {
        presence: {
          key: participant.id,
        },
      },
    });

    // Handle Presence state sync
    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const participants: Record<string, RoomParticipant> = {};
        for (const [key, presences] of Object.entries(state)) {
          const latest = presences[presences.length - 1] as unknown as RoomParticipant;
          if (latest) {
            participants[key] = latest;
          }
        }
        onRoomUpdate({ participants });
      })
      .on('broadcast', { event: 'host_action' }, (event) => {
        if (onHostAction) {
          onHostAction(event.payload.action, event.payload.data);
        }
      })
      .on('broadcast', { event: 'participant_progress' }, (event) => {
        const p = event.payload as RoomParticipant;
        onRoomUpdate({
          participants: {
            [p.id]: p,
          },
        });
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track(participant);
        }
      });

    this.currentRoomChannel = channel;
    return channel;
  }

  /**
   * Host sends global command (e.g. START_EXAM, FINISH_EXAM)
   */
  async broadcastHostAction(pin: string, action: string, data?: unknown): Promise<void> {
    if (!this.currentRoomChannel) return;
    await this.currentRoomChannel.send({
      type: 'broadcast',
      event: 'host_action',
      payload: { pin, action, data, timestamp: Date.now() },
    });
  }

  /**
   * Participant broadcasts live progress updates
   */
  async broadcastProgress(participant: RoomParticipant): Promise<void> {
    if (!this.currentRoomChannel) return;
    await this.currentRoomChannel.send({
      type: 'broadcast',
      event: 'participant_progress',
      payload: participant,
    });
  }

  /**
   * Leave room channel
   */
  leaveRoom(): void {
    if (this.currentRoomChannel) {
      this.currentRoomChannel.unsubscribe();
      this.currentRoomChannel = null;
    }
  }
}

export const supabaseSync = new SupabaseSyncService();
