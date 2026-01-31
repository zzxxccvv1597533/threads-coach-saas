# 幕創行銷 Threads AI 教練系統
# 詳細優化方向與修改方案

**版本**：v1.0  
**日期**：2026 年 1 月 29 日  
**作者**：Manus AI

---

## 目錄

1. [問題總覽](#一問題總覽)
2. [問題一：提示詞過載（4,000 字）](#二問題一提示詞過載4000-字)
3. [問題二：規則互相矛盾](#三問題二規則互相矛盾)
4. [問題三：開頭模式過度強制](#四問題三開頭模式過度強制)
5. [問題四：Few-Shot 學習方式不當](#五問題四few-shot-學習方式不當)
6. [問題五：CTA 結尾公式化](#六問題五cta-結尾公式化)
7. [問題六：禁止規則過多反而產生刻意感](#七問題六禁止規則過多反而產生刻意感)
8. [問題七：缺少創作目標分流](#八問題七缺少創作目標分流)
9. [問題八：缺少 AI 去痕後處理](#九問題八缺少-ai-去痕後處理)
10. [實施優先級與時程](#十實施優先級與時程)

---

## 一、問題總覽

經過深入分析現有系統的 `generateDraft` 函數（位於 `server/routers.ts`），我識別出以下 **8 個核心問題**：

| 編號 | 問題 | 嚴重度 | 影響 |
|------|------|--------|------|
| 1 | 提示詞過載（4,000 字） | 🔴 高 | LLM 選擇性執行，產生拼湊感 |
| 2 | 規則互相矛盾 | 🔴 高 | LLM 無法同時滿足，輸出不穩定 |
| 3 | 開頭模式過度強制 | 🟠 中 | 所有貼文開頭風格趨同 |
| 4 | Few-Shot 學習方式不當 | 🟠 中 | 學到句式而非風格 |
| 5 | CTA 結尾公式化 | 🟠 中 | 結尾千篇一律 |
| 6 | 禁止規則過多 | 🟠 中 | 反而產生「避開禁區」的刻意感 |
| 7 | 缺少創作目標分流 | 🟡 低 | 所有內容都套用爆款策略 |
| 8 | 缺少 AI 去痕後處理 | 🟡 低 | 無法檢測和修正 AI 痕跡 |

---

## 二、問題一：提示詞過載（4,000 字）

### 2.1 問題描述

現有系統的 `systemPrompt` 包含約 **4,000 字**的規則，結構如下：

```
硬性字數限制 → SYSTEM_PROMPTS.contentGeneration → 創作者 IP 地基 
→ 目標受眾 → 內容支柱 → 用戶風格 → 經營階段策略 → 爆款元素提示 
→ 成功因素 → 選題庫參考 → 群集資訊 → 四透鏡框架 → 翻譯機規則 
→ Threads 爆款風格 → 語調控制 → 絕對禁止 → 數據驅動開頭規則 
→ 重要指示
```

當 LLM 收到 4,000 字的指令時，它**無法同時滿足所有要求**，只能「挑重點執行」。而它挑選的重點，往往是最明確、最強調的規則（如「字數限制」「禁止詞彙」），而忽略了更微妙的風格要求。

### 2.2 具體影響

| 影響 | 說明 |
|------|------|
| **選擇性執行** | LLM 只執行部分規則，其他被忽略 |
| **拼湊感** | 部分規則被套用、部分被忽略，產生不協調的輸出 |
| **模板化** | LLM 傾向選擇最安全的路徑，產生模板化內容 |
| **不穩定** | 每次生成的結果差異大，品質不一致 |

### 2.3 修改方案

#### 方案 A：提示詞分層架構（推薦）

將 4,000 字的提示詞重構為 **三層架構**：

**第一層：核心指令（永遠存在，約 200 字）**
```typescript
const corePrompt = `你是這位創作者的「內心聲音」。
用他的口氣說話，用他的方式思考。
不要寫得「比他更好」，要寫得「像他」。

=== 品質底線 ===
- 禁止：「此外」「值得一提」「綜上所述」「希望對你有幫助」
- 禁止：任何髒話和粗俗用語
- 格式：純文字，不用 **、#、- 等符號
- 像聊天，不像教學文章

直接輸出可發布的貼文，不要任何解釋。`;
```

**第二層：風格 DNA（動態注入，約 150 字）**
```typescript
const styleDNA = `=== 你的說話方式 ===
情緒風格：${userStyle.emotionStyle}
句子長度：平均 ${userStyle.avgSentenceLength} 字
常用轉折：${userStyle.commonTransitions.join('、')}`;
```

**第三層：內容方向（本次創作，約 100 字）**
```typescript
const contentDirection = `=== 這次要說的話 ===
主題：${input.topic}
類型：${input.contentType}
字數：${wordLimit.min}-${wordLimit.max} 字`;
```

**總計：約 450 字**（從 4,000 字精簡到 450 字）

#### 方案 B：規則優先級標記

如果不想大幅重構，可以在現有提示詞中加入**優先級標記**：

```typescript
const systemPrompt = `
【P0 - 必須遵守】
- 字數限制：${wordLimit.min}-${wordLimit.max} 字
- 禁止 AI 詞彙：「此外」「值得一提」「綜上所述」

【P1 - 重要參考】
- 用創作者的口氣說話
- 像聊天，不像教學文章

【P2 - 可選參考】
- 爆款元素提示
- 四透鏡框架
`;
```

### 2.4 修改位置

**檔案**：`server/routers.ts`  
**函數**：`generateDraft`  
**行數**：約 3093-3251 行（systemPrompt 組裝部分）

### 2.5 預期效果

| 指標 | 修改前 | 修改後 |
|------|--------|--------|
| 提示詞長度 | 4,000 字 | 450 字 |
| 規則執行率 | 約 40% | 約 90% |
| AI 感程度 | 高 | 中低 |
| 輸出穩定性 | 低 | 高 |

---

## 三、問題二：規則互相矛盾

### 3.1 問題描述

現有提示詞中存在多處**互相矛盾的規則**：

| 矛盾 1 | 規則 A | 規則 B |
|--------|--------|--------|
| **口語 vs 結構** | 「像傳訊息給朋友」 | 「結構清晰，有邏輯脈絡」 |
| **自然 vs 公式** | 「不要每篇都用同樣模式」 | 「必須使用指定開頭模式」 |
| **真實 vs 爆款** | 「不能憑空編造對話」 | 「用對話引入製造真實感」 |

### 3.2 具體程式碼位置

**矛盾 1：口語 vs 結構**

```typescript
// 行 3155-3157：要求口語化
`【傳訊息感】像在 LINE 跟朋友聊天，不是寫部落格文章`

// 行 3137-3138：要求結構化
`### 結構透鏡 - 這篇文案好不好吸收？
- 結構清晰，有邏輯脈絡`
```

**矛盾 2：自然 vs 公式**

```typescript
// 行 3185-3188：要求開頭多樣
`### 避免固定句式
- 每篇文章的開頭都要不一樣
- 不要每篇都用「你是不是也...」「你有沒有...」`

// 行 3209-3217：強制使用指定開頭模式
`=== 數據驅動開頭規則（本次生成必須使用） ===
【本次指定開頭模式】${selectedOpenerPattern?.name || '冠號斷言'}
【重要】第一行必須使用上述模式，不能使用其他開頭方式！`
```

### 3.3 修改方案

#### 方案：規則統一化

**原則**：當兩個規則矛盾時，選擇**更符合第一性原理**的那個。

**修改 1：口語優先於結構**

```typescript
// 修改前
`### 結構透鏡 - 這篇文案好不好吸收？
- 結構清晰，有邏輯脈絡
- 不是東一句西一句`

// 修改後
`### 結構透鏡 - 這篇文案好不好吸收？
- 思路清晰，讀者能跟上你的想法
- 不需要刻意的結構，自然的思緒流動即可`
```

**修改 2：自然優先於公式**

```typescript
// 修改前
`=== 數據驅動開頭規則（本次生成必須使用） ===
【本次指定開頭模式】${selectedOpenerPattern?.name || '冠號斷言'}
【重要】第一行必須使用上述模式，不能使用其他開頭方式！`

// 修改後
`=== 開頭建議（參考即可，不強制） ===
【建議開頭模式】${selectedOpenerPattern?.name || '冠號斷言'}
【說明】這種開頭效果較好，但如果不適合這次的內容，可以用其他方式`
```

### 3.4 修改位置

**檔案**：`server/routers.ts`  
**行數**：
- 3137-3142（四透鏡框架）
- 3209-3227（數據驅動開頭規則）

### 3.5 預期效果

| 指標 | 修改前 | 修改後 |
|------|--------|--------|
| 規則矛盾數 | 3+ 處 | 0 處 |
| LLM 困惑度 | 高 | 低 |
| 輸出一致性 | 低 | 高 |

---

## 四、問題三：開頭模式過度強制

### 4.1 問題描述

現有系統強制所有貼文使用「數據驅動開頭模式」：

```typescript
// 行 3209-3217
`=== 數據驅動開頭規則（本次生成必須使用） ===
【本次指定開頭模式】${selectedOpenerPattern?.name || '冠號斷言'}
【效果倍數】${selectedOpenerPattern?.effect || 2.8}x
【重要】第一行必須使用上述模式，不能使用其他開頭方式！`
```

這導致所有貼文的開頭風格趨同，產生「公式化」的感覺。

### 4.2 具體影響

| 影響 | 說明 |
|------|------|
| **開頭趨同** | 所有貼文開頭都是「冠號斷言」或類似格式 |
| **失去個人特色** | 創作者的獨特開頭方式被覆蓋 |
| **讀者疲勞** | 追蹤者看多了會覺得「又是這種開頭」 |

### 4.3 修改方案

#### 方案：開頭模式建議化（非強制）

```typescript
// 修改前
const openerPrompt = `=== 數據驅動開頭規則（本次生成必須使用） ===
【本次指定開頭模式】${selectedOpenerPattern?.name || '冠號斷言'}
【重要】第一行必須使用上述模式，不能使用其他開頭方式！`;

// 修改後
const openerPrompt = `=== 開頭建議（參考即可） ===
【建議模式】${selectedOpenerPattern?.name || '冠號斷言'}
【效果說明】這種開頭在數據上表現較好（${selectedOpenerPattern?.effect || 2.8}x）
【但是】如果這次的內容更適合其他開頭方式，請自由發揮
【你的風格】${userStyle?.commonOpenings?.join('、') || '尚未分析'}`;
```

#### 方案 B：開頭模式輪換

如果仍想保留數據驅動，可以改為**輪換機制**：

```typescript
// 記錄用戶最近 5 篇貼文的開頭模式
const recentOpeners = await db.getRecentOpenerPatterns(ctx.user.id, 5);

// 選擇一個最近沒用過的模式
const availablePatterns = OPENER_PATTERNS.filter(
  p => !recentOpeners.includes(p.name)
);
const selectedPattern = availablePatterns[Math.floor(Math.random() * availablePatterns.length)];
```

### 4.4 修改位置

**檔案**：`server/routers.ts`  
**行數**：3209-3227（數據驅動開頭規則區塊）

### 4.5 預期效果

| 指標 | 修改前 | 修改後 |
|------|--------|--------|
| 開頭多樣性 | 低（1-2 種） | 高（5+ 種） |
| 個人特色保留 | 低 | 高 |
| 讀者疲勞度 | 高 | 低 |

---

## 五、問題四：Few-Shot 學習方式不當

### 5.1 問題描述

現有系統的 Few-Shot 學習機制（`buildUserStyleContext` 函數）會直接注入用戶的範文：

```typescript
// 行 2706-2712
// 隨機選取 1 篇範文（而非固定前 3 篇）
const randomIndex = Math.floor(Math.random() * samplePosts.length);
const selectedPost = samplePosts[randomIndex];

parts.push(`--- 風格參考 ---`);
parts.push(selectedPost.content);
parts.push(`--- 參考結束 ---`);
```

雖然有加上「學習精神而非句式」的提示，但 LLM 仍然傾向**複製範文的句式**，而非學習風格。

### 5.2 具體影響

| 影響 | 說明 |
|------|------|
| **句式複製** | 生成的內容會出現範文中的句子 |
| **開頭重複** | 如果範文開頭是「昨天...」，生成的也會是「昨天...」 |
| **風格表面化** | 學到的是「怎麼寫」而非「怎麼說話」 |

### 5.3 修改方案

#### 方案：風格 DNA 提取（取代 Few-Shot）

**步驟 1：建立風格 DNA 結構**

```typescript
interface UserStyleDNA {
  // 語言層面
  emotionStyle: 'warm' | 'direct' | 'humorous' | 'reflective';
  emotionIntensity: 'low' | 'medium' | 'high';
  avgSentenceLength: number;
  paragraphPattern: string;
  
  // 常用元素（描述而非列舉）
  openingStyle: string;      // 例如：「喜歡用場景開頭」
  transitionStyle: string;   // 例如：「常用『但』來轉折」
  endingStyle: string;       // 例如：「喜歡用問句結尾」
  
  // 互動層面
  ctaFrequency: number;      // 0-1，CTA 出現頻率
  ctaStyle: string;          // 例如：「喜歡用開放式問題」
}
```

**步驟 2：從範文提取風格 DNA（而非直接注入範文）**

```typescript
async function extractStyleDNA(samplePosts: string[]): Promise<UserStyleDNA> {
  const response = await invokeLLM({
    messages: [
      {
        role: 'system',
        content: `你是風格分析專家。分析以下貼文，提取作者的「寫作風格」。

注意：你要提取的是「風格感覺」而非「具體句子」。
- 風格：這個人說話的「感覺」是什麼？
- 句式：這個人用什麼「句子」？（這不是我們要的）

請用 JSON 格式回答。`
      },
      {
        role: 'user',
        content: samplePosts.join('\n\n---\n\n')
      }
    ],
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'style_dna',
        schema: {
          type: 'object',
          properties: {
            emotionStyle: { type: 'string' },
            emotionIntensity: { type: 'string' },
            avgSentenceLength: { type: 'number' },
            openingStyle: { type: 'string' },
            transitionStyle: { type: 'string' },
            endingStyle: { type: 'string' }
          }
        }
      }
    }
  });
  
  return JSON.parse(response.choices[0].message.content);
}
```

**步驟 3：用風格 DNA 取代 Few-Shot**

```typescript
// 修改前（直接注入範文）
const buildUserStyleContext = async () => {
  // ...
  parts.push(`--- 風格參考 ---`);
  parts.push(selectedPost.content);  // ❌ 直接注入範文
  parts.push(`--- 參考結束 ---`);
  // ...
};

// 修改後（注入風格 DNA）
const buildUserStyleContext = async () => {
  const styleDNA = await extractStyleDNA(samplePosts);
  
  return `=== 你的說話方式 ===
情緒風格：${styleDNA.emotionStyle}（${styleDNA.emotionIntensity} 強度）
句子長度：平均 ${styleDNA.avgSentenceLength} 字
開頭習慣：${styleDNA.openingStyle}
轉折習慣：${styleDNA.transitionStyle}
結尾習慣：${styleDNA.endingStyle}

請用這種「感覺」寫作，不要模仿具體句子。`;
};
```

### 5.4 修改位置

**檔案**：`server/routers.ts`  
**函數**：`buildUserStyleContext`  
**行數**：2621-2720

### 5.5 預期效果

| 指標 | 修改前 | 修改後 |
|------|--------|--------|
| 句式複製率 | 高 | 低 |
| 風格一致性 | 中 | 高 |
| 開頭多樣性 | 低 | 高 |

---

## 六、問題五：CTA 結尾公式化

### 6.1 問題描述

現有系統的每種內容類型都有固定的 CTA 結尾：

```typescript
// 行 2732-2733（提問型）
`結尾用「你們覺得呢？」或「想聽聽大家的看法」`

// 行 2814（對話型）
`結尾問：「你們會怎麼回答？」`

// 行 2832（引用型）
`結尾問：「這句話對你來說有什麼意義？」`

// 行 2852（診斷型）
`CTA：「你是哪一型？」「有沒有中？」`

// 行 2869（整理型）
`結尾問：「你中了幾個？」「還有什麼想補充的？」`
```

這導致所有貼文的結尾都是問句，產生「公式化」的感覺。

### 6.2 具體影響

| 影響 | 說明 |
|------|------|
| **結尾趨同** | 所有貼文結尾都是「你們覺得呢？」類型的問句 |
| **失去自然感** | 真實的聊天不會每次都以問句結尾 |
| **讀者疲勞** | 追蹤者看多了會覺得「又是這種結尾」 |

### 6.3 修改方案

#### 方案：CTA 多樣化 + 可選化

**步驟 1：建立 CTA 類型庫**

```typescript
const CTA_TYPES = {
  question: {
    name: '問句型',
    examples: ['你們覺得呢？', '你有過這種經驗嗎？', '想聽聽大家的看法'],
    frequency: 0.4  // 40% 的貼文使用
  },
  statement: {
    name: '陳述型',
    examples: ['就這樣。', '以上。', '先這樣，改天再聊。'],
    frequency: 0.3  // 30% 的貼文使用
  },
  reflection: {
    name: '反思型',
    examples: ['我還在想這件事。', '不知道對不對，但這是我目前的想法。'],
    frequency: 0.2  // 20% 的貼文使用
  },
  none: {
    name: '無 CTA',
    examples: ['（直接結束，不加任何引導）'],
    frequency: 0.1  // 10% 的貼文不加 CTA
  }
};
```

**步驟 2：根據內容類型和隨機性選擇 CTA**

```typescript
function selectCTAType(contentType: string): string {
  // 根據內容類型調整權重
  const weights = { ...CTA_TYPES };
  
  if (contentType === 'casual') {
    // 閒聊型更適合陳述型或無 CTA
    weights.statement.frequency = 0.5;
    weights.none.frequency = 0.3;
    weights.question.frequency = 0.2;
  }
  
  // 隨機選擇
  const random = Math.random();
  let cumulative = 0;
  for (const [type, config] of Object.entries(weights)) {
    cumulative += config.frequency;
    if (random < cumulative) {
      return type;
    }
  }
  return 'question';
}
```

**步驟 3：修改提示詞**

```typescript
// 修改前
`結尾問：「你們覺得呢？」`

// 修改後
const ctaType = selectCTAType(input.contentType);
const ctaPrompt = ctaType === 'none' 
  ? `結尾：自然結束即可，不需要刻意加問句`
  : `結尾建議（${CTA_TYPES[ctaType].name}）：${CTA_TYPES[ctaType].examples[0]}（或類似的）`;
```

### 6.4 修改位置

**檔案**：`server/routers.ts`  
**行數**：2722-2916（各內容類型的提示詞）

### 6.5 預期效果

| 指標 | 修改前 | 修改後 |
|------|--------|--------|
| 結尾多樣性 | 低（1 種） | 高（4 種） |
| 問句結尾比例 | 100% | 40% |
| 自然感 | 低 | 高 |

---

## 七、問題六：禁止規則過多反而產生刻意感

### 7.1 問題描述

現有系統有大量的「禁止」規則：

```typescript
// 行 3190-3245
`=== 絕對禁止（違反 = 重寫） ===

### 禁止 AI 常用詞
- 「讓我們」「一起來」「今天要分享」「分享一下」
- 「親愛的朋友們」「各位」「大家好」
- 「在這個快節奏的時代」「在這個資訊爆炸的時代」
- 「總而言之」「總結來說」「最後」
- 「希望這篇文章對你有幫助」

### 禁止結構詞
- 「首先」「其次」「最後」「第一」「第二」「第三」
- 「接下來」「然後」（可用「後來」代替）

### 開頭規則（極度重要 - 必須嚴格執行）
「禁止開頭方式」：
- 不能用「你有沒有過這樣的經驗？」開頭（太制式）
- 不能用「今天想跟大家分享...」開頭
- 不能用「最近很多人問我...」開頭（除非真的有）
- 不能用「其實」「其實呢」開頭（太弱）
- 不能用「我覺得」開頭（太平）
- 不能用問句開頭（效果僅 0.4x）
- 不能用 Emoji 開頭（效果僅 0.6x）

「禁止虛構場景」（極度重要）：
- 絕對禁止使用「我媽突然問我...」「我朋友突然問我...」等虛構對話
- 絕對禁止使用「昨天有個案主跟我說...」（除非素材中明確提到）
- 絕對禁止使用「有人問我...」（除非素材中明確提到）
...`
```

當禁止規則過多時，LLM 會花大量精力「避開禁區」，反而產生**刻意感**——內容看起來像是「小心翼翼避開某些詞」。

### 7.2 具體影響

| 影響 | 說明 |
|------|------|
| **避開禁區的刻意感** | 內容看起來像是「小心翼翼」在寫 |
| **同義詞循環** | 為了避開禁止詞，使用不自然的替代詞 |
| **創作自由受限** | 有些情況下，禁止的詞其實是合適的 |

### 7.3 修改方案

#### 方案：精簡禁止規則 + 分級

**步驟 1：將禁止規則分為三級**

```typescript
const PROHIBITION_RULES = {
  // P0：絕對禁止（這些真的會讓內容很 AI）
  absolute: [
    '讓我們一起',
    '親愛的朋友們',
    '在這個快節奏的時代',
    '希望這篇文章對你有幫助'
  ],
  
  // P1：盡量避免（但某些情況下可以用）
  avoid: [
    '首先、其次、最後',  // 知識型貼文可以用
    '今天想跟大家分享',  // 如果真的是分享可以用
  ],
  
  // P2：注意使用（不是禁止，而是提醒）
  caution: [
    '你有沒有過這樣的經驗？',  // 偶爾用可以，但不要每篇都用
    '我覺得',  // 表達個人觀點時可以用
  ]
};
```

**步驟 2：精簡提示詞中的禁止規則**

```typescript
// 修改前（約 500 字的禁止規則）
`=== 絕對禁止（違反 = 重寫） ===
### 禁止 AI 常用詞
- 「讓我們」「一起來」...
### 禁止結構詞
- 「首先」「其次」...
### 開頭規則
「禁止開頭方式」：
- 不能用「你有沒有過這樣的經驗？」...
「禁止虛構場景」：
- 絕對禁止使用「我媽突然問我...」...
### 禁止結尾方式
- 不能用「希望對你有幫助」...`

// 修改後（約 100 字的禁止規則）
`=== 品質底線 ===
禁止這些 AI 感很重的詞：
「讓我們一起」「親愛的朋友們」「在這個快節奏的時代」「希望這篇文章對你有幫助」

其他的，用你的判斷。像真人說話就好。`
```

### 7.4 修改位置

**檔案**：`server/routers.ts`  
**行數**：3190-3245（絕對禁止區塊）

### 7.5 預期效果

| 指標 | 修改前 | 修改後 |
|------|--------|--------|
| 禁止規則數 | 30+ 條 | 4-5 條 |
| 刻意感 | 高 | 低 |
| 創作自由度 | 低 | 高 |

---

## 八、問題七：缺少創作目標分流

### 8.1 問題描述

現有系統對所有內容都套用相同的「爆款策略」，沒有根據創作目標調整策略。

但根據您的「第一性原理」分析：

> 「不是每篇內容都要成為爆款，更重要的是整體內容和人設的一致性及長期信任的建立。」

### 8.2 具體影響

| 影響 | 說明 |
|------|------|
| **所有內容都像在「衝流量」** | 即使是閒聊型貼文也被加上爆款元素 |
| **失去內容多元性** | 沒有「輕鬆」「隨意」的內容 |
| **創作者疲勞** | 每篇都要「爆款」很累 |

### 8.3 修改方案

#### 方案：創作目標分流系統

**步驟 1：定義創作目標類型**

```typescript
type ContentGoalType = 'express' | 'interact' | 'value' | 'convert' | 'viral';

const CONTENT_GOALS = {
  express: {
    name: '表達型',
    description: '只是想說說話，不追求互動或流量',
    strategy: {
      viralElements: false,
      ctaRequired: false,
      structureRequired: false,
      promptLength: 'minimal'
    }
  },
  interact: {
    name: '互動型',
    description: '想引發討論和互動',
    strategy: {
      viralElements: false,
      ctaRequired: true,
      ctaType: 'question',
      structureRequired: false,
      promptLength: 'short'
    }
  },
  value: {
    name: '價值型',
    description: '想分享知識或經驗',
    strategy: {
      viralElements: false,
      ctaRequired: false,
      structureRequired: true,
      promptLength: 'medium'
    }
  },
  convert: {
    name: '導流型',
    description: '想引導讀者採取行動',
    strategy: {
      viralElements: false,
      ctaRequired: true,
      ctaType: 'action',
      structureRequired: false,
      promptLength: 'medium'
    }
  },
  viral: {
    name: '爆款型',
    description: '想衝流量和曝光',
    strategy: {
      viralElements: true,
      ctaRequired: true,
      structureRequired: true,
      promptLength: 'full'
    }
  }
};
```

**步驟 2：根據目標調整提示詞**

```typescript
function buildPromptByGoal(goal: ContentGoalType): string {
  const config = CONTENT_GOALS[goal].strategy;
  
  let prompt = CORE_PROMPT; // 核心指令（永遠存在）
  
  if (config.promptLength === 'minimal') {
    // 表達型：最少規則
    return `${prompt}

這次只是想說說話，不需要任何技巧。
用你的口氣，說出你想說的。`;
  }
  
  if (config.viralElements) {
    // 爆款型：加入爆款元素
    prompt += VIRAL_ELEMENTS_PROMPT;
  }
  
  if (config.ctaRequired) {
    // 需要 CTA
    prompt += `\n結尾：${config.ctaType === 'question' ? '用問句引導互動' : '引導讀者採取行動'}`;
  }
  
  return prompt;
}
```

**步驟 3：前端 UI 調整**

在生成草稿前，讓用戶選擇創作目標：

```tsx
<div className="flex gap-2 mb-4">
  <Button 
    variant={goal === 'express' ? 'default' : 'outline'}
    onClick={() => setGoal('express')}
  >
    💭 表達
  </Button>
  <Button 
    variant={goal === 'interact' ? 'default' : 'outline'}
    onClick={() => setGoal('interact')}
  >
    💬 互動
  </Button>
  <Button 
    variant={goal === 'value' ? 'default' : 'outline'}
    onClick={() => setGoal('value')}
  >
    📚 價值
  </Button>
  <Button 
    variant={goal === 'viral' ? 'default' : 'outline'}
    onClick={() => setGoal('viral')}
  >
    🔥 爆款
  </Button>
</div>
```

### 8.4 修改位置

**檔案**：
- `server/routers.ts`（後端邏輯）
- `client/src/pages/PostCreationStudio.tsx`（前端 UI）

### 8.5 預期效果

| 指標 | 修改前 | 修改後 |
|------|--------|--------|
| 內容多元性 | 低 | 高 |
| 創作者自主權 | 低 | 高 |
| 輕鬆內容比例 | 0% | 可調整 |

---

## 九、問題八：缺少 AI 去痕後處理

### 9.1 問題描述

現有系統沒有「AI 去痕後處理」機制。即使提示詞優化得再好，生成的內容仍可能有 AI 痕跡。

### 9.2 具體影響

| 影響 | 說明 |
|------|------|
| **無法檢測 AI 痕跡** | 不知道生成的內容有多少 AI 感 |
| **無法自動修正** | 需要人工修改 |
| **無法量化改進** | 不知道優化是否有效 |

### 9.3 修改方案

#### 方案：AI 去痕後處理層

**步驟 1：建立 AI 痕跡檢測函數**

```typescript
interface AIPatternResult {
  hasAIPatterns: boolean;
  score: number; // 0-100，越高越像 AI
  patterns: {
    name: string;
    severity: 'high' | 'medium' | 'low';
    location: string;
  }[];
}

function detectAIPatterns(content: string): AIPatternResult {
  const patterns: AIPatternResult['patterns'] = [];
  let score = 0;
  
  // 1. 檢測 AI 詞彙
  const aiWords = ['此外', '值得一提', '綜上所述', '不可否認', '顯而易見'];
  for (const word of aiWords) {
    if (content.includes(word)) {
      patterns.push({
        name: `AI 詞彙：${word}`,
        severity: 'high',
        location: content.substring(content.indexOf(word) - 10, content.indexOf(word) + 20)
      });
      score += 15;
    }
  }
  
  // 2. 檢測句子長度一致性
  const sentences = content.split(/[。！？]/).filter(s => s.trim().length > 0);
  const lengths = sentences.map(s => s.length);
  const variance = calculateVariance(lengths);
  if (variance < 10 && sentences.length > 3) {
    patterns.push({
      name: '句子長度過於一致',
      severity: 'medium',
      location: '整篇文章'
    });
    score += 10;
  }
  
  // 3. 檢測公式化結尾
  const formulaicEndings = ['你覺得呢', '你怎麼看', '留言告訴我'];
  for (const ending of formulaicEndings) {
    if (content.endsWith(ending + '？') || content.endsWith(ending + '！')) {
      patterns.push({
        name: `公式化結尾：${ending}`,
        severity: 'low',
        location: content.substring(content.length - 30)
      });
      score += 5;
    }
  }
  
  return {
    hasAIPatterns: patterns.length > 0,
    score: Math.min(score, 100),
    patterns
  };
}
```

**步驟 2：建立自動修正函數**

```typescript
async function humanizeContent(content: string): Promise<string> {
  const detection = detectAIPatterns(content);
  
  if (detection.score < 20) {
    return content; // AI 感很低，不需要修正
  }
  
  // 用 LLM 修正
  const response = await invokeLLM({
    messages: [
      {
        role: 'system',
        content: `你是一位文字編輯，專門把「AI 感很重」的文字改成「人味十足」的文字。

檢測到的 AI 痕跡：
${detection.patterns.map(p => `- ${p.name}`).join('\n')}

請修正這些問題，但保持原意不變。
只輸出修正後的文字，不要任何解釋。`
      },
      {
        role: 'user',
        content: content
      }
    ]
  });
  
  return response.choices[0].message.content;
}
```

**步驟 3：整合到生成流程**

```typescript
// 在 generateDraft 的最後加入
const rawContent = response.choices[0].message.content;
const detection = detectAIPatterns(rawContent);

if (detection.score > 30) {
  // AI 感較高，自動修正
  const humanizedContent = await humanizeContent(rawContent);
  return {
    content: humanizedContent,
    aiScore: detectAIPatterns(humanizedContent).score,
    originalAiScore: detection.score,
    wasHumanized: true
  };
}

return {
  content: rawContent,
  aiScore: detection.score,
  wasHumanized: false
};
```

### 9.4 修改位置

**新增檔案**：`server/ai-humanizer.ts`  
**修改檔案**：`server/routers.ts`（generateDraft 函數）

### 9.5 預期效果

| 指標 | 修改前 | 修改後 |
|------|--------|--------|
| AI 痕跡檢測 | 無 | 有（量化分數） |
| 自動修正 | 無 | 有 |
| AI 感程度 | 不可控 | 可控（< 30 分） |

---

## 十、實施優先級與時程

### 10.1 優先級排序

| 優先級 | 問題 | 預估時間 | 效果 |
|--------|------|----------|------|
| **P0** | 問題一：提示詞過載 | 4 小時 | 🔴 高 |
| **P0** | 問題二：規則互相矛盾 | 2 小時 | 🔴 高 |
| **P1** | 問題三：開頭模式過度強制 | 2 小時 | 🟠 中 |
| **P1** | 問題四：Few-Shot 學習方式不當 | 6 小時 | 🟠 中 |
| **P1** | 問題五：CTA 結尾公式化 | 2 小時 | 🟠 中 |
| **P1** | 問題六：禁止規則過多 | 2 小時 | 🟠 中 |
| **P2** | 問題七：缺少創作目標分流 | 8 小時 | 🟡 中 |
| **P2** | 問題八：缺少 AI 去痕後處理 | 8 小時 | 🟡 中 |

### 10.2 建議實施順序

**第一階段（1-2 天）**：
1. 問題一：提示詞過載 → 精簡到 500 字以內
2. 問題二：規則互相矛盾 → 統一規則方向
3. 問題六：禁止規則過多 → 精簡到 5 條以內

**第二階段（2-3 天）**：
4. 問題三：開頭模式過度強制 → 改為建議而非強制
5. 問題五：CTA 結尾公式化 → 加入多樣化機制
6. 問題四：Few-Shot 學習方式不當 → 改為風格 DNA 提取

**第三階段（3-5 天）**：
7. 問題七：缺少創作目標分流 → 建立目標分流系統
8. 問題八：缺少 AI 去痕後處理 → 建立檢測和修正機制

### 10.3 預期總體效果

| 指標 | 修改前 | 修改後 |
|------|--------|--------|
| 提示詞長度 | 4,000 字 | 500 字 |
| AI 感程度 | 高 | 低 |
| 輸出穩定性 | 低 | 高 |
| 創作者自主權 | 低 | 高 |
| 內容多樣性 | 低 | 高 |

---

## 附錄：修改檔案清單

| 檔案 | 修改內容 |
|------|----------|
| `server/routers.ts` | generateDraft 函數的 systemPrompt 重構 |
| `server/routers.ts` | buildUserStyleContext 函數改為風格 DNA |
| `server/routers.ts` | 各內容類型的 CTA 多樣化 |
| `server/ai-humanizer.ts` | 新增 AI 去痕後處理模組 |
| `client/src/pages/PostCreationStudio.tsx` | 新增創作目標選擇 UI |

---

**報告結束**

如果您想開始實作，我建議從**第一階段**開始，這是最快見效且風險最低的改動。
