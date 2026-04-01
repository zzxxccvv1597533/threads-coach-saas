import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Clock, Mail, MessageCircle, Ticket, CheckCircle, Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

export default function PendingActivation() {
  const { user, logout } = useAuth();
  const [invitationCode, setInvitationCode] = useState("");
  const [showCodeInput, setShowCodeInput] = useState(true);

  const applyCodeMutation = trpc.auth.applyInvitationCode.useMutation({
    onSuccess: () => {
      toast.success("帳號已成功開通！");
      // 重新載入頁面以更新狀態
      window.location.reload();
    },
    onError: (error) => {
      toast.error(error.message || "邀請碼無效");
    },
  });

  const handleApplyCode = () => {
    if (!invitationCode.trim()) {
      toast.error("請輸入邀請碼");
      return;
    }
    applyCodeMutation.mutate({ code: invitationCode.trim().toUpperCase() });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0F345B] via-[#0F345B] to-[#0a2540] flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Logo */}
        <div className="text-center mb-8">
          <img 
            src="/images/logo-horizontal-white.png" 
            alt="幕創行銷" 
            className="h-12 mx-auto mb-6"
          />
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <div className="text-center">
            {/* Icon */}
            <div className="w-16 h-16 rounded-full bg-[#FCC80E]/10 flex items-center justify-center mx-auto mb-6">
              <Clock className="w-8 h-8 text-[#FCC80E]" />
            </div>

            <h1 className="text-2xl font-bold text-[#0F345B] mb-3">
              帳號等待開通中
            </h1>
            
            <p className="text-gray-600 mb-2">
              您好，{user?.name || '學員'}！您的帳號已成功註冊，目前正在等待管理員開通。
            </p>

            <p className="text-sm text-gray-500 mb-6">
              通常 2-4 小時內開通，急需使用請聯繫客服
            </p>

            {/* 邀請碼輸入區塊 */}
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-6">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Ticket className="w-5 h-5 text-emerald-600" />
                  <h3 className="font-semibold text-emerald-800">輸入邀請碼</h3>
                </div>
                <button
                  onClick={() => setShowCodeInput(!showCodeInput)}
                  className="text-xs text-emerald-600 hover:text-emerald-800 transition-colors"
                >
                  {showCodeInput ? "隱藏邀請碼輸入" : "我有邀請碼"}
                </button>
              </div>
              {showCodeInput && (
                <div className="space-y-3">
                  <Input
                    placeholder="請輸入邀請碼"
                    value={invitationCode}
                    onChange={(e) => setInvitationCode(e.target.value.toUpperCase())}
                    className="text-center font-mono text-lg tracking-wider"
                  />
                  <Button
                    onClick={handleApplyCode}
                    disabled={applyCodeMutation.isPending || !invitationCode.trim()}
                    className="w-full bg-emerald-600 hover:bg-emerald-700"
                  >
                    {applyCodeMutation.isPending ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" />驗證中...</>
                    ) : (
                      <><CheckCircle className="w-4 h-4 mr-2" />確認開通</>
                    )}
                  </Button>
                </div>
              )}
            </div>

            {/* Info Box */}
            <div className="bg-[#F8F9FA] rounded-xl p-4 mb-6 text-left">
              <h3 className="font-semibold text-[#0F345B] mb-2">開通流程說明</h3>
              <ul className="text-sm text-gray-600 space-y-2">
                <li className="flex items-start gap-2">
                  <span className="text-[#FCC80E] font-bold">1.</span>
                  如果您有邀請碼，輸入上方欄位即可立即開通
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#FCC80E] font-bold">2.</span>
                  沒有邀請碼？請聯繫幕創行銷客服取得
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#FCC80E] font-bold">3.</span>
                  或等待管理員在 24 小時內為您開通帳號
                </li>
              </ul>
            </div>

            {/* Contact Info */}
            <div className="space-y-3 mb-6">
              <a 
                href="mailto:support@movestrong.tw" 
                className="flex items-center justify-center gap-2 text-[#0F345B] hover:text-[#2796B2] transition-colors"
              >
                <Mail className="w-4 h-4" />
                <span className="text-sm">support@movestrong.tw</span>
              </a>
              <a
                href="https://line.me/R/ti/p/@557wkrxb"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 text-[#0F345B] hover:text-[#2796B2] transition-colors"
              >
                <MessageCircle className="w-4 h-4" />
                <span className="text-sm">LINE 客服</span>
              </a>
            </div>

            {/* Actions */}
            <div className="space-y-3">
              <Button 
                onClick={() => window.location.reload()}
                className="w-full bg-[#0F345B] hover:bg-[#0F345B]/90"
              >
                重新檢查開通狀態
              </Button>
              <Button 
                variant="outline"
                onClick={logout}
                className="w-full"
              >
                登出
              </Button>
            </div>
          </div>
        </div>

        {/* 等待時可以做的事 */}
        <div className="bg-white/10 rounded-xl p-5 mt-4">
          <p className="text-white/80 text-sm font-medium mb-3">等待開通的同時，你可以先：</p>
          <ul className="space-y-2">
            <li className="text-white/70 text-sm">
              📖 了解我們的方法論（開通後系統內有完整說明）
            </li>
            <li className="text-white/70 text-sm">
              📝 想想你的 IP 定位（職業、受眾、專長）
            </li>
          </ul>
        </div>

        {/* Footer */}
        <p className="text-center text-white/50 text-sm mt-6">
          © 2024 幕創行銷 MOVE STRONG
        </p>
      </div>
    </div>
  );
}
