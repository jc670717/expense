import React, { useState } from 'react';
import { 
  Repeat, 
  Plus, 
  Calendar, 
  Trash2, 
  Edit3, 
  Sparkles, 
  DollarSign,
  AlertCircle
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { Company, CurrencyRate, ExpenseCategory, Project, RecurringExpenseTemplate, UserProfile } from '../types';

interface RecurringExpensesViewProps {
  templates: RecurringExpenseTemplate[];
  currentUser: UserProfile;
  companies: Company[];
  projects: Project[];
  categories: ExpenseCategory[];
  currencies?: CurrencyRate[];
  onSaveTemplate: (template: Partial<RecurringExpenseTemplate>) => void;
  onDeleteTemplate: (id: string) => void;
  onGenerateExpenses: (month: string, selectedTemplateIds: string[], updatedAmounts: Record<string, number>) => void;
  setActiveTab: (tab: string) => void;
}

export const RecurringExpensesView: React.FC<RecurringExpensesViewProps> = ({
  templates = [],
  currentUser,
  companies = [],
  projects = [],
  categories = [],
  onSaveTemplate,
  onDeleteTemplate,
  onGenerateExpenses,
  setActiveTab,
}) => {
  const safeTemplates = Array.isArray(templates) ? templates.filter(t => t && typeof t === 'object' && t.id) : [];
  
  const [generateMonth, setGenerateMonth] = useState<string>(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    return `${y}${m}`;
  });

  const [selectedIds, setSelectedIds] = useState<string[]>(() => {
    return safeTemplates.filter(t => t.active !== false).map(t => t.id);
  });

  const [customAmounts, setCustomAmounts] = useState<Record<string, number>>({});
  const [isCreatingModal, setIsCreatingModal] = useState<boolean>(false);
  const [editingTemplate, setEditingTemplate] = useState<RecurringExpenseTemplate | null>(null);

  // 表單狀態
  const [name, setName] = useState('');
  const [companyName, setCompanyName] = useState(companies[0]?.name || '邦捷總公司');
  const [projectName, setProjectName] = useState(projects[0]?.name || '邦捷公司費用報銷');
  const [categoryName, setCategoryName] = useState(categories[0]?.name || '雜項購置');
  const [applicant, setApplicant] = useState(currentUser?.name || 'Hank');
  const [description, setDescription] = useState('');
  const [defaultCurrency, setDefaultCurrency] = useState<'TWD' | 'USD' | 'JPY' | 'RMB' | 'EUR'>('TWD');
  const [defaultAmount, setDefaultAmount] = useState<number>(300);
  const [remark, setRemark] = useState('');

  const handleOpenCreate = () => {
    setEditingTemplate(null);
    setName('');
    setCompanyName(companies[0]?.name || '邦捷總公司');
    setProjectName(projects[0]?.name || '邦捷公司費用報銷');
    setCategoryName(categories[0]?.name || '雜項購置');
    setApplicant(currentUser?.name || 'Hank');
    setDescription('');
    setDefaultCurrency('TWD');
    setDefaultAmount(300);
    setRemark('');
    setIsCreatingModal(true);
  };

  const handleOpenEdit = (t: RecurringExpenseTemplate) => {
    setEditingTemplate(t);
    setName(t.name || '');
    setCompanyName(t.companyName || companies[0]?.name || '邦捷總公司');
    setProjectName(t.projectName || projects[0]?.name || '邦捷公司費用報銷');
    setCategoryName(t.categoryName || categories[0]?.name || '雜項購置');
    setApplicant(t.applicant || currentUser?.name || 'Hank');
    setDescription(t.description || '');
    setDefaultCurrency(t.defaultCurrency || 'TWD');
    setDefaultAmount(t.defaultAmount || 0);
    setRemark(t.remark || '');
    setIsCreatingModal(true);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !description.trim()) {
      alert('請填寫模板名稱與說明');
      return;
    }

    onSaveTemplate({
      id: editingTemplate?.id,
      name: name.trim(),
      companyName,
      projectName,
      categoryName,
      applicant,
      description: description.trim(),
      defaultCurrency,
      defaultAmount: Number(defaultAmount) || 0,
      remark: remark.trim() || undefined,
      active: true,
    });

    setIsCreatingModal(false);
  };

  const toggleSelectTemplate = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleAmountChange = (id: string, val: number) => {
    setCustomAmounts(prev => ({ ...prev, [id]: val }));
  };

  const handleExecuteGenerate = () => {
    if (selectedIds.length === 0) {
      alert('請先勾選要建立的固定支出項目');
      return;
    }
    if (!generateMonth.trim()) {
      alert('請輸入欲建立的請款月份（例如 202609）');
      return;
    }

    onGenerateExpenses(generateMonth.trim(), selectedIds, customAmounts);

    try {
      confetti({
        particleCount: 70,
        spread: 60,
        origin: { y: 0.6 }
      });
    } catch (e) {}

    setActiveTab('expenses');
  };

  return (
    <div className="space-y-6">
      
      {/* 頂部功能橫幅 */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-900 rounded-2xl p-6 text-white shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-500/30 text-blue-200 border border-blue-400/30">
              記帳效率神器
            </span>
            <span className="text-xs text-slate-300">每月固定訂閱與例行支出一鍵批次套用</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Repeat className="w-6 h-6 text-blue-400" />
            每月固定支出自動建立與模版維護
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-xl">
            針對 GitHub Copilot、Claude AI、雲端主機費、公務車 ETC、電話費等每月週期性支出，免去重複打字，選定月份並快速更新金額即可一鍵生成報銷單！
          </p>
        </div>

        <button
          id="create-recurring-template-btn"
          onClick={handleOpenCreate}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-500 hover:bg-blue-600 text-white text-xs font-bold shadow-md shadow-blue-500/20 transition-all hover:scale-105 shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          新增固定支出模版
        </button>
      </div>

      {/* 一鍵生成控制台 */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-blue-600" />
              一鍵自動生成當月固定報銷單
            </h3>
            <p className="text-xs text-slate-500">
              勾選下列固定項目，並可在右側直接調整本月實際發生金額，點選生成後自動加入費用清單。
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-700">目標請款月份：</span>
              <input
                type="text"
                value={generateMonth}
                onChange={(e) => setGenerateMonth(e.target.value)}
                placeholder="例如 202609"
                className="px-3 py-1.5 rounded-xl border border-slate-300 font-mono font-bold text-xs w-28 focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            <button
              id="execute-generate-recurring-btn"
              onClick={handleExecuteGenerate}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-500/20 transition-all hover:scale-[1.02] flex items-center gap-1.5 cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              一鍵生成所選 {selectedIds.length} 筆
            </button>
          </div>
        </div>

        {/* 固定支出項目清單 */}
        {safeTemplates.length === 0 ? (
          <div className="py-12 text-center text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
            <AlertCircle className="w-8 h-8 mx-auto mb-2 text-slate-300" />
            <p className="text-sm font-medium">目前尚無固定支出模版</p>
            <p className="text-xs text-slate-400 mt-1">點擊右上角「新增固定支出模版」建立您的第一筆每月例行支出</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 pt-1">
            {safeTemplates.map((tmpl) => {
              const isSelected = selectedIds.includes(tmpl.id);
              const currentAmount = customAmounts[tmpl.id] !== undefined ? customAmounts[tmpl.id] : tmpl.defaultAmount;

              return (
                <div
                  key={tmpl.id}
                  className={`p-4 rounded-xl border transition-all ${
                    isSelected 
                      ? 'bg-blue-50/30 border-blue-300 ring-1 ring-blue-200 shadow-2xs' 
                      : 'bg-slate-50/60 border-slate-200 opacity-80'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelectTemplate(tmpl.id)}
                        className="rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                      />
                      <span className="font-bold text-xs text-slate-900 truncate max-w-[180px]">
                        {tmpl.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleOpenEdit(tmpl)}
                        className="p-1 text-slate-400 hover:text-blue-600 rounded cursor-pointer"
                        title="編輯模版"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`確定要刪除「${tmpl.name}」模版嗎？`)) {
                            onDeleteTemplate(tmpl.id);
                          }
                        }}
                        className="p-1 text-slate-400 hover:text-red-600 rounded cursor-pointer"
                        title="刪除模版"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <p className="text-xs text-slate-600 mb-2.5 line-clamp-1">
                    {tmpl.description}
                  </p>

                  <div className="space-y-1 text-[11px] text-slate-500 mb-3 bg-white p-2.5 rounded-lg border border-slate-100">
                    <div className="flex justify-between">
                      <span>申請人：<strong>{tmpl.applicant}</strong></span>
                      <span>科目：<strong>{tmpl.categoryName}</strong></span>
                    </div>
                    <div className="flex justify-between">
                      <span>專案：<strong className="truncate max-w-[120px]">{tmpl.projectName}</strong></span>
                      <span>公司：<strong>{tmpl.companyName}</strong></span>
                    </div>
                  </div>

                  {/* 金額快速 update 欄位 */}
                  <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 text-xs">
                    <span className="text-[11px] font-medium text-slate-600">本月金額：</span>
                    <div className="flex items-center gap-1">
                      <span className="text-slate-400 font-mono text-[11px]">{tmpl.defaultCurrency || 'TWD'}</span>
                      <input
                        type="number"
                        value={currentAmount}
                        onChange={(e) => handleAmountChange(tmpl.id, parseFloat(e.target.value) || 0)}
                        className="w-24 px-2 py-1 rounded-lg border border-slate-300 bg-white font-bold text-right text-slate-900 focus:ring-1 focus:ring-blue-500 outline-none"
                      />
                    </div>
                  </div>

                </div>
              );
            })}
          </div>
        )}

      </div>

      {/* 新增/編輯模版彈窗 */}
      {isCreatingModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <h3 className="font-bold text-base">
                {editingTemplate ? '編輯固定支出模版' : '新增每月固定支出模版'}
              </h3>
              <button
                onClick={() => setIsCreatingModal(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="p-6 space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">模版識別名稱</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="例如：GitHub Copilot 程式輔助訂閱"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">歸屬公司</label>
                  <select
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 outline-none"
                  >
                    {companies.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">歸屬專案</label>
                  <select
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 outline-none"
                  >
                    {projects.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">會計科目</label>
                  <select
                    value={categoryName}
                    onChange={(e) => setCategoryName(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 outline-none"
                  >
                    {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">申請人</label>
                  <input
                    type="text"
                    value={applicant}
                    onChange={(e) => setApplicant(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 outline-none"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">說明摘要</label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="例如：GitHub Copilot 每月訂閱費"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">預設幣別</label>
                  <select
                    value={defaultCurrency}
                    onChange={(e) => setDefaultCurrency(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 outline-none"
                  >
                    <option value="TWD">TWD (新台幣)</option>
                    <option value="USD">USD (美元)</option>
                    <option value="JPY">JPY (日圓)</option>
                    <option value="RMB">RMB (人民幣)</option>
                    <option value="EUR">EUR (歐元)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">預設金額</label>
                  <input
                    type="number"
                    value={defaultAmount}
                    onChange={(e) => setDefaultAmount(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 font-bold outline-none"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">備註說明</label>
                <input
                  type="text"
                  value={remark}
                  onChange={(e) => setRemark(e.target.value)}
                  placeholder="例如：每月 5 號固定扣款"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsCreatingModal(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium cursor-pointer"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold shadow-md shadow-blue-500/20 cursor-pointer"
                >
                  儲存模版
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
