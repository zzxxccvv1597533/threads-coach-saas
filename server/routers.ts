import { COOKIE_NAME } from "@shared/const";
import { z } from "zod";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { invokeLLM } from "./_core/llm";
import * as db from "./db";
import { getDb } from "./db";
import { postMetrics, ipProfiles } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import { KNOWLEDGE_BASE, SYSTEM_PROMPTS, CONTENT_TYPES_WITH_VIRAL_ELEMENTS, FORBIDDEN_PHRASES, THREADS_STYLE_GUIDE, FOUR_LENS_FRAMEWORK } from "../shared/knowledge-base";
import { executeContentHealthCheck, MAX_SCORES, DIMENSION_NAMES } from "./content-health-check";
import { applyContentFilters, extractPreservedWords, extractEmotionWords, cleanAIOutput, filterProfanity } from "./contentFilters";
import { buildDataDrivenSystemPrompt, buildDataDrivenUserPrompt, analyzeGeneratedContent, getDataDrivenSummary, collectDataDrivenContext } from "./data-driven-prompt-builder";
import { selectRandomOpenerPattern, extractMaterialKeywords } from "../shared/opener-rules";
import { generateMultipleOpeners, markOpenerSelected, type OpenerCandidate } from "./openerGenerator";
import { selectAndRank, getTopN } from "./selector";
import { quickDetect } from "./aiDetector";
import { getContentTypeRule } from "../shared/content-type-rules";

// Admin procedure
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== 'admin') {
    throw new TRPCError({ code: 'FORBIDDEN', message: '需要管理員權限' });
  }
  return next({ ctx });
});

// 計算貼文表現等級（戰報閉環學習）
function calculatePerformanceLevel(
  reach?: number,
  comments?: number,
  saves?: number
): 'hit' | 'normal' | 'low' {
  // 簡化的評估邏輯：
  // 爆文：觸及 > 500 且 留言 > 10
  // 低迷：觸及 < 100 或 留言 < 2
  // 其他為正常
  const r = reach || 0;
  const c = comments || 0;
  const s = saves || 0;
  
  if (r >= 500 && c >= 10) {
    return 'hit';
  }
  if (r < 100 || c < 2) {
    return 'low';
  }
  return 'normal';
}

// 生成後快速診斷函數（不額外調用 LLM）
function generateQuickDiagnosis(
  content: string, 
  profile: any, 
  contentTypeInfo: any
): {
  strengths: Array<{ label: string; description: string }>;
  improvements: Array<{ label: string; description: string; action?: string }>;
  score: number;
} {
  const strengths: Array<{ label: string; description: string }> = [];
  const improvements: Array<{ label: string; description: string; action?: string }> = [];
  let score = 70; // 基礎分數
  
  // 檢查 Hook 強度
  const firstLines = content.split('\n').slice(0, 3).join('\n');
  const hookPatterns = [
    { pattern: /很多人|大家都|你是不是|有沒有過/, label: '鏡像式開頭', desc: '說出受眾心聲' },
    { pattern: /但其實|沒想到|結果|其實/, label: '反差式開頭', desc: '打破預期製造詚異' },
    { pattern: /昨天|上週|有一次|那天/, label: '場景式開頭', desc: '用故事帶入' },
    { pattern: /\d+個|第一|最後/, label: '數字式開頭', desc: '用數字抓注意力' },
  ];
  
  let hookFound = false;
  for (const hp of hookPatterns) {
    if (hp.pattern.test(firstLines)) {
      strengths.push({ label: hp.label, description: hp.desc });
      hookFound = true;
      score += 5;
      break;
    }
  }
  
  if (!hookFound) {
    improvements.push({ 
      label: 'Hook 可加強', 
      description: '開頭可以更有衝擊力，試試「很多人以為...」或「你是不是也...」',
      action: '優化開頭'
    });
  }
  
  // 檢查翻譯機（比喻）
  const metaphorPatterns = /就像|好比|彷彟|一樣|那種感覺/;
  if (metaphorPatterns.test(content)) {
    strengths.push({ label: '翻譯機', description: '有使用比喻，讓抽象概念更具體' });
    score += 5;
  } else {
    improvements.push({ 
      label: '可加入比喻', 
      description: '試試用「就像...」讓抽象概念更容易理解',
      action: '加入比喻'
    });
  }
  
  // 檢查呼吸感排版
  const lines = content.split('\n');
  const emptyLineCount = lines.filter(l => l.trim() === '').length;
  const avgParagraphLength = content.length / Math.max(emptyLineCount + 1, 1);
  
  if (emptyLineCount >= 3 && avgParagraphLength < 150) {
    strengths.push({ label: '呼吸感排版', description: '段落分明，閱讀體驗好' });
    score += 5;
  } else if (emptyLineCount < 2) {
    improvements.push({ 
      label: '排版可優化', 
      description: '建議每 2-4 行空一行，讓視覺更有呼吸空間',
      action: '優化排版'
    });
  }
  
  // 檢查 CTA
  const ctaPatterns = /你們覺得|你會選|留言告訴|想聽聽|你也是這樣|有沒有人/;
  if (ctaPatterns.test(content)) {
    strengths.push({ label: 'CTA 互動召喚', description: '有引導讀者互動' });
    score += 5;
  } else {
    improvements.push({ 
      label: '可加入 CTA', 
      description: '結尾加入「你們也是這樣嗎？」或「你會選 A 還是 B？」',
      action: '加入 CTA'
    });
  }
  
  // 檢查語氣詞
  const tonePatterns = /真的|欹|啊|吧|呢|嗯/;
  if (tonePatterns.test(content)) {
    strengths.push({ label: '口語化語氣', description: '有使用語助詞，像真人說話' });
    score += 3;
  }
  
  // 檢查身分標籤
  const identityPatterns = /創業者|上班族|娽娽|老師|自由接案|全職娽娽|\d+歲|第三年/;
  if (identityPatterns.test(content)) {
    strengths.push({ label: '身分標籤', description: '有使用身分標籤，增加共鳴' });
    score += 3;
  } else {
    improvements.push({ 
      label: '可加入身分標籤', 
      description: '加入「創業第三年」「30歲」等標籤增加共鳴',
      action: '加入身分標籤'
    });
  }
  
  // 檢查是否引用英雄旅程
  if (profile?.heroJourneyOrigin || profile?.heroJourneyProcess) {
    const storyPatterns = /我以前|我曾經|後來我|那時候的我/;
    if (storyPatterns.test(content)) {
      strengths.push({ label: '個人故事', description: '有引用個人經歷，增加真實感' });
      score += 5;
    } else {
      improvements.push({ 
        label: '可加入個人故事', 
        description: '試試用「我以前也...」帶入你的英雄旅程',
        action: '加入個人故事'
      });
    }
  }
  
  // 確保分數在合理範圍
  score = Math.min(Math.max(score, 60), 95);
  
  return { strengths, improvements, score };
}

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
        
        // 加入隨機種子和角度確保每次生成不同結果
        const randomSeed = Math.random().toString(36).substring(7);
        const emotionAngles = ['焦慮型', '困惑型', '無奈型', '渴望型', '自我懷疑型', '比較心態型'];
        const selectedEmotions = emotionAngles.sort(() => Math.random() - 0.5).slice(0, 3);
        
        // === 數據驅動：從爆款數據庫中提取高互動痛點參考 ===
        let viralPainPointsContext = '';
        try {
          // 根據主題匹配關鍵字
          const themeKeywords = themes.join(' ');
          const matchingKeywords = await db.findMatchingKeywords(themeKeywords);
          
          if (matchingKeywords.length > 0) {
            // 取得與主題相關的爆款範例
            const topKeyword = matchingKeywords[0];
            const viralExamplesResult = await db.getViralExamples({ keyword: topKeyword.keyword, limit: 5 });
            
            if (viralExamplesResult.length > 0) {
              // 提取爆款貼文中的痛點模式
              const painPointPatterns = viralExamplesResult
                .filter((e: { opener50: string | null }) => e.opener50)
                .map((e: { opener50: string | null; likes: number }) => `「${e.opener50}」（${e.likes} 讚）`)
                .slice(0, 3);
              
              if (painPointPatterns.length > 0) {
                viralPainPointsContext = `
=== 數據驅動的爆款痛點參考（來自 1,739 篇爆款貼文分析） ===
關鍵字「${topKeyword.keyword}」的高互動開頭：
${painPointPatterns.join('\n')}

這些開頭的共同特點：
- 直擊痛點，不繞彎子
- 使用具體場景而非抽象描述
- 帶有情緒張力（焦慮、困惑、渴望）

請參考這些爆款痛點的寫法風格，生成更有共鳴的 Trigger。`;
              }
            }
          }
        } catch (e) {
          console.error('Failed to fetch viral pain points:', e);
        }
        
const prompt = `你是一位 Threads 內容策略專家。請根據以下資訊，進行「Y軸（受眾）× X軸（子主題）」的交叉分析，生成痛點矩陣。

=== 創作者 IP 地基 ===
${ipContext || '未設定'}

=== Y軸：三層受眾 ===
${cleanAudiences.map((a, i) => {
  const types = ['核心受眾（直接有強烈需求，願意付費）', '潛在受眾（有關聯性需求，能影響決策）', '機會受眾（對話題感興趣，能帶來流量）'];
  return `${i + 1}. ${a} - ${types[i] || '受眾'}`;
}).join('\n')}

=== X軸：子主題 ===
${themes.map((t, i) => `${i + 1}. ${t}`).join('\n')}

=== 任務說明（極度重要） ===
矩陣是用來「激發靈感」的，不是用來「閱讀文案」的。

請輸出「用戶腦中閃過的第一個念頭（Trigger）」，而不是「完整的焦慮描述」。

=== 嚴格格式規則（必須遵守） ===
1. 每個格子字數限制：15-25 字以內
2. 格式：「具體場景 + 具體疑問/衝突」
3. 禁止：括號內心戲（如「(崩潰)」「(無奈)」）
4. 禁止：長句、成語、複雜描述
5. 禁止：寫成完整文案或內心獨白

=== 正確 vs 錯誤範例 ===
❌ 錯誤：技術很好但不敢收高價，覺得收錢就是不善良，看到別人賺錢又很嫉妒。
✅ 正確：技術比網紅好，為什麼我連房租都繳不出來？

❌ 錯誤：(崩潰) 我明明比那個網紅老師準十倍...我到底要不要也去拍那種...
✅ 正確：該不該為了流量拍搞笑片？

❌ 錯誤：我已經忍耐這麼久了，如果現在抽牌說要離開，我會不會後悔？
✅ 正確：想漲價到 3000，但怕客人都跑光怎麼辦？

=== 流量密碼參考（可選擇性植入） ===
- 身分標籤：「二寶媽」「想離職的人」「創業第三年」
- 數字引導：「3 個徵兆」「90% 的人都...」
- 反差對比：「明明...卻...」「以為...結果...」
${viralPainPointsContext}

=== 隨機種子 ===
${randomSeed}

=== 輸出格式 ===
請用 JSON 格式回應，受眾名稱必須完全匹配以下名稱：
${cleanAudiences.map(a => `- "${a}"`).join('\n')}

結構如下：
{
  "${cleanAudiences[0] || '受眾1'}": {
    "${themes[0] || '主題1'}": ["15-25字的Trigger1", "15-25字的Trigger2"],
    "${themes[1] || '主題2'}": ["15-25字的Trigger1", "15-25字的Trigger2"]
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
        
        // 加入隨機種子確保每次生成不同結果
        const randomSeed = Math.random().toString(36).substring(7);
        const randomAngle = ['SEO關鍵字思維', '受眾痛點導向', '創作者專業導向', '市場趨勢導向', '競爭差異化導向'][Math.floor(Math.random() * 5)];
        
        // ✅ P0+P1 優化：取得選題庫和群集參考
        const topicTemplates = await db.getRandomTopicSuggestions(6);
        const clusters = await db.getContentClusters();
        
        let topicLibraryContext = '';
        if (topicTemplates.length > 0) {
          topicLibraryContext = `\n=== 選題庫參考（經過驗證的高表現子主題結構） ===\n`;
          topicTemplates.forEach((t, i) => {
            topicLibraryContext += `${i + 1}. ${t.theme || ''}：${t.template || ''}\n`;
          });
        }
        
        let clusterContext = '';
        if (clusters.length > 0) {
          clusterContext = `\n=== 內容群集參考（爆文率較高的主題類型） ===\n`;
          clusters.forEach(c => {
            const top10Rate = c.top10Rate ? (c.top10Rate * 100).toFixed(1) : '0';
            clusterContext += `- ${c.themeKeywords || ''}（爆文率 ${top10Rate}%）\n`;
          });
        }
        
const prompt = `你是一位 Threads 內容策略專家。請根據以下創作者資訊，將其專業領域拆解成 3-5 個具體的「子主題」作為內容支柱。

=== 創作者 IP 地基 ===
${ipContext || '未設定'}

=== 目標受眾 ===
${audiences.join('、')}

=== ❗❗❗ 最重要原則：子主題是「分類夾」，不是「一張紙」 ===

子主題必須是「名詞分類」，不是「文章標題」或「感性文案」！

❌ 嚴禁生成這種（像標題/文案）：
- 「身體訊號解讀：當疲憊、緊繃、失眠成為日常」
- 「從『沒有後援』到『自我接住』的轉彎點」
- 「關係裡的『自動駕駛』：如何停止委屈與過度付出」
- 「當『應該』變成枷鎖：重新定義自己的人生腳本」

✅ 必須生成這種（像分類/場景）：
- 「身體覺察與症狀」（可裝：失眠、胃痛、肩頸僵硬、頭痛...）
- 「情緒急救與自我照顧」（可裝：崩潰、焦慮、孤獨、壓力...）
- 「人際界線與溝通」（可裝：伴侶、職場、家庭、勒索...）
- 「職場生存與成長」（可裝：升遷、轉職、同事相處...）
- 「自我探索與價值觀」（可裝：人生方向、自我懷疑、意義感...）

=== 子主題格式要求（強制） ===
1. 必須是「名詞分類」，不能是「句子」
2. 不超過 8 個字
3. 禁止使用冒號（：）、引號（「」）、長形容詞
4. 要能裝入 10+ 篇不同角度的文章

=== 三種拆解邏輯（請根據領域選擇最適合的） ===

「邏輯 A：生活場景與時間軸」
適用：身心靈、療癒、寵物溝通、命理
範例：
- 日常行為問題（可裝：亂尿尿、挑食、破壞家具）
- 身心健康照護（可裝：生病、老化、結紮）
- 離世與靈性溝通（可裝：離世後溝通、投胎轉世）

「邏輯 B：解決方案/工具」
適用：顧問、教學、技能傳授
範例：
- 自媒體行銷方式（可裝：短影音、圖文、直播）
- 行銷心態與障礙（可裝：不敢曝光、金錢羞恥）
- AI 工具應用（可裝：ChatGPT、自動化、文案生成）

「邏輯 C：興趣面向/SEO關鍵字」
適用：旅遊、美食、生活風格
範例：
- 住宿攻略（可裝：飯店推薦、區域選擇）
- 美食地圖（可裝：必吃餐廳、預約技巧）
- 交通教學（可裝：地鐵攻略、省錢票券）

=== 生成要求 ===
請用「${randomAngle}」的角度來拆解，生成 3-5 個子主題：
1. 必須是「名詞分類」，不超過 8 個字
2. 每個子主題都能裝入 10+ 篇不同角度的文章
3. 要能與受眾交叉產生具體痛點
4. 絕對不能是文案標題或感性句子

=== 自我檢驗（生成後必須檢查） ===
1. 這是「分類夾」還是「一張紙」？
   - 「身體覺察」是分類夾 → 可以裝：失眠、胃痛、肩頸僵硬、頭痛...
   - 「當疲憊成為日常」是一張紙 → 只能寫一篇文章
2. 名稱是否超過 8 個字？
3. 是否包含冒號、引號、長形容詞？

${topicLibraryContext}
${clusterContext}
=== 隨機種子 ===
${randomSeed}

=== 輸出格式 ===
請用 JSON 格式回應：
{
  "topics": [
    { "name": "子主題名稱（不超過8字）", "description": "這個分類可以裝入的內容，例如：..." }
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

    // 從矩陣生成選題（第四步：套用流量密碼生成標題）
    generateTopicFromMatrix: protectedProcedure
      .input(z.object({
        audience: z.string(), // 選中的受眾
        subTopic: z.string(), // 選中的子主題
        painPoint: z.string(), // 選中的痛點
        occupation: z.string().optional(),
        voiceTone: z.string().optional(),
        contentPillars: z.object({
          authority: z.string().optional(),
          emotion: z.string().optional(),
          uniqueness: z.string().optional(),
        }).optional(),
      }))
      .mutation(async ({ input }) => {
        const { audience, subTopic, painPoint, occupation, voiceTone, contentPillars } = input;
        
        // 建構 IP 地基資訊
        let ipContext = '';
        if (occupation) ipContext += `職業/身份：${occupation}\n`;
        if (voiceTone) ipContext += `語氣風格：${voiceTone}\n`;
        if (contentPillars) {
          if (contentPillars.authority) ipContext += `專業權威：${contentPillars.authority}\n`;
          if (contentPillars.emotion) ipContext += `情感共鳴：${contentPillars.emotion}\n`;
          if (contentPillars.uniqueness) ipContext += `獨特觀點：${contentPillars.uniqueness}\n`;
        }
        
        const randomSeed = Math.random().toString(36).substring(7);
        
        const prompt = `你是一位 Threads 爆款內容專家。請根據以下「受眾 × 子主題 × 痛點」的交叉點，生成 3 個爆款選題。

=== 創作者 IP 地基 ===
${ipContext || '未設定'}

=== 矩陣交叉點 ===
- 受眾 (Y軸)：${audience}
- 子主題 (X軸)：${subTopic}
- 交叉痛點：${painPoint}

=== 選題生成規則 ===

1. 「像真人發文」而不是廣告標語
   - 用口語化的語氣
   - 帶有情緒（「天啊」「救命」「笑死」「傻眼」）
   - 像是在跟朋友分享

2. 使用「觀察+提問」或「反差」句式
   - 「有沒有人發現...」
   - 「明明...卻...」
   - 「以為...結果...」
   - 「好奇問一下...」

3. 植入流量密碼（至少使用 1-2 種）
   - MBTI/星座：「ENFP 的人是不是都...」「天蠅座最近...」
   - 數字清單：「3 個徵兆」「5 種人」
   - 反差對比：「明明很努力，卻...」
   - 情緒共鳴詞：「救命」「崩潰」「心累」
   - 身分標籤：「想離職的人」「二寶媽」
   - 關係標籤：「前任」「曖昧對象」「塑膠姊妹」
   - 生活場景：「深夜」「下班後」「週一症候群」
   - 翻譯機：把專業術語翻成大白話

4. 結尾要有互動感
   - 召喚同類：「舉手我看看我不孤單🙋‍♀️」
   - 二選一提問：「你是 A 還是 B？」
   - 引導留言：「留言告訴我...」

=== 範例參考 ===

如果交叉點是：
- 受眾：遇到瓶頸的資深命理師
- 子主題：高價產品設計
- 痛點：服務很好但價格拉不高，不敢漲價

應該生成類似這樣的選題：

選題一（結合 MBTI）：
「INFJ 的命理師是不是都有『金錢羞恥症』？
明明算得很準，客人問價格時卻想躲起來...
其實你不是貪財，你是需要被肯定。」

選題二（結合反差+翻譯機）：
「『收費便宜是在幫客戶』這句話其實是在害他？
用大白話講：免費的建議沒人聽，收 3600 他才會把你當神拜。
這是我悟出的血淚教訓...」

選題三（結合提問型）：
「好奇問一下，有多少老師跟我一樣，
明明實力很強，但看到別的『半桶水』收費比自己高，
心裡超不平衡？
舉手我看看我不孤單🙋‍♀️」

=== 隨機種子 ===
${randomSeed}

=== 輸出格式 ===
請用 JSON 格式回應：
{
  "topics": [
    {
      "title": "選題標題（完整的發文開頭）",
      "viralElements": ["使用的流量密碼1", "使用的流量密碼2"],
      "hookType": "hook 類型（鏡像/反差/提問/場景）",
      "targetEmotion": "目標情緒（共鳴/好奇/焦慮/渴望）",
      "suggestedCTA": "建議的 CTA"
    }
  ]
}

只輸出 JSON，不要其他文字。`;

        const response = await invokeLLM({
          messages: [
            { role: "system", content: "你是一位專業的 Threads 爆款內容專家，擅長生成能打中人心的選題和標題。" },
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
                        title: { type: "string", description: "選題標題" },
                        viralElements: { 
                          type: "array", 
                          items: { type: "string" },
                          description: "使用的流量密碼" 
                        },
                        hookType: { type: "string", description: "Hook 類型" },
                        targetEmotion: { type: "string", description: "目標情緒" },
                        suggestedCTA: { type: "string", description: "建議的 CTA" }
                      },
                      required: ["title", "viralElements", "hookType", "targetEmotion", "suggestedCTA"],
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

    // 批次刪除草稿
    batchDelete: protectedProcedure
      .input(z.object({ ids: z.array(z.number()) }))
      .mutation(async ({ ctx, input }) => {
        const count = await db.batchDeleteDrafts(ctx.user.id, input.ids);
        return { count };
      }),

    // 批次移動分類
    batchMove: protectedProcedure
      .input(z.object({ 
        ids: z.array(z.number()),
        contentType: z.string()
      }))
      .mutation(async ({ ctx, input }) => {
        const count = await db.batchMoveDrafts(ctx.user.id, input.ids, input.contentType);
        return { count };
      }),

    // 批次封存
    batchArchive: protectedProcedure
      .input(z.object({ ids: z.array(z.number()) }))
      .mutation(async ({ ctx, input }) => {
        const count = await db.batchArchiveDrafts(ctx.user.id, input.ids);
        return { count };
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
        const growthMetrics = await db.getUserGrowthMetrics(ctx.user.id);
        
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
        
        // 經營階段軟性權重策略
        const currentStage = growthMetrics?.currentStage || 'startup';
        const stageStrategy = {
          startup: {
            description: '起步階段（建立人設與信任）',
            recommendedTypes: ['story', 'knowledge', 'casual', 'viewpoint'],
            avoidTypes: ['limited_offer', 'lead_promo'],
            tips: '多分享個人故事和專業知識，建立人設和信任感，先不要推銷'
          },
          growth: {
            description: '成長階段（擴大影響力）',
            recommendedTypes: ['question', 'poll', 'contrast', 'dialogue', 'diagnosis'],
            avoidTypes: ['limited_offer'],
            tips: '多用互動型內容拉高留言，診斷型貼文很適合這個階段'
          },
          monetize: {
            description: '變現階段（開始轉化）',
            recommendedTypes: ['success_story', 'lead_magnet', 'service_intro', 'knowledge'],
            avoidTypes: [],
            tips: '可以開始帶入產品和服務，但要自然不硬銷'
          },
          scale: {
            description: '擴張階段（穩定輸出）',
            recommendedTypes: ['success_story', 'knowledge', 'viewpoint', 'summary'],
            avoidTypes: [],
            tips: '分享成功案例和方法論，建立權威地位'
          }
        };
        
        const strategy = stageStrategy[currentStage as keyof typeof stageStrategy] || stageStrategy.startup;
        
        // ✅ P0+P1 優化：取得選題庫和群集數據
        const topicSuggestions = await db.getRandomTopicSuggestions(5);
        const clusters = await db.getContentClusters();
        
        // ✅ 整合 52 個關鍵字數據：根據用戶輸入的參考方向查詢市場數據
        const searchContent = input.topic || profile?.occupation || '';
        const matchingKeywords = await db.findMatchingKeywords(searchContent);
        const viralFactorsPrompt = db.buildViralFactorsPrompt(matchingKeywords);
        
        // 建構選題庫參考
        let topicLibraryContext = '';
        if (topicSuggestions.length > 0) {
          topicLibraryContext = `\n=== 選題庫參考（經過驗證的高表現選題模板） ===\n`;
          topicSuggestions.forEach((t, i) => {
            topicLibraryContext += `${i + 1}. [主題${t.cluster || ''}] ${t.theme || ''}：${t.template || ''}\n`;
          });
          topicLibraryContext += `\n請參考以上選題模板的結構和切入點，但要結合創作者的專業領域和受眾痛點來調整。\n`;
        }
        
        // 建構群集資訊
        let clusterContext = '';
        if (clusters.length > 0) {
          clusterContext = `\n=== 內容群集分析（爆文率參考） ===\n`;
          clusters.forEach(c => {
            const top10Rate = c.top10Rate ? (c.top10Rate * 100).toFixed(1) : '0';
            clusterContext += `- 群集${c.clusterId}：${c.themeKeywords || ''}（爆文率 ${top10Rate}%）\n`;
          });
        }
        
        const systemPrompt = `${SYSTEM_PROMPTS.contentGeneration}

=== 創作者 IP 地基（必須參考） ===
${ipContext || '未設定'}

=== 目標受眾（必須針對他們的痛點） ===
${audienceContext || '未設定'}

=== 產品服務 ===
${coreProduct ? `核心產品：${coreProduct.name}` : '未設定'}

=== 經營階段策略（軟性權重，依此傾向但不強制） ===
當前階段：${strategy.description}
推薦內容類型：${strategy.recommendedTypes.join('、')}
建議避免：${strategy.avoidTypes.length > 0 ? strategy.avoidTypes.join('、') : '無'}
策略提示：${strategy.tips}

=== 重要指示 ===
1. 主題必須與創作者的專業領域相關
2. 主題必須能觸動目標受眾的痛點
3. 建議的內容類型要符合主題特性
4. 每個主題都要能展現創作者的人設
5. 優先推薦符合當前經營階段的內容類型（但不強制）
6. 參考選題庫的模板結構，但要結合創作者特色來調整
7. 優先選擇爆文率較高的內容群集主題
8. 開頭 Hook 要符合爆文因子建議（結果導向、避免 CTA 硬塞）
${topicLibraryContext}
${clusterContext}
${viralFactorsPrompt}`;

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

contentType 可選值：knowledge(知識型), summary(懶人包), story(故事型), viewpoint(觀點型), contrast(反差型), casual(日常閃文), dialogue(對話型), question(提問型), poll(投票型), quote(金句型), diagnosis(診斷型)

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
        
        // ✅ P0+P1 優化：取得爆款開頭範例
        const viralOpeners = await db.getViralOpeners({ keyword: input.topic, limit: 5 });
        let viralOpenersContext = '';
        if (viralOpeners.length > 0) {
          viralOpenersContext = `\n=== 爆款開頭範例（參考結構，不要複製） ===\n`;
          viralOpeners.forEach((o, i) => {
            viralOpenersContext += `${i + 1}. 「${o.opener50}」（${o.likes} 讚）\n`;
          });
          viralOpenersContext += `\n請參考以上開頭的結構和語氣，但要結合創作者的風格來調整。\n`;
        }
        
        const systemPrompt = `${SYSTEM_PROMPTS.contentGeneration}

=== 創作者 IP 地基 ===
${ipContext || '未設定'}

=== 目標受眾 ===
${audienceContext || '未設定'}

=== Hook 風格指南 ===
${selectedStyle}
${viralOpenersContext}
=== 重要指示 ===
1. 每個 Hook 不超過 15 字（理想 10 字）
2. Hook 要能讓人停下來想繼續看
3. 符合創作者的語氣風格
4. 針對受眾的痛點
5. 用短句抓注意力，像真人說話`;

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
        // 生成模式：light(輕度優化) / preserve(風格保留) / rewrite(爆款改寫)
        editMode: z.enum(['light', 'preserve', 'rewrite']).optional().default('rewrite'),
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
          // 診斷型貼文欄位
          symptoms: z.string().optional(),
          diagnosis_label: z.string().optional(),
          explanation: z.string().optional(),
          // 整理型貼文欄位
          summary_topic: z.string().optional(),
          raw_data: z.string().optional(),
          save_what: z.string().optional(),
          // 故事型貼文欄位
          event_conflict: z.string().optional(),
          turning_point: z.string().optional(),
          emotion_change: z.string().optional(),
          core_insight: z.string().optional(),
          story_source: z.string().optional(),
          // 知識型貼文欄位
          specific_problem: z.string().optional(),
          professional_concept: z.string().optional(),
          key_points: z.string().optional(),
          // 觀點型貼文欄位
          phenomenon: z.string().optional(),
          unique_stance: z.string().optional(),
          underlying_value: z.string().optional(),
          // 對話型貼文欄位
          dialogue_roles: z.string().optional(),
          situation_conflict: z.string().optional(),
          punchline: z.string().optional(),
          // 投票型貼文欄位
          binary_choice: z.string().optional(),
          survey_purpose: z.string().optional(),
        }).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        console.log('[generateDraft] Input received:', JSON.stringify(input, null, 2));
        console.log('[generateDraft] flexibleInput type:', typeof input.flexibleInput);
        console.log('[generateDraft] flexibleInput value:', input.flexibleInput);
        
        // ----------------- normalize flexibleInput -----------------
        const normalizeFlexibleInput = (fi: any) => {
          if (!fi) return { options: [] };
          const out: any = { ...fi };

          // options 可能為字串 / 物件 / 陣列 — 保證成為陣列
          if (out.options && !Array.isArray(out.options)) {
            if (typeof out.options === 'string') {
              out.options = out.options
                .split(/\s*(?:\r?\n|,|;|\/|vs|\|)\s*/i)
                .map((s: string) => s.trim())
                .filter(Boolean);
            } else if (typeof out.options === 'object' && out.options !== null) {
              try {
                out.options = Object.values(out.options).map(String).map((s: string) => s.trim()).filter(Boolean);
              } catch {
                out.options = [];
              }
            } else {
              out.options = [];
            }
          }
          
          // 確保 options 始終是陣列
          if (!out.options) {
            out.options = [];
          }

          // 其餘常見欄位確保為 string（避免 object 被 template 或 spread）
          const stringKeys = [
            // 提問型
            'simple_topic','target_audience','topic',
            // 投票型
            'binary_choice','survey_purpose',
            // 觀點型
            'phenomenon','unique_stance','underlying_value','stance','reason',
            // 反差型
            'two_opposites','specific_scene','purpose','common_belief','truth',
            // 閒聊型
            'current_mood','life_fragment',
            // 對話型
            'dialogue_roles','situation_conflict','punchline','question','context',
            // 引用型
            'original_quote','your_reaction','extended_view','quote','reflection',
            // 診斷型
            'symptoms','diagnosis_label','explanation',
            // 整理型
            'summary_topic','raw_data','save_what',
            // 故事型
            'story_source','event_conflict','turning_point','emotion_change','core_insight',
            // 知識型
            'specific_problem','professional_concept','key_points',
            // 其他
            'count'
          ];
          for (const k of stringKeys) {
            if (out[k] !== undefined && out[k] !== null && typeof out[k] !== 'string') {
              try { out[k] = String(out[k]); } catch { out[k] = ''; }
            }
          }

          return out;
        };

        const flexibleInput = normalizeFlexibleInput(input.flexibleInput);

        // 開發時 debug log
        console.log('[generateDraft] normalized flexibleInput:', JSON.stringify(flexibleInput, null, 2));
        console.log('[generateDraft] contentType:', input.contentType);
        console.log('[generateDraft] summary_topic:', flexibleInput.summary_topic);
        console.log('[generateDraft] raw_data:', flexibleInput.raw_data);
        console.log('[generateDraft] save_what:', flexibleInput.save_what);
        // -----------------------------------------------------------------
        
        const profile = await db.getIpProfileByUserId(ctx.user.id);
        const audiences = await db.getAudienceSegmentsByUserId(ctx.user.id);
        const contentPillars = await db.getContentPillarsByUserId(ctx.user.id);
        const userStyle = await db.getUserWritingStyle(ctx.user.id);
        
        const contentTypeInfo = CONTENT_TYPES_WITH_VIRAL_ELEMENTS.find(t => t.id === input.contentType) as any;
        
        // === 爆文因子系統：根據內容查詢市場數據 ===
        const materialContent = input.material || flexibleInput.topic || flexibleInput.question || '';
        const matchingKeywords = await db.findMatchingKeywords(materialContent);
        const viralFactorsPrompt = db.buildViralFactorsPrompt(matchingKeywords);
        
        // === 開頭鉤子庫：根據內容類型取得推薦鉤子 ===
        const recommendedHooks = await db.getRecommendedHooks(input.contentType, 3);
        const hooksPrompt = db.buildHooksPrompt(recommendedHooks);
        
        // ✅ P0+P1 優化：Few-Shot Learning - 取得爆款貼文範例
        const fewShotPrompt = await db.buildFewShotPrompt(materialContent, 3);
        
        // ✅ 數據驅動三層提示詞系統（新增）
        const dataDrivenContext = await collectDataDrivenContext(input.contentType, materialContent);
        const selectedOpenerPattern = dataDrivenContext.selectedOpenerPattern;
        const materialKeywords = dataDrivenContext.materialKeywords;
        
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
          
          // 英雄旅程故事（動態綁定版 - 根據內容類型選擇性注入）
          if (profile?.heroJourneyOrigin || profile?.heroJourneyProcess || profile?.heroJourneyHero || profile?.heroJourneyMission) {
            // 根據內容類型決定是否注入英雄旅程
            const contentType = input.contentType || '';
            const shouldInjectStory = Math.random() < 0.7; // 70% 機率注入
            
            // 完整注入的類型：故事型、自介型
            const fullInjectionTypes = ['story', 'profile_intro'];
            // 部分注入的類型：觀點型、知識型、引用型
            const partialInjectionTypes = ['viewpoint', 'knowledge', 'quote', 'contrast'];
            // 不注入的類型：提問型、投票型、閃聊型
            const noInjectionTypes = ['question', 'poll', 'casual', 'dialogue'];
            
            if (fullInjectionTypes.includes(contentType)) {
              // 完整注入英雄旅程
              parts.push(`【你的英雄旅程故事 - 可在內容中展現】`);
              parts.push(`這是你的真實故事，可以完整引用或片段引用：`);
              if (profile?.heroJourneyOrigin) {
                parts.push(`  • 緣起：${profile.heroJourneyOrigin}`);
              }
              if (profile?.heroJourneyProcess) {
                parts.push(`  • 過程：${profile.heroJourneyProcess}`);
              }
              if (profile?.heroJourneyHero) {
                parts.push(`  • 轉折：${profile.heroJourneyHero}`);
              }
              if (profile?.heroJourneyMission) {
                parts.push(`  • 使命：${profile.heroJourneyMission}`);
              }
            } else if (partialInjectionTypes.includes(contentType) && shouldInjectStory) {
              // 部分注入：根據類型選擇適合的段落
              parts.push(`【你的真實經歷 - 可選擇性引用】`);
              
              if (contentType === 'viewpoint' && profile?.heroJourneyHero) {
                // 觀點型：用「轉折」佐證觀點
                parts.push(`你可以用這個經歷支撐你的觀點：`);
                parts.push(`  • 轉折點：${profile.heroJourneyHero}`);
                parts.push(`  → 可用「因為我經歷過...」來支撐觀點`);
              } else if (contentType === 'knowledge' && profile?.heroJourneyProcess) {
                // 知識型：用「過程/失敗」增加親切感
                parts.push(`你可以用這個經歷讓內容更有溫度：`);
                parts.push(`  • 曾經的困難：${profile.heroJourneyProcess}`);
                parts.push(`  → 可用「我以前也...」帶入個人經驗`);
              } else if ((contentType === 'quote' || contentType === 'contrast') && profile?.heroJourneyOrigin) {
                // 引用型/反差型：用「緣起」建立共鳴
                parts.push(`你可以用這個經歷建立共鳴：`);
                parts.push(`  • 緣起：${profile.heroJourneyOrigin}`);
              }
            }
            // noInjectionTypes 不注入任何英雄旅程內容
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
        
        // 建構用戶風格資料（從資料庫欄位）- 含 Few-Shot Learning
        const buildUserStyleContext = async () => {
          // 檢查是否有風格資料或範文
          if (!userStyle?.toneStyle && (!userStyle?.samplePosts || (userStyle.samplePosts as any[]).length === 0)) {
            return '';
          }
          
          const parts: string[] = [];
          
          parts.push(`【用戶寫作風格分析 - 學習精神而非句式】`);
          parts.push(`重要：你要學習的是這位創作者的「說話精神」和「語氣感覺」，不是複製他的句子。`);
          parts.push(`禁止：直接套用範文中的開頭句式，每篇文章都要有新的開頭方式。`);
          
          // 風格描述（強調精神而非句式）
          if (userStyle?.toneStyle) {
            parts.push(``);
            parts.push(`【風格精神】`);
            parts.push(`  • 語氣感覺：${userStyle.toneStyle}`);
          }
          // 不再直接列出常用句式，改為描述風格特徵
          if (userStyle?.commonPhrases && (userStyle.commonPhrases as string[]).length > 0) {
            // 分析句式特徵而非列出具體句子
            const phrases = userStyle.commonPhrases as string[];
            const styleHints: string[] = [];
            if (phrases.some(p => p.includes('你') || p.includes('大家'))) styleHints.push('喜歡直接跟讀者對話');
            if (phrases.some(p => p.includes('?') || p.includes('？'))) styleHints.push('常用反問句');
            if (phrases.some(p => p.includes('真的') || p.includes('其實'))) styleHints.push('喜歡用語氣詞強調');
            if (phrases.some(p => p.includes('後來') || p.includes('後來我'))) styleHints.push('喜歡用轉折句');
            if (styleHints.length > 0) {
              parts.push(`  • 句式特徵：${styleHints.join('、')}`);
            }
          }
          if (userStyle?.catchphrases && (userStyle.catchphrases as string[]).length > 0) {
            // 口頭禪可以保留，但要加上使用限制
            parts.push(`  • 口頭禪（偶爾使用，不要每篇都用）：${(userStyle.catchphrases as string[]).slice(0, 3).join('、')}`);
          }
          if (userStyle?.hookStylePreference) {
            parts.push(`  • 擅長的 Hook 類型：${userStyle.hookStylePreference}`);
          }
          if (userStyle?.metaphorStyle) {
            parts.push(`  • 比喻風格：${userStyle.metaphorStyle}`);
          }
          if (userStyle?.emotionRhythm) {
            parts.push(`  • 情緒節奏：${userStyle.emotionRhythm}`);
          }
          if (userStyle?.viralElements) {
            const ve = userStyle.viralElements as any;
            if (ve.identityTags && ve.identityTags.length > 0) {
              parts.push(`  • 常用身分標籤：${ve.identityTags.slice(0, 3).join('、')}`);
            }
            if (ve.emotionWords && ve.emotionWords.length > 0) {
              parts.push(`  • 常用情緒詞：${ve.emotionWords.slice(0, 3).join('、')}`);
            }
          }
          
          // === 爆文分析結果：回饋到生成策略 ===
          const ipProfile = await db.getIpProfile(ctx.user.id);
          if (ipProfile?.viralPatterns) {
            parts.push(``);
            parts.push(`=== 你的爆文模式分析 ===`);
            parts.push(`以下是你過去爆文的成功分析，請在生成新內容時參考這些模式：`);
            parts.push(ipProfile.viralPatterns);
            parts.push(``);
          }
          if (ipProfile?.bestPostingTime) {
            parts.push(`【最佳發文時段】${ipProfile.bestPostingTime}`);
          }
          if (ipProfile?.aiStrategySummary) {
            parts.push(``);
            parts.push(`=== AI 策略建議 ===`);
            parts.push(ipProfile.aiStrategySummary.substring(0, 500)); // 取前 500 字避免過長
            parts.push(``);
          }
          
          // === Few-Shot Learning：隨機選取 1 篇範文作為參考 ===
          const samplePosts = userStyle?.samplePosts as Array<{ content: string; engagement?: number; addedAt: string }> | undefined;
          if (samplePosts && samplePosts.length > 0) {
            parts.push(``);
            parts.push(`=== 風格參考範文（學習精神，不是複製） ===`);
            parts.push(`重要指示：`);
            parts.push(`  1. 學習範文的「語氣感覺」和「節奏」，不是複製句子`);
            parts.push(`  2. 絕對禁止直接使用範文中的開頭句式`);
            parts.push(`  3. 每篇文章都要有全新的開頭，不能重複`);
            parts.push(`  4. 口頭禪和語氣詞可以偶爾使用，但不要每篇都用`);
            parts.push(``);
            
            // 隨機選取 1 篇範文（而非固定前 3 篇）
            const randomIndex = Math.floor(Math.random() * samplePosts.length);
            const selectedPost = samplePosts[randomIndex];
            
            parts.push(`--- 風格參考 ---`);
            parts.push(selectedPost.content);
            parts.push(`--- 參考結束 ---`);
            parts.push(``);
            parts.push(`【學習要點 - 學精神不學句子】`);
            parts.push(`✓ 學習：句子長短的節奏、換行的頻率、說話的語氣`);
            parts.push(`✗ 禁止：複製開頭句式、重複使用同樣的句型、每篇都用一樣的開場白`);
          }
          
          return parts.join('\n');
        };
        
        // 根據內容類型生成不同的提示詞
        const typeSpecificPrompts: Record<string, string> = {
          question: `寫一篇「提問型」貼文，引發討論。

主題：${flexibleInput.simple_topic || flexibleInput.topic || input.material || ''}
目標受眾：${flexibleInput.target_audience || ''}

結構要求：
1. 直接拋出問題，不需要長篇大論
2. 可以加一兩句背景說明
3. 結尾用「你們覺得呢？」或「想聽聽大家的看法」

風格：像在跟朋友聊天，真心想知道別人的想法`,
          
          poll: `寫一篇「投票型」貼文，讓大家選擇。

二選一情境：${flexibleInput.binary_choice || input.material || ''}
調查目的：${flexibleInput.survey_purpose || ''}

結構要求：
1. 簡短介紹投票主題
2. 列出選項（用 A/B 或數字標註）
3. 結尾用「留言告訴我你的選擇」

風格：輕鬆有趣，讓人想參與`,
          
          viewpoint: `寫一篇「觀點型」貼文，表達立場。

觀察到的現象：${flexibleInput.phenomenon || ''}
你的獨特立場：${flexibleInput.unique_stance || flexibleInput.stance || input.material || ''}
背後的價值觀：${flexibleInput.underlying_value || flexibleInput.reason || ''}

結構要求：
1. 開頭直接說出你的立場
2. 用 2-3 個論點支撐
3. 結尾邀請討論：「你們怎麼看？」

風格：有立場但不激進，歡迎不同聲音`,
          
          contrast: `寫一篇「反差型」貼文，打破認知。

兩個對立面：${flexibleInput.two_opposites || flexibleInput.common_belief || ''}
具體場景：${flexibleInput.specific_scene || ''}
目的：${flexibleInput.purpose || flexibleInput.truth || ''}

結構要求：
1. 開頭：「很多人以為...」
2. 轉折：「但其實...」
3. 解釋為什麼
4. 結尾問：「你也有這種經驗嗎？」

風格：驚喜感，讓人想分享`,
          
          casual: `寫一篇「閒聊型」貼文，輕鬆分享。

當下心情/狀態：${flexibleInput.current_mood || ''}
生活片段：${flexibleInput.life_fragment || flexibleInput.topic || input.material || ''}

結構要求：
1. 像在跟朋友聊天
2. 不需要完整結構
3. 結尾可以問「你們有過這種經驗嗎？」

風格：輕鬆自然，像日記`,
          
          dialogue: `寫一篇「對話型」貼文，問答形式。

對話角色：${flexibleInput.dialogue_roles || ''}
情境/衝突：${flexibleInput.situation_conflict || flexibleInput.question || ''}
金句/亮點：${flexibleInput.punchline || flexibleInput.context || ''}

結構要求：
1. 開頭：「最近有人問我...」或「朋友問我...」
2. 分享你的回答
3. 結尾問：「你們會怎麼回答？」

風格：像在跟朋友分享對話`,
          
          quote: `寫一篇「引用型」貼文，分享感想。

原文引用：${flexibleInput.original_quote || flexibleInput.quote || ''}
你的反應：${flexibleInput.your_reaction || ''}
延伸觀點：${flexibleInput.extended_view || flexibleInput.reflection || ''}

結構要求：
1. 開頭引用這句話
2. 分享你的解讀或經歷
3. 結尾問：「這句話對你來說有什麼意義？」

風格：有深度但不說教`,
          
          diagnosis: `寫一篇「診斷型」貼文，幫讀者診斷問題。

特徵/症狀：${flexibleInput.symptoms || input.material || ''}
診斷標籤：${flexibleInput.diagnosis_label || ''}
解析：${flexibleInput.explanation || ''}

結構要求（嚴格遵守）：
1. 特徵召喚：開頭用「如果你經常...」「你有沒有這種經驗...」
   - 列出 2-3 個具體特徵，讓讀者對號入座
   - 特徵要具體、生活化，不要抽象
2. 標籤揭曉：「那你可能是...」
   - 給一個有趣或有共鳴的標籤
   - 標籤要正面或中性，不要負面
3. 簡單解析：為什麼會有這種特徵
   - 1-2 句話解釋原因
   - 讓讀者感到被理解
4. CTA：「你是哪一型？」「有沒有中？」
   - 邀請讀者留言分享

風格：像朋友幫你分析，有溫度不評判，讓讀者產生強烈的共鳴感，覺得「這就是在說我」`,
          
          summary: `寫一篇「整理型」貼文（懶人包），讓讀者想「收藏」。

整理主題：${flexibleInput.summary_topic || input.material || ''}
原始資料/清單：${flexibleInput.raw_data || ''}
節省了什麼：${flexibleInput.save_what || ''}

結構要求（嚴格遵守）：
1. 開頭必須有數字：「5個」「3種」「7件事」
   - 數字要具體，不要用「幾個」「一些」
2. 每點獨立成段，每點都是可單獨截圖的金句
   - 每點不超過 2-3 行
   - 用 Emoji 作為清單開頭（✨/👉/🔮）
3. 結尾問：「你中了幾個？」「還有什麼想補充的？」

風格：像在幫朋友整理資訊，讓人想收藏`,
          
          story: `寫一篇「故事型」貼文，建立信任與個人品牌。

故事來源：${flexibleInput.story_source === 'self' ? '自己的故事' : '案例故事（個案/客戶）'}
具體事件/衝突點：${flexibleInput.event_conflict || input.material || ''}
轉折點：${flexibleInput.turning_point || ''}
情感變化：${flexibleInput.emotion_change || ''}
核心啟發：${flexibleInput.core_insight || ''}

結構要求（英雄旅程架構）：
1. 開頭用具體時間和人物製造真實感：「昨天」「上週」「前幾天」
2. 描述衝突/困境：讓讀者產生共鳴
3. 帶入轉折點：「沒想到」「結果」「後來」
4. 展現情感變化：讓故事更有溫度
5. 結尾帶出核心啟發：「這件事讓我明白...」
6. 最後用開放式問題引導互動

風格：像在跟朋友分享真實經歷，有溫度有轉折`,
          
          knowledge: `寫一篇「知識型」貼文，展現專業但要「說人話」。

解決的具體問題：${flexibleInput.specific_problem || input.material || ''}
專業概念的「白話翻譯」：${flexibleInput.professional_concept || ''}
步驟或重點：${flexibleInput.key_points || ''}

結構要求（目標是讓「小學五年級」都能懂）：
1. 開頭用數字或問題：「90%的人都不知道...」「你有沒有想過...」
2. 歸納成 3 個重點/步驟，分點清晰
3. 每點獨立成金句，用大白話解釋專業概念
4. 結尾給行動建議：「下次遇到這種情況，你可以...」

風格：像在跟朋友分享實用技巧，不說教`,
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
        const userStyleContext = await buildUserStyleContext();
        
        // 經營階段軟性權重
        const growthMetrics = await db.getUserGrowthMetrics(ctx.user.id);
        const currentStage = growthMetrics?.currentStage || 'startup';
        const stageStrategy: Record<string, { description: string; tips: string }> = {
          startup: {
            description: '起步階段（建立人設與信任）',
            tips: '多分享個人故事和專業知識，建立人設和信任感，先不要推銷'
          },
          growth: {
            description: '成長階段（擴大影響力）',
            tips: '增加互動型內容，引導加入 LINE 或電子報'
          },
          monetization: {
            description: '變現階段（導入產品）',
            tips: '可以開始分享產品相關內容，但仍要保持 70% 情緒內容'
          },
          scaling: {
            description: '規模化階段（系統化運營）',
            tips: '可以更積極推廣產品，建立自動化流程'
          }
        };
        const strategy = stageStrategy[currentStage] || stageStrategy.startup;
        
        // 取得爆款元素提示
        const viralElements = contentTypeInfo?.viralElements;
        const viralElementsPrompt = viralElements ? `
=== 爆款元素提示（請務必參考） ===
【開頭技巧】${viralElements.hookTips}
【內容技巧】${viralElements.contentTips}
【互動技巧】${viralElements.ctaTips}
【避免事項】${viralElements.avoidTips}` : '';
        
        // ✅ 進階模式整合選題庫和群集數據
        const topicSuggestions = await db.getRandomTopicSuggestions(3);
        const clusters = await db.getContentClusters();
        
        // 建構選題庫參考
        let topicLibraryContext = '';
        if (topicSuggestions.length > 0) {
          topicLibraryContext = `\n=== 選題庫參考（結構參考） ===\n`;
          topicSuggestions.forEach((t, i) => {
            topicLibraryContext += `${i + 1}. ${t.template || ''}\n`;
          });
        }
        
        // 建構群集資訊
        let clusterContext = '';
        if (clusters.length > 0) {
          // 根據內容類型推薦適合的群集
          const relevantClusters = clusters.filter(c => c.top10Rate && c.top10Rate > 0.05).slice(0, 3);
          if (relevantClusters.length > 0) {
            clusterContext = `\n=== 高爆文率內容群集（參考主題方向） ===\n`;
            relevantClusters.forEach(c => {
              const top10Rate = c.top10Rate ? (c.top10Rate * 100).toFixed(1) : '0';
              clusterContext += `- ${c.themeKeywords || ''}（爆文率 ${top10Rate}%）\n`;
            });
          }
        }
        
        // ✅ 根據內容類型動態設定字數限制
        const contentTypeWordLimits: Record<string, { min: number; max: number; style: string }> = {
          // 短型內容（150-200 字）
          casual: { min: 150, max: 200, style: '短小精悄、一個核心觀點、快速引發互動' },
          viewpoint: { min: 150, max: 200, style: '短小精悄、一個核心觀點、快速引發互動' },
          question: { min: 150, max: 200, style: '短小精悄、一個核心觀點、快速引發互動' },
          poll: { min: 150, max: 200, style: '短小精悄、一個核心觀點、快速引發互動' },
          dialogue: { min: 150, max: 200, style: '短小精悄、一個核心觀點、快速引發互動' },
          // 中型內容（300-400 字）
          story: { min: 300, max: 400, style: '有轉折、有情緒推進、但不囉唆' },
          observation: { min: 300, max: 400, style: '有轉折、有情緒推進、但不囉唆' },
          quote: { min: 300, max: 400, style: '有轉折、有情緒推進、但不囉唆' },
          contrast: { min: 300, max: 400, style: '有轉折、有情緒推進、但不囉唆' },
          diagnosis: { min: 300, max: 400, style: '有轉折、有情緒推進、但不囉唆' },
          // 長型內容（400-500 字）
          knowledge: { min: 400, max: 500, style: '有乾貨、但要用故事包裝，不是条列式' },
          teaching: { min: 400, max: 500, style: '有乾貨、但要用故事包裝，不是条列式' },
          list: { min: 400, max: 500, style: '有乾貨、但要用故事包裝，不是条列式' },
          summary: { min: 400, max: 500, style: '有乾貨、但要用故事包裝，不是条列式' },
        };
        const wordLimit = contentTypeWordLimits[input.contentType] || { min: 300, max: 400, style: '適中長度、有轉折' };
        
        // 建構明確的字數限制提示
        const wordLimitPrompt = `
=== ❗❗❗ 字數限制（強制執行，超過 = 失敗） ❗❗❗ ===
【當前內容類型】${contentTypeInfo?.name || input.contentType}
【字數範圍】${wordLimit.min}-${wordLimit.max} 字（含空格和換行）
【風格要求】${wordLimit.style}
【重要】超過 ${wordLimit.max} 字 = 失敗，必須精簡！少於 ${wordLimit.min} 字 = 內容不足！`;

        const systemPrompt = `${SYSTEM_PROMPTS.contentGeneration}

=== 創作者 IP 地基（必須在內容中展現） ===
${ipContext || '未設定 IP 地基，請用通用風格寫作。'}

${audienceContext}

${contentPillarsContext}

${userStyleContext}

=== 經營階段策略（軟性權重） ===
當前階段：${strategy.description}
策略提示：${strategy.tips}

=== 內容類型 ===
類型：${contentTypeInfo?.name || input.contentType}
說明：${contentTypeInfo?.description || ''}
${viralElementsPrompt}
${wordLimitPrompt}

${viralFactorsPrompt}

${hooksPrompt}

${fewShotPrompt}
${topicLibraryContext}
${clusterContext}

=== 四透鏡框架（創作時必須檢核） ===

### 心法透鏡 - 這篇文案傳遞的是渴望還是焦慮？
- 必須是「渴望導向」，讓讀者看完感到希望和期待
- 禁止恐懼行銷或焦慮製造

### 人設透鏡 - 這篇文案像不像你說的話？
- 必須有個人特色和獨特觀點
- 保持與創作者人設三支柱一致

### 結構透鏡 - 這篇文案好不好吸收？
- 結構清晰，有邏輯脈絡
- 不是東一句西一句

### 轉化透鏡 - 讀者看完要做什麼？
- 必須有明確的下一步行動
- 優先使用「召喚同類」或「二選一提問」的 CTA

=== Translation 翻譯機（必須執行） ===
- 所有專業術語必須翻譯成「比喻」或「白話」
- 例如：「悲傷就像檔案下載太慢，卡在 90% 就是不動」
- 小學五年級都能懂的程度
- 每個抽象概念都要有具體的比喻或場景

=== Threads 爆款風格（最重要 - 必須嚴格執行） ===

### 字數限制（已在上方「內容類型」區塊動態設定，請嚴格遵守）

### 口語化原則（像傳訊息給朋友）
1. 【傳訊息感】像在 LINE 跟朋友聊天，不是寫部落格文章
2. 【省略主詞】可以省略「我」，例如：「真的超累」而不是「我真的超累」
3. 【不完整句】可以用不完整的句子，例如：「結果呢？」「就這樣。」
4. 【語助詞大量用】「真的」「超」「欹」「啊」「吧」「呢」「啦」「耶」「齁」
5. 【情緒詞】「幹」「靠北」「傻眼」「傻爆」「無言」「傅服」（適度使用）
6. 【口語表達】「說真的」「老實說」「不騙你」「講真的」

### 呼吸感排版
1. 【段落結構】每 2-4 行為一個段落
2. 【空行規則】段落之間空一行
3. 【單句字數限制 - 極度重要】
   - 每句最多 15-20 字，理想 10-15 字
   - 超過 20 字必須斷句
   - 用逗號或另起一行來斷句
   - 範例：「我在想，如果當時沒有放棄，現在會不會不一樣」→ 「我在想。如果當時沒有放棄。現在會不會不一樣？」
4. 【節奏感】長短句交錯，開頭用短句（最好 5-10 字）

### 轉折詞（推動情緒）
「但」「結果」「後來」「沒想到」「誰知道」「重點是」「關鍵是」

=== 絕對禁止（違反 = 重寫） ===

### 禁止 AI 常用詞
- 「讓我們」「一起來」「今天要分享」「分享一下」
- 「親愛的朋友們」「各位」「大家好」
- 「在這個快節奏的時代」「在這個資訊爆炸的時代」
- 「總而言之」「總結來說」「最後」
- 「希望這篇文章對你有幫助」

### 禁止結構詞
- 「首先」「其次」「最後」「第一」「第二」「第三」
- 「接下來」「然後」（可用「後來」代替）

### 開頭規則（極度重要 - 必須嚴格執行）

「第一句必須獨立成段」：
- 第一句後必須空一行
- 第一句就是 Hook，讓人停下來

=== 數據驅動開頭規則（本次生成必須使用） ===

【本次指定開頭模式】${selectedOpenerPattern?.name || '冠號斷言'}
【效果倍數】${selectedOpenerPattern?.effect || 2.8}x
【格式說明】${selectedOpenerPattern?.instruction || '使用「主題：觀點」格式'}
【範例】
${selectedOpenerPattern?.examples?.slice(0, 3).map((e: string, i: number) => `${i + 1}. ${e}`).join('\n') || '1. 學習的真相：不是你不夠努力\n2. 90% 的人都搞錯了這件事'}

【重要】第一行必須使用上述模式，不能使用其他開頭方式！
【禁止】直接複製範例，必須根據素材內容創作新的開頭

「禁止開頭方式」：
- 不能用「你有沒有過這樣的經驗？」開頭（太制式）
- 不能用「今天想跟大家分享...」開頭
- 不能用「最近很多人問我...」開頭（除非真的有）
- 不能用「其實」「其實呢」開頭（太弱）
- 不能用「我覺得」開頭（太平）
- 不能用問句開頭（效果僅 0.4x）
- 不能用 Emoji 開頭（效果僅 0.6x）

### 禁止結尾方式
- 不能用「希望對你有幫助」結尾
- 不能用「讓我們一起...」結尾
- 不能用「加油！」「你可以的！」結尾（太雞湯）

### 排版格式規則
- 禁止：Markdown 標題符號（# ## ###）、粗體符號（**）、反引號
- 禁止：傳統數字條列（1. 2. 3.）或黑點條列（•）
- 允許：使用 Emoji 作為清單開頭（✨/👉/🔮），這在 Threads 很常見
- 限制：Emoji 條列僅限於「知識型」「整理型」貼文，故事型/閒聊型應保持自然段落

=== 重要指示 ===
1. 【精簡優先】說重點就好，不要鋪陳
2. 【語氣風格】必須用創作者的風格寫作
3. 【受眾痛點】讓讀者感受到「這就是在說我」
4. 【輸出格式】直接輸出可發布的貼文，不要任何解釋`;

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
        
        // 根據 editMode 調整生成策略
        const editMode = input.editMode || 'rewrite';
        let editModeInstruction = '';
        
        if (editMode === 'light') {
          // 輕度優化：幾乎不改變內容
          editModeInstruction = `
=== 生成模式：輕度優化 ===
重要：用戶希望保留原始素材的內容，只做最小幅度的調整。

【可以做的】
- 修正錯字、標點符號
- 調整排版（加入適當的換行和空行）
- 輕微潤飾語句（但不改變意思）

【絕對禁止】
- 不能改變敘事結構
- 不能添加新的內容或觀點
- 不能套用爆款公式
- 不能加入 Hook 或 CTA（除非原文已有）
- 不能改變語氣和風格

輸出格式：直接輸出優化後的內容，不需要三種 Hook 選項。`;
        } else if (editMode === 'preserve') {
          // 風格保留：保留敘事結構和語氣
          editModeInstruction = `
=== 生成模式：風格保留 ===
重要：用戶希望保留自己的敘事結構和語氣，只優化表達方式。

【可以做的】
- 優化句子的表達（讓它更流暢）
- 調整排版（加入呼吸感）
- 加入適當的情緒詞和語氣詞
- 強化開頭的吸引力（但保留原本的故事起點）
- 加入簡單的 CTA（如果原文沒有）

【絕對禁止】
- 不能改變敘事的主要結構和流程
- 不能添加原文沒有的情節或觀點
- 不能把故事改寫成完全不同的版本
- 不能過度「爆款化」，要保留原本的溫度和真誠感

輸出格式：直接輸出優化後的內容，不需要三種 Hook 選項。`;
        } else {
          // 爆款改寫：完整套用爆款公式（默認）
          editModeInstruction = `
=== 生成模式：爆款改寫 ===
重要：用戶希望完整套用爆款公式，讓內容更有吸引力。

【必須執行】
- 加入強力的 Hook 開頭（提供三種選項）
- 套用爆款結構（開頭、轉折、高潮、CTA）
- 加入情緒推動和轉折詞
- 加入互動引導 CTA
- 確保呼吸感排版

【可以做的】
- 重新組織內容結構
- 添加新的觀點或轉折
- 強化情緒張力

輸出格式：提供三種 Hook 選項 + 完整貼文 + CTA。`;
        }
        
        userPrompt = editModeInstruction + '\n\n' + userPrompt;
        
        // ✅ 在 User Prompt 結尾再次強調字數限制
        userPrompt += `\n\n❗❗❗ 最後提醒：此貼文字數必須在 ${wordLimit.min}-${wordLimit.max} 字之間！超過 ${wordLimit.max} 字 = 失敗，請精簡！`;

        const response = await invokeLLM({
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
          ],
        });

        await db.logApiUsage(ctx.user.id, 'generateDraft', 'llm', 600, 800);
        
        let generatedContent = typeof response.choices[0]?.message?.content === 'string' ? response.choices[0].message.content : '';
        
        // 清理 AI 內部標記和重複內容
        generatedContent = cleanAIOutput(generatedContent);
        
        // 應用漸進式去 AI 化過濾器
        const hasUserStyle = !!(userStyle && userStyle.toneStyle);
        const preservedWords = extractPreservedWords(userStyle as any);
        const emotionWords = extractEmotionWords(userStyle as any);
        generatedContent = applyContentFilters(generatedContent, {
          voiceTone: profile?.voiceTone || undefined,
          contentType: input.contentType,
          hasUserStyle,
          userPreservedWords: preservedWords,
          userEmotionWords: emotionWords,  // 用戶的情緒詞彙，用於髮話替換
          enableIdiomFilter: true,
          enableFillerFilter: true,
          enableEmotionFilter: true,
          enableSimplify: false, // 暴力降維預設關閉
        });
        
        // ✅ 字數檢查和警告
        const actualWordCount = generatedContent.length;
        let wordCountWarning = '';
        if (actualWordCount > wordLimit.max) {
          wordCountWarning = `⚠️ 字數超過上限（${actualWordCount} 字，應為 ${wordLimit.min}-${wordLimit.max} 字），建議精簡內容`;
        } else if (actualWordCount < wordLimit.min) {
          wordCountWarning = `⚠️ 字數不足（${actualWordCount} 字，應為 ${wordLimit.min}-${wordLimit.max} 字），建議補充內容`;
        }
        
        // 創建草稿
        const draft = await db.createDraft({
          userId: ctx.user.id,
          contentType: input.contentType as any,
          body: generatedContent,
        });
        
        // 生成後診斷結果（快速版 - 不額外調用 LLM）
        const quickDiagnosis = generateQuickDiagnosis(generatedContent, profile, contentTypeInfo);
        
        // 如果有字數警告，加入診斷結果
        if (wordCountWarning && quickDiagnosis.improvements) {
          quickDiagnosis.improvements.unshift({
            label: '字數控制',
            description: wordCountWarning,
            action: '建議使用「對話修改」請 AI 幫你精簡或擴充內容'
          });
        }

        // ✅ 數據驅動分析結果
        const dataDrivenAnalysis = analyzeGeneratedContent(generatedContent, input.contentType);
        
        return {
          content: generatedContent,
          draftId: draft?.id,
          diagnosis: quickDiagnosis,
          wordCount: actualWordCount,
          wordLimit: { min: wordLimit.min, max: wordLimit.max },
          // 數據驅動分析結果
          dataDriven: {
            usedOpenerPattern: selectedOpenerPattern?.name || null,
            openerEffectiveness: selectedOpenerPattern?.effect || null,
            materialKeywords: materialKeywords,
            analysis: dataDrivenAnalysis,
          },
        };
      }),

    // 生成變現內容
    generateMonetizeContent: protectedProcedure
      .input(z.object({
        contentType: z.string(),
        additionalContext: z.string().optional(),
        inputFields: z.record(z.string(), z.string()).optional(), // 動態輸入欄位
      }))
      .mutation(async ({ ctx, input }) => {
        const profile = await db.getIpProfileByUserId(ctx.user.id);
        const products = await db.getUserProductsByUserId(ctx.user.id);
        const stories = await db.getSuccessStoriesByUserId(ctx.user.id);
        const aiMemory = await db.getUserAIMemory(ctx.user.id);
        
        const coreProduct = products.find(p => p.productType === 'core');
        const leadProduct = products.find(p => p.productType === 'lead');
        
        // ✅ 爆款數據整合：取得 Few-Shot 範例和爆款開頭
        const contentTypeKeywords: Record<string, string> = {
          profile_intro: '自介 個人品牌 職業',
          plus_one: '互動 留言 免費',
          free_value: '價值 分享 教學',
          success_story: '案例 故事 轉變',
        };
        const searchKeyword = contentTypeKeywords[input.contentType] || '變現 導流';
        
        // 取得爆款貼文範例（Few-Shot Learning）
        const viralExamples = await db.getBestExamplesForKeyword(searchKeyword, 3);
        let fewShotContext = '';
        if (viralExamples.length > 0) {
          fewShotContext = `\n=== 爆款貼文範例（參考結構和語氣，不要複製內容） ===\n`;
          viralExamples.forEach((ex, i) => {
            const opener = ex.opener50 || (ex.postText ? ex.postText.substring(0, 50) : '');
            fewShotContext += `\n範例 ${i + 1}（${ex.likes} 讚）：\n開頭：「${opener}」\n`;
            if (ex.postText && ex.postText.length > 100) {
              fewShotContext += `結構特點：${ex.postText.length < 300 ? '精簡有力' : '故事完整'}，${ex.postText.includes('?') || ex.postText.includes('？') ? '有互動提問' : '直接分享'}\n`;
            }
          });
          fewShotContext += `\n請參考以上範例的開頭結構和語氣，但要結合創作者的風格來寫。\n`;
        }
        
        // 取得爆款開頭範例
        const viralOpeners = await db.getViralOpeners({ keyword: searchKeyword, limit: 5 });
        let viralOpenersContext = '';
        if (viralOpeners.length > 0) {
          viralOpenersContext = `\n=== 爆款開頭句型參考 ===\n`;
          viralOpeners.forEach((o, i) => {
            viralOpenersContext += `${i + 1}. 「${o.opener50}」（${o.likes} 讚）\n`;
          });
        }
        
        // 取得內容群集推薦
        const clusterSuggestion = await db.suggestClusterForContent(searchKeyword);
        let clusterContext = '';
        if (clusterSuggestion) {
          const top10Rate = clusterSuggestion.top10Rate ? (clusterSuggestion.top10Rate * 100).toFixed(1) : '0';
          clusterContext = `\n=== 內容群集參考 ===\n這類內容屬於「${clusterSuggestion.themeKeywords}」群集，爆文率 ${top10Rate}%\n`;
        }
        
        // ✅ 整合 52 個關鍵字數據：查詢市場數據和爆文因子建議
        const matchingKeywords = await db.findMatchingKeywords(searchKeyword);
        const viralFactorsPrompt = db.buildViralFactorsPrompt(matchingKeywords);
        
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
          profile_intro: `寫一篇「首頁自介文」，這是讓新訪客第一眼認識你的重要內容，適合置頂。

## 成功方式：建立鮮明的「品牌人設」與「價值主張」
- 內容不能像廣告，必須有「人味」
- 強調「你與別人的不同」，讓訪客一眼看出你不是一般的服務者，而是該領域的專家

## 內容結構
1. Hook 開頭：用鏡像策略讓訪客看到自己的影子
2. 我是誰：用一句話定位自己（強調差異化）
3. 我能解決什麼問題：用場景描述受眾的痛點
4. 我的成功戰績：協助多少人、創造什麼結果
5. CTA：「想認識我的可以追蹤，有問題可以私訊我」

## 風格要求
- 像朋友介紹自己，不是履歷表
- 必須展現人設三支柱（專業權威/情感共鳴/獨特觀點）
- 可以引用英雄旅程故事中的元素`,
          service_intro: `寫一篇「核心服務介紹文」。

## 成功方式：強調「縮短時間」與「成果落地」
- 核心品的價值在於「縮短學習曲線」和「手把手帶領」
- 用渴望導向，不是功能列表
- 讓讀者感受到「有人帶我走」的安心感

## 內容結構
1. Hook：用場景帶入讀者的困境
2. 共鳴：「我懂這種感覺，因為我也走過...」
3. 轉折：「後來我發現，其實只要...」
4. 服務價值：「我會帶你一步一步...」（強調手把手帶領）
5. 成果預期：「學員通常在 X 週內就能...」
6. CTA：「想了解更多可以私訊我」

## 風格要求
- 像朋友分享，不是銷售文案
- 強調「實戰感」和「成果落地」`,
          plus_one: `寫一篇「+1 互動文」，這是高轉換的導流機制。

## 成功方式：設計「篩選機制」與「預期落差」
- 「+1 文」不僅是為了高互動，更是為了篩選出「願意付出行動」的人
- 從免費群到付費群的轉化過程中，這是一個過濾網
- 讓讀者預期「免費版」與「付費版」的差異

## 內容結構
1. Hook：「我整理了一個.../我最近做了一個...」
2. 價值說明：這個資源能幫什麼忙（強調節省時間/避免踩坑）
3. 適合誰：如果你是...的人（篩選目標受眾）
4. 預告價值：「這只是我平常幫學員做的其中一小部分...」
5. CTA：「想要的留言 +1，我私訊給你」
6. 緊迫感（可選）：「這次只送 XX 份」

## 風格要求
- 真心分享，不是強迫推銷
- 展現「我有更多好東西」的感覺，讓讀者想知道付費版是什麼`,
          free_value: `寫一篇「免費價值文」，展現專業度同時吸引關注。

## 成功方式：製造「預期落差」
- 在提供免費價值時，要同時展示「付費版」與「免費版」的巨大差異
- 例如：展示一般人自己寫的 vs 你幫學員寫的差別
- 讓讀者感受到「原來還有這麼大的差距」

## 內容結構
1. Hook：「我最近發現.../很多人問我...」
2. 實用內容：分享一個具體可執行的技巧
3. 對比展示：「一般人這樣做... vs 我幫學員這樣做...」
4. 價值預告：「這只是其中一個小技巧，完整的系統還有...」
5. CTA：「覺得有幫助的可以收藏，想知道更多可以追蹤我」

## 風格要求
- 像朋友分享小技巧，不是教科書
- 讓讀者感受到「這個人真的很專業」`,
          success_story: `寫一篇「成功案例故事」，用故事展現價值。

## 成功方式：強調「縮短時間」與「成果落地」
- 核心品的價值在於「縮短學習曲線」和「手把手帶領」
- 故事要聚焦在「轉變」，不是列出功能
- 讓讀者感受到「我也可以這樣」

## 內容結構
1. Hook：「最近和一個朋友聊起.../前幾天收到一則訊息...」
2. Before：描述他之前的狀態（用場景，不用療效詞）
3. 轉折點：他做了什麼改變（強調「我帶他」的感覺）
4. After：現在的正面變化（具體數據：流量成長、營收增加、節省時間）
5. 實戰感：「我帶他一步一步...」
6. CTA：「如果你也有類似的想法，可以私訊我聊聊」

## 風格要求
- 像在跟朋友分享一個故事，不是客戶見證
- 強調「手把手帶領」的實戰感
- 禁止：「治好了」「痊癒了」「效果顪著」等醫療用語`,
          lead_magnet: `寫一篇「引流品推廣文」，介紹低門檻服務。

## 成功方式：低門檻嘗試引導
- 引流品是讓客戶「先嘗嘗看」的機會
- 強調「低風險」和「高價值」的對比
- 讓讀者感受到「這麼便宜就能得到這麼多」

## 內容結構
1. Hook：「你是不是也有這種感覺.../最近很多人問我...」
2. 共鳴：描述讀者可能的狀態（想試但不敢試）
3. 解決方案：「所以我設計了一個...」
4. 價值對比：「只要 XX 元，你就能得到...」
5. 適合誰：「如果你是...的人，這個很適合你」
6. CTA：「想先體驗看看的，可以私訊我」

## 風格要求
- 像朋友推薦，不是廣告文案
- 讓讀者感受到「這個價格試試看也不會虐」`,
          vip_service: `寫一篇「VIP 服務推廣文」，這是高價服務的軟性推廣。

## 成功方式：販售「深度陪伴」與「長期關係」
- VIP 服務賣的不是「更多功能」，而是「更深入的陪伴」
- 強調「我會跟你一起走」的夥伴關係
- 針對想要更深入理解自己、需要長期支持的人
- 讓讀者感受到「這是一段深度的陪伴旅程」

## 內容結構
1. Hook：「最近有一位個案告訴我.../有人問我能不能更深入地陪他...」
2. 共鳴：描述需要深度陪伴的人的狀態（想要更深入理解自己、需要持續支持）
3. 價值主張：「我會跟你一起走這段路...」（深度陪伴）
4. 服務內容：「包含定期諮詢/隨時討論/專屬支持...」
5. 適合誰：「如果你是想要更深入理解自己的人...」
6. CTA：「想知道這段陪伴適不適合你，可以私訊我聊聊」

## 風格要求
- 溫暖真誠，不是推銷
- 強調「我會跟你一起」的陪伴感
- 讓讀者感受到「這是一段深度的關係」
- 不用緊迫感或限時優惠`,
          passive_product: `寫一篇「數位產品推廣文」，介紹電子書、課程、模板等被動收入產品。

## 成功方式：強調「系統化」與「可複製」
- 數位產品的價值在於「把我的經驗系統化」
- 讓讀者感受到「照著做就能有結果」
- 強調「節省時間」和「避免踩坑」

## 內容結構
1. Hook：「我花了 X 年整理出來的.../很多人問我能不能把方法寫下來...」
2. 價值說明：這個產品能幫你節省什麼
3. 內容預覽：「裡面包含...」（列出 3-5 個亮點）
4. 適合誰：「如果你是...的人，這個很適合你」
5. CTA：「想要的可以私訊我，我傳連結給你」

## 風格要求
- 像朋友推薦好用的工具
- 強調「照著做就能有結果」的實用性`,
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
        
        // 英雄旅程故事（強化版 - 變現內容必須引用）
        if (profile?.heroJourneyOrigin || profile?.heroJourneyProcess || profile?.heroJourneyHero || profile?.heroJourneyMission) {
          ipContextParts.push(`【你的英雄旅程故事 - 變現內容必須引用】`);
          ipContextParts.push(`這是你的真實故事，讓讀者感受你的真誠和專業：`);
          if (profile?.heroJourneyOrigin) {
            ipContextParts.push(`  • 緣起（為什麼開始這條路）：${profile.heroJourneyOrigin}`);
            ipContextParts.push(`    → 自我介紹文必用：建立「我懂你」的共鳴`);
          }
          if (profile?.heroJourneyProcess) {
            ipContextParts.push(`  • 過程（遇到什麼困難）：${profile.heroJourneyProcess}`);
            ipContextParts.push(`    → 展現同理心：「我也曾經...」`);
          }
          if (profile?.heroJourneyHero) {
            ipContextParts.push(`  • 轉折（什麼改變了你）：${profile.heroJourneyHero}`);
            ipContextParts.push(`    → 證明方法有效：「後來我發現...」`);
          }
          if (profile?.heroJourneyMission) {
            ipContextParts.push(`  • 使命（現在想幫助誰）：${profile.heroJourneyMission}`);
            ipContextParts.push(`    → 引導行動：「所以我現在...」`);
          }
          ipContextParts.push(``);
          ipContextParts.push(`【變現內容引用指南】`);
          ipContextParts.push(`- 自我介紹文：完整引用四階段，展現你的旅程`);
          ipContextParts.push(`- 服務介紹文：引用轉折+使命，證明你為什麼能幫助他們`);
          ipContextParts.push(`- 免費價值文：引用過程，展現你懂他們的痛`);
          ipContextParts.push(`- 成功案例文：對比你的轉折和學員的轉折`);
        }
        
        // 身份標籤
        if (profile?.identityTags && profile.identityTags.length > 0) {
          ipContextParts.push(`【身份標籤】${profile.identityTags.join('、')}`);
        }
        
        const ipContext = ipContextParts.length > 0 ? ipContextParts.join('\n') : '未設定 IP 地基';
        
        const systemPrompt = `你是一位專業的 Threads 變現內容創作教練，專門幫助創作者產出高互動的變現貼文。

${hookStrategies}
${fewShotContext}
${viralOpenersContext}
${clusterContext}
${viralFactorsPrompt}
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

=== 四透鏡框架（創作時必須檢核） ===

### 心法透鏡 - 這篇文案傳遞的是渴望還是焦慮？
- 必須是「渴望導向」，讓讀者看完感到希望和期待
- 禁止恐懼行銷或焦慮製造
- 變現內容更要注意：用「渴望」引導，不是「痛苦」嚇嚇

### 人設透鏡 - 這篇文案像不像你說的話？
- 必須有個人特色和獨特觀點
- 保持與創作者人設三支柱一致
- 變現內容也要像朋友分享，不是銷售員

### 結構透鏡 - 這篇文案好不好吸收？
- 結構清晰，有邏輯脈絡
- 不是東一句西一句

### 轉化透鏡 - 讀者看完要做什麼？
- 必須有明確的下一步行動
- 優先使用「召喚同類」或「二選一提問」的 CTA
- 變現內容的 CTA 要軟性，像朋友推薦

=== Translation 翻譯機（必須執行） ===
- 所有專業術語必須翻譯成「比喻」或「白話」
- 例如：「悲傷就像檔案下載太慢，卡在 90% 就是不動」
- 小學五年級都能懂的程度
- 每個抽象概念都要有具體的比喻或場景

=== Threads 爆款風格（最重要 - 必須嚴格執行） ===

### 字數限制（絕對不能超過）
- 變現貼文：400-600 字（含空格）
- 超過字數限制 = 失敗，必須精簡

### 口語化原則（像傳訊息給朋友）
1. 【傳訊息感】像在 LINE 跟朋友聊天，不是寫部落格文章
2. 【省略主詞】可以省略「我」，例如：「真的超累」而不是「我真的超累」
3. 【不完整句】可以用不完整的句子，例如：「結果呢？」「就這樣。」
4. 【語助詞大量用】「真的」「超」「欹」「啊」「吧」「呢」「啦」「耶」
5. 【口語表達】「說真的」「老實說」「不騙你」「講真的」

### 呼吸感排版
1. 【段落結構】每 2-4 行為一個段落
2. 【空行規則】段落之間空一行
3. 【句子長度】每句 10-15 字，最多 20 字

=== 絕對禁止（違反 = 重寫） ===
- 「讓我們」「一起來」「今天要分享」「分享一下」
- 「親愛的朋友們」「各位」「大家好」
- 「首先」「其次」「最後」「第一」「第二」「第三」
- 「希望對你有幫助」「加油！」「你可以的！」
- Markdown 符號、條列式

=== 重要指示 ===
1. 【精簡優先】說重點就好，不要鋪陳
2. 【語氣風格】必須用創作者的風格寫作
3. 【原生風格】保持原生內容風格，不要像廣告
4. 【軟性 CTA】CTA 要軟性，像朋友分享
5. 【禁止硬銷】避免「限時優惠」「立即購買」等硬銷文字

=== 輸出格式 ===
直接輸出可以發布的貼文內容，不要包含任何標題、解釋、注釋或提示詞。
不要用引號或分隔線來分隔段落，直接用空行。
不要寫「標題」「開頭」「結尾」等標註。`;

        // 建構用戶輸入欄位的描述
        const inputFieldsContext: string[] = [];
        if (input.inputFields) {
          const fieldLabels: Record<string, string> = {
            offer_content: '提供的內容（留言 +1 後會得到）',
            target_pain: '目標受眾的痛點',
            product_name: '產品名稱',
            product_benefit: '產品效益',
            value_preview: '內容預告（這個內容能帶來什麼價值）',
            free_content: '免費內容',
            service_detail: '服務內容',
            transformation: '轉變效果',
            social_proof: '社會證明',
            case_background: '案例背景',
            case_transformation: '案例轉變',
            case_result: '案例結果',
            vip_benefit: 'VIP 服務效益',
            exclusivity: '專屬價值',
          };
          
          for (const [key, value] of Object.entries(input.inputFields)) {
            if (value && value.trim()) {
              const label = fieldLabels[key] || key;
              inputFieldsContext.push(`【${label}】${value}`);
            }
          }
        }
        
        const userInputContext = inputFieldsContext.length > 0 
          ? `=== 用戶提供的具體資料（必須在內容中使用） ===\n${inputFieldsContext.join('\n')}\n\n`
          : '';

        const response = await invokeLLM({
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: `${contentTypePrompts[input.contentType] || '請幫我寫一篇變現內容'}

${userInputContext}${input.additionalContext ? `補充說明：${input.additionalContext}\n\n` : ''}重要：
1. 如果用戶提供了具體資料，必須在內容中使用這些資料
2. 直接輸出可以發布的貼文，不要包含任何標題、解釋或提示詞` }
          ],
        });

        await db.logApiUsage(ctx.user.id, 'generateMonetizeContent', 'llm', 800, 1000);
        
        let generatedContent = typeof response.choices[0]?.message?.content === 'string' ? response.choices[0].message.content : '';
        
        // 清理 AI 內部標記和重複內容
        generatedContent = cleanAIOutput(generatedContent);
        
        // 應用漸進式去 AI 化過濾器
        const userStyle = await db.getUserWritingStyle(ctx.user.id);
        const hasUserStyle = !!(userStyle && userStyle.toneStyle);
        const preservedWords = extractPreservedWords(userStyle as any);
        const emotionWords = extractEmotionWords(userStyle as any);
        generatedContent = applyContentFilters(generatedContent, {
          voiceTone: profile?.voiceTone || undefined,
          contentType: input.contentType,
          hasUserStyle,
          userPreservedWords: preservedWords,
          userEmotionWords: emotionWords,  // 用戶的情緒詞彙，用於髮話替換
          enableIdiomFilter: true,
          enableFillerFilter: true,
          enableEmotionFilter: true,
          enableSimplify: false,
        });
        
        // 創建草稿
        const draft = await db.createDraft({
          userId: ctx.user.id,
          contentType: input.contentType as any,
          body: generatedContent,
        });

        return {
          content: generatedContent,
          draftId: draft?.id,
        };
      }),

    // 對話修改草稿
    refineDraft: protectedProcedure
      .input(z.object({
        currentDraft: z.string(),
        instruction: z.string(),
        draftId: z.number().optional(),
        // 新增：修改模式選項
        editMode: z.enum(['light', 'preserve', 'rewrite']).optional().default('preserve'),
        // light = 輕度優化（只做排版、錯字、語句通順）
        // preserve = 風格保留（保留敘事結構，只優化表達）
        // rewrite = 爆款改寫（完整套用爆款公式）
        chatHistory: z.array(z.object({
          role: z.enum(["user", "assistant"]),
          content: z.string(),
        })).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const profile = await db.getIpProfileByUserId(ctx.user.id);
        const aiMemory = await db.getUserAIMemory(ctx.user.id);
        const editMode = input.editMode || 'preserve';
        
        // 根據修改模式生成不同的 Prompt
        const buildSystemPrompt = () => {
          const creatorInfo = `=== 創作者資料 ===
- 職業：${profile?.occupation || '未設定'}
- 語氣風格：${profile?.voiceTone || '未設定'}
${aiMemory ? `
這位學員的偏好：${aiMemory}` : ''}`;

          // 輕度優化模式：只做排版、錯字、語句通順
          if (editMode === 'light') {
            return `你是一個温柔的文字校對助理。

${creatorInfo}

=== 你的任務（極度重要） ===

你只能做以下三件事：
1. 修正錯字、標點符號
2. 調整排版（加入適當的換行和空行）
3. 讓語句更通順（但不改變意思）

=== 絕對禁止 ===
- 不能改變敘事結構
- 不能添加新的內容或觀點
- 不能刪除任何原有內容
- 不能改變作者的語氣和用詞習慣
- 不能加入 CTA、問題、反問
- 不能加入專業解讀或分析

=== 輸出格式 ===
直接輸出修改後的內容，不要任何解釋。`;
          }
          
          // 風格保留模式：保留敘事結構，只優化表達
          if (editMode === 'preserve') {
            return `你是一個尊重作者風格的文字優化助理。

${creatorInfo}

=== 核心原則（極度重要） ===

你的任務是「優化」而不是「重寫」。

想像你是一個細心的編輯，幫作者把文章「抓一下」，
讓它更好讀，但不改變作者想說的話。

=== 可以做的事 ===
1. 調整排版（加入呼吸感，每 2-4 行一個段落）
2. 讓句子更口語化（像傳訊息給朋友）
3. 修正錯字和標點
4. 讓語句更通順
5. 如果原文有留白感，保留那個留白

=== 絕對禁止（這是最重要的） ===
- ✘ 不能改變敘事的順序和結構
- ✘ 不能添加作者沒有說的觀點或分析
- ✘ 不能加入「從命理的角度來看」這類專業解讀
- ✘ 不能強行加入 CTA、問題、反問
- ✘ 不能把簡單的故事變成「教學文」
- ✘ 不能讓內容變得更長（字數應該差不多或更精簡）
- ✘ 不能用「讓我們」「今天要分享」「希望對你有幫助」
- ✘ 不能用 Markdown 符號

=== 故事型內容特別注意 ===
如果原文是個人經歷或故事：
- 保留作者的敘事節奏
- 保留結尾的留白感（如果有的話）
- 不要強行加入「後來我才明白」這類反思
- 不要把故事變成教訓

=== 輸出格式 ===
直接輸出優化後的內容，不要任何解釋。`;
          }
          
          // 爆款改寫模式：完整套用爆款公式
          return `你是一個專業的 Threads 爆款文案改寫助理。

${creatorInfo}

=== 創作者人設 ===
- 專業支柱：${profile?.personaExpertise || '未設定'}
- 情感支柱：${profile?.personaEmotion || '未設定'}
- 觀點支柱：${profile?.personaViewpoint || '未設定'}

=== 爆款元素（必須包含） ===

## Hook 鉤子
- 開頭使用三大策略：鏡像/反差/解法
- 讓讀者第一秒就想繼續看

## 口語化
- 像傳訊息給朋友
- 語助詞：「真的」「超」「欹」「啊」「吧」「呢」

## 呼吸感排版
- 每 2-4 行一個段落
- 每句 10-20 字

## CTA 互動
- 結尾用「召喚同類」或「二選一提問」

=== 絕對禁止 ===
- 「讓我們」「一起來」「今天要分享」
- 「親愛的朋友們」「各位」「大家好」
- 「首先」「其次」「最後」
- 「希望對你有幫助」「加油！」
- Markdown 符號

=== 輸出格式 ===
直接輸出改寫後的內容，不要任何解釋。`;
        };
        
        const systemPrompt = buildSystemPrompt();

        // ✅ 修復：簡化對話結構，確保 AI 清楚知道要修改什麼
        // 不再傳送完整對話歷史，而是直接傳送當前草稿 + 修改指令
        const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
          { role: "system", content: systemPrompt },
        ];

        // 如果有對話歷史，只取最後一次的修改指令作為參考（讓 AI 知道之前做過什麼）
        if (input.chatHistory && input.chatHistory.length > 0) {
          // 取得最後 2 輪對話作為上下文（避免過長）
          const recentHistory = input.chatHistory.slice(-4);
          const historyContext = recentHistory
            .filter(msg => msg.role === 'user')
            .map(msg => `- ${msg.content}`)
            .join('\n');
          
          if (historyContext) {
            messages.push({ 
              role: "user", 
              content: `之前的修改指令（參考即可）：\n${historyContext}\n\n當前草稿（請基於這個版本修改）：\n\n${input.currentDraft}` 
            });
          } else {
            messages.push({ 
              role: "user", 
              content: `當前草稿：\n\n${input.currentDraft}` 
            });
          }
        } else {
          messages.push({ 
            role: "user", 
            content: `當前草稿：\n\n${input.currentDraft}` 
          });
        }

        // ✅ 重點：明確告訴 AI 這是「新的修改指令」，必須執行
        messages.push({ 
          role: "user", 
          content: `【新的修改指令 - 必須執行】\n${input.instruction}\n\n請根據以上指令修改草稿，直接輸出修改後的完整內容。` 
        });

        const response = await invokeLLM({ messages });
        const rawContent = response.choices[0]?.message?.content;
        let newContent = typeof rawContent === 'string' ? rawContent : '';

        await db.logApiUsage(ctx.user.id, 'refineDraft', 'llm', 500, 600);
        
        // 清理 AI 內部標記和重複內容
        newContent = cleanAIOutput(newContent);
        
        // 應用漸進式去 AI 化過濾器
        const userStyle = await db.getUserWritingStyle(ctx.user.id);
        const hasUserStyle = !!(userStyle && userStyle.toneStyle);
        const preservedWords = extractPreservedWords(userStyle as any);
        const emotionWords = extractEmotionWords(userStyle as any);
        newContent = applyContentFilters(newContent, {
          voiceTone: profile?.voiceTone || undefined,
          hasUserStyle,
          userPreservedWords: preservedWords,
          userEmotionWords: emotionWords,  // 用戶的情緒詞彙，用於髮話替換
          enableIdiomFilter: true,
          enableFillerFilter: true,
          enableEmotionFilter: true,
          enableSimplify: false,
        });

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
- 1-4分：結構混亂，難以閱讀

### 呼吸感排版評分標準：
- 9-10分：每 2-4 行為一個段落，段落之間有空行，重點句子獨立成段，節奏感強
- 7-8分：大部分符合呼吸感規則，但有少數段落太長或太短
- 5-6分：部分段落像文字牆，連續多行不空行，或每行都換行導致太碎
- 1-4分：完全是文字牆，沒有呼吸感，或每個詞都換行導致破碎`;

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
        // 新增：健檢結果參數
        healthCheckResult: z.object({
          scores: z.object({
            hook: z.number(),
            translation: z.number(),
            tone: z.number(),
            cta: z.number(),
            total: z.number(),
          }).optional(),
          maxScores: z.object({
            hook: z.number(),
            translation: z.number(),
            tone: z.number(),
            cta: z.number(),
          }).optional(),
          redlineMarks: z.array(z.object({
            type: z.string(),
            original: z.string(),
            suggestion: z.string(),
            reason: z.string(),
          })).optional(),
          hook: z.object({
            score: z.number(),
            advice: z.string(),
          }).optional(),
          translation: z.object({
            score: z.number(),
            advice: z.string(),
          }).optional(),
          tone: z.object({
            score: z.number(),
            advice: z.string(),
          }).optional(),
          cta: z.object({
            score: z.number(),
            advice: z.string(),
          }).optional(),
        }).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const profile = await db.getIpProfileByUserId(ctx.user.id);
        const { healthCheckResult } = input;
        
        // 建立健檢問題摘要
        let healthCheckSummary = '';
        let priorityFixes = '';
        
        if (healthCheckResult && healthCheckResult.scores && healthCheckResult.maxScores) {
          const { scores, maxScores, redlineMarks, hook, translation, tone, cta } = healthCheckResult;
          
          // 計算各維度得分率，找出最弱的維度
          const dimensions = [
            { name: 'Hook 鉤子強度', key: 'hook', score: scores.hook, max: maxScores.hook, advice: hook?.advice },
            { name: 'Translation 說人話', key: 'translation', score: scores.translation, max: maxScores.translation, advice: translation?.advice },
            { name: 'Tone 閱讀體感', key: 'tone', score: scores.tone, max: maxScores.tone, advice: tone?.advice },
            { name: 'CTA 互動召喚', key: 'cta', score: scores.cta, max: maxScores.cta, advice: cta?.advice },
          ];
          
          // 按得分率排序，找出最弱的維度
          const sortedDimensions = [...dimensions].sort((a, b) => (a.score / a.max) - (b.score / b.max));
          const weakest = sortedDimensions[0];
          const strongest = sortedDimensions[sortedDimensions.length - 1];
          
          healthCheckSummary = `\n=== 文案健檢結果（請針對這些問題修改） ===\n`;
          healthCheckSummary += `總分：${scores.total}/100\n\n`;
          
          healthCheckSummary += `各維度得分：\n`;
          dimensions.forEach(d => {
            const percentage = Math.round((d.score / d.max) * 100);
            const status = percentage >= 80 ? '✅' : percentage >= 60 ? '⚠️' : '❌';
            healthCheckSummary += `${status} ${d.name}：${d.score}/${d.max} (${percentage}%)\n`;
          });
          
          // 最弱維度的具體建議
          priorityFixes = `\n=== 優先修改順序 ===\n`;
          priorityFixes += `🚨 最需要加強：${weakest.name}\n`;
          if (weakest.advice) {
            priorityFixes += `建議：${weakest.advice}\n`;
          }
          
          // 如果有第二弱的維度
          if (sortedDimensions[1] && (sortedDimensions[1].score / sortedDimensions[1].max) < 0.7) {
            priorityFixes += `\n⚠️ 次要加強：${sortedDimensions[1].name}\n`;
            if (sortedDimensions[1].advice) {
              priorityFixes += `建議：${sortedDimensions[1].advice}\n`;
            }
          }
          
          // 如果有滿分的維度，提醒不要動
          if ((strongest.score / strongest.max) >= 0.9) {
            priorityFixes += `\n✅ 保持不變：${strongest.name} 已經很好，請不要改動這部分\n`;
          }
          
          // 紅線標記（具體要修改的句子）
          if (redlineMarks && redlineMarks.length > 0) {
            priorityFixes += `\n=== 具體要修改的地方 ===\n`;
            redlineMarks.slice(0, 5).forEach((mark, i) => {
              priorityFixes += `\n${i + 1}. 問題類型：${mark.type}\n`;
              priorityFixes += `   原文：「${mark.original}」\n`;
              priorityFixes += `   建議改為：「${mark.suggestion}」\n`;
              priorityFixes += `   原因：${mark.reason}\n`;
            });
          }
        }
        
        const systemPrompt = `你是一位 Threads 爆款文案優化專家。${healthCheckResult ? '請根據以下健檢結果，針對性地修改文案。' : '請根據以下五大維度和四透鏡框架優化文案。'}${healthCheckSummary}${priorityFixes}

=== 創作者人設（必須保持一致） ===
- 語氣風格：${profile?.voiceTone || '溫暖真誠'}
- 專業支柱：${profile?.personaExpertise || '未設定'}
- 情感支柱：${profile?.personaEmotion || '未設定'}
- 觀點支柱：${profile?.personaViewpoint || '未設定'}

=== 五大維度優化指南 ===

## 維度一：Hook 鉤子強度（25分）
開頭必須使用三大策略之一：
1. 鏡像策略：「你是不是也...」「有沒有人也會這樣...」
2. 反差策略：「我以為...但其實...」「我不是...但我還是...」
3. 解法策略：「...有問題？這幾點先看懂」

如果原文開頭平淡，請用以上策略改寫。

## 維度二：Translation 翻譯機（20分）
- 所有專業術語必須翻譯成「比喻」或「白話」
- 例如：「悲傷就像檔案下載太慢，卡在 90% 就是不動」
- 小學五年級都能懂的程度

## 維度三：Tone 閱讀體感（15分）

### 字數限制（必須精簡）
- 優化後字數應該比原文更少
- 目標 300-500 字，超過 = 失敗

### 口語化原則（像傳訊息給朋友）
- 像在 LINE 跟朋友聊天，不是寫部落格文章
- 可以省略「我」，例如：「真的超累」而不是「我真的超累」
- 可以用不完整的句子，例如：「結果呢？」「就這樣。」
- 語助詞大量用：「真的」「超」「欹」「啊」「吧」「呢」「啦」
- 口語表達：「說真的」「老實說」「不騙你」

### 呼吸感排版
- 每 2-4 行為一個段落
- 段落之間空一行
- 每句 10-15 字，最多 20 字

## 維度四：CTA 互動召喚（10分）
優先使用這兩種 CTA：
1. 召喚同類：「你們也是這樣嗎？」「有沒有人跟我一樣？」
2. 二選一提問：「你會選 A 還是 B？」

避免使用：
- 開放式高難度提問
- 說教式結尾

## 維度五：四透鏡檢核（30分）

### 心法透鏡（8分）- 這篇文案傳遞的是渴望還是焦慮？
- 必須是「渴望導向」，讓讀者看完感到希望和期待
- 如果原文有恐懼行銷或焦慮製造，請改寫為正向表達

### 人設透鏡（8分）- 這篇文案像不像你說的話？
- 必須有個人特色和獨特觀點
- 保持與創作者人設三支柱一致

### 結構透鏡（7分）- 這篇文案好不好吸收？
- 結構清晰，有邏輯脈絡
- 不是東一句西一句

### 轉化透鏡（7分）- 讀者看完要做什麼？
- 必須有明確的下一步行動
- 行動呼籲要具體可執行

=== 絕對禁止（違反 = 重寫） ===
- 「讓我們」「一起來」「今天要分享」「分享一下」
- 「親愛的朋友們」「各位」「大家好」
- 「首先」「其次」「最後」「第一」「第二」「第三」
- 「希望對你有幫助」「加油！」「你可以的！」
- Markdown 符號、條列式

=== 輸出要求 ===
請直接輸出優化後的文案，不要包含任何解釋、標題或註釋。`;

        const response = await invokeLLM({
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: `請優化這篇文案：

${input.text}` }
          ],
        });

        let optimizedContent = typeof response.choices[0]?.message?.content === 'string' 
          ? response.choices[0].message.content 
          : '';

        await db.logApiUsage(ctx.user.id, 'autoFix', 'llm', 400, 600);
        
        // 清理 AI 內部標記和重複內容
        optimizedContent = cleanAIOutput(optimizedContent);
        
        // 應用漸進式去 AI 化過濾器
        const userStyle = await db.getUserWritingStyle(ctx.user.id);
        const hasUserStyle = !!(userStyle && userStyle.toneStyle);
        const preservedWords = extractPreservedWords(userStyle as any);
        const emotionWords = extractEmotionWords(userStyle as any);
        optimizedContent = applyContentFilters(optimizedContent, {
          voiceTone: profile?.voiceTone || undefined,
          hasUserStyle,
          userPreservedWords: preservedWords,
          userEmotionWords: emotionWords,  // 用戶的情緒詞彙，用於髮話替換
          enableIdiomFilter: true,
          enableFillerFilter: true,
          enableEmotionFilter: true,
          enableSimplify: false,
        });

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

    // 文案健檢 V2 - 審計制（Boolean 檢查 + 程式碼計分）
    contentHealthCheck: protectedProcedure
      .input(z.object({
        text: z.string(),
        draftId: z.number().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        try {
          console.log('[contentHealthCheck] Starting for user:', ctx.user.id);
          const result = await executeContentHealthCheck(ctx.user.id, input.text);
          console.log('[contentHealthCheck] Success');
          return result;
        } catch (error) {
          console.error('[contentHealthCheck] Error:', error);
          throw error;
        }
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
      // 獲取每篇貼文的 metrics 和 draftPost
      const postsWithMetrics = await Promise.all((posts ?? []).map(async (post) => {
        const metrics = await db.getPostMetricsByPostId(post.id);
        const draftPost = post.draftPostId ? await db.getDraftById(post.draftPostId) : null;
        return {
          ...post,
          metrics,
          draftPost,
        };
      }));
      return postsWithMetrics;
    }),
    
    create: protectedProcedure
      .input(z.object({
        draftPostId: z.number().optional(),
        threadUrl: z.string(),
        postedAt: z.date().optional(),
        content: z.string().optional(),
        metrics: z.object({
          reach: z.number().optional(),
          likes: z.number().optional(),
          comments: z.number().optional(),
          reposts: z.number().optional(),
          saves: z.number().optional(),
        }).optional(),
        // 深度分析欄位
        postingTime: z.enum(['morning', 'noon', 'evening', 'night']).optional(),
        topComment: z.string().optional(),
        selfReflection: z.string().optional(),
        isViral: z.boolean().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        // 如果有關聯草稿，更新草稿狀態
        if (input.draftPostId) {
          await db.updateDraft(input.draftPostId, { status: 'published' });
        }
        
        // 如果有內文但沒有關聯草稿，創建一個簡單的草稿來儲存內文
        let draftId = input.draftPostId;
        if (input.content && !draftId) {
          const draft = await db.createDraft({
            userId: ctx.user.id,
            body: input.content,
            contentType: 'casual',
            status: 'published',
          });
          draftId = draft?.id;
        }
        
        const post = await db.createPost({
          userId: ctx.user.id,
          draftPostId: draftId,
          threadUrl: input.threadUrl,
          postedAt: input.postedAt || new Date(),
        });
        
        // 如果有數據或深度分析欄位，同時創建 metrics
        if (post && (input.metrics || input.postingTime || input.topComment || input.selfReflection || input.isViral)) {
          await db.createPostMetric({
            postId: post.id,
            reach: input.metrics?.reach || 0,
            likes: input.metrics?.likes || 0,
            comments: input.metrics?.comments || 0,
            reposts: input.metrics?.reposts || 0,
            saves: input.metrics?.saves || 0,
            // 深度分析欄位
            postingTime: input.postingTime || null,
            topComment: input.topComment || null,
            selfReflection: input.selfReflection || null,
            isViral: input.isViral || false,
          });
          
          // 自動更新經營指標
          await db.updateMetricsFromReports(ctx.user.id);
        }
        
        return post;
      }),

    // 刪除貼文記錄
    delete: protectedProcedure
      .input(z.object({ postId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        // 驗證貼文屬於當前用戶
        const posts = await db.getPostsByUserId(ctx.user.id);
        const post = posts.find(p => p.id === input.postId);
        if (!post) {
          throw new TRPCError({ code: 'NOT_FOUND', message: '找不到該貼文記錄' });
        }
        await db.deletePost(input.postId);
        return { success: true };
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
        // 戰報閉環學習欄位
        postingTime: z.enum(['morning', 'noon', 'evening', 'night']).optional(),
        topComment: z.string().optional(),
        selfReflection: z.string().optional(),
        isViral: z.boolean().optional(), // 用戶標記為爆文
      }))
      .mutation(async ({ ctx, input }) => {
        const { postId, postingTime, topComment, selfReflection, isViral, ...metrics } = input;
        
        // 計算表現等級
        const performanceLevel = calculatePerformanceLevel(metrics.reach, metrics.comments, metrics.saves);
        
        // 如果有足夠數據，生成 AI 洞察
        let aiInsight = null;
        if (metrics.reach && metrics.comments !== undefined) {
          // 獲取貼文內容
          // 獲取 posts 表中的記錄
          const posts = await db.getPostsByUserId(ctx.user.id);
          const post = posts.find(p => p.id === postId);
          const draftPost = post?.draftPostId ? await db.getDraftById(post.draftPostId) : null;
          
          if (draftPost?.body) {
            try {
              // === 查詢市場 Benchmark 數據 ===
              const matchingKeywords = await db.findMatchingKeywords(draftPost.body);
              let benchmarkContext = '';
              if (matchingKeywords.length > 0) {
                const topKeyword = matchingKeywords[0];
                const avgLikes = topKeyword.avgLikes || 0;
                const viralRate = topKeyword.viralRate || 0;
                
                // 計算與市場平均的比較
                const likesRatio = avgLikes > 0 ? ((metrics.likes || 0) / avgLikes).toFixed(1) : 'N/A';
                const isAboveAverage = (metrics.likes || 0) > avgLikes;
                
                benchmarkContext = `
市場 Benchmark 對比（關鍵字：${topKeyword.keyword}）：
- 同類貼文平均讚數：${avgLikes}
- 您的貼文讚數：${metrics.likes || 0}
- 表現比較：${isAboveAverage ? `您的表現是同類貼文的 ${likesRatio} 倍！` : `還有進步空間，同類貼文平均 ${avgLikes} 讚`}
- 同類貼文爆文率：${(viralRate * 100).toFixed(1)}%`;
              }
              
              // === 數據驅動的開頭效果分析 ===
              const { analyzeOpener, HIGH_EFFECT_OPENER_PATTERNS } = await import('../shared/opener-rules');
              const firstLine = draftPost.body.split('\n').filter((l: string) => l.trim())[0] || '';
              const openerAnalysis = analyzeOpener(firstLine);
              
              let openerContext = '';
              if (openerAnalysis.matchedHighEffect.length > 0) {
                const pattern = openerAnalysis.matchedHighEffect[0];
                openerContext = `
開頭效果分析：
- 使用了「${pattern.name}」模式（效果 ${pattern.effect}x）
- 開頭效果評分：${openerAnalysis.score.toFixed(1)}x`;
              } else if (openerAnalysis.matchedLowEffect.length > 0) {
                const pattern = openerAnalysis.matchedLowEffect[0];
                openerContext = `
開頭效果分析：
- 使用了「${pattern.name}」模式（效果只有 ${pattern.effect}x）
- 建議改用「冒號斷言」（2.8x）或「禁忌/警告詞」（2.4x）`;
              } else {
                openerContext = `
開頭效果分析：
- 開頭效果評分：${openerAnalysis.score.toFixed(1)}x
- 建議使用「冒號斷言」（2.8x）或「禁忌/警告詞」（2.4x）來提升開頭效果`;
              }
              
              // === 字數對比 ===
              const charCount = draftPost.body.length;
              const recommendedRange = { min: 150, max: 400 };
              let charCountContext = '';
              if (charCount < recommendedRange.min) {
                charCountContext = `
字數分析：${charCount} 字（偏少，建議 ${recommendedRange.min}-${recommendedRange.max} 字）`;
              } else if (charCount > recommendedRange.max) {
                charCountContext = `
字數分析：${charCount} 字（偏多，建議精簡到 ${recommendedRange.min}-${recommendedRange.max} 字）`;
              } else {
                charCountContext = `
字數分析：${charCount} 字（在建議範圍內，很好！）`;
              }
              
              const insightResponse = await invokeLLM({
                messages: [
                  { role: "system", content: `你是一位 Threads 經營教練，根據貼文表現數據、市場 Benchmark 和數據驅動分析提供簡短策略建議。
回覆要求：
1. 最多 3 句話
2. 具體可執行
3. 針對這篇貼文的特性
4. 如果有 Benchmark 數據，要參考市場表現給建議
5. 特別關注開頭效果分析的建議
6. 不要笼統的建議` },
                  { role: "user", content: `貼文內容：
${draftPost.body.substring(0, 500)}

表現數據：
- 觸及：${metrics.reach || 0}
- 讚數：${metrics.likes || 0}
- 留言：${metrics.comments || 0}
- 收藏：${metrics.saves || 0}
- 表現等級：${performanceLevel === 'hit' ? '爆文' : performanceLevel === 'low' ? '低迷' : '正常'}
${benchmarkContext}
${openerContext}
${charCountContext}
${topComment ? `最熱門留言：${topComment}` : ''}
${selfReflection ? `創作者反思：${selfReflection}` : ''}

請給出一個具體的策略建議，幫助下一篇貼文表現更好。` }
                ],
              });
              const rawContent = insightResponse.choices[0]?.message?.content;
              aiInsight = typeof rawContent === 'string' ? rawContent : null;
              await db.logApiUsage(ctx.user.id, 'post_insight', 'llm', 200, 100);
            } catch (e) {
              console.error('Failed to generate AI insight:', e);
            }
          }
        }
        
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
          postingTime,
          topComment,
          selfReflection,
          aiInsight,
          performanceLevel,
          isViral: isViral || false,
        });
        
        // 如果標記為爆文，生成爆文分析
        if (isViral) {
          const posts = await db.getPostsByUserId(ctx.user.id);
          const post = posts.find(p => p.id === postId);
          const draftPost = post?.draftPostId ? await db.getDraftById(post.draftPostId) : null;
          
          if (draftPost?.body) {
            try {
              const viralResponse = await invokeLLM({
                messages: [
                  { role: "system", content: `你是一位 Threads 爆文分析專家。請分析這篇爆文的成功原因。
回覆要求：
1. 分析 3-5 個具體成功因素
2. 每個因素用一句話說明
3. 結尾給出一個可複製的建議
4. 不要笼統，要具體到這篇貼文的特性` },
                  { role: "user", content: `爆文內容：
${draftPost.body}

表現數據：
- 觸及：${metrics.reach || 0}
- 愛心：${metrics.likes || 0}
- 留言：${metrics.comments || 0}
- 轉發：${metrics.reposts || 0}
- 收藏：${metrics.saves || 0}
${topComment ? `最熱門留言：${topComment}` : ''}

請分析這篇貼文為什麼能成為爆文？` }
                ],
              });
              const viralAnalysis = typeof viralResponse.choices[0]?.message?.content === 'string' 
                ? viralResponse.choices[0].message.content 
                : null;
              
              if (viralAnalysis && metric) {
                await db.updatePostMetric(metric.id, { viralAnalysis });
              }
              await db.logApiUsage(ctx.user.id, 'viral_analysis', 'llm', 200, 150);
              
              // === 知識庫動態更新：記錄爆文學習 ===
              try {
                // 提取爆文特徵
                const extractResponse = await invokeLLM({
                  messages: [
                    { role: "system", content: `你是一位內容分析專家。請從這篇爆文中提取可複製的特徵。
回覆格式（JSON）：
{
  "hookPattern": "開頭模式（一句話描述）",
  "contentStructure": "內容結構特徵",
  "emotionFlow": "情緒流動方式",
  "ctaStyle": "CTA 風格",
  "keyElements": ["關鍵元素 1", "關鍵元素 2"]
}` },
                    { role: "user", content: `爆文內容：
${draftPost.body}

表現數據：
- 讚數：${metrics.likes || 0}
- 留言：${metrics.comments || 0}
- 收藏：${metrics.saves || 0}` }
                  ],
                });
                
                const extractedFeaturesRaw = extractResponse.choices[0]?.message?.content;
                const extractedFeatures = typeof extractedFeaturesRaw === 'string' ? extractedFeaturesRaw : '';
                let parsedFeatures = null;
                try {
                  // 嘗試解析 JSON
                  const jsonMatch = extractedFeatures.match(/\{[\s\S]*\}/);
                  if (jsonMatch) {
                    parsedFeatures = JSON.parse(jsonMatch[0]);
                  }
                } catch {
                  // 解析失敗，使用原始文字
                }
                
                // 記錄到爆文學習表
                await db.recordViralLearning({
                  userId: ctx.user.id,
                  postId,
                  extractedHook: parsedFeatures?.hookPattern || null,
                  extractedStructure: parsedFeatures?.contentStructure || null,
                  contentType: draftPost.contentType || null,
                  likes: metrics.likes || 0,
                  reach: metrics.reach || 0,
                  engagement: (metrics.likes || 0) + (metrics.comments || 0) + (metrics.saves || 0),
                  successFactors: parsedFeatures?.keyElements || null,
                  learningNotes: extractedFeatures || null,
                  isIntegrated: false,
                });
                
                await db.logApiUsage(ctx.user.id, 'viral_learning_extract', 'llm', 100, 100);
                
                // === 知識庫自動更新：將爆文學習整合到鉤子庫 ===
                try {
                  const integrationResult = await db.processUnintegratedViralLearnings();
                  if (integrationResult.integrated > 0) {
                    console.log(`[知識庫更新] 成功整合 ${integrationResult.integrated} 個新鉤子到知識庫`);
                  }
                } catch (integrationError) {
                  console.error('[知識庫更新] 整合失敗:', integrationError);
                }
              } catch (e) {
                console.error('Failed to record viral learning:', e);
              }
            } catch (e) {
              console.error('Failed to generate viral analysis:', e);
            }
          }
        }
        
        // 自動更新經營指標
        await db.updateMetricsFromReports(ctx.user.id);
        
        return metric;
      }),
    
    weeklyReport: protectedProcedure.query(async ({ ctx }) => {
      const report = await db.getWeeklyReport(ctx.user.id);
      return report ?? { posts: [], metrics: [], summary: { totalReach: 0, totalLikes: 0, totalComments: 0, totalSaves: 0 } };
    }),
    
    // 標記為爆文
    markAsViral: protectedProcedure
      .input(z.object({
        postId: z.number(),
        isViral: z.boolean(),
      }))
      .mutation(async ({ ctx, input }) => {
        // 確認貼文屬於當前用戶
        const post = await db.getPostById(input.postId);
        if (!post || post.userId !== ctx.user.id) {
          throw new TRPCError({ code: 'NOT_FOUND', message: '貼文不存在' });
        }
        
        // 更新 isViral 欄位
        const dbConn = await getDb();
        if (!dbConn) {
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: '資料庫連線失敗' });
        }
        await dbConn.update(postMetrics)
          .set({ isViral: input.isViral })
          .where(eq(postMetrics.postId, input.postId));
        
        // 如果標記為爆文，觸發 AI 分析
        if (input.isViral) {
          // 獲取貼文內容和數據
          const draftPost = post.draftPostId 
            ? await db.getDraftById(post.draftPostId)
            : null;
          const metricsArr = await db.getPostMetricsByPostId(input.postId);
          const metrics = metricsArr[0]; // 最新的 metric
          
          if (draftPost && metrics) {
            // 使用 AI 分析爆文成功原因
            const systemPrompt = `你是一位 Threads 經營專家，請分析這篇爆文的成功原因。

分析需涵蓋：
1. Hook 開頭為什麼有效？
2. 內容結構有什麼特點？
3. 情緒引導如何運用？
4. 跟讀者的連結點在哪？
5. 可以復製的元素有哪些？

請用繁體中文回答，簡潔有力（150-250字）。`;
            
            const userPrompt = `貼文內容：
${draftPost.body}

互動數據：
- 觸及：${metrics.reach || 0}
- 愛心：${metrics.likes || 0}
- 留言：${metrics.comments || 0}
- 轉發：${metrics.reposts || 0}
- 儲存：${metrics.saves || 0}

請分析這篇貼文為什麼會爆？`;
            
            try {
              const response = await invokeLLM({
                messages: [
                  { role: 'system', content: systemPrompt },
                  { role: 'user', content: userPrompt },
                ],
              });
              
              const viralAnalysis = typeof response.choices[0]?.message?.content === 'string' 
                ? response.choices[0].message.content 
                : null;
              
              if (viralAnalysis) {
                await dbConn.update(postMetrics)
                  .set({ viralAnalysis })
                  .where(eq(postMetrics.postId, input.postId));
              }
              
              await db.logApiUsage(ctx.user.id, 'viral_analysis', 'llm', 300, 200);
              
              return {
                success: true,
                isViral: true,
                viralAnalysis,
              };
            } catch (error) {
              console.error('Failed to analyze viral post:', error);
              return {
                success: true,
                isViral: true,
                viralAnalysis: null,
              };
            }
          }
        }
        
        return {
          success: true,
          isViral: input.isViral,
          viralAnalysis: null,
        };
      }),
    
    // Threads 連結解析 - 自動抓取貼文內文
    parseThreadsUrl: protectedProcedure
      .input(z.object({
        url: z.string().url(),
      }))
      .mutation(async ({ ctx, input }) => {
        try {
          // 驗證是否為 Threads 連結
          const threadsUrlPattern = /threads\.net\/@([\w.]+)\/post\/([\w-]+)/;
          const match = input.url.match(threadsUrlPattern);
          
          if (!match) {
            return {
              success: false,
              error: '請輸入有效的 Threads 貼文連結',
              content: null,
              author: null,
              postId: null,
            };
          }
          
          const [, author, postId] = match;
          
          // 嘗試抓取貼文內容（使用 fetch 抓取公開頁面）
          let content = null;
          try {
            const response = await fetch(input.url, {
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'zh-TW,zh;q=0.9,en-US;q=0.8,en;q=0.7',
              },
            });
            
            if (response.ok) {
              const html = await response.text();
              
              // 嘗試從 meta og:description 或 JSON-LD 中提取內文
              // Threads 的貼文內容通常在 og:description 中
              const ogDescMatch = html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']*)["']/i);
              if (ogDescMatch && ogDescMatch[1]) {
                content = ogDescMatch[1]
                  .replace(/&quot;/g, '"')
                  .replace(/&amp;/g, '&')
                  .replace(/&lt;/g, '<')
                  .replace(/&gt;/g, '>')
                  .replace(/&#x27;/g, "'")
                  .replace(/&#39;/g, "'");
              }
              
              // 如果 og:description 沒有，嘗試從 JSON-LD 提取
              if (!content) {
                const jsonLdMatch = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i);
                if (jsonLdMatch && jsonLdMatch[1]) {
                  try {
                    const jsonLd = JSON.parse(jsonLdMatch[1]);
                    if (jsonLd.articleBody) {
                      content = jsonLd.articleBody;
                    } else if (jsonLd.description) {
                      content = jsonLd.description;
                    }
                  } catch (e) {
                    // JSON 解析失敗，繼續
                  }
                }
              }
            }
          } catch (fetchError) {
            console.error('Failed to fetch Threads URL:', fetchError);
            // 抓取失敗不阻止流程，只是沒有內文
          }
          
          await db.logApiUsage(ctx.user.id, 'threads_parse', 'fetch', 200, 0);
          
          return {
            success: true,
            error: null,
            content: content || null,
            author,
            postId,
          };
        } catch (error) {
          console.error('Threads URL parse error:', error);
          return {
            success: false,
            error: '解析失敗，請稍後再試',
            content: null,
            author: null,
            postId: null,
          };
        }
      }),

    // 生成 AI 策略總結
    generateStrategySummary: protectedProcedure
      .mutation(async ({ ctx }) => {
        // 獲取最近 20 篇貼文的數據
        const posts = await db.getPostsByUserId(ctx.user.id);
        const recentPosts = posts.slice(0, 20);
        
        if (recentPosts.length < 5) {
          return {
            success: false,
            error: '需要至少 5 篇貼文數據才能生成策略總結',
            summary: null,
          };
        }
        
        // 獲取每篇貼文的 metrics 和 draft
        const postsData = await Promise.all(recentPosts.map(async (p) => {
          const metrics = await db.getPostMetricsByPostId(p.id);
          const latestMetric = metrics[0]; // 最新的 metric
          const draft = p.draftPostId ? await db.getDraftById(p.draftPostId) : null;
          
          return {
            date: p.postedAt ? new Date(p.postedAt).toLocaleDateString() : 'N/A',
            reach: latestMetric?.reach || 0,
            likes: latestMetric?.likes || 0,
            comments: latestMetric?.comments || 0,
            reposts: latestMetric?.reposts || 0,
            saves: latestMetric?.saves || 0,
            postingTime: latestMetric?.postingTime || 'unknown',
            isViral: latestMetric?.isViral || false,
            viralAnalysis: latestMetric?.viralAnalysis || null,
            selfReflection: latestMetric?.selfReflection || null,
            contentPreview: draft?.body?.substring(0, 100) || '無內文',
          };
        }));
        
        // 計算統計數據
        const totalReach = postsData.reduce((sum, p) => sum + p.reach, 0);
        const avgReach = Math.round(totalReach / postsData.length);
        const viralPosts = postsData.filter(p => p.isViral);
        const postingTimeStats = postsData.reduce((acc, p) => {
          if (p.postingTime && p.postingTime !== 'unknown') {
            acc[p.postingTime] = (acc[p.postingTime] || 0) + 1;
          }
          return acc;
        }, {} as Record<string, number>);
        
        // 找出最佳發文時段
        const bestTime = Object.entries(postingTimeStats)
          .sort((a, b) => b[1] - a[1])[0]?.[0] || null;
        
        // 使用 AI 生成策略總結
        const systemPrompt = `你是一位 Threads 經營專家，請根據用戶的貼文數據生成個人化的策略總結。

【重要】回覆格式要求：
- 絕對禁止使用任何 Markdown 語法（如 **粗體**、*斜體*、# 標題、- 列表等）
- 使用純文字和 Emoji 來強調重點
- 用「、」來包裹重要詞彙，不要用 ** 或 *

分析需涵蓋：
1. 整體表現趨勢
2. 最佳發文時段建議
3. 內容類型建議
4. 爆文模式分析（如果有爆文數據）
5. 具體可執行的下一步建議

請用繁體中文回答，語氣要像教練一樣親切但專業。`;
        
        const userPrompt = `以下是我最近 ${postsData.length} 篇貼文的數據：

平均觸及：${avgReach}
總貼文數：${postsData.length}
爆文數：${viralPosts.length}
最常發文時段：${bestTime || '無數據'}

各篇貼文數據：
${postsData.map((p, i) => `${i + 1}. 觸及:${p.reach} 愛心:${p.likes} 留言:${p.comments} ${p.isViral ? '🔥爆文' : ''}
   時段:${p.postingTime} 內文預覽:${p.contentPreview}${p.selfReflection ? `\n   自我反思:${p.selfReflection}` : ''}${p.viralAnalysis ? `\n   爆文分析:${p.viralAnalysis}` : ''}`).join('\n\n')}

請依照以下格式生成策略總結：

📊 整體表現摘要
（用 2-3 句話總結整體表現）

🔥 爆文模式分析
（如果有爆文，分析成功原因；沒有則給出爆文建議）

⏰ 最佳發文時段
（根據數據給出具體時段建議）

📝 內容策略建議
（給出 2-3 個具體可執行的建議）

🎯 下週行動計畫
（給出 1-2 個具體的下一步行動）

記住：不要使用 ** 或 * 等 Markdown 語法，用 Emoji 和「、」來強調重點。`;
        
        try {
          const response = await invokeLLM({
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt },
            ],
          });
          
          const summary = typeof response.choices[0]?.message?.content === 'string' 
            ? response.choices[0].message.content 
            : null;
          
          if (summary) {
            // 儲存到 ipProfiles
            const ipProfile = await db.getIpProfile(ctx.user.id);
            if (ipProfile) {
              const dbConn2 = await getDb();
              if (dbConn2) {
                await dbConn2.update(ipProfiles)
                  .set({
                    aiStrategySummary: summary,
                    aiStrategyUpdatedAt: new Date(),
                    bestPostingTime: bestTime,
                    viralPatterns: viralPosts.length > 0 
                      ? viralPosts.map(p => p.viralAnalysis).filter(Boolean).join('\n---\n')
                      : null,
                  })
                  .where(eq(ipProfiles.userId, ctx.user.id));
              }
            }
          }
          
          await db.logApiUsage(ctx.user.id, 'strategy_summary', 'llm', 500, 300);
          
          return {
            success: true,
            error: null,
            summary,
            stats: {
              totalPosts: postsData.length,
              avgReach,
              viralCount: viralPosts.length,
              bestPostingTime: bestTime,
            },
          };
        } catch (error) {
          console.error('Failed to generate strategy summary:', error);
          return {
            success: false,
            error: '生成策略總結失敗，請稍後再試',
            summary: null,
          };
        }
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
    
    // ==================== 教練專區 API ====================
    
    // 取得所有期別
    getCohorts: adminProcedure.query(async () => {
      return db.getAllCohorts();
    }),
    
    // 取得學員列表（含統計資料）
    getStudents: adminProcedure
      .input(z.object({
        cohort: z.string().optional(),
        search: z.string().optional(),
      }).optional())
      .query(async ({ input }) => {
        return db.getStudentsWithStats(input);
      }),
    
    // 取得學員詳細資料
    getStudentDetail: adminProcedure
      .input(z.object({ userId: z.number() }))
      .query(async ({ input }) => {
        return db.getStudentDetail(input.userId);
      }),
    
    // 更新學員標註
    updateStudentInfo: adminProcedure
      .input(z.object({
        userId: z.number(),
        cohort: z.string().nullable().optional(),
        coachNote: z.string().nullable().optional(),
        coachTags: z.array(z.string()).nullable().optional(),
        threadsHandle: z.string().nullable().optional(),
      }))
      .mutation(async ({ input }) => {
        const { userId, ...data } = input;
        await db.updateUserCoachInfo(userId, data);
        return { success: true };
      }),
    
    // 取得所有學員戰報列表
    getStudentReports: adminProcedure
      .input(z.object({
        cohort: z.string().optional(),
        userId: z.number().optional(),
        limit: z.number().optional(),
        offset: z.number().optional(),
      }).optional())
      .query(async ({ input }) => {
        return db.getAllStudentReports(input);
      }),
    
    // 取得戰報詳情
    getReportDetail: adminProcedure
      .input(z.object({ postId: z.number() }))
      .query(async ({ input }) => {
        return db.getStudentReportDetail(input.postId);
      }),

    // ========== 批次操作 API ==========
    
    // 批次設定學員期別
    batchSetCohort: adminProcedure
      .input(z.object({
        userIds: z.array(z.number()),
        cohort: z.string().nullable(),
      }))
      .mutation(async ({ input }) => {
        await db.batchUpdateUserCohort(input.userIds, input.cohort);
        return { success: true, count: input.userIds.length };
      }),
    
    // 批次新增學員標籤
    batchAddTags: adminProcedure
      .input(z.object({
        userIds: z.array(z.number()),
        tags: z.array(z.string()),
      }))
      .mutation(async ({ input }) => {
        await db.batchAddUserTags(input.userIds, input.tags);
        return { success: true, count: input.userIds.length };
      }),
    
    // 批次撤銷邀請碼
    batchRevokeInvitations: adminProcedure
      .input(z.object({
        ids: z.array(z.number()),
      }))
      .mutation(async ({ input }) => {
        await db.batchRevokeInvitationCodes(input.ids);
        return { success: true, count: input.ids.length };
      }),
    
    // 批次標記戰報已閱讀
    batchMarkReportsRead: adminProcedure
      .input(z.object({
        postIds: z.array(z.number()),
      }))
      .mutation(async ({ input }) => {
        await db.batchMarkReportsAsRead(input.postIds);
        return { success: true, count: input.postIds.length };
      }),
    
    // 匯出學員資料
    exportStudents: adminProcedure
      .input(z.object({
        userIds: z.array(z.number()).optional(),
        cohort: z.string().optional(),
      }))
      .query(async ({ input }) => {
        return db.exportStudentsData(input);
      }),
    
    // 匯出戰報資料
    exportReports: adminProcedure
      .input(z.object({
        postIds: z.array(z.number()).optional(),
        cohort: z.string().optional(),
        userId: z.number().optional(),
      }))
      .query(async ({ input }) => {
        return db.exportReportsData(input);
      }),
    
    // ==================== 知識庫管理 API ====================
    
    // 取得知識庫統計
    getKnowledgeBaseStats: adminProcedure.query(async () => {
      return db.getKnowledgeBaseStats();
    }),
    
    // 手動觸發知識庫更新
    triggerKnowledgeBaseUpdate: adminProcedure.mutation(async () => {
      const result = await db.processUnintegratedViralLearnings();
      return {
        success: true,
        processed: result.processed,
        integrated: result.integrated,
        skipped: result.skipped,
        details: result.details,
      };
    }),
    
    // 取得所有鉤子
    getContentHooks: adminProcedure
      .input(z.object({
        type: z.string().optional(),
        source: z.string().optional(),
        limit: z.number().optional(),
      }).optional())
      .query(async ({ input }) => {
        return db.getContentHooks(input);
      }),
    
    // 取得未整合的爆文學習記錄
    getPendingViralLearnings: adminProcedure
      .input(z.object({ limit: z.number().optional() }).optional())
      .query(async ({ input }) => {
        return db.getUnintegratedViralLearnings(input?.limit || 50);
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
        avgEngagementRate: z.number().optional(),
        postFrequency: z.number().optional(),
        totalPosts: z.number().optional(),
        hasProfileSetup: z.boolean().optional(),
        hasLineLink: z.boolean().optional(),
        hasProduct: z.boolean().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        await db.upsertUserGrowthMetrics({ userId: ctx.user.id, ...input });
        // 自動計算經營階段
        const stage = await db.calculateUserStage(ctx.user.id);
        await db.upsertUserGrowthMetrics({ userId: ctx.user.id, currentStage: stage as any });
        return { success: true, stage };
      }),

    // 手動設定經營階段
    setManualStage: protectedProcedure
      .input(z.object({
        stage: z.enum(['startup', 'growth', 'monetize', 'scale']).nullable(),
      }))
      .mutation(async ({ ctx, input }) => {
        await db.upsertUserGrowthMetrics({ 
          userId: ctx.user.id, 
          manualStage: input.stage as any 
        });
        // 重新計算階段（如果有 manualStage 會優先使用）
        const stage = await db.calculateUserStage(ctx.user.id);
        await db.upsertUserGrowthMetrics({ userId: ctx.user.id, currentStage: stage as any });
        return { success: true, stage, isManual: !!input.stage };
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
        cohort: z.string().optional(), // 期別
        note: z.string().optional(),
        expiresAt: z.date().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        return db.createInvitationCode({
          createdBy: ctx.user.id,
          validDays: input.validDays,
          cohort: input.cohort,
          note: input.note,
          expiresAt: input.expiresAt,
        });
      }),
    
    // 批量創建邀請碼
    createBatch: adminProcedure
      .input(z.object({
        count: z.number().min(1).max(100),
        validDays: z.number().default(90),
        cohort: z.string().optional(), // 期別
        note: z.string().optional(),
        expiresAt: z.date().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        return db.createBatchInvitationCodes({
          createdBy: ctx.user.id,
          count: input.count,
          validDays: input.validDays,
          cohort: input.cohort,
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

  // ==================== 用戶風格分析 ====================
  writingStyle: router({
    // 獲取用戶風格分析
    get: protectedProcedure.query(async ({ ctx }) => {
      const style = await db.getUserWritingStyle(ctx.user.id);
      return style || null;
    }),
    
    // 新增爆款貼文樣本
    addSample: protectedProcedure
      .input(z.object({
        content: z.string().min(50, "貼文內容至少需要 50 字"),
        engagement: z.number().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const existing = await db.getUserWritingStyle(ctx.user.id);
        const currentCount = existing?.samplePosts?.length || 0;
        
        if (currentCount >= 10) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: '最多只能新增 10 篇樣本貼文',
          });
        }
        
        return db.addSamplePost(ctx.user.id, input.content, input.engagement);
      }),
    
    // 移除樣本貼文
    removeSample: protectedProcedure
      .input(z.object({ index: z.number() }))
      .mutation(async ({ ctx, input }) => {
        return db.removeSamplePost(ctx.user.id, input.index);
      }),
    
    // AI 分析用戶風格
    analyze: protectedProcedure.mutation(async ({ ctx }) => {
      const style = await db.getUserWritingStyle(ctx.user.id);
      
      if (!style?.samplePosts || style.samplePosts.length < 3) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: '請至少提供 3 篇爆款貼文才能進行分析',
        });
      }
      
      // 更新狀態為分析中
      await db.upsertUserWritingStyle({
        userId: ctx.user.id,
        analysisStatus: 'analyzing',
      });
      
      const sampleTexts = style.samplePosts.map((p, i) => `[貼文 ${i + 1}]\n${p.content}`).join('\n\n---\n\n');
      
      const prompt = `你是一位專業的文案風格分析師。請分析以下 ${style.samplePosts.length} 篇 Threads 貼文，提取作者的寫作風格特徵。

${sampleTexts}

請分析並輸出 JSON 格式：`;
      
      try {
        const response = await invokeLLM({
          messages: [
            { role: 'system', content: '你是一位專業的文案風格分析師，擅長分析 Threads 貼文的寫作風格。' },
            { role: 'user', content: prompt },
          ],
          response_format: {
            type: 'json_schema',
            json_schema: {
              name: 'writing_style_analysis',
              strict: true,
              schema: {
                type: 'object',
                properties: {
                  toneStyle: {
                    type: 'string',
                    description: '語氣風格，例如：溫暖真誠、犹利直接、幽默風趣、理性分析、感性共鳴',
                  },
                  commonPhrases: {
                    type: 'array',
                    items: { type: 'string' },
                    description: '常用句式，例如：你有沒有發現...、說真的...、後來我才發現...',
                  },
                  catchphrases: {
                    type: 'array',
                    items: { type: 'string' },
                    description: '口頭禪，例如：真的、欸、吧、啦、其實',
                  },
                  hookStylePreference: {
                    type: 'string',
                    description: 'Hook 風格偏好，例如：反差型、提問型、場景型、故事型、數字型',
                  },
                  metaphorStyle: {
                    type: 'string',
                    description: '比喻風格，例如：生活化比喻、專業術語白話、場景化描述',
                  },
                  emotionRhythm: {
                    type: 'string',
                    description: '情緒節奏，例如：快節奏短句、娓娓道來長句、短長交替',
                  },
                  identityTags: {
                    type: 'array',
                    items: { type: 'string' },
                    description: '常用身分標籤，例如：創業者、娽娽、上班族',
                  },
                  emotionWords: {
                    type: 'array',
                    items: { type: 'string' },
                    description: '常用情緒詞，例如：累、崩潰、釋懷、感動',
                  },
                  ctaStyles: {
                    type: 'array',
                    items: { type: 'string' },
                    description: '常用 CTA 類型，例如：召喚同類、留言互動、引導點擊',
                  },
                },
                required: ['toneStyle', 'commonPhrases', 'catchphrases', 'hookStylePreference', 'metaphorStyle', 'emotionRhythm', 'identityTags', 'emotionWords', 'ctaStyles'],
                additionalProperties: false,
              },
            },
          },
        });
        
        const rawContent = response.choices[0].message.content;
        const contentStr = typeof rawContent === 'string' ? rawContent : '{}';
        const analysisResult = JSON.parse(contentStr);
        
        // 更新分析結果
        await db.updateWritingStyleAnalysis(ctx.user.id, {
          toneStyle: analysisResult.toneStyle,
          commonPhrases: analysisResult.commonPhrases,
          catchphrases: analysisResult.catchphrases,
          hookStylePreference: analysisResult.hookStylePreference,
          metaphorStyle: analysisResult.metaphorStyle,
          emotionRhythm: analysisResult.emotionRhythm,
          viralElements: {
            identityTags: analysisResult.identityTags,
            emotionWords: analysisResult.emotionWords,
            ctaStyles: analysisResult.ctaStyles,
          },
        });
        
        return {
          success: true,
          analysis: analysisResult,
        };
      } catch (error) {
        // 更新狀態為失敗
        await db.upsertUserWritingStyle({
          userId: ctx.user.id,
          analysisStatus: 'failed',
        });
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: '分析失敗，請稍後再試',
        });
      }
    }),
  }),

  // ==================== 開頭候選生成 ====================
  opener: router({
    // 生成多個開頭候選
    generate: protectedProcedure
      .input(z.object({
        topic: z.string().min(1, "請輸入主題"),
        contentType: z.string().min(1, "請選擇內容類型"),
        hookStyle: z.string().optional(),
        targetAudience: z.string().optional(),
        userContext: z.string().optional(),
        count: z.number().min(3).max(5).default(5),
      }))
      .mutation(async ({ ctx, input }) => {
        const { topic, contentType, hookStyle, targetAudience, userContext, count } = input;
        
        try {
          const result = await generateMultipleOpeners({
            userId: ctx.user.id,
            topic,
            contentType,
            hookStyle,
            targetAudience,
            userContext,
            count,
          });
          
          // 使用 Selector 進行排序
          const ranked = selectAndRank(result.candidates);
          
          return {
            candidates: ranked.rankedCandidates,
            topPick: ranked.topPick,
            avgAiScore: result.avgAiScore,
            filteredCount: ranked.filteredCount,
            explorationCount: result.explorationCount,
          };
        } catch (error) {
          console.error('[Opener Generate Error]', error);
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: '開頭生成失敗，請稍後再試',
          });
        }
      }),
    
    // 標記候選被選中
    select: protectedProcedure
      .input(z.object({
        candidateId: z.number(),
      }))
      .mutation(async ({ ctx, input }) => {
        await markOpenerSelected(input.candidateId);
        return { success: true };
      }),
    
    // 快速檢測 AI 痕跡
    detectAi: protectedProcedure
      .input(z.object({
        content: z.string().min(1),
      }))
      .mutation(async ({ input }) => {
        const result = await quickDetect(input.content);
        return result;
      }),
  }),
});

export type AppRouter = typeof appRouter;
