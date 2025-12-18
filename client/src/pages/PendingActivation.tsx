import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Clock, Mail, MessageCircle } from "lucide-react";

export default function PendingActivation() {
  const { user, logout } = useAuth();

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
            
            <p className="text-gray-600 mb-6">
              您好，{user?.name || '學員'}！您的帳號已成功註冊，目前正在等待管理員開通。
            </p>

            {/* Info Box */}
            <div className="bg-[#F8F9FA] rounded-xl p-4 mb-6 text-left">
              <h3 className="font-semibold text-[#0F345B] mb-2">開通流程說明</h3>
              <ul className="text-sm text-gray-600 space-y-2">
                <li className="flex items-start gap-2">
                  <span className="text-[#FCC80E] font-bold">1.</span>
                  確認您已完成課程付款
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#FCC80E] font-bold">2.</span>
                  聯繫幕創行銷客服提供您的註冊 Email
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#FCC80E] font-bold">3.</span>
                  管理員將在 24 小時內為您開通帳號
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
                href="#" 
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

        {/* Footer */}
        <p className="text-center text-white/50 text-sm mt-6">
          © 2024 幕創行銷 MOVE STRONG
        </p>
      </div>
    </div>
  );
}
