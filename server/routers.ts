import { COOKIE_NAME } from "@shared/const";
import { z } from "zod";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { invokeLLM } from "./_core/llm";
import { getModelForFeature } from "./services/llmConfig";
import * as db from "./db";
import { getDb } from "./db";
import { postMetrics, ipProfiles } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import { KNOWLEDGE_BASE, SYSTEM_PROMPTS, CONTENT_TYPES_WITH_VIRAL_ELEMENTS, FORBIDDEN_PHRASES, THREADS_STYLE_GUIDE, FOUR_LENS_FRAMEWORK } from "../shared/knowledge-base";
import { executeContentHealthCheck, MAX_SCORES, DIMENSION_NAMES } from "./content-health-check";
import { applyContentFilters, extractPreservedWords, extractEmotionWords, cleanAIOutput, filterProfanity } from "./contentFilters";
import { buildDataDrivenSystemPrompt, buildDataDrivenUserPrompt, analyzeGeneratedContent, getDataDrivenSummary, collectDataDrivenContext, calculateStyleMatch } from "./data-driven-prompt-builder";
import { selectRandomOpenerPattern, extractMaterialKeywords } from "../shared/opener-rules";
import { generateMultipleOpeners, markOpenerSelected, type OpenerCandidate } from "./openerGenerator";
import { selectAndRank, getTopN } from "./selector";
import { quickDetect } from "./aiDetector";
import { getContentTypeRule } from "../shared/content-type-rules";
import { buildStylePolishSystemPrompt, buildStylePolishUserPrompt, validateSemanticPreservation, buildStylePolishContext } from "./style-polish-prompt";
import { checkOpenerHomogeneityV2, saveOpenerEmbedding, checkSemanticFidelity, rankCandidatesByDiversity } from "./embedding-service";
import { findSimilarViralExamples, getSmartFewShotExamples, getClusteringSummary, getEmbeddingStats, getContentTypeRecommendation, getSimilarViralsByType, getHighPotentialTopics } from "./viral-embedding-service";
import { getSpiritualSuccessFactors, getContentTypeRecommendations, getPresentationRecommendations, findSimilarViralPosts } from "./ip-data-service";
import { OPTIMIZED_SYSTEM_PROMPT, POST_TYPE_STRUCTURES, CTA_TYPES, replaceAIWords, selectCTA, buildOptimizedPrompt, TOPIC_GENERATION_PROMPT, GUIDED_QUESTIONS } from "../shared/optimized-prompts";

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

    // 串文格式化 - 將長文分割成多段（優化版：保留原文，只加鉤子）
    convertToThread: protectedProcedure
      .input(z.object({ content: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const response = await invokeLLM({
          messages: [
            { role: "system", content: `你是一個 Threads 串文分割專家。

=== 核心原則（極度重要） ===

1. **保留原文**：不要改寫、不要添加新內容、不要刪除原有內容
2. **分段 3-4 段**：根據內容自然斷點分割，每段最多 500 字
3. **只加鉤子**：在每段結尾加一句簡單的鉤子，引導讀者繼續看

=== 鉤子範例（簡短自然） ===

- 「但這還不是最恐怖的...」
- 「結果呢？」
- 「接下來才是重點」
- 「然後我才發現...」
- 「你猜怎麼著？」

=== 絕對禁止 ===

- ✘ 不要改寫原文的任何內容
- ✘ 不要加入新的觀點或分析
- ✘ 不要加入「總結」「重點」等標題
- ✘ 不要在最後一段加 CTA（除非原文已有）
- ✘ 不要讓串文變得比原文長

=== 輸出格式 ===

用 "---" 分隔每段串文，不要加編號或標題。` },
            { role: "user", content: `請將以下內容轉換成 Threads 串文格式（記住：保留原文，只分段和加鉤子）：

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

    // 風格潤飾 API（專用）
    // 與 refineDraft 的差異：只改語氣，不改內容/結構/字數
    stylePolish: protectedProcedure
      .input(z.object({ 
        content: z.string(),
        // 可選：強制使用特定風格（如果用戶沒有設定風格）
        forceStyle: z.object({
          catchphrases: z.array(z.string()).optional(),
          speakingStyle: z.string().optional(),
          toneStyle: z.string().optional(),
        }).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        // 1. 載入用戶風格資料
        const userStyle = await db.getUserWritingStyle(ctx.user.id);
        const profile = await db.getIpProfileByUserId(ctx.user.id);
        
        // 2. 從 userStyle.samplePosts 取得爆款範例（Few-Shot）
        const samplePosts = userStyle?.samplePosts || [];
        const viralExamples = samplePosts
          .filter((s: { content: string; engagement?: number }) => s.content && s.content.length > 50)
          .slice(0, 3)
          .map((s: { content: string }) => s.content);
        
        // 3. 建立 StylePolishContext
        // 從 userStyle 和 profile 取得風格資料
        const catchphrasesArr = userStyle?.catchphrases || [];
        const commonPhrasesArr = userStyle?.commonPhrases || [];
        const emotionWordsArr = userStyle?.viralElements?.emotionWords || [];
        
        const styleData = {
          catchphrases: input.forceStyle?.catchphrases?.join('、') || catchphrasesArr.join('、') || '',
          speakingStyle: input.forceStyle?.speakingStyle || '',
          toneStyle: input.forceStyle?.toneStyle || userStyle?.toneStyle || profile?.voiceTone || '',
          commonPhrases: commonPhrasesArr.join('、') || '',
          emotionExpressions: emotionWordsArr.join('、') || '',
        };
        
        const context = buildStylePolishContext(
          input.content,
          styleData,
          viralExamples
        );
        
        // 4. 檢查是否有足夠的風格資料
        const hasStyleData = context.catchphrases.length > 0 || 
                             context.speakingStyle || 
                             context.viralExamples.length > 0;
        
        if (!hasStyleData) {
          return {
            success: false,
            content: input.content,
            message: '尚未設定個人風格。請先到「IP 地基」→「我的風格」上傳你的爆款貼文，讓 AI 學習你的說話方式。',
            validation: null,
          };
        }
        
        // 5. 建立提示詞
        const systemPrompt = buildStylePolishSystemPrompt(context);
        const userPrompt = buildStylePolishUserPrompt(input.content);
        
        // 6. 調用 LLM
        const response = await invokeLLM({
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          model: getModelForFeature('ai_chat'),  // 使用高品質模型
        });
        
        await db.logApiUsage(ctx.user.id, 'stylePolish', 'llm', 400, 500);
        
        let polishedContent = response.choices[0]?.message?.content;
        if (typeof polishedContent !== 'string') {
          polishedContent = input.content;
        }
        
        // 7. 清理 AI 輸出
        polishedContent = cleanAIOutput(polishedContent);
        
        // 8. 語意驗證（基礎版）
        const validation = validateSemanticPreservation(input.content, polishedContent);
        
        // 8.1 Embedding 語意保真檢測（進階版）
        let semanticFidelity: {
          isFaithful: boolean;
          semanticDistance: number;
          warning?: string;
        } | null = null;
        
        try {
          semanticFidelity = await checkSemanticFidelity(
            input.content,
            polishedContent
          );
          
          if (semanticFidelity) {
            console.log('[Embedding] 語意保真檢測:', {
              isFaithful: semanticFidelity.isFaithful,
              semanticDistance: semanticFidelity.semanticDistance,
            });
            
            // 如果語意偏離太大，加入警告
            if (!semanticFidelity.isFaithful && semanticFidelity.warning) {
              validation.warnings.push(semanticFidelity.warning);
              validation.isValid = false;
            }
          }
        } catch (embeddingError) {
          console.warn('[Embedding] 語意保真檢測失敗:', embeddingError);
        }
        
        // 9. 如果驗證失敗且字數差異過大，嘗試重新生成
        if (!validation.wordCountValid && validation.warnings.length > 0) {
          // 字數差異過大，嘗試精簡版重新生成
          const retryResponse = await invokeLLM({
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: `${userPrompt}\n\n【重要】上次潤飾後字數變化太大，這次請嚴格控制在 ${context.originalWordCount} 字左右。` },
            ],
            model: getModelForFeature('quality_check'),  // 使用較快的模型重試
          });
          
          const retryContent = retryResponse.choices[0]?.message?.content;
          if (typeof retryContent === 'string') {
            const retryValidation = validateSemanticPreservation(input.content, retryContent);
            if (retryValidation.wordCountValid || 
                Math.abs(retryValidation.polishedWordCount - context.originalWordCount) < 
                Math.abs(validation.polishedWordCount - context.originalWordCount)) {
              // 重試版本更好，使用重試版本
              polishedContent = cleanAIOutput(retryContent);
              return {
                success: true,
                content: polishedContent,
                message: '已套用你的個人風格潤飾完成。',
                validation: retryValidation,
              };
            }
          }
        }
        
        return {
          success: true,
          content: polishedContent,
          message: validation.isValid 
            ? '已套用你的個人風格潤飾完成。' 
            : `已潤飾完成，但有些地方可能需要檢查：${validation.warnings.join('、')}`,
          validation,
        };
      }),
  }),

  // ==================== AI 功能 ====================
  ai: router({
    // 智能內容建議 - 發文工作室首頁個性化建議
    getSmartSuggestions: protectedProcedure
      .query(async ({ ctx }) => {
        const profile = await db.getIpProfileByUserId(ctx.user.id);
        const growthMetrics = await db.getUserGrowthMetrics(ctx.user.id);
        const userStyle = await db.getUserWritingStyle(ctx.user.id);
        const recentDrafts = await db.getDraftsByUserId(ctx.user.id);
        const recentPosts = await db.getPostsByUserId(ctx.user.id);
        
        // 分析最近發文類型分佈
        const recentContentTypes: Record<string, number> = {};
        const recentDraftsSlice = recentDrafts.slice(0, 20);
        for (const draft of recentDraftsSlice) {
          const type = draft.contentType || 'unknown';
          recentContentTypes[type] = (recentContentTypes[type] || 0) + 1;
        }
        
        // 分析戰報表現（基於草稿的內容類型）
        const performanceByType: Record<string, { total: number; avgEngagement: number }> = {};
        for (const draft of recentDraftsSlice) {
          const type = draft.contentType || 'unknown';
          if (!performanceByType[type]) {
            performanceByType[type] = { total: 0, avgEngagement: 0 };
          }
          performanceByType[type].total += 1;
          // 簡化計算：已發布的草稿有更高權重
          performanceByType[type].avgEngagement += draft.status === 'published' ? 2 : 1;
        }
        
        // 計算平均互動
        for (const type of Object.keys(performanceByType)) {
          if (performanceByType[type].total > 0) {
            performanceByType[type].avgEngagement /= performanceByType[type].total;
          }
        }
        
        // 找出表現最好的內容類型
        const bestPerformingTypes = Object.entries(performanceByType)
          .sort((a, b) => b[1].avgEngagement - a[1].avgEngagement)
          .slice(0, 3)
          .map(([type]) => type);
        
        // 找出最少發佈的內容類型（多樣性建議）
        const allContentTypes = ['story', 'knowledge', 'opinion', 'dialogue', 'contrast', 'casual', 'question', 'poll'];
        const underusedTypes = allContentTypes.filter(type => !recentContentTypes[type] || recentContentTypes[type] < 2);
        
        // 產生建議
        const suggestions: Array<{
          type: 'content_type' | 'topic' | 'timing' | 'style';
          title: string;
          description: string;
          action?: string;
          priority: 'high' | 'medium' | 'low';
        }> = [];
        
        // 建議 1: 基於表現最好的類型
        if (bestPerformingTypes.length > 0) {
          const contentTypeNames: Record<string, string> = {
            story: '故事型', knowledge: '知識型', opinion: '觀點型',
            dialogue: '對話型', contrast: '反差型', casual: '閒聊型',
            question: '提問型', poll: '投票型'
          };
          suggestions.push({
            type: 'content_type',
            title: `你的「${contentTypeNames[bestPerformingTypes[0]] || bestPerformingTypes[0]}」表現最好`,
            description: `根據戰報分析，這個類型的互動率最高，建議繼續發布`,
            action: bestPerformingTypes[0],
            priority: 'high'
          });
        }
        
        // 建議 2: 多樣性建議
        if (underusedTypes.length > 0) {
          const contentTypeNames: Record<string, string> = {
            story: '故事型', knowledge: '知識型', opinion: '觀點型',
            dialogue: '對話型', contrast: '反差型', casual: '閒聊型',
            question: '提問型', poll: '投票型'
          };
          suggestions.push({
            type: 'content_type',
            title: `試試「${contentTypeNames[underusedTypes[0]] || underusedTypes[0]}」吧`,
            description: `你最近較少發布這類內容，多樣化可以吸引不同受眾`,
            action: underusedTypes[0],
            priority: 'medium'
          });
        }
        
        // 建議 3: 基於經營階段
        const stage = growthMetrics?.currentStage || 'startup';
        const stageAdvice: Record<string, { title: string; description: string }> = {
          startup: {
            title: '起步階段：多分享個人故事',
            description: '建立人設和信任感，先不要推銷'
          },
          growth: {
            title: '成長階段：強化專業內容',
            description: '分享更多專業知識，建立權威感'
          },
          monetize: {
            title: '變現階段：可以開始導流',
            description: '適度加入導流內容，但保持價值輸出'
          },
          scale: {
            title: '規模化階段：建立內容矩陣',
            description: '系統化內容產出，建立內容資產'
          }
        };
        if (stageAdvice[stage]) {
          suggestions.push({
            type: 'topic',
            title: stageAdvice[stage].title,
            description: stageAdvice[stage].description,
            priority: 'medium'
          });
        }
        
        // 建議 4: 風格建議
        if (userStyle?.hookStylePreference) {
          const hookStyleNames: Record<string, string> = {
            mirror: '鏡像心理', scene: '情境化帶入',
            dialogue: '對話型', contrast: '反差型', casual: '閒聊型'
          };
          suggestions.push({
            type: 'style',
            title: `你常用「${hookStyleNames[userStyle.hookStylePreference] || userStyle.hookStylePreference}」開頭`,
            description: '這是你的特色，但也可以嘗試其他風格增加變化',
            priority: 'low'
          });
        }
        
        return {
          suggestions: suggestions.slice(0, 4),
          stats: {
            totalDrafts: recentDrafts.length,
            totalPosts: recentPosts.length,
            bestPerformingTypes,
            currentStage: stage
          }
        };
      }),

    // 腦力激盪（沒靈感時）- 強化版
    brainstorm: protectedProcedure
      .input(z.object({
        pillarId: z.number().optional(),
        topic: z.string().optional(),
        // P0 優化：新增 goal 參數，讓目標選擇影響腦力激盪
        goal: z.enum(['awareness', 'trust', 'engagement', 'sales']).optional(),
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
        
        // P0 優化：根據目標選擇調整腦力激盪策略
        const goalStrategies = {
          awareness: {
            name: '讓人更懂我',
            description: '建立個人品牌認知，讓更多人認識你',
            recommendedTypes: ['story', 'viewpoint', 'casual', 'quote'],
            contentFocus: '分享個人經歷、價值觀、生活態度，讓讀者感受到你的人格特質',
            hookStyle: '用真誠的個人經歷開頭，展現真實的自己',
            avoidTypes: ['lead_promo', 'service_intro', 'limited_offer'],
          },
          trust: {
            name: '讓人信任我',
            description: '建立專業權威，讓人相信你的專業能力',
            recommendedTypes: ['knowledge', 'summary', 'diagnosis', 'contrast'],
            contentFocus: '分享專業知識、方法論、案例分析，展現你的專業深度',
            hookStyle: '用反常識或專業見解開頭，讓人覺得「這人懂」',
            avoidTypes: ['casual', 'poll'],
          },
          engagement: {
            name: '有人互動留言',
            description: '提高互動率，讓更多人留言討論',
            recommendedTypes: ['question', 'poll', 'dialogue', 'contrast'],
            contentFocus: '拋出爭議性話題、提問、投票，讓讀者想表達意見',
            hookStyle: '用問句或爭議性觀點開頭，引發討論欲望',
            avoidTypes: ['summary', 'knowledge'],
          },
          sales: {
            name: '慢慢賣產品',
            description: '引導轉化，讓讀者對你的產品/服務產生興趣',
            recommendedTypes: ['success_story', 'diagnosis', 'lead_magnet', 'contrast'],
            contentFocus: '分享成功案例、帶出痛點解決方案，自然帶入產品價值',
            hookStyle: '用成果或轉變開頭，讓人想知道怎麼做到',
            avoidTypes: ['casual', 'poll'],
          },
        };
        
        const goalStrategy = input.goal ? goalStrategies[input.goal] : null;
        
        // ✅ P0 優化：整合 Embedding 語意匹配，找出相似的爆款主題
        let semanticExamplesPrompt = '';
        let lowRelevanceHint = ''; // 相關性提示
        if (input.topic) {
          try {
            const similarExamples = await findSimilarViralExamples(input.topic, 5, undefined, true);
            if (similarExamples.length > 0) {
              // 檢查最高相似度是否低於 50%
              const maxSimilarity = Math.max(...similarExamples.map(ex => ex.similarity));
              if (maxSimilarity < 0.5) {
                lowRelevanceHint = `\n💡 提示：目前爆款庫中沒有與「${input.topic}」高度相關的範例。以下內容僅供啟發參考，建議嘗試用更常見的詞彙描述你的主題。\n`;
              }
              
              semanticExamplesPrompt = `\n=== 語意相似的爆款參考（從 2,542 篇爆款中找出） ===${lowRelevanceHint}\n`;
              similarExamples.forEach((ex, i) => {
                const content = ex.viralExample.postText || ex.viralExample.opener50 || '';
                const preview = content.substring(0, 80).replace(/\n/g, ' ');
                const matchedBy = ex.matchedKeyword ? ` (由「${ex.matchedKeyword}」匹配)` : '';
                semanticExamplesPrompt += `${i + 1}. [相似度 ${(ex.similarity * 100).toFixed(0)}%]${matchedBy} ${preview}...\n`;
              });
              semanticExamplesPrompt += `\n請參考以上爆款的主題和切角，但要結合創作者的專業領域來調整。\n`;
            }
          } catch (e) {
            console.error('[brainstorm] Embedding 匹配失敗:', e);
          }
        }
        
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
        
        // P0 優化：建構目標策略提示詞
        let goalPrompt = '';
        if (goalStrategy) {
          goalPrompt = `
=== ❗❗❗ 本次發文目標（最高優先級） ❗❗❗ ===
目標：${goalStrategy.name}
說明：${goalStrategy.description}

【強制規則】
1. 所有 5 個主題都必須服務於「${goalStrategy.name}」這個目標
2. 內容焦點：${goalStrategy.contentFocus}
3. 開頭風格：${goalStrategy.hookStyle}
4. 優先使用這些內容類型：${goalStrategy.recommendedTypes.join('、')}
5. 避免使用這些內容類型：${goalStrategy.avoidTypes.join('、')}

`;
        }
        
        const systemPrompt = `${SYSTEM_PROMPTS.contentGeneration}
${goalPrompt}${semanticExamplesPrompt}
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

        // ✅ 方案 A：品質優先 - 腦力激盪使用 Gemini 2.5 Flash
        const response = await invokeLLM({
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: input.topic 
              ? `【重要】用戶已提供參考方向，所有主題必須圍繞這個方向。

參考方向：${input.topic}

請根據以上參考方向，結合我的 IP 地基和受眾，給我5個主題建議。

【核心約束】
1. 所有 5 個主題都必須直接圍繞「${input.topic}」這個方向
2. 不允許跳到其他無關主題（即使與我的專業相關）
3. 可以用不同的內容類型來表達同一個方向（故事型、觀點型、提問型等）
4. 每個主題都要是參考方向的不同切角或表達方式

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

只輸出 JSON，不要其他文字。`
              : `請根據我的 IP 地基和受眾，給我5個今天可以發的貼文主題建議。

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
          model: getModelForFeature('brainstorm'),  // Gemini 2.5 Flash
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
        hookStyle: z.string().optional(), // 可選的開頭風格標籤
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
        
        // 風格標籤中文映射
        const hookStyleLabels: Record<string, string> = {
          'mirror': '鏡像心理',
          'scene': '情境化帶入',
          'dialogue': '對話型',
          'contrast': '反差型',
          'casual': '閒聊型',
        };
        
        // 如果用戶有選擇風格，加入提示
        const hookStyleHint = input.hookStyle 
          ? `\n❗ 用戶希望優先使用「${hookStyleLabels[input.hookStyle] || input.hookStyle}」風格，請在生成的切角中優先採用這種風格。`
          : '';
        
        // ✅ P1 優化：整合 Embedding 語意匹配，找出相似的爆款切角參考
        let semanticAnglesPrompt = '';
        try {
          const similarExamples = await findSimilarViralExamples(input.material, 3, undefined, true);
          if (similarExamples.length > 0) {
            // 檢查最高相似度是否低於 50%
            const maxSimilarity = Math.max(...similarExamples.map(ex => ex.similarity));
            const lowRelevanceHint = maxSimilarity < 0.5 
              ? `\n💡 提示：目前爆款庫中沒有與此素材高度相關的範例。以下內容僅供啟發參考。\n` 
              : '';
            
            semanticAnglesPrompt = `\n=== 語意相似的爆款參考（從 2,542 篇爆款中找出） ===${lowRelevanceHint}\n`;
            similarExamples.forEach((ex, i) => {
              const content = ex.viralExample.postText || ex.viralExample.opener50 || '';
              const preview = content.substring(0, 100).replace(/\n/g, ' ');
              const matchedBy = ex.matchedKeyword ? ` (由「${ex.matchedKeyword}」匹配)` : '';
              semanticAnglesPrompt += `${i + 1}. [相似度 ${(ex.similarity * 100).toFixed(0)}%]${matchedBy} ${preview}...\n`;
            });
            semanticAnglesPrompt += `\n請參考以上爆款的切角和開頭方式，但要結合創作者的素材來調整。\n`;
          }
        } catch (e) {
          console.error('[analyzeAngles] Embedding 匹配失敗:', e);
        }
        
        const systemPrompt = `${SYSTEM_PROMPTS.contentGeneration}
${semanticAnglesPrompt}
=== 創作者 IP 地基 ===
${ipContext || '未設定'}

=== 目標受眾 ===
${audienceContext || '未設定'}

=== 開頭風格參考 ===
你可以使用以下幾種開頭風格：
- 鏡像心理：讓讀者覺得「這不就是在說我嗎！」
- 情境化帶入：用具體場景讓讀者身歷其境
- 對話型：模擬真實對話，創造親近感
- 反差型：用意外的轉折吸引注意
- 閒聊型：像朋友聊天一樣自然${hookStyleHint}

=== 重要指示 ===
1. 切角必須符合創作者的人設和專業
2. 切角必須能觸動目標受眾
3. 開頭示範要簡潔有力，讓人想繼續看
4. 每個切角應試用不同的開頭風格，讓用戶有多樣化的選擇`;

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
        // 目標受眾 ID（可選，如果指定則針對該受眾生成 Hook）
        targetAudienceId: z.number().optional(),
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
        
        // 受眾資訊（強化版 - 支援目標受眾選擇）
        let audienceContext = '';
        if (input.targetAudienceId && audiences && audiences.length > 0) {
          const targetAudience = audiences.find(a => a.id === input.targetAudienceId);
          if (targetAudience) {
            audienceContext = `❗❗❗【極度重要 - 目標受眾】❗❗❗

這些 Hook 必須完全針對以下受眾設計：

🎯 受眾名稱：${targetAudience.segmentName}

🔥 他們的痛點（Hook 必須觸及）：
${targetAudience.painPoint || '未設定'}

❗ 要求：Hook 必須讓這個受眾覺得「這就是在說我」`;
          }
        } else if (audiences && audiences.length > 0) {
          audienceContext = '【目標受眾 - Hook 要讓他們覺得「這就是在說我」】\n' + audiences.map(a => 
            `- ${a.segmentName}：痛點是「${a.painPoint || '未設定'}」`
          ).join('\n');
        }
        
        // Hook 風格說明
        // ========== Hook 知識庫 V18.0（融合 Skill 數據分析） ==========
        // 核心前提：Threads 用戶處於「快速略讀模式」，Hook 的唯一功能是讓人在 0.5 秒內停下來
        
        // 三大心理學原理
        const hookPsychologyPrinciples = `
【Hook 設計的三大心理學原理】

1. 鏡像原理（讓他看到自己）
   - 人類天生最關心自己
   - 當內容說中他的處境或心聲，會產生「欸，這是在說我」的感覺
   - 常見句式：「你是不是也...」「有沒有人也會這樣...」「如果你正在...，這篇你要看」

2. 衝突原理（讓他看到反差）
   - 大腦喜歡反差、顛覆和未解之謎
   - 充滿矛盾或引發好奇的開頭，會迫使他想知道「接下來發生什麼」
   - 常見句式：「我以為...但其實...」「我做錯了一堆事，結果卻...」「我不是...但我還是...」

3. 解法原理（讓他看到價值）
   - 大腦天生尋求解決方案以節省能量
   - 當你點出痛點並暗示有解法，他會為了獲得價值而停下
   - 常見句式：「...有問題？這幾點先看懂」「...踩雷的人，通常忽略了這幾件事」
`;

        // 五種即插即用的 Hook 句型
        const hookTemplates = `
【五種 Hook 句型結構（參考節奏，不要照抄）】

1. 引言式（Quote Hook）
   - 引用一句話或轉貼，自然地打開話題
   - 範例：「我最近看到一句話：『慢慢來，比較快。』覺得好有感。」

2. 提問式（Question Hook）
   - 拋出一個引發思考或共鳴的問題，像聊天一樣開場
   - 範例：「你也有這種時候嗎？排了很多計畫，最後只想躺著？」

3. 感受式（Feeling Hook）
   - 從個人真實的情緒或狀態出發，平淡但有力
   - 範例：「最近有點累，但還是想記錄一下今天的小開心。」

4. 發現式（Discovery Hook）
   - 分享一個日常中的小領悟或靈感，不高調但有共鳴
   - 範例：「我發現，每天出門散步10分鐘，心情真的會變好一點。」

5. 反差式（Contrast Hook）
   - 講述一個「無心插柳」的時刻，充滿真誠感
   - 範例：「原本只是想記錄今天吃了什麼，沒想到一堆人問哪裡買的。」

【數據驗證的 6 種高效 Hook 類型（基於 50 帳號 29,475 篇分析）】

1. 數字/數據開頭（Top 200 佔 34%）
   - 公式：[N] 個 [工具/技巧/方法]，[具體好處]
   - 範例：「5 個我最常用的文案指令，讓你直接複製貼上就能用」

2. 極端形容詞/震撼（Top 200 佔 17%）
   - 公式：我真的 [極端反應]。[簡短原因]...
   - 範例：「我真的嚇到。用 ChatGPT 幫我分析職涯，結果它講的每一點都像在翻我內心劇本。」

3. 個人經驗/故事（Top 200 佔 8%）
   - 公式：[我/朋友] + [做了某件事] + [意外結果]...
   - 範例：「我把婚顧退掉了，用 ChatGPT 規劃出完美婚禮（還免費）」

4. 否定/警告開頭（Top 200 佔 4%）
   - 公式：不要再 [常見錯誤]。[更好的方法]:
   - 範例：「不要再叫 ChatGPT「幫我摘要」因為那只會得到機械、沒靈魂的筆記。」

5. 疑問句/提問（Top 200 佔 4%）
   - 公式：[共鳴情境/兩難]？[2-3 個選項]
   - 範例：「同樣30歲 A：環遊世界，存款10萬 B：穩定工作，存款500萬。你會選哪一個？」

6. 場景式對話開頭（故事型領域極高）
   - 公式：[某人說]: "..." → [反應] → [轉折]
   - 範例：「她看了我一眼，輕聲說：『我知道啊，你是例外。可是人有時候，是會被整個世界消耗掉的。』」

【Hook 組合模式（最高互動）】
- 數字+否定（平均 1500 互動）：「不要再X了。這N個方法才是正解」
- 震撼+個人經驗（平均 1200 互動）：「我真的嚇到。我用X做了Y...」
- 數字+個人經驗（平均 1100 互動）：「我朋友用X做了Y，N天就看到效果」
- 疑問+場景（平均 1000 互動）：「如果你手上N萬，你會怎麼規劃？」
`;

        // Hook 風格指南（保留原有的，但調整描述）
        const hookStyleGuide: Record<string, string> = {
          mirror: '鏡像式：運用「鏡像原理」，讓讀者看到自己，產生「這是在說我」的感覺',
          contrast: '反差式：運用「衝突原理」，製造認知反差，讓讀者想知道接下來發生什麼',
          question: '提問式：拋出引發思考的問題，像聊天一樣開場',
          feeling: '感受式：從真實情緒出發，平淡但有力',
          discovery: '發現式：分享日常小領悟，不高調但有共鳴',
        };
        
        const selectedStyle = input.hookStyle ? hookStyleGuide[input.hookStyle] : '請給出多種不同風格的 Hook';
        
        // ✅ P0+P1 優化：取得爆款開頭範例
        const viralOpeners = await db.getViralOpeners({ keyword: input.topic, limit: 5 });
        
        // ✅ P1 優化：整合 Embedding 語意匹配，找出相似主題的爆款開頭
        let semanticHooksPrompt = '';
        let hooksLowRelevanceHint = '';
        try {
          const similarExamples = await findSimilarViralExamples(input.topic, 5, undefined, true);
          if (similarExamples.length > 0) {
            // 檢查最高相似度是否低於 50%
            const maxSimilarity = Math.max(...similarExamples.map(ex => ex.similarity));
            if (maxSimilarity < 0.5) {
              hooksLowRelevanceHint = `\n💡 提示：目前爆款庫中沒有與「${input.topic}」高度相關的開頭範例。以下內容僅供啟發參考。\n`;
            }
            
            semanticHooksPrompt = `\n=== 語意相似的爆款開頭（從 2,542 篇爆款中找出） ===${hooksLowRelevanceHint}\n`;
            similarExamples.forEach((ex, i) => {
              const opener = ex.viralExample.opener50 || (ex.viralExample.postText || '').substring(0, 50);
              const matchedBy = ex.matchedKeyword ? ` (由「${ex.matchedKeyword}」匹配)` : '';
              semanticHooksPrompt += `${i + 1}. [相似度 ${(ex.similarity * 100).toFixed(0)}%]${matchedBy} 「${opener}」（${ex.viralExample.likes || 0} 讚）\n`;
            });
            semanticHooksPrompt += `\n請參考以上爆款的開頭結構和語氣，但要結合創作者的主題來調整。\n`;
          }
        } catch (e) {
          console.error('[generateHooks] Embedding 匹配失敗:', e);
        }
        let viralOpenersContext = '';
        if (viralOpeners.length > 0) {
          viralOpenersContext = `\n=== 爆款開頭範例（參考結構，不要複製） ===\n`;
          viralOpeners.forEach((o, i) => {
            viralOpenersContext += `${i + 1}. 「${o.opener50}」（${o.likes} 讚）\n`;
          });
          viralOpenersContext += `\n請參考以上開頭的結構和語氣，但要結合創作者的風格來調整。\n`;
        }
        
        // 提取用戶明確提供的素材清單
        const userProvidedMaterials = {
          topic: input.topic,
          inputs: input.inputs || {},
        };
        const materialsList = Object.entries(userProvidedMaterials.inputs)
          .filter(([_, v]) => v && String(v).trim())
          .map(([k, v]) => `- ${k}: ${v}`)
          .join('\n');
        
        const systemPrompt = `${SYSTEM_PROMPTS.contentGeneration}

=== 創作者 IP 地基 ===
${ipContext || '未設定'}

=== 目標受眾 ===
${audienceContext || '未設定'}

${hookPsychologyPrinciples}
${hookTemplates}

=== Hook 風格指南 ===
${selectedStyle}
${viralOpenersContext}${semanticHooksPrompt}

=== ❗❗❗ 素材邊界檢查 - 最高優先級 ❗❗❗ ===

【用戶明確提供的素材清單】
主題：${input.topic}
${materialsList || '（用戶未提供額外素材）'}

【絕對禁止的行為】
1. ❌ 禁止捏造用戶沒有提到的具體場景（如「在路邊看到一朵小花」「在咖啡廳崩潰」）
2. ❌ 禁止捏造用戶沒有提到的具體物件（如「編了一朵花」「收到一封信」）
3. ❌ 禁止捏造用戶沒有提到的具體對話（如「朋友問我『你還好嗎』」）
4. ❌ 禁止推測或延伸用戶的故事（如：朋友過世 ≠ 關係結束）
5. ❌ 禁止添加任何用戶沒有明確提到的細節

【正確的做法】
1. ✅ 只使用上方「素材清單」中的內容
2. ✅ 可以用通用的情緒詞彙（如「崩潰」「難過」「感動」）
3. ✅ 可以用時間概念（如「三個月後」「那一天」）
4. ✅ 保持適度模糊，讓讀者自己代入
5. ✅ 每個 Hook 中的具體細節，都必須能在素材清單中找到來源

=== Hook 設計指南 ===
1. 每個 Hook 不超過 50 字（理想 30 字以內）
2. Hook 的唯一功能是「讓人在 0.5 秒內停下來」
3. 選擇一個心理學原理作為設計基礎（鏡像/衝突/解法）
4. 參考五種句型結構，但不要照抄
5. 符合創作者的語氣風格
6. 避免套路感：每種句型最多使用一次

=== 黃金法則 ===
在生成每個 Hook 前，問自己：
1. 「這句話是對誰說的？」
2. 「他看到這句話，真的會有感覺嗎？」
3. 「這個 Hook 中的每個細節，都能在用戶素材中找到來源嗎？」`;

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
      "principle": "鏡像原理",
      "templateType": "提問式",
      "content": "你是不是也常常...",
      "reason": "這個開頭能讓受眾立刻產生共鳴",
      "materialSource": "來自用戶素材：xxx"
    }
  ]
}

【重要】每個 Hook 必須：
1. 標註使用的心理學原理（principle）：鏡像原理/衝突原理/解法原理
2. 標註使用的句型結構（templateType）：引言式/提問式/感受式/發現式/反差式
3. 標註素材來源（materialSource）：說明這個 Hook 的內容來自用戶的哪個素材
4. 確保 5 個 Hook 使用不同的原理和句型組合，避免重複` }
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
                        style: { type: "string", description: "Hook 風格 ID（mirror/contrast/question/feeling/discovery）" },
                        styleName: { type: "string", description: "Hook 風格名稱（鏡像式/反差式/提問式/感受式/發現式）" },
                        principle: { type: "string", description: "使用的心理學原理（鏡像原理/衝突原理/解法原理）" },
                        templateType: { type: "string", description: "使用的句型結構（引言式/提問式/感受式/發現式/反差式）" },
                        content: { type: "string", description: "Hook 內容" },
                        reason: { type: "string", description: "為什麼這個 Hook 有效" },
                        materialSource: { type: "string", description: "素材來源：說明這個 Hook 的內容來自用戶的哪個素材" }
                      },
                      required: ["style", "styleName", "principle", "templateType", "content", "reason", "materialSource"],
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
        
        let hooksData: { hooks: Array<{ style: string; styleName: string; principle: string; templateType: string; content: string; reason: string; materialSource: string }> } = { hooks: [] };
        try {
          const rawContent = response.choices[0]?.message?.content;
          const content = typeof rawContent === 'string' ? rawContent : '{}';
          hooksData = JSON.parse(content);
        } catch (e) {
          console.error('Failed to parse hooks JSON:', e);
        }
        
        // ✅ 開頭選擇優化：為每個 Hook 計算與爆款的相似度，標記推薦項目
        const hooksWithRecommendation = await Promise.all(
          (hooksData.hooks || []).map(async (hook, index) => {
            try {
              // 用每個 Hook 的內容去匹配爆款庫
              const similarExamples = await findSimilarViralExamples(hook.content, 1, undefined, false);
              const similarity = similarExamples.length > 0 ? similarExamples[0].similarity : 0;
              const matchedViral = similarExamples.length > 0 ? similarExamples[0].viralExample : null;
              
              return {
                ...hook,
                viralSimilarity: similarity,
                matchedViralOpener: matchedViral?.opener50 || null,
                matchedViralLikes: matchedViral?.likes || null,
              };
            } catch (e) {
              return {
                ...hook,
                viralSimilarity: 0,
                matchedViralOpener: null,
                matchedViralLikes: null,
              };
            }
          })
        );
        
        // 找出相似度最高的作為推薦
        const maxSimilarity = Math.max(...hooksWithRecommendation.map(h => h.viralSimilarity));
        const hooksWithRecommendationFlag = hooksWithRecommendation.map(hook => ({
          ...hook,
          isRecommended: hook.viralSimilarity === maxSimilarity && maxSimilarity > 0.3,
          recommendationReason: hook.viralSimilarity === maxSimilarity && maxSimilarity > 0.3
            ? `這個開頭的風格接近爆款「${hook.matchedViralOpener?.substring(0, 30)}...」`
            : null,
        }));
        
        return {
          hooks: hooksWithRecommendationFlag,
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
        // 目標受眾 ID（可選，如果指定則只針對該受眾寫作）
        targetAudienceId: z.number().optional(),
        // 創作意圖：pure_personal(純個人故事) / light_connection(輕度連結) / full_professional(完整導入)
        creativeIntent: z.enum(['pure_personal', 'light_connection', 'full_professional']).optional().default('full_professional'),
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
        
        // ✅ v3.0 Embedding 語意匹配：根據素材內容找出最相似的爆款範例
        let semanticFewShotPrompt = '';
        try {
          const smartExamples = await getSmartFewShotExamples(
            materialContent,
            input.contentType,
            3
          );
          if (smartExamples.length > 0) {
            semanticFewShotPrompt = `\n=== 語意匹配爆款範例（基於 1,240 篇爆款分析） ===\n`;
            smartExamples.forEach((ex, i) => {
              semanticFewShotPrompt += `\n範例 ${i + 1}（${ex.likes} 讚，${ex.matchReason}）：\n${ex.postText.substring(0, 200)}...\n`;
            });
            semanticFewShotPrompt += `\n請參考以上範例的結構和語氣，但要結合創作者的風格來寫。\n`;
            console.log('[Embedding] 語意匹配找到', smartExamples.length, '篇相似爆款');
          }
        } catch (embeddingError) {
          console.warn('[Embedding] 語意匹配失敗:', embeddingError);
        }
        
        // ✅ 數據驅動三層提示詞系統（新增）
        const dataDrivenContext = await collectDataDrivenContext(input.contentType, materialContent);
        const selectedOpenerPattern = dataDrivenContext.selectedOpenerPattern;
        const materialKeywords = dataDrivenContext.materialKeywords;
        
        // 建構 IP 地基資料字串（強化版 - 根據 creativeIntent 動態控制）
        const buildIpContext = () => {
          const creativeIntent = input.creativeIntent || 'full_professional';
          const parts: string[] = [];
          
          // 純個人故事模式：完全不注入 IP 地基
          if (creativeIntent === 'pure_personal') {
            parts.push(`【創作模式】純個人故事 - 請完全基於用戶提供的素材寫作，不要加入任何專業身份或工作相關內容。`);
            parts.push(`【重要】這篇貼文是純粹的個人分享，不需要連結到任何專業領域或商業模式。`);
            // 只保留語氣風格
            if (profile?.voiceTone) {
              parts.push(`【說話風格】你的說話風格是「${profile.voiceTone}」，請確保文案符合這個語氣。`);
            }
            return parts.join('\n');
          }
          
          // 輕度連結模式：只注入基本身份和語氣，不注入專業內容
          if (creativeIntent === 'light_connection') {
            parts.push(`【創作模式】輕度連結 - 以用戶素材為主，可以自然帶入身份背景，但不要硬轉到專業內容。`);
            if (profile?.occupation) {
              parts.push(`【你的身份】你是一位${profile.occupation}，可以在內容中自然帶入這個身份的視角，但不要強調。`);
            }
            if (profile?.voiceTone) {
              parts.push(`【說話風格】你的說話風格是「${profile.voiceTone}」，請確保文案符合這個語氣。`);
            }
            return parts.join('\n');
          }
          
          // 完整導入模式（full_professional）：完整注入 IP 地基
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
        
        // 建構受眾資料字串（強化版 - 支援目標受眾選擇）
        const buildAudienceContext = () => {
          if (!audiences || audiences.length === 0) {
            return '【目標受眾】未設定，請用通用的語氣寫作。';
          }
          
          // 如果有指定目標受眾，只針對該受眾寫作（P1 強化版）
          if (input.targetAudienceId) {
            const targetAudience = audiences.find(a => a.id === input.targetAudienceId);
            if (targetAudience) {
              // 根據受眾名稱推斷可能的場景和語言
              const audienceName = targetAudience.segmentName || '';
              let audienceScenario = '';
              let audienceLanguage = '';
              
              // 根據受眾名稱推斷場景
              if (audienceName.includes('初學') || audienceName.includes('新手') || audienceName.includes('入門')) {
                audienceScenario = '他們可能剛接觸這個領域，對很多術語不熟悉，容易感到迷惘和焦慮。';
                audienceLanguage = '用最簡單的語言，避免專業術語，像朋友聊天一樣解釋。';
              } else if (audienceName.includes('資深') || audienceName.includes('專業') || audienceName.includes('進階')) {
                audienceScenario = '他們已經有一定基礎，可能遇到瓶頸或想突破，渴望更高層次的洞見。';
                audienceLanguage = '可以用專業語言，分享更深入的見解和實戰經驗。';
              } else if (audienceName.includes('老師') || audienceName.includes('教練') || audienceName.includes('講師')) {
                audienceScenario = '他們是同業，可能在思考如何經營、如何突破、如何建立差異化。';
                audienceLanguage = '用同業的語言，分享經營心得和市場洞察。';
              } else if (audienceName.includes('學員') || audienceName.includes('學生') || audienceName.includes('付費')) {
                audienceScenario = '他們已經付費或正在考慮付費，渴望得到實際的效果和轉變。';
                audienceLanguage = '強調實際效果和成果，讓他們感受到價值。';
              }
              
              return `❗❗❗【極度重要 - 目標受眾差異化寫作】❗❗❗

這篇文章必須完全針對以下受眾寫作，讓他們一看就覺得「這就是寫給我的」：

🎯 受眾名稱：${targetAudience.segmentName}

📍 他們的典型場景：
${audienceScenario || '請想像這個受眾在日常生活中會遇到什麼情況。'}

🔥 他們的核心痛點（開頭必須觸及）：
${targetAudience.painPoint || '未設定'}

🌟 他們的深層渴望（結尾要給希望）：
${targetAudience.desiredOutcome || '未設定'}

🗣️ 語言風格要求：
${audienceLanguage || '用這個受眾會說的話、能懂的詞彙。'}

❗ 寫作必須遵守：
1. 開頭第一句就要讓這個受眾覺得「這就是在說我」
2. 內容要用他們熟悉的場景和語言
3. 舉例要貼近他們的日常經驗
4. 結尾要讓他們看到希望或下一步
5. 絕對不能寫成通用內容，必須有明顯的受眾專屬感`;
            }
          }
          
          // 沒有指定目標受眾，列出所有受眾但強化提示
          const audienceLines = audiences.map(a => {
            let line = `  • ${a.segmentName}`;
            if (a.painPoint) line += `\n    痛點：${a.painPoint.substring(0, 100)}${a.painPoint.length > 100 ? '...' : ''}`;
            if (a.desiredOutcome) line += `\n    渴望：${a.desiredOutcome.substring(0, 100)}${a.desiredOutcome.length > 100 ? '...' : ''}`;
            return line;
          });
          
          return `【目標受眾 - 請針對他們的痛點寫作】

重要：文章開頭必須讓受眾覺得「這就是在說我」

${audienceLines.join('\n\n')}`;
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
          
          viewpoint: `❗❗❗【觀點型貼文 - 必須有明確立場】❗❗❗

觀察到的現象：${flexibleInput.phenomenon || ''}
你的獨特立場：${flexibleInput.unique_stance || flexibleInput.stance || input.material || ''}
背後的價值觀：${flexibleInput.underlying_value || flexibleInput.reason || ''}

【觀點型的核心特徵 - 必須全部具備】：
✅ 有明確的立場（「我認為...」「我覺得...」）
✅ 有支撐立場的論點（2-3 個）
✅ 有觀察到的現象或問題
✅ 有邀請討論的結尾

【結構要求】：
1. 開頭直接說出你的立場（不要鐵墊）
2. 用 2-3 個論點支撐（每個論點可以用例子說明）
3. 結尾邀請討論：「你們怎麼看？」

【觀點型禁止】：
❌ 不能沒有明確立場（不能只是描述現象）
❌ 不能寫成故事（沒有具體事件，只有觀點）
❌ 不能太激進或攻擊性（要歡迎不同聲音）

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
          
          dialogue: `❗❗❗【對話型貼文 - 必須有真實對話】❗❗❗

對話角色：${flexibleInput.dialogue_roles || ''}
情境/衝突：${flexibleInput.situation_conflict || flexibleInput.question || ''}
金句/亮點：${flexibleInput.punchline || flexibleInput.context || ''}

【對話型的核心特徵 - 必須全部具備】：
✅ 有明確的對話者（朋友、學員、家人、陌生人）
✅ 有具體的問答內容（用引號標註對話）
✅ 有情境脈絡（什麼情況下的對話）
✅ 有你的回應或觀點

【結構要求】：
1. 開頭用對話引入：「最近有人問我...」「朋友問我...」「學員跟我說...」
2. 分享你的回答或反應
3. 延伸你的觀點或思考
4. 結尾問：「你們會怎麼回答？」

【對話型禁止】：
❌ 不能沒有對話引號（必須有「」標註的對話）
❌ 不能寫成純觀點輸出（必須有對話元素）
❌ 不能用「我媽突然問我」等虛構場景（除非是真實發生的）

風格：像在跟朋友分享一段有趣的對話`,
          
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
          
          story: `❗❗❗【故事型貼文 - 必須有明顮的故事線】❗❗❗

❗❗❗【極度重要 - 完整引用用戶提供的所有細節】❗❗❗
以下是用戶在問答階段提供的內容，必須完整保留，不能改寫或省略：
- 如果用戶說「三個月後」，就必須寫「三個月後」，不能改成「幾個月後」
- 如果用戶說「朋友過世」，就必須寫「朋友過世」，不能改成「失去朋友」
- 所有具體的人物、事件、時間、地點、情感詞彙都必須原樣保留

故事來源：${flexibleInput.story_source === 'self' ? '自己的故事' : '案例故事（個案/客戶）'}
具體事件/衝突點：${flexibleInput.event_conflict || input.material || ''}
轉折點：${flexibleInput.turning_point || ''}
情感變化：${flexibleInput.emotion_change || ''}
核心啟發：${flexibleInput.core_insight || ''}

【故事型的核心特徵 - 必須全部具備】：
✅ 有具體的時間、地點、人物（「昨天晚上」「在咖啡廳」「一個學員」）
✅ 有明顮的衝突或困境（讀者能感同身受）
✅ 有轉折點（「沒想到」「結果」「後來」）
✅ 有情感變化（從困惑到釋懷、從焦慮到平靜）
✅ 有故事結尾的啟發（「這件事讓我明白...」）

【結構要求（英雄旅程架構）】：
1. 開頭用具體時間和人物製造真實感：「昨天」「上週」「前幾天」
2. 描述衝突/困境：讓讀者產生共鳴
3. 帶入轉折點：「沒想到」「結果」「後來」
4. 展現情感變化：讓故事更有溫度
5. 結尾帶出核心啟發：「這件事讓我明白...」
6. 最後用開放式問題引導互動

【故事型禁止】：
❌ 不能寫成「觀點輸出」（沒有具體故事，只有道理）
❌ 不能寫成「知識教學」（沒有情感轉折，只有步驟）
❌ 不能用抽象的描述（要有具體的畫面感）

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
        
        // ✅ P1 優化：整合 50 個 IP 的成功因素（根據 creativeIntent 控制）
        let successFactorsContext = '';
        const creativeIntent = input.creativeIntent || 'full_professional';
        
        // 純個人故事和輕度連結模式不注入成功因素
        if (creativeIntent === 'full_professional') {
        try {
          const spiritualFactors = await getSpiritualSuccessFactors();
          const contentRecs = await getContentTypeRecommendations();
          const presentationRecs = await getPresentationRecommendations();
          
          if (spiritualFactors.topics.length > 0 || spiritualFactors.angles.length > 0) {
            successFactorsContext = `\n=== 數據驅動的成功因素（從 50 個頂級 IP 分析而來） ===\n`;
            
            // 主題因素
            if (spiritualFactors.topics.length > 0) {
              const topTopics = spiritualFactors.topics.slice(0, 3);
              successFactorsContext += `【高爆款率主題】\n`;
              topTopics.forEach(t => {
                successFactorsContext += `- ${t.factorName}（爆款率 ${(t.viralRate * 100).toFixed(1)}%）：${t.factorDescription}\n`;
              });
            }
            
            // 切角因素
            if (spiritualFactors.angles.length > 0) {
              const topAngles = spiritualFactors.angles.slice(0, 3);
              successFactorsContext += `【高爆款率切角】\n`;
              topAngles.forEach(a => {
                successFactorsContext += `- ${a.factorName}（爆款率 ${(a.viralRate * 100).toFixed(1)}%）：${a.factorDescription}\n`;
              });
            }
            
            // 呈現方式建議
            if (presentationRecs.length > 0) {
              const topPres = presentationRecs.slice(0, 2);
              successFactorsContext += `【高爆款率呈現方式】\n`;
              topPres.forEach(p => {
                successFactorsContext += `- ${p.name}（爆款率 ${(p.viralRate * 100).toFixed(1)}%）：${p.recommendation}\n`;
              });
            }
          }
        } catch (e) {
          console.log('[generateDraft] 無法取得成功因素:', e);
        }
        } // 結束 creativeIntent === 'full_professional' 的 if
        
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

        // 方案 A：在 System Prompt 最開頭加入強硬的字數限制
        const hardWordLimitPrompt = `
❗❗❗❗❗ 極度重要 - 字數限制（必須在生成前先讀）❗❗❗❗❗

【絕對不能超過】${wordLimit.max} 字
【最少需要】${wordLimit.min} 字
【當前類型】${contentTypeInfo?.name || input.contentType}

這是硬性限制，沒有例外。
超過 ${wordLimit.max} 字 = 任務失敗，必須重寫。
請在生成時隨時清點字數，確保不超過。

如果內容太多，請：
1. 刪除重複的觀點
2. 精簡每個段落
3. 只保留最核心的 2-3 個重點
4. 不要用清單式列舉太多點

❗❗❗❗❗ 字數限制結束 ❗❗❗❗❗
`;

        // ✅ v4.0 優化：使用精簡版提示詞系統
        const optimizedBasePrompt = buildOptimizedPrompt(input.contentType, ipContext, audienceContext);
        
        const systemPrompt = `${hardWordLimitPrompt}

${optimizedBasePrompt}

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
${semanticFewShotPrompt}
${topicLibraryContext}
${clusterContext}
${successFactorsContext}

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
2. 【省略主詞】可以省略「我」，例如：「超累」而不是「我超累」
3. 【不完整句】可以用不完整的句子，例如：「結果呢？」「就這樣。」
4. 【語助詞適度用】「超」「啊」「吧」「呢」「啦」（每篇最多 2-3 個，不要每句都用）
5. 【禁止刻意口語】不要用「真的！」開頭，不要每句都加「真的」「說真的」「老實說」
6. 【情緒詞謹慎用】「傻眼」「無言」（只在真正需要時使用，不是每篇都用）

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

=== 語調控制（極度重要） ===

### 避免過度感傷語調
- 不要寫得像「淡淡的哀傷」，要有力量感
- 避免過多「其實」「可是」「但是」「却」這類轉折詞
- 不要每段都在嘆息或感慕
- 語氣要有精神、有能量，不是總在回憶或感嘆
- 即使寫困境，也要帶出希望或行動

### 避免固定句式
- 每篇文章的開頭都要不一樣
- 不要每篇都用「你是不是也...」「你有沒有...」
- 不要每篇前幾句都用同樣的模式
- 開頭可以是：場景、對話、數據、結果、轉折點

=== 絕對禁止（違反 = 重寫） ===

### 禁止 AI 常用詞
- 「讓我們」「一起來」「今天要分享」「分享一下」
- 「親愛的朋友們」「各位」「大家好」
- 「在這個快節奏的時代」「在這個資訊爆炸的時代」
- 「總而言之」「總結來說」「最後」
- 「希望這篇文章對你有幫助」

### 禁止 AI 感詞彙（基於 Skill 數據分析補充）
- 「不是…而是」（最常見 AI 句式）
- 「記住！」「請記住」（說教感）
- 「一起撐」「一起加油」（雞湯感）
- 「溫柔地」「溫暖地」（過度修飾）
- 「其實」「說真的」（開頭用太弱）
- 「深深地」「靜靜地」（文學腔）
- 「就像…一樣」（過度比喻，每篇最多 1 次）
- 「真的很重要」「非常重要」（空洞強調）
- 「我想說的是」（冗贅）
- 「每個人都」（過度概括）

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

「禁止虛構場景」（極度重要）：
- 絕對禁止使用「我媽突然問我...」「我朋友突然問我...」等虛構對話
- 絕對禁止使用「昨天有個案主跟我說...」（除非素材中明確提到）
- 絕對禁止使用「有人問我...」（除非素材中明確提到）
- 如果素材中沒有提到對話，就不能憑空編造對話
- 如果要用對話開頭，必須是素材中實際提到的真實對話

「完整引用用戶回答」（極度重要 - 違反 = 重寫）：
- 用戶在問答階段提供的所有具體細節，必須完整保留，不能改寫或省略
- 如果用戶說「朋友過世，三個月後才崩潰」，就必須寫「三個月後」，不能改成「幾個月後」或「一段時間後」
- 如果用戶提到具體人物、事件、時間、地點，必須原樣使用
- 絕對禁止編造用戶沒有提到的情節或細節
- 絕對禁止改寫用戶的原始表達（例如把「崩潰」改成「難過」）
- 如果用戶的回答很簡短，可以擴展情感描寫，但核心事實必須保持一致
- 用戶提供的內容是文章的「靈魂」，AI 只是幫忙「包裝」，不能改變靈魂

### 禁止結尾方式
- 不能用「希望對你有幫助」結尾
- 不能用「讓我們一起...」結尾
- 不能用「加油！」「你可以的！」結尾（太雞湯）

### 排版格式規則
- 禁止：Markdown 標題符號（# ## ###）、粗體符號（**）、反引號
- 禁止：傳統數字條列（1. 2. 3.）或黑點條列（•）
- 允許：使用 Emoji 作為清單開頭（✨/👉/🔮），這在 Threads 很常見
- 限制：Emoji 條列僅限於「知識型」「整理型」貼文，故事型/閒聊型應保持自然段落

=== 互動機制設計（基於 Skill 數據分析） ===

根據內容類型自動選擇互動引擎：

1. 分享引擎（適合知識型/整理型）：
   - 可複製內容（清單、懶人包、整理型）
   - 標題用「N個」「完整」「整理」等詞強調價值
   - CTA：「先存起來」「分享給需要的人」

2. 留言引擎（適合提問型/觀點型）：
   - 開放問題（「你會怎麼選？」）
   - 爭議場景（「你覺得呢？」）
   - 具體 CTA（「留言告訴我你的想法」）

3. 讚數引擎（適合故事型/閒聊型）：
   - 簡短價值（一句話就能懂）
   - 共鳴觀察（「我也是」的感覺）
   - 不需要留言就能產生共鳴

=== 數據驗證的寫作規則（基於 29,475 篇分析） ===

1. 「有用」比「有趣」重要：有用內容分享率 59.4% vs 有趣內容 39.8%（+19.6%）
2. 條列整理型佔比 52.8%，是最強結構
3. 平均每篇貼文含 3.2 個 emoji，不要過多
4. 每行不超過 20 字，保持呼吸感
5. 每篇貼文平均 3.7 個 hashtag，不要超過 5 個
6. 前 3 行決定一切：必須在前 3 行內讓讀者決定要不要繼續看

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
          // 檢查是否是用戶選定的開頭（引導模式傳過來的 Hook）
          const isUserSelectedHook = input.angle.length > 10 && !input.angle.includes('型') && !input.angle.includes('角度');
          
          if (isUserSelectedHook) {
            // 用戶選定的開頭，強制保留
            userPrompt = `❗❗❗ 極度重要 - 用戶選定的開頭（必須完整保留）❗❗❗

用戶已經選定了以下開頭，你必須完整使用這個開頭作為貼文的第一句：

「${input.angle}」

【強制規則】
1. 第一句必須是上述開頭，一字不改
2. 第一句後必須空一行
3. 後續內容要與這個開頭自然連接
4. 不要生成其他 Hook 選項，直接用這個開頭

${userPrompt}`;
          } else {
            // 切角方向（例如：故事型、觀點型）
            userPrompt = `【切角方向】請從「${input.angle}」這個角度來寫這篇貼文。\n\n${userPrompt}`;
          }
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
        
        // ✅ 方案 A：在 User Prompt 結尾再次強調字數限制（更強硬的語氣）
        userPrompt += `\n\n❗❗❗❗❗ 最後提醒 - 字數限制 ❗❗❗❗❗

【絕對不能超過】${wordLimit.max} 字
【最少需要】${wordLimit.min} 字

請在輸出前清點字數：
- 如果超過 ${wordLimit.max} 字，請立即刪減內容
- 如果有 5 個以上的重點，請精簡到 2-3 個
- 每個重點只用 1-2 句話說明，不要展開

超過 ${wordLimit.max} 字 = 任務失敗，必須重寫。`;

        // ✅ 方案 A：品質優先 - 正文生成使用 Claude Sonnet 4
        const response = await invokeLLM({
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
          ],
          model: getModelForFeature('content'),  // Claude Sonnet 4
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
        
        // ✅ v4.0 優化：應用 AI 詞彙替換後處理
        const aiWordReplacement = replaceAIWords(generatedContent);
        generatedContent = aiWordReplacement.result;
        if (aiWordReplacement.replacements.length > 0) {
          console.log('[AI詞彙替換] 替換了', aiWordReplacement.replacements.length, '個詞彙:', 
            aiWordReplacement.replacements.slice(0, 5).map(r => `${r.original}→${r.replacement}`).join(', '));
        }
        
        // ✅ 方案 B 強化版：字數檢查和自動精簡（使用 Claude Sonnet 4 + 多次精簡）
        let actualWordCount = generatedContent.length;
        let wordCountWarning = '';
        let wasAutoCondensed = false;
        let condenseAttempts = 0;
        const maxCondenseAttempts = 2; // 最多精簡 2 次
        
        // 如果字數超過上限，自動調用 AI 精簡（降低觸發門檻到 5%）
        const overLimitThreshold = wordLimit.max * 1.05; // 超過 5% 就觸發自動精簡
        
        while (actualWordCount > overLimitThreshold && condenseAttempts < maxCondenseAttempts) {
          condenseAttempts++;
          try {
            console.log(`[字數控制] 第 ${condenseAttempts} 次精簡：內容超標（${actualWordCount} 字，上限 ${wordLimit.max} 字）`);
            
            // 計算需要刪除的字數
            const excessWords = actualWordCount - wordLimit.max;
            const targetWords = Math.floor(wordLimit.max * 0.95); // 目標是上限的 95%，留一點緩衝
            
            const condenseResponse = await invokeLLM({
              messages: [
                { 
                  role: "system", 
                  content: `你是一位專業的文案精簡師。你的任務是將內容精簡到指定字數內。

❗❗❗ 極度重要 ❗❗❗
目標字數：${targetWords} 字以內
絕對不能超過：${wordLimit.max} 字
需要刪除至少：${excessWords} 字

精簡策略（按優先順序執行）：
1. 【刪除清單項目】如果有 4 個以上的重點/清單，只保留最重要的 2-3 個
2. 【合併段落】將相似的觀點合併成一段
3. 【精簡每個重點】每個重點只用 1-2 句話，不要展開說明
4. 【刪除修飾詞】移除「其實」「真的」「老實說」等冗贅詞
5. 【縮短過渡句】減少段落間的過渡語

必須保留：
- 開頭的 Hook（前 2-3 句）
- 結尾的 CTA
- 「呼吸感」排版（段落之間要有空行）
- 原有的語氣和風格

絕對不能：
- 輸出任何說明文字
- 添加新的內容
- 改變核心訊息` 
                },
                { 
                  role: "user", 
                  content: `請將以下內容精簡到 ${targetWords} 字以內（目前 ${actualWordCount} 字，需要刪除至少 ${excessWords} 字）：

${generatedContent}

請直接輸出精簡後的文章，不要有任何前置說明。記住：絕對不能超過 ${wordLimit.max} 字！` 
                }
              ],
              model: getModelForFeature('content'),  // 使用 Claude Sonnet 4 進行精簡（精簡能力更強）
            });
            
            const condensedContent = typeof condenseResponse.choices[0]?.message?.content === 'string' 
              ? condenseResponse.choices[0].message.content 
              : '';
            
            // 檢查精簡後的字數
            const cleanedCondensed = cleanAIOutput(condensedContent);
            const condensedWordCount = cleanedCondensed.length;
            
            console.log(`[字數控制] 第 ${condenseAttempts} 次精簡結果：${condensedWordCount} 字`);
            
            // 只有當精簡後字數確實減少且在合理範圍內才採用
            if (condensedWordCount < actualWordCount && condensedWordCount >= wordLimit.min * 0.8) {
              generatedContent = cleanedCondensed;
              actualWordCount = condensedWordCount;
              wasAutoCondensed = true;
              
              if (actualWordCount <= wordLimit.max) {
                console.log(`[字數控制] 精簡成功！最終字數：${actualWordCount} 字`);
                break; // 字數已符合，停止精簡
              }
            } else {
              console.log(`[字數控制] 精簡結果不理想，嘗試下一次...`);
            }
            
            await db.logApiUsage(ctx.user.id, 'autoCondense', 'llm', 400, 500);
          } catch (condenseError) {
            console.error(`[字數控制] 第 ${condenseAttempts} 次精簡失敗:`, condenseError);
            break; // 精簡失敗，停止嘗試
          }
        }
        
        // 更新字數警告
        if (actualWordCount > wordLimit.max) {
          const overPercent = Math.round((actualWordCount - wordLimit.max) / wordLimit.max * 100);
          wordCountWarning = wasAutoCondensed 
            ? `⚠️ 已自動精簡 ${condenseAttempts} 次，但仍超過上限 ${overPercent}%（${actualWordCount} 字，應為 ${wordLimit.min}-${wordLimit.max} 字），建議手動精簡`
            : `⚠️ 字數超過上限 ${overPercent}%（${actualWordCount} 字，應為 ${wordLimit.min}-${wordLimit.max} 字），建議精簡內容`;
        } else if (actualWordCount < wordLimit.min) {
          wordCountWarning = `⚠️ 字數不足（${actualWordCount} 字，應為 ${wordLimit.min}-${wordLimit.max} 字），建議補充內容`;
        } else if (wasAutoCondensed) {
          wordCountWarning = `✅ 已自動精簡至 ${actualWordCount} 字（符合 ${wordLimit.min}-${wordLimit.max} 字範圍）`;
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
        
        // ✅ 風格匹配度計算
        const styleMatchResult = calculateStyleMatch(
          generatedContent,
          userStyle ? {
            toneStyle: userStyle.toneStyle,
            commonPhrases: userStyle.commonPhrases as string[] | null,
            catchphrases: userStyle.catchphrases as string[] | null,
            hookStylePreference: userStyle.hookStylePreference,
            metaphorStyle: userStyle.metaphorStyle,
            emotionRhythm: userStyle.emotionRhythm,
          } : null,
          profile ? {
            profession: profile.occupation,
            pillars: {
              authority: profile.personaExpertise || undefined,
              resonance: profile.personaEmotion || undefined,
              uniqueness: profile.personaViewpoint || undefined,
            },
            targetAudience: profile.contentMatrixAudiences ? (profile.contentMatrixAudiences as any).core : null,
            beliefs: profile.viewpointStatement,
          } : null
        );
        
        // ✅ Embedding 同質性檢測（非阻塞）
        let homogeneityCheck: {
          isHomogeneous: boolean;
          maxSimilarity: number;
          suggestion?: string;
        } | null = null;
        
        try {
          // 提取開頭（前 100 字）
          const opener = generatedContent.substring(0, 100);
          
          // 檢測同質性
          homogeneityCheck = await checkOpenerHomogeneityV2(
            ctx.user.id.toString(),
            opener
          );
          
          // 儲存新開頭的 Embedding（用於未來檢測）
          await saveOpenerEmbedding(
            ctx.user.id.toString(),
            opener,
            draft?.id
          );
          
          console.log('[Embedding] 同質性檢測完成:', {
            isHomogeneous: homogeneityCheck.isHomogeneous,
            maxSimilarity: homogeneityCheck.maxSimilarity,
          });
        } catch (embeddingError) {
          // Embedding 檢測失敗不影響主流程
          console.warn('[Embedding] 同質性檢測失敗:', embeddingError);
        }
        
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
          // 風格匹配度
          styleMatch: styleMatchResult,
          // 同質性檢測結果
          homogeneity: homogeneityCheck,
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

        // ✅ 方案 A：品質優先 - AI 對話修改使用 Claude Sonnet 4
        const response = await invokeLLM({ 
          messages,
          model: getModelForFeature('ai_chat'),  // Claude Sonnet 4
        });
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
    
    // ==================== 模板管理 API ====================
    
    // 取得所有開頭模板
    getOpenerTemplates: adminProcedure.query(async () => {
      return db.getAllOpenerTemplates();
    }),
    
    // 新增開頭模板
    createOpenerTemplate: adminProcedure
      .input(z.object({
        name: z.string(),
        category: z.string(),
        description: z.string().optional(),
        promptTemplate: z.string(),
        exampleOutput: z.string().optional(),
        weight: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        return db.createOpenerTemplate(input);
      }),
    
    // 更新開頭模板
    updateOpenerTemplate: adminProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().optional(),
        category: z.string().optional(),
        description: z.string().optional(),
        promptTemplate: z.string().optional(),
        exampleOutput: z.string().optional(),
        weight: z.number().optional(),
        isActive: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        return db.updateOpenerTemplate(id, data);
      }),
    
    // 切換模板啟用狀態
    toggleOpenerTemplate: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        return db.toggleOpenerTemplateActive(input.id);
      }),
    
    // 取得所有禁止句式
    getAvoidList: adminProcedure.query(async () => {
      return db.getAllAvoidList();
    }),
    
    // 新增禁止句式
    createAvoidPhrase: adminProcedure
      .input(z.object({
        phrase: z.string(),
        category: z.string(),
        reason: z.string().optional(),
        severity: z.enum(['low', 'medium', 'high']).optional(),
      }))
      .mutation(async ({ input }) => {
        return db.createAvoidPhrase(input);
      }),
    
    // 更新禁止句式
    updateAvoidPhrase: adminProcedure
      .input(z.object({
        id: z.number(),
        phrase: z.string().optional(),
        category: z.string().optional(),
        reason: z.string().optional(),
        severity: z.enum(['low', 'medium', 'high']).optional(),
        isActive: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        return db.updateAvoidPhrase(id, data);
      }),
    
    // 切換禁止句式啟用狀態
    toggleAvoidPhrase: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        return db.toggleAvoidPhraseActive(input.id);
      }),
    
    // 刪除禁止句式
    deleteAvoidPhrase: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        return db.deleteAvoidPhrase(input.id);
      }),
    
    // 取得模板統計數據
    getTemplateStats: adminProcedure.query(async () => {
      return db.getTemplateStats();
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
        targetAudienceId: z.number().optional(), // 目標受眾 ID
        userContext: z.string().optional(),
        count: z.number().min(3).max(5).default(5),
      }))
      .mutation(async ({ ctx, input }) => {
        const { topic, contentType, hookStyle, targetAudience, targetAudienceId, userContext, count } = input;
        
        // 如果有指定 targetAudienceId，查詢受眾資料並加入 context
        let enhancedUserContext = userContext || '';
        if (targetAudienceId) {
          const audiences = await db.getAudienceSegmentsByUserId(ctx.user.id);
          const targetAudienceData = audiences?.find(a => a.id === targetAudienceId);
          if (targetAudienceData) {
            enhancedUserContext = `【目標受眾】${targetAudienceData.segmentName}
痛點：${targetAudienceData.painPoint || '未設定'}
渴望：${targetAudienceData.desiredOutcome || '未設定'}

重要：開頭必須讓這個受眾覺得「這就是在說我」

${enhancedUserContext}`.trim();
          }
        }
        
        try {
          const result = await generateMultipleOpeners({
            userId: ctx.user.id,
            topic,
            contentType,
            hookStyle,
            targetAudience,
            userContext: enhancedUserContext, // 使用強化後的 context
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

  // 學習式 Selector API
  selector: router({
    // 獲取用戶模板偏好
    getPreferences: protectedProcedure.query(async ({ ctx }) => {
      const preferences = await db.getUserTemplatePreferences(ctx.user.id);
      return preferences.map(p => ({
        templateCategory: p.templateCategory,
        preferenceScore: parseFloat(p.preferenceScore || '0.5'),
        totalShown: p.totalShown || 0,
        totalSelected: p.totalSelected || 0,
        totalPublished: p.totalPublished || 0,
        totalViral: p.totalViral || 0,
      }));
    }),

    // 獲取學習進度摘要
    getLearningProgress: protectedProcedure.query(async ({ ctx }) => {
      const preferences = await db.getUserTemplatePreferences(ctx.user.id);
      
      // 去重：如果有重複的 templateCategory，只保留第一筆
      const uniquePreferences = preferences.reduce((acc, p) => {
        if (!acc.find(existing => existing.templateCategory === p.templateCategory)) {
          acc.push(p);
        }
        return acc;
      }, [] as typeof preferences);
      
      const totalSelections = uniquePreferences.reduce((sum, p) => sum + (p.totalSelected || 0), 0);
      
      // 排序獲取前 3 個偏好
      const topPreferences = [...uniquePreferences]
        .sort((a, b) => parseFloat(b.preferenceScore || '0.5') - parseFloat(a.preferenceScore || '0.5'))
        .slice(0, 3)
        .map(p => ({
          category: p.templateCategory,
          score: parseFloat(p.preferenceScore || '0.5'),
          label: {
            mirror: '鏡像心理',
            scene: '情境化帶入',
            dialogue: '對話型',
            contrast: '反差型',
            casual: '閒聊型',
            question: '提問型',
            story: '故事型',
            quote: '引用型',
            data: '數據型',
            emotion: '情緒爆發型',
          }[p.templateCategory] || p.templateCategory,
        }));
      
      // 計算學習進度（10 次選擇 = 50%，30 次選擇 = 90%，50+ 次 = 100%）
      const learningProgress = Math.min(100, Math.round((totalSelections / 50) * 100));
      
      return {
        totalSelections,
        topPreferences,
        learningProgress,
        hasEnoughData: totalSelections >= 5,
      };
    }),

    // 記錄用戶選擇（當用戶選擇某個開頭時調用）
    recordSelection: protectedProcedure
      .input(z.object({
        templateCategory: z.string(),
        wasSelected: z.boolean(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { templateCategory, wasSelected } = input;
        
        // 獲取當前偏好
        const preferences = await db.getUserTemplatePreferences(ctx.user.id);
        const currentPref = preferences.find(p => p.templateCategory === templateCategory);
        const currentScore = parseFloat(currentPref?.preferenceScore || '0.5');
        
        // 計算新的偏好分數（使用 EMA）
        const alpha = 0.2; // 學習率
        const targetScore = wasSelected ? 1 : 0;
        const newScore = currentScore + alpha * (targetScore - currentScore);
        const clampedScore = Math.max(0.1, Math.min(0.9, newScore));
        
        // 更新偏好
        if (wasSelected) {
          await db.incrementTemplatePreferenceStats(ctx.user.id, templateCategory, 'totalSelected');
        }
        await db.incrementTemplatePreferenceStats(ctx.user.id, templateCategory, 'totalShown');
        
        // 更新偏好分數
        await db.upsertUserTemplatePreference(ctx.user.id, templateCategory, {
          preferenceScore: clampedScore.toFixed(4),
        });
        
        return { success: true, newScore: clampedScore };
      }),
  }),

  // ==================== P2 優化：帳號健康度和內容組合分析 ====================
  accountHealth: router({
    // 取得帳號健康度診斷
    getDiagnosis: protectedProcedure.query(async ({ ctx }) => {
      const diagnosis = await db.getAccountHealthDiagnosis(ctx.user.id);
      return diagnosis;
    }),

    // 取得內容組合分析
    getContentMix: protectedProcedure.query(async ({ ctx }) => {
      const analysis = await db.getContentMixAnalysis(ctx.user.id);
      return analysis;
    }),

    // 識別用戶領域
    getUserDomain: protectedProcedure.query(async ({ ctx }) => {
      const domain = await db.identifyUserDomain(ctx.user.id);
      return domain;
    }),

    // 取得個人化選題推薦
    getTopicSuggestions: protectedProcedure
      .input(z.object({
        count: z.number().min(1).max(10).default(5),
        goal: z.enum(['awareness', 'trust', 'engagement', 'sales']).optional(),
      }).optional())
      .query(async ({ ctx, input }) => {
        const suggestions = await db.getPersonalizedTopicSuggestions(
          ctx.user.id, 
          input?.count || 5
        );
        
        // 如果有指定目標，過濾推薦
        if (input?.goal) {
          suggestions.topics = suggestions.topics.filter(t => t.targetGoal === input.goal);
        }
        
        return suggestions;
      }),

    // ✅ 類型智能推薦：根據主題推薦最適合的內容類型
    getContentTypeRecommendation: protectedProcedure
      .input(z.object({
        topic: z.string(),
      }))
      .query(async ({ input }) => {
        const recommendation = await getContentTypeRecommendation(input.topic, 20);
        return recommendation;
      }),

    // 取得特定類型的相似爆款範例
    getSimilarViralsByType: protectedProcedure
      .input(z.object({
        topic: z.string(),
        contentType: z.string(),
        limit: z.number().min(1).max(10).default(3),
      }))
      .query(async ({ input }) => {
        const examples = await getSimilarViralsByType(input.topic, input.contentType, input.limit);
        return { examples };
      }),

    // ✅ 今日高潛力推薦：根據用戶領域和近期爆款推薦選題
    getHighPotentialTopics: protectedProcedure
      .input(z.object({
        count: z.number().min(1).max(10).default(5),
      }).optional())
      .query(async ({ ctx, input }) => {
        // 先取得用戶領域
        const domain = await db.identifyUserDomain(ctx.user.id);
        
        // 取得用戶已發過的主題（避免重複推薦）
        const existingDrafts = await db.getDraftsByUserId(ctx.user.id);
        const existingTopics = existingDrafts
          .slice(0, 50)
          .map(d => d.title || '')
          .filter(t => t.length > 0);
        
        // 取得高潛力選題
        const topics = await getHighPotentialTopics(
          domain.primaryDomain,
          existingTopics,
          input?.count || 5
        );
        
        return {
          domain: domain.primaryDomain,
          topics,
        };
      }),

    // 取得完整的 Dashboard 數據（整合多個 API）
    getDashboardData: protectedProcedure.query(async ({ ctx }) => {
      const [diagnosis, contentMix, domain, suggestions] = await Promise.all([
        db.getAccountHealthDiagnosis(ctx.user.id),
        db.getContentMixAnalysis(ctx.user.id),
        db.identifyUserDomain(ctx.user.id),
        db.getPersonalizedTopicSuggestions(ctx.user.id, 3),
      ]);
      
      return {
        healthScore: diagnosis.overallScore,
        contentHealth: diagnosis.contentHealth,
        interactionHealth: diagnosis.interactionHealth,
        growthHealth: diagnosis.growthHealth,
        personaConsistency: diagnosis.personaConsistency,
        contentMix: {
          last7Days: contentMix.last7Days,
          categoryDistribution: contentMix.categoryDistribution,
          recommendation: contentMix.recommendation,
        },
        domain: {
          primary: domain.primaryDomain,
          confidence: domain.confidence,
        },
        todaySuggestions: suggestions.topics,
      };
    }),
  }),

  // ==================== 靈感工作室（v4.0 新增） ====================
  inspiration: router({
    // 生成選題推薦（結合痛點矩陣 + IP 資料 + 爆款資料庫）
    generateTopics: protectedProcedure
      .input(z.object({
        count: z.number().min(1).max(10).default(5),
        userIdea: z.string().optional(), // 用戶的想法，讓 AI 延伸成具體選題
      }).optional())
      .mutation(async ({ ctx, input }) => {
        const count = input?.count || 5;
        const userIdea = input?.userIdea || '';
        
        // 取得用戶 IP 資料
        const profile = await db.getIpProfileByUserId(ctx.user.id);
        const audiences = await db.getAudienceSegmentsByUserId(ctx.user.id);
        const domain = await db.identifyUserDomain(ctx.user.id);
        
        // 取得已使用的選題（避免重複）
        const usedTopics = await db.getUsedTopicTexts(ctx.user.id, 30);
        
        // 建構 IP 資料字串
        let ipContext = '';
        if (profile?.occupation) ipContext += `職業：${profile.occupation}\n`;
        if (profile?.personaExpertise) ipContext += `專業：${profile.personaExpertise}\n`;
        if (profile?.personaEmotion) ipContext += `情感共鳴：${profile.personaEmotion}\n`;
        if (profile?.personaViewpoint) ipContext += `獨特觀點：${profile.personaViewpoint}\n`;
        
        // 建構受眾資料字串
        let audienceContext = '';
        if (audiences && audiences.length > 0) {
          audienceContext = audiences.map(a => {
            let line = `- ${a.segmentName}`;
            if (a.painPoint) line += `（痛點：${a.painPoint.substring(0, 50)}）`;
            return line;
          }).join('\n');
        }
        
        // 取得爆款資料庫參考
        const viralExamples = await db.getTieredViralExamples({
          keyword: domain.primaryDomain,
          tier: 'S',
          limit: 10,
        });
        
        let viralContext = '';
        if (viralExamples.length > 0) {
          viralContext = viralExamples.slice(0, 5).map(e => {
            const opener = e.opener50 || e.postText.substring(0, 50);
            return `- ${opener}...`;
          }).join('\n');
        }
        
        // 建構已使用選題字串（避免重複）
        const usedTopicsContext = usedTopics.length > 0 
          ? `\n【禁止重複的選題（已生成過）】\n${usedTopics.slice(0, 20).map(t => `- ${t}`).join('\n')}`
          : '';
        
        // 如果用戶有想法，加入提示
        const hasUserIdea = userIdea && userIdea.trim().length > 0;
        const userIdeaContext = hasUserIdea 
          ? `\n【⭐ 用戶的想法（最重要！必須基於這個想法延伸）】\n${userIdea}\n\n重要指示：用戶已經提供了具體的想法，請將所有 ${count} 個選題都基於這個想法延伸，而不是生成無關的選題。\n`
          : '';
        
        // 加入隨機性和時間戳以確保每次生成不同的選題
        const randomSeed = Math.random().toString(36).substring(7);
        const timestamp = new Date().toISOString();
        
        // 根據是否有用戶想法，使用不同的提示詞策略
        let prompt: string;
        
        if (hasUserIdea) {
          // 用戶有想法：專注於延伸用戶的想法
          prompt = `你是一位 Threads 選題專家，幫創作者將模糊的想法延伸成具體的選題。

⭐⭐⭐ 最重要的任務 ⭐⭐⭐
用戶已經提供了他的想法：
「${userIdea}」

請將這個想法延伸成 ${count} 個不同角度的具體選題。

【延伸方向】
1. 情感角度：從這個想法中的情緒、感受出發
2. 故事角度：將這個想法變成一個具體的場景或對話
3. 觀察角度：從這個想法延伸出更廣的社會觀察
4. 反思角度：從這個想法中提取一個値得思考的問題
5. 共鳴角度：從這個想法中找到大家都有過的經驗

【重要限制】
- 所有選題都必須與用戶的想法相關
- 不要生成與用戶想法無關的內容
- 不要硬套商業模式或專業內容
- 專注於用戶想表達的核心情感或觀察

【參考資料（可選用，但不要讓它蓋過用戶的想法）】
創作者資料：${ipContext || '未設定'}
目標受眾：${audienceContext || '未設定'}
${usedTopicsContext}

【隨機種子：${randomSeed}】
【生成時間：${timestamp}】

請用 JSON 格式回應：
{
  "topics": [
    { "text": "選題內容（15-40 字）", "source": "user_idea", "reason": "延伸方向說明" }
  ]
}`;
        } else {
          // 用戶沒有想法：使用原本的提示詞
          prompt = `${TOPIC_GENERATION_PROMPT}

【創作者資料（參考用，不是每篇都要直接提及）】
${ipContext || '未設定'}

【目標受眾（參考用）】
${audienceContext || '未設定'}

【爆款參考（學習這些選題的特徵）】
${viralContext || '無'}
${usedTopicsContext}

【重要：選題類型平衡】
一個真實的個人品牌不會每一篇都與商業模式或受眾完全相關，有時也需要一些「泛流量」相關的主題。

請生成 ${count} 個選題，必須包含以下類型：

【選題類型分配】
1. 泛流量（約 2 個）：生活觀察、社會現象、情感共鳴、日常小事，不需與專業相關
2. IP 相關（約 2 個）：與創作者專業領域相關，但不要每次都是「系統化」、「金句」、「運勢」這類重複主題
3. 爆款參考（約 1 個）：參考爆款資料庫的選題模式

【泛流量選題範例（跟專業無關，但能引起共鳴）】
- 「在全家買茶葉蛋時，店員說了一句話讓我愄住」
- 「今天在捷運上看到一對母女，女兒突然說...」
- 「昨天和朋友吃飯，他突然問我一個問題」
- 「看到那個新聞，我突然想到...」
- 「在咖啡廳聽到隨壁桌在討論...」
- 「今天收到一封很奇怪的訊息」
- 「我發現很多人嘴上說要 X，但實際上危在做 Y」

【避免重複的主題模式】
- 不要每次都生成「系統化」、「模組化」、「SOP」相關的選題
- 不要每次都生成「金句」、「運勢」、「命盤」相關的選題
- 不要每次都生成「學員問我」、「案主跟我說」這種模式
- 要有變化，每次生成都要跟上次不同

【每個選題都要】
1. 是「具體情境」（15-40 字）
2. 讓人想知道「然後呢？」
3. 不要與已生成過的選題重複${userIdea ? '\n4. 延伸用戶的想法，讓它更具體、更有吸引力' : ''}

【隨機種子：${randomSeed}】
【生成時間：${timestamp}】

請用 JSON 格式回應：
{
  "topics": [
    { "text": "選題內容", "source": "pain_matrix" | "ip_data" | "viral_db" | "general_traffic", "reason": "推薦原因" }
  ]
}`;
        }
        
        try {
          const response = await invokeLLM({
            messages: [
              { role: 'system', content: '你是一位 Threads 選題專家，幫創作者找到好的選題。' },
              { role: 'user', content: prompt },
            ],
            response_format: {
              type: 'json_schema',
              json_schema: {
                name: 'topic_suggestions',
                strict: true,
                schema: {
                  type: 'object',
                  properties: {
                    topics: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          text: { type: 'string', description: '選題內容（15-40 字）' },
                          source: { type: 'string', enum: ['pain_matrix', 'ip_data', 'viral_db', 'general_traffic', 'user_idea'] },
                          reason: { type: 'string', description: '推薦原因' },
                        },
                        required: ['text', 'source', 'reason'],
                        additionalProperties: false,
                      },
                    },
                  },
                  required: ['topics'],
                  additionalProperties: false,
                },
              },
            },
          });
          
          const content = response.choices[0]?.message?.content;
          const parsed = JSON.parse(typeof content === 'string' ? content : '{}');
          
          // 記錄生成的選題
          if (parsed.topics && parsed.topics.length > 0) {
            const topicsToRecord = parsed.topics.map((t: any) => ({
              topicText: t.text,
              topicSource: t.source as 'pain_matrix' | 'ip_data' | 'viral_db' | 'brainstorm' | 'general_traffic',
            }));
            const recordedIds = await db.recordGeneratedTopics(ctx.user.id, topicsToRecord);
            
            // 將 ID 加入回傳結果
            parsed.topics = parsed.topics.map((t: any, i: number) => ({
              ...t,
              id: recordedIds[i],
            }));
          }
          
          await db.logApiUsage(ctx.user.id, 'generateInspirationTopics', 'llm', 300, 400);
          
          return {
            topics: parsed.topics || [],
            domain: domain.primaryDomain,
          };
        } catch (error) {
          console.error('[Inspiration] 選題生成失敗:', error);
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: '選題生成失敗，請稍後再試',
          });
        }
      }),
    
    // 選擇選題（更新狀態）
    selectTopic: protectedProcedure
      .input(z.object({
        topicId: z.number(),
      }))
      .mutation(async ({ input }) => {
        await db.updateTopicStatus(input.topicId, 'selected');
        return { success: true };
      }),
    
    // 取得選題歷史
    getHistory: protectedProcedure
      .input(z.object({
        limit: z.number().min(1).max(100).default(20),
        status: z.enum(['generated', 'selected', 'used', 'skipped']).optional(),
      }).optional())
      .query(async ({ ctx, input }) => {
        const history = await db.getUserTopicHistory(ctx.user.id, {
          limit: input?.limit || 20,
          status: input?.status,
        });
        return history;
      }),
  }),

  // ==================== 發文工作室問答流程（v4.0 新增） ====================
  writingSession: router({
    // 開始問答會話
    start: protectedProcedure
      .input(z.object({
        userIdea: z.string().optional(),
        topicHistoryId: z.number().optional(),
        contentType: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        // 根據內容類型取得引導問題
        const contentType = input.contentType || 'story';
        const questions = GUIDED_QUESTIONS[contentType] || GUIDED_QUESTIONS.story;
        
        // 創建會話
        const sessionId = await db.createWritingSession(ctx.user.id, {
          userIdea: input.userIdea,
          topicHistoryId: input.topicHistoryId,
          selectedContentType: contentType,
          questions: questions.map(q => ({ question: q, answer: null, skipped: false })),
        });
        
        // 如果有選題 ID，更新選題狀態
        if (input.topicHistoryId) {
          await db.updateTopicStatus(input.topicHistoryId, 'selected');
        }
        
        return {
          sessionId,
          questions: questions.map((q, i) => ({
            index: i,
            question: q,
            answer: null,
            skipped: false,
          })),
          contentType,
        };
      }),
    
    // 更新問答答案
    updateAnswer: protectedProcedure
      .input(z.object({
        sessionId: z.number(),
        questionIndex: z.number(),
        answer: z.string().optional(),
        skipped: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        const session = await db.getWritingSession(input.sessionId);
        if (!session) {
          throw new TRPCError({ code: 'NOT_FOUND', message: '會話不存在' });
        }
        
        const questions = session.questions as Array<{ question: string; answer: string | null; skipped: boolean }>;
        if (input.questionIndex >= 0 && input.questionIndex < questions.length) {
          questions[input.questionIndex].answer = input.answer || null;
          questions[input.questionIndex].skipped = input.skipped || false;
        }
        
        await db.updateWritingSession(input.sessionId, { questions });
        
        return { success: true };
      }),
    
    // 完成問答並生成內容
    complete: protectedProcedure
      .input(z.object({
        sessionId: z.number(),
      }))
      .mutation(async ({ ctx, input }) => {
        const session = await db.getWritingSession(input.sessionId);
        if (!session) {
          throw new TRPCError({ code: 'NOT_FOUND', message: '會話不存在' });
        }
        
        // 組合問答答案成為素材
        const questions = session.questions as Array<{ question: string; answer: string | null; skipped: boolean }>;
        const answeredQuestions = questions.filter(q => q.answer && !q.skipped);
        
        let material = session.userIdea || '';
        if (answeredQuestions.length > 0) {
          material += '\n\n問答補充：\n';
          material += answeredQuestions.map(q => `${q.question}\n${q.answer}`).join('\n\n');
        }
        
        // 更新會話狀態
        await db.updateWritingSession(input.sessionId, { status: 'completed' });
        
        // 如果有選題 ID，更新選題狀態為已使用
        if (session.topicHistoryId) {
          await db.updateTopicStatus(session.topicHistoryId, 'used');
        }
        
        return {
          material,
          contentType: session.selectedContentType || 'story',
          sessionId: input.sessionId,
        };
      }),
    
    // 取得會話詳情
    get: protectedProcedure
      .input(z.object({ sessionId: z.number() }))
      .query(async ({ input }) => {
        const session = await db.getWritingSession(input.sessionId);
        return session;
      }),
    
    // 取得引導問題（根據內容類型）
    getQuestions: protectedProcedure
      .input(z.object({ contentType: z.string() }))
      .query(async ({ input }) => {
        const questions = GUIDED_QUESTIONS[input.contentType] || GUIDED_QUESTIONS.story;
        return { questions };
      }),
    
    // AI 動態生成下一個問題（互動式問答）
    generateNextQuestion: protectedProcedure
      .input(z.object({
        topic: z.string(),
        contentType: z.string(),
        previousQA: z.array(z.object({
          question: z.string(),
          answer: z.string(),
        })).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { topic, contentType, previousQA = [] } = input;
        
        // 如果已經問了 3 個問題，建議結束
        if (previousQA.length >= 3) {
          return {
            question: null,
            suggestComplete: true,
            message: '資訊已經足夠了，可以開始生成文案了！',
          };
        }
        
        // 建構對話歷史
        const qaHistory = previousQA.map(qa => `問：${qa.question}\n答：${qa.answer}`).join('\n\n');
        
        // 根據貼文類型建構提示
        const typeContext = {
          story: '故事型貼文需要了解：事件經過、主角、情緒轉折、啟發',
          knowledge: '知識型貼文需要了解：要解決的問題、重點概念、實際案例',
          viewpoint: '觀點型貼文需要了解：核心立場、支持論據、反駁的聲音',
          casual: '閒聊型貼文需要了解：今天發生什麼、你的感受、想分享的心情',
          contrast: '反差型貼文需要了解：大家的誤解、你的觀點、轉折點',
          dialogue: '對話型貼文需要了解：誰問的、問什麼、你怎麼回答',
          diagnosis: '診斷型貼文需要了解：要診斷的症狀、背後原因、解決方案',
          summary: '整理型貼文需要了解：要整理的主題、重點有哪些、實用性',
          quote: '金句型貼文需要了解：要引用的句子、為什麼印象深刻、你的解讀',
          question: '問答型貼文需要了解：要問讀者什麼、為什麼想問、期待的回應',
          poll: '投票型貼文需要了解：讓讀者選什麼、選項有哪些、為什麼想投票',
        };
        
        const prompt = `你是一個温暖的寫作教練，正在幫助用戶收集寫文素材。

用戶的選題：${topic}
貼文類型：${contentType}
${typeContext[contentType as keyof typeof typeContext] || typeContext.story}

${qaHistory ? `已經問過的問題：\n${qaHistory}\n\n` : ''}請根據以上資訊，生成下一個問題。

要求：
1. 問題要口語化，像朋友聊天一樣
2. 問題要具體，讓用戶容易回答
3. 問題要有助於寫出更好的文案
4. 不要重複已經問過的內容
5. 只輸出一個問題，不要其他內容`;
        
        try {
          const response = await invokeLLM({
            messages: [
              { role: 'system', content: '你是一個温暖的寫作教練，請用口語化的方式提問。' },
              { role: 'user', content: prompt },
            ],
          });
          
          const content = response.choices[0]?.message?.content;
          const question = typeof content === 'string' ? content.trim() : null;
          
          return {
            question,
            suggestComplete: false,
            questionNumber: previousQA.length + 1,
          };
        } catch (error) {
          console.error('generateNextQuestion error:', error);
          // 如果 AI 失敗，回傳預設問題
          const fallbackQuestions = GUIDED_QUESTIONS[contentType] || GUIDED_QUESTIONS.story;
          const nextIndex = previousQA.length;
          const question = fallbackQuestions[nextIndex] || null;
          
          return {
            question,
            suggestComplete: !question,
            questionNumber: previousQA.length + 1,
          };
        }
      }),
    
    // AI 一次性生成所有問題（批量問答）
    generateBatchQuestions: protectedProcedure
      .input(z.object({
        topic: z.string(),
        contentType: z.string(),
        creativeIntent: z.enum(['pure_personal', 'light_connection', 'full_professional']).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { topic, contentType, creativeIntent = 'light_connection' } = input;
        
        // 根據貼文類型建構提示
        const typeContext: Record<string, string> = {
          story: '故事型貼文需要了解：事件經過、主角、情緒轉折、啟發',
          knowledge: '知識型貼文需要了解：要解決的問題、重點概念、實際案例',
          viewpoint: '觀點型貼文需要了解：核心立場、支持論據、反駁的聲音',
          casual: '閒聊型貼文需要了解：今天發生什麼、你的感受、想分享的心情',
          contrast: '反差型貼文需要了解：大家的誤解、你的觀點、轉折點',
          dialogue: '對話型貼文需要了解：誰問的、問什麼、你怎麼回答',
          diagnosis: '診斷型貼文需要了解：要診斷的症狀、背後原因、解決方案',
          summary: '整理型貼文需要了解：要整理的主題、重點有哪些、實用性',
          quote: '金句型貼文需要了解：要引用的句子、為什麼印象深刻、你的解讀',
          question: '問答型貼文需要了解：要問讀者什麼、為什麼想問、期待的回應',
          poll: '投票型貼文需要了解：讓讀者選什麼、選項有哪些、為什麼想投票',
        };
        
        // 根據創作意圖調整問題方向
        const intentContext: Record<string, string> = {
          pure_personal: `
【創作意圖：純粹分享】
用戶選擇了「純粹分享」模式，這篇文章不需要連結到專業或工作。
問題應該聚焦在：
- 純粹的個人經歷和感受
- 生活中的小事、觀察、情緒
- 不要問任何與工作、專業、商業相關的問題`,
          light_connection: `
【創作意圖：輕度連結】
用戶選擇了「輕度連結」模式，文章主體是個人經歷，但可以在結尾自然帶到專業。
問題應該：
- 主要聚焦在個人經歷和感受
- 最後一個問題可以問「這個經歷跟你的專業有什麼關聯？」（標註為 optional）`,
          full_professional: `
【創作意圖：完整專業導入】
用戶選擇了「完整專業導入」模式，這篇文章要展現專業形象。
問題應該：
- 聚焦在專業知識、案例、解決方案
- 可以問學員/客戶的成功案例
- 可以問如何連結到產品/服務`,
        };
        
        const prompt = `你是一個專業的寫作教練，正在幫助用戶收集寫文素材。

用戶的選題：${topic}
貼文類型：${contentType}
${typeContext[contentType] || typeContext.story}
${intentContext[creativeIntent] || intentContext.light_connection}

【重要：專業教練風格】
你要像一個專業的寫作教練，主動告知用戶需要回答哪些問題，並點出幾個重點細節。

教練開場白要求：
1. 先肯定用戶的選題方向
2. 簡康說明這種貼文的核心要素
3. 告訴用戶「我需要你提供以下 X 個資訊」
4. 語氣專業但不生硬，像教練在指導學員

範例開場白：
「這個選題很有潛力！故事型貼文的核心是『讓讀者感受到情緒轉折』。我需要你提供 4 個資訊，讓我能幫你寫出一篇有共鳴的文章：」

請生成 3-4 個問題，幫助用戶整理寫文素材。

要求：
1. 問題要口語化，像教練在指導學員
2. 問題要具體，讓用戶容易回答
3. 每個問題都要有「提示」說明為什麼問這個（這個資訊對文章有什麼幫助）
4. 每個問題都要有「範例」讓用戶參考
5. 標註每個問題的重要性（required/recommended/optional）
6. 第一個問題一定是 required，其他根據重要性標註

【極度重要 - 範例答案規則】
❗❗❗ 範例答案必須是「通用格式範例」，絕對禁止捏造具體情節！

範例答案的正確寫法：
- ✅ 正確：「上週五晚上、去年過年的時候」（通用時間格式）
- ✅ 正確：「我的一個學員、我媽、我自己」（通用人物格式）
- ✅ 正確：「她突然問我一個問題...」（通用事件格式）
- ❌ 錯誤：「我在路邊看到一朵小花，突然大哭」（捏造具體情節）
- ❌ 錯誤：「三個月後我在咖啡廳崩潰」（捏造具體場景）
- ❌ 錯誤：「朋友過世後我編了一朵花」（捏造具體細節）

範例答案的目的是讓用戶知道「要回答什麼類型的內容」，而不是提供具體的故事情節。

輸出 JSON 格式，不要其他內容。`;
        
        try {
          const response = await invokeLLM({
            messages: [
              { role: 'system', content: '你是一個專業的寫作教練，像教練在指導學員一樣，主動告知需要提供的資訊，並點出重點細節。語氣專業但不生硬。' },
              { role: 'user', content: prompt },
            ],
            response_format: {
              type: 'json_schema',
              json_schema: {
                name: 'batch_questions',
                strict: true,
                schema: {
                  type: 'object',
                  properties: {
                    coachIntro: { type: 'string', description: '教練開場白，說明為什麼要問這些問題' },
                    questions: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          id: { type: 'string', description: '問題 ID' },
                          question: { type: 'string', description: '問題內容' },
                          hint: { type: 'string', description: '提示說明' },
                          importance: { type: 'string', enum: ['required', 'recommended', 'optional'] },
                          example: { type: 'string', description: '範例答案' },
                        },
                        required: ['id', 'question', 'hint', 'importance', 'example'],
                        additionalProperties: false,
                      },
                    },
                  },
                  required: ['coachIntro', 'questions'],
                  additionalProperties: false,
                },
              },
            },
          });
          
          const content = response.choices[0]?.message?.content;
          const parsed = typeof content === 'string' ? JSON.parse(content) : content;
          
          return {
            coachIntro: parsed.coachIntro || '讓我幫你整理一下寫這篇文章需要的素材：',
            questions: parsed.questions || [],
          };
        } catch (error) {
          console.error('generateBatchQuestions error:', error);
          // 如果 AI 失敗，回傳預設問題
          const fallbackQuestions = GUIDED_QUESTIONS[contentType] || GUIDED_QUESTIONS.story;
          
          return {
            coachIntro: '讓我幫你整理一下寫這篇文章需要的素材：',
            questions: fallbackQuestions.map((q, i) => ({
              id: `q${i + 1}`,
              question: q,
              hint: '請盡量具體描述',
              importance: i === 0 ? 'required' : 'recommended',
              example: '',
            })),
          };
        }
      }),
    
    // 生成專業連結建議
    generateProfessionalSuggestions: protectedProcedure
      .input(z.object({
        topic: z.string(),
        contentType: z.string(),
        draftContent: z.string(),
        creativeIntent: z.enum(['pure_story', 'light_connect', 'full_professional']),
      }))
      .query(async ({ ctx, input }) => {
        const { topic, contentType, draftContent, creativeIntent } = input;
        
        // 純粹分享模式不需要專業連結建議
        if (creativeIntent === 'pure_story') {
          return [];
        }
        
        // 獲取用戶的 IP 地基資料
        const ipProfile = await db.getIpProfile(ctx.user.id);
        
        const prompt = `你是一個專業的內容教練，正在幫助用戶思考如何在文章中自然地連結到專業。

用戶的選題：${topic}
貼文類型：${contentType}
創作意圖：${creativeIntent === 'light_connect' ? '輕度連結（主體是個人經歷，結尾可以帶到專業）' : '完整專業導入'}

用戶的專業背景：
- 職業：${ipProfile?.occupation || '未設定'}
- 專業領域：${ipProfile?.personaExpertise || '未設定'}
- 目標受眾：${ipProfile?.contentMatrixAudiences?.core || '未設定'}

用戶的初稿內容：
${draftContent.substring(0, 500)}...

請提供 2-3 個專業連結建議，讓用戶可以選擇是否採用。

要求：
1. 建議要自然，不能硬轉
2. 要與文章主題有關聯
3. 提供具體的範例文字
4. 標註建議類型（ending=結尾連結, transition=過渡段落, cta=行動呼籲）

輸出 JSON 格式，不要其他內容。`;
        
        try {
          const response = await invokeLLM({
            messages: [
              { role: 'system', content: '你是一個專業的內容教練，幫助用戶思考如何自然地在文章中連結到專業。建議要自然、不硬轉、與文章主題有關聯。' },
              { role: 'user', content: prompt },
            ],
            response_format: {
              type: 'json_schema',
              json_schema: {
                name: 'professional_suggestions',
                strict: true,
                schema: {
                  type: 'object',
                  properties: {
                    suggestions: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          id: { type: 'string', description: '建議 ID' },
                          type: { type: 'string', enum: ['ending', 'transition', 'cta'], description: '建議類型' },
                          title: { type: 'string', description: '建議標題' },
                          description: { type: 'string', description: '建議說明' },
                          example: { type: 'string', description: '範例文字' },
                        },
                        required: ['id', 'type', 'title', 'description', 'example'],
                        additionalProperties: false,
                      },
                    },
                  },
                  required: ['suggestions'],
                  additionalProperties: false,
                },
              },
            },
          });
          
          const content = response.choices[0]?.message?.content;
          const parsed = typeof content === 'string' ? JSON.parse(content) : content;
          
          return parsed.suggestions || [];
        } catch (error) {
          console.error('generateProfessionalSuggestions error:', error);
          return [];
        }
      }),
  }),

  // ==================== 系統升級：向量資料庫、內容健康檢測、用戶互動追蹤 ====================
  contentIntelligence: router({
    // AI 痕跡快速檢測
    quickDetectAiTrace: protectedProcedure
      .input(z.object({
        content: z.string(),
      }))
      .mutation(async ({ input }) => {
        const { quickDetect: quickDetectAi } = await import('./contentHealth');
        return quickDetectAi(input.content);
      }),

    // 完整內容健康檢查
    contentHealthCheck: protectedProcedure
      .input(z.object({
        content: z.string(),
        contentType: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { contentHealthCheck } = await import('./contentHealth');
        return contentHealthCheck(input.content, {
          userId: ctx.user.id,
          contentType: input.contentType,
        });
      }),

    // 自動修正迴圈
    autoGuardrail: protectedProcedure
      .input(z.object({
        content: z.string(),
        maxIterations: z.number().optional(),
        targetScore: z.number().optional(),
        preservedWords: z.array(z.string()).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { autoGuardrail } = await import('./contentHealth');
        return autoGuardrail(input.content, {
          userId: ctx.user.id,
          maxIterations: input.maxIterations,
          targetScore: input.targetScore,
          preservedWords: input.preservedWords,
        });
      }),

    // 獲取 Humanizer 配置
    getHumanizerConfig: protectedProcedure
      .query(async ({ ctx }) => {
        const { getHumanizerConfig } = await import('./contentHealth');
        return getHumanizerConfig(ctx.user.id);
      }),

    // 語意相似度搜尋
    semanticSearch: protectedProcedure
      .input(z.object({
        query: z.string(),
        topK: z.number().optional(),
        contentType: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { semanticSearch } = await import('./embedding');
        return semanticSearch(input.query, input.topK || 5, input.contentType);
      }),

    // MMR 多樣性搜尋
    mmrSearch: protectedProcedure
      .input(z.object({
        query: z.string(),
        topK: z.number().optional(),
        lambda: z.number().optional(),
        candidatePool: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        const { mmrSearch } = await import('./embedding');
        return mmrSearch(input.query, input.topK || 5, input.lambda || 0.5, input.candidatePool || 20);
      }),

    // 同質性檢查
    checkSimilarity: protectedProcedure
      .input(z.object({
        content: z.string(),
        threshold: z.number().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { checkSimilarity } = await import('./embedding');
        return checkSimilarity(input.content, input.threshold || 0.88, ctx.user.id);
      }),

    // 語意保真檢查
    checkStylePolish: protectedProcedure
      .input(z.object({
        original: z.string(),
        polished: z.string(),
        preservedWords: z.array(z.string()).optional(),
        semanticThreshold: z.number().optional(),
        keywordThreshold: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        const { checkStylePolish } = await import('./embedding');
        return checkStylePolish(
          input.original,
          input.polished,
          input.preservedWords || [],
          input.semanticThreshold,
          input.keywordThreshold
        );
      }),
  }),

  // ==================== 用戶互動追蹤 ====================
  userInteraction: router({
    // 記錄互動事件
    recordEvent: protectedProcedure
      .input(z.object({
        eventType: z.enum(['hook_selected', 'draft_modified', 'suggestion_adopted', 'content_published']),
        hookId: z.number().optional(),
        draftId: z.number().optional(),
        suggestionId: z.number().optional(),
        details: z.object({
          originalContent: z.string().optional(),
          modifiedContent: z.string().optional(),
          suggestionType: z.string().optional(),
        }).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { recordInteractionEvent } = await import('./userInteraction');
        return recordInteractionEvent({
          userId: ctx.user.id,
          eventType: input.eventType,
          hookId: input.hookId,
          draftId: input.draftId,
          suggestionId: input.suggestionId,
          details: input.details,
        });
      }),

    // 獲取用戶偏好上下文
    getPreferenceContext: protectedProcedure
      .query(async ({ ctx }) => {
        const { getUserPreferenceContext } = await import('./userInteraction');
        return getUserPreferenceContext(ctx.user.id);
      }),

    // 更新用戶成長階段
    updateGrowthStage: protectedProcedure
      .mutation(async ({ ctx }) => {
        const { updateUserGrowthStage } = await import('./userInteraction');
        return updateUserGrowthStage(ctx.user.id);
      }),
  }),

  // ==================== Prompt Builder ====================
  promptBuilder: router({
    // 建構完整提示詞
    buildPrompt: protectedProcedure
      .input(z.object({
        mode: z.enum(['pure_story', 'light_connect', 'full_inject']),
        topic: z.string(),
        contentType: z.string(),
        audience: z.string().optional(),
        additionalContext: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { buildPromptByMode } = await import('./promptBuilder');
        return buildPromptByMode({
          userId: ctx.user.id,
          mode: input.mode,
          topic: input.topic,
          contentType: input.contentType,
          audience: input.audience,
          additionalContext: input.additionalContext,
        });
      }),

    // 獲取推薦開頭
    getRecommendedHooks: protectedProcedure
      .input(z.object({
        topic: z.string(),
        topK: z.number().optional(),
        diversity: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        const { getRecommendedHooks } = await import('./embedding');
        return getRecommendedHooks(input.topic, input.topK || 3, input.diversity || 0.5);
      }),
  }),
});

export type AppRouter = typeof appRouter;
