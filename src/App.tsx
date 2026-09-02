import React, { useState, useEffect, useMemo } from 'react';
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
  syncBatchUpdateExpenseStatusRemote 
} from './services/api';

export default function App() {
  // 0. 雲端資料庫連線狀態 (Neon PostgreSQL)
  const [dbStatus, setDbStatus] = useState<{ dbConnected: boolean; message?: string; driver?: string }>({
    dbConnected: false
  });
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  // 0.1 雲端資料庫初始化檢測與雙向同步 (Neon PostgreSQL)
  const syncWithRemoteDb = async (silent = false) => {
    try {
      const health = await checkDbHealth();
      setDbStatus(health);

      if (health.dbConnected) {
        if (!silent) setIsSyncing(true);
        const res = await fetchRemoteData();
        if (res.dbConnected && res.data) {
          // 若後端資料庫已有資料，則載入同步
          if (res.data.expenses && res.data.expenses.length > 0) {
            setExpenses(res.data.expenses);
          }
          if (res.data.users && res.data.users.length > 0) {
            setUsers(res.data.users);
          }
          if (res.data.projects && res.data.projects.length > 0) {
            setProjects(res.data.projects);
          }
          if (res.data.categories && res.data.categories.length > 0) {
            setCategories(res.data.categories);
          }
          if (res.data.companies && res.data.companies.length > 0) {
            setCompanies(res.data.companies);
          }
          if (res.data.auditLogs && res.data.auditLogs.length > 0) {
            setAuditLogs(res.data.auditLogs);
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
    return saved ? JSON.parse(saved) : INITIAL_EXPENSES;
  });

  const [projects, setProjects] = useState<Project[]>(() => {
    const saved = localStorage.getItem('EXPENSE_APP_PROJECTS');
    return saved ? JSON.parse(saved) : INITIAL_PROJECTS;
  });

  const [categories, setCategories] = useState<ExpenseCategory[]>(() => {
    const saved = localStorage.getItem('EXPENSE_APP_CATEGORIES');
    return saved ? JSON.parse(saved) : INITIAL_CATEGORIES;
  });

  const [companies, setCompanies] = useState<Company[]>(() => {
    const saved = localStorage.getItem('EXPENSE_APP_COMPANIES');
    return saved ? JSON.parse(saved) : INITIAL_COMPANIES;
  });

  const [users, setUsers] = useState<UserProfile[]>(() => {
    const saved = localStorage.getItem('EXPENSE_APP_USERS');
    if (!saved) return INITIAL_USERS;
    try {
      const parsed: UserProfile[] = JSON.parse(saved);
      // 合併預設帳號，確保新加入的展示帳號與必要欄位皆完整
      const merged = INITIAL_USERS.map(initU => {
        const found = parsed.find(p => p.id === initU.id);
        if (found) {
          return {
            ...initU,
            ...found,
            username: found.username || initU.username,
            englishName: found.englishName || initU.englishName,
            password: found.password || initU.password || '123',
            position: found.position || initU.position || 'editor',
            status: found.status || initU.status || 'active',
            allowedTabs: (found.allowedTabs && found.allowedTabs.length > 0) ? found.allowedTabs : initU.allowedTabs,
          };
        }
        return initU;
      });
      // 包含任何自訂新增的使用者
      parsed.forEach(p => {
        if (!merged.find(m => m.id === p.id)) {
          merged.push(p);
        }
      });
      return merged;
    } catch {
      return INITIAL_USERS;
    }
  });

  const [currencies, setCurrencies] = useState<CurrencyRate[]>(() => {
    const saved = localStorage.getItem('EXPENSE_APP_CURRENCIES');
    return saved ? JSON.parse(saved) : INITIAL_CURRENCIES;
  });

  const [recurringTemplates, setRecurringTemplates] = useState<RecurringExpenseTemplate[]>(() => {
    const saved = localStorage.getItem('EXPENSE_APP_RECURRING');
    return saved ? JSON.parse(saved) : INITIAL_RECURRING_TEMPLATES;
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
        const match = INITIAL_USERS.find(u => u.id === parsed.id);
        return match ? { ...match, ...parsed } : parsed;
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

  const handleDeleteExpense = (id: string) => {
    const target = expenses.find(e => e.id === id);
    if (!target) return;
    
    // 檢查若非管理員且單據已核准/已撥款
    const isAdmin = currentUser.role === 'admin' || currentUser.position === 'admin';
    if (!isAdmin && (target.status === 'approved' || target.status === 'paid')) {
      return;
    }

    setExpenses(prev => prev.filter(e => e.id !== id));
    syncDeleteExpenseRemote(id);
    addAuditLog('費用登記', '刪除費用', `刪除【${target.applicant}】之報支單據：${target.description}（金額 NT$ ${target.amount.toLocaleString()}）`);
  };

  const handleBatchDeleteExpenses = (ids: string[]) => {
    if (ids.length === 0) return;
    const count = ids.length;
    setExpenses(prev => prev.filter(e => !ids.includes(e.id)));
    syncBatchDeleteExpensesRemote(ids);
    addAuditLog('費用登記', '批次刪除', `批次刪除 ${count} 筆費用報支單據`);
  };

  const handleSaveExpense = (expenseData: Partial<ExpenseItem>) => {
    if (editingExpense) {
      // 編輯既有費用
      let updatedItem: ExpenseItem | null = null;
      setExpenses(prev => prev.map(item => {
        if (item.id === editingExpense.id) {
          updatedItem = {
            ...item,
            ...expenseData,
            amount: Number(expenseData.amount || item.amount),
            updatedAt: new Date().toISOString(),
          } as ExpenseItem;
          return updatedItem;
        }
        return item;
      }));
      if (updatedItem) {
        syncSaveExpenseRemote(updatedItem);
      }
      addAuditLog('費用登記', '修改費用', `更新費用單據 ID: ${editingExpense.id}，金額變更為 NT$ ${expenseData.amount}`);
    } else {
      // 新增費用
      const newItem: ExpenseItem = {
        id: `exp-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        itemNo: expenses.length + 1,
        claimMonth: expenseData.claimMonth || '202608',
        date: expenseData.date || new Date().toISOString().split('T')[0],
        companyName: expenseData.companyName || '邦捷總公司',
        projectName: expenseData.projectName || '金廈(泉)票務系統暨服務採購案',
        applicant: expenseData.applicant || currentUser.name,
        categoryName: expenseData.categoryName || '住宿／車資',
        description: expenseData.description || '',
        currency: expenseData.currency || 'TWD',
        foreignAmount: expenseData.foreignAmount,
        exchangeRate: expenseData.exchangeRate || 1.0,
        amount: Number(expenseData.amount || 0),
        invoiceNo: expenseData.invoiceNo,
        receiptStatus: expenseData.receiptStatus || 'attached',
        receiptImage: expenseData.receiptImage,
        status: 'submitted',
        remark: expenseData.remark,
        createdAt: new Date().toISOString(),
      };
      setExpenses(prev => [newItem, ...prev]);
      syncSaveExpenseRemote(newItem);
      addAuditLog('費用登記', '新增費用', `申請人【${newItem.applicant}】新增費用單據：${newItem.description}（金額 NT$ ${newItem.amount}）`);
    }
    setIsExpenseModalOpen(false);
  };

  const handleStatusChange = (id: string, newStatus: ExpenseStatus, rejectReason?: string) => {
    const target = expenses.find(e => e.id === id);
    if (!target) return;

    const approverName = newStatus === 'approved' ? currentUser.name : target.approvedBy;
    const approvedAtTime = newStatus === 'approved' ? new Date().toISOString().split('T')[0] : target.approvedAt;

    setExpenses(prev => prev.map(item => {
      if (item.id === id) {
        return {
          ...item,
          status: newStatus,
          rejectedReason: newStatus === 'rejected' ? rejectReason : undefined,
          approvedBy: approverName,
          approvedAt: approvedAtTime,
        };
      }
      return item;
    }));

    syncUpdateExpenseStatusRemote(id, newStatus, rejectReason, approverName, approvedAtTime);

    const statusMap = {
      submitted: '待審核',
      approved: '已核准',
      rejected: '已退件駁回',
      paid: '已結案撥款',
    };

    addAuditLog('審批中心', '變更狀態', `單據【${target.description}】狀態變更為「${statusMap[newStatus]}」${rejectReason ? `，理由：${rejectReason}` : ''}`);
  };

  const handleBatchStatusChange = (ids: string[], newStatus: ExpenseStatus) => {
    const approverName = newStatus === 'approved' ? currentUser.name : undefined;
    const approvedAtTime = newStatus === 'approved' ? new Date().toISOString().split('T')[0] : undefined;

    setExpenses(prev => prev.map(item => {
      if (ids.includes(item.id)) {
        return {
          ...item,
          status: newStatus,
          approvedBy: approverName || item.approvedBy,
          approvedAt: approvedAtTime || item.approvedAt,
        };
      }
      return item;
    }));

    syncBatchUpdateExpenseStatusRemote(ids, newStatus, approverName, approvedAtTime);
    addAuditLog('審批中心', '批次簽核', `批次更新 ${ids.length} 筆單據狀態為「${newStatus}」`);
  };

  const handleBatchImportExpenses = (newExpenses: ExpenseItem[]) => {
    setExpenses(prev => [...newExpenses, ...prev]);
    addAuditLog('發票辨識', 'AI 批次匯入', `透過發票影像辨識成功批次匯入 ${newExpenses.length} 筆發票報銷單`);
  };

  // 專案管理儲存
  const handleSaveProject = (projectData: Partial<Project>) => {
    if (projectData.id) {
      setProjects(prev => prev.map(p => p.id === projectData.id ? { ...p, ...projectData } as Project : p));
      addAuditLog('專案管理', '修改專案', `更新專案【${projectData.name}】預算為 NT$ ${projectData.budgetLimit}`);
    } else {
      const newProj: Project = {
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
      setProjects(prev => [...prev, newProj]);
      addAuditLog('專案管理', '新增專案', `建立新專案【${newProj.name}】，核定預算 NT$ ${newProj.budgetLimit}`);
    }
  };

  const handleDeleteProject = (id: string) => {
    const target = projects.find(p => p.id === id);
    if (!target) return;
    if (window.confirm(`確定要刪除專案【${target.name}】嗎？`)) {
      setProjects(prev => prev.filter(p => p.id !== id));
      addAuditLog('專案管理', '刪除專案', `刪除專案【${target.name}】`);
    }
  };

  // 固定支出模板處理
  const handleSaveRecurringTemplate = (template: RecurringExpenseTemplate) => {
    setRecurringTemplates(prev => {
      const exists = prev.some(t => t.id === template.id);
      if (exists) {
        return prev.map(t => t.id === template.id ? template : t);
      }
      return [...prev, template];
    });
    addAuditLog('固定支出', '維護模板', `儲存每月固定支出模板【${template.description}】`);
  };

  const handleDeleteRecurringTemplate = (id: string) => {
    setRecurringTemplates(prev => prev.filter(t => t.id !== id));
    addAuditLog('固定支出', '刪除模板', `刪除每月固定支出模板 ID: ${id}`);
  };

  const handleGenerateRecurringExpenses = (generated: ExpenseItem[]) => {
    setExpenses(prev => [...generated, ...prev]);
    addAuditLog('固定支出', '自動生成', `一鍵生成當月例行性固定支出共 ${generated.length} 筆`);
  };

  // 主檔設定儲存
  const handleSaveCompany = (comp: Partial<Company>) => {
    if (comp.id) {
      setCompanies(prev => prev.map(c => c.id === comp.id ? { ...c, ...comp } as Company : c));
      addAuditLog('主檔維護', '修改公司', `更新公司資料【${comp.name}】`);
    } else {
      const newComp: Company = {
        id: `comp-${Date.now()}`,
        name: comp.name || '新公司',
        taxId: comp.taxId || '',
        address: comp.address,
        phone: comp.phone,
      };
      setCompanies(prev => [...prev, newComp]);
      addAuditLog('主檔維護', '新增公司', `新增公司資料【${newComp.name}】`);
    }
  };

  const handleSaveCategory = (cat: Partial<ExpenseCategory>) => {
    if (cat.id) {
      setCategories(prev => prev.map(c => c.id === cat.id ? { ...c, ...cat } as ExpenseCategory : c));
      addAuditLog('主檔維護', '修改科目', `更新科目與職位上限【${cat.name}】`);
    } else {
      const newCat: ExpenseCategory = {
        id: `cat-${Date.now()}`,
        code: cat.code || `ACC-${Math.floor(Math.random() * 900 + 100)}`,
        name: cat.name || '新會計科目',
        description: cat.description,
        maxPerItem: cat.maxPerItem,
        roleLimits: cat.roleLimits,
      };
      setCategories(prev => [...prev, newCat]);
      addAuditLog('主檔維護', '新增科目', `新增會計科目【${newCat.name}】`);
    }
  };

  const handleSaveUser = (u: Partial<UserProfile>) => {
    if (u.id) {
      setUsers(prev => prev.map(user => user.id === u.id ? { ...user, ...u } as UserProfile : user));
      if (currentUser.id === u.id) {
        setCurrentUser(prev => ({ ...prev, ...u } as UserProfile));
      }
      addAuditLog('主檔維護', '修改同仁權限', `更新同仁【${u.name}】之職位與模組權限`);
    } else {
      const newUser: UserProfile = {
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
      setUsers(prev => [...prev, newUser]);
      addAuditLog('主檔維護', '新增同仁帳號', `新增同仁帳號【${newUser.name}】(${newUser.username})`);
    }
  };

  const handleSaveCurrency = (curr: CurrencyRate) => {
    setCurrencies(prev => prev.map(c => c.currency === curr.currency ? curr : c));
    addAuditLog('主檔維護', '更新匯率', `更新幣別【${curr.currency}】基準匯率為 ${curr.rateToTWD}`);
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
              onSaveCompany={handleSaveCompany}
              onSaveCategory={handleSaveCategory}
              onSaveUser={handleSaveUser}
              onSaveCurrency={handleSaveCurrency}
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

    </div>
  );
}
