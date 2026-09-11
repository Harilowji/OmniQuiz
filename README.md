<div align="center">
  <img src="assets/logo.svg" alt="OmniQuiz PRO Logo" width="100" height="100" />
  
  # OmniQuiz PRO — Client-Side CBT Engine 🛡️

  **Nền tảng thi và ôn luyện trắc nghiệm chuẩn hóa 100% Client-Side, bảo mật cấp độ Grade A, không phụ thuộc máy chủ.**

  <br />

  [![Vercel Live](https://img.shields.io/badge/Demo-Vercel%20Live-000000?style=for-the-badge&logo=vercel&logoColor=white&labelColor=0d1527)](https://omni-quiz-harilowji.vercel.app/)
  [![Security Grade A](https://img.shields.io/badge/Security-Grade%20A%20Audited-059669?style=for-the-badge&logo=shield&logoColor=white&labelColor=0d1527)](docs/POST_IMPLEMENTATION_REPORT.md)
  [![Zero Dependencies](https://img.shields.io/badge/Stack-Vanilla%20JS%20(Zero%20Deps)-f59e0b?style=for-the-badge&logo=javascript&logoColor=white&labelColor=0d1527)](https://github.com/Harilowji/OmniQuiz)
  [![WCAG 2.1 AA](https://img.shields.io/badge/Accessibility-WCAG%202.1%20AA-10b981?style=for-the-badge&logo=w3c&logoColor=white&labelColor=0d1527)](https://omni-quiz-harilowji.vercel.app/)
  [![PWA Offline](https://img.shields.io/badge/PWA-100%25%20Offline-06b6d4?style=for-the-badge&logo=pwa&logoColor=white&labelColor=0d1527)](https://omni-quiz-harilowji.vercel.app/)
  [![License MIT](https://img.shields.io/badge/License-MIT-4f46e5?style=for-the-badge&logo=opensourceinitiative&logoColor=white&labelColor=0d1527)](LICENSE)

  <br />

  👉 **[Trải nghiệm trực tiếp tại: omni-quiz-harilowji.vercel.app](https://omni-quiz-harilowji.vercel.app/)**
</div>

---

## ⚡ 5 Điểm Nổi Bật Cốt Lõi

* 🔒 **Bảo mật phòng thi (Grade A Security):** Giấu đáp án thật vào `WeakMap Vault`, xóa đáp án trong `state` khi thi để chống soi DevTools Console; triệt tiêu hoàn toàn rò rỉ lời giải trong DOM Tree; mã hóa XOR/Base64 khi lưu vào Storage/IndexedDB; tích hợp bộ lọc HTML Sanitizer chống Stored XSS.
* 🤖 **Gia sư AI & Quét ảnh tạo đề OCR (Gemini Powered):** Tích hợp Google Gemini Flash API trực tiếp; nút "Hỏi Gia sư AI" trên từng câu giúp vạch trần bẫy tư duy, chia sẻ mẹo bấm máy Casio & giải nhanh trong 30s; hỗ trợ kéo thả hoặc dán ảnh chụp sách/màn hình để tự động bóc tách thành bộ đề thi chuẩn.
* 🎴 **Chế độ Lật thẻ 3D & Lặp lại ngắt quãng (Spaced Repetition):** Trực quan hóa câu hỏi dưới dạng thẻ 3D Flip Card; theo dõi tỉ lệ thuần thục (Mastery Rate); vòng lặp ôn tập ngắt quãng thông minh tự động gom các câu "Chưa thuộc" để rèn luyện đến khi đạt 100%.
* 📄 **Parser đa năng & Siêu bền bỉ:** Bóc tách đề từ PDF, Word (`.docx`), văn bản thuần (`.txt`) hoặc đề mẫu; tự động sửa khoảng trắng ẩn Unicode/BOM (`\u00A0`, `\u200B`); nhận diện linh hoạt mọi cú pháp đề; hiển thị công thức Toán LaTeX/KaTeX, Hóa học `mhchem` và tự cắt đồ thị PDF.
* ⏱️ **Phòng thi chuẩn CBT & Phân tích chuyên sâu:** Đếm ngược thời gian tuyệt đối theo Timestamp chống trôi giờ khi ẩn tab; tự động sao lưu IndexedDB chống mất bài 100% khi F5/crash; giám sát rời màn hình thi; bộ đếm thời gian lưu trú từng câu (**Per-question Pacing** `⏱️ 45s`) và xuất PDF câu sai.

---

## 🏛️ Cấu Trúc Mã Nguồn (Core Architecture)

Thiết kế theo kiến trúc Module-driven thuần Vanilla JavaScript (ES6+), tải nhẹ (< 150KB), tốc độ phản hồi tức thì:

```
quiz_app/
├── assets/               # Logo, favicon (SVG vector) & đồ họa nhận diện
├── css/                  # Layout, 6 themes công thái học (Focus Ergonomics), 3D Flashcard
├── js/
│   ├── ai-tutor.js       # Gia sư AI & Trích xuất đề thi từ ảnh OCR (Google Gemini API)
│   ├── flashcard.js      # 3D Flip Card Engine & Spaced Repetition Loop
│   ├── parser.js         # Bóc tách PDF/Word/TXT, chuẩn hóa Unicode & HTML Sanitizer
│   ├── quiz-engine.js    # State machine, WeakMap Answer Vault, Pacing & chấm điểm
│   ├── storage.js        # Dual-layer persistence (IndexedDB + XOR Masked LocalStorage)
│   ├── ui.js             # DOM Renderer, KaTeX typesetting & Interactive Question Map
│   └── app.js            # Main controller, lifecycle orchestrator & Anti-Cheat monitor
└── index.html            # Single Page Application chuẩn WCAG 2.1 AA & Progressive Disclosure
```

---

## 🚀 Hướng Dẫn Chạy Nhanh & Triển Khai

### 1. Chạy cục bộ (Local Development)
Chỉ cần 2 dòng lệnh với Node.js:
```bash
git clone https://github.com/Harilowji/OmniQuiz.git && cd OmniQuiz
npx serve .
```
Hoặc dùng Python 3: `python -m http.server 8080`. Mở trình duyệt tại `http://localhost:8080` (hoặc cổng hiển thị trên terminal).

### 2. Triển khai 1-Click lên Vercel
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FHarilowji%2FOmniQuiz)

---

## ⌨️ Phím Tắt Tiện Ích

* <kbd>1</kbd> ... <kbd>4</kbd> hoặc <kbd>A</kbd> ... <kbd>D</kbd>: Chọn nhanh đáp án A, B, C, D (Chế độ Làm bài).
* <kbd>Space</kbd>: Lật thẻ 3D xem đáp án & giải thích chi tiết (Chế độ Flashcard).
* <kbd>1</kbd> hoặc <kbd>←</kbd>: Đánh dấu thẻ "Chưa thuộc" (Cần lặp lại ngắt quãng).
* <kbd>2</kbd> hoặc <kbd>→</kbd>: Đánh dấu thẻ "Đã thuộc" (Tăng Mastery Rate).
* <kbd>Ctrl</kbd> + <kbd>Z</kbd>: Hoàn tác thẻ vừa đánh giá.
* <kbd>F</kbd>: Đặt cờ / Bỏ cờ câu hỏi cần xem lại.
* <kbd>F11</kbd>: Bật / Tắt chế độ Toàn màn hình (Fullscreen CBT).
* <kbd>Esc</kbd>: Đóng nhanh modal thông báo / kết quả thi.

---

## 📄 Giấy Phép (License)

Phát hành theo giấy phép nguồn mở [MIT License](LICENSE) · Bản quyền thuộc về **[Harilowji](https://github.com/Harilowji)**.
