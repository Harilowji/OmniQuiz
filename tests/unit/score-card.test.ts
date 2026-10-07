/**
 * @vitest-environment jsdom
 * tests/unit/score-card.test.ts
 * Verifies OpenGraph 1200x630 score card canvas rendering, rank badge tiers, and blob generation.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  generateScoreCardCanvas,
  getRankBadge,
  exportScoreCardBlob,
} from '../../src/features/analytics/score-card-generator';
import type { Exam, ExamAttempt, ExamAnalyticsReport } from '../../src/shared/types';

describe('Viral Score Card Generator (OG 1200x630)', () => {
  const mockExam: Exam = {
    id: 'exam_sat',
    title: 'Digital SAT Math CBT',
    subject: 'Toán học SAT',
    durationMinutes: 45,
    totalQuestions: 20,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    questions: [],
  };

  const mockAttempt: ExamAttempt = {
    id: 'attempt_001',
    examId: 'exam_sat',
    examTitle: 'Digital SAT Math CBT',
    mode: 'exam',
    startedAt: Date.now() - 1800000,
    timeRemainingSeconds: 900,
    totalDurationSeconds: 2700,
    answers: {},
    flaggedQuestions: [],
    violations: [],
    timeSpentPerQuestion: {},
    isCompleted: true,
  };

  const mockReport: ExamAnalyticsReport = {
    attemptId: 'attempt_001',
    examTitle: 'Digital SAT Math CBT',
    totalQuestions: 20,
    correctCount: 19,
    wrongCount: 1,
    unansweredCount: 0,
    scorePercentage: 95,
    totalTimeSpentSeconds: 1800,
    averageTimePerQuestion: 90,
    subjectRadar: [],
    timeDistribution: [],
    violations: [],
    recommendations: [],
  };

  beforeEach(() => {
    // Ensure mock 2D context for jsdom
    const mockCtx = {
      createLinearGradient: vi.fn().mockReturnValue({ addColorStop: vi.fn() }),
      createRadialGradient: vi.fn().mockReturnValue({ addColorStop: vi.fn() }),
      fillRect: vi.fn(),
      strokeRect: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      fill: vi.fn(),
      closePath: vi.fn(),
      fillText: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      quadraticCurveTo: vi.fn(),
    };

    HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue(mockCtx);

    // Mock toBlob for jsdom
    HTMLCanvasElement.prototype.toBlob = vi.fn().mockImplementation((callback) => {
      callback(new Blob(['mock-binary-png-stream'], { type: 'image/png' }));
    });
  });

  it('should generate canvas with exact 1200 x 630 px OpenGraph dimensions', () => {
    const canvas = generateScoreCardCanvas(mockExam, mockAttempt, mockReport, 'Nguyễn Văn A');

    expect(canvas).toBeInstanceOf(HTMLCanvasElement);
    expect(canvas.width).toBe(1200);
    expect(canvas.height).toBe(630);
  });

  it('should correctly assign badge tiers based on performance percentage', () => {
    expect(getRankBadge(95).title).toContain('XUẤT SẮC');
    expect(getRankBadge(85).title).toContain('GIỎI');
    expect(getRankBadge(70).title).toContain('KHÁ');
    expect(getRankBadge(55).title).toContain('ĐẠT CHUẨN');
    expect(getRankBadge(40).title).toContain('CẦN CỐ GẮNG');
  });

  it('should successfully export canvas to PNG blob', async () => {
    const canvas = generateScoreCardCanvas(mockExam, mockAttempt, mockReport, 'Trần Thí Sinh');
    const blob = await exportScoreCardBlob(canvas);

    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe('image/png');
    expect(blob.size).toBeGreaterThan(0);
  });
});
