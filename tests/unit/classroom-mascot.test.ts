/**
 * @vitest-environment jsdom
 * tests/unit/classroom-mascot.test.ts
 * Tests Classroom Manager (PIN, QR matrix, CSV with UTF-8 BOM) and Anime Mascot / AI Sensei.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { classroomManager } from '../../src/features/classroom/classroom-manager';
import { animeMascot } from '../../src/features/mascot/anime-mascot';
import { offlineSyncQueue } from '../../src/shared/db/offline-queue';
import { omniQuizDb } from '../../src/shared/db/dexie-db';

const mockStorage: Record<string, string> = {};
const mockLocalStorage = {
  getItem: (key: string) => mockStorage[key] ?? null,
  setItem: (key: string, val: string) => { mockStorage[key] = String(val); },
  removeItem: (key: string) => { delete mockStorage[key]; },
  clear: () => {
    for (const k of Object.keys(mockStorage)) delete mockStorage[k];
  },
};

Object.defineProperty(globalThis, 'localStorage', {
  value: mockLocalStorage,
  writable: true,
  configurable: true,
});

describe('ClassroomManager & Live Proctoring Unit Tests', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('generates a valid 6-digit numeric room PIN', () => {
    const pin = classroomManager.generateRoomCode();
    expect(pin).toMatch(/^\d{6}$/);
    expect(pin.length).toBe(6);
  });

  it('renders native Canvas QR code without error', () => {
    const canvas = document.createElement('canvas');
    classroomManager.renderQrToCanvas(canvas, 'https://omni-quiz.app/?pin=849201', 200);

    expect(canvas.width).toBe(200);
    expect(canvas.height).toBe(200);
    const ctx = canvas.getContext('2d');
    expect(ctx).toBeDefined();
  });

  it('exports results to CSV with UTF-8 BOM (\\uFEFF) for Excel compatibility', () => {
    let capturedBlob: Blob | null = null;
    let downloadedFilename = '';

    globalThis.URL.createObjectURL = vi.fn((blob: Blob) => {
      capturedBlob = blob;
      return 'blob:mock-url';
    });
    globalThis.URL.revokeObjectURL = vi.fn();

    const origCreateElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      const el = origCreateElement(tagName);
      if (tagName === 'a') {
        Object.defineProperty(el, 'click', {
          value: function () {
            downloadedFilename = (this as HTMLAnchorElement).download;
          },
        });
      }
      return el;
    });

    (classroomManager as any).studentsMap.set('student_1', {
      studentId: 'student_1',
      studentName: 'Nguyễn Văn A',
      candidateSbd: 'SBD001',
      currentQuestion: 10,
      answeredCount: 10,
      totalQuestions: 10,
      tabSwitches: 0,
      status: 'submitted',
      score: 9.5,
      submittedAt: '2026-10-20 23:30',
      lastActive: Date.now(),
    });

    classroomManager.exportResultsToCsv('849201');

    expect(downloadedFilename).toContain('849201');
    expect(downloadedFilename).toContain('.csv');
    expect(capturedBlob).not.toBeNull();
  });
});

describe('Anime Mascot & AI Sensei Unit Tests', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    animeMascot.init();
  });

  it('can enable and disable mascot via settings toggle', () => {
    animeMascot.setEnabled(false);
    expect(animeMascot.isEnabled()).toBe(false);
    const widget = document.getElementById('anime-mascot-widget');
    expect(widget?.style.display).toBe('none');

    animeMascot.setEnabled(true);
    expect(animeMascot.isEnabled()).toBe(true);
    expect(widget?.style.display).toBe('block');
  });

  it('displays contextual wrong-answer explanation with Deep Explain and Variant buttons', () => {
    animeMascot.setEnabled(true);
    let deepClicked = false;
    let variantClicked = false;

    animeMascot.explainWrongAnswer(
      'Phương trình bậc hai ax^2 + bx + c = 0',
      'x = 1',
      'Áp dụng biệt thức Delta = b^2 - 4ac để xác định số nghiệm.',
      () => { deepClicked = true; },
      () => { variantClicked = true; }
    );

    const bubble = document.getElementById('mascot-speech-bubble');
    expect(bubble?.style.display).toBe('block');

    const btnDeep = document.getElementById('btn-mascot-deep');
    const btnVariant = document.getElementById('btn-mascot-variant');
    expect(btnDeep).toBeDefined();
    expect(btnVariant).toBeDefined();

    btnDeep?.click();
    expect(deepClicked).toBe(true);

    btnVariant?.click();
    expect(variantClicked).toBe(true);
  });
});

describe('Offline Sync Queue Unit Tests', () => {
  it('enqueues pending offline operations successfully', async () => {
    vi.spyOn(omniQuizDb, 'enqueuePendingSync').mockResolvedValueOnce('sync_test_123');

    const taskId = await offlineSyncQueue.enqueue('profile', {
      id: 'mock-user-123',
      exp: 450,
      level: 3,
      streakDays: 5,
    });
    expect(taskId).toBe('sync_test_123');
  });
});
