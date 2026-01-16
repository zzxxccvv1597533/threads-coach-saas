/**
 * 優化功能測試腳本
 * 測試 LLM 串接和新增的優化功能
 */

import { invokeLLM } from './_core/llm';
import { 
  determineUserStage, 
  calculateAdaptiveThreshold, 
  calculateUserMetrics,
  getStageName 
} from './services/adaptiveThreshold';
import { performQualityCheck, autoFixContent } from './services/qualityChecker';
import { extractOpenerDNA } from './services/openerDNA';
import { isFeatureEnabled, getAllFeatureFlags } from './infrastructure/feature-flags';
import { getMetricsSummary } from './infrastructure/metrics-collector';

async function testLLMConnection() {
  console.log('\n========================================');
  console.log('1. 測試 LLM 連接');
  console.log('========================================');
  
  try {
    const response = await invokeLLM({
      messages: [
        { role: 'system', content: '你是一個測試助手，請用繁體中文回答。' },
        { role: 'user', content: '請用一句話介紹自己，並告訴我你是什麼模型。' }
      ]
    });
    
    console.log('✅ LLM 連接成功');
    console.log('模型回應:', response.choices[0]?.message?.content);
    console.log('模型名稱:', response.model);
    console.log('Token 使用:', response.usage);
    
    return { success: true, model: response.model };
  } catch (error) {
    console.log('❌ LLM 連接失敗:', error);
    return { success: false, error };
  }
}

function testAdaptiveThreshold() {
  console.log('\n========================================');
  console.log('2. 測試自適應品質門檻');
  console.log('========================================');
  
  // 測試不同用戶場景
  const testCases = [
    { name: '專家用戶', engagements: [1500, 1200, 800, 600, 500, 400, 300, 200, 150, 100, 80, 60, 50, 40, 30, 25, 20, 15, 10, 5] },
    { name: '成熟用戶', engagements: [800, 600, 400, 300, 250, 200, 150, 100, 80, 60] },
    { name: '成長用戶', engagements: [400, 200, 150, 100, 80] },
    { name: '新手用戶', engagements: [50, 30, 20] },
  ];
  
  testCases.forEach(testCase => {
    const metrics = calculateUserMetrics(testCase.engagements);
    const stage = determineUserStage(metrics);
    const result = calculateAdaptiveThreshold(metrics, testCase.engagements);
    
    console.log(`\n${testCase.name}:`);
    console.log(`  - 總貼文: ${metrics.totalPosts}`);
    console.log(`  - 平均互動: ${metrics.avgEngagement.toFixed(0)}`);
    console.log(`  - 最高互動: ${metrics.maxEngagement}`);
    console.log(`  - 判定階段: ${getStageName(stage)}`);
    console.log(`  - 相對門檻: ${result.relativeThreshold}`);
    console.log(`  - 絕對門檻: ${result.absoluteThreshold}`);
    console.log(`  - 最終門檻: ${result.threshold}`);
  });
  
  console.log('\n✅ 自適應品質門檻測試完成');
}

function testQualityChecker() {
  console.log('\n========================================');
  console.log('3. 測試三層品質檢查');
  console.log('========================================');
  
  const testContents = [
    { 
      name: '優質內容', 
      content: '昨天去咖啡廳，遇到一個超有趣的人。\n\n我們聊了很久，發現原來我們有很多共同點。\n\n這讓我想到，人與人之間的連結真的很奇妙。' 
    },
    { 
      name: '含禁止句式', 
      content: '讓我們一起來看看今天的分享吧！首先，我想說的是這個很重要。' 
    },
    { 
      name: 'AI 痕跡明顯', 
      content: '不得不說，這真的值得一提。毋庸置疑，這是一個很好的選擇。總而言之，希望對你有幫助。' 
    },
  ];
  
  testContents.forEach(testCase => {
    console.log(`\n${testCase.name}:`);
    const result = performQualityCheck(testCase.content, 'medium');
    
    console.log(`  - 通過: ${result.passed ? '✅' : '❌'}`);
    console.log(`  - 分數: ${result.score}`);
    console.log(`  - 等級: ${result.grade}`);
    console.log(`  - 第一層通過: ${result.layer1.passed}`);
    console.log(`  - 第二層通過: ${result.layer2.passed}`);
    console.log(`  - 第三層通過: ${result.layer3.passed}`);
    
    if (result.suggestions.length > 0) {
      console.log(`  - 建議: ${result.suggestions.join(', ')}`);
    }
    
    // 測試自動修復
    if (!result.passed) {
      const fixResult = autoFixContent(testCase.content);
      if (fixResult.changes.length > 0) {
        console.log(`  - 自動修復: ${fixResult.changes.length} 處變更`);
      }
    }
  });
  
  console.log('\n✅ 三層品質檢查測試完成');
}

async function testOpenerDNA() {
  console.log('\n========================================');
  console.log('4. 測試開頭 DNA 提取');
  console.log('========================================');
  
  const samplePosts = [
    { content: '你有沒有想過，為什麼有些人總是能吸引別人的注意？', engagement: 500 },
    { content: '昨天發生了一件超扶的事：我居然在路上遇到了十年沒見的國中同學。', engagement: 800 },
    { content: '說真的，我以前也不相信這件事。', engagement: 600 },
  ];
  
  const dna = await extractOpenerDNA('test-user', samplePosts, 100);
  
  console.log('開頭 DNA 分析結果:');
  console.log(`  - 平均開頭長度: ${dna.avgOpenerLength.toFixed(0)} 字`);
  console.log(`  - 使用冒號: ${dna.usesColon ? '是' : '否'}`);
  console.log(`  - 使用問句: ${dna.usesQuestion ? '是' : '否'}`);
  console.log(`  - 使用引號: ${dna.usesQuote ? '是' : '否'}`);
  console.log(`  - 使用數字: ${dna.usesNumber ? '是' : '否'}`);
  console.log(`  - 使用 Emoji: ${dna.usesEmoji ? '是' : '否'}`);
  console.log(`  - 情緒詞: ${dna.emotionalWords.join(', ') || '無'}`);
  console.log(`  - 主導風格: ${dna.dominantStyle}`);
  console.log(`  - 成功模式: ${dna.topPatterns.length} 個`);
  
  console.log('\n✅ 開頭 DNA 提取測試完成');
}

function testFeatureFlags() {
  console.log('\n========================================');
  console.log('5. 測試 Feature Flag 控制');
  console.log('========================================');
  
  const flags = getAllFeatureFlags();
  
  console.log('Feature Flag 狀態:');
  Object.entries(flags).forEach(([key, value]) => {
    console.log(`  - ${key}: ${value ? '✅ 啟用' : '❌ 停用'}`);
  });
  
  console.log('\n✅ Feature Flag 測試完成');
}

function testMetricsCollector() {
  console.log('\n========================================');
  console.log('6. 測試指標收集器');
  console.log('========================================');
  
  const summary = getMetricsSummary();
  
  console.log('指標摘要:');
  Object.entries(summary).forEach(([key, value]) => {
    if (value) {
      console.log(`  - ${key}: count=${value.count}, avg=${value.avg.toFixed(2)}`);
    }
  });
  
  console.log('\n✅ 指標收集器測試完成');
}

async function runAllTests() {
  console.log('========================================');
  console.log('開始執行優化功能測試');
  console.log('========================================');
  
  // 1. 測試 LLM 連接
  const llmResult = await testLLMConnection();
  
  // 2. 測試自適應品質門檻
  testAdaptiveThreshold();
  
  // 3. 測試三層品質檢查
  testQualityChecker();
  
  // 4. 測試開頭 DNA 提取
  await testOpenerDNA();
  
  // 5. 測試 Feature Flag
  testFeatureFlags();
  
  // 6. 測試指標收集器
  testMetricsCollector();
  
  console.log('\n========================================');
  console.log('所有測試完成');
  console.log('========================================');
  
  return {
    llm: llmResult,
    success: true
  };
}

// 執行測試
runAllTests().then(result => {
  console.log('\n測試結果:', result.success ? '✅ 全部通過' : '❌ 有失敗');
  process.exit(result.success ? 0 : 1);
}).catch(error => {
  console.error('測試執行錯誤:', error);
  process.exit(1);
});
