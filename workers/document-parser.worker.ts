/**
 * workers/document-parser.worker.ts - Web Worker Document Parser Engine 3.1 (Azota Standard)
 * Decodes PDF (pdfjs-dist coordinate preservation), DOCX (mammoth HTML + jszip), and TXT in background.
 * Extracts embedded diagrams, inline options (A-B-C-D on 1-2 lines), underlined/bold correct answers,
 * end-of-file answer keys without premature truncation, and generates validation reports with warnings.
 */

import JSZip from 'jszip';
import type { Question, QuestionType, ParserWorkerPayload, ParserWorkerResult, ParserWarning } from '../src/shared/types';

// WebWorker self scope (guarded for Node.js / Vitest unit tests)
if (typeof self !== 'undefined') {
  const ctx: DedicatedWorkerGlobalScope = self as unknown as DedicatedWorkerGlobalScope;

  ctx.onmessage = async (event: MessageEvent<ParserWorkerPayload>) => {
    const { fileBuffer, fileName, fileType, subjectHint } = event.data;

    try {
      let extractedText = '';
      let diagramBlobs: Record<string, string> = {};

      const ext = (fileType === 'auto' ? fileName.split('.').pop()?.toLowerCase() : fileType) || 'txt';

      if (ext === 'docx') {
        const docxResult = await parseDocxWithDiagrams(fileBuffer);
        extractedText = docxResult.text;
        diagramBlobs = docxResult.diagrams;
      } else if (ext === 'pdf') {
        extractedText = await parsePdf(fileBuffer);
      } else {
        const decoder = new TextDecoder('utf-8');
        extractedText = decoder.decode(fileBuffer);
      }

      const { examTitle, description, durationMinutes, questions, warnings } = tokenizeExamDocument(
        extractedText,
        fileName,
        subjectHint,
        diagramBlobs
      );

      const result: ParserWorkerResult = {
        success: true,
        examTitle,
        description,
        durationMinutes,
        questions,
        warnings,
        rawExtractedText: extractedText,
        diagramBlobs,
      };

      ctx.postMessage(result);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      ctx.postMessage({
        success: false,
        examTitle: fileName,
        questions: [],
        warnings: [],
        error: `Lỗi bóc tách tài liệu: ${errorMsg}`,
      } as ParserWorkerResult);
    }
  };
}

/**
 * 1. Parse DOCX via mammoth (HTML with style map) + jszip (diagram images)
 * Detects underline, bold, and markers on correct options.
 */
async function parseDocxWithDiagrams(
  buffer: ArrayBuffer
): Promise<{ text: string; diagrams: Record<string, string> }> {
  const diagrams: Record<string, string> = {};

  // Extract embedded diagram images via JSZip
  try {
    const zip = await JSZip.loadAsync(buffer);
    const mediaEntries = Object.keys(zip.files).filter(
      (p) => p.startsWith('word/media/') && !zip.files[p]?.dir
    );

    for (const p of mediaEntries) {
      const file = zip.files[p];
      if (file) {
        const base64 = await file.async('base64');
        const ext = p.split('.').pop()?.toLowerCase() || 'png';
        const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : ext === 'gif' ? 'image/gif' : 'image/png';
        diagrams[p] = `data:${mime};base64,${base64}`;
      }
    }
  } catch (err) {
    console.warn('[DOCX JSZip Diagram Extraction Warning]:', err);
  }

  // Convert to HTML preserving underline, bold, and font formatting
  let text = '';
  try {
    const mammoth = await import('mammoth');
    const result = await mammoth.convertToHtml(
      { arrayBuffer: buffer },
      {
        styleMap: [
          'u => u',
          'b => strong',
          'i => em',
          'strike => s',
        ],
      }
    );
    const rawHtml = result.value || '';
    text = convertDocxHtmlToText(rawHtml);
  } catch (err) {
    console.warn('[DOCX Mammoth Parse Warning] Falling back to text stream:', err);
    const decoder = new TextDecoder('utf-8');
    text = decoder.decode(buffer);
  }

  return { text, diagrams };
}

/**
 * Converts Word Mammoth HTML to structured text while preserving correct-answer tokens
 */
export function convertDocxHtmlToText(html: string): string {
  let processed = html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<\/tr>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/&nbsp;/gi, ' ');

  // 1. Detect underlined or bolded option headers: <u>A.</u> or <strong>A.</strong> or <u>A</u>. or <u>A)</u>
  processed = processed.replace(
    /(?:<p>|\n|^|\s*)(?:<u>|<strong>|<b>)\s*(\*?\s*[\(\[]?[A-D][\)\]\.:\-]\s*[\s\S]*?)(?:<\/u>|<\/strong>|<\/b>)/gi,
    (_match, inner) => `\n[CORRECT_OPT] ${inner}`
  );

  // 2. Option letter only styled: <u>A</u>. or <strong>A</strong>.
  processed = processed.replace(
    /(?:<p>|\n|^|\s*)(?:<u>|<strong>|<b>)\s*(\*?\s*[\(\[]?[A-D][\)\]]?)\s*(?:<\/u>|<\/strong>|<\/b>)\s*([\.:\-])/gi,
    '\n[CORRECT_OPT] $1$2'
  );

  // 3. Asterisk preceding option: *A. or * A.
  processed = processed.replace(
    /(?:^|\n|\s+)\*\s*([\(\[]?[A-D][\)\]\.:\-])/gi,
    '\n[CORRECT_OPT] $1'
  );

  // 4. Strip remaining HTML tags
  return processed.replace(/<[^>]+>/g, '');
}

/**
 * 2. Parse PDF via pdfjs-dist with Y/X coordinate grouping to preserve line breaks
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

      interface PositionedItem {
        str: string;
        x: number;
        y: number;
        width: number;
        hasEOL: boolean;
      }

      const items: PositionedItem[] = [];
      for (const item of textContent.items) {
        if ('str' in item && typeof item.str === 'string') {
          const transform = (item.transform as number[]) || [1, 0, 0, 1, 0, 0];
          items.push({
            str: item.str,
            x: transform[4] ?? 0,
            y: transform[5] ?? 0,
            width: (item as unknown as { width?: number }).width || 0,
            hasEOL: !!(item as unknown as { hasEOL?: boolean }).hasEOL,
          });
        }
      }

      // Sort items: Y descending (top to bottom), X ascending (left to right)
      items.sort((a, b) => b.y - a.y || a.x - b.x);

      const lines: string[] = [];
      let currentLineItems: PositionedItem[] = [];
      let currentY: number | null = null;

      for (const it of items) {
        if (!it.str && !it.hasEOL) continue;

        if (currentY === null || Math.abs(currentY - it.y) <= 4) {
          currentLineItems.push(it);
          if (currentY === null) currentY = it.y;
        } else {
          // Commit previous line
          currentLineItems.sort((a, b) => a.x - b.x);
          const lineStr = assembleLineText(currentLineItems);
          if (lineStr.trim()) lines.push(lineStr);
          currentLineItems = [it];
          currentY = it.y;
        }

        if (it.hasEOL) {
          currentLineItems.sort((a, b) => a.x - b.x);
          const lineStr = assembleLineText(currentLineItems);
          if (lineStr.trim()) lines.push(lineStr);
          currentLineItems = [];
          currentY = null;
        }
      }

      if (currentLineItems.length > 0) {
        currentLineItems.sort((a, b) => a.x - b.x);
        const lineStr = assembleLineText(currentLineItems);
        if (lineStr.trim()) lines.push(lineStr);
      }

      fullText += `\n[--- Trang ${pageNum} ---]\n` + lines.join('\n') + '\n';
    }

    return fullText;
  } catch (err) {
    console.warn('[PDF Parse Warning] Falling back to text stream:', err);
    const decoder = new TextDecoder('utf-8');
    return decoder.decode(buffer);
  }
}

function assembleLineText(items: Array<{ str: string; x: number; y: number; width: number }>): string {
  let result = '';
  for (let i = 0; i < items.length; i++) {
    const cur = items[i]!;
    if (i > 0) {
      const prev = items[i - 1]!;
      const gap = cur.x - (prev.x + prev.width);
      if (gap > 25) {
        result += '\t';
      } else if (gap > 2 || (!prev.str.endsWith(' ') && !cur.str.startsWith(' '))) {
        result += ' ';
      }
    }
    result += cur.str;
  }
  return result;
}

/**
 * 3. Pre-normalize Exam Text:
 * Separates multiple inline options (e.g. "A. 10    B. 20    C. 30    D. 40") onto distinct lines.
 */
export function normalizeInlineOptions(text: string): string {
  const lines = text.split('\n');
  const normalizedLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      normalizedLines.push(line);
      continue;
    }

    // Check if line contains sequential option labels e.g. A. ... B. ...
    // Must contain A followed by B, or B followed by C, etc.
    const hasA = /(?:^|\s{2,}|\t|\s+)(?:\[CORRECT_OPT\]\s*)?[\(\[]?A[\)\]\.:\-]/i.test(trimmed);
    const hasB = /(?:\s{2,}|\t|\s+)(?:\[CORRECT_OPT\]\s*)?[\(\[]?B[\)\]\.:\-]/i.test(trimmed);
    const hasC = /(?:\s{2,}|\t|\s+)(?:\[CORRECT_OPT\]\s*)?[\(\[]?C[\)\]\.:\-]/i.test(trimmed);
    const hasD = /(?:\s{2,}|\t|\s+)(?:\[CORRECT_OPT\]\s*)?[\(\[]?D[\)\]\.:\-]/i.test(trimmed);

    if ((hasA && hasB) || (hasB && hasC) || (hasC && hasD)) {
      // Split sequentially before B, C, D
      let splitLine = trimmed
        .replace(
          /(?<=[^\s])(?:\s{2,}|\t|\s+)(?=(?:\[CORRECT_OPT\]\s*)?[\(\[]?B[\)\]\.:\-])/i,
          '\n'
        )
        .replace(
          /(?<=[^\s])(?:\s{2,}|\t|\s+)(?=(?:\[CORRECT_OPT\]\s*)?[\(\[]?C[\)\]\.:\-])/i,
          '\n'
        )
        .replace(
          /(?<=[^\s])(?:\s{2,}|\t|\s+)(?=(?:\[CORRECT_OPT\]\s*)?[\(\[]?D[\)\]\.:\-])/i,
          '\n'
        );

      normalizedLines.push(splitLine);
    } else {
      normalizedLines.push(line);
    }
  }

  return normalizedLines.join('\n');
}

/**
 * 4. Safe End-of-File Answer Key Table Extractor
 * Avoids premature truncation by matching only standalone headers in the lower half of document.
 */
export function extractEndOfFileAnswerKey(rawText: string): {
  answerMap: Map<number, number[]>;
  cleanText: string;
} {
  const answerMap = new Map<number, number[]>();
  const letterMap: Record<string, number> = { A: 0, B: 1, C: 2, D: 3 };

  // Match standalone header on a single line
  const tableHeaderRegex = /(?:^|\n)\s*(?:BẢNG\s+(?:TRA\s+|TỔNG\s+HỢP\s+)?ĐÁP\s*ÁN|ĐÁP\s*ÁN(?:\s+(?:CHI\s+TIẾT|TRẮC\s+NGHIỆM|CÁC\s+CÂU|THAM\s+KHẢO|ĐỀ\s+THI))?|ANSWER\s+KEY|KEY\s+ĐÁP\s*ÁN|HƯỚNG\s+DẪN\s+CHẤM(?:\s+VÀ\s+ĐÁP\s*ÁN)?)\s*[:\-\—\–]?\s*(?:\n|$)/i;

  const match = rawText.match(tableHeaderRegex);
  if (!match || match.index === undefined) {
    return { answerMap, cleanText: rawText };
  }

  // Verify match is in the bottom 60% of text OR has dense answer pairs
  const tableStart = match.index;
  const tableText = rawText.substring(tableStart);

  // Check for 2-row table grids e.g. "Câu: 1 2 3" / "Đ/A: A B C"
  const gridRows = tableText.split('\n').map((l) => l.trim()).filter(Boolean);
  let parsedFromGrid = false;

  for (let r = 0; r < gridRows.length - 1; r++) {
    const row1 = gridRows[r]!;
    const row2 = gridRows[r + 1]!;
    if (
      /(?:^|[|\s])(?:Câu|Q|No)\b/i.test(row1) &&
      /(?:^|[|\s])(?:Đ\/?A|Đáp\s*án|Key|Ans)\b/i.test(row2)
    ) {
      const qNums = (row1.match(/\b\d+\b/g) || []).map(Number);
      const answers = row2.match(/\b[A-D]\b/gi) || [];
      if (qNums.length > 0 && qNums.length === answers.length) {
        for (let k = 0; k < qNums.length; k++) {
          const qn = qNums[k]!;
          const ch = answers[k]!.toUpperCase();
          const optIdx = letterMap[ch];
          if (optIdx !== undefined) {
            answerMap.set(qn, [optIdx]);
          }
        }
        parsedFromGrid = true;
        r++;
      }
    }
  }

  // Match standard pairs: "1. A", "1-A", "1: A", "1 A", "1.A", "Câu 1: A", "1) A"
  const itemRegex = /(?:Câu\s*)?\b(\d+)[\s.:\-=]+([A-D])\b/gi;
  let itemMatch: RegExpExecArray | null;
  let pairCount = 0;

  while ((itemMatch = itemRegex.exec(tableText)) !== null) {
    const qNum = parseInt(itemMatch[1] ?? '', 10);
    const letter = (itemMatch[2] ?? '').toUpperCase();
    const optIdx = letterMap[letter];
    if (!isNaN(qNum) && optIdx !== undefined && !answerMap.has(qNum)) {
      answerMap.set(qNum, [optIdx]);
      pairCount++;
    }
  }

  // Only consider answer key valid if in bottom 60% OR has at least 2 pairs
  if ((tableStart >= rawText.length * 0.4 || pairCount >= 2 || parsedFromGrid) && answerMap.size > 0) {
    const cleanText = rawText.substring(0, tableStart).trim();
    return { answerMap, cleanText };
  }

  return { answerMap, cleanText: rawText };
}

/**
 * 5. Intelligent Heuristic Tokenizer for Exam Documents
 */
export function tokenizeExamDocument(
  rawText: string,
  fileName: string,
  subjectHint?: string,
  diagramBlobs?: Record<string, string>
): {
  examTitle: string;
  description: string;
  durationMinutes: number;
  questions: Question[];
  warnings: ParserWarning[];
  rawText: string;
} {
  // Normalize line endings and whitespace
  let clean = rawText
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[\u00A0\u1680\u180E\u2000-\u200A\u200B\u200C\u200D\u2028\u2029\u202F\u205F\u3000\uFEFF]/g, ' ')
    .trim();

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
  let globalPassage: string | undefined = undefined;
  const passageMatch = clean.match(
    /(?:Đoạn văn đọc hiểu|Read the following passage|Passage)[:\s]*\n([\s\S]+?)(?=\n\s*(?:(?:Câu|Question|Bài)\s*\d+|\d+[\.:\)\/]))/i
  );
  if (passageMatch?.[1]) {
    globalPassage = passageMatch[1].trim();
  }

  // Extract End-of-File Answer Key Table and get body without key section
  const { answerMap: endAnswerKey, cleanText: questionBodyText } = extractEndOfFileAnswerKey(clean);

  // Pre-normalize horizontal/inline options in question body
  const bodyWithNormalizedOptions = normalizeInlineOptions(questionBodyText);

  // Flexible question split regex:
  // Matches "Câu 1:", "Câu 1.", "Câu 01 -", "Question 1:", "Bài 1:", "1.", "1/", "1)", "Q1:"
  const questionSplitRegex = /(?=(?:\n|^)\s*(?:(?:Câu\s*hỏi|Câu|Question|Bài|Q)\s*\d+[:.\s/—–\)-]+|\d+(?:\([^)]*\))?[:.\s/—–\)>]\s+(?=[A-ZÀ-Ỹ$\*0-9(])|Q\d+[:.\s]+))/iu;
  const rawChunks = bodyWithNormalizedOptions.split(questionSplitRegex);

  const diagramKeys = diagramBlobs ? Object.keys(diagramBlobs) : [];
  const questions: Question[] = [];
  const warnings: ParserWarning[] = [];
  let questionCounter = 1;

  for (const chunk of rawChunks) {
    const trimmed = chunk.trim();
    if (!trimmed || trimmed.length < 8) continue;

    // Filter out preamble headers or pure metadata blocks
    const hasQuestionPrefix = /^(?:(?:Câu\s*hỏi|Câu|Question|Bài|Q)\s*\d+|Q\d+|\d+[:.)/>-])/i.test(trimmed);
    const hasOptions = /(?:^[A-D][:.)]|^O:|^\[CORRECT_OPT\])/m.test(trimmed);
    if (!hasQuestionPrefix && !hasOptions) {
      continue;
    }

    // Attach diagram if available
    const assignedDiagram =
      diagramKeys.length >= questionCounter && diagramBlobs
        ? diagramBlobs[diagramKeys[questionCounter - 1] ?? '']
        : undefined;

    const parsedQ = parseSingleQuestionChunk(
      trimmed,
      questionCounter,
      subjectHint,
      globalPassage,
      assignedDiagram
    );

    if (parsedQ && parsedQ.options.length >= 2) {
      // If no question-specific answer found or defaulted to 0, check End-of-File table
      if (
        (parsedQ.correctAnswer.length === 0 ||
          (parsedQ.correctAnswer.length === 1 && parsedQ.correctAnswer[0] === 0 && !parsedQ.hasExplicitAnswer)) &&
        endAnswerKey.has(questionCounter)
      ) {
        const tableAns = endAnswerKey.get(questionCounter);
        if (tableAns) {
          parsedQ.correctAnswer = tableAns;
          parsedQ.hasExplicitAnswer = true;
        }
      }

      // Add to warning report if incomplete
      if (parsedQ.options.length < 4 && parsedQ.type === 'single') {
        warnings.push({
          questionIndex: parsedQ.index,
          type: 'missing_options',
          message: `Câu ${parsedQ.index} có ${parsedQ.options.length}/4 đáp án.`,
        });
      }

      if (!parsedQ.hasExplicitAnswer) {
        warnings.push({
          questionIndex: parsedQ.index,
          type: 'missing_answer',
          message: `Câu ${parsedQ.index} chưa có đáp án đúng (tự động gán lựa chọn đầu).`,
        });
      }

      delete parsedQ.hasExplicitAnswer;
      questions.push(parsedQ);
      questionCounter++;
    }
  }

  return {
    examTitle: examTitle || 'Đề thi trắc nghiệm OmniQuiz PRO',
    description: description || `Bộ đề gồm ${questions.length} câu hỏi tự động bóc tách`,
    durationMinutes: durationMinutes || Math.max(15, questions.length * 2),
    questions,
    warnings,
    rawText: clean,
  };
}

interface ParsedQuestionWithFlag extends Question {
  hasExplicitAnswer?: boolean;
}

/**
 * Parse an isolated question chunk into Question entity
 */
function parseSingleQuestionChunk(
  chunk: string,
  index: number,
  subjectHint?: string,
  globalPassage?: string,
  diagramUrl?: string
): ParsedQuestionWithFlag | null {
  const lines = chunk
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 2) return null;

  let questionText = '';
  const options: string[] = [];
  let correctAnswers: number[] = [];
  let hasExplicitAnswer = false;
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
    let line = lines[i]!;

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
      correctAnswers = parseAnswerIndices(ansStr);
      hasExplicitAnswer = true;
      continue;
    }
    if (line.startsWith('E:')) {
      explanation = lines.slice(i).join('\n').replace(/^E:\s*/, '').trim();
      break;
    }

    // 2. Standard format: "Đáp án: A", "Chọn B", "Key: C", "Lời giải: ..."
    const ansMatch = line.match(/(?:Đáp\s*án(?:\s*đúng)?|Answer|Key|Chọn)[:\s]+([A-D0-9,\s]+)/i);
    if (ansMatch?.[1]) {
      correctAnswers = parseLetterAnswerIndices(ansMatch[1].trim());
      hasExplicitAnswer = true;
      continue;
    }

    const expMatch = line.match(/(?:Lời\s*giải|Explanation|HD|Hướng\s*dẫn|Giải\s*thích)[:\s]+([\s\S]*)/i);
    if (expMatch) {
      explanation = lines
        .slice(i)
        .join('\n')
        .replace(/^(?:Lời\s*giải|Explanation|HD|Hướng\s*dẫn|Giải\s*thích)[:\s]*/i, '')
        .trim();
      break;
    }

    // 3. Option detection with [CORRECT_OPT] or asterisk or standard letter:
    // e.g. "[CORRECT_OPT] A. ...", "*A. ...", "A. ...", "(A) ...", "A) ..."
    let isCorrectOption = false;
    if (line.startsWith('[CORRECT_OPT]')) {
      isCorrectOption = true;
      line = line.replace(/^\[CORRECT_OPT\]\s*/, '');
    } else if (/^\*\s*[A-D][\.:\)]/i.test(line)) {
      isCorrectOption = true;
      line = line.replace(/^\*\s*/, '');
    }

    const optionMatch = line.match(/^(?:(?:\(([A-D])\)|\[([A-D])\]|([A-D])[:.)]))\s*(.*)/i);
    if (optionMatch) {
      inOptions = true;
      let optText = (optionMatch[4] ?? '').trim();

      // Check if option text ends with (đáp án đúng) or *
      if (/\((?:đáp\s*án\s*đúng|đúng|correct)\)\s*$/i.test(optText)) {
        isCorrectOption = true;
        optText = optText.replace(/\((?:đáp\s*án\s*đúng|đúng|correct)\)\s*$/i, '').trim();
      } else if (/\*\s*$/.test(optText)) {
        isCorrectOption = true;
        optText = optText.replace(/\*\s*$/, '').trim();
      }

      const currentOptIdx = options.length;
      options.push(optText);

      if (isCorrectOption) {
        if (!correctAnswers.includes(currentOptIdx)) {
          correctAnswers.push(currentOptIdx);
        }
        hasExplicitAnswer = true;
      }
      continue;
    }

    // Accumulate question body
    if (!inOptions) {
      // Clean prefix: "Câu 1: ", "Question 1. ", "Bài 1 - "
      const cleanLine = line
        .replace(/^(?:(?:Câu\s*hỏi|Câu|Question|Bài|Q)\s*\d+[:.\s/—–\)-]*|\d+(?:\([^)]*\))?[:.\s/—–\)>]\s*)/i, '')
        .trim();
      if (cleanLine) {
        questionText = questionText ? `${questionText}\n${cleanLine}` : cleanLine;
      }
    } else {
      // Line continuation for previous option
      if (options.length > 0) {
        const lastIdx = options.length - 1;
        options[lastIdx] = `${options[lastIdx]}\n${line}`;
      }
    }
  }

  // Fallback default questionText
  if (!questionText && lines.length > 0) {
    questionText = (lines[0] ?? '').replace(
      /^(?:(?:Câu\s*hỏi|Câu|Question|Bài|Q)\s*\d+[:.\s/—–\)-]*|\d+(?:\([^)]*\))?[:.\s/—–\)>]\s*)/i,
      ''
    );
  }

  // If no options detected, provide True/False default if applicable
  if (options.length === 0) {
    options.push('Đúng (True)', 'Sai (False)');
    questionType = 'true_false';
  }

  if (correctAnswers.length === 0) {
    correctAnswers = [0]; // default fallback
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
    hasExplicitAnswer,
    explanation: explanation.trim() || undefined,
    passage: localPassage,
    subject: subjectHint || 'Chung',
    imageUrl: diagramUrl,
    codeSnippet,
    rawText: chunk.trim(),
  };
}

function parseAnswerIndices(ansStr: string): number[] {
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
