/**
 * src/shared/renderers/katex.ts - KaTeX Math & Science Formula Rendering Engine
 * Safely parses $inline$ and $$block$$ formulas with zero layout jank.
 */

import katex from 'katex';

export class KaTeXRenderer {
  /**
   * Render raw LaTeX math expression to HTML string
   */
  static renderFormula(latex: string, displayMode: boolean = false): string {
    try {
      return katex.renderToString(latex.trim(), {
        displayMode,
        throwOnError: false,
        output: 'htmlAndMathml',
        trust: true,
        strict: false,
      });
    } catch (err) {
      console.warn('[KaTeX Render Warning]', err);
      return `<code class="katex-fallback">${this.escapeHtml(latex)}</code>`;
    }
  }

  /**
   * Parse text containing $...$ or $$...$$ and replace with KaTeX HTML
   */
  static renderTextWithMath(rawText: string): string {
    if (!rawText) return '';

    // First replace block math $$...$$
    let processed = rawText.replace(/\$\$([\s\S]+?)\$\$/g, (_, math) => {
      return `<div class="katex-block-wrapper">${this.renderFormula(math, true)}</div>`;
    });

    // Next replace inline math $...$
    processed = processed.replace(/(?<!\$)\$(?!\$)([^\n$]+?)\$(?!\$)/g, (_, math) => {
      return `<span class="katex-inline-wrapper">${this.renderFormula(math, false)}</span>`;
    });

    return processed;
  }

  private static escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}
