<p align="center">
  <img src="assets/headers/header.svg" alt="OmniQuiz PRO Header Banner" width="100%" />
</p>

<div align="center">
  <br />
  <img src="assets/logo.svg" alt="OmniQuiz PRO Official Vector Shield Mark" width="120" height="120" />
  <br /><br />
  
  # ⚡ OmniQuiz PRO — Computer-Based Testing (CBT) Engine 🛡️

  **Nền tảng thi và ôn luyện trắc nghiệm chuẩn hóa quốc tế — Không máy chủ, Bảo mật cấp độ Grade A & PWA Offline.**  
  *Next-Generation Universal CBT Platform: 100% Client-Side, WeakMap Isolation Vault, KaTeX Math & Dual-Engine Parser.*

  <br />

  [![Vercel Production](https://img.shields.io/badge/Vercel-Live%20Production-000000?style=for-the-badge&logo=vercel&logoColor=white&labelColor=0d1527)](https://omni-quiz-harilowji.vercel.app/)
  [![GitHub Pages Demo](https://img.shields.io/badge/GitHub%20Pages-Live%20Demo-22c55e?style=for-the-badge&logo=github&logoColor=white&labelColor=0d1527)](https://harilowji.github.io/OmniQuiz/)
  [![Security Grade](https://img.shields.io/badge/Security-Grade%20A%20Audited-059669?style=for-the-badge&logo=shield&logoColor=white&labelColor=0d1527)](https://omni-quiz-harilowji.vercel.app/)
  [![Dependencies](https://img.shields.io/badge/Dependencies-Zero%20(Vanilla%20ES6%2B)-f59e0b?style=for-the-badge&logo=javascript&logoColor=white&labelColor=0d1527)](https://github.com/Harilowji/OmniQuiz)
  [![WCAG Accessibility](https://img.shields.io/badge/WCAG-2.1%20AA%20Compliant-10b981?style=for-the-badge&logo=w3c&logoColor=white&labelColor=0d1527)](https://omni-quiz-harilowji.vercel.app/)
  [![PWA Offline](https://img.shields.io/badge/PWA-100%25%20Offline%20Ready-06b6d4?style=for-the-badge&logo=pwa&logoColor=white&labelColor=0d1527)](https://omni-quiz-harilowji.vercel.app/)
  [![License](https://img.shields.io/badge/License-MIT-818cf8?style=for-the-badge&logo=opensourceinitiative&logoColor=white&labelColor=0d1527)](LICENSE)

  <br />

  [🚀 **Trải Nghiệm Trực Tiếp (Live Demo)**](https://omni-quiz-harilowji.vercel.app/) • [📖 **Báo Cáo Kiểm Toán Bảo Mật**](docs/POST_IMPLEMENTATION_REPORT.md) • [💬 **Đóng Góp Ý Kiến**](https://github.com/Harilowji/OmniQuiz/issues)

  <br />
  <img src="assets/dividers/divider-mini.svg" width="340" />
</div>

---

## 💡 Triết Lý & Bối Cảnh Ra Đời (Why OmniQuiz PRO?)

Trong các kỳ thi chuẩn hóa phổ thông (THPT Quốc Gia, Đánh giá năng lực ĐHQG) và chứng chỉ quốc tế (Digital SAT, Tin học DSA/PRF), nhu cầu về một công cụ làm bài thi trắc nghiệm **ổn định, không phụ thuộc máy chủ, tốc độ tức thì và bảo mật tuyệt đối** là vô cùng cấp thiết:

* **Những bất cập của hệ thống thi truyền thống:** Các nền tảng Web thông thường phụ thuộc vào backend tập trung thường xuyên gặp sự cố nghẽn mạng vào giờ cao điểm, trễ kết nối khi nộp bài, rò rỉ đề thi qua mã nguồn trình duyệt (DevTools/F12), và yếu kém trong việc hiển thị công thức Toán/Hóa phức tạp hoặc khối mã lệnh lập trình.
* **Giải pháp đột phá của OmniQuiz PRO:** Toàn bộ vòng đời bài thi — từ nạp file đề PDF/Word, trích xuất ma trận câu hỏi, cắt đồ thị, dựng công thức KaTeX, đếm giờ chống gian lận, đến chấm điểm và phân tích lỗ hổng kiến thức — được xử lý **100% Client-Side** ngay trong trình duyệt của người dùng với hiệu năng cực đại và chi phí vận hành bằng $0.

---

## 🛡️ Điểm Nhấn Kiến Trúc & Tính Năng Cốt Lõi (Core Highlights)

### 1. 🔒 Vault Isolation Architecture — Bảo Mật Cấp Phòng Thi (Grade A)
Kiến trúc phòng vệ đa tầng độc quyền loại bỏ hoàn toàn các phương thức gian lận qua trình duyệt:
* **SEC-01 (Zero DOM Leakage):** Loại bỏ triệt để việc gán nội dung lời giải chi tiết và đáp án vào DOM Tree khi bài thi đang diễn ra. Tuyệt đối không dùng `style.display = 'none'` để che giấu. DOM chỉ được bơm nội dung giải thích an toàn sau khi đã hoàn tất chấm điểm.
* **SEC-02 (Pipeline SanitizeHtml & Whitelist Tag):** Hệ thống lọc độc lập loại bỏ hoàn toàn `<script>`, `<iframe>`, `<object>`, inline event handlers (`onclick`, `onerror`), và chặn đứng các giao thức nguy hiểm (`javascript:`, `vbscript:`, unsafe `data:`), bảo vệ người dùng trước các vector Stored XSS trong file đề.
* **SEC-03 (WeakMap Closure Vault):** Trong chế độ phòng thi (`exam`), toàn bộ đáp án chính xác nguyên bản (`q.answers`) được cô lập vào `WeakMap` nội bộ trong closure scope. Mảng công khai `window.QuizEngine.state.questions[i].answers` luôn là mảng rỗng `[]`, triệt tiêu khả năng xem trộm qua DevTools Console.
* **SEC-04 (Dual-Layer Storage Obfuscation):** Snapshot câu hỏi và bài thi lưu tại `localStorage` và `IndexedDB` đều được mã hóa xáo trộn bằng thuật toán XOR Dynamic Salt + Base64, ngăn chặn thí sinh mở tab DevTools Application / Storage để đọc đáp án.

---

### 2. ⚡ Dual-Engine Parser — Bộ Bóc Tách Đề Bền Vững Đa Định Dạng
* **Đa nguồn nhập liệu:** Hỗ trợ nhập trực tiếp tệp PDF, Word (`.docx`), văn bản thuần (`.txt`) hoặc đề thi mẫu đa môn học.
* **PRS-01 (Unicode Hidden Space Normalizer):** Tự động phát hiện và chuyển đổi toàn bộ các biến thể khoảng trắng vô hình thường gặp khi trích xuất từ PDF/Word (Non-breaking space `\u00A0`, Zero-width space `\u200B`, BOM `\uFEFF`, v.v.) về khoảng trắng tiêu chuẩn `\u0020`.
* **Cú pháp nhận diện đa dạng:** Nhận diện hoàn hảo cấu trúc đề thi Việt Nam và quốc tế: `Câu 1:`, `Bài 1.`, `Question 1 (1 pt):`, `1/`, `1-`, `1>`, dạng có thang điểm `Câu 1 (2.0 điểm):`, và bảng đáp án ma trận cuối tài liệu (`BẢNG ĐÁP ÁN: 1.A 2.B 3.C...`).
* **Auto-Crop hình ảnh & KaTeX Math:** Tự động cắt đồ thị, sơ đồ từ PDF gắn tương ứng từng câu hỏi; dựng công thức Toán phân số, tích phân, ma trận qua KaTeX siêu tốc và phương trình hóa học qua module `mhchem`.

---

### 3. 🎯 Ergonomic CBT UI/UX & Giám Sát Liêm Chính
* **Bản đồ câu hỏi (Question Map):** Trực quan hóa tiến độ với vòng tròn tỷ lệ % hoàn thành và 4 trạng thái thị giác: *Đã làm*, *Cần xem lại 🚩*, *Chưa làm*, và nút lọc mới **❌ Câu sai (UX-01)** sau khi nộp bài giúp ôn luyện đúng trọng tâm.
* **Per-question Pacing (ANA-01):** Tự động ghi nhận thời gian làm bài thực tế của thí sinh trên từng câu hỏi (`⏱️ 45s`, `⏱️ 1m 20s`) dựa trên vị trí viewport hiển thị thời gian thực.
* **Hệ thống 6 Theme công thái học (Focus Mode):** Bộ màu khoa học giảm mỏi mắt (Slate Focus, Warm Sepia, Sage Calm, Nordic Dark, Clean Minimalist, Soft Peach), tự động ngắt GPU background animation khi bắt đầu thi để tối đa hóa sự tập trung.
* **Giám sát gian lận (Anti-Cheat Engine):** Tự động phát hiện chuyển tab / rời màn hình thi, vô hiệu hóa phím tắt gian lận (<kbd>F12</kbd>, <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>I</kbd>, <kbd>F5</kbd>, <kbd>Ctrl</kbd>+<kbd>P</kbd>), khóa copy đề thi, và cưỡng chế thu bài khi vượt ngưỡng vi phạm.

---

## 📊 Bảng So Sánh Tính Năng (Feature Comparison)

| Tiêu Chí Kỹ Thuật | Nền Tảng Web Trắc Nghiệm Thông Thường | OmniQuiz PRO (CBT Engine) |
| :--- | :---: | :---: |
| **Chống xem đáp án qua F12 / DevTools** | ❌ Lộ qua API JSON hoặc DOM ẩn (`display:none`) | 🛡️ **Grade A (WeakMap Vault + Zero DOM Leaks)** |
| **Phục hồi khi F5 / Mất điện / Crash tab** | ⚠️ Mất bài làm hoặc phụ thuộc server sync | 🛡️ **100% Tức thì (IndexedDB Dual Snapshot)** |
| **Xử lý tệp PDF lớn & Hình ảnh phân giải cao** | ⚠️ Thường giới hạn 5MB - 10MB | 🛡️ **Dung lượng không giới hạn (>50MB IndexedDB)** |
| **Hiển thị công thức Toán & Hóa học** | ⚠️ Thường chuyển thành ảnh mờ, tải chậm | 🛡️ **Vector KaTeX & mhchem siêu tốc (Native text)** |
| **Theo dõi thời gian từng câu (Pacing)** | ❌ Chỉ có tổng thời gian toàn bài | 🛡️ **Bộ đếm thời gian thực lưu trú từng câu** |
| **Bộ lọc câu làm sai sau khi thi** | ⚠️ Phải cuộn thủ công tìm câu sai | 🛡️ **1-Click Palette Filter (`❌ Câu sai`)** |
| **Chi phí máy chủ & Hạ tầng** | ❌ Tốn kém chi phí máy chủ, cơ sở dữ liệu hàng tháng | 🛡️ **$0 Server Cost (100% Client-Side Serverless)** |
| **Bảo mật quyền riêng tư thí sinh** | ❌ Đề thi và thông tin học sinh lưu trên server | 🛡️ **Quyền riêng tư tuyệt đối (Zero Data Exposure)** |

---

## 🏛️ Kiến Trúc Hệ Thống & Cấu Trúc Mã Nguồn (Architecture)

OmniQuiz PRO được thiết kế theo mô hình **Module-driven Clean Architecture** viết bằng Vanilla JavaScript (ES6+) thuần túy, không phụ thuộc vào framework nặng nề (Zero Dependencies), mang lại tốc độ phản hồi sub-millisecond:

```
quiz_app/
├── assets/
│   ├── logo.svg              # Vector logo chính thức (Khiên bảo mật + Tia chớp + Gauge)
│   ├── favicon.svg           # Vector favicon tối ưu sắc nét cho tab trình duyệt
│   ├── headers/              # Banner đồ họa nhận diện thương hiệu
│   └── dividers/             # Phân cách giao diện thẩm mỹ
├── css/
│   ├── main.css              # Hệ thống layout nền tảng, biến màu CSS Variables
│   ├── themes.css            # 6 hệ thống màu công thái học (Focus Ergonomics)
│   ├── components.css        # Palette matrix, modal, badge, button, pacing styles
│   └── animations.css        # Hiệu ứng chuyển động mượt mà GPU-accelerated
├── js/
│   ├── parser.js             # Bộ bóc tách PDF/Word, chuẩn hóa Unicode & HTML Sanitizer
│   ├── quiz-engine.js        # Core State Machine, WeakMap Answer Vault, Pacing Tracker
│   ├── storage.js            # Dual Persistence Engine (IndexedDB + XOR Masked LocalStorage)
│   ├── ui.js                 # DOM Renderer, KaTeX typesetting & Interactive Question Map
│   ├── app.js                # Main Controller, Lifecycle Orchestrator & Anti-Cheat Monitor
│   ├── editor.js             # Studio sáng tạo & biên tập đề thi trực quan (Live KaTeX)
│   ├── room-manager.js       # Cloud Exam Room PIN & Bảng xếp hạng trực tuyến
│   ├── i18n.js               # Động cơ đa ngôn ngữ song ngữ (Tiếng Việt & English)
│   ├── audio.js              # Bộ phát âm thanh hiệu ứng phòng thi (Web Audio API)
│   └── confetti.js           # Hiệu ứng pháo hoa chúc mừng điểm số cao
├── index.html                # Single Page Application entry point chuẩn WCAG 2.1 AA
├── manifest.json             # Cấu hình cài đặt Progressive Web App (PWA)
├── sw.js                     # Service Worker lưu cache offline Stale-While-Revalidate
├── vercel.json               # Cấu hình định tuyến và tối ưu CDN trên Vercel
└── Dockerfile                # Image Nginx Alpine siêu nhẹ phục vụ triển khai nội bộ
```

---

## 🚀 Hướng Dẫn Cài Đặt & Triển Khai (Setup & Deployment)

### Cách 1: Sử dụng trực tiếp trên Cloud (Khuyên dùng)
Truy cập ngay phiên bản chính thức trên Vercel:  
👉 **[https://omni-quiz-harilowji.vercel.app](https://omni-quiz-harilowji.vercel.app/)**

---

### Cách 2: Chạy cục bộ (Local Development)
Dự án thuần HTML5/ES6 nên bạn có thể khởi chạy bằng bất kỳ HTTP Server tĩnh nào:

```bash
# 1. Sao chép kho mã nguồn
git clone https://github.com/Harilowji/OmniQuiz.git
cd OmniQuiz

# 2. Khởi chạy bằng Python 3
python -m http.server 8080

# Hoặc khởi chạy bằng Node.js (npx)
npx serve .

# Hoặc khởi chạy bằng Docker
docker compose up -d
```
Mở trình duyệt tại địa chỉ: `http://localhost:8080`.

---

### Cách 3: Triển khai 1-Click lên Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FHarilowji%2FOmniQuiz)

---

## ⌨️ Bảng Phím Tắt Phòng Thi (Keyboard Shortcuts)

Hệ thống tuân thủ nghiêm ngặt tiêu chuẩn tiếp cận tiếp nhận **WCAG 2.1 AA**, cho phép hoàn thành bài thi 100% bằng bàn phím mà không cần chuột:

| Phím Tắt | Chức Năng |
| :---: | :--- |
| <kbd>1</kbd> ... <kbd>4</kbd> hoặc <kbd>A</kbd> ... <kbd>D</kbd> | Chọn nhanh đáp án trắc nghiệm tương ứng A, B, C, D |
| <kbd>←</kbd> / <kbd>→</kbd> | Điều hướng chuyển nhanh giữa Câu hỏi Trước / Câu hỏi Kế tiếp |
| <kbd>F</kbd> | Đặt cờ / Hủy cờ đánh dấu câu hỏi cần xem lại (Flag review) |
| <kbd>Space</kbd> / <kbd>Enter</kbd> | Xác nhận lựa chọn đáp án cho câu hỏi đang focus |
| <kbd>F11</kbd> | Kích hoạt / Thoát chế độ phòng thi toàn màn hình (Fullscreen CBT) |
| <kbd>Esc</kbd> | Đóng nhanh modal hộp thoại cảnh báo / bảng thống kê kết quả |

---

## 🗺️ Lộ Trình Phát Triển (Product Roadmap)

- [x] **Giai đoạn 1 (v1.0 - v2.0):** Hỗ trợ KaTeX MathJax, PWA Offline, Dual Storage IndexedDB + LocalStorage, Anti-Cheat cơ bản.
- [x] **Giai đoạn 2 (v3.0):** Tích hợp Question Studio biên tập trực quan, Phòng thi Online qua mã PIN (Cloud Supabase Room PIN), 6 Theme công thái học.
- [x] **Giai đoạn 3 (v3.5 - Security Hardening):** Khắc phục triệt để SEC-01 $\rightarrow$ SEC-04, WeakMap Answer Vault, XOR Storage Masking, bộ lọc Câu làm sai (UX-01), và Per-question Pacing (ANA-01).
- [ ] **Giai đoạn 4 (v4.0 - Sắp ra mắt):**
  - [ ] **AI Exam Generator:** Tự động tạo câu hỏi trắc nghiệm thông minh từ tài liệu học tập hoặc ảnh chụp giáo trình qua Gemini API.
  - [ ] **Interactive Canvas Scratchpad:** Bảng nháp viết tay số hóa trực tiếp trên màn hình câu hỏi phục vụ tính toán Toán / Lý / Hóa.
  - [ ] **Live Proctoring Multi-Cam:** Giám sát phòng thi thời gian thực qua WebRTC cho các kỳ thi học kỳ quy mô lớn.

---

## 📄 Giấy Phép & Tác Giả (License & Credits)

* Phát hành theo giấy phép bản quyền nguồn mở [MIT License](LICENSE). Tự do sử dụng cho mục đích giáo dục, ôn luyện cá nhân và phát triển thương mại.
* Bản quyền thuộc về **[Harilowji](https://github.com/Harilowji)** (Lead Architect & Developer).

<div align="center">
  <br />
  <img src="assets/footers/footer.svg" width="100%" />
  <br /><br />
  <b>OmniQuiz PRO</b> — <i>Kiến tạo chuẩn mực mới cho nền tảng thi trắc nghiệm máy tính hiện đại.</i>
</div>
