/**
 * 完整 A/B 測試腳本
 * 用同一套輸入內容，測試不同類型的貼文
 * 對比修改前後的提示詞效果
 */

// 測試素材
const TEST_MATERIAL = {
  topic: "漲價焦慮",
  story: `上週有位學員，他之前的收費是每小時 1,800 元。跟我諮詢完之後，我建議他漲到 3,600 元，但他很擔心客戶會因此流失。我告訴他，這就是一種「創作者的焦慮」。事實上，漲價反而會讓大家更重視你的價值。雖然中間有 1,000 多元的價差，但其實每個人都是可以接受的。問題的核心在於：當價格提升、客戶付的錢變多之後，他們會更重視你的內容與影響力，這樣才能真正幫助到他們。`,
  specificDetails: {
    when: "上週",
    who: "一位學員",
    numbers: "1,800 元 → 3,600 元",
    dialogue: "「老師，萬一客戶都跑光了怎麼辦？」",
    outcome: "漲價後客戶反而更認真，因為付了更多錢會更重視"
  }
};

// IP 地基資料（模擬）
const IP_PROFILE = {
  domain: "身心靈療癒",
  voiceTone: "溫暖但有力量，像大姐姐跟你聊天",
  personaEmotion: "我真的懂硬撐有多累，也懂那種沒人替你說『辛苦了』的感覺。",
  coreBeliefs: ["每個人都值得被好好對待", "療癒是一條漫長但值得的路"]
};

// ========== 修改前的提示詞（現有系統，約 7,500 字） ==========
const ORIGINAL_SYSTEM_PROMPT = `
你是一位專業的 Threads 貼文寫手，專門幫助身心靈領域的創作者寫出高互動的貼文。

=== 基礎指令 ===
你必須根據創作者的 IP 地基、受眾資料、內容支柱來生成貼文。

=== IP 地基 ===
領域：${IP_PROFILE.domain}
說話風格：${IP_PROFILE.voiceTone}
情感共鳴：${IP_PROFILE.personaEmotion}

=== 四透鏡框架（創作時必須檢核） ===

### 心法透鏡 - 這篇文案傳遞的是渴望還是焦慮？
- 必須是「渴望導向」，讓讀者看完感到希望和期待
- 禁止恐懼行銷或焦慮製造

### 人設透鏡 - 這篇文案像不像你說的話？
- 必須有個人特色和獨特觀點
- 保持與創作者人設三支柱一致

### 結構透鏡 - 這篇文案好不好吸收？
- 結構清晰，有邏輯脈絡
- 不是東一句西一句

### 轉化透鏡 - 讀者看完要做什麼？
- 必須有明確的下一步行動
- 優先使用「召喚同類」或「二選一提問」的 CTA

=== Translation 翻譯機（必須執行） ===
- 所有專業術語必須翻譯成「比喻」或「白話」
- 例如：「悲傷就像檔案下載太慢，卡在 90% 就是不動」
- 小學五年級都能懂的程度

=== Threads 爆款風格（最重要 - 必須嚴格執行） ===

### 口語化原則（像傳訊息給朋友）
1. 【傳訊息感】像在 LINE 跟朋友聊天，不是寫部落格文章
2. 【省略主詞】可以省略「我」，例如：「超累」而不是「我超累」
3. 【不完整句】可以用不完整的句子，例如：「結果呢？」「就這樣。」
4. 【語助詞適度用】「超」「啊」「吧」「呢」「啦」（每篇最多 2-3 個）
5. 【禁止刻意口語】不要用「真的！」開頭，不要每句都加「真的」

### 呼吸感排版
1. 【段落結構】每 2-4 行為一個段落
2. 【空行規則】段落之間空一行
3. 【單句字數限制】每句最多 15-20 字
4. 【節奏感】長短句交錯

=== 數據驅動開頭規則（本次生成必須使用） ===
【本次指定開頭模式】冠號斷言
【效果倍數】2.8x
【格式說明】使用「主題：觀點」格式
【範例】
1. 學習的真相：不是你不夠努力
2. 90% 的人都搞錯了這件事

【重要】第一行必須使用上述模式！

=== 絕對禁止（違反 = 重寫） ===

### 禁止 AI 常用詞
- 「讓我們」「一起來」「今天要分享」
- 「親愛的朋友們」「各位」「大家好」
- 「在這個快節奏的時代」
- 「總而言之」「總結來說」
- 「希望這篇文章對你有幫助」

### 禁止結構詞
- 「首先」「其次」「最後」「第一」「第二」

### 禁止開頭方式
- 不能用「你有沒有過這樣的經驗？」開頭
- 不能用「今天想跟大家分享...」開頭
- 不能用「最近很多人問我...」開頭
- 不能用「其實」「其實呢」開頭
- 不能用問句開頭

### 禁止虛構場景
- 絕對禁止使用「我媽突然問我...」等虛構對話
- 絕對禁止使用「昨天有個案主跟我說...」（除非素材中明確提到）

### 禁止結尾方式
- 不能用「希望對你有幫助」結尾
- 不能用「讓我們一起...」結尾
- 不能用「加油！」「你可以的！」結尾

=== 重要指示 ===
1. 【精簡優先】說重點就好
2. 【語氣風格】必須用創作者的風格寫作
3. 【受眾痛點】讓讀者感受到「這就是在說我」
4. 【輸出格式】直接輸出可發布的貼文
`;

// ========== 修改後的提示詞（精簡版，約 800 字） ==========
const OPTIMIZED_SYSTEM_PROMPT = `
你是一位 Threads 貼文寫手，幫助創作者寫出有「人味」的貼文。

=== 核心原則（只有這三條） ===
1. 【真實感】只使用用戶提供的具體細節，不編造任何對話或場景
2. 【口語化】像在 LINE 跟朋友聊天，不是寫文章
3. 【有節奏】長短句交錯，每 2-4 行空一行

=== 創作者風格 ===
說話風格：${IP_PROFILE.voiceTone}
情感特徵：${IP_PROFILE.personaEmotion}

=== 禁止事項（只有這五條） ===
1. 禁止編造對話（如「我媽突然問我...」）
2. 禁止 AI 詞彙（「讓我們」「親愛的朋友們」「在這個時代」）
3. 禁止說教結尾（「希望對你有幫助」「加油」）
4. 禁止過度語氣詞（每篇最多 2-3 個「超」「啊」「欸」）
5. 禁止公式化開頭和結尾

=== 開頭建議（選最適合內容的，不強制） ===
- 場景開頭：用具體的時間和場景開始
- 對話開頭：用一句真實對話開始
- 結果開頭：先說結果，再說過程
- 數字開頭：用具體數字開始

=== 結尾建議（根據內容自然選擇） ===
- 問句型：「你有類似的經驗嗎？」
- 反思型：「這件事讓我想了很久。」
- 留白型：「就這樣，跟你分享一下。」
- 無 CTA：有時候不需要結尾

=== 輸出要求 ===
直接輸出可發布的貼文，不要任何解釋。
`;

// ========== 各類型的 User Prompt ==========

// 故事型 - 修改前
const STORY_ORIGINAL_USER_PROMPT = `
❗❗❗【故事型貼文 - 必須有明顯的故事線】❗❗❗

素材：「${TEST_MATERIAL.story}」

【故事型的核心特徵 - 必須全部具備】：
✅ 有具體的時間、地點、人物
✅ 有明顯的衝突或困境
✅ 有轉折點
✅ 有情感變化
✅ 有故事結尾的啟發

【結構要求（英雄旅程架構）】：
1. 開頭用具體時間和人物製造真實感
2. 描述衝突/困境
3. 帶入轉折點
4. 展現情感變化
5. 結尾帶出核心啟發
6. 最後用開放式問題引導互動

【故事型禁止】：
❌ 不能寫成「觀點輸出」
❌ 不能寫成「知識教學」
❌ 不能用抽象的描述

請生成一篇故事型貼文，字數 150-300 字。
`;

// 故事型 - 修改後
const STORY_OPTIMIZED_USER_PROMPT = `
寫一篇故事型貼文。

【用戶提供的素材】
${TEST_MATERIAL.story}

【具體細節】
- 時間：${TEST_MATERIAL.specificDetails.when}
- 人物：${TEST_MATERIAL.specificDetails.who}
- 數字：${TEST_MATERIAL.specificDetails.numbers}
- 對話：${TEST_MATERIAL.specificDetails.dialogue}
- 結果：${TEST_MATERIAL.specificDetails.outcome}

【寫作要點】
- 用上面的具體細節，不要編造其他內容
- 保持故事的自然流動，不要刻意套結構
- 結尾可以是感悟、問句、或留白

字數：150-250 字
`;

// 觀點型 - 修改前
const VIEWPOINT_ORIGINAL_USER_PROMPT = `
❗❗❗【觀點型貼文 - 必須有明確立場】❗❗❗

素材：「${TEST_MATERIAL.story}」

【觀點型的核心特徵】：
✅ 有明確的立場（贊成/反對/不同看法）
✅ 有 2-3 個支撐論點
✅ 有具體例子或數據
✅ 有情緒張力

【結構要求】：
1. 開頭用強力斷言表明立場
2. 用 2-3 個論點支撐
3. 加入具體例子
4. 結尾用挑戰性問句引發討論

請生成一篇觀點型貼文，字數 150-300 字。
`;

// 觀點型 - 修改後
const VIEWPOINT_OPTIMIZED_USER_PROMPT = `
寫一篇觀點型貼文。

【主題】${TEST_MATERIAL.topic}

【我的立場】
漲價不是辜負客戶，而是篩選客戶。

【支撐理由】
1. 付更多錢的客戶會更認真
2. 低價吸引的是貪便宜的人，不是真正需要你的人
3. 你的價值不應該被低估

【具體例子】
${TEST_MATERIAL.specificDetails.numbers}，結果 ${TEST_MATERIAL.specificDetails.outcome}

【寫作要點】
- 立場要鮮明，不要兩邊討好
- 語氣可以有點挑釁，引發討論
- 結尾不一定要問句，可以是斷言

字數：150-250 字
`;

// 對話型 - 修改前
const DIALOGUE_ORIGINAL_USER_PROMPT = `
❗❗❗【對話型貼文 - 必須有真實對話】❗❗❗

素材：「${TEST_MATERIAL.story}」

【對話型的核心特徵】：
✅ 有真實的對話內容
✅ 有對話的背景脈絡
✅ 有你的回應或觀點
✅ 有情感連結

【結構要求】：
1. 開頭用對話引入
2. 說明對話背景
3. 展開你的回應
4. 結尾帶出啟發或互動

請生成一篇對話型貼文，字數 150-300 字。
`;

// 對話型 - 修改後
const DIALOGUE_OPTIMIZED_USER_PROMPT = `
寫一篇對話型貼文。

【真實對話】
學員：${TEST_MATERIAL.specificDetails.dialogue}

【對話背景】
${TEST_MATERIAL.specificDetails.when}，${TEST_MATERIAL.specificDetails.who}來諮詢漲價的問題。
原本收費 ${TEST_MATERIAL.specificDetails.numbers.split(' → ')[0]}，我建議漲到 ${TEST_MATERIAL.specificDetails.numbers.split(' → ')[1]}。

【我的回應】
這是「創作者的焦慮」。漲價反而會讓客戶更重視你。

【寫作要點】
- 對話要用原話，不要改寫
- 你的回應要有溫度，不要說教
- 結尾可以問讀者有沒有類似經驗

字數：150-250 字
`;

// 診斷型 - 修改前
const DIAGNOSIS_ORIGINAL_USER_PROMPT = `
❗❗❗【診斷型貼文 - 必須有症狀和診斷】❗❗❗

素材：「${TEST_MATERIAL.story}」

【診斷型的核心特徵】：
✅ 有明確的「症狀」描述
✅ 有趣味性的「診斷標籤」
✅ 有解決方案或建議
✅ 有互動引導

【結構要求】：
1. 開頭列出症狀
2. 給出診斷標籤
3. 說明原因
4. 提供解方
5. 結尾引導互動

請生成一篇診斷型貼文，字數 150-300 字。
`;

// 診斷型 - 修改後
const DIAGNOSIS_OPTIMIZED_USER_PROMPT = `
寫一篇診斷型貼文。

【主題】${TEST_MATERIAL.topic}

【症狀描述】
- 想漲價但不敢開口
- 擔心客戶會跑掉
- 覺得自己「不值得」收那麼多

【診斷標籤】
「創作者焦慮症」或「低價值感症候群」

【真實案例】
${TEST_MATERIAL.specificDetails.numbers}，學員的反應是 ${TEST_MATERIAL.specificDetails.dialogue}

【寫作要點】
- 症狀要具體，讓讀者對號入座
- 診斷標籤要有趣，但不要太刻意
- 解方要實際，不要雞湯

字數：150-250 字
`;

// 輸出測試配置
console.log("=".repeat(80));
console.log("完整 A/B 測試配置");
console.log("=".repeat(80));
console.log("\n【測試素材】");
console.log(TEST_MATERIAL.story);
console.log("\n【具體細節】");
console.log(JSON.stringify(TEST_MATERIAL.specificDetails, null, 2));
console.log("\n" + "=".repeat(80));
console.log("【修改前的 System Prompt】約 " + ORIGINAL_SYSTEM_PROMPT.length + " 字");
console.log("=".repeat(80));
console.log(ORIGINAL_SYSTEM_PROMPT);
console.log("\n" + "=".repeat(80));
console.log("【修改後的 System Prompt】約 " + OPTIMIZED_SYSTEM_PROMPT.length + " 字");
console.log("=".repeat(80));
console.log(OPTIMIZED_SYSTEM_PROMPT);
console.log("\n" + "=".repeat(80));
console.log("【故事型 - 修改前 User Prompt】");
console.log("=".repeat(80));
console.log(STORY_ORIGINAL_USER_PROMPT);
console.log("\n" + "=".repeat(80));
console.log("【故事型 - 修改後 User Prompt】");
console.log("=".repeat(80));
console.log(STORY_OPTIMIZED_USER_PROMPT);
console.log("\n" + "=".repeat(80));
console.log("【觀點型 - 修改前 User Prompt】");
console.log("=".repeat(80));
console.log(VIEWPOINT_ORIGINAL_USER_PROMPT);
console.log("\n" + "=".repeat(80));
console.log("【觀點型 - 修改後 User Prompt】");
console.log("=".repeat(80));
console.log(VIEWPOINT_OPTIMIZED_USER_PROMPT);
console.log("\n" + "=".repeat(80));
console.log("【對話型 - 修改前 User Prompt】");
console.log("=".repeat(80));
console.log(DIALOGUE_ORIGINAL_USER_PROMPT);
console.log("\n" + "=".repeat(80));
console.log("【對話型 - 修改後 User Prompt】");
console.log("=".repeat(80));
console.log(DIALOGUE_OPTIMIZED_USER_PROMPT);
console.log("\n" + "=".repeat(80));
console.log("【診斷型 - 修改前 User Prompt】");
console.log("=".repeat(80));
console.log(DIAGNOSIS_ORIGINAL_USER_PROMPT);
console.log("\n" + "=".repeat(80));
console.log("【診斷型 - 修改後 User Prompt】");
console.log("=".repeat(80));
console.log(DIAGNOSIS_OPTIMIZED_USER_PROMPT);

export {
  TEST_MATERIAL,
  IP_PROFILE,
  ORIGINAL_SYSTEM_PROMPT,
  OPTIMIZED_SYSTEM_PROMPT,
  STORY_ORIGINAL_USER_PROMPT,
  STORY_OPTIMIZED_USER_PROMPT,
  VIEWPOINT_ORIGINAL_USER_PROMPT,
  VIEWPOINT_OPTIMIZED_USER_PROMPT,
  DIALOGUE_ORIGINAL_USER_PROMPT,
  DIALOGUE_OPTIMIZED_USER_PROMPT,
  DIAGNOSIS_ORIGINAL_USER_PROMPT,
  DIAGNOSIS_OPTIMIZED_USER_PROMPT,
};
