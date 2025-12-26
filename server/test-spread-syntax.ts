// 測試 spread 語法問題
// 模擬 GuidedWritingFlow 中的 typeInputs 處理

const typeInputs: Record<string, string> = {
  symptoms: "1. 每天發文但互動數都是個位數\n2. 寫的內容自己覺得很有價值",
  diagnosis_label: "自嗨式發文症候群",
  explanation: "你不是內容不好，而是你只寫了自己想看的東西。解法很簡單：先問"
};

// 模擬 GuidedWritingFlow 中的處理邏輯
const filledFlexibleInputs: Record<string, string> = {};
for (const [key, value] of Object.entries(typeInputs)) {
  if (value && typeof value === 'string' && value.trim()) {
    filledFlexibleInputs[key] = value;
  }
}

console.log("filledFlexibleInputs:", filledFlexibleInputs);
console.log("Object.keys length:", Object.keys(filledFlexibleInputs).length);

// 模擬 API 調用參數
const apiParams = {
  material: "主題：診斷型測試",
  contentType: "diagnosis",
  angle: "鏡像痛點",
  flexibleInput: Object.keys(filledFlexibleInputs).length > 0 ? filledFlexibleInputs : undefined,
};

console.log("API params:", JSON.stringify(apiParams, null, 2));

// 測試 spread 語法
try {
  const materialParts = [
    `主題：測試`,
    `開頭 Hook：測試 Hook`,
    ...Object.entries(typeInputs).map(([key, value]) => {
      return `${key}：${value}`;
    }).filter(Boolean),
  ];
  console.log("materialParts:", materialParts);
} catch (e) {
  console.error("Spread error:", e);
}
