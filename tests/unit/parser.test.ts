import { describe, it, expect } from 'vitest';
import {
  tokenizeExamDocument,
  convertDocxHtmlToText,
  normalizeInlineOptions,
  extractEndOfFileAnswerKey,
  convertOmmlToLatex,
} from '../../workers/document-parser.worker';

describe('Document Parser Engine 3.0 (Heuristic Tokenizer)', () => {
  it('should parse standard Vietnamese question format with options and explanation', () => {
    const rawText = `
[TITLE]: Đề thi Hóa học 12
[TIME]: 45

Câu 1: Chất nào sau đây là este?
A. CH3COOH
B. CH3COOCH3
C. C2H5OH
D. CH3CHO
Đáp án: B
Lời giải: Metyl axetat có nhóm chức este -COO-.

Câu 2: Thủy phân metyl fomat trong môi trường kiềm thu được:
A. HCOONa và CH3OH
B. CH3COONa và CH3OH
C. HCOOH và CH3OH
D. CH3COONa và C2H5OH
Đáp án: A
Lời giải: Phản ứng xà phòng hóa tạo HCOONa và ancol.
`;

    const result = tokenizeExamDocument(rawText, 'hoa_hoc.txt', 'Hóa học');
    expect(result.examTitle).toBe('Đề thi Hóa học 12');
    expect(result.durationMinutes).toBe(45);
    expect(result.questions).toHaveLength(2);

    const q1 = result.questions[0]!;
    expect(q1.text).toContain('Chất nào sau đây là este?');
    expect(q1.options).toHaveLength(4);
    expect(q1.correctAnswer).toEqual([1]); // 'B' -> index 1
    expect(q1.explanation).toContain('Metyl axetat');

    const q2 = result.questions[1]!;
    expect(q2.correctAnswer).toEqual([0]); // 'A' -> index 0
  });

  it('should parse Q/T/O/A/E tag format with multiple choices', () => {
    const rawText = `
Q: What are the roots of the equation $ x^2 - 25 = 0 $?
T: multiple
O: $ -6 $
O: $ 5 $
O: $ 6 $
O: $ -5 $
A: 1,3
E: Roots are 5 and -5.
`;

    const result = tokenizeExamDocument(rawText, 'math.txt', 'Toán học');
    expect(result.questions).toHaveLength(1);

    const q = result.questions[0]!;
    expect(q.type).toBe('multiple');
    expect(q.options).toHaveLength(4);
    expect(q.correctAnswer).toEqual([1, 3]);
    expect(q.explanation).toBe('Roots are 5 and -5.');
  });

  it('should extract embedded code snippets and syntax highlighting metadata', () => {
    const rawText = `
Câu 1: Cho đoạn mã C sau:
\`\`\`c
int a = 10, b = 20;
int *p = &a;
*p = *p + b;
printf("%d", a);
\`\`\`
Kết quả in ra là gì?
A. 10
B. 20
C. 30
D. 0
Đáp án: C
`;

    const result = tokenizeExamDocument(rawText, 'code.txt', 'Tin học');
    expect(result.questions).toHaveLength(1);

    const q = result.questions[0]!;
    expect(q.codeSnippet).toBeDefined();
    expect(q.codeSnippet?.language).toBe('c');
    expect(q.codeSnippet?.code).toContain('int *p = &a;');
    expect(q.correctAnswer).toEqual([2]); // 'C' -> index 2
  });

  it('should ignore document header preambles and not create fake questions', () => {
    const rawText = `
SỞ GIÁO DỤC VÀ ĐÀO TẠO TP HÀ NỘI
TRƯỜNG THPT CHUYÊN HÀ NỘI - AMSTERDAM
KỲ THI THỬ TỐT NGHIỆP THPT QUỐC GIA 2026
Môn thi: VẬT LÝ - Thời gian: 50 phút

Câu 1: Một vật dao động điều hòa có chu kì T. Tần số dao động là:
A. f = 1/T
B. f = 2pi/T
C. f = T
D. f = 2T
Đáp án: A
`;

    const result = tokenizeExamDocument(rawText, 'vat_ly.txt', 'Vật lý');
    expect(result.questions).toHaveLength(1);
    expect(result.questions[0]!.text).toContain('Một vật dao động điều hòa');
    expect(result.questions[0]!.options).toHaveLength(4);
  });

  it('should extract End-of-File answer key table if answers are not attached to each question', () => {
    const rawText = `
Câu 1: Thủ đô của Việt Nam là gì?
A. TP Hồ Chí Minh
B. Hà Nội
C. Đà Nẵng
D. Cần Thơ

Câu 2: Nước sôi ở bao nhiêu độ C ở áp suất tiêu chuẩn?
A. 50
B. 80
C. 100
D. 120

BẢNG ĐÁP ÁN:
1. B
2. C
`;

    const result = tokenizeExamDocument(rawText, 'dia_ly.txt', 'Địa lý');
    expect(result.questions).toHaveLength(2);
    expect(result.questions[0]!.correctAnswer).toEqual([1]); // 1. B -> index 1
    expect(result.questions[1]!.correctAnswer).toEqual([2]); // 2. C -> index 2
  });

  it('should detect reading comprehension passages for Split View', () => {
    const rawText = `
Đoạn văn đọc hiểu:
The Industrial Revolution was the transition to new manufacturing processes in Great Britain, continental Europe, and the United States, in the period from about 1760 to about 1840.

Câu 1: Where did the Industrial Revolution begin?
A. Great Britain
B. Asia
C. South America
D. Australia
Đáp án: A
`;

    const result = tokenizeExamDocument(rawText, 'reading.txt', 'English');
    expect(result.questions).toHaveLength(1);
    expect(result.questions[0]!.passage).toContain('The Industrial Revolution');
  });

  it('should preserve correct answers marked by underline or bold in Word HTML', () => {
    const docxHtml = `
<p>Câu 1: Kim loại nào sau đây dẫn điện tốt nhất?</p>
<p><u>A.</u> Bạc</p>
<p>B. Đồng</p>
<p>C. Nhôm</p>
<p>D. Sắt</p>

<p>Câu 2: Dung dịch nào làm quỳ tím hóa đỏ?</p>
<p>A. NaOH</p>
<p><strong>B.</strong> HCl</p>
<p>C. NaCl</p>
<p>D. C2H5OH</p>
`;

    const extractedText = convertDocxHtmlToText(docxHtml);
    const result = tokenizeExamDocument(extractedText, 'de_thi.docx', 'Hóa học');
    expect(result.questions).toHaveLength(2);
    expect(result.questions[0]!.correctAnswer).toEqual([0]); // <u>A.</u> -> index 0 (Bạc)
    expect(result.questions[1]!.correctAnswer).toEqual([1]); // <strong>B.</strong> -> index 1 (HCl)
  });

  it('should cleanly split inline options on the same line into 4 separate options', () => {
    const rawText = `
Câu 1: Tỉnh nào sau đây thuộc vùng Đồng bằng sông Hồng?
A. Hà Nam    B. Nghệ An    C. Thanh Hóa    D. Hà Tĩnh
Đáp án: A

Câu 2: Số nguyên tố chẵn duy nhất là:
A) 0    B) 1    C) 2    D) 4
Đáp án: C
`;

    const result = tokenizeExamDocument(rawText, 'inline_test.txt', 'Địa lý');
    expect(result.questions).toHaveLength(2);

    const q1 = result.questions[0]!;
    expect(q1.options).toHaveLength(4);
    expect(q1.options[0]).toBe('Hà Nam');
    expect(q1.options[1]).toBe('Nghệ An');
    expect(q1.options[2]).toBe('Thanh Hóa');
    expect(q1.options[3]).toBe('Hà Tĩnh');
    expect(q1.correctAnswer).toEqual([0]);

    const q2 = result.questions[1]!;
    expect(q2.options).toHaveLength(4);
    expect(q2.options[0]).toBe('0');
    expect(q2.options[1]).toBe('1');
    expect(q2.options[2]).toBe('2');
    expect(q2.options[3]).toBe('4');
    expect(q2.correctAnswer).toEqual([2]);
  });

  it('should not prematurely truncate exam when question body contains "Chọn đáp án đúng"', () => {
    const rawText = `
Câu 1: Chọn đáp án đúng nhất về đặc điểm của este:
A. Nhiệt độ sôi cao hơn axit tương ứng
B. Thường nhẹ hơn nước và ít tan trong nước
C. Tan vô hạn trong nước
D. Không phản ứng với dung dịch kiềm
Đáp án: B

Câu 2: Cho các chất sau, chọn đáp án đúng về chất điện li mạnh:
A. CH3COOH
B. H2O
C. NaCl
D. HF
Đáp án: C

Câu 3: Kim loại kiềm thuộc nhóm nào trong bảng tuần hoàn?
A. IA
B. IIA
C. IIIA
D. IVA
Đáp án: A
`;

    const result = tokenizeExamDocument(rawText, 'truncation_test.txt', 'Hóa học');
    expect(result.questions).toHaveLength(3);
    expect(result.questions[0]!.text).toContain('Chọn đáp án đúng nhất');
    expect(result.questions[1]!.text).toContain('chọn đáp án đúng về chất điện li');
    expect(result.questions[2]!.text).toContain('Kim loại kiềm thuộc nhóm nào');
  });

  it('should handle flexible question number formats (Câu 01 -, Bài 2:, 3., 4/, 5))', () => {
    const rawText = `
Câu 01 - Nguyên tử khối của Oxi là:
A. 8
B. 16
C. 32
D. 64
Đáp án: B

Bài 2: Tốc độ ánh sáng trong chân không xấp xỉ:
A. 300.000 km/s
B. 150.000 km/s
C. 30.000 km/s
D. 3.000 km/s
Đáp án: A

3. Đơn vị của lực trong hệ SI là:
A. Jun (J)
B. Oát (W)
C. Niutơn (N)
D. Paxcan (Pa)
Đáp án: C

4/ Nước có công thức hóa học là:
A. H2O2
B. H2O
C. HO
D. H3O
Đáp án: B

5) Số pi xấp xỉ bằng:
A. 3.14
B. 2.71
C. 1.41
D. 1.73
Đáp án: A
`;

    const result = tokenizeExamDocument(rawText, 'formats_test.txt', 'Tổng hợp');
    expect(result.questions).toHaveLength(5);
    expect(result.questions[0]!.correctAnswer).toEqual([1]);
    expect(result.questions[1]!.correctAnswer).toEqual([0]);
    expect(result.questions[2]!.correctAnswer).toEqual([2]);
    expect(result.questions[3]!.correctAnswer).toEqual([1]);
    expect(result.questions[4]!.correctAnswer).toEqual([0]);
  });

  it('should generate validation warnings for missing options or unassigned answers', () => {
    const rawText = `
Câu 1: Câu này chỉ có 2 lựa chọn:
A. Đúng
B. Sai

Câu 2: Câu này chưa có đáp án đúng nào được chỉ định:
A. Phương án 1
B. Phương án 2
C. Phương án 3
D. Phương án 4
`;

    const result = tokenizeExamDocument(rawText, 'warning_test.txt');
    expect(result.questions).toHaveLength(2);
    expect(result.warnings.length).toBeGreaterThan(0);

    const warnMissingOpts = result.warnings.find((w) => w.type === 'missing_options');
    expect(warnMissingOpts).toBeDefined();
    expect(warnMissingOpts?.questionIndex).toBe(1);

    const warnMissingAns = result.warnings.filter((w) => w.type === 'missing_answer');
    expect(warnMissingAns.map((w) => w.questionIndex)).toEqual([1, 2]);
  });

  it('should NOT falsely split geometry/chemistry variables like triangle ABC and angle B in question body', () => {
    const rawLine = 'Cho tam giác ABC vuông tại A, góc B. Tính độ dài cạnh C.';
    const normalized = normalizeInlineOptions(rawLine);
    expect(normalized).toBe(rawLine); // Untouched! No spurious splits!
  });

  it('should cleanly split inline sequential options (4 on 1 line and 2 on 1 line)', () => {
    // 4 on 1 line:
    const line4 = 'A. 10    B. 20    C. 30    D. 40';
    const split4 = normalizeInlineOptions(line4);
    const parts4 = split4.split('\n');
    expect(parts4).toHaveLength(4);
    expect(parts4[0]).toBe('A. 10');
    expect(parts4[1]).toBe('B. 20');
    expect(parts4[2]).toBe('C. 30');
    expect(parts4[3]).toBe('D. 40');

    // 2 on 1 line:
    const line2a = 'A. Phương án một\tB. Phương án hai';
    const split2a = normalizeInlineOptions(line2a);
    expect(split2a.split('\n')).toEqual(['A. Phương án một', 'B. Phương án hai']);

    const line2b = 'C. Phương án ba\tD. Phương án bốn';
    const split2b = normalizeInlineOptions(line2b);
    expect(split2b.split('\n')).toEqual(['C. Phương án ba', 'D. Phương án bốn']);
  });

  it('should convert Microsoft Equation OMML XML tags to KaTeX LaTeX strings', () => {
    // Fraction: <m:f><m:num><m:t>1</m:t></m:num><m:den><m:t>2</m:t></m:den></m:f>
    const fracXml = '<m:f><m:num><m:t>1</m:t></m:num><m:den><m:t>x+1</m:t></m:den></m:f>';
    expect(convertOmmlToLatex(fracXml)).toBe('\\frac{1}{x+1}');

    // Superscript: x^2
    const supXml = '<m:sSup><m:e><m:t>x</m:t></m:e><m:sup><m:t>2</m:t></m:sup></m:sSup>';
    expect(convertOmmlToLatex(supXml)).toBe('{x}^{2}');

    // Subscript: H_2
    const subXml = '<m:sSub><m:e><m:t>H</m:t></m:e><m:sub><m:t>2</m:t></m:sub></m:sSub>';
    expect(convertOmmlToLatex(subXml)).toBe('{H}_{2}');

    // Radical: sqrt(x)
    const radXml = '<m:rad><m:deg></m:deg><m:e><m:t>x</m:t></m:e></m:rad>';
    expect(convertOmmlToLatex(radXml)).toBe('\\sqrt{x}');
  });

  it('should support the 3-part exam format: multiple_choice, true_false_group, and short_answer', () => {
    const rawExamText = `
[TITLE]: Đề khảo sát chuẩn Bộ GD&ĐT 2026

PHẦN I. Câu trắc nghiệm nhiều phương án lựa chọn (Thí sinh trả lời từ câu 1 đến câu 1)
Câu 1: Hàm số nào sau đây nghịch biến trên R?
A. y = x^3
B. y = -x^3 + 2
C. y = x^4
D. y = 2x - 1
Đáp án: B

PHẦN II. Câu trắc nghiệm đúng sai (Thí sinh trả lời câu 2)
Câu 2: Cho hàm số f(x) = x^2 - 4x + 3.
a) f(0) = 3 (Đúng)
b) Đạo hàm f'(x) = 2x - 4 (Đúng)
c) Điểm cực tiểu là x = 3 (Sai)
d) Giá trị nhỏ nhất bằng -1 (Đúng)

PHẦN III. Câu trắc nghiệm trả lời ngắn (Thí sinh trả lời câu 3)
Câu 3: Tính diện tích hình vuông có cạnh bằng 5 cm.
Đáp số: 25
`;

    const result = tokenizeExamDocument(rawExamText, 'gdpt2026.txt', 'Toán học');
    expect(result.questions).toHaveLength(3);

    // Part I
    const q1 = result.questions[0]!;
    expect(q1.type).toBe('single');
    expect(q1.options).toHaveLength(4);
    expect(q1.correctAnswer).toEqual([1]); // B

    // Part II
    const q2 = result.questions[1]!;
    expect(q2.type).toBe('true_false_group');
    expect(q2.subItems).toBeDefined();
    expect(q2.subItems).toHaveLength(4);
    expect(q2.subItems?.[0]?.isCorrect).toBe(true);  // a: Đúng
    expect(q2.subItems?.[1]?.isCorrect).toBe(true);  // b: Đúng
    expect(q2.subItems?.[2]?.isCorrect).toBe(false); // c: Sai
    expect(q2.subItems?.[3]?.isCorrect).toBe(true);  // d: Đúng

    // Part III
    const q3 = result.questions[2]!;
    expect(q3.type).toBe('short_answer');
    expect(q3.shortAnswerKey).toBe('25');
  });

  it('should extract end-of-file answer keys and detailed explanations', () => {
    const docWithExplanations = `
Câu 1: Nguyên tử khối của Oxi là:
A. 12
B. 14
C. 16
D. 32

Câu 2: Công thức hóa học của nước là:
A. H2O
B. CO2
C. NaCl
D. CH4

BẢNG ĐÁP ÁN:
1. C
2. A

HƯỚNG DẪN GIẢI CHI TIẾT:
Câu 1: Oxi có số hiệu nguyên tử 8, nguyên tử khối trung bình xấp xỉ 16 g/mol.
Câu 2: Phân tử nước gồm 2 nguyên tử Hidro liên kết với 1 nguyên tử Oxi (H2O).
`;

    const result = tokenizeExamDocument(docWithExplanations, 'chemistry_exp.txt');
    expect(result.questions).toHaveLength(2);
    expect(result.questions[0]!.correctAnswer).toEqual([2]); // C
    expect(result.questions[1]!.correctAnswer).toEqual([0]); // A
    expect(result.questions[0]!.explanation).toContain('nguyên tử khối trung bình xấp xỉ 16');
    expect(result.questions[1]!.explanation).toContain('Phân tử nước gồm 2 nguyên tử Hidro');
  });
});
