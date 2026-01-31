/**
 * 執行完整 A/B 測試
 * 實際呼叫 LLM 生成內容，對比修改前後的效果
 */

import {
  TEST_MATERIAL,
  IP_PROFILE,
  ORIGINAL_SYSTEM_PROMPT,
  OPTIMIZED_SYSTEM_PROMPT,
  STORY_ORIGINAL_USER_PROMPT,
  STORY_OPTIMIZED_USER_PROMPT,
  VIEWPOINT_ORIGINAL_USER_PROMPT,
  VIEWPOINT_OPTIMIZED_USER_PROMPT,
  DIALOGUE_ORIGINAL_USER_PROMPT,
  DIALOGUE_OPTIMIZED_USER_PROMPT,
  DIAGNOSIS_ORIGINAL_USER_PROMPT,
  DIAGNOSIS_OPTIMIZED_USER_PROMPT,
} from './comprehensive-ab-test';

// LLM 呼叫函數
async function invokeLLM(systemPrompt: string, userPrompt: string): Promise<string> {
  const apiUrl = process.env.BUILT_IN_FORGE_API_URL || 'https://api.manus.im';
  const apiKey = process.env.BUILT_IN_FORGE_API_KEY;
  
  if (!apiKey) {
    throw new Error('BUILT_IN_FORGE_API_KEY not found');
  }
  
  const response = await fetch(`${apiUrl}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
    }),
  });
  
  if (!response.ok) {
    throw new Error(`LLM API error: ${response.status}`);
  }
  
  const data = await response.json();
  return data.choices[0].message.content;
}

// 測試配置
const TEST_CASES = [
  {
    name: '故事型',
    original: { system: ORIGINAL_SYSTEM_PROMPT, user: STORY_ORIGINAL_USER_PROMPT },
    optimized: { system: OPTIMIZED_SYSTEM_PROMPT, user: STORY_OPTIMIZED_USER_PROMPT },
  },
  {
    name: '觀點型',
    original: { system: ORIGINAL_SYSTEM_PROMPT, user: VIEWPOINT_ORIGINAL_USER_PROMPT },
    optimized: { system: OPTIMIZED_SYSTEM_PROMPT, user: VIEWPOINT_OPTIMIZED_USER_PROMPT },
  },
  {
    name: '對話型',
    original: { system: ORIGINAL_SYSTEM_PROMPT, user: DIALOGUE_ORIGINAL_USER_PROMPT },
    optimized: { system: OPTIMIZED_SYSTEM_PROMPT, user: DIALOGUE_OPTIMIZED_USER_PROMPT },
  },
  {
    name: '診斷型',
    original: { system: ORIGINAL_SYSTEM_PROMPT, user: DIAGNOSIS_ORIGINAL_USER_PROMPT },
    optimized: { system: OPTIMIZED_SYSTEM_PROMPT, user: DIAGNOSIS_OPTIMIZED_USER_PROMPT },
  },
];

// 執行測試
async function runTests() {
  console.log("=".repeat(80));
  console.log("開始執行 A/B 測試");
  console.log("=".repeat(80));
  console.log("\n【測試素材】");
  console.log(TEST_MATERIAL.story);
  console.log("\n");
  
  const results: Array<{
    name: string;
    original: string;
    optimized: string;
  }> = [];
  
  for (const testCase of TEST_CASES) {
    console.log("=".repeat(80));
    console.log(`正在測試：${testCase.name}`);
    console.log("=".repeat(80));
    
    try {
      // 測試修改前
      console.log("\n【修改前】生成中...");
      const originalResult = await invokeLLM(testCase.original.system, testCase.original.user);
      console.log("【修改前】完成");
      
      // 測試修改後
      console.log("\n【修改後】生成中...");
      const optimizedResult = await invokeLLM(testCase.optimized.system, testCase.optimized.user);
      console.log("【修改後】完成");
      
      results.push({
        name: testCase.name,
        original: originalResult,
        optimized: optimizedResult,
      });
      
      // 輸出結果
      console.log("\n" + "-".repeat(40));
      console.log(`【${testCase.name} - 修改前】`);
      console.log("-".repeat(40));
      console.log(originalResult);
      
      console.log("\n" + "-".repeat(40));
      console.log(`【${testCase.name} - 修改後】`);
      console.log("-".repeat(40));
      console.log(optimizedResult);
      
    } catch (error) {
      console.error(`測試 ${testCase.name} 失敗:`, error);
    }
    
    // 避免 rate limit
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  // 輸出完整結果
  console.log("\n\n");
  console.log("=".repeat(80));
  console.log("A/B 測試完整結果");
  console.log("=".repeat(80));
  
  for (const result of results) {
    console.log("\n" + "=".repeat(80));
    console.log(`【${result.name}】`);
    console.log("=".repeat(80));
    
    console.log("\n📌 修改前（現有系統提示詞）：");
    console.log("-".repeat(40));
    console.log(result.original);
    
    console.log("\n📌 修改後（精簡版提示詞）：");
    console.log("-".repeat(40));
    console.log(result.optimized);
    
    // AI 感分析
    console.log("\n📊 AI 感分析：");
    console.log("-".repeat(40));
    
    const originalAIPatterns = analyzeAIPatterns(result.original);
    const optimizedAIPatterns = analyzeAIPatterns(result.optimized);
    
    console.log("修改前 AI 感指標：");
    console.log(JSON.stringify(originalAIPatterns, null, 2));
    
    console.log("\n修改後 AI 感指標：");
    console.log(JSON.stringify(optimizedAIPatterns, null, 2));
  }
}

// AI 感分析函數
function analyzeAIPatterns(text: string): {
  aiWords: string[];
  formulaicOpening: boolean;
  formulaicEnding: boolean;
  excessiveEmotionWords: boolean;
  tooStructured: boolean;
  score: number;
} {
  const aiWords = [
    '親愛的', '讓我們', '一起來', '在這個', '總而言之',
    '首先', '其次', '最後', '希望對你有幫助', '加油'
  ];
  
  const foundAIWords = aiWords.filter(word => text.includes(word));
  
  // 檢查公式化開頭
  const formulaicOpenings = [
    /^[^：]+：[^：]+$/m, // 冠號斷言
    /^你有沒有/,
    /^今天想跟/,
    /^最近很多人/,
  ];
  const formulaicOpening = formulaicOpenings.some(pattern => pattern.test(text.split('\n')[0]));
  
  // 檢查公式化結尾
  const formulaicEndings = [
    /你們覺得呢？$/,
    /希望對你有幫助/,
    /加油！$/,
    /你可以的！$/,
  ];
  const formulaicEnding = formulaicEndings.some(pattern => pattern.test(text));
  
  // 檢查語氣詞過度使用
  const emotionWords = ['超', '啊', '欸', '啦', '呢', '吧'];
  const emotionCount = emotionWords.reduce((count, word) => {
    return count + (text.match(new RegExp(word, 'g')) || []).length;
  }, 0);
  const excessiveEmotionWords = emotionCount > 5;
  
  // 檢查結構是否太工整
  const paragraphs = text.split('\n\n').filter(p => p.trim());
  const avgParagraphLength = paragraphs.reduce((sum, p) => sum + p.length, 0) / paragraphs.length;
  const lengthVariance = paragraphs.reduce((sum, p) => sum + Math.pow(p.length - avgParagraphLength, 2), 0) / paragraphs.length;
  const tooStructured = lengthVariance < 100; // 變異數太小表示太工整
  
  // 計算 AI 感分數（0-100，越低越好）
  let score = 0;
  score += foundAIWords.length * 10;
  score += formulaicOpening ? 15 : 0;
  score += formulaicEnding ? 15 : 0;
  score += excessiveEmotionWords ? 10 : 0;
  score += tooStructured ? 10 : 0;
  score = Math.min(100, score);
  
  return {
    aiWords: foundAIWords,
    formulaicOpening,
    formulaicEnding,
    excessiveEmotionWords,
    tooStructured,
    score,
  };
}

// 執行
runTests().catch(console.error);
