# OMNIQUIZ PRO (CBT STUDIO 2.0) - ENTERPRISE EDTECH RE-ENGINEERING CHANGELOG

## 📋 Tổng quan Dự án (Executive Summary)
Toàn bộ nền tảng **OmniQuiz PRO / CBT Studio 2.0** đã được tái thiết kế và nâng cấp từ kiến trúc đơn khối sang kiến trúc web cấp doanh nghiệp (**Enterprise EdTech Standard**) theo chuẩn **Feature-Sliced Architecture (FSA)**, hoạt động theo triết lý **Local-First**, hỗ trợ **Strict TypeScript (Zero `any`)**, bảo mật liêm chính phòng thi tuyệt đối, và tối ưu hóa hiệu năng 60-120 FPS.

---

## 🏛️ 1. Tái cấu trúc Kiến trúc (Feature-Sliced Architecture - FSA)
Hệ thống được module hóa triệt để và phân chia thành các domain độc lập:

```text
src/
├── app/
│   └── main.ts                          # Bootstrap điều phối ứng dụng, routing, UI lifecycle
├── features/
│   ├── lobby/                           # Màn hình chờ: Upload File Hub, Chọn đề mẫu, Nhập PIN
│   │   └── lobby-view.ts
│   ├── parser/                          # Web Worker Parser Client
│   │   └── document-parser.ts
│   ├── proctoring/                      # Trung tâm giám thị & chống gian lận CBT
│   │   └── proctoring-service.ts
│   ├── exam-engine/                     # State Machine FSM, Điều hướng câu hỏi, Lưu tự động
│   │   ├── exam-state-machine.ts
│   │   └── question-navigator.ts
│   ├── study-modes/                     # Bộ 3 chế độ học tập chuẩn hóa
│   │   ├── exam/                        # CBT Standardized Mode (SAT/THPT split-view)
│   │   │   └── exam-view.ts
│   │   ├── practice/                    # Luyện tập tương tác (Loại suy đáp án, giải thích tức thì)
│   │   │   └── practice-view.ts
│   │   └── flashcard/                   # Thẻ ghi nhớ 3D với thuật toán lặp lại ngắt quãng (SM-2)
│   │       ├── flashcard-view.ts
│   │       └── sm2-algorithm.ts
│   ├── multiplayer/                     # Phòng thi trực tuyến thời gian thực mã PIN 6 số
│   │   └── room-service.ts
│   └── analytics/                       # Phân tích học tập chuyên sâu, Biểu đồ Radar & Xuất PDF
│       └── analytics-service.ts
├── shared/
│   ├── components/lightbox.ts           # Xem phóng to ảnh/sơ đồ chuẩn
│   ├── db/
│   │   ├── dexie-db.ts                  # Local-First IndexedDB (Dexie.js)
│   │   └── supabase.ts                  # Supabase Realtime & Cloud Backup
│   ├── fixtures/                        # 9 Đề thi mẫu JSON chuẩn hóa (Zero-Regression)
│   ├── renderers/                       # KaTeX Math Formula & Shiki Code Renderer
│   └── types/index.ts                   # Strict Domain Type Definitions
└── workers/
    └── document-parser.worker.ts        # Worker giải mã tài liệu độc lập với JSZip & PDF.js
```

---

## 📦 2. Bảo toàn Dữ liệu Mẫu (Zero-Regression Fixtures)
Tất cả 9 đề thi mẫu từ phiên bản cũ đã được trích xuất và chuẩn hóa thành các JSON fixtures có kiểu dữ liệu nghiêm ngặt trong `src/shared/fixtures/`:
1. `informatics_10.json`: 10 câu Tin học & Lập trình (C, Python, SQL, Cấu trúc dữ liệu).
2. `chem_40_pdf.json`: 40 câu trắc nghiệm Hóa học Hữu cơ Đại cương trích xuất từ PDF.
3. `math_50.json`: 50 câu trắc nghiệm Toán học THPT Chuẩn hóa.
4. `sat_math.json`: 10 câu Digital SAT Math CBT chuẩn quốc tế.
5. `physics_12.json`: 5 câu Vật lý 12 Dao động cơ học.
6. `chem_12.json`: 5 câu Hóa học 12 Este & Lipit.
7. `english_thpt.json`: 5 câu Tiếng Anh THPT Ngữ pháp & Từ vựng.
8. `social_12.json`: 5 câu Lịch sử & Địa lý Tổng hợp.
9. `quick_5.json`: 5 câu kiểm tra nhanh hệ thống.

---

## ⚙️ 3. Chuẩn hóa Finite State Machine (FSM) & Khởi tạo Tuyệt đối
- **Phân tách trạng thái nghiêm ngặt:**
  - `IDLE`: Màn hình khởi tạo tinh gọn chỉ hiển thị Header và CBT Studio Upload Hub (`#upload-section`). Bản đồ câu hỏi, bộ đếm giờ (`60:00`), thanh tiến độ và thanh thống kê bị ẩn hoàn toàn (Zero UI Leakage).
  - `CONFIGURING`: Trạng thái cấu hình thời gian thi và chế độ làm bài.
  - `RUNNING`: Đang làm bài thi, timer đếm ngược, tự động ghi nhận thời gian làm từng câu.
  - `PAUSED`: Tạm dừng bình thường.
  - `PAUSED_VIOLATION`: Tạm dừng do vi phạm giám thị phòng thi.
  - `SUBMITTED`: Đã nộp bài, chấm điểm tự động tức thì.
  - `DISQUALIFIED`: Truất quyền thi do vi phạm quy chế quá 3 lần.
- **Phục hồi sự cố (Crash Recovery):**
  - Banner không chặn (`#recovery-banner`) hỏi ý kiến thí sinh khi phát hiện phiên thi dở dang trong IndexedDB, không tự động đè giao diện.

---

## 📄 4. Web Worker Document Parser Engine 3.0
- **Tách luồng hoàn toàn (Background Worker Thread):**
  - Giải mã PDF (`pdfjs-dist`), Word DOCX (`mammoth`), và TXT mà không làm đơ giật UI thread (đảm bảo 60-120 FPS).
  - Tích hợp **JSZip** bóc tách tự động hình ảnh sơ đồ (`word/media/`) từ tệp DOCX và chuyển đổi thành Data URI.
  - Bộ phân tích Heuristic Tokenizer tự động bỏ qua phần tiêu đề/header mở đầu, không tạo câu hỏi giả.
  - Bóc tách bảng đáp án ở cuối văn bản (`BẢNG ĐÁP ÁN: 1.A 2.B...`) và tự động gán vào các câu hỏi.
  - Nhận diện đoạn văn đọc hiểu (`Passage`) để kích hoạt chế độ Digital SAT Split View.

---

## 🛡️ 5. Trung tâm Giám thị CBT Proctoring
- **Hệ thống cảnh báo 3 cấp độ (3-Tier Violation System):**
  - *Tier 1:* Banner cảnh báo màu đỏ nhẹ (Fullscreen exit, blur tab, thao tác chuột phải).
  - *Tier 2:* Modal phong tỏa bài thi, tạm dừng bộ đếm giờ, yêu cầu cam kết liêm chính.
  - *Tier 3:* Truất quyền thi (`DISQUALIFIED`), tự động thu bài và khóa kết quả thi.
- Chặn các phím tắt nguy hiểm: `Ctrl+C`, `Ctrl+V`, `F12`, `Ctrl+Shift+I`.

---

## 🎯 6. Bộ 3 Chế độ Khảo thí (Tri-Mode Suite)
1. **CBT Exam View:**
   - Giao diện Digital SAT Split-View: Đọc hiểu văn bản bên trái, câu hỏi và đáp án bên phải.
   - Bản đồ câu hỏi 5 trạng thái: Chưa làm, Đang xem, Đã làm, Gắn cờ, Loại suy.
   - Timer countdown có hiệu ứng nhịp tim khi thời gian < 5 phút.
2. **Interactive Practice View:**
   - Công cụ loại suy đáp án (`̶S̶` / Phím tắt `E`): Gạch ngang phương án sai.
   - Phản hồi tức thì & giải thích chi tiết với công thức toán KaTeX.
3. **3D Flashcard View:**
   - Thuật toán lặp lại ngắt quãng **SuperMemo-2 (SM-2)** với 4 mức đánh giá: Again (1), Hard (3), Good (4), Easy (5).
   - Tự động điều chỉnh `easeFactor`, `interval`, và tính toán `dueDate` chính xác.

---

## 🌐 7. Phòng thi Trực tuyến PIN 6 số & Local-First
- Tạo phòng thi trực tuyến với mã PIN ngẫu nhiên 6 chữ số.
- Đồng bộ thí sinh theo thời gian thực (Presence) và phát sóng bắt đầu thi (Broadcast) qua Supabase Realtime.
- Bảng xếp hạng trực tiếp (Live Leaderboard) tính điểm và thời gian nộp bài.
- Tự động lưu ngầm (Local-First Auto-Save) vào IndexedDB mỗi 2 giây.

---

## 📊 8. Báo cáo Phân tích Chuyên sâu & Xuất PDF
- Biểu đồ mạng nhện Radar Chart phân tích mức độ thành thạo môn học theo chuẩn Chart.js.
- Biểu đồ phân bổ thời gian (Time Distribution Chart): Nhận diện câu đoán mò (< 5s) và câu nghẽn (> 180s).
- Xuất phiếu bài thi PDF khổ A4 với cơ chế mã hóa văn bản an toàn, chống lỗi font tiếng Việt.
- Xuất bảng điểm CSV UTF-8 với BOM và gói dữ liệu JSON đầy đủ.

---

## 📱 9. Tối ưu Giao diện Mobile & Responsive
- Thao tác vuốt màn hình cảm ứng (**Touch Swipe Left/Right**) chuyển câu hỏi linh hoạt trên thiết bị di động (< 768px).
- Bản đồ câu hỏi dạng ngăn kéo Bottom Sheet (`.palette-sidebar.mobile-drawer`) với nút nổi FAB (`#btn-mobile-palette-toggle`) và phông nền mờ (`#palette-drawer-backdrop`).

---

## 🧪 10. Kiểm thử & Đảm bảo Chất lượng (Quality Assurance)
- **100% Strict TypeScript:** Lệnh `tsc --noEmit` hoàn thành với **0 lỗi**.
- **Bộ kiểm thử tự động toàn diện (36/36 Tests Passed):**
  - Backend API Tests: `17 passed` (`node tests/api.test.js`)
  - Vitest Unit Tests:
    - `parser.test.ts`: `6 passed`
    - `sm2.test.ts`: `4 passed`
    - `fsm.test.ts`: `8 passed`
  - Vitest Integration Tests:
    - `exam-flow.test.ts`: `1 passed`
- **Build Production:** `npm run build` tạo bundle tối ưu thành công trong 1.67 giây.
