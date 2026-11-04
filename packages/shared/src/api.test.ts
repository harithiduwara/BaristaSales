import { describe, expect, it } from 'vitest';
import { ACTION_ROLES, ERROR_CODES, RETRYABLE_CODES } from './api';

describe('Section 7 contract constants', () => {
  it('7.4 lists every error code', () => expect(ERROR_CODES).toHaveLength(11));
  it('retries only BUSY and INTERNAL', () => expect(RETRYABLE_CODES).toEqual(['BUSY', 'INTERNAL']));
  it('7.3 Owner-only actions', () => {
    expect(ACTION_ROLES['dashboard.summary']).toEqual(['Owner']);
    expect(ACTION_ROLES['config.update']).toEqual(['Owner']);
    expect(ACTION_ROLES['auth.verify']).toBe('none');
  });
});
