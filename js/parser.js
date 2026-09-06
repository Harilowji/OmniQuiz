/**
 * parser.js - Question Bank Parsing, Auto-LaTeX Enhancement & Validation Module
 */
const QuestionParser = (() => {
    /**
     * Auto-wrap naked LaTeX commands outside of $ ... $ in inline math delimiters.
     */
    function autoWrapMath(text) {
        if (!text || typeof text !== 'string') return '';

        // Split text by math delimiters $ ... $ or $$ ... $$ to process only plain text parts
        const parts = text.split(/(\$\$[\s\S]*?\$\$|\$[^\$]*?\$)/g);

        for (let i = 0; i < parts.length; i++) {
            // Even indices are plain text outside math delimiters
            if (i % 2 === 0) {
                let part = parts[i];
                // 1. Detect LaTeX commands like \frac{...}{...}, \sqrt{...}, \lim_{...}, \int, \sum
                part = part.replace(/(\\(?:frac\{[^{}]*\}\{[^{}]*\}|sqrt\{[^{}]*\}|sqrt\[[^\[\]]*\]\{[^{}]*\}|lim_\{[^{}]*\}|int_[^\s^]*\^[^\s]*|sum_[^\s^]*\^[^\s]*|[a-zA-Z]+(?:_[0-9a-zA-Z]+|\^[0-9a-zA-Z]+)+))/g, '$$ $1 $$');
                // 2. Wrap standalone math symbols like \times, \pm, \le, \ge, \ne, \approx if not in math
                part = part.replace(/(\\(?:times|pm|le|ge|ne|approx|in|subset|cup|cap|infty|alpha|beta|theta|pi|Delta))\b/g, '$$ $1 $$');
                parts[i] = part;
            }
        }

        return parts.join('');
    }

    /**
     * Safely format math text: auto-wrap LaTeX and escape HTML < and > to protect
     * mathematical expressions like $0 < x < 5$ from browser DOM tag swallowing.
     */
    function formatMathText(text) {
        if (!text || typeof text !== 'string') return '';
        const wrapped = autoWrapMath(text);
        return wrapped.replace(/</g, '&lt;').replace(/>/g, '&gt;');
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
     * Extract trailing answer tables such as:
     * BẢNG ĐÁP ÁN: 1. A  2. B  3. C ...
     */
    function extractTrailingAnswerTable(rawText) {
        const tableMatch = rawText.match(/(?:^|\n+)\s*(?:BẢNG\s+ĐÁP\s*ÁN|ĐÁP\s*ÁN\s+(?:TRẮC\s+NGHIỆM|CÁC\s+CÂU)|ANSWER\s+KEY|KEY\s+TABLE)[\s\:\-]+([\s\S]+)$/i);
        if (!tableMatch) return { cleanText: rawText, keyMap: {} };

        const tableText = tableMatch[1];
        const pairRegex = /(\d+)[\s.:\-\)\=]+([A-E])\b/gi;
        const keyMap = {};
        let count = 0;
        let p;
        while ((p = pairRegex.exec(tableText)) !== null) {
            const qNum = parseInt(p[1], 10);
            const letter = p[2].toUpperCase();
            keyMap[qNum] = letter.charCodeAt(0) - 65;
            count++;
        }

        if (count >= 2) {
            const cleanText = rawText.substring(0, tableMatch.index).trim();
            return { cleanText, keyMap };
        }
        return { cleanText: rawText, keyMap: {} };
    }

    /**
     * Parse natural exam format commonly found in Word (.docx) and school exam papers
     * (Câu 1: ... A. ... B. ... C. ... D. ... Đáp án: ... Lời giải: ...).
     */
    function parseNatural(rawText) {
        const questions = [];
        const { cleanText, keyMap } = extractTrailingAnswerTable(rawText);

        // Match start of question headers: Câu 1, Bài 1, Question 1, or 1.
        const qHeaderRegex = /(?:^|\n+)\s*(?:(?:Câu|Question|Bài)\s*(\d+)[\s:.]+|(\d+)[\s.:]\s+(?=[A-ZÀ-Ỹ\$\\\*]))/gi;

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

        const optRegex = /^(?:[\*\-\s]*[\(\[]?([A-E])[\)\]\.\:\*]+\s*)(.+)$/i;
        const ansRegex = /^\s*[\*\-\>\•]?\s*\[?\s*(?:Đáp\s*án(?:\s*đúng)?(?:\s*là)?|Đ\/?A|Chọn(?:\s*đáp\s*án)?|Answer|Key|Ans)[\s\:\=\]\.]*\s*([A-E](?:\s*,\s*[A-E])*)/i;
        const expRegex = /^\s*[\*\-\>\•]?\s*\[?\s*(?:Lời\s*giải(?:\s*chi\s*tiết)?|Hướng\s*dẫn(?:\s*giải)?|Giải(?:\s*chi\s*tiết)?|Explanation|Solution)[\]\s\:\.]*(.*)$/i;

        // Remove initial header like "Câu 1:" from first line
        let firstLine = lines[0].replace(/^(?:(?:Câu|Question|Bài)\s*\d+[\s:.]*|\d+[\s:.]*)/i, '').trim();

        // Check if inline answer exists in header e.g. "Câu 1: (Đáp án A) Cho hàm số..."
        const headerAnsMatch = firstLine.match(/[\(\[]\s*(?:Đáp\s*án(?:\s*đúng)?|Chọn|Answer|Key)[\s\:\=]*([A-E])\s*[\)\]]/i);
        if (headerAnsMatch) {
            answers.push(headerAnsMatch[1].toUpperCase().charCodeAt(0) - 65);
            firstLine = firstLine.replace(headerAnsMatch[0], '').trim();
        }
        questionText = firstLine;

        function cleanOptionText(text) {
            return text
                .replace(/\s*\((?:đáp\s*án\s*đúng|đúng|correct)\)\s*$/gi, '')
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
                if (expMatch[1]) explanation += (explanation ? ' ' : '') + expMatch[1].trim();
                continue;
            }

            if (readingState === 'exp') {
                explanation += (explanation ? ' ' : '') + line;
                if (answers.length === 0) {
                    const m = line.match(ansRegex);
                    if (m) {
                        const letters = m[1].toUpperCase().match(/[A-E]/g);
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

            // Check for multiple options on a single horizontal line (e.g. "A. 1   B. 2   C. 3   D. 4")
            const inlineOpts = line.split(/(?=(?:^|\s{2,}|\t)[\*\-\s]*[\(\[]?[A-E][\)\]\.\:\*])/i)
                .map(s => s.trim())
                .filter(Boolean);

            if (inlineOpts.length > 1 && inlineOpts.every(s => optRegex.test(s))) {
                for (const item of inlineOpts) {
                    const m = item.match(optRegex);
                    if (m) {
                        const isMarked = item.includes('*') || /\((?:đáp\s*án\s*đúng|đúng|correct)\)/i.test(item);
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
                const isMarked = line.includes('*') || /\((?:đáp\s*án\s*đúng|đúng|correct)\)/i.test(line);
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
        if (answers.length === 0) {
            if (keyMap && keyMap[qNum] !== undefined) {
                answers = [keyMap[qNum]];
            } else if (options.length > 0) {
                answers = [0];
            }
        }

        const type = answers.length > 1 ? 'multiple' : 'single';

        return {
            q: questionText.trim(),
            options: options,
            type: type,
            answers: answers,
            explanation: explanation.trim()
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
        // Standard CBT format
        if (rawText.includes('Q: ') && rawText.includes('O: ')) {
            return parseStandard(rawText.split(/\r?\n/));
        }
        // Try natural Vietnamese / Word exam format
        const natural = parseNatural(rawText);
        if (natural.length > 0) return natural;

        // Fallback to standard
        return parseStandard(rawText.split(/\r?\n/));
    }

    return {
        parse,
        isValidQuestion,
        autoWrapMath,
        formatMathText
    };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = QuestionParser;
}

