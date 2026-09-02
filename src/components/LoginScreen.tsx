import React, { useState } from 'react';
import { 
  Building2, 
  Lock, 
  User, 
  ShieldCheck, 
  ArrowRight, 
  Eye, 
  EyeOff, 
  Sparkles, 
  CheckCircle2, 
  AlertCircle,
  Zap,
  RotateCcw,
  Shield,
  Briefcase,
  UserCheck
} from 'lucide-react';
import { UserProfile } from '../types';

interface LoginScreenProps {
  users: UserProfile[];
  onLogin: (user: UserProfile) => void;
  onResetUsers?: () => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ users, onLogin, onResetUsers }) => {
  const [username, setUsername] = useState('kim');
  const [password, setPassword] = useState('123');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // 登入驗證處理
  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    const trimmedInput = username.trim().toLowerCase();
    
    if (!trimmedInput) {
      setErrorMessage('請輸入使用者帳號、英文名或中文姓名。');
      return;
    }

    // 寬容搜尋匹配：支援 username, englishName, 中文 name, email, 或是角色關鍵字 (admin, auditor, editor)
    const foundUser = users.find(u => {
      const uName = (u.name || '').toLowerCase();
      const uEng = (u.englishName || '').toLowerCase();
      const uUser = (u.username || '').toLowerCase();
      const uEmail = (u.email || '').toLowerCase();
      const uId = (u.id || '').toLowerCase();
      
      if (uUser === trimmedInput || uEng === trimmedInput || uName === trimmedInput || uId === trimmedInput) {
        return true;
      }
      if (uEmail.split('@')[0] === trimmedInput) {
        return true;
      }
      // 角色快捷輸入
      if (trimmedInput === 'admin' && (u.position === 'admin' || u.role === 'admin')) return true;
      if (trimmedInput === 'auditor' && (u.position === 'auditor' || u.role === 'auditor')) return true;
      if (trimmedInput === 'editor' && (u.position === 'editor' || u.role === 'editor')) return true;
      return false;
    });

    if (!foundUser) {
      setErrorMessage(`找不到帳號「${username}」，可使用下方「一鍵快速登入」或輸入 kim / leon / andy。`);
      return;
    }

    // 檢查在職狀態
    if (foundUser.status === 'inactive') {
      setErrorMessage(`同仁「${foundUser.name}」目前狀態為【離職/停用】，系統已依法停止其存取權限。`);
      return;
    }

    // 密碼檢查（支援 123 萬用示範密碼或自設密碼）
    const userPass = foundUser.password || '123';
    if (password && password !== userPass && password !== '123') {
      setErrorMessage('密碼不正確，預設示範密碼為 123。');
      return;
    }

    setSuccessMessage(`驗證成功！正在以【${foundUser.name} (${foundUser.englishName || foundUser.username})】身分登入...`);
    setTimeout(() => {
      onLogin(foundUser);
    }, 200);
  };

  // 一鍵直接登入
  const handleDirectLogin = (user: UserProfile) => {
    if (user.status === 'inactive') {
      setErrorMessage(`同仁「${user.name}」目前狀態為【離職/停用】，無法以此身分登入。`);
      return;
    }
    setErrorMessage('');
    setSuccessMessage(`正在以【${user.name} (${user.englishName || user.username})】快速登入...`);
    setTimeout(() => {
      onLogin(user);
    }, 150);
  };

  // 填入表單
  const handleFillForm = (user: UserProfile) => {
    setUsername(user.username || user.englishName?.toLowerCase() || user.name);
    setPassword(user.password || '123');
    setErrorMessage('');
  };

  const getPositionBadge = (pos: string) => {
    switch (pos) {
      case 'admin':
        return <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">最高管理</span>;
      case 'auditor':
        return <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-sky-500/20 text-sky-300 border border-sky-500/30">部門管理</span>;
      case 'editor':
      default:
        return <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">一般員工</span>;
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-4 sm:p-6 relative overflow-hidden">
      {/* 科技幾何背景光暈裝飾 */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-indigo-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-96 h-96 bg-blue-600/10 rounded-full blur-2xl pointer-events-none" />
      <div className="absolute top-10 left-10 w-80 h-80 bg-purple-600/10 rounded-full blur-2xl pointer-events-none" />

      <div className="w-full max-w-2xl bg-slate-900/90 backdrop-blur-md rounded-2xl border border-slate-800 shadow-2xl p-6 sm:p-8 relative z-10 space-y-6">
        
        {/* 系統 Logo 與標題 */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-tr from-indigo-600 to-blue-500 text-white font-black text-xl shadow-lg shadow-indigo-500/25 mb-1">
            <Building2 className="w-6 h-6" />
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
            企業公務費用登記與審批系統
          </h1>
          <p className="text-xs text-slate-400">
            請選擇展示帳號一鍵登入，或輸入同仁帳號密碼驗證
          </p>
        </div>

        {/* 錯誤/成功訊息提示 */}
        {errorMessage && (
          <div className="p-3 bg-rose-500/15 border border-rose-500/30 rounded-xl flex items-center gap-2.5 text-xs text-rose-300 animate-in fade-in">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span className="font-medium">{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div className="p-3 bg-emerald-500/15 border border-emerald-500/30 rounded-xl flex items-center gap-2.5 text-xs text-emerald-300 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            <span className="font-medium">{successMessage}</span>
          </div>
        )}

        {/* 1. 🚀 一鍵快速登入身分卡片區 (重點推薦) */}
        <div className="space-y-3 bg-slate-950/60 p-4 rounded-xl border border-slate-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-300">
              <Zap className="w-4 h-4 text-amber-400" />
              <span>快速切換身分（點擊卡片直接一鍵登入）：</span>
            </div>
            <span className="text-[10px] text-slate-500 font-mono">預設密碼 123</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {users.slice(0, 6).map((u) => {
              const isInactive = u.status === 'inactive';
              return (
                <div
                  key={u.id}
                  className={`p-3 rounded-xl border transition-all flex flex-col justify-between text-left group ${
                    isInactive
                      ? 'bg-slate-950/30 border-slate-800/50 opacity-60'
                      : 'bg-slate-900/80 border-slate-800 hover:border-indigo-500/80 hover:bg-indigo-950/30'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-white text-[10px] bg-gradient-to-tr ${u.avatarBg || 'from-indigo-600 to-blue-600'}`}>
                          {u.englishName ? u.englishName.substring(0, 2).toUpperCase() : u.name.substring(0, 2)}
                        </div>
                        <span className="font-bold text-xs text-white truncate">
                          {u.name}
                        </span>
                      </div>
                      {getPositionBadge(u.position || u.role)}
                    </div>
                    
                    <div className="text-[11px] text-slate-400 font-mono flex items-center justify-between">
                      <span>帳號: {u.username || u.englishName?.toLowerCase()}</span>
                      {u.englishName && <span className="text-slate-500">({u.englishName})</span>}
                    </div>
                    <div className="text-[10px] text-slate-500 truncate mt-0.5">
                      {u.department}
                    </div>
                  </div>

                  <div className="mt-3 pt-2 border-t border-slate-800/80 flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleDirectLogin(u)}
                      disabled={isInactive}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer ${
                        isInactive
                          ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                          : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-xs group-hover:scale-[1.02]'
                      }`}
                    >
                      <Zap className="w-3 h-3 text-amber-300" />
                      <span>{isInactive ? '已停用' : '一鍵登入'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleFillForm(u)}
                      title="代入帳密表單"
                      className="px-2 py-1.5 rounded-lg text-xs text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                    >
                      代入
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 2. 手動帳密登入表單 */}
        <form onSubmit={handleLoginSubmit} className="space-y-4 text-xs pt-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-semibold mb-1.5 flex items-center justify-between">
                <span>同仁帳號 / 英文名 / 姓名</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="如 kim / leon / andy / 簡晨宇"
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-950/80 border border-slate-800 rounded-xl text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-xs transition-all"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1.5 flex items-center justify-between">
                <span>登入密碼</span>
                <span className="text-[10px] text-indigo-400">預設密碼皆為 123</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="請輸入密碼"
                  className="w-full pl-9 pr-10 py-2.5 bg-slate-950/80 border border-slate-800 rounded-xl text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-xs transition-all font-mono"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-slate-300 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-600/30 transition-all flex items-center justify-center gap-2 text-xs cursor-pointer"
          >
            <span>以輸入之帳號密碼登入</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        {/* 底部資安標籤與重置 */}
        <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-500">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>三級身分權限控管 (RBAC) • 完整操作日誌稽核</span>
          </div>
          {onResetUsers && (
            <button
              type="button"
              onClick={onResetUsers}
              className="text-slate-400 hover:text-indigo-300 flex items-center gap-1 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span>重置同仁名冊</span>
            </button>
          )}
        </div>

      </div>
    </div>
  );
};

