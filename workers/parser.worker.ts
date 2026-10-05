/**
 * workers/parser.worker.ts - Web Worker Document Parser Engine 3.0
 * Decodes PDF (pdfjs-dist), DOCX (mammoth), and TXT in a dedicated background thread.
 * Preserves 60-120 FPS on UI thread during massive file parsing.
 */

import type { Question, QuestionType, ParserWorkerPayload, ParserWorkerResult } from '../src/shared/types';

// WebWorker self scope
const ctx: DedicatedWorkerGlobalScope = self as unknown as DedicatedWorkerGlobalScope;

ctx.onmessage = async (event: MessageEvent<ParserWorkerPayload>) => {
  const { fileBuffer, fileName, fileType, subjectHint } = event.data;

  try {
    let extractedText = '';
    const diagramBlobs: Record<string, string> = {};

    const ext = (fileType === 'auto' ? fileName.split('.').pop()?.toLowerCase() : fileType) || 'txt';

    if (ext === 'txt' || ext === 'text') {
      const decoder = new TextDecoder('utf-8');
      extractedText = decoder.decode(fileBuffer);
    } else if (ext === 'docx') {
      extractedText = await parseDocx(fileBuffer);
    } else if (ext === 'pdf') {
      extractedText = await parsePdf(fileBuffer);
    } else {
      const decoder = new TextDecoder('utf-8');
      extractedText = decoder.decode(fileBuffer);
    }

    const { examTitle, description, durationMinutes, questions } = tokenizeExamDocument(
      extractedText,
      fileName,
      subjectHint
    );

    const result: ParserWorkerResult = {
      success: true,
      examTitle,
      description,
      durationMinutes,
      questions,
      diagramBlobs,
    };

    ctx.postMessage(result);
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    ctx.postMessage({
      success: false,
      examTitle: fileName,
      questions: [],
      error: `Lỗi bóc tách tài liệu: ${errorMsg}`,
    } as ParserWorkerResult);
  }
};

/**
 * Parse DOCX via dynamic import of mammoth
 */
async function parseDocx(buffer: ArrayBuffer): Promise<string> {
  try {
    const mammoth = await import('mammoth');
    const result = await mammoth.extractRawText({ arrayBuffer: buffer });
    return result.value || '';
  } catch (err) {
    console.warn('[DOCX Parse Warning] Falling back to text stream:', err);
    const decoder = new TextDecoder('utf-8');
    return decoder.decode(buffer);
  }
}

/**
 * Parse PDF via dynamic import of pdfjs-dist
 */
async function parsePdf(buffer: ArrayBuffer): Promise<string> {
  try {
    const pdfjs = await import('pdfjs-dist');
    const loadingTask = pdfjs.getDocument({ data: new Uint8Array(buffer) });
    const pdf = await loadingTask.promise;
    let fullText = '';

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      const pageStrings = textContent.items
        .map((item) => ('str' in item ? (item as { str: string }).str : ''))
        .join(' ');
      fullText += `\n[--- Trang ${pageNum} ---]\n` + pageStrings + '\n';
    }

    return fullText;
  } catch (err) {
    console.warn('[PDF Parse Warning] Falling back to text stream:', err);
    const decoder = new TextDecoder('utf-8');
    return decoder.decode(buffer);
  }
}

/**
 * Intelligent Heuristic Tokenizer for Exam Documents
 */
export function tokenizeExamDocument(
  rawText: string,
  fileName: string,
  subjectHint?: string
): {
  examTitle: string;
  description: string;
  durationMinutes: number;
  questions: Question[];
} {
  const clean = rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();

  // Extract Metadata if headers exist: [TITLE]: ..., [TIME]: ...
  let examTitle = fileName.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
  let description = '';
  let durationMinutes = 45;

  const titleMatch = clean.match(/\[(?:TITLE|TIÊU ĐỀ)\]:\s*([^\n]+)/i);
  if (titleMatch?.[1]) examTitle = titleMatch[1].trim();

  const descMatch = clean.match(/\[(?:DESCRIPTION|MÔ TẢ)\]:\s*([^\n]+)/i);
  if (descMatch?.[1]) description = descMatch[1].trim();

  const timeMatch = clean.match(/\[(?:TIME|THỜI GIAN)\]:\s*(\d+)/i);
  if (timeMatch?.[1]) durationMinutes = parseInt(timeMatch[1], 10);

  // Check for Reading Comprehension Passage
  let passage: string | undefined = undefined;
  const passageMatch = clean.match(/(?:Đoạn văn đọc hiểu|Read the following passage|Passage)[:\s]*\n([\s\S]+?)(?=\n(?:Câu|Question|\d+[\.:]))/i);
  if (passageMatch?.[1]) {
    passage = passageMatch[1].trim();
  }

  // Regex to split questions:
  // e.g. "Câu 1:", "Question 1:", "Bài 1.", "Q:", "Câu 1\n", "\n1."
  const questionSplitRegex = /(?=(?:\n|^)(?:(?:Câu|Question|Bài)\s*\d+[\.:\s]|\d+[\.]\s+[A-Z\p{L}]|Q:\s*))/iu;
  const rawChunks = clean.split(questionSplitRegex);

  const questions: Question[] = [];
  let questionCounter = 1;

  for (const chunk of rawChunks) {
    const trimmed = chunk.trim();
    if (!trimmed || trimmed.length < 10) continue;

    const parsedQ = parseSingleQuestionChunk(trimmed, questionCounter, subjectHint, passage);
    if (parsedQ) {
      questions.push(parsedQ);
      questionCounter++;
    }
  }

  return {
    examTitle: examTitle || 'Đề thi trắc nghiệm OmniQuiz PRO',
    description: description || `Bộ đề gồm ${questions.length} câu hỏi tự động bóc tách`,
    durationMinutes: durationMinutes || Math.max(15, questions.length * 2),
    questions,
  };
}

/**
 * Parse an isolated question chunk into Question entity
 */
function parseSingleQuestionChunk(
  chunk: string,
  index: number,
  subjectHint?: string,
  globalPassage?: string
): Question | null {
  const lines = chunk.split('\n').map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) return null;

  let questionText = '';
  const options: string[] = [];
  let correctAnswers: number[] = [];
  let explanation = '';
  let questionType: QuestionType = 'single';
  let localPassage = globalPassage;
  let codeSnippet: { code: string; language: string } | undefined = undefined;

  // Check code block ```lang ... ```
  const codeMatch = chunk.match(/```([a-zA-Z0-9_+-]*)\n([\s\S]*?)```/);
  if (codeMatch?.[2]) {
    codeSnippet = {
      code: codeMatch[2].trim(),
      language: codeMatch[1]?.trim() || 'plaintext',
    };
  }

  let inOptions = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;

    // 1. Tag format: "Q: ...", "T: ...", "O: ...", "A: ...", "E: ..."
    if (line.startsWith('Q:')) {
      questionText = line.substring(2).trim();
      continue;
    }
    if (line.startsWith('T:')) {
      const typeStr = line.substring(2).trim().toLowerCase();
      if (typeStr.includes('multi')) questionType = 'multiple';
      else if (typeStr.includes('true') || typeStr.includes('tf')) questionType = 'true_false';
      continue;
    }
    if (line.startsWith('O:')) {
      options.push(line.substring(2).trim());
      inOptions = true;
      continue;
    }
    if (line.startsWith('A:')) {
      const ansStr = line.substring(2).trim();
      correctAnswers = parseAnswerIndices(ansStr, options.length);
      continue;
    }
    if (line.startsWith('E:')) {
      explanation = lines.slice(i).join('\n').replace(/^E:\s*/, '').trim();
      break;
    }

    // 2. Standard format: "Đáp án: A", "Lời giải: ..."
    const ansMatch = line.match(/(?:Đáp án|Answer|Key)[:\s]+([A-D0-9,\s]+)/i);
    if (ansMatch?.[1]) {
      correctAnswers = parseLetterAnswerIndices(ansMatch[1].trim());
      continue;
    }

    const expMatch = line.match(/(?:Lời giải|Explanation|HD|Hướng dẫn)[:\s]+([\s\S]*)/i);
    if (expMatch) {
      explanation = lines.slice(i).join('\n').replace(/^(?:Lời giải|Explanation|HD|Hướng dẫn)[:\s]*/i, '').trim();
      break;
    }

    // 3. Option detection: "A. ...", "B. ...", "(A) ...", "[A] ..."
    const optionMatch = line.match(/^(?:(?:\(([A-D])\)|\[([A-D])\]|([A-D])[\.:]))\s*(.*)/i);
    if (optionMatch) {
      inOptions = true;
      const optText = optionMatch[4]?.trim() || '';
      options.push(optText);
      continue;
    }

    // Accumulate question body
    if (!inOptions) {
      // Clean prefix: "Câu 1: ", "Question 1. "
      const cleanLine = line.replace(/^(?:Câu|Question|Bài)\s*\d+[\.:\s]*/i, '').trim();
      if (cleanLine) {
        questionText = questionText ? `${questionText}\n${cleanLine}` : cleanLine;
      }
    } else {
      // Line continuation for the previous option
      if (options.length > 0) {
        const lastIdx = options.length - 1;
        options[lastIdx] = `${options[lastIdx]}\n${line}`;
      }
    }
  }

  // Fallback defaults
  if (!questionText && lines.length > 0) {
    questionText = lines[0]!.replace(/^(?:Câu|Question|Bài)\s*\d+[\.:\s]*/i, '');
  }

  // If no options detected, provide True/False default if applicable
  if (options.length === 0) {
    options.push('Đúng (True)', 'Sai (False)');
    questionType = 'true_false';
  }

  if (correctAnswers.length === 0) {
    correctAnswers = [0]; // default first option if unspecified
  } else if (correctAnswers.length > 1) {
    questionType = 'multiple';
  }

  return {
    id: `q_${index}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    index,
    text: questionText.trim(),
    type: questionType,
    options,
    correctAnswer: correctAnswers,
    explanation: explanation.trim() || undefined,
    passage: localPassage,
    subject: subjectHint || 'Chung',
    codeSnippet,
  };
}

function parseAnswerIndices(ansStr: string, _optCount: number): number[] {
  return ansStr
    .split(',')
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => !isNaN(n));
}

function parseLetterAnswerIndices(lettersStr: string): number[] {
  const letters = lettersStr.toUpperCase().replace(/[^A-D]/g, '').split('');
  const map: Record<string, number> = { A: 0, B: 1, C: 2, D: 3 };
  return letters.map((l) => map[l]).filter((idx): idx is number => idx !== undefined);
}
