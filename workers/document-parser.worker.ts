/**
 * workers/document-parser.worker.ts - Web Worker Document Parser Engine 4.0 (Azota Pro Edition)
 * Decodes PDF (pdfjs-dist coordinate preservation, dynamic Y-tolerance, subscript/superscript clustering, 2-column detection),
 * DOCX (mammoth HTML + jszip deep XML run extraction for colored, highlighted, underlined text + OMML math equation to LaTeX conversion),
 * TXT, and provides full support for the 3 New Standard Question Formats (GDPT 2018 & Azota):
 *   - Part I: Multiple Choice (ABCD)
 *   - Part II: True/False Group (4 sub-items a, b, c, d)
 *   - Part III: Short Answer (numerical / fill-in)
 * With sequential anchor option normalization, safe end-of-file answer keys, and detailed explanation extraction.
 */

import JSZip from 'jszip';
import type {
  Question,
  QuestionType,
  ParserWorkerPayload,
  ParserWorkerResult,
  ParserWarning,
  TrueFalseSubItem,
} from '../src/shared/types';

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
 * Converts Microsoft Equation OMML (<m:oMath>, <m:oMathPara>) XML into KaTeX LaTeX ($...$)
 */
export function convertOmmlToLatex(omml: string): string {
  if (!omml) return '';

  const extractInner = (xml: string, tag: string): string => {
    const reg = new RegExp(`<m:${tag}[^>]*>([\\s\\S]*?)<\\/m:${tag}>`, 'i');
    const m = xml.match(reg);
    return m ? m[1] ?? '' : '';
  };

  let str = omml;

  // 1. Fractions: <m:f>...<m:num>...</m:num>...<m:den>...</m:den>...</m:f>
  let prev = '';
  while (prev !== str && str.includes('<m:f')) {
    prev = str;
    str = str.replace(/<m:f[^>]*>([\s\S]*?)<\/m:f>/gi, (_m, inner) => {
      const num = convertOmmlToLatex(extractInner(inner, 'num'));
      const den = convertOmmlToLatex(extractInner(inner, 'den'));
      return `\\frac{${num}}{${den}}`;
    });
  }

  // 2. Radicals / Square roots: <m:rad>...<m:deg>...</m:deg>...<m:e>...</m:e>...</m:rad>
  prev = '';
  while (prev !== str && str.includes('<m:rad')) {
    prev = str;
    str = str.replace(/<m:rad[^>]*>([\s\S]*?)<\/m:rad>/gi, (_m, inner) => {
      const deg = convertOmmlToLatex(extractInner(inner, 'deg')).trim();
      const e = convertOmmlToLatex(extractInner(inner, 'e')).trim();
      return deg ? `\\sqrt[${deg}]{${e}}` : `\\sqrt{${e}}`;
    });
  }

  // 3. Sub-superscript: <m:sSubSup>...
  prev = '';
  while (prev !== str && str.includes('<m:sSubSup')) {
    prev = str;
    str = str.replace(/<m:sSubSup[^>]*>([\s\S]*?)<\/m:sSubSup>/gi, (_m, inner) => {
      const e = convertOmmlToLatex(extractInner(inner, 'e')).trim();
      const sub = convertOmmlToLatex(extractInner(inner, 'sub')).trim();
      const sup = convertOmmlToLatex(extractInner(inner, 'sup')).trim();
      return `{${e}}_{${sub}}^{${sup}}`;
    });
  }

  // 4. Superscript: <m:sSup>...
  prev = '';
  while (prev !== str && str.includes('<m:sSup')) {
    prev = str;
    str = str.replace(/<m:sSup[^>]*>([\s\S]*?)<\/m:sSup>/gi, (_m, inner) => {
      const e = convertOmmlToLatex(extractInner(inner, 'e')).trim();
      const sup = convertOmmlToLatex(extractInner(inner, 'sup')).trim();
      return `{${e}}^{${sup}}`;
    });
  }

  // 5. Subscript: <m:sSub>...
  prev = '';
  while (prev !== str && str.includes('<m:sSub')) {
    prev = str;
    str = str.replace(/<m:sSub[^>]*>([\s\S]*?)<\/m:sSub>/gi, (_m, inner) => {
      const e = convertOmmlToLatex(extractInner(inner, 'e')).trim();
      const sub = convertOmmlToLatex(extractInner(inner, 'sub')).trim();
      return `{${e}}_{${sub}}`;
    });
  }

  // 6. Delimiters / Parentheses: <m:d>...<m:e>...</m:e>...</m:d>
  str = str.replace(/<m:d[^>]*>([\s\S]*?)<\/m:d>/gi, (_m, inner) => {
    const e = convertOmmlToLatex(extractInner(inner, 'e')).trim();
    return `\\left(${e}\\right)`;
  });

  // 7. Equation arrays / systems of equations: <m:eqArr>...
  str = str.replace(/<m:eqArr[^>]*>([\s\S]*?)<\/m:eqArr>/gi, (_m, inner) => {
    const lines = inner
      .split(/<\/m:e>/i)
      .map((part: string) => convertOmmlToLatex(part).trim())
      .filter(Boolean);
    return `\\begin{cases} ${lines.join(' \\\\ ')} \\end{cases}`;
  });

  // 8. Extract raw text from <m:t>
  str = str.replace(/<m:t[^>]*>([^<]*)<\/m:t>/gi, '$1');

  // Strip remaining XML tags
  str = str.replace(/<[^>]+>/g, '').trim();
  return str;
}

/**
 * 1. Parse DOCX via JSZip deep XML run extraction + Mammoth HTML conversion
 * Preserves underline, bold, custom font colors (red FF0000, etc.), highlight yellow,
 * and converts OMML equations to KaTeX LaTeX syntax.
 */
async function parseDocxWithDiagrams(
  buffer: ArrayBuffer
): Promise<{ text: string; diagrams: Record<string, string> }> {
  const diagrams: Record<string, string> = {};
  let processedBuffer = buffer;

  // Deep inspect and enrich word/document.xml with JSZip
  try {
    const zip = await JSZip.loadAsync(buffer);

    // Extract embedded media/images
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

    const docXmlEntry = zip.files['word/document.xml'];
    if (docXmlEntry) {
      let docXml = await docXmlEntry.async('string');

      // 1. Convert OMML to LaTeX inside <w:t> runs
      docXml = docXml.replace(/<m:oMathPara[^>]*>([\s\S]*?)<\/m:oMathPara>/gi, (_m, inner) => {
        const latex = convertOmmlToLatex(inner);
        return `<w:r><w:t xml:space="preserve"> $${latex}$ </w:t></w:r>`;
      });

      docXml = docXml.replace(/<m:oMath[^>]*>([\s\S]*?)<\/m:oMath>/gi, (_m, inner) => {
        const latex = convertOmmlToLatex(inner);
        return `<w:r><w:t xml:space="preserve"> $${latex}$ </w:t></w:r>`;
      });

      // 2. Identify colored (red, etc.), highlighted, shaded, or underlined option badges in runs
      docXml = docXml.replace(/<w:r(?:[\s>][\s\S]*?)<\/w:r>/gi, (runXml) => {
        const isUnderline = /<w:u(?:\s+[^>]*w:val="(?!none)[^"]*"|\s*\/?>)/i.test(runXml);
        const isHighlight = /<w:highlight(?:\s+[^>]*w:val="(?!none|white)[^"]*")/i.test(runXml);
        const isShading = /<w:shd(?:\s+[^>]*w:fill="(?!auto|none|ffffff|FFFFFF)[^"]*")/i.test(runXml);
        // Non-default colors: red FF0000/C00000, orange, blue, green, etc.
        const isColored = /<w:color(?:\s+[^>]*w:val="(?!auto|none|000000|222222|333333)[^"]*")/i.test(runXml);

        if (isUnderline || isHighlight || isShading || isColored) {
          // If this run starts with option indicator (A., B., C., D., a), b), c), d), *A., etc.)
          return runXml.replace(
            /(<w:t[^>]*>)(\s*\*?[\(\[]?[A-Da-d][\)\]\.:\-])/gi,
            '$1[CORRECT_OPT] $2'
          );
        }
        return runXml;
      });

      zip.file('word/document.xml', docXml);
      processedBuffer = await zip.generateAsync({ type: 'arraybuffer' });
    }
  } catch (err) {
    console.warn('[DOCX JSZip Deep Extraction Warning]:', err);
  }

  // Convert to HTML via mammoth with style maps
  let text = '';
  try {
    const mammoth = await import('mammoth');
    const result = await mammoth.convertToHtml(
      { arrayBuffer: processedBuffer },
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
    text = decoder.decode(processedBuffer);
  }

  return { text, diagrams };
}

/**
 * Converts Word Mammoth HTML to structured text while preserving correct-answer tokens and tables
 */
export function convertDocxHtmlToText(html: string): string {
  let processed = html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/&nbsp;/gi, ' ');

  // Preserve table cells: replace </td> with tab, </tr> with newline
  processed = processed
    .replace(/<\/td>\s*<td[^>]*>/gi, '\t')
    .replace(/<\/td>/gi, '\t')
    .replace(/<\/tr>/gi, '\n');

  // 1. Detect underlined or bolded option headers: <u>A.</u> or <strong>A.</strong>
  processed = processed.replace(
    /(?:<p>|\n|^|\s*)(?:<u>|<strong>|<b>)\s*(\*?\s*[\(\[]?[A-Da-d][\)\]\.:\-]\s*[\s\S]*?)(?:<\/u>|<\/strong>|<\/b>)/gi,
    (_match, inner) => `\n[CORRECT_OPT] ${inner}`
  );

  // 2. Option letter only styled: <u>A</u>. or <strong>A</strong>.
  processed = processed.replace(
    /(?:<p>|\n|^|\s*)(?:<u>|<strong>|<b>)\s*(\*?\s*[\(\[]?[A-Da-d][\)\]]?)\s*(?:<\/u>|<\/strong>|<\/b>)\s*([\.:\-])/gi,
    '\n[CORRECT_OPT] $1$2'
  );

  // 3. Asterisk preceding option: *A. or * A.
  processed = processed.replace(
    /(?:^|\n|\s+)\*\s*([\(\[]?[A-Da-d][\)\]\.:\-])/gi,
    '\n[CORRECT_OPT] $1'
  );

  // 4. Strip remaining HTML tags
  return processed.replace(/<[^>]+>/g, '');
}

/**
 * 2. Parse PDF via pdfjs-dist with Dynamic Y-Tolerance, Subscript/Superscript Clustering,
 * and Automatic Two-Column Layout Detection.
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
        height: number;
        width: number;
        hasEOL: boolean;
      }

      const items: PositionedItem[] = [];
      for (const item of textContent.items) {
        if ('str' in item && typeof item.str === 'string') {
          const transform = (item.transform as number[]) || [1, 0, 0, 1, 0, 0];
          const height = Math.abs(transform[3] ?? 12) || (item as unknown as { height?: number }).height || 12;
          items.push({
            str: item.str,
            x: transform[4] ?? 0,
            y: transform[5] ?? 0,
            height,
            width: (item as unknown as { width?: number }).width || 0,
            hasEOL: !!(item as unknown as { hasEOL?: boolean }).hasEOL,
          });
        }
      }

      if (items.length === 0) continue;

      // 1. Two-Column Layout Detection
      const xs = items.map((it) => it.x);
      const minX = Math.min(...xs, 0);
      const maxX = Math.max(...xs, 600);
      const midX = (minX + maxX) / 2;
      const gutterWidth = Math.max(20, (maxX - minX) * 0.08);
      const gutterLeft = midX - gutterWidth / 2;
      const gutterRight = midX + gutterWidth / 2;

      const leftItems = items.filter((it) => it.x + it.width <= gutterRight);
      const rightItems = items.filter((it) => it.x >= gutterLeft);
      const crossingItems = items.filter((it) => it.x < gutterLeft && it.x + it.width > gutterRight);

      const isTwoColumn =
        items.length >= 20 &&
        crossingItems.length <= items.length * 0.04 &&
        leftItems.length >= items.length * 0.25 &&
        rightItems.length >= items.length * 0.25;

      const columnItemGroups: PositionedItem[][] = isTwoColumn ? [leftItems, rightItems] : [items];
      const pageLines: string[] = [];

      for (const columnItems of columnItemGroups) {
        // Sort items in this column: Y descending (top to bottom), X ascending (left to right)
        columnItems.sort((a, b) => b.y - a.y || a.x - b.x);

        let currentLineItems: PositionedItem[] = [];
        let currentLineY: number | null = null;
        let currentLineAvgHeight = 12;

        for (const it of columnItems) {
          if (!it.str && !it.hasEOL) continue;

          const dynamicTolerance = Math.max(4.5, currentLineAvgHeight * 0.55);
          const isCloseY = currentLineY !== null && Math.abs(currentLineY - it.y) <= dynamicTolerance;

          // Subscript / Superscript clustering
          const prevItem = currentLineItems[currentLineItems.length - 1];
          const isSubOrSup =
            prevItem &&
            it.height < currentLineAvgHeight * 0.78 &&
            Math.abs(currentLineY! - it.y) <= currentLineAvgHeight * 0.95 &&
            it.x - (prevItem.x + prevItem.width) <= currentLineAvgHeight * 0.85;

          if (currentLineY === null || isCloseY || isSubOrSup) {
            currentLineItems.push(it);
            if (currentLineY === null) {
              currentLineY = it.y;
              currentLineAvgHeight = it.height || 12;
            } else {
              currentLineAvgHeight =
                (currentLineAvgHeight * (currentLineItems.length - 1) + (it.height || 12)) / currentLineItems.length;
            }
          } else {
            // Commit previous line
            currentLineItems.sort((a, b) => a.x - b.x);
            const lineStr = assembleLineText(currentLineItems);
            if (lineStr.trim()) pageLines.push(lineStr);

            currentLineItems = [it];
            currentLineY = it.y;
            currentLineAvgHeight = it.height || 12;
          }

          if (it.hasEOL) {
            currentLineItems.sort((a, b) => a.x - b.x);
            const lineStr = assembleLineText(currentLineItems);
            if (lineStr.trim()) pageLines.push(lineStr);
            currentLineItems = [];
            currentLineY = null;
            currentLineAvgHeight = 12;
          }
        }

        if (currentLineItems.length > 0) {
          currentLineItems.sort((a, b) => a.x - b.x);
          const lineStr = assembleLineText(currentLineItems);
          if (lineStr.trim()) pageLines.push(lineStr);
        }
      }

      fullText += `\n[--- Trang ${pageNum} ---]\n` + pageLines.join('\n') + '\n';
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
 * Sequential Anchor Splitting to avoid splitting geometry/chemistry variables (e.g. "Cho tam giác ABC. Tính góc B.").
 * Only splits lines that start with an option marker and follow ascending sequence A -> B -> C -> D.
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

    // Must start with option A (with optional [CORRECT_OPT] or asterisk):
    const startsWithA = /^\s*(?:\[CORRECT_OPT\]\s*)?\*?[\(\[]?A[\)\]\.:\-]\s+/i.test(trimmed);
    const startsWithC = /^\s*(?:\[CORRECT_OPT\]\s*)?\*?[\(\[]?C[\)\]\.:\-]\s+/i.test(trimmed);

    // Look for subsequent option anchors
    const bPos = trimmed.search(/(?<=[^\s])(?:\s{2,}|\t|\s+)(?:\[CORRECT_OPT\]\s*)?\*?[\(\[]?B[\)\]\.:\-]\s+/i);
    const cPos = trimmed.search(/(?<=[^\s])(?:\s{2,}|\t|\s+)(?:\[CORRECT_OPT\]\s*)?\*?[\(\[]?C[\)\]\.:\-]\s+/i);
    const dPos = trimmed.search(/(?<=[^\s])(?:\s{2,}|\t|\s+)(?:\[CORRECT_OPT\]\s*)?\*?[\(\[]?D[\)\]\.:\-]\s+/i);

    // Case 1: 4 options on 1 line: A -> B -> C -> D
    if (startsWithA && bPos > 0 && cPos > bPos && dPos > cPos) {
      const optA = trimmed.substring(0, bPos).trim();
      const optB = trimmed.substring(bPos, cPos).trim();
      const optC = trimmed.substring(cPos, dPos).trim();
      const optD = trimmed.substring(dPos).trim();
      normalizedLines.push(optA, optB, optC, optD);
      continue;
    }

    // Case 2: 2 options on line 1: A -> B
    if (startsWithA && bPos > 0 && cPos === -1 && dPos === -1) {
      const optA = trimmed.substring(0, bPos).trim();
      const optB = trimmed.substring(bPos).trim();
      normalizedLines.push(optA, optB);
      continue;
    }

    // Case 3: 2 options on line 2: C -> D
    if (startsWithC && dPos > 0 && bPos === -1) {
      const optC = trimmed.substring(0, dPos).trim();
      const optD = trimmed.substring(dPos).trim();
      normalizedLines.push(optC, optD);
      continue;
    }

    // Case 4: 3 options on line: A -> B -> C
    if (startsWithA && bPos > 0 && cPos > bPos && dPos === -1) {
      const optA = trimmed.substring(0, bPos).trim();
      const optB = trimmed.substring(bPos, cPos).trim();
      const optC = trimmed.substring(cPos).trim();
      normalizedLines.push(optA, optB, optC);
      continue;
    }

    // Default: line does not begin with sequential option anchor (e.g. geometry problem)
    normalizedLines.push(line);
  }

  return normalizedLines.join('\n');
}

export interface EndOfFileExtractionResult {
  answerMap: Map<number, number[]>;
  trueFalseMap: Map<number, Record<'a' | 'b' | 'c' | 'd', boolean>>;
  shortAnswerMap: Map<number, string>;
  explanationMap: Map<number, string>;
  cleanText: string;
}

/**
 * 4. Safe End-of-File Answer Key & Detailed Explanation Extractor
 * Supports Part I (ABCD), Part II (True/False 4-items), and Part III (Short answer)
 * as well as extracting HƯỚNG DẪN GIẢI CHI TIẾT into individual explanations.
 */
export function extractEndOfFileAnswerKey(rawText: string): EndOfFileExtractionResult {
  const answerMap = new Map<number, number[]>();
  const trueFalseMap = new Map<number, Record<'a' | 'b' | 'c' | 'd', boolean>>();
  const shortAnswerMap = new Map<number, string>();
  const explanationMap = new Map<number, string>();
  const letterMap: Record<string, number> = { A: 0, B: 1, C: 2, D: 3 };

  // Match standalone header on a single line
  const tableHeaderRegex = /(?:^|\n)\s*(?:BẢNG\s+(?:TRA\s+|TỔNG\s+HỢP\s+)?ĐÁP\s*ÁN|ĐÁP\s*ÁN(?:\s+(?:CHI\s+TIẾT|TRẮC\s+NGHIỆM|CÁC\s+CÂU|THAM\s+KHẢO|ĐỀ\s+THI))?|ANSWER\s+KEY|KEY\s+ĐÁP\s*ÁN|HƯỚNG\s+DẪN\s+CHẤM(?:\s+VÀ\s+ĐÁP\s*ÁN)?|HƯỚNG\s+DẪN\s+GIẢI(?:\s+CHI\s+TIẾT)?|LỜI\s+GIẢI\s+CHI\s+TIẾT)\s*[:\-\—\–]?\s*(?:\n|$)/i;

  const match = rawText.match(tableHeaderRegex);
  if (!match || match.index === undefined) {
    return { answerMap, trueFalseMap, shortAnswerMap, explanationMap, cleanText: rawText };
  }

  const tableStart = match.index;
  const tableText = rawText.substring(tableStart);

  // 1. Check for 2-row table grids e.g. "Câu: 1 2 3" / "Đ/A: A B C"
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

  // 2. Match standard Multiple Choice pairs: "1. A", "1-A", "1: A", "1 A", "Câu 1: A"
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

  // 3. Match True/False Group answers: e.g. "1: a-Đ, b-S, c-Đ, d-Đ" or "Câu 1: a. Đúng, b. Sai..."
  const tfRegex = /(?:Câu\s*)?\b(\d+)[\s.:\-=]+(?=[a-d][\s.:\-=]+(?:Đ|S|Đúng|Sai|True|False))/gi;
  let tfMatch: RegExpExecArray | null;
  while ((tfMatch = tfRegex.exec(tableText)) !== null) {
    const qNum = parseInt(tfMatch[1] ?? '', 10);
    const subStr = tableText.substring(tfMatch.index, tfMatch.index + 120);
    const subRecord: Record<'a' | 'b' | 'c' | 'd', boolean> = { a: true, b: false, c: false, d: false };

    ['a', 'b', 'c', 'd'].forEach((subKey) => {
      const subItemRegex = new RegExp(`${subKey}[\\s.:\\-=]+(Đ|S|Đúng|Sai|True|False)`, 'i');
      const m = subStr.match(subItemRegex);
      if (m?.[1]) {
        const val = m[1].toUpperCase();
        subRecord[subKey as 'a' | 'b' | 'c' | 'd'] = val.startsWith('Đ') || val.startsWith('T');
      }
    });

    if (!isNaN(qNum)) {
      trueFalseMap.set(qNum, subRecord);
      pairCount++;
    }
  }

  // 4. Match Short Answer numerical items: e.g. "Câu 1: 12,5" or "1: -4.5"
  const shortRegex = /(?:Câu\s*)?\b(\d+)[\s.:\-=]+([+-]?\d+(?:[.,]\d+)?)\b/gi;
  let shortMatch: RegExpExecArray | null;
  while ((shortMatch = shortRegex.exec(tableText)) !== null) {
    const qNum = parseInt(shortMatch[1] ?? '', 10);
    const ansVal = (shortMatch[2] ?? '').trim();
    if (!isNaN(qNum) && ansVal && !answerMap.has(qNum)) {
      shortAnswerMap.set(qNum, ansVal);
      pairCount++;
    }
  }

  // 5. Extract Detailed Explanation section (HƯỚNG DẪN GIẢI CHI TIẾT)
  const expSectionMatch = tableText.match(
    /(?:HƯỚNG\s+DẪN\s+GIẢI(?:\s+CHI\s+TIẾT)?|LỜI\s+GIẢI\s+CHI\s+TIẾT)[\s\S]*$/i
  );
  if (expSectionMatch) {
    const expText = expSectionMatch[0];
    const expItemRegex = /(?:^|\n)\s*(?:(?:Câu\s*hỏi|Câu|Question|Bài)\s*(\d+)[:.\s/—–\)-]+|\b(\d+)[\.:\)]\s+)([\s\S]*?)(?=(?:\n\s*(?:(?:Câu\s*hỏi|Câu|Question|Bài)\s*\d+|\d+[\.:\)])|$))/gi;
    let expItem: RegExpExecArray | null;
    while ((expItem = expItemRegex.exec(expText)) !== null) {
      const qNum = parseInt(expItem[1] || expItem[2] || '', 10);
      const detail = (expItem[3] ?? '').trim();
      if (!isNaN(qNum) && detail) {
        explanationMap.set(qNum, detail);
      }
    }
  }

  // Validate cutoff
  const isReasonable =
    rawText.length < 3000 || tableStart >= rawText.length * 0.4 || pairCount >= 2 || parsedFromGrid;

  if (isReasonable && (answerMap.size > 0 || trueFalseMap.size > 0 || shortAnswerMap.size > 0)) {
    const cleanText = rawText.substring(0, tableStart).trim();
    return { answerMap, trueFalseMap, shortAnswerMap, explanationMap, cleanText };
  }

  return { answerMap, trueFalseMap, shortAnswerMap, explanationMap, cleanText: rawText };
}

/**
 * 5. Intelligent Heuristic Tokenizer for Exam Documents (Parser Engine 4.0)
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

  // Extract End-of-File Answer Key Table and Explanations
  const {
    answerMap: endAnswerKey,
    trueFalseMap: endTrueFalseKey,
    shortAnswerMap: endShortKey,
    explanationMap: endExplanationKey,
    cleanText: questionBodyText,
  } = extractEndOfFileAnswerKey(clean);

  // Pre-normalize horizontal/inline options using sequential anchor splitting
  const bodyWithNormalizedOptions = normalizeInlineOptions(questionBodyText);

  // Flexible question split regex: matches "Câu 1:", "Question 1.", "Bài 1 -", "1.", "1)", "Q1:"
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
    const hasOptions = /(?:^[A-Da-d][:.)]|^O:|^\[CORRECT_OPT\])/m.test(trimmed);
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

    if (parsedQ) {
      // 1. Attach explanation from end-of-file explanation section if not already present
      if (!parsedQ.explanation && endExplanationKey.has(questionCounter)) {
        parsedQ.explanation = endExplanationKey.get(questionCounter);
      }

      // 2. Attach answers for Part I (Multiple Choice)
      if (
        (parsedQ.type === 'single' || parsedQ.type === 'multiple' || parsedQ.type === 'multiple_choice') &&
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

      // 3. Attach answers for Part II (True/False Group)
      if (parsedQ.type === 'true_false_group' && endTrueFalseKey.has(questionCounter)) {
        const tfAns = endTrueFalseKey.get(questionCounter)!;
        if (parsedQ.subItems) {
          parsedQ.subItems.forEach((sub) => {
            if (tfAns[sub.id] !== undefined) {
              sub.isCorrect = tfAns[sub.id];
            }
          });
          parsedQ.correctAnswer = parsedQ.subItems
            .map((sub, i) => (sub.isCorrect ? i : -1))
            .filter((i) => i >= 0);
          parsedQ.hasExplicitAnswer = true;
        }
      }

      // 4. Attach answers for Part III (Short Answer)
      if (parsedQ.type === 'short_answer' && endShortKey.has(questionCounter)) {
        parsedQ.shortAnswerKey = endShortKey.get(questionCounter);
        parsedQ.hasExplicitAnswer = true;
      }

      // Validation warnings
      if (
        (parsedQ.type === 'single' || parsedQ.type === 'multiple_choice') &&
        parsedQ.options.length < 4
      ) {
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
 * Parse an isolated question chunk into Question entity supporting 3 types:
 * multiple_choice, true_false_group, and short_answer.
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
  if (lines.length === 0) return null;

  let questionText = '';
  const options: string[] = [];
  let correctAnswers: number[] = [];
  let hasExplicitAnswer = false;
  let explanation = '';
  let questionType: QuestionType = 'single';
  let shortAnswerKey: string | undefined = undefined;
  let subItems: TrueFalseSubItem[] | undefined = undefined;
  const localPassage = globalPassage;
  let codeSnippet: { code: string; language: string } | undefined = undefined;

  // Check code block ```lang ... ```
  const codeMatch = chunk.match(/```([a-zA-Z0-9_+-]*)\n([\s\S]*?)```/);
  if (codeMatch?.[2]) {
    codeSnippet = {
      code: codeMatch[2].trim(),
      language: codeMatch[1]?.trim() || 'plaintext',
    };
  }

  // 1. Detect standard ABCD options (Strictly UPPERCASE A-D without /i flag so it never confuses lowercase a-d sub-items)
  const hasABCDOptions = /^\s*(?:\[CORRECT_OPT\]\s*)?[A-D][\.:\)]/m.test(chunk);

  // 2. Detect True/False Group (Part II sub-items a), b), c), d))
  // Sub-items specifically start with lowercase [a-d] without case-insensitivity
  const subItemLines = lines.filter((l) => /^\s*(?:\[CORRECT_OPT\]\s*)?[\(\[]?[a-d][\)\]\.:\-]\s+/.test(l));
  const hasTfPreamble = /(?:đúng\s*[-/]?\s*sai|true\s*[-/]?\s*false|Đ\/S)/i.test(chunk);
  const hasTfMarkers = /\((?:đúng|sai|true|false|[ĐS])\)/i.test(chunk);
  const isTrueFalseGroup =
    !hasABCDOptions && subItemLines.length >= 2 && (hasTfPreamble || hasTfMarkers || subItemLines.length === 4);

  // 3. Detect Short Answer (Part III - no A/B/C/D, no sub-items, and has "Đáp số:" / "Đáp án:" with value)
  const shortAnsMatch = chunk.match(/(?:Đáp\s*số|Đáp\s*án|Key|Kết\s*quả)[:\s]+([+-]?\d+(?:[.,]\d+)?|[a-zA-Z0-9_-]+)/i);
  const isShortAnswer = !hasABCDOptions && !isTrueFalseGroup && !!shortAnsMatch;

  if (isTrueFalseGroup) {
    questionType = 'true_false_group';
    subItems = [];
    const detectedSubs: TrueFalseSubItem[] = [];

    for (let i = 0; i < lines.length; i++) {
      let line = lines[i]!;

      // Check explanation
      const expMatch = line.match(/(?:Lời\s*giải|Explanation|HD|Hướng\s*dẫn|Giải\s*thích)[:\s]+([\s\S]*)/i);
      if (expMatch) {
        explanation = lines.slice(i).join('\n').replace(/^(?:Lời\s*giải|Explanation|HD|Hướng\s*dẫn|Giải\s*thích)[:\s]*/i, '').trim();
        break;
      }

      let isCorrect = false;
      if (line.startsWith('[CORRECT_OPT]')) {
        isCorrect = true;
        line = line.replace(/^\[CORRECT_OPT\]\s*/, '');
      }

      const subMatch = line.match(/^\s*[\(\[]?([a-d])[\)\]\.:\-]\s*(.*)/i);
      if (subMatch) {
        const subId = (subMatch[1] ?? 'a').toLowerCase() as 'a' | 'b' | 'c' | 'd';
        let subText = (subMatch[2] ?? '').trim();

        if (/\((?:đáp\s*án\s*đúng|đúng|true|Đ)\)\s*$/i.test(subText)) {
          isCorrect = true;
          subText = subText.replace(/\((?:đáp\s*án\s*đúng|đúng|true|Đ)\)\s*$/i, '').trim();
        } else if (/\((?:sai|false|S)\)\s*$/i.test(subText)) {
          isCorrect = false;
          subText = subText.replace(/\((?:sai|false|S)\)\s*$/i, '').trim();
        }

        detectedSubs.push({ id: subId, text: subText, isCorrect });
        options.push(`${subId.toUpperCase()}. ${subText}`);
      } else if (detectedSubs.length === 0) {
        // Still accumulating question title
        const cleanLine = line
          .replace(/^(?:(?:Câu\s*hỏi|Câu|Question|Bài|Q)\s*\d+[:.\s/—–\)-]*|\d+(?:\([^)]*\))?[:.\s/—–\)>]\s*)/i, '')
          .trim();
        if (cleanLine) {
          questionText = questionText ? `${questionText}\n${cleanLine}` : cleanLine;
        }
      }
    }

    subItems = detectedSubs;
    correctAnswers = subItems.map((s, idx) => (s.isCorrect ? idx : -1)).filter((idx) => idx >= 0);
    hasExplicitAnswer = isCorrectOptionFound(chunk);
  } else if (isShortAnswer) {
    questionType = 'short_answer';
    shortAnswerKey = shortAnsMatch ? shortAnsMatch[1]?.trim() : undefined;
    hasExplicitAnswer = !!shortAnswerKey;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      const expMatch = line.match(/(?:Lời\s*giải|Explanation|HD|Hướng\s*dẫn|Giải\s*thích)[:\s]+([\s\S]*)/i);
      if (expMatch) {
        explanation = lines.slice(i).join('\n').replace(/^(?:Lời\s*giải|Explanation|HD|Hướng\s*dẫn|Giải\s*thích)[:\s]*/i, '').trim();
        break;
      }
      if (!/(?:Đáp\s*số|Đáp\s*án|Key|Kết\s*quả)[:\s]+/i.test(line)) {
        const cleanLine = line
          .replace(/^(?:(?:Câu\s*hỏi|Câu|Question|Bài|Q)\s*\d+[:.\s/—–\)-]*|\d+(?:\([^)]*\))?[:.\s/—–\)>]\s*)/i, '')
          .trim();
        if (cleanLine) {
          questionText = questionText ? `${questionText}\n${cleanLine}` : cleanLine;
        }
      }
    }
  } else {
    // 3. Standard Part I Multiple Choice (ABCD)
    let inOptions = false;

    for (let i = 0; i < lines.length; i++) {
      let line = lines[i]!;

      // Tag format: Q:, T:, O:, A:, E:
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

      // Standard format: "Đáp án: A", "Chọn B", "Key: C"
      const ansMatch = line.match(/(?:Đáp\s*án(?:\s*đúng)?|Answer|Key|Chọn)[:\s]+([A-D0-9,\s]+)/i);
      if (ansMatch?.[1]) {
        correctAnswers = parseLetterAnswerIndices(ansMatch[1].trim());
        hasExplicitAnswer = true;
        continue;
      }

      const expMatch = line.match(/(?:Lời\s*giải|Explanation|HD|Hướng\s*dẫn|Giải\s*thích)[:\s]+([\s\S]*)/i);
      if (expMatch) {
        explanation = lines.slice(i).join('\n').replace(/^(?:Lời\s*giải|Explanation|HD|Hướng\s*dẫn|Giải\s*thích)[:\s]*/i, '').trim();
        break;
      }

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

      // Accumulate question title
      if (!inOptions) {
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

    if (options.length === 0) {
      options.push('Đúng (True)', 'Sai (False)');
      questionType = 'true_false';
    }

    if (correctAnswers.length === 0) {
      correctAnswers = [0];
    } else if (correctAnswers.length > 1) {
      questionType = 'multiple';
    } else {
      questionType = 'single';
    }
  }

  // Fallback questionText
  if (!questionText && lines.length > 0) {
    questionText = (lines[0] ?? '').replace(
      /^(?:(?:Câu\s*hỏi|Câu|Question|Bài|Q)\s*\d+[:.\s/—–\)-]*|\d+(?:\([^)]*\))?[:.\s/—–\)>]\s*)/i,
      ''
    );
  }

  return {
    id: `q_${index}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    index,
    text: questionText.trim(),
    type: questionType,
    options,
    correctAnswer: correctAnswers,
    shortAnswerKey,
    subItems,
    hasExplicitAnswer,
    explanation: explanation.trim() || undefined,
    passage: localPassage,
    subject: subjectHint || 'Chung',
    imageUrl: diagramUrl,
    codeSnippet,
    rawText: chunk.trim(),
  };
}

function isCorrectOptionFound(chunk: string): boolean {
  return /\[CORRECT_OPT\]|\((?:đáp\s*án\s*đúng|đúng|true|Đ)\)/i.test(chunk);
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
