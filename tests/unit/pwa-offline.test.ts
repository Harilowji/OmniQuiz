/**
 * @vitest-environment jsdom
 * tests/unit/pwa-offline.test.ts
 * Verifies PWA offline indicator UI state, browser event listeners, and offline fixture fallback.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { OmniQuizApp } from '../../src/app/main';
import { getPreloadedSampleExams } from '../../src/shared/sample-banks';

describe('PWA Offline & Network Resilience', () => {
  let app: OmniQuizApp;
  let badgeEl: HTMLElement;
  let textEl: HTMLElement;

  beforeEach(() => {
    document.body.innerHTML = `
      <div id="offline-indicator-badge" class="offline-indicator-badge" style="display: none;">
        <span class="offline-dot"></span>
        <span id="offline-indicator-text">Đã kết nối</span>
      </div>
    `;

    badgeEl = document.getElementById('offline-indicator-badge')!;
    textEl = document.getElementById('offline-indicator-text')!;
    app = new OmniQuizApp();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  it('should display offline warning badge when window fires "offline" event', () => {
    app.setupNetworkMonitoring();

    // Trigger offline event
    window.dispatchEvent(new Event('offline'));

    expect(badgeEl.style.display).toBe('inline-flex');
    expect(badgeEl.classList.contains('is-offline')).toBe(true);
    expect(badgeEl.classList.contains('is-online')).toBe(false);
    expect(textEl.textContent).toContain('Ngoại tuyến');
  });

  it('should switch badge to online connected state when window fires "online" event', () => {
    app.setupNetworkMonitoring();

    // First go offline
    window.dispatchEvent(new Event('offline'));
    expect(badgeEl.classList.contains('is-offline')).toBe(true);

    // Then reconnect
    window.dispatchEvent(new Event('online'));

    expect(badgeEl.classList.contains('is-online')).toBe(true);
    expect(badgeEl.classList.contains('is-offline')).toBe(false);
    expect(textEl.textContent).toContain('Đã kết nối');
  });

  it('should have all 9 standardized multi-subject exam fixtures available for 100% offline access', () => {
    const samples = getPreloadedSampleExams();
    expect(samples.length).toBe(9);

    const subjectIds = samples.map((s) => s.id);
    expect(subjectIds).toContain('sample_informatics_10');
    expect(subjectIds).toContain('sample_math_50');
    expect(subjectIds).toContain('sample_sat_math');
    expect(subjectIds).toContain('sample_chem_12');
    expect(subjectIds).toContain('sample_physics_12');
    expect(subjectIds).toContain('sample_english_thpt');
    expect(subjectIds).toContain('sample_social_12');
    expect(subjectIds).toContain('sample_quick_5');
    expect(subjectIds).toContain('sample_chem_40_pdf');

    // Verify all fixtures contain non-empty questions
    samples.forEach((exam) => {
      expect(exam.questions.length).toBeGreaterThan(0);
      expect(exam.totalQuestions).toBe(exam.questions.length);
    });
  });
});
