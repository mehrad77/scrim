import { describe, expect, it } from 'vitest';
import { codeInUse, expiryDecision, IDLE_EXPIRY_MS, KEEP_MS } from './expiry.js';

const DAY = 24 * 60 * 60 * 1000;

describe('room expiry', () => {
  it('deletes an idle ordinary room, and waits while anything is connected', () => {
    expect(expiryDecision({ createdAt: 0 }, IDLE_EXPIRY_MS, 0).action).toBe('delete');
    expect(expiryDecision({ createdAt: 0 }, IDLE_EXPIRY_MS, 2)).toEqual({
      action: 'wait',
      next: 2 * IDLE_EXPIRY_MS,
    });
  });

  it('keeps a kept room’s code for 90 days after it was last used, clearing its data', () => {
    const room = { createdAt: 0, lastSeenAt: 10 * DAY, keep: true };
    expect(expiryDecision(room, 11 * DAY, 0)).toEqual({
      action: 'clear',
      next: 10 * DAY + KEEP_MS,
    });
    expect(expiryDecision(room, 10 * DAY + KEEP_MS, 0).action).toBe('delete');
  });

  it('never gives away a code that is kept, connected or used today', () => {
    expect(codeInUse(null, 0, 0)).toBe(false);
    // Made two days ago but used an hour ago: in use (it was given away before).
    expect(codeInUse({ createdAt: 0, lastSeenAt: 2 * DAY - 3600_000 }, 2 * DAY, 0)).toBe(true);
    expect(codeInUse({ createdAt: 0, lastSeenAt: 0 }, 2 * DAY, 0)).toBe(false);
    expect(codeInUse({ createdAt: 0, keep: true }, 400 * DAY, 0)).toBe(true);
    expect(codeInUse({ createdAt: 0 }, 2 * DAY, 1)).toBe(true);
  });
});
