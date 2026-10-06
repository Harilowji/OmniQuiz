/**
 * src/shared/security/sanitizer.ts
 * Enterprise HTML Sanitizer using DOMPurify
 * Defends against Stored DOM XSS (SEC-01) across exam, practice, and flashcard views.
 */
import DOMPurify, { type Config } from 'dompurify';

const SANITIZE_CONFIG: Config = {
  ALLOWED_TAGS: [
    'p', 'span', 'b', 'strong', 'i', 'em', 'u', 's', 'sub', 'sup',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'br', 'hr',
    'pre', 'code', 'table', 'thead', 'tbody', 'tr', 'th', 'td',
    'img', 'div', 'button', 'mark', 'blockquote', 'kbd', 'small', 'del', 'ins',
    // KaTeX / MathML support
    'math', 'semantics', 'mrow', 'mi', 'mo', 'mn', 'annotation',
    'mstyle', 'mfrac', 'msup', 'msub', 'msubsup', 'msqrt', 'mroot',
    'mspace', 'mtext', 'mtable', 'mtr', 'mtd',
    // SVG icons / diagram shapes
    'svg', 'path', 'g', 'circle', 'rect', 'line', 'polygon', 'polyline'
  ],
  ALLOWED_ATTR: [
    'class', 'id', 'src', 'alt', 'width', 'height', 'style', 'title',
    'aria-hidden', 'role', 'tabindex', 'href', 'target', 'rel',
    'type', 'disabled', 'data-q', 'data-opt', 'data-rate',
    // SVG attributes
    'viewBox', 'xmlns', 'fill', 'stroke', 'stroke-width', 'stroke-linecap',
    'stroke-linejoin', 'd', 'cx', 'cy', 'r', 'x', 'y'
  ],
  FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'base', 'link', 'meta', 'applet'],
  FORBID_ATTR: [
    'onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur',
    'onmouseenter', 'onmouseleave', 'onkeydown', 'onkeyup', 'data-action'
  ],
};

type PurifierType = { sanitize: (dirty: string, config?: Config) => string };

function initPurifier(): PurifierType {
  // If window is defined globally in browser environment
  if (typeof window !== 'undefined') {
    if (typeof (DOMPurify as unknown as PurifierType).sanitize === 'function') {
      return DOMPurify as unknown as PurifierType;
    }
    return DOMPurify(window as unknown as Window & typeof globalThis) as unknown as PurifierType;
  }

  // Node.js test environment: fallback using JSDOM
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { JSDOM } = require('jsdom');
    const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
    return DOMPurify(dom.window as unknown as Window & typeof globalThis) as unknown as PurifierType;
  } catch {
    // Basic regex sanitizer fallback if jsdom is not loaded
    return {
      sanitize: (dirty: string): string => {
        return dirty
          .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
          .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
          .replace(/on\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
          .replace(/javascript\s*:[^"'\s>]+/gi, '');
      },
    };
  }
}

let purifierInstance: PurifierType | null = null;

/**
 * Sanitizes an untrusted HTML string using DOMPurify with EdTech whitelist.
 * Strips malicious script tags, iframe, inline event handlers (onerror, onclick), etc.
 */
export function sanitizeHtml(dirtyHtml: string): string {
  if (!dirtyHtml) return '';
  if (!purifierInstance) {
    purifierInstance = initPurifier();
  }
  return purifierInstance.sanitize(dirtyHtml, SANITIZE_CONFIG);
}
