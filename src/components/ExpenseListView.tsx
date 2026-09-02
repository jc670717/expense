import React, { useState, useMemo } from 'react';
import { 
  Plus, 
  Search, 
  Filter, 
  Download, 
  Trash2, 
  Edit3, 
  Eye,
  Lock,
  CheckCircle, 
  XCircle, 
  Send, 
  AlertCircle, 
  Receipt, 
  CheckSquare, 
  Square,
  FileSpreadsheet,
  Layers,
  Sparkles,
  ArrowUpDown,
  Building,
  Tag
} from 'lucide-react';
import { Company, ExpenseCategory, ExpenseItem, ExpenseStatus, Project, UserProfile, UserRole } from '../types';
import { exportToCSV, formatMoney } from '../utils/exportUtils';

interface ExpenseListViewProps {
  expenses: ExpenseItem[];
  projects: Project[];
  categories: ExpenseCategory[];
  companies: Company[];
  currentUser: UserProfile;
  allUsers: UserProfile[];
  onOpenCreate: () => void;
  onEditExpense: (expense: ExpenseItem) => void;
  onDeleteExpense: (id: string) => void;
  onBatchDeleteExpenses?: (ids: string[]) => void;
  onStatusChange: (id: string, newStatus: ExpenseStatus, rejectReason?: string) => void;
  onBatchStatusChange: (ids: string[], newStatus: ExpenseStatus) => void;
}

export const ExpenseListView: React.FC<ExpenseListViewProps> = ({
  expenses,
  projects,
  categories,
  companies,
  currentUser,
  allUsers,
  onOpenCreate,
  onEditExpense,
  onDeleteExpense,
  onBatchDeleteExpenses,
  onStatusChange,
  onBatchStatusChange,
}) => {
  // 篩選狀態
  const [selectedMonth, setSelectedMonth] = useState<string>('ALL');
  const [selectedCompany, setSelectedCompany] = useState<string>('ALL');
  const [selectedProject, setSelectedProject] = useState<string>('ALL');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [selectedApplicant, setSelectedApplicant] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [sortField, setSortField] = useState<'date' | 'amount' | 'itemNo'>('date');
  const [sortAsc, setSortAsc] = useState<boolean>(false);

  // 刪除確認彈窗狀態
  const [deletingExpenseItem, setDeletingExpenseItem] = useState<ExpenseItem | null>(null);
  const [showBatchDeleteConfirm, setShowBatchDeleteConfirm] = useState<boolean>(false);

  // 駁回彈窗狀態
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState<string>('');

  // 1. 角色權限隔離 (Rule 12: 普通編輯者只能查詢自己的資料)
  const scopedExpenses = useMemo(() => {
    if (currentUser.role === 'editor') {
      return expenses.filter(e => e.applicant.toLowerCase() === currentUser.name.toLowerCase());
    }
    return expenses;
  }, [expenses, currentUser]);

  // 所有不重複月份
  const availableMonths = useMemo(() => {
    const set = new Set(scopedExpenses.map(e => e.claimMonth));
    return Array.from(set).sort().reverse();
  }, [scopedExpenses]);

  // 所有不重複申請人 (僅管理員/審核員能見)
  const availableApplicants = useMemo(() => {
    const set = new Set(expenses.map(e => e.applicant));
    return Array.from(set).sort();
  }, [expenses]);

  // 2. 套用搜尋與過濾條件
  const filteredExpenses = useMemo(() => {
    return scopedExpenses.filter(item => {
      if (selectedMonth !== 'ALL' && item.claimMonth !== selectedMonth) return false;
      if (selectedCompany !== 'ALL' && item.companyName !== selectedCompany) return false;
      if (selectedProject !== 'ALL' && item.projectName !== selectedProject) return false;
      if (selectedCategory !== 'ALL' && item.categoryName !== selectedCategory) return false;
      if (selectedStatus !== 'ALL' && item.status !== selectedStatus) return false;
      if (currentUser.role !== 'editor' && selectedApplicant !== 'ALL' && item.applicant !== selectedApplicant) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchDesc = item.description.toLowerCase().includes(q);
        const matchApplicant = item.applicant.toLowerCase().includes(q);
        const matchRemark = (item.remark || '').toLowerCase().includes(q);
        const matchInvoice = (item.invoiceNo || '').toLowerCase().includes(q);
        const matchProject = item.projectName.toLowerCase().includes(q);
        if (!matchDesc && !matchApplicant && !matchRemark && !matchInvoice && !matchProject) {
          return false;
        }
      }

      return true;
    }).sort((a, b) => {
      let cmp = 0;
      if (sortField === 'amount') cmp = a.amount - b.amount;
      else if (sortField === 'itemNo') cmp = a.itemNo - b.itemNo;
      else cmp = a.date.localeCompare(b.date);
      return sortAsc ? cmp : -cmp;
    });
  }, [
    scopedExpenses,
    selectedMonth,
    selectedCompany,
    selectedProject,
    selectedCategory,
    selectedStatus,
    selectedApplicant,
    searchQuery,
    currentUser,
    sortField,
    sortAsc,
  ]);

  // 當前篩選總金額與統計
  const filteredTotal = useMemo(() => {
    return filteredExpenses.reduce((sum, item) => sum + item.amount, 0);
  }, [filteredExpenses]);

  // 最高管理者無修改刪除及批次限制
  const isSuperAdmin = currentUser.role === 'admin' || currentUser.position === 'admin';

  // Requirement 7: 只要一但簽核過，就沒有前面的批次checkbox，除非最高管理
  const selectableExpenses = useMemo(() => {
    return filteredExpenses.filter(item => {
      const isSignedOff = item.status === 'dept_approved' || item.status === 'admin_approved' || item.status === 'approved' || item.status === 'paid';
      return isSuperAdmin || !isSignedOff;
    });
  }, [filteredExpenses, isSuperAdmin]);

  // 全選/反選 (僅選取可批次操作的項目)
  const handleSelectAll = () => {
    if (selectableExpenses.length > 0 && selectedIds.length === selectableExpenses.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(selectableExpenses.map(e => e.id));
    }
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const getStatusBadge = (status: ExpenseStatus) => {
    switch (status) {
      case 'draft':
        return <span className="px-2 py-0.5 text-[11px] font-medium bg-slate-100 text-slate-700 rounded-full">草稿</span>;
      case 'submitted':
        return <span className="px-2 py-0.5 text-[11px] font-semibold bg-amber-100 text-amber-800 rounded-full animate-pulse">1.待部門審核</span>;
      case 'dept_approved':
        return <span className="px-2 py-0.5 text-[11px] font-semibold bg-blue-100 text-blue-800 rounded-full animate-pulse">2.待最高管理</span>;
      case 'admin_approved':
      case 'approved':
        return <span className="px-2 py-0.5 text-[11px] font-semibold bg-indigo-100 text-indigo-800 rounded-full">3.待行政撥款</span>;
      case 'rejected':
        return <span className="px-2 py-0.5 text-[11px] font-semibold bg-red-100 text-red-800 rounded-full">已退件駁回</span>;
      case 'paid':
        return <span className="px-2 py-0.5 text-[11px] font-semibold bg-emerald-100 text-emerald-800 rounded-full">已結案撥款</span>;
      default:
        return <span className="px-2 py-0.5 text-[11px] font-medium bg-slate-100 text-slate-700 rounded-full">{status}</span>;
    }
  };

  return (
    <div className="space-y-4">
      
      {/* 頂部操作欄與篩選工具列 */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-3.5">
        
        {/* 第一列：標題、搜尋欄、新增按鈕、匯出按鈕 */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Receipt className="w-5 h-5 text-blue-600" />
              費用報支單據明細
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                {filteredExpenses.length} 筆
              </span>
            </h2>
            <p className="text-xs text-slate-500">
              {currentUser.role === 'editor' 
                ? '僅顯示您個人填報之費用明細（最高管理員與審核員可查看全公司）'
                : '全公司各專案與各月份報銷總覽，支援即時多維度篩選與批次審核'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => exportToCSV(filteredExpenses, `費用報支清單_${selectedMonth}.csv`)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors"
            >
              <Download className="w-4 h-4 text-slate-500" />
              匯出 CSV
            </button>
            <button
              id="expense-create-btn"
              onClick={onOpenCreate}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-500/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <Plus className="w-4 h-4" />
              新增費用報支
            </button>
          </div>
        </div>

        {/* 第二列：快速關鍵字搜尋 & 快速月份標籤 */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3 pt-1">
          {/* 搜尋框 */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜尋說明、專案名稱、申請人、發票號碼、備註..."
              className="w-full text-xs pl-9 pr-4 py-2 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-2 text-xs text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            )}
          </div>

          {/* 月份快速標籤 */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 md:pb-0 no-scrollbar">
            <button
              onClick={() => setSelectedMonth('ALL')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                selectedMonth === 'ALL'
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              全部月份
            </button>
            {availableMonths.slice(0, 7).map(m => (
              <button
                key={m}
                onClick={() => setSelectedMonth(m)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                  selectedMonth === m
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        {/* 第三列：多條件下拉篩選器 */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 pt-1 text-xs">
          
          {/* 公司別篩選 */}
          <div>
            <label className="block text-[10px] font-semibold text-slate-400 mb-0.5">公司別</label>
            <select
              value={selectedCompany}
              onChange={(e) => setSelectedCompany(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50/50 text-slate-700 outline-none"
            >
              <option value="ALL">全部公司</option>
              {companies.map(c => (
                <option key={c.id} value={c.name}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* 專案篩選 */}
          <div>
            <label className="block text-[10px] font-semibold text-slate-400 mb-0.5">專案名稱</label>
            <select
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50/50 text-slate-700 outline-none truncate"
            >
              <option value="ALL">全部專案</option>
              {projects.map(p => (
                <option key={p.id} value={p.name}>{p.name}</option>
              ))}
            </select>
          </div>

          {/* 科目篩選 */}
          <div>
            <label className="block text-[10px] font-semibold text-slate-400 mb-0.5">會計科目</label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50/50 text-slate-700 outline-none"
            >
              <option value="ALL">全部科目</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.name}>{cat.name}</option>
              ))}
            </select>
          </div>

          {/* 審核狀態篩選 */}
          <div>
            <label className="block text-[10px] font-semibold text-slate-400 mb-0.5">審核狀態</label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50/50 text-slate-700 outline-none"
            >
              <option value="ALL">全部狀態</option>
              <option value="draft">草稿</option>
              <option value="submitted">待審核</option>
              <option value="approved">已核准</option>
              <option value="paid">已撥款</option>
              <option value="rejected">已駁回</option>
            </select>
          </div>

          {/* 申請人篩選 (管理員/審核員專屬) */}
          {currentUser.role !== 'editor' ? (
            <div>
              <label className="block text-[10px] font-semibold text-slate-400 mb-0.5">申請人</label>
              <select
                value={selectedApplicant}
                onChange={(e) => setSelectedApplicant(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50/50 text-slate-700 outline-none"
              >
                <option value="ALL">全部同仁</option>
                {availableApplicants.map(app => (
                  <option key={app} value={app}>{app}</option>
                ))}
              </select>
            </div>
          ) : (
            <div>
              <label className="block text-[10px] font-semibold text-slate-400 mb-0.5">申請人權限</label>
              <div className="px-2.5 py-1.5 rounded-lg bg-emerald-50 text-emerald-800 text-xs font-semibold border border-emerald-200 truncate">
                本人：{currentUser.name}
              </div>
            </div>
          )}

        </div>

      </div>

      {/* 批次操作工具列 (當有勾選項時顯示) */}
      {selectedIds.length > 0 && (
        <div className="bg-slate-900 text-white p-3 rounded-xl shadow-md flex flex-wrap items-center justify-between gap-3 animate-in fade-in duration-150 border border-slate-800">
          <div className="flex items-center gap-2 text-xs font-semibold">
            <span className="bg-blue-600 px-2 py-0.5 rounded-full text-white">已選 {selectedIds.length} 筆</span>
            <span className="text-slate-300">
              (合計：<strong className="text-emerald-400 font-mono">{formatMoney(filteredExpenses.filter(e => selectedIds.includes(e.id)).reduce((s, i) => s + i.amount, 0))}</strong>)
            </span>
          </div>
          
          <div className="flex flex-wrap items-center gap-2">
            {currentUser.role !== 'editor' && (
              <>
                <button
                  onClick={() => {
                    onBatchStatusChange(selectedIds, 'approved');
                    setSelectedIds([]);
                  }}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors cursor-pointer"
                >
                  ✓ 批次核准
                </button>
                <button
                  onClick={() => {
                    onBatchStatusChange(selectedIds, 'paid');
                    setSelectedIds([]);
                  }}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors cursor-pointer"
                >
                  💰 批次撥款
                </button>
              </>
            )}
            <button
              onClick={() => {
                onBatchStatusChange(selectedIds, 'submitted');
                setSelectedIds([]);
              }}
              className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer"
            >
              送審所選
            </button>
            <button
              onClick={() => setShowBatchDeleteConfirm(true)}
              className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors flex items-center gap-1 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              批次刪除 ({selectedIds.length})
            </button>
            <button
              onClick={() => setSelectedIds([])}
              className="text-xs text-slate-400 hover:text-white px-2 py-1 cursor-pointer"
            >
              取消勾選
            </button>
          </div>
        </div>
      )}

      {/* 費用明細表格 (響應式設計，支援手機端與電腦端) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        
        {/* 表格頂部摘要統計 */}
        <div className="px-5 py-3 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between text-xs text-slate-600">
          <div className="flex items-center gap-4">
            <span>篩選結果：<strong className="text-slate-900">{filteredExpenses.length}</strong> 筆</span>
            <span>篩選總額：<strong className="text-blue-700 font-bold">{formatMoney(filteredTotal)}</strong></span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-slate-400">排序：</span>
            <button
              onClick={() => {
                if (sortField === 'date') setSortAsc(!sortAsc);
                else { setSortField('date'); setSortAsc(false); }
              }}
              className={`flex items-center gap-0.5 hover:text-slate-900 ${sortField === 'date' ? 'font-bold text-blue-600' : ''}`}
            >
              日期 {sortField === 'date' && (sortAsc ? '↑' : '↓')}
            </button>
            <span className="text-slate-300">|</span>
            <button
              onClick={() => {
                if (sortField === 'amount') setSortAsc(!sortAsc);
                else { setSortField('amount'); setSortAsc(false); }
              }}
              className={`flex items-center gap-0.5 hover:text-slate-900 ${sortField === 'amount' ? 'font-bold text-blue-600' : ''}`}
            >
              金額 {sortField === 'amount' && (sortAsc ? '↑' : '↓')}
            </button>
          </div>
        </div>

        {/* 表格本體 */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-100/75 text-slate-600 font-semibold border-b border-slate-200">
              <tr>
                <th className="p-3 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={selectableExpenses.length > 0 && selectedIds.length === selectableExpenses.length}
                    onChange={handleSelectAll}
                    disabled={selectableExpenses.length === 0}
                    className="rounded text-blue-600 focus:ring-blue-500 cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
                    title={selectableExpenses.length === 0 ? '無可批次選取之單據 (已簽核單據已鎖定)' : '全選可批次操作之單據'}
                  />
                </th>
                <th className="p-3 w-16">項次</th>
                <th className="p-3 w-20">請款月份</th>
                <th className="p-3 w-24">日期</th>
                <th className="p-3 w-20">申請人</th>
                <th className="p-3 w-28">公司別</th>
                <th className="p-3 w-48">專案名稱</th>
                <th className="p-3 min-w-[200px]">說明摘要</th>
                <th className="p-3 w-24">科目</th>
                <th className="p-3 w-28 text-right">費用 (TWD)</th>
                <th className="p-3 w-24 text-center">狀態</th>
                <th className="p-3 w-32">備註 / 外幣</th>
                <th className="p-3 w-28 text-center">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredExpenses.length === 0 ? (
                <tr>
                  <td colSpan={13} className="p-12 text-center text-slate-400">
                    <AlertCircle className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                    沒有符合當前篩選條件的費用記錄
                  </td>
                </tr>
              ) : (
                filteredExpenses.map((item, idx) => {
                  const isSelected = selectedIds.includes(item.id);
                  const isApplicant = item.applicant.toLowerCase() === currentUser.name.toLowerCase() || (currentUser.englishName && item.applicant.toLowerCase() === currentUser.englishName.toLowerCase());
                  const canEdit = isSuperAdmin || currentUser.role === 'auditor' || isApplicant;
                  
                  // Requirement 7: 只要一但簽核過(部門審核/最高管理/已核准/已撥款)，非最高管理即鎖定不可修改刪除與批次選取
                  const isSignedOff = item.status === 'dept_approved' || item.status === 'admin_approved' || item.status === 'approved' || item.status === 'paid';
                  const isLocked = !isSuperAdmin && isSignedOff;

                  return (
                    <tr 
                      key={item.id}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        isSelected ? 'bg-blue-50/40' : ''
                      } ${item.status === 'rejected' ? 'bg-red-50/30' : ''}`}
                    >
                      {/* Checkbox (Requirement 7: 已簽核過則無批次 checkbox，除非最高管理) */}
                      <td className="p-3 text-center">
                        {!isLocked ? (
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectOne(item.id)}
                            className="rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                          />
                        ) : (
                          <span className="text-slate-300 font-mono text-xs select-none" title="已簽核單據已鎖定，無法批次選取">-</span>
                        )}
                      </td>

                      {/* 項次 */}
                      <td className="p-3 text-slate-400 font-mono text-[11px]">
                        #{item.itemNo || idx + 1}
                      </td>

                      {/* 請款月份 */}
                      <td className="p-3 font-semibold text-slate-700 font-mono">
                        {item.claimMonth}
                      </td>

                      {/* 日期 */}
                      <td className="p-3 text-slate-600 whitespace-nowrap">
                        {item.date}
                      </td>

                      {/* 申請人 */}
                      <td className="p-3">
                        <span className="font-semibold text-slate-800">
                          {item.applicant}
                        </span>
                      </td>

                      {/* 公司別 */}
                      <td className="p-3 text-slate-600 whitespace-nowrap">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                          item.companyName.includes('馬祖') ? 'bg-teal-50 text-teal-700 border border-teal-200' : 'bg-slate-100 text-slate-600'
                        }`}>
                          {item.companyName}
                        </span>
                      </td>

                      {/* 專案名稱 */}
                      <td className="p-3">
                        <span className="font-medium text-slate-800 line-clamp-2" title={item.projectName}>
                          {item.projectName}
                        </span>
                      </td>

                      {/* 說明摘要 */}
                      <td className="p-3">
                        <div className="font-normal text-slate-900 leading-snug">
                          {item.description}
                        </div>
                        {item.invoiceNo && (
                          <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                            發票: {item.invoiceNo}
                          </div>
                        )}
                        {item.rejectedReason && (
                          <div className="text-[10px] text-red-600 bg-red-50 p-1 rounded mt-1">
                            駁回原因: {item.rejectedReason}
                          </div>
                        )}
                      </td>

                      {/* 科目 */}
                      <td className="p-3 whitespace-nowrap">
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md font-medium text-[11px]">
                          {item.categoryName}
                        </span>
                      </td>

                      {/* 費用 */}
                      <td className="p-3 text-right whitespace-nowrap font-mono font-bold text-slate-900">
                        {formatMoney(item.amount)}
                      </td>

                      {/* 審核狀態 */}
                      <td className="p-3 text-center whitespace-nowrap">
                        {getStatusBadge(item.status)}
                      </td>

                      {/* 備註與外幣 */}
                      <td className="p-3 text-slate-500 text-[11px] max-w-[150px] truncate" title={item.remark}>
                        {item.remark || (item.currency !== 'TWD' ? `${item.currency} ${item.foreignAmount}` : '-')}
                        {item.receiptStatus === 'missing' && (
                          <span className="ml-1 text-red-500 font-bold">⚠️欠發票</span>
                        )}
                      </td>

                      {/* 操作區 */}
                      <td className="p-3 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1">
                          
                          {/* 草稿狀態支援送審 */}
                          {item.status === 'draft' && canEdit && (
                            <button
                              onClick={() => onStatusChange(item.id, 'submitted')}
                              title="送交審核"
                              className="p-1 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                            >
                              <Send className="w-4 h-4" />
                            </button>
                          )}

                          {/* 編輯 / 檢視按鈕 */}
                          {isLocked ? (
                            <button
                              onClick={() => onEditExpense(item)}
                              title="檢視單據明細 (已簽核唯讀)"
                              className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                          ) : (
                            canEdit && (
                              <button
                                onClick={() => onEditExpense(item)}
                                title={item.status === 'rejected' ? '編輯並重新送審' : '編輯單據明細'}
                                className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>
                            )
                          )}

                          {/* 刪除按鈕 (Requirement 7: 只要簽核過即不可刪除，除非駁回或最高管理者) */}
                          {!isLocked && canEdit && (
                            <button
                              onClick={() => setDeletingExpenseItem(item)}
                              title="刪除此筆報銷記錄"
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}

                          {/* 已鎖定標籤提示 */}
                          {isLocked && (
                            <span className="text-[10px] text-slate-400 font-medium px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 flex items-center gap-0.5">
                              <Lock className="w-2.5 h-2.5 text-slate-400" />
                              <span>{item.status === 'paid' ? '已撥款' : '已簽核'}</span>
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

      </div>

      {/* 1. 單筆刪除防呆確認彈窗 (In-App Modal) */}
      {deletingExpenseItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden space-y-4">
            
            {/* 彈窗頭部 */}
            <div className="bg-rose-50 p-5 border-b border-rose-100 flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-base text-slate-900">確認刪除此筆費用明細？</h3>
                <p className="text-xs text-rose-700 mt-0.5">
                  刪除後此單據將從系統資料庫中移除，並記錄於系統稽核歷程中。
                </p>
              </div>
            </div>

            {/* 單據明細卡片 */}
            <div className="px-5 space-y-2.5 text-xs text-slate-600">
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-400">請款月份 / 日期：</span>
                  <span className="font-semibold text-slate-800 font-mono">{deletingExpenseItem.claimMonth} / {deletingExpenseItem.date}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">申請人：</span>
                  <span className="font-semibold text-slate-800">{deletingExpenseItem.applicant}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">所屬專案：</span>
                  <span className="font-semibold text-slate-800 truncate max-w-[200px]">{deletingExpenseItem.projectName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">會計科目：</span>
                  <span className="font-semibold text-slate-800">{deletingExpenseItem.categoryName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">說明摘要：</span>
                  <span className="font-medium text-slate-900 truncate max-w-[200px]">{deletingExpenseItem.description}</span>
                </div>
                <div className="flex justify-between pt-1 border-t border-slate-200">
                  <span className="text-slate-500 font-bold">報銷金額：</span>
                  <span className="font-bold text-rose-600 font-mono text-sm">{formatMoney(deletingExpenseItem.amount)}</span>
                </div>
              </div>

              {(deletingExpenseItem.status === 'approved' || deletingExpenseItem.status === 'paid') && (
                <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-[11px] flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
                  <span>提示：此單據目前為【{deletingExpenseItem.status === 'approved' ? '已核准' : '已撥款'}】狀態，執行刪除將同步扣減專案累計支出。</span>
                </div>
              )}
            </div>

            {/* 彈窗按鈕區 */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setDeletingExpenseItem(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteExpense(deletingExpenseItem.id);
                  setDeletingExpenseItem(null);
                }}
                className="px-5 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 active:bg-rose-800 rounded-xl shadow-md shadow-rose-500/20 transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="w-4 h-4" />
                <span>確認永久刪除</span>
              </button>
            </div>

          </div>
        </div>
      )}

      {/* 2. 批次刪除防呆確認彈窗 */}
      {showBatchDeleteConfirm && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden space-y-4">
            
            <div className="bg-rose-50 p-5 border-b border-rose-100 flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-base text-slate-900">確認批次刪除 {selectedIds.length} 筆費用明細？</h3>
                <p className="text-xs text-rose-700 mt-0.5">
                  您已選取 {selectedIds.length} 筆報銷單據，此操作將一併自系統資料庫中刪除。
                </p>
              </div>
            </div>

            <div className="px-5 space-y-2 text-xs text-slate-600">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex justify-between items-center">
                <span className="font-semibold text-slate-700">選取項目合計金額：</span>
                <span className="font-mono font-bold text-rose-600 text-base">
                  {formatMoney(filteredExpenses.filter(e => selectedIds.includes(e.id)).reduce((s, i) => s + i.amount, 0))}
                </span>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setShowBatchDeleteConfirm(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => {
                  if (onBatchDeleteExpenses) {
                    onBatchDeleteExpenses(selectedIds);
                  } else {
                    selectedIds.forEach(id => onDeleteExpense(id));
                  }
                  setSelectedIds([]);
                  setShowBatchDeleteConfirm(false);
                }}
                className="px-5 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-md shadow-rose-500/20 transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="w-4 h-4" />
                <span>確認批次刪除 ({selectedIds.length})</span>
              </button>
            </div>

          </div>
        </div>
      )}

      {/* 3. 駁回理由輸入彈窗 (防呆機制) */}
      {rejectingId && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-xl p-5 space-y-4">
            <div className="flex items-center gap-2 text-red-600">
              <AlertCircle className="w-5 h-5" />
              <h3 className="font-bold text-base text-slate-900">填寫駁回/退回原因</h3>
            </div>
            <p className="text-xs text-slate-500">
              請說明駁回原因（如發票模糊、超過餐費標準或專案歸屬錯誤），以便申請人修改後重新送審。
            </p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="例如：請補附發票照片、餐費每人上限為 300 元..."
              rows={3}
              className="w-full text-xs p-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-red-500 outline-none"
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setRejectingId(null)}
                className="px-3.5 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
              >
                取消
              </button>
              <button
                onClick={() => {
                  onStatusChange(rejectingId, 'rejected', rejectReason || '單據資訊不符，退回修正');
                  setRejectingId(null);
                }}
                className="px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg shadow-sm cursor-pointer"
              >
                確認駁回
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
