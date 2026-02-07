/**
 * Opener Generator 模組
 * 
 * 負責生成多個開頭候選供學員選擇
 * 整合 Prompt Service、AI Detector、Bandit 策略、品質檢查和最近使用追蹤
 */

import { getDb } from "./db";
import { openersCandidates, openerTemplates } from "../drizzle/schema";
import { getActiveTemplates, getAvoidList } from "./promptService";
import { type OpenerTemplate } from "../drizzle/schema";
import { detectAiPatterns, quickDetect } from "./aiDetector";
import { invokeLLM } from "./_core/llm";
import { getModelForFeature } from "./services/llmConfig";
import { eq, desc, and } from "drizzle-orm";

// 新增：整合品質檢查和最近使用追蹤
import { performQualityCheck, autoFixContent, type QualityCheckResult } from "./services/qualityChecker";
import { recordUsage, wasRecentlyUsed, getStylesToAvoid } from "./services/recentUsageTracker";
import { isFeatureEnabled } from "./infrastructure/feature-flags";
import { recordGeneration } from "./infrastructure/metrics-collector";

// ============================================
// 類型定義
// ============================================

export interface OpenerCandidate {
  id?: number;
  templateId: number;
  templateName: string;
  templateCategory: string;
  openerText: string;
  aiScore: number;
  aiFlags: string[];
  scoreLevel: string;
  isExploration: boolean; // 是否為探索模式生成
  // 新增：品質檢查結果
  qualityResult?: QualityCheckResult;
  wasAutoFixed?: boolean;
  originalText?: string; // 自動修復前的原始文字
  // 新增：Hook 知識庫欄位
  principle?: string;  // 心理學原理（鏡像原理/衝突原理/解法原理）
  templateType?: string;  // 句型結構（引言式/提問式/感受式/發現式/反差式）
  materialSource?: string;  // 素材來源
}

export interface GenerateOpenersInput {
  userId: number;
  topic: string;
  contentType: string;
  hookStyle?: string;
  targetAudience?: string;
  userContext?: string;
  count?: number; // 生成數量，預設 5
  explorationRate?: number; // 探索率，預設 0.1 (10%)
}

export interface GenerateOpenersResult {
  candidates: OpenerCandidate[];
  totalGenerated: number;
  explorationCount: number;
  avgAiScore: number;
}

// ============================================
// 核心函數
// ============================================

/**
 * 生成多個開頭候選
 */
export async function generateMultipleOpeners(
  input: GenerateOpenersInput
): Promise<GenerateOpenersResult> {
  const {
    userId,
    topic,
    contentType,
    hookStyle,
    targetAudience,
    userContext,
    count = 5,
    explorationRate = 0.1,
  } = input;

  // 取得啟用的模板
  const templates = await getActiveTemplates();
  if (templates.length === 0) {
    throw new Error("沒有可用的開頭模板");
  }

  // 取得禁止句式清單
  const avoidListData = await getAvoidList();
  const avoidList = avoidListData.map(item => item.pattern);

  // 決定探索 vs 利用的數量
  const explorationCount = Math.max(1, Math.floor(count * explorationRate));
  const exploitationCount = count - explorationCount;

  // 選擇模板
  const selectedTemplates = selectTemplatesForGeneration(
    templates,
    exploitationCount,
    explorationCount
  );

  // 並行生成所有候選
  const candidatePromises = selectedTemplates.map((selection, index) =>
    generateSingleOpener({
      template: selection.template,
      isExploration: selection.isExploration,
      topic,
      contentType,
      hookStyle,
      targetAudience,
      userContext,
      avoidList,
      index,
    })
  );

  const candidates = await Promise.all(candidatePromises);

  // 計算平均 AI 分數
  const avgAiScore =
    candidates.reduce((sum, c) => sum + c.aiScore, 0) / candidates.length;

  // 儲存候選到資料庫
  await saveCandidates(userId, topic, contentType, hookStyle, candidates);

  return {
    candidates,
    totalGenerated: candidates.length,
    explorationCount,
    avgAiScore,
  };
}

/**
 * 根據權重選擇模板（本地版本，避免異步問題）
 */
function selectTemplateByWeightLocal(
  templates: OpenerTemplate[],
  usedTemplateIds: Set<number>
): OpenerTemplate | null {
  const availableTemplates = templates.filter(t => !usedTemplateIds.has(t.id));
  if (availableTemplates.length === 0) return null;
  
  // 計算總權重
  const totalWeight = availableTemplates.reduce((sum, t) => sum + parseFloat(t.weight || "1"), 0);
  
  // 隨機選擇
  let random = Math.random() * totalWeight;
  for (const template of availableTemplates) {
    random -= parseFloat(template.weight || "1");
    if (random <= 0) {
      return template;
    }
  }
  
  return availableTemplates[0];
}

/**
 * 選擇用於生成的模板（結合利用和探索）
 */
function selectTemplatesForGeneration(
  templates: OpenerTemplate[],
  exploitationCount: number,
  explorationCount: number
): Array<{ template: OpenerTemplate; isExploration: boolean }> {
  const result: Array<{ template: OpenerTemplate; isExploration: boolean }> = [];
  const usedTemplateIds = new Set<number>();

  // 利用模式：根據權重選擇高效模板
  for (let i = 0; i < exploitationCount; i++) {
    const template = selectTemplateByWeightLocal(templates, usedTemplateIds);
    if (template) {
      result.push({ template, isExploration: false });
      usedTemplateIds.add(template.id);
    }
  }

  // 探索模式：隨機選擇低權重或未使用的模板
  const unusedTemplates = templates.filter((t) => !usedTemplateIds.has(t.id));
  const lowWeightTemplates = templates
    .filter((t) => !usedTemplateIds.has(t.id))
    .sort((a, b) => parseFloat(a.weight || "1") - parseFloat(b.weight || "1"));

  for (let i = 0; i < explorationCount; i++) {
    // 優先選擇低權重模板進行探索
    const explorationPool =
      lowWeightTemplates.length > 0 ? lowWeightTemplates : unusedTemplates;
    if (explorationPool.length > 0) {
      const randomIndex = Math.floor(Math.random() * explorationPool.length);
      const template = explorationPool[randomIndex];
      result.push({ template, isExploration: true });
      usedTemplateIds.add(template.id);
      // 從池中移除已選擇的模板
      explorationPool.splice(randomIndex, 1);
    }
  }

  return result;
}

/**
 * 生成單個開頭候選
 */
async function generateSingleOpener(params: {
  template: OpenerTemplate;
  isExploration: boolean;
  topic: string;
  contentType: string;
  hookStyle?: string;
  targetAudience?: string;
  userContext?: string;
  avoidList: string[];
  index: number;
}): Promise<OpenerCandidate> {
  const {
    template,
    isExploration,
    topic,
    contentType,
    hookStyle,
    targetAudience,
    userContext,
    avoidList,
  } = params;

  // 組裝 prompt
  const prompt = buildOpenerPrompt({
    template,
    topic,
    contentType,
    hookStyle,
    targetAudience,
    userContext,
    avoidList,
  });

  try {
    // ✅ 方案 A：品質優先 - 開頭生成使用 Gemini 2.5 Flash
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `你是一位專業的 Threads 社群內容創作者，擅長撰寫吸引人的開頭。
你的任務是根據指定的模板風格，為給定的主題撰寫一個引人入勝的開頭。

重要規則：
1. 開頭必須在 50-100 字之間
2. 必須符合指定的模板風格
3. 必須避免使用禁止句式
4. 語氣要自然、像真人說話
5. 不要使用過於正式或書面的表達

【數據驗證的高效 Hook 類型（基於 50 帳號 29,475 篇分析）】
- 數字/數據開頭（Top 200 佔 34%）：[N] 個 [工具/技巧]，[好處]
- 極端形容詞/震撼（Top 200 佔 17%）：我真的 [極端反應]。[原因]...
- 個人經驗/故事（Top 200 佔 8%）：[我/朋友] + [做了某事] + [意外結果]
- 否定/警告（Top 200 佔 4%）：不要再 [錯誤]。[更好方法]:
- 疑問句/提問（Top 200 佔 4%）：[情境/兩難]？[選項]
- 場景式對話（故事型極高）：[某人說]: "..." → [轉折]

【組合模式（最高互動）】
- 數字+否定（1500 互動）、震撼+個人經驗（1200 互動）、數字+個人經驗（1100 互動）

【禁止 AI 感詞彙】
- 「不是…而是」「記住！」「一起撐」「溫柔地」「深深地」「靜靜地」「我想說的是」`,
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      model: getModelForFeature('opener'),  // Gemini 2.5 Flash
    });

    const messageContent = response.choices[0]?.message?.content;
    let openerText = typeof messageContent === 'string' ? messageContent.trim() : "";

    // 進行 AI 痕跡檢測
    const detection = await detectAiPatterns(openerText);
    
    // 新增：品質檢查
    let qualityResult: QualityCheckResult | undefined;
    let wasAutoFixed = false;
    let originalText: string | undefined;
    
    if (isFeatureEnabled('QUALITY_CHECKER')) {
      qualityResult = performQualityCheck(openerText, 'short');
      
      // 如果品質不通過，嘗試自動修復
      if (!qualityResult.passed && qualityResult.shouldRetry) {
        originalText = openerText;
        const fixResult = autoFixContent(openerText);
        if (fixResult.changes.length > 0) {
          openerText = fixResult.fixed;
          wasAutoFixed = true;
          // 重新檢查修復後的品質
          qualityResult = performQualityCheck(openerText, 'short');
        }
      }
      
      // 記錄指標
      recordGeneration(
        0, // duration - 稍後可以加入計時器
        qualityResult.passed,
        'opener'
      );
    }

    // 根據模板類別推斷心理學原理和句型結構
    const { principle, templateType } = inferPrincipleAndTemplateType(template.category || 'other', template.name);
    
    return {
      templateId: template.id,
      templateName: template.name,
      templateCategory: template.category || "other",
      openerText,
      aiScore: detection.overallScore,
      aiFlags: detection.matches.map(m => m.pattern),
      scoreLevel: getScoreLevel(detection.overallScore),
      isExploration,
      qualityResult,
      wasAutoFixed,
      originalText,
      // 新增：Hook 知識庫欄位
      principle,
      templateType,
      materialSource: `來自用戶素材：${topic}`,
    };
  } catch (error) {
    console.error(`[OpenerGenerator] Failed to generate opener:`, error);
    // 返回一個錯誤候選
    return {
      templateId: template.id,
      templateName: template.name,
      templateCategory: template.category || "other",
      openerText: `[生成失敗] 請重試`,
      aiScore: 1,
      aiFlags: ["generation_error"],
      scoreLevel: "error",
      isExploration,
    };
  }
}

/**
 * 組裝開頭生成 prompt
 */
function buildOpenerPrompt(params: {
  template: OpenerTemplate;
  topic: string;
  contentType: string;
  hookStyle?: string;
  targetAudience?: string;
  userContext?: string;
  avoidList: string[];
}): string {
  const {
    template,
    topic,
    contentType,
    hookStyle,
    targetAudience,
    userContext,
    avoidList,
  } = params;

  let prompt = `## 任務
為以下主題撰寫一個吸引人的開頭。

## 主題
${topic}

## 內容類型
${contentType}

## 開頭風格
使用「${template.name}」風格（${template.category}類）
${template.description}

## 模板結構
${template.template}
`;

  if (hookStyle) {
    prompt += `\n## Hook 風格偏好\n${hookStyle}\n`;
  }

  if (targetAudience) {
    prompt += `\n## 目標受眾\n${targetAudience}\n`;
  }

  if (userContext) {
    prompt += `\n## 補充資訊\n${userContext}\n`;
  }

  if (avoidList.length > 0) {
    prompt += `\n## 禁止使用的句式（必須避免）
${avoidList.slice(0, 10).map((p) => `- ${p}`).join("\n")}
`;
  }

  prompt += `
## 輸出要求
1. 只輸出開頭文字，不要加任何說明
2. 開頭長度在 50-100 字之間
3. 語氣自然，像朋友聊天
4. 不要使用上述禁止句式`;

  return prompt;
}

/**
 * 儲存候選到資料庫
 */
async function saveCandidates(
  userId: number,
  topic: string,
  contentType: string,
  hookStyle: string | undefined,
  candidates: OpenerCandidate[]
): Promise<void> {
  const db = await getDb();
  if (!db) return;

  try {
    const values = candidates.map((c) => ({
      userId,
      templateId: c.templateId,
      openerText: c.openerText,
      topic,
      contentType,
      hookStyle: hookStyle || null,
      aiScore: c.aiScore.toFixed(4),
      aiFlags: c.aiFlags,
      isSelected: false,
    }));

    await db.insert(openersCandidates).values(values);
  } catch (error) {
    console.error("[OpenerGenerator] Failed to save candidates:", error);
  }
}

/**
 * 取得分數等級描述
 */
function getScoreLevel(score: number): string {
  if (score < 0.2) return "excellent";
  if (score < 0.4) return "good";
  if (score < 0.6) return "fair";
  return "poor";
}

/**
 * 根據模板類別推斷心理學原理和句型結構
 * 
 * 三大心理學原理：
 * - 鏡像原理：讓讀者看到自己（「你是不是也...」「有沒有一種感覺...」）
 * - 衝突原理：製造反差和好奇（「很多人以為...但其實...」「我曾經也...」）
 * - 解法原理：點出痛點暗示解法（「教你一個方法...」「這個技巧讓我...」）
 * 
 * 五種句型結構：
 * - 引言式：用名人名言或金句開場
 * - 提問式：用問題引發思考
 * - 感受式：用情緒和感受帶入
 * - 發現式：用「我發現...」「原來...」開場
 * - 反差式：用對比和反差製造衝擊
 */
function inferPrincipleAndTemplateType(
  category: string,
  templateName: string
): { principle: string; templateType: string } {
  // 根據模板類別推斷心理學原理
  let principle = '鏡像原理'; // 預設
  let templateType = '感受式'; // 預設
  
  const categoryLower = category.toLowerCase();
  const nameLower = templateName.toLowerCase();
  
  // 根據類別推斷心理學原理
  if (categoryLower.includes('mirror') || categoryLower.includes('鏡像') || 
      nameLower.includes('你是不是') || nameLower.includes('有沒有')) {
    principle = '鏡像原理';
  } else if (categoryLower.includes('contrast') || categoryLower.includes('反差') || 
             categoryLower.includes('對比') || nameLower.includes('但其實') || 
             nameLower.includes('沒想到')) {
    principle = '衝突原理';
  } else if (categoryLower.includes('solution') || categoryLower.includes('解法') || 
             categoryLower.includes('method') || nameLower.includes('教你') || 
             nameLower.includes('技巧')) {
    principle = '解法原理';
  } else if (categoryLower.includes('question') || categoryLower.includes('提問')) {
    principle = '鏡像原理'; // 提問通常是讓讀者看到自己
  } else if (categoryLower.includes('scene') || categoryLower.includes('情境') || 
             categoryLower.includes('場景')) {
    principle = '鏡像原理'; // 場景帶入通常是讓讀者代入
  } else if (categoryLower.includes('data') || categoryLower.includes('數據')) {
    principle = '衝突原理'; // 數據通常用來製造反差
  } else if (categoryLower.includes('feeling') || categoryLower.includes('感受') || 
             categoryLower.includes('情緒')) {
    principle = '鏡像原理'; // 情緒帶入是讓讀者共鳴
  }
  
  // 根據類別推斷句型結構
  if (categoryLower.includes('question') || categoryLower.includes('提問') || 
      nameLower.includes('問') || nameLower.includes('?') || nameLower.includes('？')) {
    templateType = '提問式';
  } else if (categoryLower.includes('contrast') || categoryLower.includes('反差') || 
             categoryLower.includes('對比')) {
    templateType = '反差式';
  } else if (categoryLower.includes('quote') || categoryLower.includes('引言') || 
             nameLower.includes('名言') || nameLower.includes('金句')) {
    templateType = '引言式';
  } else if (categoryLower.includes('discovery') || categoryLower.includes('發現') || 
             nameLower.includes('發現') || nameLower.includes('原來')) {
    templateType = '發現式';
  } else if (categoryLower.includes('feeling') || categoryLower.includes('感受') || 
             categoryLower.includes('情緒') || categoryLower.includes('scene') || 
             categoryLower.includes('情境')) {
    templateType = '感受式';
  } else if (categoryLower.includes('mirror') || categoryLower.includes('鏡像')) {
    templateType = '提問式'; // 鏡像通常用提問式
  } else if (categoryLower.includes('data') || categoryLower.includes('數據')) {
    templateType = '發現式'; // 數據通常用發現式
  }
  
  return { principle, templateType };
}

// ============================================
// 輔助函數
// ============================================

/**
 * 取得用戶最近選擇的模板（用於個人化）
 */
export async function getUserPreferredTemplates(
  userId: number,
  limit: number = 10
): Promise<number[]> {
  const db = await getDb();
  if (!db) return [];

  try {
    const recent = await db
      .select({ templateId: openersCandidates.templateId })
      .from(openersCandidates)
      .where(
        and(
          eq(openersCandidates.userId, userId),
          eq(openersCandidates.isSelected, true)
        )
      )
      .orderBy(desc(openersCandidates.selectedAt))
      .limit(limit);

    return recent
      .map((r) => r.templateId)
      .filter((id): id is number => id !== null);
  } catch (error) {
    console.error("[OpenerGenerator] Failed to get user preferences:", error);
    return [];
  }
}

/**
 * 標記候選被選中
 */
export async function markOpenerSelected(
  candidateId: number
): Promise<void> {
  const db = await getDb();
  if (!db) return;

  try {
    await db
      .update(openersCandidates)
      .set({
        isSelected: true,
        selectedAt: new Date(),
      })
      .where(eq(openersCandidates.id, candidateId));
  } catch (error) {
    console.error("[OpenerGenerator] Failed to mark selected:", error);
  }
}

/**
 * 快速生成（使用預設設定）
 */
export async function quickGenerateOpeners(
  userId: number,
  topic: string,
  contentType: string
): Promise<OpenerCandidate[]> {
  const result = await generateMultipleOpeners({
    userId,
    topic,
    contentType,
    count: 3,
    explorationRate: 0.1,
  });
  return result.candidates;
}
