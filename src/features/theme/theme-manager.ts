/**
 * src/features/theme/theme-manager.ts
 * Enterprise Theme Management & Visual Appearance Engine
 * Supports 6 Material 3 Expressive & Eye-Comfort Palettes:
 * - Academic (Kawaii Light / Ocean Saba)
 * - Playful (Sakura Pastel Pink)
 * - Cyberpunk (Kawaii Dark / Deep Ocean)
 * - Emerald (Nord Arctic Frost)
 * - Minimalist (Dracula Cyber Vampire)
 * - Sepia (Monokai Hacker Pro)
 */

export type ThemeId = 'academic' | 'playful' | 'cyberpunk' | 'emerald' | 'minimalist' | 'sepia';

export interface ThemeConfig {
  id: ThemeId;
  name: string;
  subtitle: string;
  icon: string;
  dotColor: string;
  metaThemeColor: string;
}

export const THEMES_LIST: ThemeConfig[] = [
  {
    id: 'academic',
    name: 'Kawaii Light',
    subtitle: 'Sameko Saba (Ocean)',
    icon: '🌊',
    dotColor: '#4a9bc9',
    metaThemeColor: '#e8f4fc',
  },
  {
    id: 'playful',
    name: 'Sakura',
    subtitle: 'Pastel Pink',
    icon: '🌸',
    dotColor: '#ff9aaf',
    metaThemeColor: '#fff5f8',
  },
  {
    id: 'cyberpunk',
    name: 'Kawaii Dark',
    subtitle: 'Deep Ocean',
    icon: '🌌',
    dotColor: '#88c9ea',
    metaThemeColor: '#0d1a25',
  },
  {
    id: 'emerald',
    name: 'Nord',
    subtitle: 'Arctic Frost',
    icon: '❄️',
    dotColor: '#88c0d0',
    metaThemeColor: '#242933',
  },
  {
    id: 'minimalist',
    name: 'Dracula',
    subtitle: 'Cyber Vampire',
    icon: '🧛',
    dotColor: '#ff79c6',
    metaThemeColor: '#21222c',
  },
  {
    id: 'sepia',
    name: 'Monokai',
    subtitle: 'Hacker Pro',
    icon: '🌿',
    dotColor: '#a6e22e',
    metaThemeColor: '#1e1f1c',
  },
];

export const DEFAULT_THEME_CONFIG: ThemeConfig = {
  id: 'academic',
  name: 'Kawaii Light',
  subtitle: 'Sameko Saba (Ocean)',
  icon: '🌊',
  dotColor: '#4a9bc9',
  metaThemeColor: '#e8f4fc',
};

export function getThemeConfig(id: ThemeId): ThemeConfig {
  return THEMES_LIST.find((t) => t.id === id) ?? DEFAULT_THEME_CONFIG;
}

class ThemeManager {
  private currentTheme: ThemeId = 'academic';
  private toastTimer: ReturnType<typeof setTimeout> | null = null;

  public init(): void {
    // 1. Load saved theme from localStorage
    const saved = this.getSavedTheme();
    this.applyTheme(saved, false);

    // 2. Bind Quick Theme Switcher Button (navbar)
    const btnQuick = document.getElementById('btn-quick-theme');
    if (btnQuick) {
      btnQuick.addEventListener('click', () => {
        this.cycleTheme();
      });
    }

    // 3. Bind Theme Selector Select Dropdown (if present in DOM)
    const selTheme = document.getElementById('theme-selector') as HTMLSelectElement | null;
    if (selTheme) {
      selTheme.addEventListener('change', (e) => {
        const val = (e.target as HTMLSelectElement).value as ThemeId;
        if (this.isValidTheme(val)) {
          this.applyTheme(val, true);
        }
      });
    }

    // 4. Bind Theme Choice Buttons in Tools Modal
    document.querySelectorAll('.theme-choice-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const theme = btn.getAttribute('data-theme') as ThemeId;
        if (this.isValidTheme(theme)) {
          this.applyTheme(theme, true);
        }
      });
    });

    // 5. Bind Tools & Settings Center Modal Controls
    this.bindToolsModalControls();

    // 6. Bind Fullscreen Navbar Button
    this.bindFullscreenToggle();
  }

  public getCurrentTheme(): ThemeId {
    return this.currentTheme;
  }

  public getSavedTheme(): ThemeId {
    try {
      const stored = localStorage.getItem('omniquiz_theme');
      if (stored && this.isValidTheme(stored as ThemeId)) {
        return stored as ThemeId;
      }
    } catch {
      // ignore security/sandbox errors
    }
    return 'academic';
  }

  public isValidTheme(id: string): id is ThemeId {
    return THEMES_LIST.some((t) => t.id === id);
  }

  /**
   * Applies the selected theme to the DOM, updating body classes,
   * meta theme-color, quick theme pill icon, and active button states.
   */
  public applyTheme(themeId: ThemeId, showNotification = true): void {
    const config = getThemeConfig(themeId);
    this.currentTheme = config.id;

    const updateDOM = () => {
      // 1. Update body class: remove all theme-* classes and add new one
      THEMES_LIST.forEach((t) => {
        document.body.classList.remove(`theme-${t.id}`);
      });
      document.body.classList.add(`theme-${config.id}`);

      // 2. Update meta theme-color for mobile browser address bars
      let metaTheme = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null;
      if (!metaTheme) {
        metaTheme = document.createElement('meta');
        metaTheme.name = 'theme-color';
        document.head.appendChild(metaTheme);
      }
      metaTheme.content = config.metaThemeColor;

      // 3. Update quick theme navbar icon
      const iconEl = document.getElementById('txt-quick-theme-icon');
      if (iconEl) {
        iconEl.textContent = config.icon;
      }

      // 4. Update quick theme button title
      const btnQuick = document.getElementById('btn-quick-theme');
      if (btnQuick) {
        btnQuick.title = `Chuyển chủ đề: ${config.name} (${config.subtitle})`;
      }

      // 5. Update active state of theme buttons in tools modal
      document.querySelectorAll('.theme-choice-btn').forEach((b) => {
        const bTheme = b.getAttribute('data-theme');
        b.classList.toggle('active', bTheme === config.id);
      });

      // 6. Update select element if present
      const selTheme = document.getElementById('theme-selector') as HTMLSelectElement | null;
      if (selTheme) {
        selTheme.value = config.id;
      }

      // 7. Persist preference to localStorage
      try {
        localStorage.setItem('omniquiz_theme', config.id);
      } catch {
        // ignore
      }
    };

    // Use View Transitions API if supported and user has not requested reduced motion
    const docWithTransitions = document as Document & {
      startViewTransition?: (cb: () => void) => void;
    };
    if (
      typeof docWithTransitions.startViewTransition === 'function' &&
      !window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      docWithTransitions.startViewTransition(updateDOM);
    } else {
      updateDOM();
    }

    if (showNotification) {
      this.showToast(`${config.icon} ${config.name} • ${config.subtitle}`);
    }
  }

  /**
   * Cycles through available themes in sequential order with playful button spin.
   */
  public cycleTheme(): void {
    const btnQuick = document.getElementById('btn-quick-theme');
    if (btnQuick) {
      btnQuick.classList.remove('btn-theme-spin');
      void btnQuick.offsetWidth; // Force CSS reflow to re-trigger keyframe animation
      btnQuick.classList.add('btn-theme-spin');
    }

    const currentIdx = THEMES_LIST.findIndex((t) => t.id === this.currentTheme);
    const nextIdx = (currentIdx + 1) % THEMES_LIST.length;
    const nextItem = THEMES_LIST[nextIdx];
    const nextTheme: ThemeId = nextItem ? nextItem.id : 'academic';

    this.applyTheme(nextTheme, true);
  }

  /**
   * Displays floating non-intrusive notification toast
   */
  public showToast(message: string): void {
    let toast = document.getElementById('omni-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'omni-toast';
      toast.className = 'omni-toast';
      if (document.body && typeof document.body.appendChild === 'function') {
        document.body.appendChild(toast);
      }
    }

    toast.textContent = message;
    if (toast.classList && typeof toast.classList.add === 'function') {
      toast.classList.add('show');
    }

    if (this.toastTimer) {
      clearTimeout(this.toastTimer);
    }

    this.toastTimer = setTimeout(() => {
      toast?.classList.remove('show');
    }, 2200);
  }

  /**
   * Binds modal open/close actions for #tools-modal
   */
  private bindToolsModalControls(): void {
    const toolsModal = document.getElementById('tools-modal');
    const btnToggle = document.getElementById('btn-tools-toggle');
    const btnClose = document.getElementById('btn-close-tools-modal');
    const btnDone = document.getElementById('btn-done-tools');

    const openTools = () => {
      if (!toolsModal) return;
      // Sync active theme state buttons
      document.querySelectorAll('.theme-choice-btn').forEach((b) => {
        b.classList.toggle('active', b.getAttribute('data-theme') === this.currentTheme);
      });
      // Sync sound buttons
      const isSound = localStorage.getItem('omniquiz_sound') !== 'false';
      document.querySelectorAll('.btn-sound-choice').forEach((b) => {
        const val = b.getAttribute('data-sound') === 'true';
        b.classList.toggle('active', val === isSound);
      });
      toolsModal.style.display = 'flex';
    };

    const closeTools = () => {
      if (toolsModal) toolsModal.style.display = 'none';
    };

    btnToggle?.addEventListener('click', openTools);
    btnClose?.addEventListener('click', closeTools);
    btnDone?.addEventListener('click', closeTools);

    // Close when clicking modal backdrop
    toolsModal?.addEventListener('click', (e) => {
      if (e.target === toolsModal) {
        closeTools();
      }
    });

    // Close on Escape key
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && toolsModal && toolsModal.style.display === 'flex') {
        closeTools();
      }
    });

    // Sound toggle buttons
    document.querySelectorAll('.btn-sound-choice').forEach((btn) => {
      btn.addEventListener('click', () => {
        const soundOn = btn.getAttribute('data-sound') === 'true';
        try {
          localStorage.setItem('omniquiz_sound', String(soundOn));
        } catch {
          // ignore
        }
        document.querySelectorAll('.btn-sound-choice').forEach((b) => {
          b.classList.toggle('active', b === btn);
        });
        this.showToast(soundOn ? '🔊 Đã bật âm thanh hiệu ứng' : '🔇 Đã tắt âm thanh hiệu ứng');
      });
    });

    // Language toggle buttons
    document.querySelectorAll('.btn-lang-choice').forEach((btn) => {
      btn.addEventListener('click', () => {
        const lang = btn.getAttribute('data-lang') || 'vi';
        try {
          localStorage.setItem('omniquiz_lang', lang);
        } catch {
          // ignore
        }
        document.querySelectorAll('.btn-lang-choice').forEach((b) => {
          b.classList.toggle('active', b === btn);
        });
        this.showToast(lang === 'vi' ? '🇻🇳 Đã chuyển sang Tiếng Việt' : '🇬🇧 Switched to English');
      });
    });
  }

  /**
   * Binds Fullscreen toggle button in navbar
   */
  private bindFullscreenToggle(): void {
    const btnFs = document.getElementById('btn-fullscreen-toggle');
    if (!btnFs) return;

    btnFs.addEventListener('click', () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
      } else {
        document.exitFullscreen().catch(() => {});
      }
    });

    document.addEventListener('fullscreenchange', () => {
      if (document.fullscreenElement) {
        btnFs.textContent = '🗗';
        btnFs.title = 'Thoát chế độ toàn màn hình';
      } else {
        btnFs.textContent = '⛶';
        btnFs.title = 'Toàn màn hình';
      }
    });
  }
}

export const themeManager = new ThemeManager();
