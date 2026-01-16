/**
 * 認證路由模組
 * 處理登入、登出、用戶資訊等認證相關功能
 */

import { z } from "zod";
import { getSessionCookieOptions } from "../_core/cookies";
import { publicProcedure, protectedProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import * as db from "../db";

const COOKIE_NAME = "session";

export const authRouter = router({
  me: publicProcedure.query(opts => opts.ctx.user),
  
  // 帳號密碼註冊
  register: publicProcedure
    .input(z.object({
      email: z.string().email("請輸入有效的 Email"),
      password: z.string().min(6, "密碼至少需要 6 個字元"),
      name: z.string().optional(),
      invitationCode: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const bcrypt = await import('bcryptjs');
      
      // 檢查 email 是否已存在
      const existing = await db.getUserByEmail(input.email);
      if (existing) {
        throw new TRPCError({ code: 'CONFLICT', message: '此 Email 已被註冊' });
      }
      
      // 加密密碼
      const hashedPassword = await bcrypt.hash(input.password, 10);
      
      // 檢查邀請碼
      let invitationCodeId: number | undefined;
      let invitationBonusDays: number | undefined;
      
      if (input.invitationCode) {
        const invitation = await db.getInvitationCodeByCode(input.invitationCode);
        if (!invitation) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: '邀請碼不存在' });
        }
        if (invitation.status !== 'active') {
          throw new TRPCError({ code: 'BAD_REQUEST', message: '邀請碼已使用或已過期' });
        }
        
        // 記錄邀請碼額度，但不自動開通，等待管理員審核
        invitationCodeId = invitation.id;
        invitationBonusDays = invitation.validDays;
      }
      
      // 建立用戶（預設待開通狀態）
      const user = await db.createUserWithPassword({
        email: input.email,
        password: hashedPassword,
        name: input.name,
        activationStatus: 'pending',
        invitationCodeId,
        invitationBonusDays,
      });
      
      if (!user) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: '註冊失敗' });
      }
      
      // 如果使用了邀請碼，標記為已使用
      if (input.invitationCode) {
        await db.useInvitationCode(input.invitationCode, user.id);
      }
      
      // 建立 session
      const { sdk } = await import('../_core/sdk');
      const sessionToken = await sdk.createSessionTokenForEmail(user.email, {
        name: user.name || '',
        expiresInMs: 365 * 24 * 60 * 60 * 1000, // 1 year
      });
      
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: 365 * 24 * 60 * 60 * 1000 });
      
      return { success: true, user: { id: user.id, email: user.email, name: user.name } };
    }),
  
  // 帳號密碼登入
  login: publicProcedure
    .input(z.object({
      email: z.string().email("請輸入有效的 Email"),
      password: z.string().min(1, "請輸入密碼"),
    }))
    .mutation(async ({ ctx, input }) => {
      const bcrypt = await import('bcryptjs');
      
      // 查找用戶
      const user = await db.getUserByEmail(input.email);
      if (!user) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Email 或密碼錯誤' });
      }
      
      // 驗證密碼
      if (!user.password) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: '此帳號使用第三方登入，請使用其他方式登入' });
      }
      
      const isValid = await bcrypt.compare(input.password, user.password);
      if (!isValid) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Email 或密碼錯誤' });
      }
      
      // 更新最後登入時間
      await db.upsertUser({ email: user.email, lastSignedIn: new Date() });
      
      // 建立 session
      const { sdk } = await import('../_core/sdk');
      const sessionToken = await sdk.createSessionTokenForEmail(user.email, {
        name: user.name || '',
        expiresInMs: 365 * 24 * 60 * 60 * 1000, // 1 year
      });
      
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: 365 * 24 * 60 * 60 * 1000 });
      
      return { success: true, user: { id: user.id, email: user.email, name: user.name, role: user.role } };
    }),
  
  logout: publicProcedure.mutation(({ ctx }) => {
    const cookieOptions = getSessionCookieOptions(ctx.req);
    ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
    return { success: true } as const;
  }),
  
  // 補輸入邀請碼（已註冊但未開通的用戶）
  applyInvitationCode: protectedProcedure
    .input(z.object({ code: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // 檢查用戶是否已開通
      if (ctx.user.activationStatus === 'activated') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: '您的帳號已經開通' });
      }
      
      // 驗證並使用邀請碼
      const result = await db.useInvitationCode(input.code, ctx.user.id);
      if (!result.success) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: result.message || '邀請碼無效' });
      }
      
      return { success: true, message: '帳號已成功開通' };
    }),
});
