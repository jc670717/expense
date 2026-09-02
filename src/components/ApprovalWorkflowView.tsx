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
  Trash2,
  Lock,
  ArrowRight,
  HelpCircle
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { ExpenseItem, ExpenseStatus, Project, Company, ExpenseCategory, UserProfile } from '../types';
import { exportToExcel, formatMoney } from '../utils/exportUtils';

interface ApprovalWorkflowViewProps {
  expenses: ExpenseItem[];
  currentUser: UserProfile;
  allUsers?: UserProfile[];
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
  department: string;
  companiesList: string[]; // 該人在該月報支涵蓋的所有公司清單
  totalAmount: number; // 合計總額 (含手續費)
  feeAmount: number; // 手續費總額
  expenseAmount: number; // 費用淨額
  
  // 三階段狀態金額統計
  deptPendingAmount: number; // 第一階段：待部門主管審核
  adminPendingAmount: number; // 第二階段：待最高管理審核
  disbursePendingAmount: number; // 第三階段：待行政管理部撥款
  paidAmount: number; // 已撥款完成
  rejectedAmount: number; // 已退件駁回

  totalCount: number;
  deptPendingCount: number;
  adminPendingCount: number;
  disbursePendingCount: number;
  paidCount: number;
  rejectedCount: number;

  items: ExpenseItem[];
  projectNames: string[];
  categoryNames: string[];
  hasReceiptIssue: boolean;
}

export const ApprovalWorkflowView: React.FC<ApprovalWorkflowViewProps> = ({
  expenses,
  currentUser,
  allUsers = [],
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
  const [statusFilter, setStatusFilter] = useState<
    'ALL' | 'dept_pending' | 'admin_pending' | 'disburse_pending' | 'all_paid' | 'has_rejected'
  >('ALL');
  
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

  // 審核權限判定：最高管理 (admin) 或 部門審核員 (auditor)
  const isHighestAdmin = currentUser.role === 'admin' || currentUser.position === 'admin';
  const isDeptAuditor = currentUser.role === 'auditor' || currentUser.position === 'auditor';
  const isAdminDeptStaff = currentUser.department?.includes('行政') || 
                          currentUser.department?.includes('管理') || 
                          currentUser.department?.includes('財務') || 
                          currentUser.department?.includes('出納');
  const isReviewer = isHighestAdmin || isDeptAuditor || isAdminDeptStaff;

  // 輔助函式：取得申請人的部門
  const getApplicantDept = (item: ExpenseItem): string => {
    if (item.applicantDepartment) return item.applicantDepartment;
    const matchUser = allUsers.find(u => u.name === item.applicant || u.englishName === item.applicant);
    return matchUser?.department || '未分配部門';
  };

  // 權限核心邏輯：判定當前登入者是否可以對某筆單據進行下一階段的簽核/撥款
  // 規則：審核狀態分3個，先由各部門部門管理審核，再最高管理審核，再由行政管理部部門管理撥款，依序審核，不同部門不得代審，但最高管理可以
  const checkCanApproveItem = (item: ExpenseItem): {
    canApprove: boolean;
    nextStatus: ExpenseStatus;
    actionLabel: string;
    reasonText: string;
  } => {
    const itemDept = getApplicantDept(item);
    const userDept = currentUser.department || '';

    // Stage 1: 待部門主管審核 (submitted)
    if (item.status === 'submitted') {
      if (isHighestAdmin) {
        return {
          canApprove: true,
          nextStatus: 'dept_approved',
          actionLabel: '部門核准',
          reasonText: '最高管理擁有全權跨部門審核權限',
        };
      }
      if (isDeptAuditor) {
        if (itemDept && userDept && itemDept === userDept) {
          return {
            canApprove: true,
            nextStatus: 'dept_approved',
            actionLabel: '部門核准',
            reasonText: `【${itemDept}】部門主管審核`,
          };
        } else {
          return {
            canApprove: false,
            nextStatus: 'dept_approved',
            actionLabel: '部門核准',
            reasonText: `跨部門不得代審（僅限【${itemDept}】主管或最高管理）`,
          };
        }
      }
      return {
        canApprove: false,
        nextStatus: 'dept_approved',
        actionLabel: '部門核准',
        reasonText: `僅限【${itemDept}】部門主管或最高管理審核`,
      };
    }

    // Stage 2: 部門已審核，待最高管理審核 (dept_approved)
    if (item.status === 'dept_approved') {
      if (isHighestAdmin) {
        return {
          canApprove: true,
          nextStatus: 'admin_approved',
          actionLabel: '最高核准',
          reasonText: '最高管理最終決行核准',
        };
      }
      return {
        canApprove: false,
        nextStatus: 'admin_approved',
        actionLabel: '最高核准',
        reasonText: '第二階段僅限最高管理核准決行（部門主管無權代核）',
      };
    }

    // Stage 3: 最高管理已審核，待行政管理部撥款 (admin_approved 或 舊版 approved)
    if (item.status === 'admin_approved' || item.status === 'approved') {
      if (isHighestAdmin || isAdminDeptStaff) {
        return {
          canApprove: true,
          nextStatus: 'paid',
          actionLabel: '行政撥款',
          reasonText: '行政管理部出納/主管執行撥款作業',
        };
      }
      return {
        canApprove: false,
        nextStatus: 'paid',
        actionLabel: '行政撥款',
        reasonText: '第三階段僅限行政管理部主管/出納或最高管理撥款',
      };
    }

    return {
      canApprove: false,
      nextStatus: 'submitted',
      actionLabel: '已結案',
      reasonText: '單據已結案或處於駁回狀態',
    };
  };

  // 1. 根據權限過濾資料 (一般使用者只能看自己申請的單據)
  const scopedExpenses = useMemo(() => {
    if (!isReviewer) {
      return expenses.filter(
        e => e.applicant.toLowerCase() === currentUser.name.toLowerCase() || 
            (currentUser.englishName && e.applicant.toLowerCase() === currentUser.englishName.toLowerCase())
      );
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
      const itemDept = getApplicantDept(item);

      const fee = Number(item.fee || 0);
      const amount = Number(item.amount || 0);
      const total = Number(item.totalAmount || (amount + fee));

      if (!groupMap.has(key)) {
        groupMap.set(key, {
          key,
          claimMonth: month,
          applicant,
          department: itemDept,
          companiesList: [],
          totalAmount: 0,
          feeAmount: 0,
          expenseAmount: 0,
          deptPendingAmount: 0,
          adminPendingAmount: 0,
          disbursePendingAmount: 0,
          paidAmount: 0,
          rejectedAmount: 0,
          totalCount: 0,
          deptPendingCount: 0,
          adminPendingCount: 0,
          disbursePendingCount: 0,
          paidCount: 0,
          rejectedCount: 0,
          items: [],
          projectNames: [],
          categoryNames: [],
          hasReceiptIssue: false,
        });
      }

      const grp = groupMap.get(key)!;
      grp.items.push(item);
      grp.totalCount += 1;
      grp.totalAmount += total;
      grp.feeAmount += fee;
      grp.expenseAmount += amount;

      const comp = item.companyName || '邦捷總公司';
      if (!grp.companiesList.includes(comp)) {
        grp.companiesList.push(comp);
      }

      // 依三階段統計
      if (item.status === 'submitted') {
        grp.deptPendingCount += 1;
        grp.deptPendingAmount += total;
      } else if (item.status === 'dept_approved') {
        grp.adminPendingCount += 1;
        grp.adminPendingAmount += total;
      } else if (item.status === 'admin_approved' || item.status === 'approved') {
        grp.disbursePendingCount += 1;
        grp.disbursePendingAmount += total;
      } else if (item.status === 'paid') {
        grp.paidCount += 1;
        grp.paidAmount += total;
      } else if (item.status === 'rejected') {
        grp.rejectedCount += 1;
        grp.rejectedAmount += total;
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

    // 轉換為陣列並依照「有待簽核者優先、月份新到舊、申請人」排序
    return Array.from(groupMap.values()).sort((a, b) => {
      const aPending = a.deptPendingCount + a.adminPendingCount + a.disbursePendingCount;
      const bPending = b.deptPendingCount + b.adminPendingCount + b.disbursePendingCount;
      if (aPending > 0 && bPending === 0) return -1;
      if (bPending > 0 && aPending === 0) return 1;
      if (a.claimMonth !== b.claimMonth) {
        return b.claimMonth.localeCompare(a.claimMonth);
      }
      return a.applicant.localeCompare(b.applicant);
    });
  }, [scopedExpenses, allUsers]);

  // 4. 套用使用者選擇的月份與搜尋條件
  const filteredGroups = useMemo(() => {
    return applicantGroups.filter(grp => {
      if (selectedMonth !== 'ALL' && grp.claimMonth !== selectedMonth) {
        return false;
      }
      if (searchApplicant.trim()) {
        const q = searchApplicant.toLowerCase();
        const matchApplicant = grp.applicant.toLowerCase().includes(q);
        const matchDept = grp.department.toLowerCase().includes(q);
        const matchCompany = grp.companiesList.some(c => c.toLowerCase().includes(q));
        const matchProjects = grp.projectNames.some(p => p.toLowerCase().includes(q));
        if (!matchApplicant && !matchDept && !matchCompany && !matchProjects) return false;
      }

      if (statusFilter === 'dept_pending' && grp.deptPendingCount === 0) return false;
      if (statusFilter === 'admin_pending' && grp.adminPendingCount === 0) return false;
      if (statusFilter === 'disburse_pending' && grp.disbursePendingCount === 0) return false;
      if (statusFilter === 'all_paid' && (grp.deptPendingCount > 0 || grp.adminPendingCount > 0 || grp.disbursePendingCount > 0 || grp.paidCount === 0)) return false;
      if (statusFilter === 'has_rejected' && grp.rejectedCount === 0) return false;

      return true;
    });
  }, [applicantGroups, selectedMonth, searchApplicant, statusFilter]);

  // 當前選中的明細群組物件
  const activeGroup = useMemo(() => {
    if (!activeGroupKey) return null;
    return applicantGroups.find(g => g.key === activeGroupKey) || null;
  }, [activeGroupKey, applicantGroups]);

  // 依公司分組的明細列表 (點進明細時依各公司群組並列)
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
      const companyTotal = items.reduce((s, i) => s + Number(i.totalAmount || (i.amount + (i.fee || 0))), 0);
      const companyDeptPending = items.filter(i => i.status === 'submitted').reduce((s, i) => s + Number(i.totalAmount || (i.amount + (i.fee || 0))), 0);
      const companyAdminPending = items.filter(i => i.status === 'dept_approved').reduce((s, i) => s + Number(i.totalAmount || (i.amount + (i.fee || 0))), 0);
      const companyDisbursePending = items.filter(i => i.status === 'admin_approved' || i.status === 'approved').reduce((s, i) => s + Number(i.totalAmount || (i.amount + (i.fee || 0))), 0);
      const companyPaid = items.filter(i => i.status === 'paid').reduce((s, i) => s + Number(i.totalAmount || (i.amount + (i.fee || 0))), 0);

      return {
        companyName,
        items,
        companyTotal,
        companyDeptPending,
        companyAdminPending,
        companyDisbursePending,
        companyPaid,
      };
    });
  }, [activeGroup]);

  // 全局總結數據
  const stats = useMemo(() => {
    let totalAmt = 0;
    let deptPendingAmt = 0;
    let adminPendingAmt = 0;
    let disbursePendingAmt = 0;
    let paidAmt = 0;
    let totalPendingItems = 0;

    filteredGroups.forEach(g => {
      totalAmt += g.totalAmount;
      deptPendingAmt += g.deptPendingAmount;
      adminPendingAmt += g.adminPendingAmount;
      disbursePendingAmt += g.disbursePendingAmount;
      paidAmt += g.paidAmount;
      totalPendingItems += (g.deptPendingCount + g.adminPendingCount + g.disbursePendingCount);
    });

    return { 
      totalAmt, 
      deptPendingAmt, 
      adminPendingAmt, 
      disbursePendingAmt, 
      paidAmt, 
      totalPendingItems,
      totalGroups: applicantGroups.length 
    };
  }, [filteredGroups, applicantGroups]);

  // 批次核准指定群組內所有當前使用者有權限簽核的單據
  const handleApproveEligibleInGroup = (grp: MonthlyApplicantGroup, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();

    // 找出所有當前使用者有權限進行下一步的單據
    const eligibleItems = grp.items.filter(item => {
      const check = checkCanApproveItem(item);
      return check.canApprove;
    });

    if (eligibleItems.length === 0) {
      alert(`您在【${grp.applicant}】目前的申請單中無符合審核權限之單據（例如：跨部門單據不得代審，或需由上一階段主管先審核完成）。`);
      return;
    }

    // 分組統計各狀態要轉換的目標
    const byNextStatus = new Map<ExpenseStatus, string[]>();
    eligibleItems.forEach(item => {
      const check = checkCanApproveItem(item);
      if (!byNextStatus.has(check.nextStatus)) {
        byNextStatus.set(check.nextStatus, []);
      }
      byNextStatus.get(check.nextStatus)!.push(item.id);
    });

    const sumEligibleAmt = eligibleItems.reduce((s, i) => s + Number(i.totalAmount || (i.amount + (i.fee || 0))), 0);

    if (window.confirm(`確定要批次簽核【${grp.applicant}】於 ${grp.claimMonth} 月份符合權限之 ${eligibleItems.length} 筆單據（合計 ${formatMoney(sumEligibleAmt)}）嗎？`)) {
      byNextStatus.forEach((ids, targetStatus) => {
        onBatchStatusChange(ids, targetStatus);
      });
      try {
        confetti({ particleCount: 70, spread: 60, origin: { y: 0.6 } });
      } catch (err) {}
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

  // 批次推進已選中單據
  const handleApproveSelectedDetails = () => {
    if (selectedItemIds.length === 0) return;
    if (!activeGroup) return;

    const selectedItems = activeGroup.items.filter(i => selectedItemIds.includes(i.id));
    const eligibleItems = selectedItems.filter(i => checkCanApproveItem(i).canApprove);

    if (eligibleItems.length === 0) {
      alert('所選單據中無符合您當前審核/撥款權限之項目（不同部門不得代審，或需待上一審核人完成）。');
      return;
    }

    const byNextStatus = new Map<ExpenseStatus, string[]>();
    eligibleItems.forEach(item => {
      const check = checkCanApproveItem(item);
      if (!byNextStatus.has(check.nextStatus)) {
        byNextStatus.set(check.nextStatus, []);
      }
      byNextStatus.get(check.nextStatus)!.push(item.id);
    });

    byNextStatus.forEach((ids, targetStatus) => {
      onBatchStatusChange(ids, targetStatus);
    });

    setSelectedItemIds([]);
  };

  // 匯出個人月度報支清單為 Excel
  const handleExportGroupExcel = (grp: MonthlyApplicantGroup) => {
    const filename = `${grp.claimMonth}_${grp.applicant}_各公司費用報支簽核清單.xlsx`;
    exportToExcel(grp.items, filename);
  };

  // 渲染審核狀態 Stepper 標籤
  const renderStatusStepper = (item: ExpenseItem) => {
    if (item.status === 'rejected') {
      return (
        <div className="space-y-0.5">
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200 inline-flex items-center gap-1">
            <XCircle className="w-3 h-3 text-rose-600" />
            已退件駁回
          </span>
          {item.rejectedReason && (
            <div className="text-[10px] text-rose-600 truncate max-w-[160px]" title={item.rejectedReason}>
              原因：{item.rejectedReason}
            </div>
          )}
        </div>
      );
    }

    return (
      <div className="flex items-center justify-center gap-1 text-[10px] font-medium">
        {/* Step 1: 部門審核 */}
        <span 
          className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
            item.status === 'submitted'
              ? 'bg-amber-100 text-amber-800 border border-amber-300 animate-pulse'
              : item.deptApprover || item.status === 'dept_approved' || item.status === 'admin_approved' || item.status === 'approved' || item.status === 'paid'
              ? 'bg-emerald-100 text-emerald-800'
              : 'bg-slate-100 text-slate-400'
          }`}
          title={item.deptApprover ? `部門主管【${item.deptApprover}】已審核 (${item.deptApprovedAt || ''})` : '第一階段：待部門主管審核'}
        >
          1.部門
        </span>
        <span className="text-slate-300 text-[8px]">→</span>

        {/* Step 2: 最高管理 */}
        <span 
          className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
            item.status === 'dept_approved'
              ? 'bg-blue-100 text-blue-800 border border-blue-300 animate-pulse'
              : item.adminApprover || item.status === 'admin_approved' || item.status === 'approved' || item.status === 'paid'
              ? 'bg-emerald-100 text-emerald-800'
              : 'bg-slate-100 text-slate-400'
          }`}
          title={item.adminApprover ? `最高管理【${item.adminApprover}】已核准 (${item.adminApprovedAt || ''})` : '第二階段：待最高管理審核'}
        >
          2.最高
        </span>
        <span className="text-slate-300 text-[8px]">→</span>

        {/* Step 3: 行政撥款 */}
        <span 
          className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
            item.status === 'admin_approved' || item.status === 'approved'
              ? 'bg-indigo-100 text-indigo-800 border border-indigo-300 animate-pulse'
              : item.status === 'paid'
              ? 'bg-emerald-500 text-white font-black'
              : 'bg-slate-100 text-slate-400'
          }`}
          title={item.disbursedBy ? `行政出納【${item.disbursedBy}】已撥款 (${item.disbursedAt || ''})` : '第三階段：待行政管理部撥款'}
        >
          3.撥款
        </span>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      
      {/* 頂部橫幅 */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-900 rounded-2xl p-6 text-white shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-500/30 text-indigo-200 border border-indigo-400/30">
              三階段審批簽核中心 (3-Tier Sequential Approval Workflow)
            </span>
            <span className="text-xs text-slate-300">
              {isReviewer ? '各部門審核 → 最高管理審核 → 行政管理部撥款' : '個人月度報銷進度追蹤'}
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <CheckSquare className="w-6 h-6 text-indigo-400" />
            公務費用報銷審批與三階簽核撥款
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl">
            依序嚴格流轉：先由各部門主管審核（跨部門不得代審，最高管理可代審），再由最高管理核准，最後由行政管理部執行撥款出帳。
          </p>
        </div>

        {/* 快速統計數據條 */}
        <div className="flex items-center gap-3 shrink-0 bg-white/10 backdrop-blur-md px-4 py-3 rounded-xl border border-white/10">
          <div className="text-center px-2">
            <div className="text-[10px] text-slate-300 font-medium uppercase">簽核中總額</div>
            <div className="text-lg font-black font-mono text-amber-300">
              {formatMoney(stats.deptPendingAmt + stats.adminPendingAmt + stats.disbursePendingAmt)}
            </div>
          </div>
          <div className="h-7 w-px bg-white/20" />
          <div className="text-center px-2">
            <div className="text-[10px] text-slate-300 font-medium uppercase">待簽單據</div>
            <div className="text-lg font-black font-mono text-white">{stats.totalPendingItems} 筆</div>
          </div>
        </div>
      </div>

      {/* 頂部四項指標卡片 (呈現三階段進度) */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          
          {/* 1. 待部門主管審核 */}
          <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-xl">
            <div className="text-[11px] font-bold text-amber-700 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              1. 待部門主管審核
            </div>
            <div className="text-lg sm:text-xl font-bold font-mono text-amber-900 mt-0.5">
              {formatMoney(stats.deptPendingAmt)}
            </div>
            <div className="text-[10px] text-amber-700/80 mt-1 font-medium">
              各部門主管獨立複核 (不得代審)
            </div>
          </div>

          {/* 2. 待最高管理審核 */}
          <div className="p-3 bg-blue-50/80 border border-blue-200 rounded-xl">
            <div className="text-[11px] font-bold text-blue-700 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" />
              2. 待最高管理審核
            </div>
            <div className="text-lg sm:text-xl font-bold font-mono text-blue-900 mt-0.5">
              {formatMoney(stats.adminPendingAmt)}
            </div>
            <div className="text-[10px] text-blue-600 mt-1">
              總經理/最高管理最終核定
            </div>
          </div>

          {/* 3. 待行政管理部撥款 */}
          <div className="p-3 bg-indigo-50/80 border border-indigo-200 rounded-xl">
            <div className="text-[11px] font-bold text-indigo-700 flex items-center gap-1">
              <DollarSign className="w-3 h-3" />
              3. 待行政管理部撥款
            </div>
            <div className="text-lg sm:text-xl font-bold font-mono text-indigo-900 mt-0.5">
              {formatMoney(stats.disbursePendingAmt)}
            </div>
            <div className="text-[10px] text-indigo-600 mt-1">
              行政管理部出納匯款撥付
            </div>
          </div>

          {/* 4. 已結案撥款總額 */}
          <div className="p-3 bg-emerald-50/80 border border-emerald-200 rounded-xl">
            <div className="text-[11px] font-bold text-emerald-700 flex items-center gap-1">
              <Check className="w-3 h-3 text-emerald-600" />
              已撥款結案總額
            </div>
            <div className="text-lg sm:text-xl font-bold font-mono text-emerald-900 mt-0.5">
              {formatMoney(stats.paidAmt)}
            </div>
            <div className="text-[10px] text-emerald-700 mt-1">
              款項均已入同仁帳戶
            </div>
          </div>

        </div>
      </div>

      {/* ======================================================== */}
      {/* 第一層：月度申請人群組總覽列表 (Grouping by Month & Person) */}
      {/* ======================================================== */}
      {!activeGroupKey ? (
        <div className="space-y-4">
          
          {/* 篩選與搜尋工具列 */}
          <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3">
            
            {/* 左側：月份選擇與申請人搜尋 */}
            <div className="flex items-center gap-2.5 flex-wrap flex-1">
              <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
                <Calendar className="w-4 h-4 text-slate-400" />
                <span className="text-xs font-bold text-slate-600">請款月份：</span>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="bg-transparent text-xs font-mono font-bold text-slate-800 outline-none cursor-pointer"
                >
                  <option value="ALL">全部月份 ({availableMonths.length} 個月)</option>
                  {availableMonths.map(m => (
                    <option key={m} value={m}>{m} 月份</option>
                  ))}
                </select>
              </div>

              <div className="relative flex-1 min-w-[200px] max-w-sm">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchApplicant}
                  onChange={(e) => setSearchApplicant(e.target.value)}
                  placeholder="搜尋申請人、所屬部門、專案名稱或公司..."
                  className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                >
                </input>
              </div>
            </div>

            {/* 右側：狀態篩選切換 Tabs */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs shrink-0 flex-wrap">
              <button
                onClick={() => setStatusFilter('ALL')}
                className={`px-2.5 py-1 rounded-md font-bold transition-all cursor-pointer ${
                  statusFilter === 'ALL' ? 'bg-white text-indigo-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                全部 ({applicantGroups.length})
              </button>
              <button
                onClick={() => setStatusFilter('dept_pending')}
                className={`px-2.5 py-1 rounded-md font-bold transition-all flex items-center gap-1 cursor-pointer ${
                  statusFilter === 'dept_pending' ? 'bg-amber-500 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-amber-300" />
                待部門審核
              </button>
              <button
                onClick={() => setStatusFilter('admin_pending')}
                className={`px-2.5 py-1 rounded-md font-bold transition-all cursor-pointer ${
                  statusFilter === 'admin_pending' ? 'bg-blue-600 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                待最高管理
              </button>
              <button
                onClick={() => setStatusFilter('disburse_pending')}
                className={`px-2.5 py-1 rounded-md font-bold transition-all cursor-pointer ${
                  statusFilter === 'disburse_pending' ? 'bg-indigo-600 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                待行政撥款
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
                const hasDeptPending = grp.deptPendingCount > 0;
                const hasAdminPending = grp.adminPendingCount > 0;
                const hasDisbursePending = grp.disbursePendingCount > 0;
                const isFullyPaid = grp.deptPendingCount === 0 && grp.adminPendingCount === 0 && grp.disbursePendingCount === 0 && grp.paidCount > 0;

                return (
                  <div
                    key={grp.key}
                    onClick={() => setActiveGroupKey(grp.key)}
                    className={`bg-white rounded-2xl border transition-all duration-200 cursor-pointer overflow-hidden flex flex-col justify-between hover:shadow-md hover:-translate-y-0.5 ${
                      hasDeptPending
                        ? 'border-amber-300 hover:border-amber-400 ring-1 ring-amber-200/60'
                        : hasAdminPending
                        ? 'border-blue-300 hover:border-blue-400 ring-1 ring-blue-200/60'
                        : hasDisbursePending
                        ? 'border-indigo-300 hover:border-indigo-400 ring-1 ring-indigo-200/60'
                        : isFullyPaid
                        ? 'border-emerald-200 hover:border-emerald-300'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    {/* 卡片頂部：月份、申請人與部門 */}
                    <div className="p-4 border-b border-slate-100 bg-gradient-to-b from-slate-50/50 to-transparent">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">
                          {grp.claimMonth} 月份
                        </span>
                        
                        {/* 狀態 Badge */}
                        {hasDeptPending ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300 flex items-center gap-1 animate-pulse">
                            <Clock className="w-3 h-3" />
                            {grp.deptPendingCount} 筆待部門審核
                          </span>
                        ) : hasAdminPending ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-300 flex items-center gap-1 animate-pulse">
                            <CheckCircle2 className="w-3 h-3" />
                            {grp.adminPendingCount} 筆待最高管理
                          </span>
                        ) : hasDisbursePending ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-300 flex items-center gap-1 animate-pulse">
                            <DollarSign className="w-3 h-3" />
                            {grp.disbursePendingCount} 筆待行政撥款
                          </span>
                        ) : isFullyPaid ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                            <Check className="w-3 h-3" />
                            已結案撥款 ({grp.paidCount} 筆)
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
                          <div className="flex items-center gap-1.5">
                            <h3 className="font-bold text-base text-slate-900 truncate">
                              {grp.applicant}
                            </h3>
                            <span className="text-[11px] px-1.5 py-0.2 rounded bg-indigo-50 text-indigo-700 font-bold border border-indigo-200 shrink-0">
                              {grp.department}
                            </span>
                          </div>
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

                    {/* 卡片主體：該月總金額 (含手續費) 與細項分佈 */}
                    <div className="p-4 space-y-3">
                      <div>
                        <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                          <span>該月申請合計 (含手續費)</span>
                          {grp.feeAmount > 0 && (
                            <span className="text-[10px] text-indigo-600 font-medium font-sans">
                              (含手續費 {formatMoney(grp.feeAmount)})
                            </span>
                          )}
                        </div>
                        <div className="text-2xl font-bold font-mono text-slate-900 mt-0.5 tracking-tight flex items-baseline gap-1">
                          <span>{formatMoney(grp.totalAmount)}</span>
                          <span className="text-xs font-normal text-slate-400 font-sans">TWD</span>
                        </div>
                      </div>

                      {/* 三階段金額分佈小標記 */}
                      <div className="grid grid-cols-3 gap-1.5 bg-slate-50 p-2 rounded-xl text-[11px]">
                        <div className="text-center p-1 rounded bg-white border border-slate-200/60">
                          <div className="text-[9px] text-slate-400 font-medium">1.待部門</div>
                          <div className={`font-bold font-mono ${grp.deptPendingCount > 0 ? 'text-amber-700' : 'text-slate-400'}`}>
                            {formatMoney(grp.deptPendingAmount)}
                          </div>
                        </div>
                        <div className="text-center p-1 rounded bg-white border border-slate-200/60">
                          <div className="text-[9px] text-slate-400 font-medium">2.待最高</div>
                          <div className={`font-bold font-mono ${grp.adminPendingCount > 0 ? 'text-blue-700' : 'text-slate-400'}`}>
                            {formatMoney(grp.adminPendingAmount)}
                          </div>
                        </div>
                        <div className="text-center p-1 rounded bg-white border border-slate-200/60">
                          <div className="text-[9px] text-slate-400 font-medium">3.待撥款</div>
                          <div className={`font-bold font-mono ${grp.disbursePendingCount > 0 ? 'text-indigo-700' : 'text-slate-400'}`}>
                            {formatMoney(grp.disbursePendingAmount)}
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
                        <span>進入明細簽核</span>
                        <ChevronRight className="w-4 h-4" />
                      </div>

                      {/* 快捷簽核按鈕 */}
                      {isReviewer && (hasDeptPending || hasAdminPending || hasDisbursePending) && (
                        <button
                          onClick={(e) => handleApproveEligibleInGroup(grp, e)}
                          className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-2xs transition-colors flex items-center gap-1 shrink-0 cursor-pointer"
                          title="批次簽核您有權限核准的項目"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>一鍵簽核</span>
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
                <h3 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2">
                  【{activeGroup.applicant}】費用報支審批明細表
                  <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-bold border border-indigo-200">
                    所屬部門：{activeGroup.department}
                  </span>
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
                  該月申請合計 (含手續費)
                </div>
                <div className="text-xl font-bold font-mono text-indigo-600">
                  {formatMoney(activeGroup.totalAmount)}
                </div>
              </div>
              <div className="h-8 w-px bg-slate-200" />
              <div>
                <div className="text-[10px] text-slate-400 font-bold">手續費合計</div>
                <div className="text-sm font-bold font-mono text-slate-700">
                  {formatMoney(activeGroup.feeAmount)}
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
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-2xs transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    簽核已選 ({selectedItemIds.length} 筆)
                  </button>

                  <button
                    onClick={(e) => handleOpenRejectModal(selectedItemIds, activeGroup.applicant, activeGroup.claimMonth, e)}
                    className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold shadow-2xs transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    駁回已選
                  </button>
                </>
              )}
            </div>

            <div className="flex items-center gap-2">
              {/* 一鍵全額核准該人該月全部待審 */}
              {isReviewer && (
                <button
                  onClick={(e) => handleApproveEligibleInGroup(activeGroup, e)}
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>批次簽核本月權限內待審項目</span>
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
                      公司合計 (含手續費)：<strong className="text-emerald-400 font-mono font-bold">{formatMoney(compGroup.companyTotal)}</strong>
                    </div>
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
                        <th className="p-3 w-36">專案名稱</th>
                        <th className="p-3 w-28">會計科目</th>
                        <th className="p-3 min-w-[180px]">費用說明 / 摘要</th>
                        <th className="p-3 w-24 text-center">發票 / 憑證</th>
                        <th className="p-3 w-20 text-right">外幣原額</th>
                        <th className="p-3 w-24 text-right">費用金額</th>
                        <th className="p-3 w-20 text-right">手續費</th>
                        <th className="p-3 w-28 text-right">合計金額</th>
                        <th className="p-3 w-40 text-center">三階簽核進度</th>
                        <th className="p-3 w-32 text-center">審批動作</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-800">
                      {compGroup.items.map((item, index) => {
                        const isSelected = selectedItemIds.includes(item.id);
                        const numFee = Number(item.fee || 0);
                        const numAmount = Number(item.amount || 0);
                        const numTotal = Number(item.totalAmount || (numAmount + numFee));
                        const check = checkCanApproveItem(item);

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
                              <span className="font-semibold text-slate-800 block truncate max-w-[140px]" title={item.projectName}>
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
                                <div className="text-[11px] text-slate-400 truncate max-w-[200px]" title={item.remark}>
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
                                  className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-200 hover:bg-indigo-200 transition-colors flex items-center justify-center gap-1 mx-auto cursor-pointer"
                                >
                                  <ImageIcon className="w-3 h-3" />
                                  憑證
                                </button>
                              ) : (
                                <span className="text-[11px] text-slate-500 font-mono">
                                  {item.invoiceNo || '已附'}
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
                            <td className="p-3 text-right font-mono font-medium text-slate-800 whitespace-nowrap">
                              {formatMoney(numAmount)}
                            </td>

                            {/* 手續費 (TWD) */}
                            <td className="p-3 text-right font-mono text-slate-500 whitespace-nowrap">
                              {numFee > 0 ? (
                                <span className="text-amber-700 font-semibold">{formatMoney(numFee)}</span>
                              ) : (
                                'NT$ 0'
                              )}
                            </td>

                            {/* 合計金額 (TWD) */}
                            <td className="p-3 text-right font-mono font-bold text-indigo-900 whitespace-nowrap text-sm">
                              {formatMoney(numTotal)}
                            </td>

                            {/* 三階簽核進度 */}
                            <td className="p-3 text-center whitespace-nowrap">
                              {renderStatusStepper(item)}
                            </td>

                            {/* 審批動作按鈕 */}
                            <td className="p-3 text-center whitespace-nowrap">
                              <div className="flex items-center justify-center gap-1.5">
                                
                                {/* 審核推進按鈕 (核准/撥款) */}
                                {isReviewer && item.status !== 'paid' && item.status !== 'rejected' && (
                                  <>
                                    {check.canApprove ? (
                                      <button
                                        onClick={() => onStatusChange(item.id, check.nextStatus)}
                                        className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-[11px] font-bold shadow-2xs transition-colors flex items-center gap-0.5 cursor-pointer"
                                        title={`執行【${check.actionLabel}】：${check.reasonText}`}
                                      >
                                        <Check className="w-3 h-3" />
                                        <span>{check.actionLabel}</span>
                                      </button>
                                    ) : (
                                      <span 
                                        className="px-2 py-1 bg-slate-100 text-slate-400 rounded-md text-[10px] font-medium flex items-center gap-1 border border-slate-200 cursor-not-allowed"
                                        title={check.reasonText}
                                      >
                                        <Lock className="w-2.5 h-2.5" />
                                        <span>待審</span>
                                      </span>
                                    )}

                                    {/* 駁回按鈕 */}
                                    <button
                                      onClick={(e) => handleOpenRejectModal([item.id], activeGroup.applicant, activeGroup.claimMonth, e)}
                                      className="p-1 text-rose-600 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                                      title="退件駁回"
                                    >
                                      <XCircle className="w-4 h-4" />
                                    </button>
                                  </>
                                )}

                                {item.status === 'paid' && (
                                  <span className="text-[10px] text-emerald-700 font-bold px-2 py-0.5 rounded bg-emerald-50 border border-emerald-200 flex items-center gap-0.5">
                                    <Check className="w-3 h-3" />
                                    已撥款
                                  </span>
                                )}

                                {/* 刪除按鈕 (支援管理員或申請人刪除有誤單據) */}
                                {onDeleteExpense && (currentUser.role === 'admin' || (item.status !== 'admin_approved' && item.status !== 'paid')) && (
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
                  <span className="text-slate-500 font-bold">合計金額：</span>
                  <span className="font-bold text-rose-600 font-mono text-sm">
                    {formatMoney(deletingItem.totalAmount || (deletingItem.amount + (deletingItem.fee || 0)))}
                  </span>
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
              <h3 className="font-bold text-base text-slate-900">退件駁回報銷單</h3>
            </div>

            <p className="text-slate-600">
              即將駁回【{rejectModalState.applicantName}】於 {rejectModalState.month} 月份之 <strong>{rejectModalState.targetIds.length}</strong> 筆單據。請填寫具體退件原因，同仁於修改儲存後系統將自動重新送審：
            </p>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">駁回理由說明 (必填)</label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="例如：請補附發票憑證、專案科目選填有誤、出差手續費需附明細等..."
                rows={3}
                className="w-full p-2.5 rounded-xl border border-slate-300 outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setRejectModalState({ isOpen: false, targetIds: [], applicantName: '', month: '' })}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-medium cursor-pointer"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleConfirmReject}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold shadow-md shadow-rose-500/20 cursor-pointer"
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
              className="absolute top-4 right-4 bg-slate-900/80 text-white p-1.5 rounded-full hover:bg-slate-900 cursor-pointer"
            >
              ✕
            </button>
          </div>
        </div>
      )}

    </div>
  );
};
