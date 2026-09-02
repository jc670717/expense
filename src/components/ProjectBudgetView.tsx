import React, { useState } from 'react';
import { 
  Briefcase, 
  Plus, 
  Edit3, 
  AlertTriangle, 
  CheckCircle2, 
  TrendingUp, 
  DollarSign, 
  PieChart as PieChartIcon,
  Layers,
  Sparkles,
  Calendar,
  User,
  Clock,
  Ban,
  PlayCircle,
  FileCheck
} from 'lucide-react';
import { ExpenseItem, Project, ProjectStatus, UserProfile } from '../types';
import { formatMoney } from '../utils/exportUtils';

interface ProjectBudgetViewProps {
  projects: Project[];
  expenses: ExpenseItem[];
  users: UserProfile[];
  onSaveProject: (project: Partial<Project>) => void;
  currentUser: UserProfile;
}

export const ProjectBudgetView: React.FC<ProjectBudgetViewProps> = ({
  projects,
  expenses,
  users,
  onSaveProject,
  currentUser,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);

  // 表單欄位狀態
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [manager, setManager] = useState('');
  const [managerId, setManagerId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [status, setStatus] = useState<ProjectStatus>('active');
  const [budgetLimit, setBudgetLimit] = useState<number>(100000);
  const [warningThreshold, setWarningThreshold] = useState<number>(80);
  const [description, setDescription] = useState('');

  // 篩選與排序
  const [statusFilter, setStatusFilter] = useState<'ALL' | ProjectStatus>('ALL');

  // 計算每個專案的實際支出與預算使用率
  const projectStats = projects.map((proj) => {
    const projExpenses = expenses.filter((e) => e.projectName === proj.name);
    const spentAmount = projExpenses.reduce((sum, e) => sum + e.amount, 0);
    const approvedSpent = projExpenses
      .filter((e) => e.status === 'approved' || e.status === 'paid')
      .reduce((sum, e) => sum + e.amount, 0);
    const pendingSpent = projExpenses
      .filter((e) => e.status === 'submitted')
      .reduce((sum, e) => sum + e.amount, 0);
    
    const usagePercent = proj.budgetLimit > 0 ? (spentAmount / proj.budgetLimit) * 100 : 0;
    const isOverBudget = spentAmount > proj.budgetLimit;
    const isWarning = !isOverBudget && usagePercent >= proj.warningThreshold;

    return {
      ...proj,
      spentAmount,
      approvedSpent,
      pendingSpent,
      usagePercent,
      isOverBudget,
      isWarning,
      expenseCount: projExpenses.length,
    };
  });

  const filteredProjects = projectStats.filter((p) => {
    if (statusFilter !== 'ALL' && p.status !== statusFilter) return false;
    return true;
  });

  // 全局專案總結
  const totalBudget = projects.reduce((sum, p) => sum + p.budgetLimit, 0);
  const totalSpent = projectStats.reduce((sum, p) => sum + p.spentAmount, 0);
  const overBudgetCount = projectStats.filter((p) => p.isOverBudget).length;
  const warningCount = projectStats.filter((p) => p.isWarning).length;

  const handleOpenAddModal = () => {
    setEditingProject(null);
    setCode(`P-${new Date().getFullYear().toString().slice(-2)}-${Math.floor(Math.random() * 80 + 10)}`);
    setName('');
    const defaultMgr = users.find(u => u.status === 'active')?.name || currentUser.name;
    setManager(defaultMgr);
    setManagerId(users.find(u => u.name === defaultMgr)?.id || currentUser.id);
    setStartDate(new Date().toISOString().split('T')[0]);
    setStatus('active');
    setBudgetLimit(100000);
    setWarningThreshold(80);
    setDescription('');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (proj: Project) => {
    setEditingProject(proj);
    setCode(proj.code);
    setName(proj.name);
    setManager(proj.manager);
    setManagerId(proj.managerId || '');
    setStartDate(proj.startDate || '2026-01-01');
    setStatus(proj.status || 'active');
    setBudgetLimit(proj.budgetLimit);
    setWarningThreshold(proj.warningThreshold);
    setDescription(proj.description || '');
    setIsModalOpen(true);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    onSaveProject({
      id: editingProject?.id,
      code: code.trim(),
      name: name.trim(),
      manager: manager.trim(),
      managerId,
      startDate: startDate.trim(),
      status,
      budgetLimit,
      warningThreshold,
      description: description.trim(),
    });

    setIsModalOpen(false);
  };

  const getStatusBadge = (st: ProjectStatus) => {
    switch (st) {
      case 'active':
        return <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">進行中</span>;
      case 'pending':
        return <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200">未啟動</span>;
      case 'completed':
        return <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-blue-800 border border-blue-200">已結案</span>;
      case 'suspended':
        return <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-200">已中止</span>;
      default:
        return <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700">進行中</span>;
    }
  };

  return (
    <div className="space-y-6">
      
      {/* 頂部標題與統計指標卡片 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold mb-2">
            <span>專案總數</span>
            <Briefcase className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-black text-slate-900">{projects.length} 個專案</div>
          <div className="text-[11px] text-slate-400 mt-1">
            進行中：{projects.filter(p => p.status === 'active').length} | 已結案：{projects.filter(p => p.status === 'completed').length}
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold mb-2">
            <span>核定總預算規模</span>
            <DollarSign className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-2xl font-black text-indigo-600">{formatMoney(totalBudget)}</div>
          <div className="text-[11px] text-slate-400 mt-1">全公司各合約專案累計上限</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold mb-2">
            <span>累計已報銷支出</span>
            <TrendingUp className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-slate-900">{formatMoney(totalSpent)}</div>
          <div className="text-[11px] text-slate-400 mt-1">
            整體消耗比率：<strong>{totalBudget > 0 ? ((totalSpent / totalBudget) * 100).toFixed(1) : 0}%</strong>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold mb-2">
            <span>預算超支與預警專案</span>
            <AlertTriangle className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-2xl font-black text-rose-600">
            {overBudgetCount} <span className="text-sm font-normal text-slate-500">超支 / {warningCount} 預警</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1">門檻達到 80% 即啟動智慧預警提醒</div>
        </div>

      </div>

      {/* 專案列表與操作區塊 */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
              <Layers className="w-5 h-5 text-blue-600" />
              專案預算即時監控清單
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              設定專案開始時間、負責人、狀態（未啟動/進行中/已結案/已中止）與預算警戒門檻。
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* 狀態篩選 */}
            <div className="flex items-center bg-slate-100 rounded-xl p-1 text-xs font-bold border border-slate-200">
              {(['ALL', 'active', 'pending', 'completed', 'suspended'] as const).map(st => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`px-3 py-1 rounded-lg transition-all ${
                    statusFilter === st ? 'bg-white shadow-2xs text-blue-600 font-bold' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {st === 'ALL' ? '全部' : st === 'active' ? '進行中' : st === 'pending' ? '未啟動' : st === 'completed' ? '已結案' : '已中止'}
                </button>
              ))}
            </div>

            {currentUser.role !== 'editor' && (
              <button
                onClick={handleOpenAddModal}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 cursor-pointer shrink-0"
              >
                <Plus className="w-4 h-4" />
                新增專案建檔
              </button>
            )}
          </div>
        </div>

        {/* 專案卡片列表 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProjects.map((proj) => (
            <div
              key={proj.id}
              className={`p-4 rounded-xl border transition-all relative flex flex-col justify-between ${
                proj.isOverBudget 
                  ? 'border-rose-300 bg-rose-50/20' 
                  : proj.isWarning 
                  ? 'border-amber-300 bg-amber-50/20' 
                  : 'border-slate-200 bg-white hover:border-slate-300 shadow-2xs'
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-mono text-[11px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                        {proj.code}
                      </span>
                      {getStatusBadge(proj.status || 'active')}
                      {proj.isOverBudget && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-600 text-white animate-pulse">
                          預算超支
                        </span>
                      )}
                      {proj.isWarning && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500 text-white">
                          達預警門檻
                        </span>
                      )}
                    </div>
                    <h4 className="font-bold text-sm text-slate-900 mt-1 line-clamp-2" title={proj.name}>
                      {proj.name}
                    </h4>
                  </div>

                  {currentUser.role !== 'editor' && (
                    <button
                      onClick={() => handleOpenEditModal(proj)}
                      className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-slate-100 rounded-lg transition-colors shrink-0"
                      title="編輯專案"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <p className="text-xs text-slate-500 line-clamp-2 min-h-[32px] mb-3">
                  {proj.description || '無詳細專案說明'}
                </p>

                {/* 負責人與開始時間資訊 */}
                <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600 bg-slate-50/80 p-2.5 rounded-lg border border-slate-100 mb-3">
                  <div className="flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-slate-400" />
                    <span>負責人：<strong>{proj.manager}</strong></span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <span>開始：{proj.startDate || '2026-01-01'}</span>
                  </div>
                </div>

                {/* 預算進度條 */}
                <div className="space-y-1.5 mb-2">
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span className="text-slate-500">
                      已花費：<strong className="text-slate-800">{formatMoney(proj.spentAmount)}</strong>
                    </span>
                    <span className={`font-bold font-mono ${proj.isOverBudget ? 'text-rose-600' : proj.isWarning ? 'text-amber-600' : 'text-slate-700'}`}>
                      {proj.usagePercent.toFixed(1)}%
                    </span>
                  </div>

                  <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden flex">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        proj.isOverBudget
                          ? 'bg-rose-500'
                          : proj.isWarning
                          ? 'bg-amber-500'
                          : 'bg-indigo-600'
                      }`}
                      style={{ width: `${Math.min(proj.usagePercent, 100)}%` }}
                    />
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                <span>預算上限：<strong className="font-mono font-bold text-slate-800">{formatMoney(proj.budgetLimit)}</strong></span>
                <span>單據數：{proj.expenseCount} 筆</span>
              </div>
            </div>
          ))}
        </div>

      </div>

      {/* 專案新增/編輯彈窗 */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <h3 className="font-bold text-base flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-indigo-400" />
                {editingProject ? '編輯專案設定' : '新增專案建檔'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="p-6 space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">專案代碼</label>
                  <input
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="例如 P-XM-01"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono focus:ring-2 focus:ring-blue-500 outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">專案狀態</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as ProjectStatus)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none font-bold text-slate-800"
                  >
                    <option value="pending">未啟動 (Pending)</option>
                    <option value="active">進行中 (Active)</option>
                    <option value="completed">已結案 (Completed)</option>
                    <option value="suspended">已中止 (Suspended)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">專案完整名稱</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="例如 金廈(泉)票務系統暨服務採購案"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">負責人 (由同仁下拉選取)</label>
                  <select
                    value={manager}
                    onChange={(e) => {
                      const selectedName = e.target.value;
                      setManager(selectedName);
                      const u = users.find(usr => usr.name === selectedName || usr.englishName === selectedName);
                      if (u) setManagerId(u.id);
                    }}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 outline-none font-bold text-slate-800"
                    required
                  >
                    {users.map((u) => (
                      <option key={u.id} value={u.englishName || u.name}>
                        {u.name} ({u.englishName || u.roleTitle}) - {u.status === 'active' ? '在職' : '離職'}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">專案開始時間</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 outline-none font-mono"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">核定預算上限 (TWD)</label>
                  <input
                    type="number"
                    value={budgetLimit}
                    onChange={(e) => setBudgetLimit(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 font-bold text-slate-900 outline-none font-mono"
                    required
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">預警門檻 (%)</label>
                  <input
                    type="number"
                    value={warningThreshold}
                    onChange={(e) => setWarningThreshold(parseInt(e.target.value) || 80)}
                    placeholder="80"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 outline-none font-mono"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">專案範疇與備註說明</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  placeholder="說明專案合約範疇、結案條件與相關同仁..."
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold shadow-md shadow-blue-500/20"
                >
                  儲存專案
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
