/**
 * src/features/mascot/anime-mascot.ts - Interactive Anime Companion / AI Sensei Widget
 * Delivers dynamic contextual speech bubbles, combo cheers, exam proctor alerts,
 * and AI Sensei guidance for the "Azota Anime Edition" experience.
 */

export type MascotMood = 'happy' | 'excited' | 'thinking' | 'serious' | 'proud';

export class AnimeMascot {
  private containerEl: HTMLElement | null = null;
  private bubbleEl: HTMLElement | null = null;
  private avatarEl: HTMLElement | null = null;
  private currentMood: MascotMood = 'happy';
  private bubbleTimeout: ReturnType<typeof setTimeout> | null = null;
  private currentCombo: number = 0;

  public init(): void {
    if (typeof document === 'undefined') return;

    let widget = document.getElementById('anime-mascot-widget');
    if (!widget) {
      widget = document.createElement('div');
      widget.id = 'anime-mascot-widget';
      widget.className = 'anime-mascot-widget';
      widget.setAttribute('aria-label', 'Trợ lý đồng hành Anime Sensei');
      widget.innerHTML = `
        <div class="mascot-speech-bubble" id="mascot-speech-bubble" style="display: none;">
          <span class="mascot-bubble-text" id="mascot-bubble-text">Chào mừng Senpai đến với OmniQuiz!</span>
          <div class="mascot-bubble-tail"></div>
        </div>
        <div class="mascot-avatar-btn" id="mascot-avatar-btn" title="Bấm để trò chuyện cùng Sensei">
          <div class="mascot-sparkle-ring"></div>
          <span class="mascot-emoji" id="mascot-emoji">🌸</span>
        </div>
      `;
      document.body.appendChild(widget);
    }

    this.containerEl = widget;
    this.bubbleEl = document.getElementById('mascot-speech-bubble');
    this.avatarEl = document.getElementById('mascot-avatar-btn');

    this.avatarEl?.addEventListener('click', () => {
      this.onMascotClick();
    });

    // Initial greeting after 1.5 seconds
    setTimeout(() => {
      this.speak('Chào Senpai! Hôm nay chúng ta cùng chinh phục bao nhiêu câu nào? ✨', 5000, 'happy');
    }, 1500);
  }

  /**
   * Displays speech bubble with custom message, auto-dismiss duration, and emotion
   */
  public speak(message: string, durationMs = 4500, mood: MascotMood = 'happy'): void {
    if (!this.bubbleEl) return;

    this.setMood(mood);
    const textEl = document.getElementById('mascot-bubble-text');
    if (textEl) {
      textEl.textContent = message;
    }

    if (this.bubbleTimeout) {
      clearTimeout(this.bubbleTimeout);
    }

    this.bubbleEl.style.display = 'block';
    this.bubbleEl.classList.remove('bubble-pop-anim');
    void this.bubbleEl.offsetWidth; // force CSS reflow
    this.bubbleEl.classList.add('bubble-pop-anim');

    this.bubbleTimeout = setTimeout(() => {
      if (this.bubbleEl) {
        this.bubbleEl.style.display = 'none';
      }
    }, durationMs);
  }

  public getMood(): MascotMood {
    return this.currentMood;
  }

  /**
   * Updates mascot mood and icon
   */
  public setMood(mood: MascotMood): void {
    this.currentMood = mood;
    const emojiEl = document.getElementById('mascot-emoji');
    if (!emojiEl) return;

    switch (mood) {
      case 'excited':
        emojiEl.textContent = '🌟';
        this.containerEl?.classList.add('mascot-glowing');
        break;
      case 'serious':
        emojiEl.textContent = '🧐';
        this.containerEl?.classList.remove('mascot-glowing');
        break;
      case 'thinking':
        emojiEl.textContent = '💡';
        this.containerEl?.classList.remove('mascot-glowing');
        break;
      case 'proud':
        emojiEl.textContent = '👑';
        this.containerEl?.classList.add('mascot-glowing');
        break;
      case 'happy':
      default:
        emojiEl.textContent = '🌸';
        this.containerEl?.classList.remove('mascot-glowing');
        break;
    }
  }

  /**
   * Triggered on user answering correctly
   */
  public onCorrectAnswer(): void {
    this.currentCombo++;
    if (this.currentCombo === 3) {
      this.speak('🔥 Combo x3! Quá mượt mà Senpai ơi!', 4000, 'excited');
    } else if (this.currentCombo === 5) {
      this.speak('⚡ Combo x5! Tốc độ bàn thờ luôn, giữ vững nhé!', 4500, 'excited');
    } else if (this.currentCombo === 10) {
      this.speak('👑 COMBO x10! Thiên tài học viện Anime xuất hiện!', 6000, 'proud');
    } else if (this.currentCombo > 0 && this.currentCombo % 5 === 0) {
      this.speak(`🌟 Siêu chuỗi ${this.currentCombo} câu liên tiếp! Quá đỉnh!`, 4000, 'proud');
    }
  }

  /**
   * Triggered on user answering incorrectly in Practice mode
   */
  public onWrongAnswer(): void {
    this.currentCombo = 0;
    const cheers = [
      'Đừng nản nhé Senpai! Sai một câu là hiểu thêm một phần! 💡',
      'Sensei ở đây! Bấm "Hỏi Sensei AI" để xem hướng dẫn giải chi tiết nhé!',
      'Ghi chú lại câu này để ôn bằng thẻ 3D Flashcard nhé Senpai!',
    ];
    const picked = cheers[Math.floor(Math.random() * cheers.length)]!;
    this.speak(picked, 4500, 'thinking');
  }

  /**
   * Official Exam Proctor Alerts
   */
  public onExamModeStart(): void {
    this.currentCombo = 0;
    this.speak('Giám thị Sensei: "Bài thi chính thức bắt đầu! Tập trung làm bài, nghiêm cấm chuyển tab nhé!" 🧐', 6000, 'serious');
  }

  public onTabSwitchWarning(count: number): void {
    this.speak(`⚠️ Giám thị Sensei: Phát hiện bạn vừa rời màn hình thi lần thứ ${count}! Vui lòng quay lại ngay!`, 5500, 'serious');
  }

  public onTimeRunningLow(): void {
    this.speak('⏰ Chỉ còn 5 phút cuối! Mau rà soát lại phiếu đáp án nào Senpai!', 6000, 'serious');
  }

  private onMascotClick(): void {
    const lines = [
      'Hôm nay Senpai học rất chăm chỉ, Sensei rất tự hào! 🌸',
      'Mẹo nhỏ: Luôn đọc kỹ từ khóa "ĐÚNG" hay "KHÔNG ĐÚNG" trong đề thi nhé!',
      'Cần giải thích câu khó? Cứ bấm "Hỏi Sensei AI" bên cạnh nhé!',
      'Cố gắng duy trì streak học mỗi ngày để nhận huy hiệu S-Rank nào! 🏆',
    ];
    const line = lines[Math.floor(Math.random() * lines.length)]!;
    this.speak(line, 4500, 'happy');
  }
}

export const animeMascot = new AnimeMascot();
