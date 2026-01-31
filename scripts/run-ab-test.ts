/**
 * 執行 A/B 測試
 */

import { MATERIAL, PROMPT_VERSION_A, PROMPT_VERSION_B, PROMPT_VERSION_C } from './ab-test-prompts';

const FORGE_API_URL = process.env.BUILT_IN_FORGE_API_URL;
const FORGE_API_KEY = process.env.BUILT_IN_FORGE_API_KEY;

async function invokeLLM(systemPrompt: string, userPrompt: string): Promise<string> {
  const response = await fetch(`${FORGE_API_URL}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${FORGE_API_KEY}`
    },
    body: JSON.stringify({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.7
    })
  });
  
  const data = await response.json();
  return data.choices[0].message.content;
}

async function runTest() {
  console.log('='.repeat(60));
  console.log('A/B 測試：提示詞優化效果驗證');
  console.log('='.repeat(60));
  console.log('\n素材：', MATERIAL);
  console.log('\n');
  
  // 版本 A：現有系統提示詞
  console.log('【版本 A】現有系統提示詞（約 2,500 字）');
  console.log('-'.repeat(60));
  const resultA = await invokeLLM(PROMPT_VERSION_A, `素材：${MATERIAL}\n\n請根據上述素材，寫一篇觀點型貼文。`);
  console.log(resultA);
  console.log('\n');
  
  // 版本 B：精簡提示詞
  console.log('【版本 B】精簡提示詞（約 400 字）');
  console.log('-'.repeat(60));
  const resultB = await invokeLLM(PROMPT_VERSION_B, `素材：${MATERIAL}`);
  console.log(resultB);
  console.log('\n');
  
  // 版本 C：極簡提示詞
  console.log('【版本 C】極簡提示詞（約 100 字）');
  console.log('-'.repeat(60));
  const resultC = await invokeLLM(PROMPT_VERSION_C, MATERIAL);
  console.log(resultC);
  console.log('\n');
  
  console.log('='.repeat(60));
  console.log('測試完成，請比較三個版本的 AI 感差異');
  console.log('='.repeat(60));
}

runTest().catch(console.error);
