import React, { useState, useMemo } from 'react';
import { 
  CheckSquare, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  ArrowLeft, 
  FileText, 
  AlertTriangle, 
  DollarSign, 
  Send,
  UserCheck,
  ShieldAlert,
  Sparkles,
  Search,
  Filter,
  Calendar,
  ChevronRight,
  User,
  Building,
  Layers,
  ArrowUpDown,
  Download,
  Image as ImageIcon,
  Check,
  ExternalLink,
  Receipt,
  FileSpreadsheet,
  Building2,
  Trash2
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { ExpenseItem, ExpenseStatus, Project, Company, ExpenseCategory, UserProfile } from '../types';
import { exportToExcel, formatMoney } from '../utils/exportUtils';

interface ApprovalWorkflowViewProps {
  expenses: ExpenseItem[];
  currentUser: UserProfile;
  projects?: Project[];
  companies?: Company[];
  categories?: ExpenseCategory[];
  onStatusChange: (id: string, newStatus: ExpenseStatus, rejectReason?: string) => void;
  onBatchStatusChange: (ids: string[], newStatus: ExpenseStatus) => void;
  onDeleteExpense?: (id: string) => void;
  setActiveTab: (tab: string) => void;
}

// 申請人月度群組資料結構 (同一人同一月份，可能包含不同公司的報支)
interface MonthlyApplicantGroup {
  key: string; // e.g. "202603___林志豪"
  claimMonth: string;
  applicant: string;
  companiesList: string[]; // 該人在該月報支涵蓋的所有公司清單
  totalAmount: number;
  pendingAmount: number;
  approvedAmount: number;
  rejectedAmount: number;
  paidAmount: number;
  totalCount: number;
  pendingCount: number;
  approvedCount: number;
  rejectedCount: number;
  paidCount: number;
  items: ExpenseItem[];
  projectNames: string[];
  categoryNames: string[];
  hasReceiptIssue: boolean;
}

export const ApprovalWorkflowView: React.FC<ApprovalWorkflowViewProps> = ({
  expenses,
  currentUser,
  projects = [],
  companies = [],
  categories = [],
  onStatusChange,
  onBatchStatusChange,
  onDeleteExpense,
  setActiveTab,
}) => {
  // 篩選狀態
  const [selectedMonth, setSelectedMonth] = useState<string>('ALL');
  const [searchApplicant, setSearchApplicant] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'has_pending' | 'all_approved' | 'has_rejected'>('ALL');
  
  // 當前深入查看的群組 (若為 null 則顯示群組總覽列表；若有值則進入該個人該月明細表格)
  const [activeGroupKey, setActiveGroupKey] = useState<string | null>(null);

  // 明細表格內多選勾選
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  
  // 駁回彈窗
  const [rejectModalState, setRejectModalState] = useState<{
    isOpen: boolean;
    targetIds: string[];
    applicantName: string;
    month: string;
  }>({
    isOpen: false,
    targetIds: [],
    applicantName: '',
    month: '',
  });
  const [rejectReason, setRejectReason] = useState<string>('');

  // 發票收據圖片預覽
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // 刪除確認彈窗狀態
  const [deletingItem, setDeletingItem] = useState<ExpenseItem | null>(null);

  const isReviewer = currentUser.role === 'admin' || currentUser.role === 'auditor';

  // 1. 根據權限過濾資料 (一般使用者只能看自己申請的單據)
  const scopedExpenses = useMemo(() => {
    if (!isReviewer) {
      return expenses.filter(e => e.applicant.toLowerCase() === currentUser.name.toLowerCase() || (currentUser.englishName && e.applicant.toLowerCase() === currentUser.englishName.toLowerCase()));
    }
    return expenses;
  }, [expenses, isReviewer, currentUser]);

  // 2. 獲取所有不重複月份清單 (由新到舊排序)
  const availableMonths = useMemo(() => {
    const set = new Set(scopedExpenses.map(e => e.claimMonth || '未分類'));
    return Array.from(set).sort().reverse();
  }, [scopedExpenses]);

  // 3. 將資料按「請款月份 + 申請人」進行頂層群組化 (同一人同月份不同公司整合在一起)
  const applicantGroups = useMemo(() => {
    const groupMap = new Map<string, MonthlyApplicantGroup>();

    scopedExpenses.forEach(item => {
      const month = item.claimMonth || '未填寫月份';
      const applicant = item.applicant || '未知申請人';
      const key = `${month}___${applicant}`;

      if (!groupMap.has(key)) {
        groupMap.set(key, {
          key,
          claimMonth: month,
          applicant,
          companiesList: [],
          totalAmount: 0,
          pendingAmount: 0,
          approvedAmount: 0,
          rejectedAmount: 0,
          paidAmount: 0,
          totalCount: 0,
          pendingCount: 0,
          approvedCount: 0,
          rejectedCount: 0,
          paidCount: 0,
          items: [],
          projectNames: [],
          categoryNames: [],
          hasReceiptIssue: false,
        });
      }

      const grp = groupMap.get(key)!;
      grp.items.push(item);
      grp.totalCount += 1;
      grp.totalAmount += Number(item.amount || 0);

      const comp = item.companyName || '邦捷總公司';
      if (!grp.companiesList.includes(comp)) {
        grp.companiesList.push(comp);
      }

      if (item.status === 'submitted') {
        grp.pendingCount += 1;
        grp.pendingAmount += Number(item.amount || 0);
      } else if (item.status === 'approved') {
        grp.approvedCount += 1;
        grp.approvedAmount += Number(item.amount || 0);
      } else if (item.status === 'rejected') {
        grp.rejectedCount += 1;
        grp.rejectedAmount += Number(item.amount || 0);
      } else if (item.status === 'paid') {
        grp.paidCount += 1;
        grp.paidAmount += Number(item.amount || 0);
      }

      if (item.projectName && !grp.projectNames.includes(item.projectName)) {
        grp.projectNames.push(item.projectName);
      }
      if (item.categoryName && !grp.categoryNames.includes(item.categoryName)) {
        grp.categoryNames.push(item.categoryName);
      }
      if (item.receiptStatus === 'missing') {
        grp.hasReceiptIssue = true;
      }
    });

    // 轉換為陣列並依照「待審核數優先、月份新到舊、申請人」排序
    return Array.from(groupMap.values()).sort((a, b) => {
      if (a.pendingCount > 0 && b.pendingCount === 0) return -1;
      if (b.pendingCount > 0 && a.pendingCount === 0) return 1;
      if (a.claimMonth !== b.claimMonth) {
        return b.claimMonth.localeCompare(a.claimMonth);
      }
      return a.applicant.localeCompare(b.applicant);
    });
  }, [scopedExpenses]);

  // 4. 套用使用者選擇的月份與搜尋條件
  const filteredGroups = useMemo(() => {
    return applicantGroups.filter(grp => {
      if (selectedMonth !== 'ALL' && grp.claimMonth !== selectedMonth) {
        return false;
      }
      if (searchApplicant.trim()) {
        const q = searchApplicant.toLowerCase();
        const matchApplicant = grp.applicant.toLowerCase().includes(q);
        const matchCompany = grp.companiesList.some(c => c.toLowerCase().includes(q));
        const matchProjects = grp.projectNames.some(p => p.toLowerCase().includes(q));
        if (!matchApplicant && !matchCompany && !matchProjects) return false;
      }
      if (statusFilter === 'has_pending' && grp.pendingCount === 0) return false;
      if (statusFilter === 'all_approved' && (grp.pendingCount > 0 || grp.approvedCount === 0)) return false;
      if (statusFilter === 'has_rejected' && grp.rejectedCount === 0) return false;

      return true;
    });
  }, [applicantGroups, selectedMonth, searchApplicant, statusFilter]);

  // 當前選中的明細群組物件
  const activeGroup = useMemo(() => {
    if (!activeGroupKey) return null;
    return applicantGroups.find(g => g.key === activeGroupKey) || null;
  }, [activeGroupKey, applicantGroups]);

  // 依公司分組的明細列表 (點進明細時依各公司群組並列，審批撥款不用再分兩張)
  const itemsByCompany = useMemo(() => {
    if (!activeGroup) return [];
    const map = new Map<string, ExpenseItem[]>();
    activeGroup.items.forEach(item => {
      const comp = item.companyName || '邦捷總公司';
      if (!map.has(comp)) {
        map.set(comp, []);
      }
      map.get(comp)!.push(item);
    });
    return Array.from(map.entries()).map(([companyName, items]) => {
      const companyTotal = items.reduce((s, i) => s + i.amount, 0);
      const companyPending = items.filter(i => i.status === 'submitted').reduce((s, i) => s + i.amount, 0);
      const companyApproved = items.filter(i => i.status === 'approved').reduce((s, i) => s + i.amount, 0);
      const companyPaid = items.filter(i => i.status === 'paid').reduce((s, i) => s + i.amount, 0);
      return {
        companyName,
        items,
        companyTotal,
        companyPending,
        companyApproved,
        companyPaid,
      };
    });
  }, [activeGroup]);

  // 全局總結數據
  const stats = useMemo(() => {
    let totalAmt = 0;
    let pendingAmt = 0;
    let approvedAmt = 0;
    let totalPendingItems = 0;
    let totalGroups = applicantGroups.length;

    filteredGroups.forEach(g => {
      totalAmt += g.totalAmount;
      pendingAmt += g.pendingAmount;
      approvedAmt += g.approvedAmount;
      totalPendingItems += g.pendingCount;
    });

    return { totalAmt, pendingAmt, approvedAmt, totalPendingItems, totalGroups };
  }, [filteredGroups, applicantGroups]);

  // 批次核准指定群組內所有待審單據 (含跨公司)
  const handleApproveAllInGroup = (grp: MonthlyApplicantGroup, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const pendingIds = grp.items.filter(i => i.status === 'submitted').map(i => i.id);
    if (pendingIds.length === 0) return;

    if (window.confirm(`確定要一鍵批次核准【${grp.applicant}】於 ${grp.claimMonth} 月份涵蓋各公司的全部 ${pendingIds.length} 筆待審報銷單（合計 ${formatMoney(grp.pendingAmount)}）嗎？`)) {
      onBatchStatusChange(pendingIds, 'approved');
      try {
        confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
      } catch (err) {}
    }
  };

  // 批次標記撥款指定群組內所有已核准單據 (含跨公司)
  const handlePayAllInGroup = (grp: MonthlyApplicantGroup, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const approvedIds = grp.items.filter(i => i.status === 'approved').map(i => i.id);
    if (approvedIds.length === 0) return;

    if (window.confirm(`確定要將【${grp.applicant}】於 ${grp.claimMonth} 月份涵蓋各公司的 ${approvedIds.length} 筆已核准單據（合計 ${formatMoney(grp.approvedAmount)}）合併完成撥款作業嗎？`)) {
      onBatchStatusChange(approvedIds, 'paid');
    }
  };

  // 打開駁回彈窗
  const handleOpenRejectModal = (ids: string[], applicantName: string, month: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setRejectModalState({
      isOpen: true,
      targetIds: ids,
      applicantName,
      month,
    });
    setRejectReason('');
  };

  // 執行駁回
  const handleConfirmReject = () => {
    if (rejectModalState.targetIds.length === 0) return;
    const finalReason = rejectReason.trim() || '單據明細或金額有誤，請修正後重新送審';
    
    rejectModalState.targetIds.forEach(id => {
      onStatusChange(id, 'rejected', finalReason);
    });

    setRejectModalState({ isOpen: false, targetIds: [], applicantName: '', month: '' });
    setSelectedItemIds([]);
  };

  // 明細表格內勾選操作
  const toggleSelectDetailItem = (id: string) => {
    setSelectedItemIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleSelectAllDetailItems = (items: ExpenseItem[]) => {
    if (selectedItemIds.length === items.length) {
      setSelectedItemIds([]);
    } else {
      setSelectedItemIds(items.map(i => i.id));
    }
  };

  const handleApproveSelectedDetails = () => {
    if (selectedItemIds.length === 0) return;
    onBatchStatusChange(selectedItemIds, 'approved');
    setSelectedItemIds([]);
  };

  const handlePaySelectedDetails = () => {
    if (selectedItemIds.length === 0) return;
    onBatchStatusChange(selectedItemIds, 'paid');
    setSelectedItemIds([]);
  };

  // 匯出個人月度報支清單為 Excel
  const handleExportGroupExcel = (grp: MonthlyApplicantGroup) => {
    const filename = `${grp.claimMonth}_${grp.applicant}_各公司費用報支簽核清單.xlsx`;
    exportToExcel(grp.items, filename);
  };

  return (
    <div className="space-y-6">
      
      {/* 頂部橫幅 */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-900 rounded-2xl p-6 text-white shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-500/30 text-indigo-200 border border-indigo-400/30">
              審批簽核中心 (Grouped Approval Center)
            </span>
            <span className="text-xs text-slate-300">
              {isReviewer ? '同一人同月份跨公司整合審核' : '個人月度報銷進度追蹤'}
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <CheckSquare className="w-6 h-6 text-indigo-400" />
            個人月度費用審批與跨公司合併撥款
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl">
            將同月份同一申請人之報支單據彙整為月度總覽；點進明細後依各公司分組並列，主管與出納可一次完成審批與整月撥款。
          </p>
        </div>

        {/* 快速統計數據條 */}
        <div className="flex items-center gap-3 shrink-0 bg-white/10 backdrop-blur-md px-4 py-3 rounded-xl border border-white/10">
          <div className="text-center px-2">
            <div className="text-[10px] text-slate-300 font-medium uppercase">待審核總額</div>
            <div className="text-lg font-black font-mono text-amber-300">{formatMoney(stats.pendingAmt)}</div>
          </div>
          <div className="h-7 w-px bg-white/20" />
          <div className="text-center px-2">
            <div className="text-[10px] text-slate-300 font-medium uppercase">待簽單據</div>
            <div className="text-lg font-black font-mono text-white">{stats.totalPendingItems} 筆</div>
          </div>
        </div>
      </div>

      {/* 頂部四項指標卡片 */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl">
            <div className="text-[11px] font-bold text-slate-500 flex items-center gap-1">
              <User className="w-3 h-3 text-slate-400" />
              月度個人群組數
            </div>
            <div className="text-lg sm:text-xl font-bold font-mono text-slate-800 mt-0.5">
              {filteredGroups.length} <span className="text-xs font-normal text-slate-500">個組別</span>
            </div>
            <div className="text-[10px] text-slate-400 mt-1">
              總申請金額 {formatMoney(stats.totalAmt)}
            </div>
          </div>

          <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-xl">
            <div className="text-[11px] font-bold text-amber-700 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              待審批總額
            </div>
            <div className="text-lg sm:text-xl font-bold font-mono text-amber-900 mt-0.5">
              {formatMoney(stats.pendingAmt)}
            </div>
            <div className="text-[10px] text-amber-700/80 mt-1 font-medium">
              共 {stats.totalPendingItems} 筆待簽核單據
            </div>
          </div>

          <div className="p-3 bg-blue-50/80 border border-blue-200 rounded-xl">
            <div className="text-[11px] font-bold text-blue-700 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" />
              已核准待撥款
            </div>
            <div className="text-lg sm:text-xl font-bold font-mono text-blue-900 mt-0.5">
              {formatMoney(stats.approvedAmt)}
            </div>
            <div className="text-[10px] text-blue-600 mt-1">
              等待出納匯款入帳
            </div>
          </div>

          <div className="p-3 bg-indigo-50/80 border border-indigo-200 rounded-xl">
            <div className="text-[11px] font-bold text-indigo-700 flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              跨公司合併撥款
            </div>
            <div className="text-xs font-bold text-indigo-900 mt-1">
              同月份多公司並列審核
            </div>
            <div className="text-[10px] text-indigo-600 mt-1">
              一次核簽免拆兩張單據
            </div>
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 視圖切換：若未選中特定群組，顯示「月度申請人群組清單」 */}
      {/* ======================================================== */}
      {!activeGroup ? (
        <div className="space-y-4">
          
          {/* 工具篩選列 */}
          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3">
            
            {/* 月份選擇器 & 申請人搜尋 */}
            <div className="flex flex-wrap items-center gap-2.5">
              
              {/* 月份下拉選單 */}
              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs">
                <Calendar className="w-3.5 h-3.5 text-slate-500" />
                <span className="font-bold text-slate-600">請款月份：</span>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="bg-transparent font-bold text-slate-900 outline-none cursor-pointer"
                >
                  <option value="ALL">全部月份 (All Months)</option>
                  {availableMonths.map(m => (
                    <option key={m} value={m}>{m} 月份</option>
                  ))}
                </select>
              </div>

              {/* 申請人搜尋輸入 */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
                <input
                  type="text"
                  value={searchApplicant}
                  onChange={(e) => setSearchApplicant(e.target.value)}
                  placeholder="搜尋申請人、專案、公司..."
                  className="bg-slate-50 border border-slate-200 rounded-lg py-1 pl-8 pr-3 text-xs w-48 sm:w-56 outline-none focus:border-indigo-500 focus:bg-white transition-all text-slate-800"
                />
              </div>

            </div>

            {/* 狀態過濾按鈕組 */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg text-xs self-start md:self-auto">
              <button
                onClick={() => setStatusFilter('ALL')}
                className={`px-2.5 py-1 rounded-md font-bold transition-all cursor-pointer ${
                  statusFilter === 'ALL' ? 'bg-white text-indigo-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                全部群組 ({applicantGroups.length})
              </button>
              <button
                onClick={() => setStatusFilter('has_pending')}
                className={`px-2.5 py-1 rounded-md font-bold transition-all flex items-center gap-1 cursor-pointer ${
                  statusFilter === 'has_pending' ? 'bg-amber-500 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-amber-300" />
                有待審核
              </button>
              <button
                onClick={() => setStatusFilter('all_approved')}
                className={`px-2.5 py-1 rounded-md font-bold transition-all cursor-pointer ${
                  statusFilter === 'all_approved' ? 'bg-blue-600 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                已全部核准
              </button>
              <button
                onClick={() => setStatusFilter('has_rejected')}
                className={`px-2.5 py-1 rounded-md font-bold transition-all cursor-pointer ${
                  statusFilter === 'has_rejected' ? 'bg-rose-600 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                有駁回退件
              </button>
            </div>

          </div>

          {/* 群組卡片清單列表 */}
          {filteredGroups.length === 0 ? (
            <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center shadow-2xs">
              <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
              <h3 className="text-base font-bold text-slate-800">查無符合條件之月度申請人群組</h3>
              <p className="text-xs text-slate-500 mt-1">
                目前沒有待審核或符合篩選條件的報銷單。
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredGroups.map((grp) => {
                const isFullyApproved = grp.pendingCount === 0 && grp.approvedCount > 0;
                const isFullyPaid = grp.pendingCount === 0 && grp.approvedCount === 0 && grp.paidCount > 0;
                const hasPending = grp.pendingCount > 0;

                return (
                  <div
                    key={grp.key}
                    onClick={() => setActiveGroupKey(grp.key)}
                    className={`bg-white rounded-2xl border transition-all duration-200 cursor-pointer overflow-hidden flex flex-col justify-between hover:shadow-md hover:-translate-y-0.5 ${
                      hasPending
                        ? 'border-amber-300 hover:border-amber-400 ring-1 ring-amber-200/60'
                        : isFullyApproved
                        ? 'border-blue-200 hover:border-blue-300'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    {/* 卡片頂部：月份、申請人與狀態 Tag */}
                    <div className="p-4 border-b border-slate-100 bg-gradient-to-b from-slate-50/50 to-transparent">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">
                          {grp.claimMonth} 月份
                        </span>
                        {hasPending ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300 flex items-center gap-1 animate-pulse">
                            <Clock className="w-3 h-3" />
                            {grp.pendingCount} 筆待審核
                          </span>
                        ) : isFullyApproved ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-300 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            已核准待撥
                          </span>
                        ) : isFullyPaid ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                            <Check className="w-3 h-3" />
                            已結案撥款
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600">
                            共 {grp.totalCount} 筆
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-slate-800 text-white font-bold flex items-center justify-center text-sm shadow-xs shrink-0">
                          {grp.applicant.substring(0, 1)}
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-bold text-base text-slate-900 truncate">
                            {grp.applicant}
                          </h3>
                          <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                            {grp.companiesList.map(comp => (
                              <span key={comp} className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded border border-slate-200">
                                {comp}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* 卡片主體：該月總金額 (超大字) 與細項分佈 */}
                    <div className="p-4 space-y-3">
                      <div>
                        <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                          該月申請總金額 (跨公司合計)
                        </div>
                        <div className="text-2xl font-bold font-mono text-slate-900 mt-0.5 tracking-tight flex items-baseline gap-1">
                          <span>{formatMoney(grp.totalAmount)}</span>
                          <span className="text-xs font-normal text-slate-400 font-sans">TWD</span>
                        </div>
                      </div>

                      {/* 待審與已核准金額明細 */}
                      <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2 rounded-xl text-xs">
                        <div>
                          <div className="text-[10px] text-slate-500 font-medium">待審金額：</div>
                          <div className="font-bold font-mono text-amber-700">
                            {formatMoney(grp.pendingAmount)}
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] text-slate-500 font-medium">已核准額：</div>
                          <div className="font-bold font-mono text-blue-700">
                            {formatMoney(grp.approvedAmount)}
                          </div>
                        </div>
                      </div>

                      {/* 涉及專案與科目 */}
                      <div className="space-y-1 text-[11px] text-slate-500">
                        <div className="truncate">
                          <span className="font-semibold text-slate-700">專案：</span>
                          {grp.projectNames.join('、') || '無'}
                        </div>
                        <div className="truncate">
                          <span className="font-semibold text-slate-700">科目：</span>
                          {grp.categoryNames.join('、') || '無'}
                        </div>
                      </div>
                    </div>

                    {/* 卡片底部操作按鈕 */}
                    <div className="p-3 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between gap-2">
                      <div className="text-xs font-bold text-indigo-600 flex items-center gap-0.5">
                        <span>查看明細與審批</span>
                        <ChevronRight className="w-4 h-4" />
                      </div>

                      {/* 批次一鍵核准快捷按鈕 (僅審核員且有待審項目) */}
                      {isReviewer && hasPending && (
                        <button
                          onClick={(e) => handleApproveAllInGroup(grp, e)}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-2xs transition-colors flex items-center gap-1 shrink-0 cursor-pointer"
                          title="一鍵核准該月份該申請人的全部待審單據"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>一鍵全核</span>
                        </button>
                      )}

                      {/* 批次撥款快捷按鈕 (僅審核員且皆已核准) */}
                      {isReviewer && !hasPending && grp.approvedCount > 0 && (
                        <button
                          onClick={(e) => handlePayAllInGroup(grp, e)}
                          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-2xs transition-colors flex items-center gap-1 shrink-0 cursor-pointer"
                          title="批次標記為已撥款"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>合併撥款</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

        </div>
      ) : (
        /* ======================================================== */
        /* 第二層：個人月度費用明細表格視圖 (依各公司分組並列排版) */
        /* ======================================================== */
        <div className="space-y-6">
          
          {/* 頂部麵包屑導航與個人月度資訊頭部 */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <button
                onClick={() => {
                  setActiveGroupKey(null);
                  setSelectedItemIds([]);
                }}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-indigo-600 transition-colors mb-1 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                返回月度申請人總覽列表
              </button>
              
              <div className="flex items-center gap-3 flex-wrap">
                <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">
                  {activeGroup.claimMonth} 月份
                </span>
                <h3 className="text-lg sm:text-xl font-bold text-slate-900">
                  【{activeGroup.applicant}】費用報支審批明細表 (各公司合併檢視)
                </h3>
              </div>
              <p className="text-xs text-slate-500">
                涵蓋公司主體：{activeGroup.companiesList.join('、')}
              </p>
            </div>

            {/* 該人該月總金額大標籤 */}
            <div className="flex items-center gap-4 shrink-0 bg-slate-50 border border-slate-200 px-4 py-2.5 rounded-xl">
              <div>
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                  該月申請總計 ({activeGroup.totalCount} 筆)
                </div>
                <div className="text-xl font-bold font-mono text-indigo-600">
                  {formatMoney(activeGroup.totalAmount)}
                </div>
              </div>
              <div className="h-8 w-px bg-slate-200" />
              <div>
                <div className="text-[10px] text-slate-400 font-bold">待審核金額</div>
                <div className="text-sm font-bold font-mono text-amber-700">
                  {formatMoney(activeGroup.pendingAmount)}
                </div>
              </div>
            </div>
          </div>

          {/* 批次操作工具列 (針對勾選項目或全體一鍵核准) */}
          <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleSelectAllDetailItems(activeGroup.items)}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-colors cursor-pointer"
              >
                {selectedItemIds.length === activeGroup.items.length ? '取消全選' : '全選本月所有單據'}
              </button>

              {selectedItemIds.length > 0 && isReviewer && (
                <>
                  <button
                    onClick={handleApproveSelectedDetails}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-2xs transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    核准已選 ({selectedItemIds.length} 筆)
                  </button>

                  <button
                    onClick={(e) => handleOpenRejectModal(selectedItemIds, activeGroup.applicant, activeGroup.claimMonth, e)}
                    className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold shadow-2xs transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    駁回已選
                  </button>

                  <button
                    onClick={handlePaySelectedDetails}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-2xs transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5" />
                    標記撥款
                  </button>
                </>
              )}
            </div>

            <div className="flex items-center gap-2">
              {/* 一鍵全額核准該人該月全部待審 */}
              {isReviewer && activeGroup.pendingCount > 0 && (
                <button
                  onClick={(e) => handleApproveAllInGroup(activeGroup, e)}
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>一鍵批次核准本月全部待審 ({activeGroup.pendingCount} 筆)</span>
                </button>
              )}

              {/* 匯出該人月度 Excel */}
              <button
                onClick={() => handleExportGroupExcel(activeGroup)}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
                title="下載該申請人該月份的 Excel 明細表"
              >
                <Download className="w-3.5 h-3.5 text-slate-500" />
                <span>匯出 Excel</span>
              </button>
            </div>
          </div>

          {/* 依各公司群組並列渲染報支表格 (Grouping by Company) */}
          <div className="space-y-6">
            {itemsByCompany.map((compGroup) => (
              <div key={compGroup.companyName} className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
                
                {/* 各公司表頭與小計摘要 */}
                <div className="px-5 py-3.5 bg-slate-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <Building2 className="w-5 h-5 text-indigo-400" />
                    <span className="font-bold text-sm sm:text-base tracking-tight">{compGroup.companyName}</span>
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-mono bg-white/10 text-slate-200">
                      {compGroup.items.length} 筆單據
                    </span>
                  </div>

                  <div className="flex items-center gap-4 text-xs">
                    <div>
                      公司小計：<strong className="text-emerald-400 font-mono font-bold">{formatMoney(compGroup.companyTotal)}</strong>
                    </div>
                    {compGroup.companyPending > 0 && (
                      <div>
                        待審額：<strong className="text-amber-300 font-mono">{formatMoney(compGroup.companyPending)}</strong>
                      </div>
                    )}
                  </div>
                </div>

                {/* 報支明細表格 */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-100/75 border-b border-slate-200 text-slate-600 font-bold">
                        <th className="p-3 w-10 text-center">
                          <input
                            type="checkbox"
                            checked={compGroup.items.every(i => selectedItemIds.includes(i.id)) && compGroup.items.length > 0}
                            onChange={() => {
                              const compIds = compGroup.items.map(i => i.id);
                              const allChecked = compIds.every(id => selectedItemIds.includes(id));
                              if (allChecked) {
                                setSelectedItemIds(prev => prev.filter(id => !compIds.includes(id)));
                              } else {
                                setSelectedItemIds(prev => Array.from(new Set([...prev, ...compIds])));
                              }
                            }}
                            className="rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                          />
                        </th>
                        <th className="p-3 w-12 text-center">項次</th>
                        <th className="p-3 w-24">日期</th>
                        <th className="p-3 w-40">專案名稱</th>
                        <th className="p-3 w-28">會計科目</th>
                        <th className="p-3 min-w-[200px]">費用說明 / 摘要</th>
                        <th className="p-3 w-28 text-center">發票 / 憑證</th>
                        <th className="p-3 w-24 text-right">外幣原額</th>
                        <th className="p-3 w-32 text-right">折合台幣 (TWD)</th>
                        <th className="p-3 w-24 text-center">審核狀態</th>
                        <th className="p-3 w-36 text-center">審批動作</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-800">
                      {compGroup.items.map((item, index) => {
                        const isSelected = selectedItemIds.includes(item.id);

                        return (
                          <tr 
                            key={item.id}
                            className={`hover:bg-indigo-50/30 transition-colors ${
                              isSelected ? 'bg-indigo-50/50' : ''
                            }`}
                          >
                            {/* 勾選框 */}
                            <td className="p-3 text-center">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleSelectDetailItem(item.id)}
                                className="rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                              />
                            </td>

                            {/* 項次 */}
                            <td className="p-3 text-center font-mono text-slate-400">
                              #{item.itemNo || index + 1}
                            </td>

                            {/* 發生日期 */}
                            <td className="p-3 font-medium whitespace-nowrap">
                              {item.date}
                            </td>

                            {/* 專案名稱 */}
                            <td className="p-3">
                              <span className="font-semibold text-slate-800 block truncate max-w-[150px]" title={item.projectName}>
                                {item.projectName}
                              </span>
                            </td>

                            {/* 會計科目 */}
                            <td className="p-3">
                              <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-medium">
                                {item.categoryName}
                              </span>
                            </td>

                            {/* 說明與備註 */}
                            <td className="p-3">
                              <div className="font-medium text-slate-900">{item.description}</div>
                              {item.remark && (
                                <div className="text-[11px] text-slate-400 truncate max-w-[220px]" title={item.remark}>
                                  備註：{item.remark}
                                </div>
                              )}
                            </td>

                            {/* 發票狀態 */}
                            <td className="p-3 text-center whitespace-nowrap">
                              {item.receiptStatus === 'missing' ? (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200 flex items-center justify-center gap-1">
                                  <AlertTriangle className="w-3 h-3 text-rose-600" />
                                  欠發票
                                </span>
                              ) : item.receiptImage ? (
                                <button
                                  onClick={() => setPreviewImage(item.receiptImage || null)}
                                  className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-200 hover:bg-indigo-200 transition-colors flex items-center justify-center gap-1 mx-auto"
                                >
                                  <ImageIcon className="w-3 h-3" />
                                  檢視憑證
                                </button>
                              ) : (
                                <span className="text-[11px] text-slate-500 font-mono">
                                  {item.invoiceNo || '已附單據'}
                                </span>
                              )}
                            </td>

                            {/* 外幣原額 */}
                            <td className="p-3 text-right font-mono text-slate-500 whitespace-nowrap">
                              {item.currency !== 'TWD' && item.foreignAmount ? (
                                <span>{item.currency} {item.foreignAmount}</span>
                              ) : (
                                '-'
                              )}
                            </td>

                            {/* 費用金額 (TWD) */}
                            <td className="p-3 text-right font-mono font-bold text-slate-900 whitespace-nowrap text-sm">
                              {formatMoney(item.amount)}
                            </td>

                            {/* 狀態標籤 */}
                            <td className="p-3 text-center whitespace-nowrap">
                              {item.status === 'submitted' && (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                                  待審核
                                </span>
                              )}
                              {item.status === 'approved' && (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                  已核准
                                </span>
                              )}
                              {item.status === 'paid' && (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">
                                  已撥款
                                </span>
                              )}
                              {item.status === 'rejected' && (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200" title={item.rejectedReason}>
                                  已駁回
                                </span>
                              )}
                            </td>

                            {/* 審批動作按鈕 */}
                            <td className="p-3 text-center whitespace-nowrap">
                              <div className="flex items-center justify-center gap-1">
                                {isReviewer && item.status === 'submitted' && (
                                  <>
                                    <button
                                      onClick={() => onStatusChange(item.id, 'approved')}
                                      className="p-1 text-emerald-600 hover:bg-emerald-50 rounded transition-colors"
                                      title="核准此筆"
                                    >
                                      <CheckCircle2 className="w-4 h-4" />
                                    </button>
                                    <button
                                      onClick={(e) => handleOpenRejectModal([item.id], activeGroup.applicant, activeGroup.claimMonth, e)}
                                      className="p-1 text-rose-600 hover:bg-rose-50 rounded transition-colors"
                                      title="駁回此筆"
                                    >
                                      <XCircle className="w-4 h-4" />
                                    </button>
                                  </>
                                )}

                                {isReviewer && item.status === 'approved' && (
                                  <button
                                    onClick={() => onStatusChange(item.id, 'paid')}
                                    className="p-1 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                    title="標記撥款"
                                  >
                                    <Check className="w-4 h-4" />
                                  </button>
                                )}

                                {(item.status === 'approved' || item.status === 'paid') && (
                                  <span className="text-[10px] text-slate-400 font-medium px-1.5 py-0.5 rounded bg-slate-100">
                                    已核定
                                  </span>
                                )}

                                {/* 刪除按鈕 (支援審核員/管理員或申請人刪除有誤單據) */}
                                {onDeleteExpense && (currentUser.role === 'admin' || (item.status !== 'approved' && item.status !== 'paid')) && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setDeletingItem(item);
                                    }}
                                    className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                                    title="刪除此筆單據"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </td>

                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

              </div>
            ))}
          </div>

        </div>
      )}

      {/* 刪除確認彈窗 (防呆 In-App Modal) */}
      {deletingItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden space-y-4">
            <div className="bg-rose-50 p-5 border-b border-rose-100 flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-base text-slate-900">確認刪除此筆費用記錄？</h3>
                <p className="text-xs text-rose-700 mt-0.5">
                  即將從審批清單中刪除【{deletingItem.applicant}】之此筆報支記錄。
                </p>
              </div>
            </div>

            <div className="px-5 space-y-2 text-xs text-slate-600">
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-400">專案 / 科目：</span>
                  <span className="font-semibold text-slate-800">{deletingItem.projectName} ({deletingItem.categoryName})</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">說明摘要：</span>
                  <span className="font-medium text-slate-900">{deletingItem.description}</span>
                </div>
                <div className="flex justify-between pt-1 border-t border-slate-200">
                  <span className="text-slate-500 font-bold">金額：</span>
                  <span className="font-bold text-rose-600 font-mono text-sm">{formatMoney(deletingItem.amount)}</span>
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setDeletingItem(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => {
                  if (onDeleteExpense && deletingItem) {
                    onDeleteExpense(deletingItem.id);
                  }
                  setDeletingItem(null);
                }}
                className="px-5 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-md shadow-rose-500/20 transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="w-4 h-4" />
                <span>確認刪除</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 駁回原因彈窗 */}
      {rejectModalState.isOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 p-6 space-y-4 text-xs">
            <div className="flex items-center gap-2 text-rose-600">
              <ShieldAlert className="w-5 h-5" />
              <h3 className="font-bold text-base text-slate-900">駁回報銷申請單</h3>
            </div>

            <p className="text-slate-600">
              即將駁回【{rejectModalState.applicantName}】於 {rejectModalState.month} 月份之 <strong>{rejectModalState.targetIds.length}</strong> 筆單據。請填寫具體退件原因，以利同仁修正重新送審：
            </p>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">駁回理由說明</label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="例如：請補附發票照片、出差里程數計算有誤、未附同行名單等..."
                rows={3}
                className="w-full p-2.5 rounded-xl border border-slate-300 outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setRejectModalState({ isOpen: false, targetIds: [], applicantName: '', month: '' })}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-medium"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleConfirmReject}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold shadow-md shadow-rose-500/20"
              >
                確認退件駁回
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 憑證圖片放大檢視彈窗 */}
      {previewImage && (
        <div 
          className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setPreviewImage(null)}
        >
          <div className="relative max-w-2xl max-h-[90vh] bg-white rounded-2xl p-2 shadow-2xl overflow-hidden">
            <img 
              src={previewImage} 
              alt="發票收據憑證" 
              className="max-h-[80vh] w-auto object-contain rounded-xl"
            />
            <button
              onClick={() => setPreviewImage(null)}
              className="absolute top-4 right-4 bg-slate-900/80 text-white p-1.5 rounded-full hover:bg-slate-900"
            >
              ✕
            </button>
          </div>
        </div>
      )}

    </div>
  );
};
