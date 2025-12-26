# 幕創行銷 Threads AI 教練系統分析報告

**報告日期**：2024 年 12 月 26 日  
**報告作者**：Manus AI  
**報告版本**：v1.0

---

## 一、報告摘要

本報告針對幕創行銷 Threads AI 教練系統進行全面檢查，聚焦於以下四個核心問題：

1. **經營數據同步機制**：LINE 連結與產品設定是否能從 IP 地基自動抓取
2. **LINE 官方連結欄位**：IP 地基是否有可輸入 LINE 連結的欄位
3. **戰報策略總結功能**：「生成策略總結」按鈕是否已在前端實作
4. **文案健檢 diff 比對 UI**：原文與建議改寫為何沒有顯示內容

經檢查發現，系統存在多項資料流斷層與前端實作缺失的問題，以下將詳細說明現況、問題根因及建議修復方案。

---

## 二、問題一：經營數據同步機制

### 2.1 現況分析

目前系統中有兩個獨立的資料表儲存相關資訊：

| 資料表 | 欄位 | 用途 |
|--------|------|------|
| `userGrowthMetrics` | `hasLineLink` (boolean) | 標記用戶是否有 LINE 連結 |
| `userGrowthMetrics` | `hasProduct` (boolean) | 標記用戶是否有產品 |
| `userProducts` | 完整產品資訊 | 儲存用戶的產品詳細資料 |
| `ipProfiles` | 無 LINE 連結欄位 | IP 地基基本資料 |

### 2.2 問題根因

**問題 1：`hasLineLink` 與 `hasProduct` 沒有自動同步機制**

目前這兩個欄位需要用戶在 Dashboard 的「設定」Dialog 中手動勾選，但實際上：

- `hasProduct` 應該根據 `userProducts` 資料表是否有資料自動判定
- `hasLineLink` 應該根據 IP 地基中是否有填寫 LINE 連結自動判定

**問題 2：IP 地基沒有 LINE 連結欄位**

檢查 `ipProfiles` schema 發現，目前沒有儲存 LINE 官方連結的欄位。用戶無法在 IP 地基中輸入 LINE 連結。

### 2.3 資料流現況圖

```
目前的資料流（斷裂）：

┌─────────────────┐     ┌─────────────────────┐
│   IP 地基       │     │  userGrowthMetrics  │
│  (ipProfiles)   │     │                     │
│                 │     │  hasLineLink ❌     │
│  無 LINE 欄位   │ ──X──│  hasProduct ❌      │
│                 │     │  (需手動勾選)       │
└─────────────────┘     └─────────────────────┘
                              │
┌─────────────────┐           │
│  userProducts   │ ────X─────┘
│  (有產品資料)   │     (沒有自動同步)
└─────────────────┘
```

### 2.4 建議修復方案

1. **在 `ipProfiles` 新增 `lineOfficialUrl` 欄位**：讓用戶在 IP 地基中輸入 LINE 官方帳號連結
2. **實作自動同步邏輯**：
   - 當 `userProducts` 有資料時，自動將 `hasProduct` 設為 `true`
   - 當 `ipProfiles.lineOfficialUrl` 有值時，自動將 `hasLineLink` 設為 `true`
3. **移除 Dashboard 中的手動勾選**：改為顯示同步狀態（唯讀）

---

## 三、問題二：LINE 官方連結欄位缺失

### 3.1 現況分析

檢查 `ipProfiles` schema，發現以下欄位結構：

```typescript
export const ipProfiles = mysqlTable("ip_profiles", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  occupation: varchar("occupation", { length: 120 }),
  voiceTone: varchar("voiceTone", { length: 120 }),
  viewpointStatement: text("viewpointStatement"),
  goalPrimary: mysqlEnum("goalPrimary", ["monetize", "influence", "expression"]),
  personaExpertise: text("personaExpertise"),
  personaEmotion: text("personaEmotion"),
  personaViewpoint: text("personaViewpoint"),
  // ... 其他欄位
  // ❌ 沒有 LINE 連結欄位
});
```

### 3.2 問題影響

| 影響層面 | 說明 |
|----------|------|
| 經營階段判定 | `hasLineLink` 無法自動判定，影響階段計算準確性 |
| AI 生成策略 | 無法根據用戶是否有 LINE 連結調整內容策略 |
| 用戶體驗 | 用戶需要在多個地方重複設定相同資訊 |

### 3.3 建議修復方案

1. **在 `ipProfiles` 新增以下欄位**：
   ```typescript
   lineOfficialUrl: varchar("lineOfficialUrl", { length: 255 }), // LINE 官方帳號連結
   lineOfficialName: varchar("lineOfficialName", { length: 100 }), // LINE 官方帳號名稱
   ```

2. **在 IP 地基前端新增輸入區塊**：建議放在「產品服務」Tab 中，與產品資訊一起管理

---

## 四、問題三：戰報「生成策略總結」按鈕缺失

### 4.1 現況分析

**後端 API 狀態**：✅ 已實作

檢查 `server/routers.ts` 發現 `generateStrategySummary` API 已經存在：

```typescript
generateStrategySummary: protectedProcedure
  .mutation(async ({ ctx }) => {
    // 獲取最近 20 篇貼文的數據
    const posts = await db.getPostsByUserId(ctx.user.id);
    const recentPosts = posts.slice(0, 20);
    // ... AI 分析邏輯
  }),
```

**前端 UI 狀態**：❌ 未實作

檢查 `client/src/pages/Reports.tsx` 發現：
- 沒有引入 `generateStrategySummary` mutation
- 沒有「生成策略總結」按鈕
- 沒有顯示策略總結結果的 UI

### 4.2 功能規格

根據 API 設計，此功能應該：

| 功能項目 | 說明 |
|----------|------|
| 觸發條件 | 用戶點擊「生成策略總結」按鈕 |
| 最低要求 | 需要至少 5 篇貼文數據 |
| 分析內容 | 最近 20 篇貼文的觸及、互動率、發文時段、爆文模式 |
| 輸出結果 | AI 生成的個人化策略建議，寫入 `ipProfiles.aiStrategySummary` |

### 4.3 建議修復方案

1. **在戰報頁面新增「生成策略總結」按鈕**
2. **新增策略總結顯示區塊**：顯示 AI 分析結果、最佳發文時段、爆文模式
3. **新增貼文數量檢查**：不足 5 篇時顯示提示訊息

---

## 五、問題四：文案健檢 diff 比對 UI 問題

### 5.1 現況分析

根據用戶提供的截圖，文案健檢的「原文」和「建議改寫」區塊沒有顯示內容。

**後端 API 狀態**：✅ 已實作

檢查 `server/content-health-check.ts` 發現 `redlineMarks` schema 定義正確：

```typescript
redlineMarks: {
  type: "array",
  items: {
    type: "object",
    properties: {
      originalText: { type: "string", description: "原文中有問題的片段" },
      suggestedText: { type: "string", description: "建議改寫的版本" },
      reason: { type: "string", description: "為什麼要改" },
      category: { type: "string", enum: ["hook", "translation", "tone", "cta", "structure"] },
    },
    required: ["originalText", "suggestedText", "reason", "category"],
  },
}
```

**前端 UI 狀態**：⚠️ 欄位名稱不匹配

檢查 `client/src/pages/Optimize.tsx` 發現欄位名稱定義：

```typescript
// 前端定義
redlineMarks?: Array<{
  original: string;      // ❌ 應該是 originalText
  suggestion: string;    // ❌ 應該是 suggestedText
  reason: string;
  category: string;
}>;

// 前端使用
<p>{mark.original}</p>      // ❌ 應該是 mark.originalText
<p>{mark.suggestion}</p>    // ❌ 應該是 mark.suggestedText
```

### 5.2 問題根因

**欄位名稱不一致**：

| 位置 | 欄位名稱 | 正確名稱 |
|------|----------|----------|
| 後端 Schema | `originalText` | ✅ |
| 後端 Schema | `suggestedText` | ✅ |
| 前端 Type 定義 | `original` | ❌ 應為 `originalText` |
| 前端 Type 定義 | `suggestion` | ❌ 應為 `suggestedText` |
| 前端 JSX 使用 | `mark.original` | ❌ 應為 `mark.originalText` |
| 前端 JSX 使用 | `mark.suggestion` | ❌ 應為 `mark.suggestedText` |

這導致前端無法正確讀取後端返回的資料，因此顯示為空。

### 5.3 建議修復方案

修改 `client/src/pages/Optimize.tsx` 中的欄位名稱：

1. 將 Type 定義中的 `original` 改為 `originalText`
2. 將 Type 定義中的 `suggestion` 改為 `suggestedText`
3. 將 JSX 中的 `mark.original` 改為 `mark.originalText`
4. 將 JSX 中的 `mark.suggestion` 改為 `mark.suggestedText`

---

## 六、系統優缺點總結

### 6.1 優點

| 優點 | 說明 |
|------|------|
| 完整的經營階段判定邏輯 | 採用綜合評分制，考慮多項指標 |
| AI 策略回饋機制 | 爆文分析結果會回饋到內容生成 |
| 結構化健檢輸出 | 使用 JSON Schema 確保 AI 輸出格式一致 |
| 教學化設計 | 紅線標記功能幫助用戶學習改進 |

### 6.2 缺點

| 缺點 | 影響程度 | 修復難度 |
|------|----------|----------|
| 資料同步斷層 | 高 | 中 |
| LINE 連結欄位缺失 | 中 | 低 |
| 前端功能未實作 | 高 | 中 |
| 欄位名稱不一致 | 高 | 低 |

---

## 七、建議修復優先順序

根據影響程度和修復難度，建議按以下順序修復：

| 優先順序 | 問題 | 預估工時 |
|----------|------|----------|
| 1 | 文案健檢 diff 欄位名稱修正 | 10 分鐘 |
| 2 | IP 地基新增 LINE 連結欄位 | 30 分鐘 |
| 3 | 戰報頁面新增「生成策略總結」按鈕 | 45 分鐘 |
| 4 | 實作 hasLineLink/hasProduct 自動同步 | 30 分鐘 |

**總預估工時**：約 2 小時

---

## 八、附錄：相關檔案清單

| 檔案路徑 | 說明 |
|----------|------|
| `drizzle/schema.ts` | 資料庫 Schema 定義 |
| `server/routers.ts` | API 路由定義 |
| `server/content-health-check.ts` | 文案健檢邏輯 |
| `server/db.ts` | 資料庫操作函數 |
| `client/src/pages/Dashboard.tsx` | 首頁 Dashboard |
| `client/src/pages/IpProfile.tsx` | IP 地基頁面 |
| `client/src/pages/Reports.tsx` | 戰報分析頁面 |
| `client/src/pages/Optimize.tsx` | 文案健檢頁面 |

---

**報告結束**

如需進一步說明或開始修復，請告知。
