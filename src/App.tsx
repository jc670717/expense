import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { Navigation } from './components/Navigation';
import { DashboardView } from './components/DashboardView';
import { ExpenseListView } from './components/ExpenseListView';
import { ExpenseFormModal } from './components/ExpenseFormModal';
import { ReceiptScannerView } from './components/ReceiptScannerView';
import { RecurringExpensesView } from './components/RecurringExpensesView';
import { ApprovalWorkflowView } from './components/ApprovalWorkflowView';
import { ProjectBudgetView } from './components/ProjectBudgetView';
import { ReportsExportView } from './components/ReportsExportView';
import { MasterDataView } from './components/MasterDataView';
import { AuditBackupView } from './components/AuditBackupView';
import { LoginScreen } from './components/LoginScreen';
import { ChangePasswordModal } from './components/ChangePasswordModal';
import { SavingLoadingOverlay, SavingStatus } from './components/SavingLoadingOverlay';

import { 
  AuditLog, 
  Company, 
  CurrencyRate, 
  ExpenseCategory, 
  ExpenseItem, 
  ExpenseStatus, 
  NotificationItem, 
  Project, 
  RecurringExpenseTemplate, 
  UserProfile 
} from './types';
import { 
  INITIAL_AUDIT_LOGS, 
  INITIAL_CATEGORIES, 
  INITIAL_COMPANIES, 
  INITIAL_CURRENCIES, 
  INITIAL_NOTIFICATIONS, 
  INITIAL_PROJECTS, 
  INITIAL_RECURRING_TEMPLATES, 
  INITIAL_USERS 
} from './data/initialData';
import { INITIAL_EXPENSES } from './data/initialExpenses';
import { 
  checkDbHealth, 
  fetchRemoteData, 
  pushAllDataToRemote, 
  syncSaveExpenseRemote, 
  syncDeleteExpenseRemote, 
  syncBatchDeleteExpensesRemote, 
  syncUpdateExpenseStatusRemote, 
  syncBatchUpdateExpenseStatusRemote,
  syncSaveUserRemote,
  syncDeleteUserRemote,
  syncSaveProjectRemote,
  syncDeleteProjectRemote,
  syncSaveCompanyRemote,
  syncSaveCategoryRemote,
  syncSaveAuditLogRemote,
  syncSaveCurrencyRemote,
  syncDeleteCurrencyRemote,
  syncSaveRecurringTemplateRemote,
  syncDeleteRecurringTemplateRemote,
  fetchLiveExchangeRates
} from './services/api';

export default function App() {
  // 0. 雲端資料庫連線狀態 (Neon PostgreSQL)
  const [dbStatus, setDbStatus] = useState<{ dbConnected: boolean; message?: string; driver?: string }>({
    dbConnected: false
  });
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  // 雲端即時寫入過場與防抖狀態 (避免背景同步覆蓋剛修改的資料)
  const [savingStatus, setSavingStatus] = useState<SavingStatus>({
    isSaving: false,
    message: '',
    isSuccess: false,
    isError: false,
  });
  const lastMutationTimeRef = useRef<number>(0);

  // 封裝安全儲存過場 (寫入雲端並提供 Loading 反饋，防止 Race Condition 與輪詢覆蓋)
  const triggerSaveWithFeedback = async (
    msg: string,
    action: () => Promise<void> | void
  ) => {
    lastMutationTimeRef.current = Date.now();
    setSavingStatus({
      isSaving: true,
      message: msg,
      isSuccess: false,
      isError: false,
    });

    try {
      await action();
      lastMutationTimeRef.current = Date.now();
      setSavingStatus({
        isSaving: false,
        message: '資料已成功寫入雲端 PostgreSQL 並鎖定最新狀態！',
        isSuccess: true,
        isError: false,
      });
      setTimeout(() => {
        setSavingStatus(prev => prev.isSuccess ? { ...prev, isSuccess: false } : prev);
      }, 2000);
    } catch (err) {
      console.error('Remote sync error:', err);
      lastMutationTimeRef.current = Date.now();
      setSavingStatus({
        isSaving: false,
        message: '已安全暫存至本機快取，連線恢復時將自動推送至雲端。',
        isSuccess: false,
        isError: true,
      });
      setTimeout(() => {
        setSavingStatus(prev => prev.isError ? { ...prev, isError: false } : prev);
      }, 3000);
    }
  };

  // 0.1 雲端資料庫初始化檢測與雙向同步 (Neon PostgreSQL) - 具備 Mutation Guard 防抖保護
  const syncWithRemoteDb = async (silent = false) => {
    // 若距離上次寫入小於 25 秒（Mutation Guard 保護視窗），或目前正在寫入儲存中，跳過背景輪詢，防止覆蓋使用者的最新輸入與重新送審！
    if (silent && (Date.now() - lastMutationTimeRef.current < 25000 || savingStatus.isSaving)) {
      return;
    }

    try {
      const health = await checkDbHealth();
      setDbStatus(health);

      if (health.dbConnected) {
        if (!silent) setIsSyncing(true);
        const res = await fetchRemoteData();
        // 再次檢查是否在 fetch 等待期間剛好發生了寫入操作
        if (silent && Date.now() - lastMutationTimeRef.current < 25000) {
          return;
        }

        if (res.dbConnected && res.data) {
          // 若後端資料庫連線成功，則以資料庫最新狀態同步 (包含空陣列)
          if (Array.isArray(res.data.expenses)) {
            setExpenses(res.data.expenses);
            localStorage.setItem('EXPENSE_APP_EXPENSES', JSON.stringify(res.data.expenses));
          }
          if (res.data.users && res.data.users.length > 0) {
            setUsers(res.data.users);
            localStorage.setItem('EXPENSE_APP_USERS', JSON.stringify(res.data.users));
          }
          if (res.data.projects && res.data.projects.length > 0) {
            setProjects(res.data.projects);
            localStorage.setItem('EXPENSE_APP_PROJECTS', JSON.stringify(res.data.projects));
          }
          if (res.data.categories && res.data.categories.length > 0) {
            setCategories(res.data.categories);
            localStorage.setItem('EXPENSE_APP_CATEGORIES', JSON.stringify(res.data.categories));
          }
          if (res.data.companies && res.data.companies.length > 0) {
            setCompanies(res.data.companies);
            localStorage.setItem('EXPENSE_APP_COMPANIES', JSON.stringify(res.data.companies));
          }
          if (res.data.auditLogs && res.data.auditLogs.length > 0) {
            setAuditLogs(res.data.auditLogs);
            localStorage.setItem('EXPENSE_APP_AUDIT_LOGS', JSON.stringify(res.data.auditLogs));
          }
        }
      }
    } catch (e) {
      console.warn('Sync error:', e);
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    syncWithRemoteDb();
    // 每 15 秒背景檢查一次雲端資料庫狀態與多人異動
    const timer = setInterval(() => {
      syncWithRemoteDb(true);
    }, 15000);
    return () => clearInterval(timer);
  }, []);

  // 手動推送全量資料至雲端資料庫
  const handlePushAllToCloudDb = async () => {
    setIsSyncing(true);
    const success = await pushAllDataToRemote({
      expenses,
      users,
      projects,
      categories,
      companies,
      auditLogs
    });
    setIsSyncing(false);
    if (success) {
      addAuditLog('系統資料', '雲端同步', '已手動將所有單據、專案、科目資料推送至 Neon PostgreSQL 雲端資料庫');
      await syncWithRemoteDb();
      alert('已成功將本地所有報支單據與設定同步至 Neon PostgreSQL 資料庫！');
    } else {
      alert('同步失敗，請確認伺服器 DATABASE_URL 設定是否正確。');
    }
  };

  const handlePullFromCloudDb = async () => {
    setIsSyncing(true);
    await syncWithRemoteDb(false);
    setIsSyncing(false);
  };

  // 1. 本地狀態與持久化
  const [expenses, setExpenses] = useState<ExpenseItem[]>(() => {
    const saved = localStorage.getItem('EXPENSE_APP_EXPENSES');
    if (!saved) return INITIAL_EXPENSES;
    try {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        const valid = parsed.filter(item => item && typeof item === 'object' && typeof item.id === 'string' && typeof item.description === 'string');
        return valid.length > 0 ? valid : INITIAL_EXPENSES;
      }
      return INITIAL_EXPENSES;
    } catch {
      return INITIAL_EXPENSES;
    }
  });

  const [projects, setProjects] = useState<Project[]>(() => {
    const saved = localStorage.getItem('EXPENSE_APP_PROJECTS');
    if (!saved) return INITIAL_PROJECTS;
    try {
      const parsed = JSON.parse(saved);
      return Array.isArray(parsed) && parsed.length > 0 ? parsed : INITIAL_PROJECTS;
    } catch {
      return INITIAL_PROJECTS;
    }
  });

  const [categories, setCategories] = useState<ExpenseCategory[]>(() => {
    const saved = localStorage.getItem('EXPENSE_APP_CATEGORIES');
    if (!saved) return INITIAL_CATEGORIES;
    try {
      const parsed = JSON.parse(saved);
      return Array.isArray(parsed) && parsed.length > 0 ? parsed : INITIAL_CATEGORIES;
    } catch {
      return INITIAL_CATEGORIES;
    }
  });

  const [companies, setCompanies] = useState<Company[]>(() => {
    const saved = localStorage.getItem('EXPENSE_APP_COMPANIES');
    if (!saved) return INITIAL_COMPANIES;
    try {
      const parsed = JSON.parse(saved);
      return Array.isArray(parsed) && parsed.length > 0 ? parsed : INITIAL_COMPANIES;
    } catch {
      return INITIAL_COMPANIES;
    }
  });

  const [users, setUsers] = useState<UserProfile[]>(() => {
    const saved = localStorage.getItem('EXPENSE_APP_USERS');
    if (!saved) return INITIAL_USERS;
    try {
      const parsed: UserProfile[] = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
      return INITIAL_USERS;
    } catch {
      return INITIAL_USERS;
    }
  });

  const [currencies, setCurrencies] = useState<CurrencyRate[]>(() => {
    const saved = localStorage.getItem('EXPENSE_APP_CURRENCIES');
    if (!saved) return INITIAL_CURRENCIES;
    try {
      const parsed = JSON.parse(saved);
      return Array.isArray(parsed) && parsed.length > 0 ? parsed : INITIAL_CURRENCIES;
    } catch {
      return INITIAL_CURRENCIES;
    }
  });

  const [recurringTemplates, setRecurringTemplates] = useState<RecurringExpenseTemplate[]>(() => {
    const saved = localStorage.getItem('EXPENSE_APP_RECURRING');
    if (!saved) return INITIAL_RECURRING_TEMPLATES;
    try {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        const valid = parsed.filter(t => t && typeof t === 'object' && typeof t.id === 'string');
        return valid.length > 0 ? valid : INITIAL_RECURRING_TEMPLATES;
      }
      return INITIAL_RECURRING_TEMPLATES;
    } catch {
      return INITIAL_RECURRING_TEMPLATES;
    }
  });

  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(() => {
    const saved = localStorage.getItem('EXPENSE_APP_AUDIT');
    return saved ? JSON.parse(saved) : INITIAL_AUDIT_LOGS;
  });

  const [notifications, setNotifications] = useState<NotificationItem[]>(() => {
    const saved = localStorage.getItem('EXPENSE_APP_NOTIFICATIONS');
    return saved ? JSON.parse(saved) : INITIAL_NOTIFICATIONS;
  });

  // 登入狀態管理
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(() => {
    const saved = localStorage.getItem('EXPENSE_APP_IS_LOGGED_IN');
    return saved === 'true';
  });

  // 當前登入的使用者
  const [currentUser, setCurrentUser] = useState<UserProfile>(() => {
    const saved = localStorage.getItem('EXPENSE_APP_CURRENT_USER');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object' && parsed.id) {
          return parsed;
        }
        return INITIAL_USERS[0];
      } catch {
        return INITIAL_USERS[0];
      }
    }
    return INITIAL_USERS[0];
  });

  // 當前選中的 Tab
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState<boolean>(false);
  const [selectedCurrency, setSelectedCurrency] = useState<string>('TWD');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // 費用新增/編輯彈窗狀態
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState<boolean>(false);
  const [editingExpense, setEditingExpense] = useState<ExpenseItem | null>(null);
  const [isChangePasswordModalOpen, setIsChangePasswordModalOpen] = useState<boolean>(false);

  // 儲存至 localStorage
  useEffect(() => {
    localStorage.setItem('EXPENSE_APP_EXPENSES', JSON.stringify(expenses));
  }, [expenses]);

  useEffect(() => {
    localStorage.setItem('EXPENSE_APP_PROJECTS', JSON.stringify(projects));
  }, [projects]);

  useEffect(() => {
    localStorage.setItem('EXPENSE_APP_CATEGORIES', JSON.stringify(categories));
  }, [categories]);

  useEffect(() => {
    localStorage.setItem('EXPENSE_APP_COMPANIES', JSON.stringify(companies));
  }, [companies]);

  useEffect(() => {
    localStorage.setItem('EXPENSE_APP_USERS', JSON.stringify(users));
  }, [users]);

  useEffect(() => {
    localStorage.setItem('EXPENSE_APP_CURRENCIES', JSON.stringify(currencies));
  }, [currencies]);

  useEffect(() => {
    localStorage.setItem('EXPENSE_APP_RECURRING', JSON.stringify(recurringTemplates));
  }, [recurringTemplates]);

  useEffect(() => {
    localStorage.setItem('EXPENSE_APP_AUDIT', JSON.stringify(auditLogs));
  }, [auditLogs]);

  useEffect(() => {
    localStorage.setItem('EXPENSE_APP_NOTIFICATIONS', JSON.stringify(notifications));
  }, [notifications]);

  useEffect(() => {
    localStorage.setItem('EXPENSE_APP_CURRENT_USER', JSON.stringify(currentUser));
  }, [currentUser]);

  useEffect(() => {
    localStorage.setItem('EXPENSE_APP_IS_LOGGED_IN', isLoggedIn ? 'true' : 'false');
  }, [isLoggedIn]);

  // 確保使用者登入或切換後，當前 Tab 若不在 allowedTabs 內，自動切換至首個允許的 Tab
  useEffect(() => {
    if (currentUser.allowedTabs && currentUser.allowedTabs.length > 0) {
      if (!currentUser.allowedTabs.includes(activeTab)) {
        setActiveTab(currentUser.allowedTabs[0] || 'dashboard');
      }
    }
  }, [currentUser, activeTab]);

  // 記錄日誌輔助函式
  const addAuditLog = (module: string, action: string, details: string) => {
    const now = new Date();
    const timeStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const newLog: AuditLog = {
      id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      userId: currentUser.id,
      userName: currentUser.name,
      userRole: currentUser.role,
      action,
      module,
      details,
      timestamp: timeStr,
    };
    setAuditLogs(prev => [newLog, ...prev]);
    syncSaveAuditLogRemote(newLog).catch(() => {});
  };

  // 登入處理
  const handleLogin = (user: UserProfile) => {
    setCurrentUser(user);
    setIsLoggedIn(true);
    if (user.allowedTabs && user.allowedTabs.length > 0 && !user.allowedTabs.includes(activeTab)) {
      setActiveTab(user.allowedTabs[0]);
    }
    addAuditLog('系統驗證', '登入系統', `同仁 ${user.name} (${user.englishName || user.username}) 成功登入系統`);
  };

  // 切換使用者身分處理
  const handleSwitchUser = (user: UserProfile) => {
    setCurrentUser(user);
    setIsLoggedIn(true);
    if (user.allowedTabs && user.allowedTabs.length > 0 && !user.allowedTabs.includes(activeTab)) {
      setActiveTab(user.allowedTabs[0]);
    }
    addAuditLog('系統驗證', '切換身分', `同仁身分切換為：${user.name} (${user.englishName || user.username})`);
  };

  // 登出處理
  const handleLogout = () => {
    addAuditLog('系統驗證', '登出系統', `同仁 ${currentUser.name} 登出系統`);
    setIsLoggedIn(false);
  };

  // 重置使用者名單
  const handleResetUsers = () => {
    setUsers(INITIAL_USERS);
    localStorage.setItem('EXPENSE_APP_USERS', JSON.stringify(INITIAL_USERS));
    setCurrentUser(INITIAL_USERS[0]);
  };

  // 2. 核心 CRUD 與狀態變更邏輯
  const handleOpenCreateExpense = () => {
    setEditingExpense(null);
    setIsExpenseModalOpen(true);
  };

  const handleEditExpense = (expense: ExpenseItem) => {
    setEditingExpense(expense);
    setIsExpenseModalOpen(true);
  };

  const handleDeleteExpense = async (id: string) => {
    const target = expenses.find(e => e.id === id);
    if (!target) return;
    
    // 檢查若非管理員且單據已核准/已撥款
    const isAdmin = currentUser.role === 'admin' || currentUser.position === 'admin';
    if (!isAdmin && (target.status === 'approved' || target.status === 'paid')) {
      return;
    }

    setExpenses(prev => {
      const nextList = prev.filter(e => e.id !== id);
      localStorage.setItem('EXPENSE_APP_EXPENSES', JSON.stringify(nextList));
      return nextList;
    });
    await triggerSaveWithFeedback('正在從雲端資料庫刪除費用單據...', async () => {
      await syncDeleteExpenseRemote(id);
    });
    addAuditLog('費用登記', '刪除費用', `刪除【${target.applicant}】之報支單據：${target.description}（金額 NT$ ${target.amount.toLocaleString()}）`);
  };

  const handleBatchDeleteExpenses = async (ids: string[]) => {
    if (!ids || ids.length === 0) return;
    const count = ids.length;
    setExpenses(prev => {
      const nextList = prev.filter(e => !ids.includes(e.id));
      localStorage.setItem('EXPENSE_APP_EXPENSES', JSON.stringify(nextList));
      return nextList;
    });
    await triggerSaveWithFeedback(`正在批次自資料庫刪除 ${count} 筆費用單據...`, async () => {
      await syncBatchDeleteExpensesRemote(ids);
    });
    addAuditLog('費用登記', '批次刪除', `批次刪除 ${count} 筆費用報支單據`);
  };

  const handleSaveExpense = async (expenseData: Partial<ExpenseItem>) => {
    setIsExpenseModalOpen(false);
    const applicantUser = users.find(u => u.name === expenseData.applicant || u.englishName === expenseData.applicant);
    const applicantDept = expenseData.applicantDepartment || applicantUser?.department || currentUser.department || '未分配部門';

    if (editingExpense) {
      // 編輯既有費用
      const isReSubmitting = editingExpense.status === 'rejected' || !!editingExpense.rejectedReason;
      const numAmount = Number(expenseData.amount !== undefined ? expenseData.amount : editingExpense.amount);
      const numFee = Number(expenseData.fee !== undefined ? expenseData.fee : editingExpense.fee || 0);
      const totalAmount = Number(expenseData.totalAmount || (numAmount + numFee));

      const updatedItem: ExpenseItem = {
        ...editingExpense,
        ...expenseData,
        amount: numAmount,
        fee: numFee,
        totalAmount: totalAmount,
        applicantDepartment: applicantDept,
        // 駁回後的編輯公務費用報銷單，儲存後清空駁回原因與簽核記錄，自動轉為重新送審(待審核)
        status: isReSubmitting ? 'submitted' : (expenseData.status || editingExpense.status),
        approver: isReSubmitting ? undefined : editingExpense.approver,
        approvedAt: isReSubmitting ? undefined : editingExpense.approvedAt,
        rejectedReason: isReSubmitting ? undefined : editingExpense.rejectedReason,
        rejectedBy: isReSubmitting ? undefined : editingExpense.rejectedBy,
        rejectedAt: isReSubmitting ? undefined : editingExpense.rejectedAt,
        deptApprover: isReSubmitting ? undefined : editingExpense.deptApprover,
        deptApprovedAt: isReSubmitting ? undefined : editingExpense.deptApprovedAt,
        adminApprover: isReSubmitting ? undefined : editingExpense.adminApprover,
        adminApprovedAt: isReSubmitting ? undefined : editingExpense.adminApprovedAt,
        disbursedBy: isReSubmitting ? undefined : editingExpense.disbursedBy,
        disbursedAt: isReSubmitting ? undefined : editingExpense.disbursedAt,
        updatedAt: new Date().toISOString(),
      };

      setExpenses(prev => {
        const nextList = prev.map(item => item.id === editingExpense.id ? updatedItem : item);
        localStorage.setItem('EXPENSE_APP_EXPENSES', JSON.stringify(nextList));
        return nextList;
      });

      await triggerSaveWithFeedback(
        isReSubmitting ? '正在同步將重新送審單據寫入雲端資料庫...' : '正在同步更新費用單據至雲端資料庫...',
        async () => {
          await syncSaveExpenseRemote(updatedItem);
        }
      );

      if (isReSubmitting) {
        addAuditLog('費用登記', '重新送審', `駁回單據 ID: ${editingExpense.id} 經申請人修改後已重新送審（重置為待部門審核）`);
      } else {
        addAuditLog('費用登記', '修改費用', `更新費用單據 ID: ${editingExpense.id}，合計金額變更為 NT$ ${updatedItem.totalAmount.toLocaleString()}`);
      }
    } else {
      // 新增費用
      const numAmount = Number(expenseData.amount || 0);
      const numFee = Number(expenseData.fee || 0);
      const numTotal = Number(expenseData.totalAmount || (numAmount + numFee));

      const newItem: ExpenseItem = {
        id: `exp-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        itemNo: expenses.length + 1,
        claimMonth: expenseData.claimMonth || `${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}`,
        date: expenseData.date || new Date().toISOString().split('T')[0],
        companyName: expenseData.companyName || '邦捷總公司',
        projectName: expenseData.projectName || '金廈(泉)票務系統暨服務採購案',
        applicant: expenseData.applicant || currentUser.name,
        applicantId: applicantUser?.id || currentUser.id,
        applicantDepartment: applicantDept,
        categoryName: expenseData.categoryName || '住宿／車資',
        description: expenseData.description || '',
        currency: expenseData.currency || 'TWD',
        foreignAmount: expenseData.foreignAmount,
        exchangeRate: expenseData.exchangeRate || 1.0,
        amount: numAmount,
        fee: numFee,
        totalAmount: numTotal,
        invoiceNo: expenseData.invoiceNo,
        receiptStatus: expenseData.receiptStatus || 'attached',
        receiptImage: expenseData.receiptImage,
        status: 'submitted',
        remark: expenseData.remark,
        createdAt: new Date().toISOString(),
      };
      setExpenses(prev => {
        const nextList = [newItem, ...prev];
        localStorage.setItem('EXPENSE_APP_EXPENSES', JSON.stringify(nextList));
        return nextList;
      });
      await triggerSaveWithFeedback('正在新增費用單據至雲端資料庫...', async () => {
        await syncSaveExpenseRemote(newItem);
      });
      addAuditLog('費用登記', '新增費用', `申請人【${newItem.applicant}】新增費用單據：${newItem.description}（費用 NT$ ${newItem.amount} + 手續費 NT$ ${newItem.fee || 0} = 合計 NT$ ${newItem.totalAmount}）`);
    }
  };

  const handleStatusChange = async (id: string, newStatus: ExpenseStatus, rejectReason?: string) => {
    const target = expenses.find(e => e.id === id);
    if (!target) return;

    const today = new Date().toISOString().split('T')[0];
    let extraMeta: {
      rejectedBy?: string;
      rejectedAt?: string;
      deptApprover?: string;
      deptApprovedAt?: string;
      adminApprover?: string;
      adminApprovedAt?: string;
      disbursedBy?: string;
      disbursedAt?: string;
    } = {};

    if (newStatus === 'dept_approved') {
      extraMeta = {
        deptApprover: currentUser.name,
        deptApprovedAt: today,
      };
    } else if (newStatus === 'admin_approved' || newStatus === 'approved') {
      extraMeta = {
        adminApprover: currentUser.name,
        adminApprovedAt: today,
      };
    } else if (newStatus === 'paid') {
      extraMeta = {
        disbursedBy: currentUser.name,
        disbursedAt: today,
      };
    } else if (newStatus === 'rejected') {
      extraMeta = {
        rejectedBy: currentUser.name,
        rejectedAt: today,
      };
    }

    const approverName = (newStatus === 'admin_approved' || newStatus === 'approved') ? currentUser.name : target.approver;
    const approvedAtTime = (newStatus === 'admin_approved' || newStatus === 'approved') ? today : target.approvedAt;

    setExpenses(prev => {
      const nextList = prev.map(item => {
        if (item.id === id) {
          return {
            ...item,
            status: newStatus,
            rejectedReason: newStatus === 'rejected' ? rejectReason : (newStatus === 'submitted' ? undefined : item.rejectedReason),
            approver: approverName,
            approvedAt: approvedAtTime,
            ...extraMeta,
          };
        }
        return item;
      });
      localStorage.setItem('EXPENSE_APP_EXPENSES', JSON.stringify(nextList));
      return nextList;
    });

    await triggerSaveWithFeedback('正在將審批簽核狀態寫入資料庫...', async () => {
      await syncUpdateExpenseStatusRemote(id, newStatus, rejectReason, approverName, approvedAtTime, extraMeta);
    });

    const statusMap: Record<ExpenseStatus, string> = {
      draft: '草稿',
      submitted: '待部門審核',
      dept_approved: '部門已審核 (待最高管理)',
      admin_approved: '最高管理已核准 (待行政撥款)',
      approved: '已核准 (待行政撥款)',
      rejected: '已退件駁回',
      paid: '已結案撥款',
    };

    addAuditLog('審批中心', '變更狀態', `單據【${target.description}】狀態變更為「${statusMap[newStatus]}」${rejectReason ? `，理由：${rejectReason}` : ''}`);
  };

  const handleBatchStatusChange = async (ids: string[], newStatus: ExpenseStatus) => {
    const today = new Date().toISOString().split('T')[0];
    let extraMeta: {
      deptApprover?: string;
      deptApprovedAt?: string;
      adminApprover?: string;
      adminApprovedAt?: string;
      disbursedBy?: string;
      disbursedAt?: string;
    } = {};

    if (newStatus === 'dept_approved') {
      extraMeta = {
        deptApprover: currentUser.name,
        deptApprovedAt: today,
      };
    } else if (newStatus === 'admin_approved' || newStatus === 'approved') {
      extraMeta = {
        adminApprover: currentUser.name,
        adminApprovedAt: today,
      };
    } else if (newStatus === 'paid') {
      extraMeta = {
        disbursedBy: currentUser.name,
        disbursedAt: today,
      };
    }

    const approverName = (newStatus === 'admin_approved' || newStatus === 'approved') ? currentUser.name : undefined;
    const approvedAtTime = (newStatus === 'admin_approved' || newStatus === 'approved') ? today : undefined;

    setExpenses(prev => {
      const nextList = prev.map(item => {
        if (ids.includes(item.id)) {
          return {
            ...item,
            status: newStatus,
            approver: approverName || item.approver,
            approvedAt: approvedAtTime || item.approvedAt,
            ...extraMeta,
          };
        }
        return item;
      });
      localStorage.setItem('EXPENSE_APP_EXPENSES', JSON.stringify(nextList));
      return nextList;
    });

    await triggerSaveWithFeedback(`正在批次簽核 ${ids.length} 筆單據至資料庫...`, async () => {
      await syncBatchUpdateExpenseStatusRemote(ids, newStatus, approverName, approvedAtTime, extraMeta);
    });
    addAuditLog('審批中心', '批次簽核', `批次更新 ${ids.length} 筆單據狀態為「${newStatus}」`);
  };

  const handleBatchImportExpenses = async (newExpenses: ExpenseItem[]) => {
    setExpenses(prev => [...newExpenses, ...prev]);
    await triggerSaveWithFeedback(`正在將 ${newExpenses.length} 筆辨識單據匯入雲端資料庫...`, async () => {
      for (const exp of newExpenses) {
        await syncSaveExpenseRemote(exp);
      }
    });
    addAuditLog('發票辨識', 'AI 批次匯入', `透過發票影像辨識成功批次匯入 ${newExpenses.length} 筆發票報銷單`);
  };

  // 專案管理儲存
  const handleSaveProject = async (projectData: Partial<Project>) => {
    let savedProject: Project;
    if (projectData.id) {
      savedProject = { ...projects.find(p => p.id === projectData.id), ...projectData } as Project;
      setProjects(prev => prev.map(p => p.id === projectData.id ? savedProject : p));
      addAuditLog('專案管理', '修改專案', `更新專案【${projectData.name}】預算為 NT$ ${projectData.budgetLimit}`);
    } else {
      savedProject = {
        id: `proj-${Date.now()}`,
        code: projectData.code || `PRJ-${Math.floor(Math.random() * 900 + 100)}`,
        name: projectData.name || '新建立專案',
        budgetLimit: projectData.budgetLimit || 500000,
        warningThreshold: projectData.warningThreshold || 80,
        manager: projectData.manager || currentUser.name,
        managerId: projectData.managerId,
        startDate: projectData.startDate || new Date().toISOString().split('T')[0],
        status: projectData.status || 'active',
        description: projectData.description,
      };
      setProjects(prev => [...prev, savedProject]);
      addAuditLog('專案管理', '新增專案', `建立新專案【${savedProject.name}】，核定預算 NT$ ${savedProject.budgetLimit}`);
    }

    await triggerSaveWithFeedback('正在同步儲存專案至雲端資料庫...', async () => {
      await syncSaveProjectRemote(savedProject);
    });
  };

  const handleDeleteProject = async (id: string) => {
    const target = projects.find(p => p.id === id);
    if (!target) return;
    if (window.confirm(`確定要刪除專案【${target.name}】嗎？`)) {
      setProjects(prev => prev.filter(p => p.id !== id));
      await triggerSaveWithFeedback('正在從雲端資料庫刪除專案...', async () => {
        await syncDeleteProjectRemote(id);
      });
      addAuditLog('專案管理', '刪除專案', `刪除專案【${target.name}】`);
    }
  };

  // 固定支出模板處理
  const handleSaveRecurringTemplate = (template: Partial<RecurringExpenseTemplate>) => {
    setRecurringTemplates(prev => {
      const exists = prev.some(t => t.id === template.id);
      if (exists) {
        return prev.map(t => t.id === template.id ? { ...t, ...template } as RecurringExpenseTemplate : t);
      }
      const newTmpl: RecurringExpenseTemplate = {
        id: template.id || `rec-${Date.now()}`,
        name: template.name || '固定支出模版',
        companyName: template.companyName || '邦捷總公司',
        projectName: template.projectName || '邦捷公司費用報銷',
        categoryName: template.categoryName || '雜項購置',
        applicant: template.applicant || currentUser.name,
        description: template.description || '',
        defaultCurrency: template.defaultCurrency || 'TWD',
        defaultAmount: Number(template.defaultAmount) || 300,
        remark: template.remark,
        active: true,
      };
      return [...prev, newTmpl];
    });
    addAuditLog('固定支出', '維護模板', `儲存每月固定支出模板【${template.name || template.description}】`);
  };

  const handleDeleteRecurringTemplate = (id: string) => {
    setRecurringTemplates(prev => prev.filter(t => t.id !== id));
    addAuditLog('固定支出', '刪除模板', `刪除每月固定支出模板 ID: ${id}`);
  };

  const handleGenerateRecurringExpenses = async (
    month: string,
    selectedTemplateIds: string[],
    updatedAmounts: Record<string, number>
  ) => {
    const templatesToGenerate = recurringTemplates.filter(t => selectedTemplateIds.includes(t.id));
    if (templatesToGenerate.length === 0) return;

    const newExpenses: ExpenseItem[] = templatesToGenerate.map((tmpl, idx) => {
      const rawAmount = updatedAmounts[tmpl.id] !== undefined ? updatedAmounts[tmpl.id] : tmpl.defaultAmount;
      const currency = tmpl.defaultCurrency || 'TWD';
      const currRateObj = currencies.find(c => c.currency === currency);
      const exchangeRate = currRateObj ? currRateObj.rateToTWD : 1.0;
      const finalAmount = currency === 'TWD' ? rawAmount : Math.round(rawAmount * exchangeRate);

      const targetCompany = companies.find(c => c.name === tmpl.companyName);
      const targetProject = projects.find(p => p.name === tmpl.projectName);
      const targetCategory = categories.find(c => c.name === tmpl.categoryName);

      const y = month.length >= 4 ? month.slice(0, 4) : '2026';
      const m = month.length >= 6 ? month.slice(4, 6) : '09';

      return {
        id: `exp-rec-${Date.now()}-${idx}`,
        itemNo: expenses.length + idx + 1,
        claimMonth: month,
        date: `${y}-${m}-01`,
        applicant: tmpl.applicant || currentUser.name,
        applicantId: currentUser.id,
        companyName: tmpl.companyName || '邦捷總公司',
        companyId: targetCompany?.id || 'comp-1',
        projectName: tmpl.projectName || '邦捷公司費用報銷',
        projectId: targetProject?.id || 'proj-1',
        description: `【例行固定支出】${tmpl.description}`,
        categoryName: tmpl.categoryName || '雜項購置',
        categoryId: targetCategory?.id || 'cat-1',
        currency: currency,
        foreignAmount: currency !== 'TWD' ? rawAmount : undefined,
        exchangeRate: exchangeRate,
        amount: finalAmount,
        invoiceNo: undefined,
        receiptStatus: 'not_required',
        status: 'submitted',
        remark: tmpl.remark || '系統一鍵批次生成固定費用',
        createdAt: new Date().toISOString(),
      };
    });

    setExpenses(prev => [...newExpenses, ...prev]);
    await triggerSaveWithFeedback(`正在寫入 ${newExpenses.length} 筆固定支出單據至雲端資料庫...`, async () => {
      for (const exp of newExpenses) {
        await syncSaveExpenseRemote(exp);
      }
    });
    addAuditLog('固定支出', '自動生成', `一鍵生成【${month}】固定支出單據共 ${newExpenses.length} 筆`);
  };

  // 主檔設定儲存
  const handleSaveCompany = async (comp: Partial<Company>) => {
    let savedComp: Company;
    if (comp.id) {
      savedComp = { ...companies.find(c => c.id === comp.id), ...comp } as Company;
      setCompanies(prev => prev.map(c => c.id === comp.id ? savedComp : c));
      addAuditLog('主檔維護', '修改公司', `更新公司資料【${comp.name}】`);
    } else {
      savedComp = {
        id: `comp-${Date.now()}`,
        name: comp.name || '新公司',
        taxId: comp.taxId || '',
        address: comp.address,
        phone: comp.phone,
      };
      setCompanies(prev => [...prev, savedComp]);
      addAuditLog('主檔維護', '新增公司', `新增公司資料【${savedComp.name}】`);
    }

    await triggerSaveWithFeedback('正在同步公司資料至雲端資料庫...', async () => {
      await syncSaveCompanyRemote(savedComp);
    });
  };

  const handleSaveCategory = async (cat: Partial<ExpenseCategory>) => {
    let savedCat: ExpenseCategory;
    if (cat.id) {
      savedCat = { ...categories.find(c => c.id === cat.id), ...cat } as ExpenseCategory;
      setCategories(prev => prev.map(c => c.id === cat.id ? savedCat : c));
      addAuditLog('主檔維護', '修改科目', `更新科目與職位上限【${cat.name}】`);
    } else {
      savedCat = {
        id: `cat-${Date.now()}`,
        code: cat.code || `ACC-${Math.floor(Math.random() * 900 + 100)}`,
        name: cat.name || '新會計科目',
        description: cat.description,
        maxPerItem: cat.maxPerItem,
        roleLimits: cat.roleLimits,
      };
      setCategories(prev => [...prev, savedCat]);
      addAuditLog('主檔維護', '新增科目', `新增會計科目【${savedCat.name}】`);
    }

    await triggerSaveWithFeedback('正在同步會計科目至雲端資料庫...', async () => {
      await syncSaveCategoryRemote(savedCat);
    });
  };

  const handleSaveUser = async (u: Partial<UserProfile>) => {
    let updatedUser: UserProfile;
    if (u.id) {
      const oldUser = users.find(user => user.id === u.id);
      updatedUser = { ...oldUser, ...u } as UserProfile;
      setUsers(prev => prev.map(user => user.id === u.id ? updatedUser : user));
      if (currentUser.id === u.id) {
        setCurrentUser(prev => ({ ...prev, ...u } as UserProfile));
      }
      if (oldUser && u.name && oldUser.name !== u.name) {
        setExpenses(prev => prev.map(exp => 
          (exp.applicantId === u.id || exp.applicant === oldUser.name || exp.applicant === oldUser.englishName) 
            ? { ...exp, applicant: u.name! } 
            : exp
        ));
      }
      addAuditLog('主檔維護', '修改同仁權限', `更新同仁【${u.name || updatedUser.name}】之姓名、帳號與職位權限`);
    } else {
      updatedUser = {
        id: `user-${Date.now()}`,
        name: u.name || '新同仁',
        englishName: u.englishName || '',
        username: u.username || '',
        password: u.password || '123',
        email: u.email || 'user@bangjie.com.tw',
        role: u.role || 'editor',
        position: u.position || 'editor',
        status: u.status || 'active',
        roleTitle: u.roleTitle || '一般員工',
        department: u.department || '研發處',
        allowedTabs: u.allowedTabs || ['dashboard', 'expenses', 'scanner', 'recurring', 'reports'],
      };
      setUsers(prev => [...prev, updatedUser]);
      addAuditLog('主檔維護', '新增同仁帳號', `新增同仁帳號【${updatedUser.name}】(${updatedUser.username})`);
    }

    await triggerSaveWithFeedback(`正在將同仁【${updatedUser.name}】資料同步寫入雲端資料庫...`, async () => {
      await syncSaveUserRemote(updatedUser);
    });
  };

  const handleDeleteUser = async (id: string) => {
    const isSuperAdmin = currentUser.position === 'admin' || currentUser.role === 'admin';
    if (!isSuperAdmin) {
      alert('【權限不足】只有系統最高管理者 (Admin) 擁有刪除同仁帳號的權限！');
      return;
    }

    if (id === currentUser.id) {
      alert('【安全防護】您無法刪除目前正在登入使用的最高管理者帳號！');
      return;
    }

    const targetUser = users.find(u => u.id === id);
    if (!targetUser) return;

    setUsers(prev => prev.filter(u => u.id !== id));
    await triggerSaveWithFeedback(`正在從雲端資料庫刪除同仁【${targetUser.name}】...`, async () => {
      await syncDeleteUserRemote(id);
    });
    addAuditLog(
      '主檔維護',
      '刪除同仁帳號',
      `永久刪除同仁【${targetUser.name}】(${targetUser.username || targetUser.englishName || targetUser.email}) 帳號`
    );
  };

  // 同仁自定義密碼變更
  const handleSaveUserPassword = async (newPassword: string) => {
    const updatedUser: UserProfile = {
      ...currentUser,
      password: newPassword,
    };
    setCurrentUser(updatedUser);
    setUsers(prev => prev.map(u => u.id === currentUser.id ? updatedUser : u));
    await triggerSaveWithFeedback('正在更新個人密碼至雲端資料庫...', async () => {
      await syncSaveUserRemote(updatedUser);
    });
    addAuditLog(
      '帳號資安',
      '變更密碼',
      `同仁【${currentUser.name}】(${currentUser.username || currentUser.englishName || currentUser.email}) 成功自定義修改登入密碼`
    );
  };

  const handleSaveCurrency = async (curr: CurrencyRate) => {
    setCurrencies(prev => {
      const exists = prev.some(c => c.currency === curr.currency);
      return exists ? prev.map(c => c.currency === curr.currency ? curr : c) : [...prev, curr];
    });
    await triggerSaveWithFeedback(`正在將幣別【${curr.currency}】儲存至雲端資料庫...`, async () => {
      await syncSaveCurrencyRemote(curr);
    });
    addAuditLog('主檔維護', '更新匯率', `更新幣別【${curr.currency}】基準匯率為 ${curr.rateToTWD}`);
  };

  const handleDeleteCurrency = async (currencyCode: string) => {
    if (currencyCode === 'TWD') {
      alert('本位幣 TWD 不可刪除！');
      return;
    }
    setCurrencies(prev => prev.filter(c => c.currency !== currencyCode));
    await triggerSaveWithFeedback(`正在從雲端資料庫刪除幣別【${currencyCode}】...`, async () => {
      await syncDeleteCurrencyRemote(currencyCode);
    });
    addAuditLog('主檔維護', '刪除幣別', `刪除外幣幣別【${currencyCode}】`);
  };

  const handleBatchUpdateCurrencies = async (updatedList: CurrencyRate[]) => {
    setCurrencies(updatedList);
    await triggerSaveWithFeedback('正在將最新外匯匯率同步儲存至雲端資料庫...', async () => {
      for (const curr of updatedList) {
        await syncSaveCurrencyRemote(curr);
      }
    });
    addAuditLog('主檔維護', '批量更新匯率', `一鍵同步最新國際匯率共 ${updatedList.length} 種幣別`);
  };

  // 雲端備份與還原
  const handleExportBackup = () => {
    const fullBackup = {
      version: '2.6.0',
      exportedAt: new Date().toISOString(),
      expenses,
      projects,
      categories,
      companies,
      users,
      currencies,
      recurringTemplates,
      auditLogs,
    };
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(fullBackup, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `Expensify_Backup_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    addAuditLog('系統備份', '匯出備份', '完成系統完整 JSON 資料備份檔下載');
  };

  const handleRestoreBackup = (backupJson: any) => {
    if (backupJson.expenses) setExpenses(backupJson.expenses);
    if (backupJson.projects) setProjects(backupJson.projects);
    if (backupJson.categories) setCategories(backupJson.categories);
    if (backupJson.companies) setCompanies(backupJson.companies);
    if (backupJson.users) setUsers(backupJson.users);
    if (backupJson.currencies) setCurrencies(backupJson.currencies);
    if (backupJson.recurringTemplates) setRecurringTemplates(backupJson.recurringTemplates);
    if (backupJson.auditLogs) setAuditLogs(backupJson.auditLogs);
    addAuditLog('系統備份', '還原備份', '成功自備份檔還原全系統資料');
  };

  const handleResetToInitial = () => {
    setExpenses(INITIAL_EXPENSES);
    setProjects(INITIAL_PROJECTS);
    setCategories(INITIAL_CATEGORIES);
    setCompanies(INITIAL_COMPANIES);
    setUsers(INITIAL_USERS);
    setCurrencies(INITIAL_CURRENCIES);
    setRecurringTemplates(INITIAL_RECURRING_TEMPLATES);
    setAuditLogs(INITIAL_AUDIT_LOGS);
    setNotifications(INITIAL_NOTIFICATIONS);
    setCurrentUser(INITIAL_USERS[0]);
    addAuditLog('系統資料', '重置資料', '將系統所有資料庫重置為初始示範狀態');
  };

  const handleMarkNotificationRead = (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const handleClearNotifications = () => {
    setNotifications([]);
  };

  // 待審核單據總數
  const pendingApprovalCount = useMemo(() => {
    return expenses.filter(e => e.status === 'submitted').length;
  }, [expenses]);

  // 預算超標警告專案數
  const budgetWarningCount = useMemo(() => {
    return projects.filter(p => {
      const totalSpent = expenses
        .filter(e => e.projectName === p.name && e.status !== 'rejected')
        .reduce((sum, e) => sum + e.amount, 0);
      return totalSpent >= (p.budgetLimit * (p.warningThreshold / 100));
    }).length;
  }, [projects, expenses]);

  // 若尚未登入，顯示登入畫面
  if (!isLoggedIn) {
    return <LoginScreen users={users} onLogin={handleLogin} onResetUsers={handleResetUsers} />;
  }

  return (
    <div className="flex h-screen w-full bg-[#f8fafc] text-slate-900 font-sans overflow-hidden antialiased selection:bg-indigo-500 selection:text-white">
      
      {/* 1. High Density 左側深色側邊欄 */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        currentUser={currentUser}
        allUsers={users}
        onSwitchUser={handleSwitchUser}
        onLogout={handleLogout}
        onOpenChangePassword={() => setIsChangePasswordModalOpen(true)}
        pendingApprovalCount={pendingApprovalCount}
        budgetWarningCount={budgetWarningCount}
        isOpenMobile={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
      />

      {/* 2. 右側主內容容器 */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden bg-[#f8fafc]">
        
        {/* 頂部緊湊型 Header */}
        <Header
          currentUser={currentUser}
          allUsers={users}
          onSwitchUser={handleSwitchUser}
          onLogout={handleLogout}
          onOpenChangePassword={() => setIsChangePasswordModalOpen(true)}
          activeTab={activeTab}
          onOpenCreateExpense={handleOpenCreateExpense}
          onToggleMobileSidebar={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
          notifications={notifications}
          onMarkNotificationRead={handleMarkNotificationRead}
          onClearNotifications={handleClearNotifications}
          currencies={currencies}
          selectedCurrency={selectedCurrency}
          onSelectCurrency={setSelectedCurrency}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
        />

        {/* 視圖主內容滾動區 */}
        <main className="flex-1 p-4 sm:p-6 space-y-5 overflow-y-auto bg-[#f8fafc]">
          
          {/* 預算超支警示橫幅 (High Density Alert Card) */}
          {budgetWarningCount > 0 && (
            <div className="bg-amber-50 border border-amber-200 p-3.5 rounded-xl flex items-center justify-between shadow-2xs">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center font-bold shrink-0">
                  ⚠️
                </div>
                <div>
                  <div className="text-xs font-bold text-amber-900">
                    系統預算超支/門檻警戒提示 ({budgetWarningCount} 個專案達警示門檻)
                  </div>
                  <div className="text-[11px] text-amber-700 mt-0.5">
                    部分進行中專案累計支出已接近或超出合約預算，請專案經理與審核人員特別複核。
                  </div>
                </div>
              </div>
              <button
                onClick={() => setActiveTab('projects')}
                className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition-colors shrink-0 shadow-2xs cursor-pointer"
              >
                查看專案預算 →
              </button>
            </div>
          )}

          {activeTab === 'dashboard' && (
            <DashboardView
              expenses={expenses}
              projects={projects}
              currentUser={currentUser}
              onOpenCreateExpense={handleOpenCreateExpense}
              setActiveTab={setActiveTab}
            />
          )}

          {activeTab === 'expenses' && (
            <ExpenseListView
              expenses={expenses}
              projects={projects}
              categories={categories}
              companies={companies}
              currentUser={currentUser}
              allUsers={users}
              onOpenCreate={handleOpenCreateExpense}
              onEditExpense={handleEditExpense}
              onDeleteExpense={handleDeleteExpense}
              onBatchDeleteExpenses={handleBatchDeleteExpenses}
              onStatusChange={handleStatusChange}
              onBatchStatusChange={handleBatchStatusChange}
            />
          )}

          {activeTab === 'approvals' && (
            <ApprovalWorkflowView
              expenses={expenses}
              currentUser={currentUser}
              allUsers={users}
              projects={projects}
              companies={companies}
              categories={categories}
              onStatusChange={handleStatusChange}
              onBatchStatusChange={handleBatchStatusChange}
              onDeleteExpense={handleDeleteExpense}
              setActiveTab={setActiveTab}
            />
          )}

          {activeTab === 'scanner' && (
            <ReceiptScannerView
              currentUser={currentUser}
              categories={categories}
              projects={projects}
              onBatchImportExpenses={handleBatchImportExpenses}
              setActiveTab={setActiveTab}
            />
          )}

          {activeTab === 'recurring' && (
            <RecurringExpensesView
              templates={recurringTemplates}
              currentUser={currentUser}
              companies={companies}
              projects={projects}
              categories={categories}
              users={users}
              currencies={currencies}
              onSaveTemplate={handleSaveRecurringTemplate}
              onDeleteTemplate={handleDeleteRecurringTemplate}
              onGenerateExpenses={handleGenerateRecurringExpenses}
              setActiveTab={setActiveTab}
            />
          )}

          {activeTab === 'projects' && (
            <ProjectBudgetView
              projects={projects}
              expenses={expenses}
              currentUser={currentUser}
              users={users}
              onSaveProject={handleSaveProject}
              onDeleteProject={handleDeleteProject}
            />
          )}

          {activeTab === 'reports' && (
            <ReportsExportView
              expenses={expenses}
              projects={projects}
              categories={categories}
              companies={companies}
              currentUser={currentUser}
            />
          )}

          {activeTab === 'masterData' && (
            <MasterDataView
              companies={companies}
              categories={categories}
              users={users}
              currencies={currencies}
              currentUser={currentUser}
              onSaveCompany={handleSaveCompany}
              onSaveCategory={handleSaveCategory}
              onSaveUser={handleSaveUser}
              onDeleteUser={handleDeleteUser}
              onSaveCurrency={handleSaveCurrency}
              onDeleteCurrency={handleDeleteCurrency}
              onBatchUpdateCurrencies={handleBatchUpdateCurrencies}
            />
          )}

          {activeTab === 'audit' && (
            <AuditBackupView
              auditLogs={auditLogs}
              currentUser={currentUser}
              onExportBackup={handleExportBackup}
              onRestoreBackup={handleRestoreBackup}
              onResetToInitial={handleResetToInitial}
              dbStatus={dbStatus}
              onSyncPushToDb={handlePushAllToCloudDb}
              onSyncPullFromDb={handlePullFromCloudDb}
              isSyncing={isSyncing}
            />
          )}

          {/* 3. High Density 底部狀態資訊欄 */}
          <footer className="flex flex-col sm:flex-row items-center justify-between bg-slate-100 p-3 rounded-lg border border-slate-200 text-[11px] text-slate-500 gap-2 mt-4">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5 font-medium text-slate-700">
                <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                雲端系統狀態：正常運作中
              </div>
              <div className="hidden md:block text-slate-400">🛡️ 企業級本地資料加密儲存 (AES-256)</div>
            </div>
            <div className="text-[11px] text-slate-400 font-mono">
              EXPENSIFY PRO V2.6 • 登入身分：{currentUser.name} ({currentUser.englishName || currentUser.username}) • {currentUser.position === 'admin' ? '最高管理' : currentUser.position === 'auditor' ? '部門管理' : '一般員工'}
            </div>
          </footer>

        </main>
      </div>

      {/* 4. 費用新增/編輯彈窗 */}
      <ExpenseFormModal
        isOpen={isExpenseModalOpen}
        onClose={() => setIsExpenseModalOpen(false)}
        onSave={handleSaveExpense}
        onDelete={handleDeleteExpense}
        editingExpense={editingExpense}
        companies={companies}
        projects={projects}
        categories={categories}
        currencies={currencies}
        currentUser={currentUser}
        allUsers={users}
        allExpenses={expenses}
      />

      {/* 5. 同仁自定義修改密碼彈窗 */}
      <ChangePasswordModal
        isOpen={isChangePasswordModalOpen}
        onClose={() => setIsChangePasswordModalOpen(false)}
        currentUser={currentUser}
        onSavePassword={handleSaveUserPassword}
      />

      {/* 6. 雲端資料庫儲存與同步過場反饋 Overlay */}
      <SavingLoadingOverlay status={savingStatus} />

    </div>
  );
}
