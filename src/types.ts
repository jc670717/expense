export type UserRole = 'admin' | 'auditor' | 'editor'; // 最高管理 | 部門管理 | 一般員工
export type UserPosition = 'admin' | 'auditor' | 'editor'; // 最高管理 | 部門管理 | 一般員工
export type UserStatus = 'active' | 'inactive'; // 在職 | 離職

export interface UserProfile {
  id: string;
  name: string; // 中文姓名
  englishName?: string; // 英文名
  username?: string; // 登入帳號
  password?: string; // 登入密碼
  email: string;
  role: UserRole; // 權限角色
  roleTitle: string; // 職稱顯示
  position: UserPosition; // 職位：admin (最高管理) | auditor (部門管理) | editor (一般員工)
  status: UserStatus; // 狀態：active (在職) | inactive (離職)
  allowedTabs?: string[]; // 自訂可看到的功能模組 tab IDs
  companyId?: string;
  department: string;
  avatarBg?: string;
}

export interface Company {
  id: string;
  name: string;
  taxId: string;
  address?: string;
  phone?: string;
  isDefault?: boolean;
}

export type ProjectStatus = 'pending' | 'active' | 'completed' | 'suspended'; // 未啟動 | 進行中 | 已結案 | 已中止

export interface Project {
  id: string;
  code: string;
  name: string;
  companyId?: string;
  manager: string; // 負責人姓名
  managerId?: string; // 負責人 User ID
  startDate?: string; // 開始時間 YYYY-MM-DD
  status: ProjectStatus; // 專案狀態 (未啟動 | 進行中 | 已結案 | 已中止)
  budgetLimit: number; // 預算上限 (TWD)
  warningThreshold: number; // 警示門檻 (預設 80%)
  description?: string;
}

export interface RoleCategoryLimit {
  allowed: boolean; // 是否允許該職位選取報支
  maxLimit?: number; // 該職位的單筆報支金額上限 (0 或未設表示無限制)
}

export interface ExpenseCategory {
  id: string;
  name: string;
  code: string;
  icon?: string;
  description?: string;
  maxPerItem?: number; // 全局預設單筆上限建議
  // 依職位設定報支限制與不同上限
  roleLimits?: {
    admin: RoleCategoryLimit;   // 最高管理
    auditor: RoleCategoryLimit; // 部門管理
    editor: RoleCategoryLimit;  // 一般員工
  };
}

export type ExpenseStatus = 
  | 'draft' 
  | 'submitted'       // 第一階段：待部門主管審核 (Submitted / Dept Pending)
  | 'dept_approved'   // 第二階段：部門已審核 / 待最高管理審核 (Dept Approved / Admin Pending)
  | 'admin_approved'  // 第三階段：最高管理已審核 / 待行政管理部撥款 (Admin Approved / Disbursement Pending)
  | 'approved'        // 兼容舊資料：已核准 (視同 admin_approved)
  | 'rejected'        // 已駁回退件 (Rejected)
  | 'paid';           // 已撥款完成 (Paid / Disbursed)

export interface ExpenseItem {
  id: string;
  itemNo: number; // 原表格項次
  claimMonth: string; // 請款月份, e.g. 202603, 202608, 202609
  date: string; // 發生日期, e.g. 2026-03-04
  applicant: string; // 申請人姓名
  applicantId?: string; // 申請人 ID
  applicantDepartment?: string; // 申請人所屬部門
  companyName: string; // 公司別, e.g. 邦捷總公司, 馬祖分公司
  companyId?: string;
  projectName: string; // 專案名稱
  projectId?: string;
  description: string; // 說明
  categoryName: string; // 科目, e.g. 住宿／車資, 雜項購置
  categoryId?: string;
  currency: 'TWD' | 'USD' | 'JPY' | 'RMB' | 'EUR' | string;
  foreignAmount?: number; // 外幣原金額
  exchangeRate?: number; // 匯率
  amount: number; // 費用金額 (原幣/折合台幣 TWD)
  fee?: number; // 手續費 (預設 0)
  totalAmount?: number; // 合計金額 (費用金額 + 手續費)
  invoiceNo?: string; // 發票/收據號碼
  receiptImage?: string; // 收據影像 (base64 或 URL)
  receiptStatus?: 'attached' | 'missing' | 'receipt_only'; // 發票狀態 (如欠發票)
  status: ExpenseStatus; // 審核狀態 (三階段)
  approver?: string; // 審核人
  approvedAt?: string; // 審核時間
  rejectedReason?: string; // 駁回原因
  rejectedBy?: string; // 駁回人
  rejectedAt?: string; // 駁回時間
  
  // 三階段審核歷程記錄
  deptApprover?: string; // 第一階段：部門主管審核人
  deptApprovedAt?: string; // 第一階段：部門審核時間
  adminApprover?: string; // 第二階段：最高管理審核人
  adminApprovedAt?: string; // 第二階段：最高管理審核時間
  disbursedBy?: string; // 第三階段：行政管理部撥款人
  disbursedAt?: string; // 第三階段：行政管理部撥款時間

  remark?: string; // 備註 (如 10USD, 手續費, 公務車等)
  approvedBy?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface RecurringExpenseTemplate {
  id: string;
  name: string;
  companyName: string;
  projectName: string;
  categoryName: string;
  applicant: string;
  description: string;
  defaultCurrency: string; // TWD, USD, JPY, RMB, EUR, or any custom currency code
  defaultAmount: number;
  remark?: string;
  active: boolean;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  userRole?: UserRole;
  action: string;
  module: string;
  targetType?: string;
  targetId?: string;
  details: string;
}

export interface CurrencyRate {
  currency: string; // TWD, USD, JPY, RMB, EUR, KRW, GBP, HKD, SGD, etc.
  name: string;
  rateToTWD: number;
  symbol: string;
  lastUpdated: string;
}

export interface OcrResult {
  id: string;
  fileName: string;
  previewUrl: string;
  detectedDate?: string;
  detectedAmount?: number;
  detectedInvoiceNo?: string;
  detectedMerchant?: string;
  detectedCategory?: string;
  detectedDescription?: string;
  confidence: number;
  selected: boolean;
}

export interface NotificationItem {
  id: string;
  type: 'warning' | 'info' | 'success' | 'danger' | 'alert';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  linkTab?: string;
}
