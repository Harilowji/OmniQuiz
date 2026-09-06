# <p align="center"><img src="assets/logo.png" width="140" alt="OmniQuiz Logo" /><br>⚡ OmniQuiz Pro</p>

<p align="center">
  <b>Hệ thống Thi trắc nghiệm Máy tính (CBT) & Luyện thi Đa môn Chuyên sâu</b><br>
  <i>Universal Computer-Based Testing & Exam Preparation Platform — 100% Client-Side & Zero-Backend</i>
</p>

<p align="center">
  <a href="https://harilowji.github.io/OmniQuiz/"><img src="https://img.shields.io/badge/Live_Demo-GitHub_Pages-22c55e?style=for-the-badge&logo=github&logoColor=white" alt="Live Demo" /></a>
  <img src="https://img.shields.io/badge/Version-2.5_Pro-6366f1?style=for-the-badge" alt="Version 2.5 Pro" />
  <img src="https://img.shields.io/badge/Docker-Ready-2496ED?style=for-the-badge&logo=docker&logoColor=white" alt="Docker Ready" />
  <img src="https://img.shields.io/badge/MathJax-3.2_%2B_mhchem-008080?style=for-the-badge" alt="MathJax 3.2" />
  <img src="https://img.shields.io/badge/Vanilla_JS-ES6+-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black" alt="Vanilla JS" />
  <img src="https://img.shields.io/badge/License-MIT-blue?style=for-the-badge" alt="License MIT" />
</p>

---

## 📖 Giới thiệu (Overview)

**OmniQuiz Pro** là nền tảng thi trắc nghiệm trực tuyến thế hệ mới, hoạt động hoàn toàn trên trình duyệt người dùng (**100% Client-Side**, không phụ thuộc máy chủ lưu trữ). Được xây dựng với tiêu chuẩn thiết kế hiện đại lấy cảm hứng từ **Duolingo, Azota 2.0 và Linear**, OmniQuiz giải quyết triệt để nhu cầu ôn luyện mọi môn học trong chương trình giáo dục THPT, Đại học và các chứng chỉ quốc tế:

- 📐 **Toán học & Khoa học Tự nhiên:** Hiển thị công thức LaTeX phức tạp (tích phân, ma trận, vector, hình học giải tích Oxyz).
- 🧪 **Hóa học chuyên sâu:** Tự động nhận diện công thức chất, phương trình ion và phản ứng hóa học thông qua tiện ích mở rộng `mhchem`.
- 💻 **Tin học & Lập trình (PRF/DSA):** Tích hợp khung hiển thị mã nguồn chuẩn monospaced cho Python, C++, Pascal, SQL, JavaScript... kèm nút sao chép mã 1-chạm.
- 🇬🇧 **Ngoại ngữ & Xã hội:** Hỗ trợ đề đọc hiểu Tiếng Anh (THPT, Digital SAT), Lịch sử, Địa lý và Giáo dục Kinh tế & Pháp luật.
- 📄 **Đọc đa định dạng tài liệu:** Tự động phân tích file **PDF**, **Microsoft Word (.docx)** và **Text (.txt)**, tự động trích xuất bảng đáp án cuối trang và cắt ghép sơ đồ hình ảnh minh họa tương ứng từng câu hỏi.

---

## 🌟 Tính năng Đột phá (Key Features)

### 🦉 1. Nhận diện Thương hiệu Pro & Thiết kế UX/UI Hiện đại
- **Biểu tượng Mascot Pro:** Logo độc quyền hình Cú công nghệ thông minh phong cách Origami 3D đa giác, kết hợp dải xoắn vô cực (Infinity Loop) và nón cử nhân tượng trưng cho trí tuệ và học tập không giới hạn.
- **Dual-Zone Upload Studio:** Khu vực tải đề kép gồm vùng thả file trực quan (Zone 1) và kho đề mẫu phân loại theo thẻ chủ đề môn học (Zone 2) với các nút chọn nhanh 1-chạm (*Toán, Lý, Hóa, Tin, Anh, Xã hội, SAT*).
- **Thẻ câu hỏi & Tương tác cao cấp:** Hiển thị vạch màu chủ đề bên trái, hiệu ứng nổi mềm mại khi di chuột (Elevation), nút chọn đáp án radio tròn chuẩn CBT quốc tế.

### 📄 2. Bộ nạp Đề thông minh Đa định dạng (.PDF, .DOCX, .TXT)
- **Hỗ trợ Microsoft Word (`.docx`):** Giải mã trực tiếp trên trình duyệt thông qua `mammoth.js`, trích xuất toàn bộ văn bản và tự động hiển thị hình ảnh minh họa đính kèm trong file Word.
- **Hỗ trợ Adobe PDF (`.pdf`):** 
  - Phân tích luồng văn bản PDF từng trang bằng `pdf.js`.
  - Tự động nhận diện và quét **bảng đáp án dạng lưới/bảng ma trận** ở cuối tài liệu (ví dụ: `1.A  2.B  3.C...` hoặc `1-A 2-B 3-C`).
  - **Tự động trích xuất ảnh minh họa từ PDF:** Quét tọa độ câu hỏi và cắt vùng đồ thị, hình vẽ tương ứng trong file PDF rồi tự động gắn vào câu hỏi thích hợp!
- **Hỗ trợ tệp văn bản thuần (`.txt`):** Chuẩn câu hỏi tự nhiên tiếng Việt hoặc chuẩn CBT quốc tế.

### 💻 3. Module Tin học & Mã nguồn (Informatics Engine)
- Tự động nhận diện cú pháp khối mã lệnh đặt trong dấu ba nháy ngược (```ngôn_ngữ ... ```).
- Hỗ trợ đầy đủ các ngôn ngữ lập trình phổ biến: `Python`, `C++`, `Pascal`, `C`, `Java`, `SQL`, `HTML/CSS`.
- Tích hợp thanh tiêu đề hiển thị tên ngôn ngữ cùng nút sao chép mã nguồn nhanh (`📋 Chép mã` $\rightarrow$ `✓ Đã chép!`).

### 🗺️ 4. Bản đồ Câu hỏi Tương tác (Azota-Inspired Question Palette)
- Hiển thị lưới số câu hỏi thời gian thực với thanh chuyển tab bộ lọc phân đoạn (Segmented Control):
  - 🔘 **Tất cả (All)**
  - 🔵 **Đã làm (Answered)**
  - 🚩 **Cần xem lại (Flagged)**
  - ⚪ **Chưa làm (Unanswered)**
- Đổi màu tức thì theo trạng thái câu hỏi: 🟢 *Đúng*, 🔴 *Sai* (trong chế độ Luyện tập), 🔵 *Đã chọn* (trong chế độ Thi), 🟡 *Đã đánh dấu 🚩*.
- Nhấp vào ô bất kỳ để cuộn mượt đến câu hỏi tương ứng và tạo hiệu ứng hào quang phát sáng (Pulse Glow).

### 🎯 5. Chế độ Thi & Luyện tập Linh hoạt
- **Chế độ Luyện tập (Practice Mode):** Kiểm tra đáp án ngay khi chọn, phát âm thanh vui nhộn (Web Audio Synthesizer: `ding` khi đúng, `buzz` khi sai), mở ngay lời giải chi tiết.
- **Chế độ Thi thử (Exam Mode):** Mô phỏng phòng thi chuẩn hóa với đồng hồ đếm ngược, ẩn toàn bộ đáp án cho đến khi bấm nộp bài.

### 🎨 6. Bốn Bộ giao diện Động (Dynamic Animated Themes)
1. 🏛️ **Academic Pro:** Không gian học thuật trang nhã, phông chữ *Inter* sắc nét, màu nhấn chàm Indigo (`#4f46e5`), lưới đồ thị chìm trôi nhẹ.
2. 🌌 **Minimalist Aurora:** Dải lụa cực quang chuyển màu mềm mại kết hợp hiệu ứng kính mờ thời thượng (Frosted Glassmorphism).
3. ⚡ **Cyberpunk Matrix:** Lưới ma trận không gian tối, đường quét radar phát sáng cùng hiệu ứng neon công nghệ cao.
4. 🍬 **Playful Bubble:** Bong bóng pastel trôi bềnh bồng, màu sắc kẹo ngọt tươi sáng giúp xua tan áp lực thi cử.

### 📊 7. Báo cáo Điểm số & Xuất File PDF Câu sai
- Hiệu ứng pháo hoa rực rỡ (Canvas Confetti) khi đạt kết quả xuất sắc ($\ge 75\%$).
- Bảng tổng kết kết quả thi chi tiết: số câu đúng, số câu sai, điểm quy đổi hệ 10 và tỷ lệ phần trăm chính xác.
- **Xuất PDF phiếu sửa sai:** Nhấp 1 nút để kết xuất toàn bộ những câu làm sai kèm đáp án đúng và lời giải chi tiết thành file PDF lưu về máy qua `html2pdf.js`.

### 🔀 8. Thuật toán Đảo đề Fisher-Yates Đồng bộ Tuyệt đối
- Đảo ngẫu nhiên thứ tự câu hỏi và thứ tự các đáp án A-B-C-D chỉ bằng một nút bấm.
- Cơ chế ghép cặp câu hỏi và ảnh đính kèm đồng bộ, đảm bảo hình vẽ sơ đồ luôn gắn chặt với đúng nội dung câu hỏi sau khi đảo.

---

## 📂 Cấu trúc Thư mục Dự án

```text
OmniQuiz/
├── assets/
│   └── logo.png                          # Logo thương hiệu Pro (3D Origami Cyber Owl)
├── css/
│   ├── main.css                          # Thiết lập căn bản, biến toàn cục & chống vỡ font
│   ├── themes.css                        # Định nghĩa 4 themes động & nền hoạt họa
│   ├── components.css                    # Toàn bộ CSS component (Navbar, Studio, Card, Palette, Modal)
│   └── animations.css                    # Khung chuyển động keyframes (scanlines, aurora, pulse)
├── js/
│   ├── app.js                            # Điều phối ứng dụng, xử lý kéo thả file & phím tắt
│   ├── audio.js                          # Bộ phát âm thanh Web Audio API & file wav
│   ├── confetti.js                       # Hiệu ứng hạt pháo hoa ăn mừng điểm cao
│   ├── i18n.js                           # Từ điển đa ngôn ngữ (Tiếng Việt & English)
│   ├── parser.js                         # Bộ phân tích đề thi đa năng (.txt, .docx, .pdf, LaTeX, Code)
│   ├── quiz-engine.js                    # Động cơ quản lý câu hỏi, tính điểm, đảo đề & xuất PDF
│   ├── storage.js                        # Quản lý lưu tiến độ tự động vào LocalStorage
│   └── ui.js                             # Render giao diện, cập nhật DOM & điều khiển Modal
├── question_banks/                       # Ngân hàng đề thi mẫu chuẩn hóa các môn
│   ├── HUONG_DAN_SOAN_DE.txt             # Tài liệu hướng dẫn giáo viên soạn đề chi tiết
│   ├── 01_khao_sat_ham_so.txt            # Toán: Khảo sát hàm số & đồ thị
│   ├── 02_mu_va_logarit.txt              # Toán: Hàm số lũy thừa, mũ & logarit
│   ├── 03_nguyen_ham_tich_phan.txt       # Toán: Nguyên hàm & tích phân
│   ├── 04_hinh_hoc_oxyz.txt              # Toán: Tọa độ không gian Oxyz
│   ├── 05_de_thi_thpt_tong_hop.txt       # Toán: Đề thi thử tốt nghiệp THPT chuẩn cấu trúc
│   ├── 06_sat_math_cbt_english.txt       # Digital SAT: Đề thi Toán quốc tế bằng tiếng Anh
│   ├── 07_de_test_nhanh_5_cau.txt        # Đề kiểm tra nhanh 5 câu trải nghiệm
│   ├── 08_vat_ly_12_dao_dong_co.txt      # Vật lý 12: Dao động điều hòa & sóng cơ
│   ├── 09_hoa_hoc_12_este_lipit.txt      # Hóa học 12: Este, Lipit & Cacbohidrat
│   ├── 10_tieng_anh_thpt_reading_grammar.txt # Tiếng Anh: Ngữ pháp & Đọc hiểu
│   ├── 11_lich_su_dia_ly_tong_hop.txt    # Khoa học Xã hội: Lịch sử & Địa lý Việt Nam
│   ├── 12_hoa_hoc_40_cau_pdf_trac_nghiem.txt # Hóa học: Bộ 40 câu trắc nghiệm chuẩn PDF
│   ├── 13_tin_hoc_lap_trinh_co_ban.txt   # Tin học: Lập trình cơ bản, Python, C++, thuật toán
│   └── questions.txt                     # Bộ đề Toán tổng hợp 50 câu ban đầu
├── data/
│   ├── questions.txt                     # Dữ liệu mẫu chuẩn CBT
│   ├── de_thi_toan_mau.txt               # Đề thi mẫu trường phổ thông
│   └── sample_math_exam.docx             # File Word mẫu có chứa công thức & bảng biểu
├── Dockerfile                            # Cấu hình đóng gói container Nginx Alpine siêu nhẹ
├── docker-compose.yml                    # Tệp khởi chạy dịch vụ Docker nhanh
├── nginx.conf                            # Cấu hình máy chủ web Nginx tối ưu hóa bộ nhớ đệm
├── manifest.json                         # Cấu hình PWA (Progressive Web App) cài đặt lên máy
├── index.html                            # Trang giao diện chính của ứng dụng
├── ding.wav                              # Âm thanh khi trả lời đúng
├── buzz.wav                              # Âm thanh khi trả lời sai
├── LICENSE                               # Giấy phép nguồn mở MIT
└── README.md                             # Tài liệu dự án chuyên sâu
```

---

## 📝 Định dạng Đề thi Hỗ trợ (Exam Formats)

OmniQuiz sở hữu bộ phân giải cú pháp đa năng, tự động nhận biết cấu trúc đề:

### Định dạng 1: Đề thi Tự nhiên Phổ thông (Khuyên dùng cho Giáo viên)
```text
Câu 1: Cho hàm số y = f(x) có đạo hàm f'(x) = x(x - 1)^2. Số điểm cực trị của hàm số là:
A. 0
B. 1
C. 2
D. 3
Đáp án: B
Lời giải: Đạo hàm f'(x) đổi dấu khi đi qua x = 0 và không đổi dấu khi qua x = 1 (nghiệm bội chẵn). Do đó hàm số có 1 điểm cực trị.
```
*(Hỗ trợ đáp án nằm trên 1 dòng ngang: `A. 1   B. 2   C. 3   D. 4` hoặc `A) 1  B) 2... hoặc [A] 1  [B] 2...`)*

### Định dạng 2: Đề thi có Bảng đáp án ở cuối trang (Đề thi Word / PDF)
```text
Câu 1: Chất nào sau đây thuộc loại đisaccarit?
A. Glucozơ
B. Fructozơ
C. Saccarozơ
D. Tinh bột

Câu 2: Kim loại nào sau đây dẫn điện tốt nhất?
A. Đồng
B. Nhôm
C. Vàng
D. Bạc

... (Các câu hỏi tiếp theo) ...

BẢNG ĐÁP ÁN:
1.C   2.D   3.A   4.B   5.C
```

### Định dạng 3: Đề thi Tin học chứa Khối mã lệnh (Code Blocks)
```text
Câu 1: Cho đoạn chương trình Python sau. Kết quả in ra màn hình là gì?
```python
def tinh_tong(n):
    s = 0
    for i in range(1, n + 1):
        if i % 2 == 0:
            s += i
    return s

print(tinh_tong(6))
```
A. 6
B. 12
C. 10
D. 18
Đáp án: B
Lời giải: Các số chẵn từ 1 đến 6 là 2, 4, 6. Tổng của chúng là 2 + 4 + 6 = 12.
```

### Định dạng 4: Chuẩn CBT Quốc tế (Standard CBT Format)
```text
Q: Find the limit $ \lim_{x \to 0} \frac{\sin(2x)}{x} $.
T: single
O: 0
O: 1
O: 2
O: Does not exist
A: 2
E: By applying L'Hôpital's Rule or using standard trigonometric limits, the result is 2.
```

---

## 🐳 Hướng dẫn Triển khai với Docker (Docker Deployment)

OmniQuiz được đóng gói dưới dạng container Nginx Alpine với kích thước cực nhỏ (**< 25MB**) và tiêu thụ RAM cực thấp (**< 10MB**):

### Cách 1: Sử dụng Docker Compose (Khuyên dùng)
Chạy lệnh duy nhất trong thư mục dự án:
```bash
docker compose up -d
```
Truy cập ngay ứng dụng tại: **`http://localhost:8080`**

Để dừng dịch vụ:
```bash
docker compose down
```

### Cách 2: Sử dụng Dockerfile thuần
```bash
# 1. Xây dựng Docker Image
docker build -t omniquiz:latest .

# 2. Khởi chạy Container
docker run -d -p 8080:80 --name omniquiz_web omniquiz:latest
```

---

## 🚀 Hướng dẫn Cài đặt & Chạy Trực tiếp (Local Setup)

### Cách 1: Mở trực tiếp (Không cần cài đặt bất cứ thứ gì)
- Nhấp đúp chuột vào file `index.html` để mở ngay trên trình duyệt (Chrome, Edge, Brave, Safari, Firefox).
- Kéo thả bất kỳ file nào trong thư mục `question_banks/` vào trang web để bắt đầu thi!

### Cách 2: Khởi chạy máy chủ HTTP nội bộ
```bash
# Sử dụng Python 3 có sẵn
python -m http.server 8080

# Hoặc sử dụng Node.js npx
npx serve .
```
Mở trình duyệt và truy cập: `http://localhost:8080`

---

## 🚢 Xuất bản lên GitHub Pages (Zero-Cost Hosting)

OmniQuiz đã được tích hợp sẵn GitHub Actions Workflow tại `.github/workflows/deploy.yml`:

1. Đẩy mã nguồn lên kho lưu trữ GitHub của bạn:
   ```bash
   git add .
   git commit -m "feat: Upgrade OmniQuiz Pro with new UI, Logo, and Docker support"
   git push origin main
   ```

2. Kích hoạt GitHub Pages:
   - Truy cập kho lưu trữ trên GitHub $\rightarrow$ **Settings** $\rightarrow$ **Pages**.
   - Tại mục **Build and deployment** $\rightarrow$ **Source**, chọn **GitHub Actions**.
   - Sau 1 phút, trang web sẽ được triển khai trực tuyến tại:  
     **`https://harilowji.github.io/OmniQuiz/`**

---

## 🛠️ Công nghệ Sử dụng (Tech Stack)

| Hạng mục | Công nghệ / Thư viện | Vai trò |
|---|---|---|
| **Core** | HTML5, CSS3 Variables, ES6+ Vanilla JS | Tốc độ tức thì, không phát sinh bundle node_modules cồng kềnh |
| **Công thức** | [MathJax 3.2](https://www.mathjax.org/) + `mhchem` | Hiển thị công thức Toán học, Vật lý & Hóa học chuẩn quốc tế |
| **Xử lý Word** | [Mammoth.js](https://github.com/mwilliamson/mammoth.js) | Chuyển đổi tệp `.docx` và bóc tách ảnh minh họa client-side |
| **Xử lý PDF** | [PDF.js (Mozilla)](https://mozilla.github.io/pdf.js/) | Phân tích text, quét ma trận đáp án và trích xuất ảnh từ tệp `.pdf` |
| **Báo cáo** | [html2pdf.js](https://github.com/eKoopmans/html2pdf.js) | Kết xuất bảng câu sai và phân tích chi tiết thành file PDF |
| **Âm thanh** | Web Audio API + HTML5 Audio | Tạo hiệu ứng âm thanh sống động khi làm bài |
| **Hoạt họa** | Canvas Confetti Engine | Hiệu ứng pháo hoa chúc mừng khi đạt điểm cao |
| **DevOps** | Docker, Nginx Alpine, GitHub Actions | Đóng gói container siêu nhẹ và CI/CD tự động |

---

## 📜 Giấy phép (License) & Tác giả

Dự án được phân phối dưới giấy phép mã nguồn mở **[MIT License](LICENSE)**. Mọi cá nhân, giáo viên và tổ chức giáo dục đều có thể tự do sử dụng, chỉnh sửa và triển khai phục vụ cộng đồng học tập.

*Thiết kế và phát triển bởi [Harilowji](https://github.com/Harilowji) với sự đồng hành của Google DeepMind Antigravity Pair-Programming Assistant.*
