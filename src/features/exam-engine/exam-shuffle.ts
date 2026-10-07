/**
 * src/features/exam-engine/exam-shuffle.ts
 * Clean Fisher-Yates Exam & Option Shuffling with Accurate Answer Index Remapping
 */

import type { Exam, Question } from '../../shared/types';

/**
 * Shuffles questions and/or options while preserving correct answer mappings
 * Uses non-destructive deep cloning.
 */
export function shuffleExam(
  exam: Exam,
  shuffleQuestions: boolean,
  shuffleOptions: boolean
): Exam {
  let questions: Question[] = exam.questions.map((q) => {
    let options = [...q.options];
    let correctAnswer = [...q.correctAnswer];

    if (shuffleOptions && options.length > 1) {
      const indexedOptions = options.map((opt, originalIdx) => ({
        opt,
        originalIdx,
      }));

      for (let i = indexedOptions.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const temp = indexedOptions[i]!;
        indexedOptions[i] = indexedOptions[j]!;
        indexedOptions[j] = temp;
      }

      options = indexedOptions.map((item) => item.opt);
      correctAnswer = indexedOptions
        .map((item, newIdx) => (q.correctAnswer.includes(item.originalIdx) ? newIdx : -1))
        .filter((idx) => idx !== -1)
        .sort((a, b) => a - b);
    }

    return {
      ...q,
      options,
      correctAnswer,
    };
  });

  if (shuffleQuestions && questions.length > 1) {
    for (let i = questions.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const temp = questions[i]!;
      questions[i] = questions[j]!;
      questions[j] = temp;
    }

    questions = questions.map((q, idx) => ({
      ...q,
      index: idx + 1,
    }));
  }

  return {
    ...exam,
    questions,
  };
}
