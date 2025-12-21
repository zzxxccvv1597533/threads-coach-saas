import { COOKIE_NAME } from "@shared/const";
import { z } from "zod";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { invokeLLM } from "./_core/llm";
import * as db from "./db";
import { KNOWLEDGE_BASE, SYSTEM_PROMPTS, CONTENT_TYPES_WITH_VIRAL_ELEMENTS, FORBIDDEN_PHRASES, THREADS_STYLE_GUIDE, FOUR_LENS_FRAMEWORK } from "../shared/knowledge-base";

// Admin procedure
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== 'admin') {
    throw new TRPCError({ code: 'FORBIDDEN', message: '需要管理員權限' });
  }
  return next({ ctx });
});

export const appRouter = router({
  system: systemRouter,
  
  // ==================== 認證相關 ====================
  auth: router({
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
        const { sdk } = await import('./_core/sdk');
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
        const { sdk } = await import('./_core/sdk');
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
  }),

  // ==================== IP 地基模組 ====================
  ipProfile: router({
    get: protectedProcedure.query(async ({ ctx }) => {
      const profile = await db.getIpProfileByUserId(ctx.user.id);
      return profile ?? null;
    }),
    
    upsert: protectedProcedure
      .input(z.object({
        occupation: z.string().optional(),
        voiceTone: z.string().optional(),
        viewpointStatement: z.string().optional(),
        goalPrimary: z.enum(["monetize", "influence", "expression"]).optional(),
        personaExpertise: z.string().optional(),
        personaEmotion: z.string().optional(),
        personaViewpoint: z.string().optional(),
        // 英雄旅程四階段
        heroJourneyOrigin: z.string().optional(),
        heroJourneyProcess: z.string().optional(),
        heroJourneyHero: z.string().optional(),
        heroJourneyMission: z.string().optional(),
        // 身份標籤
        identityTags: z.array(z.string()).optional(),
        // 九宮格內容矩陣
        contentMatrixAudiences: z.object({
          core: z.string(),
          potential: z.string(),
          opportunity: z.string(),
        }).optional(),
        contentMatrixThemes: z.array(z.string()).optional(),
        ipAnalysisComplete: z.boolean().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        return db.upsertIpProfile({ userId: ctx.user.id, ...input });
      }),
    
    createVersion: protectedProcedure
      .input(z.object({ note: z.string().optional() }))
      .mutation(async ({ ctx, input }) => {
        const profile = await db.getIpProfileByUserId(ctx.user.id);
        if (!profile) throw new TRPCError({ code: 'NOT_FOUND' });
        await db.createIpProfileVersion(profile.id, input.note);
        return { success: true };
      }),
    
    // 生成痛點矩陣
    generatePainPointMatrix: protectedProcedure
      .input(z.object({
        audiences: z.array(z.string()),
        themes: z.array(z.string()),
        occupation: z.string().optional(),
        voiceTone: z.string().optional(),
        viewpoint: z.string().optional(),
        identityTags: z.array(z.string()).optional(),
        contentPillars: z.object({
          authority: z.string().optional(),
          emotion: z.string().optional(),
          uniqueness: z.string().optional(),
        }).optional(),
        heroJourney: z.object({
          origin: z.string().optional(),
          process: z.string().optional(),
          hero: z.string().optional(),
          mission: z.string().optional(),
        }).optional(),
        products: z.array(z.object({
          name: z.string(),
          type: z.string(),
          description: z.string().optional(),
        })).optional(),
      }))
      .mutation(async ({ input }) => {
        const { audiences, themes, occupation, voiceTone, viewpoint, identityTags, contentPillars, heroJourney, products } = input;
        
        // 提取受眾名稱（去除括號內的痛點描述）
        const cleanAudiences = audiences.map(a => {
          // 如果包含括號，只取括號前的名稱
          const match = a.match(/^([^\uff08\(]+)/);
          return match ? match[1].trim() : a.trim();
        });
        
        // 建構 IP 地基資訊
        let ipContext = '';
        if (occupation) ipContext += `職業/身份：${occupation}\n`;
        if (voiceTone) ipContext += `語氣風格：${voiceTone}\n`;
        if (viewpoint) ipContext += `觀點宣言：${viewpoint}\n`;
        if (identityTags && identityTags.length > 0) ipContext += `身份標籤：${identityTags.join('、')}\n`;
        if (contentPillars) {
          if (contentPillars.authority) ipContext += `專業權威：${contentPillars.authority}\n`;
          if (contentPillars.emotion) ipContext += `情感共鳴：${contentPillars.emotion}\n`;
          if (contentPillars.uniqueness) ipContext += `獨特觀點：${contentPillars.uniqueness}\n`;
        }
        if (heroJourney) {
          if (heroJourney.origin) ipContext += `我的故事-緣起：${heroJourney.origin}\n`;
          if (heroJourney.process) ipContext += `我的故事-過程：${heroJourney.process}\n`;
          if (heroJourney.hero) ipContext += `我的故事-轉折：${heroJourney.hero}\n`;
          if (heroJourney.mission) ipContext += `我的故事-使命：${heroJourney.mission}\n`;
        }
        if (products && products.length > 0) {
          ipContext += `產品/服務：${products.map(p => p.name).join('、')}\n`;
        }
        
        const prompt = `你是一位 Threads 內容策略專家。請根據以下創作者資訊和受眾資訊，生成精準的痛點矩陣。

=== 創作者 IP 地基 ===
${ipContext || '未設定'}

=== 受眾分層 ===
${cleanAudiences.map((a, i) => `${i + 1}. ${a}`).join('\n')}

=== 內容主題 ===
${themes.map((t, i) => `${i + 1}. ${t}`).join('\n')}

=== 任務 ===
請為每個「受眾 × 主題」的組合，生成 2-3 個「受眾會說的一句話」。

這些話必須：
1. 是受眾在日常生活中真的會說出口的話
2. 用第一人稱「我」來表達
3. 帶有情緒（困惑、焦慮、無奈、期待等）
4. 可以直接作為發文的開頭 Hook
5. 符合創作者的專業領域

範例（請根據創作者領域調整）：
- 「貓咪一直亂尿床，是不是討厭我？」
- 「我明明很努力了，為什麼還是沒有效果？」
- 「每次想開口說，又怕被笑」
- 「我到底適不適合做這行？」
- 「為什麼別人都可以，只有我不行？」
- 「我是不是想太多了？」

=== 輸出格式 ===
請用 JSON 格式回應，受眾名稱必須完全匹配以下名稱：
${cleanAudiences.map(a => `- "${a}"`).join('\n')}

結構如下：
{
  "${cleanAudiences[0] || '受眾1'}": {
    "${themes[0] || '主題1'}": ["受眾會說的話1", "受眾會說的話2"],
    "${themes[1] || '主題2'}": ["受眾會說的話1", "受眾會說的話2"]
  }
}

只輸出 JSON，不要其他文字。`;

        const response = await invokeLLM({
          messages: [
            { role: "system", content: "你是一位專業的內容策略專家，擅長分析受眾痛點並生成內容選題。" },
            { role: "user", content: prompt }
          ],
        });

        const rawContent = response.choices[0]?.message?.content;
        const content = typeof rawContent === 'string' ? rawContent : '{}';
        
        // 解析 JSON
        try {
          // 移除可能的 markdown 標記
          const cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
          const matrix = JSON.parse(cleanContent);
          return { matrix };
        } catch {
          // 如果解析失敗，返回空矩陣
          return { matrix: {} };
        }
      }),
    
    // 生成子主題選項
    generateSubTopics: protectedProcedure
      .input(z.object({
        audiences: z.array(z.string()),
        occupation: z.string().optional(),
        voiceTone: z.string().optional(),
        contentPillars: z.object({
          authority: z.string().optional(),
          emotion: z.string().optional(),
          uniqueness: z.string().optional(),
        }).optional(),
        heroJourney: z.object({
          origin: z.string().optional(),
          process: z.string().optional(),
          hero: z.string().optional(),
          mission: z.string().optional(),
        }).optional(),
        products: z.array(z.object({
          name: z.string(),
          type: z.string(),
          description: z.string().optional(),
        })).optional(),
      }))
      .mutation(async ({ input }) => {
        const { audiences, occupation, voiceTone, contentPillars, heroJourney, products } = input;
        
        // 建構 IP 地基資訊
        let ipContext = '';
        if (occupation) ipContext += `職業/身份：${occupation}\n`;
        if (voiceTone) ipContext += `語氣風格：${voiceTone}\n`;
        if (contentPillars) {
          if (contentPillars.authority) ipContext += `專業權威：${contentPillars.authority}\n`;
          if (contentPillars.emotion) ipContext += `情感共鳴：${contentPillars.emotion}\n`;
          if (contentPillars.uniqueness) ipContext += `獨特觀點：${contentPillars.uniqueness}\n`;
        }
        if (heroJourney) {
          if (heroJourney.origin) ipContext += `我的故事-緣起：${heroJourney.origin}\n`;
          if (heroJourney.process) ipContext += `我的故事-過程：${heroJourney.process}\n`;
          if (heroJourney.hero) ipContext += `我的故事-轉折：${heroJourney.hero}\n`;
          if (heroJourney.mission) ipContext += `我的故事-使命：${heroJourney.mission}\n`;
        }
        if (products && products.length > 0) {
          ipContext += `產品/服務：${products.map(p => p.name).join('、')}\n`;
        }
        
        const prompt = `你是一位 Threads 內容策略專家。請根據以下創作者資訊和受眾資訊，生成 5 個適合的內容子主題。

=== 創作者 IP 地基 ===
${ipContext || '未設定'}

=== 目標受眾 ===
${audiences.join('、')}

=== 任務 ===
請生成 5 個內容子主題，這些主題必須：
1. 符合創作者的專業領域
2. 能夠觸動目標受眾的痛點
3. 有足夠的內容發展空間
4. 具體且可執行

範例（請根據創作者領域調整）：
- 塔羅師：感情解讀、事業方向、自我探索、日常灵感、個案故事
- 健身教練：新手入門、飲食建議、常見迷思、訓練心法、成功案例
- 心理諮商師：親密關係、自我療癒、情緒管理、原生家庽誰、日常觀察

=== 輸出格式 ===
請用 JSON 格式回應：
{
  "topics": [
    { "name": "主題名稱", "description": "這個主題可以寫什麼內容" },
    ...
  ]
}

只輸出 JSON，不要其他文字。`;

        const response = await invokeLLM({
          messages: [
            { role: "system", content: "你是一位專業的內容策略專家，擅長分析受眾痛點並生成內容選題。" },
            { role: "user", content: prompt }
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "topics_response",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  topics: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        name: { type: "string", description: "主題名稱" },
                        description: { type: "string", description: "主題說明" }
                      },
                      required: ["name", "description"],
                      additionalProperties: false
                    }
                  }
                },
                required: ["topics"],
                additionalProperties: false
              }
            }
          }
        });

        const rawContent = response.choices[0]?.message?.content;
        const content = typeof rawContent === 'string' ? rawContent : '{}';
        
        try {
          const result = JSON.parse(content);
          return { topics: result.topics || [] };
        } catch {
          return { topics: [] };
        }
      }),
  }),

  // ==================== 受眾分析 ====================
  audience: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const segments = await db.getAudienceSegmentsByUserId(ctx.user.id);
      return segments ?? [];
    }),
    
    create: protectedProcedure
      .input(z.object({
        segmentName: z.string(),
        painPoint: z.string().optional(),
        desiredOutcome: z.string().optional(),
        priority: z.number().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        return db.createAudienceSegment({ userId: ctx.user.id, ...input });
      }),
    
    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        segmentName: z.string().optional(),
        painPoint: z.string().optional(),
        desiredOutcome: z.string().optional(),
        priority: z.number().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { id, ...data } = input;
        await db.updateAudienceSegment(id, data);
        return { success: true };
      }),
    
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteAudienceSegment(input.id);
        return { success: true };
      }),
  }),

  // ==================== 內容支柱 ====================
  contentPillar: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const pillars = await db.getContentPillarsByUserId(ctx.user.id);
      return pillars ?? [];
    }),
    
    create: protectedProcedure
      .input(z.object({
        title: z.string(),
        description: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        return db.createContentPillar({ userId: ctx.user.id, ...input });
      }),
    
    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        title: z.string().optional(),
        description: z.string().optional(),
        isActive: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await db.updateContentPillar(id, data);
        return { success: true };
      }),
    
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteContentPillar(input.id);
        return { success: true };
      }),
  }),

  // ==================== 草稿管理 ====================
  draft: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const drafts = await db.getDraftsByUserId(ctx.user.id);
      return drafts ?? [];
    }),

    // 內容類型統計
    contentTypeStats: protectedProcedure.query(async ({ ctx }) => {
      const stats = await db.getContentTypeStats(ctx.user.id);
      return stats;
    }),
    
    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const draft = await db.getDraftById(input.id);
        if (!draft) throw new TRPCError({ code: 'NOT_FOUND' });
        const hooks = await db.getHooksByDraftId(input.id);
        return { draft, hooks };
      }),
    
    create: protectedProcedure
      .input(z.object({
        contentType: z.enum(["knowledge", "summary", "story", "viewpoint", "contrast", "casual", "dialogue", "question", "poll", "quote"]),
        title: z.string().optional(),
        body: z.string().optional(),
        cta: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        return db.createDraft({ userId: ctx.user.id, ...input });
      }),
    
    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        title: z.string().optional(),
        body: z.string().optional(),
        cta: z.string().optional(),
        status: z.enum(["draft", "published", "archived"]).optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await db.updateDraft(id, data);
        return { success: true };
      }),
    
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteDraft(input.id);
        return { success: true };
      }),
    
    selectHook: protectedProcedure
      .input(z.object({ hookId: z.number(), draftId: z.number() }))
      .mutation(async ({ input }) => {
        await db.selectHook(input.hookId, input.draftId);
        return { success: true };
      }),

    // 串文格式化 - 將長文分割成多段
    convertToThread: protectedProcedure
      .input(z.object({ content: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const response = await invokeLLM({
          messages: [
            { role: "system", content: `你是一個專業的 Threads 串文分割專家。

串文規則：
1. 每段最多 500 字（Threads 限制）
2. 每段都要能獨立閱讀，但又要能連貫
3. 第一段是 Hook，要能吸引人點開
4. 每段結尾可以留懸念，讓人想看下一段
5. 最後一段是總結和 CTA

輸出格式：
用 "---" 分隔每段串文，不要加編號或標題。` },
            { role: "user", content: `請將以下內容轉換成 Threads 串文格式：

${input.content}` }
          ],
        });

        await db.logApiUsage(ctx.user.id, 'convertToThread', 'llm', 500, 600);
        
        const threadContent = response.choices[0]?.message?.content || '';
        const threads = typeof threadContent === 'string' 
          ? threadContent.split('---').map((t: string) => t.trim()).filter((t: string) => t.length > 0)
          : [];
        
        return {
          threads,
          totalParts: threads.length,
        };
      }),

    // Hook 優化器 - 生成多個開頭選項
    generateHooks: protectedProcedure
      .input(z.object({ content: z.string(), count: z.number().optional() }))
      .mutation(async ({ ctx, input }) => {
        const profile = await db.getIpProfileByUserId(ctx.user.id);
        const hookCount = input.count || 5;
        
        const response = await invokeLLM({
          messages: [
            { role: "system", content: `你是一個專業的 Threads Hook 寫手。

## Hook 三大策略
1. 鏡像策略：讓讀者看到自己（「你是不是也...」「有沒有一種感覺...」）
2. 反差策略：打破認知（「很多人以為...但其實...」「我曾經也...」）
3. 解法策略：提供方法（「教你一個方法...」「這個技巧讓我...」）

## 創作者資料
- 職業：${profile?.occupation || '未設定'}
- 語氣風格：${profile?.voiceTone || '未設定'}

## 輸出格式
請生成 ${hookCount} 個不同風格的 Hook，每個都要：
1. 簡短有力（一兩句話）
2. 讓人想繼續看
3. 符合創作者風格

用 "---" 分隔每個 Hook，不要加編號或標題。` },
            { role: "user", content: `請為以下內容生成 ${hookCount} 個不同的開頭：

${input.content}` }
          ],
        });

        await db.logApiUsage(ctx.user.id, 'generateHooks', 'llm', 400, 500);
        
        const hookContent = response.choices[0]?.message?.content || '';
        const hooks = typeof hookContent === 'string'
          ? hookContent.split('---').map((h: string) => h.trim()).filter((h: string) => h.length > 0)
          : [];
        
        return {
          hooks,
        };
      }),

    // 結尾互動 CTA 生成器
    generateCTA: protectedProcedure
      .input(z.object({ content: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const profile = await db.getIpProfileByUserId(ctx.user.id);
        
        const response = await invokeLLM({
          messages: [
            { role: "system", content: `你是一個專業的 Threads CTA 寫手。

## CTA 原則
1. 軟性引導：不要像廣告，要像朋友分享
2. 引導留言優先：「你覺得呢？」「你有過這種經驗嗎？」
3. 避免硬銷：不要「快來購買」「立即預約」
4. 創造對話感：讓讀者想回應

## 創作者資料
- 職業：${profile?.occupation || '未設定'}
- 語氣風格：${profile?.voiceTone || '未設定'}

## 輸出格式
請生成 3 個不同風格的 CTA，每個都要：
1. 簡短有力（一兩句話）
2. 讓人想留言或互動
3. 符合創作者風格

用 "---" 分隔每個 CTA，不要加編號或標題。` },
            { role: "user", content: `請為以下內容生成 3 個不同的結尾互動引導：

${input.content}` }
          ],
        });

        await db.logApiUsage(ctx.user.id, 'generateCTA', 'llm', 300, 400);
        
        const ctaContent = response.choices[0]?.message?.content || '';
        const ctas = typeof ctaContent === 'string'
          ? ctaContent.split('---').map((c: string) => c.trim()).filter((c: string) => c.length > 0)
          : [];
        
        return { ctas };
      }),

    // 加入 Emoji 潤飾
    addEmoji: protectedProcedure
      .input(z.object({ content: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const response = await invokeLLM({
          messages: [
            { role: "system", content: `你是一個專業的 Threads 文案潤飾師。

## Emoji 使用原則
1. 適度使用：不要太多，每段最多 1-2 個
2. 放在重點：強調情緒或重要訊息
3. 符合語境：選擇與內容情緒相符的 Emoji
4. 不要幼稚：避免過於可愛或幼稚的 Emoji

## 常用 Emoji 分類
- 情緒：😊 😢 😤 🤔 💪
- 強調：✨ 🔥 💡 ❤️ 🌟
- 指引：👇 👉 ☝️
- 列點：✅ ❌ 📌

## 輸出格式
直接輸出加入 Emoji 後的完整文案，不要加任何說明。
不要加入任何 Markdown 格式符號，保持純文字格式。` },
            { role: "user", content: `請為以下文案適度加入 Emoji，並移除所有 Markdown 格式符號：

${input.content}` }
          ],
        });

        await db.logApiUsage(ctx.user.id, 'addEmoji', 'llm', 400, 500);
        
        let result = response.choices[0]?.message?.content || input.content;
        
        // 清理 Markdown 符號
        if (typeof result === 'string') {
          result = result
            .replace(/\*\*/g, '') // 移除粗體符號
            .replace(/\*/g, '')   // 移除斜體符號
            .replace(/^#+\s/gm, '') // 移除標題符號
            .replace(/`/g, '');    // 移除代碼符號
        }
        
        return { content: typeof result === 'string' ? result : input.content };
      }),
  }),

  // ==================== AI 功能 ====================
  ai: router({
    // 腦力激盪（沒靈感時）- 強化版
    brainstorm: protectedProcedure
      .input(z.object({
        pillarId: z.number().optional(),
        topic: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const profile = await db.getIpProfileByUserId(ctx.user.id);
        const audiences = await db.getAudienceSegmentsByUserId(ctx.user.id);
        const products = await db.getUserProductsByUserId(ctx.user.id);
        
        // 建構完整的 IP 地基資訊
        let ipContext = '';
        if (profile?.occupation) ipContext += `職業/身份：${profile.occupation}\n`;
        if (profile?.voiceTone) ipContext += `語氣風格：${profile.voiceTone}\n`;
        if (profile?.viewpointStatement) ipContext += `觀點宣言：${profile.viewpointStatement}\n`;
        if (profile?.identityTags && (profile.identityTags as string[]).length > 0) {
          ipContext += `身份標籤：${(profile.identityTags as string[]).join('、')}\n`;
        }
        
        // 人設三支柱
        if (profile?.personaExpertise || profile?.personaEmotion || profile?.personaViewpoint) {
          ipContext += `\n【人設三支柱】\n`;
          if (profile.personaExpertise) ipContext += `專業權威：${profile.personaExpertise}\n`;
          if (profile.personaEmotion) ipContext += `情感共鳴：${profile.personaEmotion}\n`;
          if (profile.personaViewpoint) ipContext += `獨特觀點：${profile.personaViewpoint}\n`;
        }
        
        // 英雄旅程
        if (profile?.heroJourneyOrigin || profile?.heroJourneyProcess || profile?.heroJourneyHero || profile?.heroJourneyMission) {
          ipContext += `\n【我的故事】\n`;
          if (profile.heroJourneyOrigin) ipContext += `緣起：${profile.heroJourneyOrigin}\n`;
          if (profile.heroJourneyProcess) ipContext += `過程：${profile.heroJourneyProcess}\n`;
          if (profile.heroJourneyHero) ipContext += `轉折：${profile.heroJourneyHero}\n`;
          if (profile.heroJourneyMission) ipContext += `使命：${profile.heroJourneyMission}\n`;
        }
        
        // 受眾資訊
        let audienceContext = '';
        if (audiences && audiences.length > 0) {
          audienceContext = audiences.map(a => 
            `- ${a.segmentName}：痛點是「${a.painPoint || '未設定'}」，渴望「${a.desiredOutcome || '未設定'}」`
          ).join('\n');
        }
        
        // 產品資訊
        const coreProduct = products?.find(p => p.productType === 'core');
        
        const systemPrompt = `${SYSTEM_PROMPTS.contentGeneration}

=== 創作者 IP 地基（必須參考） ===
${ipContext || '未設定'}

=== 目標受眾（必須針對他們的痛點） ===
${audienceContext || '未設定'}

=== 產品服務 ===
${coreProduct ? `核心產品：${coreProduct.name}` : '未設定'}

=== 重要指示 ===
1. 主題必須與創作者的專業領域相關
2. 主題必須能觸動目標受眾的痛點
3. 建議的內容類型要符合主題特性
4. 每個主題都要能展現創作者的人設`;

        const response = await invokeLLM({
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: `請根據我的 IP 地基和受眾，給我5個今天可以發的貼文主題建議。${input.topic ? `參考方向：${input.topic}` : ''}

請用 JSON 格式回覆：
{
  "topics": [
    {
      "title": "主題名稱",
      "audience": "適合哪一群人",
      "contentType": "story",
      "hook": "一句讓人想繼續看的開頭"
    }
  ]
}

contentType 可選值：knowledge(知識型), summary(懶人包), story(故事型), viewpoint(觀點型), contrast(反差型), casual(日常閃文), dialogue(對話型), question(提問型), poll(投票型), quote(金句型)

每個主題都要與我的專業領域和受眾痛點相關。只輸出 JSON，不要其他文字。` }
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "brainstorm_response",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  topics: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        title: { type: "string", description: "主題名稱" },
                        audience: { type: "string", description: "適合受眾" },
                        contentType: { type: "string", description: "內容類型" },
                        hook: { type: "string", description: "開頭示範" }
                      },
                      required: ["title", "audience", "contentType", "hook"],
                      additionalProperties: false
                    }
                  }
                },
                required: ["topics"],
                additionalProperties: false
              }
            }
          }
        });

        await db.logApiUsage(ctx.user.id, 'brainstorm', 'llm', 500, 300);
        
        // 解析 JSON 回應
        let topicsData: { topics: Array<{ title: string; audience: string; contentType: string; hook: string }> } = { topics: [] };
        try {
          const rawContent = response.choices[0]?.message?.content;
          const content = typeof rawContent === 'string' ? rawContent : '{}';
          topicsData = JSON.parse(content);
        } catch (e) {
          console.error('Failed to parse brainstorm JSON:', e);
        }
        
        return {
          suggestions: topicsData.topics || [],
        };
      }),

    // 切角分析（有靈感時）- 優化版
    analyzeAngles: protectedProcedure
      .input(z.object({
        material: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        const profile = await db.getIpProfileByUserId(ctx.user.id);
        const audiences = await db.getAudienceSegmentsByUserId(ctx.user.id);
        
        // 建構 IP 地基資訊
        let ipContext = '';
        if (profile?.occupation) ipContext += `職業/身份：${profile.occupation}\n`;
        if (profile?.voiceTone) ipContext += `語氣風格：${profile.voiceTone}\n`;
        if (profile?.viewpointStatement) ipContext += `觀點宣言：${profile.viewpointStatement}\n`;
        if (profile?.personaExpertise) ipContext += `專業權威：${profile.personaExpertise}\n`;
        if (profile?.personaEmotion) ipContext += `情感共鳴：${profile.personaEmotion}\n`;
        if (profile?.personaViewpoint) ipContext += `獨特觀點：${profile.personaViewpoint}\n`;
        
        // 受眾資訊
        let audienceContext = '';
        if (audiences && audiences.length > 0) {
          audienceContext = audiences.map(a => 
            `- ${a.segmentName}：痛點是「${a.painPoint || '未設定'}」`
          ).join('\n');
        }
        
        const systemPrompt = `${SYSTEM_PROMPTS.contentGeneration}

=== 創作者 IP 地基 ===
${ipContext || '未設定'}

=== 目標受眾 ===
${audienceContext || '未設定'}

=== 重要指示 ===
1. 切角必須符合創作者的人設和專業
2. 切角必須能觸動目標受眾
3. 開頭示範要簡潔有力，讓人想繼續看`;

        const response = await invokeLLM({
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: `我有一個素材想發文：「${input.material}」

請幫我用 3 個不同的切角來發展這個素材。

請用以下 JSON 格式回覆（只輸出 JSON，不要其他文字）：

{
  "angles": [
    {
      "name": "故事型",
      "type": "story",
      "description": "用個人經歷或案例故事帶出觀點",
      "hook": "昨天有個案主跟我說...",
      "cta": "你有過這種經驗嗎？"
    },
    {
      "name": "觀點型",
      "type": "viewpoint",
      "description": "直接表達立場和看法",
      "hook": "我認為...",
      "cta": "你們怎麼看？"
    },
    {
      "name": "提問型",
      "type": "question",
      "description": "拋出問題引發討論",
      "hook": "你有沒有想過...",
      "cta": "想聽聽大家的看法"
    }
  ]
}

注意：
1. 每個切角的 hook 要簡潔有力，讓人想繼續看
2. description 要說明這個切角的特色
3. 切角要符合創作者的人設和受眾痛點` }
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "angles_response",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  angles: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        name: { type: "string", description: "切角名稱" },
                        type: { type: "string", description: "切角類型" },
                        description: { type: "string", description: "切角說明" },
                        hook: { type: "string", description: "開頭示範" },
                        cta: { type: "string", description: "互動引導" }
                      },
                      required: ["name", "type", "description", "hook", "cta"],
                      additionalProperties: false
                    }
                  }
                },
                required: ["angles"],
                additionalProperties: false
              }
            }
          }
        });

        await db.logApiUsage(ctx.user.id, 'analyzeAngles', 'llm', 400, 500);
        
        // 解析 JSON 回應
        let anglesData: { angles: Array<{ name: string; type: string; description: string; hook: string; cta: string }> } = { angles: [] };
        try {
          const rawContent = response.choices[0]?.message?.content;
          const content = typeof rawContent === 'string' ? rawContent : '{}';
          anglesData = JSON.parse(content);
        } catch (e) {
          console.error('Failed to parse angles JSON:', e);
        }
        
        return {
          angles: anglesData.angles || [],
        };
      }),

    // 生成 Hook 選項（先 Hook 再全文）
    generateHooks: protectedProcedure
      .input(z.object({
        contentType: z.string(),
        topic: z.string(),
        hookStyle: z.string().optional(), // 指定的 Hook 風格
        // 專屬輸入欄位（根據類型不同）
        inputs: z.record(z.string(), z.string()).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const profile = await db.getIpProfileByUserId(ctx.user.id);
        const audiences = await db.getAudienceSegmentsByUserId(ctx.user.id);
        
        // 建構 IP 地基資訊
        let ipContext = '';
        if (profile?.occupation) ipContext += `職業/身份：${profile.occupation}\n`;
        if (profile?.voiceTone) ipContext += `語氣風格：${profile.voiceTone}\n`;
        if (profile?.personaExpertise) ipContext += `專業權威：${profile.personaExpertise}\n`;
        if (profile?.personaEmotion) ipContext += `情感共鳴：${profile.personaEmotion}\n`;
        if (profile?.personaViewpoint) ipContext += `獨特觀點：${profile.personaViewpoint}\n`;
        
        // 受眾資訊
        let audienceContext = '';
        if (audiences && audiences.length > 0) {
          audienceContext = audiences.map(a => 
            `- ${a.segmentName}：痛點是「${a.painPoint || '未設定'}」`
          ).join('\n');
        }
        
        // Hook 風格說明
        const hookStyleGuide: Record<string, string> = {
          mirror: '鏡像開頭：直接說出受眾的心聲，讓他們覺得「這就是在說我」。例：「你是不是也常常...」',
          contrast: '反差開頭：打破預期的陳述，製造認知衝突。例：「很多人以為...但其實...」',
          scene: '場景開頭：描繪具體畫面，讓讀者身歷其境。例：「昨天晚上，我坐在電腦前...」',
          question: '提問開頭：直接拋出問題，引發讀者思考。例：「你有沒有想過...」',
          data: '數據開頭：用數字吸引注意，建立權威感。例：「90%的人都不知道...」',
          dialogue: '對話開頭：用真實對話開場，增加真實感。例：「「你怎麼知道...」朋友問我。」',
        };
        
        const selectedStyle = input.hookStyle ? hookStyleGuide[input.hookStyle] : '請給出多種不同風格的 Hook';
        
        const systemPrompt = `${SYSTEM_PROMPTS.contentGeneration}

=== 創作者 IP 地基 ===
${ipContext || '未設定'}

=== 目標受眾 ===
${audienceContext || '未設定'}

=== Hook 風格指南 ===
${selectedStyle}

=== 重要指示 ===
1. 每個 Hook 不超過 30 字
2. Hook 要能讓人停下來想繼續看
3. 符合創作者的語氣風格
4. 針對受眾的痛點`;

        const response = await invokeLLM({
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: `請為以下主題生成 5 個不同的 Hook（開頭）：

主題：${input.topic}
貼文類型：${input.contentType}
補充資訊：${JSON.stringify(input.inputs || {})}

請用以下 JSON 格式回覆（只輸出 JSON，不要其他文字）：

{
  "hooks": [
    {
      "style": "mirror",
      "styleName": "鏡像式",
      "content": "你是不是也常常...",
      "reason": "這個開頭能讓受眾立刻產生共鳴"
    }
  ]
}` }
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "hooks_response",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  hooks: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        style: { type: "string", description: "Hook 風格 ID" },
                        styleName: { type: "string", description: "Hook 風格名稱" },
                        content: { type: "string", description: "Hook 內容" },
                        reason: { type: "string", description: "為什麼這個 Hook 有效" }
                      },
                      required: ["style", "styleName", "content", "reason"],
                      additionalProperties: false
                    }
                  }
                },
                required: ["hooks"],
                additionalProperties: false
              }
            }
          }
        });

        await db.logApiUsage(ctx.user.id, 'generateHooks', 'llm', 300, 400);
        
        let hooksData: { hooks: Array<{ style: string; styleName: string; content: string; reason: string }> } = { hooks: [] };
        try {
          const rawContent = response.choices[0]?.message?.content;
          const content = typeof rawContent === 'string' ? rawContent : '{}';
          hooksData = JSON.parse(content);
        } catch (e) {
          console.error('Failed to parse hooks JSON:', e);
        }
        
        return {
          hooks: hooksData.hooks || [],
        };
      }),

    // 生成草稿 - 靈活化版本
    generateDraft: protectedProcedure
      .input(z.object({
        material: z.string().optional(),
        contentType: z.string(),
        angle: z.string().optional(),
        // 靈活化輸入欄位
        flexibleInput: z.object({
          topic: z.string().optional(),
          stance: z.string().optional(),
          reason: z.string().optional(),
          common_belief: z.string().optional(),
          truth: z.string().optional(),
          question: z.string().optional(),
          context: z.string().optional(),
          quote: z.string().optional(),
          reflection: z.string().optional(),
          options: z.array(z.string()).optional(),
          count: z.string().optional(),
        }).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const profile = await db.getIpProfileByUserId(ctx.user.id);
        const audiences = await db.getAudienceSegmentsByUserId(ctx.user.id);
        const contentPillars = await db.getContentPillarsByUserId(ctx.user.id);
        
        const contentTypeInfo = CONTENT_TYPES_WITH_VIRAL_ELEMENTS.find(t => t.id === input.contentType) as any;
        
        // 建構 IP 地基資料字串（強化版）
        const buildIpContext = () => {
          const parts: string[] = [];
          
          // 職業/身份
          if (profile?.occupation) {
            parts.push(`【你的身份】你是一位${profile.occupation}，請用這個身份的視角來寫內容。`);
          }
          
          // 語氣風格
          if (profile?.voiceTone) {
            parts.push(`【說話風格】你的說話風格是「${profile.voiceTone}」，請確保文案符合這個語氣。`);
          }
          
          // 人設三支柱
          if (profile?.personaExpertise || profile?.personaEmotion || profile?.personaViewpoint) {
            parts.push(`【人設三支柱 - 必須在內容中展現】`);
            if (profile?.personaExpertise) {
              parts.push(`  • 專業權威：${profile.personaExpertise}`);
            }
            if (profile?.personaEmotion) {
              parts.push(`  • 情感共鳴：${profile.personaEmotion}`);
            }
            if (profile?.personaViewpoint) {
              parts.push(`  • 獨特觀點：${profile.personaViewpoint}`);
            }
          }
          
          // 信念價值觀
          if (profile?.viewpointStatement) {
            parts.push(`【核心信念】${profile.viewpointStatement}`);
          }
          
          // 英雄旅程故事（如果有的話，可以引用）
          if (profile?.heroJourneyOrigin || profile?.heroJourneyProcess || profile?.heroJourneyHero || profile?.heroJourneyMission) {
            parts.push(`【你的故事 - 可以引用】`);
            if (profile?.heroJourneyOrigin) parts.push(`  • 緣起：${profile.heroJourneyOrigin}`);
            if (profile?.heroJourneyProcess) parts.push(`  • 過程：${profile.heroJourneyProcess}`);
            if (profile?.heroJourneyHero) parts.push(`  • 轉折：${profile.heroJourneyHero}`);
            if (profile?.heroJourneyMission) parts.push(`  • 使命：${profile.heroJourneyMission}`);
          }
          
          // 身份標籤
          if (profile?.identityTags && profile.identityTags.length > 0) {
            parts.push(`【身份標籤】${profile.identityTags.join('、')}`);
          }
          
          return parts.join('\n');
        };
        
        // 建構受眾資料字串（強化版）
        const buildAudienceContext = () => {
          if (!audiences || audiences.length === 0) {
            return '【目標受眾】未設定，請用通用的語氣寫作。';
          }
          
          const audienceLines = audiences.map(a => {
            let line = `  • ${a.segmentName}`;
            if (a.painPoint) line += `：他們的痛點是「${a.painPoint}」`;
            if (a.desiredOutcome) line += `，渴望「${a.desiredOutcome}」`;
            return line;
          });
          
          return `【目標受眾 - 請針對他們的痛點寫作】\n${audienceLines.join('\n')}`;
        };
        
        // 建構內容支柱資料
        const buildContentPillarsContext = () => {
          if (!contentPillars || contentPillars.length === 0) {
            return '';
          }
          
          const pillarLines = contentPillars.map(p => `  • ${p.title || '未命名'}：${p.description || ''}`).join('\n');
          return `【內容支柱 - 你的專業領域】\n${pillarLines}`;
        };
        
        // 根據內容類型生成不同的提示詞
        const typeSpecificPrompts: Record<string, string> = {
          question: `寫一篇「提問型」貼文，引發討論。

主題：${input.flexibleInput?.topic || input.material || ''}

結構要求：
1. 直接拋出問題，不需要長篇大論
2. 可以加一兩句背景說明
3. 結尾用「你們覺得呢？」或「想聽聽大家的看法」

風格：像在跟朋友聊天，真心想知道別人的想法`,
          
          poll: `寫一篇「投票型」貼文，讓大家選擇。

主題：${input.flexibleInput?.topic || input.material || ''}
選項：${(input.flexibleInput?.options || []).join(' vs ')}

結構要求：
1. 簡短介紹投票主題
2. 列出選項（用 A/B 或數字標註）
3. 結尾用「留言告訴我你的選擇」

風格：輕鬆有趣，讓人想參與`,
          
          viewpoint: `寫一篇「觀點型」貼文，表達立場。

觀點：${input.flexibleInput?.stance || input.material || ''}
原因：${input.flexibleInput?.reason || ''}

結構要求：
1. 開頭直接說出你的立場
2. 用 2-3 個論點支撐
3. 結尾邀請討論：「你們怎麼看？」

風格：有立場但不激進，歡迎不同聲音`,
          
          contrast: `寫一篇「反差型」貼文，打破認知。

大家以為：${input.flexibleInput?.common_belief || ''}
其實是：${input.flexibleInput?.truth || ''}

結構要求：
1. 開頭：「很多人以為...」
2. 轉折：「但其實...」
3. 解釋為什麼
4. 結尾問：「你也有這種經驗嗎？」

風格：驚喜感，讓人想分享`,
          
          casual: `寫一篇「閒聊型」貼文，輕鬆分享。

話題：${input.flexibleInput?.topic || input.material || ''}

結構要求：
1. 像在跟朋友聊天
2. 不需要完整結構
3. 結尾可以問「你們有過這種經驗嗎？」

風格：輕鬆自然，像日記`,
          
          dialogue: `寫一篇「對話型」貼文，問答形式。

問題：${input.flexibleInput?.question || ''}
想回答的方向：${input.flexibleInput?.context || ''}

結構要求：
1. 開頭：「最近有人問我...」或「朋友問我...」
2. 分享你的回答
3. 結尾問：「你們會怎麼回答？」

風格：像在跟朋友分享對話`,
          
          quote: `寫一篇「引用型」貼文，分享感想。

引用：${input.flexibleInput?.quote || ''}
感想：${input.flexibleInput?.reflection || ''}

結構要求：
1. 開頭引用這句話
2. 分享你的解讀或經歷
3. 結尾問：「這句話對你來說有什麼意義？」

風格：有深度但不說教`,
        };
        
        // 默認的完整結構提示詞（故事型、知識型、整理型）
        const fullStructurePrompt = `請幫我生成：

1. 三種不同風格的開頭（Hook）：
   - 鏡像式開頭（說出受眾心聲）
   - 反差式開頭（打破預期）
   - 場景式開頭（描繪畫面）

2. 完整的貼文內容：
   - 使用第一個開頭
   - 記得分段，保持呼吸感
   - 每段不超過3-4行

3. 文末互動引導（CTA）：
   - 優先引導留言
   - 門檻要低
   - 要有溫度`;
        
        // 建構強化版 system prompt
        const ipContext = buildIpContext();
        const audienceContext = buildAudienceContext();
        const contentPillarsContext = buildContentPillarsContext();
        
        // 取得爆款元素提示
        const viralElements = contentTypeInfo?.viralElements;
        const viralElementsPrompt = viralElements ? `
=== 爆款元素提示（請務必參考） ===
【開頭技巧】${viralElements.hookTips}
【內容技巧】${viralElements.contentTips}
【互動技巧】${viralElements.ctaTips}
【避免事項】${viralElements.avoidTips}` : '';

        const systemPrompt = `${SYSTEM_PROMPTS.contentGeneration}

=== 創作者 IP 地基（必須在內容中展現） ===
${ipContext || '未設定 IP 地基，請用通用風格寫作。'}

${audienceContext}

${contentPillarsContext}

=== 內容類型 ===
類型：${contentTypeInfo?.name || input.contentType}
說明：${contentTypeInfo?.description || ''}
${viralElementsPrompt}

=== Threads 爆款風格（最重要） ===
1. 【簡潔有力】每句話不超過 20 字，一句一行，快節奏推進
2. 【分段呼吸】每 2-3 行空一行，讓讀者有呼吸感
3. 【口語化】像跟朋友聊天，不是寫文章
4. 【有溫度】快節奏但不冷漠，要讓人感受到你的真誠
5. 【轉折詞】多用「但是」「沒想到」「結果」「後來」推動情緒

=== 重要指示（必須嚴格遵守） ===
1. 【語氣風格】必須使用創作者的語氣風格來寫作，如果沒有設定則用溫暖真誠的風格
2. 【受眾痛點】必須針對目標受眾的痛點來寫作，讓讀者感受到「這就是在說我」
3. 【人設三支柱】必須在內容中展現創作者的人設三支柱（專業權威/情感共鳴/獨特觀點）
4. 【身份視角】必須用創作者的職業/身份視角來寫作，讓內容有專業感
5. 【故事素材】如果有英雄旅程故事，可以適當引用來增加真實感
6. 【輸出格式】直接輸出可以發布的貼文，不要包含任何標題、解釋或提示詞
7. 【禁止 Markdown】不要使用星號、井號、橫線、反引號等 Markdown 符號，直接用空行分段
8. 【禁止詞彙】絕對不能使用：「讓我們」「一起來」「今天要分享」「親愛的朋友們」「各位」「大家好」`;

        // 根據內容類型選擇提示詞，並加入切角資訊
        let userPrompt = typeSpecificPrompts[input.contentType];
        
        if (!userPrompt) {
          // 默認提示詞（故事型、知識型、整理型）
          userPrompt = `素材：「${input.material || ''}」\n\n${fullStructurePrompt}`;
        }
        
        // 如果有切角，加入切角指示
        if (input.angle) {
          userPrompt = `【切角方向】請從「${input.angle}」這個角度來寫這篇貼文。\n\n${userPrompt}`;
        }

        const response = await invokeLLM({
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
          ],
        });

        await db.logApiUsage(ctx.user.id, 'generateDraft', 'llm', 600, 800);
        
        // 創建草稿
        const draft = await db.createDraft({
          userId: ctx.user.id,
          contentType: input.contentType as any,
          body: typeof response.choices[0]?.message?.content === 'string' ? response.choices[0].message.content : '',
        });

        return {
          content: response.choices[0]?.message?.content || '',
          draftId: draft?.id,
        };
      }),

    // 生成變現內容
    generateMonetizeContent: protectedProcedure
      .input(z.object({
        contentType: z.string(),
        additionalContext: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const profile = await db.getIpProfileByUserId(ctx.user.id);
        const products = await db.getUserProductsByUserId(ctx.user.id);
        const stories = await db.getSuccessStoriesByUserId(ctx.user.id);
        const aiMemory = await db.getUserAIMemory(ctx.user.id);
        
        const coreProduct = products.find(p => p.productType === 'core');
        const leadProduct = products.find(p => p.productType === 'lead');
        
        // Hook 策略和專業「說人話」原則
        const hookStrategies = `
## Hook 有效的三大心理學原理
1. 讓他看到「自己」：人類天生最關心自己，當內容說中了他的處境或心聲，他會立刻產生「欹，這是在說我」的感覺
2. 讓他看到「衝突感」或「好奇點」：大腦喜歡反差、顫覆和未解之謎
3. 讓他看到「解法」：大腦天生尋求解決方案以節省能量

## 三大 Hook 策略
1. 鏡像策略：「你是不是也...」「有沒有人也會這樣...」「如果你正在...，這篇文你要看」
2. 反差策略：「我以為...但其實...」「我做錯了一堆事，結果卻...」「我不是...但我還是...」
3. 解法策略：「...有問題？這幾點先看懂」「...踩雷的人，通常忽略了這幾件事」

## 五種即插即用的 Hook 句型
1. 引言式：引用一句話或轉貼，自然地打開話題
2. 提問式：拋出一個引發思考或共鳴的問題
3. 感受式：從個人真實的情緒或狀態出發
4. 發現式：分享一個日常中的小領悟或靈感
5. 反差式：講述一個「無心插柳」的時刻

## 專業「說人話」的藝術
在 Threads 上，讀者不是來上課的專家，他們更像是注意力短暫、不想動腦的「醉鬼」。
你的專業知識必須經過「翻譯」，才能在他們快速滑動的指尖下，被聽見、被理解、被信任。`;

        const contentTypePrompts: Record<string, string> = {
          profile_intro: `寫一篇「首頁自介文」，適合置頂。

開頭必須使用 Hook 策略（鏡像/反差/解法擇一），讓訪客立刻停下。

結構：
1. Hook 開頭：讓訪客看到自己的影子
2. 我是誰：用一句話定位自己（不是列表）
3. 我能幫什麼忙：用場景描述，不是功能列表
4. 為什麼是我：展現獨特價值
5. CTA：「想認識我的可以追蹤，有問題可以私訊我」

風格：像朋友介紹自己，不是履歷表`,
          service_intro: `寫一篇「服務介紹文」。

開頭必須使用 Hook 策略，建議用「鏡像策略」讓讀者看到自己的痛點。

結構：
1. Hook：用場景帶入讀者的困境
2. 共鳴：「我懂這種感覺」
3. 轉折：「後來我發現...」
4. 服務價值：用渴望導向，不是功能列表
5. CTA：「想了解更多可以私訊我」

風格：像朋友分享，不是銷售文案`,
          plus_one: `寫一篇「+1 互動文」，這是高轉換的導流機制。

開頭必須使用 Hook 策略，建議用「解法策略」讓讀者知道你有好東西。

結構：
1. Hook：「我整理了一個.../我最近做了一個...」
2. 價值說明：這個資源能幫什麼忙
3. 適合誰：如果你是...的人
4. CTA：「想要的留言 +1，我私訊給你」
5. 緊迫感（可選）：「這次只送 XX 份」

風格：真心分享，不是強迫推銷`,
          free_value: `寫一篇「免費價值文」，展現專業度同時吸引關注。

開頭必須使用 Hook 策略，建議用「發現式」或「解法策略」。

結構：
1. Hook：「我最近發現.../很多人問我...」
2. 實用內容：分享一個具體可執行的技巧
3. 為什麼有效：簡單解釋原理
4. CTA：「覺得有幫助的可以收藏，想知道更多可以追蹤我」

風格：像朋友分享小技巧，不是教科書`,
          success_story: `寫一篇「成功案例故事」，用故事展現價值。

開頭必須使用 Hook 策略，建議用「反差策略」或「感受式」。

結構：
1. Hook：「最近和一個朋友聊起.../前幾天收到一則訊息...」
2. Before：描述他之前的狀態（用場景，不用療效詞）
3. 轉折點：他做了什麼改變
4. After：現在的正面變化
5. CTA：「如果你也有類似的想法，可以私訊我聊聊」

風格：像在跟朋友分享一個故事，不是客戶見證
禁止：「治好了」「痊癒了」「效果顪著」等醫療用語`,
          lead_magnet: `寫一篇「引流品推廣文」，介紹低門檻服務。

開頭必須使用 Hook 策略，建議用「鏡像策略」讓讀者看到自己。

結構：
1. Hook：「你是不是也有這種感覺.../最近很多人問我...」
2. 共鳴：描述讀者可能的狀態
3. 解決方案：「所以我設計了一個...」
4. 適合誰：「如果你是...的人，這個很適合你」
5. CTA：「想先體驗看看的，可以私訊我」

風格：像朋友推薦，不是廣告文案`,
        };
        
        // 建構強化版 IP 地基資訊
        const ipContextParts: string[] = [];
        
        if (profile?.occupation) {
          ipContextParts.push(`【你的身份】你是一位${profile.occupation}，請用這個身份的視角來寫內容。`);
        }
        
        if (profile?.voiceTone) {
          ipContextParts.push(`【說話風格】你的說話風格是「${profile.voiceTone}」，請確保文案符合這個語氣。`);
        }
        
        if (profile?.personaExpertise || profile?.personaEmotion || profile?.personaViewpoint) {
          ipContextParts.push(`【人設三支柱 - 必須在內容中展現】`);
          if (profile?.personaExpertise) ipContextParts.push(`  • 專業權威：${profile.personaExpertise}`);
          if (profile?.personaEmotion) ipContextParts.push(`  • 情感共鳴：${profile.personaEmotion}`);
          if (profile?.personaViewpoint) ipContextParts.push(`  • 獨特觀點：${profile.personaViewpoint}`);
        }
        
        if (profile?.viewpointStatement) {
          ipContextParts.push(`【核心信念】${profile.viewpointStatement}`);
        }
        
        // 英雄旅程故事
        if (profile?.heroJourneyOrigin || profile?.heroJourneyProcess || profile?.heroJourneyHero || profile?.heroJourneyMission) {
          ipContextParts.push(`【你的故事 - 可以引用】`);
          if (profile?.heroJourneyOrigin) ipContextParts.push(`  • 緣起：${profile.heroJourneyOrigin}`);
          if (profile?.heroJourneyProcess) ipContextParts.push(`  • 過程：${profile.heroJourneyProcess}`);
          if (profile?.heroJourneyHero) ipContextParts.push(`  • 轉折：${profile.heroJourneyHero}`);
          if (profile?.heroJourneyMission) ipContextParts.push(`  • 使命：${profile.heroJourneyMission}`);
        }
        
        // 身份標籤
        if (profile?.identityTags && profile.identityTags.length > 0) {
          ipContextParts.push(`【身份標籤】${profile.identityTags.join('、')}`);
        }
        
        const ipContext = ipContextParts.length > 0 ? ipContextParts.join('\n') : '未設定 IP 地基';
        
        const systemPrompt = `你是一位專業的 Threads 內容創作教練，專門幫助創作者產出高互動的貼文。

${hookStrategies}

=== 創作者 IP 地基（必須在內容中展現） ===
${ipContext}

=== 產品資訊 ===
- 核心品：${coreProduct?.name || '未設定'}（${coreProduct?.description || ''}）
- 價格區間：${coreProduct?.priceRange || '未設定'}
- 獨特價值：${coreProduct?.uniqueValue || '未設定'}
${leadProduct ? `- 引流品：${leadProduct.name}（${leadProduct.priceRange || ''}）` : ''}

${stories.length > 0 ? `=== 成功案例 ===
${stories.slice(0, 2).map(s => `- ${s.title}：${s.transformation || ''}`).join('\n')}` : ''}

${aiMemory ? `=== AI 記憶（這位學員的偏好） ===
${aiMemory}` : ''}

=== Threads 爆款風格（最重要） ===
1. 【簡潔有力】每句話不超過 20 字，一句一行，快節奏推進
2. 【分段呼吸】每 2-3 行空一行，讓讀者有呼吸感
3. 【口語化】像跟朋友聊天，不是寫文章
4. 【有溫度】快節奏但不冷漠，要讓人感受到你的真誠
5. 【轉折詞】多用「但是」「沒想到」「結果」「後來」推動情緒

=== 重要指示（必須嚴格遵守） ===
1. 【語氣風格】必須使用創作者的語氣風格來寫作
2. 【人設三支柱】必須在內容中展現創作者的人設三支柱（專業權威/情感共鳴/獨特觀點）
3. 【身份視角】必須用創作者的職業/身份視角來寫作
4. 【黃金開局】開頭必須使用 Hook 策略，讓讀者立刻停下
5. 【五年級可讀性】內容要「說人話」，簡單到五年級小孩都能懂
6. 【渴望導向】用渴望引導，不要用恐嚇行銷
7. 【原生風格】保持原生內容風格，不要像廣告
8. 【軟性 CTA】CTA 要軟性，像朋友分享
9. 【禁止硬銷】避免「限時優惠」「立即購買」等硬銷文字
10. 【禁止 Markdown】不要使用星號、井號、橫線、反引號等 Markdown 符號
11. 【禁止詞彙】絕對不能使用：「讓我們」「一起來」「今天要分享」「親愛的朋友們」「各位」「大家好」

=== 輸出格式 ===
直接輸出可以發布的貼文內容，不要包含任何標題、解釋、注釋或提示詞。
不要用引號或分隔線來分隔段落，直接用空行。
不要寫「標題」「開頭」「結尾」等標註。`;

        const response = await invokeLLM({
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: `${contentTypePrompts[input.contentType] || '請幫我寫一篇變現內容'}

${input.additionalContext ? `補充說明：${input.additionalContext}` : ''}

重要：直接輸出可以發布的貼文，不要包含任何標題、解釋或提示詞。` }
          ],
        });

        await db.logApiUsage(ctx.user.id, 'generateMonetizeContent', 'llm', 800, 1000);
        
        // 創建草稿
        const draft = await db.createDraft({
          userId: ctx.user.id,
          contentType: input.contentType as any,
          body: typeof response.choices[0]?.message?.content === 'string' ? response.choices[0].message.content : '',
        });

        return {
          content: response.choices[0]?.message?.content || '',
          draftId: draft?.id,
        };
      }),

    // 對話修改草稿
    refineDraft: protectedProcedure
      .input(z.object({
        currentDraft: z.string(),
        instruction: z.string(),
        draftId: z.number().optional(), // 新增：草稿 ID
        chatHistory: z.array(z.object({
          role: z.enum(["user", "assistant"]),
          content: z.string(),
        })).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const profile = await db.getIpProfileByUserId(ctx.user.id);
        const aiMemory = await db.getUserAIMemory(ctx.user.id);
        
        const systemPrompt = `你是一個專業的 Threads 文案修改助理。你的任務是根據用戶的指示修改草稿。

創作者資料：
- 職業：${profile?.occupation || '未設定'}
- 語氣風格：${profile?.voiceTone || '未設定'}

${aiMemory ? `這位學員的偏好：
${aiMemory}` : ''}

=== Threads 爆款風格（修改時必須保持） ===
1. 簡潔有力：每句話不超過 20 字，一句一行
2. 分段呼吸：每 2-3 行空一行
3. 口語化：像跟朋友聊天
4. 有溫度：快節奏但不冷漠

重要原則：
1. 保持創作者的語氣風格
2. 只修改用戶要求的部分
3. 直接給出修改後的完整內容，不需要解釋
4. 禁止使用 Markdown 符號（星號、井號、橫線等）
5. 禁止使用：「讓我們」「一起來」「今天要分享」「親愛的朋友們」「各位」「大家好」`;

        const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
          { role: "system", content: systemPrompt },
          { role: "user", content: `當前草稿：

${input.currentDraft}` },
        ];

        // 加入對話歷史
        if (input.chatHistory && input.chatHistory.length > 0) {
          for (const msg of input.chatHistory) {
            messages.push({ role: msg.role, content: msg.content });
          }
        }

        messages.push({ role: "user", content: `請根據以下指示修改：${input.instruction}` });

        const response = await invokeLLM({ messages });
        const rawContent = response.choices[0]?.message?.content;
        const newContent = typeof rawContent === 'string' ? rawContent : '';

        await db.logApiUsage(ctx.user.id, 'refineDraft', 'llm', 500, 600);

        // 儲存修改偏好到 AI 記憶
        if (input.instruction.includes('更真誠') || input.instruction.includes('口語化') || input.instruction.includes('像廣告')) {
          await db.createConversationSummary({
            userId: ctx.user.id,
            summaryType: 'modification_pattern',
            content: `學員偏好：${input.instruction}`,
          });
        }

        // 更新資料庫中的草稿內容
        if (input.draftId) {
          await db.updateDraft(input.draftId, {
            body: newContent,
          });
        }

        return {
          content: newContent,
        };
      }),

    // 文案健檢
    optimize: protectedProcedure
      .input(z.object({
        text: z.string(),
        draftId: z.number().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const profile = await db.getIpProfileByUserId(ctx.user.id);
        
        // 整合知識庫中的 Hook 策略和「說人話」原則
        const systemPrompt = `${SYSTEM_PROMPTS.optimization}

創作者人設：
- 語氣風格：${profile?.voiceTone || '未設定'}
- 專業支柱：${profile?.personaExpertise || '未設定'}
- 情感支柱：${profile?.personaEmotion || '未設定'}
- 觀點支柱：${profile?.personaViewpoint || '未設定'}

## 評分標準（每項 1-10 分）

### Hook 開頭評分標準：
- 9-10分：開頭讓人立刻停下，符合鏡像/反差/解法三大策略之一
- 7-8分：開頭有吸引力，但可以更強
- 5-6分：開頭普通，沒有特別的停留點
- 1-4分：開頭弱，讀者可能直接滑過

### 「說人話」評分標準：
- 9-10分：完全口語化，像朋友聊天，沒有專業術語
- 7-8分：大部分口語化，偶有專業詞彙但不影響理解
- 5-6分：有些專業術語，需要思考才能理解
- 1-4分：太專業或太書面，一般人聽不懂

### CTA 評分標準：
- 9-10分：CTA 明確且軟性，讓人想行動但不像廣告
- 7-8分：CTA 清晰，但可以更自然
- 5-6分：CTA 模糊或太硬
- 1-4分：沒有 CTA 或 CTA 像廣告

### 結構評分標準：
- 9-10分：結構清晰，段落適中，很好吸收
- 7-8分：結構還可以，但有優化空間
- 5-6分：結構有點亂，段落太長或太短
- 1-4分：結構混亂，難以閱讀`;

        const response = await invokeLLM({
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: `請用以下格式檢查並優化這篇文案：

「${input.text}」

## 請輸出以下內容：

### 📊 文案評分

| 項目 | 分數 | 說明 | 為什麼重要 |
|------|------|------|----------|
| Hook 開頭 | X/10 | (簡短說明) | (為什麼這樣不好/為什麼這樣很好) |
| 說人話 | X/10 | (簡短說明) | (為什麼這樣不好/為什麼這樣很好) |
| CTA | X/10 | (簡短說明) | (為什麼這樣不好/為什麼這樣很好) |
| 結構 | X/10 | (簡短說明) | (為什麼這樣不好/為什麼這樣很好) |
| **總分** | **X/40** | | |

### 🔍 具體優化建議

1. **Hook 開頭**：
   - 問題：(目前開頭的問題)
   - 為什麼不好：(解釋為什麼這樣會影響效果)
   - 建議開頭 1：(替代方案)
   - 建議開頭 2：(替代方案)
   - 建議開頭 3：(替代方案)

2. **說人話**：
   - 問題詞彙：(列出需要替換的專業術語)
   - 為什麼不好：(解釋為什麼這些詞會讓讀者困惑)
   - 替代說法：(更口語化的表達)

3. **CTA**：
   - 問題：(目前 CTA 的問題)
   - 為什麼不好：(解釋為什麼這樣會影響轉化)
   - 建議 CTA：(更軟性的 CTA 建議)

4. **結構**：
   - 問題：(目前結構的問題)
   - 為什麼不好：(解釋為什麼這樣會影響閱讀體驗)
   - 建議調整：(結構調整建議)

### ✨ 優化版本

(直接輸出優化後的完整文案，不需要額外說明，不要用 Markdown 符號)` }
          ],
        });

        await db.logApiUsage(ctx.user.id, 'optimize', 'llm', 500, 700);
        
        // 儲存優化記錄
        await db.createOptimizationSession({
          userId: ctx.user.id,
          draftPostId: input.draftId,
          inputText: input.text,
          outputA: typeof response.choices[0]?.message?.content === 'string' ? response.choices[0].message.content : '',
        });

        return {
          result: response.choices[0]?.message?.content || '',
        };
      }),

    // AI 一鍵修改（根據健檢結果自動優化）
    autoFix: protectedProcedure
      .input(z.object({
        text: z.string(),
        draftId: z.number().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const profile = await db.getIpProfileByUserId(ctx.user.id);
        
        const systemPrompt = `你是一位 Threads 文案優化專家。請直接優化以下文案，不需要解釋。

創作者人設：
- 語氣風格：${profile?.voiceTone || '溫暖真誠'}
- 專業支柱：${profile?.personaExpertise || '未設定'}

優化原則：
1. 【Hook 開頭】開頭必須有強烈的鉤子，讓讀者停下
2. 【說人話】用大白話替換專業術語，五年級小孩都能懂
3. 【結構】多段落、空白行、短句，讓閱讀輕鬆
4. 【CTA】文末要有明確的互動引導，優先引導留言
5. 【禁止詞彙】不能使用：「讓我們」「一起來」「今天要分享」「親愛的朋友們」
6. 【禁止 Markdown】不要用星號、井號、橫線等符號

請直接輸出優化後的文案，不要包含任何解釋或標題。`;

        const response = await invokeLLM({
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: `請優化這篇文案：

${input.text}` }
          ],
        });

        const optimizedContent = typeof response.choices[0]?.message?.content === 'string' 
          ? response.choices[0].message.content 
          : '';

        await db.logApiUsage(ctx.user.id, 'autoFix', 'llm', 400, 600);

        // 如果有 draftId，更新草稿
        if (input.draftId) {
          await db.updateDraft(input.draftId, {
            body: optimizedContent,
          });
        }

        return {
          content: optimizedContent,
        };
      }),

    // 「聽得懂」檢查
    checkClarity: protectedProcedure
      .input(z.object({ text: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const response = await invokeLLM({
          messages: [
            { role: "system", content: "你是一個「蛤？測試」專家。你要假裝自己是一個完全不懂這個領域的普通人，檢查文案是否聽得懂。" },
            { role: "user", content: `請檢查這段文案，找出可能讓人「蛤？」的地方：

「${input.text}」

請列出：
1. 哪些詞彙或概念可能讓人聽不懂？
2. 更白話的說法是什麼？
3. 整體來說，一般人聽得懂嗎？（1-10分）` }
          ],
        });

        await db.logApiUsage(ctx.user.id, 'checkClarity', 'llm', 200, 300);

        return {
          result: response.choices[0]?.message?.content || '',
        };
      }),

    // 留言回覆建議
    suggestReply: protectedProcedure
      .input(z.object({
        comment: z.string(),
        context: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const profile = await db.getIpProfileByUserId(ctx.user.id);
        
        const response = await invokeLLM({
          messages: [
            { role: "system", content: `${SYSTEM_PROMPTS.interactionSuggestion}

創作者語氣風格：${profile?.voiceTone || '溫暖親切'}` },
            { role: "user", content: `有人在我的貼文留言：「${input.comment}」
${input.context ? `貼文內容是關於：${input.context}` : ''}

請給我3種不同風格的回覆建議：
1. 溫暖感謝型
2. 延伸話題型
3. 反問互動型` }
          ],
        });

        await db.logApiUsage(ctx.user.id, 'suggestReply', 'llm', 200, 300);

        return {
          suggestions: response.choices[0]?.message?.content || '',
        };
      }),
  }),

  // ==================== 互動任務 ====================
  task: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const tasks = await db.getInteractionTasksByUserId(ctx.user.id);
      return tasks ?? [];
    }),
    
    today: protectedProcedure.query(async ({ ctx }) => {
      const tasks = await db.getTodayTasks(ctx.user.id);
      return tasks ?? [];
    }),
    
    create: protectedProcedure
      .input(z.object({
        taskType: z.enum(["reply_comments", "comment_others", "sea_patrol"]),
        taskDetail: z.string(),
        dueDate: z.date().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        return db.createInteractionTask({
          userId: ctx.user.id,
          ...input,
          dueDate: input.dueDate || new Date(),
        });
      }),
    
    updateStatus: protectedProcedure
      .input(z.object({
        id: z.number(),
        status: z.enum(["todo", "done", "skipped"]),
      }))
      .mutation(async ({ input }) => {
        await db.updateInteractionTask(input.id, { status: input.status });
        return { success: true };
      }),
    
    generateDaily: protectedProcedure.mutation(async ({ ctx }) => {
      const today = new Date();
      const tasks = [
        { taskType: "reply_comments" as const, taskDetail: "回覆今天貼文下的所有留言，記得要有溫度！" },
        { taskType: "comment_others" as const, taskDetail: "去3個同領域帳號的貼文留言，分享你的觀點" },
        { taskType: "sea_patrol" as const, taskDetail: "搜尋你的專業關鍵字，找到2個相關討論參與互動" },
      ];
      
      for (const task of tasks) {
        await db.createInteractionTask({
          userId: ctx.user.id,
          ...task,
          dueDate: today,
        });
      }
      
      return { success: true, count: tasks.length };
    }),
  }),

  // ==================== 貼文與戰報 ====================
  post: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const posts = await db.getPostsByUserId(ctx.user.id);
      return posts ?? [];
    }),
    
    create: protectedProcedure
      .input(z.object({
        draftPostId: z.number().optional(),
        threadUrl: z.string(),
        postedAt: z.date().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        // 如果有關聯草稿，更新草稿狀態
        if (input.draftPostId) {
          await db.updateDraft(input.draftPostId, { status: 'published' });
        }
        const post = await db.createPost({
          userId: ctx.user.id,
          draftPostId: input.draftPostId,
          threadUrl: input.threadUrl,
          postedAt: input.postedAt || new Date(),
        });
        return post;
      }),
    
    addMetrics: protectedProcedure
      .input(z.object({
        postId: z.number(),
        reach: z.number().optional(),
        likes: z.number().optional(),
        comments: z.number().optional(),
        reposts: z.number().optional(),
        saves: z.number().optional(),
        profileVisits: z.number().optional(),
        linkClicks: z.number().optional(),
        inquiries: z.number().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { postId, ...metrics } = input;
        const metric = await db.createPostMetric({
          postId,
          capturedAt: new Date(),
          reach: metrics.reach,
          likes: metrics.likes,
          comments: metrics.comments,
          reposts: metrics.reposts,
          saves: metrics.saves,
          profileVisits: metrics.profileVisits,
          linkClicks: metrics.linkClicks,
          inquiries: metrics.inquiries,
          notes: metrics.notes,
        });
        return metric;
      }),
    
    weeklyReport: protectedProcedure.query(async ({ ctx }) => {
      const report = await db.getWeeklyReport(ctx.user.id);
      return report ?? { posts: [], metrics: [], summary: { totalReach: 0, totalLikes: 0, totalComments: 0, totalSaves: 0 } };
    }),
  }),

  // ==================== 商品管理 ====================
  product: router({
    list: publicProcedure.query(async () => {
      const products = await db.getAllProducts();
      return products ?? [];
    }),
    
    get: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const product = await db.getProductById(input.id);
        return product ?? null;
      }),
    
    create: adminProcedure
      .input(z.object({
        sku: z.string(),
        name: z.string(),
        description: z.string().optional(),
        productType: z.enum(["lead", "core", "vip", "passive"]),
        deliveryType: z.enum(["digital", "service", "community"]),
        price: z.number(),
        currency: z.string().optional(),
        billingType: z.enum(["one_time", "subscription"]),
        billingInterval: z.enum(["month", "year"]).optional(),
      }))
      .mutation(async ({ input }) => {
        return db.createProduct(input);
      }),
    
    update: adminProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().optional(),
        description: z.string().optional(),
        price: z.number().optional(),
        status: z.enum(["active", "inactive"]).optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await db.updateProduct(id, data);
        return { success: true };
      }),
  }),

  // ==================== 訂單管理 ====================
  order: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return db.getOrdersByUserId(ctx.user.id);
    }),
    
    create: protectedProcedure
      .input(z.object({
        productId: z.number(),
      }))
      .mutation(async ({ ctx, input }) => {
        const product = await db.getProductById(input.productId);
        if (!product) throw new TRPCError({ code: 'NOT_FOUND' });
        
        return db.createOrder({
          userId: ctx.user.id,
          subtotalAmount: product.price || 0,
          totalAmount: product.price || 0,
        });
      }),
  }),

  // ==================== 訂閱管理 ====================
  subscription: router({
    active: protectedProcedure.query(async ({ ctx }) => {
      return db.getActiveSubscription(ctx.user.id);
    }),
  }),

  // ==================== 管理後台 ====================
  admin: router({
    users: adminProcedure.query(async () => {
      return db.getAllUsers();
    }),
    
    apiUsage: adminProcedure
      .input(z.object({ userId: z.number() }))
      .query(async ({ input }) => {
        return db.getApiUsageByUserId(input.userId);
      }),
    
    // 學員開通 API
    activateUser: adminProcedure
      .input(z.object({
        userId: z.number(),
        expiresAt: z.date().optional(),
        note: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        await db.activateUser(input.userId, ctx.user.id, input.expiresAt, input.note);
        return { success: true };
      }),
    
    // 停用學員
    deactivateUser: adminProcedure
      .input(z.object({
        userId: z.number(),
        note: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        await db.deactivateUser(input.userId, input.note);
        return { success: true };
      }),
    
    // 拒絕學員
    rejectUser: adminProcedure
      .input(z.object({
        userId: z.number(),
        reason: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        await db.rejectUser(input.userId, ctx.user.id, input.reason);
        return { success: true };
      }),
    
    // 延長學員有效期
    extendUserExpiry: adminProcedure
      .input(z.object({
        userId: z.number(),
        newExpiresAt: z.date(),
      }))
      .mutation(async ({ input }) => {
        await db.extendUserExpiry(input.userId, input.newExpiresAt);
        return { success: true };
      }),
    
    // 取得待開通學員列表
    pendingUsers: adminProcedure.query(async () => {
      return db.getPendingUsers();
    }),
    
    // 取得已開通學員列表
    activatedUsers: adminProcedure.query(async () => {
      return db.getActivatedUsers();
    }),
  }),

  // ==================== 用戶產品矩陣 ====================
  userProduct: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const products = await db.getUserProductsByUserId(ctx.user.id);
      return products ?? [];
    }),

    create: protectedProcedure
      .input(z.object({
        productType: z.enum(["lead", "core", "vip", "passive"]),
        name: z.string(),
        description: z.string().optional(),
        priceRange: z.string().optional(),
        deliveryTime: z.string().optional(),
        uniqueValue: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        return db.createUserProduct({ userId: ctx.user.id, ...input });
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().optional(),
        description: z.string().optional(),
        priceRange: z.string().optional(),
        deliveryTime: z.string().optional(),
        uniqueValue: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await db.updateUserProduct(id, data);
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteUserProduct(input.id);
        return { success: true };
      }),
  }),

  // ==================== 成功案例故事 ====================
  successStory: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const stories = await db.getSuccessStoriesByUserId(ctx.user.id);
      return stories ?? [];
    }),

    create: protectedProcedure
      .input(z.object({
        title: z.string(),
        clientBackground: z.string().optional(),
        challenge: z.string().optional(),
        transformation: z.string().optional(),
        outcome: z.string().optional(),
        testimonialQuote: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        return db.createSuccessStory({ userId: ctx.user.id, ...input });
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        title: z.string().optional(),
        clientBackground: z.string().optional(),
        challenge: z.string().optional(),
        transformation: z.string().optional(),
        outcome: z.string().optional(),
        testimonialQuote: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await db.updateSuccessStory(id, data);
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteSuccessStory(input.id);
        return { success: true };
      }),
  }),

  // ==================== 用戶經營狀態 ====================
  growthMetrics: router({
    get: protectedProcedure.query(async ({ ctx }) => {
      const metrics = await db.getUserGrowthMetrics(ctx.user.id);
      return metrics ?? null;
    }),

    update: protectedProcedure
      .input(z.object({
        followerCount: z.number().optional(),
        avgReach: z.number().optional(),
        avgEngagement: z.number().optional(),
        hasProfileSetup: z.boolean().optional(),
        hasLineLink: z.boolean().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        await db.upsertUserGrowthMetrics({ userId: ctx.user.id, ...input });
        // 自動計算經營階段
        const stage = await db.calculateUserStage(ctx.user.id);
        await db.upsertUserGrowthMetrics({ userId: ctx.user.id, currentStage: stage as any });
        return { success: true, stage };
      }),

    getStage: protectedProcedure.query(async ({ ctx }) => {
      return db.calculateUserStage(ctx.user.id);
    }),
  }),

  // ==================== AI 記憶系統 ====================
  aiMemory: router({
    getSummaries: protectedProcedure.query(async ({ ctx }) => {
      return db.getConversationSummariesByUserId(ctx.user.id);
    }),

    getMemoryContext: protectedProcedure.query(async ({ ctx }) => {
      return db.getUserAIMemory(ctx.user.id);
    }),

    addSummary: protectedProcedure
      .input(z.object({
        summaryType: z.enum(["writing_preference", "content_success", "modification_pattern", "topic_interest", "style_feedback"]),
        content: z.string(),
        metadata: z.any().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        return db.createConversationSummary({ userId: ctx.user.id, ...input });
      }),
  }),

  // ==================== 知識庫 ====================
  knowledge: router({
    contentTypes: publicProcedure.query(() => KNOWLEDGE_BASE.contentTypes),
    contentTypesWithViralElements: publicProcedure.query(() => KNOWLEDGE_BASE.contentTypesWithViralElements),
    viralPostTypes: publicProcedure.query(() => KNOWLEDGE_BASE.viralPostTypes),
    forbiddenPhrases: publicProcedure.query(() => KNOWLEDGE_BASE.forbiddenPhrases),
    threadsStyleGuide: publicProcedure.query(() => KNOWLEDGE_BASE.threadsStyleGuide),
    hookStyles: publicProcedure.query(() => KNOWLEDGE_BASE.hookStyles),
    fourLens: publicProcedure.query(() => KNOWLEDGE_BASE.fourLensFramework),
    algorithm: publicProcedure.query(() => KNOWLEDGE_BASE.threadsAlgorithm),
    taskTypes: publicProcedure.query(() => KNOWLEDGE_BASE.interactionTaskTypes),
    productMatrix: publicProcedure.query(() => KNOWLEDGE_BASE.productMatrix),
    businessGoals: publicProcedure.query(() => KNOWLEDGE_BASE.businessGoals),
    personaPillars: publicProcedure.query(() => KNOWLEDGE_BASE.personaThreePillars),
  }),

  // ==================== 邀請碼系統 ====================
  invitation: router({
    // 驗證並使用邀請碼（公開 API，用於學員註冊）
    use: protectedProcedure
      .input(z.object({ code: z.string() }))
      .mutation(async ({ ctx, input }) => {
        return db.useInvitationCode(input.code, ctx.user.id);
      }),
    
    // 查詢當前用戶的開通狀態
    myStatus: protectedProcedure.query(async ({ ctx }) => {
      return {
        activationStatus: ctx.user.activationStatus,
        activatedAt: ctx.user.activatedAt,
        expiresAt: ctx.user.expiresAt,
        activationNote: ctx.user.activationNote,
      };
    }),
    
    // 以下是管理員專用 API
    
    // 創建單個邀請碼
    create: adminProcedure
      .input(z.object({
        validDays: z.number().default(90),
        note: z.string().optional(),
        expiresAt: z.date().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        return db.createInvitationCode({
          createdBy: ctx.user.id,
          validDays: input.validDays,
          note: input.note,
          expiresAt: input.expiresAt,
        });
      }),
    
    // 批量創建邀請碼
    createBatch: adminProcedure
      .input(z.object({
        count: z.number().min(1).max(100),
        validDays: z.number().default(90),
        note: z.string().optional(),
        expiresAt: z.date().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        return db.createBatchInvitationCodes({
          createdBy: ctx.user.id,
          count: input.count,
          validDays: input.validDays,
          note: input.note,
          expiresAt: input.expiresAt,
        });
      }),
    
    // 獲取所有邀請碼
    list: adminProcedure.query(async () => {
      return db.getAllInvitationCodes();
    }),
    
    // 撤銷邀請碼
    revoke: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        return db.revokeInvitationCode(input.id);
      }),
  }),
});

export type AppRouter = typeof appRouter;
