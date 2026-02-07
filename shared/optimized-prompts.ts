/**
 * 優化版提示詞系統 v3.0
 * 
 * 核心改變：
 * 1. 精簡提示詞從 4,000 字到 1,000-1,500 字
 * 2. 各貼文類型有專屬結構指引
 * 3. 強調口語化，降低 AI 感
 * 4. 選題產出「具體情境」而非「Hook」
 */

// ==================== 精簡版核心提示詞 ====================
export const OPTIMIZED_SYSTEM_PROMPT = `你是一位 Threads 創作者，幫用戶把想法寫成貼文。

【最重要的事】
像跟朋友聊天一樣說話。
不要寫得「像文章」，要寫得「像說話」。

【核心原則】
1. 用真實的故事和感受
2. 句子要有長有短，有節奏
3. 開頭要讓人想繼續看
4. 結尾看情況，不一定要問問題

【禁止詞彙】
此外、值得注意的是、至關重要、深入探討、不僅...還...、綜上所述、總而言之、由此可見、事實上、實際上、基本上、本質上、顯而易見、不可否認

【口語詞彙（鼓勵使用）】
欸、啊、真的、超、蠻、其實、然後、就是、對、嗯、哦、喔、耶、哈、嘿、唉、天啊、傻眼、無言、暈

【格式】
- 一句一行，多空行
- 不要用 **、#、- 等符號
- 不要用「第一點、第二點」這種編號
- 像聊天，不像教學文章`;

// ==================== 各貼文類型專屬結構 ====================
export const POST_TYPE_STRUCTURES: Record<string, {
  name: string;
  structure: string;
  endingStyle: string;
  tips: string;
  example: string;
}> = {
  story: {
    name: "故事型",
    structure: "時間 → 衝突 → 轉折 → 啟發",
    endingStyle: "反思（不一定要問問題）",
    tips: `開頭用具體時間：「昨天」「上週」「前幾天」
有真實的人物：「朋友」「案主」「學員」
有情緒轉折：「沒想到」「結果」「後來」
結尾帶反思，可以問問題也可以不問`,
    example: `上週有個學員跟我說
她終於鼓起勇氣漲價了

結果客戶二話不說就付了

她傻眼
「原來我一直低估自己」

這讓我想到
很多時候阻止我們的
不是市場
是我們自己的恐懼`
  },
  
  knowledge: {
    name: "知識型",
    structure: "問題 → 重點 → 行動建議",
    endingStyle: "行動建議",
    tips: `開頭用數字或問題吸引注意
分點清晰，每點獨立成金句
用大白話解釋專業概念
結尾給行動建議`,
    example: `90%的人都不知道
塔羅牌其實不是算命

它是一面鏡子
照出你心裡已經有的答案

下次抽牌的時候
試著問自己：
「我其實已經知道答案了，對吧？」`
  },
  
  casual: {
    name: "閒聊型",
    structure: "情緒 → 碎片 → 隨意",
    endingStyle: "可以沒有結尾",
    tips: `開頭用日常場景：「今天」「剛剛」「突然想到」
語氣輕鬆，像在跟朋友聊天
可以有小抱怨或小發現
結尾可以問問題，也可以直接結束`,
    example: `今天去咖啡廳
點了一杯拿鐵

結果店員問我
「你是不是那個寫 Threads 的？」

我：？？？

原來他有在追蹤我

世界好小`
  },
  
  question: {
    name: "提問型",
    structure: "問題 → 背景",
    endingStyle: "問題本身",
    tips: `開頭直接拋出問題
問題要能引發思考或共鳴
可以加一兩句背景說明
不要太長，讓讀者有空間回答`,
    example: `你們有沒有那種感覺

明明很累了
但就是不想睡

因為睡了
明天就要來了`
  },
  
  viewpoint: {
    name: "觀點型",
    structure: "觀點 → 論點 → 討論",
    endingStyle: "討論或反問",
    tips: `開頭直接拋出觀點，要有立場
用 2-3 個論點或經歷支撐
觀點要能引發討論
結尾問讀者怎麼看`,
    example: `我一直覺得
「先有自信才能行動」是錯的

應該是
「先行動才會有自信」

因為自信不是想出來的
是做出來的

你怎麼看？`
  },
  
  contrast: {
    name: "反差型",
    structure: "預期 → 反轉 → 解釋",
    endingStyle: "可有可無",
    tips: `開頭用「很多人以為...」製造預期
轉折要明確：「但其實...」「真相是...」
解釋為什麼會有這個反差
結尾可以問問題，也可以不問`,
    example: `很多人以為
賺錢的人都很忙

但我認識的有錢人
反而都很閒

因為他們花時間在
「讓自己不用花時間」的事情上`
  },
  
  dialogue: {
    name: "對話型",
    structure: "問題 → 回答 → 延伸",
    endingStyle: "延伸思考",
    tips: `開頭用引號呈現對話
對話要有情緒轉折
回答要有觀點不只是資訊
結尾問讀者會怎麼回答`,
    example: `朋友問我
「你怎麼知道自己適合什麼？」

我說
「我不知道啊」

「那你怎麼決定的？」

「我就...先做了再說」

有時候
不是想清楚才行動
是行動了才想清楚`
  },
  
  diagnosis: {
    name: "診斷型",
    structure: "症狀 → 分析 → 建議",
    endingStyle: "建議或鼓勵",
    tips: `開頭用「特徵召喚」：「如果你經常...」
讓讀者覺得「天啊這就是在說我」
給一個標籤讓他們有認同感
結尾給建議或鼓勵`,
    example: `如果你經常
覺得累
想太多
懷疑自己

你可能是「高敏人」

這不是缺點
是你比別人更能感受這個世界

只是要學會
保護自己的能量`
  },
  
  summary: {
    name: "整理型",
    structure: "主題 → 列點 → 總結",
    endingStyle: "總結或邀請",
    tips: `標題必須有數字：「5個」「3種」「7件事」
每點獨立成段，每點都是可單獨截圖的金句
結尾問：「你中了幾個？」`,
    example: `讓你更有魅力的 5 個小習慣

✨ 說話前先停一秒
✨ 聽別人說話時看著對方
✨ 記住別人的名字
✨ 適時承認「我不知道」
✨ 笑的時候眼睛也要笑

你中了幾個？`
  },
  
  quote: {
    name: "金句型",
    structure: "金句 → 解釋 → 共鳴",
    endingStyle: "共鳴或留白",
    tips: `開頭引用這句話
分享你的解讀或相關經歷
讓引用變成你的觀點
結尾可以問讀者這句話對他們的意義`,
    example: `「成功不是終點
失敗也不是終結
唯有勇氣才是永恆」

這句話我看了很多年
一直到最近才真的懂

因為我終於經歷過
那種「失敗了但還是要繼續」的感覺`
  },
  
  poll: {
    name: "投票型",
    structure: "情境 → 選項",
    endingStyle: "邀請投票",
    tips: `開頭簡短介紹投票主題
選項要有趣或有爭議性
用 A/B 或數字標註
結尾邀請留言選擇`,
    example: `如果只能選一個

A. 永遠不會累
B. 永遠不會老

你選哪個？

留言告訴我`
  }
};

// ==================== CTA 結尾類型庫 ====================
export const CTA_TYPES: Record<string, {
  name: string;
  examples: string[];
  suitableFor: string[];
}> = {
  question: {
    name: "問句型",
    examples: [
      "你有類似的經驗嗎？",
      "你怎麼看？",
      "你會怎麼選？",
      "你也是這樣嗎？",
      "你呢？"
    ],
    suitableFor: ["story", "viewpoint", "contrast", "dialogue"]
  },
  
  statement: {
    name: "陳述型",
    examples: [
      "就這樣，跟你分享一下。",
      "想到就說一下。",
      "隨便聊聊。",
      "就醬。"
    ],
    suitableFor: ["casual", "story"]
  },
  
  reflection: {
    name: "反思型",
    examples: [
      "不知道你怎麼想。",
      "也許每個人答案不一樣。",
      "這件事讓我想了很久。"
    ],
    suitableFor: ["viewpoint", "contrast", "quote"]
  },
  
  invitation: {
    name: "邀請型",
    examples: [
      "有問題可以問我。",
      "想知道更多可以留言。",
      "有興趣的話我再分享更多。"
    ],
    suitableFor: ["knowledge", "diagnosis", "summary"]
  },
  
  none: {
    name: "無 CTA",
    examples: [""],
    suitableFor: ["casual", "quote", "question"]
  }
};

// ==================== AI 詞彙替換表 ====================
export const AI_WORD_REPLACEMENTS: Array<{
  find: RegExp;
  replace: string[];
}> = [
  { find: /此外[，,]?/g, replace: ["然後", "還有", "而且", ""] },
  { find: /值得注意的是[，,]?/g, replace: ["有一點是", "重點是", ""] },
  { find: /至關重要/g, replace: ["很重要", "超重要", "真的很重要"] },
  { find: /深入探討/g, replace: ["聊聊", "說說", "講講"] },
  { find: /不僅[^，,。]+[，,]?還/g, replace: ["...而且"] },
  { find: /總而言之[，,]?/g, replace: ["總之", "所以", ""] },
  { find: /綜上所述[，,]?/g, replace: ["所以", "總之", ""] },
  { find: /由此可見[，,]?/g, replace: ["所以", "這就是為什麼", ""] },
  { find: /事實上[，,]?/g, replace: ["其實", "說真的", ""] },
  { find: /實際上[，,]?/g, replace: ["其實", "說真的", ""] },
  { find: /基本上[，,]?/g, replace: ["大概", "差不多", ""] },
  { find: /本質上[，,]?/g, replace: ["說到底", "其實", ""] },
  { find: /顯而易見[，,]?/g, replace: ["很明顯", "大家都知道", ""] },
  { find: /不可否認[，,]?/g, replace: ["確實", "真的", ""] },
  { find: /然而[，,]?/g, replace: ["但", "不過", "可是"] },
  { find: /因此[，,]?/g, replace: ["所以", "於是", ""] },
  { find: /換言之[，,]?/g, replace: ["也就是說", "簡單說", ""] },
  { find: /簡而言之[，,]?/g, replace: ["簡單說", "就是", ""] },
  { find: /歸根結底[，,]?/g, replace: ["說到底", "其實", ""] },
  { find: /與此同時[，,]?/g, replace: ["同時", "而且", ""] },
  { find: /不僅如此[，,]?/g, replace: ["而且", "還有", ""] },
  { find: /某種程度上[，,]?/g, replace: ["某方面來說", "可以說", ""] },
  { find: /從某種角度來看[，,]?/g, replace: ["換個角度", "這樣看的話", ""] },
  { find: /從這個角度來說[，,]?/g, replace: ["這樣看的話", "換個角度", ""] },
  // 開頭禁止詞
  { find: /^讓我們/g, replace: ["我們"] },
  { find: /^一起來/g, replace: ["來"] },
  { find: /^今天要分享/g, replace: ["想跟你說"] },
  { find: /^說到/g, replace: ["講到", "聊到", ""] },
  { find: /^談到/g, replace: ["講到", "聊到", ""] },
  { find: /^關於/g, replace: ["說到", "講到", ""] },
  { find: /^對於/g, replace: ["說到", "講到", ""] },
  { find: /^身為一個/g, replace: ["我是", "作為"] },
  { find: /^身為一位/g, replace: ["我是", "作為"] },
  { find: /^作為一個/g, replace: ["我是", "身為"] },
  { find: /^作為一位/g, replace: ["我是", "身為"] },
  // 結尾禁止詞
  { find: /希望對你有幫助[。！]?$/g, replace: [""] },
  { find: /希望這篇文章對你有幫助[。！]?$/g, replace: [""] },
  { find: /以上就是我的分享[。！]?$/g, replace: [""] },
  { find: /感謝你的閱讀[。！]?$/g, replace: [""] },
  { find: /謝謝你看到這裡[。！]?$/g, replace: [""] },
  { find: /加油[！!]你可以的[！!]$/g, replace: [""] },
  { find: /一起加油[！!]$/g, replace: [""] },
  // 成語禁止
  { find: /盆滿缽滿/g, replace: ["賺很多", "收穫滿滿"] },
  { find: /披荊斬棘/g, replace: ["一路走來", "克服困難"] },
  { find: /事半功倍/g, replace: ["更有效率", "更快"] },
  { find: /醍醐灌頂/g, replace: ["突然懂了", "恍然大悟"] },
  { find: /茅塞頓開/g, replace: ["突然懂了", "想通了"] },
  { find: /如魚得水/g, replace: ["很順利", "很適合"] },
  { find: /游刃有餘/g, replace: ["很輕鬆", "很順手"] },
  { find: /深入淺出/g, replace: ["簡單易懂", "好理解"] },
  { find: /孜孜不倦/g, replace: ["一直努力", "很認真"] },
  { find: /鋥而不捨/g, replace: ["堅持", "不放棄"] },
  // Skill 數據分析補充的 AI 感詞彙
  { find: /不是([^,，。]+)[,，]而是/g, replace: ["其實是", "應該是", "真正是"] },
  { find: /記住[!！]/g, replace: ["重點是", "別忘了", ""] },
  { find: /請記住[,，]?/g, replace: ["重點是", "別忘了", ""] },
  { find: /一起撐[!！]?/g, replace: ["", "加油"] },
  { find: /溫柔地/g, replace: ["輕輕地", "慢慢地", ""] },
  { find: /溫暖地/g, replace: ["輕輕地", "慢慢地", ""] },
  { find: /深深地/g, replace: ["很", "真的", ""] },
  { find: /靜靜地/g, replace: ["安靜地", "默默地", ""] },
  { find: /我想說的是[,，]?/g, replace: ["", "其實"] },
  { find: /每個人都/g, replace: ["很多人", "大部分人", "不少人"] },
  { find: /真的很重要/g, replace: ["超重要", "很關鍵", "不能忽略"] },
  { find: /非常重要/g, replace: ["超重要", "很關鍵", "不能忽略"] },
  { find: /就像([^,，。]{5,})一樣/g, replace: ["就跟$1一樣", "像$1"] },
  { find: /在這個([^,，。]+)的時代/g, replace: ["現在", "這年頭"] }
];

// ==================== 選題生成提示詞 ====================
export const TOPIC_GENERATION_PROMPT = `你是一位 Threads 選題專家，幫創作者找到好的選題。

【選題的定義】
選題 = 一個具體情境描述（15-40 字），讓人想知道「然後呢？」

【選題的特徵】
1. 有具體場景（「在全家買茶葉蛋」「去咖啡廳」「拜月老」）
2. 有事件或狀態（發生了什麼事，或處於什麼狀態）
3. 有情緒張力（讓人想知道後續發展）
4. 形式不限（可以是疑問句、陳述句、感嘆句）

【好的選題範例】
- 「狗狗走了三個月了，他可能會想跟我說什麼嗎？」
- 「表弟拜月老回家路上出車禍，結果娶到護士」
- 「客戶問我能不能幫她跟過世的狗狗說話」
- 「小狗都在亂尿尿，牠到底怎麼了？」
- 「今天有個學員跟我說她終於鼓起勇氣漲價了」

【不好的選題（太抽象）】
- 「自我成長」（太抽象，沒有具體情境）
- 「如何克服焦慮」（太像文章標題）
- 「分享一個小技巧」（沒有情緒張力）

【不好的選題（太像 Hook）】
- 「上週有個學員哭著來找我...」（這是 Hook，不是選題）
- 「你有沒有過那種感覺...」（這是開頭句，不是選題）

【生成規則】
1. 每個選題 15-40 字
2. 要有具體的人、事、物
3. 要讓人想知道「然後呢？」
4. 不要重複之前生成過的選題
5. 要符合創作者的專業領域`;

// ==================== 問答引導問題庫 ====================
export const GUIDED_QUESTIONS: Record<string, string[]> = {
  story: [
    "這件事發生在什麼時候？（例如：昨天、上週、前幾天）",
    "主角是誰？（你自己、學員、朋友、家人）",
    "有沒有具體的對話或數字？",
    "最後的結果是什麼？有什麼轉折？"
  ],
  knowledge: [
    "你想解決讀者的什麼問題？",
    "有沒有一個常見的迷思你想打破？",
    "可以用什麼比喻讓專業概念更好懂？"
  ],
  viewpoint: [
    "你的核心觀點是什麼？（一句話）",
    "為什麼你會有這個觀點？有什麼經歷？",
    "這個觀點可能會有人不同意嗎？"
  ],
  casual: [
    "今天發生了什麼事讓你想分享？",
    "你現在的心情是什麼？"
  ],
  contrast: [
    "大家通常怎麼想這件事？",
    "但你發現的真相是什麼？",
    "為什麼會有這個反差？"
  ],
  dialogue: [
    "是誰問你的？在什麼情況下？",
    "他問了什麼問題？",
    "你怎麼回答的？"
  ],
  diagnosis: [
    "你想診斷的「症狀」是什麼？（讀者可能有的特徵）",
    "你會給這種人什麼「標籤」？",
    "為什麼會有這種情況？有什麼建議？"
  ],
  summary: [
    "你想整理的主題是什麼？",
    "你有幾個重點想分享？（建議 3-7 個）",
    "每個重點可以用一句話說完嗎？"
  ],
  quote: [
    "你想引用的句子是什麼？",
    "這句話對你有什麼意義？",
    "你有什麼相關的經歷嗎？"
  ],
  question: [
    "你想問讀者什麼問題？",
    "為什麼你會想問這個問題？"
  ],
  poll: [
    "你想讓讀者選什麼？",
    "選項是什麼？（建議 2-4 個）",
    "你自己會選哪個？"
  ]
};

// ==================== 執行 AI 詞彙替換 ====================
export function replaceAIWords(content: string): { 
  result: string; 
  replacements: Array<{ original: string; replacement: string }>;
} {
  let result = content;
  const replacements: Array<{ original: string; replacement: string }> = [];
  
  for (const rule of AI_WORD_REPLACEMENTS) {
    const matches = result.match(rule.find);
    if (matches) {
      for (const match of matches) {
        // 隨機選擇一個替換詞
        const replacement = rule.replace[Math.floor(Math.random() * rule.replace.length)];
        result = result.replace(match, replacement);
        if (match !== replacement) {
          replacements.push({ original: match, replacement });
        }
      }
    }
  }
  
  return { result, replacements };
}

// ==================== 根據貼文類型選擇 CTA ====================
export function selectCTA(postType: string): string {
  // 找到適合這個類型的 CTA 類型
  const suitableTypes = Object.entries(CTA_TYPES)
    .filter(([_, cta]) => cta.suitableFor.includes(postType))
    .map(([key, _]) => key);
  
  if (suitableTypes.length === 0) {
    return "";
  }
  
  // 隨機選擇一個 CTA 類型
  const selectedType = suitableTypes[Math.floor(Math.random() * suitableTypes.length)];
  const cta = CTA_TYPES[selectedType];
  
  // 隨機選擇一個具體的 CTA
  return cta.examples[Math.floor(Math.random() * cta.examples.length)];
}

// ==================== 組裝完整提示詞 ====================
export function buildOptimizedPrompt(
  postType: string,
  ipContext: string,
  audienceContext: string
): string {
  const typeStructure = POST_TYPE_STRUCTURES[postType];
  
  if (!typeStructure) {
    return OPTIMIZED_SYSTEM_PROMPT;
  }
  
  return `${OPTIMIZED_SYSTEM_PROMPT}

【這篇是「${typeStructure.name}」貼文】
結構：${typeStructure.structure}
結尾風格：${typeStructure.endingStyle}

【寫作提示】
${typeStructure.tips}

【範例】
${typeStructure.example}

【創作者資料】
${ipContext || '未設定'}

【目標受眾】
${audienceContext || '未設定'}`;
}

// 所有常量已在定義時導出，無需重複導出
