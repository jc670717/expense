import React from 'react';
import { 
  LayoutDashboard, 
  Receipt, 
  CheckSquare, 
  ScanLine, 
  Repeat, 
  Briefcase, 
  BarChart3, 
  Database, 
  ShieldCheck,
  ChevronDown,
  UserCheck,
  Shield,
  User,
  LogOut,
  Sparkles,
  Building2,
  KeyRound
} from 'lucide-react';
import { UserProfile, UserRole } from '../types';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  currentUser: UserProfile;
  allUsers: UserProfile[];
  onSwitchUser: (user: UserProfile) => void;
  onLogout?: () => void;
  onOpenChangePassword?: () => void;
  pendingApprovalCount: number;
  budgetWarningCount: number;
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  currentUser,
  allUsers,
  onSwitchUser,
  onLogout,
  onOpenChangePassword,
  pendingApprovalCount,
  budgetWarningCount,
  isOpenMobile = false,
  onCloseMobile,
}) => {
  const [showUserDropdown, setShowUserDropdown] = React.useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowUserDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getPositionBadge = (user: UserProfile) => {
    const pos = user.position || (user.role as string);
    switch (pos) {
      case 'admin':
        return <span className="text-[10px] text-purple-400 font-bold tracking-wider uppercase">最高管理 (Admin)</span>;
      case 'auditor':
        return <span className="text-[10px] text-sky-400 font-bold tracking-wider uppercase">部門管理 (Auditor)</span>;
      case 'editor':
      default:
        return <span className="text-[10px] text-emerald-400 font-bold tracking-wider uppercase">一般員工 (Editor)</span>;
    }
  };

  // 定義全部導航群組與項目
  const allNavGroups = [
    {
      groupTitle: 'MANAGEMENT (經營管理)',
      items: [
        {
          id: 'dashboard',
          label: '總覽儀表板',
          icon: LayoutDashboard,
          badge: budgetWarningCount > 0 ? `${budgetWarningCount} 預警` : null,
          badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
        },
        {
          id: 'projects',
          label: '專案預算管理',
          icon: Briefcase,
          badge: null,
        },
        {
          id: 'masterData',
          label: '基礎資料建檔',
          icon: Database,
          adminOnly: true,
          badge: null,
        },
      ],
    },
    {
      groupTitle: 'FINANCE (財務報支)',
      items: [
        {
          id: 'expenses',
          label: '費用報支清單',
          icon: Receipt,
          badge: null,
        },
        {
          id: 'approvals',
          label: '審批簽核中心',
          icon: CheckSquare,
          badge: pendingApprovalCount > 0 ? `${pendingApprovalCount} 待審` : null,
          badgeColor: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
        },
        {
          id: 'scanner',
          label: 'AI 發票影像辨識',
          icon: ScanLine,
          badge: 'OCR',
          badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
        },
        {
          id: 'recurring',
          label: '每月固定支出',
          icon: Repeat,
          badge: null,
        },
        {
          id: 'reports',
          label: '財務報表與分析',
          icon: BarChart3,
          badge: null,
        },
      ],
    },
    {
      groupTitle: 'ADMIN & AUDIT (系統稽核)',
      items: [
        {
          id: 'audit',
          label: '操作歷程與備份',
          icon: ShieldCheck,
          adminOnly: true,
          badge: null,
        },
      ],
    },
  ];

  // 根據使用者的 allowedTabs 過濾導航選單 (若未定義則預設全部)
  const allowed = currentUser.allowedTabs;

  const filteredNavGroups = allNavGroups.map(group => {
    const visibleItems = group.items.filter(item => {
      // 若有 allowedTabs 設定，必須包含在 allowedTabs 內
      if (allowed && allowed.length > 0) {
        return allowed.includes(item.id);
      }
      // 預設角色限制：masterData 與 audit 僅 admin / auditor 可見
      if (item.adminOnly && currentUser.role === 'editor') {
        return false;
      }
      return true;
    });
    return {
      ...group,
      items: visibleItems,
    };
  }).filter(group => group.items.length > 0);

  const handleSelectTab = (tabId: string) => {
    setActiveTab(tabId);
    if (onCloseMobile) onCloseMobile();
  };

  return (
    <>
      {/* 行動裝置遮罩 */}
      {isOpenMobile && (
        <div 
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-40 lg:hidden"
          onClick={onCloseMobile}
        />
      )}

      <aside className={`
        fixed lg:static top-0 bottom-0 left-0 z-50
        w-64 bg-[#0f172a] text-slate-300 flex flex-col shrink-0 border-r border-slate-800/80
        transition-transform duration-200 ease-in-out
        ${isOpenMobile ? 'translate-x-0 shadow-2xl' : '-translate-x-full lg:translate-x-0'}
      `}>
        {/* Brand Header */}
        <div className="p-5 flex items-center justify-between border-b border-slate-800/60">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold text-base shadow-sm shadow-indigo-500/20">
              E
            </div>
            <div>
              <span className="text-white font-bold text-base tracking-tight block leading-tight">
                Expensify Pro
              </span>
              <span className="text-[10px] text-slate-400 font-medium tracking-tight">
                邦捷費用登記系統
              </span>
            </div>
          </div>
          {onCloseMobile && (
            <button 
              onClick={onCloseMobile} 
              className="lg:hidden text-slate-400 hover:text-white p-1"
            >
              ✕
            </button>
          )}
        </div>

        {/* Navigation Groups (依權限過濾) */}
        <nav className="flex-1 px-3 py-4 space-y-4 overflow-y-auto no-scrollbar">
          {filteredNavGroups.map((group, gIdx) => (
            <div key={gIdx} className="space-y-1">
              <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1.5 px-3">
                {group.groupTitle}
              </div>
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;

                return (
                  <button
                    key={item.id}
                    id={`nav-${item.id}`}
                    onClick={() => handleSelectTab(item.id)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-xs sm:text-sm font-medium transition-all cursor-pointer ${
                      isActive
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/70'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                      <span className="truncate">{item.label}</span>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {item.badge && (
                        <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold border ${
                          isActive ? 'bg-white/20 text-white border-white/30' : (item.badgeColor || 'bg-slate-800 text-slate-400')
                        }`}>
                          {item.badge}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        {/* User Card at bottom */}
        <div className="p-3.5 mt-auto border-t border-slate-800/80 bg-slate-950/40 relative" ref={dropdownRef}>
          <div 
            onClick={() => setShowUserDropdown(!showUserDropdown)}
            className="flex items-center justify-between p-1.5 rounded-lg hover:bg-slate-800/60 cursor-pointer transition-colors"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-full bg-slate-700 border border-slate-600 flex items-center justify-center font-bold text-white text-xs shrink-0 shadow-2xs">
                {currentUser.englishName ? currentUser.englishName.substring(0, 2).toUpperCase() : currentUser.name.substring(0, 2)}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1">
                  <p className="text-xs font-semibold text-white truncate leading-tight">
                    {currentUser.name}
                  </p>
                  {currentUser.englishName && (
                    <span className="text-[10px] text-slate-400">({currentUser.englishName})</span>
                  )}
                </div>
                {getPositionBadge(currentUser)}
              </div>
            </div>
            <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${showUserDropdown ? 'rotate-180' : ''}`} />
          </div>

          {/* Switch User Popover & Logout */}
          {showUserDropdown && (
            <div className="absolute bottom-16 left-2 right-2 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-2 z-50 space-y-1 animate-in fade-in">
              <div className="px-2 py-1 text-[10px] font-bold text-indigo-300 uppercase tracking-wider flex items-center justify-between">
                <span>快速切換登入身分</span>
                <span className="text-slate-500 font-normal">點擊切換</span>
              </div>
              
              <div className="max-h-56 overflow-y-auto space-y-1 pr-1">
                {allUsers.filter(u => u.status === 'active').map((u) => {
                  const isCurrent = currentUser.id === u.id;
                  return (
                    <button
                      key={u.id}
                      onClick={() => {
                        onSwitchUser(u);
                        setShowUserDropdown(false);
                      }}
                      className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs flex items-center justify-between cursor-pointer transition-colors ${
                        isCurrent 
                          ? 'bg-indigo-600 text-white font-bold' 
                          : 'text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      <div className="min-w-0 pr-1">
                        <div className="flex items-center gap-1">
                          <span className="truncate">{u.name}</span>
                          {u.englishName && <span className="text-[10px] opacity-75">({u.englishName})</span>}
                        </div>
                        <div className="text-[10px] opacity-75 truncate">{u.roleTitle.split('/')[0]}</div>
                      </div>
                      {isCurrent && <span className="text-xs font-bold shrink-0">✓</span>}
                    </button>
                  );
                })}
              </div>

              <div className="pt-1.5 border-t border-slate-800 mt-1 space-y-1">
                {onOpenChangePassword && (
                  <button
                    onClick={() => {
                      setShowUserDropdown(false);
                      onOpenChangePassword();
                    }}
                    className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs text-slate-300 hover:text-white hover:bg-slate-800 flex items-center gap-1.5 cursor-pointer font-bold transition-colors"
                  >
                    <KeyRound className="w-3.5 h-3.5 text-indigo-400" />
                    <span>自定義修改密碼</span>
                  </button>
                )}

                {onLogout && (
                  <button
                    onClick={() => {
                      setShowUserDropdown(false);
                      onLogout();
                    }}
                    className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs text-rose-400 hover:bg-rose-950/40 flex items-center gap-1.5 cursor-pointer font-bold transition-colors"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>登出系統 (Logout)</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </aside>
    </>
  );
};
