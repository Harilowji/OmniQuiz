import { describe, it, expect } from 'vitest';
import { tokenizeExamDocument } from '../../workers/document-parser.worker';

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
});
