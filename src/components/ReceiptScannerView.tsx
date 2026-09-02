import React, { useState } from 'react';
import { 
  Scan, 
  UploadCloud, 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  Sparkles, 
  ArrowRight, 
  Trash2, 
  Plus,
  RefreshCw,
  Zap
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { ExpenseCategory, ExpenseItem, OcrResult, Project, UserProfile } from '../types';
import { analyzeReceiptImage, SAMPLE_RECEIPT_ITEMS } from '../utils/ocrService';
import { formatMoney } from '../utils/exportUtils';

interface ReceiptScannerViewProps {
  currentUser: UserProfile;
  categories: ExpenseCategory[];
  projects: Project[];
  onBatchImportExpenses: (newExpenses: Partial<ExpenseItem>[]) => void;
  setActiveTab: (tab: string) => void;
}

export const ReceiptScannerView: React.FC<ReceiptScannerViewProps> = ({
  currentUser,
  categories,
  projects,
  onBatchImportExpenses,
  setActiveTab,
}) => {
  const [ocrList, setOcrList] = useState<OcrResult[]>([]);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [targetMonth, setTargetMonth] = useState<string>('202608');
  const [targetProject, setTargetProject] = useState<string>(projects[0]?.name || '金廈(泉)票務系統暨服務採購案');

  // 處理自訂上傳檔案
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    setIsProcessing(true);
    const files = Array.from(e.target.files) as File[];

    try {
      const results: OcrResult[] = [];
      for (const file of files) {
        const res = await analyzeReceiptImage(file);
        results.push(res);
      }
      setOcrList(prev => [...prev, ...results]);
    } catch (err) {
      console.error(err);
    } finally {
      setIsProcessing(false);
      e.target.value = '';
    }
  };

  // 載入預設樣本發票收據 (一鍵體驗 AI 辨識)
  const handleLoadSamples = () => {
    const samples: OcrResult[] = SAMPLE_RECEIPT_ITEMS.map((s, idx) => ({
      ...s,
      id: `sample-${Date.now()}-${idx}`,
    }));
    setOcrList(samples);
  };

  // 批次匯入至費用清單
  const handleBatchImport = () => {
    const selected = ocrList.filter(o => o.selected);
    if (selected.length === 0) {
      alert('請先勾選要匯入的辨識結果');
      return;
    }

    const newExpenses: Partial<ExpenseItem>[] = selected.map((item) => ({
      claimMonth: targetMonth,
      date: item.detectedDate || new Date().toISOString().split('T')[0],
      applicant: currentUser.name,
      companyName: currentUser.companyId === 'comp-1' ? '邦捷總公司' : '馬祖分公司',
      projectName: targetProject,
      description: item.detectedDescription || item.fileName.replace(/\.[^/.]+$/, ''),
      categoryName: item.detectedCategory || '雜項購置',
      currency: 'TWD',
      amount: item.detectedAmount || 100,
      invoiceNo: item.detectedInvoiceNo,
      receiptImage: item.previewUrl,
      receiptStatus: 'attached',
      status: 'submitted',
      remark: `AI 影像識別匯入 (置信度 ${item.confidence}%)`,
    }));

    onBatchImportExpenses(newExpenses);

    // 觸發慶祝動畫
    try {
      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.6 }
      });
    } catch (e) {}

    // 清空並跳轉
    setOcrList([]);
    setActiveTab('expenses');
  };

  const toggleSelect = (id: string) => {
    setOcrList(prev => prev.map(item => item.id === id ? { ...item, selected: !item.selected } : item));
  };

  const removeItem = (id: string) => {
    setOcrList(prev => prev.filter(item => item.id !== id));
  };

  const updateItemField = (id: string, field: keyof OcrResult, value: any) => {
    setOcrList(prev => prev.map(item => item.id === id ? { ...item, [field]: value } : item));
  };

  const selectedCount = ocrList.filter(o => o.selected).length;
  const selectedSum = ocrList.filter(o => o.selected).reduce((sum, item) => sum + (item.detectedAmount || 0), 0);

  return (
    <div className="space-y-6">
      
      {/* 標題與說明 Banner */}
      <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 rounded-2xl p-6 text-white shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-500/30 text-blue-200 border border-blue-400/30">
              AI 智能視覺 OCR
            </span>
            <span className="text-xs text-slate-300">自動提取金額、日期、發票號碼與科目</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Scan className="w-6 h-6 text-blue-400" />
            批次發票與收據影像識別入帳
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-xl">
            支援多張發票照片、機票登機證、高鐵票、計程車收據與電子帳單截圖批次上傳。辨識完成後可直接校對並「一鍵批次建立報支單」！
          </p>
        </div>

        <button
          id="load-sample-receipts-btn"
          onClick={handleLoadSamples}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold backdrop-blur-sm border border-white/20 transition-all hover:scale-105 shrink-0"
        >
          <Zap className="w-4 h-4 text-amber-400" />
          載入 4 張測試發票範例
        </button>
      </div>

      {/* 拖曳上傳區 */}
      <div className="bg-white p-6 rounded-2xl border-2 border-dashed border-slate-300 hover:border-blue-500 transition-colors text-center relative group">
        <input
          type="file"
          multiple
          accept="image/*,application/pdf"
          onChange={handleFileUpload}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
        />
        <div className="flex flex-col items-center justify-center py-4 pointer-events-none">
          <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
            <UploadCloud className="w-7 h-7" />
          </div>
          <h3 className="font-bold text-base text-slate-800">
            點擊此處或拖曳發票/收據圖片至此
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            支援 JPG, PNG, PDF 格式（可一次選取多張檔案進行批次辨識）
          </p>
        </div>
      </div>

      {/* 批次辨識結果清單 */}
      {ocrList.length > 0 && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
              <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                辨識結果校對與匯入設定 ({ocrList.length} 張單據)
              </h3>
              <p className="text-xs text-slate-500">
                請確認以下識別欄位，您可直接線上修改文字與金額，確認無誤後點選右側一鍵匯入。
              </p>
            </div>

            {/* 批量匯入歸屬設定 */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <div>
                <label className="text-[11px] text-slate-400 block mb-0.5">匯入月份</label>
                <input
                  type="text"
                  value={targetMonth}
                  onChange={(e) => setTargetMonth(e.target.value)}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-200 font-mono font-bold w-24"
                />
              </div>

              <div>
                <label className="text-[11px] text-slate-400 block mb-0.5">預設歸屬專案</label>
                <select
                  value={targetProject}
                  onChange={(e) => setTargetProject(e.target.value)}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-200 font-medium max-w-[200px]"
                >
                  {projects.map(p => (
                    <option key={p.id} value={p.name}>{p.name}</option>
                  ))}
                </select>
              </div>

              <div className="pt-3.5">
                <button
                  id="confirm-batch-ocr-import-btn"
                  onClick={handleBatchImport}
                  disabled={selectedCount === 0}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl font-bold shadow-md shadow-blue-500/20 transition-all flex items-center gap-1.5"
                >
                  <Sparkles className="w-4 h-4" />
                  匯入所選 {selectedCount} 筆 ({formatMoney(selectedSum)})
                </button>
              </div>
            </div>
          </div>

          {/* 卡片列表 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {ocrList.map((item) => (
              <div 
                key={item.id}
                className={`p-4 rounded-xl border transition-all ${
                  item.selected ? 'bg-blue-50/20 border-blue-300 ring-1 ring-blue-300' : 'bg-slate-50/50 border-slate-200'
                }`}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={item.selected}
                    onChange={() => toggleSelect(item.id)}
                    className="mt-1 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />

                  {/* 縮圖預覽 */}
                  <img
                    src={item.previewUrl}
                    alt={item.fileName}
                    className="w-20 h-20 rounded-lg object-cover border border-slate-200 shrink-0 bg-white"
                  />

                  <div className="flex-1 min-w-0 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-800 truncate" title={item.fileName}>
                        {item.fileName}
                      </span>
                      <div className="flex items-center gap-1">
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                          {item.confidence}% 信心
                        </span>
                        <button
                          onClick={() => removeItem(item.id)}
                          className="text-slate-400 hover:text-red-600 p-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* 可直接編輯欄位 */}
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-slate-400 block">辨識金額 (NT$)</label>
                        <input
                          type="number"
                          value={item.detectedAmount}
                          onChange={(e) => updateItemField(item.id, 'detectedAmount', parseFloat(e.target.value) || 0)}
                          className="w-full px-2 py-1 rounded border border-slate-200 bg-white font-bold text-slate-900"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-400 block">日期</label>
                        <input
                          type="date"
                          value={item.detectedDate}
                          onChange={(e) => updateItemField(item.id, 'detectedDate', e.target.value)}
                          className="w-full px-2 py-1 rounded border border-slate-200 bg-white"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-slate-400 block">推薦科目</label>
                        <select
                          value={item.detectedCategory}
                          onChange={(e) => updateItemField(item.id, 'detectedCategory', e.target.value)}
                          className="w-full px-2 py-1 rounded border border-slate-200 bg-white"
                        >
                          {categories.map(c => (
                            <option key={c.id} value={c.name}>{c.name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-400 block">發票號碼</label>
                        <input
                          type="text"
                          value={item.detectedInvoiceNo || ''}
                          onChange={(e) => updateItemField(item.id, 'detectedInvoiceNo', e.target.value)}
                          className="w-full px-2 py-1 rounded border border-slate-200 bg-white font-mono"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] text-slate-400 block">說明摘要</label>
                      <input
                        type="text"
                        value={item.detectedDescription || ''}
                        onChange={(e) => updateItemField(item.id, 'detectedDescription', e.target.value)}
                        className="w-full px-2 py-1 rounded border border-slate-200 bg-white"
                      />
                    </div>

                  </div>
                </div>
              </div>
            ))}
          </div>

        </div>
      )}

    </div>
  );
};
