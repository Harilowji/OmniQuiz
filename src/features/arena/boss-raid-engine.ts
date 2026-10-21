/**
 * src/features/arena/boss-raid-engine.ts
 * Boss Raid Arena Engine for OmniQuiz PRO - "Azota Anime CBT Edition"
 * Manages Boss HP, Player Hearts, Combos, Critical Hit Anime Slashes, and Bonus EXP multipliers
 */

import { BossConfig, BossBattleState, Exam } from '../../shared/types';
import { soundEngine } from '../../shared/audio/sound-engine';
import { guildCardManager } from '../gamification/guild-card';
import { animeMascot } from '../mascot/anime-mascot';

export const ACADEMY_BOSSES: BossConfig[] = [
  {
    id: 'calculus_demon',
    name: 'Đại Ma Vương Giải Tích',
    tier: 'A',
    maxHp: 1000,
    expMultiplier: 1.5,
    avatar: '🐉',
    description: 'Kẻ thống trị chuỗi tích phân, giới hạn vô cực và cực trị hàm số nhiều biến.',
    titleAwarded: '🐉 Bậc Thầy Giải Tích S-Rank',
  },
  {
    id: 'quantum_entity',
    name: 'Thực Thể Lượng Tử Không Gian',
    tier: 'S',
    maxHp: 2500,
    expMultiplier: 2.0,
    avatar: '🌌',
    description: 'Thực thể điều khiển xác suất lượng tử, bước sóng De Broglie và không-thời gian.',
    titleAwarded: '🌌 Nhà Du Hành Lượng Tử S-Rank',
  },
  {
    id: 'omni_president',
    name: 'Hội Trưởng Tối Cao Học Viện Omni',
    tier: 'SS',
    maxHp: 5000,
    expMultiplier: 3.0,
    avatar: '👑',
    description: 'Người giám sát tối thượng của toàn bộ ngân hàng tri thức CBT đa vũ trụ Omni.',
    titleAwarded: '⚔️ Thợ Săn Học Viện S-Rank',
  },
];

export class BossRaidEngine {
  private state: BossBattleState | null = null;
  private hudElement: HTMLElement | null = null;
  private activeExam: Exam | null = null;

  constructor() {}

  public getBosses(): BossConfig[] {
    return [...ACADEMY_BOSSES];
  }

  public getBossById(id: string): BossConfig {
    const found = ACADEMY_BOSSES.find((b) => b.id === id);
    return (found || ACADEMY_BOSSES[0]) as BossConfig;
  }

  public getActiveExam(): Exam | null {
    return this.activeExam;
  }

  public getState(): BossBattleState | null {
    return this.state ? { ...this.state } : null;
  }

  public isActive(): boolean {
    return this.state !== null;
  }

  /**
   * Initializes a new Boss Raid session
   */
  public initRaid(boss: BossConfig, exam: Exam): void {
    this.activeExam = exam;
    this.state = {
      boss,
      bossCurrentHp: boss.maxHp,
      studentHearts: 3,
      studentMaxHearts: 3,
      combo: 0,
      maxCombo: 0,
      damageDealt: 0,
      isDefeated: false,
      totalQuestions: Math.max(1, exam.questions.length),
    };

    this.renderBattleHud();
    animeMascot.speak(
      `⚔️ Trận chiến bắt đầu! Hãy hạ gục ${boss.name}! Senpai cố lên! ✨`,
      5000,
      'proud'
    );
  }

  /**
   * Calculate damage dealt per question
   */
  public calculateDamage(combo: number, totalQuestions: number, bossMaxHp: number): number {
    const baseDamage = Math.ceil(bossMaxHp / Math.max(1, totalQuestions));
    let multiplier = 1.0;
    if (combo === 2) multiplier = 1.2;
    else if (combo === 3) multiplier = 1.5;
    else if (combo === 4) multiplier = 1.8;
    else if (combo >= 5) multiplier = 2.2;

    return Math.round(baseDamage * multiplier);
  }

  /**
   * Handles user answering a question
   */
  public handleAnswerFeedback(isCorrect: boolean): {
    damageDealt: number;
    combo: number;
    isCritical: boolean;
    bossHpLeft: number;
    heartsLeft: number;
    bossDefeated: boolean;
  } {
    if (!this.state) {
      return {
        damageDealt: 0,
        combo: 0,
        isCritical: false,
        bossHpLeft: 0,
        heartsLeft: 0,
        bossDefeated: false,
      };
    }

    let damage = 0;
    let isCritical = false;

    if (isCorrect) {
      this.state.combo += 1;
      if (this.state.combo > this.state.maxCombo) {
        this.state.maxCombo = this.state.combo;
      }

      isCritical = this.state.combo >= 3;
      damage = this.calculateDamage(
        this.state.combo,
        this.state.totalQuestions,
        this.state.boss.maxHp
      );

      this.state.bossCurrentHp = Math.max(0, this.state.bossCurrentHp - damage);
      this.state.damageDealt += damage;

      if (this.state.bossCurrentHp <= 0) {
        this.state.isDefeated = true;
      }

      // Audio effects
      if (isCritical) {
        soundEngine.playCombo(this.state.combo);
      } else {
        soundEngine.playCorrect();
      }

      // Visual animations
      this.triggerHitAnimation(damage, isCritical);

      if (isCritical) {
        animeMascot.speak(
          `🔥 CRITICAL HIT! Combo x${this.state.combo}! Tuyệt đỉnh Senpai! ✨`,
          3500,
          'happy'
        );
      }
    } else {
      // Wrong answer -> Boss Counter Attack
      this.state.combo = 0;
      this.state.studentHearts = Math.max(0, this.state.studentHearts - 1);
      soundEngine.playWrong();
      this.triggerCounterAttackAnimation();
      animeMascot.speak(
        `⚠️ Cẩn thận! ${this.state.boss.name} vừa phản đòn! Cố gắng câu tiếp theo nha Senpai!`,
        3500,
        'serious'
      );
    }

    this.updateHudUi();

    return {
      damageDealt: damage,
      combo: this.state.combo,
      isCritical,
      bossHpLeft: this.state.bossCurrentHp,
      heartsLeft: this.state.studentHearts,
      bossDefeated: this.state.isDefeated,
    };
  }

  /**
   * Final evaluation on exam submit (if boss defeated or score >= 70%)
   */
  public finalizeRaid(scorePercentage: number): {
    isVictorious: boolean;
    boss: BossConfig;
    bonusExp: number;
    titleAwarded: string;
  } | null {
    if (!this.state) return null;

    const boss = this.state.boss;
    const isVictorious = this.state.isDefeated || scorePercentage >= 70;

    const baseExp = Math.round((scorePercentage / 100) * 150);
    const bonusExp = isVictorious ? Math.round(baseExp * boss.expMultiplier) : baseExp;

    if (isVictorious) {
      soundEngine.playVictory();
      // Award Title to player profile
      const prof = guildCardManager.getProfile();
      prof.guildTitle = boss.titleAwarded;
      guildCardManager.saveProfile();
    }

    return {
      isVictorious,
      boss,
      bonusExp,
      titleAwarded: boss.titleAwarded,
    };
  }

  public endRaid(): void {
    if (this.hudElement && this.hudElement.parentNode) {
      this.hudElement.parentNode.removeChild(this.hudElement);
    }
    this.hudElement = null;
    this.state = null;
    this.activeExam = null;
  }

  /**
   * Renders the Boss Battle HUD into the DOM above the question containers
   */
  private renderBattleHud(): void {
    if (!this.state) return;

    let existing = document.getElementById('boss-battle-hud');
    if (!existing) {
      existing = document.createElement('div');
      existing.id = 'boss-battle-hud';
      existing.className = 'boss-battle-hud';

      // Insert above the main question viewport
      const targetAnchor =
        document.getElementById('exam-container') ||
        document.getElementById('practice-container') ||
        document.querySelector('.quiz-main');

      if (targetAnchor && targetAnchor.parentNode) {
        targetAnchor.parentNode.insertBefore(existing, targetAnchor);
      }
    }

    this.hudElement = existing;
    this.updateHudUi();
  }

  private updateHudUi(): void {
    if (!this.hudElement || !this.state) return;

    const boss = this.state.boss;
    const hpPercent = Math.max(
      0,
      Math.min(100, Math.round((this.state.bossCurrentHp / boss.maxHp) * 100))
    );

    let heartsHtml = '';
    for (let i = 0; i < this.state.studentMaxHearts; i++) {
      heartsHtml += i < this.state.studentHearts ? '💖 ' : '💔 ';
    }

    const tierBadgeClass = `boss-tier-${boss.tier.toLowerCase()}`;
    const comboBadgeHtml =
      this.state.combo >= 2
        ? `<div class="boss-combo-pill ${this.state.combo >= 3 ? 'critical-glow' : ''}">🔥 COMBO x${this.state.combo}</div>`
        : '';

    this.hudElement.innerHTML = `
      <div class="boss-hud-inner">
        <div class="boss-hud-top-row">
          <div class="boss-avatar-box">
            <span class="boss-avatar-icon">${boss.avatar}</span>
            <span class="boss-tier-badge ${tierBadgeClass}">Cấp ${boss.tier}</span>
          </div>
          <div class="boss-info-meta">
            <div class="boss-name-row">
              <span class="boss-name">${boss.name}</span>
              <span class="boss-hp-numbers">${this.state.bossCurrentHp.toLocaleString()} / ${boss.maxHp.toLocaleString()} HP</span>
            </div>
            <div class="boss-hp-bar-track">
              <div class="boss-hp-bar-fill" style="width: ${hpPercent}%;"></div>
            </div>
          </div>
          <div class="boss-hud-right">
            <div class="student-hearts-row" title="Máu học viên: Trả lời sai bị phản đòn!">
              <span class="hearts-label">Khiên:</span>
              <span class="hearts-icons">${heartsHtml.trim()}</span>
            </div>
            ${comboBadgeHtml}
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Anime Slash & Damage Floater Effect
   */
  private triggerHitAnimation(damage: number, isCritical: boolean): void {
    if (!this.hudElement) return;

    const floater = document.createElement('div');
    floater.className = `boss-damage-floater ${isCritical ? 'critical' : ''}`;
    floater.innerHTML = `${isCritical ? '⚡ CHÉM CHÍ MẠNG!<br>' : ''}-${damage} HP`;

    this.hudElement.appendChild(floater);
    setTimeout(() => {
      if (floater.parentNode) floater.parentNode.removeChild(floater);
    }, 1200);

    if (isCritical) {
      const slash = document.createElement('div');
      slash.className = 'anime-slash-screen';
      document.body.appendChild(slash);
      setTimeout(() => {
        if (slash.parentNode) slash.parentNode.removeChild(slash);
      }, 700);
    }
  }

  /**
   * Screen vignette red flash when boss strikes back
   */
  private triggerCounterAttackAnimation(): void {
    const flash = document.createElement('div');
    flash.className = 'boss-counter-attack-overlay';
    document.body.appendChild(flash);
    setTimeout(() => {
      if (flash.parentNode) flash.parentNode.removeChild(flash);
    }, 600);
  }

  /**
   * Opens the Boss Selection Modal for the user
   */
  public openBossRaidModal(onBossChosen: (boss: BossConfig) => void): void {
    let modal = document.getElementById('boss-raid-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'boss-raid-modal';
      modal.className = 'modal-overlay';
      modal.style.zIndex = '99995';
      document.body.appendChild(modal);
    }

    modal.innerHTML = `
      <div class="modal-content boss-raid-modal-card">
        <div class="boss-modal-header">
          <div class="boss-modal-title-group">
            <span class="boss-modal-icon">⚔️</span>
            <div>
              <h2 class="boss-modal-title">Đấu Trường Arena • Khiêu Chiến Boss</h2>
              <p class="boss-modal-subtitle">Hạ gục Boss Học Viện để nhận nhân bội EXP và mở khóa Danh Hiệu S-Rank!</p>
            </div>
          </div>
          <button type="button" class="btn-action btn-del" id="btn-close-boss-modal">✕</button>
        </div>

        <div class="boss-selection-grid">
          ${this.getBosses()
            .map(
              (boss) => `
            <div class="boss-select-card tier-${boss.tier.toLowerCase()}" data-boss-id="${boss.id}">
              <div class="boss-card-top">
                <span class="boss-card-avatar">${boss.avatar}</span>
                <span class="boss-card-tier-pill">Cấp ${boss.tier}</span>
              </div>
              <h3 class="boss-card-name">${boss.name}</h3>
              <p class="boss-card-desc">${boss.description}</p>
              <div class="boss-card-stats">
                <div class="boss-stat-item">
                  <span class="stat-lbl">Máu Boss</span>
                  <strong class="stat-val stat-hp">${boss.maxHp.toLocaleString()} HP</strong>
                </div>
                <div class="boss-stat-item">
                  <span class="stat-lbl">Thưởng EXP</span>
                  <strong class="stat-val stat-exp">x${boss.expMultiplier.toFixed(1)} EXP</strong>
                </div>
              </div>
              <div class="boss-reward-badge">
                🏆 Danh hiệu: <span>${boss.titleAwarded}</span>
              </div>
              <button type="button" class="btn-action btn-primary btn-challenge-boss" data-boss-id="${boss.id}">
                ⚔️ Khiêu Chiến Boss Này
              </button>
            </div>
          `
            )
            .join('')}
        </div>
      </div>
    `;

    modal.style.display = 'flex';

    modal.querySelector('#btn-close-boss-modal')?.addEventListener('click', () => {
      if (modal) modal.style.display = 'none';
    });

    modal.querySelectorAll('.btn-challenge-boss').forEach((btn) => {
      btn.addEventListener('click', () => {
        const bossId = btn.getAttribute('data-boss-id');
        const chosen = this.getBossById(bossId || '');
        if (modal) modal.style.display = 'none';
        soundEngine.playClick();
        onBossChosen(chosen);
      });
    });
  }
}

export const bossRaidEngine = new BossRaidEngine();
