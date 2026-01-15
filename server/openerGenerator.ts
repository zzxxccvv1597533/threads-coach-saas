/**
 * Opener Generator 模組
 * 
 * 負責生成多個開頭候選供學員選擇
 * 整合 Prompt Service、AI Detector 和 Bandit 策略
 */

import { getDb } from "./db";
import { openersCandidates, openerTemplates } from "../drizzle/schema";
import { getActiveTemplates, getAvoidList } from "./promptService";
import { type OpenerTemplate } from "../drizzle/schema";
import { detectAiPatterns, quickDetect } from "./aiDetector";
import { invokeLLM } from "./_core/llm";
import { eq, desc, and } from "drizzle-orm";

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
    // 調用 LLM 生成
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
5. 不要使用過於正式或書面的表達`,
        },
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    const messageContent = response.choices[0]?.message?.content;
    const openerText = typeof messageContent === 'string' ? messageContent.trim() : "";

    // 進行 AI 痕跡檢測
    const detection = await detectAiPatterns(openerText);

    return {
      templateId: template.id,
      templateName: template.name,
      templateCategory: template.category || "other",
      openerText,
      aiScore: detection.overallScore,
      aiFlags: detection.matches.map(m => m.pattern),
      scoreLevel: getScoreLevel(detection.overallScore),
      isExploration,
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
