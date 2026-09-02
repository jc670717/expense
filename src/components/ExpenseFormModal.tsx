import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, 
  AlertTriangle, 
  Calculator, 
  CheckCircle2, 
  DollarSign, 
  Info,
  Sparkles,
  ShieldAlert,
  Trash2,
  Calendar,
  Layers,
  RotateCcw
} from 'lucide-react';
import { Company, CurrencyRate, ExpenseCategory, ExpenseItem, Project, UserPosition, UserProfile } from '../types';
import { formatMoney } from '../utils/exportUtils';

interface ExpenseFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (expense: Partial<ExpenseItem>) => void;
  onDelete?: (id: string) => void;
  editingExpense?: ExpenseItem | null;
  companies: Company[];
  projects: Project[];
  categories: ExpenseCategory[];
  currencies: CurrencyRate[];
  currentUser: UserProfile;
  allUsers: UserProfile[];
  allExpenses: ExpenseItem[];
}

export const ExpenseFormModal: React.FC<ExpenseFormModalProps> = ({
  isOpen,
  onClose,
  onSave,
  onDelete,
  editingExpense,
  companies,
  projects,
  categories,
  currencies,
  currentUser,
  allUsers,
  allExpenses,
}) => {
  if (!isOpen) return null;

  // 使用者職位 (最高管理 | 部門管理 | 一般員工)
  const userPos: UserPosition = currentUser.position || (currentUser.role as UserPosition) || 'editor';
  const isPrivileged = currentUser.role === 'admin' || currentUser.role === 'auditor' || userPos === 'admin' || userPos === 'auditor';

  // 1. 報支費用時，專案僅顯示「進行中」專案 (Requirement 1)
  const activeProjects = useMemo(() => {
    return projects.filter(p => p.status === 'active' || (p.status as string) === '進行中');
  }, [projects]);

  // 如果編輯歷史單據且該專案已結案/中止，為防破版額外補進選單並標註
  const selectableProjects = useMemo(() => {
    if (editingExpense && editingExpense.projectName) {
      const existsInActive = activeProjects.some(p => p.name === editingExpense.projectName);
      if (!existsInActive) {
        const matched = projects.find(p => p.name === editingExpense.projectName);
        if (matched) {
          return [matched, ...activeProjects];
        }
      }
    }
    return activeProjects;
  }, [activeProjects, editingExpense, projects]);

  // 根據職位過濾出允許該職位選取的會計科目
  const availableCategories = categories.filter(cat => {
    if (!cat.roleLimits) return true;
    const limit = cat.roleLimits[userPos];
    return limit ? limit.allowed : true;
  });

  // 3. 請款月份下拉選項：管理者/主管顯示本月及前12個月(共13月)，一般使用者顯示本月及前2個月(共3月) (Requirement 3)
  const monthOptions = useMemo(() => {
    const now = new Date();
    const monthsCount = isPrivileged ? 13 : 3; // 一般使用者：本月份及之前2個月 (3個月)；管理者：本月份及之前12個月 (13個月)
    const list: { value: string; label: string }[] = [];

    for (let i = 0; i < monthsCount; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const year = d.getFullYear();
      const monthNum = String(d.getMonth() + 1).padStart(2, '0');
      const val = `${year}${monthNum}`;
      const label = `${year}/${monthNum} (${year}年${monthNum}月)${i === 0 ? ' [當月]' : ''}`;
      list.push({ value: val, label });
    }

    // 若正在編輯的單據月份不在當前清單內，補入選單以免無法顯示
    if (editingExpense?.claimMonth && !list.some(m => m.value === editingExpense.claimMonth)) {
      list.push({
        value: editingExpense.claimMonth,
        label: `${editingExpense.claimMonth} (歷史月份)`
      });
    }

    return list;
  }, [isPrivileged, editingExpense]);

  // 表單狀態
  // Requirement 2: 點選新增費用報支時，管理者/主管預設為登入者本人 (currentUser.name)
  const defaultApplicantName = editingExpense?.applicant || currentUser.name;
  
  const [claimMonth, setClaimMonth] = useState<string>(
    editingExpense?.claimMonth || monthOptions[0]?.value || '202609'
  );
  const [date, setDate] = useState<string>(
    editingExpense?.date || new Date().toISOString().split('T')[0]
  );
  const [applicant, setApplicant] = useState<string>(defaultApplicantName);
  const [companyName, setCompanyName] = useState<string>(
    editingExpense?.companyName || companies[0]?.name || '邦捷總公司'
  );
  const [projectName, setProjectName] = useState<string>(
    editingExpense?.projectName || selectableProjects[0]?.name || '金廈(泉)票務系統暨服務採購案'
  );
  const [description, setDescription] = useState<string>(editingExpense?.description || '');
  const [categoryName, setCategoryName] = useState<string>(
    editingExpense?.categoryName || availableCategories[0]?.name || categories[0]?.name || '住宿／車資'
  );
  const [currency, setCurrency] = useState<string>(editingExpense?.currency || 'TWD');
  const [foreignAmount, setForeignAmount] = useState<string>(
    editingExpense?.foreignAmount ? String(editingExpense.foreignAmount) : ''
  );
  const [amount, setAmount] = useState<string>(
    editingExpense?.amount !== undefined ? String(editingExpense.amount) : ''
  );
  // Requirement 4: 手續費欄位，預設為 0
  const [fee, setFee] = useState<string>(
    editingExpense?.fee !== undefined ? String(editingExpense.fee) : '0'
  );
  const [invoiceNo, setInvoiceNo] = useState<string>(editingExpense?.invoiceNo || '');
  const [receiptStatus, setReceiptStatus] = useState<'attached' | 'missing' | 'receipt_only'>(
    editingExpense?.receiptStatus || 'attached'
  );
  const [remark, setRemark] = useState<string>(editingExpense?.remark || '');
  const [isConfirmingDelete, setIsConfirmingDelete] = useState<boolean>(false);
  
  // 防呆錯誤訊息
  const [errors, setErrors] = useState<Record<string, string>>({});

  // 取得所選專案當前預算與花費狀況
  const selectedProject = projects.find(p => p.name === projectName);
  const currentProjectSpent = allExpenses
    .filter(e => e.projectName === projectName && e.id !== editingExpense?.id)
    .reduce((sum, e) => sum + e.amount, 0);

  const numAmount = parseFloat(amount) || 0;
  const numFee = parseFloat(fee) || 0;
  // Requirement 4: 合計金額不可變更，即手續費加上費用金額 (含外幣折合台幣)
  const totalAmount = Math.round((numAmount + numFee) * 100) / 100;

  const projectNewTotal = currentProjectSpent + totalAmount;
  const projectBudgetLimit = selectedProject?.budgetLimit || 0;
  const isOverBudget = projectBudgetLimit > 0 && projectNewTotal > projectBudgetLimit;
  const isNearBudget = projectBudgetLimit > 0 && !isOverBudget && (projectNewTotal / projectBudgetLimit) * 100 >= (selectedProject?.warningThreshold || 80);

  // 取得所選科目的職位上限防呆規則
  const selectedCatObj = categories.find(c => c.name === categoryName);
  const userCatLimit = selectedCatObj?.roleLimits ? selectedCatObj.roleLimits[userPos] : null;
  const maxLimitForUser = userCatLimit?.maxLimit || selectedCatObj?.maxPerItem || 0;

  // 當幣別或外幣金額改變時，自動換算台幣金額
  useEffect(() => {
    if (currency !== 'TWD' && foreignAmount) {
      const fVal = parseFloat(foreignAmount);
      if (!isNaN(fVal) && fVal > 0) {
        const rateObj = currencies.find(c => c.currency === currency);
        const rate = rateObj?.rateToTWD || 1;
        const converted = Math.round(fVal * rate);
        setAmount(String(converted));
        if (!remark.includes(currency)) {
          setRemark(`${currency} ${fVal} (匯率 ${rate})`);
        }
      }
    }
  }, [currency, foreignAmount, currencies]);

  // 表單驗證防呆
  const validate = (): boolean => {
    const err: Record<string, string> = {};

    if (!claimMonth.trim()) {
      err.claimMonth = '請選擇請款月份';
    }

    if (!date.trim()) {
      err.date = '請選擇發生日期';
    }

    if (!applicant.trim()) {
      err.applicant = '請選擇或輸入申請人姓名';
    }

    if (!projectName.trim()) {
      err.projectName = '請選擇進行中的歸屬專案';
    }

    if (!description.trim()) {
      err.description = '說明摘要為必填項目';
    } else if (description.trim().length < 2) {
      err.description = '說明請填寫具體用途（如：高鐵車票台北至台中）';
    }

    const val = parseFloat(amount);
    if (isNaN(val) || val <= 0) {
      err.amount = '費用金額必須為大於 0 的有效數字';
    }

    const feeVal = parseFloat(fee);
    if (isNaN(feeVal) || feeVal < 0) {
      err.fee = '手續費不得小於 0';
    }

    // 職位科目上限防呆檢驗
    if (selectedCatObj) {
      if (userCatLimit && !userCatLimit.allowed) {
        err.category = `您的職位【${currentUser.roleTitle || userPos}】依公司財務規定不可報支「${categoryName}」`;
      } else if (maxLimitForUser > 0 && val > maxLimitForUser) {
        err.amount = `您目前的職位報支「${categoryName}」單筆上限為 NT$ ${maxLimitForUser.toLocaleString()}，當前金額已超出門檻！`;
      }
    }

    setErrors(err);
    return Object.keys(err).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    const rateObj = currencies.find(c => c.currency === currency);
    const applicantUser = allUsers.find(u => u.name === applicant || u.englishName === applicant);

    onSave({
      claimMonth: claimMonth.trim(),
      date: date.trim(),
      applicant: applicant.trim(),
      applicantId: applicantUser?.id,
      applicantDepartment: applicantUser?.department || currentUser.department,
      companyName,
      projectName,
      description: description.trim(),
      categoryName,
      currency,
      foreignAmount: foreignAmount ? parseFloat(foreignAmount) : undefined,
      exchangeRate: currency !== 'TWD' ? rateObj?.rateToTWD : 1.0,
      amount: parseFloat(amount),
      fee: parseFloat(fee) || 0,
      totalAmount: totalAmount,
      invoiceNo: invoiceNo.trim() || undefined,
      receiptStatus,
      remark: remark.trim() || undefined,
    });

    onClose();
  };

  const isRejectedExpense = editingExpense?.status === 'rejected';

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* 頂部標題 */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-indigo-400" />
            <div>
              <h3 className="font-bold text-base">
                {editingExpense ? '編輯公務費用報銷單' : '填報日常公務費用'}
              </h3>
              <p className="text-[11px] text-slate-300">
                依據公司內控規範填寫，支援多幣別自動換算與三階段嚴謹審批流程
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          
          {/* Requirement 6 提示：駁回單據重新送審說明 */}
          {isRejectedExpense && (
            <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl flex items-start gap-2.5 text-amber-900 animate-in fade-in">
              <RotateCcw className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <div className="font-bold text-xs flex items-center gap-1.5">
                  <span>此單據先前已被退件駁回</span>
                  {editingExpense.rejectedReason && (
                    <span className="font-normal text-[11px] bg-amber-200/70 text-amber-950 px-2 py-0.5 rounded">
                      駁回原因：{editingExpense.rejectedReason}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-amber-800">
                  💡 修正內容並點擊「儲存報支單據」後，系統將<strong>自動清除駁回原因</strong>，並自動轉為<strong>重新送審（第一階段：待部門主管審核）</strong>。
                </p>
              </div>
            </div>
          )}

          {/* 專案預算即時警示條 (若超支或接近門檻) */}
          {selectedProject && (
            <div className={`p-3 rounded-xl border flex items-start gap-2.5 ${
              isOverBudget 
                ? 'bg-rose-50 border-rose-200 text-rose-800' 
                : isNearBudget 
                ? 'bg-amber-50 border-amber-200 text-amber-800' 
                : 'bg-slate-50 border-slate-200 text-slate-600'
            }`}>
              <AlertTriangle className={`w-4 h-4 shrink-0 mt-0.5 ${
                isOverBudget ? 'text-rose-600' : isNearBudget ? 'text-amber-600' : 'text-slate-400'
              }`} />
              <div className="space-y-0.5 flex-1">
                <div className="font-bold flex items-center justify-between">
                  <span>所屬專案：{selectedProject.name}</span>
                  <span>專案核定預算：{formatMoney(selectedProject.budgetLimit)}</span>
                </div>
                <div className="text-[11px] opacity-90">
                  專案累計已報支：{formatMoney(currentProjectSpent)} 
                  {totalAmount > 0 && ` ➔ 加上本筆合計後預估：${formatMoney(projectNewTotal)} (${((projectNewTotal / selectedProject.budgetLimit) * 100).toFixed(1)}%)`}
                </div>
                {isOverBudget && (
                  <div className="text-[11px] font-bold text-rose-700">
                    ⚠️ 警示：此筆費用將使專案超出核定預算，送出後將標註請各級主管特別複核！
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 第一列：請款月份 (下拉) + 發生日期 + 申請人姓名 (預設登入者本人) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Requirement 3: 請款月份改為下拉 */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1 flex items-center justify-between">
                <span>請款月份 (年/月)</span>
                <span className="text-[10px] text-slate-400 font-normal">
                  {isPrivileged ? '開放前12個月' : '開放前2個月'}
                </span>
              </label>
              <select
                value={claimMonth}
                onChange={(e) => setClaimMonth(e.target.value)}
                className={`w-full px-3 py-2 rounded-lg border font-mono font-bold text-slate-800 bg-white ${
                  errors.claimMonth ? 'border-rose-500 bg-rose-50/30' : 'border-slate-300'
                } outline-none focus:ring-2 focus:ring-indigo-500`}
              >
                {monthOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              {errors.claimMonth && <p className="text-rose-500 text-[10px] mt-1">{errors.claimMonth}</p>}
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">發生日期</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className={`w-full px-3 py-2 rounded-lg border font-mono ${
                  errors.date ? 'border-rose-500 bg-rose-50/30' : 'border-slate-300'
                } outline-none focus:ring-2 focus:ring-indigo-500 bg-white`}
                required
              />
              {errors.date && <p className="text-rose-500 text-[10px] mt-1">{errors.date}</p>}
            </div>

            {/* Requirement 2: 管理者與主管預設為登入者本人 */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1 flex items-center justify-between">
                <span>申請人姓名</span>
                <span className="text-[10px] text-indigo-600 font-normal">
                  預設為登入者
                </span>
              </label>
              {isPrivileged ? (
                <select
                  value={applicant}
                  onChange={(e) => setApplicant(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 outline-none font-bold text-slate-800 bg-white focus:ring-2 focus:ring-indigo-500"
                >
                  {allUsers.filter(u => u.status === 'active').map(u => (
                    <option key={u.id} value={u.name}>
                      {u.name} ({u.roleTitle || u.department || u.englishName})
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={applicant}
                  readOnly
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-100 font-bold text-slate-800 cursor-not-allowed"
                />
              )}
              {errors.applicant && <p className="text-rose-500 text-[10px] mt-1">{errors.applicant}</p>}
            </div>
          </div>

          {/* 第二列：公司別 + 專案名稱 (僅顯示進行中專案) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">公司別 (法人主體)</label>
              <select
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 outline-none font-bold text-slate-800 bg-white focus:ring-2 focus:ring-indigo-500"
              >
                {companies.map((c) => (
                  <option key={c.id} value={c.name}>{c.name} ({c.taxId})</option>
                ))}
              </select>
            </div>

            {/* Requirement 1: 專案非進行中不顯示在下拉選單 */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1 flex items-center justify-between">
                <span>歸屬專案</span>
                <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-1.5 py-0.2 rounded">
                  僅列進行中專案 ({activeProjects.length})
                </span>
              </label>
              <select
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                className={`w-full px-3 py-2 rounded-lg border font-bold text-slate-800 bg-white ${
                  errors.projectName ? 'border-rose-500 bg-rose-50/30' : 'border-slate-300'
                } outline-none focus:ring-2 focus:ring-indigo-500`}
              >
                {selectableProjects.length === 0 ? (
                  <option value="">(目前無進行中專案)</option>
                ) : (
                  selectableProjects.map((p) => {
                    const isInactive = p.status !== 'active' && (p.status as string) !== '進行中';
                    return (
                      <option key={p.id} value={p.name}>
                        {p.name} [{p.code}] {isInactive ? ' (非進行中/歷史)' : ''}
                      </option>
                    );
                  })
                )}
              </select>
              {errors.projectName && <p className="text-rose-500 text-[10px] mt-1">{errors.projectName}</p>}
            </div>
          </div>

          {/* 第三列：說明摘要 */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">說明摘要 (費用用途具體說明)</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="例如：高鐵車票台北至台中來回公務出差、Claude API 訂閱、小三通差旅交通等"
              className={`w-full px-3 py-2 rounded-lg border ${
                errors.description ? 'border-rose-500 bg-rose-50/30' : 'border-slate-300'
              } outline-none focus:ring-2 focus:ring-indigo-500 bg-white`}
              required
            />
            {errors.description && <p className="text-rose-500 text-[10px] mt-1">{errors.description}</p>}
          </div>

          {/* 第四列：會計科目 (依職位過濾) + 職位上限提示 */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block font-semibold text-slate-700">會計科目</label>
              {maxLimitForUser > 0 ? (
                <span className="text-[11px] text-indigo-600 font-bold">
                  您職位單筆上限：NT$ {maxLimitForUser.toLocaleString()}
                </span>
              ) : (
                <span className="text-[11px] text-slate-400">此科目無上限限制</span>
              )}
            </div>
            <select
              value={categoryName}
              onChange={(e) => setCategoryName(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 outline-none font-bold text-slate-800 bg-white focus:ring-2 focus:ring-indigo-500"
            >
              {availableCategories.map((cat) => (
                <option key={cat.id} value={cat.name}>
                  {cat.name} ({cat.description?.slice(0, 25)}...)
                </option>
              ))}
            </select>
            {errors.category && <p className="text-rose-500 text-[10px] mt-1">{errors.category}</p>}
          </div>

          {/* 第五列：Requirement 4 多幣別折算 + 費用金額 + 手續費 + 合計金額 */}
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-800 flex items-center gap-1.5 text-xs">
                <Calculator className="w-4 h-4 text-indigo-600" />
                金額計算與手續費核算 (含外幣折算)
              </span>
              <span className="text-[11px] text-slate-500">合計金額 = 費用金額 + 手續費</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
              {/* 幣別 */}
              <div className="sm:col-span-3">
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">交易幣別</label>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="w-full px-2.5 py-2 rounded-lg border border-slate-300 bg-white font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {currencies.map(c => (
                    <option key={c.currency} value={c.currency}>
                      {c.currency} ({c.name} 匯率:{c.rateToTWD})
                    </option>
                  ))}
                </select>
              </div>

              {/* 外幣原金額 */}
              {currency !== 'TWD' ? (
                <div className="sm:col-span-3">
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    原幣金額 ({currency})
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={foreignAmount}
                    onChange={(e) => setForeignAmount(e.target.value)}
                    placeholder="例如 10.00"
                    className="w-full px-2.5 py-2 rounded-lg border border-slate-300 bg-white font-mono font-bold text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              ) : null}

              {/* 費用金額 (TWD) */}
              <div className={currency !== 'TWD' ? 'sm:col-span-3' : 'sm:col-span-4'}>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  費用金額 (TWD 折合)
                </label>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0"
                  className={`w-full px-2.5 py-2 rounded-lg border font-mono font-bold text-slate-900 bg-white ${
                    errors.amount ? 'border-rose-500 bg-rose-50/30' : 'border-slate-300'
                  } outline-none focus:ring-2 focus:ring-indigo-500`}
                  required
                />
                {errors.amount && <p className="text-rose-500 text-[10px] mt-1 font-semibold">{errors.amount}</p>}
              </div>

              {/* Requirement 4: 手續費 (預設為 0) */}
              <div className={currency !== 'TWD' ? 'sm:col-span-3' : 'sm:col-span-2'}>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  手續費 (TWD)
                </label>
                <input
                  type="number"
                  step="1"
                  min="0"
                  value={fee}
                  onChange={(e) => setFee(e.target.value)}
                  placeholder="0"
                  className={`w-full px-2.5 py-2 rounded-lg border font-mono font-bold text-slate-900 bg-white ${
                    errors.fee ? 'border-rose-500 bg-rose-50/30' : 'border-slate-300'
                  } outline-none focus:ring-2 focus:ring-indigo-500`}
                />
                {errors.fee && <p className="text-rose-500 text-[10px] mt-1 font-semibold">{errors.fee}</p>}
              </div>

              {/* Requirement 4: 合計金額 (不可變更，手續費加上費用金額) */}
              <div className="sm:col-span-3">
                <label className="block text-[11px] font-bold text-indigo-900 mb-1 flex items-center justify-between">
                  <span>合計金額 (不可變更)</span>
                  <span className="text-[10px] bg-indigo-100 text-indigo-700 px-1 rounded">自動加總</span>
                </label>
                <input
                  type="text"
                  value={`NT$ ${totalAmount.toLocaleString()}`}
                  readOnly
                  disabled
                  className="w-full px-2.5 py-2 rounded-lg border border-indigo-200 bg-indigo-50/80 font-mono font-black text-indigo-950 text-sm cursor-not-allowed select-none"
                />
              </div>
            </div>

            {/* 外幣換算及手續費總結資訊條 */}
            {currency !== 'TWD' && foreignAmount && (
              <div className="p-2 bg-white rounded-lg border border-slate-200 text-[11px] text-slate-600 flex items-center justify-between font-mono">
                <span>外幣原額：{currency} {foreignAmount} ➔ 折算台幣 NT$ {numAmount.toLocaleString()}</span>
                <span className="font-bold text-indigo-700">+ 手續費 NT$ {numFee.toLocaleString()} = 合計 NT$ {totalAmount.toLocaleString()}</span>
              </div>
            )}
          </div>

          {/* 第六列：發票號碼 + 發票狀態 + 備註 */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">發票／收據號碼</label>
              <input
                type="text"
                value={invoiceNo}
                onChange={(e) => setInvoiceNo(e.target.value)}
                placeholder="例如 AB-12345678"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono outline-none bg-white focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">單據檢附狀態</label>
              <select
                value={receiptStatus}
                onChange={(e) => setReceiptStatus(e.target.value as any)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 outline-none font-bold text-slate-800 bg-white focus:ring-2 focus:ring-indigo-500"
              >
                <option value="attached">發票/收據齊全 (Attached)</option>
                <option value="missing">⚠️ 欠發票 (Missing Receipt)</option>
                <option value="receipt_only">免用統一發票收據 (Receipt Only)</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">備註說明</label>
              <input
                type="text"
                value={remark}
                onChange={(e) => setRemark(e.target.value)}
                placeholder="如 10USD、手續費、公務車ETC等"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 outline-none bg-white focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* 底部按鈕 */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-3 border-t border-slate-200">
            {/* 編輯模式下的刪除按鈕 */}
            {editingExpense && onDelete ? (
              <div>
                {!isConfirmingDelete ? (
                  <button
                    type="button"
                    onClick={() => setIsConfirmingDelete(true)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer border border-rose-200"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>刪除此筆單據</span>
                  </button>
                ) : (
                  <div className="inline-flex items-center gap-2 p-1.5 bg-rose-50 border border-rose-300 rounded-xl animate-in fade-in">
                    <span className="text-xs font-bold text-rose-800 px-1">確定刪除？</span>
                    <button
                      type="button"
                      onClick={() => {
                        onDelete(editingExpense.id);
                        onClose();
                      }}
                      className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer"
                    >
                      確認
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsConfirmingDelete(false)}
                      className="px-2 py-1 text-slate-500 hover:text-slate-700 text-xs font-medium cursor-pointer"
                    >
                      取消
                    </button>
                  </div>
                )}
              </div>
            ) : <div />}

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-medium transition-colors cursor-pointer text-sm"
              >
                取消
              </button>
              <button
                type="submit"
                className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white rounded-xl font-bold shadow-md shadow-indigo-500/20 transition-all flex items-center gap-1.5 cursor-pointer text-sm"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{isRejectedExpense ? '重新送審 (送交部門審核)' : '儲存報支單據'}</span>
              </button>
            </div>
          </div>

        </form>
      </div>
    </div>
  );
};
