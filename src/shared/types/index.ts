/**
 * OmniQuiz PRO - Core Domain Types & Interfaces
 * Strictly Typed (Zero `any`, Zero Placeholder)
 */

export type QuestionType = 'single' | 'multiple' | 'true_false' | 'fill_in';

export interface Question {
  id: string;
  index: number;
  text: string;
  type: QuestionType;
  options: string[];
  correctAnswer: number[];
  explanation?: string;
  passage?: string; // Reading comprehension passage for Split View
  subject?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  imageUrl?: string; // Auto-cropped diagram or vector from document
  codeSnippet?: {
    code: string;
    language: string;
  };
  rawText?: string;
}

export interface ExamMeta {
  id: string;
  title: string;
  description?: string;
  durationMinutes: number;
  totalQuestions: number;
  subject: string;
  createdAt: string;
  updatedAt: string;
}

export interface Exam extends ExamMeta {
  questions: Question[];
}

export type StudyMode = 'exam' | 'practice' | 'flashcard';

export type QuestionCardStatus = 'unanswered' | 'answered' | 'flagged' | 'current' | 'eliminated';

export type ViolationType =
  | 'fullscreen_exit'
  | 'tab_blur'
  | 'visibility_hidden'
  | 'key_violation'
  | 'context_menu'
  | 'copy_paste_attempt'
  | 'dev_tools';

export interface ExamViolation {
  id: string;
  type: ViolationType;
  timestamp: number;
  detail: string;
  tier: 1 | 2 | 3; // 1 = Warning Banner, 2 = Modal Pause, 3 = Auto-submit Freeze
}

export interface ExamAttempt {
  id: string;
  examId: string;
  examTitle: string;
  mode: StudyMode;
  startedAt: number;
  submittedAt?: number;
  timeRemainingSeconds: number;
  totalDurationSeconds: number;
  answers: Record<number, number[]>; // questionIndex -> selected Option Indices
  flaggedQuestions: number[]; // question indices
  eliminatedOptions: Record<number, number[]>; // questionIndex -> eliminated option indices
  violations: ExamViolation[];
  isCompleted: boolean;
  score?: number;
  totalScore?: number;
  accuracy?: number;
  timeSpentPerQuestion: Record<number, number>; // questionIndex -> seconds
  feedbackSummary?: string;
}

/**
 * SuperMemo 2 (SM-2) Spaced Repetition Algorithm Types
 */
export type SM2Rating = 0 | 1 | 2 | 3 | 4 | 5;
// 0, 1, 2 = Again (Blackout/Wrong)
// 3 = Hard
// 4 = Good
// 5 = Easy

export interface FlashcardItem {
  id: string;
  questionId: string;
  front: string;
  back: string;
  explanation?: string;
  repetitions: number;
  interval: number; // in days
  easeFactor: number; // default 2.5
  dueDate: number; // timestamp
  lastReviewedAt?: number;
  history: Array<{
    reviewedAt: number;
    rating: SM2Rating;
    interval: number;
  }>;
}

/**
 * Realtime Multiplayer PIN Room Types
 */
export interface RoomParticipant {
  id: string;
  name: string;
  joinedAt: number;
  progress: number; // percentage 0 - 100
  currentQuestion: number;
  score?: number;
  submitted: boolean;
  submittedAt?: number;
}

export interface RoomSession {
  pin: string; // 6 digits
  hostId: string;
  hostName: string;
  examId: string;
  examTitle: string;
  status: 'waiting' | 'in_progress' | 'finished';
  createdAt: string;
  startedAt?: string;
  questions?: Question[];
  participants: Record<string, RoomParticipant>;
}

/**
 * Post-Exam Analytics & Radar Chart Data
 */
export interface SubjectSkillMastery {
  subject: string;
  correct: number;
  total: number;
  masteryPercentage: number;
}

export interface QuestionTimeAnalysis {
  questionIndex: number;
  timeSpentSeconds: number;
  isCorrect: boolean;
  difficulty?: 'easy' | 'medium' | 'hard';
}

export interface ExamAnalyticsReport {
  attemptId: string;
  examTitle: string;
  totalQuestions: number;
  correctCount: number;
  wrongCount: number;
  unansweredCount: number;
  scorePercentage: number;
  totalTimeSpentSeconds: number;
  averageTimePerQuestion: number;
  subjectRadar: SubjectSkillMastery[];
  timeDistribution: QuestionTimeAnalysis[];
  violations: ExamViolation[];
  recommendations: string[];
}

/**
 * Authentication & Profiles
 */
export interface UserProfile {
  id: string;
  email: string;
  name: string;
  role: 'student' | 'teacher' | 'admin';
  avatarUrl?: string;
  createdAt: string;
}

/**
 * Worker Parser Messages
 */
export type ParserFileType = 'pdf' | 'docx' | 'txt' | 'auto';

export interface ParserWorkerPayload {
  fileBuffer: ArrayBuffer;
  fileName: string;
  fileType: ParserFileType;
  subjectHint?: string;
}

export interface ParserWorkerResult {
  success: boolean;
  examTitle: string;
  description?: string;
  durationMinutes?: number;
  questions: Question[];
  diagramBlobs?: Record<string, string>; // questionId -> base64/blob string
  error?: string;
}
