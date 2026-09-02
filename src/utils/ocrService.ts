import { OcrResult } from '../types';

/**
 * 模擬/執行發票與收據 OCR 辨識
 * 支援批次分析上傳圖片並自動提取關鍵欄位
 */
export async function analyzeReceiptImage(file: File): Promise<OcrResult> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      const previewUrl = reader.result as string;
      const fileNameLower = file.name.toLowerCase();

      // 智能猜測範例（依檔名或隨機生成逼真發票識別結果）
      let detectedDate = '2026-08-20';
      let detectedAmount = Math.floor(Math.random() * 2000) + 120;
      let detectedInvoiceNo = `AB-${Math.floor(10000000 + Math.random() * 90000000)}`;
      let detectedMerchant = '台灣中油股份有限公司';
      let detectedCategory = '住宿／車資';
      let detectedDescription = '公務車加油費 (95無鉛)';

      if (fileNameLower.includes('ticket') || fileNameLower.includes('機票') || fileNameLower.includes('船票') || fileNameLower.includes('高鐵')) {
        detectedCategory = '住宿／車資';
        detectedMerchant = fileNameLower.includes('船') ? '新華航業股份有限公司' : '立榮航空股份有限公司';
        detectedDescription = fileNameLower.includes('船') ? '基隆-南竿船票' : '松山-金門機票';
        detectedAmount = fileNameLower.includes('船') ? 1050 : 2458;
      } else if (fileNameLower.includes('meal') || fileNameLower.includes('餐') || fileNameLower.includes('食') || fileNameLower.includes('food')) {
        detectedCategory = '誤餐費';
        detectedMerchant = '八方雲集 / 鬍鬚張魯肉飯';
        detectedDescription = '同仁出差加班誤餐費';
        detectedAmount = 300;
      } else if (fileNameLower.includes('taxi') || fileNameLower.includes('車') || fileNameLower.includes('uber') || fileNameLower.includes('55688')) {
        detectedCategory = '住宿／車資';
        detectedMerchant = '台灣大車隊 55688';
        detectedDescription = '出差拜訪客戶計程車資';
        detectedAmount = 280;
      } else if (fileNameLower.includes('ai') || fileNameLower.includes('copilot') || fileNameLower.includes('cloud') || fileNameLower.includes('github')) {
        detectedCategory = '雜項購置';
        detectedMerchant = 'GitHub / Anthropic / Google Cloud';
        detectedDescription = '雲端軟體訂閱服務費';
        detectedAmount = 328;
      }

      // 產生今日日期附近的日期
      const today = new Date();
      const randomDay = Math.floor(Math.random() * 15) + 1;
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const day = String(randomDay).padStart(2, '0');
      detectedDate = `2026-${month}-${day}`;

      resolve({
        id: `ocr-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        fileName: file.name,
        previewUrl,
        detectedDate,
        detectedAmount,
        detectedInvoiceNo,
        detectedMerchant,
        detectedCategory,
        detectedDescription,
        confidence: Math.round((0.88 + Math.random() * 0.1) * 100),
        selected: true,
      });
    };
    reader.readAsDataURL(file);
  });
}

/**
 * 預設展示用的樣品發票資料（提供一鍵體驗）
 */
export const SAMPLE_RECEIPT_ITEMS: Omit<OcrResult, 'id'>[] = [
  {
    fileName: '立榮航空_松山金門電子機票.jpg',
    previewUrl: 'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=500&auto=format&fit=crop&q=60',
    detectedDate: '2026-08-18',
    detectedAmount: 2458,
    detectedInvoiceNo: 'UN-89213890',
    detectedMerchant: '立榮航空股份有限公司 (統編: 22099309)',
    detectedCategory: '住宿／車資',
    detectedDescription: '松山至金門商務去程機票',
    confidence: 96,
    selected: true,
  },
  {
    fileName: '中油加油站_統一發票電子載具.jpg',
    previewUrl: 'https://images.unsplash.com/photo-1545454675-3531b543be5d?w=500&auto=format&fit=crop&q=60',
    detectedDate: '2026-08-20',
    detectedAmount: 1450,
    detectedInvoiceNo: 'CY-39201948',
    detectedMerchant: '台灣中油股份有限公司 (統編: 03795505)',
    detectedCategory: '住宿／車資',
    detectedDescription: '公務車 4780-J7 95無鉛汽油加滿',
    confidence: 98,
    selected: true,
  },
  {
    fileName: '鬍鬚張魯肉飯_出差誤餐收據.jpg',
    previewUrl: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=500&auto=format&fit=crop&q=60',
    detectedDate: '2026-08-21',
    detectedAmount: 300,
    detectedInvoiceNo: 'HS-58291032',
    detectedMerchant: '鬍鬚張魯肉飯 (統編: 84729103)',
    detectedCategory: '誤餐費',
    detectedDescription: '金門駐點出差同仁晚餐誤餐費',
    confidence: 94,
    selected: true,
  },
  {
    fileName: 'Anthropic_Claude_API_Invoice.pdf',
    previewUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=500&auto=format&fit=crop&q=60',
    detectedDate: '2026-08-22',
    detectedAmount: 3288,
    detectedInvoiceNo: 'INV-2026-08-ANTH',
    detectedMerchant: 'Anthropic PBC (US)',
    detectedCategory: '雜項購置',
    detectedDescription: 'Claude AI API 8月份研發消耗額度 (USD 102.1)',
    confidence: 99,
    selected: true,
  },
];
