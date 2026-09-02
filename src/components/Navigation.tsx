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
  ShieldCheck
} from 'lucide-react';
import { UserRole } from '../types';

interface NavigationProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  userRole: UserRole;
  pendingApprovalCount: number;
  budgetWarningCount: number;
}

export const Navigation: React.FC<NavigationProps> = ({
  activeTab,
  setActiveTab,
  userRole,
  pendingApprovalCount,
  budgetWarningCount,
}) => {
  const tabs = [
    {
      id: 'dashboard',
      label: '總覽儀表板',
      icon: LayoutDashboard,
      badge: budgetWarningCount > 0 ? `${budgetWarningCount} 預警` : null,
      badgeColor: 'bg-amber-100 text-amber-800 border-amber-200',
    },
    {
      id: 'expenses',
      label: '費用報支清單',
      icon: Receipt,
    },
    {
      id: 'approvals',
      label: '審批工作流',
      icon: CheckSquare,
      badge: pendingApprovalCount > 0 ? `${pendingApprovalCount} 待審` : null,
      badgeColor: 'bg-blue-100 text-blue-800 border-blue-200',
    },
    {
      id: 'scanner',
      label: '發票影像識別',
      icon: ScanLine,
      highlight: true,
    },
    {
      id: 'recurring',
      label: '每月固定支出',
      icon: Repeat,
    },
    {
      id: 'projects',
      label: '專案預算管理',
      icon: Briefcase,
    },
    {
      id: 'reports',
      label: '分類統計報表',
      icon: BarChart3,
    },
    {
      id: 'masterData',
      label: '基本資料設定',
      icon: Database,
      adminOnly: true,
    },
    {
      id: 'audit',
      label: '稽核歷程與備份',
      icon: ShieldCheck,
      adminOnly: true,
    },
  ];

  return (
    <div className="bg-white border-b border-slate-200 shadow-2xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <nav className="flex space-x-1 sm:space-x-2 overflow-x-auto py-2.5 no-scrollbar" aria-label="Tabs">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            const isRestricted = tab.adminOnly && userRole === 'editor';

            return (
              <button
                key={tab.id}
                id={`tab-btn-${tab.id}`}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm font-medium rounded-lg whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                } ${isRestricted ? 'opacity-60' : ''}`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-500'}`} />
                <span>{tab.label}</span>
                
                {tab.badge && (
                  <span className={`ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-semibold border ${
                    isActive ? 'bg-white/20 text-white border-white/30' : tab.badgeColor
                  }`}>
                    {tab.badge}
                  </span>
                )}

                {isRestricted && (
                  <span className="text-[10px] bg-slate-100 text-slate-500 px-1 rounded ml-0.5">
                    管理員
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
};
