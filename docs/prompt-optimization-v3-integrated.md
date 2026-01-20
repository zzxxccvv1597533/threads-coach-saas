# 提示詞優化完整指南 v3.0（整合版）

**版本**：v3.0  
**日期**：2025-01-20  
**作者**：Manus AI  
**狀態**：整合補充建議後的最終版本

---

## 執行摘要

你提供的補充建議**完全可行**，且與原有方案高度互補。以下是整合分析：

| 補充建議 | 可行性 | 技術難度 | 優先級 | 說明 |
|----------|--------|----------|--------|------|
| 1. Embedding 取代 n-gram | ✅ 可行 | 中 | P0 | 語義層面更準確 |
| 2. 候選生成 + MMR 排序 | ✅ 可行 | 中高 | P1 | 需要前端配合 |
| 3. stylePolish 語意驗證 | ✅ 可行 | 中 | P0 | 關鍵品質保障 |
| 4. Few-Shot 品質閘 | ✅ 可行 | 低 | P1 | 簡單實作 |
| 5. 動態模型路由 | ✅ 可行 | 低 | P2 | 已有基礎架構 |
| 6. 前端 UX 改進 | ✅ 可行 | 中高 | P1 | 提升用戶控制感 |
| 7. 監控對齊 Threads 訊號 | ✅ 可行 | 低 | P1 | 擴展現有 Dashboard |
| 8. A/B 統計設計 | ✅ 可行 | 中 | P2 | 需要數據基礎 |
| 9. 風險與合規 | ✅ 可行 | 低 | P2 | 政策層面 |

---

## 一、原方案 vs 補充建議對照

### 1.1 同質性檢查（Post-check）

| 項目 | 原方案 | 補充建議 | 整合後 |
|------|--------|----------|--------|
| **演算法** | n-gram 相似度 | Embedding + Cosine Similarity | ✅ 採用 Embedding |
| **比對對象** | 用戶最近 10 篇 + 爆款範例 | 同上 + 向量 DB 查詢 | ✅ 採用向量 DB |
| **評分維度** | 單一相似度閾值 | 多維度評分（α, β, γ, δ） | ✅ 採用多維度 |
| **多樣性保證** | 無 | MMR 重排序 | ✅ 採用 MMR |
| **閾值** | 60% | 建議 40% | ⚠️ 需 A/B 測試確定 |

**整合後程式碼**：

```typescript
// 整合版：Embedding + 多維度評分 + MMR
async function checkOpenerHomogeneityV2(
  newOpener: string,
  userId: number,
  contentType: string
): Promise<{
  isHomogeneous: boolean;
  score: number;
  breakdown: {
    userSimilarity: number;
    viralSimilarity: number;
    noveltyScore: number;
    styleMatchScore: number;
  };
  suggestedAction: 'accept' | 'retry' | 'show_alternatives';
}> {
  // 1. 取得新開頭的 embedding
  const newEmbedding = await getEmbedding(newOpener);
  
  // 2. 從向量 DB 查詢用戶最近開頭
  const userRecentEmbeddings = await vectorDB.query({
    userId,
    contentType,
    limit: 10,
    collection: 'user_openers'
  });
  const userSims = userRecentEmbeddings.map(e => cosineSimilarity(newEmbedding, e.vector));
  const maxUserSim = Math.max(...userSims, 0);
  
  // 3. 從向量 DB 查詢爆款開頭
  const viralEmbeddings = await vectorDB.query({
    collection: 'viral_openers',
    limit: 20
  });
  const viralSims = viralEmbeddings.map(e => cosineSimilarity(newEmbedding, e.vector));
  const maxViralSim = Math.max(...viralSims, 0);
  
  // 4. 計算新穎度
  const noveltyScore = 1 - Math.max(maxUserSim, maxViralSim);
  
  // 5. 計算風格匹配度（可選，使用輕量模型）
  const styleMatchScore = await quickStyleMatch(newOpener, userId);
  
  // 6. 多維度綜合評分
  const weights = { α: 0.3, β: 0.2, γ: 0.3, δ: 0.2 };
  const score = 
    weights.α * (1 - maxUserSim) +
    weights.β * (1 - maxViralSim) +
    weights.γ * noveltyScore +
    weights.δ * styleMatchScore;
  
  // 7. 判斷結果
  let suggestedAction: 'accept' | 'retry' | 'show_alternatives';
  if (score >= 0.6) {
    suggestedAction = 'accept';
  } else if (score >= 0.4) {
    suggestedAction = 'show_alternatives';
  } else {
    suggestedAction = 'retry';
  }
  
  return {
    isHomogeneous: score < 0.4,
    score,
    breakdown: {
      userSimilarity: maxUserSim,
      viralSimilarity: maxViralSim,
      noveltyScore,
      styleMatchScore
    },
    suggestedAction
  };
}
```

---

### 1.2 候選生成與選擇流程

| 項目 | 原方案 | 補充建議 | 整合後 |
|------|--------|----------|--------|
| **生成方式** | 逐次生成 + 重試 | 一次生成 3-5 候選 | ✅ 一次生成 5 候選 |
| **評分方式** | 無 | 自評 + 排序 | ✅ 採用 |
| **前端展示** | 只顯示最終結果 | 顯示 3 候選 + 解釋 | ✅ 採用 |
| **用戶控制** | 無 | 一鍵採用 / 微調 | ✅ 採用 |

**整合後流程**：

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    候選生成與選擇流程 v2.0                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Step 1: 一次生成 5 候選                                                 │
│  ────────────────────────                                               │
│  LLM 指令：「請輸出 5 種不同開頭，每種依據不同公式」                       │
│                                                                         │
│  Step 2: 計算候選 Embeddings                                            │
│  ────────────────────────                                               │
│  對每個候選取得 embedding 向量                                           │
│                                                                         │
│  Step 3: MMR 重排序                                                     │
│  ────────────────────────                                               │
│  使用 Maximal Marginal Relevance 選出最多樣的 top-3                      │
│  MMR = λ * Relevance(d) - (1-λ) * max(Similarity(d, selected))          │
│                                                                         │
│  Step 4: 自評打分                                                        │
│  ────────────────────────                                               │
│  對 top-3 候選計算：                                                     │
│  - styleMatchScore（風格匹配度）                                         │
│  - noveltyScore（新穎度）                                                │
│  - engagementPredictor（互動預測，可選）                                  │
│                                                                         │
│  Step 5: 前端展示                                                        │
│  ────────────────────────                                               │
│  顯示 3 候選，每個旁邊標示：                                              │
│  - 推薦原因（「新穎度高」「符合你的風格」）                                │
│  - 分數（可選）                                                          │
│  - 一鍵採用按鈕                                                          │
│  - 微調按鈕（「更口語」「更創新」）                                        │
│                                                                         │
│  Step 6: 用戶選擇                                                        │
│  ────────────────────────                                               │
│  用戶可以：                                                              │
│  - 直接採用某個候選                                                      │
│  - 要求微調（發送微指令給後端）                                           │
│  - 要求重新生成                                                          │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

**前端 UI 設計**：

```tsx
// 候選展示組件
function OpenerCandidates({ candidates, onSelect, onRefine }) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">選擇開頭</h3>
      <p className="text-sm text-muted-foreground">
        AI 根據你的素材生成了 3 種不同風格的開頭，選擇最適合的：
      </p>
      
      {candidates.map((candidate, index) => (
        <Card key={index} className="p-4">
          <div className="flex justify-between items-start">
            <div className="flex-1">
              <p className="font-medium">{candidate.opener}</p>
              <div className="flex gap-2 mt-2">
                <Badge variant="outline">
                  {candidate.formula}
                </Badge>
                <Badge variant="secondary">
                  新穎度 {Math.round(candidate.noveltyScore * 100)}%
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {candidate.reason}
              </p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => onSelect(candidate)}>
                採用
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="outline">微調</Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => onRefine(candidate, 'more_casual')}>
                    更口語
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onRefine(candidate, 'more_creative')}>
                    更創新
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onRefine(candidate, 'more_catchphrase')}>
                    多用口頭禪
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </Card>
      ))}
      
      <Button variant="ghost" className="w-full">
        重新生成
      </Button>
    </div>
  );
}
```

---

### 1.3 stylePolish 驗證強化

| 項目 | 原方案 | 補充建議 | 整合後 |
|------|--------|----------|--------|
| **字數檢查** | ±10% | 同上 | ✅ 保留 |
| **段落數檢查** | ±1 段 | 同上 | ✅ 保留 |
| **語意保真** | 無 | Embedding 距離檢測 | ✅ 新增 |
| **新觀點檢測** | 可選 LLM | 必須 LLM 驗證 | ✅ 升級為必須 |
| **情緒/立場檢測** | 無 | 情緒詞典或 LLM | ✅ 新增 |
| **人工抽檢** | 無 | needs_review 標記 | ✅ 新增 |

**整合後驗證函數**：

```typescript
async function validateStylePolishV2(
  original: string,
  polished: string,
  options?: { strictMode?: boolean }
): Promise<{
  passed: boolean;
  confidence: 'high' | 'medium' | 'low';
  checks: {
    lengthCheck: { passed: boolean; diff: number };
    paragraphCheck: { passed: boolean; diff: number };
    semanticCheck: { passed: boolean; distance: number };
    newViewpointCheck: { passed: boolean; evidence?: string };
    sentimentCheck: { passed: boolean; originalSentiment: string; polishedSentiment: string };
  };
  needsReview: boolean;
  reason?: string;
}> {
  const checks = {
    lengthCheck: { passed: true, diff: 0 },
    paragraphCheck: { passed: true, diff: 0 },
    semanticCheck: { passed: true, distance: 0 },
    newViewpointCheck: { passed: true, evidence: undefined as string | undefined },
    sentimentCheck: { passed: true, originalSentiment: '', polishedSentiment: '' }
  };
  
  // 1. 字數檢查（±10%）
  const lengthDiff = Math.abs(polished.length - original.length) / original.length;
  checks.lengthCheck = { passed: lengthDiff <= 0.1, diff: lengthDiff };
  
  // 2. 段落數檢查
  const originalParagraphs = original.split(/\n\n+/).length;
  const polishedParagraphs = polished.split(/\n\n+/).length;
  const paragraphDiff = Math.abs(polishedParagraphs - originalParagraphs);
  checks.paragraphCheck = { passed: paragraphDiff <= 1, diff: paragraphDiff };
  
  // 3. 語意保真檢測（Embedding 距離）
  const [originalEmb, polishedEmb] = await Promise.all([
    getEmbedding(original),
    getEmbedding(polished)
  ]);
  const semanticDistance = 1 - cosineSimilarity(originalEmb, polishedEmb);
  checks.semanticCheck = { 
    passed: semanticDistance <= 0.15, // 閾值：15% 語意偏移
    distance: semanticDistance 
  };
  
  // 4. 新觀點檢測（LLM 驗證）
  const viewpointCheckResponse = await invokeLLM({
    messages: [
      { 
        role: "system", 
        content: `你是一個嚴格的文本審核員。
請判斷「潤飾後文本」是否引入了「原文」沒有的觀點、結論或事實。
只回答 JSON 格式：{"hasNewViewpoint": true/false, "evidence": "具體證據或空字串"}`
      },
      { 
        role: "user", 
        content: `原文：\n${original}\n\n潤飾後：\n${polished}` 
      }
    ],
    response_format: { type: "json_object" }
  });
  
  try {
    const viewpointResult = JSON.parse(viewpointCheckResponse.choices[0]?.message?.content || '{}');
    checks.newViewpointCheck = {
      passed: !viewpointResult.hasNewViewpoint,
      evidence: viewpointResult.evidence || undefined
    };
  } catch {
    checks.newViewpointCheck = { passed: true, evidence: undefined };
  }
  
  // 5. 情緒/立場檢測
  const sentimentCheck = await checkSentimentConsistency(original, polished);
  checks.sentimentCheck = sentimentCheck;
  
  // 6. 綜合判斷
  const allPassed = Object.values(checks).every(c => c.passed);
  const failedCount = Object.values(checks).filter(c => !c.passed).length;
  
  let confidence: 'high' | 'medium' | 'low';
  if (allPassed) {
    confidence = 'high';
  } else if (failedCount === 1) {
    confidence = 'medium';
  } else {
    confidence = 'low';
  }
  
  // 7. 是否需要人工審核
  const needsReview = !allPassed && (
    !checks.semanticCheck.passed ||
    !checks.newViewpointCheck.passed ||
    !checks.sentimentCheck.passed
  );
  
  return {
    passed: allPassed || (confidence === 'medium' && !options?.strictMode),
    confidence,
    checks,
    needsReview,
    reason: allPassed ? undefined : getFailureReason(checks)
  };
}

async function checkSentimentConsistency(
  original: string,
  polished: string
): Promise<{ passed: boolean; originalSentiment: string; polishedSentiment: string }> {
  // 使用情緒詞典或 LLM 檢測
  const response = await invokeLLM({
    messages: [
      {
        role: "system",
        content: `分析兩段文字的情緒基調，回答 JSON：
{"original": "正面/負面/中性", "polished": "正面/負面/中性", "consistent": true/false}`
      },
      {
        role: "user",
        content: `原文：${original.substring(0, 200)}\n\n潤飾後：${polished.substring(0, 200)}`
      }
    ],
    response_format: { type: "json_object" }
  });
  
  try {
    const result = JSON.parse(response.choices[0]?.message?.content || '{}');
    return {
      passed: result.consistent !== false,
      originalSentiment: result.original || '未知',
      polishedSentiment: result.polished || '未知'
    };
  } catch {
    return { passed: true, originalSentiment: '未知', polishedSentiment: '未知' };
  }
}
```

---

### 1.4 Few-Shot 品質閘

| 項目 | 原方案 | 補充建議 | 整合後 |
|------|--------|----------|--------|
| **範例數量** | 1-2 個 | 同上 | ✅ 保留 |
| **品質過濾** | 無 | likes/engagement > X | ✅ 新增 |
| **主題匹配** | 無 | 字數和主題匹配 | ✅ 新增 |
| **來源標注** | 無 | 標注第三方來源 | ✅ 新增 |

**整合後程式碼**：

```typescript
interface QualifiedSample {
  content: string;
  likes: number;
  source: 'user' | 'system';
  sourceUrl?: string; // 第三方來源標注
  matchScore: number; // 主題匹配度
}

async function getQualifiedFewShotSamples(
  userId: number,
  contentType: string,
  targetTopic?: string
): Promise<QualifiedSample[]> {
  // 1. 取得用戶的爆款貼文
  const userStyle = await db.getUserWritingStyle(userId);
  const userSamples = (userStyle?.samplePosts as Array<{
    content: string;
    likes?: number;
    source?: string;
  }>) || [];
  
  // 2. 品質閘：過濾低互動的樣本
  const QUALITY_THRESHOLD = {
    minLikes: 50,
    minLength: 100,
    maxLength: 500
  };
  
  const qualifiedUserSamples = userSamples
    .filter(s => {
      const likes = s.likes || 0;
      const length = s.content.length;
      return (
        likes >= QUALITY_THRESHOLD.minLikes &&
        length >= QUALITY_THRESHOLD.minLength &&
        length <= QUALITY_THRESHOLD.maxLength
      );
    })
    .map(s => ({
      content: s.content,
      likes: s.likes || 0,
      source: 'user' as const,
      matchScore: 1.0 // 用戶自己的樣本預設高匹配度
    }));
  
  // 3. 主題匹配（如果有目標主題）
  if (targetTopic && qualifiedUserSamples.length > 0) {
    const topicEmbedding = await getEmbedding(targetTopic);
    for (const sample of qualifiedUserSamples) {
      const sampleEmbedding = await getEmbedding(sample.content.substring(0, 100));
      sample.matchScore = cosineSimilarity(topicEmbedding, sampleEmbedding);
    }
    qualifiedUserSamples.sort((a, b) => b.matchScore - a.matchScore);
  }
  
  // 4. 如果用戶樣本不足，補充系統範例
  if (qualifiedUserSamples.length < 2) {
    const systemSamples = await db.getSmartViralExamples({
      contentType,
      keyword: targetTopic,
      totalCount: 2 - qualifiedUserSamples.length,
      minLikes: 100
    });
    
    const qualifiedSystemSamples = systemSamples.map(s => ({
      content: s.postText,
      likes: s.likes,
      source: 'system' as const,
      sourceUrl: s.sourceUrl, // 標注來源
      matchScore: 0.8 // 系統範例預設較低匹配度
    }));
    
    return [...qualifiedUserSamples, ...qualifiedSystemSamples].slice(0, 2);
  }
  
  return qualifiedUserSamples.slice(0, 2);
}
```

---

### 1.5 動態模型路由

| 項目 | 原方案 | 補充建議 | 整合後 |
|------|--------|----------|--------|
| **模型選擇** | 固定模型 | 依任務複雜度選模型 | ✅ 採用 |
| **預先打分** | 無 | 小模型做快速 scoring | ✅ 採用 |

**整合後程式碼**：

```typescript
type TaskType = 
  | 'scoring'           // 打分、評估
  | 'short_edit'        // 短文編輯、微調
  | 'style_polish'      // 風格潤飾
  | 'draft_generation'  // 草稿生成
  | 'complex_rewrite';  // 複雜改寫

function getModelForTask(taskType: TaskType): {
  model: string;
  maxTokens: number;
  temperature: number;
} {
  const modelConfigs = {
    // 輕量任務：使用較便宜的模型
    scoring: {
      model: 'gpt-4o-mini', // 或其他輕量模型
      maxTokens: 500,
      temperature: 0.3
    },
    short_edit: {
      model: 'gpt-4o-mini',
      maxTokens: 1000,
      temperature: 0.5
    },
    
    // 中等任務：使用標準模型
    style_polish: {
      model: 'gpt-4o',
      maxTokens: 2000,
      temperature: 0.7
    },
    
    // 複雜任務：使用最強模型
    draft_generation: {
      model: 'claude-sonnet-4-20250514',
      maxTokens: 4000,
      temperature: 0.8
    },
    complex_rewrite: {
      model: 'claude-sonnet-4-20250514',
      maxTokens: 4000,
      temperature: 0.8
    }
  };
  
  return modelConfigs[taskType];
}

// 使用範例
async function generateCandidatesWithSmartRouting(
  material: string,
  contentType: string
): Promise<Candidate[]> {
  // 1. 使用大模型生成 5 候選
  const generationConfig = getModelForTask('draft_generation');
  const candidates = await generateCandidates(material, contentType, generationConfig);
  
  // 2. 使用小模型做快速打分
  const scoringConfig = getModelForTask('scoring');
  const scoredCandidates = await Promise.all(
    candidates.map(async (c) => ({
      ...c,
      scores: await quickScore(c.opener, scoringConfig)
    }))
  );
  
  // 3. 只對 top-3 做詳細評估（節省成本）
  const top3 = scoredCandidates
    .sort((a, b) => b.scores.total - a.scores.total)
    .slice(0, 3);
  
  return top3;
}
```

---

### 1.6 前端 UX 改進

| 項目 | 原方案 | 補充建議 | 整合後 |
|------|--------|----------|--------|
| **候選預覽** | 無 | 顯示 3 候選 + 解釋 | ✅ 採用 |
| **微調控件** | 無 | 快速按鈕 | ✅ 採用 |
| **Diff 顯示** | 無 | 高亮改動處 | ✅ 採用 |
| **偏好儲存** | 無 | 保守/中性/創新 | ✅ 採用 |

**stylePolish Diff 顯示組件**：

```tsx
import { diffWords } from 'diff';

function StylePolishDiff({ original, polished, onAccept, onReject, onPartialAccept }) {
  const diff = diffWords(original, polished);
  
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">潤飾結果</h3>
      
      {/* Diff 顯示 */}
      <div className="p-4 bg-muted rounded-lg font-mono text-sm leading-relaxed">
        {diff.map((part, index) => {
          if (part.added) {
            return (
              <span key={index} className="bg-green-200 text-green-800">
                {part.value}
              </span>
            );
          }
          if (part.removed) {
            return (
              <span key={index} className="bg-red-200 text-red-800 line-through">
                {part.value}
              </span>
            );
          }
          return <span key={index}>{part.value}</span>;
        })}
      </div>
      
      {/* 統計 */}
      <div className="flex gap-4 text-sm text-muted-foreground">
        <span>新增：{diff.filter(d => d.added).length} 處</span>
        <span>刪除：{diff.filter(d => d.removed).length} 處</span>
        <span>字數變化：{polished.length - original.length}</span>
      </div>
      
      {/* 操作按鈕 */}
      <div className="flex gap-2">
        <Button onClick={() => onAccept(polished)}>
          接受全部
        </Button>
        <Button variant="outline" onClick={onPartialAccept}>
          接受部分
        </Button>
        <Button variant="ghost" onClick={onReject}>
          回退原文
        </Button>
      </div>
    </div>
  );
}
```

**用戶偏好設定**：

```tsx
function UserPreferenceSettings({ userId, onSave }) {
  const [preferences, setPreferences] = useState({
    creativityLevel: 'balanced', // 'conservative' | 'balanced' | 'creative'
    catchphraseFrequency: 'moderate', // 'rare' | 'moderate' | 'frequent'
    openerStyle: 'varied', // 'consistent' | 'varied'
  });
  
  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold">內容生成偏好</h3>
      
      {/* 創意程度 */}
      <div>
        <Label>創意程度</Label>
        <RadioGroup 
          value={preferences.creativityLevel}
          onValueChange={(v) => setPreferences(p => ({ ...p, creativityLevel: v }))}
        >
          <div className="flex gap-4">
            <RadioGroupItem value="conservative" id="conservative" />
            <Label htmlFor="conservative">保守（穩定風格）</Label>
            
            <RadioGroupItem value="balanced" id="balanced" />
            <Label htmlFor="balanced">平衡（推薦）</Label>
            
            <RadioGroupItem value="creative" id="creative" />
            <Label htmlFor="creative">創新（嘗試新風格）</Label>
          </div>
        </RadioGroup>
      </div>
      
      {/* 口頭禪頻率 */}
      <div>
        <Label>口頭禪使用頻率</Label>
        <Slider
          value={[preferences.catchphraseFrequency === 'rare' ? 0 : 
                  preferences.catchphraseFrequency === 'moderate' ? 50 : 100]}
          onValueChange={([v]) => {
            const freq = v < 33 ? 'rare' : v < 66 ? 'moderate' : 'frequent';
            setPreferences(p => ({ ...p, catchphraseFrequency: freq }));
          }}
          max={100}
          step={1}
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>少用</span>
          <span>適中</span>
          <span>多用</span>
        </div>
      </div>
      
      <Button onClick={() => onSave(preferences)}>儲存偏好</Button>
    </div>
  );
}
```

---

### 1.7 監控對齊 Threads 訊號

| Threads 訊號 | 對應指標 | 監控方式 |
|--------------|----------|----------|
| **點擊可能性** | CTR、Time-on-Post | 追蹤連結點擊、停留時間 |
| **按讚可能性** | Likes/Comments/Shares | 7 日內互動統計 |
| **秒滑率** | 1s Bounce Rate、Read Depth | 追蹤滾動行為 |
| **Profile Visit** | Profile Click Rate | 追蹤個人頁點擊 |

**系統內部指標**：

| 指標 | 計算方式 | 目標 |
|------|----------|------|
| **styleMatch** | 風格匹配評分 | ≥ 70 分 |
| **homogeneity** | 開頭同質性比例 | < 30% |
| **tokens** | 平均 tokens 消耗 | ↓ 30% |
| **stylePolish pass %** | 自動驗證通過率 | ≥ 90% |
| **opener novelty** | Embedding 距離 | ≥ 0.4 |
| **candidate diversity** | MMR 分數 | ≥ 0.6 |
| **user acceptance** | 候選採用率 | ≥ 70% |

---

## 二、整合後的落地優先順序

| 優先級 | 項目 | 預估時間 | 依賴 |
|--------|------|----------|------|
| **P0-1** | Embedding 取代 n-gram | 2 天 | 向量 DB 設置 |
| **P0-2** | stylePolish 語意驗證 | 2 天 | 無 |
| **P0-3** | 開頭「必須」改為「推薦」 | 1 天 | 無 |
| **P1-1** | 候選生成 + MMR 排序 | 3 天 | P0-1 |
| **P1-2** | 前端候選預覽 + Diff 顯示 | 3 天 | P1-1 |
| **P1-3** | Few-Shot 品質閘 | 1 天 | 無 |
| **P1-4** | 監控 Dashboard 擴展 | 2 天 | 無 |
| **P2-1** | 動態模型路由 | 1 天 | 無 |
| **P2-2** | 用戶偏好設定 | 2 天 | 無 |
| **P2-3** | A/B 測試框架 | 3 天 | 無 |
| **P2-4** | 人工抽檢流程 | 2 天 | 無 |

**總預估時間**：約 22 天（可並行部分項目）

---

## 三、風險評估與緩解

| 風險 | 可能性 | 影響 | 緩解措施 |
|------|--------|------|----------|
| Embedding API 成本增加 | 高 | 中 | 批量處理、快取、使用較便宜的 embedding 模型 |
| 向量 DB 設置複雜 | 中 | 中 | 使用 Pinecone/Weaviate 等託管服務 |
| 候選生成延遲增加 | 中 | 中 | 並行處理、快取熱門開頭 |
| 用戶不習慣多候選選擇 | 中 | 低 | 提供「自動選擇最佳」選項 |
| LLM 驗證成本增加 | 中 | 中 | 只對可疑結果做 LLM 驗證 |

---

## 四、結論

你提供的補充建議**全部可行**，且與原方案高度互補。整合後的方案具有以下優勢：

1. **更精準的同質性檢測**：Embedding + 多維度評分比 n-gram 更能識別語義相似
2. **更好的用戶控制**：候選預覽 + 微調控件讓用戶有主導權
3. **更嚴格的品質保障**：語意驗證 + 新觀點檢測確保「不改原意」
4. **更低的成本**：動態模型路由 + 批量處理優化成本
5. **更完整的監控**：對齊 Threads 四大訊號，數據驅動迭代

**建議下一步**：

1. 先實作 P0 項目（Embedding、stylePolish 驗證、開頭推薦）
2. 設置向量 DB（Pinecone 或 Weaviate）
3. 建立 A/B 測試框架，準備漸進放量
