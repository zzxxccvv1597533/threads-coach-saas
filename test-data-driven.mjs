import { selectRandomOpenerPattern, getRecommendedOpenerPatterns, extractMaterialKeywords, analyzeOpener } from './shared/opener-rules.ts';

// 測試 1: 故事型推薦的開頭模式
console.log("=== 測試 1: 故事型推薦的開頭模式 ===");
const storyPatterns = getRecommendedOpenerPatterns('story');
console.log("故事型推薦模式:", storyPatterns.map(p => `${p.name}(${p.effect}x)`).join(', '));

// 測試 2: 隨機選擇開頭模式（執行 5 次看變化）
console.log("\n=== 測試 2: 隨機選擇開頭模式（5 次） ===");
for (let i = 0; i < 5; i++) {
  const selected = selectRandomOpenerPattern('story');
  console.log(`第 ${i+1} 次: ${selected.name} (${selected.effect}x)`);
}

// 測試 3: 分析最新生成的開頭
console.log("\n=== 測試 3: 分析最新生成的開頭 ===");
const firstLine = "後來我才明白，社群經營真的不是賣東西。";
const analysis = analyzeOpener(firstLine);
console.log("開頭:", firstLine);
console.log("匹配的高效模式:", analysis.matchedHighEffect.map(p => `${p.name}(${p.effect}x)`).join(', ') || '無');
console.log("分數:", analysis.score);

// 測試 4: 素材關鍵詞提取
console.log("\n=== 測試 4: 素材關鍵詞提取 ===");
const material = "很多人問我，到底怎樣才算成功？";
const keywords = extractMaterialKeywords(material);
console.log("素材:", material);
console.log("提取的關鍵詞:", keywords.join(', ') || '無');

// 測試 5: 觀點型推薦的開頭模式（應該包含冒號斷言）
console.log("\n=== 測試 5: 觀點型推薦的開頭模式 ===");
const viewpointPatterns = getRecommendedOpenerPatterns('viewpoint');
console.log("觀點型推薦模式:", viewpointPatterns.map(p => `${p.name}(${p.effect}x)`).join(', '));

console.log("\n✅ 數據驅動功能測試完成！");
