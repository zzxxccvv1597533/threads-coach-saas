import { ALL_CONTENT_TYPES_V2 } from './shared/content-types-v2.ts';

// 測試 diagnosis 類型
const diagnosis = ALL_CONTENT_TYPES_V2.find(t => t.id === 'diagnosis');
console.log('diagnosis found:', !!diagnosis);
console.log('inputFields:', diagnosis?.inputFields?.map(f => f.key));

// 測試展開語法
const typeInputs = { symptoms: 'test', diagnosis_label: 'test2', explanation: 'test3' };
const selectedContentType = 'diagnosis';

try {
  const materialParts = [
    'a',
    'b',
    ...Object.entries(typeInputs).map(([key, value]) => {
      const field = ALL_CONTENT_TYPES_V2.find(t => t.id === selectedContentType)?.inputFields.find(f => f.key === key);
      return field ? `${field.label}:${value}` : '';
    }).filter(Boolean),
  ];
  console.log('materialParts:', materialParts);
} catch (e) {
  console.log('Error:', e.message);
}
