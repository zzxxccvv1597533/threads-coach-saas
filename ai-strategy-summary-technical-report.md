# AI 策略總結技術報告

**系統名稱**：幕創行銷 Threads AI 教練  
**功能模組**：AI 策略總結（generateStrategySummary）  
**報告日期**：2024-12-26  
**作者**：Manus AI

---

## 一、功能概述

AI 策略總結是一個基於用戶歷史貼文數據的智能分析功能，透過收集戰報數據並結合 LLM（大型語言模型）生成個人化的經營策略建議。此功能旨在幫助用戶了解自己的內容表現趨勢，並獲得具體可執行的下一步行動建議。

---

## 二、數據來源

### 2.1 主要數據表

AI 策略總結從以下資料庫表格收集數據：

| 資料表 | 用途 | 關鍵欄位 |
|--------|------|----------|
| `posts` | 貼文基本資訊 | `id`, `userId`, `draftPostId`, `postedAt` |
| `post_metrics` | 貼文成效數據 | `reach`, `likes`, `comments`, `reposts`, `saves`, `postingTime`, `isViral`, `viralAnalysis`, `selfReflection` |
| `draft_posts` | 草稿內容 | `body`（用於內文預覽） |
| `ip_profiles` | 儲存分析結果 | `aiStrategySummary`, `aiStrategyUpdatedAt`, `bestPostingTime`, `viralPatterns` |

### 2.2 數據收集範圍

系統會收集用戶**最近 20 篇貼文**的數據進行分析。若貼文數量少於 5 篇，系統會返回錯誤提示，要求用戶累積更多數據後再進行分析。

---

## 三、數據處理流程

### 3.1 流程圖

```
┌─────────────────┐
│  用戶觸發分析   │
└────────┬────────┘
         ▼
┌─────────────────┐
│ 檢查貼文數量    │ ─── 少於 5 篇 ──→ 返回錯誤
└────────┬────────┘
         ▼
┌─────────────────┐
│ 收集貼文數據    │
│ (最近 20 篇)    │
└────────┬────────┘
         ▼
┌─────────────────┐
│ 獲取 metrics    │
│ 和 draft 內容   │
└────────┬────────┘
         ▼
┌─────────────────┐
│ 計算統計數據    │
│ (平均、最佳時段)│
└────────┬────────┘
         ▼
┌─────────────────┐
│ 組裝 AI Prompt  │
└────────┬────────┘
         ▼
┌─────────────────┐
│ 調用 LLM 生成   │
│ 策略總結        │
└────────┬────────┘
         ▼
┌─────────────────┐
│ 儲存到 ipProfiles│
└────────┬────────┘
         ▼
┌─────────────────┐
│ 返回結果給前端  │
└─────────────────┘
```

### 3.2 每篇貼文收集的數據

對於每一篇貼文，系統會收集以下資訊：

| 欄位 | 說明 | 數據來源 |
|------|------|----------|
| `date` | 發文日期 | `posts.postedAt` |
| `reach` | 觸及人數 | `post_metrics.reach` |
| `likes` | 愛心數 | `post_metrics.likes` |
| `comments` | 留言數 | `post_metrics.comments` |
| `reposts` | 轉發數 | `post_metrics.reposts` |
| `saves` | 收藏數 | `post_metrics.saves` |
| `postingTime` | 發文時段 | `post_metrics.postingTime` |
| `isViral` | 是否為爆文 | `post_metrics.isViral` |
| `viralAnalysis` | 爆文分析 | `post_metrics.viralAnalysis` |
| `selfReflection` | 自我反思 | `post_metrics.selfReflection` |
| `contentPreview` | 內文預覽（前 100 字） | `draft_posts.body` |

---

## 四、統計計算邏輯

### 4.1 平均觸及計算

```javascript
const totalReach = postsData.reduce((sum, p) => sum + p.reach, 0);
const avgReach = Math.round(totalReach / postsData.length);
```

**計算方式**：所有貼文觸及數總和 ÷ 貼文數量，四捨五入取整數。

### 4.2 爆文統計

```javascript
const viralPosts = postsData.filter(p => p.isViral);
```

**判定標準**：`isViral` 欄位為 `true` 的貼文。此欄位由用戶在戰報頁面手動標記，或由系統根據表現自動判定。

### 4.3 最佳發文時段計算

```javascript
const postingTimeStats = postsData.reduce((acc, p) => {
  if (p.postingTime && p.postingTime !== 'unknown') {
    acc[p.postingTime] = (acc[p.postingTime] || 0) + 1;
  }
  return acc;
}, {} as Record<string, number>);

const bestTime = Object.entries(postingTimeStats)
  .sort((a, b) => b[1] - a[1])[0]?.[0] || null;
```

**計算方式**：統計各時段的貼文數量，取出現次數最多的時段作為「最佳發文時段」。

**時段定義**：

| 時段代碼 | 對應時間 |
|----------|----------|
| `morning` | 早上（6:00-12:00） |
| `noon` | 中午（12:00-14:00） |
| `evening` | 晚上（18:00-22:00） |
| `night` | 深夜（22:00-6:00） |

---

## 五、AI 分析提示詞設計

### 5.1 System Prompt（系統提示詞）

```
你是一位 Threads 經營專家，請根據用戶的貼文數據生成個人化的策略總結。

分析需涵蓋：
1. 整體表現趨勢
2. 最佳發文時段建議
3. 內容類型建議
4. 爆文模式分析（如果有爆文數據）
5. 具體可執行的下一步建議

請用繁體中文回答，語氣要像教練一樣親切但專業。
```

### 5.2 User Prompt（用戶提示詞）

用戶提示詞會動態組裝以下資訊：

1. **統計摘要**：平均觸及、總貼文數、爆文數、最常發文時段
2. **逐篇數據**：每篇貼文的觸及、愛心、留言、時段、內文預覽
3. **額外資訊**：自我反思（如有）、爆文分析（如有）

**範例格式**：

```
以下是我最近 20 篇貼文的數據：

平均觸及：7500
總貼文數：20
爆文數：3
最常發文時段：evening

各篇貼文數據：
1. 觸及:15000 愛心:850 留言:120 🔥爆文
   時段:evening 內文預覽:3年前的我，還在廣告公司領著3萬月薪...
   自我反思:反差開頭效果很好，下次可以多用
   爆文分析:這篇爆文成功的原因：1. 開頭用「3年前」製造時間對比...

2. 觸及:8000 愛心:420 留言:65
   時段:evening 內文預覽:研究了100篇爆款貼文後...

...

請生成策略總結（300-500字）
```

---

## 六、輸出結果

### 6.1 API 返回結構

```typescript
{
  success: boolean;       // 是否成功
  error: string | null;   // 錯誤訊息
  summary: string | null; // AI 生成的策略總結
  stats: {
    totalPosts: number;      // 分析的貼文數量
    avgReach: number;        // 平均觸及
    viralCount: number;      // 爆文數量
    bestPostingTime: string; // 最佳發文時段
  };
}
```

### 6.2 資料庫儲存

分析結果會儲存到 `ip_profiles` 表：

| 欄位 | 說明 |
|------|------|
| `aiStrategySummary` | AI 生成的策略總結全文 |
| `aiStrategyUpdatedAt` | 最後更新時間 |
| `bestPostingTime` | 最佳發文時段 |
| `viralPatterns` | 爆文模式（多篇爆文分析以 `---` 分隔） |

---

## 七、評斷依據總結

### 7.1 數據驅動的評斷

| 評斷項目 | 數據來源 | 計算方式 |
|----------|----------|----------|
| 整體表現 | `reach`, `likes`, `comments` | 平均值計算 |
| 最佳時段 | `postingTime` | 頻率統計 |
| 爆文模式 | `isViral`, `viralAnalysis` | 篩選 + 彙整 |
| 內容特徵 | `contentPreview` | 文本分析 |
| 改進方向 | `selfReflection` | 用戶輸入 |

### 7.2 AI 分析的評斷維度

AI 會根據以下維度進行分析：

1. **趨勢分析**：比較各篇貼文的觸及變化，判斷是上升、下降還是持平
2. **時段效益**：根據各時段貼文的平均表現，建議最佳發文時間
3. **內容類型**：根據爆文的內文特徵，歸納成功的內容模式
4. **行動建議**：基於數據缺口和改進空間，提供具體可執行的建議

---

## 八、系統限制與注意事項

### 8.1 數據限制

- **最少需要 5 篇貼文**才能進行分析
- **最多分析 20 篇**最近的貼文
- 若 `postingTime` 為空或 `unknown`，該貼文不計入時段統計

### 8.2 準確性說明

- 「最佳發文時段」是基於**發文頻率**而非**表現最佳**的時段
- 爆文標記依賴用戶手動標記或系統自動判定
- AI 生成的建議為參考性質，實際效果因人而異

### 8.3 改進建議

若要提升分析準確度，建議：

1. **累積更多數據**：至少 20 篇以上的貼文數據
2. **完整填寫戰報**：包含發文時段、自我反思等欄位
3. **標記爆文**：手動標記表現特別好的貼文，觸發 AI 分析爆文原因

---

## 九、技術實作細節

### 9.1 API 端點

```
POST /api/trpc/post.generateStrategySummary
```

### 9.2 權限要求

- 需要用戶登入（`protectedProcedure`）
- 只能分析自己的貼文數據

### 9.3 相關檔案

| 檔案路徑 | 說明 |
|----------|------|
| `server/routers.ts` | API 定義（第 3492-3619 行） |
| `server/db.ts` | 資料庫查詢函數 |
| `drizzle/schema.ts` | 資料表定義 |
| `client/src/pages/Reports.tsx` | 前端 UI |

---

## 十、結論

AI 策略總結功能透過收集用戶最近 20 篇貼文的成效數據，計算平均觸及、爆文數量、最佳發文時段等統計指標，再將這些數據組裝成結構化的提示詞送給 LLM 進行分析。最終產出的策略總結包含整體表現趨勢、時段建議、內容類型建議、爆文模式分析和具體行動建議五大面向。

此功能的核心價值在於將分散的戰報數據整合成可操作的策略建議，幫助用戶從「數據收集」進階到「策略執行」，形成完整的內容經營閉環。
