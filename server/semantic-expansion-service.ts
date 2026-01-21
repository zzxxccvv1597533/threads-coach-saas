/**
 * 語意擴展服務
 * 使用 LLM 將輸入關鍵字擴展為同義詞和相關詞彙
 * 解決字符特徵 Embedding 無法理解語意的問題
 */

import { invokeLLM } from "./_core/llm";

// 快取語意擴展結果，避免重複調用 LLM
const expansionCache = new Map<string, string[]>();
const CACHE_TTL = 1000 * 60 * 60; // 1 小時
const cacheTimestamps = new Map<string, number>();

/**
 * 使用 LLM 擴展關鍵字為同義詞和相關詞彙
 * @param keyword 輸入的關鍵字或主題
 * @returns 擴展後的詞彙陣列（包含原始關鍵字）
 */
export async function expandSemanticKeywords(keyword: string): Promise<string[]> {
  // 檢查快取
  const cached = expansionCache.get(keyword);
  const cachedTime = cacheTimestamps.get(keyword);
  if (cached && cachedTime && Date.now() - cachedTime < CACHE_TTL) {
    return cached;
  }

  try {
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `你是一個語意擴展助手。給定一個中文關鍵字或主題，請輸出 5-8 個語意相近的同義詞或相關詞彙。

規則：
1. 必須是中文詞彙
2. 包含同義詞、近義詞、相關概念
3. 考慮不同的表達方式（口語/書面語）
4. 考慮相關的子主題或延伸概念
5. 只輸出詞彙，不要解釋

輸出格式：JSON 陣列，例如：["詞彙1", "詞彙2", "詞彙3"]`
        },
        {
          role: "user",
          content: `請擴展這個關鍵字：「${keyword}」`
        }
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "keyword_expansion",
          strict: true,
          schema: {
            type: "object",
            properties: {
              keywords: {
                type: "array",
                items: { type: "string" },
                description: "擴展後的關鍵字陣列"
              }
            },
            required: ["keywords"],
            additionalProperties: false
          }
        }
      }
    });

    const content = response.choices[0]?.message?.content;
    if (!content || typeof content !== 'string') {
      return [keyword];
    }

    const parsed = JSON.parse(content);
    const expandedKeywords = [keyword, ...(parsed.keywords || [])];
    
    // 去重
    const uniqueKeywords = Array.from(new Set(expandedKeywords));
    
    // 存入快取
    expansionCache.set(keyword, uniqueKeywords);
    cacheTimestamps.set(keyword, Date.now());
    
    console.log(`[SemanticExpansion] "${keyword}" → ${uniqueKeywords.join(", ")}`);
    
    return uniqueKeywords;
  } catch (error) {
    console.error("[SemanticExpansion] LLM 調用失敗:", error);
    // 失敗時返回原始關鍵字
    return [keyword];
  }
}

/**
 * 批量擴展多個關鍵字
 */
export async function expandMultipleKeywords(keywords: string[]): Promise<Map<string, string[]>> {
  const results = new Map<string, string[]>();
  
  for (const keyword of keywords) {
    const expanded = await expandSemanticKeywords(keyword);
    results.set(keyword, expanded);
  }
  
  return results;
}

/**
 * 清除快取（用於測試或強制刷新）
 */
export function clearExpansionCache(): void {
  expansionCache.clear();
  cacheTimestamps.clear();
}

/**
 * 取得快取統計
 */
export function getCacheStats(): { size: number; keys: string[] } {
  return {
    size: expansionCache.size,
    keys: Array.from(expansionCache.keys())
  };
}
