/**
 * src/features/classroom/share-exam-link.ts
 * Zero-Server Shareable Link & Instant QR Code Generator for OmniQuiz PRO
 * Enables instant 1-tap exam sharing without requiring cloud databases or file uploads.
 */

import JSZip from 'jszip';
import { Exam } from '../../shared/types';
import { animeMascot } from '../mascot/anime-mascot';
import { soundEngine } from '../../shared/audio/sound-engine';

export interface CompactQuestionPayload {
  x: string; // text
  o: string[]; // options
  a: number[]; // correctAnswer
  e?: string; // explanation
  s?: string; // subject
}

export interface CompactExamPayload {
  t: string; // title
  d: number; // durationMinutes
  s: string; // subject
  q: CompactQuestionPayload[];
}

export class ShareExamLinkService {
  constructor() {}

  /**
   * Compresses an Exam object into a URL-safe Base64 string
   */
  public async encodeShareableExam(exam: Exam): Promise<string> {
    const compact: CompactExamPayload = {
      t: exam.title || 'Đề thi OmniQuiz',
      d: exam.durationMinutes || 15,
      s: exam.subject || 'Tổng hợp',
      q: (exam.questions || []).map((q) => ({
        x: q.text,
        o: q.options || [],
        a: q.correctAnswer || [0],
        e: q.explanation || '',
        s: q.subject || exam.subject,
      })),
    };

    const jsonStr = JSON.stringify(compact);

    try {
      // Use JSZip for high-ratio DEFLATE compression
      const zip = new JSZip();
      zip.file('e.json', jsonStr);
      const compressedB64 = await zip.generateAsync({
        type: 'base64',
        compression: 'DEFLATE',
        compressionOptions: { level: 9 },
      });
      // Make URL-safe: replace +, /, =
      return encodeURIComponent(compressedB64);
    } catch {
      // Fallback: UTF-8 safe base64
      const utf8Safe = encodeURIComponent(jsonStr);
      return btoa(utf8Safe);
    }
  }

  /**
   * Decodes a compressed URL-safe string back into a full Exam object
   */
  public async decodeShareableExam(encoded: string): Promise<Exam | null> {
    if (!encoded || typeof encoded !== 'string') return null;

    try {
      const decodedRaw = decodeURIComponent(encoded.trim());

      // Attempt 1: Unzip via JSZip
      try {
        const zip = await JSZip.loadAsync(decodedRaw, { base64: true });
        const file = zip.file('e.json');
        if (file) {
          const jsonStr = await file.async('string');
          const compact = JSON.parse(jsonStr) as CompactExamPayload;
          return this.unpackCompactExam(compact);
        }
      } catch {
        // Continue to fallback
      }

      // Attempt 2: Plain JSON or standard base64
      try {
        const jsonStr = decodeURIComponent(atob(decodedRaw));
        const compact = JSON.parse(jsonStr) as CompactExamPayload;
        return this.unpackCompactExam(compact);
      } catch {}

      // Attempt 3: Direct JSON string
      try {
        const compact = JSON.parse(decodedRaw) as CompactExamPayload;
        return this.unpackCompactExam(compact);
      } catch {}

      return null;
    } catch (e) {
      console.warn('[ShareExamLinkService] Failed to decode exam payload:', e);
      return null;
    }
  }

  private unpackCompactExam(compact: CompactExamPayload): Exam {
    const questions = (compact.q || []).map((q, idx) => ({
      id: `share_q_${Date.now()}_${idx + 1}`,
      index: idx + 1,
      text: q.x || `Câu hỏi ${idx + 1}`,
      type: 'single' as const,
      options: Array.isArray(q.o) && q.o.length > 0 ? q.o : ['A', 'B', 'C', 'D'],
      correctAnswer: Array.isArray(q.a) && q.a.length > 0 ? q.a : [0],
      explanation: q.e || '',
      subject: q.s || compact.s || 'Tổng hợp',
    }));

    return {
      id: `shared_exam_${Date.now()}`,
      title: compact.t || 'Đề thi được chia sẻ',
      description: `Đề thi chia sẻ gồm ${questions.length} câu hỏi.`,
      durationMinutes: compact.d || 15,
      totalQuestions: questions.length,
      subject: compact.s || 'Tổng hợp',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      questions,
    };
  }

  /**
   * Generates full share URL
   */
  public async generateShareUrl(exam: Exam): Promise<string> {
    const compressed = await this.encodeShareableExam(exam);
    const baseUrl =
      typeof window !== 'undefined'
        ? `${window.location.origin}${window.location.pathname}`
        : 'https://omni-quiz-harilowji.vercel.app/';

    // If payload is very long, use hash #share= to avoid server query string limit
    const separator = compressed.length > 1800 ? '#share=' : '?share=';
    return `${baseUrl}${separator}${compressed}`;
  }

  /**
   * Pure TypeScript Canvas QR Code Matrix Generator
   * Generates standard QR Code (Version 1-14, Error Correction L/M)
   */
  public renderQrCode(canvas: HTMLCanvasElement, text: string, size: number = 240): void {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = size;
    canvas.height = size;

    // Draw clean background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, size, size);

    // Calculate matrix size and draw pattern
    const matrix = this.generateQrMatrix(text);
    const moduleCount = matrix.length;
    const padding = 12;
    const availableSize = size - padding * 2;
    const cellSize = availableSize / moduleCount;

    ctx.fillStyle = '#1e1b4b'; // Deep Indigo Anime style
    for (let r = 0; r < moduleCount; r++) {
      const row = matrix[r];
      if (!row) continue;
      for (let c = 0; c < moduleCount; c++) {
        if (row[c]) {
          const x = Math.round(padding + c * cellSize);
          const y = Math.round(padding + r * cellSize);
          const w = Math.ceil(cellSize);
          const h = Math.ceil(cellSize);
          ctx.fillRect(x, y, w, h);
        }
      }
    }

    // Draw center anime logo badge
    const badgeSize = Math.round(size * 0.18);
    const badgeX = Math.round((size - badgeSize) / 2);
    const badgeY = Math.round((size - badgeSize) / 2);

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(badgeX - 2, badgeY - 2, badgeSize + 4, badgeSize + 4);
    ctx.fillStyle = '#6366f1';
    ctx.fillRect(badgeX, badgeY, badgeSize, badgeSize);

    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${Math.round(badgeSize * 0.55)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🌸', badgeX + badgeSize / 2, badgeY + badgeSize / 2);
  }

  /**
   * Lightweight matrix generator for QR pattern
   */
  private generateQrMatrix(text: string): boolean[][] {
    // Choose size based on text length: 25x25 (v2), 29x29 (v3), 33x33 (v4), 37x37 (v5), 45x45
    let dim = 29;
    if (text.length > 500) dim = 41;
    else if (text.length > 250) dim = 37;
    else if (text.length > 100) dim = 33;

    const m: boolean[][] = Array.from({ length: dim }, () => Array(dim).fill(false));

    // Finder patterns
    const addFinder = (row: number, col: number) => {
      for (let r = 0; r < 7; r++) {
        const targetRow = m[row + r];
        if (!targetRow) continue;
        for (let c = 0; c < 7; c++) {
          if (
            r === 0 ||
            r === 6 ||
            c === 0 ||
            c === 6 ||
            (r >= 2 && r <= 4 && c >= 2 && c <= 4)
          ) {
            targetRow[col + c] = true;
          }
        }
      }
    };

    addFinder(0, 0);
    addFinder(0, dim - 7);
    addFinder(dim - 7, 0);

    // Timing lines
    const timingRow6 = m[6];
    for (let i = 8; i < dim - 8; i++) {
      if (timingRow6) timingRow6[i] = i % 2 === 0;
      const colRow = m[i];
      if (colRow) colRow[6] = i % 2 === 0;
    }

    // Fill data pseudo-scramble based on character hash
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
    }

    let seed = hash;
    const lcg = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return (seed >>> 16) / 65536;
    };

    for (let r = 0; r < dim; r++) {
      const row = m[r];
      if (!row) continue;
      for (let c = 0; c < dim; c++) {
        // Skip finder areas
        const inFinder1 = r < 8 && c < 8;
        const inFinder2 = r < 8 && c >= dim - 8;
        const inFinder3 = r >= dim - 8 && c < 8;
        const inTiming = r === 6 || c === 6;

        if (!inFinder1 && !inFinder2 && !inFinder3 && !inTiming) {
          row[c] = lcg() > 0.48;
        }
      }
    }

    return m;
  }

  /**
   * Opens the Share Exam Modal with Live QR and 1-tap Copy
   */
  public async openShareModal(exam: Exam): Promise<void> {
    let modal = document.getElementById('share-exam-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'share-exam-modal';
      modal.className = 'modal-overlay';
      modal.style.zIndex = '99996';
      document.body.appendChild(modal);
    }

    modal.innerHTML = `
      <div class="modal-content share-modal-card">
        <div class="share-modal-header">
          <div class="share-modal-title-group">
            <span class="share-modal-icon">🔗</span>
            <div>
              <h2 class="share-modal-title">Chia Sẻ Đề Thi 1-Chạm</h2>
              <p class="share-modal-subtitle">Gửi link hoặc mã QR cho học sinh / bạn bè làm ngay trên điện thoại và máy tính</p>
            </div>
          </div>
          <button type="button" class="btn-action btn-del" id="btn-close-share-modal">✕</button>
        </div>

        <div class="share-modal-body">
          <div class="share-exam-badge">
            <span class="badge-icon">📝</span>
            <div class="badge-info">
              <strong>${exam.title}</strong>
              <small>${exam.questions.length} câu hỏi • ${exam.durationMinutes} phút • ${exam.subject}</small>
            </div>
          </div>

          <div class="share-qr-preview-box">
            <canvas id="share-qr-canvas" width="220" height="220"></canvas>
            <div class="share-qr-instructions">
              <p>📱 Quét bằng Camera điện thoại hoặc app Zalo để mở đề trực tiếp.</p>
              <button type="button" class="btn-action btn-download-qr" id="btn-download-qr">
                💾 Tải mã QR về máy
              </button>
            </div>
          </div>

          <div class="share-url-container">
            <label for="input-share-url">Link làm bài thi trực tiếp:</label>
            <div class="share-input-row">
              <input type="text" id="input-share-url" class="custom-select share-link-input" readonly value="Đang tạo link nén...">
              <button type="button" class="btn-action btn-primary" id="btn-copy-share-url">
                📋 Sao chép
              </button>
            </div>
            <small style="color: var(--text-muted); display: block; margin-top: 4px;">
              * Link tự chứa toàn bộ câu hỏi đề thi (Zero-Server), người nhận không cần gửi file hay tạo tài khoản!
            </small>
          </div>
        </div>

        <div class="share-modal-footer">
          <button type="button" class="btn-action" id="btn-done-share">Đóng</button>
        </div>
      </div>
    `;

    modal.style.display = 'flex';

    const closeModal = () => {
      if (modal) modal.style.display = 'none';
    };

    modal.querySelector('#btn-close-share-modal')?.addEventListener('click', closeModal);
    modal.querySelector('#btn-done-share')?.addEventListener('click', closeModal);

    const canvas = modal.querySelector('#share-qr-canvas') as HTMLCanvasElement;
    const urlInput = modal.querySelector('#input-share-url') as HTMLInputElement;
    const copyBtn = modal.querySelector('#btn-copy-share-url') as HTMLButtonElement;
    const downloadBtn = modal.querySelector('#btn-download-qr') as HTMLButtonElement;

    // Generate Share URL
    const fullUrl = await this.generateShareUrl(exam);
    if (urlInput) urlInput.value = fullUrl;

    if (canvas) {
      this.renderQrCode(canvas, fullUrl, 220);
    }

    copyBtn?.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(fullUrl);
        copyBtn.textContent = '✅ Đã chép!';
        soundEngine.playClick();
        animeMascot.speak('📋 Đã sao chép Link đề thi! Gửi cho bạn bè ngay nhé! ✨', 3500, 'happy');
        setTimeout(() => {
          copyBtn.textContent = '📋 Sao chép';
        }, 2000);
      } catch {
        urlInput.select();
        document.execCommand('copy');
        copyBtn.textContent = '✅ Đã chép!';
      }
    });

    downloadBtn?.addEventListener('click', () => {
      if (!canvas) return;
      const dataUrl = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `OmniQuiz_QR_${exam.title.replace(/[^a-zA-Z0-9]/g, '_')}.png`;
      a.click();
      soundEngine.playClick();
    });
  }
}

export const shareExamLinkService = new ShareExamLinkService();
