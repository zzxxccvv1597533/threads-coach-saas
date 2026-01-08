import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { invokeLLM } from "./_core/llm";
import * as db from "./db";
import { filterProfanity } from "./contentFilters";

// 簡化的 Health Check 結果結構
export interface HealthCheckResult {
  totalScore: number;
  hook: { score: number; feedback: string };
  translation: { score: number; feedback: string };
  tone: { score: number; feedback: string };
  cta: { score: number; feedback: string };
  fourLens: { score: number; feedback: string };
  redlineMarks: Array<{
    originalText: string;
    suggestedText: string;
    reason: string;
  }>;
}

const HEALTH_CHECK_PROMPT = `你現在是【Threads 演算法審核機器人】與【爆款文案教練】。
你的任務不是批改作文，而是判斷這篇文章是否符合 Threads 的演算法偏好。

## 評分規則 (100分滿分)

### Hook 鉤子強度 (25分)
- 前兩行是否讓人停下？
- 是否有反直覺/反差敘述或觀察+提問句型？

### Translation 翻譯機 (20分)
- 是否用比喻說白話？
- 是否避免堆砌專業術語？

### Tone 閱讀體感 (15分)
- 是否像真人說話？
- 排版是否有呼吸感？

### CTA 互動召喚 (10分)
- 是否有自然的互動召喚？

### 四透鏡 (30分)
- 心法：傳遞渴望還是焦慮？
- 人設：符合創作者風格嗎？
- 結構：邏輯清晰嗎？
- 轉化：有明確的下一步嗎？

## 輸出要求

請輸出 JSON 格式的評分結果，包含：
1. 各維度的分數和反饋
2. 最多 3 個需要改進的地方（originalText, suggestedText, reason）
3. 總分（0-100）

不要輸出任何其他文字，只輸出 JSON。`;

export async function executeContentHealthCheckFixed(userId: number, text: string) {
  console.log('[executeContentHealthCheckFixed] Starting for user:', userId);
  console.log('[executeContentHealthCheckFixed] Text length:', text.length);
  
  try {
    // 嘗試使用 json_object 模式（更穩定）
    console.log('[executeContentHealthCheckFixed] Calling LLM with json_object mode...');
    
    const response = await invokeLLM({
      messages: [
        { role: "system", content: HEALTH_CHECK_PROMPT },
        { role: "user", content: `請分析這篇文案：\n\n「${text}」\n\n請輸出 JSON 格式的評分結果。` }
      ],
      response_format: {
        type: "json_object",
      },
    });
    
    console.log('[executeContentHealthCheckFixed] Response received');
    console.log('[executeContentHealthCheckFixed] Choices count:', response.choices?.length);
    
    if (!response.choices || response.choices.length === 0) {
      console.error('[executeContentHealthCheckFixed] ERROR: Empty choices array');
      console.error('[executeContentHealthCheckFixed] Full response:', JSON.stringify(response, null, 2));
      throw new TRPCError({ 
        code: 'INTERNAL_SERVER_ERROR', 
        message: 'LLM API 返回空結果，請稍後重試' 
      });
    }
    
    const content = response.choices[0]?.message?.content;
    console.log('[executeContentHealthCheckFixed] Content type:', typeof content);
    
    if (!content) {
      console.error('[executeContentHealthCheckFixed] ERROR: No content in message');
      throw new TRPCError({ 
        code: 'INTERNAL_SERVER_ERROR', 
        message: '健檢結果為空' 
      });
    }
    
    if (typeof content !== 'string') {
      console.error('[executeContentHealthCheckFixed] ERROR: Content is not a string');
      throw new TRPCError({ 
        code: 'INTERNAL_SERVER_ERROR', 
        message: '健檢結果格式錯誤' 
      });
    }
    
    console.log('[executeContentHealthCheckFixed] Parsing JSON...');
    const result = JSON.parse(content);
    
    console.log('[executeContentHealthCheckFixed] Successfully parsed result');
    
    // 對結果進行髒話過濾
    if (result.redlineMarks && Array.isArray(result.redlineMarks)) {
      result.redlineMarks = result.redlineMarks.map((mark: any) => ({
        ...mark,
        suggestedText: filterProfanity(mark.suggestedText || ''),
        reason: filterProfanity(mark.reason || ''),
      }));
    }
    
    await db.logApiUsage(userId, 'contentHealthCheck', 'llm', 600, 800);
    
    return result;
  } catch (error) {
    console.error('[executeContentHealthCheckFixed] Error:', error);
    
    if (error instanceof TRPCError) {
      throw error;
    }
    
    throw new TRPCError({ 
      code: 'INTERNAL_SERVER_ERROR', 
      message: '健檢結果解析失敗：' + String(error) 
    });
  }
}
