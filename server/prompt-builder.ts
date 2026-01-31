/**
 * Prompt Builder - 根據創作意圖動態建構提示詞
 * 
 * 這個模組負責根據用戶選擇的創作意圖（純粹分享/順便帶專業/推廣專業）
 * 動態決定要注入哪些資料到提示詞中。
 */

import { 
  CreativeIntent, 
  WritingMode, 
  getPromptConfig,
  type PromptConfig 
} from '../shared/creative-intent';

/**
 * IP 地基資料介面
 */
interface IpProfile {
  occupation?: string;
  threePillars?: string;
  coreBeliefs?: string;
  targetAudience?: string;
  heroJourney?: string;
}

/**
 * 爆款公式資料介面
 */
interface ViralFormula {
  successFactors?: string;
  hookStrategies?: string;
  fewShotExamples?: string;
}

/**
 * Prompt 上下文介面
 */
export interface PromptContext {
  /** 用戶輸入的素材 */
  userInput: string;
  /** 選擇的主題 */
  topic: string;
  /** 貼文類型 */
  contentType: string;
  /** IP 地基資料 */
  ipProfile?: IpProfile;
  /** 爆款公式資料 */
  viralFormula?: ViralFormula;
  /** 用戶的口頭禪 */
  catchphrases?: string[];
  /** 用戶的說話風格 */
  speakingStyle?: string;
}

/**
 * 基礎提示詞（所有模式共用）
 */
function buildBasePrompt(context: PromptContext): string {
  return `你是一位 Threads 貼文創作助手。

【基本寫作規則】
1. 字數控制：150-300 字
2. 分段：每段 2-3 句話，用空行分隔
3. 語氣：口語化、像在跟朋友聊天
4. 使用第一人稱「我」來敘述
5. 禁止：
   - 不要用「首先、其次、最後」這類結構詞
   - 不要用「讓我們」、「一起來」這類號召語
   - 不要用過多的驚嘆號
   - 不要用 Markdown 格式（**粗體**、#標題）
   - 不要用「這讓我想到」、「說到這個」這類生硬轉折

【用戶選擇的主題】
${context.topic}

【用戶選擇的貼文類型】
${context.contentType}

【用戶輸入的素材】
${context.userInput}`;
}

/**
 * 純粹分享模式的提示詞補充
 */
function buildPurePersonalPrompt(): string {
  return `

【創作方向 - 純粹分享】
這是一篇純粹的個人分享，不需要連結任何專業或產品。
請專注於：
- 還原用戶描述的場景和情緒
- 保持真實感，不要過度修飾
- 結尾可以是開放式的，不需要給結論
- 讓讀者感受到真實的情緒共鳴

【嚴格禁止】
- 不要加入任何專業術語或行業知識
- 不要暗示任何產品或服務
- 不要給讀者「建議」或「教訓」
- 不要把故事「升華」成人生道理
- 不要在結尾加入任何 CTA 或引導
- 不要提到任何工作相關的內容`;
}

/**
 * 順便帶專業模式的提示詞補充
 */
function buildLightConnectionPrompt(ipProfile?: IpProfile): string {
  let prompt = `

【創作方向 - 順便帶點專業】
這是一篇以個人故事為主的貼文，可以在結尾自然地連結到專業觀點。
請專注於：
- 前 80% 專注於故事本身，完整呈現情緒和細節
- 最後 20% 可以輕輕帶到專業觀點（如果自然的話）
- 連結要自然，不能硬轉`;

  if (ipProfile?.occupation || ipProfile?.threePillars) {
    prompt += `

【用戶的專業背景（僅供參考，不強制使用）】`;
    if (ipProfile.occupation) {
      prompt += `
職業/身份：${ipProfile.occupation}`;
    }
    if (ipProfile.threePillars) {
      prompt += `
人設三支柱：${ipProfile.threePillars}`;
    }
    prompt += `

注意：以上資料僅供參考，用於在結尾自然連結時使用。
如果故事本身不適合連結專業，可以完全不提。`;
  }

  prompt += `

【嚴格禁止】
- 不要在開頭就提到專業
- 不要把故事變成「案例分析」
- 不要用「這讓我想到我的工作」這類生硬的轉折
- 不要強行加入專業內容，如果不自然就不要加`;

  return prompt;
}

/**
 * 推廣專業模式的提示詞補充
 */
function buildFullProfessionalPrompt(
  ipProfile?: IpProfile, 
  viralFormula?: ViralFormula
): string {
  let prompt = `

【創作方向 - 推廣專業】
這是一篇以專業角度出發的貼文，目標是建立權威形象。
請專注於：
- 從專業角度切入主題
- 提供有價值的觀點或知識
- 結尾可以有明確的 CTA
- 但語氣仍要口語化，不要變成教科書`;

  if (ipProfile) {
    prompt += `

【用戶的 IP 地基】`;
    if (ipProfile.occupation) {
      prompt += `
職業/身份：${ipProfile.occupation}`;
    }
    if (ipProfile.threePillars) {
      prompt += `
人設三支柱：${ipProfile.threePillars}`;
    }
    if (ipProfile.coreBeliefs) {
      prompt += `
核心信念：${ipProfile.coreBeliefs}`;
    }
    if (ipProfile.targetAudience) {
      prompt += `
目標受眾：${ipProfile.targetAudience}`;
    }
  }

  if (viralFormula) {
    if (viralFormula.successFactors) {
      prompt += `

【爆款成功因素參考】
${viralFormula.successFactors}`;
    }
    if (viralFormula.hookStrategies) {
      prompt += `

【Hook 策略參考】
${viralFormula.hookStrategies}`;
    }
    if (viralFormula.fewShotExamples) {
      prompt += `

【成功案例參考】
${viralFormula.fewShotExamples}`;
    }
  }

  prompt += `

【注意事項】
- 雖然是專業內容，但語氣仍要口語化
- 不要變成「教科書」或「講座」
- 保持 Threads 的輕鬆風格
- 專業內容要與用戶輸入的素材自然結合`;

  return prompt;
}

/**
 * 根據創作意圖建構完整的提示詞
 */
export function buildPromptByIntent(
  intent: CreativeIntent,
  context: PromptContext
): string {
  const config = getPromptConfig(intent);
  
  // 基礎提示詞
  let prompt = buildBasePrompt(context);
  
  // 根據創作意圖添加對應的補充
  switch (intent) {
    case 'pure_personal':
      prompt += buildPurePersonalPrompt();
      break;
    case 'light_connection':
      prompt += buildLightConnectionPrompt(
        config.injectIpBase ? context.ipProfile : undefined
      );
      break;
    case 'full_professional':
      prompt += buildFullProfessionalPrompt(
        config.injectIpBase ? context.ipProfile : undefined,
        config.injectViralFormula ? context.viralFormula : undefined
      );
      break;
  }
  
  return prompt;
}

/**
 * 建構 AI 教練問答的提示詞
 */
export function buildCoachQuestionsPrompt(
  topic: string,
  contentType: string,
  intent: CreativeIntent
): string {
  const intentInfo: Record<CreativeIntent, string> = {
    pure_personal: '純粹分享個人故事',
    light_connection: '分享故事並自然連結專業',
    full_professional: '推廣專業或產品',
  };

  return `你是一位專業的內容創作教練，正在協助學員完成一篇 Threads 貼文。

【學員選擇的主題】
${topic}

【學員選擇的貼文類型】
${contentType}

【學員的創作意圖】
${intentInfo[intent]}

【你的任務】
設計 4 個引導問題，幫助學員提供創作素材。

【教練開場白設計原則】
- 先具體肯定學員的選題（說明為什麼這是個好方向，要具體）
- 簡短說明接下來會問什麼、為什麼要問
- 語氣專業但親切，像是一對一教練指導
- 不要用「好的」、「沒問題」、「讓我來幫你」這類敷衍的開場
- 開場白控制在 2-3 句話

【問題設計原則】
- 2 個必填問題：這是創作這類貼文的核心素材
- 2 個選填問題：可以讓內容更豐富，但不是必要的
- 每個問題都要說明「為什麼問這個」（1 句話）
- 每個問題都要提供具體的回答範例（讓學員知道要寫什麼）
- 問題要能引導出「故事」或「細節」，不要問抽象的問題
- 根據貼文類型調整問題方向

【輸出格式】
請以 JSON 格式輸出：
{
  "coachIntro": "教練開場白",
  "questions": [
    {
      "id": 1,
      "question": "問題內容",
      "why": "為什麼問這個（1 句話）",
      "example": "回答範例（具體、可參考）",
      "required": true
    },
    {
      "id": 2,
      "question": "問題內容",
      "why": "為什麼問這個",
      "example": "回答範例",
      "required": true
    },
    {
      "id": 3,
      "question": "問題內容",
      "why": "為什麼問這個",
      "example": "回答範例",
      "required": false
    },
    {
      "id": 4,
      "question": "問題內容",
      "why": "為什麼問這個",
      "example": "回答範例",
      "required": false
    }
  ]
}`;
}

/**
 * 建構專業連結建議的提示詞
 */
export function buildProfessionalSuggestionsPrompt(
  generatedContent: string,
  topic: string,
  ipProfile?: IpProfile
): string {
  let prompt = `你是一位專業的內容創作教練，正在協助學員為貼文加入專業連結。

【學員的貼文主題】
${topic}

【學員目前的貼文內容】
${generatedContent}`;

  if (ipProfile) {
    prompt += `

【學員的 IP 地基】`;
    if (ipProfile.occupation) {
      prompt += `
職業/身份：${ipProfile.occupation}`;
    }
    if (ipProfile.threePillars) {
      prompt += `
人設三支柱：${ipProfile.threePillars}`;
    }
  }

  prompt += `

【你的任務】
提供 2-3 個「專業連結」的方向建議，讓學員可以選擇是否採用。

【建議設計原則】
- 連結要自然，不能硬轉
- 每個建議要說明「為什麼這樣連結有效」
- 提供具體的連結句範例（可以直接加到貼文中的句子）
- 明確標示這是「可選的」，學員可以不採用
- 最後一個選項永遠是「不連結專業」

【輸出格式】
請以 JSON 格式輸出：
{
  "coachIntro": "教練開場白（1-2 句話，肯定貼文 + 說明接下來的建議）",
  "suggestions": [
    {
      "direction": "連結方向（簡短描述）",
      "why": "為什麼這樣連結有效（1-2 句話）",
      "example": "連結句範例（可以直接加到貼文中的完整句子）",
      "insertPosition": "建議插入位置（結尾/中間）"
    }
  ],
  "skipOption": {
    "title": "這篇就純粹分享",
    "description": "這篇故事本身就很完整，不一定要連結專業"
  }
}`;

  return prompt;
}
