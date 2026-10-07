/**
 * src/features/analytics/score-card-generator.ts - Viral Score Card Generator
 * Uses pure HTML5 Canvas (1200 x 630 px OpenGraph standard) to render
 * high-fidelity certificates for social sharing (Facebook, Zalo, Messenger).
 */

import type { Exam, ExamAttempt, ExamAnalyticsReport } from '../../shared/types';

export interface ScoreCardRank {
  title: string;
  badgeColor: string;
  textColor: string;
}

export function getRankBadge(percentage: number): ScoreCardRank {
  if (percentage >= 90) {
    return { title: '🏆 XUẤT SẮC (CHUYÊN GIA CBT)', badgeColor: '#10b981', textColor: '#ecfdf5' };
  }
  if (percentage >= 80) {
    return { title: '⭐ GIỎI (XẾP HẠNG TIÊU BIỂU)', badgeColor: '#0ea5e9', textColor: '#f0f9ff' };
  }
  if (percentage >= 65) {
    return { title: '✨ KHÁ (ĐẠT CHUẨN NĂNG LỰC)', badgeColor: '#8b5cf6', textColor: '#f5f3ff' };
  }
  if (percentage >= 50) {
    return { title: '🎯 ĐẠT CHUẨN (CẦN TĂNG TỐC)', badgeColor: '#f59e0b', textColor: '#fffbeb' };
  }
  return { title: '📚 CẦN CỐ GẮNG (LUYỆN TẬP THÊM)', badgeColor: '#ef4444', textColor: '#fef2f2' };
}

/**
 * Generate 1200 x 630 px OpenGraph Canvas
 */
export function generateScoreCardCanvas(
  exam: Exam,
  attempt: ExamAttempt,
  report: ExamAnalyticsReport,
  candidateName = 'Thí sinh tự do'
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 1200;
  canvas.height = 630;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  const w = 1200;
  const h = 630;

  // 1. Deep Space Tech Gradient Background
  const bgGrad = ctx.createLinearGradient(0, 0, w, h);
  bgGrad.addColorStop(0, '#090d16');
  bgGrad.addColorStop(0.5, '#0f172a');
  bgGrad.addColorStop(1, '#1e1b4b');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, w, h);

  // 2. Ambient Cyber Accent Glows
  const glow1 = ctx.createRadialGradient(180, 140, 10, 180, 140, 320);
  glow1.addColorStop(0, 'rgba(6, 182, 212, 0.22)');
  glow1.addColorStop(1, 'rgba(6, 182, 212, 0)');
  ctx.fillStyle = glow1;
  ctx.fillRect(0, 0, w, h);

  const glow2 = ctx.createRadialGradient(1020, 480, 10, 1020, 480, 360);
  glow2.addColorStop(0, 'rgba(168, 85, 247, 0.20)');
  glow2.addColorStop(1, 'rgba(168, 85, 247, 0)');
  ctx.fillStyle = glow2;
  ctx.fillRect(0, 0, w, h);

  // 3. Subtle Technology Grid Lines
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.035)';
  ctx.lineWidth = 1;
  const gridSize = 40;
  for (let x = gridSize; x < w; x += gridSize) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }
  for (let y = gridSize; y < h; y += gridSize) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }

  // 4. Glowing Double Rounded Borders
  ctx.save();
  const borderMargin = 28;
  const innerRadius = 24;
  ctx.strokeStyle = 'rgba(6, 182, 212, 0.45)';
  ctx.lineWidth = 2.5;
  drawRoundedRect(ctx, borderMargin, borderMargin, w - borderMargin * 2, h - borderMargin * 2, innerRadius);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(168, 85, 247, 0.35)';
  ctx.lineWidth = 1;
  drawRoundedRect(ctx, borderMargin + 8, borderMargin + 8, w - (borderMargin + 8) * 2, h - (borderMargin + 8) * 2, innerRadius - 4);
  ctx.stroke();
  ctx.restore();

  // 5. Header Branding
  ctx.save();
  // Logo & Title
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 34px "Nunito", "Segoe UI", sans-serif';
  ctx.fillText('OmniQuiz PRO', 70, 95);

  // Badge CBT STUDIO 2.0
  const badgeX = 350;
  const badgeY = 66;
  const badgeW = 150;
  const badgeH = 36;
  ctx.fillStyle = 'rgba(99, 102, 241, 0.25)';
  drawRoundedRect(ctx, badgeX, badgeY, badgeW, badgeH, 18);
  ctx.fill();
  ctx.strokeStyle = '#06b6d4';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 15px "JetBrains Mono", monospace';
  ctx.fillText('CBT STUDIO 2.0', badgeX + 16, badgeY + 23);

  // Subtitle
  ctx.fillStyle = '#94a3b8';
  ctx.font = '600 16px "Nunito", "Segoe UI", sans-serif';
  ctx.fillText('CHỨNG NHẬN KẾT QUẢ KHẢO THÍ CHUẨN HÓA TRỰC TUYẾN', 70, 130);

  // Verified Badge (top right)
  const verifyText = '✓ VERIFIED RESULT';
  ctx.fillStyle = 'rgba(16, 185, 129, 0.15)';
  drawRoundedRect(ctx, 920, 68, 200, 36, 18);
  ctx.fill();
  ctx.strokeStyle = 'rgba(16, 185, 129, 0.5)';
  ctx.stroke();
  ctx.fillStyle = '#10b981';
  ctx.font = 'bold 14px "JetBrains Mono", monospace';
  ctx.fillText(verifyText, 946, 91);
  ctx.restore();

  // 6. Candidate Information Block
  ctx.save();
  ctx.fillStyle = '#64748b';
  ctx.font = '600 15px "Nunito", "Segoe UI", sans-serif';
  ctx.fillText('THÍ SINH THỰC HIỆN', 70, 185);

  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 36px "Nunito", "Segoe UI", sans-serif';
  ctx.fillText(candidateName, 70, 230);

  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 22px "Nunito", "Segoe UI", sans-serif';
  const examTitle = exam.title.length > 44 ? `${exam.title.substring(0, 42)}...` : exam.title;
  ctx.fillText(examTitle, 70, 275);

  const dateStr = new Date().toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  ctx.fillStyle = '#94a3b8';
  ctx.font = '500 16px "Nunito", "Segoe UI", sans-serif';
  ctx.fillText(`Thời điểm khảo thí: ${dateStr}`, 70, 310);
  ctx.restore();

  // 7. Exam Metrics Stats Grid (Left-Center)
  const statsStartX = 70;
  const statsStartY = 350;
  const statBoxW = 160;
  const statBoxH = 90;
  const statGap = 16;

  const stats = [
    { label: 'SỐ CÂU ĐÚNG', val: `${report.correctCount} / ${report.totalQuestions}`, color: '#10b981' },
    { label: 'CHÍNH XÁC', val: `${report.scorePercentage}%`, color: '#38bdf8' },
    {
      label: 'THỜI GIAN',
      val: formatDurationMinutes(report.totalTimeSpentSeconds),
      color: '#f59e0b',
    },
    {
      label: 'TỐC ĐỘ TB',
      val: report.averageTimePerQuestion > 0 ? `${report.averageTimePerQuestion}s/câu` : '--',
      color: '#a855f7',
    },
  ];

  stats.forEach((s, idx) => {
    const boxX = statsStartX + idx * (statBoxW + statGap);
    ctx.save();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.7)';
    drawRoundedRect(ctx, boxX, statsStartY, statBoxW, statBoxH, 14);
    ctx.fill();
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.2)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = '#94a3b8';
    ctx.font = 'bold 12px "JetBrains Mono", monospace';
    ctx.fillText(s.label, boxX + 16, statsStartY + 28);

    ctx.fillStyle = s.color;
    ctx.font = 'bold 22px "Nunito", "Segoe UI", sans-serif';
    ctx.fillText(s.val, boxX + 16, statsStartY + 64);
    ctx.restore();
  });

  // 8. Right Column: Highlight Score Card
  ctx.save();
  const cardX = 800;
  const cardY = 170;
  const cardW = 320;
  const cardH = 340;

  // Background Glass Card
  ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
  drawRoundedRect(ctx, cardX, cardY, cardW, cardH, 22);
  ctx.fill();
  ctx.strokeStyle = 'rgba(6, 182, 212, 0.4)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Card Header
  ctx.fillStyle = '#94a3b8';
  ctx.font = 'bold 15px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.fillText('ĐIỂM SỐ CHÍNH THỨC', cardX + cardW / 2, cardY + 45);

  // Big Score Display
  const score10 = ((report.scorePercentage / 100) * 10).toFixed(1);
  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 82px "Fredoka", "Nunito", sans-serif';
  ctx.fillText(score10, cardX + cardW / 2, cardY + 145);

  ctx.fillStyle = '#64748b';
  ctx.font = 'bold 22px "Nunito", sans-serif';
  ctx.fillText('/ 10.0', cardX + cardW / 2, cardY + 185);

  // Percentage
  ctx.fillStyle = '#e2e8f0';
  ctx.font = '600 18px "Nunito", sans-serif';
  ctx.fillText(`(Đạt chuẩn ${report.scorePercentage}%)`, cardX + cardW / 2, cardY + 225);

  // Rank Pill
  const rank = getRankBadge(report.scorePercentage);
  const pillW = 270;
  const pillH = 44;
  const pillX = cardX + (cardW - pillW) / 2;
  const pillY = cardY + 258;

  ctx.fillStyle = rank.badgeColor;
  drawRoundedRect(ctx, pillX, pillY, pillW, pillH, 22);
  ctx.fill();

  ctx.fillStyle = rank.textColor;
  ctx.font = 'bold 14px "Nunito", "Segoe UI", sans-serif';
  ctx.fillText(rank.title, cardX + cardW / 2, pillY + 27);
  ctx.restore();

  // 9. Footer Watermark & Link
  ctx.save();
  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 16px "Nunito", "Segoe UI", sans-serif';
  ctx.fillText('🌐 Thi thử trực tuyến tại: omni-quiz-harilowji.vercel.app', 70, 560);

  const certId = `CERT-CBT-${(attempt?.id || Date.now().toString(36)).toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`;
  ctx.fillStyle = '#64748b';
  ctx.font = '500 14px "JetBrains Mono", monospace';
  ctx.textAlign = 'right';
  ctx.fillText(`Mã bảo mật: ${certId}`, 1120, 560);
  ctx.restore();

  return canvas;
}

/**
 * Format duration in minutes and seconds
 */
function formatDurationMinutes(seconds: number): string {
  if (seconds <= 0) return '00:00';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

/**
 * Draw a rounded rectangle on a 2D canvas context
 */
function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
): void {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

/**
 * Convert Canvas to PNG Blob
 */
export function exportScoreCardBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error('Không thể xuất ảnh thẻ điểm từ Canvas.'));
      }
    }, 'image/png');
  });
}

/**
 * Generate, download or native share the viral score card
 */
export async function downloadScoreCard(
  exam: Exam,
  attempt: ExamAttempt,
  report: ExamAnalyticsReport,
  candidateName = 'Thí sinh tự do'
): Promise<void> {
  const canvas = generateScoreCardCanvas(exam, attempt, report, candidateName);
  const blob = await exportScoreCardBlob(canvas);

  const safeSubject = (exam.subject || 'Exam')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '_');
  const dateStr = new Date().toISOString().slice(0, 10);
  const filename = `OmniQuiz_Certificate_${safeSubject}_${dateStr}.png`;

  // 1. Try Native Web Share API (mobile phones, tablets)
  if (typeof navigator !== 'undefined' && 'share' in navigator && typeof File !== 'undefined') {
    try {
      const file = new File([blob], filename, { type: 'image/png' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: `Chứng nhận kết quả ${exam.title} - OmniQuiz PRO`,
          text: `Tôi vừa đạt ${report.scorePercentage}% bài thi ${exam.title} trên OmniQuiz PRO! Thử sức ngay!`,
          files: [file],
        });
        return;
      }
    } catch (err: unknown) {
      if ((err as Error)?.name === 'AbortError') {
        return; // User canceled share sheet
      }
    }
  }

  // 2. Fallback: Trigger standard browser file download
  const downloadUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = downloadUrl;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);

  setTimeout(() => {
    URL.revokeObjectURL(downloadUrl);
  }, 2000);
}
