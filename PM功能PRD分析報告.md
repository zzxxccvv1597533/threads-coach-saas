# PM 功能 PRD 分析報告

**報告日期**：2024 年 12 月 27 日  
**報告撰寫**：Manus AI  
**分析對象**：在現有 threads-coach-saas 系統上新增 PM（企劃）功能的 PRD  

---

## 一、我的理解

根據您提供的 PRD 文件，這是一個**重大的系統擴展計畫**，目標是將現有的「個人用戶導向」系統轉型為「多客戶/多專案」的 PM 企劃工具。核心變化如下：

| 現有系統 | PRD 目標系統 |
|---------|-------------|
| 單一用戶（學員）使用 | 多客戶（Client）管理 |
| 用戶自己寫貼文 | PM 團隊批次產出貼文 |
| 無角色區分 | 6 種角色（manager/planner/creator/reviewer/analyst/stakeholder） |
| 手動分析爆文 | 自動 Pattern Extraction（AI 抽取爆文模式） |
| 單篇生成 | 批次生成（Bulk Generation） |
| 無審稿流程 | 完整 Task Workflow（指派→撰稿→審核→批准） |

**簡言之**：這是從「個人創作工具」升級為「企業級內容行銷 SaaS」的轉型。

---

## 二、現有系統與 PRD 的匹配度分析

### 2.1 可直接複用的模組

| 模組 | 現有實作 | PRD 需求 | 匹配度 |
|-----|---------|---------|-------|
| LLM 整合 | `_core/llm.ts` 已封裝 | 需要 LLM 做 pattern extraction、bulk generation | ✅ 100% |
| 內容生成 | `generateDraft`、`generateHooks` | 需要批次呼叫這些 API | ✅ 90%（需加 client_id） |
| 內容類型 | `content-types-v2.ts` 定義 16+ 類型 | 需要相同的內容類型 | ✅ 100% |
| 去 AI 化過濾 | `contentFilters.ts` | 需要套用到批次生成 | ✅ 100% |
| 草稿系統 | `draftPosts`、`draftVersions` | 需要加 client_id 欄位 | ⚠️ 80%（需 migration） |
| 戰報系統 | `posts`、`postMetrics` | 需要加 client_id、is_manual_viral | ⚠️ 70%（需 migration） |
| 用戶系統 | `users` 表已有 role 欄位 | 需要新的 user_client_role 表 | ⚠️ 50%（需新表） |

### 2.2 需要新建的模組

| 新模組 | PRD 描述 | 複雜度 |
|-------|---------|-------|
| `clients` 表 | 客戶/專案管理 | 中 |
| `client_ip` 表 | 客戶品牌聲音（samplePosts、voice_rules） | 中 |
| `user_client_role` 表 | 多對多角色關聯 | 中 |
| `patterns` 表 | 爆文模式儲存與審批 | 高 |
| `tasks` 表 | 工作流程管理 | 高 |
| Pattern Extraction Job | 背景任務：AI 抽取爆文模式 | 高 |
| Bulk Generation Job | 背景任務：批次生成草稿 | 高 |
| RBAC 中間件 | 角色權限檢查 | 中 |

### 2.3 架構變化影響評估

```
現有架構：
User (1) ──────> IP Profile (1)
         ──────> Drafts (N)
         ──────> Posts (N)

PRD 目標架構：
User (1) ──────> UserClientRole (N) ──────> Client (N)
                                              │
                                              ├──> Client IP (1)
                                              ├──> Drafts (N)
                                              ├──> Posts (N)
                                              ├──> Patterns (N)
                                              └──> Tasks (N)
```

**關鍵變化**：從「User-centric」變為「Client-centric」，所有資料都需要 `client_id` 來區分。

---

## 三、優點分析

### 3.1 技術面優點

1. **現有 LLM 整合完善**：`_core/llm.ts` 已經封裝好，Pattern Extraction 和 Bulk Generation 可以直接呼叫，無需重新整合。

2. **內容類型系統成熟**：`content-types-v2.ts` 定義了 16 種以上的內容類型，每種都有 `inputFields`、`viralElements`、`aiPromptTemplate`，批次生成可以直接複用。

3. **去 AI 化過濾器完整**：`contentFilters.ts` 已經有成語替換、廢話刪除、口語化轉換等功能，批次生成的內容品質有保障。

4. **Drizzle ORM 易於擴展**：現有 schema 使用 Drizzle ORM，新增表和欄位只需修改 `schema.ts` 並執行 `pnpm db:push`。

5. **tRPC 架構清晰**：現有 API 使用 tRPC，新增 client、pattern、task 等 router 可以遵循相同模式。

### 3.2 商業面優點

1. **市場定位升級**：從「個人創作工具」升級為「企業級內容行銷 SaaS」，可以收取更高的訂閱費用。

2. **規模化服務能力**：PM 團隊可以同時服務多個客戶，提高人效。

3. **數據驅動決策**：Pattern Extraction 讓內容策略有數據支撐，不再靠感覺。

4. **工作流程標準化**：Task Workflow 讓團隊協作有章可循，減少溝通成本。

---

## 四、缺點與風險分析

### 4.1 技術風險

| 風險項目 | 說明 | 嚴重度 | 緩解方案 |
|---------|------|-------|---------|
| **資料遷移風險** | 現有 `draftPosts`、`postMetrics` 需要加 `client_id`，現有資料如何處理？ | 高 | 建立 migration 腳本，為現有資料設定預設 client |
| **RBAC 複雜度** | 6 種角色 × 多種操作 = 大量權限檢查邏輯 | 中 | 建立統一的 RBAC 中間件，避免散落各處 |
| **背景任務穩定性** | Pattern Extraction、Bulk Generation 需要長時間運行 | 高 | 使用 BullMQ + Redis，加入重試機制和進度追蹤 |
| **LLM 成本控制** | Bulk Generation 可能一次呼叫數十次 LLM | 高 | 加入 rate limiting、成本預估、用量上限 |
| **多租戶資料隔離** | 確保 Client A 無法看到 Client B 的資料 | 高 | 所有 API 加入 client_id 檢查，建立 E2E 測試 |

### 4.2 產品風險

| 風險項目 | 說明 | 嚴重度 | 緩解方案 |
|---------|------|-------|---------|
| **用戶體驗斷裂** | 現有學員習慣的操作流程會改變 | 中 | 保留「個人模式」，PM 功能作為獨立模組 |
| **功能過於複雜** | MVP 包含太多功能，開發週期過長 | 高 | 分階段交付，先做核心功能 |
| **Pattern 品質不穩定** | AI 抽取的 Pattern 可能不準確 | 中 | 加入 Manager 審批流程（PRD 已包含） |

### 4.3 營運風險

| 風險項目 | 說明 | 嚴重度 | 緩解方案 |
|---------|------|-------|---------|
| **現有學員影響** | 系統大改可能影響現有學員使用 | 高 | 分離部署，或使用 feature flag |
| **團隊學習曲線** | PM 團隊需要學習新的工作流程 | 中 | 提供教學文件和培訓 |

---

## 五、執行建議

### 5.1 分階段執行策略

我建議將 PRD 分為 **4 個階段**，而非一次性開發：

| 階段 | 範圍 | 預估時間 | 交付物 |
|-----|------|---------|-------|
| **Phase 1：基礎架構** | clients 表、user_client_role 表、RBAC 中間件 | 2 週 | 多客戶切換、角色權限檢查 |
| **Phase 2：Client IP** | client_ip 表、IP 管理 UI、generateDraft 整合 | 2 週 | 客戶品牌聲音設定、few-shot 生成 |
| **Phase 3：Pattern 系統** | patterns 表、Pattern Extraction Job、Pattern Explorer UI | 3 週 | 爆文模式抽取與審批 |
| **Phase 4：Bulk Generation & Workflow** | tasks 表、Bulk Generation Job、Planner Workspace | 4 週 | 批次生成、任務指派、審稿流程 |

**總計**：約 11 週（2.5-3 個月）

### 5.2 建議的執行順序

```
Week 1-2:  Phase 1 - 基礎架構
           ├── 建立 clients、user_client_role 表
           ├── 實作 RBAC 中間件
           └── 建立 Manager Dashboard 骨架

Week 3-4:  Phase 2 - Client IP
           ├── 建立 client_ip 表
           ├── 實作 IP 管理 UI
           └── 修改 generateDraft 整合 client IP

Week 5-7:  Phase 3 - Pattern 系統
           ├── 建立 patterns 表
           ├── 實作 Pattern Extraction Job（背景任務）
           └── 建立 Pattern Explorer UI

Week 8-11: Phase 4 - Bulk Generation & Workflow
           ├── 建立 tasks 表
           ├── 實作 Bulk Generation Job
           ├── 建立 Planner Workspace UI
           └── 實作 Task Workflow
```

### 5.3 關鍵決策點

在開始執行前，需要先確認以下決策：

| 決策項目 | 選項 | 建議 |
|---------|------|------|
| **現有學員如何處理？** | A) 全部遷移到新架構 B) 保留舊架構，PM 功能獨立 | B - 風險較低 |
| **背景任務基礎設施** | A) BullMQ + Redis B) 簡單的 setTimeout C) 外部服務（如 Inngest） | A - 最穩定 |
| **是否需要獨立部署？** | A) 同一個專案 B) 分離成兩個專案 | A - 先在同一專案，未來再分離 |
| **MVP 範圍是否需要縮減？** | A) 全部照 PRD B) 先做 Phase 1-2 | 視時間壓力而定 |

---

## 六、PRD 文件品質評估

您提供的 PRD 文件品質**非常高**，包含了：

| 項目 | 評分 | 說明 |
|-----|------|------|
| DB Migration SQL | ⭐⭐⭐⭐⭐ | 完整的 CREATE TABLE 語句，可直接執行 |
| API List | ⭐⭐⭐⭐⭐ | 包含 endpoint、method、request/response 範例 |
| RBAC 規範 | ⭐⭐⭐⭐ | 角色定義清楚，但缺少具體的權限矩陣 |
| UI Flow | ⭐⭐⭐⭐ | 文字版 wireframe 清楚，但缺少視覺設計 |
| 驗收條件 | ⭐⭐⭐⭐⭐ | AC 明確，可直接用於測試 |
| Pseudo-code | ⭐⭐⭐⭐⭐ | Pattern Extraction 邏輯清楚，可直接實作 |
| Prompt Templates | ⭐⭐⭐⭐⭐ | 可直接用於 LLM 呼叫 |

**整體評價**：這份 PRD 已經達到「工程可直接估時」的水準，是一份高品質的技術規格文件。

---

## 七、結論與下一步

### 7.1 結論

1. **技術可行性**：現有系統架構支援這次擴展，核心模組（LLM、內容類型、過濾器）可以複用。

2. **風險可控**：主要風險在於資料遷移和多租戶隔離，但透過分階段執行和充分測試可以緩解。

3. **PRD 品質高**：文件已經足夠詳細，工程師可以直接開始實作。

### 7.2 建議的下一步

| 順序 | 行動 | 負責人 |
|-----|------|-------|
| 1 | **確認分階段策略**：決定是否採用 4 階段執行 | 您（產品負責人） |
| 2 | **確認關鍵決策**：現有學員處理方式、背景任務基礎設施 | 您 + 我 |
| 3 | **建立 Phase 1 詳細任務清單**：將 PRD 轉為具體的開發任務 | 我 |
| 4 | **開始 Phase 1 開發**：clients 表、RBAC 中間件 | 我 |

---

## 八、附錄：現有 Schema 與 PRD Schema 對照

### 現有表（需要修改）

| 表名 | 現有欄位 | PRD 新增欄位 |
|-----|---------|-------------|
| `draft_posts` | userId, contentType, title, body, cta, status | `client_id` |
| `draft_versions` | draftPostId, version, body, cta, changeNote | `client_id` |
| `post_metrics` | postId, reach, likes, comments, reposts, saves, isViral | `client_id`, `is_manual_viral`（已有 isViral） |

### 新建表

| 表名 | 主要欄位 | 用途 |
|-----|---------|------|
| `clients` | id, name, slug, description, default_style_weight, default_perf_weight | 客戶/專案管理 |
| `client_ip` | id, client_id, sample_posts, voice_rules | 客戶品牌聲音 |
| `user_client_role` | id, user_id, client_id, role | 用戶-客戶角色關聯 |
| `patterns` | id, client_id, name, pattern_type, pattern_text, source_post_ids, score, approved_by, approved_at | 爆文模式 |
| `tasks` | id, client_id, draft_id, title, description, assignee_id, status, due_at | 工作流程 |

---

*報告結束*
