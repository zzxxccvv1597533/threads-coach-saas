import { useState, useEffect } from "react";
import { useLocation, Link, useSearch } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Eye, EyeOff, UserPlus, ArrowLeft, Ticket, CheckCircle } from "lucide-react";

export default function Register() {
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  const searchParams = new URLSearchParams(searchString);
  const codeFromUrl = searchParams.get('code') || '';

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [invitationCode, setInvitationCode] = useState(codeFromUrl);
  const [showPassword, setShowPassword] = useState(false);

  // 如果 URL 有邀請碼，自動填入
  useEffect(() => {
    if (codeFromUrl) {
      setInvitationCode(codeFromUrl);
    }
  }, [codeFromUrl]);

  const registerMutation = trpc.auth.register.useMutation({
    onSuccess: () => {
      toast.success("註冊成功！");
      setLocation('/dashboard');
    },
    onError: (error) => {
      toast.error(error.message || "註冊失敗");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name) {
      toast.error("請填寫您的本名，方便我們核對報名資料");
      return;
    }
    
    if (!email || !password) {
      toast.error("請填寫 Email 和密碼");
      return;
    }
    
    if (password !== confirmPassword) {
      toast.error("兩次輸入的密碼不一致");
      return;
    }
    
    if (password.length < 6) {
      toast.error("密碼至少需要 6 個字元");
      return;
    }

    registerMutation.mutate({ 
      email, 
      password, 
      name,
      invitationCode: invitationCode || undefined,
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0F345B] via-[#0F345B] to-[#0a2540] flex flex-col">
      {/* 返回首頁連結 */}
      <div className="container py-6">
        <Link href="/">
          <a className="inline-flex items-center gap-2 text-white/70 hover:text-white transition-colors">
            <ArrowLeft className="w-4 h-4" />
            返回首頁
          </a>
        </Link>
      </div>

      {/* 註冊表單 */}
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
            <CardTitle className="text-2xl text-[#0F345B]">學員註冊</CardTitle>
            <CardDescription>
              建立您的幕創行銷 Threads AI 教練帳號
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">本名 <span className="text-red-500">*</span></Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="請填寫報名時使用的本名"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="name"
                  required
                />
                <p className="text-xs text-muted-foreground">
                  請填寫您報名課程時使用的本名，方便我們核對身份
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email <span className="text-red-500">*</span></Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">密碼 <span className="text-red-500">*</span></Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="至少 6 個字元"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="new-password"
                    className="pr-10"
                    required
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
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">確認密碼 <span className="text-red-500">*</span></Label>
                <Input
                  id="confirmPassword"
                  type={showPassword ? "text" : "password"}
                  placeholder="再次輸入密碼"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  required
                />
              </div>
              
              {/* 邀請碼區塊 */}
              <div className="space-y-2">
                <Label htmlFor="invitationCode" className="flex items-center gap-2">
                  <Ticket className="w-4 h-4 text-[#FCC80E]" />
                  邀請碼（選填）
                </Label>
                <Input
                  id="invitationCode"
                  type="text"
                  placeholder="輸入邀請碼可立即開通"
                  value={invitationCode}
                  onChange={(e) => setInvitationCode(e.target.value.toUpperCase())}
                  className={invitationCode ? "border-emerald-500 bg-emerald-50" : ""}
                />
                {invitationCode && (
                  <p className="text-xs text-emerald-600 flex items-center gap-1">
                    <CheckCircle className="w-3 h-3" />
                    使用邀請碼註冊將獲得 90 天免費使用權（仍需管理員審核）
                  </p>
                )}
                {!invitationCode && (
                  <p className="text-xs text-muted-foreground">
                    沒有邀請碼也可以註冊，需要等待管理員審核開通
                  </p>
                )}
              </div>

              <Button 
                type="submit" 
                className="w-full bg-[#0F345B] hover:bg-[#0F345B]/90"
                disabled={registerMutation.isPending}
              >
                {registerMutation.isPending ? (
                  "註冊中..."
                ) : (
                  <>
                    <UserPlus className="w-4 h-4 mr-2" />
                    註冊
                  </>
                )}
              </Button>
            </form>

            <div className="mt-6 text-center text-sm">
              <span className="text-muted-foreground">已經有帳號？</span>{" "}
              <Link href="/login">
                <a className="text-[#0F345B] font-medium hover:underline">
                  立即登入
                </a>
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
