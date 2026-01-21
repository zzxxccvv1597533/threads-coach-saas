# 50 個 IP 向量數據利用優化方案

**報告日期**：2025 年 1 月 20 日  
**報告作者**：Manus AI

---

## 一、現況分析：各環節的數據利用情況

### 目前的內容創作流程

```
選題（腦力激盪）→ 選擇類型 → 選擇開頭 → 補充資訊 → 生成全文 → AI 對話修改 → 草稿庫
```

### 各環節數據利用現況

| 環節 | 目前使用的數據 | 問題 |
|------|----------------|------|
| **1. 腦力激盪** | ✅ Embedding 語意匹配 | 只用於「參考」，沒有給出爆款潛力評分 |
| **2. 選擇類型** | ❌ 無 | 沒有告訴學員哪種類型爆款率更高 |
| **3. 選擇開頭** | ✅ Embedding 語意匹配 | 有參考爆款開頭，但沒有評分 |
| **4. 補充資訊** | ❌ 無 | 沒有根據數據建議要補充什麼 |
| **5. 生成全文** | ✅ 603 個成功因素 | 太晚了，選題已定，無法調整 |

### 核心問題

> **成功因素只在最後一步才介入，但選題已經定了，來不及調整。**

學員可能選了一個「爆款潛力低」的主題，但系統沒有在早期給出警示。

---

## 二、優化方案：在更早階段利用向量數據

### 方案總覽

```
┌─────────────────────────────────────────────────────────────────┐
│                    優化後的數據利用流程                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  【選題階段】                                                    │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ 學員輸入主題 → 即時計算「爆款潛力分數」                    │   │
│  │              → 顯示相似爆款案例                           │   │
│  │              → 建議優化方向                               │   │
│  └─────────────────────────────────────────────────────────┘   │
│                           ↓                                     │
│  【類型選擇階段】                                                │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ 根據選題 → 推薦最適合的內容類型（附爆款率）               │   │
│  │          → 顯示該類型的成功案例                          │   │
│  └─────────────────────────────────────────────────────────┘   │
│                           ↓                                     │
│  【開頭選擇階段】                                                │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ 生成開頭時 → 每個開頭附上「相似度分數」                   │   │
│  │            → 標記「最接近爆款模式」的選項                 │   │
│  └─────────────────────────────────────────────────────────┘   │
│                           ↓                                     │
│  【全文生成階段】                                                │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ 整合所有數據 → 生成符合爆款模式的內容                     │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 三、具體優化項目

### 優化 1：選題階段 - 爆款潛力即時評分

**功能描述**：學員輸入主題後，系統即時計算「爆款潛力分數」

**技術實作**：
```typescript
// 新增 API: analyzeTopicPotential
async function analyzeTopicPotential(topic: string) {
  // 1. 用 Embedding 找出相似的爆款貼文
  const similarPosts = await findSimilarViralExamples(topic, 10);
  
  // 2. 計算爆款潛力分數
  const avgSimilarity = similarPosts.reduce((sum, p) => sum + p.similarity, 0) / similarPosts.length;
  const avgLikes = similarPosts.reduce((sum, p) => sum + p.likes, 0) / similarPosts.length;
  
  // 3. 綜合評分（0-100）
  const potentialScore = Math.round(avgSimilarity * 50 + Math.min(avgLikes / 100, 50));
  
  return {
    score: potentialScore,
    level: potentialScore >= 70 ? '高' : potentialScore >= 40 ? '中' : '低',
    similarPosts: similarPosts.slice(0, 3),
    suggestions: generateSuggestions(potentialScore, similarPosts)
  };
}
```

**前端呈現**：
```
┌─────────────────────────────────────────────────────────────┐
│  你的選題：「冥想入門」                                       │
│                                                             │
│  📊 爆款潛力：72 分（高）                                    │
│                                                             │
│  💡 相似爆款案例：                                           │
│  1. 「練習冥想 3 年，我發現...」（讚 2,341）                 │
│  2. 「冥想不是放空，而是...」（讚 1,892）                    │
│  3. 「為什麼我每天只冥想 5 分鐘」（讚 1,567）                │
│                                                             │
│  ✨ 建議優化方向：                                           │
│  - 加入具體數字（如「3 年」「5 分鐘」）                      │
│  - 用反常識開頭（如「冥想不是...」）                         │
└─────────────────────────────────────────────────────────────┘
```

---

### 優化 2：類型選擇階段 - 智能類型推薦

**功能描述**：根據選題，推薦最適合的內容類型，並顯示各類型的爆款率

**技術實作**：
```typescript
// 新增 API: recommendContentType
async function recommendContentType(topic: string) {
  // 1. 找出相似主題的爆款貼文
  const similarPosts = await findSimilarViralExamples(topic, 50);
  
  // 2. 統計各類型的分佈和爆款率
  const typeStats = {};
  for (const post of similarPosts) {
    const type = post.contentType || 'unknown';
    if (!typeStats[type]) {
      typeStats[type] = { count: 0, totalLikes: 0 };
    }
    typeStats[type].count++;
    typeStats[type].totalLikes += post.likes;
  }
  
  // 3. 排序並返回推薦
  return Object.entries(typeStats)
    .map(([type, stats]) => ({
      type,
      count: stats.count,
      avgLikes: Math.round(stats.totalLikes / stats.count),
      recommendation: stats.count >= 5 ? '強烈推薦' : '可嘗試'
    }))
    .sort((a, b) => b.count - a.count);
}
```

**前端呈現**：
```
┌─────────────────────────────────────────────────────────────┐
│  根據你的選題「冥想入門」，推薦以下內容類型：                  │
│                                                             │
│  🥇 故事型（強烈推薦）                                       │
│     - 相似爆款中有 12 篇使用此類型                           │
│     - 平均讚數：1,823                                        │
│                                                             │
│  🥈 知識型（推薦）                                           │
│     - 相似爆款中有 8 篇使用此類型                            │
│     - 平均讚數：1,456                                        │
│                                                             │
│  🥉 觀點型（可嘗試）                                         │
│     - 相似爆款中有 5 篇使用此類型                            │
│     - 平均讚數：1,234                                        │
└─────────────────────────────────────────────────────────────┘
```

---

### 優化 3：開頭選擇階段 - 爆款相似度標記

**功能描述**：生成的每個開頭都附上「與爆款的相似度分數」

**技術實作**：
```typescript
// 修改 generateHooks API
async function generateHooks(topic: string, angle: string) {
  // 1. 生成 5 個開頭選項
  const hooks = await generateHooksFromLLM(topic, angle);
  
  // 2. 為每個開頭計算與爆款的相似度
  const scoredHooks = await Promise.all(
    hooks.map(async (hook) => {
      const embedding = await generateEmbedding(hook.text);
      const similarPosts = await findSimilarByEmbedding(embedding, 5);
      const avgSimilarity = similarPosts.reduce((sum, p) => sum + p.similarity, 0) / 5;
      
      return {
        ...hook,
        viralSimilarity: Math.round(avgSimilarity * 100),
        closestViral: similarPosts[0]
      };
    })
  );
  
  // 3. 標記最接近爆款的選項
  const maxSimilarity = Math.max(...scoredHooks.map(h => h.viralSimilarity));
  return scoredHooks.map(h => ({
    ...h,
    isRecommended: h.viralSimilarity === maxSimilarity
  }));
}
```

**前端呈現**：
```
┌─────────────────────────────────────────────────────────────┐
│  選擇你喜歡的開頭：                                          │
│                                                             │
│  ⭐ 開頭 1（推薦 - 爆款相似度 78%）                          │
│  「練習冥想 3 年，我發現最重要的不是技巧...」                │
│  → 最接近爆款：「練習冥想 3 年，我發現...」（讚 2,341）      │
│                                                             │
│  開頭 2（爆款相似度 65%）                                    │
│  「很多人問我怎麼開始冥想...」                               │
│                                                             │
│  開頭 3（爆款相似度 52%）                                    │
│  「冥想改變了我的人生...」                                   │
└─────────────────────────────────────────────────────────────┘
```

---

### 優化 4：選題建議 - 主動推薦高潛力主題

**功能描述**：在學員還沒輸入主題前，就主動推薦「高爆款潛力」的選題

**技術實作**：
```typescript
// 新增 API: getHighPotentialTopics
async function getHighPotentialTopics(userDomain: string) {
  // 1. 根據用戶領域，找出該領域的爆款主題
  const domainPosts = await findViralPostsByDomain(userDomain);
  
  // 2. 提取主題關鍵字
  const topics = extractTopicKeywords(domainPosts);
  
  // 3. 計算每個主題的爆款率
  const topicStats = topics.map(topic => ({
    topic,
    viralCount: domainPosts.filter(p => p.text.includes(topic)).length,
    avgLikes: calculateAvgLikes(domainPosts, topic)
  }));
  
  // 4. 返回 Top 5 高潛力主題
  return topicStats
    .sort((a, b) => b.viralCount - a.count)
    .slice(0, 5);
}
```

**前端呈現**（在 Dashboard 或發文工作室入口）：
```
┌─────────────────────────────────────────────────────────────┐
│  🔥 今日高潛力選題（根據你的領域「身心靈」）                  │
│                                                             │
│  1. 「自我覺察」相關主題                                     │
│     - 近期爆款數：15 篇                                      │
│     - 平均讚數：1,892                                        │
│     → 點擊直接開始創作                                       │
│                                                             │
│  2. 「關係療癒」相關主題                                     │
│     - 近期爆款數：12 篇                                      │
│     - 平均讚數：1,567                                        │
│     → 點擊直接開始創作                                       │
└─────────────────────────────────────────────────────────────┘
```

---

## 四、優化前後對比

### 學員體驗差異

| 階段 | 優化前 | 優化後 |
|------|--------|--------|
| **選題** | 自己想主題，不知道好不好 | 系統給爆款潛力分數，有數據依據 |
| **類型選擇** | 隨便選，不知道哪種更適合 | 系統推薦最適合的類型，附爆款率 |
| **開頭選擇** | 5 個選項，不知道選哪個 | 每個開頭有爆款相似度，推薦最佳 |
| **全文生成** | 已經太晚，無法調整選題 | 前面已經優化，全文品質更高 |

### 數據利用深度

| 數據類型 | 優化前 | 優化後 |
|----------|--------|--------|
| **Embedding 向量** | 只用於參考 | 用於評分、推薦、排序 |
| **成功因素** | 只在全文生成用 | 貫穿整個流程 |
| **爆款案例** | 只顯示文字 | 顯示讚數、相似度、類型 |

---

## 五、實作優先級

### P0（核心優化）

| 項目 | 預估時間 | 影響 |
|------|----------|------|
| 選題爆款潛力評分 | 2-3 小時 | 讓學員在最早階段就知道主題好不好 |
| 開頭爆款相似度標記 | 2-3 小時 | 幫助學員選擇最有潛力的開頭 |

### P1（增強優化）

| 項目 | 預估時間 | 影響 |
|------|----------|------|
| 類型智能推薦 | 3-4 小時 | 減少學員選擇困難 |
| 高潛力主題推薦 | 3-4 小時 | 解決「不知道發什麼」的問題 |

### P2（進階優化）

| 項目 | 預估時間 | 影響 |
|------|----------|------|
| 選題優化建議 | 2-3 小時 | 告訴學員如何調整主題更容易爆 |
| 全流程爆款預測 | 4-5 小時 | 在發文前預測爆款機率 |

---

## 六、總結

目前的問題是「數據利用太晚」，成功因素只在最後一步才介入。

優化方向是「數據前置」，在選題階段就讓學員看到：
1. 這個主題的爆款潛力有多高
2. 相似的爆款案例長什麼樣
3. 如何調整主題更容易爆

這樣學員在創作的每一步都有數據支撐，而不是最後才發現「這個主題本來就不容易爆」。

---

*報告結束*
