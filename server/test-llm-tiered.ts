/**
 * LLM 分級使用測試腳本
 * 
 * 測試方案 A（品質優先）的模型配置是否正確
 */

import { getModelForFeature, getCurrentConfigName, QUALITY_FIRST_CONFIG } from './services/llmConfig';

console.log('========================================');
console.log('🧪 LLM 分級使用測試');
console.log('========================================\n');

// 測試 1：確認當前配置
console.log('📋 測試 1：當前配置');
console.log(`當前配置方案：${getCurrentConfigName()}`);
console.log('');

// 測試 2：確認各功能使用的模型
console.log('📋 測試 2：各功能使用的模型');
const features = ['brainstorm', 'opener', 'content', 'quality_check', 'ai_chat', 'analysis'] as const;

console.log('┌─────────────────┬──────────────────────┬─────────────┐');
console.log('│ 功能            │ 模型                 │ 成本倍數    │');
console.log('├─────────────────┼──────────────────────┼─────────────┤');

for (const feature of features) {
  const config = QUALITY_FIRST_CONFIG[feature];
  const featureName = {
    brainstorm: '腦力激盪',
    opener: '開頭生成',
    content: '正文生成',
    quality_check: '品質檢查',
    ai_chat: 'AI 對話修改',
    analysis: '分析功能',
  }[feature];
  
  const model = getModelForFeature(feature);
  const costMultiplier = config.costMultiplier;
  
  console.log(`│ ${featureName.padEnd(15)} │ ${model.padEnd(20)} │ ${costMultiplier}x          │`);
}

console.log('└─────────────────┴──────────────────────┴─────────────┘');
console.log('');

// 測試 3：驗證關鍵功能使用正確的模型
console.log('📋 測試 3：驗證關鍵功能模型');

const contentModel = getModelForFeature('content');
const aiChatModel = getModelForFeature('ai_chat');
const brainstormModel = getModelForFeature('brainstorm');

const tests = [
  {
    name: '正文生成應使用 Claude Sonnet 4',
    expected: 'claude-sonnet-4',
    actual: contentModel,
    passed: contentModel === 'claude-sonnet-4',
  },
  {
    name: 'AI 對話修改應使用 Claude Sonnet 4',
    expected: 'claude-sonnet-4',
    actual: aiChatModel,
    passed: aiChatModel === 'claude-sonnet-4',
  },
  {
    name: '腦力激盪應使用 Gemini 2.5 Flash',
    expected: 'gemini-2.5-flash',
    actual: brainstormModel,
    passed: brainstormModel === 'gemini-2.5-flash',
  },
];

let allPassed = true;
for (const test of tests) {
  const status = test.passed ? '✅' : '❌';
  console.log(`${status} ${test.name}`);
  console.log(`   預期：${test.expected}`);
  console.log(`   實際：${test.actual}`);
  if (!test.passed) allPassed = false;
}

console.log('');
console.log('========================================');
console.log(allPassed ? '✅ 所有測試通過！' : '❌ 有測試失敗');
console.log('========================================');

// 輸出預估成本
console.log('\n📊 預估月度成本（100 活躍用戶）');
console.log('假設條件：');
console.log('- 每用戶每月生成 30 篇貼文');
console.log('- 每篇：1 次腦力激盪 + 5 個開頭 + 1 次正文 + 1 次品質檢查 + 2 次 AI 對話');
console.log('');
console.log('成本估算：');
console.log('- 腦力激盪：$0.30/1M tokens × 1x = 基準');
console.log('- 開頭生成：$0.30/1M tokens × 1x = 基準');
console.log('- 正文生成：$3.00/1M tokens × 6x = 關鍵升級');
console.log('- 品質檢查：$0.30/1M tokens × 1x = 基準');
console.log('- AI 對話：$3.00/1M tokens × 6x = 關鍵升級');
console.log('');
console.log('預估總成本：$85-120/月');
console.log('相比原方案（全 Flash）增加約 150-250%');
console.log('預期品質提升：25-35%');
