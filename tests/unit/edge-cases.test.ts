/**
 * @vitest-environment jsdom
 * tests/unit/edge-cases.test.ts
 * Zero-Defect Polish Audit: Calculation edge cases, NaN prevention, OTP input filtering, and unlimited timer.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { analyticsService } from '../../src/features/analytics/analytics-service';
import { ExamStateMachine } from '../../src/features/exam-engine/exam-state-machine';
import { localDB } from '../../src/shared/db/dexie-db';
import { LobbyView } from '../../src/features/lobby/lobby-view';
import type { Exam, ExamAttempt } from '../../src/shared/types';

describe('Group 1: Calculation Edge Cases & NaN/Undefined Defense', () => {
  it('should return 0% and 0s pacing without NaN when totalQuestions is 0', () => {
    const emptyExam: Exam = {
      id: 'empty_exam',
      title: 'Đề rỗng',
      subject: 'Toán',
      durationMinutes: 30,
      totalQuestions: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      questions: [],
    };

    const attempt: ExamAttempt = {
      id: 'attempt_empty',
      examId: 'empty_exam',
      examTitle: 'Đề rỗng',
      mode: 'exam',
      startedAt: Date.now() - 60000,
      timeRemainingSeconds: 1800,
      totalDurationSeconds: 1800,
      answers: {},
      flaggedQuestions: [],
      violations: [],
      timeSpentPerQuestion: {},
      isCompleted: true,
    };

    const report = analyticsService.generateReport(emptyExam, attempt);

    expect(report.totalQuestions).toBe(0);
    expect(report.scorePercentage).toBe(0);
    expect(Number.isNaN(report.scorePercentage)).toBe(false);
    expect(report.averageTimePerQuestion).toBe(0);
    expect(Number.isNaN(report.averageTimePerQuestion)).toBe(false);
  });

  it('should support unlimited duration mode (durationMinutes = 0) with count-up timer and no auto-submit', async () => {
    vi.useFakeTimers();
    vi.spyOn(localDB, 'saveActiveSession').mockResolvedValue(undefined as unknown as string);

    const fsm = new ExamStateMachine();
    const unlimitedExam: Exam = {
      id: 'unlimited_exam',
      title: 'Đề không giới hạn thời gian',
      subject: 'Tiếng Anh',
      durationMinutes: 0, // Unlimited
      totalQuestions: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      questions: [
        {
          id: 'q1',
          index: 1,
          text: 'Question 1',
          type: 'single',
          options: ['A', 'B'],
          correctAnswer: [0],
        },
      ],
    };

    let reportedSeconds = -1;
    let reportedWarning = true;
    let reportedUnlimited = false;

    await fsm.startSession(unlimitedExam, 'exam', {
      onStateChange: () => {},
      onTimerTick: (secs, isWarning, isUnlimited) => {
        reportedSeconds = secs;
        reportedWarning = isWarning;
        reportedUnlimited = Boolean(isUnlimited);
      },
      onAnswerChange: () => {},
      onAutoSaved: () => {},
      onExamSubmitted: () => {},
    });

    // Advance time by 3 seconds
    vi.advanceTimersByTime(3000);

    expect(reportedUnlimited).toBe(true);
    expect(reportedWarning).toBe(false);
    expect(reportedSeconds).toBeGreaterThanOrEqual(2);

    // Ensure session is still running and NOT auto-submitted
    expect(fsm.isRunning()).toBe(true);
    expect(fsm.isSubmitted()).toBe(false);

    fsm.reset();
    vi.useRealTimers();
  });
});

describe('Group 2: Discrete OTP PIN Input Defense & Paste Cleaning', () => {
  let lobby: LobbyView;

  beforeEach(() => {
    document.body.innerHTML = `
      <div id="upload-section">
        <div id="dropzone-area"></div>
        <input type="file" id="file-input" />
        <select id="sample-subject-select"></select>
        <button id="btn-load-sample"></button>
        <div id="otp-inputs-wrap">
          <input type="text" class="otp-digit" data-index="0" maxlength="1" />
          <input type="text" class="otp-digit" data-index="1" maxlength="1" />
          <input type="text" class="otp-digit" data-index="2" maxlength="1" />
          <input type="text" class="otp-digit" data-index="3" maxlength="1" />
          <input type="text" class="otp-digit" data-index="4" maxlength="1" />
          <input type="text" class="otp-digit" data-index="5" maxlength="1" />
        </div>
        <input type="hidden" id="input-join-pin" />
        <input type="text" id="input-join-name" />
        <input type="text" id="input-join-sbd" />
        <button id="btn-join-room"></button>
      </div>
    `;

    lobby = new LobbyView();
    lobby.init({
      onFileSelected: () => {},
      onSampleSelected: () => {},
      onJoinRoom: () => {},
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should block non-numeric characters on typing into OTP inputs', () => {
    const otpDigits = document.querySelectorAll<HTMLInputElement>('.otp-digit');
    const firstDigit = otpDigits[0];

    // Simulate typing a letter 'A'
    firstDigit.value = 'A';
    firstDigit.dispatchEvent(new Event('input', { bubbles: true }));

    // Non-digits are stripped, value must be empty
    expect(firstDigit.value).toBe('');

    // Simulate typing a valid digit '7'
    firstDigit.value = '7';
    firstDigit.dispatchEvent(new Event('input', { bubbles: true }));

    expect(firstDigit.value).toBe('7');
  });

  it('should clean pasted strings with spaces, dashes, or letters into exactly 6 digits', () => {
    const otpDigits = document.querySelectorAll<HTMLInputElement>('.otp-digit');
    const legacyPin = document.getElementById('input-join-pin') as HTMLInputElement;

    // Paste dirty PIN '849-201 '
    const pasteEvent = new Event('paste', { bubbles: true }) as any;
    pasteEvent.clipboardData = {
      getData: (format: string) => (format === 'text' ? '  849 - 201  ' : ''),
    };

    otpDigits[0].dispatchEvent(pasteEvent);

    expect(otpDigits[0].value).toBe('8');
    expect(otpDigits[1].value).toBe('4');
    expect(otpDigits[2].value).toBe('9');
    expect(otpDigits[3].value).toBe('2');
    expect(otpDigits[4].value).toBe('0');
    expect(otpDigits[5].value).toBe('1');
    expect(legacyPin.value).toBe('849201');
  });
});
