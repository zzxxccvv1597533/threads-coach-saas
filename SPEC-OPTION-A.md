# threads-coach-saas — Option A 規格書

**版本**：v2.0-simple  
**決策日期**：2026-04-01  
**定義**：幕創行銷課程學員的個人 Threads 內容創作工具

---

## 一、產品定義

### 這是什麼
幕創課程學員用的 AI 寫作助手。學員填入自己的 IP 地基（品牌定位），系統協助他們穩定產出有個人風格的 Threads 貼文。

### 這不是什麼（超出範圍，不做）
- PM 企業工具（多客戶批次生產）
- 商品管理 / 訂單 / 訂閱金流
- 效果預測系統
- A/B 版本測試
- 跨老師內容管理

---

## 二、成功定義

一個新學員能在 30 分鐘內完成：

```
帳號密碼登入 → Dashboard → 填 IP 地基 → 進發文工作室
→ 選「沒靈感」模式 → 走完 Step 0~8 → 草稿存入草稿庫
→ 在草稿庫看到這篇草稿
```

這條路不能有任何錯誤或斷點。

---

## 三、保留的功能模組

| 模組 | 路由 | 狀態 |
|------|------|------|
| 首頁 Landing | `/` | ✅ 保留 |
| 學員登入 | `/login` | ✅ 保留（email/password 唯一方式）|
| 學員註冊 | `/register` | ✅ 保留 |
| Dashboard | `/dashboard` | ✅ 保留 |
| IP 地基 | `/ip-profile` | ✅ 保留 |
| 發文工作室 | `/writing-studio` | ✅ 保留（核心功能）|
| 草稿庫 | `/drafts` | ✅ 保留 |
| 文案健檢 | `/optimize` | ✅ 保留 |
| 互動任務 | `/tasks` | ✅ 保留 |
| 戰報 | `/reports` | ✅ 保留 |
| 管理後台 | `/admin` | ✅ 保留（管理員功能）|
| 等待開通 | `/pending` | ✅ 保留 |

---

## 四、Bug 修復清單（v2.0-simple 必須完成）

### Bug 1：未登入重導向指向 Manus OAuth Portal（已修復）

**問題根源**：`getLoginUrl()` 建立的是 Manus OAuth URL（需要 VITE_OAUTH_PORTAL_URL 環境變數），在獨立部署時無法使用。

**影響範圍**：5 個文件
1. `client/src/_core/hooks/useAuth.ts` — 預設 redirectPath
2. `client/src/main.tsx` — TRPC error handler
3. `client/src/components/DashboardLayout.tsx` — 未登入時的登入按鈕
4. `client/src/pages/Apply.tsx` — 申請頁的登入按鈕

**修復方式**：所有 `getLoginUrl()` 呼叫改為 `'/login'`，並移除對應的 `import { getLoginUrl }` 語句。

**已修復**：✅ 2026-04-01

---

### Bug 2：OAuth Callback 返回 500 JSON（已修復）

**問題根源**：`server/_core/oauth.ts` 在 callback 失敗時回傳 `res.status(500).json({ error: "OAuth callback failed" })`，讓瀏覽器顯示原始 JSON 錯誤訊息。

**修復方式**：改為 `res.redirect(302, "/login?error=oauth_failed")`

**Login 頁面**：加入 useEffect 偵測 `?error=oauth_failed` 參數，顯示 toast 提示「請使用帳號密碼登入」。

**已修復**：✅ 2026-04-01

---

### Bug 3：發文工作室路由 404（待確認）

**描述**：直接輸入 `/writing-studio` URL 在某些環境出現 404。

**預期行為**：所有客戶端路由（非 `/api/` 開頭）應 fallback 到 `index.html`。

**Server 端邏輯**（`server/_core/vite.ts`）：
```js
// 已有 fallback，生產模式應正常
app.use("*", (_req, res) => {
  res.sendFile(path.resolve(distPath, "index.html"));
});
```

**確認項目**：確保 `distPath` 指向正確的 build 輸出目錄。

---

### Bug 4：SimpleWritingFlow 4 步流程通暢性（v2.0 重構後）

**描述**：發文工作室已從 12 步簡化為 4 步（SimpleWritingFlow），需確認：
1. 每個步驟的 LLM API 呼叫成功（Forge API 是否正常）
2. Step 進入下一步的條件是否正確
3. 最後草稿是否確實存入草稿庫

**測試路徑**：
```
Step 0: 寫什麼？ → 輸入主題 or 點「給我靈感」→ AI 推薦 5 個選題 → 選一個
Step 1: 你的素材 → AI 教練問 3 個問題 → 學員回答（不能跳過）
Step 2: AI 生成 → smartStrategy 自動判斷策略 → generateDraft 生成草稿 → 顯示品質檢查
Step 3: 修改 + 完成 → 對話修改 / 一鍵潤飾 → 儲存到草稿庫
```

---

## 五、環境變數需求（必填）

| 變數 | 用途 | 備註 |
|------|------|------|
| `DATABASE_URL` | 資料庫連線 | TiDB / MySQL |
| `JWT_SECRET` | Session token 簽發 | 隨機長字串 |
| `BUILT_IN_FORGE_API_URL` | LLM API endpoint | Manus Forge |
| `BUILT_IN_FORGE_API_KEY` | LLM API key | Manus Forge |
| `VITE_APP_ID` | App 識別碼 | Manus 平台 |

**不再需要**（可移除）：
- `OAUTH_SERVER_URL` — OAuth 功能已改為不影響正常流程
- `VITE_OAUTH_PORTAL_URL` — 同上

---

## 六、移除 / 隱藏項目（不刪 code，只從導航隱藏）

| 功能 | 處理方式 |
|------|---------|
| 商品管理（Products tab in IP地基） | 隱藏 Tab |
| 訂單管理 | Admin 後台隱藏 |
| 訂閱機制 | 不實作 |
| PM 企業功能（multi-client） | 不實作 |
| 效果預測功能 | 隱藏 UI 元件 |

---

## 七、驗收測試

完成後用以下流程手動測試：

```
1. 開啟首頁 → 點「學員登入」
2. 輸入 email + password → 登入成功 → 進 Dashboard
3. 點 IP 地基 → 填入基本資料、三支柱、受眾 → 儲存
4. 點發文工作室 → 點「給我靈感」→ 選一個主題
5. 回答 AI 教練的 3 個問題
6. AI 自動生成草稿 → 確認品質檢查通過
7. 修改（選擇性）→ 儲存到草稿庫
8. 去草稿庫 → 看到剛才的草稿
9. 登出 → 回到首頁
```

全程不出現 500 錯誤、不出現 OAuth callback failed、不出現 404。
