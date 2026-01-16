# LLM 價格調研資料

## 來源：getdeploying.com/llm-price-comparison（2025-12-17 更新）

### 主要模型價格比較（每 1M Token）

| 模型 | 提供者 | 輸入價格 | 輸出價格 | Context |
|------|--------|----------|----------|---------|
| gemini-2.5-flash | Google Cloud | $0.30 | $2.50 | 1M |
| gemini-2.5-flash-lite | Google Cloud | $0.10 | $0.40 | 1M |
| gemini-2.5-pro | Google Cloud | $1.25 | $10.00 | 1M |
| gemini-3-flash | Google Cloud | $0.50 | $3.00 | 1M |
| gemini-3-pro | Google Cloud | $2.00 | $12.00 | 1M |
| gpt-4o | OpenAI | $2.50 | $10.00 | 128K |
| gpt-4.1 | OpenAI | $2.00 | $8.00 | 1M |
| gpt-4.1-mini | OpenAI | $0.40 | $1.60 | 1M |
| gpt-5 | OpenAI | $1.25 | $10.00 | 400K |
| gpt-5-mini | OpenAI | $0.25 | $2.00 | 400K |
| gpt-5-nano | OpenAI | $0.05 | $0.40 | 400K |
| claude-sonnet-3.5 | Anthropic | $3.00 | $15.00 | 200K |
| claude-sonnet-3.7 | Anthropic | $3.00 | $15.00 | 200K |
| claude-sonnet-4 | Anthropic | $3.00 | $15.00 | 200K |
| claude-haiku-3.5 | Anthropic | $0.80 | $4.00 | 200K |
| claude-haiku-4.5 | Anthropic | $1.00 | $5.00 | 200K |
| claude-opus-4 | Anthropic | $15.00 | $75.00 | 200K |
| o3-mini | OpenAI | $1.10 | $4.40 | 200K |
| o4-mini | OpenAI | $1.10 | $4.40 | 200K |
| deepseek-r1 | Novita | $0.70 | $2.50 | 128K |

### 價格分級（按輸出價格排序）

#### 經濟級（輸出 ≤ $1/1M）
- gemini-2.5-flash-lite: $0.40
- gpt-5-nano: $0.40
- gpt-4.1-nano: $0.40

#### 標準級（輸出 $1-5/1M）
- gemini-2.5-flash: $2.50
- gemini-3-flash: $3.00
- gpt-5-mini: $2.00
- gpt-4.1-mini: $1.60
- claude-haiku-3.5: $4.00
- claude-haiku-4.5: $5.00
- o3-mini: $4.40
- deepseek-r1: $2.50

#### 高級（輸出 $5-15/1M）
- gemini-2.5-pro: $10.00
- gemini-3-pro: $12.00
- gpt-4o: $10.00
- gpt-4.1: $8.00
- gpt-5: $10.00
- claude-sonnet-3.5/3.7/4: $15.00

#### 頂級（輸出 > $15/1M）
- claude-opus-4: $75.00
- o1-pro: $600.00


---

## LLM 能力比較（來源：cosmicjs.com，2026-01-11）

### 各模型強項總結

#### Claude Opus 4.5
- **最佳用途**：長篇文章、技術文檔、SEO 內容
- **強項**：
  - 維持 3,000+ 字文章的敘事連貫性
  - 自然融入過渡和邏輯流程
  - 展現真正洞察而非陳腔濫調
  - Token 效率高（比其他模型少用 19%）
- **價格**：$5/$25 per 1M tokens

#### Gemini 3 Pro
- **最佳用途**：行銷內容、多模態內容、研究密集型內容
- **強項**：
  - 多模態理解（文字、圖片、影片、音訊）
  - 1M token 超長上下文
  - A/B 測試變體生成
  - 品牌聲音適應
- **價格**：$2/$12 per 1M tokens（≤200K）

#### GPT 5.2
- **最佳用途**：多樣化內容、創意寫作
- **強項**：
  - 風格靈活性
  - 語調匹配
  - 創意隱喻
  - 對話自然度
- **價格**：$1.75/$14 per 1M tokens

### 內容生成測試結果

| 類別 | 勝者 | 說明 |
|------|------|------|
| 長篇文章 | Claude Opus 4.5 | 敘事連貫性最佳 |
| 行銷文案 | Gemini 3 Pro | 多模態理解優勢 |
| SEO 內容 | Claude Opus 4.5 | 自然融入關鍵字 |
| 技術文檔 | Claude Opus 4.5 | 準確解釋複雜概念 |
| 創意寫作 | 平手（Claude & GPT） | 各有所長 |

### Token 效率比較

| 模型 | 每 1,000 字文章的 Token 數 | 相對成本 |
|------|---------------------------|----------|
| Claude Opus 4.5 | ~1,400 | 基準線 |
| GPT 5.2 | ~1,550 | +11% |
| Gemini 3 Pro | ~1,650 | +18% |

---

## 中文內容生成能力

根據搜尋結果：
- **Qwen（通義千問）**：專門針對中文優化，中文理解和生成能力最強
- **DeepSeek**：中國開發，中文能力優秀，價格極低
- **Claude**：中文能力良好，創意寫作表現突出
- **GPT-4o**：中文能力穩定，但非專門優化
- **Gemini**：中文能力中等，多模態優勢

### 中文社群媒體內容推薦

對於繁體中文 Threads 內容生成：
1. **首選**：Claude Sonnet 4 / Opus 4.5（創意寫作強、風格一致性好）
2. **備選**：GPT-4o / GPT-5（穩定、指令遵循度高）
3. **經濟選項**：DeepSeek R1（價格極低、中文能力好）
