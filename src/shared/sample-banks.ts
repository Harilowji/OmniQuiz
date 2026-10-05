/**
 * src/shared/sample-banks.ts - Built-in Multi-Subject Sample Question Banks
 * Zero-Regression: Fully typed and pre-parsed for instant offline access.
 */

import type { Exam } from './types';
import { tokenizeExamDocument } from '../../workers/parser.worker';

// Raw string definitions matching original sample-banks.js
const RAW_BANKS: Record<string, { title: string; subject: string; raw: string }> = {
  informatics_10: {
    title: 'ĐỀ THI ÔN TẬP TIN HỌC & LẬP TRÌNH CƠ BẢN',
    subject: 'Tin học',
    raw: `ĐỀ THI ÔN TẬP TIN HỌC & LẬP TRÌNH CƠ BẢN
(Hệ thống câu hỏi trắc nghiệm Tin học THPT & Nhập môn Khoa học Máy tính)

Câu 1: Cho đoạn mã ngôn ngữ C sau đây:
\`\`\`c
int a = 10, b = 20;
int *p = &a;
*p = *p + b;
printf("%d", a);
\`\`\`
Kết quả in ra màn hình là gì?
A. 10
B. 20
C. 30
D. 0
Đáp án: C
Lời giải: Con trỏ \`p\` trỏ tới địa chỉ của biến \`a\`. Khi thực hiện \`*p = *p + b\`, giá trị tại ô nhớ của \`a\` được cập nhật thành \`10 + 20 = 30\`. Do đó \`printf("%d", a)\` in ra giá trị 30.

Câu 2: Trong ngôn ngữ Python, kết quả của biểu thức sau là gì?
\`\`\`python
numbers = [10, 20, 30, 40, 50, 60]
print(numbers[1:4])
\`\`\`
A. [10, 20, 30]
B. [20, 30, 40]
C. [20, 30, 40, 50]
D. [10, 20, 30, 40]
Đáp án: B
Lời giải: Cú pháp slice \`numbers[start:stop]\` lấy các phần tử từ chỉ số \`start\` đến \`stop - 1\`. Chỉ số 1 là 20, 2 là 30, 3 là 40. Kết quả là \`[20, 30, 40]\`.

Câu 3: Cấu trúc dữ liệu nào hoạt động theo nguyên lý LIFO (Last In, First Out - Vào sau, ra trước)?
A. Hàng đợi (Queue)
B. Ngăn xếp (Stack)
C. Danh sách liên kết đơn (Singly Linked List)
D. Mảng một chiều (Array)
Đáp án: B
Lời giải: Ngăn xếp (Stack) là cấu trúc dữ liệu tuân theo cơ chế LIFO, phần tử được đưa vào cuối cùng sẽ là phần tử được lấy ra đầu tiên.

Câu 4: Trong hệ quản trị cơ sở dữ liệu quan hệ (RDBMS) và ngôn ngữ SQL, mệnh đề nào được sử dụng để lọc điều kiện sau khi đã nhóm dữ liệu bằng \`GROUP BY\`?
A. WHERE
B. HAVING
C. ORDER BY
D. DISTINCT
Đáp án: B
Lời giải: Mệnh đề \`WHERE\` lọc từng dòng trước khi nhóm, còn \`HAVING\` dùng để lọc các nhóm sau khi thực hiện \`GROUP BY\`.

Câu 5: Trong mô hình mạng OSI và TCP/IP, giao thức nào ở tầng Giao vận (Transport Layer) cung cấp dịch vụ truyền dữ liệu tin cậy, có cơ chế bắt tay 3 bước (3-way handshake)?
A. UDP
B. IP
C. TCP
D. ICMP
Đáp án: C
Lời giải: TCP (Transmission Control Protocol) là giao thức hướng kết nối, đảm bảo dữ liệu được truyền đến đích đầy đủ và đúng thứ tự.

Câu 6: Cho hàm đệ quy viết bằng Python như sau:
\`\`\`python
def f(n):
    if n <= 1:
        return 1
    return n * f(n - 1)

print(f(4))
\`\`\`
Kết quả hiển thị trên màn hình là:
A. 10
B. 16
C. 24
D. 12
Đáp án: C
Lời giải: Hàm tính $n!$. Với $n = 4$: $4 \\times 3 \\times 2 \\times 1 = 24$.

Câu 7: Hình thức tấn công mạng nào khiến máy chủ bị quá tải bằng cách gửi một lượng khổng lồ lưu lượng truy cập từ nhiều máy tính ma (botnet)?
A. Phishing
B. DDoS (Tấn công từ chối dịch vụ phân tán)
C. SQL Injection
D. Man-in-the-middle
Đáp án: B
Lời giải: DDoS là hình thức làm tê liệt dịch vụ mục tiêu bằng cách điều khiển mạng lưới botnet đồng loạt gửi lưu lượng rác.

Câu 8: Trong hệ điều hành, hiện tượng hai hay nhiều tiến trình cùng bị treo vô thời hạn do mỗi tiến trình đều chờ đợi tài nguyên mà tiến trình khác đang nắm giữ được gọi là:
A. Starvation
B. Thrashing
C. Deadlock (Bế tắc)
D. Race Condition
Đáp án: C
Lời giải: Deadlock là tình trạng tập hợp các tiến trình bị chặn hoàn toàn vì chờ tài nguyên chéo nhau.

Câu 9: Thuật toán tìm kiếm nhị phân (Binary Search) trên mảng đã sắp xếp có độ phức tạp thời gian trong trường hợp xấu nhất là:
A. $O(N)$
B. $O(N^2)$
C. $O(\\log N)$
D. $O(1)$
Đáp án: C
Lời giải: Không gian tìm kiếm giảm một nửa sau mỗi bước, độ phức tạp là $O(\\log N)$.

Câu 10: Trong ngôn ngữ lập trình, chỉ số của phần tử đầu tiên trong mảng (0-indexed array) thường bắt đầu từ:
A. 1
B. 0
C. -1
D. Bất kỳ giá trị nào tùy ý
Đáp án: B
Lời giải: Hầu hết các ngôn ngữ lập trình hiện đại đều áp dụng cơ chế đánh chỉ số từ 0.
`,
  },

  sat_math: {
    title: 'Digital SAT Math Practice Exam',
    subject: 'Toán học',
    raw: `[TITLE]: Digital SAT Math Practice Exam
[DESCRIPTION]: 10 official style Digital SAT Math questions covering Algebra, Advanced Math, Problem Solving, and Geometry.
[TIME]: 15 minutes

Câu 1: If $3x + 7 = 22$, what is the value of $6x - 5$?
A. 25
B. 30
C. 15
D. 20
Đáp án: A
Lời giải: First, solve for $x$: $3x = 22 - 7 = 15 \\Rightarrow x = 5$. Then $6(5) - 5 = 30 - 5 = 25$.

Câu 2: A line in the $xy$-plane passes through the points $(2, 5)$ and $(4, 11)$. What is the slope of this line?
A. 3
B. 2
C. 6
D. $\\frac{1}{3}$
Đáp án: A
Lời giải: The slope $m = \\frac{11 - 5}{4 - 2} = \\frac{6}{2} = 3$.

Câu 3: Which of the following is equivalent to $(2x^2 - 3x + 4) - (x^2 + 2x - 5)$?
A. $x^2 - 5x + 9$
B. $x^2 - x - 1$
C. $3x^2 - x - 1$
D. $x^2 - 5x - 1$
Đáp án: A
Lời giải: $(2x^2 - x^2) + (-3x - 2x) + (4 + 5) = x^2 - 5x + 9$.

Câu 4: The function $f$ is defined by $f(x) = 2x^2 - 8x + 11$. What is the minimum value of $f(x)$?
A. 3
B. 2
C. 11
D. -3
Đáp án: A
Lời giải: Vertex at $x = -(-8)/(2 \\times 2) = 2$. $f(2) = 2(4) - 16 + 11 = 3$.

Câu 5: If $4^{x+1} = 64$, what is the value of $x$?
A. 2
B. 3
C. 4
D. 1
Đáp án: A
Lời giải: $64 = 4^3 \\Rightarrow x + 1 = 3 \\Rightarrow x = 2$.
`,
  },

  chem_40: {
    title: '40 CÂU TRẮC NGHIỆM HÓA HỌC HỮU CƠ',
    subject: 'Hóa học',
    raw: `II. 40 CÂU TRẮC NGHIỆM (CÓ ĐÁP ÁN)
Câu 1: Carbon có bao nhiêu trạng thái lai hóa?
A. 2
B. 3
C. 4
D. 5
Đáp án: B

Câu 2: Lai hóa sp³ tạo ra bao nhiêu obitan lai hóa?
A. 2
B. 3
C. 4
D. 5
Đáp án: C

Câu 3: Góc liên kết đặc trưng của C-sp² là:
A. 109°28’
B. 120°
C. 180°
D. 90°
Đáp án: B

Câu 4: Liên kết π được tạo thành do:
A. Xen phủ trục
B. Xen phủ bên
C. Xen phủ s–s
D. Xen phủ s–p
Đáp án: B

Câu 5: Liên kết đôi gồm:
A. 2 σ
B. 2 π
C. 1 σ + 1 π
D. 1 σ + 2 π
Đáp án: C
`,
  },
};

/**
 * Return collection of ready-to-use Exam objects
 */
export function getPreloadedSampleExams(): Exam[] {
  const exams: Exam[] = [];

  for (const [key, item] of Object.entries(RAW_BANKS)) {
    const parsed = tokenizeExamDocument(item.raw, item.title, item.subject);
    const now = new Date().toISOString();
    exams.push({
      id: `sample_${key}`,
      title: parsed.examTitle,
      description: parsed.description,
      subject: item.subject,
      durationMinutes: parsed.durationMinutes,
      totalQuestions: parsed.questions.length,
      createdAt: now,
      updatedAt: now,
      questions: parsed.questions,
    });
  }

  return exams;
}
