/**
 * src/features/gamification/guild-card.ts - Anime Student Guild Card & Gamification System
 * Governs Student Hunter Ranks (S/A/B/C/D), Levels, EXP progression, Daily Streak,
 * and Dojo (Practice) vs Arena (CBT) quick modes for the "Azota Anime Edition".
 */

export type GuildRankTier = 'S' | 'A' | 'B' | 'C' | 'D';

export interface GuildProfile {
  username: string;
  avatarEmoji: string;
  rankTier: GuildRankTier;
  level: number;
  exp: number;
  nextLevelExp: number;
  streakDays: number;
  lastActiveDate: string; // YYYY-MM-DD
  totalAnswered: number;
  totalCorrect: number;
  guildTitle: string;
}

const STORAGE_KEY = 'omniquiz_guild_profile';
const EXP_PER_LEVEL = 150;

export class GuildCardManager {
  private profile: GuildProfile;

  constructor() {
    this.profile = this.loadProfile();
  }

  public getProfile(): GuildProfile {
    return { ...this.profile };
  }

  private getDefaultProfile(): GuildProfile {
    return {
      username: 'Senpai',
      avatarEmoji: '🌸',
      rankTier: 'D',
      level: 1,
      exp: 0,
      nextLevelExp: EXP_PER_LEVEL,
      streakDays: 1,
      lastActiveDate: this.getTodayDateString(),
      totalAnswered: 0,
      totalCorrect: 0,
      guildTitle: '🌱 Học Viên Tập Sự',
    };
  }

  private getTodayDateString(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }

  private loadProfile(): GuildProfile {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as Partial<GuildProfile>;
          return {
            ...this.getDefaultProfile(),
            ...parsed,
          };
        }
      }
    } catch {
      // Fallback to default
    }
    return this.getDefaultProfile();
  }

  public saveProfile(): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(this.profile));
      }
    } catch {
      // Ignore storage errors
    }
  }

  public calculateRank(exp: number): { tier: GuildRankTier; title: string; color: string } {
    if (exp >= 5000) {
      return { tier: 'S', title: '👑 Thần Thoại Tri Thức S-Rank', color: '#fbbf24' };
    }
    if (exp >= 2500) {
      return { tier: 'A', title: '⚡ Đại Pháp Sư Luyện Đề A-Rank', color: '#a855f7' };
    }
    if (exp >= 1000) {
      return { tier: 'B', title: '⚔️ Hiệp Sĩ Khảo Thí B-Rank', color: '#00f0ff' };
    }
    if (exp >= 300) {
      return { tier: 'C', title: '🛡️ Vệ Binh Ôn Thi C-Rank', color: '#22c55e' };
    }
    return { tier: 'D', title: '🌱 Học Viên Tập Sự D-Rank', color: '#94a3b8' };
  }

  /**
   * Records answered question and updates EXP, Level, and Streak
   */
  public recordAnswer(isCorrect: boolean): { earnedExp: number; leveledUp: boolean } {
    const earnedExp = isCorrect ? 15 : 5;
    const oldLevel = this.profile.level;

    this.profile.totalAnswered++;
    if (isCorrect) this.profile.totalCorrect++;

    this.profile.exp += earnedExp;
    this.updateLevelAndRank();
    this.updateDailyStreak();
    this.saveProfile();

    const leveledUp = this.profile.level > oldLevel;
    return { earnedExp, leveledUp };
  }

  /**
   * Records exam completion bonus
   */
  public recordExamCompleted(scorePercent: number): { bonusExp: number; leveledUp: boolean } {
    const oldLevel = this.profile.level;
    const bonusExp = 50 + Math.floor(scorePercent);

    this.profile.exp += bonusExp;
    this.updateLevelAndRank();
    this.updateDailyStreak();
    this.saveProfile();

    const leveledUp = this.profile.level > oldLevel;
    return { bonusExp, leveledUp };
  }

  private updateLevelAndRank(): void {
    const calculatedLevel = Math.floor(this.profile.exp / EXP_PER_LEVEL) + 1;
    this.profile.level = calculatedLevel;
    this.profile.nextLevelExp = calculatedLevel * EXP_PER_LEVEL;

    const rankInfo = this.calculateRank(this.profile.exp);
    this.profile.rankTier = rankInfo.tier;
    this.profile.guildTitle = rankInfo.title;
  }

  private updateDailyStreak(): void {
    const today = this.getTodayDateString();
    if (this.profile.lastActiveDate === today) {
      return;
    }

    const last = new Date(this.profile.lastActiveDate);
    const curr = new Date(today);
    const diffDays = Math.round((curr.getTime() - last.getTime()) / (1000 * 3600 * 24));

    if (diffDays === 1) {
      this.profile.streakDays++;
    } else if (diffDays > 1) {
      this.profile.streakDays = 1;
    }

    this.profile.lastActiveDate = today;
  }

  /**
   * Renders the Anime Guild Card inside the designated DOM element
   */
  public renderTo(container: HTMLElement, onModeSelect?: (mode: 'practice' | 'exam') => void): void {
    const rankInfo = this.calculateRank(this.profile.exp);
    const currentLevelExp = this.profile.exp % EXP_PER_LEVEL;
    const expPercent = Math.min(100, Math.round((currentLevelExp / EXP_PER_LEVEL) * 100));
    const accuracy = this.profile.totalAnswered > 0
      ? Math.round((this.profile.totalCorrect / this.profile.totalAnswered) * 100)
      : 100;

    container.innerHTML = `
      <div class="guild-card-inner rank-${this.profile.rankTier.toLowerCase()}">
        <div class="guild-card-header">
          <div class="guild-avatar-box">
            <span class="guild-avatar-emoji">${this.profile.avatarEmoji}</span>
            <span class="guild-rank-tag" style="background: ${rankInfo.color};">${this.profile.rankTier}</span>
          </div>
          <div class="guild-user-meta">
            <div class="guild-user-title">${this.profile.guildTitle}</div>
            <div class="guild-user-name">${this.profile.username} <span class="guild-level-badge">Lv.${this.profile.level}</span></div>
          </div>
          <div class="guild-streak-pill" title="Chuỗi ngày luyện đề liên tiếp">
            🔥 <strong>${this.profile.streakDays}</strong> ngày
          </div>
        </div>

        <div class="guild-exp-section">
          <div class="guild-exp-labels">
            <span>EXP Tiến độ</span>
            <span>${currentLevelExp} / ${EXP_PER_LEVEL} XP</span>
          </div>
          <div class="guild-exp-track">
            <div class="guild-exp-fill" style="width: ${expPercent}%; background: ${rankInfo.color};"></div>
          </div>
        </div>

        <div class="guild-stats-mini-row">
          <div class="guild-mini-stat">
            <span class="mini-stat-label">Tổng đã làm</span>
            <strong class="mini-stat-val">${this.profile.totalAnswered}</strong>
          </div>
          <div class="guild-mini-stat">
            <span class="mini-stat-label">Độ chính xác</span>
            <strong class="mini-stat-val">${accuracy}%</strong>
          </div>
          <div class="guild-mini-stat">
            <span class="mini-stat-label">Điểm tích lũy</span>
            <strong class="mini-stat-val">${this.profile.exp} XP</strong>
          </div>
        </div>

        <div class="guild-mode-select-row">
          <button type="button" class="btn-guild-mode btn-mode-dojo" id="btn-guild-dojo" title="Chế độ học tự do, có giải thích tức thì và Anime Sensei gợi ý">
            🥋 Dojo Tu Luyện
          </button>
          <button type="button" class="btn-guild-mode btn-mode-arena" id="btn-guild-arena" title="Đấu trường thi chuẩn hóa CBT, bấm giờ và giám thị nghiêm ngặt">
            ⚔️ Đấu Trường Arena
          </button>
        </div>
      </div>
    `;

    const btnDojo = container.querySelector('#btn-guild-dojo');
    const btnArena = container.querySelector('#btn-guild-arena');

    btnDojo?.addEventListener('click', () => {
      onModeSelect?.('practice');
    });

    btnArena?.addEventListener('click', () => {
      onModeSelect?.('exam');
    });
  }
}

export const guildCardManager = new GuildCardManager();
