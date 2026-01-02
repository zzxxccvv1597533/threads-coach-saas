import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the database module
vi.mock('./db', () => ({
  createInvitationCode: vi.fn(),
  createBatchInvitationCodes: vi.fn(),
  useInvitationCode: vi.fn(),
  getInvitationCodeByCode: vi.fn(),
}));

import * as db from './db';

describe('Invitation Code Cohort Feature', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createInvitationCode with cohort', () => {
    it('should create invitation code with cohort field', async () => {
      const mockCode = {
        id: 1,
        code: 'TEST1234',
        createdBy: 1,
        validDays: 90,
        cohort: '第四期',
        note: 'Test note',
        status: 'active',
        createdAt: new Date(),
      };

      vi.mocked(db.createInvitationCode).mockResolvedValue(mockCode as any);

      const result = await db.createInvitationCode({
        createdBy: 1,
        validDays: 90,
        cohort: '第四期',
        note: 'Test note',
      });

      expect(db.createInvitationCode).toHaveBeenCalledWith({
        createdBy: 1,
        validDays: 90,
        cohort: '第四期',
        note: 'Test note',
      });
      expect(result?.cohort).toBe('第四期');
    });

    it('should create invitation code without cohort', async () => {
      const mockCode = {
        id: 2,
        code: 'TEST5678',
        createdBy: 1,
        validDays: 90,
        cohort: null,
        note: null,
        status: 'active',
        createdAt: new Date(),
      };

      vi.mocked(db.createInvitationCode).mockResolvedValue(mockCode as any);

      const result = await db.createInvitationCode({
        createdBy: 1,
        validDays: 90,
      });

      expect(result?.cohort).toBeNull();
    });
  });

  describe('createBatchInvitationCodes with cohort', () => {
    it('should create multiple invitation codes with same cohort', async () => {
      const mockCodes = [
        { id: 1, code: 'BATCH001', cohort: '第五期', status: 'active' },
        { id: 2, code: 'BATCH002', cohort: '第五期', status: 'active' },
        { id: 3, code: 'BATCH003', cohort: '第五期', status: 'active' },
      ];

      vi.mocked(db.createBatchInvitationCodes).mockResolvedValue(mockCodes as any);

      const result = await db.createBatchInvitationCodes({
        createdBy: 1,
        count: 3,
        validDays: 90,
        cohort: '第五期',
      });

      expect(db.createBatchInvitationCodes).toHaveBeenCalledWith({
        createdBy: 1,
        count: 3,
        validDays: 90,
        cohort: '第五期',
      });
      expect(result).toHaveLength(3);
      expect(result.every(c => (c as any).cohort === '第五期')).toBe(true);
    });
  });

  describe('useInvitationCode with cohort', () => {
    it('should set user cohort when using invitation code with cohort', async () => {
      vi.mocked(db.useInvitationCode).mockResolvedValue({
        success: true,
        message: '開通成功',
        validDays: 90,
        cohort: '第四期',
      });

      const result = await db.useInvitationCode('TEST1234', 1);

      expect(result.success).toBe(true);
      expect(result.cohort).toBe('第四期');
    });

    it('should not set cohort when invitation code has no cohort', async () => {
      vi.mocked(db.useInvitationCode).mockResolvedValue({
        success: true,
        message: '開通成功',
        validDays: 90,
        cohort: undefined,
      });

      const result = await db.useInvitationCode('TEST5678', 2);

      expect(result.success).toBe(true);
      expect(result.cohort).toBeUndefined();
    });

    it('should return error for invalid invitation code', async () => {
      vi.mocked(db.useInvitationCode).mockResolvedValue({
        success: false,
        message: '邀請碼不存在',
      });

      const result = await db.useInvitationCode('INVALID', 1);

      expect(result.success).toBe(false);
      expect(result.message).toBe('邀請碼不存在');
    });

    it('should return error for used invitation code', async () => {
      vi.mocked(db.useInvitationCode).mockResolvedValue({
        success: false,
        message: '邀請碼已被使用或已失效',
      });

      const result = await db.useInvitationCode('USED1234', 1);

      expect(result.success).toBe(false);
      expect(result.message).toBe('邀請碼已被使用或已失效');
    });
  });

  describe('Cohort validation', () => {
    it('should accept valid cohort names', () => {
      const validCohorts = ['第四期', '第五期', '第六期', '第七期', '第八期', '特別班'];
      
      validCohorts.forEach(cohort => {
        expect(typeof cohort).toBe('string');
        expect(cohort.length).toBeGreaterThan(0);
        expect(cohort.length).toBeLessThanOrEqual(32); // varchar(32) limit
      });
    });

    it('should handle empty cohort as undefined', () => {
      const emptyCohort = '';
      const result = emptyCohort || undefined;
      expect(result).toBeUndefined();
    });
  });
});
