import React from 'react';
import { Database, CheckCircle2, Loader2, AlertCircle } from 'lucide-react';

export interface SavingStatus {
  isSaving: boolean;
  message: string;
  isSuccess?: boolean;
  isError?: boolean;
}

interface SavingLoadingOverlayProps {
  status: SavingStatus;
}

export const SavingLoadingOverlay: React.FC<SavingLoadingOverlayProps> = ({ status }) => {
  if (!status.isSaving && !status.isSuccess && !status.isError) {
    return null;
  }

  return (
    <div className="fixed top-5 right-5 z-50 pointer-events-none transition-all duration-300 animate-in fade-in slide-in-from-top-4">
      <div className={`flex items-center gap-3 px-4 py-3 rounded-2xl shadow-xl border backdrop-blur-md text-xs sm:text-sm font-semibold transition-all ${
        status.isSaving
          ? 'bg-slate-900/90 text-white border-indigo-500/40 shadow-indigo-900/20'
          : status.isSuccess
          ? 'bg-emerald-950/90 text-emerald-100 border-emerald-500/40 shadow-emerald-900/20'
          : 'bg-rose-950/90 text-rose-100 border-rose-500/40 shadow-rose-900/20'
      }`}>
        {status.isSaving && (
          <div className="flex items-center gap-2.5">
            <div className="relative flex items-center justify-center">
              <Loader2 className="w-5 h-5 text-indigo-400 animate-spin" />
              <Database className="w-2.5 h-2.5 text-white absolute" />
            </div>
            <div>
              <div className="font-bold text-white flex items-center gap-1.5">
                <span>雲端資料庫寫入中</span>
                <span className="flex h-1.5 w-1.5 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-indigo-500"></span>
                </span>
              </div>
              <div className="text-[11px] text-slate-300 font-normal">
                {status.message || '正在即時儲存至 PostgreSQL 資料庫...'}
              </div>
            </div>
          </div>
        )}

        {status.isSuccess && (
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-full bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div>
              <div className="font-bold text-emerald-300">雲端儲存成功</div>
              <div className="text-[11px] text-emerald-100/80 font-normal">
                {status.message || '資料已成功寫入雲端資料庫並完成同步！'}
              </div>
            </div>
          </div>
        )}

        {status.isError && (
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-full bg-rose-500/20 border border-rose-400/30 flex items-center justify-center text-rose-400">
              <AlertCircle className="w-4 h-4" />
            </div>
            <div>
              <div className="font-bold text-rose-300">雲端寫入提示</div>
              <div className="text-[11px] text-rose-100/80 font-normal">
                {status.message || '已儲存至本機，網路恢復時將自動同步。'}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
