/**
 * src/features/analytics/analytics-dashboard.ts
 * Analytics Dashboard & Weakness Bank (Sổ Tay Câu Sai) for OmniQuiz PRO
 * Aggregates learning history, detects recurring error patterns, and generates instant retry quizzes.
 */

import { localDB } from '../../shared/db/dexie-db';
import { Exam, ExamAttempt, Question } from '../../shared/types';
import { soundEngine } from '../../shared/audio/sound-engine';
import { animeMascot } from '../mascot/anime-mascot';

export interface WeaknessItem {
  question: Question;
  examTitle: string;
  examId: string;
  userAnswers: number[];
  correctAnswers: number[];
  failCount: number;
  lastFailedAt: number;
}

export interface AnalyticsSummary {
  totalCompleted: number;
  averageScore10: number;
  totalTimeSeconds: number;
  averageAccuracy: number;
  weaknessQuestions: WeaknessItem[];
  recentAttempts: ExamAttempt[];
}

export class AnalyticsDashboard {
  constructor() {}

  /**
   * Scans IndexedDB and computes full analytics & aggregates the Weakness Bank
   */
  public async getAnalyticsSummary(): Promise<AnalyticsSummary> {
    const allAttempts = await localDB.attempts.toArray();
    const completed = allAttempts.filter((a) => a.isCompleted);

    if (completed.length === 0) {
      return {
        totalCompleted: 0,
        averageScore10: 0,
        totalTimeSeconds: 0,
        averageAccuracy: 0,
        weaknessQuestions: [],
        recentAttempts: [],
      };
    }

    let totalScore = 0;
    let totalAccuracy = 0;
    let totalTime = 0;

    // Cache exams loaded during scan
    const examCache = new Map<string, Exam | undefined>();
    const weaknessMap = new Map<string, WeaknessItem>();

    for (const attempt of completed) {
      // Score and time metrics
      const score = attempt.score ?? 0;
      const totalPossible = attempt.totalScore || 100;
      const scaled10 = totalPossible > 0 ? (score / totalPossible) * 10 : 0;
      totalScore += scaled10;

      totalAccuracy += attempt.accuracy ?? 0;
      totalTime += attempt.totalDurationSeconds - (attempt.timeRemainingSeconds ?? 0);

      // Analyze question errors for Weakness Bank
      let exam = examCache.get(attempt.examId);
      if (!exam && !examCache.has(attempt.examId)) {
        exam = await localDB.getExamById(attempt.examId);
        examCache.set(attempt.examId, exam);
      }

      if (exam && exam.questions) {
        const answers = attempt.answers || {};
        exam.questions.forEach((q, idx) => {
          const userChoices = answers[idx] || [];
          const correctChoices = q.correctAnswer || [];

          const isCorrect =
            userChoices.length === correctChoices.length &&
            userChoices.every((val) => correctChoices.includes(val));

          if (!isCorrect && userChoices.length > 0) {
            // Identified mistake
            const key = `${exam?.id}_${q.id || idx}`;
            const existing = weaknessMap.get(key);
            if (existing) {
              existing.failCount += 1;
              existing.userAnswers = userChoices;
              existing.lastFailedAt = Math.max(
                existing.lastFailedAt,
                attempt.submittedAt || attempt.startedAt
              );
            } else {
              weaknessMap.set(key, {
                question: q,
                examTitle: exam?.title || attempt.examTitle,
                examId: exam?.id || attempt.examId,
                userAnswers: userChoices,
                correctAnswers: correctChoices,
                failCount: 1,
                lastFailedAt: attempt.submittedAt || attempt.startedAt,
              });
            }
          }
        });
      }
    }

    const count = completed.length;
    const weaknessList = Array.from(weaknessMap.values()).sort(
      (a, b) => b.failCount - a.failCount || b.lastFailedAt - a.lastFailedAt
    );

    const sortedAttempts = [...completed].sort(
      (a, b) => (b.submittedAt || b.startedAt) - (a.submittedAt || a.startedAt)
    );

    return {
      totalCompleted: count,
      averageScore10: Math.round((totalScore / count) * 10) / 10,
      totalTimeSeconds: Math.max(0, totalTime),
      averageAccuracy: Math.round(totalAccuracy / count),
      weaknessQuestions: weaknessList,
      recentAttempts: sortedAttempts,
    };
  }

  /**
   * Generates a smart retry exam bundle containing all questions from the Weakness Bank
   */
  public createRetryExamFromWeakness(items: WeaknessItem[]): Exam {
    const questions: Question[] = items.map((w, idx) => ({
      ...w.question,
      id: `weakness_retry_${idx + 1}`,
      index: idx + 1,
    }));

    return {
      id: `exam_weakness_retry_${Date.now()}`,
      title: `🔥 Sổ Tay Ôn Tập Câu Sai (${questions.length} câu)`,
      description:
        'Đề thi ôn tập thông minh được tạo tự động từ toàn bộ các câu hỏi bạn từng làm sai để luyện tập gỡ điểm.',
      durationMinutes: Math.max(5, Math.ceil(questions.length * 1.5)),
      totalQuestions: questions.length,
      subject: 'Ôn Tập Trọng Điểm',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      questions,
    };
  }

  /**
   * Opens the full Analytics & Weakness Bank Modal
   */
  public async openAnalyticsModal(
    onStartRetryExam: (exam: Exam) => void,
    onReviewAttempt?: (attempt: ExamAttempt) => void
  ): Promise<void> {
    let modal = document.getElementById('analytics-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'analytics-modal';
      modal.className = 'modal-overlay';
      modal.style.zIndex = '99995';
      document.body.appendChild(modal);
    }

    modal.innerHTML = `
      <div class="modal-content analytics-modal-card">
        <div class="analytics-modal-header">
          <div class="analytics-modal-title-group">
            <span class="analytics-modal-icon">📊</span>
            <div>
              <h2 class="analytics-modal-title">Thống Kê Học Tập & Sổ Tay Câu Sai</h2>
              <p class="analytics-modal-subtitle">Phân tích toàn diện phổ điểm, tốc độ làm bài và ngân hàng các câu hỏi cần ôn lại</p>
            </div>
          </div>
          <button type="button" class="btn-action btn-del" id="btn-close-analytics-modal">✕</button>
        </div>

        <div class="analytics-modal-body">
          <div id="analytics-loading-indicator" class="analytics-loading-box">
            <div class="vision-spinner"></div>
            <span>Đang phân tích dữ liệu bài thi...</span>
          </div>
          <div id="analytics-content-view" style="display: none;"></div>
        </div>
      </div>
    `;

    modal.style.display = 'flex';

    modal.querySelector('#btn-close-analytics-modal')?.addEventListener('click', () => {
      if (modal) modal.style.display = 'none';
    });

    // Load data
    const summary = await this.getAnalyticsSummary();
    const loadingEl = modal.querySelector('#analytics-loading-indicator') as HTMLElement;
    const contentEl = modal.querySelector('#analytics-content-view') as HTMLElement;

    if (loadingEl) loadingEl.style.display = 'none';
    if (contentEl) contentEl.style.display = 'block';

    const hours = Math.floor(summary.totalTimeSeconds / 3600);
    const mins = Math.floor((summary.totalTimeSeconds % 3600) / 60);
    const timeFormatted = hours > 0 ? `${hours}h ${mins}m` : `${mins} phút`;

    const weaknessCount = summary.weaknessQuestions.length;

    contentEl.innerHTML = `
      <!-- Overall Stats Grid -->
      <div class="analytics-kpi-grid">
        <div class="kpi-card">
          <span class="kpi-icon">📝</span>
          <div class="kpi-val">${summary.totalCompleted}</div>
          <div class="kpi-lbl">Đề đã hoàn thành</div>
        </div>
        <div class="kpi-card">
          <span class="kpi-icon">🎯</span>
          <div class="kpi-val">${summary.averageScore10} <small>/10</small></div>
          <div class="kpi-lbl">Điểm trung bình</div>
        </div>
        <div class="kpi-card">
          <span class="kpi-icon">⏱️</span>
          <div class="kpi-val">${timeFormatted}</div>
          <div class="kpi-lbl">Tổng thời gian thi</div>
        </div>
        <div class="kpi-card">
          <span class="kpi-icon">⚡</span>
          <div class="kpi-val">${summary.averageAccuracy}%</div>
          <div class="kpi-lbl">Độ chính xác TB</div>
        </div>
      </div>

      <!-- Sổ Tay Câu Sai (Weakness Bank) Banner -->
      <div class="weakness-bank-section">
        <div class="weakness-header-row">
          <div>
            <h3 class="weakness-title">📕 Sổ Tay Câu Sai (Weakness Bank)</h3>
            <p class="weakness-subtitle">Tổng hợp ${weaknessCount} câu bạn đã từng chọn sai ở các lần thi trước</p>
          </div>
          ${
            weaknessCount > 0
              ? `
            <button type="button" class="btn-action btn-primary btn-retry-weakness" id="btn-retry-weakness">
              🔥 Ôn Tập Lại Ngay (${weaknessCount} câu)
            </button>
          `
              : ''
          }
        </div>

        ${
          weaknessCount === 0
            ? `
          <div class="weakness-empty-state">
            <span>🎉</span>
            <p>Tuyệt vời Senpai! Bạn chưa có câu hỏi nào bị sai hoặc chưa hoàn thành bài thi nào!</p>
          </div>
        `
            : `
          <div class="weakness-questions-list">
            ${summary.weaknessQuestions
              .slice(0, 10)
              .map((w, _i) => {
                const userLetters = w.userAnswers
                  .map((a) => String.fromCharCode(65 + a))
                  .join(', ');
                const correctLetters = w.correctAnswers
                  .map((a) => String.fromCharCode(65 + a))
                  .join(', ');
                return `
                <div class="weakness-q-card">
                  <div class="weakness-q-top">
                    <span class="weakness-badge-fail">Đã sai ${w.failCount} lần</span>
                    <span class="weakness-source-exam">${w.examTitle}</span>
                  </div>
                  <div class="weakness-q-text">${w.question.text}</div>
                  <div class="weakness-ans-row">
                    <span class="ans-user">❌ Bạn chọn: <strong>${userLetters || 'Chưa chọn'}</strong></span>
                    <span class="ans-correct">✅ Đáp án đúng: <strong>${correctLetters}</strong></span>
                  </div>
                  ${
                    w.question.explanation
                      ? `<div class="weakness-explanation">💡 <em>Lời giải:</em> ${w.question.explanation}</div>`
                      : ''
                  }
                </div>
              `;
              })
              .join('')}
            ${
              weaknessCount > 10
                ? `<p style="text-align: center; color: var(--text-muted); font-size: 0.88rem; margin-top: 8px;">...và còn ${weaknessCount - 10} câu sai khác trong sổ tay.</p>`
                : ''
            }
          </div>
        `
        }
      </div>

      <!-- Recent Attempt History -->
      <div class="attempts-history-section">
        <h3 class="attempts-title">🕒 Lịch Sử Các Lần Nộp Bài Gần Đây</h3>
        <div class="attempts-table-wrap">
          <table class="attempts-table">
            <thead>
              <tr>
                <th>Đề thi</th>
                <th>Chế độ</th>
                <th>Điểm số</th>
                <th>Chính xác</th>
                <th>Thời gian</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              ${
                summary.recentAttempts.length === 0
                  ? `<tr><td colspan="6" style="text-align: center; color: var(--text-muted);">Chưa có lượt thi nào được ghi nhận.</td></tr>`
                  : summary.recentAttempts
                      .map((att) => {
                        const dateStr = new Date(
                          att.submittedAt || att.startedAt
                        ).toLocaleDateString('vi-VN', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        });
                        const modeLabel =
                          att.mode === 'exam'
                            ? '🎯 Thi CBT'
                            : att.mode === 'boss_raid'
                              ? '⚔️ Boss Raid'
                              : '🥋 Luyện tập';
                        const scoreStr =
                          att.score !== undefined
                            ? `${att.score}/${att.totalScore || 100}`
                            : 'N/A';
                        const accStr =
                          att.accuracy !== undefined ? `${att.accuracy}%` : 'N/A';

                        return `
                      <tr>
                        <td>
                          <strong>${att.examTitle}</strong>
                          <small style="display: block; color: var(--text-muted); font-size: 0.78rem;">${dateStr}</small>
                        </td>
                        <td><span class="badge-mode">${modeLabel}</span></td>
                        <td><strong style="color: #6366f1;">${scoreStr}</strong></td>
                        <td>${accStr}</td>
                        <td>${Math.round((att.totalDurationSeconds - att.timeRemainingSeconds) / 60)} phút</td>
                        <td>
                          <button type="button" class="btn-action btn-sm btn-inspect-attempt" data-attempt-id="${att.id}">
                            🔍 Xem lại
                          </button>
                        </td>
                      </tr>
                    `;
                      })
                      .join('')
              }
            </tbody>
          </table>
        </div>
      </div>
    `;

    // Bind Retry Weakness Button
    contentEl.querySelector('#btn-retry-weakness')?.addEventListener('click', async () => {
      if (modal) modal.style.display = 'none';
      soundEngine.playClick();
      const retryExam = this.createRetryExamFromWeakness(summary.weaknessQuestions);
      await localDB.saveExam(retryExam);
      animeMascot.speak(
        `🔥 Đã tạo đề ôn tập Sổ Tay Câu Sai (${retryExam.questions.length} câu)! Chiến thắng sai lầm nào Senpai! ✨`,
        4500,
        'proud'
      );
      onStartRetryExam(retryExam);
    });

    // Bind Inspect Attempt Buttons
    contentEl.querySelectorAll('.btn-inspect-attempt').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-attempt-id');
        const targetAttempt = summary.recentAttempts.find((a) => a.id === id);
        if (targetAttempt && onReviewAttempt) {
          if (modal) modal.style.display = 'none';
          onReviewAttempt(targetAttempt);
        }
      });
    });
  }
}

export const analyticsDashboard = new AnalyticsDashboard();
