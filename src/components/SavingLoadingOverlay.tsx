import React from 'react';
import { Database, CheckCircle2, Loader2, AlertCircle, ShieldCheck } from 'lucide-react';

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
    <div className="fixed top-6 right-6 z-[100] transition-all duration-300 animate-in fade-in slide-in-from-top-4">
      <div className={`flex items-center gap-3.5 px-5 py-3.5 rounded-2xl shadow-2xl border backdrop-blur-md text-xs sm:text-sm font-semibold transition-all max-w-md ${
        status.isSaving
          ? 'bg-slate-900/95 text-white border-indigo-500/50 shadow-indigo-900/30 ring-1 ring-indigo-500/30'
          : status.isSuccess
          ? 'bg-emerald-950/95 text-emerald-100 border-emerald-500/50 shadow-emerald-900/30 ring-1 ring-emerald-500/30'
          : 'bg-rose-950/95 text-rose-100 border-rose-500/50 shadow-rose-900/30 ring-1 ring-rose-500/30'
      }`}>
        {status.isSaving && (
          <div className="flex items-center gap-3">
            <div className="relative flex items-center justify-center shrink-0">
              <Loader2 className="w-5 h-5 text-indigo-400 animate-spin" />
              <Database className="w-2.5 h-2.5 text-white absolute" />
            </div>
            <div className="space-y-0.5">
              <div className="font-bold text-white flex items-center gap-2">
                <span>正在同步寫入雲端資料庫</span>
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                </span>
              </div>
              <div className="text-[11px] text-slate-300 font-normal">
                {status.message || '資料庫雙向防抖鎖定中，防止狀態回跳...'}
              </div>
            </div>
          </div>
        )}

        {status.isSuccess && (
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-full bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-400 shrink-0">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div className="space-y-0.5">
              <div className="font-bold text-emerald-300 flex items-center gap-1.5">
                <span>雲端資料庫同步完成</span>
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              </div>
              <div className="text-[11px] text-emerald-100/90 font-normal">
                {status.message || '資料已成功寫入雲端 PostgreSQL 並鎖定最新狀態！'}
              </div>
            </div>
          </div>
        )}

        {status.isError && (
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-full bg-rose-500/20 border border-rose-400/40 flex items-center justify-center text-rose-400 shrink-0">
              <AlertCircle className="w-4 h-4" />
            </div>
            <div className="space-y-0.5">
              <div className="font-bold text-rose-300">雲端寫入提醒</div>
              <div className="text-[11px] text-rose-100/90 font-normal">
                {status.message || '已儲存至本機，網路恢復時將自動同步。'}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
