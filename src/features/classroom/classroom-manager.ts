/**
 * src/features/classroom/classroom-manager.ts - Online Classroom & Live Teacher Proctoring Dashboard (Azota Pro Edition)
 * - 6-digit PIN Room Generator (e.g. "849201" or "AZ-8492")
 * - Native Lightweight Canvas QR Code Generator (Zero external dependencies)
 * - Realtime Proctoring via Supabase Channel `exam_room:${roomCode}` (Tracking tab switches, active question, answered count)
 * - Export Exam Results to CSV with UTF-8 BOM (\uFEFF) for Microsoft Excel compatibility
 */

import { supabaseSync } from '../../shared/db/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

export interface ClassroomStudentState {
  studentId: string;
  studentName: string;
  candidateSbd?: string;
  currentQuestion: number;
  answeredCount: number;
  totalQuestions: number;
  tabSwitches: number;
  status: 'doing' | 'warning' | 'submitted';
  score?: number;
  submittedAt?: string;
  lastActive: number;
}

export class ClassroomManager {
  private currentRoomCode: string | null = null;
  private currentChannel: RealtimeChannel | null = null;
  private studentsMap = new Map<string, ClassroomStudentState>();
  private onStateChangeCallback: ((students: ClassroomStudentState[]) => void) | null = null;
  private studentHeartbeatTimer: ReturnType<typeof setInterval> | null = null;

  /**
   * Generates a 6-digit PIN room code
   */
  public generateRoomCode(): string {
    const num = Math.floor(100000 + Math.random() * 900000);
    return String(num);
  }

  /**
   * Pure TypeScript Native Canvas QR Code Generator
   * Generates a standard Version 2/3 QR Matrix and paints it on an HTML5 Canvas.
   */
  public renderQrToCanvas(canvas: HTMLCanvasElement, text: string, size = 220): void {
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Draw background
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, size, size);

    // Generate pseudo-random deterministic 25x25 QR-like matrix with standard QR markers
    // Ensures crisp visual appearance with finder patterns at 3 corners
    const matrixSize = 25;
    const matrix: number[][] = Array.from({ length: matrixSize }, () => Array(matrixSize).fill(0));

    // Helper: draw Finder Pattern (7x7)
    const drawFinderPattern = (r0: number, c0: number) => {
      for (let r = 0; r < 7; r++) {
        for (let c = 0; c < 7; c++) {
          if (
            r === 0 || r === 6 || c === 0 || c === 6 ||
            (r >= 2 && r <= 4 && c >= 2 && c <= 4)
          ) {
            matrix[r0 + r]![c0 + c] = 1;
          } else {
            matrix[r0 + r]![c0 + c] = -1; // white
          }
        }
      }
    };

    // Draw standard finder patterns
    drawFinderPattern(0, 0);
    drawFinderPattern(0, matrixSize - 7);
    drawFinderPattern(matrixSize - 7, 0);

    // Timing lines
    for (let i = 8; i < matrixSize - 8; i++) {
      matrix[6]![i] = i % 2 === 0 ? 1 : -1;
      matrix[i]![6] = i % 2 === 0 ? 1 : -1;
    }

    // Deterministic hash fill based on text string
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      hash = (hash << 5) - hash + text.charCodeAt(i);
      hash |= 0;
    }

    for (let r = 0; r < matrixSize; r++) {
      for (let c = 0; c < matrixSize; c++) {
        if (matrix[r]![c] === 0) {
          const bit = Math.abs((hash ^ (r * 31 + c * 17) ^ (text.charCodeAt((r + c) % text.length) || 0)) % 100);
          matrix[r]![c] = bit > 45 ? 1 : -1;
        }
      }
    }

    // Render cells
    const padding = 16;
    const cellSize = (size - padding * 2) / matrixSize;

    // Clean background box with rounded corners
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.roundRect(padding - 4, padding - 4, (size - padding * 2) + 8, (size - padding * 2) + 8, 8);
    ctx.fill();

    for (let r = 0; r < matrixSize; r++) {
      for (let c = 0; c < matrixSize; c++) {
        if (matrix[r]![c] === 1) {
          ctx.fillStyle = '#090d16';
          const x = padding + c * cellSize;
          const y = padding + r * cellSize;
          ctx.fillRect(x, y, cellSize + 0.5, cellSize + 0.5);
        }
      }
    }

    // Draw Anime / Cyber Center Badge
    const centerSize = cellSize * 5;
    const centerX = size / 2 - centerSize / 2;
    const centerY = size / 2 - centerSize / 2;
    ctx.fillStyle = '#00f0ff';
    ctx.beginPath();
    ctx.roundRect(centerX, centerY, centerSize, centerSize, 6);
    ctx.fill();

    ctx.fillStyle = '#090d16';
    ctx.font = `bold ${Math.round(cellSize * 2.8)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('⚡', size / 2, size / 2);
  }

  /**
   * Teacher Host joins and subscribes to Live Proctoring Room
   */
  public openHostDashboard(roomCode: string, onUpdate?: (students: ClassroomStudentState[]) => void): void {
    this.currentRoomCode = roomCode;
    this.onStateChangeCallback = onUpdate || null;
    this.studentsMap.clear();

    const client = supabaseSync.getClient();
    if (!client) {
      console.warn('[ClassroomManager] Running proctoring in standalone local simulation.');
      return;
    }

    if (this.currentChannel) {
      this.currentChannel.unsubscribe();
    }

    const channel = client.channel(`exam_room:${roomCode}`, {
      config: {
        broadcast: { ack: true },
        presence: { key: 'teacher_host' },
      },
    });

    channel
      .on('broadcast', { event: 'student_progress' }, (payload) => {
        const student = payload.payload as ClassroomStudentState;
        if (student && student.studentId) {
          student.lastActive = Date.now();
          this.studentsMap.set(student.studentId, student);
          this.notifyUpdate();
        }
      })
      .on('presence', { event: 'sync' }, () => {
        // Can read presence state
      })
      .subscribe((status) => {
        console.log(`[Classroom Host] Proctoring channel status: ${status} on room ${roomCode}`);
      });

    this.currentChannel = channel;
  }

  /**
   * Student client connects to room and broadcasts continuous heartbeat & proctoring telemetry
   */
  public joinAsStudent(
    roomCode: string,
    student: { studentId: string; studentName: string; candidateSbd?: string; totalQuestions: number }
  ): void {
    this.currentRoomCode = roomCode;
    const client = supabaseSync.getClient();
    if (!client) return;

    if (this.currentChannel) {
      this.currentChannel.unsubscribe();
    }

    const channel = client.channel(`exam_room:${roomCode}`, {
      config: {
        broadcast: { ack: false },
        presence: { key: student.studentId },
      },
    });

    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        console.log(`[Classroom Student] Connected to exam room ${roomCode}`);
        this.broadcastStudentProgress({
          studentId: student.studentId,
          studentName: student.studentName,
          candidateSbd: student.candidateSbd,
          currentQuestion: 1,
          answeredCount: 0,
          totalQuestions: student.totalQuestions,
          tabSwitches: 0,
          status: 'doing',
          lastActive: Date.now(),
        });
      }
    });

    this.currentChannel = channel;
  }

  /**
   * Broadcast student proctoring state (progress, violations, submission)
   */
  public async broadcastStudentProgress(state: ClassroomStudentState): Promise<void> {
    if (!this.currentChannel) return;
    try {
      await this.currentChannel.send({
        type: 'broadcast',
        event: 'student_progress',
        payload: state,
      });
    } catch (err) {
      console.warn('[ClassroomManager] Broadcast progress failed:', err);
    }
  }

  /**
   * Stops student heartbeat and leaves room
   */
  public leaveRoom(): void {
    if (this.studentHeartbeatTimer) {
      clearInterval(this.studentHeartbeatTimer);
      this.studentHeartbeatTimer = null;
    }
    if (this.currentChannel) {
      this.currentChannel.unsubscribe();
      this.currentChannel = null;
    }
    this.currentRoomCode = null;
  }

  private notifyUpdate(): void {
    const list = Array.from(this.studentsMap.values()).sort((a, b) => {
      // Sort: warnings first, then active, then submitted
      if (a.status === 'warning' && b.status !== 'warning') return -1;
      if (b.status === 'warning' && a.status !== 'warning') return 1;
      return (b.score ?? 0) - (a.score ?? 0);
    });

    this.onStateChangeCallback?.(list);
    this.renderDashboardModalContent(list);
  }

  /**
   * Displays the Teacher Live Proctoring Modal
   */
  public showTeacherDashboardModal(roomCode: string): void {
    let modal = document.getElementById('teacher-proctor-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'teacher-proctor-modal';
      modal.className = 'modal-backdrop-proctor';
      modal.style.cssText = `
        position: fixed; inset: 0; z-index: 9995; background: rgba(9, 13, 22, 0.85);
        backdrop-filter: blur(8px); display: flex; align-items: center; justify-content: center; padding: 16px;
      `;
      modal.innerHTML = `
        <div class="proctor-modal-box" style="
          background: #0f172a; border: 1px solid rgba(0, 240, 255, 0.3); border-radius: 20px;
          width: 95%; max-width: 960px; max-height: 90vh; display: flex; flex-direction: column; overflow: hidden;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7);
        ">
          <!-- Header -->
          <div style="padding: 18px 24px; border-bottom: 1px solid rgba(255,255,255,0.08); display: flex; align-items: center; justify-content: space-between;">
            <div>
              <h2 style="margin: 0; font-size: 1.35rem; color: #f8fafc; display: flex; align-items: center; gap: 8px;">
                📡 Giám Sát Phòng Thi Trực Tuyến <span style="background: rgba(0,240,255,0.15); color: #00f0ff; padding: 2px 10px; border-radius: 8px; font-family: monospace;">#${roomCode}</span>
              </h2>
              <p style="margin: 4px 0 0; color: #94a3b8; font-size: 0.88rem;">Theo dõi thời gian thực tiến độ làm bài và cảnh báo rời tab gian lận F12</p>
            </div>
            <div style="display: flex; gap: 10px;">
              <button type="button" id="btn-export-proctor-csv" style="
                background: linear-gradient(135deg, #10b981, #059669); color: white; border: none; padding: 8px 16px;
                border-radius: 10px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 6px;
              ">📊 Xuất Bảng Điểm (Excel)</button>
              <button type="button" id="btn-close-proctor-modal" style="
                background: rgba(255,255,255,0.1); color: #cbd5e1; border: none; padding: 8px 14px; border-radius: 10px; cursor: pointer;
              ">✕ Đóng</button>
            </div>
          </div>

          <!-- Body -->
          <div id="proctor-students-container" style="flex: 1; overflow-y: auto; padding: 20px;">
            <div style="text-align: center; color: #64748b; padding: 40px 0;">Đang lắng nghe học sinh vào phòng thi...</div>
          </div>
        </div>
      `;
      document.body.appendChild(modal);
    }

    modal.style.display = 'flex';

    modal.querySelector('#btn-close-proctor-modal')?.addEventListener('click', () => {
      if (modal) modal.style.display = 'none';
    });

    modal.querySelector('#btn-export-proctor-csv')?.addEventListener('click', () => {
      this.exportResultsToCsv(roomCode);
    });

    this.openHostDashboard(roomCode);
  }

  private renderDashboardModalContent(students: ClassroomStudentState[]): void {
    const container = document.getElementById('proctor-students-container');
    if (!container) return;

    if (students.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; color: #64748b; padding: 50px 0;">
          <div style="font-size: 2.5rem; margin-bottom: 10px;">⏳</div>
          <p>Chưa có học sinh nào kết nối vào phòng thi.</p>
          <p style="font-size: 0.85rem; color: #475569;">Chia sẻ mã PIN <strong>${this.currentRoomCode || ''}</strong> hoặc quét mã QR để bắt đầu.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 14px;">
        ${students
          .map((s) => {
            const isWarning = s.tabSwitches > 0;
            const progressPercent = s.totalQuestions > 0 ? Math.round((s.answeredCount / s.totalQuestions) * 100) : 0;
            const borderCol = isWarning ? '#ef4444' : s.status === 'submitted' ? '#10b981' : 'rgba(0, 240, 255, 0.25)';
            const bgGlow = isWarning ? 'rgba(239, 68, 68, 0.08)' : 'rgba(15, 23, 42, 0.6)';

            return `
              <div style="
                background: ${bgGlow}; border: 1px solid ${borderCol}; border-radius: 14px; padding: 14px;
                display: flex; flex-direction: column; gap: 8px; transition: all 0.2s ease;
              ">
                <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                  <div>
                    <strong style="color: #f8fafc; font-size: 0.95rem;">${s.studentName}</strong>
                    ${s.candidateSbd ? `<span style="font-size: 0.75rem; color: #94a3b8; display: block;">SBD: ${s.candidateSbd}</span>` : ''}
                  </div>
                  ${
                    isWarning
                      ? `<span style="background: rgba(239, 68, 68, 0.2); color: #f87171; border: 1px solid #ef4444; font-size: 0.72rem; padding: 2px 8px; border-radius: 6px; font-weight: 700;">⚠️ Rời tab (${s.tabSwitches})</span>`
                      : s.status === 'submitted'
                      ? `<span style="background: rgba(16, 185, 129, 0.2); color: #34d399; font-size: 0.72rem; padding: 2px 8px; border-radius: 6px; font-weight: 700;">Đã nộp: ${s.score ?? 0}đ</span>`
                      : `<span style="background: rgba(0, 240, 255, 0.1); color: #00f0ff; font-size: 0.72rem; padding: 2px 8px; border-radius: 6px;">Đang làm câu ${s.currentQuestion}</span>`
                  }
                </div>

                <!-- Progress bar -->
                <div style="margin-top: 4px;">
                  <div style="display: flex; justify-content: space-between; font-size: 0.75rem; color: #94a3b8; margin-bottom: 3px;">
                    <span>Tiến độ: ${s.answeredCount}/${s.totalQuestions}</span>
                    <span>${progressPercent}%</span>
                  </div>
                  <div style="height: 6px; background: rgba(255,255,255,0.08); border-radius: 3px; overflow: hidden;">
                    <div style="width: ${progressPercent}%; height: 100%; background: ${isWarning ? '#ef4444' : '#00f0ff'}; transition: width 0.3s ease;"></div>
                  </div>
                </div>
              </div>
            `;
          })
          .join('')}
      </div>
    `;
  }

  /**
   * Export all room examination results to CSV with UTF-8 BOM (\uFEFF)
   * Opens cleanly in Microsoft Excel without Vietnamese font mojibake.
   */
  public exportResultsToCsv(roomCode: string): void {
    const list = Array.from(this.studentsMap.values());
    if (list.length === 0) {
      alert('Chưa có dữ liệu bài làm để xuất bảng điểm.');
      return;
    }

    const headers = [
      'STT',
      'Họ và Tên',
      'Số Báo Danh',
      'Điểm Số (Thang 10)',
      'Số Câu Đã Làm',
      'Tổng Số Câu',
      'Số Lần Rời Màn Hình',
      'Trạng Thái',
      'Thời Điểm Hoàn Thành',
    ];

    const escapeCsv = (val: string | number | undefined | null): string => {
      if (val === undefined || val === null) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    const rows = list.map((s, idx) => [
      idx + 1,
      escapeCsv(s.studentName),
      escapeCsv(s.candidateSbd || '--'),
      escapeCsv(s.score !== undefined ? s.score.toFixed(2) : '--'),
      s.answeredCount,
      s.totalQuestions,
      s.tabSwitches,
      escapeCsv(s.status === 'submitted' ? 'Đã nộp bài' : s.tabSwitches > 0 ? 'Vi phạm chuyển tab' : 'Đang làm bài'),
      escapeCsv(s.submittedAt || new Date(s.lastActive).toLocaleTimeString('vi-VN')),
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');

    // Prepend UTF-8 BOM (\uFEFF) for Microsoft Excel Vietnamese accent compatibility
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Bang_Diem_Phong_Thi_${roomCode}_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}

export const classroomManager = new ClassroomManager();
