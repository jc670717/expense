import { 
  ExpenseItem, 
  UserProfile, 
  Project, 
  ExpenseCategory, 
  Company, 
  AuditLog, 
  ExpenseStatus,
  CurrencyRate,
  RecurringExpenseTemplate
} from '../types';

export interface SyncResponse {
  dbConnected: boolean;
  data?: {
    expenses: ExpenseItem[];
    users: UserProfile[];
    projects: Project[];
    categories: ExpenseCategory[];
    companies: Company[];
    auditLogs: AuditLog[];
  } | null;
}

// 檢查後端 DB 連線狀態
export async function checkDbHealth(): Promise<{ status: string; dbConnected: boolean; message?: string }> {
  try {
    const res = await fetch('/api/health');
    if (!res.ok) throw new Error('API request failed');
    return await res.json();
  } catch {
    return { status: 'offline', dbConnected: false, message: 'Local Mode (Standalone SPA)' };
  }
}

// 從 PostgreSQL 取得全量資料
export async function fetchRemoteData(): Promise<SyncResponse> {
  try {
    const res = await fetch('/api/sync/all');
    if (!res.ok) throw new Error('Sync fetch failed');
    return await res.json();
  } catch (e) {
    console.warn('PostgreSQL fetch fallback to local:', e);
    return { dbConnected: false, data: null };
  }
}

// 將本地資料初始化/推送到 PostgreSQL
export async function pushAllDataToRemote(payload: {
  expenses: ExpenseItem[];
  users: UserProfile[];
  projects: Project[];
  categories: ExpenseCategory[];
  companies: Company[];
  auditLogs: AuditLog[];
}): Promise<boolean> {
  try {
    const res = await fetch('/api/sync/push-all', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return res.ok;
  } catch {
    return false;
  }
}

// 單筆/批次費用異動同步至 PostgreSQL
export async function syncSaveExpenseRemote(expense: ExpenseItem) {
  try {
    await fetch('/api/expenses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(expense)
    });
  } catch (err) {
    console.warn('Sync save remote error:', err);
  }
}

export async function syncDeleteExpenseRemote(id: string) {
  try {
    await fetch(`/api/expenses/${id}`, { method: 'DELETE' });
  } catch (err) {
    console.warn('Sync delete remote error:', err);
  }
}

export async function syncBatchDeleteExpensesRemote(ids: string[]) {
  try {
    await fetch('/api/expenses/batch-delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids })
    });
  } catch (err) {
    console.warn('Sync batch delete remote error:', err);
  }
}

export async function syncUpdateExpenseStatusRemote(
  id: string,
  status: ExpenseStatus,
  rejectReason?: string,
  approver?: string,
  approvedAt?: string,
  extra?: {
    rejectedBy?: string;
    rejectedAt?: string;
    deptApprover?: string;
    deptApprovedAt?: string;
    adminApprover?: string;
    adminApprovedAt?: string;
    disbursedBy?: string;
    disbursedAt?: string;
  }
) {
  try {
    await fetch(`/api/expenses/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        status, 
        rejectReason, 
        approver, 
        approvedAt,
        ...extra
      })
    });
  } catch (err) {
    console.warn('Sync update status remote error:', err);
  }
}

export async function syncBatchUpdateExpenseStatusRemote(
  ids: string[],
  status: ExpenseStatus,
  approver?: string,
  approvedAt?: string,
  extra?: {
    deptApprover?: string;
    deptApprovedAt?: string;
    adminApprover?: string;
    adminApprovedAt?: string;
    disbursedBy?: string;
    disbursedAt?: string;
  }
) {
  try {
    await fetch('/api/expenses/batch-status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        ids, 
        status, 
        approver, 
        approvedAt,
        ...extra
      })
    });
  } catch (err) {
    console.warn('Sync batch update status remote error:', err);
  }
}

// 同仁/使用者異動同步
export async function syncSaveUserRemote(user: UserProfile): Promise<boolean> {
  try {
    const res = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(user)
    });
    return res.ok;
  } catch (err) {
    console.warn('Sync save user remote error:', err);
    return false;
  }
}

export async function syncDeleteUserRemote(id: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/users/${id}`, { method: 'DELETE' });
    return res.ok;
  } catch (err) {
    console.warn('Sync delete user remote error:', err);
    return false;
  }
}

// 專案異動同步
export async function syncSaveProjectRemote(project: Project): Promise<boolean> {
  try {
    const res = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(project)
    });
    return res.ok;
  } catch (err) {
    console.warn('Sync save project remote error:', err);
    return false;
  }
}

export async function syncDeleteProjectRemote(id: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/projects/${id}`, { method: 'DELETE' });
    return res.ok;
  } catch (err) {
    console.warn('Sync delete project remote error:', err);
    return false;
  }
}

// 公司別異動同步
export async function syncSaveCompanyRemote(company: Company): Promise<boolean> {
  try {
    const res = await fetch('/api/companies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(company)
    });
    return res.ok;
  } catch (err) {
    console.warn('Sync save company remote error:', err);
    return false;
  }
}

export async function syncDeleteCompanyRemote(id: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/companies/${id}`, { method: 'DELETE' });
    return res.ok;
  } catch (err) {
    console.warn('Sync delete company remote error:', err);
    return false;
  }
}

// 會計科目異動同步
export async function syncSaveCategoryRemote(category: ExpenseCategory): Promise<boolean> {
  try {
    const res = await fetch('/api/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(category)
    });
    return res.ok;
  } catch (err) {
    console.warn('Sync save category remote error:', err);
    return false;
  }
}

export async function syncDeleteCategoryRemote(id: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/categories/${id}`, { method: 'DELETE' });
    return res.ok;
  } catch (err) {
    console.warn('Sync delete category remote error:', err);
    return false;
  }
}

// 稽核日誌同步
export async function syncSaveAuditLogRemote(log: AuditLog): Promise<boolean> {
  try {
    const res = await fetch('/api/audit-logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(log)
    });
    return res.ok;
  } catch (err) {
    console.warn('Sync save audit log remote error:', err);
    return false;
  }
}

// 匯率操作與同步
export async function syncSaveCurrencyRemote(currency: CurrencyRate): Promise<boolean> {
  try {
    const res = await fetch('/api/currencies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(currency)
    });
    return res.ok;
  } catch (err) {
    console.warn('Sync save currency remote error:', err);
    return false;
  }
}

export async function syncDeleteCurrencyRemote(currencyCode: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/currencies/${currencyCode}`, { method: 'DELETE' });
    return res.ok;
  } catch (err) {
    console.warn('Sync delete currency remote error:', err);
    return false;
  }
}

// 線上即時查詢外幣對 TWD 匯率 (使用 open exchange API)
export async function fetchLiveExchangeRates(symbols?: string[]): Promise<Record<string, number>> {
  try {
    const res = await fetch('https://open.er-api.com/v6/latest/USD');
    if (!res.ok) throw new Error('匯率 API 請求失敗');
    const data = await res.json();
    if (data && data.rates && data.rates.TWD) {
      const usdToTwd = data.rates.TWD;
      const ratesToTWD: Record<string, number> = {
        TWD: 1.0,
      };
      
      // 對於任何幣別 X：1 X = (usdToTwd / data.rates[X]) TWD
      Object.keys(data.rates).forEach(code => {
        const ratePerUsd = data.rates[code];
        if (ratePerUsd && ratePerUsd > 0) {
          ratesToTWD[code.toUpperCase()] = Number((usdToTwd / ratePerUsd).toFixed(4));
        }
      });
      // 特殊別名相容
      if (ratesToTWD['CNY']) {
        ratesToTWD['RMB'] = ratesToTWD['CNY'];
      }
      return ratesToTWD;
    }
    return {};
  } catch (err) {
    console.warn('Fetch live exchange rates error:', err);
    return {};
  }
}

// 固定支出模版操作與同步
export async function syncSaveRecurringTemplateRemote(tmpl: RecurringExpenseTemplate): Promise<boolean> {
  try {
    const res = await fetch('/api/recurring-templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(tmpl)
    });
    return res.ok;
  } catch (err) {
    console.warn('Sync save recurring template remote error:', err);
    return false;
  }
}

export async function syncDeleteRecurringTemplateRemote(id: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/recurring-templates/${id}`, { method: 'DELETE' });
    return res.ok;
  } catch (err) {
    console.warn('Sync delete recurring template remote error:', err);
    return false;
  }
}

