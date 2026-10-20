import { describe, it, expect } from 'vitest';
import {
  tokenizeExamDocument,
  convertDocxHtmlToText,
  normalizeInlineOptions,
  extractEndOfFileAnswerKey,
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
});
