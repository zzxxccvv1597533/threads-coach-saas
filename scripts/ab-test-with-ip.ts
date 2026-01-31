/**
 * A/B 測試：加入 IP 地基和具體故事素材
 */

const FORGE_API_URL = process.env.BUILT_IN_FORGE_API_URL;
const FORGE_API_KEY = process.env.BUILT_IN_FORGE_API_KEY;

// 具體故事素材（用戶提供）
const CONCRETE_MATERIAL = `上週有一位學員，他之前的收費是每小時 1,800 元。
跟我諮詢完之後，我建議他漲到 3,600 元，但他很擔心客戶會因此流失。
我告訴他，這就是一種「創作者的焦慮」。
事實上，漲價反而會讓大家更重視你的價值。
雖然中間有 1,000 多元的價差，但其實每個人都是可以接受的。
問題的核心在於：當價格提升、客戶付的錢變多之後，他們會更重視你的內容與影響力，這樣才能真正幫助到他們。`;

// 模擬的 IP 地基資料（從資料庫中取得的真實資料）
const IP_PROFILE = {
  occupation: '可青老師 陪你找到人生對的路/八字命理師',
  voiceTone: '溫柔、專業',
  viewpointStatement: '命不是注定 一切都是可以透過自覺 自省的過程 我陪著你逐步調整自己 境隨心轉 漸漸轉變 慢慢變好',
  personaExpertise: '幫你看懂你背錯了哪些功課，並陪你把人生放回正確的位置。',
  personaEmotion: '我真的懂硬撐有多累，也懂那種沒人替你說「辛苦了」的感覺。',
  identityTags: ['職場女性', '自由工作者', '創業者', '媽媽'],
};

async function invokeLLM(systemPrompt: string, userPrompt: string): Promise<string> {
  const response = await fetch(`${FORGE_API_URL}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${FORGE_API_KEY}`
    },
    body: JSON.stringify({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.7
    })
  });
  
  const data = await response.json();
  return data.choices[0].message.content;
}

// ============================================
// 版本 D：加入 IP 地基 + 具體故事（精簡提示詞）
// ============================================
const PROMPT_VERSION_D = `你是「${IP_PROFILE.occupation}」。

=== 你的說話風格 ===
語氣：${IP_PROFILE.voiceTone}
核心信念：${IP_PROFILE.viewpointStatement}
專業定位：${IP_PROFILE.personaExpertise}
情感連結：${IP_PROFILE.personaEmotion}

=== 這次要分享的故事 ===
${CONCRETE_MATERIAL}

=== 寫作要求 ===
- 用你平常說話的方式寫
- 像在跟朋友聊天，不是在教學
- 200-350 字
- 不要用「此外」「值得一提」「希望對你有幫助」

直接輸出貼文內容，不要任何解釋。`;

// ============================================
// 版本 E：極簡 + 具體故事（只有故事，沒有 IP 地基）
// ============================================
const PROMPT_VERSION_E = `你是一位命理師，要在 Threads 發一篇貼文。

=== 這次要分享的故事 ===
${CONCRETE_MATERIAL}

用你平常說話的方式寫，像在跟朋友聊天。
200-350 字。
不要用「此外」「值得一提」「希望對你有幫助」。

直接輸出貼文內容。`;

// ============================================
// 版本 F：只有 IP 地基，沒有具體故事（抽象素材）
// ============================================
const ABSTRACT_MATERIAL = `目前對於有一些老師（創作者），他們很擔心自己漲價之後，是不是會被原來的客戶討厭，或者是可能就沒有人諮詢這件事情。`;

const PROMPT_VERSION_F = `你是「${IP_PROFILE.occupation}」。

=== 你的說話風格 ===
語氣：${IP_PROFILE.voiceTone}
核心信念：${IP_PROFILE.viewpointStatement}
專業定位：${IP_PROFILE.personaExpertise}
情感連結：${IP_PROFILE.personaEmotion}

=== 主題 ===
${ABSTRACT_MATERIAL}

=== 寫作要求 ===
- 用你平常說話的方式寫
- 像在跟朋友聊天，不是在教學
- 200-350 字
- 不要用「此外」「值得一提」「希望對你有幫助」

直接輸出貼文內容，不要任何解釋。`;

async function runTest() {
  console.log('='.repeat(70));
  console.log('A/B 測試：IP 地基 + 具體故事的效果驗證');
  console.log('='.repeat(70));
  
  // 版本 D：IP 地基 + 具體故事
  console.log('\n【版本 D】IP 地基 + 具體故事（最完整）');
  console.log('-'.repeat(70));
  const resultD = await invokeLLM(PROMPT_VERSION_D, '請根據上述故事寫一篇貼文。');
  console.log(resultD);
  
  // 版本 E：只有具體故事
  console.log('\n【版本 E】只有具體故事（沒有 IP 地基）');
  console.log('-'.repeat(70));
  const resultE = await invokeLLM(PROMPT_VERSION_E, '請根據上述故事寫一篇貼文。');
  console.log(resultE);
  
  // 版本 F：只有 IP 地基
  console.log('\n【版本 F】只有 IP 地基 + 抽象素材（沒有具體故事）');
  console.log('-'.repeat(70));
  const resultF = await invokeLLM(PROMPT_VERSION_F, '請根據上述主題寫一篇貼文。');
  console.log(resultF);
  
  console.log('\n' + '='.repeat(70));
  console.log('測試完成');
  console.log('='.repeat(70));
}

runTest().catch(console.error);
