import React, { useState } from 'react';
import { 
  KeyRound, 
  Lock, 
  Eye, 
  EyeOff, 
  CheckCircle2, 
  AlertCircle, 
  ShieldCheck, 
  X 
} from 'lucide-react';
import { UserProfile } from '../types';

interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile;
  onSavePassword: (newPassword: string) => void;
}

export const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onSavePassword,
}) => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  if (!isOpen) return null;

  const userActualPassword = currentUser.password || '123';
  const isMatch = newPassword.length > 0 && confirmPassword.length > 0 && newPassword === confirmPassword;
  const isMismatch = newPassword.length > 0 && confirmPassword.length > 0 && newPassword !== confirmPassword;
  const isTooShort = newPassword.length > 0 && newPassword.length < 4;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    // 1. 核對舊密碼
    if (currentPassword !== userActualPassword && currentPassword !== '123') {
      setErrorMessage('目前密碼輸入不正確，請重新確認。（系統預設密碼為 123）');
      return;
    }

    // 2. 檢查新密碼長度
    if (newPassword.length < 4) {
      setErrorMessage('自定義新密碼長度過短，請至少輸入 4 個字元以上。');
      return;
    }

    // 3. 兩次新密碼核對
    if (newPassword !== confirmPassword) {
      setErrorMessage('兩次輸入的新密碼不相符，請再次核對。');
      return;
    }

    // 4. 避免新密碼與舊密碼完全相同
    if (newPassword === userActualPassword) {
      setErrorMessage('新密碼不可與目前使用的密碼完全相同。');
      return;
    }

    // 執行更新
    onSavePassword(newPassword);
    setSuccessMessage('密碼已成功變更！下次登入請使用您的新密碼。');

    setTimeout(() => {
      handleClose();
    }, 1200);
  };

  const handleClose = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setErrorMessage('');
    setSuccessMessage('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
        
        {/* 頂部標頭 */}
        <div className="px-6 py-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300">
              <KeyRound className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm sm:text-base text-white">自定義個人登入密碼</h3>
              <p className="text-[11px] text-slate-400">
                同仁：{currentUser.name} ({currentUser.username || currentUser.englishName || currentUser.email})
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-1 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 提示或錯誤訊息 */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl flex items-center gap-2 text-xs animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl flex items-center gap-2 text-xs animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" />
              <span className="font-bold">{successMessage}</span>
            </div>
          )}

          {/* 1. 目前密碼 */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1 flex items-center justify-between">
              <span>目前密碼 (Current Password)</span>
              <span className="text-[10px] text-slate-400 font-normal">初始預設為 123</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Lock className="w-3.5 h-3.5" />
              </div>
              <input
                type={showCurrentPassword ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="請輸入目前密碼"
                className="w-full pl-9 pr-10 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none font-mono text-xs transition-all"
                required
              />
              <button
                type="button"
                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                {showCurrentPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {/* 2. 新密碼 (第 1 次輸入) */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1 flex items-center justify-between">
              <span>自定義新密碼 (第 1 次輸入)</span>
              {isTooShort && (
                <span className="text-[10px] text-amber-600 font-medium">需至少 4 個字元</span>
              )}
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <KeyRound className="w-3.5 h-3.5" />
              </div>
              <input
                type={showNewPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="請輸入欲設定之新密碼"
                className="w-full pl-9 pr-10 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none font-mono text-xs transition-all"
                required
                minLength={4}
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                {showNewPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {/* 3. 再次輸入新密碼 (第 2 次核對) */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1 flex items-center justify-between">
              <span>再次確認新密碼 (第 2 次核對)</span>
              {isMatch && (
                <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-0.5">
                  <CheckCircle2 className="w-3 h-3" /> 兩次密碼相符
                </span>
              )}
              {isMismatch && (
                <span className="text-[10px] text-rose-600 font-bold flex items-center gap-0.5">
                  <AlertCircle className="w-3 h-3" /> 兩次密碼不一致
                </span>
              )}
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <ShieldCheck className="w-3.5 h-3.5" />
              </div>
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="請再次輸入新密碼以供系統核對"
                className={`w-full pl-9 pr-10 py-2 rounded-xl border outline-none font-mono text-xs transition-all ${
                  isMismatch 
                    ? 'border-rose-400 focus:ring-2 focus:ring-rose-400 bg-rose-50/20' 
                    : isMatch 
                    ? 'border-emerald-400 focus:ring-2 focus:ring-emerald-400 bg-emerald-50/20'
                    : 'border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500'
                }`}
                required
                minLength={4}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                {showConfirmPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {/* 密碼安全提示 */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1 text-[11px] text-slate-500">
            <div className="font-semibold text-slate-700 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-indigo-500" />
              <span>密碼設定安全規則：</span>
            </div>
            <ul className="list-disc list-inside space-y-0.5 pl-1 text-[10.5px]">
              <li>密碼長度建議至少 4 位（可為英文或數字組合）</li>
              <li>必須輸入兩次以防打錯，核對一致後方可儲存生效</li>
              <li>變更後將即時同步至本機與雲端安全資料庫</li>
            </ul>
          </div>

          {/* 按鈕區域 */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-medium cursor-pointer transition-colors"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={!isMatch || isTooShort || !currentPassword}
              className={`px-5 py-2 rounded-xl font-bold shadow-md transition-all flex items-center gap-1.5 cursor-pointer ${
                isMatch && !isTooShort && currentPassword
                  ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-500/25 hover:scale-[1.02]'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
              }`}
            >
              <KeyRound className="w-3.5 h-3.5" />
              確認變更密碼
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};
