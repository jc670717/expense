import { ExpenseItem, UserProfile, Project, ExpenseCategory, Company, AuditLog, ExpenseStatus } from '../types';

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
  approvedAt?: string
) {
  try {
    await fetch(`/api/expenses/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, rejectReason, approver, approvedAt })
    });
  } catch (err) {
    console.warn('Sync update status remote error:', err);
  }
}

export async function syncBatchUpdateExpenseStatusRemote(
  ids: string[],
  status: ExpenseStatus,
  approver?: string,
  approvedAt?: string
) {
  try {
    await fetch('/api/expenses/batch-status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids, status, approver, approvedAt })
    });
  } catch (err) {
    console.warn('Sync batch update status remote error:', err);
  }
}
