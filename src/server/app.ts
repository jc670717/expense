import express from 'express';
import cors from 'cors';
import { getDbPool, SCHEMA_SQL } from './db.js';

export function createExpressApp() {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: '20mb' }));

  // 檢查資料庫狀態與健康檢查
  app.get('/api/health', async (req, res) => {
    const pool = getDbPool();
    if (!pool) {
      return res.json({
        status: 'ok',
        dbConnected: false,
        message: 'Running in Local/Memory mode (DATABASE_URL not set). Set DATABASE_URL in Vercel or .env for Neon PostgreSQL.'
      });
    }
    try {
      const result = await pool.query('SELECT NOW()');
      return res.json({
        status: 'ok',
        dbConnected: true,
        time: result.rows[0].now,
        driver: 'Neon Serverless PostgreSQL'
      });
    } catch (err: any) {
      console.error('Database connection error in /api/health:', err);
      return res.json({
        status: 'warning',
        dbConnected: false,
        error: err.message
      });
    }
  });

  // 資料庫自動初始化 Schema
  app.post('/api/db/init', async (req, res) => {
    const pool = getDbPool();
    if (!pool) {
      return res.status(400).json({ error: 'DATABASE_URL is not set. Cannot run PostgreSQL schema migration.' });
    }
    try {
      await pool.query(SCHEMA_SQL);
      res.json({ success: true, message: 'Schema created/verified successfully.' });
    } catch (err: any) {
      console.error('Error initializing schema:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // 1. 同步全量資料 (Sync All Data from Local to Cloud or Fetch from Cloud)
  app.get('/api/sync/all', async (req, res) => {
    const pool = getDbPool();
    if (!pool) {
      return res.json({ dbConnected: false, data: null });
    }
    try {
      // 先確保資料表存在
      await pool.query(SCHEMA_SQL);

      const [expensesRes, usersRes, projectsRes, categoriesRes, companiesRes, logsRes] = await Promise.all([
        pool.query('SELECT * FROM expenses ORDER BY date DESC, item_no ASC'),
        pool.query('SELECT * FROM users ORDER BY id ASC'),
        pool.query('SELECT * FROM projects ORDER BY code ASC'),
        pool.query('SELECT * FROM categories ORDER BY id ASC'),
        pool.query('SELECT * FROM companies ORDER BY id ASC'),
        pool.query('SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT 500')
      ]);

      res.json({
        dbConnected: true,
        data: {
          expenses: expensesRes.rows.map(r => ({
            id: r.id,
            itemNo: r.item_no,
            claimMonth: r.claim_month,
            date: r.date,
            applicant: r.applicant,
            applicantId: r.applicant_id,
            companyName: r.company_name,
            companyId: r.company_id,
            projectName: r.project_name,
            projectId: r.project_id,
            description: r.description,
            categoryName: r.category_name,
            categoryId: r.category_id,
            currency: r.currency || 'TWD',
            foreignAmount: r.foreign_amount ? Number(r.foreign_amount) : undefined,
            exchangeRate: r.exchange_rate ? Number(r.exchange_rate) : 1,
            amount: Number(r.amount),
            invoiceNo: r.invoice_no,
            receiptImage: r.receipt_image,
            receiptStatus: r.receipt_status,
            status: r.status,
            approver: r.approver,
            approvedAt: r.approved_at,
            rejectedReason: r.rejected_reason,
            remark: r.remark
          })),
          users: usersRes.rows.map(u => ({
            id: u.id,
            name: u.name,
            englishName: u.english_name,
            username: u.username,
            password: u.password,
            email: u.email,
            role: u.role,
            roleTitle: u.role_title,
            position: u.position,
            status: u.status,
            allowedTabs: typeof u.allowed_tabs === 'string' ? JSON.parse(u.allowed_tabs) : (u.allowed_tabs || []),
            companyId: u.company_id,
            department: u.department,
            avatarBg: u.avatar_bg
          })),
          projects: projectsRes.rows.map(p => ({
            id: p.id,
            code: p.code,
            name: p.name,
            companyId: p.company_id,
            manager: p.manager,
            managerId: p.manager_id,
            startDate: p.start_date,
            status: p.status,
            budgetLimit: Number(p.budget_limit),
            warningThreshold: Number(p.warning_threshold),
            description: p.description
          })),
          categories: categoriesRes.rows.map(c => ({
            id: c.id,
            name: c.name,
            code: c.code,
            icon: c.icon,
            description: c.description,
            maxPerItem: Number(c.max_per_item),
            roleLimits: typeof c.role_limits === 'string' ? JSON.parse(c.role_limits) : (c.role_limits || {})
          })),
          companies: companiesRes.rows.map(co => ({
            id: co.id,
            name: co.name,
            taxId: co.tax_id,
            address: co.address,
            phone: co.phone,
            isDefault: co.is_default
          })),
          auditLogs: logsRes.rows.map(l => ({
            id: l.id,
            timestamp: l.timestamp,
            userId: l.user_id,
            userName: l.user_name,
            userRole: l.user_role,
            action: l.action,
            module: l.module,
            targetType: l.target_type,
            targetId: l.target_id,
            details: l.details
          }))
        }
      });
    } catch (err: any) {
      console.error('Error querying all tables:', err);
      res.status(500).json({ error: err.message, dbConnected: false });
    }
  });

  // 2. 批次覆寫/初始化上傳全量資料 (Seeds/Migration)
  app.post('/api/sync/push-all', async (req, res) => {
    const pool = getDbPool();
    if (!pool) {
      return res.status(400).json({ error: 'DATABASE_URL is not set.' });
    }

    const { expenses, users, projects, categories, companies, auditLogs } = req.body;
    const client = await pool.connect();

    try {
      await client.query('BEGIN');
      await client.query(SCHEMA_SQL);

      // 寫入 Users
      if (Array.isArray(users) && users.length > 0) {
        for (const u of users) {
          await client.query(
            `INSERT INTO users (id, name, english_name, username, password, email, role, role_title, position, status, allowed_tabs, company_id, department, avatar_bg)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
             ON CONFLICT (id) DO UPDATE SET
               name = EXCLUDED.name, english_name = EXCLUDED.english_name, username = EXCLUDED.username,
               role = EXCLUDED.role, position = EXCLUDED.position, status = EXCLUDED.status,
               allowed_tabs = EXCLUDED.allowed_tabs, department = EXCLUDED.department, avatar_bg = EXCLUDED.avatar_bg`,
            [u.id, u.name, u.englishName, u.username, u.password || '123', u.email, u.role, u.roleTitle, u.position || u.role, u.status || 'active', JSON.stringify(u.allowedTabs || []), u.companyId, u.department, u.avatarBg]
          );
        }
      }

      // 寫入 Companies
      if (Array.isArray(companies) && companies.length > 0) {
        for (const c of companies) {
          await client.query(
            `INSERT INTO companies (id, name, tax_id, address, phone, is_default)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, tax_id = EXCLUDED.tax_id, address = EXCLUDED.address, phone = EXCLUDED.phone, is_default = EXCLUDED.is_default`,
            [c.id, c.name, c.taxId, c.address, c.phone, c.isDefault || false]
          );
        }
      }

      // 寫入 Projects
      if (Array.isArray(projects) && projects.length > 0) {
        for (const p of projects) {
          await client.query(
            `INSERT INTO projects (id, code, name, company_id, manager, manager_id, start_date, status, budget_limit, warning_threshold, description)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
             ON CONFLICT (id) DO UPDATE SET code = EXCLUDED.code, name = EXCLUDED.name, manager = EXCLUDED.manager, budget_limit = EXCLUDED.budget_limit, warning_threshold = EXCLUDED.warning_threshold, status = EXCLUDED.status`,
            [p.id, p.code, p.name, p.companyId, p.manager, p.managerId, p.startDate, p.status, p.budgetLimit, p.warningThreshold, p.description]
          );
        }
      }

      // 寫入 Categories
      if (Array.isArray(categories) && categories.length > 0) {
        for (const cat of categories) {
          await client.query(
            `INSERT INTO categories (id, name, code, icon, description, max_per_item, role_limits)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, code = EXCLUDED.code, icon = EXCLUDED.icon, description = EXCLUDED.description, max_per_item = EXCLUDED.max_per_item, role_limits = EXCLUDED.role_limits`,
            [cat.id, cat.name, cat.code, cat.icon, cat.description, cat.maxPerItem, JSON.stringify(cat.roleLimits || {})]
          );
        }
      }

      // 寫入 Expenses
      if (Array.isArray(expenses) && expenses.length > 0) {
        for (const e of expenses) {
          await client.query(
            `INSERT INTO expenses (id, item_no, claim_month, date, applicant, applicant_id, company_name, company_id, project_name, project_id, description, category_name, category_id, currency, foreign_amount, exchange_rate, amount, invoice_no, receipt_image, receipt_status, status, approver, approved_at, rejected_reason, remark)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25)
             ON CONFLICT (id) DO UPDATE SET
               claim_month = EXCLUDED.claim_month, date = EXCLUDED.date, applicant = EXCLUDED.applicant,
               project_name = EXCLUDED.project_name, project_id = EXCLUDED.project_id,
               category_name = EXCLUDED.category_name, category_id = EXCLUDED.category_id,
               description = EXCLUDED.description, amount = EXCLUDED.amount, currency = EXCLUDED.currency,
               foreign_amount = EXCLUDED.foreign_amount, exchange_rate = EXCLUDED.exchange_rate,
               invoice_no = EXCLUDED.invoice_no, receipt_image = EXCLUDED.receipt_image, receipt_status = EXCLUDED.receipt_status,
               status = EXCLUDED.status, approver = EXCLUDED.approver, approved_at = EXCLUDED.approved_at,
               rejected_reason = EXCLUDED.rejected_reason, remark = EXCLUDED.remark, updated_at = CURRENT_TIMESTAMP`,
            [e.id, e.itemNo || 1, e.claimMonth, e.date, e.applicant, e.applicantId, e.companyName, e.companyId, e.projectName, e.projectId, e.description, e.categoryName, e.categoryId, e.currency || 'TWD', e.foreignAmount || null, e.exchangeRate || 1, e.amount, e.invoiceNo, e.receiptImage, e.receiptStatus, e.status, e.approver, e.approvedAt, e.rejectedReason, e.remark]
          );
        }
      }

      // 寫入 Audit Logs
      if (Array.isArray(auditLogs) && auditLogs.length > 0) {
        for (const l of auditLogs) {
          await client.query(
            `INSERT INTO audit_logs (id, timestamp, user_id, user_name, user_role, action, module, target_type, target_id, details)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
             ON CONFLICT (id) DO NOTHING`,
            [l.id, l.timestamp, l.userId, l.userName, l.userRole, l.action, l.module, l.targetType, l.targetId, l.details]
          );
        }
      }

      await client.query('COMMIT');
      res.json({ success: true, message: 'All data successfully synchronized to PostgreSQL.' });
    } catch (err: any) {
      await client.query('ROLLBACK');
      console.error('Push all error:', err);
      res.status(500).json({ error: err.message });
    } finally {
      client.release();
    }
  });

  // 3. 單筆/批次費用操作 API
  app.post('/api/expenses', async (req, res) => {
    const pool = getDbPool();
    if (!pool) return res.status(200).json({ success: true, mode: 'local' });

    const e = req.body;
    try {
      await pool.query(
        `INSERT INTO expenses (id, item_no, claim_month, date, applicant, applicant_id, company_name, company_id, project_name, project_id, description, category_name, category_id, currency, foreign_amount, exchange_rate, amount, invoice_no, receipt_image, receipt_status, status, approver, approved_at, rejected_reason, remark)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25)
         ON CONFLICT (id) DO UPDATE SET
           claim_month = EXCLUDED.claim_month, date = EXCLUDED.date, applicant = EXCLUDED.applicant,
           project_name = EXCLUDED.project_name, project_id = EXCLUDED.project_id,
           category_name = EXCLUDED.category_name, category_id = EXCLUDED.category_id,
           description = EXCLUDED.description, amount = EXCLUDED.amount, currency = EXCLUDED.currency,
           foreign_amount = EXCLUDED.foreign_amount, exchange_rate = EXCLUDED.exchange_rate,
           invoice_no = EXCLUDED.invoice_no, receipt_image = EXCLUDED.receipt_image, receipt_status = EXCLUDED.receipt_status,
           status = EXCLUDED.status, approver = EXCLUDED.approver, approved_at = EXCLUDED.approved_at,
           rejected_reason = EXCLUDED.rejected_reason, remark = EXCLUDED.remark, updated_at = CURRENT_TIMESTAMP`,
        [e.id, e.itemNo || 1, e.claimMonth, e.date, e.applicant, e.applicantId, e.companyName, e.companyId, e.projectName, e.projectId, e.description, e.categoryName, e.categoryId, e.currency || 'TWD', e.foreignAmount || null, e.exchangeRate || 1, e.amount, e.invoiceNo, e.receiptImage, e.receiptStatus, e.status, e.approver, e.approvedAt, e.rejectedReason, e.remark]
      );
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/expenses/:id', async (req, res) => {
    const pool = getDbPool();
    if (!pool) return res.status(200).json({ success: true, mode: 'local' });

    try {
      await pool.query('DELETE FROM expenses WHERE id = $1', [req.params.id]);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/expenses/batch-delete', async (req, res) => {
    const pool = getDbPool();
    if (!pool) return res.status(200).json({ success: true, mode: 'local' });

    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) return res.json({ success: true });

    try {
      await pool.query('DELETE FROM expenses WHERE id = ANY($1)', [ids]);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.patch('/api/expenses/:id/status', async (req, res) => {
    const pool = getDbPool();
    if (!pool) return res.status(200).json({ success: true, mode: 'local' });

    const { status, rejectReason, approver, approvedAt } = req.body;
    try {
      await pool.query(
        `UPDATE expenses SET status = $1, rejected_reason = $2, approver = $3, approved_at = $4, updated_at = CURRENT_TIMESTAMP WHERE id = $5`,
        [status, rejectReason || null, approver || null, approvedAt || null, req.params.id]
      );
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/expenses/batch-status', async (req, res) => {
    const pool = getDbPool();
    if (!pool) return res.status(200).json({ success: true, mode: 'local' });

    const { ids, status, approver, approvedAt } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) return res.json({ success: true });

    try {
      await pool.query(
        `UPDATE expenses SET status = $1, approver = $2, approved_at = $3, updated_at = CURRENT_TIMESTAMP WHERE id = ANY($4)`,
        [status, approver || null, approvedAt || null, ids]
      );
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 4. 同仁/使用者操作 API
  app.post('/api/users', async (req, res) => {
    const pool = getDbPool();
    if (!pool) return res.status(200).json({ success: true, mode: 'local' });

    const u = req.body;
    try {
      await pool.query(
        `INSERT INTO users (id, name, english_name, username, password, email, role, role_title, position, status, allowed_tabs, company_id, department, avatar_bg)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
         ON CONFLICT (id) DO UPDATE SET
           name = EXCLUDED.name, english_name = EXCLUDED.english_name, username = EXCLUDED.username,
           password = EXCLUDED.password, email = EXCLUDED.email, role = EXCLUDED.role,
           role_title = EXCLUDED.role_title, position = EXCLUDED.position, status = EXCLUDED.status,
           allowed_tabs = EXCLUDED.allowed_tabs, department = EXCLUDED.department, avatar_bg = EXCLUDED.avatar_bg`,
        [u.id, u.name, u.englishName, u.username, u.password || '123', u.email, u.role, u.roleTitle, u.position || u.role, u.status || 'active', JSON.stringify(u.allowedTabs || []), u.companyId, u.department, u.avatarBg]
      );
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/users/:id', async (req, res) => {
    const pool = getDbPool();
    if (!pool) return res.status(200).json({ success: true, mode: 'local' });

    try {
      await pool.query('DELETE FROM users WHERE id = $1', [req.params.id]);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  return app;
}
