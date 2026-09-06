# 📐 Math Quiz CBT Platform (Computer-Based Testing)

An interactive, high-performance web application designed for mathematical computer-based testing, featuring full **LaTeX/MathJax 3** formula rendering, dynamic **Question Palette**, multi-mode testing (**Practice** vs. **Exam**), bilingual internationalization (**Tiếng Việt / English**), 4 distinct dynamic animated UI themes, auto-save state persistence, audio feedback, client-side **Word (.docx) parsing**, and **PDF report export**.

![MathJax](https://img.shields.io/badge/MathJax-3.0-blue?style=for-the-badge)
![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/Vanilla_JS-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)
![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)

---

## 🚀 Key Features

- **LaTeX & MathJax 3 Engine:** Seamlessly formats complex algebraic, calculus, and arithmetic notation in real time with HTML entity shielding to protect inequality formulas (`$0 < x < 5$`).
- **Flexible File Import (.txt & .docx Word):**
  - Reads modern Microsoft Word files (`.docx`) client-side using `mammoth.js`.
  - Supports both drag-and-drop and standard file browsing.
  - Built-in instant "Nạp đề thi mẫu (50 câu)" button for zero-click testing.
- **Dual-Engine Question Parser:**
  - **Format 1 (Standard CBT):** `Q:`, `T:`, `O:`, `A:`, `E:`.
  - **Format 2 (Vietnamese School & Natural Exam):** `Câu 1:`, `A.`, `B.`, `C.`, `D.`, `Đáp án: A`, `Lời giải: ...`. Supports horizontal options (`A. 1  B. 2  C. 3  D. 4`).
- **Interactive Question Palette (Bản đồ câu hỏi):**
  - Instant navigation to any question with smooth scrolling & highlight pulse animations.
  - Color-coded badges: 🟢 Correct, 🔴 Incorrect, 🔵 Answered (Exam), 🟡 Flagged for Review 🚩, ⚪ Unanswered.
  - Multi-criteria filter tabs: *All*, *Answered*, *Flagged*, *Unanswered*.
- **Dual Testing Modes:**
  - **🎯 Practice Mode (Luyện tập):** Instant evaluation, audio feedback (`ding`/`buzz`), and immediate step-by-step explanations.
  - **⏱️ Exam Mode (Thi thử):** Simulates real standardized exam conditions with customizable countdown timer and final grading report.
- **Auto-Save & State Persistence (LocalStorage):**
  - Preserves user selections, question flags, and countdown timer across browser refreshes (`F5`).
- **Bilingual Interface (i18n):**
  - Switch instantly between 🇻🇳 **Tiếng Việt** and 🇬🇧 **English** with real-time text re-rendering.
- **4 Dynamic Animated Background Themes:**
  1. `Academic (Math)`: Animated engineering blueprint & graph paper coordinate drift (*Merriweather*).
  2. `Minimalist`: Modern flowing aurora mesh gradient with frosted glass cards (*Inter*).
  3. `Cyberpunk`: Retro-futuristic moving neon scanlines, dark cyber grid, and glowing borders (*Orbitron*).
  4. `Playful`: Floating pastel candy bubbles and rounded 3D cards (*Quicksand*).
- **Celebration Confetti & Scoring:**
  - Lightweight Canvas particle confetti animation for scores $\ge 75\%$.
  - Scaled scoring system (score out of 100 with correct/incorrect breakdown).
- **Client-Side PDF Generation:**
  - Exports a styled review sheet of all incorrectly answered questions using `html2pdf.js`.
- **Shuffle Engine (Đảo đề):**
  - Randomizes question orders using the Fisher-Yates algorithm for anti-memorization practice.

---

## 📂 Project Structure

```text
quiz_app/
├── index.html            # Clean HTML5 entry point linking modular assets & PWA manifest
├── manifest.json         # Web App Manifest for PWA installation
├── LICENSE               # MIT Open Source License
├── .gitignore            # Git exclusion rules
├── .github/
│   └── workflows/
│       └── deploy.yml    # Automated GitHub Actions deployment to GitHub Pages
├── css/
│   ├── main.css          # Base resets, container layout, scrollbars
│   ├── themes.css        # 4 Themes with dynamic animated backgrounds & glassmorphism
│   ├── components.css    # UI components (navbar, cards, options, dropzone, palette, modal)
│   └── animations.css    # Dynamic keyframes (academicGridDrift, cyberpunkScanline, etc.)
├── js/
│   ├── i18n.js           # Multi-language dictionary (Tiếng Việt / English)
│   ├── audio.js          # Audio engine (HTML5 Audio + Web Audio API synthesizer)
│   ├── storage.js        # LocalStorage state persistence manager
│   ├── confetti.js       # Canvas celebratory particle engine
│   ├── parser.js         # Dual-engine question bank parser & auto-LaTeX formatter
│   ├── quiz-engine.js    # Core test logic, scoring, and PDF report generator
│   ├── ui.js             # DOM renderer, granular element updates & modal controller
│   └── app.js            # Main application coordinator, drag-and-drop & event binder
├── question_banks/       # Curated topic-based exam banks (Ready to use & edit)
│   ├── HUONG_DAN_SOAN_DE.txt # Detailed guide for creating custom exams
│   ├── 01_khao_sat_ham_so.txt # 10 calculus & function analysis questions
│   ├── 02_mu_va_logarit.txt   # 10 exponent & logarithm questions
│   ├── 03_nguyen_ham_tich_phan.txt # 10 antiderivative & integral questions
│   ├── 04_hinh_hoc_oxyz.txt   # 10 Oxyz coordinate geometry questions
│   ├── 05_de_thi_thpt_tong_hop.txt # 20 comprehensive THPT national exam questions
│   ├── 06_sat_math_cbt_english.txt # 10 Digital SAT Math practice questions (English)
│   ├── 07_de_test_nhanh_5_cau.txt  # 5 quick test questions
│   └── questions.txt          # 50 classic high-school math questions
├── data/
│   ├── questions.txt     # Standard CBT format dataset (50 math questions)
│   ├── de_thi_toan_mau.txt # Vietnamese school format sample exam
│   └── sample_math_exam.docx # Sample Microsoft Word (.docx) exam file
├── questions.txt         # Root fallback dataset
├── generate_questions.py # Python utility to synthesize question datasets
├── ding.wav              # Audio asset (Correct answer)
├── buzz.wav              # Audio asset (Incorrect answer)
└── README.md             # Project documentation and architecture guide
```

---

## 📥 Getting Started

### 1. Local Browser (Zero Setup)
Simply double-click `index.html` to open it in Chrome, Edge, Brave, or Firefox.
- Click **"Nạp đề thi mẫu (50 câu)"** to start immediately.
- Or drag and drop any `.txt` or `.docx` file into the upload zone!

### 2. Local Web Server (Recommended)
Run a lightweight HTTP server:
```bash
# Using Python
python -m http.server 8080

# Or using Node.js
npx serve .
```
Navigate to `http://localhost:8080` in your web browser.

---

## 📝 Supported Question Formats

### Format A: Vietnamese School / Natural Exam (Word or Text)
```text
Câu 1: Cho hàm số y = f(x) có đạo hàm f'(x) = x^2 - 4. Điểm cực đại là:
A. x = 2
B. x = -2
C. x = 0
D. Không có cực đại
Đáp án: B
Lời giải: Ta xét dấu đạo hàm, f'(x) đổi dấu từ dương sang âm tại x = -2.
```
*(Supports horizontal options such as `A. 1  B. 2  C. 3  D. 4`)*

### Format B: CBT Standard Specification
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

## 🚢 Publishing to GitHub Pages

1. Initialize Git and commit files:
   ```bash
   git init
   git add .
   git commit -m "feat: complete Math Quiz CBT platform with Word import & dynamic backgrounds"
   ```
2. Create a repository on GitHub and link the remote:
   ```bash
   git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
   git branch -M main
   git push -u origin main
   ```
3. In your GitHub repository:
   - Go to **Settings** > **Pages**
   - Under **Build and deployment** > **Source**, choose **GitHub Actions**
   - The included `.github/workflows/deploy.yml` will automatically build and publish your website!

---

## 📄 License
Released under the [MIT License](LICENSE).
