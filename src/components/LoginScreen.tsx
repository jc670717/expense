import React, { useState } from 'react';
import { 
  Building2, 
  Lock, 
  User, 
  ShieldCheck, 
  ArrowRight, 
  Eye, 
  EyeOff, 
  CheckCircle2, 
  AlertCircle
} from 'lucide-react';
import { UserProfile } from '../types';

interface LoginScreenProps {
  users: UserProfile[];
  onLogin: (user: UserProfile) => void;
  onResetUsers?: () => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ users, onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
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
      setErrorMessage('請輸入帳號。');
      return;
    }

    // 寬容搜尋匹配：支援 username, englishName, 中文 name, email
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
      return false;
    });

    if (!foundUser) {
      setErrorMessage(`查無此帳號「${username}」，請確認後重新輸入。`);
      return;
    }

    // 檢查在職狀態
    if (foundUser.status === 'inactive') {
      setErrorMessage(`同仁「${foundUser.name}」目前狀態為【離職/停用】，系統已停止其存取權限。`);
      return;
    }

    // 密碼檢查（支援 123 萬用示範密碼或同仁自設密碼）
    const userPass = foundUser.password || '123';
    if (password && password !== userPass && password !== '123') {
      setErrorMessage('密碼不正確，請重新輸入。');
      return;
    }

    setSuccessMessage(`驗證成功！正在以【${foundUser.name} (${foundUser.englishName || foundUser.username})】身分登入...`);
    setTimeout(() => {
      onLogin(foundUser);
    }, 200);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-4 sm:p-6 relative overflow-hidden">
      {/* 背景光暈裝飾 */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-80 h-80 bg-blue-600/10 rounded-full blur-2xl pointer-events-none" />
      <div className="absolute top-10 left-10 w-72 h-72 bg-purple-600/10 rounded-full blur-2xl pointer-events-none" />

      <div className="w-full max-w-md bg-slate-900/90 backdrop-blur-md rounded-2xl border border-slate-800 shadow-2xl p-6 sm:p-8 relative z-10 space-y-6">
        
        {/* 系統 Logo 與標題 */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-tr from-indigo-600 to-blue-500 text-white font-black text-xl shadow-lg shadow-indigo-500/25 mb-1">
            <Building2 className="w-6 h-6" />
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
            邦捷費用登記系統
          </h1>
          <p className="text-xs text-slate-400">
            請輸入使用者帳號與密碼進行驗證登入
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

        {/* 帳密登入表單 */}
        <form onSubmit={handleLoginSubmit} className="space-y-4 text-xs">
          <div className="space-y-3.5">
            <div>
              <label className="block text-slate-300 font-semibold mb-1.5">
                帳號
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="請輸入帳號"
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-950/80 border border-slate-800 rounded-xl text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-xs transition-all"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1.5 flex items-center justify-between">
                <span>密碼</span>
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
            className="w-full py-2.5 mt-2 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-600/30 transition-all flex items-center justify-center gap-2 text-xs cursor-pointer"
          >
            <span>登入系統</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        {/* 底部資安標籤 */}
        <div className="pt-2 border-t border-slate-800 flex items-center justify-center text-[11px] text-slate-500">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>三級身分權限控管 (RBAC)</span>
          </div>
        </div>

      </div>
    </div>
  );
};

