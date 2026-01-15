# 技術文件分析報告：對照現有系統的理解與優化建議

**報告日期**：2025 年 1 月 14 日  
**報告作者**：Manus AI  
**版本**：v2.0（整合版）

---

## 一、文件核心理解摘要

這兩份技術文件提供了對系統架構的深度分析，核心觀點可歸納為以下層面：

### 1.1 問題定義

文件將「AI 感比較重」的問題拆解為三個技術面向：

| 面向 | 說明 |
|-----|------|
| **Prompt / 開頭生成邏輯** | 如何產生不制式化又穩定的開頭 |
| **生成後檢測 / 過濾** | 怎麼在輸出階段避免 AI 痕跡 |
| **系統層面與產品流程** | 可配置、可度量、可優化的架構（A/B、監控、多樣性分數） |

### 1.2 核心策略：探索與利用的平衡

文件提出的核心策略是將問題視為「**探索（Exploration）vs 利用（Exploitation）**」的平衡問題：

> 生成多個候選（保證多樣性），用一個學習式或規則式選擇器挑出最有希望成為爆款但又不重複的選項，並以真實互動數據不斷更新選擇器權重。

這個策略比單純的「禁止清單」或「提高 temperature」更有效，因為它能同時保留爆款能量並引入新穎模式。

### 1.3 系統核心要素（基於第一性原則）

文件定義了達成「**保留爆款＋提升多樣性＋可量化學習**」必須具備的十大核心能力：

| 編號 | 核心要素 | 說明 |
|-----|---------|------|
| 1 | **Prompt Service** | 管理 templates、avoid-list、control tokens、版本、weight、metadata |
| 2 | **Opener Generator** | 向 LLM 生成多個候選（不同 templates + sampling params） |
| 3 | **Selector + Bandit** | 根據預測 reward、novelty、多樣性罰分做 rerank 與流量分派 |
| 4 | **AI Detector** | 規則 + embedding 相似度檢測，標註或提供 paraphrase |
| 5 | **Observability** | 事件埋點、template/opener/stat logs、A/B metric 收集 |
| 6 | **tRPC Interface** | 把能力以可呼叫 skill 形式暴露給前端或 agent |
| 7 | **Auth / Security** | session auth、context 建立、權限管理與 env 驗證 |
| 8 | **Resilience** | 對外呼叫穩定性、fail-fast、logging & alerting |
| 9 | **Data Storage** | 儲存候選、template stats、user feedback、aiDetector logs |
| 10 | **Training Pipeline** | 用收集到資料訓練 selector 或更新 bandit |

### 1.4 系統定位判斷

文件判斷現有系統更像是「**Skill-first / Service-oriented**」而非「Agent-first」：

| 特徵 | 現有系統 | Agent 系統 |
|-----|---------|-----------|
| 入口 | HTTP + tRPC（被呼叫） | 自主規劃 / 執行循環 |
| 處理模式 | 以 request 為單位 | 持續監控 / 事件驅動 |
| 決策者 | 前端 / 用戶 | Agent 自主決策 |
| 工具管理 | 無工具註冊機制 | 有 Tool Registry |

---

## 二、十大核心要素 vs 現有系統對照

### 2.1 詳細對照表

| 核心要素 | 現況 | 缺失 | 改進建議 | 優先度 |
|---------|------|------|---------|--------|
| **1. Prompt Service** | 未見集中 prompt 管理 service | 沒有 promptService、沒有資料化 template 與 avoid-list、沒有 prompt 版本管理 | 新增 `server/services/promptService.ts` 與 DB table `opener_templates`、`prompt_avoid_list`，提供 API：`getActiveTemplates()`, `getAvoidList()`, `assemblePrompt()` | **P0** |
| **2. Opener Generator** | 未見生成候選的專屬模組 | 沒有 `openerGenerator.ts`、沒有控制不同 sampling params 的流程 | 實作 openerGenerator：接受 templateId + context → 呼叫 LLM 產生 N 個候選，寫入 `openers_candidates` table | **P0** |
| **3. Selector + Bandit** | 尚無選擇器、bandit、或 template weight 管理 | 沒有 rerank pipeline、也沒有 bandit 流量調度 | 先做簡易版本：`banditService.ts`（ε-greedy）+ `selector.ts`（predicted_reward + diversity_penalty） | **P0** |
| **4. AI Detector** | 無 dedicated 檢測服務 | 無 detector、無 logs、無 paraphrase fallback | 分階段：規則版（P0）→ Embedding-based（P1）→ Paraphrase module | **P0** |
| **5. Observability** | 沒有 metrics/logging 實作（只有 console.log） | 沒有埋點、沒有 stats table、沒有 aggregation pipeline | 建立 Logging（pino/winston）、DB tables: `opener_stats`, `template_stats`, `ai_detector_logs` | **P0** |
| **6. tRPC Interface** | 已掛載 tRPC，但缺少統一 skill API | 缺少 `generateOpeners`, `chooseOpener`, `generateContent`, `admin.*` | 設計並實作完整的 tRPC procedures | **P0** |
| **7. Auth / Security** | 已有 oauth.ts, sdk.ts, context.ts | 需 env fail-fast 檢查、rate-limiting、audit logs | 在啟動時做 env schema 驗證，加入 rate limiter middleware | **P0** |
| **8. Resilience** | sdk 使用 axios 但缺少 retry/CB | 未防護外部服務失敗 | 在 `createOAuthHttpClient` 用 axios-retry 或 circuit-breaker | **P1** |
| **9. Data Storage** | 已有 drizzle，但缺必要表格 | 缺 `opener_templates`, `openers_candidates`, `template_stats`, `ai_detector_logs`, `user_style_profiles` | 新增以上表格 | **P0** |
| **10. Training Pipeline** | 無 | 沒離線訓練流程/資料匯入/模型版本管理 | 先做慢速 batch pipeline（每天匯總 template stats、train selector） | **P2** |

### 2.2 現有系統已具備的能力

根據我對現有系統的了解，以下是文件建議中我們**已經實作**的部分：

| 文件建議 | 現有系統狀態 | 完成度 |
|---------|-------------|--------|
| OAuth / Session 管理 | ✅ 已實作（sdk.ts, oauth.ts） | 100% |
| tRPC 架構 | ✅ 已實作（routers.ts） | 100% |
| 用戶風格學習 | ✅ 已實作（IP 地基、爆款分析） | 70% |
| 髒話過濾器 | ✅ 已實作（contentFilters.ts） | 100% |
| 用戶情緒詞優先使用 | ✅ 剛完成優化 | 100% |

### 2.3 現有系統的架構優勢

文件也指出現有系統的一些優勢：

1. **模組化架構**：Express + tRPC + Vite 的架構適合做 modular 拆分與新增 procedure
2. **認證流程完整**：OAuth、Session、JWT 已經完善
3. **風格學習機制**：IP 地基和爆款分析已經有基礎
4. **內容過濾器**：已有 contentFilters.ts 可以擴充

---

## 三、各核心要素的優缺點分析

### 3.1 Prompt Service（Prompt 管理服務）

| 面向 | 分析 |
|-----|------|
| **優點** | 集中管理所有 prompt 和 template，便於版本控制和 A/B 測試；可動態更新 avoid-list 無需重新部署；支援 template 權重調整 |
| **缺點** | 需要新增 DB table 和 service 層；增加系統複雜度；需要設計 prompt 版本管理機制 |
| **實作成本** | 中（約 3-5 天） |
| **效果預期** | 高 — 是其他功能的基礎 |
| **風險** | 低 — 不影響現有功能 |

### 3.2 Opener Generator（多候選生成）

| 面向 | 分析 |
|-----|------|
| **優點** | 保證多樣性；可收集用戶選擇數據；支援不同 sampling params 實驗 |
| **缺點** | 增加 API 調用成本（N 倍）；增加生成時間；需要前端配合顯示多選項 |
| **實作成本** | 中（約 3-5 天） |
| **效果預期** | 高 — 直接解決開頭重複問題 |
| **風險** | 中 — 需要調整生成流程 |

### 3.3 Selector + Bandit（選擇器 + 流量分配）

| 面向 | 分析 |
|-----|------|
| **優點** | 動態平衡探索與利用；自動優化；數據驅動決策 |
| **缺點** | 需要足夠的數據量才能有效；需要監控機制；初期可能有「冷啟動」問題 |
| **實作成本** | 中高（約 5-7 天） |
| **效果預期** | 高 — 長期效果顯著 |
| **風險** | 中 — 需要持續監控和調整 |

**Bandit 策略選項比較**：

| 策略 | 說明 | 適用場景 |
|-----|------|---------|
| **ε-greedy** | 10% 隨機探索，90% 用最佳 | 簡單易實作，適合初期 |
| **UCB** | 考慮不確定性的探索 | 需要更多數據，效果更好 |
| **Thompson Sampling** | 貝葉斯方法 | 最優但實作複雜 |

### 3.4 AI Detector（AI 痕跡檢測）

| 面向 | 分析 |
|-----|------|
| **優點** | 最後一道防線；可量化追蹤；用戶可見的改善 |
| **缺點** | 可能誤判；增加處理時間；需要持續維護規則 |
| **實作成本** | 低（規則版約 2-3 天） |
| **效果預期** | 中 — 能攔截明顯的 AI 痕跡 |
| **風險** | 低 — 先標記不自動刪除 |

**分階段實作建議**：

| 階段 | 內容 | 優先度 |
|-----|------|--------|
| 規則版 | 檢查 avoidList、典型 AI 短語、重複/模板化檢測 | P0 |
| Embedding-based | 用 sentence embeddings 計算與已知 AI 句式的相似度 | P1 |
| Paraphrase module | 若 ai_suspected && high_predicted_reward → 提供改寫選項 | P2 |

### 3.5 Observability（可觀測性）

| 面向 | 分析 |
|-----|------|
| **優點** | 無數據無法學習；支援 A/B 測試；可追蹤效果 |
| **缺點** | 需要設計事件埋點；增加儲存成本；需要建立 dashboard |
| **實作成本** | 中（約 3-5 天） |
| **效果預期** | 高 — 是持續優化的基礎 |
| **風險** | 低 — 不影響現有功能 |

**需要記錄的事件**：

| 事件 | 說明 |
|-----|------|
| `generate_request` | 用戶發起生成請求 |
| `candidate_written` | 候選寫入 DB |
| `ai_detected` | AI 痕跡被檢測到 |
| `user_selection` | 用戶選擇了某個候選 |
| `user_rewrite` | 用戶手動修改了內容 |
| `publish_event` | 內容被發布 |
| `engagement` | 互動數據（如果可取得） |

### 3.6 Data Storage（資料儲存）

| 面向 | 分析 |
|-----|------|
| **優點** | 支援歷史分析；支援訓練 selector；支援用戶風格 profile |
| **缺點** | 增加 DB 複雜度；需要設計資料清理策略；增加儲存成本 |
| **實作成本** | 低（約 1-2 天） |
| **效果預期** | 高 — 是其他功能的基礎 |
| **風險** | 低 — 只是新增 table |

**需要新增的表格**：

| 表格 | 用途 |
|-----|------|
| `opener_templates` | 儲存開頭模板和權重 |
| `prompt_avoid_list` | 儲存禁止句式清單 |
| `openers_candidates` | 儲存所有生成的候選 |
| `template_stats` | 儲存模板統計（impressions, clicks, reward） |
| `ai_detector_logs` | 儲存 AI 檢測記錄 |
| `user_style_profiles` | 儲存用戶風格 profile |

---

## 四、優化排序：綜合建議

### 4.1 第一階段：基礎建設（1-2 週）— P0 級

這些是兩份文件都一致建議的最優先項目：

| 順序 | 項目 | 說明 | 風險 | 效果 |
|-----|------|------|-----|------|
| 1 | **Data Storage** | 新增必要的 DB tables | 低 | 高 |
| 2 | **Prompt Service** | 建立 promptService + avoid-list | 低 | 高 |
| 3 | **AI Detector（規則版）** | 檢測 AI 痕跡但先標記不自動刪除 | 低 | 中 |
| 4 | **Observability（基礎）** | 建立 logging 和基礎埋點 | 低 | 高 |
| 5 | **Auth 強化** | env fail-fast 驗證 | 低 | 中 |

### 4.2 第二階段：核心功能（2-6 週）— P1 級

| 順序 | 項目 | 說明 | 風險 | 效果 |
|-----|------|------|-----|------|
| 6 | **Opener Generator** | 生成 N 個候選，返回 top 3 | 中 | 高 |
| 7 | **簡單 Selector** | 規則式 rerank（品質、多樣性、歷史相似度） | 低 | 中 |
| 8 | **ε-greedy Bandit** | 10% 探索新模板，90% 用高效模板 | 低 | 中 |
| 9 | **前端候選選擇 UI** | 讓用戶選擇開頭，收集回饋 | 中 | 高 |
| 10 | **Resilience** | axios-retry + circuit-breaker | 低 | 中 |

### 4.3 第三階段：深度優化（2-4 月）— P2 級

| 順序 | 項目 | 說明 | 風險 | 效果 |
|-----|------|------|-----|------|
| 11 | **AI Detector（Embedding）** | 用 embedding 計算相似度 | 中 | 中 |
| 12 | **學習式 Selector** | 用歷史數據訓練 reranker | 高 | 高 |
| 13 | **Training Pipeline** | 每天匯總 stats、train selector | 中 | 高 |
| 14 | **多樣性正則** | 引入 embedding 相似度計算 | 中 | 中 |
| 15 | **用戶風格 Profile 深化** | 深度風格分析 | 高 | 高 |

---

## 五、tRPC Interface 設計建議

文件建議設計以下 tRPC procedures：

### 5.1 生成相關

```typescript
// 生成多個開頭候選
trpc.generateOpeners({
  templateId?: string,
  templateCategory?: string,
  context: object,
  n: number  // 生成數量，預設 6
}) → returns { candidates: Candidate[] }

// 用戶選擇開頭
trpc.selectOpener({
  candidateId: string
}) → records selection, returns { success: boolean }

// 生成完整內容
trpc.generateContent({
  openerId: string,
  options: object
}) → main content generation + aiDetector
```

### 5.2 管理相關

```typescript
// 管理模板
trpc.admin.templates.list() → returns templates
trpc.admin.templates.create({ ... }) → creates template
trpc.admin.templates.update({ id, ... }) → updates template
trpc.admin.templates.updateWeight({ id, weight }) → updates weight

// 管理 avoid-list
trpc.admin.avoidList.list() → returns avoid list
trpc.admin.avoidList.add({ phrase, reason }) → adds phrase
trpc.admin.avoidList.remove({ id }) → removes phrase

// 查看統計
trpc.admin.stats.templates() → returns template stats
trpc.admin.stats.aiDetector() → returns detector stats
```

---

## 六、DB Schema 設計建議

### 6.1 opener_templates

```sql
CREATE TABLE opener_templates (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  category VARCHAR(100),
  template_text TEXT NOT NULL,
  weight DECIMAL(5,4) DEFAULT 1.0,
  is_active BOOLEAN DEFAULT true,
  metadata JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 6.2 prompt_avoid_list

```sql
CREATE TABLE prompt_avoid_list (
  id VARCHAR(36) PRIMARY KEY,
  phrase TEXT NOT NULL,
  reason VARCHAR(255),
  severity ENUM('block', 'warn', 'log') DEFAULT 'warn',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 6.3 openers_candidates

```sql
CREATE TABLE openers_candidates (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36),
  template_id VARCHAR(36),
  opener_text TEXT NOT NULL,
  temperature DECIMAL(3,2),
  top_p DECIMAL(3,2),
  context_hash VARCHAR(64),
  ai_score DECIMAL(5,4),
  was_selected BOOLEAN DEFAULT false,
  was_published BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 6.4 template_stats

```sql
CREATE TABLE template_stats (
  id VARCHAR(36) PRIMARY KEY,
  template_id VARCHAR(36),
  date DATE,
  impressions INT DEFAULT 0,
  selections INT DEFAULT 0,
  publishes INT DEFAULT 0,
  avg_engagement DECIMAL(10,4),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY (template_id, date)
);
```

### 6.5 ai_detector_logs

```sql
CREATE TABLE ai_detector_logs (
  id VARCHAR(36) PRIMARY KEY,
  candidate_id VARCHAR(36),
  ai_suspected BOOLEAN,
  confidence DECIMAL(5,4),
  rules_triggered JSON,
  action_taken ENUM('none', 'marked', 'paraphrased', 'blocked'),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## 七、與我之前報告的差異

| 面向 | 我之前的報告 | 這份技術文件 |
|-----|-------------|-------------|
| **問題定義** | 聚焦於「AI 感」的表面症狀 | 深入到「探索 vs 利用」的本質 |
| **解決方案** | 禁止清單 + 多樣化替換 | 多候選 + Selector + Bandit |
| **數據收集** | 較少強調 | 強調先收數據再優化 |
| **架構設計** | 在現有架構上修改 | 建議新增多個獨立服務 |
| **優先級判斷** | P0 只有 avoid-list | P0 包含完整的基礎建設 |

---

## 八、結論與建議

### 8.1 文件的核心價值

這兩份技術文件提供了一個**更系統化**的思考框架：

1. **問題定義更精確**：將「AI 感」問題拆解為十個可操作的技術面向
2. **策略更有深度**：引入「探索 vs 利用」的概念，而非單純的禁止或替換
3. **架構建議更完整**：提出了 promptService、openerGenerator、openerSelector、banditService 等模組化設計
4. **數據驅動思維**：強調收集回饋數據、A/B 測試、持續優化

### 8.2 建議的下一步

| 階段 | 項目 | 時間 |
|-----|------|------|
| **立即** | Data Storage + Prompt Service + AI Detector（規則版） | 1-2 週 |
| **短期** | Opener Generator + 簡單 Selector + Bandit | 2-4 週 |
| **中期** | 前端 UI + Observability 完善 + Training Pipeline | 1-2 月 |
| **長期** | 學習式 Selector + 多樣性正則 + 用戶風格深化 | 2-4 月 |

### 8.3 風險提醒

1. **不要一次做太多** — 建議分階段實施，每階段驗證效果後再進入下一階段
2. **先收數據** — 即使功能未完成，也要先建立數據收集機制
3. **保持回退能力** — 每個改動都要能快速回退
4. **用戶反饋優先** — 技術優化要以用戶反饋為導向

---

*報告結束*
