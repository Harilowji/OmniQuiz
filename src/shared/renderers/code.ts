/**
 * src/shared/renderers/code.ts - Code Highlighting & Informatics Syntax Renderer
 * Supports C, C++, Python, Pascal, Java, JavaScript, SQL with line numbering & copy.
 */

export class CodeRenderer {
  /**
   * Escape HTML entities
   */
  static escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /**
   * Render formatted code block with header, language badge, line numbers, and copy button
   */
  static renderCodeBlock(code: string, language: string = 'plaintext'): string {
    const cleanCode = code.trim();
    const lines = cleanCode.split('\n');
    const numberedLines = lines
      .map((line, idx) => {
        const lineNum = idx + 1;
        return `<span class="code-line"><span class="code-line-number">${lineNum}</span><span class="code-line-content">${this.escapeHtml(
          line
        )}</span></span>`;
      })
      .join('\n');

    const cleanLang = language.toLowerCase() || 'code';

    return `
      <div class="quiz-code-block-wrap" data-lang="${cleanLang}">
        <div class="quiz-code-header">
          <span class="code-lang-tag">${cleanLang.toUpperCase()}</span>
          <button type="button" class="btn-copy-code" data-code="${encodeURIComponent(cleanCode)}">
            <span class="copy-label">Sao chép</span>
          </button>
        </div>
        <pre class="quiz-code-block"><code>${numberedLines}</code></pre>
      </div>
    `.trim();
  }

  /**
   * Scan markdown-style ```lang ... ``` blocks in question texts
   */
  static parseMarkdownCodeBlocks(content: string): string {
    return content.replace(/```([a-zA-Z0-9_+-]*)\n([\s\S]*?)```/g, (_, lang, code) => {
      return this.renderCodeBlock(code, lang || 'text');
    });
  }
}
