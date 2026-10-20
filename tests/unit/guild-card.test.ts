/**
 * @vitest-environment jsdom
 * tests/unit/guild-card.test.ts
 * Verifies Student Guild Card gamification, Rank Tiers (S/A/B/C/D), EXP progression,
 * Daily Streak tracking, and Dojo vs Arena mode selection.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

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

if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'localStorage', {
    value: mockLocalStorage,
    writable: true,
    configurable: true,
  });
}

import { GuildCardManager } from '../../src/features/gamification/guild-card';

describe('Student Guild Card & Gamification System', () => {
  let manager: GuildCardManager;

  beforeEach(() => {
    mockLocalStorage.clear();
    manager = new GuildCardManager();
  });

  it('initializes with default Rank D, Level 1 and streak 1', () => {
    const profile = manager.getProfile();
    expect(profile.rankTier).toBe('D');
    expect(profile.level).toBe(1);
    expect(profile.exp).toBe(0);
    expect(profile.streakDays).toBe(1);
  });

  it('correctly calculates rank tiers according to EXP thresholds', () => {
    expect(manager.calculateRank(100).tier).toBe('D');
    expect(manager.calculateRank(350).tier).toBe('C');
    expect(manager.calculateRank(1200).tier).toBe('B');
    expect(manager.calculateRank(3000).tier).toBe('A');
    expect(manager.calculateRank(6000).tier).toBe('S');
  });

  it('awards EXP on correct answers and levels up when threshold reached', () => {
    // 10 correct answers * 15 EXP = 150 EXP -> reaches Level 2
    for (let i = 0; i < 9; i++) {
      manager.recordAnswer(true);
    }
    expect(manager.getProfile().level).toBe(1);

    const { leveledUp, earnedExp } = manager.recordAnswer(true);
    expect(earnedExp).toBe(15);
    expect(leveledUp).toBe(true);
    expect(manager.getProfile().level).toBe(2);
    expect(manager.getProfile().exp).toBe(150);
    expect(manager.getProfile().totalAnswered).toBe(10);
    expect(manager.getProfile().totalCorrect).toBe(10);
  });

  it('awards consolation EXP for wrong answers', () => {
    const { earnedExp, leveledUp } = manager.recordAnswer(false);
    expect(earnedExp).toBe(5);
    expect(leveledUp).toBe(false);
    expect(manager.getProfile().totalAnswered).toBe(1);
    expect(manager.getProfile().totalCorrect).toBe(0);
    expect(manager.getProfile().exp).toBe(5);
  });

  it('awards bonus EXP upon exam completion', () => {
    const res = manager.recordExamCompleted(85);
    expect(res.bonusExp).toBe(50 + 85);
    expect(manager.getProfile().exp).toBe(135);
  });

  it('renders student card into DOM container with interactive mode buttons', () => {
    const container = document.createElement('div');
    const modeSpy = vi.fn();

    manager.renderTo(container, modeSpy);

    expect(container.querySelector('.guild-card-inner')).not.toBeNull();
    expect(container.querySelector('.guild-rank-tag')?.textContent).toBe('D');
    expect(container.querySelector('.guild-streak-pill')?.textContent).toContain('1 ngày');

    const btnDojo = container.querySelector('#btn-guild-dojo') as HTMLButtonElement;
    const btnArena = container.querySelector('#btn-guild-arena') as HTMLButtonElement;
    expect(btnDojo).not.toBeNull();
    expect(btnArena).not.toBeNull();

    btnDojo.click();
    expect(modeSpy).toHaveBeenCalledWith('practice');

    btnArena.click();
    expect(modeSpy).toHaveBeenCalledWith('exam');
  });
});
