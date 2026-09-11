/**
 * parser.js - Question Bank Parsing, Auto-LaTeX Enhancement & Validation Module
 */
const QuestionParser = (() => {
    /**
     * Auto-wrap naked LaTeX commands and Chemistry formulas outside of $ ... $
     * in inline math & mhchem delimiters.
     */
    function autoWrapMath(text) {
        if (!text || typeof text !== 'string') return '';

        // Split text by math delimiters $ ... $ or $$ ... $$ to process only plain text parts
        const parts = text.split(/(\$\$[\s\S]*?\$\$|\$[^\$]*?\$)/g);

        // Regex to match chemical formulas like H2SO4, Fe2(SO4)3, CH3COOH, C2H5OH, BaCl2, NaOH, (C17H35COO)3C3H5
        const chemRegex = /(?:^|(?<=[^A-Za-z0-9_]))((?:\d+\s*)?(?:\([A-Z][a-zA-Z0-9]*\)\d*|[A-Z][a-z]?(?:\d+|[A-Z][a-z]?|\([A-Za-z0-9]+\)\d*)*)+(?:\^?\d*[\+\-])?)(?=[^A-Za-z0-9_]|$)/g;
        const chemElemSeq = /^(?:He|Li|Be|Ne|Na|Mg|Al|Si|Cl|Ar|Ca|Sc|Ti|Cr|Mn|Fe|Co|Ni|Cu|Zn|Ga|Ge|As|Se|Br|Kr|Rb|Sr|Zr|Nb|Mo|Ru|Rh|Pd|Ag|Cd|In|Sn|Sb|Te|Xe|Cs|Ba|La|Ce|Pt|Au|Hg|Pb|Bi|H|B|C|N|O|F|P|S|K|V|Y|I|W|\d|\(|\))+$/;

        for (let i = 0; i < parts.length; i++) {
            // Even indices are plain text outside math delimiters
            if (i % 2 === 0) {
                let part = parts[i];

                // 1. Convert reaction arrows in chemistry outside math
                part = part.replace(/\s*->\s*/g, ' $\\rightarrow$ ');
                part = part.replace(/\s*-->\s*/g, ' $\\rightarrow$ ');
                part = part.replace(/\s*<=>\s*/g, ' $\\rightleftharpoons$ ');
                part = part.replace(/\s*<->\s*/g, ' $\\rightleftharpoons$ ');

                // 2. Wrap chemical formulas with \ce{...}
                part = part.replace(chemRegex, (match) => {
                    const trimmed = match.trim();
                    // Exclude pure all-caps words without digits/parentheses/charges if length >= 3 (e.g. ESTE, LIPIT, THPT)
                    if (/^[A-Z]+$/.test(trimmed) && trimmed.length >= 3 && trimmed !== 'KOH' && trimmed !== 'HCN' && trimmed !== 'HCOOH') {
                        return match;
                    }

                    // Exclude common words that happen to look like element abbreviations
                    const ignoredWords = ['In', 'At', 'As', 'He', 'An', 'No', 'Or', 'On', 'Is', 'Am', 'Be', 'Do', 'So', 'To', 'Up', 'By', 'My', 'We', 'Go', 'Me', 'If', 'It', 'Cho', 'Khi', 'Các', 'Dung', 'Chất', 'Este', 'Không', 'Muối', 'Khí', 'Dạng', 'Dãy', 'Nhóm', 'Điểm', 'Giá', 'Tính', 'Theo', 'Sau', 'Bằng', 'Trong', 'Đoạn', 'Tìm', 'Biết', 'Một', 'CH', 'NG', 'VA'];
                    if (ignoredWords.includes(trimmed)) return match;

                    const isValidChemSeq = chemElemSeq.test(trimmed);
                    const hasDigit = /\d/.test(trimmed);
                    const hasParen = /[()]/.test(trimmed);
                    const hasCharge = /[+\-]/.test(trimmed);
                    const hasMultipleChemElements = (trimmed.match(/[A-Z]/g) || []).length >= 2 && isValidChemSeq;

                    if (hasDigit || hasParen || hasCharge || hasMultipleChemElements) {
                        return `$\\ce{${trimmed}}$`;
                    }
                    return match;
                });

                // 3. Detect LaTeX commands like \frac{...}{...}, \sqrt{...}, \lim_{...}, \int, \sum
                part = part.replace(/(\\(?:frac\{[^{}]*\}\{[^{}]*\}|sqrt\{[^{}]*\}|sqrt\[[^\[\]]*\]\{[^{}]*\}|lim_\{[^{}]*\}|int_[^\s^]*\^[^\s]*|sum_[^\s^]*\^[^\s]*|[a-zA-Z]+(?:_[0-9a-zA-Z]+|\^[0-9a-zA-Z]+)+))/g, '$$ $1 $$');
                // 4. Wrap standalone math symbols like \times, \pm, \le, \ge, \ne, \approx if not in math
                part = part.replace(/(\\(?:times|pm|le|ge|ne|approx|in|subset|cup|cap|infty|alpha|beta|theta|pi|Delta|omega|Omega|lambda|sigma))\b/g, '$$ $1 $$');

                parts[i] = part;
            }
        }

        return parts.join('');
    }

    /**
     * Safely format math, chemistry, code blocks, and images: auto-wrap LaTeX/mhchem,
     * render code snippets and diagrams, and protect math expressions from browser DOM tag swallowing.
     */
    /**
     * PRS-01: Normalize invisible, non-breaking, or non-standard Unicode whitespaces
     * and linebreaks commonly found in PDF/Word extractions into standard space (\u0020).
     */
    function normalizeUnicodeWhitespace(text) {
        if (!text || typeof text !== 'string') return '';
        return text
            // Unicode whitespace variants, zero-width spaces, BOM
            .replace(/[\u00A0\u1680\u180E\u2000-\u200A\u200B\u200C\u200D\u2028\u2029\u202F\u205F\u3000\uFEFF]/g, ' ')
            // Normalize CRLF to LF
            .replace(/\r\n/g, '\n')
            .replace(/\r/g, '\n');
    }

    /**
     * SEC-02: Robust HTML Sanitizer with safe tag whitelist, attribute verification,
     * inline event handler stripping, and URI scheme blocking.
     */
    function sanitizeHtml(html) {
        if (!html || typeof html !== 'string') return '';

        // 1. Completely remove dangerous executable tags and headers
        let clean = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
        clean = clean.replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '');
        clean = clean.replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '');
        clean = clean.replace(/<embed\b[^>]*\/?>/gi, '');
        clean = clean.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
        clean = clean.replace(/<form\b[^<]*(?:(?!<\/form>)<[^<]*)*<\/form>/gi, '');
        clean = clean.replace(/<meta\b[^>]*\/?>/gi, '');
        clean = clean.replace(/<link\b[^>]*\/?>/gi, '');

        // 2. Strip all inline on* event handlers (e.g. onerror, onclick, onload, etc.)
        clean = clean.replace(/\son[a-zA-Z]+\s*=\s*(?:'[^']*'|"[^"]*"|[^\s>]+)/gi, '');

        // 3. Block malicious schemes in src and href (javascript:, vbscript:, unsafe data:)
        clean = clean.replace(/\b(href|src)\s*=\s*(['"])\s*(?:javascript:|vbscript:|data:(?!image\/))\S*\2/gi, '$1=""');
        clean = clean.replace(/\b(href|src)\s*=\s*(?:javascript:|vbscript:|data:(?!image\/))\S+/gi, '$1=""');

        // 4. In browser environments, enforce strict DOMParser whitelist validation
        if (typeof window !== 'undefined' && window.DOMParser) {
            try {
                const doc = new DOMParser().parseFromString(clean, 'text/html');
                const allowedTags = new Set([
                    'DIV', 'SPAN', 'B', 'STRONG', 'EM', 'I', 'U', 'P', 'BR',
                    'TABLE', 'TR', 'TD', 'TH', 'THEAD', 'TBODY', 'CODE', 'PRE',
                    'IMG', 'SVG', 'PATH', 'SUP', 'SUB', 'BUTTON'
                ]);

                const allowedAttrs = new Set([
                    'class', 'id', 'src', 'alt', 'title', 'width', 'height',
                    'style', 'data-code', 'viewbox', 'd', 'fill', 'stroke',
                    'stroke-width', 'stroke-linecap', 'cx', 'cy', 'r'
                ]);

                const allElements = doc.body.querySelectorAll('*');
                allElements.forEach(el => {
                    const tag = el.tagName.toUpperCase();
                    if (!allowedTags.has(tag)) {
                        const textNode = doc.createTextNode(el.textContent || '');
                        el.parentNode ? el.parentNode.replaceChild(textNode, el) : el.remove();
                        return;
                    }

                    const attrs = Array.from(el.attributes);
                    for (const attr of attrs) {
                        const attrName = attr.name.toLowerCase();
                        if (attrName.startsWith('on') || !allowedAttrs.has(attrName)) {
                            el.removeAttribute(attr.name);
                            continue;
                        }

                        if (attrName === 'src' || attrName === 'href') {
                            const val = attr.value.trim().toLowerCase();
                            if (val.startsWith('javascript:') || val.startsWith('vbscript:')) {
                                el.removeAttribute(attr.name);
                            } else if (val.startsWith('data:') && !val.startsWith('data:image/')) {
                                el.removeAttribute(attr.name);
                            }
                        }
                    }
                });

                return doc.body.innerHTML;
            } catch (e) {
                return clean;
            }
        }

        return clean;
    }

    /**
     * Helper to safely escape HTML special characters inside code blocks and text.
     */
    function escapeHtml(str) {
        if (!str || typeof str !== 'string') return '';
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    /**
     * Safely format math, chemistry, code blocks, and images:
     * 1. Protect code blocks, inline code, and images with unique placeholders
     * 2. Auto-wrap LaTeX and Chemistry in the remaining narrative text
     * 3. Shield comparison operators (<, >) from DOM tag swallowing
     * 4. Restore code blocks with syntax styling, clipboard copy button, and escaped entities
     */
    function formatMathText(text) {
        if (!text || typeof text !== 'string') return '';

        const codeBlocks = [];
        const inlineCodes = [];
        const images = [];
        const htmlImages = [];

        // 1. Extract & protect fenced code blocks ```lang ... ```
        let processed = text.replace(/```([a-zA-Z0-9_\-]*)\s*([\s\S]*?)```/g, (match, lang, code) => {
            const idx = codeBlocks.length;
            codeBlocks.push({ lang: lang ? lang.trim() : '', code: code.trim() });
            return `%%%CODE_BLOCK_${idx}%%%`;
        });

        // 2. Extract & protect inline code `code`
        processed = processed.replace(/`([^`\r\n]+)`/g, (match, code) => {
            const idx = inlineCodes.length;
            inlineCodes.push(code);
            return `%%%INLINE_CODE_${idx}%%%`;
        });

        // 3. Extract & protect markdown images ![alt](src)
        processed = processed.replace(/!\[(.*?)\]\((.*?)\)/g, (match, alt, src) => {
            const idx = images.length;
            images.push({ alt, src });
            return `%%%QUIZ_IMG_${idx}%%%`;
        });

        // 4. Extract & protect direct HTML <img> tags (e.g. from Word docx conversion)
        processed = processed.replace(/<img\b([^>]*)\/?>/gi, (match) => {
            const idx = htmlImages.length;
            htmlImages.push(match);
            return `%%%HTML_IMG_${idx}%%%`;
        });

        // 5. Auto-wrap math & chemistry outside code blocks and images
        processed = autoWrapMath(processed);

        // 6. Shield relational '<' from HTML parsing (e.g. $0 < x < 5$)
        processed = processed.replace(/<(?!(?:\/?(?:span|div|b|strong|em|p|br|table|tr|td|th|img)\b))/gi, '&lt;');

        // 7. Restore markdown images
        processed = processed.replace(/%%%QUIZ_IMG_(\d+)%%%/g, (match, idx) => {
            const item = images[parseInt(idx, 10)];
            if (!item) return '';
            return `<div class="quiz-image-wrap" style="text-align: center; margin: 12px 0;"><img src="${item.src}" alt="${escapeHtml(item.alt)}" class="quiz-img"><br><span style="font-size: 0.85em; opacity: 0.8; font-style: italic;">${escapeHtml(item.alt)}</span></div>`;
        });

        // 8. Restore HTML <img> tags with quiz-img class for zoom support and strict XSS sanitization
        processed = processed.replace(/%%%HTML_IMG_(\d+)%%%/g, (match, idx) => {
            let imgTag = htmlImages[parseInt(idx, 10)];
            if (!imgTag) return '';
            // XSS sanitization: strip all inline event handlers (on*) and javascript: URIs
            imgTag = imgTag.replace(/\s+on[a-z]+\s*=\s*(?:'[^']*'|"[^"]*"|[^\s>]+)/gi, '');
            imgTag = imgTag.replace(/src\s*=\s*(?:'javascript:[^']*'|"javascript:[^"]*")/gi, 'src=""');

            if (!imgTag.includes('class=')) {
                imgTag = imgTag.replace(/<img\b/i, '<img class="quiz-img"');
            } else if (!imgTag.includes('quiz-img')) {
                imgTag = imgTag.replace(/class=["\'](.*?)["\']/i, 'class="$1 quiz-img"');
            }
            return `<div class="quiz-image-wrap" style="text-align: center; margin: 12px 0;">${imgTag}</div>`;
        });

        // 9. Restore inline code
        processed = processed.replace(/%%%INLINE_CODE_(\d+)%%%/g, (match, idx) => {
            const code = inlineCodes[parseInt(idx, 10)];
            if (code === undefined) return '';
            return `<code class="quiz-inline-code">${escapeHtml(code)}</code>`;
        });

        // 8. Restore fenced code blocks with clean syntax wrapper and functional copy button
        processed = processed.replace(/%%%CODE_BLOCK_(\d+)%%%/g, (match, idx) => {
            const item = codeBlocks[parseInt(idx, 10)];
            if (!item) return '';
            const langLabel = item.lang ? `<span class="code-lang-tag">${escapeHtml(item.lang)}</span>` : '<span class="code-lang-tag">CODE</span>';
            const escapedCode = escapeHtml(item.code);
            const encodedCode = encodeURIComponent(item.code);
            return `<div class="quiz-code-block-wrap"><div class="quiz-code-header">${langLabel}<button type="button" class="btn-copy-code" data-code="${encodedCode}">📋 Chép mã</button></div><pre class="quiz-code-block"><code>${escapedCode}</code></pre></div>`;
        });

        return sanitizeHtml(processed);
    }

    /**
     * Parse questions in CBT standard format (Q:, T:, O:, A:, E:).
     */
    function parseStandard(lines) {
        const questions = [];
        let currentQ = null;

        for (let line of lines) {
            line = line.trim();
            if (!line) continue;

            if (line.startsWith('Q: ')) {
                if (currentQ && isValidQuestion(currentQ)) {
                    questions.push(currentQ);
                }
                currentQ = {
                    q: line.substring(3).trim(),
                    options: [],
                    type: 'single',
                    answers: [],
                    explanation: ''
                };
            } else if (line.startsWith('T: ') && currentQ) {
                currentQ.type = line.substring(3).trim().toLowerCase() === 'multiple' ? 'multiple' : 'single';
            } else if (line.startsWith('O: ') && currentQ) {
                currentQ.options.push(line.substring(3).trim());
            } else if (line.startsWith('A: ') && currentQ) {
                currentQ.answers = line.substring(3).split(',').map(n => parseInt(n.trim(), 10)).filter(n => !isNaN(n));
            } else if (line.startsWith('E: ') && currentQ) {
                currentQ.explanation = line.substring(3).trim();
            }
        }

        if (currentQ && isValidQuestion(currentQ)) {
            questions.push(currentQ);
        }

        return questions;
    }

    /**
     * Clean common PDF noise artifacts, page breaks, and watermarks (e.g. Studocu headers, "Trang 1/10").
     */
    function cleanPdfNoise(text) {
        if (!text || typeof text !== 'string') return '';
        let cleaned = normalizeUnicodeWhitespace(text);
        return cleaned
            // Studocu and standard document headers/footers
            .replace(/--\s*\d+\s+of\s+\d+\s*--/gi, '')
            .replace(/lOMoARcPSD\|\d+/gi, '')
            .replace(/Downloaded by .+/gi, '')
            // Page markers like Trang 1/10 or Page 1 of 10
            .replace(/(?:^|\n)\s*(?:Trang|Page)\s+\d+(?:\s*(?:\/|of)\s*\d+)?\s*(?=\n|$)/gi, '\n')
            .replace(/\n{3,}/g, '\n\n');
    }

    /**
     * Extract trailing answer tables (BẢNG ĐÁP ÁN, ĐÁP ÁN, ANSWER KEY, grid tables, or end-of-file answer keys).
     */
    function extractTrailingAnswerTable(rawText) {
        if (!rawText || typeof rawText !== 'string') return { cleanText: rawText, keyMap: {} };

        // 1. Explicit answer table headers
        const tableHeaderRegex = /(?:^|\n+)\s*(?:BẢNG\s+(?:TRA\s+|TỔNG\s+HỢP\s+)?ĐÁP\s*ÁN|ĐÁP\s*ÁN(?:\s+(?:CHI\s+TIẾT|TRẮC\s+NGHIỆM|CÁC\s+CÂU|THAM\s+KHẢO|ĐỀ\s+THI))?|HƯỚNG\s+DẪN\s+CHẤM(?:\s+VÀ\s+ĐÁP\s*ÁN)?|ANSWER\s+KEY|KEY\s+(?:ĐÁP\s*ÁN|TABLE|ANSWERS?))[\s\:\-\—\–]*(?:\n+|$)([\s\S]+)$/i;

        let tableMatch = rawText.match(tableHeaderRegex);
        let tableText = '';
        let matchIndex = -1;

        if (tableMatch) {
            tableText = tableMatch[1];
            matchIndex = tableMatch.index;
        } else {
            // 2. Grid table e.g. "Câu | 1 | 2" followed by "Đ/A | C | B"
            const gridTableMatch = rawText.match(/(?:^|\n)\s*([|\s]*(?:Câu|Q|No)[\s|]*\d+[\s\d|]*\r?\n[|\s]*(?:Đ\/?A|Đáp\s*án|Key|Ans)[\s\S]*)$/i);
            if (gridTableMatch) {
                tableText = gridTableMatch[1];
                matchIndex = gridTableMatch.index;
            }
        }

        // 3. Fallback: Dense cluster of answer pairs towards the bottom of the document
        if (!tableText) {
            const lines = rawText.split(/\r?\n/);
            let answerBlockStartIndex = -1;
            let answerPairCount = 0;

            for (let i = lines.length - 1; i >= Math.max(0, lines.length - 60); i--) {
                const line = lines[i].trim();
                const pairsInLine = (line.match(/(?:Câu\s*)?\b\d+[\s.:\-\)\=]+[A-E]\b/gi) || []).length;
                if (pairsInLine >= 2 || (pairsInLine === 1 && line.length < 25)) {
                    answerPairCount += pairsInLine;
                    answerBlockStartIndex = i;
                } else if (answerPairCount >= 4) {
                    break;
                }
            }

            if (answerPairCount >= 4 && answerBlockStartIndex !== -1) {
                tableText = lines.slice(answerBlockStartIndex).join('\n');
                matchIndex = rawText.lastIndexOf(lines[answerBlockStartIndex]);
            }
        }

        if (!tableText) return { cleanText: rawText, keyMap: {} };

        const keyMap = {};
        let count = 0;

        // Parse row-based grids e.g.:
        // Câu | 1 | 2 | 3
        // Đ/A | A | B | C
        const gridRows = tableText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
        for (let r = 0; r < gridRows.length - 1; r++) {
            const row1 = gridRows[r];
            const row2 = gridRows[r + 1];
            if (/(?:^|[|\s])(?:Câu|Q|No)\b/i.test(row1) && /(?:^|[|\s])(?:Đ\/?A|Đáp\s*án|Key|Ans)\b/i.test(row2)) {
                const cleanRow1 = row1.replace(/^[|\s]*(?:câu|question|q|no)[\s|:.]*/i, '');
                const cleanRow2 = row2.replace(/^[|\s]*(?:đ\/?a|đáp\s*án|key|ans)[\s|:.]*/i, '');
                const qNums = (cleanRow1.match(/\b\d+\b/g) || []).map(Number);
                const answers = cleanRow2.match(/\b[A-E]\b/g) || [];
                if (qNums.length > 0 && qNums.length === answers.length) {
                    for (let k = 0; k < qNums.length; k++) {
                        keyMap[qNums[k]] = answers[k].toUpperCase().charCodeAt(0) - 65;
                        count++;
                    }
                    r++;
                }
            }
        }

        // Parse standard pairs: 1.A, 1-A, 1: A, Câu 1: A, 1. A, 1) A
        const pairRegex = /(?:Câu\s*)?\b(\d+)[\s.:\-\)\=]+([A-E])\b/gi;
        let p;
        while ((p = pairRegex.exec(tableText)) !== null) {
            const qNum = parseInt(p[1], 10);
            const letter = p[2].toUpperCase();
            if (keyMap[qNum] === undefined) {
                keyMap[qNum] = letter.charCodeAt(0) - 65;
                count++;
            }
        }

        if (count >= 2 && matchIndex !== -1) {
            const cleanText = rawText.substring(0, matchIndex).trim();
            return { cleanText, keyMap };
        }
        return { cleanText: rawText, keyMap: {} };
    }

    /**
     * Parse natural exam format commonly found in Word (.docx), PDF, and school exam papers
     * (Câu 1: ... A. ... B. ... C. ... D. ... Đáp án: ... Lời giải: ...).
     */
    function parseNatural(rawText) {
        const cleaned = cleanPdfNoise(rawText);
        const questions = [];
        const { cleanText, keyMap } = extractTrailingAnswerTable(cleaned);

        // Match start of question headers: Câu 1, Bài 1, Question 1, Q1, 1/, 1-, 1>, 1:, 1., Câu 1 (2.0 điểm):, etc.
        const qHeaderRegex = /(?:^|\n+)\s*(?:(?:Câu\s*hỏi|Câu|Question|Bài|Q)\s*(\d+)(?:\s*\([^\)]*\))?[\s:.\-\—\–\)\/]+|(\d+)(?:\s*\([^\)]*\))?[\s.:\)\/\-\>]\s+(?=[A-ZÀ-Ỹ\$\\\*0-9\(]))/gi;

        const matches = [];
        let match;
        while ((match = qHeaderRegex.exec(cleanText)) !== null) {
            matches.push({
                index: match.index,
                header: match[0],
                number: match[1] || match[2]
            });
        }

        if (matches.length === 0) return [];

        for (let i = 0; i < matches.length; i++) {
            const start = matches[i].index;
            const end = (i + 1 < matches.length) ? matches[i + 1].index : cleanText.length;
            const block = cleanText.substring(start, end).trim();
            const qNum = parseInt(matches[i].number, 10) || (i + 1);
            const parsed = parseSingleNaturalBlock(block, qNum, keyMap);
            if (parsed && isValidQuestion(parsed)) {
                questions.push(parsed);
            }
        }

        return questions;
    }

    function parseSingleNaturalBlock(block, qNum, keyMap) {
        const lines = block.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
        if (lines.length === 0) return null;

        let questionText = '';
        const options = [];
        let answers = [];
        let explanation = '';
        let readingState = 'q'; // 'q', 'exp'

        const optRegex = /^(?:[\*\-\s]*[\(\[]?([A-E])[\)\]\.\:\*\-\/]+\s*)(.+)$/i;
        const ansRegex = /^\s*(?:=>|->|⇒|→|[\*\-\>\•])?\s*\[?\s*(?:(?:Đáp\s*án(?:\s*đúng)?(?:\s*là)?|Đ\/?A|Chọn(?:\s*đáp\s*án)?|Answer|Key|Ans)[\s\:\=\]\.]*)\s*([A-E](?:\s*,\s*[A-E])*)/i;
        const arrowOrBracketAnsRegex = /^\s*(?:=>|->|⇒|→)?\s*[\(\[]?\s*([A-E])\s*[\)\]\.]?\s*$/i;
        const expRegex = /^\s*[\*\-\>\•]?\s*\[?\s*(?:Lời\s*giải(?:\s*chi\s*tiết)?|Hướng\s*dẫn(?:\s*giải)?|Giải(?:\s*chi\s*tiết)?|Explanation|Solution)[\]\s\:\.]*(.*)$/i;
        const expInlineAnsRegex = /(?:chọn(?:\s*đáp\s*án)?|đáp\s*án(?:\s*(?:đúng|là))?|key|answer)[\s\:\=]*([A-E])\b/i;

        // Remove initial header like "Câu 1:" or "1/" or "Câu 1 (2.0 điểm):" from first line
        let firstLine = lines[0].replace(/^(?:(?:Câu\s*hỏi|Câu|Question|Bài|Q)\s*\d+(?:\s*\([^\)]*\))?[\s:.\-\—\–\)\/]*|\d+(?:\s*\([^\)]*\))?[\s.:\)\/\-\>]\s*)/i, '').trim();

        // Check if inline answer exists in header e.g. "Câu 1: (Đáp án A) Cho hàm số..."
        const headerAnsMatch = firstLine.match(/[\(\[]\s*(?:Đáp\s*án(?:\s*đúng)?|Chọn|Answer|Key)[\s\:\=]*([A-E])\s*[\)\]]/i);
        if (headerAnsMatch) {
            answers.push(headerAnsMatch[1].toUpperCase().charCodeAt(0) - 65);
            firstLine = firstLine.replace(headerAnsMatch[0], '').trim();
        }
        questionText = firstLine;

        function cleanOptionText(text) {
            return text
                .replace(/\s*\((?:đáp\s*án\s*đúng|đúng|correct|đ\/a|da)\)\s*$/gi, '')
                .replace(/\s*\*+\s*$/, '')
                .trim();
        }

        for (let i = 1; i < lines.length; i++) {
            const line = lines[i];

            // Ignore separator lines like "---" or "==="
            if (/^[-=_*]{3,}$/.test(line)) continue;

            // Check if explanation section begins
            const expMatch = line.match(expRegex);
            if (expMatch) {
                readingState = 'exp';
                if (expMatch[1]) {
                    explanation += (explanation ? ' ' : '') + expMatch[1].trim();
                    const inline = expMatch[1].match(expInlineAnsRegex);
                    if (inline && answers.length === 0) {
                        answers.push(inline[1].toUpperCase().charCodeAt(0) - 65);
                    }
                }
                continue;
            }

            if (readingState === 'exp') {
                explanation += (explanation ? ' ' : '') + line;
                if (answers.length === 0) {
                    const inline = line.match(expInlineAnsRegex) || line.match(ansRegex);
                    if (inline) {
                        const letters = (inline[1] || '').toUpperCase().match(/[A-E]/g);
                        if (letters) answers = letters.map(ch => ch.charCodeAt(0) - 65);
                    }
                }
                continue;
            }

            // Check for answer key declaration
            const ansMatch = line.match(ansRegex);
            if (ansMatch) {
                const letters = ansMatch[1].toUpperCase().match(/[A-E]/g);
                if (letters && letters.length > 0) {
                    answers = letters.map(ch => ch.charCodeAt(0) - 65);
                }
                continue;
            }

            // Standalone arrow or bracket answer after options e.g. "=> D", "[C]"
            if (options.length >= 2) {
                const standaloneMatch = line.match(arrowOrBracketAnsRegex);
                if (standaloneMatch && (!line.startsWith('A') && !line.startsWith('B') && !line.startsWith('C') && !line.startsWith('D') && !line.startsWith('E') || line.length <= 3)) {
                    answers = [standaloneMatch[1].toUpperCase().charCodeAt(0) - 65];
                    continue;
                }
            }

            // Check for multiple options on a single horizontal line (e.g. "A. 1   B. 2   C. 3   D. 4")
            const inlineOpts = line.split(/(?=(?:^|\s{2,}|\t)[\*\-\s]*[\(\[]?[A-E][\)\]\.\:\*])/i)
                .map(s => s.trim())
                .filter(Boolean);

            if (inlineOpts.length > 1 && inlineOpts.every(s => optRegex.test(s))) {
                for (const item of inlineOpts) {
                    const m = item.match(optRegex);
                    if (m) {
                        const isMarked = item.includes('*') || /\((?:đáp\s*án\s*đúng|đúng|correct|đ\/a|da)\)/i.test(item);
                        if (isMarked && !answers.includes(options.length)) {
                            answers.push(options.length);
                        }
                        options.push(cleanOptionText(m[2]));
                    }
                }
                continue;
            }

            // Check single line option
            const optMatch = line.match(optRegex);
            if (optMatch) {
                const isMarked = line.includes('*') || /\((?:đáp\s*án\s*đúng|đúng|correct|đ\/a|da)\)/i.test(line);
                if (isMarked && !answers.includes(options.length)) {
                    answers.push(options.length);
                }
                options.push(cleanOptionText(optMatch[2]));
                continue;
            }

            // Text line continuation
            if (options.length === 0) {
                questionText += ' ' + line;
            } else {
                // Safety guard: if this line looks like an answer or explanation, never append to option text!
                const lateAns = line.match(ansRegex);
                if (lateAns) {
                    const letters = lateAns[1].toUpperCase().match(/[A-E]/g);
                    if (letters) answers = letters.map(ch => ch.charCodeAt(0) - 65);
                    continue;
                }
                const lateExp = line.match(expRegex);
                if (lateExp) {
                    readingState = 'exp';
                    if (lateExp[1]) explanation += (explanation ? ' ' : '') + lateExp[1].trim();
                    continue;
                }
                options[options.length - 1] += ' ' + line;
            }
        }

        // Default answer if none declared
        let isDefaultAnswer = false;
        if (answers.length === 0) {
            if (keyMap && keyMap[qNum] !== undefined) {
                answers = [keyMap[qNum]];
            } else if (options.length > 0) {
                answers = [0];
                isDefaultAnswer = true;
            }
        }

        const type = answers.length > 1 ? 'multiple' : 'single';

        return {
            q: questionText.trim(),
            options: options,
            type: type,
            answers: answers,
            explanation: explanation.trim(),
            isDefaultAnswer: isDefaultAnswer
        };
    }

    function isValidQuestion(q) {
        return (
            q.q &&
            Array.isArray(q.options) &&
            q.options.length >= 2 &&
            Array.isArray(q.answers) &&
            q.answers.length > 0 &&
            q.answers.every(idx => idx >= 0 && idx < q.options.length)
        );
    }

    function parse(rawText) {
        if (!rawText || typeof rawText !== 'string') return [];
        rawText = normalizeUnicodeWhitespace(rawText);
        let questions = [];

        // Standard CBT format
        if (rawText.includes('Q: ') && rawText.includes('O: ')) {
            questions = parseStandard(rawText.split(/\r?\n/));
        } else {
            // Try natural Vietnamese / Word exam format
            questions = parseNatural(rawText);
            if (questions.length === 0) {
                // Fallback to standard
                questions = parseStandard(rawText.split(/\r?\n/));
            }
        }

        // Auto-detect exam duration from text header if specified (e.g. "Thời gian làm bài: 45 phút", "Time: 60 mins")
        const durationMatch = rawText.match(/(?:thời\s*gian(?:\s*làm\s*bài)?|duration|time)[\s\:\-\—]*(\d{1,3})\s*(?:phút|mins?|m\b)/i);
        if (durationMatch) {
            const parsedMinutes = parseInt(durationMatch[1], 10);
            if (!isNaN(parsedMinutes) && parsedMinutes > 0 && parsedMinutes <= 300) {
                questions.parsedDuration = parsedMinutes;
            }
        }

        return questions;
    }

    return {
        parse,
        isValidQuestion,
        autoWrapMath,
        formatMathText,
        sanitizeHtml,
        normalizeUnicodeWhitespace
    };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = QuestionParser;
}

