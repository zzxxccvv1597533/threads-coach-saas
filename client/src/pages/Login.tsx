import { useState } from "react";
import { useLocation, Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Eye, EyeOff, LogIn, ArrowLeft, AlertTriangle, RefreshCw } from "lucide-react";
import { isDatabaseError } from "@/lib/errorUtils";

export default function Login() {
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showMaintenanceAlert, setShowMaintenanceAlert] = useState(false);

  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: (data) => {
      toast.success("登入成功！");
      setShowMaintenanceAlert(false);
      // 根據角色重定向
      if (data.user.role === 'admin') {
        setLocation('/admin');
      } else {
        setLocation('/dashboard');
      }
    },
    onError: (error) => {
      // 檢查是否為資料庫錯誤
      if (isDatabaseError(error)) {
        setShowMaintenanceAlert(true);
        toast.error("系統暫時無法連線，請稍後再試");
      } else {
        toast.error(error.message || "登入失敗");
      }
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error("請填寫所有欄位");
      return;
    }
    setShowMaintenanceAlert(false);
    loginMutation.mutate({ email, password });
  };

  const handleRetry = () => {
    setShowMaintenanceAlert(false);
    if (email && password) {
      loginMutation.mutate({ email, password });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0F345B] via-[#0F345B] to-[#0a2540] flex flex-col">
      {/* 返回首頁連結 */}
      <div className="container py-6">
        <Link href="/" className="inline-flex items-center gap-2 text-white/70 hover:text-white transition-colors">
            <ArrowLeft className="w-4 h-4" />
            返回首頁
        </Link>
      </div>

      {/* 登入表單 */}
      <div className="flex-1 flex items-center justify-center px-4 pb-20">
        <Card className="w-full max-w-md border-0 shadow-2xl">
          <CardHeader className="text-center pb-2">
            <div className="flex justify-center mb-4">
              <img 
                src="/images/logo-horizontal.png" 
                alt="幕創行銷" 
                className="h-10 object-contain"
              />
            </div>
            <CardTitle className="text-2xl text-[#0F345B]">學員登入</CardTitle>
            <CardDescription>
              登入您的幕創行銷 Threads AI 教練帳號
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* 系統維護提示 */}
            {showMaintenanceAlert && (
              <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-amber-800">系統維護中</p>
                    <p className="text-xs text-amber-600 mt-1">
                      我們正在進行系統維護，請稍後再試。通常會在 5-30 分鐘內恢復。
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleRetry}
                      disabled={loginMutation.isPending}
                      className="mt-2 text-amber-700 border-amber-300 hover:bg-amber-100"
                    >
                      <RefreshCw className={`w-3 h-3 mr-1 ${loginMutation.isPending ? 'animate-spin' : ''}`} />
                      重新嘗試
                    </Button>
                  </div>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">密碼</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="請輸入密碼"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <Button 
                type="submit" 
                className="w-full bg-[#0F345B] hover:bg-[#0F345B]/90"
                disabled={loginMutation.isPending}
              >
                {loginMutation.isPending ? (
                  "登入中..."
                ) : (
                  <>
                    <LogIn className="w-4 h-4 mr-2" />
                    登入
                  </>
                )}
              </Button>
            </form>

            <div className="mt-6 text-center text-sm">
              <span className="text-muted-foreground">還沒有帳號？</span>{" "}
              <Link href="/register" className="text-[#0F345B] font-medium hover:underline">
                  立即註冊
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Footer */}
      <div className="py-4 text-center text-white/50 text-sm">
        © 2024 幕創行銷 MOVE STRONG. All rights reserved.
      </div>
    </div>
  );
}
