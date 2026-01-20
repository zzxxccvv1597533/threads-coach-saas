/**
 * 候選生成機制
 * 
 * 功能：
 * 1. 一次生成 3-5 個候選版本
 * 2. 使用 MMR（Maximal Marginal Relevance）選擇最多樣的版本
 * 3. 為每個候選提供簡短說明
 */

import { invokeLLM } from './_core/llm';

// 候選生成配置
const CANDIDATE_CONFIG = {
  DEFAULT_COUNT: 3,      // 預設生成數量
  MAX_COUNT: 5,          // 最大生成數量
  MIN_DIVERSITY: 0.3,    // 最低多樣性分數（0-1）
};

// 候選版本
export interface ContentCandidate {
  id: string;
  content: string;
  style: string;        // 風格標籤（如：情緒型、知識型、故事型）
  opener: string;       // 開頭類型
  highlight: string;    // 亮點說明
  wordCount: number;
}

// 候選生成結果
export interface CandidateGenerationResult {
  candidates: ContentCandidate[];
  generationTime: number;
  diversityScore: number;
}

/**
 * 計算兩個文本的相似度（簡化版 Jaccard）
 */
function calculateSimilarity(text1: string, text2: string): number {
  const words1 = new Set(text1.split(/\s+/));
  const words2 = new Set(text2.split(/\s+/));
  
  let intersection = 0;
  words1.forEach(word => {
    if (words2.has(word)) intersection++;
  });
  
  const union = words1.size + words2.size - intersection;
  return union > 0 ? intersection / union : 0;
}

/**
 * 計算候選集的多樣性分數
 */
function calculateDiversityScore(candidates: ContentCandidate[]): number {
  if (candidates.length < 2) return 1;
  
  let totalSimilarity = 0;
  let comparisons = 0;
  
  for (let i = 0; i < candidates.length; i++) {
    for (let j = i + 1; j < candidates.length; j++) {
      totalSimilarity += calculateSimilarity(
        candidates[i].content, 
        candidates[j].content
      );
      comparisons++;
    }
  }
  
  const avgSimilarity = comparisons > 0 ? totalSimilarity / comparisons : 0;
  return 1 - avgSimilarity; // 多樣性 = 1 - 相似度
}

/**
 * 使用 MMR 選擇最多樣的候選
 */
function selectByMMR(
  candidates: ContentCandidate[], 
  targetCount: number,
  lambda: number = 0.5  // 平衡相關性和多樣性
): ContentCandidate[] {
  if (candidates.length <= targetCount) return candidates;
  
  const selected: ContentCandidate[] = [];
  const remaining = [...candidates];
  
  // 選擇第一個（假設按品質排序，取第一個）
  selected.push(remaining.shift()!);
  
  while (selected.length < targetCount && remaining.length > 0) {
    let bestScore = -Infinity;
    let bestIndex = 0;
    
    for (let i = 0; i < remaining.length; i++) {
      const candidate = remaining[i];
      
      // 計算與已選候選的最大相似度
      let maxSimilarity = 0;
      for (const sel of selected) {
        const sim = calculateSimilarity(candidate.content, sel.content);
        maxSimilarity = Math.max(maxSimilarity, sim);
      }
      
      // MMR 分數 = λ * 相關性 - (1-λ) * 最大相似度
      // 這裡假設相關性都相同（都是 LLM 生成的），所以只考慮多樣性
      const mmrScore = lambda * 1 - (1 - lambda) * maxSimilarity;
      
      if (mmrScore > bestScore) {
        bestScore = mmrScore;
        bestIndex = i;
      }
    }
    
    selected.push(remaining[bestIndex]);
    remaining.splice(bestIndex, 1);
  }
  
  return selected;
}

/**
 * 解析 LLM 回應中的候選版本
 */
function parseCandidates(response: string): ContentCandidate[] {
  const candidates: ContentCandidate[] = [];
  
  // 嘗試解析 JSON 格式
  try {
    const jsonMatch = response.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (Array.isArray(parsed)) {
        return parsed.map((item, index) => ({
          id: `candidate-${index + 1}`,
          content: item.content || item.text || '',
          style: item.style || '通用',
          opener: item.opener || '自然開場',
          highlight: item.highlight || item.description || '',
          wordCount: (item.content || item.text || '').length,
        }));
      }
    }
  } catch (e) {
    // JSON 解析失敗，嘗試其他格式
  }
  
  // 嘗試解析分隔符格式
  const sections = response.split(/---+|===+|\n\n\n+/);
  for (let i = 0; i < sections.length; i++) {
    const section = sections[i].trim();
    if (section.length > 50) { // 至少 50 字才算有效候選
      candidates.push({
        id: `candidate-${i + 1}`,
        content: section,
        style: '通用',
        opener: '自然開場',
        highlight: '',
        wordCount: section.length,
      });
    }
  }
  
  return candidates;
}

/**
 * 生成多個候選版本
 */
export async function generateCandidates(
  systemPrompt: string,
  userPrompt: string,
  options: {
    count?: number;
    styles?: string[];  // 指定要生成的風格
  } = {}
): Promise<CandidateGenerationResult> {
  const startTime = Date.now();
  const targetCount = Math.min(
    options.count || CANDIDATE_CONFIG.DEFAULT_COUNT,
    CANDIDATE_CONFIG.MAX_COUNT
  );
  
  // 構建候選生成提示詞
  const candidatePrompt = `${userPrompt}

---

請生成 ${targetCount} 個不同風格的版本，每個版本需要：
1. 使用不同的開頭方式
2. 有不同的情感基調
3. 結構或節奏有所變化

請以 JSON 格式回覆：
[
  {
    "content": "完整的貼文內容",
    "style": "風格標籤（如：情緒型、知識型、故事型）",
    "opener": "開頭類型（如：冒號斷言、情緒爆發、時間點）",
    "highlight": "這個版本的亮點（一句話說明）"
  },
  ...
]`;

  try {
    const response = await invokeLLM({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: candidatePrompt },
      ],
    });
    
    const content = (typeof response.choices[0]?.message?.content === 'string' 
      ? response.choices[0].message.content 
      : '') || '';
    let candidates = parseCandidates(content);
    
    // 如果解析失敗或數量不足，嘗試單獨生成
    if (candidates.length < targetCount) {
      console.log(`[CandidateGeneration] Only parsed ${candidates.length} candidates, generating more...`);
      
      // 生成額外的候選
      for (let i = candidates.length; i < targetCount; i++) {
        const additionalResponse = await invokeLLM({
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `${userPrompt}\n\n（請生成一個與以下版本不同風格的版本）\n\n已有版本：\n${candidates.map(c => c.content.substring(0, 100) + '...').join('\n\n')}` },
          ],
        });
        
        const additionalContent = (typeof additionalResponse.choices[0]?.message?.content === 'string' 
          ? additionalResponse.choices[0].message.content 
          : '') || '';
        if (additionalContent.length > 50) {
          candidates.push({
            id: `candidate-${i + 1}`,
            content: additionalContent,
            style: '通用',
            opener: '自然開場',
            highlight: '',
            wordCount: additionalContent.length,
          });
        }
      }
    }
    
    // 使用 MMR 選擇最多樣的候選
    candidates = selectByMMR(candidates, targetCount);
    
    const diversityScore = calculateDiversityScore(candidates);
    const generationTime = Date.now() - startTime;
    
    return {
      candidates,
      generationTime,
      diversityScore,
    };
  } catch (error) {
    console.error('[CandidateGeneration] Error:', error);
    throw error;
  }
}

/**
 * 快速生成單一候選（用於對話修改等場景）
 */
export async function generateSingleCandidate(
  systemPrompt: string,
  userPrompt: string
): Promise<ContentCandidate> {
  const response = await invokeLLM({
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
  });
  
  const content = (typeof response.choices[0]?.message?.content === 'string' 
      ? response.choices[0].message.content 
      : '') || '';
  
  return {
    id: 'single-candidate',
    content,
    style: '通用',
    opener: '自然開場',
    highlight: '',
    wordCount: content.length,
  };
}
