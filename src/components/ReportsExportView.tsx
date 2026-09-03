import React, { useState, useMemo } from 'react';
import { 
  BarChart3, 
  Download, 
  FileSpreadsheet, 
  Table, 
  Calendar, 
  PieChart as PieChartIcon, 
  Layers, 
  Users, 
  Filter,
  CheckCircle2
} from 'lucide-react';
import { Company, ExpenseCategory, ExpenseItem, Project, UserProfile } from '../types';
import { exportToCSV, exportToExcel, formatMoney } from '../utils/exportUtils';

interface ReportsExportViewProps {
  expenses: ExpenseItem[];
  projects: Project[];
  categories: ExpenseCategory[];
  companies: Company[];
  currentUser: UserProfile;
}

export const ReportsExportView: React.FC<ReportsExportViewProps> = ({
  expenses,
  projects,
  categories,
  companies,
  currentUser,
}) => {
  const [reportType, setReportType] = useState<'monthly' | 'category' | 'project' | 'applicant'>('monthly');
  const [selectedMonth, setSelectedMonth] = useState<string>('ALL');
  const [selectedCompany, setSelectedCompany] = useState<string>('ALL');

  // 權限過濾：普通編輯者僅統計自己，管理員/審核員統計全公司
  const scopedExpenses = useMemo(() => {
    let list = expenses;
    if (currentUser.role === 'editor') {
      list = list.filter(e => e.applicant.toLowerCase() === currentUser.name.toLowerCase());
    }
    if (selectedCompany !== 'ALL') {
      list = list.filter(e => e.companyName === selectedCompany);
    }
    if (selectedMonth !== 'ALL') {
      list = list.filter(e => e.claimMonth === selectedMonth);
    }
    return list;
  }, [expenses, currentUser, selectedCompany, selectedMonth]);

  const allMonths = useMemo(() => {
    const set = new Set(expenses.map(e => e.claimMonth));
    return Array.from(set).sort().reverse();
  }, [expenses]);

  const totalAmount = useMemo(() => {
    return scopedExpenses.reduce((sum, item) => sum + item.amount, 0);
  }, [scopedExpenses]);

  // 1. 每月統計數據
  const monthlyData = useMemo(() => {
    const map = new Map<string, { total: number; count: number; max: number; items: ExpenseItem[] }>();
    scopedExpenses.forEach(exp => {
      const curr = map.get(exp.claimMonth) || { total: 0, count: 0, max: 0, items: [] };
      map.set(exp.claimMonth, {
        total: curr.total + exp.amount,
        count: curr.count + 1,
        max: Math.max(curr.max, exp.amount),
        items: [...curr.items, exp],
      });
    });
    return Array.from(map.entries())
      .map(([month, data]) => ({
        month,
        ...data,
        average: Math.round(data.total / data.count),
        percentage: totalAmount > 0 ? ((data.total / totalAmount) * 100).toFixed(1) : '0',
      }))
      .sort((a, b) => b.month.localeCompare(a.month));
  }, [scopedExpenses, totalAmount]);

  // 2. 科目分類統計
  const categoryData = useMemo(() => {
    const map = new Map<string, { total: number; count: number }>();
    scopedExpenses.forEach(exp => {
      const curr = map.get(exp.categoryName) || { total: 0, count: 0 };
      map.set(exp.categoryName, {
        total: curr.total + exp.amount,
        count: curr.count + 1,
      });
    });
    return Array.from(map.entries())
      .map(([name, data]) => ({
        name,
        ...data,
        average: Math.round(data.total / data.count),
        percentage: totalAmount > 0 ? ((data.total / totalAmount) * 100).toFixed(1) : '0',
      }))
      .sort((a, b) => b.total - a.total);
  }, [scopedExpenses, totalAmount]);

  // 3. 專案分類統計
  const projectData = useMemo(() => {
    const map = new Map<string, { total: number; count: number }>();
    scopedExpenses.forEach(exp => {
      const curr = map.get(exp.projectName) || { total: 0, count: 0 };
      map.set(exp.projectName, {
        total: curr.total + exp.amount,
        count: curr.count + 1,
      });
    });
    return Array.from(map.entries())
      .map(([name, data]) => {
        const projObj = projects.find(p => p.name === name);
        return {
          name,
          code: projObj?.code || 'PJ-GEN',
          manager: projObj?.manager || '未指定',
          budgetLimit: projObj?.budgetLimit || 0,
          ...data,
          percentage: totalAmount > 0 ? ((data.total / totalAmount) * 100).toFixed(1) : '0',
        };
      })
      .sort((a, b) => b.total - a.total);
  }, [scopedExpenses, projects, totalAmount]);

  // 4. 同仁統計 (包含未列匯款、已列匯款與累計金額)
  const applicantData = useMemo(() => {
    // 建立科目匯款排除狀態對照表
    const excludedCatMap = new Map<string, boolean>();
    categories.forEach(c => {
      if (c.excludeFromRemittance) {
        if (c.id) excludedCatMap.set(c.id, true);
        if (c.name) excludedCatMap.set(c.name, true);
      }
    });

    const map = new Map<string, { 
      total: number; 
      count: number;
      excludedAmount: number;
      includedAmount: number;
    }>();

    scopedExpenses.forEach(exp => {
      const isExcluded = Boolean(
        (exp.categoryId && excludedCatMap.get(exp.categoryId)) ||
        (exp.categoryName && excludedCatMap.get(exp.categoryName))
      );
      const curr = map.get(exp.applicant) || { total: 0, count: 0, excludedAmount: 0, includedAmount: 0 };
      const amt = Number(exp.amount || 0);

      map.set(exp.applicant, {
        total: curr.total + amt,
        count: curr.count + 1,
        excludedAmount: curr.excludedAmount + (isExcluded ? amt : 0),
        includedAmount: curr.includedAmount + (!isExcluded ? amt : 0),
      });
    });

    return Array.from(map.entries())
      .map(([applicant, data]) => ({
        applicant,
        ...data,
        average: data.count > 0 ? Math.round(data.total / data.count) : 0,
        percentage: totalAmount > 0 ? ((data.total / totalAmount) * 100).toFixed(1) : '0',
      }))
      .sort((a, b) => b.total - a.total);
  }, [scopedExpenses, categories, totalAmount]);

  const handleExportFullExcel = () => {
    exportToExcel(scopedExpenses, `企業費用報銷總表_${selectedMonth}.xlsx`);
  };

  const handleExportCSV = () => {
    exportToCSV(scopedExpenses, `企業費用報銷明細_${selectedMonth}.csv`);
  };

  return (
    <div className="space-y-6">
      
      {/* 頂部功能橫幅 */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-900 rounded-2xl p-6 text-white shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-500/30 text-blue-200 border border-blue-400/30">
              財務分析與報表
            </span>
            <span className="text-xs text-slate-300">支援多維度聚合計算與標準 Excel 匯出</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-blue-400" />
            自動統計每月支出與分類報表匯出
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-xl">
            提供「每月支出趨勢」、「會計科目佔比」、「專案成本分攤」及「同仁請款統計」，可直接下載標準 Excel 活頁簿或 CSV 資料檔。
          </p>
        </div>

        {/* 匯出按鈕組 */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            id="export-excel-btn"
            onClick={handleExportFullExcel}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-600/20 transition-all hover:scale-105"
          >
            <FileSpreadsheet className="w-4 h-4" />
            匯出 Excel 活頁簿 (.xlsx)
          </button>
          <button
            id="export-csv-btn"
            onClick={handleExportCSV}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold backdrop-blur-sm border border-white/20 transition-colors"
          >
            <Download className="w-4 h-4 text-blue-300" />
            匯出 CSV
          </button>
        </div>
      </div>

      {/* 報表控制與過濾列 */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          
          {/* 報表維度切換 */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            <button
              onClick={() => setReportType('monthly')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                reportType === 'monthly'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              每月支出總表
            </button>

            <button
              onClick={() => setReportType('category')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                reportType === 'category'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <PieChartIcon className="w-3.5 h-3.5" />
              科目分類統計
            </button>

            <button
              onClick={() => setReportType('project')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                reportType === 'project'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              專案支出彙總
            </button>

            <button
              onClick={() => setReportType('applicant')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                reportType === 'applicant'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              同仁報銷排名
            </button>
          </div>

          {/* 篩選下拉 */}
          <div className="flex items-center gap-2 text-xs">
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 font-medium"
            >
              <option value="ALL">全部統計月份</option>
              {allMonths.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>

            <select
              value={selectedCompany}
              onChange={(e) => setSelectedCompany(e.target.value)}
              className="px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 font-medium"
            >
              <option value="ALL">全部公司別</option>
              {companies.map(c => (
                <option key={c.id} value={c.name}>{c.name}</option>
              ))}
            </select>
          </div>

        </div>

        {/* 總額與摘要統計 */}
        <div className="p-3 bg-slate-50 rounded-xl flex items-center justify-between text-xs text-slate-600">
          <div>
            <span>統計筆數：<strong className="text-slate-900">{scopedExpenses.length}</strong> 筆</span>
          </div>
          <div>
            <span>目前範圍累計總支出：<strong className="text-blue-700 text-sm font-bold font-mono">{formatMoney(totalAmount)}</strong></span>
          </div>
        </div>

      </div>

      {/* 報表表格渲染 */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        
        {/* 1. 每月支出報表 */}
        {reportType === 'monthly' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="p-3.5">請款月份</th>
                  <th className="p-3.5 text-center">報支單據筆數</th>
                  <th className="p-3.5 text-right">單月總支出 (TWD)</th>
                  <th className="p-3.5 text-right">平均每筆金額</th>
                  <th className="p-3.5 text-right">單筆最高支出</th>
                  <th className="p-3.5 text-right">年度佔比</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {monthlyData.map((item) => (
                  <tr key={item.month} className="hover:bg-slate-50">
                    <td className="p-3.5 font-bold font-mono text-slate-900">{item.month}</td>
                    <td className="p-3.5 text-center text-slate-700">{item.count} 筆</td>
                    <td className="p-3.5 text-right font-mono font-bold text-slate-900">{formatMoney(item.total)}</td>
                    <td className="p-3.5 text-right font-mono text-slate-600">{formatMoney(item.average)}</td>
                    <td className="p-3.5 text-right font-mono text-slate-600">{formatMoney(item.max)}</td>
                    <td className="p-3.5 text-right">
                      <span className="px-2 py-0.5 bg-blue-50 text-blue-700 font-bold rounded">
                        {item.percentage}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* 2. 科目分類報表 */}
        {reportType === 'category' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="p-3.5">會計科目名稱</th>
                  <th className="p-3.5 text-center">單據筆數</th>
                  <th className="p-3.5 text-right">累計金額 (TWD)</th>
                  <th className="p-3.5 text-right">平均單筆金額</th>
                  <th className="p-3.5 text-right">佔總支出比例</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {categoryData.map((cat) => (
                  <tr key={cat.name} className="hover:bg-slate-50">
                    <td className="p-3.5 font-bold text-slate-900">{cat.name}</td>
                    <td className="p-3.5 text-center text-slate-700">{cat.count} 筆</td>
                    <td className="p-3.5 text-right font-mono font-bold text-slate-900">{formatMoney(cat.total)}</td>
                    <td className="p-3.5 text-right font-mono text-slate-600">{formatMoney(cat.average)}</td>
                    <td className="p-3.5 text-right font-bold text-purple-700">{cat.percentage}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* 3. 專案支出報表 */}
        {reportType === 'project' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="p-3.5">專案代碼</th>
                  <th className="p-3.5">專案名稱</th>
                  <th className="p-3.5">負責人</th>
                  <th className="p-3.5 text-center">筆數</th>
                  <th className="p-3.5 text-right">累計支出 (TWD)</th>
                  <th className="p-3.5 text-right">核定預算</th>
                  <th className="p-3.5 text-right">預算使用率</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {projectData.map((proj) => {
                  const usage = proj.budgetLimit > 0 ? Math.round((proj.total / proj.budgetLimit) * 100) : 0;
                  return (
                    <tr key={proj.name} className="hover:bg-slate-50">
                      <td className="p-3.5 font-mono text-slate-500">{proj.code}</td>
                      <td className="p-3.5 font-bold text-slate-900">{proj.name}</td>
                      <td className="p-3.5 text-slate-600">{proj.manager}</td>
                      <td className="p-3.5 text-center text-slate-700">{proj.count} 筆</td>
                      <td className="p-3.5 text-right font-mono font-bold text-slate-900">{formatMoney(proj.total)}</td>
                      <td className="p-3.5 text-right font-mono text-slate-500">{formatMoney(proj.budgetLimit)}</td>
                      <td className="p-3.5 text-right">
                        <span className={`px-2 py-0.5 rounded font-bold ${
                          usage > 100 ? 'bg-red-100 text-red-700' : usage >= 80 ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-700'
                        }`}>
                          {usage}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* 4. 同仁排行報表 */}
        {reportType === 'applicant' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="p-3.5">名次</th>
                  <th className="p-3.5">申請人姓名</th>
                  <th className="p-3.5 text-center">報銷單據筆數</th>
                  <th className="p-3.5 text-right text-amber-700 bg-amber-50/50">未列匯款金額 (TWD)</th>
                  <th className="p-3.5 text-right text-blue-700 bg-blue-50/50">已列匯款金額 (TWD)</th>
                  <th className="p-3.5 text-right font-bold text-slate-900">累計金額 (加總)</th>
                  <th className="p-3.5 text-right">平均單筆金額</th>
                  <th className="p-3.5 text-right">佔比</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {applicantData.map((user, idx) => (
                  <tr key={user.applicant} className="hover:bg-slate-50">
                    <td className="p-3.5 font-bold font-mono text-slate-400">#{idx + 1}</td>
                    <td className="p-3.5 font-bold text-slate-900">{user.applicant}</td>
                    <td className="p-3.5 text-center text-slate-700">{user.count} 筆</td>
                    <td className="p-3.5 text-right font-mono font-semibold text-amber-700 bg-amber-50/30">
                      {formatMoney(user.excludedAmount)}
                    </td>
                    <td className="p-3.5 text-right font-mono font-semibold text-blue-700 bg-blue-50/30">
                      {formatMoney(user.includedAmount)}
                    </td>
                    <td className="p-3.5 text-right font-mono font-bold text-slate-900">
                      {formatMoney(user.total)}
                    </td>
                    <td className="p-3.5 text-right font-mono text-slate-600">{formatMoney(user.average)}</td>
                    <td className="p-3.5 text-right font-bold text-slate-700">{user.percentage}%</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-100 text-slate-800 font-bold border-t-2 border-slate-300">
                <tr>
                  <td colSpan={2} className="p-3.5">全體統計加總</td>
                  <td className="p-3.5 text-center">{applicantData.reduce((s, u) => s + u.count, 0)} 筆</td>
                  <td className="p-3.5 text-right font-mono text-amber-800">
                    {formatMoney(applicantData.reduce((s, u) => s + u.excludedAmount, 0))}
                  </td>
                  <td className="p-3.5 text-right font-mono text-blue-800">
                    {formatMoney(applicantData.reduce((s, u) => s + u.includedAmount, 0))}
                  </td>
                  <td className="p-3.5 text-right font-mono text-slate-900">
                    {formatMoney(applicantData.reduce((s, u) => s + u.total, 0))}
                  </td>
                  <td className="p-3.5 text-right font-mono text-slate-600">-</td>
                  <td className="p-3.5 text-right">100.0%</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

      </div>

    </div>
  );
};
