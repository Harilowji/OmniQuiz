/**
 * @vitest-environment jsdom
 * tests/unit/ui-scale.test.ts
 * Verifies 110% (1.1x) UI Scale configuration, responsive containment, and zero horizontal overflow safety.
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('110% UI Scale & Viewport Safety Audit', () => {
  const mainCssPath = path.resolve(__dirname, '../../css/main.css');
  const componentsCssPath = path.resolve(__dirname, '../../css/components.css');
  const themesCssPath = path.resolve(__dirname, '../../css/themes.css');
  const animationsCssPath = path.resolve(__dirname, '../../css/animations.css');

  const mainCss = fs.readFileSync(mainCssPath, 'utf-8');
  const componentsCss = fs.readFileSync(componentsCssPath, 'utf-8');
  const themesCss = fs.readFileSync(themesCssPath, 'utf-8');
  const animationsCss = fs.readFileSync(animationsCssPath, 'utf-8');

  it('should define zoom: 1.1 for desktop and tablet viewports (>= 768px)', () => {
    expect(mainCss).toMatch(/@media\s*\(\s*min-width:\s*768px\s*\)/);
    expect(mainCss).toMatch(/zoom:\s*1\.1/);
    expect(mainCss).toMatch(/-moz-transform:\s*scale\(1\.1\)/);
    expect(mainCss).toMatch(/-moz-transform-origin:\s*0\s*0/);
  });

  it('should provide @supports not (zoom: 1.1) fallback with font-size: 110%', () => {
    expect(mainCss).toMatch(/@supports\s*not\s*\(\s*zoom:\s*1\.1\s*\)/);
    expect(mainCss).toMatch(/font-size:\s*110%/);
  });

  it('should enforce 100% scale on mobile devices (< 768px) to prevent layout breakage', () => {
    expect(mainCss).toMatch(/@media\s*\(\s*max-width:\s*767px\s*\)/);
    expect(mainCss).toMatch(/zoom:\s*1/);
  });

  it('should enforce zero horizontal overflow on html and body', () => {
    expect(mainCss).toMatch(/html,\s*body\s*\{[^}]*max-width:\s*100%/);
    expect(mainCss).toMatch(/html,\s*body\s*\{[^}]*overflow-x:\s*hidden/);
  });

  it('should ensure full-screen overlays and canvases do not cause horizontal overflow', () => {
    // Ambient canvas
    expect(componentsCss).toMatch(/\.bg-ambient-canvas\s*\{[^}]*max-width:\s*100%/);

    // Fullscreen lockout backdrop
    expect(componentsCss).toMatch(/\.fullscreen-lockout-backdrop\s*\{[^}]*max-width:\s*100%/);

    // Drawer backdrop
    expect(componentsCss).toMatch(/\.drawer-backdrop\s*\{[^}]*max-width:\s*100%/);

    // Background video and still image in themes.css
    expect(themesCss).toMatch(/\.app-bg-video\s*\{[^}]*max-width:\s*100%/);
    expect(themesCss).toMatch(/\.app-bg-still\s*\{[^}]*max-width:\s*100%/);

    // Confetti canvas in animations.css
    expect(animationsCss).toMatch(/#confetti-canvas\s*\{[^}]*max-width:\s*100%/);
  });
});
