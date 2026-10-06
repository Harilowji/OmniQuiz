/**
 * src/features/analytics/analytics-service.ts - Post-Exam Analytics & Export Service
 * Features: Radar Chart for Subject Mastery, Time Distribution Analysis, PDF/CSV/JSON Exports.
 */

import {
  Chart,
  RadarController,
  BarController,
  RadialLinearScale,
  PointElement,
  LineElement,
  BarElement,
  CategoryScale,
  LinearScale,
  Filler,
  Tooltip,
  Legend,
} from 'chart.js';
import jsPDF from 'jspdf';
import type { Exam, ExamAttempt, ExamAnalyticsReport, SubjectSkillMastery, QuestionTimeAnalysis } from '../../shared/types';

// Register Chart.js components
Chart.register(
  RadarController,
  BarController,
  RadialLinearScale,
  PointElement,
  LineElement,
  BarElement,
  CategoryScale,
  LinearScale,
  Filler,
  Tooltip,
  Legend
);

export class AnalyticsService {
  private radarChartInstance: Chart | null = null;
  private timeChartInstance: Chart | null = null;

  /**
   * Compute comprehensive analytics report from attempt & exam
   */
  public generateReport(exam: Exam, attempt: ExamAttempt): ExamAnalyticsReport {
    const totalQuestions = exam.questions.length;
    let correctCount = 0;
    let wrongCount = 0;
    let unansweredCount = 0;

    const subjectMap: Record<string, { correct: number; total: number }> = {};
    const timeDistribution: QuestionTimeAnalysis[] = [];

    exam.questions.forEach((q, idx) => {
      const userAnswers = attempt.answers[idx] || [];
      const correctAnswers = q.correctAnswer;
      const timeSpent = attempt.timeSpentPerQuestion[idx] || 0;

      const isAnswered = userAnswers.length > 0;
      const isCorrect =
        isAnswered &&
        userAnswers.length === correctAnswers.length &&
        userAnswers.every((ans) => correctAnswers.includes(ans));

      if (!isAnswered) unansweredCount++;
      else if (isCorrect) correctCount++;
      else wrongCount++;

      // Subject classification
      const subj = q.subject || exam.subject || 'Tổng hợp';
      if (!subjectMap[subj]) {
        subjectMap[subj] = { correct: 0, total: 0 };
      }
      subjectMap[subj]!.total += 1;
      if (isCorrect) subjectMap[subj]!.correct += 1;

      timeDistribution.push({
        questionIndex: idx + 1,
        timeSpentSeconds: timeSpent,
        isCorrect,
        difficulty: q.difficulty,
      });
    });

    const subjectRadar: SubjectSkillMastery[] = Object.entries(subjectMap).map(([subject, stats]) => ({
      subject,
      correct: stats.correct,
      total: stats.total,
      masteryPercentage: stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0,
    }));

    const scorePercentage = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;
    const totalTimeSpentSeconds = Object.values(attempt.timeSpentPerQuestion).reduce((a, b) => a + b, 0);
    const averageTimePerQuestion =
      totalQuestions > 0 ? Math.round(totalTimeSpentSeconds / totalQuestions) : 0;

    // AI/Analytical recommendations
    const recommendations: string[] = [];
    subjectRadar.forEach((s) => {
      if (s.masteryPercentage < 60) {
        recommendations.push(`Cần ôn tập thêm chuyên đề "${s.subject}" (Tỷ lệ chính xác: ${s.masteryPercentage}%).`);
      }
    });

    if (unansweredCount > 0) {
      recommendations.push(`Bạn còn ${unansweredCount} câu chưa kịp trả lời. Hãy rèn luyện kỹ năng phân bổ thời gian.`);
    }

    if (attempt.violations.length > 0) {
      recommendations.push(`Hệ thống ghi nhận ${attempt.violations.length} cảnh báo rời màn hình thi.`);
    }

    if (recommendations.length === 0) {
      recommendations.push('Xuất sắc! Bạn nắm vững kiến thức toàn bộ các chủ đề trong bài thi.');
    }

    return {
      attemptId: attempt.id,
      examTitle: exam.title,
      totalQuestions,
      correctCount,
      wrongCount,
      unansweredCount,
      scorePercentage,
      totalTimeSpentSeconds,
      averageTimePerQuestion,
      subjectRadar,
      timeDistribution,
      violations: attempt.violations,
      recommendations,
    };
  }

  /**
   * Render Subject Mastery Radar Chart
   */
  public renderRadarChart(canvas: HTMLCanvasElement, skills: SubjectSkillMastery[]): void {
    if (this.radarChartInstance) {
      this.radarChartInstance.destroy();
      this.radarChartInstance = null;
    }

    const labels = skills.length > 0 ? skills.map((s) => s.subject) : ['Tổng quát'];
    const data = skills.length > 0 ? skills.map((s) => s.masteryPercentage) : [100];

    this.radarChartInstance = new Chart(canvas, {
      type: 'radar',
      data: {
        labels,
        datasets: [
          {
            label: 'Độ thành thạo (%)',
            data,
            fill: true,
            backgroundColor: 'rgba(74, 155, 201, 0.25)',
            borderColor: '#4a9bc9',
            pointBackgroundColor: '#4a9bc9',
            pointBorderColor: '#ffffff',
            pointHoverBackgroundColor: '#ffffff',
            pointHoverBorderColor: '#4a9bc9',
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          r: {
            angleLines: { color: 'rgba(188, 226, 245, 0.4)' },
            grid: { color: 'rgba(188, 226, 245, 0.4)' },
            pointLabels: {
              font: { size: 12, weight: 'bold', family: 'Nunito, sans-serif' },
              color: '#2a4a5a',
            },
            suggestedMin: 0,
            suggestedMax: 100,
          },
        },
        plugins: {
          legend: { display: false },
        },
      },
    });
  }

  /**
   * Render Question Time Distribution Bar Chart
   */
  public renderTimeDistributionChart(canvas: HTMLCanvasElement, times: QuestionTimeAnalysis[]): void {
    if (this.timeChartInstance) {
      this.timeChartInstance.destroy();
      this.timeChartInstance = null;
    }

    const labels = times.map((t) => `C${t.questionIndex}`);
    const data = times.map((t) => t.timeSpentSeconds);
    const backgroundColors = times.map((t) => (t.isCorrect ? 'rgba(93, 190, 138, 0.75)' : 'rgba(239, 68, 68, 0.75)'));

    this.timeChartInstance = new Chart(canvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Thời gian (giây)',
            data,
            backgroundColor: backgroundColors,
            borderRadius: 6,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            grid: { display: false },
            ticks: { font: { size: 11, family: 'Nunito, sans-serif' } },
          },
          y: {
            title: { display: true, text: 'Giây / câu' },
            ticks: { font: { size: 11, family: 'Nunito, sans-serif' } },
          },
        },
        plugins: {
          legend: { display: false },
        },
      },
    });
  }

  /**
   * Export Result & Exam to Printable PDF Document
   */
  public exportExamToPDF(exam: Exam, report?: ExamAnalyticsReport): void {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    let y = 20;

function toPdfSafeText(str: string): string {
  if (!str) return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .replace(/[\r\n]+/g, ' ')
    .trim();
}

    // Title Header
    doc.setFontSize(18);
    doc.text('OMNIQUIZ PRO - PHIEU BAI THI & BAO CAO KET QUA', 105, y, { align: 'center' });
    y += 10;

    doc.setFontSize(13);
    doc.text(toPdfSafeText(`Ten de thi: ${exam.title}`), 20, y);
    y += 7;

    doc.setFontSize(10);
    doc.text(toPdfSafeText(`Mon hoc: ${exam.subject} | Thoi gian: ${exam.durationMinutes} phut | Tong so cau: ${exam.totalQuestions}`), 20, y);
    y += 10;

    if (report) {
      doc.setDrawColor(74, 155, 201);
      doc.setFillColor(240, 248, 255);
      doc.roundedRect(20, y, 170, 24, 3, 3, 'FD');

      doc.setFontSize(11);
      doc.text(toPdfSafeText(`Diem so: ${report.scorePercentage}/100`), 25, y + 8);
      doc.text(toPdfSafeText(`So cau dung: ${report.correctCount} / ${report.totalQuestions}`), 25, y + 16);
      doc.text(toPdfSafeText(`Thoi gian lam bai: ${Math.round(report.totalTimeSpentSeconds / 60)} phut`), 110, y + 8);
      doc.text(toPdfSafeText(`So lan vi pham: ${report.violations.length}`), 110, y + 16);
      y += 32;
    }

    doc.line(20, y, 190, y);
    y += 8;

    doc.setFontSize(12);
    doc.text('DANH SACH CAU HOI VA DAP AN:', 20, y);
    y += 8;

    exam.questions.forEach((q, idx) => {
      if (y > 270) {
        doc.addPage();
        y = 20;
      }

      doc.setFontSize(10);
      const firstLine = q.text.split('\n')[0] || '';
      const qTitle = toPdfSafeText(`Cau ${idx + 1}: ${firstLine}`);
      const splitTitle = doc.splitTextToSize(qTitle, 170);
      doc.text(splitTitle, 20, y);
      y += splitTitle.length * 5;

      q.options.forEach((opt, optIdx) => {
        if (y > 275) {
          doc.addPage();
          y = 20;
        }
        const letter = String.fromCharCode(65 + optIdx);
        const isAns = q.correctAnswer.includes(optIdx);
        const optLine = toPdfSafeText(`  ${letter}. ${opt} ${isAns ? ' [DAP AN DUNG]' : ''}`);
        doc.text(optLine, 22, y);
        y += 5;
      });

      y += 4;
    });

    const safeFilename = toPdfSafeText(exam.title).replace(/\s+/g, '_') || 'OmniQuiz_Exam';
    doc.save(`${safeFilename}_Bao_Cao.pdf`);
  }

  /**
   * Export CSV Gradebook
   */
  public exportCSVGradebook(report: ExamAnalyticsReport): void {
    const rows = [
      ['Câu số', 'Thời gian làm (giây)', 'Kết quả', 'Độ khó'],
      ...report.timeDistribution.map((t) => [
        t.questionIndex.toString(),
        t.timeSpentSeconds.toString(),
        t.isCorrect ? 'ĐÚNG' : 'SAI',
        t.difficulty || 'Bình thường',
      ]),
    ];

    const csvContent = '\uFEFF' + rows.map((e) => e.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${report.examTitle.replace(/\s+/g, '_')}_Bang_Diem.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  /**
   * Export Full Review JSON Package
   */
  public exportJSONReview(exam: Exam, attempt: ExamAttempt, report: ExamAnalyticsReport): void {
    const data = {
      version: '2.5.0',
      exportedAt: new Date().toISOString(),
      exam,
      attempt,
      report,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${exam.title.replace(/\s+/g, '_')}_Review.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}

export const analyticsService = new AnalyticsService();
