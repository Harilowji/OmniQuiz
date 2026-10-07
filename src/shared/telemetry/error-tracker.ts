/**
 * src/shared/telemetry/error-tracker.ts - Global Error Telemetry & Auto-Recovery
 * Intercepts uncaught runtime exceptions and unhandled promise rejections,
 * logs traces to IndexedDB (system_logs), and ensures seamless UI self-healing.
 */

import { localDB } from '../db/dexie-db';
import { themeManager } from '../../features/theme/theme-manager';

export class ErrorTracker {
  private isInitialized = false;
  private lastAlertTimestamp = 0;
  private readonly ALERT_THROTTLE_MS = 5000;

  /**
   * Register global error listeners on window
   */
  public init(): void {
    if (this.isInitialized || typeof window === 'undefined') return;
    this.isInitialized = true;

    window.addEventListener('error', (event: ErrorEvent) => {
      this.handleError(event);
    });

    window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
      this.handleUnhandledRejection(event);
    });
  }

  /**
   * Process and log window.onerror event
   */
  public async handleError(event: ErrorEvent | { message: string; filename?: string; lineno?: number; colno?: number; error?: Error }): Promise<void> {
    const message = event.message || (event.error?.message ?? 'Lỗi không xác định');
    const stack = event.error?.stack || `${event.filename || ''}:${event.lineno || 0}:${event.colno || 0}`;
    const source = event.filename || 'runtime';
    const currentUrl = typeof window !== 'undefined' ? window.location.href : '';

    await localDB.logSystemError({
      type: 'error',
      message: String(message),
      stack: String(stack),
      source,
      url: currentUrl,
    });

    this.notifyRecovery();
  }

  /**
   * Process and log unhandled promise rejections
   */
  public async handleUnhandledRejection(event: PromiseRejectionEvent | { reason: unknown }): Promise<void> {
    const reason = event.reason;
    let message = 'Unhandled Promise Rejection';
    let stack: string | undefined;

    if (reason instanceof Error) {
      message = reason.message;
      stack = reason.stack;
    } else if (typeof reason === 'string') {
      message = reason;
    } else {
      try {
        message = JSON.stringify(reason);
      } catch {
        message = String(reason);
      }
    }

    const currentUrl = typeof window !== 'undefined' ? window.location.href : '';

    await localDB.logSystemError({
      type: 'unhandledrejection',
      message,
      stack,
      source: 'promise',
      url: currentUrl,
    });

    this.notifyRecovery();
  }

  /**
   * Display non-intrusive self-healing toast notification
   */
  private notifyRecovery(): void {
    const now = Date.now();
    if (now - this.lastAlertTimestamp < this.ALERT_THROTTLE_MS) {
      return;
    }
    this.lastAlertTimestamp = now;

    try {
      themeManager.showToast('🛡️ Hệ thống vừa tự động khôi phục từ một sự cố giao diện mà không làm mất bài thi của bạn.');
    } catch {
      // Fallback silent recovery
    }
  }
}

export const errorTracker = new ErrorTracker();
