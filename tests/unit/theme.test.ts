import { describe, it, expect, beforeEach } from 'vitest';

// Setup DOM & Storage mocks before importing modules
const mockStorage: Record<string, string> = {};
const mockClassList = new Set<string>();

const mockDocument = {
  documentElement: {
    style: {
      setProperty: () => {},
    },
  },
  body: {
    className: '',
    classList: {
      add: (cls: string) => mockClassList.add(cls),
      remove: (cls: string) => mockClassList.delete(cls),
      contains: (cls: string) => mockClassList.has(cls),
      toggle: (cls: string, force?: boolean) => {
        if (force === undefined) {
          if (mockClassList.has(cls)) mockClassList.delete(cls);
          else mockClassList.add(cls);
        } else if (force) {
          mockClassList.add(cls);
        } else {
          mockClassList.delete(cls);
        }
      },
    },
    appendChild: () => {},
  },
  querySelector: () => null,
  querySelectorAll: () => [],
  getElementById: () => null,
  createElement: () => ({ name: '', content: '' }),
  head: { appendChild: () => {} },
  addEventListener: () => {},
};

const mockLocalStorage = {
  getItem: (key: string) => mockStorage[key] ?? null,
  setItem: (key: string, val: string) => { mockStorage[key] = String(val); },
  removeItem: (key: string) => { delete mockStorage[key]; },
  clear: () => {
    for (const k of Object.keys(mockStorage)) delete mockStorage[k];
  },
};

Object.defineProperty(globalThis, 'document', {
  value: mockDocument,
  writable: true,
  configurable: true,
});

Object.defineProperty(globalThis, 'localStorage', {
  value: mockLocalStorage,
  writable: true,
  configurable: true,
});

Object.defineProperty(globalThis, 'window', {
  value: {
    matchMedia: () => ({ matches: false }),
    addEventListener: () => {},
    localStorage: mockLocalStorage,
    document: mockDocument,
  },
  writable: true,
  configurable: true,
});

import { themeManager, THEMES_LIST, getThemeConfig, type ThemeId } from '../../src/features/theme/theme-manager';

describe('ThemeManager & Gaming Live Wallpaper Engine', () => {
  beforeEach(() => {
    mockClassList.clear();
    mockLocalStorage.clear();
  });

  it('correctly validates supported theme IDs', () => {
    expect(themeManager.isValidTheme('academic')).toBe(true);
    expect(themeManager.isValidTheme('playful')).toBe(true);
    expect(themeManager.isValidTheme('cyberpunk')).toBe(true);
    expect(themeManager.isValidTheme('emerald')).toBe(true);
    expect(themeManager.isValidTheme('minimalist')).toBe(true);
    expect(themeManager.isValidTheme('sepia')).toBe(true);
    expect(themeManager.isValidTheme('unknown-theme')).toBe(false);
  });

  it('defaults to academic theme when localStorage is empty', () => {
    expect(themeManager.getSavedTheme()).toBe('academic');
  });

  it('restores stored theme from localStorage', () => {
    mockLocalStorage.setItem('omniquiz_theme', 'cyberpunk');
    expect(themeManager.getSavedTheme()).toBe('cyberpunk');
  });

  it('applies theme by setting class on document.body and persisting to localStorage', () => {
    themeManager.applyTheme('emerald', false);

    expect(themeManager.getCurrentTheme()).toBe('emerald');
    expect(mockClassList.has('theme-emerald')).toBe(true);
    expect(mockLocalStorage.getItem('omniquiz_theme')).toBe('emerald');

    // Switching to another theme cleans previous theme class
    themeManager.applyTheme('sepia', false);
    expect(themeManager.getCurrentTheme()).toBe('sepia');
    expect(mockClassList.has('theme-sepia')).toBe(true);
    expect(mockClassList.has('theme-emerald')).toBe(false);
  });

  it('cycles sequentially through all 6 themes in order', () => {
    themeManager.applyTheme('academic', false);

    const expectedSequence: ThemeId[] = [
      'playful',
      'cyberpunk',
      'emerald',
      'minimalist',
      'sepia',
      'academic',
    ];

    for (const expectedTheme of expectedSequence) {
      themeManager.cycleTheme();
      expect(themeManager.getCurrentTheme()).toBe(expectedTheme);
      expect(mockClassList.has(`theme-${expectedTheme}`)).toBe(true);
    }
  });

  it('getThemeConfig returns configuration metadata and Sameko animated backgrounds', () => {
    for (const t of THEMES_LIST) {
      const cfg = getThemeConfig(t.id);
      expect(cfg.id).toBe(t.id);
      expect(cfg.name).toBeTruthy();
      expect(cfg.icon).toBeTruthy();
      expect(cfg.metaThemeColor).toBeTruthy();
      expect(['video', 'image']).toContain(cfg.mediaType);
      expect(cfg.mediaUrl).toBeTruthy();
    }

    // Explicitly verify Sameko gaming background assets
    expect(getThemeConfig('playful').mediaUrl).toContain('pink.webm');
    expect(getThemeConfig('cyberpunk').mediaUrl).toContain('darkblue.webm');
    expect(getThemeConfig('emerald').mediaUrl).toContain('nord.webm');
    expect(getThemeConfig('minimalist').mediaUrl).toContain('dracula.webm');
    expect(getThemeConfig('sepia').mediaUrl).toContain('monokai.webm');
    expect(getThemeConfig('academic').mediaUrl).toContain('background.jpg');
  });

  it('manages live wallpaper state and default opacity', () => {
    expect(themeManager.isLiveBackgroundActive()).toBe(true);
    expect(themeManager.getBackgroundOpacity()).toBe(0.45);
  });
});
