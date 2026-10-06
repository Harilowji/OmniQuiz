const fs = require('fs');
const path = require('path');
const SampleBanks = require('../js/sample-banks.js');

function parseAnswerIndices(ansStr) {
  return ansStr.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n));
}

function parseLetterAnswerIndices(lettersStr) {
  const letters = lettersStr.toUpperCase().replace(/[^A-D]/g, '').split('');
  const map = { A: 0, B: 1, C: 2, D: 3 };
  return letters.map(l => map[l]).filter(idx => idx !== undefined);
}

function parseSingleQuestionChunk(chunk, index, subjectHint, passage) {
  const lines = chunk.split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) return null;

  let questionText = '';
  const options = [];
  let correctAnswers = [];
  let explanation = '';
  let questionType = 'single';
  let codeSnippet = undefined;

  const codeMatch = chunk.match(/```([a-zA-Z0-9_+-]*)\n([\s\S]*?)```/);
  if (codeMatch && codeMatch[2]) {
    codeSnippet = {
      code: codeMatch[2].trim(),
      language: codeMatch[1]?.trim() || 'plaintext',
    };
  }

  let inOptions = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

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
      continue;
    }
    if (line.startsWith('E:')) {
      explanation = lines.slice(i).join('\n').replace(/^E:\s*/, '').trim();
      break;
    }

    const ansMatch = line.match(/(?:Đáp án|Answer|Key)[:\s]+([A-D0-9,\s]+)/i);
    if (ansMatch && ansMatch[1]) {
      correctAnswers = parseLetterAnswerIndices(ansMatch[1].trim());
      continue;
    }

    const expMatch = line.match(/(?:Lời giải|Explanation|HD|Hướng dẫn)[:\s]+([\s\S]*)/i);
    if (expMatch) {
      explanation = lines.slice(i).join('\n').replace(/^(?:Lời giải|Explanation|HD|Hướng dẫn)[:\s]*/i, '').trim();
      break;
    }

    const optionMatch = line.match(/^(?:(?:\(([A-D])\)|\[([A-D])\]|([A-D])[\.:]))\s*(.*)/i);
    if (optionMatch) {
      inOptions = true;
      const optText = optionMatch[4]?.trim() || '';
      options.push(optText);
      continue;
    }

    if (!inOptions) {
      const cleanLine = line.replace(/^(?:Câu|Question|Bài)\s*\d+[\.:\s]*/i, '').trim();
      if (cleanLine) {
        questionText = questionText ? questionText + '\n' + cleanLine : cleanLine;
      }
    } else {
      if (options.length > 0) {
        const lastIdx = options.length - 1;
        options[lastIdx] = options[lastIdx] + '\n' + line;
      }
    }
  }

  if (!questionText && lines.length > 0) {
    questionText = lines[0].replace(/^(?:Câu|Question|Bài)\s*\d+[\.:\s]*/i, '');
  }

  if (options.length === 0) {
    options.push('Đúng (True)', 'Sai (False)');
    questionType = 'true_false';
  }

  if (correctAnswers.length === 0) {
    correctAnswers = [0];
  } else if (correctAnswers.length > 1) {
    questionType = 'multiple';
  }

  return {
    id: `q_${index}`,
    index,
    text: questionText.trim(),
    type: questionType,
    options,
    correctAnswer: correctAnswers,
    explanation: explanation.trim() || undefined,
    passage,
    subject: subjectHint || 'Chung',
    codeSnippet,
  };
}

const METADATA = {
  informatics_10: {
    id: 'sample_informatics_10',
    title: 'Đề thi Ôn tập Tin học & Lập trình Cơ bản (10 câu)',
    description: 'Hệ thống câu hỏi trắc nghiệm Tin học THPT & Nhập môn Khoa học Máy tính (C, Python, SQL, Cấu trúc dữ liệu)',
    subject: 'Tin học',
    durationMinutes: 20
  },
  chem_40_pdf: {
    id: 'sample_chem_40_pdf',
    title: '40 Câu Trắc nghiệm Hóa học Hữu cơ Đại cương',
    description: 'Bộ câu hỏi Hóa học Đại cương & Hữu cơ: Lai hóa obitan, liên kết pi/sigma, hiệu ứng cảm ứng, nhóm chức',
    subject: 'Hóa học',
    durationMinutes: 45
  },
  math_50: {
    id: 'sample_math_50',
    title: 'Đề thi Toán học THPT Chuẩn hóa (50 câu)',
    description: 'Ngân hàng 50 câu trắc nghiệm Toán học giải tích, đại số, đạo hàm và bài toán số học',
    subject: 'Toán học',
    durationMinutes: 90
  },
  sat_math: {
    id: 'sample_sat_math',
    title: 'Digital SAT Math Practice Exam (10 questions)',
    description: 'Official Digital SAT Math questions covering Algebra, Advanced Math, Problem Solving, and Geometry',
    subject: 'Toán học (SAT)',
    durationMinutes: 15
  },
  physics_12: {
    id: 'sample_physics_12',
    title: 'Đề ôn tập Vật lý 12 - Dao động Cơ học',
    description: 'Chuyên đề Dao động điều hòa, con lắc lò xo, vận tốc gia tốc và hiện tượng cộng hưởng',
    subject: 'Vật lý',
    durationMinutes: 15
  },
  chem_12: {
    id: 'sample_chem_12',
    title: 'Đề ôn tập Hóa học 12 - Este và Lipit',
    description: 'Chuyên đề Este, xà phòng hóa, chất béo triolein và phản ứng hóa học hữu cơ',
    subject: 'Hóa học',
    durationMinutes: 15
  },
  english_thpt: {
    id: 'sample_english_thpt',
    title: 'Đề ôn tập Tiếng Anh THPT - Ngữ pháp & Từ vựng',
    description: 'Trọng tâm Câu điều kiện loại 3, rút gọn mệnh đề quan hệ, hòa hợp chủ vị, phrasal verbs, thể giả định',
    subject: 'Tiếng Anh',
    durationMinutes: 15
  },
  social_12: {
    id: 'sample_social_12',
    title: 'Đề ôn tập Lịch sử và Địa lý Tổng hợp',
    description: 'Chiến dịch Điện Biên Phủ, Hiệp định Geneve 1954, Địa lý Việt Nam, Đại thắng mùa Xuân 1975',
    subject: 'Khoa học Xã hội',
    durationMinutes: 15
  },
  quick_5: {
    id: 'sample_quick_5',
    title: 'Đề kiểm tra nhanh Kiểm thử Hệ thống (5 câu)',
    description: 'Bộ 5 câu hỏi nhanh phục vụ kiểm thử chấm điểm tự động, lời giải và tốc độ phản hồi',
    subject: 'Tổng hợp',
    durationMinutes: 5
  }
};

const questionSplitRegex = /(?=(?:\n|^)(?:(?:Câu|Question|Bài)\s*\d+[\.:\s]|\d+[\.]\s+[A-Z\p{L}]|Q:\s*))/iu;

const outputDir = path.join(__dirname, '..', 'src', 'shared', 'fixtures');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

for (const [key, rawText] of Object.entries(SampleBanks)) {
  const meta = METADATA[key];
  if (!meta) {
    console.warn(`No metadata for ${key}`);
    continue;
  }

  const clean = rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
  const rawChunks = clean.split(questionSplitRegex);
  const questions = [];
  let qCount = 1;

  for (const chunk of rawChunks) {
    const trimmed = chunk.trim();
    if (!trimmed || trimmed.length < 10) continue;
    // Check if chunk starts with question marker or contains options
    const hasQuestionPrefix = /^(?:(?:Câu|Question|Bài)\s*\d+|Q:|\d+\.)/i.test(trimmed);
    const hasOptions = /(?:^[A-D][\.:]|^O:)/m.test(trimmed);
    if (!hasQuestionPrefix && !hasOptions) {
      continue; // Skip header / preamble metadata
    }
    const parsed = parseSingleQuestionChunk(trimmed, qCount, meta.subject);
    if (parsed && parsed.options.length >= 2 && !parsed.text.startsWith('[TITLE]') && !parsed.text.startsWith('[TIÊU ĐỀ]') && !parsed.text.startsWith('ĐỀ THI')) {
      parsed.id = `${meta.id}_q${qCount}`;
      questions.push(parsed);
      qCount++;
    }
  }

  const exam = {
    id: meta.id,
    title: meta.title,
    description: meta.description,
    subject: meta.subject,
    durationMinutes: meta.durationMinutes,
    totalQuestions: questions.length,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    questions
  };

  const filePath = path.join(outputDir, `${key}.json`);
  fs.writeFileSync(filePath, JSON.stringify(exam, null, 2), 'utf-8');
  console.log(`Generated ${key}.json: ${questions.length} questions`);
}
