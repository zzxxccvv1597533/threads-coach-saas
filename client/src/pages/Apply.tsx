import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { toast } from "sonner";
import { 
  Sparkles, 
  CheckCircle, 
  Clock, 
  AlertCircle,
  LogIn,
  Ticket,
  ArrowRight,
} from "lucide-react";

export default function Apply() {
  const { user, loading: isLoading } = useAuth();
  
  // 從 URL 參數獲取邀請碼
  const urlParams = new URLSearchParams(window.location.search);
  const codeFromUrl = urlParams.get('code') || '';
  
  const [inviteCode, setInviteCode] = useState(codeFromUrl);
  
  const { data: status, refetch: refetchStatus } = trpc.invitation.myStatus.useQuery(
    undefined,
    { enabled: !!user }
  );
  
  const useInvitation = trpc.invitation.use.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        toast.success(`開通成功！有效期 ${data.validDays} 天`);
        refetchStatus();
      } else {
        toast.error(data.message);
      }
    },
    onError: () => {
      toast.error("驗證失敗，請稍後再試");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteCode.trim()) {
      toast.error("請輸入邀請碼");
      return;
    }
    useInvitation.mutate({ code: inviteCode.trim().toUpperCase() });
  };

  // 計算剩餘天數
  const getRemainingDays = () => {
    if (!status?.expiresAt) return null;
    const now = new Date();
    const expires = new Date(status.expiresAt);
    const diff = expires.getTime() - now.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  const remainingDays = getRemainingDays();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">載入中...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      {/* Header */}
      <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-primary" />
            <span className="font-bold text-lg">幕創行銷 Threads AI 教練</span>
          </div>
          {user && (
            <div className="text-sm text-muted-foreground">
              {user.name || user.email}
            </div>
          )}
        </div>
      </header>

      <main className="container py-12">
        <div className="max-w-md mx-auto space-y-6">
          {/* Title */}
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-bold">學員專屬入口</h1>
            <p className="text-muted-foreground">
              使用邀請碼開通你的 AI 教練帳號
            </p>
          </div>

          {!user ? (
            /* 未登入狀態 */
            <Card className="elegant-card">
              <CardHeader className="text-center">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <LogIn className="w-8 h-8 text-primary" />
                </div>
                <CardTitle>請先登入</CardTitle>
                <CardDescription>
                  登入後即可使用邀請碼開通帳號
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button 
                  className="w-full" 
                  size="lg"
                  onClick={() => window.location.href = getLoginUrl()}
                >
                  <LogIn className="w-4 h-4 mr-2" />
                  登入 / 註冊
                </Button>
              </CardContent>
            </Card>
          ) : status?.activationStatus === 'activated' ? (
            /* 已開通狀態 */
            <Card className="elegant-card border-emerald-500/20">
              <CardHeader className="text-center">
                <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-8 h-8 text-emerald-500" />
                </div>
                <CardTitle className="text-emerald-600">帳號已開通</CardTitle>
                <CardDescription>
                  {remainingDays !== null && remainingDays > 0 ? (
                    <>剩餘 <span className="font-semibold text-foreground">{remainingDays}</span> 天</>
                  ) : remainingDays !== null && remainingDays <= 0 ? (
                    <span className="text-amber-500">即將到期，請聯繫管理員續約</span>
                  ) : (
                    '永久有效'
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 rounded-lg bg-muted/50 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">開通時間</span>
                    <span>{status.activatedAt ? new Date(status.activatedAt).toLocaleDateString('zh-TW') : '-'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">到期時間</span>
                    <span>{status.expiresAt ? new Date(status.expiresAt).toLocaleDateString('zh-TW') : '永久'}</span>
                  </div>
                  {status.activationNote && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">備註</span>
                      <span>{status.activationNote}</span>
                    </div>
                  )}
                </div>
                <Button 
                  className="w-full" 
                  size="lg"
                  onClick={() => window.location.href = '/'}
                >
                  進入系統
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </CardContent>
            </Card>
          ) : status?.activationStatus === 'expired' ? (
            /* 已過期狀態 */
            <Card className="elegant-card border-amber-500/20">
              <CardHeader className="text-center">
                <div className="w-16 h-16 rounded-full bg-amber-500/10 flex items-center justify-center mx-auto mb-4">
                  <Clock className="w-8 h-8 text-amber-500" />
                </div>
                <CardTitle className="text-amber-600">帳號已過期</CardTitle>
                <CardDescription>
                  請聯繫管理員續約，或使用新的邀請碼
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="inviteCode">邀請碼</Label>
                    <Input
                      id="inviteCode"
                      placeholder="請輸入 8 位邀請碼"
                      value={inviteCode}
                      onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                      maxLength={8}
                      className="text-center text-lg tracking-widest font-mono"
                    />
                  </div>
                  <Button 
                    type="submit" 
                    className="w-full" 
                    size="lg"
                    disabled={useInvitation.isPending}
                  >
                    {useInvitation.isPending ? '驗證中...' : '重新開通'}
                  </Button>
                </form>
              </CardContent>
            </Card>
          ) : (
            /* 待開通狀態 */
            <Card className="elegant-card">
              <CardHeader className="text-center">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <Ticket className="w-8 h-8 text-primary" />
                </div>
                <CardTitle>輸入邀請碼</CardTitle>
                <CardDescription>
                  請輸入課程提供的邀請碼來開通帳號
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="inviteCode">邀請碼</Label>
                    <Input
                      id="inviteCode"
                      placeholder="請輸入 8 位邀請碼"
                      value={inviteCode}
                      onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                      maxLength={8}
                      className="text-center text-lg tracking-widest font-mono"
                    />
                    <p className="text-xs text-muted-foreground text-center">
                      邀請碼為 8 位英數字組合
                    </p>
                  </div>
                  <Button 
                    type="submit" 
                    className="w-full" 
                    size="lg"
                    disabled={useInvitation.isPending || !inviteCode.trim()}
                  >
                    {useInvitation.isPending ? '驗證中...' : '開通帳號'}
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}

          {/* 說明 */}
          <div className="text-center text-sm text-muted-foreground space-y-2">
            <p>開通後可使用 90 天</p>
            <p>如有問題請聯繫課程助教</p>
          </div>
        </div>
      </main>
    </div>
  );
}
