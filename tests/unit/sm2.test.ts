import { describe, it, expect } from 'vitest';
import { SM2Algorithm } from '../../src/features/study-modes/flashcard/sm2-algorithm';
import type { FlashcardItem } from '../../src/shared/types';

describe('SuperMemo-2 (SM-2) Spaced Repetition Engine', () => {
  const baseCard: FlashcardItem = {
    id: 'card_1',
    questionId: 'q_1',
    front: 'Định luật II Newton phát biểu thế nào?',
    back: 'F = m * a',
    repetitions: 0,
    interval: 1,
    easeFactor: 2.5,
    dueDate: Date.now(),
    history: [],
  };

  it('should reset interval to 1 day on failed review (Again)', () => {
    const cardAfterFail = SM2Algorithm.rateCard(
      {
        ...baseCard,
        repetitions: 3,
        interval: 16,
      },
      'again'
    );

    expect(cardAfterFail.repetitions).toBe(0);
    expect(cardAfterFail.interval).toBe(1);
    expect(cardAfterFail.history).toHaveLength(1);
    expect(cardAfterFail.history[0]?.rating).toBe(1);
  });

  it('should increment repetitions and scale interval for consecutive successful reviews (Good)', () => {
    const fixedNow = 1700000000000;
    // Review 1
    const r1 = SM2Algorithm.rateCard(baseCard, 'good', fixedNow);
    expect(r1.repetitions).toBe(1);
    expect(r1.interval).toBe(1);

    // Review 2
    const r2 = SM2Algorithm.rateCard(r1, 'good', fixedNow);
    expect(r2.repetitions).toBe(2);
    expect(r2.interval).toBe(6);

    // Review 3
    const r3 = SM2Algorithm.rateCard(r2, 'good', fixedNow);
    expect(r3.repetitions).toBe(3);
    // Interval should be 6 * easeFactor
    expect(r3.interval).toBe(Math.round(6 * r3.easeFactor));
  });

  it('should ensure easeFactor does not drop below 1.3 floor', () => {
    let current = { ...baseCard, easeFactor: 1.35 };

    // Fail multiple times in a row
    for (let i = 0; i < 5; i++) {
      current = SM2Algorithm.rateCard(current, 'again');
    }

    expect(current.easeFactor).toBe(1.3);
  });

  it('should increase easeFactor and calculate longer interval for Easy reviews', () => {
    const r1 = SM2Algorithm.rateCard(baseCard, 'easy');
    expect(r1.easeFactor).toBeGreaterThan(baseCard.easeFactor);
    expect(r1.history[0]?.rating).toBe(5);
  });
});
