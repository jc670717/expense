import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const { Pool } = pg;

let pool: pg.Pool | null = null;
let currentConnStr: string | null = null;

export function getDbPool(): pg.Pool | null {
  const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!connectionString) {
    return null;
  }
  if (!pool || currentConnStr !== connectionString) {
    currentConnStr = connectionString;
    pool = new Pool({
      connectionString,
      ssl: {
        rejectUnauthorized: false
      },
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000
    });
  }
  return pool;
}

export const SCHEMA_SQL = `
-- 1. 使用者資料表 (Users)
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    english_name VARCHAR(100),
    username VARCHAR(100) UNIQUE,
    password VARCHAR(255),
    email VARCHAR(255),
    role VARCHAR(50) NOT NULL DEFAULT 'editor',
    role_title VARCHAR(100),
    position VARCHAR(50) NOT NULL DEFAULT 'editor',
    status VARCHAR(50) NOT NULL DEFAULT 'active',
    allowed_tabs JSONB DEFAULT '[]',
    company_id VARCHAR(50),
    department VARCHAR(100),
    avatar_bg VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. 公司別資料表 (Companies)
CREATE TABLE IF NOT EXISTS companies (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    tax_id VARCHAR(50),
    address TEXT,
    phone VARCHAR(50),
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. 專案預算資料表 (Projects)
CREATE TABLE IF NOT EXISTS projects (
    id VARCHAR(50) PRIMARY KEY,
    code VARCHAR(50) NOT NULL,
    name VARCHAR(150) NOT NULL,
    company_id VARCHAR(50),
    manager VARCHAR(100),
    manager_id VARCHAR(50),
    start_date VARCHAR(20),
    status VARCHAR(50) DEFAULT 'active',
    budget_limit NUMERIC(15, 2) DEFAULT 0,
    warning_threshold NUMERIC(5, 2) DEFAULT 80,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. 會計科目資料表 (Expense Categories)
CREATE TABLE IF NOT EXISTS categories (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(50),
    icon VARCHAR(50),
    description TEXT,
    max_per_item NUMERIC(15, 2) DEFAULT 0,
    role_limits JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. 費用報銷單據明細表 (Expense Items)
CREATE TABLE IF NOT EXISTS expenses (
    id VARCHAR(50) PRIMARY KEY,
    item_no INT,
    claim_month VARCHAR(20) NOT NULL,
    date VARCHAR(20) NOT NULL,
    applicant VARCHAR(100) NOT NULL,
    applicant_id VARCHAR(50),
    applicant_department VARCHAR(100),
    company_name VARCHAR(150),
    company_id VARCHAR(50),
    project_name VARCHAR(150),
    project_id VARCHAR(50),
    description TEXT NOT NULL,
    category_name VARCHAR(100),
    category_id VARCHAR(50),
    currency VARCHAR(10) DEFAULT 'TWD',
    foreign_amount NUMERIC(15, 2),
    exchange_rate NUMERIC(10, 4) DEFAULT 1,
    amount NUMERIC(15, 2) NOT NULL,
    fee NUMERIC(15, 2) DEFAULT 0,
    total_amount NUMERIC(15, 2) DEFAULT 0,
    invoice_no VARCHAR(100),
    receipt_image TEXT,
    receipt_status VARCHAR(50) DEFAULT 'attached',
    status VARCHAR(50) NOT NULL DEFAULT 'submitted',
    approver VARCHAR(100),
    approved_at VARCHAR(50),
    rejected_reason TEXT,
    rejected_by VARCHAR(100),
    rejected_at VARCHAR(50),
    dept_approver VARCHAR(100),
    dept_approved_at VARCHAR(50),
    admin_approver VARCHAR(100),
    admin_approved_at VARCHAR(50),
    disbursed_by VARCHAR(100),
    disbursed_at VARCHAR(50),
    remark TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 自動升級現有資料表欄位 (Auto-migrate existing tables)
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS fee NUMERIC(15, 2) DEFAULT 0;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS total_amount NUMERIC(15, 2) DEFAULT 0;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS applicant_department VARCHAR(100);
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS rejected_by VARCHAR(100);
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS rejected_at VARCHAR(50);
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS dept_approver VARCHAR(100);
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS dept_approved_at VARCHAR(50);
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS admin_approver VARCHAR(100);
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS admin_approved_at VARCHAR(50);
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS disbursed_by VARCHAR(100);
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS disbursed_at VARCHAR(50);

-- 6. 系統操作軌跡稽核日誌 (Audit Logs)
CREATE TABLE IF NOT EXISTS audit_logs (
    id VARCHAR(50) PRIMARY KEY,
    timestamp VARCHAR(50) NOT NULL,
    user_id VARCHAR(50),
    user_name VARCHAR(100),
    user_role VARCHAR(50),
    action VARCHAR(100) NOT NULL,
    module VARCHAR(100) NOT NULL,
    target_type VARCHAR(100),
    target_id VARCHAR(50),
    details TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 7. 多幣別匯率表 (Currency Rates)
CREATE TABLE IF NOT EXISTS currency_rates (
    currency VARCHAR(20) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    rate_to_twd NUMERIC(15, 6) NOT NULL DEFAULT 1.0,
    symbol VARCHAR(20) DEFAULT '$',
    last_updated VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 8. 每月固定支出模版表 (Recurring Expense Templates)
CREATE TABLE IF NOT EXISTS recurring_templates (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    company_name VARCHAR(150),
    project_name VARCHAR(150),
    category_name VARCHAR(100),
    applicant VARCHAR(100) NOT NULL,
    description TEXT,
    default_currency VARCHAR(20) DEFAULT 'TWD',
    default_amount NUMERIC(15, 2) DEFAULT 0,
    remark TEXT,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_expenses_applicant ON expenses(applicant);
CREATE INDEX IF NOT EXISTS idx_expenses_claim_month ON expenses(claim_month);
CREATE INDEX IF NOT EXISTS idx_expenses_status ON expenses(status);
CREATE INDEX IF NOT EXISTS idx_expenses_project ON expenses(project_id);
`;
