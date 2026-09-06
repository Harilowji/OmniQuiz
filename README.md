# 🎓 OmniQuiz - Multi-Subject CBT & Exam Preparation Platform

An interactive, modern, high-performance web platform designed for computer-based testing (CBT) and exam practice across **all academic subjects** (Mathematics, Physics, Chemistry, English, Social Sciences, History, Geography, SAT, etc.). OmniQuiz features full **LaTeX/MathJax 3** formula rendering, Azota-inspired **Interactive Question Palette**, dual testing modes (**Practice** vs. **Exam**), bilingual internationalization (**Tiếng Việt / English**), 4 distinct dynamic animated themes, state persistence via LocalStorage, audio feedback, client-side **Microsoft Word (.docx)** and **.txt** file parsing, and **PDF performance report export**.

[![GitHub Pages](https://img.shields.io/badge/Deploy-GitHub_Pages-22c55e?style=for-the-badge&logo=github)](https://harilowji.github.io/OmniQuiz/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue?style=for-the-badge)](LICENSE)
[![MathJax 3](https://img.shields.io/badge/MathJax-3.0-008080?style=for-the-badge)](https://www.mathjax.org/)
[![Vanilla JS](https://img.shields.io/badge/Vanilla_JS-ES6+-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)](#)
[![Responsive UI](https://img.shields.io/badge/UI-Responsive_&_PWA-purple?style=for-the-badge)](#)

---

## 🌟 Highlights & Capabilities

- **Universal Multi-Subject Architecture:**
  - Built-in support for multiple subjects: **Toán học (Math)**, **Vật lý (Physics)**, **Hóa học (Chemistry)**, **Tiếng Anh (English)**, **Lịch sử & Địa lý (Social Sciences)**, and **Digital SAT**.
  - Formats any subject exam seamlessly without backend server dependencies.
- **LaTeX & MathJax 3 Engine:**
  - Seamlessly renders complex formulas, fractions, chemical equations, coordinate geometries, and calculus notation in real time.
  - Built-in HTML-entity shielding prevents equation collision with `<` or `>` characters (e.g. `$0 < x < 5$`).
- **Flexible Client-Side Import (.txt & .docx Word):**
  - Instant client-side parsing of Microsoft Word files (`.docx`) with `mammoth.js` without uploading files to third-party servers.
  - Drag-and-drop or standard file picker.
  - Zero-click 50-question instant demo button.
- **Dual-Engine Smart Question Parser:**
  - **Format 1 (Vietnamese School & Natural Exam):** `Câu 1:`, `A.`, `B.`, `C.`, `D.`, `Đáp án: A`, `Lời giải: ...`. Supports horizontal options (`A. 1  B. 2  C. 3  D. 4`) and isolated trailing answer keys.
  - **Format 2 (Standard CBT):** `Q:`, `T:`, `O:`, `A:`, `E:`.
- **Interactive Question Palette (Bản đồ câu hỏi - Azota Inspired):**
  - Smooth scroll and glowing pulse highlight when jumping to questions.
  - Real-time color-coded badges:
    - 🟢 **Correct** (Practice Mode)
    - 🔴 **Incorrect** (Practice Mode)
    - 🔵 **Answered** (Exam Mode)
    - 🟡 **Flagged for Review 🚩**
    - ⚪ **Unanswered**
  - Quick filter tabs: *Tất cả (All)*, *Đã làm (Answered)*, *Cần xem (Flagged 🚩)*, *Chưa làm (Unanswered)*.
- **Dual Testing Modes:**
  - **🎯 Practice Mode (Luyện tập):** Immediate answer validation, cheerful sound effects (`ding`/`buzz`), and instant explanations.
  - **⏱️ Exam Mode (Thi thử):** Official test environment with customizable countdown timer, answer shielding, and final performance analytics.
- **Auto-Save & State Persistence (LocalStorage):**
  - Automatically saves progress, selected options, flagged questions, and remaining time. Cleanly resets when loading new test files.
- **Bilingual Interface (i18n):**
  - One-click toggle between 🇻🇳 **Tiếng Việt** and 🇬🇧 **English**.
- **4 Dynamic Animated Background Themes:**
  1. `Academic`: Engineering grid & blueprint drift with serif typography (*Merriweather*).
  2. `Minimalist`: Smooth modern aurora gradient mesh with frosted glassmorphism (*Inter*).
  3. `Cyberpunk`: Dark futuristic grid with moving neon scanlines and high-contrast glowing elements (*Orbitron*).
  4. `Playful`: Floating pastel candy bubbles and soft 3D borders (*Quicksand*).
- **Celebration Confetti & Scoring Analytics:**
  - Dynamic Canvas particle confetti for test scores $\ge 75\%$.
  - Comprehensive scoring overview with accuracy breakdown.
- **Client-Side PDF Error Review Sheet:**
  - Export all incorrect questions with complete answer keys and explanations to PDF using `html2pdf.js`.
- **Fisher-Yates Shuffle Engine (Đảo đề):**
  - Randomize questions and options on demand for effective review and anti-memorization practice.

---

## 📂 Project Structure

```text
OmniQuiz/
├── index.html            # Application entry point with semantic HTML5 & PWA manifest
├── manifest.json         # Progressive Web App (PWA) configuration
├── LICENSE               # MIT Open Source License
├── .gitignore            # Git exclusion rules
├── .github/
│   └── workflows/
│       └── deploy.yml    # Automated GitHub Actions deployment to GitHub Pages
├── css/
│   ├── main.css          # Base resets, container layout, scrollbars
│   ├── themes.css        # 4 Themes with dynamic animated backgrounds & glassmorphism
│   ├── components.css    # UI components (navbar, cards, options, dropzone, palette, modal)
│   └── animations.css    # Keyframe animations (academicGridDrift, cyberpunkScanline, pulse)
├── js/
│   ├── i18n.js           # Multi-language dictionary (Tiếng Việt / English)
│   ├── audio.js          # Audio engine (HTML5 Audio + Web Audio API synthesizer)
│   ├── storage.js        # LocalStorage state persistence manager
│   ├── confetti.js       # Canvas celebratory particle engine
│   ├── parser.js         # Dual-engine question bank parser & auto-LaTeX formatter
│   ├── quiz-engine.js    # Core test logic, scoring, and PDF report generator
│   ├── ui.js             # DOM renderer, granular element updates & modal controller
│   └── app.js            # Main application coordinator, drag-and-drop & event binder
├── question_banks/       # Curated subject-specific question banks
│   ├── HUONG_DAN_SOAN_DE.txt                # Complete formatting guide for educators
│   ├── 01_khao_sat_ham_so.txt               # Math: Calculus & function analysis
│   ├── 02_mu_va_logarit.txt                 # Math: Exponent & logarithm
│   ├── 03_nguyen_ham_tich_phan.txt          # Math: Antiderivative & integral
│   ├── 04_hinh_hoc_oxyz.txt                 # Math: Oxyz coordinate geometry
│   ├── 05_de_thi_thpt_tong_hop.txt          # Math: 20 comprehensive THPT questions
│   ├── 06_sat_math_cbt_english.txt          # SAT: Digital SAT Math practice (English)
│   ├── 07_de_test_nhanh_5_cau.txt           # Quick 5-question test
│   ├── 08_vat_ly_12_dao_dong_co.txt         # Physics: Harmonic oscillation & resonance
│   ├── 09_hoa_hoc_12_este_lipit.txt         # Chemistry: Esters & lipids
│   ├── 10_tieng_anh_thpt_reading_grammar.txt# English: High school grammar & vocabulary
│   ├── 11_lich_su_dia_ly_tong_hop.txt       # Social Sciences: History & Geography
│   └── questions.txt                        # High-school math bank (50 questions)
├── data/
│   ├── questions.txt                        # Standard CBT format dataset
│   ├── de_thi_toan_mau.txt                  # Natural school format dataset
│   └── sample_math_exam.docx                # Sample Microsoft Word (.docx) exam file
├── ding.wav              # Audio asset (Correct answer)
├── buzz.wav              # Audio asset (Incorrect answer)
└── README.md             # Project documentation and architecture guide
```

---

## 🚀 Getting Started

### 1. Direct Browser Access (Zero Setup)
Simply double-click `index.html` to open in any modern browser (Chrome, Edge, Brave, Firefox, Safari).
- Click **"Nạp đề thi mẫu (50 câu)"** to take an exam instantly.
- Or drag and drop any `.txt` or `.docx` file from `question_banks/` directly into the web page!

### 2. Local HTTP Server (Recommended)
```bash
# Using Python 3
python -m http.server 8080

# Or using Node.js
npx serve .
```
Visit `http://localhost:8080` in your web browser.

---

## 📝 Supported Question Formats

### Format A: Vietnamese Natural Exam / Microsoft Word (.docx / .txt)
```text
Câu 1: Một vật dao động điều hòa theo phương trình x = A cos(ωt + φ). Đại lượng ω được gọi là:
A. Tần số dao động
B. Chu kì dao động
C. Tần số góc của dao động
D. Biên độ dao động
Đáp án: C
Lời giải: Trong phương trình dao động điều hòa, ω là tần số góc với đơn vị là rad/s.
```
*(Supports horizontal options: `A. 1  B. 2  C. 3  D. 4`)*

### Format B: Standard CBT Format
```text
Q: What is the derivative of $ f(x) = x^4 $?
T: single
O: $ 4x^4 $
O: $ 5x^4 $
O: $ 4x^3 $
O: $ x^3 $
A: 2
E: Using the power rule $(x^n)' = n x^{n-1}$, the derivative is $4x^3$.
```

---

## 🚢 Publishing to GitHub & GitHub Pages

1. **Link Remote Repository:**
   ```bash
   git remote add origin https://github.com/Harilowji/OmniQuiz.git
   git branch -M main
   git push -u origin main
   ```

2. **Enable GitHub Pages:**
   - In GitHub, navigate to **Settings** > **Pages**.
   - Under **Build and deployment** > **Source**, select **GitHub Actions**.
   - The included workflow `.github/workflows/deploy.yml` will automatically build and publish your website to:
     **`https://harilowji.github.io/OmniQuiz/`**

---

## 📄 License
This project is open-source and available under the [MIT License](LICENSE).
