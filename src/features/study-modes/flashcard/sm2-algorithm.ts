/**
 * src/features/study-modes/flashcard/sm2-algorithm.ts - SuperMemo 2 (SM-2) Algorithm Engine
 * Calculates spaced repetition intervals, ease factors, and due dates with mathematical precision.
 */

import type { FlashcardItem, SM2Rating } from '../../../shared/types';

export interface SM2Result {
  repetitions: number;
  interval: number; // in days
  easeFactor: number;
  dueDate: number; // timestamp
}

export class SM2Algorithm {
  /**
   * Process review rating and calculate next schedule
   */
  static calculate(card: FlashcardItem, rating: SM2Rating, now: number = Date.now()): SM2Result {
    let { repetitions, interval, easeFactor } = card;

    // 1. Calculate new Ease Factor (EF)
    // Formula: EF' = EF + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
    const q = rating;
    const factorAdjustment = 0.1 - (5 - q) * (0.08 + (5 - q) * 0.02);
    easeFactor = Math.max(1.3, Number((easeFactor + factorAdjustment).toFixed(2)));

    // 2. Calculate interval and repetitions based on quality
    if (rating < 3) {
      // Again (failed retrieval)
      repetitions = 0;
      interval = 1;
    } else {
      // Successful retrieval
      if (repetitions === 0) {
        interval = 1;
      } else if (repetitions === 1) {
        interval = 6;
      } else {
        interval = Math.round(interval * easeFactor);
      }
      repetitions += 1;
    }

    // 3. Compute next due timestamp
    const oneDayMs = 24 * 60 * 60 * 1000;
    const dueDate = now + interval * oneDayMs;

    return {
      repetitions,
      interval,
      easeFactor,
      dueDate,
    };
  }

  /**
   * Map standard 4-button review actions: Again (1), Hard (3), Good (4), Easy (5)
   */
  static rateCard(
    card: FlashcardItem,
    quality: 'again' | 'hard' | 'good' | 'easy',
    now: number = Date.now()
  ): FlashcardItem {
    let ratingNum: SM2Rating = 4;
    switch (quality) {
      case 'again':
        ratingNum = 1;
        break;
      case 'hard':
        ratingNum = 3;
        break;
      case 'good':
        ratingNum = 4;
        break;
      case 'easy':
        ratingNum = 5;
        break;
    }

    const { repetitions, interval, easeFactor, dueDate } = this.calculate(card, ratingNum, now);

    return {
      ...card,
      repetitions,
      interval,
      easeFactor,
      dueDate,
      lastReviewedAt: now,
      history: [
        ...card.history,
        {
          reviewedAt: now,
          rating: ratingNum,
          interval,
        },
      ],
    };
  }
}
