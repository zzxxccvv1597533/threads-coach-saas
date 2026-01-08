# AI 文案健檢功能修復報告

## 問題描述

文案健檢功能在調用 LLM API 時失敗，錯誤信息為：
```
TypeError: Cannot read properties of undefined (reading '0')
```

這表示 `response.choices` 為 undefined 或空陣列。

## 根本原因

### 診斷過程

1. **初步檢查**：代碼在第 513 行嘗試訪問 `response.choices[0]`，但該陣列為空
2. **API 調用分析**：使用了 `json_schema` 模式和複雜的 schema 定義
3. **對比測試**：發現 `checkClarity` 路由使用普通模式時能正常工作

### 根本原因

**Manus Forge API 不完全支持 `json_schema` 模式**

- `json_schema` 是 OpenAI 的新功能，不是所有 LLM API 都支持
- 原始 schema 有 6 個必需欄位 + 多層嵌套，可能超過 API 的複雜度限制
- 當 API 無法處理 `json_schema` 時，返回空的 `choices` 陣列

## 修復方案

### 實施的改變

1. **改用 `json_object` 模式**
   - 更穩定，大多數 LLM API 都支持
   - 不需要複雜的 schema 定義

2. **簡化 AI 輸出格式**
   - 使用清晰的提示詞指導 AI 輸出 JSON
   - 依賴 AI 的理解能力而不是強制 schema

3. **改進錯誤處理**
   - 添加詳細的日誌記錄
   - 檢查 `choices` 陣列是否為空
   - 驗證 content 是否為字符串類型

### 代碼變更

**文件**：`server/content-health-check.ts`

**主要改變**：
```typescript
// 舊方式（失敗）
response_format: {
  type: "json_schema",
  json_schema: {
    name: "content_health_check",
    strict: true,
    schema: healthCheckSchema,  // 複雜的 schema
  },
}

// 新方式（成功）
response_format: {
  type: "json_object",
}
```

## 測試結果

✅ **功能恢復**：文案健檢現在能正常工作

測試輸入：
```
你有沒有過這種經驗？
明明很努力，卻總是覺得不夠好。
其實這不是你的問題，而是你還沒找到對的方法。
我以前也是這樣，直到我學會了這個技巧，一切才改變。
現在我想分享給你，希望能幫助你度過這個困難的時期。
```

測試輸出：
- 總分：73/100
- Hook 鉤子強度：18/25
- Translation 翻譯機：16/20
- Tone 閱讀體感：11/15
- CTA 互動召喚：5/10
- 四透鏡檢核：23/30
- 包含詳細的改進建議和紅線標記

## 文件備份

原始文件已備份為：
- `server/content-health-check-original.ts`：原始實現
- `server/content-health-check-test.ts`：診斷測試檔案
- `server/content-health-check-fixed.ts`：修復版本

## 建議

### 短期
- 監控 LLM API 的返回結果，確保穩定性
- 收集用戶反饋，驗證評分準確性

### 長期
- 如果 Manus Forge API 未來支持 `json_schema`，可以考慮遷移回去以獲得更嚴格的輸出驗證
- 添加單元測試覆蓋健檢功能
- 實現健檢結果的緩存機制以降低 API 調用成本

## 相關文件

- 修復前：`server/content-health-check-original.ts`
- 修復後：`server/content-health-check.ts`
- LLM 調用層：`server/_core/llm.ts`
- 路由定義：`server/routers.ts` (第 3607 行)
