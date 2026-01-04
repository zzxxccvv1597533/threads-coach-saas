import XLSX from 'xlsx';

const excelFile = '/home/ubuntu/upload/2_爆款分析儀表板_7大成果物_Part1(1).xlsx';
const workbook = XLSX.readFile(excelFile);
const sheet = workbook.Sheets['3_開頭鉤子庫_Top80'];
const data = XLSX.utils.sheet_to_json(sheet);

console.log('讀取到', data.length, '行');
console.log('\n第一行的欄位名稱:');
if (data.length > 0) {
  console.log(Object.keys(data[0]));
  console.log('\n第一行的完整內容:');
  console.log(data[0]);
}
