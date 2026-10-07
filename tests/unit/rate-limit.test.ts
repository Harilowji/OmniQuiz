/**
 * @vitest-environment jsdom
 * tests/unit/rate-limit.test.ts
 * Verifies Anti-Brute-Force Rate Limiter on PIN room verification and client-side countdown lock.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { lobbyView } from '../../src/features/lobby/lobby-view';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const apiRouter = require('../../server/api');

describe('Anti-Brute-Force PIN Rate Limiting & UI Lock', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    document.body.innerHTML = `
      <div id="upload-section">
        <input type="text" id="input-join-pin" />
        <input type="text" class="otp-digit" />
        <input type="text" class="otp-digit" />
        <input type="text" class="otp-digit" />
        <input type="text" class="otp-digit" />
        <input type="text" class="otp-digit" />
        <input type="text" class="otp-digit" />
        <button id="btn-join-room">Vào phòng thi ➔</button>
      </div>
    `;
  });

  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  describe('Server API In-Memory Rate Limiter', () => {
    const testIp = '192.168.1.99';

    beforeEach(() => {
      // Clean slate for test IP
      apiRouter.pinRateLimiter.recordPinSuccess(testIp);
    });

    it('should permit initial verification attempts', () => {
      const check = apiRouter.pinRateLimiter.checkPinRateLimit(testIp);
      expect(check.blocked).toBe(false);
    });

    it('should permit up to 4 consecutive failed attempts without blocking', () => {
      for (let i = 1; i <= 4; i++) {
        apiRouter.pinRateLimiter.recordPinFailure(testIp);
        const check = apiRouter.pinRateLimiter.checkPinRateLimit(testIp);
        expect(check.blocked).toBe(false);
      }
    });

    it('should block IP with remaining seconds upon 5th consecutive failure', () => {
      for (let i = 1; i <= 5; i++) {
        apiRouter.pinRateLimiter.recordPinFailure(testIp);
      }
      const check = apiRouter.pinRateLimiter.checkPinRateLimit(testIp);
      expect(check.blocked).toBe(true);
      expect(check.remainingSec).toBeGreaterThan(0);
      expect(check.remainingSec).toBeLessThanOrEqual(60);
    });

    it('should immediately reset failure counter upon successful PIN entry', () => {
      // 4 failures
      for (let i = 1; i <= 4; i++) {
        apiRouter.pinRateLimiter.recordPinFailure(testIp);
      }
      expect(apiRouter.pinRateLimiter.checkPinRateLimit(testIp).blocked).toBe(false);

      // Successful verification
      apiRouter.pinRateLimiter.recordPinSuccess(testIp);

      expect(apiRouter.pinRateLimiter.pinRateLimitMap.has(testIp)).toBe(false);
      expect(apiRouter.pinRateLimiter.checkPinRateLimit(testIp).blocked).toBe(false);
    });
  });

  describe('Client UI Rate Limit Lockout', () => {
    it('should disable OTP digits and show countdown when rate limited', () => {
      const btnJoin = document.getElementById('btn-join-room') as HTMLButtonElement;
      const otpInputs = document.querySelectorAll<HTMLInputElement>('.otp-digit');
      const legacyInput = document.getElementById('input-join-pin') as HTMLInputElement;

      lobbyView.lockForRateLimit(60);

      // Inputs should be disabled
      otpInputs.forEach((inp) => expect(inp.disabled).toBe(true));
      expect(legacyInput.disabled).toBe(true);
      expect(btnJoin.disabled).toBe(true);
      expect(btnJoin.textContent).toBe('⏳ Chờ 60s...');

      // Advance 15 seconds
      vi.advanceTimersByTime(15000);
      expect(btnJoin.textContent).toBe('⏳ Chờ 45s...');

      // Advance full duration (45 remaining seconds)
      vi.advanceTimersByTime(45000);

      // Should be unlocked automatically
      otpInputs.forEach((inp) => expect(inp.disabled).toBe(false));
      expect(legacyInput.disabled).toBe(false);
      expect(btnJoin.disabled).toBe(false);
      expect(btnJoin.textContent).toBe('Vào phòng thi ➔');
    });
  });
});
