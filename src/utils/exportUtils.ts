import * as XLSX from 'xlsx';
import { ExpenseItem, Project } from '../types';

/**
 * 匯出費用明細為 CSV 格式 (包含 UTF-8 BOM 避免 Excel 中文亂碼)
 */
export function exportToCSV(expenses: ExpenseItem[], filename = '費用報支明細表.csv') {
  const headers = [
    '項次', '請款月份', '日期', '申請人', '所屬部門', '公司別', '專案名稱', '說明摘要', 
    '會計科目', '幣別', '原幣金額', '費用金額(TWD)', '手續費(TWD)', '合計金額(TWD)', 
    '審核進度', '部門審核人', '部門審核時間', '最高核准人', '最高核准時間', '行政撥款人', '行政撥款時間',
    '發票狀態', '駁回原因', '備註'
  ];
  
  const statusMap: Record<string, string> = {
    draft: '草稿',
    submitted: '1.待部門審核',
    dept_approved: '2.部門已審核(待最高管理)',
    admin_approved: '3.最高管理已核准(待行政撥款)',
    approved: '3.最高管理已核准(待行政撥款)',
    paid: '已結案撥款',
    rejected: '已退件駁回',
  };

  const rows = expenses.map((exp, idx) => {
    const fee = Number(exp.fee || 0);
    const amount = Number(exp.amount || 0);
    const total = Number(exp.totalAmount || (amount + fee));

    return [
      exp.itemNo || idx + 1,
      exp.claimMonth,
      exp.date,
      exp.applicant,
      exp.applicantDepartment || '',
      exp.companyName,
      exp.projectName,
      `"${(exp.description || '').replace(/"/g, '""')}"`,
      exp.categoryName,
      exp.currency || 'TWD',
      exp.foreignAmount || exp.amount,
      amount,
      fee,
      total,
      statusMap[exp.status] || exp.status,
      exp.deptApprover || '',
      exp.deptApprovedAt || '',
      exp.adminApprover || exp.approver || '',
      exp.adminApprovedAt || exp.approvedAt || '',
      exp.disbursedBy || '',
      exp.disbursedAt || '',
      exp.receiptStatus === 'missing' ? '欠發票' : '齊全',
      `"${(exp.rejectedReason || '').replace(/"/g, '""')}"`,
      `"${(exp.remark || '').replace(/"/g, '""')}"`,
    ];
  });

  const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * 匯出費用明細為 Excel (.xlsx) 格式
 */
export function exportToExcel(
  expenses: ExpenseItem[],
  projectsOrFilename: Project[] | string = '邦捷企業費用報支總表.xlsx',
  filename = '邦捷企業費用報支總表.xlsx'
) {
  const projects: Project[] = Array.isArray(projectsOrFilename) ? projectsOrFilename : [];
  const actualFilename: string = typeof projectsOrFilename === 'string' ? projectsOrFilename : filename;

  const statusMap: Record<string, string> = {
    draft: '草稿',
    submitted: '1.待部門審核',
    dept_approved: '2.部門已審核(待最高管理)',
    admin_approved: '3.最高管理已核准(待行政撥款)',
    approved: '3.最高管理已核准(待行政撥款)',
    paid: '已結案撥款',
    rejected: '已退件駁回',
  };

  // 工作表 1：費用報銷明細表
  const detailData = expenses.map((exp, idx) => {
    const fee = Number(exp.fee || 0);
    const amount = Number(exp.amount || 0);
    const total = Number(exp.totalAmount || (amount + fee));

    return {
      '項次': exp.itemNo || idx + 1,
      '請款月份': exp.claimMonth,
      '日期': exp.date,
      '申請人': exp.applicant,
      '所屬部門': exp.applicantDepartment || '',
      '公司別': exp.companyName,
      '專案名稱': exp.projectName,
      '說明摘要': exp.description,
      '會計科目': exp.categoryName,
      '幣別': exp.currency || 'TWD',
      '原幣金額': exp.foreignAmount || exp.amount,
      '費用金額(TWD)': amount,
      '手續費(TWD)': fee,
      '合計金額(TWD)': total,
      '三階審核進度': statusMap[exp.status] || exp.status,
      '部門主管審核人': exp.deptApprover || '',
      '部門審核時間': exp.deptApprovedAt || '',
      '最高管理核准人': exp.adminApprover || exp.approver || '',
      '最高核准時間': exp.adminApprovedAt || exp.approvedAt || '',
      '行政撥款出納': exp.disbursedBy || '',
      '撥款完成時間': exp.disbursedAt || '',
      '發票狀態': exp.receiptStatus === 'missing' ? '欠發票' : '附發票/收據',
      '退件駁回原因': exp.rejectedReason || '',
      '備註說明': exp.remark || '',
    };
  });

  // 工作表 2：每月科目支出統計
  const monthMap = new Map<string, Record<string, number>>();
  const categories = Array.from(new Set(expenses.map(e => e.categoryName)));

  expenses.forEach(exp => {
    const month = exp.claimMonth;
    const total = Number(exp.totalAmount || (exp.amount + (exp.fee || 0)));
    if (!monthMap.has(month)) {
      monthMap.set(month, { 總計: 0 });
    }
    const record = monthMap.get(month)!;
    record[exp.categoryName] = (record[exp.categoryName] || 0) + total;
    record['總計'] += total;
  });

  const summaryData = Array.from(monthMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, stats]) => {
      const row: Record<string, any> = { '請款月份': month };
      categories.forEach(cat => {
        row[cat] = stats[cat] || 0;
      });
      row['月份總計(TWD)'] = stats['總計'];
      return row;
    });

  // 工作表 3：專案預算執行狀況表
  const projectSpending = new Map<string, number>();
  expenses.forEach(exp => {
    projectSpending.set(exp.projectName, (projectSpending.get(exp.projectName) || 0) + exp.amount);
  });

  const projectBudgetReport = projects.map(proj => {
    const spent = projectSpending.get(proj.name) || 0;
    const remaining = proj.budgetLimit - spent;
    const usagePercent = proj.budgetLimit > 0 ? (spent / proj.budgetLimit) * 100 : 0;
    let statusText = '正常';
    if (usagePercent > 100) statusText = '🚨 嚴重超支';
    else if (usagePercent >= proj.warningThreshold) statusText = '⚠️ 預算預警(>80%)';

    return {
      '專案代碼': proj.code,
      '專案名稱': proj.name,
      '負責人': proj.manager,
      '預算上限(TWD)': proj.budgetLimit,
      '已支出金額(TWD)': spent,
      '剩餘預算(TWD)': remaining,
      '預算使用率(%)': `${usagePercent.toFixed(1)}%`,
      '預警狀態': statusText,
    };
  });

  const wb = XLSX.utils.book_new();

  const wsDetail = XLSX.utils.json_to_sheet(detailData);
  const wsSummary = XLSX.utils.json_to_sheet(summaryData);
  const wsProjects = XLSX.utils.json_to_sheet(projectBudgetReport);

  // 設定欄寬
  wsDetail['!cols'] = [
    { wch: 8 }, { wch: 10 }, { wch: 12 }, { wch: 10 }, { wch: 14 },
    { wch: 28 }, { wch: 35 }, { wch: 14 }, { wch: 8 }, { wch: 12 },
    { wch: 14 }, { wch: 10 }, { wch: 12 }, { wch: 24 }
  ];

  XLSX.utils.book_append_sheet(wb, wsDetail, '費用報支明細');
  XLSX.utils.book_append_sheet(wb, wsSummary, '月度科目統計');
  XLSX.utils.book_append_sheet(wb, wsProjects, '專案預算監控');

  XLSX.writeFile(wb, actualFilename);
}

/**
 * 解析匯入的 CSV 或 Excel 檔案
 */
export async function parseImportFile(file: File): Promise<Partial<ExpenseItem>[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const rawJson: any[] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        if (rawJson.length < 2) {
          throw new Error('匯入檔案內容為空或無有效資料列');
        }

        // 尋找標題列
        let headerRowIndex = 0;
        for (let i = 0; i < Math.min(rawJson.length, 10); i++) {
          const row = rawJson[i];
          if (Array.isArray(row) && row.some(cell => typeof cell === 'string' && (cell.includes('日期') || cell.includes('申請人') || cell.includes('費用') || cell.includes('科目')))) {
            headerRowIndex = i;
            break;
          }
        }

        const headers: string[] = rawJson[headerRowIndex].map((h: any) => String(h || '').trim());
        const result: Partial<ExpenseItem>[] = [];

        // 欄位索引判定
        const colMonth = headers.findIndex(h => h.includes('月份') || h.includes('請款月份'));
        const colDate = headers.findIndex(h => h.includes('日期'));
        const colApplicant = headers.findIndex(h => h.includes('申請人') || h.includes('人員'));
        const colCompany = headers.findIndex(h => h.includes('公司'));
        const colProject = headers.findIndex(h => h.includes('專案'));
        const colDesc = headers.findIndex(h => h.includes('說明') || h.includes('摘要'));
        const colCategory = headers.findIndex(h => h.includes('科目'));
        const colAmount = headers.findIndex(h => h.includes('費用') || h.includes('金額'));
        const colRemark = headers.findIndex(h => h.includes('備註'));

        for (let i = headerRowIndex + 1; i < rawJson.length; i++) {
          const row = rawJson[i];
          if (!row || row.length === 0 || !row[colAmount >= 0 ? colAmount : 8]) continue;

          const rawAmount = String(row[colAmount >= 0 ? colAmount : 8] || '').replace(/[$,]/g, '').trim();
          const amountNum = parseFloat(rawAmount);
          if (isNaN(amountNum) || amountNum <= 0) continue;

          const claimMonth = colMonth >= 0 ? String(row[colMonth] || '').trim() : '202608';
          const rawDate = colDate >= 0 ? String(row[colDate] || '').trim() : '';
          const applicant = colApplicant >= 0 ? String(row[colApplicant] || 'Andy').trim() : 'Andy';
          const companyName = colCompany >= 0 ? String(row[colCompany] || '邦捷總公司').trim() : '邦捷總公司';
          const projectName = colProject >= 0 ? String(row[colProject] || '邦捷公司費用報銷').trim() : '邦捷公司費用報銷';
          const description = colDesc >= 0 ? String(row[colDesc] || '未填寫說明').trim() : '未填寫說明';
          const categoryName = colCategory >= 0 ? String(row[colCategory] || '雜項購置').trim() : '雜項購置';
          const remark = colRemark >= 0 ? String(row[colRemark] || '').trim() : '';

          result.push({
            claimMonth: claimMonth || '202608',
            date: rawDate.includes('-') ? rawDate : `2026-${rawDate.replace('/', '-')}`,
            applicant,
            companyName,
            projectName,
            description,
            categoryName,
            amount: amountNum,
            currency: 'TWD',
            remark,
            status: 'submitted',
          });
        }

        resolve(result);
      } catch (err: any) {
        reject(new Error(`解析檔案失敗: ${err.message}`));
      }
    };

    reader.onerror = () => reject(new Error('讀取檔案出錯'));
    reader.readAsArrayBuffer(file);
  });
}

/**
 * 格式化台幣或外幣金額
 */
export function formatMoney(amount: number, currency: string = 'TWD'): string {
  if (amount === undefined || amount === null || isNaN(amount)) return '0';
  const formatted = Math.round(amount).toLocaleString('zh-TW');
  switch (currency) {
    case 'USD':
      return `$${formatted}`;
    case 'JPY':
      return `¥${formatted}`;
    case 'RMB':
      return `¥${formatted}`;
    case 'EUR':
      return `€${formatted}`;
    case 'TWD':
    default:
      return `NT$ ${formatted}`;
  }
}
