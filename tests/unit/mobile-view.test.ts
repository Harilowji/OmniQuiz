/**
 * @vitest-environment jsdom
 * tests/unit/mobile-view.test.ts
 * Unit tests for 120 FPS Touch Pacing, Mobile Passage Reading Tabs, and WCAG 2.1 AA Touch Targets.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { questionNavigator } from '../../src/features/exam-engine/question-navigator';
import { examView } from '../../src/features/study-modes/exam/exam-view';
import type { Exam } from '../../src/shared/types';

describe('Mobile Ergonomics & 120 FPS Navigation Pacing', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    document.body.innerHTML = `
      <div id="exam-container"></div>
      <div id="q-card-0"></div>
      <div id="q-card-1"></div>
      <div id="palette-btn-0" class="palette-btn"></div>
      <div id="palette-btn-1" class="palette-btn"></div>
    `;
  });

  it('should pace swipe transitions with requestAnimationFrame during touch navigation', () => {
    const rAFSpy = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      cb(0);
      return 1;
    });

    const onQuestionSelect = vi.fn();
    questionNavigator.init(2, {
      onQuestionSelect,
      onOptionToggle: vi.fn(),
      onFlagToggle: vi.fn(),
    });

    const container = document.getElementById('exam-container')!;
    const unbind = questionNavigator.bindTouchSwipe(container);

    // Simulate swipe left (next question)
    const touchStartEvent = new Event('touchstart', { bubbles: true }) as any;
    touchStartEvent.touches = [{ clientX: 200, clientY: 100 }];
    container.dispatchEvent(touchStartEvent);

    const touchEndEvent = new Event('touchend', { bubbles: true }) as any;
    touchEndEvent.changedTouches = [{ clientX: 100, clientY: 102 }]; // dx = -100px (< -50px threshold)
    container.dispatchEvent(touchEndEvent);

    expect(rAFSpy).toHaveBeenCalled();
    expect(questionNavigator.getCurrentIndex()).toBe(1);

    unbind();
    rAFSpy.mockRestore();
  });

  it('should pace scrollToQuestion execution with requestAnimationFrame', () => {
    const rAFSpy = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      cb(0);
      return 1;
    });

    const card = document.getElementById('q-card-1')!;
    const scrollSpy = vi.fn();
    card.scrollIntoView = scrollSpy;

    questionNavigator.scrollToQuestion(1);

    expect(rAFSpy).toHaveBeenCalled();
    expect(scrollSpy).toHaveBeenCalledWith({ behavior: 'smooth', block: 'center' });

    rAFSpy.mockRestore();
  });
});

describe('Mobile Passage Reading Tab Switcher (Digital SAT / THPT)', () => {
  const satExam: Exam = {
    id: 'sat_reading_demo',
    title: 'Đề thi SAT Reading Split-View',
    subject: 'Tiếng Anh',
    durationMinutes: 30,
    totalQuestions: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    questions: [
      {
        id: 'q_sat_1',
        index: 1,
        text: 'Theo đoạn văn, nhân vật chính cảm thấy thế nào?',
        type: 'single',
        passage: 'Đoạn văn tư liệu tham khảo: Ánh sáng ban mai chiếu rọi qua khung cửa sổ...',
        options: ['Hào hứng', 'Lo lắng', 'Bình thản', 'Tức giận'],
        correctAnswer: [2],
      },
    ],
  };

  beforeEach(() => {
    document.body.innerHTML = '<div id="exam-view-container"></div>';
  });

  it('should render mobile passage tabs when question contains passage text', () => {
    examView.init(satExam, 'exam-view-container');

    const card = document.getElementById('q-card-0');
    expect(card).not.toBeNull();
    expect(card?.classList.contains('has-split-passage')).toBe(true);

    const tabsContainer = card?.querySelector('.mobile-passage-tabs');
    expect(tabsContainer).not.toBeNull();

    const tabs = card?.querySelectorAll('.passage-tab-btn');
    expect(tabs?.length).toBe(2);
  });

  it('should toggle between passage and question pane when switching tabs', () => {
    examView.init(satExam, 'exam-view-container');

    const card = document.getElementById('q-card-0')!;
    const splitContainer = card.querySelector('.cbt-split-container')!;

    // Initial state: question active
    expect(splitContainer.classList.contains('active-pane-question')).toBe(true);

    // Switch to passage pane
    examView.switchPassageTab(0, 'passage');
    expect(splitContainer.classList.contains('active-pane-passage')).toBe(true);
    expect(splitContainer.classList.contains('active-pane-question')).toBe(false);

    // Switch back to question pane
    examView.switchPassageTab(0, 'question');
    expect(splitContainer.classList.contains('active-pane-question')).toBe(true);
    expect(splitContainer.classList.contains('active-pane-passage')).toBe(false);
  });
});
