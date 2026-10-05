/**
 * src/features/multiplayer/room-service.ts - Realtime Multiplayer PIN 6-digit Room Service
 * Manages Room Host, Candidate Lobby, Presence sync, Broadcast Start/Stop, and Live Leaderboard.
 */

import type { Exam, RoomParticipant, RoomSession } from '../../shared/types';
import { supabaseSync } from '../../shared/db/supabase';

export interface RoomCallbacks {
  onParticipantListChange: (participants: RoomParticipant[]) => void;
  onExamStarted: (exam: Exam) => void;
  onLeaderboardUpdate: (ranked: RoomParticipant[]) => void;
}

export class MultiplayerRoomService {
  private currentSession: RoomSession | null = null;
  private currentParticipant: RoomParticipant | null = null;
  private isHost: boolean = false;
  private callbacks: RoomCallbacks | null = null;

  constructor() {}

  /**
   * Generate secure 6-digit random PIN
   */
  public generatePin(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /**
   * Host creates a new online room
   */
  public async createRoom(
    hostName: string,
    exam: Exam,
    callbacks: RoomCallbacks
  ): Promise<string> {
    const pin = this.generatePin();
    this.isHost = true;
    this.callbacks = callbacks;

    const hostParticipant: RoomParticipant = {
      id: `host_${Date.now()}`,
      name: `${hostName} (Giáo viên / Host)`,
      joinedAt: Date.now(),
      progress: 0,
      currentQuestion: 0,
      submitted: false,
    };
    this.currentParticipant = hostParticipant;

    this.currentSession = {
      pin,
      hostId: hostParticipant.id,
      hostName,
      examId: exam.id,
      examTitle: exam.title,
      status: 'waiting',
      createdAt: new Date().toISOString(),
      questions: exam.questions,
      participants: {
        [hostParticipant.id]: hostParticipant,
      },
    };

    // Connect Supabase Realtime channel
    supabaseSync.joinRealtimeRoom(
      pin,
      hostParticipant,
      (update) => this.handleRoomUpdate(update),
      (action) => this.handleHostAction(action)
    );

    return pin;
  }

  /**
   * Candidate joins an existing room by 6-digit PIN
   */
  public async joinRoom(
    pin: string,
    candidateName: string,
    callbacks: RoomCallbacks
  ): Promise<boolean> {
    this.isHost = false;
    this.callbacks = callbacks;

    const participant: RoomParticipant = {
      id: `cand_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: candidateName,
      joinedAt: Date.now(),
      progress: 0,
      currentQuestion: 0,
      submitted: false,
    };
    this.currentParticipant = participant;

    supabaseSync.joinRealtimeRoom(
      pin,
      participant,
      (update) => this.handleRoomUpdate(update),
      (action, payload) => this.handleHostAction(action, payload)
    );

    return true;
  }

  /**
   * Host starts exam for all connected candidates simultaneously
   */
  public async startExamForRoom(exam: Exam): Promise<void> {
    if (!this.isHost || !this.currentSession) return;
    this.currentSession.status = 'in_progress';
    this.currentSession.startedAt = new Date().toISOString();

    await supabaseSync.broadcastHostAction(this.currentSession.pin, 'START_EXAM', {
      exam,
      startedAt: this.currentSession.startedAt,
    });
  }

  /**
   * Candidate submits answer / updates progress
   */
  public async reportProgress(progressPercent: number, currentQuestion: number): Promise<void> {
    if (!this.currentParticipant) return;
    this.currentParticipant.progress = progressPercent;
    this.currentParticipant.currentQuestion = currentQuestion;

    await supabaseSync.broadcastProgress(this.currentParticipant);
  }

  /**
   * Candidate submits final score to leaderboard
   */
  public async submitScore(score: number): Promise<void> {
    if (!this.currentParticipant) return;
    this.currentParticipant.score = score;
    this.currentParticipant.progress = 100;
    this.currentParticipant.submitted = true;
    this.currentParticipant.submittedAt = Date.now();

    await supabaseSync.broadcastProgress(this.currentParticipant);
  }

  /**
   * Rank participants by score (highest first), then fastest completion
   */
  public getRankedLeaderboard(): RoomParticipant[] {
    if (!this.currentSession) return [];

    const list = Object.values(this.currentSession.participants).filter((p) => !p.name.includes('(Giáo viên / Host)'));

    return list.sort((a, b) => {
      const scoreA = a.score ?? 0;
      const scoreB = b.score ?? 0;
      if (scoreB !== scoreA) return scoreB - scoreA;
      const timeA = a.submittedAt ?? Number.MAX_SAFE_INTEGER;
      const timeB = b.submittedAt ?? Number.MAX_SAFE_INTEGER;
      return timeA - timeB;
    });
  }

  public leaveRoom(): void {
    supabaseSync.leaveRoom();
    this.currentSession = null;
    this.currentParticipant = null;
    this.isHost = false;
  }

  private handleRoomUpdate(update: Partial<RoomSession>): void {
    if (!this.currentSession) return;

    if (update.participants) {
      this.currentSession.participants = {
        ...this.currentSession.participants,
        ...update.participants,
      };
    }

    const participantList = Object.values(this.currentSession.participants);
    this.callbacks?.onParticipantListChange(participantList);
    this.callbacks?.onLeaderboardUpdate(this.getRankedLeaderboard());
  }

  private handleHostAction(action: string, payload?: unknown): void {
    if (action === 'START_EXAM') {
      const data = payload as { exam: Exam };
      if (data?.exam) {
        this.callbacks?.onExamStarted(data.exam);
      }
    }
  }
}

export const multiplayerRoomService = new MultiplayerRoomService();
