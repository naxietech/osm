import { describe, expect, it } from 'vitest';

import { UserRole } from '@oses/types';

import { DEMO_PASSWORD, authService } from './auth.service';

describe('authService.login', () => {
  it('resolves with the matching user + token for valid credentials', async () => {
    const { user, token } = await authService.login('admin@oses.pk', DEMO_PASSWORD);
    expect(user.email).toBe('admin@oses.pk');
    expect(user.role).toBe(UserRole.ADMIN);
    expect(token).toMatch(/^mock\./);
  });

  it('matches each role by email', async () => {
    const evaluator = await authService.login('evaluator@oses.pk', DEMO_PASSWORD);
    expect(evaluator.user.role).toBe(UserRole.EVALUATOR);
    const school = await authService.login('school@oses.pk', DEMO_PASSWORD);
    expect(school.user.role).toBe(UserRole.SCHOOL_STAFF);
  });

  it('is case-insensitive and trims the email', async () => {
    const { user } = await authService.login('  ADMIN@OSES.PK ', DEMO_PASSWORD);
    expect(user.role).toBe(UserRole.ADMIN);
  });

  it('rejects an unknown email', async () => {
    await expect(authService.login('nobody@oses.pk', DEMO_PASSWORD)).rejects.toThrow(
      'Invalid email or password',
    );
  });

  it('rejects a wrong password', async () => {
    await expect(authService.login('admin@oses.pk', 'wrong-password')).rejects.toThrow(
      'Invalid email or password',
    );
  });
});
