/**
 * Prompt Service - 集中管理 prompt 和 template
 * 
 * 功能：
 * - getActiveTemplates(): 取得所有啟用的模板
 * - getTemplateById(id): 取得特定模板
 * - getAvoidList(): 取得禁止句式清單
 * - assemblePrompt(templateId, context): 組裝完整的 prompt
 * - updateTemplateWeight(id, weight): 更新模板權重
 */

import { getDb } from "./db";
import { openerTemplates, promptAvoidList, type OpenerTemplate, type PromptAvoidList } from "../drizzle/schema";
import { eq, and } from "drizzle-orm";

// ==================== 預設禁止句式清單 ====================

export const DEFAULT_AVOID_PATTERNS: Omit<PromptAvoidList, 'id' | 'createdAt' | 'updatedAt' | 'matchCount'>[] = [
  // 開頭句式
  { pattern: "你是不是也", patternType: "opener", description: "過於常見的 AI 開頭句式，容易讓讀者感到制式", replacement: "直接描述具體情境或感受", severity: "warn", isActive: true, isUserDefined: false, userId: null },
  { pattern: "你有沒有發現", patternType: "opener", description: "過於常見的 AI 開頭句式", replacement: "用具體觀察或數據開頭", severity: "warn", isActive: true, isUserDefined: false, userId: null },
  { pattern: "很多人以為.*但其實", patternType: "opener", description: "過於制式的反差開頭", replacement: "直接點出反差，不用「很多人以為」", severity: "warn", isActive: true, isUserDefined: false, userId: null },
  { pattern: "你知道嗎", patternType: "opener", description: "過於常見的 AI 開頭句式", replacement: "直接陳述事實或觀點", severity: "suggest", isActive: true, isUserDefined: false, userId: null },
  { pattern: "今天想跟大家分享", patternType: "opener", description: "過於平淡的開頭", replacement: "直接進入主題，不需要鋪墊", severity: "suggest", isActive: true, isUserDefined: false, userId: null },
  { pattern: "最近我發現", patternType: "opener", description: "過於常見的 AI 開頭句式", replacement: "直接描述發現的內容", severity: "suggest", isActive: true, isUserDefined: false, userId: null },
  
  // 過渡句式
  { pattern: "其實", patternType: "transition", description: "過度使用會顯得猶豫不決", replacement: "直接陳述觀點", severity: "suggest", isActive: true, isUserDefined: false, userId: null },
  { pattern: "說真的", patternType: "transition", description: "過度使用會顯得不自信", replacement: "直接表達", severity: "suggest", isActive: true, isUserDefined: false, userId: null },
  { pattern: "不得不說", patternType: "transition", description: "過於常見的 AI 過渡句式", replacement: "直接說出觀點", severity: "suggest", isActive: true, isUserDefined: false, userId: null },
  { pattern: "說實話", patternType: "transition", description: "暗示之前說的不是實話", replacement: "直接表達", severity: "suggest", isActive: true, isUserDefined: false, userId: null },
  { pattern: "老實說", patternType: "transition", description: "暗示之前說的不是實話", replacement: "直接表達", severity: "suggest", isActive: true, isUserDefined: false, userId: null },
  
  // 結尾句式
  { pattern: "你覺得呢", patternType: "ending", description: "過於常見的 AI 結尾句式", replacement: "用具體問題或行動呼籲", severity: "warn", isActive: true, isUserDefined: false, userId: null },
  { pattern: "留言告訴我", patternType: "ending", description: "過於直接的 CTA", replacement: "用更自然的互動邀請", severity: "suggest", isActive: true, isUserDefined: false, userId: null },
  { pattern: "歡迎在下方留言", patternType: "ending", description: "過於制式的 CTA", replacement: "用更自然的互動邀請", severity: "suggest", isActive: true, isUserDefined: false, userId: null },
  { pattern: "如果你也有同感", patternType: "ending", description: "過於常見的 AI 結尾句式", replacement: "用更具體的共鳴點", severity: "suggest", isActive: true, isUserDefined: false, userId: null },
  
  // AI 特徵詞
  { pattern: "作為一個", patternType: "ai_phrase", description: "典型的 AI 自我介紹句式", replacement: "直接表達身份或觀點", severity: "block", isActive: true, isUserDefined: false, userId: null },
  { pattern: "首先.*其次.*最後", patternType: "ai_phrase", description: "過於制式的列點結構", replacement: "用更自然的敘述方式", severity: "warn", isActive: true, isUserDefined: false, userId: null },
  { pattern: "第一.*第二.*第三", patternType: "ai_phrase", description: "過於制式的列點結構", replacement: "用更自然的敘述方式", severity: "warn", isActive: true, isUserDefined: false, userId: null },
  { pattern: "總而言之", patternType: "ai_phrase", description: "過於正式的總結詞", replacement: "用更口語化的總結", severity: "suggest", isActive: true, isUserDefined: false, userId: null },
  { pattern: "綜上所述", patternType: "ai_phrase", description: "過於正式的總結詞", replacement: "用更口語化的總結", severity: "block", isActive: true, isUserDefined: false, userId: null },
  { pattern: "值得一提的是", patternType: "ai_phrase", description: "過於正式的過渡詞", replacement: "直接說出重點", severity: "suggest", isActive: true, isUserDefined: false, userId: null },
  { pattern: "不可否認", patternType: "ai_phrase", description: "過於正式的表達", replacement: "直接承認或表達", severity: "suggest", isActive: true, isUserDefined: false, userId: null },
  
  // 填充詞
  { pattern: "事實上", patternType: "filler", description: "過度使用會顯得囉嗦", replacement: "直接陳述事實", severity: "suggest", isActive: true, isUserDefined: false, userId: null },
  { pattern: "實際上", patternType: "filler", description: "過度使用會顯得囉嗦", replacement: "直接陳述", severity: "suggest", isActive: true, isUserDefined: false, userId: null },
  { pattern: "基本上", patternType: "filler", description: "過度使用會顯得不確定", replacement: "直接陳述", severity: "suggest", isActive: true, isUserDefined: false, userId: null },
  { pattern: "簡單來說", patternType: "filler", description: "過度使用會顯得囉嗦", replacement: "直接簡化表達", severity: "suggest", isActive: true, isUserDefined: false, userId: null },
];

// ==================== 預設開頭模板 ====================

export const DEFAULT_OPENER_TEMPLATES: Omit<OpenerTemplate, 'id' | 'createdAt' | 'updatedAt' | 'usageCount' | 'successCount' | 'successRate'>[] = [
  // 鏡像策略
  { name: "情境共鳴", category: "mirror", template: "{{specific_situation}}", description: "直接描述目標受眾的具體情境", example: "凌晨三點還在改簡報，老闆又說要重做", weight: "1.0000", isActive: true, isDefault: true, createdBy: null },
  { name: "內心獨白", category: "mirror", template: "{{inner_thought}}", description: "說出受眾心裡的 OS", example: "「為什麼別人都可以，就我不行？」", weight: "1.0000", isActive: true, isDefault: true, createdBy: null },
  
  // 反差策略
  { name: "認知反轉", category: "contrast", template: "{{common_belief}} → {{reality}}", description: "先說常見認知，再揭露真相", example: "努力就會成功？錯。方向比努力重要十倍", weight: "1.0000", isActive: true, isDefault: true, createdBy: null },
  { name: "結果先行", category: "contrast", template: "{{surprising_result}}", description: "先說出驚人的結果", example: "三個月瘦了 15 公斤，但我沒有節食", weight: "1.0000", isActive: true, isDefault: true, createdBy: null },
  
  // 場景策略
  { name: "時間定錨", category: "scene", template: "{{time}} {{action}}", description: "用具體時間點開場", example: "早上六點，我在捷運上哭了", weight: "1.0000", isActive: true, isDefault: true, createdBy: null },
  { name: "對話開場", category: "scene", template: "「{{dialogue}}」", description: "用一句對話開場", example: "「你這樣下去會後悔的」媽媽說", weight: "1.0000", isActive: true, isDefault: true, createdBy: null },
  
  // 提問策略
  { name: "直擊痛點", category: "question", template: "{{pain_point_question}}", description: "直接問出受眾的痛點", example: "為什麼越努力越累，卻看不到成果？", weight: "1.0000", isActive: true, isDefault: true, createdBy: null },
  { name: "選擇題", category: "question", template: "{{option_a}} 還是 {{option_b}}？", description: "給出兩個選項讓讀者思考", example: "繼續忍耐，還是勇敢離開？", weight: "1.0000", isActive: true, isDefault: true, createdBy: null },
  
  // 數據策略
  { name: "數據衝擊", category: "data", template: "{{number}} {{context}}", description: "用數據開場", example: "87% 的人都有這個問題，卻不知道怎麼解決", weight: "1.0000", isActive: true, isDefault: true, createdBy: null },
  { name: "時間成本", category: "data", template: "{{time_spent}} {{activity}}", description: "用時間成本開場", example: "花了三年才明白這個道理", weight: "1.0000", isActive: true, isDefault: true, createdBy: null },
  
  // 故事策略
  { name: "轉折點", category: "story", template: "{{turning_point}}", description: "從故事的轉折點開始", example: "那天，我決定辭職", weight: "1.0000", isActive: true, isDefault: true, createdBy: null },
  { name: "失敗開場", category: "story", template: "{{failure_moment}}", description: "從失敗的時刻開始", example: "第五次被拒絕的時候，我終於懂了", weight: "1.0000", isActive: true, isDefault: true, createdBy: null },
  
  // 情緒策略
  { name: "情緒爆發", category: "emotion", template: "{{emotion_expression}}", description: "直接表達強烈情緒", example: "我真的受夠了", weight: "1.0000", isActive: true, isDefault: true, createdBy: null },
  { name: "療癒開場", category: "emotion", template: "{{healing_message}}", description: "用療癒的話開場", example: "沒關係，你已經很努力了", weight: "1.0000", isActive: true, isDefault: true, createdBy: null },
];

// ==================== Prompt Service 函數 ====================

/**
 * 取得所有啟用的開頭模板
 */
export async function getActiveTemplates(): Promise<OpenerTemplate[]> {
  const db = await getDb();
  if (!db) {
    return DEFAULT_OPENER_TEMPLATES.map((t, index) => ({
      ...t,
      id: index + 1,
      usageCount: 0,
      successCount: 0,
      successRate: "0.0000",
      createdAt: new Date(),
      updatedAt: new Date(),
    })) as OpenerTemplate[];
  }
  
  const templates = await db.select().from(openerTemplates).where(eq(openerTemplates.isActive, true));
  
  if (templates.length === 0) {
    return DEFAULT_OPENER_TEMPLATES.map((t, index) => ({
      ...t,
      id: index + 1,
      usageCount: 0,
      successCount: 0,
      successRate: "0.0000",
      createdAt: new Date(),
      updatedAt: new Date(),
    })) as OpenerTemplate[];
  }
  
  return templates;
}

/**
 * 取得特定模板
 */
export async function getTemplateById(id: number): Promise<OpenerTemplate | null> {
  const db = await getDb();
  if (!db) return null;
  
  const [template] = await db.select().from(openerTemplates).where(eq(openerTemplates.id, id));
  return template || null;
}

/**
 * 根據類型取得模板
 */
export async function getTemplatesByCategory(category: string): Promise<OpenerTemplate[]> {
  const db = await getDb();
  if (!db) {
    return DEFAULT_OPENER_TEMPLATES
      .filter(t => t.category === category)
      .map((t, index) => ({
        ...t,
        id: index + 1,
        usageCount: 0,
        successCount: 0,
        successRate: "0.0000",
        createdAt: new Date(),
        updatedAt: new Date(),
      })) as OpenerTemplate[];
  }
  
  const templates = await db.select().from(openerTemplates).where(
    and(
      eq(openerTemplates.isActive, true),
      eq(openerTemplates.category, category as any)
    )
  );
  
  if (templates.length === 0) {
    return DEFAULT_OPENER_TEMPLATES
      .filter(t => t.category === category)
      .map((t, index) => ({
        ...t,
        id: index + 1,
        usageCount: 0,
        successCount: 0,
        successRate: "0.0000",
        createdAt: new Date(),
        updatedAt: new Date(),
      })) as OpenerTemplate[];
  }
  
  return templates;
}

/**
 * 取得禁止句式清單
 */
export async function getAvoidList(userId?: number): Promise<PromptAvoidList[]> {
  const db = await getDb();
  if (!db) {
    return DEFAULT_AVOID_PATTERNS.map((p, index) => ({
      ...p,
      id: index + 1,
      matchCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    })) as PromptAvoidList[];
  }
  
  // 取得系統預設的禁止句式
  const systemPatterns = await db.select().from(promptAvoidList).where(
    and(
      eq(promptAvoidList.isActive, true),
      eq(promptAvoidList.isUserDefined, false)
    )
  );
  
  // 如果有用戶 ID，也取得用戶自訂的禁止句式
  let userPatterns: PromptAvoidList[] = [];
  if (userId) {
    userPatterns = await db.select().from(promptAvoidList).where(
      and(
        eq(promptAvoidList.isActive, true),
        eq(promptAvoidList.isUserDefined, true),
        eq(promptAvoidList.userId, userId)
      )
    );
  }
  
  // 如果資料庫沒有系統預設，返回預設清單
  if (systemPatterns.length === 0) {
    return DEFAULT_AVOID_PATTERNS.map((p, index) => ({
      ...p,
      id: index + 1,
      matchCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    })) as PromptAvoidList[];
  }
  
  return [...systemPatterns, ...userPatterns];
}

/**
 * 組裝完整的 prompt（包含禁止句式指引）
 */
export async function assemblePrompt(
  basePrompt: string,
  context: {
    userId?: number;
    topic?: string;
    contentType?: string;
    audience?: string;
    ipProfile?: Record<string, unknown>;
  }
): Promise<string> {
  // 取得禁止句式清單
  const avoidPatterns = await getAvoidList(context.userId);
  
  // 分類禁止句式
  const blockPatterns = avoidPatterns.filter(p => p.severity === 'block');
  const warnPatterns = avoidPatterns.filter(p => p.severity === 'warn');
  
  // 組裝禁止句式指引
  const avoidInstructions = `
【禁止使用的句式】
以下句式絕對不能使用，會讓內容顯得像 AI 生成：
${blockPatterns.map(p => `- 「${p.pattern}」：${p.description}`).join('\n')}

【避免使用的句式】
以下句式盡量避免，如果使用請確保有變化：
${warnPatterns.map(p => `- 「${p.pattern}」：${p.description}`).join('\n')}

【替代建議】
- 開頭直接進入情境或故事，不要用「你是不是也...」
- 用具體的時間、地點、對話開場
- 說出受眾心裡的 OS，而不是問他們是不是這樣
- 結尾用具體的行動呼籲，不要用「你覺得呢」
`;

  // 組裝最終 prompt
  const finalPrompt = `${basePrompt}

${avoidInstructions}

【重要提醒】
- 每次生成的開頭都要不同，不能重複使用相同的句式結構
- 內容要像真人寫的，有個人風格和情緒
- 避免過於工整的列點結構，用自然的敘述方式
`;

  return finalPrompt;
}

/**
 * 更新模板權重
 */
export async function updateTemplateWeight(id: number, weight: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  await db.update(openerTemplates)
    .set({ weight: weight.toFixed(4) })
    .where(eq(openerTemplates.id, id));
}

/**
 * 記錄模板使用
 */
export async function recordTemplateUsage(templateId: number, wasSelected: boolean, wasViral: boolean = false): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  const [template] = await db.select().from(openerTemplates).where(eq(openerTemplates.id, templateId));
  
  if (template) {
    const newUsageCount = (template.usageCount || 0) + 1;
    const newSuccessCount = wasViral ? (template.successCount || 0) + 1 : (template.successCount || 0);
    const newSuccessRate = newUsageCount > 0 ? (newSuccessCount / newUsageCount) : 0;
    
    await db.update(openerTemplates)
      .set({
        usageCount: newUsageCount,
        successCount: newSuccessCount,
        successRate: newSuccessRate.toFixed(4),
      })
      .where(eq(openerTemplates.id, templateId));
  }
}

/**
 * 初始化預設資料（如果資料庫為空）
 */
export async function initializeDefaultData(): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  // 檢查是否已有禁止句式
  const existingPatterns = await db.select().from(promptAvoidList).limit(1);
  if (existingPatterns.length === 0) {
    // 插入預設禁止句式
    for (const pattern of DEFAULT_AVOID_PATTERNS) {
      await db.insert(promptAvoidList).values(pattern as any);
    }
    console.log(`[PromptService] Initialized ${DEFAULT_AVOID_PATTERNS.length} default avoid patterns`);
  }
  
  // 檢查是否已有開頭模板
  const existingTemplates = await db.select().from(openerTemplates).limit(1);
  if (existingTemplates.length === 0) {
    // 插入預設開頭模板
    for (const template of DEFAULT_OPENER_TEMPLATES) {
      await db.insert(openerTemplates).values(template as any);
    }
    console.log(`[PromptService] Initialized ${DEFAULT_OPENER_TEMPLATES.length} default opener templates`);
  }
}

/**
 * 根據權重隨機選擇模板
 */
export async function selectTemplateByWeight(category?: string): Promise<OpenerTemplate | null> {
  let templates: OpenerTemplate[];
  
  if (category) {
    templates = await getTemplatesByCategory(category);
  } else {
    templates = await getActiveTemplates();
  }
  
  if (templates.length === 0) return null;
  
  // 計算總權重
  const totalWeight = templates.reduce((sum, t) => sum + parseFloat(t.weight || "1"), 0);
  
  // 隨機選擇
  let random = Math.random() * totalWeight;
  for (const template of templates) {
    random -= parseFloat(template.weight || "1");
    if (random <= 0) {
      return template;
    }
  }
  
  return templates[0];
}
