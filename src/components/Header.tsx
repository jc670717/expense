import React, { useState, useRef, useEffect } from 'react';
import { 
  Search, 
  Plus, 
  Bell, 
  Menu, 
  FileSpreadsheet, 
  Sparkles, 
  CheckCircle2, 
  AlertTriangle,
  Coins,
  Globe,
  User,
  ChevronDown,
  LogOut,
  Zap,
  Shield,
  KeyRound
} from 'lucide-react';
import { CurrencyRate, NotificationItem, UserProfile } from '../types';

interface HeaderProps {
  currentUser: UserProfile;
  allUsers?: UserProfile[];
  onSwitchUser?: (user: UserProfile) => void;
  onLogout?: () => void;
  onOpenChangePassword?: () => void;
  activeTab: string;
  onOpenCreateExpense: () => void;
  onToggleMobileSidebar: () => void;
  notifications: NotificationItem[];
  onMarkNotificationRead: (id: string) => void;
  onClearNotifications: () => void;
  currencies?: CurrencyRate[];
  selectedCurrency?: string;
  onSelectCurrency?: (curr: string) => void;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentUser,
  allUsers = [],
  onSwitchUser,
  onLogout,
  onOpenChangePassword,
  activeTab,
  onOpenCreateExpense,
  onToggleMobileSidebar,
  notifications,
  onMarkNotificationRead,
  onClearNotifications,
  selectedCurrency = 'TWD',
  onSelectCurrency,
  searchQuery = '',
  onSearchChange,
}) => {
  const [showNotifMenu, setShowNotifMenu] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const notifMenuRef = useRef<HTMLDivElement>(null);

  // 點擊外部自動關閉下拉選單
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setShowUserMenu(false);
      }
      if (notifMenuRef.current && !notifMenuRef.current.contains(e.target as Node)) {
        setShowNotifMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;

  const tabTitles: Record<string, { title: string; subtitle: string }> = {
    dashboard: { title: '營運與費用總覽 (Operations Dashboard)', subtitle: '即時數據總覽與各專案預算監控' },
    expenses: { title: '日常公務費用報銷 (Daily Expense Ledger)', subtitle: '費用填報、審核狀態與發票核對' },
    approvals: { title: '審批簽核中心 (Approval Workflow)', subtitle: '主管與會計待簽單據審核流程' },
    scanner: { title: 'AI 發票影像辨識 (Receipt OCR Scanner)', subtitle: '智能解析發票統編、金額與科目' },
    recurring: { title: '每月固定支出 (Recurring Billing)', subtitle: '例行性軟體訂閱與固定公務開銷' },
    projects: { title: '專案預算管理 (Project Master)', subtitle: '各合約專案預算上限與 80% 預警門檻' },
    reports: { title: '財務分析與報表 (Reports & Audit)', subtitle: '多維度交叉分析與標準 Excel 總表' },
    masterData: { title: '系統主檔維護 (Basic Master Data)', subtitle: '公司資料、會計科目與權限等級' },
    audit: { title: '操作稽核與備份 (Audit Logs & Backup)', subtitle: '防篡改日誌與一鍵雲端全量快照' },
  };

  const currentTabInfo = tabTitles[activeTab] || { title: '費用管理系統', subtitle: '企業公務費用報銷與審核' };

  const getPositionLabel = (user: UserProfile) => {
    const pos = user.position || user.role;
    if (pos === 'admin') return { text: '最高管理', bg: 'bg-purple-100 text-purple-700 border-purple-200' };
    if (pos === 'auditor') return { text: '部門管理', bg: 'bg-sky-100 text-sky-700 border-sky-200' };
    return { text: '一般員工', bg: 'bg-emerald-100 text-emerald-700 border-emerald-200' };
  };

  const currentPos = getPositionLabel(currentUser);

  return (
    <header className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-4 sm:px-6 shrink-0 sticky top-0 z-30 shadow-2xs">
      
      {/* 左側：漢堡選單 (行動端) + 當前頁面標題 + 幣別切換 */}
      <div className="flex items-center gap-3 sm:gap-4 min-w-0">
        <button
          onClick={onToggleMobileSidebar}
          className="lg:hidden p-1.5 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100"
          title="開啟選單"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="min-w-0">
          <h2 className="font-bold text-sm sm:text-base text-slate-800 tracking-tight truncate">
            {currentTabInfo.title}
          </h2>
        </div>

        {/* 幣別即時切換 Pills */}
        <div className="hidden md:flex items-center bg-slate-100 rounded-lg p-0.5 text-[11px] font-bold border border-slate-200/80">
          {['TWD', 'USD', 'JPY', 'RMB'].map((curr) => {
            const isSelected = selectedCurrency === curr;
            return (
              <button
                key={curr}
                onClick={() => onSelectCurrency && onSelectCurrency(curr)}
                className={`px-2 py-0.5 rounded transition-all cursor-pointer ${
                  isSelected 
                    ? 'bg-white shadow-2xs text-indigo-600 font-bold' 
                    : 'text-slate-400 hover:text-slate-700'
                }`}
              >
                {curr}
              </button>
            );
          })}
        </div>
      </div>

      {/* 右側：搜尋框 + 快速新增按鈕 + 通知中心 + 使用者快速切換 */}
      <div className="flex items-center gap-2 sm:gap-3">
        
        {/* 全局搜尋框 */}
        <div className="relative hidden xl:block">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange && onSearchChange(e.target.value)}
            placeholder="搜尋單據、專案、科目..."
            className="bg-slate-50 border border-slate-200 rounded-md py-1 pl-8 pr-3 text-xs w-40 lg:w-48 outline-none focus:border-indigo-500 focus:bg-white transition-all text-slate-800 placeholder:text-slate-400"
          />
        </div>

        {/* 新增費用按鈕 */}
        <button
          id="header-new-expense-btn"
          onClick={onOpenCreateExpense}
          className="bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white px-3 py-1.5 rounded-md text-xs font-medium shadow-xs transition-colors flex items-center gap-1.5 shrink-0 cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>+ 填報費用</span>
        </button>

        {/* 通知中心鈴鐺 */}
        <div className="relative" ref={notifMenuRef}>
          <button
            onClick={() => setShowNotifMenu(!showNotifMenu)}
            className="p-1.5 rounded-md text-slate-500 hover:text-slate-800 hover:bg-slate-100 relative transition-colors cursor-pointer"
            title="系統通知與預警"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-white animate-pulse" />
            )}
          </button>

          {/* 通知下拉選單 */}
          {showNotifMenu && (
            <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-xl shadow-xl border border-slate-200 z-50 overflow-hidden text-xs animate-in fade-in">
              <div className="p-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                <span className="font-bold text-slate-900">系統即時通知 ({unreadCount} 則未讀)</span>
                {unreadCount > 0 && (
                  <button
                    onClick={() => {
                      onClearNotifications();
                      setShowNotifMenu(false);
                    }}
                    className="text-[11px] text-indigo-600 hover:underline cursor-pointer"
                  >
                    全部已讀
                  </button>
                )}
              </div>
              <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
                {notifications.length === 0 ? (
                  <div className="p-4 text-center text-slate-400">尚無任何新通知</div>
                ) : (
                  notifications.map((n) => (
                    <div
                      key={n.id}
                      onClick={() => onMarkNotificationRead(n.id)}
                      className={`p-3 transition-colors cursor-pointer ${
                        n.read ? 'bg-white opacity-70' : 'bg-indigo-50/40 hover:bg-indigo-50/70'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="font-bold text-slate-900 flex items-center gap-1.5">
                          {n.type === 'alert' || n.type === 'danger' ? (
                            <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
                          ) : n.type === 'warning' ? (
                            <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                          ) : (
                            <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                          )}
                          {n.title}
                        </div>
                        <span className="text-[10px] text-slate-400 shrink-0 font-mono">{n.timestamp}</span>
                      </div>
                      <p className="text-slate-600 text-[11px] mt-1 pl-3.5 leading-relaxed">{n.message}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* 🌟 頂部快速切換帳號選單 */}
        <div className="relative" ref={userMenuRef}>
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-2 pl-2 pr-2.5 py-1 rounded-lg border border-slate-200 hover:border-indigo-300 hover:bg-slate-50 transition-all cursor-pointer"
            title="切換使用者帳號"
          >
            <div className="w-7 h-7 rounded-full bg-slate-800 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs">
              {currentUser.englishName ? currentUser.englishName.substring(0, 2).toUpperCase() : currentUser.name.substring(0, 2)}
            </div>
            <div className="text-left hidden sm:block">
              <div className="text-xs font-bold text-slate-800 leading-none flex items-center gap-1">
                <span>{currentUser.name}</span>
                {currentUser.englishName && <span className="text-[10px] text-slate-500 font-normal">({currentUser.englishName})</span>}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5 leading-none">
                {currentPos.text}
              </div>
            </div>
            <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${showUserMenu ? 'rotate-180' : ''}`} />
          </button>

          {/* 使用者下拉切換清單 */}
          {showUserMenu && (
            <div className="absolute right-0 mt-2 w-64 sm:w-72 bg-white rounded-xl shadow-2xl border border-slate-200 z-50 overflow-hidden text-xs animate-in fade-in">
              <div className="p-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-slate-700 font-bold">
                  <Zap className="w-3.5 h-3.5 text-amber-500" />
                  <span>快速切換登入身分</span>
                </div>
                <span className="text-[10px] text-slate-400">點擊即切換</span>
              </div>

              <div className="max-h-64 overflow-y-auto p-1.5 space-y-1">
                {allUsers.filter(u => u.status === 'active').map((u) => {
                  const isCurrent = u.id === currentUser.id;
                  const uPos = getPositionLabel(u);
                  return (
                    <button
                      key={u.id}
                      onClick={() => {
                        if (onSwitchUser) onSwitchUser(u);
                        setShowUserMenu(false);
                      }}
                      className={`w-full text-left p-2 rounded-lg flex items-center justify-between transition-colors cursor-pointer ${
                        isCurrent
                          ? 'bg-indigo-50 text-indigo-900 font-bold border border-indigo-200'
                          : 'hover:bg-slate-100 text-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-7 h-7 rounded-full bg-slate-700 text-white flex items-center justify-center font-bold text-[11px] shrink-0">
                          {u.englishName ? u.englishName.substring(0, 2).toUpperCase() : u.name.substring(0, 2)}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1 truncate">
                            <span className="font-bold">{u.name}</span>
                            {u.englishName && <span className="text-slate-400 text-[10px]">({u.englishName})</span>}
                          </div>
                          <div className="text-[10px] text-slate-400 truncate">
                            {u.department}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${uPos.bg}`}>
                          {uPos.text}
                        </span>
                        {isCurrent && <span className="text-indigo-600 font-bold text-xs">✓</span>}
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="p-1.5 bg-slate-50 border-t border-slate-100 space-y-1">
                {onOpenChangePassword && (
                  <button
                    onClick={() => {
                      setShowUserMenu(false);
                      onOpenChangePassword();
                    }}
                    className="w-full text-left p-2 rounded-lg text-slate-700 hover:text-indigo-600 hover:bg-indigo-50/70 flex items-center gap-2 font-bold cursor-pointer transition-colors"
                  >
                    <KeyRound className="w-4 h-4 text-indigo-500" />
                    <span>自定義修改密碼 (Change Password)</span>
                  </button>
                )}

                {onLogout && (
                  <button
                    onClick={() => {
                      setShowUserMenu(false);
                      onLogout();
                    }}
                    className="w-full text-left p-2 rounded-lg text-rose-600 hover:bg-rose-50 flex items-center gap-2 font-bold cursor-pointer transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>登出系統 (Logout)</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

      </div>
    </header>
  );
};

