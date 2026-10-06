/**
 * src/features/parser/document-parser.ts - Main Thread Client for Document Parsing
 * Spawns Web Worker, manages progress, handles Blob generation, and falls back gracefully.
 */

import type { ParserWorkerPayload, ParserWorkerResult, Exam } from '../../shared/types';
import { tokenizeExamDocument } from '../../../workers/document-parser.worker';

export class DocumentParserService {
  private worker: Worker | null = null;

  constructor() {
    this.initWorker();
  }

  private initWorker(): void {
    if (typeof window !== 'undefined' && typeof Worker !== 'undefined') {
      try {
        this.worker = new Worker(new URL('../../../workers/document-parser.worker.ts', import.meta.url), {
          type: 'module',
        });
      } catch (err) {
        console.warn('[Parser Worker Spawn Warning] Running in main-thread mode:', err);
        this.worker = null;
      }
    }
  }

  /**
   * Parse uploaded File (PDF, DOCX, TXT) asynchronously
   */
  async parseFile(
    file: File,
    subjectHint?: string,
    onProgress?: (percent: number, status: string) => void
  ): Promise<Exam> {
    onProgress?.(15, `Đang đọc nội dung tệp ${file.name}...`);
    const fileBuffer = await file.arrayBuffer();

    onProgress?.(40, `Bắt đầu phân tích cấu trúc câu hỏi (${file.name})...`);

    let result: ParserWorkerResult;

    if (this.worker) {
      result = await new Promise<ParserWorkerResult>((resolve, reject) => {
        if (!this.worker) return reject(new Error('Worker không khả dụng'));

        const timeout = setTimeout(() => {
          reject(new Error('Quá thời gian bóc tách tài liệu (30s)'));
        }, 30000);

        this.worker.onmessage = (e: MessageEvent<ParserWorkerResult>) => {
          clearTimeout(timeout);
          resolve(e.data);
        };

        this.worker.onerror = (err) => {
          clearTimeout(timeout);
          reject(err);
        };

        const payload: ParserWorkerPayload = {
          fileBuffer,
          fileName: file.name,
          fileType: 'auto',
          subjectHint,
        };

        this.worker.postMessage(payload, [fileBuffer]);
      });
    } else {
      // Main-thread fallback for text files
      const decoder = new TextDecoder('utf-8');
      const text = decoder.decode(fileBuffer);
      const parsed = tokenizeExamDocument(text, file.name, subjectHint);
      result = {
        success: true,
        ...parsed,
      };
    }

    if (!result.success || result.questions.length === 0) {
      throw new Error(result.error || 'Không thể nhận diện câu hỏi từ tài liệu đã chọn.');
    }

    onProgress?.(90, `Đã hoàn tất phân tích ${result.questions.length} câu hỏi!`);

    const now = new Date().toISOString();
    const exam: Exam = {
      id: `exam_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      title: result.examTitle,
      description: result.description || `Đề thi gồm ${result.questions.length} câu hỏi`,
      subject: subjectHint || 'Tổng hợp',
      durationMinutes: result.durationMinutes || Math.max(15, result.questions.length * 2),
      totalQuestions: result.questions.length,
      createdAt: now,
      updatedAt: now,
      questions: result.questions,
    };

    onProgress?.(100, 'Tải tài liệu hoàn tất!');
    return exam;
  }
}

export const documentParserService = new DocumentParserService();
