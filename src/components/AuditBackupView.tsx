import React, { useState } from 'react';
import { 
  ShieldCheck, 
  Download, 
  UploadCloud, 
  RotateCcw, 
  Search, 
  Filter, 
  History, 
  Database, 
  CheckCircle2, 
  AlertTriangle,
  Lock,
  Clock
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { AuditLog, Company, CurrencyRate, ExpenseCategory, ExpenseItem, Project, RecurringExpenseTemplate, UserProfile } from '../types';

interface AuditBackupViewProps {
  auditLogs: AuditLog[];
  currentUser: UserProfile;
  onExportBackup: () => void;
  onRestoreBackup: (jsonData: any) => void;
  onResetToInitial: () => void;
  dbStatus?: { dbConnected: boolean; message?: string; driver?: string };
  onSyncPushToDb?: () => Promise<void>;
  onSyncPullFromDb?: () => Promise<void>;
  isSyncing?: boolean;
}

export const AuditBackupView: React.FC<AuditBackupViewProps> = ({
  auditLogs,
  currentUser,
  onExportBackup,
  onRestoreBackup,
  onResetToInitial,
  dbStatus = { dbConnected: false },
  onSyncPushToDb,
  onSyncPullFromDb,
  isSyncing = false,
}) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedModule, setSelectedModule] = useState<string>('ALL');

  const filteredLogs = auditLogs.filter(log => {
    if (selectedModule !== 'ALL' && log.module !== selectedModule) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        log.userName.toLowerCase().includes(q) ||
        log.action.toLowerCase().includes(q) ||
        log.details.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (confirm('確定要還原此備份檔案嗎？此操作將覆蓋當前系統資料庫。')) {
          onRestoreBackup(json);
          try {
            confetti({ particleCount: 70, spread: 60 });
          } catch (e) {}
        }
      } catch (err) {
        alert('備份檔案格式無效，請確認為正確的 JSON 格式！');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const getActionColor = (action: string) => {
    if (action.includes('刪除') || action.includes('駁回')) return 'bg-red-100 text-red-700';
    if (action.includes('核准') || action.includes('撥款')) return 'bg-emerald-100 text-emerald-800';
    if (action.includes('新增') || action.includes('建立') || action.includes('匯入')) return 'bg-blue-100 text-blue-800';
    return 'bg-slate-100 text-slate-700';
  };

  return (
    <div className="space-y-6">
      
      {/* 頂部功能橫幅 */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-900 rounded-2xl p-6 text-white shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-500/30 text-blue-200 border border-blue-400/30">
              安全合規與稽核
            </span>
            <span className="text-xs text-slate-300">不可竄改之操作軌跡與雲端備份防護</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-blue-400" />
            雲端備份與操作歷程紀錄 (Audit Log)
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-xl">
            完整紀錄所有人員之新增、修改、駁回、審批核准、預算調整及匯率變更時間戳記，並支援系統一鍵快照備份與災難還原。
          </p>
        </div>

        {/* 備份與還原按鈕組 */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            id="create-backup-btn"
            onClick={onExportBackup}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-500/20 transition-all hover:scale-105"
          >
            <Download className="w-4 h-4" />
            建立完整雲端備份 (JSON)
          </button>

          <label className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold backdrop-blur-sm border border-white/20 transition-colors cursor-pointer">
            <UploadCloud className="w-4 h-4 text-emerald-300" />
            還原備份資料
            <input
              type="file"
              accept=".json"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>
        </div>
      </div>

      {/* 雲端資料庫 (Neon PostgreSQL) 多人共用連線狀態卡片 */}
      <div className={`p-5 rounded-2xl border transition-all ${
        dbStatus.dbConnected 
          ? 'bg-gradient-to-r from-emerald-950 via-teal-950 to-slate-900 border-emerald-500/40 text-white shadow-md' 
          : 'bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border-slate-700 text-white shadow-md'
      }`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
              dbStatus.dbConnected ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-400/30' : 'bg-indigo-500/20 text-indigo-400 border border-indigo-400/30'
            }`}>
              <Database className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base text-white">Neon PostgreSQL 雲端多人即時資料庫</h3>
                <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                  dbStatus.dbConnected ? 'bg-emerald-500 text-slate-950' : 'bg-slate-700 text-slate-300'
                }`}>
                  {dbStatus.dbConnected ? '● 已連線 (Multi-User Cloud Mode)' : '○ 離線展示模式 (Local Mode)'}
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
                {dbStatus.dbConnected 
                  ? '系統已成功連線至 Neon PostgreSQL 雲端伺服器！所有同仁的報銷填報、審批、撥款與修改皆會即時同步至全體同仁裝置。' 
                  : '目前運行於瀏覽器本地模式。部署至 Vercel 並於環境變數填入 DATABASE_URL (Neon PostgreSQL) 即可自動升級為多人即時協同系統。'}
              </p>
            </div>
          </div>

          {/* 雲端即時同步操作按鈕 */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {onSyncPushToDb && (
              <button
                onClick={onSyncPushToDb}
                disabled={isSyncing}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-xs font-bold transition-all shadow-xs cursor-pointer disabled:opacity-50"
                title="將當前資料寫入/初始化至 PostgreSQL 資料庫"
              >
                <RotateCcw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>{isSyncing ? '同步中...' : '推送資料至雲端 DB'}</span>
              </button>
            )}
            {onSyncPullFromDb && (
              <button
                onClick={onSyncPullFromDb}
                disabled={isSyncing}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
                title="從 PostgreSQL 資料庫拉取最新全體同仁資料"
              >
                <Download className="w-3.5 h-3.5" />
                <span>從雲端 DB 重新整理</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 備份狀態與還原重置防呆卡片 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span>稽核日誌總筆數</span>
            <History className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900 font-mono">
            {auditLogs.length} 筆紀錄
          </div>
          <p className="text-[11px] text-emerald-600 mt-1 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" />
            日誌完整寫入中
          </p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span>安全防護狀態</span>
            <Lock className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-base font-bold text-slate-900 mt-1">
            AES-256 結構化備份
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            包含專案、報銷單、公司、科目與匯率
          </p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span>資料庫範例重置</span>
            <RotateCcw className="w-4 h-4 text-amber-600" />
          </div>
          <button
            onClick={() => {
              if (confirm('警告：確定要將系統重置為初始示範資料嗎？所有已修改的數據將被覆蓋！')) {
                onResetToInitial();
              }
            }}
            className="px-3 py-1.5 rounded-lg border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 text-xs font-semibold transition-colors text-center"
          >
            重置為系統初始資料
          </button>
        </div>
      </div>

      {/* 稽核日誌查詢與列表 */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
        
        {/* 工具列 */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜尋操作人員、行為動作或詳細內容..."
              className="w-full text-xs pl-9 pr-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-400">模組篩選：</span>
            <select
              value={selectedModule}
              onChange={(e) => setSelectedModule(e.target.value)}
              className="px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 font-medium"
            >
              <option value="ALL">全部模組</option>
              <option value="費用報支">費用報支</option>
              <option value="審批工作流">審批工作流</option>
              <option value="固定支出">固定支出</option>
              <option value="專案預算">專案預算</option>
              <option value="基礎資料">基礎資料</option>
              <option value="系統資料">系統資料</option>
            </select>
          </div>
        </div>

        {/* 日誌表格 */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200">
              <tr>
                <th className="p-3 w-40">時間戳記</th>
                <th className="p-3 w-28">操作人員</th>
                <th className="p-3 w-28">功能模組</th>
                <th className="p-3 w-32">動作類型</th>
                <th className="p-3">詳細操作紀錄</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-400">
                    尚無符合條件的操作日誌
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50">
                    <td className="p-3 font-mono text-slate-500 whitespace-nowrap">
                      {log.timestamp}
                    </td>
                    <td className="p-3 font-bold text-slate-900 whitespace-nowrap">
                      {log.userName}
                    </td>
                    <td className="p-3 whitespace-nowrap">
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-[11px]">
                        {log.module}
                      </span>
                    </td>
                    <td className="p-3 whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${getActionColor(log.action)}`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="p-3 text-slate-700">
                      {log.details}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

      </div>

    </div>
  );
};
