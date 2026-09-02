import React, { useState } from 'react';
import { 
  Database, 
  Building, 
  Tag, 
  Users, 
  Coins, 
  Plus, 
  Edit3, 
  Trash2, 
  ShieldCheck, 
  CheckCircle2, 
  AlertCircle,
  Sparkles,
  Lock,
  UserCheck,
  UserX,
  Sliders,
  DollarSign,
  Info,
  RefreshCw,
  Loader2,
  Globe
} from 'lucide-react';
import { Company, CurrencyRate, ExpenseCategory, UserProfile, UserPosition, UserRole, UserStatus } from '../types';
import { fetchLiveExchangeRates } from '../services/api';

interface MasterDataViewProps {
  companies: Company[];
  categories: ExpenseCategory[];
  users: UserProfile[];
  currencies: CurrencyRate[];
  currentUser: UserProfile;
  onSaveCompany: (company: Partial<Company>) => void;
  onSaveCategory: (category: Partial<ExpenseCategory>) => void;
  onSaveUser: (user: Partial<UserProfile>) => void;
  onDeleteUser?: (id: string) => void;
  onSaveCurrency: (currency: CurrencyRate) => void;
  onDeleteCurrency?: (currencyCode: string) => void;
  onBatchUpdateCurrencies?: (currencies: CurrencyRate[]) => void;
}

const ALL_SYSTEM_TABS = [
  { id: 'dashboard', name: '總覽儀表板' },
  { id: 'projects', name: '專案預算管理' },
  { id: 'masterData', name: '基礎資料建檔' },
  { id: 'expenses', name: '費用報支清單' },
  { id: 'approvals', name: '審批簽核中心' },
  { id: 'scanner', name: 'AI 發票影像辨識' },
  { id: 'recurring', name: '每月固定支出' },
  { id: 'reports', name: '財務報表與分析' },
  { id: 'audit', name: '操作歷程與備份' },
];

export const MasterDataView: React.FC<MasterDataViewProps> = ({
  companies,
  categories,
  users,
  currencies,
  currentUser,
  onSaveCompany,
  onSaveCategory,
  onSaveUser,
  onDeleteUser,
  onSaveCurrency,
  onDeleteCurrency,
  onBatchUpdateCurrencies,
}) => {
  const isSuperAdmin = currentUser?.position === 'admin' || currentUser?.role === 'admin';
  const [activeSubTab, setActiveSubTab] = useState<'companies' | 'categories' | 'users' | 'currencies'>('companies');

  // 幣別新增與即時更新狀態
  const [currModalOpen, setCurrModalOpen] = useState(false);
  const [newCurrCode, setNewCurrCode] = useState('');
  const [newCurrName, setNewCurrName] = useState('');
  const [newCurrSymbol, setNewCurrSymbol] = useState('$');
  const [newCurrRate, setNewCurrRate] = useState<number>(1);
  const [isFetchingLiveRate, setIsFetchingLiveRate] = useState(false);
  const [isRefreshingAll, setIsRefreshingAll] = useState(false);
  const [rateFeedbackMsg, setRateFeedbackMsg] = useState<string | null>(null);

  // 根據代碼自動上網查匯率
  const handleAutoFetchSingleRate = async (code: string) => {
    const cleanCode = code.trim().toUpperCase();
    if (!cleanCode || cleanCode.length < 3) return;

    setIsFetchingLiveRate(true);
    setRateFeedbackMsg(null);
    try {
      const rates = await fetchLiveExchangeRates();
      const matched = rates[cleanCode];
      if (matched && matched > 0) {
        setNewCurrRate(matched);
        setRateFeedbackMsg(`✅ 已聯網獲取 ${cleanCode} 最新匯率：1 ${cleanCode} ≈ NT$ ${matched}`);
      } else {
        setRateFeedbackMsg(`⚠️ 未能自外匯 API 查得 ${cleanCode}，請手動填寫匯率`);
      }
    } catch (err) {
      setRateFeedbackMsg(`⚠️ 匯率連線逾時，請手動填寫匯率`);
    } finally {
      setIsFetchingLiveRate(false);
    }
  };

  // 一鍵聯網更新所有外幣匯率
  const handleRefreshAllRates = async () => {
    setIsRefreshingAll(true);
    try {
      const liveRates = await fetchLiveExchangeRates();
      let updatedCount = 0;
      const updatedCurrencies = currencies.map(c => {
        if (c.currency === 'TWD') return c;
        const onlineRate = liveRates[c.currency.toUpperCase()];
        if (onlineRate && onlineRate > 0) {
          updatedCount++;
          return {
            ...c,
            rateToTWD: onlineRate,
            lastUpdated: new Date().toISOString().split('T')[0]
          };
        }
        return c;
      });

      if (onBatchUpdateCurrencies) {
        onBatchUpdateCurrencies(updatedCurrencies);
      } else {
        updatedCurrencies.forEach(c => onSaveCurrency(c));
      }
      alert(`🎉 匯率更新成功！已成功自國際外匯市場更新 ${updatedCount} 種幣別最新對台幣之匯率。`);
    } catch (err) {
      alert('更新匯率失敗，請檢查網路連線後再試。');
    } finally {
      setIsRefreshingAll(false);
    }
  };

  // 新增幣別
  const handleSaveNewCurrency = (e: React.FormEvent) => {
    e.preventDefault();
    const code = newCurrCode.trim().toUpperCase();
    if (!code) {
      alert('請輸入幣別代碼');
      return;
    }
    if (code === 'TWD') {
      alert('TWD 為系統基準幣別，無需重複建立');
      return;
    }
    const exists = currencies.some(c => c.currency.toUpperCase() === code);
    if (exists) {
      alert(`幣別【${code}】已存在列表中！`);
      return;
    }

    const newCurr: CurrencyRate = {
      currency: code,
      name: newCurrName.trim() || `${code} 外幣`,
      symbol: newCurrSymbol.trim() || '$',
      rateToTWD: Number(newCurrRate) || 1,
      lastUpdated: new Date().toISOString().split('T')[0]
    };

    onSaveCurrency(newCurr);
    setCurrModalOpen(false);
    setNewCurrCode('');
    setNewCurrName('');
    setNewCurrSymbol('$');
    setNewCurrRate(1);
    setRateFeedbackMsg(null);
  };

  // 刪除幣別
  const handleDeleteCurrency = (code: string) => {
    if (code === 'TWD') {
      alert('【禁止操作】新台幣 (TWD) 為系統本位基準幣別，不可刪除！');
      return;
    }
    if (confirm(`確定要刪除幣別【${code}】嗎？刪除後固定支出及報銷將無法直接引用此幣別。`)) {
      if (onDeleteCurrency) {
        onDeleteCurrency(code);
      }
    }
  };

  // 公司編輯狀態
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [compName, setCompName] = useState('');
  const [compTaxId, setCompTaxId] = useState('');
  const [compAddress, setCompAddress] = useState('');
  const [compPhone, setCompPhone] = useState('');
  const [compModalOpen, setCompModalOpen] = useState(false);

  // 科目編輯狀態 (包含各職位限制與上限)
  const [editingCat, setEditingCat] = useState<ExpenseCategory | null>(null);
  const [catCode, setCatCode] = useState('');
  const [catName, setCatName] = useState('');
  const [catDesc, setCatDesc] = useState('');
  const [catMax, setCatMax] = useState<number>(0);
  // 各職位報支與上限設定
  const [adminAllowed, setAdminAllowed] = useState(true);
  const [adminMaxLimit, setAdminMaxLimit] = useState<number>(0);
  const [auditorAllowed, setAuditorAllowed] = useState(true);
  const [auditorMaxLimit, setAuditorMaxLimit] = useState<number>(0);
  const [editorAllowed, setEditorAllowed] = useState(true);
  const [editorMaxLimit, setEditorMaxLimit] = useState<number>(0);
  const [catModalOpen, setCatModalOpen] = useState(false);

  // 使用者編輯狀態
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [userName, setUserName] = useState('');
  const [userEnglishName, setUserEnglishName] = useState('');
  const [userUsername, setUserUsername] = useState('');
  const [userPassword, setUserPassword] = useState('123');
  const [userEmail, setUserEmail] = useState('');
  const [userPosition, setUserPosition] = useState<UserPosition>('editor');
  const [userStatus, setUserStatus] = useState<UserStatus>('active');
  const [userRoleTitle, setUserRoleTitle] = useState('');
  const [userDept, setUserDept] = useState('');
  const [userAllowedTabs, setUserAllowedTabs] = useState<string[]>([]);
  const [userModalOpen, setUserModalOpen] = useState(false);

  // 匯率編輯狀態
  const [editingCurrency, setEditingCurrency] = useState<CurrencyRate | null>(null);
  const [currRate, setCurrRate] = useState<number>(1);

  // 處理公司儲存
  const handleSaveCompany = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveCompany({
      id: editingCompany?.id,
      name: compName.trim(),
      taxId: compTaxId.trim(),
      address: compAddress.trim(),
      phone: compPhone.trim(),
    });
    setCompModalOpen(false);
  };

  // 處理科目儲存
  const handleSaveCategory = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveCategory({
      id: editingCat?.id,
      code: catCode.trim(),
      name: catName.trim(),
      description: catDesc.trim(),
      maxPerItem: catMax > 0 ? catMax : undefined,
      roleLimits: {
        admin: { allowed: adminAllowed, maxLimit: adminMaxLimit },
        auditor: { allowed: auditorAllowed, maxLimit: auditorMaxLimit },
        editor: { allowed: editorAllowed, maxLimit: editorMaxLimit },
      },
    });
    setCatModalOpen(false);
  };

  // 處理使用者儲存
  const handleSaveUser = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveUser({
      id: editingUser?.id,
      name: userName.trim(),
      englishName: userEnglishName.trim(),
      username: userUsername.trim().toLowerCase(),
      password: userPassword.trim() || '123',
      email: userEmail.trim(),
      role: userPosition as UserRole,
      position: userPosition,
      status: userStatus,
      roleTitle: userRoleTitle.trim() || (userPosition === 'admin' ? '最高管理 / 總經理' : userPosition === 'auditor' ? '部門管理 / 專案協理' : '一般員工 / 專案成員'),
      department: userDept.trim() || '研發處',
      allowedTabs: userAllowedTabs,
    });
    setUserModalOpen(false);
  };

  // 處理同仁刪除 (僅最高管理者有權限)
  const handleDeleteUser = (u: UserProfile) => {
    if (!isSuperAdmin) {
      alert('【權限不足】\n僅有系統最高管理者 (Admin) 擁有刪除同仁帳號的名冊維護權限！');
      return;
    }

    if (u.id === currentUser?.id) {
      alert('【安全防護】\n您無法刪除目前正在登入使用的最高管理者帳號！');
      return;
    }

    const activeAdmins = users.filter(
      x => (x.position === 'admin' || x.role === 'admin') && x.status === 'active'
    );
    if ((u.position === 'admin' || u.role === 'admin') && activeAdmins.length <= 1) {
      alert('【安全防護】\n系統必須保留至少一位在職的最高管理者，無法刪除最後一位管理員！');
      return;
    }

    if (
      confirm(
        `【危險操作確認】\n確定要永久刪除同仁「${u.name}」(${u.username || u.englishName || u.email}) 的帳號資料嗎？\n\n此動作將立即移除該同仁的名冊紀錄，並記錄於系統稽核歷程中。`
      )
    ) {
      if (onDeleteUser) {
        onDeleteUser(u.id);
      }
      if (userModalOpen) {
        setUserModalOpen(false);
      }
    }
  };

  const toggleTabPermission = (tabId: string) => {
    setUserAllowedTabs(prev => 
      prev.includes(tabId) ? prev.filter(t => t !== tabId) : [...prev, tabId]
    );
  };

  return (
    <div className="space-y-6">
      
      {/* 頂部橫幅 */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-900 rounded-2xl p-6 text-white shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-500/30 text-blue-200 border border-blue-400/30">
              系統主檔維護 (Master Data & RBAC)
            </span>
            <span className="text-xs text-slate-300">最高權限管理員專屬功能</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Database className="w-6 h-6 text-blue-400" />
            基本資料建檔、同仁權限與科目職位上限
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-xl">
            維護企業組織基本資料（公司統編/科目報支職位門檻/帳號密碼與模組權限/即時換算匯率表），確保全系統防呆與資安控管。
          </p>
        </div>
      </div>

      {/* 子標籤導航 */}
      <div className="bg-white p-2 rounded-2xl border border-slate-200 shadow-2xs flex items-center gap-2 overflow-x-auto no-scrollbar">
        <button
          onClick={() => setActiveSubTab('companies')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            activeSubTab === 'companies' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Building className="w-4 h-4" />
          公司資料建檔 ({companies.length})
        </button>

        <button
          onClick={() => setActiveSubTab('categories')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            activeSubTab === 'categories' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Tag className="w-4 h-4" />
          會計科目與職位上限 ({categories.length})
        </button>

        <button
          onClick={() => setActiveSubTab('users')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            activeSubTab === 'users' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Users className="w-4 h-4" />
          同仁名冊與權限管理 ({users.length})
        </button>

        <button
          onClick={() => setActiveSubTab('currencies')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            activeSubTab === 'currencies' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Coins className="w-4 h-4" />
          多幣別即時匯率表 ({currencies.length})
        </button>
      </div>

      {/* 1. 公司資料管理 */}
      {activeSubTab === 'companies' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-base text-slate-900">企業法人與分公司清單</h3>
              <p className="text-xs text-slate-500">維護公司全名、統一編號與聯絡資訊，供報帳單與傳票引用。</p>
            </div>
            <button
              onClick={() => {
                setEditingCompany(null);
                setCompName('');
                setCompTaxId('');
                setCompAddress('');
                setCompPhone('');
                setCompModalOpen(true);
              }}
              className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              新增公司資料
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {companies.map((c) => (
              <div key={c.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <Building className="w-5 h-5 text-blue-600" />
                    <span className="font-bold text-sm text-slate-900">{c.name}</span>
                  </div>
                  <button
                    onClick={() => {
                      setEditingCompany(c);
                      setCompName(c.name);
                      setCompTaxId(c.taxId);
                      setCompAddress(c.address || '');
                      setCompPhone(c.phone || '');
                      setCompModalOpen(true);
                    }}
                    className="p-1 text-slate-400 hover:text-blue-600 cursor-pointer"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                </div>
                <div className="text-xs text-slate-600 space-y-1">
                  <div>統一編號：<strong className="font-mono">{c.taxId}</strong></div>
                  <div>登記地址：{c.address || '未設定'}</div>
                  <div>聯絡電話：{c.phone || '未設定'}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 2. 會計科目設定 (依職位設定可否報支與上限) */}
      {activeSubTab === 'categories' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-base text-slate-900">會計科目與職位報支上限維護</h3>
              <p className="text-xs text-slate-500">
                可依<strong>最高管理</strong>、<strong>部門管理</strong>與<strong>一般員工</strong>職位，設定是否能報支該科目，以及各自的單筆金額上限。
              </p>
            </div>
            <button
              onClick={() => {
                setEditingCat(null);
                setCatCode(`ACC-${Math.floor(Math.random() * 800 + 100)}`);
                setCatName('');
                setCatDesc('');
                setCatMax(0);
                setAdminAllowed(true);
                setAdminMaxLimit(0);
                setAuditorAllowed(true);
                setAuditorMaxLimit(30000);
                setEditorAllowed(true);
                setEditorMaxLimit(10000);
                setCatModalOpen(true);
              }}
              className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              新增科目
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="p-3">科目代碼</th>
                  <th className="p-3">科目名稱</th>
                  <th className="p-3">最高管理 (Admin) 上限</th>
                  <th className="p-3">部門管理 (Auditor) 上限</th>
                  <th className="p-3">一般員工 (Editor) 上限</th>
                  <th className="p-3">用途說明</th>
                  <th className="p-3 text-center">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {categories.map((cat) => {
                  const adminLim = cat.roleLimits?.admin;
                  const auditorLim = cat.roleLimits?.auditor;
                  const editorLim = cat.roleLimits?.editor;

                  return (
                    <tr key={cat.id} className="hover:bg-slate-50">
                      <td className="p-3 font-mono text-slate-500">{cat.code}</td>
                      <td className="p-3 font-bold text-slate-900">{cat.name}</td>
                      
                      {/* 最高管理 */}
                      <td className="p-3">
                        {adminLim?.allowed !== false ? (
                          <span className="text-emerald-700 font-medium">
                            ✓ 可選 {adminLim?.maxLimit && adminLim.maxLimit > 0 ? `(限 NT$ ${adminLim.maxLimit.toLocaleString()})` : '(無限制)'}
                          </span>
                        ) : (
                          <span className="text-rose-500 font-semibold">✕ 不可報支</span>
                        )}
                      </td>

                      {/* 部門管理 */}
                      <td className="p-3">
                        {auditorLim?.allowed !== false ? (
                          <span className="text-blue-700 font-medium">
                            ✓ 可選 {auditorLim?.maxLimit && auditorLim.maxLimit > 0 ? `(限 NT$ ${auditorLim.maxLimit.toLocaleString()})` : '(無限制)'}
                          </span>
                        ) : (
                          <span className="text-rose-500 font-semibold">✕ 不可報支</span>
                        )}
                      </td>

                      {/* 一般員工 */}
                      <td className="p-3">
                        {editorLim?.allowed !== false ? (
                          <span className="text-slate-700 font-medium">
                            ✓ 可選 {editorLim?.maxLimit && editorLim.maxLimit > 0 ? `(限 NT$ ${editorLim.maxLimit.toLocaleString()})` : '(無限制)'}
                          </span>
                        ) : (
                          <span className="text-rose-500 font-semibold bg-rose-50 px-1.5 py-0.5 rounded">
                            ✕ 不可選取
                          </span>
                        )}
                      </td>

                      <td className="p-3 text-slate-500 max-w-xs truncate" title={cat.description}>
                        {cat.description || '-'}
                      </td>

                      <td className="p-3 text-center">
                        <button
                          onClick={() => {
                            setEditingCat(cat);
                            setCatCode(cat.code);
                            setCatName(cat.name);
                            setCatDesc(cat.description || '');
                            setCatMax(cat.maxPerItem || 0);
                            setAdminAllowed(cat.roleLimits?.admin?.allowed ?? true);
                            setAdminMaxLimit(cat.roleLimits?.admin?.maxLimit || 0);
                            setAuditorAllowed(cat.roleLimits?.auditor?.allowed ?? true);
                            setAuditorMaxLimit(cat.roleLimits?.auditor?.maxLimit || 0);
                            setEditorAllowed(cat.roleLimits?.editor?.allowed ?? true);
                            setEditorMaxLimit(cat.roleLimits?.editor?.maxLimit || 0);
                            setCatModalOpen(true);
                          }}
                          className="p-1 text-slate-400 hover:text-blue-600 cursor-pointer"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 3. 使用者與職位狀態管理 */}
      {activeSubTab === 'users' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="font-bold text-base text-slate-900">同仁名冊、英文名、職位與帳密權限</h3>
              <p className="text-xs text-slate-500">
                職位劃分為：<strong>最高管理 (Admin)</strong>、<strong>部門管理 (Auditor)</strong>、<strong>一般員工 (Editor)</strong>；狀態包含<strong>在職 / 離職</strong>，並可個別設定可見功能模組。
              </p>
            </div>
            <button
              onClick={() => {
                setEditingUser(null);
                setUserName('');
                setUserEnglishName('');
                setUserUsername('');
                setUserPassword('123');
                setUserEmail('');
                setUserPosition('editor');
                setUserStatus('active');
                setUserRoleTitle('一般員工 / 專案成員');
                setUserDept('軟體研發處');
                setUserAllowedTabs(['dashboard', 'expenses', 'scanner', 'recurring', 'reports']);
                setUserModalOpen(true);
              }}
              className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 cursor-pointer shrink-0"
            >
              <Plus className="w-4 h-4" />
              新增同仁帳號
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {users.map((u) => (
              <div 
                key={u.id} 
                className={`p-4 rounded-xl border space-y-3 transition-shadow ${
                  u.status === 'inactive' ? 'bg-slate-100/80 border-slate-300 opacity-75' : 'bg-white border-slate-200 hover:shadow-xs'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold text-xs shadow-2xs">
                      {u.name.substring(0, 1)}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-sm text-slate-900">{u.name}</span>
                        {u.englishName && (
                          <span className="text-xs font-medium text-slate-500">({u.englishName})</span>
                        )}
                        <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                          u.status === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                        }`}>
                          {u.status === 'active' ? '在職' : '離職'}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono">
                        帳號: <strong className="text-slate-600">{u.username || u.englishName?.toLowerCase()}</strong> | {u.email}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => {
                        setEditingUser(u);
                        setUserName(u.name);
                        setUserEnglishName(u.englishName || '');
                        setUserUsername(u.username || u.englishName?.toLowerCase() || '');
                        setUserPassword(u.password || '123');
                        setUserEmail(u.email);
                        setUserPosition(u.position || (u.role as UserPosition) || 'editor');
                        setUserStatus(u.status || 'active');
                        setUserRoleTitle(u.roleTitle);
                        setUserDept(u.department || '研發處');
                        setUserAllowedTabs(u.allowedTabs || ALL_SYSTEM_TABS.map(t => t.id));
                        setUserModalOpen(true);
                      }}
                      className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg cursor-pointer transition-colors"
                      title="編輯同仁設定"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>

                    {isSuperAdmin ? (
                      <button
                        onClick={() => handleDeleteUser(u)}
                        disabled={u.id === currentUser?.id}
                        className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                          u.id === currentUser?.id
                            ? 'text-slate-200 cursor-not-allowed opacity-40'
                            : 'text-slate-400 hover:text-rose-600 hover:bg-rose-50'
                        }`}
                        title={u.id === currentUser?.id ? '無法刪除目前登入中的帳號' : '刪除同仁帳號 (僅最高管理者)'}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    ) : (
                      <span
                        className="p-1.5 text-slate-300 cursor-not-allowed opacity-50"
                        title="僅最高管理者 (Admin) 具有刪除同仁名冊之權限"
                      >
                        <Lock className="w-3.5 h-3.5" />
                      </span>
                    )}
                  </div>
                </div>

                {/* 職位與部門 */}
                <div className="grid grid-cols-2 gap-2 text-[11px] bg-slate-50 p-2 rounded-lg">
                  <div>部門：<strong className="text-slate-700">{u.department}</strong></div>
                  <div>
                    職位：
                    <strong className={
                      u.position === 'admin' ? 'text-purple-700' : u.position === 'auditor' ? 'text-blue-700' : 'text-slate-700'
                    }>
                      {u.position === 'admin' ? '最高管理' : u.position === 'auditor' ? '部門管理' : '一般員工'}
                    </strong>
                  </div>
                </div>

                {/* 可見功能模組標籤 */}
                <div className="space-y-1">
                  <span className="text-[10px] text-slate-400 font-semibold">可存取模組 ({u.allowedTabs?.length || ALL_SYSTEM_TABS.length} 個)：</span>
                  <div className="flex flex-wrap gap-1">
                    {(u.allowedTabs || ALL_SYSTEM_TABS.map(t => t.id)).slice(0, 5).map(tabId => {
                      const tab = ALL_SYSTEM_TABS.find(t => t.id === tabId);
                      return (
                        <span key={tabId} className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px]">
                          {tab?.name || tabId}
                        </span>
                      );
                    })}
                    {(u.allowedTabs?.length || 0) > 5 && (
                      <span className="px-1.5 py-0.5 bg-slate-200 text-slate-700 rounded text-[10px] font-bold">
                        +{(u.allowedTabs?.length || 0) - 5}
                      </span>
                    )}
                  </div>
                </div>

              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. 即時匯率管理 */}
      {activeSubTab === 'currencies' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                <Globe className="w-5 h-5 text-indigo-600" />
                多幣別即時換算匯率表
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                設定各外幣折合新台幣 (TWD) 之入帳匯率基準。支援手動設定、連網自動同步最新即時匯率，填報與固定支出時系統將自動即時換算台幣金額。
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleRefreshAllRates}
                disabled={isRefreshingAll}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                title="聯網自動抓取所有外幣對台幣之最新即時匯率"
              >
                {isRefreshingAll ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600" />
                ) : (
                  <RefreshCw className="w-3.5 h-3.5 text-slate-600" />
                )}
                {isRefreshingAll ? '正在更新中...' : '一鍵更新最新匯率'}
              </button>

              <button
                onClick={() => {
                  setNewCurrCode('');
                  setNewCurrName('');
                  setNewCurrSymbol('$');
                  setNewCurrRate(1);
                  setRateFeedbackMsg(null);
                  setCurrModalOpen(true);
                }}
                className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                新增外幣幣別
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {currencies.map((curr) => {
              const isBaseCurrency = curr.currency === 'TWD';
              return (
                <div 
                  key={curr.currency} 
                  className={`p-4 rounded-xl border relative transition-all ${
                    isBaseCurrency 
                      ? 'border-indigo-200 bg-indigo-50/40' 
                      : 'border-slate-200 bg-slate-50/80 hover:bg-white hover:border-slate-300 shadow-2xs'
                  } space-y-2.5`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-sm text-slate-900">{curr.currency}</span>
                        <span className="text-xs text-slate-600 font-medium">({curr.name})</span>
                        {isBaseCurrency && (
                          <span className="text-[10px] bg-indigo-600 text-white px-1.5 py-0.2 rounded font-bold">本位幣</span>
                        )}
                      </div>
                      <span className="text-[11px] font-mono text-slate-400">符號：{curr.symbol}</span>
                    </div>

                    {!isBaseCurrency && (
                      <button
                        onClick={() => handleDeleteCurrency(curr.currency)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all cursor-pointer"
                        title={`刪除 ${curr.currency} 幣別`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <div className="text-xs text-slate-600 space-y-1">
                    <div className="flex items-center justify-between text-[11px] text-slate-500">
                      <span>對 TWD 基準匯率</span>
                      {!isBaseCurrency && (
                        <button
                          onClick={async () => {
                            const rates = await fetchLiveExchangeRates();
                            const rate = rates[curr.currency.toUpperCase()];
                            if (rate && rate > 0) {
                              onSaveCurrency({
                                ...curr,
                                rateToTWD: rate,
                                lastUpdated: new Date().toISOString().split('T')[0]
                              });
                            } else {
                              alert(`未能自動取得 ${curr.currency} 匯率，請手動更新`);
                            }
                          }}
                          className="text-[10px] text-indigo-600 hover:underline flex items-center gap-0.5 cursor-pointer"
                          title="單獨線上重新整理此幣別匯率"
                        >
                          <RefreshCw className="w-2.5 h-2.5" />
                          更新
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-slate-400 text-xs font-mono">1 {curr.currency} =</span>
                      <input
                        type="number"
                        step="0.0001"
                        value={curr.rateToTWD}
                        disabled={isBaseCurrency}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 1;
                          onSaveCurrency({ ...curr, rateToTWD: val, lastUpdated: new Date().toISOString().split('T')[0] });
                        }}
                        className="flex-1 px-2.5 py-1 rounded-lg border border-slate-300 bg-white font-mono font-bold text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-100 disabled:text-slate-500"
                      />
                      <span className="text-slate-500 font-bold text-xs">NT$</span>
                    </div>
                  </div>

                  <div className="text-[10px] text-slate-400 pt-1 border-t border-slate-200/50 flex items-center justify-between">
                    <span>最後更新時間</span>
                    <span className="font-mono">{curr.lastUpdated || '2026-09-01'}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 新增外幣幣別彈窗 */}
      {currModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-xl p-6 space-y-4 text-xs animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                <Globe className="w-4 h-4 text-indigo-600" />
                新增外幣幣別與即時匯率
              </h3>
              <button
                onClick={() => setCurrModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveNewCurrency} className="space-y-3.5">
              <div>
                <label className="block font-semibold mb-1 text-slate-700">
                  幣別代碼 (例如：KRW, GBP, HKD, SGD, AUD, CAD)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newCurrCode}
                    onChange={(e) => {
                      const code = e.target.value.toUpperCase();
                      setNewCurrCode(code);
                      if (code.length >= 3) {
                        handleAutoFetchSingleRate(code);
                      }
                    }}
                    onBlur={() => {
                      if (newCurrCode.trim().length >= 3) {
                        handleAutoFetchSingleRate(newCurrCode);
                      }
                    }}
                    placeholder="例如：KRW"
                    maxLength={10}
                    className="flex-1 px-3 py-2 rounded-lg border border-slate-300 font-mono font-bold uppercase focus:ring-2 focus:ring-indigo-500 outline-none"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => handleAutoFetchSingleRate(newCurrCode)}
                    disabled={isFetchingLiveRate || !newCurrCode.trim()}
                    className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg flex items-center gap-1 cursor-pointer disabled:opacity-50"
                  >
                    {isFetchingLiveRate ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                    查最新匯率
                  </button>
                </div>
                {rateFeedbackMsg && (
                  <p className="text-[11px] mt-1.5 text-slate-600 font-medium">
                    {rateFeedbackMsg}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1 text-slate-700">幣別名稱</label>
                  <input
                    type="text"
                    value={newCurrName}
                    onChange={(e) => setNewCurrName(e.target.value)}
                    placeholder="例如：韓元 / 英鎊"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 outline-none focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1 text-slate-700">幣別符號</label>
                  <input
                    type="text"
                    value={newCurrSymbol}
                    onChange={(e) => setNewCurrSymbol(e.target.value)}
                    placeholder="例如：₩, £, HK$"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold mb-1 text-slate-700">
                  折合新台幣 (TWD) 匯率 (1 該幣別 = ? TWD)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="0.0001"
                    value={newCurrRate}
                    onChange={(e) => setNewCurrRate(parseFloat(e.target.value) || 0)}
                    placeholder="例如：0.024"
                    className="flex-1 px-3 py-2 rounded-lg border border-slate-300 font-mono font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                  <span className="font-bold text-slate-600">NT$</span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setCurrModalOpen(false)}
                  className="px-3.5 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium cursor-pointer"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg shadow-sm cursor-pointer"
                >
                  儲存並建立幣別
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 公司編輯彈窗 */}
      {compModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-xl p-6 space-y-4 text-xs">
            <h3 className="font-bold text-base text-slate-900">{editingCompany ? '編輯公司' : '新增公司'}</h3>
            <form onSubmit={handleSaveCompany} className="space-y-3">
              <div>
                <label className="block font-semibold mb-1">公司全名</label>
                <input
                  type="text"
                  value={compName}
                  onChange={(e) => setCompName(e.target.value)}
                  className="w-full p-2 rounded-lg border"
                  required
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">統一編號</label>
                <input
                  type="text"
                  value={compTaxId}
                  onChange={(e) => setCompTaxId(e.target.value)}
                  className="w-full p-2 rounded-lg border font-mono"
                  required
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">登記地址</label>
                <input
                  type="text"
                  value={compAddress}
                  onChange={(e) => setCompAddress(e.target.value)}
                  className="w-full p-2 rounded-lg border"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">聯絡電話</label>
                <input
                  type="text"
                  value={compPhone}
                  onChange={(e) => setCompPhone(e.target.value)}
                  className="w-full p-2 rounded-lg border"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setCompModalOpen(false)}
                  className="px-3 py-1.5 text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-blue-600 text-white font-bold rounded-lg"
                >
                  儲存
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 科目與職位上限編輯彈窗 */}
      {catModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-xl p-6 space-y-4 text-xs max-h-[90vh] overflow-y-auto">
            <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
              <Tag className="w-5 h-5 text-blue-600" />
              {editingCat ? '編輯科目與職位報支上限' : '新增會計科目'}
            </h3>

            <form onSubmit={handleSaveCategory} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">科目代碼</label>
                  <input
                    type="text"
                    value={catCode}
                    onChange={(e) => setCatCode(e.target.value)}
                    className="w-full p-2 rounded-lg border font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">科目名稱</label>
                  <input
                    type="text"
                    value={catName}
                    onChange={(e) => setCatName(e.target.value)}
                    className="w-full p-2 rounded-lg border font-bold"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold mb-1">用途與適用範疇說明</label>
                <textarea
                  value={catDesc}
                  onChange={(e) => setCatDesc(e.target.value)}
                  rows={2}
                  className="w-full p-2 rounded-lg border"
                />
              </div>

              {/* 職位報支與個別金額上限設定 */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                <div className="font-bold text-slate-800 flex items-center gap-1.5">
                  <Sliders className="w-4 h-4 text-indigo-600" />
                  <span>各職位報銷權限與單筆金額上限 (NTD)</span>
                </div>

                {/* 1. 最高管理 */}
                <div className="flex items-center justify-between p-2 rounded-lg bg-white border border-slate-200">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="admin-allowed"
                      checked={adminAllowed}
                      onChange={(e) => setAdminAllowed(e.target.checked)}
                      className="rounded text-blue-600"
                    />
                    <label htmlFor="admin-allowed" className="font-bold text-slate-800">
                      最高管理 (Admin)
                    </label>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-slate-400">上限：</span>
                    <input
                      type="number"
                      value={adminMaxLimit}
                      disabled={!adminAllowed}
                      onChange={(e) => setAdminMaxLimit(parseFloat(e.target.value) || 0)}
                      placeholder="0 表示無限制"
                      className="w-28 p-1.5 border rounded-lg font-mono font-bold text-right outline-none disabled:bg-slate-100"
                    />
                  </div>
                </div>

                {/* 2. 部門管理 */}
                <div className="flex items-center justify-between p-2 rounded-lg bg-white border border-slate-200">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="auditor-allowed"
                      checked={auditorAllowed}
                      onChange={(e) => setAuditorAllowed(e.target.checked)}
                      className="rounded text-blue-600"
                    />
                    <label htmlFor="auditor-allowed" className="font-bold text-slate-800">
                      部門管理 (Auditor)
                    </label>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-slate-400">上限：</span>
                    <input
                      type="number"
                      value={auditorMaxLimit}
                      disabled={!auditorAllowed}
                      onChange={(e) => setAuditorMaxLimit(parseFloat(e.target.value) || 0)}
                      placeholder="0 表示無限制"
                      className="w-28 p-1.5 border rounded-lg font-mono font-bold text-right outline-none disabled:bg-slate-100"
                    />
                  </div>
                </div>

                {/* 3. 一般員工 */}
                <div className="flex items-center justify-between p-2 rounded-lg bg-white border border-slate-200">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="editor-allowed"
                      checked={editorAllowed}
                      onChange={(e) => setEditorAllowed(e.target.checked)}
                      className="rounded text-blue-600"
                    />
                    <label htmlFor="editor-allowed" className="font-bold text-slate-800">
                      一般員工 (Editor)
                    </label>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-slate-400">上限：</span>
                    <input
                      type="number"
                      value={editorMaxLimit}
                      disabled={!editorAllowed}
                      onChange={(e) => setEditorMaxLimit(parseFloat(e.target.value) || 0)}
                      placeholder="0 表示無限制"
                      className="w-28 p-1.5 border rounded-lg font-mono font-bold text-right outline-none disabled:bg-slate-100"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setCatModalOpen(false)}
                  className="px-3 py-1.5 text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-blue-600 text-white font-bold rounded-lg shadow-sm"
                >
                  儲存科目
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 使用者新增/編輯彈窗 (含英文名、職位、狀態、帳號密碼、可見模組權限) */}
      {userModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 p-6 space-y-4 text-xs max-h-[90vh] overflow-y-auto">
            <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
              <Users className="w-5 h-5 text-indigo-600" />
              {editingUser ? '編輯同仁帳號與模組權限' : '新增同仁帳號'}
            </h3>

            <form onSubmit={handleSaveUser} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">中文姓名</label>
                  <input
                    type="text"
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    placeholder="例如 簡晨宇"
                    className="w-full p-2 rounded-lg border font-bold"
                    required
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">英文名稱 (English Name)</label>
                  <input
                    type="text"
                    value={userEnglishName}
                    onChange={(e) => setUserEnglishName(e.target.value)}
                    placeholder="例如 Kim"
                    className="w-full p-2 rounded-lg border"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">登入帳號 (Username)</label>
                  <input
                    type="text"
                    value={userUsername}
                    onChange={(e) => setUserUsername(e.target.value)}
                    placeholder="例如 kim"
                    className="w-full p-2 rounded-lg border font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">登入密碼 (Password)</label>
                  <input
                    type="text"
                    value={userPassword}
                    onChange={(e) => setUserPassword(e.target.value)}
                    placeholder="例如 123"
                    className="w-full p-2 rounded-lg border font-mono"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">系統職位劃分</label>
                  <select
                    value={userPosition}
                    onChange={(e) => {
                      const pos = e.target.value as UserPosition;
                      setUserPosition(pos);
                      if (pos === 'admin') {
                        setUserAllowedTabs(ALL_SYSTEM_TABS.map(t => t.id));
                      } else if (pos === 'auditor') {
                        setUserAllowedTabs(['dashboard', 'projects', 'expenses', 'approvals', 'scanner', 'recurring', 'reports']);
                      } else {
                        setUserAllowedTabs(['dashboard', 'expenses', 'scanner', 'recurring', 'reports']);
                      }
                    }}
                    className="w-full p-2 rounded-lg border font-bold text-slate-800"
                  >
                    <option value="admin">最高管理 (Admin)</option>
                    <option value="auditor">部門管理 (Auditor)</option>
                    <option value="editor">一般員工 (Editor)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold mb-1">在職狀態</label>
                  <select
                    value={userStatus}
                    onChange={(e) => setUserStatus(e.target.value as UserStatus)}
                    className="w-full p-2 rounded-lg border font-bold text-slate-800"
                  >
                    <option value="active">在職 (Active)</option>
                    <option value="inactive">離職 / 停用 (Inactive)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">職稱顯示</label>
                  <input
                    type="text"
                    value={userRoleTitle}
                    onChange={(e) => setUserRoleTitle(e.target.value)}
                    placeholder="例如 最高管理 / 總經理"
                    className="w-full p-2 rounded-lg border"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">部門</label>
                  <input
                    type="text"
                    value={userDept}
                    onChange={(e) => setUserDept(e.target.value)}
                    placeholder="例如 專案管理處"
                    className="w-full p-2 rounded-lg border"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold mb-1">電子信箱</label>
                <input
                  type="email"
                  value={userEmail}
                  onChange={(e) => setUserEmail(e.target.value)}
                  placeholder="name@bangjie.com.tw"
                  className="w-full p-2 rounded-lg border font-mono"
                  required
                />
              </div>

              {/* 個別設定可看到的功能模組 */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between font-bold text-slate-800">
                  <span className="flex items-center gap-1.5">
                    <Lock className="w-4 h-4 text-indigo-600" />
                    <span>模組存取權限設定 (勾選可見功能)</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setUserAllowedTabs(ALL_SYSTEM_TABS.map(t => t.id))}
                    className="text-[10px] text-blue-600 hover:underline cursor-pointer"
                  >
                    全選
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
                  {ALL_SYSTEM_TABS.map((tab) => {
                    const isChecked = userAllowedTabs.includes(tab.id);
                    return (
                      <label 
                        key={tab.id} 
                        className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-all ${
                          isChecked ? 'bg-indigo-50/60 border-indigo-200 text-indigo-950 font-bold' : 'bg-white border-slate-200 text-slate-500'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleTabPermission(tab.id)}
                          className="rounded text-indigo-600"
                        />
                        <span className="text-[11px] truncate">{tab.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-200">
                {editingUser && isSuperAdmin && editingUser.id !== currentUser?.id ? (
                  <button
                    type="button"
                    onClick={() => handleDeleteUser(editingUser)}
                    className="px-3 py-1.5 text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-lg font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    刪除此同仁帳號
                  </button>
                ) : (
                  <div />
                )}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setUserModalOpen(false)}
                    className="px-3.5 py-1.5 text-slate-600 hover:bg-slate-100 rounded-lg font-medium cursor-pointer"
                  >
                    取消
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-sm cursor-pointer"
                  >
                    儲存帳號設定
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
