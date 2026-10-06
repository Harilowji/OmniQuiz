/**
 * src/shared/sample-banks.ts - Built-in Multi-Subject Sample Question Banks
 * Zero-Regression: Standardized JSON fixtures for all 9 subjects, 100% strictly typed.
 */

import type { Exam, Question, QuestionType } from './types';

import chem12Json from './fixtures/chem_12.json';
import chem40Json from './fixtures/chem_40_pdf.json';
import englishThptJson from './fixtures/english_thpt.json';
import informatics10Json from './fixtures/informatics_10.json';
import math50Json from './fixtures/math_50.json';
import physics12Json from './fixtures/physics_12.json';
import quick5Json from './fixtures/quick_5.json';
import satMathJson from './fixtures/sat_math.json';
import social12Json from './fixtures/social_12.json';

interface RawFixtureQuestion {
  id: string;
  index: number;
  text: string;
  type: string;
  options: string[];
  correctAnswer: number[];
  explanation?: string;
  passage?: string;
  subject?: string;
  codeSnippet?: {
    code: string;
    language: string;
  };
}

interface RawFixtureExam {
  id: string;
  title: string;
  description: string;
  subject: string;
  durationMinutes: number;
  totalQuestions: number;
  createdAt: string;
  updatedAt: string;
  questions: RawFixtureQuestion[];
}

function parseQuestionType(typeStr: string): QuestionType {
  switch (typeStr) {
    case 'multiple':
      return 'multiple';
    case 'true_false':
      return 'true_false';
    case 'fill_in':
      return 'fill_in';
    default:
      return 'single';
  }
}

function transformFixtureToExam(raw: RawFixtureExam): Exam {
  const questions: Question[] = raw.questions.map((q) => ({
    id: q.id,
    index: q.index,
    text: q.text,
    type: parseQuestionType(q.type),
    options: [...q.options],
    correctAnswer: [...q.correctAnswer],
    explanation: q.explanation,
    passage: q.passage,
    subject: q.subject,
    codeSnippet: q.codeSnippet
      ? {
          code: q.codeSnippet.code,
          language: q.codeSnippet.language,
        }
      : undefined,
  }));

  return {
    id: raw.id,
    title: raw.title,
    description: raw.description,
    subject: raw.subject,
    durationMinutes: raw.durationMinutes,
    totalQuestions: questions.length,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
    questions,
  };
}

export const SAMPLE_EXAMS_MAP: Record<string, Exam> = {
  informatics_10: transformFixtureToExam(informatics10Json),
  chem_40_pdf: transformFixtureToExam(chem40Json),
  math_50: transformFixtureToExam(math50Json),
  sat_math: transformFixtureToExam(satMathJson),
  physics_12: transformFixtureToExam(physics12Json),
  chem_12: transformFixtureToExam(chem12Json),
  english_thpt: transformFixtureToExam(englishThptJson),
  social_12: transformFixtureToExam(social12Json),
  quick_5: transformFixtureToExam(quick5Json),
};

/**
 * Return collection of ready-to-use Exam objects for initial Dexie database seeding
 */
export function getPreloadedSampleExams(): Exam[] {
  return Object.values(SAMPLE_EXAMS_MAP);
}

/**
 * Get a specific sample exam by its identifier key
 */
export function getSampleExamByKey(key: string): Exam | undefined {
  return SAMPLE_EXAMS_MAP[key];
}
