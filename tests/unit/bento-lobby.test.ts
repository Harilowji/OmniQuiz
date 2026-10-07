/**
 * @vitest-environment jsdom
 * tests/unit/bento-lobby.test.ts
 * Unit tests for Bento Grid Lobby, 6-digit discrete OTP PIN Room entry, and Exam Shuffling.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LobbyView } from '../../src/features/lobby/lobby-view';
import { shuffleExam } from '../../src/features/exam-engine/exam-shuffle';
import type { Exam } from '../../src/shared/types';

describe('Bento Grid Lobby & 6-Digit OTP Room Entry', () => {
  let lobby: LobbyView;
  let mockContainer: HTMLElement;

  beforeEach(() => {
    // Setup clean mock DOM for Bento Lobby & OTP inputs
    document.body.innerHTML = `
      <div id="upload-section">
        <div id="dropzone-area"></div>
        <input type="file" id="file-input" />
        <select id="sample-subject-select">
          <option value="math_50">Toán 50</option>
          <option value="chem_12">Hóa 12</option>
        </select>
        <button id="btn-load-sample">Load</button>
        <button class="subj-pill" data-subj="math_50">Toán</button>
        <button class="subj-pill" data-subj="chem_12">Hóa</button>

        <!-- 6 Discrete OTP Inputs -->
        <div class="otp-inputs-row">
          <input type="text" class="otp-digit" maxlength="1" data-index="0" />
          <input type="text" class="otp-digit" maxlength="1" data-index="1" />
          <input type="text" class="otp-digit" maxlength="1" data-index="2" />
          <input type="text" class="otp-digit" maxlength="1" data-index="3" />
          <input type="text" class="otp-digit" maxlength="1" data-index="4" />
          <input type="text" class="otp-digit" maxlength="1" data-index="5" />
        </div>
        <input type="hidden" id="input-join-pin" />
        <input type="text" id="input-join-name" value="Thí sinh A" />
        <input type="text" id="input-join-sbd" value="SBD001" />
        <button id="btn-join-room">Tham gia</button>

        <div id="sample-gallery-modal" style="display: none;">
          <button id="btn-close-gallery-modal">X</button>
          <div id="gallery-cards-grid">
            <div class="gallery-item-card" data-bank="chem_12">
              <button class="btn-select-gallery-exam" data-bank-key="chem_12">Chọn đề</button>
            </div>
          </div>
        </div>
        <button id="btn-open-sample-gallery">Mở thư viện</button>
      </div>
    `;

    lobby = new LobbyView();
  });

  it('should initialize lobby handlers and show/hide lobby view container', () => {
    const handlers = {
      onFileSelected: vi.fn(),
      onSampleSelected: vi.fn(),
      onJoinRoom: vi.fn(),
    };

    lobby.init(handlers);

    const uploadSection = document.getElementById('upload-section')!;
    expect(uploadSection.style.display).not.toBe('none');

    lobby.hide();
    expect(uploadSection.style.display).toBe('none');

    lobby.show();
    expect(uploadSection.style.display).toBe('block');
  });

  it('should auto-advance OTP inputs and sync with legacy PIN input on user typing', () => {
    const handlers = {
      onFileSelected: vi.fn(),
      onSampleSelected: vi.fn(),
      onJoinRoom: vi.fn(),
    };
    lobby.init(handlers);

    const otpDigits = document.querySelectorAll<HTMLInputElement>('.otp-digit');
    const legacyPin = document.getElementById('input-join-pin') as HTMLInputElement;

    expect(otpDigits.length).toBe(6);

    // Simulate typing 'A' into first digit
    otpDigits[0].value = 'a';
    otpDigits[0].dispatchEvent(new Event('input', { bubbles: true }));

    expect(otpDigits[0].value).toBe('A');
    expect(legacyPin.value).toBe('A');

    // Simulate typing remaining characters 'B', '1', '2', '3', '4'
    const chars = ['B', '1', '2', '3', '4'];
    chars.forEach((char, i) => {
      otpDigits[i + 1].value = char.toLowerCase();
      otpDigits[i + 1].dispatchEvent(new Event('input', { bubbles: true }));
    });

    expect(legacyPin.value).toBe('AB1234');
  });

  it('should support pasting full 6-digit PIN across OTP fields', () => {
    const handlers = {
      onFileSelected: vi.fn(),
      onSampleSelected: vi.fn(),
      onJoinRoom: vi.fn(),
    };
    lobby.init(handlers);

    const otpDigits = document.querySelectorAll<HTMLInputElement>('.otp-digit');
    const legacyPin = document.getElementById('input-join-pin') as HTMLInputElement;

    // Simulate paste event with clipboardData
    const pasteEvent = new Event('paste', { bubbles: true }) as any;
    pasteEvent.clipboardData = {
      getData: (format: string) => (format === 'text' ? '987654' : ''),
    };

    otpDigits[0].dispatchEvent(pasteEvent);

    expect(otpDigits[0].value).toBe('9');
    expect(otpDigits[1].value).toBe('8');
    expect(otpDigits[2].value).toBe('7');
    expect(otpDigits[3].value).toBe('6');
    expect(otpDigits[4].value).toBe('5');
    expect(otpDigits[5].value).toBe('4');
    expect(legacyPin.value).toBe('987654');
  });

  it('should trigger onJoinRoom with full 6-digit PIN when join button is clicked', () => {
    const onJoinRoom = vi.fn();
    lobby.init({
      onFileSelected: vi.fn(),
      onSampleSelected: vi.fn(),
      onJoinRoom,
    });

    const otpDigits = document.querySelectorAll<HTMLInputElement>('.otp-digit');
    ['1', '2', '3', '4', '5', '6'].forEach((c, idx) => {
      otpDigits[idx].value = c;
    });

    const btnJoin = document.getElementById('btn-join-room')!;
    btnJoin.click();

    expect(onJoinRoom).toHaveBeenCalledWith('123456', 'Thí sinh A', 'SBD001');
  });
});

describe('Exam & Option Shuffling Engine (Fisher-Yates with Answer Remapping)', () => {
  const sampleExam: Exam = {
    id: 'exam_shuffle_test',
    title: 'Đề thi Thử nghiệm Xáo trộn',
    subject: 'Toán học',
    durationMinutes: 45,
    totalQuestions: 3,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    questions: [
      {
        id: 'q1',
        index: 1,
        text: 'Nghiệm của x + 2 = 5 là:',
        type: 'single',
        options: ['x = 1', 'x = 2', 'x = 3', 'x = 4'],
        correctAnswer: [2], // 'x = 3'
      },
      {
        id: 'q2',
        index: 2,
        text: 'Các số nguyên tố nhỏ hơn 10 là:',
        type: 'multiple',
        options: ['2', '3', '4', '5', '9'],
        correctAnswer: [0, 1, 3], // '2', '3', '5'
      },
      {
        id: 'q3',
        index: 3,
        text: 'Đạo hàm của sin(x) là:',
        type: 'single',
        options: ['cos(x)', '-cos(x)', 'tan(x)', 'cot(x)'],
        correctAnswer: [0], // 'cos(x)'
      },
    ],
  };

  it('should preserve original questions and options when shuffling is disabled', () => {
    const result = shuffleExam(sampleExam, false, false);

    expect(result.questions.length).toBe(3);
    expect(result.questions[0].text).toBe(sampleExam.questions[0].text);
    expect(result.questions[0].options).toEqual(sampleExam.questions[0].options);
    expect(result.questions[0].correctAnswer).toEqual(sampleExam.questions[0].correctAnswer);
  });

  it('should remap correct answer indices correctly when options are shuffled', () => {
    const result = shuffleExam(sampleExam, false, true);

    sampleExam.questions.forEach((origQ, qIdx) => {
      const shuffledQ = result.questions[qIdx];
      expect(shuffledQ.options.length).toBe(origQ.options.length);

      // Verify that the correct answer in shuffled options matches the original correct answer content
      const origCorrectContents = origQ.correctAnswer.map((idx) => origQ.options[idx]);
      const shuffledCorrectContents = shuffledQ.correctAnswer.map((idx) => shuffledQ.options[idx]);

      expect(shuffledCorrectContents.sort()).toEqual(origCorrectContents.sort());
    });
  });

  it('should re-index questions 1..N when question order is shuffled', () => {
    const result = shuffleExam(sampleExam, true, false);

    expect(result.questions.length).toBe(3);
    result.questions.forEach((q, idx) => {
      expect(q.index).toBe(idx + 1);
    });

    const originalIds = sampleExam.questions.map((q) => q.id).sort();
    const resultIds = result.questions.map((q) => q.id).sort();
    expect(resultIds).toEqual(originalIds);
  });
});
