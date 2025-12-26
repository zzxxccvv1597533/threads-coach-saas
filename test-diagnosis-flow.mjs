import { ALL_CONTENT_TYPES_V2 } from './shared/content-types-v2.js';

const diagnosisType = ALL_CONTENT_TYPES_V2.find(t => t.id === 'diagnosis');
console.log('diagnosisType found:', !!diagnosisType);
console.log('inputFields:', diagnosisType?.inputFields);
console.log('inputFields type:', typeof diagnosisType?.inputFields);
console.log('inputFields is array:', Array.isArray(diagnosisType?.inputFields));

// 測試 Object.entries
const typeInputs = {
  symptoms: '1. 每天打開手機想到要發文就覺得壓力大',
  diagnosis_label: '內容創作倦怠症候群',
  explanation: '不是你不夠努力，是你把「被看見」跟「被認可」綁在一起了。'
};

console.log('typeInputs:', typeInputs);
console.log('Object.entries(typeInputs):', Object.entries(typeInputs));

// 測試 materialParts 的展開邏輯
const materialParts = [
  '主題：測試主題',
  '開頭 Hook：測試 Hook',
  ...Object.entries(typeInputs).map(([key, value]) => {
    const field = diagnosisType?.inputFields?.find(f => f.key === key);
    return field ? `${field.label}：${value}` : '';
  }).filter(Boolean),
];

console.log('materialParts:', materialParts);
