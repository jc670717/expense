import React, { useState, useEffect } from 'react';
import { 
  X, 
  AlertTriangle, 
  Calculator, 
  CheckCircle2, 
  Upload, 
  DollarSign, 
  Info,
  Sparkles,
  ShieldAlert,
  Trash2
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

  // 根據職位過濾出允許該職位選取的會計科目
  const availableCategories = categories.filter(cat => {
    if (!cat.roleLimits) return true;
    const limit = cat.roleLimits[userPos];
    return limit ? limit.allowed : true;
  });

  // 表單狀態
  const [claimMonth, setClaimMonth] = useState(editingExpense?.claimMonth || '202608');
  const [date, setDate] = useState(editingExpense?.date || new Date().toISOString().split('T')[0]);
  const [applicant, setApplicant] = useState(editingExpense?.applicant || currentUser.name);
  const [companyName, setCompanyName] = useState(editingExpense?.companyName || companies[0]?.name || '邦捷總公司');
  const [projectName, setProjectName] = useState(editingExpense?.projectName || projects[0]?.name || '金廈(泉)票務系統暨服務採購案');
  const [description, setDescription] = useState(editingExpense?.description || '');
  const [categoryName, setCategoryName] = useState(
    editingExpense?.categoryName || availableCategories[0]?.name || categories[0]?.name || '住宿／車資'
  );
  const [currency, setCurrency] = useState<'TWD' | 'USD' | 'JPY' | 'RMB' | 'EUR'>(editingExpense?.currency || 'TWD');
  const [foreignAmount, setForeignAmount] = useState<string>(editingExpense?.foreignAmount ? String(editingExpense.foreignAmount) : '');
  const [amount, setAmount] = useState<string>(editingExpense?.amount ? String(editingExpense.amount) : '');
  const [invoiceNo, setInvoiceNo] = useState(editingExpense?.invoiceNo || '');
  const [receiptStatus, setReceiptStatus] = useState<'attached' | 'missing' | 'receipt_only'>(editingExpense?.receiptStatus || 'attached');
  const [remark, setRemark] = useState(editingExpense?.remark || '');
  const [isConfirmingDelete, setIsConfirmingDelete] = useState<boolean>(false);
  
  // 防呆錯誤訊息
  const [errors, setErrors] = useState<Record<string, string>>({});

  // 取得所選專案當前預算與花費狀況
  const selectedProject = projects.find(p => p.name === projectName);
  const currentProjectSpent = allExpenses
    .filter(e => e.projectName === projectName && e.id !== editingExpense?.id)
    .reduce((sum, e) => sum + e.amount, 0);

  const numAmount = parseFloat(amount) || 0;
  const projectNewTotal = currentProjectSpent + numAmount;
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

  // 表單驗證防呆 (包含職位上限防呆)
  const validate = (): boolean => {
    const err: Record<string, string> = {};

    if (!claimMonth.trim()) {
      err.claimMonth = '請款月份為必填（格式如 202608）';
    } else if (!/^\d{4}\d{2}(-?\d+)?$/.test(claimMonth.trim())) {
      err.claimMonth = '請款月份格式不正確（例如 202608 或 202605-2）';
    }

    if (!date.trim()) {
      err.date = '請選擇發生日期';
    }

    if (!applicant.trim()) {
      err.applicant = '請輸入申請人姓名';
    }

    if (!description.trim()) {
      err.description = '說明摘要為必填項目';
    } else if (description.trim().length < 2) {
      err.description = '說明請填寫具體用途（如：高鐵車票台北至台中）';
    }

    const val = parseFloat(amount);
    if (isNaN(val) || val <= 0) {
      err.amount = '報支費用必須為大於 0 的有效數字';
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

    onSave({
      claimMonth: claimMonth.trim(),
      date: date.trim(),
      applicant: applicant.trim(),
      companyName,
      projectName,
      description: description.trim(),
      categoryName,
      currency,
      foreignAmount: foreignAmount ? parseFloat(foreignAmount) : undefined,
      exchangeRate: currency !== 'TWD' ? rateObj?.rateToTWD : 1.0,
      amount: parseFloat(amount),
      invoiceNo: invoiceNo.trim() || undefined,
      receiptStatus,
      remark: remark.trim() || undefined,
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* 頂部標題 */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-indigo-400" />
            <h3 className="font-bold text-base">
              {editingExpense ? '編輯公務費用報銷單' : '填報日常公務費用'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          
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
                  <span>所選專案：{selectedProject.name}</span>
                  <span>核定預算：{formatMoney(selectedProject.budgetLimit)}</span>
                </div>
                <div className="text-[11px] opacity-90">
                  原累計支出：{formatMoney(currentProjectSpent)} 
                  {numAmount > 0 && ` ➔ 加上本筆後預估：${formatMoney(projectNewTotal)} (${((projectNewTotal / selectedProject.budgetLimit) * 100).toFixed(1)}%)`}
                </div>
                {isOverBudget && (
                  <div className="text-[11px] font-bold text-rose-700">
                    ⚠️ 警示：此筆費用將導致該專案超出合約預算上限，請審核人員特別複核！
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 第一列：請款月份 + 發生日期 + 申請人 */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">請款月份</label>
              <input
                type="text"
                value={claimMonth}
                onChange={(e) => setClaimMonth(e.target.value)}
                placeholder="例如 202608"
                className={`w-full px-3 py-2 rounded-lg border font-mono ${
                  errors.claimMonth ? 'border-rose-500 bg-rose-50/30' : 'border-slate-300'
                } outline-none focus:ring-2 focus:ring-blue-500`}
                required
              />
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
                } outline-none focus:ring-2 focus:ring-blue-500`}
                required
              />
              {errors.date && <p className="text-rose-500 text-[10px] mt-1">{errors.date}</p>}
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">申請人姓名</label>
              {currentUser.role !== 'editor' ? (
                <select
                  value={applicant}
                  onChange={(e) => setApplicant(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 outline-none font-bold text-slate-800"
                >
                  {allUsers.filter(u => u.status === 'active').map(u => (
                    <option key={u.id} value={u.englishName || u.name}>
                      {u.name} ({u.englishName || u.roleTitle})
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
            </div>
          </div>

          {/* 第二列：公司別 + 專案名稱 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">公司別 (法人主體)</label>
              <select
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 outline-none font-bold text-slate-800"
              >
                {companies.map((c) => (
                  <option key={c.id} value={c.name}>{c.name} ({c.taxId})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">專案名稱 (歸屬合約)</label>
              <select
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 outline-none font-bold text-slate-800"
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.name}>{p.name} [{p.code}]</option>
                ))}
              </select>
            </div>
          </div>

          {/* 第三列：說明摘要 */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">說明摘要 (費用用途具體說明)</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="例如：高鐵車票台北至台中來回公務出差、Claude API 訂閱等"
              className={`w-full px-3 py-2 rounded-lg border ${
                errors.description ? 'border-rose-500 bg-rose-50/30' : 'border-slate-300'
              } outline-none focus:ring-2 focus:ring-blue-500`}
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
              className="w-full px-3 py-2 rounded-lg border border-slate-300 outline-none font-bold text-slate-800"
            >
              {availableCategories.map((cat) => (
                <option key={cat.id} value={cat.name}>
                  {cat.name} ({cat.description?.slice(0, 25)}...)
                </option>
              ))}
            </select>
            {errors.category && <p className="text-rose-500 text-[10px] mt-1">{errors.category}</p>}
          </div>

          {/* 第五列：幣別 + 外幣原金額 + 折合台幣金額 */}
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-800 flex items-center gap-1.5">
                <Calculator className="w-4 h-4 text-blue-600" />
                交易幣別與自動匯率折算
              </span>
              <span className="text-[11px] text-slate-500">支援即時匯率換算</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">幣別</label>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white font-bold text-slate-800 outline-none"
                >
                  {currencies.map(c => (
                    <option key={c.currency} value={c.currency}>
                      {c.currency} ({c.name} - 匯率 {c.rateToTWD})
                    </option>
                  ))}
                </select>
              </div>

              {currency !== 'TWD' && (
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    外幣原金額 ({currency})
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={foreignAmount}
                    onChange={(e) => setForeignAmount(e.target.value)}
                    placeholder="例如 10.00"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white font-mono font-bold text-slate-900 outline-none"
                  />
                </div>
              )}

              <div className={currency === 'TWD' ? 'sm:col-span-2' : ''}>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  費用金額 (折合 TWD 新台幣)
                </label>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0"
                  className={`w-full px-3 py-2 rounded-lg border font-mono font-bold text-slate-900 bg-white ${
                    errors.amount ? 'border-rose-500 bg-rose-50/30' : 'border-slate-300'
                  } outline-none focus:ring-2 focus:ring-blue-500 text-sm`}
                  required
                />
                {errors.amount && <p className="text-rose-500 text-[10px] mt-1 font-semibold">{errors.amount}</p>}
              </div>
            </div>
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
                className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">單據檢附狀態</label>
              <select
                value={receiptStatus}
                onChange={(e) => setReceiptStatus(e.target.value as any)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 outline-none font-bold text-slate-800"
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
                placeholder="如 10USD, 手續費等"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 outline-none"
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
                <span>儲存報支單據</span>
              </button>
            </div>
          </div>

        </form>
      </div>
    </div>
  );
};
