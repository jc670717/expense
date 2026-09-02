import React, { useMemo } from 'react';
import { 
  DollarSign, 
  TrendingUp, 
  Clock, 
  AlertOctagon, 
  ArrowUpRight, 
  PieChart as PieChartIcon, 
  PlusCircle, 
  FileCheck2, 
  Scan, 
  Calendar,
  Layers,
  Sparkles
} from 'lucide-react';
import { ExpenseItem, Project, UserProfile, UserRole } from '../types';
import { formatMoney } from '../utils/exportUtils';

interface DashboardViewProps {
  expenses: ExpenseItem[];
  projects: Project[];
  currentUser: UserProfile;
  onOpenCreateExpense: () => void;
  setActiveTab: (tab: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  expenses,
  projects,
  currentUser,
  onOpenCreateExpense,
  setActiveTab,
}) => {
  // 依權限篩選查看範圍：普通編輯者查看自己的數據或全局概要，管理員/審核員查看全公司
  const visibleExpenses = useMemo(() => {
    if (currentUser.role === 'editor') {
      return expenses.filter(e => e.applicant.toLowerCase() === currentUser.name.toLowerCase());
    }
    return expenses;
  }, [expenses, currentUser]);

  // 1. 總支出累計
  const totalAmount = useMemo(() => {
    return visibleExpenses.reduce((sum, item) => sum + item.amount, 0);
  }, [visibleExpenses]);

  // 2. 待審批數量與金額
  const pendingItems = useMemo(() => {
    return visibleExpenses.filter(e => e.status === 'submitted');
  }, [visibleExpenses]);

  const pendingAmount = useMemo(() => {
    return pendingItems.reduce((sum, item) => sum + item.amount, 0);
  }, [pendingItems]);

  // 3. 每月支出統計
  const monthlyStats = useMemo(() => {
    const map = new Map<string, number>();
    visibleExpenses.forEach(exp => {
      const m = exp.claimMonth;
      map.set(m, (map.get(m) || 0) + exp.amount);
    });
    return Array.from(map.entries())
      .map(([month, total]) => ({ month, total }))
      .sort((a, b) => a.month.localeCompare(b.month));
  }, [visibleExpenses]);

  const maxMonthTotal = useMemo(() => {
    return Math.max(...monthlyStats.map(s => s.total), 1);
  }, [monthlyStats]);

  // 4. 科目分類統計
  const categoryStats = useMemo(() => {
    const map = new Map<string, number>();
    visibleExpenses.forEach(exp => {
      map.set(exp.categoryName, (map.get(exp.categoryName) || 0) + exp.amount);
    });
    return Array.from(map.entries())
      .map(([category, total]) => ({
        category,
        total,
        percentage: totalAmount > 0 ? ((total / totalAmount) * 100).toFixed(1) : '0',
      }))
      .sort((a, b) => b.total - a.total);
  }, [visibleExpenses, totalAmount]);

  // 5. 專案預算監控 (計算每個專案已花費與上限)
  const projectStats = useMemo(() => {
    const spendingMap = new Map<string, number>();
    expenses.forEach(exp => {
      spendingMap.set(exp.projectName, (spendingMap.get(exp.projectName) || 0) + exp.amount);
    });

    return projects.map(proj => {
      const spent = spendingMap.get(proj.name) || 0;
      const percent = proj.budgetLimit > 0 ? Math.min(Math.round((spent / proj.budgetLimit) * 100), 200) : 0;
      const isOver = spent > proj.budgetLimit;
      const isWarning = !isOver && percent >= proj.warningThreshold;

      return {
        ...proj,
        spent,
        percent,
        isOver,
        isWarning,
      };
    }).sort((a, b) => b.percent - a.percent);
  }, [projects, expenses]);

  const warningProjectsCount = projectStats.filter(p => p.isOver || p.isWarning).length;

  // 6. 申請人支出排行
  const applicantStats = useMemo(() => {
    const map = new Map<string, { total: number; count: number }>();
    expenses.forEach(exp => {
      const curr = map.get(exp.applicant) || { total: 0, count: 0 };
      map.set(exp.applicant, {
        total: curr.total + exp.amount,
        count: curr.count + 1,
      });
    });
    return Array.from(map.entries())
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.total - a.total);
  }, [expenses]);

  const categoryColors: Record<string, string> = {
    '住宿／車資': 'bg-blue-500 text-blue-500',
    '雜項購置': 'bg-purple-500 text-purple-500',
    '誤餐費': 'bg-amber-500 text-amber-500',
    '郵電費': 'bg-emerald-500 text-emerald-500',
    '交際費': 'bg-rose-500 text-rose-500',
    '運費': 'bg-sky-500 text-sky-500',
  };

  return (
    <div className="space-y-6">
      
      {/* 頂部歡迎與快速操作橫幅 */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-900 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-400/20 via-transparent to-transparent pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-white/10 text-blue-200 backdrop-blur-xs">
                {currentUser.roleTitle}
              </span>
              <span className="text-xs text-blue-200/80">
                {currentUser.companyId === 'comp-1' ? '邦捷總公司' : '馬祖分公司'}
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
              歡迎回來，{currentUser.name}！
            </h1>
            <p className="text-sm text-slate-300 mt-1 max-w-xl">
              {currentUser.role === 'editor' 
                ? '您目前處於「普通編輯者」檢視模式，可快速填報公務費用、上傳收據識別及管理個人每月固定支出。'
                : '即時掌握企業各專案支出狀況、多幣別報支統計與預算超支警示。'}
            </p>
          </div>

          {/* 快捷按鈕 */}
          <div className="flex flex-wrap gap-2.5">
            <button
              id="dashboard-create-expense-btn"
              onClick={onOpenCreateExpense}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-blue-500 hover:bg-blue-600 text-white text-sm font-semibold shadow-md shadow-blue-500/30 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <PlusCircle className="w-4 h-4" />
              快速新增報支
            </button>
            <button
              id="dashboard-scan-receipt-btn"
              onClick={() => setActiveTab('scanner')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-sm font-medium backdrop-blur-sm border border-white/15 transition-colors"
            >
              <Scan className="w-4 h-4 text-blue-300" />
              發票/收據 AI 識別
            </button>
            <button
              id="dashboard-recurring-btn"
              onClick={() => setActiveTab('recurring')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-sm font-medium backdrop-blur-sm border border-white/15 transition-colors"
            >
              <Calendar className="w-4 h-4 text-emerald-300" />
              每月固定支出建立
            </button>
          </div>
        </div>
      </div>

      {/* 4 大關鍵指標 KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* 指標 1: 累計總支出 */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              {currentUser.role === 'editor' ? '個人累計報支總額' : '全公司累計報支總額'}
            </span>
            <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900 tracking-tight">
              {formatMoney(totalAmount)}
            </div>
            <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
              共計 <span className="font-semibold text-slate-700">{visibleExpenses.length}</span> 筆報支記錄
            </p>
          </div>
        </div>

        {/* 指標 2: 待審批報支單 */}
        <div 
          onClick={() => setActiveTab('approvals')}
          className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs hover:border-blue-300 hover:shadow-xs transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              待審批報支單
            </span>
            <div className="w-9 h-9 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900 tracking-tight flex items-baseline gap-2">
              <span>{pendingItems.length}</span>
              <span className="text-xs font-normal text-slate-500">筆等待審核</span>
            </div>
            <p className="text-xs text-amber-600 font-medium mt-1">
              待撥款總額：{formatMoney(pendingAmount)}
            </p>
          </div>
        </div>

        {/* 指標 3: 活躍專案總數 */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              執行中專案
            </span>
            <div className="w-9 h-9 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Layers className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900 tracking-tight">
              {projects.filter(p => p.status === 'active').length} 個專案
            </div>
            <p className="text-xs text-slate-500 mt-1">
              總核定預算：{formatMoney(projects.reduce((s, p) => s + p.budgetLimit, 0))}
            </p>
          </div>
        </div>

        {/* 指標 4: 預算警戒與超支專案 */}
        <div 
          onClick={() => setActiveTab('projects')}
          className={`p-5 rounded-xl border shadow-2xs transition-all cursor-pointer ${
            warningProjectsCount > 0 
              ? 'bg-red-50/50 border-red-200 hover:border-red-300' 
              : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              預算超支/預警專案
            </span>
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
              warningProjectsCount > 0 ? 'bg-red-100 text-red-600 animate-bounce' : 'bg-emerald-50 text-emerald-600'
            }`}>
              <AlertOctagon className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className={`text-2xl font-bold tracking-tight ${
              warningProjectsCount > 0 ? 'text-red-600' : 'text-slate-900'
            }`}>
              {warningProjectsCount} 個專案警示
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {warningProjectsCount > 0 ? '部分專案已達 80% 或已超支' : '所有專案預算皆在安全範圍'}
            </p>
          </div>
        </div>

      </div>

      {/* 中間圖表區：月度走勢圖 & 科目分佈圓餅 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* 左側：月度支出走勢長條圖 (佔 2 欄) */}
        <div className="lg:col-span-2 bg-white p-5 sm:p-6 rounded-xl border border-slate-200 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-blue-600" />
                  每月請款支出走勢圖
                </h3>
                <p className="text-xs text-slate-500">依請款月份彙總統計金額 (單位: TWD)</p>
              </div>
              <span className="text-xs font-medium bg-slate-100 text-slate-600 px-2.5 py-1 rounded-md">
                2026 年度
              </span>
            </div>

            {/* 長條圖渲染 */}
            <div className="h-64 pt-6 pb-2 flex items-end justify-between gap-2 sm:gap-4 border-b border-slate-100">
              {monthlyStats.map((item) => {
                const heightPercent = Math.max((item.total / maxMonthTotal) * 100, 6);
                return (
                  <div key={item.month} className="flex-1 flex flex-col items-center gap-2 group relative">
                    {/* Hover 提示泡泡 */}
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute -top-10 bg-slate-900 text-white text-[11px] px-2 py-1 rounded shadow-lg whitespace-nowrap pointer-events-none z-20">
                      {item.month}: {formatMoney(item.total)}
                    </div>

                    {/* 長條本體 */}
                    <div className="w-full max-w-[48px] bg-slate-100 rounded-t-lg relative flex items-end justify-center overflow-hidden h-48">
                      <div 
                        style={{ height: `${heightPercent}%` }}
                        className="w-full bg-gradient-to-t from-blue-600 to-indigo-500 rounded-t-lg group-hover:from-blue-500 group-hover:to-sky-400 transition-all duration-300"
                      />
                    </div>

                    {/* 月份標籤 */}
                    <span className="text-[11px] font-medium text-slate-600 truncate max-w-full">
                      {item.month.replace('2026', '')}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between text-xs text-slate-500 pt-2">
            <span>最高單月支出：{formatMoney(maxMonthTotal)}</span>
            <button 
              onClick={() => setActiveTab('reports')}
              className="text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
            >
              查看詳細每月報表 →
            </button>
          </div>
        </div>

        {/* 右側：會計科目支出比例 (佔 1 欄) */}
        <div className="bg-white p-5 sm:p-6 rounded-xl border border-slate-200 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                <PieChartIcon className="w-4 h-4 text-purple-600" />
                會計科目支出佔比
              </h3>
              <span className="text-xs text-slate-400">總計 100%</span>
            </div>

            {/* 科目清單進度條 */}
            <div className="space-y-3 mt-2">
              {categoryStats.map((item) => (
                <div key={item.category} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className={`w-2.5 h-2.5 rounded-full ${categoryColors[item.category]?.split(' ')[0] || 'bg-slate-400'}`} />
                      <span className="font-medium text-slate-700">{item.category}</span>
                    </div>
                    <div className="text-right">
                      <span className="font-bold text-slate-900">{formatMoney(item.total)}</span>
                      <span className="text-slate-400 ml-1.5 text-[11px]">({item.percentage}%)</span>
                    </div>
                  </div>
                  {/* 進度條 */}
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div 
                      style={{ width: `${item.percentage}%` }}
                      className={`h-full rounded-full ${categoryColors[item.category]?.split(' ')[0] || 'bg-slate-500'}`}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 text-xs text-slate-500 flex justify-between items-center">
            <span>科目總數：{categoryStats.length} 項</span>
            <span className="text-slate-700 font-semibold">總額：{formatMoney(totalAmount)}</span>
          </div>
        </div>

      </div>

      {/* 下方區塊：專案預算監控排行 & 同仁報支統計 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* 左側：專案預算消耗排行榜 (佔 2 欄) */}
        <div className="lg:col-span-2 bg-white p-5 sm:p-6 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-base text-slate-900">專案預算消耗與超支警示</h3>
              <p className="text-xs text-slate-500">預算超過 80% 即觸發黃色預警，超過 100% 觸發紅色嚴重超支警報</p>
            </div>
            <button
              onClick={() => setActiveTab('projects')}
              className="text-xs text-blue-600 hover:text-blue-800 font-medium"
            >
              設定專案預算 →
            </button>
          </div>

          <div className="space-y-4">
            {projectStats.slice(0, 6).map((proj) => (
              <div key={proj.id} className="p-3 rounded-lg border border-slate-100 hover:border-slate-200 transition-colors">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-xs sm:text-sm text-slate-900">{proj.name}</span>
                    <span className="text-[11px] text-slate-400 font-mono">({proj.code})</span>
                    {proj.isOver ? (
                      <span className="px-2 py-0.5 text-[10px] font-bold bg-red-100 text-red-700 rounded-full">
                        已超支
                      </span>
                    ) : proj.isWarning ? (
                      <span className="px-2 py-0.5 text-[10px] font-bold bg-amber-100 text-amber-800 rounded-full">
                        接近上限 ({proj.warningThreshold}%)
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 text-[10px] font-medium bg-emerald-100 text-emerald-700 rounded-full">
                        正常
                      </span>
                    )}
                  </div>
                  <div className="text-right text-xs">
                    <span className="font-bold text-slate-900">{formatMoney(proj.spent)}</span>
                    <span className="text-slate-400"> / 上限 {formatMoney(proj.budgetLimit)}</span>
                  </div>
                </div>

                {/* 預算進度條 */}
                <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden relative">
                  <div 
                    style={{ width: `${Math.min(proj.percent, 100)}%` }}
                    className={`h-full rounded-full transition-all duration-500 ${
                      proj.isOver 
                        ? 'bg-red-500' 
                        : proj.isWarning 
                          ? 'bg-amber-500' 
                          : 'bg-emerald-500'
                    }`}
                  />
                </div>
                <div className="flex justify-between items-center mt-1 text-[11px] text-slate-400">
                  <span>負責人：{proj.manager}</span>
                  <span className={proj.isOver ? 'text-red-600 font-bold' : proj.isWarning ? 'text-amber-600 font-semibold' : 'text-slate-600'}>
                    預算使用率：{proj.percent}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 右側：同仁報帳排名 */}
        <div className="bg-white p-5 sm:p-6 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-base text-slate-900">同仁報銷統計排行</h3>
            <span className="text-xs text-slate-400">共 {applicantStats.length} 人</span>
          </div>

          <div className="space-y-3">
            {applicantStats.slice(0, 8).map((user, idx) => (
              <div key={user.name} className="flex items-center justify-between text-xs py-1 border-b border-slate-50 last:border-0">
                <div className="flex items-center gap-2.5">
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] ${
                    idx === 0 ? 'bg-amber-100 text-amber-800' :
                    idx === 1 ? 'bg-slate-200 text-slate-700' :
                    idx === 2 ? 'bg-amber-50 text-amber-700' : 'text-slate-400'
                  }`}>
                    {idx + 1}
                  </span>
                  <div>
                    <span className="font-semibold text-slate-800">{user.name}</span>
                    <span className="text-[11px] text-slate-400 ml-1.5">({user.count} 筆)</span>
                  </div>
                </div>
                <span className="font-bold text-slate-900">{formatMoney(user.total)}</span>
              </div>
            ))}
          </div>
        </div>

      </div>

    </div>
  );
};
